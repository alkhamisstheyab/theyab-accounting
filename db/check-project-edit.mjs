/**
 * يفحص تعديل المشروع وإقفاله.
 *
 *   npm run check:project-edit [نسخة.json]
 *
 * لم يكن للمشروع تعديلٌ أصلاً: تُنشأ بطاقته بحالة «نشط» ثم لا تُمسّ،
 * والشاشة تُنشئ وتحذف وتُسجّل وثيقة التأمين لا غير.
 *
 * فبقيت المشاريع المُسلَّمة نشطةً في الدفاتر: يُنبَّه على تأمين موقعٍ لا
 * عمل فيه، وتُقاس ميزانيةٌ انقضى أمرها. ومن أراد تصحيح ميزانيةٍ دخلت
 * خطأً — كشاليه دلال بوفتين: ١٣٬٠٠٠ مسجَّلة و٦٬٧٨٠ مقبوضة — لم يجد إلا
 * أن يحذف المشروع وينشئه، فتذهب وثيقته وتاريخه معه.
 *
 * والذي يُخشى منه:
 *   • أن يُقفل مشروعٌ بلا تاريخٍ يُعرف منه متى انقضى.
 *   • أن يُعاد تسميته فتُيتَّم حركاته — فالحركة تحمل الاسم نصّاً لا
 *     معرّفاً، ومن غيّره ولم ينقلها فقدها من تقرير ربحيته ولا يُنبَّه.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { projectInsurance } = await jiti.import("../lib/notifications.ts");
const page = fs.readFileSync("app/page.tsx", "utf8");
const storage = fs.readFileSync("lib/storage.ts", "utf8");

console.log("\nللمشروع حالاتٌ وتاريخُ نهاية:\n");

check(
  "أربع حالات",
  /PROJECT_STATUSES = \["نشط", "مكتمل", "متوقّف", "ملغي"\]/.test(storage)
);
check("وتاريخُ تسليم", /endDate\?: string;/.test(storage));
check(
  "ويعبر الترحيل",
  storage.includes("endDate: str(p.endDate) || undefined,")
);

console.log("\nوزرُّ تعديلٍ في كل بطاقة:\n");

check("للبطاقة زرُّ تعديل", page.includes('{editing === project.id ? "إغلاق" : "تعديل"}'));
check("ولمن يملك إدارة المشاريع وحده", page.includes("{canManage && (\n                      <button\n                        onClick={() =>\n                          editing === project.id"));
check(
  "ويُعدَّل فيه الميزانية والحالة والتاريخان",
  /الميزانية \(د\.ك\)/.test(page) &&
    /<Field label="الحالة">/.test(page) &&
    /تاريخ التسليم/.test(page) &&
    /تاريخ البدء/.test(page)
);

console.log("\nولا يُقفل مشروعٌ بلا تاريخ:\n");
check(
  "غيرُ النشط يُطالَب بتاريخ",
  page.includes('window.alert("حدّد تاريخ التسليم أو التوقّف")')
);

console.log("\nولا يُعاد تسميته من هنا:\n");
check(
  "لا خانةَ للاسم في النموذج",
  !page.includes('<Field label="اسم المشروع">')
);
check(
  "والسبب مكتوبٌ في موضعه",
  page.includes("ولا يُعدَّل الاسم من هنا")
);

console.log("\nويُسجَّل في سجلّ التدقيق:\n");
check(
  "بالحالة وبما كان قبلها",
  page.includes('onLog("تعديل", "مشروع"') && page.includes("before: `ميزانية")
);

console.log("\nوالمُقفل لا يُنبَّه على تأمينه:\n");

const project = (name, over = {}) => ({
  id: name,
  name,
  budget: 0,
  startDate: "2026-01-01",
  status: "نشط",
  ...over,
});
const uncovered = [
  {
    id: "c1",
    contractNumber: "1",
    name: "مقاول",
    project: "مشروع أ",
    counterpartyType: "مقاول",
    installments: [],
  },
];

check(
  "النشط يُنبَّه عليه",
  projectInsurance([project("مشروع أ")], "2026-10-02", uncovered).length === 1
);
for (const st of ["مكتمل", "متوقّف", "ملغي"]) {
  check(
    `و«${st}» لا يُنبَّه عليه`,
    projectInsurance([project("مشروع أ", { status: st })], "2026-10-02", uncovered)
      .length === 0
  );
}

/* ---- وعلى ملفّات الشركة ---- */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const d = JSON.parse(fs.readFileSync(BACKUP, "utf8")).data;
  console.log("\nوعلى مشاريع الشركة:\n");
  for (const p of d.projects) {
    const rev = d.movements
      .filter((m) => m.project === p.name && m.creditCode === "4110")
      .reduce((s, m) => s + m.amount, 0);
    console.log(
      `     ${p.name.padEnd(32)} | ${(p.status || "—").padEnd(7)} | ميزانية ${String(
        p.budget
      ).padStart(7)} | مقبوض ${rev.toFixed(0).padStart(7)}${
        p.endDate ? ` | انتهى ${p.endDate}` : ""
      }`
    );
  }
  const live = d.projects.filter(
    (p) => (!p.status || p.status === "نشط") && !["عام", "مصروفات مشتركة"].includes(p.name)
  );
  check(`مشاريع نشطة: ${live.length}`, true);
}

console.log(
  bad === 0
    ? "\n✓ يُقفل المشروع بتاريخه، ولا يُعاد تسميته عَرَضاً"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
