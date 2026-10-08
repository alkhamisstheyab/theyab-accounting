/**
 * يفحص ترتيب شاشة العقود.
 *
 *   npm run check:screen [نسخة.json]
 *
 * شكا صاحب الشركة: «عند الدخول إلى شاشة المقاولين يظهر في أول الصفحة
 * جميع العقود، ومن ثم أنزل إلى تحت كثيراً حتى تظهر لي العقود وأختار
 * منها الذي أريد، ومن ثم أكمل النزول إلى آخر الصفحة لكي أربط الدفعات.
 * أمرٌ مزعج جداً».
 *
 * وعلّتُه في الترتيب لا في الشيفرة: القائمةُ أوّل الصفحة بثمانيةٍ
 * وأربعين صفّاً، ولوحةُ العقد المختار تحتها كلِّها. فالعملُ الواحد
 * يُنزِل صاحبَه مرّتين، والقائمةُ تطول بكل عقدٍ يُكتب.
 *
 * فثلاثةٌ تُصلحه:
 *   • اللوحةُ فوق القائمة — فما يُفتح يُرى في مكانه.
 *   • وبحثٌ على القائمة، وإخفاءٌ للمنتهي، وحدٌّ لما يُعرض.
 *   • والاختيارُ يَقفز إلى اللوحة، فلا يُترك الباحث يبحث عمّا فتح.
 */
import fs from "fs";

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const page = fs.readFileSync("app/page.tsx", "utf8");

/* موضع كلٍّ من اللوحتين في شاشة العقود */
const detailAt = page.indexOf("title={`${selected.documentType} ${selected.contractNumber}");
const listAt = page.indexOf('subtitle={`${contractors.length} مستند');

console.log("\nالعقد المختار فوق القائمة:\n");

check("لوحةُ العقد موجودة", detailAt > 0);
check("والقائمة موجودة", listAt > 0);
check(
  "واللوحةُ قبلها — فلا يُنزَل مرّتين",
  detailAt > 0 && listAt > 0 && detailAt < listAt,
  detailAt < listAt ? "" : "القائمة لا تزال فوقها"
);

console.log("\nوالقائمة تُطلب ولا تُفتَّش بالعين:\n");

check(
  "بحثٌ على الرقم والاسم والمشروع",
  /placeholder="ابحث برقم العقد أو اسم صاحبه أو المشروع…"/.test(page)
);
check(
  "ويُسوّي الهمزات — فمن كتب «عواطف» وجدها",
  /const q = normalizeArabic\(search\.trim\(\)\);/.test(page)
);
check(
  "ويُطابق نوع العمل كذلك",
  /\[c\.contractNumber, c\.name, c\.project, c\.workType, c\.specialty\]/.test(page)
);
check("وإخفاءُ المنتهي", /أخفِ المنتهية/.test(page));
check(
  "والمفتوحُ لا يُخفى ولو كان منتهياً",
  /if \(hideSettled && c\.id !== selectedId && settlements\.get\(c\.id\)\?\.settled\)/.test(
    page
  ),
  "وإلا اختفى من تحت يده"
);
check("ويُقال كم عُرض من كم", /\{listed\.length\} من \{contractors\.length\}/.test(page));
check("وحدٌّ لما يُعرض", /listed\.slice\(0, 25\)\.map/.test(page));
check(
  "ويُقال إن ما وراءه يُطلب بالبحث",
  /تُعرض أوّل ٢٥ — اكتب في البحث لتصل إلى غيرها/.test(page)
);
check(
  "ولا يُقال «لا توجد عقود» وفيها عقودٌ لا تطابق",
  /"لا عقد يطابق البحث"/.test(page)
);

console.log("\nوالاختيار يَقفز إلى عمله:\n");

check("مرساةٌ على اللوحة", /<div ref=\{detailRef\}>/.test(page));
check(
  "ورقمُ العقد ينادي القفز",
  /onClick=\{\(\) => pick\(c\.id\)\}/.test(page)
);
check(
  "والقفز بعد الرسم لا قبله",
  /window\.setTimeout\(\s+\(\) => detailRef\.current\?\.scrollIntoView/.test(page)
);

/* ---- وعلى دفاتر الشركة ---- */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const d = JSON.parse(fs.readFileSync(BACKUP, "utf8")).data;
  console.log("\nوعلى دفاتر الشركة:\n");
  console.log(`     عقود: ${d.contractors.length} — وكانت تُعرض كلُّها دفعةً واحدة`);
  const byProject = {};
  for (const c of d.contractors) byProject[c.project] = (byProject[c.project] ?? 0) + 1;
  const worst = Object.entries(byProject).sort((a, b) => b[1] - a[1])[0];
  console.log(`     وأكثرُها على مشروعٍ واحد: ${worst?.[1]} على «${worst?.[0]}»`);
  check("والحدُّ أقلُّ من عددها — فالفحص يفحص", d.contractors.length > 25);
}

console.log("\nو«تعديل» في متناول اليد:\n");

check(
  "زرُّ التعديل في لوحة العقد المفتوح",
  /onClick=\{\(\) => openEdit\(selected\)\}/.test(page),
  "وكان في آخر أعمدة جدولٍ يُمرَّر أفقياً فيختفي"
);
check(
  "ولم يُفقد من الجدول",
  /onClick=\{\(\) => openEdit\(c\)\}/.test(page)
);
check(
  "وفتحُ النموذج يَقفز إليه",
  /setShowForm\(true\);\s+\/\* ويُقفز إليه/.test(page),
  "فالنموذج تحت اللوحة والقائمة"
);

console.log(
  bad === 0
    ? "\n✓ ما يُفتح يُرى في مكانه، والقائمة تُطلب ولا تُفتَّش"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
