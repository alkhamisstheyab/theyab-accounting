/**
 * نظام الرواتب — المحرّك والقواعد.
 *
 * القيم القانونية (ساعات العمل، نسب الإضافي، الإجازات، مكافأة نهاية الخدمة)
 * مستمدّة من قانون العمل في القطاع الأهلي رقم 6 لسنة 2010، ومُخزَّنة
 * كإعدادات قابلة للتعديل لا كثوابت في الشيفرة — القوانين تتغيّر، ونسب
 * التأمينات الاجتماعية تحديداً عُدّلت أكثر من مرة.
 *
 * على صاحب النظام التأكد من القيم لدى الهيئة العامة للقوى العاملة
 * والتأمينات الاجتماعية قبل الاعتماد عليها في صرف فعلي.
 */

import { round3 } from "./accounting";

/* ------------------------------------------------------------------ */
/* الموظف                                                              */
/* ------------------------------------------------------------------ */

export type WageType = "شهري" | "يومي";

export type Allowance = { name: string; amount: number };

export type Employee = {
  id: string;
  code: string;
  name: string;
  civilId: string;
  nationality: string;
  /** التأمينات الاجتماعية تخص الكويتيين وحدهم */
  isKuwaiti: boolean;
  jobTitle: string;
  /** إداري أو موقع — يحدّد حساب المصروف */
  department: string;
  /** المشروع لعمال المواقع، فارغ للإداريين */
  project: string;
  hireDate: string;
  /** فارغ يعني على رأس العمل */
  endDate: string;
  wageType: WageType;
  /** الأجر الفعلي المستحق: شهري أو يومي بحسب النوع — أساس كل احتساب */
  basicWage: number;
  /**
   * الراتب المسجّل في ملف وزارة الشؤون / إذن العمل.
   *
   * قد يخالف الأجر الفعلي، ويُستعمل في المخاطبات الرسمية وشهادات الراتب
   * لا في احتساب المسيّر. صفر يعني غير مسجّل أو مطابق للفعلي.
   */
  registeredWage: number;
  allowances: Allowance[];
  /** رقم الآيبان لكشوف التحويل البنكي */
  iban: string;
  /**
   * حساب المصروف الذي يُرحّل إليه أجر هذا الشخص.
   *
   * لا يصحّ افتراضه من الجهة وحدها: المهندس قد يُحمَّل على تكاليف المشاريع،
   * وما يُصرف للشريك مكافأةً لا يُقيَّد رواتبَ إدارية. فارغ يعني استعمال
   * الافتراضي بحسب الجهة.
   */
  wageAccount: string;
  /** يوم الراحة الأسبوعية */
  restDay: string;
  active: boolean;
  passportNumber: string;
  workPermitExpiry: string;
  residencyExpiry: string;
  notes: string;
};

/** سلف الموظفين — يُقفَل بخصم السداد من الراتب */
export const EMPLOYEE_ADVANCE_ACCOUNT = "1240";

export const WEEK_DAYS = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

export const DEPARTMENTS = ["إداري", "موقع"];

/** حساب المصروف الافتراضي بحسب الجهة */
export const defaultWageAccount = (department: string): string =>
  department === "موقع" ? "5130" : "6110";

export const wageAccountOf = (employee: Employee): string =>
  employee.wageAccount || defaultWageAccount(employee.department);

/* ------------------------------------------------------------------ */
/* إعدادات الرواتب                                                     */
/* ------------------------------------------------------------------ */

export type SickLeaveTier = { days: number; rate: number };

export type PayrollSettings = {
  dailyHours: number;
  weeklyHours: number;
  ramadanWeeklyHours: number;
  /** الأيام المعتمدة في الشهر لاشتقاق أجر اليوم من الراتب الشهري */
  monthDays: number;

  overtimeRate: number;
  restDayRate: number;
  holidayRate: number;
  maxOvertimeDaily: number;
  maxOvertimeYearly: number;

  annualLeaveDays: number;
  sickLeaveTiers: SickLeaveTier[];

  /** مكافأة نهاية الخدمة */
  eosFirstYears: number;
  eosDaysPerYearFirst: number;
  eosDaysPerYearAfter: number;
  eosCapMonths: number;

  /** حد الخصم من الأجر لسداد الديون */
  maxDeductionPercent: number;

  /**
   * وعاء احتساب الأجر: الأساسي وحده أم الأساسي مع البدلات.
   *
   * القانون يعرّف «الأجر» تعريفين بحسب السياق، والعرف يختلف بين المنشآت،
   * فالخيار متروك لصاحب النظام بعد مراجعة مستشاره.
   */
  overtimeOnGrossWage: boolean;
  eosOnGrossWage: boolean;

  /** التأمينات الاجتماعية — للكويتيين. تُترك صفراً حتى تؤكَّد النسب */
  socialInsuranceEnabled: boolean;
  socialInsuranceEmployee: number;
  socialInsuranceEmployer: number;
  socialInsuranceCeiling: number;
};

/**
 * القيم الابتدائية من قانون العمل رقم 6/2010.
 * نسب التأمينات صفر عمداً — لا أضع رقماً لم يؤكّده صاحب النظام.
 */
export const defaultPayrollSettings = (): PayrollSettings => ({
  dailyHours: 8,
  weeklyHours: 48,
  ramadanWeeklyHours: 36,
  monthDays: 30,

  overtimeRate: 1.25,
  restDayRate: 1.5,
  holidayRate: 2,
  maxOvertimeDaily: 2,
  maxOvertimeYearly: 180,

  annualLeaveDays: 30,
  sickLeaveTiers: [
    { days: 15, rate: 1 },
    { days: 10, rate: 0.75 },
    { days: 10, rate: 0.5 },
    { days: 10, rate: 0.25 },
    { days: 30, rate: 0 },
  ],

  eosFirstYears: 5,
  eosDaysPerYearFirst: 15,
  eosDaysPerYearAfter: 30,
  eosCapMonths: 18,

  maxDeductionPercent: 10,

  // الافتراض الأحوط للموظف: البدلات داخلة في وعاء الاحتساب
  overtimeOnGrossWage: true,
  eosOnGrossWage: true,

  socialInsuranceEnabled: false,
  socialInsuranceEmployee: 0,
  socialInsuranceEmployer: 0,
  socialInsuranceCeiling: 0,
});

/* ------------------------------------------------------------------ */
/* الحضور                                                              */
/* ------------------------------------------------------------------ */

export const ATTENDANCE_STATUSES = [
  "حاضر",
  "غياب بعذر",
  "غياب بدون عذر",
  "إجازة سنوية",
  "إجازة مرضية",
  "عطلة رسمية",
  "راحة أسبوعية",
] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export type AttendanceDay = {
  id: string;
  employeeId: string;
  /** yyyy-mm-dd */
  date: string;
  status: AttendanceStatus;
  /** ساعات العمل العادية */
  hours: number;
  /** ساعات إضافية في يوم عمل عادي */
  overtimeHours: number;
  /** ساعات عمل في يوم الراحة الأسبوعية */
  restDayHours: number;
  /** ساعات عمل في عطلة رسمية */
  holidayHours: number;
  note: string;
};

/** الحالات التي تُحتسب يوماً مدفوعاً كاملاً */
const PAID_FULL: AttendanceStatus[] = [
  "حاضر",
  "إجازة سنوية",
  "عطلة رسمية",
  "راحة أسبوعية",
];

/** الحالات التي تُخصم من الأجر */
export const isUnpaid = (status: AttendanceStatus) =>
  status === "غياب بدون عذر";

/* ------------------------------------------------------------------ */
/* الأجر                                                               */
/* ------------------------------------------------------------------ */

export const totalAllowances = (employee: Employee): number =>
  round3(employee.allowances.reduce((sum, a) => sum + (a.amount || 0), 0));

/**
 * أجر اليوم.
 *
 * `includeAllowances` يحدّد الوعاء: الأساسي وحده أم مع البدلات — وهو خيار
 * قانوني يختلف بين الإضافي ونهاية الخدمة، فيُمرَّر صراحةً لا يُفترض.
 */
export function dailyWage(
  employee: Employee,
  settings: PayrollSettings,
  includeAllowances = false
): number {
  const monthly =
    employee.basicWage + (includeAllowances ? totalAllowances(employee) : 0);

  if (employee.wageType === "يومي") {
    // الأجر اليومي: البدلات شهرية فتُقسَّم على أيام الشهر
    return round3(
      employee.basicWage +
        (includeAllowances
          ? totalAllowances(employee) / (settings.monthDays || 30)
          : 0)
    );
  }
  return round3(monthly / (settings.monthDays || 30));
}

/** أجر الساعة = أجر اليوم ÷ ساعات اليوم */
export function hourlyWage(
  employee: Employee,
  settings: PayrollSettings,
  includeAllowances = false
): number {
  return round3(
    dailyWage(employee, settings, includeAllowances) / (settings.dailyHours || 8)
  );
}

/* ------------------------------------------------------------------ */
/* احتساب راتب موظف عن شهر                                             */
/* ------------------------------------------------------------------ */

export type PayrollLine = {
  employeeId: string;
  employeeName: string;
  wageType: WageType;
  department: string;
  project: string;

  /** أيام العمل المحتسبة */
  paidDays: number;
  absentDays: number;
  /** أيام إجازة مرضية وما خُصم منها */
  sickDays: number;
  sickDeduction: number;

  basic: number;
  allowances: number;
  overtimeHours: number;
  overtimePay: number;
  restDayHours: number;
  restDayPay: number;
  holidayHours: number;
  holidayPay: number;

  gross: number;
  absenceDeduction: number;
  otherDeductions: number;

  /**
   * ما خُصم من الراتب سداداً لسلفةٍ سابقة.
   *
   * وهو غير «الخصومات الأخرى»: تلك جزاءٌ أو تسويةٌ تُنقص المصروف، وهذا
   * استردادُ مالٍ سُلّم سلفاً — فيُقفل به حساب سلف الموظفين، ويبقى
   * الراتب مصروفاً بكامله.
   */
  advanceDeduction: number;
  socialInsurance: number;
  totalDeductions: number;
  net: number;

  /** تنبيهات: تجاوز حد الإضافي أو حد الخصم */
  warnings: string[];
};

/**
 * يحسب راتب موظف عن شهر من سجلات حضوره.
 *
 * الشهري: يبدأ بالراتب كاملاً ويُخصم منه الغياب بدون عذر.
 * اليومي: يُحتسب من أيام الحضور الفعلية لا من راتب مفترض.
 */
export function computePayrollLine(input: {
  employee: Employee;
  attendance: AttendanceDay[];
  settings: PayrollSettings;
  otherDeductions?: number;
  /** سداد سلفة يُخصم من هذا الراتب */
  advanceDeduction?: number;
  yearOvertimeHours?: number;
}): PayrollLine {
  const { employee, attendance, settings } = input;
  // الخصم عن الغياب من الأجر الأساسي؛ والإضافي من الوعاء الذي اختاره النظام
  const day = dailyWage(employee, settings);
  const hour = hourlyWage(employee, settings, settings.overtimeOnGrossWage);
  const warnings: string[] = [];

  let paidDays = 0;
  let absentDays = 0;
  let sickDays = 0;
  let sickDeduction = 0;
  let overtimeHours = 0;
  let restDayHours = 0;
  let holidayHours = 0;

  // ترتيب الأيام المرضية يحدّد شريحتها، فالحساب يتبع التسلسل الزمني
  const sorted = [...attendance].sort((a, b) => a.date.localeCompare(b.date));
  let sickCounter = 0;

  for (const record of sorted) {
    overtimeHours += record.overtimeHours || 0;
    restDayHours += record.restDayHours || 0;
    holidayHours += record.holidayHours || 0;

    if (record.status === "إجازة مرضية") {
      sickCounter++;
      sickDays++;
      const rate = sickLeaveRate(sickCounter, settings);
      sickDeduction = round3(sickDeduction + day * (1 - rate));
      paidDays++;
      continue;
    }

    if (isUnpaid(record.status)) {
      absentDays++;
      continue;
    }

    if (PAID_FULL.includes(record.status) || record.status === "غياب بعذر") {
      paidDays++;
    }
  }

  if (
    settings.maxOvertimeDaily > 0 &&
    sorted.some((r) => (r.overtimeHours || 0) > settings.maxOvertimeDaily)
  ) {
    warnings.push(
      `يوم أو أكثر تجاوز حد الإضافي اليومي (${settings.maxOvertimeDaily} ساعة)`
    );
  }

  const yearTotal = (input.yearOvertimeHours ?? 0) + overtimeHours;
  if (settings.maxOvertimeYearly > 0 && yearTotal > settings.maxOvertimeYearly) {
    warnings.push(
      `إجمالي الإضافي السنوي ${yearTotal} ساعة يتجاوز الحد (${settings.maxOvertimeYearly})`
    );
  }

  // الشهري يُصرف كاملاً ويُخصم منه الغياب؛ اليومي يُبنى من أيام الحضور
  const basic =
    employee.wageType === "شهري"
      ? round3(employee.basicWage)
      : round3(day * paidDays);

  const absenceDeduction =
    employee.wageType === "شهري" ? round3(day * absentDays) : 0;

  const allowances = totalAllowances(employee);
  const overtimePay = round3(overtimeHours * hour * settings.overtimeRate);
  const restDayPay = round3(restDayHours * hour * settings.restDayRate);
  const holidayPay = round3(holidayHours * hour * settings.holidayRate);

  const gross = round3(
    basic + allowances + overtimePay + restDayPay + holidayPay
  );

  const insurable = settings.socialInsuranceCeiling
    ? Math.min(gross, settings.socialInsuranceCeiling)
    : gross;
  const socialInsurance =
    settings.socialInsuranceEnabled && employee.isKuwaiti
      ? round3((insurable * settings.socialInsuranceEmployee) / 100)
      : 0;

  const otherDeductions = round3(input.otherDeductions ?? 0);
  const advanceDeduction = round3(input.advanceDeduction ?? 0);
  const totalDeductions = round3(
    absenceDeduction +
      sickDeduction +
      socialInsurance +
      otherDeductions +
      advanceDeduction
  );

  if (
    settings.maxDeductionPercent > 0 &&
    otherDeductions > (gross * settings.maxDeductionPercent) / 100
  ) {
    warnings.push(
      `الخصومات الأخرى تتجاوز ${settings.maxDeductionPercent}% من الأجر`
    );
  }

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    wageType: employee.wageType,
    department: employee.department,
    project: employee.project,
    paidDays,
    absentDays,
    sickDays,
    sickDeduction,
    basic,
    allowances,
    overtimeHours,
    overtimePay,
    restDayHours,
    restDayPay,
    holidayHours,
    holidayPay,
    gross,
    absenceDeduction,
    otherDeductions,
    advanceDeduction,
    socialInsurance,
    totalDeductions,
    net: round3(gross - totalDeductions),
    warnings,
  };
}

/** نسبة أجر اليوم المرضي بحسب ترتيبه في السنة */
export function sickLeaveRate(
  dayNumber: number,
  settings: PayrollSettings
): number {
  let remaining = dayNumber;
  for (const tier of settings.sickLeaveTiers) {
    if (remaining <= tier.days) return tier.rate;
    remaining -= tier.days;
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/* مكافأة نهاية الخدمة                                                 */
/* ------------------------------------------------------------------ */

export type EndOfServiceResult = {
  years: number;
  months: number;
  days: number;
  totalYears: number;
  daysEarned: number;
  amount: number;
  capped: boolean;
  note: string;
};

/**
 * مكافأة نهاية الخدمة للراتب الشهري:
 * أيام عن كل سنة في السنوات الأولى، ثم أيام أكثر لما بعدها، بحد أقصى.
 */
export function endOfService(
  employee: Employee,
  settings: PayrollSettings,
  asOf: string
): EndOfServiceResult {
  const start = new Date(employee.hireDate);
  const end = new Date(employee.endDate || asOf);
  const empty: EndOfServiceResult = {
    years: 0,
    months: 0,
    days: 0,
    totalYears: 0,
    daysEarned: 0,
    amount: 0,
    capped: false,
    note: "تاريخ التعيين غير صحيح",
  };
  if (!employee.hireDate || Number.isNaN(start.getTime())) return empty;
  if (end < start) return { ...empty, note: "تاريخ الانتهاء قبل التعيين" };

  const msPerDay = 86_400_000;
  const totalDays = Math.floor((end.getTime() - start.getTime()) / msPerDay);
  const totalYears = totalDays / 365.25;

  const years = Math.floor(totalYears);
  const months = Math.floor((totalYears - years) * 12);
  const days = Math.max(
    0,
    totalDays - Math.floor(years * 365.25) - Math.floor(months * 30.44)
  );

  const first = Math.min(totalYears, settings.eosFirstYears);
  const after = Math.max(0, totalYears - settings.eosFirstYears);
  const daysEarned = round3(
    first * settings.eosDaysPerYearFirst + after * settings.eosDaysPerYearAfter
  );

  const day = dailyWage(employee, settings, settings.eosOnGrossWage);
  const monthlyEquivalent = round3(day * settings.monthDays);

  let amount = round3(daysEarned * day);
  const cap = round3(monthlyEquivalent * settings.eosCapMonths);
  const capped = cap > 0 && amount > cap;
  if (capped) amount = cap;

  return {
    years,
    months,
    days,
    totalYears: round3(totalYears),
    daysEarned,
    amount,
    capped,
    note: capped ? `بلغت الحد الأقصى (${settings.eosCapMonths} شهراً)` : "",
  };
}

/* ------------------------------------------------------------------ */
/* مسيّر الرواتب                                                       */
/* ------------------------------------------------------------------ */

export type PayrollStatus = "مسودة" | "معتمد" | "مرحّل";

export type PayrollRun = {
  id: string;
  /** yyyy-mm */
  month: string;
  fiscalYear: number;
  status: PayrollStatus;
  createdAt: string;
  createdBy: string;
  approvedAt: string;
  approvedBy: string;
  /** أرقام القيود الناتجة عن الترحيل */
  postedMovementIds: string[];
  lines: PayrollLine[];
  /** خصومات إضافية أُدخلت يدوياً: معرّف الموظف ← المبلغ */
  deductions: Record<string, number>;
  /** سداد السلف من رواتب هذا الشهر: معرّف الموظف ← المبلغ */
  advanceDeductions?: Record<string, number>;
  note: string;
};

export const monthLabel = (month: string): string => {
  const [year, m] = month.split("-");
  const names = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];
  return `${names[Number(m) - 1] ?? m} ${year}`;
};

export function payrollTotals(lines: PayrollLine[]) {
  const sum = (pick: (l: PayrollLine) => number) =>
    round3(lines.reduce((acc, l) => acc + pick(l), 0));
  return {
    basic: sum((l) => l.basic),
    allowances: sum((l) => l.allowances),
    overtime: sum((l) => l.overtimePay + l.restDayPay + l.holidayPay),
    gross: sum((l) => l.gross),
    deductions: sum((l) => l.totalDeductions),
    socialInsurance: sum((l) => l.socialInsurance),
    net: sum((l) => l.net),
    count: lines.length,
  };
}
