"use client";

import {
  Dispatch,
  Fragment,
  ReactNode,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Account,
  AccountType,
  CHART_OF_ACCOUNTS,
  CONTRACTOR_EXPENSE,
  InstallmentSplit,
  GENERATED_CHART,
  GENERATED_ITEMS,
  GENERATED_PAYMENTS,
  ApprovalState,
  approvedOnly,
  ITEM_MAP,
  ItemDefinition,
  PaymentMethod,
  configureMasterData,
  Movement,
  OpeningBalances,
  PAYMENT_MAP,
  POSTABLE_ACCOUNTS,
  UNMAPPED_ITEMS,
  YearOpening,
  accountName,
  availableYears,
  buildAdvances,
  buildBalanceSheet,
  buildCashFlow,
  buildEquityStatement,
  buildIncomeStatement,
  buildLedger,
  buildTrialBalance,
  cashPerAccounts,
  computeTotals,
  contractPayments,
  deriveEntry,
  describePeriod,
  fullYearPeriod,
  isFullYear,
  movementsInPeriod,
  periodOpening,
  type Period,
  findBrokenMovements,
  fiscalYearOf,
  fmt,
  getAccount,
  isCash,
  isZero,
  itemAccount,
  monthlyExpenses,
  movementsOfYear,
  projectLifetimeAnalysis,
  nearlyEqual,
  openingOfYear,
  openingOnResultAccounts,
  openingTotals,
  projectSummary,
  rollForward,
  round3,
  sortMovements,
  unknownPaymentMethods,
  unlinkedContractorMovements,
  unlinkedClientReceipts,
  unlinkedSupplierMovements,
  orphanContractLinks,
  CLIENT_REVENUE,
  validate,
} from "@/lib/accounting";
import { amountInWords } from "@/lib/arabic-numbers";
import {
  ATTENDANCE_STATUSES,
  AttendanceDay,
  AttendanceStatus,
  DEPARTMENTS,
  Employee,
  PayrollRun,
  PayrollLine,
  PayrollSettings,
  WEEK_DAYS,
  WageType,
  wageAccountOf,
  computePayrollLine,
  dailyWage,
  defaultPayrollSettings,
  defaultWageAccount,
  endOfService,
  hourlyWage,
  monthLabel,
  EMPLOYEE_ADVANCE_ACCOUNT,
  payrollTotals,
  totalAllowances,
} from "@/lib/payroll";
import {
  CLIENT_CONTRACT_DEFAULTS,
  CLIENT_FIRST_PARTY_DUTIES,
  CLIENT_SECOND_PARTY_DUTIES,
  CONTRACT_DEFAULTS,
  DEFAULT_CLAUSES,
  DEFAULT_NOTES,
  DEFAULT_OBLIGATIONS,
  DOCUMENT_TYPES,
  CLIENT_FIRST_CLAUSE,
  clientClosingClauses,
  clientDurationClause,
  clientPreambleTemplate,
  closingClauses,
  preambleTemplate,
} from "@/lib/contract-template";
import {
  AUDIT_LIMIT,
  AuditAction,
  AuditEntity,
  AuditEntry,
  appendEntry,
  mergeAudit,
  emptyAuditFilter,
  filterAudit,
  formatAuditTime,
  makeEntry,
} from "@/lib/audit";
import {
  ExportTable,
  downloadText,
  safeFileName,
  toCSV,
} from "@/lib/export";
import {
  ALL_PERMISSIONS,
  PAGE_PERMISSION,
  PERMISSION_CATALOGUE,
  Permission,
  ROLES,
  RoleKey,
  can,
  roleDefinition,
} from "@/lib/permissions";
import {
  BackupMeta,
  backupDue,
  chooseBackupFile,
  daysSince,
  linkedFileName,
  readBackupMeta,
  saveToLinkedFile,
  supportsDirectSave,
  unlinkFile,
  writeBackupMeta,
} from "@/lib/file-backup";
import {
  CompanyProfile,
  ContractClause,
  Contractor,
  DEFAULT_PEOPLE,
  Installment,
  isPayableInstallment,
  installmentNet,
  installmentDeduction,
  Material,
  MaterialReceipt,
  Project,
  User,
  YearLocks,
  backupFileName,
  defaultCompany,
  hashPin,
  applyRestorePoint,
  emptyState,
  exportBackup,
  isYearClosed,
  readRestorePoint,
  loadState,
  newId,
  parseBackup,
  normalizeState,
  receiptCost,
  saveState,
  COUNTERPARTY_TYPES,
  type CounterpartyType,
} from "@/lib/storage";
import {
  fetchServerState,
  pushDeletions,
  onIncoming,
  type Incoming,
  record as recordForSync,
  rememberLoaded,
  setSyncEnabled,
  startSync,
  stopSync,
  subscribe as subscribeSync,
  syncEnabled,
  type SyncStatus,
} from "@/lib/sync";
import { compareStates, type FieldComparison } from "@/lib/changes";
import { ROW_COLLECTIONS } from "@/lib/collections";
import { isAdminExpenseToGeneral } from "@/lib/admin-to-general";
import {
  findDuplicateMovements,
  duplicateSignature,
  DUPLICATE_WINDOW_DAYS,
} from "@/lib/duplicates";
import { isAluminiumOnSalaries, isCarPaintOnGovFees } from "@/lib/account-corrections";
import {
  CLOSED_PAYMENT_REASON,
  isClosedContractorPayment,
} from "@/lib/closed-payments";
import {
  changePassword,
  signIn as serverSignIn,
  signOut as serverSignOut,
  whoAmI,
  type ServerUser,
} from "@/lib/server-session";
import {
  HIDDEN_LOCK_MS,
  IDLE_LOCK_MS,
  forgetUser,
  lastUser,
  rememberUser,
} from "@/lib/session";
import {
  REQUIRED_STREAK,
  comparedToday,
  matchRuns,
  recordMatch,
  verdict,
  type MatchRun,
} from "@/lib/match-log";
import { todayISO } from "@/lib/today";
import type { AppState } from "@/lib/storage";
import {
  COST_STALE_DAYS,
  ESSENTIAL_DRAFT,
  QUOTATION_DEFAULTS,
  QUOTATION_STATUSES,
  applyEssentialDraft,
  applyMarkup,
  PRICING_MODES,
  PricingMode,
  clearChoices,
  customLine,
  ContractTerms,
  StagePart,
  installmentsFromQuotation,
  partTotal,
  sectionsOfStage,
  isFreeFormScope,
  quotationAgeDays,
  selectAllChoices,
  stageTotals,
  costAgeDays,
  isCostStale,
  markupPrice,
  Quotation,
  QuotationLine,
  QuotationStatus,
  SCOPES,
  STAGES,
  WorkItem,
  exclusions,
  lineCost,
  linePrice,
  linesForScope,
  nextQuotationNumber,
  quotationTotals,
  stagesOfScope,
  validUntil,
  daysLeft,
  isBindingQuotation,
  isExpired,
  partitionExpired,
} from "@/lib/quotations";
import {
  allDurations,
  SOON_DAYS,
} from "@/lib/contract-dates";
import {
  PayeeGroup,
  groupCandidates,
  linkSummary,
  linkedByInstallment,
  normalizeArabic,
  planLinks,
} from "@/lib/contract-links";
import {
  Notice,
  NoticeTone,
  activitySince,
  buildNotices,
  INSURANCE_ALERT_DAYS,
  projectInsurance,
} from "@/lib/notifications";
import {
  Invoice,
  InvoiceLine,
  installmentLabel,
  invoiceTotal,
  nextInvoiceNumber,
} from "@/lib/invoices";

const PAGES = [
  "الرئيسية",
  "إدخال حركة",
  "جدول الحركات",
  "القيود اليومية",
  "دفتر الأستاذ",
  "ميزان المراجعة",
  "القوائم المالية",
  "التقارير",
  "المشاريع",
  "عروض الأسعار",
  "بنود الأعمال",
  "الفواتير",
  "المقاولون",
  "ربط الحركات",
  "اعتماد الحركات",
  "اعتماد المراحل",
  "متابعة السلف",
  "استلام المواد",
  "الموظفون",
  "الحضور والانصراف",
  "مسيّر الرواتب",
  "دليل الحسابات",
  "البيانات الأساسية",
  "الأرصدة الافتتاحية",
  "المستخدمون",
  "سجل التدقيق",
  "مطابقة الخادم",
  "الإعدادات",
];

const MOVEMENT_TYPES = [
  "مصروف",
  "إيرادات",
  "إيداع",
  "سلفة",
  "سداد سلفة",
  "تحويل",
  "شراء أصل",
  "عهد موظفين",
];

export default function HomeV2() {
  const [page, setPage] = useState("الرئيسية");
  /** لوحة تغيير رقم الدخول مفتوحة؟ */
  const [changingPassword, setChangingPassword] = useState(false);
  /** وقت الدخول السابق، مثبَّت عند الدخول — مرجع «ما جرى في غيابك» */
  const [sessionLastSeen, setSessionLastSeen] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  /** ما مُحي من العروض عند هذه الفتحة — يُعرض مرةً ثم يُخفى */
  const [expiredQuotes, setExpiredQuotes] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [movements, setMovements] = useState<Movement[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [openingBalances, setOpeningBalances] = useState<OpeningBalances>({});
  const [materials, setMaterials] = useState<Material[]>([]);
  const [materialReceipts, setMaterialReceipts] = useState<MaterialReceipt[]>([]);
  const [company, setCompany] = useState<CompanyProfile>(defaultCompany());
  const [year, setYear] = useState<number>(0);
  const [period, setPeriod] = useState<Period>(fullYearPeriod());
  /** الحركة المطلوب طباعة سند لها */
  const [voucherFor, setVoucherFor] = useState<Movement | null>(null);
  /** العقد المطلوب طباعته */
  const [contractFor, setContractFor] = useState<Contractor | null>(null);
  /** كشف الراتب المطلوب طباعته */
  const [payslip, setPayslip] = useState<{
    run: PayrollRun;
    line: PayrollLine;
  } | null>(null);
  const [backupMeta, setBackupMeta] = useState<BackupMeta | null>(null);
  const [linkedFile, setLinkedFile] = useState<string | null>(null);
  const [backupNotice, setBackupNotice] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  /* من دخل الخادم: هويّته وصلاحيته معاً، ولا شيء منهما من الجهاز */
  const [session, setSession] = useState<ServerUser | null>(null);
  const [askingSession, setAskingSession] = useState(true);
  /* الشاشة مقفلة والعمل تحتها باقٍ كما هو */
  const [locked, setLocked] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [yearLocks, setYearLocks] = useState<YearLocks>({});
  const [chart, setChart] = useState<Account[]>(GENERATED_CHART);
  const [items, setItems] = useState<ItemDefinition[]>(GENERATED_ITEMS);
  const [payments, setPayments] = useState<PaymentMethod[]>(GENERATED_PAYMENTS);
  const [people, setPeople] = useState<string[]>(DEFAULT_PEOPLE);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceDay[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [payrollSettings, setPayrollSettings] = useState<PayrollSettings>(
    defaultPayrollSettings()
  );
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceSheet, setInvoiceSheet] = useState<Invoice | null>(null);
  /** عرض السعر المفتوح للطباعة — internal يعني الورقة الداخلية بالتكلفة */
  const [quoteSheet, setQuoteSheet] = useState<{
    quotation: Quotation;
    internal: boolean;
  } | null>(null);
  /** الحركة قيد التعديل — فارغة يعني إدخال حركة جديدة */
  const [editing, setEditing] = useState<Movement | null>(null);

  useEffect(() => {
    const { state, errors } = loadState();
    /* ما قُرئ من التخزين يُعلَم به المزامنة قبل أن يمسّه النظام */
    rememberLoaded(state);
    setMovements(state.movements);
    setProjects(state.projects);
    setContractors(state.contractors);
    setOpeningBalances(state.openingBalances);
    setMaterials(state.materials);
    setMaterialReceipts(state.materialReceipts);
    setCompany(state.company);
    setUsers(state.users);
    setAudit(state.audit);
    setYearLocks(state.yearLocks);
    setChart(state.chart);
    setItems(state.items);
    setPayments(state.payments);
    setPeople(state.people);
    setEmployees(state.employees);
    setAttendance(state.attendance);
    setPayrollRuns(state.payrollRuns);
    setPayrollSettings(state.payrollSettings);
    setWorkItems(state.workItems);
    /*
      العروض التي انقضت مدّتها تُمحى عند الفتح.

      والمقبول منها لا يُمسّ وإن انقضى: هو أصل العقد وسندُه. والمسودة
      لا مدّة لها أصلاً — المدة تبدأ يوم يخرج العرض إلى العميل.

      ولا يقع ذلك صامتاً: يُذكر في سجل التدقيق، ويُعرض على الشاشة عند
      الفتح بأرقام ما مُحي. فالمحو الصامت أسوأ من بقاء الورق.
    */
    const quotes = partitionExpired(state.quotations, todayISO());
    setQuotations(quotes.kept);
    if (quotes.expired.length > 0) {
      const numbers = quotes.expired.map((q) => q.number).join("، ");
      setExpiredQuotes(quotes.expired.map((q) => `${q.number} — ${q.clientName || "بلا عميل"}`));
      setAudit((prev) =>
        appendEntry(
          prev,
          makeEntry(
            "النظام",
            "حذف",
            "بيانات النظام",
            `مُحيت ${quotes.expired.length} من عروض الأسعار لانقضاء صلاحيتها: ${numbers}`
          )
        )
      );
    }
    setInvoices(state.invoices);
    setLoadErrors(errors);
    setYear(availableYears(state.movements, state.openingBalances)[0]);
    setBackupMeta(readBackupMeta());
    linkedFileName().then(setLinkedFile);
    setLoaded(true);
  }, []);

  // الشاشات تتبدّل داخل الصفحة نفسها، فيبقى موضع التمرير من الشاشة السابقة.
  // كل انتقال يبدأ من أعلى الصفحة.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [page]);

  useEffect(() => {
    if (!loaded) return;
    const state = {
      movements,
      projects,
      contractors,
      openingBalances,
      materials,
      materialReceipts,
      company,
      users,
      audit,
      yearLocks,
      chart,
      items,
      payments,
      people,
      employees,
      attendance,
      payrollRuns,
      payrollSettings,
      workItems,
      quotations,
      invoices,
    };
    setSaveError(saveState(state));
    /*
      ثم يُبلَّغ الخادم — بعد الحفظ المحلّي لا قبله.

      فالمتصفّح هو المرجع في هذه المرحلة: إن سقط الخادم أو انقطع الخطّ
      لم يضع شيء، والحفظ تمّ قبل أن تُحاوَل المزامنة أصلاً.
    */
    recordForSync(state);
  }, [
    movements,
    projects,
    contractors,
    openingBalances,
    materials,
    materialReceipts,
    company,
    users,
    audit,
    yearLocks,
    chart,
    items,
    payments,
    people,
    employees,
    attendance,
    payrollRuns,
    payrollSettings,
    workItems,
    quotations,
    invoices,
    loaded,
  ]);

  /* -------------------------------------------------------------- */
  /* كل الأرقام تُشتق مرة واحدة، مقيّدة بالسنة المختارة               */
  /* -------------------------------------------------------------- */

  const years = useMemo(
    () => availableYears(movements, openingBalances),
    [movements, openingBalances]
  );

  /**
   * تحميل البيانات الأساسية في المحرّك قبل أي حساب.
   *
   * يعيد رقم إصدار يدخل في تبعيات كل الحسابات أدناه، فتُعاد بعد التحديث
   * لا قبله — وبدونه تبقى التقارير على الدليل القديم بعد تعديله.
   */
  const masterVersion = useMemo(
    () => configureMasterData({ accounts: chart, items, payments }),
    [chart, items, payments]
  );

  /**
   * الحركات المعتمدة وحدها.
   *
   * نقطة الحجب الوحيدة في النظام: كل ميزان وقائمة وتقرير يتفرّع من هنا،
   * فالحركة غير المعتمدة محفوظة كاملةً ولا تظهر في رقم واحد منها.
   */
  const approvedMovements = useMemo(() => approvedOnly(movements), [movements]);

  /** بانتظار الاعتماد أو مرفوضة — تُعرض في شاشتها وحدها */
  const pendingMovements = useMemo(
    () =>
      sortMovements(
        movements.filter((m) => m.approval === "بانتظار الاعتماد")
      ),
    [movements]
  );

  const allYearMovements = useMemo(
    () => sortMovements(movementsOfYear(approvedMovements, year)),
    [approvedMovements, year]
  );

  /**
   * رقم القيد التالي — من كل حركات السنة بلا استثناء.
   *
   * لا يُشتقّ من المعروض: الحركة غير المعتمدة محجوبة عن التقارير لكنها
   * حجزت رقمها، والفترة المختارة تُخفي حركات لم تُحذف. واشتقاقه من
   * المعروض يُنتج رقمين متطابقين لحركتين — وقد وقع ذلك فعلاً.
   */
  const nextEntryNo = useMemo(
    () =>
      movements
        .filter((m) => m.fiscalYear === year)
        .reduce((max, m) => Math.max(max, m.entryNo), 1000) + 1,
    [movements, year]
  );

  /** أرقام قيود تكرّرت داخل سنتها — تمنع ترقيم السندات وتلبس على المدقّق */
  const duplicateEntries = useMemo(() => {
    const byKey = new Map<string, Movement[]>();
    for (const m of movements) {
      const key = `${m.fiscalYear}/${m.entryNo}`;
      byKey.set(key, [...(byKey.get(key) ?? []), m]);
    }
    return [...byKey.entries()]
      .filter(([, rows]) => rows.length > 1)
      .map(([key, rows]) => ({ key, rows }));
  }, [movements]);

  const fiscalOpening = useMemo(
    () => openingOfYear(openingBalances, year),
    [openingBalances, year]
  );
  const openTotals = useMemo(
    () => openingTotals(fiscalOpening),
    [fiscalOpening]
  );

  /** حركات الفترة المختارة — كل الشاشات تعمل عليها */
  const yearMovements = useMemo(
    () => movementsInPeriod(allYearMovements, period),
    [allYearMovements, period, masterVersion]
  );

  /** افتتاحي الفترة = افتتاحي السنة + ما قبل بدايتها */
  const opening = useMemo(
    () =>
      periodOpening(
        allYearMovements,
        fiscalOpening,
        openTotals.balanced,
        period.from
      ),
    [allYearMovements, fiscalOpening, openTotals.balanced, period.from, masterVersion]
  );

  const totals = useMemo(
    () => computeTotals(yearMovements, opening, true),
    [yearMovements, opening, masterVersion]
  );

  /**
   * الميزانية تحتاج ربح السنة حتى نهاية الفترة لا ربح الفترة وحدها،
   * وإلا اختلّت المعادلة عند اختيار فترة جزئية.
   */
  const netProfitToDate = useMemo(() => {
    if (isFullYear(period)) return null;
    const toDate = movementsInPeriod(allYearMovements, {
      from: "",
      to: period.to,
    });
    return buildIncomeStatement(
      computeTotals(toDate, fiscalOpening, openTotals.balanced)
    ).netProfit;
  }, [allYearMovements, period, fiscalOpening, openTotals.balanced]);

  const broken = useMemo(
    () => findBrokenMovements(yearMovements),
    [yearMovements, masterVersion]
  );
  const trialBalance = useMemo(() => buildTrialBalance(totals), [totals, masterVersion]);
  const income = useMemo(() => buildIncomeStatement(totals), [totals, masterVersion]);
  const balanceSheet = useMemo(
    () => buildBalanceSheet(totals, netProfitToDate ?? income.netProfit),
    [totals, netProfitToDate, income.netProfit]
  );
  const cashFlow = useMemo(
    () => buildCashFlow(yearMovements, opening, true),
    [yearMovements, opening, masterVersion]
  );
  const cashByAccounts = useMemo(() => cashPerAccounts(totals), [totals, masterVersion]);
  const equity = useMemo(
    () => buildEquityStatement(totals, netProfitToDate ?? income.netProfit),
    [totals, netProfitToDate, income.netProfit]
  );

  const fullState = {
    movements,
    projects,
    contractors,
    openingBalances,
    materials,
    materialReceipts,
    company,
    users,
    audit,
    yearLocks,
    chart,
    items,
    payments,
    people,
    employees,
    attendance,
    payrollRuns,
    payrollSettings,
    workItems,
    quotations,
    invoices,
  };

  const activeUsers = users.filter((u) => u.active);

  /**
   * من أنت وما صلاحيتك — من الخادم لا من الجهاز.
   *
   * كان الحارس يجلس في المتصفّح: يقارن ما تكتبه بقائمةٍ في جهازك، ومن
   * فتح أدوات المطوّر قال له «أنا المالك» فصدّقه. فصار الجواب من
   * الخادم، والشاشة تُبنى على قوله، ويُفحص كل طلبٍ عنده مرةً أخرى.
   */
  const currentUser = session
    ? {
        name: session.name,
        jobTitle: session.jobTitle,
        role: session.role as RoleKey,
        permissions: session.permissions as Permission[],
      }
    : null;

  /**
   * صفّ المستخدم في بيانات الشركة — يُطابَق بالاسم.
   *
   * معرّف الخادم غير معرّف الجهاز، والاسم فريدٌ في الموضعين. وهذا الصفّ
   * لما يخصّ ملفّه هنا: آخر دخولٍ له، وتمييزه في شاشة المستخدمين.
   */
  const currentAccount: User | null = session
    ? activeUsers.find((u) => u.name === session.name) ?? null
    : null;
  const currentUserId = currentAccount?.id ?? null;

  const allow = (permission: Permission) => can(currentUser, permission);

  /** يسجّل تغييراً في سجل التدقيق باسم المستخدم الحالي */
  const log = (
    action: AuditAction,
    entity: AuditEntity,
    summary: string,
    change?: { before?: string; after?: string }
  ) =>
    setAudit((prev) =>
      appendEntry(
        prev,
        // يُستدعى دائماً بعد التحقق من المستخدم، والاحتياط هنا لإرضاء المدقّق
        makeEntry(currentUser?.name ?? "غير معروف", action, entity, summary, change)
      )
    );

  /** السنة المعروضة مقفلة؟ */
  const yearClosed = isYearClosed(yearLocks, year);

  /**
   * الحركة قابلة للتغيير؟ يُمنع التغيير في سنة مقفلة مهما كانت الصلاحية —
   * القفل قرار محاسبي فوق الصلاحيات، وفتحه إجراء صريح مسجَّل.
   */
  const movementEditable = (m: Movement) =>
    !isYearClosed(yearLocks, m.fiscalYear) &&
    /* دفعات المقاولين لسنة ٢٠٢٥ أُقفلت بقرار صاحب الشركة — lib/closed-payments.ts */
    !isClosedContractorPayment(m);

  /**
   * يختم الحركة بحالة اعتمادها.
   *
   * ما لا يتجاوز حدّ الاعتماد يُعتمد تلقائياً باسم من أدخله — والحدّ صفر
   * افتراضاً، أي أن كل شيء ينتظر حتى يرفعه صاحب الشركة من الإعدادات.
   */
  const stampApproval = (movement: Movement): Movement => {
    const limit = company.approvalThreshold;
    if (limit > 0 && movement.amount <= limit) {
      return {
        ...movement,
        approval: "معتمدة",
        approvedBy: currentUser?.name ?? "",
        approvedAt: new Date().toISOString(),
        approvalNote: `اعتماد تلقائي — لا يتجاوز ${fmt(limit)} د.ك`,
      };
    }
    return {
      ...movement,
      approval: "بانتظار الاعتماد",
      approvedBy: "",
      approvedAt: "",
      approvalNote: "",
    };
  };

  const describeMovement = (m: Movement) =>
    `قيد ${m.entryNo} · ${m.date} · ${fmt(m.amount)} د.ك · ${
      m.description || "بلا بيان"
    } · مدين ${m.debitCode} / دائن ${m.creditCode}`;

  /** الإشعارات — محسوبة لحظة العرض، ومصفّاة على صلاحيات صاحبها */
  /*
    ما يصل من الخادم — عملُ غيرك.

    يُدخَل في الشاشة صفّاً صفّاً: ما كُتب عندهم يحلّ محلّ نظيره، وما
    حُذف يزول. ولا يصل إلى هنا صفٌّ مسّه هذا الجهاز ولم يُرسل بعد —
    تلك تُسقطها المزامنة قبل التسليم، فلا يُمحى عملٌ تحت يد صاحبه.

    والصفوف تمرّ على المُرحِّل نفسه الذي يمرّ عليه الملف المستورد، فلا
    يدخل الشاشةَ صفٌّ بصورةٍ قديمة.
  */
  /*
    المزامنة تبدأ بعد الدخول لا قبله: الخادم لا يجيب من لا جلسة له،
    فلو بدأت قبله لدارت على بابٍ مغلق.

    وهي تعمل لكل من دخل بلا زرٍّ يُشعلها. ولو بقيت بزرٍّ — وهو في شاشةٍ
    لا يفتحها إلا صاحب الإعدادات — لعمل الموظف يومه كلَّه على جهازه ولم
    يصل عملُه إلى أحد، ولا مفتاح عنده ولا علم له.
  */
  useEffect(() => {
    if (!session) return;
    startSync();
  }, [session]);

  /* حالة الخادم تُعرض لكل من يعمل، لا في شاشة الإعدادات وحدها */
  const [serverState, setServerState] = useState<SyncStatus | null>(null);
  useEffect(() => subscribeSync(setServerState), []);

  /*
    أمِن الداخلين أنت؟ يُسأل الخادم عند الإقلاع، فالتصريح عنده لا عندنا.
    ولو كان الخطّ منقطعاً لم يدخل أحد — وذلك ثمن أن تكون الصلاحية منعاً
    لا إخفاءً، وقد أقرّه صاحب الشركة: الأجهزة تحمل إنترنتها.
  */
  useEffect(() => {
    void whoAmI().then((who) => {
      setSession(who);
      setAskingSession(false);
    });
  }, []);

  /*
    السكون يَقفل ولا يُخرج.
    
    الخروج يمحو ما في الشاشة، فمن كان يكتب حركةً ضاع ما كتب. والقفل
    ستارةٌ تُسدَل: ما تحتها باقٍ، ومن عاد أكمل من حيث وقف.
  */
  useEffect(() => {
    if (!session || locked) return;
    let last = Date.now();
    const bump = () => {
      last = Date.now();
    };
    const watched = ["mousedown", "keydown", "touchstart", "wheel", "scroll"];
    for (const name of watched) {
      window.addEventListener(name, bump, { passive: true });
    }
    const timer = window.setInterval(() => {
      if (Date.now() - last >= IDLE_LOCK_MS) setLocked(true);
    }, 20_000);
    return () => {
      for (const name of watched) window.removeEventListener(name, bump);
      window.clearInterval(timer);
    };
  }, [session, locked]);

  /*
    الهاتف: الصفحة تغيب حين تُقفل شاشته أو يخرج إلى تطبيقٍ آخر.
    
    فإن طالت غيبتها قُفلت. ولا تُقفل للحظةٍ يخرج فيها إلى الحاسبة
    ليقرأ رقماً ثم يعود — ومن أطفأ هاتفه ووضعه في جيبه فقد ترك جهازه.
  */
  useEffect(() => {
    if (!session) return;
    let goneAt = 0;
    const onVisibility = () => {
      if (document.hidden) {
        goneAt = Date.now();
        return;
      }
      if (goneAt && Date.now() - goneAt >= HIDDEN_LOCK_MS) setLocked(true);
      goneAt = 0;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [session]);

  useEffect(
    () =>
      onIncoming((incoming: Incoming) => {
        const normalized = normalizeState({
          ...incoming.upserts,
        } as Record<string, unknown>);

        const setters: Partial<
          Record<string, Dispatch<SetStateAction<Record<string, unknown>[]>>>
        > = {
          movements: setMovements as never,
          projects: setProjects as never,
          contractors: setContractors as never,
          materials: setMaterials as never,
          materialReceipts: setMaterialReceipts as never,
          users: setUsers as never,
          employees: setEmployees as never,
          attendance: setAttendance as never,
          payrollRuns: setPayrollRuns as never,
          workItems: setWorkItems as never,
          quotations: setQuotations as never,
          invoices: setInvoices as never,
          audit: setAudit as never,
        };

        for (const collection of ROW_COLLECTIONS) {
          const field = collection.field as string;
          const set = setters[field];
          if (!set) continue;

          const ups = (normalized[collection.field] ??
            []) as Record<string, unknown>[];
          const dels = new Set(incoming.deletes[field] ?? []);
          if (ups.length === 0 && dels.size === 0) continue;

          set((prev) => {
            const rows = new Map(
              prev.map((row) => [collection.keyOf(row), row] as const)
            );
            for (const row of ups) rows.set(collection.keyOf(row), row);
            for (const key of dels) rows.delete(key);
            return [...rows.values()];
          });
        }
      }),
    []
  );

  const notices = useMemo(
    () =>
      buildNotices({
        movements,
        contractors,
        projects,
        quotations,
        workItems,
        audit,
        backup: backupMeta,
        today: todayISO(),
        lastSeenAt: sessionLastSeen,
        userName: currentUser?.name ?? "",
        backupEveryDays: company.backupEveryDays,
      }).filter((n) => !n.needs || allow(n.needs)),
    [
      movements,
      contractors,
      projects,
      quotations,
      workItems,
      audit,
      backupMeta,
      sessionLastSeen,
      currentUser,
      company.backupEveryDays,
    ]
  );

  const activity = useMemo(
    () =>
      allow("audit.view")
        ? activitySince(audit, sessionLastSeen, currentUser?.name ?? "")
        : [],
    [audit, sessionLastSeen, currentUser]
  );

  const visiblePages = PAGES.filter((name) => {
    const needed = PAGE_PERMISSION[name];
    return !needed || allow(needed);
  });

  /** يحفظ في الملف المرتبط، وإلا ينزّل ملفاً جديداً */
  const runBackup = async () => {
    const content = exportBackup(fullState);
    const outcome = await saveToLinkedFile(content);

    if (outcome.ok) {
      setBackupMeta(writeBackupMeta(movements.length));
      setBackupNotice(`تم الحفظ في ${outcome.name}`);
      return;
    }
    if (outcome.reason === "denied") {
      setBackupNotice("رُفض الإذن بالكتابة — اختر ملف النسخة من جديد");
      return;
    }
    downloadText(backupFileName(), content, "application/json");
    setBackupMeta(writeBackupMeta(movements.length));
    setBackupNotice("تم تنزيل النسخة إلى مجلد التنزيلات");
  };

  const due = backupDue(backupMeta, movements.length);

  /** جداول جاهزة للتصدير، مقيّدة بالسنة والفترة المعروضتين */
  const exportTables: ExportTable[] = [
    {
      name: "الحركات",
      rows: [
        ["رقم القيد", "التاريخ", "نوع الحركة", "البيان", "البند", "رقم الحساب المدين", "الحساب المدين", "رقم الحساب الدائن", "الحساب الدائن", "المبلغ", "المشروع", "الدافع/المستلم", "طريقة الدفع", "الطرف"],
        ...yearMovements.map((m) => [
          m.entryNo,
          m.date,
          m.movementType,
          m.description,
          m.itemName,
          m.debitCode,
          accountName(m.debitCode),
          m.creditCode,
          accountName(m.creditCode),
          m.amount,
          m.project,
          m.person,
          m.paymentMethod,
          m.party,
        ]),
      ],
    },
    {
      name: "ميزان المراجعة",
      rows: [
        ["رقم الحساب", "اسم الحساب", "افتتاحي مدين", "افتتاحي دائن", "حركة مدين", "حركة دائن", "ختامي مدين", "ختامي دائن"],
        ...trialBalance.rows.map((r) => [
          r.account.code,
          r.account.name,
          r.openingDebit,
          r.openingCredit,
          r.periodDebit,
          r.periodCredit,
          r.closingDebit,
          r.closingCredit,
        ]),
        [
          "",
          "الإجمالي",
          trialBalance.totals.openingDebit,
          trialBalance.totals.openingCredit,
          trialBalance.totals.periodDebit,
          trialBalance.totals.periodCredit,
          trialBalance.totals.closingDebit,
          trialBalance.totals.closingCredit,
        ],
      ],
    },
    {
      name: "قائمة الدخل",
      rows: [
        ["القسم", "رقم الحساب", "اسم الحساب", "المبلغ"],
        ...income.revenues.map((r) => ["الإيرادات", r.code, r.name, r.amount]),
        ["", "", "إجمالي الإيرادات", income.totalRevenue],
        ...income.projectCosts.map((r) => ["تكاليف المشاريع", r.code, r.name, r.amount]),
        ["", "", "إجمالي تكاليف المشاريع", income.totalProjectCosts],
        ["", "", "مجمل الربح", income.grossProfit],
        ...income.adminExpenses.map((r) => ["مصروفات إدارية", r.code, r.name, r.amount]),
        ["", "", "إجمالي المصروفات الإدارية", income.totalAdminExpenses],
        ["", "", "صافي الربح / الخسارة", income.netProfit],
      ],
    },
    {
      name: "المركز المالي",
      rows: [
        ["القسم", "رقم الحساب", "اسم الحساب", "الرصيد"],
        ...balanceSheet.assets.map((r) => ["الأصول", r.code, r.name, r.amount]),
        ["", "", "إجمالي الأصول", balanceSheet.totalAssets],
        ...balanceSheet.liabilities.map((r) => ["الخصوم", r.code, r.name, r.amount]),
        ["", "", "إجمالي الخصوم", balanceSheet.totalLiabilities],
        ...balanceSheet.equityAccounts.map((r) => ["حقوق الملكية", r.code, r.name, r.amount]),
        ["", "", "صافي نتيجة الفترة", balanceSheet.netProfit],
        ["", "", "إجمالي حقوق الملكية", balanceSheet.totalEquity],
        ["", "", "إجمالي الخصوم وحقوق الملكية", balanceSheet.totalLiabilitiesAndEquity],
      ],
    },
    {
      name: "سجل استلام المواد",
      rows: [
        ["التاريخ", "المشروع", "المادة", "الكمية", "سعر الوحدة", "التكلفة", "المستلم"],
        ...materialReceipts
          .filter((r) => r.fiscalYear === year)
          .map((r) => [
            r.date,
            r.project,
            r.material,
            r.quantity,
            r.unitPrice ?? "",
            r.unitPrice == null ? "" : round3(r.quantity * r.unitPrice),
            r.receivedBy,
          ]),
      ],
    },
  ];

  const exportTable = (table: ExportTable) => {
    downloadText(
      safeFileName([table.name, String(year), describePeriod(period, year)], "csv"),
      toCSV(table.rows)
    );
  };

  if (!loaded) {
    return (
      <main dir="rtl" className="p-8 text-slate-500">
        جارٍ تحميل البيانات…
      </main>
    );
  }

  if (askingSession) {
    return (
      <main dir="rtl" className="p-8 text-slate-500">
        جارٍ التحقّق من الدخول…
      </main>
    );
  }

  if (!session || !currentUser) {
    return (
      <SignInScreen
        company={company}
        onIn={(who) => {
          setSession(who);
          /* الاسم وحده يُحفظ في الجهاز — والكلمة لا تُحفظ */
          rememberUser(who.name);
          const row = activeUsers.find((u) => u.name === who.name);
          /*
           * يُحتفظ بوقت دخوله السابق في الجلسة قبل استبداله في السجل،
           * فتُعرض عليه أفعال غيره التي جرت بينهما. ولو قرأناه من السجل
           * بعد التحديث لصار «الآن» ولما رأى شيئاً أبداً.
           */
          setSessionLastSeen(row?.lastSeenAt ?? "");
          if (row) {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === row.id
                  ? { ...u, lastSeenAt: new Date().toISOString() }
                  : u
              )
            );
          }
          setAudit((prev) =>
            appendEntry(
              prev,
              makeEntry(
                who.name,
                "دخول",
                "جلسة",
                `تسجيل دخول — ${who.jobTitle || roleDefinition(who.role as RoleKey).label}`
              )
            )
          );
        }}
      />
    );
  }

  /*
    من دخل بكلمةٍ أعطاه إياها المدير، أو برقمٍ من زمن المتصفّح، لا يرى
    شيئاً حتى يضع كلمةً يعرفها وحده. فالكلمة التي يعرفها غيرُك ليست
    كلمتك، وما يُفعل بها يُنسب إليك.
  */
  if (session.mustChangePassword) {
    return (
      <main dir="rtl" className="min-h-screen bg-slate-100 p-8 text-slate-900">
        <div className="mx-auto max-w-xl">
          <PasswordPanel
            forced
            onDone={async () => {
              setSession(await whoAmI());
            }}
            onCancel={async () => {
              await serverSignOut();
              setSession(null);
            }}
          />
        </div>
      </main>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-slate-100 text-slate-900">
      {locked && (
        <LockScreen
          name={session.name}
          onOpen={() => setLocked(false)}
          onOther={async () => {
            log("خروج", "جلسة", "تسجيل خروج من الشاشة المقفلة");
            stopSync();
            await serverSignOut();
            setSession(null);
            setLocked(false);
          }}
        />
      )}

      {/* الإخفاء على الغلاف الداخلي لا على main، وإلا اختفى السند معه */}
      <div
        className={`flex min-h-screen ${
          voucherFor || contractFor || payslip || quoteSheet || invoiceSheet
            ? "hide-when-printing"
            : ""
        }`}
      >
        {/* القائمة ثابتة على الشاشة: الجداول طويلة، ولولا التثبيت لاختفت
            وسيلة التنقّل عند النزول. self-start ضروري لأن عناصر flex
            تتمدّد بالكامل فلا يبقى للـ sticky مجال. */}
        <aside className="sticky top-0 h-screen w-72 shrink-0 self-start overflow-y-auto bg-slate-900 p-6 text-white no-print">
          <div className="mb-4">
            <h1 className="text-xl font-bold">Theyab Accounting</h1>
            <p className="mt-1 text-xs text-slate-400">النظام المالي والمحاسبي</p>
          </div>

          <div className="mb-4 rounded-lg bg-slate-800 p-3 text-sm">
            <div className="font-bold">{currentUser.name}</div>
            <div className="text-xs text-slate-400">
              {"jobTitle" in currentUser && currentUser.jobTitle
                ? currentUser.jobTitle
                : roleDefinition(currentUser.role).label}
            </div>
            {/*
              «اقفل الآن» لمن يقوم عن مكتبه: ستارةٌ تُسدَل في الحال،
              وعمله باقٍ تحتها فيعود ويكمل. وهو أنفع من مهلة السكون،
              لأنه في يد صاحبه لا في انتظار وقت.
            */}
            {/*
              حالة الخادم أمام عينه دائماً: من عمل ساعةً وهو منقطع
              يحسب عمله محفوظاً وهو في جهازه وحده. والرقم أصدق من
              كلمة: «٣ في الانتظار» تُفهم بلا شرح.
            */}
            {serverState && (
              <div className="mt-2 rounded bg-slate-900 px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">الخادم</span>
                  <span
                    className={
                      serverState.phase === "متزامنة"
                        ? "font-bold text-green-400"
                        : serverState.phase === "منقطعة"
                          ? "font-bold text-red-400"
                          : "font-bold text-amber-300"
                    }
                  >
                    {serverState.phase}
                  </span>
                </div>
                {serverState.pending > 0 && (
                  <div className="mt-1 text-amber-300">
                    {serverState.pending} في الانتظار
                  </div>
                )}
                {serverState.refused.length > 0 && (
                  <div className="mt-1 leading-5 text-red-300">
                    {serverState.refused[0].reason} — راجع المدير
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setLocked(true)}
              className="mt-2 w-full rounded bg-amber-600 px-3 py-1 text-xs font-bold hover:bg-amber-500"
            >
              اقفل الآن
            </button>
            <button
              onClick={() => setChangingPassword(true)}
              className="mt-2 w-full rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
            >
              تغيير كلمة المرور
            </button>
            <button
              onClick={async () => {
                log("خروج", "جلسة", "تسجيل خروج");
                stopSync();
                await serverSignOut();
                setSession(null);
              }}
              className="mt-2 w-full rounded bg-slate-700 px-3 py-1 text-xs hover:bg-slate-600"
            >
              تسجيل الخروج
            </button>
          </div>

          <nav className="space-y-1">
            {visiblePages.map((name) => {
              // شارة العدد على الشاشة التي يعالَج فيها الإشعار
              const badge = notices
                .filter((n) => n.page === name && n.count)
                .reduce((sum, n) => sum + (n.count ?? 0), 0);
              return (
              <button
                key={name}
                onClick={() => setPage(name)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-4 py-2 text-right text-sm transition ${
                  page === name
                    ? "bg-blue-600 font-bold text-white"
                    : "hover:bg-slate-800"
                }`}
              >
                <span>{name}</span>
                {badge > 0 && (
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                    {badge}
                  </span>
                )}
              </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 p-8 print-area">
          {/* ترويسة المطبوعات — لا تظهر على الشاشة */}
          <PrintHeader
            company={company}
            title={page}
            year={year}
            period={describePeriod(period, year)}
          />

          {changingPassword && (
            <div className="mb-6 max-w-xl">
              <PasswordPanel
                forced={false}
                onDone={async () => {
                  log("تعديل", "مستخدم", `${session.name} غيّر كلمة مروره`);
                  setChangingPassword(false);
                }}
                onCancel={async () => setChangingPassword(false)}
              />
            </div>
          )}

          <header className="mb-6 flex flex-wrap items-center justify-between gap-4 no-print">
            <div>
              <h2 className="text-3xl font-bold">
                {page === "الرئيسية" ? "لوحة المعلومات الرئيسية" : page}
              </h2>
              <p className="mt-2 text-slate-500">
                {yearMovements.length} حركة في السنة المالية {year}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => window.print()}
                className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white"
              >
                🖨 طباعة الصفحة
              </button>
              <label className="text-sm font-medium">السنة المالية</label>
              <select
                value={year}
                onChange={(e) => {
                  setYear(Number(e.target.value));
                  // تواريخ الفترة تخص سنتها، فتُمسح عند تبديل السنة
                  setPeriod(fullYearPeriod());
                }}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-bold shadow-sm"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </header>

          <PeriodBar year={year} period={period} setPeriod={setPeriod} />

          {!isFullYear(period) && (
            <Banner tone="warn">
              التقارير مقيّدة بالفترة: <b>{describePeriod(period, year)}</b> —{" "}
              {yearMovements.length} حركة من أصل {allYearMovements.length} في
              السنة. الأرصدة الافتتاحية المعروضة هي أرصدة بداية الفترة لا بداية
              السنة.
            </Banner>
          )}

          {due.due && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 no-print">
              <span>
                {backupMeta
                  ? `مضى ${due.days} يوماً على آخر نسخة احتياطية${
                      due.added ? ` وأُضيفت ${due.added} حركة بعدها` : ""
                    }.`
                  : "لم تأخذ نسخة احتياطية بعد — بياناتك في هذا المتصفح وحده."}
              </span>
              <button
                onClick={runBackup}
                className="rounded-lg bg-amber-900 px-5 py-2 font-bold text-white"
              >
                احفظ الآن
              </button>
            </div>
          )}

          {backupNotice && (
            <Banner tone={backupNotice.startsWith("تعذّر") ? "error" : "ok"}>
              {backupNotice}
              {!backupNotice.startsWith("تعذّر") &&
                backupMeta &&
                ` — ${new Date(backupMeta.at).toLocaleString("ar")}`}
            </Banner>
          )}

          {/*
            العنوان المجمَّد: لكل نشرٍ عنوانٌ فيه بصمته، يبقى على نسخته أبداً.
            والخادم يردّ كتابته، وهذا يقول لصاحبه لماذا قبل أن يعمل ساعةً
            فلا يصل شيءٌ منها. وعلى الجهاز لا يظهر.
          */}
          {typeof window !== "undefined" &&
          process.env.NEXT_PUBLIC_VERCEL_URL &&
          window.location.hostname === process.env.NEXT_PUBLIC_VERCEL_URL ? (
            <Banner tone="error">
              <b>هذا عنوانٌ مجمَّد.</b> يحمل نسخةً قديمة من النظام، ولا يكتب شيئاً في
              دفاتر الشركة — فما تعمله هنا لا يصل. أغلق هذا التبويب، وافتح النظام من
              العنوان الرئيسي المحفوظ في المفضّلة.
            </Banner>
          ) : null}

          {loadErrors.map((error) => (
            <Banner key={error} tone="error">
              {error}
            </Banner>
          ))}

          {expiredQuotes.length > 0 && (
            <Banner tone="warn">
              مُحيت <b>{expiredQuotes.length}</b> من عروض الأسعار لانقضاء
              صلاحيتها: {expiredQuotes.join(" · ")}. والمقبول منها لا يُمحى.
              <button
                type="button"
                onClick={() => setExpiredQuotes([])}
                className="mr-3 underline"
              >
                إخفاء
              </button>
            </Banner>
          )}
          {saveError && <Banner tone="error">{saveError}</Banner>}

          {yearClosed && (
            <Banner tone="warn">
              🔒 السنة المالية <b>{year}</b> مقفلة — أقفلها{" "}
              {yearLocks[String(year)]?.closedBy || "—"} في{" "}
              {yearLocks[String(year)]?.closedAt.slice(0, 10)}. لا تقبل أي إضافة
              أو تعديل أو حذف. الاطلاع والطباعة والتصدير تعمل كالمعتاد.
            </Banner>
          )}

          {broken.length > 0 && (
            <Banner tone="warn">
              <b>{broken.length}</b> حركة في {year} لا تُنتج قيداً صالحاً، وهي
              مستبعدة من التقارير.{" "}
              <button onClick={() => setPage("الإعدادات")} className="underline">
                عرض التفاصيل
              </button>
            </Banner>
          )}

          {!openTotals.balanced && !isZero(openTotals.debit + openTotals.credit) && (
            <Banner tone="warn">
              أرصدة {year} الافتتاحية غير متوازنة (مدين {fmt(openTotals.debit)}{" "}
              مقابل دائن {fmt(openTotals.credit)}) — لم تُعتمد في أي تقرير.
            </Banner>
          )}

          {page === "الرئيسية" && (
            <NoticesPanel
              notices={notices}
              activity={activity}
              lastSeenAt={sessionLastSeen}
              onGo={setPage}
            />
          )}

          {page === "الرئيسية" && (
            <Dashboard
              year={year}
              income={income}
              balanceSheet={balanceSheet}
              cash={cashByAccounts}
              trialBalance={trialBalance}
              movementCount={yearMovements.length}
            />
          )}

          {page === "إدخال حركة" && (
            <MovementForm
              year={year}
              projects={projects}
              movements={movements}
              contractors={contractors}
              people={people}
              editing={editing}
              lockedYears={yearLocks}
              onSave={(movement) => {
                if (isYearClosed(yearLocks, movement.fiscalYear)) return;
                /*
                  دفعة مقاولٍ جديدة على ٢٠٢٥ تُضاف إلى ما أُقفل — فتُرفض،
                  ويُقال لصاحبها لماذا بدل أن يضغط «حفظ» فلا يحدث شيء.
                */
                if (isClosedContractorPayment(movement)) {
                  window.alert(CLOSED_PAYMENT_REASON);
                  return;
                }
                const stamped = stampApproval(movement);
                setMovements((prev) => [...prev, stamped]);
                log(
                  "إنشاء",
                  "حركة",
                  `${describeMovement(stamped)} — ${stamped.approval}`
                );
              }}
              onUpdate={(movement) => {
                const old = movements.find((m) => m.id === movement.id);
                /*
                  يُفحص الطرفان: الحركة قبل التعديل وبعده. فلا تُعدَّل دفعة
                  مقفلة، ولا تُحوَّل حركةٌ من سنةٍ أخرى إلى دفعةٍ مقفلة.
                */
                if (
                  (old && isClosedContractorPayment(old)) ||
                  isClosedContractorPayment(movement)
                ) {
                  window.alert(CLOSED_PAYMENT_REASON);
                  return;
                }
                if (
                  isYearClosed(yearLocks, movement.fiscalYear) ||
                  (old && !movementEditable(old))
                ) {
                  return;
                }
                /*
                 * التعديل يُعيد الحركة إلى الانتظار: المجلس قرّر ألا يُغيَّر
                 * أمر إلا باعتماد، فالقيمة المعدَّلة تخرج من الدفاتر حتى
                 * تُقرّ — ولا تبقى في القوائم بصيغتها الجديدة بلا موافقة.
                 */
                const stamped = stampApproval(movement);
                setMovements((prev) =>
                  prev.map((m) => (m.id === movement.id ? stamped : m))
                );
                log("تعديل", "حركة", `قيد ${movement.entryNo} — ${stamped.approval}`, {
                  before: old ? describeMovement(old) : undefined,
                  after: describeMovement(stamped),
                });
                setEditing(null);
              }}
              onCancelEdit={() => setEditing(null)}
            />
          )}

          {page === "جدول الحركات" && (
            <MovementsTable
              movements={yearMovements}
              onEdit={(movement) => {
                setEditing(movement);
                setPage("إدخال حركة");
              }}
              onVoucher={setVoucherFor}
              editable={movementEditable}
              onDelete={(id) => {
                const gone = movements.find((m) => m.id === id);
                if (gone && !movementEditable(gone)) return;
                setMovements((prev) => prev.filter((m) => m.id !== id));
                if (gone) {
                  log("حذف", "حركة", `قيد ${gone.entryNo}`, {
                    before: describeMovement(gone),
                  });
                }
              }}
            />
          )}

          {page === "القيود اليومية" && <JournalPage movements={yearMovements} />}

          {page === "دفتر الأستاذ" && (
            <LedgerPage movements={yearMovements} totals={totals} />
          )}

          {page === "ميزان المراجعة" && (
            <TrialBalancePage report={trialBalance} year={year} />
          )}

          {page === "القوائم المالية" && (
            <FinancialsPage
              income={income}
              balanceSheet={balanceSheet}
              cashFlow={cashFlow}
              cashByAccounts={cashByAccounts}
              equity={equity}
            />
          )}

          {page === "التقارير" && (
            <ReportsPage
              movements={yearMovements}
              allMovements={movements}
              year={year}
              income={income}
            />
          )}

          {page === "المشاريع" && (
            <ProjectsPage
              projects={projects}
              movements={movements}
              year={year}
              today={todayISO()}
              canManage={allow("projects.manage")}
              setProjects={setProjects}
              openProject={(p) => setPage("حركات المشروع:" + p.name)}
            />
          )}

          {page.startsWith("حركات المشروع:") && (
            <ProjectMovementsPage
              projectName={page.slice("حركات المشروع:".length)}
              movements={movements}
              year={year}
              onBack={() => setPage("المشاريع")}
            />
          )}

          {page === "عروض الأسعار" && (
            <QuotationsPage
              quotations={quotations}
              workItems={workItems}
              year={year}
              canManage={allow("quotations.manage")}
              canSeeCost={allow("quotations.cost")}
              currentUserName={currentUser.name}
              setQuotations={setQuotations}
              onPrint={(quotation, internal) =>
                setQuoteSheet({ quotation, internal })
              }
              /*
                رقم العقد يُحسب هنا لا في شاشة الإبرام: المصدر واحد،
                فلا يختلف ما يراه عمّا يُكتب.
              */
              nextContractNumber={String(
                contractors
                  .map((c) => Number(c.contractNumber) || 0)
                  .reduce((max, n) => Math.max(max, n), 1000) + 1
              )}
              onConvert={(quotation, terms) => {
                if (!allow("contractors.manage")) {
                  window.alert("إنشاء العقد يحتاج صلاحية «إدارة العقود والدفعات».");
                  return null;
                }
                /*
                  العرض المنقضي لا يصير عقداً بضغطة.
                  أسعاره سعرُ شهرٍ مضى، والحديد والأسمنت لا ينتظران.
                */
                if (isExpired(quotation, todayISO())) {
                  const until = validUntil(quotation);
                  if (
                    !window.confirm(
                      `انقضت صلاحية العرض ${quotation.number} في ${until}.\n\n` +
                        "أسعاره سعر ذلك الوقت. راجعها قبل الإبرام.\n\n" +
                        "أتريد إبرام العقد على هذه الأسعار؟"
                    )
                  ) {
                    return null;
                  }
                }
                const totals = quotationTotals(quotation.lines, quotation.pricingMode);
                const rows = installmentsFromQuotation(quotation, terms);
                if (rows.length === 0) {
                  window.alert("لا توجد بنود مختارة بقيمة — راجع العرض أولاً.");
                  return null;
                }

                // ترقيم متسلسل يبدأ من 1001 كما في عقود الشركة المنقولة
                const top = contractors
                  .map((c) => Number(c.contractNumber) || 0)
                  .reduce((max, n) => Math.max(max, n), 1000);
                const number = String(top + 1);



                const scopeText =
                  quotation.scope === "تشطيب كامل"
                    ? "بناء الهيكل الأسود والتشطيب"
                    : quotation.scope === "نصف تشطيب"
                    ? "بناء الهيكل الأسود والنصف تشطيب"
                    : "بناء الهيكل الأسود";

                /*
                 * اسم المشروع: القسيمة تميّزه، واسم العميل يعرّفه. وبدون
                 * أحدهما يبقى الآخر — ولا يخرج اسم فارغ أبداً.
                 */
                const projectName =
                  [
                    quotation.plot && `قسيمة ${quotation.plot}`,
                    quotation.clientName,
                  ]
                    .filter(Boolean)
                    .join(" — ") || `عقد ${number}`;

                const contract: Contractor = {
                  id: newId(),
                  name: quotation.clientName,
                  specialty: quotation.scope,
                  phone: quotation.clientPhone,
                  project: projectName,
                  contractNumber: number,
                  contractType: "جاري التنفيذ",
                  workType: `عقد ${quotation.scope}`,
                  contractValue: totals.price,
                  installmentsCount: rows.filter((r) => !r.informational).length,
                  installments: rows.map((r) => ({
                    ...r,
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
                  counterpartyType: "عميل",
                  documentType: "عقد",
                  parentContractNumber: "",
                  contractDate: todayISO(),
                  civilId: quotation.clientCivilId,
                  passportNumber: "",
                  nationality: "",
                  address: quotation.clientAddress,
                  plot: quotation.plot,
                  block: quotation.block,
                  area: quotation.area,
                  licenseNumber: quotation.licenseNumber,
                  buildingDescription: quotation.buildingDescription,
                  durationDays:
                    quotation.durationDays || CLIENT_CONTRACT_DEFAULTS.durationDays,
                  delayPenaltyPerDay: CLIENT_CONTRACT_DEFAULTS.delayPenaltyPerDay,
                  maxPenaltyPercent: CLIENT_CONTRACT_DEFAULTS.maxPenaltyPercent,
                  terminationAfterDays:
                    CLIENT_CONTRACT_DEFAULTS.terminationAfterDays,
                  warrantyYears: CLIENT_CONTRACT_DEFAULTS.warrantyYears,
                  preamble: clientPreambleTemplate({
                    scope: scopeText,
                    area: quotation.area,
                    block: quotation.block,
                    plot: quotation.plot,
                    buildingDescription: quotation.buildingDescription,
                  }),
                  clauses: [],
                  obligations: CLIENT_SECOND_PARTY_DUTIES,
                  /*
                   * «ثانياً» يكتب قيمة العقد وحدها، إلا أن يُخصم منها
                   * عقد مكتب استشاري فيصير ثلاث نقاط كعقد عواطف:
                   * الإجمالية، ثم الخصم، ثم النهائية. وملاحظة النسختين
                   * بندٌ قائم في «الثاني عشر: العقد» فلا تُكرَّر هنا.
                   */
                  notes:
                    terms.consultancy > 0
                      ? [
                          `القيمة الإجمالية للعقد = ${round3(
                            totals.price + terms.consultancy
                          )} دينار كويتي لا غير.`,
                          "تم خصم قيمة عقد التراخيص والمخططات من القيمة الإجمالية لهذا العقد",
                          `القيمة النهائية للعقد = ${round3(
                            totals.price
                          )} دينار كويتي لا غير.`,
                        ].join("\n")
                      : "",
                };

                setContractors((prev) => [...prev, contract]);
                log(
                  "إنشاء",
                  "عقد",
                  `عقد عميل ${number} من عرض السعر ${quotation.number} — ${
                    quotation.clientName
                  } · ${fmt(totals.price)} د.ك · ${
                    rows.filter((r) => !r.informational).length
                  } دفعات${
                    terms.consultancy > 0
                      ? ` · خصم عقد استشاري ${fmt(terms.consultancy)}`
                      : ""
                  }`
                );

                /*
                 * المشروع يُنشأ مع العقد.
                 *
                 * بدونه يبقى العمل الجديد اسماً على العقد لا سجلاً، فلا يظهر
                 * في «المشاريع» ولا في تقرير الربحية، وتُقيَّد مصروفاته على
                 * مشروع لا وجود له. وميزانيته هي قيمة العقد نفسها، فبها يُقاس
                 * المنصرف إلى المتفق عليه.
                 */
                setProjects((prev) => {
                  if (prev.some((p) => p.name === projectName)) return prev;
                  return [
                    ...prev,
                    {
                      id: newId(),
                      name: projectName,
                      budget: totals.price,
                      startDate: contract.contractDate,
                      status: "نشط",
                    },
                  ];
                });

                if (!projects.some((p) => p.name === projectName)) {
                  log(
                    "إنشاء",
                    "مشروع",
                    `${projectName} — من عقد ${number} · ميزانيته ${fmt(
                      totals.price
                    )} د.ك · بدايته ${contract.contractDate}`
                  );
                }
                setQuotations((prev) =>
                  prev.map((q) =>
                    q.id === quotation.id
                      ? { ...q, contractNumber: number, status: "مقبول" }
                      : q
                  )
                );
                return number;
              }}
              onLog={log}
            />
          )}

          {page === "الفواتير" && (
            <InvoicesPage
              invoices={invoices}
              contractors={contractors}
              projects={projects}
              payments={payments}
              canManage={allow("invoices.manage")}
              currentUserName={currentUser.name}
              setInvoices={setInvoices}
              onPrint={setInvoiceSheet}
              onLog={log}
            />
          )}

          {page === "بنود الأعمال" && (
            <WorkItemsPage
              items={workItems}
              setItems={setWorkItems}
              canSeeCost={allow("quotations.cost")}
              canPrice={allow("quotations.pricing")}
              canManage={allow("quotations.manage")}
              currentUserName={currentUser.name}
              onLog={log}
            />
          )}

          {page === "المقاولون" && (
            <ContractorsPage
              contractors={contractors}
              projects={projects}
              /*
                العقد يمتدّ سنتين فأكثر، ودفعاته لا تُصفّى بالسنة
                المعروضة: عقدٌ دفعته الأولى في ٢٠٢٥ وباقيه في ٢٠٢٦ كان
                يظهر في كل سنةٍ ناقصاً دفعات الأخرى. فيُحسب على عمره
                كله — كما تُحسب ربحية المشروع.
              */
              movements={approvedMovements}
              company={company}
              setContractors={setContractors}
              canManage={allow("contractors.manage")}
              onPrint={setContractFor}
              onLog={log}
              onLink={(movementId, contractNumber, installmentNumber) =>
                setMovements((prev) =>
                  prev.map((m) =>
                    m.id === movementId
                      ? {
                          ...m,
                          contractNumber,
                          installmentNumber,
                          /* الربط بدفعةٍ واحدة يُلغي توزيعاً سابقاً، وكذلك فكّه */
                          installmentSplits: undefined,
                        }
                      : m
                  )
                )
              }
              /*
                حذف العقد يفكّ ربط حركاته حقاً — وكان يتركها مربوطةً برقمٍ
                لا عقد له، فتسقط من كل كشف.
              */
              onUnlinkContract={(contractNumber) =>
                setMovements((prev) =>
                  prev.map((m) =>
                    m.contractNumber === contractNumber
                      ? {
                          ...m,
                          contractNumber: undefined,
                          installmentNumber: undefined,
                          installmentSplits: undefined,
                        }
                      : m
                  )
                )
              }
              orphans={orphanContractLinks(
                movements,
                contractors.map((c) => c.contractNumber)
              )}
              onSplit={(movementId, contractNumber, splits) =>
                setMovements((prev) =>
                  prev.map((m) =>
                    m.id === movementId
                      ? {
                          ...m,
                          contractNumber,
                          installmentNumber: undefined,
                          installmentSplits: splits,
                        }
                      : m
                  )
                )
              }
            />
          )}

          {page === "ربط الحركات" && (
            <ContractLinksPage
              movements={movements}
              contractors={contractors}
              projects={projects.map((p) => p.name)}
              canManage={allow("contractors.manage")}
              onApply={(links) => {
                const map = new Map(links.map((l) => [l.movementId, l]));
                setMovements((prev) =>
                  prev.map((m) => {
                    const link = map.get(m.id);
                    return link
                      ? {
                          ...m,
                          contractNumber: link.contractNumber,
                          installmentNumber: link.installmentNumber || undefined,
                        }
                      : m;
                  })
                );
                const total = round3(
                  links.reduce((sum, l) => {
                    const m = movements.find((x) => x.id === l.movementId);
                    return sum + (Number(m?.amount) || 0);
                  }, 0)
                );
                log(
                  "تعديل",
                  "عقد",
                  `ربط ${links.length} حركة بقيمة ${fmt(total)} د.ك بالعقد ${
                    links[0]?.contractNumber
                  }`
                );
              }}
            />
          )}

          {page === "اعتماد الحركات" && (
            <MovementApprovalsPage
              pending={pendingMovements}
              rejected={movements.filter((m) => m.approval === "مرفوضة")}
              approverName={currentUser.name}
              canApprove={allow("movements.approve")}
              threshold={company.approvalThreshold}
              onEdit={(movement) => {
                setEditing(movement);
                setPage("إدخال حركة");
              }}
              onDecide={(movement, state, note) => {
                if (!allow("movements.approve")) return;
                if (isYearClosed(yearLocks, movement.fiscalYear)) return;
                const decided: Movement = {
                  ...movement,
                  approval: state,
                  approvedBy: state === "بانتظار الاعتماد" ? "" : currentUser.name,
                  approvedAt:
                    state === "بانتظار الاعتماد" ? "" : new Date().toISOString(),
                  approvalNote: note,
                };
                setMovements((prev) =>
                  prev.map((m) => (m.id === movement.id ? decided : m))
                );
                log(
                  state === "معتمدة" ? "اعتماد" : "إلغاء اعتماد",
                  "حركة",
                  `قيد ${movement.entryNo} — ${state}${note ? ` · ${note}` : ""}`,
                  {
                    before: movement.approval,
                    after: state,
                  }
                );
              }}
            />
          )}

          {page === "اعتماد المراحل" && (
            <ApprovalsPage
              contractors={contractors}
              projects={projects}
              /* المدفوع على العقد: المعتمد من كل السنوات */
              movements={approvedMovements}
              approverName={currentUser.name}
              canApprove={allow("contracts.approve")}
              canConfirm={allow("contracts.confirm")}
              setContractors={setContractors}
              onLog={log}
            />
          )}

          {page === "متابعة السلف" && (
            <AdvancesPage
              movements={yearMovements}
              year={year}
              onEdit={(movement) => {
                setEditing(movement);
                setPage("إدخال حركة");
              }}
            />
          )}

          {page === "استلام المواد" && (
            <MaterialsPage
              year={year}
              projects={projects}
              materials={materials}
              receipts={materialReceipts.filter((r) => r.fiscalYear === year)}
              setMaterials={setMaterials}
              setReceipts={setMaterialReceipts}
            />
          )}

          {page === "المستخدمون" && (
            <UsersPage
              users={users}
              setUsers={setUsers}
              currentUserId={currentUserId}
            />
          )}

          {page === "سجل التدقيق" && (
            <AuditPage audit={audit} onExport={exportTable} />
          )}

          {page === "مطابقة الخادم" && (
            <ServerMatchPage
              local={fullState}
              onAdoptAudit={(entries) =>
                setAudit((prev) => mergeAudit(prev, entries))
              }
            />
          )}

          {page === "الموظفون" && (
            <>
              <EmployeesPage
                employees={employees}
                projects={projects}
                settings={payrollSettings}
                setEmployees={setEmployees}
                onLog={log}
              />
              {allow("employees.manage") && (
                <PayrollSettingsPanel
                  settings={payrollSettings}
                  setSettings={setPayrollSettings}
                />
              )}
            </>
          )}

          {page === "الحضور والانصراف" && (
            <AttendancePage
              employees={employees}
              attendance={attendance}
              settings={payrollSettings}
              year={year}
              setAttendance={setAttendance}
              onLog={log}
            />
          )}

          {page === "مسيّر الرواتب" && (
            <PayrollPage
              employees={employees}
              movements={movements}
              attendance={attendance}
              settings={payrollSettings}
              runs={payrollRuns}
              year={year}
              yearLocks={yearLocks}
              canRun={allow("payroll.run")}
              currentUserName={currentUser.name}
              nextEntryNo={
                nextEntryNo
              }
              setRuns={setPayrollRuns}
              onPost={(run, posted) => {
                setMovements((prev) => [...prev, ...posted]);
                log(
                  "ترحيل",
                  "حركة",
                  `مسيّر رواتب ${monthLabel(run.month)} — ${posted.length} قيداً بإجمالي ${fmt(
                    round3(posted.reduce((s, m) => s + m.amount, 0))
                  )} د.ك`
                );
              }}
              onPayslip={(run, line) => setPayslip({ run, line })}
              onLog={log}
            />
          )}

          {page === "البيانات الأساسية" && (
            <MasterDataPage
              chart={chart}
              items={items}
              payments={payments}
              people={people}
              movements={movements}
              setChart={setChart}
              setItems={setItems}
              setPayments={setPayments}
              setPeople={setPeople}
              onLog={log}
            />
          )}

          {page === "دليل الحسابات" && <ChartPage />}

          {page === "الأرصدة الافتتاحية" && (
            <OpeningPage
              year={year}
              opening={opening}
              totals={openTotals}
              locked={yearClosed || !allow("opening.manage")}
              lockReason={
                yearClosed
                  ? `السنة المالية ${year} مقفلة — أرصدتها الافتتاحية للاطلاع فقط`
                  : "ليست لديك صلاحية تعديل الأرصدة الافتتاحية"
              }
              setYearOpening={(next) =>
                setOpeningBalances((prev) => ({ ...prev, [String(year)]: next }))
              }
            />
          )}

          {page === "الإعدادات" && (
            <SettingsPage
              year={year}
              years={years}
              state={{
                movements,
                projects,
                contractors,
                openingBalances,
                materials,
                materialReceipts,
                company,
                users,
                audit,
                yearLocks,
                chart,
                items,
                payments,
                people,
                employees,
                attendance,
                payrollRuns,
                payrollSettings,
                workItems,
                quotations,
                invoices,
              }}
              broken={broken}
              paymentGaps={unknownPaymentMethods(yearMovements)}
              onFix={(movement) => {
                setEditing(movement);
                setPage("إدخال حركة");
              }}
              duplicates={duplicateEntries}
              onFixDuplicates={() => {
                const total = duplicateEntries.reduce(
                  (s, d) => s + d.rows.length - 1,
                  0
                );
                if (
                  !window.confirm(
                    `إعادة ترقيم ${total} حركة؟\n\nتحتفظ الأقدم في كل مجموعة برقمها، وتأخذ البقية أرقاماً جديدة. لا يتغيّر مبلغ ولا تاريخ ولا حساب.`
                  )
                ) {
                  return;
                }

                // أعلى رقم مستعمل في كل سنة، فتبدأ الأرقام الجديدة بعده
                const topOfYear = new Map<number, number>();
                for (const m of movements) {
                  topOfYear.set(
                    m.fiscalYear,
                    Math.max(topOfYear.get(m.fiscalYear) ?? 1000, m.entryNo)
                  );
                }

                const renumbered = new Map<string, number>();
                for (const { rows } of duplicateEntries) {
                  // الأقدم إدخالاً تحتفظ برقمها، والباقي يُعاد ترقيمه
                  const ordered = [...rows].sort((a, b) =>
                    a.date === b.date ? 0 : a.date < b.date ? -1 : 1
                  );
                  for (const m of ordered.slice(1)) {
                    const next = (topOfYear.get(m.fiscalYear) ?? 1000) + 1;
                    topOfYear.set(m.fiscalYear, next);
                    renumbered.set(m.id, next);
                  }
                }

                setMovements((prev) =>
                  prev.map((m) =>
                    renumbered.has(m.id)
                      ? { ...m, entryNo: renumbered.get(m.id) as number }
                      : m
                  )
                );
                log(
                  "تعديل",
                  "حركة",
                  `إعادة ترقيم ${renumbered.size} حركة بأرقام قيود مكرّرة`,
                  {
                    before: duplicateEntries.map((d) => d.key).join("، "),
                    after: [...renumbered.values()].join("، "),
                  }
                );
              }}
              onBulkFix={(fix, targets, item) => {
                const ids = new Set(targets.map((m) => m.id));
                const before = targets[0]?.debitCode ?? "";
                /*
                  نقل المشروع وحده لا يمسّ الحساب ولا البند. والاعتماد لا
                  يُمسّ في الحالين — فالتصحيح قرار صاحب الشركة لا تعديل
                  يُعاد إلى الانتظار، ولو أُعيد لخرجت المصروفات من القوائم.
                */
                setMovements((prev) =>
                  prev.map((m) =>
                    ids.has(m.id)
                      ? fix.toAccount && item
                        ? {
                            ...m,
                            debitCode: fix.toAccount,
                            itemCode: item.code,
                            itemName: item.name,
                            project: fix.toProject ?? m.project,
                          }
                        : { ...m, project: fix.toProject ?? m.project }
                      : m
                  )
                );
                log(
                  "تعديل",
                  "حركة",
                  `تصحيح مجمّع: ${fix.title} — ${targets.length} حركة بمجموع ${fmt(
                    targets.reduce((s, m) => s + m.amount, 0)
                  )} د.ك`,
                  {
                    before: `الحساب ${before} · القيود ${targets
                      .map((m) => m.entryNo)
                      .join("، ")}`,
                    after: fix.toAccount
                      ? `الحساب ${fix.toAccount} — ${item?.name ?? ""}${
                          fix.toProject ? ` · ${fix.toProject}` : ""
                        }`
                      : `المشروع «${fix.toProject}» — الحساب والاعتماد كما هما`,
                  }
                );
              }}
              yearLocks={yearLocks}
              canClose={allow("year.close")}
              onToggleLock={(target, note) => {
                const closed = isYearClosed(yearLocks, target);
                setYearLocks((prev) => {
                  const next = { ...prev };
                  if (closed) delete next[String(target)];
                  else
                    next[String(target)] = {
                      closedAt: new Date().toISOString(),
                      closedBy: currentUser.name,
                      note,
                    };
                  return next;
                });
                log(
                  closed ? "تعديل" : "ترحيل",
                  "أرصدة افتتاحية",
                  closed
                    ? `فتح السنة المالية ${target} للتعديل`
                    : `إقفال السنة المالية ${target}${note ? ` — ${note}` : ""}`
                );
              }}
              onRollForward={() => {
                if (isYearClosed(yearLocks, year + 1)) return;
                const next = rollForward(totals, income.netProfit);
                const target = String(year + 1);
                if (
                  !window.confirm(
                    `ترحيل ${Object.keys(next).length} رصيداً من إقفال ${year} إلى افتتاحي ${
                      year + 1
                    }؟\n\nسيحل محل أي أرصدة افتتاحية مسجّلة لسنة ${year + 1}.`
                  )
                ) {
                  return;
                }
                setOpeningBalances((prev) => ({ ...prev, [target]: next }));
                log(
                  "ترحيل",
                  "أرصدة افتتاحية",
                  `ترحيل أرصدة إقفال ${year} إلى افتتاحي ${year + 1} — ${
                    Object.keys(next).length
                  } حساباً · صافي النتيجة ${fmt(income.netProfit)} د.ك`
                );
              }}
              onImport={(next) => {
                /*
                  الحقول الواحد والعشرون كلها — لا ستةٌ منها.

                  كان يستورد الحركات والمشاريع والعقود والأرصدة والمواد
                  واستلامها وحدها، واسمه «يستبدل كل شيء». فمن استعاد نسخته
                  على جهازٍ جديد وجد دفاتره وقد ذهب منها المستخدمون
                  والموظفون وحضورهم وعروض الأسعار والفواتير وبنود الأعمال
                  وسجل التدقيق وبيانات الشركة — ولا رسالة تقول له.

                  وأخطرها المستخدمون: بذهابهم لا تظهر شاشة الدخول أصلاً،
                  فيفتح النظام بكامل الصلاحيات بلا كلمة سرّ.
                */
                setMovements(next.movements);
                setProjects(next.projects);
                setContractors(next.contractors);
                setOpeningBalances(next.openingBalances);
                setMaterials(next.materials);
                setMaterialReceipts(next.materialReceipts);
                setCompany(next.company);
                setUsers(next.users);
                setAudit(next.audit);
                setYearLocks(next.yearLocks);
                setChart(next.chart);
                setItems(next.items);
                setPayments(next.payments);
                setPeople(next.people);
                setEmployees(next.employees);
                setAttendance(next.attendance);
                setPayrollRuns(next.payrollRuns);
                setPayrollSettings(next.payrollSettings);
                setWorkItems(next.workItems);
                setQuotations(next.quotations);
                setInvoices(next.invoices);
                setYear(availableYears(next.movements, next.openingBalances)[0]);
                log(
                  "استيراد",
                  "بيانات النظام",
                  `استبدال كامل للبيانات — ${next.movements.length} حركة · ${next.projects.length} مشروع · ${next.contractors.length} عقد`,
                  { before: `${movements.length} حركة قبل الاستيراد` }
                );
              }}
              company={company}
              setCompany={setCompany}
              backupMeta={backupMeta}
              linkedFile={linkedFile}
              backupNotice={backupNotice}
              onRunBackup={runBackup}
              onLinkFile={async () => {
                const outcome = await chooseBackupFile(backupFileName());
                if (outcome.ok) {
                  setLinkedFile(outcome.name);
                  setBackupNotice(`تم الربط بالملف ${outcome.name}`);
                  await runBackup();
                  return;
                }
                // إخفاء السبب يجعل المستخدم يرى نتيجة خاطئة دون تفسير
                setBackupNotice(`تعذّر الربط: ${outcome.reason}`);
              }}
              onUnlinkFile={async () => {
                await unlinkFile();
                setLinkedFile(null);
              }}
              exportTables={exportTables}
              onExport={exportTable}
              onImportEmployees={(next) =>
                setEmployees((prev) => {
                  // الدمج بالرقم المدني: لا نكرّر موظفاً مسجّلاً
                  const ids = new Set(prev.map((e) => e.civilId).filter(Boolean));
                  return [...prev, ...next.filter((e) => !ids.has(e.civilId))];
                })
              }
              onImportProjects={(next) =>
                setProjects((prev) => {
                  // المشروع القائم يُحدَّث بميزانيته وتاريخه، والجديد يُضاف
                  const merged = prev.map((p) => {
                    const found = next.find((n) => n.name === p.name);
                    return found
                      ? { ...p, budget: found.budget, startDate: found.startDate }
                      : p;
                  });
                  const names = new Set(prev.map((p) => p.name));
                  return [...merged, ...next.filter((n) => !names.has(n.name))];
                })
              }
              /*
                الاستيراد يضيف الجديد دائماً. و«التحديث» يستبدل نصَّ عقدٍ
                موجودٍ برقمه بما في الملف — يُستعمل حين يُصحَّح نقلُ عقدٍ
                عن أصله الموقّع. ويبقى معرّف العقد كما هو فلا تنقطع
                روابطه، وتبقى اعتمادات الدفعات المطابقة قيمةً وشرطاً،
                فالاعتماد قرار إداري لا ينقله ملفُ نصوص.
              */
              onImportContractors={(next, replaceExisting) =>
                setContractors((prev) => {
                  const numbers = new Set(prev.map((c) => c.contractNumber));
                  const kept = prev.map((old) => {
                    const fresh = replaceExisting
                      ? next.find(
                          (c) => c.contractNumber === old.contractNumber
                        )
                      : undefined;
                    if (!fresh) return old;
                    return {
                      ...fresh,
                      id: old.id,
                      installments: fresh.installments.map((i) => {
                        const was = old.installments.find(
                          (o) =>
                            o.value === i.value && o.condition === i.condition
                        );
                        if (!was) return i;
                        return {
                          ...i,
                          status: was.status,
                          approved: was.approved,
                          approvedBy: was.approvedBy,
                          approvedAt: was.approvedAt,
                          approvalNote: was.approvalNote,
                          confirmed: was.confirmed,
                          confirmedBy: was.confirmedBy,
                          confirmedAt: was.confirmedAt,
                          confirmNote: was.confirmNote,
                        };
                      }),
                    };
                  });
                  return [
                    ...kept,
                    ...next.filter((c) => !numbers.has(c.contractNumber)),
                  ];
                })
              }
              onImportMaterials={(nextMaterials, nextReceipts) => {
                // دمج بالمعرّف: يُبقي ما عندك ويضيف الجديد فقط
                setMaterials((prev) => {
                  const ids = new Set(prev.map((m) => m.id));
                  const names = new Set(prev.map((m) => m.name));
                  return [
                    ...prev,
                    ...nextMaterials.filter(
                      (m) => !ids.has(m.id) && !names.has(m.name)
                    ),
                  ];
                });
                setMaterialReceipts((prev) => {
                  const ids = new Set(prev.map((r) => r.id));
                  return [...prev, ...nextReceipts.filter((r) => !ids.has(r.id))];
                });
              }}
            />
          )}
        </section>
      </div>

      {payslip && (
        <PayslipSheet
          run={payslip.run}
          line={payslip.line}
          employee={employees.find((e) => e.id === payslip.line.employeeId)}
          company={company}
          onClose={() => setPayslip(null)}
        />
      )}

      {voucherFor && (
        <VoucherSheet
          movement={voucherFor}
          company={company}
          onClose={() => setVoucherFor(null)}
        />
      )}

      {invoiceSheet && (
        <InvoiceSheet
          invoice={invoiceSheet}
          company={company}
          onClose={() => setInvoiceSheet(null)}
        />
      )}

      {quoteSheet && (
        <QuotationSheet
          quotation={quoteSheet.quotation}
          company={company}
          internal={quoteSheet.internal}
          onClose={() => setQuoteSheet(null)}
        />
      )}

      {contractFor && (
        <ContractSheet
          contract={contractFor}
          company={company}
          onClose={() => setContractFor(null)}
        />
      )}
    </main>
  );
}

/* ================================================================== */
/* عناصر مشتركة                                                        */
/* ================================================================== */

function Banner({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "error";
  children: ReactNode;
}) {
  const styles = {
    ok: "bg-green-50 text-green-800 border-green-200",
    warn: "bg-amber-50 text-amber-900 border-amber-200",
    error: "bg-red-50 text-red-800 border-red-200",
  }[tone];
  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${styles}`}>
      {children}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
      {title && <h3 className="text-xl font-bold">{title}</h3>}
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      <div className={title ? "mt-5" : ""}>{children}</div>
    </div>
  );
}

function Money({ value, bold }: { value: number; bold?: boolean }) {
  return (
    <span
      className={`tabular-nums ${bold ? "font-bold" : ""} ${
        value < 0 ? "text-red-600" : ""
      }`}
    >
      {fmt(value)}
    </span>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none";

const Th = ({ children }: { children: ReactNode }) => (
  <th className="px-4 py-3 text-right font-bold">{children}</th>
);

const Td = ({
  children,
  colSpan,
  className = "",
}: {
  children: ReactNode;
  colSpan?: number;
  className?: string;
}) => (
  <td colSpan={colSpan} className={`px-4 py-3 ${className}`}>
    {children}
  </td>
);

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="py-8 text-center text-slate-500">{children}</p>
);

const accountLabel = (code: string) =>
  code ? `${code} — ${getAccount(code)?.name ?? "?"}` : "—";

/* ================================================================== */
/* شريط الفترة                                                         */
/* ================================================================== */

const pad2 = (n: number) => String(n).padStart(2, "0");
const lastDay = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

function PeriodBar({
  year,
  period,
  setPeriod,
}: {
  year: number;
  period: Period;
  setPeriod: Dispatch<SetStateAction<Period>>;
}) {
  const [open, setOpen] = useState(false);

  const monthRange = (month: number): Period => ({
    from: `${year}-${pad2(month)}-01`,
    to: `${year}-${pad2(month)}-${pad2(lastDay(year, month))}`,
  });

  const quarter = (q: number): Period => ({
    from: `${year}-${pad2(q * 3 - 2)}-01`,
    to: `${year}-${pad2(q * 3)}-${pad2(lastDay(year, q * 3))}`,
  });

  const presets: [string, Period][] = [
    ["السنة كاملة", fullYearPeriod()],
    ["الربع الأول", quarter(1)],
    ["الربع الثاني", quarter(2)],
    ["الربع الثالث", quarter(3)],
    ["الربع الرابع", quarter(4)],
    ["النصف الأول", { from: `${year}-01-01`, to: `${year}-06-30` }],
    ["النصف الثاني", { from: `${year}-07-01`, to: `${year}-12-31` }],
  ];

  const active = (p: Period) => p.from === period.from && p.to === period.to;

  return (
    <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 no-print">
      <div className="flex flex-wrap items-center gap-2">
        <span className="ml-2 text-sm font-bold">الفترة:</span>

        {presets.map(([label, value]) => (
          <button
            key={label}
            onClick={() => setPeriod(value)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              active(value)
                ? "bg-blue-600 text-white"
                : "bg-slate-100 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}

        <select
          value=""
          onChange={(e) => {
            if (e.target.value) setPeriod(monthRange(Number(e.target.value)));
          }}
          className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium"
        >
          <option value="">شهر محدّد…</option>
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setOpen(!open)}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            open ? "bg-slate-900 text-white" : "bg-slate-100 hover:bg-slate-200"
          }`}
        >
          فترة مخصّصة
        </button>

        <span className="mr-auto text-sm text-slate-500">
          {describePeriod(period, year)}
        </span>
      </div>

      {open && (
        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 md:grid-cols-3">
          <Field label="من تاريخ">
            <input
              type="date"
              value={period.from}
              onChange={(e) =>
                setPeriod((p) => ({ ...p, from: e.target.value }))
              }
              className={inputClass}
            />
          </Field>
          <Field label="إلى تاريخ">
            <input
              type="date"
              value={period.to}
              onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))}
              className={inputClass}
            />
          </Field>
          <div className="flex items-end">
            <button
              onClick={() => setPeriod(fullYearPeriod())}
              className="rounded-lg bg-slate-200 px-5 py-3 font-bold"
            >
              مسح الفترة
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* الطباعة                                                             */
/* ================================================================== */

/** ترويسة تظهر أعلى كل مطبوعة فقط — مخفية على الشاشة */
function PrintHeader({
  company,
  title,
  year,
  period,
}: {
  company: CompanyProfile;
  title: string;
  year: number;
  period: string;
}) {
  return (
    <div className="print-only mb-4 border-b-2 border-black pb-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {company.logo && (
            // صورة الشعار مخزّنة كـ data URL فتُطبع بلا اتصال
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo} alt="" style={{ height: 56 }} />
          )}
          <div>
            <div style={{ fontSize: "16pt", fontWeight: 700 }}>
              {company.name}
            </div>
            {company.nameEn && (
              <div style={{ fontSize: "9pt" }}>{company.nameEn}</div>
            )}
            <div style={{ fontSize: "8pt" }}>
              {[company.address, company.phone, company.email]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        </div>

        <div style={{ textAlign: "left", fontSize: "9pt" }}>
          <div style={{ fontSize: "13pt", fontWeight: 700 }}>{title}</div>
          <div style={{ fontWeight: 700 }}>{period}</div>
          <div>تاريخ الطباعة: {todayISO()}</div>
          {company.crNumber && <div>س.ت: {company.crNumber}</div>}
        </div>
      </div>
    </div>
  );
}

/** نوع السند: صرف إن خرجت النقدية، قبض إن دخلت */
function voucherKind(movement: Movement): "صرف" | "قبض" | null {
  if (isCash(movement.creditCode)) return "صرف";
  if (isCash(movement.debitCode)) return "قبض";
  return null;
}

/* ================================================================== */
/* قالب المستندات — الفاتورة وسندا الصرف والقبض                        */
/* ================================================================== */

/**
 * التنسيق المعتمد من مجلس الإدارة (نموذج INV-006).
 *
 * شريط علوي ذهبي · اسم الشركة يميناً والنوع بالإنجليزية يساراً ·
 * ثلاثة أعمدة بيانات يفصلها خطّان رأسيان · جدول بلا حدود داخلية ·
 * التوقيع والختم · تذييل بيج بالشعار وبيانات التواصل.
 *
 * المستندات الثلاثة تشترك فيه حرفياً — فما يتغيّر هو العنوان والبيانات
 * لا الشكل، وهذا نصّ قرار المجلس.
 */

const DOC_GOLD = "#a38b5d";
const DOC_GOLD_SOFT = "#c9b48a";
const DOC_BAND = "#efeae0";

type DocColumn = { label: string; value: string }[];

function DocSheet({
  company,
  titleAr,
  titleEn,
  reference,
  columns,
  lines,
  total,
  amountWords,
  footnote,
  onClose,
}: {
  company: CompanyProfile;
  titleAr: string;
  titleEn: string;
  reference: string;
  /** ثلاثة أعمدة من اليمين إلى اليسار كما في النموذج */
  columns: [DocColumn, DocColumn, DocColumn];
  lines: { description: string; amount: number }[];
  total: number;
  amountWords: string;
  footnote?: string;
  onClose: () => void;
}) {
  return (
    <div
      className="voucher-sheet fixed inset-0 z-50 overflow-auto bg-slate-800/60 p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="voucher-body designed-sheet mx-auto flex max-w-3xl flex-col bg-white shadow-xl"
        style={{ minHeight: "27cm" }}
      >
        <div className="flex justify-end gap-3 p-6 pb-0 no-print">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-slate-900 px-6 py-3 font-bold text-white"
          >
            🖨 طباعة
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-6 py-3 font-bold"
          >
            إغلاق
          </button>
        </div>

        {/* الشريط العلوي */}
        <div style={{ height: 14, background: DOC_GOLD_SOFT }} />

        <div className="flex-1 px-10 pt-8">
          {/* الترويسة */}
          <div className="flex items-start justify-between gap-6">
            <div
              style={{ color: DOC_GOLD }}
              className="text-4xl font-bold tracking-wide"
            >
              {titleEn}
            </div>
            <div className="text-left text-xl font-bold">{company.name}</div>
          </div>

          {/* أعمدة البيانات */}
          <div className="mt-10 flex justify-between gap-6">
            {columns.map((column, index) => (
              <div
                key={index}
                className="flex-1"
                style={
                  index < columns.length - 1
                    ? { borderInlineEnd: `2px solid ${DOC_BAND}`, paddingInlineEnd: 20 }
                    : undefined
                }
              >
                {column.map((row) => (
                  <div key={row.label} className="mb-3">
                    <div
                      style={{ color: DOC_GOLD }}
                      className="text-sm font-bold"
                    >
                      {row.label}
                    </div>
                    <div className="text-sm font-bold leading-snug">
                      {row.value || "—"}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* الجدول */}
          <table className="mt-10 w-full text-right">
            <thead>
              <tr style={{ color: DOC_GOLD }}>
                <th className="w-12 pb-2 text-right text-sm font-bold">م</th>
                <th className="pb-2 text-right text-sm font-bold">وصف الأعمال</th>
                <th className="w-40 pb-2 text-left text-sm font-bold">المبلغ</th>
              </tr>
              <tr>
                <td colSpan={3} style={{ borderBottom: `2px solid ${DOC_GOLD_SOFT}` }} />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} style={{ borderBottom: `1px solid ${DOC_BAND}` }}>
                  <td className="py-3 text-sm font-bold">{index + 1}</td>
                  <td className="py-3 text-sm font-bold">
                    {line.description || "—"}
                  </td>
                  <td className="py-3 text-left text-sm font-bold tabular-nums">
                    {fmt(line.amount)}
                  </td>
                </tr>
              ))}
              {lines.length > 1 && (
                <tr>
                  <td colSpan={2} className="pt-4 text-sm font-bold">
                    الإجمالي
                  </td>
                  <td
                    className="pt-4 text-left text-base font-bold tabular-nums"
                    style={{ color: DOC_GOLD }}
                  >
                    {fmt(total)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {footnote && (
            <p className="mt-6 text-xs leading-relaxed text-slate-500">{footnote}</p>
          )}

          {/* التوقيع */}
          <div className="mt-16 text-sm font-bold">
            <div>التوقيع</div>
            <div className="mt-3">الختم</div>
          </div>
        </div>

        {/* التذييل */}
        <div
          className="mt-10 flex items-center justify-between gap-6 px-10 py-6"
          style={{ background: DOC_BAND }}
        >
          <div>
            {company.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo} alt="" style={{ height: 64 }} />
            ) : (
              <div className="text-xs text-slate-400">الشعار</div>
            )}
          </div>
          <div className="text-left">
            <div className="text-base font-bold">شكراً لتعاملكم معنا!</div>
            <div className="mt-2 text-xs leading-relaxed">
              {company.address && <div>العنوان: {company.address}</div>}
              {company.phone && <div>الهاتف: {company.phone}</div>}
              {company.email && <div>البريد الإلكتروني: {company.email}</div>}
            </div>
            <div className="mt-2 text-xs font-bold" style={{ color: DOC_GOLD }}>
              {titleAr} · {reference}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* ورقة الفاتورة                                                       */
/* ================================================================== */

function InvoiceSheet({
  invoice,
  company,
  onClose,
}: {
  invoice: Invoice;
  company: CompanyProfile;
  onClose: () => void;
}) {
  const total = invoiceTotal(invoice);

  return (
    <DocSheet
      company={company}
      titleAr="فاتورة"
      titleEn="INVOICE"
      reference={invoice.number}
      columns={[
        [
          { label: "رقم الفاتورة", value: invoice.number },
          { label: "تاريخ الفاتورة", value: invoice.date },
          { label: "عنوان العقد", value: invoice.contractTitle },
          { label: "رقم الدفعة", value: invoice.installmentLabel },
        ],
        [
          { label: "اسم العميل", value: invoice.clientName },
          { label: "الرقم المدني", value: invoice.clientCivilId },
          { label: "موقع المشروع", value: invoice.projectLocation },
          { label: "رقم الهاتف", value: invoice.clientPhone },
        ],
        [
          { label: "طريقة الدفع", value: invoice.paymentMethod },
          { label: "المبلغ بالحروف", value: amountInWords(total) },
        ],
      ]}
      lines={invoice.lines}
      total={total}
      amountWords={amountInWords(total)}
      footnote={invoice.notes || undefined}
      onClose={onClose}
    />
  );
}

/**
 * سند الصرف والقبض — بتنسيق الفاتورة المعتمد.
 *
 * قرار المجلس: المستندات الثلاثة بشكل واحد. فما يتغيّر هنا عن الفاتورة
 * هو العنوان والبيانات وحدها، ويُضاف سطر القيد المحاسبي في الحاشية —
 * فالسند مستند داخلي يُراجَع، بخلاف الفاتورة التي تُسلَّم للعميل.
 */
function VoucherSheet({
  movement,
  company,
  onClose,
}: {
  movement: Movement;
  company: CompanyProfile;
  onClose: () => void;
}) {
  const kind = voucherKind(movement);
  const isPayment = kind === "صرف";

  // في سند الصرف: الطرف هو الجهة المدينة · في سند القبض: الجهة الدائنة
  const counterparty =
    movement.party ||
    movement.person ||
    accountLabel(isPayment ? movement.debitCode : movement.creditCode);

  const cashCode = isCash(movement.creditCode)
    ? movement.creditCode
    : movement.debitCode;

  const titleAr = kind ? `سند ${kind}` : "سند قيد";
  const titleEn =
    kind === "صرف"
      ? "PAYMENT VOUCHER"
      : kind === "قبض"
      ? "RECEIPT VOUCHER"
      : "JOURNAL VOUCHER";

  return (
    <DocSheet
      company={company}
      titleAr={titleAr}
      titleEn={titleEn}
      reference={`${movement.entryNo} / ${movement.fiscalYear}`}
      columns={[
        [
          { label: "رقم السند", value: String(movement.entryNo) },
          { label: "التاريخ", value: movement.date },
          { label: "السنة المالية", value: String(movement.fiscalYear) },
          { label: "نوع الحركة", value: movement.movementType },
        ],
        [
          {
            label: isPayment ? "صُرف إلى" : "استُلم من",
            value: counterparty,
          },
          { label: "المشروع", value: movement.project },
          { label: "البند", value: movement.itemName },
          { label: "الحساب النقدي", value: accountLabel(cashCode) },
        ],
        [
          { label: "طريقة الدفع", value: movement.paymentMethod },
          { label: "المبلغ بالحروف", value: amountInWords(movement.amount) },
        ],
      ]}
      lines={[
        {
          description: movement.description || "—",
          amount: movement.amount,
        },
      ]}
      total={movement.amount}
      amountWords={amountInWords(movement.amount)}
      footnote={
        kind
          ? `القيد المحاسبي: ${movement.debitCode} ${accountLabel(
              movement.debitCode
            )} مديناً / ${movement.creditCode} ${accountLabel(
              movement.creditCode
            )} دائناً.`
          : "هذه الحركة لم تمسّ الصندوق ولا البنك، فهي قيد محاسبي لا سند صرف أو قبض."
      }
      onClose={onClose}
    />
  );
}


/* ================================================================== */
/* الرئيسية                                                            */
/* ================================================================== */

function Dashboard({
  year,
  income,
  balanceSheet,
  cash,
  trialBalance,
  movementCount,
}: {
  year: number;
  income: ReturnType<typeof buildIncomeStatement>;
  balanceSheet: ReturnType<typeof buildBalanceSheet>;
  cash: number;
  trialBalance: ReturnType<typeof buildTrialBalance>;
  movementCount: number;
}) {
  const cards = [
    { title: "إجمالي الإيرادات", value: income.totalRevenue },
    {
      title: "إجمالي المصروفات",
      value: round3(income.totalProjectCosts + income.totalAdminExpenses),
    },
    { title: "صافي الربح / الخسارة", value: income.netProfit },
    { title: "النقدية والبنوك", value: cash },
  ];

  return (
    <>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.title} className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">{card.title}</p>
            <p className="mt-4 text-2xl font-bold">
              <Money value={card.value} /> د.ك
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <Panel title={`حالة دفاتر ${year}`}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {[
              ["عدد الحركات", String(movementCount)],
              ["حسابات بها حركة", String(trialBalance.rows.length)],
              ["مجمل الربح", fmt(income.grossProfit)],
              ["فرق الميزانية", fmt(balanceSheet.difference)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-bold">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {trialBalance.balanced ? (
              <Banner tone="ok">✓ ميزان المراجعة متوازن</Banner>
            ) : (
              <Banner tone="error">⚠ ميزان المراجعة غير متوازن</Banner>
            )}
            {balanceSheet.balanced ? (
              <Banner tone="ok">
                ✓ الأصول ({fmt(balanceSheet.totalAssets)}) = الخصوم وحقوق الملكية
              </Banner>
            ) : (
              <Banner tone="error">
                ⚠ الميزانية غير متوازنة بفارق {fmt(balanceSheet.difference)} د.ك
              </Banner>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}

/* ================================================================== */
/* إدخال حركة                                                          */
/* ================================================================== */

const BLANK_FORM = {
  date: "",
  movementType: "",
  itemCode: "",
  paymentMethod: "",
  project: "",
  amount: "",
  person: "",
  party: "",
  description: "",
  debitCode: "",
  creditCode: "",
  manual: false,
  contractNumber: "",
  installmentNumber: "",
  /* حصص الدفعات: «3:300|4:700» — نصٌّ في النموذج، ومصفوفةٌ في الحركة */
  installmentSplits: "",
};

/** يملأ النموذج من حركة قائمة، ويفعّل الوضع اليدوي إن كان قيدها لا يتبع القواعد */
/*
  حصص الدفعات في النموذج نصٌّ واحد: «3:300|4:700».

  والحقل نصّي لأن النموذج كلّه نصوص — فيُقرأ ويُكتب بدالّتين، ويبقى
  مصدر الحقيقة مصفوفةَ الحركة لا النصّ.
*/
function parseSplits(text: string): InstallmentSplit[] | undefined {
  const parts = (text ?? "")
    .split("|")
    .map((row) => row.split(":"))
    .map(([number, amount]) => ({
      number: Number(number) || 0,
      amount: round3(Number(amount) || 0),
    }))
    .filter((x) => x.number > 0 && x.amount > 0);
  return parts.length > 0 ? parts : undefined;
}

function splitsToText(splits: InstallmentSplit[] | undefined): string {
  return (splits ?? []).map((x) => `${x.number}:${x.amount}`).join("|");
}

/** صفوف التوزيع كما تُعرض في الشاشة */
type SplitRow = { number: number; amount: string };

const splitsToRows = (text: string): SplitRow[] => {
  const rows = (text ?? "")
    .split("|")
    .filter(Boolean)
    .map((row) => {
      const [number, amount] = row.split(":");
      return { number: Number(number) || 0, amount: amount ?? "" };
    });
  return rows.length > 0 ? rows : [{ number: 0, amount: "" }];
};

const rowsToSplits = (rows: SplitRow[]): string =>
  rows
    .filter((r) => r.number > 0 && round3(Number(r.amount) || 0) > 0)
    .map((r) => `${r.number}:${round3(Number(r.amount) || 0)}`)
    .join("|");

function formOf(movement: Movement): typeof BLANK_FORM {
  const derived = deriveEntry({
    movementType: movement.movementType,
    itemCode: movement.itemCode,
    paymentMethod: movement.paymentMethod,
  });
  const followsRules =
    derived.debitCode === movement.debitCode &&
    derived.creditCode === movement.creditCode;

  // القيد المعطوب يُفتح على الوضع اليدوي مباشرة، وإلا بقيت خانتا الحساب
  // مخفيّتين وتعذّر تصحيحه أصلاً
  const broken = !validate(movement).valid;

  return {
    date: movement.date,
    movementType: movement.movementType,
    itemCode: movement.itemCode,
    paymentMethod: movement.paymentMethod,
    project: movement.project,
    amount: String(movement.amount),
    person: movement.person,
    party: movement.party,
    description: movement.description,
    debitCode: movement.debitCode,
    creditCode: movement.creditCode,
    manual: !followsRules || broken,
    contractNumber: movement.contractNumber ?? "",
    installmentNumber: movement.installmentNumber
      ? String(movement.installmentNumber)
      : "",
    installmentSplits: splitsToText(movement.installmentSplits),
  };
}

function MovementForm({
  year,
  projects,
  movements,
  contractors,
  people,
  editing,
  lockedYears,
  onSave,
  onUpdate,
  onCancelEdit,
}: {
  year: number;
  projects: Project[];
  /** كل الحركات — يُبحث فيها عن المكرَّر قبل الحفظ */
  movements: Movement[];
  contractors: Contractor[];
  people: string[];
  editing: Movement | null;
  /* رقم القيد يُشتقّ من سنة تاريخ الحركة داخل النموذج */
  lockedYears: YearLocks;
  onSave: (movement: Movement) => void;
  onUpdate: (movement: Movement) => void;
  onCancelEdit: () => void;
}) {
  const blank = BLANK_FORM;

  const [form, setForm] = useState(blank);
  const [message, setMessage] = useState("");

  // فتح حركة للتعديل يملأ النموذج بقيمها
  useEffect(() => {
    setForm(editing ? formOf(editing) : BLANK_FORM);
    setMessage("");
  }, [editing]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const set = (key: keyof typeof blank, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const derived = form.manual
    ? { debitCode: form.debitCode, creditCode: form.creditCode }
    : deriveEntry({
        movementType: form.movementType,
        itemCode: form.itemCode,
        paymentMethod: form.paymentMethod,
      });

  /**
   * أيّ عقدٍ تُربط به هذه الحركة — إن كانت تُربط أصلاً.
   *
   * «مقاول» متى كان القيد على أجور المقاولين، و«عميل» متى كان قبضاً
   * على حساب الإيراد. وما عداهما لا يُربط.
   */
  /* صفوف التوزيع: تُشتقّ من الحقل النصّي وتُعاد إليه عند كل تغيير */
  const splitting = form.installmentSplits.length > 0;
  const splitRows = useMemo(
    () => splitsToRows(form.installmentSplits),
    [form.installmentSplits]
  );
  const setSplitRows = (rows: SplitRow[]) =>
    setForm((prev) => ({
      ...prev,
      /* الصفّ الفارغ يبقى معروضاً، والنصّ لا يحفظ إلا التامّ منها */
      installmentSplits: rowsToSplits(rows) || " ",
    }));
  const splitTotal = round3(
    splitRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
  );
  const splitRemainder = round3((Number(form.amount) || 0) - splitTotal);

  const linkKind: "مقاول" | "عميل" | null =
    derived.debitCode.startsWith("5")
      ? "مقاول"
      : derived.creditCode === CLIENT_REVENUE
        ? "عميل"
        : null;

  const draft: Partial<Movement> = {
    ...form,
    ...derived,
    amount: Number(form.amount) || 0,
    installmentNumber: Number(form.installmentNumber) || undefined,
    installmentSplits: parseSplits(form.installmentSplits),
  };
  const entryYear = fiscalYearOf(form.date);
  // التاريخ هو ما يحدّد السنة، فالقفل يُفحص على سنة التاريخ لا السنة المعروضة
  const entryYearLocked = !!form.date && isYearClosed(lockedYears, entryYear);

  /*
    ورقم القيد كذلك من سنة التاريخ لا من السنة المعروضة.

    وقع في ٢٣ سبتمبر ٢٠٢٦: أُدخلت حركةٌ بتاريخ ٢٠٢٦ والشاشة تعرض ٢٠٢٥،
    فأخذت الرقم التالي لأعلى رقمٍ في ٢٠٢٥ (١٨٠٨) وحُفظت في ٢٠٢٦ — حيث
    الرقم مأخوذ. فتكرّر رقمان في سنةٍ واحدة، ورفضها الخادم.
  */
  const entryNumber = useMemo(
    () =>
      movements
        .filter((m) => m.fiscalYear === entryYear)
        .reduce((max, m) => Math.max(max, m.entryNo), 1000) + 1,
    [movements, entryYear]
  );

  /*
    المكرَّر: يُبحث عنه كلما تغيّرت المسوّدة، ويُقرَّ عليه ببصمته — فلو
    بقي الإقرار بعد تغيير المبلغ أو التاريخ لمرّت حركةٌ مكرَّرة بإقرارٍ
    لغيرها.
  */
  const duplicates = useMemo(
    () => findDuplicateMovements({ ...draft, id: editing?.id }, movements),
    [draft.date, draft.amount, draft.debitCode, draft.creditCode, draft.project, draft.description, draft.party, editing, movements]
  );
  const [dupCleared, setDupCleared] = useState("");
  const dupSignature = duplicateSignature(draft);
  const dupBlocking = duplicates.length > 0 && dupCleared !== dupSignature;

  const check = entryYearLocked
    ? {
        valid: false,
        problem: `السنة المالية ${entryYear} مقفلة — لا تقبل أي إضافة أو تعديل`,
      }
    : validate(draft);

  const handleSave = () => {
    if (!check.valid || dupBlocking) return;
    const item = ITEM_MAP.find((i) => i.code === form.itemCode);
    const common = {
      fiscalYear: fiscalYearOf(form.date),
      date: form.date,
      movementType: form.movementType,
      description: form.description,
      itemCode: form.itemCode,
      itemName: item?.name ?? editing?.itemName ?? "",
      debitCode: derived.debitCode,
      creditCode: derived.creditCode,
      amount: round3(Number(form.amount) || 0),
      project: form.project,
      person: form.person,
      paymentMethod: form.paymentMethod,
      party: form.party,
      /*
        الربط يُمحى إن لم يعد القيد قابلاً له: يُختار عقدٌ ثم يُبدَّل البند
        فيصير القيد على حسابٍ آخر — فيبقى رقم العقد في حركةٍ لا تخصّه،
        ويُحسب في مدفوعه وهو منه براء.
      */
      contractNumber: linkKind ? form.contractNumber || undefined : undefined,
      installmentNumber: linkKind
        ? Number(form.installmentNumber) || undefined
        : undefined,
      /* التوزيع يتبع الربط: لا عقد فلا حصص */
      installmentSplits:
        linkKind && form.contractNumber
          ? parseSplits(form.installmentSplits)
          : undefined,
    };

    if (editing) {
      // التعديل يحافظ على المعرّف ورقم القيد حتى لا ينكسر التسلسل
      onUpdate({ ...editing, ...common });
      setMessage(`تم تعديل القيد ${editing.entryNo}`);
      return;
    }

    onSave({
      id: newId(),
      entryNo: entryNumber,
      ...common,
      source: "app",
      approval: "بانتظار الاعتماد",
      approvedBy: "",
      approvedAt: "",
      approvalNote: "",
    });
    setForm(blank);
    setMessage(`تم حفظ الحركة برقم قيد ${entryNumber}`);
  };

  const yearMismatch = !!form.date && entryYear !== year;

  return (
    <Panel
      title={editing ? `تعديل القيد ${editing.entryNo}` : "إدخال حركة مالية جديدة"}
      subtitle={
        editing
          ? `${editing.source === "excel" ? "حركة مستوردة من الإكسل" : "حركة مُدخلة في النظام"} — رقم القيد وتاريخ الإنشاء محفوظان`
          : `رقم القيد التالي: ${entryNumber}`
      }
    >
      {editing && !validate(editing).valid && (
        <Banner tone="error">
          هذا قيد معطوب: {validate(editing).problem}. فُتح على الوضع اليدوي —
          صحّح الحساب المدين أو الدائن أدناه ثم احفظ.
        </Banner>
      )}

      {editing && validate(editing).valid && (
        <Banner tone="warn">
          أنت تعدّل حركة قائمة. اضغط «إلغاء التعديل» للعودة إلى إدخال حركة جديدة.
        </Banner>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="التاريخ">
          <input
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="نوع الحركة">
          <select
            value={form.movementType}
            onChange={(e) => set("movementType", e.target.value)}
            className={inputClass}
          >
            <option value="">اختر نوع الحركة</option>
            {MOVEMENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>

        <Field
          label="البند"
          hint={
            form.itemCode
              ? `يُرحّل إلى ${accountLabel(itemAccount(form.itemCode))}`
              : undefined
          }
        >
          <select
            value={form.itemCode}
            onChange={(e) => set("itemCode", e.target.value)}
            disabled={form.manual}
            className={`${inputClass} disabled:bg-slate-100`}
          >
            <option value="">اختر البند</option>
            {ITEM_MAP.filter((i) => i.account).map((item) => (
              <option key={item.code} value={item.code}>
                {item.name} ({item.account})
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="طريقة الدفع"
          hint={
            form.paymentMethod
              ? `الحساب المقابل ${accountLabel(
                  PAYMENT_MAP.find((p) => p.label === form.paymentMethod)?.account ?? ""
                )}`
              : undefined
          }
        >
          <select
            value={form.paymentMethod}
            onChange={(e) => set("paymentMethod", e.target.value)}
            disabled={form.manual}
            className={`${inputClass} disabled:bg-slate-100`}
          >
            <option value="">اختر طريقة الدفع</option>
            {PAYMENT_MAP.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label} ({p.account})
              </option>
            ))}
          </select>
        </Field>

        <Field label="المشروع">
          <select
            value={form.project}
            onChange={(e) => set("project", e.target.value)}
            className={inputClass}
          >
            <option value="">بدون مشروع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="المبلغ (د.ك)">
          <input
            type="number"
            step="0.001"
            min="0"
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="الدافع / المستلم">
          <select
            value={form.person}
            onChange={(e) => set("person", e.target.value)}
            className={inputClass}
          >
            <option value="">اختر الدافع / المستلم</option>
            {people.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>

        <Field label="الطرف">
          <input
            type="text"
            value={form.party}
            onChange={(e) => set("party", e.target.value)}
            placeholder="اسم المورد / العميل / المقاول"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-5">
        <Field label="البيان">
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      {/*
        ربط الدفعة بعقدها — يظهر لدفعات المقاولين ولقبض العملاء.

        والقيدان معكوسان: دفعة المقاول تُقيَّد على المصروف، ودفعة العميل
        على الإيراد. فيُعرض لكلٍّ عقودُه وحدها، وإلا رُبط قبضٌ بعقد مقاول
        فظهر المقبوض في غير موضعه.
      */}
      {linkKind && (
        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="mb-3 text-sm font-bold">
            {linkKind === "عميل"
              ? "ربط القبض بعقد العميل"
              : "ربط الدفعة بعقد المقاول أو المورّد"}
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field
              label="العقد"
              hint={
                linkKind === "عميل"
                  ? "اختياري — الربط يُحدّث المقبوض والمتبقي على العميل"
                  : "اختياري — الربط يُحدّث المدفوع والمتبقي"
              }
            >
              <select
                value={form.contractNumber}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    contractNumber: e.target.value,
                    installmentNumber: "",
                    installmentSplits: "",
                  }));
                }}
                className={inputClass}
              >
                <option value="">بدون ربط</option>
                {contractors
                  .filter((c) => (c.counterpartyType === "عميل") === (linkKind === "عميل"))
                  .filter((c) => linkKind === "عميل" || !form.project || c.project === form.project)
                  .map((c) => (
                    <option key={c.id} value={c.contractNumber}>
                      {c.contractNumber} — {c.name} ({c.project})
                    </option>
                  ))}
              </select>
            </Field>

            {form.contractNumber && !splitting && (
              <Field label="الدفعة">
                <select
                  value={form.installmentNumber}
                  onChange={(e) => set("installmentNumber", e.target.value)}
                  className={inputClass}
                >
                  <option value="">دفعة غير محدّدة</option>
                  {contractors
                    .find((c) => c.contractNumber === form.contractNumber)
                    ?.installments.filter(isPayableInstallment)
                    .map((i) => (
                      <option key={i.number} value={i.number}>
                        الدفعة {i.number} — {fmt(Number(i.value) || 0)} د.ك
                        {i.condition ? ` · ${i.condition}` : ""}
                      </option>
                    ))}
                </select>
              </Field>
            )}
          </div>

          {form.contractNumber && (
            <>
              <label className="mt-4 flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={splitting}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setForm((prev) => ({
                      ...prev,
                      installmentSplits: on
                        ? prev.installmentNumber && prev.amount
                          ? `${prev.installmentNumber}:${prev.amount}`
                          : " "
                        : "",
                      installmentNumber: on ? "" : prev.installmentNumber,
                    }));
                  }}
                />
                وزّع المبلغ على أكثر من دفعة — جزءٌ يُتمّ دفعةً والباقي على التي تليها
              </label>

              {splitting && (
                <div className="mt-3 rounded-lg border border-blue-200 bg-white p-4">
                  {splitRows.map((row, index) => (
                    <div key={index} className="mb-2 flex flex-wrap items-center gap-3">
                      <select
                        value={row.number || ""}
                        onChange={(e) =>
                          setSplitRows(
                            splitRows.map((r, i) =>
                              i === index ? { ...r, number: Number(e.target.value) || 0 } : r
                            )
                          )
                        }
                        className={`${inputClass} w-64`}
                      >
                        <option value="">اختر الدفعة</option>
                        {contractors
                          .find((c) => c.contractNumber === form.contractNumber)
                          ?.installments.filter(isPayableInstallment)
                          .map((i) => (
                            <option key={i.number} value={i.number}>
                              الدفعة {i.number} — {fmt(installmentNet(i))} د.ك
                              {i.condition ? ` · ${i.condition}` : ""}
                            </option>
                          ))}
                      </select>
                      <input
                        type="number"
                        step="0.001"
                        value={row.amount}
                        onChange={(e) =>
                          setSplitRows(
                            splitRows.map((r, i) =>
                              i === index ? { ...r, amount: e.target.value } : r
                            )
                          )
                        }
                        placeholder="المبلغ"
                        className={`${inputClass} w-40`}
                      />
                      {splitRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSplitRows(splitRows.filter((_, i) => i !== index))
                          }
                          className="text-sm text-red-700 underline"
                        >
                          احذف
                        </button>
                      )}
                    </div>
                  ))}

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                    <button
                      type="button"
                      onClick={() =>
                        setSplitRows([...splitRows, { number: 0, amount: "" }])
                      }
                      className="rounded-lg bg-blue-50 px-4 py-2 font-bold text-blue-700"
                    >
                      + دفعة أخرى
                    </button>
                    <span>
                      مجموع التوزيع <b className="tabular-nums">{fmt(splitTotal)}</b> من{" "}
                      <b className="tabular-nums">{fmt(round3(Number(form.amount) || 0))}</b> د.ك
                    </span>
                    {splitRemainder !== 0 && (
                      <span className="font-bold text-red-700">
                        {splitRemainder > 0
                          ? `ينقص ${fmt(splitRemainder)} د.ك`
                          : `يزيد ${fmt(Math.abs(splitRemainder))} د.ك`}
                      </span>
                    )}
                    {splitRemainder === 0 && splitTotal > 0 && (
                      <span className="font-bold text-green-700">✓ مطابق</span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}


      <label className="mt-5 flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={form.manual}
          onChange={(e) => set("manual", e.target.checked)}
        />
        تحديد طرفَي القيد يدوياً (للقيود التي لا تتبع البند وطريقة الدفع)
      </label>

      {form.manual && (
        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2">
          {(
            [
              ["debitCode", "الحساب المدين"],
              ["creditCode", "الحساب الدائن"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <select
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                className={inputClass}
              >
                <option value="">اختر الحساب</option>
                {POSTABLE_ACCOUNTS.map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-sm font-bold">معاينة القيد</p>
        {check.valid ? (
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <Td>من حـ/</Td>
                <Td>{accountLabel(derived.debitCode)}</Td>
                <Td className="text-left">
                  <Money value={round3(Number(form.amount))} bold />
                </Td>
              </tr>
              <tr>
                <Td>إلى حـ/</Td>
                <Td>{accountLabel(derived.creditCode)}</Td>
                <Td className="text-left">
                  <Money value={round3(Number(form.amount))} bold />
                </Td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-amber-800">{check.problem}</p>
        )}
        {yearMismatch && (
          <p className="mt-2 text-sm text-amber-800">
            التاريخ يقع في السنة المالية {entryYear} بينما المعروض {year} — ستُحفظ
            في {entryYear}.
          </p>
        )}
      </div>

      {duplicates.length > 0 && (
        <div
          className={`mt-6 rounded-xl border p-4 ${
            duplicates.some((d) => d.exact)
              ? "border-red-300 bg-red-50"
              : "border-amber-300 bg-amber-50"
          }`}
        >
          <p className="mb-2 font-bold">
            {duplicates.some((d) => d.exact)
              ? "تنبيه: يبدو أن هذه الحركة مكرَّرة"
              : "انتبه: توجد حركة تشبه هذه"}
          </p>
          <p className="mb-3 text-sm">
            وُجد في الدفاتر {duplicates.length === 1 ? "قيدٌ" : `${duplicates.length} قيود`}
            {" "}بنفس المبلغ خلال {DUPLICATE_WINDOW_DAYS} أيام:
          </p>
          <table className="mb-3 w-full text-right text-sm">
            <thead>
              <tr>
                <Th>القيد</Th>
                <Th>التاريخ</Th>
                <Th>البيان</Th>
                <Th>المبلغ</Th>
                <Th>وجه الشبه</Th>
              </tr>
            </thead>
            <tbody>
              {duplicates.map((d) => (
                <tr key={d.movement.id} className="border-b border-white/60">
                  <Td>{d.movement.entryNo}</Td>
                  <Td>{d.movement.date}</Td>
                  <Td>{d.movement.description || "—"}</Td>
                  <Td>
                    <Money value={d.movement.amount} />
                  </Td>
                  <Td>{d.reason}</Td>
                </tr>
              ))}
            </tbody>
          </table>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={dupCleared === dupSignature}
              onChange={(e) => setDupCleared(e.target.checked ? dupSignature : "")}
            />
            راجعتُها، وهذه حركة أخرى — احفظها
          </label>
          {dupBlocking && (
            <p className="mt-2 text-sm">
              الحفظ متوقّف حتى تُقرّ ذلك. وإن كانت هي نفسها فلا تحفظها؛ عدّل القائمة
              من <b>جدول الحركات</b> إن لزم.
            </p>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={handleSave}
          disabled={!check.valid || dupBlocking}
          className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {editing ? "حفظ التعديل" : "حفظ الحركة"}
        </button>

        {editing && (
          <button
            onClick={onCancelEdit}
            className="rounded-lg bg-slate-200 px-6 py-3 font-medium"
          >
            إلغاء التعديل
          </button>
        )}
      </div>

      {message && (
        <p className="mt-3 text-sm font-medium text-green-700">{message}</p>
      )}
    </Panel>
  );
}

/* ================================================================== */
/* جدول الحركات                                                        */
/* ================================================================== */

function MovementsTable({
  movements,
  editable,
  onEdit,
  onVoucher,
  onDelete,
}: {
  movements: Movement[];
  /** الحركة قابلة للتعديل؟ تعود false لحركات السنوات المقفلة */
  editable: (movement: Movement) => boolean;
  onEdit: (movement: Movement) => void;
  onVoucher: (movement: Movement) => void;
  onDelete: (id: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return movements;
    return movements.filter((m) =>
      [m.description, m.party, m.itemName, m.project, m.person, m.debitCode, m.creditCode]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [movements, search]);

  const total = round3(filtered.reduce((acc, m) => acc + m.amount, 0));

  return (
    <Panel title="جدول الحركات">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="بحث في البيان / الطرف / البند / المشروع / رقم الحساب…"
        className={`${inputClass} mb-5`}
      />

      {filtered.length === 0 ? (
        <Empty>لا توجد حركات مطابقة</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            {/* ترويسة ثابتة: الجدول قد يتجاوز ٦٠٠ صفاً */}
            <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
              <tr>
                <Th>القيد</Th>
                <Th>التاريخ</Th>
                <Th>النوع</Th>
                <Th>البيان</Th>
                <Th>البند</Th>
                <Th>مدين</Th>
                <Th>دائن</Th>
                <Th>المبلغ</Th>
                <Th>المشروع</Th>
                <Th>الطريقة</Th>
                <Th>الحالة</Th>
                <Th>الإجراء</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const check = validate(m);
                return (
                  <tr key={m.id} className="border-b border-slate-200">
                    <Td>{m.entryNo || "—"}</Td>
                    <Td>{m.date || "—"}</Td>
                    <Td>{m.movementType}</Td>
                    <Td>{m.description || "—"}</Td>
                    <Td>{m.itemName || "—"}</Td>
                    <Td>{m.debitCode || "—"}</Td>
                    <Td>{m.creditCode || "—"}</Td>
                    <Td>
                      <Money value={m.amount} />
                    </Td>
                    <Td>{m.project || "—"}</Td>
                    <Td>{m.paymentMethod || "—"}</Td>
                    <Td>
                      {check.valid ? (
                        <span className="text-green-700">سليم</span>
                      ) : (
                        <span className="text-red-600">{check.problem}</span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => onVoucher(m)}
                          disabled={!check.valid}
                          title="طباعة سند صرف أو قبض"
                          className="rounded-lg bg-slate-100 px-3 py-2 disabled:opacity-40"
                        >
                          🖨 سند
                        </button>
                        <button
                          onClick={() => onEdit(m)}
                          disabled={!editable(m)}
                          title={
                            editable(m)
                              ? ""
                              : isClosedContractorPayment(m)
                                ? CLOSED_PAYMENT_REASON
                                : "السنة مقفلة"
                          }
                          className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => {
                            if (
                              window.confirm(
                                `حذف القيد ${m.entryNo} «${m.description}» بمبلغ ${fmt(m.amount)} د.ك؟`
                              )
                            ) {
                              onDelete(m.id);
                            }
                          }}
                          disabled={!editable(m)}
                          title={
                            editable(m)
                              ? ""
                              : isClosedContractorPayment(m)
                                ? CLOSED_PAYMENT_REASON
                                : "السنة مقفلة"
                          }
                          className="rounded-lg bg-red-50 px-3 py-2 text-red-700 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          حذف
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 font-bold">
              <tr>
                <Td colSpan={7}>الإجمالي ({filtered.length} حركة)</Td>
                <Td>
                  <Money value={total} bold />
                </Td>
                <Td colSpan={4}>{""}</Td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ================================================================== */
/* القيود اليومية                                                      */
/* ================================================================== */

function JournalPage({ movements }: { movements: Movement[] }) {
  if (movements.length === 0) {
    return (
      <Panel title="القيود اليومية">
        <Empty>لا توجد قيود في هذه السنة</Empty>
      </Panel>
    );
  }

  return (
    <Panel title="القيود اليومية" subtitle="مرتبة بالتاريخ ثم برقم القيد">
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
            <tr>
              <Th>رقم القيد</Th>
              <Th>التاريخ</Th>
              <Th>البيان</Th>
              <Th>رقم الحساب</Th>
              <Th>الحساب</Th>
              <Th>مدين</Th>
              <Th>دائن</Th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => {
              const check = validate(m);
              if (!check.valid) {
                return (
                  <tr key={m.id} className="border-b bg-red-50">
                    <Td>{m.entryNo}</Td>
                    <Td>{m.date || "—"}</Td>
                    <Td colSpan={5} className="text-red-700">
                      {m.description} — قيد غير صالح: {check.problem}
                    </Td>
                  </tr>
                );
              }
              return (
                <Fragment key={m.id}>
                  <tr className="border-b border-slate-100">
                    <Td>{m.entryNo}</Td>
                    <Td>{m.date}</Td>
                    <Td>{m.description || "—"}</Td>
                    <Td>{m.debitCode}</Td>
                    <Td>{getAccount(m.debitCode)?.name}</Td>
                    <Td>
                      <Money value={m.amount} />
                    </Td>
                    <Td>—</Td>
                  </tr>
                  <tr className="border-b-2 border-slate-200">
                    <Td>{""}</Td>
                    <Td>{""}</Td>
                    <Td>{""}</Td>
                    <Td>{m.creditCode}</Td>
                    <Td className="pr-8">{getAccount(m.creditCode)?.name}</Td>
                    <Td>—</Td>
                    <Td>
                      <Money value={m.amount} />
                    </Td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ================================================================== */
/* دفتر الأستاذ                                                        */
/* ================================================================== */

function LedgerPage({
  movements,
  totals,
}: {
  movements: Movement[];
  totals: ReturnType<typeof computeTotals>;
}) {
  const [code, setCode] = useState("");

  const ledger = useMemo(
    () => (code ? buildLedger(movements, code, totals) : null),
    [movements, code, totals]
  );

  const sumDebit = ledger
    ? round3(ledger.lines.reduce((acc, l) => acc + l.debit, 0))
    : 0;
  const sumCredit = ledger
    ? round3(ledger.lines.reduce((acc, l) => acc + l.credit, 0))
    : 0;

  const show = (v: number) =>
    isZero(v) ? "—" : `${fmt(Math.abs(v))} ${v > 0 ? "مدين" : "دائن"}`;

  return (
    <Panel title="دفتر الأستاذ">
      <Field label="اختر الحساب">
        <select
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className={inputClass}
        >
          <option value="">اختر الحساب</option>
          {POSTABLE_ACCOUNTS.map((a) => (
            <option key={a.code} value={a.code}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
      </Field>

      {ledger && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100">
              <tr>
                <Th>التاريخ</Th>
                <Th>القيد</Th>
                <Th>البيان</Th>
                <Th>الحساب المقابل</Th>
                <Th>مدين</Th>
                <Th>دائن</Th>
                <Th>الرصيد</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-slate-50 font-medium">
                <Td colSpan={6}>الرصيد الافتتاحي</Td>
                <Td>{show(ledger.opening)}</Td>
              </tr>
              {ledger.lines.map((line, index) => (
                <tr key={index} className="border-b border-slate-200">
                  <Td>{line.date || "—"}</Td>
                  <Td>{line.entryNo}</Td>
                  <Td>{line.description || "—"}</Td>
                  <Td>{line.counterpart}</Td>
                  <Td>{line.debit ? <Money value={line.debit} /> : "—"}</Td>
                  <Td>{line.credit ? <Money value={line.credit} /> : "—"}</Td>
                  <Td>{show(line.balance)}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-bold">
              <tr>
                <Td colSpan={4}>الإجمالي</Td>
                <Td>
                  <Money value={sumDebit} bold />
                </Td>
                <Td>
                  <Money value={sumCredit} bold />
                </Td>
                <Td>{show(ledger.closing)}</Td>
              </tr>
            </tfoot>
          </table>
          {ledger.lines.length === 0 && (
            <Empty>لا توجد حركات على هذا الحساب في هذه السنة</Empty>
          )}
        </div>
      )}
    </Panel>
  );
}

/* ================================================================== */
/* ميزان المراجعة                                                      */
/* ================================================================== */

function TrialBalancePage({
  report,
  year,
}: {
  report: ReturnType<typeof buildTrialBalance>;
  year: number;
}) {
  const cell = (v: number) => (isZero(v) ? "—" : fmt(v));

  return (
    <Panel
      title={`ميزان المراجعة ${year}`}
      subtitle={`${report.rows.length} حساباً به حركة أو رصيد`}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-100">
            <tr>
              <Th>رقم الحساب</Th>
              <Th>اسم الحساب</Th>
              <Th>افتتاحي مدين</Th>
              <Th>افتتاحي دائن</Th>
              <Th>حركة مدين</Th>
              <Th>حركة دائن</Th>
              <Th>ختامي مدين</Th>
              <Th>ختامي دائن</Th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.account.code} className="border-b border-slate-200">
                <Td>{row.account.code}</Td>
                <Td>{row.account.name}</Td>
                <Td>{cell(row.openingDebit)}</Td>
                <Td>{cell(row.openingCredit)}</Td>
                <Td>{cell(row.periodDebit)}</Td>
                <Td>{cell(row.periodCredit)}</Td>
                <Td>{cell(row.closingDebit)}</Td>
                <Td>{cell(row.closingCredit)}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-bold">
            <tr>
              <Td colSpan={2}>الإجمالي</Td>
              <Td>{fmt(report.totals.openingDebit)}</Td>
              <Td>{fmt(report.totals.openingCredit)}</Td>
              <Td>{fmt(report.totals.periodDebit)}</Td>
              <Td>{fmt(report.totals.periodCredit)}</Td>
              <Td>{fmt(report.totals.closingDebit)}</Td>
              <Td>{fmt(report.totals.closingCredit)}</Td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4">
        {report.balanced ? (
          <Banner tone="ok">✓ الميزان متوازن في الأعمدة الثلاثة</Banner>
        ) : (
          <Banner tone="error">
            ⚠ غير متوازن — فرق الأرصدة الختامية{" "}
            {fmt(report.totals.closingDebit - report.totals.closingCredit)} د.ك
          </Banner>
        )}
      </div>
    </Panel>
  );
}

/* ================================================================== */
/* القوائم المالية                                                     */
/* ================================================================== */

function RowsTable({
  rows,
  label,
}: {
  rows: { code: string; name: string; amount: number }[];
  label: string;
}) {
  const visible = rows.filter((r) => !isZero(r.amount));
  if (visible.length === 0) {
    return <p className="px-4 py-3 text-sm text-slate-500">لا توجد أرصدة</p>;
  }
  return (
    <table className="w-full text-right text-sm">
      <thead className="bg-slate-50">
        <tr>
          <Th>رقم الحساب</Th>
          <Th>اسم الحساب</Th>
          <Th>{label}</Th>
        </tr>
      </thead>
      <tbody>
        {visible.map((row) => (
          <tr key={row.code} className="border-b border-slate-100">
            <Td>{row.code}</Td>
            <Td>{row.name}</Td>
            <Td>
              <Money value={row.amount} />
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TotalLine({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between rounded-lg px-4 py-3 ${
        strong ? "bg-slate-200 font-bold" : "bg-slate-100 font-medium"
      }`}
    >
      <span>{label}</span>
      <Money value={value} bold={strong} />
    </div>
  );
}

function FinancialsPage({
  income,
  balanceSheet,
  cashFlow,
  cashByAccounts,
  equity,
}: {
  income: ReturnType<typeof buildIncomeStatement>;
  balanceSheet: ReturnType<typeof buildBalanceSheet>;
  cashFlow: ReturnType<typeof buildCashFlow>;
  cashByAccounts: number;
  equity: ReturnType<typeof buildEquityStatement>;
}) {
  const reconciles = nearlyEqual(cashFlow.closingCash, cashByAccounts);

  return (
    <>
      <Panel title="قائمة الدخل">
        <div className="space-y-2">
          <div className="rounded-lg bg-slate-100 px-4 py-3 font-bold">الإيرادات</div>
          <RowsTable rows={income.revenues} label="الإيرادات" />
          <TotalLine label="إجمالي الإيرادات" value={income.totalRevenue} />

          <div className="mt-4 rounded-lg bg-slate-100 px-4 py-3 font-bold">
            تكاليف المشاريع
          </div>
          <RowsTable rows={income.projectCosts} label="التكلفة" />
          <TotalLine
            label="إجمالي تكاليف المشاريع"
            value={income.totalProjectCosts}
          />
          <TotalLine
            label={income.grossProfit >= 0 ? "مجمل الربح" : "مجمل الخسارة"}
            value={income.grossProfit}
            strong
          />

          <div className="mt-4 rounded-lg bg-slate-100 px-4 py-3 font-bold">
            المصروفات الإدارية والعمومية
          </div>
          <RowsTable rows={income.adminExpenses} label="المصروف" />
          <TotalLine
            label="إجمالي المصروفات الإدارية والعمومية"
            value={income.totalAdminExpenses}
          />
          <TotalLine
            label={income.netProfit >= 0 ? "صافي الربح" : "صافي الخسارة"}
            value={income.netProfit}
            strong
          />
        </div>
      </Panel>

      <Panel title="قائمة المركز المالي">
        <div className="space-y-2">
          <div className="rounded-lg bg-slate-100 px-4 py-3 font-bold">الأصول</div>
          <RowsTable rows={balanceSheet.assets} label="الرصيد" />
          <TotalLine label="إجمالي الأصول" value={balanceSheet.totalAssets} strong />

          <div className="mt-4 rounded-lg bg-slate-100 px-4 py-3 font-bold">
            الخصوم
          </div>
          <RowsTable rows={balanceSheet.liabilities} label="الرصيد" />
          <TotalLine label="إجمالي الخصوم" value={balanceSheet.totalLiabilities} />

          <div className="mt-4 rounded-lg bg-slate-100 px-4 py-3 font-bold">
            حقوق الملكية
          </div>
          <RowsTable rows={balanceSheet.equityAccounts} label="الرصيد" />
          <div className="flex justify-between border-b border-slate-100 px-4 py-3">
            <span>صافي ربح / خسارة الفترة</span>
            <Money value={balanceSheet.netProfit} />
          </div>
          <TotalLine label="إجمالي حقوق الملكية" value={balanceSheet.totalEquity} />
          <TotalLine
            label="إجمالي الخصوم وحقوق الملكية"
            value={balanceSheet.totalLiabilitiesAndEquity}
            strong
          />
        </div>

        <div className="mt-4">
          {balanceSheet.balanced ? (
            <Banner tone="ok">✓ الميزانية متوازنة</Banner>
          ) : (
            <Banner tone="error">
              ⚠ غير متوازنة — الفرق {fmt(balanceSheet.difference)} د.ك
            </Banner>
          )}
        </div>
      </Panel>

      <Panel
        title="قائمة التغيرات في حقوق الملكية"
        subtitle="رصيد أول المدة + حركة الفترة + صافي النتيجة = رصيد آخر المدة"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100">
              <tr>
                <Th>رقم الحساب</Th>
                <Th>البند</Th>
                <Th>رصيد أول المدة</Th>
                <Th>حركة الفترة</Th>
                <Th>رصيد آخر المدة</Th>
              </tr>
            </thead>
            <tbody>
              {equity.rows.map((row) => (
                <tr key={row.code} className="border-b border-slate-100">
                  <Td>{row.code}</Td>
                  <Td>{row.name}</Td>
                  <Td>
                    <Money value={row.opening} />
                  </Td>
                  <Td>
                    <Money value={row.movement} />
                  </Td>
                  <Td>
                    <Money value={row.closing} />
                  </Td>
                </tr>
              ))}
              <tr className="border-b border-slate-100">
                <Td>—</Td>
                <Td>
                  {equity.netProfit >= 0
                    ? "صافي ربح الفترة"
                    : "صافي خسارة الفترة"}
                </Td>
                <Td>—</Td>
                <Td>
                  <Money value={equity.netProfit} />
                </Td>
                <Td>
                  <Money value={equity.netProfit} />
                </Td>
              </tr>
            </tbody>
            <tfoot className="bg-slate-200 font-bold">
              <tr>
                <Td colSpan={2}>إجمالي حقوق الملكية</Td>
                <Td>
                  <Money value={equity.openingTotal} bold />
                </Td>
                <Td>
                  <Money value={round3(equity.movementTotal + equity.netProfit)} bold />
                </Td>
                <Td>
                  <Money value={equity.closingTotal} bold />
                </Td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-4">
          {nearlyEqual(equity.closingTotal, balanceSheet.totalEquity) ? (
            <Banner tone="ok">
              ✓ رصيد آخر المدة مطابق لحقوق الملكية في قائمة المركز المالي
            </Banner>
          ) : (
            <Banner tone="error">
              ⚠ فرق {fmt(equity.closingTotal - balanceSheet.totalEquity)} د.ك عن
              قائمة المركز المالي
            </Banner>
          )}
        </div>
      </Panel>

      <Panel
        title="قائمة التدفقات النقدية"
        subtitle="الطريقة المباشرة — تصنيف الحركات التي مسّت الصندوق أو البنك"
      >
        <div className="space-y-2">
          <div className="rounded-lg bg-slate-100 px-4 py-3 font-bold">
            الأنشطة التشغيلية
          </div>
          <RowsTable rows={cashFlow.operating.lines} label="التدفق" />
          <TotalLine label="صافي التشغيلية" value={cashFlow.operating.total} />

          <div className="mt-4 rounded-lg bg-slate-100 px-4 py-3 font-bold">
            الأنشطة الاستثمارية
          </div>
          <RowsTable rows={cashFlow.investing.lines} label="التدفق" />
          <TotalLine label="صافي الاستثمارية" value={cashFlow.investing.total} />

          <div className="mt-4 rounded-lg bg-slate-100 px-4 py-3 font-bold">
            الأنشطة التمويلية
          </div>
          <RowsTable rows={cashFlow.financing.lines} label="التدفق" />
          <TotalLine label="صافي التمويلية" value={cashFlow.financing.total} />

          <div className="mt-4">
            <TotalLine
              label="صافي الزيادة (النقص) في النقدية"
              value={cashFlow.netChange}
              strong
            />
          </div>
          <TotalLine label="النقدية أول الفترة" value={cashFlow.openingCash} />
          <TotalLine label="النقدية آخر الفترة" value={cashFlow.closingCash} strong />
        </div>

        <div className="mt-4">
          {reconciles ? (
            <Banner tone="ok">
              ✓ رصيد النقدية ({fmt(cashFlow.closingCash)}) مطابق لرصيد الصندوق
              والبنك في دفتر الأستاذ
            </Banner>
          ) : (
            <Banner tone="error">
              ⚠ فرق {fmt(cashFlow.closingCash - cashByAccounts)} د.ك
            </Banner>
          )}
        </div>
      </Panel>
    </>
  );
}

/* ================================================================== */
/* التقارير التحليلية                                                  */
/* ================================================================== */

const MONTH_NAMES = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function ReportsPage({
  movements,
  allMovements,
  year,
  income,
}: {
  movements: Movement[];
  allMovements: Movement[];
  year: number;
  income: ReturnType<typeof buildIncomeStatement>;
}) {
  const monthly = useMemo(() => monthlyExpenses(movements, year), [movements, year]);
  const projects = useMemo(
    () => projectLifetimeAnalysis(allMovements, year),
    [allMovements, year]
  );

  const topExpenses = useMemo(
    () =>
      [...income.projectCosts, ...income.adminExpenses]
        .filter((r) => !isZero(r.amount))
        .sort((a, b) => b.amount - a.amount),
    [income]
  );
  const expenseTotal = round3(topExpenses.reduce((s, r) => s + r.amount, 0));

  // الأشهر التي بها حركة فعلية فقط، حتى لا يمتد الجدول بلا داع
  const activeMonths = monthly.months
    .map((_, i) => i)
    .filter((i) => !isZero(monthly.monthTotals[i]));

  return (
    <>
      <Panel
        title={`أكبر بنود الصرف ${year}`}
        subtitle={`${topExpenses.length} حساب · الإجمالي ${fmt(expenseTotal)} د.ك`}
      >
        {topExpenses.length === 0 ? (
          <Empty>لا توجد مصروفات</Empty>
        ) : (
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100">
              <tr>
                <Th>الحساب</Th>
                <Th>البند</Th>
                <Th>المبلغ</Th>
                <Th>النسبة</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {topExpenses.map((row) => {
                const share = expenseTotal > 0 ? (row.amount / expenseTotal) * 100 : 0;
                return (
                  <tr key={row.code} className="border-b border-slate-100">
                    <Td>{row.code}</Td>
                    <Td>{row.name}</Td>
                    <Td>
                      <Money value={row.amount} />
                    </Td>
                    <Td>{share.toFixed(1)}%</Td>
                    <Td>
                      <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full bg-blue-600"
                          style={{ width: `${Math.min(share, 100)}%` }}
                        />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100 font-bold">
              <tr>
                <Td colSpan={2}>الإجمالي</Td>
                <Td>
                  <Money value={expenseTotal} bold />
                </Td>
                <Td colSpan={2}>100%</Td>
              </tr>
            </tfoot>
          </table>
        )}
      </Panel>

      <Panel
        title="تحليل المشاريع — منذ بداية كل مشروع"
        subtitle="ربحية المشروع تُقاس على عمره كله، لا على سنة مالية واحدة"
      >
        {projects.multiYear > 0 && (
          <Banner tone="warn">
            <b>{projects.multiYear}</b> مشروع ممتد عبر أكثر من سنة مالية. النتيجة
            المعتمدة هي <b>الإجمالي التراكمي</b> — أما أعمدة «{year}» فتبيّن مساهمة
            هذه السنة وحدها، وقد تظهر سالبة لمشروع رابح قُبض إيراده في سنة سابقة.
          </Banner>
        )}

        {projects.rows.length === 0 ? (
          <Empty>لا توجد حركات مرتبطة بمشاريع</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="bg-slate-200">
                  <th className="px-4 py-2 text-right" colSpan={3}>
                    {""}
                  </th>
                  <th className="px-4 py-2 text-center font-bold" colSpan={3}>
                    منذ البداية (المعتمد)
                  </th>
                  <th className="px-4 py-2 text-center font-bold" colSpan={3}>
                    مساهمة {year}
                  </th>
                  <th className="px-4 py-2">{""}</th>
                </tr>
                <tr className="bg-slate-100">
                  <Th>المشروع</Th>
                  <Th>السنوات</Th>
                  <Th>الحركات</Th>
                  <Th>الإيرادات</Th>
                  <Th>التكاليف</Th>
                  <Th>النتيجة</Th>
                  <Th>الإيرادات</Th>
                  <Th>التكاليف</Th>
                  <Th>النتيجة</Th>
                  <Th>نصيبه</Th>
                </tr>
              </thead>
              <tbody>
                {projects.rows.map((row) => {
                  const tone = (n: number) =>
                    n > 0
                      ? "font-bold text-green-700"
                      : n < 0
                      ? "font-bold text-red-600"
                      : "";
                  return (
                    <tr key={row.project} className="border-b border-slate-100">
                      <Td>{row.project}</Td>
                      <Td className="whitespace-nowrap">{row.years.join("، ")}</Td>
                      <Td>{row.movements}</Td>
                      <Td>
                        <Money value={row.lifetime.revenue} />
                      </Td>
                      <Td>
                        <Money value={row.lifetime.cost} />
                      </Td>
                      <Td className={tone(row.lifetime.net)}>
                        {fmt(row.lifetime.net)}
                      </Td>
                      <Td className="text-slate-500">
                        {fmt(row.inYear.revenue)}
                      </Td>
                      <Td className="text-slate-500">{fmt(row.inYear.cost)}</Td>
                      <Td className="text-slate-500">{fmt(row.inYear.net)}</Td>
                      <Td>{row.costShare.toFixed(1)}%</Td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-bold">
                <tr>
                  <Td colSpan={3}>الإجمالي</Td>
                  <Td>
                    <Money value={projects.lifetime.revenue} bold />
                  </Td>
                  <Td>
                    <Money value={projects.lifetime.cost} bold />
                  </Td>
                  <Td>
                    <Money value={projects.lifetime.net} bold />
                  </Td>
                  <Td>{fmt(projects.inYear.revenue)}</Td>
                  <Td>{fmt(projects.inYear.cost)}</Td>
                  <Td>{fmt(projects.inYear.net)}</Td>
                  <Td>100%</Td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {projects.buckets.length > 0 && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-bold">سلال غير محسوبة ضمن المشاريع</p>
            <p className="mt-1 text-sm text-slate-600">
              «مصروفات مشتركة» تكاليف تنفيذ لم تُنسب إلى قسيمة، و«عام» ما ليس
              تكلفة مشروع أصلاً. مستبعدة من المجاميع ومن حساب النصيب أعلاه حتى
              لا تظهر كخسارة دائمة تُصغّر نصيب كل مشروع حقيقي — وهي داخلة في
              القوائم المالية كاملةً كما هي.
            </p>
            <table className="mt-3 w-full text-right text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Th>السلّة</Th>
                  <Th>الحركات</Th>
                  <Th>الإيرادات</Th>
                  <Th>التكاليف</Th>
                </tr>
              </thead>
              <tbody>
                {projects.buckets.map((row) => (
                  <tr key={row.project} className="border-b border-slate-200">
                    <Td>{row.project}</Td>
                    <Td>{row.movements}</Td>
                    <Td>
                      <Money value={row.lifetime.revenue} />
                    </Td>
                    <Td>
                      <Money value={row.lifetime.cost} />
                    </Td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-bold">
                  <Td>المجموع</Td>
                  <Td>{projects.bucketTotals.movements}</Td>
                  <Td>
                    <Money value={projects.bucketTotals.revenue} bold />
                  </Td>
                  <Td>
                    <Money value={projects.bucketTotals.cost} bold />
                  </Td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title={`المصروفات الشهرية ${year}`}
        subtitle="كل بند صرف موزّعاً على أشهر السنة"
      >
        {monthly.rows.length === 0 ? (
          <Empty>لا توجد مصروفات في هذه السنة</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <Th>البند</Th>
                  {activeMonths.map((m) => (
                    <Th key={m}>{MONTH_NAMES[m]}</Th>
                  ))}
                  <Th>الإجمالي</Th>
                </tr>
              </thead>
              <tbody>
                {monthly.rows.map((row) => (
                  <tr key={row.code} className="border-b border-slate-100">
                    <Td className="whitespace-nowrap">
                      {row.code} — {row.name}
                    </Td>
                    {activeMonths.map((m) => (
                      <Td key={m}>
                        {isZero(row.byMonth[m]) ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          fmt(row.byMonth[m])
                        )}
                      </Td>
                    ))}
                    <Td className="font-bold">{fmt(row.total)}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 font-bold">
                <tr>
                  <Td>إجمالي الشهر</Td>
                  {activeMonths.map((m) => (
                    <Td key={m}>{fmt(monthly.monthTotals[m])}</Td>
                  ))}
                  <Td>{fmt(monthly.grandTotal)}</Td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

/* ================================================================== */
/* المشاريع                                                            */
/* ================================================================== */

function ProjectsPage({
  projects,
  movements,
  year,
  today,
  canManage,
  setProjects,
  openProject,
}: {
  projects: Project[];
  /** كل الحركات في كل السنوات — ميزانية المشروع تُقاس على عمره لا على سنة */
  movements: Movement[];
  year: number;
  /** تاريخ اليوم — عليه يقوم حساب انتهاء التأمين */
  today: string;
  /** تعديل بيانات المشروع ووثيقة تأمينه */
  canManage: boolean;
  setProjects: Dispatch<SetStateAction<Project[]>>;
  openProject: (project: Project) => void;
}) {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [error, setError] = useState("");
  /* وثيقة التأمين المفتوحة للتحرير */
  const [policyFor, setPolicyFor] = useState<string | null>(null);
  const [policy, setPolicy] = useState({
    insurer: "",
    policyNumber: "",
    insuranceStart: "",
    insuranceEnd: "",
    insuranceValue: "",
    insuranceNote: "",
  });

  const insurance = new Map(
    projectInsurance(projects, today).map((r) => [r.project.id, r])
  );

  const openPolicy = (project: Project) => {
    setPolicyFor(project.id);
    setPolicy({
      insurer: project.insurer ?? "",
      policyNumber: project.policyNumber ?? "",
      insuranceStart: project.insuranceStart ?? "",
      insuranceEnd: project.insuranceEnd ?? "",
      insuranceValue: project.insuranceValue ? String(project.insuranceValue) : "",
      insuranceNote: project.insuranceNote ?? "",
    });
  };

  const savePolicy = (id: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id !== id
          ? p
          : {
              ...p,
              insurer: policy.insurer.trim() || undefined,
              policyNumber: policy.policyNumber.trim() || undefined,
              insuranceStart: policy.insuranceStart || undefined,
              insuranceEnd: policy.insuranceEnd || undefined,
              insuranceValue: round3(Number(policy.insuranceValue) || 0) || undefined,
              insuranceNote: policy.insuranceNote.trim() || undefined,
            }
      )
    );
    setPolicyFor(null);
  };

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return setError("اسم المشروع مطلوب");
    if (projects.some((p) => p.name === trimmed)) {
      return setError("يوجد مشروع بنفس الاسم — الحركات تُربط بالاسم");
    }
    setProjects((prev) => [
      ...prev,
      {
        id: newId(),
        name: trimmed,
        budget: round3(Number(budget) || 0),
        startDate: "",
        status: "نشط",
      },
    ]);
    setName("");
    setBudget("");
    setError("");
  };

  return (
    <Panel
      title="المشاريع"
      subtitle="الأرقام تراكمية منذ بداية كل مشروع — الميزانية تُستهلك عبر السنوات لا داخل سنة واحدة"
    >
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم المشروع"
          className={`${inputClass} flex-1`}
        />
        <input
          type="number"
          step="0.001"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          placeholder="ميزانية المشروع"
          className={`${inputClass} flex-1`}
        />
        <button
          onClick={add}
          className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
        >
          إضافة مشروع
        </button>
      </div>
      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

      {projects.length === 0 ? (
        <Empty>لا توجد مشاريع</Empty>
      ) : (
        <div className="mt-6 space-y-3">
          {projects.map((project) => {
            const s = projectSummary(movements, project.name);
            const mine = movements.filter((m) => m.project === project.name);
            const count = mine.length;
            const years = [...new Set(mine.map((m) => m.fiscalYear))].sort();
            const inYear = projectSummary(
              movements.filter((m) => m.fiscalYear === year),
              project.name
            );
            const usage = project.budget > 0 ? (s.cost / project.budget) * 100 : 0;

            return (
              <div key={project.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => openProject(project)}
                    className="text-lg font-bold text-blue-700 hover:underline"
                  >
                    {project.name}
                  </button>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-500">
                      {count} حركة · {years.join("، ")}
                    </span>
                    <button
                      onClick={() => {
                        if (window.confirm(`حذف المشروع «${project.name}»؟`)) {
                          setProjects((prev) =>
                            prev.filter((p) => p.id !== project.id)
                          );
                        }
                      }}
                      className="rounded-lg bg-red-50 px-3 py-2 text-red-700"
                    >
                      حذف
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                  {[
                    ["الميزانية", project.budget],
                    ["الإيرادات (تراكمي)", s.revenue],
                    ["التكاليف (تراكمي)", s.cost],
                    ["المتبقي من الميزانية", round3(project.budget - s.cost)],
                    ["صافي النتيجة (تراكمي)", s.net],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <p className="text-slate-500">{label}</p>
                      <p className="font-bold">
                        <Money value={value as number} />
                      </p>
                    </div>
                  ))}
                </div>

                {/* تأمين الموقع على العاملين — وثيقةٌ لها مدّة تنتهي */}
                {(() => {
                  const row = insurance.get(project.id);
                  if (!row) return null;
                  const tone =
                    row.state === "منتهٍ"
                      ? "border-red-300 bg-red-50 text-red-800"
                      : row.state === "يقترب"
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : row.state === "غير مسجّل"
                          ? "border-slate-200 bg-slate-50 text-slate-600"
                          : "border-green-200 bg-green-50 text-green-800";
                  return (
                    <div className={`mt-3 rounded-xl border p-3 text-sm ${tone}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <b>تأمين الموقع:</b>{" "}
                          {row.state === "غير مسجّل" ? (
                            <>لا وثيقة مسجّلة — سجّلها ليُنبَّه إليها قبل انتهائها.</>
                          ) : (
                            <>
                              {project.insurer || "شركة غير مذكورة"}
                              {project.policyNumber
                                ? ` · وثيقة ${project.policyNumber}`
                                : ""}
                              {" · ينتهي "}
                              {project.insuranceEnd}
                              {" — "}
                              {row.state === "منتهٍ"
                                ? `منتهٍ منذ ${Math.abs(row.daysLeft)} يوماً`
                                : `باقٍ ${row.daysLeft} يوماً`}
                            </>
                          )}
                        </span>
                        {canManage && (
                          <button
                            onClick={() =>
                              policyFor === project.id
                                ? setPolicyFor(null)
                                : openPolicy(project)
                            }
                            className="rounded-lg bg-white px-3 py-1 text-blue-700 underline"
                          >
                            {policyFor === project.id
                              ? "إلغاء"
                              : row.state === "غير مسجّل"
                                ? "تسجيل الوثيقة"
                                : "تعديل"}
                          </button>
                        )}
                      </div>
                      {project.insuranceNote && policyFor !== project.id && (
                        <p className="mt-1 text-xs">{project.insuranceNote}</p>
                      )}

                      {policyFor === project.id && (
                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                          <Field label="شركة التأمين">
                            <input
                              type="text"
                              value={policy.insurer}
                              onChange={(e) =>
                                setPolicy((x) => ({ ...x, insurer: e.target.value }))
                              }
                              className={inputClass}
                            />
                          </Field>
                          <Field label="رقم الوثيقة">
                            <input
                              type="text"
                              value={policy.policyNumber}
                              onChange={(e) =>
                                setPolicy((x) => ({
                                  ...x,
                                  policyNumber: e.target.value,
                                }))
                              }
                              className={inputClass}
                            />
                          </Field>
                          <Field label="قسط التأمين (د.ك)">
                            <input
                              type="number"
                              step="0.001"
                              value={policy.insuranceValue}
                              onChange={(e) =>
                                setPolicy((x) => ({
                                  ...x,
                                  insuranceValue: e.target.value,
                                }))
                              }
                              className={inputClass}
                            />
                          </Field>
                          <Field label="بداية التأمين">
                            <input
                              type="date"
                              value={policy.insuranceStart}
                              onChange={(e) =>
                                setPolicy((x) => ({
                                  ...x,
                                  insuranceStart: e.target.value,
                                }))
                              }
                              className={inputClass}
                            />
                          </Field>
                          <Field
                            label="انتهاء التأمين"
                            hint={`التنبيه يبدأ قبل الانتهاء بـ ${INSURANCE_ALERT_DAYS} يوماً`}
                          >
                            <input
                              type="date"
                              value={policy.insuranceEnd}
                              onChange={(e) =>
                                setPolicy((x) => ({
                                  ...x,
                                  insuranceEnd: e.target.value,
                                }))
                              }
                              className={inputClass}
                            />
                          </Field>
                          <Field label="ملاحظة">
                            <input
                              type="text"
                              value={policy.insuranceNote}
                              onChange={(e) =>
                                setPolicy((x) => ({
                                  ...x,
                                  insuranceNote: e.target.value,
                                }))
                              }
                              placeholder="تأمين على العاملين في الموقع"
                              className={inputClass}
                            />
                          </Field>
                          <div className="md:col-span-3">
                            <button
                              onClick={() => savePolicy(project.id)}
                              className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white"
                            >
                              حفظ الوثيقة
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {years.length > 1 && (
                  <p className="mt-2 text-xs text-slate-500">
                    مساهمة {year} وحدها: إيرادات {fmt(inYear.revenue)} · تكاليف{" "}
                    {fmt(inYear.cost)} · النتيجة {fmt(inYear.net)}
                  </p>
                )}

                {project.budget > 0 && (
                  <div className="mt-3">
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full ${
                          usage >= 100
                            ? "bg-red-600"
                            : usage >= 80
                            ? "bg-orange-500"
                            : "bg-blue-600"
                        }`}
                        style={{ width: `${Math.min(usage, 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      استهلاك الميزانية: {usage.toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/* ================================================================== */
/* حركات المشروع                                                       */
/* ================================================================== */

function ProjectMovementsPage({
  projectName,
  movements,
  year,
  onBack,
}: {
  projectName: string;
  movements: Movement[];
  year: number;
  onBack: () => void;
}) {
  const [typeFilter, setTypeFilter] = useState("الكل");
  const [itemFilter, setItemFilter] = useState("الكل");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  /** المشروع يمتد عبر السنوات، فالنطاق الافتراضي عمره كله */
  const [scope, setScope] = useState<"lifetime" | "year">("lifetime");

  const projectMovements = useMemo(
    () =>
      movements.filter(
        (m) =>
          m.project === projectName &&
          (scope === "lifetime" || m.fiscalYear === year)
      ),
    [movements, projectName, scope, year]
  );

  // فلترة واحدة تُستخدم في البطاقات والجدول والإجمالي معاً
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projectMovements.filter((m) => {
      if (typeFilter !== "الكل" && m.movementType !== typeFilter) return false;
      if (itemFilter !== "الكل" && m.itemName !== itemFilter) return false;
      if (from && m.date < from) return false;
      if (to && m.date > to) return false;
      if (q && !(m.description || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projectMovements, typeFilter, itemFilter, from, to, search]);

  const summary = useMemo(() => {
    let revenue = 0;
    let cost = 0;
    for (const m of filtered) {
      if (!validate(m).valid) continue;
      if (getAccount(m.creditCode)?.type === "إيرادات") revenue += m.amount;
      if (getAccount(m.debitCode)?.type === "مصروفات") cost += m.amount;
    }
    revenue = round3(revenue);
    cost = round3(cost);
    return { revenue, cost, net: round3(revenue - cost) };
  }, [filtered]);

  /**
   * توزيع تكاليف المشروع على بنودها.
   *
   * يُحسب من نفس المجموعة المفلترة، فيستجيب للفترة والبحث معاً: يكتب
   * المهندس «خشب» ويحدّد أغسطس، فيرى نصيب كل بند من ذلك وحده. ولا
   * يدخله إلا ما كان مصروفاً — القبض من العميل ليس تكلفة مشروع.
   */
  const breakdown = useMemo(() => {
    const rows = new Map<
      string,
      { item: string; code: string; account: string; count: number; total: number }
    >();
    let total = 0;

    for (const m of filtered) {
      if (!validate(m).valid) continue;
      const debit = getAccount(m.debitCode);
      if (debit?.type !== "مصروفات") continue;

      const key = `${m.itemName}|${m.debitCode}`;
      const row = rows.get(key) ?? {
        item: m.itemName || "بلا بند",
        code: m.debitCode,
        account: debit.name,
        count: 0,
        total: 0,
      };
      row.count++;
      row.total = round3(row.total + m.amount);
      rows.set(key, row);
      total = round3(total + m.amount);
    }

    return {
      rows: [...rows.values()].sort((a, b) => b.total - a.total),
      total,
    };
  }, [filtered]);

  const items = useMemo(
    () => [...new Set(projectMovements.map((m) => m.itemName).filter(Boolean))],
    [projectMovements]
  );
  const types = useMemo(
    () => [...new Set(projectMovements.map((m) => m.movementType).filter(Boolean))],
    [projectMovements]
  );

  return (
    <Panel title="حركات المشروع" subtitle={projectName}>
      <div className="mb-5 flex gap-3">
        <button onClick={onBack} className="rounded-lg bg-slate-200 px-4 py-2 font-bold">
          العودة للمشاريع
        </button>
        <button
          onClick={() => {
            setTypeFilter("الكل");
            setItemFilter("الكل");
            setFrom("");
            setTo("");
            setSearch("");
          }}
          className="rounded-lg bg-slate-200 px-4 py-2 font-bold"
        >
          مسح الفلاتر
        </button>

        <div className="flex overflow-hidden rounded-lg border border-slate-300">
          {(
            [
              ["lifetime", "كل عمر المشروع"],
              ["year", `سنة ${year} فقط`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setScope(value)}
              className={`px-4 py-2 font-bold ${
                scope === value ? "bg-blue-600 text-white" : "bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          ["إجمالي الإيرادات", summary.revenue],
          ["إجمالي التكاليف", summary.cost],
          ["صافي المشروع", summary.net],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center"
          >
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-xl font-bold">
              <Money value={value as number} /> د.ك
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="نوع الحركة">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={inputClass}
          >
            <option value="الكل">جميع الحركات</option>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="البند">
          <select
            value={itemFilter}
            onChange={(e) => setItemFilter(e.target.value)}
            className={inputClass}
          >
            <option value="الكل">جميع البنود</option>
            {items.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </Field>
        <Field label="من تاريخ">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="إلى تاريخ">
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="البحث في البيان">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="اكتب كلمة من البيان…"
            className={inputClass}
          />
        </Field>
      </div>

      {/* توزيع التكاليف — ما يريده المهندس: كل بند ونصيبه دفعةً واحدة */}
      <div className="mt-8 rounded-xl border border-slate-200 p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-bold">توزيع التكاليف على البنود</h4>
          <span className="text-sm text-slate-500">
            {scope === "lifetime" ? "عمر المشروع كله" : `سنة ${year}`}
            {from || to ? ` · من ${from || "البداية"} إلى ${to || "اليوم"}` : ""}
            {search.trim() ? ` · بيان يحوي «${search.trim()}»` : ""}
          </span>
        </div>

        {breakdown.rows.length === 0 ? (
          <Empty>لا توجد تكاليف ضمن الفلاتر الحالية</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Th>البند</Th>
                  <Th>الحساب</Th>
                  <Th>عدد الحركات</Th>
                  <Th>المبلغ</Th>
                  <Th>النسبة</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {breakdown.rows.map((row) => {
                  const share =
                    breakdown.total > 0 ? (row.total / breakdown.total) * 100 : 0;
                  return (
                    <tr
                      key={`${row.item}|${row.code}`}
                      className="border-b border-slate-100"
                    >
                      <Td className="font-medium">{row.item}</Td>
                      <Td className="text-slate-500">
                        {row.code} — {row.account}
                      </Td>
                      <Td>{row.count}</Td>
                      <Td>
                        <Money value={row.total} />
                      </Td>
                      <Td>{share.toFixed(1)}%</Td>
                      <Td>
                        <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full bg-blue-600"
                            style={{ width: `${Math.min(share, 100)}%` }}
                          />
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-bold">
                <tr>
                  <Td colSpan={3}>إجمالي التكاليف</Td>
                  <Td>
                    <Money value={breakdown.total} bold />
                  </Td>
                  <Td colSpan={2}>100%</Td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <p className="mt-3 text-sm text-slate-500">
          الجدول يتبع الفلاتر أعلاه. لمعرفة تكلفة مادة بعينها — الخشب أو الحديد
          أو الخرسانة — اكتبها في <b>البحث في البيان</b>، فيُحسب نصيبها وحدها.
        </p>
      </div>

      <div className="mt-6 overflow-x-auto">
        <h4 className="mb-3 font-bold">الحركات</h4>
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-100">
            <tr>
              <Th>التاريخ</Th>
              <Th>النوع</Th>
              <Th>البند</Th>
              <Th>البيان</Th>
              <Th>الطريقة</Th>
              <Th>المبلغ</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} className="border-b border-slate-200">
                <Td>{m.date || "—"}</Td>
                <Td>{m.movementType}</Td>
                <Td>{m.itemName || "—"}</Td>
                <Td>{m.description || "—"}</Td>
                <Td>{m.paymentMethod || "—"}</Td>
                <Td>
                  <Money value={m.amount} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <Empty>لا توجد حركات مطابقة للفلاتر</Empty>}
      </div>

      <div className="mt-4 rounded-lg bg-slate-100 px-4 py-3 font-bold">
        عدد الحركات الظاهرة: {filtered.length} | إجمالي المبالغ الظاهرة:{" "}
        <Money value={round3(filtered.reduce((a, m) => a + m.amount, 0))} bold /> د.ك
      </div>
    </Panel>
  );
}

/* ================================================================== */
/* المقاولون                                                           */
/* ================================================================== */

const INSTALLMENT_STATUSES = ["غير مستحقة", "مستحقة", "مدفوعة جزئياً", "مدفوعة"];

const BLANK_CONTRACT = {
  documentType: "عقد",
  /* أكثر ما يُبرَم من هذه الشاشة عقود مقاولين، فهو المبدئي */
  counterpartyType: "مقاول" as CounterpartyType,
  parentContractNumber: "",
  contractDate: "",
  contractNumber: "",
  project: "",

  name: "",
  civilId: "",
  passportNumber: "",
  nationality: "",
  phone: "",
  address: "",
  specialty: "",
  workType: "",
  contractType: "",

  area: "",
  block: "",
  plot: "",
  licenseNumber: "",
  buildingDescription: "",

  durationDays: String(CONTRACT_DEFAULTS.durationDays),
  delayPenaltyPerDay: String(CONTRACT_DEFAULTS.delayPenaltyPerDay),
  maxPenaltyPercent: String(CONTRACT_DEFAULTS.maxPenaltyPercent),
  terminationAfterDays: String(CONTRACT_DEFAULTS.terminationAfterDays),
  warrantyYears: String(CONTRACT_DEFAULTS.warrantyYears),

  preamble: "",
  notes: DEFAULT_NOTES,
  contractValue: "",
};

function ContractorsPage({
  contractors,
  projects,
  movements,
  company,
  setContractors,
  canManage,
  onLink,
  onSplit,
  onUnlinkContract,
  orphans,
  onPrint,
  onLog,
}: {
  contractors: Contractor[];
  projects: Project[];
  movements: Movement[];
  company: CompanyProfile;
  setContractors: Dispatch<SetStateAction<Contractor[]>>;
  /** تحرير العقود ومددها */
  canManage: boolean;
  onLink: (
    movementId: string,
    contractNumber: string,
    installmentNumber: number | undefined
  ) => void;
  /** فكّ ربط كل حركات عقدٍ — يُستدعى عند حذفه */
  onUnlinkContract: (contractNumber: string) => void;
  /** حركاتٌ مربوطة برقم عقدٍ لم يعد موجوداً */
  orphans: Movement[];
  /** توزيع مبلغ حركةٍ واحدة على أكثر من دفعة */
  onSplit: (
    movementId: string,
    contractNumber: string,
    splits: InstallmentSplit[]
  ) => void;
  onPrint: (contract: Contractor) => void;
  onLog: (
    action: AuditAction,
    entity: AuditEntity,
    summary: string,
    change?: { before?: string; after?: string }
  ) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_CONTRACT);
  const [clauses, setClauses] = useState<ContractClause[]>([]);
  const [obligations, setObligations] = useState<string[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [error, setError] = useState("");
  const [linkInstallment, setLinkInstallment] = useState("");

  /*
    توزيع حركةٍ على أكثر من دفعة من هذه الشاشة نفسها: يُفتح السطر تحت
    الحركة، فيُرى مبلغُها وحصصُها معاً — ولا يُحفظ إلا إذا طابق المجموع.
  */
  const [splitFor, setSplitFor] = useState<string | null>(null);
  const [splitRows, setSplitRows] = useState<{ number: number; amount: string }[]>([
    { number: 0, amount: "" },
  ]);

  const openSplit = (movement: Movement) => {
    setSplitFor(movement.id);
    setSplitRows(
      movement.installmentSplits?.length
        ? movement.installmentSplits.map((x) => ({
            number: x.number,
            amount: String(x.amount),
          }))
        : [{ number: 0, amount: "" }]
    );
  };

  const splitParts = splitRows
    .filter((r) => r.number > 0 && round3(Number(r.amount) || 0) > 0)
    .map((r) => ({ number: r.number, amount: round3(Number(r.amount) || 0) }));
  const splitSum = round3(splitParts.reduce((sum, r) => sum + r.amount, 0));
  /*
    النموذج يُفتح أعلى اللوحة وهو طويل، والجدول تحته. فمن ضغط
    «تعديل» على صفٍّ بعيد لا يرى شيئاً يتغيّر أمامه — يبدو الزرّ
    كأنه لا يعمل. فالمرساة تنقل النظر إليه.
  */
  const formRef = useRef<HTMLDivElement | null>(null);

  const selected = contractors.find((c) => c.id === selectedId) ?? null;
  const isAddendum = form.documentType === "ملحق عقد";

  useEffect(() => {
    if (!showForm) return;
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showForm, editingId]);

  const set = (key: keyof typeof BLANK_CONTRACT, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /*
    الصفّ التوثيقي (عقد التراخيص والمخططات المخصوم) ليس دفعة: خصمُه
    مطبَّق سلفاً على القيمة الإجمالية. فعدّه في المجموع يجعل الدفعات
    تزيد عن قيمة العقد بقيمته، ويطالب النموذج بمعادلةٍ مستحيلة.
  */
  const documented = round3(
    installments
      .filter((i) => !isPayableInstallment(i))
      .reduce((a, i) => a + (Number(i.value) || 0), 0)
  );
  const installmentsTotal = round3(
    installments
      .filter(isPayableInstallment)
      .reduce((a, i) => a + (Number(i.value) || 0), 0)
  );
  const contractValue = round3(Number(form.contractValue) || 0);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...BLANK_CONTRACT, contractDate: todayISO() });
    setClauses(DEFAULT_CLAUSES.map((c, i) => ({ ...c, id: `cl-${i}` })));
    setObligations([...DEFAULT_OBLIGATIONS]);
    setInstallments([]);
    setError("");
    setShowForm(true);
  };

  const openEdit = (c: Contractor) => {
    setEditingId(c.id);
    setForm({
      documentType: c.documentType,
      counterpartyType: c.counterpartyType,
      parentContractNumber: c.parentContractNumber,
      contractDate: c.contractDate,
      contractNumber: c.contractNumber,
      project: c.project,
      name: c.name,
      civilId: c.civilId,
      passportNumber: c.passportNumber,
      nationality: c.nationality,
      phone: c.phone,
      address: c.address,
      specialty: c.specialty,
      workType: c.workType,
      contractType: c.contractType,
      area: c.area,
      block: c.block,
      plot: c.plot,
      licenseNumber: c.licenseNumber,
      buildingDescription: c.buildingDescription,
      durationDays: String(c.durationDays),
      delayPenaltyPerDay: String(c.delayPenaltyPerDay),
      maxPenaltyPercent: String(c.maxPenaltyPercent),
      terminationAfterDays: String(c.terminationAfterDays),
      warrantyYears: String(c.warrantyYears),
      preamble: c.preamble,
      notes: c.notes,
      contractValue: String(c.contractValue),
    });
    /*
      قائمةٌ ناقصة في عقدٍ قديم كانت ترمي استثناءً هنا، فلا يُفتح
      النموذج ولا يظهر سبب — والزرّ يبدو معطّلاً.
    */
    setClauses((c.clauses ?? []).map((cl) => ({ ...cl })));
    setObligations([...(c.obligations ?? [])]);
    setInstallments((c.installments ?? []).map((i) => ({ ...i })));
    setError("");
    setShowForm(true);
  };

  const setCount = (raw: string) => {
    const count = Math.max(0, Math.min(Number(raw) || 0, 60));
    setInstallments((prev) =>
      Array.from({ length: count }, (_, index) =>
        prev[index]
          ? { ...prev[index], number: index + 1 }
          : {
              number: index + 1,
              value: "",
              condition: "",
              status: "غير مستحقة",
              approved: false,
              approvedBy: "",
              approvedAt: "",
              approvalNote: "",
              confirmed: false,
              confirmedBy: "",
              confirmedAt: "",
              confirmNote: "",
            }
      )
    );
  };

  const updateInstallment = (
    index: number,
    key: keyof Installment,
    value: string
  ) =>
    setInstallments((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: value } : item))
    );

  /** التمهيد يُبنى من بيانات الموقع ما لم يكتبه المستخدم بنفسه */
  const effectivePreamble =
    form.preamble.trim() ||
    (isAddendum
      ? ""
      : preambleTemplate({
          buildingDescription: form.buildingDescription,
          area: form.area,
          block: form.block,
          plot: form.plot,
          licenseNumber: form.licenseNumber,
        }));

  const save = () => {
    const checks: [boolean, string][] = [
      [!form.name.trim(), "اسم المقاول مطلوب"],
      [!form.contractNumber.trim(), "رقم العقد مطلوب"],
      [!form.project, "اختيار المشروع مطلوب"],
      [!form.contractDate, "تاريخ العقد مطلوب"],
      [contractValue <= 0, "قيمة العقد يجب أن تكون أكبر من صفر"],
      [installments.length === 0, "عدد الدفعات مطلوب"],
      [
        installments.some((i) => !i.value || Number(i.value) <= 0),
        "يجب إدخال قيمة كل دفعة",
      ],
      [
        isAddendum && !form.parentContractNumber.trim(),
        "الملحق يحتاج رقم العقد الأصلي",
      ],
      [
        contractors.some(
          (c) =>
            c.id !== editingId &&
            c.contractNumber.trim().toLowerCase() ===
              form.contractNumber.trim().toLowerCase()
        ),
        "رقم العقد مستخدم مسبقاً",
      ],
      [
        !nearlyEqual(installmentsTotal, contractValue),
        `مجموع الدفعات (${fmt(installmentsTotal)}) لا يساوي قيمة العقد (${fmt(contractValue)})`,
      ],
    ];

    const failed = checks.find(([bad]) => bad);
    if (failed) return setError(failed[1]);

    const record: Contractor = {
      id: editingId ?? newId(),
      name: form.name.trim(),
      specialty: form.specialty.trim(),
      phone: form.phone.trim(),
      project: form.project,
      contractNumber: form.contractNumber.trim(),
      contractType: form.contractType.trim(),
      workType: form.workType.trim(),
      contractValue,
      /* الصفّ التوثيقي ليس دفعة، فلا يُعدّ في عددها */
      installmentsCount: installments.filter(isPayableInstallment).length,
      installments: installments.map((i) => ({ ...i })),

      /*
        نوع الطرف يُختار لا يُخمَّن.

        كان كل عقدٍ يُنشأ من هنا «مقاولاً»، وعقود المورّدين تُدخَل من
        خارج الشاشة. وهي أحد عشر عقداً: الألمنيوم والخرسانة والطابوق
        والتأمين. ومن سمّى مورّداً مقاولاً اختلّ عليه تقريرُ من له
        على الشركة.
      */
      counterpartyType: form.counterpartyType,
      documentType: form.documentType,
      parentContractNumber: form.parentContractNumber.trim(),
      contractDate: form.contractDate,
      civilId: form.civilId.trim(),
      passportNumber: form.passportNumber.trim(),
      nationality: form.nationality.trim(),
      address: form.address.trim(),
      plot: form.plot.trim(),
      block: form.block.trim(),
      area: form.area.trim(),
      licenseNumber: form.licenseNumber.trim(),
      buildingDescription: form.buildingDescription.trim(),
      durationDays: Number(form.durationDays) || 0,
      delayPenaltyPerDay: Number(form.delayPenaltyPerDay) || 0,
      maxPenaltyPercent: Number(form.maxPenaltyPercent) || 0,
      terminationAfterDays: Number(form.terminationAfterDays) || 0,
      warrantyYears: Number(form.warrantyYears) || 0,
      preamble: effectivePreamble,
      clauses: isAddendum ? [] : clauses.map((c) => ({ ...c })),
      obligations: isAddendum ? [] : [...obligations],
      notes: form.notes.trim(),
    };

    setContractors((prev) =>
      editingId ? prev.map((c) => (c.id === editingId ? record : c)) : [...prev, record]
    );
    setShowForm(false);
    setEditingId(null);
    setError("");
  };

  const payments = (c: Contractor) => contractPayments(movements, c.contractNumber);

  /*
    السداد من خارج حسابات الشركة: دعم الدولة يُدفع للمورّد مباشرةً عن
    العميل، فلا قيد له في الدفاتر ولا أثر في القوائم — وإنما يُكتب في
    سجلّ العقد وحده لئلا يظهر العقد مستحقاً وقد سُدّد.
  */
  /*
    القبض القديم كُتب على «عام» و«مصروفات مشتركة» قبل أن تُفتح المشاريع.
    فلا يُعرض مع قبض المشروع إلا بطلب — ومالُ مشروعٍ آخر لا يُعرض بحال.
  */
  const [showUnassigned, setShowUnassigned] = useState(false);

  const [externalFor, setExternalFor] = useState<number | null>(null);
  const [externalAmount, setExternalAmount] = useState("");
  const [externalNote, setExternalNote] = useState("");

  const externalOf = (i: Installment) => round3(Number(i.externalPaid) || 0);

  const externalTotal = (c: Contractor) =>
    round3(
      c.installments
        .filter(isPayableInstallment)
        .reduce((sum, i) => sum + externalOf(i), 0)
    );

  /* خصومات المهندس: تُنقص المستحق ولا تُنقص قيمة العقد */
  const deductionTotal = (c: Contractor) =>
    round3(
      c.installments
        .filter(isPayableInstallment)
        .reduce((sum, i) => sum + installmentDeduction(i), 0)
    );

  const saveExternal = (contract: Contractor, number: number) => {
    const amount = round3(Number(externalAmount) || 0);
    setContractors((prev) =>
      prev.map((c) =>
        c.id !== contract.id
          ? c
          : {
              ...c,
              installments: c.installments.map((i) =>
                i.number !== number
                  ? i
                  : {
                      ...i,
                      externalPaid: amount > 0 ? String(amount) : undefined,
                      externalNote: amount > 0 ? externalNote.trim() : undefined,
                    }
              ),
            }
      )
    );
    onLog(
      amount > 0 ? "تعديل" : "حذف",
      "دفعة",
      amount > 0
        ? `سداد من خارج الشركة — عقد ${contract.contractNumber} · الدفعة ${number} · ${fmt(amount)} د.ك`
        : `إلغاء سداد من خارج الشركة — عقد ${contract.contractNumber} · الدفعة ${number}`,
      { after: amount > 0 ? externalNote.trim() : undefined }
    );
    setExternalFor(null);
    setExternalAmount("");
    setExternalNote("");
  };

  /* عقد العميل يُربط بقبضه، وعقد المقاول بدفعاته — ولا يختلطان */
  const isClientContract = selected?.counterpartyType === "عميل";
  const isSupplierContract = selected?.counterpartyType === "مورّد";
  const candidates = !selected
    ? []
    : isClientContract
      ? unlinkedClientReceipts(movements, selected.project, showUnassigned)
      : isSupplierContract
        ? unlinkedSupplierMovements(movements, selected.project)
        : unlinkedContractorMovements(movements, selected.project);

  /** العقد وملاحقه معاً — الالتزام الحقيقي على المقاول */
  const totalWithAddenda = (c: Contractor) =>
    round3(
      c.contractValue +
        contractors
          .filter((x) => x.parentContractNumber === c.contractNumber)
          .reduce((sum, x) => sum + x.contractValue, 0)
    );

  return (
    <>
      {orphans.length > 0 && (
        <Banner tone="warn">
          <b>{orphans.length}</b> حركة مربوطة بعقودٍ لم تعد موجودة (
          {[...new Set(orphans.map((m) => m.contractNumber))].join("، ")}) بمجموع{" "}
          <b>{fmt(round3(orphans.reduce((s, m) => s + m.amount, 0)))}</b> د.ك — فهي لا
          تظهر في أي عقد ولا بين غير المرتبطة.
          {canManage && (
            <button
              onClick={() => {
                const numbers = [...new Set(orphans.map((m) => m.contractNumber as string))];
                for (const n of numbers) onUnlinkContract(n);
                onLog(
                  "تعديل",
                  "عقد",
                  `فكّ ربط ${orphans.length} حركة بعقودٍ محذوفة: ${numbers.join("، ")}`,
                  {
                    after: orphans
                      .map((m) => `${m.fiscalYear}/${m.entryNo} · ${fmt(m.amount)}`)
                      .join(" · "),
                  }
                );
              }}
              className="mr-3 rounded-lg bg-white px-3 py-1 font-bold text-amber-900 underline"
            >
              فكّ ربطها لتُربط بعقدها الصحيح
            </button>
          )}
        </Banner>
      )}
      {/* المدد أولاً: مدةٌ مضت أثرها خارج النظام لا فيه */}
      <ContractDurationsPanel
        contractors={contractors}
        today={todayISO()}
        canManage={canManage}
        onSetEnd={(contractId, date) =>
          setContractors((prev) =>
            prev.map((c) =>
              c.id === contractId
                ? { ...c, expectedEndDate: date || undefined }
                : c
            )
          )
        }
      />

      <Panel
        title="عقود المقاولين"
        subtitle={`${contractors.length} مستند — «المدفوع» محسوب من قيود الدفع المرتبطة`}
      >
        <button
          onClick={showForm ? () => setShowForm(false) : openNew}
          className="mb-5 rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
        >
          {showForm ? "إخفاء النموذج" : "عقد أو ملحق جديد"}
        </button>

        {showForm && (
          <div
            ref={formRef}
            className="mb-6 space-y-5 rounded-xl border-2 border-blue-300 p-5"
          >
            <h4 className="font-bold">
              {editingId
                ? `تعديل ${form.documentType} ${form.contractNumber}${
                    form.name ? " — " + form.name : ""
                  }`
                : "مستند جديد"}
            </h4>

            {/* بيانات أساسية */}
            <div>
              <p className="mb-2 text-sm font-bold text-slate-600">بيانات أساسية</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="نوع المستند">
                  <select
                    value={form.documentType}
                    onChange={(e) => set("documentType", e.target.value)}
                    className={inputClass}
                  >
                    {DOCUMENT_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>

                <Field label="نوع الطرف الثاني">
                  <select
                    value={form.counterpartyType}
                    onChange={(e) =>
                      set("counterpartyType", e.target.value as CounterpartyType)
                    }
                    className={inputClass}
                  >
                    {COUNTERPARTY_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>

                {isAddendum && (
                  <Field label="رقم العقد الأصلي">
                    <select
                      value={form.parentContractNumber}
                      onChange={(e) => set("parentContractNumber", e.target.value)}
                      className={inputClass}
                    >
                      <option value="">اختر العقد</option>
                      {contractors
                        .filter((c) => c.documentType !== "ملحق عقد")
                        .map((c) => (
                          <option key={c.id} value={c.contractNumber}>
                            {c.contractNumber} — {c.name} ({c.project})
                          </option>
                        ))}
                    </select>
                  </Field>
                )}

                <Field label="رقم المستند">
                  <input
                    type="text"
                    value={form.contractNumber}
                    onChange={(e) => set("contractNumber", e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="التاريخ">
                  <input
                    type="date"
                    value={form.contractDate}
                    onChange={(e) => set("contractDate", e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="المشروع">
                  <select
                    value={form.project}
                    onChange={(e) => set("project", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">اختر المشروع</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="نوع الأعمال">
                  <input
                    type="text"
                    value={form.workType}
                    onChange={(e) => set("workType", e.target.value)}
                    placeholder="هيكل أسود"
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>

            {/* الطرف الثاني */}
            <div>
              <p className="mb-2 text-sm font-bold text-slate-600">
                الطرف الثاني (المقاول)
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {(
                  [
                    ["name", "الاسم"],
                    ["civilId", "الرقم المدني"],
                    ["passportNumber", "رقم الجواز"],
                    ["nationality", "الجنسية"],
                    ["phone", "رقم الهاتف"],
                    ["specialty", "التخصص"],
                  ] as [keyof typeof BLANK_CONTRACT, string][]
                ).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <input
                      type="text"
                      value={form[key]}
                      onChange={(e) => set(key, e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                ))}
              </div>
            </div>

            {!isAddendum && (
              <>
                {/* موقع العمل */}
                <div>
                  <p className="mb-2 text-sm font-bold text-slate-600">موقع العمل</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {(
                      [
                        ["area", "المنطقة"],
                        ["block", "القطعة"],
                        ["plot", "القسيمة"],
                        ["licenseNumber", "رقم الرخصة"],
                      ] as [keyof typeof BLANK_CONTRACT, string][]
                    ).map(([key, label]) => (
                      <Field key={key} label={label}>
                        <input
                          type="text"
                          value={form[key]}
                          onChange={(e) => set(key, e.target.value)}
                          className={inputClass}
                        />
                      </Field>
                    ))}
                    <div className="md:col-span-2">
                      <Field label="وصف المبنى">
                        <input
                          type="text"
                          value={form.buildingDescription}
                          onChange={(e) => set("buildingDescription", e.target.value)}
                          placeholder="نصف سرداب + أرضي + أول + ثاني + سطح"
                          className={inputClass}
                        />
                      </Field>
                    </div>
                  </div>
                </div>

                {/* الشروط */}
                <div>
                  <p className="mb-2 text-sm font-bold text-slate-600">
                    شروط التنفيذ
                  </p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    {(
                      [
                        ["durationDays", "مدة العقد (يوم)"],
                        ["delayPenaltyPerDay", "غرامة التأخير اليومية"],
                        ["maxPenaltyPercent", "حد الغرامات %"],
                        ["terminationAfterDays", "الفسخ بعد (يوم)"],
                        ["warrantyYears", "الكفالة (سنة)"],
                      ] as [keyof typeof BLANK_CONTRACT, string][]
                    ).map(([key, label]) => (
                      <Field key={key} label={label}>
                        <input
                          type="number"
                          min="0"
                          value={form[key]}
                          onChange={(e) => set(key, e.target.value)}
                          className={inputClass}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* التمهيد */}
            <Field
              label="التمهيد"
              hint={
                isAddendum
                  ? "اشرح سبب الملحق وما يضيفه"
                  : "يُبنى تلقائياً من بيانات الموقع إن تركته فارغاً"
              }
            >
              <textarea
                rows={3}
                value={form.preamble}
                onChange={(e) => set("preamble", e.target.value)}
                placeholder={effectivePreamble}
                className={inputClass}
              />
            </Field>

            {!isAddendum && (
              <>
                {/* البنود الفنية */}
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <p className="text-sm font-bold text-slate-600">
                      البنود الفنية ({clauses.length})
                    </p>
                    <button
                      onClick={() =>
                        setClauses((prev) => [
                          ...prev,
                          { id: newId(), title: "", body: "" },
                        ])
                      }
                      className="rounded bg-slate-100 px-3 py-1 text-xs font-bold"
                    >
                      + بند
                    </button>
                  </div>

                  <div className="space-y-3">
                    {clauses.map((clause, index) => (
                      <div
                        key={clause.id}
                        className="rounded-lg border border-slate-200 p-3"
                      >
                        <div className="mb-2 flex gap-2">
                          <input
                            type="text"
                            value={clause.title}
                            onChange={(e) =>
                              setClauses((prev) =>
                                prev.map((c, i) =>
                                  i === index ? { ...c, title: e.target.value } : c
                                )
                              )
                            }
                            placeholder="عنوان البند"
                            className={`${inputClass} font-bold`}
                          />
                          <button
                            onClick={() =>
                              setClauses((prev) => prev.filter((_, i) => i !== index))
                            }
                            className="rounded-lg bg-red-50 px-3 text-red-700"
                          >
                            حذف
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={clause.body}
                          onChange={(e) =>
                            setClauses((prev) =>
                              prev.map((c, i) =>
                                i === index ? { ...c, body: e.target.value } : c
                              )
                            )
                          }
                          className={inputClass}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* الالتزامات */}
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <p className="text-sm font-bold text-slate-600">
                      الالتزامات والمواصفات الفنية ({obligations.length})
                    </p>
                    <button
                      onClick={() => setObligations((prev) => [...prev, ""])}
                      className="rounded bg-slate-100 px-3 py-1 text-xs font-bold"
                    >
                      + التزام
                    </button>
                  </div>

                  <div className="space-y-2">
                    {obligations.map((text, index) => (
                      <div key={index} className="flex gap-2">
                        <span className="pt-3 text-sm font-bold">{index + 1}.</span>
                        <textarea
                          rows={2}
                          value={text}
                          onChange={(e) =>
                            setObligations((prev) =>
                              prev.map((o, i) => (i === index ? e.target.value : o))
                            )
                          }
                          className={inputClass}
                        />
                        <button
                          onClick={() =>
                            setObligations((prev) => prev.filter((_, i) => i !== index))
                          }
                          className="rounded-lg bg-red-50 px-3 text-red-700"
                        >
                          حذف
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* القيمة والدفعات */}
            <div>
              <p className="mb-2 text-sm font-bold text-slate-600">
                القيمة وجدول الدفعات
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="قيمة العقد (د.ك)">
                  <input
                    type="number"
                    step="0.001"
                    value={form.contractValue}
                    onChange={(e) => set("contractValue", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="عدد الدفعات">
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={installments.length || ""}
                    onChange={(e) => setCount(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <div className="flex items-end">
                  <div className="w-full rounded-lg bg-slate-100 px-4 py-3 text-sm font-bold">
                    {contractValue > 0 ? amountInWords(contractValue) : "—"}
                  </div>
                </div>
              </div>

              {installments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {installments.map((installment, index) => {
                    const documentary = !isPayableInstallment(installment);
                    return (
                    <div key={index} className="grid grid-cols-12 gap-2">
                      <div
                        className={`col-span-2 rounded-lg border px-3 py-3 text-sm ${
                          documentary
                            ? "border-amber-200 bg-amber-50 text-amber-900"
                            : "border-slate-200 bg-slate-50"
                        }`}
                        title={
                          documentary
                            ? "صفّ توثيقي — يُطبع في الجدول ولا يدخل المجموع"
                            : installment.stage || ""
                        }
                      >
                        {documentary
                          ? "صفّ توثيقي"
                          : installment.stage || `الدفعة ${index + 1}`}
                      </div>
                      <input
                        type="number"
                        step="0.001"
                        value={installment.value}
                        onChange={(e) =>
                          updateInstallment(index, "value", e.target.value)
                        }
                        placeholder="القيمة"
                        className={`${inputClass} col-span-3`}
                      />
                      <input
                        type="text"
                        value={installment.condition}
                        onChange={(e) =>
                          updateInstallment(index, "condition", e.target.value)
                        }
                        placeholder="شرط الاستحقاق — بعد صب سقف الدور الأرضي"
                        className={`${inputClass} col-span-5`}
                      />
                      {documentary ? (
                        <div className="col-span-2 px-3 py-3 text-sm text-amber-900">
                          مخصوم
                        </div>
                      ) : (
                        <select
                          value={installment.status}
                          onChange={(e) =>
                            updateInstallment(index, "status", e.target.value)
                          }
                          className={`${inputClass} col-span-2`}
                        >
                          {INSTALLMENT_STATUSES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    );
                  })}

                  <div
                    className={`rounded-lg border px-4 py-3 font-medium ${
                      nearlyEqual(installmentsTotal, contractValue)
                        ? "border-green-200 bg-green-50 text-green-800"
                        : "border-amber-200 bg-amber-50 text-amber-900"
                    }`}
                  >
                    مجموع الدفعات {fmt(installmentsTotal)} — قيمة العقد{" "}
                    {fmt(contractValue)}
                    {documented > 0 && (
                      <span className="block text-sm font-normal">
                        ومعها صفّ توثيقي بقيمة {fmt(documented)} مخصومة سلفاً —
                        يُطبع في الجدول ولا يدخل المجموع.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/*
              نقاط «ثانياً: قيمة العقد» سطرٌ لكل نقطة. وحقل السطر الواحد
              كان يبتلع فواصل الأسطر بلا إنذار، فتنقلب النقاط الثلاث
              نقطةً واحدة عند أول حفظ — ويضيع نصُّ العقد.
            */}
            <Field
              label="ملاحظات العقد"
              hint="سطرٌ لكل نقطة — تُطبع نقاطاً تحت «ثانياً: قيمة العقد»"
            >
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                className={inputClass}
              />
            </Field>

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={save}
                className="rounded-lg bg-slate-900 px-6 py-3 font-bold text-white"
              >
                {editingId ? "حفظ التعديل" : "حفظ المستند"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg bg-slate-200 px-6 py-3 font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100">
              <tr>
                <Th>النوع</Th>
                <Th>الرقم</Th>
                <Th>التاريخ</Th>
                <Th>المقاول</Th>
                <Th>المشروع</Th>
                <Th>القيمة</Th>
                <Th>مع الملاحق</Th>
                <Th>المدفوع</Th>
                <Th>المتبقي</Th>
                <Th>الإجراء</Th>
              </tr>
            </thead>
            <tbody>
              {contractors.length === 0 ? (
                <tr>
                  <Td colSpan={10} className="text-center text-slate-500">
                    لا توجد عقود
                  </Td>
                </tr>
              ) : (
                contractors.map((c) => {
                  const paid = payments(c).total;
                  const withAddenda = totalWithAddenda(c);
                  const addendum = c.documentType === "ملحق عقد";
                  return (
                    <tr key={c.id} className="border-b border-slate-200">
                      <Td>
                        {addendum ? (
                          <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">
                            ملحق لـ {c.parentContractNumber}
                          </span>
                        ) : (
                          "عقد"
                        )}
                      </Td>
                      <Td>
                        <button
                          onClick={() => setSelectedId(c.id)}
                          className="text-blue-600 underline"
                        >
                          {c.contractNumber}
                        </button>
                      </Td>
                      <Td>{c.contractDate || "—"}</Td>
                      <Td>{c.name}</Td>
                      <Td>{c.project}</Td>
                      <Td>
                        <Money value={c.contractValue} />
                      </Td>
                      <Td>
                        {withAddenda !== c.contractValue ? (
                          <span className="font-bold text-amber-800">
                            {fmt(withAddenda)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>
                        <Money value={paid} />
                      </Td>
                      <Td>
                        <Money value={round3(c.contractValue - paid)} />
                      </Td>
                      <Td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => onPrint(c)}
                            className="rounded-lg bg-slate-100 px-3 py-2"
                          >
                            🖨 طباعة
                          </button>
                          <button
                            onClick={() => openEdit(c)}
                            className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700"
                          >
                            تعديل
                          </button>
                          <button
                            onClick={() => {
                              /*
                                الحذف يفكّ ربط الحركات ولا يحذفها: تعود إلى
                                «غير المرتبطة» فتُربط بعقدها الصحيح. ويُقال
                                عددها قبل الحذف لا بعده.
                              */
                              const linkedCount = movements.filter(
                                (m) => m.contractNumber === c.contractNumber
                              ).length;
                              const warning =
                                linkedCount > 0
                                  ? `\n\nتنبيه: ${linkedCount} حركة مرتبطة بهذا العقد. حذفه يفكّ ربطها — والقيود نفسها لا تُحذف.`
                                  : "";
                              if (
                                window.confirm(
                                  `حذف «${c.contractNumber}» — ${c.name}؟${warning}`
                                )
                              ) {
                                setContractors((prev) =>
                                  prev.filter((x) => x.id !== c.id)
                                );
                                /* ولا يُفكّ إن بقي عقدٌ آخر بالرقم نفسه */
                                const shared = contractors.some(
                                  (x) =>
                                    x.id !== c.id &&
                                    x.contractNumber === c.contractNumber
                                );
                                if (!shared) onUnlinkContract(c.contractNumber);
                                onLog(
                                  "حذف",
                                  "عقد",
                                  `حذف ${c.documentType} ${c.contractNumber} — ${c.name}${
                                    linkedCount > 0 && !shared
                                      ? ` · فُكّ ربط ${linkedCount} حركة`
                                      : ""
                                  }`
                                );
                                if (selectedId === c.id) setSelectedId(null);
                              }
                            }}
                            className="rounded-lg bg-red-50 px-3 py-2 text-red-700"
                          >
                            حذف
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      {selected && (
        <Panel
          title={`${selected.documentType} ${selected.contractNumber} — ${selected.name}`}
          subtitle={`${selected.project} · ${selected.workType}`}
        >
          <div className="mb-4 flex gap-3">
            <button
              onClick={() => onPrint(selected)}
              className="rounded-lg bg-slate-900 px-5 py-2 font-bold text-white"
            >
              🖨 طباعة المستند
            </button>
            <button
              onClick={() => setSelectedId(null)}
              className="text-sm text-slate-500 hover:underline"
            >
              إغلاق
            </button>
          </div>

          {(() => {
            const p = payments(selected);
            const addenda = contractors.filter(
              (x) => x.parentContractNumber === selected.contractNumber
            );
            return (
              <>
                <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    ["قيمة المستند", selected.contractValue],
                    [isClientContract ? "المقبوض" : "المدفوع", p.total],
                    ...(externalTotal(selected) > 0
                      ? [["مسدَّد من خارج الشركة", externalTotal(selected)] as const]
                      : []),
                    ...(deductionTotal(selected) > 0
                      ? [["خصومات المهندس", deductionTotal(selected)] as const]
                      : []),
                    [
                      "المتبقي",
                      round3(
                        selected.contractValue -
                          p.total -
                          externalTotal(selected) -
                          deductionTotal(selected)
                      ),
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <p className="text-sm text-slate-500">{label}</p>
                      <p className="mt-1 text-xl font-bold">
                        <Money value={value as number} /> د.ك
                      </p>
                    </div>
                  ))}
                </div>

                {addenda.length > 0 && (
                  <Banner tone="warn">
                    لهذا العقد {addenda.length} ملحق بقيمة{" "}
                    {fmt(round3(addenda.reduce((s, a) => s + a.contractValue, 0)))} د.ك —
                    إجمالي الالتزام {fmt(totalWithAddenda(selected))} د.ك
                  </Banner>
                )}

                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <Th>#</Th>
                      <Th>شرط الاستحقاق</Th>
                      <Th>القيمة</Th>
                      <Th>اعتماد الإنجاز</Th>
                      <Th>خصم المهندس</Th>
                      <Th>{isClientContract ? "المقبوض فعلاً" : "المدفوع فعلاً"}</Th>
                      <Th>من خارج الشركة</Th>
                      <Th>المتبقي</Th>
                      <Th>حالة السداد</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.installments.filter(isPayableInstallment).map((i) => {
                      const value = installmentNet(i);
                      const cut = installmentDeduction(i);
                      const paid = p.byInstallment.get(i.number) ?? 0;
                      const external = externalOf(i);
                      const settled = round3(paid + external);
                      const editing = externalFor === i.number;
                      return (
                        <Fragment key={i.number}>
                        <tr className="border-b border-slate-100">
                          <Td>{i.number}</Td>
                          <Td>{i.condition || "—"}</Td>
                          <Td>
                            <Money value={value} />
                            {cut > 0 && (
                              <div className="text-xs text-slate-500">
                                بعد الخصم — قيمتها {fmt(round3(value + cut))}
                              </div>
                            )}
                          </Td>
                          <Td>
                            {cut > 0 ? (
                              <span className="font-bold text-red-700" title={i.deductionReason || ""}>
                                − <Money value={cut} />
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </Td>
                          <Td>
                            {i.approved ? (
                              <span className="font-bold text-green-700">
                                ✓ معتمدة — مستحقة
                              </span>
                            ) : (
                              <span className="text-slate-400">لم تُعتمد</span>
                            )}
                          </Td>
                          <Td>
                            <Money value={paid} />
                          </Td>
                          <Td>
                            {external > 0 ? (
                              <span title={i.externalNote || ""}>
                                <Money value={external} />
                              </span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                            {canManage && (
                              <button
                                onClick={() => {
                                  setExternalFor(editing ? null : i.number);
                                  setExternalAmount(
                                    external > 0 ? String(external) : ""
                                  );
                                  setExternalNote(i.externalNote ?? "");
                                }}
                                className="mr-2 text-xs text-blue-600 underline"
                              >
                                {editing ? "إلغاء" : external > 0 ? "تعديل" : "تسجيل"}
                              </button>
                            )}
                          </Td>
                          <Td>
                            <Money value={round3(value - settled)} />
                          </Td>
                          <Td>
                            {/*
                              الحالة تُقرأ من القيود المرتبطة لا من حقلٍ يُكتب
                              باليد: الدفعة تصير مدفوعةً حين يُربط بها صرفُها،
                              فلا يُقال «مدفوعة» ولا قيد بها. ويُضاف إليها ما
                              سُدّد من خارج الشركة، وهو مكتوبٌ في عموده.
                            */}
                            {/*
                              الزائد يُقال صراحةً: رُبط بالدفعة أكثر من
                              قيمتها — وأكثر ما يكون ذلك من قيدٍ يخصّ دفعةً
                              أخرى. والرقم السالب وحده يُحيّر ولا يدلّ.
                            */}
                            {round3(settled - value) > 0 ? (
                              <span className="font-bold text-red-700">
                                زائد عن قيمة الدفعة بـ {fmt(round3(settled - value))} د.ك
                                — راجع ربط القيود
                              </span>
                            ) : settled <= 0 ? (
                              <span className="text-slate-400">
                                {isClientContract ? "لم تُقبض" : "لم تُدفع"}
                              </span>
                            ) : round3(value - settled) <= 0 ? (
                              <span className="font-bold text-green-700">
                                ✓ {isClientContract ? "مقبوضة بالكامل" : "مدفوعة بالكامل"}
                                {external > 0 && paid <= 0 ? " — من خارج الشركة" : ""}
                              </span>
                            ) : (
                              <span className="font-bold text-amber-700">
                                {isClientContract ? "مقبوضة جزئياً" : "مدفوعة جزئياً"}
                              </span>
                            )}
                          </Td>
                        </tr>
                        {editing && (
                          <tr className="border-b border-blue-200 bg-blue-50">
                            <td colSpan={9} className="p-4">
                              <p className="mb-3 text-sm">
                                سدادٌ لم يمرّ بحساب الشركة — كدعم الدولة يُدفع
                                للمورّد مباشرةً عن العميل.{" "}
                                <b>لا يُسجَّل له قيد في الدفاتر</b>، ولا يظهر في
                                الميزان ولا في القوائم المالية: لا مال دخل ولا خرج.
                              </p>
                              <div className="flex flex-wrap items-end gap-3">
                                <div className="w-40">
                                  <Field label="المبلغ (د.ك)">
                                    <input
                                      type="number"
                                      step="0.001"
                                      value={externalAmount}
                                      onChange={(e) =>
                                        setExternalAmount(e.target.value)
                                      }
                                      className={inputClass}
                                    />
                                  </Field>
                                </div>
                                <div className="min-w-64 flex-1">
                                  <Field label="مصدر السداد">
                                    <input
                                      type="text"
                                      value={externalNote}
                                      onChange={(e) => setExternalNote(e.target.value)}
                                      placeholder="دعم الدولة للتكييف — دُفع للمورّد مباشرةً"
                                      className={inputClass}
                                    />
                                  </Field>
                                </div>
                                <button
                                  onClick={() => saveExternal(selected, i.number)}
                                  className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white"
                                >
                                  حفظ
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>

                <h5 className="mb-3 mt-6 font-bold">
                  {isClientContract ? "قيود القبض المرتبطة" : "قيود الدفع المرتبطة"} (
                  {p.movements.length})
                </h5>
                {p.movements.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    لا توجد قيود مرتبطة بعد — اربطها من القائمة أدناه.
                  </p>
                ) : (
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <Th>القيد</Th>
                        <Th>التاريخ</Th>
                        <Th>البيان</Th>
                        <Th>الدفعة</Th>
                        <Th>المبلغ</Th>
                        <Th>فكّ الربط</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.movements.map((m) => (
                        <Fragment key={m.id}>
                        <tr className="border-b border-slate-100">
                          <Td>{m.entryNo}</Td>
                          <Td>{m.date}</Td>
                          <Td>{m.description || "—"}</Td>
                          <Td>
                            {/* الموزَّع يُقال بحصصه، فالرقم الواحد لا يصفه */}
                            {m.installmentSplits?.length ? (
                              <span title="مبلغٌ واحد موزَّع على أكثر من دفعة">
                                {m.installmentSplits
                                  .map((x) => `${x.number}: ${fmt(x.amount)}`)
                                  .join(" · ")}
                              </span>
                            ) : (
                              m.installmentNumber || "غير محدّدة"
                            )}
                          </Td>
                          <Td>
                            <Money value={m.amount} />
                          </Td>
                          <Td>
                            <button
                              onClick={() => onLink(m.id, "", undefined)}
                              className="rounded-lg bg-slate-100 px-3 py-1"
                            >
                              فكّ
                            </button>
                            {canManage && (
                              <button
                                onClick={() =>
                                  splitFor === m.id ? setSplitFor(null) : openSplit(m)
                                }
                                className="mr-2 text-xs text-blue-600 underline"
                              >
                                {splitFor === m.id ? "إلغاء" : "وزّع"}
                              </button>
                            )}
                          </Td>
                        </tr>
                        {splitFor === m.id && (
                          <tr className="border-b border-blue-200 bg-blue-50">
                            <td colSpan={9} className="p-4">
                              <p className="mb-3 text-sm">
                                وزّع <b>{fmt(m.amount)}</b> د.ك على دفعات العقد —
                                جزءٌ يُتمّ دفعةً والباقي على التي تليها.
                              </p>
                              {splitRows.map((row, index) => (
                                <div
                                  key={index}
                                  className="mb-2 flex flex-wrap items-center gap-3"
                                >
                                  <select
                                    value={row.number || ""}
                                    onChange={(e) =>
                                      setSplitRows(
                                        splitRows.map((r, i) =>
                                          i === index
                                            ? { ...r, number: Number(e.target.value) || 0 }
                                            : r
                                        )
                                      )
                                    }
                                    className={`${inputClass} w-72`}
                                  >
                                    <option value="">اختر الدفعة</option>
                                    {selected.installments
                                      .filter(isPayableInstallment)
                                      .map((i) => (
                                        <option key={i.number} value={i.number}>
                                          الدفعة {i.number} — {fmt(installmentNet(i))} د.ك
                                          {i.condition ? ` · ${i.condition}` : ""}
                                        </option>
                                      ))}
                                  </select>
                                  <input
                                    type="number"
                                    step="0.001"
                                    value={row.amount}
                                    onChange={(e) =>
                                      setSplitRows(
                                        splitRows.map((r, i) =>
                                          i === index ? { ...r, amount: e.target.value } : r
                                        )
                                      )
                                    }
                                    placeholder="المبلغ"
                                    className={`${inputClass} w-40`}
                                  />
                                  {splitRows.length > 1 && (
                                    <button
                                      onClick={() =>
                                        setSplitRows(
                                          splitRows.filter((_, i) => i !== index)
                                        )
                                      }
                                      className="text-sm text-red-700 underline"
                                    >
                                      احذف
                                    </button>
                                  )}
                                </div>
                              ))}
                              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                                <button
                                  onClick={() =>
                                    setSplitRows([
                                      ...splitRows,
                                      { number: 0, amount: "" },
                                    ])
                                  }
                                  className="rounded-lg bg-white px-4 py-2 font-bold text-blue-700"
                                >
                                  + دفعة أخرى
                                </button>
                                <span>
                                  المجموع <b className="tabular-nums">{fmt(splitSum)}</b>{" "}
                                  من <b className="tabular-nums">{fmt(m.amount)}</b> د.ك
                                </span>
                                {round3(m.amount - splitSum) !== 0 ? (
                                  <span className="font-bold text-red-700">
                                    {splitSum < m.amount
                                      ? `ينقص ${fmt(round3(m.amount - splitSum))} د.ك`
                                      : `يزيد ${fmt(round3(splitSum - m.amount))} د.ك`}
                                  </span>
                                ) : (
                                  <span className="font-bold text-green-700">✓ مطابق</span>
                                )}
                                <button
                                  disabled={round3(m.amount - splitSum) !== 0}
                                  onClick={() => {
                                    onSplit(m.id, selected.contractNumber, splitParts);
                                    onLog(
                                      "تعديل",
                                      "عقد",
                                      `توزيع القيد ${m.entryNo} بمبلغ ${fmt(
                                        m.amount
                                      )} د.ك على دفعات العقد ${selected.contractNumber}`,
                                      {
                                        after: splitParts
                                          .map((x) => `الدفعة ${x.number}: ${fmt(x.amount)}`)
                                          .join(" · "),
                                      }
                                    );
                                    setSplitFor(null);
                                  }}
                                  className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white disabled:bg-slate-300"
                                >
                                  حفظ التوزيع
                                </button>
                                <button
                                  onClick={() => setSplitFor(null)}
                                  className="text-sm text-slate-600 underline"
                                >
                                  إلغاء
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                )}

                <h5 className="mb-3 mt-6 font-bold">
                  {isClientContract
                    ? `دفعات قبض من العملاء غير مرتبطة (${candidates.length})`
                    : isSupplierContract
                      ? `مصروفات مباشرة غير مرتبطة في ${selected.project} (${candidates.length})`
                      : `حركات أجور مقاولين غير مرتبطة في ${selected.project} (${candidates.length})`}
                </h5>
                {isClientContract && (
                  <label className="mb-3 flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={showUnassigned}
                      onChange={(e) => setShowUnassigned(e.target.checked)}
                    />
                    أظهر أيضاً القبض المسجَّل على «عام» و«مصروفات مشتركة» — وهو قبضٌ
                    قديم كُتب قبل أن تُفتح المشاريع. ولا يُعرض قبضُ مشروعٍ آخر بحال.
                  </label>
                )}
                {candidates.length === 0 ? (
                  <p className="text-sm text-slate-500">لا توجد حركات مرشّحة.</p>
                ) : (
                  <>
                    <div className="mb-3 max-w-sm">
                      <Field label="اربط بالدفعة رقم">
                        <select
                          value={linkInstallment}
                          onChange={(e) => setLinkInstallment(e.target.value)}
                          className={inputClass}
                        >
                          <option value="">دفعة غير محدّدة</option>
                          {selected.installments
                            .filter(isPayableInstallment)
                            .map((i) => (
                            <option key={i.number} value={i.number}>
                              الدفعة {i.number} — {fmt(Number(i.value) || 0)} د.ك
                            </option>
                            ))}
                        </select>
                      </Field>
                    </div>

                    <table className="w-full text-right text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <Th>القيد</Th>
                          <Th>التاريخ</Th>
                          <Th>البيان</Th>
                          {isClientContract && <Th>المشروع</Th>}
                          {isClientContract && <Th>طريقة الدفع</Th>}
                          {isSupplierContract && <Th>الحساب</Th>}
                          <Th>المبلغ</Th>
                          <Th>ربط</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((m) => (
                          <Fragment key={m.id}>
                          <tr className="border-b border-slate-100">
                            <Td>{m.entryNo}</Td>
                            <Td>{m.date}</Td>
                            <Td>{m.description || "—"}</Td>
                            {isClientContract && <Td>{m.project || "—"}</Td>}
                            {isClientContract && <Td>{m.paymentMethod || "—"}</Td>}
                            {isSupplierContract && <Td>{accountLabel(m.debitCode)}</Td>}
                            <Td>
                              <Money value={m.amount} />
                            </Td>
                            <Td>
                              <button
                                onClick={() =>
                                  onLink(
                                    m.id,
                                    selected.contractNumber,
                                    Number(linkInstallment) || undefined
                                  )
                                }
                                className="rounded-lg bg-blue-600 px-3 py-1 text-white"
                              >
                                ربط
                              </button>
                              <button
                                onClick={() =>
                                  splitFor === m.id ? setSplitFor(null) : openSplit(m)
                                }
                                className="mr-2 text-xs text-blue-600 underline"
                              >
                                {splitFor === m.id ? "إلغاء" : "وزّع على دفعتين"}
                              </button>
                            </Td>
                          </tr>
                        {splitFor === m.id && (
                          <tr className="border-b border-blue-200 bg-blue-50">
                            <td colSpan={9} className="p-4">
                              <p className="mb-3 text-sm">
                                وزّع <b>{fmt(m.amount)}</b> د.ك على دفعات العقد —
                                جزءٌ يُتمّ دفعةً والباقي على التي تليها.
                              </p>
                              {splitRows.map((row, index) => (
                                <div
                                  key={index}
                                  className="mb-2 flex flex-wrap items-center gap-3"
                                >
                                  <select
                                    value={row.number || ""}
                                    onChange={(e) =>
                                      setSplitRows(
                                        splitRows.map((r, i) =>
                                          i === index
                                            ? { ...r, number: Number(e.target.value) || 0 }
                                            : r
                                        )
                                      )
                                    }
                                    className={`${inputClass} w-72`}
                                  >
                                    <option value="">اختر الدفعة</option>
                                    {selected.installments
                                      .filter(isPayableInstallment)
                                      .map((i) => (
                                        <option key={i.number} value={i.number}>
                                          الدفعة {i.number} — {fmt(installmentNet(i))} د.ك
                                          {i.condition ? ` · ${i.condition}` : ""}
                                        </option>
                                      ))}
                                  </select>
                                  <input
                                    type="number"
                                    step="0.001"
                                    value={row.amount}
                                    onChange={(e) =>
                                      setSplitRows(
                                        splitRows.map((r, i) =>
                                          i === index ? { ...r, amount: e.target.value } : r
                                        )
                                      )
                                    }
                                    placeholder="المبلغ"
                                    className={`${inputClass} w-40`}
                                  />
                                  {splitRows.length > 1 && (
                                    <button
                                      onClick={() =>
                                        setSplitRows(
                                          splitRows.filter((_, i) => i !== index)
                                        )
                                      }
                                      className="text-sm text-red-700 underline"
                                    >
                                      احذف
                                    </button>
                                  )}
                                </div>
                              ))}
                              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                                <button
                                  onClick={() =>
                                    setSplitRows([
                                      ...splitRows,
                                      { number: 0, amount: "" },
                                    ])
                                  }
                                  className="rounded-lg bg-white px-4 py-2 font-bold text-blue-700"
                                >
                                  + دفعة أخرى
                                </button>
                                <span>
                                  المجموع <b className="tabular-nums">{fmt(splitSum)}</b>{" "}
                                  من <b className="tabular-nums">{fmt(m.amount)}</b> د.ك
                                </span>
                                {round3(m.amount - splitSum) !== 0 ? (
                                  <span className="font-bold text-red-700">
                                    {splitSum < m.amount
                                      ? `ينقص ${fmt(round3(m.amount - splitSum))} د.ك`
                                      : `يزيد ${fmt(round3(splitSum - m.amount))} د.ك`}
                                  </span>
                                ) : (
                                  <span className="font-bold text-green-700">✓ مطابق</span>
                                )}
                                <button
                                  disabled={round3(m.amount - splitSum) !== 0}
                                  onClick={() => {
                                    onSplit(m.id, selected.contractNumber, splitParts);
                                    onLog(
                                      "تعديل",
                                      "عقد",
                                      `توزيع القيد ${m.entryNo} بمبلغ ${fmt(
                                        m.amount
                                      )} د.ك على دفعات العقد ${selected.contractNumber}`,
                                      {
                                        after: splitParts
                                          .map((x) => `الدفعة ${x.number}: ${fmt(x.amount)}`)
                                          .join(" · "),
                                      }
                                    );
                                    setSplitFor(null);
                                  }}
                                  className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white disabled:bg-slate-300"
                                >
                                  حفظ التوزيع
                                </button>
                                <button
                                  onClick={() => setSplitFor(null)}
                                  className="text-sm text-slate-600 underline"
                                >
                                  إلغاء
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </>
            );
          })()}
        </Panel>
      )}
    </>
  );
}

/* ================================================================== */
/* طباعة العقد                                                         */
/* ================================================================== */

/**
 * ألوان ورق الشركة — مأخوذة من العقود المبرمة المطبوعة.
 *
 * العناوين حمراء، ورأس الجدول بنّي كلون الشعار، والتذييل رملي.
 * ليست اختياراً جمالياً: العقد يُسلَّم للعميل ويُقارَن بسابقه.
 */
/*
 * ألوان العقد وأبعاد جدوله مقروءة من العقد المبرم الموقّع نفسه
 * (عقد عواطف القرطاس): عناوين البنود أحمر صريح، ورأس الجدول وعمود «م»
 * والسطور العريضة بنّي 132,116,80، والخلايا مظلّلة، والحدود سوداء.
 */
const CONTRACT_RED = "#ff0000";
const CONTRACT_BROWN = "#847450";
const CONTRACT_SHADE = "#f2f2f2";
const CONTRACT_SAND = "#efeae0";
/** ورق الشركة — مستخرَج من العقد المبرم، الشعار أعلاه وبيانات التواصل أسفله */
const LETTERHEAD = "/letterhead.jpg";

/**
 * أرقام جدول العقد تُكتب كما في الأصل: بلا فاصل آلاف ولا كسور
 * صفرية — 9000 لا 9,000.000. والكسر يُكتب حين يوجد فقط.
 */
const plainAmount = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(round3(value));

/** عرض أعمدة جدول «رابعاً» بنسب العقد المبرم */
const WORKS_COLUMNS = ["7%", "17%", "14.5%", "32%", "12.5%", "17%"];
const WORKS_HEADERS = ["م", "المرحلة", "البند", "وصف البند", "المواد", "الدفعة المستحقة"];

/**
 * جدول «رابعاً: الأعمال والبنود المتفق عليها» بستة أعمدة كما في العقد.
 *
 * الدفعة الواحدة عدة بنود، والمرحلة الواحدة قد تضم عدة دفعات (التشطيب
 * تسع دفعات برقم 9) — فخلايا «م» و«المرحلة» و«المواد» تُدمج رأسياً على
 * ما تشترك فيه الدفعات المتتالية. والسطر العريض («الانتهاء من الهيكل
 * الأسود») يقطع الدمج كما يقطعه في الأصل.
 */
function ClientWorksTable({ installments }: { installments: Installment[] }) {
  const items = installments.map((i) => ({
    inst: i,
    rows:
      i.rows && i.rows.length > 0
        ? i.rows
        : [{ item: "", description: i.condition }],
  }));

  /**
   * لكل دفعةٍ طولُ الدمج الرأسي إن كانت بداية مجموعة، وإلا صفر.
   *
   * المفتاح يأخذ الترتيب معه: العقود المسجّلة قبل جدول الأعمدة
   * الستة بلا أرقام صفوف ولا مواد، ومفتاحٌ فارغ يجعلها كلها
   * مجموعةً واحدة فتُدمج خلية «م» على العقد كلّه.
   */
  const merges = (key: (i: Installment, index: number) => string) => {
    const span = new Array(items.length).fill(0);
    let g = 0;
    while (g < items.length) {
      let end = g;
      let rows = items[g].rows.length;
      while (
        !items[end].inst.banner &&
        end + 1 < items.length &&
        key(items[end + 1].inst, end + 1) === key(items[g].inst, g)
      ) {
        end++;
        rows += items[end].rows.length;
      }
      span[g] = rows;
      g = end + 1;
    }
    return span;
  };

  const noSpan = merges((i, index) => (i.no ? String(i.no) : "#" + index));
  const stageSpan = merges((i, index) => i.stage || "#" + index);
  /*
    المواد تُدمج داخل صفّ «م» الواحد لا عبره: الدمج عبر الصفوف يصنع
    خليّةً بخمسةٍ وعشرين صفاً لا تنقسم بين صفحتين، فيدفعها المتصفّح
    إلى صفحة جديدة ويترك ما قبلها بياضاً. والعقد المبرم نفسه يعيد
    كتابتها في كل صفحة.
  */
  const matSpan = merges(
    (i, index) => (i.no ? String(i.no) : "#" + index) + "|" + (i.materials ?? "")
  );

  const cell: React.CSSProperties = {
    border: "1px solid #000",
    padding: "6px 8px",
    verticalAlign: "middle",
  };
  const mid: React.CSSProperties = { ...cell, textAlign: "center", fontWeight: 700 };

  return (
    <table
      className="works-table mt-3 w-full text-right"
      style={{ borderCollapse: "collapse" }}
    >
      <colgroup>
        {WORKS_COLUMNS.map((w, index) => (
          <col key={index} style={{ width: w }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {WORKS_HEADERS.map((h) => (
            <th key={h} style={{ ...mid, background: CONTRACT_BROWN }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((it, index) => {
          /* صفّ التسليم لا دفعة له، فيُميَّز بالبنّي كالأصل */
          const closing = Number(it.inst.value) === 0;
          const fill = closing ? CONTRACT_BROWN : CONTRACT_SHADE;
          /* لا اسم للمرحلة في الصفّ الأول، فتبتلع خانتَها خانةُ البند */
          const wide = it.inst.stage ? 0 : 1;
          return (
            <Fragment key={index}>
              {it.rows.map((r, k) => (
                <tr key={k}>
                  {k === 0 && noSpan[index] > 0 && (
                    <td rowSpan={noSpan[index]} style={{ ...mid, background: CONTRACT_BROWN }}>
                      {it.inst.no || index + 1}
                    </td>
                  )}
                  {k === 0 && wide === 0 && stageSpan[index] > 0 && (
                    <td rowSpan={stageSpan[index]} style={{ ...mid, background: fill }}>
                      {it.inst.stage}
                    </td>
                  )}
                  {r.item ? (
                    <>
                      <td colSpan={1 + wide} style={{ ...mid, background: fill }}>
                        {r.item}
                      </td>
                      <td style={{ ...cell, background: fill }}>{r.description}</td>
                    </>
                  ) : (
                    <td colSpan={2 + wide} style={{ ...mid, background: fill }}>
                      {r.description}
                    </td>
                  )}
                  {k === 0 && matSpan[index] > 0 && (
                    <td rowSpan={matSpan[index]} style={{ ...mid, background: fill }}>
                      {it.inst.materials}
                    </td>
                  )}
                  {k === 0 && (
                    <td
                      rowSpan={it.rows.length}
                      className="tabular-nums"
                      style={{ ...mid, background: fill }}
                    >
                      {closing
                        ? ""
                        : (it.inst.informational ? "- " : "") +
                          plainAmount(Number(it.inst.value) || 0)}
                    </td>
                  )}
                </tr>
              ))}
              {it.inst.banner && (
                <tr>
                  <td colSpan={6} style={{ ...mid, background: CONTRACT_BROWN }}>
                    {it.inst.banner}
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function ContractSheet({
  contract,
  company,
  onClose,
}: {
  contract: Contractor;
  company: CompanyProfile;
  onClose: () => void;
}) {
  const isAddendum = contract.documentType === "ملحق عقد";
  /** عقد العميل: الشركة هي المنفّذة، فالدفعات تأتي إليها لا منها */
  const isClient = contract.counterpartyType === "عميل";

  const closing = isClient
    ? clientClosingClauses({
        durationDays: contract.durationDays,
        delayPenaltyPerDay: contract.delayPenaltyPerDay,
        maxPenaltyPercent: contract.maxPenaltyPercent,
        terminationAfterDays: contract.terminationAfterDays,
        terminationPenalty: CLIENT_CONTRACT_DEFAULTS.terminationPenalty,
        warrantyYears: contract.warrantyYears,
      })
    : closingClauses({
        durationDays: contract.durationDays,
        delayPenaltyPerDay: contract.delayPenaltyPerDay,
        maxPenaltyPercent: contract.maxPenaltyPercent,
        terminationAfterDays: contract.terminationAfterDays,
        warrantyYears: contract.warrantyYears,
      });

  // ترقيم البنود متسلسل: الأول للتمهيد، ثم الفنية، ثم الالتزامات، ثم الختامية
  let clauseNo = 1;

  /** عقد العميل يرقّم بنوده بالعربية كما في العقد المبرم */
  const ORDINAL = [
    "",
    "أولاً",
    "ثانياً",
    "ثالثاً",
    "رابعاً",
    "خامساً",
    "سادساً",
    "سابعاً",
    "ثامناً",
    "تاسعاً",
    "عاشراً",
    "الحادي عشرة",
    "الثاني عشر",
    "الثالث عشر",
    "الرابع عشر",
  ];

  return (
    <div
      className="voucher-sheet fixed inset-0 z-50 overflow-auto bg-slate-800/60 p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="voucher-body contract-sheet mx-auto max-w-4xl bg-white shadow-xl"
      >
        <div className="flex justify-end gap-3 p-8 pb-0 no-print">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-slate-900 px-6 py-3 font-bold text-white"
          >
            🖨 طباعة
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-6 py-3 font-bold"
          >
            إغلاق
          </button>
        </div>

        {/*
          ورق الشركة يتكرّر على كل صفحة عند الطباعة لا على الأولى
          وحدها. و thead و tfoot هما الوحيدان اللذان تكرّرهما
          المتصفّحات على كل صفحة وتحجز لهما مكاناً، فلا يركبان على
          النصّ كما يفعل الثابت الموضع. والشريطان من صورة الورق
          نفسها التي طُبع عليها العقد المبرم: أعلاها الشعار وأسفلها
          بيانات التواصل، بمواضعها ومقاساتها لا بتقديرنا.
        */}
        <table className="contract-paper">
          <thead>
            <tr>
              <td>
                <div
                  className="contract-letterhead"
                  style={{
                    width: "100%",
                    aspectRatio: "1529 / 340",
                    backgroundImage: `url(${LETTERHEAD})`,
                    backgroundSize: "100% auto",
                    backgroundPosition: "top center",
                    backgroundRepeat: "no-repeat",
                  }}
                />
              </td>
            </tr>
          </thead>
          <tfoot>
            <tr>
              <td>
                <div
                  className="contract-letterhead"
                  style={{
                    width: "100%",
                    aspectRatio: "1529 / 300",
                    backgroundImage: `url(${LETTERHEAD})`,
                    backgroundSize: "100% auto",
                    backgroundPosition: "bottom center",
                    backgroundRepeat: "no-repeat",
                  }}
                />
              </td>
            </tr>
          </tfoot>
          <tbody>
            <tr>
              <td>
        <div className="px-12 pb-8 pt-2">

          <h1 className="mb-8 text-center text-2xl font-bold">
            {isAddendum
              ? `ملحق عقد${contract.workType ? ` — ${contract.workType}` : ""}`
              : contract.workType || "عقد اتفاق"}
          </h1>

        <p className="mb-3 text-sm font-bold">
          التاريخ : {contract.contractDate || "…"}
        </p>
        <p className="mb-4 text-sm font-bold">
          تم تحرير عقد الاتفاق بين كل من :
        </p>

        {/*
          الأطراف بترتيب العقد المبرم وأسطره: الطرف الأول فعنوانه، ثم
          الطرف الثاني فرقم تواصله فرقمه المدني — كلٌّ في سطر، لا
          مجموعةً على سطرٍ واحد بشرطات.
        */}
        <div className="mb-6 space-y-2 text-sm font-bold leading-relaxed">
          <p>الطرف الأول : السادة / {company.name}</p>
          {company.address && <p>العنوان : {company.address}</p>}
          <p>
            الطرف الثاني : {isClient ? <>السادة / </> : <>السيد / </>}
            {contract.name}
          </p>
          {contract.phone && <p>رقم التواصل : {contract.phone}</p>}
          {contract.civilId && <p>الرقم المدني : {contract.civilId}</p>}
          {contract.passportNumber && (
            <p>رقم الجواز : {contract.passportNumber}</p>
          )}
          {contract.nationality && <p>الجنسية : {contract.nationality}</p>}
        </div>

        {/* التمهيد */}
        {contract.preamble && (
          <div className="mb-5">
            <h2 className="mb-2 text-center text-lg font-bold" style={{ color: CONTRACT_RED }}>تمهيد</h2>
            <p className="text-sm leading-loose">{contract.preamble}</p>
          </div>
        )}

        {/*
          عقد العميل يتبع ترتيب العقد المبرم وترقيمه العربي حرفياً:
          أولاً التمهيد · ثانياً قيمة العقد · ثالثاً المدة · رابعاً الأعمال ·
          خامساً وسادساً الالتزامات · ثم الجزائية فالعامة فالدعاية فالكفالة
          فالأحكام فالعقد. العقد مراجَع قانونياً، والترتيب جزء منه.
        */}
        {isClient && !isAddendum && (
          <>
            <div className="mb-5">
              <h3 className="mb-1 font-bold" style={{ color: CONTRACT_RED }}>{ORDINAL[clauseNo++]}:</h3>
              <p className="text-sm leading-loose">{CLIENT_FIRST_CLAUSE}</p>
            </div>

            <div className="mb-5">
              <h3 className="mb-1 font-bold" style={{ color: CONTRACT_RED }}>
                {ORDINAL[clauseNo++]}: قيمة العقد
              </h3>
              {/*
                نقاط «ثانياً» بنصّها وترتيبها كما في العقد المبرم: القيمة
                الإجمالية، ثم خصم عقد التراخيص، ثم القيمة النهائية — كلٌّ
                في سطرٍ ونقطةٍ وحده. وكتابة قيمة العقد هنا مولَّدةً تكرّر
                النقطة الأولى وتخالف نصّها، فلا تُكتب إلا حين لا نقاط.
              */}
              <ul className="list-inside list-disc text-sm leading-loose">
                {(contract.notes
                  ? contract.notes.split("\n").filter((line) => line.trim())
                  : [
                      `القيمة الإجمالية للعقد = ${fmt(
                        contract.contractValue
                      )} دينار كويتي لا غير.`,
                    ]
                ).map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </div>

            <div className="mb-5">
              <h3 className="mb-1 font-bold" style={{ color: CONTRACT_RED }}>
                {ORDINAL[clauseNo++]}: مدة العقد
              </h3>
              <p className="text-sm leading-loose">
                {clientDurationClause(contract.durationDays)}
              </p>
            </div>
          </>
        )}

        {!isClient && !isAddendum && (
          <>
            <div className="mb-5">
              <h3 className="mb-1 font-bold underline">
                البند {clauseNo++} — التمهيد
              </h3>
              <p className="text-sm leading-loose">
                التمهيد المتقدم السابق جزءا لا يتجزأ من العقد ومتمما لبنوده وكذلك
                أية مراسلات أخرى تتم بين الطرفين.
              </p>
            </div>

            {contract.clauses.length > 0 && (
              <div className="mb-5 space-y-3">
                {contract.clauses.map((clause) => (
                  <div key={clause.id}>
                    <h4 className="font-bold underline">{clause.title}</h4>
                    <p className="text-sm leading-loose">{clause.body}</p>
                  </div>
                ))}
              </div>
            )}

            {contract.obligations.length > 0 && (
              <div className="mb-5">
                <h3 className="mb-2 font-bold underline">
                  البند {clauseNo++} — الالتزامات والمواصفات الفنية
                </h3>
                <ol className="space-y-2 text-sm leading-loose">
                  {contract.obligations.map((text, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="font-bold">{index + 1}.</span>
                      <span>{text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}

        {/* القيمة والدفعات */}
        <div className="mb-5">
          {!isAddendum && (
            <h3 className="mb-2 font-bold" style={{ color: CONTRACT_RED }}>
              {isClient
                ? `${ORDINAL[clauseNo++]}: الأعمال والبنود المتفق عليها`
                : `البند ${clauseNo++} — السعر الإجمالي`}
            </h3>
          )}
          {!isClient && (
            <p className="text-sm leading-loose">
              السعر الإجمالي المتفق عليه بين الطرفين مبلغ وقدره (
              <b>{fmt(contract.contractValue)}</b>) دينار كويتي —{" "}
              {amountInWords(contract.contractValue)} — تسدد من قبل الطرف الأول
              للطرف الثاني على النحو التالي:
            </p>
          )}

          {/*
            عقد العميل يُطبع بجدوله الأصلي ذي الأعمدة الستة وبلا سطر
            إجمالي — فالعقد المبرم لا إجمالي فيه، ومجموع دفعاته الموجبة
            هو القيمة النهائية المنصوص عليها في «ثانياً».
          */}
          {isClient ? (
            <ClientWorksTable installments={contract.installments} />
          ) : (
            <table className="works-table mt-3 w-full border-collapse text-right text-sm">
              <thead>
                <tr className="bg-slate-200">
                  <th className="border border-slate-400 px-3 py-2">م</th>
                  <th className="border border-slate-400 px-3 py-2">الدفعة</th>
                  <th className="border border-slate-400 px-3 py-2">البند</th>
                  <th className="border border-slate-400 px-3 py-2">القيمة</th>
                </tr>
              </thead>
              <tbody>
                {contract.installments.map((i) => (
                  <tr key={i.number}>
                    <td className="border border-slate-400 px-3 py-2">
                      {i.number}
                    </td>
                    <td className="border border-slate-400 px-3 py-2">
                      الدفعة {i.number}
                    </td>
                    <td className="border border-slate-400 px-3 py-2">
                      {i.condition || "—"}
                    </td>
                    <td className="border border-slate-400 px-3 py-2 tabular-nums">
                      {fmt(Number(i.value) || 0)} د.ك
                    </td>
                  </tr>
                ))}
                <tr className="font-bold" style={{ background: CONTRACT_SAND }}>
                  <td colSpan={3} className="border border-slate-400 px-3 py-2">
                    إجمالي الدفعات
                  </td>
                  <td className="border border-slate-400 px-3 py-2 tabular-nums">
                    {fmt(contract.contractValue)} د.ك
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* التزامات الطرفين — بعد جدول الأعمال كما في العقد المبرم */}
        {isClient && !isAddendum && (
          <>
            <div className="mb-5">
              <h3 className="mb-2 font-bold" style={{ color: CONTRACT_RED }}>
                {ORDINAL[clauseNo++]}: التزامات الطرف الأول (الشركة)
              </h3>
              <ul className="list-inside list-disc space-y-1 text-sm leading-loose">
                {CLIENT_FIRST_PARTY_DUTIES.map((text, index) => (
                  <li key={index}>{text}</li>
                ))}
              </ul>
            </div>

            {contract.obligations.length > 0 && (
              <div className="mb-5">
                <h3 className="mb-2 font-bold" style={{ color: CONTRACT_RED }}>
                  {ORDINAL[clauseNo++]}: التزامات الطرف الثاني (المالك)
                </h3>
                <ul className="list-inside list-disc space-y-1 text-sm leading-loose">
                  {contract.obligations.map((text, index) => (
                    <li key={index}>{text}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {/* البنود الختامية */}
        {!isAddendum &&
          closing.map((clause) => (
            <div key={clause.title} className="mb-4">
              <h3 className="mb-1 font-bold" style={{ color: CONTRACT_RED }}>
                {isClient
                  ? `${ORDINAL[clauseNo++]}: ${clause.title}`
                  : `البند ${clauseNo++} — ${clause.title}`}
              </h3>
              {/* نقاط العقد بتعدادٍ واحد في كل بنوده، كالأصل */}
              {isClient ? (
                <ul className="list-inside list-disc space-y-1 text-sm leading-loose">
                  {clause.body.split("\n").map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
              ) : (
                clause.body.split("\n").map((line, index) => (
                  <p key={index} className="text-sm leading-loose">
                    {line}
                  </p>
                ))
              )}
            </div>
          ))}

        {/* ملاحظات العقد تظهر مع قيمته في عقد العميل، فلا تُكرَّر هنا */}
        {contract.notes && !isClient && (
          <div className="mb-6">
            <h4 className="font-bold underline">ملاحظة:</h4>
            <p className="text-sm">{contract.notes}</p>
          </div>
        )}

        <p className="mb-10 text-center font-bold">
          {isClient
            ? "هذا وتفضلوا منا بقبول فائق الاحترام والتقدير ،،،،"
            : "هذا و تفضلوا منا فائق الإحترام و التقدير ،،،،،"}
        </p>

        {/* التواقيع — لا تنقسم بين صفحتين */}
        <div className="print-block grid grid-cols-2 gap-12 text-sm">
          <div>
            <p className="mb-1 font-bold underline">
              {isClient ? "توقيع الطرف الأول" : "طرف أول (الشركة)"}
            </p>
            <p>الاسم / {company.name}</p>
            <p className="mt-10">التوقيع / ..............................</p>
          </div>
          <div>
            <p className="mb-1 font-bold underline">
              {isClient
                ? "توقيع الطرف الثاني"
                : `طرف ثاني (${contract.counterpartyType})`}
            </p>
            <p>
              {isClient ? "السيد/ة / " : "السيد / "}
              {contract.name}
            </p>
            <p className="mt-10">التوقيع / ..............................</p>
          </div>
        </div>
        </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
/* ================================================================== */
/* متابعة السلف والعهد                                                 */
/* ================================================================== */

function AdvancesPage({
  movements,
  year,
  onEdit,
}: {
  movements: Movement[];
  year: number;
  onEdit: (movement: Movement) => void;
}) {
  const [person, setPerson] = useState<string | null>(null);
  const report = useMemo(() => buildAdvances(movements), [movements]);
  const selected = report.rows.find((r) => r.person === person) ?? null;

  const verdict = (balance: number) =>
    isZero(balance)
      ? { text: "مسوّاة", cls: "text-slate-500" }
      : balance > 0
      ? { text: "بذمته للشركة", cls: "text-amber-700 font-bold" }
      : { text: "الشركة مدينة له", cls: "text-blue-700 font-bold" };

  return (
    <>
      <Panel
        title={`متابعة السلف والعهد ${year}`}
        subtitle="حـ/1140 عهد الموظفين · حـ/1240 سلف الموظفين — محسوبة من القيود مباشرة"
      >
        {report.rows.length === 0 ? (
          <Empty>لا توجد حركات سلف أو عهد في هذه السنة</Empty>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
              {[
                ["إجمالي المسلَّم", report.totals.given],
                ["إجمالي المصروف والمسدَّد", report.totals.settled],
                ["صافي الأرصدة القائمة", report.totals.balance],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="mt-1 text-xl font-bold">
                    <Money value={value as number} /> د.ك
                  </p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <Th>الموظف</Th>
                    <Th>الحسابات</Th>
                    <Th>الحركات</Th>
                    <Th>مسلَّم له</Th>
                    <Th>مصروف / مسدَّد</Th>
                    <Th>الرصيد</Th>
                    <Th>الحالة</Th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => {
                    const v = verdict(row.balance);
                    return (
                      <tr key={row.person} className="border-b border-slate-200">
                        <Td>
                          <button
                            onClick={() =>
                              setPerson(person === row.person ? null : row.person)
                            }
                            className="font-bold text-blue-700 hover:underline"
                          >
                            {row.person}
                          </button>
                        </Td>
                        <Td>{row.accounts.join("، ")}</Td>
                        <Td>{row.lines.length}</Td>
                        <Td>
                          <Money value={row.given} />
                        </Td>
                        <Td>
                          <Money value={row.settled} />
                        </Td>
                        <Td>
                          <Money value={Math.abs(row.balance)} bold />
                        </Td>
                        <Td className={v.cls}>{v.text}</Td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-100 font-bold">
                  <tr>
                    <Td colSpan={3}>الإجمالي</Td>
                    <Td>
                      <Money value={report.totals.given} bold />
                    </Td>
                    <Td>
                      <Money value={report.totals.settled} bold />
                    </Td>
                    <Td>
                      <Money value={report.totals.balance} bold />
                    </Td>
                    <Td>{""}</Td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {report.unnamed.length > 0 && (
          <div className="mt-5">
            <Banner tone="warn">
              <b>{report.unnamed.length}</b> حركة سلف أو عهدة بلا اسم موظف — لا
              يمكن نسبتها لأحد. حدّد «الدافع / المستلم» فيها من الجدول أدناه.
            </Banner>
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Th>القيد</Th>
                  <Th>التاريخ</Th>
                  <Th>البيان</Th>
                  <Th>مدين</Th>
                  <Th>دائن</Th>
                  <Th>المبلغ</Th>
                  <Th>الإجراء</Th>
                </tr>
              </thead>
              <tbody>
                {report.unnamed.map((m) => (
                  <tr key={m.id} className="border-b border-slate-200">
                    <Td>{m.entryNo}</Td>
                    <Td>{m.date}</Td>
                    <Td>{m.description || "—"}</Td>
                    <Td>{m.debitCode}</Td>
                    <Td>{m.creditCode}</Td>
                    <Td>
                      <Money value={m.amount} />
                    </Td>
                    <Td>
                      <button
                        onClick={() => onEdit(m)}
                        className="rounded-lg bg-blue-600 px-3 py-2 font-medium text-white"
                      >
                        تحديد الموظف
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {selected && (
        <Panel
          title={`كشف حساب — ${selected.person}`}
          subtitle={`${selected.lines.length} حركة · الرصيد ${fmt(
            Math.abs(selected.balance)
          )} د.ك ${verdict(selected.balance).text}`}
        >
          <button
            onClick={() => setPerson(null)}
            className="mb-4 text-sm text-slate-500 hover:underline"
          >
            إغلاق الكشف
          </button>

          <div className="max-h-[30rem] overflow-auto">
            <table className="w-full text-right text-sm">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  <Th>القيد</Th>
                  <Th>التاريخ</Th>
                  <Th>البيان</Th>
                  <Th>الحساب</Th>
                  <Th>مسلَّم</Th>
                  <Th>مصروف / مسدَّد</Th>
                  <Th>الرصيد</Th>
                  <Th>تعديل</Th>
                </tr>
              </thead>
              <tbody>
                {selected.lines.map((line) => (
                  <tr key={line.movement.id} className="border-b border-slate-100">
                    <Td>{line.movement.entryNo}</Td>
                    <Td>{line.movement.date}</Td>
                    <Td>{line.movement.description || "—"}</Td>
                    <Td>{line.account}</Td>
                    <Td>{line.given ? <Money value={line.given} /> : "—"}</Td>
                    <Td>{line.settled ? <Money value={line.settled} /> : "—"}</Td>
                    <Td>
                      <Money value={line.balance} />
                    </Td>
                    <Td>
                      <button
                        onClick={() => onEdit(line.movement)}
                        className="rounded-lg bg-blue-50 px-3 py-1 text-blue-700"
                      >
                        تعديل
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}



/* ================================================================== */
/* استلام مواد المواقع                                                 */
/* ================================================================== */

function MaterialsPage({
  year,
  projects,
  materials,
  receipts,
  setMaterials,
  setReceipts,
}: {
  year: number;
  projects: Project[];
  materials: Material[];
  receipts: MaterialReceipt[];
  setMaterials: Dispatch<SetStateAction<Material[]>>;
  setReceipts: Dispatch<SetStateAction<MaterialReceipt[]>>;
}) {
  const blank = {
    date: "",
    project: "",
    material: "",
    quantity: "",
    unitPrice: "",
    receivedBy: "",
    note: "",
  };

  const [form, setForm] = useState(blank);
  const [error, setError] = useState("");
  const [projectFilter, setProjectFilter] = useState("الكل");
  const [showCatalogue, setShowCatalogue] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ name: "", unitPrice: "" });

  const set = (key: keyof typeof blank, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // اختيار المادة يملأ سعرها الاسترشادي، ويبقى قابلاً للتعديل
  const pickMaterial = (name: string) => {
    const found = materials.find((m) => m.name === name);
    setForm((prev) => ({
      ...prev,
      material: name,
      unitPrice: found?.unitPrice != null ? String(found.unitPrice) : "",
    }));
  };

  const filtered = useMemo(
    () =>
      receipts
        .filter((r) => projectFilter === "الكل" || r.project === projectFilter)
        .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)),
    [receipts, projectFilter]
  );

  const totalCost = round3(
    filtered.reduce((sum, r) => sum + (receiptCost(r) ?? 0), 0)
  );
  const missingPrice = filtered.filter((r) => r.unitPrice == null);

  const byProject = useMemo(() => {
    const map = new Map<string, { count: number; cost: number; gaps: number }>();
    for (const r of receipts) {
      const row = map.get(r.project) ?? { count: 0, cost: 0, gaps: 0 };
      row.count++;
      const cost = receiptCost(r);
      if (cost == null) row.gaps++;
      else row.cost = round3(row.cost + cost);
      map.set(r.project, row);
    }
    return [...map.entries()].sort((a, b) => b[1].cost - a[1].cost);
  }, [receipts]);

  const add = () => {
    const quantity = round3(Number(form.quantity) || 0);
    const checks: [boolean, string][] = [
      [!form.date, "التاريخ مطلوب"],
      [!form.project, "المشروع مطلوب"],
      [!form.material, "نوع المادة مطلوب"],
      [quantity <= 0, "الكمية يجب أن تكون أكبر من صفر"],
      [!form.receivedBy.trim(), "اسم المستلم مطلوب"],
    ];
    const failed = checks.find(([bad]) => bad);
    if (failed) return setError(failed[1]);

    setReceipts((prev) => [
      ...prev,
      {
        id: newId(),
        date: form.date,
        fiscalYear: fiscalYearOf(form.date),
        project: form.project,
        material: form.material,
        quantity,
        unitPrice: form.unitPrice === "" ? null : round3(Number(form.unitPrice)),
        receivedBy: form.receivedBy.trim(),
        note: form.note.trim(),
      },
    ]);
    setForm(blank);
    setError("");
  };

  return (
    <>
      <Panel
        title={`استلام مواد المواقع ${year}`}
        subtitle="سجلّ عيني لما وصل كل موقع — لا يُنتج قيوداً محاسبية"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="التاريخ">
            <input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="المشروع">
            <select
              value={form.project}
              onChange={(e) => set("project", e.target.value)}
              className={inputClass}
            >
              <option value="">اختر المشروع</option>
              {projects.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="نوع المادة">
            <select
              value={form.material}
              onChange={(e) => pickMaterial(e.target.value)}
              className={inputClass}
            >
              <option value="">اختر المادة</option>
              {materials.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                  {m.unitPrice == null ? " (بلا سعر)" : ` — ${fmt(m.unitPrice)}`}
                </option>
              ))}
            </select>
          </Field>

          <Field label="الكمية">
            <input
              type="number"
              step="0.001"
              min="0"
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field
            label="سعر الوحدة"
            hint="اتركه فارغاً إن لم يكن معروفاً — لن تُحتسب تكلفة"
          >
            <input
              type="number"
              step="0.001"
              min="0"
              value={form.unitPrice}
              onChange={(e) => set("unitPrice", e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field label="المستلم">
            <input
              type="text"
              value={form.receivedBy}
              onChange={(e) => set("receivedBy", e.target.value)}
              placeholder="اسم المستلم في الموقع"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="flex-1">
            <Field label="ملاحظات">
              <input
                type="text"
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="rounded-lg bg-slate-100 px-4 py-3 font-bold">
            التكلفة:{" "}
            {form.unitPrice === "" || !form.quantity
              ? "—"
              : `${fmt(round3(Number(form.quantity) * Number(form.unitPrice)))} د.ك`}
          </div>
        </div>

        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

        <button
          onClick={add}
          className="mt-4 rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
        >
          تسجيل الاستلام
        </button>
      </Panel>

      <Panel title="ملخص حسب المشروع">
        {byProject.length === 0 ? (
          <Empty>لا توجد سجلات استلام في هذه السنة</Empty>
        ) : (
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100">
              <tr>
                <Th>المشروع</Th>
                <Th>عدد السجلات</Th>
                <Th>التكلفة المحتسبة</Th>
                <Th>سجلات بلا سعر</Th>
              </tr>
            </thead>
            <tbody>
              {byProject.map(([project, row]) => (
                <tr key={project} className="border-b border-slate-200">
                  <Td>{project}</Td>
                  <Td>{row.count}</Td>
                  <Td>
                    <Money value={row.cost} />
                  </Td>
                  <Td className={row.gaps ? "text-amber-700 font-bold" : ""}>
                    {row.gaps || "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title={`سجل الاستلام (${filtered.length})`}>
        <div className="mb-4 max-w-sm">
          <Field label="تصفية بالمشروع">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className={inputClass}
            >
              <option value="الكل">جميع المشاريع</option>
              {[...new Set(receipts.map((r) => r.project))].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
        </div>

        {missingPrice.length > 0 && (
          <Banner tone="warn">
            <b>{missingPrice.length}</b> سجل بلا سعر وحدة، فلا تُحتسب تكلفته.
            حدّد السعر في كتالوج المواد أو في السجل نفسه.
          </Banner>
        )}

        {filtered.length === 0 ? (
          <Empty>لا توجد سجلات</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Th>التاريخ</Th>
                  <Th>المشروع</Th>
                  <Th>المادة</Th>
                  <Th>الكمية</Th>
                  <Th>سعر الوحدة</Th>
                  <Th>التكلفة</Th>
                  <Th>المستلم</Th>
                  <Th>حذف</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const cost = receiptCost(r);
                  return (
                    <tr key={r.id} className="border-b border-slate-200">
                      <Td>{r.date}</Td>
                      <Td>{r.project}</Td>
                      <Td>{r.material}</Td>
                      <Td>{fmt(r.quantity)}</Td>
                      <Td>{r.unitPrice == null ? "—" : fmt(r.unitPrice)}</Td>
                      <Td>
                        {cost == null ? (
                          <span className="text-amber-700">بلا سعر</span>
                        ) : (
                          <Money value={cost} />
                        )}
                      </Td>
                      <Td>{r.receivedBy}</Td>
                      <Td>
                        <button
                          onClick={() => {
                            if (window.confirm(`حذف سجل «${r.material}»؟`)) {
                              setReceipts((prev) =>
                                prev.filter((x) => x.id !== r.id)
                              );
                            }
                          }}
                          className="rounded-lg bg-red-50 px-3 py-2 text-red-700"
                        >
                          حذف
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 font-bold">
                <tr>
                  <Td colSpan={5}>إجمالي التكلفة المحتسبة</Td>
                  <Td>
                    <Money value={totalCost} bold />
                  </Td>
                  <Td colSpan={2}>{""}</Td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="كتالوج المواد">
        <button
          onClick={() => setShowCatalogue(!showCatalogue)}
          className="mb-4 rounded-lg bg-slate-200 px-5 py-2 font-bold"
        >
          {showCatalogue ? "إخفاء" : `عرض وتحرير (${materials.length} صنف)`}
        </button>

        {showCatalogue && (
          <>
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Th>نوع المادة</Th>
                  <Th>سعر الوحدة</Th>
                  <Th>حذف</Th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} className="border-b border-slate-200">
                    <Td>{m.name}</Td>
                    <Td>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={m.unitPrice ?? ""}
                        placeholder="بلا سعر"
                        onChange={(e) =>
                          setMaterials((prev) =>
                            prev.map((x) =>
                              x.id === m.id
                                ? {
                                    ...x,
                                    unitPrice:
                                      e.target.value === ""
                                        ? null
                                        : round3(Number(e.target.value)),
                                  }
                                : x
                            )
                          )
                        }
                        className="w-40 rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </Td>
                    <Td>
                      <button
                        onClick={() =>
                          setMaterials((prev) => prev.filter((x) => x.id !== m.id))
                        }
                        className="rounded-lg bg-red-50 px-3 py-2 text-red-700"
                      >
                        حذف
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex flex-wrap gap-3">
              <input
                type="text"
                value={newMaterial.name}
                onChange={(e) =>
                  setNewMaterial((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="اسم المادة"
                className={`${inputClass} flex-1`}
              />
              <input
                type="number"
                step="0.001"
                value={newMaterial.unitPrice}
                onChange={(e) =>
                  setNewMaterial((p) => ({ ...p, unitPrice: e.target.value }))
                }
                placeholder="سعر الوحدة (اختياري)"
                className={`${inputClass} flex-1`}
              />
              <button
                onClick={() => {
                  const name = newMaterial.name.trim();
                  if (!name || materials.some((m) => m.name === name)) return;
                  setMaterials((prev) => [
                    ...prev,
                    {
                      id: newId(),
                      name,
                      unitPrice:
                        newMaterial.unitPrice === ""
                          ? null
                          : round3(Number(newMaterial.unitPrice)),
                    },
                  ]);
                  setNewMaterial({ name: "", unitPrice: "" });
                }}
                className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
              >
                إضافة مادة
              </button>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}

/* ================================================================== */
/* دليل الحسابات                                                       */
/* ================================================================== */

function ChartPage() {
  const [onlyPostable, setOnlyPostable] = useState(false);
  const rows = onlyPostable
    ? CHART_OF_ACCOUNTS.filter((a) => a.postable)
    : CHART_OF_ACCOUNTS;

  return (
    <Panel
      title="دليل الحسابات"
      subtitle={`${CHART_OF_ACCOUNTS.length} حساباً — منقول من الإكسل، ومصدر واحد لكل الشاشات`}
    >
      <label className="mb-4 flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={onlyPostable}
          onChange={(e) => setOnlyPostable(e.target.checked)}
        />
        عرض حسابات الترحيل فقط (إخفاء الحسابات الرئيسية التجميعية)
      </label>

      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-100">
            <tr>
              <Th>رقم الحساب</Th>
              <Th>اسم الحساب</Th>
              <Th>الحساب الرئيسي</Th>
              <Th>التصنيف</Th>
              <Th>الطبيعة</Th>
              <Th>يظهر في</Th>
              <Th>يسمح بالترحيل</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a: Account) => (
              <tr
                key={a.code}
                className={`border-b border-slate-200 ${
                  a.postable ? "" : "bg-slate-50 font-bold"
                }`}
              >
                <Td>{a.code}</Td>
                <Td>
                  <span style={{ paddingRight: `${(a.level - 1) * 16}px` }}>
                    {a.name}
                  </span>
                </Td>
                <Td>{a.parent || "—"}</Td>
                <Td>{a.type}</Td>
                <Td>{a.nature}</Td>
                <Td>{a.statement}</Td>
                <Td>
                  {a.postable ? (
                    <span className="text-green-700">نعم</span>
                  ) : (
                    <span className="text-slate-400">لا — حساب تجميعي</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ================================================================== */
/* الأرصدة الافتتاحية                                                  */
/* ================================================================== */

function OpeningPage({
  year,
  opening,
  totals,
  locked,
  lockReason,
  setYearOpening,
}: {
  year: number;
  opening: YearOpening;
  totals: ReturnType<typeof openingTotals>;
  locked: boolean;
  lockReason: string;
  setYearOpening: (next: YearOpening) => void;
}) {
  const update = (code: string, side: "debit" | "credit", value: string) =>
    setYearOpening({
      ...opening,
      // حساب واحد لا يحمل رصيداً مديناً ودائناً معاً
      [code]: {
        debit: side === "debit" ? value : "",
        credit: side === "credit" ? value : "",
      },
    });

  const resultAccounts = openingOnResultAccounts(opening);
  const rows = POSTABLE_ACCOUNTS;

  return (
    <Panel
      title={`الأرصدة الافتتاحية ${year}`}
      subtitle="لا تُعتمد في أي تقرير إلا إذا تساوى المدين مع الدائن"
    >
      {locked && <Banner tone="warn">🔒 {lockReason}</Banner>}

      {resultAccounts.length > 0 && (
        <Banner tone="warn">
          توجد أرصدة افتتاحية على حسابات نتيجة ({resultAccounts.join("، ")}) —
          الأرصدة الافتتاحية تخص حسابات المركز المالي فقط.
        </Banner>
      )}

      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full text-right text-sm">
          <thead className="sticky top-0 bg-slate-100">
            <tr>
              <Th>رقم الحساب</Th>
              <Th>اسم الحساب</Th>
              <Th>مدين</Th>
              <Th>دائن</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((account) => {
              const row = opening[account.code];
              const hasDebit = !!row?.debit && Number(row.debit) !== 0;
              const hasCredit = !!row?.credit && Number(row.credit) !== 0;
              return (
                <tr key={account.code} className="border-b border-slate-200">
                  <Td>{account.code}</Td>
                  <Td>{account.name}</Td>
                  <Td>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      disabled={locked || hasCredit}
                      value={row?.debit ?? ""}
                      onChange={(e) => update(account.code, "debit", e.target.value)}
                      placeholder="0.000"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                    />
                  </Td>
                  <Td>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      disabled={locked || hasDebit}
                      value={row?.credit ?? ""}
                      onChange={(e) => update(account.code, "credit", e.target.value)}
                      placeholder="0.000"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                    />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-lg bg-slate-100 px-4 py-3 font-bold">
        الإجمالي — مدين {fmt(totals.debit)} · دائن {fmt(totals.credit)}
      </div>

      <div className="mt-4">
        {totals.balanced ? (
          <Banner tone="ok">✓ الأرصدة الافتتاحية متوازنة ومعتمدة</Banner>
        ) : (
          <Banner tone="error">
            ⚠ غير متوازنة — الفرق {fmt(totals.debit - totals.credit)} د.ك
          </Banner>
        )}
      </div>
    </Panel>
  );
}

/* ================================================================== */
/* الإعدادات                                                           */
/* ================================================================== */

function SettingsPage({
  year,
  years,
  state,
  broken,
  paymentGaps,
  yearLocks,
  canClose,
  onToggleLock,
  onRollForward,
  onFix,
  duplicates,
  onFixDuplicates,
  onBulkFix,
  onImport,
  onImportMaterials,
  onImportEmployees,
  onImportProjects,
  onImportContractors,
  company,
  setCompany,
  backupMeta,
  linkedFile,
  backupNotice,
  onRunBackup,
  onLinkFile,
  onUnlinkFile,
  exportTables,
  onExport,
}: {
  year: number;
  years: number[];
  state: ReturnType<typeof emptyState>;
  broken: { movement: Movement; problem: string }[];
  paymentGaps: string[];
  yearLocks: YearLocks;
  canClose: boolean;
  onToggleLock: (year: number, note: string) => void;
  onRollForward: () => void;
  onFix: (movement: Movement) => void;
  /** أرقام القيود المكرّرة، ومُصلِحها */
  duplicates: { key: string; rows: Movement[] }[];
  onFixDuplicates: () => void;
  onBulkFix: (
    fix: BulkFix,
    targets: Movement[],
    /** غائبٌ في تصحيحٍ ينقل المشروع وحده */
    item?: ItemDefinition
  ) => void;
  onImport: (state: ReturnType<typeof emptyState>) => void;
  onImportMaterials: (
    materials: Material[],
    receipts: MaterialReceipt[]
  ) => void;
  onImportEmployees: (employees: Employee[]) => void;
  onImportProjects: (projects: Project[]) => void;
  /** replaceExisting: يستبدل نصّ العقود المطابقة برقمها لا يتخطّاها */
  onImportContractors: (
    contractors: Contractor[],
    replaceExisting: boolean
  ) => void;
  company: CompanyProfile;
  setCompany: Dispatch<SetStateAction<CompanyProfile>>;
  backupMeta: BackupMeta | null;
  linkedFile: string | null;
  /** نتيجة آخر عملية حفظ — تُعرض بجانب الزر لا أعلى الصفحة وحدها */
  backupNotice: string;
  onRunBackup: () => void;
  onLinkFile: () => void;
  onUnlinkFile: () => void;
  exportTables: ExportTable[];
  onExport: (table: ExportTable) => void;
}) {
  const logoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const materialsRef = useRef<HTMLInputElement>(null);
  const employeesRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const download = () => {
    const blob = new Blob([exportBackup(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = backupFileName();
    link.click();
    URL.revokeObjectURL(url);
    setMessage("تم تنزيل النسخة الاحتياطية");
  };

  const upload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseBackup(String(reader.result));
        if (
          !window.confirm(
            `استيراد ${parsed.movements.length} حركة و ${parsed.projects.length} مشروع و ${parsed.contractors.length} عقد؟\n\nسيحل هذا محل البيانات الحالية بالكامل.`
          )
        ) {
          return;
        }
        onImport(parsed);
        setMessage(`تم استيراد ${parsed.movements.length} حركة`);
        setError("");
      } catch {
        setError("الملف غير صالح — تأكد أنه ملف نسخة احتياطية من هذا النظام");
      }
    };
    reader.readAsText(file);
  };

  /**
   * الاستيراد الانتقائي: يقرأ الملف ويعرض ما فيه، فيختار المستخدم ما يضمّه
   * دون المساس بالحركات والقيود. يمنع تكاثر زر لكل نوع بيانات.
   */
  const [pending, setPending] = useState<ReturnType<typeof emptyState> | null>(
    null
  );
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  /** تحديث نصّ عقدٍ موجود لا تخطّيه — يُطلب صراحةً في كل استيراد */
  const [replaceContracts, setReplaceContracts] = useState(false);

  const readForPicking = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseBackup(String(reader.result));
        setPending(parsed);
        setPicked({});
        setReplaceContracts(false);
        setError("");
      } catch {
        setError("الملف غير صالح");
      }
    };
    reader.readAsText(file);
  };

  const perYear = years.map((y) => ({
    year: y,
    count: state.movements.filter((m) => m.fiscalYear === y).length,
  }));

  return (
    <>
      <Panel
        title="بيانات الشركة"
        subtitle="تظهر في ترويسة كل مطبوعة وفي سندات الصرف والقبض"
      >
        <div className="flex flex-wrap items-start gap-6">
          <div className="text-center">
            {company.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logo}
                alt="شعار الشركة"
                className="mx-auto max-h-28 rounded-lg border border-slate-200 p-2"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-400">
                لا يوجد شعار
              </div>
            )}

            <div className="mt-3 flex flex-col gap-2">
              <button
                onClick={() => logoRef.current?.click()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white"
              >
                {company.logo ? "تغيير الشعار" : "رفع الشعار"}
              </button>
              {company.logo && (
                <button
                  onClick={() => setCompany((p) => ({ ...p, logo: "" }))}
                  className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700"
                >
                  إزالة
                </button>
              )}
            </div>

            <input
              ref={logoRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (file.size > 400 * 1024) {
                  setError("حجم الشعار كبير — اختر صورة أصغر من 400 كيلوبايت");
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  // يُخزَّن كـ data URL ليُطبع بلا اتصال بالشبكة
                  setCompany((p) => ({ ...p, logo: String(reader.result) }));
                  setMessage("تم حفظ الشعار");
                  setError("");
                };
                reader.readAsDataURL(file);
              }}
            />
          </div>

          <div className="grid min-w-[20rem] flex-1 grid-cols-1 gap-4 md:grid-cols-2">
            {(
              [
                ["name", "اسم الشركة"],
                ["nameEn", "الاسم بالإنجليزية"],
                ["crNumber", "رقم السجل التجاري"],
                ["phone", "الهاتف"],
                ["email", "البريد الإلكتروني"],
                ["address", "العنوان"],
              ] as [keyof CompanyProfile, string][]
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  type="text"
                  value={company[key]}
                  onChange={(e) =>
                    setCompany((p) => ({ ...p, [key]: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>
            ))}
          </div>
        </div>

        <p className="mt-4 text-sm text-slate-600">
          الشعار يُحفظ داخل بياناتك ويخرج مع النسخة الاحتياطية. يُفضّل ملف PNG
          بخلفية شفافة وارتفاع 150 بكسل تقريباً.
        </p>
      </Panel>

      <Panel
        title="دورة الاعتماد"
        subtitle="لا تدخل الحركة الدفاتر قبل اعتمادها — قرار مجلس الإدارة"
      >
        <div className="max-w-md">
          <Field
            label="حدّ الاعتماد التلقائي (د.ك)"
            hint="الحركة التي لا يتجاوز مبلغها هذا الحد تُعتمد تلقائياً. صفر يعني أن كل حركة تنتظر اعتماداً."
          >
            <input
              type="number"
              step="0.001"
              min="0"
              value={company.approvalThreshold}
              onChange={(e) =>
                setCompany((p) => ({
                  ...p,
                  approvalThreshold: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className={`${inputClass} tabular-nums`}
            />
          </Field>
        </div>

        <Banner tone="warn">
          ارفع الحدّ بحكمة. توقيعٌ يتكرّر خمسين مرة في اليوم يصير عادةً بلا نظر،
          وتلك رقابة صورية. والأثر الآخر أن ما دون الحدّ يدخل الدفاتر بلا مراجعة
          أحد — فاجعله عند مبلغ لا يضرّ خطؤه.
        </Banner>
      </Panel>

      <Panel
        title="النسخ الاحتياطي والاستيراد"
        subtitle="البيانات محفوظة في متصفح هذا الجهاز فقط"
      >
        <Banner tone="warn">
          مسح بيانات المتصفح يمحو كل الدفاتر. نزّل نسخة احتياطية بانتظام.
        </Banner>

        {/* الحفظ المباشر إلى ملف ثابت */}
        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 font-bold">الحفظ المباشر إلى ملف</p>

          {linkedFile ? (
            <p className="mb-3 text-sm">
              مرتبط بالملف: <b>{linkedFile}</b> — كل حفظ يكتب فيه مباشرة بلا
              نوافذ.
            </p>
          ) : supportsDirectSave() ? (
            <p className="mb-3 text-sm text-slate-600">
              اختر ملفاً مرة واحدة، ثم يصبح الحفظ بضغطة واحدة تكتب فيه دائماً —
              بلا نوافذ ولا تراكم ملفات في مجلد التنزيلات.
            </p>
          ) : (
            <p className="mb-3 text-sm text-amber-800">
              متصفحك لا يدعم الكتابة المباشرة في الملفات. استخدم «تنزيل نسخة
              احتياطية»، أو افتح النظام في Chrome أو Edge.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {supportsDirectSave() && (
              <button
                onClick={onLinkFile}
                className="rounded-lg bg-slate-900 px-5 py-2 font-bold text-white"
              >
                {linkedFile ? "تغيير الملف المرتبط" : "اختر ملف النسخة الاحتياطية"}
              </button>
            )}
            {linkedFile && (
              <button
                onClick={onUnlinkFile}
                className="rounded-lg bg-slate-200 px-5 py-2 font-bold"
              >
                فكّ الارتباط
              </button>
            )}
          </div>

          <p className="mt-3 text-sm">
            آخر نسخة:{" "}
            {backupMeta ? (
              <b>
                {new Date(backupMeta.at).toLocaleString("ar")} (قبل{" "}
                {daysSince(backupMeta.at)} يوماً)
              </b>
            ) : (
              <span className="text-red-600 font-bold">لم تُؤخذ نسخة بعد</span>
            )}
          </p>
        </div>

        {/* نقطة استعادة تلقائية: صورة التخزين قبل أول كتابة في هذه الجلسة */}
        {(() => {
          const point = readRestorePoint();
          if (!point) return null;
          return (
            <div className="mb-5 rounded-xl border border-slate-300 bg-white p-4">
              <p className="mb-2 font-bold">نقطة استعادة تلقائية</p>
              <p className="mb-3 text-sm text-slate-600">
                صورة من بياناتك أُخذت تلقائياً قبل أول تعديل في هذه الجلسة —{" "}
                <b>{new Date(point.at).toLocaleString("ar")}</b> · {point.keys}{" "}
                مجموعة. استعملها إن اختفت بيانات فجأة.
              </p>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      "استعادة البيانات إلى ما كانت عليه قبل أول تعديل في هذه الجلسة؟\n\nكل ما أدخلته بعدها سيضيع."
                    )
                  ) {
                    if (applyRestorePoint()) window.location.reload();
                    else setError("تعذّرت الاستعادة");
                  }
                }}
                className="rounded-lg bg-amber-100 px-5 py-2 font-bold text-amber-900"
              >
                ↩ استعادة نقطة الأمان
              </button>
            </div>
          );
        })()}

        <div className="flex flex-wrap gap-3">
          <button
            onClick={onRunBackup}
            className="rounded-lg bg-green-600 px-6 py-3 font-bold text-white hover:bg-green-700"
          >
            💾 حفظ نسخة احتياطية الآن
          </button>
          {backupNotice && (
            <span
              className={`self-center rounded-lg px-4 py-2 text-sm font-bold ${
                backupNotice.startsWith("تعذّر") || backupNotice.startsWith("رُفض")
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-800"
              }`}
            >
              {backupNotice}
              {backupMeta &&
                !backupNotice.startsWith("تعذّر") &&
                ` — ${new Date(backupMeta.at).toLocaleTimeString("ar")}`}
            </span>
          )}
          <button
            onClick={download}
            className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
          >
            تنزيل نسخة احتياطية
          </button>
          <button
            onClick={() => materialsRef.current?.click()}
            className="rounded-lg bg-slate-200 px-6 py-3 font-bold"
          >
            استيراد انتقائي
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-lg border border-red-300 bg-red-50 px-6 py-3 font-bold text-red-700"
          >
            استيراد كامل (يستبدل كل شيء)
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = "";
            }}
          />
          <input
            ref={materialsRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) readForPicking(file);
              e.target.value = "";
            }}
          />
        </div>

        {pending && (
          <div className="mt-5 rounded-xl border-2 border-blue-300 bg-blue-50 p-5">
            <p className="mb-3 font-bold">اختر ما تريد استيراده من الملف</p>

            {(() => {
              const all: [string, string, number][] = [
                ["employees", "الموظفون", pending.employees.length],
                ["projects", "المشاريع وميزانياتها", pending.projects.length],
                ["contractors", "العقود", pending.contractors.length],
                ["materials", "أصناف المواد", pending.materials.length],
                ["receipts", "سجلات استلام المواد", pending.materialReceipts.length],
              ];
              const options = all.filter(([, , count]) => count > 0);

              if (options.length === 0) {
                return (
                  <p className="text-sm text-slate-600">
                    الملف لا يحتوي على بيانات قابلة للاستيراد الانتقائي.
                  </p>
                );
              }

              return (
                <>
                  <div className="space-y-2">
                    {options.map(([key, label, count]) => (
                      <label key={key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={picked[key] ?? false}
                          onChange={(e) =>
                            setPicked((p) => ({ ...p, [key]: e.target.checked }))
                          }
                        />
                        <span>
                          <b>{label}</b> — {count}
                        </span>
                      </label>
                    ))}
                  </div>

                  {picked.contractors &&
                    (() => {
                      const existing = pending.contractors.filter((c) =>
                        state.contractors.some(
                          (o) => o.contractNumber === c.contractNumber
                        )
                      );
                      if (existing.length === 0) return null;
                      return (
                        <label className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={replaceContracts}
                            onChange={(e) => setReplaceContracts(e.target.checked)}
                          />
                          <span>
                            <b>تحديث نصّ العقود الموجودة</b> — في الملف{" "}
                            {existing.length} عقداً موجوداً عندك بالرقم نفسه (
                            {existing.map((c) => c.contractNumber).join("، ")}).
                            بدون هذا الخيار تُتخطّى ويبقى نصّها القديم. ومعه
                            يُستبدل نصّها ويبقى اعتمادُ كل دفعة لم تتغيّر قيمتها
                            ولا شرطها.
                          </span>
                        </label>
                      );
                    })()}

                  <p className="mt-3 text-sm text-slate-600">
                    الحركات والقيود والأرصدة الافتتاحية لا تُمَس. الدمج يتجنّب
                    التكرار بالمعرّف أو الاسم.
                  </p>

                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={() => {
                        const done: string[] = [];
                        if (picked.employees) {
                          onImportEmployees(pending.employees);
                          done.push(`${pending.employees.length} موظف`);
                        }
                        if (picked.projects) {
                          onImportProjects(pending.projects);
                          done.push(`${pending.projects.length} مشروع`);
                        }
                        if (picked.contractors) {
                          onImportContractors(
                            pending.contractors,
                            replaceContracts
                          );
                          done.push(
                            `${pending.contractors.length} عقد` +
                              (replaceContracts ? " (مع تحديث الموجود)" : "")
                          );
                        }
                        if (picked.materials || picked.receipts) {
                          onImportMaterials(
                            picked.materials ? pending.materials : [],
                            picked.receipts ? pending.materialReceipts : []
                          );
                          if (picked.materials)
                            done.push(`${pending.materials.length} صنف`);
                          if (picked.receipts)
                            done.push(`${pending.materialReceipts.length} سجل استلام`);
                        }
                        setMessage(
                          done.length
                            ? `تم استيراد ${done.join(" و ")}`
                            : "لم تختر شيئاً"
                        );
                        setPending(null);
                      }}
                      disabled={!Object.values(picked).some(Boolean)}
                      className="rounded-lg bg-blue-600 px-6 py-2 font-bold text-white disabled:bg-slate-300"
                    >
                      استيراد المحدّد
                    </button>
                    <button
                      onClick={() => setPending(null)}
                      className="rounded-lg bg-slate-200 px-6 py-2 font-bold"
                    >
                      إلغاء
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        <p className="mt-3 text-sm text-slate-600">
          «استيراد المواد فقط» يضيف كتالوج المواد وسجلات الاستلام دون المساس
          بحركاتك وتصحيحاتك. أما «الاستيراد الكامل» فيمحو كل ما في النظام ويستبدله
          بمحتوى الملف.
        </p>

        {message && <p className="mt-3 text-sm font-medium text-green-700">{message}</p>}
        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          {[
            ["إجمالي الحركات", state.movements.length],
            ["المشاريع", state.projects.length],
            ["العقود", state.contractors.length],
            ["سنوات بها أرصدة افتتاحية", Object.keys(state.openingBalances).length],
          ].map(([label, count]) => (
            <div key={String(label)} className="rounded-xl border border-slate-200 p-4">
              <p className="text-slate-500">{label}</p>
              <p className="mt-1 text-xl font-bold">{count}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          {perYear.map((p) => (
            <span key={p.year} className="rounded-lg bg-slate-100 px-4 py-2 font-medium">
              {p.year}: {p.count} حركة
            </span>
          ))}
        </div>
      </Panel>

      <Panel
        title="التصدير إلى Excel"
        subtitle={`ملفات CSV تفتح في Excel بالعربية سليمة — مقيّدة بالسنة ${year} والفترة المعروضة`}
      >
        <div className="flex flex-wrap gap-3">
          {exportTables.map((table) => (
            <button
              key={table.name}
              onClick={() => onExport(table)}
              disabled={table.rows.length <= 1}
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-bold hover:bg-slate-50 disabled:opacity-40"
            >
              ⬇ {table.name}
              <span className="mr-2 text-xs font-normal text-slate-500">
                ({Math.max(0, table.rows.length - 1)} سطر)
              </span>
            </button>
          ))}
        </div>

        <p className="mt-4 text-sm text-slate-600">
          الملفات بترميز UTF-8 مع علامة ترتيب البايت، فتفتح العربية سليمة في
          Excel على ويندوز مباشرة بلا إعدادات استيراد.
        </p>
      </Panel>

      <Panel
        title="الترحيل بين السنوات"
        subtitle="ينقل أرصدة حسابات المركز المالي إلى افتتاحي السنة التالية، ويقفل نتيجة السنة في الأرباح المرحّلة"
      >
        <button
          onClick={onRollForward}
          disabled={!canClose || Boolean(yearLocks[String(year + 1)])}
          className="rounded-lg bg-slate-900 px-6 py-3 font-bold text-white disabled:bg-slate-300"
        >
          ترحيل أرصدة {year} إلى افتتاحي {year + 1}
        </button>
        {Boolean(yearLocks[String(year + 1)]) && (
          <p className="mt-3 text-sm text-amber-800">
            السنة {year + 1} مقفلة — افتحها أولاً لتستقبل الترحيل.
          </p>
        )}
      </Panel>

      <Panel
        title="إقفال السنوات المالية"
        subtitle="السنة المقفلة لا تقبل إضافة حركة ولا تعديلها ولا حذفها، ولا تعديل أرصدتها الافتتاحية"
      >
        {!canClose && (
          <Banner tone="warn">
            ليست لديك صلاحية «ترحيل أرصدة السنة» — العرض فقط.
          </Banner>
        )}

        <table className="w-full text-right text-sm">
          <thead className="bg-slate-100">
            <tr>
              <Th>السنة</Th>
              <Th>الحركات</Th>
              <Th>الحالة</Th>
              <Th>من أقفلها ومتى</Th>
              <Th>الإجراء</Th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => {
              const lock = yearLocks[String(y)];
              const count = state.movements.filter(
                (m) => m.fiscalYear === y
              ).length;
              return (
                <tr key={y} className="border-b border-slate-200">
                  <Td>
                    <span className="font-bold">{y}</span>
                    {y === year && (
                      <span className="mr-2 rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                        المعروضة
                      </span>
                    )}
                  </Td>
                  <Td>{count}</Td>
                  <Td>
                    {lock ? (
                      <span className="font-bold text-red-700">🔒 مقفلة</span>
                    ) : (
                      <span className="text-green-700">مفتوحة</span>
                    )}
                  </Td>
                  <Td>
                    {lock ? (
                      <div>
                        <div>{lock.closedBy || "—"}</div>
                        <div className="text-xs text-slate-500">
                          {lock.closedAt.slice(0, 10)}
                          {lock.note && ` · ${lock.note}`}
                        </div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <button
                      disabled={!canClose}
                      onClick={() => {
                        if (lock) {
                          if (
                            window.confirm(
                              `فتح السنة ${y} للتعديل؟\n\nستصبح حركاتها قابلة للتغيير والحذف، وقد تتغيّر قوائمها المعتمدة.`
                            )
                          ) {
                            onToggleLock(y, "");
                          }
                          return;
                        }
                        const note = window.prompt(
                          `إقفال السنة ${y}؟\n\nلن تقبل بعدها أي إضافة أو تعديل أو حذف.\n\nملاحظة (اختيارية):`,
                          ""
                        );
                        if (note !== null) onToggleLock(y, note.trim());
                      }}
                      className={`rounded-lg px-4 py-2 font-bold disabled:bg-slate-100 disabled:text-slate-400 ${
                        lock
                          ? "bg-amber-100 text-amber-900"
                          : "bg-slate-900 text-white"
                      }`}
                    >
                      {lock ? "فتح للتعديل" : "إقفال"}
                    </button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="mt-4 text-sm text-slate-600">
          أقفل السنة بعد اعتماد قوائمها وترحيل أرصدتها. الإقفال والفتح كلاهما
          يُسجَّل في سجل التدقيق باسم من قام به.
        </p>
      </Panel>

      {duplicates.length > 0 && (
        <Panel
          title="أرقام قيود مكرّرة"
          subtitle="رقم القيد يجب أن يكون فريداً داخل سنته — هو رقم السند وهو مرجع المدقّق"
        >
          <Banner tone="error">
            <b>{duplicates.reduce((s, d) => s + d.rows.length, 0)}</b> حركة تحمل{" "}
            <b>{duplicates.length}</b> رقم قيد مكرّراً. حدث هذا لأن الرقم التالي
            كان يُحسب من الحركات المعتمدة وحدها، فلم تحجز الحركة المنتظِرة رقمها.
            أُصلح السبب، ويبقى إصلاح ما وقع.
          </Banner>

          <div className="mb-4 space-y-3">
            {duplicates.map(({ key, rows }) => (
              <div key={key} className="rounded-xl border border-red-200 p-3">
                <p className="font-bold">القيد {key}</p>
                {rows.map((m) => (
                  <p key={m.id} className="mt-1 text-sm text-slate-600">
                    {m.date} · {fmt(m.amount)} د.ك · {m.description || "بلا بيان"}{" "}
                    · {m.project || "—"}
                  </p>
                ))}
              </div>
            ))}
          </div>

          <button
            onClick={onFixDuplicates}
            className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
          >
            أعِد ترقيم المكرّر
          </button>
          <p className="mt-2 text-sm text-slate-500">
            تحتفظ الأقدم برقمها، وتأخذ البقية أرقاماً جديدة بعد آخر رقم في
            سنتها. لا يتغيّر مبلغ ولا تاريخ ولا حساب.
          </p>
        </Panel>
      )}

      <Panel
        title={`حركات ${year} التي تحتاج مراجعة`}
        subtitle="مستوردة ومحفوظة، لكنها مستبعدة من التقارير حتى تُصحَّح"
      >
        {broken.length === 0 ? (
          <Banner tone="ok">✓ كل حركات {year} تُنتج قيوداً صالحة</Banner>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Th>القيد</Th>
                  <Th>التاريخ</Th>
                  <Th>البيان</Th>
                  <Th>مدين</Th>
                  <Th>دائن</Th>
                  <Th>المبلغ</Th>
                  <Th>السبب</Th>
                  <Th>الإجراء</Th>
                </tr>
              </thead>
              <tbody>
                {broken.map(({ movement, problem }) => (
                  <tr key={movement.id} className="border-b border-slate-200">
                    <Td>{movement.entryNo}</Td>
                    <Td>{movement.date || "—"}</Td>
                    <Td>{movement.description || "—"}</Td>
                    <Td>{movement.debitCode || "—"}</Td>
                    <Td>{movement.creditCode || "—"}</Td>
                    <Td>
                      <Money value={movement.amount} />
                    </Td>
                    <Td className="text-red-600">{problem}</Td>
                    <Td>
                      <button
                        onClick={() => onFix(movement)}
                        className="rounded-lg bg-blue-600 px-3 py-2 font-medium text-white"
                      >
                        تصحيح
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="فجوات في خرائط الترحيل" subtitle="منقولة كما هي من الإكسل">
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-bold">بنود بلا حساب مقابل</p>
            {UNMAPPED_ITEMS.length === 0 ? (
              <p className="text-slate-500">لا يوجد</p>
            ) : (
              <ul className="mt-1 list-inside list-disc">
                {UNMAPPED_ITEMS.map((i) => (
                  <li key={i.code}>
                    {i.name} ({i.code})
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="font-bold">طرق دفع مستخدمة وغير معرّفة في PostingMap</p>
            {paymentGaps.length === 0 ? (
              <p className="text-slate-500">لا يوجد</p>
            ) : (
              <ul className="mt-1 list-inside list-disc">
                {paymentGaps.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Panel>

      <BulkFixPanel
        movements={state.movements}
        items={state.items}
        yearLocks={yearLocks}
        onApply={onBulkFix}
      />
    </>
  );
}

/* ================================================================== */
/* التصحيحات المجمّعة                                                  */
/* ================================================================== */

/**
 * تصحيح تصنيف يمسّ حركات قديمة كثيرة دفعة واحدة.
 *
 * كل تصحيح هنا قرار محاسبي أقرّه صاحب الشركة صراحةً، لا اجتهاد من البرنامج،
 * ولذلك لا يُطبَّق تلقائياً: يُعرض أثره أولاً ثم يُنفَّذ بضغطة، ويُسجَّل في
 * سجل التدقيق. والحركات في سنة مقفلة تُستثنى مهما كان التصحيح.
 */
type BulkFix = {
  id: string;
  title: string;
  reason: string;
  /**
   * الحساب الذي تنتقل إليه الحركات — يلزم وجود بند يشير إليه.
   * ويُترك فارغاً في تصحيحٍ ينقل المشروع وحده: فيبقى الحساب والبند كما هما.
   */
  toAccount?: string;
  /** السلّة أو المشروع الذي تنتقل إليه — يُترك فارغاً فيبقى كل شيء كما هو */
  toProject?: string;
  match: (m: Movement) => boolean;
};

const BULK_FIXES: BulkFix[] = [
  {
    id: "water-tanker-5180",
    title: "تنكر المياه ← «كهرباء وماء للمشاريع» (5180)",
    reason:
      "مياه المواقع تكلفة تنفيذ لا مصروفاً إدارياً، فبقاؤها على 6220 يخرجها من تكلفة المشروع وربحيته. صافي الربح لا يتغيّر — الحسابان كلاهما في قائمة الدخل — والذي يتغيّر توزيعها بين تكاليف التنفيذ المباشرة والمصروفات الإدارية.",
    toAccount: "5180",
    match: (m) =>
      m.debitCode === "6220" &&
      /تنكر\s*(ماء|مياه)|تعبئة\s*(ماء|مياه)/.test(m.description),
  },
  {
    id: "car-rental-5145",
    title: "إيجار السيارات ← «إيجار سيارات ومركبات» (5145)",
    reason:
      "إيجار السيارة تناثر على أربعة حسابات: 5140 إيجار معدات و5120 نقليات و6290 مصروف إداري. والسيارة ليست معدّة، فخلطها بالكرينات والسقالات يمنع معرفة ما يُنفق على المركبات. يجمعها هذا التصحيح في حساب واحد داخل التكاليف المباشرة، حيث يُقيَّد وقودها أصلاً على 5160. «إيجار سطحة نقل سيارة الشركة» مستثناة — فهي نقل لا إيجار.",
    toAccount: "5145",
    toProject: "مصروفات مشتركة",
    match: (m) =>
      /^(5140|5120|6290|6210)$/.test(m.debitCode) &&
      /(إيجار|ايجار|أجرة|اجرة)\s*سيار[ةه]/.test(m.description),
  },
  {
    id: "admin-to-general",
    title: "المصروفات الإدارية ← «عام»",
    reason:
      "قاعدة صاحب الشركة: المصروفات الإدارية (6xxx) على «عام». وهذه سبقت القاعدة فبقيت على «مصروفات مشتركة» — رواتب الموظفين وعمولات البنك والإقامات وإيجار المكتب ومستلزماته. ورُوجعت قبل النقل: ما يخدم المواقع (سكن العمال وأكلهم، صيانة السيارات والمولد، المخالفات المرورية) يبقى مشتركاً، والكهرباء والماء تبقى، وأخطاء الحساب تُصحَّح وحدها. والحساب لا يتغيّر ولا الاعتماد — فلا يتغيّر الميزان ولا صافي الربح.",
    toProject: "عام",
    match: isAdminExpenseToGeneral,
  },
  {
    id: "aluminium-to-materials",
    title: "دفعة الألمنيوم ← «مواد إنشائية» (5110)",
    reason:
      "دفعة ألمنيوم بألفٍ وخمسمئة (قيد ١٢٩٦، مايو ٢٠٢٥) قُيّدت على «رواتب وأجور إدارية»، فضخّمت الرواتب الإدارية وأنقصت التكاليف المباشرة. ومورّد الألمنيوم مسجّلٌ «مورّداً»، فدفعته مواد. ومشروعها قديم مُقفل غير موجود في النظام، فتبقى على «مصروفات مشتركة». صافي ربح ٢٠٢٥ لا يتغيّر.",
    toAccount: "5110",
    match: isAluminiumOnSalaries,
  },
  {
    id: "car-paint-to-maintenance",
    title: "صبغ السيارة ← «صيانة وإصلاحات» (6250)",
    reason:
      "صبغ سيارة (قيد ١٠٢١، فبراير ٢٠٢٦) قُيّد على «رسوم ومصروفات حكومية»، والصبغ صيانة لا رسم. ويبقى على «مصروفات مشتركة» كسائر صيانة السيارات. صافي الربح لا يتغيّر.",
    toAccount: "6250",
    match: isCarPaintOnGovFees,
  },
];

function BulkFixPanel({
  movements,
  items,
  yearLocks,
  onApply,
}: {
  movements: Movement[];
  items: ItemDefinition[];
  yearLocks: YearLocks;
  onApply: (fix: BulkFix, targets: Movement[], item?: ItemDefinition) => void;
}) {
  const pending = BULK_FIXES.map((fix) => {
    const matched = movements.filter(fix.match);
    const targets = matched.filter((m) => !isYearClosed(yearLocks, m.fiscalYear));
    const lockedCount = matched.length - targets.length;
    // البند هو ما يربط الحركة بالحساب في شاشة الإدخال، فلا تصحيح قبل إنشائه
    // — إلا تصحيحٌ ينقل المشروع وحده، فلا حساب فيه ولا بند
    const item = fix.toAccount
      ? items.find((i) => i.account === fix.toAccount)
      : undefined;
    const ready = !fix.toAccount || Boolean(item);
    return { fix, targets, lockedCount, item, ready };
  }).filter((p) => p.targets.length > 0 || p.lockedCount > 0);

  if (pending.length === 0) return null;

  return (
    <Panel
      title="تصحيحات تصنيف مجمّعة"
      subtitle="تُطبَّق على الحركات القديمة دفعة واحدة بعد عرض أثرها — ولا تُنفَّذ من تلقاء نفسها"
    >
      <div className="space-y-6">
        {pending.map(({ fix, targets, lockedCount, item, ready }) => {
          const total = targets.reduce((s, m) => s + m.amount, 0);
          const byProject = new Map<string, { n: number; sum: number }>();
          for (const m of targets) {
            /* في نقل المشروع وحده كلها من مشروعٍ واحد، فتُجمع بالحساب */
            const key = fix.toAccount
              ? m.project || "بلا مشروع"
              : m.debitCode;
            const row = byProject.get(key) ?? { n: 0, sum: 0 };
            byProject.set(key, { n: row.n + 1, sum: row.sum + m.amount });
          }

          return (
            <div
              key={fix.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <p className="font-bold">{fix.title}</p>
              <p className="mt-1 text-sm text-slate-600">{fix.reason}</p>
              {fix.toProject && (
                <p className="mt-1 text-sm font-medium text-slate-700">
                  وتنتقل كلها إلى «{fix.toProject}».
                </p>
              )}

              {!ready && (
                <Banner tone="warn">
                  لا يوجد بند مرتبط بالحساب {fix.toAccount}. أنشئه أولاً من
                  «البيانات الأساسية ← البنود»، ثم عد إلى هنا.
                </Banner>
              )}

              {lockedCount > 0 && (
                <p className="mt-3 text-sm font-medium text-amber-800">
                  🔒 {lockedCount} حركة في سنة مقفلة — مستثناة. افتح السنة إن
                  أردت تصحيحها.
                </p>
              )}

              {targets.length > 0 && (
                <>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-right text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <Th>{fix.toAccount ? "المشروع" : "الحساب"}</Th>
                          <Th>عدد الحركات</Th>
                          <Th>المبلغ</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...byProject.entries()]
                          .sort((a, b) => b[1].sum - a[1].sum)
                          .map(([project, row]) => (
                            <tr
                              key={project}
                              className="border-b border-slate-200"
                            >
                              <Td>{project}</Td>
                              <Td>{row.n}</Td>
                              <Td>
                                <Money value={row.sum} />
                              </Td>
                            </tr>
                          ))}
                        <tr className="bg-slate-50 font-bold">
                          <Td>المجموع</Td>
                          <Td>{targets.length}</Td>
                          <Td>
                            <Money value={total} />
                          </Td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <button
                    disabled={!ready}
                    onClick={() => {
                      if (!ready) return;
                      const what = fix.toAccount
                        ? `إلى الحساب ${fix.toAccount} — ${item?.name ?? ""}${
                            fix.toProject ? `\nوإلى «${fix.toProject}»` : ""
                          }`
                        : `إلى «${fix.toProject}»\nالحساب والاعتماد لا يتغيّران`;
                      if (
                        !window.confirm(
                          `نقل ${targets.length} حركة بمجموع ${fmt(total)} د.ك ${what}؟\n\nيُسجَّل في سجل التدقيق، وتستطيع التراجع باستعادة نسخة احتياطية.`
                        )
                      ) {
                        return;
                      }
                      onApply(fix, targets, item);
                    }}
                    className="mt-3 rounded-lg bg-blue-600 px-6 py-2 font-bold text-white disabled:bg-slate-300"
                  >
                    طبّق التصحيح على {targets.length} حركة
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ================================================================== */
/* بنود الأعمال — الكتالوج                                             */
/* ================================================================== */

/**
 * كتالوج البنود الذي ترثه كل العروض.
 *
 * منقول عن ورقة «قاعدة البنود» في ملف «مراحل البناء»، ويُحرَّر هنا لا
 * في الشفرة: الأسعار تتغيّر، والبنود تُضاف، وهذا شأن صاحب الشركة.
 */
function WorkItemsPage({
  items,
  setItems,
  canSeeCost,
  canPrice,
  canManage,
  currentUserName,
  onLog,
}: {
  items: WorkItem[];
  setItems: Dispatch<SetStateAction<WorkItem[]>>;
  canSeeCost: boolean;
  /** يحدّث تكلفة السوق — المهندس */
  canPrice: boolean;
  /** يحرّر سعر البيع والبنود نفسها — الإدارة */
  canManage: boolean;
  currentUserName: string;
  onLog: (
    action: AuditAction,
    entity: AuditEntity,
    summary: string,
    change?: { before?: string; after?: string }
  ) => void;
}) {
  const [stage, setStage] = useState(STAGES[0]);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState({ section: "", name: "", detail: "" });
  const [staleOnly, setStaleOnly] = useState(false);
  const [bulkMargin, setBulkMargin] = useState(
    String(QUOTATION_DEFAULTS.marginPercent)
  );

  const patch = (id: string, change: Partial<WorkItem>) =>
    setItems((prev) => prev.map((w) => (w.id === id ? { ...w, ...change } : w)));

  /** تغيير التكلفة يختم نفسه بالتاريخ والاسم — الرقم بلا تاريخه ناقص */
  const setCost = (id: string, cost: number) =>
    patch(id, {
      cost,
      costUpdatedAt: new Date().toISOString(),
      costUpdatedBy: currentUserName,
    });

  const shown = items.filter((w) => {
    if (w.stage !== stage) return false;
    if (staleOnly && !isCostStale(w)) return false;
    const q = search.trim();
    if (!q) return true;
    return [w.section, w.name, w.detail, w.description].some((f) =>
      f.includes(q)
    );
  });

  const stale = items.filter((w) => w.active && w.cost > 0 && isCostStale(w));
  /** لم يُصنَّف شيء بعد؟ فالمسوّدة تُعرض — وتختفي متى صُنِّف أول بند */
  const noneEssential = items.every((w) => !w.essential);

  const sections = [...new Set(items.filter((w) => w.stage === stage).map((w) => w.section))];

  /** كم بنداً بلا سعر بيع؟ العرض لا يستقيم بدونها */
  const unpriced = items.filter((w) => w.active && w.price <= 0).length;

  return (
    <Panel
      title="بنود الأعمال"
      subtitle={`${items.length} بنداً في ${STAGES.length} مراحل — تُحرَّر هنا مرة، ويرثها كل عرض سعر`}
    >
      {unpriced > 0 && (
        <Banner tone="warn">
          <b>{unpriced}</b> بنداً بلا سعر بيع. البند غير المسعّر يظهر في العرض
          بصفر، فأكمل أسعارها قبل أول جلسة مع عميل.
        </Banner>
      )}

      {canSeeCost && stale.length > 0 && (
        <Banner tone="warn">
          <b>{stale.length}</b> بنداً لم تُراجَع تكلفته منذ {COST_STALE_DAYS}{" "}
          يوماً أو لم تُحدَّث قط. تكلفة قديمة تُنتج عرضاً خاسراً وهي تبدو سليمة.
          <button
            onClick={() => setStaleOnly((v) => !v)}
            className="mr-3 rounded bg-amber-200 px-3 py-1 text-xs font-bold"
          >
            {staleOnly ? "عرض الكل" : "أظهر القديمة فقط"}
          </button>
        </Banner>
      )}

      {canManage && noneEssential && (
        <div className="mb-4 rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
          <p className="font-bold">مسوّدة تصنيف «أساسي»</p>
          <p className="mt-1 text-sm text-slate-700">
            لم يُعلَّم بند واحد أساسياً بعد، فكل شيء قابل للشطب — بما فيه صب
            القواعد. هذه مسوّدة تقترح <b>{ESSENTIAL_DRAFT.length} بنداً</b> من
            أصل {items.length} لا يقوم البناء بدونها. معيارها سؤال واحد: هل
            تستطيع تسليم القسيمة بدون هذا البند؟
          </p>
          <p className="mt-2 text-sm text-slate-700">
            <b>راجعها بعد تطبيقها</b> — هي اقتراح لا حكم، وكل مربّع في الجدول
            أدناه يبقى بيدك.
          </p>
          <button
            onClick={() => {
              const { items: next, changed } = applyEssentialDraft(items);
              if (
                !window.confirm(
                  `تعليم ${ESSENTIAL_DRAFT.length} بنداً أساسياً حسب المسوّدة؟\n\nسيتغيّر ${changed} بنداً، وتستطيع تعديل أي منها بعدها.`
                )
              ) {
                return;
              }
              setItems(next);
              onLog(
                "تعديل",
                "بيانات النظام",
                `تطبيق مسوّدة تصنيف «أساسي» — ${changed} بنداً`
              );
            }}
            className="mt-3 rounded-lg bg-blue-600 px-6 py-2 font-bold text-white"
          >
            طبّق المسوّدة المقترحة
          </button>
        </div>
      )}

      {canManage && canSeeCost && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-bold">تسعير جماعي من التكلفة</p>
          <p className="mt-1 text-sm text-slate-600">
            يضع سعر البيع لكل بند في <b>{stage}</b> = التكلفة + النسبة. لا يمسّ
            البنود بلا تكلفة، ولا العروض المحفوظة — لكلٍّ منها نسبتها.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                النسبة على التكلفة (%)
              </label>
              <input
                type="number"
                step="any"
                value={bulkMargin}
                onChange={(e) => setBulkMargin(e.target.value)}
                className="w-32 rounded-lg border border-slate-300 px-4 py-2 tabular-nums"
              />
            </div>
            <button
              onClick={() => {
                const percent = Number(bulkMargin) || 0;
                const targets = shown.filter((w) => w.cost > 0);
                if (targets.length === 0) return;
                if (
                  !window.confirm(
                    `إعادة تسعير ${targets.length} بنداً في «${stage}» بنسبة ${percent}% على التكلفة؟\n\nسيُستبدل سعر البيع الحالي لهذه البنود.`
                  )
                ) {
                  return;
                }
                const ids = new Set(targets.map((w) => w.id));
                setItems((prev) =>
                  prev.map((w) =>
                    ids.has(w.id)
                      ? { ...w, price: markupPrice(w.cost, percent) }
                      : w
                  )
                );
                onLog(
                  "تعديل",
                  "بيانات النظام",
                  `تسعير جماعي: ${targets.length} بنداً في ${stage} بنسبة ${percent}% على التكلفة`
                );
              }}
              className="rounded-lg bg-blue-600 px-6 py-2 font-bold text-white"
            >
              طبّق على «{stage}»
            </button>
            <span className="text-sm text-slate-500">
              مثال: تكلفة 100 + {Number(bulkMargin) || 0}% ={" "}
              <b className="tabular-nums">
                {fmt(markupPrice(100, Number(bulkMargin) || 0))}
              </b>
            </span>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {STAGES.map((s) => {
          const count = items.filter((w) => w.stage === s).length;
          return (
            <button
              key={s}
              onClick={() => setStage(s)}
              className={`rounded-lg px-4 py-2 text-sm font-bold ${
                stage === s ? "bg-blue-600 text-white" : "bg-slate-100"
              }`}
            >
              {s} <span className="opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 p-4">
        <p className="mb-3 font-bold">بند جديد في «{stage}»</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Field label="القسم">
            <input
              type="text"
              list="work-sections"
              value={draft.section}
              onChange={(e) => setDraft({ ...draft, section: e.target.value })}
              className={inputClass}
            />
            <datalist id="work-sections">
              {sections.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="البند">
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="التفصيل" hint="اختياري">
            <input
              type="text"
              value={draft.detail}
              onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
              className={inputClass}
            />
          </Field>
          <div className="flex items-end">
            <button
              onClick={() => {
                if (!draft.section.trim() && !draft.name.trim()) return;
                const item: WorkItem = {
                  id: newId(),
                  stage,
                  section: draft.section.trim(),
                  name: draft.name.trim(),
                  detail: draft.detail.trim(),
                  description: "",
                  unit: "",
                  quantity: 1,
                  cost: 0,
                  costUpdatedAt: "",
                  costUpdatedBy: "",
                  price: 0,
                  materialCost: 0,
                  materialPrice: 0,
                  essential: false,
                  active: true,
                  notes: "",
                };
                setItems((prev) => [...prev, item]);
                onLog(
                  "إنشاء",
                  "بيانات النظام",
                  `بند أعمال جديد: ${stage} — ${item.section} — ${item.name}`
                );
                setDraft({ section: "", name: "", detail: "" });
              }}
              className="w-full rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
            >
              إضافة
            </button>
          </div>
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="بحث في بنود هذه المرحلة…"
        className={`${inputClass} mb-4`}
      />

      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-100">
            <tr>
              <Th>القسم</Th>
              <Th>البند</Th>
              <Th>التفصيل</Th>
              <Th>الوحدة</Th>
              <Th>الكمية</Th>
              {canSeeCost && <Th>سعر التكلفة</Th>}
              {canSeeCost && <Th>منها مواد</Th>}
              {canSeeCost && <Th>آخر تحديث</Th>}
              <Th>سعر البيع</Th>
              <Th>منه مواد</Th>
              {canSeeCost && <Th>الهامش</Th>}
              <Th>أساسي</Th>
              <Th>نشط</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((w) => {
              const margin = round3(w.price - w.cost);
              return (
                <tr key={w.id} className="border-b border-slate-100">
                  <Td>{w.section || "—"}</Td>
                  <Td className="font-medium">{w.name || "—"}</Td>
                  <Td className="text-slate-500">{w.detail || "—"}</Td>
                  <Td>
                    <input
                      type="text"
                      value={w.unit}
                      onChange={(e) => patch(w.id, { unit: e.target.value })}
                      className="w-24 rounded border border-slate-200 px-2 py-1"
                    />
                  </Td>
                  <Td>
                    <input
                      type="number"
                      step="any"
                      value={w.quantity}
                      onChange={(e) =>
                        patch(w.id, { quantity: Number(e.target.value) || 0 })
                      }
                      className="w-20 rounded border border-slate-200 px-2 py-1 tabular-nums"
                    />
                  </Td>
                  {canSeeCost && (
                    <Td>
                      <input
                        type="number"
                        step="any"
                        value={w.cost}
                        disabled={!canPrice}
                        onChange={(e) =>
                          setCost(w.id, Number(e.target.value) || 0)
                        }
                        className={`w-24 rounded px-2 py-1 tabular-nums ${
                          isCostStale(w) && w.cost > 0
                            ? "border border-amber-300 bg-amber-50"
                            : "border border-slate-200"
                        }`}
                      />
                    </Td>
                  )}
                  {canSeeCost && (
                    <Td>
                      <input
                        type="number"
                        step="any"
                        value={w.materialCost}
                        disabled={!canPrice}
                        title="حصة المواد من التكلفة — والباقي مصنعية"
                        onChange={(e) =>
                          patch(w.id, {
                            materialCost: Number(e.target.value) || 0,
                          })
                        }
                        className="w-24 rounded border border-slate-200 px-2 py-1 tabular-nums"
                      />
                    </Td>
                  )}
                  {canSeeCost && (
                    <Td className="whitespace-nowrap text-xs text-slate-500">
                      {w.costUpdatedAt ? (
                        <>
                          {w.costUpdatedAt.slice(0, 10)}
                          <div>
                            {costAgeDays(w)} يوماً
                            {w.costUpdatedBy ? ` · ${w.costUpdatedBy}` : ""}
                          </div>
                        </>
                      ) : (
                        <span className="text-amber-700">لم تُحدَّث</span>
                      )}
                    </Td>
                  )}
                  <Td>
                    <input
                      type="number"
                      step="any"
                      value={w.price}
                      disabled={!canManage}
                      onChange={(e) =>
                        patch(w.id, { price: Number(e.target.value) || 0 })
                      }
                      className={`w-24 rounded px-2 py-1 tabular-nums ${
                        w.price > 0
                          ? "border border-slate-200"
                          : "border border-amber-300 bg-amber-50"
                      }`}
                    />
                  </Td>
                  <Td>
                    <input
                      type="number"
                      step="any"
                      value={w.materialPrice}
                      disabled={!canManage}
                      title="حصة المواد من سعر البيع — تُطرح في عرض «مصنعيات فقط»"
                      onChange={(e) =>
                        patch(w.id, {
                          materialPrice: Number(e.target.value) || 0,
                        })
                      }
                      className="w-24 rounded border border-slate-200 px-2 py-1 tabular-nums"
                    />
                  </Td>
                  {canSeeCost && (
                    <Td className={margin < 0 ? "font-bold text-red-600" : ""}>
                      {fmt(margin)}
                    </Td>
                  )}
                  <Td>
                    <input
                      type="checkbox"
                      checked={w.essential}
                      onChange={(e) =>
                        patch(w.id, { essential: e.target.checked })
                      }
                      className="h-5 w-5"
                    />
                  </Td>
                  <Td>
                    <input
                      type="checkbox"
                      checked={w.active}
                      onChange={(e) => patch(w.id, { active: e.target.checked })}
                      className="h-5 w-5"
                    />
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-sm text-slate-500">
        <b>أساسي</b> يعني بنداً لا يقوم البناء بدونه، فيظهر في العرض مختاراً ولا
        يستطيع العميل شطبه — كصب القواعد والأعمدة. وما عداه اختياري يؤشّر عليه
        في الجلسة. و<b>غير النشط</b> يختفي من العروض الجديدة ولا يمسّ القديمة.
      </p>
    </Panel>
  );
}

/* ================================================================== */
/* عروض الأسعار                                                        */
/* ================================================================== */

/* ================================================================== */
/* إبرام العقد — قسمة الدفعات وخصم العقد الاستشاري                     */
/* ================================================================== */

/**
 * ما يُقرَّر مع العميل قبل التوقيع، لا ما يفرضه النظام.
 *
 * قسمةُ المرحلة قرارُ تفاوض: عقد عواطف يقسّم الهيكل الأسود على أدواره
 * ويجعل التشطيب تسع دفعات، وعقدٌ آخر يجعل المرحلة دفعةً واحدة. فالشاشة
 * تعرض كل مرحلة وأقسامها، ويوزّع صاحب القرار الأقسام على دفعاتٍ
 * يسمّيها. وقيمة كل دفعة تُجمع من أقسامها — فلا يُدخَل مبلغ يدوياً،
 * ولا يختلّ مجموع الدفعات عن قيمة العقد أبداً.
 *
 * وعقد المكتب الاستشاري اختياري: يظهر صفّه التوثيقي ونقطتا «ثانياً»
 * إن وُجد، ويغيب كلّه إن لم يوجد.
 */
function ContractTermsSheet({
  quotation,
  contractNumber,
  onCancel,
  onConfirm,
}: {
  quotation: Quotation;
  contractNumber: string;
  onCancel: () => void;
  onConfirm: (terms: ContractTerms) => void;
}) {
  /** عدد دفعات كل مرحلة — الغائبة دفعة واحدة */
  const [counts, setCounts] = useState<Record<string, number>>({});
  /** لكل قسم رقمُ دفعته داخل مرحلته */
  const [assign, setAssign] = useState<Record<string, number>>({});
  /** اسم كل دفعة كما يظهر في عمود المرحلة */
  const [names, setNames] = useState<Record<string, string>>({});
  const [hasConsultancy, setHasConsultancy] = useState(false);
  const [consultancy, setConsultancy] = useState("");

  const stages = useMemo(
    () =>
      stagesOfScope(quotation.scope)
        .map((stage) => ({
          stage,
          sections: sectionsOfStage(quotation.lines, stage),
          total: stageTotals(quotation.lines, stage, quotation.pricingMode).price,
        }))
        .filter((s) => s.total > 0),
    [quotation]
  );

  const partsOf = (stage: string) => Math.max(1, counts[stage] ?? 1);
  const partOfSection = (stage: string, section: string) =>
    Math.min(assign[`${stage}|${section}`] ?? 0, partsOf(stage) - 1);

  /**
   * خطّة القسمة كما اختيرت — تُشتقّ من الحالة مرّةً واحدة، فتُبنى
   * منها الشروط وتُعرض الشاشة من المصدر نفسه. فلا تفترق صورةٌ
   * يراها عن عقدٍ يُبرم.
   */
  const plan = useMemo(
    () =>
      stages.map(({ stage, sections, total }) => {
        const count = Math.max(1, counts[stage] ?? 1);
        return {
          stage,
          sections,
          total,
          count,
          parts: Array.from({ length: count }, (_, index) => ({
            name: names[`${stage}|${index}`] ?? stage,
            sections: sections.filter(
              (s) =>
                Math.min(assign[`${stage}|${s}`] ?? 0, count - 1) === index
            ),
          })),
        };
      }),
    [stages, counts, assign, names]
  );

  /** الشروط كما ستُبنى منها الدفعات — تُحسب حيّةً ليراها قبل الإبرام */
  const terms: ContractTerms = useMemo(() => {
    const stageParts: Record<string, StagePart[]> = {};
    for (const row of plan) {
      if (row.count > 1) stageParts[row.stage] = row.parts;
    }
    return {
      stageParts,
      consultancy: hasConsultancy ? Number(consultancy) || 0 : 0,
    };
  }, [plan, hasConsultancy, consultancy]);

  const installments = useMemo(
    () => installmentsFromQuotation(quotation, terms),
    [quotation, terms]
  );
  const contractValue = quotationTotals(quotation.lines, quotation.pricingMode).price;
  const payable = installments.filter((i) => !i.informational);
  /** دفعةٌ بلا قسم = قيمتها صفر، فتسقط من الجدول ويُنبَّه عليها */
  const emptyParts = plan.reduce(
    (sum, row) =>
      sum +
      (row.count <= 1 ? 0 : row.parts.filter((p) => p.sections.length === 0).length),
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 overflow-auto bg-slate-800/60 p-6"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="mb-1 text-xl font-bold">
          إبرام العقد رقم {contractNumber}
        </h2>
        <p className="mb-5 text-sm text-slate-600">
          {quotation.clientName || "—"} · {quotation.scope} ·{" "}
          <b>{fmt(contractValue)}</b> د.ك · تسعير {quotation.pricingMode}
        </p>

        <div className="space-y-4">
          {plan.map(({ stage, sections, total, count, parts }) => {
            return (
              <div
                key={stage}
                className="rounded-xl border border-slate-300 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="font-bold">
                    {stage}{" "}
                    <span className="font-normal text-slate-500">
                      — {fmt(total)} د.ك · {sections.length} بند
                    </span>
                  </p>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-600">عدد الدفعات:</span>
                    {[1, 2, 3, 4, 5, 6]
                      .filter((n) => n <= Math.max(1, sections.length))
                      .map((n) => (
                        <button
                          key={n}
                          onClick={() =>
                            setCounts((prev) => ({ ...prev, [stage]: n }))
                          }
                          className={`h-9 w-9 rounded-lg font-bold ${
                            count === n
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                  </div>
                </div>

                {count === 1 ? (
                  <p className="text-sm text-slate-600">
                    دفعة واحدة تُستحق عند الانتهاء من المرحلة، وبنودها كلها
                    في صفّ واحد من الجدول.
                  </p>
                ) : (
                  <>
                    <div className="mb-3 grid gap-2 md:grid-cols-2">
                      {parts.map((part, index) => {
                        const value = partTotal(
                          quotation.lines,
                          stage,
                          part.sections,
                          quotation.pricingMode
                        );
                        return (
                          <div
                            key={index}
                            className="flex items-center gap-2 rounded-lg bg-slate-50 p-2"
                          >
                            <span className="shrink-0 text-sm font-bold text-slate-500">
                              {index + 1}
                            </span>
                            <input
                              value={part.name}
                              onChange={(e) =>
                                setNames((prev) => ({
                                  ...prev,
                                  [`${stage}|${index}`]: e.target.value,
                                }))
                              }
                              placeholder={stage}
                              className={inputClass}
                            />
                            <span
                              className={`shrink-0 tabular-nums text-sm font-bold ${
                                value > 0 ? "text-slate-800" : "text-red-600"
                              }`}
                            >
                              {fmt(value)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <p className="mb-2 text-sm text-slate-600">
                      وزّع بنود المرحلة على دفعاتها:
                    </p>
                    <div className="grid gap-2 md:grid-cols-2">
                      {sections.map((section) => (
                        <label
                          key={section}
                          className="flex items-center gap-2 text-sm"
                        >
                          <select
                            value={partOfSection(stage, section)}
                            onChange={(e) =>
                              setAssign((prev) => ({
                                ...prev,
                                [`${stage}|${section}`]: Number(e.target.value),
                              }))
                            }
                            className="w-16 rounded-lg border border-slate-300 px-2 py-1"
                          >
                            {Array.from({ length: count }, (_, index) => (
                              <option key={index} value={index}>
                                {index + 1}
                              </option>
                            ))}
                          </select>
                          <span>{section}</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* عقد المكتب الاستشاري — يظهر إن وُجد ويغيب إن لم يوجد */}
        <div className="mt-5 rounded-xl border border-slate-300 p-4">
          <label className="flex items-center gap-2 font-bold">
            <input
              type="checkbox"
              checked={hasConsultancy}
              onChange={(e) => setHasConsultancy(e.target.checked)}
            />
            <span>عقد مكتب استشاري (تراخيص ومخططات) يُخصم من هذا العقد</span>
          </label>
          {hasConsultancy ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span>قيمته:</span>
              <input
                value={consultancy}
                onChange={(e) => setConsultancy(e.target.value)}
                inputMode="decimal"
                placeholder="4000"
                className="w-32 rounded-lg border border-slate-300 px-3 py-2 tabular-nums"
              />
              <span>د.ك — فيُكتب في «ثانياً»:</span>
              <span className="rounded-lg bg-slate-100 px-3 py-2 tabular-nums">
                الإجمالية {fmt(contractValue + (Number(consultancy) || 0))} ·
                الخصم {fmt(Number(consultancy) || 0)} · النهائية{" "}
                {fmt(contractValue)}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              بلا عقد استشاري: لا صفّ خصمٍ في الجدول، و«ثانياً» يكتب قيمة
              العقد وحدها.
            </p>
          )}
        </div>

        <div className="mt-5 rounded-xl bg-blue-50 p-4 text-sm">
          <b>{payable.length}</b> دفعة، مجموعها{" "}
          <b className="tabular-nums">
            {fmt(payable.reduce((s, i) => s + (Number(i.value) || 0), 0))}
          </b>{" "}
          د.ك — وقيمة العقد <b className="tabular-nums">{fmt(contractValue)}</b>{" "}
          د.ك.
          {emptyParts > 0 && (
            <span className="mr-2 font-bold text-red-700">
              و{emptyParts} دفعة بلا بنود، ستسقط من الجدول.
            </span>
          )}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => onConfirm(terms)}
            className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
          >
            أبرِم العقد
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg bg-slate-200 px-6 py-3 font-bold"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/* الربط الجماعي: حركات أجور المقاولين بعقودها                         */
/* ================================================================== */

/**
 * يربط حركات أجور المقاولين بعقودها ودفعاتها جملةً لا حركةً حركة.
 *
 * الحركات مكتوبة بالكنى («أبو أحمد النجار»، «حسين») والعقود بالأسماء
 * الرسمية، فلا تُطابَق آلياً — والمطابقة الآلية بالاسم خطؤها صامت.
 * فالشاشة تجمع الحركات بمن دُفع له، ويُسند صاحبُ القرار المجموعةَ
 * إلى عقدها بضغطة. وله أن يجمع عدة مجموعات على عقدٍ واحد.
 *
 * ولا يُطبَّق شيء قبل معاينته: يُعرض ما سيُربط وبأي دفعة ولماذا،
 * ثم يُعتمد. والصرف على العقد يبقى كما هو — الربط لا يغيّر قيداً،
 * وإنما ينسب المصروف إلى التزامه.
 */
/**
 * مدد العقود وانتهاءاتها — لوحة مراجعة لا حكم.
 *
 * تُظهر لكل عقدٍ تاريخ انتهائه ومن أين جاء، وأيام التأخّر، وتقدير
 * الشرط الجزائي وعلى مَن هو. والتقدير تقويميّ والعقود بأيام عمل،
 * فيُكتب ذلك في صدر اللوحة ولا يُترك للقارئ أن يستنتجه.
 *
 * ولمن يعرف الموقع أن يكتب تاريخ الانتهاء بيده، فيعلو على الحساب.
 */
function ContractDurationsPanel({
  contractors,
  today,
  canManage,
  onSetEnd,
}: {
  contractors: Contractor[];
  today: string;
  canManage: boolean;
  onSetEnd: (contractId: string, date: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(() => allDurations(contractors, today), [contractors, today]);

  const ended = rows.filter((r) => r.status === "انتهت");
  const soon = rows.filter((r) => r.status === "تقترب");
  const unknown = rows.filter((r) => r.status === "غير معروفة");
  const onUs = round3(
    ended.filter((r) => r.penaltyAgainst === "الشركة").reduce((s, r) => s + r.penalty, 0)
  );
  const forUs = round3(
    ended
      .filter((r) => r.penaltyAgainst === "الطرف الآخر")
      .reduce((s, r) => s + r.penalty, 0)
  );

  const shown = showAll ? rows : [...ended, ...soon];

  const tone: Record<string, string> = {
    انتهت: "bg-red-50 text-red-700",
    تقترب: "bg-amber-50 text-amber-800",
    جارية: "bg-green-50 text-green-800",
    "لم تبدأ": "bg-slate-100 text-slate-600",
    "غير معروفة": "bg-slate-100 text-slate-500",
  };

  return (
    <Panel
      title="المدد والانتهاءات"
      subtitle="مدة كل عقد وتاريخ انتهائه — وما مضى منها"
    >
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-red-50 p-4">
          <p className="text-sm text-red-800">مضت مدتها</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-red-800">
            {ended.length}
          </p>
        </div>
        <div className="rounded-xl bg-amber-50 p-4">
          <p className="text-sm text-amber-900">تقترب خلال {SOON_DAYS} يوماً</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-amber-900">
            {soon.length}
          </p>
        </div>
        <div className="rounded-xl bg-slate-100 p-4">
          <p className="text-sm text-slate-600">بلا مدة منصوصة</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{unknown.length}</p>
        </div>
        <div className="rounded-xl bg-slate-100 p-4">
          <p className="text-sm text-slate-600">تقدير الشرط الجزائي</p>
          <p className="mt-1 text-sm font-bold">
            <span className="text-red-700">{fmt(onUs)}</span> على الشركة
            <br />
            <span className="text-green-800">{fmt(forUs)}</span> لها
          </p>
        </div>
      </div>

      <Banner tone="warn">
        الحساب تقويمي، والعقود تقول «يوم عمل ولا تحتسب العطل والراحة والإجازات
        الرسمية وأي ظروف قاهرة» — فما يظهر هنا <b>أقصر من الحقيقة لا أطول</b>،
        وهو قائمة تُراجَع لا حكم يُبنى عليه. ومن يعرف الموقع يكتب تاريخ الانتهاء
        بيده فيعلو على الحساب.
      </Banner>

      <div className="mb-3 mt-4 flex flex-wrap gap-3">
        <button
          onClick={() => setShowAll(!showAll)}
          className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold"
        >
          {showAll ? `اعرض ما يحتاج انتباهاً (${ended.length + soon.length})` : `اعرض الكل (${rows.length})`}
        </button>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl bg-green-50 p-4 font-bold text-green-800">
          ✓ لا عقد مضت مدته ولا يقترب انتهاؤه.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>العقد</Th>
                <Th>الطرف</Th>
                <Th>المشروع</Th>
                <Th>الحال</Th>
                <Th>المدة</Th>
                <Th>الانتهاء</Th>
                <Th>التأخّر</Th>
                <Th>الشرط الجزائي</Th>
                <Th>تاريخ محرَّر</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.contract.id} className="border-b border-slate-100">
                  <Td>{r.contract.contractNumber}</Td>
                  <Td>{r.contract.name}</Td>
                  <Td className="text-slate-600">{r.contract.project}</Td>
                  <Td>
                    <span
                      className={`rounded px-2 py-1 text-xs font-bold ${tone[r.status]}`}
                    >
                      {r.status}
                    </span>
                  </Td>
                  <Td className="tabular-nums">
                    {r.end.days > 0 ? `${r.end.days} يوم` : "—"}
                    {r.end.extraDays > 0 && (
                      <span className="text-xs text-slate-500">
                        {" "}
                        (+{r.end.extraDays} من الملاحق)
                      </span>
                    )}
                  </Td>
                  <Td className="tabular-nums">
                    {r.end.date || "—"}
                    {r.end.source === "محرَّر" && (
                      <span className="text-xs text-blue-700"> ✎</span>
                    )}
                  </Td>
                  <Td className="tabular-nums">
                    {r.lateDays > 0 ? (
                      <b className="text-red-700">{r.lateDays} يوم</b>
                    ) : r.daysLeft > 0 && r.status === "تقترب" ? (
                      <span className="text-amber-800">بقي {r.daysLeft}</span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    {r.penalty > 0 ? (
                      <span
                        className={
                          r.penaltyAgainst === "الشركة"
                            ? "font-bold text-red-700"
                            : "font-bold text-green-800"
                        }
                      >
                        {fmt(r.penalty)} على {r.penaltyAgainst}
                      </span>
                    ) : r.status === "انتهت" ? (
                      <span className="text-slate-400">لا شرط في العقد</span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <input
                      type="date"
                      value={r.contract.expectedEndDate ?? ""}
                      disabled={!canManage}
                      onChange={(e) => onSetEnd(r.contract.id, e.target.value)}
                      className="rounded border border-slate-300 px-2 py-1 text-sm"
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unknown.length > 0 && !showAll && (
        <p className="mt-4 text-sm text-slate-600">
          و<b>{unknown.length}</b> عقداً لا يذكر مستنده مدةً، فلا يُحسب له انتهاء.
          اضغط «اعرض الكل» واكتب تاريخ انتهائه بيدك إن عرفته.
        </p>
      )}
    </Panel>
  );
}

function ContractLinksPage({
  movements,
  contractors,
  projects,
  canManage,
  onApply,
}: {
  movements: Movement[];
  contractors: Contractor[];
  projects: string[];
  canManage: boolean;
  onApply: (
    links: { movementId: string; contractNumber: string; installmentNumber: number }[]
  ) => void;
}) {
  const [project, setProject] = useState("الكل");
  const [search, setSearch] = useState("");
  /** مفاتيح المجموعات المحدَّدة — «المشروع|الكنية» */
  const [picked, setPicked] = useState<string[]>([]);
  const [contractNumber, setContractNumber] = useState("");
  /** الحركات المستثناة يدوياً من التطبيق */
  const [skipped, setSkipped] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const summary = useMemo(() => linkSummary(movements), [movements]);
  const groups = useMemo(
    () => groupCandidates(movements, project === "الكل" ? undefined : project),
    [movements, project]
  );

  const visible = useMemo(() => {
    const q = normalizeArabic(search);
    if (!q) return groups;
    return groups.filter(
      (g) =>
        normalizeArabic(g.label).includes(q) ||
        normalizeArabic(g.project).includes(q) ||
        g.movements.some((m) => normalizeArabic(m.description).includes(q))
    );
  }, [groups, search]);

  const idOf = (g: PayeeGroup) => g.project + "|" + g.key;
  const contract = contractors.find((c) => c.contractNumber === contractNumber);

  const chosen = useMemo(
    () => groups.filter((g) => picked.includes(g.project + "|" + g.key)),
    [groups, picked]
  );

  /* الحركات المختارة من كل المجموعات المحدَّدة، منقوصةً ما استُثني */
  const rows = useMemo(
    () =>
      chosen.flatMap((g) => g.movements).filter((m) => !skipped.includes(m.id)),
    [chosen, skipped]
  );

  /* الخطة تُحسب حيّة: ما سيُربط وبأي دفعة ولماذا */
  const plan = useMemo(
    () =>
      contract
        ? planLinks(rows, contract, linkedByInstallment(movements, contract.contractNumber))
        : [],
    [rows, contract, movements]
  );

  const planTotal = round3(plan.reduce((s, r) => s + (Number(r.movement.amount) || 0), 0));
  const withInstallment = plan.filter((r) => r.installmentNumber > 0).length;
  /* مشاريع الحركات المحدَّدة — تنبيهٌ إن خالفت مشروع العقد */
  const otherProject = contract
    ? chosen.filter((g) => g.project !== contract.project).map((g) => g.project)
    : [];

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  return (
    <>
      <Panel
        title="ربط الحركات بالعقود"
        subtitle="حركات أجور المقاولين تُنسب إلى عقودها ودفعاتها — جملةً لا حركةً حركة"
      >
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-amber-50 p-4">
            <p className="text-sm text-amber-900">بانتظار الربط</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-900">
              {summary.candidates}
            </p>
            <p className="text-sm text-amber-800">{fmt(summary.candidatesTotal)} د.ك</p>
          </div>
          <div className="rounded-xl bg-green-50 p-4">
            <p className="text-sm text-green-900">مرتبطة بعقودها</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-green-900">
              {summary.linked}
            </p>
            <p className="text-sm text-green-800">{fmt(summary.linkedTotal)} د.ك</p>
          </div>
          <div className="rounded-xl bg-slate-100 p-4">
            <p className="text-sm text-slate-600">مستبعدة — نقليات</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{summary.excluded}</p>
            <p className="text-sm text-slate-600">
              {fmt(summary.excludedTotal)} د.ك — مقيّدة على حساب المقاولين وليست أجرَ عقد
            </p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="المشروع">
            <select
              value={project}
              onChange={(e) => {
                setProject(e.target.value);
                setPicked([]);
              }}
              className={inputClass}
            >
              <option>الكل</option>
              {projects.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label="بحث" hint="اكتب الكنية كما تكتبها في الوصف — «أبو أحمد»">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="أبو أحمد · صحي · حفر"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="print-only">
          <h2 className="mb-1 text-xl font-bold">حركات تنتظر الربط بعقودها</h2>
          <p className="mb-4 text-sm">
            {project === "الكل" ? "كل المشاريع" : project} · {visible.length} مجموعة ·{" "}
            {visible.reduce((n, g) => n + g.movements.length, 0)} حركة ·{" "}
            {fmt(visible.reduce((n, g) => n + g.total, 0))} د.ك
          </p>
          {visible.map((g) => (
            <div key={g.project + "|" + g.key} className="print-block mb-4">
              <p className="font-bold">
                {g.label} — {g.project} · {g.movements.length} حركة ·{" "}
                {fmt(g.total)} د.ك
              </p>
              <table className="w-full text-right text-sm">
                <thead>
                  <tr>
                    <Th>القيد</Th>
                    <Th>التاريخ</Th>
                    <Th>الوصف</Th>
                    <Th>المبلغ</Th>
                    <Th>رقم العقد</Th>
                    <Th>رقم الدفعة</Th>
                  </tr>
                </thead>
                <tbody>
                  {g.movements.map((m) => (
                    <tr key={m.id}>
                      <Td>{m.entryNo}</Td>
                      <Td>{m.date}</Td>
                      <Td>{m.description}</Td>
                      <Td>{fmt(m.amount)}</Td>
                      <Td>&nbsp;</Td>
                      <Td>&nbsp;</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="rounded-xl bg-green-50 p-4 font-bold text-green-800">
            ✓ لا حركات تنتظر الربط في هذا النطاق.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
              <button
                onClick={() => setPicked(visible.map(idOf))}
                className="rounded-lg bg-slate-100 px-4 py-2 font-bold"
              >
                حدّد كل الظاهر ({visible.length})
              </button>
              <button
                onClick={() => {
                  setPicked([]);
                  setSkipped([]);
                }}
                className="rounded-lg bg-slate-100 px-4 py-2 font-bold"
              >
                إلغاء التحديد
              </button>
              <span className="text-slate-600">
                {picked.length > 0
                  ? `${picked.length} مجموعة · ${rows.length} حركة`
                  : "اختر مجموعة أو أكثر، ثم العقد"}
              </span>
              {/* ورقة تُراجَع مع المهندس قبل فتح الشاشة */}
              <button
                onClick={() => window.print()}
                className="rounded-lg bg-slate-900 px-4 py-2 font-bold text-white"
              >
                🖨 اطبع القائمة
              </button>
            </div>

            <div className="space-y-2">
              {visible.map((g) => {
                const id = idOf(g);
                const on = picked.includes(id);
                return (
                  <div
                    key={id}
                    className={`rounded-xl border p-3 ${
                      on ? "border-blue-400 bg-blue-50" : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setPicked((p) => toggle(p, id))}
                      />
                      <b className="min-w-48">{g.label}</b>
                      <span className="text-sm text-slate-600">{g.project}</span>
                      <span className="text-sm tabular-nums">
                        {g.movements.length} حركة · <b>{fmt(g.total)}</b> د.ك
                      </span>
                      <span className="text-sm text-slate-500">
                        {g.from} → {g.to}
                      </span>
                      <button
                        onClick={() => setOpen(open === id ? null : id)}
                        className="mr-auto rounded-lg bg-slate-100 px-3 py-1 text-sm"
                      >
                        {open === id ? "إخفاء" : "الحركات"}
                      </button>
                    </div>

                    {open === id && (
                      <table className="mt-3 w-full text-right text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <Th>القيد</Th>
                            <Th>التاريخ</Th>
                            <Th>الوصف</Th>
                            <Th>المبلغ</Th>
                            <Th>يُربط؟</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.movements.map((m) => (
                            <tr key={m.id} className="border-b border-slate-100">
                              <Td>{m.entryNo}</Td>
                              <Td>{m.date}</Td>
                              <Td>{m.description}</Td>
                              <Td>
                                <Money value={m.amount} />
                              </Td>
                              <Td>
                                <input
                                  type="checkbox"
                                  checked={!skipped.includes(m.id)}
                                  onChange={() => setSkipped((s) => toggle(s, m.id))}
                                />
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Panel>

      {/* المعاينة: لا يُطبَّق شيء قبل أن يُرى */}
      {picked.length > 0 && (
        <Panel title="معاينة الربط">
          <Field
            label="العقد"
            hint="العقود مرتَّبة، ومشروع العقد يُقارَن بمشروع الحركات"
          >
            <select
              value={contractNumber}
              onChange={(e) => setContractNumber(e.target.value)}
              className={inputClass}
            >
              <option value="">— اختر العقد —</option>
              {[...contractors]
                .sort((a, b) => a.contractNumber.localeCompare(b.contractNumber))
                .map((c) => (
                  <option key={c.id} value={c.contractNumber}>
                    {c.contractNumber} — {c.name} · {c.project} · {fmt(c.contractValue)} د.ك
                  </option>
                ))}
            </select>
          </Field>

          {otherProject.length > 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-bold text-amber-900">
              تنبيه: حركاتٌ من {[...new Set(otherProject)].join("، ")} تُربط بعقدٍ على{" "}
              {contract?.project}. راجعها قبل الاعتماد.
            </p>
          )}

          {contract && plan.length > 0 && (
            <>
              <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm">
                سيُربط <b>{plan.length}</b> حركة بقيمة{" "}
                <b className="tabular-nums">{fmt(planTotal)}</b> د.ك بالعقد{" "}
                <b>{contract.contractNumber}</b> — منها <b>{withInstallment}</b> على دفعةٍ
                مقترحة و<b>{plan.length - withInstallment}</b> بلا دفعة محدّدة.
              </p>

              <table className="mt-3 w-full text-right text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>القيد</Th>
                    <Th>التاريخ</Th>
                    <Th>الوصف</Th>
                    <Th>المبلغ</Th>
                    <Th>الدفعة</Th>
                    <Th>سبب الاقتراح</Th>
                  </tr>
                </thead>
                <tbody>
                  {plan.map((r) => (
                    <tr key={r.movement.id} className="border-b border-slate-100">
                      <Td>{r.movement.entryNo}</Td>
                      <Td>{r.movement.date}</Td>
                      <Td>{r.movement.description}</Td>
                      <Td>
                        <Money value={r.movement.amount} />
                      </Td>
                      <Td>
                        {r.installmentNumber > 0 ? (
                          <b>الدفعة {r.installmentNumber}</b>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </Td>
                      <Td className="text-slate-600">{r.reason}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  disabled={!canManage}
                  onClick={() => {
                    if (
                      !window.confirm(
                        `ربط ${plan.length} حركة بقيمة ${fmt(planTotal)} د.ك بالعقد ${
                          contract.contractNumber
                        }؟\n\nالربط لا يغيّر قيداً — وإنما ينسب المصروف إلى التزامه.`
                      )
                    ) {
                      return;
                    }
                    onApply(
                      plan.map((r) => ({
                        movementId: r.movement.id,
                        contractNumber: contract.contractNumber,
                        installmentNumber: r.installmentNumber,
                      }))
                    );
                    setMessage(
                      `تم ربط ${plan.length} حركة بقيمة ${fmt(planTotal)} د.ك بالعقد ${
                        contract.contractNumber
                      }`
                    );
                    setPicked([]);
                    setSkipped([]);
                    setContractNumber("");
                  }}
                  className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white disabled:bg-slate-300"
                >
                  اربط المحدَّد
                </button>
                {!canManage && (
                  <span className="self-center text-sm text-slate-500">
                    الربط يحتاج صلاحية «إدارة العقود والدفعات».
                  </span>
                )}
              </div>
            </>
          )}

          {message && (
            <p className="mt-3 font-bold text-green-700">{message}</p>
          )}
        </Panel>
      )}
    </>
  );
}

/**
 * حال صلاحية العرض في سطرٍ واحد.
 *
 * والغرض أن يُرى قبل انقضائه لا بعده: العرض الذي انقضت مدّته يُمحى
 * عند الفتحة التالية، فمن رأى «بقي يومان» لحق أن يجدّده أو يقدّمه.
 */
function QuotationValidity({ quotation }: { quotation: Quotation }) {
  const until = validUntil(quotation);
  const left = daysLeft(quotation, todayISO());

  if (!until) {
    return (
      <span className="text-slate-400">
        {quotation.status === "مسودة" ? "لم يُقدَّم بعد" : "—"}
      </span>
    );
  }

  /* المقبول سندُ عقدٍ قائم، فمدّته لا تعنيه */
  if (isBindingQuotation(quotation)) {
    return <span className="text-slate-500">لا تنقضي — سند عقد</span>;
  }

  if (left === null) return <span className="text-slate-400">—</span>;

  if (left < 0) {
    return (
      <span className="font-bold text-red-700">
        انقضت — يُمحى عند الفتحة القادمة
      </span>
    );
  }

  return (
    <span className={left <= 7 ? "font-bold text-amber-700" : "text-slate-600"}>
      {left === 0 ? "ينقضي اليوم" : `بقي ${left} يوماً`}
      <span className="block text-slate-400">حتى {until}</span>
    </span>
  );
}
function QuotationsPage({
  quotations,
  workItems,
  year,
  canManage,
  canSeeCost,
  currentUserName,
  setQuotations,
  onPrint,
  onConvert,
  nextContractNumber,
  onLog,
}: {
  quotations: Quotation[];
  workItems: WorkItem[];
  year: number;
  canManage: boolean;
  canSeeCost: boolean;
  currentUserName: string;
  setQuotations: Dispatch<SetStateAction<Quotation[]>>;
  onPrint: (quotation: Quotation, internal: boolean) => void;
  /** يُنشئ عقد العميل من العرض المقبول بشروط الإبرام، ويعيد رقمه */
  onConvert: (quotation: Quotation, terms: ContractTerms) => string | null;
  /** رقم العقد الذي سيُعطى — يُعرض في شاشة الإبرام قبل الإنشاء */
  nextContractNumber: string;
  onLog: (
    action: AuditAction,
    entity: AuditEntity,
    summary: string,
    change?: { before?: string; after?: string }
  ) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  /** شاشة الإبرام: قسمة الدفعات وخصم العقد الاستشاري */
  const [terms, setTerms] = useState(false);
  /** وضع العرض: يخفي التكلفة والهامش لتُدار الشاشة نحو العميل */
  const [clientMode, setClientMode] = useState(false);

  const open = quotations.find((q) => q.id === openId) ?? null;
  const showCost = canSeeCost && !clientMode;

  /** مسودات ركدت — لا تُمحى، لكنها تُذكَّر بها */
  const stale = quotations.filter(
    (q) => q.status === "مسودة" && quotationAgeDays(q) >= COST_STALE_DAYS
  );

  // كل تغيير يختم وقته، فيُعرف عمر المسودة بلا حفظ يدوي
  const patch = (id: string, change: Partial<Quotation>) =>
    setQuotations((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        const next = { ...q, ...change, updatedAt: new Date().toISOString() };
        /*
          يوم التقديم يُختم مرةً واحدة حين يخرج العرض إلى العميل، ومنه
          تبدأ مدة الصلاحية. ولا يُعاد ختمه بعدها: من يرجع العرض إلى
          مسودة ليصحّح حرفاً ثم يقدّمه، لا يبدأ شهراً جديداً بذلك.
        */
        if (next.status !== "مسودة" && !next.submittedAt) {
          next.submittedAt = todayISO();
        }
        return next;
      })
    );

  /** نسخة من عرض قائم — لعرض بديل لنفس العميل بنطاق آخر */
  const duplicate = (source: Quotation) => {
    const copy: Quotation = {
      ...source,
      id: newId(),
      number: nextQuotationNumber(quotations, year),
      date: todayISO(),
      status: "مسودة",
      contractNumber: "",
      lines: source.lines.map((l) => ({ ...l })),
      createdBy: currentUserName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setQuotations((prev) => [copy, ...prev]);
    setOpenId(copy.id);
    onLog(
      "إنشاء",
      "عقد",
      `نسخة من عرض السعر ${source.number} ← ${copy.number}`
    );
  };

  const createNew = () => {
    const quotation: Quotation = {
      id: newId(),
      number: nextQuotationNumber(quotations, year),
      date: todayISO(),
      status: "مسودة",
      clientName: "",
      clientPhone: "",
      clientCivilId: "",
      clientAddress: "",
      area: "",
      block: "",
      plot: "",
      licenseNumber: "",
      buildingDescription: "",
      builtArea: 0,
      scope: "هيكل أسود",
      pricingMode: "مصنعية ومواد",
      marginPercent: QUOTATION_DEFAULTS.marginPercent,
      durationDays: QUOTATION_DEFAULTS.durationDays,
      validityDays: QUOTATION_DEFAULTS.validityDays,
      lines: linesForScope(workItems, "هيكل أسود"),
      notes: "",
      contractNumber: "",
      createdBy: currentUserName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setQuotations((prev) => [quotation, ...prev]);
    setOpenId(quotation.id);
    onLog("إنشاء", "عقد", `عرض سعر جديد ${quotation.number}`);
  };

  /* ---------------- قائمة العروض ---------------- */

  if (!open) {
    return (
      <Panel
        title="عروض الأسعار"
        subtitle="تُبنى مع العميل في الاجتماع الأول، وتتحوّل إلى عقد عند القبول"
      >
        {canManage && (
          <button
            onClick={createNew}
            className="mb-5 rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
          >
            عرض سعر جديد
          </button>
        )}

        <Banner tone="ok">
          كل عرض يُحفظ لحظةً بلحظة بلا زرّ حفظ، ويبقى محفوظاً بلا حدّ زمني —
          لا شيء يُمحى تلقائياً. اطبع العرض أو لا تطبعه، اختياراته تنتظرك كما
          تركتها.
        </Banner>

        {stale.length > 0 && (
          <Banner tone="warn">
            <b>{stale.length}</b> مسودة لم تُمسّ منذ {COST_STALE_DAYS} يوماً أو
            أكثر. راجعها — إما أن تُقدَّم للعميل أو تُعلَّم مرفوضة، فأسعار
            التكلفة تتحرك ولا تصلح مسودة قديمة لعرض جديد.
          </Banner>
        )}

        {quotations.length === 0 ? (
          <Empty>لا توجد عروض بعد</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Th>الرقم</Th>
                  <Th>التاريخ</Th>
                  <Th>العميل</Th>
                  <Th>القسيمة</Th>
                  <Th>النطاق</Th>
                  <Th>القيمة</Th>
                  {canSeeCost && <Th>الهامش</Th>}
                  <Th>الحالة</Th>
                  <Th>الصلاحية</Th>
                  <Th>آخر تعديل</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => {
                  const totals = quotationTotals(q.lines, q.pricingMode);
                  return (
                    <tr key={q.id} className="border-b border-slate-200">
                      <Td className="font-bold">{q.number}</Td>
                      <Td>{q.date || "—"}</Td>
                      <Td>{q.clientName || "—"}</Td>
                      <Td>
                        {[q.area, q.block && `ق${q.block}`, q.plot && `قسيمة ${q.plot}`]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </Td>
                      <Td>{q.scope}</Td>
                      <Td>
                        <Money value={totals.price} bold />
                      </Td>
                      {canSeeCost && (
                        <Td
                          className={
                            totals.margin < 0 ? "font-bold text-red-600" : ""
                          }
                        >
                          {fmt(totals.margin)} ({totals.marginPercent.toFixed(1)}%)
                        </Td>
                      )}
                      <Td>{q.status}</Td>
                      <Td className="whitespace-nowrap text-xs">
                        <QuotationValidity quotation={q} />
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-slate-500">
                        {(q.updatedAt || q.createdAt).slice(0, 10)}
                        <div
                          className={
                            q.status === "مسودة" &&
                            quotationAgeDays(q) >= COST_STALE_DAYS
                              ? "font-bold text-amber-700"
                              : " "
                          }
                        >
                          منذ {quotationAgeDays(q)} يوماً
                        </div>
                      </Td>
                      <Td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setOpenId(q.id)}
                            className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700"
                          >
                            فتح
                          </button>
                          {canManage && (
                            <button
                              onClick={() => duplicate(q)}
                              className="rounded-lg bg-slate-100 px-3 py-2"
                            >
                              نسخة
                            </button>
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    );
  }

  /* ---------------- جلسة العميل ---------------- */

  const mode = open.pricingMode;
  const totals = quotationTotals(open.lines, mode);
  const stages = stagesOfScope(open.scope);
  const freeForm = isFreeFormScope(open.scope);
  const set = (change: Partial<Quotation>) => patch(open.id, change);

  const setLine = (itemId: string, change: Partial<QuotationLine>) =>
    set({
      lines: open.lines.map((l) =>
        l.itemId === itemId ? { ...l, ...change } : l
      ),
    });

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpenId(null)}
              className="rounded-lg bg-slate-100 px-4 py-2 font-bold"
            >
              ← العروض
            </button>
            <span className="text-xl font-bold">{open.number}</span>
            <span className="rounded bg-slate-100 px-3 py-1 text-sm">
              {open.status}
            </span>
            <span className="text-xs text-slate-500">
              ✓ محفوظ تلقائياً · آخر تعديل{" "}
              {open.updatedAt ? open.updatedAt.slice(0, 16).replace("T", " ") : "—"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <button
                onClick={() => duplicate(open)}
                className="rounded-lg bg-slate-100 px-4 py-2 font-bold"
              >
                نسخة من هذا العرض
              </button>
            )}
            {canSeeCost && (
              <button
                onClick={() => setClientMode((v) => !v)}
                className={`rounded-lg px-4 py-2 font-bold ${
                  clientMode ? "bg-amber-500 text-white" : "bg-slate-100"
                }`}
              >
                {clientMode ? "👁 وضع العرض — التكلفة مخفيّة" : "إخفاء التكلفة"}
              </button>
            )}
            <button
              onClick={() => onPrint(open, false)}
              className="rounded-lg bg-slate-900 px-4 py-2 font-bold text-white"
            >
              🖨 عرض السعر
            </button>
            {canSeeCost && (
              <button
                onClick={() => onPrint(open, true)}
                className="rounded-lg bg-slate-100 px-4 py-2 font-bold"
              >
                🖨 ورقة داخلية
              </button>
            )}
          </div>
        </div>
      </Panel>

      {/* ---- التحويل إلى عقد ---- */}
      {canManage && (
        <Panel
          title="إبرام العقد"
          subtitle="بعد اعتماد العميل للعرض وتوقيعه، يُنشأ العقد من بنوده ودفعاته"
        >
          {open.contractNumber ? (
            <Banner tone="ok">
              ✓ أُبرم العقد رقم <b>{open.contractNumber}</b> من هذا العرض،
              وأُنشئ معه المشروع بميزانيته. اطبع العقد من شاشة{" "}
              <b>المقاولون</b>، ودفعاته تُعتمد من <b>اعتماد المراحل</b>،
              ومصروفاته تُقيَّد على المشروع من <b>إدخال حركة</b>.
            </Banner>
          ) : open.status !== "مقبول" ? (
            <Banner tone="warn">
              العرض حالته «{open.status}». لا يُبرم العقد إلا بعد أن يعتمده
              العميل — غيّر الحالة إلى <b>مقبول</b> أعلاه بعد توقيعه.
            </Banner>
          ) : (
            <>
              <p className="mb-4 text-sm text-slate-600">
                يُنشأ عقد عميل بقيمة <b>{fmt(totals.price)} د.ك</b>، دفعاته{" "}
                <b>
                  {
                    stagesOfScope(open.scope).filter(
                      (s) => stageTotals(open.lines, s, mode).price > 0
                    ).length
                  }
                </b>{" "}
                — دفعة لكل مرحلة، تُستحق عند إنجازها. وبنوده القانونية منقولة من
                عقود الشركة المبرمة، وتُحرَّر بعد الإنشاء.
              </p>
              <p className="mb-4 text-sm text-slate-600">
                ويُنشأ معه <b>المشروع</b> باسم{" "}
                <b>
                  {[
                    open.plot && `قسيمة ${open.plot}`,
                    open.clientName,
                  ]
                    .filter(Boolean)
                    .join(" — ") || "—"}
                </b>{" "}
                وميزانيته قيمة العقد، فتُقيَّد مصروفاته عليه وتُقاس ربحيته منذ
                يومه الأول.
              </p>
              <button
                onClick={() => setTerms(true)}
                className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
              >
                أنشئ العقد من هذا العرض
              </button>

              {/* القسمة والخصم يُقرَّران قبل الإبرام لا بعده */}
              {terms && (
                <ContractTermsSheet
                  quotation={open}
                  contractNumber={nextContractNumber}
                  onCancel={() => setTerms(false)}
                  onConfirm={(chosen) => {
                    setTerms(false);
                    const number = onConvert(open, chosen);
                    if (number) set({ contractNumber: number });
                  }}
                />
              )}
            </>
          )}
        </Panel>
      )}

      {/* ---- المجاميع ---- */}
      <Panel>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-blue-50 p-4">
            <p className="text-sm text-blue-900">قيمة العرض</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-blue-900">
              {fmt(totals.price)}
            </p>
          </div>
          {showCost && (
            <>
              <div className="rounded-xl bg-slate-100 p-4">
                <p className="text-sm text-slate-600">التكلفة</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {fmt(totals.cost)}
                </p>
              </div>
              <div
                className={`rounded-xl p-4 ${
                  totals.margin < 0 ? "bg-red-50" : "bg-green-50"
                }`}
              >
                <p className="text-sm">الهامش</p>
                <p
                  className={`mt-1 text-2xl font-bold tabular-nums ${
                    totals.margin < 0 ? "text-red-700" : "text-green-800"
                  }`}
                >
                  {fmt(totals.margin)}
                </p>
                <p className="text-sm">{totals.marginPercent.toFixed(1)}%</p>
              </div>
            </>
          )}
          <div className="rounded-xl bg-slate-100 p-4">
            <p className="text-sm text-slate-600">البنود</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {totals.chosen}
            </p>
            <p className="text-sm text-slate-500">
              {totals.excluded} مستبعداً
            </p>
          </div>
        </div>
      </Panel>

      {/* ---- بيانات العميل والقسيمة ---- */}
      <Panel title="العميل والقسيمة">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field label="اسم العميل">
            <input
              type="text"
              value={open.clientName}
              onChange={(e) => set({ clientName: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="رقم التواصل">
            <input
              type="text"
              value={open.clientPhone}
              onChange={(e) => set({ clientPhone: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="الرقم المدني">
            <input
              type="text"
              value={open.clientCivilId}
              onChange={(e) => set({ clientCivilId: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="تاريخ العرض">
            <input
              type="date"
              value={open.date}
              onChange={(e) => set({ date: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="المنطقة">
            <input
              type="text"
              value={open.area}
              onChange={(e) => set({ area: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="القطعة">
            <input
              type="text"
              value={open.block}
              onChange={(e) => set({ block: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="القسيمة">
            <input
              type="text"
              value={open.plot}
              onChange={(e) => set({ plot: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="رقم الرخصة">
            <input
              type="text"
              value={open.licenseNumber}
              onChange={(e) => set({ licenseNumber: e.target.value })}
              className={inputClass}
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="وصف المبنى" hint="مثال: أرضي + أول + نصف ثاني">
              <input
                type="text"
                value={open.buildingDescription}
                onChange={(e) => set({ buildingDescription: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="مسطح البناء (م²)">
            <input
              type="number"
              step="any"
              value={open.builtArea}
              onChange={(e) => set({ builtArea: Number(e.target.value) || 0 })}
              className={inputClass}
            />
          </Field>
          <Field label="الحالة">
            <select
              value={open.status}
              onChange={(e) =>
                set({ status: e.target.value as QuotationStatus })
              }
              className={inputClass}
            >
              {QUOTATION_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>

          <Field label="مدة التنفيذ (يوم)">
            <input
              type="number"
              value={open.durationDays}
              onChange={(e) =>
                set({ durationDays: Number(e.target.value) || 0 })
              }
              className={inputClass}
            />
          </Field>
          <Field label="صلاحية العرض (يوم)">
            <input
              type="number"
              value={open.validityDays}
              onChange={(e) =>
                set({ validityDays: Number(e.target.value) || 0 })
              }
              className={inputClass}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="ملاحظات">
              <input
                type="text"
                value={open.notes}
                onChange={(e) => set({ notes: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </Panel>

      {/* ---- النسبة ---- */}
      {showCost && canManage && (
        <Panel
          title="نسبة الربح"
          subtitle="اضبطها متى شئت — قبل اختيار البنود أو بعده — واضغط لإعادة التسعير"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                النسبة على التكلفة (%)
              </label>
              <input
                type="number"
                step="any"
                value={open.marginPercent}
                onChange={(e) =>
                  set({ marginPercent: Number(e.target.value) || 0 })
                }
                className="w-32 rounded-lg border border-slate-300 px-4 py-2 tabular-nums"
              />
            </div>
            <button
              onClick={() =>
                set({ lines: applyMarkup(open.lines, open.marginPercent) })
              }
              className="rounded-lg bg-blue-600 px-6 py-2 font-bold text-white"
            >
              أعد تسعير بنود هذا العرض
            </button>
            <span className="text-sm text-slate-600">
              تكلفة {fmt(totals.cost)} + {open.marginPercent}% ={" "}
              <b className="tabular-nums">
                {fmt(markupPrice(totals.cost, open.marginPercent))}
              </b>{" "}
              د.ك
            </span>
          </div>

          <p className="mt-3 text-sm text-slate-500">
            <b>انتبه للفرق:</b> نسبة {open.marginPercent}% <b>على التكلفة</b>{" "}
            تعطي هامشاً <b>من السعر</b> قدره{" "}
            {open.marginPercent > -100
              ? (
                  (open.marginPercent / (100 + open.marginPercent)) *
                  100
                ).toFixed(1)
              : "—"}
            % — وهو الرقم المعروض في مربّع «الهامش» أعلاه. الأول ما تضيفه،
            والثاني ما تربحه من كل دينار تقبضه.
          </p>
        </Panel>
      )}

      {/* ---- أساس التسعير ---- */}
      <Panel
        title="أساس التسعير"
        subtitle="هل يشمل العرض المواد، أم المصنعية وحدها والمواد على المالك؟"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {PRICING_MODES.map((m) => (
            <button
              key={m}
              disabled={!canManage}
              onClick={() => set({ pricingMode: m })}
              className={`rounded-xl border-2 p-4 text-right ${
                mode === m ? "border-blue-600 bg-blue-50" : "border-slate-200"
              }`}
            >
              <p className="font-bold">{m}</p>
              <p className="mt-1 text-sm text-slate-600">
                {m === "مصنعية ومواد"
                  ? "الشركة توفّر المواد وتنفّذ — السعر الكامل لكل بند."
                  : "المالك يوفّر المواد — تُطرح حصتها ويبقى أجر العمل."}
              </p>
            </button>
          ))}
        </div>

        {mode === "مصنعيات فقط" && (
          <Banner tone="warn">
            تُطرح <b>حصة المواد</b> من كل بند. والبند الذي لم تُفصَّل مواده بعد
            (حصته صفر) يُحتسب كاملاً كمصنعية — فراجع البنود قبل التقديم، أو
            فصّل حصصها من <b>بنود الأعمال</b>.
          </Banner>
        )}
      </Panel>

      {/* ---- النطاق ---- */}
      <Panel title="نطاق العمل">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              onClick={() => {
                if (s.key === open.scope) return;
                set({
                  scope: s.key,
                  // ما اختاره العميل في المراحل المشتركة يبقى كما هو
                  lines: linesForScope(workItems, s.key, open.lines),
                });
              }}
              className={`rounded-xl border-2 p-4 text-right ${
                open.scope === s.key
                  ? "border-blue-600 bg-blue-50"
                  : "border-slate-200"
              }`}
            >
              <p className="font-bold">{s.label}</p>
              <p className="mt-1 text-sm text-slate-600">{s.note}</p>
            </button>
          ))}
        </div>

        {freeForm && (
          <Banner tone="warn">
            <b>نطاق حرّ:</b> لا بند فيه أساسي، ويُصاغ بنداً بنداً كما يراه
            المهندس والمجلس. وتستطيع إضافة بنود لا يعرفها الكتالوج من أسفل كل
            مرحلة.
          </Banner>
        )}

        {canManage && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
            <button
              onClick={() => {
                if (
                  !window.confirm(
                    `تصفير اختيارات هذا العرض؟\n\nيبقى ${
                      open.lines.filter((l) => l.essential).length
                    } بنداً أساسياً مؤشَّراً عليه، ويُشطب ما عداه.\n\nالأسعار والكميات لا تتأثر.`
                  )
                ) {
                  return;
                }
                set({ lines: clearChoices(open.lines) });
                onLog(
                  "تعديل",
                  "عقد",
                  `تصفير اختيارات عرض السعر ${open.number}`
                );
              }}
              className="rounded-lg bg-red-50 px-5 py-2 font-bold text-red-700"
            >
              صفّر الاختيارات
            </button>
            <button
              onClick={() => set({ lines: selectAllChoices(open.lines) })}
              className="rounded-lg bg-slate-100 px-5 py-2 font-bold"
            >
              أشّر على الكل
            </button>
            <span className="text-sm text-slate-500">
              التصفير يعود بالعرض إلى البنود الأساسية وحدها — لا إلى لا شيء،
              فعرضٌ بلا صب قواعد ليس عرضاً.
            </span>
          </div>
        )}
      </Panel>

      {/* ---- البنود مرحلةً مرحلة ---- */}
      {stages.map((stage) => {
        const lines = open.lines.filter((l) => l.stage === stage);
        if (lines.length === 0) return null;
        const st = quotationTotals(lines, mode);

        return (
          <Panel key={stage}>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xl font-bold">{stage}</h3>
              <div className="text-left">
                <span className="text-lg font-bold tabular-nums">
                  {fmt(st.price)} د.ك
                </span>
                {showCost && (
                  <span className="mr-3 text-sm text-slate-500">
                    تكلفة {fmt(st.cost)} · هامش {fmt(st.margin)}
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <Th>{""}</Th>
                    <Th>القسم</Th>
                    <Th>البند</Th>
                    <Th>الوحدة</Th>
                    <Th>الكمية</Th>
                    {showCost && <Th>التكلفة</Th>}
                    <Th>سعر البيع</Th>
                    <Th>منه مواد</Th>
                    <Th>الإجمالي</Th>
                    {canManage && <Th>{""}</Th>}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr
                      key={l.itemId}
                      className={`border-b border-slate-100 ${
                        l.chosen ? "" : "bg-slate-50 text-slate-400"
                      }`}
                    >
                      <Td>
                        {l.essential ? (
                          <span
                            className="text-xs font-bold text-slate-500"
                            title="بند أساسي لا يُشطب"
                          >
                            أساسي
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={l.chosen}
                            disabled={!canManage}
                            onChange={(e) =>
                              setLine(l.itemId, { chosen: e.target.checked })
                            }
                            className="h-5 w-5"
                          />
                        )}
                      </Td>
                      <Td>
                        {l.custom && canManage ? (
                          <input
                            type="text"
                            value={l.section}
                            onChange={(e) =>
                              setLine(l.itemId, { section: e.target.value })
                            }
                            placeholder="القسم"
                            className="w-28 rounded border border-slate-200 px-2 py-1"
                          />
                        ) : (
                          l.section || "—"
                        )}
                      </Td>
                      <Td className="font-medium">
                        {l.custom && canManage ? (
                          <input
                            type="text"
                            value={l.name}
                            onChange={(e) =>
                              setLine(l.itemId, { name: e.target.value })
                            }
                            placeholder="وصف البند"
                            className="w-full min-w-[160px] rounded border border-slate-200 px-2 py-1"
                          />
                        ) : (
                          [l.name, l.detail].filter(Boolean).join(" — ") || "—"
                        )}
                      </Td>
                      <Td>{l.unit || "—"}</Td>
                      <Td>
                        <input
                          type="number"
                          step="any"
                          value={l.quantity}
                          disabled={!canManage}
                          onChange={(e) =>
                            setLine(l.itemId, {
                              quantity: Number(e.target.value) || 0,
                            })
                          }
                          className="w-20 rounded border border-slate-200 px-2 py-1 tabular-nums"
                        />
                      </Td>
                      {showCost && (
                        <Td>
                          <input
                            type="number"
                            step="any"
                            value={l.cost}
                            disabled={!canManage}
                            onChange={(e) =>
                              setLine(l.itemId, {
                                cost: Number(e.target.value) || 0,
                              })
                            }
                            className="w-24 rounded border border-slate-200 px-2 py-1 tabular-nums"
                          />
                        </Td>
                      )}
                      <Td>
                        <input
                          type="number"
                          step="any"
                          value={l.price}
                          disabled={!canManage}
                          onChange={(e) =>
                            setLine(l.itemId, {
                              price: Number(e.target.value) || 0,
                            })
                          }
                          className="w-24 rounded border border-slate-200 px-2 py-1 tabular-nums"
                        />
                      </Td>
                      <Td>
                        <input
                          type="number"
                          step="any"
                          value={l.materialPrice}
                          disabled={!canManage}
                          title="حصة المواد من السعر — تُطرح في وضع «مصنعيات فقط»"
                          onChange={(e) =>
                            setLine(l.itemId, {
                              materialPrice: Number(e.target.value) || 0,
                            })
                          }
                          className={`w-24 rounded px-2 py-1 tabular-nums ${
                            mode === "مصنعيات فقط" && l.materialPrice <= 0
                              ? "border border-amber-300 bg-amber-50"
                              : "border border-slate-200"
                          }`}
                        />
                      </Td>
                      <Td className="font-bold">{fmt(linePrice(l, mode))}</Td>
                      {canManage && (
                        <Td>
                          {l.custom && (
                            <button
                              onClick={() =>
                                set({
                                  lines: open.lines.filter(
                                    (x) => x.itemId !== l.itemId
                                  ),
                                })
                              }
                              className="rounded-lg bg-red-50 px-3 py-1 text-red-700"
                            >
                              حذف
                            </button>
                          )}
                        </Td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canManage && (
              <button
                onClick={() =>
                  set({
                    lines: [...open.lines, customLine(stage, "")],
                  })
                }
                className="mt-3 rounded-lg bg-slate-100 px-5 py-2 text-sm font-bold"
              >
                + أضف بنداً خاصاً بهذا العرض في «{stage}»
              </button>
            )}
          </Panel>
        );
      })}

      {/* ---- ما لا يشمله ---- */}
      <Panel
        title="ما لا يشمله هذا العرض"
        subtitle="يخرج من الجلسة نفسها — كل بند شطبه العميل بحضوره يُكتب هنا ويُطبع مع العرض"
      >
        {totals.excluded === 0 ? (
          <Banner tone="ok">
            ✓ العميل لم يشطب بنداً — العرض يشمل كل بنود النطاق
          </Banner>
        ) : (
          <ul className="list-inside list-disc space-y-1 text-sm">
            {exclusions(open.lines).map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

/* ================================================================== */
/* ورقة عرض السعر — للطباعة                                            */
/* ================================================================== */

/**
 * عرض السعر مطبوعاً على ترويسة الشركة.
 *
 * `internal` تجعلها الورقة الداخلية: تُضاف أعمدة التكلفة والهامش. وبدونها
 * لا يظهر رقم تكلفة واحد — فالورقة التي تُسلَّم للعميل لا تحمل أسرارك.
 */
function QuotationSheet({
  quotation,
  company,
  internal,
  onClose,
}: {
  quotation: Quotation;
  company: CompanyProfile;
  internal: boolean;
  onClose: () => void;
}) {
  const totals = quotationTotals(quotation.lines, quotation.pricingMode);
  const stages = stagesOfScope(quotation.scope);
  const chosen = quotation.lines.filter((l) => l.chosen);
  const dropped = exclusions(quotation.lines);
  const until = validUntil(quotation);

  const info: [string, string][] = [
    ["رقم العرض", quotation.number],
    ["التاريخ", quotation.date || "—"],
    ["العميل", quotation.clientName || "—"],
    ["رقم التواصل", quotation.clientPhone || "—"],
    [
      "الموقع",
      [
        quotation.area,
        quotation.block && `قطعة ${quotation.block}`,
        quotation.plot && `قسيمة ${quotation.plot}`,
      ]
        .filter(Boolean)
        .join(" · ") || "—",
    ],
    ["وصف المبنى", quotation.buildingDescription || "—"],
    ["مسطح البناء", quotation.builtArea ? `${fmt(quotation.builtArea)} م²` : "—"],
    ["رقم الرخصة", quotation.licenseNumber || "—"],
    ["نطاق العمل", quotation.scope],
    ["أساس التسعير", quotation.pricingMode],
    ["مدة التنفيذ", `${quotation.durationDays} يوماً`],
    ["صالح حتى", until || "—"],
  ];

  return (
    <div
      className="voucher-sheet fixed inset-0 z-50 overflow-auto bg-slate-800/60 p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="voucher-body designed-sheet mx-auto max-w-4xl bg-white p-8 shadow-xl"
        style={{ minHeight: "26cm" }}
      >
        <div className="mb-6 flex justify-end gap-3 no-print">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-slate-900 px-6 py-3 font-bold text-white"
          >
            🖨 طباعة
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-6 py-3 font-bold"
          >
            إغلاق
          </button>
        </div>

        {/* ترويسة الشركة */}
        <div className="flex items-start justify-between gap-4 border-b-4 border-slate-900 pb-4">
          <div className="flex items-center gap-4">
            {company.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo} alt="" style={{ height: 72 }} />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-[10px] text-slate-400">
                الشعار
              </div>
            )}
            <div>
              <div className="text-2xl font-bold">{company.name}</div>
              {company.nameEn && (
                <div className="text-sm text-slate-600">{company.nameEn}</div>
              )}
              <div className="mt-1 text-xs text-slate-600">
                {[company.address, company.phone, company.email]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
          </div>

          <div className="text-left">
            <div className="inline-block rounded-lg border-2 border-slate-900 px-6 py-3 text-center">
              <div className="text-xl font-bold">
                {internal ? "ورقة تكلفة داخلية" : "عرض سعر"}
              </div>
              <div className="mt-1 text-xs">
                {internal ? "INTERNAL — NOT FOR CLIENT" : "PRICE QUOTATION"}
              </div>
            </div>
            <div className="mt-2 text-sm font-bold">{quotation.number}</div>
          </div>
        </div>

        {internal && (
          <p className="mt-4 rounded-lg border-2 border-red-400 bg-red-50 px-4 py-2 text-sm font-bold text-red-800">
            ورقة داخلية تحمل التكلفة وهامش الربح — لا تُسلَّم للعميل.
          </p>
        )}

        {/* البيانات */}
        <table className="mt-6 w-full text-right text-sm">
          <tbody>
            {info.map(([label, value]) => (
              <tr key={label} className="border-b border-slate-200">
                <td className="w-40 bg-slate-50 px-4 py-2 font-bold">{label}</td>
                <td className="px-4 py-2">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* القيمة */}
        <div className="mt-6 flex items-stretch justify-between gap-4">
          <div className="flex-1 rounded-lg border border-slate-300 p-4">
            <div className="text-xs text-slate-500">القيمة بالحروف</div>
            <div className="mt-1 text-lg font-bold leading-relaxed">
              {amountInWords(totals.price)}
            </div>
          </div>
          <div className="w-56 rounded-lg border-2 border-slate-900 p-4 text-center">
            <div className="text-xs text-slate-500">قيمة العرض</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">
              {fmt(totals.price)}
            </div>
            <div className="text-sm">د.ك</div>
          </div>
        </div>

        {internal && (
          <div className="mt-4 flex gap-4">
            <div className="flex-1 rounded-lg bg-slate-100 p-3 text-center">
              <div className="text-xs text-slate-600">التكلفة</div>
              <div className="text-xl font-bold tabular-nums">
                {fmt(totals.cost)}
              </div>
            </div>
            <div
              className={`flex-1 rounded-lg p-3 text-center ${
                totals.margin < 0 ? "bg-red-100" : "bg-green-100"
              }`}
            >
              <div className="text-xs">الهامش</div>
              <div className="text-xl font-bold tabular-nums">
                {fmt(totals.margin)} · {totals.marginPercent.toFixed(1)}%
              </div>
            </div>
          </div>
        )}

        {/* البنود */}
        <h3 className="mt-8 text-lg font-bold">الأعمال والبنود المتفق عليها</h3>
        <table className="mt-3 w-full border border-slate-300 text-right text-xs">
          <thead className="bg-slate-200">
            <tr>
              <th className="border border-slate-300 px-2 py-2">م</th>
              <th className="border border-slate-300 px-2 py-2">المرحلة</th>
              <th className="border border-slate-300 px-2 py-2">القسم</th>
              <th className="border border-slate-300 px-2 py-2">البند</th>
              <th className="border border-slate-300 px-2 py-2">الوحدة</th>
              <th className="border border-slate-300 px-2 py-2">الكمية</th>
              {internal && (
                <th className="border border-slate-300 px-2 py-2">التكلفة</th>
              )}
              <th className="border border-slate-300 px-2 py-2">السعر</th>
              <th className="border border-slate-300 px-2 py-2">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => {
              const lines = chosen.filter((l) => l.stage === stage);
              if (lines.length === 0) return null;
              const st = quotationTotals(lines, quotation.pricingMode);
              return (
                <Fragment key={stage}>
                  {lines.map((l, i) => (
                    <tr key={l.itemId}>
                      <td className="border border-slate-300 px-2 py-1 text-center">
                        {i + 1}
                      </td>
                      <td className="border border-slate-300 px-2 py-1">
                        {i === 0 ? stage : ""}
                      </td>
                      <td className="border border-slate-300 px-2 py-1">
                        {l.section}
                      </td>
                      <td className="border border-slate-300 px-2 py-1">
                        {[l.name, l.detail].filter(Boolean).join(" — ")}
                        {l.description ? ` (${l.description})` : ""}
                      </td>
                      <td className="border border-slate-300 px-2 py-1 text-center">
                        {l.unit || "—"}
                      </td>
                      <td className="border border-slate-300 px-2 py-1 text-center tabular-nums">
                        {l.quantity || 1}
                      </td>
                      {internal && (
                        <td className="border border-slate-300 px-2 py-1 tabular-nums">
                          {fmt(lineCost(l, quotation.pricingMode))}
                        </td>
                      )}
                      <td className="border border-slate-300 px-2 py-1 tabular-nums">
                        {fmt(l.price)}
                      </td>
                      <td className="border border-slate-300 px-2 py-1 tabular-nums">
                        {fmt(linePrice(l, quotation.pricingMode))}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-100 font-bold">
                    <td
                      className="border border-slate-300 px-2 py-1"
                      colSpan={internal ? 6 : 6}
                    >
                      الدفعة المستحقة عند إنجاز «{stage}»
                    </td>
                    {internal && (
                      <td className="border border-slate-300 px-2 py-1 tabular-nums">
                        {fmt(st.cost)}
                      </td>
                    )}
                    <td className="border border-slate-300 px-2 py-1"></td>
                    <td className="border border-slate-300 px-2 py-1 tabular-nums">
                      {fmt(st.price)}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            <tr className="bg-slate-800 font-bold text-white">
              <td
                className="border border-slate-300 px-2 py-2"
                colSpan={internal ? 6 : 6}
              >
                إجمالي قيمة العرض
              </td>
              {internal && (
                <td className="border border-slate-300 px-2 py-2 tabular-nums">
                  {fmt(totals.cost)}
                </td>
              )}
              <td className="border border-slate-300 px-2 py-2"></td>
              <td className="border border-slate-300 px-2 py-2 tabular-nums">
                {fmt(totals.price)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ما لا يشمله */}
        {dropped.length > 0 && (
          <>
            <h3 className="mt-8 text-lg font-bold">ما لا يشمله هذا العرض</h3>
            <ul className="mt-2 list-inside list-disc text-sm">
              {dropped.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </>
        )}

        {quotation.notes && (
          <>
            <h3 className="mt-6 text-lg font-bold">ملاحظات</h3>
            <p className="mt-1 text-sm">{quotation.notes}</p>
          </>
        )}

        {/* الشروط */}
        {!internal && (
          <>
            <h3 className="mt-8 text-lg font-bold">شروط العرض</h3>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
              <li>
                هذا العرض صالح لمدة {quotation.validityDays} يوماً من تاريخ
                تقديمه{until ? ` — أي حتى ${until}` : ""}.
              </li>
              <li>
                مدة التنفيذ {quotation.durationDays} يوماً، ولا تُحتسب أيام العطل
                والراحة والإجازات الرسمية والأعياد وأي ظروف قاهرة تلزم عدم العمل
                من قبل الحكومة أو الظروف المناخية القاسية.
              </li>
              <li>
                تُدفع قيمة العقد على دفعات مرتبطة بإنجاز المراحل الموضحة أعلاه.
              </li>
              {quotation.pricingMode === "مصنعيات فقط" && (
                <li>
                  <b>هذا العرض على المصنعية فقط</b> — توريد المواد على الطرف
                  الثاني، ولا يشمل السعر قيمتها.
                </li>
              )}
              <li>
                أي أعمال إضافية خارج نطاق هذا العرض لا تُنفَّذ إلا بموافقة كتابية
                واعتماد سعرها.
              </li>
              <li>
                المواد المدعومة تكون لصالح الطرف الأول ويقوم الطرف الثاني بدفع
                الرسوم للجهات الحكومية.
              </li>
              <li>
                في حال ارتفاع أسعار المواد سواء المدعوم أو الحر، يكون الطرف
                الثاني مسؤولاً عن هذا الارتفاع ويقوم بدفع القيمة الإضافية.
              </li>
              <li>يتحوّل هذا العرض إلى عقد ملزم عند اعتماده وتوقيعه من الطرفين.</li>
            </ul>

            <div className="mt-12 flex justify-between text-sm">
              <div>
                <div className="font-bold">الطرف الأول</div>
                <div className="mt-6">الاسم: ................................</div>
                <div className="mt-3">التوقيع: ..............................</div>
              </div>
              <div>
                <div className="font-bold">الطرف الثاني</div>
                <div className="mt-6">الاسم: ................................</div>
                <div className="mt-3">التوقيع: ..............................</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/* الفواتير                                                            */
/* ================================================================== */

/**
 * فواتير العملاء.
 *
 * تُصدَر عن دفعة في عقد، فتُملأ بياناتها من العقد بضغطة ولا تُكتب مرتين.
 * ورقمها يُثبَّت وقت الإصدار: مستند سُلِّم للعميل لا يتبدّل بعده.
 */
function InvoicesPage({
  invoices,
  contractors,
  projects,
  payments,
  canManage,
  currentUserName,
  setInvoices,
  onPrint,
  onLog,
}: {
  invoices: Invoice[];
  contractors: Contractor[];
  projects: Project[];
  payments: PaymentMethod[];
  canManage: boolean;
  currentUserName: string;
  setInvoices: Dispatch<SetStateAction<Invoice[]>>;
  onPrint: (invoice: Invoice) => void;
  onLog: (
    action: AuditAction,
    entity: AuditEntity,
    summary: string,
    change?: { before?: string; after?: string }
  ) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = invoices.find((i) => i.id === openId) ?? null;

  const patch = (id: string, change: Partial<Invoice>) =>
    setInvoices((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...change } : i))
    );

  const blank = (): Invoice => ({
    id: newId(),
    number: nextInvoiceNumber(invoices),
    date: todayISO(),
    clientName: "",
    clientCivilId: "",
    clientPhone: "",
    projectLocation: "",
    project: "",
    contractTitle: "",
    installmentLabel: "",
    contractNumber: "",
    installmentNumber: 0,
    paymentMethod: "",
    lines: [{ description: "", amount: 0 }],
    notes: "",
    createdBy: currentUserName,
    createdAt: new Date().toISOString(),
  });

  const createNew = () => {
    const invoice = blank();
    setInvoices((prev) => [invoice, ...prev]);
    setOpenId(invoice.id);
    onLog("إنشاء", "عقد", `فاتورة جديدة ${invoice.number}`);
  };

  /** يملأ الفاتورة من دفعة عقد — يوفّر إعادة كتابة ما هو مسجَّل أصلاً */
  const fillFromInstallment = (
    invoice: Invoice,
    contract: Contractor,
    number: number
  ) => {
    const installment = contract.installments.find((i) => i.number === number);
    const project = projects.find((p) => p.name === contract.project);
    const place = [
      contract.area,
      contract.block && `قطعة ${contract.block}`,
      contract.plot && `قسيمة رقم ${contract.plot}`,
    ]
      .filter(Boolean)
      .join(" ");

    patch(invoice.id, {
      contractNumber: contract.contractNumber,
      installmentNumber: number,
      installmentLabel: installmentLabel(number),
      contractTitle: contract.workType || contract.documentType || "عقد",
      clientName: contract.name,
      clientCivilId: contract.civilId,
      project: contract.project,
      projectLocation: place || project?.name || contract.project,
      lines: [
        {
          description: installment?.condition || "",
          amount: Number(installment?.value) || 0,
        },
      ],
    });
  };

  /* ---------------- القائمة ---------------- */

  if (!open) {
    return (
      <Panel
        title="الفواتير"
        subtitle="تُصدَر للعميل عن دفعة مستحقة، بتنسيق الشركة المعتمد"
      >
        {canManage && (
          <button
            onClick={createNew}
            className="mb-5 rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
          >
            فاتورة جديدة
          </button>
        )}

        {invoices.length === 0 ? (
          <Empty>لا توجد فواتير بعد</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Th>الرقم</Th>
                  <Th>التاريخ</Th>
                  <Th>العميل</Th>
                  <Th>العقد</Th>
                  <Th>الدفعة</Th>
                  <Th>المبلغ</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-slate-200">
                    <Td className="font-bold">{invoice.number}</Td>
                    <Td>{invoice.date || "—"}</Td>
                    <Td>{invoice.clientName || "—"}</Td>
                    <Td>{invoice.contractTitle || "—"}</Td>
                    <Td>{invoice.installmentLabel || "—"}</Td>
                    <Td>
                      <Money value={invoiceTotal(invoice)} bold />
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setOpenId(invoice.id)}
                          className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700"
                        >
                          فتح
                        </button>
                        <button
                          onClick={() => onPrint(invoice)}
                          className="rounded-lg bg-slate-100 px-3 py-2"
                        >
                          🖨
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    );
  }

  /* ---------------- التحرير ---------------- */

  const set = (change: Partial<Invoice>) => patch(open.id, change);
  const contract = contractors.find(
    (c) => c.contractNumber === open.contractNumber
  );

  const setLine = (index: number, change: Partial<InvoiceLine>) =>
    set({
      lines: open.lines.map((l, i) => (i === index ? { ...l, ...change } : l)),
    });

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpenId(null)}
              className="rounded-lg bg-slate-100 px-4 py-2 font-bold"
            >
              ← الفواتير
            </button>
            <span className="text-xl font-bold">{open.number}</span>
            <span className="text-xs text-slate-500">✓ محفوظة تلقائياً</span>
          </div>
          <button
            onClick={() => onPrint(open)}
            className="rounded-lg bg-slate-900 px-5 py-2 font-bold text-white"
          >
            🖨 طباعة الفاتورة
          </button>
        </div>
      </Panel>

      <Panel
        title="الإصدار من عقد"
        subtitle="يملأ بيانات العميل والموقع والدفعة من العقد المسجّل"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="العقد">
            <select
              value={open.contractNumber}
              disabled={!canManage}
              onChange={(e) => {
                const picked = contractors.find(
                  (c) => c.contractNumber === e.target.value
                );
                if (!picked) {
                  set({ contractNumber: "", installmentNumber: 0 });
                  return;
                }
                fillFromInstallment(open, picked, 1);
              }}
              className={inputClass}
            >
              <option value="">— فاتورة مستقلة بلا عقد —</option>
              {contractors.map((c) => (
                <option key={c.id} value={c.contractNumber}>
                  {c.contractNumber} — {c.name} · {c.project}
                </option>
              ))}
            </select>
          </Field>

          <Field label="الدفعة">
            <select
              value={open.installmentNumber || ""}
              disabled={!canManage || !contract}
              onChange={(e) =>
                contract &&
                fillFromInstallment(open, contract, Number(e.target.value))
              }
              className={inputClass}
            >
              <option value="">—</option>
              {(contract?.installments ?? [])
                .filter(isPayableInstallment)
                .map((i) => (
                <option key={i.number} value={i.number}>
                  {installmentLabel(i.number)} — {fmt(Number(i.value) || 0)} د.ك
                  {i.approved ? " · معتمدة" : ""}
                </option>
                ))}
            </select>
          </Field>
        </div>
      </Panel>

      <Panel title="بيانات الفاتورة">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="رقم الفاتورة">
            <input
              type="text"
              value={open.number}
              disabled={!canManage}
              onChange={(e) => set({ number: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="تاريخ الفاتورة">
            <input
              type="date"
              value={open.date}
              disabled={!canManage}
              onChange={(e) => set({ date: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="طريقة الدفع">
            <select
              value={open.paymentMethod}
              disabled={!canManage}
              onChange={(e) => set({ paymentMethod: e.target.value })}
              className={inputClass}
            >
              <option value="">—</option>
              {payments.map((p) => (
                <option key={p.label}>{p.label}</option>
              ))}
            </select>
          </Field>

          <Field label="اسم العميل">
            <input
              type="text"
              value={open.clientName}
              disabled={!canManage}
              onChange={(e) => set({ clientName: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="الرقم المدني">
            <input
              type="text"
              value={open.clientCivilId}
              disabled={!canManage}
              onChange={(e) => set({ clientCivilId: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="رقم الهاتف">
            <input
              type="text"
              value={open.clientPhone}
              disabled={!canManage}
              onChange={(e) => set({ clientPhone: e.target.value })}
              className={inputClass}
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="موقع المشروع" hint="كما يُطبع في الفاتورة">
              <input
                type="text"
                value={open.projectLocation}
                disabled={!canManage}
                onChange={(e) => set({ projectLocation: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="عنوان العقد">
            <input
              type="text"
              value={open.contractTitle}
              disabled={!canManage}
              placeholder="عقد تشطيب بالكامل"
              onChange={(e) => set({ contractTitle: e.target.value })}
              className={inputClass}
            />
          </Field>

          <Field label="رقم الدفعة">
            <input
              type="text"
              value={open.installmentLabel}
              disabled={!canManage}
              placeholder="الدفعة الثالثة"
              onChange={(e) => set({ installmentLabel: e.target.value })}
              className={inputClass}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="ملاحظات" hint="تُطبع تحت الجدول">
              <input
                type="text"
                value={open.notes}
                disabled={!canManage}
                onChange={(e) => set({ notes: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
        </div>
      </Panel>

      <Panel title="وصف الأعمال">
        <div className="space-y-3">
          {open.lines.map((line, index) => (
            <div key={index} className="flex flex-wrap items-end gap-3">
              <span className="w-6 pb-3 font-bold">{index + 1}</span>
              <div className="min-w-[240px] flex-1">
                <Field label="الوصف">
                  <input
                    type="text"
                    value={line.description}
                    disabled={!canManage}
                    onChange={(e) =>
                      setLine(index, { description: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="w-40">
                <Field label="المبلغ">
                  <input
                    type="number"
                    step="0.001"
                    value={line.amount}
                    disabled={!canManage}
                    onChange={(e) =>
                      setLine(index, { amount: Number(e.target.value) || 0 })
                    }
                    className={`${inputClass} tabular-nums`}
                  />
                </Field>
              </div>
              {canManage && open.lines.length > 1 && (
                <button
                  onClick={() =>
                    set({ lines: open.lines.filter((_, i) => i !== index) })
                  }
                  className="rounded-lg bg-red-50 px-4 py-3 font-bold text-red-700"
                >
                  حذف
                </button>
              )}
            </div>
          ))}
        </div>

        {canManage && (
          <button
            onClick={() =>
              set({ lines: [...open.lines, { description: "", amount: 0 }] })
            }
            className="mt-3 rounded-lg bg-slate-100 px-5 py-2 font-bold"
          >
            إضافة سطر
          </button>
        )}

        <div className="mt-5 rounded-xl bg-slate-100 px-4 py-3">
          <span className="font-bold">إجمالي الفاتورة: </span>
          <Money value={invoiceTotal(open)} bold /> د.ك
          <div className="mt-1 text-sm text-slate-600">
            {amountInWords(invoiceTotal(open))}
          </div>
        </div>
      </Panel>
    </>
  );
}

/* ================================================================== */
/* اعتماد الحركات                                                      */
/* ================================================================== */

/**
 * الحركات المنتظِرة اعتماد صاحب الشركة أو المدير العام أو المدير المالي.
 *
 * قرار مجلس الإدارة في ١٢ سبتمبر ٢٠٢٦: لا تدخل حركة الدفاتر قبل اعتمادها.
 * وهي محفوظة كاملةً منذ لحظة إدخالها — الاعتماد يُدخلها الحسابات، ولا
 * يُوجِدها. فلا يضيع عمل المحاسب في انتظار توقيع.
 */
function MovementApprovalsPage({
  pending,
  rejected,
  approverName,
  canApprove,
  threshold,
  onDecide,
  onEdit,
}: {
  pending: Movement[];
  rejected: Movement[];
  approverName: string;
  canApprove: boolean;
  threshold: number;
  onDecide: (movement: Movement, state: ApprovalState, note: string) => void;
  onEdit: (movement: Movement) => void;
}) {
  const [note, setNote] = useState<Record<string, string>>({});
  const total = round3(pending.reduce((s, m) => s + m.amount, 0));

  const decide = (movement: Movement, state: ApprovalState) => {
    const reason = (note[movement.id] ?? "").trim();
    if (state === "مرفوضة" && !reason) {
      window.alert("اكتب سبب الرفض قبل الرفض — السبب جزء من السجل.");
      return;
    }
    onDecide(movement, state, reason);
    setNote((prev) => ({ ...prev, [movement.id]: "" }));
  };

  return (
    <>
      <Panel
        title="اعتماد الحركات"
        subtitle="لا تدخل الحركة ميزان المراجعة ولا القوائم المالية قبل اعتمادها"
      >
        {!canApprove && (
          <Banner tone="warn">
            ليست لديك صلاحية الاعتماد — تستطيع الاطلاع فقط. الاعتماد لصاحب
            الشركة والمدير العام والمدير العام المالي والإداري.
          </Banner>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-amber-50 p-4">
            <p className="text-sm text-amber-900">بانتظار الاعتماد</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-900">
              {pending.length}
            </p>
          </div>
          <div className="rounded-xl bg-slate-100 p-4">
            <p className="text-sm text-slate-600">مجموعها</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{fmt(total)}</p>
            <p className="text-sm text-slate-500">د.ك خارج الدفاتر حالياً</p>
          </div>
          <div className="rounded-xl bg-slate-100 p-4">
            <p className="text-sm text-slate-600">حدّ الاعتماد التلقائي</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {threshold > 0 ? fmt(threshold) : "—"}
            </p>
            <p className="text-sm text-slate-500">
              {threshold > 0
                ? "ما دونه يُعتمد تلقائياً"
                : "كل حركة تحتاج اعتماداً"}
            </p>
          </div>
        </div>

        {pending.length === 0 ? (
          <div className="mt-5">
            <Banner tone="ok">✓ لا توجد حركات بانتظار الاعتماد</Banner>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {pending.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-amber-200 bg-amber-50/40 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <span className="font-bold">قيد {m.entryNo}</span>
                    <span className="mr-3 text-sm text-slate-600">
                      {m.date} · {m.movementType}
                    </span>
                  </div>
                  <div className="text-lg font-bold tabular-nums">
                    {fmt(m.amount)} د.ك
                  </div>
                </div>

                <p className="mt-1 font-medium">{m.description || "بلا بيان"}</p>

                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
                  <span>البند: {m.itemName || "—"}</span>
                  <span>المشروع: {m.project || "—"}</span>
                  <span>الطرف: {m.party || m.person || "—"}</span>
                  <span>الدفع: {m.paymentMethod || "—"}</span>
                  <span className="font-medium">
                    مدين {m.debitCode} / دائن {m.creditCode}
                  </span>
                </div>

                {canApprove && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={note[m.id] ?? ""}
                      onChange={(e) =>
                        setNote((prev) => ({ ...prev, [m.id]: e.target.value }))
                      }
                      placeholder="ملاحظة أو سبب الرفض…"
                      className="min-w-[200px] flex-1 rounded-lg border border-slate-300 px-4 py-2"
                    />
                    <button
                      onClick={() => decide(m, "معتمدة")}
                      className="rounded-lg bg-green-600 px-6 py-2 font-bold text-white"
                    >
                      اعتماد
                    </button>
                    <button
                      onClick={() => decide(m, "مرفوضة")}
                      className="rounded-lg bg-red-50 px-5 py-2 font-bold text-red-700"
                    >
                      رفض
                    </button>
                    <button
                      onClick={() => onEdit(m)}
                      className="rounded-lg bg-slate-100 px-5 py-2 font-bold"
                    >
                      تصحيح
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-5 text-sm text-slate-500">
          الاعتماد باسم <b>{approverName}</b>، ويُسجَّل في سجل التدقيق بوقته.
          وتعديل حركة معتمدة يعيدها إلى الانتظار — فلا يتغيّر رقم في القوائم بلا
          موافقة.
        </p>
      </Panel>

      {rejected.length > 0 && (
        <Panel
          title="حركات مرفوضة"
          subtitle="محفوظة بسبب رفضها — لا تدخل الحسابات، ولم تُحذف"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Th>القيد</Th>
                  <Th>التاريخ</Th>
                  <Th>البيان</Th>
                  <Th>المبلغ</Th>
                  <Th>سبب الرفض</Th>
                  <Th>رفضها</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {rejected.map((m) => (
                  <tr key={m.id} className="border-b border-slate-200">
                    <Td>{m.entryNo}</Td>
                    <Td>{m.date}</Td>
                    <Td>{m.description || "—"}</Td>
                    <Td>
                      <Money value={m.amount} />
                    </Td>
                    <Td className="text-red-700">{m.approvalNote || "—"}</Td>
                    <Td className="text-slate-500">{m.approvedBy || "—"}</Td>
                    <Td>
                      {canApprove && (
                        <button
                          onClick={() => onDecide(m, "بانتظار الاعتماد", "")}
                          className="rounded-lg bg-slate-100 px-3 py-2"
                        >
                          إعادة للانتظار
                        </button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}

/* ================================================================== */
/* الإشعارات                                                           */
/* ================================================================== */

const NOTICE_TONE: Record<
  NoticeTone,
  { box: string; dot: string; label: string }
> = {
  action: {
    box: "border-amber-300 bg-amber-50",
    dot: "bg-amber-500",
    label: "ينتظر قرارك",
  },
  warn: {
    box: "border-red-200 bg-red-50",
    dot: "bg-red-500",
    label: "يحتاج انتباهاً",
  },
  info: {
    box: "border-slate-200 bg-slate-50",
    dot: "bg-slate-400",
    label: "للعلم",
  },
};

/**
 * ما ينتظر المستخدم حين يدخل.
 *
 * الإشعارات محسوبة لحظة العرض، فتزول بزوال سببها — ولا يبقى تنبيه عن
 * حركة اعتُمدت أو دفعة صُرفت. ويليها ما جرى في غيابه من أفعال غيره.
 */
function NoticesPanel({
  notices,
  activity,
  lastSeenAt,
  onGo,
}: {
  notices: Notice[];
  activity: AuditEntry[];
  lastSeenAt: string;
  onGo: (page: string) => void;
}) {
  if (notices.length === 0 && activity.length === 0) {
    return (
      <Panel title="الإشعارات">
        <Banner tone="ok">
          ✓ لا شيء ينتظر قرارك، ولا جديد منذ آخر دخول لك.
        </Banner>
      </Panel>
    );
  }

  return (
    <Panel
      title="الإشعارات"
      subtitle="ما ينتظر قرارك، وما جرى في غيابك"
    >
      {notices.length > 0 && (
        <div className="space-y-3">
          {notices.map((notice) => {
            const tone = NOTICE_TONE[notice.tone];
            return (
              <div
                key={notice.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${tone.box}`}
              >
                <div className="flex min-w-[240px] flex-1 items-start gap-3">
                  <span
                    className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`}
                  />
                  <div>
                    <p className="font-bold">{notice.title}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {notice.detail}
                    </p>
                  </div>
                </div>
                {notice.page && (
                  <button
                    onClick={() => onGo(notice.page as string)}
                    className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-bold text-white"
                  >
                    {notice.page} ←
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activity.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 font-bold">
            ما جرى منذ آخر دخول لك
            {lastSeenAt && (
              <span className="mr-2 text-sm font-normal text-slate-500">
                ({lastSeenAt.slice(0, 16).replace("T", " ")})
              </span>
            )}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Th>الوقت</Th>
                  <Th>من</Th>
                  <Th>الفعل</Th>
                  <Th>التفصيل</Th>
                </tr>
              </thead>
              <tbody>
                {activity.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100">
                    <Td className="whitespace-nowrap text-slate-500">
                      {entry.at.slice(5, 16).replace("T", " ")}
                    </Td>
                    <Td className="font-medium">{entry.user}</Td>
                    <Td>
                      <span
                        className={`rounded px-2 py-1 text-xs ${
                          AUDIT_TONE[entry.action] ?? "bg-slate-100"
                        }`}
                      >
                        {entry.action} · {entry.entity}
                      </span>
                    </Td>
                    <Td>{entry.summary}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ================================================================== */
/* الدخول والقفل                                                       */
/* ================================================================== */

/**
 * شاشة الدخول.
 *
 * كانت تعرض أسماء الموظفين ليُختار منها، فوجب أن تصل قائمة المستخدمين
 * كلَّ جهاز. وكان التحقّق يجري في المتصفّح، فمن فتح أدوات المطوّر
 * تجاوزه. فصار الاسم يُكتب، والتحقّق على الخادم.
 *
 * والاسم يُحفظ في الجهاز وحده فيجده صاحبه مكتوباً، وكلمة المرور لا
 * تُحفظ أبداً. ورسالة الخطأ واحدة سواء أخطأ في الاسم أو في الكلمة —
 * فلا يُستدلّ منها على وجود حسابٍ من عدمه.
 */
function SignInScreen({
  company,
  onIn,
}: {
  company: CompanyProfile;
  onIn: (user: ServerUser) => void;
}) {
  const [remembered, setRemembered] = useState(() => lastUser());
  const [name, setName] = useState(() => lastUser());
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const enter = async () => {
    if (!name.trim() || !password) return;
    setBusy(true);
    setProblem("");
    const outcome = await serverSignIn(name.trim(), password);
    setBusy(false);
    /* لا تبقى الكلمة في الذاكرة بعد استعمالها، نجح الدخول أو أخفق */
    setPassword("");
    if (!outcome.ok) {
      setProblem(outcome.error);
      return;
    }
    onIn(outcome.user);
  };

  return (
    <main
      dir="rtl"
      className="flex min-h-screen items-center justify-center bg-slate-900 p-6"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-8 text-center">
          {company.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logo} alt="" className="mx-auto mb-4 max-h-20" />
          ) : null}
          <h1 className="text-2xl font-bold">{company.name}</h1>
          <p className="mt-1 text-sm text-slate-500">النظام المالي والمحاسبي</p>
        </div>

        <Field label="اسم المستخدم">
          <input
            type="text"
            autoFocus={!remembered}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setProblem("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void enter();
            }}
            className={inputClass}
          />
        </Field>

        {remembered ? (
          <button
            onClick={() => {
              forgetUser();
              setRemembered("");
              setName("");
              setPassword("");
              setProblem("");
            }}
            className="mt-1 text-xs text-slate-500 hover:underline"
          >
            لستَ {remembered}؟ غيّر المستخدم
          </button>
        ) : null}

        <div className="mt-4">
          <Field label="كلمة المرور">
            <input
              type="password"
              autoFocus={Boolean(remembered)}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setProblem("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void enter();
              }}
              className={inputClass}
            />
          </Field>
        </div>

        {problem && (
          <p className="mt-3 text-sm font-medium text-red-600">{problem}</p>
        )}

        <button
          onClick={() => void enter()}
          disabled={!name.trim() || !password || busy}
          className="mt-5 w-full rounded-lg bg-slate-900 px-6 py-3 font-bold text-white disabled:bg-slate-300"
        >
          {busy ? "…" : "دخول"}
        </button>

        <p className="mt-8 text-center text-xs text-slate-400">
          التحقّق على الخادم — وكلمة المرور لا تُحفظ في هذا الجهاز
        </p>
      </div>
    </main>
  );
}

/**
 * يغيّر المستخدم كلمته بنفسه.
 *
 * لا تلزمه صلاحية، لأنه يغيّر كلمته هو لا كلمة غيره. وتُطلب الحالية
 * أولاً حتى لا يغيّرها من وجد الجهاز مفتوحاً وصاحبه غائب.
 *
 * و`forced` تعني أنها كلمةٌ أعطاه إياها المدير، أو رقمٌ من زمن
 * المتصفّح، فلا يُفتح له النظام قبل أن يضع ما يعرفه وحده.
 */
function PasswordPanel({
  forced,
  onDone,
  onCancel,
}: {
  forced: boolean;
  onDone: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const save = async () => {
    if (next !== again) {
      setProblem("الكلمتان غير متطابقتين");
      return;
    }
    setBusy(true);
    setProblem("");
    const outcome = await changePassword(current, next);
    setBusy(false);
    if (!outcome.ok) {
      setProblem(outcome.error ?? "تعذّر التغيير");
      return;
    }
    setCurrent("");
    setNext("");
    setAgain("");
    await onDone();
  };

  return (
    <Panel
      title={forced ? "ضع كلمة مرورٍ تعرفها وحدك" : "تغيير كلمة المرور"}
      subtitle={
        forced
          ? "كلمتك الحالية يعرفها غيرك — ولا يُفتح النظام قبل تغييرها"
          : "تُطلب الحالية أولاً، فلا يغيّرها من وجد جهازك مفتوحاً"
      }
    >
      {problem ? <Banner tone="error">{problem}</Banner> : null}

      <div className="grid max-w-xl grid-cols-1 gap-3">
        <Field label="كلمة المرور الحالية">
          <input
            type="password"
            autoFocus
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="الجديدة" hint="ثمانية محارف فأكثر، ولا تكون أرقاماً فقط">
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="أعدها">
          <input
            type="password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
            }}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={() => void save()}
          disabled={!current || !next || !again || busy}
          className="rounded-lg bg-slate-900 px-6 py-3 font-bold text-white disabled:bg-slate-300"
        >
          {busy ? "…" : "احفظ"}
        </button>
        <button
          onClick={() => void onCancel()}
          className="rounded-lg bg-slate-100 px-6 py-3 font-bold text-slate-700"
        >
          {forced ? "خروج" : "إلغاء"}
        </button>
      </div>
    </Panel>
  );
}

/**
 * الشاشة المقفلة.
 *
 * قفلٌ لا خروج: ما كان في الشاشة باقٍ تحتها، فمن عاد أكمل من حيث وقف
 * ولم يضع ما كتب. وتُطلب كلمة المرور وحدها والاسم ظاهر — فمن قام
 * لحظةً عاد بكلمةٍ واحدة، ومن ترك جهازه لغيره لم يترك له حسابه.
 */
function LockScreen({
  name,
  onOpen,
  onOther,
}: {
  name: string;
  onOpen: () => void;
  onOther: () => void | Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const open = async () => {
    if (!password) return;
    setBusy(true);
    setProblem("");
    const outcome = await serverSignIn(name, password);
    setBusy(false);
    setPassword("");
    if (!outcome.ok) {
      setProblem(outcome.error);
      return;
    }
    onOpen();
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 p-6 no-print"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <p className="text-sm text-slate-500">الشاشة مقفلة</p>
        <p className="mt-1 text-xl font-bold">{name}</p>
        <p className="mt-3 text-sm text-slate-600">
          عملك باقٍ كما تركته — اكتب كلمة مرورك لتكمل.
        </p>

        <div className="mt-5">
          <Field label="كلمة المرور">
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setProblem("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void open();
              }}
              className={inputClass}
            />
          </Field>
        </div>

        {problem && (
          <p className="mt-3 text-sm font-medium text-red-600">{problem}</p>
        )}

        <button
          onClick={() => void open()}
          disabled={!password || busy}
          className="mt-5 w-full rounded-lg bg-slate-900 px-6 py-3 font-bold text-white disabled:bg-slate-300"
        >
          {busy ? "…" : "افتح"}
        </button>

        <button
          onClick={() => void onOther()}
          className="mt-3 w-full text-xs text-slate-500 hover:underline"
        >
          مستخدمٌ آخر — اخرج من هذا الحساب
        </button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* إدارة المستخدمين والصلاحيات                                         */
/* ================================================================== */

const BLANK_USER = {
  name: "",
  jobTitle: "",
  role: "secretary" as RoleKey,
  pin: "",
  pin2: "",
};

function UsersPage({
  users,
  setUsers,
  currentUserId,
}: {
  users: User[];
  setUsers: Dispatch<SetStateAction<User[]>>;
  currentUserId: string | null;
}) {
  const [form, setForm] = useState(BLANK_USER);
  const [permissions, setPermissions] = useState<Permission[]>(
    roleDefinition("secretary").permissions
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  const set = (key: keyof typeof BLANK_USER, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const pickRole = (role: RoleKey) => {
    setForm((prev) => ({ ...prev, role }));
    // القالب يملأ الصلاحيات، ويبقى تعديلها حراً بعد ذلك
    if (role !== "custom") setPermissions(roleDefinition(role).permissions);
  };

  const toggle = (permission: Permission) =>
    setPermissions((prev) => {
      const next = prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission];
      // أي تعديل يدوي يحوّل الدور إلى مخصّص
      setForm((f) => ({ ...f, role: "custom" }));
      return next;
    });

  const openNew = () => {
    setEditingId(null);
    setForm(BLANK_USER);
    setPermissions(roleDefinition("secretary").permissions);
    setError("");
    setShowForm(true);
  };

  const openEdit = (user: User) => {
    setEditingId(user.id);
    setForm({
      name: user.name,
      jobTitle: user.jobTitle,
      role: user.role,
      pin: "",
      pin2: "",
    });
    setPermissions(user.permissions);
    setError("");
    setShowForm(true);
  };

  const save = async () => {
    const name = form.name.trim();
    if (!name) return setError("اسم المستخدم مطلوب");
    if (users.some((u) => u.id !== editingId && u.name.trim() === name)) {
      return setError("يوجد مستخدم بنفس الاسم");
    }
    if (permissions.length === 0) {
      return setError("اختر صلاحية واحدة على الأقل");
    }

    /*
     * لا يُنزَع «إدارة المستخدمين» من آخر من يملكها.
     *
     * النظام يمنع إيقافه وحذفه، وكان يسمح بنزع الصلاحية منه بالتعديل —
     * وأثرها واحد: تختفي شاشة المستخدمين ولا سبيل لإعادتها إلا باستيراد
     * نسخة احتياطية. والأدوار التي تُمنح كل الصلاحيات تلقائياً (المالك
     * والمدير العام) لا يقع بها هذا، فتُستثنى.
     */
    const keepsAdmin =
      permissions.includes("users.manage") ||
      form.role === "owner" ||
      form.role === "manager";

    if (editingId && !keepsAdmin) {
      const others = users.filter(
        (u) =>
          u.id !== editingId &&
          u.active &&
          (u.permissions.includes("users.manage") ||
            u.role === "owner" ||
            u.role === "manager")
      );
      if (others.length === 0) {
        return setError(
          "لا يمكن نزع «إدارة المستخدمين» من آخر من يملكها — ستُغلق شاشة المستخدمين على الجميع. امنح الصلاحية لمستخدم آخر أولاً."
        );
      }
    }

    // الرقم مطلوب للجديد، واختياري عند التعديل
    if (!editingId || form.pin) {
      if (form.pin.length < 4) return setError("رقم الدخول أربعة أرقام فأكثر");
      if (form.pin !== form.pin2) return setError("الرقمان غير متطابقين");
    }

    const pinHash = form.pin
      ? await hashPin(form.pin)
      : users.find((u) => u.id === editingId)?.pinHash ?? "";

    if (editingId) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingId
            ? {
                ...u,
                name,
                jobTitle: form.jobTitle.trim(),
                role: form.role,
                permissions,
                pinHash,
                // رقم كتبه المدير يعرفه المدير، فيُجبَر صاحبه على تغييره
                mustChangePin: form.pin ? true : u.mustChangePin,
              }
            : u
        )
      );
      setMessage(
        form.pin
          ? `تم تعديل ${name} — سيُطلب منه وضع رقم جديد عند أول دخول`
          : `تم تعديل ${name}`
      );
    } else {
      setUsers((prev) => [
        ...prev,
        {
          id: newId(),
          name,
          jobTitle: form.jobTitle.trim(),
          role: form.role,
          permissions,
          pinHash,
          mustChangePin: true,
          active: true,
          createdAt: new Date().toISOString(),
          lastSeenAt: "",
        },
      ]);
      setMessage(`تم تسجيل ${name} — سيضع رقمه الخاص عند أول دخول`);
    }

    setShowForm(false);
    setEditingId(null);
    setError("");
  };

  const admins = users.filter(
    (u) => u.active && u.permissions.includes("users.manage")
  );

  return (
    <>
      <Panel
        title="المستخدمون والصلاحيات"
        subtitle={`${users.filter((u) => u.active).length} مستخدماً نشطاً`}
      >
        <Banner tone="warn">
          الصلاحيات هنا تنظّم الواجهة ولا تحمي البيانات: التحقق يجري داخل
          المتصفح، ومن يفتح أدوات المطوّر يستطيع تجاوزه. تصبح حماية حقيقية عند
          نقل النظام إلى خادم.
        </Banner>

        {users.length === 0 && (
          <Banner tone="warn">
            لا يوجد مستخدمون بعد، والنظام يعمل بكامل الصلاحيات بلا تسجيل دخول.
            <b> أول مستخدم تسجّله يفعّل شاشة الدخول</b> — فاجعله صاحب الشركة
            واحفظ رقمه، وإلا أُغلق عليك النظام.
          </Banner>
        )}

        <button
          onClick={showForm ? () => setShowForm(false) : openNew}
          className="mb-5 rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
        >
          {showForm ? "إخفاء النموذج" : "تسجيل مستخدم جديد"}
        </button>

        {showForm && (
          <div className="mb-6 rounded-xl border border-slate-200 p-5">
            <h4 className="mb-4 font-bold">
              {editingId ? "تعديل مستخدم" : "مستخدم جديد"}
            </h4>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="الاسم">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="الوظيفة">
                <input
                  type="text"
                  value={form.jobTitle}
                  onChange={(e) => set("jobTitle", e.target.value)}
                  placeholder="مثال: مدير عام مالي وإداري"
                  className={inputClass}
                />
              </Field>

              <Field
                label="رقم الدخول"
                hint={editingId ? "اتركه فارغاً للإبقاء على الرقم الحالي" : "أربعة أرقام فأكثر"}
              >
                <input
                  type="password"
                  inputMode="numeric"
                  value={form.pin}
                  onChange={(e) => set("pin", e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field label="تأكيد رقم الدخول">
                <input
                  type="password"
                  inputMode="numeric"
                  value={form.pin2}
                  onChange={(e) => set("pin2", e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-sm font-medium">الدور</p>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((role) => (
                  <button
                    key={role.key}
                    onClick={() => pickRole(role.key)}
                    title={role.description}
                    className={`rounded-lg px-4 py-2 text-sm font-bold ${
                      form.role === role.key
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 hover:bg-slate-200"
                    }`}
                  >
                    {role.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {roleDefinition(form.role).description}
              </p>
              {(form.role === "owner" || form.role === "manager") && (
                <>
                  <p className="mt-1 text-xs font-medium text-green-700">
                    هذان الدوران يُمنحان أي صلاحية تُضاف إلى النظام مستقبلاً
                    تلقائياً.
                  </p>
                  <p className="mt-1 text-xs font-medium text-amber-800">
                    ولذلك <b>لا يُنقص منهما شيء</b>: أي مربّع تُلغيه هنا يعود
                    عند إعادة تحميل الصفحة. لتقليل صلاحيات هذا المستخدم، اختر
                    له «صلاحيات مخصّصة» أولاً.
                  </p>
                </>
              )}
            </div>

            <div className="mt-5">
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <p className="text-sm font-medium">
                  الصلاحيات ({permissions.length} من {ALL_PERMISSIONS.length})
                </p>
                <button
                  onClick={() => {
                    setPermissions(ALL_PERMISSIONS);
                    setForm((f) => ({ ...f, role: "custom" }));
                  }}
                  className="rounded bg-slate-100 px-3 py-1 text-xs"
                >
                  تحديد الكل
                </button>
                <button
                  onClick={() => {
                    setPermissions([]);
                    setForm((f) => ({ ...f, role: "custom" }));
                  }}
                  className="rounded bg-slate-100 px-3 py-1 text-xs"
                >
                  إلغاء الكل
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {PERMISSION_CATALOGUE.map((group) => (
                  <div
                    key={group.group}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <p className="mb-2 font-bold">{group.group}</p>
                    <div className="space-y-2">
                      {group.items.map((item) => (
                        <label
                          key={item.key}
                          className="flex items-start gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={permissions.includes(item.key)}
                            onChange={() => toggle(item.key)}
                            className="mt-1"
                          />
                          <span>
                            {item.label}
                            {item.note && (
                              <span className="mr-1 text-xs font-bold text-red-600">
                                ({item.note})
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <p className="mt-4 text-sm font-medium text-red-600">{error}</p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={save}
                className="rounded-lg bg-slate-900 px-6 py-3 font-bold text-white"
              >
                {editingId ? "حفظ التعديل" : "تسجيل المستخدم"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg bg-slate-200 px-6 py-3 font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {message && (
          <p className="mb-4 text-sm font-medium text-green-700">{message}</p>
        )}

        {users.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Th>الاسم</Th>
                  <Th>الوظيفة</Th>
                  <Th>الدور</Th>
                  <Th>الصلاحيات</Th>
                  <Th>الحالة</Th>
                  <Th>الإجراء</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isLastAdmin =
                    admins.length === 1 && admins[0].id === user.id;
                  return (
                    <tr key={user.id} className="border-b border-slate-200">
                      <Td>
                        <span className="font-bold">{user.name}</span>
                        {user.id === currentUserId && (
                          <span className="mr-2 rounded bg-green-100 px-2 py-1 text-xs text-green-800">
                            أنت
                          </span>
                        )}
                      </Td>
                      <Td>{user.jobTitle || "—"}</Td>
                      <Td>{roleDefinition(user.role).label}</Td>
                      <Td>
                        {user.permissions.length === ALL_PERMISSIONS.length
                          ? "كل الصلاحيات"
                          : `${user.permissions.length} صلاحية`}
                      </Td>
                      <Td>
                        {user.active ? (
                          <span className="text-green-700">نشط</span>
                        ) : (
                          <span className="text-slate-400">موقوف</span>
                        )}
                        {user.mustChangePin && (
                          <span className="mr-2 rounded bg-amber-100 px-2 py-1 text-xs text-amber-900">
                            لم يضع رقمه بعد
                          </span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(user)}
                            className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700"
                          >
                            تعديل
                          </button>
                          <button
                            onClick={() => {
                              if (isLastAdmin && user.active) {
                                setError(
                                  "لا يمكن إيقاف آخر مستخدم يملك إدارة المستخدمين — سيُغلق النظام على الجميع"
                                );
                                return;
                              }
                              setUsers((prev) =>
                                prev.map((u) =>
                                  u.id === user.id
                                    ? { ...u, active: !u.active }
                                    : u
                                )
                              );
                              setError("");
                            }}
                            className="rounded-lg bg-slate-100 px-3 py-2"
                          >
                            {user.active ? "إيقاف" : "تفعيل"}
                          </button>
                          <button
                            onClick={() => {
                              if (isLastAdmin) {
                                setError(
                                  "لا يمكن حذف آخر مستخدم يملك إدارة المستخدمين"
                                );
                                return;
                              }
                              if (window.confirm(`حذف المستخدم «${user.name}»؟`)) {
                                setUsers((prev) =>
                                  prev.filter((u) => u.id !== user.id)
                                );
                                setError("");
                              }
                            }}
                            className="rounded-lg bg-red-50 px-3 py-2 text-red-700"
                          >
                            حذف
                          </button>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
/* ================================================================== */
/* اعتماد مراحل الإنجاز — شاشة المهندس المشرف                          */
/* ================================================================== */

function ApprovalsPage({
  contractors,
  projects,
  movements,
  approverName,
  canApprove,
  canConfirm,
  setContractors,
  onLog,
}: {
  contractors: Contractor[];
  projects: Project[];
  movements: Movement[];
  approverName: string;
  /** المهندس: يشهد بالإنجاز */
  canApprove: boolean;
  /** الإدارة: تُقرّ فتصير الدفعة مستحقة */
  canConfirm: boolean;
  setContractors: Dispatch<SetStateAction<Contractor[]>>;
  onLog: (
    action: AuditAction,
    entity: AuditEntity,
    summary: string,
    change?: { before?: string; after?: string }
  ) => void;
}) {
  const [projectFilter, setProjectFilter] = useState("الكل");
  const [note, setNote] = useState("");
  /*
    الخصم يُكتب مع الاعتماد لا بعده: المرحلة تُنجَز وفيها تقصيرٌ أو
    تأخير، فيشهد المهندس بالإنجاز ويحسم ما يستحقّه الحسم في آنٍ واحد،
    ثم تُقرّه الإدارة وهي تراه.
  */
  const [deduction, setDeduction] = useState("");
  const [deductionReason, setDeductionReason] = useState("");
  const [message, setMessage] = useState("");

  const visible = contractors.filter(
    (c) => projectFilter === "الكل" || c.project === projectFilter
  );

  const setApproval = (
    contractId: string,
    installmentNumber: number,
    approved: boolean
  ) => {
    setContractors((prev) =>
      prev.map((contract) =>
        contract.id !== contractId
          ? contract
          : {
              ...contract,
              installments: contract.installments.map((installment) =>
                installment.number !== installmentNumber
                  ? installment
                  : {
                      ...installment,
                      approved,
                      approvedBy: approved ? approverName : "",
                      approvedAt: approved ? new Date().toISOString() : "",
                      approvalNote: approved ? note.trim() : "",
                      /* الخصم من الاعتماد، فسحبه يسحبه */
                      deduction:
                        approved && round3(Number(deduction) || 0) > 0
                          ? String(round3(Number(deduction) || 0))
                          : undefined,
                      deductionReason:
                        approved && round3(Number(deduction) || 0) > 0
                          ? deductionReason.trim()
                          : undefined,
                      // سحب اعتماد المهندس يُسقط إقرار الإدارة المبني عليه
                      ...(approved
                        ? null
                        : {
                            confirmed: false,
                            confirmedBy: "",
                            confirmedAt: "",
                            confirmNote: "",
                          }),
                    }
              ),
            }
      )
    );
    const contract = contractors.find((c) => c.id === contractId);
    const installment = contract?.installments.find(
      (i) => i.number === installmentNumber
    );
    onLog(
      approved ? "اعتماد" : "إلغاء اعتماد",
      "دفعة",
      `عقد ${contract?.contractNumber ?? "?"} · الدفعة ${installmentNumber} · ${fmt(
        Number(installment?.value) || 0
      )} د.ك · ${contract?.project ?? ""}`,
      {
        after:
          approved && round3(Number(deduction) || 0) > 0
            ? `خصم ${fmt(round3(Number(deduction) || 0))} د.ك — ${
                deductionReason.trim() || "بلا سبب مكتوب"
              }${note.trim() ? ` · ${note.trim()}` : ""}`
            : approved && note.trim()
              ? note.trim()
              : undefined,
      }
    );

    setNote("");
    setDeduction("");
    setDeductionReason("");
    setMessage(
      approved
        ? `اعتُمد إنجاز الدفعة ${installmentNumber} — تنتظر إقرار الإدارة`
        : `أُلغي اعتماد الدفعة ${installmentNumber}`
    );
  };

  /** الخطوة الثانية: إقرار الإدارة، وبها تصير الدفعة مستحقة */
  const setConfirmation = (
    contractId: string,
    installmentNumber: number,
    confirmed: boolean
  ) => {
    setContractors((prev) =>
      prev.map((contract) =>
        contract.id !== contractId
          ? contract
          : {
              ...contract,
              installments: contract.installments.map((installment) =>
                installment.number !== installmentNumber
                  ? installment
                  : {
                      ...installment,
                      confirmed,
                      confirmedBy: confirmed ? approverName : "",
                      confirmedAt: confirmed ? new Date().toISOString() : "",
                      confirmNote: confirmed ? note.trim() : "",
                    }
              ),
            }
      )
    );
    const contract = contractors.find((c) => c.id === contractId);
    onLog(
      confirmed ? "اعتماد" : "إلغاء اعتماد",
      "دفعة",
      `إقرار الإدارة — عقد ${contract?.contractNumber ?? "?"} · الدفعة ${installmentNumber}`,
      { after: confirmed && note.trim() ? note.trim() : undefined }
    );
    setNote("");
    setMessage(
      confirmed
        ? `أُقرّت الدفعة ${installmentNumber} — أصبحت مستحقة للصرف`
        : `أُلغي إقرار الدفعة ${installmentNumber}`
    );
  };

  return (
    <>
      <Panel
        title="اعتماد مراحل الإنجاز"
        subtitle="اعتماد المرحلة المنجزة يجعل دفعتها مستحقة للصرف — الصرف نفسه من اختصاص المحاسب"
      >
        <Banner tone="ok">
          الاستحقاق على خطوتين: <b>يعتمد المهندس</b> الإنجاز شهادةً فنية، ثم
          <b> تُقرّه الإدارة</b> — وبالإقرار وحده تصير الدفعة مستحقة للصرف.
          وسحب اعتماد المهندس يُسقط الإقرار المبني عليه.
        </Banner>

        {!canApprove && !canConfirm && (
          <Banner tone="warn">
            لديك صلاحية الاطلاع فقط — الاعتماد يحتاج «اعتماد إنجاز المراحل»،
            والإقرار يحتاج «إقرار المرحلة بعد اعتماد المهندس».
          </Banner>
        )}

        <div className="max-w-sm">
          <Field label="تصفية بالمشروع">
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className={inputClass}
            >
              <option value="الكل">جميع المشاريع</option>
              {[...new Set(contractors.map((c) => c.project))].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
        </div>

        {message && (
          <p className="mt-4 text-sm font-medium text-green-700">{message}</p>
        )}

        {projects.length === 0 && contractors.length === 0 && (
          <Empty>لا توجد عقود</Empty>
        )}
      </Panel>

      {visible.length === 0 ? (
        <Panel>
          <Empty>لا توجد عقود في هذا المشروع</Empty>
        </Panel>
      ) : (
        visible.map((contract) => {
          const payments = contractPayments(movements, contract.contractNumber);

          const approvedValue = round3(
            contract.installments
              .filter((i) => isPayableInstallment(i) && i.approved)
              .reduce((sum, i) => sum + (Number(i.value) || 0), 0)
          );
          const progress =
            contract.contractValue > 0
              ? (approvedValue / contract.contractValue) * 100
              : 0;

          return (
            <Panel
              key={contract.id}
              title={`${contract.project} — عقد ${contract.contractNumber}`}
              subtitle={`${contract.name} · ${contract.workType}`}
            >
              <div className="mb-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                {[
                  ["قيمة العقد", contract.contractValue],
                  ["المعتمد إنجازه", approvedValue],
                  ["المدفوع فعلاً", payments.total],
                  [
                    "معتمد وغير مدفوع",
                    round3(approvedValue - payments.total),
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-slate-200 p-3"
                  >
                    <p className="text-slate-500">{label}</p>
                    <p className="mt-1 font-bold">
                      <Money value={value as number} /> د.ك
                    </p>
                  </div>
                ))}
              </div>

              <div className="mb-5">
                <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full bg-green-600"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  نسبة الإنجاز المعتمد: {progress.toFixed(1)}%
                </p>
              </div>

              {canApprove && (
                <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field
                    label="ملاحظة الاعتماد"
                    hint="تُحفظ مع الدفعة التي تعتمدها بعد كتابتها"
                  >
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="مثال: عُوين الموقع وتم صب السقف بالكامل"
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    label="خصم على الدفعة (د.ك)"
                    hint="تقصيرٌ أو تأخير — يُنقص المستحق ولا يمسّ قيمة العقد"
                  >
                    <input
                      type="number"
                      step="0.001"
                      value={deduction}
                      onChange={(e) => setDeduction(e.target.value)}
                      placeholder="0.000"
                      className={inputClass}
                    />
                  </Field>
                  <Field
                    label="سبب الخصم"
                    hint="يُعرض للإدارة قبل الإقرار"
                  >
                    <input
                      type="text"
                      value={deductionReason}
                      onChange={(e) => setDeductionReason(e.target.value)}
                      placeholder="مثال: تأخير عشرة أيام عن الموعد"
                      className={inputClass}
                    />
                  </Field>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <Th>#</Th>
                      <Th>المرحلة والاستحقاق</Th>
                      <Th>القيمة</Th>
                      <Th>الخصم</Th>
                      <Th>المستحق</Th>
                      <Th>اعتماد المهندس</Th>
                      <Th>إقرار الإدارة</Th>
                      <Th>حالة الصرف</Th>
                      <Th>الإجراء</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {contract.installments
                      .filter(isPayableInstallment)
                      .map((installment) => {
                      const value = round3(Number(installment.value) || 0);
                      const cut = installmentDeduction(installment);
                      const net = installmentNet(installment);
                      const paid =
                        payments.byInstallment.get(installment.number) ?? 0;

                      const settlement = !installment.approved
                        ? { text: "لم يعتمدها المهندس", cls: "text-slate-400" }
                        : !installment.confirmed
                        ? {
                            text: "تنتظر إقرار الإدارة",
                            cls: "font-bold text-blue-700",
                          }
                        : isZero(paid)
                        ? { text: "مستحقة وغير مدفوعة", cls: "font-bold text-amber-700" }
                        : paid + 0.0005 < net
                        ? { text: `مدفوع منها ${fmt(paid)}`, cls: "text-blue-700" }
                        : { text: "مدفوعة بالكامل", cls: "font-bold text-green-700" };

                      return (
                        <tr
                          key={installment.number}
                          className="border-b border-slate-100 align-top"
                        >
                          <Td>{installment.number}</Td>
                          <Td>
                            <div>{installment.condition || "—"}</div>
                            {installment.approvalNote && (
                              <div className="mt-1 text-xs text-slate-500">
                                ملاحظة: {installment.approvalNote}
                              </div>
                            )}
                          </Td>
                          <Td>
                            <Money value={value} />
                          </Td>
                          <Td>
                            {cut > 0 ? (
                              <div>
                                <span className="font-bold text-red-700">
                                  − <Money value={cut} />
                                </span>
                                <div className="text-xs text-slate-500">
                                  {installment.deductionReason || "بلا سبب مكتوب"}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </Td>
                          <Td>
                            <span className={cut > 0 ? "font-bold" : ""}>
                              <Money value={net} />
                            </span>
                          </Td>
                          <Td>
                            {installment.approved ? (
                              <div>
                                <span className="font-bold text-green-700">
                                  ✓ معتمدة
                                </span>
                                {installment.approvedBy && (
                                  <div className="text-xs text-slate-500">
                                    {installment.approvedBy}
                                    {installment.approvedAt &&
                                      ` · ${installment.approvedAt.slice(0, 10)}`}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">غير معتمدة</span>
                            )}
                          </Td>
                          <Td>
                            {installment.confirmed ? (
                              <div>
                                <span className="font-bold text-green-700">
                                  ✓ مُقرّة
                                </span>
                                {installment.confirmedBy && (
                                  <div className="text-xs text-slate-500">
                                    {installment.confirmedBy}
                                    {installment.confirmedAt &&
                                      ` · ${installment.confirmedAt.slice(0, 10)}`}
                                  </div>
                                )}
                                {installment.confirmNote && (
                                  <div className="text-xs text-slate-500">
                                    {installment.confirmNote}
                                  </div>
                                )}
                              </div>
                            ) : installment.approved ? (
                              <span className="font-bold text-blue-700">
                                بانتظار الإدارة
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </Td>
                          <Td className={settlement.cls}>{settlement.text}</Td>
                          <Td>
                            {canApprove &&
                              (installment.approved ? (
                                <button
                                  onClick={() => {
                                    if (!isZero(paid)) {
                                      window.alert(
                                        "لا يمكن إلغاء اعتماد دفعة صُرف منها مبلغ. راجع المحاسب أولاً."
                                      );
                                      return;
                                    }
                                    setApproval(
                                      contract.id,
                                      installment.number,
                                      false
                                    );
                                  }}
                                  className="rounded-lg bg-slate-100 px-3 py-2"
                                >
                                  إلغاء الاعتماد
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    setApproval(
                                      contract.id,
                                      installment.number,
                                      true
                                    )
                                  }
                                  className="rounded-lg bg-green-600 px-4 py-2 font-bold text-white"
                                >
                                  اعتماد الإنجاز
                                </button>
                              ))}

                            {/* الخطوة الثانية: لا تُعرض إلا بعد شهادة المهندس */}
                            {canConfirm && installment.approved && (
                              <div className="mt-2">
                                {installment.confirmed ? (
                                  <button
                                    onClick={() => {
                                      if (!isZero(paid)) {
                                        window.alert(
                                          "لا يمكن إلغاء إقرار دفعة صُرف منها مبلغ. راجع المحاسب أولاً."
                                        );
                                        return;
                                      }
                                      setConfirmation(
                                        contract.id,
                                        installment.number,
                                        false
                                      );
                                    }}
                                    className="rounded-lg bg-slate-100 px-3 py-2"
                                  >
                                    إلغاء الإقرار
                                  </button>
                                ) : (
                                  <button
                                    onClick={() =>
                                      setConfirmation(
                                        contract.id,
                                        installment.number,
                                        true
                                      )
                                    }
                                    className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white"
                                  >
                                    إقرار الإدارة
                                  </button>
                                )}
                              </div>
                            )}
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          );
        })
      )}
    </>
  );
}
/* ================================================================== */
/* سجل التدقيق                                                         */
/* ================================================================== */

const AUDIT_TONE: Record<string, string> = {
  إنشاء: "bg-green-100 text-green-800",
  تعديل: "bg-blue-100 text-blue-800",
  حذف: "bg-red-100 text-red-800",
  اعتماد: "bg-emerald-100 text-emerald-800",
  "إلغاء اعتماد": "bg-amber-100 text-amber-900",
  ترحيل: "bg-purple-100 text-purple-800",
  استيراد: "bg-orange-100 text-orange-900",
  دخول: "bg-slate-100 text-slate-600",
  خروج: "bg-slate-100 text-slate-600",
};

/* ================================================================== */
/* مطابقة الخادم                                                       */
/* ================================================================== */

/**
 * شاشة المرحلة الرابعة.
 *
 * النظام يحفظ في الجهاز كما كان، ثم يرسل إلى الخادم ما تغيّر وحده.
 * وهذه الشاشة تُريك الفرق بين النسختين حقلاً حقلاً — فلا يُنتقل إلى
 * الخادم بالثقة بل بالبرهان: ما دام في الجدول سطرٌ أحمر فالجهاز هو
 * المرجع ولا يُنقل شيء.
 */
/**
 * دخول الخادم — وهو غير دخول النظام.
 *
 * دخولك إلى الشاشات يفتح ما في جهازك. وهذا يأذن بالقراءة من قاعدة
 * الشركة والكتابة فيها، ولا تعمل المزامنة بغيره. وسيصيران واحداً حين
 * تُبدَّل المصادر، فيُحذف هذا المكوّن حينها.
 */
function ServerSignIn({
  user,
  onChange,
}: {
  user: ServerUser | null;
  onChange: (user: ServerUser | null) => void;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const enter = async () => {
    setBusy(true);
    setProblem("");
    const outcome = await serverSignIn(name.trim(), password);
    setBusy(false);
    if (!outcome.ok) {
      setProblem(outcome.error);
      return;
    }
    /* كلمة المرور لا تبقى في الذاكرة بعد استعمالها */
    setCurrent(password);
    setPassword("");
    onChange(outcome.user);
  };

  const setNewPassword = async () => {
    if (next !== again) {
      setProblem("الكلمتان غير متطابقتين");
      return;
    }
    setBusy(true);
    setProblem("");
    const outcome = await changePassword(current, next);
    setBusy(false);
    if (!outcome.ok) {
      setProblem(outcome.error ?? "تعذّر التغيير");
      return;
    }
    setCurrent("");
    setNext("");
    setAgain("");
    onChange(await whoAmI());
  };

  const leave = async () => {
    await serverSignOut();
    onChange(null);
  };

  /* ---- لم يدخل بعد ---- */
  if (!user) {
    return (
      <Panel
        title="دخول الخادم"
        subtitle="غير دخولك إلى الشاشات — هذا يأذن بالقراءة من قاعدة الشركة والكتابة فيها"
      >
        {problem ? <Banner tone="error">{problem}</Banner> : null}

        <div className="grid max-w-xl grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="الاسم كما هو مسجَّل">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              autoComplete="username"
            />
          </Field>
          <Field label="كلمة المرور">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void enter();
              }}
              className={inputClass}
              autoComplete="current-password"
            />
          </Field>
        </div>

        <button
          type="button"
          onClick={enter}
          disabled={busy || !name.trim() || !password}
          className="mt-4 rounded-lg bg-slate-900 px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? "يتحقّق…" : "دخول"}
        </button>

        <p className="mt-3 text-sm text-slate-500">
          في أول مرة: ادخل برقمك السرّي القديم نفسه، ثم يُطلب منك وضع كلمة
          مرورٍ حقيقية.
        </p>
      </Panel>
    );
  }

  /* ---- دخل، ولمّا يضع كلمةً حقيقية ---- */
  if (user.mustChangePassword) {
    return (
      <Panel
        title="ضع كلمة مرورٍ حقيقية"
        subtitle={`أهلاً ${user.name} — ولن تمضي حتى تضعها`}
      >
        <Banner tone="warn">
          أربعة أرقام تكفي على جهازٍ في المكتب، ولا تكفي على الإنترنت: عشرة
          آلاف احتمالٍ تُجرَّب في ثوانٍ. ثمانية محارف فأكثر، وليست أرقاماً
          كلها.
        </Banner>

        {problem ? <Banner tone="error">{problem}</Banner> : null}

        <div className="grid max-w-xl grid-cols-1 gap-3">
          {current ? null : (
            <Field label="كلمة المرور الحالية">
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className={inputClass}
                autoComplete="current-password"
              />
            </Field>
          )}
          <Field label="كلمة المرور الجديدة">
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={inputClass}
              autoComplete="new-password"
            />
          </Field>
          <Field label="أعِدها">
            <input
              type="password"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void setNewPassword();
              }}
              className={inputClass}
              autoComplete="new-password"
            />
          </Field>
        </div>

        <button
          type="button"
          onClick={setNewPassword}
          disabled={busy || !current || next.length < 8}
          className="mt-4 rounded-lg bg-slate-900 px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ? "يحفظ…" : "احفظ كلمة المرور"}
        </button>
      </Panel>
    );
  }

  /* ---- داخل وجاهز ---- */
  return (
    <Panel title="دخول الخادم">
      <Banner tone="ok">
        داخلٌ في الخادم باسم <b>{user.name}</b>
        {user.jobTitle ? ` — ${user.jobTitle}` : ""}
      </Banner>
      <button
        type="button"
        onClick={leave}
        className="rounded-lg bg-slate-200 px-5 py-2 font-medium"
      >
        خروج من الخادم
      </button>
    </Panel>
  );
}
function ServerMatchPage({
  local,
  onAdoptAudit,
}: {
  local: AppState;
  /** يضمّ قيود تدقيقٍ من الخادم ليست في الجهاز */
  onAdoptAudit: (entries: AuditEntry[]) => void;
}) {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [fields, setFields] = useState<FieldComparison[] | null>(null);
  const [comparing, setComparing] = useState(false);
  const [problem, setProblem] = useState("");
  const [comparedAt, setComparedAt] = useState("");
  /* السجلّ يُقرأ مرةً عند بناء الحالة — والشاشة لا تُعرض إلا بعد اختيارها */
  const [runs, setRuns] = useState<MatchRun[]>(matchRuns);
  const [account, setAccount] = useState<ServerUser | null>(null);
  /* تُقرأ الجلسة مرةً عند فتح الشاشة — الكعكة عند المتصفّح لا عندنا */
  useEffect(() => {
    void whoAmI().then(setAccount);
  }, []);

  useEffect(() => subscribeSync(setStatus), []);

  const compare = async () => {
    setComparing(true);
    setProblem("");
    setNote("");
    try {
      const server = await fetchServerState();
      const report = compareStates(local, server);
      const at = new Date().toISOString();
      setFields(report.fields);
      setComparedAt(at);
      /*
        تُسجَّل النتيجة قبل أن تُعرض. فالعدّ هو الحجّة يوم النقل، ولا
        يصحّ أن يضيع بإغلاق الصفحة أو بمقارنةٍ تالية تمحو ما قبلها.
      */
      setRuns(
        recordMatch({
          at,
          agree: report.agree,
          off: report.fields.filter((f) => !f.agree).map((f) => f.field),
          rows: report.fields.reduce(
            (n, f) => n + f.missing.length + f.extra.length + f.different.length,
            0
          ),
        })
      );
    } catch (error) {
      setFields(null);
      setProblem(error instanceof Error ? error.message : "تعذّرت المقارنة");
    } finally {
      setComparing(false);
    }
  };

  /*
    استرداد قيود التدقيق.

    سجلّ التدقيق لا يُحذف منه شيء على الخادم، فقيدٌ عنده وليس في الجهاز
    لا يزول بمحوه هناك — بل بأن يستردّه الجهاز. والضمّ يُضيف ولا يكتب
    فوق شيء، فهو آمن دائماً. ولولاه لبقي السطر أحمر ولما بدأ العدّ.
  */
  const [adopting, setAdopting] = useState(false);
  const [note, setNote] = useState("");
  const auditExtra = fields?.find((f) => f.field === "audit")?.extra.length ?? 0;

  const adoptAudit = async () => {
    setAdopting(true);
    setProblem("");
    try {
      const server = await fetchServerState();
      const have = new Set(local.audit.map((e) => e.id));
      const missing = server.audit.filter((e) => !have.has(e.id));
      onAdoptAudit(missing);
      /*
        لا تُعاد المقارنة من هنا: الدالّة تحمل بيانات الجهاز كما كانت قبل
        الضمّ، فتُظهر الفرق نفسه وتوهم أن الاسترداد لم ينفع. فيُخفى التقرير
        القديم ويُطلب إعادة المقارنة — فتُقرأ البيانات بعد الضمّ.
      */
      setFields(null);
      setNote(`استُردّ ${missing.length} من قيود التدقيق — اضغط «قارن الآن»`);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "تعذّر الاسترداد");
    } finally {
      setAdopting(false);
    }
  };

  /*
    الزائد على الخادم: صفوفٌ حُذفت من الجهاز ولم يبلغه حذفها — يقع حين
    يُغلق المتصفّح قبل أن تُرسل. وسجلّ التدقيق ليس منها: لا يُحذف منه
    شيء، بل يُستردّ.
  */
  const staleOnServer = (fields ?? []).filter(
    (f) => f.field !== "audit" && f.extra.length > 0
  );
  const staleCount = staleOnServer.reduce((n, f) => n + f.extra.length, 0);
  const [purging, setPurging] = useState(false);

  const purgeStale = async () => {
    const where = staleOnServer
      .map((f) => `${FIELD_LABELS[f.field] ?? f.field}: ${f.extra.length}`)
      .join(" · ");
    if (
      !window.confirm(
        `حذف ${staleCount} صفاً من الخادم؟\n\n${where}\n\nهي صفوفٌ حذفتها من جهازك ولم يبلغ الخادم حذفها. ولا يُحذف من الخادم غيرها، ولا يُمسّ جهازك.`
      )
    ) {
      return;
    }
    setPurging(true);
    setProblem("");
    try {
      const deletes: Record<string, string[]> = {};
      for (const f of staleOnServer) deletes[f.field] = f.extra;
      const done = await pushDeletions(deletes);
      setFields(null);
      setNote(`حُذف ${done} صفاً من الخادم — اضغط «قارن الآن»`);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "تعذّر الحذف");
    } finally {
      setPurging(false);
    }
  };

  const judgement = verdict(runs);
  const today = todayISO();
  const doneToday = comparedToday(today, runs);

  const on = status?.enabled ?? false;
  const agree = fields ? fields.every((f) => f.agree) : null;

  const tone =
    status?.phase === "متزامنة"
      ? "ok"
      : status?.phase === "منقطعة"
        ? "error"
        : "warn";

  /*
    لا تُعرض المزامنة قبل الدخول: زرٌّ يُشعل شيئاً لا يستطيع أن يعمل
    يُتعب صاحبه ويُوهمه أن في النظام عطلاً.
  */
  if (!account || account.mustChangePassword) {
    return <ServerSignIn user={account} onChange={setAccount} />;
  }

  return (
    <>
      <ServerSignIn user={account} onChange={setAccount} />

      <Panel
        title="مطابقة الخادم"
        subtitle="الجهاز هو المرجع، والخادم يُكتب إليه ما تغيّر وحده — والمقارنة هي التي تقرّر متى يصير الخادم هو المرجع"
      >
        <Banner tone={on ? tone : "warn"}>
          {on ? (
            <>
              المزامنة مشتغلة · الحال: {status?.phase}
              {status?.pending ? ` · ${status.pending} صفّاً لم يصل بعد` : ""}
              {status?.lastSyncAt
                ? ` · آخر إرسال ${new Date(status.lastSyncAt).toLocaleTimeString("ar-KW")}`
                : ""}
              {status?.lastError ? ` · ${status.lastError}` : ""}
              {/*
                رقمٌ غيّره الخادم يُقال لصاحبه: قد يكون طبع سنداً بالرقم
                القديم أو كتبه في ورقة، فلا يُترك ليكتشفه بعد أسبوع.
              */}
              {status?.renumbered?.length ? (
                <div className="mt-2 font-bold">
                  تصادم رقم قيد — غيّره الخادم:{" "}
                  {status.renumbered
                    .map((r) => `${r.from} ← ${r.to}`)
                    .join("، ")}
                  . والسبب أن الرقم كان مأخوذاً، فأُعطيت الحركة التالي الحرّ.
                </div>
              ) : null}
            </>
          ) : (
            <>
              المزامنة مطفأة. النظام يعمل من جهازك وحده كما كان، ولا يُرسل
              شيء. وإشعالها لا يغيّر مصدر البيانات: يبقى الجهاز هو المرجع.
            </>
          )}
        </Banner>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setSyncEnabled(!on)}
            className={`rounded-lg px-6 py-3 font-bold text-white ${
              on ? "bg-slate-500" : "bg-slate-900"
            }`}
          >
            {on ? "إطفاء المزامنة" : "إشعال المزامنة"}
          </button>

          <button
            type="button"
            onClick={compare}
            disabled={comparing}
            className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {comparing ? "يقارن…" : "قارن الآن"}
          </button>

          {status?.rev ? (
            <span className="text-sm text-slate-500">
              رقم التغيير عند الخادم: {status.rev}
            </span>
          ) : null}
        </div>

        {problem ? (
          <div className="mt-4">
            <Banner tone="error">{problem}</Banner>
          </div>
        ) : null}

        {note ? (
          <div className="mt-4">
            <Banner tone="ok">{note}</Banner>
          </div>
        ) : null}
      </Panel>

      <Panel
        title="سجلّ المطابقة"
        subtitle={`لا يُنتقل إلى الخادم حتى تتطابق النسختان ${REQUIRED_STREAK} أيام متتالية`}
      >
        <Banner tone={judgement.ready ? "ok" : runs.length === 0 ? "warn" : "warn"}>
          {judgement.text}
          {!doneToday && on ? " · لم تُقارن اليوم بعد" : ""}
        </Banner>

        {/* شريط الأيام: يومٌ لكل مربّع، آخرها اليوم */}
        {runs.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1">
            {runs.slice(-30).map((r) => (
              <span
                key={r.day}
                title={`${r.day} — ${r.agree ? "متطابقتان" : r.off.join("، ")}`}
                className={`h-7 w-7 rounded text-center text-xs leading-7 ${
                  r.agree ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}
              >
                {r.day.slice(8)}
              </span>
            ))}
          </div>
        )}

        {runs.length === 0 ? (
          <Empty>
            لا مقارنات بعد — اضغط «قارن الآن» مرةً كل يوم عمل
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Th>اليوم</Th>
                  <Th>الساعة</Th>
                  <Th>النتيجة</Th>
                  <Th>الصفوف المختلفة</Th>
                  <Th>أين</Th>
                </tr>
              </thead>
              <tbody>
                {[...runs].reverse().map((r) => (
                  <tr key={r.day} className="border-t border-slate-100">
                    <Td className="font-medium">{r.day}</Td>
                    <Td className="text-slate-500">
                      {new Date(r.at).toLocaleTimeString("ar-KW")}
                    </Td>
                    <Td className={r.agree ? "text-green-700" : "font-bold text-red-700"}>
                      {r.agree ? "متطابقتان" : "مختلفتان"}
                    </Td>
                    <Td className="tabular-nums">{r.rows || ""}</Td>
                    <Td className="text-slate-600">
                      {r.off.map((f) => FIELD_LABELS[f] ?? f).join("، ") || "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {fields ? (
        <Panel
          title="تقرير المقارنة"
          subtitle={`قُورن في ${new Date(comparedAt).toLocaleString("ar-KW")}`}
        >
          {staleCount > 0 ? (
            <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="mb-2 font-bold text-amber-900">
                في الخادم {staleCount} صفاً حذفتَه من جهازك
              </p>
              <p className="mb-3 text-sm text-amber-900">
                {staleOnServer
                  .map((f) => `${FIELD_LABELS[f.field] ?? f.field}: ${f.extra.length}`)
                  .join(" · ")}
                . حُذفت من الجهاز ولم يبلغ الخادمَ حذفُها — يقع ذلك إن أُغلق
                المتصفّح قبل أن تُرسل. والجهاز هو المرجع، فتُحذف من الخادم.
              </p>
              <button
                type="button"
                onClick={purgeStale}
                disabled={purging}
                className="rounded-lg bg-amber-700 px-5 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {purging ? "يحذف…" : `احذفها من الخادم (${staleCount})`}
              </button>
            </div>
          ) : null}

          {auditExtra > 0 ? (
            <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="mb-2 font-bold text-amber-900">
                في الخادم {auditExtra} من قيود التدقيق ليست في جهازك
              </p>
              <p className="mb-3 text-sm text-amber-900">
                وقعت في جلسةٍ سابقة ثم استُبدل سجلّ جهازك باستيرادٍ كامل. والخادم
                لا يُحذف منه قيد تدقيق، فالصواب أن يستردّها جهازك — وهو يُضيف ولا
                يكتب فوق شيء.
              </p>
              <button
                type="button"
                onClick={adoptAudit}
                disabled={adopting}
                className="rounded-lg bg-amber-700 px-5 py-2 font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {adopting ? "يسترد…" : `استرداد ${auditExtra} من الخادم`}
              </button>
            </div>
          ) : null}

          <Banner tone={agree ? "ok" : "error"}>
            {agree
              ? "النسختان متطابقتان في الحقول كلها — لا فرق في صفّ واحد."
              : "بين النسختين فرق. لا يُنقل شيء إلى الخادم حتى يزول، والجهاز هو المرجع."}
          </Banner>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Th>الحقل</Th>
                  <Th>في جهازك</Th>
                  <Th>في الخادم</Th>
                  <Th>ناقص</Th>
                  <Th>زائد</Th>
                  <Th>مختلف</Th>
                  <Th>الحال</Th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f) => (
                  <tr
                    key={f.field}
                    className={`border-t border-slate-100 ${
                      f.agree ? "" : "bg-red-50"
                    }`}
                  >
                    <Td className="font-medium">{FIELD_LABELS[f.field] ?? f.field}</Td>
                    <Td className="tabular-nums">{f.local}</Td>
                    <Td className="tabular-nums">{f.server}</Td>
                    <Td className="tabular-nums">{f.missing.length || ""}</Td>
                    <Td className="tabular-nums">{f.extra.length || ""}</Td>
                    <Td className="tabular-nums">{f.different.length || ""}</Td>
                    <Td className={f.agree ? "text-green-700" : "text-red-700"}>
                      {f.agree ? "مطابق" : "مختلف"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* تفصيل ما اختلف — الحقل والقيمتان، لا معرّفاً وحده */}
          {fields
            .filter((f) => f.samples.length > 0)
            .map((f) => (
              <div
                key={f.field}
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4"
              >
                <p className="mb-3 font-bold text-red-800">
                  {FIELD_LABELS[f.field] ?? f.field} — أوّل {f.samples.length}
                  {" من "}
                  {f.different.length} صفّاً مختلفاً
                </p>
                {f.samples.map((sample) => (
                  <div key={sample.key} className="mb-4 last:mb-0">
                    <p className="text-xs text-slate-500">{sample.key}</p>
                    {sample.changes.length === 0 ? (
                      <p className="text-sm text-slate-600">
                        لا فرق ظاهر في الحقول
                      </p>
                    ) : (
                      <table className="w-full text-right text-sm">
                        <tbody>
                          {sample.changes.map((c) => (
                            <tr key={c.field} className="border-t border-red-100">
                              <Td className="font-medium">{c.field}</Td>
                              <Td>
                                <span className="text-slate-500">جهازك: </span>
                                {c.local}
                              </Td>
                              <Td>
                                <span className="text-slate-500">الخادم: </span>
                                {c.server}
                              </Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            ))}

          {agree ? null : (
            <p className="mt-4 text-sm text-slate-500">
              «ناقص» صفوفٌ في جهازك لم تصل الخادم · «زائد» صفوفٌ عنده وليست
              عندك — وقد تكون من جهازٍ آخر · «مختلف» صفٌّ في الجانبين
              ومحتواه غير واحد.
            </p>
          )}
        </Panel>
      ) : null}
    </>
  );
}

/** أسماء الحقول كما تُعرف في النظام لا كما تُسمّى في الشيفرة */
const FIELD_LABELS: Record<string, string> = {
  movements: "الحركات",
  projects: "المشاريع",
  contractors: "العقود",
  materials: "المواد",
  materialReceipts: "استلام المواد",
  users: "المستخدمون",
  employees: "الموظفون",
  attendance: "الحضور",
  payrollRuns: "مسيّرات الرواتب",
  workItems: "بنود الأعمال",
  quotations: "عروض الأسعار",
  invoices: "الفواتير",
  audit: "سجل التدقيق",
  chart: "دليل الحسابات",
  items: "البنود",
  payments: "طرق الدفع",
  people: "الأشخاص",
  company: "بيانات الشركة",
  payrollSettings: "إعدادات الرواتب",
  openingBalances: "الأرصدة الافتتاحية",
  yearLocks: "إقفال السنوات",
};
function AuditPage({
  audit,
  onExport,
}: {
  audit: AuditEntry[];
  onExport: (table: ExportTable) => void;
}) {
  const [filter, setFilter] = useState(emptyAuditFilter());
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => filterAudit(audit, filter), [audit, filter]);

  const set = (key: keyof typeof filter, value: string) =>
    setFilter((prev) => ({ ...prev, [key]: value }));

  const usersInLog = [...new Set(audit.map((e) => e.user))].sort();
  const actionsInLog = [...new Set(audit.map((e) => e.action))].sort();
  const entitiesInLog = [...new Set(audit.map((e) => e.entity))].sort();

  return (
    <Panel
      title="سجل التدقيق"
      subtitle={`${audit.length} قيد مسجّل · يوثّق التغييرات المؤثّرة دون القراءة والتصفّح`}
    >
      {audit.length === 0 ? (
        <>
          <Banner tone="warn">
            السجل فارغ — بدأ التوثيق من لحظة تفعيله، وما وقع قبله غير مسجّل.
          </Banner>
          <Empty>لم تُسجَّل تغييرات بعد</Empty>
        </>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Field label="المستخدم">
              <select
                value={filter.user}
                onChange={(e) => set("user", e.target.value)}
                className={inputClass}
              >
                <option value="الكل">الكل</option>
                {usersInLog.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            </Field>

            <Field label="نوع الإجراء">
              <select
                value={filter.action}
                onChange={(e) => set("action", e.target.value)}
                className={inputClass}
              >
                <option value="الكل">الكل</option>
                {actionsInLog.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </Field>

            <Field label="الموضوع">
              <select
                value={filter.entity}
                onChange={(e) => set("entity", e.target.value)}
                className={inputClass}
              >
                <option value="الكل">الكل</option>
                {entitiesInLog.map((en) => (
                  <option key={en}>{en}</option>
                ))}
              </select>
            </Field>

            <Field label="من تاريخ">
              <input
                type="date"
                value={filter.from}
                onChange={(e) => set("from", e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="إلى تاريخ">
              <input
                type="date"
                value={filter.to}
                onChange={(e) => set("to", e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="بحث">
              <input
                type="text"
                value={filter.search}
                onChange={(e) => set("search", e.target.value)}
                placeholder="كلمة من الوصف…"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setFilter(emptyAuditFilter())}
              className="rounded-lg bg-slate-200 px-4 py-2 font-bold no-print"
            >
              مسح الفلاتر
            </button>
            <button
              onClick={() =>
                onExport({
                  name: "سجل التدقيق",
                  rows: [
                    ["التاريخ والوقت", "المستخدم", "الإجراء", "الموضوع", "الوصف", "قبل", "بعد"],
                    ...rows.map((e) => [
                      formatAuditTime(e.at),
                      e.user,
                      e.action,
                      e.entity,
                      e.summary,
                      e.before ?? "",
                      e.after ?? "",
                    ]),
                  ],
                })
              }
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-bold no-print"
            >
              ⬇ تصدير الظاهر
            </button>
            <span className="text-sm text-slate-500">
              الظاهر: {rows.length} من {audit.length}
            </span>
          </div>

          {rows.length === 0 ? (
            <Empty>لا توجد قيود مطابقة للفلاتر</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
                  <tr>
                    <Th>التاريخ والوقت</Th>
                    <Th>المستخدم</Th>
                    <Th>الإجراء</Th>
                    <Th>الموضوع</Th>
                    <Th>الوصف</Th>
                    <Th>التفاصيل</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((entry) => {
                    const hasDetails = !!(entry.before || entry.after);
                    const open = expanded === entry.id;
                    return (
                      <Fragment key={entry.id}>
                        <tr className="border-b border-slate-100 align-top">
                          <Td className="whitespace-nowrap tabular-nums">
                            {formatAuditTime(entry.at)}
                          </Td>
                          <Td>{entry.user}</Td>
                          <Td>
                            <span
                              className={`rounded px-2 py-1 text-xs font-bold ${
                                AUDIT_TONE[entry.action] ?? "bg-slate-100"
                              }`}
                            >
                              {entry.action}
                            </span>
                          </Td>
                          <Td>{entry.entity}</Td>
                          <Td>{entry.summary}</Td>
                          <Td>
                            {hasDetails ? (
                              <button
                                onClick={() => setExpanded(open ? null : entry.id)}
                                className="rounded-lg bg-slate-100 px-3 py-1 no-print"
                              >
                                {open ? "إخفاء" : "عرض"}
                              </button>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </Td>
                        </tr>

                        {open && (
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <Td colSpan={6}>
                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                {entry.before && (
                                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                                    <p className="mb-1 text-xs font-bold text-red-800">
                                      قبل
                                    </p>
                                    <p className="text-sm">{entry.before}</p>
                                  </div>
                                )}
                                {entry.after && (
                                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                                    <p className="mb-1 text-xs font-bold text-green-800">
                                      بعد
                                    </p>
                                    <p className="text-sm">{entry.after}</p>
                                  </div>
                                )}
                              </div>
                            </Td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-4 text-sm text-slate-500">
            يُحتفظ بآخر {AUDIT_LIMIT} قيد، ثم تُحذف الأقدم. السجل يخرج مع النسخة
            الاحتياطية.
          </p>
        </>
      )}
    </Panel>
  );
}
/* ================================================================== */
/* البيانات الأساسية                                                   */
/* ================================================================== */

const ACCOUNT_TYPES: AccountType[] = [
  "أصول",
  "إلتزامات",
  "حقوق الملكية",
  "إيرادات",
  "مصروفات",
];

type MasterTab = "الحسابات" | "البنود" | "طرق الدفع" | "الأشخاص";

function MasterDataPage({
  chart,
  items,
  payments,
  people,
  movements,
  setChart,
  setItems,
  setPayments,
  setPeople,
  onLog,
}: {
  chart: Account[];
  items: ItemDefinition[];
  payments: PaymentMethod[];
  people: string[];
  movements: Movement[];
  setChart: Dispatch<SetStateAction<Account[]>>;
  setItems: Dispatch<SetStateAction<ItemDefinition[]>>;
  setPayments: Dispatch<SetStateAction<PaymentMethod[]>>;
  setPeople: Dispatch<SetStateAction<string[]>>;
  onLog: (
    action: AuditAction,
    entity: AuditEntity,
    summary: string,
    change?: { before?: string; after?: string }
  ) => void;
}) {
  const [tab, setTab] = useState<MasterTab>("الحسابات");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [newAccount, setNewAccount] = useState({
    code: "",
    name: "",
    parent: "",
    type: "مصروفات" as AccountType,
    nature: "مدين" as Account["nature"],
    level: "3",
  });
  const [newItem, setNewItem] = useState({ code: "", name: "", account: "" });
  const [newPayment, setNewPayment] = useState({ label: "", account: "" });
  const [newPerson, setNewPerson] = useState("");

  /** كم حركة تستعمل هذا الحساب؟ الحساب المستعمل لا يُحذف */
  const accountUsage = useMemo(() => {
    const used = new Map<string, number>();
    for (const m of movements) {
      used.set(m.debitCode, (used.get(m.debitCode) ?? 0) + 1);
      used.set(m.creditCode, (used.get(m.creditCode) ?? 0) + 1);
    }
    return used;
  }, [movements]);

  const itemUsage = useMemo(() => {
    const used = new Map<string, number>();
    for (const m of movements) {
      if (m.itemCode) used.set(m.itemCode, (used.get(m.itemCode) ?? 0) + 1);
    }
    return used;
  }, [movements]);

  const filteredChart = chart.filter((a) => {
    const q = search.trim();
    return !q || a.code.includes(q) || a.name.includes(q);
  });

  /* ---------------- الحسابات ---------------- */

  const addAccount = () => {
    const code = newAccount.code.trim();
    if (!/^\d{3,6}$/.test(code)) return setError("رقم الحساب من ٣ إلى ٦ أرقام");
    if (!newAccount.name.trim()) return setError("اسم الحساب مطلوب");
    if (chart.some((a) => a.code === code)) return setError("رقم الحساب مستخدم");

    const account: Account = {
      code,
      name: newAccount.name.trim(),
      parent: newAccount.parent.trim(),
      type: newAccount.type,
      nature: newAccount.nature,
      level: Number(newAccount.level) || 3,
      statement:
        newAccount.type === "إيرادات" || newAccount.type === "مصروفات"
          ? "قائمة الدخل"
          : "قائمة المركز المالي",
      active: true,
      postable: true,
    };

    setChart((prev) =>
      [...prev, account].sort((a, b) => a.code.localeCompare(b.code))
    );
    onLog("إنشاء", "بيانات النظام", `حساب جديد ${code} — ${account.name}`);
    setNewAccount({ ...newAccount, code: "", name: "" });
    setError("");
  };

  const patchAccount = (code: string, patch: Partial<Account>) =>
    setChart((prev) =>
      prev.map((a) => (a.code === code ? { ...a, ...patch } : a))
    );

  return (
    <>
      <Panel
        title="البيانات الأساسية"
        subtitle="دليل الحسابات والبنود وطرق الدفع والأشخاص — تُحرَّر هنا دون الحاجة لتعديل البرنامج"
      >
        <div className="mb-5 flex flex-wrap gap-2">
          {(["الحسابات", "البنود", "طرق الدفع", "الأشخاص"] as MasterTab[]).map(
            (t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  setError("");
                }}
                className={`rounded-lg px-5 py-2 font-bold ${
                  tab === t ? "bg-blue-600 text-white" : "bg-slate-100"
                }`}
              >
                {t}
              </button>
            )
          )}
        </div>

        {error && (
          <p className="mb-4 text-sm font-medium text-red-600">{error}</p>
        )}

        {/* ---------------- الحسابات ---------------- */}
        {tab === "الحسابات" && (
          <>
            <Banner tone="warn">
              تعديل دليل الحسابات يمسّ كل التقارير. الحساب المستعمل في حركات لا
              يُحذف — عطّله بدل ذلك فيختفي من قوائم الاختيار وتبقى حركاته سليمة.
            </Banner>

            <div className="mb-4 rounded-xl border border-slate-200 p-4">
              <p className="mb-3 font-bold">حساب جديد</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                <Field label="رقم الحساب">
                  <input
                    type="text"
                    value={newAccount.code}
                    onChange={(e) =>
                      setNewAccount({ ...newAccount, code: e.target.value })
                    }
                    placeholder="6295"
                    className={inputClass}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="اسم الحساب">
                    <input
                      type="text"
                      value={newAccount.name}
                      onChange={(e) =>
                        setNewAccount({ ...newAccount, name: e.target.value })
                      }
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Field label="التصنيف">
                  <select
                    value={newAccount.type}
                    onChange={(e) =>
                      setNewAccount({
                        ...newAccount,
                        type: e.target.value as AccountType,
                        nature:
                          e.target.value === "أصول" ||
                          e.target.value === "مصروفات"
                            ? "مدين"
                            : "دائن",
                      })
                    }
                    className={inputClass}
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                <Field label="الطبيعة">
                  <select
                    value={newAccount.nature}
                    onChange={(e) =>
                      setNewAccount({
                        ...newAccount,
                        nature: e.target.value as Account["nature"],
                      })
                    }
                    className={inputClass}
                  >
                    <option>مدين</option>
                    <option>دائن</option>
                  </select>
                </Field>
                <Field label="الحساب الأب">
                  <input
                    type="text"
                    value={newAccount.parent}
                    onChange={(e) =>
                      setNewAccount({ ...newAccount, parent: e.target.value })
                    }
                    placeholder="6200"
                    className={inputClass}
                  />
                </Field>
              </div>
              <button
                onClick={addAccount}
                className="mt-3 rounded-lg bg-blue-600 px-6 py-2 font-bold text-white"
              >
                إضافة الحساب
              </button>
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث برقم الحساب أو اسمه…"
              className={`${inputClass} mb-4`}
            />

            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-right text-sm">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    <Th>الرقم</Th>
                    <Th>الاسم</Th>
                    <Th>التصنيف</Th>
                    <Th>الطبيعة</Th>
                    <Th>يُرحّل عليه</Th>
                    <Th>نشط</Th>
                    <Th>الحركات</Th>
                    <Th>حذف</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredChart.map((a) => {
                    const used = accountUsage.get(a.code) ?? 0;
                    return (
                      <tr key={a.code} className="border-b border-slate-100">
                        <Td>{a.code}</Td>
                        <Td>
                          <input
                            type="text"
                            value={a.name}
                            onChange={(e) =>
                              patchAccount(a.code, { name: e.target.value })
                            }
                            className="w-full rounded border border-slate-200 px-2 py-1"
                          />
                        </Td>
                        <Td>{a.type}</Td>
                        <Td>{a.nature}</Td>
                        <Td>
                          <input
                            type="checkbox"
                            checked={a.postable}
                            onChange={(e) =>
                              patchAccount(a.code, { postable: e.target.checked })
                            }
                          />
                        </Td>
                        <Td>
                          <input
                            type="checkbox"
                            checked={a.active}
                            onChange={(e) =>
                              patchAccount(a.code, { active: e.target.checked })
                            }
                          />
                        </Td>
                        <Td className={used ? "font-bold" : "text-slate-400"}>
                          {used || "—"}
                        </Td>
                        <Td>
                          <button
                            disabled={used > 0}
                            title={used ? "مستعمل في حركات" : ""}
                            onClick={() => {
                              if (window.confirm(`حذف الحساب ${a.code}؟`)) {
                                setChart((prev) =>
                                  prev.filter((x) => x.code !== a.code)
                                );
                                onLog(
                                  "حذف",
                                  "بيانات النظام",
                                  `حساب ${a.code} — ${a.name}`
                                );
                              }
                            }}
                            className="rounded bg-red-50 px-3 py-1 text-red-700 disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            حذف
                          </button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              {filteredChart.length} من {chart.length} حساباً
            </p>
          </>
        )}

        {/* ---------------- البنود ---------------- */}
        {tab === "البنود" && (
          <>
            <Banner tone="warn">
              البند هو ما تختاره عند إدخال حركة، وهو يحدّد الحساب الذي تُرحّل
              إليه. البند بلا حساب لا يُنتج قيداً صالحاً.
            </Banner>

            <div className="mb-4 rounded-xl border border-slate-200 p-4">
              <p className="mb-3 font-bold">بند جديد</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field label="كود البند">
                  <input
                    type="text"
                    value={newItem.code}
                    onChange={(e) =>
                      setNewItem({ ...newItem, code: e.target.value })
                    }
                    placeholder="EXP034"
                    className={inputClass}
                  />
                </Field>
                <Field label="اسم البند">
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) =>
                      setNewItem({ ...newItem, name: e.target.value })
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="الحساب">
                  <select
                    value={newItem.account}
                    onChange={(e) =>
                      setNewItem({ ...newItem, account: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">بلا حساب</option>
                    {chart
                      .filter((a) => a.postable && a.active)
                      .map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                  </select>
                </Field>
              </div>
              <button
                onClick={() => {
                  const code = newItem.code.trim();
                  const name = newItem.name.trim();
                  if (!code || !name) return setError("الكود والاسم مطلوبان");
                  if (items.some((i) => i.code === code))
                    return setError("كود البند مستخدم");
                  setItems((prev) => [
                    ...prev,
                    { code, name, account: newItem.account },
                  ]);
                  onLog("إنشاء", "بيانات النظام", `بند جديد ${name} → ${newItem.account || "بلا حساب"}`);
                  setNewItem({ code: "", name: "", account: "" });
                  setError("");
                }}
                className="mt-3 rounded-lg bg-blue-600 px-6 py-2 font-bold text-white"
              >
                إضافة البند
              </button>
            </div>

            <div className="max-h-[32rem] overflow-auto">
              <table className="w-full text-right text-sm">
                <thead className="sticky top-0 bg-slate-100">
                  <tr>
                    <Th>الكود</Th>
                    <Th>الاسم</Th>
                    <Th>الحساب</Th>
                    <Th>الحركات</Th>
                    <Th>حذف</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const used = itemUsage.get(i.code) ?? 0;
                    return (
                      <tr key={i.code} className="border-b border-slate-100">
                        <Td>{i.code}</Td>
                        <Td>
                          <input
                            type="text"
                            value={i.name}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((x) =>
                                  x.code === i.code
                                    ? { ...x, name: e.target.value }
                                    : x
                                )
                              )
                            }
                            className="w-full rounded border border-slate-200 px-2 py-1"
                          />
                        </Td>
                        <Td>
                          <select
                            value={i.account}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((x) =>
                                  x.code === i.code
                                    ? { ...x, account: e.target.value }
                                    : x
                                )
                              )
                            }
                            className={
                              i.account
                                ? "rounded border border-slate-200 px-2 py-1"
                                : "rounded border border-red-300 bg-red-50 px-2 py-1"
                            }
                          >
                            <option value="">بلا حساب</option>
                            {chart
                              .filter((a) => a.postable && a.active)
                              .map((a) => (
                                <option key={a.code} value={a.code}>
                                  {a.code} — {a.name}
                                </option>
                              ))}
                          </select>
                        </Td>
                        <Td className={used ? "font-bold" : "text-slate-400"}>
                          {used || "—"}
                        </Td>
                        <Td>
                          <button
                            disabled={used > 0}
                            onClick={() => {
                              setItems((prev) =>
                                prev.filter((x) => x.code !== i.code)
                              );
                              onLog("حذف", "بيانات النظام", `بند ${i.name}`);
                            }}
                            className="rounded bg-red-50 px-3 py-1 text-red-700 disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            حذف
                          </button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ---------------- طرق الدفع ---------------- */}
        {tab === "طرق الدفع" && (
          <>
            <Banner tone="warn">
              طريقة الدفع تحدّد الحساب المقابل في القيد: النقدي يقابله الصندوق،
              والتحويل يقابله البنك.
            </Banner>

            <div className="mb-4 flex flex-wrap gap-3">
              <input
                type="text"
                value={newPayment.label}
                onChange={(e) =>
                  setNewPayment({ ...newPayment, label: e.target.value })
                }
                placeholder="اسم طريقة الدفع"
                className={`${inputClass} flex-1`}
              />
              <select
                value={newPayment.account}
                onChange={(e) =>
                  setNewPayment({ ...newPayment, account: e.target.value })
                }
                className={`${inputClass} flex-1`}
              >
                <option value="">اختر الحساب المقابل</option>
                {chart
                  .filter((a) => a.postable && a.active)
                  .map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.code} — {a.name}
                    </option>
                  ))}
              </select>
              <button
                onClick={() => {
                  const label = newPayment.label.trim();
                  if (!label || !newPayment.account)
                    return setError("الاسم والحساب مطلوبان");
                  if (payments.some((p) => p.label === label))
                    return setError("طريقة الدفع موجودة");
                  setPayments((prev) => [
                    ...prev,
                    { label, account: newPayment.account },
                  ]);
                  onLog("إنشاء", "بيانات النظام", `طريقة دفع ${label}`);
                  setNewPayment({ label: "", account: "" });
                  setError("");
                }}
                className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
              >
                إضافة
              </button>
            </div>

            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Th>طريقة الدفع</Th>
                  <Th>الحساب المقابل</Th>
                  <Th>حذف</Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.label} className="border-b border-slate-100">
                    <Td>{p.label}</Td>
                    <Td>
                      <select
                        value={p.account}
                        onChange={(e) =>
                          setPayments((prev) =>
                            prev.map((x) =>
                              x.label === p.label
                                ? { ...x, account: e.target.value }
                                : x
                            )
                          )
                        }
                        className="rounded border border-slate-200 px-2 py-1"
                      >
                        {chart
                          .filter((a) => a.postable && a.active)
                          .map((a) => (
                            <option key={a.code} value={a.code}>
                              {a.code} — {a.name}
                            </option>
                          ))}
                      </select>
                    </Td>
                    <Td>
                      <button
                        onClick={() => {
                          setPayments((prev) =>
                            prev.filter((x) => x.label !== p.label)
                          );
                          onLog("حذف", "بيانات النظام", `طريقة دفع ${p.label}`);
                        }}
                        className="rounded bg-red-50 px-3 py-1 text-red-700"
                      >
                        حذف
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ---------------- الأشخاص ---------------- */}
        {tab === "الأشخاص" && (
          <>
            <p className="mb-4 text-sm text-slate-600">
              الأسماء التي تظهر في حقل «الدافع / المستلم» عند إدخال الحركات.
            </p>

            <div className="mb-4 flex gap-3">
              <input
                type="text"
                value={newPerson}
                onChange={(e) => setNewPerson(e.target.value)}
                placeholder="اسم الشخص"
                className={`${inputClass} flex-1`}
              />
              <button
                onClick={() => {
                  const name = newPerson.trim();
                  if (!name) return;
                  if (people.includes(name)) return setError("الاسم موجود");
                  setPeople((prev) => [...prev, name]);
                  onLog("إنشاء", "بيانات النظام", `شخص ${name}`);
                  setNewPerson("");
                  setError("");
                }}
                className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
              >
                إضافة
              </button>
            </div>

            <div className="space-y-2">
              {people.map((name) => {
                const used = movements.filter((m) => m.person === name).length;
                return (
                  <div
                    key={name}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2"
                  >
                    <span>{name}</span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-slate-500">{used} حركة</span>
                      <button
                        disabled={used > 0}
                        onClick={() => {
                          setPeople((prev) => prev.filter((p) => p !== name));
                          onLog("حذف", "بيانات النظام", `شخص ${name}`);
                        }}
                        className="rounded bg-red-50 px-3 py-1 text-red-700 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
/* ================================================================== */
/* ملف الموظفين                                                        */
/* ================================================================== */

const BLANK_EMPLOYEE = {
  code: "",
  name: "",
  civilId: "",
  nationality: "",
  isKuwaiti: false,
  jobTitle: "",
  department: "إداري",
  project: "",
  hireDate: "",
  endDate: "",
  wageType: "شهري" as WageType,
  basicWage: "",
  registeredWage: "",
  iban: "",
  wageAccount: "",
  restDay: "الجمعة",
  passportNumber: "",
  workPermitExpiry: "",
  residencyExpiry: "",
  notes: "",
};

/** كم يوماً بقي على انتهاء وثيقة — سالب يعني منتهية */
function daysUntil(date: string): number | null {
  if (!date) return null;
  const target = new Date(date).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / 86_400_000);
}

function EmployeesPage({
  employees,
  projects,
  settings,
  setEmployees,
  onLog,
}: {
  employees: Employee[];
  projects: Project[];
  settings: PayrollSettings;
  setEmployees: Dispatch<SetStateAction<Employee[]>>;
  onLog: (
    action: AuditAction,
    entity: AuditEntity,
    summary: string,
    change?: { before?: string; after?: string }
  ) => void;
}) {
  const [form, setForm] = useState(BLANK_EMPLOYEE);
  const [allowances, setAllowances] = useState<{ name: string; amount: string }[]>(
    []
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const set = (key: keyof typeof BLANK_EMPLOYEE, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const visible = employees.filter((e) => showInactive || e.active);
  const selected = employees.find((e) => e.id === selectedId) ?? null;

  const openNew = () => {
    setEditingId(null);
    setForm({ ...BLANK_EMPLOYEE, code: String(employees.length + 1) });
    setAllowances([]);
    setError("");
    setShowForm(true);
  };

  const openEdit = (e: Employee) => {
    setEditingId(e.id);
    setForm({
      code: e.code,
      name: e.name,
      civilId: e.civilId,
      nationality: e.nationality,
      isKuwaiti: e.isKuwaiti,
      jobTitle: e.jobTitle,
      department: e.department,
      project: e.project,
      hireDate: e.hireDate,
      endDate: e.endDate,
      wageType: e.wageType,
      basicWage: String(e.basicWage),
      registeredWage: e.registeredWage ? String(e.registeredWage) : "",
      iban: e.iban,
      wageAccount: e.wageAccount,
      restDay: e.restDay,
      passportNumber: e.passportNumber,
      workPermitExpiry: e.workPermitExpiry,
      residencyExpiry: e.residencyExpiry,
      notes: e.notes,
    });
    setAllowances(
      e.allowances.map((a) => ({ name: a.name, amount: String(a.amount) }))
    );
    setError("");
    setShowForm(true);
  };

  const save = () => {
    const name = form.name.trim();
    const wage = round3(Number(form.basicWage) || 0);
    if (!name) return setError("اسم الموظف مطلوب");
    if (!form.hireDate) return setError("تاريخ التعيين مطلوب");
    if (wage <= 0) return setError("الأجر يجب أن يكون أكبر من صفر");
    if (
      employees.some(
        (e) => e.id !== editingId && e.code && e.code === form.code.trim()
      )
    ) {
      return setError("رقم الموظف مستخدم");
    }

    const record: Employee = {
      id: editingId ?? newId(),
      code: form.code.trim(),
      name,
      civilId: form.civilId.trim(),
      nationality: form.nationality.trim(),
      isKuwaiti: form.isKuwaiti,
      jobTitle: form.jobTitle.trim(),
      department: form.department,
      project: form.project,
      hireDate: form.hireDate,
      endDate: form.endDate,
      wageType: form.wageType,
      basicWage: wage,
      registeredWage: round3(Number(form.registeredWage) || 0),
      iban: form.iban.trim(),
      wageAccount: form.wageAccount,
      allowances: allowances
        .filter((a) => a.name.trim())
        .map((a) => ({
          name: a.name.trim(),
          amount: round3(Number(a.amount) || 0),
        })),
      restDay: form.restDay,
      active: !form.endDate,
      passportNumber: form.passportNumber.trim(),
      workPermitExpiry: form.workPermitExpiry,
      residencyExpiry: form.residencyExpiry,
      notes: form.notes.trim(),
    };

    setEmployees((prev) =>
      editingId ? prev.map((e) => (e.id === editingId ? record : e)) : [...prev, record]
    );
    onLog(
      editingId ? "تعديل" : "إنشاء",
      "مستخدم",
      `موظف ${name} — ${record.wageType} ${fmt(wage)} د.ك`
    );
    setShowForm(false);
    setEditingId(null);
    setError("");
  };

  /** تنبيهات الوثائق المنتهية أو القريبة */
  const expiring = employees
    .filter((e) => e.active)
    .flatMap((e) =>
      [
        ["الإقامة", e.residencyExpiry],
        ["إذن العمل", e.workPermitExpiry],
      ]
        .map(([label, date]) => ({
          employee: e,
          label: String(label),
          date: String(date),
          days: daysUntil(String(date)),
        }))
        .filter((x) => x.days !== null && x.days <= 60)
    )
    .sort((a, b) => (a.days ?? 0) - (b.days ?? 0));

  return (
    <>
      {expiring.length > 0 && (
        <Banner tone="warn">
          <b>{expiring.length}</b> وثيقة منتهية أو تنتهي خلال ٦٠ يوماً:{" "}
          {expiring
            .slice(0, 4)
            .map(
              (x) =>
                `${x.employee.name} — ${x.label} ${
                  (x.days ?? 0) < 0 ? "منتهية" : `بعد ${x.days} يوم`
                }`
            )
            .join(" · ")}
        </Banner>
      )}

      <Panel
        title="ملف الموظفين"
        subtitle={`${employees.filter((e) => e.active).length} على رأس العمل من أصل ${employees.length}`}
      >
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <button
            onClick={showForm ? () => setShowForm(false) : openNew}
            className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
          >
            {showForm ? "إخفاء النموذج" : "إضافة موظف"}
          </button>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            عرض المنتهية خدماتهم
          </label>
        </div>

        {showForm && (
          <div className="mb-6 space-y-5 rounded-xl border border-slate-200 p-5">
            <h4 className="font-bold">
              {editingId ? "تعديل موظف" : "موظف جديد"}
            </h4>

            <div>
              <p className="mb-2 text-sm font-bold text-slate-600">
                البيانات الشخصية
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Field label="رقم الموظف">
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => set("code", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="الاسم">
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      className={inputClass}
                    />
                  </Field>
                </div>
                <Field label="الرقم المدني">
                  <input
                    type="text"
                    value={form.civilId}
                    onChange={(e) => set("civilId", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="الجنسية">
                  <input
                    type="text"
                    value={form.nationality}
                    onChange={(e) => set("nationality", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <div className="flex items-end pb-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={form.isKuwaiti}
                      onChange={(e) => set("isKuwaiti", e.target.checked)}
                    />
                    كويتي — تُحتسب له التأمينات
                  </label>
                </div>
                <Field label="رقم الجواز">
                  <input
                    type="text"
                    value={form.passportNumber}
                    onChange={(e) => set("passportNumber", e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-slate-600">الوظيفة</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Field label="المسمى الوظيفي">
                  <input
                    type="text"
                    value={form.jobTitle}
                    onChange={(e) => set("jobTitle", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="الجهة" hint="تحدّد حساب المصروف">
                  <select
                    value={form.department}
                    onChange={(e) => set("department", e.target.value)}
                    className={inputClass}
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="المشروع" hint="لعمال المواقع">
                  <select
                    value={form.project}
                    onChange={(e) => set("project", e.target.value)}
                    className={inputClass}
                  >
                    <option value="">بدون مشروع</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="يوم الراحة">
                  <select
                    value={form.restDay}
                    onChange={(e) => set("restDay", e.target.value)}
                    className={inputClass}
                  >
                    {WEEK_DAYS.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="تاريخ التعيين">
                  <input
                    type="date"
                    value={form.hireDate}
                    onChange={(e) => set("hireDate", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="تاريخ انتهاء الخدمة"
                  hint="اتركه فارغاً لمن على رأس العمل"
                >
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => set("endDate", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="انتهاء الإقامة">
                  <input
                    type="date"
                    value={form.residencyExpiry}
                    onChange={(e) => set("residencyExpiry", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="انتهاء إذن العمل">
                  <input
                    type="date"
                    value={form.workPermitExpiry}
                    onChange={(e) => set("workPermitExpiry", e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-slate-600">الأجر</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <Field label="نوع الأجر">
                  <select
                    value={form.wageType}
                    onChange={(e) =>
                      set("wageType", e.target.value as "شهري" | "يومي")
                    }
                    className={inputClass}
                  >
                    <option value="شهري">شهري</option>
                    <option value="يومي">يومي</option>
                  </select>
                </Field>
                <Field
                  label={
                    form.wageType === "شهري"
                      ? "الراتب الشهري (د.ك)"
                      : "أجر اليوم (د.ك)"
                  }
                >
                  <input
                    type="number"
                    step="0.001"
                    value={form.basicWage}
                    onChange={(e) => set("basicWage", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field
                  label="المسجّل في ملف الشؤون"
                  hint="اتركه فارغاً إن كان مطابقاً للفعلي"
                >
                  <input
                    type="number"
                    step="0.001"
                    value={form.registeredWage}
                    onChange={(e) => set("registeredWage", e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <div className="flex items-end pb-1">
                  <div className="w-full rounded-lg bg-slate-100 px-4 py-3 text-sm">
                    {Number(form.basicWage) > 0 && (
                      <>
                        أجر اليوم{" "}
                        <b>
                          {fmt(
                            form.wageType === "شهري"
                              ? Number(form.basicWage) / settings.monthDays
                              : Number(form.basicWage)
                          )}
                        </b>{" "}
                        · أجر الساعة{" "}
                        <b>
                          {fmt(
                            (form.wageType === "شهري"
                              ? Number(form.basicWage) / settings.monthDays
                              : Number(form.basicWage)) / settings.dailyHours
                          )}
                        </b>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-2 flex items-center gap-3">
                  <p className="text-sm font-medium">البدلات</p>
                  <button
                    onClick={() =>
                      setAllowances((prev) => [...prev, { name: "", amount: "" }])
                    }
                    className="rounded bg-slate-100 px-3 py-1 text-xs font-bold"
                  >
                    + بدل
                  </button>
                </div>
                {allowances.map((a, index) => (
                  <div key={index} className="mb-2 flex gap-2">
                    <input
                      type="text"
                      value={a.name}
                      onChange={(e) =>
                        setAllowances((prev) =>
                          prev.map((x, i) =>
                            i === index ? { ...x, name: e.target.value } : x
                          )
                        )
                      }
                      placeholder="بدل سكن / مواصلات"
                      className={`${inputClass} flex-1`}
                    />
                    <input
                      type="number"
                      step="0.001"
                      value={a.amount}
                      onChange={(e) =>
                        setAllowances((prev) =>
                          prev.map((x, i) =>
                            i === index ? { ...x, amount: e.target.value } : x
                          )
                        )
                      }
                      placeholder="المبلغ"
                      className={`${inputClass} w-40`}
                    />
                    <button
                      onClick={() =>
                        setAllowances((prev) => prev.filter((_, i) => i !== index))
                      }
                      className="rounded-lg bg-red-50 px-3 text-red-700"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="رقم الآيبان" hint="لكشوف التحويل البنكي">
                <input
                  type="text"
                  value={form.iban}
                  onChange={(e) => set("iban", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field
                label="حساب الصرف"
                hint={`فارغ يعني الافتراضي بحسب الجهة (${defaultWageAccount(
                  form.department
                )})`}
              >
                <select
                  value={form.wageAccount}
                  onChange={(e) => set("wageAccount", e.target.value)}
                  className={inputClass}
                >
                  <option value="">
                    الافتراضي — {accountLabel(defaultWageAccount(form.department))}
                  </option>
                  {POSTABLE_ACCOUNTS.filter(
                    (a) => a.type === "مصروفات" || a.type === "إلتزامات"
                  ).map((a) => (
                    <option key={a.code} value={a.code}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="ملاحظات">
              <input
                type="text"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                className={inputClass}
              />
            </Field>

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={save}
                className="rounded-lg bg-slate-900 px-6 py-3 font-bold text-white"
              >
                {editingId ? "حفظ التعديل" : "حفظ الموظف"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg bg-slate-200 px-6 py-3 font-bold"
              >
                إلغاء
              </button>
            </div>
          </div>
        )}

        {visible.length === 0 ? (
          <Empty>لا يوجد موظفون — ابدأ بإضافة موظف</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <Th>الرقم</Th>
                  <Th>الاسم</Th>
                  <Th>الوظيفة</Th>
                  <Th>الجهة</Th>
                  <Th>نوع الأجر</Th>
                  <Th>الأجر الفعلي</Th>
                  <Th>المسجّل بالشؤون</Th>
                  <Th>البدلات</Th>
                  <Th>التعيين</Th>
                  <Th>الحالة</Th>
                  <Th>الإجراء</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => (
                  <tr key={e.id} className="border-b border-slate-200">
                    <Td>{e.code || "—"}</Td>
                    <Td>
                      <button
                        onClick={() =>
                          setSelectedId(selectedId === e.id ? null : e.id)
                        }
                        className="font-bold text-blue-700 hover:underline"
                      >
                        {e.name}
                      </button>
                      {e.isKuwaiti && (
                        <span className="mr-2 rounded bg-slate-100 px-2 py-1 text-xs">
                          كويتي
                        </span>
                      )}
                    </Td>
                    <Td>{e.jobTitle || "—"}</Td>
                    <Td>
                      {e.department}
                      {e.project && (
                        <div className="text-xs text-slate-500">{e.project}</div>
                      )}
                    </Td>
                    <Td>{e.wageType}</Td>
                    <Td>
                      <Money value={e.basicWage} />
                    </Td>
                    <Td>
                      {e.registeredWage ? (
                        <span
                          className={
                            e.registeredWage !== e.basicWage
                              ? "font-bold text-amber-800"
                              : " "
                          }
                        >
                          {fmt(e.registeredWage)}
                        </span>
                      ) : (
                        <span className="text-slate-400">مطابق</span>
                      )}
                    </Td>
                    <Td>
                      {totalAllowances(e) ? (
                        <Money value={totalAllowances(e)} />
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>{e.hireDate || "—"}</Td>
                    <Td>
                      {e.active ? (
                        <span className="text-green-700">على رأس العمل</span>
                      ) : (
                        <span className="text-slate-400">
                          انتهت {e.endDate}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(e)}
                          className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`حذف الموظف «${e.name}»؟`)) {
                              setEmployees((prev) =>
                                prev.filter((x) => x.id !== e.id)
                              );
                              onLog("حذف", "مستخدم", `موظف ${e.name}`);
                            }
                          }}
                          className="rounded-lg bg-red-50 px-3 py-2 text-red-700"
                        >
                          حذف
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {selected && (
        <Panel
          title={`مكافأة نهاية الخدمة — ${selected.name}`}
          subtitle="محسوبة حتى اليوم بحسب قانون العمل والإعدادات المسجّلة"
        >
          {(() => {
            const eos = endOfService(selected, settings, todayISO());
            return (
              <>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  {[
                    ["مدة الخدمة", `${eos.years} سنة و ${eos.months} شهر`],
                    ["الأيام المستحقة", fmt(eos.daysEarned)],
                    ["أجر اليوم", fmt(dailyWage(selected, settings))],
                    ["المكافأة", `${fmt(eos.amount)} د.ك`],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="rounded-xl border border-slate-200 p-4"
                    >
                      <p className="text-sm text-slate-500">{label}</p>
                      <p className="mt-1 text-xl font-bold">{value}</p>
                    </div>
                  ))}
                </div>
                {eos.capped && (
                  <Banner tone="warn">
                    {eos.note} — خُفّضت المكافأة إلى الحد الأقصى.
                  </Banner>
                )}
                <p className="mt-4 text-sm text-slate-500">
                  المبلغ تقديري مبني على الإعدادات المسجّلة في «إعدادات
                  الرواتب». تأكّد من القيم القانونية قبل الصرف.
                </p>
              </>
            );
          })()}
        </Panel>
      )}
    </>
  );
}

/* ================================================================== */
/* إعدادات الرواتب                                                     */
/* ================================================================== */

function PayrollSettingsPanel({
  settings,
  setSettings,
}: {
  settings: PayrollSettings;
  setSettings: Dispatch<SetStateAction<PayrollSettings>>;
}) {
  const num = (key: keyof PayrollSettings, label: string, hint?: string) => (
    <Field key={String(key)} label={label} hint={hint}>
      <input
        type="number"
        step="0.01"
        value={String(settings[key] as number)}
        onChange={(e) =>
          setSettings((prev) => ({ ...prev, [key]: Number(e.target.value) || 0 }))
        }
        className={inputClass}
      />
    </Field>
  );

  return (
    <Panel
      title="إعدادات الرواتب"
      subtitle="القيم الابتدائية من قانون العمل في القطاع الأهلي رقم ٦ لسنة ٢٠١٠"
    >
      <Banner tone="warn">
        هذه القيم <b>قابلة للتعديل عمداً</b>: القوانين واللوائح تتغيّر، ولم
        أثبّتها في البرنامج. راجعها لدى الهيئة العامة للقوى العاملة قبل
        الاعتماد عليها في صرف فعلي.
      </Banner>

      <p className="mb-2 font-bold">ساعات العمل</p>
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
        {num("dailyHours", "ساعات اليوم", "المادة ٦٤")}
        {num("weeklyHours", "ساعات الأسبوع", "المادة ٦٤")}
        {num("ramadanWeeklyHours", "ساعات رمضان الأسبوعية")}
        {num("monthDays", "أيام الشهر", "لاشتقاق أجر اليوم")}
      </div>

      <p className="mb-2 font-bold">العمل الإضافي</p>
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-5">
        {num("overtimeRate", "معامل الإضافي", "١٫٢٥ = ١٢٥٪")}
        {num("restDayRate", "معامل يوم الراحة", "١٫٥ = ١٥٠٪")}
        {num("holidayRate", "معامل العطلة الرسمية", "٢ = ٢٠٠٪")}
        {num("maxOvertimeDaily", "حد الإضافي اليومي")}
        {num("maxOvertimeYearly", "حد الإضافي السنوي")}
      </div>

      <p className="mb-2 font-bold">الإجازات ومكافأة نهاية الخدمة</p>
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-5">
        {num("annualLeaveDays", "الإجازة السنوية (يوم)", "المادة ٧٠")}
        {num("eosFirstYears", "السنوات الأولى", "المادة ٥١")}
        {num("eosDaysPerYearFirst", "أيام لكل سنة أولى")}
        {num("eosDaysPerYearAfter", "أيام لكل سنة بعدها")}
        {num("eosCapMonths", "حد المكافأة (شهر)")}
      </div>

      <p className="mb-2 font-bold">وعاء احتساب الأجر</p>
      <div className="mb-5 space-y-2 rounded-xl border border-slate-200 p-4">
        <p className="text-sm text-slate-600">
          حين يكون الأجر مركّباً من أساسي وبدلات، على أيّهما يُحسب الإضافي
          ومكافأة نهاية الخدمة؟ القانون يعرّف «الأجر» بأكثر من صيغة —
          الاختيار لك بعد مراجعة مستشارك.
        </p>
        {(
          [
            ["overtimeOnGrossWage", "ساعة العمل الإضافي"],
            ["eosOnGrossWage", "مكافأة نهاية الخدمة"],
          ] as [keyof PayrollSettings, string][]
        ).map(([key, label]) => (
          <label key={String(key)} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings[key] as boolean}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, [key]: e.target.checked }))
              }
            />
            <span>
              <b>{label}</b> — تُحسب على الأساسي{" "}
              {(settings[key] as boolean) ? "مع البدلات" : "وحده"}
            </span>
          </label>
        ))}
      </div>

      <p className="mb-2 font-bold">الخصومات والتأمينات</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {num("maxDeductionPercent", "حد الخصم من الأجر %")}
        <div className="flex items-end pb-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={settings.socialInsuranceEnabled}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  socialInsuranceEnabled: e.target.checked,
                }))
              }
            />
            تفعيل التأمينات الاجتماعية
          </label>
        </div>
        {num("socialInsuranceEmployee", "حصة الموظف %", "أدخلها بعد التأكد")}
        {num("socialInsuranceEmployer", "حصة صاحب العمل %")}
      </div>

      {settings.socialInsuranceEnabled &&
        settings.socialInsuranceEmployee === 0 && (
          <Banner tone="error">
            التأمينات مفعّلة ونسبة الموظف صفر — لن يُخصم شيء. أدخل النسبة
            الصحيحة.
          </Banner>
        )}

      <p className="mt-5 mb-2 font-bold">شرائح الإجازة المرضية (المادة ٦٩)</p>
      <table className="w-full max-w-md text-right text-sm">
        <thead className="bg-slate-100">
          <tr>
            <Th>الأيام</Th>
            <Th>نسبة الأجر</Th>
          </tr>
        </thead>
        <tbody>
          {settings.sickLeaveTiers.map((tier, index) => (
            <tr key={index} className="border-b border-slate-100">
              <Td>
                <input
                  type="number"
                  value={tier.days}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      sickLeaveTiers: prev.sickLeaveTiers.map((t, i) =>
                        i === index
                          ? { ...t, days: Number(e.target.value) || 0 }
                          : t
                      ),
                    }))
                  }
                  className="w-24 rounded border border-slate-300 px-2 py-1"
                />
              </Td>
              <Td>
                <input
                  type="number"
                  step="0.25"
                  value={tier.rate}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      sickLeaveTiers: prev.sickLeaveTiers.map((t, i) =>
                        i === index
                          ? { ...t, rate: Number(e.target.value) || 0 }
                          : t
                      ),
                    }))
                  }
                  className="w-24 rounded border border-slate-300 px-2 py-1"
                />
                <span className="mr-2 text-slate-500">
                  {Math.round(tier.rate * 100)}%
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
/* ================================================================== */
/* الحضور والانصراف                                                    */
/* ================================================================== */

const STATUS_TONE: Record<string, string> = {
  حاضر: "bg-green-50 text-green-800",
  "غياب بعذر": "bg-amber-50 text-amber-900",
  "غياب بدون عذر": "bg-red-50 text-red-800",
  "إجازة سنوية": "bg-blue-50 text-blue-800",
  "إجازة مرضية": "bg-purple-50 text-purple-800",
  "عطلة رسمية": "bg-slate-100 text-slate-600",
  "راحة أسبوعية": "bg-slate-50 text-slate-400",
};

/** أيام شهر بصيغة yyyy-mm-dd */
function monthDays(month: string): string[] {
  const [year, m] = month.split("-").map(Number);
  if (!year || !m) return [];
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return Array.from(
    { length: count },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`
  );
}

const dayName = (iso: string) => WEEK_DAYS[new Date(iso).getUTCDay()];

function AttendancePage({
  employees,
  attendance,
  settings,
  year,
  setAttendance,
  onLog,
}: {
  employees: Employee[];
  attendance: AttendanceDay[];
  settings: PayrollSettings;
  year: number;
  setAttendance: Dispatch<SetStateAction<AttendanceDay[]>>;
  onLog: (
    action: AuditAction,
    entity: AuditEntity,
    summary: string,
    change?: { before?: string; after?: string }
  ) => void;
}) {
  const [month, setMonth] = useState(`${year}-01`);
  const [openEmployee, setOpenEmployee] = useState<string | null>(null);

  // إدخال الاستثناء: موظف + مدى تاريخي + حالة
  const [bulk, setBulk] = useState({
    employeeId: "",
    from: "",
    to: "",
    status: "غياب بدون عذر" as AttendanceStatus,
    note: "",
  });
  const [message, setMessage] = useState("");

  /*
    تعبئة فترةٍ ماضية كاملة: الحضور كان ورقياً، والنظام يبدأ يومياً بعد
    أيام. فتُملأ الأيام الناقصة «حاضراً» ويُترك المسجَّل كما هو — فما
    سُجّل من غيابٍ أو مرضيةٍ أو إجازة هو الاستثناء الذي لا يُمسّ.
  */
  const [fillFrom, setFillFrom] = useState("");
  const [fillTo, setFillTo] = useState("");
  const [fillWho, setFillWho] = useState<string[]>([]);
  /* من يُسجَّل حضوره اليوم — فارغٌ يعني الجميع */
  const [todayWho, setTodayWho] = useState<string[]>([]);

  const active = employees.filter((e) => e.active);
  const days = useMemo(() => monthDays(month), [month]);
  /* بتوقيت الكويت — فمن سجّل بعد منتصف الليل سجّل ليومه */
  const today = todayISO();
  const doneToday = active.filter((e) =>
    attendance.some((r) => r.employeeId === e.id && r.date === today)
  ).length;

  /** سجلات الشهر مفهرسة: موظف|تاريخ */
  const index = useMemo(() => {
    const map = new Map<string, AttendanceDay>();
    for (const record of attendance) {
      if (record.date.startsWith(month)) {
        map.set(`${record.employeeId}|${record.date}`, record);
      }
    }
    return map;
  }, [attendance, month]);

  const monthFilled = index.size > 0;

  /**
   * تعبئة الشهر: الأصل أن الجميع حاضرون، وأيام الراحة تُعلَّم تلقائياً.
   * ثم تُسجَّل الاستثناءات وحدها — أوفق لواقع الحضور الورقي.
   */
  const fillMonth = () => {
    if (
      monthFilled &&
      !window.confirm(
        `الشهر ${monthLabel(month)} مسجَّل جزئياً. التعبئة ستضيف الأيام الناقصة فقط ولن تغيّر المسجَّل. متابعة؟`
      )
    ) {
      return;
    }

    const additions: AttendanceDay[] = [];
    for (const employee of active) {
      for (const date of days) {
        /*
          لا يُملأ غدٌ لم يأتِ: الشهر الجاري يُملأ إلى اليوم وحده، وإلا
          صار في الدفاتر حضورٌ لأيامٍ لم تقع بعد.
        */
        if (date > today) continue;
        if (employee.hireDate && date < employee.hireDate) continue;
        if (employee.endDate && date > employee.endDate) continue;
        if (index.has(`${employee.id}|${date}`)) continue;
        const rest = dayName(date) === employee.restDay;
        additions.push({
          id: newId(),
          employeeId: employee.id,
          date,
          status: rest ? "راحة أسبوعية" : "حاضر",
          hours: rest ? 0 : settings.dailyHours,
          overtimeHours: 0,
          restDayHours: 0,
          holidayHours: 0,
          note: "",
        });
      }
    }

    if (additions.length === 0) {
      setMessage("الشهر مسجَّل بالكامل — لا شيء لإضافته");
      return;
    }
    setAttendance((prev) => [...prev, ...additions]);
    onLog(
      "إنشاء",
      "بيانات النظام",
      `تعبئة حضور ${monthLabel(month)} — ${additions.length} يوماً لـ ${active.length} موظفاً`
    );
    setMessage(`أُضيف ${additions.length} يوماً`);
  };

  /*
    حضورٌ خارج مدّة الخدمة: يقع حين يُملأ الحضور لموظفٍ بلا تاريخ تعيين
    ثم يُسجَّل تاريخه بعد ذلك. فتبقى أيامٌ قبل التحاقه — تُفسد نهاية
    خدمته ومسيّر شهرها لو رُحّل.
  */
  const outsideService = useMemo(
    () =>
      attendance.filter((r) => {
        const e = employees.find((x) => x.id === r.employeeId);
        if (!e) return false;
        if (e.hireDate && r.date < e.hireDate) return true;
        if (e.endDate && r.date > e.endDate) return true;
        return false;
      }),
    [attendance, employees]
  );

  const cleanOutside = () => {
    if (outsideService.length === 0) return;
    const names = [...new Set(outsideService.map((r) => employees.find((e) => e.id === r.employeeId)?.name ?? "?"))];
    if (
      !window.confirm(
        `حذف ${outsideService.length} يوماً مسجَّلاً خارج مدّة الخدمة؟\n\n${names.join("، ")}\n\nهي أيامٌ قبل تاريخ التعيين أو بعد انتهاء الخدمة، ولا تُحذف غيرها.`
      )
    ) {
      return;
    }
    const ids = new Set(outsideService.map((r) => r.id));
    setAttendance((prev) => prev.filter((r) => !ids.has(r.id)));
    onLog(
      "حذف",
      "بيانات النظام",
      `حذف ${outsideService.length} يوم حضورٍ خارج مدّة الخدمة`,
      { after: names.join("، ") }
    );
    setMessage(`حُذف ${outsideService.length} يوماً خارج مدّة الخدمة`);
  };

  /** أشهرٌ متتابعة من «من» إلى «إلى» */
  /**
   * حضور اليوم بضغطةٍ واحدة.
   *
   * التسجيل اليومي هو العمل الدائم، وتعبئةُ الشهر إنما كانت للفترة
   * الورقية الماضية. ولو لزم أن يُدخَل أحدَ عشرَ موظفاً واحداً واحداً
   * كل صباح لتُرك التسجيل بعد أسبوع.
   *
   * فالأصل أن الجميع حاضرون: تُضغط ضغطةً فيُسجَّل من على رأس العمل —
   * كلُّهم أو من يُختار — ثم تُسجَّل الاستثناءات وحدها. ولا يُمسّ يومٌ
   * سُجّل، فمن غاب اليوم وسُجّل غيابه يبقى غائباً.
   */
  const fillToday = () => {
    const chosen =
      todayWho.length > 0 ? active.filter((e) => todayWho.includes(e.id)) : active;
    if (chosen.length === 0) {
      setMessage("لا موظفين مختارين");
      return;
    }

    const taken = new Set(attendance.map((r) => `${r.employeeId}|${r.date}`));
    const additions: AttendanceDay[] = [];
    let outside = 0;
    let already = 0;

    for (const employee of chosen) {
      if (employee.hireDate && today < employee.hireDate) {
        outside++;
        continue;
      }
      if (employee.endDate && today > employee.endDate) {
        outside++;
        continue;
      }
      if (taken.has(`${employee.id}|${today}`)) {
        already++;
        continue;
      }
      const rest = dayName(today) === employee.restDay;
      additions.push({
        id: newId(),
        employeeId: employee.id,
        date: today,
        status: rest ? "راحة أسبوعية" : "حاضر",
        hours: rest ? 0 : settings.dailyHours,
        overtimeHours: 0,
        restDayHours: 0,
        holidayHours: 0,
        note: "",
      });
    }

    if (additions.length === 0) {
      setMessage(
        already > 0
          ? `حضور اليوم مسجَّل — ${already} موظفاً، ولا شيء لإضافته`
          : "لا أحد على رأس العمل اليوم"
      );
      return;
    }

    setAttendance((prev) => [...prev, ...additions]);
    onLog(
      "إنشاء",
      "بيانات النظام",
      `حضور اليوم ${today} — ${additions.length} موظفاً`,
      {
        after:
          todayWho.length > 0
            ? additions
                .map((a) => active.find((e) => e.id === a.employeeId)?.name ?? "")
                .join("، ")
            : "كل الموظفين على رأس العمل",
      }
    );
    setMessage(
      `سُجّل حضور اليوم لـ ${additions.length} موظفاً` +
        (already > 0 ? ` · ${already} كان مسجَّلاً` : "") +
        (outside > 0 ? ` · ${outside} خارج مدّة الخدمة` : "")
    );
  };

  const monthsBetween = (from: string, to: string): string[] => {
    const list: string[] = [];
    const [fy, fm] = from.split("-").map(Number);
    const [ty, tm] = to.split("-").map(Number);
    if (!fy || !fm || !ty || !tm) return list;
    for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); ) {
      list.push(`${y}-${String(m).padStart(2, "0")}`);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      if (list.length > 120) break;
    }
    return list;
  };

  /**
   * يملأ الأيام الناقصة في فترةٍ كاملة.
   *
   * ولا يمسّ يوماً مسجَّلاً، ولا يملأ قبل تاريخ التعيين ولا بعد اليوم،
   * ويعلّم يوم راحة كل موظف بيوم راحته هو.
   */
  const fillRange = () => {
    if (!fillFrom || !fillTo) {
      setMessage("اختر شهر البداية وشهر النهاية");
      return;
    }
    if (fillTo < fillFrom) {
      setMessage("شهر النهاية قبل شهر البداية");
      return;
    }

    const chosen = fillWho.length > 0
      ? active.filter((e) => fillWho.includes(e.id))
      : active;
    if (chosen.length === 0) {
      setMessage("لا موظفين مختارين");
      return;
    }

    /* المسجَّل كلّه — لا الشهر المعروض وحده */
    const taken = new Set(attendance.map((r) => `${r.employeeId}|${r.date}`));
    const today = todayISO();
    const additions: AttendanceDay[] = [];

    for (const month of monthsBetween(fillFrom, fillTo)) {
      for (const date of monthDays(month)) {
        if (date > today) continue;
        for (const employee of chosen) {
          if (employee.hireDate && date < employee.hireDate) continue;
          if (employee.endDate && date > employee.endDate) continue;
          if (taken.has(`${employee.id}|${date}`)) continue;
          const rest = dayName(date) === employee.restDay;
          additions.push({
            id: newId(),
            employeeId: employee.id,
            date,
            status: rest ? "راحة أسبوعية" : "حاضر",
            hours: rest ? 0 : settings.dailyHours,
            overtimeHours: 0,
            restDayHours: 0,
            holidayHours: 0,
            note: "",
          });
        }
      }
    }

    if (additions.length === 0) {
      setMessage("لا يوم ناقصاً في هذه الفترة — المسجَّل كما هو");
      return;
    }
    if (
      !window.confirm(
        `تعبئة ${additions.length} يوماً لـ ${chosen.length} موظفاً من ${fillFrom} إلى ${fillTo}؟\n\nتُملأ الأيام الناقصة «حاضراً» ويوم الراحة «راحة أسبوعية». ولا يتغيّر يومٌ مسجَّل — فالغياب والمرضية والإجازة تبقى كما هي.`
      )
    ) {
      return;
    }

    setAttendance((prev) => [...prev, ...additions]);
    onLog(
      "إنشاء",
      "بيانات النظام",
      `تعبئة حضور من ${fillFrom} إلى ${fillTo} — ${additions.length} يوماً لـ ${chosen.length} موظفاً`,
      {
        after:
          fillWho.length > 0
            ? chosen.map((e) => e.name).join("، ")
            : "كل الموظفين على رأس العمل",
      }
    );
    setMessage(`أُضيف ${additions.length} يوماً لـ ${chosen.length} موظفاً`);
  };

  const applyBulk = () => {
    if (!bulk.employeeId || !bulk.from) {
      setMessage("اختر الموظف وتاريخ البداية");
      return;
    }
    const to = bulk.to || bulk.from;
    const range = days.filter((d) => d >= bulk.from && d <= to);
    if (range.length === 0) {
      setMessage("المدى خارج الشهر المعروض");
      return;
    }

    setAttendance((prev) => {
      const next = [...prev];
      for (const date of range) {
        const key = `${bulk.employeeId}|${date}`;
        const at = next.findIndex(
          (r) => r.employeeId === bulk.employeeId && r.date === date
        );
        const record: AttendanceDay = {
          id: at >= 0 ? next[at].id : newId(),
          employeeId: bulk.employeeId,
          date,
          status: bulk.status,
          hours: bulk.status === "حاضر" ? settings.dailyHours : 0,
          overtimeHours: 0,
          restDayHours: 0,
          holidayHours: 0,
          note: bulk.note.trim(),
        };
        if (at >= 0) next[at] = record;
        else next.push(record);
      }
      return next;
    });

    const who = employees.find((e) => e.id === bulk.employeeId)?.name ?? "";
    onLog(
      "تعديل",
      "بيانات النظام",
      `حضور ${who} — ${bulk.status} من ${bulk.from} إلى ${to} (${range.length} يوم)`
    );
    setMessage(`سُجّل ${range.length} يوماً`);
    setBulk({ ...bulk, from: "", to: "", note: "" });
  };

  const patchDay = (
    employeeId: string,
    date: string,
    patch: Partial<AttendanceDay>
  ) =>
    setAttendance((prev) => {
      const at = prev.findIndex(
        (r) => r.employeeId === employeeId && r.date === date
      );
      if (at < 0) {
        return [
          ...prev,
          {
            id: newId(),
            employeeId,
            date,
            status: "حاضر",
            hours: settings.dailyHours,
            overtimeHours: 0,
            restDayHours: 0,
            holidayHours: 0,
            note: "",
            ...patch,
          },
        ];
      }
      return prev.map((r, i) => (i === at ? { ...r, ...patch } : r));
    });

  /** ملخص الشهر لكل موظف */
  const summary = (employee: Employee) => {
    const records = days
      .map((d) => index.get(`${employee.id}|${d}`))
      .filter((r): r is AttendanceDay => !!r);

    /*
      «غير مسجّل» هو ما يُنتظر تسجيله، لا كلُّ يومٍ بلا سجل. فمن لم
      يلتحق بعدُ لا يُنتظر حضوره، ومن انتهت خدمته كذلك، والغد لم يأتِ.
      ولولا هذا لظهر لمن عُيّن هذا العام شهرٌ كاملٌ «غير مسجّل» في السنة
      الماضية — فيُظنّ نقصاً وهو ليس بنقص.
    */
    const due = days.filter(
      (d) =>
        d <= today &&
        (!employee.hireDate || d >= employee.hireDate) &&
        (!employee.endDate || d <= employee.endDate)
    );
    const idle =
      due.length > 0
        ? ""
        : employee.hireDate && days[days.length - 1] < employee.hireDate
          ? "قبل التعيين"
          : employee.endDate && days[0] > employee.endDate
            ? "بعد الخدمة"
            : "لم يأتِ بعد";

    return {
      due: due.length,
      idle,
      records,
      present: records.filter((r) => r.status === "حاضر").length,
      absent: records.filter((r) => r.status === "غياب بدون عذر").length,
      excused: records.filter((r) => r.status === "غياب بعذر").length,
      annual: records.filter((r) => r.status === "إجازة سنوية").length,
      sick: records.filter((r) => r.status === "إجازة مرضية").length,
      overtime: round3(records.reduce((s, r) => s + r.overtimeHours, 0)),
      restDay: round3(records.reduce((s, r) => s + r.restDayHours, 0)),
      holiday: round3(records.reduce((s, r) => s + r.holidayHours, 0)),
      missing: due.filter((d) => !index.has(`${employee.id}|${d}`)).length,
    };
  };

  const months = Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`
  );

  if (active.length === 0) {
    return (
      <Panel title="الحضور والانصراف">
        <Empty>لا يوجد موظفون على رأس العمل — أضفهم من «الموظفون» أولاً</Empty>
      </Panel>
    );
  }

  return (
    <>
      <Panel
        title="الحضور والانصراف"
        subtitle="الأصل أن الجميع حاضرون — سجّل الاستثناءات وحدها"
      >
        <div className="mb-5 flex flex-wrap items-end gap-3">
          <Field label="الشهر">
            <select
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setMessage("");
              }}
              className={inputClass}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </Field>
          <button
            onClick={fillMonth}
            className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
          >
            تعبئة الشهر حضوراً
          </button>
          {monthFilled && (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    `حذف كل سجلات حضور ${monthLabel(month)}؟ لا يمكن التراجع.`
                  )
                ) {
                  setAttendance((prev) =>
                    prev.filter((r) => !r.date.startsWith(month))
                  );
                  onLog("حذف", "بيانات النظام", `سجلات حضور ${monthLabel(month)}`);
                  setMessage("حُذفت سجلات الشهر");
                }
              }}
              className="rounded-lg bg-red-50 px-5 py-3 font-bold text-red-700"
            >
              مسح الشهر
            </button>
          )}
          <span className="text-sm text-slate-500">
            {index.size} سجل · {days.length} يوماً · {active.length} موظفاً
          </span>
        </div>

        {message && (
          <p className="mb-4 text-sm font-medium text-green-700">{message}</p>
        )}

        {outsideService.length > 0 && (
          <Banner tone="warn">
            <b>{outsideService.length}</b> يوم حضورٍ مسجَّل خارج مدّة الخدمة —
            قبل تاريخ التعيين أو بعد انتهائها:{" "}
            {[
              ...new Set(
                outsideService.map(
                  (r) => employees.find((e) => e.id === r.employeeId)?.name ?? "?"
                )
              ),
            ].join("، ")}
            .
            <button
              onClick={cleanOutside}
              className="mr-3 rounded-lg bg-white px-3 py-1 font-bold text-amber-900 underline"
            >
              احذفها
            </button>
          </Banner>
        )}

        {/* حضور اليوم — العمل الدائم، بضغطة */}
        <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">
              حضور اليوم — {dayName(today)} {today}
            </p>
            <span className="text-sm text-slate-600">
              {doneToday} من {active.length} مسجَّلون
            </span>
          </div>
          <p className="mb-3 text-sm text-slate-600">
            الأصل أن الجميع حاضرون: سجّلهم بضغطة ثم سجّل الاستثناءات وحدها من
            اللوحة أدناه. <b>ولا يتغيّر من سُجّل اليوم</b> — ولا يُسجَّل من كان
            خارج مدّة خدمته.
          </p>
          <Field
            label="من يُسجَّل"
            hint={
              todayWho.length === 0
                ? `الكل — ${active.length} موظفاً على رأس العمل`
                : `${todayWho.length} مختارين`
            }
          >
            <div className="flex flex-wrap gap-2 rounded-lg border border-slate-300 bg-white p-2">
              <button
                onClick={() => setTodayWho([])}
                className={`rounded-lg px-3 py-1 text-sm ${
                  todayWho.length === 0
                    ? "bg-emerald-600 font-bold text-white"
                    : "bg-slate-100"
                }`}
              >
                الكل
              </button>
              {active.map((e) => (
                <button
                  key={e.id}
                  onClick={() =>
                    setTodayWho((prev) =>
                      prev.includes(e.id)
                        ? prev.filter((x) => x !== e.id)
                        : [...prev, e.id]
                    )
                  }
                  className={`rounded-lg px-3 py-1 text-sm ${
                    todayWho.includes(e.id)
                      ? "bg-emerald-600 font-bold text-white"
                      : "bg-slate-100"
                  }`}
                >
                  {e.name}
                </button>
              ))}
            </div>
          </Field>
          <button
            onClick={fillToday}
            className="mt-3 rounded-lg bg-emerald-600 px-6 py-3 font-bold text-white"
          >
            سجّل حضور اليوم
          </button>
        </div>

        {/* تعبئة فترة ماضية — قبل أن يبدأ التسجيل اليومي */}
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="mb-1 font-bold">تعبئة فترة كاملة حضوراً</p>
          <p className="mb-3 text-sm text-slate-600">
            للفترة الماضية التي كان حضورها ورقياً: تُملأ الأيام الناقصة
            «حاضراً»، ويوم راحة كل موظف «راحة أسبوعية».{" "}
            <b>ولا يتغيّر يومٌ مسجَّل</b> — فالغياب والمرضية والإجازة المسجَّلة
            تبقى كما هي. ولا يُملأ قبل تاريخ التعيين ولا بعد اليوم.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Field label="من شهر">
              <input
                type="month"
                value={fillFrom}
                onChange={(e) => setFillFrom(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="إلى شهر">
              <input
                type="month"
                value={fillTo}
                onChange={(e) => setFillTo(e.target.value)}
                className={inputClass}
              />
            </Field>
            <div className="md:col-span-2">
              <Field
                label="الموظفون"
                hint={
                  fillWho.length === 0
                    ? `الكل — ${active.length} موظفاً على رأس العمل`
                    : `${fillWho.length} مختارين`
                }
              >
                <div className="flex flex-wrap gap-2 rounded-lg border border-slate-300 bg-white p-2">
                  <button
                    onClick={() => setFillWho([])}
                    className={`rounded-lg px-3 py-1 text-sm ${
                      fillWho.length === 0
                        ? "bg-blue-600 font-bold text-white"
                        : "bg-slate-100"
                    }`}
                  >
                    الكل
                  </button>
                  {active.map((e) => (
                    <button
                      key={e.id}
                      onClick={() =>
                        setFillWho((prev) =>
                          prev.includes(e.id)
                            ? prev.filter((x) => x !== e.id)
                            : [...prev, e.id]
                        )
                      }
                      className={`rounded-lg px-3 py-1 text-sm ${
                        fillWho.includes(e.id)
                          ? "bg-blue-600 font-bold text-white"
                          : "bg-slate-100"
                      }`}
                    >
                      {e.name}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </div>
          <button
            onClick={fillRange}
            className="mt-3 rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
          >
            املأ الفترة حضوراً
          </button>
        </div>

        {/* تسجيل استثناء */}
        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 font-bold">تسجيل استثناء</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <Field label="الموظف">
              <select
                value={bulk.employeeId}
                onChange={(e) => setBulk({ ...bulk, employeeId: e.target.value })}
                className={inputClass}
              >
                <option value="">اختر الموظف</option>
                {active.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الحالة">
              <select
                value={bulk.status}
                onChange={(e) =>
                  setBulk({ ...bulk, status: e.target.value as AttendanceStatus })
                }
                className={inputClass}
              >
                {ATTENDANCE_STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="من تاريخ">
              <input
                type="date"
                value={bulk.from}
                onChange={(e) => setBulk({ ...bulk, from: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="إلى تاريخ" hint="اتركه فارغاً ليوم واحد">
              <input
                type="date"
                value={bulk.to}
                onChange={(e) => setBulk({ ...bulk, to: e.target.value })}
                className={inputClass}
              />
            </Field>
            <div className="flex items-end pb-1">
              <button
                onClick={applyBulk}
                className="w-full rounded-lg bg-slate-900 px-5 py-3 font-bold text-white"
              >
                تسجيل
              </button>
            </div>
          </div>
          <div className="mt-3">
            <Field label="ملاحظة">
              <input
                type="text"
                value={bulk.note}
                onChange={(e) => setBulk({ ...bulk, note: e.target.value })}
                placeholder="سبب الغياب أو الإجازة"
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        {/* ملخص الشهر */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100">
              <tr>
                <Th>الموظف</Th>
                <Th>حاضر</Th>
                <Th>غياب بعذر</Th>
                <Th>غياب بدون عذر</Th>
                <Th>سنوية</Th>
                <Th>مرضية</Th>
                <Th>إضافي</Th>
                <Th>راحة</Th>
                <Th>عطلة</Th>
                <Th>غير مسجّل</Th>
              </tr>
            </thead>
            <tbody>
              {active.map((employee) => {
                const s = summary(employee);
                return (
                  <tr key={employee.id} className="border-b border-slate-200">
                    <Td>
                      <button
                        onClick={() =>
                          setOpenEmployee(
                            openEmployee === employee.id ? null : employee.id
                          )
                        }
                        className="font-bold text-blue-700 hover:underline"
                      >
                        {employee.name}
                      </button>
                    </Td>
                    <Td>{s.present}</Td>
                    <Td>{s.excused || "—"}</Td>
                    <Td className={s.absent ? "font-bold text-red-600" : ""}>
                      {s.absent || "—"}
                    </Td>
                    <Td>{s.annual || "—"}</Td>
                    <Td>{s.sick || "—"}</Td>
                    <Td className={s.overtime ? "font-bold" : ""}>
                      {s.overtime || "—"}
                    </Td>
                    <Td>{s.restDay || "—"}</Td>
                    <Td>{s.holiday || "—"}</Td>
                    <Td
                      className={
                        s.missing ? "font-bold text-amber-700" : "text-slate-300"
                      }
                    >
                      {s.idle ? (
                        <span className="text-xs text-slate-400">{s.idle}</span>
                      ) : (
                        s.missing || "—"
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {openEmployee && (
        <Panel
          title={`كشف حضور — ${
            employees.find((e) => e.id === openEmployee)?.name ?? ""
          }`}
          subtitle={monthLabel(month)}
        >
          <button
            onClick={() => setOpenEmployee(null)}
            className="mb-4 text-sm text-slate-500 hover:underline no-print"
          >
            إغلاق الكشف
          </button>

          <div className="max-h-[34rem] overflow-auto">
            <table className="w-full text-right text-sm">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  <Th>التاريخ</Th>
                  <Th>اليوم</Th>
                  <Th>الحالة</Th>
                  <Th>ساعات</Th>
                  <Th>إضافي</Th>
                  <Th>راحة</Th>
                  <Th>عطلة</Th>
                  <Th>ملاحظة</Th>
                </tr>
              </thead>
              <tbody>
                {days.map((date) => {
                  const record = index.get(`${openEmployee}|${date}`);
                  const status = record?.status ?? "حاضر";
                  return (
                    <tr
                      key={date}
                      className={`border-b border-slate-100 ${
                        record ? "" : "opacity-50"
                      }`}
                    >
                      <Td>{date}</Td>
                      <Td>{dayName(date)}</Td>
                      <Td>
                        <select
                          value={status}
                          onChange={(e) =>
                            patchDay(openEmployee, date, {
                              status: e.target.value as AttendanceStatus,
                              hours:
                                e.target.value === "حاضر" ? settings.dailyHours : 0,
                            })
                          }
                          className={`rounded px-2 py-1 ${
                            STATUS_TONE[status] ?? ""
                          }`}
                        >
                          {ATTENDANCE_STATUSES.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </Td>
                      {(
                        [
                          ["hours", record?.hours ?? 0],
                          ["overtimeHours", record?.overtimeHours ?? 0],
                          ["restDayHours", record?.restDayHours ?? 0],
                          ["holidayHours", record?.holidayHours ?? 0],
                        ] as [keyof AttendanceDay, number][]
                      ).map(([key, value]) => (
                        <Td key={String(key)}>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={value}
                            onChange={(e) =>
                              patchDay(openEmployee, date, {
                                [key]: Number(e.target.value) || 0,
                              })
                            }
                            className="w-20 rounded border border-slate-200 px-2 py-1"
                          />
                        </Td>
                      ))}
                      <Td>
                        <input
                          type="text"
                          value={record?.note ?? ""}
                          onChange={(e) =>
                            patchDay(openEmployee, date, { note: e.target.value })
                          }
                          className="w-full rounded border border-slate-200 px-2 py-1"
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-sm text-slate-500">
            الأيام الباهتة غير مسجّلة بعد — أي تعديل عليها يُنشئ سجلها.
          </p>
        </Panel>
      )}
    </>
  );
}
/* ================================================================== */
/* مسيّر الرواتب                                                       */
/* ================================================================== */

function PayrollPage({
  employees,
  attendance,
  movements,
  settings,
  runs,
  year,
  yearLocks,
  canRun,
  currentUserName,
  nextEntryNo,
  setRuns,
  onPost,
  onPayslip,
  onLog,
}: {
  employees: Employee[];
  attendance: AttendanceDay[];
  /** كل الحركات — منها يُقرأ رصيد سلفة كل موظف */
  movements: Movement[];
  settings: PayrollSettings;
  runs: PayrollRun[];
  year: number;
  yearLocks: YearLocks;
  canRun: boolean;
  currentUserName: string;
  nextEntryNo: number;
  setRuns: Dispatch<SetStateAction<PayrollRun[]>>;
  onPost: (run: PayrollRun, movements: Movement[]) => void;
  onPayslip: (run: PayrollRun, line: PayrollLine) => void;
  onLog: (
    action: AuditAction,
    entity: AuditEntity,
    summary: string,
    change?: { before?: string; after?: string }
  ) => void;
}) {
  const [month, setMonth] = useState(`${year}-01`);
  const [deductions, setDeductions] = useState<Record<string, string>>({});
  /*
    سداد السلفة غير «الخصومات الأخرى»: تلك جزاءٌ يُنقص المصروف، وهذا
    استردادُ مالٍ سُلّم سلفاً — يُقفل به حساب سلف الموظفين ويبقى الراتب
    مصروفاً بكامله. فله خانته وقيده.
  */
  const [advances, setAdvances] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const months = Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`
  );

  /*
    رصيد سلفة كل موظف كما في الدفاتر: يُبحث بالاسم لأن قيود السلف تحمل
    اسم الموظف في خانة «الدافع/المستلم» لا معرّفه. فيُعرض ليُخصم منه،
    ولا يُخصم من تلقائه — القرار لصاحبه.
  */
  const advanceBalance = useMemo(() => {
    const balances = new Map<string, number>();
    for (const m of movements) {
      if (m.approval !== "معتمدة") continue;
      const person = (m.person || "").trim();
      if (!person) continue;
      const sign =
        m.debitCode === EMPLOYEE_ADVANCE_ACCOUNT
          ? 1
          : m.creditCode === EMPLOYEE_ADVANCE_ACCOUNT
            ? -1
            : 0;
      if (sign === 0) continue;
      balances.set(person, round3((balances.get(person) ?? 0) + sign * m.amount));
    }
    return balances;
  }, [movements]);

  const existing = runs.find((r) => r.month === month) ?? null;
  const locked = isYearClosed(yearLocks, year);
  const active = employees.filter((e) => e.active);

  /** يحسب سطور الشهر من الحضور المسجَّل */
  const computed = useMemo(() => {
    return active.map((employee) => {
      const own = attendance.filter(
        (a) => a.employeeId === employee.id && a.date.startsWith(month)
      );
      // الإضافي السابق في نفس السنة، لفحص الحد السنوي
      const priorOvertime = attendance
        .filter(
          (a) =>
            a.employeeId === employee.id &&
            a.date.slice(0, 4) === String(year) &&
            a.date < `${month}-01`
        )
        .reduce((s, a) => s + a.overtimeHours, 0);

      return computePayrollLine({
        employee,
        attendance: own,
        settings,
        otherDeductions: Number(deductions[employee.id]) || 0,
        advanceDeduction: Number(advances[employee.id]) || 0,
        yearOvertimeHours: priorOvertime,
      });
    });
  }, [active, attendance, month, settings, deductions, advances, year]);

  const lines = existing ? existing.lines : computed;
  const totals = payrollTotals(lines);
  const attendanceMissing = active.filter(
    (e) =>
      attendance.filter(
        (a) => a.employeeId === e.id && a.date.startsWith(month)
      ).length === 0
  );

  /* ---------------- الإجراءات ---------------- */

  const createRun = () => {
    const run: PayrollRun = {
      id: newId(),
      month,
      fiscalYear: year,
      status: "مسودة",
      createdAt: new Date().toISOString(),
      createdBy: currentUserName,
      approvedAt: "",
      approvedBy: "",
      postedMovementIds: [],
      lines: computed,
      deductions: Object.fromEntries(
        Object.entries(deductions).map(([k, v]) => [k, Number(v) || 0])
      ),
      advanceDeductions: Object.fromEntries(
        Object.entries(advances)
          .map(([k, v]) => [k, Number(v) || 0])
          .filter(([, v]) => (v as number) > 0)
      ),
      note: "",
    };
    setRuns((prev) => [...prev, run]);
    onLog(
      "إنشاء",
      "بيانات النظام",
      `مسيّر رواتب ${monthLabel(month)} — ${computed.length} موظفاً · صافي ${fmt(
        payrollTotals(computed).net
      )} د.ك`
    );
    setMessage("أُنشئ المسيّر كمسودة — راجعه ثم اعتمده");
  };

  const approve = () => {
    if (!existing) return;
    setRuns((prev) =>
      prev.map((r) =>
        r.id === existing.id
          ? {
              ...r,
              status: "معتمد",
              approvedAt: new Date().toISOString(),
              approvedBy: currentUserName,
            }
          : r
      )
    );
    onLog("اعتماد", "بيانات النظام", `مسيّر رواتب ${monthLabel(month)}`);
    setMessage("اعتُمد المسيّر — يمكنك ترحيله الآن");
  };

  /**
   * الترحيل: قيد لكل موظف — من حـ/مصروف الأجر إلى حـ/الصندوق أو البنك.
   * حساب المصروف يؤخذ من ملف الموظف، فمكافأة الشريك لا تُقيَّد رواتبَ.
   */
  const post = () => {
    if (!existing || existing.status !== "معتمد") return;

    const last = `${month}-${new Date(
      Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)
    ).getUTCDate()}`;

    const movements: Movement[] = [];
    let no = nextEntryNo;

    for (const line of existing.lines) {
      const employee = employees.find((e) => e.id === line.employeeId);
      if (!employee) continue;

      if (line.net > 0)
      movements.push({
        id: newId(),
        entryNo: no++,
        fiscalYear: year,
        date: last,
        movementType: "مصروف",
        description: `راتب ${monthLabel(month)} — ${line.employeeName}`,
        itemCode: "",
        itemName: "رواتب",
        debitCode: wageAccountOf(employee),
        creditCode: "1112",
        amount: line.net,
        project: employee.project,
        person: line.employeeName,
        paymentMethod: "تحويل بنكي",
        party: line.employeeName,
        source: "app",
        /*
         * المسيّر اعتُمد قبل الترحيل، فقيوده تدخل الدفاتر معتمدة — ولا
         * معنى لاعتماد الشيء مرتين.
         */
        approval: "معتمدة",
        approvedBy: currentUserName,
        approvedAt: new Date().toISOString(),
        approvalNote: `مرحّل من مسيّر رواتب ${monthLabel(month)}`,
      });

      /*
        سداد السلفة قيدٌ ثانٍ: الراتب مصروفٌ بكامله، والمسدَّد منه يُقفل
        حساب السلف. ولو رُحّل الصافي وحده لظهر الراتب ناقصاً في الدفاتر
        وبقيت السلفة مفتوحةً في الميزانية أبداً.
      */
      const advance = round3(line.advanceDeduction || 0);
      if (advance > 0) {
        movements.push({
          id: newId(),
          entryNo: no++,
          fiscalYear: year,
          date: last,
          movementType: "سداد سلفة",
          description: `سداد سلفة من راتب ${monthLabel(month)} — ${line.employeeName}`,
          itemCode: "",
          itemName: "سلف وعهد الموظفين",
          debitCode: wageAccountOf(employee),
          creditCode: EMPLOYEE_ADVANCE_ACCOUNT,
          amount: advance,
          project: employee.project,
          person: line.employeeName,
          paymentMethod: "",
          party: line.employeeName,
          source: "app",
          approval: "معتمدة",
          approvedBy: currentUserName,
          approvedAt: new Date().toISOString(),
          approvalNote: `مرحّل من مسيّر رواتب ${monthLabel(month)}`,
        });
      }
    }

    if (movements.length === 0) {
      setMessage("لا توجد صافي رواتب للترحيل");
      return;
    }

    if (
      !window.confirm(
        `ترحيل ${movements.length} قيداً بإجمالي ${fmt(
          round3(movements.reduce((s, m) => s + m.amount, 0))
        )} د.ك إلى الحسابات؟\n\nالقيود تُنشأ بتاريخ ${last} وتُصرف من البنك.`
      )
    ) {
      return;
    }

    setRuns((prev) =>
      prev.map((r) =>
        r.id === existing.id
          ? {
              ...r,
              status: "مرحّل",
              postedMovementIds: movements.map((m) => m.id),
            }
          : r
      )
    );
    onPost(existing, movements);
    setMessage(`رُحّل ${movements.length} قيداً`);
  };

  const deleteRun = () => {
    if (!existing) return;
    if (
      existing.status === "مرحّل" &&
      !window.confirm(
        "المسيّر مرحّل وله قيود في الحسابات. حذفه لا يحذف القيود — احذفها من جدول الحركات أولاً. متابعة؟"
      )
    ) {
      return;
    }
    setRuns((prev) => prev.filter((r) => r.id !== existing.id));
    onLog("حذف", "بيانات النظام", `مسيّر رواتب ${monthLabel(month)}`);
    setMessage("حُذف المسيّر");
  };

  if (active.length === 0) {
    return (
      <Panel title="مسيّر الرواتب">
        <Empty>لا يوجد موظفون على رأس العمل</Empty>
      </Panel>
    );
  }

  const statusTone =
    existing?.status === "مرحّل"
      ? "bg-green-100 text-green-800"
      : existing?.status === "معتمد"
      ? "bg-blue-100 text-blue-800"
      : "bg-amber-100 text-amber-900";

  return (
    <>
      <Panel
        title="مسيّر الرواتب"
        subtitle="يُحسب من الحضور المسجَّل — راجع ثم اعتمد ثم رحّل"
      >
        <div className="mb-5 flex flex-wrap items-end gap-3 no-print">
          <Field label="الشهر">
            <select
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setMessage("");
              }}
              className={inputClass}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </Field>

          {existing ? (
            <>
              <span
                className={`rounded-lg px-4 py-2 font-bold ${statusTone}`}
              >
                {existing.status}
              </span>
              {existing.status === "مسودة" && canRun && (
                <button
                  onClick={approve}
                  className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white"
                >
                  اعتماد المسيّر
                </button>
              )}
              {existing.status === "معتمد" && canRun && (
                <button
                  onClick={post}
                  disabled={locked}
                  title={locked ? "السنة مقفلة" : ""}
                  className="rounded-lg bg-green-600 px-6 py-3 font-bold text-white disabled:bg-slate-300"
                >
                  ترحيل إلى الحسابات
                </button>
              )}
              {canRun && (
                <button
                  onClick={deleteRun}
                  className="rounded-lg bg-red-50 px-5 py-3 font-bold text-red-700"
                >
                  حذف المسيّر
                </button>
              )}
            </>
          ) : (
            canRun && (
              <button
                onClick={createRun}
                disabled={locked}
                className="rounded-lg bg-blue-600 px-6 py-3 font-bold text-white disabled:bg-slate-300"
              >
                إنشاء مسيّر {monthLabel(month)}
              </button>
            )
          )}

          <button
            onClick={() => window.print()}
            className="rounded-lg bg-slate-900 px-5 py-3 font-bold text-white"
          >
            🖨 طباعة المسيّر
          </button>
        </div>

        {locked && (
          <Banner tone="warn">
            🔒 السنة {year} مقفلة — لا يمكن إنشاء مسيّر أو ترحيله.
          </Banner>
        )}

        {attendanceMissing.length > 0 && !existing && (
          <Banner tone="warn">
            <b>{attendanceMissing.length}</b> موظفاً بلا سجل حضور في{" "}
            {monthLabel(month)} — سيُحسب راتبهم بلا أيام عمل. سجّل حضورهم أولاً
            من «الحضور والانصراف».
          </Banner>
        )}

        {existing?.status === "مرحّل" && (
          <Banner tone="ok">
            ✓ رُحّل المسيّر — {existing.postedMovementIds.length} قيداً في
            الحسابات
          </Banner>
        )}

        {message && (
          <p className="mb-4 text-sm font-medium text-green-700">{message}</p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100">
              <tr>
                <Th>الموظف</Th>
                <Th>أيام</Th>
                <Th>غياب</Th>
                <Th>الأساسي</Th>
                <Th>البدلات</Th>
                <Th>إضافي</Th>
                <Th>الإجمالي</Th>
                <Th>خصم غياب</Th>
                <Th>خصم مرضي</Th>
                <Th>تأمينات</Th>
                <Th>خصم آخر</Th>
                <Th>سداد سلفة</Th>
                <Th>الصافي</Th>
                <Th>كشف</Th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.employeeId} className="border-b border-slate-200">
                  <Td>
                    <span className="font-bold">{line.employeeName}</span>
                    {line.warnings.length > 0 && (
                      <div className="text-xs text-amber-700">
                        ⚠ {line.warnings.join(" · ")}
                      </div>
                    )}
                  </Td>
                  <Td>{line.paidDays}</Td>
                  <Td className={line.absentDays ? "font-bold text-red-600" : ""}>
                    {line.absentDays || "—"}
                  </Td>
                  <Td>
                    <Money value={line.basic} />
                  </Td>
                  <Td>{line.allowances ? fmt(line.allowances) : "—"}</Td>
                  <Td>
                    {line.overtimePay + line.restDayPay + line.holidayPay
                      ? fmt(
                          round3(
                            line.overtimePay + line.restDayPay + line.holidayPay
                          )
                        )
                      : "—"}
                  </Td>
                  <Td>
                    <Money value={line.gross} />
                  </Td>
                  <Td>{line.absenceDeduction ? fmt(line.absenceDeduction) : "—"}</Td>
                  <Td>{line.sickDeduction ? fmt(line.sickDeduction) : "—"}</Td>
                  <Td>{line.socialInsurance ? fmt(line.socialInsurance) : "—"}</Td>
                  <Td>
                    {existing ? (
                      line.otherDeductions ? (
                        fmt(line.otherDeductions)
                      ) : (
                        "—"
                      )
                    ) : (
                      <input
                        type="number"
                        step="0.001"
                        value={deductions[line.employeeId] ?? ""}
                        onChange={(e) =>
                          setDeductions((p) => ({
                            ...p,
                            [line.employeeId]: e.target.value,
                          }))
                        }
                        placeholder="0"
                        className="w-24 rounded border border-slate-300 px-2 py-1 no-print"
                      />
                    )}
                  </Td>
                  <Td>
                    {existing ? (
                      line.advanceDeduction ? (
                        fmt(line.advanceDeduction)
                      ) : (
                        "—"
                      )
                    ) : (
                      <>
                        <input
                          type="number"
                          step="0.001"
                          value={advances[line.employeeId] ?? ""}
                          onChange={(e) =>
                            setAdvances((p) => ({
                              ...p,
                              [line.employeeId]: e.target.value,
                            }))
                          }
                          placeholder="0"
                          className="w-24 rounded border border-slate-300 px-2 py-1 no-print"
                        />
                        {(advanceBalance.get(line.employeeName) ?? 0) > 0 && (
                          <div className="mt-1 text-xs text-amber-800">
                            بذمته {fmt(advanceBalance.get(line.employeeName) ?? 0)}
                            <button
                              onClick={() =>
                                setAdvances((p) => ({
                                  ...p,
                                  [line.employeeId]: String(
                                    Math.min(
                                      advanceBalance.get(line.employeeName) ?? 0,
                                      line.net
                                    )
                                  ),
                                }))
                              }
                              className="mr-2 underline no-print"
                            >
                              اخصمها
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </Td>
                  <Td>
                    <b>{fmt(line.net)}</b>
                  </Td>
                  <Td>
                    <button
                      onClick={() =>
                        existing && onPayslip(existing, line)
                      }
                      disabled={!existing}
                      className="rounded-lg bg-slate-100 px-3 py-1 no-print disabled:opacity-40"
                    >
                      🖨
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-bold">
              <tr>
                <Td colSpan={3}>الإجمالي — {totals.count} موظفاً</Td>
                <Td>{fmt(totals.basic)}</Td>
                <Td>{fmt(totals.allowances)}</Td>
                <Td>{fmt(totals.overtime)}</Td>
                <Td>{fmt(totals.gross)}</Td>
                <Td colSpan={4}>خصومات {fmt(totals.deductions)}</Td>
                <Td>{fmt(totals.net)}</Td>
                <Td>{""}</Td>
              </tr>
            </tfoot>
          </table>
        </div>

        {existing && (
          <p className="mt-4 text-sm text-slate-500">
            أُنشئ {existing.createdAt.slice(0, 10)} بواسطة {existing.createdBy}
            {existing.approvedBy &&
              ` · اعتمده ${existing.approvedBy} في ${existing.approvedAt.slice(0, 10)}`}
          </p>
        )}
      </Panel>

      {runs.filter((r) => r.fiscalYear === year).length > 0 && (
        <Panel title={`مسيّرات ${year}`}>
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100">
              <tr>
                <Th>الشهر</Th>
                <Th>الموظفون</Th>
                <Th>الإجمالي</Th>
                <Th>الخصومات</Th>
                <Th>الصافي</Th>
                <Th>الحالة</Th>
              </tr>
            </thead>
            <tbody>
              {runs
                .filter((r) => r.fiscalYear === year)
                .sort((a, b) => a.month.localeCompare(b.month))
                .map((run) => {
                  const t = payrollTotals(run.lines);
                  return (
                    <tr key={run.id} className="border-b border-slate-100">
                      <Td>
                        <button
                          onClick={() => setMonth(run.month)}
                          className="font-bold text-blue-700 hover:underline"
                        >
                          {monthLabel(run.month)}
                        </button>
                      </Td>
                      <Td>{t.count}</Td>
                      <Td>{fmt(t.gross)}</Td>
                      <Td>{fmt(t.deductions)}</Td>
                      <Td>
                        <b>{fmt(t.net)}</b>
                      </Td>
                      <Td>{run.status}</Td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}

/* ================================================================== */
/* كشف الراتب                                                          */
/* ================================================================== */

function PayslipSheet({
  run,
  line,
  employee,
  company,
  onClose,
}: {
  run: PayrollRun;
  line: PayrollLine;
  employee: Employee | undefined;
  company: CompanyProfile;
  onClose: () => void;
}) {
  const earnings: [string, number][] = [
    ["الأجر الأساسي", line.basic],
    ["البدلات", line.allowances],
    ["العمل الإضافي", line.overtimePay],
    ["العمل في يوم الراحة", line.restDayPay],
    ["العمل في العطلة الرسمية", line.holidayPay],
  ].filter(([, v]) => v !== 0) as [string, number][];

  const deductions: [string, number][] = [
    ["خصم الغياب", line.absenceDeduction],
    ["خصم الإجازة المرضية", line.sickDeduction],
    ["التأمينات الاجتماعية", line.socialInsurance],
    ["خصومات أخرى", line.otherDeductions],
  ].filter(([, v]) => v !== 0) as [string, number][];

  return (
    <div
      className="voucher-sheet fixed inset-0 z-50 overflow-auto bg-slate-800/60 p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="voucher-body designed-sheet mx-auto max-w-2xl bg-white p-10 shadow-xl"
      >
        <div className="mb-6 flex justify-end gap-3 no-print">
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-slate-900 px-6 py-3 font-bold text-white"
          >
            🖨 طباعة
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-6 py-3 font-bold"
          >
            إغلاق
          </button>
        </div>

        <div className="flex items-start justify-between border-b-4 border-slate-900 pb-4">
          <div className="flex items-center gap-4">
            {company.logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logo} alt="" style={{ height: 64 }} />
            )}
            <div>
              <div className="text-xl font-bold">{company.name}</div>
              <div className="text-xs text-slate-600">
                {[company.address, company.phone].filter(Boolean).join(" · ")}
              </div>
            </div>
          </div>
          <div className="text-left">
            <div className="rounded-lg border-2 border-slate-900 px-5 py-2 text-center">
              <div className="font-bold">كشف راتب</div>
              <div className="text-xs">PAYSLIP</div>
            </div>
            <div className="mt-2 text-sm font-bold">{monthLabel(run.month)}</div>
          </div>
        </div>

        <table className="mt-6 w-full text-right text-sm">
          <tbody>
            {(
              [
                ["اسم الموظف", line.employeeName],
                ["الرقم المدني", employee?.civilId || "—"],
                ["المسمى الوظيفي", employee?.jobTitle || "—"],
                ["نوع الأجر", line.wageType],
                ["أيام العمل المحتسبة", String(line.paidDays)],
                ["أيام الغياب", String(line.absentDays)],
              ] as [string, string][]
            ).map(([label, value]) => (
              <tr key={label} className="border-b border-slate-100">
                <td className="w-48 bg-slate-50 px-4 py-2 font-bold">{label}</td>
                <td className="px-4 py-2">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 grid grid-cols-2 gap-6">
          <div>
            <h4 className="mb-2 border-b-2 border-slate-300 pb-1 font-bold">
              المستحقات
            </h4>
            <table className="w-full text-right text-sm">
              <tbody>
                {earnings.map(([label, value]) => (
                  <tr key={label}>
                    <td className="py-1">{label}</td>
                    <td className="py-1 text-left tabular-nums">{fmt(value)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300 font-bold">
                  <td className="py-1">الإجمالي</td>
                  <td className="py-1 text-left tabular-nums">
                    {fmt(line.gross)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="mb-2 border-b-2 border-slate-300 pb-1 font-bold">
              الاستقطاعات
            </h4>
            <table className="w-full text-right text-sm">
              <tbody>
                {deductions.length === 0 ? (
                  <tr>
                    <td className="py-1 text-slate-400">لا توجد</td>
                    <td />
                  </tr>
                ) : (
                  deductions.map(([label, value]) => (
                    <tr key={label}>
                      <td className="py-1">{label}</td>
                      <td className="py-1 text-left tabular-nums">
                        {fmt(value)}
                      </td>
                    </tr>
                  ))
                )}
                <tr className="border-t-2 border-slate-300 font-bold">
                  <td className="py-1">الإجمالي</td>
                  <td className="py-1 text-left tabular-nums">
                    {fmt(line.totalDeductions)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6 flex items-stretch justify-between gap-4">
          <div className="flex-1 rounded-lg border border-slate-300 p-4">
            <div className="text-xs text-slate-500">الصافي بالحروف</div>
            <div className="mt-1 font-bold leading-relaxed">
              {amountInWords(line.net)}
            </div>
          </div>
          <div className="w-52 rounded-lg border-2 border-slate-900 p-4 text-center">
            <div className="text-xs text-slate-500">صافي المستحق</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">
              {fmt(line.net)}
            </div>
            <div className="text-sm">د.ك</div>
          </div>
        </div>

        {employee?.iban && (
          <p className="mt-4 text-sm">
            يُحوَّل إلى الآيبان: <b dir="ltr">{employee.iban}</b>
          </p>
        )}

        <div className="mt-14 grid grid-cols-2 gap-10 text-center text-sm">
          {["توقيع الموظف", "المحاسب"].map((label) => (
            <div key={label}>
              <div className="mb-2 border-b border-slate-400 pb-10" />
              <div className="font-bold">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
