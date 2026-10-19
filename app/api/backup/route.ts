/**
 * نسخةٌ احتياطيّةٌ من الدفاتر نفسها.
 *
 * GET — الحالة كاملةً بصورة ملفّ النسخة، ومعها ترويسةُ تنزيل. فيُؤخذ
 *       من الشاشة بضغطة، ومن سطر الأوامر بـ`curl`، ومن مجدولٍ لاحقاً
 *       بلا متصفّحٍ ولا إنسانٍ يتذكّر.
 *
 * ولا يُرشَّح المخرَج بصلاحيات صاحب الجلسة — وهذا مقصود: نسخةٌ ناقصةٌ
 * ليست نسخة، ولو استُرجعت محت ما حُجب عن آخذها. ولأنها كاملةٌ لا
 * تُعطى إلا لمن يقرأ الدفاتر كلها: فلا يصير `backup.run` باباً خلفيّاً
 * يَبلغ به المحجوبُ ما حُجب عنه في الشاشة.
 */

import { gzipSync } from "node:zlib";

import { NextResponse } from "next/server";

import { AuthError, requirePermission } from "@/lib/server/auth";
import { serverBackup } from "@/lib/server/backup";
import { inTransaction } from "@/lib/server/db";
import { hiddenFields } from "@/lib/server/permits";
import { backupFileName } from "@/lib/storage";

/* نسخةٌ قديمةٌ أسوأ من لا نسخة — فلا تُخزَّن الردود في أيّ طبقة */
export const dynamic = "force-dynamic";

/*
  ويُضغط الردّ.

  وليس تحسيناً: فيرسل يحدّ جسم الردّ بنحو ٤٫٥ ميغا، ونسخةُ الدفاتر
  اليومَ ٣٫٨٥ — والحضورُ وحده ٠٫٨٥ ويزيد كلَّ يومٍ بصفوفه، والحركات
  مثلُه. فلولا الضغطُ لبلغت الحدَّ بعد أشهر، ثم أخفقت النسخةُ صامتةً
  يومَ يُحتاج إليها. وهي مضغوطةً ٠٫٣٣ ميغا — فالفسحةُ تكفي سنين.

  والضغطُ بشرط `accept-encoding`: من لا يُعلن قبولَه يُعطَ نصّاً
  صريحاً — و`curl` بلا `--compressed` منهم، فلا يُحفظ له ملفٌّ لا
  يقرؤه. والمتصفّحُ يفكّه من تلقائه، فالمحفوظُ عند صاحبه نصٌّ كما كان.
*/
export async function GET(request: Request) {
  try {
    const user = await requirePermission("backup.run");

    const hidden = hiddenFields(user.permissions);
    if (hidden.length > 0) {
      return NextResponse.json(
        {
          error:
            "النسخة تحمل الدفاتر كلها، ولا تُعطى إلا لمن يقرؤها كلها. " +
            "وما لا تقرؤه: " +
            hidden.join("، "),
        },
        { status: 403 }
      );
    }

    /*
      المعاملة للتماسك لا للكتابة: الحالة تُقرأ على عشرين استعلاماً،
      وبغيرها تُلتقط حركةٌ كُتبت بعد قراءة عقدها.
    */
    const content = await inTransaction(serverBackup);

    const headers: Record<string, string> = {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${backupFileName()}"`,
      "cache-control": "no-store",
    };

    const accepts = (request.headers.get("accept-encoding") ?? "").includes("gzip");
    if (!accepts) {
      return new NextResponse(content, { status: 200, headers });
    }

    const packed = gzipSync(content);
    return new NextResponse(new Uint8Array(packed), {
      status: 200,
      headers: {
        ...headers,
        "content-encoding": "gzip",
        "content-length": String(packed.byteLength),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("خطأ في /api/backup:", error);
    return NextResponse.json(
      { error: "تعذّر أخذ النسخة. أعد المحاولة، فإن تكرّر فأبلغ المسؤول." },
      { status: 500 }
    );
  }
}
