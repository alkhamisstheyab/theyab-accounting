/**
 * بيانات النظام: تُقرأ كاملةً، وتُكتب صفّاً صفّاً.
 *
 * GET  — الحالة كلها ومعها رقم التغيير الحالي. يقرؤها المتصفّح عند
 *        الإقلاع، ثم لا يعود إليها: بعدها يسأل عمّا استجدّ وحده.
 * POST — ما تغيّر وحده. فلا يمحو حافظٌ عملَ حافظٍ قبله.
 */

import { NextResponse } from "next/server";

import { AuthError, requireUser } from "@/lib/server/auth";
import { FROZEN_ADDRESS_REASON, isFrozenAddress } from "@/lib/server/frozen-address";
import { inTransaction, readable } from "@/lib/server/db";
import {
  allowedChanges,
  nothingToWrite,
  hiddenFields,
  readableState,
  type ChangeShape,
} from "@/lib/server/permits";
import { certifyOnly } from "@/lib/server/certify";
import { approveOnly } from "@/lib/server/approve";
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
    const user = await requireUser();
    /*
      رقم التغيير يُقرأ قبل الحالة لا بعدها. فلو قُرئ بعدها وكُتب بينهما
      شيء لحمل الرقم كتابةً ليست في الحالة، فلا يسأل عنها المتصفّح أبداً
      ولا يراها. والعكس — رقمٌ أقدم من الحالة — يعيد ما عنده فحسب.
    */
    const rev = await currentRev(readable);
    /*
      ولا يُرسَل إلا ما يقرؤه صاحبه: الإخفاء في الشاشة لا يمنع من يفتح
      أدوات المطوّر، وما لم يخرج من القاعدة لا يُقرأ بحيلة.
    */
    const state = readableState(await readState(readable), user.permissions, {
      id: user.id,
      name: user.name,
    });
    /*
      وما لا يقرؤه يُسمّى له، فيكفّ متصفّحه عن إرساله. وإلا رأى مجموعةً
      فارغةً عنده فحسبها ناقصةً عند الخادم فدفع بما في جهازه.
    */
    return NextResponse.json({
      rev,
      state,
      hidden: hiddenFields(user.permissions),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    /*
      العنوان المجمَّد يُردّ قبل كل شيء — قبل الجلسة والصلاحيات. فشيفرته
      قديمة، ولا يُسأل عمّن يكتب بها بل يُمنع أن يكتب.
    */
    if (isFrozenAddress(request)) {
      return NextResponse.json({ error: FROZEN_ADDRESS_REASON }, { status: 409 });
    }

    const user = await requireUser();
    const changes = (await request.json()) as ChangeSet & ChangeShape;

    /*
      ما جاز يُكتب، وما لا يجوز يُردّ باسمه. ولو رُدّ الطلب كلّه لصفٍّ
      واحدٍ فيه لوقف رفعُ عمل صاحبه كلِّه، وهو لا يدري.
    */
const { allowed, refused } = allowedChanges(changes, user.permissions);

    /*
      شهادةُ المهندس تمرّ وإن رُدّت كتابتُه.

      الكتابة في العقود تطلب «إدارة المقاولين»، والمهندس لا يملكها ولا
      يصحّ أن يملكها. فكان اعتمادُه يُردّ كلُّه: يعتمد في جهازه فتظهر
      الدفعة معتمدةً أمامه، ولا يصل الخادمَ شيء، ولا يعلم صاحبُ الشركة
      أن أحداً اعتمد.

      فيُقرأ الصفُّ المحفوظ ويُؤخذ من الوارد حقولُ الشهادة وحدها — وما
      سواها يبقى كما هو عند الخادم. ولا يُحتاج إلى الثقة بما أرسل.
    */
    const certifying =
      refused.some((r) => r.field === "contractors") &&
      (user.permissions.includes("contracts.approve") ||
        user.permissions.includes("contracts.confirm"));

    /*
      واعتمادُ الحركات يمرّ وإن رُدّت كتابتُها — وهي العلّةُ نفسُها.

      فالكتابةُ في الحركات تطلب «إدخال» أو «تعديل»، و«اعتماد الحركات»
      ليست منهما. فمن أُعطي الاعتمادَ وحدَه اعتمد في جهازه ورُدَّ صفُّه،
      فلا تدخل الدفاترَ ولا يعلم أحد. فيُؤخذ من الوارد اعتمادُه وحدَه.

      ومعه الحارس: من أدخل حركةً لا يعتمدها — إلا صاحبَ الشركة
      والمديرَ العام.
    */
    const approving =
      refused.some((r) => r.field === "movements") &&
      user.permissions.includes("movements.approve");

    /* الكاتب اسمه لا معرّفه: السجل يُقرأ بعد سنوات وقد زال الحساب */
    const result = await inTransaction(async (db) => {
      const toWrite = { ...(allowed as ChangeSet) };
      let certified = 0;
      let approved = 0;
      let blocked: { entryNo: string; reason: string }[] = [];

      if (certifying) {
        const sent = (changes.upserts?.contractors ?? []) as unknown[];
        const merged = await certifyOnly(db, sent, user.permissions);
        if (merged.length > 0) {
          toWrite.upserts = { ...(toWrite.upserts ?? {}), contractors: merged };
          certified = merged.length;
        }
      }

      if (approving) {
        const sent = (changes.upserts?.movements ?? []) as unknown[];
        const outcome = await approveOnly(db, sent, user.permissions, {
          name: user.name,
          role: user.role,
        });
        if (outcome.merged.length > 0) {
          toWrite.upserts = {
            ...(toWrite.upserts ?? {}),
            movements: outcome.merged,
          };
          approved = outcome.merged.length;
        }
        blocked = outcome.blocked;
      }

      if (nothingToWrite(toWrite)) return null;
      /* الفرز يختار مجموعاتٍ من الطلب ولا يمسّ صفوفها، فهي كما وصلت */
      const counts = await applyChangesIn(db, toWrite, user.name);
      return { ...counts, certified, approved, blocked, rev: await currentRev(db) };
    });

    if (!result) {
      return NextResponse.json(
        { error: refused[0]?.reason ?? "لا شيء في الطلب", refused },
        { status: refused.length > 0 ? 403 : 200 }
      );
    }

    /*
      ما مرّ بالشهادة لا يُقال لصاحبه إنه رُدّ: كُتب منه ما يملكه، وبقي
      ما لا يملكه عند الخادم كما هو. ولو عُدّ مردوداً لظنّ عملَه ضائعاً.
    */
    let told = result.certified > 0
      ? refused.filter((r) => r.field !== "contractors")
      : refused;
    /*
      وكذلك ما مرّ بالاعتماد: كُتب اعتمادُه وبقي ما سواه كما هو.
      وما مُنع منه — حركةٌ أدخلها هو — يُقال له بسببه لا يُطوى،
      فيعرف أنّها تنتظر غيرَه ولا يحسبها معتمدةً عنده.
    */
    if (result.approved > 0) {
      told = told.filter((r) => r.field !== "movements");
    }
    for (const row of result.blocked ?? []) {
      told = [
        ...told,
        { field: "movements", reason: `قيد ${row.entryNo}: ${row.reason}` },
      ];
    }

    return NextResponse.json({ ...result, refused: told });
  } catch (error) {
    return fail(error);
  }
}
