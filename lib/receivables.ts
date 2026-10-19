/**
 * المطلوب من العملاء، وما كبّده التأخير.
 *
 * والعميلُ يُعرف بمشروعه: الدفاترُ تسمّي المشروعَ باسمه — «مشروع حسن
 * العجمي» — وعقودُه تحت ذلك الاسم. فالتجميعُ على المشروع لا على اسم
 * الطرف: فقد يُكتب اسمُه في عقدٍ كاملاً وفي آخر مختصراً.
 *
 * وثلاثةُ أرقامٍ لكلِّ عميل:
 *
 *   • **المطلوبُ الآن**: دفعاتٌ شُهد بإنجاز مراحلها وأُقرّت، وما قُبض
 *     منها أقلُّ من صافيها. والدفعةُ التي لم تُقرّ ليست مطلوبةً بعد —
 *     ولو كانت في الجدول.
 *
 *   • **ما أنفقناه في مدّة تأخّره**: أجورٌ ومواد ومقاولون صُرفوا على
 *     قسيمته بين أقدم استحقاقٍ لم يُسدَّد واليوم. وهو رقمٌ من الدفاتر
 *     لا تقديرٌ — يُحاور به صاحبُ الشركة عميلَه: «مالُك تأخّر، وهذا ما
 *     أنفقناه على بيتك في تلك المدّة من مالنا».
 *
 *     ويُحسب على المدّة مجموعةً لا على كلِّ دفعةٍ وحدها: فدفعتان
 *     متأخّرتان مدّتاهما متداخلتان، ولو جُمع لكلٍّ ما أُنفق في مدّتها
 *     حُسب المصروفُ مرّتين.
 *
 *   • **الغرامةُ التي تسقط عنّا**: العقدُ يقضي أن تأخّر المالك عن
 *     السداد فوق أسبوعين تُضاف مدّتُه على مدّة العقد. فتسقط عن الشركة
 *     غرامةُ تأخيرها (٢٥ د.ك يومياً في العقد ٦٠٠١، بحدٍّ ٥٪ من قيمته).
 *     **وهي حُجّةٌ للشركة لا ديْنٌ على العميل** — تُذكر في المحاورة
 *     ولا تُقيَّد في الدفاتر، ولا تُطالَب بها.
 */

import { round3, type Movement } from "./accounting";
import type { Contractor, Installment } from "./storage";

/* ------------------------------------------------------------------ */

const DAY = 86400000;

/** يومٌ من نصٍّ yyyy-mm-dd — والفاسدُ لا شيء */
const dayOf = (text: string | undefined): Date | null => {
  if (!text) return null;
  const at = new Date(`${text.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(at.getTime()) ? null : at;
};

const daysBetween = (from: Date, to: Date): number =>
  Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY));

/**
 * ما قُبض على دفعةٍ بعينها.
 *
 * والمبلغُ الموزَّعُ يُنسب حصّةً حصّة، وغيرُ الموزَّع كلُّه لدفعته.
 * ولا يُخلط البابان: الحركةُ إمّا موزَّعةٌ وإمّا منسوبةٌ لرقمٍ واحد.
 */
export function receivedOn(
  movements: readonly Movement[],
  installmentNumber: number
): number {
  let sum = 0;
  for (const m of movements) {
    const splits = m.installmentSplits ?? [];
    if (splits.length > 0) {
      for (const part of splits) {
        if (Number(part.number) === installmentNumber) {
          sum += Number(part.amount) || 0;
        }
      }
      continue;
    }
    if ((m.installmentNumber ?? 0) === installmentNumber) sum += m.amount;
  }
  return round3(sum);
}

export const installmentNet = (i: Installment): number =>
  round3((Number(i.value) || 0) - (Number(i.deduction) || 0));

export type OwedInstallment = {
  contractNumber: string;
  workType: string;
  number: number;
  stage: string;
  net: number;
  received: number;
  owing: number;
  /** yyyy-mm-dd أو فراغٌ إن لم يُكتب */
  dueDate: string;
  /** أيامُ التأخير — و«لا يُعلم» إن لم يُكتب تاريخُ الاستحقاق */
  lateDays: number | null;
  /**
   * من أين عُدّت مطلوبةً.
   *
   *   • `مُقرّة`: شُهد بإنجاز مرحلتها وأقرّتها الإدارة.
   *   • `شُرع في سدادها`: لم تُقرّ، وقد وصل بعضُ مالها ولم يَتمّ.
   *
   * والثانيةُ مطلوبةٌ كالأولى: من دفع بعضَ دفعةٍ فقد أقرّ بأنها
   * مستحقّة. ووقع في دفاتر الشركة: الدفعةُ ٥ من العقد ٦٠٠١ قيمتُها
   * ٨٠٠٠ ووصل منها ٢٨٠٠، ومرحلتُها لم تُعتمد — فكانت تُعدّ «مقبوضاً
   * مقدّماً» ويختفي نقصُ ٥٢٠٠، وهو الذي أخّر توفير المواد.
   *
   * وشرطُ أمثالها في العقد «بدءُ المرحلة» لا تمامُها — فمالُها يموّل
   * موادها. فالاعتمادُ بعد الإنجاز ليس بابَها.
   */
  basis: "مُقرّة" | "شُرع في سدادها";
};

export type ClientStatement = {
  /** المشروع — وهو اسمُ العميل في الدفاتر */
  project: string;
  /** أسماءُ الأطراف كما كُتبت في عقوده */
  names: string[];
  contracts: number;
  /** مجموعُ قيم عقود العميل */
  contractValue: number;
  /** ما أُقرّ من دفعاته */
  due: number;
  /** ما قُبض منه */
  received: number;
  /** المطلوبُ الآن */
  owed: number;
  /** ما قُبض كاملاً على دفعاتٍ لم تُقرّ — سَبْقُ العميل لا تأخّره */
  paidAhead: number;
  /** نقصُ دفعاتٍ شُرع في سدادها ولم تُقرّ مراحلُها */
  startedShort: number;
  /** المطلوبُ جملةً: المُقرّ وما شُرع فيه */
  owedAll: number;
  /** مدّةٌ تُضاف على مدّة العقد بتأخّر السداد — بنصّ العقد */
  extensionDays: number;
  /** نهايةُ المدّة الأصليّة — yyyy-mm-dd، وفراغٌ إن لم تُكتب */
  originalEnd: string;
  /** ونهايتُها بعد الإضافة */
  extendedEnd: string;
  /** الدفعاتُ المطلوبة، الأقدمُ استحقاقاً أوّلاً */
  items: OwedInstallment[];
  /** أقدمُ استحقاقٍ لم يُسدَّد */
  oldestDue: string;
  /** أيامُ أقدمِها */
  lateDays: number | null;
  /** وزنُ التأخير: مجموعُ (المبلغ × أيامه) */
  weightedDays: number;
  /** ما أُنفق على مشروعه في مدّة التأخير */
  spentWhileLate: number;
  /** عددُ الحركات التي بُني عليها ذلك المبلغ */
  spentEntries: number;
  /** الغرامةُ التي تسقط عن الشركة — حُجّةٌ لا ديْن */
  penaltyWaived: number;
  /** وشرحُ حسابها، فرقمٌ بلا سندٍ لا يُحاوَر به */
  penaltyBasis: string;
};

/** مَن يُعدّ من مصروفات المشروع — ما خرج من الشركة عليه */
const isProjectSpend = (m: Movement): boolean =>
  m.movementType !== "إيرادات" && m.amount > 0;

/**
 * كشفُ عميلٍ واحد.
 *
 * `today` يُمرَّر ولا يُؤخذ من الساعة: فالدالّةُ تُفحص، ومن أخذ الوقتَ
 * من تلقائه لم يُفحص حسابُه على يومٍ معلوم.
 */
export function clientStatement(
  project: string,
  contracts: readonly Contractor[],
  movements: readonly Movement[],
  today: Date
): ClientStatement {
  const mine = contracts.filter(
    (c) => (c.project || "") === project && c.counterpartyType === "عميل"
  );

  const items: OwedInstallment[] = [];
  let due = 0;
  let received = 0;
  let paidAhead = 0;
  let startedShort = 0;
  let contractValue = 0;
  const names = new Set<string>();

  for (const contract of mine) {
    contractValue = round3(contractValue + (Number(contract.contractValue) || 0));
    if (contract.name) names.add(contract.name);
    const paid = movements.filter(
      (m) => m.contractNumber === contract.contractNumber
    );

    for (const installment of contract.installments ?? []) {
      const net = installmentNet(installment);
      const got = receivedOn(paid, installment.number);

      const owing = round3(net - got);

      /*
        ما لم تُقرّ مرحلتُه: إن وصل بعضُ مالها ولم يَتمّ فهي مطلوبةٌ —
        من دفع بعضَ دفعةٍ فقد أقرّ بأنها مستحقّة. وإن لم يصل منها شيءٌ
        فليست مطلوبةً بعد. وإن وصلت كاملةً فذاك سَبْقٌ لا تأخّر.
      */
      if (!installment.confirmed) {
        if (got > 0.001 && owing > 0.001) {
          const dueDateOf = installment.dueDate ?? "";
          const atOf = dayOf(dueDateOf);
          items.push({
            contractNumber: contract.contractNumber,
            workType: contract.workType || contract.specialty || "",
            number: installment.number,
            stage: installment.stage ?? "",
            net,
            received: got,
            owing,
            dueDate: dueDateOf,
            lateDays: atOf ? daysBetween(atOf, today) : null,
            basis: "شُرع في سدادها",
          });
          startedShort = round3(startedShort + owing);
          received = round3(received + got);
        } else {
          paidAhead = round3(paidAhead + got);
        }
        continue;
      }

      due = round3(due + net);
      received = round3(received + got);
      if (owing <= 0.001) continue;

      const dueDate = installment.dueDate ?? "";
      const at = dayOf(dueDate);
      items.push({
        contractNumber: contract.contractNumber,
        workType: contract.workType || contract.specialty || "",
        number: installment.number,
        stage: installment.stage ?? "",
        net,
        received: got,
        owing,
        dueDate,
        lateDays: at ? daysBetween(at, today) : null,
        basis: "مُقرّة",
      });
    }
  }

  /* الأقدمُ أوّلاً، وما لا تاريخَ له في الذيل — فلا يُدّعى عليه تأخير */
  items.sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  const owed = round3(
    items.filter((i) => i.basis === "مُقرّة").reduce((sum, i) => sum + i.owing, 0)
  );
  const owedAll = round3(items.reduce((sum, i) => sum + i.owing, 0));
  const weightedDays = Math.round(
    items.reduce((sum, i) => sum + i.owing * (i.lateDays ?? 0), 0)
  );

  const dated = items.filter((i) => i.dueDate);
  const oldestDue = dated[0]?.dueDate ?? "";
  const oldest = dayOf(oldestDue);
  const lateDays = oldest ? daysBetween(oldest, today) : null;

  /* ---- ما أُنفق على مشروعه في مدّة التأخير ---- */
  let spentWhileLate = 0;
  let spentEntries = 0;
  if (oldest && owedAll > 0.001) {
    const from = oldestDue.slice(0, 10);
    const to = today.toISOString().slice(0, 10);
    for (const m of movements) {
      if ((m.project || "") !== project) continue;
      if (!isProjectSpend(m)) continue;
      const day = (m.date || "").slice(0, 10);
      if (day < from || day > to) continue;
      spentWhileLate = round3(spentWhileLate + m.amount);
      spentEntries += 1;
    }
  }

  /* ---- الغرامةُ التي تسقط عن الشركة ---- */
  /*
    نصُّ العقد: «وفي حال تأخّر المالك عن سداد الدفعات بمدة تتجاوز
    أسبوعين تُضاف المدة على مدة العقد». فالشرطُ أسبوعان، والمضافُ
    مدّةُ التأخير. وتُقاس على أشدّ عقودِه غرامةً، وتُحدّ بسقفها منه.
  */
  let penaltyWaived = 0;
  let penaltyBasis = "";
  const strongest = mine
    .filter((c) => (Number(c.delayPenaltyPerDay) || 0) > 0)
    .sort(
      (a, b) =>
        (Number(b.delayPenaltyPerDay) || 0) - (Number(a.delayPenaltyPerDay) || 0)
    )[0];

  if (strongest && lateDays != null && lateDays > 14 && owedAll > 0.001) {
    const perDay = Number(strongest.delayPenaltyPerDay) || 0;
    const capPercent = Number(strongest.maxPenaltyPercent) || 0;
    const raw = round3(lateDays * perDay);
    const cap =
      capPercent > 0
        ? round3((Number(strongest.contractValue) || 0) * (capPercent / 100))
        : 0;
    penaltyWaived = cap > 0 ? Math.min(raw, cap) : raw;
    penaltyBasis =
      `${lateDays} يوماً × ${perDay} د.ك` +
      (cap > 0 && raw > cap ? ` — وبلغ الحدَّ ${capPercent}% من العقد ${strongest.contractNumber}` : "") +
      ` · العقد ${strongest.contractNumber}`;
  }

  /*
    ومدّةٌ تُضاف على مدّة العقد.

    وهي علاجُ العقد لتأخّر السداد: «تُضاف المدة على مدة العقد». وهي
    أنفعُ لصاحب الشركة من رقمٍ بالدينار حين يكون ضررُه تأخّرَ العمل
    نفسه — كتأخّر توفير المواد: فالمالُ لم يُنفَق، وإنما ضاع الوقت.
  */
  const extensionDays = lateDays != null && lateDays > 14 ? lateDays : 0;
  const longest = mine
    .filter((c) => (Number(c.durationDays) || 0) > 0 && c.contractDate)
    .sort((a, b) => (Number(b.durationDays) || 0) - (Number(a.durationDays) || 0))[0];
  let originalEnd = "";
  let extendedEnd = "";
  if (longest) {
    const start = dayOf(longest.contractDate);
    if (start) {
      const days = Number(longest.durationDays) || 0;
      const end = new Date(start.getTime() + days * DAY);
      originalEnd = end.toISOString().slice(0, 10);
      extendedEnd = new Date(end.getTime() + extensionDays * DAY)
        .toISOString()
        .slice(0, 10);
    }
  }

  return {
    project,
    names: [...names],
    contracts: mine.length,
    contractValue,
    due,
    received,
    owed,
    paidAhead,
    startedShort,
    owedAll,
    extensionDays,
    originalEnd,
    extendedEnd,
    items,
    oldestDue,
    lateDays,
    weightedDays,
    spentWhileLate,
    spentEntries,
    penaltyWaived,
    penaltyBasis,
  };
}

/** كشوفُ العملاء كلِّهم — الأكثرُ مطلوباً أوّلاً */
export function clientStatements(
  contracts: readonly Contractor[],
  movements: readonly Movement[],
  today: Date
): ClientStatement[] {
  const projects = new Set<string>();
  for (const c of contracts) {
    if (c.counterpartyType === "عميل") projects.add(c.project || "");
  }
  return [...projects]
    .map((p) => clientStatement(p, contracts, movements, today))
    .sort((a, b) => b.owedAll - a.owedAll || b.paidAhead - a.paidAhead);
}
