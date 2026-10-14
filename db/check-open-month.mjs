/**
 * يفحص الشهر الذي تُفتح عليه شاشتا الحضور والرواتب.
 *
 *   npm run check:month
 *
 * كانتا تُفتحان على **يناير** أيّاً كان اليوم. فمن أراد حضورَ هذا الشهر
 * نزل إلى القائمة واختاره في كل مرة، وكذلك من أراد مسيّر الشهر. وشكا
 * صاحب الشركة: «أريده أن يفتح على الشهر الذي أنا فيه، حتى أعرف بلا
 * تضييع وقتٍ حالَ حضور الموظفين وأضيف اليوم».
 *
 * ولا يُفتح على شهرٍ خارج السنة المختارة: من يراجع سنةً مضت لا يُقحَم في
 * شهرٍ ليس منها، فيُقصر شهرُ اليوم على حدّي تلك السنة.
 *
 * واليوم بتوقيت الكويت لا غرينتش — فمن فتحها بعد منتصف الليل في أول
 * الشهر لا تُفتح له على الشهر الماضي.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { monthInYear, todayISO } = await jiti.import("../lib/today.ts");

const today = todayISO();
const thisYear = Number(today.slice(0, 4));

console.log("\nتُفتح على شهر اليوم:\n");

check(
  "السنةُ الحالية تُفتح على شهرها",
  monthInYear(thisYear) === today.slice(0, 7),
  `${monthInYear(thisYear)} واليوم ${today}`
);
check(
  "وبتوقيت الكويت لا غرينتش",
  monthInYear(thisYear) === todayISO().slice(0, 7),
  "فمن فتحها بعد منتصف الليل لا يُردّ إلى الشهر الماضي"
);

console.log("\nولا تخرج عن السنة المختارة:\n");

check(
  "سنةٌ مضت تُفتح على آخر شهورها",
  monthInYear(thisYear - 1) === `${thisYear - 1}-12`
);
check(
  "وسنةٌ لم تأتِ تُفتح على أوّلها",
  monthInYear(thisYear + 1) === `${thisYear + 1}-01`
);
check(
  "وكلُّها داخل سنتها",
  [thisYear - 2, thisYear - 1, thisYear, thisYear + 1].every(
    (y) => monthInYear(y).slice(0, 4) === String(y)
  )
);
check(
  "وبصيغةٍ من شهرين",
  /^\d{4}-(0[1-9]|1[0-2])$/.test(monthInYear(thisYear)) &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(monthInYear(2025)),
  monthInYear(2025)
);

console.log("\nوالشاشتان تستعملانها:\n");
const page = fs.readFileSync("app/page.tsx", "utf8");
const inits = (page.match(/useState\(\(\) => monthInYear\(year\)\)/g) ?? []).length;
check("شاشتان تُفتحان بها", inits === 2, `${inits}`);
check(
  "ولم تبقَ شاشةٌ على يناير",
  !/useState\(`\$\{year\}-01`\)/.test(page)
);
const follows = (page.match(/useEffect\(\(\) => setMonth\(monthInYear\(year\)\), \[year\]\)/g) ?? []).length;
check(
  "والشهرُ يتبع السنةَ إن بُدّلت",
  follows === 2,
  `${follows} — وإلا بقي في سنةٍ غادرها صاحبُه`
);
check(
  "وخياراتُ القائمة اثنا عشر شهراً من السنة — فشهرُ اليوم بينها",
  /\{ length: 12 \},\s+\(_, i\) => `\$\{year\}-\$\{String\(i \+ 1\)\.padStart\(2, "0"\)\}`/.test(
    page
  )
);

console.log(
  bad === 0
    ? "\n✓ تُفتح على شهرك، ولا تخرج عن سنتك، وتتبعها إن بدّلتها"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
