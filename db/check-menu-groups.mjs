/**
 * يفحص تجميعَ القائمة الرئيسية.
 *
 *   npm run check:menu
 *
 * والطيُّ يُخفي، فيُحرس من ثلاثٍ:
 *
 *   • **ألّا تَسقط صفحة.** كلُّ صفحةٍ في النظام إمّا في مجموعةٍ وإمّا
 *     ظاهرةٌ وحدها. ولو نُسيت واحدةٌ لاختفت من القائمة كلِّها — لا
 *     يبلغها أحدٌ إلا بعلمه بوجودها.
 *
 *   • **ألّا يختفي تنبيه.** شارةُ العدد على صفحةٍ داخل مجموعةٍ مطويّة
 *     تَصعد إلى رأس المجموعة — وإلّا طُوي بابُ الاعتماد وفيه حركةٌ
 *     تنتظر، ولا يعلم صاحبُه.
 *
 *   • **ألّا تُطوى صفحةٌ هو فيها**، وألّا تُعرض مجموعةٌ حُجبت صفحاتُها
 *     كلُّها عن صاحب الجلسة.
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

const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");

/* ---- تُقرأ القائمتان من الشِّفْر، فلا تُكتب هنا مرّةً أخرى ---- */
const listOf = (name) => {
  const at = page.indexOf(`const ${name} = [`);
  if (at < 0) throw new Error(`لا توجد ${name}`);
  const end = page.indexOf("\n];", at);
  return page.slice(at, end);
};

const pagesBlock = listOf("PAGES");
const PAGES = [...pagesBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const groupsAt = page.indexOf("const PAGE_GROUPS");
const groupsEnd = page.indexOf("\n];", groupsAt);
const groupsBlock = page.slice(groupsAt, groupsEnd);
const GROUPS = [...groupsBlock.matchAll(/group: "([^"]+)",\s*\n\s*pages: \[([^\]]+)\]/g)].map(
  (m) => ({
    group: m[1],
    pages: [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1]),
  })
);

console.log(`\nالقائمة: ${PAGES.length} صفحةً في ${GROUPS.length} مجموعةً\n`);

check("المجموعاتُ مقروءةٌ من الشِّفْر", GROUPS.length >= 5, `${GROUPS.length}`);

/* ---- ١. لا تَسقط صفحة ---- */
const grouped = GROUPS.flatMap((g) => g.pages);
const loose = PAGES.filter((p) => !grouped.includes(p));
const strays = grouped.filter((p) => !PAGES.includes(p));

check(
  "كلُّ صفحةٍ مجموعةٌ أو ظاهرةٌ وحدها",
  strays.length === 0,
  strays.length === 0
    ? `${grouped.length} مجموعةً · ${loose.length} ظاهرةً`
    : `أسماءٌ في المجموعات ليست صفحاتٍ: ${strays.join("، ")}`
);
check(
  "ولا تُسمّى صفحةٌ في مجموعتين",
  new Set(grouped).size === grouped.length,
  grouped.filter((p, i) => grouped.indexOf(p) !== i).join("، ") || "لا تكرار"
);
check(
  "والظاهرُ وحده هو ما يُقصد قصداً",
  loose.length === 2 && loose.includes("الرئيسية") && loose.includes("دليل العمل"),
  loose.join("، ")
);

/* ---- ٢. الترتيبُ ترتيبُ اليوم ---- */
const order = GROUPS.map((g) => g.group);
check(
  "القيودُ أوّلاً والإعدادُ آخراً",
  order[0] === "القيود والدفاتر" &&
    order[order.length - 1] === "الإعداد والصيانة",
  order.join(" ← ")
);

/* ---- ٣. الشارةُ تَصعد ---- */
console.log("\nوالطيُّ لا يُخفي تنبيهاً:\n");

check(
  "شارةُ المجموعة مجموعُ شارات صفحاتها",
  /const badge = mine\.reduce\(\(sum, name\) => sum \+ badgeOf\(name\), 0\);/.test(page)
);
check(
  "وتُعرض على رأسها حين تُطوى",
  /\{!open && badge > 0 && \(/.test(page),
  "ومفتوحةً تُرى على صفحاتها نفسها"
);
check(
  "ولولا ذلك اختفى التنبيهُ بطيّ بابه",
  /فيُطوى بابُ الاعتماد وفيه/.test(page),
  "والسببُ مكتوبٌ في موضعه"
);

/* ---- ٤. لا تُطوى صفحةٌ هو فيها ---- */
console.log("\nولا يَضِلّ موضعَه:\n");

check(
  "المجموعةُ التي فيها صفحتُه مفتوحة",
  /const here = mine\.includes\(page\);/.test(page) &&
    /const open = here \|\| openGroups\.includes\(group\);/.test(page)
);
check(
  "ورأسُها يُعلَّم وإن طُويت",
  /here && !open/.test(page) && /here \? "font-bold" : ""/.test(page)
);

/* ---- ٥. الصلاحيات ---- */
console.log("\nولا تُعرض مجموعةٌ لا يقرأ منها شيئاً:\n");

check(
  "تُرشَّح صفحاتُها بالمرئيّ",
  /const mine = pages\.filter\(\(name\) =>\s*\n?\s*visiblePages\.includes\(name\)\s*\n?\s*\);/.test(
    page
  )
);
check(
  "وتُحجب إن خلت",
  /if \(mine\.length === 0\) return null;/.test(page)
);
check(
  "ومجموعةٌ بصفحةٍ واحدةٍ تُعرض صفحةً",
  /if \(mine\.length === 1\) return item\(mine\[0\], false\);/.test(page),
  "فبابٌ على شيءٍ واحدٍ ضغطةٌ بلا فائدة"
);

/* ---- ٦. يبقى ما فُتح ---- */
console.log("\nوعادتُه لا تُنسى:\n");

check("ما فُتح يُحفظ", /const MENU_KEY = "theyab:menu-open";/.test(page));
check(
  "ويُقرأ عند الإقلاع",
  /window\.localStorage\.getItem\(MENU_KEY\)/.test(page)
);
check(
  "ويُكتب عند كل فتح",
  /window\.localStorage\.setItem\(MENU_KEY, JSON\.stringify\(next\)\)/.test(page)
);
check(
  "ولا يُعطّله تخزينٌ ممنوع",
  /تخزينٌ ممنوع أو تالف/.test(page) && /التخزين ممتلئ/.test(page)
);

/* ---- وبيانُ المجموعات ---- */
console.log("");
for (const g of GROUPS) {
  console.log(`     ${g.group} (${g.pages.length}): ${g.pages.join(" · ")}`);
}
console.log(`     ظاهرةٌ دائماً: ${loose.join(" · ")}`);

console.log(
  bad === 0
    ? `\n✓ القائمة: ${GROUPS.length} مجموعاتٍ و${loose.length} ظاهرتين — لا صفحةَ تسقط، ولا تنبيهَ يختفي`
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
