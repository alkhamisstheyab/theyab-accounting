/**
 * يُصلح صفوف المستخدمين التي اختلف فيها العمود عن الكائن.
 *
 *   node db/repair-user-flags.mjs          # يُظهر ما سيُصلح ولا يكتب
 *   node db/repair-user-flags.mjs --apply  # يُصلح
 *
 * الصفُّ له وجهان: أعمدةٌ يقرؤها الدخول، وكائنُ `data` يقرؤه المتصفّح.
 * وكان تغييرُ كلمة المرور يمسّ العمود وحده، فبقي `data.mustChangePin`
 * على `true` عند كل من وضع كلمته — فظلّوا في شاشة المستخدمين معلَّمين
 * بأنهم «لم يضعوا رقمهم بعد»، ولا يُعرف من أنجز ومن لم يُنجز.
 *
 * وأُصلح المنبع في `lib/server/auth.ts` فصار يكتب الوجهين معاً، وهذا
 * يُصلح ما مضى. ويُرفع معه رقمُ التغيير فتبلغ الأجهزةَ الحقيقةُ.
 *
 * ولا يمسّ كلمةَ مرورٍ ولا صلاحيةً ولا اسماً — ينسخ العمود إلى الكائن.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const APPLY = process.argv.includes("--apply");
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

const pg = (await import("pg")).default;
const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows: drift } = await client.query(`
  SELECT name,
         must_change_pin                              AS column_value,
         (data ->> 'mustChangePin') = 'true'          AS data_value,
         (data ->> 'pinHash') IS DISTINCT FROM password_hash AS hash_drift
    FROM users
   WHERE (data ->> 'mustChangePin') IS DISTINCT FROM must_change_pin::text
      OR (data ->> 'pinHash') IS DISTINCT FROM password_hash
   ORDER BY name
`);

if (drift.length === 0) {
  console.log("\n✓ لا فرق بين الأعمدة والكائنات — لا شيء يُصلح\n");
  await client.end();
  process.exit(0);
}

console.log(`\n${drift.length} صفّاً يختلف وجهاه:\n`);
for (const r of drift) {
  const bits = [];
  if (String(r.column_value) !== String(r.data_value)) {
    bits.push(
      `«يُلزَم بكلمةٍ جديدة»: العمود ${r.column_value} والمعروض ${r.data_value}`
    );
  }
  if (r.hash_drift) bits.push("وتجزئةُ الكائن قديمة");
  console.log(`  ${JSON.stringify(r.name)} — ${bits.join(" · ")}`);
}

if (!APPLY) {
  console.log("\nهذا عرضٌ فقط. للإصلاح:  node db/repair-user-flags.mjs --apply\n");
  await client.end();
  process.exit(0);
}

const { rowCount } = await client.query(`
  UPDATE users
     SET data = data || jsonb_build_object('pinHash', password_hash,
                                           'mustChangePin', must_change_pin),
         updated_at = now(),
         rev = nextval('change_seq')
   WHERE (data ->> 'mustChangePin') IS DISTINCT FROM must_change_pin::text
      OR (data ->> 'pinHash') IS DISTINCT FROM password_hash
`);

console.log(`\n✓ أُصلح ${rowCount} صفّاً — ويبلغ الأجهزةَ عند أول مزامنة\n`);
await client.end();
