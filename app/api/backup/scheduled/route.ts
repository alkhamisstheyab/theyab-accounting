/**
 * النسخةُ الليليّة — بلا متصفّحٍ ولا إنسانٍ يتذكّر.
 *
 * يُنادَى من مجدول فيرسل (vercel.json)، فيأخذ الدفاتر ويضغطها ويكتبها
 * في مخزنٍ خاصٍّ خارج القاعدة، ثم يطرح ما انتهى أجلُه بسياسة الإبقاء.
 *
 * ومن يُنادي؟ ثلاثةٌ لا غيرُهم:
 *
 *   • المجدولُ عند فيرسل — ويُعرف بترويسة `x-vercel-cron`، وهي من
 *     ترويسات `x-vercel-*` التي تُنزع من كل طلبٍ قادمٍ من خارج.
 *   • من يحمل `CRON_SECRET` إن وُضع — وهو الأحرز، فيُوصى به.
 *   • صاحبُ الجلسةِ الذي له `backup.run` ويقرأ الدفاتر كلَّها — وبه
 *     يُجرّب صاحبُ النظام المجدولَ بيده قبل أن ينتظر الليل.
 *
 * وبغير هذا الحرز لصار رابطٌ مكشوفٌ يُشغّل قراءةَ الدفاتر كلّها وكتابةً
 * في المخزن، يُستنزف به الحسابُ بالتكرار.
 */

import { gzipSync } from "node:zlib";

import { NextResponse } from "next/server";

import { currentUser } from "@/lib/server/auth";
import { serverBackup } from "@/lib/server/backup";
import { listBackups, purge, storeBackup, toPurge } from "@/lib/server/backup-store";
import { inTransaction } from "@/lib/server/db";
import { hiddenFields } from "@/lib/server/permits";

export const dynamic = "force-dynamic";
/* القراءةُ كاملةٌ والضغطُ معها — فلا تُقطع عند حدٍّ قصير */
export const maxDuration = 60;

async function allowed(request: Request): Promise<string | null> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const given = request.headers.get("authorization") ?? "";
    if (given === `Bearer ${secret}`) return "المجدول";
  }
  if (request.headers.get("x-vercel-cron")) return "المجدول";

  const user = await currentUser();
  if (
    user &&
    user.permissions.includes("backup.run") &&
    hiddenFields(user.permissions).length === 0
  ) {
    return user.name;
  }
  return null;
}

export async function GET(request: Request) {
  const by = await allowed(request);
  if (!by) {
    return NextResponse.json(
      { error: "هذا المسار للمجدول، أو لصاحب صلاحية النسخ" },
      { status: 403 }
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "لا مخزنَ موصولاً: أنشئ مخزن Blob خاصّاً في لوحة فيرسل واربطه بالمشروع، " +
          "فيظهر المتغيّر BLOB_READ_WRITE_TOKEN.",
      },
      { status: 503 }
    );
  }

  const startedAt = Date.now();
  try {
    const at = new Date();
    const content = await inTransaction(serverBackup);
    const packed = gzipSync(content);
    const saved = await storeBackup(packed, at);

    /*
      والطرحُ بعد الكتابة لا قبلها: فلو أخفقت الكتابةُ وقد طُرح القديمُ
      نقصت النسخُ بلا بديل. وإخفاقُ الطرح وحده لا يُفشل النسخة — فمخزنٌ
      يكبر أهونُ من ليلةٍ بلا نسخة.
    */
    let purged = 0;
    let purgeError: string | null = null;
    try {
      purged = await purge(toPurge(await listBackups()));
    } catch (error) {
      purgeError = String((error as Error)?.message ?? error);
      console.error("تعذّر طرح النسخ القديمة:", error);
    }

    return NextResponse.json({
      ok: true,
      by,
      pathname: saved.pathname,
      bytes: saved.size,
      raw: content.length,
      purged,
      purgeError,
      ms: Date.now() - startedAt,
    });
  } catch (error) {
    /*
      ويُسجَّل السببُ في دفتر الناشر: المجدولُ يعمل وحده، فإن لم يُقل
      لمَ أخفق بقي صاحبُه يحسب أنّ له نسخةً كلَّ ليلة.
    */
    console.error("أخفقت النسخة المجدولة:", error);
    const message = String((error as Error)?.message ?? error);
    return NextResponse.json(
      {
        error: /access/i.test(message)
          ? "تعذّرت الكتابة: تأكّد أن مخزن Blob **خاصّ** (private) — والنوع لا يُغيَّر بعد الإنشاء. " +
            message
          : "تعذّرت النسخة: " + message,
      },
      { status: 500 }
    );
  }
}
