/**
 * ما الذي تغيّر بين حالتين.
 *
 * هذه هي التي تجعل التشغيل المتوازي ممكناً: المتصفّح يحتفظ بصورةٍ ممّا
 * عند الخادم، فإذا حفظ حسب الفرق وأرسله وحده. فلا تُرسل ألفٌ وأربعمئة
 * حركة في كل حفظ، ولا يُمحى عملُ من حفظ قبله.
 *
 * وهي دالّة صِرفة: حالتان تدخلان ووصفُ فرقٍ يخرج، بلا شبكة ولا قاعدة.
 * فتُفحص وحدها، وما يُفحص وحده يُوثق به.
 */

import { ROW_COLLECTIONS, WHOLE_FIELDS } from "./collections";
import { normalizeState, type AppState } from "./storage";

type Row = Record<string, unknown>;

export type ChangeSet = {
  upserts?: Record<string, Row[]>;
  deletes?: Record<string, string[]>;
  whole?: Record<string, unknown>;
};

/**
 * نصٌّ واحد للكائن مهما اختلف ترتيب مفاتيحه.
 *
 * فالكائن نفسه قد يُبنى بترتيبين — مرّةً من النموذج ومرّةً من القاعدة —
 * فيختلف نصّه ويُظنّ أنه تغيّر. ولو ظُنّ ذلك لأُرسلت الحالة كلها في كل
 * حفظ، وعاد ما فُرَّ منه.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";

  const entries = Object.entries(value as Row)
    /* undefined لا يُكتب في JSON، فوجودُه وغيابُه سواء */
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return "{" + entries.map(([k, v]) => JSON.stringify(k) + ":" + canonical(v)).join(",") + "}";
}

export const same = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);

/**
 * الصفّ كما يُقارَن — بلا ما يملكه الخادم.
 *
 * تجزئة كلمة المرور تبقى في المتصفّح كما كانت يوم استُنسخ المستخدم،
 * ويغيّرها صاحبها على الخادم. فلو دخلت المقارنة لبقي سطر المستخدمين
 * مختلفاً أبداً — وهو ليس اختلافاً في البيانات بل في ملكيّة الحقل.
 */
const comparable = (row: Row, owned?: string[]): Row => {
  if (!owned || owned.length === 0) return row;
  const copy: Row = { ...row };
  for (const key of owned) delete copy[key];
  return copy;
};

/** خريطة المفتاح إلى الصفّ — وآخر المتكرّرين يغلب، كما في القاعدة */
function byKey(rows: unknown[], keyOf: (r: Row) => string): Map<string, Row> {
  const map = new Map<string, Row>();
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const key = keyOf(row as Row);
    if (key) map.set(key, row as Row);
  }
  return map;
}

/**
 * ما سيصير إليه الصفّ عند الخادم.
 *
 * الخادم يمرّ بكل ما يقرؤه على normalizeState، فيملأ ما نقص بقيمه
 * المعتادة. فلو قُورن ما في المتصفّح بما عند الخادم كما هو لظهر كل صفٍّ
 * أُنشئ حديثاً «مختلفاً» أبداً: الخادم أتمّه والمتصفّح لم يُتمّه بعد.
 *
 * فيُمرّ الطرفان على الدالّة نفسها قبل المقارنة. وهي التي أخرجت هذا:
 * موظفٌ يُضاف من الشاشة ينقصه حقلٌ أو حقلان ممّا تملؤه الترقية.
 */
const asStored = (state: AppState): AppState => normalizeState(state);

/**
 * صورةُ ما أُرسل، يحفظها المتصفّح بعد نجاح الإرسال.
 *
 * ولا يحفظ حالته هو: بينهما فرقُ ما تملؤه الترقية، فلو حفظ حالته لظلّ
 * يرى فرقاً في كل حفظ فيعيد إرسال الصفوف نفسها إلى الأبد.
 */
export const snapshotForServer = (state: AppState): AppState => asStored(state);

/**
 * الفرق بين صورةٍ قديمة وحالةٍ جديدة.
 *
 * before: ما عند الخادم كما يعرفه المتصفّح.
 * after:  ما عند المتصفّح الآن.
 */
export function diffStates(before: AppState, rawAfter: AppState): ChangeSet {
  const after = asStored(rawAfter);
  const upserts: Record<string, Row[]> = {};
  const deletes: Record<string, string[]> = {};
  const whole: Record<string, unknown> = {};

  for (const collection of ROW_COLLECTIONS) {
    const field = collection.field as string;
    const old = byKey((before[collection.field] ?? []) as unknown[], collection.keyOf);
    const now = byKey((after[collection.field] ?? []) as unknown[], collection.keyOf);

    const changed: Row[] = [];
    for (const [key, row] of now) {
      const previous = old.get(key);
      const owned = collection.serverOwned;
      if (!previous || !same(comparable(previous, owned), comparable(row, owned))) {
        changed.push(row);
      }
    }
    if (changed.length) upserts[field] = changed;

    const gone: string[] = [];
    for (const key of old.keys()) {
      if (!now.has(key)) gone.push(key);
    }
    if (gone.length) deletes[field] = gone;
  }

  for (const field of WHOLE_FIELDS) {
    if (!same(before[field], after[field])) whole[field] = after[field];
  }

  const result: ChangeSet = {};
  if (Object.keys(upserts).length) result.upserts = upserts;
  if (Object.keys(deletes).length) result.deletes = deletes;
  if (Object.keys(whole).length) result.whole = whole;
  return result;
}

/** لا شيء يُرسل: الحفظ لم يغيّر شيئاً ممّا يعني الخادم */
export const isEmpty = (changes: ChangeSet): boolean =>
  !changes.upserts && !changes.deletes && !changes.whole;

/** عدد الصفوف في مجموعة التغييرات — للعرض على المستخدم لا أكثر */
export function countChanges(changes: ChangeSet): number {
  let n = 0;
  for (const rows of Object.values(changes.upserts ?? {})) n += rows.length;
  for (const ids of Object.values(changes.deletes ?? {})) n += ids.length;
  n += Object.keys(changes.whole ?? {}).length;
  return n;
}

/* ------------------------------------------------------------------ */
/* المقارنة                                                            */
/* ------------------------------------------------------------------ */

export type FieldComparison = {
  field: string;
  /** عدد الصفوف في كل جانب */
  local: number;
  server: number;
  /** صفوف عند المتصفّح ولا وجود لها عند الخادم */
  missing: string[];
  /** صفوف عند الخادم ولا وجود لها عند المتصفّح */
  extra: string[];
  /** صفوف موجودة في الجانبين ومحتواها مختلف */
  different: string[];
  agree: boolean;
};

/**
 * تقرير المقارنة اليومية.
 *
 * في التشغيل المتوازي لا يُنتقل إلى الخادم بالثقة بل بالبرهان: تُقارَن
 * النسختان كل يوم، فإن تطابقتا أياماً متتالية نُقل. وما دام في التقرير
 * سطرٌ أحمر فالمتصفّح هو المرجع ولا يُنقل شيء.
 */
export function compareStates(
  rawLocal: AppState,
  server: AppState
): { fields: FieldComparison[]; agree: boolean } {
  const local = asStored(rawLocal);
  const fields: FieldComparison[] = [];

  for (const collection of ROW_COLLECTIONS) {
    const field = collection.field as string;
    const here = byKey((local[collection.field] ?? []) as unknown[], collection.keyOf);
    const there = byKey((server[collection.field] ?? []) as unknown[], collection.keyOf);

    const missing: string[] = [];
    const different: string[] = [];
    for (const [key, row] of here) {
      const other = there.get(key);
      const owned = collection.serverOwned;
      if (!other) missing.push(key);
      else if (!same(comparable(row, owned), comparable(other, owned))) {
        different.push(key);
      }
    }

    const extra: string[] = [];
    for (const key of there.keys()) if (!here.has(key)) extra.push(key);

    fields.push({
      field,
      local: here.size,
      server: there.size,
      missing,
      extra,
      different,
      agree: missing.length === 0 && extra.length === 0 && different.length === 0,
    });
  }

  for (const field of WHOLE_FIELDS) {
    const agree = same(local[field], server[field]);
    fields.push({
      field,
      local: 1,
      server: 1,
      missing: [],
      extra: [],
      different: agree ? [] : ["—"],
      agree,
    });
  }

  return { fields, agree: fields.every((f) => f.agree) };
}
