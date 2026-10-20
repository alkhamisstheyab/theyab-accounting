/**
 * صورُ تقارير الاجتماعات: تُرفع إلى المخزن، ويُحفظ مسارُها وحدَه.
 *
 * POST — صورةٌ واحدةٌ، ويرجع مسارُها.
 * GET ?path=… — تُعطى الصورةُ لصاحب الصلاحية.
 *
 * ولمَ لا تُحفظ في القاعدة: النسخةُ الاحتياطيّة اليومَ ٣٫٨٥ ميغا،
 * وحدُّ الردّ عند الناشر ٤٫٥. وصورةٌ واحدةٌ من هاتفٍ ثلاثةُ ميغا —
 * فصورتان تُخفقان النسخةَ صامتةً، وتلك خسارةُ الدفاتر كلِّها لأجل
 * صورة. فتُرفع إلى مخزنٍ خاصٍّ لا حدَّ له، ويبقى في الصفّ مسارُها.
 *
 * والمخزنُ خاصٌّ كمخزن النسخ: فصورةُ موقعٍ قد يكون فيها ما لا يُنشر —
 * وجوهُ عمّالٍ، أو عيبٌ في عملٍ لم يُصلَح بعد.
 */

import { NextResponse } from "next/server";

import { get, put } from "@vercel/blob";

import { AuthError, requirePermission } from "@/lib/server/auth";
import { blobConfigured, blobToken } from "@/lib/server/backup-store";

export const dynamic = "force-dynamic";
/* صورةٌ من هاتفٍ قد تبلغ عشرةَ ميغا، ورفعُها يأخذ وقتاً */
export const maxDuration = 60;

/** ما يُقبل من الصور — ولا يُقبل غيرُها، فالمخزنُ ليس مستودعَ ملفّات */
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic"];

/* ١٥ ميغا: أكبرُ من صورة هاتفٍ بأضعاف، وأصغرُ من أن يُستغلّ المخزن */
const MAX_BYTES = 15 * 1024 * 1024;

const FOLDER = "minutes";

/** `minutes/2026-10-20-<عشوائيّ>.jpg` — ولا يُؤخذ اسمُ الملفّ كما جاء */
function pathFor(type: string): string {
  const ext =
    type === "image/png"
      ? "png"
      : type === "image/webp"
      ? "webp"
      : type === "image/heic"
      ? "heic"
      : "jpg";
  const day = new Date().toISOString().slice(0, 10);
  const token = Math.random().toString(36).slice(2, 10);
  return `${FOLDER}/${day}-${token}.${ext}`;
}

export async function POST(request: Request) {
  try {
    /* ومن يكتب تقريراً يرفع صورَه — فالصلاحيةُ واحدة */
    await requirePermission("projects.manage");

    if (!blobConfigured()) {
      return NextResponse.json(
        {
          error:
            "لا مخزنَ موصولاً — أنشئ مخزن Blob خاصّاً في لوحة فيرسل، فالصورُ لا تُحفظ في القاعدة.",
        },
        { status: 503 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "لا صورةَ في الطلب" }, { status: 400 });
    }

    /*
      والنوعُ يُفحص من الملفّ لا من اسمه: فاسمٌ ينتهي بـ.jpg لا يجعل
      ما فيه صورةً، ومخزنٌ يَقبل كلَّ شيءٍ يصير مستودعاً لكلِّ شيء.
    */
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json(
        {
          error: `نوعٌ لا يُقبل (${file.type || "غير معروف"}) — تُقبل الصور: JPEG · PNG · WebP · HEIC`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        {
          error: `الصورةُ ${Math.round(file.size / 1024 / 1024)} ميغا — والحدّ ${
            MAX_BYTES / 1024 / 1024
          }`,
        },
        { status: 400 }
      );
    }

    const path = pathFor(file.type);
    const saved = await put(path, file, {
      access: "private",
      contentType: file.type,
      addRandomSuffix: false,
      token: blobToken(),
    });

    return NextResponse.json({
      path: saved.pathname,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("خطأ في رفع الصورة:", error);
    return NextResponse.json(
      { error: "تعذّر رفع الصورة. أعد المحاولة، فإن تكرّر فأبلغ المسؤول." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    await requirePermission("projects.view");

    if (!blobConfigured()) {
      return NextResponse.json({ error: "لا مخزنَ موصولاً" }, { status: 503 });
    }

    const wanted = new URL(request.url).searchParams.get("path") ?? "";
    /*
      ولا يُقرأ إلا ما كان في مجلّد الصور: فالمسارُ يأتي من الطلب، ولو
      مُرّر كما جاء لصار بابَ قراءةٍ للنسخ الاحتياطيّة نفسها — وهي في
      المخزن ذاته.
    */
    if (!wanted.startsWith(`${FOLDER}/`) || wanted.includes("..")) {
      return NextResponse.json({ error: "مسارٌ غير معروف" }, { status: 400 });
    }

    const found = await get(wanted, { access: "private", token: blobToken() });
    if (!found?.stream) {
      return NextResponse.json({ error: "لا صورةَ بهذا المسار" }, { status: 404 });
    }

    const bytes = Buffer.from(await new Response(found.stream).arrayBuffer());
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "content-type": found.headers.get("content-type") ?? "image/jpeg",
        /* وتُخزَّن في المتصفّح ساعةً: فالصورةُ لا تتغيّر بعد رفعها */
        "cache-control": "private, max-age=3600",
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("خطأ في قراءة الصورة:", error);
    return NextResponse.json({ error: "تعذّر قراءة الصورة" }, { status: 500 });
  }
}
