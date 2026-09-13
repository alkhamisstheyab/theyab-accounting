/**
 * عروض الأسعار وكتالوج بنود الأعمال.
 *
 * البنية منقولة من ملف «مراحل البناء» الذي بناه صاحب الشركة في إكسل:
 * شجرة من أربعة مستويات (مرحلة ← قسم ← بند ← تفصيل)، لكل ورقة عمود
 * «سعر التكلفة» وعمود «سعر البيع» وعمود «إختيار العميل».
 *
 * وحدود النطاقات الثلاثة مأخوذة من عقد عواطف القرطاس المبرم: العقد
 * يكتب «الانتهاء من الهيكل الأسود» بعد المرحلة السادسة، و«الانتهاء من
 * أعمال النصف تشطيب» بعد الثامنة — فالنطاقات نقاط توقّف على سلّم واحد
 * لا ثلاثة عقود مختلفة.
 */

import { round3 } from "./accounting";

/** بند في كتالوج الأعمال — يُحرَّر مرة، ويرثه كل عرض بعده */
export type WorkItem = {
  id: string;
  /** المرحلة: تجهيز الموقع، الحفر والتدعيم، الهيكل الأسود… */
  stage: string;
  /** القسم داخل المرحلة: لوازم الموقع، حدادة، نجارة… */
  section: string;
  /** البند: خيمة، حارس، مقطوعة… */
  name: string;
  /** التفصيل: قص وطعج، تربيط… */
  detail: string;
  description: string;
  unit: string;
  quantity: number;
  /**
   * ما يكلّفنا اليوم — لا يظهر للعميل أبداً.
   *
   * سعر سوق متغيّر، يحدّثه المهندس كلما تحرّكت الأسعار. ولذلك يحمل معه
   * تاريخ آخر تحديث واسم من حدّثه: تكلفة قديمة تُنتج عرضاً خاسراً وهي
   * تبدو سليمة، فالتاريخ جزء من الرقم لا زينة بجانبه.
   */
  cost: number;
  /** ISO datetime لآخر تعديل على التكلفة */
  costUpdatedAt: string;
  costUpdatedBy: string;
  /** ما نبيع به */
  price: number;

  /**
   * حصة المواد من التكلفة والسعر — والباقي مصنعية.
   *
   * ورقة تكلفة الشركة تفصلهما صراحةً: «الصحي — مصنعيات ١١٨٠ · مواد ١٦٠٠».
   * وبعض العقود على المصنعية وحدها والمواد على المالك، فبهذا الفصل يخرج
   * العرضان من بند واحد بلا إعادة تسعير.
   *
   * صفر يعني أن البند كله مصنعية — وهو حال البنود المنقولة قبل الفصل.
   */
  materialCost: number;
  materialPrice: number;
  /**
   * بند لا يقوم البناء بدونه، فلا يُشطب من العرض.
   *
   * التمييز يحمي العرض: العميل يشطب المصعد ولا يشطب صب القواعد.
   */
  essential: boolean;
  active: boolean;
  notes: string;
};

/** سطر داخل عرض سعر — نسخة من البند وقت إعداد العرض */
export type QuotationLine = {
  itemId: string;
  stage: string;
  section: string;
  name: string;
  detail: string;
  description: string;
  unit: string;
  quantity: number;
  cost: number;
  price: number;
  materialCost: number;
  materialPrice: number;
  essential: boolean;
  /** أشّر عليه العميل؟ الأساسي مختار دائماً */
  chosen: boolean;
  /** بند أُضيف لهذا العرض وحده، ليس من الكتالوج */
  custom?: boolean;
};

/**
 * على أي أساس يُسعَّر العرض.
 *
 * «مصنعية ومواد» = العرض يشمل الاثنين · «مصنعيات فقط» = المواد على
 * المالك، فتُطرح حصتها من كل بند ويبقى أجر العمل.
 */
export type PricingMode = "مصنعية ومواد" | "مصنعيات فقط";

export const PRICING_MODES: PricingMode[] = ["مصنعية ومواد", "مصنعيات فقط"];

export type Quotation = {
  id: string;
  /** رقم العرض كما يُطبع */
  number: string;
  /** yyyy-mm-dd */
  date: string;
  status: QuotationStatus;

  clientName: string;
  clientPhone: string;
  clientCivilId: string;
  clientAddress: string;

  /* موقع العمل — بنفس حقول العقد */
  area: string;
  block: string;
  plot: string;
  licenseNumber: string;
  buildingDescription: string;
  builtArea: number;

  scope: ScopeKey;
  /** مصنعية ومواد، أم مصنعيات والمواد على المالك */
  pricingMode: PricingMode;
  /**
   * نسبة الإضافة على التكلفة، تُطبَّق بزرّ متى شئت — قبل اختيار البنود
   * أو بعده. تُحفظ مع العرض فيبقى معلوماً على أي أساس سُعِّر.
   */
  marginPercent: number;
  durationDays: number;
  /** صلاحية العرض بالأيام من تاريخه */
  validityDays: number;

  lines: QuotationLine[];
  notes: string;

  /** رقم العقد الذي تحوّل إليه — فارغ ما لم يُقبل */
  contractNumber: string;
  createdBy: string;
  createdAt: string;
  /** آخر تعديل — يُختم مع كل تغيير، فتعرف عمر المسودة */
  updatedAt: string;
};

export type QuotationStatus = "مسودة" | "مقدَّم" | "مقبول" | "مرفوض";

export const QUOTATION_STATUSES: QuotationStatus[] = [
  "مسودة",
  "مقدَّم",
  "مقبول",
  "مرفوض",
];

/* ------------------------------------------------------------------ */
/* المراحل والنطاقات                                                   */
/* ------------------------------------------------------------------ */

/** ترتيب المراحل كما في ورقة «القوائم» */
export const STAGES = [
  "تجهيز الموقع",
  "الحفر والتدعيم",
  "الهيكل الأسود",
  "النصف تشطيب",
  "التشطيب",
  "الميكانيك",
  "الديكورات الإضافية",
];

export type ScopeKey =
  | "هيكل أسود"
  | "نصف تشطيب"
  | "تشطيب كامل"
  | "تشطيبات";

export const SCOPES: {
  key: ScopeKey;
  label: string;
  note: string;
  stages: string[];
  /** نطاق حرّ بلا بنود أساسية */
  freeForm?: boolean;
}[] = [
  {
    key: "هيكل أسود",
    label: "هيكل أسود",
    note: "من تجهيز الموقع حتى الانتهاء من الهيكل الخرساني والطابوق",
    stages: ["تجهيز الموقع", "الحفر والتدعيم", "الهيكل الأسود"],
  },
  {
    key: "نصف تشطيب",
    label: "نصف تشطيب",
    note: "الهيكل الأسود، ومعه الكهرباء والصحي والمساح والسيجما والصبغ",
    stages: [
      "تجهيز الموقع",
      "الحفر والتدعيم",
      "الهيكل الأسود",
      "النصف تشطيب",
    ],
  },
  {
    key: "تشطيب كامل",
    label: "تشطيب كامل",
    note: "كل المراحل حتى التسليم — التشطيب والميكانيك والديكورات",
    stages: STAGES,
  },
  {
    key: "تشطيبات",
    label: "تشطيبات فقط",
    note: "عقد تشطيب على مبنى قائم — تصميم مكتب أو ما شابهه. بلا بنود أساسية، يُصاغ بنداً بنداً.",
    stages: ["التشطيب", "الميكانيك", "الديكورات الإضافية"],
    freeForm: true,
  },
];

/** نطاق حرّ: لا بند فيه أساسي، ويُبنى بالاختيار والإضافة لا بالقالب */
export const isFreeFormScope = (key: ScopeKey): boolean =>
  scopeDefinition(key).freeForm === true;

export const scopeDefinition = (key: ScopeKey) =>
  SCOPES.find((s) => s.key === key) ?? SCOPES[0];

/** المراحل الداخلة في نطاق، مرتّبة كترتيب STAGES */
export const stagesOfScope = (key: ScopeKey): string[] =>
  STAGES.filter((s) => scopeDefinition(key).stages.includes(s));

/* ------------------------------------------------------------------ */
/* بناء العرض                                                          */
/* ------------------------------------------------------------------ */

/**
 * يبني سطور عرض من الكتالوج لنطاق معيّن.
 *
 * البند الأساسي مختار سلفاً، والاختياري يُترك للعميل — فالجلسة تبدأ
 * بالحد الأدنى الذي لا خلاف عليه، ويُضاف إليه ما يطلبه.
 */
export function linesForScope(
  catalogue: WorkItem[],
  scope: ScopeKey,
  previous: QuotationLine[] = []
): QuotationLine[] {
  const stages = stagesOfScope(scope);
  const free = isFreeFormScope(scope);
  const kept = new Map(previous.map((l) => [l.itemId, l]));

  return catalogue
    .filter((item) => item.active && stages.includes(item.stage))
    .sort(
      (a, b) =>
        STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) ||
        a.section.localeCompare(b.section, "ar")
    )
    .map((item) => {
      // تبديل النطاق لا يمحو ما اختاره العميل في المراحل المشتركة
      const before = kept.get(item.id);
      // النطاق الحرّ لا أساسي فيه — كل بند اختيار
      const essential = free ? false : item.essential;
      return {
        itemId: item.id,
        stage: item.stage,
        section: item.section,
        name: item.name,
        detail: item.detail,
        description: item.description,
        unit: item.unit,
        quantity: before?.quantity ?? item.quantity,
        cost: before?.cost ?? item.cost,
        price: before?.price ?? item.price,
        materialCost: before?.materialCost ?? item.materialCost,
        materialPrice: before?.materialPrice ?? item.materialPrice,
        essential,
        chosen: before?.chosen ?? essential,
      };
    })
    // البنود الخاصة بهذا العرض لا مكان لها في الكتالوج، فتُحمل معه
    .concat(previous.filter((l) => l.custom));
}

/** بند يُضاف لعرض بعينه — للأعمال التي لا يعرفها الكتالوج */
export function customLine(stage: string, section: string): QuotationLine {
  return {
    itemId: `custom-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stage,
    section,
    name: "",
    detail: "",
    description: "",
    unit: "",
    quantity: 1,
    cost: 0,
    price: 0,
    materialCost: 0,
    materialPrice: 0,
    essential: false,
    chosen: true,
    custom: true,
  };
}

const lineTotal = (line: QuotationLine, rate: number) =>
  round3((line.quantity || 1) * rate);

/**
 * سعر السطر على أساس التسعير المختار.
 *
 * في «مصنعيات فقط» تُطرح حصة المواد ويبقى أجر العمل. وحصة المواد صفر
 * في البنود التي لم تُفصَّل بعد، فالوضعان متساويان فيها — وهذا صحيح:
 * بندٌ لم نفصل مواده لا نعرف كم نطرح منه.
 */
export const linePrice = (
  line: QuotationLine,
  mode: PricingMode = "مصنعية ومواد"
) =>
  lineTotal(
    line,
    mode === "مصنعيات فقط"
      ? Math.max(0, round3(line.price - line.materialPrice))
      : line.price
  );

export const lineCost = (
  line: QuotationLine,
  mode: PricingMode = "مصنعية ومواد"
) =>
  lineTotal(
    line,
    mode === "مصنعيات فقط"
      ? Math.max(0, round3(line.cost - line.materialCost))
      : line.cost
  );

export type QuotationTotals = {
  price: number;
  cost: number;
  margin: number;
  marginPercent: number;
  chosen: number;
  excluded: number;
};

/** مجاميع العرض — على المختار وحده، فالمشطوب ليس جزءاً من الالتزام */
export function quotationTotals(
  lines: QuotationLine[],
  mode: PricingMode = "مصنعية ومواد"
): QuotationTotals {
  const chosen = lines.filter((l) => l.chosen);
  const price = round3(chosen.reduce((s, l) => s + linePrice(l, mode), 0));
  const cost = round3(chosen.reduce((s, l) => s + lineCost(l, mode), 0));
  const margin = round3(price - cost);
  return {
    price,
    cost,
    margin,
    marginPercent: price > 0 ? round3((margin / price) * 100) : 0,
    chosen: chosen.length,
    excluded: lines.length - chosen.length,
  };
}

/** مجاميع مرحلة واحدة — هي الدفعة المستحقة عند بلوغها */
export function stageTotals(
  lines: QuotationLine[],
  stage: string,
  mode: PricingMode = "مصنعية ومواد"
) {
  return quotationTotals(
    lines.filter((l) => l.stage === stage),
    mode
  );
}

/**
 * البنود التي شطبها العميل — تُطبع في العرض تحت «ما لا يشمله».
 *
 * أكثر ما يُختصم عليه في المقاولات هو ما لم يُكتب، وهذه القائمة تخرج
 * من الجلسة نفسها فلا يمكن أن يُنسى بند شطبه العميل بحضوره.
 */
export function exclusions(lines: QuotationLine[]): string[] {
  return lines
    .filter((l) => !l.chosen)
    .map((l) =>
      [l.section, l.name, l.detail].filter(Boolean).join(" — ")
    );
}

/**
 * دفعات العقد من مراحل العرض.
 *
 * كل مرحلة دفعة واحدة قيمتها مجموع بنودها المختارة، وشرط استحقاقها إنجاز
 * تلك المرحلة — وهذا شكل جدول «رابعاً» في عقود الشركة المبرمة.
 */
export function installmentsFromQuotation(
  quotation: Quotation
): { number: number; value: string; condition: string }[] {
  return stagesOfScope(quotation.scope)
    .map((stage) => ({
      stage,
      total: stageTotals(quotation.lines, stage, quotation.pricingMode).price,
    }))
    .filter((row) => row.total > 0)
    .map((row, index) => ({
      number: index + 1,
      value: String(row.total),
      condition: `عند الانتهاء من مرحلة «${row.stage}»`,
    }));
}

/** رقم العرض التالي: Q-2026-001 */
export function nextQuotationNumber(
  existing: Quotation[],
  year: number
): string {
  const prefix = `Q-${year}-`;
  const top = existing
    .filter((q) => q.number.startsWith(prefix))
    .map((q) => Number(q.number.slice(prefix.length)) || 0)
    .reduce((max, n) => Math.max(max, n), 0);
  return `${prefix}${String(top + 1).padStart(3, "0")}`;
}

/** تاريخ انتهاء صلاحية العرض */
export function validUntil(quotation: Quotation): string {
  if (!quotation.date || quotation.validityDays <= 0) return "";
  const d = new Date(quotation.date);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + quotation.validityDays);
  return d.toISOString().slice(0, 10);
}

export const QUOTATION_DEFAULTS = {
  durationDays: 365,
  validityDays: 30,
  marginPercent: 20,
};

/* ------------------------------------------------------------------ */
/* مسوّدة تصنيف الأساسي                                                */
/* ------------------------------------------------------------------ */

/**
 * اقتراح أوّلي لما لا يقوم البناء بدونه — مسوّدة تُراجَع لا حكم نهائي.
 *
 * المعيار: هل تستطيع تسليم القسيمة بدون هذا البند؟ فالخزانات والكهرباء
 * والسور والعدة أساسية، والخيمة والحارس والشاليه اختيارية. ومبنية على
 * قول صاحب الشركة في «خطوات البناء»: التدعيم وسحب الماء «إن لزم».
 *
 * البند المفتاح: «المرحلة|القسم|البند» — والاسم يكون فارغاً حين يكون
 * القسم نفسه هو البند، كما في ورقته.
 */
export const ESSENTIAL_DRAFT: string[] = [
  // تجهيز الموقع — لا موقع بلا حدود وماء وكهرباء وسور وعدّة
  "تجهيز الموقع|إستلام الحدود|",
  "تجهيز الموقع|لوازم الموقع|خزانات ماء",
  "تجهيز الموقع|لوازم الموقع|تناكر",
  "تجهيز الموقع|لوازم الموقع|كهرباء موقع",
  "تجهيز الموقع|التأمين|",
  "تجهيز الموقع|السور والإعلان|السور",
  "تجهيز الموقع|العدة|الخشب",
  "تجهيز الموقع|العدة|الملازم",
  "تجهيز الموقع|العدة|الزراجين",
  "تجهيز الموقع|العدة|سيم تربيط",
  "تجهيز الموقع|العدة|حديد 6 ملم",
  "تجهيز الموقع|العدة|جيكات",
  "تجهيز الموقع|العدة|كرينات",
  "تجهيز الموقع|العدة|رافعات",
  "تجهيز الموقع|العدة|مسمار",

  // الحفر — التدعيم وسحب المياه «إن لزم» فليسا أساسيين
  "الحفر والتدعيم|الحفر|توتال منسوب الحفر",
  "الحفر والتدعيم|مبيدات حشرية|رش قبل الصب",

  // الهيكل — المقطوعة هي الأصل، واليوميات وعمال الشركة بدائل عنها
  "الهيكل الأسود|حداده|مقطوعة",
  "الهيكل الأسود|نجارة|مقطوعة",
  "الهيكل الأسود|طابوق|مقطوعة",
  "الهيكل الأسود|كهرباء تأسيس|",
  "الهيكل الأسود|صحي تأسيس|بايبات",
  "الهيكل الأسود|عازل قواعد|يبيتومين",

  // النصف تشطيب — التمديدات والعزل والمساح لا تُشطب
  "النصف تشطيب|كهرباء|بوكسات",
  "النصف تشطيب|كهرباء|بايبات",
  "النصف تشطيب|كهرباء|سحب وايرات",
  "النصف تشطيب|صحي|مواد",
  "النصف تشطيب|عازل حمامات ومطابخ|طربال",
  "النصف تشطيب|عازل حمامات ومطابخ|مواد",
  "النصف تشطيب|مساح|",

  // التشطيب — لا تُسلَّم قسيمة بلا صبغ وأطقم ومفاتيح وأبواب ونوافذ
  "التشطيب|صبغ|",
  "التشطيب|صحي|",
  "التشطيب|كهرباء|",
  "التشطيب|أبواب|",
  "التشطيب|ألومنيوم|",

  // الميكانيك والديكورات: لا أساسي فيهما — كلها اختيار العميل
];

export const workItemKey = (item: WorkItem): string =>
  `${item.stage}|${item.section}|${item.name}`;

/** يطبّق المسوّدة، ويعيد الكتالوج وعدد ما تغيّر */
export function applyEssentialDraft(catalogue: WorkItem[]): {
  items: WorkItem[];
  changed: number;
} {
  const essential = new Set(ESSENTIAL_DRAFT);
  let changed = 0;
  const items = catalogue.map((item) => {
    const next = essential.has(workItemKey(item));
    if (next === item.essential) return item;
    changed++;
    return { ...item, essential: next };
  });
  return { items, changed };
}

/* ------------------------------------------------------------------ */
/* التسعير من التكلفة                                                  */
/* ------------------------------------------------------------------ */

/**
 * سعر البيع = التكلفة + نسبة منها.
 *
 * تنبيه على الفرق: نسبة 20% على التكلفة تعطي هامشاً من السعر قدره
 * 16.7% لا 20% — والشاشة تعرض الرقمين معاً حتى لا يُخلط بينهما.
 */
export const markupPrice = (cost: number, percent: number): number =>
  round3(cost * (1 + (percent || 0) / 100));

/**
 * يصفّر اختيارات العميل — يبقى الأساسي وحده مؤشَّراً عليه.
 *
 * صفر مطلق لا معنى له: عرض بلا صب قواعد ليس عرضاً. فالتصفير يعود
 * بالعرض إلى حدّه الأدنى الذي لا خلاف عليه، لا إلى لا شيء.
 */
export const clearChoices = (lines: QuotationLine[]): QuotationLine[] =>
  lines.map((line) => ({ ...line, chosen: line.essential }));

/** يؤشّر على كل البنود — نقطة بداية لعميل يريد كل شيء */
export const selectAllChoices = (lines: QuotationLine[]): QuotationLine[] =>
  lines.map((line) => ({ ...line, chosen: true }));

/** عمر العرض بالأيام منذ آخر تعديل */
export function quotationAgeDays(
  quotation: Quotation,
  now = new Date()
): number {
  const at = new Date(quotation.updatedAt || quotation.createdAt);
  if (Number.isNaN(at.getTime())) return 0;
  return Math.floor((now.getTime() - at.getTime()) / 86400000);
}

/**
 * يعيد تسعير السطور من تكلفتها — لا يمسّ الاختيار ولا الكميات.
 *
 * وحصة المواد تُسعَّر بالنسبة نفسها، فتبقى نسبتها من السعر كنسبتها من
 * التكلفة، ويستقيم طرحها في وضع «مصنعيات فقط».
 */
export const applyMarkup = (
  lines: QuotationLine[],
  percent: number
): QuotationLine[] =>
  lines.map((line) => ({
    ...line,
    price: markupPrice(line.cost, percent),
    materialPrice: markupPrice(line.materialCost, percent),
  }));

/** كم يوماً مضى على آخر تحديث لتكلفة هذا البند؟ -1 يعني لم تُحدَّث قط */
export function costAgeDays(item: WorkItem, now = new Date()): number {
  if (!item.costUpdatedAt) return -1;
  const at = new Date(item.costUpdatedAt);
  if (Number.isNaN(at.getTime())) return -1;
  return Math.floor((now.getTime() - at.getTime()) / 86400000);
}

/**
 * بعدها تُعدّ التكلفة قديمة وتحتاج مراجعة المهندس.
 *
 * سبعة أيام بقرار مجلس الإدارة في ١٢ سبتمبر ٢٠٢٦ — أسعار مواد البناء
 * تتحرك أسبوعياً، وشهرٌ كامل يجعل العرض يُبنى على سعر لم يعد قائماً.
 */
export const COST_STALE_DAYS = 7;

export const isCostStale = (item: WorkItem, now = new Date()): boolean => {
  const age = costAgeDays(item, now);
  return age < 0 || age >= COST_STALE_DAYS;
};
