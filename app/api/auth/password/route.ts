import { NextRequest, NextResponse } from "next/server";

import { AuthError, changeOwnPassword, requireUser } from "@/lib/server/auth";

/**
 * يغيّر المستخدم كلمة مروره.
 *
 * لا يحتاج صلاحية — يغيّر كلمته هو. ومعرّف المستخدم يؤخذ من الجلسة لا
 * من الطلب، فلا يستطيع أحد تغيير كلمة غيره بتزوير الجسم.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = (await request.json()) as {
      current?: unknown;
      next?: unknown;
    };
    const current = typeof body.current === "string" ? body.current : "";
    const next = typeof body.next === "string" ? body.next : "";

    const outcome = await changeOwnPassword(user.id, current, next);
    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.reason }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "تعذّر تنفيذ الطلب" }, { status: 500 });
  }
}
