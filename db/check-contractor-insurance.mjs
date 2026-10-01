/**
 * يفحص من تقع عليه وثيقة تأمين الموقع.
 *
 *   npm run check:insurance [نسخة.json]
 *
 * بُني تأمينُ المواقع على أن كلَّ مشروعٍ نشطٍ تلزمه وثيقةٌ على الشركة،
 * فوُسمت سبعةُ مشاريع بأنها «بلا وثيقة مسجّلة». وأفاد صاحب الشركة
 * (١ أكتوبر ٢٠٢٦) أن الشركة **لا تُؤمّن على مشروعٍ إلا إن كان التنفيذ
 * بعمّالها**، وأن التنفيذ كلَّه بمقاولين بعقود، فالوثيقة على المنفّذ.
 *
 * فكانت التنبيهات السبعة باطلةً كلُّها — والتنبيه الذي لا يُعمل به يُعلّم
 * قارئه أن يتخطّى التنبيهات كلَّها، فيضيع معها الصحيح.
 *
 * ولم تُسقط بالكلّية: قد يقع عملٌ ينفّذه عمّال الشركة فتعود الحاجة،
 * ويمضي عنها النظام صامتاً. فالمدار على **نصّ العقد**:
 *   • نصَّ على أن الوثيقة على منفّذه → ليس علينا منه شيء.
 *   • لم ينصّ → الوثيقة علينا في موقعه، ويُنبَّه عند كتابته.
 *
 * والذي يُخشى منه: أن يُعدّ العقدُ مغطّى بلا تأشير، فيصمت النظام عن
 * موقعٍ لا غطاء فيه.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { uninsuredContracts, projectInsurance } = await jiti.import(
  "../lib/notifications.ts"
);

const contract = (over) => ({
  id: over.contractNumber,
  contractNumber: over.contractNumber,
  name: "مقاول",
  project: "مشروع أ",
  counterpartyType: "مقاول",
  installments: [],
  ...over,
});

const project = (name, over = {}) => ({
  id: name,
  name,
  budget: 0,
  startDate: "2026-01-01",
  status: "نشط",
  ...over,
});

console.log("\nالصمت لا يُحسب تغطية:\n");

check(
  "عقدٌ لم يُؤشَّر له يُعدّ غيرَ مغطّى",
  uninsuredContracts([contract({ contractNumber: "1" })]).length === 1
);
check(
  "وتأشيرُه يُخرجه",
  uninsuredContracts([contract({ contractNumber: "1", contractorInsures: true })])
    .length === 0
);
check(
  "و«false» صراحةً كالصمت",
  uninsuredContracts([
    contract({ contractNumber: "1", contractorInsures: false }),
  ]).length === 1
);

console.log("\nوعقد العميل لا يدخل:\n");

check(
  "فذاك من يدفع لنا لا من ينفّذ",
  uninsuredContracts([
    contract({ contractNumber: "4001", counterpartyType: "عميل" }),
  ]).length === 0
);
check(
  "والمورّد يدخل — فعمّاله في الموقع",
  uninsuredContracts([
    contract({ contractNumber: "6", counterpartyType: "مورّد" }),
  ]).length === 1
);

console.log("\nولا يُنبَّه على موقعٍ كلُّ عقوده مغطّاة:\n");

const covered = [
  contract({ contractNumber: "1", contractorInsures: true }),
  contract({ contractNumber: "2", contractorInsures: true }),
];
check(
  "فلا صفَّ له",
  projectInsurance([project("مشروع أ")], "2026-10-01", covered).length === 0
);

const mixed = [
  contract({ contractNumber: "1", contractorInsures: true }),
  contract({ contractNumber: "2" }),
];
const rows = projectInsurance([project("مشروع أ")], "2026-10-01", mixed);
check("وعقدٌ واحدٌ غيرُ مغطّى يكفي للتنبيه", rows.length === 1);
check("وحالُه «غير مسجّل» ما دامت الوثيقة غائبة", rows[0]?.state === "غير مسجّل");

console.log("\nومن سجّل وثيقةً يُنبَّه قبل انقضائها:\n");

const soon = projectInsurance(
  [project("مشروع أ", { insuranceEnd: "2026-10-20" })],
  "2026-10-01",
  mixed
);
check("يقترب", soon[0]?.state === "يقترب", String(soon[0]?.daysLeft));
const gone = projectInsurance(
  [project("مشروع أ", { insuranceEnd: "2026-09-01" })],
  "2026-10-01",
  mixed
);
check("ومنتهٍ", gone[0]?.state === "منتهٍ");
const live = projectInsurance(
  [project("مشروع أ", { insuranceEnd: "2027-06-01" })],
  "2026-10-01",
  mixed
);
check("وسارٍ", live[0]?.state === "سارٍ");

console.log("\nوالمُقفل والوعاءان لا يُنبَّه إليهم:\n");
check(
  "مشروعٌ مُقفل",
  projectInsurance(
    [project("مشروع أ", { status: "مكتمل" })],
    "2026-10-01",
    mixed
  ).length === 0
);
check(
  "و«عام» و«مصروفات مشتركة»",
  projectInsurance(
    [project("عام"), project("مصروفات مشتركة")],
    "2026-10-01",
    [contract({ contractNumber: "1", project: "عام" })]
  ).length === 0
);

console.log("\nوالشاشة تقول ذلك عند كتابة العقد:\n");
const page = fs.readFileSync("app/page.tsx", "utf8");
check(
  "خانةٌ في شروط التنفيذ",
  page.includes("وثيقة التأمين على الطرف الثاني")
);
check("ولا تظهر في عقد العميل", page.includes('form.counterpartyType !== "عميل"'));
check(
  "وتُفرّق بين النصّ وتحمُّل المسؤولية",
  page.includes("لا مجرّد") && page.includes("يتحمّل مسؤولية إصابات عماله")
);
check(
  "وتُنبَّه عند عدم التأشير",
  page.includes("فوثيقة التأمين") && page.includes("على الشركة</u> في هذا الموقع")
);

/* ---- وعلى ملفّات الشركة ---- */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const d = JSON.parse(fs.readFileSync(BACKUP, "utf8")).data;
  const open = uninsuredContracts(d.contractors);
  const before = d.projects.filter(
    (p) =>
      (!p.status || p.status === "نشط") &&
      !["عام", "مصروفات مشتركة"].includes(p.name) &&
      !p.insuranceEnd
  );
  const after = projectInsurance(d.projects, "2026-10-01", d.contractors);

  console.log("\nوعلى دفاتر الشركة:\n");
  console.log(`     عقود منفّذين بلا نصّ تأمين: ${open.length} من ${d.contractors.filter((c) => c.counterpartyType !== "عميل").length}`);
  console.log(`     تنبيهات المشاريع قبل التغيير: ${before.length} · بعده: ${after.length}`);
  check(
    "ولم يُفقد تنبيهٌ عن موقعٍ فيه عقدٌ غيرُ مغطّى",
    after.length <= before.length
  );
}

console.log(
  bad === 0
    ? "\n✓ ما نُصّ عليه ليس علينا، وما سكت عنه يُنبَّه إليه"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
