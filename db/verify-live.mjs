/**
 * يقارن قاعدة الشركة بالنسخة التي نُقلت منها.
 *
 *   node db/verify-live.mjs <نسخة.json>
 *
 * النقل يقول «مطابق» بعدّ الصفوف ومجموع المبالغ. وهذا يمضي أبعد:
 * يقرأ الحالة من القاعدة كما يقرؤها النظام، ويقابلها بالملف حقلاً
 * حقلاً وصفّاً صفّاً. فما عاد ناقصاً أو زائداً أو مختلفاً ظهر هنا.
 *
 * قراءةٌ محضة — لا يكتب في القاعدة حرفاً.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createJiti } from "jiti";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/verify-live.mjs <نسخة.json>");
  process.exit(1);
}

function urlFromEnvFile() {
  try {
    const raw = fs
      .readFileSync(path.join(ROOT, ".env.local"), "utf8")
      .replace(/^﻿/, "");
    const line = raw.split(/\r?\n/).find((l) => l.trim().startsWith("DATABASE_URL="));
    return line
      ? line.trim().slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "")
      : "";
  } catch {
    return "";
  }
}

const DB_URL = urlFromEnvFile();
if (!DB_URL) {
  console.error("لا يوجد DATABASE_URL في .env.local");
  process.exit(1);
}

const { parseBackup } = await jiti.import("../lib/storage.ts");
const { readState } = await jiti.import("../lib/server/state.ts");
const { compareStates } = await jiti.import("../lib/changes.ts");

const { default: pg } = await import("pg");
const client = new pg.Client({
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const host = (DB_URL.match(/@([^/:]+)/) ?? [])[1] ?? "?";
console.log(`\nالقاعدة على ${host}\n`);

const server = await readState({ query: (t, v) => client.query(t, v) });
const local = parseBackup(fs.readFileSync(BACKUP, "utf8"));
const report = compareStates(local, server);

const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - String(s).length));
console.log("  " + pad("الحقل", 20) + pad("الملف", 10) + pad("القاعدة", 11) + "الحال");
console.log("  " + "-".repeat(49));

for (const f of report.fields) {
  const detail = f.agree
    ? ""
    : `  ناقص ${f.missing.length} · زائد ${f.extra.length} · مختلف ${f.different.length}`;
  console.log(
    "  " +
      pad(f.field, 20) +
      pad(f.local, 10) +
      pad(f.server, 11) +
      (f.agree ? "✓" : "✗") +
      detail
  );
  if (!f.agree && f.different.length) {
    console.log("      أول مختلف: " + f.different[0]);
  }
}

await client.end();

console.log(
  report.agree
    ? "\n✓ القاعدة تعيد دفاترك كما هي — في كل حقل وكل صفّ"
    : "\n✗ بين القاعدة والملف فرق — لا يُبنى على هذا"
);
process.exit(report.agree ? 0 : 1);
