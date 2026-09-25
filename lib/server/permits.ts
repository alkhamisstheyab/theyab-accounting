/**
 * مَن يكتب ماذا.
 *
 * ما دامت البيانات في المتصفّح كانت الصلاحيات إخفاءً للأزرار: من يفتح
 * أدوات المطوّر يتجاوزها. وهنا تصير حقيقية — الطلب يُرفض على الخادم،
 * فلا ينفع تجاوز الواجهة.
 *
 * والرفض كلّي: مجموعة التغييرات تُكتب كلها أو لا يُكتب منها شيء، فلو
 * جاز أن يُقبل بعضها لأمكن أن تُحفظ حركةٌ ويُرفض سجل تدقيقها.
 */

import type { Permission } from "../permissions";

type Rule = {
  /** ما يلزم لإضافة صفّ أو تعديله — واحدة منها تكفي */
  write: Permission[];
  /** ما يلزم لحذفه */
  remove: Permission[];
};

/**
 * سجل التدقيق يُكتب ولا يُحذف ولا يُعدَّل: هو الشاهد على البقية، وشاهدٌ
 * يُمحى لا شهادة فيه. فالكتابة مفتوحة لكل داخل، والحذف مغلق على الجميع.
 */
const RULES: Record<string, Rule> = {
  movements: {
    write: ["movements.create", "movements.edit"],
    remove: ["movements.delete"],
  },
  projects: { write: ["projects.manage"], remove: ["projects.manage"] },
  contractors: {
    write: ["contractors.manage"],
    remove: ["contractors.manage"],
  },
  materials: { write: ["materials.manage"], remove: ["materials.manage"] },
  materialReceipts: {
    write: ["materials.manage"],
    remove: ["materials.manage"],
  },
  users: { write: ["users.manage"], remove: ["users.manage"] },
  employees: { write: ["employees.manage"], remove: ["employees.manage"] },
  attendance: { write: ["attendance.manage"], remove: ["attendance.manage"] },
  payrollRuns: { write: ["payroll.run"], remove: ["payroll.run"] },
  workItems: { write: ["quotations.manage"], remove: ["quotations.manage"] },
  quotations: { write: ["quotations.manage"], remove: ["quotations.manage"] },
  invoices: { write: ["invoices.manage"], remove: ["invoices.manage"] },
  audit: { write: [], remove: [] },

  /* المجموعات التي تُكتب كاملةً */
  chart: { write: ["chart.manage"], remove: ["chart.manage"] },
  items: { write: ["chart.manage"], remove: ["chart.manage"] },
  payments: { write: ["settings.manage"], remove: ["settings.manage"] },
  people: { write: ["settings.manage"], remove: ["settings.manage"] },
  company: { write: ["settings.manage"], remove: ["settings.manage"] },
  payrollSettings: { write: ["payroll.run"], remove: ["payroll.run"] },
  openingBalances: { write: ["opening.manage"], remove: ["opening.manage"] },
  yearLocks: { write: ["year.close"], remove: ["year.close"] },
};

/** الحذف من سجل التدقيق ممنوع على الجميع، ولو كان المالك */
const NEVER_DELETED = new Set(["audit"]);

export type ChangeShape = {
  upserts?: Record<string, unknown[]>;
  deletes?: Record<string, string[]>;
  whole?: Record<string, unknown>;
};

/**
 * يعيد سبب الرفض، أو null إن كان كل ما في الطلب مأذوناً به.
 *
 * والسبب يُذكر بالاسم: «ليست لديك صلاحية حذف حركة» أنفع من «ممنوع»،
 * فيعرف الموظف ما يطلبه من المدير بدل أن يظنّ النظام معطّلاً.
 */
export function refusalReason(
  changes: ChangeShape,
  permissions: readonly Permission[]
): string | null {
  const has = (needed: Permission[]) =>
    needed.length === 0 || needed.some((p) => permissions.includes(p));

  for (const field of Object.keys(changes.upserts ?? {})) {
    const rule = RULES[field];
    if (!rule) return `مجموعة غير معروفة: ${field}`;
    if (!has(rule.write)) return `ليست لديك صلاحية الكتابة في «${field}»`;
  }

  for (const field of Object.keys(changes.deletes ?? {})) {
    if (NEVER_DELETED.has(field)) return "سجل التدقيق لا يُحذف منه شيء";
    const rule = RULES[field];
    if (!rule) return `مجموعة غير معروفة: ${field}`;
    if (!has(rule.remove)) return `ليست لديك صلاحية الحذف من «${field}»`;
  }

  for (const field of Object.keys(changes.whole ?? {})) {
    const rule = RULES[field];
    if (!rule) return `مجموعة غير معروفة: ${field}`;
    if (!has(rule.write)) return `ليست لديك صلاحية تعديل «${field}»`;
  }

  return null;
}

/** مجموعةٌ رُدّت، ولمَ رُدّت — تُعرض على صاحبها بلغته */
export type Refusal = { field: string; reason: string };

/**
 * يفرز الطلب: ما يجوز يُكتب، وما لا يجوز يُردّ باسمه.
 *
 * كان الطلب يُرفض كلّه لصفٍّ واحدٍ فيه. وذلك سليمٌ ما دام الكاتب واحداً
 * يرى الرسالة أمامه، وقاتلٌ يوم يعمل عليه عشرة: يكفي صفٌّ قديمٌ في
 * جهاز السكرتيرة ليقف رفعُ عملها كلَّه — لا تُدخل حركةً إلا بقيت في
 * جهازها، ولا تعلم لمَ.
 *
 * فصار المأذون يُكتب، والمردود يُردّ ومعه سببه، فيعرف صاحبه ما يطلبه من
 * المدير. والفرز بالمجموعة لا بالصفّ: الصلاحية على المجموعة أصلاً، فلا
 * معنى لتفصيلٍ أدقّ.
 *
 * والذرّية باقية فيما يُكتب: ما جاز يُكتب كلُّه أو لا يُكتب منه شيء.
 */
export function allowedChanges(
  changes: ChangeShape,
  permissions: readonly Permission[]
): { allowed: ChangeShape; refused: Refusal[] } {
  const has = (needed: Permission[]) =>
    needed.length === 0 || needed.some((p) => permissions.includes(p));

  const allowed: ChangeShape = {};
  const refused: Refusal[] = [];
  const seen = new Set<string>();
  const refuse = (field: string, reason: string) => {
    if (seen.has(field)) return;
    seen.add(field);
    refused.push({ field, reason });
  };

  for (const [field, rows] of Object.entries(changes.upserts ?? {})) {
    const rule = RULES[field];
    if (!rule) refuse(field, `مجموعة غير معروفة: ${field}`);
    else if (!has(rule.write)) refuse(field, `ليست لديك صلاحية الكتابة في «${field}»`);
    else (allowed.upserts ??= {})[field] = rows;
  }

  for (const [field, ids] of Object.entries(changes.deletes ?? {})) {
    const rule = RULES[field];
    if (NEVER_DELETED.has(field)) refuse(field, "سجل التدقيق لا يُحذف منه شيء");
    else if (!rule) refuse(field, `مجموعة غير معروفة: ${field}`);
    else if (!has(rule.remove)) refuse(field, `ليست لديك صلاحية الحذف من «${field}»`);
    else (allowed.deletes ??= {})[field] = ids;
  }

  for (const [field, value] of Object.entries(changes.whole ?? {})) {
    const rule = RULES[field];
    if (!rule) refuse(field, `مجموعة غير معروفة: ${field}`);
    else if (!has(rule.write)) refuse(field, `ليست لديك صلاحية تعديل «${field}»`);
    else (allowed.whole ??= {})[field] = value;
  }

  return { allowed, refused };
}

/** أفي الطلب ما يُكتب؟ */
export const nothingToWrite = (changes: ChangeShape): boolean =>
  Object.keys(changes.upserts ?? {}).length === 0 &&
  Object.keys(changes.deletes ?? {}).length === 0 &&
  Object.keys(changes.whole ?? {}).length === 0;

/* ------------------------------------------------------------------ */
/* مَن يقرأ ماذا                                                       */
/* ------------------------------------------------------------------ */

/**
 * منع الكتابة وحده لا يكفي.
 *
 * كان الخادم يُرسل الحالة كلها لكل من دخل، والشاشات تُخفي ما لا يعنيه.
 * وذلك إخفاءٌ لا منع: ما وصل الجهاز صار عند صاحبه، يقرؤه من أدوات
 * المطوّر متى شاء. فالسكرتيرة كانت تصلها الرواتب، والمهندس تصله
 * أرصدة البنك — وإن لم تظهر لهما على الشاشة.
 *
 * فصار ما لا يُقرأ لا يُرسَل.
 *
 * والفارغ هنا مفتوحٌ لكل من دخل: دليل الحسابات وطرق الدفع وبيانات
 * الشركة والأسماء — بها تُقرأ الحركات وتُطبع الأوراق، وليس فيها ما
 * يُخفى.
 */
const READ_RULES: Record<string, Permission[]> = {
  /*
    الحركات تصل الجميع كما كانت — قرارُ صاحب الشركة. فالمهندس يرى
    المدفوع على عقوده، والمدفوع يُحسب منها. ولو حُجبت عنه لرأى عقوده
    بلا أرقام.
  */
  movements: [
    "movements.view",
    "journal.view",
    "ledger.view",
    "contractors.view",
    "projects.view",
  ],
  projects: ["projects.view", "projects.manage"],
  contractors: ["contractors.view", "contractors.manage"],
  materials: ["materials.view", "materials.manage"],
  materialReceipts: ["materials.view", "materials.manage"],
  workItems: ["quotations.view", "quotations.pricing"],
  quotations: ["quotations.view", "quotations.manage"],
  invoices: ["invoices.view", "invoices.manage"],

  /* ملفّ الموظف: راتبه وسلفه وحضوره — لا يخرج من دائرة من يليه */
  employees: ["employees.view", "employees.manage", "payroll.run"],
  attendance: ["employees.view", "attendance.manage", "payroll.run"],
  payrollRuns: ["employees.view", "payroll.run"],
  payrollSettings: ["employees.view", "payroll.run"],

  audit: ["audit.view"],
  openingBalances: ["opening.view", "opening.manage"],

  /*
    المستخدمون لمن يديرهم وحده.

    كانوا يصلون كل جهاز، لأن شاشة الدخول كانت تعرض الأسماء ليُختار
    منها وتقرأ صلاحية الداخل من صفّه. فلمّا صار الاسم يُكتب والتحقّق
    على الخادم، لم يبقَ لإرسالهم سبب — فمن لا يديرهم لا يعرف من في
    الشركة ولا ما لكلٍّ من صلاحية.
  */
  users: ["users.manage"],

  chart: [],
  items: [],
  payments: [],
  people: [],
  company: [],
  yearLocks: [],
};

/**
 * ما لا يخرج من القاعدة إلى أي متصفّح، ولو كان المالك.
 *
 * تجزئة كلمة المرور لا يحتاجها المتصفّح لشيء: التحقق صار على الخادم.
 * وهي تُكتب عند الإنشاء وحدها ويحرسها `guarded`، فنزعُها من المقروء
 * لا يمحوها عند إعادة الإرسال.
 */
const SECRETS: Record<string, string[]> = {
  users: ["pinHash"],
};

const holds = (permissions: readonly Permission[], needed: Permission[]) =>
  needed.length === 0 || needed.some((p) => permissions.includes(p));

/** أيقرأ صاحبُ هذه الصلاحيات هذه المجموعة؟ ومجهولُ الاسم لا يُقرأ */
export function canRead(
  field: string,
  permissions: readonly Permission[]
): boolean {
  const rule = READ_RULES[field];
  return rule ? holds(permissions, rule) : false;
}

/**
 * المجموعات التي لا يقرؤها صاحب هذه الصلاحيات.
 *
 * تُذكر للمتصفّح لا لعرضها، بل ليكفّ عن إرسالها: ما لا تراه لا تملك
 * نسخته، فلو أرسلتَ ما عندك لمحوتَ ما لا تعلم. والصمت هنا هو الصواب.
 */
export const hiddenFields = (permissions: readonly Permission[]): string[] =>
  Object.keys(READ_RULES).filter((field) => !canRead(field, permissions));

/** ينزع من الصفّ ما لا يخرج من القاعدة */
function clean(field: string, row: unknown): unknown {
  const keys = SECRETS[field];
  if (!keys || !row || typeof row !== "object") return row;
  const copy = { ...(row as Record<string, unknown>) };
  for (const key of keys) delete copy[key];
  return copy;
}

/**
 * الحالة كما يراها صاحبُ هذه الصلاحيات.
 *
 * وما لا يُقرأ يُفرَّغ ولا يُحذف مفتاحه: المتصفّح يتوقّع الشكل نفسه،
 * ومجموعةٌ غائبة تصير عنده undefined فتتعطّل شاشةٌ لا علاقة لها بالأمر.
 */
export function readableState<T extends Record<string, unknown>>(
  state: T,
  permissions: readonly Permission[]
): T {
  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(state)) {
    if (!canRead(field, permissions)) {
      out[field] = Array.isArray(value) ? [] : {};
      continue;
    }
    out[field] = SECRETS[field] && Array.isArray(value)
      ? value.map((row) => clean(field, row))
      : value;
  }
  return out as T;
}

/**
 * ما استجدّ، كما يراه صاحبُ هذه الصلاحيات.
 *
 * والحذف يُصفّى كما تُصفّى الإضافة: لو وصل «حُذف الموظف ١٢» من لا يقرأ
 * الموظفين لعرف بوجوده ووقت رحيله.
 */
export function readableChanges<
  T extends { upserts?: Record<string, unknown[]>; deletes?: Record<string, string[]> }
>(changes: T, permissions: readonly Permission[]): T {
  const upserts: Record<string, unknown[]> = {};
  for (const [field, rows] of Object.entries(changes.upserts ?? {})) {
    if (!canRead(field, permissions)) continue;
    upserts[field] = SECRETS[field] ? rows.map((row) => clean(field, row)) : rows;
  }

  const deletes: Record<string, string[]> = {};
  for (const [field, ids] of Object.entries(changes.deletes ?? {})) {
    if (canRead(field, permissions)) deletes[field] = ids;
  }

  return { ...changes, upserts, deletes };
}
