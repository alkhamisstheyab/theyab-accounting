/**
 * يعرض مدد العقود وحال كل واحدة اليوم.
 *
 *   node db/check-durations.mjs [YYYY-MM-DD]
 *
 * سبب وجوده: الحساب تقريبيّ بحكم ما في العقود — أيام عمل لا تقويم،
 * وملاحق تمدّ، وظروف قاهرة تستثنى. فلا يُطمأنّ إليه حتى يُرى على
 * العقود الأربعين نفسها: أيّها انتهى، وبكم، وعلى مَن شرطه الجزائي.
 */
import fs from "fs";
import path from "path";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { allDurations, addendaOf } = await jiti.import("../lib/contract-dates.ts");

const today = process.argv[2] || new Date().toISOString().slice(0, 10);
const file = path.join(
  process.env.USERPROFILE,
  "Desktop",
  "عقود-المشاريع-للاستيراد.json"
);
const contractors = JSON.parse(fs.readFileSync(file, "utf8")).data.contractors;

const rows = allDurations(contractors, today);
console.log(`اليوم ${today} · ${contractors.length} مستنداً · ${rows.length} عقداً أصلياً\n`);

const head =
  "العقد".padEnd(6) +
  "الطرف".padEnd(32) +
  "الحال".padEnd(12) +
  "المدة".padStart(6) +
  "  الانتهاء".padEnd(14) +
  "تأخّر".padStart(6) +
  "  الشرط الجزائي";
console.log(head);
console.log("".padEnd(head.length + 6, "-"));

let onUs = 0;
let forUs = 0;
for (const r of rows) {
  const c = r.contract;
  const penalty =
    r.penalty > 0
      ? `${r.penalty} د.ك على ${r.penaltyAgainst}`
      : r.status === "انتهت"
        ? "لا شرط جزائي في العقد"
        : "";
  if (r.penalty > 0 && r.penaltyAgainst === "الشركة") onUs += r.penalty;
  if (r.penalty > 0 && r.penaltyAgainst === "الطرف الآخر") forUs += r.penalty;

  console.log(
    c.contractNumber.padEnd(6) +
      c.name.slice(0, 30).padEnd(32) +
      r.status.padEnd(12) +
      String(r.end.days || "—").padStart(6) +
      "  " +
      (r.end.date || "—").padEnd(12) +
      (r.lateDays ? String(r.lateDays) : "—").padStart(6) +
      "  " +
      penalty +
      (r.end.extraDays ? `  (+${r.end.extraDays} من الملاحق)` : "") +
      (r.end.source === "محرَّر" ? "  [تاريخ محرَّر]" : "")
  );
}

const counts = rows.reduce((acc, r) => {
  acc[r.status] = (acc[r.status] ?? 0) + 1;
  return acc;
}, {});
console.log(
  "\n" +
    Object.entries(counts)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ")
);
console.log(
  `تقدير الشرط الجزائي: ${Math.round(onUs * 1000) / 1000} د.ك على الشركة · ` +
    `${Math.round(forUs * 1000) / 1000} د.ك لها`
);

/* الملاحق لا تُعرض مستقلّةً — يُتحقَّق أن مددها دخلت أصولها */
const addenda = contractors.filter((c) => c.documentType === "ملحق عقد");
const carried = addenda.filter((a) => a.durationDays > 0);
console.log(
  `\nالملاحق: ${addenda.length} — منها ${carried.length} تحمل مدة تُضاف إلى أصلها.`
);
for (const a of addenda) {
  const parent = contractors.find(
    (c) => c.contractNumber === a.parentContractNumber
  );
  if (!parent) {
    console.log(`  ✗ الملحق ${a.contractNumber} بلا عقد أصلي`);
    continue;
  }
  if (!addendaOf(parent, contractors).some((x) => x.contractNumber === a.contractNumber)) {
    console.log(`  ✗ الملحق ${a.contractNumber} لا يُنسب إلى ${parent.contractNumber}`);
  }
}
