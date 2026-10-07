/**
 * يفحص السداد من خارج حسابات الشركة.
 *
 *   node db/check-external-settlement.mjs <نسخة.json>
 *
 * دعم الدولة للتكييف والألمنيوم يُدفع للمورّد مباشرةً عن العميل، فلا
 * يدخل حساب الشركة ولا يخرج منه. ولو قُيِّد في الدفاتر لضُخّمت
 * الإيرادات والتكاليف بمالٍ ليس للشركة. ولو لم يُكتب في مكانٍ ما
 * لبقي العقد ظاهراً مستحقاً وقد سُدّد.
 *
 * فهو يُكتب في دفعة العقد وحدها. وهذا الفحص يثبت أمرين:
 *   • أنه يُحفظ ويعود من التخزين كما كُتب — وإلا ضاع عند إعادة الفتح.
 *   • أنه لا يخلق قيداً ولا يمسّ ميزاناً ولا قائمة.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-external-settlement.mjs <نسخة.json>");
  process.exit(1);
}

const { parseBackup, exportBackup, isPayableInstallment } = await jiti.import(
  "../lib/storage.ts"
);
const { computeTotals, buildTrialBalance, buildIncomeStatement, contractPayments } =
  await jiti.import("../lib/accounting.ts");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};
const fmt = (n) => Number(n).toFixed(3);

const state = parseBackup(fs.readFileSync(BACKUP, "utf8"));

/* عقد التكييف: الحالة التي جاءت منها الحاجة */
const contract =
  state.contractors.find((c) => c.contractNumber === "2009") ??
  state.contractors.find((c) => c.counterpartyType === "مورّد" && c.installments.length);
check("وُجد عقد مورّدٍ له دفعات", Boolean(contract), contract?.contractNumber);

const AMOUNT = 6000;
const NOTE = "دعم الدولة للتكييف — دُفع لشركة اليوسفي مباشرةً";

/* يُكتب السداد على الدفعتين الأوليين كما تفعل الشاشة */
const target = contract.installments.filter(isPayableInstallment).slice(0, 2);
const shares = [contract.installments[0].value, AMOUNT - Number(contract.installments[0].value)];
const written = {
  ...state,
  contractors: state.contractors.map((c) =>
    c.id !== contract.id
      ? c
      : {
          ...c,
          installments: c.installments.map((i) => {
            const at = target.findIndex((t) => t.number === i.number);
            return at < 0
              ? i
              : { ...i, externalPaid: String(shares[at]), externalNote: NOTE };
          }),
        }
  ),
};

console.log("\nيُحفظ ويعود كما كُتب:\n");

const reread = parseBackup(exportBackup(written));
const back = reread.contractors.find((c) => c.id === contract.id);
const backTargets = target.map((t) => back.installments.find((i) => i.number === t.number));

check(
  "المبلغ يعود من النسخة الاحتياطية",
  backTargets.every((i, n) => Number(i.externalPaid) === Number(shares[n])),
  backTargets.map((i) => i.externalPaid).join(" · ")
);
check(
  "ومعه مصدره — وإلا صار مبلغاً بلا بيان",
  backTargets.every((i) => i.externalNote === NOTE)
);
check(
  "ومجموعه ستة آلاف كما سُدِّد",
  fmt(backTargets.reduce((s, i) => s + Number(i.externalPaid), 0)) === fmt(AMOUNT)
);
/*
  «لم تُمسّ» تُقاس بما كانت عليه لا بالعدم.

  كان الشرط أن تكون بقيةُ الدفعات خاليةً من السداد الخارجي — وكان
  صادقاً يوم كُتب. ثم سُجّل دعمُ الدولة على عقد التكييف (٢٠٠٩) فعلاً،
  وهو العقد الذي يختاره هذا الفحص نفسه، فصارت دفعاتُه الثلاث تحمل
  سداداً خارجياً. فأخفق الفحص على ما بُني لأجله.
*/
const untouched = (c) =>
  c.installments
    .filter((i) => !target.some((t) => t.number === i.number))
    .map((i) => [i.number, i.externalPaid ?? null, i.externalNote ?? null]);
check(
  "ودفعات العقد الأخرى لم تُمسّ",
  JSON.stringify(untouched(back)) === JSON.stringify(untouched(contract))
);
check(
  "والعقود الأخرى كما هي",
  JSON.stringify(reread.contractors.filter((c) => c.id !== contract.id)) ===
    JSON.stringify(parseBackup(exportBackup(state)).contractors.filter((c) => c.id !== contract.id))
);

console.log("\nولا يمسّ الدفاتر:\n");

check(
  "لا حركة زادت — السداد ليس قيداً",
  written.movements.length === state.movements.length,
  `${written.movements.length}`
);

const years = [...new Set(state.movements.map((m) => m.fiscalYear))];
const digest = (st) =>
  years
    .map((y) => {
      const totals = computeTotals(
        st.movements.filter((m) => m.fiscalYear === y),
        {},
        true
      );
      return JSON.stringify([
        buildTrialBalance(totals, false).rows.map((r) => [
          r.account.code,
          fmt(r.periodDebit),
          fmt(r.periodCredit),
        ]),
        fmt(buildIncomeStatement(totals).netProfit),
      ]);
    })
    .join("|");
check("والميزان وصافي الربح لكل سنة كما هما", digest(state) === digest(written));

console.log("\nويظهر في حساب العقد:\n");

const paid = contractPayments(written.movements, contract.contractNumber).total;
const external = back.installments
  .filter(isPayableInstallment)
  .reduce((s, i) => s + (Number(i.externalPaid) || 0), 0);
const remaining = Number((contract.contractValue - paid - external).toFixed(3));

/* وما كان على بقية الدفعات يبقى محسوباً — فالمقيس ما أُضيف */
const externalElsewhere = contract.installments
  .filter(isPayableInstallment)
  .filter((i) => !target.some((t) => t.number === i.number))
  .reduce((t, i) => t + (Number(i.externalPaid) || 0), 0);

check(
  "المتبقي ينقص بقيمة السداد الخارجي",
  remaining ===
    Number(
      (contract.contractValue - paid - AMOUNT - externalElsewhere).toFixed(3)
    ),
  `${fmt(remaining)} د.ك من ${fmt(contract.contractValue)}${
    externalElsewhere > 0 ? ` · وعلى غيرها ${fmt(externalElsewhere)}` : ""
  }`
);
check(
  "ولا يُخلط بالمدفوع المحسوب من القيود",
  paid === contractPayments(state.movements, contract.contractNumber).total,
  `المدفوع ${fmt(paid)}`
);

console.log(
  bad === 0
    ? "\n✓ السداد الخارجي يُحفظ ويُنقص المتبقي، ولا قيد له في الدفاتر"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
