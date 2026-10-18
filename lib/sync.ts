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
  comparable,
  diffStates,
  isEmpty,
  countChanges,
  same,
  snapshotForServer,
} from "./changes";
import { ROW_COLLECTIONS } from "./collections";
import type { AppState } from "./storage";

const ENABLED_KEY = "theyab:sync";
/** ما مسَّه هذا الجهاز ولم يبلغ الخادمَ بعد — يبقى بعد إغلاق المتصفّح */
const TOUCHED_KEY = "theyab:touched";
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
  /**
   * حركاتٌ غيّر الخادم أرقام قيودها لأنها كانت مأخوذة.
   *
   * تُعرض لصاحبها: فقد يكون طبع سنداً بالرقم القديم، أو كتبه في ورقة.
   */
  renumbered: { id: string; from: number; to: number }[];
  /**
   * مجموعاتٌ ردّها الخادم لانعدام الصلاحية، ومعها سببها.
   *
   * تُعرض لصاحبها: فالصمت هنا أسوأ من الرفض — يعمل يومه ويحسب عمله
   * محفوظاً وهو في جهازه وحده.
   */
  refused: { field: string; reason: string }[];
  /**
   * صفوفٌ كانت على الخادم وليست في الجهاز فضُمّت إليه.
   *
   * تُعرض لصاحبها: عملُ غيره وصله متأخّراً، وربما كان ينتظره — كمستحقٍّ
   * كتبه مهندسٌ ولم يجده في شاشة الإقرار.
   */
  adopted: number;
};

let status: SyncStatus = {
  enabled: false,
  phase: "مطفأة",
  rev: 0,
  pending: 0,
  lastSyncAt: "",
  renumbered: [],
  refused: [],
  adopted: 0,
  lastError: "",
};

/** صورةُ ما عند الخادم كما نعرفها — وعليها يُحسب الفرق */
let snapshot: AppState | null = null;
/** آخر ما عند المتصفّح، ينتظر دوره */
let latest: AppState | null = null;
/** ضمٌّ طُلب قبل أن تُعرَف حالةُ الجهاز، فيُنفَّذ عند أول حفظ */
let adoptWanted = false;

/**
 * ما مسَّه صاحبُ هذا الجهاز في جلسته — ولا يُرسل سواه.
 *
 * كانت المزامنة تحسب الفرق بين الجهاز والخادم وتعدّ **كلَّ فرقٍ**
 * تغييراً محلياً يُرسل. فلا تفرّق بين «أنا عدّلتُ هذا» و«نسختي قديمةٌ
 * وقد تقدّم الخادم عليّ». فإذا أقرّ أحدُهم دفعةً ثم فتح آخرُ جهازاً
 * نسختُه أقدم، دفع جهازُه القديمَ فوق الجديد — وكلٌّ يتشبّث بنسخته.
 *
 * ووقع ذلك في ١٨ أكتوبر ٢٠٢٦: مُحي تسعةَ عشرَ إقراراً للإدارة
 * واعتمادان، كتب فوقها جهازا م. ميس وصاحب الشركة نفسه بنسختين
 * أقدم. ولم يضع مالٌ ولا قيد — ضاعت القرارات وحدها، واستُردّت من
 * سجلّ التدقيق.
 *
 * فصار الجهاز لا يُرسل إلا ما غيّره صاحبُه بيده. والصفُّ يُعدّ ممسوساً
 * متى خالف **ما كان عليه هنا قبل لحظة** — فإن ساوى ما عند الخادم فهو
 * وارثٌ من الخادم لا تغييرٌ محليّ، وإلا عاد ما يصل من غيرك يُرسل إليه
 * من جديد فيدور بلا نهاية.
 */
const touched = new Map<string, Set<string>>();

/**
 * ويبقى بعد إغلاق المتصفّح.
 *
 * من عمل والخطُّ مقطوع ثم أغلق قبل أن يُرسل، يعود فيجد عملَه في جهازه
 * — ولو نُسي أنه مسَّه لعُدّ صفُّه قديماً، فأُخذ من الخادم وضاع ما عمل.
 * فيُحفظ كما يُحفظ شاهدُ القبر، ويُمحى ما بلغ الخادم.
 */
function readTouched(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  if (typeof window === "undefined") return map;
  try {
    const raw = window.localStorage.getItem(TOUCHED_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") {
      for (const [field, keys] of Object.entries(parsed)) {
        if (Array.isArray(keys) && keys.length) map.set(field, new Set(keys.map(String)));
      }
    }
  } catch {
    /* تخزينٌ ممنوع أو تالف — يُبدأ من فراغ */
  }
  return map;
}

function writeTouched(): void {
  if (typeof window === "undefined") return;
  try {
    const out: Record<string, string[]> = {};
    for (const [field, keys] of touched) if (keys.size) out[field] = [...keys].slice(-5000);
    if (Object.keys(out).length) {
      window.localStorage.setItem(TOUCHED_KEY, JSON.stringify(out));
    } else {
      window.localStorage.removeItem(TOUCHED_KEY);
    }
  } catch {
    /* التخزين ممتلئ — والسجلّ يبقى لهذه الجلسة */
  }
}

const markTouched = (field: string, key: string): void => {
  const set = touched.get(field) ?? new Set<string>();
  if (set.has(key)) return;
  set.add(key);
  touched.set(field, set);
  writeTouched();
};

/**
 * آخرُ ما أبلغ به هذا الجهاز — **صورةً** لا مرجعاً.
 *
 * ولا يصحّ أن يكون مرجعاً إلى حالة الشاشة: من عدّل المصفوفة في موضعها
 * ثم أبلغ بها، قُورن الشيءُ بنفسه فلم يُعدّ تغييراً — فيضيع عملُه ولا
 * يُرسل. وأمسك هذا فحصُ المزامنة حين دفع حركةً في المصفوفة نفسها.
 */
let baseline: AppState | null = null;

/* ما بقي من جلسةٍ سابقةٍ لم يبلغ الخادم */
for (const [field, keys] of readTouched()) touched.set(field, keys);

/** يُقارن حالَ الشاشة بما أُبلغ به قبلُ، ويسجّل ما غيّره صاحبُ الجهاز */
function noteLocalEdits(after: AppState): void {
  const now = snapshotForServer(after);
  const before = baseline;
  baseline = now;
  /* جهازٌ لم يُبلّغ بحاله قطّ: ما فيه عملُه هو */
  if (!before) {
    for (const collection of ROW_COLLECTIONS) {
      const field = collection.field as string;
      for (const row of (now[collection.field] ?? []) as Record<string, unknown>[]) {
        markTouched(field, collection.keyOf(row));
      }
    }
    return;
  }
  const server = snapshot;
  for (const collection of ROW_COLLECTIONS) {
    const field = collection.field as string;
    const owned = collection.serverOwned;
    const was = new Map(
      ((before[collection.field] ?? []) as Record<string, unknown>[]).map((r) => [
        collection.keyOf(r),
        r,
      ])
    );
    const srv = new Map(
      ((server?.[collection.field] ?? []) as Record<string, unknown>[]).map((r) => [
        collection.keyOf(r),
        r,
      ])
    );
    for (const row of (now[collection.field] ?? []) as Record<string, unknown>[]) {
      const key = collection.keyOf(row);
      const before1 = was.get(key);
      /* لم يتغيّر هنا */
      if (before1 && same(comparable(before1, owned), comparable(row, owned))) continue;
      /* تغيّر، لكنه صار نسخةَ الخادم — فهو وارثٌ منه لا تغييرٌ محليّ */
      const atServer = srv.get(key);
      if (atServer && same(comparable(atServer, owned), comparable(row, owned))) continue;
      markTouched(field, key);
    }
  }
}

/** يُنسى ما أُرسل — فلا يُعاد إرساله بلا سبب */
function forgetTouched(upserts: Record<string, unknown[]> | undefined): void {
  if (!upserts) return;
  for (const [field, rows] of Object.entries(upserts)) {
    const collection = ROW_COLLECTIONS.find((c) => c.field === field);
    const set = touched.get(field);
    if (!collection || !set) continue;
    for (const row of rows) set.delete(collection.keyOf(row as Record<string, unknown>));
    if (set.size === 0) touched.delete(field);
  }
  writeTouched();
}

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

/**
 * ما ردّه الخادم، وصورةُ ما أُرسل منه.
 *
 * المردود لا يُحسب مرسَلاً — فيبقى في الفرق ظاهراً في المقارنة، ولا
 * يُظنّ محفوظاً عند الخادم. ولا يُعاد إرساله ما دام كما هو، وإلا دار
 * على الخادم كل ثوانٍ بلا فائدة. فإن غيّره صاحبه أو أُذن له، أُرسل.
 */
const refusedFields = new Map<string, string>();

/**
 * ما لا يقرؤه هذا الحساب — يقوله الخادم عند الاتصال.
 *
 * ولا يُرسل ما لا يُقرأ: المتصفّح يرى المجموعة فارغةً عنده لأنها حُجبت،
 * لا لأنها خالية عند الخادم. فلو حسب الفرق حساباً مجرّداً لدفع بما في
 * جهازه فوق ما لا يعلم، أو ظنّ نقصاً فأعاد إرسال ما لا يملك.
 */
let hidden = new Set<string>();

/**
 * أَلِهذا الجهاز نسخةٌ يدفع بها؟
 *
 * الحارس القديم يمنع الجهاز الفارغ من محو **الصفوف**: لا يُرسل حذفُ
 * صفٍّ لم يره. ولا يحمي ذلك المجموعات التي تُكتب كاملةً — دليل
 * الحسابات وبيانات الشركة وطرق الدفع والأسماء والأرصدة الافتتاحية —
 * فهذه تُرسل كما هي عند الجهاز. وعند جهازٍ فارغ هي قيمٌ افتراضية،
 * فيكتب فراغَه فوق عمل الشركة كلِّه، ولا حذفَ في ذلك ولا تنبيه.
 *
 * فلا يُرسل شيءٌ حتى يُعلن الجهاز أن عنده نسخة: إمّا نسخته المحفوظة،
 * وإمّا نسخةٌ أخذها من الخادم عند أول دخول.
 */
let owns = false;

/** يُعلن أن في الجهاز نسخةً حقيقية — فيُؤذن له بالإرسال */
export function markOwned(): void {
  owns = true;
}

export const ownsData = (): boolean => owns;

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

/**
 * المزامنة تعمل ما لم تُطفأ صراحةً.
 *
 * كانت مطفأةً حتى تُشعَل، ومفتاحها في شاشةٍ لا يفتحها إلا صاحب
 * الإعدادات. وذلك موافقٌ لزمنٍ كان الجهاز فيه هو المرجع والمزامنة
 * تجربة. فلمّا صار العمل على الخادم انقلب الحكم: من دخل بجهازٍ جديد
 * عمل يومه كلَّه ولم يصل عملُه، ولا مفتاح عنده ولا علم له.
 *
 * فصارت تعمل لكل من دخل، ويبقى الإطفاء بقرارٍ صريح من صاحب الإعدادات.
 */
export function syncEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(ENABLED_KEY) !== "off";
  } catch {
    /* لا تخزين — فلا إطفاء محفوظ، والأصل العمل */
    return true;
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
    hidden = new Set(
      Array.isArray(body?.hidden) ? (body.hidden as string[]).map(String) : []
    );
    publish({
      phase: "متزامنة",
      rev: Number(body?.rev) || 0,
      lastError: "",
      lastSyncAt: new Date().toISOString(),
    });
    /*
      وما عند الخادم ولم يصل الجهاز يُضمّ إليه الآن.

      يقع بعد نشر الحال، فالضمُّ ينشر عددَه فوقه. ولا يُنتظر به السحبُ
      التزايديّ: هو لا يرجع إلى ما مضى عن مؤشّره.
    */
    adoptFromSnapshot();

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
 * يضمّ إلى الجهاز ما عند الخادم وليس عنده.
 *
 * السحبُ تزايديّ: يسأل «ما بعد الرقم كذا». فإن سقط صفٌّ من الجهاز —
 * بتحميل نسخةٍ أقدم للمقارنة، أو بمسح بيانات المتصفّح، أو بحفظٍ أخفق —
 * ومضى المؤشّرُ عن رقمه، لم يعد إليه السحبُ أبداً. فيبقى الصفُّ على
 * الخادم لا بابَ له يدخل منه.
 *
 * وكانت القراءةُ الكاملة تقع في كل اتصال وتُستعمل **صورةً للمقارنة**
 * لا تُطبَّق على الشاشة — فيُعرَف الفرقُ ولا يُسَدّ.
 *
 * ووقع ذلك: كتب م. نوح مستحقّاً لأبي شمس (٦٠ د.ك · ٣ أكتوبر ٢٠٢٦)
 * فلم يصل جهاز صاحب الشركة، وسأل عنه فلم يجده في شاشة الاعتماد. وهو
 * الحركةُ الوحيدةُ التي تنتظر إقراراً في الدفاتر كلِّها، ولولا أن
 * عُدَّت الصفوفُ لما عُلم بغيابها.
 *
 * والضمُّ **يُضيف ولا يحذف ولا يكتب فوق شيء**، فهو آمنٌ دائماً. ويُستثنى
 * منه ما حذفه هذا الجهاز ولم يُرسل حذفَه بعد، وإلا بُعث ما دُفن.
 */
function adoptFromSnapshot(): number {
  if (!snapshot || !applier) return 0;
  if (!latest) {
    /* الشاشة لم تُبلّغ بحالتها بعد — يُنتظر أول حفظ */
    adoptWanted = true;
    return 0;
  }

  const tombs = readTombs();
  const upserts: Record<string, Record<string, unknown>[]> = {};
  let rows = 0;

  for (const collection of ROW_COLLECTIONS) {
    const field = collection.field as string;
    /* ما لا يُقرأ لا يُضمّ: المجموعة المحجوبة تصل فارغةً فلا تُحسب نقصاً */
    if (hidden.has(field)) continue;

    const here = new Map(
      ((latest[collection.field] ?? []) as Record<string, unknown>[]).map((r) => [
        collection.keyOf(r),
        r,
      ])
    );
    const buried = new Set(tombs[field] ?? []);
    const mine = touched.get(field);
    const owned = collection.serverOwned;
    const gained = (
      (snapshot[collection.field] ?? []) as Record<string, unknown>[]
    ).filter((r) => {
      const key = collection.keyOf(r);
      if (buried.has(key)) return false;
      /* ما لم يمسّه صاحبُ الجهاز يُؤخذ من الخادم — غائباً كان أو قديماً */
      if (mine?.has(key)) return false;
      const local = here.get(key);
      if (!local) return true;
      return !same(comparable(local, owned), comparable(r, owned));
    });
    if (gained.length > 0) {
      upserts[field] = gained;
      rows += gained.length;
    }
  }

  if (rows === 0) return 0;
  applier({ upserts, deletes: {}, rev: status.rev });
  publish({ adopted: status.adopted + rows });
  return rows;
}

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
  /*
    ما غيّره صاحبُ الجهاز يُسجَّل قبل أن يصير `latest` هو الماضي.

    وإن لم يكن ثمّة أساس — جهازٌ لم يُحمّل شيئاً ولم يُبلّغ بحاله قطّ —
    فما فيه عملُه هو، فيُعدّ كلُّه ممسوساً. وإلا ضاع عملُ من بدأ على
    جهازٍ فارغ.
  */
  noteLocalEdits(state);
  latest = state;
  remember(state);
  /* ضمٌّ طُلب قبل أن تُعرَف الحالة — الآن تُعرف */
  if (adoptWanted) {
    adoptWanted = false;
    adoptFromSnapshot();
  }
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
export const rememberLoaded = (state: AppState): void => {
  remember(state);
  /*
    وهو خطُّ البدء لما يُعدّ عملاً محلياً.

    ما حُمّل من المخزن ليس تغييراً من صاحب الجهاز، فلا يُرسل منه شيء
    حتى يمسّه. ولولا تثبيتُه هنا لعُدّ أوّلُ حفظٍ بعد الفتح بلا أساسٍ
    يُقاس عليه.
  */
  latest = state;
  baseline = snapshotForServer(state);
};

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

  /*
    لا يُرسل إلا ما مسَّه صاحبُ هذا الجهاز.

    والفرقُ بين الجهاز والخادم ليس دليلَ تغييرٍ محليّ: قد يكون الخادمُ
    تقدّم بعمل غيرك ونسختُك هي القديمة. فإرسالُ كلِّ فرقٍ يكتب القديمَ
    فوق الجديد — وبه مُحي تسعةَ عشرَ إقراراً في ١٨ أكتوبر ٢٠٢٦.
  */
  for (const [field, rows] of Object.entries(changes.upserts ?? {})) {
    const collection = ROW_COLLECTIONS.find((c) => c.field === field);
    if (!collection) continue;
    const mine = touched.get(field);
    const kept = (rows as Record<string, unknown>[]).filter((row) =>
      mine?.has(collection.keyOf(row))
    );
    if (kept.length) (changes.upserts as Record<string, unknown[]>)[field] = kept;
    else delete (changes.upserts as Record<string, unknown[]>)[field];
  }
  if (changes.upserts && Object.keys(changes.upserts).length === 0) {
    delete changes.upserts;
  }

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
  /*
    جهازٌ بلا نسخة لا يُرسل: ما عنده قيمٌ افتراضية لا بيانات، وإرسالها
    كتابةٌ للفراغ فوق العمل. ويُرفع المنع متى أخذ نسخته من الخادم.
  */
  if (!owns) {
    publish({ phase: "متزامنة", pending: 0 });
    return;
  }

  const state = latest;
  const changes = sendable(snapshot, state);

  /*
    ما لا يقرؤه صاحب الجهاز لا يُرسل — وليس نقصاً عنده بل حجاباً.

    ويُستثنى **ما يُضاف إلى سجلّ التدقيق**: المهندس لا يقرأ السجلّ،
    فكان جهازُه لا يرسل قيوده — فلا أثرَ لعمله فيه البتّة. ولا يُقرأ
    سجلُّ التدقيق ليُعرف عملُ كاتبه وحده، بل ليُعرف عملُ الناس كلِّهم،
    فمن لا يُكتب فيه كأنه لم يعمل. وسأل صاحب الشركة: «دخلتُ التدقيق ولم
    يظهر لي أن نوحاً أدخل أي عملية» — ولم يكن في السجلّ منه قيدٌ واحد
    منذ فُتح النظام.

    والإضافةُ آمنة: السجلّ لا يُحذف منه شيء عند الخادم، والحذفُ منه
    مردودٌ على الجميع ولو كان المالك. فيُرسل ما يُضاف، ولا يُرسل حذف.
  */
  const sendsAnyway = (part: string, field: string) =>
    part === "upserts" && field === "audit";

  for (const part of ["upserts", "deletes", "whole"] as const) {
    const group = changes[part];
    if (!group) continue;
    for (const field of Object.keys(group)) {
      if (hidden.has(field) && !sendsAnyway(part, field)) {
        delete (group as Record<string, unknown>)[field];
      }
    }
    if (Object.keys(group).length === 0) delete changes[part];
  }

  /* ما رُدّ ولم يتغيّر لا يُعاد إرساله — ويبقى ظاهراً في المقارنة */
  for (const part of ["upserts", "deletes", "whole"] as const) {
    const group = changes[part];
    if (!group) continue;
    for (const field of Object.keys(group)) {
      const sent = JSON.stringify((group as Record<string, unknown>)[field]);
      if (refusedFields.get(field) === sent) {
        delete (group as Record<string, unknown>)[field];
      } else if (refusedFields.has(field)) {
        refusedFields.delete(field);
      }
    }
    /* القسم الفارغ يُحذف: وجوده وحده يُحسب إرسالاً فتُبعث دفعةٌ خاوية */
    if (Object.keys(group).length === 0) delete changes[part];
  }

  if (isEmpty(changes)) {
    publish({ phase: "متزامنة", pending: countChanges(sendable(snapshot, state)) });
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

    /*
      الخادم يكتب ما جاز ويردّ ما لا يجوز. فالمردود يُستثنى من الصورة:
      يبقى حقلُه كما كان عند الخادم، فيظهر في المقارنة ولا يُظنّ محفوظاً.
    */
    const refused = Array.isArray(body?.refused)
      ? (body.refused as SyncStatus["refused"])
      : [];
    /*
      ما بلغ الخادمَ يُنسى — والمردودُ يبقى ممسوساً ليُعاد.

      فلو نُسي المردودُ مع المقبول لما أُرسل ثانيةً أبداً، ولظهر «لا شيء
      في الانتظار» وعملُ صاحبه في جهازه وحده.
    */
    const refusedNames = new Set(refused.map((r) => r.field));
    const written = Object.fromEntries(
      Object.entries(changes.upserts ?? {}).filter(([f]) => !refusedNames.has(f))
    );
    forgetTouched(written as Record<string, unknown[]>);

    const next = snapshotForServer(state);
    for (const item of refused) {
      const sent =
        changes.upserts?.[item.field] ??
        changes.deletes?.[item.field] ??
        changes.whole?.[item.field];
      refusedFields.set(item.field, JSON.stringify(sent));
      if (snapshot) {
        (next as unknown as Record<string, unknown>)[item.field] = (
          snapshot as unknown as Record<string, unknown>
        )[item.field];
      }
    }
    snapshot = next;
    forgetDeletes(changes.deletes);
    backoff = RETRY_MIN_MS;
    publish({
      phase: "متزامنة",
      /* الرقم لا يتراجع: ردٌّ متأخّر قد يحمل رقماً أقدم مما سُحب */
      rev: Math.max(Number(body?.rev) || 0, status.rev),
      pending: countChanges(sendable(snapshot, state)),
      lastError: "",
      lastSyncAt: new Date().toISOString(),
      renumbered: Array.isArray(body?.renumbered)
        ? (body.renumbered as SyncStatus["renumbered"])
        : [],
      refused,
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
 * يضمّ الزائد على الخادم إلى الجهاز — بطلبٍ صريح.
 *
 * يُقرأ الخادم من جديد ثم يُضمّ ما ليس في الجهاز. ويُنادى من شاشة
 * المقارنة حين يُظهر التقرير زيادةً، فهو البابُ المقابل للحذف: أحدهما
 * يُسلّم للخادم والآخر يُسلّم للجهاز، ولا يُقال «زائد» إلا ويُسأل:
 * أيُّهما أحدثُ عهداً بالحقيقة؟
 */
export async function adoptExtra(local: AppState): Promise<number> {
  snapshot = await fetchServerState();
  latest = local;
  return adoptFromSnapshot();
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

/**
 * تُوقَف عند الخروج — بلا إطفاءٍ محفوظ.
 *
 * من خرج لا جلسة له، فكلُّ طلبٍ بعدها يُردّ. والفرق بين هذا وبين
 * الإطفاء أن ذاك قرارٌ يبقى، وهذا وقفٌ إلى أن يدخل الداخل التالي.
 */
export function stopSync(): void {
  if (pullTimer) clearTimeout(pullTimer);
  pullTimer = null;
  if (timer) clearTimeout(timer);
  timer = null;
  snapshot = null;
  publish({ enabled: false, phase: "مطفأة", pending: 0, refused: [] });
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
