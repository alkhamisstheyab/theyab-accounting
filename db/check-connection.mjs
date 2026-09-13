/**
 * يتحقّق من أن DATABASE_URL في .env.local يصل إلى قاعدة حقيقية.
 *
 *   node db/check-connection.mjs
 *
 * لا يطبع كلمة السر أبداً، ولا يكتب في القاعدة شيئاً.
 */
import fs from "fs";
import pg from "pg";

const raw = fs.readFileSync(".env.local", "utf8");
const line = raw.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
if (!line) {
  console.error("✗ لا يوجد DATABASE_URL في .env.local");
  process.exit(1);
}
const url = line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");

let host = "";
try {
  host = new URL(url).hostname;
} catch {
  console.error("✗ الرابط غير صالح الشكل");
  process.exit(1);
}

console.log("المضيف:", host);

// النص التوضيحي من صفحات نيون يحمل نقاطاً بدل المعرّف الحقيقي
if (/\.{3}/.test(url) || /^ep-\.+/.test(host)) {
  console.error(
    "\n✗ هذا نصّ توضيحي من صفحة نيون لا رابطك الحقيقي.\n" +
      "  الرابط الحقيقي مضيفه مثل: ep-cool-forest-a1b2c3d4.eu-central-1.aws.neon.tech"
  );
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20_000,
});

try {
  await client.connect();
  const { rows } = await client.query(
    "select current_database() db, version() v, now() at time zone 'Asia/Kuwait' t"
  );
  console.log("\n✓ الاتصال ناجح");
  console.log("  القاعدة:", rows[0].db);
  console.log("  الإصدار:", String(rows[0].v).split(",")[0]);
  console.log("  التوقيت:", new Date(rows[0].t).toLocaleString("ar-KW"));

  const { rows: tables } = await client.query(
    "select count(*)::int n from information_schema.tables where table_schema='public'"
  );
  console.log("  الجداول الموجودة:", tables[0].n);
  await client.end();
} catch (e) {
  console.error("\n✗ فشل الاتصال:", e.message);
  if (/ENOTFOUND|EAI_AGAIN/.test(e.message)) {
    console.error("  المضيف غير موجود — الرابط ليس رابط مشروعك.");
  }
  if (/password|auth/i.test(e.message)) {
    console.error("  كلمة السر في الرابط غير صحيحة.");
  }
  process.exit(1);
}
