/**
 * يفحص التقرير الربعي.
 *
 *   node db/check-quarterly.mjs [نسخة.json]
 *
 * طلبه صاحب الشركة ليُبنى عليه قرار لا ليُقرأ ويُنسى: أين يذهب المال،
 * وأي بندٍ يتصاعد حتى يستحقّ النظر، وكم يُدفع باليومية مقابل ما يُدفع
 * بعقدٍ مبرم.
 *
 * والذي يُخشى منه:
 *   • أن يُحسب غير المعتمد فتظهر أرقامٌ لم يُقرّها أحد.
 *   • أن يُعدّ بندٌ متصاعداً وهو مصروفان متباعدان.
 *   • أن يُخلط شراء المواد بأجور المقاولين في سؤال «اليومية أم العقد».
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { quarterOf, quarterRange, spendByQuarter, workSplit } = await jiti.import(
  "../lib/quarters.ts"
);

let no = 100;
const move = (over) => ({
  id: "m-" + no,
  entryNo: no++,
  fiscalYear: Number((over.date ?? "2026-01-01").slice(0, 4)),
  date: "2026-01-15",
  movementType: "مصروف",
  description: "حركة",
  itemCode: "",
  itemName: "بند",
  debitCode: "5140",
  creditCode: "1111",
  amount: 100,
  project: "مشروع",
  person: "",
  paymentMethod: "نقدي",
  party: "",
  source: "app",
  approval: "معتمدة",
  approvedBy: "ذياب",
  approvedAt: "2026-01-15T08:00:00.000Z",
  approvalNote: "",
  ...over,
});

const chart = [
  { code: "5140", name: "إيجار معدات" },
  { code: "5120", name: "أجور مقاولين" },
  { code: "5110", name: "مواد إنشائية" },
];

console.log("\nالأرباع تُحسب على حدودها:\n");

check("يناير في الأول", quarterOf("2026-01-31") === "2026-ر1");
check("ومارس في الأول", quarterOf("2026-03-31") === "2026-ر1");
check("وأبريل في الثاني", quarterOf("2026-04-01") === "2026-ر2");
check("وديسمبر في الرابع", quarterOf("2026-12-31") === "2026-ر4");
check(
  "والمدى يعبر السنة بلا فجوة",
  JSON.stringify(
    quarterRange([move({ date: "2025-11-01" }), move({ date: "2026-05-01" })])
  ) === JSON.stringify(["2025-ر4", "2026-ر1", "2026-ر2"])
);

console.log("\nوالمعتمد وحده يدخل الحساب:\n");

const withPending = spendByQuarter(
  [
    move({ date: "2026-01-10", amount: 500 }),
    move({ date: "2026-01-11", amount: 999, approval: "بانتظار الاعتماد" }),
    move({ date: "2026-01-12", amount: 777, approval: "مرفوضة" }),
  ],
  chart
);
check("لا يُحسب المنتظر ولا المرفوض", withPending.grand === 500, String(withPending.grand));

const withAssets = spendByQuarter(
  [move({ amount: 300 }), move({ debitCode: "1140", amount: 900 })],
  chart
);
check(
  "ولا يُحسب إلا المصروف — لا الأصول ولا الالتزامات",
  withAssets.grand === 300,
  String(withAssets.grand)
);

console.log("\nوالتصاعد اتجاهٌ لا صدفة:\n");

const climbing = spendByQuarter(
  [
    move({ date: "2025-10-01", amount: 100 }),
    move({ date: "2026-01-01", amount: 200 }),
    move({ date: "2026-04-01", amount: 300 }),
    move({ date: "2026-07-01", amount: 400 }),
  ],
  chart
);
check(
  "أربعة أرباعٍ صاعدة تُعلَّم",
  climbing.rows[0].rising === true,
  climbing.quarters.join(" · ")
);

const gapped = spendByQuarter(
  [
    move({ date: "2025-10-01", amount: 100 }),
    move({ date: "2026-07-01", amount: 400 }),
  ],
  chart
);
check(
  "ومصروفان متباعدان لا يُعدّان تصاعداً",
  gapped.rows[0].rising === false
);

const falling = spendByQuarter(
  [
    move({ date: "2025-10-01", amount: 400 }),
    move({ date: "2026-01-01", amount: 300 }),
    move({ date: "2026-04-01", amount: 200 }),
    move({ date: "2026-07-01", amount: 100 }),
  ],
  chart
);
check("والنازل لا يُعلَّم", falling.rows[0].rising === false);

console.log("\nواليوميات مقابل العقود — أجور المقاولين وحدها:\n");

const wages = [
  move({ date: "2026-01-05", debitCode: "5120", amount: 1000, contractNumber: "3002" }),
  move({ date: "2026-01-06", debitCode: "5120", amount: 250 }),
  move({ date: "2026-04-05", debitCode: "5120", amount: 500 }),
  move({ date: "2026-04-06", debitCode: "5110", amount: 9999 }),
];
const q = workSplit(wages, "quarter");
check("الربع الأول: ألفٌ بعقد ومئتان وخمسون بلا", q[0].contracted === 1000 && q[0].loose === 250);
check("ونسبة التعاقد فيه ثمانون", q[0].share === 80, String(q[0].share));
check("والربع الثاني كلُّه بلا عقد", q[1].contracted === 0 && q[1].loose === 500);
check(
  "والمواد لا تدخل السؤال",
  q.reduce((s, r) => s + r.total, 0) === 1750,
  "9999 من المواد خارج الحساب"
);

const byProject = workSplit(
  [
    move({ debitCode: "5120", amount: 100, project: "أ", contractNumber: "1" }),
    move({ debitCode: "5120", amount: 300, project: "ب" }),
  ],
  "project"
);
check(
  "والمشاريع تُرتَّب بالأكبر",
  byProject[0].key === "ب" && byProject[0].share === 0
);

/* ---- وعلى دفاتر الشركة ---- */
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
  const real = spendByQuarter(state.movements, state.chart);
  const split = workSplit(state.movements, "quarter");

  console.log("\nوعلى دفاتر الشركة:\n");
  console.log(`     ${real.quarters.length} ربعاً · إنفاقٌ معتمد ${real.grand.toFixed(3)} د.ك`);
  for (const row of real.rows.slice(0, 5)) {
    console.log(`     ${row.account} ${row.name.padEnd(24)} ${row.total.toFixed(3)} (${row.share}%)`);
  }
  const rising = real.rows.filter((r) => r.rising);
  console.log(
    `     يتصاعد: ${rising.length ? rising.map((r) => r.name).join("، ") : "لا شيء"}`
  );
  const last = split[split.length - 1];
  console.log(
    `     آخر ربع: ${last.share}% بعقد (${last.contracted.toFixed(0)} مقابل ${last.loose.toFixed(0)})`
  );
  check("وأرقام الأرباع تجتمع على الجملة", Math.abs(
    Object.values(real.totals).reduce((s, v) => s + v, 0) - real.grand
  ) < 0.01);
}

console.log(
  bad === 0
    ? "\n✓ يُحسب المعتمد وحده، ويُعلَّم ما يتصاعد، وتُفصَل اليومية عن العقد"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
