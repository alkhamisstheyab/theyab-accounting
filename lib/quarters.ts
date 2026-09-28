/**
 * التقرير الربعي — أين يذهب المال، وما الذي يستحقّ قراراً.
 *
 * طلبه صاحب الشركة في ٢٧ سبتمبر ٢٠٢٦: لا كشفَ أرقامٍ يُقرأ ويُنسى، بل
 * بيانُ أثرٍ يُبنى عليه قرار — أنستأجر المعدة أم نشتريها؟ أنعمل باليومية
 * أم بعقد؟
 *
 * والربع أصدق من الشهر في هذا: الشهر يتقلّب بمصروفٍ واحدٍ كبير، والسنة
 * تُخفي التحوّل داخلها. والربع يُظهر الاتجاه قبل أن يصير عادةً.
 */

import { Movement, isApproved, round3, validate } from "./accounting";

/** ربعٌ من سنة: «2026-ر3» */
export const quarterOf = (date: string): string => {
  const year = date.slice(0, 4);
  const month = Number(date.slice(5, 7)) || 1;
  return `${year}-ر${Math.min(4, Math.ceil(month / 3))}`;
};

/** أرباعٌ مرتّبة بين أقدم حركةٍ وأحدثها — بلا فجوات */
export function quarterRange(movements: Movement[]): string[] {
  const dates = movements.map((m) => m.date).filter(Boolean).sort();
  if (dates.length === 0) return [];
  const [fromYear, fromQ] = quarterOf(dates[0]).split("-ر").map(Number);
  const [toYear, toQ] = quarterOf(dates[dates.length - 1]).split("-ر").map(Number);

  const out: string[] = [];
  for (let y = fromYear, q = fromQ; y < toYear || (y === toYear && q <= toQ); ) {
    out.push(`${y}-ر${q}`);
    q += 1;
    if (q > 4) {
      q = 1;
      y += 1;
    }
    if (out.length > 60) break;
  }
  return out;
}

export type SpendRow = {
  account: string;
  name: string;
  /** الربع ← المبلغ */
  byQuarter: Record<string, number>;
  total: number;
  /** معدّل الربع الواحد على المدى المعروض */
  average: number;
  /** ارتفع ثلاثة أرباعٍ متتالية — بندٌ يستحقّ النظر */
  rising: boolean;
  /** نسبته من الإنفاق كلّه */
  share: number;
};

const accountName = (chart: { code: string; name: string }[], code: string) =>
  chart.find((a) => a.code === code)?.name ?? code;

/**
 * يجمع الإنفاق بالحساب وبالربع.
 *
 * ويُحسب من المعتمد وحده — كسائر الأرقام — ومن حسابات المصروفات (5 و6)
 * لا من الأصول والالتزامات: السؤال «أين يذهب المال» لا «أين استقرّ».
 */
export function spendByQuarter(
  movements: Movement[],
  chart: { code: string; name: string }[]
): { quarters: string[]; rows: SpendRow[]; totals: Record<string, number>; grand: number } {
  const spend = movements.filter(
    (m) => isApproved(m) && validate(m).valid && /^[56]/.test(m.debitCode)
  );
  const quarters = quarterRange(spend);

  const byAccount = new Map<string, Record<string, number>>();
  for (const m of spend) {
    const row = byAccount.get(m.debitCode) ?? {};
    const q = quarterOf(m.date);
    row[q] = round3((row[q] ?? 0) + m.amount);
    byAccount.set(m.debitCode, row);
  }

  const totals: Record<string, number> = {};
  let grand = 0;
  for (const row of byAccount.values()) {
    for (const [q, v] of Object.entries(row)) {
      totals[q] = round3((totals[q] ?? 0) + v);
      grand = round3(grand + v);
    }
  }

  const rows: SpendRow[] = [...byAccount.entries()].map(([account, byQuarter]) => {
    const total = round3(
      Object.values(byQuarter).reduce((s, v) => s + v, 0)
    );
    /*
      الصعود يُقاس على آخر أربعة أرباع: ثلاث زياداتٍ متتالية اتجاهٌ لا
      صدفة. وما لم يُنفق فيه شيءٌ في ربعٍ يُعدّ صفراً لا يُتخطّى، وإلا
      ظهر بندٌ أُنفق فيه مرتين متباعدتين صاعداً.
    */
    const tail = quarters.slice(-4).map((q) => byQuarter[q] ?? 0);
    const rising =
      tail.length === 4 &&
      tail[1] > tail[0] &&
      tail[2] > tail[1] &&
      tail[3] > tail[2];

    return {
      account,
      name: accountName(chart, account),
      byQuarter,
      total,
      average: quarters.length ? round3(total / quarters.length) : 0,
      rising,
      share: grand ? round3((total / grand) * 100) : 0,
    };
  });

  rows.sort((a, b) => b.total - a.total);
  return { quarters, rows, totals, grand };
}

export type WorkSplitRow = {
  key: string;
  /** ما دُفع بموجب عقدٍ مبرم */
  contracted: number;
  /** ما دُفع باليومية أو بلا عقد */
  loose: number;
  total: number;
  /** نسبة المتعاقَد عليه من الجملة */
  share: number;
};

/**
 * اليوميات مقابل العقود.
 *
 * وأجور المقاولين وحدها هي موضع السؤال: المواد تُشترى ولا تُتعاقَد
 * عليها بهذا المعنى، والإيجار إيجار. فما دُفع من 5120 بعقدٍ مبرم يُقاس
 * بما دُفع منه بلا عقد.
 *
 * وليس الأقلّ خيراً بإطلاق: اليومية تُناسب عملاً صغيراً عارضاً، والعقد
 * يُناسب عملاً معلوم الحدّ. وإنما يُعرض المقدار ليُقرَّر عن بيّنة.
 */
export function workSplit(
  movements: Movement[],
  by: "quarter" | "project"
): WorkSplitRow[] {
  const wages = movements.filter(
    (m) => isApproved(m) && validate(m).valid && m.debitCode === "5120"
  );

  const map = new Map<string, WorkSplitRow>();
  for (const m of wages) {
    const key =
      by === "quarter" ? quarterOf(m.date) : m.project || "بلا مشروع";
    const row =
      map.get(key) ?? { key, contracted: 0, loose: 0, total: 0, share: 0 };
    if (m.contractNumber) row.contracted = round3(row.contracted + m.amount);
    else row.loose = round3(row.loose + m.amount);
    row.total = round3(row.contracted + row.loose);
    row.share = row.total ? round3((row.contracted / row.total) * 100) : 0;
    map.set(key, row);
  }

  const rows = [...map.values()];
  return by === "quarter"
    ? rows.sort((a, b) => (a.key < b.key ? -1 : 1))
    : rows.sort((a, b) => b.total - a.total);
}
