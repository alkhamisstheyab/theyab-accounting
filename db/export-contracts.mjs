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
import { createHash } from "crypto";
import path from "path";
import { CONTRACTS } from "./contracts-awatef.data.mjs";

const PROJECT = "مشروع عواطف القرطاس";
const PLOT = { area: "الخيران السكنية", block: "2", plot: "439" };
const BUILDING = "أرضي + أول + نصف ثاني + بيت درج";

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

const contractors = CONTRACTS.map((c) => ({
  id: id(c.number),
  name: c.name,
  specialty: c.workType,
  phone: c.phone ?? "",
  project: PROJECT,
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
  // وصف المبنى كما في كل عقد — العقد الأساسي بلا بيت درج، وعقود
  // المقاولين تذكره. لا يُوحَّد بينها.
  buildingDescription: c.building ?? "",
  durationDays: c.durationDays ?? 0,
  delayPenaltyPerDay: c.delayPenaltyPerDay ?? 0,
  maxPenaltyPercent: c.maxPenaltyPercent ?? 0,
  terminationAfterDays: c.terminationAfterDays ?? 0,
  warrantyYears: c.warrantyYears ?? 0,
  // التمهيد والالتزامات بنصّ العقد — وتركهما فارغين يحذفهما من المطبوعة
  preamble: c.preamble ?? "",
  clauses: [],
  obligations: c.obligations ?? [],
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
