/**
 * وعاءُ قيود مسيّر الرواتب.
 *
 * الترحيل يأخذ المشروع من ملفّ الموظف، وملفّات الأحد عشر كلُّها بلا
 * مشروع — فخرجت قيود مسيّر سبتمبر ٢٠٢٦ الثلاثةَ عشرَ بخانةٍ فارغة، وهي
 * الوحيدة في ألفٍ وخمسِ مئةٍ وتسعٍ وثلاثين.
 *
 * والفراغ ليس وعاءً ثالثاً: تقرير ربحية المشاريع يُسقطه إسقاطاً صامتاً
 * (`filter(Boolean)`)، فلا يظهر في قسيمةٍ ولا في «عام» ولا في «مصروفات
 * مشتركة» — ألفان ومئتان وسبعون ديناراً من الأجور لا تُرى في التقرير،
 * وإن كانت في قوائم الشركة على الصحّة لأنها تقرأ الحسابات لا المشاريع.
 *
 * وبقاعدة صاحب الشركة: ما كان على حسابٍ إداريّ (6xxx) فوعاؤه **«عام»**،
 * وما كان على تكاليف التنفيذ (5xxx) فوعاؤه **«مصروفات مشتركة»** — لأن
 * العامل يعمل في القسائم كلّها فلا يُحمَّل أجرُه على واحدةٍ منها.
 */

import type { Movement } from "./accounting";

/** العلامة التي يكتبها الترحيل في كل قيدٍ يُنشئه */
const POSTED_NOTE = "مرحّل من مسيّر رواتب";

/** أهو قيدُ مسيّرٍ خرج بخانة مشروعٍ فارغة؟ */
const isPayrollPostingWithoutBucket = (m: Movement): boolean =>
  !String(m.project ?? "").trim() &&
  String(m.approvalNote ?? "").startsWith(POSTED_NOTE);

/** أجرٌ إداريّ بلا وعاء — محلُّه «عام» */
export const isPayrollAdminWithoutBucket = (m: Movement): boolean =>
  isPayrollPostingWithoutBucket(m) && m.debitCode.startsWith("6");

/** أجرُ تنفيذٍ بلا وعاء — محلُّه «مصروفات مشتركة» */
export const isPayrollSiteWithoutBucket = (m: Movement): boolean =>
  isPayrollPostingWithoutBucket(m) && m.debitCode.startsWith("5");

/**
 * وعاءُ الأجر عند الترحيل.
 *
 * مشروعُ الموظف إن كان له مشروعٌ معيَّن — فمن تفرّغ لقسيمةٍ حُمّل أجرُه
 * عليها — وإلّا فالوعاء بحسب باب الصرف.
 */
export const wageBucket = (project: string, wageAccount: string): string => {
  const own = String(project ?? "").trim();
  if (own) return own;
  return wageAccount.startsWith("5") ? "مصروفات مشتركة" : "عام";
};
