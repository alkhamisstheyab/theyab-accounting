/**
 * يفحص المستحقات — ما وجب للعامل والمقاول ولم يُدفع.
 *
 *   node db/check-dues.mjs
 *
 * طلبها مجلس الإدارة والمهندسون: يُنجَز العمل فيستحقّ صاحبه أجره
 * ساعتَه — نقلةُ خشب، كرينٌ ليوم، أجرُ يوميةٍ لمن يعمل عند الطلب —
 * ثم تُؤجَّل الدفعة بالتراضي. فإذا جاء السداد بعد أسابيع لم يُعرف
 * المبلغ على وجهه، فيزيد أو ينقص، وكلاهما ظلم.
 *
 * والذي يُخشى منه:
 *   • أن يُدفع أكثر ممّا بقي، أو يُدفع الاستحقاق مرتين.
 *   • أن يُنسب السداد إلى غير عمله، فيظهر رجلٌ قُضي حقُّه وآخر لم يُقضَ.
 *   • أن يدخل الدفاتر مبلغٌ لم تُقرّه الإدارة.
 *   • أن يُنقص الذمّةَ سدادٌ لم يُعتمد — والمال لم يخرج بعد.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const {
  DUE_KINDS,
  allocate,
  allocationProblem,
  DUES_ACCOUNTS,
  buildDues,
  dueKind,
  isDue,
  isDueSettlement,
  payableDues,
  settlementProblem,
} = await jiti.import("../lib/dues.ts");

const TODAY = "2026-09-27";
let no = 2000;
const move = (over) => ({
  id: over.id ?? `m-${no}`,
  entryNo: no++,
  fiscalYear: 2026,
  date: "2026-09-01",
  movementType: "مصروف",
  description: "عمل",
  itemCode: "",
  itemName: "عمل",
  debitCode: "5120",
  creditCode: "2120",
  amount: 100,
  project: "مشروع",
  person: "أبو أحمد",
  paymentMethod: "آجل",
  party: "",
  source: "app",
  approval: "معتمدة",
  approvedBy: "ذياب",
  approvedAt: "2026-09-01T08:00:00.000Z",
  approvalNote: "",
  ...over,
});

console.log("\nالحسابات كما في دليل الشركة:\n");

check("مستحقات المقاولين 2120", DUES_ACCOUNTS.includes("2120"));
check("ورواتب وأجور مستحقة 2140", DUES_ACCOUNTS.includes("2140"));
check(
  "وكل نوع عملٍ له حساب مصروفه",
  DUE_KINDS.every((k) => /^5\d{3}$/.test(k.expense) && DUES_ACCOUNTS.includes(k.dues)),
  DUE_KINDS.map((k) => `${k.label}: ${k.expense}/${k.dues}`).join(" · ")
);
check("والأجر اليومي على حساب الأجور المستحقة", dueKind("daily").dues === "2140");

console.log("\nوالاستحقاق يُعرف من السداد:\n");

const due = move({ id: "due-1", amount: 120, description: "نقل خشب" });
const paid = move({
  id: "pay-1",
  date: "2026-09-20",
  debitCode: "2120",
  creditCode: "1111",
  amount: 50,
  dueId: "due-1",
  description: "سداد مستحق — نقل خشب",
});

check("الاستحقاق: المستحقات دائنة", isDue(due) && !isDueSettlement(due));
check("والسداد: المستحقات مدينة", isDueSettlement(paid) && !isDue(paid));

console.log("\nوالذمّة تُحسب على وجهها:\n");

let report = buildDues([due, paid], TODAY);
let row = report.dues[0];
check("المستحقّ ١٢٠", row.amount === 120);
check("والمدفوع ٥٠", row.paid === 50);
check("والمتبقّي ٧٠", row.remaining === 70, `${row.remaining}`);
check("وعمره من يوم العمل", row.ageDays === 26, `${row.ageDays} يوماً`);
check("والإجمالي على الشركة ٧٠", report.totalOwed === 70, `${report.totalOwed}`);

console.log("\nولا يُدفع أكثر ممّا بقي:\n");

check("زيادةٌ على المتبقّي تُردّ", settlementProblem(row, 80) !== "", settlementProblem(row, 80));
check("والمتبقّي بعينه يُقبل", settlementProblem(row, 70) === "");
check("وأقلُّ منه يُقبل — السداد الجزئي جائز", settlementProblem(row, 20) === "");
check("والصفر يُردّ", settlementProblem(row, 0) !== "");

console.log("\nولا يُدفع ما لم تُقرّه الإدارة:\n");

const waiting = move({
  id: "due-2",
  amount: 75,
  approval: "بانتظار الاعتماد",
  approvedBy: "",
  approvedAt: "",
  description: "كرين ليوم",
});
report = buildDues([due, paid, waiting], TODAY);
const pendingRow = report.dues.find((r) => r.movement.id === "due-2");
check("يُعرض بانتظار الإقرار", pendingRow.pending === true);
check("ولا يُسدَّد", settlementProblem(pendingRow, 75) !== "", settlementProblem(pendingRow, 75));
check(
  "ولا يدخل الذمّة حتى يُقرّ",
  report.totalOwed === 70 && report.totalWaiting === 75,
  `الذمّة ${report.totalOwed} · بالانتظار ${report.totalWaiting}`
);
check(
  "والقابل للسداد هو المُقرّ وحده",
  payableDues(report.dues).length === 1 &&
    payableDues(report.dues)[0].movement.id === "due-1"
);

console.log("\nوالسداد غير المعتمد لا يُنقص الذمّة — المال لم يخرج:\n");

const unapprovedPay = move({
  id: "pay-2",
  date: "2026-09-25",
  debitCode: "2120",
  creditCode: "1111",
  amount: 70,
  dueId: "due-1",
  approval: "بانتظار الاعتماد",
  approvedBy: "",
  approvedAt: "",
});
report = buildDues([due, paid, unapprovedPay], TODAY);
row = report.dues.find((r) => r.movement.id === "due-1");
check("المتبقّي كما هو ٧٠", row.remaining === 70, `${row.remaining}`);
check("وسجلُّ السداد يحمله ليُرى", row.settlements.length === 2);

console.log("\nوكلُّ سدادٍ إلى عمله لا بالأقدم فالأقدم:\n");

const first = move({ id: "due-a", date: "2026-09-01", amount: 100, description: "أول" });
const second = move({ id: "due-b", date: "2026-09-10", amount: 100, description: "ثانٍ" });
const onSecond = move({
  id: "pay-b",
  date: "2026-09-22",
  debitCode: "2120",
  creditCode: "1111",
  amount: 100,
  dueId: "due-b",
});
report = buildDues([first, second, onSecond], TODAY);
check(
  "المدفوع أقفل عمله هو",
  report.dues.find((r) => r.movement.id === "due-b").remaining === 0
);
check(
  "والأقدم ما زال قائماً",
  report.dues.find((r) => r.movement.id === "due-a").remaining === 100
);

console.log("\nوالأسماء تُجمع وأقدمُها يُعرف:\n");

report = buildDues([first, second, onSecond, waiting], TODAY);
const person = report.people.find((p) => p.person === "أبو أحمد");
check("له على الشركة ١٠٠", person.owed === 100, `${person.owed}`);
check("وبانتظار الإقرار ٧٥", person.waiting === 75, `${person.waiting}`);
check("وأقدم استحقاقٍ لم يُسدَّد", person.oldestDays === 26, `${person.oldestDays} يوماً`);

console.log("\nوسدادٌ بلا ربطٍ يُكشف ولا يُبتلع:\n");

const loose = move({
  id: "pay-x",
  debitCode: "2120",
  creditCode: "1111",
  amount: 30,
  dueId: undefined,
});
report = buildDues([first, loose], TODAY);
check("يُعدّ في الشاذّة", report.loose.length === 1);
check("ولا يُقفل استحقاقاً بعينه", report.dues[0].remaining === 100);

console.log("\nوالسداد جملةً يُوزَّع بالأقدم فالأقدم:\n");

/* لرجلٍ ثلاثة أعمال: ٥٠ ثم ١٠٠ ثم ٧٠ */
const w1 = move({ id: "w-1", date: "2026-09-01", amount: 50, description: "نقل خشب" });
const w2 = move({ id: "w-2", date: "2026-09-05", amount: 100, description: "كرين" });
const w3 = move({
  id: "w-3",
  date: "2026-09-12",
  amount: 70,
  description: "أجر يومية",
  creditCode: "2140",
});

let all = buildDues([w1, w2, w3], TODAY);
let owedTo = all.people.find((x) => x.person === "أبو أحمد");
check("له على الشركة ٢٢٠", owedTo.owed === 220, String(owedTo.owed));

const plan = allocate(owedTo.rows, 180);
check("يُوزَّع على ثلاثة أعمال", plan.lines.length === 3, String(plan.lines.length));
check(
  "الأقدم يُقفل أولاً",
  plan.lines[0].row.movement.id === "w-1" && plan.lines[0].closes
);
check(
  "ثم الذي يليه",
  plan.lines[1].row.movement.id === "w-2" && plan.lines[1].closes
);
check(
  "والأحدث يبقى بعضه",
  plan.lines[2].amount === 30 && !plan.lines[2].closes,
  `يُدفع منه ${plan.lines[2].amount} من 70`
);
check("ولا يفضل شيء", plan.extra === 0);
check(
  "ومجموع التوزيع هو المبلغ",
  plan.splits.reduce((sum, x) => sum + x.amount, 0) === 180
);
check(
  "وزيادةٌ على مجموع ما له تُردّ",
  allocationProblem(owedTo.rows, 250) !== "",
  allocationProblem(owedTo.rows, 250)
);
check("ومجموعه بعينه يُقبل", allocationProblem(owedTo.rows, 220) === "");

/* والسداد الموزَّع يُقرأ في الذمّة كما يُقرأ المفرد */
const paidBulk = move({
  id: "pay-bulk",
  date: "2026-09-25",
  debitCode: "2120",
  creditCode: "1111",
  amount: 150,
  dueSplits: [
    { dueId: "w-1", amount: 50 },
    { dueId: "w-2", amount: 100 },
  ],
});
all = buildDues([w1, w2, w3, paidBulk], TODAY);
check(
  "ما أُقفل صار صفراً",
  all.dues.find((r) => r.movement.id === "w-1").remaining === 0 &&
    all.dues.find((r) => r.movement.id === "w-2").remaining === 0
);
check(
  "وما لم يُمَسّ باقٍ",
  all.dues.find((r) => r.movement.id === "w-3").remaining === 70
);
owedTo = all.people.find((x) => x.person === "أبو أحمد");
check("والباقي له ٧٠", owedTo.owed === 70, String(owedTo.owed));

const waitingBulk = {
  ...paidBulk,
  id: "pay-bulk-2",
  approval: "بانتظار الاعتماد",
  approvedBy: "",
  approvedAt: "",
};
all = buildDues([w1, w2, w3, waitingBulk], TODAY);
check(
  "والموزَّع غير المعتمد لا يُنقص الذمّة",
  all.people.find((x) => x.person === "أبو أحمد").owed === 220
);

console.log("\nوالشاشة والصلاحية:\n");

const page = fs.readFileSync("app/page.tsx", "utf8");
check("للمستحقات شاشتها", page.includes('page === "المستحقات"'));
check("والمهندس يُثبت", page.includes('canCreate={allow("dues.create")}'));
check(
  "ويُقيَّد مدين المصروف / دائن المستحقات",
  page.includes("debitCode: kind.expense,") && page.includes("creditCode: kind.dues,")
);
check(
  "ولا يدخل الدفاتر حتى يُقرّ",
  page.includes('approval: "بانتظار الاعتماد",')
);
check("والسداد يُربط باستحقاقه", page.includes("dueId: row.movement.id,"));
check(
  "والسداد جملةً يُوزَّع ويُعاين قبل الحفظ",
  page.includes("const plan = allocate(person.rows, payment.amount);") &&
    page.includes("dueSplits: lines.map((l) => ({")
);
check(
  "ويُشطر القيد بحساب المستحقات لا بالعمل",
  page.includes("const byDuesAccount = new Map<string, typeof plan.lines>();")
);
check(
  "والاسم يُسوّى عند المصدر — فلا ينشطر رصيدٌ بفراغ",
  page.includes('form.person.trim().replace(/\\s+/g, " ")')
);

const permissions = fs.readFileSync("lib/permissions.ts", "utf8");
check("وللمهندس صلاحيتها", permissions.includes('"dues.create",'));
check(
  "مقصورةً على المستحقات — لا إدخال قيدٍ آخر",
  !permissions.includes('"movements.create",\n      "dues')
);

console.log(
  bad === 0
    ? "\n✓ يُثبَّت الحقّ يوم يقع، ويُقرّ قبل أن يدخل الدفاتر، ولا يُدفع مرتين"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
