/**
 * يفحص فاحصَ النسخة.
 *
 *   npm run check:verify [نسخة.json]
 *
 * وشرطٌ لا يُخفق على المعيب لا يحرس شيئاً. فتُجرَّب نسختُك سليمةً —
 * فيجب أن تُجتاز — ثم تُفسَد على أربعةِ أوجهٍ معروفةٍ وقع كلُّ واحدٍ
 * منها أو كاد:
 *
 *   • نسخةُ متصفّحٍ بلا تجزئات — وهي التي كانت تُؤخذ شهراً كاملاً:
 *     تَردّ الدفاتر ولا تَردّ بابَ الدخول.
 *   • نسخةٌ مقطوعة — حركاتٌ نصفُ ما في القاعدة.
 *   • نسخةٌ بلا سجلّ تدقيق — وبه استُرِدّت تسعةَ عشرَ إقراراً.
 *   • ملفٌّ لا يُقرأ أصلاً.
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
const { verifyBackup } = await jiti.import("../lib/server/backup-verify.ts");
const { parseBackup, exportBackup } = await jiti.import("../lib/storage.ts");

const scheduled = fs.readFileSync(
  path.join(ROOT, "app/api/backup/scheduled/route.ts"),
  "utf8"
);
const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");

/* ------------------------------------------------------------------ */
console.log("\nالنسخة تُسحب من المخزن ثم تُفحص:\n");

check(
  "تُسحب بعد كتابتها لا من الذاكرة",
  /readStored\(saved\.pathname\)/.test(scheduled),
  "وفحصُ الذاكرةِ يفحص الذاكرةَ لا ما حُفظ"
);
check(
  "وتُفكّ ثم تُقرأ",
  /gunzipSync\(back\)\.toString\("utf8"\)/.test(scheduled)
);
check(
  "والحالةُ تُقرأ مرّةً واحدةً للنسخة وللقياس",
  /const live = await inTransaction\(backupState\);/.test(scheduled),
  "ولو قُرئت ثانيةً ظهر فرقٌ ليس خللاً"
);
check(
  "ويُسجَّل الحكمُ في المخزن",
  /await writeVerdict\(verdict\);/.test(scheduled),
  "فالمجدولُ يعمل ليلاً، وحكمٌ لا يُكتب لا يُقرأ"
);
check(
  "وكُتبت ولم تُقرأ = إخفاق",
  /كُتبت ولم تُقرأ/.test(scheduled)
);
check(
  "وإخفاقُ الفحص لا يُفشل النسخةَ نفسها",
  /console\.error\("تعذّر فحص النسخة:", error\);/.test(scheduled),
  "فنسخةٌ غيرُ مفحوصةٍ خيرٌ من لا نسخة"
);

console.log("\nويراه صاحبُه في الشاشة:\n");

check("لوحُ الحكم", /فُحصت فعادت الدفاتر منها/.test(page));
check(
  "والشروطُ تُسمّى عند الإخفاق",
  /\.filter\(\(c\) => !c\.ok\)/.test(page),
  "و«أخفق» بلا بيانٍ لا يُعمل به"
);
check("ويُقال مع بشرى «جرّب الآن»", /وفُحصت فعادت/.test(page));

/* ------------------------------------------------------------------ */
const BACKUP = process.argv[2];
if (!BACKUP || !fs.existsSync(BACKUP)) {
  console.log("\n(بلا ملفّ نسخةٍ لا يُجرَّب الفاحص — مرِّر نسخةً)");
  console.log(bad === 0 ? "\n✓ الشِّفْر سليم" : `\n✗ ${bad} فحصاً أخفق`);
  process.exit(bad === 0 ? 0 : 1);
}

const text = fs.readFileSync(BACKUP, "utf8");
const live = parseBackup(text);

/* نسختُك لا تحمل تجزئاتٍ — فتُزرع، فالمفحوصُ الفاحصُ لا النسخة */
const PLANTED = "$2b$10$K7kqV5fahsZmuraaqibatinfaqadwaqaAbcdefghijklmnopqrstu";
const sound = {
  ...live,
  users: (live.users ?? []).map((u) => ({ ...u, pinHash: PLANTED })),
};
const soundText = exportBackup(sound);
const liveState = { ...sound };

console.log("\nوالنسخةُ السليمةُ تُجتاز:\n");

const good = verifyBackup(soundText, "backups/سليمة.json.gz", liveState);
check(
  "تُجتاز كلَّ الشروط",
  good.ok,
  good.ok
    ? `${good.checks.length} شرطاً`
    : good.checks.filter((c) => !c.ok).map((c) => c.name).join(" | ")
);
for (const c of good.checks) console.log(`       · ${c.name}${c.detail ? " — " + c.detail : ""}`);

console.log("\nوالمعيبةُ تُردّ — وكلُّ عيبٍ منها وقع أو كاد:\n");

const broken = [
  [
    "نسخةُ متصفّحٍ بلا تجزئات",
    exportBackup({ ...sound, users: (sound.users ?? []).map((u) => ({ ...u, pinHash: "" })) }),
    "وفيه كلماتُ المرور",
  ],
  [
    "نسخةٌ مقطوعةٌ نصفَ حركاتها",
    exportBackup({ ...sound, movements: (sound.movements ?? []).slice(0, Math.floor((sound.movements ?? []).length / 2)) }),
    "وما فيه يقارب ما في القاعدة",
  ],
  [
    "نسخةٌ بلا سجلّ تدقيق",
    exportBackup({ ...sound, audit: [] }),
    "وفيه الحركاتُ وسجلُّ التدقيق",
  ],
  [
    "ملفٌّ لا يُقرأ",
    "{ هذا ليس جسوناً",
    "الملفّ يُقرأ بالدالّة التي يقرأ بها الاسترجاع",
  ],
];

for (const [label, content, expected] of broken) {
  let verdict;
  try {
    verdict = verifyBackup(content, "backups/معيبة.json.gz", liveState);
  } catch (error) {
    check(label, false, "رمى استثناءً بدل أن يحكم: " + String(error?.message ?? error));
    continue;
  }
  const failed = verdict.checks.filter((c) => !c.ok).map((c) => c.name);
  check(
    label,
    !verdict.ok && failed.includes(expected),
    verdict.ok ? "اجتازت وهي معيبة!" : `أخفق: ${failed.join("، ")}`
  );
}

/* ---- وأرقامُ القيود المكرّرة ---- */
const first = (sound.movements ?? [])[0];
if (first) {
  const twinned = exportBackup({
    ...sound,
    movements: [...(sound.movements ?? []), { ...first, id: "توأم" }],
  });
  const verdict = verifyBackup(twinned, "backups/توأم.json.gz", liveState);
  check(
    "ورقمُ قيدٍ مكرَّرٍ يُكشف",
    !verdict.ok &&
      verdict.checks.some(
        (c) => !c.ok && c.name === "وأرقامُ القيود لا تتكرّر في السنة"
      ),
    `${first.fiscalYear}/${first.entryNo}`
  );
}

console.log(
  bad === 0
    ? "\n✓ الفاحصُ يُجيز السليمةَ ويردّ المعيبة، ويُسمّي العيب"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
