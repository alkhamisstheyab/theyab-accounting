/**
 * يفحص تقاريرَ الاجتماعات وصورَها.
 *
 *   npm run check:minutes
 *
 * وأخطرُ ما فيها الصور: صورةٌ من هاتفٍ ثلاثةُ ميغا، والنسخةُ
 * الاحتياطيّة اليومَ ٣٫٨٥ وحدُّ الردّ عند الناشر ٤٫٥. فصورتان
 * تُخفقان النسخةَ صامتةً يومَ تُحتاج — وتلك خسارةُ الدفاتر كلِّها
 * لأجل صورة. فتُرفع إلى المخزن، ويُحفظ في الصفّ مسارُها وحدَه،
 * **ويُسقَط كلُّ ما جاء بصيغة data:** ولا يُحفظ.
 *
 * ويُفحص كذلك:
 *   • أن القرارَ غيرُ الكلام: له صاحبٌ وموعد، ويُحوَّل طلبَ عملٍ
 *     يبلغ صاحبَه — فقرارٌ مكتوبٌ في تقريرٍ لا يُنفَّذه من لم يقرأه.
 *   • أن مسارَ الصورة لا يُقرأ إلا من مجلّدها — فالمخزنُ فيه النسخُ
 *     الاحتياطيّة نفسها.
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
const m = await jiti.import("../lib/minutes.ts");
const { normalizeState, emptyState } = await jiti.import("../lib/storage.ts");
const { ROW_COLLECTIONS } = await jiti.import("../lib/collections.ts");
const { COLLECTIONS } = await jiti.import("../lib/server/collections.ts");

const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");
const photos = fs.readFileSync(path.join(ROOT, "app/api/photos/route.ts"), "utf8");
const schema = fs.readFileSync(path.join(HERE, "schema.sql"), "utf8");
const storage = fs.readFileSync(path.join(ROOT, "lib/storage.ts"), "utf8");
const permits = fs.readFileSync(path.join(ROOT, "lib/server/permits.ts"), "utf8");

/* ------------------------------------------------------------------ */
console.log("\nالمجموعةُ مبنيّةٌ في طبقاتها:\n");

check("في الحالة", Object.prototype.hasOwnProperty.call(emptyState(), "minutes"));
check("وفي الصفوف", ROW_COLLECTIONS.some((c) => c.field === "minutes"));
check(
  "وفي جداول الخادم",
  (COLLECTIONS ?? []).some((c) => c.field === "minutes" && c.table === "minutes")
);
check("وفي المخطَّط", /CREATE TABLE minutes/.test(schema));
check(
  "وفي هجرةٍ تنزل على قاعدةٍ عاملة",
  fs.existsSync(path.join(HERE, "migrations", "003-minutes.sql"))
);
check(
  "ويَنقلها الاسترجاع",
  /await fillData\(db, "minutes"/.test(
    fs.readFileSync(path.join(HERE, "migrate.mjs"), "utf8")
  )
);
check(
  "ولا تُحذف إلا بصلاحية المشاريع",
  /minutes: \{ write: \["projects\.manage"\], remove: \["projects\.manage"\] \}/.test(
    permits
  ),
  "فهي سندٌ على ما قيل، قد يكون لك لا عليك"
);

/* ------------------------------------------------------------------ */
console.log("\nوالصورُ في المخزن لا في الدفاتر:\n");

const withData = normalizeState({
  minutes: [
    {
      id: "m1",
      date: "2026-10-20",
      photos: [
        { id: "p1", path: "minutes/2026-10-20-abc.jpg", size: 120000 },
        /* وصورةٌ جاءت ببياناتها — تُسقَط ولا تُحفظ */
        { id: "p2", path: "data:image/jpeg;base64,AAAA", size: 3000000 },
        /* وبلا مسارٍ لا شيء */
        { id: "p3", path: "", size: 0 },
      ],
    },
  ],
}).minutes[0];

check(
  "المسارُ يُحفظ",
  withData.photos.length === 1 && withData.photos[0].path.startsWith("minutes/"),
  `${withData.photos.length} صورة`
);
check(
  "وما جاء ببياناته يُسقَط",
  !withData.photos.some((p) => p.path.startsWith("data:")),
  "فمن حفظ الصورةَ في الصفّ ضخّم النسخةَ حتى تُخفق"
);
check("وبلا مسارٍ لا شيء", !withData.photos.some((p) => p.path === ""));
check(
  "والسببُ مكتوبٌ في موضعه",
  /فمن حفظ الصورةَ في الصفّ ضخّم النسخة/.test(storage)
);

check(
  "ومسارُها لا يُقرأ إلا من مجلّدها",
  /wanted\.startsWith\(`\$\{FOLDER\}\/`\)/.test(photos) &&
    /wanted\.includes\(".."\)/.test(photos),
  "فالمخزنُ فيه النسخُ الاحتياطيّة نفسها"
);
check(
  "والنوعُ يُفحص من الملفّ لا من اسمه",
  /ALLOWED\.includes\(file\.type\)/.test(photos),
  "فاسمٌ ينتهي بـ.jpg لا يجعل ما فيه صورة"
);
check(
  "ولها حدُّ حجم",
  /MAX_BYTES = 15 \* 1024 \* 1024/.test(photos),
  "أكبرُ من صورة هاتفٍ بأضعاف، وأصغرُ من أن يُستغلّ المخزن"
);
check(
  "والمخزنُ خاصٌّ لا عامّ",
  (photos.match(/access: "private"/g) ?? []).length >= 2,
  "فصورةُ موقعٍ قد يكون فيها ما لا يُنشر"
);
check(
  "ورفعُها بصلاحية، وقراءتُها بصلاحية",
  /requirePermission\("projects\.manage"\)/.test(photos) &&
    /requirePermission\("projects\.view"\)/.test(photos)
);
check(
  "وبلا مخزنٍ يُقال ولا يُخفق صامتاً",
  /لا مخزنَ موصولاً/.test(photos)
);

/* ------------------------------------------------------------------ */
console.log("\nوالقرارُ غيرُ الكلام:\n");

const minute = {
  id: "m2",
  date: "2026-10-01",
  period: "أسبوعيّ",
  project: "قسيمة",
  kind: "اجتماع",
  title: "مراجعة",
  attendees: "ذياب · نوح · العميل",
  body: "ما قيل",
  decisions: [
    { id: "d1", text: "يُصلح العيب", owner: "نوح", due: "2026-10-10", done: false, doneAt: "" },
    { id: "d2", text: "يدفع الدفعة", owner: "العميل", due: "2026-11-01", done: false, doneAt: "" },
    { id: "d3", text: "أُنجز", owner: "نوح", due: "2026-10-05", done: true, doneAt: "2026-10-04" },
    { id: "d4", text: "بلا موعد", owner: "نوح", due: "", done: false, doneAt: "" },
  ],
  photos: [],
  createdBy: "ذياب",
  createdAt: "2026-10-01T10:00:00.000Z",
};

const state = m.minuteState(minute, "2026-10-20");
check(
  "القائمُ ثلاثةٌ والمنجَزُ لا يُعدّ",
  state.open.length === 3,
  `${state.open.length}`
);
check(
  "والمتأخّرُ ما مضى موعدُه",
  state.overdue.length === 1 && state.overdue[0].id === "d1",
  state.overdue.map((d) => d.id).join(",")
);
check(
  "وما لا موعدَ له لا يُعدّ متأخّراً",
  !state.overdue.some((d) => d.id === "d4"),
  "فمن لم يُحدَّد له موعدٌ لم يُخلّ بموعد"
);
check(
  "وما موعدُه آتٍ لا يُعدّ متأخّراً",
  !state.overdue.some((d) => d.id === "d2")
);

const message = m.decisionToMessage(
  minute,
  minute.decisions[0],
  { id: "U-نوح", name: "نوح" },
  "ذياب"
);
check(
  "والقرارُ يُحوَّل طلبَ عمل",
  message.toName === "نوح" && message.body.includes("يُصلح العيب"),
  "فقرارٌ مكتوبٌ في تقريرٍ لا يُنفّذه من لم يقرأه"
);
check(
  "ويحمل موعدَه وأصلَه",
  message.body.includes("2026-10-10") &&
    message.body.includes("اجتماع 2026-10-01") &&
    message.about.includes("2026-10-01"),
  "فيُعرف يومُ الاتفاق عليه"
);
check(
  "وصفحتُه الأعمال",
  message.page === "الأعمال" && message.state === "جديدة"
);
check(
  "ويبقى في التقرير سنداً",
  /ويبقى في التقرير سنداً/.test(
    fs.readFileSync(path.join(ROOT, "lib/minutes.ts"), "utf8")
  )
);

/* ---- المجاميع ---- */
const sum = m.minutesSummary([minute], "2026-10-20");
check(
  "والمجاميعُ تُقرأ",
  sum.total === 1 && sum.open === 3 && sum.overdue === 1,
  `${sum.total} تقريراً · ${sum.open} قائماً · ${sum.overdue} متأخّراً`
);
check(
  "ومشاريعُ لها تقارير",
  sum.projects.length === 1 && sum.projects[0] === "قسيمة"
);
check(
  "وآخرُ تقريرٍ لكلِّ مشروع",
  sum.latest["قسيمة"] === "2026-10-01"
);
check(
  "وتقاريرُ المشروع بالأحدث",
  m
    .minutesOf([minute, { ...minute, id: "m3", date: "2026-10-15" }], "قسيمة")
    .map((x) => x.date)
    .join(",") === "2026-10-15,2026-10-01"
);
check(
  "وبلا مشروعٍ تُقرأ كلُّها",
  m.minutesOf([minute, { ...minute, id: "m4", project: "أخرى" }], "").length === 2
);

/* ---- الحفظ ---- */
const back = normalizeState({ minutes: [minute] }).minutes[0];
check(
  "وما كُتب يعود كما كُتب",
  back.decisions.length === 4 &&
    back.attendees === "ذياب · نوح · العميل" &&
    back.period === "أسبوعيّ",
  `${back.decisions.length} التزاماً`
);
check(
  "ونوعٌ مجهولٌ يصير «اجتماع»",
  normalizeState({ minutes: [{ ...minute, kind: "نوعٌ غريب" }] }).minutes[0]
    .kind === "اجتماع"
);
check(
  "ودوريّةٌ مجهولةٌ تصير «طارئ»",
  normalizeState({ minutes: [{ ...minute, period: "لا شيء" }] }).minutes[0]
    .period === "طارئ"
);

/* ------------------------------------------------------------------ */
console.log("\nوفي الشاشة:\n");

check("صفحةٌ في القائمة", /"تقارير الاجتماعات",/.test(page));
check("والحاضرون يُكتبون", /ذياب الخميس · م. نوح · العميل حسن العجمي/.test(page));
check(
  "والالتزامُ له صاحبٌ وموعد",
  /placeholder="م\. نوح · العميل"/.test(page)
);
check("ويُرسل بضغطة", /أرسِله إلى…/.test(page));
check(
  "والصورُ تُرفع إلى المسار",
  /fetch\("\/api\/photos", \{ method: "POST", body \}\)/.test(page)
);
check(
  "وتُعرض من المسار لا من الصفّ",
  /\/api\/photos\?path=\$\{encodeURIComponent\(photo\.path\)\}/.test(page)
);
check(
  "ويُقال لصاحبه لمَ لا تُحفظ في الدفاتر",
  /ولا تُحفظ في الدفاتر/.test(page)
);
check(
  "وتقريرٌ فارغٌ لا يُحفظ",
  /وتقريرٌ فارغٌ لا يُحتجّ به/.test(page)
);
check(
  "وحذفُه يُستأذن فيه",
  /وهو سندٌ على ما قيل — قد يكون لك لا عليك/.test(page)
);

console.log(
  bad === 0
    ? "\n✓ التقارير: ما قيل موثَّقٌ بحاضريه، والقرارُ له صاحبٌ ويبلغه، والصورُ في المخزن لا في الدفاتر"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
