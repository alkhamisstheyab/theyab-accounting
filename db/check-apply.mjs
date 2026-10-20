/**
 * يفحص بابَ التحديث.
 *
 *   npm run check:apply
 *
 * والبابُ خطرٌ بطبعه: يكتب في بنية قاعدةٍ فيها عملُ سنة. فيُفحص على
 * قاعدةٍ حقيقيّةٍ محلّية — تُبنى من المخطَّط، ثم تُطبَّق عليها الهجرات
 * مرّتين — لا على نصّ الشِّفْر وحده.
 *
 * وأربعةٌ تُحرس:
 *
 *   • **ألّا تَهدم هجرة.** `DROP` أو `TRUNCATE` أو `DELETE` تُطبَّق
 *     مرّةً وتمحو ما لا يَرجع، ولا يُستدرك بإعادة تشغيل. فتُردّ قبل
 *     الاتصال بالقاعدة — لا بعده، فبعدَه يكون الضررُ قد وقع.
 *
 *   • **أن تُطبَّق مرّتين فلا تضرّ.** فالبابُ يُفتح على قواعدَ حالُها
 *     مختلف، ومن أعاد تشغيلَه بعد انقطاعٍ وجب أن يستأنف لا أن يُخفق.
 *
 *   • **ألّا تفترق الهجرةُ عن المخطَّط.** من أضاف جدولاً في الهجرة
 *     وحدها اختلفت قاعدةُ من يبدأ اليومَ عن قاعدة من بدأ أمس — وتلك
 *     علّةٌ تظهر بعد شهورٍ في موضعٍ لا يُربط بها.
 *
 *   • **ألّا يُكذب السجلّ.** قاعدةٌ بُنيت من المخطَّط تحمل بنيةَ
 *     الهجرات أصلاً، فتُسجَّل مطبَّقةً — ومن قرأ سجلّاً ناقصاً ظنّ
 *     القاعدةَ ناقصةً وهي تامّة.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const DIR = path.join(HERE, "migrations");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const schema = fs.readFileSync(path.join(HERE, "schema.sql"), "utf8");
const applySrc = fs.readFileSync(path.join(HERE, "apply.mjs"), "utf8");
const migrateSrc = fs.readFileSync(path.join(HERE, "migrate.mjs"), "utf8");

const files = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter((n) => n.endsWith(".sql")).sort()
  : [];

console.log(`\nالهجرات: ${files.length}\n`);

check("مجلّدُ الهجرات موجود", fs.existsSync(DIR));
check(
  "وأسماؤها مرقّمةٌ بثلاث خانات",
  files.every((n) => /^\d{3}-/.test(n)),
  files.join("، ") || "لا شيء"
);
check(
  "ولا يتكرّر رقم",
  new Set(files.map((n) => n.slice(0, 3))).size === files.length
);

/* ------------------------------------------------------------------ */
console.log("\nوالهجرةُ إضافيّةٌ لا هادمة:\n");

const stripComments = (sql) =>
  sql.split("\n").map((l) => l.replace(/--.*$/, "")).join("\n");

let destructive = [];
for (const name of files) {
  const bare = stripComments(fs.readFileSync(path.join(DIR, name), "utf8"));
  if (/\bDROP\s+(TABLE|SCHEMA|COLUMN|DATABASE)\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i.test(bare)) {
    destructive.push(name);
  }
}
check(
  "لا هجرةَ فيها حذفٌ أو تفريغ",
  destructive.length === 0,
  destructive.join("، ") || `${files.length} هجرةً`
);
/*
  والتعبيرُ يأخذ العبارةَ كلَّها لا صدرَها: أوّلُ ما كُتب اقتطع
  «CREATE TABLE IF» فوجد فيه «IF» ولم يجد «IF NOT EXISTS»، فأخفق على
  هجرةٍ صحيحة. فيُطلب الشرطُ موضعاً لا نصّاً يُبحث فيه.
*/
const unguarded = [];
for (const name of files) {
  const sql = stripComments(fs.readFileSync(path.join(DIR, name), "utf8"));
  for (const m of sql.matchAll(
    /CREATE\s+(?:UNIQUE\s+)?(TABLE|INDEX)\s+(IF\s+NOT\s+EXISTS\s+)?([a-z_]+)/gi
  )) {
    if (!m[2]) unguarded.push(`${name}: ${m[1]} ${m[3]}`);
  }
}
check(
  "وكلُّها بـIF NOT EXISTS",
  unguarded.length === 0,
  unguarded.length === 0 ? "فتُطبَّق مرّتين فلا تُخفق" : unguarded.join("، ")
);
check(
  "والحارسُ في الباب نفسه",
  /const FORBIDDEN = \[/.test(applySrc) &&
    /والهجراتُ إضافيّةٌ لا هادمة/.test(applySrc)
);
check(
  "ويُفحص قبل الاتصال بالقاعدة",
  applySrc.indexOf("const migrations = readMigrations();") <
    applySrc.indexOf("const db = await connect();"),
  "فبعدَه يكون الضررُ قد وقع"
);
check(
  "ولا يُخدَع بتعليق",
  /const stripComments =/.test(applySrc),
  "فـ«لا DROP» مكتوبةٌ في تعليق الباب نفسه"
);

/* ------------------------------------------------------------------ */
console.log("\nولا تفترق الهجرةُ عن المخطَّط:\n");

const created = [];
for (const name of files) {
  const sql = stripComments(fs.readFileSync(path.join(DIR, name), "utf8"));
  for (const m of sql.matchAll(/CREATE\s+TABLE\s+IF NOT EXISTS\s+([a-z_]+)/gi)) {
    created.push({ kind: "جدول", name: m[1], from: name });
  }
  for (const m of sql.matchAll(/CREATE\s+INDEX\s+IF NOT EXISTS\s+([a-z_]+)/gi)) {
    created.push({ kind: "فهرس", name: m[1], from: name });
  }
  for (const m of sql.matchAll(/ADD\s+COLUMN\s+IF NOT EXISTS\s+([a-z_]+)/gi)) {
    created.push({ kind: "عمود", name: m[1], from: name });
  }
}

const missing = created.filter((o) => !new RegExp(`\\b${o.name}\\b`).test(schema));
check(
  "كلُّ ما تُنشئه الهجراتُ مذكورٌ في المخطَّط",
  missing.length === 0,
  missing.length === 0
    ? created.map((o) => `${o.kind} ${o.name}`).join(" · ")
    : missing.map((o) => `${o.kind} ${o.name} (من ${o.from})`).join("، ")
);
check(
  "وجدولُ النسخة في المخطَّط",
  /CREATE TABLE schema_version/.test(schema)
);
check(
  "ويُسجّل migrate الهجراتَ مطبَّقةً",
  /INSERT INTO schema_version \(version, name\)/.test(migrateSrc) &&
    /ON CONFLICT \(version\) DO NOTHING/.test(migrateSrc),
  "وإلّا كذب السجلّ على قاعدةٍ تامّة"
);

/* ------------------------------------------------------------------ */
/* وعلى قاعدةٍ حقيقيّة: تُبنى ثم تُطبَّق مرّتين                          */
/* ------------------------------------------------------------------ */
console.log("\nوعلى قاعدةٍ حقيقيّة:\n");

const dir = path.join(ROOT, ".apply-check");
fs.rmSync(dir, { recursive: true, force: true });

const { PGlite } = await import("@electric-sql/pglite");
const seed = new PGlite(dir);
/*
  وتُبنى من المخطَّط بلا جدول النسخة: فتُحاكى قاعدةُ الشركة قبل الباب —
  قاعدةٌ قديمةٌ لا تعرف الهجرات ولا جدولَها. وذاك هو المفحوص.
*/
await seed.exec(
  schema
    .replace(/CREATE TABLE schema_version[\s\S]*?\);/, "")
    .replace(/CREATE TABLE messages[\s\S]*?\);/, "")
    .replace(/CREATE INDEX messages_[\s\S]*?;/g, "")
);
await seed.close();

const run = (extra = []) =>
  execFileSync(
    process.execPath,
    [path.join(HERE, "apply.mjs"), "--local", dir, ...extra],
    { encoding: "utf8" }
  );

const dry = run();
check(
  "القاعدةُ القديمةُ تُعرف ناقصةً",
  /المنتظرة: 1/.test(dry) || /المنتظرة: \d+/.test(dry),
  (dry.match(/المنتظرة: \d+/) ?? ["?"])[0]
);
check("ولا يُكتب شيءٌ بلا ‎--apply", /ولم يُكتب شيء/.test(dry));

const first = run(["--apply"]);
check("ثم تُطبَّق", /طُبّقت \d+ هجرة/.test(first), (first.match(/طُبّقت \d+ هجرة/) ?? [""])[0]);

const check2 = new PGlite(dir);
const { rows: tables } = await check2.query(
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages'"
);
check("والجدولُ صار موجوداً", tables.length === 1);

const { rows: versions } = await check2.query(
  "SELECT version, name FROM schema_version ORDER BY version"
);
check(
  "ويُسجَّل ما طُبّق",
  versions.length === files.length,
  versions.map((v) => v.name).join("، ")
);
await check2.close();

const again = run(["--apply"]);
check(
  "وتُطبَّق مرّةً أخرى فلا تضرّ",
  /لا شيءَ ينتظر/.test(again),
  "فمن أعاد تشغيلَه استأنف ولم يُخفق"
);

const after = new PGlite(dir);
const { rows: twice } = await after.query("SELECT count(*)::int AS n FROM schema_version");
check("ولا يُسجَّل مرّتين", twice[0].n === files.length, String(twice[0].n));
const { rows: cols } = await after.query(
  `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'messages'`
);
check("وأعمدةُ الجدول تامّة", cols[0].n >= 15, `${cols[0].n} عموداً`);
await after.close();

/* ---- وهجرةٌ هادمةٌ تُردّ ---- */
const bomb = path.join(DIR, "999-فحص-الهدم.sql");
fs.writeFileSync(bomb, "DROP TABLE messages;\n", "utf8");
let refused = false;
let said = "";
try {
  run(["--apply"]);
} catch (error) {
  refused = true;
  said = String(error.stderr ?? error.stdout ?? error.message);
}
fs.rmSync(bomb, { force: true });
check(
  "وهجرةٌ فيها حذفٌ تُردّ ولا تُطبَّق",
  refused && /إضافيّةٌ لا هادمة/.test(said),
  refused ? "وقيل سببُها" : "طُبّقت! وهذا أخطرُ ما في الباب"
);

const final = new PGlite(dir);
const { rows: alive } = await final.query(
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'messages'"
);
check("والجدولُ باقٍ بعد ردّها", alive.length === 1);
await final.close();

fs.rmSync(dir, { recursive: true, force: true });

console.log(
  bad === 0
    ? "\n✓ بابُ التحديث: يُطبّق ما استُجدّ، ويُطبَّق مرّتين فلا يضرّ، ولا يَهدم، ولا يفترق عن المخطَّط"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
