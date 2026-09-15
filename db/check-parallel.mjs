/**
 * يفحص التشغيل المتوازي: يومُ عملٍ كاملٍ يُعاد تمثيله.
 *
 *   node db/check-parallel.mjs <نسخة.json>
 *
 * في المرحلة الرابعة يبقى المتصفّح هو المرجع، ويُكتب إلى الخادم ما
 * تغيّر وحده بعد كل حفظ. والسؤال الذي يقوم عليه كل شيء:
 *
 *   بعد يومٍ من الإدخال والتعديل والحذف — هل يصير عند الخادم ما عند
 *   المتصفّح بالضبط؟
 *
 * فيُمثَّل يومٌ كامل: حركاتٌ تُدخَل وتُعتمد وتُحذف، وعقدٌ يُبرَم ودفعةٌ
 * تُسدَّد، وعرضٌ يصير فاتورة، وموظفٌ يُسجَّل حضورُه، وإعداداتٌ تُغيَّر.
 * ولا يُقرأ من الخادم بينها حرف — كما لن يُقرأ في العمل الحقيقي.
 *
 * ثم تُقارَن النسختان في النهاية صفّاً صفّاً.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { createJiti } from "jiti";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-parallel.mjs <نسخة.json>");
  process.exit(1);
}

const { parseBackup, emptyState, newId } = await jiti.import("../lib/storage.ts");
const { diffStates, compareStates, countChanges, isEmpty, snapshotForServer } =
  await jiti.import("../lib/changes.ts");
const { ALL_FIELDS } = await jiti.import("../lib/collections.ts");
const { readState } = await jiti.import("../lib/server/state.ts");
const { applyChanges } = await jiti.import("../lib/server/writes.ts");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

/* ------------------------------------------------------------------ */
/* لا حقل يُنسى                                                        */
/* ------------------------------------------------------------------ */
/*
  حقلٌ يُضاف إلى AppState ولا يُذكر في lib/collections.ts لا يصل الخادم
  أبداً، ولا يظهر ذلك إلا بعد شهور حين يُسأل عن رقمٍ فلا يوجد. وقد وقع
  مثله ثلاث مرات في هذا النظام قبل اليوم.
*/
const stateFields = Object.keys(emptyState());
const known = new Set(ALL_FIELDS);
const forgotten = stateFields.filter((f) => !known.has(f));
check(
  `كل حقول الحالة معروفة (${stateFields.length})`,
  forgotten.length === 0,
  forgotten.join("، ")
);

/* ------------------------------------------------------------------ */
/* القاعدة                                                             */
/* ------------------------------------------------------------------ */
const dir = path.join(HERE, "..", ".parallel-check");
fs.rmSync(dir, { recursive: true, force: true });

console.log("\nينقل النسخة إلى قاعدة محلية…");
execFileSync(
  process.execPath,
  [path.join(HERE, "migrate.mjs"), BACKUP, "--local", "--keep", dir],
  { stdio: ["ignore", "ignore", "inherit"] }
);

const { PGlite } = await import("@electric-sql/pglite");
const db = new PGlite(dir);

/** ما عند المتصفّح */
let local = parseBackup(fs.readFileSync(BACKUP, "utf8"));
/** صورةُ ما عند الخادم، كما يعرفها المتصفّح — ولا تُقرأ من القاعدة بعدها */
let sent = await readState(db);

console.log(
  `\nالبداية: ${local.movements.length} حركة · ${local.contractors.length} عقداً\n`
);

/* أول حفظ: لا شيء تغيّر */
check("حفظٌ بلا تغيير لا يرسل شيئاً", isEmpty(diffStates(sent, local)));

/* ------------------------------------------------------------------ */
/* يوم العمل                                                           */
/* ------------------------------------------------------------------ */

const clone = (o) => JSON.parse(JSON.stringify(o));
const steps = [];

/** خطوة: تُغيّر المتصفّح، ثم يُرسل الفرق وحده */
async function step(label, mutate, expectRows) {
  mutate();
  const changes = diffStates(sent, local);
  const n = countChanges(changes);
  await applyChanges(db, changes, "فاحص");
  /* المتصفّح يحفظ صورة ما أرسله — لا حالته هو — ولا يقرأ من الخادم */
  sent = snapshotForServer(local);
  steps.push({ label, n });
  check(
    `${label}`,
    expectRows == null ? n > 0 : n === expectRows,
    `${n} صفّاً`
  );
}

/* ---- حركة تُدخل ---- */
const movementLike = clone(local.movements[0]);
const added = {
  ...movementLike,
  id: newId(),
  entryNo: 99201,
  date: "2026-09-15",
  description: "أسمنت — فحص التوازي",
  amount: 123.456,
  approval: "بانتظار الاعتماد",
  approvedBy: "",
  approvedAt: "",
};
await step("حركة تُدخل", () => local.movements.push(added), 1);

/* ---- وسجل التدقيق يُكتب معها، كما يفعل النظام ---- */
await step(
  "وسجلّها يُكتب معها",
  () =>
    local.audit.push({
      id: newId(),
      at: new Date().toISOString(),
      user: "المحاسب",
      action: "إضافة",
      entity: "حركة",
      summary: "أسمنت — فحص التوازي",
    }),
  1
);

/* ---- المدير يعتمدها ---- */
await step(
  "المدير يعتمدها",
  () => {
    const m = local.movements.find((x) => x.id === added.id);
    m.approval = "معتمدة";
    m.approvedBy = "المدير العام";
    m.approvedAt = new Date().toISOString();
  },
  1
);

/* ---- حركة تُحذف ---- */
const doomed = local.movements[5];
await step(
  "حركة تُحذف",
  () => {
    local.movements = local.movements.filter((m) => m.id !== doomed.id);
  },
  1
);

/* ---- عقد يُبرم بدفعاته ---- */
const contractLike = clone(local.contractors[0]);
const contract = {
  ...contractLike,
  id: newId(),
  contractNumber: "9901",
  name: "مقاول فحص التوازي",
  contractValue: 25000,
  contractDate: "2026-09-15",
  installments: [
    { no: 1, stage: "الأساسات", amount: 10000, status: "غير مدفوعة" },
    { no: 2, stage: "الهيكل", amount: 15000, status: "غير مدفوعة" },
  ],
};
await step("عقد يُبرم بدفعتيه", () => local.contractors.push(contract), 1);

/* ---- دفعة تُسدَّد: العقد يتغيّر والحركة تُدخل ---- */
await step(
  "دفعة تُسدَّد",
  () => {
    const c = local.contractors.find((x) => x.id === contract.id);
    c.installments[0].status = "مدفوعة";
    c.installments[0].paidDate = "2026-09-15";
    local.movements.push({
      ...movementLike,
      id: newId(),
      entryNo: 99202,
      date: "2026-09-15",
      description: "دفعة أولى — مقاول فحص التوازي",
      amount: 10000,
      contractNumber: "9901",
      installmentNumber: 1,
    });
  },
  2
);

/* ---- مشروع يُضاف ---- */
await step(
  "مشروع يُضاف",
  () =>
    local.projects.push({
      id: newId(),
      name: "مشروع فحص التوازي",
      budget: 300000,
      startDate: "2026-09-15",
      status: "نشط",
    }),
  1
);

/* ---- موظف وحضوره ---- */
const employee = { id: newId(), name: "عامل فحص", active: true };
await step(
  "موظف يُسجَّل وحضورُه",
  () => {
    local.employees.push(employee);
    local.attendance.push({
      employeeId: employee.id,
      date: "2026-09-15",
      status: "حاضر",
      hours: 8,
      overtimeHours: 2,
      note: "",
    });
  },
  2
);

/* ---- الحضور يُصحَّح: اليوم نفسه لا يتضاعف ---- */
await step(
  "الحضور يُصحَّح فلا يتضاعف",
  () => {
    const a = local.attendance.find((x) => x.employeeId === employee.id);
    a.hours = 7;
    a.note = "خرج مبكراً";
  },
  1
);

/* ---- المجموعات التي تُكتب كاملةً ---- */
await step(
  "شخص يُضاف إلى الأسماء",
  () => local.people.push("مستلم فحص التوازي"),
  1
);

await step(
  "بيانات الشركة تُعدَّل",
  () => {
    local.company = { ...local.company, phone: "99000111" };
  },
  1
);

/* رمزٌ غير مستعمل — ودليل الحسابات الحقيقي أوسع ممّا يُظنّ */
const used = new Set(local.chart.map((a) => a.code));
let freeCode = 5190;
while (used.has(String(freeCode))) freeCode++;

await step(
  "حساب يُضاف إلى الدليل",
  () =>
    local.chart.push({
      code: String(freeCode),
      name: "مصروف فحص التوازي",
      parent: "5100",
      type: "مصروف",
      nature: "مدين",
      level: 3,
      statement: "الدخل",
      active: true,
      postable: true,
    }),
  1
);

/* ---- حفظٌ بلا تغيير في آخر اليوم ---- */
const quiet = diffStates(sent, local);
check("وحفظٌ أخير بلا تغيير لا يرسل شيئاً", isEmpty(quiet), `${countChanges(quiet)}`);

/* ------------------------------------------------------------------ */
/* المقارنة اليومية                                                    */
/* ------------------------------------------------------------------ */
console.log("\nالمقارنة اليومية:\n");

const server = await readState(db);
const report = compareStates(local, server);

const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - String(s).length));
console.log("  " + pad("الحقل", 20) + pad("المتصفّح", 12) + pad("الخادم", 12) + "الحال");
console.log("  " + "-".repeat(52));
for (const f of report.fields) {
  const note = f.agree
    ? ""
    : `  ناقص ${f.missing.length} · زائد ${f.extra.length} · مختلف ${f.different.length}`;
  console.log(
    "  " +
      pad(f.field, 20) +
      pad(f.local, 12) +
      pad(f.server, 12) +
      (f.agree ? "✓" : "✗") +
      note
  );
  if (!f.agree && f.different.length) {
    console.log("      أول مختلف: " + f.different[0]);
  }
}

console.log("");
check("النسختان متطابقتان", report.agree);

/* ------------------------------------------------------------------ */
/* حجم ما أُرسل                                                        */
/* ------------------------------------------------------------------ */
const total = steps.reduce((s, x) => s + x.n, 0);
const biggest = Math.max(...steps.map((s) => s.n));
check(
  `ما أُرسل في اليوم كله ${total} صفّاً لا ${local.movements.length}`,
  biggest <= 3,
  `أكبر إرسال ${biggest} صفّاً`
);

await db.close();
fs.rmSync(dir, { recursive: true, force: true });

console.log(
  bad === 0
    ? "\n✓ التشغيل المتوازي: يومُ عملٍ كامل، والنسختان سواء"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
