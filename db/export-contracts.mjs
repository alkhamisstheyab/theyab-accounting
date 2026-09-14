/**
 * يُخرج عقود المشاريع ملفَ استيرادٍ يقرؤه النظام في المتصفح.
 *
 *   node db/export-contracts.mjs
 *
 * لماذا المتصفح لا القاعدة: المتصفح هو المصدر حتى التحويل النهائي،
 * وعندها تُملأ القاعدة من نسخة احتياطية جديدة. فما يُكتب في القاعدة
 * اليوم يُمحى غداً، وما يُكتب في المتصفح ينتقل معه.
 *
 * الملف بصيغة النسخة الاحتياطية نفسها، وفيه العقود وحدها — فالاستيراد
 * الانتقائي في «الإعدادات» لا يمسّ حركة ولا رصيداً. ومع خيار «تحديث
 * نصّ العقود الموجودة» يصحّح نقلَ عقدٍ سبق استيراده دون حذفه.
 *
 * كل مشروع ملفٌ في db/contracts — يُضاف الملف فيدخل مشروعه تلقائياً.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createHash } from "crypto";

const here = path.dirname(fileURLToPath(import.meta.url));
const folder = path.join(here, "contracts");

/**
 * معرّف ثابت مشتقّ من رقم العقد.
 *
 * المعرّف العشوائي يجعل كل تصدير عقداً جديداً في نظر المتصفح، فلا
 * يُحدَّث عقدٌ صُحّح نصّه بل يُرفض كمكرّر أو يُضاف مرتين. والثابت
 * يجعل إعادة التصدير تصحيحاً لا تكراراً.
 */
const id = (key) => {
  const h = createHash("sha1").update("theyab-contract:" + key).digest("hex");
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    "4" + h.slice(13, 16),
    "8" + h.slice(17, 20),
    h.slice(20, 32),
  ].join("-");
};

const files = fs
  .readdirSync(folder)
  .filter((f) => f.endsWith(".mjs") && f !== "helpers.mjs")
  .sort();

const contractors = [];
const projects = [];

for (const file of files) {
  const mod = await import(pathToFileURL(path.join(folder, file)).href);
  const { PROJECT, CONTRACTS } = mod;
  if (!PROJECT || !CONTRACTS) throw new Error(`${file}: ينقصه PROJECT أو CONTRACTS`);
  projects.push({ file, ...PROJECT, count: CONTRACTS.length });

  for (const c of CONTRACTS) {
    contractors.push({
      id: id(c.number),
      name: c.name,
      specialty: c.workType,
      phone: c.phone ?? "",
      project: PROJECT.name,
      contractNumber: c.number,
      contractType: "جاري التنفيذ",
      workType: c.workType,
      contractValue: c.value,
      installmentsCount: c.installments.filter((i) => !i.informational).length,
      installments: c.installments.map((i, index) => ({
        number: index + 1,
        value: i.value,
        condition: i.condition,
        status: "غير مستحقة",
        approved: false,
        approvedBy: "",
        approvedAt: "",
        approvalNote: "",
        confirmed: false,
        confirmedBy: "",
        confirmedAt: "",
        confirmNote: "",
        // تمثيل جدول العقد كما هو — الحقول الغائبة تُترك غائبة
        ...(i.no ? { no: i.no } : {}),
        ...(i.stage ? { stage: i.stage } : {}),
        ...(i.materials ? { materials: i.materials } : {}),
        ...(i.rows && i.rows.length ? { rows: i.rows } : {}),
        ...(i.informational ? { informational: true } : {}),
        ...(i.banner ? { banner: i.banner } : {}),
      })),
      counterpartyType: c.counterparty,
      documentType: c.documentType ?? "عقد",
      parentContractNumber: c.parentContractNumber ?? "",
      contractDate: c.date,
      civilId: c.civilId ?? "",
      passportNumber: c.passportNumber ?? "",
      nationality: c.nationality ?? "",
      address: "",
      plot: PROJECT.plot,
      block: PROJECT.block,
      area: PROJECT.area,
      licenseNumber: "",
      // وصف المبنى كما في كل عقد — العقد الأساسي وعقود المقاولين قد
      // تختلف فيه (بيت الدرج مثلاً). لا يُوحَّد بينها.
      buildingDescription: c.building ?? PROJECT.building ?? "",
      durationDays: c.durationDays ?? 0,
      delayPenaltyPerDay: c.delayPenaltyPerDay ?? 0,
      maxPenaltyPercent: c.maxPenaltyPercent ?? 0,
      terminationAfterDays: c.terminationAfterDays ?? 0,
      warrantyYears: c.warrantyYears ?? 0,
      preamble: c.preamble ?? "",
      clauses: [],
      obligations: c.obligations ?? [],
      notes: c.notes ?? "",
    });
  }
}

const duplicates = contractors
  .map((c) => c.contractNumber)
  .filter((n, i, all) => all.indexOf(n) !== i);
if (duplicates.length > 0) {
  throw new Error("أرقام عقود مكرّرة: " + [...new Set(duplicates)].join("، "));
}

const payload = {
  app: "theyab-accounting",
  schemaVersion: 12,
  exportedAt: new Date().toISOString(),
  note: "عقود المشاريع — منقولة من العقود المبرمة الموقّعة",
  data: {
    movements: [],
    projects: [],
    contractors,
    openingBalances: {},
    materials: [],
    materialReceipts: [],
  },
};

const out = path.join(
  process.env.USERPROFILE || ".",
  "Desktop",
  "عقود-المشاريع-للاستيراد.json"
);
fs.writeFileSync(out, JSON.stringify(payload, null, 1), "utf8");

console.log("كُتب ملف الاستيراد:");
console.log("  " + out);
console.log(`\n${projects.length} مشاريع · ${contractors.length} عقداً:\n`);
for (const p of projects) {
  console.log(`  ${p.name} — ${p.count} عقداً  (${p.area} ق${p.block} قسيمة ${p.plot})`);
}
console.log("");
for (const c of contractors) {
  console.log(
    `  ${c.contractNumber}  ${c.counterpartyType.padEnd(6)} ` +
      `${c.name.slice(0, 30).padEnd(32)} ${String(c.contractValue).padStart(7)} د.ك`
  );
}
