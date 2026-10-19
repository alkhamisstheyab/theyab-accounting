/**
 * يفحص النسخة الاحتياطية من الخادم.
 *
 *   npm run check:backup [نسخة.json]
 *
 * والمفحوصُ ليس أنها تُكتب — بل أنها **تُسترجَع**. فملفٌّ لا يعود منه
 * النظامُ كما كان ليس نسخةً، وإنما ورقةُ طمأنينةٍ كاذبة.
 *
 * وأخصُّ ما يُفحص: تجزئةُ كلمة المرور. فالمتصفّح لا يراها قطّ — تُنزع
 * من كل صفٍّ يخرج من القاعدة — ونسخةُ الجهاز `pinHash` فيها فراغٌ
 * لكلِّ مستخدم. والاسترجاع يقرأ كلمات المرور من هذا الحقل بعينه،
 * والدخولُ يشترط `Boolean(hash)`. فمن استرجع نسخةَ متصفّحٍ أخرج
 * نظاماً لا يدخله أحدٌ ولا صاحبُه.
 *
 * فالدورة هنا كاملةٌ على قاعدتين: تُبنى الأولى من نسختك، وتُزرع فيها
 * تجزئاتٌ كما في الدفاتر الحقيقيّة، ثم تُؤخذ منها نسخةُ الخادم،
 * فتُنقل إلى قاعدةٍ ثانيةٍ فارغة، وتُقارن الحالتان صفّاً صفّاً
 * بـ`compareStates` — وتُقرأ التجزئات من عمودها في الثانية.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { createJiti } from "jiti";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const backup = fs.readFileSync(path.join(ROOT, "lib/server/backup.ts"), "utf8");
const route = fs.readFileSync(path.join(ROOT, "app/api/backup/route.ts"), "utf8");
const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");

/* ------------------------------------------------------------------ */
console.log("\nالنسخة تُقرأ من الدفاتر لا من الجهاز:\n");

check(
  "تجزئاتُ كلمات المرور من عمودها",
  /SELECT data, password_hash FROM users/.test(backup),
  "و`data` فيه فراغٌ دائماً"
);
check(
  "والتجزئةُ والصفُّ من استعلامٍ واحد",
  /\.\.\.user, pinHash: String\(row\.password_hash/.test(backup),
  "فلا تُطابَق بمعرّفٍ قد يختلف"
);
/*
  والنداءُ لا الاسم: أوّلُ ما كُتب هذا الشرطُ أخفق على تعليقٍ في
  `backup.ts` يقول «ولا تمرّ على readableState» — فالشرطُ يقرأ النصّ
  ولا يُفرّق بين ذِكرٍ ونداء. والقوسُ يُفرّق.
*/
check(
  "ولا تمرّ على مرشّح الصلاحيات",
  !/readableState\(/.test(backup) && !/readableState\(/.test(route),
  "نسخةٌ مرشَّحةٌ تمحو ما حُجب عن آخذها"
);
check(
  "وصورتُها صورةُ ملفّ النسخة نفسها",
  /exportBackup\(/.test(backup),
  "فيقبلها migrate والاستيراد"
);
check(
  "وتُقرأ في صورةِ لحظةٍ واحدة",
  /SET TRANSACTION ISOLATION LEVEL REPEATABLE READ/.test(backup) &&
    /inTransaction\(serverBackup\)/.test(route),
  "عشرون استعلاماً بلا عزلٍ تلتقط حركةً بلا عقدها"
);

console.log("\nولا تُعطى إلا لمن يقرأ الدفاتر كلها:\n");

check(
  "الصلاحيةُ مشترطةٌ على الخادم",
  /requirePermission\("backup\.run"\)/.test(route)
);
check(
  "ومن حُجب عنه شيءٌ يُمنع ويُقال له ما هو",
  /hiddenFields\(user\.permissions\)/.test(route) &&
    /hidden\.length > 0/.test(route) &&
    /hidden\.join/.test(route),
  "وإلا صارت النسخةُ باباً خلفيّاً لما أُخفي في الشاشة"
);
check("ولا تُخزَّن في طبقةٍ وسيطة", /no-store/.test(route));

console.log("\nوفي الشاشة بابٌ إليها:\n");

check("زرٌّ في الإعدادات", /نسخة من الخادم/.test(page));
check("يُنادي المسار", /fetch\("\/api\/backup"\)/.test(page));
check(
  "ويُحفظ في الملفّ المربوط كغيره",
  /const outcome = await saveToLinkedFile\(content\);/.test(page)
);
check(
  "ويُسكِت التنبيه بعد نجاحه",
  /setBackupMeta\(writeBackupMeta\(movements\.length\)\);\s+setBackupNotice\(`نسخة الخادم محفوظة/.test(
    page
  )
);
check(
  "ولا يُضغط مرّتين وهو يعمل",
  /disabled=\{serverBusy\}/.test(page) && /setServerBusy\(true\);/.test(page)
);

/* ------------------------------------------------------------------ */
/* الدورة الكاملة على قاعدتين                                          */
/* ------------------------------------------------------------------ */
const BACKUP = process.argv[2];
if (!BACKUP || !fs.existsSync(BACKUP)) {
  console.log(
    "\n(بلا ملفّ نسخةٍ لا تُفحص الدورة — مرِّر نسخةً: npm run check:backup <ملف>)"
  );
  console.log(bad === 0 ? "\n✓ الشِّفْر سليم" : `\n✗ ${bad} فحصاً أخفق`);
  process.exit(bad === 0 ? 0 : 1);
}

const dirA = path.join(ROOT, ".backup-check-a");
const dirB = path.join(ROOT, ".backup-check-b");
const outFile = path.join(ROOT, ".backup-check.json");
for (const d of [dirA, dirB]) fs.rmSync(d, { recursive: true, force: true });
fs.rmSync(outFile, { force: true });

const migrate = (file, dir) =>
  execFileSync(
    process.execPath,
    [path.join(HERE, "migrate.mjs"), file, "--local", "--keep", dir],
    { stdio: ["ignore", "ignore", "inherit"] }
  );

console.log("\nينقل نسختك إلى قاعدةٍ أولى…");
migrate(BACKUP, dirA);

const { PGlite } = await import("@electric-sql/pglite");
const jiti = createJiti(import.meta.url);
const { backupState } = await jiti.import("../lib/server/backup.ts");
const { compareStates } = await jiti.import("../lib/changes.ts");

const wrap = (db) => ({
  query: async (text, values = []) => db.query(text, values),
});

/*
  تُزرع تجزئاتٌ كما في الدفاتر الحقيقيّة: نسختُك لا تحملها — وتلك هي
  العلّة بعينها — فلو فُحصت كما هي لمرّ الفحصُ على فراغٍ ولم يُثبت شيئاً.
*/
const PLANTED = "$2b$10$K7kqV5fahsZmuraaqibatinfaqadwaqaAbcdefghijklmnopqrstu";

const a = new PGlite(dirA);
await a.query("UPDATE users SET password_hash = $1", [PLANTED]);
const { rows: names } = await a.query("SELECT name FROM users ORDER BY name");

/* داخل معاملةٍ كما في المسار — فمستوى العزل لا يُضبط خارجها */
await a.query("BEGIN");
const stateA = await backupState(wrap(a));
await a.query("COMMIT");
await a.close();

console.log("\nوالنسخةُ المأخوذةُ منها:\n");

check(
  "تحمل التجزئةَ لكلِّ مستخدم",
  stateA.users.length === names.length &&
    stateA.users.every((u) => u.pinHash === PLANTED),
  `${stateA.users.filter((u) => u.pinHash === PLANTED).length} من ${names.length}`
);
check(
  "وتحمل الدفاتر",
  stateA.movements.length > 0 && stateA.contractors.length > 0,
  `${stateA.movements.length} حركة · ${stateA.contractors.length} عقداً`
);
check(
  "وسجلَّ التدقيق",
  Array.isArray(stateA.audit) && stateA.audit.length > 0,
  `${(stateA.audit ?? []).length} صفّاً — وبه استُرِدّت تسعةَ عشرَ إقراراً`
);

/* ---- وتُسترجَع ---- */
const { exportBackup } = await jiti.import("../lib/storage.ts");
fs.writeFileSync(outFile, exportBackup(stateA), "utf8");

console.log("\nثم تُنقل إلى قاعدةٍ ثانيةٍ فارغة…");
migrate(outFile, dirB);

const b = new PGlite(dirB);
const { rows: back } = await b.query(
  "SELECT name, password_hash FROM users ORDER BY name"
);
await b.query("BEGIN");
const stateB = await backupState(wrap(b));
await b.query("COMMIT");
await b.close();

console.log("\nفيعود النظامُ كما كان:\n");

check(
  "كلماتُ المرور نجت الدورة",
  back.length === names.length && back.every((r) => r.password_hash === PLANTED),
  `${back.filter((r) => r.password_hash === PLANTED).length} من ${names.length} — وبغيرها لا يدخل أحد`
);

const report = compareStates(stateA, stateB);
const off = report.fields.filter((f) => !f.agree);
check(
  "والحالتان متطابقتان صفّاً صفّاً",
  report.agree,
  off.length === 0
    ? `${report.fields.length} مجموعةً بلا فرق`
    : off
        .map(
          (f) =>
            `${f.field}: ناقص ${f.missing.length} · زائد ${f.extra.length} · مختلف ${f.different.length}`
        )
        .join(" | ")
);

for (const f of off.slice(0, 3)) {
  for (const s of f.samples.slice(0, 2)) {
    console.log(`       ${f.field}/${s.key}: ${JSON.stringify(s.changes)}`);
  }
}

/* ---- ولا تُترك القواعدُ وراءك ---- */
for (const d of [dirA, dirB]) fs.rmSync(d, { recursive: true, force: true });
fs.rmSync(outFile, { force: true });

console.log(
  bad === 0
    ? "\n✓ النسخة تُؤخذ من الدفاتر، وتحمل كلمات المرور، ويعود منها النظام كما كان"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
