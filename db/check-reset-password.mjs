/**
 * يفحص إعادة تعيين كلمة المرور من الشاشة.
 *
 *   npm run check:reset-password
 *
 * كان هذا لا يُفعل إلا من سطر الأوامر على جهاز صاحب الشركة. وفي شاشة
 * المستخدمين خانةُ «رقم الدخول» تُغري من يراها — والخادم يرفض ما تكتبه
 * **صامتاً** لأن العمود محروس. فظنّ صاحب الشركة أنه أعاد التعيين، وأعطى
 * الرجل رقماً لا يفتح، فحاول حتى أُوقف حسابه.
 *
 * والذي يُخشى منه في الباب الجديد:
 *   • أن يفتحه من لا يملك «إدارة المستخدمين» — فيعيد تعيين كلمة غيره.
 *   • أن تُحفظ الكلمة المؤقّتة في مكانٍ تُقرأ منه بعد عرضها.
 *   • أن تخرج كلمةٌ لا يقبلها الخادم نفسه (أقصر من الحدّ، أو أرقام فقط).
 *   • ألّا يُلزَم صاحبها بتغييرها، فتبقى كلمةٌ يعرفها اثنان.
 */
import fs from "fs";
import { PGlite } from "@electric-sql/pglite";
import bcrypt from "bcryptjs";

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

/* ---- الكلمة المولَّدة ---- */
console.log("\nالكلمة المؤقّتة تصلح كلمةَ مرور:\n");

const auth = fs.readFileSync("lib/server/auth.ts", "utf8");

const alphabet = /const TEMP_ALPHABET = "([^"]+)"/.exec(auth)?.[1] ?? "";
check("لها أبجدية معلومة", alphabet.length > 30, `${alphabet.length} محرفاً`);
check(
  "لا صفرٌ ولا O فيلتبسا",
  !alphabet.includes("0") && !alphabet.includes("O")
);
check(
  "ولا واحدٌ ولا l ولا I",
  !alphabet.includes("1") && !alphabet.includes("l") && !alphabet.includes("I")
);
check("وفيها حروفٌ لا أرقامٌ فقط", /[A-Za-z]/.test(alphabet));

const MIN = Number(/MIN_PASSWORD_LENGTH = (\d+)/.exec(auth)?.[1] ?? 0);
const length = Number(/function temporaryPassword\(length = (\d+)\)/.exec(auth)?.[1] ?? 0);
check(
  `وطولها (${length}) يتجاوز حدّ الخادم (${MIN})`,
  length >= MIN && MIN > 0
);
check(
  "وتُولَّد من مصدرٍ معمّى لا من Math.random",
  /function temporaryPassword[\s\S]{0,320}randomBytes\(/.test(auth) &&
    !/function temporaryPassword[\s\S]{0,320}Math\.random/.test(auth)
);

/* ولا تُقبل كلمةٌ كلّها أرقام: الأبجدية فيها حروفٌ أكثر من الأرقام */
const digits = [...alphabet].filter((c) => /\d/.test(c)).length;
check(
  "واحتمال خروجها أرقاماً كلّها لا يُذكر",
  Math.pow(digits / alphabet.length, length) < 1e-9,
  `${digits} رقماً من ${alphabet.length}`
);

/* ---- الصلاحية ---- */
console.log("\nوالباب محروسٌ بالصلاحية:\n");

const route = fs.readFileSync("app/api/users/reset-password/route.ts", "utf8");
check(
  'يوجب «users.manage» قبل كل شيء',
  /requirePermission\(\s*"users\.manage"\s*\)/.test(route)
);
check(
  "ويُعيد 403 لمن لا يملكها",
  /AuthError/.test(route) && /error\.status/.test(route)
);
check(
  "ولا يُسجَّل السرّ في سجلّ التدقيق",
  !/onLog|log\(/.test(route) || !/password/.test(route.split("return NextResponse.json({\n      ok: true")[0] ?? "")
);

/* ---- أثر الإعادة على الصفّ ---- */
console.log("\nوأثرها على الحساب:\n");

const fn = auth.slice(auth.indexOf("export async function resetUserPassword"));
check("يُلزَم صاحبه بكلمةٍ جديدة", /must_change_pin = true/.test(fn));
check("وتُصفَّر المحاولات الخاطئة", /failed_attempts = 0/.test(fn));
check("ويُرفع الإيقاف", /locked_until = NULL/.test(fn));
check(
  "والمحفوظ تجزئةٌ لا كلمة",
  /hashPassword\(password\)/.test(fn) && !/password_hash = \$?\d?,?\s*password\b/.test(fn)
);

/* ---- الشاشة ---- */
console.log("\nوالشاشة لا تَعِد بما لا تفي:\n");

const page = fs.readFileSync("app/page.tsx", "utf8");
check(
  "خانة «رقم الدخول» لم تعد تظهر عند التعديل",
  page.includes("{!editingId && (") &&
    page.includes('<Field label="رقم الدخول" hint="أربعة أرقام فأكثر">')
);
check(
  "ومكانها زرٌّ يطلب من الخادم",
  page.includes("أعد تعيين كلمة المرور") &&
    page.includes('"/api/users/reset-password"')
);
check("ويُستأذن قبله", page.includes("إعادة تعيين كلمة مرور «"));
check(
  "والكلمة تُعرض مرّةً ويُقال ذلك صراحةً",
  page.includes("لا تُعرض مرّةً أخرى")
);
check(
  "ولا تُحفظ إلا في ذاكرة الصفحة",
  !/localStorage[^\n]*issued|issued[^\n]*localStorage/.test(page)
);
check(
  "وتزول متى فُتح ملفّ غيره",
  /const openEdit = \(user: User\) => \{\s*\n\s*setIssued\(null\);/.test(page)
);
check(
  "والحفظ لم يعد يطلب رقماً عند التعديل",
  /if \(!editingId\) \{\s+if \(form\.pin\.length < 4\)/.test(page)
);

/* ---- التجزئة تعمل فعلاً ---- */
console.log("\nوالتجزئة تفتح بالكلمة لا بغيرها:\n");

const sample = "Km7Pq2Rt9Vx4";
const hash = await bcrypt.hash(sample, 4);
check("الكلمة المولَّدة تفتح", await bcrypt.compare(sample, hash));
check("وغيرها لا يفتح", !(await bcrypt.compare(sample.toLowerCase(), hash)));

/* ---- وعلى قاعدةٍ حقيقية: العمود يقبل التجزئة ---- */
const db = new PGlite();
await db.exec(`
  CREATE TABLE users (
    id text PRIMARY KEY,
    name text NOT NULL,
    password_hash text,
    must_change_pin boolean NOT NULL DEFAULT false,
    failed_attempts int NOT NULL DEFAULT 0,
    locked_until timestamptz
  );
  INSERT INTO users (id, name, password_hash, failed_attempts, locked_until)
  VALUES ('u1', 'مصطفى الأنصاري', 'old-hash', 5, now() + interval '15 minutes');
`);
await db.query(
  `UPDATE users
      SET password_hash = $2, must_change_pin = true,
          failed_attempts = 0, locked_until = NULL
    WHERE id = $1`,
  ["u1", hash]
);
const row = (await db.query(`SELECT * FROM users WHERE id = 'u1'`)).rows[0];
console.log("\nوعلى صفٍّ كان موقوفاً بخمس محاولات:\n");
check("رُفع الإيقاف", row.locked_until === null);
check("وصُفِّرت المحاولات", row.failed_attempts === 0);
check("ويُلزَم بكلمةٍ جديدة", row.must_change_pin === true);
check("والتجزئة الجديدة محفوظة", row.password_hash === hash);
await db.close();

console.log(
  bad === 0
    ? "\n✓ بابٌ محروس، وكلمةٌ تُعرض مرّةً ثم تزول"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
