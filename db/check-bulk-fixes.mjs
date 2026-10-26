/**
 * يفحص التصحيحاتِ المجمّعة — وأن ما تمّ منها يختفي.
 *
 *   npm run check:fixes
 *
 * وعلّتُه علّةٌ وقعت: كُتب ترشيحُ توحيدِ اسمٍ بصيغةٍ تُطابق الصيغَ
 * الخاطئةَ **والصيغةَ المقصودةَ معها** — `^شركة نبيل [أا]با حسين`.
 * فبقي التصحيحُ يُعرض بسبع حركاتٍ بعد تنفيذه، فضغطه صاحبُ الشركة
 * أربعَ مرّاتٍ ولا يرى تغييراً: «كلّما أضغط تظهر الرسالة وأضغط أوكي
 * ولا يتمّ التصحيح». وكان قد تمّ من أوّل مرّة.
 *
 * والعلاجُ في المُحصي لا في الترشيح: صفٌّ قيمتُه قيمةُ المقصد ليس
 * محلّاً للتصحيح أيّاً كان ترشيحُه. فيسقط من العدّ، فيبلغ التصحيحُ
 * صفراً ويختفي — واختفاؤه هو الدليلُ على أنّه تمّ.
 *
 * ويُفحص كذلك أنّ كلَّ تصحيحٍ له مقصدٌ واحدٌ على الأقلّ، وأنّ لكلٍّ
 * سبباً مكتوباً ومعرّفاً لا يتكرّر — فتصحيحٌ بلا سببٍ لا يُدافَع عنه
 * بعد شهور.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

/*
  ويُسوّى سطرُ الملفّ أوّلاً: فـ«page.tsx» بنهايات CRLF، وشرطٌ يقسمه
  بـ«\n» وحده يُرجع صفراً فيمرّ فارغاً — وقعت فيها في هذا الفحص نفسِه.
*/
const page = fs
  .readFileSync(path.join(ROOT, "app/page.tsx"), "utf8")
  .replace(/\r\n/g, "\n");

/* ---- ١) الحارسُ موجودٌ في المُحصي ---- */
console.log("\nوما بلغ غايتَه لا يُعَدّ هدفاً:\n");

check(
  "المُحصي يُسقط ما بلغ مقصدَه",
  /const settled = \(fix: BulkFix, m: Movement\): boolean =>/.test(page),
  "فلا يبقى تصحيحٌ يُعرض بعد تنفيذه"
);
check(
  "ويُشترط بلوغُ كلِّ ما يُغيّره",
  /goals\.length > 0 && goals\.every\(Boolean\)/.test(page),
  "فتصحيحٌ ينقل حساباً ومشروعاً لا يُسقَط ببلوغ أحدهما"
);
check(
  "ويُسقَط قبل الترشيح لا بعده",
  /movements\.filter\(\(m\) => fix\.match\(m\) && !settled\(fix, m\)\)/.test(page)
);
for (const [field, goal] of [
  ["party", "toParty"],
  ["person", "toPerson"],
  ["project", "toProject"],
  ["debitCode", "toAccount"],
])
  check(
    `ويُقاس «${goal}» على «${field}»`,
    new RegExp(`fix\\.${goal} !== undefined.*same\\(m\\.${field}, fix\\.${goal}\\)`, "s").test(
      page
    )
  );

/* ---- ٢) ويُجرَّب المنطقُ لا النصّ ---- */
console.log("\nويُجرَّب:\n");

/* يُنتزع المنطقُ نفسُه كما كُتب، فيُجرى عليه ما يجري في الشاشة */
const settled = (fix, m) => {
  const same = (was, to) => to !== undefined && (was ?? "").trim() === to.trim();
  const goals = [];
  if (fix.toParty !== undefined) goals.push(same(m.party, fix.toParty));
  if (fix.toPerson !== undefined) goals.push(same(m.person, fix.toPerson));
  if (fix.toProject !== undefined) goals.push(same(m.project, fix.toProject));
  if (fix.toAccount !== undefined) goals.push(same(m.debitCode, fix.toAccount));
  return goals.length > 0 && goals.every(Boolean);
};

const unify = { toParty: "شركة نبيل أبا حسين للتجارة العامة" };
check(
  "الصحيحُ يُسقَط",
  settled(unify, { party: "شركة نبيل أبا حسين للتجارة العامة" }) === true
);
check(
  "والخطأُ يبقى",
  settled(unify, { party: "شركة نبيل ابا حسين التجارية" }) === false
);
check(
  "والفراغاتُ لا تصنع فرقاً",
  settled(unify, { party: "  شركة نبيل أبا حسين للتجارة العامة " }) === true,
  "فصيغةٌ تختلف بفراغٍ في آخرها هي هي"
);
check(
  "والفارغُ ليس مقصداً",
  settled({ toParty: "اسم" }, { party: "" }) === false
);

const two = { toAccount: "5180", toProject: "مصروفات مشتركة" };
check(
  "وتصحيحٌ بمقصدين لا يُسقَط ببلوغ أحدهما",
  settled(two, { debitCode: "5180", project: "عام" }) === false,
  "فالحسابُ بلغ والمشروعُ لم يبلغ"
);
check(
  "ويُسقَط ببلوغهما",
  settled(two, { debitCode: "5180", project: "مصروفات مشتركة" }) === true
);
check(
  "وتصحيحٌ بلا مقصدٍ لا يُسقِط شيئاً",
  settled({}, { party: "أيٌّ كان" }) === false,
  "فلا يُخفى تصحيحٌ لا يُعرف ما يفعل"
);

/* ---- ٣) وبنيةُ القائمة ---- */
console.log("\nوبنيةُ القائمة:\n");

const block = (() => {
  const at = page.indexOf("const BULK_FIXES: BulkFix[] = [");
  const end = page.indexOf("\n];", at);
  return page.slice(at, end);
})();

const ids = [...block.matchAll(/^\s{4}id: "([a-z0-9-]+)",/gm)].map((m) => m[1]);
check("فيها تصحيحات", ids.length > 0, `${ids.length} تصحيحاً`);
check(
  "ولا معرّفَ مكرَّر",
  ids.length === new Set(ids).size,
  ids.length === new Set(ids).size
    ? ""
    : `مكرَّر: ${ids.filter((x, i) => ids.indexOf(x) !== i).join(" · ")}`
);

const blocks = block.split(/\n {2}\{\n/).slice(1);
/* ولا يُقبل عدٌّ فارغ: شرطٌ يقيس صفراً يمرّ أبداً ولا يحرس شيئاً */
check(
  "والقائمةُ تُقسَم إلى تصحيحاتها",
  blocks.length === ids.length && blocks.length > 0,
  `${blocks.length} كتلة من ${ids.length} معرّفاً`
);
const noReason = blocks.filter((b) => !/reason:/.test(b)).length;
check("ولكلٍّ سببٌ مكتوب", noReason === 0, `${blocks.length} تصحيحاً`);
const noGoal = blocks.filter(
  (b) => !/to(Account|Project|Person|Party):/.test(b)
).length;
check(
  "ولكلٍّ مقصدٌ واحدٌ على الأقلّ",
  noGoal === 0,
  "فتصحيحٌ بلا مقصدٍ لا يفعل شيئاً ولا يختفي"
);
const noMatch = blocks.filter((b) => !/match:/.test(b)).length;
check("ولكلٍّ ترشيح", noMatch === 0);

console.log(
  bad === 0
    ? "\n✓ التصحيحاتُ المجمّعة: لكلٍّ سببُه ومقصدُه، وما تمّ منها يختفي"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
