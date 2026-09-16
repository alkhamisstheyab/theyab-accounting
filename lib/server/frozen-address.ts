/**
 * العنوان المجمَّد لا يكتب في دفاتر الشركة.
 *
 * لكل نشرٍ في Vercel عنوانٌ خاصّ به، فيه بصمته (مثل ‎-9dq6ot62o-‎). وذلك
 * العنوان مجمَّد على نسخته أبداً: شاشاتها وشيفرة خادمها معاً. فمن فتحه
 * بعد أشهر فتح نظاماً قديماً — وإن كانت المزامنة فيه مشتعلة كتب في دفاتر
 * اليوم بشيفرة الأمس.
 *
 * ووقع فعلاً: تبويبٌ مجمَّد كتب فوق كلمة مرور صاحب الشركة، لأن شيفرته
 * سبقت حماية كلمة المرور. فأُقفل الباب عليه حتى أُعيدت يدوياً.
 *
 * فيُرفض الكتابة ما دام الطلب آتياً من عنوان هذا النشر نفسه. والعنوان
 * الرئيسي — وما يتبع آخر نشرٍ دائماً — يمرّ.
 *
 * والفحص مطابقةٌ تامّة لعنوان النشر لا تخمينٌ من شكله، فلا يُردّ عنوانٌ
 * رئيسيّ ولا نطاقٌ للشركة يُضاف لاحقاً. وحيث لا Vercel — على الجهاز —
 * لا يُردّ شيء.
 */

/** العنوان الذي جاء منه الطلب كما كتبه صاحبه */
function requestedHost(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-host") ?? "";
  const host = forwarded.split(",")[0]?.trim() || request.headers.get("host") || "";
  return host.toLowerCase().replace(/:\d+$/, "");
}

/** أجاء الطلب من عنوان هذا النشر المجمَّد؟ */
export function isFrozenAddress(request: Request): boolean {
  const deployment = (process.env.VERCEL_URL ?? "").toLowerCase();
  if (!deployment) return false;
  return requestedHost(request) === deployment;
}

export const FROZEN_ADDRESS_REASON =
  "هذا عنوان نشرٍ مجمَّد، لا يكتب في دفاتر الشركة. افتح النظام من العنوان الرئيسي.";
