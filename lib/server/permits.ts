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

import { DUES_ACCOUNTS } from "../dues";
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
  /*
    ويكتبها كلُّ من له حساب: الموظّفُ يُنجز رسالتَه فيختمها، والمديرُ
    يُرسل. ولا تُحذف — تُختم بحالتها ويبقى أثرُها، فمن تُرك طلبُه
    شهراً يُعرف ذلك. فلا صلاحيةَ حذفٍ لها أصلاً.
  */
  messages: { write: [], remove: ["__لا أحد__" as Permission] },
  /*
    ولا يُحذف طرفٌ تُعامل معه: يُوقَف فلا يُقترح، ويبقى أثرُه في
    عقوده. ومن حُذف سجلُّه بقيت عقودُه بلا صاحبٍ يُعرف.
  */
  parties: {
    write: ["contractors.manage"],
    remove: ["contractors.manage"],
  },
  /*
    ولا يُحذف تقريرُ اجتماعٍ إلا بصلاحية المشاريع: فهو سندٌ على ما
    قيل، ومن حذفه محا حُجّةً قد تكون له لا عليه.
  */
  minutes: { write: ["projects.manage"], remove: ["projects.manage"] },
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

/**
 * الاستحقاق: حركةٌ يكتبها من لا يملك إدخال الحركات.
 *
 * المهندس يشهد إتمام العمل فيُثبت ما وجب لصاحبه، ولا يملك سوى ذلك: لا
 * يُدخل قيداً آخر، ولا يمسّ حساباً، ولا يعتمد شيئاً. فيُفحص الصفّ نفسه
 * لا المجموعة — دائنُه حساب مستحقات، وحالُه بانتظار الإقرار.
 *
 * ولو أُعطي «إدخال الحركات» ليُثبت استحقاقاً لفُتح له باب الدفاتر كلّه.
 */
const isDueRow = (row: unknown): boolean => {
  const m = (row ?? {}) as Record<string, unknown>;
  return (
    DUES_ACCOUNTS.includes(String(m.creditCode ?? "")) &&
    String(m.approval ?? "") === "بانتظار الاعتماد"
  );
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
    if (!rule) {
      refuse(field, `مجموعة غير معروفة: ${field}`);
      continue;
    }
    if (has(rule.write)) {
      (allowed.upserts ??= {})[field] = rows;
      continue;
    }
    /* من له تسجيل المستحقات يكتب استحقاقاً وحده — لا حركةً أخرى */
    if (
      field === "movements" &&
      permissions.includes("dues.create") &&
      rows.length > 0 &&
      rows.every(isDueRow)
    ) {
      (allowed.upserts ??= {})[field] = rows;
      continue;
    }
    refuse(field, `ليست لديك صلاحية الكتابة في «${field}»`);
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
  /*
    والرسائلُ تُقرأ بلا صلاحيةٍ خاصّة: كلُّ من له حسابٌ يقرأ رسائله.
    والحجبُ الحقيقيُّ في MINE_ONLY — فلا يرى إلا ما أُرسل إليه أو
    أرسله هو.
  */
  messages: [],
  /* والأطرافُ يقرؤها من يقرأ العقود: فهم أصحابُها */
  parties: ["contractors.view", "contractors.manage"],
  /* وتقاريرُ الاجتماعات يقرؤها من يقرأ المشاريع — فهي عنها */
  minutes: ["projects.view", "projects.manage"],

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
/**
 * صاحبُ الجلسة — يُعرف به ما يُقرأ من الصفوف المرشَّحة.
 *
 * والصلاحيّاتُ لا تكفي للرسائل: صلاحيّتان متساويتان ورسالتان، ولكلٍّ
 * صاحبُها. فلا بدّ من الهويّة نفسها.
 */
export type Viewer = { id: string; name: string };

/**
 * المجموعاتُ التي تُرشَّح صفّاً صفّاً.
 *
 * وكان الحجبُ كلُّه بالمجموعة: تُقرأ كلُّها أو تُحجب كلُّها. والرسائلُ
 * ليست كذلك — طلبُ عملٍ موجَّهٌ إلى موظّفٍ بعينه، لا يقرؤه غيرُه ولو
 * كان زميلَه في الصلاحية.
 *
 * والترشيحُ على الخادم لا في الشاشة: فالإخفاءُ في الشاشة لا يمنع من
 * يفتح أدوات المطوّر، وما لم يخرج من القاعدة لا يُقرأ بحيلة.
 */
const MINE_ONLY: Record<
  string,
  (row: Record<string, unknown>, viewer: Viewer) => boolean
> = {
  /*
    ويُطابق بالاسم كما يُطابق بالمعرّف: فمعرّفُ الخادم غير معرّف
    الجهاز — ذاك uuid في العمود وهذا معرّفُ التطبيق في data — والاسمُ
    فريدٌ في الموضعين. فلو طُوبق بالمعرّف وحده لم تصل رسالةٌ إلى
    أحدٍ أصلاً، ولظهر البابُ عاملاً وهو مغلق.
  */
  messages: (row, viewer) =>
    str(row.toUser) === viewer.id ||
    str(row.toName) === viewer.name ||
    str(row.fromName) === viewer.name,
};

const str = (v: unknown): string => (v == null ? "" : String(v));

/** يُرشّح صفوفَ مجموعةٍ إن كانت من المرشَّحة — وإلا أعادها كما هي */
function mine(field: string, rows: unknown[], viewer: Viewer | undefined): unknown[] {
  const keep = MINE_ONLY[field];
  if (!keep) return rows;
  /*
    وبلا مُشاهِدٍ لا شيء: فمن لم يُعرَّف لا يُعطى صفّاً من المرشَّحة.
    والسكوتُ هنا منعٌ لا إذن — ولو كان العكسَ لصار نسيانُ تمريرِ
    الهويّة في مسارٍ جديدٍ بابَ قراءةٍ لرسائل الناس كلِّها.
  */
  if (!viewer) return [];
  return rows.filter((row) =>
    keep((row ?? {}) as Record<string, unknown>, viewer)
  );
}

export function readableState<T extends Record<string, unknown>>(
  state: T,
  permissions: readonly Permission[],
  viewer?: Viewer
): T {
  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(state)) {
    if (!canRead(field, permissions)) {
      out[field] = Array.isArray(value) ? [] : {};
      continue;
    }
    const rows = Array.isArray(value) ? mine(field, value, viewer) : value;
    out[field] = SECRETS[field] && Array.isArray(rows)
      ? rows.map((row) => clean(field, row))
      : rows;
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
>(changes: T, permissions: readonly Permission[], viewer?: Viewer): T {
  const upserts: Record<string, unknown[]> = {};
  for (const [field, rows] of Object.entries(changes.upserts ?? {})) {
    if (!canRead(field, permissions)) continue;
    /* والمرشَّحةُ تُرشَّح في السحب أيضاً، وإلّا وصلت رسالةُ غيره بعد لحظة */
    const kept = mine(field, rows, viewer);
    upserts[field] = SECRETS[field] ? kept.map((row) => clean(field, row)) : kept;
  }

  const deletes: Record<string, string[]> = {};
  for (const [field, ids] of Object.entries(changes.deletes ?? {})) {
    if (canRead(field, permissions)) deletes[field] = ids;
  }

  return { ...changes, upserts, deletes };
}
