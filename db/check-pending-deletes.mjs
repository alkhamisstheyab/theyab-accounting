/**
 * يفحص الحذف المعلّق — ما حُذف في الجهاز ولم يبلغ الخادم.
 *
 *   node db/check-pending-deletes.mjs
 *
 * وقع في ٢٤ سبتمبر ٢٠٢٦: أظهرت المقارنة زيادةً على الخادم — عقدٌ واحد
 * وواحدٌ وثلاثون يوم حضور — وكلّها صفوفٌ حُذفت من الجهاز. والسبب أن
 * الحذف لا يُرسل إلا لصفٍّ عرفه الجهاز في جلسته، حمايةً من أن يمحو
 * جهازٌ جديد ما لم يره. فإن أُغلق المتصفّح قبل الإرسال ضاع الحذف، وبقي
 * الصفّ على الخادم، والمقارنة حمراء لا تُشفى.
 *
 * فصار الحذف يُكتب في التخزين قبل إرساله، ويُنسى بعد نجاحه. وهذا الفحص
 * يشغّل المزامنة بمتصفّحٍ مصطنع ويثبت الأمرين.
 */
import fs from "fs";
import { createJiti } from "jiti";

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

/* ---- متصفّحٌ مصطنع: تخزينٌ في الذاكرة وخادمٌ يُسجّل ما يصله ---- */
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = { localStorage, addEventListener() {}, removeEventListener() {} };
globalThis.localStorage = localStorage;

const posted = [];
let failNext = false;
const serverState = () => ({
  movements: [],
  projects: [],
  contractors: [{ id: "c1", contractNumber: "1001", name: "عقدٌ سيُحذف" }],
  openingBalances: {},
  materials: [],
  materialReceipts: [],
  company: {},
  users: [],
  audit: [],
  yearLocks: {},
  chart: [],
  items: [],
  payments: [],
  people: [],
  employees: [],
  attendance: [],
  payrollRuns: [],
  payrollSettings: {},
  workItems: [],
  quotations: [],
  invoices: [],
});

globalThis.fetch = async (url, init) => {
  const method = init?.method ?? "GET";
  if (method === "GET") {
    return {
      ok: true,
      status: 200,
      json: async () => ({ state: serverState(), rev: 1 }),
    };
  }
  const body = JSON.parse(init.body);
  posted.push(body);
  if (failNext) {
    failNext = false;
    return { ok: false, status: 500, json: async () => ({ error: "خادمٌ ساقط" }) };
  }
  return { ok: true, status: 200, json: async () => ({ rev: 2 }) };
};

const jiti = createJiti(import.meta.url);
const { emptyState } = await jiti.import("../lib/storage.ts");
const sync = await jiti.import("../lib/sync.ts");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const TOMB_KEY = "theyab:deleted";

/* حالة الجهاز: مثل الخادم ثم يُحذف منها العقد */
const withContract = { ...emptyState(), contractors: [{ id: "c1", contractNumber: "1001", name: "عقدٌ سيُحذف" }] };
const without = { ...emptyState(), contractors: [] };

console.log("\nالحذف يُحفظ قبل إرساله:\n");

sync.setSyncEnabled(true);
await wait(200);
sync.rememberLoaded(withContract);
failNext = true;
sync.record(without);
await wait(3600);

const afterFail = JSON.parse(store.get(TOMB_KEY) ?? "{}");
check(
  "إخفاق الإرسال لا يُضيع الحذف — يبقى محفوظاً",
  (afterFail.contractors ?? []).includes("c1"),
  JSON.stringify(afterFail)
);
check(
  "وقد أُرسل الحذف في الطلب",
  posted.some((b) => (b.deletes?.contractors ?? []).includes("c1")),
  `${posted.length} طلباً`
);

console.log("\nويُنسى بعد نجاحه:\n");

/* جلسةٌ جديدة: الجهاز لم يرَ الصفّ قطّ، والمحفوظ وحده يُجيز حذفه */
const fresh = await createJiti(import.meta.url, { moduleCache: false }).import(
  "../lib/sync.ts"
);
posted.length = 0;
fresh.setSyncEnabled(true);
await wait(200);
fresh.rememberLoaded(without);
fresh.record(without);
await wait(3600);

check(
  "الجلسة الجديدة تُرسل الحذف المحفوظ وإن لم ترَ الصفّ",
  posted.some((b) => (b.deletes?.contractors ?? []).includes("c1")),
  `${posted.length} طلباً`
);
const afterOk = JSON.parse(store.get(TOMB_KEY) ?? "{}");
check(
  "وبعد نجاحه لا يبقى معلّقاً — فلا يُعاد حذفه أبداً",
  !(afterOk.contractors ?? []).includes("c1"),
  JSON.stringify(afterOk)
);

console.log("\nوالحذف الصريح من شاشة المقارنة:\n");

posted.length = 0;
const done = await fresh.pushDeletions({ attendance: ["a1", "a2"], audit: [] });
check("يُرسل ما طُلب وحده", done === 2, String(done));
check(
  "ويصل الخادمَ حذفاً لا إضافة",
  posted.length === 1 &&
    JSON.stringify(posted[0]) === JSON.stringify({ deletes: { attendance: ["a1", "a2"] } }),
  JSON.stringify(posted[0])
);
check("ولا يُرسل شيئاً إن لم يُطلب", (await fresh.pushDeletions({})) === 0);

/* الشاشة */
const page = fs.readFileSync("app/page.tsx", "utf8");
check("وشاشة المقارنة تعرض الزائد على الخادم", page.includes("staleOnServer"));
check("وتحذفه بزرٍّ بعد تأكيد", page.includes("purgeStale"));
check(
  "وسجلّ التدقيق مستثنى — لا يُحذف منه شيء",
  page.includes('(f) => f.field !== "audit" && f.extra.length > 0')
);

console.log(
  bad === 0
    ? "\n✓ الحذف يعبر إغلاق المتصفّح، ويُنسى بعد وصوله، ويُحذف الزائد بطلبٍ صريح"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
