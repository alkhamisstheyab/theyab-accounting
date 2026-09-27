/**
 * يفحص أن الحركة المرفوضة لها بابُ خروج.
 *
 *   node db/check-reject-delete.mjs
 *
 * عرض صاحب الشركة النظام على مجلس الإدارة والموظفين، فأدخل قيد تجربةٍ
 * ثم رفضه. ولمّا أراد محوه لم يجد له باباً: جدول الحركات لا يعرض إلا
 * المعتمد، وشاشة الاعتماد تُعيد المرفوضة إلى الانتظار ولا تحذفها. فبقي
 * قيدُ تجربةٍ في دفاتر الشركة لا سبيل إلى إخراجه — إلا أن يُعتمد أولاً،
 * فيدخل الحسابات بمبلغه ثم يُحذف منها. وذلك أسوأ من بقائه.
 *
 * فصار للمرفوضة زرُّ حذفٍ في موضعها، بصلاحية الحذف وحدها، بعد تأكيدٍ
 * يعرض القيد وسبب رفضه — ويبقى خبرها في سجل التدقيق.
 */
import fs from "fs";

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const page = fs.readFileSync("app/page.tsx", "utf8");

console.log("\nالمرفوضة خارج الجدول — فلا باب لها سوى موضعها:\n");

check(
  "جدول الحركات لا يعرض إلا المعتمد",
  page.includes("sortMovements(movementsOfYear(approvedMovements, year))")
);
check("ولوحة المرفوضة تُعيدها للانتظار", page.includes("إعادة للانتظار"));
check("وصار فيها زرّ حذف", page.includes("احذفها"));

console.log("\nوالحذف بشروطه:\n");

check(
  "لا يُحذف إلا من يملك صلاحية الحذف",
  page.includes('canDelete={allow("movements.delete")}') &&
    page.includes('if (!allow("movements.delete")) return;')
);
check(
  "ولا يُحذف من سنةٍ مقفلة",
  page.includes("if (!movementEditable(movement)) {")
);
check(
  "ويُسأل صاحبه قبل المحو، ويُعرض عليه القيد وسبب رفضه",
  page.includes("حذف القيد ${movement.entryNo} نهائياً؟") &&
    page.includes("سبب رفضها:")
);
check(
  "ويبقى خبرها في سجل التدقيق بصورتها قبل المحو",
  page.includes('log("حذف", "حركة", `قيد ${movement.entryNo} — مرفوضة`, {')
);

console.log("\nولا يمسّ الحذفُ حساباً:\n");

/*
  المرفوضة ليست في approvedMovements أصلاً — وعليها وحدها تقوم كل
  الأرقام. فحذفها لا يغيّر ميزاناً ولا قائمةً ولا تكلفة مشروع.
*/
check(
  "الأرقام كلها من المعتمد وحده",
  page.includes("const approvedMovements = useMemo(() => approvedOnly(movements), [movements]);")
);

console.log(
  bad === 0
    ? "\n✓ قيد التجربة يخرج من النظام، ويبقى خبره في السجل"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
