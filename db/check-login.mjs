/**
 * يفحص الدخول إلى الخادم — بالأرقام السرّية القديمة وبكلمات المرور.
 *
 *   node db/check-login.mjs <نسخة.json>
 *
 * هذا أول ما يقع يوم النشر: يفتح النظام على الإنترنت، فيُكتب الاسم
 * والرقم السرّي. وإن أخفق هنا لم يدخل أحد — ولا تُقال له العلّة، بل
 * «اسم المستخدم أو كلمة المرور غير صحيحة»، فيظنّها نسياناً لا عطلاً.
 *
 * والأرقام السرّية في الدفاتر مجزّأة بـ SHA-256 من زمن المتصفّح، وخادم
 * اليوم يتحقّق بـ bcrypt. ولا يقبل أحدهما الآخر — وقد فُحص ذلك فوُجد
 * قبل النشر لا بعده.
 *
 * فما يُفحص هنا:
 *   • الرقم القديم يُقبل مرةً — فلا يُقفل الباب على أصحابه.
 *   • ويُلزَم صاحبه بكلمة مرورٍ حقيقية قبل أن يمضي.
 *   • ولا يُخطَّى الإلزام بإعادة تحميل الصفحة.
 *   • فإذا وضعها أُغلق الباب القديم فلا يُفتح برقمه أبداً.
 *   • والكلمة الضعيفة تُردّ، والمحاولات المتكرّرة تُوقف الحساب.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { spawn, execFileSync } from "child_process";
import { uuidFor } from "./ids.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-login.mjs <نسخة.json>");
  process.exit(1);
}

const PG_PORT = 55435;
const WEB_PORT = 3213;
const BASE = `http://127.0.0.1:${WEB_PORT}`;

/** الرقم السرّي القديم، والكلمة الحقيقية التي تحلّ محلّه */
const OLD_PIN = "4417";
const NEW_PASSWORD = "theyab-2026-kwd";

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** تجزئة المتصفّح القديمة — كما كانت تُحسب في lib/storage.ts */
const legacyHash = (pin) =>
  crypto.createHash("sha256").update(`theyab:${pin}`).digest("hex");

/* ------------------------------------------------------------------ */
/* القاعدة                                                             */
/* ------------------------------------------------------------------ */
const dir = path.join(ROOT, ".login-check");
fs.rmSync(dir, { recursive: true, force: true });

console.log("ينقل النسخة إلى قاعدة محلية…");
execFileSync(
  process.execPath,
  [path.join(HERE, "migrate.mjs"), BACKUP, "--local", "--keep", dir],
  { stdio: ["ignore", "ignore", "inherit"] }
);

const { PGlite } = await import("@electric-sql/pglite");
const seed = new PGlite(dir);

/* أي المستخدمين الحقيقيين تجزئته قديمة؟ */
const { rows: users } = await seed.query(
  "SELECT name, password_hash FROM users ORDER BY name"
);
const legacyCount = users.filter((u) => /^[0-9a-f]{64}$/.test(u.password_hash)).length;

console.log(`\nمستخدمو الدفاتر: ${users.length} · بتجزئة قديمة: ${legacyCount}\n`);

/* يُوضع لأحدهم رقمٌ سرّي معلوم، ولآخرَ مثله لفحص الإيقاف */
const WHO = "فاحص-الدخول";
const LOCKED = "فاحص-الإيقاف";
for (const name of [WHO, LOCKED]) {
  const id = uuidFor("login-" + name);
  await seed.query(
    `INSERT INTO users (id, name, job_title, role, permissions, password_hash, active, data)
     VALUES ($1::uuid, $2, 'فحص', 'محاسب', $3, $4, true, $5::jsonb)
     ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [
      id,
      name,
      ["movements.view"],
      legacyHash(OLD_PIN),
      JSON.stringify({ id, name, role: "محاسب", permissions: ["movements.view"] }),
    ]
  );
}
await seed.close();

/* ------------------------------------------------------------------ */
/* الخادم                                                              */
/* ------------------------------------------------------------------ */
const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
const live = new PGlite(dir);
const socket = new PGLiteSocketServer({ db: live, port: PG_PORT, host: "127.0.0.1" });
await socket.start();

const env = {
  ...process.env,
  DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${PG_PORT}/postgres`,
  NEXT_DIST_DIR: ".next-check",
  PORT: String(WEB_PORT),
};

console.log("يبني النظام…");
execFileSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "build"],
  { cwd: ROOT, env, stdio: ["ignore", "ignore", "inherit"], shell: process.platform === "win32" }
);

const web = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "start", "--port", String(WEB_PORT)],
  { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" }
);
let log = "";
web.stdout.on("data", (d) => (log += d));
web.stderr.on("data", (d) => (log += d));

const stop = async () => {
  web.kill();
  try {
    await socket.stop();
  } catch {}
  try {
    await live.close();
  } catch {}
};

process.stdout.write("ينتظر الخادم");
let up = false;
for (let i = 0; i < 90 && !up; i++) {
  await sleep(2000);
  process.stdout.write(".");
  try {
    up = (await fetch(BASE + "/api/auth/me")).status < 500;
  } catch {
    up = false;
  }
}
console.log("");
if (!up) {
  console.error("لم يبدأ الخادم:\n" + log.slice(-3000));
  await stop();
  process.exit(1);
}

const call = async (url, options = {}, cookie = "") => {
  const res = await fetch(BASE + url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...(options.headers ?? {}),
    },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {}
  return { status: res.status, body, setCookie: res.headers.get("set-cookie") ?? "" };
};

const signIn = (name, password) =>
  call("/api/auth/login", { method: "POST", body: JSON.stringify({ name, password }) });

try {
  console.log("");

  /* ---- 1. الرقم القديم يفتح الباب ---- */
  const first = await signIn(WHO, OLD_PIN);
  check(
    "الرقم السرّي القديم يُقبل — فلا يُقفل الباب على أصحابه",
    first.status === 200,
    `${first.status} ${first.body?.error ?? ""}`
  );

  const cookie = first.setCookie.split(";")[0];

  /* ---- 2. ويُلزَم صاحبه بكلمة مرورٍ حقيقية ---- */
  check(
    "ويُلزَم بوضع كلمة مرورٍ حقيقية",
    first.body?.user?.mustChangePassword === true,
    String(first.body?.user?.mustChangePassword)
  );

  /* ---- 3. ولا يُخطَّى الإلزام بإعادة التحميل ---- */
  const me = await call("/api/auth/me", {}, cookie);
  check(
    "ولا يُخطَّى الإلزام بإعادة تحميل الصفحة",
    me.body?.user?.mustChangePassword === true,
    String(me.body?.user?.mustChangePassword)
  );

  /* ---- 4. الرقم الخاطئ يُردّ ---- */
  const wrong = await signIn(WHO, "0000");
  check("والرقم الخاطئ يُردّ", wrong.status === 401, String(wrong.status));

  /* ---- 5. الكلمة الضعيفة تُردّ ---- */
  const weak = await call(
    "/api/auth/password",
    { method: "POST", body: JSON.stringify({ current: OLD_PIN, next: "12345678" }) },
    cookie
  );
  check(
    "وكلمةٌ كلّها أرقام تُردّ",
    weak.status === 400 && String(weak.body?.error ?? "").includes("أرقام"),
    String(weak.body?.error)
  );

  const short = await call(
    "/api/auth/password",
    { method: "POST", body: JSON.stringify({ current: OLD_PIN, next: "abc" }) },
    cookie
  );
  check("والقصيرة تُردّ", short.status === 400, String(short.body?.error));

  /* ---- 6. ووضعُها يُغلق الباب القديم ---- */
  const changed = await call(
    "/api/auth/password",
    { method: "POST", body: JSON.stringify({ current: OLD_PIN, next: NEW_PASSWORD }) },
    cookie
  );
  check("ووضع كلمةٍ صالحة يُقبل", changed.status === 200, String(changed.body?.error));

  const { rows: after } = await live.query(
    "SELECT password_hash, must_change_pin FROM users WHERE name = $1",
    [WHO]
  );
  check(
    "والمحفوظ صار bcrypt لا SHA-256",
    after[0]?.password_hash?.startsWith("$2"),
    (after[0]?.password_hash ?? "").slice(0, 7)
  );
  check("وسقط الإلزام", after[0]?.must_change_pin === false);

  /* ---- 7. الرقم القديم لا يفتح بعدها أبداً ---- */
  const old = await signIn(WHO, OLD_PIN);
  check(
    "والرقم القديم لا يفتح بعدها أبداً",
    old.status === 401,
    String(old.status)
  );

  const fresh = await signIn(WHO, NEW_PASSWORD);
  check("والكلمة الجديدة تفتح", fresh.status === 200, String(fresh.status));
  check(
    "بلا إلزامٍ هذه المرة",
    fresh.body?.user?.mustChangePassword === false,
    String(fresh.body?.user?.mustChangePassword)
  );

  /* ---- 8. المحاولات المتكرّرة تُوقف الحساب ---- */
  let locked = null;
  for (let i = 0; i < 6; i++) {
    locked = await signIn(LOCKED, "9999");
    if (locked.status === 429) break;
  }
  check(
    "وخمس محاولاتٍ خاطئة تُوقف الحساب مؤقتاً",
    locked?.status === 429,
    String(locked?.status)
  );
  const stillOut = await signIn(LOCKED, OLD_PIN);
  check(
    "فلا يفتح بالرقم الصحيح ما دام موقوفاً",
    stillOut.status === 429,
    String(stillOut.status)
  );

  /* ---- 9. ومستخدمو الدفاتر يدخلون بأرقامهم ---- */
  /* users قُرئت قبل إضافة حسابَي الفحص، فكلّها من الدفاتر */
  check(
    "ومستخدمو الدفاتر كلهم بتجزئةٍ قديمة — فكلّهم يدخلون بأرقامهم",
    legacyCount === users.length && legacyCount > 0,
    `${legacyCount} من ${users.length}`
  );
} catch (error) {
  bad++;
  console.error("\n" + String(error?.stack ?? error));
  console.error(log.slice(-1500));
}

await stop();
fs.rmSync(dir, { recursive: true, force: true });
fs.rmSync(path.join(ROOT, ".next-check"), { recursive: true, force: true });

console.log(
  bad === 0
    ? "\n✓ الدخول: الرقم القديم يفتح مرةً، ثم لا يفتح إلا كلمةٌ حقيقية"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
