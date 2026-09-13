import fs from "fs";
import path from "path";
const p = path.join(process.env.USERPROFILE, "Desktop", "عقود-عواطف-للاستيراد.json");
const cs = JSON.parse(fs.readFileSync(p, "utf8")).data.contractors;
let bad = 0;
console.log("العقد   تمهيد  التزامات  وصف المبنى  ملاحظات");
for (const c of cs) {
  const pre = c.preamble.length;
  const obl = c.obligations.length;
  const bld = c.buildingDescription.length;
  const nte = c.notes.length;
  // العميل والمقاول يجب أن يكون لهما تمهيد والتزامات
  const needs = c.counterpartyType !== "مورّد";
  if (needs && (pre === 0 || (c.contractNumber !== "2002" && obl === 0))) bad++;
  console.log(
    `${c.contractNumber}    ${String(pre).padStart(4)}   ${String(obl).padStart(5)}    ${String(bld).padStart(6)}     ${String(nte).padStart(5)}`
  );
}
console.log("\n--- تمهيد العقد 2001 ---");
console.log(cs.find((c) => c.contractNumber === "2001").preamble);
console.log("\n--- أول التزام للمالك ---");
console.log(cs.find((c) => c.contractNumber === "2001").obligations[0]);
console.log(bad === 0 ? "\n\u2713 التمهيد والالتزامات موجودة حيث يجب" : `\n\u2717 ${bad} عقداً ناقصاً`);
process.exit(bad === 0 ? 0 : 1);
