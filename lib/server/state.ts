/**
 * قراءة حالة النظام من قاعدة البيانات.
 *
 * أول لبنة في نقل النظام إلى الخادم: قبل أي مسار API وقبل أي تغيير
 * في الشاشات، يجب أن يُثبَت أن القاعدة تحفظ بيانات الشركة وتعيدها
 * كما دخلت. فما لا يعود كما دخل يضيع صامتاً، ولا يُكتشف إلا بعد
 * شهور حين يُسأل عن رقم فلا يوجد.
 *
 * ولذلك تُقرأ الصفوف من عمود data الذي يحمل كائن التطبيق كاملاً، لا
 * من الأعمدة المسمّاة. والأعمدة موجودة للاستعلام والفهرسة والقيود —
 * وهي نسخةٌ من data لا مصدرٌ له. فحقلٌ يُضاف إلى النوع في التطبيق
 * ينتقل بلا تعديل مخطّط، ولا يتكرّر ما وقع مرتين: «مورّد» طُوي في
 * «مقاول»، وتاريخ الانتهاء لم يكن له عمود.
 *
 * والمخرَج AppState نفسها التي يقرؤها التطبيق من المتصفّح اليوم،
 * فيكون التحويل تبديلَ مصدرٍ لا إعادةَ كتابة.
 */

import type { AppState } from "../storage";
import { normalizeState } from "../storage";

/** ما يكفي من واجهة pg — وتقبل PGlite أيضاً، فيُفحص النقل محلياً */
export type Queryable = {
  query: (
    text: string,
    values?: unknown[]
  ) => Promise<{ rows: Record<string, unknown>[] }>;
};

const str = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown): number => (v == null ? 0 : Number(v));

const asJson = <T>(v: unknown, fallback: T): T => {
  if (v == null) return fallback;
  if (typeof v === "string") {
    try {
      return JSON.parse(v) as T;
    } catch {
      return fallback;
    }
  }
  return v as T;
};

/** صفوف جدول، كائناتُ التطبيق كما حُفظت */
async function objects<T>(
  db: Queryable,
  table: string,
  order: string
): Promise<T[]> {
  const { rows } = await db.query(
    `SELECT data FROM ${table} ORDER BY ${order}`
  );
  return rows
    .map((r) => asJson<T | null>(r.data, null))
    .filter((o): o is T => o != null && Object.keys(o as object).length > 0);
}

export async function readState(db: Queryable): Promise<AppState> {
  /*
    تُجمع البيانات خاماً ثم تمرّ من مسوّي التطبيق نفسه. فلو سوّى
    الخادم بطريقته لظهر فرقٌ بين ما يراه المتصفّح وما يراه الخادم
    — حقلٌ اختياري هنا وقيمةٌ افتراضية هناك — ولا يكشفه إلا عملٌ
    يتعطّل بعد شهور.
  */
  const state: Record<string, unknown> = {};

  /* ---- ما يُحفظ كائناتٍ كاملة ---- */
  state.movements = await objects(db, "movements", "entry_no, id");
  state.projects = await objects(db, "projects", "name");
  state.contractors = await objects(db, "contracts", "contract_number");
  state.materials = await objects(db, "materials", "name");
  state.materialReceipts = await objects(db, "material_receipts", "receipt_date, id");
  state.users = await objects(db, "users", "name");
  state.employees = await objects(db, "employees", "name");
  state.attendance = await objects(db, "attendance", "day, employee_id");
  state.payrollRuns = await objects(db, "payroll_runs", "month");
  state.workItems = await objects(db, "work_items", "stage, section, name");
  state.quotations = await objects(db, "quotations", "number");
  state.invoices = await objects(db, "invoices", "number");
  state.audit = await objects(db, "audit_log", "at DESC");

  /* ---- البيانات الأساسية: أعمدتها هي النوع نفسه ---- */
  state.chart = (
    await db.query("SELECT * FROM accounts ORDER BY sort_order, code")
  ).rows.map((r) => ({
    code: str(r.code),
    name: str(r.name),
    parent: str(r.parent),
    type: str(r.type),
    nature: str(r.nature),
    level: num(r.level),
    statement: str(r.statement),
    active: r.active !== false,
    postable: r.postable !== false,
  }));

  state.items = (await db.query("SELECT * FROM items ORDER BY sort_order, code")).rows.map(
    (r) => ({ code: str(r.code), name: str(r.name), account: str(r.account) })
  );

  state.payments = (
    await db.query("SELECT * FROM payment_methods ORDER BY sort_order, label")
  ).rows.map((r) => ({ label: str(r.label), account: str(r.account) }));

  state.people = (
    await db.query("SELECT name FROM people ORDER BY sort_order, name")
  ).rows.map((r) => str(r.name));

  /* ---- صفٌّ واحد ---- */
  const [company] = (await db.query("SELECT * FROM company WHERE id = 1")).rows;
  if (company) {
    state.company = {
      name: str(company.name),
      nameEn: str(company.name_en),
      logo: str(company.logo),
      address: str(company.address),
      phone: str(company.phone),
      email: str(company.email),
      crNumber: str(company.cr_number),
      approvalThreshold: num(company.approval_threshold),
      backupEveryDays: num(company.backup_every_days),
    };
  }

  const [settings] = (
    await db.query("SELECT data FROM payroll_settings WHERE id = 1")
  ).rows;
  if (settings) {
    state.payrollSettings = asJson(settings.data, {});
  }

  /* ---- خرائط مفتاحُها السنة ---- */
  const opening: Record<string, Record<string, unknown>> = {};
  for (const r of (await db.query("SELECT * FROM opening_balances")).rows) {
    const year = str(r.fiscal_year);
    (opening[year] ??= {})[str(r.account_code)] = {
      debit: num(r.debit) ? String(num(r.debit)) : "",
      credit: num(r.credit) ? String(num(r.credit)) : "",
    };
  }
  state.openingBalances = opening;

  const locks: Record<string, unknown> = {};
  for (const r of (await db.query("SELECT * FROM year_locks")).rows) {
    locks[str(r.fiscal_year)] = {
      closedAt: r.closed_at instanceof Date ? r.closed_at.toISOString() : str(r.closed_at),
      closedBy: str(r.closed_by),
      note: str(r.note),
    };
  }
  state.yearLocks = locks;

  return normalizeState(state);
}
