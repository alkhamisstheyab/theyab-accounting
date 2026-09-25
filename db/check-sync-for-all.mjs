/**
 * يفحص أن المزامنة تعمل لكل من دخل، وأن المردود يُقال لا يُبتلع.
 *
 *   node db/check-sync-for-all.mjs
 *
 * أمران يقعان يوم يدخل الموظفون، ولا يظهر أثرهما إلا بعد أيام:
 *
 *  1. المزامنة كانت مطفأةً حتى تُشعَل، ومفتاحها في شاشةٍ لا يفتحها إلا
 *     صاحب الإعدادات. فالسكرتيرة تُدخل حركاتِ يومٍ كامل، ولا يصل منها
 *     شيء، ولا مفتاح عندها ولا علم لها.
 *
 *  2. والطلب كان يُرفض كلّه لصفٍّ واحدٍ فيه لا تملك كتابته. فيقف رفعُ
 *     عملها كلِّه بسبب صفٍّ لا يعنيها.
 *
 * فصارت تعمل ما لم تُطفأ صراحةً، وصار الخادم يكتب ما جاز ويردّ ما لا
 * يجوز باسمه. والمردود لا يُحسب مرسَلاً — فيبقى ظاهراً في المقارنة،
 * ولا يُعاد إرساله ما دام كما هو.
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
const { ROLES } = await jiti.import("../lib/permissions.ts");
const { allowedChanges, nothingToWrite } = await jiti.import(
  "../lib/server/permits.ts"
);
const { emptyState } = await jiti.import("../lib/storage.ts");

const secretary = ROLES.find((r) => r.key === "secretary").permissions;
const owner = ROLES.find((r) => r.key === "owner").permissions;

console.log("\nالخادم يكتب ما جاز ويردّ ما لا يجوز:\n");

/* طلبٌ من جهاز السكرتيرة: حضورٌ لا تملكه، وعرض سعرٍ لا تملكه، وحركة */
const mixed = {
  upserts: {
    movements: [{ id: "m-1" }],
    attendance: [{ id: "a-1" }],
  },
  whole: { people: ["فلان"] },
};

const asSecretary = allowedChanges(mixed, secretary);
check(
  "ما لا تملكه يُردّ",
  asSecretary.refused.length === 3,
  asSecretary.refused.map((r) => r.field).join("، ")
);
check(
  "ويُقال سببه بالاسم لا «ممنوع»",
  asSecretary.refused.every((r) => r.reason.includes("صلاحية")),
  asSecretary.refused[0]?.reason ?? ""
);
check("ولا يبقى في الطلب ما يُكتب", nothingToWrite(asSecretary.allowed));

/* المدير يكتب الجميع */
const asOwner = allowedChanges(mixed, owner);
check(
  "والمالك يكتب كل ذلك",
  asOwner.refused.length === 0 && !nothingToWrite(asOwner.allowed)
);

/* الخلط: مأذونٌ ومردود في طلبٍ واحد */
const engineer = ROLES.find((r) => r.key === "engineer").permissions;
const both = allowedChanges(
  {
    upserts: {
      materialReceipts: [{ id: "r-1" }, { id: "r-2" }],
      movements: [{ id: "m-9" }],
    },
  },
  engineer
);
check(
  "والمهندس: مواده تُكتب",
  (both.allowed.upserts?.materialReceipts ?? []).length === 2
);
check(
  "وحركته تُردّ — ولا يقف عمله كلّه لأجلها",
  both.refused.length === 1 && both.refused[0].field === "movements",
  both.refused[0]?.reason ?? ""
);

/* سجل التدقيق لا يُحذف منه شيء ولو كان المالك */
const audit = allowedChanges({ deletes: { audit: ["x"] } }, owner);
check(
  "وسجل التدقيق لا يُحذف منه شيء ولو للمالك",
  audit.refused.length === 1 && nothingToWrite(audit.allowed)
);

/* المجهول يُردّ لا يُكتب */
const unknown = allowedChanges({ upserts: { secrets: [{ id: "s" }] } }, owner);
check("والمجموعة المجهولة تُردّ", unknown.refused.length === 1);
check("ولا تُكتب", nothingToWrite(unknown.allowed));

console.log("\nوالمزامنة تعمل ما لم تُطفأ صراحةً:\n");

const sync = await jiti.import("../lib/sync.ts");

check("جهازٌ جديد: تعمل بلا زرّ", sync.syncEnabled() === true);

sync.setSyncEnabled(false);
check("ومن أطفأها بقيت مطفأة", sync.syncEnabled() === false);
check("والإطفاء محفوظ", store.get("theyab:sync") === "off", store.get("theyab:sync"));

sync.setSyncEnabled(true);
check("ومن أشعلها عادت", sync.syncEnabled() === true);

console.log("\nوالمردود يبقى ظاهراً ولا يُعاد إرساله بلا تغيير:\n");

/* خادمٌ مصطنع: يكتب الحضور ويردّ الحركات */
const base = emptyState();
const posts = [];
globalThis.fetch = async (url, init) => {
  const method = init?.method ?? "GET";
  if (String(url).includes("/api/data/changes")) {
    return { ok: true, status: 200, json: async () => ({ rev: 1, upserts: {}, deletes: {} }) };
  }
  if (method === "GET") {
    return { ok: true, status: 200, json: async () => ({ state: base, rev: 1 }) };
  }
  const body = JSON.parse(init.body);
  posts.push(body);
  return {
    ok: true,
    status: 200,
    json: async () => ({
      rev: 2,
      written: Object.keys(body.upserts ?? {}).length,
      refused: body.upserts?.movements
        ? [{ field: "movements", reason: "ليست لديك صلاحية الكتابة في «movements»" }]
        : [],
    }),
  };
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

sync.markOwned();
sync.setSyncEnabled(true);
await wait(300);

const movement = { id: "m-1", entryNo: 1, fiscalYear: 2026, date: "2026-09-25", amount: 5 };
const day = { id: "a-1", employeeId: "emp-1", date: "2026-09-25", status: "حاضر" };
sync.record({ ...base, movements: [movement], attendance: [day] });
await wait(4000);

check("أُرسلت الدفعة", posts.length === 1, `${posts.length}`);
check(
  "والحضور فيها",
  (posts[0]?.upserts?.attendance ?? []).length === 1
);

const after = sync.syncStatus();
check(
  "والمردود يُعرض لصاحبه",
  after.refused.length === 1 && after.refused[0].field === "movements",
  after.refused[0]?.reason ?? ""
);
check(
  "ولا يُحسب مرسَلاً — فيبقى في الانتظار ظاهراً",
  after.pending > 0,
  `${after.pending} في الانتظار`
);

/* دورةٌ أخرى بلا تغيير: لا يُعاد إرسال المردود */
posts.length = 0;
sync.record({ ...base, movements: [movement], attendance: [day] });
await wait(4000);
check(
  "ولا يدور على الخادم كل ثوانٍ",
  posts.length === 0,
  `${posts.length} إرسالاً`
);

/* فإذا غيّره صاحبه، أُرسل ثانيةً */
posts.length = 0;
sync.record({
  ...base,
  movements: [{ ...movement, amount: 9 }],
  attendance: [day],
});
await wait(4000);
check(
  "فإذا تغيّر أُرسل — فلعلّ الصلاحية أُعطيت",
  posts.length === 1 && Boolean(posts[0]?.upserts?.movements),
  `${posts.length}`
);

console.log("\nوالشاشة تُري كلَّ عاملٍ حاله:\n");

const page = fs.readFileSync("app/page.tsx", "utf8");
check(
  "المزامنة تبدأ بعد الدخول",
  page.includes("if (!session || ownCopy === null || started.current) return;")
);
check(
  "وبعد أن تكون للجهاز نسخة",
  page.includes("markOwned();\n      startSync();")
);
check("وتقف عند الخروج", page.includes("stopSync();"));
check("وحالة الخادم في شريط كل مستخدم", page.includes("{serverState.phase}"));
check("ومعها ما ينتظر", page.includes("في الانتظار"));
check("وسببُ ما رُدّ", page.includes("serverState.refused[0].reason"));

console.log(
  bad === 0
    ? "\n✓ تعمل لكل من دخل، وما رُدّ يُقال لصاحبه ولا يُظنّ محفوظاً"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
