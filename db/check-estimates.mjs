/**
 * يفحص تقديرَ المواد.
 *
 *   npm run check:estimates
 *
 * طلبه صاحبُ الشركة في ١٩ نوفمبر ٢٠٢٦: «أريد نافذةً نضيف عليها أسعارَ
 * المواد، بحيث أستطيع أن أحسب تقريباً الموادَّ اللازمةَ لدورٍ واحدٍ حسب
 * مساحته — كإخراج فاتورةٍ تقريبيّةٍ لنعرف تكلفةَ المواد بالبنود».
 *
 * وثلاثةٌ تُحرس هنا، وكلُّها من علّةٍ وقعت:
 *
 *   ١) **دورةُ التخزين**: حقلٌ يُضاف إلى المادة ولا تعرفه migrateMaterial
 *      لا يُحفظ ولا يُرفع — تقع صامتةً. وقعت في المكافآت: كُتبت في
 *      الشاشة وسُجّلت في التدقيق، ثمّ لم تُحفظ، فسأل عنها بعد يومين.
 *
 *   ٢) **الإجماليُّ لا يكذب**: مادةٌ بلا سعرٍ أُدخلت الفاتورةَ لا تُحسب
 *      صفراً في الخفاء — يُقال عددُها، وإلّا قُرئ الإجماليُّ تمامَ
 *      التكلفة وبُني عليه قرار.
 *
 *   ٣) **ولا تمسُّ الدفاتر**: التقديرُ تقريبٌ لا قيد. فشاشةٌ تُنشئ حركةً
 *      من رقمٍ تقديريٍّ تُدخل الدفاترَ ما لم يُدفع.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createJiti } from "jiti";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const read = (rel) =>
  fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

const jiti = createJiti(import.meta.url);
const est = await jiti.import("../lib/estimates.ts");
const { PAGE_PERMISSION } = await jiti.import("../lib/permissions.ts");

const page = read("app/page.tsx");
const store = read("lib/storage.ts");

/* ------------------------------------------------------------------ */
console.log("\nالحسابُ يُضرب في أساسه:\n");

const inputs = { area: 100, bathrooms: 3, floors: 2 };

check(
  "المساحةُ مساحةُ الدور فتُضرب في عدد الأدوار",
  est.basisCount("متر مربع", inputs) === 200,
  "فدورانِ بمئةِ مترٍ مئتان لا مئة"
);
check("والحمّاماتُ عددُها", est.basisCount("حمام", inputs) === 3);
check("والأدوارُ عددُها", est.basisCount("دور", inputs) === 2);
check(
  "والثابتُ واحدٌ مهما كبُرت القسيمة",
  est.basisCount("ثابت", inputs) === 1,
  "كالمدخل الرئيسيّ: واحدٌ للعمل كلّه"
);
check(
  "ولا سالبَ من مُدخلٍ سالب",
  est.basisCount("متر مربع", { area: -50, bathrooms: -1, floors: -2 }) === 0 &&
    est.basisCount("حمام", { area: 0, bathrooms: -1, floors: 1 }) === 0,
  "فكمّيةٌ سالبةٌ تُنقص الإجماليَّ وهي زيادة"
);

const material = (over = {}) => ({
  id: "m1",
  name: "بايب 4 إنش",
  department: "صحّي",
  unit: "حبّة",
  basis: "متر مربع",
  perUnit: 0.25,
  unitPrice: 2,
  suppliers: [],
  ...over,
});

check(
  "والكمّيةُ المقترحةُ تُضرب في عدد وحدات الأساس",
  est.computedQuantity(material(), inputs) === 50,
  "ربعُ حبّةٍ للمتر × ٢٠٠ متر = ٥٠"
);
check(
  "والكسورُ تُقرَّب إلى ثلاثة أرقام كبقيّة النظام",
  est.computedQuantity(material({ perUnit: 0.3333 }), { ...inputs, floors: 1 }) ===
    33.33,
  `${est.computedQuantity(material({ perUnit: 0.3333 }), { ...inputs, floors: 1 })}`
);

/* ------------------------------------------------------------------ */
console.log("\nوالسعرُ يُعرف من أين جاء:\n");

const withSuppliers = material({
  suppliers: [
    { id: "s1", party: "شركة الدولية المباشرة", price: 2.5 },
    { id: "s2", party: "شركة الحسن", price: 1.75 },
  ],
});

check(
  "مورّدٌ اختيرَ فسعرُه",
  est.priceOf(withSuppliers, "شركة الحسن").price === 1.75
);
check(
  "ويُقال اسمُه لا «استرشادي»",
  est.priceOf(withSuppliers, "شركة الحسن").from === "شركة الحسن"
);
check(
  "ولا مورّدَ فالاسترشاديّ",
  est.priceOf(withSuppliers, "").price === 2 &&
    est.priceOf(withSuppliers, "").from === "استرشادي"
);
check(
  "ومورّدٌ أُزيل سعرُه يرجع إلى الاسترشاديِّ ويُقال إنّه رجع",
  est.priceOf(withSuppliers, "من لا وجود له").from === "استرشادي",
  "فسعرٌ يُبدَّل في الخفاء يُخرج فاتورةً لا يُعرف أساسُها"
);
check(
  "وأرخصُ المورّدين يُعرف",
  est.cheapestSupplier(withSuppliers)?.party === "شركة الحسن"
);
check(
  "ولا أرخصَ لمن لا مورّدَ له مسعَّراً",
  est.cheapestSupplier(material()) === null &&
    est.cheapestSupplier(
      material({ suppliers: [{ id: "s", party: "فلان", price: 0 }] })
    ) === null,
  "فسعرُ صفرٍ ليس سعراً"
);

/* ------------------------------------------------------------------ */
console.log("\nوالإجماليُّ لا يكذب:\n");

const three = [
  material({ id: "a", name: "بايب", unitPrice: 2, perUnit: 0.25 }),
  material({ id: "b", name: "كوع", unitPrice: 1, perUnit: 0.5 }),
  material({ id: "c", name: "مجهولُ السعر", unitPrice: null, perUnit: 1 }),
];
const one = { area: 100, bathrooms: 0, floors: 1 };
const lines = est.estimateLines(three, one, {});

check("لكلِّ مادةٍ صفٌّ ولو خرجت من الحساب", lines.length === 3);
check(
  "والمحسوبُ ما له سعرٌ وكمّية",
  est.counted(lines).length === 2,
  "والثالثُ بلا سعرٍ فلا إجماليَ له"
);
check(
  "والإجماليُّ مجموعُ ما حُسب",
  est.estimateTotal(lines) === 100,
  `25×2 + 50×1 = 100، والناتج ${est.estimateTotal(lines)}`
);
check(
  "ويُقال ما أُدخل بلا سعر",
  est.pricelessIncluded(lines).length === 1 &&
    est.pricelessIncluded(lines)[0].material.name === "مجهولُ السعر",
  "فإجماليٌّ ناقصُ مادةٍ يُقرأ تمامَ التكلفة"
);

const excluded = est.estimateLines(three, one, {
  a: { include: false, supplier: "", quantity: null },
});
check(
  "وما أُزيلت علامتُه لا يُحسب — وهو ما طلبه: «مقدرةٌ على تحديد هذه المادة لو أردتها أو لا»",
  est.estimateTotal(excluded) === 50
);

const written = est.estimateLines(three, one, {
  a: { include: true, supplier: "", quantity: 10 },
});
check(
  "وكمّيةٌ تُكتب بيدٍ تغلب المحسوبة",
  est.estimateTotal(written) === 70 &&
    written[0].overridden === true &&
    written[0].computed === 25,
  "وتبقى المحسوبةُ معروضةً، فيُرى الفرقُ ولا يُخفى"
);
check(
  "وصفرٌ مكتوبٌ بيدٍ صفرٌ لا رجوعٌ إلى المحسوب",
  est.estimateLines(three, one, {
    a: { include: true, supplier: "", quantity: 0 },
  })[0].quantity === 0,
  "فمن كتب صفراً أراد إخراجَها"
);

const groups = est.byDepartment(lines);
check(
  "والأقسامُ تُجمع — وهو نصُّ طلبه: «تكلفةُ المواد بالبنود»",
  groups.length === 1 && groups[0].department === "صحّي"
);
check(
  "ومجموعُ الأقسام مجموعُ الفاتورة",
  groups.reduce((s, g) => s + g.total, 0) === est.estimateTotal(lines)
);
check(
  "ومادةٌ بلا قسمٍ لا تسقط",
  est
    .byDepartment(est.estimateLines([material({ department: "" })], one, {}))
    .some((g) => g.department === "بلا قسم"),
  "فصفٌّ يسقط من الأقسام يسقط من الإجمالي"
);

/* ------------------------------------------------------------------ */
console.log("\nودورةُ التخزين — فما لا تعرفه الهجرةُ لا يُرفع:\n");

/* حقولُ النوع من المصدر نفسِه لا قائمةً مكتوبةً بيد */
const typeBlock = store.slice(
  store.indexOf("export type Material = {"),
  store.indexOf("/** سجلّ استلام مواد")
);
const fields = [...typeBlock.matchAll(/^  (\w+)[?]?:/gm)].map((m) => m[1]);
const migrate = store.slice(
  store.indexOf("function migrateMaterial(raw: unknown): Material {"),
  store.indexOf("function migrateReceipt(")
);
const dropped = fields.filter((f) => !migrate.includes(`${f}:`));

check("للمادة حقولٌ تُحصى", fields.length >= 9, `${fields.length} حقلاً`);
check(
  "وكلُّها في migrateMaterial",
  dropped.length === 0,
  dropped.length
    ? `ساقطٌ: ${dropped.join(" · ")} — فلن يُحفظ ولن يُرفع`
    : fields.join(" · ")
);
check(
  "ومورّدو المادة لهم هجرتُهم",
  /function migrateSupplier\(raw: unknown\): MaterialSupplier/.test(store)
);
check(
  "ومورّدٌ بلا اسمٍ لا يُحفظ",
  /\.filter\(\(s\) => s\.party !== ""\)/.test(migrate),
  "فصفٌّ فارغٌ يُختار سهواً فيُحسب سعرُه صفراً"
);
check(
  "وأساسٌ مجهولٌ يرجع إلى المعلوم لا يبقى فاسداً",
  /basis: isBasis\(m\.basis\) \? m\.basis : DEFAULT_BASIS/.test(migrate)
);
check(
  "ولا هجرةَ ثانيةً للمادة — فالمصدرُ واحد",
  (store.match(/function migrateMaterial/g) ?? []).length === 1
);

/* ------------------------------------------------------------------ */
console.log("\nوالشاشةُ موصولةٌ ومحجوبة:\n");

const pagesBlock = page.slice(page.indexOf("const PAGES = ["));
check(
  "الصفحةُ في قائمة الصفحات",
  pagesBlock.slice(0, pagesBlock.indexOf("];")).includes('"تقدير المواد"')
);
const groupsBlock = page.slice(
  page.indexOf("const PAGE_GROUPS"),
  page.indexOf("const PAGE_GROUPS") + 4000
);
check(
  "وفي مجموعةٍ من القائمة — وإلّا لم تُفتح إلا بالبحث",
  groupsBlock.includes('"تقدير المواد"')
);
check(
  "ولها صلاحيةٌ تحجبها",
  PAGE_PERMISSION["تقدير المواد"] === "materials.view",
  `${PAGE_PERMISSION["تقدير المواد"]}`
);
check(
  "وتُعرض في مبدِّل الصفحات",
  /\{page === "تقدير المواد" && \(\s*\n\s*<EstimatePage/.test(page)
);

const body = page.slice(
  page.indexOf("function EstimatePage({"),
  page.indexOf("function SupplierRows({")
);
check(
  "وتحريرُ السجلّ محجوبٌ بـ materials.manage",
  /canManage=\{allow\("materials\.manage"\)\}/.test(page) &&
    body.includes("{canManage && ("),
  "فمن يقرأ الأسعارَ ليس من يضعها"
);
check(
  "ولا تمسُّ الدفاتر",
  !body.includes("setMovements") && !body.includes("entryNo"),
  "فالتقديرُ تقريبٌ لا قيد"
);
check(
  "ويُقال في وجهها إنّها تقريبيّةٌ لا تُلزم",
  /لا تمسُّ الدفاترَ ولا تُنشئ قيداً/.test(body)
);
check(
  "ويُنبَّه على ما أُدخل بلا سعر",
  body.includes("والإجماليُّ أقلُّ من التكلفة"),
  "فلا يُقرأ الناقصُ تامّاً"
);
check(
  "وتُطبع بالورقة المعتمدة",
  /function EstimateSheet\(\{/.test(page) &&
    page
      .slice(page.indexOf("function EstimateSheet({"), page.indexOf("function EstimatePage({"))
      .includes("voucher-body designed-sheet")
);
check(
  "وفي المطبوعة أنّها ليست عرضَ سعر",
  page
    .slice(page.indexOf("function EstimateSheet({"), page.indexOf("function EstimatePage({"))
    .includes("ليست عرضَ سعرٍ ولا تُلزم الشركة"),
  "فورقةٌ بشعار الشركة تُقرأ عقداً عند من لا يقرأ الحواشي"
);
check(
  "ولا تُحفظ الفاتورةُ في الدفاتر، والمحفوظُ سجلُّ الأسعار",
  body.includes("setMaterials") && !body.includes("setEstimates"),
  "فما يُرفع هو ما يُشارَك، والمساحةُ سؤالُ لحظة"
);
check(
  "وأسماءُ المورّدين من سجلّ الأطراف لا تُكتب مرّتين",
  /parties\s*\n?\s*\.filter\(\(p\) => p\.kind === "مورّد" && p\.active\)/.test(body),
  "فاسمٌ يُكتب بصيغتين يُفرِّق حساباً واحداً"
);
check(
  "ومادةٌ عليها سجلُّ استلامٍ لا تُحذف",
  body.includes("لا تُحذف «") && body.includes("سجلَّ استلامٍ تفقد اسمَها"),
  "فالحذفُ يُضيّع عملاً حقيقيّاً"
);

console.log(
  bad === 0
    ? "\n✓ التقديرُ يُضرب في أساسه، ويُقال ما لم يُحسب، ولا يمسُّ الدفاتر"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
