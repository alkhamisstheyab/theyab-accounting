/**
 * بيانات النظام: تُقرأ كاملةً، وتُكتب صفّاً صفّاً.
 *
 * GET  — الحالة كلها ومعها رقم التغيير الحالي. يقرؤها المتصفّح عند
 *        الإقلاع، ثم لا يعود إليها: بعدها يسأل عمّا استجدّ وحده.
 * POST — ما تغيّر وحده. فلا يمحو حافظٌ عملَ حافظٍ قبله.
 */

import { NextResponse } from "next/server";

import { AuthError, requireUser } from "@/lib/server/auth";
import { inTransaction, readable } from "@/lib/server/db";
import { refusalReason, type ChangeShape } from "@/lib/server/permits";
import { readState } from "@/lib/server/state";
import { applyChangesIn, currentRev, type ChangeSet } from "@/lib/server/writes";

/* البيانات تتغيّر في كل لحظة، فلا تُخزَّن الردود في أي طبقة */
export const dynamic = "force-dynamic";

/** خطأ الجلسة يُردّ برمزه، وما سواه لا يُفشى نصّه — قد يحمل تفاصيل القاعدة */
function fail(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("خطأ في /api/data:", error);
  return NextResponse.json(
    { error: "تعذّر تنفيذ الطلب. أعد المحاولة، فإن تكرّر فأبلغ المسؤول." },
    { status: 500 }
  );
}

export async function GET() {
  try {
    await requireUser();
    /*
      رقم التغيير يُقرأ قبل الحالة لا بعدها. فلو قُرئ بعدها وكُتب بينهما
      شيء لحمل الرقم كتابةً ليست في الحالة، فلا يسأل عنها المتصفّح أبداً
      ولا يراها. والعكس — رقمٌ أقدم من الحالة — يعيد ما عنده فحسب.
    */
    const rev = await currentRev(readable);
    const state = await readState(readable);
    return NextResponse.json({ rev, state });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const changes = (await request.json()) as ChangeSet & ChangeShape;

    const refused = refusalReason(changes, user.permissions);
    if (refused) {
      return NextResponse.json({ error: refused }, { status: 403 });
    }

    /* الكاتب اسمه لا معرّفه: السجل يُقرأ بعد سنوات وقد زال الحساب */
    const result = await inTransaction(async (db) => {
      const counts = await applyChangesIn(db, changes, user.name);
      return { ...counts, rev: await currentRev(db) };
    });

    return NextResponse.json(result);
  } catch (error) {
    return fail(error);
  }
}
