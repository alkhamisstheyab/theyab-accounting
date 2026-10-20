/**
 * يفحص حرّيّاتِ عرض السعر الثلاث.
 *
 *   npm run check:freedom
 *
 * وثلاثُ طلباتٍ في شاشةٍ واحدة:
 *
 *   • **اختيارُ ما يَظهر من غير المشمول.** والأصلُ الذكرُ — يُسدّ به
 *     بابُ الخلاف، فلا يقول العميل «حسبتُ المصعد داخلاً». فلو كان
 *     الأصلُ الإخفاءَ لاختفت بنودُ العقود القائمة كلُّها بسكوتِ الحقل
 *     عنها، وذاك أخطرُ ما في هذا الباب.
 *
 *   • **جمعُ بنودٍ في سطرٍ بمجموعها.** والجمعُ **عرضٌ لا حذف**: البنودُ
 *     باقيةٌ في الحساب — التكلفةُ والهامشُ وجدولُ الدفعات تُحسب منها.
 *     ومن حسبها من المجموع خسر معرفةَ أيِّ بندٍ أكل ربحَه.
 *
 *   • **أقسامٌ حرّةٌ** بعنوانها وسطورها وأسعارها وموضعِ طباعتها.
 *     وأسعارُها تدخل مجموعَ العرض — فعرضٌ لا يجمعها يُسلَّم للعميل
 *     برقمٍ أقلَّ مما اتُّفق، وذاك نقصٌ صامت.
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

const jiti = createJiti(import.meta.url);
const q = await jiti.import("../lib/quotations.ts");
const { normalizeState } = await jiti.import("../lib/storage.ts");
const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");
const lib = fs.readFileSync(path.join(ROOT, "lib/quotations.ts"), "utf8");

const line = (itemId, extra = {}) => ({
  itemId,
  stage: "التشطيب",
  section: "قسم",
  name: itemId,
  detail: "",
  description: "",
  unit: "م٢",
  quantity: 1,
  cost: 10,
  price: 100,
  materialCost: 0,
  materialPrice: 0,
  essential: false,
  chosen: true,
  ...extra,
});

/* ------------------------------------------------------------------ */
console.log("\nغيرُ المشمول: الأصلُ الذكرُ، والإخفاءُ بقصد:\n");

const lines = [
  line("a", { chosen: false }),
  line("b", { chosen: false, showExcluded: false }),
  line("c"),
];

check(
  "ما لم يُختر يُذكر",
  q.exclusions(lines).length === 1,
  `${q.exclusions(lines).length} مذكوراً من ٢ غير مختارين`
);
check(
  "وما وُسم بالإخفاء لا يُذكر",
  !q.exclusions(lines).some((t) => t.includes("b"))
);
check("ويُعدُّ المخفيُّ لصاحبه", q.hiddenExclusions(lines) === 1);
check(
  "والمختارُ ليس من غير المشمول",
  !q.exclusions(lines).some((t) => t.includes("c"))
);

/*
  وهذا أخطرُ شرطٍ في الباب: بندٌ قديمٌ لا يعرف الحقلَ — وعقودُ الشركة
  كلُّها كذلك. فلو كان الأصلُ الإخفاءَ اختفت بنودُ «غير المشمول» من
  كلِّ عرضٍ قائم، ولا يُكشف ذلك إلا عند خلافٍ مع عميل.
*/
const old = normalizeState({
  quotations: [
    {
      number: "Q-1",
      date: "2026-01-01",
      status: "مسودة",
      lines: [{ itemId: "x", chosen: false }],
    },
  ],
}).quotations[0];
check(
  "وبندٌ قديمٌ لا يعرف الحقلَ يُذكر",
  q.exclusions(old.lines).length === 1 && old.lines[0].showExcluded === undefined,
  "فالسكوتُ ذكرٌ لا إخفاء"
);
check(
  "والإخفاءُ يُحفظ ويعود",
  normalizeState({
    quotations: [
      {
        number: "Q-2",
        date: "2026-01-01",
        status: "مسودة",
        lines: [{ itemId: "y", chosen: false, showExcluded: false }],
      },
    ],
  }).quotations[0].lines[0].showExcluded === false,
  "فحقلٌ يُحفظ ولا يُحمَّل يسقط صامتاً"
);
check(
  "والخانةُ في المحرّر لغير المختار وحده",
  /\{l\.chosen \? \(\s*\n\s*<span className="text-xs text-slate-400">—<\/span>/.test(page),
  "فلا يُسأل عن ذكرِ بندٍ مشمول"
);

/* ------------------------------------------------------------------ */
console.log("\nوالجمعُ عرضٌ لا حذف:\n");

const grouped = [
  line("g1", { groupId: "G" }),
  line("g2", { groupId: "G" }),
  line("solo"),
];
const groups = [{ id: "G", name: "أعمال التشطيب", detailed: false }];
const priceOf = (l) => l.price;

const rows = q.printedRows(grouped, groups, priceOf);
check(
  "المجموعةُ سطرٌ واحدٌ ومعها المستقلّ",
  rows.length === 2,
  `${rows.length} صفّاً من ٣ بنود`
);
check(
  "وسطرُها باسمها",
  rows[0].kind === "مجموعة" && rows[0].group.name === "أعمال التشطيب"
);
check("وبمجموع أسعارها", rows[0].price === 200, String(rows[0].price));
check(
  "وموضعُها موضعُ أوّلِ بندٍ فيها",
  rows[0].kind === "مجموعة" && rows[1].kind === "بند",
  "ولو جُمعت في الذيل انتقل التجهيزُ بعد التسليم"
);
check(
  "ولا يُحذف بندٌ من الحساب",
  rows[0].lines.length === 2,
  "فالبنودُ باقيةٌ في المجموعة تُحسب منها"
);
check(
  "ومجموعةٌ مفصَّلةٌ تُعرض بنوداً",
  q.printedRows(grouped, [{ ...groups[0], detailed: true }], priceOf).length === 3
);
check(
  "ومجموعةٌ لا بندَ فيها تُعرف",
  q.emptyGroups(grouped, [...groups, { id: "H", name: "فارغة", detailed: false }])
    .length === 1
);
check(
  "وبندٌ نُسب إلى مجموعةٍ محذوفةٍ يُعرض بنداً",
  q.printedRows([line("z", { groupId: "ذهبت" })], groups, priceOf).length === 1,
  "فلا يسقط من المطبوعة"
);

/* ---- والحسابُ من البنود لا من المجموع ---- */
const totals = q.quotationTotals(grouped, "مصنعية ومواد");
check(
  "والمجاميعُ من البنود نفسها",
  totals.price === 300 && totals.cost === 30,
  `سعر ${totals.price} · تكلفة ${totals.cost}`
);
check(
  "وجدولُ الدفعات من المراحل لا من المجموعات",
  /quotationTotals\(\s*\n?\s*lines\.filter\(\(l\) => l\.stage === stage\)/.test(lib),
  "فالمجموعةُ عرضٌ والمرحلةُ دفعة"
);

/* ------------------------------------------------------------------ */
console.log("\nوالأقسامُ الحرّة تدخل المجموع:\n");

const free = [
  {
    id: "F1",
    title: "أعمال خاصّة",
    place: "بنود الأعمال",
    rows: [
      { id: "r1", text: "حوض سباحة", price: 2500 },
      { id: "r2", text: "بلا سعر" },
    ],
  },
  {
    id: "F2",
    title: "شرطٌ خاصّ",
    place: "الشروط",
    rows: [{ id: "r3", text: "التسليم على مرحلتين" }],
  },
];

check("مجموعُ أسعارها", q.freeSectionsTotal(free) === 2500, String(q.freeSectionsTotal(free)));
check(
  "وتدخل سعرَ العرض",
  q.quotationTotals([line("one")], "مصنعية ومواد", free).price === 2600,
  `${q.quotationTotals([line("one")], "مصنعية ومواد", free).price} — مئةٌ للبند و٢٥٠٠ للقسم`
);
check(
  "ولا تُزيد التكلفةَ",
  q.quotationTotals([line("one")], "مصنعية ومواد", free).cost === 10,
  "فلا تكلفةَ محسوبةٌ لها في الكتالوج"
);
check(
  "والهامشُ فرقٌ لا جمع",
  q.quotationTotals([line("one")], "مصنعية ومواد", free).margin === 2590
);
check(
  "وتُقرأ بموضعها",
  q.sectionsAt(free, "الشروط").length === 1 &&
    q.sectionsAt(free, "بنود الأعمال").length === 1 &&
    q.sectionsAt(free, "الالتزامات").length === 0
);
check(
  "وقسمٌ فارغٌ لا يُطبع",
  q.sectionsAt([{ id: "E", title: "", place: "الشروط", rows: [] }], "الشروط")
    .length === 0,
  "فعنوانٌ فارغٌ بلا سطورٍ لا شيء"
);
check(
  "وموضعٌ مجهولٌ يصير ملاحظةً لا يسقط",
  normalizeState({
    quotations: [
      {
        number: "Q-3",
        date: "2026-01-01",
        status: "مسودة",
        lines: [],
        freeSections: [{ title: "ت", place: "موضعٌ لا وجودَ له", rows: [] }],
      },
    ],
  }).quotations[0].freeSections[0].place === "ملاحظات"
);

/* ---- ودورةُ الحفظ ---- */
const back = normalizeState({
  quotations: [
    {
      number: "Q-4",
      date: "2026-01-01",
      status: "مسودة",
      lines: [{ itemId: "a", chosen: true, groupId: "G" }],
      groups: [{ id: "G", name: "مجموعتي", detailed: false }],
      freeSections: free,
    },
  ],
}).quotations[0];
check(
  "وما كُتب يعود كما كُتب",
  (back.groups ?? []).length === 1 &&
    back.groups[0].detailed === false &&
    (back.freeSections ?? []).length === 2 &&
    back.freeSections[0].rows[0].price === 2500 &&
    back.lines[0].groupId === "G",
  "فحقلٌ يُحفظ ولا يُحمَّل يسقط صامتاً"
);
check(
  "ومجموعةٌ بلا رأيٍ تُفصَّل",
  normalizeState({
    quotations: [
      {
        number: "Q-5",
        date: "2026-01-01",
        status: "مسودة",
        lines: [],
        groups: [{ id: "G", name: "ج" }],
      },
    ],
  }).quotations[0].groups[0].detailed === true,
  "فالأصلُ أن تُعرض البنودُ كما كانت"
);

/* ------------------------------------------------------------------ */
console.log("\nوفي الشاشة والمطبوعة:\n");

check("لوحُ المجموعات", /مجموعات الطباعة/.test(page));
check("ولوحُ الأقسام الحرّة", /أقسام حرّة/.test(page));
check("وعمودُ المجموعة عند البنود", /— مستقلّ —/.test(page));
check("وموضعُ الطباعة يُختار", /FREE_PLACES\.map/.test(page));
check(
  "والمطبوعةُ تُرسم بالصفوف لا بالبنود",
  /printedRows\(lines, quotation\.groups/.test(page)
);
check(
  "والأقسامُ تُطبع في مواضعها الأربعة",
  (page.match(/<FreeSections/g) ?? []).length >= 3 &&
    /sectionsAt\(quotation\.freeSections, "الشروط"\)/.test(page)
);
check(
  "وفكُّ المجموعة يُعيد بنودَها مستقلّةً",
  /l\.groupId === g\.id\s*\n?\s*\? \{ \.\.\.l, groupId: undefined \}/.test(page),
  "ولا يحذفها"
);
check(
  "ويُقال لصاحبه إن أخفى",
  /hiddenExclusions/.test(page) || /لا يُذكر/.test(page)
);

/* ------------------------------------------------------------------ */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const { parseBackup } = await jiti.import("../lib/storage.ts");
  const state = parseBackup(fs.readFileSync(BACKUP, "utf8"));
  console.log("\nوعلى دفاتر الشركة:\n");
  for (const quote of state.quotations) {
    const t = q.quotationTotals(quote.lines, quote.pricingMode, quote.freeSections);
    console.log(
      `     ${String(quote.number).padEnd(14)} ${String(quote.status).padEnd(8)} ${String(
        t.price
      ).padStart(10)} د.ك · ${t.chosen} بنداً · ${q.exclusions(quote.lines).length} غيرَ مشمول`
    );
  }
}

console.log(
  bad === 0
    ? "\n✓ ثلاثُ حرّيّات: ما يُذكر من غير المشمول، وجمعُ بنودٍ بمجموعها، وأقسامٌ حرّةٌ تدخل الحساب"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
