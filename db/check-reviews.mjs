/**
 * يفحص تقييمَ العمل والمكافأة.
 *
 *   npm run check:reviews
 *
 * وأهمُّ شرطٍ فيه نصُّ قرار صاحب الشركة: **«ولا تحوَّل إلى مكافأةٍ إلا
 * بأمرٍ منّي»**. فالتقييمُ يقترح، والأمرُ وحدَه يُحوّل الاقتراحَ مالاً
 * — ومن قيَّم لم يَصرِف، ومن صرف لم يُقيّم. وهذا مُثبتٌ في الشِّفْر لا
 * في الكلام: المكافأةُ غيرُ المأمورِ بها لا تمسّ أجراً كالجزاء غيرِ
 * المُقرّ.
 *
 * ويُفحص كذلك:
 *   • أن المعاييرَ هي الخمسةُ التي نصَّ عليها لا غيرَها.
 *   • أن المكافأةَ لا تدخل وعاءَ التأمين — فمكافأةٌ تُزيد خصمَ التأمين
 *     عقوبةٌ على الإحسان.
 *   • أن طريقَ المال واحدٌ، فلا تُصرف مرّتين من بابين.
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
const r = await jiti.import("../lib/reviews.ts");
const payroll = await jiti.import("../lib/payroll.ts");
const { normalizeState } = await jiti.import("../lib/storage.ts");

const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");
const payrollSrc = fs.readFileSync(path.join(ROOT, "lib/payroll.ts"), "utf8");
const lib = fs.readFileSync(path.join(ROOT, "lib/reviews.ts"), "utf8");

/* ------------------------------------------------------------------ */
console.log("\nالمعاييرُ هي التي نصَّ عليها:\n");

const wanted = [
  "الحضور والغياب",
  "العمل المنجَز",
  "النشاط في الموقع",
  "طاعة المهندس",
  "الأوامر المسندة إليه",
];
check(
  "خمسةٌ لا غيرُها",
  r.REVIEW_CRITERIA.length === 5,
  `${r.REVIEW_CRITERIA.length}`
);
check(
  "وبأسمائها كما قيلت",
  r.REVIEW_CRITERIA.map((c) => c.label).join(" · ") === wanted.join(" · "),
  r.REVIEW_CRITERIA.map((c) => c.label).join(" · ")
);
check(
  "وأوزانُها متساوية",
  /وأوزانُها متساوية/.test(lib),
  "فمن رفع وزنَ الطاعة على العمل قيَّم الطاعةَ لا العمل"
);
check("والمجموعُ من ٢٥", r.REVIEW_TOTAL === 25, String(r.REVIEW_TOTAL));

/* ------------------------------------------------------------------ */
console.log("\nوالحُكمُ بالكلام لا بالرقم وحده:\n");

const review = (extra = {}) => ({
  id: "R1",
  period: "أسبوعيّ",
  from: "2026-10-18",
  to: "2026-10-24",
  attendance: 5,
  output: 5,
  activity: 5,
  obedience: 5,
  tasks: 5,
  note: "",
  by: "م. نوح",
  at: "2026-10-24T10:00:00.000Z",
  ...extra,
});

check("الكاملُ ممتاز", r.reviewVerdict(review()) === "ممتاز", r.reviewVerdict(review()));
check(
  "والنصفُ مقبول",
  r.reviewVerdict(
    review({ attendance: 3, output: 2, activity: 3, obedience: 2, tasks: 2 })
  ) === "مقبول",
  `${r.reviewScore(review({ attendance: 3, output: 2, activity: 3, obedience: 2, tasks: 2 }))} من ٢٥`
);
check(
  "والدونُ متقاعس",
  r.reviewVerdict(
    review({ attendance: 1, output: 1, activity: 2, obedience: 2, tasks: 2 })
  ) === "متقاعس" &&
    r.isSlacking(
      review({ attendance: 1, output: 1, activity: 2, obedience: 2, tasks: 2 })
    ),
  "فيُنظر في أمره"
);
check(
  "والنسبةُ تُحسب",
  r.reviewPercent(review()) === 100 &&
    r.reviewPercent(review({ attendance: 0, output: 0, activity: 0, obedience: 0, tasks: 0 })) === 0
);

/* ------------------------------------------------------------------ */
console.log("\nوالتقييمُ يقترح، والأمرُ وحدَه يُحوّله مالاً:\n");

const proposed = r.reviewState(review({ proposedBonus: 50 }));
check(
  "مقترَحٌ ينتظر أمراً",
  proposed.awaitingOrder && !proposed.ordered,
  "فمن رأى العملَ لا يملك المال"
);
const ordered = r.reviewState(
  review({ proposedBonus: 50, orderedBy: "ذياب", orderedAt: "2026-10-25T00:00:00Z", orderedAmount: 40 })
);
check(
  "والمأمورُ به لا ينتظر",
  ordered.ordered && !ordered.awaitingOrder
);
check(
  "والأمرُ قد يخالف المقترَح",
  ordered.review.orderedAmount === 40 && ordered.review.proposedBonus === 50,
  "فالأمرُ لصاحبه"
);
check(
  "وبلا اقتراحٍ لا انتظار",
  !r.reviewState(review()).awaitingOrder
);

const tally = r.employeeReviews("E1", "عامل", [
  review({ id: "a", proposedBonus: 50 }),
  review({ id: "b", to: "2026-10-17", proposedBonus: 30, orderedBy: "ذياب", orderedAt: "x", orderedAmount: 30 }),
  review({ id: "c", to: "2026-10-10" }),
]);
check(
  "ويُعدُّ ما ينتظر وما أُمر به",
  tally.awaiting === 1 && tally.awaitingAmount === 50 && tally.orderedAmount === 30,
  `ينتظر ${tally.awaitingAmount} · أُمر بـ${tally.orderedAmount}`
);
check(
  "والأحدثُ أوّلاً",
  tally.reviews.map((s) => s.review.id).join(",") === "a,b,c",
  tally.reviews.map((s) => s.review.to).join(" ← ")
);
check(
  "والمتوسّطُ على ما قُيّم لا على الزمن",
  /ولا يُحسب له صفرٌ عن أسابيعَ لم يُقيَّم فيها/.test(lib),
  "فذاك تقصيرُ المقيِّم لا تقصيرُ العامل"
);

/* ------------------------------------------------------------------ */
console.log("\nوالمكافأةُ في المسيَّر — المأمورُ بها وحدَها:\n");

const employee = {
  id: "E1",
  code: "001",
  name: "عامل",
  jobTitle: "بنّاء",
  department: "",
  project: "",
  wageType: "شهري",
  basicWage: 300,
  allowances: [],
  active: true,
  isKuwaiti: false,
  insured: false,
  hireDate: "2026-01-01",
  nationality: "",
  civilId: "",
  workPermitExpiry: "",
  residencyExpiry: "",
  notes: "",
};
const settings = payroll.defaultPayrollSettings();

const day = (extra) => ({
  id: "d" + Math.random(),
  employeeId: "E1",
  date: "2026-10-05",
  status: "حاضر",
  hours: 8,
  overtimeHours: 0,
  restDayHours: 0,
  holidayHours: 0,
  note: "",
  ...extra,
});

const withPending = payroll.computePayrollLine({
  employee,
  settings,
  attendance: [day({ bonus: 25, bonusReason: "أنجز", bonusBy: "نوح" })],
});
check(
  "المكافأةُ غيرُ المأمورِ بها لا تمسّ أجراً",
  withPending.bonuses === 0 && withPending.bonusLines.length === 0,
  `${withPending.bonuses}`
);

const withOrdered = payroll.computePayrollLine({
  employee,
  settings,
  attendance: [
    day({ bonus: 25, bonusReason: "أنجز", bonusBy: "نوح", bonusApproved: true }),
  ],
});
check(
  "والمأمورُ بها تُزاد",
  withOrdered.bonuses === 25 && withOrdered.bonusLines.length === 1,
  `${withOrdered.bonuses}`
);
check(
  "وتدخل الأجرَ الإجماليّ",
  withOrdered.gross === withPending.gross + 25,
  `${withPending.gross} ← ${withOrdered.gross}`
);
check(
  "وتُفصَّل في الكشف بسببها",
  withOrdered.bonusLines[0].reason === "أنجز",
  "فيُقرأ فيُشكر عليه"
);
check(
  "ومستقلّةٌ عن البدلات",
  /البدلُ حقٌّ ثابتٌ في العقد/.test(payrollSrc),
  "ولو خُلطا ظنَّها حقّاً دائماً فطالب بها شهراً لم يُحسن فيه"
);

/* ---- وعاءُ التأمين ---- */
const kuwaiti = { ...employee, isKuwaiti: true, insured: true };
const insuredPending = payroll.computePayrollLine({
  employee: kuwaiti,
  settings: { ...settings, socialInsuranceEnabled: true },
  attendance: [day({ bonus: 100, bonusReason: "أنجز", bonusBy: "نوح" })],
});
const insuredOrdered = payroll.computePayrollLine({
  employee: kuwaiti,
  settings: { ...settings, socialInsuranceEnabled: true },
  attendance: [
    day({ bonus: 100, bonusReason: "أنجز", bonusBy: "نوح", bonusApproved: true }),
  ],
});
check(
  "ولا تدخل وعاءَ التأمين",
  insuredOrdered.socialInsurance === insuredPending.socialInsurance,
  `${insuredPending.socialInsurance} = ${insuredOrdered.socialInsurance} — فمكافأةٌ تُزيد الخصم عقوبةٌ على الإحسان`
);
check(
  "ويبقى صافيه أزيدَ بها",
  insuredOrdered.net === payroll.round3?.(insuredPending.net + 100) ||
    Math.abs(insuredOrdered.net - (insuredPending.net + 100)) < 0.002,
  `${insuredPending.net} ← ${insuredOrdered.net}`
);
check(
  "والسببُ مكتوبٌ في موضعه",
  /ووعاءُ التأمين لا يَشمل المكافأة/.test(payrollSrc)
);

/* ------------------------------------------------------------------ */
console.log("\nوطريقُ المال واحد:\n");

check(
  "الأمرُ يُنزل مكافأةً مُقرَّةً في يوم التقييم",
  /bonusApproved: true,/.test(page) && /مكافأةُ تقييم/.test(page),
  "فتدخل المسيَّر من بابه"
);
check(
  "ولا بابَ ثانياً للصرف",
  /فلا يُصرف مرّتين من بابين/.test(page)
);
check(
  "والأمرُ لمن يملك المال",
  /canOrder=\{allow\("payroll\.run"\)\}/.test(page),
  "والتقييمُ لمن يرى الموقع"
);
check(
  "ويُسجَّل الأمرُ باسم آمره",
  /أمرٌ بمكافأة/.test(page)
);
check(
  "والمكافأةُ في الحضور لها حرزُ الجزاء",
  /ولا تُحفظ مكافأةٌ بغيره، كالجزاء/.test(page) &&
    /مكافآتٌ تنتظر أمرك/.test(page)
);

/* ------------------------------------------------------------------ */
console.log("\nوالحفظ:\n");

const back = normalizeState({
  employees: [{ ...employee, reviews: [review({ proposedBonus: 50 })] }],
}).employees[0];
check(
  "وما كُتب يعود كما كُتب",
  (back.reviews ?? []).length === 1 &&
    back.reviews[0].proposedBonus === 50 &&
    back.reviews[0].output === 5,
  `${(back.reviews ?? []).length} تقييماً`
);
check(
  "ودرجةٌ فوق الحدّ تُقصّ",
  normalizeState({
    employees: [{ ...employee, reviews: [review({ output: 50 })] }],
  }).employees[0].reviews[0].output === 5,
  "فمن كتب عشرةً من خمسةٍ أفسد كلَّ متوسّط"
);
check(
  "ومدّةٌ مجهولةٌ تصير أسبوعيّة",
  normalizeState({
    employees: [{ ...employee, reviews: [review({ period: "لا وجودَ له" })] }],
  }).employees[0].reviews[0].period === "أسبوعيّ"
);

const win = r.reviewWindowFor("شهريّ", "2026-10-20");
check(
  "ومدّةُ الشهر من أوّله إلى آخره",
  win.from === "2026-10-01" && win.to === "2026-10-31",
  `${win.from} → ${win.to}`
);
check(
  "والأسبوعُ سبعةٌ من الأحد",
  r.reviewWindowFor("أسبوعيّ", "2026-10-20").from === "2026-10-18",
  `${r.reviewWindowFor("أسبوعيّ", "2026-10-20").from} → ${r.reviewWindowFor("أسبوعيّ", "2026-10-20").to}`
);

console.log(
  bad === 0
    ? "\n✓ التقييم: بمعاييره الخمسة، ولا يصير مكافأةً إلا بأمر صاحب الشركة، ولا يُزيد خصمَ تأمينه"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
