/**
 * يفحص وسمَ العقد المنتهي.
 *
 *   npm run check:settled [نسخة.json]
 *
 * لم يكن للعقد حالٌ قطّ: المشروع له حال، والعقد يُكتب فيبقى معروضاً
 * أبداً. فلمّا بلغت العقود سبعةً وأربعين وأُقفل أحدَ عشرَ منها، سأل
 * صاحب الشركة: «كيف أقفل عقد ٢٠٠٢؟» وقد أُقفل — ولم يكن في الشاشة ما
 * يقول ذلك.
 *
 * والمفحوصُ هنا ثلاثُ حدودٍ يسهل أن تُخطأ:
 *
 *   • الإقفال بالتراضي لا يعتمد الدفعات — فلا يُشترط الاعتماد للانتهاء،
 *     وإلا بقي عقدا عبدالعزيز العمر مفتوحَين وهما أوثقُ ما أُقفل.
 *   • والعقد الفارغ ليس منتهياً — ثلاثةٌ في الدفاتر بلا جدول.
 *   • والجدول الناقص لا يُحكم به — فلا يُقال «انتهى» وقيمتُه خارج دفعاته.
 *
 * وعلى النسخة إن أُعطيت: تُعدّ المنتهية والفارغة، ويُتحقّق أن ما بقي
 * معروضاً هو ما فيه باقٍ فعلاً.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { contractSettlement } = await jiti.import("../lib/storage.ts");

/* عقدٌ بدفعاتٍ، ومعه قيودُ دفعها */
const build = (value, installments, paid = []) => ({
  contract: {
    id: "c1",
    contractNumber: "9001",
    name: "مقاول",
    project: "مشروع أ",
    counterpartyType: "مقاول",
    contractValue: value,
    installments: installments.map((i, k) => ({ number: k + 1, ...i })),
  },
  movements: paid.map((p, k) => ({
    id: String(k),
    entryNo: 9000 + k,
    date: "2026-05-01",
    amount: p.amount,
    debitCode: "5120",
    creditCode: "1111",
    contractNumber: "9001",
    installmentNumber: p.number,
    description: "دفعة",
    paymentMethod: "نقدي",
    approval: "معتمدة",
    project: "مشروع أ",
    item: "EXP024",
  })),
});

const settle = (value, installments, paid) => {
  const b = build(value, installments, paid);
  return contractSettlement(b.movements, b.contract);
};

console.log("\nالباقي هو الميزان:\n");

const open = settle(1000, [{ value: "600", approved: true }, { value: "400" }], [
  { number: 1, amount: 600 },
]);
check("عقدٌ دُفع بعضُه ليس منتهياً", open.settled === false, `باقٍ ${open.remaining}`);

const done = settle(
  1000,
  [{ value: "600", approved: true }, { value: "400", approved: true }],
  [{ number: 1, amount: 600 }, { number: 2, amount: 400 }]
);
check("ومن دُفع كلُّه منتهٍ", done.settled === true && done.remaining === 0);
check("ولا يُقال فيه «دفعاتٌ بلا اعتماد»", done.paidUnapproved === 0);

console.log("\nوالإقفال بالتراضي ينتهي بلا اعتماد:\n");

/* كعقدَي عبدالعزيز العمر: أُسقط الباقي بخصمٍ، والدفعات غير معتمدة */
const terminated = settle(
  11500,
  [
    { value: "7275" },
    { value: "4225", deduction: "4225", deductionReason: "اتفاق إنهاء موقَّع" },
  ],
  [{ number: 1, amount: 7275 }]
);
check(
  "عقدٌ أُسقط باقيه ولم تُعتمد دفعاتُه منتهٍ",
  terminated.settled === true,
  `أُسقط ${terminated.writtenOff} والباقي ${terminated.remaining}`
);
check(
  "ويُقال إن فيه دفعةً دخلها مالٌ بلا اعتماد",
  terminated.paidUnapproved === 1
);

console.log("\nوالخلوّ ليس انتهاءً:\n");

const empty = settle(0, [], []);
check("عقدٌ بلا دفعةٍ ولا قيمة ليس منتهياً", empty.settled === false);
check("ويُوسم بأن جدولَه لم يُكتب", empty.unwritten === true);

const blankRows = settle(0, [{ value: "" }, { value: "" }], []);
check("ودفعاتٌ بلا قيمةٍ كالعدم", blankRows.settled === false && blankRows.unwritten === true);

console.log("\nوالجدول الناقص لا يُحكم به:\n");

const short = settle(5000, [{ value: "1000", approved: true }], [
  { number: 1, amount: 1000 },
]);
check(
  "جدولٌ لا يبلغ قيمةَ العقد لا يُنتهى به وإن سُدِّد",
  short.settled === false,
  "الجدول 1000 والقيمة 5000"
);
const exact = settle(1000, [{ value: "1000", approved: true }], [
  { number: 1, amount: 1000 },
]);
check("ومن ساوى القيمة يُحكم به", exact.settled === true);

console.log("\nوالزائد لا يُفتح عقداً:\n");
const over = settle(1000, [{ value: "1000", approved: true }], [
  { number: 1, amount: 1200 },
]);
check("دُفع أكثر من المستحقّ فهو منتهٍ والباقي سالب", over.settled === true && over.remaining < 0);

console.log("\nوالتوثيقي لا يُحسب دفعة:\n");
const withDoc = settle(
  1000,
  [
    { value: "1000", approved: true },
    { value: "-4000", informational: true },
  ],
  [{ number: 1, amount: 1000 }]
);
check("صفُّ التوثيق لا يُنقص الجدول ولا يمنع الانتهاء", withDoc.settled === true, `الجدول ${withDoc.valued}`);

console.log("\nوالشاشة تقول ذلك:\n");
const page = fs.readFileSync("app/page.tsx", "utf8");
check(
  "مرشِّحٌ بحال العقد",
  /<Field\s+label="حال العقد"/.test(page)
);
check(
  "ويُقال كم أُخفي — فالإخفاء الصامت أسوأ من الزحام",
  /عقداً منتهياً مُخفىً/.test(page)
);
check("ووسمُ «مُنتهٍ» الأخضر", page.includes("دفعاتُه معتمدةٌ ولا مستحقَّ باقياً فيه"));
check(
  "ووسمٌ ثانٍ لمن دُفع بلا اعتماد",
  page.includes("دفعةً دخلها مالٌ ولم يشهد المهندس")
);
check(
  "ومن لم يُكتب جدولُه يُقال له",
  page.includes("لا قيمةَ لهذا العقد ولا دفعةَ فيه")
);
check(
  "ولا تُعرض لوحةُ الإقفال على عقدٍ انتهى — فلا تفعل شيئاً",
  page.includes("{canConfirm && !settle.settled && (")
);
check(
  "والمعروض افتراضاً الجارية",
  page.includes('useState("الجارية")')
);

/* ---- وعلى دفاتر الشركة ---- */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const d = JSON.parse(fs.readFileSync(BACKUP, "utf8")).data;
  const rows = d.contractors.map((c) => ({
    c,
    s: contractSettlement(d.movements, c),
  }));
  const settled = rows.filter((r) => r.s.settled);
  const unwritten = rows.filter((r) => r.s.unwritten);

  console.log("\nوعلى دفاتر الشركة:\n");
  console.log(`     العقود: ${rows.length} · منتهية: ${settled.length} · بلا جدول: ${unwritten.length}`);
  console.log(`     المنتهية: ${settled.map((r) => r.c.contractNumber).join(" · ")}`);
  console.log(`     بلا جدول: ${unwritten.map((r) => r.c.contractNumber).join(" · ")}`);

  check(
    "ولا عقدَ منتهٍ وفيه باقٍ",
    settled.every((r) => r.s.remaining <= 0)
  );
  check(
    "ولا عقدَ بلا جدولٍ يُعدّ منتهياً",
    unwritten.every((r) => !r.s.settled)
  );
  check(
    "والجارية فيها باقٍ كلُّها",
    rows.filter((r) => !r.s.settled).every((r) => r.s.remaining > 0 || r.s.unwritten)
  );
  const withMoney = settled.filter((r) => r.s.paidUnapproved > 0);
  console.log(
    `     ومنتهٍ دخله مالٌ بلا اعتماد: ${
      withMoney.map((r) => r.c.contractNumber).join(" · ") || "لا شيء"
    }`
  );
}

console.log(
  bad === 0
    ? "\n✓ ما انتهى يُقال إنه انتهى، وما لم يُكتب لا يُحسب منتهياً"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
