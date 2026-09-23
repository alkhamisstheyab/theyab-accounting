/**
 * يفحص تعبئة فترة الحضور الماضية.
 *
 *   node db/check-attendance-fill.mjs <نسخة.json>
 *
 * الحضور كان ورقياً، والتسجيل اليومي يبدأ بعد أيام. فطلب صاحب الشركة في
 * ٢٣ سبتمبر ٢٠٢٦ أن تُملأ الفترة الماضية حضوراً كاملاً، ويُستثنى من
 * سُجّل له غيابٌ أو مرضيةٌ أو إجازة.
 *
 * والذي يُخشى منه:
 *   • أن تطمس التعبئةُ غياباً مسجَّلاً فيُدفع أجرُ يومٍ لم يُعمل.
 *   • أن تُملأ أيامٌ قبل تعيين الموظف أو بعد انتهاء خدمته.
 *   • أن تُملأ أيامٌ في المستقبل.
 *   • أن يُعلَّم يوم الراحة عملاً، فيُحتسب إضافياً أو يختلّ الأجر.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-attendance-fill.mjs <نسخة.json>");
  process.exit(1);
}

const { parseBackup } = await jiti.import("../lib/storage.ts");
const { WEEK_DAYS, defaultPayrollSettings, computePayrollLine } = await jiti.import(
  "../lib/payroll.ts"
);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const state = parseBackup(fs.readFileSync(BACKUP, "utf8"));
const settings = state.payrollSettings ?? defaultPayrollSettings();
const employees = state.employees.filter((e) => e.active);
check("موظفون على رأس العمل", employees.length > 0, String(employees.length));

const TODAY = "2026-09-23";
const monthDays = (month) => {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
};
const dayName = (iso) => WEEK_DAYS[new Date(iso).getUTCDay()];
const monthsBetween = (from, to) => {
  const list = [];
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); ) {
    list.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    if (list.length > 120) break;
  }
  return list;
};

/** التعبئة كما تفعلها الشاشة */
const fill = (existing, chosen, from, to) => {
  const taken = new Set(existing.map((r) => `${r.employeeId}|${r.date}`));
  const additions = [];
  for (const month of monthsBetween(from, to)) {
    for (const date of monthDays(month)) {
      if (date > TODAY) continue;
      for (const employee of chosen) {
        if (employee.hireDate && date < employee.hireDate) continue;
        if (employee.endDate && date > employee.endDate) continue;
        if (taken.has(`${employee.id}|${date}`)) continue;
        const rest = dayName(date) === employee.restDay;
        additions.push({
          id: `${employee.id}|${date}`,
          employeeId: employee.id,
          date,
          status: rest ? "راحة أسبوعية" : "حاضر",
          hours: rest ? 0 : settings.dailyHours,
          overtimeHours: 0,
          restDayHours: 0,
          holidayHours: 0,
          note: "",
        });
      }
    }
  }
  return additions;
};

/* استثناءاتٌ مسجَّلة قبل التعبئة: غياب ومرضية وإجازة */
const one = employees[0];
const existing = [
  { id: "a", employeeId: one.id, date: "2026-08-03", status: "غياب بدون عذر", hours: 0, overtimeHours: 0, restDayHours: 0, holidayHours: 0, note: "" },
  { id: "b", employeeId: one.id, date: "2026-08-04", status: "إجازة مرضية", hours: 0, overtimeHours: 0, restDayHours: 0, holidayHours: 0, note: "" },
  { id: "c", employeeId: one.id, date: "2026-08-05", status: "إجازة سنوية", hours: 0, overtimeHours: 0, restDayHours: 0, holidayHours: 0, note: "" },
];

console.log("\nالتعبئة تملأ الناقص ولا تمسّ المسجَّل:\n");

const added = fill(existing, employees, "2026-08", "2026-09");
const all = [...existing, ...added];

check(
  "لا يومَ مكرَّر لموظفٍ واحد",
  new Set(all.map((r) => `${r.employeeId}|${r.date}`)).size === all.length,
  `${all.length} سجلاً`
);
for (const e of existing) {
  const kept = all.filter((r) => r.employeeId === e.employeeId && r.date === e.date);
  check(
    `«${e.status}» في ${e.date} باقية كما هي`,
    kept.length === 1 && kept[0].status === e.status
  );
}
check(
  "ولا يومَ في المستقبل",
  all.every((r) => r.date <= TODAY),
  `آخر يوم ${all.map((r) => r.date).sort().at(-1)}`
);
const early = employees.filter((e) => e.hireDate);
check(
  "ولا يومَ قبل تاريخ التعيين",
  added.every((r) => {
    const e = employees.find((x) => x.id === r.employeeId);
    return !e.hireDate || r.date >= e.hireDate;
  }),
  `${early.length} موظفاً له تاريخ تعيين`
);
check(
  "ويوم الراحة يُعلَّم راحةً بلا ساعات",
  added
    .filter((r) => {
      const e = employees.find((x) => x.id === r.employeeId);
      return dayName(r.date) === e.restDay;
    })
    .every((r) => r.status === "راحة أسبوعية" && r.hours === 0)
);
check(
  "وسائر الأيام حضورٌ بساعات الدوام",
  added
    .filter((r) => r.status === "حاضر")
    .every((r) => r.hours === settings.dailyHours)
);

console.log("\nواختيار موظفٍ بعينه:\n");

const only = fill(existing, [one], "2026-08", "2026-08");
check(
  "لا يُملأ إلا للمختار",
  only.every((r) => r.employeeId === one.id),
  `${one.name} · ${only.length} يوماً`
);
check(
  "وإعادة التعبئة لا تضيف شيئاً",
  fill([...existing, ...only], [one], "2026-08", "2026-08").length === 0
);

console.log("\nوأثرها في الراتب:\n");

const month = (list, id) => list.filter((r) => r.employeeId === id && r.date.startsWith("2026-08"));
const line = computePayrollLine({
  employee: one,
  attendance: month(all, one.id),
  settings,
});
check(
  "الغياب بدون عذر يُخصم — فالتعبئة لم تطمسه",
  line.absentDays === 1 && line.absenceDeduction > 0,
  `${line.absentDays} يوم · خصم ${line.absenceDeduction.toFixed(3)}`
);
check(
  "والمرضية محسوبةٌ مرضيةً",
  line.sickDays === 1,
  `${line.sickDays} يوم`
);

console.log("\nوالحضور خارج مدّة الخدمة يُكشف ويُحذف:\n");

/* من التحق متأخراً وقد مُلئ له حضورٌ قبل تاريخه */
const late = { ...one, hireDate: "2026-08-10" };
const outside = [...existing, ...added].filter((r) => {
  const e = r.employeeId === late.id ? late : employees.find((x) => x.id === r.employeeId);
  if (!e) return false;
  if (e.hireDate && r.date < e.hireDate) return true;
  if (e.endDate && r.date > e.endDate) return true;
  return false;
});
check(
  "يُكشف الحضور قبل تاريخ التعيين",
  outside.length > 0 && outside.every((r) => r.employeeId === late.id && r.date < late.hireDate),
  `${outside.length} يوماً`
);
const cleaned = [...existing, ...added].filter((r) => !outside.some((o) => o.id === r.id));
check(
  "وحذفُه لا يمسّ حضور غيره",
  cleaned.filter((r) => r.employeeId !== late.id).length ===
    [...existing, ...added].filter((r) => r.employeeId !== late.id).length
);
check(
  "ولا يبقى بعده يومٌ خارج المدّة",
  !cleaned.some((r) => r.employeeId === late.id && r.date < late.hireDate)
);

/* والشاشة */
const page = fs.readFileSync("app/page.tsx", "utf8");
check("وللشاشة زرّ «املأ الفترة حضوراً»", page.includes("املأ الفترة حضوراً"));
check("ويُختار فيها الموظفون أو الكل", page.includes("setFillWho"));
check("ولا تمسّ المسجَّل", page.includes("if (taken.has(`${employee.id}|${date}`)) continue;"));
check("ولافتةٌ تكشف الحضور خارج مدّة الخدمة", page.includes("outsideService"));

console.log(
  bad === 0
    ? "\n✓ الفترة تُملأ حضوراً، والغياب والمرضية والإجازة تبقى كما سُجّلت"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
