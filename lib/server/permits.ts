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
