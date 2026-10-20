/**
 * يفحص طلباتِ العمل.
 *
 *   npm run check:tasks
 *
 * وأخطرُ ما فيها الترشيحُ: الرسالةُ موجَّهةٌ إلى موظّفٍ بعينه، فلا
 * يقرؤها غيرُه ولو كان زميلَه في الصلاحية. وكلُّ حجبٍ قبلها كان
 * بالمجموعة — تُقرأ كلُّها أو تُحجب كلُّها — وهذه أوّلُ مجموعةٍ
 * تُرشَّح صفّاً صفّاً. وموضعُ الترشيح الخادمُ لا الشاشة: فالإخفاءُ في
 * الشاشة لا يمنع من يفتح أدوات المطوّر.
 *
 * ويُفحص كذلك:
 *   • أن المعرّفَ وحده لا يكفي — فمعرّفُ الخادم غير معرّف الجهاز،
 *     والاسمُ فريدٌ في الموضعين.
 *   • أن الطلبَ يُرى عند الولوج، لا يُنتظر به دخولُ شاشته.
 *   • أن الإنجازَ يختم ولا يحذف، ويشترط بياناً.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createJiti } from "jiti";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const jiti = createJiti(import.meta.url);
const permits = await jiti.import("../lib/server/permits.ts");
const { buildNotices } = await jiti.import("../lib/notifications.ts");
const { normalizeState, emptyState } = await jiti.import("../lib/storage.ts");
const { ROW_COLLECTIONS } = await jiti.import("../lib/collections.ts");
const { COLLECTIONS } = await jiti
  .import("../lib/server/collections.ts")
  .then((m) => ({ COLLECTIONS: m.COLLECTIONS ?? m.default }));

const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");
const permitsSrc = fs.readFileSync(path.join(ROOT, "lib/server/permits.ts"), "utf8");
const schema = fs.readFileSync(path.join(HERE, "schema.sql"), "utf8");

/* ------------------------------------------------------------------ */
console.log("\nالمجموعةُ مبنيّةٌ في طبقاتها كلِّها:\n");

check(
  "في حالة التطبيق",
  Object.prototype.hasOwnProperty.call(emptyState(), "messages")
);
check(
  "وفي مجموعات الصفوف",
  ROW_COLLECTIONS.some((c) => c.field === "messages")
);
check(
  "وفي جداول الخادم",
  (COLLECTIONS ?? []).some(
    (c) => c.field === "messages" && c.table === "messages"
  ),
  `${(COLLECTIONS ?? []).length} مجموعةً`
);
check("وفي المخطَّط", /CREATE TABLE messages/.test(schema));
check(
  "وفي هجرةٍ تنزل على قاعدةٍ عاملة",
  fs.existsSync(path.join(HERE, "migrations", "001-messages.sql")),
  "فلا يُهدم ما في القاعدة لإضافة جدول"
);
check(
  "ويَنقلها الاسترجاع",
  /await fillData\(db, "messages"/.test(
    fs.readFileSync(path.join(HERE, "migrate.mjs"), "utf8")
  ),
  "ومجموعةٌ لا يَنقلها تضيع عند أوّل استرجاع"
);

/* ------------------------------------------------------------------ */
console.log("\nولا يقرأ الرسالةَ إلا صاحبُها — على الخادم:\n");

const message = (id, extra) => ({
  id,
  fromName: "",
  toUser: "",
  toName: "",
  body: "اعمل كذا",
  page: "",
  about: "",
  state: "جديدة",
  createdAt: "2026-10-20T08:00:00.000Z",
  readAt: "",
  doneAt: "",
  doneNote: "",
  ...extra,
});

const all = {
  messages: [
    message("m1", { toUser: "U-نوح", toName: "نوح", fromName: "ذياب" }),
    message("m2", { toUser: "U-سامي", toName: "سامي", fromName: "ذياب" }),
    message("m3", { toUser: "U-ذياب", toName: "ذياب", fromName: "سامي" }),
  ],
};

const seenBy = (viewer) =>
  permits
    .readableState(all, ["movements.view"], viewer)
    .messages.map((m) => m.id);

check(
  "المرسَلُ إليه يقرؤها",
  seenBy({ id: "U-نوح", name: "نوح" }).join(",") === "m1",
  seenBy({ id: "U-نوح", name: "نوح" }).join(",") || "لا شيء"
);
check(
  "والمرسِلُ يقرأ ما أرسل",
  seenBy({ id: "U-ذياب", name: "ذياب" }).sort().join(",") === "m1,m2,m3",
  "فيعرف أأُنجز طلبُه أم لا"
);
check(
  "ولا يقرأ ثالثٌ رسالةَ غيره",
  !seenBy({ id: "U-ميس", name: "ميس" }).includes("m1") &&
    seenBy({ id: "U-ميس", name: "ميس" }).length === 0,
  `رأى ${seenBy({ id: "U-ميس", name: "ميس" }).length}`
);

/*
  وهذا شرطٌ لا يُستغنى عنه: معرّفُ الخادم uuid في العمود، ومعرّفُ
  التطبيق في data — ولو طُوبق بالمعرّف وحده لم تصل رسالةٌ إلى أحدٍ
  أصلاً، ولظهر البابُ عاملاً وهو مغلق.
*/
check(
  "ويُطابق بالاسم كما بالمعرّف",
  seenBy({ id: "معرّفٌ آخرُ تماماً", name: "نوح" }).join(",") === "m1",
  "فالمعرّفان مختلفان والاسمُ فريد"
);

/* وبلا هويّةٍ لا شيء — والسكوتُ منعٌ لا إذن */
check(
  "وبلا هويّةٍ لا يُعطى صفّاً",
  permits.readableState(all, ["movements.view"], undefined).messages.length === 0,
  "فنسيانُ تمريرِ الهويّة في مسارٍ جديدٍ لا يفتح رسائلَ الناس"
);
check(
  "والسببُ مكتوبٌ في موضعه",
  /والسكوتُ هنا منعٌ لا إذن/.test(permitsSrc)
);

/* وما استجدّ يُرشَّح كما تُرشَّح الحالة */
const pulled = permits.readableChanges(
  { upserts: { messages: all.messages }, deletes: {} },
  ["movements.view"],
  { id: "U-نوح", name: "نوح" }
);
check(
  "والسحبُ يُرشَّح أيضاً",
  pulled.upserts.messages.length === 1,
  "وإلّا وصلت رسالةُ غيره بعد لحظةٍ من حجبها"
);

/* والمسارانِ يُمرّران الهويّة */
check(
  "ومسارُ الحالة يُمرّرها",
  /readableState\(await readState\(readable\), user\.permissions, \{/.test(
    fs.readFileSync(path.join(ROOT, "app/api/data/route.ts"), "utf8")
  )
);
check(
  "ومسارُ ما استجدّ",
  /readableChanges\(changes, user\.permissions, \{ id: user\.id, name: user\.name \}\)/.test(
    fs.readFileSync(path.join(ROOT, "app/api/data/changes/route.ts"), "utf8")
  )
);

/* ------------------------------------------------------------------ */
console.log("\nولا تُحذف — تُختم ويبقى أثرُها:\n");

check(
  "لا صلاحيةَ حذفٍ لها",
  /messages: \{ write: \[\], remove: \[/.test(permitsSrc) &&
    /__لا أحد__/.test(permitsSrc),
  "فمن تُرك طلبُه شهراً يُعرف ذلك"
);
check(
  "والإنجازُ يشترط بياناً",
  /فـ«أُنجز» بلا بيانٍ لا يُراجَع/.test(page),
  "فيُقرأ بعد شهرٍ ما فُعل"
);
check(
  "ويُختم بوقته",
  /doneAt: new Date\(\)\.toISOString\(\)/.test(page)
);
check(
  "والفتحُ قراءةٌ لها",
  /فمن ذهب لينجزَ فقد قرأ/.test(page)
);
check("ويُسجَّل الإرسالُ والإنجاز", /طلبُ عملٍ إلى/.test(page));

/* ------------------------------------------------------------------ */
console.log("\nويراه صاحبُه عند ولوجه:\n");

const base = {
  movements: [],
  contractors: [],
  projects: [],
  employees: [],
  quotations: [],
  workItems: [],
  audit: [],
  backup: { at: new Date().toISOString(), movementCount: 0 },
  today: "2026-10-20",
  lastSeenAt: "2026-10-19T00:00:00.000Z",
  backupEveryDays: 10,
};

const forNoah = buildNotices({
  ...base,
  userName: "نوح",
  messages: all.messages,
});
check(
  "تنبيهٌ باسمه",
  forNoah.some((n) => n.id === "my-tasks" && n.page === "الأعمال"),
  forNoah[0]?.title ?? "لا تنبيه"
);
check(
  "ويُقدَّم على ما اشتُقّ من الدفاتر",
  forNoah[0]?.id === "my-tasks",
  "فنداءُ إنسانٍ باسمه أوّلُ ما يُرى"
);
check(
  "وفيه عددُها",
  forNoah.find((n) => n.id === "my-tasks")?.count === 1
);
check(
  "ولا يُنبَّه من لا طلبَ له",
  !buildNotices({ ...base, userName: "ميس", messages: all.messages }).some(
    (n) => n.id === "my-tasks"
  )
);
check(
  "ولا يُنبَّه بما أُنجز",
  !buildNotices({
    ...base,
    userName: "نوح",
    messages: [
      message("d1", {
        toName: "نوح",
        toUser: "U-نوح",
        state: "أُنجزت",
        doneNote: "فُعل",
      }),
    ],
  }).some((n) => n.id === "my-tasks"),
  "فالمنجَزُ أثرٌ لا طلب"
);

/* ------------------------------------------------------------------ */
console.log("\nوفي الشاشة:\n");

check("صفحةٌ ظاهرةٌ دائماً", /"الأعمال",/.test(page));
check(
  "ولا تُقيَّد بصلاحية",
  !/"الأعمال": "/.test(
    fs.readFileSync(path.join(ROOT, "lib/permissions.ts"), "utf8")
  ),
  "فكلُّ من له حسابٌ تُطلب منه أعمال"
);
check("وبابان: إليّ ومنّي", /tab === "إليّ"/.test(page) && /tab === "منّي"/.test(page));
check("والمنجَزُ يُخفى ويُظهَر", /setShowDone/.test(page));
check(
  "والشاشةُ المقصودةُ تُفتح بضغطة",
  /onNavigate\(m\.page\)/.test(page),
  "فلا يُترك يبحث عن موضع العمل"
);

/* ---- ودورةُ الحفظ ---- */
const back = normalizeState({ messages: all.messages }).messages;
check(
  "وما كُتب يعود كما كُتب",
  back.length === 3 && back[0].toName === "نوح" && back[0].state === "جديدة",
  `${back.length} رسالة`
);
check(
  "وحالةٌ مجهولةٌ تصير «جديدة»",
  normalizeState({ messages: [message("x", { state: "حالٌ لا وجودَ له" })] })
    .messages[0].state === "جديدة",
  "فلا تسقط من كلِّ ترشيح"
);

console.log(
  bad === 0
    ? "\n✓ الأعمال: لا يقرأ الرسالةَ إلا صاحبُها، ويراها عند ولوجه، ولا تُحذف بإنجازها"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
