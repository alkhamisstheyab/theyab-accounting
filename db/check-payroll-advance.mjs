/**
 * يفحص سداد السلفة من الراتب.
 *
 *   node db/check-payroll-advance.mjs <نسخة.json>
 *
 * وقع في ٢٣ سبتمبر ٢٠٢٦: سلفتان بمئتَي دينار سُلّمتا للموظفين، وقال
 * صاحب الشركة إنهما سُدّدتا — ولا قيد سدادٍ لهما في الدفاتر. والسبب أن
 * مسيّر الرواتب كان يُرحّل **صافي** الراتب وحده: فلو خُصمت السلفة لظهر
 * الراتب في الدفاتر ناقصاً بقيمتها، وبقي حساب سلف الموظفين مفتوحاً أبداً.
 *
 * فصار للسلفة خانتها في المسيّر وقيدها عند الترحيل:
 *   مدين حساب الراتب / دائن النقدية   — بالصافي
 *   مدين حساب الراتب / دائن 1240      — بالمسدَّد من السلفة
 *
 * فالراتب مصروفٌ بكامله، والسلفة تُقفل.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-payroll-advance.mjs <نسخة.json>");
  process.exit(1);
}

const { parseBackup } = await jiti.import("../lib/storage.ts");
const {
  computePayrollLine,
  defaultPayrollSettings,
  EMPLOYEE_ADVANCE_ACCOUNT,
  wageAccountOf,
} = await jiti.import("../lib/payroll.ts");
const { computeTotals, buildTrialBalance, validate } = await jiti.import(
  "../lib/accounting.ts"
);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};
const f = (n) => Number(n).toFixed(3);

const state = parseBackup(fs.readFileSync(BACKUP, "utf8"));
const settings = state.payrollSettings ?? defaultPayrollSettings();
const employee = state.employees.find((e) => e.active) ?? state.employees[0];
check("موظفٌ من ملف الشركة", Boolean(employee), employee?.name);

const ADVANCE = 100;

console.log("\nالخصم يُنقص الصافي ولا يُنقص الراتب:\n");

const plain = computePayrollLine({ employee, attendance: [], settings });
const withAdvance = computePayrollLine({
  employee,
  attendance: [],
  settings,
  advanceDeduction: ADVANCE,
});

check(
  "الأجر الإجمالي واحدٌ في الحالين",
  plain.gross === withAdvance.gross,
  f(withAdvance.gross)
);
check(
  "والصافي ينقص بقيمة السلفة",
  withAdvance.net === Number((plain.net - ADVANCE).toFixed(3)),
  `${f(withAdvance.net)} بدل ${f(plain.net)}`
);
check(
  "والمسدَّد يُقرأ في السطر",
  withAdvance.advanceDeduction === ADVANCE,
  f(withAdvance.advanceDeduction)
);
check(
  "وهو غير «الخصومات الأخرى»",
  withAdvance.otherDeductions === 0 &&
    computePayrollLine({ employee, attendance: [], settings, otherDeductions: 5 })
      .advanceDeduction === 0
);

console.log("\nوالترحيل قيدان لا قيد:\n");

/* كما يبنيهما زرّ «ترحيل إلى الحسابات» */
const base = {
  fiscalYear: 2026,
  date: "2026-09-30",
  itemCode: "",
  project: employee.project,
  person: employee.name,
  party: employee.name,
  source: "app",
  approval: "معتمدة",
  approvedBy: "ذياب الخميس",
  approvedAt: new Date().toISOString(),
  approvalNote: "مرحّل من مسيّر رواتب سبتمبر ٢٠٢٦",
};
const salary = {
  ...base,
  id: "راتب",
  entryNo: 9001,
  movementType: "مصروف",
  description: `راتب سبتمبر — ${employee.name}`,
  itemName: "رواتب",
  debitCode: wageAccountOf(employee),
  creditCode: "1112",
  amount: withAdvance.net,
  paymentMethod: "تحويل بنكي",
};
const repay = {
  ...base,
  id: "سداد",
  entryNo: 9002,
  movementType: "سداد سلفة",
  description: `سداد سلفة من راتب سبتمبر — ${employee.name}`,
  itemName: "سلف وعهد الموظفين",
  debitCode: wageAccountOf(employee),
  creditCode: EMPLOYEE_ADVANCE_ACCOUNT,
  amount: ADVANCE,
  paymentMethod: "",
};

check("قيد الراتب صالح", validate(salary).valid, validate(salary).problem);
check("وقيد السداد صالح", validate(repay).valid, validate(repay).problem);
check(
  "والسداد يُقيَّد على سلف الموظفين دائناً",
  repay.creditCode === EMPLOYEE_ADVANCE_ACCOUNT
);
check(
  "ولا يمسّ النقدية — المال لم يخرج مرتين",
  repay.creditCode !== "1111" && repay.creditCode !== "1112"
);
check(
  "ومجموع القيدين هو الأجر المستحق كاملاً",
  f(salary.amount + repay.amount) === f(withAdvance.gross - withAdvance.absenceDeduction - withAdvance.sickDeduction - withAdvance.socialInsurance - withAdvance.otherDeductions),
  `${f(salary.amount + repay.amount)}`
);

console.log("\nوالسلفة تُقفل:\n");

const given = {
  ...base,
  id: "تسليم",
  entryNo: 9000,
  date: "2026-07-07",
  movementType: "سلفة",
  description: `سلفة للموظف ${employee.name} تُخصم من الراتب`,
  itemName: "سلف وعهد الموظفين",
  debitCode: EMPLOYEE_ADVANCE_ACCOUNT,
  creditCode: "1111",
  amount: ADVANCE,
  paymentMethod: "نقدي",
};

const balance = (list) =>
  Number(
    list
      .reduce(
        (sum, m) =>
          sum +
          (m.debitCode === EMPLOYEE_ADVANCE_ACCOUNT ? m.amount : 0) -
          (m.creditCode === EMPLOYEE_ADVANCE_ACCOUNT ? m.amount : 0),
        0
      )
      .toFixed(3)
  );

check("قبل السداد بذمته السلفة", balance([given]) === ADVANCE, f(balance([given])));
check(
  "وبعده صفر — الحساب يُقفل",
  balance([given, salary, repay]) === 0,
  f(balance([given, salary, repay]))
);

/* والميزان يتوازن بالقيدين */
const totals = computeTotals([given, salary, repay], {}, true);
const tb = buildTrialBalance(totals, false);
check(
  "وميزان المراجعة متوازن",
  f(tb.totals.periodDebit) === f(tb.totals.periodCredit),
  `${f(tb.totals.periodDebit)} = ${f(tb.totals.periodCredit)}`
);

/* والطريقة القديمة: الصافي وحده — تُبقي السلفة مفتوحة */
const oldWay = balance([given, salary]);
check(
  "والطريقة القديمة كانت تُبقيها مفتوحة — فهذا فحصٌ يفحص",
  oldWay === ADVANCE,
  f(oldWay)
);

/* الشاشة */
const page = fs.readFileSync("app/page.tsx", "utf8");
check("وللمسيّر خانة «سداد سلفة»", page.includes("<Th>سداد سلفة</Th>"));
check(
  "ويُعرض فيها ما بذمة الموظف من الدفاتر",
  page.includes("بذمته {fmt(advanceBalance.get(line.employeeName) ?? 0)}")
);
check(
  "والترحيل يكتب قيد السداد",
  page.includes("creditCode: EMPLOYEE_ADVANCE_ACCOUNT")
);

console.log(
  bad === 0
    ? "\n✓ السلفة تُخصم من الراتب فتُقفل، والراتب يبقى مصروفاً بكامله"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
