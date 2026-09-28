/**
 * يفحص كشفَي التحويل البنكي.
 *
 *   node db/check-transfer-sheets.mjs [نسخة.json]
 *
 * الرواتب تنزل بكشفين لا بكشفٍ واحد: الأول الأجر المسجَّل في ملفّ الشركة
 * بوزارة الشؤون — يُرفع كما هو في الملفّ — والثاني تكملةُ الأجر الفعلي.
 * وكان صاحب الشركة يقسمهما بيده كل شهر.
 *
 * والذي يُخشى منه:
 *   • أن يُنقص المسجَّل بخصمٍ، فيظهر الموظف في الوزارة مأخوذاً من راتبه.
 *   • أن يُحوَّل لمن لا أجر مسجَّل له في كشف الشؤون — صاحبُ المكافأة ومن
 *     لم يُسجَّل بعد.
 *   • ألّا يساوي الكشفان مجموعَ الصافي، فيُدفع أكثر أو أقلّ.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { transferSheets } = await jiti.import("../lib/payroll.ts");

const worker = (over) => ({
  id: over.id,
  name: over.name,
  active: true,
  registeredWage: 0,
  iban: "KW00TEST",
  ...over,
});
const line = (id, name, net) => ({ employeeId: id, employeeName: name, net });

console.log("\nالكشفان يقتسمان الصافي:\n");

const employees = [
  worker({ id: "a", name: "عاملٌ مسجَّل", registeredWage: 100 }),
  worker({ id: "b", name: "صاحب مكافأة", registeredWage: 0 }),
  worker({ id: "c", name: "مسجَّلٌ بلا بدل", registeredWage: 100 }),
];
let out = transferSheets(
  [line("a", "عاملٌ مسجَّل", 280), line("b", "صاحب مكافأة", 300), line("c", "مسجَّلٌ بلا بدل", 100)],
  employees
);

check("كشف الشؤون = مجموع المسجَّل", out.registeredTotal === 200, String(out.registeredTotal));
check("وكشف التكملة = الباقي", out.topUpTotal === 480, String(out.topUpTotal));
check(
  "ومجموعهما هو الصافي بلا زيادةٍ ولا نقص",
  out.registeredTotal + out.topUpTotal === out.netTotal && out.netTotal === 680,
  String(out.netTotal)
);
check(
  "وصاحب المكافأة كلُّه في التكملة",
  out.lines.find((r) => r.employeeId === "b").registered === 0 &&
    out.lines.find((r) => r.employeeId === "b").topUp === 300
);
check(
  "ومن أجره الفعلي كالمسجَّل لا تكملة له",
  out.lines.find((r) => r.employeeId === "c").topUp === 0
);

console.log("\nوالخصم من التكملة لا من المسجَّل:\n");

/* عاملٌ مسجَّلٌ بمئة، أجره الفعلي 280، خُصم منه 100 */
out = transferSheets([line("a", "عاملٌ مسجَّل", 180)], [employees[0]]);
check("المسجَّل كما هو", out.lines[0].registered === 100, String(out.lines[0].registered));
check("والخصم كلُّه من التكملة", out.lines[0].topUp === 80, String(out.lines[0].topUp));
check("ولا نقص في الرفع للوزارة", out.shortfalls.length === 0);

console.log("\nفإن تجاوز الخصمُ التكملةَ نُبِّه إليه:\n");

out = transferSheets([line("a", "عاملٌ مسجَّل", 60)], [employees[0]]);
check("المسجَّل نقص اضطراراً", out.lines[0].registered === 60);
check("ولا تكملة", out.lines[0].topUp === 0);
check(
  "ويُكشف ليُراجَع قبل الرفع",
  out.shortfalls.length === 1 && out.shortfalls[0].employeeName === "عاملٌ مسجَّل"
);

console.log("\nوالصافي الصفر لا يُحوَّل له شيء:\n");
out = transferSheets([line("a", "عاملٌ مسجَّل", 0)], [employees[0]]);
check("لا في هذا ولا في ذاك", out.registeredTotal === 0 && out.topUpTotal === 0);

/* ---- وعلى ملفّات الشركة ---- */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
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
  const { parseBackup } = await jiti.import("../lib/storage.ts");
  const state = parseBackup(fs.readFileSync(BACKUP, "utf8"));
  const staff = state.employees.filter((e) => e.active);

  /* صافٍ افتراضي: الأجر الفعلي وبدلاته، بلا خصم — لقياس القسمة وحدها */
  const rows = staff.map((e) => ({
    employeeId: e.id,
    employeeName: e.name,
    net:
      (Number(e.basicWage) || 0) +
      (e.allowances ?? []).reduce((s, a) => s + (Number(a.amount) || 0), 0),
  }));
  const real = transferSheets(rows, staff);

  console.log("\nوعلى ملفّات الشركة (بلا خصومات):\n");
  console.log(`     كشف الشؤون: ${real.registeredTotal.toFixed(3)} د.ك`);
  console.log(`     كشف التكملة: ${real.topUpTotal.toFixed(3)} د.ك`);
  console.log(`     المجموع: ${real.netTotal.toFixed(3)} د.ك · ${real.lines.length} موظفاً`);
  const noIban = real.lines.filter((r) => !r.iban);
  check(
    "ولكلٍّ آيبانٌ يُحوَّل إليه",
    noIban.length === 0,
    noIban.length ? noIban.map((r) => r.employeeName).join("، ") : "الجميع"
  );
}

console.log("\nوالكشفان يُطبعان ليُنقلا إلى البنك:\n");

const page = fs.readFileSync("app/page.tsx", "utf8");
check("للكشفين ورقةٌ مستقلّة", page.includes("function TransferSheet({"));
check("وزرٌّ يفتحها", page.includes("🖨 اطبع الكشفين"));
check(
  "وكلُّ كشفٍ في صفحةٍ وحده — فهما يُرفعان منفصلين",
  page.includes('breakBefore: "page"')
);
check(
  "وفيها ترويسة الشركة وشهر المسيّر",
  page.includes("{company.name}") && page.includes("{monthName}")
);
check("والآيبان لكل سطر", page.includes("{row.iban || \"—\"}"));
check(
  "والمجموع بالحروف كما في السندات",
  page.includes("amountInWords(part.total)")
);
check("وموضع توقيعٍ واعتماد", page.includes("اعتمده"));
check(
  "واللوحة نفسها لم تعد تُخفى عند الطباعة",
  !page.includes('<div className="mt-6 rounded-xl border border-slate-200 p-4 no-print">')
);

console.log(
  bad === 0
    ? "\n✓ كشفان يقتسمان الصافي، والمسجَّل يُرفع كما هو في الملفّ"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
