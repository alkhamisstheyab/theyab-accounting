import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";

/** من أنا؟ — يقرأه المتصفح عند الإقلاع ليعرف هل الجلسة قائمة */
export async function GET() {
  const user = await currentUser();
  return NextResponse.json({ user });
}
