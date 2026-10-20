/**
 * يفحص مراجعةَ المدخلات ووسمَ استعجال السداد.
 *
 *   npm run check:review [نسخة.json]
 *
 * وأخصُّ ما يُفحص في المراجعة اثنان:
 *
 *   • **أن تُقاس بوقت الإدخال لا بتاريخ الحركة.** فمن أدخل اليومَ
 *     حركةَ شهرٍ ماضٍ لا يراها من يراجع «حركات اليوم» — وهي التي يجب
 *     أن تُراجَع اليوم. وذاك هو سببُ وجود الشاشة.
 *
 *   • **أن يُطابق السجلُّ بالرقم والتاريخ معاً.** فأرقامُ القيود تُعاد
 *     في كل سنةٍ ماليّة، ومن طابق بالرقم وحده نسب حركةَ ٢٠٢٥ إلى من
 *     أدخل حركةَ ٢٠٢٦ — وتلك تهمةٌ بلا دليل.
 *
 * وفي الوسم: أن يسقط عمّن قُضي حقُّه، وأن يُقدّم في الترتيب.
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
const review = await jiti.import("../lib/review.ts");
const { buildDues, URGENCY_LEVELS, urgencyRank } = await jiti.import("../lib/dues.ts");
const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");
const lib = fs.readFileSync(path.join(ROOT, "lib/review.ts"), "utf8");

const TODAY = new Date("2026-10-19T12:00:00");

/* ------------------------------------------------------------------ */
console.log("\nالمدّةُ تُحسب كما يفهمها صاحبُها:\n");

const w = (range, from, to) => review.reviewWindow(range, TODAY, from, to);

check("اليوم يومٌ واحد", w("اليوم").from === w("اليوم").to, w("اليوم").from);
check("وأمسِ قبله", w("أمس").from === "2026-10-18", w("أمس").from);
check(
  "وآخرُ سبعةٍ سبعةٌ بالأمسِ واليوم",
  w("آخر ٧ أيام").from === "2026-10-13" && w("آخر ٧ أيام").to === "2026-10-19",
  `${w("آخر ٧ أيام").from} → ${w("آخر ٧ أيام").to}`
);
check(
  "وهذا الشهرُ من أوّله إلى اليوم",
  w("هذا الشهر").from === "2026-10-01" && w("هذا الشهر").to === "2026-10-19"
);
check(
  "والشهرُ الماضي كاملاً",
  w("الشهر الماضي").from === "2026-09-01" && w("الشهر الماضي").to === "2026-09-30",
  `${w("الشهر الماضي").from} → ${w("الشهر الماضي").to}`
);
check(
  "ومدّةٌ بلا حدٍّ تعني كلَّ شيءٍ لا لا شيء",
  w("مدّة أختارها").from === "0000-01-01" && w("مدّة أختارها").to === "9999-12-31",
  "فالفراغُ لا يُفرِّغ الجدول"
);
/*
  والشرطُ على الشِّفْر لا على عبارةٍ يقطعها سطر: أوّلُ ما كُتب طلب
  جملةً من التعليق، وهي موزّعةٌ على سطرين بنجمةٍ بينهما — فأخفق على
  شِفْرٍ صحيح. والمفحوصُ أن اليومَ يُبنى من مكوّناته المحلّية.
*/
check(
  "واليومُ من ساعة الجهاز لا بالتوقيت العالمي",
  /today\.getFullYear\(\),\s*\n?\s*today\.getMonth\(\),\s*\n?\s*today\.getDate\(\)/.test(
    lib
  ) && /getTimezoneOffset\(\)/.test(lib),
  "وإلّا اختفت مدخلاتُ الليل من «اليوم» — فالكويت تسبق غرينتش بثلاث"
);

/* ------------------------------------------------------------------ */
console.log("\nووقتُ الإدخال من السجلّ، بالرقم والتاريخ معاً:\n");

const audit = [
  {
    id: "a1",
    at: "2026-10-19T08:00:00.000Z",
    user: "ذياب",
    action: "إنشاء",
    entity: "حركة",
    summary: "قيد 500 · 2026-10-19 · 100.000 د.ك · مصروف",
  },
  {
    /* نفسُ الرقم في سنةٍ أخرى — ومن طابق بالرقم وحده نسبه لذياب */
    id: "a2",
    at: "2025-03-01T08:00:00.000Z",
    user: "سامي",
    action: "إنشاء",
    entity: "حركة",
    summary: "قيد 500 · 2025-03-01 · 50.000 د.ك · مصروف",
  },
  {
    /* وإعادةُ إنشاءٍ بعد حذف: الأوّلُ هو الإدخال */
    id: "a3",
    at: "2026-10-19T20:00:00.000Z",
    user: "نوح",
    action: "إنشاء",
    entity: "حركة",
    summary: "قيد 500 · 2026-10-19 · 100.000 د.ك · مصروف",
  },
  {
    id: "a4",
    at: "2026-10-19T09:00:00.000Z",
    user: "نوح",
    action: "تعديل",
    entity: "حركة",
    summary: "قيد 500 · 2026-10-19 — معتمدة",
  },
];

const stamps = review.entryStamps(audit);
check(
  "لكلِّ سنةٍ صاحبُها",
  stamps.get("500|2026-10-19").user === "ذياب" &&
    stamps.get("500|2025-03-01").user === "سامي",
  "ولو طُوبق بالرقم وحده نُسب الاثنان لواحد"
);
check(
  "وأوّلُ إنشاءٍ هو الإدخال",
  stamps.get("500|2026-10-19").at === "2026-10-19T08:00:00.000Z",
  "فإعادةُ الإنشاء بعد حذفٍ لا تُزيح الأوّل"
);
check("والتعديلُ ليس إدخالاً", stamps.size === 2, `${stamps.size} بصمة`);

/* ------------------------------------------------------------------ */
console.log("\nوالمقياسُ وقتُ الإدخال لا تاريخُ الحركة:\n");

const movement = (id, entryNo, date, extra = {}) => ({
  id,
  entryNo,
  date,
  fiscalYear: Number(String(date).slice(0, 4)),
  movementType: "مصروف",
  amount: 100,
  itemName: "مواد إنشائية",
  debitCode: "5110",
  creditCode: "1111",
  project: "قسيمة",
  party: "مورّد",
  person: "",
  description: "وصف",
  approval: "معتمدة",
  ...extra,
});

/* حركةُ شهرٍ ماضٍ أُدخلت اليوم — وهي المقصودةُ بالمراجعة */
const old = movement("m1", 500, "2026-09-01");
const stampedOld = [
  {
    id: "b1",
    at: "2026-10-19T07:00:00.000Z",
    user: "ذياب",
    action: "إنشاء",
    entity: "حركة",
    summary: "قيد 500 · 2026-09-01 · 100.000 د.ك · مصروف",
  },
];

const byEntry = review.reviewMovements([old], stampedOld, {
  window: w("اليوم"),
  by: "وقت الإدخال",
});
const byDate = review.reviewMovements([old], stampedOld, {
  window: w("اليوم"),
  by: "تاريخ الحركة",
});
check(
  "حركةُ شهرٍ ماضٍ أُدخلت اليومَ تظهر في «اليوم»",
  byEntry.length === 1,
  "وهي التي تُراجَع اليوم"
);
check(
  "ولا تظهر بتاريخ الحركة",
  byDate.length === 0,
  "فالجدولُ لا يُغني عن المراجعة"
);
check(
  "ومن لا سجلَّ له لا يُنسب ليومٍ في مراجعة الإدخال",
  review.reviewMovements([old], [], { window: w("اليوم"), by: "وقت الإدخال" })
    .length === 0,
  "ولا يُحسب أنه أُدخل اليوم"
);

/* ------------------------------------------------------------------ */
console.log("\nوالعلاماتُ مواضعُ نظرٍ تُعلَّم:\n");

const rows = review.reviewMovements(
  [
    movement("f1", 1, "2026-10-19", { project: "" }),
    movement("f2", 2, "2026-10-19", { party: "", person: "" }),
    movement("f3", 3, "2026-10-19", { approval: "بانتظار الاعتماد" }),
    movement("f4", 4, "2026-10-19"),
    movement("f5", 5, "2026-10-19"),
    movement("f6", 6, "2026-10-19", { debitCode: "6240", project: "" }),
  ],
  [],
  { window: w("اليوم"), by: "تاريخ الحركة" }
);
const flagsOf = (id) => rows.find((r) => r.movement.id === id).flags;

check("بلا مشروعٍ على حساب مشروع", flagsOf("f1").includes("بلا مشروع"));
check(
  "ولا تُعلَّم الإداريّةُ بلا مشروع",
  !flagsOf("f6").includes("بلا مشروع"),
  "فالقرطاسيّةُ لا مشروعَ لها"
);
check("وبلا طرف", flagsOf("f2").includes("بلا طرف"));
check("وما ينتظر اعتماداً", flagsOf("f3").includes("تنتظر اعتماداً"));
check(
  "والمكرَّرُ المحتمل: يومٌ ومبلغٌ وبندٌ واحد",
  flagsOf("f4").includes("مكرَّرةٌ محتملة") &&
    flagsOf("f5").includes("مكرَّرةٌ محتملة"),
  "ويُعلَّم الطرفان لا أحدُهما"
);
check(
  "وبلا سجلّ إدخال",
  flagsOf("f1").includes("بلا سجلّ إدخال"),
  "فلا يُنسب إلى أحد"
);

const summary = review.reviewSummary(rows);
check("والمجموعُ يُحسب", summary.rows === 6 && summary.total === 600);
check("وتُعدّ المعلَّمة", summary.flagged === 6, String(summary.flagged));
check(
  "ومن لا سجلَّ له يُجمع تحت «بلا سجلّ»",
  summary.byUser.length === 1 && summary.byUser[0].user === "بلا سجلّ"
);

/* ------------------------------------------------------------------ */
console.log("\nوفي الشاشة بابٌ إليها:\n");

check("صفحةٌ في القائمة", /"مراجعة المدخلات",/.test(page));
check(
  "ومجموعتُها القيودُ والدفاتر",
  /"جدول الحركات",\s*\n\s*"مراجعة المدخلات",\s*\n\s*"القيود اليومية",/.test(page)
);
check("والمدّةُ تُختار بأزرار", /REVIEW_RANGES\.map/.test(page));
check("والمقياسُ يُبدَّل", /\["وقت الإدخال", "تاريخ الحركة"\]/.test(page));
check(
  "والمعلَّمةُ تُفرَد بضغطة",
  /setOnlyFlagged/.test(page)
);
check(
  "والضغطُ على السطر يفتح الحركة",
  /setEditing\(movement\);\s*\n\s*setPage\("جدول الحركات"\);/.test(page),
  "فتُصحَّح من موضعها"
);

/* ------------------------------------------------------------------ */
console.log("\nووسمُ استعجال السداد:\n");

check(
  "درجتان من الأشدّ",
  URGENCY_LEVELS.length === 2 &&
    URGENCY_LEVELS[0] === "عاجل" &&
    URGENCY_LEVELS[1] === "مستعجل",
  URGENCY_LEVELS.join(" ثم ")
);
check(
  "والعادةُ لا تُكتب",
  urgencyRank("") > urgencyRank("مستعجل"),
  "فالفراغُ آخرُ الرتب"
);

const due = (id, entryNo, amount, extra = {}) => ({
  id,
  entryNo,
  date: "2026-09-01",
  fiscalYear: 2026,
  movementType: "مستحق",
  amount,
  itemName: "أجور مقاولين",
  debitCode: "5120",
  creditCode: "2120",
  person: extra.person ?? "فلان",
  party: "",
  project: "قسيمة",
  description: "عمل",
  approval: "معتمدة",
  ...extra,
});

const report = buildDues(
  [
    due("u1", 10, 100, { person: "صاحبُ العاجل", urgency: "عاجل" }),
    due("u2", 11, 5000, { person: "صاحبُ الكثير" }),
    due("u3", 12, 200, { person: "صاحبُ المستعجل", urgency: "مستعجل" }),
  ],
  "2026-10-19"
);

check(
  "والأعجلُ أوّلاً لا الأكثرُ مالاً",
  report.people[0].person === "صاحبُ العاجل" &&
    report.people[1].person === "صاحبُ المستعجل" &&
    report.people[2].person === "صاحبُ الكثير",
  report.people.map((p) => p.person).join(" ← ")
);
check(
  "ولولا ذلك غرق العاجلُ الصغير",
  report.people[0].owed === 100,
  "مئةٌ قبل خمسةِ آلاف"
);
check(
  "ودرجةُ الشخص أشدُّ ما بقي له",
  report.people[0].urgency === "عاجل" && report.people[2].urgency === "",
  report.people.map((p) => `${p.person}: ${p.urgency || "عادي"}`).join(" · ")
);

/* ---- ويسقط الوسمُ عمّن قُضي حقُّه ---- */
const settled = buildDues(
  [
    due("u1", 10, 100, { person: "قُضي حقُّه", urgency: "عاجل" }),
    {
      ...due("s1", 11, 100, { person: "قُضي حقُّه" }),
      movementType: "سداد مستحق",
      debitCode: "2120",
      creditCode: "1111",
      dueId: "u1",
    },
  ],
  "2026-10-19"
);
check(
  "ويسقط الوسمُ عمّن قُضي حقُّه",
  settled.people[0].urgency === "",
  "وإلّا بقي «عاجل» على من لا يُستحقّ له شيء"
);

check(
  "والوسمُ في الشاشة لمن بقي له شيء",
  /row\.remaining > 0\.0005 \? \(/.test(page) && /URGENCY_LEVELS\.map/.test(page)
);
check(
  "ويُسجَّل تغييرُه",
  /استعجال السداد/.test(page),
  "فمن قدّم مستحقّاً على غيره يُعرف"
);

/* ------------------------------------------------------------------ */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const { parseBackup } = await jiti.import("../lib/storage.ts");
  const state = parseBackup(fs.readFileSync(BACKUP, "utf8"));
  const live = review.entryStamps(state.audit ?? []);
  console.log("\nوعلى دفاتر الشركة:\n");
  console.log(
    `     حركاتٌ لها سجلُّ إدخال: ${live.size} من ${state.movements.length}`
  );
  for (const range of ["اليوم", "أمس", "آخر ٧ أيام", "آخر ٣٠ يوماً"]) {
    const win = review.reviewWindow(range, new Date(), "", "");
    const r = review.reviewMovements(state.movements, state.audit ?? [], {
      window: win,
      by: "وقت الإدخال",
    });
    const s = review.reviewSummary(r);
    console.log(
      `     ${String(range).padEnd(14)} ${String(s.rows).padStart(4)} حركة · ${String(
        s.total
      ).padStart(10)} د.ك · ${s.flagged} موضعَ نظر`
    );
  }
}

console.log(
  bad === 0
    ? "\n✓ المراجعة بوقت الإدخال، والسجلُّ يُطابق بالرقم والتاريخ، والأعجلُ يُقدَّم"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
