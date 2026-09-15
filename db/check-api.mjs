/**
 * يفحص مسارات البيانات من طرف إلى طرف.
 *
 *   node db/check-api.mjs <نسخة.json>
 *
 * لا بمناداة الدوالّ مباشرةً، بل بخادمٍ يعمل وطلباتٍ حقيقية تمرّ على
 * الشبكة وكعكة جلسةٍ تُحمل معها — فما يُفحص هو ما سيقع فعلاً.
 *
 * والقاعدة محلّية: PGlite خلف مقبسٍ يتكلّم لغة Postgres نفسها، فيتّصل
 * بها pg وهو لا يعلم. ولا يُمسّ خادم الشركة بحرف.
 *
 * ما يُفحص:
 *   • بلا جلسة: لا شيء. لا قراءة ولا كتابة.
 *   • بجلسة: الحالة كاملةً ومعها رقم التغيير.
 *   • كتابة حركة: تصل، ويصل معها اسم من كتبها.
 *   • «ما استجدّ»: يعيدها لمن سأل برقمٍ أقدم، ولا يعيدها لمن سأل بأحدث.
 *   • موظفٌ بلا صلاحية: يُردّ من الخادم لا من الواجهة — ولا يُكتب شيء.
 *   • سجل التدقيق: لا يُحذف منه شيء، ولو طلبه صاحب كل الصلاحيات.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn, execFileSync } from "child_process";
import bcrypt from "bcryptjs";
import { uuidFor } from "./ids.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-api.mjs <نسخة.json>");
  process.exit(1);
}

const PG_PORT = 55433;
const WEB_PORT = 3211;
const BASE = `http://127.0.0.1:${WEB_PORT}`;
const PASSWORD = "fahs-2026-kwd";

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const dir = path.join(ROOT, ".api-check");
fs.rmSync(dir, { recursive: true, force: true });

console.log("ينقل النسخة إلى قاعدة محلية…");
execFileSync(
  process.execPath,
  [path.join(HERE, "migrate.mjs"), BACKUP, "--local", "--keep", dir],
  { stdio: ["ignore", "ignore", "inherit"] }
);

/* ---- مستخدمان للفحص: واحد بصلاحيات الحركات وآخر لا يملك إلا النظر ---- */
const { PGlite } = await import("@electric-sql/pglite");
const seed = new PGlite(dir);

const hash = await bcrypt.hash(PASSWORD, 10);
const ALL = [
  "movements.view",
  "movements.create",
  "movements.edit",
  "movements.delete",
  "movements.approve",
  "audit.view",
];

/*
  والصفّ يُكتب في عموده وفي data معاً: الأعمدة يقرؤها الدخول، و data
  تقرؤه readState. ومن كتب أحدهما دون الآخر رأى مستخدماً بلا اسم.
*/
async function makeUser(name, permissions) {
  const id = uuidFor("fahs-" + name);
  const user = {
    id,
    name,
    jobTitle: "فحص",
    role: "محاسب",
    permissions,
    pinHash: hash,
    mustChangePin: false,
    active: true,
  };
  await seed.query(
    `INSERT INTO users (id, name, job_title, role, permissions, password_hash, active, data)
     VALUES ($1::uuid, $2, 'فحص', 'محاسب', $3, $4, true, $5::jsonb)
     ON CONFLICT (id) DO UPDATE SET permissions = EXCLUDED.permissions,
                                    password_hash = EXCLUDED.password_hash,
                                    data = EXCLUDED.data`,
    [id, name, permissions, hash, JSON.stringify(user)]
  );
}
await makeUser("فاحص-كامل", ALL);
await makeUser("فاحص-ناقص", ["movements.view"]);

const { rows: counted } = await seed.query(
  "SELECT count(*)::int AS n FROM movements"
);
const MOVEMENTS = counted[0].n;
await seed.close();

/* ---- المقبس: PGlite بلغة Postgres، فيتّصل بها pg وهو لا يعلم ---- */
const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
const live = new PGlite(dir);
const socket = new PGLiteSocketServer({
  db: live,
  port: PG_PORT,
  host: "127.0.0.1",
});
await socket.start();

/* ---- الخادم ---- */
/*
  يُبنى ثم يُشغَّل، لا خادم تطوير: ذاك لا يقبل ثانياً في المجلّد نفسه،
  وقد يكون النظام مفتوحاً أمام أحدهم الآن. والبناء في مجلّدٍ مستقلّ
  فلا يُمسّ .next الذي يعمل عليه.
*/
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
  {
    cwd: ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
  }
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

const reachable = async () => {
  try {
    const r = await fetch(BASE + "/api/auth/me");
    return r.status < 500;
  } catch {
    return false;
  }
};

process.stdout.write("ينتظر الخادم");
let up = false;
for (let i = 0; i < 90 && !up; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  process.stdout.write(".");
  up = await reachable();
}
console.log("");
if (!up) {
  console.error("لم يبدأ الخادم:\n" + log.slice(-3000));
  await stop();
  process.exit(1);
}

/* ---- أدوات الطلب ---- */
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
  return {
    status: res.status,
    body,
    setCookie: res.headers.get("set-cookie") ?? "",
  };
};

const signIn = async (name) => {
  const login = await call("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ name, password: PASSWORD }),
  });
  if (login.status !== 200) {
    throw new Error("فشل الدخول: " + JSON.stringify(login.body));
  }
  return login.setCookie.split(";")[0];
};

try {
  console.log("");

  /* ---- 1. بلا جلسة ---- */
  const anonRead = await call("/api/data");
  check("بلا جلسة: القراءة ممنوعة", anonRead.status === 401, String(anonRead.status));

  const anonWrite = await call("/api/data", {
    method: "POST",
    body: JSON.stringify({ upserts: { movements: [] } }),
  });
  check("بلا جلسة: الكتابة ممنوعة", anonWrite.status === 401, String(anonWrite.status));

  /* ---- 2. القراءة ---- */
  const cookie = await signIn("فاحص-كامل");
  const read = await call("/api/data", {}, cookie);
  check(
    "الحالة تصل كاملةً",
    read.status === 200 && read.body?.state?.movements?.length === MOVEMENTS,
    `${read.body?.state?.movements?.length} / ${MOVEMENTS} حركة`
  );
  check("ومعها رقم التغيير", Number(read.body?.rev) > 0, String(read.body?.rev));
  check(
    "ودليل الحسابات معها",
    (read.body?.state?.chart?.length ?? 0) > 0,
    `${read.body?.state?.chart?.length} حساباً`
  );

  /*
    الحارس. قبل أن تُكتب حركةٌ واحدة يجب أن يُتيقَّن أن الخادم يكلّم
    القاعدة المحلّية لا قاعدة الشركة: ملف .env.local فيه رابطها،
    وحركة فحصٍ تقع في دفاتر الشركة خطأ لا يُصلَح باعتذار.

    والدليل أن المستخدمَين المُصطنَعَين لا وجود لهما إلا هنا.
  */
  const names = (read.body?.state?.users ?? []).map((u) => u.name);
  const local = names.includes("فاحص-كامل") && names.includes("فاحص-ناقص");
  check("القاعدة هي المحلّية لا قاعدة الشركة", local);
  if (!local) throw new Error("توقّف قبل أي كتابة: القاعدة ليست المحلّية");

  const revBefore = Number(read.body.rev);

  /* ---- 3. الكتابة ---- */
  const movement = {
    id: "44444444-4444-4444-8444-444444444444",
    entryNo: 99101,
    fiscalYear: 2026,
    date: "2026-09-15",
    movementType: "مصروف",
    description: "حركة فحص المسارات",
    itemCode: "EXP004",
    itemName: "مواد إنشائية",
    debitCode: "5110",
    creditCode: "1111",
    amount: 7.125,
    project: "عام",
    person: "",
    paymentMethod: "نقدي",
    party: "",
    source: "فحص",
    approval: "بانتظار الاعتماد",
    approvedBy: "",
    approvedAt: "",
    approvalNote: "",
  };

  const wrote = await call(
    "/api/data",
    { method: "POST", body: JSON.stringify({ upserts: { movements: [movement] } }) },
    cookie
  );
  check(
    "الكتابة تُقبل",
    wrote.status === 200 && wrote.body?.written === 1,
    JSON.stringify(wrote.body)
  );
  check(
    "ورقم التغيير تقدّم",
    Number(wrote.body?.rev) > revBefore,
    `${revBefore} ← ${wrote.body?.rev}`
  );

  /* ---- 4. ما استجدّ ---- */
  const since = await call(`/api/data/changes?since=${revBefore}`, {}, cookie);
  const got = (since.body?.upserts?.movements ?? []).find((m) => m.id === movement.id);
  check(
    "«ما استجدّ» يعيدها لمن سأل بالقديم",
    Boolean(got) && got.amount === 7.125,
    String(got?.amount)
  );

  const newest = await call(`/api/data/changes?since=${wrote.body.rev}`, {}, cookie);
  check(
    "ولا يعيدها لمن سأل بالأحدث",
    (newest.body?.upserts?.movements ?? []).length === 0,
    `${(newest.body?.upserts?.movements ?? []).length} صفّاً`
  );

  const bogus = await call("/api/data/changes?since=ليس-رقماً", {}, cookie);
  check("والسؤال بلا رقمٍ يُردّ", bogus.status === 400, String(bogus.status));

  /* ---- 5. من كتبها ---- */
  const { rows: who } = await live.query(
    "SELECT updated_by FROM movements WHERE id = $1::uuid",
    [movement.id]
  );
  check("الصفّ يحمل اسم من كتبه", who[0]?.updated_by === "فاحص-كامل", who[0]?.updated_by);

  /* ---- 6. الصلاحية تُفحص على الخادم ---- */
  const weak = await signIn("فاحص-ناقص");
  const refused = await call(
    "/api/data",
    {
      method: "POST",
      body: JSON.stringify({
        upserts: {
          movements: [
            {
              ...movement,
              id: "55555555-5555-4555-8555-555555555555",
              entryNo: 99102,
            },
          ],
        },
      }),
    },
    weak
  );
  check("من لا صلاحية له يُردّ من الخادم", refused.status === 403, String(refused.status));
  check(
    "والسبب يُذكر لا يُبهم",
    String(refused.body?.error ?? "").includes("صلاحية"),
    String(refused.body?.error)
  );

  const { rows: after } = await live.query(
    "SELECT count(*)::int AS n FROM movements"
  );
  check("ولم تُكتب حركته", after[0].n === MOVEMENTS + 1, String(after[0].n));

  const canRead = await call("/api/data", {}, weak);
  check("وهو يقرأ كما كان", canRead.status === 200, String(canRead.status));

  /* ---- 7. سجل التدقيق لا يُحذف ---- */
  const wipe = await call(
    "/api/data",
    { method: "POST", body: JSON.stringify({ deletes: { audit: ["أيّ-كان"] } }) },
    cookie
  );
  check("سجل التدقيق لا يُحذف منه شيء", wipe.status === 403, String(wipe.body?.error));

  /* ---- 8. الحذف ---- */
  const removed = await call(
    "/api/data",
    { method: "POST", body: JSON.stringify({ deletes: { movements: [movement.id] } }) },
    cookie
  );
  check(
    "الحذف يُقبل ممّن له صلاحيته",
    removed.status === 200 && removed.body?.deleted === 1,
    JSON.stringify(removed.body)
  );

  const gone = await call(`/api/data/changes?since=${wrote.body.rev}`, {}, cookie);
  check(
    "وشاهده يصل",
    (gone.body?.deletes?.movements ?? []).includes(movement.id),
    JSON.stringify(gone.body?.deletes ?? {})
  );

  const { rows: end } = await live.query("SELECT count(*)::int AS n FROM movements");
  check("والقاعدة عادت كما كانت", end[0].n === MOVEMENTS, String(end[0].n));
} catch (error) {
  bad++;
  console.error("\n" + String(error?.stack ?? error));
  console.error(log.slice(-2000));
}

await stop();
fs.rmSync(dir, { recursive: true, force: true });
fs.rmSync(path.join(ROOT, ".next-check"), { recursive: true, force: true });

console.log(
  bad === 0
    ? "\n✓ المسارات تعمل: الجلسة تُفحص، والصلاحية تُفحص، وما استجدّ يصل"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
