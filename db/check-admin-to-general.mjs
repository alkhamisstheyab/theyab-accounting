/**
 * يفحص تصحيحات مراجعة المصروفات الإدارية (١٧ سبتمبر ٢٠٢٦).
 *
 *   node db/check-admin-to-general.mjs <نسخة.json>
 *
 * ثلاثة تصحيحات تُطبَّق من شاشة الإعدادات:
 *   ١. ٢١٧ مصروفاً إدارياً من «مصروفات مشتركة» إلى «عام» — المشروع وحده.
 *   ٢. دفعة الألمنيوم من الرواتب إلى المواد (5110).
 *   ٣. صبغ السيارة من الرسوم الحكومية إلى الصيانة (6250).
 *
 * والذي يُخشى منه:
 *   • أن يتغيّر صافي الربح — والقاعدة أنه لا يتغيّر في أيٍّ منها.
 *   • أن يتغيّر الميزان في غير الحسابات المقصودة، أو بغير المبلغ المقصود.
 *   • أن تُعاد الحركات إلى «بانتظار الاعتماد» فتخرج من القوائم المالية.
 *   • أن يُنقل ما قرّر صاحب الشركة إبقاءه.
 *   • أن تدخل دفعة الألمنيوم قفل دفعات المقاولين فيتغيّر ما أُقرّ عليه.
 *
 * فتُطبَّق كما يطبّقها المعالج في الشاشة، ويُقارن قبلها وبعدها.
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
const { isAluminiumOnSalaries, isCarPaintOnGovFees } = await jiti.import(
  "../lib/account-corrections.ts"
);
const { isClosedContractorPayment } = await jiti.import("../lib/closed-payments.ts");
const { buildTrialBalance, computeTotals, buildIncomeStatement } = await jiti.import(
  "../lib/accounting.ts"
);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};
const sum = (list) => list.reduce((t, m) => t + Number(m.amount || 0), 0).toFixed(3);

const { movements: before, items } = parseBackup(fs.readFileSync(BACKUP, "utf8"));

/* ---- التصحيحات كما يطبّقها المعالج في الشاشة ---- */
const itemFor = (account) => items.find((i) => i.account === account);

function apply(list, match, { toAccount, toProject }) {
  const item = toAccount ? itemFor(toAccount) : undefined;
  return list.map((m) => {
    if (!match(m)) return m;
    return toAccount && item
      ? { ...m, debitCode: toAccount, itemCode: item.code, itemName: item.name, project: toProject ?? m.project }
      : { ...m, project: toProject ?? m.project };
  });
}

const general = before.filter(isAdminExpenseToGeneral);
const aluminium = before.filter(isAluminiumOnSalaries);
const paint = before.filter(isCarPaintOnGovFees);

/*
  التصحيحات طُبّقت على دفاتر الشركة في ١٧ سبتمبر ٢٠٢٦، فالنسخ التي تلتها
  لا يوجد فيها ما يُصحَّح. وهذا الفحص يُراد به النسخةُ التي قبلها، فيُقال
  ذلك ولا يُسقَط بخطأٍ يُفهم منه أن شيئاً انكسر.
*/
if (general.length === 0 && aluminium.length === 0 && paint.length === 0) {
  console.log(
    "\n· هذه النسخة بعد التصحيح — لا حركة تنطبق عليها أيٌّ من التصحيحات الثلاثة." +
      "\n  افحص بنسخةٍ سابقة لـ ١٧ سبتمبر ٢٠٢٦ إن أردت التحقّق منها.\n"
  );
  process.exit(0);
}

console.log("\nما تمسّه التصحيحات:\n");
check("٢١٧ مصروفاً إدارياً إلى «عام»", general.length === 217, String(general.length));
check("بمجموع ٣٤٬٥٢٤٫١٣٥", sum(general) === "34524.135", sum(general));
check(
  "ودفعة ألمنيوم واحدة: قيد ١٢٩٦ لسنة ٢٠٢٥ بألفٍ وخمسمئة",
  aluminium.length === 1 &&
    aluminium[0].entryNo === 1296 &&
    aluminium[0].fiscalYear === 2025 &&
    sum(aluminium) === "1500.000",
  aluminium.map((m) => `${m.fiscalYear}/${m.entryNo}`).join("، ")
);
check(
  "وصبغ سيارة واحد: قيد ١٠٢١ لسنة ٢٠٢٦",
  paint.length === 1 && paint[0].entryNo === 1021 && paint[0].fiscalYear === 2026,
  paint.map((m) => `${m.fiscalYear}/${m.entryNo}`).join("، ")
);
check("وبندا الحسابين الجديدين موجودان", Boolean(itemFor("5110") && itemFor("6250")));

let after = apply(before, isAdminExpenseToGeneral, { toProject: "عام" });
after = apply(after, isAluminiumOnSalaries, { toAccount: "5110" });
after = apply(after, isCarPaintOnGovFees, { toAccount: "6250" });

const byId = new Map(after.map((m) => [m.id, m]));

console.log("\nما لا يجوز أن يتغيّر:\n");

/* ---- الاعتماد ---- */
const touched = [...general, ...aluminium, ...paint];
check(
  "الاعتماد كما هو في كل ما مُسّ — فلا يخرج شيء من القوائم",
  touched.every((m) => byId.get(m.id).approval === m.approval),
  `${touched.length} حركة`
);
check(
  "والمبالغ كما هي",
  touched.every((m) => byId.get(m.id).amount === m.amount)
);

/* ---- صافي الربح لكل سنة ---- */
const netProfit = (list, year) =>
  Number(
    buildIncomeStatement(
      computeTotals(list.filter((m) => m.fiscalYear === year), {}, true)
    ).netProfit
  ).toFixed(3);
for (const year of [2025, 2026]) {
  check(
    `صافي ربح ${year} لا يتغيّر`,
    netProfit(before, year) === netProfit(after, year),
    netProfit(after, year)
  );
}

/* ---- الميزان: يتغيّر في الحسابات المقصودة وحدها، وبالمبلغ المقصود ---- */
const balances = (list, year) => {
  const tb = buildTrialBalance(
    computeTotals(list.filter((m) => m.fiscalYear === year), {}, true),
    false
  );
  return new Map(
    tb.rows.map((r) => [r.account.code, Number(r.periodDebit) - Number(r.periodCredit)])
  );
};

const expected = {
  2025: { "6110": -1500, "5110": 1500 },
  2026: { "6260": -89.5, "6250": 89.5 },
};

for (const year of [2025, 2026]) {
  const b = balances(before, year);
  const a = balances(after, year);
  const codes = new Set([...b.keys(), ...a.keys()]);
  const moved = {};
  for (const code of codes) {
    const delta = Number(((a.get(code) ?? 0) - (b.get(code) ?? 0)).toFixed(3));
    if (delta !== 0) moved[code] = delta;
  }
  const want = expected[year];
  const same =
    Object.keys(moved).length === Object.keys(want).length &&
    Object.entries(want).every(([code, d]) => moved[code] === d);
  check(
    `ميزان ${year} يتغيّر في ${Object.keys(want).join(" و")} وحدهما، وبالمبلغ المقصود`,
    same,
    JSON.stringify(moved)
  );
}

/* فحص الميزان يسقط إن تغيّر ما لا يجوز — فيُثبت أنه يفحص */
const tampered = after.map((m, i) => (i === 0 ? { ...m, amount: m.amount + 1 } : m));
const year0 = after[0].fiscalYear;
const tb0 = balances(after, year0);
const tbT = balances(tampered, year0);
check(
  "وفحص الميزان يسقط إن تغيّر مبلغٌ خارج التصحيح",
  [...tb0.keys()].some((c) => Number((tb0.get(c) - (tbT.get(c) ?? 0)).toFixed(3)) !== 0)
);

console.log("\nما قُرّر إبقاؤه:\n");

/* ---- ما يبقى على «مصروفات مشتركة» ---- */
const movedToGeneral = new Set(general.map((m) => m.id));
check(
  "لا تُنقل صيانة السيارات والمولد",
  general.every((m) => m.debitCode !== "6250")
);
check("ولا الكهرباء والماء", general.every((m) => m.debitCode !== "6220"));
check(
  "ولا سكن العمال وأكلهم وملابسهم",
  general.every((m) => !/سكن العمال|أكل عمال|اكل عمال|ملابس عمال/.test(m.description))
);
check(
  "ودفعة الألمنيوم لا تُنقل إلى «عام» — تبقى مشتركة",
  byId.get(aluminium[0].id).project === "مصروفات مشتركة" && !movedToGeneral.has(aluminium[0].id)
);
check(
  "وصبغ السيارة يبقى مشتركاً مع صيانة السيارات",
  byId.get(paint[0].id).project === "مصروفات مشتركة"
);
check(
  "ورسوم حدود القسيمة تنتقل إلى «عام»",
  after.some(
    (m) => /حدود قسيمة/.test(m.description) && m.project === "عام" && m.fiscalYear === 2025
  )
);

/* ---- قفل دفعات المقاولين لا يتغيّر ---- */
const closedBefore = before.filter(isClosedContractorPayment).length;
const closedAfter = after.filter(isClosedContractorPayment).length;
check(
  "وقفل دفعات مقاولي ٢٠٢٥ باقٍ على ٤٧ — الألمنيوم إلى 5110 لا 5120",
  closedBefore === 47 && closedAfter === 47,
  `${closedBefore} ← ${closedAfter}`
);

/* ---- التطبيق مرةً ثانية لا يجد شيئاً ---- */
check(
  "وتطبيقها مرةً ثانية لا يجد شيئاً",
  after.filter(isAdminExpenseToGeneral).length === 0 &&
    after.filter(isAluminiumOnSalaries).length === 0 &&
    after.filter(isCarPaintOnGovFees).length === 0
);

console.log(
  bad === 0
    ? "\n✓ التصحيحات الثلاثة: صافي الربح والاعتماد كما هما، والميزان يتغيّر حيث قُصد وحده"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
