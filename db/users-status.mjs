/**
 * يُظهر حال حسابات الدخول على الخادم — قراءةٌ لا تكتب شيئاً.
 *
 *   node db/users-status.mjs
 *
 * يوم فُتح النظام للعاملين وقع ما كان متوقّعاً: رجلٌ يقول «كلمتي ترفض»
 * ولا أحد يعرف أين الخلل. والرسالة واحدةٌ عمداً — «اسم المستخدم أو كلمة
 * المرور غير صحيحة» — فلا يُعرف منها أيُّ الحسابات موجود، وهذا حسنٌ
 * في وجه الغريب وعائقٌ في وجه المدير.
 *
 * فهذه الأداة تقرأ ما لا تقوله الرسالة:
 *
 *   • **الاسم كما هو مسجَّل** — وأكثر ما يقع أن يكتب صاحبه اسمه الرباعي
 *     وحسابُه مسجَّلٌ بثلاثة، فلا يُوجد الصفّ أصلاً.
 *   • **محاولاتٌ خاطئة = صفر مع أنه حاول** — دليلٌ قاطع على أن الاسم لم
 *     يُطابق، لأن الخادم لا يَعدّ المحاولة إلا بعد أن يجد الحساب.
 *   • **موقوف حتى** — خمسُ محاولاتٍ تُوقف ربع ساعة.
 *   • **نوع التجزئة** — قديمةٌ يعني أن صاحبه لم يضع كلمته بعد ورقمُه
 *     القديم يفتح مرّة؛ و bcrypt يعني أنه وضعها، فالرقم القديم ميت.
 *
 * ولا تُطبع تجزئةٌ ولا جزءٌ منها يصلح لتخمين كلمة.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(HERE, "..", ".env.local");

let url = process.env.DATABASE_URL ?? "";
if (!url && fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*DATABASE_URL\s*=\s*(.*)$/.exec(line);
    if (m) url = m[1].trim().replace(/^["']|["']$/g, "");
  }
}
if (!url) {
  console.error("لا عنوان لقاعدة البيانات: ضع DATABASE_URL في .env.local");
  process.exit(1);
}

/*
  السائق هو `pg` — وهو المثبّت في المشروع. وكانت هنا
  `@neondatabase/serverless` وليست في الاعتماديات، فكان السكربت يموت عند
  سطر الاستيراد قبل أن يبلغ القاعدة: خطأٌ أحمر يظنّه قارئه عطلاً عابراً.
*/
const pg = (await import("pg")).default;
const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const sql = (text, params = []) => client.query(text, params).then((r) => r.rows);

const rows = await sql(`
  SELECT name, role, active, must_change_pin, failed_attempts, locked_until,
         password_hash IS NULL                AS no_password,
         left(password_hash, 2) = '$2'        AS is_bcrypt,
         last_seen_at
    FROM users
   ORDER BY name`);

const now = Date.now();
const when = (v) => (v ? new Date(v).toISOString().slice(0, 16).replace("T", " ") : null);

console.log(`\nحسابات الدخول على الخادم — ${rows.length}\n`);

for (const u of rows) {
  const locked = u.locked_until && new Date(u.locked_until).getTime() > now;
  const state = u.no_password
    ? "✗ بلا كلمة"
    : u.is_bcrypt
      ? "كلمتُه الخاصة"
      : "رقمٌ قديم — يفتح مرّة";

  const flags = [];
  if (!u.active) flags.push("موقوف نهائياً");
  if (locked) flags.push(`موقوف حتى ${when(u.locked_until)}`);
  if (u.must_change_pin) flags.push("يُلزَم بكلمةٍ جديدة");
  if (u.failed_attempts > 0) flags.push(`${u.failed_attempts} محاولة خاطئة`);

  console.log(`  ${JSON.stringify(u.name)}`);
  console.log(
    `     ${u.role} · ${state} · ` +
      (u.last_seen_at ? `آخر دخول ${when(u.last_seen_at)}` : "لم يدخل قطّ")
  );
  if (flags.length) console.log(`     ${flags.join(" · ")}`);

  /*
    المحاولةُ لا تُعدّ إلا بعد العثور على الحساب. فمن شكا الردَّ وعدّادُه
    صفرٌ ولم يدخل قطّ، فالاسم هو العلّة لا الكلمة — ويُقرأ له الاسم
    المسجَّل أعلاه حرفاً بحرف.
  */
  if (!u.last_seen_at && u.failed_attempts === 0 && !locked) {
    console.log(
      `     ← إن شكا الردَّ فالعلّة في الاسم: لم تصل محاولاته إلى حسابه`
    );
  }
  console.log("");
}

console.log("لإعادة تعيين كلمةٍ: node db/reset-password.mjs \"الاسم\" \"كلمة-مؤقتة\"\n");
await client.end();
