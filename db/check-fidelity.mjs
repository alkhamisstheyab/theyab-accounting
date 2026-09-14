/**
 * يفحص ملفَ الاستيراد المُخرَج — لا الشفرة.
 *
 * سبب وجوده: صيغةُ البنود في الشفرة صحيحةٌ ولا تصل إلى المطبوعة إن
 * أسقطها المُصدِّر. فالفحص هنا على ما يصل فعلاً إلى المتصفح.
 */
import fs from "fs";
import path from "path";

const p = path.join(process.env.USERPROFILE, "Desktop", "عقود-عواطف-للاستيراد.json");
const cs = JSON.parse(fs.readFileSync(p, "utf8")).data.contractors;
let bad = 0;
const fail = (m) => {
  bad++;
  console.log("  ✗ " + m);
};

console.log("العقد   تمهيد  التزامات  وصف المبنى  ملاحظات");
for (const c of cs) {
  const pre = c.preamble.length;
  const obl = c.obligations.length;
  const needs = c.counterpartyType !== "مورّد";
  if (needs && (pre === 0 || (c.contractNumber !== "2002" && obl === 0))) bad++;
  console.log(
    `${c.contractNumber}    ${String(pre).padStart(4)}   ${String(obl).padStart(5)}    ` +
      `${String(c.buildingDescription.length).padStart(6)}     ${String(c.notes.length).padStart(5)}`
  );
}

const a = cs.find((c) => c.contractNumber === "2001");

console.log("\n--- تمهيد العقد 2001 ---");
console.log(a.preamble);

console.log("\n--- «ثانياً: قيمة العقد» ---");
a.notes.split("\n").forEach((line) => console.log("  • " + line));

console.log("\n--- جدول «رابعاً» كما سيُطبع ---");
console.log("  م  المرحلة                 بنود  المواد          الدفعة");
let payable = 0;
for (const i of a.installments) {
  const v = Number(i.value) || 0;
  if (!i.informational) payable += v;
  console.log(
    `  ${String(i.no ?? "").padStart(2)}  ${(i.stage || "—").padEnd(22)}  ` +
      `${String((i.rows || []).length).padStart(2)}  ${(i.materials || "").padEnd(14)}  ` +
      `${(i.informational ? "(" + v + "-)" : String(v)).padStart(7)}` +
      (i.banner ? "   ▶ " + i.banner : "")
  );
}
console.log("  " + "".padEnd(56, "-"));
console.log(`  مجموع الدفعات القابلة للصرف: ${payable}   قيمة العقد: ${a.contractValue}`);

console.log("");
// شروط العقد 2001 بعينها — نقلاً عن الأصل الموقّع
if (a.notes.split("\n").length !== 3) fail("«ثانياً» يجب أن يكون ثلاث نقاط في ثلاثة أسطر");
if (payable !== a.contractValue) fail(`مجموع الدفعات ${payable} لا يساوي قيمة العقد ${a.contractValue}`);
if (a.installments.filter((i) => i.informational).length !== 1)
  fail("صفّ التراخيص والمخططات التوثيقي (4000-) مفقود أو مكرّر");
if (!a.installments.every((i) => i.no > 0)) fail("دفعةٌ بلا رقم صفّ في عمود «م»");
if (new Set(a.installments.map((i) => i.no)).size !== 10) fail("عمود «م» يجب أن ينتهي عند 10 صفوف");
if (!a.installments.every((i) => (i.rows || []).length > 0)) fail("دفعةٌ بلا صفوف بنود");
const setup = a.installments.find((i) => i.stage === "تجهيز الموقع");
if (!setup || setup.rows.length !== 7) fail("مرحلة «تجهيز الموقع» سبعة بنود لا بنداً واحداً");
if (!a.installments.every((i) => i.materials)) fail("عمود المواد ناقص في دفعة");
if (a.installments.filter((i) => i.banner).length !== 2)
  fail("السطران العريضان (الهيكل الأسود / النصف تشطيب) مفقودان");

console.log(bad === 0 ? "✓ العقد المُخرَج مطابق للأصل الموقّع" : `✗ ${bad} فرقاً عن الأصل`);
process.exit(bad === 0 ? 0 : 1);
