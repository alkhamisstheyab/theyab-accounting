/**
 * يفحص الحركات المربوطة بعقدٍ محذوف.
 *
 *   node db/check-orphan-links.mjs <نسخة.json>
 *
 * وقع في ٢٢ سبتمبر ٢٠٢٦: رُبط قبضٌ بسبعمئة بالعقد 4003، ثم تبيّن أن
 * العقد أُلغي فحُذف. وكانت رسالة الحذف تقول «يفكّ ربطها» ولم يكن يفكّه:
 * بقي الرقم في الحركة ولا عقدَ له، فسقطت من كل كشف — لا هي في عقدٍ ولا
 * بين غير المرتبطة. ولو أُنشئ عقدٌ بالرقم نفسه لالتصقت به صامتةً.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-orphan-links.mjs <نسخة.json>");
  process.exit(1);
}

const { parseBackup } = await jiti.import("../lib/storage.ts");
const { orphanContractLinks, unlinkedClientReceipts, contractPayments } =
  await jiti.import("../lib/accounting.ts");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { movements, contractors } = parseBackup(fs.readFileSync(BACKUP, "utf8"));
const numbers = (list) => list.map((c) => c.contractNumber);

/* الحال كما وقعت: قبضٌ مربوطٌ بعقد عميل، ثم يُحذف العقد */
const contract = contractors.find(
  (c) =>
    c.counterpartyType === "عميل" &&
    unlinkedClientReceipts(movements, c.project).length > 0
);
const receipt = unlinkedClientReceipts(movements, contract.project)[0];
const linked = movements.map((m) =>
  m.id === receipt.id
    ? { ...m, contractNumber: contract.contractNumber, installmentNumber: 1 }
    : m
);
const remaining = contractors.filter((c) => c.id !== contract.id);

console.log("\nقبل الإصلاح — الحذف وحده:\n");

check("النسخة كما هي بلا يتيم", orphanContractLinks(movements, numbers(contractors)).length === 0);

const orphans = orphanContractLinks(linked, numbers(remaining));
check(
  "حذف العقد وحده يترك الحركة يتيمة — وهذا ما يُمسَك",
  orphans.length === 1 && orphans[0].id === receipt.id,
  `${orphans[0]?.fiscalYear}/${orphans[0]?.entryNo} → ${orphans[0]?.contractNumber}`
);
check(
  "واليتيمة لا تظهر بين غير المرتبطة — فتضيع",
  !unlinkedClientReceipts(linked, contract.project).some((m) => m.id === receipt.id)
);

/* العقد الجديد بالرقم نفسه يلتقطها صامتاً */
const reborn = contractPayments(linked, contract.contractNumber);
check(
  "ولو أُنشئ عقدٌ بالرقم نفسه لحسبها مدفوعةً عليه",
  reborn.total === receipt.amount,
  `${reborn.total}`
);

console.log("\nبعد الإصلاح — الحذف يفكّ الربط:\n");

/* كما يفعل onUnlinkContract في الصفحة */
const unlink = (list, number) =>
  list.map((m) =>
    m.contractNumber === number
      ? { ...m, contractNumber: undefined, installmentNumber: undefined, installmentSplits: undefined }
      : m
  );
const repaired = unlink(linked, contract.contractNumber);

check("لا يتيم بعد الفكّ", orphanContractLinks(repaired, numbers(remaining)).length === 0);
check(
  "والحركة عادت بين غير المرتبطة لتُربط بعقدها الصحيح",
  unlinkedClientReceipts(repaired, contract.project).some((m) => m.id === receipt.id)
);
check(
  "ولم يُمسّ منها غير الربط — المبلغ والحسابات كما هي",
  (() => {
    const a = linked.find((m) => m.id === receipt.id);
    const b = repaired.find((m) => m.id === receipt.id);
    return a.amount === b.amount && a.debitCode === b.debitCode && a.creditCode === b.creditCode;
  })()
);
check("وعدد الحركات كما هو — الفكّ لا يحذف", repaired.length === movements.length);

console.log("\nوالشاشة:\n");

const page = fs.readFileSync("app/page.tsx", "utf8");
check("حذف العقد يستدعي فكّ الربط", page.includes("if (!shared) onUnlinkContract(c.contractNumber);"));
check("ولا يفكّه إن بقي عقدٌ آخر بالرقم نفسه", page.includes("const shared = contractors.some("));
check("ولافتةٌ تُظهر اليتيم القائم وتُصلحه بضغطة", page.includes("فكّ ربطها لتُربط بعقدها الصحيح"));

console.log(
  bad === 0
    ? "\n✓ حذف العقد يفكّ ربط حركاته، واليتيم القائم يُكشف ويُصلح"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
