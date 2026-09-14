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
const { SCOPES, linesForScope, installmentsFromQuotation, quotationTotals } =
  await jiti.import("../lib/quotations.ts");

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

console.log(
  bad === 0
    ? "\n✓ العقد المولَّد من العرض يحمل بنية جدول «رابعاً» كاملة"
    : `\n✗ ${bad} نقصاً`
);
process.exit(bad === 0 ? 0 : 1);
