/**
 * المزامنة مع الخادم — المرحلة الرابعة.
 *
 * المتصفّح هو المرجع، ولا يزال. يحفظ في جهازه كما كان، ثم يرسل إلى
 * الخادم ما تغيّر وحده. فإن سقط الخادم أو انقطع الإنترنت لم يقف العمل
 * ولم تضع حركة: الحفظ المحلّي تمّ قبل أن يُحاوَل الإرسال.
 *
 * وهي مطفأة حتى تُشعَل. فلا يُقحَم أحدٌ في تجربةٍ لم يطلبها: من أراد
 * أن يجرّب أشعلها من الإعدادات، ومن لم يُرد بقي على ما كان.
 *
 * ولا تُقرأ من الخادم شاشةٌ في هذه المرحلة. القراءة منه في المرحلة
 * الخامسة، ولا تُبدَّل المصادر إلا بعد أن تُثبت المقارنة اليومية
 * التطابق أياماً متتالية.
 */

import { diffStates, isEmpty, countChanges, snapshotForServer } from "./changes";
import { ROW_COLLECTIONS } from "./collections";
import type { AppState } from "./storage";

const ENABLED_KEY = "theyab:sync";
/** بين الحفظ والإرسال: الحفظ يقع مع كل حرف، والإرسال لا يُراد كذلك */
const QUIET_MS = 3000;
/** بعد الإخفاق يُنتظر، ويُضاعَف الانتظار حتى حدّ — فلا يُرهق خادمٌ ساقط */
const RETRY_MIN_MS = 5000;
const RETRY_MAX_MS = 300_000;

export type SyncPhase =
  | "مطفأة"
  | "تتّصل"
  | "متزامنة"
  | "بانتظار الإرسال"
  | "منقطعة";

export type SyncStatus = {
  enabled: boolean;
  phase: SyncPhase;
  /** رقم التغيير عند الخادم كما وصلنا آخر مرة */
  rev: number;
  /** صفوفٌ تغيّرت ولم تصل بعد */
  pending: number;
  lastSyncAt: string;
  lastError: string;
};

let status: SyncStatus = {
  enabled: false,
  phase: "مطفأة",
  rev: 0,
  pending: 0,
  lastSyncAt: "",
  lastError: "",
};

/** صورةُ ما عند الخادم كما نعرفها — وعليها يُحسب الفرق */
let snapshot: AppState | null = null;
/** آخر ما عند المتصفّح، ينتظر دوره */
let latest: AppState | null = null;

/**
 * الصفوف التي رآها هذا الجهاز.
 *
 * ولا يُرسل حذفُ صفٍّ لم يره: قد يكون على الخادم ما ليس هنا — أنشأه
 * جهازٌ آخر، أو حسابٌ أُنشئ على الخادم نفسه. فلو حُسب الفرق حساباً
 * مجرّداً لقال «عندك ما ليس عندي، فاحذفه» — ومحا عمل غيره في أول اتصال.
 *
 * فالحذف لا يُرسل إلا لصفٍّ كان هنا ثم زال.
 */
const seen = new Map<string, Set<string>>();

let timer: ReturnType<typeof setTimeout> | null = null;
let sending = false;
let backoff = RETRY_MIN_MS;

const listeners = new Set<(s: SyncStatus) => void>();

function publish(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  for (const fn of listeners) fn(status);
}

export function subscribe(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}

export const syncStatus = (): SyncStatus => status;

/* ------------------------------------------------------------------ */
/* الإشعال والإطفاء                                                    */
/* ------------------------------------------------------------------ */

export function syncEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ENABLED_KEY) === "on";
  } catch {
    return false;
  }
}

export function setSyncEnabled(on: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, on ? "on" : "off");
  } catch {
    /* التخزين ممتلئ أو ممنوع — والإشعال يبقى لهذه الجلسة */
  }
  if (on) {
    publish({ enabled: true, phase: "تتّصل", lastError: "" });
    void connect();
  } else {
    if (timer) clearTimeout(timer);
    timer = null;
    /*
      الصورة تُمسح لأنها قد تقدُم وهي مطفأة. أمّا آخر حالة فتبقى، فلو
      مُسحت لوقع العيب نفسه: أُطفئت ثم أُشعلت، فلا يُرسل شيء.
    */
    snapshot = null;
    publish({ enabled: false, phase: "مطفأة", pending: 0, lastError: "" });
  }
}

/* ------------------------------------------------------------------ */
/* الاتصال                                                             */
/* ------------------------------------------------------------------ */

/** رسالةٌ تُفهم: ما الذي وقع وما الذي يُفعل به */
function reason(res: Response, body: { error?: string } | null): string {
  if (res.status === 401) return "يلزم تسجيل الدخول في الخادم";
  if (res.status === 403) return body?.error ?? "الخادم ردّ الطلب";
  if (res.status >= 500) return "الخادم لا يستجيب";
  return body?.error ?? `الخادم ردّ برمز ${res.status}`;
}

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * يقرأ حالة الخادم مرةً واحدة فتصير الصورة التي يُحسب عليها الفرق.
 *
 * وكل إشعالٍ يبدأ بها: فلو كُتب على الخادم من جهازٍ آخر، أو أخفق إرسالٌ
 * وأُغلق النظام، صحّح هذا القراءةُ نفسَه — يُحسب الفرق على ما عنده
 * حقيقةً لا على ما نظنّ.
 */
export async function connect(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  publish({ phase: "تتّصل" });
  try {
    const res = await fetch("/api/data", { cache: "no-store" });
    const body = await readJson(res);
    if (!res.ok) {
      publish({ phase: "منقطعة", lastError: reason(res, body) });
      return false;
    }
    snapshot = body?.state as AppState;
    publish({
      phase: "متزامنة",
      rev: Number(body?.rev) || 0,
      lastError: "",
      lastSyncAt: new Date().toISOString(),
    });
    /* ما تغيّر في المتصفّح قبل الاتصال يُرسل الآن */
    if (latest) schedule(0);
    return true;
  } catch {
    publish({ phase: "منقطعة", lastError: "تعذّر الوصول إلى الخادم" });
    return false;
  }
}

/** حالة الخادم كما هي الآن — للمقارنة اليومية لا للعرض في الشاشات */
export async function fetchServerState(): Promise<AppState> {
  const res = await fetch("/api/data", { cache: "no-store" });
  const body = await readJson(res);
  if (!res.ok) throw new Error(reason(res, body));
  return body?.state as AppState;
}

/* ------------------------------------------------------------------ */
/* الإرسال                                                             */
/* ------------------------------------------------------------------ */

/**
 * يُبلَّغ بكل حفظ.
 *
 * ولا يرسل مع كل حفظ: الحفظ يقع مع كل حرف يُكتب في نموذج، والإرسال
 * ينتظر أن تهدأ اليد. وما تراكم في الأثناء يذهب في طلبٍ واحد.
 */
export function record(state: AppState): void {
  /*
    آخر حالة تُحفظ وإن كانت المزامنة مطفأة، ولا يُرسل منها شيء.

    كان فحص الإشعال قبل هذين السطرين، فكل ما يُعمل والمزامنة مطفأة يُرمى.
    فإذا أشعلها صاحبها لم تجد ما ترسله، ولم ترسل شيئاً حتى يغيّر حرفاً.
    وإشعالها وحده لا يغيّر شيئاً، فبقيت مشتعلة صامتة والمقارنة حمراء.
    وقع ذلك فعلاً بعد مسح بيانات المتصفّح.
  */
  latest = state;
  remember(state);
  if (!status.enabled) return;
  if (snapshot) {
    publish({ pending: countChanges(sendable(snapshot, state)) });
  }
  schedule(QUIET_MS);
}

/**
 * يسجّل ما حُمّل من التخزين قبل أن يمسّه النظام.
 *
 * يُنادى عند الفتح بالحالة كما قُرئت. وبه يُعرف أن ما يمحوه النظام
 * بنفسه — عرضُ سعرٍ انقضت مدّته مثلاً — محوٌ مقصود يُبلَّغ به الخادم،
 * لا صفٌّ غريبٌ لم يره هذا الجهاز قطّ فيُترك في مكانه.
 */
export const rememberLoaded = (state: AppState): void => remember(state);

/** يسجّل مفاتيح ما في الجهاز الآن، فيُعرف لاحقاً ما زال عنه */
function remember(state: AppState): void {
  for (const collection of ROW_COLLECTIONS) {
    const field = collection.field as string;
    let keys = seen.get(field);
    if (!keys) seen.set(field, (keys = new Set()));
    for (const row of (state[collection.field] ?? []) as unknown[]) {
      if (row && typeof row === "object") {
        const key = collection.keyOf(row as Record<string, unknown>);
        if (key) keys.add(key);
      }
    }
  }
}

/** الفرق بعد إسقاط حذفِ ما لم يعرفه هذا الجهاز */
function sendable(from: AppState, to: AppState) {
  const changes = diffStates(from, to);
  if (!changes.deletes) return changes;

  const deletes: Record<string, string[]> = {};
  for (const [field, ids] of Object.entries(changes.deletes)) {
    const keys = seen.get(field);
    const mine = ids.filter((id) => keys?.has(id));
    if (mine.length) deletes[field] = mine;
  }

  if (Object.keys(deletes).length) changes.deletes = deletes;
  else delete changes.deletes;
  return changes;
}

function schedule(delay: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, delay);
}

async function flush(): Promise<void> {
  if (sending || !status.enabled) return;
  if (!snapshot) {
    void connect();
    return;
  }
  if (!latest) return;

  const state = latest;
  const changes = sendable(snapshot, state);
  if (isEmpty(changes)) {
    publish({ phase: "متزامنة", pending: 0 });
    return;
  }

  sending = true;
  publish({ phase: "بانتظار الإرسال" });
  try {
    const res = await fetch("/api/data", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(changes),
    });
    const body = await readJson(res);

    if (!res.ok) {
      /*
        الصورة لا تُحدَّث عند الإخفاق. فيبقى الفرق قائماً ويُعاد إرساله،
        ولا يُفقد تغييرٌ لأن إرساله أخفق مرة.
      */
      publish({ phase: "منقطعة", lastError: reason(res, body) });
      backoff = Math.min(backoff * 2, RETRY_MAX_MS);
      schedule(backoff);
      return;
    }

    snapshot = snapshotForServer(state);
    backoff = RETRY_MIN_MS;
    publish({
      phase: "متزامنة",
      rev: Number(body?.rev) || status.rev,
      pending: 0,
      lastError: "",
      lastSyncAt: new Date().toISOString(),
    });

    /* تغيّر شيءٌ أثناء الإرسال؟ يُرسل في الدورة التالية */
    if (latest !== state) schedule(QUIET_MS);
  } catch {
    publish({ phase: "منقطعة", lastError: "تعذّر الوصول إلى الخادم" });
    backoff = Math.min(backoff * 2, RETRY_MAX_MS);
    schedule(backoff);
  } finally {
    sending = false;
  }
}

/** يُنادى مرةً عند الإقلاع */
export function startSync(): void {
  if (typeof window === "undefined") return;
  if (!syncEnabled()) {
    publish({ enabled: false, phase: "مطفأة" });
    return;
  }
  publish({ enabled: true });
  void connect();
}
