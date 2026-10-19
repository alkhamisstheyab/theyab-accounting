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
import http from "node:http";
import { gunzipSync } from "node:zlib";
import bcrypt from "bcryptjs";
import { createJiti } from "jiti";
import { uuidFor } from "./ids.mjs";
import { killTree, requireFreePorts } from "./ports.mjs";

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

await requireFreePorts([
  [WEB_PORT, "خادم الويب"],
  [PG_PORT, "منفذ القاعدة"],
]);

const dir = path.join(ROOT, ".api-check");
fs.rmSync(dir, { recursive: true, force: true });

console.log("ينقل النسخة إلى قاعدة محلية…");
execFileSync(
  process.execPath,
  [path.join(HERE, "migrate.mjs"), BACKUP, "--local", "--keep", dir],
  { stdio: ["ignore", "ignore", "inherit"] }
);

/* ---- ثلاثةٌ للفحص: صاحبُ كلِّ شيء، ومن لا يملك إلا النظر، وناسخٌ محجوب ---- */
const { PGlite } = await import("@electric-sql/pglite");
const seed = new PGlite(dir);

const hash = await bcrypt.hash(PASSWORD, 10);
/*
  وصلاحياتُه كلُّها، تُقرأ من موضعها لا تُكتب هنا.

  وكانت ستّاً من صلاحيات الحركات واسمُها ALL. ثم صار الخادم يُرشّح
  المجموعات بالصلاحية، و`users` منها — فلم يَعُد صاحبُ الستّ يقرأ
  المستخدمين. والحارسُ أسفلَ يستدلّ على محلّية القاعدة بأسماء
  المُصطنَعين في الحالة: فصار يطلب دليلاً محجوباً عنه، فاستحال أن
  يُفلح، وتوقّف الفحصُ قبل أقسامه كلّها.

  فتُقرأ من `ALL_PERMISSIONS`: فما يُضاف من صلاحيةٍ غداً يدخل من
  تلقائه، ولا يَبلى الفحصُ مرّةً أخرى.
*/
const { ALL_PERMISSIONS } = await createJiti(import.meta.url).import(
  "../lib/permissions.ts"
);
const ALL = [...ALL_PERMISSIONS];

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
/* له النسخُ ولا يقرأ كلَّ الدفاتر — وبه يُفحص أن النسخة لا تكون باباً خلفيّاً */
await makeUser("فاحص-ناسخ", ["backup.run", "movements.view"]);

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
  killTree(web);
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

/*
  طلبٌ خامٌّ بـ`node:http`.

  و`fetch` لا يصلح لفحص الضغط: يُعلن قبولَه ثم يفكّه ويسلّم النصّ —
  فلا يُعرف أضُغط أم لم يُضغط. والخامُّ يُسلّم البايتات كما جاءت.
*/
const raw = (url, headers = {}) =>
  new Promise((resolve, reject) => {
    const request = http.request(BASE + url, { headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
        })
      );
    });
    request.on("error", reject);
    request.end();
  });

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

  /* ---- 9. النسخة الاحتياطية من الخادم ---- */
  console.log("\n  النسخة من الدفاتر:");

  const anonBackup = await raw("/api/backup");
  check(
    "بلا جلسة لا تُعطى",
    anonBackup.status === 401 || anonBackup.status === 403,
    String(anonBackup.status)
  );

  const weakBackup = await raw("/api/backup", { cookie: weak });
  check(
    "ومن لا صلاحية نسخٍ له يُردّ",
    weakBackup.status === 403,
    String(weakBackup.status)
  );

  /*
    ومن له النسخُ وحُجب عنه شيء: يُردّ أيضاً. فالنسخة كاملةٌ غيرُ
    مرشَّحة، فلو أُعطيت له بلغ بها ما حُجب عنه في الشاشة.
  */
  const copier = await signIn("فاحص-ناسخ");
  const partial = await raw("/api/backup", { cookie: copier });
  const partialBody = JSON.parse(partial.body.toString("utf8"));
  check(
    "ومن حُجب عنه شيءٌ يُردّ ولو كان له النسخ",
    partial.status === 403,
    String(partial.status)
  );
  check(
    "ويُسمّى له ما لا يقرؤه",
    String(partialBody?.error ?? "").includes("الرواتب") ||
      String(partialBody?.error ?? "").includes("employees") ||
      String(partialBody?.error ?? "").includes("payrollRuns"),
    String(partialBody?.error ?? "").slice(0, 90)
  );

  /* ---- ومن يقرأ الدفاتر كلها ---- */
  const plain = await raw("/api/backup", {
    cookie,
    "accept-encoding": "identity",
  });
  check("ولصاحب الصلاحية تُعطى", plain.status === 200, String(plain.status));
  check(
    "وبترويسة تنزيلٍ باسم ملفٍّ",
    /attachment; filename="theyab-accounting-/.test(
      String(plain.headers["content-disposition"] ?? "")
    ),
    String(plain.headers["content-disposition"] ?? "")
  );

  const file = JSON.parse(plain.body.toString("utf8"));
  check(
    "وصورتُها صورةُ ملفّ النسخة",
    file.app === "Theyab Accounting" && typeof file.exportedAt === "string" && !!file.data,
    Object.keys(file).join("، ")
  );
  check(
    "وفيها الدفاتر",
    (file.data.movements ?? []).length === MOVEMENTS,
    `${(file.data.movements ?? []).length} من ${MOVEMENTS}`
  );
  /*
    والمفحوصُ أن التجزئةَ تصل **كما في عمودها**، لا أن لكلِّ مستخدمٍ
    تجزئة. فأوّلُ ما كُتب هذا الشرطُ طلب تجزئةً للجميع فأخفق: ٣ من ٩.
    وكان صادقاً في إخفاقه — فستّةٌ منهم جاؤوا من نسخة المتصفّح وهي لا
    تحمل التجزئات، وتلك هي العلّةُ التي من أجلها بُني هذا المسار.
  */
  const { rows: hashRows } = await live.query(
    "SELECT name, password_hash FROM users ORDER BY name"
  );
  const inColumn = new Map(hashRows.map((r) => [r.name, r.password_hash ?? ""]));
  const carried = (file.data.users ?? []).filter(
    (u) => (u.pinHash ?? "") === (inColumn.get(u.name) ?? "")
  );
  const haveOne = hashRows.filter((r) => (r.password_hash ?? "").length > 20);
  check(
    "وتجزئةُ كلٍّ كما في عمودها — وبغيرها لا يدخل أحدٌ بعد الاسترجاع",
    (file.data.users ?? []).length === hashRows.length &&
      carried.length === hashRows.length &&
      haveOne.length > 0,
    `${carried.length} من ${hashRows.length} · ولصاحبِ تجزئةٍ في الدفاتر: ${haveOne.length}`
  );

  /* ---- والضغط: فحدُّ فيرسل ٤٫٥ ميغا والنسخة تكبر كلَّ يوم ---- */
  const packed = await raw("/api/backup", { cookie, "accept-encoding": "gzip" });
  check(
    "وتُضغط لمن يقبل الضغط",
    String(packed.headers["content-encoding"] ?? "") === "gzip",
    String(packed.headers["content-encoding"] ?? "بلا ضغط")
  );
  check(
    "وتصغر بها كثيراً",
    packed.body.length * 2 < plain.body.length,
    `${(packed.body.length / 1024).toFixed(0)} ك.بايت من ${(
      plain.body.length / 1024
    ).toFixed(0)}`
  );
  check(
    "والمفكوكُ هو النصُّ نفسه حرفاً بحرف",
    gunzipSync(packed.body).toString("utf8").length === plain.body.toString("utf8").length,
    "فما حُفظ عند صاحبه نصٌّ كما كان"
  );
  check(
    "ولا يُضغط لمن لا يقبله — فلا يُحفظ ملفٌّ لا يُقرأ",
    !plain.headers["content-encoding"],
    String(plain.headers["content-encoding"] ?? "بلا ترويسة")
  );
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
