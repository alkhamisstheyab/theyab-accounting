/**
 * ينظر في قاعدة الشركة ولا يمسّها.
 *
 *   node db/inspect.mjs
 *
 * قراءةٌ محضة: يقول ما الجداول الموجودة، وكم فيها من صفوف، وأيّ
 * الأعمدة الجديدة وصلتها. فيُعرف قبل أي نقلٍ أهي فارغة أم فيها نسخة
 * قديمة أم هي على المخطّط الحالي.
 *
 * ولا يُطبع الرابط ولا كلمة مروره في أي حال.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

function urlFromEnvFile() {
  try {
    const raw = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").replace(/^﻿/, "");
    const line = raw.split(/\r?\n/).find((l) => l.trim().startsWith("DATABASE_URL="));
    return line
      ? line.trim().slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "")
      : "";
  } catch {
    return "";
  }
}

const DB_URL = process.argv[2] || urlFromEnvFile();
if (!DB_URL) {
  console.error("لا يوجد رابط قاعدة — أضف DATABASE_URL في .env.local");
  process.exit(1);
}

const host = (DB_URL.match(/@([^/:]+)/) ?? [])[1] ?? "?";
console.log(`القاعدة على ${host}\n`);

const { default: pg } = await import("pg");
const client = new pg.Client({
  connectionString: DB_URL,
  ssl: /\blocalhost\b|\b127\.0\.0\.1\b/.test(DB_URL) ? undefined : { rejectUnauthorized: false },
});
await client.connect();

try {
  const { rows: tables } = await client.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );

  if (tables.length === 0) {
    console.log("القاعدة فارغة — لا جداول فيها.");
    console.log("فالنقل إليها يبدأ من الصفر بلا حذف شيء.");
  } else {
    console.log(`فيها ${tables.length} جدولاً:\n`);
    const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - String(s).length));
    console.log("  " + pad("الجدول", 22) + pad("الصفوف", 10) + "أعمدة التتبّع");
    console.log("  " + "-".repeat(56));

    for (const { tablename } of tables) {
      const { rows: n } = await client.query(
        `SELECT count(*)::int AS n FROM "${tablename}"`
      );
      const { rows: cols } = await client.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1`,
        [tablename]
      );
      const names = cols.map((c) => c.column_name);
      const marks = [
        names.includes("data") ? "data" : "",
        names.includes("rev") ? "rev" : "",
      ]
        .filter(Boolean)
        .join(" · ");
      console.log("  " + pad(tablename, 22) + pad(n[0].n, 10) + (marks || "—"));
    }

    /* هل المخطّط هو الحالي؟ */
    const { rows: seq } = await client.query(
      `SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'change_seq'`
    );
    const { rows: del } = await client.query(
      `SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='deletions'`
    );
    const current = seq.length > 0 && del.length > 0;

    console.log("");
    console.log(
      current
        ? "المخطّط حديث: فيه تسلسل التغيير وجدول الشواهد ✓"
        : "المخطّط قديم: لا تسلسل تغيير ولا جدول شواهد — يسبق الكتابة صفّاً صفّاً."
    );
    if (!current) {
      console.log(
        "فالنقل إليها يحتاج إفراغها أولاً، إذ ينشئ المخطّط جداوله ولا يعدّل قائماً."
      );
    }
  }
} finally {
  await client.end();
}
