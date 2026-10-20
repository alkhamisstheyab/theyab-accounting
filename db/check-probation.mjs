/**
 * يفحص فترةَ التجربة.
 *
 *   npm run check:probation
 *
 * وأخطرُ ما فيها التثبيت: فمن ثبّت عاملاً وكتب تعيينَه يومَ التثبيت
 * أسقط عنه مئةَ يومٍ من خبرته — تظهر نقصاً في مكافأة نهاية الخدمة
 * وفي استحقاق الإجازة بعد سنين ولا يُدرى سببُها. وصاحبُ الشركة نصَّ
 * على خلافه: «تُحتسب مدّةُ التجربة من خبرته الفعلية».
 *
 * وثانيها الحدُّ: مئةُ **يومِ عمل** لا مئةُ يومٍ من التقويم (قانون
 * العمل ٦/٢٠١٠ م٣٠). ومن حسبها تقويماً أنهى التجربةَ قبل حقِّها بنحو
 * سبعةَ عشرَ يوماً.
 *
 * وثالثها التجاوز: من مضت تجربتُه ولم يُقرَّر فيه ثُبّت بحكم الواقع،
 * فإنهاؤه بعدها فصلٌ لا إنهاءُ تجربة — فيُنبَّه ولا يُمنع.
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
  PROBATION_DAYS,
  PROBATION_SOON,
  expectedEnd,
  workedDays,
  probationState,
  underProbation,
  serviceStart,
  canConfirm,
  endWarning,
  outcomeLabel,
} = await jiti.import("../lib/probation.ts");
const { endOfService } = await jiti.import("../lib/payroll.ts");
const { normalizeState, emptyState } = await jiti.import("../lib/storage.ts");
const { buildNotices } = await jiti.import("../lib/notifications.ts");

const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");

/* ---- أداةُ البناء ---- */
const employee = (over = {}) => ({
  id: "e1",
  code: "1",
  name: "سامي",
  civilId: "",
  nationality: "هندي",
  isKuwaiti: false,
  jobTitle: "بنّاء",
  department: "موقع",
  project: "مشروع",
  hireDate: "2026-07-01",
  endDate: "",
  wageType: "شهري",
  basicWage: 300,
  registeredWage: 0,
  allowances: [],
  iban: "",
  wageAccount: "",
  restDay: "الجمعة",
  active: true,
  passportNumber: "",
  workPermitExpiry: "2027-01-01",
  residencyExpiry: "2027-01-01",
  notes: "",
  probation: { start: "2026-07-01", days: PROBATION_DAYS },
  ...over,
});

/** أيّامُ دوامٍ متتاليةٌ من يومٍ، بحالةٍ واحدة */
const days = (from, count, status = "حاضر", id = "e1") => {
  const out = [];
  const at = new Date(from);
  for (let i = 0; i < count; i++) {
    out.push({
      employeeId: id,
      date: at.toISOString().slice(0, 10),
      status,
      hours: 8,
      overtimeHours: 0,
      note: "",
    });
    at.setDate(at.getDate() + 1);
  }
  return out;
};

console.log("\nالحدُّ مئةُ يومِ عملٍ لا مئةُ يومٍ من التقويم:\n");

check("والحدُّ مئة", PROBATION_DAYS === 100, String(PROBATION_DAYS));
/*
  ومئةُ يومِ عملٍ من ١ يوليو تُتمّ في ٢٤ أكتوبر: ستّةَ عشرَ أسبوعاً
  (٩٦ يومَ عمل) وأربعةُ أيّام، ويومُ البداية محسوبٌ منها.
*/
check(
  "والموعدُ المتوقَّع يتجاوز المئةَ تقويميّاً",
  expectedEnd("2026-07-01", 100) === "2026-10-24",
  expectedEnd("2026-07-01", 100)
);
check(
  "وهو بعد المئة التقويميّة بستّةَ عشرَ يوماً",
  (new Date(expectedEnd("2026-07-01", 100)) - new Date("2026-10-08")) /
    86400000 ===
    16,
  "فمن حسبها تقويماً أنهى التجربةَ قبل حقِّها بنصف شهر"
);
check(
  "وحدٌّ أقصرُ يُحسب على قياسه",
  expectedEnd("2026-07-01", 60) === "2026-09-08",
  expectedEnd("2026-07-01", 60)
);
check("وبلا بدايةٍ لا موعد", expectedEnd("", 100) === "");

console.log("\nوالمعتبرُ ما سُجّل في الدوام:\n");

check(
  "الحاضرُ يُحتسب",
  workedDays(days("2026-07-01", 10), "e1", "2026-07-01", "2026-12-31") === 10
);
check(
  "والعطلةُ الرسميّةُ تُحتسب",
  workedDays(
    days("2026-07-01", 3, "عطلة رسمية"),
    "e1",
    "2026-07-01",
    "2026-12-31"
  ) === 3,
  "فلا تُمدّ تجربتُه لأنّ الدولة عطّلت"
);
for (const status of [
  "غياب بعذر",
  "غياب بدون عذر",
  "إجازة سنوية",
  "إجازة مرضية",
  "راحة أسبوعية",
])
  check(
    `و«${status}» لا يُحتسب`,
    workedDays(days("2026-07-01", 5, status), "e1", "2026-07-01", "2026-12-31") ===
      0
  );
check(
  "ولا يُحتسب دوامُ غيره",
  workedDays(days("2026-07-01", 9, "حاضر", "e2"), "e1", "2026-07-01", "2026-12-31") ===
    0
);
check(
  "ولا ما كان قبل بدايتها",
  workedDays(days("2026-06-01", 20), "e1", "2026-07-01", "2026-12-31") === 0
);

console.log("\nوالحالُ يُقرأ:\n");

const running = probationState(employee(), days("2026-07-01", 20), "2026-07-25");
check("جاريةٌ في أوّلها", running.status === "جارية", running.status);
check("وعددُها من الدوام", running.worked === 20, String(running.worked));
check("والباقي", running.remaining === 80, String(running.remaining));

const soon = probationState(
  employee(),
  days("2026-07-01", 95),
  "2026-10-10"
);
check(
  "ويقرب انتهاؤها عند الحدّ",
  soon.status === "يقرب انتهاؤها",
  `${soon.remaining} باقياً · الحدّ ${PROBATION_SOON}`
);

const over = probationState(employee(), days("2026-07-01", 100), "2026-10-20");
check("وتتجاوز الحدَّ بالعمل", over.status === "تجاوزت الحدّ" && over.overdue);
check(
  "وتتجاوزه بالتقويم ولو لم يُسجَّل دوام",
  probationState(employee(), [], "2026-12-01").overdue === true,
  "فالسكوتُ أضرُّ من تنبيهٍ على تقدير"
);
check(
  "ومن لا دوامَ له يُقال فيه ذلك",
  probationState(employee(), [], "2026-08-01").hasAttendance === false,
  "ولا يُخمَّن عددٌ يُنهى به عقد"
);
check(
  "ومن لا تجربةَ له لا حالَ له",
  probationState(employee({ probation: undefined }), [], "2026-08-01") === null,
  "فلا يُفتح على من هو على رأس العمل منذ سنين"
);

console.log("\nوالقرارُ يُثبت ولا يُستأنف:\n");

const confirmed = probationState(
  employee({
    probation: {
      start: "2026-07-01",
      days: 100,
      outcome: "تثبيت",
      decidedOn: "2026-10-01",
      decidedBy: "ذياب",
      reason: "أهلٌ للعمل",
    },
  }),
  days("2026-07-01", 80),
  "2026-11-01"
);
check("المثبَّتُ حالُه «ثُبّت»", confirmed.status === "ثُبّت");
check("ولا تُعرض عليه أزرارُ القرار", confirmed.open === false);
check("ويُقال من قرّره", confirmed.probation.decidedBy === "ذياب");
check(
  "ولا يصحّ التثبيتُ مرّتين",
  canConfirm(confirmed) !== "",
  canConfirm(confirmed)
);
check("ويصحّ على الجاري", canConfirm(running) === "");
check("ولا يصحّ على معدوم", canConfirm(null) !== "");
check(
  "وعبارتُه تُفهم",
  outcomeLabel(confirmed.probation) === "ثُبّت على رأس العمل",
  outcomeLabel(confirmed.probation)
);

console.log("\nوالتجربةُ من خبرته الفعليّة — وهذا أخطرُ شرطٍ هنا:\n");

const hired = employee({
  probation: {
    start: "2026-07-01",
    days: 100,
    outcome: "تثبيت",
    decidedOn: "2026-10-25",
    decidedBy: "ذياب",
    reason: "أهل",
  },
});
check(
  "بدايةُ الخدمة هي التعيينُ لا يومُ التثبيت",
  serviceStart(hired) === "2026-07-01",
  serviceStart(hired)
);

const settings = emptyState().payrollSettings;
const fromHire = endOfService(hired, settings, "2027-07-01");
const fromConfirm = endOfService(
  { ...hired, hireDate: "2026-10-25" },
  settings,
  "2027-07-01"
);
check(
  "ومكافأةُ نهاية الخدمة تُحسب من التعيين",
  fromHire.amount > fromConfirm.amount,
  `${fromHire.amount} من التعيين · ${fromConfirm.amount} لو حُسبت من التثبيت`
);
check(
  "والفرقُ ليس يسيراً",
  fromHire.totalYears - fromConfirm.totalYears > 0.3,
  `${(fromHire.totalYears - fromConfirm.totalYears).toFixed(2)} سنة`
);

console.log("\nوفي الشاشة:\n");

check("خانةُ «تحت التجربة» في النموذج", /onProbation/.test(page));
check(
  "وتُفتح من تاريخ التعيين",
  /probationFor\(\s*form\.onProbation,\s*form\.hireDate/.test(page),
  "فمن سُجّل متأخّراً حُسبت تجربتُه من مباشرته"
);
check(
  "ومن قُرِّر فيه لا يُستأنف بتعديل ملفّه",
  /const decided = before\?\.probation\?\.outcome \? before\.probation : undefined/.test(
    page
  )
);
check("ولوحُ القرار موجود", /function ProbationPanel\(/.test(page));
check(
  "وفيه الزرّان",
  /ثبِّته على رأس العمل/.test(page) && /أنهِ التوظيف في التجربة/.test(page)
);
check(
  "ولا يُنهى ولا يُثبَّت بلا سبب",
  /reason\.trim\(\)\.length < 4/.test(page)
);
check(
  "والإنهاءُ يُنهي الخدمةَ بيومه",
  /\? \{ endDate: today, active: false \}/.test(page)
);
check(
  "والتثبيتُ لا يمسّ التعيين",
  !/hireDate: today/.test(page),
  "فلا يُكتب التعيينُ يومَ التثبيت في موضعٍ واحد من الشِّفر"
);
check(
  "ويُقال له إنّ التعيين كما هو",
  /فمدّةُ التجربة جزءٌ من/.test(page)
);
check(
  "والقرارُ لمن يملك إدارةَ الموظفين",
  /canDecide/.test(page) && /allow\("employees\.manage"\)/.test(page)
);
check("ويُسجَّل في سجلّ التدقيق", /تثبيتُ \$\{selected\.name\}/.test(page));

console.log("\nوالتنبيهُ يُدرك القرارَ قبل أن يفوت:\n");

const base = {
  movements: [],
  contractors: [],
  projects: [],
  quotations: [],
  workItems: [],
  audit: [],
  messages: [],
  backup: null,
  lastSeenAt: "",
  userName: "ذياب",
  backupEveryDays: 10,
};

const soonNotices = buildNotices({
  ...base,
  employees: [employee()],
  attendance: days("2026-07-01", 95),
  today: "2026-10-10",
});
check(
  "يُنبَّه قبل انتهائها",
  soonNotices.some((n) => n.id === "probation-soon"),
  soonNotices.find((n) => n.id === "probation-soon")?.title ?? "—"
);

const overNotices = buildNotices({
  ...base,
  employees: [employee()],
  attendance: days("2026-07-01", 100),
  today: "2026-10-25",
});
const overNotice = overNotices.find((n) => n.id === "probation-over");
check("ويُنبَّه بعد تجاوزها", overNotice != null);
check(
  "وشدّةُ التنبيه «عمل» لا «خبر»",
  overNotice?.tone === "action",
  overNotice?.tone
);
check(
  "ويُقال إنّ الإنهاءَ بعدها فصل",
  (overNotice?.detail ?? "").includes("فصلٌ لا"),
  "فلا يقع عن غير علم"
);
check(
  "ويُنادى باسمه",
  (overNotice?.detail ?? "").includes("سامي")
);
check(
  "ولا يُعرض لمن لا يُدير الموظفين",
  overNotice?.needs === "employees.manage"
);
check(
  "ولا يُنبَّه على من ثُبّت",
  buildNotices({
    ...base,
    employees: [hired],
    attendance: days("2026-07-01", 100),
    today: "2026-10-25",
  }).every((n) => !n.id.startsWith("probation")),
  "فقرارُه مضى"
);
check(
  "ولا على من انتهت خدمتُه",
  underProbation(
    [employee({ endDate: "2026-09-01", active: false })],
    days("2026-07-01", 100),
    "2026-10-25"
  ).length === 0
);
check(
  "والأقربُ انتهاءً أوّلاً",
  (() => {
    const rows = underProbation(
      [
        employee({ id: "a", name: "أ" }),
        employee({ id: "b", name: "ب", probation: { start: "2026-09-01", days: 100 } }),
      ],
      [...days("2026-07-01", 90, "حاضر", "a"), ...days("2026-09-01", 10, "حاضر", "b")],
      "2026-10-10"
    );
    return rows[0]?.name === "أ";
  })()
);
check(
  "والتحذيرُ عند التجاوز يُقال",
  endWarning(over).includes("فصلٌ لا"),
  endWarning(over)
);
check("ولا يُقال على الجاري", endWarning(running) === "");

console.log("\nودورةُ التخزين:\n");

const back = normalizeState({ employees: [hired] }).employees[0];
check(
  "وما كُتب يعود كما كُتب",
  back.probation?.outcome === "تثبيت" &&
    back.probation?.start === "2026-07-01" &&
    back.probation?.decidedBy === "ذياب",
  "فحقلٌ يُحفظ ولا يُحمَّل يسقط صامتاً"
);
check(
  "والتعيينُ يعود كما هو",
  back.hireDate === "2026-07-01"
);
check(
  "وتجربةٌ بلا بدايةٍ تُسقَط",
  normalizeState({ employees: [employee({ probation: { days: 100 } })] })
    .employees[0].probation === undefined,
  "فلا تُفتح تجربةٌ لمن هو على رأس العمل"
);
check(
  "وحدٌّ غيرُ صحيحٍ يعود مئةً",
  normalizeState({
    employees: [employee({ probation: { start: "2026-07-01", days: 0 } })],
  }).employees[0].probation.days === PROBATION_DAYS
);
check(
  "ونتيجةٌ لا تُفهم تُسقَط فتعود جاريةً",
  normalizeState({
    employees: [
      employee({ probation: { start: "2026-07-01", days: 100, outcome: "ربما" } }),
    ],
  }).employees[0].probation.outcome === undefined,
  "ولا يُطوى قرارٌ خلفَ كلمةٍ لا تُفهم"
);

console.log(
  bad === 0
    ? "\n✓ التجربة: مئةُ يومِ عملٍ، والقرارُ بسببه، والتثبيتُ لا يُسقط خبرةً"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
