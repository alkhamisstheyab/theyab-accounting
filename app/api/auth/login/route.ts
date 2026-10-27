import { NextRequest, NextResponse } from "next/server";

import { login } from "@/lib/server/auth";

/**
 * تسجيل الدخول.
 *
 * لا يُرجع أبداً ما يميّز «الاسم خاطئ» عن «كلمة المرور خاطئة» — الرسالة
 * واحدة، فلا يُستدلّ منها على وجود حساب.
 */
export async function POST(request: NextRequest) {
  let body: { name?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!name || !password) {
    return NextResponse.json(
      { error: "اسم المستخدم وكلمة المرور مطلوبان" },
      { status: 400 }
    );
  }

  /*
    وما خرج من `login` من خطأٍ يُقال، ولا يُترك الطريقُ يسقط صامتاً.

    وقعت هذه في ٢٧ أكتوبر ٢٠٢٦: نضبت حصّةُ القاعدة فصارت ترفض كلَّ
    اتصال، فخرج الطريقُ خمسَ مئةٍ بجسمٍ فارغ — فقرأ صاحبُ الشركة
    «تعذّر الدخول» ولم يعرف أنّ العلّة في القاعدة لا في كلمته. والرسالةُ
    لا تُفرّق بين اسمٍ خاطئٍ وكلمةٍ خاطئة، ولكنّها تُفرّق بين خطأِ
    الداخلِ وخطأِ الخادم — وهذا ليس إفشاءً بل دلالةٌ على مَن يُراجَع.
  */
  let outcome;
  try {
    outcome = await login(
      name,
      password,
      request.headers.get("user-agent") ?? ""
    );
  } catch (error) {
    console.error("خطأ في /api/auth/login:", error);
    return NextResponse.json(
      {
        error:
          "قاعدة البيانات لا تستجيب — العلّة ليست في كلمة مرورك. أبلغ المسؤول.",
      },
      { status: 503 }
    );
  }

  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.reason },
      { status: outcome.lockedUntil ? 429 : 401 }
    );
  }

  return NextResponse.json({ user: outcome.user });
}
