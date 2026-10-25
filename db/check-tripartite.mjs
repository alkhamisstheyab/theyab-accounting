/**
 * يفحص العقدَ ثلاثيَّ الأطراف، ومن يدفع كلَّ دفعة.
 *
 *   npm run check:tripartite
 *
 * طلبه صاحب الشركة في ٢٥ أكتوبر ٢٠٢٦ من واقعٍ قائم: عقدُ نصفِ تشطيبٍ
 * قيمتُه ٢٧٠٠ ينفّذه مينا المقاول، تدفع الشركةُ منه ٢٠٠٠ على أربع
 * دفعات، ويدفع المالكُ د. بوعباس ٧٠٠ على ثلاثٍ مباشرةً إلى المقاول.
 * ونطاقُ العمل واحد: الـ٧٠٠ جزءٌ من ثمن نصف التشطيب لا أعمالٌ زائدة.
 *
 * وأهمُّ ما يُفحص شرطُه: **«أرجو أن يكون اختيارياً الطرفُ الثالث حتى
 * لا يلزمنا في المستقبل بإدخال طرفٍ ثالث»**. فالغيابُ هو الأصل في
 * الموضعين: لا `thirdParty` يعني عقداً ثنائيّاً، و`payer` فارغٌ يعني
 * «الشركة» — فلا يتغيّر عقدٌ من عقوده الثمانين بفتح هذا الباب.
 *
 * وأثرُه في الدفاتر: ما يدفعه الطرفُ الثالث لا يمرّ بحساب الشركة، فلا
 * قيدَ له — كدعم الدولة. فلو حُسب على الشركة ظهرت مدينةً بما لا تدفع.
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
const {
  PAYERS,
  THIRD_PARTY_ROLES,
  hasThirdParty,
  payerOf,
  payerProblem,
  splitByPayer,
  splitWarning,
  thirdPartyLine,
} = await jiti.import("../lib/tripartite.ts");
const { normalizeState } = await jiti.import("../lib/storage.ts");

const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");

/* ---- عقدُ الواقع ---- */
const inst = (number, value, payer) => ({
  number,
  value: String(value),
  condition: `شرط ${number}`,
  status: "غير مستحقة",
  approved: false,
  approvedBy: "",
  approvedAt: "",
  approvalNote: "",
  confirmed: false,
  confirmedBy: "",
  confirmedAt: "",
  confirmNote: "",
  ...(payer ? { payer } : {}),
});

const real = {
  id: "c1",
  name: "مينا سيف فايق بلامون وطلعت بركات نعمان رزق الله",
  specialty: "صحّي",
  phone: "",
  project: "مشروع الدكتور عبدالرحمن بوعباس",
  contractNumber: "5014",
  contractType: "عقد",
  workType: "نصف تشطيب",
  contractValue: 2700,
  installmentsCount: 7,
  counterpartyType: "مقاول",
  documentType: "عقد",
  parentContractNumber: "",
  contractDate: "2026-10-25",
  civilId: "",
  passportNumber: "",
  nationality: "",
  address: "",
  area: "",
  block: "",
  plot: "",
  licenseNumber: "",
  buildingDescription: "",
  durationDays: 60,
  delayPenaltyPerDay: 0,
  maxPenaltyPercent: 0,
  terminationAfterDays: 0,
  warrantyYears: 0,
  preamble: "",
  notes: "",
  clauses: [],
  obligations: [],
  thirdParty: {
    name: "د. عبدالرحمن بوعباس",
    role: "مالك",
    civilId: "280010101010",
    phone: "99999999",
    address: "",
  },
  durationNote:
    "نصف التشطيب خلال المدّة المذكورة، والباقي يُستكمل بعد المساح",
  installments: [
    inst(1, 500),
    inst(2, 500),
    inst(3, 500),
    inst(4, 500),
    inst(5, 250, "الطرف الثالث"),
    inst(6, 250, "الطرف الثالث"),
    inst(7, 200, "الطرف الثالث"),
  ],
};

console.log("\nالقسمةُ على دافعيها:\n");

const split = splitByPayer(real);
check("قيمةُ العقد كاملة", split.total === 2700, String(split.total));
check("وعلى الشركة", split.company === 2000, String(split.company));
check("وعلى الطرف الثالث", split.third === 700, String(split.third));
check("وأربعُ دفعاتٍ عليها", split.companyCount === 4);
check("وثلاثٌ عليه", split.thirdCount === 3);
check("ولا فرقَ في الجدول", split.gap === 0, String(split.gap));
check("ولا يُنبَّه على مستقيم", splitWarning(split) === "");

console.log("\nوالطرفُ الثالثُ اختياريٌّ — وهذا شرطُه:\n");

const twoParty = { ...real, thirdParty: undefined, installments: [
  inst(1, 1000),
  inst(2, 1700),
] };
check("عقدٌ بلا ثالثٍ لا ثالثَ له", hasThirdParty(twoParty) === false);
check(
  "ودفعاتُه كلُّها على الشركة بلا خانةٍ تُملأ",
  splitByPayer(twoParty).company === 2700 &&
    splitByPayer(twoParty).third === 0,
  "فلا يتغيّر عقدٌ قديمٌ بفتح الباب"
);
check(
  "وفارغُ «من يدفع» الشركةُ لا مجهول",
  payerOf(inst(1, 100)) === "الشركة",
  payerOf(inst(1, 100))
);
check(
  "وصفةٌ بلا اسمٍ لا تُنشئ ثالثاً",
  hasThirdParty({ ...real, thirdParty: { ...real.thirdParty, name: "  " } }) ===
    false,
  "فلا تُطبع خانةُ توقيعٍ لا صاحبَ لها"
);
check(
  "ولا تُسند دفعةٌ إلى ثالثٍ لا وجودَ له",
  payerProblem(twoParty, "الطرف الثالث") !== "",
  payerProblem(twoParty, "الطرف الثالث")
);
check("وتُسند في العقد الثلاثيّ", payerProblem(real, "الطرف الثالث") === "");
check("والشركةُ تُسند دائماً", payerProblem(twoParty, "الشركة") === "");

console.log("\nوالجدولُ يُسأل عنه إن خالف القيمة:\n");

const short = splitByPayer({ ...real, contractValue: 3000 });
check(
  "ناقصٌ يُقال",
  splitWarning(short).includes("أقلُّ من قيمة العقد"),
  splitWarning(short)
);
const over = splitByPayer({ ...real, contractValue: 2000 });
check(
  "وزائدٌ يُقال",
  splitWarning(over).includes("يزيد على قيمة العقد"),
  splitWarning(over)
);

console.log("\nودورةُ التخزين:\n");

const back = normalizeState({ contractors: [real] }).contractors[0];
check(
  "الطرفُ الثالثُ يعود كما كُتب",
  back.thirdParty?.name === "د. عبدالرحمن بوعباس" &&
    back.thirdParty?.role === "مالك" &&
    back.thirdParty?.civilId === "280010101010",
  "فحقلٌ يُحفظ ولا يُحمَّل يسقط صامتاً"
);
check(
  "وملاحظةُ المدّة تعود",
  back.durationNote?.includes("بعد المساح") === true
);
check(
  "و«من يدفع» يعود في دفعاته",
  back.installments.filter((i) => payerOf(i) === "الطرف الثالث").length === 3
);
check(
  "ودفعاتُ الشركة تبقى بلا حقلٍ زائد",
  back.installments[0].payer === undefined,
  "فلا يُكتب في الملفّ ما معناه الصمت"
);
check(
  "وثالثٌ بلا اسمٍ يُسقَط",
  normalizeState({
    contractors: [{ ...real, thirdParty: { role: "مالك", phone: "9" } }],
  }).contractors[0].thirdParty === undefined
);
check(
  "ودافعٌ لا يُفهم يعود «الشركة»",
  normalizeState({
    contractors: [{ ...real, installments: [inst(1, 100, "فلان")] }],
  }).contractors[0].installments[0].payer === undefined,
  "ولا يُطوى التزامٌ خلف كلمةٍ لا تُفهم"
);

console.log("\nوفي الشاشة والمطبوعة:\n");

check(
  "لوحُ الطرف الثالث في النموذج موسومٌ اختياريّاً",
  page.includes("الطرف الثالث — اختياريّ") &&
    page.includes("اتركه فارغاً في العقود الثنائيّة")
);
check(
  "وخانةُ «من يدفع» لا تظهر إلا في الثلاثيّ",
  /\{tripartite && !documentary && \(/.test(page),
  "فسؤالٌ عن دافعٍ في عقدٍ طرفاه اثنان بلا معنى"
);
check(
  "والقسمةُ تُعرض وهو يكتب",
  page.includes("تُدفع إليه مباشرةً فلا قيدَ لها في دفاترك")
);
check(
  "وملاحظةُ المدّة في النموذج",
  page.includes('label="ملاحظة على المدّة"')
);
check(
  "والطرفُ الثالثُ يُطبع في الأطراف",
  page.includes("الطرف الثالث : السيد / {contract.thirdParty.name}")
);
check(
  "وله موضعُ توقيعٍ ثالث",
  /contract\.thirdParty\?\.name \? "grid-cols-3" : "grid-cols-2"/.test(page),
  "فورقةٌ يدفع فيها ثالثٌ ولا موضعَ لتوقيعه لا تُلزمه"
);
check(
  "وشرطُ السداد يُقسَم بين الطرفين",
  page.includes("دينار من قبل الطرف الأول، و") &&
    page.includes("تُسدَّد للطرف الثاني"),
  "فلا يُلزم العقدُ الشركةَ بما لم تلتزم به"
);
check(
  "وعمودُ «يسدّدها» في الجدول المطبوع",
  page.includes(">\n                      يسدّدها") ||
    page.includes("يسدّدها")
);
check(
  "وملاحظةُ المدّة تُطبع",
  page.includes("ملاحظة على المدّة: {contract.durationNote}")
);

console.log("\nوالأسماءُ والصفات:\n");

check("دافعان لا أكثر", PAYERS.length === 2, PAYERS.join(" · "));
check(
  "وصفاتُ الثالث أربع",
  THIRD_PARTY_ROLES.length === 4,
  THIRD_PARTY_ROLES.join(" · ")
);
check(
  "ويُوصف في سطر",
  thirdPartyLine(real.thirdParty) ===
    "د. عبدالرحمن بوعباس (مالك) — مدنيّ 280010101010",
  thirdPartyLine(real.thirdParty)
);

console.log(
  bad === 0
    ? "\n✓ العقدُ ثلاثيُّ الأطراف: الثالثُ اختياريّ، ولكلِّ دفعةٍ دافعُها، وما يدفعه لا قيدَ له"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
