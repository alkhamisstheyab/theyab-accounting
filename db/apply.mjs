/**
 * بابُ التحديث: يُطبّق ما استُجدّ من الهجرات على قاعدةٍ عاملة.
 *
 *   node db/apply.mjs            — يُخبر ولا يكتب
 *   node db/apply.mjs --apply    — يُطبّق
 *   node db/apply.mjs --local <مجلّد> [--apply]   — على قاعدةٍ محلّية للفحص
 *
 * ولمَ وُجد: كان الطريقُ الوحيدُ لتغيير بنية القاعدة `DROP SCHEMA` ثم
 * إعادةَ البناء من نسخة (migrate.mjs --fresh). وذاك يصلح لقاعدةٍ
 * تُبنى أوّلَ مرّة، ولا يصلح لقاعدةٍ فيها عملُ سنة: فمن كان عنده عملٌ
 * لم يُرفَع ضاع، وما لم تحمله النسخةُ من حقلٍ ضاع معه.
 *
 * فصارت التغييراتُ الإضافيّة — جدولٌ جديدٌ أو عمودٌ أو فهرس — تُكتب
 * ملفّاً مرقّماً في `db/migrations`، ويُطبَّق ما لم يُطبَّق منها، كلُّ
 * ملفٍّ في معاملةٍ وحده، ويُسجَّل في `schema_version`.
 *
 * وشرطان على كلّ هجرة:
 *
 *   • **أن تكون إضافيّةً لا هادمة**: `CREATE TABLE IF NOT EXISTS`،
 *     `ADD COLUMN IF NOT EXISTS`. ولا `DROP` ولا `TRUNCATE` — فهجرةٌ
 *     تحذف تُطبَّق مرّةً وتَمحو ما لا يَرجع، ولا يُستدرك بإعادة تشغيل.
 *
 *   • **أن تُضاف إلى `schema.sql` أيضاً**: فمن أضافها في الهجرة وحدها
 *     اختلفت قاعدةُ من بدأ اليومَ عن قاعدة من بدأ أمس — وتلك علّةٌ
 *     تظهر بعد شهورٍ في مكانٍ لا يُربط بها. ويفحصها `check:apply`.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.join(HERE, "migrations");

const APPLY = process.argv.includes("--apply");
const LOCAL = process.argv.includes("--local");

/* ------------------------------------------------------------------ */
/* ما لا يُسمح به في هجرة                                              */
/* ------------------------------------------------------------------ */
/*
  ويُفحص قبل الاتصال: فلو فُحص بعده لكان الخطأُ قد وقع. والنصُّ يُجرَّد
  من التعليقات أوّلاً — فـ«لا DROP» مكتوبةٌ في تعليقِ هذا الملفّ نفسه.
*/
const FORBIDDEN = [
  [/\bDROP\s+(TABLE|SCHEMA|COLUMN|DATABASE)\b/i, "حذفُ جدولٍ أو عمودٍ أو مخطّط"],
  [/\bTRUNCATE\b/i, "تفريغُ جدول"],
  [/\bDELETE\s+FROM\b/i, "حذفُ صفوف"],
];

const stripComments = (sql) =>
  sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");

function readMigrations() {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => {
      const version = Number(name.slice(0, 3));
      if (!Number.isInteger(version) || version <= 0) {
        throw new Error(`اسمُ الهجرة يبدأ برقمٍ من ثلاث خانات: ${name}`);
      }
      const sql = fs.readFileSync(path.join(DIR, name), "utf8");
      const bare = stripComments(sql);
      for (const [pattern, why] of FORBIDDEN) {
        if (pattern.test(bare)) {
          throw new Error(
            `الهجرة ${name} فيها ${why} — والهجراتُ إضافيّةٌ لا هادمة.`
          );
        }
      }
      return { name, version, sql };
    });
}

/* ------------------------------------------------------------------ */
async function connect() {
  if (LOCAL) {
    const dir = process.argv[process.argv.indexOf("--local") + 1];
    if (!dir || dir.startsWith("--")) {
      throw new Error("الاستعمال: --local <مجلّد القاعدة>");
    }
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite(dir);
    return {
      kind: "pglite",
      query: (sql, params) => db.query(sql, params),
      exec: (sql) => db.exec(sql),
      close: () => db.close(),
    };
  }

  const line = fs
    .readFileSync(path.join(HERE, "..", ".env.local"), "utf8")
    .replace(/^﻿/, "")
    .split("\n")
    .find((l) => l.trim().startsWith("DATABASE_URL="));
  if (!line) throw new Error("لا DATABASE_URL في .env.local");
  const url = line.trim().slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "");

  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return {
    kind: "postgres",
    query: (sql, params) => client.query(sql, params),
    exec: (sql) => client.query(sql),
    close: () => client.end(),
  };
}

/* ------------------------------------------------------------------ */
const migrations = readMigrations();
console.log(`الهجرات المكتوبة: ${migrations.length}`);
if (migrations.length === 0) process.exit(0);

const db = await connect();
try {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    integer PRIMARY KEY,
      name       text NOT NULL DEFAULT '',
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const { rows } = await db.query("SELECT version FROM schema_version");
  const done = new Set(rows.map((r) => Number(r.version)));
  const pending = migrations.filter((m) => !done.has(m.version));

  console.log(`المطبَّقة: ${done.size} · المنتظرة: ${pending.length}`);
  for (const m of pending) console.log(`  — ${m.name}`);

  if (pending.length === 0) {
    console.log("\n✓ القاعدة محدَّثة — لا شيءَ ينتظر");
  } else if (!APPLY) {
    console.log("\nولم يُكتب شيء. أضف --apply ليقع.");
  } else {
    for (const m of pending) {
      /*
        كلُّ هجرةٍ في معاملةٍ وحدها: فلو أخفقت الثانيةُ بقيت الأولى
        مطبَّقةً ومسجَّلة، ويُعاد التشغيلُ فيُستأنف من موضعه — ولا
        تُترك القاعدةُ بين حالين.
      */
      process.stdout.write(`يطبّق ${m.name}… `);
      if (db.kind === "pglite") {
        await db.exec("BEGIN");
        await db.exec(m.sql);
        await db.query(
          "INSERT INTO schema_version (version, name) VALUES ($1, $2)",
          [m.version, m.name]
        );
        await db.exec("COMMIT");
      } else {
        await db.query("BEGIN");
        try {
          await db.exec(m.sql);
          await db.query(
            "INSERT INTO schema_version (version, name) VALUES ($1, $2)",
            [m.version, m.name]
          );
          await db.query("COMMIT");
        } catch (error) {
          await db.query("ROLLBACK");
          throw error;
        }
      }
      console.log("✓");
    }
    console.log(`\n✓ طُبّقت ${pending.length} هجرة`);
  }
} finally {
  await db.close();
}
