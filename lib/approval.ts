/**
 * من أدخل الحركةَ لا يعتمدها.
 *
 * طلبه صاحب الشركة في ٢٢ أكتوبر ٢٠٢٦ وهو يمنح م. ميس «اعتماد
 * الحركات»: وعندها «تسجيل المستحقات»، فلو جمعت الاثنين أثبتت مستحقّاً
 * واعتمدته في دقيقةٍ واحدةٍ بلا مرورٍ على أحد — فينتقض أصلُ النظام
 * كلِّه: «أن يمرّ على كلِّ دينارٍ عينان لا عينٌ واحدة».
 *
 * **ومن أين يُعرف من أدخلها؟** من سجلّ التدقيق لا من الصفّ. فالحركةُ
 * لا تحمل اسمَ من أدخلها، ولو أُضيف حقلٌ لها لبقي فارغاً في ألفٍ
 * وتسع مئةٍ من القيود القديمة — فيمرّ القديمُ بلا حارس. وسجلُّ
 * التدقيق يحمله لكلِّ قيدٍ منذ أوّل يوم، ولا يُحذف منه شيءٌ ولا
 * يُعدَّل، فهو أوثقُ من حقلٍ يُكتب مع الصفّ.
 *
 * **ويُستثنى صاحبُ الشركة والمديرُ العام.** فهو يُدخل أكثرَ الحركات
 * بيده ويعتمدها، ولو مُنع لتوقّف العملُ كلُّه — ولا معنى لحارسٍ
 * يحرسه من نفسه وهو صاحبُ المال. وإنّما الحارسُ لمن أُعطي الاعتمادَ
 * وهو يُدخل: المحاسبُ ومساعدُه والمهندسةُ المكتبيّة.
 *
 * **وما لا يُعرف قائلُه لا يُمنع.** فقيدٌ لا سجلَّ إدخالٍ له — وفي
 * دفاتره قيودٌ مستوردةٌ كذلك — يبقى معتمَداً لمن يملك الاعتماد: فالمنعُ
 * على ظنٍّ أسوأُ من إذنٍ على جهل، ومراجعةُ المدخلات تكشف ما لا سجلَّ
 * له بعلمٍ أصلاً.
 */

import type { AuditEntry } from "./audit";
import type { Movement } from "./accounting";

/** من يعتمد ما أدخله: صاحبُ الشركة والمديرُ العام وحدَهما */
export const SELF_APPROVAL_EXEMPT = ["owner", "manager"] as const;

export const mayApproveOwn = (role: string): boolean =>
  (SELF_APPROVAL_EXEMPT as readonly string[]).includes(role);

/** مفتاحُ القيد في السجلّ: رقمُه ويومُه — ولا يتكرّران في سنة */
const keyOf = (entryNo: number | string, date: string): string =>
  `${entryNo}|${date}`;

/**
 * يقرأ «قيد N · YYYY-MM-DD» من سطر السجلّ.
 *
 * ويُنظر في الملخّص وفي «بعد» كليهما: فملخّصُ الإدخال من الشاشة
 * الرئيسية يحمل الرقم، وملخّصُ سدادِ المستحقّ يحمل اسمَ صاحبه
 * والرقمُ في «بعد». ولو قُرئ أحدُهما لسقط نصفُ القيود من الحارس.
 */
const stampIn = (row: AuditEntry): string | null => {
  const text = `${row.summary ?? ""} ${row.after ?? ""}`;
  const m = /قيد\s+(\d+)\s*·\s*(\d{4}-\d{2}-\d{2})/.exec(text);
  return m ? keyOf(m[1], m[2]) : null;
};

export type EnteredBy = { user: string; at: string };

/**
 * من أدخل كلَّ قيد، بأوّلِ إنشاءٍ له.
 *
 * وأوّلُ إنشاءٍ هو الإدخال: فمن حُذف قيدُه وأُعيد بنفس الرقم في نفس
 * اليوم له سطرا إنشاءٍ، والأوّلُ أصدقُهما بصاحبه.
 */
export function enteredByMap(
  audit: readonly AuditEntry[]
): Map<string, EnteredBy> {
  const out = new Map<string, EnteredBy>();
  for (const row of audit) {
    if (row.entity !== "حركة" || row.action !== "إنشاء") continue;
    const key = stampIn(row);
    if (!key) continue;
    const was = out.get(key);
    if (!was || row.at < was.at) out.set(key, { user: row.user, at: row.at });
  }
  return out;
}

/** من أدخل هذه الحركة — وفراغٌ إن لم يُعرف */
export function enteredBy(
  audit: readonly AuditEntry[],
  movement: Pick<Movement, "entryNo" | "date">
): string {
  const found = enteredByMap(audit).get(keyOf(movement.entryNo, movement.date));
  return found?.user ?? "";
}

/**
 * سببُ منع الاعتماد، أو فراغٌ إن جاز.
 *
 * ويُذكر الاسمُ في السبب: «أدخلتَها أنت» تُفهم بلا شرح، و«ممنوع»
 * تُرسل صاحبَها يسأل عن علّةٍ لا يعرفها.
 */
export function selfApprovalBlock(
  entrant: string,
  approver: string,
  role: string
): string {
  if (mayApproveOwn(role)) return "";
  if (!entrant) return "";
  if (entrant.trim() !== approver.trim()) return "";
  return "أدخلتَها أنت — يعتمدها غيرُك";
}

/** أيعتمد هذا الشخصُ هذه الحركة؟ — تُستعمل في الشاشة وفي الخادم */
export function canApproveMovement(
  movement: Pick<Movement, "entryNo" | "date">,
  approver: string,
  role: string,
  entrants: Map<string, EnteredBy>
): string {
  const entrant = entrants.get(keyOf(movement.entryNo, movement.date))?.user ?? "";
  return selfApprovalBlock(entrant, approver, role);
}
