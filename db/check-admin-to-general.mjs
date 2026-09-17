/**
 * يفحص نقل المصروفات الإدارية إلى «عام».
 *
 *   node db/check-admin-to-general.mjs <نسخة.json>
 *
 * يُنقل ٢١٦ حركة بمجموع ٣٤٬٣٩٤٫١٣٥ دفعةً واحدة. والذي يُخشى منه:
 *   • أن يتغيّر ميزان المراجعة أو صافي الربح — والقاعدة أنهما لا يتغيّران.
 *   • أن تُعاد الحركات إلى «بانتظار الاعتماد» فتخرج من القوائم المالية.
 *   • أن يُنقل ما قرّر صاحب الشركة إبقاءه: العمال والسيارات والكهرباء.
 *   • أن يُمسّ الحساب أو البند.
 *
 * فيُطبَّق التصحيح كما تطبّقه الشاشة، ويُقارن قبله وبعده.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-admin-to-general.mjs <نسخة.json>");
  process.exit(1);
}

const { parseBackup } = await jiti.import("../lib/storage.ts");
const { isAdminExpenseToGeneral } = await jiti.import("../lib/admin-to-general.ts");
const { buildTrialBalance, computeTotals, buildIncomeStatement } = await jiti.import(
  "../lib/accounting.ts"
);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};
const sum = (list) => list.reduce((t, m) => t + Number(m.amount || 0), 0).toFixed(3);

const before = parseBackup(fs.readFileSync(BACKUP, "utf8")).movements;
const targets = before.filter(isAdminExpenseToGeneral);

console.log("");

/* ---- ما يُنقل ---- */
check("يُنقل ٢١٦ حركة", targets.length === 216, String(targets.length));
check("بمجموع ٣٤٬٣٩٤٫١٣٥", sum(targets) === "34394.135", sum(targets));

/* ---- التطبيق كما في الشاشة: المشروع وحده ---- */
const ids = new Set(targets.map((m) => m.id));
const after = before.map((m) => (ids.has(m.id) ? { ...m, project: "عام" } : m));

/* ---- لا يُمسّ الحساب ولا البند ولا الاعتماد ولا المبلغ ---- */
const moved = after.filter((m) => ids.has(m.id));
const original = new Map(before.map((m) => [m.id, m]));
const untouched = moved.every((m) => {
  const o = original.get(m.id);
  return (
    m.debitCode === o.debitCode &&
    m.creditCode === o.creditCode &&
    m.itemCode === o.itemCode &&
    m.amount === o.amount &&
    m.approval === o.approval &&
    m.approvedBy === o.approvedBy &&
    m.fiscalYear === o.fiscalYear
  );
});
check("الحساب والبند والمبلغ والاعتماد كما هي", untouched);
check(
  "وكلها ما زالت «معتمدة» — فلا تخرج من القوائم",
  moved.every((m) => m.approval === "معتمدة"),
  `${moved.filter((m) => m.approval === "معتمدة").length} من ${moved.length}`
);

/* ---- الميزان وصافي الربح لكل سنة ---- */
for (const year of [2025, 2026]) {
  const b = before.filter((m) => m.fiscalYear === year);
  const a = after.filter((m) => m.fiscalYear === year);
  /*
    كان هذا يقرأ r.code و r.debit — وليسا في الصفّ، فيطبع الطرفان NaN متطابقة
    ويمرّ الفحص مهما تغيّر الميزان. فحصٌ لا يستطيع أن يسقط لا يفحص شيئاً.
  */
  const tb = (list) =>
    buildTrialBalance(computeTotals(list, {}, true)).rows.map((r) =>
      [
        r.account.code,
        Number(r.periodDebit).toFixed(3),
        Number(r.periodCredit).toFixed(3),
        Number(r.closingDebit).toFixed(3),
        Number(r.closingCredit).toFixed(3),
      ].join(":")
    );
  const tbBefore = tb(b);
  const real = tbBefore.length > 0 && tbBefore.every((row) => !row.includes("NaN"));
  check(`ميزان ${year} يُقرأ أرقاماً حقيقية`, real, `${tbBefore.length} حساباً`);
  check(`ميزان مراجعة ${year} لا يتغيّر`, tbBefore.join("|") === tb(a).join("|"));

  /* ويسقط إن تغيّر فعلاً — فيُثبت أنه يفحص */
  const tampered = a.map((m, i) => (i === 0 ? { ...m, amount: m.amount + 1 } : m));
  check(
    `وفحص ميزان ${year} يسقط إن تغيّر مبلغٌ واحد`,
    tbBefore.join("|") !== tb(tampered).join("|")
  );

  const np = (list) =>
    Number(buildIncomeStatement(computeTotals(list, {}, true)).netProfit).toFixed(3);
  check(`وصافي ربح ${year} لا يتغيّر`, np(b) === np(a), np(a));
}

/* ---- ما قُرّر إبقاؤه يبقى ---- */
const staysShared = after.filter(
  (m) =>
    m.project === "مصروفات مشتركة" &&
    String(m.debitCode).startsWith("6")
);
check(
  "يبقى على «مصروفات مشتركة» ٦٥ حركة: العمال والسيارات ٥٧، والكهرباء ٥، وأخطاء الحساب ٣",
  staysShared.length === 65,
  String(staysShared.length)
);
check(
  "ولا تُنقل صيانة السيارات والمولد",
  moved.every((m) => m.debitCode !== "6250")
);
check("ولا الكهرباء والماء", moved.every((m) => m.debitCode !== "6220"));
check(
  "ولا سكن العمال وأكلهم",
  moved.every((m) => !/سكن العمال|أكل عمال|اكل عمال|ملابس عمال/.test(m.description))
);
check(
  "ولا دفعة الألمنيوم ولا رسوم الحدود — أخطاء حساب تُصحَّح وحدها",
  moved.every((m) => !/لمونيوم|حدود قسيمة/.test(m.description))
);

/* ---- لا يمسّ غير «مصروفات مشتركة» ---- */
check(
  "لا يُنقل إلا ما كان على «مصروفات مشتركة»",
  targets.every((m) => m.project === "مصروفات مشتركة")
);

/* ---- تطبيقه مرةً ثانية لا يفعل شيئاً ---- */
const again = after.filter(isAdminExpenseToGeneral);
check("وتطبيقه مرةً ثانية لا يجد شيئاً", again.length === 0, String(again.length));

console.log(
  bad === 0
    ? "\n✓ النقل: ٢١٦ إلى «عام» — ولا يتغيّر الميزان ولا الربح ولا الاعتماد"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
