/**
 * يثبت أن حساب العقد على عمره كله، لا على السنة المعروضة.
 *
 *   node db/check-contract-lifetime.mjs <نسخة.json>
 *
 * صاحب الشركة وجدها في ٢٠ سبتمبر ٢٠٢٦: عقد العميل 5001 دفعته الأولى
 * ١٥٬٠٠٠ قُبضت في ٢٥ يونيو ٢٠٢٥ وباقيه في ٢٠٢٦. فإن عُرضت سنة ٢٠٢٥
 * ظهرت الأولى وحدها والباقي «غير مسدَّد»، وإن عُرضت ٢٠٢٦ ظهر الباقي
 * وسقطت الأولى من المجموع. والعقد لا سنةَ له — وإنما له عمرٌ.
 *
 * وهذا الفحص يحاكي الشاشتين: المصفّاة بالسنة كما كانت، والممتدّة على
 * العمر كما صارت. فيسقط إن عادت التصفية.
 *
 * ويفحص معه أن التوسعة لم تفتح باباً مُقفلاً: دفعات مقاولي ٢٠٢٥
 * المُقفلة كانت محجوبة بحكم أن الشاشة على ٢٠٢٦، فلمّا امتدّ النطاق
 * إلى السنوات كلها وجب أن يحجبها القفل نفسه لا اختيارُ السنة.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-contract-lifetime.mjs <نسخة.json>");
  process.exit(1);
}

const { parseBackup } = await jiti.import("../lib/storage.ts");
const {
  contractPayments,
  unlinkedContractorMovements,
  unlinkedSupplierMovements,
  approvedOnly,
} = await jiti.import("../lib/accounting.ts");
const { isClosedContractorPayment } = await jiti.import("../lib/closed-payments.ts");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};
const fmt = (n) => Number(n).toFixed(3);

const { movements, contractors } = parseBackup(fs.readFileSync(BACKUP, "utf8"));
const approved = approvedOnly(movements);

/*
  العقد الذي شكا منه: دفعةٌ في سنة وباقيه في أخرى. ويُربط قبضه هنا كما
  يربطه من الشاشة، فالنسخة التي بين أيدينا لم يُربط فيها قبضٌ بعد.
*/
const contract =
  contractors.find((c) => c.contractNumber === "5001") ??
  contractors.find((c) => c.counterpartyType === "عميل");

const receipts = approved
  .filter(
    (m) => m.creditCode === "4110" && m.project === contract.project && !m.contractNumber
  )
  .sort((a, b) => a.date.localeCompare(b.date));

const years = [...new Set(receipts.map((m) => m.fiscalYear))].sort();
check(
  "قبضٌ على العقد في أكثر من سنة — وهي الحال التي شُكي منها",
  years.length > 1,
  `${contract.contractNumber} · ${years.join(" و")} · ${receipts.length} قبضاً`
);

const linked = approved.map((m) =>
  receipts.some((r) => r.id === m.id)
    ? { ...m, contractNumber: contract.contractNumber }
    : m
);

const lifetime = contractPayments(linked, contract.contractNumber).total;
const whole = receipts.reduce((s, m) => s + m.amount, 0);

console.log("\nالعقد على عمره كله:\n");
check(
  "المقبوض يجمع قبض السنوات كلها",
  fmt(lifetime) === fmt(whole),
  `${fmt(lifetime)} د.ك`
);
check(
  "والمتبقي يُحسب عليه",
  fmt(contract.contractValue - lifetime) ===
    fmt(contract.contractValue - whole),
  `${fmt(contract.contractValue - lifetime)} د.ك من ${fmt(contract.contractValue)}`
);

console.log("\nوالتصفية بالسنة كانت تُنقصه — فهذا فحصٌ يفحص:\n");
for (const year of years) {
  const ofYear = linked.filter((m) => m.fiscalYear === year);
  const partial = contractPayments(ofYear, contract.contractNumber).total;
  const missing = fmt(partial) !== fmt(lifetime);
  check(
    `لو صُفّي بسنة ${year} لظهر ${fmt(partial)} بدل ${fmt(lifetime)}`,
    missing,
    missing ? `ينقص ${fmt(lifetime - partial)}` : "لا فرق — الفحص لا يفحص"
  );
}

console.log("\nوالقفل يحجب لا اختيارُ السنة:\n");

const closed = approved.filter(isClosedContractorPayment);
check("دفعات ٢٠٢٥ المُقفلة موجودة في النسخة", closed.length > 0, `${closed.length} حركة`);

const projectsOfClosed = [...new Set(closed.map((m) => m.project))];
for (const project of projectsOfClosed) {
  const offered = [
    ...unlinkedContractorMovements(approved, project),
    ...unlinkedSupplierMovements(approved, project),
  ];
  check(
    `لا تُعرض للربط في «${project}» ولو امتدّ النطاق إلى السنوات كلها`,
    offered.every((m) => !isClosedContractorPayment(m)),
    `${offered.length} مرشّحاً`
  );
}

/* وما ليس مُقفلاً يبقى معروضاً — وإلا حجب القفلُ ما ليس له */
const openCandidates = unlinkedContractorMovements(approved, "");
check(
  "وغير المُقفل يبقى معروضاً",
  openCandidates.length > 0,
  `${openCandidates.length} حركة`
);

console.log(
  bad === 0
    ? "\n✓ العقد يُحسب على عمره كله، والمُقفل محجوب بقفله"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
