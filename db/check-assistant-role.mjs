/**
 * يفحص دورَ مساعد المحاسب.
 *
 *   npm run check:assistant
 *
 * والأصلُ المحروسُ هنا واحد: **يُدخل ولا يُقرّ**. فالإقرار قرارُ صاحب
 * الشركة أو المدير العام — وبه تدخل الحركةُ ميزانَ المراجعة. فلو أقرّ
 * كاتبُ القيدِ قيدَه سقطت الرقابةُ وصارت صورة: يكتب ويُجيز نفسه.
 *
 * وهذا الفحصُ لأجل الغد لا لأجل اليوم: دورٌ يُضاف إليه مفتاحٌ بغفلةٍ
 * بعد شهورٍ لا يُكتشف بالنظر — القائمةُ خمسٌ وعشرون مفتاحاً، ومن يقرؤها
 * كلَّها؟ فتُسمّى الممنوعاتُ صريحةً، ويُخفق الفحصُ إن دخل واحدٌ منها.
 */
import { createJiti } from "jiti";

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const jiti = createJiti(import.meta.url);
const { ROLES, roleDefinition, ALL_PERMISSIONS, permissionLabel } =
  await jiti.import("../lib/permissions.ts");

const role = roleDefinition("assistant");
const has = (key) => role.permissions.includes(key);

console.log("\nالدور موجودٌ ومعروض:\n");

check("مسجّلٌ في الأدوار", role.key === "assistant", role.label);
check(
  "وموضعُه بعد الإدارة وقبل السكرتارية",
  ROLES.findIndex((r) => r.key === "assistant") ===
    ROLES.findIndex((r) => r.key === "secretary") - 1,
  "فتُقرأ الأدوارُ من الأوسع إلى الأضيق"
);
check("وله وصفٌ يُقرأ قبل الاختيار", role.description.length > 60);
check(
  "ومفاتيحُه كلُّها معروفة",
  role.permissions.every((p) => ALL_PERMISSIONS.includes(p)),
  role.permissions.filter((p) => !ALL_PERMISSIONS.includes(p)).join("، ") || `${role.permissions.length} مفتاحاً`
);
check(
  "ولا يتكرّر فيه مفتاح",
  new Set(role.permissions).size === role.permissions.length
);

console.log("\nوعملُه اليوميّ يصله:\n");

for (const [key, why] of [
  ["movements.create", "يُدخل القيد"],
  ["movements.edit", "ويصحّحه"],
  ["movements.view", "ويرى الحركات"],
  ["journal.view", "والقيود اليومية"],
  ["ledger.view", "ودفتر الأستاذ"],
  ["trialBalance.view", "وميزان المراجعة"],
  ["financials.view", "والقوائم المالية"],
  ["contractors.manage", "ويربط الدفعات بالعقود"],
  ["projects.manage", "ويتابع المشاريع"],
  ["materials.manage", "ويسجّل استلام المواد"],
  ["attendance.manage", "ويسجّل الحضور"],
  ["dues.create", "ويكتب المستحقّ"],
  ["vouchers.print", "ويطبع السندات"],
]) {
  check(why, has(key), key);
}

console.log("\nوالممنوعُ ممنوع — وهذا هو المحروس:\n");

/*
  وكلُّ واحدٍ من هؤلاء مُنع لسببٍ يُذكر، لا تضييقاً: فمن أراد توسيعَه
  غداً يقرأ السببَ أوّلاً، ثم يُوسّع على بصيرةٍ أو يَكفّ.
*/
const forbidden = [
  ["movements.approve", "فيكتب القيدَ ويُجيز نفسه — وتسقط الرقابة كلُّها"],
  ["movements.delete", "يُصحَّح الخطأ ولا يُمحى، فالأثر يبقى في السجلّ"],
  ["contracts.approve", "تلك شهادةُ المهندس على إتمام العمل"],
  ["contracts.confirm", "وذاك إقرارُ الإدارة بعد شهادته"],
  ["employees.manage", "أرقامُ الرواتب تبقى عند الإدارة"],
  ["payroll.run", "والمسيَّرُ معها"],
  ["chart.manage", "دليلُ الحسابات أساسُ الدفاتر لا حركةٌ فيها"],
  ["opening.manage", "والأرصدةُ الافتتاحية مثلُه"],
  ["year.close", "وترحيلُ السنة يُغلق أرقاماً صدرت"],
  ["users.manage", "وبها يمنح نفسَه ما مُنع منه"],
  ["backup.restore", "وبها يُستبدل كلُّ شيء"],
  ["settings.manage", "وبيانات الشركة تُطبع في العقود"],
  ["quotations.manage", "والتسعيرُ قرارٌ تجاريّ"],
];

for (const [key, why] of forbidden) {
  check(`لا يملك «${permissionLabel(key)}»`, !has(key), why);
}

console.log(
  bad === 0
    ? `\n✓ مساعد المحاسب: ${role.permissions.length} صلاحية — يُدخل ويتابع، ولا يُقرّ ولا يحذف ولا يمسّ أساس الدفاتر`
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
