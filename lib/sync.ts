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

import {
  diffStates,
  isEmpty,
  countChanges,
  same,
  snapshotForServer,
} from "./changes";
import { ROW_COLLECTIONS } from "./collections";
import type { AppState } from "./storage";

const ENABLED_KEY = "theyab:sync";
/*
  الحذف المعلّق: ما حُذف في الجهاز ولم يبلغ الخادم بعد.

  والحاجة إليه أن الحذف لا يُرسل إلا لصفٍّ عرفه هذا الجهاز في جلسته —
  حمايةً من أن يمحو جهازٌ جديد ما لم يره قطّ. فلو حُذف صفٌّ ثم أُغلق
  المتصفّح قبل الإرسال، ضاع الحذف ولم يُرسل أبداً: يبقى الصفّ على
  الخادم والمقارنة حمراء لا تُشفى. فتُكتب المفاتيح المحذوفة في
  التخزين، فتعبر إغلاق المتصفّح وتُرسل في أول اتصال.
*/
const TOMB_KEY = "theyab:deleted";
/** بين الحفظ والإرسال: الحفظ يقع مع كل حرف، والإرسال لا يُراد كذلك */
const QUIET_MS = 3000;
/** بعد الإخفاق يُنتظر، ويُضاعَف الانتظار حتى حدّ — فلا يُرهق خادمٌ ساقط */
const RETRY_MIN_MS = 5000;
const RETRY_MAX_MS = 300_000;
/*
  القراءة من الخادم: كل ثماني ثوانٍ يُسأل عمّا استجدّ بعد آخر رقمٍ وصل.
  ولا تُطلب الحالة كلها، بل ما تغيّر وحده — فلا يثقل الخادم ولا الشبكة.
*/
const PULL_MS = 8000;

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

/** ما وصل من الخادم: صفوفٌ كُتبت أو حُذفت عند غيرك */
export type Incoming = {
  upserts: Record<string, Record<string, unknown>[]>;
  deletes: Record<string, string[]>;
  rev: number;
};

let applier: ((incoming: Incoming) => void) | null = null;
let pullTimer: ReturnType<typeof setTimeout> | null = null;
let pulling = false;

/**
 * يشترك في ما يصل من الخادم.
 *
 * الشاشة وحدها تعرف كيف تُدخل صفّاً في حالتها، فتُعطى ما وصل وتتولّاه.
 * ولا يُسلَّم إليها إلا ما لم تمسّه: الصفّ الذي عُدّل هنا ولم يُرسل بعدُ
 * يبقى كما هو — فالجهاز مرجعٌ فيما أدخله صاحبه، ويأخذ من غيره ما لم
 * يمسّه.
 */
export function onIncoming(fn: (incoming: Incoming) => void): () => void {
  applier = fn;
  return () => {
    if (applier === fn) applier = null;
  };
}

/** الحذف المعلّق كما هو محفوظ: الحقل ← مفاتيح */
function readTombs(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(TOMB_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeTombs(tombs: Record<string, string[]>): void {
  if (typeof window === "undefined") return;
  try {
    const clean: Record<string, string[]> = {};
    for (const [field, ids] of Object.entries(tombs)) {
      if (ids.length) clean[field] = [...new Set(ids)].slice(-5000);
    }
    if (Object.keys(clean).length) {
      window.localStorage.setItem(TOMB_KEY, JSON.stringify(clean));
    } else {
      window.localStorage.removeItem(TOMB_KEY);
    }
  } catch {
    /* التخزين ممتلئ أو محجوب — المزامنة تعمل بلا هذا */
  }
}

/** يُسجّل حذفاً معلّقاً ليُرسل ولو بعد إغلاق المتصفّح */
function rememberDeletes(deletes: Record<string, string[]>): void {
  if (!deletes || Object.keys(deletes).length === 0) return;
  const tombs = readTombs();
  for (const [field, ids] of Object.entries(deletes)) {
    tombs[field] = [...(tombs[field] ?? []), ...ids];
  }
  writeTombs(tombs);
}

/** يُنسى الحذف بعد أن يبلغ الخادم — فلا يُعاد إرساله أبداً */
function forgetDeletes(deletes: Record<string, string[]> | undefined): void {
  if (!deletes) return;
  const tombs = readTombs();
  for (const [field, ids] of Object.entries(deletes)) {
    const gone = new Set(ids);
    tombs[field] = (tombs[field] ?? []).filter((id) => !gone.has(id));
  }
  writeTombs(tombs);
}

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
    schedulePull();
  } else {
    if (pullTimer) clearTimeout(pullTimer);
    pullTimer = null;
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

/**
 * الفرق بعد إسقاط حذفِ ما لم يعرفه هذا الجهاز.
 *
 * ويُعدّ معروفاً ما رآه في جلسته، أو ما سبق أن حذفه بنفسه وسُجّل في
 * الحذف المعلّق — فذاك حذفٌ مقصود لم يبلغ الخادم بعد، لا صفٌّ غريب.
 */
function sendable(from: AppState, to: AppState) {
  const changes = diffStates(from, to);
  if (!changes.deletes) return changes;

  const tombs = readTombs();
  const deletes: Record<string, string[]> = {};
  for (const [field, ids] of Object.entries(changes.deletes)) {
    const keys = seen.get(field);
    const pending = new Set(tombs[field] ?? []);
    const mine = ids.filter((id) => keys?.has(id) || pending.has(id));
    if (mine.length) deletes[field] = mine;
  }

  if (Object.keys(deletes).length) {
    changes.deletes = deletes;
    /* يُحفظ قبل الإرسال: فلو أُغلق المتصفّح الآن بقي الحذف معلّقاً */
    rememberDeletes(deletes);
  } else {
    delete changes.deletes;
  }
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
    forgetDeletes(changes.deletes);
    backoff = RETRY_MIN_MS;
    publish({
      phase: "متزامنة",
      /* الرقم لا يتراجع: ردٌّ متأخّر قد يحمل رقماً أقدم مما سُحب */
      rev: Math.max(Number(body?.rev) || 0, status.rev),
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

/** الصفّ المعدَّل هنا ولم يُرسل بعد — لا يُكتب فوقه ما وصل */
function pendingKeys(field: string): Set<string> {
  const keys = new Set<string>();
  if (!snapshot || !latest) return keys;
  const collection = ROW_COLLECTIONS.find((c) => c.field === field);
  if (!collection) return keys;

  const before = new Map(
    ((snapshot[collection.field] ?? []) as Record<string, unknown>[]).map((r) => [
      collection.keyOf(r),
      r,
    ])
  );
  /* يُقارَن بصورة التخزين لا بالخام، وإلا بدا كل صفٍّ معدَّلاً */
  const stored = snapshotForServer(latest);
  const after = new Map(
    ((stored[collection.field] ?? []) as Record<string, unknown>[]).map((r) => [
      collection.keyOf(r),
      r,
    ])
  );
  for (const [key, row] of after) {
    if (!before.has(key) || !same(before.get(key), row)) keys.add(key);
  }
  for (const key of before.keys()) if (!after.has(key)) keys.add(key);
  return keys;
}

/** يُدخل ما وصل في صورة الخادم، فلا يُعاد إرساله إليه */
function absorb(incoming: Incoming): void {
  if (!snapshot) return;
  const next = { ...snapshot } as Record<string, unknown>;
  for (const collection of ROW_COLLECTIONS) {
    const field = collection.field as string;
    const ups = incoming.upserts[field] ?? [];
    const dels = new Set(incoming.deletes[field] ?? []);
    if (ups.length === 0 && dels.size === 0) continue;

    const rows = new Map(
      ((snapshot[collection.field] ?? []) as Record<string, unknown>[]).map((r) => [
        collection.keyOf(r),
        r,
      ])
    );
    for (const row of ups) rows.set(collection.keyOf(row), row);
    for (const key of dels) rows.delete(key);
    next[field] = [...rows.values()];
  }
  /* بصورة التخزين نفسها، وإلا عُدّ الوارد جديداً فأُعيد إرساله */
  snapshot = snapshotForServer(next as unknown as AppState);
}

/**
 * يسأل الخادم عمّا استجدّ ويسلّمه للشاشة.
 *
 * ويُسقط ما مسّه هذا الجهاز ولم يُرسل بعد: فلو كتب اثنان الصفّ نفسه
 * بقي ما هنا حتى يُرسل، ثم يفصل الخادم بينهما برقم الإصدار.
 */
async function pull(): Promise<void> {
  if (pulling || !status.enabled || !snapshot) return;
  pulling = true;
  try {
    const res = await fetch(`/api/data/changes?since=${status.rev || 0}`);
    if (!res.ok) {
      if (res.status === 401) publish({ lastError: "يلزم تسجيل الدخول في الخادم" });
      return;
    }
    const body = (await readJson(res)) as Incoming | null;
    if (!body) return;

    const upserts: Record<string, Record<string, unknown>[]> = {};
    const deletes: Record<string, string[]> = {};
    let rows = 0;
    for (const collection of ROW_COLLECTIONS) {
      const field = collection.field as string;
      const mine = pendingKeys(field);
      const ups = (body.upserts?.[field] ?? []).filter(
        (row) => !mine.has(collection.keyOf(row))
      );
      const dels = (body.deletes?.[field] ?? []).filter((key) => !mine.has(key));
      if (ups.length) upserts[field] = ups;
      if (dels.length) deletes[field] = dels;
      rows += ups.length + dels.length;
    }

    const incoming: Incoming = { upserts, deletes, rev: Number(body.rev) || 0 };
    if (rows > 0) {
      absorb(incoming);
      applier?.(incoming);
    }
    if (incoming.rev > status.rev) publish({ rev: incoming.rev });
  } catch {
    /* انقطاعٌ عابر — تُعاد المحاولة في الدورة التالية */
  } finally {
    pulling = false;
  }
}

function schedulePull(): void {
  if (pullTimer) clearTimeout(pullTimer);
  pullTimer = setTimeout(() => {
    pullTimer = null;
    void pull().finally(schedulePull);
  }, PULL_MS);
}

/**
 * يحذف من الخادم صفوفاً بعينها — ما زاد عنده ولم يعد في الجهاز.
 *
 * يُستعمل حين يكشف تقرير المقارنة زيادةً على الخادم: حذفٌ وقع في جلسةٍ
 * سابقة فلم يُرسل. ويُنادى بقرارٍ صريح من صاحبه، لا من تلقاء المزامنة.
 */
export async function pushDeletions(
  deletes: Record<string, string[]>
): Promise<number> {
  const clean: Record<string, string[]> = {};
  for (const [field, ids] of Object.entries(deletes)) {
    if (ids.length) clean[field] = [...new Set(ids)];
  }
  const count = Object.values(clean).reduce((n, ids) => n + ids.length, 0);
  if (count === 0) return 0;

  const res = await fetch("/api/data", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deletes: clean }),
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(reason(res, body));

  forgetDeletes(clean);
  /* الصورة لم تعد تمثّل الخادم بعد هذا الحذف، فتُجدَّد عند أول اتصال */
  snapshot = null;
  publish({ lastSyncAt: new Date().toISOString(), lastError: "" });
  return count;
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
  schedulePull();
}
