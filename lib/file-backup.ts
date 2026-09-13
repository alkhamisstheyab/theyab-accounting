/**
 * الحفظ المباشر إلى ملف نسخة احتياطية.
 *
 * المتصفح يستطيع الكتابة في ملف يختاره المستخدم مرة واحدة، فتصبح النسخة
 * التالية بضغطة واحدة بلا نوافذ ولا مجلد تنزيلات. المرجع (handle) يُحفظ في
 * IndexedDB لأنه كائن لا يقبل التحويل إلى نص فلا يصلح له localStorage.
 *
 * غير مدعوم في كل المتصفحات — تحقّق بـ supportsDirectSave() أولاً.
 */

/* الواجهات معرّفة يدوياً لأنها قد لا تكون في تعريفات TypeScript الحالية */

type PermissionState = "granted" | "denied" | "prompt";

type FileHandle = {
  name: string;
  createWritable: () => Promise<{
    write: (data: string) => Promise<void>;
    close: () => Promise<void>;
  }>;
  queryPermission?: (opts: { mode: string }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: string }) => Promise<PermissionState>;
};

type SavePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileHandle>;
};

export function supportsDirectSave(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as SavePickerWindow).showSaveFilePicker === "function"
  );
}

/* ------------------------------------------------------------------ */
/* تخزين مرجع الملف في IndexedDB                                       */
/* ------------------------------------------------------------------ */

const DB_NAME = "theyab-backup";
const STORE = "handles";
const KEY = "backup-file";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(value: FileHandle | null): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    if (value) tx.objectStore(STORE).put(value, KEY);
    else tx.objectStore(STORE).delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet(): Promise<FileHandle | null> {
  const db = await openDB();
  const value = await new Promise<FileHandle | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(KEY);
    request.onsuccess = () => resolve((request.result as FileHandle) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}

/* ------------------------------------------------------------------ */
/* الملف المرتبط                                                       */
/* ------------------------------------------------------------------ */

export async function linkedFileName(): Promise<string | null> {
  try {
    const handle = await idbGet();
    return handle?.name ?? null;
  } catch {
    return null;
  }
}

export async function unlinkFile(): Promise<void> {
  try {
    await idbSet(null);
  } catch {
    // لا شيء نفعله — الربط اختياري أصلاً
  }
}

export type LinkOutcome =
  | { ok: true; name: string }
  | { ok: false; reason: string };

/**
 * يطلب اختيار ملف النسخة الاحتياطية ويحفظ مرجعه.
 *
 * كل فشل يُعاد بسببه نصاً: إخفاء السبب في catch صامت يجعل المستخدم
 * يرى النتيجة الخاطئة (تنزيل عادي) دون أن يعرف لماذا.
 */
export async function chooseBackupFile(
  suggestedName: string
): Promise<LinkOutcome> {
  const picker = (window as SavePickerWindow).showSaveFilePicker;
  if (!picker) {
    return { ok: false, reason: "المتصفح لا يدعم الكتابة المباشرة في الملفات" };
  }

  let handle: FileHandle;
  try {
    handle = await picker({
      suggestedName,
      types: [
        {
          description: "نسخة احتياطية",
          accept: { "application/json": [".json"] },
        },
      ],
    });
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === "AbortError") return { ok: false, reason: "أُغلقت النافذة" };
    return { ok: false, reason: `تعذّر فتح نافذة الحفظ: ${name ?? error}` };
  }

  try {
    await idbSet(handle);
  } catch (error) {
    return {
      ok: false,
      reason: `تعذّر حفظ مرجع الملف: ${(error as Error)?.message ?? error}`,
    };
  }

  // نتحقق أن المرجع حُفظ فعلاً بدل افتراض النجاح
  try {
    const stored = await idbGet();
    if (!stored) {
      return { ok: false, reason: "حُفظ المرجع لكنه لم يُقرأ — التخزين محجوب؟" };
    }
  } catch (error) {
    return {
      ok: false,
      reason: `تعذّرت قراءة المرجع بعد حفظه: ${(error as Error)?.message ?? error}`,
    };
  }

  return { ok: true, name: handle.name };
}

async function ensureWritable(handle: FileHandle): Promise<boolean> {
  if (!handle.queryPermission) return true;
  const state = await handle.queryPermission({ mode: "readwrite" });
  if (state === "granted") return true;
  if (!handle.requestPermission) return false;
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

export type SaveOutcome =
  | { ok: true; name: string }
  | { ok: false; reason: "no-file" | "denied" | "failed" };

/** يكتب المحتوى في الملف المرتبط مباشرة */
export async function saveToLinkedFile(content: string): Promise<SaveOutcome> {
  let handle: FileHandle | null = null;
  try {
    handle = await idbGet();
  } catch {
    return { ok: false, reason: "failed" };
  }
  if (!handle) return { ok: false, reason: "no-file" };

  try {
    if (!(await ensureWritable(handle))) return { ok: false, reason: "denied" };
    const stream = await handle.createWritable();
    await stream.write(content);
    await stream.close();
    return { ok: true, name: handle.name };
  } catch {
    // الملف قد يكون حُذف أو نُقل
    return { ok: false, reason: "failed" };
  }
}

/* ------------------------------------------------------------------ */
/* تتبّع آخر نسخة                                                      */
/* ------------------------------------------------------------------ */

const META_KEY = "backupMeta";

export type BackupMeta = {
  /** ISO datetime */
  at: string;
  /** عدد الحركات وقت الحفظ، لقياس ما استُجدّ بعده */
  movementCount: number;
};

export function readBackupMeta(): BackupMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BackupMeta;
    return parsed?.at ? parsed : null;
  } catch {
    return null;
  }
}

export function writeBackupMeta(movementCount: number): BackupMeta {
  const meta: BackupMeta = { at: new Date().toISOString(), movementCount };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // امتلاء التخزين لا يمنع النسخة نفسها
  }
  return meta;
}

export function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return Infinity;
  return Math.floor((Date.now() - then) / 86_400_000);
}

/** هل آن وقت التذكير بأخذ نسخة؟ */
export function backupDue(
  meta: BackupMeta | null,
  movementCount: number
): { due: boolean; days: number; added: number } {
  if (!meta) return { due: movementCount > 0, days: Infinity, added: movementCount };
  const days = daysSince(meta.at);
  const added = Math.max(0, movementCount - meta.movementCount);
  return { due: days >= 3 || added >= 20, days, added };
}
