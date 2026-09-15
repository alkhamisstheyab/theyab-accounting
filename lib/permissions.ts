/**
 * الصلاحيات والأدوار.
 *
 * الصلاحيات دقيقة ومستقلة، والأدوار مجرّد قوالب جاهزة تملأ مجموعة منها،
 * فيستطيع المالك أن يمنح أي شخص أي تركيبة يريدها بلا التقيّد بدور.
 *
 * تنبيه: ما دامت البيانات في المتصفح، فهذه الصلاحيات تنظيم للواجهة لا
 * حماية أمنية — من يفتح أدوات المطوّر يستطيع تجاوزها. تصبح حقيقية عند
 * الانتقال إلى خادم، والنموذج هنا مصمّم لينتقل كما هو.
 */

export type Permission =
  // الحركات والقيود
  | "movements.view"
  | "movements.create"
  | "movements.edit"
  | "movements.delete"
  | "movements.approve"
  | "journal.view"
  | "ledger.view"
  // التقارير والقوائم
  | "trialBalance.view"
  | "financials.view"
  | "reports.view"
  // الملفات
  | "projects.view"
  | "projects.manage"
  | "contractors.view"
  | "contractors.manage"
  | "contracts.approve"
  | "contracts.confirm"
  | "quotations.view"
  | "quotations.manage"
  | "quotations.cost"
  | "quotations.pricing"
  | "invoices.view"
  | "invoices.manage"
  | "advances.view"
  | "materials.view"
  | "materials.manage"
  | "employees.view"
  | "employees.manage"
  | "attendance.manage"
  | "payroll.run"
  | "chart.view"
  | "chart.manage"
  // الأرصدة والإقفال
  | "opening.view"
  | "opening.manage"
  | "year.close"
  // المخرجات
  | "print"
  | "vouchers.print"
  | "export"
  // الإدارة
  | "backup.run"
  | "backup.restore"
  | "settings.manage"
  | "users.manage"
  | "audit.view";

export type PermissionGroup = {
  group: string;
  items: { key: Permission; label: string; note?: string }[];
};

export const PERMISSION_CATALOGUE: PermissionGroup[] = [
  {
    group: "الحركات والقيود",
    items: [
      { key: "movements.view", label: "الاطلاع على الحركات اليومية" },
      { key: "movements.create", label: "إدخال حركة جديدة" },
      { key: "movements.edit", label: "تعديل حركة قائمة" },
      { key: "movements.delete", label: "حذف حركة", note: "صلاحية خطرة" },
      {
        key: "movements.approve",
        label: "اعتماد الحركات ودخولها الدفاتر",
        note: "صاحب الشركة والمدير العام والمدير المالي",
      },
      { key: "journal.view", label: "الاطلاع على القيود اليومية" },
      { key: "ledger.view", label: "الاطلاع على دفتر الأستاذ" },
    ],
  },
  {
    group: "التقارير والقوائم المالية",
    items: [
      { key: "trialBalance.view", label: "ميزان المراجعة" },
      { key: "financials.view", label: "القوائم المالية" },
      { key: "reports.view", label: "التقارير التحليلية" },
    ],
  },
  {
    group: "الملفات",
    items: [
      { key: "projects.view", label: "الاطلاع على المشاريع" },
      { key: "projects.manage", label: "إضافة وتعديل المشاريع" },
      { key: "contractors.view", label: "الاطلاع على عقود المقاولين" },
      { key: "contractors.manage", label: "إدارة العقود والدفعات" },
      {
        key: "contracts.approve",
        label: "اعتماد إنجاز المراحل",
        note: "شهادة المهندس الفنية بالإنجاز",
      },
      {
        key: "contracts.confirm",
        label: "إقرار المرحلة بعد اعتماد المهندس",
        note: "بها تصبح الدفعة مستحقة فعلاً",
      },
      { key: "quotations.view", label: "الاطلاع على عروض الأسعار" },
      { key: "quotations.manage", label: "إعداد عروض الأسعار وتحرير بنود الأعمال" },
      {
        key: "quotations.cost",
        label: "رؤية التكلفة وهامش الربح",
        note: "أرقام داخلية لا تُعرض على العميل",
      },
      {
        key: "quotations.pricing",
        label: "تحديث أسعار التكلفة حسب السوق",
        note: "مهمة المهندس — لا تمسّ أسعار البيع",
      },
      { key: "invoices.view", label: "الاطلاع على الفواتير وطباعتها" },
      { key: "invoices.manage", label: "إصدار فواتير العملاء" },
      { key: "advances.view", label: "متابعة السلف والعهد" },
      { key: "materials.view", label: "الاطلاع على استلام المواد" },
      { key: "materials.manage", label: "تسجيل استلام المواد" },
      { key: "employees.view", label: "الاطلاع على ملف الموظفين" },
      { key: "employees.manage", label: "إضافة وتعديل الموظفين والرواتب" },
      { key: "attendance.manage", label: "تسجيل الحضور والانصراف" },
      {
        key: "payroll.run",
        label: "إعداد مسيّر الرواتب وترحيله",
        note: "صلاحية خطرة",
      },
      { key: "chart.view", label: "الاطلاع على دليل الحسابات" },
      {
        key: "chart.manage",
        label: "تحرير البيانات الأساسية",
        note: "دليل الحسابات والبنود",
      },
    ],
  },
  {
    group: "الأرصدة والإقفال",
    items: [
      { key: "opening.view", label: "الاطلاع على الأرصدة الافتتاحية" },
      { key: "opening.manage", label: "تعديل الأرصدة الافتتاحية", note: "صلاحية خطرة" },
      { key: "year.close", label: "ترحيل أرصدة السنة", note: "صلاحية خطرة" },
    ],
  },
  {
    group: "الطباعة والتصدير",
    items: [
      { key: "print", label: "طباعة الشاشات والتقارير" },
      { key: "vouchers.print", label: "طباعة سندات القبض والصرف" },
      { key: "export", label: "التصدير إلى Excel" },
    ],
  },
  {
    group: "الإدارة",
    items: [
      { key: "backup.run", label: "أخذ نسخة احتياطية" },
      { key: "backup.restore", label: "استيراد واستبدال البيانات", note: "صلاحية خطرة" },
      { key: "settings.manage", label: "بيانات الشركة والإعدادات" },
      { key: "users.manage", label: "إدارة المستخدمين والصلاحيات", note: "صلاحية خطرة" },
      { key: "audit.view", label: "الاطلاع على سجل التدقيق" },
    ],
  },
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_CATALOGUE.flatMap((g) =>
  g.items.map((i) => i.key)
);

export const permissionLabel = (key: Permission): string =>
  PERMISSION_CATALOGUE.flatMap((g) => g.items).find((i) => i.key === key)
    ?.label ?? key;

/* ------------------------------------------------------------------ */
/* الأدوار                                                             */
/* ------------------------------------------------------------------ */

export type RoleKey =
  | "owner"
  | "manager"
  | "secretary"
  | "engineer"
  | "custom";

export type RoleDefinition = {
  key: RoleKey;
  label: string;
  description: string;
  permissions: Permission[];
};

/** السكرتارية: اطلاع وطباعة فقط — بلا إدخال ولا تعديل ولا حذف */
const SECRETARY: Permission[] = [
  "movements.view",
  "journal.view",
  "ledger.view",
  "trialBalance.view",
  "financials.view",
  "reports.view",
  "projects.view",
  "contractors.view",
  // الاطلاع والطباعة دون التكلفة — الهامش لا يخرج من دائرة الإدارة
  "quotations.view",
  "invoices.view",
  "advances.view",
  "materials.view",
  "chart.view",
  "opening.view",
  "print",
  "vouchers.print",
  "export",
];

export const ROLES: RoleDefinition[] = [
  {
    key: "owner",
    label: "صاحب الشركة / شريك",
    description:
      "كل الصلاحيات بلا استثناء، بما فيها تسجيل مستخدمين جدد ومنحهم ما يشاء من صلاحيات.",
    permissions: ALL_PERMISSIONS,
  },
  {
    key: "manager",
    label: "المدير العام المالي والإداري",
    description:
      "كل الصلاحيات بلا استثناء، بما فيها إدارة المستخدمين والصلاحيات.",
    permissions: ALL_PERMISSIONS,
  },
  {
    key: "secretary",
    label: "سكرتير / سكرتيرة",
    description:
      "الاطلاع على الحركات والتقارير وطباعتها، وطباعة سندات القبض والصرف — دون إدخال أو تعديل أو حذف.",
    permissions: SECRETARY,
  },
  {
    key: "engineer",
    label: "مهندس مشرف على المشاريع",
    description:
      "متابعة المشاريع وإنجازها والعقود المرتبطة بها، واعتماد المراحل المنجزة لتصبح دفعاتها مستحقة — دون اطلاع على القوائم المالية أو أرصدة الشركة.",
    permissions: [
      "projects.view",
      "contractors.view",
      "contracts.approve",
      "quotations.view",
      // المهندس يتابع السوق، فيرى التكلفة ويحدّثها — ولا يمسّ سعر البيع
      "quotations.cost",
      "quotations.pricing",
      "materials.view",
      "materials.manage",
      "print",
    ],
  },
  {
    key: "custom",
    label: "صلاحيات مخصّصة",
    description: "تُحدَّد الصلاحيات يدوياً بلا التقيّد بقالب.",
    permissions: [],
  },
];

export const roleDefinition = (key: RoleKey): RoleDefinition =>
  ROLES.find((r) => r.key === key) ?? ROLES[ROLES.length - 1];

/* ------------------------------------------------------------------ */
/* ربط الشاشات بالصلاحيات                                              */
/* ------------------------------------------------------------------ */

export const PAGE_PERMISSION: Record<string, Permission> = {
  "إدخال حركة": "movements.create",
  "جدول الحركات": "movements.view",
  "القيود اليومية": "journal.view",
  "دفتر الأستاذ": "ledger.view",
  "ميزان المراجعة": "trialBalance.view",
  "القوائم المالية": "financials.view",
  التقارير: "reports.view",
  المشاريع: "projects.view",
  المقاولون: "contractors.view",
  "ربط الحركات": "contractors.manage",
  "عروض الأسعار": "quotations.view",
  // يفتحها المهندس لتحديث التكلفة، والإدارة لتحرير كل شيء
  "بنود الأعمال": "quotations.pricing",
  الفواتير: "invoices.view",
  "اعتماد الحركات": "movements.approve",
  "اعتماد المراحل": "contracts.approve",
  "متابعة السلف": "advances.view",
  "استلام المواد": "materials.view",
  "دليل الحسابات": "chart.view",
  "الأرصدة الافتتاحية": "opening.view",
  المستخدمون: "users.manage",
  "سجل التدقيق": "audit.view",
  "البيانات الأساسية": "chart.manage",
  الموظفون: "employees.view",
  "الحضور والانصراف": "attendance.manage",
  "مسيّر الرواتب": "payroll.run",
  // شاشة النقل إلى الخادم: يفتحها من يملك الإعدادات، لا كل من يُدخل حركة
  "مطابقة الخادم": "settings.manage",
};

/* ------------------------------------------------------------------ */
/* الفحص                                                               */
/* ------------------------------------------------------------------ */

export type PermissionHolder = { permissions: Permission[] } | null;

export function can(user: PermissionHolder, permission: Permission): boolean {
  if (!user) return false;
  return user.permissions.includes(permission);
}

export function canAny(
  user: PermissionHolder,
  permissions: Permission[]
): boolean {
  return permissions.some((p) => can(user, p));
}
