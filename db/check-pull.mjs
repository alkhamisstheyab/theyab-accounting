/**
 * يفحص القراءة من الخادم — أول أعمال المرحلة الخامسة.
 *
 *   node db/check-pull.mjs
 *
 * النظام يقرأ من جهازه ويكتب في الخادم. فلو فُتح لموظفَين لرأى كلٌّ
 * جهازَه وحده: تُدخل السكرتيرة قيداً فلا يراه المحاسب، ويفتح الثالث
 * الرابط فيجد نظاماً فارغاً. فبُني السحب: يُسأل الخادم كل ثماني ثوانٍ
 * عمّا استجدّ بعد آخر رقمٍ وصل، فيصل عملُ غيرك وحده.
 *
 * والذي يُخشى منه:
 *   • أن يُكتب الوارد فوق صفٍّ عُدّل هنا ولم يُرسل بعد — فيضيع عمل صاحبه.
 *   • أن يُعاد إرسال ما وصل إلى الخادم، فيدور الصفّ بين الجهازين.
 *   • أن يفوت تغييرٌ أو يتكرّر لأن الرقم لم يُحدَّث.
 */
import fs from "fs";
import { createJiti } from "jiti";

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

/* ---- متصفّحٌ مصطنع ---- */
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = { localStorage, addEventListener() {}, removeEventListener() {} };
globalThis.localStorage = localStorage;

const jiti = createJiti(import.meta.url);
const { emptyState } = await jiti.import("../lib/storage.ts");

const base = emptyState();
const mine = { id: "m-mine", entryNo: 1, fiscalYear: 2026, date: "2026-09-24", amount: 10, description: "قيدي" };
const theirs = { id: "m-theirs", entryNo: 2, fiscalYear: 2026, date: "2026-09-24", amount: 20, description: "قيد غيري" };

/* الخادم: عنده قيدي كما أرسلته، ثم كتب غيري قيدين */
const serverNow = { ...base, movements: [mine] };
let changesReply = {
  rev: 7,
  upserts: {
    movements: [
      theirs,
      /* وقد عدّل غيري قيدي أيضاً — وسأكون عدّلته هنا ولم أرسله */
      { ...mine, amount: 999, description: "عُدّل عند غيري" },
    ],
  },
  deletes: {},
};

const posted = [];
let pulls = 0;
/* الدفع يُخفق أولاً، فيبقى تعديلي معلّقاً حين يقع السحب */
let pushFails = true;
globalThis.fetch = async (url, init) => {
  const method = init?.method ?? "GET";
  if (String(url).includes("/api/data/changes")) {
    pulls++;
    const since = Number(new URL(String(url), "http://x").searchParams.get("since"));
    return {
      ok: true,
      status: 200,
      json: async () => (since >= changesReply.rev ? { rev: changesReply.rev, upserts: {}, deletes: {} } : changesReply),
    };
  }
  if (method === "GET") {
    return { ok: true, status: 200, json: async () => ({ state: serverNow, rev: 5 }) };
  }
  posted.push(JSON.parse(init.body));
  if (pushFails) return { ok: false, status: 500, json: async () => ({ error: "ساقط" }) };
  return { ok: true, status: 200, json: async () => ({ rev: 9 }) };
};

const sync = await jiti.import("../lib/sync.ts");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ما يصل يُسلَّم للشاشة */
let delivered = null;
sync.onIncoming((incoming) => {
  delivered = incoming;
});

console.log("\nيصل عملُ غيرك:\n");

/* الجهاز في هذا الفحص عامرٌ بنسخته، كما تُعلن الشاشة بعد التحميل */
sync.markOwned();
sync.setSyncEnabled(true);
await wait(300);

/* عدّلتُ قيدي هنا ولم يُرسل بعد */
const localEdited = { ...mine, amount: 55, description: "عدّلته أنا" };
sync.record({ ...base, movements: [localEdited] });
await wait(500);

/* السحب الأول يقع بعد ثماني ثوانٍ */
await wait(8500);

check("سُئل الخادم عمّا استجدّ", pulls > 0, `${pulls} مرة`);
check("ووصل شيء", Boolean(delivered), delivered ? "نعم" : "لا");

const arrived = delivered?.upserts?.movements ?? [];
check(
  "قيد غيري وصل",
  arrived.some((r) => r.id === "m-theirs"),
  arrived.map((r) => r.id).join("، ")
);
check(
  "وقيدي المعدَّل هنا لم يُكتب فوقه — فلا يضيع عملي",
  !arrived.some((r) => r.id === "m-mine")
);
check("والرقم تحدّث", sync.syncStatus().rev === 7, String(sync.syncStatus().rev));

console.log("\nولا يدور الصفّ بين الجهازين:\n");

/* ما وصل يدخل صورة الخادم، فلا يُرسل إليه ثانيةً */
posted.length = 0;
pushFails = false;
sync.record({ ...base, movements: [localEdited, theirs] });
await wait(6000);

const sentIds = posted.flatMap((b) => (b.upserts?.movements ?? []).map((r) => r.id));
check(
  "الوارد لا يُعاد إرساله",
  !sentIds.includes("m-theirs"),
  sentIds.join("، ") || "لا شيء"
);
check(
  "وتعديلي يُرسل",
  sentIds.includes("m-mine"),
  sentIds.join("، ") || "لا شيء"
);

console.log("\nولا يتكرّر ما وصل:\n");

delivered = null;
await wait(8500);
check("السؤال الثاني لا يُعيد ما وصل", delivered === null);

/* الشاشة */
const page = fs.readFileSync("app/page.tsx", "utf8");
check("والشاشة تشترك فيما يصل", page.includes("onIncoming((incoming: Incoming)"));
check(
  "وتُدخله صفّاً صفّاً بمفتاح المجموعة",
  page.includes("rows.set(collection.keyOf(row), row)")
);
check(
  "وتمرّره على المُرحِّل قبل عرضه",
  page.includes("const normalized = normalizeState({")
);

console.log(
  bad === 0
    ? "\n✓ يصل عملُ غيرك ولا يُكتب فوق عملك، ولا يدور صفٌّ بين الجهازين"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
