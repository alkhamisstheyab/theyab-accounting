/**
 * ما استجدّ بعد رقمٍ ما.
 *
 * يسأله المتصفّح كل بضع ثوانٍ فيصله ما كتبه غيره وحده — لا الحالة كلها
 * في كل مرة. وبه يرى المدير اعتماد المهندس وهو يقع، وتزول عن شاشة
 * السكرتيرة حركةٌ حذفها غيرها.
 *
 * والردّ يحمل رقماً جديداً يُسأل به في المرة التالية، فلا يفوت شيء ولا
 * يتكرّر شيء.
 */

import { NextResponse } from "next/server";

import { AuthError, requireUser } from "@/lib/server/auth";
import { readable } from "@/lib/server/db";
import { readableChanges } from "@/lib/server/permits";
import { changesSince } from "@/lib/server/writes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireUser();

    const raw = new URL(request.url).searchParams.get("since");
    const since = Number(raw);
    if (!Number.isFinite(since) || since < 0) {
      return NextResponse.json(
        { error: "since يجب أن يكون رقم التغيير الذي وصلك آخر مرة" },
        { status: 400 }
      );
    }

    /* وما يصل بالسحب يُصفّى كما تُصفّى القراءة الأولى، وإلا دخل من الباب الآخر */
    const changes = await changesSince(readable, since);
    return NextResponse.json(readableChanges(changes, user.permissions));
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("خطأ في /api/data/changes:", error);
    return NextResponse.json({ error: "تعذّر جلب التغييرات" }, { status: 500 });
  }
}
