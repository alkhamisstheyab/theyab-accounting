/**
 * محرّك الحسابات — المصدر الوحيد لكل رقم في النظام
 *
 * دليل الحسابات وخرائط الترحيل مولّدة من الإكسل في chart-of-accounts.ts.
 * كل حركة تحمل طرفَي قيدها صراحةً (مدين/دائن) وسنتها المالية.
 */

import {
  Account,
  AccountType,
  ItemDefinition,
  CHART_OF_ACCOUNTS as GENERATED_CHART,
  ITEM_MAP as GENERATED_ITEMS,
  PAYMENT_MAP as GENERATED_PAYMENTS,
} from "./chart-of-accounts";
import { isClosedContractorPayment } from "./closed-payments";

export type { Account, AccountType, ItemDefinition };
export { GENERATED_CHART, GENERATED_ITEMS, GENERATED_PAYMENTS };

export type PaymentMethod = { label: string; account: string };

/**
 * البيانات الأساسية قابلة للتحرير من الإعدادات، فهي متغيّرات لا ثوابت.
 *
 * الوحدات في ES تصدّر ارتباطات حيّة، فكل من يستورد هذه القوائم يرى
 * قيمتها المحدَّثة بعد configureMasterData. الفهارس تُعاد بناؤها معها،
 * وإلا بقيت تشير إلى الدليل القديم.
 *
 * التطبيق يستدعي configureMasterData مرة عند التحميل وكلما عُدّلت
 * البيانات، قبل حساب أي تقرير.
 */
export let CHART_OF_ACCOUNTS: Account[] = GENERATED_CHART;
export let ITEM_MAP: ItemDefinition[] = GENERATED_ITEMS;
export let PAYMENT_MAP: PaymentMethod[] = GENERATED_PAYMENTS;

/* ------------------------------------------------------------------ */
/* الأنواع                                                             */
/* ------------------------------------------------------------------ */

export type Movement = {
  id: string;
  /** رقم القيد داخل سنته */
  entryNo: number;
  fiscalYear: number;
  /** yyyy-mm-dd */
  date: string;
  movementType: string;
  description: string;
  /** كود البند، مثل EXP004 */
  itemCode: string;
  itemName: string;
  /** طرفا القيد — مخزّنان صراحةً لا مشتقّان وقت العرض */
  debitCode: string;
  creditCode: string;
  amount: number;
  project: string;
  person: string;
  paymentMethod: string;
  party: string;
  /** ربط الحركة بعقد مقاول — فارغ لغير المرتبطة */
  contractNumber?: string;
  /** ترتيب الدفعة داخل العقد، صفر يعني دفعة غير محدّدة */
  installmentNumber?: number;

  /**
   * توزيع المبلغ على أكثر من دفعة في العقد نفسه.
   *
   * فالمبلغ الواحد قد يُكمل دفعةً ويبدأ التي بعدها: تُدفع ألفٌ منها
   * ثلاثمئة تُتمّ الدفعة الثالثة وسبعمئة على الرابعة. وكان يلزم شطره
   * إلى قيدين، وهو مالٌ خرج مرةً واحدة بإيصالٍ واحد.
   *
   * ومجموع التوزيع يساوي مبلغ الحركة تماماً، وإلا رُفضت. ومتى وُجد
   * التوزيع فهو المعتمد، ولا يُقرأ installmentNumber معه.
   */
  installmentSplits?: InstallmentSplit[];
  /** excel = مستوردة من الملف، app = أُدخلت في النظام */
  source: "excel" | "app";

  /**
   * حالة الاعتماد — قرار مجلس الإدارة في ١٢ سبتمبر ٢٠٢٦.
   *
   * الحركة تُحفظ فور إدخالها ولا تُفقد، لكنها لا تدخل ميزان المراجعة ولا
   * القوائم المالية ولا تقارير المشاريع حتى يعتمدها صاحب الشركة أو المدير
   * العام أو المدير العام المالي والإداري. والقوائم لا تعرض رقماً لم يُقرّه أحد.
   */
  approval: ApprovalState;
  approvedBy: string;
  /** ISO datetime */
  approvedAt: string;
  /** سبب الرفض أو ملاحظة المعتمِد */
  approvalNote: string;
};

/** حصّة دفعةٍ من مبلغ حركة */
export type InstallmentSplit = { number: number; amount: number };

export type ApprovalState = "بانتظار الاعتماد" | "معتمدة" | "مرفوضة";

export const APPROVAL_STATES: ApprovalState[] = [
  "بانتظار الاعتماد",
  "معتمدة",
  "مرفوضة",
];

/** المعتمدة وحدها تدخل الحسابات */
export const isApproved = (movement: Movement): boolean =>
  movement.approval === "معتمدة";

export const approvedOnly = (movements: Movement[]): Movement[] =>
  movements.filter(isApproved);

export type OpeningBalance = { debit: string; credit: string };
/** أرصدة افتتاحية لسنة واحدة: رقم الحساب ← مدين/دائن */
export type YearOpening = Record<string, OpeningBalance>;
/** كل السنوات: "2026" ← أرصدة تلك السنة */
export type OpeningBalances = Record<string, YearOpening>;

/* ------------------------------------------------------------------ */
/* فهارس الحسابات                                                      */
/* ------------------------------------------------------------------ */

let BY_CODE: Record<string, Account> = Object.fromEntries(
  CHART_OF_ACCOUNTS.map((a) => [a.code, a])
);

export const getAccount = (code: string): Account | undefined => BY_CODE[code];
export const accountName = (code: string): string => BY_CODE[code]?.name ?? "";

/** الحسابات التي تُرحّل عليها القيود — تستثني الحسابات الرئيسية التجميعية */
export let POSTABLE_ACCOUNTS: Account[] = CHART_OF_ACCOUNTS.filter(
  (a) => a.postable && a.active
);

export const TYPE_ASSET: AccountType = "أصول";
export const TYPE_LIABILITY: AccountType = "إلتزامات";
export const TYPE_EQUITY: AccountType = "حقوق الملكية";
export const TYPE_REVENUE: AccountType = "إيرادات";
export const TYPE_EXPENSE: AccountType = "مصروفات";

/** النقدية وما في حكمها: الصندوق والبنك (1110 حساب أب لا يُرحّل عليه) */
export const CASH_CODES = ["1111", "1112"];
export const isCash = (code: string) => CASH_CODES.includes(code);

export const isProjectCost = (a: Account) =>
  a.type === TYPE_EXPENSE && a.code.startsWith("5");
export const isAdminExpense = (a: Account) =>
  a.type === TYPE_EXPENSE && a.code.startsWith("6");
export const isResultAccount = (a: Account) =>
  a.type === TYPE_REVENUE || a.type === TYPE_EXPENSE;
export const isFixedAsset = (a: Account) =>
  a.type === TYPE_ASSET && (a.code.startsWith("12") || a.code.startsWith("15"));

/** الأرباح المرحّلة — وعاء إقفال نتيجة السنة السابقة */
export const RETAINED_EARNINGS = "3300";

/* ------------------------------------------------------------------ */
/* البنود وطرق الدفع                                                   */
/* ------------------------------------------------------------------ */

let ITEM_BY_CODE = Object.fromEntries(ITEM_MAP.map((i) => [i.code, i]));
let ITEM_BY_NAME = Object.fromEntries(ITEM_MAP.map((i) => [i.name, i]));

export const getItem = (code: string) => ITEM_BY_CODE[code];

/** يحوّل كود بند أو اسمه إلى رقم حساب، أو "" إن لم يكن معرّفاً */
export function itemAccount(codeOrName: string): string {
  const key = (codeOrName ?? "").trim();
  if (!key) return "";
  return (ITEM_BY_CODE[key] ?? ITEM_BY_NAME[key])?.account ?? "";
}

/** بنود بلا حساب مقابل في الإكسل — تحتاج قراراً محاسبياً */
export let UNMAPPED_ITEMS: ItemDefinition[] = ITEM_MAP.filter((i) => !i.account);

let PAYMENT_BY_LABEL = Object.fromEntries(
  PAYMENT_MAP.map((p) => [p.label, p.account])
);

/**
 * يستبدل البيانات الأساسية ويعيد بناء كل الفهارس المشتقّة منها.
 *
 * يعيد رقم إصدار يتزايد مع كل استدعاء، ليُستخدم في تبعيات useMemo فتُعاد
 * الحسابات بعد التغيير لا قبله.
 */
let masterDataVersion = 0;

export function configureMasterData(data: {
  accounts?: Account[];
  items?: ItemDefinition[];
  payments?: PaymentMethod[];
}): number {
  if (data.accounts?.length) CHART_OF_ACCOUNTS = data.accounts;
  if (data.items) ITEM_MAP = data.items;
  if (data.payments) PAYMENT_MAP = data.payments;

  BY_CODE = Object.fromEntries(CHART_OF_ACCOUNTS.map((a) => [a.code, a]));
  POSTABLE_ACCOUNTS = CHART_OF_ACCOUNTS.filter((a) => a.postable && a.active);
  ITEM_BY_CODE = Object.fromEntries(ITEM_MAP.map((i) => [i.code, i]));
  ITEM_BY_NAME = Object.fromEntries(ITEM_MAP.map((i) => [i.name, i]));
  UNMAPPED_ITEMS = ITEM_MAP.filter((i) => !i.account);
  PAYMENT_BY_LABEL = Object.fromEntries(
    PAYMENT_MAP.map((p) => [p.label, p.account])
  );

  return ++masterDataVersion;
}

export const paymentAccount = (label: string): string =>
  PAYMENT_BY_LABEL[(label ?? "").trim()] ?? "";

/** طرق دفع مستخدمة في الحركات لكنها غير معرّفة في PostingMap */
export function unknownPaymentMethods(movements: Movement[]): string[] {
  const seen = new Set<string>();
  for (const m of movements) {
    const label = (m.paymentMethod ?? "").trim();
    if (label && !PAYMENT_BY_LABEL[label]) seen.add(label);
  }
  return [...seen];
}

/* ------------------------------------------------------------------ */
/* الأرقام — الدينار الكويتي ٣ خانات                                   */
/* ------------------------------------------------------------------ */

export function round3(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 1000) / 1000;
}

const EPSILON = 0.0005;
export const nearlyEqual = (a: number, b: number) => Math.abs(a - b) < EPSILON;
export const isZero = (n: number) => Math.abs(n) < EPSILON;

export function fmt(n: number): string {
  return round3(Number(n) || 0).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

/* ------------------------------------------------------------------ */
/* السنة المالية                                                       */
/* ------------------------------------------------------------------ */

export const fiscalYearOf = (date: string): number =>
  Number((date ?? "").slice(0, 4)) || 0;

/** السنوات الموجودة فعلاً في البيانات، تنازلياً */
export function availableYears(
  movements: Movement[],
  opening: OpeningBalances
): number[] {
  const years = new Set<number>();
  for (const m of movements) if (m.fiscalYear) years.add(m.fiscalYear);
  for (const y of Object.keys(opening)) {
    const n = Number(y);
    if (n) years.add(n);
  }
  if (years.size === 0) years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
}

export const movementsOfYear = (movements: Movement[], year: number) =>
  movements.filter((m) => m.fiscalYear === year);

export const openingOfYear = (
  opening: OpeningBalances,
  year: number
): YearOpening => opening[String(year)] ?? {};

/* ------------------------------------------------------------------ */
/* الفترة داخل السنة                                                   */
/* ------------------------------------------------------------------ */

export type Period = {
  /** yyyy-mm-dd — فارغ يعني من بداية السنة */
  from: string;
  /** yyyy-mm-dd — فارغ يعني إلى نهاية السنة */
  to: string;
};

export const fullYearPeriod = (): Period => ({ from: "", to: "" });

export const isFullYear = (period: Period) => !period.from && !period.to;

export function inPeriod(movement: Movement, period: Period): boolean {
  if (period.from && movement.date < period.from) return false;
  if (period.to && movement.date > period.to) return false;
  return true;
}

export const movementsInPeriod = (movements: Movement[], period: Period) =>
  movements.filter((m) => inPeriod(m, period));

/**
 * الرصيد الافتتاحي للفترة = افتتاحي السنة + كل حركة سبقت بداية الفترة.
 *
 * بدون هذا يظهر ميزان المراجعة غير متوازن عند اختيار فترة جزئية،
 * لأن أرصدة ما قبل الفترة تختفي من الطرفين بغير تساوٍ.
 */
export function periodOpening(
  yearMovements: Movement[],
  opening: YearOpening,
  applyOpening: boolean,
  from: string
): YearOpening {
  const signed: Record<string, number> = {};

  for (const account of CHART_OF_ACCOUNTS) {
    const debit = applyOpening
      ? Number(opening[account.code]?.debit || 0)
      : 0;
    const credit = applyOpening
      ? Number(opening[account.code]?.credit || 0)
      : 0;
    signed[account.code] = round3(debit - credit);
  }

  if (from) {
    for (const movement of yearMovements) {
      if (movement.date >= from) continue;
      if (!validate(movement).valid) continue;
      signed[movement.debitCode] = round3(
        signed[movement.debitCode] + movement.amount
      );
      signed[movement.creditCode] = round3(
        signed[movement.creditCode] - movement.amount
      );
    }
  }

  const result: YearOpening = {};
  for (const [code, value] of Object.entries(signed)) {
    if (isZero(value)) continue;
    result[code] = {
      debit: value > 0 ? String(value) : "",
      credit: value < 0 ? String(round3(-value)) : "",
    };
  }
  return result;
}

/** وصف الفترة بالعربية للعرض والطباعة */
export function describePeriod(period: Period, year: number): string {
  if (isFullYear(period)) return `السنة المالية ${year} كاملة`;
  if (period.from && period.to) return `من ${period.from} إلى ${period.to}`;
  if (period.from) return `من ${period.from} إلى نهاية السنة`;
  return `من بداية السنة إلى ${period.to}`;
}

/* ------------------------------------------------------------------ */
/* صحة القيد                                                           */
/* ------------------------------------------------------------------ */

export type Validation = { valid: boolean; problem: string };

export function validate(movement: Partial<Movement>): Validation {
  const bad = (problem: string) => ({ valid: false, problem });

  const debit = movement.debitCode ?? "";
  const credit = movement.creditCode ?? "";
  const amount = round3(Number(movement.amount) || 0);

  if (!debit || !credit) return bad("القيد ناقص طرفاً");
  if (!BY_CODE[debit]) return bad(`الحساب المدين ${debit} غير معروف`);
  if (!BY_CODE[credit]) return bad(`الحساب الدائن ${credit} غير معروف`);
  if (!BY_CODE[debit].postable)
    return bad(`${debit} حساب رئيسي لا يُرحّل عليه`);
  if (!BY_CODE[credit].postable)
    return bad(`${credit} حساب رئيسي لا يُرحّل عليه`);
  if (debit === credit) return bad("طرفا القيد نفس الحساب");
  if (amount <= 0) return bad("المبلغ يجب أن يكون أكبر من صفر");
  if (!movement.date) return bad("التاريخ مطلوب");

  /*
    التوزيع على الدفعات: مجموعه مبلغ الحركة تماماً. فلو قلّ أو زاد
    لظهر العقد مدفوعاً بغير ما خرج من الصندوق.
  */
  const splits = movement.installmentSplits ?? [];
  if (splits.length > 0) {
    if (!movement.contractNumber) return bad("التوزيع على الدفعات يحتاج عقداً");
    if (splits.some((x) => !(Number(x.number) > 0)))
      return bad("كل حصّة تحتاج رقم دفعة");
    if (splits.some((x) => round3(Number(x.amount) || 0) <= 0))
      return bad("كل حصّة تحتاج مبلغاً أكبر من صفر");
    if (new Set(splits.map((x) => Number(x.number))).size !== splits.length)
      return bad("لا تُكرَّر الدفعة الواحدة في التوزيع");
    const total = round3(splits.reduce((sum, x) => sum + (Number(x.amount) || 0), 0));
    if (total !== amount)
      return bad(
        `مجموع التوزيع ${total.toFixed(3)} لا يساوي مبلغ الحركة ${amount.toFixed(3)}`
      );
  }

  return { valid: true, problem: "" };
}

export function findBrokenMovements(movements: Movement[]) {
  return movements
    .map((movement) => ({ movement, ...validate(movement) }))
    .filter((x) => !x.valid);
}

/**
 * يشتق طرفَي القيد لحركة جديدة تُدخل من النظام، بنفس قواعد الإكسل:
 * البند يحدد حساب المصروف/الإيراد، وطريقة الدفع تحدد الحساب المقابل.
 */
export function deriveEntry(input: {
  movementType: string;
  itemCode: string;
  paymentMethod: string;
}): { debitCode: string; creditCode: string } {
  const item = itemAccount(input.itemCode);
  const contra = paymentAccount(input.paymentMethod);
  const account = item ? getAccount(item) : undefined;

  // الإيراد يُقيَّد دائناً والمقابل مديناً؛ ما عداه بالعكس
  const itemIsCredit =
    account?.type === TYPE_REVENUE || input.movementType === "إيرادات";

  return itemIsCredit
    ? { debitCode: contra, creditCode: item }
    : { debitCode: item, creditCode: contra };
}

/* ------------------------------------------------------------------ */
/* الأرصدة الافتتاحية                                                  */
/* ------------------------------------------------------------------ */

export function openingTotals(opening: YearOpening) {
  let debit = 0;
  let credit = 0;
  for (const account of CHART_OF_ACCOUNTS) {
    debit += Number(opening[account.code]?.debit || 0);
    credit += Number(opening[account.code]?.credit || 0);
  }
  debit = round3(debit);
  credit = round3(credit);
  return { debit, credit, balanced: nearlyEqual(debit, credit) };
}

export function openingOnResultAccounts(opening: YearOpening): string[] {
  return CHART_OF_ACCOUNTS.filter(
    (a) =>
      isResultAccount(a) &&
      (Number(opening[a.code]?.debit || 0) !== 0 ||
        Number(opening[a.code]?.credit || 0) !== 0)
  ).map((a) => a.code);
}

/* ------------------------------------------------------------------ */
/* التجميع                                                             */
/* ------------------------------------------------------------------ */

export type AccountTotals = {
  account: Account;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
};

export type Totals = Record<string, AccountTotals>;

export function computeTotals(
  movements: Movement[],
  opening: YearOpening,
  applyOpening: boolean
): Totals {
  const totals: Totals = {};

  for (const account of CHART_OF_ACCOUNTS) {
    totals[account.code] = {
      account,
      openingDebit: applyOpening
        ? round3(Number(opening[account.code]?.debit || 0))
        : 0,
      openingCredit: applyOpening
        ? round3(Number(opening[account.code]?.credit || 0))
        : 0,
      periodDebit: 0,
      periodCredit: 0,
    };
  }

  for (const movement of movements) {
    if (!validate(movement).valid) continue;
    totals[movement.debitCode].periodDebit += movement.amount;
    totals[movement.creditCode].periodCredit += movement.amount;
  }

  for (const code of Object.keys(totals)) {
    totals[code].periodDebit = round3(totals[code].periodDebit);
    totals[code].periodCredit = round3(totals[code].periodCredit);
  }

  return totals;
}

/** موجب = مدين، سالب = دائن */
export const signedBalance = (t: AccountTotals) =>
  round3(t.openingDebit - t.openingCredit + t.periodDebit - t.periodCredit);

/** الرصيد بالاتجاه الطبيعي للحساب */
export const naturalBalance = (t: AccountTotals) =>
  t.account.nature === "مدين" ? signedBalance(t) : round3(-signedBalance(t));

const hasActivity = (t: AccountTotals) =>
  !isZero(t.openingDebit) ||
  !isZero(t.openingCredit) ||
  !isZero(t.periodDebit) ||
  !isZero(t.periodCredit);

/* ------------------------------------------------------------------ */
/* ميزان المراجعة                                                      */
/* ------------------------------------------------------------------ */

export type TrialBalanceRow = {
  account: Account;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
};

export function buildTrialBalance(totals: Totals, onlyActive = true) {
  const rows: TrialBalanceRow[] = POSTABLE_ACCOUNTS.map((account) => {
    const t = totals[account.code];
    const signed = signedBalance(t);
    return {
      account,
      openingDebit: t.openingDebit,
      openingCredit: t.openingCredit,
      periodDebit: t.periodDebit,
      periodCredit: t.periodCredit,
      closingDebit: signed > 0 ? signed : 0,
      closingCredit: signed < 0 ? round3(-signed) : 0,
    };
  }).filter((r) => !onlyActive || hasActivity(totals[r.account.code]));

  const sum = (pick: (r: TrialBalanceRow) => number) =>
    round3(rows.reduce((acc, r) => acc + pick(r), 0));

  const totalsRow = {
    openingDebit: sum((r) => r.openingDebit),
    openingCredit: sum((r) => r.openingCredit),
    periodDebit: sum((r) => r.periodDebit),
    periodCredit: sum((r) => r.periodCredit),
    closingDebit: sum((r) => r.closingDebit),
    closingCredit: sum((r) => r.closingCredit),
  };

  return {
    rows,
    totals: totalsRow,
    balanced:
      nearlyEqual(totalsRow.openingDebit, totalsRow.openingCredit) &&
      nearlyEqual(totalsRow.periodDebit, totalsRow.periodCredit) &&
      nearlyEqual(totalsRow.closingDebit, totalsRow.closingCredit),
  };
}

/* ------------------------------------------------------------------ */
/* قائمة الدخل — من حركة الفترة فقط                                    */
/* ------------------------------------------------------------------ */

export type ReportRow = { code: string; name: string; amount: number };

const sumRows = (rows: ReportRow[]) =>
  round3(rows.reduce((acc, r) => acc + r.amount, 0));

export function buildIncomeStatement(totals: Totals) {
  const rowsOf = (filter: (a: Account) => boolean, credit: boolean) =>
    POSTABLE_ACCOUNTS.filter(filter).map((a) => {
      const t = totals[a.code];
      return {
        code: a.code,
        name: a.name,
        amount: credit
          ? round3(t.periodCredit - t.periodDebit)
          : round3(t.periodDebit - t.periodCredit),
      };
    });

  const revenues = rowsOf((a) => a.type === TYPE_REVENUE, true);
  const projectCosts = rowsOf(isProjectCost, false);
  const adminExpenses = rowsOf(isAdminExpense, false);

  const totalRevenue = sumRows(revenues);
  const totalProjectCosts = sumRows(projectCosts);
  const totalAdminExpenses = sumRows(adminExpenses);
  const grossProfit = round3(totalRevenue - totalProjectCosts);

  return {
    revenues,
    projectCosts,
    adminExpenses,
    totalRevenue,
    totalProjectCosts,
    totalAdminExpenses,
    grossProfit,
    netProfit: round3(grossProfit - totalAdminExpenses),
  };
}

/* ------------------------------------------------------------------ */
/* قائمة المركز المالي                                                 */
/* ------------------------------------------------------------------ */

export function buildBalanceSheet(totals: Totals, netProfit: number) {
  const rowsOf = (type: AccountType) =>
    POSTABLE_ACCOUNTS.filter((a) => a.type === type).map((a) => ({
      code: a.code,
      name: a.name,
      amount: naturalBalance(totals[a.code]),
    }));

  const assets = rowsOf(TYPE_ASSET);
  const liabilities = rowsOf(TYPE_LIABILITY);
  const equityAccounts = rowsOf(TYPE_EQUITY);

  const totalAssets = sumRows(assets);
  const totalLiabilities = sumRows(liabilities);
  const totalEquity = round3(sumRows(equityAccounts) + netProfit);
  const difference = round3(totalAssets - (totalLiabilities + totalEquity));

  return {
    assets,
    liabilities,
    equityAccounts,
    netProfit,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity: round3(totalLiabilities + totalEquity),
    difference,
    balanced: isZero(difference),
  };
}

/* ------------------------------------------------------------------ */
/* قائمة التغيرات في حقوق الملكية                                      */
/* ------------------------------------------------------------------ */

export function buildEquityStatement(totals: Totals, netProfit: number) {
  const rows = POSTABLE_ACCOUNTS.filter((a) => a.type === TYPE_EQUITY).map(
    (a) => {
      const t = totals[a.code];
      const opening = round3(t.openingCredit - t.openingDebit);
      const movement = round3(t.periodCredit - t.periodDebit);
      return {
        code: a.code,
        name: a.name,
        opening,
        movement,
        closing: round3(opening + movement),
      };
    }
  );

  const sum = (pick: (r: (typeof rows)[number]) => number) =>
    round3(rows.reduce((acc, r) => acc + pick(r), 0));

  const openingTotal = sum((r) => r.opening);
  const movementTotal = sum((r) => r.movement);

  return {
    rows: rows.filter(
      (r) => !isZero(r.opening) || !isZero(r.movement) || !isZero(r.closing)
    ),
    openingTotal,
    movementTotal,
    netProfit,
    closingTotal: round3(openingTotal + movementTotal + netProfit),
  };
}

/* ------------------------------------------------------------------ */
/* التقارير التحليلية                                                  */
/* ------------------------------------------------------------------ */

export type MonthlyRow = {
  code: string;
  name: string;
  byMonth: number[];
  total: number;
};

/** مصفوفة الشهر × الحساب لمصروفات سنة واحدة */
export function monthlyExpenses(movements: Movement[], year: number) {
  const months = Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`
  );

  const accounts = POSTABLE_ACCOUNTS.filter((a) => a.type === TYPE_EXPENSE);
  const index = new Map(accounts.map((a, i) => [a.code, i]));
  const grid = accounts.map(() => new Array(12).fill(0));

  for (const movement of movements) {
    if (!validate(movement).valid) continue;
    const month = Number(movement.date.slice(5, 7)) - 1;
    if (month < 0 || month > 11) continue;

    const debitAt = index.get(movement.debitCode);
    if (debitAt !== undefined) grid[debitAt][month] += movement.amount;

    const creditAt = index.get(movement.creditCode);
    if (creditAt !== undefined) grid[creditAt][month] -= movement.amount;
  }

  const rows: MonthlyRow[] = accounts
    .map((a, i) => ({
      code: a.code,
      name: a.name,
      byMonth: grid[i].map(round3),
      total: round3(grid[i].reduce((s: number, v: number) => s + v, 0)),
    }))
    .filter((r) => !isZero(r.total))
    .sort((a, b) => b.total - a.total);

  const monthTotals = months.map((_, m) =>
    round3(rows.reduce((s, r) => s + r.byMonth[m], 0))
  );

  return {
    months,
    rows,
    monthTotals,
    grandTotal: round3(rows.reduce((s, r) => s + r.total, 0)),
  };
}

/**
 * سلّتان ليستا مشروعين.
 *
 * «مصروفات مشتركة» تكلفة تنفيذ حقيقية تعذّر نسبها إلى قسيمة بعينها،
 * و«عام» ما ليس تكلفة مشروع أصلاً — رواتب إدارية ورسوم وعهد وجاري
 * الشركاء. عدّهما مشروعين يضيف إلى تقرير الربحية صفَّي تكلفة بلا
 * إيراد، أي خسارة دائمة، ويقتطع من نصيب كل مشروع حقيقي من التكاليف.
 * فتُعرضان منفصلتين، ولا تدخلان في المجاميع ولا في حساب النصيب.
 */
export const NON_PROJECT_BUCKETS = ["عام", "مصروفات مشتركة"];

export const isNonProject = (name: string): boolean =>
  NON_PROJECT_BUCKETS.includes(name.trim());

export type ProjectAnalysisRow = {
  project: string;
  revenue: number;
  cost: number;
  net: number;
  movements: number;
  /** نصيب المشروع من إجمالي التكاليف */
  costShare: number;
};

export type ProjectResult = { revenue: number; cost: number; net: number };

export type ProjectLifetimeRow = {
  project: string;
  /** السنوات التي فيها حركة على المشروع */
  years: number[];
  movements: number;
  /** منذ بداية المشروع حتى اليوم — المقياس الصحيح لربحيته */
  lifetime: ProjectResult;
  /** مساهمة السنة المعروضة وحدها */
  inYear: ProjectResult;
  costShare: number;
};

/**
 * تحليل المشاريع عبر عمرها كله.
 *
 * المشروع يمتد عبر السنوات المالية: قد يُقبض إيراده في سنة وتُصرف
 * تكاليفه في التي تليها. قياس ربحيته بسنة واحدة يعطي نتيجة كاذبة،
 * فالمعتمد هنا هو الإجمالي التراكمي، وحصة السنة تُعرض بجانبه للعلم.
 */
export function projectLifetimeAnalysis(movements: Movement[], year: number) {
  const names = [...new Set(movements.map((m) => m.project).filter(Boolean))];
  const ofYear = movements.filter((m) => m.fiscalYear === year);

  const build = (project: string): ProjectLifetimeRow => {
    const mine = movements.filter((m) => m.project === project);
    return {
      project,
      years: [...new Set(mine.map((m) => m.fiscalYear))].sort(),
      movements: mine.length,
      lifetime: projectSummary(movements, project),
      inYear: projectSummary(ofYear, project),
      costShare: 0,
    };
  };

  const rows: ProjectLifetimeRow[] = names.filter((n) => !isNonProject(n)).map(build);
  const buckets: ProjectLifetimeRow[] = names.filter(isNonProject).map(build);

  const totalCost = round3(rows.reduce((s, r) => s + r.lifetime.cost, 0));
  for (const row of rows) {
    row.costShare = totalCost > 0 ? round3((row.lifetime.cost / totalCost) * 100) : 0;
  }
  rows.sort((a, b) => b.lifetime.cost - a.lifetime.cost);
  buckets.sort((a, b) => b.lifetime.cost - a.lifetime.cost);

  const sum = (pick: (r: ProjectLifetimeRow) => number) =>
    round3(rows.reduce((s, r) => s + pick(r), 0));

  const bucketSum = (pick: (r: ProjectLifetimeRow) => number) =>
    round3(buckets.reduce((s, r) => s + pick(r), 0));

  return {
    rows,
    /** «عام» و«مصروفات مشتركة» — تُعرض ولا تُحتسب ضمن المشاريع */
    buckets,
    bucketTotals: {
      revenue: bucketSum((r) => r.lifetime.revenue),
      cost: bucketSum((r) => r.lifetime.cost),
      net: bucketSum((r) => r.lifetime.net),
      movements: buckets.reduce((s, r) => s + r.movements, 0),
    },
    lifetime: {
      revenue: sum((r) => r.lifetime.revenue),
      cost: totalCost,
      net: sum((r) => r.lifetime.net),
    },
    inYear: {
      revenue: sum((r) => r.inYear.revenue),
      cost: sum((r) => r.inYear.cost),
      net: sum((r) => r.inYear.net),
    },
    /** المشاريع الممتدة عبر أكثر من سنة — قياسها بسنة واحدة مضلّل */
    multiYear: rows.filter((r) => r.years.length > 1).length,
  };
}

export function projectAnalysis(movements: Movement[]) {
  const names = [...new Set(movements.map((m) => m.project).filter(Boolean))].filter(
    (n) => !isNonProject(n)
  );

  const rows: ProjectAnalysisRow[] = names.map((project) => {
    const s = projectSummary(movements, project);
    return {
      project,
      revenue: s.revenue,
      cost: s.cost,
      net: s.net,
      movements: movements.filter((m) => m.project === project).length,
      costShare: 0,
    };
  });

  const totalCost = round3(rows.reduce((s, r) => s + r.cost, 0));
  for (const row of rows) {
    row.costShare = totalCost > 0 ? round3((row.cost / totalCost) * 100) : 0;
  }

  rows.sort((a, b) => b.cost - a.cost);

  return {
    rows,
    totalRevenue: round3(rows.reduce((s, r) => s + r.revenue, 0)),
    totalCost,
    totalNet: round3(rows.reduce((s, r) => s + r.net, 0)),
  };
}

/* ------------------------------------------------------------------ */
/* التدفقات النقدية — الطريقة المباشرة                                 */
/*                                                                     */
/* تصنّف الحركات التي مسّت الصندوق أو البنك، فيساوي مجموع الأقسام      */
/* التغيّر الفعلي في النقدية دائماً.                                   */
/* ------------------------------------------------------------------ */

type Activity = "operating" | "investing" | "financing";

function activityOf(code: string): Activity {
  const account = getAccount(code);
  if (!account) return "operating";
  if (account.type === TYPE_EQUITY) return "financing";
  if (code === "2160" || code === "2161" || code === "2210") return "financing";
  if (isFixedAsset(account)) return "investing";
  return "operating";
}

export function buildCashFlow(
  movements: Movement[],
  opening: YearOpening,
  applyOpening: boolean
) {
  const buckets: Record<Activity, Map<string, number>> = {
    operating: new Map(),
    investing: new Map(),
    financing: new Map(),
  };

  for (const movement of movements) {
    if (!validate(movement).valid) continue;

    const debitIsCash = isCash(movement.debitCode);
    const creditIsCash = isCash(movement.creditCode);
    // تحويل بين الصندوق والبنك لا يغيّر النقدية الإجمالية
    if (debitIsCash === creditIsCash) continue;

    const counterpart = debitIsCash ? movement.creditCode : movement.debitCode;
    const flow = debitIsCash ? movement.amount : -movement.amount;
    const map = buckets[activityOf(counterpart)];
    map.set(counterpart, round3((map.get(counterpart) ?? 0) + flow));
  }

  const section = (activity: Activity) => {
    const lines: ReportRow[] = [...buckets[activity].entries()]
      .map(([code, amount]) => ({ code, name: accountName(code), amount }))
      .filter((line) => !isZero(line.amount))
      .sort((a, b) => a.code.localeCompare(b.code));
    return { lines, total: sumRows(lines) };
  };

  const operating = section("operating");
  const investing = section("investing");
  const financing = section("financing");
  const netChange = round3(operating.total + investing.total + financing.total);

  const openingCash = applyOpening
    ? round3(
        CASH_CODES.reduce(
          (acc, code) =>
            acc +
            Number(opening[code]?.debit || 0) -
            Number(opening[code]?.credit || 0),
          0
        )
      )
    : 0;

  return {
    operating,
    investing,
    financing,
    netChange,
    openingCash,
    closingCash: round3(openingCash + netChange),
  };
}

export const cashPerAccounts = (totals: Totals) =>
  round3(CASH_CODES.reduce((acc, code) => acc + signedBalance(totals[code]), 0));

/* ------------------------------------------------------------------ */
/* دفتر الأستاذ                                                        */
/* ------------------------------------------------------------------ */

export type LedgerLine = {
  entryNo: number;
  date: string;
  description: string;
  counterpart: string;
  debit: number;
  credit: number;
  balance: number;
};

export function buildLedger(movements: Movement[], code: string, totals: Totals) {
  const t = totals[code];
  const opening = t ? round3(t.openingDebit - t.openingCredit) : 0;

  let balance = opening;
  const lines: LedgerLine[] = [];

  for (const movement of movements) {
    if (!validate(movement).valid) continue;

    if (movement.debitCode === code) {
      balance = round3(balance + movement.amount);
      lines.push({
        entryNo: movement.entryNo,
        date: movement.date,
        description: movement.description,
        counterpart: accountName(movement.creditCode),
        debit: movement.amount,
        credit: 0,
        balance,
      });
    }

    if (movement.creditCode === code) {
      balance = round3(balance - movement.amount);
      lines.push({
        entryNo: movement.entryNo,
        date: movement.date,
        description: movement.description,
        counterpart: accountName(movement.debitCode),
        debit: 0,
        credit: movement.amount,
        balance,
      });
    }
  }

  return { opening, lines, closing: balance };
}

/* ------------------------------------------------------------------ */
/* المشاريع                                                            */
/* ------------------------------------------------------------------ */

export function projectSummary(movements: Movement[], projectName: string) {
  let revenue = 0;
  let cost = 0;

  for (const movement of movements) {
    if (movement.project !== projectName) continue;
    if (!validate(movement).valid) continue;

    const debit = getAccount(movement.debitCode);
    const credit = getAccount(movement.creditCode);

    if (credit?.type === TYPE_REVENUE) revenue += movement.amount;
    if (debit?.type === TYPE_REVENUE) revenue -= movement.amount;
    if (debit?.type === TYPE_EXPENSE) cost += movement.amount;
    if (credit?.type === TYPE_EXPENSE) cost -= movement.amount;
  }

  revenue = round3(revenue);
  cost = round3(cost);
  return { revenue, cost, net: round3(revenue - cost) };
}

/* ------------------------------------------------------------------ */
/* عقود المقاولين                                                      */
/* ------------------------------------------------------------------ */

/** حساب أجور المقاولين — البند الافتراضي لدفعات العقود */
export const CONTRACTOR_EXPENSE = "5120";

/** حساب إيرادات المقاولات — الطرف الدائن في قبض دفعات العملاء */
export const CLIENT_REVENUE = "4110";

/**
 * اتّجاه الحركة على العقد: ما يزيد المنفَّذ منه، وما يردّه.
 *
 * العقد نوعان والقيد فيهما معكوس: دفعة المقاول تجعل المصروف مديناً،
 * ودفعة العميل تجعل الإيراد دائناً. فلو حُسبا بقاعدةٍ واحدة لظهر
 * مقبوضُ العميل بالسالب — وهو ما كان يقع قبل أن يُربط قبضٌ بعقد.
 *
 * والردّ في الحالتين عكس دفعته فيُخصم: إرجاع مقاولٍ مبلغاً، أو
 * إلغاء قبضٍ من عميل.
 */
function contractSign(m: Movement): number {
  const debit = getAccount(m.debitCode)?.type;
  const credit = getAccount(m.creditCode)?.type;
  if (debit === TYPE_EXPENSE) return 1; // دفعةٌ لمقاول أو مورّد
  if (credit === TYPE_REVENUE) return 1; // قبضٌ من عميل
  if (debit === TYPE_REVENUE) return -1; // إلغاء قبض
  return -1; // ردٌّ من المقاول، أو قيدٌ عكسي
}

/**
 * ما دُفع فعلاً على عقد — أو ما قُبض منه إن كان عقد عميل — محسوباً من
 * قيود الدفع المرتبطة به لا من حالة الدفعة المكتوبة يدوياً.
 */
export function contractPayments(movements: Movement[], contractNumber: string) {
  const linked = movements.filter(
    (m) => m.contractNumber === contractNumber && validate(m).valid
  );

  const byInstallment = new Map<number, number>();
  let total = 0;

  for (const m of linked) {
    const sign = contractSign(m);
    const amount = round3(sign * m.amount);
    total += amount;

    /* التوزيع إن وُجد يُنسب كلُّ حصّةٍ إلى دفعتها، وإلا فالمبلغ كلّه لدفعةٍ واحدة */
    const splits = m.installmentSplits ?? [];
    if (splits.length > 0) {
      for (const part of splits) {
        const share = round3(sign * (Number(part.amount) || 0));
        const no = Number(part.number) || 0;
        byInstallment.set(no, round3((byInstallment.get(no) ?? 0) + share));
      }
      continue;
    }

    const no = m.installmentNumber ?? 0;
    byInstallment.set(no, round3((byInstallment.get(no) ?? 0) + amount));
  }

  return { total: round3(total), byInstallment, movements: linked };
}

/** حركات مرشّحة للربط بعقد: مصروف مقاولين على نفس المشروع وغير مرتبطة بعد */
export function unlinkedContractorMovements(
  movements: Movement[],
  project: string
) {
  return movements.filter(
    (m) =>
      !m.contractNumber &&
      m.debitCode === CONTRACTOR_EXPENSE &&
      (!project || m.project === project) &&
      /* دفعات ٢٠٢٥ المُقفلة لا تُربط بعقدٍ ولا مشروع */
      !isClosedContractorPayment(m) &&
      validate(m).valid
  );
}

/**
 * حركاتٌ مربوطة برقم عقدٍ لم يعد موجوداً.
 *
 * تنشأ حين يُحذف عقدٌ وحركاته مربوطةٌ به: يبقى الرقم فيها ولا عقدَ له،
 * فتسقط من كل كشف — لا هي في عقدٍ ولا بين غير المرتبطة. وأخطر من ذلك
 * أن يُنشأ عقدٌ جديد بالرقم نفسه فتلتصق به صامتةً.
 */
export function orphanContractLinks(
  movements: Movement[],
  contractNumbers: string[]
): Movement[] {
  const known = new Set(contractNumbers);
  return movements.filter(
    (m) => Boolean(m.contractNumber) && !known.has(m.contractNumber as string)
  );
}

/**
 * حركات مرشّحة للربط بعقد مورّد: أي تكلفة تنفيذٍ مباشرة على المشروع.
 *
 * عقد المقاول دفعاته على حسابٍ واحد معروف (أجور المقاولين)، أما المورّد
 * فيُشترى منه بحسب ما ورّد: موادّ، وإيجار معدات، وماء وكهرباء للموقع.
 * فيُعرض مصروف المشروع المباشر كلّه ويختار صاحب القرار.
 */
export function unlinkedSupplierMovements(
  movements: Movement[],
  project: string
) {
  return movements.filter(
    (m) =>
      !m.contractNumber &&
      getAccount(m.debitCode)?.type === TYPE_EXPENSE &&
      m.debitCode.startsWith("5") &&
      (!project || m.project === project) &&
      !isClosedContractorPayment(m) &&
      validate(m).valid
  );
}

/**
 * حركات مرشّحة للربط بعقد عميل: قبضٌ على حساب الإيراد وغير مرتبط بعد،
 * على مشروع العقد نفسه.
 *
 * ومالُ مشروعٍ لا يُعرض على عقد مشروعٍ آخر بحال — وإنما يبقى بابٌ
 * واحد: القبض القديم الذي كُتب على «عام» و«مصروفات مشتركة» قبل أن
 * تُفتح المشاريع، فذاك غير منسوبٍ إلى مشروعٍ أصلاً، ويُطلب صراحةً
 * حين يُراد نسبُه إلى عقده.
 */
export function unlinkedClientReceipts(
  movements: Movement[],
  project = "",
  includeUnassigned = false
) {
  return movements.filter(
    (m) =>
      !m.contractNumber &&
      m.creditCode === CLIENT_REVENUE &&
      (!project ||
        m.project === project ||
        (includeUnassigned && isNonProject(m.project))) &&
      validate(m).valid
  );
}

/* ------------------------------------------------------------------ */
/* السلف والعهد                                                        */
/* ------------------------------------------------------------------ */

/** 1140 عهد الموظفين · 1240 سلف الموظفين */
export const ADVANCE_ACCOUNTS = ["1140", "1240"];

export type AdvanceLine = {
  movement: Movement;
  account: string;
  /** تسليم عهدة أو سلفة للموظف */
  given: number;
  /** صرف من العهدة أو سداد السلفة */
  settled: number;
  balance: number;
};

export type AdvanceRow = {
  person: string;
  given: number;
  settled: number;
  /** موجب = بذمة الموظف مبلغ للشركة · سالب = الشركة مدينة له */
  balance: number;
  accounts: string[];
  lines: AdvanceLine[];
};

/**
 * يجمع حركات العهد والسلف حسب الموظف.
 *
 * تسليم العهدة يجعل حساب الموظف مديناً، والصرف منها يجعله دائناً،
 * فالرصيد الموجب يعني أن بذمته مبلغاً لم يُصرف أو يُردّ بعد.
 */
export function buildAdvances(movements: Movement[]) {
  const byPerson = new Map<string, AdvanceRow>();
  const unnamed: Movement[] = [];

  for (const movement of movements) {
    if (!validate(movement).valid) continue;

    const debitHit = ADVANCE_ACCOUNTS.includes(movement.debitCode);
    const creditHit = ADVANCE_ACCOUNTS.includes(movement.creditCode);
    if (!debitHit && !creditHit) continue;

    const person = (movement.person || "").trim();
    if (!person) {
      unnamed.push(movement);
      continue;
    }

    const account = debitHit ? movement.debitCode : movement.creditCode;
    const given = debitHit ? movement.amount : 0;
    const settled = creditHit ? movement.amount : 0;

    const row =
      byPerson.get(person) ??
      ({
        person,
        given: 0,
        settled: 0,
        balance: 0,
        accounts: [],
        lines: [],
      } as AdvanceRow);

    row.given = round3(row.given + given);
    row.settled = round3(row.settled + settled);
    row.balance = round3(row.given - row.settled);
    if (!row.accounts.includes(account)) row.accounts.push(account);
    row.lines.push({ movement, account, given, settled, balance: row.balance });

    byPerson.set(person, row);
  }

  const rows = [...byPerson.values()].sort(
    (a, b) => Math.abs(b.balance) - Math.abs(a.balance)
  );

  const totals = {
    given: round3(rows.reduce((s, r) => s + r.given, 0)),
    settled: round3(rows.reduce((s, r) => s + r.settled, 0)),
    balance: round3(rows.reduce((s, r) => s + r.balance, 0)),
  };

  return { rows, totals, unnamed };
}

/* ------------------------------------------------------------------ */
/* الترتيب والترحيل بين السنوات                                        */
/* ------------------------------------------------------------------ */

export function sortMovements(movements: Movement[]): Movement[] {
  return [...movements].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.entryNo - b.entryNo;
  });
}

/**
 * يبني أرصدة افتتاحية للسنة التالية من أرصدة إقفال السنة الحالية:
 * حسابات المركز المالي تُرحّل بأرصدتها، وصافي نتيجة السنة يُقفل في
 * الأرباح المرحّلة، فلا تُرحّل حسابات الإيرادات والمصروفات.
 */
export function rollForward(totals: Totals, netProfit: number): YearOpening {
  const next: YearOpening = {};

  for (const account of POSTABLE_ACCOUNTS) {
    if (isResultAccount(account)) continue;

    let signed = signedBalance(totals[account.code]);
    if (account.code === RETAINED_EARNINGS) signed = round3(signed - netProfit);
    if (isZero(signed)) continue;

    next[account.code] = {
      debit: signed > 0 ? String(round3(signed)) : "",
      credit: signed < 0 ? String(round3(-signed)) : "",
    };
  }

  return next;
}
