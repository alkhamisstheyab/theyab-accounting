/**
 * مدد العقود وانتهاءاتها.
 *
 * العقد يحمل تاريخ توقيعه ومدته، ولا يحمل تاريخ انتهائه. فمرّت أربع
 * عشرة مدةً في عقود الشركة دون أن ينبّه أحد، ومرّت وثيقة تأمينٍ على
 * مشروعٍ عامل فبقي بلا غطاء شهرين. والمدّة التي لا يحسبها أحد لا
 * تُحترَم، والشرط الجزائي الذي لا يُحسب لا يُطالَب به.
 *
 * وهذا الحساب تقريبيّ بحكم ما في العقود لا بحكم قصورٍ فيه:
 *
 * - العقود تقول «يوم عمل ولا تحتسب العطل والراحة والإجازات الرسمية
 *   والأعياد وأي ظروف قاهرة». ولا يعرف النظام عطل الكويت ولا ظروفها،
 *   فيحسب بالتقويم — وحسابُه أقصر من الحقيقة لا أطول.
 * - الملاحق تمدّ المدة، فتُجمع مددها على مدة أصلها.
 * - ويبقى لصاحب القرار أن يكتب تاريخ الانتهاء بيده، فيعلو على الحساب.
 *
 * فالمخرَج قائمةٌ تُراجَع لا حكمٌ يُبنى عليه، ولذلك يُذكر مع كل تاريخ
 * من أين جاء.
 */

import { round3 } from "./accounting";
import type { Contractor } from "./storage";

/** يوم العقد الأخير محسوباً أو مكتوباً */
export type ContractEnd = {
  /** تاريخ الانتهاء بصيغة ISO — فارغ إن تعذّر حسابه */
  date: string;
  /** المدة المعتمدة بالأيام: مدة العقد وملاحقه */
  days: number;
  /** الأيام التي أضافتها الملاحق */
  extraDays: number;
  /** من أين جاء التاريخ */
  source: "محرَّر" | "محسوب" | "غير معروف";
};

const addDays = (iso: string, days: number): string => {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** فرق الأيام بين تاريخين — موجب إذا كان الثاني بعد الأول */
export const daysBetween = (from: string, to: string): number => {
  const a = new Date(from + "T00:00:00Z").getTime();
  const b = new Date(to + "T00:00:00Z").getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
};

/** ملاحق عقدٍ ما */
export const addendaOf = (
  contract: Contractor,
  all: Contractor[]
): Contractor[] =>
  all.filter(
    (c) =>
      c.documentType === "ملحق عقد" &&
      c.parentContractNumber === contract.contractNumber
  );

/**
 * تاريخ انتهاء العقد.
 *
 * التاريخ المحرَّر يعلو على كل حساب: من كتبه رأى الموقع.
 */
export function contractEnd(
  contract: Contractor,
  all: Contractor[]
): ContractEnd {
  if (contract.expectedEndDate) {
    return {
      date: contract.expectedEndDate,
      days: contract.contractDate
        ? daysBetween(contract.contractDate, contract.expectedEndDate)
        : 0,
      extraDays: 0,
      source: "محرَّر",
    };
  }

  /*
    الملحق يمدّ مدةً قائمة ولا ينشئها. فعقدٌ بلا مدة منصوصة يبقى
    مجهول الانتهاء وإن حمل ملاحقه مدداً — وإلا صار امتدادُ أسبوعين
    مدةَ العقد كلها، وخرج تاريخُ انتهاءٍ لا أصل له.
  */
  if (!contract.contractDate || !contract.durationDays) {
    return { date: "", days: 0, extraDays: 0, source: "غير معروف" };
  }

  const extraDays = addendaOf(contract, all).reduce(
    (sum, a) => sum + (a.durationDays || 0),
    0
  );
  const days = contract.durationDays + extraDays;

  return {
    date: addDays(contract.contractDate, days),
    days,
    extraDays,
    source: "محسوب",
  };
}

/** حال المدة اليوم */
export type DurationStatus = "لم تبدأ" | "جارية" | "تقترب" | "انتهت" | "غير معروفة";

export type ContractDuration = {
  contract: Contractor;
  end: ContractEnd;
  status: DurationStatus;
  /** أيام التأخّر بعد الانتهاء — صفر لما لم ينتهِ */
  lateDays: number;
  /** الأيام المتبقية قبل الانتهاء — صفر لما انتهى */
  daysLeft: number;
  /**
   * الشرط الجزائي المستحقّ بحساب التأخّر، محدوداً بسقفه في العقد.
   *
   * وهو تقديرٌ للمطالبة أو للالتزام، لا مبلغٌ واجب: كثيرٌ من التأخير
   * سببه المالك أو ظرفٌ قاهر، والعقود تستثنيه.
   */
  penalty: number;
  /**
   * على مَن الشرط الجزائي: عقد العميل تنفّذه الشركة فالغرامة عليها،
   * وعقد المقاول ينفّذه غيرها فالغرامة لها.
   */
  penaltyAgainst: "الشركة" | "الطرف الآخر" | "—";
};

/** قبل هذا العدد من الأيام يُنبَّه إلى اقتراب الانتهاء */
export const SOON_DAYS = 30;

export function contractDuration(
  contract: Contractor,
  all: Contractor[],
  today: string
): ContractDuration {
  const end = contractEnd(contract, all);

  if (!end.date) {
    return {
      contract,
      end,
      status: "غير معروفة",
      lateDays: 0,
      daysLeft: 0,
      penalty: 0,
      penaltyAgainst: "—",
    };
  }

  const lateDays = Math.max(0, daysBetween(end.date, today));
  const daysLeft = Math.max(0, daysBetween(today, end.date));

  const status: DurationStatus =
    contract.contractDate && today < contract.contractDate
      ? "لم تبدأ"
      : lateDays > 0
        ? "انتهت"
        : daysLeft <= SOON_DAYS
          ? "تقترب"
          : "جارية";

  const perDay = contract.delayPenaltyPerDay || 0;
  const cap =
    contract.maxPenaltyPercent > 0
      ? round3((contract.contractValue * contract.maxPenaltyPercent) / 100)
      : Infinity;
  const penalty =
    lateDays > 0 && perDay > 0 ? round3(Math.min(lateDays * perDay, cap)) : 0;

  return {
    contract,
    end,
    status,
    lateDays,
    daysLeft,
    penalty,
    penaltyAgainst:
      penalty > 0
        ? contract.counterpartyType === "عميل"
          ? "الشركة"
          : "الطرف الآخر"
        : "—",
  };
}

/**
 * مدد كل العقود، مرتّبةً بالأولوية: ما انتهى أولاً ثم ما يقترب.
 *
 * الملاحق لا تُعرض مستقلّةً: مدتها محسوبة في أصلها، وعرضُها مرتين
 * يجعل تأخيراً واحداً تأخيرين.
 */
export function allDurations(
  contractors: Contractor[],
  today: string
): ContractDuration[] {
  const order: Record<DurationStatus, number> = {
    انتهت: 0,
    تقترب: 1,
    جارية: 2,
    "لم تبدأ": 3,
    "غير معروفة": 4,
  };

  return contractors
    .filter((c) => c.documentType !== "ملحق عقد")
    .map((c) => contractDuration(c, contractors, today))
    .sort(
      (a, b) =>
        order[a.status] - order[b.status] ||
        b.lateDays - a.lateDays ||
        a.daysLeft - b.daysLeft
    );
}
