/**
 * سجلّ المطابقة اليومية.
 *
 * قرار النقل إلى الخادم مبنيّ على جملةٍ واحدة: «لا يُنتقل إلا بعد أن
 * تتطابق النسختان أياماً متتالية». وتلك الجملة لا معنى لها بلا سجلّ —
 * زرٌّ يُضغط فيُظهر نتيجةً ثم تُنسى لا يُثبت شيئاً، ولا يُميَّز بعد
 * أسبوعين بين سبعة أيام متطابقة وسبع ضغطاتٍ في يومٍ واحد.
 *
 * فتُحفظ نتيجة كل مقارنة: يومها، وأتطابقتا، وإن لم تتطابقا ففي أي
 * الحقول. ويُحسب منها ما يُسأل عنه حقاً: كم يوماً متتالياً مضى بلا فرق.
 *
 * وهو في تخزين المتصفّح وحده، لا في حالة النظام: سجلُّ تجربةٍ ينتهي
 * بانتهائها، لا بياناتٌ للشركة تُحفظ وتُنقل.
 */

import { dayOf } from "./today";

const KEY = "theyab:match-log";
/** يكفي لعدّة أشهر من مقارنةٍ يومية، ولا يُثقل التخزين */
const MAX_ENTRIES = 200;

export type MatchRun = {
  /** يوم المقارنة — YYYY-MM-DD */
  day: string;
  at: string;
  agree: boolean;
  /** أسماء الحقول المختلفة، فارغة عند التطابق */
  off: string[];
  /** عدد الصفوف المختلفة جملةً */
  rows: number;
};

function read(): MatchRun[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MatchRun[]) : [];
  } catch {
    return [];
  }
}

function write(runs: MatchRun[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(runs.slice(-MAX_ENTRIES)));
  } catch {
    /* التخزين ممتلئ أو ممنوع — والسجلّ ليس ممّا يُوقف العمل لفقده */
  }
}

export const matchRuns = (): MatchRun[] => read();

/**
 * يسجّل نتيجة مقارنة.
 *
 * واليوم الواحد يُسجَّل مرةً: آخر مقارنةٍ فيه هي حكمُه. فمن قارن صباحاً
 * فاختلفتا ثم أصلح وقارن مساءً فتطابقتا، فيومُه يومُ تطابق.
 */
export function recordMatch(run: Omit<MatchRun, "day">): MatchRun[] {
  /* اليوم بتوقيت الكويت لا غرينتش: مقارنةُ الواحدة ليلاً يومُها يومها */
  const day = dayOf(run.at);
  const runs = read().filter((r) => r.day !== day);
  runs.push({ ...run, day });
  runs.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
  write(runs);
  return runs;
}

/**
 * كم يوماً متتالياً تطابقت النسختان، عدّاً من آخر يوم إلى الوراء.
 *
 * وينقطع العدّ بيومٍ مختلف، لا بيومٍ لم يُقارَن فيه: من سافر أسبوعاً
 * لم يُفسد تجربته، وإنما أبطأها.
 */
export function agreeingStreak(runs: MatchRun[] = read()): number {
  let streak = 0;
  for (let i = runs.length - 1; i >= 0; i--) {
    if (!runs[i].agree) break;
    streak++;
  }
  return streak;
}

/** عدد الأيام المسجَّلة — والمقارنة مرةً في اليوم */
export const matchedDays = (runs: MatchRun[] = read()): number => runs.length;

/** أقرب يومٍ اختلفت فيه النسختان، أو فارغ */
export function lastDisagreement(runs: MatchRun[] = read()): MatchRun | null {
  for (let i = runs.length - 1; i >= 0; i--) {
    if (!runs[i].agree) return runs[i];
  }
  return null;
}

/** أُقورن اليوم؟ فلا يُطلب من أحدٍ ما فعله */
export const comparedToday = (today: string, runs: MatchRun[] = read()): boolean =>
  runs.some((r) => r.day === today);

/**
 * الحكم: أبلغت التجربة مبلغها؟
 *
 * والعدد المطلوب ليس رأياً: أسبوعُ عملٍ كامل بأيامه المزدحمة وهادئها،
 * فيمرّ على النظام ما يمرّ عليه في أسبوع — رواتب ودفعات واعتمادات.
 */
export const REQUIRED_STREAK = 7;

export function verdict(runs: MatchRun[] = read()): {
  ready: boolean;
  streak: number;
  text: string;
} {
  const streak = agreeingStreak(runs);
  if (runs.length === 0) {
    return { ready: false, streak: 0, text: "لم تبدأ المقارنة بعد" };
  }
  if (streak >= REQUIRED_STREAK) {
    return {
      ready: true,
      streak,
      text: `تطابقت النسختان ${streak} يوماً متتالياً — التجربة بلغت مبلغها`,
    };
  }
  const last = runs[runs.length - 1];
  if (!last.agree) {
    return {
      ready: false,
      streak: 0,
      text: `آخر مقارنة اختلفت في ${last.off.join("، ")} — العدّ يبدأ من جديد`,
    };
  }
  return {
    ready: false,
    streak,
    text: `تطابقت ${streak} من ${REQUIRED_STREAK} أيام — بقي ${
      REQUIRED_STREAK - streak
    }`,
  };
}
