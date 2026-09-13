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

  const outcome = await login(
    name,
    password,
    request.headers.get("user-agent") ?? ""
  );

  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.reason },
      { status: outcome.lockedUntil ? 429 : 401 }
    );
  }

  return NextResponse.json({ user: outcome.user });
}
