/**
 * دليل الحسابات وخرائط الترحيل — مولّد آلياً من ملف «النظام المحاسبي 2026.xlsm»
 *
 * لا تُحرّر هذا الملف يدوياً. عدّل الإكسل ثم أعد التوليد، أو انقل التعديل
 * إلى الإكسل أولاً حتى يبقى المصدران متطابقين.
 *
 * وُلّد في: 2026-09-08
 * الحسابات: 73 · البنود: 33 · طرق الدفع: 6
 */

export type AccountType = "أصول" | "إلتزامات" | "حقوق الملكية" | "إيرادات" | "مصروفات";
export type AccountNature = "مدين" | "دائن";

export type Account = {
  code: string;
  name: string;
  /** رقم الحساب الأب، فارغ للحسابات الجذرية */
  parent: string;
  type: AccountType;
  nature: AccountNature;
  level: number;
  /** القائمة التي يظهر فيها الحساب */
  statement: string;
  active: boolean;
  /** يسمح بالترحيل: الحسابات الرئيسية تجميعية ولا تُرحّل عليها القيود */
  postable: boolean;
};

export const CHART_OF_ACCOUNTS: Account[] = [
  { code: "1000", name: "الأصول", parent: "", type: "أصول", nature: "مدين", level: 1, statement: "قائمة المركز المالي", active: true, postable: false },
  { code: "1100", name: "الأصول المتداولة", parent: "1000", type: "أصول", nature: "مدين", level: 2, statement: "قائمة المركز المالي", active: true, postable: false },
  { code: "1110", name: "النقدية ومافي حكمها", parent: "1100", type: "أصول", nature: "مدين", level: 3, statement: "قائمة المركز المالي", active: true, postable: false },
  { code: "1111", name: "الصندوق", parent: "1110", type: "أصول", nature: "مدين", level: 4, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "1112", name: "البنك", parent: "1110", type: "أصول", nature: "مدين", level: 4, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "1120", name: "العملاء والذمم المالية", parent: "1110", type: "أصول", nature: "مدين", level: 3, statement: "قائمة المركز المالي", active: true, postable: false },
  { code: "1121", name: "حسابات العملاء", parent: "1120", type: "أصول", nature: "مدين", level: 4, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "1130", name: "دفعات مقدمة للموردين والمقاولين", parent: "1100", type: "أصول", nature: "مدين", level: 3, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "1140", name: "سلف وعهد الموظفين", parent: "1100", type: "أصول", nature: "مدين", level: 3, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "1150", name: "مصروفات مدفوعة مقدما", parent: "1100", type: "أصول", nature: "مدين", level: 3, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "1200", name: "الأصول غير المتداولة", parent: "1000", type: "أصول", nature: "مدين", level: 2, statement: "قائمة المركز المالي", active: true, postable: false },
  { code: "1210", name: "الأصول الثابتة", parent: "1200", type: "أصول", nature: "مدين", level: 3, statement: "قائمة المركز المالي", active: true, postable: false },
  { code: "1211", name: "السيارات والمركبات", parent: "1210", type: "أصول", nature: "مدين", level: 3, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "1212", name: "المعدات والآلات", parent: "1210", type: "أصول", nature: "مدين", level: 4, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "1213", name: "الأثاث والتجهيزات", parent: "1210", type: "أصول", nature: "مدين", level: 4, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "1214", name: "أجهزة الكمبيوتر والمعدات المكتبية", parent: "1210", type: "أصول", nature: "مدين", level: 4, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "1240", name: "سلف الموظفين", parent: "1200", type: "أصول", nature: "مدين", level: 3, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "1520", name: "أجهزة ومعدات", parent: "1200", type: "أصول", nature: "مدين", level: 3, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "2000", name: "الإلتزامات", parent: "", type: "إلتزامات", nature: "دائن", level: 1, statement: "قائمة المركز المالي", active: true, postable: false },
  { code: "2100", name: "الإلتزامات المتداولة", parent: "2000", type: "إلتزامات", nature: "دائن", level: 2, statement: "قائمة المركز المالي", active: true, postable: false },
  { code: "2110", name: "الموردون والذمم الدائنة", parent: "2100", type: "إلتزامات", nature: "دائن", level: 3, statement: "قائمة المركز المالي", active: true, postable: false },
  { code: "2111", name: "حسابات الموردين", parent: "2110", type: "إلتزامات", nature: "دائن", level: 4, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "2120", name: "مستحقات المقاولين", parent: "2100", type: "إلتزامات", nature: "دائن", level: 3, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "2130", name: "مصروفات مستحقة", parent: "2100", type: "إلتزامات", nature: "دائن", level: 3, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "2135", name: "بطاقة إئتمان-بنك الخليج", parent: "2100", type: "إلتزامات", nature: "دائن", level: 3, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "2136", name: "بطاقة إئتمان-بيت التمويل", parent: "2100", type: "إلتزامات", nature: "دائن", level: 3, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "2140", name: "رواتب وأجور مستحقة", parent: "2100", type: "إلتزامات", nature: "دائن", level: 3, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "2150", name: "دفعات مقدمة من العملاء", parent: "2100", type: "إلتزامات", nature: "دائن", level: 3, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "2160", name: "جاري المستثمرين", parent: "2100", type: "إلتزامات", nature: "دائن", level: 3, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "2161", name: "جاري الشركاء", parent: "2100", type: "إلتزامات", nature: "دائن", level: 3, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "2200", name: "الإلتزامات غير المتداولة", parent: "2000", type: "إلتزامات", nature: "دائن", level: 2, statement: "قائمة المركز المالي", active: true, postable: false },
  { code: "2210", name: "قروض طولية الأجل", parent: "2200", type: "إلتزامات", nature: "دائن", level: 3, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "3000", name: "حقوق الملكية", parent: "", type: "حقوق الملكية", nature: "دائن", level: 1, statement: "قائمة المركز المالي", active: true, postable: false },
  { code: "3100", name: "رأس المال", parent: "3000", type: "حقوق الملكية", nature: "دائن", level: 2, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "3200", name: "إحتياطيات", parent: "3000", type: "حقوق الملكية", nature: "دائن", level: 2, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "3300", name: "أرباح أو خسائر مرحلة", parent: "3000", type: "حقوق الملكية", nature: "دائن", level: 2, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "3400", name: "صافي ربح أو خسارة السنة", parent: "3000", type: "حقوق الملكية", nature: "دائن", level: 2, statement: "قائمة المركز المالي", active: true, postable: true },
  { code: "4000", name: "الإيرادات", parent: "", type: "إيرادات", nature: "دائن", level: 1, statement: "قائمة الدخل", active: true, postable: false },
  { code: "4100", name: "إيرادات المقاولات", parent: "4000", type: "إيرادات", nature: "دائن", level: 2, statement: "قائمة الدخل", active: true, postable: false },
  { code: "4110", name: "إيرادات عقود المشاريع", parent: "4100", type: "إيرادات", nature: "دائن", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "4200", name: "إيرادات أخرى", parent: "4000", type: "إيرادات", nature: "دائن", level: 2, statement: "قائمة الدخل", active: true, postable: true },
  { code: "5000", name: "تكاليف المشاريع", parent: "", type: "مصروفات", nature: "مدين", level: 1, statement: "قائمة الدخل", active: true, postable: false },
  { code: "5100", name: "تكاليف التنفيذ المباشرة", parent: "5000", type: "مصروفات", nature: "مدين", level: 2, statement: "قائمة الدخل", active: true, postable: false },
  { code: "5110", name: "مواد إنشائية", parent: "5100", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "5120", name: "أجور المقاولين", parent: "5100", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "5130", name: "أجور العمالة المباشرة", parent: "5100", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "5140", name: "إيجار المعدات", parent: "5100", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "5150", name: "نقليات", parent: "5100", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "5160", name: "بنزين وديزل", parent: "5100", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "5170", name: "مصروفات حكومية للمشاريع", parent: "5100", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "5180", name: "كهرباء وماء للمشاريع", parent: "5100", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "5190", name: "تأمينات المشاريع", parent: "5100", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "5191", name: "ملابس ومعدات سلامة", parent: "5100", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "5192", name: "أدوات وعدد", parent: "5100", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "5193", name: "تجهيز مواقع المشاريع", parent: "5100", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "5194", name: "أعمال مساحية", parent: "5100", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "5199", name: "تكاليف مشاريع أخرى", parent: "5100", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "6000", name: "المصروفات الإدارية والعمومية", parent: "", type: "مصروفات", nature: "مدين", level: 1, statement: "قائمة الدخل", active: true, postable: false },
  { code: "6100", name: "مصروفات الموظفين", parent: "6000", type: "مصروفات", nature: "مدين", level: 2, statement: "قائمة الدخل", active: true, postable: false },
  { code: "6110", name: "رواتب وأجور إدارية", parent: "6100", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "6120", name: "مكافآت وبدلات الموظفين", parent: "6100", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "6200", name: "مصروفات التشغيل والإدارة", parent: "6000", type: "مصروفات", nature: "مدين", level: 2, statement: "قائمة الدخل", active: true, postable: false },
  { code: "6210", name: "إيجارات", parent: "6200", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "6220", name: "كهرباء وماء", parent: "6200", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "6230", name: "إتصالات وإنترنت", parent: "6200", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "6240", name: "قرطاسية ومطبوعات", parent: "6200", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "6250", name: "صيانة وإصلاحات", parent: "6200", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "6260", name: "رسوم ومصروفات حكومية", parent: "6200", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "6270", name: "أتعاب مهنية وإستشارية", parent: "6200", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "6280", name: "مصروفات بنكية", parent: "6200", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "6290", name: "مصروفات إدارية أخرى", parent: "6200", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
  { code: "6300", name: "الإهلاك", parent: "6000", type: "مصروفات", nature: "مدين", level: 2, statement: "قائمة الدخل", active: true, postable: false },
  { code: "6310", name: "مصروف إهلاك الأصول الثابتة", parent: "6300", type: "مصروفات", nature: "مدين", level: 3, statement: "قائمة الدخل", active: true, postable: true },
];

/** بند الحركة كما هو معرّف في ورقة tblMap */
export type ItemDefinition = {
  /** كود البند، مثل EXP004 */
  code: string;
  name: string;
  /** رقم الحساب الذي يُرحّل إليه البند، فارغ إن لم يُحدَّد في الإكسل */
  account: string;
};

export const ITEM_MAP: ItemDefinition[] = [
  { code: "EXP001", name: "وقود", account: "5160" },
  { code: "EXP002", name: "صيانة", account: "6250" },
  { code: "EXP003", name: "نقدي", account: "1111" },
  { code: "EXP004", name: "مواد إنشائية", account: "5110" },
  { code: "EXP005", name: "إيجار معدات", account: "5140" },
  { code: "EXP006", name: "كهرباء وماء", account: "6220" },
  { code: "EXP007", name: "رسوم", account: "6260" },
  { code: "EXP008", name: "رواتب", account: "6110" },
  { code: "EXP009", name: "مصروف إداري", account: "6290" },
  { code: "EXP010", name: "إشراف", account: "5130" },
  { code: "EXP011", name: "هاتف", account: "6230" },
  { code: "EXP012", name: "نقليات", account: "5120" },
  { code: "EXP013", name: "سلف الموظفين", account: "1240" },
  { code: "EXP014", name: "البنك", account: "1110" },
  { code: "EXP015", name: "الصندوق", account: "1120" },
  { code: "EXP016", name: "العملاء", account: "1130" },
  { code: "EXP017", name: "الموردون", account: "2110" },
  { code: "EXP018", name: "رأس المال", account: "3100" },
  { code: "EXP019", name: "رسوم بنكية", account: "6280" },
  { code: "EXP020", name: "تحويل بنكي", account: "1110" },
  { code: "EXP021", name: "أدوات وعدد", account: "5192" },
  { code: "EXP022", name: "جاري المستثمرين", account: "2160" },
  { code: "EXP023", name: "جاري الشركاء", account: "2161" },
  { code: "EXP024", name: "أجور مقاولين", account: "5120" },
  { code: "EXP025", name: "حسابات العملاء", account: "1121" },
  { code: "EXP026", name: "أجهزة ومعدات", account: "1520" },
  { code: "EXP027", name: "بطاقة إئتمان-بنك الخليج", account: "2135" },
  { code: "EXP028", name: "بطاقة إئتمان-بيت التمويل", account: "2136" },
  { code: "EXP029", name: "القيد الإفتتاحي", account: "" },
  { code: "EXP030", name: "أثاث وتجهيزات مكتبية", account: "1213" },
  { code: "EXP031", name: "سلف وعهد الموظفين", account: "1140" },
  { code: "EXP032", name: "تجهيز موقع", account: "5193" },
  { code: "EXP033", name: "أعمال مساحية", account: "5194" },
];

/** طريقة الدفع والحساب المقابل، من ورقة PostingMap */
export const PAYMENT_MAP: { label: string; account: string }[] = [
  { label: "نقدي", account: "1111" },
  { label: "كي نت", account: "1112" },
  { label: "شيك", account: "1112" },
  { label: "تحويل ومض", account: "1112" },
  { label: "رابط دفع", account: "1112" },
  { label: "تحويل بنكي", account: "1112" },
];
