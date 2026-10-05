/**
 * يمسح اسم المرحلة من دفعات عقدٍ بعينه.
 *
 *   node db/clear-installment-stage.mjs 7002          # يُظهر ولا يكتب
 *   node db/clear-installment-stage.mjs 7002 --apply  # يمسح
 *
 * حين يُحوَّل عرضُ سعرٍ إلى عقد تُنقل أسماءُ مراحله إلى دفعاته في الحقل
 * `stage`. ويُطبع ذلك الاسم في جدول دفعات العقد عموداً يجمع الدفعات تحت
 * مرحلتها، ويظهر في الشاشة في المربّع الذي يسبق كل دفعة.
 *
 * وهو **عرضٌ لا حقل** — لا سبيل إلى تعديله من النموذج. فإذا بُني العقد
 * على عرضٍ ثم غُيّرت دفعاتُه إلى غير مراحله، بقيت الأسماء القديمة تُطبع
 * على دفعاتٍ لا تخصّها: وقع ذلك في عقد بدر الأسد (7002)، إذ أُنشئ من
 * عرضٍ تجريبيٍّ بأربع مراحل ثم صار عقدَ إضافة دورٍ بخمسَ عشرةَ دفعةً
 * مرقَّمة — فكانت أربعٌ منها تُطبع تحت «تجهيز الموقع» و«الهيكل الأسود».
 *
 * ولا يمسّ هذا قيمةً ولا شرطَ استحقاقٍ ولا اعتماداً ولا دفعاً — يمسح
 * اسماً يُعرض، فتظهر الدفعات بأرقامها المتسلسلة.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const [number, ...rest] = process.argv.slice(2);
const APPLY = rest.includes("--apply");
if (!number) {
  console.error("الاستعمال: node db/clear-installment-stage.mjs <رقم العقد> [--apply]");
  process.exit(1);
}

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

const { rows } = await client.query(
  `SELECT id, contract_number, name, data FROM contracts WHERE contract_number = $1`,
  [number]
);
if (rows.length === 0) {
  console.error(`لا عقد برقم ${number}`);
  await client.end();
  process.exit(1);
}

const row = rows[0];
const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
const installments = Array.isArray(data.installments) ? data.installments : [];
const named = installments.filter((i) => String(i.stage ?? "").trim());

console.log(`\nعقد ${row.contract_number} — ${row.name}`);
console.log(`  دفعاته: ${installments.length} · منها باسم مرحلة: ${named.length}\n`);
for (const i of installments) {
  const label = String(i.stage ?? "").trim();
  console.log(
    `   الدفعة ${String(i.number).padStart(2)} · ${String(i.value).padStart(6)} · ` +
      (label ? `«${label}» ← ستصير «الدفعة ${i.number}»` : "بلا اسم — لا تتغيّر")
  );
}

if (named.length === 0) {
  console.log("\n✓ لا اسمَ مرحلةٍ في هذا العقد — لا شيء يُمسح\n");
  await client.end();
  process.exit(0);
}

if (!APPLY) {
  console.log(
    `\nهذا عرضٌ فقط. للمسح:  node db/clear-installment-stage.mjs ${number} --apply\n`
  );
  await client.end();
  process.exit(0);
}

/*
  يُمسح الاسم من الكائن ويُرفع رقم التغيير، فتبلغ الأجهزةَ المسحةُ عند
  أول مزامنة. ولا تُمسّ الأعمدة: اسم المرحلة لا عمود له — هو داخل
  كائن الدفعات وحده.
*/
const cleaned = {
  ...data,
  installments: installments.map((i) => {
    const { stage, ...rest } = i;
    void stage;
    return rest;
  }),
};

await client.query(
  `UPDATE contracts
      SET data = $2::jsonb,
          updated_at = now(),
          rev = nextval('change_seq')
    WHERE id = $1`,
  [row.id, JSON.stringify(cleaned)]
);

console.log(`\n✓ مُسح اسمُ المرحلة من ${named.length} دفعة — ويبلغ الأجهزةَ عند أول مزامنة\n`);
await client.end();
