/**
 * يفحص الجزاء على المخالفة.
 *
 *   npm run check:penalty
 *
 * الجزاء خصمٌ من أجر رجل، فهو أخطر ما يُكتب في الحضور. وطلبه صاحب
 * الشركة يوم فُتح النظام للمهندسين: من يرى التقصير في الموقع غير من
 * يملك المال في المكتب.
 *
 * والذي يُخشى منه:
 *   • أن يُخصم ما لم تُقرّه الإدارة — فيصير لكل من يسجّل الحضور يدٌ على
 *     أجور الناس.
 *   • أن يُحفظ جزاءٌ بلا سببٍ مكتوب، فلا يُدافَع عنه بعد شهور.
 *   • أن يُجاوز حدّ القانون بلا أن يعلم صاحبه.
 *   • أن يُدسّ في «خصومات أخرى» فلا يعرف الموظف لماذا نقص أجره.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { computePayrollLine, defaultPayrollSettings, payrollTotals, PENALTY_MAX_DAYS, dailyWage } =
  await jiti.import("../lib/payroll.ts");

const settings = { ...defaultPayrollSettings(), socialInsuranceEnabled: false };

const worker = {
  id: "e1",
  name: "عامل",
  active: true,
  wageType: "شهري",
  basicWage: 300,
  registeredWage: 300,
  allowances: [],
  department: "موقع",
  isKuwaiti: false,
  restDay: "الجمعة",
  hireDate: "2025-01-01",
  endDate: "",
  iban: "",
  wageAccount: "",
  passportNumber: "",
  civilId: "",
  nationality: "",
  jobTitle: "",
  project: "",
  code: "1",
  notes: "",
};

const day = (over) => ({
  id: over.date,
  employeeId: "e1",
  date: over.date,
  status: "حاضر",
  hours: 8,
  overtimeHours: 0,
  restDayHours: 0,
  holidayHours: 0,
  note: "",
  ...over,
});

const month = (days) =>
  computePayrollLine({ employee: worker, attendance: days, settings });

console.log("\nلا يُخصم إلا ما أُقرّ:\n");

const pending = month([
  day({ date: "2026-09-01", penalty: 20, penaltyReason: "تركَ الموقع", penaltyBy: "م. نوح" }),
]);
check("المُثبت الذي لم يُقرَّ لا يمسّ أجراً", pending.penalties === 0, String(pending.penalties));
check("والصافي كامل", pending.net === 300, String(pending.net));
check("ولا يظهر في الكشف", pending.penaltyLines.length === 0);

const approved = month([
  day({
    date: "2026-09-01",
    penalty: 20,
    penaltyReason: "تركَ الموقع",
    penaltyBy: "م. نوح",
    penaltyApproved: true,
    penaltyApprovedBy: "ذياب الخميس",
  }),
]);
check("والمُقرّ يُخصم", approved.penalties === 20, String(approved.penalties));
check("وينقص الصافي بقدره", approved.net === 280, String(approved.net));
check("ويظهر في الكشف بيومه وسببه", approved.penaltyLines.length === 1);
check(
  "وسببُه محفوظٌ معه",
  approved.penaltyLines[0].reason === "تركَ الموقع" &&
    approved.penaltyLines[0].date === "2026-09-01"
);

console.log("\nوهو غير خصم الغياب:\n");

const both = month([
  day({ date: "2026-09-01", status: "غياب بدون عذر", hours: 0 }),
  day({
    date: "2026-09-02",
    penalty: 10,
    penaltyReason: "إهمال",
    penaltyApproved: true,
  }),
]);
check("الغياب يُخصم أجرَ يومه", both.absenceDeduction === 10, String(both.absenceDeduction));
check("والجزاء فوقه", both.penalties === 10, String(both.penalties));
check(
  "ومجموع الخصم يَسَعهما",
  both.totalDeductions === 20,
  String(both.totalDeductions)
);

console.log("\nوتُجمع جزاءات الشهر:\n");

const many = month([
  day({ date: "2026-09-01", penalty: 5, penaltyReason: "أ", penaltyApproved: true }),
  day({ date: "2026-09-08", penalty: 7.5, penaltyReason: "ب", penaltyApproved: true }),
  day({ date: "2026-09-15", penalty: 2.5, penaltyReason: "ج" }),
]);
check("المُقرّ منها وحده", many.penalties === 12.5, String(many.penalties));
check("وسطران في الكشف لا ثلاثة", many.penaltyLines.length === 2);
check(
  "وترتيبها بتاريخها",
  many.penaltyLines[0].date < many.penaltyLines[1].date
);

console.log("\nوحدّ القانون يُنبَّه إليه ولا يُمنع:\n");

const wage = dailyWage(worker, settings);
const cap = wage * PENALTY_MAX_DAYS;
const over = month([
  day({
    date: "2026-09-01",
    penalty: cap + 1,
    penaltyReason: "مخالفة جسيمة",
    penaltyApproved: true,
  }),
]);
check(`أجر اليوم ${wage} وحدّ الشهر ${cap}`, cap > 0);
check("ويُخصم ما قرّره صاحبه", over.penalties === cap + 1, String(over.penalties));
check(
  "ويُنبَّه إلى تجاوز الحدّ",
  over.warnings.some((w) => w.includes("الجزاءات")),
  over.warnings.join(" | ") || "لا تنبيه"
);
const under = month([
  day({ date: "2026-09-01", penalty: cap, penaltyReason: "ح", penaltyApproved: true }),
]);
check(
  "وما بلغ الحدّ ولم يتجاوزه لا يُنبَّه إليه",
  !under.warnings.some((w) => w.includes("الجزاءات"))
);

console.log("\nوفي الإجماليات بندٌ مستقلّ:\n");

const totals = payrollTotals([approved, many]);
check("يُجمع الجزاء على حدة", totals.penalties === 32.5, String(totals.penalties));
check(
  "ولا يُدسّ في «خصومات أخرى»",
  approved.otherDeductions === 0 && approved.penalties === 20
);

/* ---- الشاشة ---- */
console.log("\nوالشاشة تُوفي بما وُصف:\n");

const page = fs.readFileSync("app/page.tsx", "utf8");
check("للجزاء لوحةٌ في الحضور والانصراف", page.includes("جزاء على مخالفة"));
check("ويُثبت على يومٍ بعينه", page.includes('<Field label="يوم المخالفة">'));
check("ولا يُحفظ بلا سبب", page.includes('setMessage("اكتب سبب الجزاء")'));
check("ويُستأذن عند تجاوز الحدّ", page.includes("يتجاوز حدّ القانون للمخالفة الواحدة"));
check(
  "ومن لا يملك الإقرار يُثبت ويَنتظر",
  page.includes("const settled = canApprovePenalty;")
);
check("وزرُّ الإقرار لمن يملكه وحده", page.includes("!row.penaltyApproved && canApprovePenalty"));
check("ويُرفع الجزاء إن بطل سببه", page.includes("const dropPenalty ="));
check("وعمودُه في المسيّر مستقلّ", page.includes("<Th>جزاءات</Th>"));
check(
  "وفي كشف الراتب يومُه وسببُه",
  page.includes("...line.penaltyLines.map(")
);
check(
  "ويُسجَّل في سجلّ التدقيق",
  page.includes('`جزاء ${fmt(amount)} د.ك — ${employee.name} — ${penalty.date}`')
);

/* ---- الترحيل في التخزين ---- */
console.log("\nوالحقل يعبر دورة التخزين:\n");

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
  addEventListener() {},
  removeEventListener() {},
};
globalThis.localStorage = globalThis.window.localStorage;
const { normalizeState } = await jiti.import("../lib/storage.ts");

const out = normalizeState({
  attendance: [
    {
      id: "a1",
      employeeId: "e1",
      date: "2026-09-01",
      status: "حاضر",
      hours: 8,
      penalty: 15,
      penaltyReason: "إهمال عدّة",
      penaltyBy: "م. نوح",
      penaltyApproved: true,
      penaltyApprovedBy: "ذياب",
    },
    { id: "a2", employeeId: "e1", date: "2026-09-02", status: "حاضر", hours: 8 },
  ],
});
const [a1, a2] = out.attendance;
check("المبلغ يعبر", a1.penalty === 15);
check("والسبب", a1.penaltyReason === "إهمال عدّة");
check("ومن أثبته ومن أقرّه", a1.penaltyBy === "م. نوح" && a1.penaltyApprovedBy === "ذياب");
check("والإقرار", a1.penaltyApproved === true);
check(
  "ويومٌ بلا جزاءٍ يبقى بلا جزاء — لا صفراً",
  a2.penalty === undefined && a2.penaltyApproved === undefined
);
const again = normalizeState(JSON.parse(JSON.stringify(out)));
check("ويعبر الدورة ثانيةً", again.attendance[0].penalty === 15);

console.log(
  bad === 0
    ? "\n✓ لا يُخصم إلا ما أُقرّ، ولا يُحفظ إلا بسببه"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
