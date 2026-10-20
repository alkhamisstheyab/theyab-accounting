/**
 * تقاريرُ الاجتماعات: ما قيل بين الشركة وعميلها، موثَّقاً.
 *
 * وكان ما يُتَّفق عليه في اجتماعٍ أو مكالمةٍ يبقى في الذاكرة: فيُنسى،
 * أو يُختلف فيه بعد شهرين — «قلتَ كذا» و«لم أقل». ولم يكن في النظام
 * موضعٌ يُكتب فيه: من حضر، وما قيل، وما التُزم به.
 *
 * والقرارُ غيرُ الكلام: فما قيل يُكتب نصّاً، وما التُزم به يُكتب
 * سطراً له صاحبٌ وموعد — فيُتابَع ويُقال أأُنجز أم لا. ولولا ذلك
 * صار التقريرُ ورقةً تُكتب وتُنسى.
 */

import type { Message } from "./storage";

export const MINUTE_PERIODS = ["أسبوعيّ", "شهريّ", "طارئ"] as const;

export type MinutePeriod = (typeof MINUTE_PERIODS)[number];

export const MINUTE_KINDS = [
  "اجتماع",
  "مكالمة",
  "زيارة موقع",
  "مراسلة",
] as const;

export type MinuteKind = (typeof MINUTE_KINDS)[number];

/**
 * التزامٌ خرج من الاجتماع.
 *
 * وله صاحبٌ وموعد: فقرارٌ بلا صاحبٍ لا يُنفَّذه أحد، وبلا موعدٍ
 * يُنفَّذ متى اتُّفق — أي لا يُنفَّذ.
 */
export type MinuteDecision = {
  id: string;
  text: string;
  /** على من — اسمُ موظّفٍ أو «العميل» */
  owner: string;
  /** yyyy-mm-dd */
  due: string;
  done: boolean;
  doneAt: string;
};

/**
 * صورةٌ مرفقة.
 *
 * ولا تُحفظ الصورةُ في الصفّ: يُحفظ مسارُها في المخزن وحدَه. ولو
 * حُفظت في القاعدة لتضخّمت النسخةُ الاحتياطية — وهي اليومَ ٣٫٨٥ ميغا
 * وحدُّ الردّ عند الناشر ٤٫٥ — فتُخفق النسخةُ صامتةً يومَ تُحتاج،
 * وتلك خسارةُ الدفاتر كلِّها لأجل صورة.
 */
export type MinutePhoto = {
  id: string;
  /** مسارُه في مخزن Blob */
  path: string;
  caption: string;
  /** حجمُه بالبايت — يُقرأ ولا يُحسب منه شيء */
  size: number;
};

export type Minute = {
  id: string;
  date: string;
  period: MinutePeriod;
  project: string;
  kind: MinuteKind;
  title: string;
  attendees: string;
  body: string;
  decisions: MinuteDecision[];
  photos: MinutePhoto[];
  createdBy: string;
  createdAt: string;
};

/* ------------------------------------------------------------------ */

export type MinuteState = {
  minute: Minute;
  /** التزاماتٌ لم تُنجَز */
  open: MinuteDecision[];
  /** منها ما مضى موعدُه */
  overdue: MinuteDecision[];
};

export function minuteState(minute: Minute, today: string): MinuteState {
  const open = minute.decisions.filter((d) => !d.done);
  return {
    minute,
    open,
    /*
      والمتأخّرُ ما له موعدٌ مضى: وما لا موعدَ له لا يُعدّ متأخّراً —
      فالصفرُ دعوى، ومن لم يُحدَّد له موعدٌ لم يُخلّ بموعد.
    */
    overdue: open.filter((d) => d.due && d.due < today),
  };
}

/** تقاريرُ مشروعٍ بالأحدث — وبلا مشروعٍ تُقرأ كلُّها */
export function minutesOf(
  minutes: readonly Minute[],
  project: string
): Minute[] {
  const mine = project
    ? minutes.filter((m) => m.project === project)
    : [...minutes];
  return mine.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export type MinutesSummary = {
  total: number;
  /** التزاماتٌ لم تُنجَز في التقارير كلِّها */
  open: number;
  overdue: number;
  /** مشاريعُ لها تقارير */
  projects: string[];
  /** آخرُ تقريرٍ لكلِّ مشروع */
  latest: Record<string, string>;
};

export function minutesSummary(
  minutes: readonly Minute[],
  today: string
): MinutesSummary {
  let open = 0;
  let overdue = 0;
  const latest: Record<string, string> = {};

  for (const minute of minutes) {
    const state = minuteState(minute, today);
    open += state.open.length;
    overdue += state.overdue.length;
    const was = latest[minute.project] ?? "";
    if ((minute.date || "") > was) latest[minute.project] = minute.date;
  }

  return {
    total: minutes.length,
    open,
    overdue,
    projects: [...new Set(minutes.map((m) => m.project).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, "ar")
    ),
    latest,
  };
}

/**
 * التزامٌ يُحوَّل طلبَ عمل.
 *
 * فالقرارُ على موظّفٍ لا يُنفَّذ بكتابته في تقرير: يُنفَّذ إذا بلغه.
 * فيُحوَّل إلى بريده، ويبقى في التقرير سنداً له — فيُعرف أصلُه ويوم
 * الاتفاق عليه ومن حضره.
 */
export function decisionToMessage(
  minute: Minute,
  decision: MinuteDecision,
  to: { id: string; name: string },
  from: string
): Message {
  return {
    id: decision.id + "-msg",
    fromName: from,
    toUser: to.id,
    toName: to.name,
    body:
      decision.text +
      (decision.due ? `\nالموعد: ${decision.due}` : "") +
      `\n(من تقرير ${minute.kind} ${minute.date}${
        minute.project ? ` — ${minute.project}` : ""
      })`,
    page: "الأعمال",
    about: `تقرير ${minute.date}`,
    state: "جديدة",
    createdAt: new Date().toISOString(),
    readAt: "",
    doneAt: "",
    doneNote: "",
  };
}
