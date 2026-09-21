/**
 * يفحص توزيع مبلغ الحركة على أكثر من دفعة.
 *
 *   node db/check-installment-splits.mjs <نسخة.json>
 *
 * طلبُ صاحب الشركة في ٢١ سبتمبر ٢٠٢٦: يُدفع مبلغٌ واحد منه جزءٌ يُتمّ
 * دفعةً والباقي على التي تليها. وكان يلزم شطره قيدين، وهو مالٌ خرج
 * مرةً واحدة بإيصالٍ واحد.
 *
 * والذي يُخشى منه:
 *   • أن يُحسب المبلغ مرتين — مرةً كاملاً ومرةً موزَّعاً.
 *   • أن يقلّ مجموع التوزيع عن المبلغ أو يزيد، فيظهر العقد مدفوعاً
 *     بغير ما خرج من الصندوق.
 *   • أن يُغيّر التوزيع قيداً في الدفاتر — ولا يغيّر شيئاً.
 *   • أن يضيع عند الحفظ فيعود المبلغ إلى دفعةٍ واحدة.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-installment-splits.mjs <نسخة.json>");
  process.exit(1);
}

const { parseBackup, exportBackup, isPayableInstallment, installmentNet } =
  await jiti.import("../lib/storage.ts");
const {
  contractPayments,
  validate,
  computeTotals,
  buildTrialBalance,
  buildIncomeStatement,
} = await jiti.import("../lib/accounting.ts");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};
const fmt = (n) => Number(n).toFixed(3);

const state = parseBackup(fs.readFileSync(BACKUP, "utf8"));

/* عقد مقاولٍ له دفعتان فأكثر، وحركة أجور مقاولين على مشروعه */
const contract = state.contractors.find(
  (c) =>
    c.counterpartyType === "مقاول" &&
    c.installments.filter(isPayableInstallment).length >= 2
);
const [first, second] = contract.installments.filter(isPayableInstallment);
const source = state.movements.find(
  (m) => m.debitCode === "5120" && m.project === contract.project && m.amount >= 2
);
check(
  "عقدٌ بدفعتين وحركةُ صرفٍ على مشروعه",
  Boolean(contract && source),
  `${contract?.contractNumber} · قيد ${source?.entryNo} بـ ${fmt(source?.amount ?? 0)}`
);

/* يُوزَّع المبلغ: ثلثه على الأولى وثلثاه على الثانية */
const part1 = Number((source.amount / 3).toFixed(3));
const part2 = Number((source.amount - part1).toFixed(3));

const split = {
  ...source,
  contractNumber: contract.contractNumber,
  installmentNumber: undefined,
  installmentSplits: [
    { number: first.number, amount: part1 },
    { number: second.number, amount: part2 },
  ],
};
const after = {
  ...state,
  movements: state.movements.map((m) => (m.id === source.id ? split : m)),
};

console.log("\nالتوزيع يُنسب كلَّ حصّةٍ إلى دفعتها:\n");

const was = contractPayments(state.movements, contract.contractNumber);
const p = contractPayments(after.movements, contract.contractNumber);

/* على العقد دفعاتٌ سابقة، فيُقاس ما زاده التوزيع لا المجموع */
const added = (no) =>
  Number(
    ((p.byInstallment.get(no) ?? 0) - (was.byInstallment.get(no) ?? 0)).toFixed(3)
  );

check(
  "الدفعة الأولى تأخذ حصّتها",
  added(first.number) === part1,
  `${fmt(added(first.number))} من ${fmt(installmentNet(first))}`
);
check(
  "والثانية حصّتها",
  added(second.number) === part2,
  `${fmt(added(second.number))} من ${fmt(installmentNet(second))}`
);
check(
  "والمبلغ لا يُحسب مرتين — مجموع الحصص هو مبلغ الحركة",
  fmt(part1 + part2) === fmt(source.amount),
  `${fmt(part1 + part2)} · الحركة ${fmt(source.amount)}`
);

const onlyThis = contractPayments(
  after.movements.filter((m) => m.id === source.id),
  contract.contractNumber
);
check(
  "ومدفوع العقد يساوي مبلغ الحركة مرةً واحدة",
  onlyThis.total === source.amount,
  fmt(onlyThis.total)
);
check(
  "ولا حصّة على «دفعة غير محدّدة»",
  !onlyThis.byInstallment.has(0),
  [...onlyThis.byInstallment.keys()].join("، ")
);

console.log("\nوالمجموع يجب أن يطابق المبلغ:\n");

check("التوزيع المطابق مقبول", validate(split).valid, validate(split).problem);
check(
  "والناقص مرفوض",
  !validate({
    ...split,
    installmentSplits: [{ number: first.number, amount: part1 }],
  }).valid,
  validate({ ...split, installmentSplits: [{ number: first.number, amount: part1 }] })
    .problem
);
check(
  "والزائد مرفوض",
  !validate({
    ...split,
    installmentSplits: [
      { number: first.number, amount: part1 },
      { number: second.number, amount: part2 + 1 },
    ],
  }).valid
);
check(
  "وتكرار الدفعة الواحدة مرفوض",
  !validate({
    ...split,
    installmentSplits: [
      { number: first.number, amount: part1 },
      { number: first.number, amount: part2 },
    ],
  }).valid
);
check(
  "والتوزيع بلا عقدٍ مرفوض",
  !validate({ ...split, contractNumber: undefined }).valid
);

console.log("\nولا يمسّ الدفاتر، ويُحفظ فيعود:\n");

const years = [...new Set(state.movements.map((m) => m.fiscalYear))];
const digest = (list) =>
  years
    .map((y) => {
      const totals = computeTotals(
        list.filter((m) => m.fiscalYear === y),
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
check(
  "الميزان وصافي الربح كما هما",
  digest(state.movements) === digest(after.movements)
);

const reread = parseBackup(exportBackup(after));
const back = reread.movements.find((m) => m.id === source.id);
check(
  "والتوزيع يعود من النسخة الاحتياطية كما كُتب",
  back.installmentSplits?.length === 2 &&
    back.installmentSplits[0].amount === part1 &&
    back.installmentSplits[1].amount === part2,
  (back.installmentSplits ?? [])
    .map((x) => `${x.number}: ${fmt(x.amount)}`)
    .join(" · ")
);
check(
  "والحركات الأخرى بلا توزيع — لا مصفوفاتٍ فارغة",
  reread.movements
    .filter((m) => m.id !== source.id)
    .every((m) => m.installmentSplits === undefined)
);

console.log("\nوالشاشتان تكتبانه:\n");

/*
  التوزيع يُكتب من شاشة الإدخال ومن شاشة العقود معاً. وهذا فحص شيفرة
  لا حساب: يمسك أن يُنزع أحد المسارين أو يُنسى إسقاط التوزيع عند الربط
  بدفعةٍ واحدة — فيبقى توزيعٌ قديم تحت ربطٍ جديد.
*/
const page = fs.readFileSync("app/page.tsx", "utf8");
check(
  "شاشة الإدخال تكتب التوزيع",
  page.includes("parseSplits(form.installmentSplits)")
);
check("وشاشة العقود تكتبه كذلك", /onSplit=\{\(movementId, contractNumber, splits\)/.test(page));
check(
  "وزرّ «وزّع» في جدولَي المرتبطة والمرشّحة",
  (page.match(/openSplit\(m\)/g) ?? []).length >= 2,
  `${(page.match(/openSplit\(m\)/g) ?? []).length}`
);
check(
  "والربط بدفعةٍ واحدة يُسقط توزيعاً سابقاً",
  /installmentNumber,\s*\n\s*\/\*[^*]*\*\/\s*\n\s*installmentSplits: undefined,/.test(page)
);
check(
  "ولا يُحفظ توزيعٌ لا يطابق مجموعه المبلغ",
  page.includes("disabled={round3(m.amount - splitSum) !== 0}")
);

console.log(
  bad === 0
    ? "\n✓ المبلغ الواحد يُوزَّع على دفعتين، ولا يُحسب مرتين، ولا يمسّ الدفاتر"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
