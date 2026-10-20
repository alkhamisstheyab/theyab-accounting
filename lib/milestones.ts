/**
 * متابعةُ المراحل بمواعيدها المتوقَّعة، وتنبيهُ ما توقّف.
 *
 * وكانت التنبيهاتُ كلُّها على ما **وقع**: دفعةٌ استُحقّت ولم تُسدَّد،
 * حركةٌ تنتظر اعتماداً. ولم يكن فيها شيءٌ على ما **سيقع**: فلا يُعلم
 * أنّ مرحلةً موعدُها بعد ثلاثة أيامٍ ولم يُعاينها المهندس، ولا أنّ
 * عملاً توقّف منذ شهرٍ ولم يُسأل عنه.
 *
 * وثلاثةٌ تُحرس هنا:
 *
 *   • **لا تنبيهَ على ما لم يُكتب له موعد.** فالسكوتُ لا يُقاس به،
 *     ومن ولَّد المواعيدَ من مدّة العقد نبّه على تخمين.
 *
 *   • **والموقوفُ لا يُعدّ متأخّراً.** فالمرحلةُ تتوقّف لا بتقصير:
 *     انتظارُ مدعومٍ أو ترخيصٍ أو دفعةٍ من العميل. ولو عُدّ متأخّراً
 *     لنُبّه عليه كلَّ يومٍ بلا فائدة — وتنبيهٌ يُكرَّر بلا عملٍ
 *     يُهمَل، ثم يُهمل معه الصادق.
 *
 *   • **والمنجَزُ لا يُنبَّه عليه.** فما اعتُمد إنجازُه خرج من
 *     المتابعة، ولو بقي فيها لظنّ المهندسُ أنّ عليه عملاً وقد فعله.
 */

import { round3 } from "./accounting";
import type { Contractor, Installment } from "./storage";

const DAY = 86400000;

/** كم يوماً قبل الموعد يُنبَّه — أسبوعٌ يكفي لمعاينةٍ وترتيب */
export const SOON_DAYS = 7;

/**
 * كم يوماً من التوقّف يُعدّ طويلاً.
 *
 * وأسبوعان: فأقلُّ منهما انتظارٌ معتاد — مادّةٌ تأتي، ورخصةٌ تُنجَز —
 * وأكثرُ منهما توقّفٌ يُسأل عنه.
 */
export const STALL_DAYS = 14;

export type MilestoneState =
  /** موعدُها قَرُب ولم تُعتمد */
  | "يقرب"
  /** مضى موعدُها ولم تُعتمد */
  | "متأخّرة"
  /** أوقِفت بسببٍ مكتوب */
  | "موقوفة"
  /** في موعدها ولم يَقرب */
  | "في موعدها";

export type Milestone = {
  contractNumber: string;
  contractName: string;
  project: string;
  counterpartyType: string;
  number: number;
  stage: string;
  value: number;
  expectedDate: string;
  state: MilestoneState;
  /** الأيامُ إلى الموعد — سالبةٌ إن مضى */
  days: number;
  stalledReason: string;
  /** أيامُ التوقّف — إن كانت موقوفة */
  stalledDays: number;
};

const dayOf = (text: string | undefined): Date | null => {
  if (!text) return null;
  const at = new Date(`${String(text).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(at.getTime()) ? null : at;
};

const between = (from: Date, to: Date): number =>
  Math.round((to.getTime() - from.getTime()) / DAY);

/**
 * مراحلُ العقود التي لها موعدٌ متوقَّعٌ ولم تُعتمد.
 *
 * `today` يُمرَّر ولا يُؤخذ من الساعة: فالدالّةُ تُفحص، ومن أخذ
 * الوقتَ من تلقائه لم يُفحص حسابُه على يومٍ معلوم.
 */
export function milestones(
  contracts: readonly Contractor[],
  today: Date
): Milestone[] {
  const rows: Milestone[] = [];

  for (const contract of contracts) {
    /* وعقدٌ أُنهي لا يُتابَع: لا عملَ فيه يُنتظر */
    if (contract.closure) continue;

    for (const installment of contract.installments ?? []) {
      /* والمعتمَدُ خرج من المتابعة — ولو بقي ظنّ المهندسُ أنّ عليه عملاً */
      if (installment.approved) continue;

      const at = dayOf(installment.expectedDate);
      /* ولا شيءَ يُقال عمّا لم يُكتب له موعد */
      if (!at) continue;

      const days = between(today, at);
      const stalledFrom = dayOf(installment.stalledAt);

      const state: MilestoneState = installment.stalled
        ? "موقوفة"
        : days < 0
        ? "متأخّرة"
        : days <= SOON_DAYS
        ? "يقرب"
        : "في موعدها";

      rows.push({
        contractNumber: contract.contractNumber,
        contractName: contract.name,
        project: contract.project || "",
        counterpartyType: contract.counterpartyType || "",
        number: installment.number,
        stage: installment.stage ?? "",
        value: round3(
          (Number(installment.value) || 0) - (Number(installment.deduction) || 0)
        ),
        expectedDate: installment.expectedDate ?? "",
        state,
        days,
        stalledReason: installment.stalledReason ?? "",
        stalledDays: stalledFrom ? Math.max(0, between(stalledFrom, today)) : 0,
      });
    }
  }

  /* الأشدُّ أوّلاً: المتأخّرُ ثم الموقوفُ الطويل ثم ما يقرب */
  const rank: Record<MilestoneState, number> = {
    "متأخّرة": 0,
    "موقوفة": 1,
    "يقرب": 2,
    "في موعدها": 3,
  };
  return rows.sort(
    (a, b) => rank[a.state] - rank[b.state] || a.days - b.days
  );
}

export type MilestoneSummary = {
  late: Milestone[];
  soon: Milestone[];
  stalled: Milestone[];
  /** الموقوفةُ طويلاً — أكثرَ من أسبوعين */
  longStalled: Milestone[];
  onTime: Milestone[];
};

export function milestoneSummary(rows: readonly Milestone[]): MilestoneSummary {
  const stalled = rows.filter((m) => m.state === "موقوفة");
  return {
    late: rows.filter((m) => m.state === "متأخّرة"),
    soon: rows.filter((m) => m.state === "يقرب"),
    stalled,
    longStalled: stalled.filter((m) => m.stalledDays >= STALL_DAYS),
    onTime: rows.filter((m) => m.state === "في موعدها"),
  };
}

/** وصفُ حالِ المرحلة في كلمةٍ تُقرأ */
export function milestoneLabel(row: Milestone): string {
  if (row.state === "موقوفة") {
    return row.stalledDays > 0
      ? `موقوفةٌ منذ ${row.stalledDays} يوماً`
      : "موقوفة";
  }
  if (row.state === "متأخّرة") return `تأخّرت ${Math.abs(row.days)} يوماً`;
  if (row.state === "يقرب") {
    return row.days === 0 ? "موعدُها اليوم" : `بعد ${row.days} يوماً`;
  }
  return `بعد ${row.days} يوماً`;
}
