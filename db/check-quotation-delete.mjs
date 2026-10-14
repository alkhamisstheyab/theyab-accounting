/**
 * يفحص حذف عرض السعر.
 *
 *   npm run check:qdelete [نسخة.json]
 *
 * لم يكن لحذف العرض بابٌ في الشاشة قطّ. والعروضُ تُنشأ للتجربة والتعليم
 * كما تُنشأ للعمل، ولم يكن يُزيلها إلا المحوُ التلقائيُّ لما انقضت
 * مدّتُه — وهو لا يمسّ مسودّةً ولا مقبولاً. فتراكمت: سبعةَ عشرَ عرضاً
 * فيها أربعةٌ أُنشئت لتعليم الموظفين كيف يعمل النظام، وواحدٌ عميلُه
 * «sdhfg».
 *
 * وقال صاحب الشركة: «أي شيء متعلق ببوخميس ألغه من النظام، كان للتجربة
 * والتعليم» ثم: «غيّرتُ حالته إلى مرفوض، أين أحذفه؟». وليس هناك أين.
 *
 * والحارسُ ليس على الحالة بل على **السند**: العرضُ الذي صار عقداً قائماً
 * هو أصلُه — فيه بنودُ الاتفاق وأسعارُها وما استُثني منها — فلا يُحذف
 * ويُقال لمَ. وأمّا عرضٌ يشير إلى عقدٍ لا وجود له (كعقدَي ١٠٠٤ و٢٠١٠
 * اللذين لم يُنشآ قطّ) فلا سندَ تحته فيُحذف، ويُقال ذلك في التأكيد.
 */
import fs from "fs";

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const page = fs.readFileSync("app/page.tsx", "utf8");

console.log("\nللعرض بابُ حذف:\n");

check("دالّةُ الحذف موجودة", /const removeQuotation = \(q: Quotation\) => \{/.test(page));
check(
  "وزرٌّ في صفّ العرض",
  /onClick=\{\(\) => removeQuotation\(q\)\}/.test(page)
);
check(
  "ولمن يملك إدارة العروض وحده",
  /\{canManage && \(\s+<button\s+onClick=\{\(\) => removeQuotation\(q\)\}/.test(page)
);

console.log("\nوالحارسُ على السند لا على الحالة:\n");

check(
  "يُبحث عن عقدٍ قائمٍ بالرقم",
  /const bound = q\.contractNumber\s+\? contractors\.find\(\(c\) => c\.contractNumber === q\.contractNumber\)/.test(
    page
  )
);
check(
  "ويُمنع الحذف إن وُجد",
  /لا يُحذف هذا العرض: هو سندُ العقد/.test(page)
);
check(
  "ويُقال لمَ وما فيه",
  /وفيه بنودُ الاتفاق وأسعارُها وما استُثني منها/.test(page)
);
check(
  "ويُدلّ على المخرج",
  /فاحذف العقد أوّلاً، أو امسح رقم العقد من العرض/.test(page)
);
check(
  "ولا يُمنع عرضٌ يشير إلى عقدٍ لا وجود له",
  /const orphan = q\.contractNumber \? `\\nويشير إلى العقد \$\{q\.contractNumber\} ولا وجود له في النظام\.` : "";/.test(
    page
  ),
  "فلا سندَ تحته"
);
check(
  "والحالةُ ليست حارساً — فالمقبولُ بلا عقدٍ يُحذف",
  !/removeQuotation[\s\S]{0,400}status === "مقبول"/.test(page)
);

console.log("\nويُقال ما يُمحى قبل محوه:\n");

check(
  "عددُ بنوده في التأكيد",
  /\$\{\s*\(q\.lines \?\? \[\]\)\.length\s*\} بنداً/.test(page),
  "فمن محا عرضاً بتسعين بنداً يعرف ما يمحو"
);
check("والعميل والحالة", /العميل: \$\{q\.clientName \|\| "بلا عميل"\} · الحالة: \$\{q\.status\}/.test(page));
check("ولا يُستردّ — يُقال ذلك", /ولا يُستردّ بعد الحذف/.test(page));
check("ويُسجَّل في التدقيق", /حُذف عرض السعر \$\{q\.number\}/.test(page));
check(
  "وتُغلق بطاقتُه إن كانت مفتوحة",
  /if \(openId === q\.id\) setOpenId\(null\);/.test(page),
  "وإلا بقيت شاشةٌ على عرضٍ لا وجود له"
);

/* ---- وعلى دفاتر الشركة ---- */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const d = JSON.parse(fs.readFileSync(BACKUP, "utf8")).data;
  const have = new Set(d.contractors.map((c) => c.contractNumber));
  const qs = d.quotations ?? [];
  const bound = qs.filter((q) => q.contractNumber && have.has(q.contractNumber));
  const orphan = qs.filter((q) => q.contractNumber && !have.has(q.contractNumber));
  const free = qs.filter((q) => !q.contractNumber);
  console.log("\nوعلى عروض الشركة:\n");
  console.log(`     العروض: ${qs.length}`);
  console.log(
    `     سندُ عقدٍ قائم — لا تُحذف: ${bound.length} (${bound.map((q) => q.number).join(" · ") || "—"})`
  );
  console.log(
    `     تشير إلى عقدٍ غائب — تُحذف: ${orphan.length} (${orphan.map((q) => q.number).join(" · ") || "—"})`
  );
  console.log(`     بلا عقد — تُحذف: ${free.length}`);
  check(
    "ولا عرضَ محميٌّ بلا عقدٍ حقيقيّ",
    bound.every((q) => have.has(q.contractNumber))
  );
}

console.log(
  bad === 0
    ? "\n✓ ما كان سنداً يبقى، وما كان تجربةً يُمحى — ويُقال ما يُمحى قبل محوه"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
