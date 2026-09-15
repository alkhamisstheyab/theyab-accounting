/**
 * يفحص المزامنة نفسها — الوحدة التي في المتصفّح — على خادمٍ يعمل.
 *
 *   node db/check-sync.mjs <نسخة.json>
 *
 * فحص التوازي (check-parallel) أثبت الحساب: الفرق يُحسب صحيحاً ويُكتب
 * صحيحاً. وهذا يفحص ما حوله: التأجيل والإخفاق وإعادة المحاولة.
 *
 * وأهمّها الإخفاق. فالسؤال الذي يُقلق في التشغيل المتوازي ليس «أتصل
 * الحركة؟» بل «إن لم تصل، أتضيع؟». فيُقطع الخادم في منتصف اليوم ويُعمل
 * عليه وهو مقطوع، ثم يُوصل — ويُنظر أوصل ما فات أم سقط.
 *
 * ولا متصفّح هنا: الوحدة نفسها تُشغَّل على Node، ويُصطنع لها ما تحتاجه
 * منه — تخزينٌ محلّي وكعكةُ جلسة. وما عدا ذلك هو هو.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn, execFileSync } from "child_process";
import bcrypt from "bcryptjs";
import { createJiti } from "jiti";
import { uuidFor } from "./ids.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-sync.mjs <نسخة.json>");
  process.exit(1);
}

const PG_PORT = 55434;
const WEB_PORT = 3212;
const BASE = `http://127.0.0.1:${WEB_PORT}`;
const PASSWORD = "fahs-2026-kwd";

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* القاعدة والمستخدم                                                   */
/* ------------------------------------------------------------------ */
const dir = path.join(ROOT, ".sync-check");
fs.rmSync(dir, { recursive: true, force: true });

console.log("ينقل النسخة إلى قاعدة محلية…");
execFileSync(
  process.execPath,
  [path.join(HERE, "migrate.mjs"), BACKUP, "--local", "--keep", dir],
  { stdio: ["ignore", "ignore", "inherit"] }
);

const { PGlite } = await import("@electric-sql/pglite");
const seed = new PGlite(dir);

const hash = await bcrypt.hash(PASSWORD, 10);
const PERMISSIONS = [
  "movements.view",
  "movements.create",
  "movements.edit",
  "movements.delete",
  "movements.approve",
  "projects.manage",
  "contractors.manage",
  "settings.manage",
  "audit.view",
];
const NAME = "فاحص-المزامنة";
const id = uuidFor("fahs-" + NAME);
await seed.query(
  `INSERT INTO users (id, name, job_title, role, permissions, password_hash, active, data)
   VALUES ($1::uuid, $2, 'فحص', 'محاسب', $3, $4, true, $5::jsonb)
   ON CONFLICT (id) DO UPDATE SET permissions = EXCLUDED.permissions,
                                  password_hash = EXCLUDED.password_hash,
                                  data = EXCLUDED.data`,
  [
    id,
    NAME,
    PERMISSIONS,
    hash,
    JSON.stringify({
      id,
      name: NAME,
      jobTitle: "فحص",
      role: "محاسب",
      permissions: PERMISSIONS,
      pinHash: hash,
      mustChangePin: false,
      active: true,
    }),
  ]
);
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

/* ------------------------------------------------------------------ */
/* ما يصطنعه المتصفّح                                                  */
/* ------------------------------------------------------------------ */
const store = new Map();
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

/** الكعكة تُحمل كما يحملها المتصفّح، والروابط نسبية كما يكتبها */
let cookie = "";
/** عدد ما أُرسل من طلبات الكتابة — به يُعرف أن التأجيل يجمع ولا يكرّر */
let posts = 0;
/** قطعُ الخطّ: يُحاكى بمنع الطلبات لا بإسقاط الخادم */
let offline = false;

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const target = String(url).startsWith("http") ? String(url) : BASE + String(url);
  if (target.includes("/api/data") && options.method === "POST") posts++;
  if (offline) throw new TypeError("fetch failed");
  return realFetch(target, {
    ...options,
    headers: { ...(options.headers ?? {}), ...(cookie ? { cookie } : {}) },
  });
};

const jiti = createJiti(import.meta.url);
const { parseBackup, newId } = await jiti.import("../lib/storage.ts");
const { compareStates } = await jiti.import("../lib/changes.ts");
const sync = await jiti.import("../lib/sync.ts");

/** ينتظر حتى تصير الحال كذا، أو ينقضي الأمد */
async function until(predicate, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (predicate(sync.syncStatus())) return true;
    await sleep(250);
  }
  return false;
}

const clone = (o) => JSON.parse(JSON.stringify(o));

try {
  console.log("");

  /* ---- الدخول ---- */
  const login = await realFetch(BASE + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: NAME, password: PASSWORD }),
  });
  if (login.status !== 200) throw new Error("فشل الدخول");
  cookie = (login.headers.get("set-cookie") ?? "").split(";")[0];

  /* ---- 1. مطفأة حتى تُشعَل ---- */
  check("مطفأة حتى تُشعَل", sync.syncStatus().phase === "مطفأة");
  const before = posts;
  const local = parseBackup(fs.readFileSync(BACKUP, "utf8"));
  sync.record(local);
  await sleep(1000);
  check("ومطفأةً لا ترسل شيئاً", posts === before, `${posts - before} طلباً`);

  /* ---- 2. الإشعال يتّصل ---- */
  sync.setSyncEnabled(true);
  const connected = await until((s) => s.phase === "متزامنة");
  check("الإشعال يتّصل ويقرأ الحالة", connected, sync.syncStatus().phase);
  check("ورقم التغيير وصل", sync.syncStatus().rev > 0, String(sync.syncStatus().rev));

  /* ---- 3. حالةٌ لم تتغيّر لا تُرسَل ---- */
  const quiet = posts;
  sync.record(local);
  await sleep(4500);
  check("حالةٌ لم تتغيّر لا تُرسَل", posts === quiet, `${posts - quiet} طلباً`);

  /* ---- 4. حركة تُدخل فتصل ---- */
  const movementLike = clone(local.movements[0]);
  const added = {
    ...movementLike,
    id: newId(),
    entryNo: 99301,
    date: "2026-09-15",
    description: "حديد — فحص المزامنة",
    amount: 45.5,
    approval: "بانتظار الاعتماد",
    approvedBy: "",
    approvedAt: "",
  };
  const revBefore = sync.syncStatus().rev;
  local.movements.push(added);
  sync.record(local);

  const sent = await until((s) => s.rev > revBefore && s.pending === 0);
  check("حركة تُدخل فتصل الخادم", sent, sync.syncStatus().phase);

  const { rows: found } = await live.query(
    "SELECT amount::text AS a, updated_by FROM movements WHERE id = $1::uuid",
    [added.id]
  );
  check("وهي في القاعدة بمبلغها", Number(found[0]?.a) === 45.5, String(found[0]?.a));
  check("وباسم من كتبها", found[0]?.updated_by === NAME, found[0]?.updated_by);

  /* ---- 5. حفظاتٌ متتابعة تُجمع في طلبٍ واحد ---- */
  const burst = posts;
  for (let i = 0; i < 5; i++) {
    local.movements.find((m) => m.id === added.id).description =
      "حديد — فحص المزامنة " + i;
    sync.record(local);
    await sleep(200);
  }
  await until((s) => s.pending === 0 && s.phase === "متزامنة");
  check(
    "خمس حفظاتٍ متتابعة تُجمع في طلبٍ واحد",
    posts - burst === 1,
    `${posts - burst} طلباً`
  );

  /* ---- 6. الخطّ ينقطع والعمل يستمرّ ---- */
  offline = true;
  const cut = {
    ...movementLike,
    id: newId(),
    entryNo: 99302,
    date: "2026-09-15",
    description: "رمل — أُدخلت والخطّ مقطوع",
    amount: 77.25,
  };
  local.movements.push(cut);
  sync.record(local);

  const noticed = await until((s) => s.phase === "منقطعة");
  check("الانقطاع يُعرف ويُقال", noticed, sync.syncStatus().phase);
  check(
    "وما لم يصل يُعدّ ولا يُنسى",
    sync.syncStatus().pending > 0,
    `${sync.syncStatus().pending} صفّاً`
  );

  const { rows: absent } = await live.query(
    "SELECT count(*)::int AS n FROM movements WHERE id = $1::uuid",
    [cut.id]
  );
  check("ولم تُكتب في القاعدة بعد", absent[0].n === 0);

  /* والعمل يستمرّ والخطّ مقطوع */
  const alsoCut = {
    ...movementLike,
    id: newId(),
    entryNo: 99303,
    date: "2026-09-15",
    description: "بلوك — والخطّ ما زال مقطوعاً",
    amount: 12,
  };
  local.movements.push(alsoCut);
  sync.record(local);
  await sleep(1000);
  check(
    "والعمل يستمرّ والخطّ مقطوع",
    sync.syncStatus().pending >= 2,
    `${sync.syncStatus().pending} صفّاً ينتظر`
  );

  /* ---- 7. يعود الخطّ فيلحق ما فات ---- */
  offline = false;
  const caught = await until((s) => s.phase === "متزامنة" && s.pending === 0, 60000);
  check("يعود الخطّ فيلحق ما فات", caught, sync.syncStatus().phase);

  const { rows: both } = await live.query(
    "SELECT count(*)::int AS n FROM movements WHERE id = ANY($1::uuid[])",
    [[cut.id, alsoCut.id]]
  );
  check("والحركتان المتأخّرتان في القاعدة", both[0].n === 2, `${both[0].n} من 2`);

  /* ---- 8. ما على الخادم وحده لا يُمَسّ ---- */
  /*
    حساب الفاحص أُنشئ على الخادم ولا وجود له في نسخة الجهاز. ولو حُسب
    الفرق حساباً مجرّداً لقال «احذفه» — ومحا في أول اتصالٍ حساباً أنشأه
    غيره. وهذا ما وقع فعلاً في أول تشغيلٍ لهذا الفحص.
  */
  const { rows: survived } = await live.query(
    "SELECT count(*)::int AS n FROM users WHERE name = $1",
    [NAME]
  );
  check("حسابٌ أُنشئ على الخادم لا يمحوه الجهاز", survived[0].n === 1);

  /* ---- 9. وما عدا ذلك سواء ---- */
  const server = await sync.fetchServerState();
  const report = compareStates(local, server);
  const off = report.fields.filter((f) => !f.agree).map((f) => f.field);
  check(
    "النسختان متطابقتان فيما عدا ذلك الحساب",
    off.length === 1 && off[0] === "users",
    off.join("، ") || "لا فرق"
  );

  const users = report.fields.find((f) => f.field === "users");
  check(
    "والفرق في المستخدمين زيادةٌ عند الخادم لا نقص",
    users.extra.length === 1 && users.missing.length === 0 && users.different.length === 0,
    `زائد ${users.extra.length} · ناقص ${users.missing.length}`
  );

  /* ---- 10. الإطفاء يُسكتها ---- */
  sync.setSyncEnabled(false);
  const after = posts;
  local.movements.push({ ...movementLike, id: newId(), entryNo: 99304, amount: 1 });
  sync.record(local);
  await sleep(4500);
  check("الإطفاء يُسكتها", posts === after, `${posts - after} طلباً`);
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
    ? "\n✓ المزامنة: تؤجّل وتجمع، وتصمد للانقطاع، ولا تضيّع حركة"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
