/**
 * ربط حركات أجور المقاولين بعقودها ودفعاتها.
 *
 * العقود دخلت النظام بدفعاتها، والحركات مسجّلة منذ شهور، ولا رابط
 * بينهما — فكل عقد يقول «المدفوع صفر» وإن دُفع نصفه، ولا تعمل دورة
 * اعتماد الدفعات على شيء.
 *
 * ولا تُطابَق الحركة بالعقد آلياً بالاسم: أوصاف الحركات تكتب الكنى
 * («أبو أحمد النجار»، «أبو مريم»، «حسين») والعقود تحمل الأسماء
 * الرسمية («محمد فرغلي محمد عبدربه»). فالمطابقة الآلية بالاسم تخطئ
 * أكثر مما تصيب، وخطؤها صامت.
 *
 * فالأداة تجمع الحركات بكنية مَن دُفع له — تُستخرج من وصف الحركة بعد
 * تجريده من ألفاظ الدفع والترتيب — ويربط صاحبُ القرار المجموعةَ كلها
 * بعقدها مرة واحدة. عشرون قراراً بدل مئةٍ وثلاثين.
 */

import { CONTRACTOR_EXPENSE, round3 } from "./accounting";
import type { Movement } from "./accounting";
import type { Contractor, Installment } from "./storage";
import { isPayableInstallment } from "./storage";
import { isClosedContractorPayment } from "./closed-payments";

/** ألف بأشكالها وياء وتاء مربوطة — حتى تتطابق «أبو» و«ابو» */
export const normalizeArabic = (text: string): string =>
  (text || "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * ألفاظ الدفع والترتيب — تُجرَّد من الوصف ليبقى مَن دُفع له.
 *
 * «الدفعة الثالثة لأبو أحمد النجار- صب سقف ثاني» ← «أبو أحمد النجار».
 */
const NOISE = new Set(
  [
    "دفعه", "الدفعه", "دفعات", "باقي", "جزء", "من", "عن", "سداد", "مستخلص",
    "مستحقات", "اعمال", "عمل", "مصنعيه", "مصنعيات", "مصنعيه", "يوميات",
    "تخصم", "منه", "علي", "الي", "في", "مع", "و", "ال", "قسيمه", "القسيمه",
    "الاولي", "الثانيه", "الثالثه", "الرابعه", "الخامسه", "السادسه",
    "السابعه", "الثامنه", "التاسعه", "العاشره", "اول", "ثاني", "ثالث",
    "رابع", "خامس", "سادس", "سابع", "ثامن", "تاسع", "عاشر", "توقيع", "عقد",
    "لعقد", "بعقد", "صب", "سقف", "الطابق", "الدور", "بيت", "الدرج", "قواعد",
    "القواعد", "الشناج", "الشناجات", "الاعمده", "الثانيه", "للسقف",
    "لسقف", "اولي", "ثانيه", "ثالثه", "رابعه", "خامسه", "سادسه", "سابعه",
    "منفذ", "مقاول", "المقاول", "تمديد", "درج", "طابق", "دور",
  ].map(normalizeArabic)
);

/** بنود مقيّدة على حساب أجور المقاولين وليست أجرَ مقاولٍ على عقد */
const NOT_A_CONTRACT_ITEM = new Set(["نقليات"]);

/** يُزال ما بعد الشرطة: موضع العمل لا اسم من دُفع له */
const beforeDash = (text: string): string =>
  text.split(/[—–-]/)[0] || text;

/**
 * يجرّد الكلمة من لام الجرّ وأل التعريف.
 *
 * «لأبو أحمد» و«أبو أحمد» رجلٌ واحد، و«الصحي» و«صحي» عملٌ واحد —
 * وبغير هذا التجريد يخرجان مجموعتين ويُتَّخذ فيهما قراران.
 */
const stripPrefix = (word: string): string => {
  let w = word;
  if (w.startsWith("لل") && w.length > 3) w = w.slice(2);
  else if (w.startsWith("ال") && w.length > 3) w = w.slice(2);
  else if (w.startsWith("ل") && w.length > 3) w = w.slice(1);
  if (w.startsWith("ال") && w.length > 3) w = w.slice(2);
  return w;
};

/**
 * كنية من دُفع له، مستخرجة من وصف الحركة.
 *
 * تعود فارغة حين لا يبقى بعد التجريد شيء — وتلك حركات تُراجَع يدوياً.
 */
export function payeeKey(movement: Movement): string {
  const words = normalizeArabic(beforeDash(movement.description))
    .replace(/[()،.,:]/g, " ")
    .split(" ")
    .map(stripPrefix)
    .filter((w) => w.length > 1 && !NOISE.has(w) && !/^\d+$/.test(w));
  return words.join(" ");
}

/** الحركة مرشّحة للربط: أجر مقاول، غير مرتبطة بعد، وليست نقليات */
export function isLinkCandidate(movement: Movement): boolean {
  return (
    movement.debitCode === CONTRACTOR_EXPENSE &&
    !movement.contractNumber &&
    !NOT_A_CONTRACT_ITEM.has(movement.itemName) &&
    /* دفعات ٢٠٢٥ المُقفلة لا تُربط بعقدٍ ولا مشروع — lib/closed-payments.ts */
    !isClosedContractorPayment(movement)
  );
}

export type PayeeGroup = {
  /** مفتاح التجميع — كنية من دُفع له */
  key: string;
  /** ما يُعرض: الكنية، أو «(بلا وصف)» */
  label: string;
  project: string;
  movements: Movement[];
  total: number;
  /** أقدم وأحدث تاريخ في المجموعة */
  from: string;
  to: string;
};

/**
 * يجمع الحركات المرشّحة بمن دُفع له وبمشروعها.
 *
 * المشروع جزء من المفتاح: «أبو أحمد النجار» في قسيمتين عقدان لا عقد.
 */
export function groupCandidates(
  movements: Movement[],
  project?: string
): PayeeGroup[] {
  const groups = new Map<string, PayeeGroup>();

  for (const movement of movements) {
    if (!isLinkCandidate(movement)) continue;
    if (project && movement.project !== project) continue;

    const key = payeeKey(movement);
    const id = movement.project + "|" + key;
    const group: PayeeGroup =
      groups.get(id) ??
      ({
        key,
        label: key || "(بلا وصف مميّز)",
        project: movement.project,
        movements: [] as Movement[],
        total: 0,
        from: movement.date,
        to: movement.date,
      } satisfies PayeeGroup);

    group.movements.push(movement);
    group.total = round3(group.total + (Number(movement.amount) || 0));
    if (movement.date < group.from) group.from = movement.date;
    if (movement.date > group.to) group.to = movement.date;
    groups.set(id, group);
  }

  return [...groups.values()]
    .map((g) => ({
      ...g,
      movements: [...g.movements].sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => b.total - a.total);
}

/** ما رُبط فعلاً بكل دفعة من دفعات عقدٍ ما */
export function linkedByInstallment(
  movements: Movement[],
  contractNumber: string
): Map<number, number> {
  const byInstallment = new Map<number, number>();
  for (const m of movements) {
    if (m.contractNumber !== contractNumber) continue;
    const no = m.installmentNumber ?? 0;
    byInstallment.set(
      no,
      round3((byInstallment.get(no) ?? 0) + (Number(m.amount) || 0))
    );
  }
  return byInstallment;
}

export type LinkPlanRow = {
  movement: Movement;
  /** رقم الدفعة المقترحة — صفر: تُربط بالعقد بلا دفعة محدّدة */
  installmentNumber: number;
  /** سبب الاقتراح، يُعرض ليُراجَع */
  reason: string;
};

/**
 * يقترح لكل حركة دفعتَها في العقد.
 *
 * القاعدة: الدفعات تُستوفى بترتيبها. فتؤخذ الحركات بترتيب تاريخها،
 * وتُحمَّل على أول دفعة بقي فيها متّسع. والمطابقة التامة للمتبقّي
 * تُذكر لأنها الأوثق، وما لا يجد دفعةً يُربط بالعقد وحده — فربطُه
 * بالعقد صحيح وإن جهلنا دفعته، وافتراضُ دفعةٍ بلا سند خطأ صامت.
 */
export function planLinks(
  rows: Movement[],
  contract: Contractor,
  alreadyLinked: Map<number, number>
): LinkPlanRow[] {
  /* المتبقّي في كل دفعة قابلة للصرف، بترتيب العقد */
  const remaining = new Map<number, number>();
  for (const i of contract.installments) {
    if (!isPayableInstallment(i)) continue;
    const value = Number(i.value) || 0;
    remaining.set(i.number, round3(value - (alreadyLinked.get(i.number) ?? 0)));
  }

  const order = [...remaining.keys()].sort((a, b) => a - b);
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));

  return sorted.map((movement) => {
    const amount = round3(Number(movement.amount) || 0);

    const exact = order.find((no) => Math.abs((remaining.get(no) ?? 0) - amount) < 0.001);
    if (exact !== undefined) {
      remaining.set(exact, 0);
      return { movement, installmentNumber: exact, reason: "تُكمل الدفعة تماماً" };
    }

    const fits = order.find((no) => (remaining.get(no) ?? 0) >= amount - 0.001);
    if (fits !== undefined) {
      remaining.set(fits, round3((remaining.get(fits) ?? 0) - amount));
      return { movement, installmentNumber: fits, reason: "أول دفعة بقي فيها متّسع" };
    }

    return { movement, installmentNumber: 0, reason: "لا دفعة تتّسع لها — تُربط بالعقد وحده" };
  });
}

/** ملخّص ما ينتظر الربط، لعرضه قبل الدخول في التفاصيل */
export function linkSummary(movements: Movement[]) {
  const candidates = movements.filter(isLinkCandidate);
  const excluded = movements.filter(
    (m) =>
      m.debitCode === CONTRACTOR_EXPENSE &&
      !m.contractNumber &&
      NOT_A_CONTRACT_ITEM.has(m.itemName)
  );
  const linked = movements.filter((m) => m.contractNumber);
  return {
    candidates: candidates.length,
    candidatesTotal: round3(
      candidates.reduce((s, m) => s + (Number(m.amount) || 0), 0)
    ),
    excluded: excluded.length,
    excludedTotal: round3(
      excluded.reduce((s, m) => s + (Number(m.amount) || 0), 0)
    ),
    linked: linked.length,
    linkedTotal: round3(linked.reduce((s, m) => s + (Number(m.amount) || 0), 0)),
  };
}

/** الدفعة كما تُعرض في قائمة الاختيار */
export const installmentLabel = (i: Installment): string =>
  `الدفعة ${i.number} — ${i.value} د.ك` +
  (i.stage ? ` · ${i.stage}` : i.condition ? ` · ${i.condition.slice(0, 40)}` : "");
