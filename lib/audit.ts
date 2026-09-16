/**
 * سجل التدقيق — من فعل ماذا ومتى.
 *
 * يوثّق التغييرات المؤثّرة فقط: الحركات والعقود والاعتمادات والمستخدمين
 * والإقفال والاستيراد. لا يوثّق التصفّح ولا القراءة، فذاك ضجيج يُغرق المهم.
 *
 * السجل يُقيَّد بسقف أعلى لأن التخزين المحلي محدود؛ عند بلوغه تُحذف أقدم
 * القيود. النسخة الاحتياطية تحفظه، فخذها بانتظام إن كان السجل يعنيك.
 */

export type AuditAction =
  | "إنشاء"
  | "تعديل"
  | "حذف"
  | "اعتماد"
  | "إلغاء اعتماد"
  | "ترحيل"
  | "استيراد"
  | "دخول"
  | "خروج";

export type AuditEntity =
  | "حركة"
  | "مشروع"
  | "عقد"
  | "دفعة"
  | "مادة"
  | "استلام مواد"
  | "أرصدة افتتاحية"
  | "مستخدم"
  | "بيانات النظام"
  | "جلسة";

export type AuditEntry = {
  id: string;
  /** ISO datetime */
  at: string;
  /** اسم من قام بالفعل وقت وقوعه */
  user: string;
  action: AuditAction;
  entity: AuditEntity;
  /** وصف مقروء لما حدث */
  summary: string;
  /** القيمة قبل التغيير، للتعديل والحذف */
  before?: string;
  /** القيمة بعد التغيير */
  after?: string;
};

/** أقصى عدد قيود يُحتفظ بها */
export const AUDIT_LIMIT = 5000;

export function makeEntry(
  user: string,
  action: AuditAction,
  entity: AuditEntity,
  summary: string,
  change?: { before?: string; after?: string }
): AuditEntry {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: new Date().toISOString(),
    user,
    action,
    entity,
    summary,
    before: change?.before,
    after: change?.after,
  };
}

/** يضيف قيداً ويقصّ الأقدم عند تجاوز السقف */
export function appendEntry(
  log: AuditEntry[],
  entry: AuditEntry
): AuditEntry[] {
  const next = [entry, ...log];
  return next.length > AUDIT_LIMIT ? next.slice(0, AUDIT_LIMIT) : next;
}

/**
 * يضمّ إلى السجلّ قيوداً ليست فيه.
 *
 * سجلّ التدقيق يُكتب ولا يُحذف منه شيء — لا على الخادم ولا بيد صاحب كل
 * الصلاحيات. فقيدٌ عند الخادم وليس في الجهاز لا يُعالَج بمحوه من الخادم،
 * بل بأن يستردّه الجهاز. وذلك آمن دائماً: الضمّ يُضيف ولا يكتب فوق شيء.
 *
 * ويقع هذا حين يُستورَد السجلّ كاملاً فوق جلسةٍ كانت أرسلت قيودها: تذهب
 * من الجهاز وتبقى عند الخادم.
 *
 * والترتيب بالوقت الأحدث أولاً كما يكتبه appendEntry، والمكرَّر يُعرف
 * بمعرّفه فلا يدخل مرتين.
 */
export function mergeAudit(
  log: AuditEntry[],
  incoming: AuditEntry[]
): AuditEntry[] {
  const have = new Set(log.map((e) => e.id));
  const added = incoming.filter((e) => e.id && !have.has(e.id));
  if (added.length === 0) return log;

  const merged = [...log, ...added].sort((a, b) =>
    a.at < b.at ? 1 : a.at > b.at ? -1 : 0
  );
  return merged.length > AUDIT_LIMIT ? merged.slice(0, AUDIT_LIMIT) : merged;
}

/* ------------------------------------------------------------------ */
/* التصفية                                                             */
/* ------------------------------------------------------------------ */

export type AuditFilter = {
  user: string;
  action: string;
  entity: string;
  from: string;
  to: string;
  search: string;
};

export const emptyAuditFilter = (): AuditFilter => ({
  user: "الكل",
  action: "الكل",
  entity: "الكل",
  from: "",
  to: "",
  search: "",
});

export function filterAudit(
  log: AuditEntry[],
  filter: AuditFilter
): AuditEntry[] {
  const query = filter.search.trim().toLowerCase();

  return log.filter((entry) => {
    if (filter.user !== "الكل" && entry.user !== filter.user) return false;
    if (filter.action !== "الكل" && entry.action !== filter.action) return false;
    if (filter.entity !== "الكل" && entry.entity !== filter.entity) return false;

    const day = entry.at.slice(0, 10);
    if (filter.from && day < filter.from) return false;
    if (filter.to && day > filter.to) return false;

    if (query) {
      const haystack = [entry.summary, entry.user, entry.before, entry.after]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

/** عرض التاريخ والوقت بصيغة قصيرة ثابتة */
export function formatAuditTime(iso: string): string {
  if (!iso) return "—";
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}
