/**
 * الحركة المكرَّرة — تُمسك قبل أن تُحفظ.
 *
 * طلبُ صاحب الشركة في ٢١ سبتمبر ٢٠٢٦: يُنبَّه إلى الحركة المكرَّرة،
 * ولا تُقبل حتى يُقرّ أنها حركةٌ أخرى.
 *
 * والتكرار في دفاتر المقاولات يقع بأربعة أسباب معروفة:
 *   • تُدخل الدفعة مرتين: مرةً من الإيصال ومرةً من كشف البنك.
 *   • يُضغط «حفظ» مرتين فتُكتب الحركة مرتين بتاريخٍ واحد.
 *   • تُدخل من شخصين: من رأى الإيصال ومن راجع الحساب.
 *   • تُعاد كتابتها بعد أيام ظنّاً أنها لم تُحفظ.
 *
 * ولا يجوز أن يمنع النظامُ الحفظَ منعاً: الدفعتان المتساويتان في اليوم
 * الواحد واقعتان — يومية عاملين، وتنكرا ماء. فالحكم لصاحب القرار،
 * والنظام يُريه ما يشبهها ويطلب إقراراً صريحاً.
 */

import { Movement, round3 } from "./accounting";

/** ما بعده لا يُعدّ تكراراً محتملاً */
export const DUPLICATE_WINDOW_DAYS = 7;

export type DuplicateMatch = {
  movement: Movement;
  /** المطابقة التامّة: نفس اليوم والمبلغ وطرفَي القيد والمشروع */
  exact: boolean;
  reason: string;
};

const daysApart = (a: string, b: string): number => {
  const x = new Date(a + "T00:00:00Z").getTime();
  const y = new Date(b + "T00:00:00Z").getTime();
  if (Number.isNaN(x) || Number.isNaN(y)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((x - y) / 86400000));
};

/** يُسقط الفروق التي لا تغيّر المعنى: المسافات والتشكيل وصور الألف */
const normalize = (text: string): string =>
  (text ?? "")
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();

/**
 * حركاتٌ تشبه المسوّدة شبهاً يستوجب السؤال.
 *
 * المبلغ شرطٌ في كل الوجوه: اختلافه يعني حركةً أخرى قطعاً. ثم يُنظر
 * في اليوم وطرفَي القيد والبيان.
 */
export function findDuplicateMovements(
  draft: Partial<Movement>,
  movements: Movement[]
): DuplicateMatch[] {
  const amount = round3(Number(draft.amount) || 0);
  const date = draft.date ?? "";
  if (amount <= 0 || !date) return [];

  const project = (draft.project ?? "").trim();
  const description = normalize(draft.description ?? "");
  const party = normalize(draft.party ?? "");

  const matches: DuplicateMatch[] = [];

  for (const m of movements) {
    /* الحركة التي تُعدَّل ليست تكراراً لنفسها */
    if (draft.id && m.id === draft.id) continue;
    if (round3(m.amount) !== amount) continue;

    const apart = daysApart(m.date, date);
    if (apart > DUPLICATE_WINDOW_DAYS) continue;

    const sameSides =
      m.debitCode === draft.debitCode && m.creditCode === draft.creditCode;
    const sameProject = (m.project ?? "").trim() === project;
    const sameDescription =
      description.length > 0 && normalize(m.description) === description;
    const sameParty = party.length > 0 && normalize(m.party) === party;

    if (apart === 0 && sameSides && sameProject) {
      matches.push({
        movement: m,
        exact: true,
        reason: sameDescription
          ? "نفس اليوم والمبلغ وطرفَي القيد والمشروع والبيان"
          : "نفس اليوم والمبلغ وطرفَي القيد والمشروع",
      });
      continue;
    }

    if (sameDescription && sameSides) {
      matches.push({
        movement: m,
        exact: false,
        reason: `نفس المبلغ والبيان${apart > 0 ? ` قبل ${apart} يوماً` : ""}`,
      });
      continue;
    }

    if (sameParty && sameProject) {
      matches.push({
        movement: m,
        exact: false,
        reason: `نفس المبلغ والطرف والمشروع${apart > 0 ? ` قبل ${apart} يوماً` : ""}`,
      });
    }
  }

  /* التامّ أولاً، ثم الأحدث — فما يُرى أولاً أولى بالنظر */
  return matches
    .sort((a, b) =>
      a.exact === b.exact
        ? b.movement.date.localeCompare(a.movement.date)
        : a.exact
          ? -1
          : 1
    )
    .slice(0, 5);
}

/**
 * بصمة المسوّدة: متى تغيّرت وجب سؤالٌ جديد.
 *
 * فالإقرار بأن الحركة ليست مكرّرة يخصّ ما أُقرّ عليه؛ ولو بقي سارياً
 * بعد تغيير المبلغ أو التاريخ لمرّت المكرّرة بإقرارٍ لحركةٍ أخرى.
 */
export function duplicateSignature(draft: Partial<Movement>): string {
  return [
    draft.date ?? "",
    round3(Number(draft.amount) || 0),
    draft.debitCode ?? "",
    draft.creditCode ?? "",
    (draft.project ?? "").trim(),
    normalize(draft.description ?? ""),
    normalize(draft.party ?? ""),
  ].join("|");
}
