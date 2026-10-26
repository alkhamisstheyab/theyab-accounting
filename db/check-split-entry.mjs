/**
 * يفحص كتابةَ توزيعِ المبلغ على أكثر من دفعة — في الشاشة لا في الحساب.
 *
 *   npm run check:split-entry
 *
 * والحسابُ كان سليماً من أوّل يوم: `installmentSplits` في نموذج الحركة،
 * و`receivedOn` تنسب كلَّ حصّةٍ لدفعتها. والعلّةُ كانت في **إدخالها**.
 *
 * وقعت هذه: قبض صاحبُ الشركة ألفاً من بوعباس عن بندَي الصحي والكهرباء
 * — خمسَ مئةٍ لكلٍّ — فرفع علامةَ التوزيع واختار الدفعة الثامنة، فعاد
 * المختارُ فارغاً ولم يبلغ خانةَ المبلغ: «عند اختيار الدفعة الثامنة لا
 * تظهر ولا أستطيع أن أكتب أيّ شيءٍ في الخانة».
 *
 * والسببُ أنّ صفوفَ التوزيع تُحفظ نصّاً في النموذج، وكانت الدالّةُ
 * الحافظةُ **تُصفّي كلَّ سطرٍ لم يكتمل رقمُه ومبلغُه معاً**. فسطرٌ
 * اختير رقمُه ولم يُكتب مبلغُه يُسقَط في اللحظة نفسِها، وكذلك السطرُ
 * الفارغُ الذي يُضيفه زرُّ «+ دفعة أخرى». فلا يُرى واحدٌ منهما.
 *
 * والتصفيةُ موضعُها الحفظُ لا الكتابة: `parseSplits` يشترط التمامَ،
 * فلا يدخل الدفاترَ سطرٌ ناقص.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const page = fs
  .readFileSync(path.join(ROOT, "app/page.tsx"), "utf8")
  .replace(/\r\n/g, "\n");

/* ---- تُنتزع الدوالُّ الثلاث كما هي في الشاشة ---- */
const grab = (head, end) => {
  const at = page.indexOf(head);
  if (at < 0) throw new Error(`لا موضع: ${head}`);
  const stop = page.indexOf(end, at);
  return page.slice(at, stop < 0 ? undefined : stop);
};

const src =
  grab("function parseSplits(text: string)", "function splitsToText") +
  grab("const splitsToRows = (text: string)", "const rowsToSplits") +
  grab("const rowsToSplits = (rows: SplitRow[])", "function formOf");

const strip = (code) =>
  code
    .replace(/: InstallmentSplit\[\] \| undefined/g, "")
    .replace(/: SplitRow\[\]/g, "")
    .replace(/: string\[\]/g, "")
    .replace(/: string/g, "")
    .replace(/InstallmentSplit\[\] \| undefined/g, "");

const { parseSplits, splitsToRows, rowsToSplits } = new Function(
  "round3",
  `${strip(src)}\nreturn { parseSplits, splitsToRows, rowsToSplits };`
)((n) => Math.round(n * 1000) / 1000);

console.log("\nما يُكتب لا يُصفّى، وما يُحفظ يُصفّى:\n");

check(
  "الحافظةُ لا تُصفّي شيئاً",
  !/rowsToSplits[\s\S]{0,200}\.filter\(/.test(page),
  "فسطرٌ ناقصٌ يُصفّى لا يُكمَل أبداً"
);
check(
  "والمُحلِّلُ يشترط التمامَ",
  /\.filter\(\(x\) => x\.number > 0 && x\.amount > 0\)/.test(page),
  "فلا يدخل الدفاترَ سطرٌ بلا رقمٍ أو بلا مبلغ"
);

console.log("\nوالدورةُ تُجرَّب خطوةً خطوة:\n");

/* ١) يرفع العلامة */
let rows = splitsToRows(" ");
check(
  "رفعُ العلامة يُظهر سطراً فارغاً",
  rows.length === 1 && rows[0].number === 0 && rows[0].amount === ""
);

/* ٢) يختار الدفعة ولا مبلغ بعد — وهذا موضعُ العلّة */
let text = rowsToSplits(rows.map((r, i) => (i === 0 ? { ...r, number: 8 } : r)));
rows = splitsToRows(text);
check(
  "واختيارُ الدفعة يبقى ومبلغُها فارغ",
  rows.length === 1 && rows[0].number === 8 && rows[0].amount === "",
  `النصّ ${JSON.stringify(text)} — وهذه هي التي أخفقت`
);

/* ٣) يكتب المبلغ */
text = rowsToSplits(rows.map((r, i) => (i === 0 ? { ...r, amount: "500" } : r)));
rows = splitsToRows(text);
check(
  "ثمّ يُكتب المبلغ",
  rows[0].number === 8 && rows[0].amount === "500",
  text
);

/* ٤) «+ دفعة أخرى» */
text = rowsToSplits([...rows, { number: 0, amount: "" }]);
rows = splitsToRows(text);
check(
  "و«+ دفعة أخرى» يُضيف سطراً يبقى",
  rows.length === 2 && rows[1].number === 0 && rows[1].amount === "",
  text
);

/* ٥) و٦) الثاني */
text = rowsToSplits(rows.map((r, i) => (i === 1 ? { ...r, number: 9 } : r)));
rows = splitsToRows(text);
check("واختيارُ الثاني يبقى", rows[1].number === 9 && rows[1].amount === "");
text = rowsToSplits(rows.map((r, i) => (i === 1 ? { ...r, amount: "500" } : r)));
rows = splitsToRows(text);
check(
  "ومبلغُه",
  rows.length === 2 && rows[1].amount === "500",
  text
);

/* ٧) ما يدخل الدفاتر */
const saved = parseSplits(text);
check(
  "والمحفوظُ حصّتان بدفعتيهما",
  saved?.length === 2 &&
    saved[0].number === 8 &&
    saved[0].amount === 500 &&
    saved[1].number === 9 &&
    saved[1].amount === 500,
  JSON.stringify(saved)
);

/* ٨) الحذف */
text = rowsToSplits(rows.filter((_, i) => i !== 1));
check("والحذفُ يُنقص سطراً", splitsToRows(text).length === 1, text);

console.log("\nولا يدخل الدفاترَ ناقص:\n");

check(
  "سطرٌ بلا مبلغٍ لا يُحفظ",
  parseSplits("8:") === undefined
);
check(
  "وسطرٌ بلا رقمٍ لا يُحفظ",
  parseSplits("0:500") === undefined
);
check(
  "والتامُّ وحدَه يُحفظ من بين الناقصين",
  JSON.stringify(parseSplits("8:500|0:|9:")) ===
    JSON.stringify([{ number: 8, amount: 500 }]),
  JSON.stringify(parseSplits("8:500|0:|9:"))
);
check(
  "وفارغٌ كلُّه لا يُحفظ",
  parseSplits(" ") === undefined,
  "فلا تُربط الحركةُ بتوزيعٍ لا شيءَ فيه"
);

console.log(
  bad === 0
    ? "\n✓ توزيعُ المبلغ يُكتب سطراً سطراً، ولا يدخل الدفاترَ منه ناقص"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
