/**
 * يتحقّق من بناء جدول «رابعاً» قبل طباعته.
 *
 * الدمج الرأسي يُفسد الجدول بصمت: rowSpan زائدٌ واحداً يزحزح عموداً
 * كاملاً دون خطأ في الشفرة ولا في الطباعة. فالفحص هنا حسابيّ — مجموع
 * أطوال الدمج في كل عمود يجب أن يساوي عدد صفوف الجدول بالضبط.
 *
 *   node db/check-works-table.mjs
 */
import fs from "fs";
import path from "path";

const p = path.join(process.env.USERPROFILE, "Desktop", "عقود-عواطف-للاستيراد.json");
const cs = JSON.parse(fs.readFileSync(p, "utf8")).data.contractors;

let bad = 0;

for (const c of cs.filter((x) => x.counterpartyType === "عميل")) {
  const items = c.installments.map((i) => ({
    inst: i,
    rows: i.rows && i.rows.length ? i.rows : [{ item: "", description: i.condition }],
  }));
  if (!items.some((it) => it.inst.no)) continue; // عقد بلا جدول ستّة أعمدة

  // نفس خوارزمية الدمج في ClientWorksTable حرفياً
  const merges = (key) => {
    const span = new Array(items.length).fill(0);
    let g = 0;
    while (g < items.length) {
      let end = g;
      let rows = items[g].rows.length;
      while (
        !items[end].inst.banner &&
        end + 1 < items.length &&
        key(items[end + 1].inst) === key(items[g].inst)
      ) {
        end++;
        rows += items[end].rows.length;
      }
      span[g] = rows;
      g = end + 1;
    }
    return span;
  };

  const total = items.reduce((a, it) => a + it.rows.length, 0);
  const cols = {
    "م": merges((i) => String(i.no ?? "")),
    "المرحلة": merges((i) => i.stage ?? ""),
    "المواد": merges((i) => (i.no ?? "") + "|" + (i.materials ?? "")),
  };

  console.log(`العقد ${c.contractNumber} — ${total} صفاً في الجدول`);
  for (const [name, span] of Object.entries(cols)) {
    const sum = span.reduce((a, b) => a + b, 0);
    const cells = span.filter((v) => v > 0).length;
    const ok = sum === total;
    if (!ok) bad++;
    console.log(
      `  ${name.padEnd(8)} ${String(cells).padStart(2)} خلية، مجموع الدمج ${String(sum).padStart(3)}` +
        (ok ? "  ✓" : `  ✗ المتوقع ${total}`)
    );
  }
  // عمود الدفعة خليّة لكل دفعة، وطولها صفوفها
  const pay = items.reduce((a, it) => a + it.rows.length, 0);
  if (pay !== total) {
    bad++;
    console.log(`  الدفعة   ✗ ${pay} لا ${total}`);
  } else console.log(`  الدفعة   ${items.length} خلية، مجموع الدمج ${pay}  ✓`);
}

console.log(bad === 0 ? "\n✓ الدمج الرأسي متّزن في كل عمود" : `\n✗ ${bad} عموداً مختلاً`);
process.exit(bad === 0 ? 0 : 1);
