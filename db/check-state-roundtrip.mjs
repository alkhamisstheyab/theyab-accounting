/**
 * يثبت أن حالة النظام تعود من القاعدة كما دخلت.
 *
 *   node db/check-state-roundtrip.mjs <نسخة.json>
 *
 * الطريق: نسخة احتياطية ← قراءتها بمحلّل التطبيق نفسه ← نقلها إلى
 * PostgreSQL ← قراءتها من القاعدة ← مقارنة حقلاً حقلاً.
 *
 * ولماذا لا يُكتفى بعدّ الصفوف: العدّ يمرّ وإن سقط حقل من كل صفّ.
 * ومجموع المبالغ يمرّ وإن انقلب نوع الطرف من «مورّد» إلى «مقاول».
 * فالمقارنة هنا على كل مسار في الكائن، لا على مجاميع.
 *
 * والمعرّفات تُقارَن بعد تحويلها كما يحوّلها النقل (uuidFor)، فالقاعدة
 * تشترط uuid وما ليس كذلك يُشتقّ منه اشتقاقاً ثابتاً — وذلك تحويل
 * مقصود لا ضياع.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createJiti } from "jiti";
import { uuidFor, isUuid } from "./ids.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-state-roundtrip.mjs <نسخة.json>");
  process.exit(1);
}

const { parseBackup } = await jiti.import("../lib/storage.ts");
const { readState } = await jiti.import("../lib/server/state.ts");

/* ---- النقل إلى قاعدة محلية، بنفس السكربت الذي ينقل إلى السحابة ---- */
const { execFileSync } = await import("child_process");
const dir = path.join(HERE, "..", ".roundtrip");
fs.rmSync(dir, { recursive: true, force: true });

console.log("ينقل النسخة إلى قاعدة محلية…");
execFileSync(
  process.execPath,
  [path.join(HERE, "migrate.mjs"), BACKUP, "--local", "--keep", dir],
  { stdio: ["ignore", "ignore", "inherit"] }
);

const { PGlite } = await import("@electric-sql/pglite");
const db = new PGlite(dir);
const before = parseBackup(fs.readFileSync(BACKUP, "utf8"));
const after = await readState(db);
await db.close();

/* ---- المقارنة ---- */

const differences = [];
const MAX = 40;

/*
  الترتيب شأن استعلام لا شأن بيانات: أرقام القيود تتكرّر بين
  السنتين، فترتيب القاعدة يخالف ترتيب المصدر بلا فرق في محتوى.
  فتُطابَق الصفوف بمعرّفاتها لا بمواضعها.
*/
function keyOf(o) {
  if (!o || typeof o !== 'object') return null;
  if (o.id != null) return uuidFor(o.id);
  if (o.code != null) return String(o.code);
  if (o.label != null) return String(o.label);
  return null;
}

function compare(pathText, a, b) {
  if (differences.length >= MAX) return;
  if (a === b) return;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) {
      differences.push(`${pathText}: أحدهما ليس قائمة`);
      return;
    }
    if (a.length !== b.length) {
      differences.push(`${pathText}: ${a.length} ← ${b.length} عنصراً`);
      return;
    }
    const ka = a.map(keyOf);
    if (ka.every((k) => k != null)) {
      const byKey = new Map(b.map((o) => [keyOf(o), o]));
      a.forEach((item, i) => {
        const mate = byKey.get(ka[i]);
        if (!mate) {
          differences.push(`${pathText}[${i}]: لا مقابل له بالمعرّف ${ka[i]}`);
          return;
        }
        compare(`${pathText}[${ka[i]}]`, item, mate);
      });
      return;
    }
    /* قوائم نصوص كالأشخاص: مجموعة لا ترتيب */
    if (a.every((x) => typeof x === 'string')) {
      const sa = [...a].sort();
      const sb = [...b].sort();
      sa.forEach((x, i) => compare(`${pathText}{${x}}`, x, sb[i]));
      return;
    }
    for (let i = 0; i < a.length; i++) compare(`${pathText}[${i}]`, a[i], b[i]);
    return;
  }

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      const av = a[k];
      const bv = b[k];
      /* غياب الحقل ووجودُه فارغاً سواء: المحلّل يحذف الفارغ */
      if (av === undefined && (bv === undefined || bv === '' || bv === 0)) continue;
      if (bv === undefined && (av === undefined || av === '' || av === 0)) continue;
      compare(`${pathText}.${k}`, av, bv);
    }
    return;
  }

  if (typeof a === 'number' && typeof b === 'number') {
    if (Math.abs(a - b) < 0.0005) return;
  }

  /* المعرّف غير الـ uuid يتحوّل عمداً إلى uuid مشتقّ منه */
  if (/\.id$/.test(pathText) && typeof a === 'string' && !isUuid(a)) {
    if (uuidFor(a) === b) return;
  }

  differences.push(`${pathText}: ${JSON.stringify(a)} ← ${JSON.stringify(b)}`);
}

const FIELDS = Object.keys(before);
console.log(`\nالحقل`.padEnd(22) + "قبل".padStart(8) + "بعد".padStart(10) + "   الحال");
console.log("".padEnd(58, "-"));

let bad = 0;
for (const field of FIELDS) {
  const a = before[field];
  const b = after[field];
  const size = (v) =>
    Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 1;

  const mark = differences.length;
  compare(field, a, b);
  const ok = differences.length === mark;
  if (!ok) bad++;
  console.log(
    field.padEnd(22) +
      String(size(a)).padStart(8) +
      String(size(b)).padStart(10) +
      "   " +
      (ok ? "✓" : "✗")
  );
}

if (differences.length > 0) {
  console.log(`\nأول ${Math.min(differences.length, MAX)} فرقاً:`);
  for (const d of differences.slice(0, MAX)) console.log("  " + d);
}

fs.rmSync(dir, { recursive: true, force: true });

console.log(
  bad === 0
    ? "\n✓ الحالة تعود من القاعدة كما دخلت"
    : `\n✗ ${bad} حقلاً يختلف`
);
process.exit(bad === 0 ? 0 : 1);
