/**
 * يعيد تعيين كلمة مرور مستخدمٍ على الخادم — مفتاحٌ احتياطي.
 *
 *   node db/reset-password.mjs "ذياب الخميس" "كلمة-مؤقتة-طويلة"
 *
 * صار الدخول كلّه على الخادم: من نسي كلمته لا يدخل، ومن لا يدخل لا
 * يُصلح شيئاً. وذلك مقبولٌ في موظف — يعيد المدير تعيين كلمته من شاشة
 * المستخدمين — وغيرُ مقبولٍ في المدير نفسه: لو نسي كلمته أُغلق النظام
 * على صاحبه، ولا أحد فوقه يفتحه له.
 *
 * فهذا الباب الخلفي، ولا يُفتح إلا من كان عنده عنوان القاعدة في
 * .env.local — أي صاحب الشركة وحده.
 *
 * والكلمة الموضوعة هنا مؤقّتة: يُعلَّم الحساب بأن يُلزَم صاحبه بتغييرها
 * عند أول دخول، فلا تبقى كلمةٌ يعرفها اثنان.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

const [name, password] = process.argv.slice(2);
if (!name || !password) {
  console.error('الاستعمال: node db/reset-password.mjs "اسم المستخدم" "الكلمة المؤقتة"');
  process.exit(1);
}

if (password.length < 8 || /^\d+$/.test(password)) {
  console.error("الكلمة المؤقتة ثمانية محارف فأكثر، ولا تكون أرقاماً فقط");
  process.exit(1);
}

/* عنوان القاعدة من .env.local — لا يُكتب في سطر الأوامر فيبقى في سجلّه */
const envFile = path.join(ROOT, ".env.local");
let url = process.env.DATABASE_URL ?? "";
if (!url && fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const match = /^\s*DATABASE_URL\s*=\s*(.*)$/.exec(line);
    if (match) url = match[1].trim().replace(/^["']|["']$/g, "");
  }
}
if (!url) {
  console.error("لا عنوان لقاعدة البيانات: ضع DATABASE_URL في .env.local");
  process.exit(1);
}

const { neon } = await import("@neondatabase/serverless");
const sql = neon(url);

const found = await sql`
  SELECT id, name, active
  FROM users
  WHERE regexp_replace(btrim(name), '[[:space:]]+', ' ', 'g')
      = regexp_replace(btrim(${name}), '[[:space:]]+', ' ', 'g')
`;

if (found.length === 0) {
  console.error(`لا مستخدم بهذا الاسم: ${name}`);
  const all = await sql`SELECT name, active FROM users ORDER BY name`;
  console.error("الموجودون: " + all.map((u) => u.name).join("، "));
  process.exit(1);
}

const user = found[0];
const hash = await bcrypt.hash(password, 12);

await sql`
  UPDATE users
  SET password_hash = ${hash},
      must_change_pin = true,
      failed_attempts = 0,
      locked_until = NULL,
      active = true
  WHERE id = ${user.id}
`;

console.log(`✓ ${user.name}: كلمةٌ مؤقتة، ويُلزَم بتغييرها عند أول دخول`);
