/**
 * يفحص ملفَ الاستيراد المُخرَج — لا الشفرة.
 *
 * سبب وجوده: صيغةُ البنود في الشفرة صحيحةٌ ولا تصل إلى المطبوعة إن
 * أسقطها المُصدِّر. فالفحص هنا على ما يصل فعلاً إلى المتصفح.
 */
import fs from "fs";
import path from "path";

const p = path.join(process.env.USERPROFILE, "Desktop", "عقود-المشاريع-للاستيراد.json");
const cs = JSON.parse(fs.readFileSync(p, "utf8")).data.contractors;
let bad = 0;
const fail = (m) => {
  bad++;
  console.log("  ✗ " + m);
};

/*
  مجموع الدفعات يجب أن يساوي قيمة العقد في كل عقد.

  هذا أهم فحصٍ في الملف: خطأ رقمٍ واحد في نقل جدول الدفعات يمرّ
  بلا أثر ظاهر، ثم يظهر بعد شهور كدفعةٍ ناقصة أو زائدة على مقاول.
  والصفّ التوثيقي لا يدخل المجموع — خصمُه مطبَّق سلفاً.
*/
console.log("العقد  قيمة العقد  مجموع الدفعات");
for (const c of cs) {
  const sum =
    Math.round(
      c.installments
        .filter((i) => !i.informational)
        .reduce((a, i) => a + (Number(i.value) || 0), 0) * 1000
    ) / 1000;
  const ok = Math.abs(sum - c.contractValue) < 0.001;
  if (!ok) fail(`العقد ${c.contractNumber}: الدفعات ${sum} لا تساوي قيمته ${c.contractValue}`);
  console.log(
    `  ${c.contractNumber}  ${String(c.contractValue).padStart(9)}  ` +
      `${String(sum).padStart(12)}  ${ok ? "✓" : "✗"}`
  );
}

console.log("العقد   تمهيد  التزامات  وصف المبنى  ملاحظات");
/*
  التمهيد يصف موضع العمل وأطرافه، وبدونه لا يُعرف العقد من مطبوعته.
  أما الالتزامات فبعض العقود لا تفردها بنداً، بل تكتبها في ملاحظاتها —
  فغيابها يُعرَض ولا يُعدّ خطأً. والمطلوب أن يبقى للعقد وصفٌ ما.
*/
for (const c of cs) {
  const pre = c.preamble.length;
  const obl = c.obligations.length;
  if (c.counterpartyType !== "مورّد" && pre === 0)
    fail(`العقد ${c.contractNumber}: بلا تمهيد`);
  if (pre === 0 && obl === 0 && c.notes.length === 0)
    fail(`العقد ${c.contractNumber}: بلا تمهيد ولا التزامات ولا ملاحظات`);
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
