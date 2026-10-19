/**
 * النسخُ المحفوظةُ في المخزن: تُعدّ وتُنزَّل.
 *
 * GET                  — قائمةُ ما في المخزن: وقتُ كلٍّ وحجمُها.
 * GET ?path=backups/…  — تُنزَّل واحدةٌ بعينها، مفكوكةَ الضغط.
 *
 * وبغير هذا البابِ تكون النسخُ في مكانٍ لا يراه صاحبُها: يُقال له
 * «تُؤخذ كلَّ ليلة» ولا دليلَ عنده، ولا طريقَ إليها يومَ يحتاجها إلا
 * لوحةُ الناشر. ونسخةٌ لا تُجرَّب ليست نسخة.
 *
 * وتُفكّ قبل أن تُعطى: الاسترجاعُ والاستيرادُ كلاهما يقرأ نصّاً، فلو
 * نُزّلت مضغوطةً لاحتاج صاحبُها أداةً يفكّها بها يومَ الشدّة.
 */

import { gunzipSync } from "node:zlib";

import { get } from "@vercel/blob";
import { NextResponse } from "next/server";

import { AuthError, requirePermission } from "@/lib/server/auth";
import {
  blobEnvNames,
  blobToken,
  dateOf,
  listBackups,
} from "@/lib/server/backup-store";
import { hiddenFields } from "@/lib/server/permits";

export const dynamic = "force-dynamic";

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

    const token = blobToken();
    if (!token) {
      /* وأسماءُ ما يراه الخادم، بلا قيم — فيُعرف أمشكلةُ اسمٍ أم نشرةٍ لم تُعَد */
      return NextResponse.json({ store: false, backups: [], seen: blobEnvNames() });
    }

    const wanted = new URL(request.url).searchParams.get("path");

    /* ---- قائمةٌ ---- */
    if (!wanted) {
      const backups = await listBackups();
      return NextResponse.json({
        store: true,
        backups: backups.map((b) => ({
          path: b.pathname,
          at: b.at.toISOString(),
          size: b.size,
        })),
      });
    }

    /* ---- واحدةٌ بعينها ---- */
    /*
      ولا يُقرأ إلا ما كان نسخةً في مجلّدها واسمُه تاريخٌ: فالمسارُ
      يأتي من الطلب، ولو مُرّر كما جاء لصار بابَ قراءةٍ لأيِّ شيءٍ في
      المخزن — وفيه غيرُ النسخ غداً.
    */
    if (!wanted.startsWith("backups/") || !dateOf(wanted)) {
      return NextResponse.json({ error: "مسارٌ غير معروف" }, { status: 400 });
    }

    const found = await get(wanted, { access: "private", token });
    if (!found || !found.stream) {
      return NextResponse.json({ error: "لا نسخةَ بهذا المسار" }, { status: 404 });
    }

    const packed = Buffer.from(await new Response(found.stream).arrayBuffer());
    const content = gunzipSync(packed);
    const name = wanted.split("/").pop()?.replace(/\.gz$/, "") ?? "backup.json";

    return new NextResponse(new Uint8Array(content), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="theyab-accounting-${name}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("خطأ في /api/backup/stored:", error);
    return NextResponse.json(
      { error: "تعذّر قراءة المخزن. أعد المحاولة، فإن تكرّر فأبلغ المسؤول." },
      { status: 500 }
    );
  }
}
