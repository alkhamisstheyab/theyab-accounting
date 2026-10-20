/**
 * فترةُ التجربة — مئةُ يومِ عملٍ، ثمّ تثبيتٌ أو إنهاء.
 *
 * طلبها صاحب الشركة: «الموظفُ الجديد يكون تحت التجربة مئةَ يومٍ حسب
 * قانون العمل، ويمكن إنهاؤها في أي وقت: إمّا بتوظيفه فتُحتسب مدّةُ
 * التجربة من خبرته الفعلية، وإمّا بإنهاء التوظيف».
 *
 * وحدُّ المئة من قانون العمل الكويتي (٦/٢٠١٠ — المادة ٣٠)، وهو
 * **مئةُ يومِ عمل** لا مئةُ يومٍ من التقويم. والفرقُ ليس تدقيقاً
 * لفظيّاً: من حسبها تقويماً أنهى التجربةَ قبل حقِّها بنحو سبعةَ عشرَ
 * يوماً — فعاملٌ يعمل ستّةَ أيّامٍ في الأسبوع يبلغ مئةَ يوم عملٍ بعد
 * مئةٍ وسبعةَ عشرَ يوماً تقويميّاً.
 *
 * وأخطرُ ما في البابِ التثبيت: فمن ثبّت عاملاً وكتب تعيينَه يومَ
 * التثبيت أسقط عنه مئةَ يومٍ من خبرته — تظهر نقصاً في مكافأة نهاية
 * الخدمة وفي استحقاق الإجازة بعد سنين، ولا يُدرى سببُها. فالتعيينُ
 * **لا يُمسّ** بالتثبيت: مدّةُ التجربة جزءٌ من الخدمة، ومكافأةُ نهاية
 * الخدمة تُحسب من `hireDate` كما كانت.
 *
 * ومن تجاوز المئةَ ولم يُقرِّر فقد ثُبّت بحكم الواقع: فإنهاؤه بعدها
 * فصلٌ لا إنهاءُ تجربة. فيُنبَّه قبل الحدِّ وبعده.
 */

import type { AttendanceDay, Employee } from "./payroll";

/** حدُّ القانون — مئةُ يومِ عمل (٦/٢٠١٠ م٣٠) */
export const PROBATION_DAYS = 100;

/** يُنبَّه قبل انتهائها بهذه الأيّام، فالقرارُ يحتاج مهلةً */
export const PROBATION_SOON = 10;

/**
 * أيّامُ الأسبوع المحتسبة عملاً عند التقدير.
 *
 * وستّةٌ لا سبعة: فيومُ الراحة الأسبوعيّة ليس يومَ عمل. وهذا للتقدير
 * وحدَه — والعدَدُ المعتبرُ ما سُجّل في الدوام.
 */
const WORK_DAYS_PER_WEEK = 6;

export const PROBATION_OUTCOMES = ["تثبيت", "إنهاء"] as const;

export type ProbationOutcome = (typeof PROBATION_OUTCOMES)[number];

export type Probation = {
  /** أوّلُ يومٍ في التجربة — وهو يومُ التعيين في الغالب */
  start: string;
  /** حدُّها بأيّام العمل — مئةٌ إلا أن يُتّفق على أقلّ */
  days: number;
  /** ما وقع: تثبيتٌ أو إنهاء — وفارغٌ يعني أنّها جارية */
  outcome?: ProbationOutcome;
  /** يومُ القرار */
  decidedOn?: string;
  /** من قرّره — فالقرارُ يُنسب */
  decidedBy?: string;
  /** وقتُ إثباته في النظام */
  decidedAt?: string;
  /** سببُه مكتوباً — ولا قرارَ بلا سبب */
  reason?: string;
};

export type ProbationStatus =
  | "جارية"
  | "يقرب انتهاؤها"
  | "تجاوزت الحدّ"
  | "ثُبّت"
  | "أُنهي في التجربة";

export type ProbationState = {
  probation: Probation;
  status: ProbationStatus;
  /** أيّامُ العملِ المسجَّلةُ في الدوام — وهي المعتبرة */
  worked: number;
  /** ما بقي من الحدّ — صفرٌ إن بلغه */
  remaining: number;
  /** أسُجّل له دوامٌ أصلاً؟ فمن لا دوامَ له لا يُعرف عددُه */
  hasAttendance: boolean;
  /** يومٌ تقويميٌّ تُتمّ فيه المدّةُ لو عمل ستّةَ أيّامٍ في الأسبوع */
  expectedEnd: string;
  /** أمضى الموعدُ المتوقَّع والقرارُ لم يُتّخذ؟ */
  overdue: boolean;
  /** أهي مفتوحةٌ تنتظر قراراً؟ */
  open: boolean;
};

/* ------------------------------------------------------------------ */

const isWorkDay = (status: string): boolean =>
  status === "حاضر" || status === "عطلة رسمية";

/**
 * عددُ أيّام العمل المسجَّلة في مدّة التجربة.
 *
 * والعطلةُ الرسميّةُ تُحتسب: هي يومٌ من أيّام الخدمة يُدفع أجرُه، ولا
 * يُعاقب العاملُ بأن تُمدَّ تجربتُه لأنّ الدولة عطّلت. والغيابُ
 * والإجازاتُ لا تُحتسب — فليست أيّامَ عمل.
 */
export function workedDays(
  attendance: readonly AttendanceDay[],
  employeeId: string,
  from: string,
  to: string
): number {
  let count = 0;
  for (const day of attendance) {
    if (day.employeeId !== employeeId) continue;
    if (!day.date || day.date < from || day.date > to) continue;
    if (isWorkDay(day.status)) count++;
  }
  return count;
}

/** اليومُ التقويميُّ الذي تُتمّ فيه المدّةُ تقديراً */
export function expectedEnd(start: string, days: number): string {
  if (!start) return "";
  const at = new Date(start);
  if (Number.isNaN(at.getTime())) return "";
  const weeks = Math.floor(days / WORK_DAYS_PER_WEEK);
  const rest = days % WORK_DAYS_PER_WEEK;
  /* ناقصُ واحدٍ لأنّ يومَ البداية نفسَه محسوبٌ من المدّة */
  at.setDate(at.getDate() + weeks * 7 + rest - 1);
  return at.toISOString().slice(0, 10);
}

/**
 * حالُ التجربة لموظّف.
 *
 * ويُرجَّح المسجَّلُ على المقدَّر: فإن كان له دوامٌ حُسب منه، وإلا
 * قيل «لا دوامَ مسجَّل» ولم يُخمَّن عددٌ — فعددٌ مخمَّنٌ يُنهى به
 * عقدٌ أسوأُ من لا عدد.
 */
export function probationState(
  employee: Employee,
  attendance: readonly AttendanceDay[],
  today: string
): ProbationState | null {
  const probation = employee.probation;
  if (!probation || !probation.start) return null;

  const days = probation.days > 0 ? probation.days : PROBATION_DAYS;
  const end = expectedEnd(probation.start, days);
  const worked = workedDays(attendance, employee.id, probation.start, today);
  const hasAttendance = attendance.some(
    (d) =>
      d.employeeId === employee.id &&
      d.date >= probation.start &&
      d.date <= today
  );
  const remaining = Math.max(0, days - worked);

  if (probation.outcome === "تثبيت") {
    return {
      probation,
      status: "ثُبّت",
      worked,
      remaining,
      hasAttendance,
      expectedEnd: end,
      overdue: false,
      open: false,
    };
  }
  if (probation.outcome === "إنهاء") {
    return {
      probation,
      status: "أُنهي في التجربة",
      worked,
      remaining,
      hasAttendance,
      expectedEnd: end,
      overdue: false,
      open: false,
    };
  }

  /*
    والتجاوزُ يُحكم به من المسجَّل أوّلاً، ومن التقويم إن لم يُسجَّل
    دوام: فمن مضى على تعيينه أربعةُ أشهرٍ ولا دوامَ له تجاوز الحدَّ
    يقيناً، والسكوتُ عنه أضرُّ من تنبيهٍ على تقدير.
  */
  const passedByWork = worked >= days;
  const passedByCalendar = end !== "" && today > end;
  const status: ProbationStatus =
    passedByWork || passedByCalendar
      ? "تجاوزت الحدّ"
      : remaining <= PROBATION_SOON || (end !== "" && end <= today)
        ? "يقرب انتهاؤها"
        : "جارية";

  return {
    probation,
    status,
    worked,
    remaining,
    hasAttendance,
    expectedEnd: end,
    overdue: passedByWork || passedByCalendar,
    open: true,
  };
}

/* ------------------------------------------------------------------ */

/**
 * بدايةُ الخدمة المعتبرة.
 *
 * وهي التعيينُ دائماً: مدّةُ التجربة جزءٌ من الخدمة فلا تُقتطع، وهذا
 * نصُّ ما طلبه صاحب الشركة — «تُحتسب مدّةُ التجربة من خبرته الفعلية».
 * والدالّةُ موجودةٌ ليُقال هذا صريحاً في موضعٍ واحد، فلا يأتي من يحسب
 * الخدمةَ من يوم التثبيت.
 */
export const serviceStart = (employee: Employee): string => employee.hireDate;

/** حالُ التجربة ومعه صاحبُها — فالتنبيهُ يُنادي باسمٍ لا بمعرّف */
export type OpenProbation = ProbationState & {
  employeeId: string;
  name: string;
};

/** أيُّ موظّفٍ تحت التجربة الآن — وتُرتَّب الأقربُ انتهاءً أوّلاً */
export function underProbation(
  employees: readonly Employee[],
  attendance: readonly AttendanceDay[],
  today: string
): OpenProbation[] {
  const open: OpenProbation[] = [];
  for (const employee of employees) {
    if (!employee.active || employee.endDate) continue;
    const state = probationState(employee, attendance, today);
    if (state && state.open) {
      open.push({ ...state, employeeId: employee.id, name: employee.name });
    }
  }
  return open.sort((a, b) => a.remaining - b.remaining);
}

/**
 * أيصحّ التثبيت؟
 *
 * ويصحّ في أيِّ وقت — ولو في أوّل يوم: فصاحبُ العمل قد يرى الرجلَ
 * أهلاً فلا يُلزمه القانون بإتمام المدّة. ولا يصحّ على مُقرَّرٍ فيه.
 */
export function canConfirm(state: ProbationState | null): string {
  if (!state) return "لا فترةَ تجربةٍ مفتوحة";
  if (!state.open) return `قُرِّر فيها: ${state.status}`;
  return "";
}

/**
 * أيصحّ إنهاءُ التوظيف في التجربة؟
 *
 * ويصحّ في مدّتها. وبعد تجاوزها يُنبَّه ولا يُمنع: فالقرارُ لصاحبه،
 * لكن ألّا يقع عن غير علم — فمن تجاوزت تجربتُه ثُبّت بحكم الواقع،
 * وإنهاؤه بعدها فصلٌ لا إنهاءُ تجربة، ويختلف ما يستحقّه.
 */
export function endWarning(state: ProbationState | null): string {
  if (!state || !state.open) return "";
  if (!state.overdue) return "";
  return (
    "مضت مدّةُ التجربة — فهذا فصلٌ لا إنهاءُ تجربة، " +
    "فراجع ما يستحقّه قبل الصرف"
  );
}

export const outcomeLabel = (probation: Probation): string =>
  probation.outcome === "تثبيت"
    ? "ثُبّت على رأس العمل"
    : probation.outcome === "إنهاء"
      ? "أُنهي توظيفُه في التجربة"
      : "تجربةٌ جارية";
