/**
 * يفحص دليل العمل.
 *
 *   npm run check:guides
 *
 * طلبه صاحب الشركة في ١٥ أكتوبر ٢٠٢٦: «صفحةٌ فيها تعليماتُ جميع
 * العمليات. أختار العملية فيمشي معي خطوةً خطوة حتى أنجزها كاملة».
 * وعلّتُه أن النظام فُتح لستّة، فكلٌّ يسأل عن الخطوة التالية — أو
 * يُدخل نصفَ العملية ويترك نصفَها، كدفعةٍ تُصرف ولا تُعتمد.
 *
 * والمفحوصُ هنا ليس وجودَ الصفحة: هو **صدقُ ما فيها**. فدليلٌ يُحيل
 * على شاشةٍ لا وجود لها، أو يذكر حساباً ليس في دليل الحسابات، أو
 * صلاحيةً ليست في النظام — يُضلّ قارئَه وهو يحسبه يهتدي. وذاك أسوأ من
 * ألّا يكون.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { GUIDES, guidesFor, guideGroups } = await jiti.import("../lib/guides.ts");
const { ALL_PERMISSIONS } = await jiti.import("../lib/permissions.ts");
const { GENERATED_CHART } = await jiti.import("../lib/accounting.ts");
const page = fs.readFileSync("app/page.tsx", "utf8");

/* أسماءُ الشاشات من قائمة الصفحات نفسها */
const pagesBlock = page.slice(page.indexOf("const PAGES = ["));
const SCREENS = new Set(
  (pagesBlock.slice(0, pagesBlock.indexOf("];")).match(/"([^"]+)"/g) ?? []).map((x) =>
    x.slice(1, -1)
  )
);

console.log("\nالأدلّةُ موجودةٌ ومتمايزة:\n");

check("فيها أدلّة", GUIDES.length > 0, `${GUIDES.length} دليلاً`);
check(
  "ولا معرّفَ مكرَّر",
  new Set(GUIDES.map((g) => g.id)).size === GUIDES.length
);
check(
  "ولا عنوانَ مكرَّر",
  new Set(GUIDES.map((g) => g.title)).size === GUIDES.length
);
check("ولكلٍّ خطوات", GUIDES.every((g) => g.steps.length > 0));
check(
  "ولكلٍّ متى تُستعمل",
  GUIDES.every((g) => (g.when ?? "").trim().length > 10),
  "فالعنوانُ وحده لا يُعرّف"
);

console.log("\nوما فيها صادقٌ على النظام:\n");

const badScreens = [];
for (const g of GUIDES)
  for (const s of g.steps)
    if (s.screen && !SCREENS.has(s.screen)) badScreens.push(`${g.id}: ${s.screen}`);
check(
  "كلُّ شاشةٍ مذكورةٍ موجودةٌ في القائمة",
  badScreens.length === 0,
  badScreens.join(" · ") || `${SCREENS.size} شاشة`
);

const badPerms = GUIDES.filter((g) => g.needs && !ALL_PERMISSIONS.includes(g.needs));
check(
  "وكلُّ صلاحيةٍ مذكورةٍ موجودةٌ في النظام",
  badPerms.length === 0,
  badPerms.map((g) => `${g.id}: ${g.needs}`).join(" · ") || "—"
);

/*
  الحسابات المذكورة في النصوص.

  ويُقاس على دليل حسابات الشركة إن أُعطيت نسخةٌ، وإلا فعلى المبذور.
  فحسابُ «إيجار السيارات» (5145) أُنشئ في الدفاتر ولم يكن في البذرة —
  وكان الفحصُ يُخفق عليه وهو حسابٌ قائمٌ تُقيَّد عليه الحركات.
*/
const BACKUP = process.argv[2];
const live =
  BACKUP && fs.existsSync(BACKUP)
    ? JSON.parse(fs.readFileSync(BACKUP, "utf8")).data.chart ?? []
    : [];
const codes = new Set([
  ...GENERATED_CHART.map((a) => a.code),
  ...live.map((a) => a.code),
]);
const mentioned = new Set();
for (const g of GUIDES)
  for (const s of g.steps)
    for (const m of `${s.body} ${s.warn ?? ""}`.matchAll(/\b([1-6]\d{3})\b/g))
      mentioned.add(m[1]);
const ghosts = [...mentioned].filter((c) => !codes.has(c));
check(
  "وكلُّ حسابٍ مذكورٍ موجودٌ في دليل الحسابات",
  ghosts.length === 0,
  ghosts.join(" · ") ||
    `${mentioned.size} حساباً${live.length ? " — على دليل الشركة" : " — على المبذور"}`
);

console.log("\nوالخطوةُ تقول ما يُفعل لا ما يُرى:\n");

const shortBodies = [];
for (const g of GUIDES)
  for (const s of g.steps) if ((s.body ?? "").trim().length < 25) shortBodies.push(`${g.id}: ${s.title}`);
check(
  "لكلِّ خطوةٍ شرحٌ لا عنوانٌ وحده",
  shortBodies.length === 0,
  shortBodies.join(" · ") || "—"
);
const warned = GUIDES.reduce((n, g) => n + g.steps.filter((s) => s.warn).length, 0);
check(
  "وفيها تحذيراتٌ مما يُخطئ فيه الناس",
  warned >= 8,
  `${warned} تحذيراً في ${GUIDES.reduce((n, g) => n + g.steps.length, 0)} خطوة`
);

console.log("\nوتُعرض بحسب الصلاحية:\n");

check(
  "من لا يملك شيئاً لا يُعرض له إلا ما لا يحتاج صلاحية",
  guidesFor([]).every((g) => !g.needs),
  `${guidesFor([]).length} دليلاً`
);
check(
  "ومن يملك كلَّ شيء يرى الكلّ",
  guidesFor(ALL_PERMISSIONS).length === GUIDES.length
);
check(
  "والمهندسُ يرى دليلَ الاعتماد والمستحقّ",
  (() => {
    const engineer = ["contracts.approve", "dues.create"];
    const ids = guidesFor(engineer).map((g) => g.id);
    return ids.includes("approve-stage") && ids.includes("due") && !ids.includes("payroll");
  })(),
  "ولا يرى مسيّر الرواتب"
);
check("والمجموعات تُحسب بترتيبها", guideGroups(GUIDES).length >= 4, guideGroups(GUIDES).join(" · "));

console.log("\nوالدليلُ يمشي مع صاحبه ولا يُخرجه:\n");

/*
  كان الدليلُ شاشةً مستقلّة: يقرأ الخطوة فيخرج منها إلى شاشة العمل،
  فيعود ليقرأ التي بعدها فيخرج. وقال صاحب الشركة: «هذا تصعيبٌ للعمل».
  فصار لوحةً ثابتةً تفتح شاشةَ العملية وتبقى معه فيها.
*/
check("الصفحةُ في القائمة", /"دليل العمل",/.test(page));
check("ومكوّنُ الاختيار موجود", /function GuidesPage\(\{\s+permissions,\s+onStart,/.test(page));
check("ورفيقُ الخطوة موجود", /function GuideCompanion\(\{/.test(page));
check(
  "وحالُ الدليل فوق الشاشات لا داخل صفحته",
  /const \[guide, setGuide\] = useState<\{ id: string; step: number \} \| null>\(null\);/.test(
    page
  ),
  "وإلا انقطع متى غادرها"
);
check(
  "والبدءُ يفتح شاشة أوّل خطوة",
  /const first = g\.steps\[0\]\?\.screen;\s+if \(first\) setPage\(first\);/.test(page)
);
check(
  "والانتقالُ إلى التالية ينقله إلى شاشتها",
  /const target = guide\.steps\[next\]\?\.screen;\s+if \(target\) onGo\(target\);/.test(
    page
  )
);
check(
  "والرفيقُ يُعرض خارج تبديل الصفحات",
  page.indexOf("<GuideCompanion") > page.indexOf('{page === "الإعدادات" && ('),
  "فيبقى ظاهراً في أي شاشة"
);
check("ويُطوى إن حجب العمل", /const \[folded, setFolded\] = useState\(false\);/.test(page));
check("ويُغلق بقرار صاحبه", /onClose=\{\(\) => setGuide\(null\)\}/.test(page));
check("ولا يُطبع مع الورق", /z-50 no-print/.test(page) && /z-50 w-\[min\(26rem[^"]*no-print/.test(page));
check("ويُعرف أين هو منها", /الخطوة \{step \+ 1\} من \{guide\.steps\.length\}/.test(page));
check("ويُقال اسم شاشتها معها", /شاشة «\$\{current\.screen\}»/.test(page));
check("والتحذيرُ يُميَّز بلونه", /<b>انتبه: <\/b>/.test(page));
check("ويُقال له حين يتمّ", /تمّت العملية/.test(page));

console.log("\nوأبوابُ النظام الكبرى مشمولة:\n");
const ids = GUIDES.map((g) => g.id);
for (const [label, id] of [
  ["إدخال مصروف", "expense"],
  ["قبض عميل", "client-receipt"],
  ["عقد جديد", "new-contract"],
  ["اعتماد مرحلة", "approve-stage"],
  ["إقرار مرحلة", "confirm-stage"],
  ["تسجيل مستحقّ", "due"],
  ["مسيّر الرواتب", "payroll"],
  ["النسخة والمطابقة", "backup"],
])
  check(label, ids.includes(id));

console.log(
  bad === 0
    ? "\n✓ الأدلّة تمشي خطوةً خطوة، وما فيها صادقٌ على النظام"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
