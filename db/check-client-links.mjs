/**
 * يفحص ربط قبض العملاء بعقودهم.
 *
 *   node db/check-client-links.mjs <نسخة.json>
 *
 * العقد نوعان وقيدهما معكوس: دفعة المقاول تُقيَّد على المصروف مديناً،
 * ودفعة العميل على الإيراد دائناً. وكان الحساب يقرأ المدين وحده، فلو
 * رُبط قبضٌ بعقد عميل لظهر بالسالب — يزيد المتبقي كلما دفع العميل.
 *
 * والذي يُخشى منه:
 *   • أن يخرج المقبوض بالسالب، أو يُحسب المتبقي على العميل خطأً.
 *   • أن يتغيّر شيء في الدفاتر — والربط لا يغيّر قيداً البتّة.
 *   • أن تختلط عقود المقاولين بعقود العملاء في قوائم الربط.
 *   • أن ينكسر حساب عقود المقاولين القائم — وقد مُسّت دالّته.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-client-links.mjs <نسخة.json>");
  process.exit(1);
}

const { parseBackup } = await jiti.import("../lib/storage.ts");
const {
  contractPayments,
  unlinkedClientReceipts,
  unlinkedContractorMovements,
  unlinkedSupplierMovements,
  computeTotals,
  buildTrialBalance,
  buildIncomeStatement,
  CLIENT_REVENUE,
  CONTRACTOR_EXPENSE,
} = await jiti.import("../lib/accounting.ts");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};
const fmt = (n) => Number(n).toFixed(3);

const raw = JSON.parse(fs.readFileSync(BACKUP, "utf8"));
const { movements, contractors } = parseBackup(fs.readFileSync(BACKUP, "utf8"));
void raw;

const clientContracts = contractors.filter((c) => c.counterpartyType === "عميل");

console.log("\nما تجده شاشة الربط:\n");

const receipts = unlinkedClientReceipts(movements);
check(
  "قبض العملاء غير المرتبط يُعرض للربط",
  receipts.length > 0,
  `${receipts.length} حركة بمجموع ${fmt(
    receipts.reduce((s, m) => s + m.amount, 0)
  )} د.ك`
);
check(
  "وكلّها على حساب الإيراد دائناً",
  receipts.every((m) => m.creditCode === CLIENT_REVENUE)
);
check("ولا حركة مرتبطة بينها", receipts.every((m) => !m.contractNumber));

/* لا اختلاط: القبض ليس من مرشّحي عقود المقاولين، ولا العكس */
const contractorCandidates = unlinkedContractorMovements(movements, "");
check(
  "قبض العملاء لا يظهر في مرشّحي عقود المقاولين",
  contractorCandidates.every((m) => m.creditCode !== CLIENT_REVENUE)
);
check(
  "ودفعات المقاولين لا تظهر في مرشّحي عقود العملاء",
  receipts.every((m) => m.debitCode !== CONTRACTOR_EXPENSE)
);
check("وعقود العملاء موجودة", clientContracts.length > 0, `${clientContracts.length} عقد`);

/* عقود الموردين: تُربط بمصروف المشروع المباشر كلّه لا بأجور المقاولين وحدها */
const supplier = contractors.find(
  (c) => c.counterpartyType === "مورّد" && c.project
);
const supplierCandidates = unlinkedSupplierMovements(movements, supplier.project);
check(
  "ومصروف المشروع المباشر يُعرض لعقد المورّد",
  supplierCandidates.length > 0,
  `${supplier.contractNumber} · ${supplierCandidates.length} حركة`
);
check(
  "وكلّه على مشروع العقد وحده",
  supplierCandidates.every((m) => m.project === supplier.project)
);
check(
  "وكلّه تكاليف تنفيذٍ مباشرة (5)",
  supplierCandidates.every((m) => m.debitCode.startsWith("5"))
);
check(
  "ولا قبضَ فيه ولا مصروفاً إدارياً",
  supplierCandidates.every(
    (m) => m.creditCode !== CLIENT_REVENUE && !m.debitCode.startsWith("6")
  )
);
check(
  "وأجور المقاولين منه — فهي مصروفٌ مباشر",
  supplierCandidates.some((m) => m.debitCode === CONTRACTOR_EXPENSE) ||
    unlinkedContractorMovements(movements, supplier.project).length === 0
);
check(
  "والمرتبط سلفاً لا يُعرض مرةً أخرى",
  supplierCandidates.every((m) => !m.contractNumber)
);

console.log("\nالمقبوض والمتبقي بعد الربط:\n");

/* يُربط أول قبضٍ بأول عقد عميل — كما تفعل الشاشة بضغطة «ربط» */
const contract = clientContracts[0];
const receipt = receipts[0];
const linked = movements.map((m) =>
  m.id === receipt.id
    ? { ...m, contractNumber: contract.contractNumber, installmentNumber: 1 }
    : m
);

const before = contractPayments(movements, contract.contractNumber);
const after = contractPayments(linked, contract.contractNumber);

check("قبل الربط لا مقبوض", before.total === 0, fmt(before.total));
check(
  "وبعده المقبوض موجبٌ بقيمة الدفعة",
  after.total === receipt.amount,
  `${fmt(after.total)} · الحركة ${fmt(receipt.amount)}`
);
check(
  "ويُنسب إلى دفعته المحدّدة",
  after.byInstallment.get(1) === receipt.amount,
  fmt(after.byInstallment.get(1) ?? 0)
);
check(
  "فينقص المتبقي على العميل",
  contract.contractValue - after.total < contract.contractValue - before.total,
  `${fmt(contract.contractValue - after.total)} د.ك`
);

/* إلغاء قبضٍ — قيدٌ عكسي يُخصم لا يُضاف */
const reversal = {
  ...receipt,
  id: "عكسي",
  debitCode: CLIENT_REVENUE,
  creditCode: receipt.debitCode,
  contractNumber: contract.contractNumber,
  installmentNumber: 1,
};
const withReversal = contractPayments([...linked, reversal], contract.contractNumber);
check(
  "وإلغاء القبض يُخصم فيعود المقبوض صفراً",
  withReversal.total === 0,
  fmt(withReversal.total)
);

console.log("\nما لا يجوز أن يتغيّر:\n");

/* الربط لا يمسّ الدفاتر */
const year = receipt.fiscalYear;
const ofYear = (list) => list.filter((m) => m.fiscalYear === year);
const netProfit = (list) =>
  fmt(buildIncomeStatement(computeTotals(ofYear(list), {}, true)).netProfit);
check(
  `صافي ربح ${year} لا يتغيّر بالربط`,
  netProfit(movements) === netProfit(linked),
  netProfit(linked)
);

const balances = (list) =>
  JSON.stringify(
    buildTrialBalance(computeTotals(ofYear(list), {}, true), false).rows.map((r) => [
      r.account.code,
      fmt(r.periodDebit),
      fmt(r.periodCredit),
    ])
  );
check("وميزان المراجعة كما هو حرفاً بحرف", balances(movements) === balances(linked));

/* عقود المقاولين القائمة: حسابها لم ينكسر بتعديل الدالّة */
const contractorContracts = contractors.filter((c) => c.counterpartyType !== "عميل");
let sameAsExpected = true;
let checkedContracts = 0;
for (const c of contractorContracts) {
  const p = contractPayments(movements, c.contractNumber);
  if (p.movements.length === 0) continue;
  checkedContracts++;
  /* القاعدة القديمة: المدين مصروفٌ فيُضاف، وما عداه يُخصم */
  const expected = p.movements.reduce(
    (sum, m) => sum + (m.debitCode.startsWith("5") || m.debitCode.startsWith("6") ? m.amount : -m.amount),
    0
  );
  if (fmt(expected) !== fmt(p.total)) sameAsExpected = false;
}
check(
  "ومدفوع عقود المقاولين كما كان قبل التعديل",
  sameAsExpected && checkedContracts > 0,
  `${checkedContracts} عقداً عليه دفعات`
);

/* الفحص يسقط إن عاد الخطأ: قاعدة المدين وحده تجعل القبض سالباً */
const oldRule = linked
  .filter((m) => m.contractNumber === contract.contractNumber)
  .reduce(
    (sum, m) => sum + (m.debitCode.startsWith("5") || m.debitCode.startsWith("6") ? m.amount : -m.amount),
    0
  );
check(
  "والقاعدة القديمة كانت تُخرج المقبوض سالباً — فهذا فحصٌ يفحص",
  oldRule < 0 && after.total > 0,
  `${fmt(oldRule)} ← ${fmt(after.total)}`
);

console.log(
  bad === 0
    ? "\n✓ قبض العملاء يُربط بعقوده، والمقبوض موجب، والدفاتر لم تُمسّ"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
