/**
 * يفحص أن الاستيراد الكامل كاملٌ فعلاً.
 *
 *   node db/check-import.mjs
 *
 * زرّ «استيراد كامل (يستبدل كل شيء)» كان يستورد ستة حقول من واحدٍ
 * وعشرين. ومن استعاد نسخته على جهازٍ جديد وجد دفاتره وقد ذهب منها
 * المستخدمون والموظفون وعروض الأسعار وسجل التدقيق — بلا رسالة تقول له.
 *
 * والحقل يُضاف إلى الحالة فيُنسى هنا، ولا يظهر أثر النسيان إلا يوم
 * الاستعادة — وذلك أسوأ يومٍ يُكتشف فيه.
 *
 * فيُقرأ المعالج من الشيفرة ويُقابَل بحقول الحالة، ويُشترط أن يغطّيها
 * كلها. وهو فحصٌ نصّي لا يشغّل شيئاً — يكفي لهذا الصنف من السهو.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createJiti } from "jiti";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const jiti = createJiti(import.meta.url);

const { emptyState } = await jiti.import("../lib/storage.ts");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");

/* معالج الاستيراد: من onImport إلى قوسه الأخير */
const start = page.indexOf("onImport={(next) => {");
if (start < 0) {
  console.error("لم يُعثر على معالج الاستيراد في app/page.tsx");
  process.exit(1);
}
const end = page.indexOf("\n              }}", start);
const handler = page.slice(start, end < 0 ? start + 4000 : end);

const fields = Object.keys(emptyState());
console.log(`\nحقول الحالة: ${fields.length}\n`);

const missing = fields.filter((f) => !handler.includes(`next.${f}`));

const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - String(s).length));
for (const f of fields) {
  const has = handler.includes(`next.${f}`);
  console.log(`  ${has ? "✓" : "✗"} ${pad(f, 20)}${has ? "" : "لا يُستورد"}`);
}
console.log("");

check(
  `الاستيراد الكامل يغطّي الحقول ${fields.length} كلها`,
  missing.length === 0,
  missing.join("، ")
);

/*
  والمستخدمون بالذات: بذهابهم لا تظهر شاشة الدخول، فيفتح النظام بكامل
  الصلاحيات بلا كلمة سرّ. فيُفرَد بفحصٍ يسمّيه.
*/
check(
  "والمستخدمون منها — وبهم تقوم شاشة الدخول",
  handler.includes("setUsers(next.users)")
);

console.log(
  bad === 0
    ? "\n✓ «استيراد كامل» كاملٌ كما يقول اسمه"
    : `\n✗ ${bad} فحصاً أخفق — الاستيراد ينقص`
);
process.exit(bad === 0 ? 0 : 1);
