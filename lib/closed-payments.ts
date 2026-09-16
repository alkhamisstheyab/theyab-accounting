/**
 * دفعات المقاولين المُقفَلة.
 *
 * قرارٌ محاسبي من صاحب الشركة (ذياب الخميس، ١٦ سبتمبر ٢٠٢٦): دفعات
 * المقاول المنفّذ لسنة ٢٠٢٥ سُوّيت، ومشاريعها أُقفلت وسُلّمت. فلا تُعدَّل
 * بعد اليوم، ولا تُحذف، ولا تُربط بعقدٍ أو مشروع.
 *
 * ويُستثنى ما ذُكر فيه صراحةً أنه لمشروعٍ ما زال قائماً. و«صراحةً» تعني
 * حقل المشروع في الحركة نفسها، لا قرينة في البيان: ففُحصت الحركات
 * السبع والأربعون المُقفلة فلم يذكر نصّ واحدةٍ منها مشروعاً قائماً.
 *
 * وليس القفل مبنياً على «حالة المشروع» في النظام، لأن المشاريع العشرة
 * كلها مسجّلة «نشط»، ومنها ما سُلّم منذ أشهر. فلو بُني عليها لما أُقفل
 * شيء. فالمشاريع القائمة مسمّاة هنا بأسمائها.
 *
 * وعند إقراره كانت:
 *   ٥١ حركة على ٥١٢٠ في ٢٠٢٥ بمجموع ١٧٬٤٥٤٫١٦١ د.ك
 *   تُقفل ٤٧ (١٦٬١٥٤٫١٦١) — كلها على «مصروفات مشتركة»
 *   وتبقى ٤ (١٬٣٠٠) — بوعباس ٢ والعجمي ٢
 */

import type { Movement } from "./accounting";

/** حساب مصروفات المقاولين */
const CONTRACTOR_EXPENSE = "5120";

export const CONTRACTOR_PAYMENTS_CLOSURE = {
  year: 2025,
  account: CONTRACTOR_EXPENSE,
  /** المشاريع القائمة: ما ذُكر فيه أحدها صراحةً يبقى مفتوحاً */
  openProjects: ["مشروع الدكتور عبدالرحمن بوعباس", "مشروع حسن العجمي"],
  decidedBy: "ذياب الخميس",
  decidedAt: "2026-09-16",
} as const;

/** أهذه دفعة مقاولٍ مُقفلة؟ */
export function isClosedContractorPayment(movement: Movement): boolean {
  const rule = CONTRACTOR_PAYMENTS_CLOSURE;
  if (movement.fiscalYear !== rule.year) return false;
  const onContractors =
    movement.debitCode === rule.account || movement.creditCode === rule.account;
  if (!onContractors) return false;
  return !(rule.openProjects as readonly string[]).includes(movement.project ?? "");
}

/** سبب القفل بكلامٍ يفهمه من يضغط الزرّ فلا يجده يعمل */
export const CLOSED_PAYMENT_REASON =
  "دفعة مقاولٍ لسنة ٢٠٢٥ — أُقفلت بقرار صاحب الشركة، فلا تُعدَّل ولا تُحذف ولا تُربط";
