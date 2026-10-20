/**
 * إنهاءُ العقد: إنجازاً، أو تراضياً، أو فسخاً.
 *
 * وكان حالُ العقد مشتقّاً لا مثبَتاً: يُحسب من دفعاته — «مُنتهٍ
 * مالياً» إن لم يبقَ مستحقّ. وذاك يصلح للقراءة، ولا يصلح للإنهاء:
 * فعقدٌ فُسخ بعد نصفه ليس «مُنتهياً» ولا «جارياً»، وعقدٌ أُنهي
 * بالتراضي على مبلغٍ أقلَّ من قيمته لا يُعرف من حسابه أنه أُنهي.
 *
 * فصار للإنهاء وجهٌ مثبَتٌ باسم من أنهاه ويومِه وسببه:
 *
 *   • **إنجاز**: تمّ العملُ كلُّه ووُفّي المال. وهو الأصلُ الذي يُرجى.
 *   • **تراضٍ**: اتُّفق على إنهائه قبل تمامه، وسُوّيت الحقوق برقمٍ
 *     يُكتب. ولا يُقفل بغيره — فإنهاءٌ بلا رقمٍ يُسوّى به خلافٌ
 *     مؤجَّل.
 *   • **فسخ**: أُنهي بإرادةِ طرفٍ لتقصيرٍ أو امتناع. ويُكتب سببُه،
 *     فهو حُجّةٌ يوم يُسأل.
 *
 * **وبراءةُ الذمّة لا تُصدَر إلا بعد الإنهاء وبعد أن يبرأ المال.**
 * فهي إقرارٌ بأن لا حقَّ لأحدٍ على الآخر — ومن أصدرها وفي الذمّة مالٌ
 * أصدر إقراراً كاذباً يُحتجّ به عليه، ولا يُستدرك بعد التوقيع.
 */

import { round3 } from "./accounting";

export const CLOSURE_KINDS = ["إنجاز", "تراضٍ", "فسخ"] as const;

export type ClosureKind = (typeof CLOSURE_KINDS)[number];

export type ContractClosure = {
  kind: ClosureKind;
  /** يومُ الإنهاء — yyyy-mm-dd */
  date: string;
  /** سببُه — ولا يُنهى عقدٌ بغيره */
  reason: string;
  /**
   * ما سُوّيت به الحقوق في التراضي والفسخ.
   *
   * وهو المبلغُ المتَّفقُ عليه نهائيّاً لا قيمةُ العقد: فعقدٌ قيمتُه
   * خمسةٌ وأُنهي على ثلاثةٍ لا يبقى في ذمّته اثنان.
   */
  settledAmount?: number;
  note: string;
  by: string;
  at: string;

  /** براءةُ الذمّة — متى صدرت وبيد من */
  quittanceAt?: string;
  quittanceBy?: string;
};

/* ------------------------------------------------------------------ */

export type ClosureCheck = {
  /** أيُمكن إنهاؤه بهذا الوجه؟ */
  allowed: boolean;
  /** ما يجب أن يُقال لصاحبه قبل أن يُنهي */
  warnings: string[];
  /** ما يمنع الإنهاء منعاً */
  blocking: string[];
};

/**
 * أيصلح العقدُ للإنهاء بهذا الوجه؟
 *
 * ولا يُمنع الإنهاء بباقٍ في الذمّة — فذاك بعينه موضعُ التراضي
 * والفسخ. وإنما يُمنع «الإنجاز» وفيه باقٍ: فدعوى تمام العمل ووفاء
 * المال وفي الذمّة مالٌ دعوى كاذبة، تُقرأ في الدفاتر بعد سنة فلا
 * يُعرف أيُّهما الصحيح.
 */
export function canClose(
  kind: ClosureKind,
  settlement: {
    remaining: number;
    paidUnapproved: number;
    unwritten: boolean;
    valued: number;
  },
  contractValue: number
): ClosureCheck {
  const warnings: string[] = [];
  const blocking: string[] = [];
  const remaining = round3(settlement.remaining);

  if (kind === "إنجاز") {
    if (remaining > 0.001) {
      blocking.push(
        `في الذمّة ${remaining} د.ك — و«الإنجاز» دعوى تمامِ العمل ووفاءِ المال. ` +
          `فإن أُنهي على أقلَّ من قيمته فذاك «تراضٍ»، وإن أُنهي لتقصيرٍ فذاك «فسخ».`
      );
    }
    if (remaining < -0.001) {
      warnings.push(
        `زاد المدفوعُ ${Math.abs(remaining)} د.ك على المستحقّ — راجعه قبل الإقفال`
      );
    }
    if (settlement.unwritten) {
      blocking.push("جدولُ دفعاته لم يُكتب — فلا يُقال إنه أُنجز وهو لم يبدأ");
    }
    if (round3(settlement.valued - contractValue) < -0.001 && contractValue > 0) {
      warnings.push(
        `مجموعُ دفعاته ${settlement.valued} أقلُّ من قيمته ${contractValue} — الجدولُ لم يُستوفَ`
      );
    }
  }

  if (settlement.paidUnapproved > 0.001) {
    warnings.push(
      `دفعاتٌ دخلها مالٌ (${settlement.paidUnapproved} د.ك) ولم يشهد المهندسُ بإنجازها`
    );
  }

  if (kind !== "إنجاز" && Math.abs(remaining) <= 0.001) {
    warnings.push(
      "لا باقيَ في ذمّته — ولعلّ وجهَه «إنجاز» لا تراضياً ولا فسخاً"
    );
  }

  return { allowed: blocking.length === 0, warnings, blocking };
}

/**
 * أتصلح براءةُ الذمّة؟
 *
 * ولا تصلح إلا بثلاث: أن يكون العقدُ أُنهي، وأن لا يبقى في الذمّة
 * مال، وأن تكون الحقوقُ قد سُوّيت إن كان الإنهاءُ تراضياً أو فسخاً.
 * فهي إقرارٌ بأن لا حقَّ لأحدٍ على الآخر، ومن أصدرها وفي الذمّة مالٌ
 * أصدر إقراراً كاذباً يُحتجّ به عليه.
 */
export function canIssueQuittance(
  closure: ContractClosure | undefined,
  settlement: { remaining: number }
): ClosureCheck {
  const blocking: string[] = [];
  const warnings: string[] = [];

  if (!closure) {
    blocking.push("العقدُ لم يُنهَ بعد — وبراءةُ الذمّة بعد الإنهاء لا قبله");
    return { allowed: false, warnings, blocking };
  }

  const remaining = round3(settlement.remaining);
  if (remaining > 0.001) {
    blocking.push(
      `في الذمّة ${remaining} د.ك — ولا تُصدَر براءةٌ وفي الذمّة مال، فهي إقرارٌ بأن لا حقّ`
    );
  }
  if (remaining < -0.001) {
    warnings.push(
      `زاد المدفوعُ ${Math.abs(remaining)} د.ك — فالبراءةُ تُقرّ بأنك لا تطالبه به`
    );
  }
  if (closure.kind !== "إنجاز" && !(closure.settledAmount ?? 0)) {
    warnings.push(
      "أُنهي بالتراضي أو الفسخ ولم يُكتب مبلغُ التسوية — فالبراءةُ بلا سندٍ تُسوّى به"
    );
  }
  if (closure.quittanceAt) {
    warnings.push(
      `صدرت براءةٌ قبلَها في ${closure.quittanceAt.slice(0, 10)} — وإصدارُ ثانيةٍ يُشكّك في الأولى`
    );
  }

  return { allowed: blocking.length === 0, warnings, blocking };
}

/** وصفُ حال العقد في كلمة — المثبَتُ يَسبق المشتقّ */
export function closureLabel(
  closure: ContractClosure | undefined
): string | null {
  if (!closure) return null;
  if (closure.kind === "إنجاز") return "أُنهي بالإنجاز";
  if (closure.kind === "تراضٍ") return "أُنهي بالتراضي";
  return "مفسوخ";
}
