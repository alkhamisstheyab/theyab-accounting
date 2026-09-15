/**
 * هُويّة المجموعات: ما الذي يُعدّ صفّاً، وبأي مفتاح يُعرف.
 *
 * يعرفه الطرفان: المتصفّح ليحسب ما تغيّر، والخادم ليعرف أين يكتبه. ولو
 * كُتب في موضعين لاختلفا يوماً — فيرسل المتصفّح صفّاً بمفتاح ويكتبه
 * الخادم بمفتاحٍ آخر، فيتضاعف الصفّ ولا يُدرى أيّهما الصحيح.
 *
 * وأعمدة SQL ليست هنا: تلك شأن الخادم وحده، في lib/server/collections.ts.
 */

import type { AppState } from "./storage";

type Row = Record<string, unknown>;

export type RowCollection = {
  /** مفتاح المجموعة في AppState */
  field: keyof AppState;
  /** مفتاح الصفّ — نصٌّ يميّزه عن إخوته ولا يتغيّر بتعديله */
  keyOf: (row: Row) => string;
};

const str = (v: unknown): string => (v == null ? "" : String(v));

/**
 * المجموعات التي تُكتب صفّاً صفّاً.
 *
 * وأكثرها مفتاحه id، إلا الدوام: مفتاحه الموظف واليوم، فاليوم الواحد
 * لا يتكرّر للموظف الواحد ولا معنى لمعرّفٍ ثانٍ له.
 */
export const ROW_COLLECTIONS: RowCollection[] = [
  { field: "movements", keyOf: (m) => str(m.id) },
  { field: "projects", keyOf: (p) => str(p.id) },
  { field: "contractors", keyOf: (c) => str(c.id) },
  { field: "materials", keyOf: (m) => str(m.id) },
  { field: "materialReceipts", keyOf: (r) => str(r.id) },
  { field: "users", keyOf: (u) => str(u.id) },
  { field: "employees", keyOf: (e) => str(e.id) },
  { field: "attendance", keyOf: (a) => str(a.employeeId) + "|" + str(a.date) },
  { field: "payrollRuns", keyOf: (r) => str(r.id) },
  { field: "workItems", keyOf: (w) => str(w.id) },
  { field: "quotations", keyOf: (q) => str(q.id) },
  { field: "invoices", keyOf: (i) => str(i.id) },
  { field: "audit", keyOf: (a) => str(a.id) },
];

/**
 * المجموعات التي تُكتب كاملةً لا صفّاً صفّاً.
 *
 * هي صغيرة ونادرة التغيير ويحرّرها واحد: دليل الحسابات والبنود وطرق
 * الدفع والأشخاص وبيانات الشركة وإعدادات الرواتب والأرصدة الافتتاحية
 * وإقفال السنوات. فالكتابة الكاملة فيها لا تصطدم بأحد.
 */
export const WHOLE_FIELDS = [
  "chart",
  "items",
  "payments",
  "people",
  "company",
  "payrollSettings",
  "openingBalances",
  "yearLocks",
] as const;

/** أنواع الأطراف الثلاثة — والرابع غير موجود، فما خرج عنها مقاول */
export const COUNTERPARTY_TYPES = ["عميل", "مقاول", "مورّد"];

export const rowCollection = (field: string): RowCollection | undefined =>
  ROW_COLLECTIONS.find((c) => c.field === field);

/**
 * كل حقول الحالة مقسومةٌ بين النوعين.
 *
 * وبها يُفحص أن أحداً لم يُنسَ: حقلٌ يُضاف إلى AppState ولا يُذكر هنا
 * لا يصل الخادم أبداً — ولا يظهر ذلك إلا بعد شهور حين يُسأل عن رقمٍ
 * فلا يوجد. وقد وقع مثله ثلاث مرات قبل هذا.
 */
export const ALL_FIELDS: (keyof AppState)[] = [
  ...ROW_COLLECTIONS.map((c) => c.field),
  ...(WHOLE_FIELDS as readonly string[] as (keyof AppState)[]),
];
