/**
 * يفحص الدخول باسمٍ كُتب على غير رسمه المسجَّل.
 *
 *   node db/check-login-name.mjs
 *
 * الاسم يُكتب بيد صاحبه ولا يُختار من قائمة، والعربية تُكتب الهمزة فيها
 * وتُترك. فمن سُجّل «نوح احمد ابراهيم» وكتب «نوح أحمد إبراهيم» مُنع، ثم
 * مُنع خمساً فأُوقف حسابه ربع ساعة — وهو لم يُخطئ في شيء. وهذا أوّل ما
 * يقع يوم يُفتح النظام للعاملين.
 *
 * والذي يُخشى منه بعد التسوية: أن يُدخَل رجلٌ على حساب غيره. فالفحص
 * يشدّد على أن كلمة المرور لا تُسوّى، وأن الاسمين المتشابهين لا يُخمَّن
 * أيُّهما المقصود.
 */
import { PGlite } from "@electric-sql/pglite";
import bcrypt from "bcryptjs";

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const db = new PGlite();
await db.exec(`
  CREATE TABLE users (
    id text PRIMARY KEY,
    name text NOT NULL,
    job_title text NOT NULL DEFAULT '',
    role text NOT NULL,
    permissions text[] NOT NULL DEFAULT '{}',
    password_hash text,
    must_change_pin boolean NOT NULL DEFAULT false,
    failed_attempts int NOT NULL DEFAULT 0,
    locked_until timestamptz,
    active boolean NOT NULL DEFAULT true
  );
`);

/* الأسماء كما هي في نظام الشركة اليوم */
const STAFF = [
  "ذياب الخميس",
  "سامي الأسد",
  "محمد ششتري",
  "نوح احمد ابراهيم",
  "مصطفى الأنصاري",
  "ميس فخرالدين",
];
for (const [i, name] of STAFF.entries()) {
  await db.query(`INSERT INTO users (id, name, role) VALUES ($1, $2, 'engineer')`, [
    `u${i}`,
    name,
  ]);
}

/* التسوية نفسها التي في lib/server/auth.ts */
const normalizedName = (expr) =>
  `regexp_replace(
     translate(btrim(${expr}), 'أإآٱىةـًٌٍَُِّْ', 'اااايه'),
     '[[:space:]]+', ' ', 'g')`;

const find = async (typed) => {
  const r = await db.query(
    `SELECT id, name FROM users
     WHERE ${normalizedName("name")} = ${normalizedName("$1")} AND active`,
    [typed.trim()]
  );
  return r.rows;
};

console.log("\nالهمزة تُكتب وتُترك، والرجل واحد:\n");

const one = async (typed, expected) => {
  const rows = await find(typed);
  check(
    `«${typed}»`,
    rows.length === 1 && rows[0].name === expected,
    rows.length === 1 ? rows[0].name : `${rows.length} مطابقاً`
  );
};

await one("نوح احمد ابراهيم", "نوح احمد ابراهيم");
await one("نوح أحمد إبراهيم", "نوح احمد ابراهيم");
await one("نوح آحمد ابراهيم", "نوح احمد ابراهيم");
await one("مصطفى الأنصاري", "مصطفى الأنصاري");
await one("مصطفى الانصاري", "مصطفى الأنصاري");
await one("مصطفي الانصاري", "مصطفى الأنصاري");
await one("ذياب الخميس", "ذياب الخميس");

console.log("\nوالمسافات والتطويل والتشكيل لا تمنع:\n");

await one("  مصطفى   الانصاري  ", "مصطفى الأنصاري");
await one("ذيــاب الخميس", "ذياب الخميس");
await one("ذِيَاب الخَميس", "ذياب الخميس");

console.log("\nوما ليس اسماً مسجَّلاً لا يُقبل:\n");

check("اسمٌ لا وجود له", (await find("خالد صالح")).length === 0);
check("واسمٌ ناقص", (await find("نوح")).length === 0);
check("واسمٌ زائد", (await find("نوح احمد ابراهيم احمد")).length === 0);
check("والفارغ", (await find("   ")).length === 0);

console.log("\nوالموقوف لا يُطابَق:\n");
await db.query(`UPDATE users SET active = false WHERE id = 'u5'`);
check("من أُوقف حسابه", (await find("ميس فخرالدين")).length === 0);
await db.query(`UPDATE users SET active = true WHERE id = 'u5'`);

console.log("\nوحيث أشكل لم يُخمَّن:\n");

await db.query(
  `INSERT INTO users (id, name, role) VALUES ('x1', 'سعد المطيري', 'engineer'),
                                             ('x2', 'سعد المطيرى', 'engineer')`
);
const twins = await find("سعد المطيري");
check(
  "اسمان يستويان بعد التسوية = حسابان لا حساب",
  twins.length === 2,
  `${twins.length} مطابقاً`
);
const exact = twins.filter((u) => u.name === "سعد المطيري");
check("ويُقدَّم التطابق التامّ إن وُجد", exact.length === 1 && exact[0].id === "x1");
const noExact = twins.filter((u) => u.name === "سعد المطيرے");
check("وإن لم يوجد فلا دخول", noExact.length === 0);

console.log("\nوكلمة المرور لا تُسوّى ولا حرفاً:\n");

/* bcrypt مباشرةً: auth.ts يحمل server-only فلا يُستورد خارج الخادم */
const hash = await bcrypt.hash("Ahmad@2026", 4);
check("الكلمة الصحيحة تُقبل", await bcrypt.compare("Ahmad@2026", hash));
check("والحرف الكبير يُفرَّق", !(await bcrypt.compare("ahmad@2026", hash)));
check("والمسافة تُفرَّق", !(await bcrypt.compare("Ahmad@2026 ", hash)));

await db.close();

console.log(
  bad === 0
    ? "\n✓ الاسم يُعرف على رسميه، والكلمة تُقارَن حرفاً حرفاً"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
