/**
 * يفحص تصادم أرقام القيود على خادمٍ مشترك.
 *
 *   node db/check-entry-collision.mjs
 *
 * رقم القيد مفتاحٌ فريد في سنته، والمتصفّح يحسبه من عنده: «أعلى رقمٍ
 * يعرفه زائد واحد». فإن أدخل اثنان في اللحظة نفسها أخذا الرقم نفسه،
 * فيرفض الخادم الثانية — ويقف العمل على من لا ذنب له. وهذا أخطر ما
 * يمنع فتح النظام للموظفين.
 *
 * فصار الخادم يُعطي التالي الحرّ بدل أن يرفض، ويُخبر المتصفّح بما غيّر.
 *
 * والفحص على قاعدةٍ حقيقية — PGlite — لا على محاكاة.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createJiti } from "jiti";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { PGlite } = await import("@electric-sql/pglite");
const { applyChanges, currentRev } = await jiti.import("../lib/server/writes.ts");

const db = new PGlite();
const schema = fs.readFileSync(path.join(HERE, "schema.sql"), "utf8");
await db.exec(schema);

const movement = (id, entryNo, description) => ({
  id,
  entryNo,
  fiscalYear: 2026,
  date: "2026-09-24",
  movementType: "مصروف",
  description,
  itemCode: "",
  itemName: "مواد إنشائية",
  debitCode: "5110",
  creditCode: "1111",
  amount: 100,
  project: "مشروع",
  person: "",
  paymentMethod: "نقدي",
  party: "",
  source: "app",
  approval: "معتمدة",
  approvedBy: "ذياب",
  approvedAt: "2026-09-24T08:00:00.000Z",
  approvalNote: "",
});

console.log("\nكاتبان في اللحظة نفسها:\n");

/* الأول يحفظ القيد 1844 */
const first = await applyChanges(
  db,
  { upserts: { movements: [movement("a", 1844, "حركة المحاسب")] } },
  "المحاسب"
);
check("حُفظت الأولى", first.written === 1, `قيد 1844`);
check("ولم يُعَد ترقيمها", (first.renumbered ?? []).length === 0);

/* والثاني يحسب الرقم نفسه ولمّا يصله تغيير الأول */
const second = await applyChanges(
  db,
  { upserts: { movements: [movement("b", 1844, "حركة السكرتيرة")] } },
  "السكرتيرة"
);
check("والثانية حُفظت ولم تُرفض", second.written === 1);
check(
  "وأُعيد ترقيمها إلى التالي",
  (second.renumbered ?? []).length === 1 &&
    second.renumbered[0].from === 1844 &&
    second.renumbered[0].to === 1845,
  JSON.stringify(second.renumbered)
);

const { rows } = await db.query(
  "SELECT id, entry_no, data->>'description' AS d FROM movements ORDER BY entry_no"
);
check("والقيدان في القاعدة", rows.length === 2, `${rows.length}`);
check(
  "بأرقامٍ مختلفة",
  new Set(rows.map((r) => Number(r.entry_no))).size === 2,
  rows.map((r) => `${r.entry_no}: ${r.d}`).join(" · ")
);
check(
  "والأول احتفظ برقمه — لا يُزاحَم صاحب السبق",
  Number(rows.find((r) => r.d === "حركة المحاسب").entry_no) === 1844
);
check(
  "والكائن المحفوظ يحمل الرقم الجديد لا القديم",
  await (async () => {
    const { rows: r } = await db.query(
      "SELECT data->>'entryNo' AS n FROM movements WHERE data->>'description' = 'حركة السكرتيرة'"
    );
    return Number(r[0]?.n) === 1845;
  })()
);

console.log("\nوتعديل الحركة نفسها لا يُغيّر رقمها:\n");

const again = await applyChanges(
  db,
  { upserts: { movements: [{ ...movement("a", 1844, "حركة المحاسب معدَّلة"), amount: 250 }] } },
  "المحاسب"
);
check("لا إعادة ترقيم", (again.renumbered ?? []).length === 0);
const { rows: after } = await db.query(
  "SELECT entry_no, amount FROM movements WHERE data->>'description' = 'حركة المحاسب معدَّلة'"
);
check(
  "والرقم والمبلغ كما أُريد",
  Number(after[0]?.entry_no) === 1844 && Number(after[0]?.amount) === 250,
  `${after[0]?.entry_no} · ${after[0]?.amount}`
);

console.log("\nودفعةٌ فيها تصادمان:\n");

const many = await applyChanges(
  db,
  {
    upserts: {
      movements: [
        movement("c", 1844, "ثالثة"),
        movement("d", 1845, "رابعة"),
        movement("e", 1850, "خامسة بلا تصادم"),
      ],
    },
  },
  "المهندس"
);
check(
  "أُعيد ترقيم المتصادمتين وحدهما",
  (many.renumbered ?? []).length === 2,
  JSON.stringify(many.renumbered)
);
const { rows: all } = await db.query("SELECT entry_no FROM movements ORDER BY entry_no");
check(
  "ولا رقم مكرَّر في السنة",
  new Set(all.map((r) => Number(r.entry_no))).size === all.length,
  all.map((r) => r.entry_no).join("، ")
);
check(
  "والحرّ بقي على رقمه",
  all.some((r) => Number(r.entry_no) === 1850)
);

console.log("\nوسنةٌ أخرى لا تُزاحَم:\n");

const other = await applyChanges(
  db,
  { upserts: { movements: [{ ...movement("f", 1844, "حركة ٢٠٢٥"), fiscalYear: 2025 }] } },
  "المحاسب"
);
check("رقم ٢٠٢٥ حرٌّ وإن كان مأخوذاً في ٢٠٢٦", (other.renumbered ?? []).length === 0);

check("ورقم التغيير يتقدّم", (await currentRev(db)) > 0);

await db.close();

console.log(
  bad === 0
    ? "\n✓ لا يُرفض قيدٌ لتصادم رقمه — يُعطى التالي الحرّ ويُخبَر صاحبه"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
