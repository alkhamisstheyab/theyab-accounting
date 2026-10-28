/**
 * يفحص تنبيهَ «دفعة مستحقة لم تُصرف» — عدَّه، وبابَ الوصول إليه.
 *
 *   npm run check:due-unpaid
 *
 * وقعت هذه في ٢٨ أكتوبر ٢٠٢٦: رأى صاحبُ الشركة في الشاشة الرئيسية
 * «٢٤ دفعة مستحقة لم تُصرف»، ففتحها فوجد عقوداً لا إشكال فيها، وسأل:
 * «لماذا يظهر لي العقد في هذه الصفحة؟».
 *
 * وكانت ثلاثُ علّات:
 *
 *   ١) **التوزيع لا يُقرأ.** الدفعةُ تُسدَّد ضمن مبلغٍ موزَّعٍ على عدّة
 *      دفعات، والموزَّعُ لا رقمَ دفعةٍ واحدٍ له — فكان التنبيهُ يقرأ
 *      `installmentNumber` وحده ويحسبها لم تُصرف أبداً. وشاشةُ العقد
 *      تقرأ التوزيع بـ`contractPayments` منذ يومها، فكان المعروضُ في
 *      الشاشة «مدفوعة بالكامل» والتنبيهُ يقول «لم يُصرف منها شيء».
 *      سبعةٌ من أربعةٍ وعشرين من هذا الباب.
 *
 *   ٢) **الخصمُ لا يُطرح.** دفعةٌ قيمتُها سبعُ مئةٍ وخصمُها سبعُ مئة —
 *      وهي الأولى في العقد ٥٠٠٦ بعد إنهائه بالتراضي — صافيها صفرٌ ولا
 *      شيءَ فيها يُصرف، وكانت تُعرض مستحقّةً بقيمتها قبل الخصم.
 *
 *   ٣) **الإشعارُ يأخذ إلى العقود كلِّها.** ونصُّ طلبه: «لا يأخذني إلى
 *      جميع العقود وأبحث فيهم جميعهم لأعرف أيّ منهما قد اعتمدها
 *      المهندس… فهذا مضيعة للوقت، ومن الممكن أن يتم تأخير أي دفعة
 *      مستحقة». فصار الإشعارُ يحمل تصفيتَه إلى الشاشة.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createJiti } from "jiti";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

/* نهاياتُ السطور تُسوَّى: ملفُّ الشاشة بـCRLF */
const read = (p) =>
  fs.readFileSync(path.join(ROOT, p), "utf8").replace(/\r\n/g, "\n");

const jiti = createJiti(import.meta.url);
const { dueUnpaid, dueUnpaidOf, buildNotices } = await jiti.import(
  "../lib/notifications.ts"
);

/* ------------------------------------------------------------------ */
/* عقدٌ مصطنعٌ فيه أربعُ دفعاتٍ كلُّها مستحقّة                          */
/* ------------------------------------------------------------------ */

const due = (number, value, extra = {}) => ({
  number,
  value: String(value),
  approved: true,
  confirmed: true,
  ...extra,
});

const contract = {
  id: "c1",
  contractNumber: "9999",
  name: "مقاولٌ للفحص",
  project: "مشروع الفحص",
  workType: "فحص",
  counterpartyType: "مقاول",
  contractValue: 1000,
  installments: [
    due(1, 100), // تُسدَّد ضمن مبلغٍ موزَّع
    due(2, 100), // تُسدَّد برقم دفعتها
    due(3, 100, { deduction: "100", deductionReason: "أُسقطت بالتراضي" }),
    due(4, 100), // لم يُصرف منها شيء
  ],
};

const paid = (over) => ({
  id: "m" + Math.random(),
  entryNo: 1,
  fiscalYear: 2026,
  date: "2026-10-01",
  amount: 100,
  debitCode: "5120",
  creditCode: "1112",
  description: "دفعة",
  project: "مشروع الفحص",
  approval: "معتمدة",
  contractNumber: "9999",
  ...over,
});

const movements = [
  /* موزَّعٌ على الدفعة الأولى — ولا رقمَ دفعةٍ له */
  paid({ amount: 100, installmentSplits: [{ number: 1, amount: 100 }] }),
  /* ومسدَّدٌ برقم دفعته */
  paid({ installmentNumber: 2 }),
];

console.log("\nما سُدّد لا يُعرض مستحقّاً:\n");

const rows = dueUnpaidOf(contract, movements);
const numbers = rows.map((r) => r.installment.number);

check(
  "الدفعةُ المسدَّدةُ ضمن مبلغٍ موزَّع لا تُعدّ",
  !numbers.includes(1),
  `المعروض: ${numbers.join("، ") || "لا شيء"}`
);
check("والمسدَّدةُ برقم دفعتها لا تُعدّ", !numbers.includes(2));
check(
  "والمخصومةُ بالكامل لا تُعدّ — صافيها صفر",
  !numbers.includes(3),
  "فعرضُها مطالبةٌ بمالٍ أُسقط"
);
check(
  "والتي لم يُصرف منها شيءٌ تُعدّ وحدَها",
  numbers.length === 1 && numbers[0] === 4,
  `المعروض: ${numbers.join("، ") || "لا شيء"}`
);
check(
  "والقيمةُ المعروضةُ صافيةٌ بعد الخصم",
  rows.every((r) => r.value === 100)
);

console.log("\nوعقدُ العميل ليس من هذا الباب:\n");

check(
  "دفعاتُ العميل واردةٌ لا صادرة فلا تُعدّ",
  dueUnpaidOf({ ...contract, counterpartyType: "عميل" }, []).length === 0,
  "فقبضُ العميل لا يُطالَب به المقاول"
);
check(
  "والجامعُ يمرّ على العقود كلِّها",
  dueUnpaid([contract], movements).length === 1 &&
    dueUnpaid([contract], movements)[0].contract.contractNumber === "9999"
);

/* ------------------------------------------------------------------ */
/* والإشعارُ يحمل تصفيتَه                                              */
/* ------------------------------------------------------------------ */
console.log("\nوالإشعارُ يأخذك إلى ما فيه لا إلى الجميع:\n");

const notices = buildNotices({
  movements,
  contractors: [
    contract,
    /* وعقدٌ ثانٍ فيه مرحلةٌ اعتمدها المهندس ولم تُقرَّ بعد */
    {
      ...contract,
      id: "c2",
      contractNumber: "8888",
      installments: [{ number: 1, value: "500", approved: true, confirmed: false }],
    },
  ],
  projects: [],
  employees: [],
  attendance: [],
  quotations: [],
  workItems: [],
  audit: [],
  messages: [],
  backup: null,
  lastSeenAt: "2026-10-01T00:00:00.000Z",
  userName: "فاحص",
  today: "2026-10-28",
  backupEveryDays: 10,
});

const byId = (id) => notices.find((n) => n.id === id);

check(
  "تنبيهُ «لم تُصرف» يحمل تصفيتَه",
  byId("due-unpaid")?.focus === "مستحقة لم تُصرف",
  byId("due-unpaid")?.focus ?? "(بلا تصفية)"
);
check(
  "وتنبيهُ «تنتظر إقرارك» يحمل تصفيتَه",
  byId("pending-confirmations")?.focus === "تنتظر إقرارك",
  byId("pending-confirmations")?.focus ?? "(بلا تصفية)"
);
check(
  "وكلاهما إلى شاشة اعتماد المراحل",
  byId("due-unpaid")?.page === "اعتماد المراحل" &&
    byId("pending-confirmations")?.page === "اعتماد المراحل"
);

/* ------------------------------------------------------------------ */
/* والشاشةُ تعمل بها                                                   */
/* ------------------------------------------------------------------ */
console.log("\nوالشاشةُ تُصفّي بما جاءها:\n");

const page = read("app/page.tsx");

check(
  "زرُّ الإشعار يُمرّر تصفيتَه",
  /onGo\(notice\.page as string, notice\.focus\)/.test(page)
);
check(
  "والأمُّ تحفظها وتفتح الشاشة",
  /setApprovalsFocus\(focus \?\? null\);\s*\n\s*setPage\(target\);/.test(page)
);
check(
  "وشاشةُ الاعتماد تأخذها",
  /focus=\{approvalsFocus\}/.test(page) &&
    /onClearFocus=\{\(\) => setApprovalsFocus\(null\)\}/.test(page)
);
check(
  "ولا يُعرض معها عقدٌ ليس فيه ما جاء له",
  /if \(focus\) return focused\.has\(c\.id\);/.test(page)
);
check(
  "وتسبق حالَ العقد — فالمنتهي قد تكون فيه مرحلةٌ تنتظر إقراراً",
  page.indexOf("if (focus) return focused.has(c.id);") <
    page.indexOf('if (stateFilter === "الجارية") return !done;'),
  "وإلا أُخفي ما جاء له"
);
check(
  "والصفُّ المقصود يُعلَّم في الجدول",
  /focused\.get\(contract\.id\)\?\.has\(installment\.number\)/.test(page)
);
check(
  "ويُقال ما المعروضُ وكم هو",
  /معروضٌ ما جئتَ له وحده/.test(page.replace(/\s+/g, " ")),
  "فالإخفاءُ الصامت أسوأ من الزحام"
);
check(
  "وبابُ الرجوع إلى الكلِّ مفتوحٌ بضغطة",
  /onClick=\{onClearFocus\}/.test(page) && /اعرض كل العقود/.test(page)
);
check(
  "والعدُّ والعرضُ من دالّةٍ واحدة",
  /dueUnpaidOf\(c, movements\)/.test(page),
  "فلا يختلف ما يُقال عمّا يُرى"
);

console.log(
  bad === 0
    ? "\n✓ لا يُعرض مستحقّاً إلا ما لم يُصرف، ومن فتح التنبيه رأى ما فيه وحدَه"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
