/**
 * تقديرُ المواد: فاتورةٌ تقريبيّةٌ قبل أن تُشترى المادة.
 *
 * وطلبه صاحبُ الشركة في ١٩ نوفمبر ٢٠٢٦: «أريد نافذةً نضيف عليها أسعارَ
 * المواد، بحيث أستطيع أن أحسب تقريباً الموادَّ اللازمةَ لدورٍ واحدٍ حسب
 * مساحته، أو أيِّ عملٍ قادمٍ لمرحلةٍ قادمة — كإخراج فاتورةٍ تقريبيّةٍ
 * لنعرف تكلفةَ المواد بالبنود: صحّي، كهرباء، إنارة، سويتشات، بلاكات،
 * أطقم حمّام».
 *
 * وعلّتُه أنّ دفاترَه تقول ما **دُفع** ولا تقول ما **سيُدفع**: فمن أراد
 * أن يعرف كم تُكلّف كهرباءُ دورٍ لم يُبنَ بعد لم يجد إلا أن يجمع قيوداً
 * قديمةً من قسيمةٍ أخرى بيده. وأكثرُ قيوده بلا كمّية — «مواد كهربائية
 * ٦٢١٫٧٥٠» — فلا يُعرف منها سعرُ متر ولا حبّة.
 *
 * فهذا سجلٌّ للأسعار بوحداتها، وضربٌ في مساحةٍ أو عدد. وهو **تقديرٌ عامٌّ
 * لا قيدٌ ولا عرضُ سعر**: لا يمسّ الدفاتر، ولا يُلزم أحداً، ولا يُنسب إلى
 * قسيمةٍ بعينها حتى يُنسَب بيدِ صاحبه.
 *
 * والحسابُ هنا لا في الشاشة: فالشاشةُ تُعرض والحسابُ يُفحص.
 */

import { round3 } from "./accounting";

/* ------------------------------------------------------------------ */
/* المفردات                                                            */
/* ------------------------------------------------------------------ */

/**
 * أساسُ التقدير: على أيِّ شيءٍ تُضرب الكمّيةُ المقترحة.
 *
 * وأربعةٌ تكفي ما يُبنى: ما يُفرش على المساحة (بايبات، أسلاك، طابوق)،
 * وما يتبع الحمّامات عدداً (أطقم، خلّاطات)، وما يتبع الأدوار (لوحةُ
 * توزيعٍ لكلِّ دور)، وما هو واحدٌ للعمل كلِّه (المدخلُ الرئيسي).
 */
export const BASES = ["متر مربع", "حمام", "دور", "ثابت"] as const;
export type EstimateBasis = (typeof BASES)[number];

export const DEFAULT_BASIS: EstimateBasis = "متر مربع";

export const isBasis = (v: unknown): v is EstimateBasis =>
  (BASES as readonly string[]).includes(String(v));

/**
 * الأقسامُ التي سمّاها في طلبه، وما يلحقها من صنائع البناء.
 *
 * تُقترح ولا تُلزم — كالتخصّصات في سجلّ الأطراف: فمن قُيّد بقائمةٍ
 * مكتوبةٍ في الشِّفْر لم يستطع كتابةَ قسمٍ جديدٍ إلا بتعديل البرنامج.
 */
export const DEPARTMENTS = [
  "صحّي",
  "كهرباء",
  "إنارة",
  "سويتشات وبلاكات",
  "أطقم حمّام",
  "مباني",
  "نجارة وحدادة",
  "بلاط وأرضيات",
  "دهان",
  "جبس وديكور",
  "ألومنيوم وزجاج",
  "تكييف",
  "عدد ومستهلكات",
];

/** وحداتُ القياس المعتادة — تُقترح في قائمة ويُكتب غيرُها */
export const UNITS = [
  "حبّة",
  "عدد",
  "طقم",
  "متر",
  "متر مربع",
  "متر مكعّب",
  "لفّة",
  "كيس",
  "لوح",
  "طن",
  "لتر",
  "جالون",
];

/* ------------------------------------------------------------------ */
/* الصورة                                                             */
/* ------------------------------------------------------------------ */

/** سعرُ المادة عند مورّدٍ بعينه — فالمادةُ الواحدةُ بأسعارٍ عدّة */
export type MaterialSupplier = {
  id: string;
  /** اسمُ المورّد كما في سجلّ الأطراف، ليجتمع حسابُه */
  party: string;
  price: number;
};

/**
 * ما يحتاجه التقديرُ من المادة.
 *
 * وهو وصفٌ بنيويٌّ لا استيرادٌ من `storage`: فالنوعُ هناك يستورد من هنا،
 * ولو استوردَ كلٌّ من الآخر لدار الاستيرادُ على نفسه.
 */
export type EstimateMaterial = {
  id: string;
  name: string;
  department: string;
  unit: string;
  basis: EstimateBasis;
  /** الكمّيةُ المقترحةُ لكلِّ وحدةٍ من الأساس — 0.25 بايب لكلِّ متر مربع */
  perUnit: number;
  /** السعرُ الاسترشاديُّ متى لم يُختر مورّد — وفراغٌ يعني بلا سعر */
  unitPrice: number | null;
  suppliers: MaterialSupplier[];
};

/** ما يُدخله صاحبُ التقدير: مساحةُ الدور وعددُ الحمّامات وعددُ الأدوار */
export type EstimateInputs = {
  area: number;
  bathrooms: number;
  floors: number;
};

export const EMPTY_INPUTS: EstimateInputs = { area: 0, bathrooms: 0, floors: 1 };

/** اختياراتُ صاحب التقدير على صفٍّ بعينه */
export type EstimatePick = {
  /** هل يدخل الصفُّ الفاتورة — طلب أن يكون له ردُّ المادة */
  include: boolean;
  /** المورّدُ المختار، وفراغٌ يعني السعرَ الاسترشادي */
  supplier: string;
  /** كمّيةٌ يكتبها بيده فوق المحسوبة — وفراغٌ يعني المحسوبة */
  quantity: number | null;
};

export const defaultPick = (): EstimatePick => ({
  include: true,
  supplier: "",
  quantity: null,
});

/** صفُّ الفاتورة التقديريّة */
export type EstimateLine = {
  material: EstimateMaterial;
  include: boolean;
  /** مصدرُ السعر: اسمُ المورّد أو «استرشادي» */
  priceFrom: string;
  /** فراغٌ يعني أنّ المادةَ بلا سعرٍ فلا إجماليَ لها */
  unitPrice: number | null;
  /** الكمّيةُ المحسوبةُ من الأساس */
  computed: number;
  /** الكمّيةُ المعمولُ بها — المكتوبةُ بيدٍ إن كُتبت */
  quantity: number;
  /** هل كُتبت الكمّيةُ بيدٍ فوق المحسوبة */
  overridden: boolean;
  /** الإجماليُّ، وفراغٌ متى كان بلا سعر */
  total: number | null;
};

/* ------------------------------------------------------------------ */
/* الحساب                                                             */
/* ------------------------------------------------------------------ */

/**
 * عددُ وحداتِ الأساس.
 *
 * والمساحةُ مساحةُ الدور الواحد، فتُضرب في عدد الأدوار — وهو ما قاله:
 * «الموادُّ اللازمةُ لدورٍ واحدٍ حسب مساحته». فدورٌ واحدٌ يعني عاملاً
 * واحداً، ودورانِ يعنيان ضِعفَه.
 */
export function basisCount(basis: EstimateBasis, inputs: EstimateInputs): number {
  const floors = Math.max(Number(inputs.floors) || 0, 0);
  switch (basis) {
    case "متر مربع":
      return round3(Math.max(Number(inputs.area) || 0, 0) * floors);
    case "حمام":
      return Math.max(Number(inputs.bathrooms) || 0, 0);
    case "دور":
      return floors;
    case "ثابت":
      return 1;
  }
}

/** الكمّيةُ المحسوبةُ لمادةٍ — الكمّيةُ المقترحةُ في عدد وحدات الأساس */
export function computedQuantity(
  material: EstimateMaterial,
  inputs: EstimateInputs
): number {
  const per = Math.max(Number(material.perUnit) || 0, 0);
  return round3(per * basisCount(material.basis, inputs));
}

/**
 * السعرُ المعمولُ به ومن أين جاء.
 *
 * ومورّدٌ اختيرَ ثمّ حُذف سعرُه من المادة لا يُسكَت عنه: يرجع التقديرُ
 * إلى السعر الاسترشادي ويقول إنّه رجع — فسعرٌ يُبدَّل في الخفاء يُخرج
 * فاتورةً لا يعرف صاحبُها على أيِّ أساسٍ حُسبت.
 */
export function priceOf(
  material: EstimateMaterial,
  supplierName: string
): { price: number | null; from: string } {
  if (supplierName) {
    const found = material.suppliers.find((s) => s.party === supplierName);
    if (found) return { price: round3(Number(found.price) || 0), from: found.party };
  }
  return {
    price: material.unitPrice == null ? null : round3(material.unitPrice),
    from: "استرشادي",
  };
}

/** أرخصُ مورّدٍ للمادة — وفراغٌ إن لم يكن لها مورّدٌ مسعَّر */
export function cheapestSupplier(material: EstimateMaterial): MaterialSupplier | null {
  const priced = material.suppliers.filter((s) => Number(s.price) > 0);
  if (priced.length === 0) return null;
  return priced.reduce((best, s) => (Number(s.price) < Number(best.price) ? s : best));
}

/** صفوفُ الفاتورة التقديريّة — كلُّ المواد، والمستبعدُ منها مُعلَّم */
export function estimateLines(
  materials: readonly EstimateMaterial[],
  inputs: EstimateInputs,
  picks: Record<string, EstimatePick>
): EstimateLine[] {
  return materials.map((material) => {
    const pick = picks[material.id] ?? defaultPick();
    const computed = computedQuantity(material, inputs);
    const written = pick.quantity;
    const overridden = written != null && Number.isFinite(written) && written >= 0;
    const quantity = overridden ? round3(Number(written)) : computed;
    const { price, from } = priceOf(material, pick.supplier);
    return {
      material,
      include: pick.include !== false,
      priceFrom: from,
      unitPrice: price,
      computed,
      quantity,
      overridden,
      total: price == null ? null : round3(price * quantity),
    };
  });
}

/** المحسوبُ منها: ما أُدخل في الفاتورة وله سعرٌ وكمّية */
export const counted = (lines: readonly EstimateLine[]): EstimateLine[] =>
  lines.filter((l) => l.include && l.total != null && l.quantity > 0);

/** إجماليُّ الفاتورة التقديريّة */
export const estimateTotal = (lines: readonly EstimateLine[]): number =>
  round3(counted(lines).reduce((sum, l) => sum + (l.total ?? 0), 0));

/**
 * ما أُدخل وهو بلا سعر — فيُقال ولا يُسكَت عنه.
 *
 * فإجماليٌّ ناقصُ ثلاثِ موادٍّ بلا أسعارٍ يُقرأ على أنّه تمامُ التكلفة،
 * فيُبنى عليه قرارٌ وهو أقلُّ من الحقيقة.
 */
export const pricelessIncluded = (lines: readonly EstimateLine[]): EstimateLine[] =>
  lines.filter((l) => l.include && l.total == null && l.quantity > 0);

/** الإجمالياتُ بالأقسام — وهو ما طلبه: «تكلفةُ المواد بالبنود» */
export function byDepartment(
  lines: readonly EstimateLine[]
): { department: string; lines: EstimateLine[]; total: number; gaps: number }[] {
  const map = new Map<string, EstimateLine[]>();
  for (const line of lines) {
    const key = line.material.department || "بلا قسم";
    map.set(key, [...(map.get(key) ?? []), line]);
  }
  return [...map.entries()]
    .map(([department, group]) => ({
      department,
      lines: group,
      total: estimateTotal(group),
      gaps: pricelessIncluded(group).length,
    }))
    .sort((a, b) => b.total - a.total || a.department.localeCompare(b.department, "ar"));
}

/** اسمُ ملفِّ المطبوعة — بما تقبله أنظمةُ الملفّات */
export function estimateFileName(title: string, today: string): string {
  return ["تقدير مواد", title, today]
    .filter(Boolean)
    .join(" - ")
    .replace(/[\\/:*?"<>|]/g, "-");
}
