/**
 * يفحص حسابَ المدعوم.
 *
 *   npm run check:subsidy [نسخة.json]
 *
 * والمدعومُ كميّةٌ وقيمةٌ معاً، وله سقفٌ من الدولة. فيُحرس من ثلاث:
 *
 *   • **ألّا يُخفى سحبٌ زائد.** من سحب أكثرَ من حصّته فذاك خطأُ تسجيلٍ
 *     أو مادةٌ اشترتها الشركةُ بالسعر التجاريّ — وعرضُ صفرٍ مكانَ
 *     الزيادة يُخفي عجزاً حقيقيّاً ويُسكت سؤالاً واجباً.
 *
 *   • **ألّا يُطرح سحبٌ من حصّةٍ ليست له.** سحبٌ نُسب إلى حصّةٍ حُذفت
 *     يبقى معروضاً وحدَه ولا يُحمَّل على مادةٍ أخرى — وإلّا ظهرت مادةٌ
 *     مستنفدةً وهي كاملة.
 *
 *   • **ألّا تُحسب الكميّةُ قيمةً.** فهما وجهان لا يُغني أحدُهما عن
 *     الآخر: من حفظ القيمةَ وحدها لم يعرف كم بقي من الأكياس.
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
const { projectSubsidy, subsidyByProject } = await jiti.import("../lib/subsidy.ts");
const { migrateState } = await jiti
  .import("../lib/storage.ts")
  .then((m) => ({ migrateState: m.normalizeState }));
const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");
const lib = fs.readFileSync(path.join(ROOT, "lib/subsidy.ts"), "utf8");

/* ------------------------------------------------------------------ */
/* قسيمةٌ مصنوعةٌ حالاتُها معلومةٌ سلفاً                                */
/* ------------------------------------------------------------------ */
const project = {
  id: "p1",
  name: "قسيمةٌ مصنوعة",
  budget: 0,
  startDate: "2026-01-01",
  status: "نشط",
  subsidy: [
    /* كاملةٌ لم يُسحب منها */
    { id: "L1", material: "إسمنت", quantity: 2000, unit: "كيس", value: 1400, feesOn: "المالك" },
    /* سُحب بعضُها */
    { id: "L2", material: "طابوق أبيض", quantity: 5000, unit: "عدد", value: 900 },
    /* استُنفدت تماماً */
    { id: "L3", material: "حديد", quantity: 10, unit: "طن", value: 2500 },
    /* سُحب أكثرُ من حصّتها */
    { id: "L4", material: "خرسانة جاهزة", quantity: 50, unit: "متر مكعّب", value: 1000 },
  ],
  subsidyDraws: [
    { id: "d1", lineId: "L2", date: "2026-07-22", quantity: 2000, value: 360, permit: "إذن-1" },
    { id: "d2", lineId: "L3", date: "2026-08-01", quantity: 10, value: 2500, permit: "إذن-2" },
    { id: "d3", lineId: "L4", date: "2026-09-01", quantity: 60, value: 1200 },
    /* سحبٌ نُسب إلى حصّةٍ لا وجودَ لها */
    { id: "d4", lineId: "محذوفة", date: "2026-09-15", quantity: 7, value: 99 },
  ],
};

const s = projectSubsidy(project);
const line = (id) => s.lines.find((x) => x.line.id === id);

console.log("\nالحصّةُ تُحسب بوجهيها — كميّةً وقيمة:\n");

check(
  "ما لم يُسحب منه يبقى كاملاً",
  line("L1").drawnQuantity === 0 &&
    line("L1").remainingQuantity === 2000 &&
    line("L1").remainingValue === 1400,
  `${line("L1").remainingQuantity} كيس · ${line("L1").remainingValue} د.ك`
);
check(
  "وما سُحب بعضُه يَنقص بالوجهين",
  line("L2").remainingQuantity === 3000 && line("L2").remainingValue === 540,
  `${line("L2").remainingQuantity} عدد · ${line("L2").remainingValue} د.ك`
);
check(
  "والكميّةُ لا تُحسب قيمةً",
  line("L2").drawnQuantity === 2000 && line("L2").drawnValue === 360,
  "٢٠٠٠ عددٍ بـ٣٦٠ د.ك — ولو خُلطا ظهر الباقي خطأً"
);
check(
  "وما استُنفد يُقال إنه استُنفد",
  line("L3").exhausted && !line("L3").overdrawn,
  `باقٍ ${line("L3").remainingQuantity} طن`
);

console.log("\nوالسحبُ الزائد يُقال ولا يُطوى:\n");

check(
  "الباقي سالبٌ لا صفرٌ",
  line("L4").remainingQuantity === -10 && line("L4").remainingValue === -200,
  `${line("L4").remainingQuantity} متر · ${line("L4").remainingValue} د.ك`
);
check("ويُعلَّم بالزيادة", line("L4").overdrawn === true);
check("والقسيمةُ كلُّها تُعلَّم", s.overdrawn === true);
check(
  "وتُقال العلّةُ في الشاشة",
  /سحبٌ يزيد على الحصّة/.test(page) &&
    /مادةٌ اشترتها الشركةُ بالسعر التجاريّ/.test(page),
  "فلا يُترك الرقمُ بلا تفسير"
);
check(
  "ولا يُستنفد بالزيادة",
  line("L4").exhausted === false,
  "فالزائدُ غيرُ المستنفد"
);

console.log("\nوسحبٌ بلا حصّةٍ لا يُطرح من غيرها:\n");

check(
  "يُفرَد ولا يُحمَّل",
  s.orphanDraws.length === 1 && s.orphanDraws[0].id === "d4",
  `${s.orphanDraws.length} سحبة`
);
check(
  "ولا يُنقص حصّةً قائمة",
  line("L1").drawnValue === 0 && line("L1").drawnQuantity === 0,
  "وإلّا ظهرت مادةٌ مستنفدةً وهي كاملة"
);
check(
  "ولا يدخل مجموعَ المسحوب",
  s.drawnValue === 360 + 2500 + 1200,
  `${s.drawnValue} — بلا ٩٩`
);
check("ويُقال لصاحبه في الشاشة", /نُسبت إلى حصّةٍ لا وجودَ/.test(page));

console.log("\nومجاميعُ القسيمة:\n");

check(
  "قيمةُ الحصص",
  s.value === 1400 + 900 + 2500 + 1000,
  String(s.value)
);
check(
  "والباقي قيمةً",
  s.remainingValue === 5800 - 4060,
  String(s.remainingValue)
);
check(
  "ورسومُ المدعوم على من أُثبت",
  s.feesOn.length === 1 && s.feesOn[0] === "المالك",
  s.feesOn.join("، ") || "لم يُثبت"
);
check(
  "ولا يُخترع لها صاحبٌ إن لم تُثبت",
  projectSubsidy({ ...project, subsidy: [{ id: "x", material: "إسمنت", quantity: 1, unit: "كيس", value: 1 }], subsidyDraws: [] })
    .feesOn.length === 0,
  "فمن طالَب بها من لا تلزمه ظلم"
);

console.log("\nوالقسائمُ بلا مدعومٍ لا تُعرض:\n");

const many = subsidyByProject([
  project,
  { id: "p2", name: "بلا مدعوم", budget: 0, startDate: "", status: "نشط" },
]);
check("تُستبعد", many.length === 1 && many[0].project === "قسيمةٌ مصنوعة");
check(
  "والأكثرُ باقياً أوّلاً",
  /\.sort\(\(a, b\) => b\.remainingValue - a\.remainingValue\)/.test(lib),
  "فهو ما يُتابع"
);
check(
  "ومن خلا من الحصص يُعرض ليُكتب له",
  /قسائمُ بلا حصّةِ مدعوم/.test(page)
);

console.log("\nوموضعُ الحصّة القسيمةُ لا العقد:\n");

check(
  "الحقلان على المشروع",
  /subsidy\?: SubsidyLine\[\];/.test(
    fs.readFileSync(path.join(ROOT, "lib/storage.ts"), "utf8")
  ),
  "فالحصّةُ واحدةٌ ولو كان للقسيمة عقودٌ وملاحق"
);
check(
  "ويُسوّيان عند القراءة",
  /subsidyDraws: Array\.isArray\(p\.subsidyDraws\)/.test(
    fs.readFileSync(path.join(ROOT, "lib/storage.ts"), "utf8")
  ),
  "وإلّا سقط ما حُفظ عند أول إعادة فتح"
);
/*
  والنداءُ لا النصّ: الشرطُ الأوّلُ طلب عبارةً في هذا الملفّ وهي في
  موضعها الآخر — وعبارةٌ تُنقل لا تُفحص. والمفحوصُ أن الحسابَ لا يقرأ
  استلامَ المواد أصلاً، فلا يمكن أن يُحسب السحبُ مرّتين.
*/
check(
  "والحسابُ لا يقرأ استلامَ المواد أصلاً",
  !/materialReceipts/.test(lib) && !/MaterialReceipt/.test(lib),
  "فذاك تتبّعٌ عينيّ، وهذا خصمٌ من سقف — ولو قُرئا حُسب السحبُ مرّتين"
);
check(
  "ويُقرأ من سجلّ الحصّة وحده",
  /const draws = project.subsidyDraws/.test(lib)
);

/* ---- ودورةُ الحفظ: ما كُتب يعود ---- */
const back = migrateState({ projects: [project] }).projects[0];
check(
  "وما كُتب من حصصٍ يعود كما كُتب",
  (back.subsidy ?? []).length === 4 && (back.subsidyDraws ?? []).length === 4,
  `${(back.subsidy ?? []).length} حصّة · ${(back.subsidyDraws ?? []).length} سحبة`
);
check(
  "وبوحداتها وأرقامها",
  back.subsidy[0].unit === "كيس" &&
    back.subsidy[0].quantity === 2000 &&
    back.subsidy[0].feesOn === "المالك" &&
    back.subsidyDraws[0].permit === "إذن-1",
  "فحقلٌ يُحفظ ولا يُحمَّل يسقط صامتاً"
);

/* ------------------------------------------------------------------ */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const { parseBackup } = await jiti.import("../lib/storage.ts");
  const state = parseBackup(fs.readFileSync(BACKUP, "utf8"));
  const rows = subsidyByProject(state.projects);
  console.log("\nوعلى دفاتر الشركة:\n");
  if (rows.length === 0) {
    console.log("     لا حصّةَ مكتوبةٌ بعد — والعقودُ تذكر المدعوم في ملاحظاتها:");
    for (const c of state.contractors) {
      const notes = (c.notes ?? "")
        .split("\n")
        .filter((l) => /مدعوم/.test(l))
        .map((l) => l.trim());
      for (const l of notes) console.log(`       ${c.contractNumber}: ${l.slice(0, 92)}`);
    }
  } else {
    for (const r of rows)
      console.log(
        `     ${String(r.project).padEnd(32)} حصّة ${String(r.value).padStart(8)} · سُحب ${String(
          r.drawnValue
        ).padStart(8)} · باقٍ ${String(r.remainingValue).padStart(8)}` +
          (r.overdrawn ? " ← سحبٌ زائد" : "")
      );
  }
}

console.log(
  bad === 0
    ? "\n✓ المدعوم: كميّةً وقيمةً، والزائدُ يُقال، وسحبٌ بلا حصّةٍ لا يُطرح من غيرها"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
