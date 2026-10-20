/**
 * تقييمُ عمل العمالة: من أحسن فيُكافأ، ومن تقاعس فيُجازى.
 *
 * ومعاييرُه خمسةٌ، نصَّ عليها صاحبُ الشركة: الحضورُ والغياب، والعملُ
 * المنجَز، والنشاطُ في الموقع، وطاعةُ المهندس، والأوامرُ التي تُسند
 * إليه.
 *
 * **ولا تتحوّل إلى مكافأةٍ إلا بأمره** — وهذا نصُّ قراره، وهو مثبَّتٌ
 * في الشِّفْر لا في الكلام: التقييمُ يقترح، والأمرُ وحدَه يُحوّل
 * الاقتراحَ مالاً. فمن قيَّم لم يَصرِف، ومن صرف لم يُقيّم.
 *
 * وموضعُ السجلّ الموظَّفُ نفسُه: فالتقييمُ له لا لشهرٍ، وتاريخُه
 * يُقرأ من أوّله إلى آخره في ملفٍّ واحد. ولو كان في مجموعةٍ مستقلّةٍ
 * لاحتاج جدولاً ثالثاً بلا حاجة.
 */

import { round3 } from "./accounting";

/** المدّةُ المقيَّمة */
export const REVIEW_PERIODS = ["يوميّ", "أسبوعيّ", "شهريّ"] as const;

export type ReviewPeriod = (typeof REVIEW_PERIODS)[number];

/**
 * المعاييرُ الخمسة ووزنُها.
 *
 * وأوزانُها متساوية: فمن رفع وزنَ «طاعة المهندس» على «العمل المنجَز»
 * قيَّم الطاعةَ لا العمل. ومن أراد غيرَ ذلك غيَّره هنا بعلمه، لا
 * بحسابٍ خفيٍّ في الشاشة.
 */
export const REVIEW_CRITERIA = [
  { key: "attendance", label: "الحضور والغياب" },
  { key: "output", label: "العمل المنجَز" },
  { key: "activity", label: "النشاط في الموقع" },
  { key: "obedience", label: "طاعة المهندس" },
  { key: "tasks", label: "الأوامر المسندة إليه" },
] as const;

export type CriterionKey = (typeof REVIEW_CRITERIA)[number]["key"];

/** أعلى درجةٍ لكلِّ معيار — خمسٌ، فالعشرةُ تُغري بالتوسّط الكاذب */
export const REVIEW_MAX = 5;

export type WorkReview = {
  id: string;
  period: ReviewPeriod;
  /** مدّةُ التقييم — yyyy-mm-dd */
  from: string;
  to: string;
  attendance: number;
  output: number;
  activity: number;
  obedience: number;
  tasks: number;
  note: string;
  /** من قيَّم — المهندسُ المشرفُ غالباً */
  by: string;
  at: string;

  /**
   * مكافأةٌ مقترحة — بالدينار.
   *
   * تُكتب ولا تُصرف. وهي رأيُ من رأى العمل، لا قرارُ من يملك المال.
   */
  proposedBonus?: number;

  /**
   * أمرُ الصرف — وبه وحده يصير الاقتراحُ مالاً.
   *
   * «ولا تحوَّل إلى مكافأةٍ إلا بأمرٍ منّي». فما لم يُؤمَر به يبقى
   * مكتوباً معروضاً ولا يمسّ أجراً.
   */
  orderedBy?: string;
  orderedAt?: string;
  /** المبلغُ المأمورُ به — وقد يخالف المقترَح، فالأمرُ لصاحبه */
  orderedAmount?: number;
  /** يومُ المكافأة في الحضور — بها تدخل المسيَّر */
  bonusDate?: string;
};

/* ------------------------------------------------------------------ */

export const criterionValue = (review: WorkReview, key: CriterionKey): number =>
  Number((review as unknown as Record<string, unknown>)[key]) || 0;

/** مجموعُ الدرجات — من خمسةٍ وعشرين */
export const reviewScore = (review: WorkReview): number =>
  REVIEW_CRITERIA.reduce((sum, c) => sum + criterionValue(review, c.key), 0);

export const REVIEW_TOTAL = REVIEW_CRITERIA.length * REVIEW_MAX;

/** النسبةُ المئويّة — وبها يُقارَن من قُيّم بمعاييرَ ناقصة */
export const reviewPercent = (review: WorkReview): number =>
  round3((reviewScore(review) / REVIEW_TOTAL) * 100);

/**
 * حُكمٌ بالكلام لا بالرقم وحده.
 *
 * فالرقمُ لا يُقرأ وحده: من رأى «١٨ من ٢٥» لم يعرف أمُحسنٌ هو أم
 * مقصّر. والحدودُ مكتوبةٌ هنا ظاهرةً، فمن أراد تغييرَها رآها.
 */
export function reviewVerdict(review: WorkReview): string {
  const percent = reviewPercent(review);
  if (percent >= 90) return "ممتاز";
  if (percent >= 75) return "جيّد جدّاً";
  if (percent >= 60) return "جيّد";
  if (percent >= 45) return "مقبول";
  return "متقاعس";
}

/** أمُقصّرٌ يُجازى؟ — ومن تكرّر تقصيرُه يُنظر في أمره */
export const isSlacking = (review: WorkReview): boolean =>
  reviewPercent(review) < 45;

/* ------------------------------------------------------------------ */

export type ReviewState = {
  review: WorkReview;
  score: number;
  percent: number;
  verdict: string;
  /** اقتُرحت مكافأةٌ ولم يُؤمر بها بعد */
  awaitingOrder: boolean;
  /** أُمر بها */
  ordered: boolean;
};

export function reviewState(review: WorkReview): ReviewState {
  const proposed = round3(review.proposedBonus ?? 0);
  const ordered = Boolean(review.orderedBy && review.orderedAt);
  return {
    review,
    score: reviewScore(review),
    percent: reviewPercent(review),
    verdict: reviewVerdict(review),
    awaitingOrder: proposed > 0 && !ordered,
    ordered,
  };
}

export type EmployeeReviews = {
  employeeId: string;
  name: string;
  reviews: ReviewState[];
  /** متوسّطُ النسب — وبه يُرتَّب الناس */
  average: number;
  /** ما اقتُرح ولم يُؤمر به */
  awaiting: number;
  awaitingAmount: number;
  /** ما أُمر به */
  orderedAmount: number;
};

/**
 * تقييماتُ موظّفٍ مرتَّبةً بالأحدث.
 *
 * والمتوسّطُ على ما قُيّم لا على الزمن: من قُيّم مرّةً واحدةً متوسّطُه
 * تلك المرّة، ولا يُحسب له صفرٌ عن أسابيعَ لم يُقيَّم فيها — فذاك
 * تقصيرُ المقيِّم لا تقصيرُ العامل.
 */
export function employeeReviews(
  employeeId: string,
  name: string,
  reviews: readonly WorkReview[]
): EmployeeReviews {
  const states = [...reviews]
    .sort((a, b) => (b.to || b.from).localeCompare(a.to || a.from))
    .map(reviewState);

  const awaiting = states.filter((s) => s.awaitingOrder);

  return {
    employeeId,
    name,
    reviews: states,
    average:
      states.length === 0
        ? 0
        : round3(states.reduce((sum, s) => sum + s.percent, 0) / states.length),
    awaiting: awaiting.length,
    awaitingAmount: round3(
      awaiting.reduce((sum, s) => sum + (s.review.proposedBonus ?? 0), 0)
    ),
    orderedAmount: round3(
      states
        .filter((s) => s.ordered)
        .reduce(
          (sum, s) =>
            sum + (s.review.orderedAmount ?? s.review.proposedBonus ?? 0),
          0
        )
    ),
  };
}

/** مدّةٌ مقترحةٌ للتقييم بحسب نوعه، من يومٍ مرجعيّ */
export function reviewWindowFor(
  period: ReviewPeriod,
  today: string
): { from: string; to: string } {
  const at = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(at.getTime())) return { from: today, to: today };
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const DAY = 86400000;

  if (period === "يوميّ") return { from: today, to: today };
  if (period === "أسبوعيّ") {
    /* والأسبوعُ يبدأ من الأحد، كما في جدول الحضور */
    const start = new Date(at.getTime() - at.getUTCDay() * DAY);
    return { from: iso(start), to: iso(new Date(start.getTime() + 6 * DAY)) };
  }
  const first = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const last = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 0));
  return { from: iso(first), to: iso(last) };
}
