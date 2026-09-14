/**
 * يتحقّق أن العقد المولَّد من عرض سعر يُطبع بجدول «رابعاً» نفسه.
 *
 * العقد المنقول من الأصل الموقّع صار مضبوطاً، لكن العقد القادم يُبنى
 * من عرض السعر لا من ملفّ نقلٍ — ومهما ضُبطت المطبوعة فهي تطبع ما
 * يصلها. فالفحص هنا على ما يخرج من installmentsFromQuotation نفسه:
 * أرقام صفوف، ومراحل، ومواد، وبنود، وسطران عريضان، وصفّ تسليم.
 *
 *   node db/check-new-contract.mjs
 */
// jiti يقرأ شفرة التطبيق كما هي — تايبسكربت وإحالاتٍ بلا لاحقة —
// فيُفحص ما يعمل فعلاً لا نسخةٌ مترجمة قد تتخلّف عنه.
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { SEED_WORK_ITEMS } = await jiti.import("../lib/work-items-seed.ts");
const {
  SCOPES,
  linesForScope,
  installmentsFromQuotation,
  quotationTotals,
  sectionsOfStage,
} = await jiti.import("../lib/quotations.ts");

let bad = 0;
const fail = (m) => {
  bad++;
  console.log("  ✗ " + m);
};

for (const scope of SCOPES) {
  /*
   * كتالوج البذرة بأسعار صفر حتى يسعّره المهندس، ودفعةٌ بصفر تُحذف.
   * فيُسعَّر هنا تسعيراً صورياً: الفحص على بنية الجدول لا على السعر.
   */
  const lines = linesForScope(SEED_WORK_ITEMS, scope.key, []).map((l) => ({
    ...l,
    chosen: true,
    quantity: l.quantity || 1,
    price: 100,
    materialPrice: 40,
  }));
  const quotation = {
    scope: scope.key,
    lines,
    pricingMode: "مصنعية ومواد",
  };
  const inst = installmentsFromQuotation(quotation);
  const total = quotationTotals(lines, "مصنعية ومواد").price;

  console.log(`\n=== نطاق «${scope.label}» — ${inst.length} دفعة ===`);
  if (inst.length === 0) {
    console.log("  (لا بنود أساسية في هذا النطاق — نطاق حرّ)");
    continue;
  }
  console.log("   م  المرحلة              بنود  المواد              الدفعة");
  for (const i of inst) {
    console.log(
      `  ${String(i.no).padStart(2)}  ${(i.stage || "—").padEnd(18)}  ` +
        `${String(i.rows.length).padStart(3)}  ${(i.materials || "").padEnd(18)}  ` +
        `${String(Number(i.value)).padStart(8)}` +
        (i.banner ? "   ▶ " + i.banner : "")
    );
  }
  const sum = inst.reduce((a, i) => a + Number(i.value), 0);
  console.log(`  مجموع الدفعات ${sum}   ·   مجموع العرض ${total}`);

  if (!inst.every((i) => i.no > 0)) fail("دفعةٌ بلا رقم صفّ");
  if (!inst.every((i) => i.stage)) fail("دفعةٌ بلا اسم مرحلة");
  if (!inst.every((i) => i.materials)) fail("دفعةٌ بلا عمود مواد");
  if (!inst.every((i) => i.rows.length > 0)) fail("دفعةٌ بلا صفوف بنود");
  if (!inst.every((i) => i.condition)) fail("دفعةٌ بلا شرط استحقاق");
  if (Math.abs(sum - total) > 0.001) fail(`مجموع الدفعات ${sum} لا يساوي العرض ${total}`);

  const banners = inst.filter((i) => i.banner).map((i) => i.banner);
  if (scope.key !== "تشطيبات" && !banners.includes("الانتهاء من الهيكل الأسود"))
    fail("سطر «الانتهاء من الهيكل الأسود» مفقود");
  if (
    scope.key === "تشطيب كامل" &&
    !banners.includes("الانتهاء من أعمال النصف تشطيب")
  )
    fail("سطر «الانتهاء من أعمال النصف تشطيب» مفقود");
  if (scope.key === "تشطيب كامل" && inst[inst.length - 1].stage !== "التسليم")
    fail("صفّ التسليم مفقود من عقد التشطيب الكامل");

  // واتّزان الدمج الرأسي، بخوارزمية ClientWorksTable نفسها
  const rows = inst.reduce((a, i) => a + i.rows.length, 0);
  const merges = (key) => {
    const span = new Array(inst.length).fill(0);
    let g = 0;
    while (g < inst.length) {
      let end = g;
      let n = inst[g].rows.length;
      while (!inst[end].banner && end + 1 < inst.length && key(inst[end + 1], end + 1) === key(inst[g], g)) {
        end++;
        n += inst[end].rows.length;
      }
      span[g] = n;
      g = end + 1;
    }
    return span.reduce((a, b) => a + b, 0);
  };
  const noKey = (i, index) => (i.no ? String(i.no) : "#" + index);
  for (const [name, key] of [
    ["م", noKey],
    ["المرحلة", (i, index) => i.stage || "#" + index],
    ["المواد", (i, index) => noKey(i, index) + "|" + (i.materials ?? "")],
  ]) {
    const sum = merges(key);
    if (sum !== rows) fail(`عمود ${name}: مجموع الدمج ${sum} لا ${rows}`);
  }
}

/* ---------------------------------------------------------------- */
/* القسمة والخصم — ما يختاره صاحب القرار عند الإبرام                  */
/* ---------------------------------------------------------------- */

{
  const lines = linesForScope(SEED_WORK_ITEMS, "تشطيب كامل", []).map((l) => ({
    ...l,
    chosen: true,
    quantity: l.quantity || 1,
    price: 100,
    materialPrice: 40,
  }));
  const quotation = { scope: "تشطيب كامل", lines, pricingMode: "مصنعية ومواد" };
  const value = quotationTotals(lines, "مصنعية ومواد").price;

  // الهيكل الأسود يُقسَّم على أقسامه قسمين، كما يُقسَّم على الأدوار
  const sections = sectionsOfStage(lines, "الهيكل الأسود");
  const half = Math.ceil(sections.length / 2);
  const terms = {
    stageParts: {
      "الهيكل الأسود": [
        { name: "الهيكل الأسود : الأرضي", sections: sections.slice(0, half) },
        { name: "الهيكل الأسود : الأول", sections: sections.slice(half) },
      ],
    },
    consultancy: 4000,
  };

  const inst = installmentsFromQuotation(quotation, terms);
  console.log("\n=== إبرامٌ بقسمة الهيكل الأسود وخصم عقد استشاري 4000 ===");
  console.log("   م  المرحلة                    بنود  الدفعة");
  for (const i of inst) {
    console.log(
      `  ${String(i.no).padStart(2)}  ${(i.stage || "—").padEnd(24)}  ` +
        `${String(i.rows.length).padStart(3)}  ` +
        `${(i.informational ? "(" + i.value + "-)" : i.value).padStart(8)}` +
        (i.banner ? "   ▶ " + i.banner : "")
    );
  }

  const payable = inst.filter((i) => !i.informational);
  const sum = payable.reduce((a, i) => a + Number(i.value), 0);
  console.log(`  مجموع الدفعات القابلة للصرف ${sum} · قيمة العقد ${value}`);

  if (Math.abs(sum - value) > 0.001)
    fail(`القسمة غيّرت المجموع: ${sum} لا ${value}`);
  if (inst.filter((i) => i.informational).length !== 1)
    fail("صفّ العقد الاستشاري التوثيقي مفقود أو مكرّر");
  if (inst[0].stage !== "" || !inst[0].informational)
    fail("صفّ الخصم يجب أن يتصدّر الجدول بلا اسم مرحلة");
  const black = inst.filter((i) => i.stage.startsWith("الهيكل الأسود"));
  if (black.length !== 2) fail("الهيكل الأسود لم ينقسم دفعتين");
  if (black.filter((i) => i.banner).length !== 1)
    fail("السطر العريض يجب أن يلي آخر أجزاء المرحلة وحده");
  if (black[1].banner !== "الانتهاء من الهيكل الأسود")
    fail("السطر العريض في غير موضعه");
  if (new Set(inst.map((i) => i.no)).size !== inst.length)
    fail("أرقام صفوف «م» متكرّرة");

  // وبلا خصم: لا صفّ توثيقي البتّة
  const plain = installmentsFromQuotation(quotation, { stageParts: {}, consultancy: 0 });
  if (plain.some((i) => i.informational))
    fail("صفّ الخصم ظهر مع أنه لا عقد استشاري");
}
console.log(
  bad === 0
    ? "\n✓ العقد المولَّد من العرض يحمل بنية جدول «رابعاً» كاملة"
    : `\n✗ ${bad} نقصاً`
);
process.exit(bad === 0 ? 0 : 1);
