/**
 * يفحص أن الجهاز الفارغ يأخذ ولا يُعطي.
 *
 *   node db/check-empty-device.mjs
 *
 * فتح صاحب الشركة النظام من هاتفه، فرأى على شاشة الدخول اسم شركةٍ ليس
 * اسم شركته. والسبب أن الهاتف فارغ: ما يعرضه قيمٌ افتراضية لا بيانات.
 *
 * وتحت ذلك خطرٌ أكبر: في النظام حارسٌ يمنع الجهاز الفارغ من محو
 * **الصفوف** — لا يُرسل حذفُ صفٍّ لم يره — ولا يشمل ذلك المجموعات التي
 * تُكتب كاملةً: دليل الحسابات وبيانات الشركة وطرق الدفع والأسماء
 * والأرصدة الافتتاحية وإقفال السنوات وإعدادات الرواتب. فهذه تُرسل كما
 * هي عند الجهاز، وعند الفارغ افتراضية — فيكتب فراغَه فوق عمل سنوات،
 * بلا حذفٍ ولا تنبيه.
 *
 * فصار الجهاز لا يُرسل شيئاً حتى تكون عنده نسخة: إمّا المحفوظة عنده،
 * وإمّا نسخةٌ يأخذها من الخادم عند أول دخول.
 */
import fs from "fs";
import { createJiti } from "jiti";

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

/* ---- متصفّحٌ مصطنع: فارغٌ كهاتفٍ يُفتح أول مرة ---- */
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = { localStorage, addEventListener() {}, removeEventListener() {} };
globalThis.localStorage = localStorage;

const jiti = createJiti(import.meta.url);
const { emptyState, hasStoredState, defaultCompany } = await jiti.import(
  "../lib/storage.ts"
);
const sync = await jiti.import("../lib/sync.ts");

console.log("\nالاسم المعروض على جهازٍ فارغ:\n");

check(
  "اسم الشركة المسجَّل لا اسمٌ من زمن التجربة",
  defaultCompany().name === "شركة طارق الأسد لتشييد المباني",
  defaultCompany().name
);

console.log("\nوالجهاز يعرف أفيه نسخةٌ أم لا:\n");

check("جهازٌ فارغ يقول لا", hasStoredState() === false);

/*
  وهذه هي التي أخطأ فيها الفحص الأول: الحفظ التلقائي يكتب في التخزين
  مصفوفاتٍ فارغة وقيماً افتراضية أول ما تُفتح الصفحة. فلو قيس بوجود
  المفاتيح لقال الهاتفُ «عندي نسخة» وهو لم يرَ من بيانات الشركة شيئاً —
  فلا يأخذ نسخته، ويدفع بفراغه. ووقع ذلك فعلاً على هاتف صاحب الشركة.
*/
localStorage.setItem("movements", "[]");
localStorage.setItem("employees", "[]");
localStorage.setItem("company", JSON.stringify(defaultCompany()));
localStorage.setItem("auditLog", JSON.stringify([{ id: "a", action: "دخول" }]));
check(
  "وجهازٌ فيه مصفوفاتٌ فارغة وقيدُ دخولٍ وحده يقول لا",
  hasStoredState() === false
);

localStorage.setItem("movements", JSON.stringify([{ id: "m-1", entryNo: 1 }]));
check("وجهازٌ فيه صفٌّ من عمل الشركة يقول نعم", hasStoredState() === true);

for (const k of ["movements", "employees", "company", "auditLog"]) {
  localStorage.removeItem(k);
}

console.log("\nوالفارغ لا يُرسل شيئاً — ولو اتّصل:\n");

/* خادمٌ عامر: فيه بيانات الشركة ودليل حساباتها */
const server = {
  ...emptyState(),
  company: { ...defaultCompany(), name: "شركة طارق الأسد لتشييد المباني", crNumber: "123456" },
  people: ["ذياب", "مصطفى"],
  movements: [
    { id: "m-1", entryNo: 1500, fiscalYear: 2026, date: "2026-09-01", amount: 100 },
  ],
};

const posts = [];
globalThis.fetch = async (url, init) => {
  const method = init?.method ?? "GET";
  if (String(url).includes("/api/data/changes")) {
    return { ok: true, status: 200, json: async () => ({ rev: 3, upserts: {}, deletes: {} }) };
  }
  if (method === "GET") {
    return { ok: true, status: 200, json: async () => ({ state: server, rev: 3, hidden: [] }) };
  }
  posts.push(JSON.parse(init.body));
  return { ok: true, status: 200, json: async () => ({ rev: 4, refused: [] }) };
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* الهاتف: حالةٌ افتراضية فارغة، ومزامنةٌ مشتعلة، ولم يأخذ نسخته بعد */
const blank = emptyState();
sync.rememberLoaded(blank);
sync.setSyncEnabled(true);
await wait(300);
sync.record(blank);
await wait(4000);

check("لم يُرسل شيئاً", posts.length === 0, `${posts.length} طلباً`);
check("ولم يُؤذن له بعد", sync.ownsData() === false);

/*
  ولو لم يكن المنع، لكان ما يُرسله هو الفراغ فوق بيانات الشركة —
  يُحسب هنا ليُرى حجم ما مُنع، لا ليُرسل.
*/
const { diffStates, snapshotForServer } = await jiti.import("../lib/changes.ts");
const wouldSend = diffStates(snapshotForServer(server), blank);
check(
  "ولولا المنع لكتب فراغه فوق بيانات الشركة",
  Boolean(wouldSend.whole?.company) && Boolean(wouldSend.whole?.people),
  Object.keys(wouldSend.whole ?? {}).join("، ")
);

console.log("\nفإذا أخذ نسخته أُذن له:\n");

/* يأخذ نسخة الخادم كما تفعل الشاشة، ثم يُعلن أن عنده نسخة */
const adopted = await sync.fetchServerState();
check("النسخة وصلت كاملةً", adopted.movements.length === 1 && adopted.company.crNumber === "123456");
check(
  "وفيها اسم الشركة الصحيح",
  adopted.company.name === "شركة طارق الأسد لتشييد المباني",
  adopted.company.name
);

sync.rememberLoaded(adopted);
sync.markOwned();
check("وصار مأذوناً", sync.ownsData() === true);

/* الآن يعمل صاحبه: حركةٌ جديدة تُرسل */
sync.record({ ...adopted, people: [...adopted.people, "خالد"] });
await wait(4000);
check("وعملُه بعدها يصل", posts.length === 1, `${posts.length} طلباً`);
check(
  "ولا يُرسل إلا ما غيّره",
  posts[0] && Object.keys(posts[0].whole ?? {}).join("،") === "people",
  posts[0] ? JSON.stringify(Object.keys(posts[0].whole ?? {})) : "لا شيء"
);

console.log("\nوالشاشة تأخذ النسخة عند أول دخول:\n");

const page = fs.readFileSync("app/page.tsx", "utf8");
check("تسأل: أفي الجهاز نسخة؟", page.includes("setOwnCopy(hasStoredState());"));
check("وتسألها قبل أول حفظ", page.indexOf("setOwnCopy(hasStoredState());") < page.indexOf("setSaveError(saveState(state));"));
check("فإن لم تكن أخذتها من الخادم", page.includes("const server = await fetchServerState();"));
check("وأحلّتها في الشاشة كلها", page.includes("applyWholeState(server);"));
check("ثم أذنت بالإرسال", page.includes("markOwned();"));
check("ويُقال لصاحبه ما يجري", page.includes("جهازٌ جديد — يأخذ نسخته من الخادم…"));

console.log(
  bad === 0
    ? "\n✓ الجهاز الفارغ يأخذ نسخته ولا يكتب فراغه فوق عمل الشركة"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
