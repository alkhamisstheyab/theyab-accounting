import { NextRequest, NextResponse } from "next/server";

import {
  AuthError,
  requirePermission,
  resetUserPassword,
} from "@/lib/server/auth";

/**
 * يُعيد صاحبُ الصلاحية تعيين كلمة مرور مستخدمٍ آخر.
 *
 * الكلمة المؤقّتة تُولَّد هنا وتُعاد **مرّةً واحدة** في جواب الطلب، ولا
 * تُحفظ ولا تُقرأ بعدها — المحفوظ تجزئتُها. فمن أغلق الشاشة قبل أن
 * ينسخها أعاد التعيين من جديد، ولا سبيل إلى استرجاعها.
 *
 * والصلاحية \`users.manage\` هي الفحص الحقيقي: إخفاء الزرّ في الواجهة
 * زينةٌ لا حماية، ومن عرف العنوان أرسل الطلب بيده.
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await requirePermission("users.manage");

    const body = (await request.json()) as { userId?: unknown };
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId) {
      return NextResponse.json({ error: "لم يُحدَّد المستخدم" }, { status: 400 });
    }

    const outcome = await resetUserPassword(userId);
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.reason }, { status: 404 });
    }

    /*
      يُسجَّل الفعل لا الكلمة: سجلّ التدقيق يُقرأ ويُصدَّر، فلا يُكتب فيه
      سرٌّ يفتح حساباً.
    */
    return NextResponse.json({
      ok: true,
      name: outcome.name,
      password: outcome.password,
      by: actor.name,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "تعذّر تنفيذ الطلب" }, { status: 500 });
  }
}
