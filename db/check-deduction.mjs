/**
 * يفحص خصم المهندس على الدفعة.
 *
 *   node db/check-deduction.mjs <نسخة.json>
 *
 * طلبُ صاحب الشركة في ٢١ سبتمبر ٢٠٢٦: المرحلة تُنجَز فيشهد المهندس
 * بإنجازها، وفيها تقصيرٌ أو تأخير يستوجب خصماً. فيُكتب الخصم وسببه مع
 * الاعتماد نفسه، ثم تُقرّه الإدارة وهي تراه.
 *
 * والذي يُخشى منه:
 *   • أن يُنقص الخصمُ قيمةَ العقد — وهو جزاءٌ على التنفيذ لا تعديلٌ للعقد.
 *   • أن يُقيَّد في الدفاتر — ولا قيد له: لم يُدفع مالٌ ولم يُقبض.
 *   • أن يُنسى سببه فيصير حسماً لا يُدافَع عنه.
 *   • أن تبقى الدفعة «ناقصة» أبداً وقد استوفى المقاول حقّه بعد الخصم.
 *   • أن يبقى الخصم بعد سحب الاعتماد الذي وُلد معه.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-deduction.mjs <نسخة.json>");
  process.exit(1);
}

const {
  parseBackup,
  exportBackup,
  isPayableInstallment,
  installmentValue,
  installmentNet,
  installmentDeduction,
  isInstallmentDue,
} = await jiti.import("../lib/storage.ts");
const { computeTotals, buildTrialBalance, buildIncomeStatement } = await jiti.import(
  "../lib/accounting.ts"
);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};
const fmt = (n) => Number(n).toFixed(3);

const state = parseBackup(fs.readFileSync(BACKUP, "utf8"));

const contract = state.contractors.find(
  (c) => c.counterpartyType === "مقاول" && c.installments.some(isPayableInstallment)
);
/*
  تُبدأ الحكاية من دفعةٍ لم تُعتمد ولم تُقرّ: الترحيل يَعدّ الدفعات
  القديمة مُقرّةً لئلا يصير مصروفٌ فعلاً «غير مستحق» بأثر رجعي، فلو
  أُخذت كما هي لبدأ الفحص من منتصف الطريق.
*/
const target = {
  ...contract.installments.filter(isPayableInstallment)[0],
  approved: false,
  approvedBy: "",
  approvedAt: "",
  approvalNote: "",
  confirmed: false,
  confirmedBy: "",
  confirmedAt: "",
  confirmNote: "",
};
const CUT = 50;
const REASON = "تأخير عشرة أيام عن موعد التسليم";

/* المهندس يعتمد ويخصم في آنٍ واحد — كما تفعل الشاشة */
const approve = (installment) => ({
  ...installment,
  approved: true,
  approvedBy: "م. نوح",
  approvedAt: new Date().toISOString(),
  approvalNote: "عُوين الموقع",
  deduction: String(CUT),
  deductionReason: REASON,
});

const after = {
  ...state,
  contractors: state.contractors.map((c) =>
    c.id !== contract.id
      ? c
      : {
          ...c,
          installments: c.installments.map((i) =>
            i.number === target.number ? approve(target) : i
          ),
        }
  ),
};
const afterContract = after.contractors.find((c) => c.id === contract.id);
const afterInstallment = afterContract.installments.find(
  (i) => i.number === target.number
);

console.log("\nالخصم يُنقص المستحق وحده:\n");

check(
  "قيمة الدفعة كما في العقد لا تتغيّر",
  installmentValue(afterInstallment) === installmentValue(target),
  fmt(installmentValue(afterInstallment))
);
check(
  "والمستحق للصرف ينقص بقيمة الخصم",
  installmentNet(afterInstallment) === installmentValue(target) - CUT,
  `${fmt(installmentNet(afterInstallment))} بدل ${fmt(installmentValue(target))}`
);
check("والخصم يُقرأ بقيمته", installmentDeduction(afterInstallment) === CUT);
check("ومعه سببه", afterInstallment.deductionReason === REASON);
check(
  "وقيمة العقد كما هي",
  afterContract.contractValue === contract.contractValue,
  fmt(afterContract.contractValue)
);
check(
  "ومجموع دفعات العقد كما هو — الخصم ليس تعديلاً للعقد",
  fmt(
    afterContract.installments
      .filter(isPayableInstallment)
      .reduce((s, i) => s + installmentValue(i), 0)
  ) ===
    fmt(
      contract.installments
        .filter(isPayableInstallment)
        .reduce((s, i) => s + installmentValue(i), 0)
    )
);
check(
  "ودفعات العقد الأخرى بلا خصم",
  afterContract.installments
    .filter((i) => i.number !== target.number)
    .every((i) => installmentDeduction(i) === 0)
);

console.log("\nوهو من الاعتماد فيتبعه:\n");

check(
  "الدفعة تصير معتمدة باسم من اعتمدها",
  afterInstallment.approved && afterInstallment.approvedBy === "م. نوح"
);
check(
  "ولا تصير مستحقة قبل إقرار الإدارة",
  !isInstallmentDue(afterInstallment)
);

const confirmed = { ...afterInstallment, confirmed: true, confirmedBy: "ذياب الخميس" };
check("وبإقرارها تصير مستحقة — بمستحقٍّ منقوص", isInstallmentDue(confirmed));
check(
  "والإدارة تُقرّ وهي ترى الخصم وسببه",
  installmentDeduction(confirmed) === CUT && Boolean(confirmed.deductionReason)
);

/* سحب الاعتماد يسحب ما وُلد معه */
const withdrawn = {
  ...afterInstallment,
  approved: false,
  approvedBy: "",
  approvedAt: "",
  approvalNote: "",
  deduction: undefined,
  deductionReason: undefined,
  confirmed: false,
};
check(
  "وسحب الاعتماد يُسقط الخصم فيعود المستحق كاملاً",
  installmentDeduction(withdrawn) === 0 &&
    installmentNet(withdrawn) === installmentValue(target),
  fmt(installmentNet(withdrawn))
);

console.log("\nويُحفظ ولا يمسّ الدفاتر:\n");

const reread = parseBackup(exportBackup(after));
const back = reread.contractors
  .find((c) => c.id === contract.id)
  .installments.find((i) => i.number === target.number);
check(
  "يعود من النسخة الاحتياطية كما كُتب",
  installmentDeduction(back) === CUT && back.deductionReason === REASON,
  `${fmt(installmentDeduction(back))} · ${back.deductionReason ?? "—"}`
);

check(
  "ولا حركة زادت — الخصم ليس قيداً",
  after.movements.length === state.movements.length
);

const years = [...new Set(state.movements.map((m) => m.fiscalYear))];
const digest = (st) =>
  years
    .map((y) => {
      const totals = computeTotals(
        st.movements.filter((m) => m.fiscalYear === y),
        {},
        true
      );
      return JSON.stringify([
        buildTrialBalance(totals, false).rows.map((r) => [
          r.account.code,
          fmt(r.periodDebit),
          fmt(r.periodCredit),
        ]),
        fmt(buildIncomeStatement(totals).netProfit),
      ]);
    })
    .join("|");
check("والميزان وصافي الربح كما هما", digest(state) === digest(after));

console.log(
  bad === 0
    ? "\n✓ الخصم يُنقص المستحق، ويتبع الاعتماد، ولا يمسّ العقد ولا الدفاتر"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
