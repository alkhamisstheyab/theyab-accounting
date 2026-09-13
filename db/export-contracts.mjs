/**
 * يُخرج عقود المشروع ملفَ استيرادٍ يقرؤه النظام في المتصفح.
 *
 *   node db/export-contracts.mjs
 *
 * لماذا المتصفح لا القاعدة: المتصفح هو المصدر حتى التحويل النهائي،
 * وعندها تُملأ القاعدة من نسخة احتياطية جديدة. فما يُكتب في القاعدة
 * اليوم يُمحى غداً، وما يُكتب في المتصفح ينتقل معه.
 *
 * الملف بصيغة النسخة الاحتياطية نفسها، وفيه العقود وحدها — فالاستيراد
 * الانتقائي في «الإعدادات» لا يمسّ حركة ولا رصيداً.
 */

import fs from "fs";
import path from "path";
import { CONTRACTS } from "./contracts-awatef.data.mjs";

const PROJECT = "مشروع عواطف القرطاس";
const PLOT = { area: "الخيران السكنية", block: "2", plot: "439" };
const BUILDING = "أرضي + أول + نصف ثاني + بيت درج";

const id = () =>
  "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );

const contractors = CONTRACTS.map((c) => ({
  id: id(),
  name: c.name,
  specialty: c.workType,
  phone: c.phone ?? "",
  project: PROJECT,
  contractNumber: c.number,
  contractType: "جاري التنفيذ",
  workType: c.workType,
  contractValue: c.value,
  installmentsCount: c.installments.length,
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
  })),
  counterpartyType: c.counterparty,
  documentType: "عقد",
  parentContractNumber: "",
  contractDate: c.date,
  civilId: c.civilId ?? "",
  passportNumber: "",
  nationality: "",
  address: "",
  plot: PLOT.plot,
  block: PLOT.block,
  area: PLOT.area,
  licenseNumber: "",
  buildingDescription: BUILDING,
  durationDays: c.durationDays ?? 0,
  delayPenaltyPerDay: c.delayPenaltyPerDay ?? 0,
  maxPenaltyPercent: c.maxPenaltyPercent ?? 0,
  terminationAfterDays: 0,
  warrantyYears: c.warrantyYears ?? 0,
  preamble: "",
  clauses: [],
  obligations: [],
  notes: c.notes ?? "",
}));

const payload = {
  app: "theyab-accounting",
  schemaVersion: 12,
  exportedAt: new Date().toISOString(),
  note: "عقود مشروع عواطف القرطاس — منقولة من العقود المبرمة الموقّعة",
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
  "عقود-عواطف-للاستيراد.json"
);
fs.writeFileSync(out, JSON.stringify(payload, null, 1), "utf8");

console.log("كُتب ملف الاستيراد:");
console.log("  " + out);
console.log(`\n${contractors.length} عقداً:`);
for (const c of contractors) {
  console.log(
    `  ${c.contractNumber}  ${c.counterpartyType.padEnd(6)} ${c.name.slice(0, 30).padEnd(32)} ${String(c.contractValue).padStart(7)} د.ك`
  );
}
