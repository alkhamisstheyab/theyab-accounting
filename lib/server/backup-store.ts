/**
 * مخزنُ النسخ: الكتابةُ فيه، وما يُبقى منه وما يُطرح.
 *
 * النسخةُ لا تُحفظ في القاعدة التي هي نسخةٌ منها — فما يَضيع بضياع
 * الحساب لا يُسمّى نسخةً احتياطيّة. فتُكتب في مخزنٍ منفصل.
 *
 * **وخاصّاً لا عامّاً.** ومخزنُ Blob نوعُه يُختار عند إنشائه ولا
 * يُغيَّر: فالعامُّ يُقرأ من رابطه بلا جلسةٍ ولا كلمةِ مرور — ودفاترُ
 * شركةٍ كاملةً على رابطٍ كذلك خطأٌ لا يُستدرك بعد وقوعه. فالكتابةُ
 * هنا بـ`access: "private"`، وهي تُخفق صريحةً إن كان المخزنُ عامّاً
 * — وذلك خيرٌ من أن تنجح.
 *
 * ويُحفظ مضغوطاً: ٣٤٧ ك.بايت بدل ٣٫٨٥ ميغا، فمخزنُ سنواتٍ يبقى صغيراً.
 */

import { del, list, put } from "@vercel/blob";

/** المجلّد في المخزن — واسمُ الملفّ يحمل وقتَه، فبه يُعرف ما يُبقى */
const FOLDER = "backups";

/**
 * مفتاحُ المخزن.
 *
 * والمعتادُ `BLOB_READ_WRITE_TOKEN` تجده المكتبةُ وحدها. لكنّ من وصل
 * مخزناً ثانياً إلى مشروعه جاءه الاسمُ بسابقةٍ — `backups_BLOB_READ_
 * WRITE_TOKEN` ونحوها — فلا تجده المكتبةُ، فيُقال «لا مخزنَ موصولاً»
 * والمخزنُ موصولٌ وموجود. فيُبحث عن أيِّ اسمٍ ينتهي به، ويُمرَّر صريحاً.
 */
export function blobToken(): string | undefined {
  const direct = process.env.BLOB_READ_WRITE_TOKEN;
  if (direct) return direct;
  for (const [name, value] of Object.entries(process.env)) {
    if (value && name.endsWith("BLOB_READ_WRITE_TOKEN")) return value;
  }
  return undefined;
}

/** أسماءُ ما يراه الخادمُ من متغيّرات المخزن — أسماءٌ بلا قيم، للتشخيص */
export const blobEnvNames = (): string[] =>
  Object.keys(process.env)
    .filter((name) => name.toUpperCase().includes("BLOB"))
    .sort();

const two = (n: number) => String(n).padStart(2, "0");

/** `backups/2026-10-19-0300.json.gz` — بالتوقيت العالمي، فلا يختلف ترتيبُها */
export function backupPath(at: Date): string {
  return `${FOLDER}/${at.getUTCFullYear()}-${two(at.getUTCMonth() + 1)}-${two(
    at.getUTCDate()
  )}-${two(at.getUTCHours())}${two(at.getUTCMinutes())}.json.gz`;
}

/** ما في الاسم من تاريخ — وما لا يُقرأ تاريخُه لا يُطرح أبداً */
export function dateOf(pathname: string): Date | null {
  const m = pathname.match(/(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})\.json\.gz$/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const at = new Date(
    Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi))
  );
  return Number.isNaN(at.getTime()) ? null : at;
}

export type StoredBackup = {
  pathname: string;
  at: Date;
  size: number;
};

export async function listBackups(): Promise<StoredBackup[]> {
  const found: StoredBackup[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: `${FOLDER}/`, cursor, limit: 1000, token: blobToken() });
    for (const blob of page.blobs) {
      const at = dateOf(blob.pathname);
      if (at) found.push({ pathname: blob.pathname, at, size: blob.size });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  /* الأحدثُ أوّلاً */
  return found.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export async function storeBackup(
  body: Buffer,
  at: Date
): Promise<{ pathname: string; size: number }> {
  const pathname = backupPath(at);
  const saved = await put(pathname, body, {
    access: "private",
    contentType: "application/gzip",
    /*
      والاسمُ كما هو: اللاحقةُ العشوائيّة تمنع الكتابةَ فوق نسخةِ
      الدقيقة نفسها، فتتكرّر نسخةُ يومٍ واحدٍ عند إعادة التشغيل.
    */
    addRandomSuffix: false,
    allowOverwrite: true,
    token: blobToken(),
  });
  return { pathname: saved.pathname, size: body.byteLength };
}

/* ------------------------------------------------------------------ */
/* ما يُبقى                                                            */
/* ------------------------------------------------------------------ */

/** يومُ الشيء بالتوقيت العالمي — مفتاحٌ للتجميع */
const dayKey = (at: Date) => at.toISOString().slice(0, 10);
const weekKey = (at: Date) => {
  const d = new Date(at);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
};
const monthKey = (at: Date) => at.toISOString().slice(0, 7);

const DAY = 86400000;

/**
 * سياسةُ الإبقاء.
 *
 *   • كلُّ نسخةٍ في آخر أربعةَ عشرَ يوماً.
 *   • ثم أحدثُ نسخةٍ من كلِّ أسبوعٍ إلى تمام سنة.
 *   • ثم أحدثُ نسخةٍ من كلِّ شهرٍ — تبقى أبداً، فسنةٌ مقفلةٌ لا تُطرح.
 *
 * والمقياسُ وقتُ أحدثِ نسخةٍ لا وقتُ الآن: فلو انقطع المجدولُ شهراً
 * ثم عاد، لم يُحسب ما قبله «قديماً» فيُطرح نصفُه في تشغيلةٍ واحدة.
 */
export function toPurge(backups: readonly StoredBackup[]): StoredBackup[] {
  if (backups.length === 0) return [];
  const newest = backups[0].at.getTime();

  const keep = new Set<string>();
  const seenWeek = new Set<string>();
  const seenMonth = new Set<string>();
  const seenDay = new Set<string>();

  for (const backup of backups) {
    const age = newest - backup.at.getTime();

    if (age <= 14 * DAY) {
      keep.add(backup.pathname);
      seenDay.add(dayKey(backup.at));
      seenWeek.add(weekKey(backup.at));
      seenMonth.add(monthKey(backup.at));
      continue;
    }

    if (age <= 365 * DAY) {
      const week = weekKey(backup.at);
      if (!seenWeek.has(week)) {
        seenWeek.add(week);
        seenMonth.add(monthKey(backup.at));
        keep.add(backup.pathname);
      }
      continue;
    }

    const month = monthKey(backup.at);
    if (!seenMonth.has(month)) {
      seenMonth.add(month);
      keep.add(backup.pathname);
    }
  }

  /* وأحدثُ نسخةٍ تبقى على كل حال — ولو كسر حسابٌ ما قبله */
  keep.add(backups[0].pathname);

  return backups.filter((b) => !keep.has(b.pathname));
}

export async function purge(victims: readonly StoredBackup[]): Promise<number> {
  if (victims.length === 0) return 0;
  await del(victims.map((v) => v.pathname), { token: blobToken() });
  return victims.length;
}
