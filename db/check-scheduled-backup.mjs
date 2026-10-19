/**
 * يفحص النسخةَ الليليّة: حرزَها، وسياسةَ الإبقاء، وبابَ الاستعراض.
 *
 *   npm run check:nightly
 *
 * وسياسةُ الإبقاء أخطرُ ما في الباب: الخطأُ فيها لا يمنع نسخةً، بل
 * **يَطرح** نسخاً موجودة. فتُفحص على تواريخَ مصنوعةٍ لسنتين، ويُحسب ما
 * يبقى وما يُطرح، ويُتحقّق أن الأحدثَ لا يُطرح أبداً، وأن ما لا يُقرأ
 * تاريخُه لا يُمَسّ.
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
const store = await jiti.import("../lib/server/backup-store.ts");
const { backupPath, dateOf, toPurge } = store;

const scheduled = fs.readFileSync(
  path.join(ROOT, "app/api/backup/scheduled/route.ts"),
  "utf8"
);
const stored = fs.readFileSync(
  path.join(ROOT, "app/api/backup/stored/route.ts"),
  "utf8"
);
const storeSrc = fs.readFileSync(path.join(ROOT, "lib/server/backup-store.ts"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");

/* ------------------------------------------------------------------ */
console.log("\nالنسخة تُحفظ خارج القاعدة، وخاصّةً لا عامّة:\n");

check(
  "المخزن خاصّ",
  /access: "private"/.test(storeSrc),
  "والعامُّ يُقرأ من رابطه بلا كلمة مرور — ودفاترُ شركةٍ كاملة"
);
check(
  "ولا تُقرأ النسخةُ إلا بجلسةٍ وصلاحية",
  /access: "private"/.test(stored) && /requirePermission\("backup\.run"\)/.test(stored)
);
check("وتُحفظ مضغوطةً", /gzipSync/.test(scheduled) && /\.json\.gz/.test(storeSrc));
check(
  "وباسمٍ ثابتٍ لا عشوائيّ",
  /addRandomSuffix: false/.test(storeSrc),
  "وإلا تكرّرت نسخةُ الدقيقة نفسها عند إعادة التشغيل"
);

console.log("\nوالمسار محروز — فلا يُشغّله من شاء:\n");

check("بترويسة المجدول", /x-vercel-cron/.test(scheduled));
check("أو بسرٍّ إن وُضع", /CRON_SECRET/.test(scheduled));
check(
  "أو بصاحب جلسةٍ له النسخُ ويقرأ الدفاتر كلّها",
  /permissions\.includes\("backup\.run"\)/.test(scheduled) &&
    /hiddenFields\(user\.permissions\)\.length === 0/.test(scheduled)
);
check(
  "ومن سواهم يُردّ",
  /status: 403/.test(scheduled)
);
check(
  "ولا يُقرأ من المخزن إلا ما كان نسخةً",
  /wanted\.startsWith\("backups\/"\) \|\| !dateOf\(wanted\)/.test(stored),
  "والمسارُ يأتي من الطلب، فلو مُرّر كما جاء صار بابَ قراءةٍ لكلّ شيء"
);

console.log("\nوالوصلُ يُعرف بأيِّ دليلٍ لا بالمفتاح وحده:\n");

/*
  المكتبةُ تستأذن بـOIDC مع BLOB_STORE_ID قبل أن تطلب المفتاح الثابت،
  والوصلُ الحديثُ للمخزن الخاصّ لا يضع مفتاحاً قطّ. فكان الحرزُ يسأل عن
  المفتاح وحده فيقول «لا مخزنَ موصولاً» والمخزنُ موصولٌ عامل — ووقع في
  دفاتر الشركة: رأى الخادمُ BLOB_STORE_ID ولم يرَ مفتاحاً، فامتنع.
*/
check(
  "يُقبل معرّفُ المخزن كما يُقبل المفتاح",
  /Boolean\(blobToken\(\) \|\| process\.env\.BLOB_STORE_ID\)/.test(storeSrc)
);
check(
  "والحرزُ يسأل عن الوصل لا عن المفتاح",
  /if \(!blobConfigured\(\)\) \{/.test(scheduled) &&
    /if \(!blobConfigured\(\)\) \{/.test(stored),
  "وإلا مُنع الطريقُ قبل أن تسلكه المكتبة"
);
check(
  "ومفتاحٌ غائبٌ يُمرَّر فلا يُعطّل OIDC",
  /token: blobToken\(\)/.test(storeSrc),
  "فالمكتبةُ تتخطّى المفتاحَ الغائبَ إلى OIDC"
);

console.log("\nوالطرحُ بعد الكتابة لا قبلها:\n");

check(
  "تُكتب أوّلاً",
  scheduled.indexOf("storeBackup(") < scheduled.indexOf("purge(toPurge("),
  "ولو طُرح القديمُ ثم أخفقت الكتابةُ نقصت النسخُ بلا بديل"
);
check(
  "وإخفاقُ الطرح لا يُفشل النسخة",
  /purgeError = String/.test(scheduled),
  "فمخزنٌ يكبر أهونُ من ليلةٍ بلا نسخة"
);

console.log("\nوالمجدول موقوت:\n");

const cron = (vercel.crons ?? [])[0];
check("مسجّلٌ في vercel.json", !!cron && cron.path === "/api/backup/scheduled");
check(
  "مرّةً كلَّ ليلة",
  cron?.schedule === "0 2 * * *",
  cron ? `${cron.schedule} — أي الخامسةَ فجراً بتوقيت الكويت` : "لا جدول"
);

console.log("\nوفي الشاشة بابٌ يراها منه:\n");

check("لوحةُ النسخ التلقائية", /النسخ التلقائية \(كل ليلة\)/.test(page));
check("تُقرأ من المخزن", /fetch\("\/api\/backup\/stored"\)/.test(page));
check("وتُنزَّل منها واحدة", /\/api\/backup\/stored\?path=/.test(page));
check("وتُجرَّب بيده", /fetch\("\/api\/backup\/scheduled"\)/.test(page));
check(
  "ويُقال له إن انقطعت",
  /مضى عليها أكثرُ من يومين/.test(page),
  "فلا يطمئنّ إلى نسخةٍ لم تُؤخذ"
);

/* ------------------------------------------------------------------ */
/* سياسةُ الإبقاء على تواريخَ مصنوعةٍ لسنتين                            */
/* ------------------------------------------------------------------ */
console.log("\nوسياسةُ الإبقاء — وهي التي تَطرح، فتُحسب لا تُظنّ:\n");

const DAY = 86400000;
const now = Date.UTC(2026, 9, 19, 2, 0);

/* نسخةٌ كلَّ ليلةٍ لسبع مئة ليلة */
const nightly = [];
for (let i = 0; i < 700; i++) {
  const at = new Date(now - i * DAY);
  nightly.push({ pathname: backupPath(at), at, size: 350000 });
}

const purged = toPurge(nightly);
const kept = nightly.filter((b) => !purged.some((p) => p.pathname === b.pathname));

const age = (b) => (now - b.at.getTime()) / DAY;
const inFortnight = kept.filter((b) => age(b) <= 14);
const inYear = kept.filter((b) => age(b) > 14 && age(b) <= 365);
const older = kept.filter((b) => age(b) > 365);

check(
  "كلُّ نسخةٍ في آخر أسبوعين تبقى",
  inFortnight.length === 15,
  `${inFortnight.length} من ١٥ ليلة`
);
check(
  "ثم واحدةٌ من كلِّ أسبوعٍ إلى سنة",
  inYear.length >= 48 && inYear.length <= 52,
  `${inYear.length} أسبوعاً`
);
check(
  "ثم واحدةٌ من كلِّ شهرٍ تبقى أبداً",
  older.length >= 10 && older.length <= 12,
  `${older.length} شهراً`
);
check(
  "والأحدثُ لا يُطرح أبداً",
  !purged.some((b) => b.pathname === nightly[0].pathname)
);
check(
  "ويبقى من سبع مئة نسخةٍ عددٌ معقول",
  kept.length > 60 && kept.length < 90,
  `${kept.length} نسخةً · ${Math.round((kept.length * 350) / 1024)} ميغا`
);

/* ---- ولا يُطرح ما انقطع المجدولُ عنه ---- */
/*
  ولو حُسب الأجلُ من «الآن» لا من أحدثِ نسخة: مجدولٌ انقطع شهراً ثم
  عاد، فأوّلُ تشغيلةٍ تجد نسخَها كلَّها «أقدمَ من أسبوعين» فتطرح
  أكثرَها في لحظة.
*/
const paused = [];
for (let i = 0; i < 20; i++) {
  const at = new Date(now - 40 * DAY - i * DAY);
  paused.push({ pathname: backupPath(at), at, size: 350000 });
}
const pausedPurge = toPurge(paused);
check(
  "والمقياسُ أحدثُ نسخةٍ لا وقتُ الآن",
  paused.length - pausedPurge.length >= 15,
  `${paused.length - pausedPurge.length} من ${paused.length} بقيت بعد انقطاعٍ شهراً`
);

/* ---- وما لا يُقرأ تاريخُه لا يُمَسّ ---- */
check(
  "واسمٌ لا يُقرأ تاريخُه ليس نسخةً",
  dateOf("backups/ملفٌّ-غريب.json.gz") === null &&
    dateOf("other/2026-10-19-0200.json.gz") !== null,
  "فلا يُحسب في الإبقاء ولا يُطرح — والقائمةُ تُسقطه"
);
check(
  "والقائمةُ لا تُدخل إلا ما قُرئ تاريخُه",
  /if \(at\) found\.push/.test(storeSrc),
  "فغيرُ النسخ في المخزن لا يُطرح بسياسة النسخ"
);
check(
  "ومن مخزنٍ فارغٍ لا يُطرح شيء",
  toPurge([]).length === 0
);

console.log(
  bad === 0
    ? "\n✓ النسخة الليليّة: محروزةٌ، خاصّةٌ، مضغوطةٌ، ويُبقى منها ما يكفي ويُطرح ما يزيد"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
