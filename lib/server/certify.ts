/**
 * شهادةُ المهندس: يعتمد الإنجاز ولا يكتب العقد.
 *
 * الكتابةُ في مجموعة العقود تطلب «إدارة المقاولين». والمهندس لا يملكها
 * — ولا يصحّ أن يملكها: لو ملكها لغيّر قيمة العقد وشروطه وطرفه. وإنما
 * يملك «اعتماد إنجاز المراحل»، وهو جوهرُ عمله: يشهد أن المرحلة أُنجزت
 * فتصير دفعتُها مستحقة.
 *
 * وكان الصفُّ يُردّ كلُّه لذلك. فيعتمد المهندس في جهازه، وتظهر الدفعة
 * معتمدةً أمامه، ولا يصل الخادمَ شيء — ولا يعلم صاحبُ الشركة أن أحداً
 * اعتمد. وقع ذلك: اعتمد م. نوح الدفعة الأخيرة لعبداللطيف النجار بخصم
 * مئة دينار، فلم يرَ صاحبُ الشركة اعتماداً ولا خصماً ولا أثراً.
 *
 * والعلاج ليس توسيع الإذن، بل تضييق ما يُكتب: يُقرأ الصفُّ المحفوظ،
 * ويُؤخذ من الوارد **حقولُ الشهادة وحدها** في دفعاتها. فما سواها —
 * القيمةُ والشروطُ والاسمُ والدفعاتُ نفسُها — يبقى كما هو عند الخادم،
 * ولو أرسل الجهازُ غيرَه. فلا يُحتاج إلى الثقة بما أرسل: المحفوظُ هو
 * الأصل، والوارد لا يزيد عليه إلا شهادةً.
 *
 * وكذلك إقرارُ الإدارة لمن يملكه وحده.
 */

import type { Queryable } from "./state";

/** ما يكتبه صاحب «اعتماد إنجاز المراحل» في الدفعة */
const APPROVAL_FIELDS = [
  "approved",
  "approvedBy",
  "approvedAt",
  "approvalNote",
  "deduction",
  "deductionReason",
] as const;

/** وما يكتبه صاحب «إقرار المرحلة» */
const CONFIRM_FIELDS = [
  "confirmed",
  "confirmedBy",
  "confirmedAt",
  "confirmNote",
] as const;

type Row = Record<string, unknown>;

const installmentsOf = (row: Row): Row[] =>
  Array.isArray(row.installments) ? (row.installments as Row[]) : [];

/**
 * يدمج شهادةَ الوارد في الصفّ المحفوظ ويردّ الصفَّ الناتج.
 *
 * يردّ `null` إن لم يتغيّر شيء — فلا يُكتب صفٌّ بلا سبب ويُرفع رقمُ
 * تغييره، فيُوقظ أجهزةَ الناس بلا فائدة.
 */
export function mergeCertification(
  stored: Row,
  incoming: Row,
  fields: readonly string[]
): Row | null {
  const storedInstallments = installmentsOf(stored);
  if (storedInstallments.length === 0) return null;

  const byNumber = new Map<number, Row>();
  for (const i of installmentsOf(incoming)) {
    const no = Number(i.number);
    if (Number.isFinite(no)) byNumber.set(no, i);
  }

  let touched = false;
  const merged = storedInstallments.map((kept) => {
    const sent = byNumber.get(Number(kept.number));
    if (!sent) return kept;

    const next: Row = { ...kept };
    for (const field of fields) {
      const before = kept[field];
      const after = sent[field];
      /* المعدوم والفارغ سواء — فلا يُعدّ تغييراً ما ليس بتغيير */
      const same =
        (before ?? "") === (after ?? "") ||
        (before === undefined && after === undefined);
      if (same) continue;
      if (after === undefined) delete next[field];
      else next[field] = after;
      touched = true;
    }
    return next;
  });

  if (!touched) return null;
  return { ...stored, installments: merged };
}

/**
 * يُحوّل صفوفَ العقود الواردة إلى ما يجوز لصاحب الشهادة أن يكتبه.
 *
 * يُسقط الصفَّ الذي لا نظيرَ له عند الخادم: من لا يملك إدارة المقاولين
 * لا يُنشئ عقداً، والعقدُ الذي لا وجود له لا شهادةَ عليه.
 */
export async function certifyOnly(
  db: Queryable,
  rows: unknown[],
  permissions: readonly string[]
): Promise<Row[]> {
  const fields = [
    ...(permissions.includes("contracts.approve") ? APPROVAL_FIELDS : []),
    ...(permissions.includes("contracts.confirm") ? CONFIRM_FIELDS : []),
  ];
  if (fields.length === 0) return [];

  const out: Row[] = [];
  for (const raw of rows) {
    const incoming = (raw ?? {}) as Row;
    const id = String(incoming.id ?? "");
    if (!id) continue;

    const { rows: found } = await db.query(
      "SELECT data FROM contracts WHERE id = $1",
      [id]
    );
    if (found.length === 0) continue;

    const stored = (
      typeof found[0].data === "string" ? JSON.parse(found[0].data) : found[0].data
    ) as Row;

    const merged = mergeCertification(stored, incoming, fields);
    if (merged) out.push(merged);
  }
  return out;
}
