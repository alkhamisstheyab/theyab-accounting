/**
 * يفحص لوحة «ما ينتظر إقرارك».
 *
 *   npm run check:waiting [نسخة.json]
 *
 * التنبيهُ في الصفحة الرئيسية يقول «ثلاث مراحل اعتمدها المهندس وتنتظر
 * إقرارك»، ويقود إلى شاشة اعتماد المراحل — وفيها ثمانيةٌ وأربعون عقداً
 * بمئات الدفعات، معتمدِها وغيرِ معتمدِها، ولا شيء يدلّ على الثلاثة.
 *
 * فقال صاحب الشركة: «لماذا لا يظهر لي فقط ما اعتمده المهندس لإقرارها،
 * بدل البحث في جميع العقود والدفعات؟ أتوه ولا أعرف أيُّ واحدةٍ
 * المعتمدةُ الجديدة».
 *
 * والتنبيهُ الذي يدلّ على شاشةٍ ولا يدلّ على موضعٍ فيها نصفُ تنبيه:
 * يُعلم صاحبَه أن ثمّة عملاً، ويتركه يبحث عنه.
 *
 * ويُقال في كل صفٍّ أدخلها مالٌ أم لا — فإقرارُ ما دخله المال تصحيحُ
 * سجلّ، وإقرارُ ما لم يدخله إنشاءُ استحقاق، وليسا سواء. ويُعرض شرطُ
 * المرحلة: الإقرارُ شهادةٌ على إنجازٍ بعينه لا على رقم.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { awaitingConfirmation } = await jiti.import("../lib/notifications.ts");
const page = fs.readFileSync("app/page.tsx", "utf8");

console.log("\nما ينتظر الإقرار يُجمع في موضعٍ واحد:\n");

check(
  "اللوحة موجودة فوق الشاشة",
  /\{waiting\.length > 0 && \(\s+<Panel/.test(page)
);
check(
  "وتُحسب من المصدر نفسه الذي يُحسب منه التنبيه",
  /awaitingConfirmation\(contractors\)/.test(page),
  "فلا يختلف العددان"
);
check(
  "ولمن يملك الإقرار وحده",
  /canConfirm \? awaitingConfirmation\(contractors\) : \[\]/.test(page)
);
check(
  "وعنوانُها يحمل العدد",
  /title=\{`\$\{waiting\.length\} مرحلة تنتظر إقرارك`\}/.test(page)
);
check("ولا تظهر إن لم يكن ثمّة شيء", /\{waiting\.length > 0 &&/.test(page));

console.log("\nويُقرّ كلٌّ من موضعه:\n");

check(
  "زرُّ إقرارٍ في كل صفّ",
  /setConfirmation\(\s+contract\.id,\s+installment\.number,\s+true\s+\)/.test(page)
);
check(
  "وبابٌ إلى عقده إن أراد تفصيله",
  /setProjectFilter\(contract\.project\);\s+setStateFilter\("الكل"\);/.test(page)
);

console.log("\nويُقال ما يُقرّ:\n");

check("رقمُ العقد ودفعته", /<Td className="font-bold">\{contract\.contractNumber\}<\/Td>/.test(page));
check("وصاحبُه ومشروعُه", /\{contract\.name\}<\/Td>/.test(page) && /\{contract\.project\}<\/Td>/.test(page));
check("والمستحقّ", /const net = installmentNet\(installment\);/.test(page));
check(
  "وهل دخلها مالٌ أم لا",
  /لم يدخلها مال/.test(page) && /مدفوعةٌ بالكامل/.test(page),
  "فإقرارُ ما دخله المال تصحيحُ سجلّ، وما لم يدخله إنشاءُ استحقاق"
);
check("ومن اعتمدها ومتى", /\{installment\.approvedBy \|\| "—"\}/.test(page));
check(
  "وشرطُ المرحلة — فالإقرار شهادةٌ على إنجازٍ بعينه",
  /\{installment\.condition \|\| "بلا شرطٍ مكتوب"\}/.test(page)
);

console.log("\nوالمصروفُ يُقاس على الدفعة لا على العقد:\n");
check(
  "byInstallment لا total",
  /contractPayments\(\s+movements,\s+contract\.contractNumber\s+\)\.byInstallment\.get\(installment\.number\)/.test(
    page
  )
);

/* ---- وعلى دفاتر الشركة ---- */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const d = JSON.parse(fs.readFileSync(BACKUP, "utf8")).data;
  const rows = awaitingConfirmation(d.contractors);
  console.log("\nوعلى عقود الشركة:\n");
  console.log(`     تنتظر إقراراً: ${rows.length} من ${d.contractors.length} عقداً`);
  for (const r of rows)
    console.log(
      `       ${r.contract.contractNumber}/${r.installment.number} · ${r.installment.value} · ${(r.contract.name || "").slice(0, 24)}`
    );
  const all = d.contractors.reduce((n, c) => n + (c.installments ?? []).length, 0);
  console.log(`     ودفعاتُ العقود كلِّها: ${all} — وهي ما كان يُفتَّش فيه`);
  check("واللوحة أقصرُ من الشاشة بكثير", rows.length < all / 10, `${rows.length} من ${all}`);
}

console.log(
  bad === 0
    ? "\n✓ ما ينتظر الإقرار يُرى في موضعه ويُقرّ منه — ولا يُفتَّش عنه"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
