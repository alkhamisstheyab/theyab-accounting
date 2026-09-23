/**
 * يفحص ترقيم القيود.
 *
 *   node db/check-entry-number.mjs <نسخة.json>
 *
 * وقع في ٢٣ سبتمبر ٢٠٢٦: أُدخلت حركةٌ بتاريخ ٢١ سبتمبر ٢٠٢٦ والشاشة
 * تعرض السنة المالية ٢٠٢٥. فأخذت رقمها من أعلى رقمٍ في ٢٠٢٥ (١٨٠٧+١)
 * وحُفظت في ٢٠٢٦ — حيث الرقم ١٨٠٨ مأخوذ سلفاً. فصار في سنةٍ واحدة
 * قيدان برقمٍ واحد، ورفض الخادمُ النسخةَ كلَّها: القيد مفتاحٌ فريد.
 *
 * والقاعدة: رقم القيد من سنة **تاريخ الحركة**، لا من السنة المعروضة.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-entry-number.mjs <نسخة.json>");
  process.exit(1);
}

const { parseBackup } = await jiti.import("../lib/storage.ts");
const { fiscalYearOf } = await jiti.import("../lib/accounting.ts");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { movements } = parseBackup(fs.readFileSync(BACKUP, "utf8"));

/* الرقم كما يحسبه النموذج: من سنة التاريخ */
const nextFor = (list, year) =>
  list.filter((m) => m.fiscalYear === year).reduce((max, m) => Math.max(max, m.entryNo), 1000) + 1;

console.log("\nالقاعدة: الرقم من سنة تاريخ الحركة\n");

const years = [...new Set(movements.map((m) => m.fiscalYear))].sort();
for (const y of years) {
  const top = Math.max(...movements.filter((m) => m.fiscalYear === y).map((m) => m.entryNo));
  console.log(`  · سنة ${y}: أعلى رقم ${top} · التالي ${nextFor(movements, y)}`);
}

/* المحاكاة: حركةٌ بتاريخ سنةٍ والشاشة تعرض أخرى */
const [older, newer] = years;
if (years.length >= 2) {
  const date = movements.find((m) => m.fiscalYear === newer)?.date ?? `${newer}-09-21`;
  const byDate = nextFor(movements, fiscalYearOf(date));
  const byScreen = nextFor(movements, older);
  check(
    "الرقم المحسوب من التاريخ غير المحسوب من السنة المعروضة",
    byDate !== byScreen,
    `${byDate} من التاريخ · ${byScreen} من الشاشة`
  );
  check(
    "والمحسوب من الشاشة يصطدم بقيدٍ قائم — وهو الخطأ الذي وقع",
    movements.some((m) => m.fiscalYear === fiscalYearOf(date) && m.entryNo === byScreen) ||
      byScreen > byDate,
    String(byScreen)
  );
  check(
    "والمحسوب من التاريخ لا يصطدم بشيء",
    !movements.some((m) => m.fiscalYear === fiscalYearOf(date) && m.entryNo === byDate),
    String(byDate)
  );
}

console.log("\nوالدفاتر: لا رقم مكرَّر في سنته\n");

const byKey = new Map();
for (const m of movements) {
  const key = `${m.fiscalYear}/${m.entryNo}`;
  byKey.set(key, [...(byKey.get(key) ?? []), m]);
}
const dups = [...byKey.entries()].filter(([, rows]) => rows.length > 1);
check(
  "لا قيدين برقمٍ واحد في سنةٍ واحدة — وإلا رفض الخادم النسخة",
  dups.length === 0,
  dups.map(([k, rows]) => `${k} ×${rows.length}`).join(" · ")
);
if (dups.length > 0) {
  for (const [k, rows] of dups)
    for (const m of rows)
      console.log(`      ${k} · ${m.date} · ${m.amount} · ${(m.description || "").slice(0, 40)}`);
  console.log("      ← أصلحها بزرّ «إعادة ترقيم» في الإعدادات");
}

/* الشيفرة */
const page = fs.readFileSync("app/page.tsx", "utf8");
check(
  "والنموذج يشتقّ الرقم من سنة التاريخ",
  /const entryNumber = useMemo\([\s\S]{0,200}m\.fiscalYear === entryYear/.test(page)
);
check("ويحفظ به", page.includes("entryNo: entryNumber,"));
check(
  "ولم يبقَ في النموذج رقمٌ من السنة المعروضة",
  !/nextEntryNo/.test(page.slice(page.indexOf("function MovementForm"), page.indexOf("function MovementForm") + 4000))
);
check(
  "وفي الإعدادات زرٌّ يُعيد ترقيم المكرَّر",
  page.includes("onFixDuplicates")
);

console.log(
  bad === 0
    ? "\n✓ رقم القيد من سنة تاريخه، ولا رقم مكرَّر في الدفاتر"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
