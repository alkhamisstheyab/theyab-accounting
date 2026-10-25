/**
 * العقدُ ثلاثيُّ الأطراف — ومن يدفع كلَّ دفعة.
 *
 * طلبه صاحب الشركة في ٢٥ أكتوبر ٢٠٢٦ من واقعٍ قائم: عقدُ نصفِ تشطيبٍ
 * قيمتُه ٢٧٠٠، ينفّذه مينا المقاول، تدفع الشركةُ منه ٢٠٠٠ على أربع
 * دفعات، ويدفع المالكُ د. بوعباس ٧٠٠ على ثلاث دفعاتٍ **مباشرةً إلى
 * المقاول**. ونطاقُ العمل واحدٌ لا نطاقان: الـ٧٠٠ جزءٌ من ثمن نصف
 * التشطيب لا أعمالٌ زائدة.
 *
 * **وأثرُه في الدفاتر لا في الورق:** ما يدفعه الطرفُ الثالثُ لا يمرّ
 * بحساب الشركة — لا نقداً ولا بنكاً — فلا قيدَ له بحال، كدعم الدولة
 * للتكييف والألمنيوم. فلو حُسب على الشركة ظهرت مدينةً بما لا تدفعه،
 * ولو أُسقط من العقد ظهر العقدُ ناقصَ القيمة. فيُفصل: قيمةُ العقد
 * كاملةٌ، وحصّةُ الشركة منها وحدَها هي التزامُها.
 *
 * **والطرفُ الثالثُ اختياريٌّ** — شرطُ صاحب الشركة: «ألّا يُلزمنا في
 * المستقبل بإدخال طرفٍ ثالث». فأكثرُ عقوده طرفان، ومن لا ثالثَ له
 * تبقى دفعاتُه كلُّها على الشركة بلا خانةٍ تُملأ ولا سؤالٍ يُسأل.
 *
 * ولذلك كان الغيابُ هو الأصل في الموضعين: لا `thirdParty` يعني عقداً
 * ثنائيّاً، و`payer` فارغٌ يعني «الشركة». فلا يتغيّر عقدٌ من عقوده
 * الثمانين بإضافة هذا الباب.
 */

import type { Contractor, Installment } from "./storage";
import { round3 } from "./accounting";

/** من يدفع الدفعة */
export const PAYERS = ["الشركة", "الطرف الثالث"] as const;

export type Payer = (typeof PAYERS)[number];

/** صفةُ الطرف الثالث في العقد */
export const THIRD_PARTY_ROLES = ["مالك", "مقاول", "مورّد", "ضامن"] as const;

export type ThirdParty = {
  name: string;
  role: string;
  civilId: string;
  phone: string;
  address: string;
};

/* ------------------------------------------------------------------ */

/** أللعقد طرفٌ ثالثٌ مكتوب؟ — والاسمُ هو الحدّ، فصفةٌ بلا اسمٍ لا تُعدّ */
export const hasThirdParty = (contract: Contractor): boolean =>
  Boolean(contract.thirdParty?.name?.trim());

/**
 * من يدفع هذه الدفعة.
 *
 * والفارغُ «الشركة»: فعقودُها الثمانون كُتبت قبل هذا الباب، ولو كان
 * الفارغُ مجهولاً لصارت كلُّها تسأل عن دافع.
 */
export function payerOf(installment: Installment): Payer {
  const written = (installment.payer ?? "").trim();
  return written === "الطرف الثالث" ? "الطرف الثالث" : "الشركة";
}

const amountOf = (i: Installment): number => round3(Number(i.value) || 0);

export type PayerSplit = {
  /** قيمةُ العقد كما كُتبت */
  total: number;
  /** ما على الشركة من دفعاته */
  company: number;
  /** ما على الطرف الثالث */
  third: number;
  /** عددُ دفعات كلٍّ منهما */
  companyCount: number;
  thirdCount: number;
  /**
   * الفرقُ بين قيمة العقد ومجموع دفعاته.
   *
   * ويُقال ولا يُطوى: فجدولٌ مجموعُه غيرُ القيمة إمّا دفعةٌ نُسيت
   * وإمّا رقمٌ أُخطئ فيه — وكلاهما يُكتشف بعد الصرف لا قبله.
   */
  gap: number;
};

/** قسمةُ الدفعات على دافعيها */
export function splitByPayer(contract: Contractor): PayerSplit {
  let company = 0;
  let third = 0;
  let companyCount = 0;
  let thirdCount = 0;

  for (const installment of contract.installments) {
    const amount = amountOf(installment);
    if (payerOf(installment) === "الطرف الثالث") {
      third = round3(third + amount);
      thirdCount++;
    } else {
      company = round3(company + amount);
      companyCount++;
    }
  }

  const total = round3(Number(contract.contractValue) || 0);
  return {
    total,
    company,
    third,
    companyCount,
    thirdCount,
    gap: round3(total - company - third),
  };
}

/**
 * سببُ منع إسناد دفعةٍ إلى الطرف الثالث، أو فراغٌ إن جاز.
 *
 * فلا يُسند إلى من لا وجودَ له: من أسند دفعةً إلى «الطرف الثالث» وليس
 * في العقد ثالثٌ كتب دفعةً لا دافعَ لها — تنقص من التزام الشركة ولا
 * تُطالِب أحداً، فتضيع صامتةً.
 */
export function payerProblem(contract: Contractor, payer: Payer): string {
  if (payer === "الطرف الثالث" && !hasThirdParty(contract)) {
    return "لا طرفَ ثالثاً في هذا العقد — اكتبه أوّلاً";
  }
  return "";
}

/**
 * ما يُقال عن الجدول قبل أن يُعتمد — أو فراغٌ إن استقام.
 *
 * ويُنبَّه ولا يُمنع: فقد تُكتب القيمةُ أوّلاً وتُجدوَل الدفعاتُ بعدها
 * على مراحل، فيبقى الفرقُ مدّةً بعلم صاحبه. وإنّما ألّا يمضي عن غير
 * علم.
 */
export function splitWarning(split: PayerSplit): string {
  if (Math.abs(split.gap) < 0.001) return "";
  if (split.gap > 0) {
    return `مجموعُ الدفعات أقلُّ من قيمة العقد بـ${split.gap.toFixed(3)} د.ك`;
  }
  return `مجموعُ الدفعات يزيد على قيمة العقد بـ${Math.abs(split.gap).toFixed(3)} د.ك`;
}

/** وصفُ الطرف الثالث في سطرٍ واحد — للطباعة والعرض */
export function thirdPartyLine(third: ThirdParty): string {
  const bits = [third.name.trim()];
  if (third.role.trim()) bits.push(`(${third.role.trim()})`);
  if (third.civilId.trim()) bits.push(`— مدنيّ ${third.civilId.trim()}`);
  return bits.join(" ");
}
