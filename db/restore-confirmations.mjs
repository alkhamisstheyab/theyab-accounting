/**
 * يستردّ ما زال من اعتمادات المراحل وإقراراتها.
 *
 *   node db/restore-confirmations.mjs          # يعرض ولا يكتب
 *   node db/restore-confirmations.mjs --apply  # يكتب
 *
 * في ١٨ أكتوبر ٢٠٢٦ تبيّن أن تسعةَ عشرَ إقراراً للإدارة واعتمادين
 * زالت من العقود بعد أن وقعت. ولم يضع مالٌ ولا قيد — الحركاتُ كلُّها
 * معتمدة والميزانُ سليم — وإنما ضاعت **قرارات** الاعتماد والإقرار.
 *
 * وعلّتُها أن المزامنة تحسب الفرق بين الجهاز والخادم وتعدّ كلَّ فرقٍ
 * تغييراً محلياً يُرسل، فلا تفرّق بين «أنا عدّلتُ هذا» و«نسختي قديمةٌ
 * وقد تقدّم الخادم عليّ». فجهازان حملا نسخةً سابقةً للإقرارات فكتباها
 * فوقها: جهازُ م. ميس في ١٥ أكتوبر (٥٠١٢ · ٥٠١١ · ٤٠٠٥)، وجهازُ صاحب
 * الشركة نفسه في ١٨ أكتوبر (٢٠٠١ · ٢٠٠٥ · ٦٠٠١ · ٣٠٠١ · ٣٠٠٥ · ٤٠٠٣ ·
 * ٤٠٠٩ · ٥٠١٣).
 *
 * وسجلُّ التدقيق لا يُحذف منه شيء، ففيه لكلِّ قرارٍ اسمُ صاحبه ووقتُه.
 * فمنه يُستردّ — **باسم من قرّر لا باسم من استردّ**، فالشهادةُ شهادتُه.
 *
 * ولا يُكتب إلا ما زال: ما بقي على حاله لا يُمسّ، ولا يُرفع رقمُ تغييره.
 * والصفُّ له وجهان — عمود `installments` وكائن `data` — فيُكتبان معاً،
 * وإلا قرأ المتصفّحُ خلافَ ما يقرأ الخادم.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const APPLY = process.argv.includes("--apply");
const HERE = path.dirname(fileURLToPath(import.meta.url));

let url = process.env.DATABASE_URL ?? "";
if (!url) {
  const envFile = path.join(HERE, "..", ".env.local");
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = /^\s*DATABASE_URL\s*=\s*(.*)$/.exec(line);
    if (m) url = m[1].trim().replace(/^["']|["']$/g, "");
  }
}
if (!url) {
  console.error("لا عنوان لقاعدة البيانات");
  process.exit(1);
}

const pg = (await import("pg")).default;
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

/* ---- ما في السجلّ من قرارات، آخرُها يغلب ---- */
const { rows: log } = await c.query(
  `SELECT at, actor, summary FROM audit_log
    WHERE summary LIKE 'إقرار الإدارة — عقد %'
       OR summary LIKE 'عقد % · الدفعة % د.ك%'
    ORDER BY at`
);

/** key → { approve?: {by, at}, confirm?: {by, at} } */
const decided = new Map();
for (const r of log) {
  const m = /عقد (\S+) · الدفعة (\d+)/.exec(r.summary);
  if (!m) continue;
  const key = `${m[1]}/${m[2]}`;
  const entry = decided.get(key) ?? {};
  const stamp = { by: r.actor, at: new Date(r.at).toISOString() };
  if (r.summary.startsWith("إقرار الإدارة")) entry.confirm = stamp;
  else entry.approve = stamp;
  decided.set(key, entry);
}

/* ---- الصفوف الحيّة ---- */
const { rows: gone } = await c.query(`SELECT collection, row_id FROM deletions`);
const dead = new Set(gone.map((r) => r.collection + ":" + r.row_id));
const { rows: all } = await c.query(`SELECT id, contract_number, data FROM contracts`);
const live = all.filter((r) => !dead.has("contractors:" + r.id));

const repairs = [];
for (const row of live) {
  const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
  const installments = data.installments ?? [];
  let touched = false;
  const next = installments.map((i) => {
    const d = decided.get(`${data.contractNumber}/${i.number}`);
    if (!d) return i;
    const fixed = { ...i };
    if (d.approve && !i.approved) {
      fixed.approved = true;
      fixed.approvedBy = d.approve.by;
      fixed.approvedAt = d.approve.at;
      touched = true;
      repairs.push(`${data.contractNumber}/${i.number} — اعتماد ${d.approve.by} · ${d.approve.at.slice(0, 10)}`);
    }
    if (d.confirm && !i.confirmed) {
      /* الإقرارُ مبنيٌّ على الاعتماد، فلا يُستردّ بلا اعتماد */
      if (!fixed.approved) {
        repairs.push(`${data.contractNumber}/${i.number} — إقرارٌ بلا اعتماد، يُترك`);
        return fixed;
      }
      fixed.confirmed = true;
      fixed.confirmedBy = d.confirm.by;
      fixed.confirmedAt = d.confirm.at;
      touched = true;
      repairs.push(`${data.contractNumber}/${i.number} — إقرار ${d.confirm.by} · ${d.confirm.at.slice(0, 10)}`);
    }
    return fixed;
  });
  if (touched) row.__next = { ...data, installments: next };
}

const toWrite = live.filter((r) => r.__next);

console.log(`\nقراراتٌ في السجلّ: ${decided.size}`);
console.log(`عقودٌ تُصلَح: ${toWrite.length}\n`);
for (const line of repairs) console.log("  " + line);

if (toWrite.length === 0) {
  console.log("\n✓ لا شيء يُستردّ — كلُّ قرارٍ في السجلّ قائمٌ في العقود\n");
  await c.end();
  process.exit(0);
}

if (!APPLY) {
  console.log("\nهذا عرضٌ فقط. للاسترداد:  node db/restore-confirmations.mjs --apply\n");
  await c.end();
  process.exit(0);
}

await c.query("BEGIN");
try {
  for (const row of toWrite) {
    /*
      الوجهان معاً: عمودُ الدفعات يقرؤه الخادم، وكائنُ data يقرؤه
      المتصفّح. وكتابةُ أحدهما دون الآخر تُبقي الخلاف قائماً ولا يُرى.
    */
    await c.query(
      `UPDATE contracts
          SET data = $2::jsonb,
              installments = $3::jsonb,
              updated_at = now(),
              updated_by = $4,
              rev = nextval('change_seq')
        WHERE id = $1`,
      [
        row.id,
        JSON.stringify(row.__next),
        JSON.stringify(row.__next.installments),
        "استرداد من سجلّ التدقيق",
      ]
    );
  }
  await c.query("COMMIT");
} catch (error) {
  await c.query("ROLLBACK");
  throw error;
}

console.log(`\n✓ استُرد ${repairs.length} قراراً في ${toWrite.length} عقداً — ويبلغ الأجهزةَ عند أول مزامنة\n`);
await c.end();
