/**
 * التخزين والنسخ الاحتياطي
 *
 * البيانات في localStorage (متصفح واحد). هذا الملف يعزل ذلك خلف واجهة
 * واحدة ويتكفّل بترحيل البيانات القديمة، حتى يكون الانتقال لاحقاً إلى
 * قاعدة بيانات تغييراً في مكان واحد.
 */

import {
  APPROVAL_STATES,
  Account,
  ApprovalState,
  GENERATED_CHART,
  GENERATED_ITEMS,
  GENERATED_PAYMENTS,
  InstallmentSplit,
  ItemDefinition,
  Movement,
  OpeningBalances,
  PaymentMethod,
  YearOpening,
  fiscalYearOf,
  itemAccount,
  round3,
} from "./accounting";
import { ALL_PERMISSIONS, Permission, ROLES, RoleKey } from "./permissions";
import { AUDIT_LIMIT, AuditEntry } from "./audit";
import {
  ATTENDANCE_STATUSES,
  AttendanceDay,
  AttendanceStatus,
  Employee,
  PayrollRun,
  PayrollSettings,
  defaultPayrollSettings,
} from "./payroll";
import {
  CONTRACT_DEFAULTS,
  DEFAULT_CLAUSES,
  DEFAULT_NOTES,
  DEFAULT_OBLIGATIONS,
} from "./contract-template";
import {
  QUOTATION_DEFAULTS,
  QUOTATION_STATUSES,
  Quotation,
  QuotationLine,
  QuotationStatus,
  PRICING_MODES,
  PricingMode,
  SCOPES,
  ScopeKey,
  WorkItem,
} from "./quotations";
import { SEED_WORK_ITEMS } from "./work-items-seed";
import { Invoice } from "./invoices";

export type CounterpartyType = "عميل" | "مقاول" | "مورّد";

export const COUNTERPARTY_TYPES: CounterpartyType[] = [
  "عميل",
  "مقاول",
  "مورّد",
];

/** الدفعات واردة من العميل، وصادرة إلى المقاول والمورّد */
export const isIncomingContract = (type: CounterpartyType): boolean =>
  type === "عميل";

export type Project = {
  id: string;
  name: string;
  /** قيمة العقد مع صاحب المشروع */
  budget: number;
  /** تاريخ بدء التنفيذ */
  startDate: string;
  status: string;

  /* --------------------------------------------------------------
   * تأمين الموقع على العاملين.
   *
   * لكل مشروعٍ وثيقةُ تأمينٍ على من يعمل فيه، لها مدّةٌ تنتهي. وانتهاؤها
   * وهم يعملون مسؤوليةٌ على الشركة، ولا يُعرف إلا بالسؤال — فيُسجَّل هنا
   * ويُنبَّه إليه قبل انقضائه بمدّةٍ تكفي للتجديد.
   * -------------------------------------------------------------- */

  /** شركة التأمين */
  insurer?: string;
  /** رقم الوثيقة كما في المستند */
  policyNumber?: string;
  /** yyyy-mm-dd */
  insuranceStart?: string;
  /** yyyy-mm-dd — عليه يقوم التنبيه */
  insuranceEnd?: string;
  /** قسط التأمين */
  insuranceValue?: number;
  insuranceNote?: string;
};

/**
 * دفعة عقد.
 *
 * الاعتماد والدفع أمران منفصلان: المهندس يعتمد إنجاز المرحلة فتصير الدفعة
 * مستحقة، ثم يصرفها المحاسب. حالة الدفع الفعلية تُحسب من القيود المرتبطة
 * لا من هذا الحقل.
 */
export type Installment = {
  number: number;
  value: string;
  /** شرط الاستحقاق كما في العقد */
  condition: string;
  /** حالة الدفع المسجّلة يدوياً */
  status: string;

  /**
   * ما سُدِّد من هذه الدفعة من خارج حسابات الشركة.
   *
   * كدعم الدولة للتكييف والألمنيوم: تدفعه الجهة الحكومية للمورّد
   * مباشرةً عن العميل، فلا يدخل حساب الشركة ولا يخرج منه — ولا قيد
   * له في الدفاتر بحال. وإنما يُكتب هنا لئلا يظهر العقد وكأن قيمته
   * لم تُسدَّد، وهو قد سُدّد.
   *
   * ولا يُخلط بالمدفوع: المدفوع محسوبٌ من القيود، وهذا خارجها.
   */
  externalPaid?: string;
  /** من أين جاء ذلك السداد — «دعم الدولة للتكييف، دُفع لليوسفي» */
  externalNote?: string;

  /**
   * خصمٌ على الدفعة يقرّره المهندس مع اعتماده الإنجاز.
   *
   * فالمرحلة قد تُنجَز ويُشهد بإنجازها، وفيها تقصيرٌ أو تأخير يستوجب
   * خصماً. فيُعتمد الإنجاز ويُكتب الخصم وسببه معاً، ثم تُقرّه الإدارة
   * وهي تراه — لا أن يُقرَّ الإنجاز أولاً ثم يُتذكّر الخصم بعد الصرف.
   *
   * والمستحق للصرف = قيمة الدفعة ناقص الخصم. وقيمة العقد لا تتغيّر:
   * الخصم جزاءٌ على التنفيذ، لا تعديلٌ للعقد.
   */
  deduction?: string;
  /** سببه — يُطالَب به، فخصمٌ بلا سببٍ لا يُدافَع عنه */
  deductionReason?: string;
  /** هل اعتُمد إنجاز المرحلة؟ */
  approved: boolean;
  /** اسم من اعتمدها */
  approvedBy: string;
  /** ISO datetime */
  approvedAt: string;
  /** ملاحظة المهندس عند الاعتماد */
  approvalNote: string;

  /**
   * الموافقة الثانية — قرار مجلس الإدارة في ١٢ سبتمبر ٢٠٢٦.
   *
   * اعتماد المهندس شهادةٌ فنية بأن العمل أُنجز، ولا تكفي وحدها لتصير
   * الدفعة مستحقة: يقرّها بعده المدير العام أو صاحب الشركة أو المدير
   * العام المالي والإداري. فمن يعاين الموقع غير من يلتزم بالمال.
   */
  confirmed: boolean;
  confirmedBy: string;
  confirmedAt: string;
  confirmNote: string;

  /* --------------------------------------------------------------
   * تمثيل جدول «الأعمال والبنود المتفق عليها» كما في العقد المبرم.
   *
   * الجدول ستة أعمدة: م · المرحلة · البند · وصف البند · المواد ·
   * الدفعة المستحقة. والمرحلة الواحدة تضم عدة بنود تُدمج خلاياها
   * رأسياً، وقد تضم أكثر من دفعة — فالدفعة مجموعةُ صفوفٍ لا صفّاً.
   *
   * الحقول اختيارية: العقود المسجّلة قبل هذا التمثيل تبقى كما هي،
   * ويُطبع وصفها من condition.
   * -------------------------------------------------------------- */

  /**
   * رقم الصفّ في عمود «م» بالعقد المبرم. الدفعات المتتالية التي تحمل
   * الرقم نفسه صفٌّ واحد في المطبوعة تُدمج خلية «م» فيها — فمرحلة
   * التشطيب رقمها 9 وفيها تسع دفعات.
   */
  no?: number;
  /** اسم المرحلة — يُدمج رأسياً على كل دفعات المرحلة */
  stage?: string;
  /** عمود المواد: على مَن توريدها */
  materials?: string;
  /** صفوف هذه الدفعة: البند ووصفه */
  rows?: { item: string; description: string }[];
  /**
   * صفّ توثيقي لا دفعة — كصفّ «عقد التراخيص والمخططات (4000-)» الذي
   * يوثّق خصماً مطبَّقاً سلفاً على القيمة الإجمالية. يُطبع في الجدول
   * ولا يدخل قيمة العقد ولا دورة الاعتماد.
   */
  informational?: boolean;
  /** سطر عريض يلي المرحلة: «الانتهاء من الهيكل الأسود» */
  banner?: string;
};

/** الدفعة القابلة للصرف — التوثيقية ليست منها */
export const isPayableInstallment = (i: Installment): boolean =>
  i.informational !== true;

/** قيمة الدفعة كما في العقد */
export const installmentValue = (i: Installment): number =>
  round3(Number(i.value) || 0);

/** خصم المهندس على الدفعة — صفرٌ إن لم يكن */
export const installmentDeduction = (i: Installment): number =>
  round3(Number(i.deduction) || 0);

/**
 * المستحق للصرف: قيمة الدفعة ناقص خصم المهندس.
 *
 * وهو ما يُقاس به المدفوع والمتبقي — لا القيمة وحدها، وإلا ظهرت
 * الدفعة ناقصةً أبداً وقد استوفى المقاول حقّه بعد الخصم.
 */
export const installmentNet = (i: Installment): number =>
  round3(installmentValue(i) - installmentDeduction(i));

/** الدفعة مستحقة متى اعتمد المهندس إنجازها وأقرّتها الإدارة */
export const isInstallmentDue = (installment: Installment): boolean =>
  installment.approved && installment.confirmed;

/** بند فني أو التزام في العقد — عنوان ونص */
export type ContractClause = {
  id: string;
  title: string;
  body: string;
};

/**
 * عقد مقاول.
 *
 * الحقول الأولى هي ما كان في النظام منذ البداية. ما بعدها أُضيف من
 * العقود الورقية المبرمة ليصبح العقد قابلاً للطباعة كمستند رسمي.
 */
export type Contractor = {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  project: string;
  contractNumber: string;
  contractType: string;
  workType: string;
  contractValue: number;
  installmentsCount: number;
  installments: Installment[];

  /**
   * مع مَن هذا العقد.
   *
   * «عميل»  = الشركة تنفّذ له ويدفع هو — الدفعات واردة.
   * «مقاول» = يبيع مصنعية: حفر، حدادة، صحي، مساح — الدفعات صادرة.
   * «مورّد» = يورّد ويركّب بضاعته: طابوق، خرسانة، ألومنيوم، تكييف،
   *           مسبح — صادرة أيضاً، لكن التزاماته توريد ومواصفات وضمان
   *           بضاعة لا أصول صنعة، فيُفصل عن المقاول ليُقاس كلٌّ بمعياره.
   *
   * والشركة هي الطرف الأول في الثلاثة.
   */
  counterpartyType: CounterpartyType;
  /** «عقد» أو «ملحق عقد» — الملحق يشير إلى عقد أصلي */
  documentType: string;
  /** رقم العقد الأصلي إن كان هذا ملحقاً */
  parentContractNumber: string;
  /** تاريخ تحرير العقد */
  contractDate: string;

  /* بيانات الطرف الثاني كما تُكتب في العقد */
  civilId: string;
  passportNumber: string;
  nationality: string;
  address: string;

  /* موقع العمل */
  plot: string;
  block: string;
  area: string;
  licenseNumber: string;
  /** وصف المبنى: نصف سرداب + أرضي + أول + سطح */
  buildingDescription: string;

  /* الشروط الرقمية */
  durationDays: number;
  /**
   * تاريخ الانتهاء المتوقَّع — يُكتب بيد من يعرف الموقع.
   *
   * العقود تحسب مدتها بأيام العمل وتستثني العطل والظروف القاهرة،
   * والنظام لا يعرفها فيحسب بالتقويم. فهذا الحقل يعلو على حسابه.
   */
  expectedEndDate?: string;
  delayPenaltyPerDay: number;
  maxPenaltyPercent: number;
  terminationAfterDays: number;
  warrantyYears: number;

  /** التمهيد */
  preamble: string;
  /** البنود الفنية: الشدة الخشبية، الصب، التسليح، البناء… */
  clauses: ContractClause[];
  /** الالتزامات والمواصفات الفنية المرقّمة */
  obligations: string[];
  /** ملاحظات ختامية */
  notes: string;
};

/** صنف مادة في كتالوج المواد، بسعر وحدة استرشادي */
export type Material = {
  id: string;
  name: string;
  /** فارغ يعني بلا سعر معرّف — يُدخل يدوياً عند الاستلام */
  unitPrice: number | null;
};

/** سجلّ استلام مواد في موقع مشروع — تتبّع عيني لا قيد محاسبي */
export type MaterialReceipt = {
  id: string;
  date: string;
  fiscalYear: number;
  project: string;
  material: string;
  quantity: number;
  unitPrice: number | null;
  receivedBy: string;
  note: string;
};

/** بيانات الشركة — تظهر في ترويسة كل مطبوعة وسند */
export type CompanyProfile = {
  name: string;
  nameEn: string;
  /** الشعار كـ data URL، حتى يُطبع بلا اتصال بالشبكة */
  logo: string;
  address: string;
  phone: string;
  email: string;
  /** رقم السجل التجاري */
  crNumber: string;
  /**
   * الحركة التي لا يتجاوز مبلغها هذا الحد تُعتمد تلقائياً.
   *
   * صفر يعني أن كل حركة تحتاج اعتماداً. ورفعه إلى مئة مثلاً يوفّر على
   * المعتمِد التوقيع على بنزين بعشرة دنانير — فالتوقيع الذي يتكرّر خمسين
   * مرة في اليوم يصير عادةً بلا نظر، وتلك رقابة صورية.
   */
  approvalThreshold: number;
  /** كل كم يوم تُؤخذ نسخة احتياطية — قرار المجلس عشرة أيام */
  backupEveryDays: number;
};

export const defaultCompany = (): CompanyProfile => ({
  name: "شركة ذياب للمقاولات",
  nameEn: "",
  logo: "",
  address: "",
  phone: "",
  email: "",
  crNumber: "",
  approvalThreshold: 0,
  backupEveryDays: 10,
});

export type User = {
  id: string;
  name: string;
  /** الوظيفة كما تُكتب في الشركة */
  jobTitle: string;
  role: RoleKey;
  permissions: Permission[];
  /** تجزئة رقم الدخول — لا يُخزَّن الرقم نفسه أبداً */
  pinHash: string;
  /**
   * أُعيد تعيين رقمه، فيُجبَر على تغييره عند أول دخول.
   *
   * بدون هذا يبقى الرقم الذي كتبه المدير معروفاً له، فلا يكون رقم
   * المستخدم رقمه وحده.
   */
  mustChangePin: boolean;
  active: boolean;
  createdAt: string;
  /**
   * آخر دخول سابق — يُثبَّت عند الدخول قبل تحديثه، فتُعرض عليه أفعال
   * غيره التي جرت في غيابه. ISO datetime، وفارغ لمن لم يدخل بعد.
   */
  lastSeenAt: string;
};

/**
 * تجزئة رقم الدخول بـ SHA-256.
 *
 * هذا يمنع قراءة الرقم من التخزين، لكنه لا يجعل النظام آمناً: التحقق يجري
 * في المتصفح، ومن يفتح أدوات المطوّر يتجاوزه. الحماية الحقيقية تأتي مع
 * الخادم، وهذه البنية تنتقل إليه كما هي.
 */
export async function hashPin(pin: string): Promise<string> {
  const bytes = new TextEncoder().encode(`theyab:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * إقفال سنة مالية.
 *
 * السنة المقفلة لا تقبل إضافة حركة ولا تعديلها ولا حذفها، ولا تعديل
 * أرصدتها الافتتاحية — فأرقامها اعتُمدت وصدرت قوائمها. الإقفال قابل
 * للفتح بصلاحية، ويُسجَّل الفتح والإقفال في سجل التدقيق.
 */
export type YearLock = {
  closedAt: string;
  closedBy: string;
  note: string;
};

/** السنة ← بيانات إقفالها. غياب المفتاح يعني أنها مفتوحة */
export type YearLocks = Record<string, YearLock>;

export const isYearClosed = (locks: YearLocks, year: number): boolean =>
  Boolean(locks[String(year)]);

export type AppState = {
  movements: Movement[];
  projects: Project[];
  contractors: Contractor[];
  openingBalances: OpeningBalances;
  materials: Material[];
  materialReceipts: MaterialReceipt[];
  company: CompanyProfile;
  users: User[];
  audit: AuditEntry[];
  yearLocks: YearLocks;
  /** البيانات الأساسية القابلة للتحرير — تبدأ من المولّدة من الإكسل */
  chart: Account[];
  items: ItemDefinition[];
  payments: PaymentMethod[];
  /** أسماء الدافعين والمستلمين */
  people: string[];
  /** نظام الرواتب */
  employees: Employee[];
  attendance: AttendanceDay[];
  payrollRuns: PayrollRun[];
  payrollSettings: PayrollSettings;
  /** كتالوج بنود الأعمال وعروض الأسعار المبنية عليه */
  workItems: WorkItem[];
  quotations: Quotation[];
  /** فواتير العملاء */
  invoices: Invoice[];
};

export const SCHEMA_VERSION = 12;

const KEYS = {
  movements: "movements",
  projects: "projects",
  contractors: "contractors",
  openingBalances: "openingBalances",
  materials: "materials",
  materialReceipts: "materialReceipts",
  company: "company",
  users: "users",
  audit: "auditLog",
  yearLocks: "yearLocks",
  chart: "chartOfAccounts",
  items: "itemMap",
  payments: "paymentMap",
  people: "people",
  employees: "employees",
  attendance: "attendance",
  payrollRuns: "payrollRuns",
  payrollSettings: "payrollSettings",
  workItems: "workItems",
  quotations: "quotations",
  invoices: "invoices",
};

/** الأشخاص الافتراضيون — منقولون من ورقة LISTS في الإكسل */
export const DEFAULT_PEOPLE = [
  "طارق الأسد",
  "محمد ششتري",
  "ذياب الخميس",
  "مصطفى الأنصاري",
  "م. عبدالعزيز",
  "سامي الأسد",
  "م. نوح",
  "البنك",
];

export const emptyState = (): AppState => ({
  movements: [],
  projects: [],
  contractors: [],
  openingBalances: {},
  materials: [],
  materialReceipts: [],
  company: defaultCompany(),
  users: [],
  audit: [],
  yearLocks: {},
  chart: GENERATED_CHART,
  items: GENERATED_ITEMS,
  payments: GENERATED_PAYMENTS,
  people: DEFAULT_PEOPLE,
  employees: [],
  attendance: [],
  payrollRuns: [],
  payrollSettings: defaultPayrollSettings(),
  workItems: SEED_WORK_ITEMS,
  quotations: [],
  invoices: [],
});

function migrateEmployee(raw: unknown): Employee {
  const e = (raw ?? {}) as Record<string, unknown>;
  const allowances = Array.isArray(e.allowances) ? e.allowances : [];
  return {
    id: str(e.id) || newId(),
    code: str(e.code),
    name: str(e.name),
    civilId: str(e.civilId),
    nationality: str(e.nationality),
    isKuwaiti: e.isKuwaiti === true,
    jobTitle: str(e.jobTitle),
    department: str(e.department, "إداري") || "إداري",
    project: str(e.project),
    hireDate: str(e.hireDate),
    endDate: str(e.endDate),
    wageType: e.wageType === "يومي" ? "يومي" : "شهري",
    basicWage: round3(Number(e.basicWage) || 0),
    registeredWage: round3(Number(e.registeredWage) || 0),
    iban: str(e.iban),
    wageAccount: str(e.wageAccount),
    allowances: allowances.map((a) => {
      const item = (a ?? {}) as Record<string, unknown>;
      return { name: str(item.name), amount: round3(Number(item.amount) || 0) };
    }),
    restDay: str(e.restDay, "الجمعة") || "الجمعة",
    active: e.active !== false,
    passportNumber: str(e.passportNumber),
    workPermitExpiry: str(e.workPermitExpiry),
    residencyExpiry: str(e.residencyExpiry),
    notes: str(e.notes),
  };
}

function migrateAttendance(raw: unknown): AttendanceDay[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const a = (item ?? {}) as Record<string, unknown>;
      return {
        /*
          مشتقٌّ من الموظف واليوم لا مولَّدٌ عشوائياً.

          كان newId()، فيتغيّر معرّف اليوم الواحد في كل فتحةٍ للنظام.
          وذلك يفسد المقارنة مع الخادم — لا يستقرّ صفٌّ على حال — ولا
          يفيد أحداً: النظام كله يعرف يوم الموظف بالموظف واليوم لا
          بمعرّف، فاليوم الواحد لا يتكرّر.
        */
        id: str(a.id) || str(a.employeeId) + "|" + str(a.date),
        employeeId: str(a.employeeId),
        date: str(a.date),
        status: (ATTENDANCE_STATUSES.includes(
          a.status as AttendanceStatus
        )
          ? a.status
          : "حاضر") as AttendanceStatus,
        hours: Number(a.hours) || 0,
        overtimeHours: Number(a.overtimeHours) || 0,
        restDayHours: Number(a.restDayHours) || 0,
        holidayHours: Number(a.holidayHours) || 0,
        note: str(a.note),
      };
    })
    .filter((a) => a.employeeId && a.date);
}

function migratePayrollSettings(raw: unknown): PayrollSettings {
  const base = defaultPayrollSettings();
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Record<string, unknown>;
  const num = (key: keyof PayrollSettings, fallback: number) =>
    Number.isFinite(Number(s[key])) ? Number(s[key]) : fallback;

  return {
    ...base,
    dailyHours: num("dailyHours", base.dailyHours),
    weeklyHours: num("weeklyHours", base.weeklyHours),
    ramadanWeeklyHours: num("ramadanWeeklyHours", base.ramadanWeeklyHours),
    monthDays: num("monthDays", base.monthDays),
    overtimeRate: num("overtimeRate", base.overtimeRate),
    restDayRate: num("restDayRate", base.restDayRate),
    holidayRate: num("holidayRate", base.holidayRate),
    maxOvertimeDaily: num("maxOvertimeDaily", base.maxOvertimeDaily),
    maxOvertimeYearly: num("maxOvertimeYearly", base.maxOvertimeYearly),
    annualLeaveDays: num("annualLeaveDays", base.annualLeaveDays),
    sickLeaveTiers: Array.isArray(s.sickLeaveTiers)
      ? (s.sickLeaveTiers as unknown[]).map((t) => {
          const tier = (t ?? {}) as Record<string, unknown>;
          return {
            days: Number(tier.days) || 0,
            rate: Number(tier.rate) || 0,
          };
        })
      : base.sickLeaveTiers,
    eosFirstYears: num("eosFirstYears", base.eosFirstYears),
    eosDaysPerYearFirst: num("eosDaysPerYearFirst", base.eosDaysPerYearFirst),
    eosDaysPerYearAfter: num("eosDaysPerYearAfter", base.eosDaysPerYearAfter),
    eosCapMonths: num("eosCapMonths", base.eosCapMonths),
    maxDeductionPercent: num("maxDeductionPercent", base.maxDeductionPercent),
    socialInsuranceEnabled: s.socialInsuranceEnabled === true,
    socialInsuranceEmployee: num("socialInsuranceEmployee", 0),
    socialInsuranceEmployer: num("socialInsuranceEmployer", 0),
    socialInsuranceCeiling: num("socialInsuranceCeiling", 0),
  };
}

/* ------------------------------------------------------------------ */
/* عروض الأسعار                                                        */
/* ------------------------------------------------------------------ */

function migrateWorkItems(raw: unknown): WorkItem[] {
  // الكتالوج فارغ يعني نظاماً جديداً، فيبدأ من المنقول عن الإكسل
  if (!Array.isArray(raw) || raw.length === 0) return SEED_WORK_ITEMS;
  return raw
    .map((entry, index) => {
      const w = (entry ?? {}) as Record<string, unknown>;
      return {
        id: str(w.id) || `wi-${index + 1}`,
        stage: str(w.stage),
        section: str(w.section),
        name: str(w.name),
        detail: str(w.detail),
        description: str(w.description),
        unit: str(w.unit),
        quantity: Number(w.quantity) || 0,
        cost: Number(w.cost) || 0,
        costUpdatedAt: str(w.costUpdatedAt),
        costUpdatedBy: str(w.costUpdatedBy),
        price: Number(w.price) || 0,
        // البنود المنقولة قبل فصل المواد تُعدّ كلها مصنعية حتى تُفصَّل
        materialCost: Number(w.materialCost) || 0,
        materialPrice: Number(w.materialPrice) || 0,
        essential: w.essential === true,
        active: w.active !== false,
        notes: str(w.notes),
      };
    })
    .filter((w) => w.stage);
}

function migrateQuotationLine(raw: unknown): QuotationLine {
  const l = (raw ?? {}) as Record<string, unknown>;
  return {
    itemId: str(l.itemId),
    stage: str(l.stage),
    section: str(l.section),
    name: str(l.name),
    detail: str(l.detail),
    description: str(l.description),
    unit: str(l.unit),
    quantity: Number(l.quantity) || 0,
    cost: Number(l.cost) || 0,
    price: Number(l.price) || 0,
    materialCost: Number(l.materialCost) || 0,
    materialPrice: Number(l.materialPrice) || 0,
    essential: l.essential === true,
    chosen: l.chosen === true,
    custom: l.custom === true,
  };
}

function migrateQuotations(raw: unknown): Quotation[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, index) => {
      const q = (entry ?? {}) as Record<string, unknown>;
      const status = QUOTATION_STATUSES.includes(q.status as QuotationStatus)
        ? (q.status as QuotationStatus)
        : "مسودة";
      const scope = SCOPES.some((s) => s.key === q.scope)
        ? (q.scope as ScopeKey)
        : "هيكل أسود";
      const days = (key: string, fallback: number) =>
        Number.isFinite(Number(q[key])) && Number(q[key]) > 0
          ? Number(q[key])
          : fallback;

      return {
        id: str(q.id) || newId(),
        number: str(q.number) || `Q-${index + 1}`,
        date: str(q.date),
        status,
        clientName: str(q.clientName),
        clientPhone: str(q.clientPhone),
        clientCivilId: str(q.clientCivilId),
        clientAddress: str(q.clientAddress),
        area: str(q.area),
        block: str(q.block),
        plot: str(q.plot),
        licenseNumber: str(q.licenseNumber),
        buildingDescription: str(q.buildingDescription),
        builtArea: Number(q.builtArea) || 0,
        scope,
        pricingMode: PRICING_MODES.includes(q.pricingMode as PricingMode)
          ? (q.pricingMode as PricingMode)
          : "مصنعية ومواد",
        marginPercent: Number.isFinite(Number(q.marginPercent))
          ? Number(q.marginPercent)
          : QUOTATION_DEFAULTS.marginPercent,
        durationDays: days("durationDays", QUOTATION_DEFAULTS.durationDays),
        validityDays: days("validityDays", QUOTATION_DEFAULTS.validityDays),
        /*
          يوم التقديم للعميل. وما سبق هذا الحقل من العروض: المسودة لا
          تقديم لها، وما خرج عن المسودة فأقربُ ما يُعرف به تاريخُه.
        */
        submittedAt:
          str(q.submittedAt) ||
          (str(q.status) && str(q.status) !== "مسودة" ? str(q.date) : ""),
        lines: Array.isArray(q.lines)
          ? q.lines.map(migrateQuotationLine)
          : [],
        notes: str(q.notes),
        contractNumber: str(q.contractNumber),
        createdBy: str(q.createdBy),
        createdAt: str(q.createdAt) || new Date().toISOString(),
        updatedAt:
          str(q.updatedAt) || str(q.createdAt) || new Date().toISOString(),
      };
    })
    .filter((q) => q.number);
}

function migrateInvoices(raw: unknown): Invoice[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry, index) => {
      const v = (entry ?? {}) as Record<string, unknown>;
      return {
        id: str(v.id) || newId(),
        number: str(v.number) || `INV - ${String(index + 1).padStart(3, "0")}`,
        date: str(v.date),
        clientName: str(v.clientName),
        clientCivilId: str(v.clientCivilId),
        clientPhone: str(v.clientPhone),
        projectLocation: str(v.projectLocation),
        project: str(v.project),
        contractTitle: str(v.contractTitle),
        installmentLabel: str(v.installmentLabel),
        contractNumber: str(v.contractNumber),
        installmentNumber: Number(v.installmentNumber) || 0,
        paymentMethod: str(v.paymentMethod),
        lines: Array.isArray(v.lines)
          ? v.lines.map((l) => {
              const line = (l ?? {}) as Record<string, unknown>;
              return {
                description: str(line.description),
                amount: Number(line.amount) || 0,
              };
            })
          : [],
        notes: str(v.notes),
        createdBy: str(v.createdBy),
        createdAt: str(v.createdAt) || new Date().toISOString(),
      };
    })
    .filter((v) => v.number);
}

function migratePayrollRuns(raw: unknown): PayrollRun[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const r = (item ?? {}) as Record<string, unknown>;
      const status = ["مسودة", "معتمد", "مرحّل"].includes(String(r.status))
        ? (r.status as PayrollRun["status"])
        : "مسودة";
      return {
        id: str(r.id) || newId(),
        month: str(r.month),
        fiscalYear: Number(r.fiscalYear) || fiscalYearOf(str(r.month) + "-01"),
        status,
        createdAt: str(r.createdAt),
        createdBy: str(r.createdBy),
        approvedAt: str(r.approvedAt),
        approvedBy: str(r.approvedBy),
        postedMovementIds: Array.isArray(r.postedMovementIds)
          ? (r.postedMovementIds as unknown[]).map((x) => str(x))
          : [],
        lines: Array.isArray(r.lines) ? (r.lines as PayrollRun["lines"]) : [],
        deductions:
          r.deductions && typeof r.deductions === "object"
            ? (r.deductions as Record<string, number>)
            : {},
        note: str(r.note),
      };
    })
    .filter((r) => r.month);
}

function migrateChart(raw: unknown): Account[] {
  if (!Array.isArray(raw) || raw.length === 0) return GENERATED_CHART;
  return raw
    .map((item) => {
      const a = (item ?? {}) as Record<string, unknown>;
      return {
        code: str(a.code),
        name: str(a.name),
        parent: str(a.parent),
        type: str(a.type) as Account["type"],
        nature: str(a.nature) as Account["nature"],
        level: Number(a.level) || 3,
        statement: str(a.statement),
        active: a.active !== false,
        postable: a.postable === true,
      };
    })
    .filter((a) => /^\d{3,6}$/.test(a.code) && a.name);
}

function migrateItems(raw: unknown): ItemDefinition[] {
  if (!Array.isArray(raw)) return GENERATED_ITEMS;
  return raw
    .map((item) => {
      const i = (item ?? {}) as Record<string, unknown>;
      return {
        code: str(i.code),
        name: str(i.name),
        account: str(i.account),
      };
    })
    .filter((i) => i.code && i.name);
}

function migratePayments(raw: unknown): PaymentMethod[] {
  if (!Array.isArray(raw)) return GENERATED_PAYMENTS;
  return raw
    .map((item) => {
      const p = (item ?? {}) as Record<string, unknown>;
      return { label: str(p.label), account: str(p.account) };
    })
    .filter((p) => p.label);
}

function migratePeople(raw: unknown): string[] {
  if (!Array.isArray(raw)) return DEFAULT_PEOPLE;
  const names = raw.map((n) => str(n).trim()).filter(Boolean);
  return names.length ? [...new Set(names)] : DEFAULT_PEOPLE;
}

function migrateYearLocks(raw: unknown): YearLocks {
  if (!raw || typeof raw !== "object") return {};
  const out: YearLocks = {};
  for (const [year, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}$/.test(year)) continue;
    const v = (value ?? {}) as Record<string, unknown>;
    out[year] = {
      closedAt: str(v.closedAt) || new Date().toISOString(),
      closedBy: str(v.closedBy),
      note: str(v.note),
    };
  }
  return out;
}

function migrateAudit(raw: unknown): AuditEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const e = (item ?? {}) as Record<string, unknown>;
      return {
        /*
          مشتقٌّ من القيد نفسه لا مولَّدٌ عشوائياً.

          كان newId()، فقيدٌ بلا معرّف يأخذ معرّفاً جديداً في كل فتحةٍ
          للنظام — فلا يستقرّ على حال، ويظهر في المقارنة مع الخادم
          مختلفاً أبداً. وهو عين ما وقع في سجلّ الحضور.
        */
        id: str(e.id) || `${str(e.at)}|${str(e.user)}|${str(e.action)}`,
        at: str(e.at),
        user: str(e.user),
        action: str(e.action) as AuditEntry["action"],
        entity: str(e.entity) as AuditEntry["entity"],
        summary: str(e.summary),
        before: e.before == null ? undefined : str(e.before),
        after: e.after == null ? undefined : str(e.after),
      };
    })
    .filter((e) => e.at && e.summary)
    .slice(0, AUDIT_LIMIT);
}

function migrateUser(raw: unknown): User {
  const u = (raw ?? {}) as Record<string, unknown>;
  // القائمة تُشتق من تعريف الأدوار نفسه، فلا تُنسى إضافة دور جديد هنا
  const role = ROLES.some((r) => r.key === u.role)
    ? (u.role as RoleKey)
    : "custom";

  const stored = Array.isArray(u.permissions) ? (u.permissions as string[]) : [];

  /*
   * دورا المالك والمدير العام معرَّفان بأنهما «كل الصلاحيات بلا استثناء»،
   * فيُمنحان الصلاحيات المضافة حديثاً تلقائياً. بدون هذا يبقى حساب أُنشئ
   * قبل إضافة صلاحية محروماً منها إلى الأبد.
   *
   * أما بقية الأدوار فلا تُمنح شيئاً لم يُقرَّر لها صراحةً — منح صلاحية
   * بلا قرار أخطر من حجبها.
   */
  const permissions =
    role === "owner" || role === "manager"
      ? ALL_PERMISSIONS
      : stored.filter((p): p is Permission =>
          ALL_PERMISSIONS.includes(p as Permission)
        );

  return {
    id: str(u.id) || newId(),
    name: str(u.name),
    jobTitle: str(u.jobTitle),
    role,
    permissions,
    pinHash: str(u.pinHash),
    // الحسابات القائمة لم تُعَد تعيينها، فلا تُجبَر على التغيير
    mustChangePin: u.mustChangePin === true,
    active: u.active !== false,
    createdAt: str(u.createdAt) || new Date().toISOString(),
    lastSeenAt: str(u.lastSeenAt),
  };
}

function migrateCompany(raw: unknown): CompanyProfile {
  const c = (raw ?? {}) as Record<string, unknown>;
  const base = defaultCompany();
  return {
    name: str(c.name) || base.name,
    nameEn: str(c.nameEn),
    logo: str(c.logo),
    address: str(c.address),
    phone: str(c.phone),
    email: str(c.email),
    crNumber: str(c.crNumber),
    approvalThreshold: Math.max(0, Number(c.approvalThreshold) || 0),
    backupEveryDays: Math.max(1, Number(c.backupEveryDays) || base.backupEveryDays),
  };
}

/** تكلفة الاستلام، أو null إن كان سعر الوحدة غير معرّف */
export function receiptCost(receipt: MaterialReceipt): number | null {
  if (receipt.unitPrice == null) return null;
  return round3(receipt.quantity * receipt.unitPrice);
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const str = (v: unknown, fallback = "") =>
  typeof v === "string" ? v : v == null ? fallback : String(v);

/* ------------------------------------------------------------------ */
/* الترحيل                                                             */
/* ------------------------------------------------------------------ */

/** حصص الدفعات كما تُقرأ من ملفٍ أو من القاعدة — والفارغ ليس شيئاً */
function splitsOf(raw: unknown): InstallmentSplit[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .map((x) => {
      const part = (x ?? {}) as Record<string, unknown>;
      return {
        number: Number(part.number) || 0,
        amount: round3(Number(part.amount) || 0),
      };
    })
    .filter((x) => x.number > 0 && x.amount > 0);
  return list.length > 0 ? list : undefined;
}

function migrateMovement(raw: unknown): Movement {
  const m = (raw ?? {}) as Record<string, unknown>;

  const date = str(m.date);
  const itemCode = str(m.itemCode);
  const itemName = str(m.itemName) || str(m.item);

  // النسخ القديمة لم تكن تخزّن طرفَي القيد، فنشتقهما من البند إن أمكن
  let debitCode = str(m.debitCode);
  let creditCode = str(m.creditCode);
  if (!debitCode && !creditCode) {
    const derived = itemAccount(itemCode || itemName);
    if (derived) debitCode = derived;
  }

  return {
    id: str(m.id) || newId(),
    entryNo: Number(m.entryNo) || 0,
    fiscalYear: Number(m.fiscalYear) || fiscalYearOf(date),
    date,
    movementType: str(m.movementType),
    description: str(m.description),
    itemCode,
    itemName,
    debitCode,
    creditCode,
    amount: round3(Number(m.amount) || 0),
    project: str(m.project),
    person: str(m.person),
    paymentMethod: str(m.paymentMethod),
    party: str(m.party),
    // الحركات المسجّلة قبل إقرار دورة الاعتماد معتمدة، وإلا اختفت الدفاتر كلها
    approval: APPROVAL_STATES.includes(m.approval as ApprovalState)
      ? (m.approval as ApprovalState)
      : "معتمدة",
    approvedBy: str(m.approvedBy),
    approvedAt: str(m.approvedAt),
    approvalNote: str(m.approvalNote),
    contractNumber: str(m.contractNumber) || undefined,
    installmentNumber: Number(m.installmentNumber) || undefined,
    /*
      توزيع المبلغ على أكثر من دفعة — يُقرأ كما كُتب. والفارغ يعود
      undefined لا مصفوفةً فارغة، وإلا اختلفت الحركة عن نفسها في
      المقارنة مع الخادم فأُرسلت بلا سبب.
    */
    installmentSplits: splitsOf(m.installmentSplits),
    source: m.source === "excel" ? "excel" : "app",
  };
}

function migrateProject(raw: unknown): Project {
  const p = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(p.id) || newId(),
    name: str(p.name),
    budget: round3(Number(p.budget) || 0),
    startDate: str(p.startDate),
    status: str(p.status, "نشط") || "نشط",
    insurer: str(p.insurer) || undefined,
    policyNumber: str(p.policyNumber) || undefined,
    insuranceStart: str(p.insuranceStart) || undefined,
    insuranceEnd: str(p.insuranceEnd) || undefined,
    insuranceValue: Number(p.insuranceValue) > 0
      ? round3(Number(p.insuranceValue))
      : undefined,
    insuranceNote: str(p.insuranceNote) || undefined,
  };
}

function migrateContractor(raw: unknown): Contractor {
  const c = (raw ?? {}) as Record<string, unknown>;
  const installments = Array.isArray(c.installments) ? c.installments : [];
  return {
    id: str(c.id) || newId(),
    name: str(c.name),
    specialty: str(c.specialty),
    phone: str(c.phone),
    project: str(c.project),
    contractNumber: str(c.contractNumber),
    contractType: str(c.contractType),
    workType: str(c.workType),
    contractValue: round3(Number(c.contractValue) || 0),
    installmentsCount: Number(c.installmentsCount) || installments.length,

    // العقود المسجّلة قبل إضافة التمييز كلها عقود مقاولين
    counterpartyType: COUNTERPARTY_TYPES.includes(
      c.counterpartyType as CounterpartyType
    )
      ? (c.counterpartyType as CounterpartyType)
      : "مقاول",
    documentType: str(c.documentType, "عقد") || "عقد",
    parentContractNumber: str(c.parentContractNumber),
    contractDate: str(c.contractDate),

    civilId: str(c.civilId),
    passportNumber: str(c.passportNumber),
    nationality: str(c.nationality),
    address: str(c.address),

    plot: str(c.plot),
    block: str(c.block),
    area: str(c.area),
    licenseNumber: str(c.licenseNumber),
    buildingDescription: str(c.buildingDescription),

    // العقود القديمة بلا شروط رقمية — تُملأ من القالب لا بأصفار مضلّلة
    durationDays: Number(c.durationDays) || CONTRACT_DEFAULTS.durationDays,
    expectedEndDate: str(c.expectedEndDate) || undefined,
    delayPenaltyPerDay:
      Number(c.delayPenaltyPerDay) || CONTRACT_DEFAULTS.delayPenaltyPerDay,
    maxPenaltyPercent:
      Number(c.maxPenaltyPercent) || CONTRACT_DEFAULTS.maxPenaltyPercent,
    terminationAfterDays:
      Number(c.terminationAfterDays) || CONTRACT_DEFAULTS.terminationAfterDays,
    warrantyYears: Number(c.warrantyYears) || CONTRACT_DEFAULTS.warrantyYears,

    preamble: str(c.preamble),
    clauses: Array.isArray(c.clauses)
      ? c.clauses.map((raw, index) => {
          const cl = (raw ?? {}) as Record<string, unknown>;
          return {
            id: str(cl.id) || `cl-${index}`,
            title: str(cl.title),
            body: str(cl.body),
          };
        })
      : DEFAULT_CLAUSES.map((cl, index) => ({ ...cl, id: `cl-${index}` })),
    obligations: Array.isArray(c.obligations)
      ? (c.obligations as unknown[]).map((o) => str(o)).filter(Boolean)
      : [...DEFAULT_OBLIGATIONS],
    notes: str(c.notes, DEFAULT_NOTES) || DEFAULT_NOTES,
    installments: installments.map((i, index) => {
      const item = (i ?? {}) as Record<string, unknown>;
      const status = str(item.status, "غير مستحقة") || "غير مستحقة";
      return {
        number: Number(item.number) || index + 1,
        value: str(item.value),
        condition: str(item.condition),
        status,
        // البيانات القديمة: الدفعة المدفوعة تعني أن مرحلتها اعتُمدت ضمناً
        approved:
          typeof item.approved === "boolean"
            ? item.approved
            : status.includes("مدفوع"),
        approvedBy: str(item.approvedBy),
        approvedAt: str(item.approvedAt),
        approvalNote: str(item.approvalNote),
        /*
         * الدفعات المعتمدة قبل إقرار الخطوة الثانية تُعدّ مُقرّة أيضاً —
         * وإلا صارت دفعات مصروفة فعلاً «غير مستحقة» بأثر رجعي.
         */
        confirmed:
          typeof item.confirmed === "boolean"
            ? item.confirmed
            : typeof item.approved === "boolean"
            ? item.approved
            : status.includes("مدفوع"),
        confirmedBy: str(item.confirmedBy),
        confirmedAt: str(item.confirmedAt),
        confirmNote: str(item.confirmNote),
        externalPaid: str(item.externalPaid) || undefined,
        externalNote: str(item.externalNote) || undefined,
        deduction: str(item.deduction) || undefined,
        deductionReason: str(item.deductionReason) || undefined,
        // تمثيل جدول العقد — اختياري، والقديم بلا شيء منه
        no: Number(item.no) > 0 ? Number(item.no) : undefined,
        stage: str(item.stage) || undefined,
        materials: str(item.materials) || undefined,
        rows: Array.isArray(item.rows)
          ? (item.rows as unknown[]).map((r) => {
              const row = (r ?? {}) as Record<string, unknown>;
              return { item: str(row.item), description: str(row.description) };
            })
          : undefined,
        informational: item.informational === true ? true : undefined,
        banner: str(item.banner) || undefined,
      };
    }),
  };
}

const optionalPrice = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? round3(n) : null;
};

function migrateMaterial(raw: unknown): Material {
  const m = (raw ?? {}) as Record<string, unknown>;
  return {
    id: str(m.id) || newId(),
    name: str(m.name),
    unitPrice: optionalPrice(m.unitPrice),
  };
}

function migrateReceipt(raw: unknown): MaterialReceipt {
  const r = (raw ?? {}) as Record<string, unknown>;
  const date = str(r.date);
  return {
    id: str(r.id) || newId(),
    date,
    fiscalYear: Number(r.fiscalYear) || fiscalYearOf(date),
    project: str(r.project),
    material: str(r.material),
    quantity: round3(Number(r.quantity) || 0),
    unitPrice: optionalPrice(r.unitPrice),
    receivedBy: str(r.receivedBy),
    note: str(r.note),
  };
}

const isAccountCode = (key: string) => /^\d{4}$/.test(key);
const isYearKey = (key: string) => /^\d{4}$/.test(key) && Number(key) > 1990;

function migrateYearOpening(raw: unknown): YearOpening {
  if (!raw || typeof raw !== "object") return {};
  const out: YearOpening = {};
  for (const [code, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isAccountCode(code)) continue;
    const v = (value ?? {}) as Record<string, unknown>;
    out[code] = { debit: str(v.debit), credit: str(v.credit) };
  }
  return out;
}

/**
 * الأرصدة الافتتاحية صارت مفهرسة بالسنة. البيانات القديمة كانت مسطّحة
 * (رقم الحساب مباشرة)، فتُنسب إلى السنة الحالية.
 */
function migrateOpeningBalances(raw: unknown): OpeningBalances {
  if (!raw || typeof raw !== "object") return {};
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length === 0) return {};

  const looksFlat = entries.some(([key, value]) => {
    if (!isAccountCode(key)) return false;
    const v = (value ?? {}) as Record<string, unknown>;
    return "debit" in v || "credit" in v;
  });

  if (looksFlat) {
    return { [String(new Date().getFullYear())]: migrateYearOpening(raw) };
  }

  const out: OpeningBalances = {};
  for (const [year, value] of entries) {
    if (!isYearKey(year)) continue;
    out[year] = migrateYearOpening(value);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* التحميل والحفظ                                                      */
/* ------------------------------------------------------------------ */

export type LoadResult = { state: AppState; errors: string[] };

function readKey(key: string, errors: string[]): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // بيانات تالفة: لا نُسقط التطبيق ولا نمحو الأصل — نُبلغ فقط
    errors.push(`تعذّرت قراءة «${key}» من التخزين المحلي (بيانات تالفة).`);
    return null;
  }
}

export function loadState(): LoadResult {
  const errors: string[] = [];
  const state = emptyState();
  if (typeof window === "undefined") return { state, errors };

  const movements = readKey(KEYS.movements, errors);
  if (Array.isArray(movements)) state.movements = movements.map(migrateMovement);

  const projects = readKey(KEYS.projects, errors);
  if (Array.isArray(projects)) state.projects = projects.map(migrateProject);

  const contractors = readKey(KEYS.contractors, errors);
  if (Array.isArray(contractors))
    state.contractors = contractors.map(migrateContractor);

  state.openingBalances = migrateOpeningBalances(
    readKey(KEYS.openingBalances, errors)
  );

  const materials = readKey(KEYS.materials, errors);
  if (Array.isArray(materials)) state.materials = materials.map(migrateMaterial);

  const receipts = readKey(KEYS.materialReceipts, errors);
  if (Array.isArray(receipts))
    state.materialReceipts = receipts.map(migrateReceipt);

  state.company = migrateCompany(readKey(KEYS.company, errors));

  const users = readKey(KEYS.users, errors);
  if (Array.isArray(users)) state.users = users.map(migrateUser);

  state.audit = migrateAudit(readKey(KEYS.audit, errors));
  state.yearLocks = migrateYearLocks(readKey(KEYS.yearLocks, errors));

  state.chart = migrateChart(readKey(KEYS.chart, errors));
  state.items = migrateItems(readKey(KEYS.items, errors));
  state.payments = migratePayments(readKey(KEYS.payments, errors));
  state.people = migratePeople(readKey(KEYS.people, errors));

  const employees = readKey(KEYS.employees, errors);
  if (Array.isArray(employees)) state.employees = employees.map(migrateEmployee);
  state.attendance = migrateAttendance(readKey(KEYS.attendance, errors));
  state.payrollRuns = migratePayrollRuns(readKey(KEYS.payrollRuns, errors));
  state.payrollSettings = migratePayrollSettings(
    readKey(KEYS.payrollSettings, errors)
  );

  state.workItems = migrateWorkItems(readKey(KEYS.workItems, errors));
  state.quotations = migrateQuotations(readKey(KEYS.quotations, errors));
  state.invoices = migrateInvoices(readKey(KEYS.invoices, errors));

  return { state, errors };
}

/** الحد الذي يُعدّ فقدانه فقداناً جماعياً لا حذفاً مقصوداً */
const MASS_LOSS_THRESHOLD = 3;

/**
 * يكتب مصفوفة، ويرفض أن يمحو بيانات قائمة بمصفوفة فارغة.
 *
 * حذف آخر سجل أو سجلين تصرّف طبيعي فيُسمح به. أما أن تصبح مجموعة فيها
 * ثلاثة سجلات أو أكثر فارغةً دفعةً واحدة فهو فقدان لا قرار، ويُمنع.
 * يعيد اسم المجموعة إن مُنع، وإلا null.
 */
function writeArray(key: string, label: string, value: unknown[]): string | null {
  if (value.length === 0) {
    try {
      const existing = localStorage.getItem(key);
      if (existing) {
        const parsed = JSON.parse(existing);
        if (Array.isArray(parsed) && parsed.length >= MASS_LOSS_THRESHOLD) {
          return `${label} (${parsed.length})`;
        }
      }
    } catch {
      // تعذّرت القراءة: نكتب كالمعتاد بدل تعطيل الحفظ
    }
  }
  localStorage.setItem(key, JSON.stringify(value));
  return null;
}

/** نقطة استعادة: نسخة من التخزين تُؤخذ مرة واحدة في الجلسة قبل أول كتابة */
const RESTORE_KEY = "restorePoint";

export function captureRestorePoint(): void {
  try {
    if (sessionStorage.getItem("restorePointTaken")) return;
    const snapshot: Record<string, string> = {};
    for (const key of Object.values(KEYS)) {
      const value = localStorage.getItem(key);
      if (value) snapshot[key] = value;
    }
    if (Object.keys(snapshot).length === 0) return;
    localStorage.setItem(
      RESTORE_KEY,
      JSON.stringify({ at: new Date().toISOString(), snapshot })
    );
    sessionStorage.setItem("restorePointTaken", "1");
  } catch {
    // نقطة الاستعادة رفاهية — لا تُعطّل الحفظ إن تعذّرت
  }
}

export function readRestorePoint(): { at: string; keys: number } | null {
  try {
    const raw = localStorage.getItem(RESTORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: string; snapshot: Record<string, string> };
    return { at: parsed.at, keys: Object.keys(parsed.snapshot ?? {}).length };
  } catch {
    return null;
  }
}

/** يعيد التخزين إلى نقطة الاستعادة. على المستدعي إعادة تحميل الصفحة بعدها */
export function applyRestorePoint(): boolean {
  try {
    const raw = localStorage.getItem(RESTORE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { snapshot: Record<string, string> };
    for (const [key, value] of Object.entries(parsed.snapshot ?? {})) {
      localStorage.setItem(key, value);
    }
    return true;
  } catch {
    return false;
  }
}

export function saveState(state: AppState): string | null {
  try {
    // نقطة استعادة قبل أول كتابة في الجلسة
    captureRestorePoint();

    const blocked = [
      writeArray(KEYS.movements, "الحركات", state.movements),
      writeArray(KEYS.projects, "المشاريع", state.projects),
      writeArray(KEYS.contractors, "العقود", state.contractors),
      writeArray(KEYS.materials, "المواد", state.materials),
      writeArray(KEYS.materialReceipts, "استلام المواد", state.materialReceipts),
      writeArray(KEYS.users, "المستخدمون", state.users),
      writeArray(KEYS.audit, "سجل التدقيق", state.audit),
      writeArray(KEYS.chart, "دليل الحسابات", state.chart),
      writeArray(KEYS.items, "البنود", state.items),
      writeArray(KEYS.payments, "طرق الدفع", state.payments),
      writeArray(KEYS.people, "الأشخاص", state.people),
      writeArray(KEYS.employees, "الموظفون", state.employees),
      writeArray(KEYS.attendance, "سجلات الحضور", state.attendance),
      writeArray(KEYS.payrollRuns, "مسيّرات الرواتب", state.payrollRuns),
      writeArray(KEYS.workItems, "بنود الأعمال", state.workItems),
      writeArray(KEYS.quotations, "عروض الأسعار", state.quotations),
      writeArray(KEYS.invoices, "الفواتير", state.invoices),
    ].filter(Boolean);

    localStorage.setItem(
      KEYS.openingBalances,
      JSON.stringify(state.openingBalances)
    );
    localStorage.setItem(KEYS.company, JSON.stringify(state.company));
    localStorage.setItem(KEYS.yearLocks, JSON.stringify(state.yearLocks));
    localStorage.setItem(
      KEYS.payrollSettings,
      JSON.stringify(state.payrollSettings)
    );

    if (blocked.length) {
      return `مُنع محو بيانات قائمة: ${blocked.join(" · ")}. لم تُحفظ هذه المجموعات فارغةً — أعد تحميل الصفحة لاستعادتها.`;
    }
    return null;
  } catch {
    return "تعذّر الحفظ في التخزين المحلي — قد تكون المساحة ممتلئة.";
  }
}

/* ------------------------------------------------------------------ */
/* النسخ الاحتياطي                                                     */
/* ------------------------------------------------------------------ */

export function exportBackup(state: AppState): string {
  return JSON.stringify(
    {
      app: "Theyab Accounting",
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: state,
    },
    null,
    2
  );
}

export function backupFileName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `theyab-accounting-${now.getFullYear()}-${pad(
    now.getMonth() + 1
  )}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

/**
 * يسوّي بياناتٍ خاماً إلى حالة النظام.
 *
 * مصدر البيانات لا يغيّر شكلها: ملفُ نسخةٍ احتياطية، أو صفوفٌ من
 * قاعدة البيانات، أو تخزينُ المتصفّح — كلّها تمرّ من هنا. فما يقرؤه
 * الخادم هو نفسه ما يقرؤه المتصفّح حرفاً بحرف، ولا يظهر فرقٌ بينهما
 * لأن أحدهما سوّى والآخر لم يسوِّ.
 */
export function normalizeState(raw: unknown): AppState {
  const data = (raw ?? {}) as Record<string, unknown>;
  const state = emptyState();
  if (Array.isArray(data.movements))
    state.movements = data.movements.map(migrateMovement);
  if (Array.isArray(data.projects))
    state.projects = data.projects.map(migrateProject);
  if (Array.isArray(data.contractors))
    state.contractors = data.contractors.map(migrateContractor);
  state.openingBalances = migrateOpeningBalances(data.openingBalances);
  if (Array.isArray(data.materials))
    state.materials = data.materials.map(migrateMaterial);
  if (Array.isArray(data.materialReceipts))
    state.materialReceipts = data.materialReceipts.map(migrateReceipt);
  if (data.company) state.company = migrateCompany(data.company);
  if (Array.isArray(data.users)) state.users = data.users.map(migrateUser);
  state.audit = migrateAudit(data.audit);
  state.yearLocks = migrateYearLocks(data.yearLocks);
  state.chart = migrateChart(data.chart);
  state.items = migrateItems(data.items);
  state.payments = migratePayments(data.payments);
  state.people = migratePeople(data.people);
  if (Array.isArray(data.employees))
    state.employees = data.employees.map(migrateEmployee);
  state.attendance = migrateAttendance(data.attendance);
  state.payrollRuns = migratePayrollRuns(data.payrollRuns);
  state.payrollSettings = migratePayrollSettings(data.payrollSettings);
  state.workItems = migrateWorkItems(data.workItems);
  state.quotations = migrateQuotations(data.quotations);
  state.invoices = migrateInvoices(data.invoices);

  return state;
}

/** نسخة احتياطية من ملف — تُسوّى بنفس المسوّي */
export function parseBackup(text: string): AppState {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  const data = parsed.data ?? parsed;
  if (!data || typeof data !== "object") {
    throw new Error("الملف لا يحتوي على بيانات صالحة");
  }
  return normalizeState(data);
}
