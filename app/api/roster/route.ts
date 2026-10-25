/**
 * أسماءُ من في الشركة — لتُوجَّه إليهم الرسائلُ والقرارات.
 *
 * GET — يردّ الأسماءَ وحدَها لكلِّ من له حسابٌ وولج.
 *
 * ولمَ مسارٌ مستقلٌّ ولم تُفتح مجموعةُ المستخدمين؟
 *
 * **لأنّ حجبَها مقصود.** قرارُ صاحب الشركة أن لا يعرف من لا يُديرهم
 * من في الشركة ولا ما لكلٍّ من صلاحية — وكانت تصل كلَّ جهازٍ يومَ كانت
 * شاشةُ الدخول تعرض الأسماء ليُختار منها، فلمّا صار الاسمُ يُكتب
 * والتحقّقُ على الخادم حُجبت. ثمّ بُنيت شاشةُ الأعمال فاحتاجت الأسماءَ
 * لتُوجَّه الرسائل، فعملت عند من يُديرهم وسكتت عند الجميع: فتحت م. ميس
 * الشاشةَ لتُرسل رسالةً فلم تجد إلا «الجميع» وعدَدُه صفر.
 *
 * **ولمَ لا تُرسَل مقصوصةً مع الحالة؟** لأنّ ما يصل الجهازَ يُقارَن
 * ويُرسَل. فصفُّ مستخدمٍ ناقصُ الصلاحيات والدور يُعدّ مختلفاً عمّا عند
 * الخادم، فيُدفع به فتُمحى صلاحياتُ الناس وأدوارُهم — وهي علّةُ
 * «الجهاز لا يُرسل حتى تكون عنده نسخة» من بابٍ آخر. فالأسماءُ تُقرأ
 * من مسارها ولا تُخزَّن ولا تُقارَن ولا تُرسَل، فلا سبيلَ لها إلى
 * الكتابة أصلاً.
 *
 * وما يخرج منه: المعرّفُ والاسمُ والمسمّى الوظيفيّ. ولا دور، ولا
 * صلاحيات، ولا رقمَ سرّيّاً — فالغرضُ أن يُنادى الإنسانُ باسمه، لا أن
 * يُعرف ما يملك.
 */

import { NextResponse } from "next/server";

import { AuthError, requireUser } from "@/lib/server/auth";
import { readable } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    /* يكفي أن يكون له حسابٌ وقد ولج — ولا صلاحيةَ بعد ذلك */
    await requireUser();

    const { rows } = await readable.query(
      `SELECT data->>'id' AS id, name, job_title
         FROM users
        WHERE active IS TRUE
        ORDER BY name`
    );

    return NextResponse.json({
      people: rows.map((row) => ({
        id: String(row.id ?? ""),
        name: String(row.name ?? ""),
        jobTitle: String(row.job_title ?? ""),
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("خطأ في قراءة الأسماء:", error);
    return NextResponse.json({ error: "تعذّر قراءة الأسماء" }, { status: 500 });
  }
}
