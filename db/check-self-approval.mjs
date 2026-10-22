/**
 * يفحص أنّ من أدخل حركةً لا يعتمدها، وأنّ من يعتمد ولا يُدخل يصل اعتمادُه.
 *
 *   npm run check:self-approval
 *
 * طلبه صاحب الشركة في ٢٢ أكتوبر ٢٠٢٦ وهو يمنح م. ميس «اعتماد
 * الحركات»: وعندها «تسجيل المستحقات»، فلو جمعت الاثنين أثبتت مستحقّاً
 * واعتمدته في دقيقةٍ بلا مرورٍ على أحد — فينتقض أصلُ النظام: «أن يمرّ
 * على كلِّ دينارٍ عينان لا عينٌ واحدة».
 *
 * ومسألتان تُفحصان:
 *
 *   • **الحارس**: من أدخل لا يعتمد — ويُعرف المُدخِلُ من سجلّ التدقيق
 *     لا من الصفّ، فالصفُّ لا يحمل اسمَه والسجلُّ يحمله منذ أوّل يوم.
 *     ويُستثنى صاحبُ الشركة والمديرُ العام، فلو مُنعا توقّف العملُ.
 *
 *   • **المرور**: من أُعطي الاعتمادَ وحدَه كانت كتابتُه تُردّ — فالكتابةُ
 *     في الحركات تطلب «إدخال» أو «تعديل». فيُؤخذ من الوارد اعتمادُه
 *     وحدَه، ويبقى ما سواه كما هو عند الخادم. وهي علّةُ شهادة المهندس
 *     نفسُها، وعلاجُها على قياسها.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createJiti } from "jiti";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const jiti = createJiti(import.meta.url);
const {
  enteredBy,
  enteredByMap,
  canApproveMovement,
  mayApproveOwn,
  selfApprovalBlock,
} = await jiti.import("../lib/approval.ts");
const { mergeApproval } = await jiti.import("../lib/server/approve.ts");

const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");
const route = fs.readFileSync(path.join(ROOT, "app/api/data/route.ts"), "utf8");

/* ---- أداةُ البناء ---- */
const entry = (over = {}) => ({
  id: "a1",
  at: "2026-10-21T10:00:00.000Z",
  user: "ميس فخرالدين",
  action: "إنشاء",
  entity: "حركة",
  summary: "حركة جديدة",
  after: "قيد 1990 · 2026-10-21 · 60.000 د.ك · مدين 5120 / دائن 2140",
  ...over,
});

const movement = { entryNo: 1990, date: "2026-10-21" };

console.log("\nمن أدخلها يُعرف من سجلّ التدقيق:\n");

check(
  "يُقرأ الرقمُ من «بعد»",
  enteredBy([entry()], movement) === "ميس فخرالدين",
  enteredBy([entry()], movement)
);
check(
  "ويُقرأ من الملخّص كذلك",
  enteredBy(
    [entry({ summary: "قيد 1990 · 2026-10-21 · مصروف", after: "" })],
    movement
  ) === "ميس فخرالدين",
  "فملخّصُ الإدخال يحمله وملخّصُ السداد لا يحمله"
);
check(
  "وأوّلُ إنشاءٍ هو الإدخال",
  enteredBy(
    [
      entry({ id: "b", at: "2026-10-21T12:00:00.000Z", user: "مصطفى" }),
      entry({ id: "a", at: "2026-10-21T09:00:00.000Z", user: "ميس فخرالدين" }),
    ],
    movement
  ) === "ميس فخرالدين",
  "فمن حُذف قيدُه وأُعيد له سطرا إنشاء"
);
check(
  "ولا يُخلط قيدٌ بقيد",
  enteredBy([entry()], { entryNo: 1991, date: "2026-10-21" }) === "",
  "فالرقمُ واليومُ مفتاحٌ واحد"
);
check(
  "ولا يُخلط يومٌ بيوم",
  enteredBy([entry()], { entryNo: 1990, date: "2026-10-22" }) === ""
);
check(
  "ولا تُعدّ غيرُ الحركات",
  enteredBy([entry({ entity: "عقد" })], movement) === ""
);
check(
  "ولا يُعدّ التعديلُ إدخالاً",
  enteredBy([entry({ action: "تعديل" })], movement) === "",
  "فمن صحّح حركةً لم يُدخلها"
);
check(
  "ومن لا سجلَّ له لا يُعرف",
  enteredBy([], movement) === "",
  "وقيودٌ مستوردةٌ كذلك"
);

console.log("\nوالحارس:\n");

check(
  "من أدخلها لا يعتمدها",
  selfApprovalBlock("ميس فخرالدين", "ميس فخرالدين", "custom") ===
    "أدخلتَها أنت — يعتمدها غيرُك",
  selfApprovalBlock("ميس فخرالدين", "ميس فخرالدين", "custom")
);
check(
  "وغيرُها يعتمدها",
  selfApprovalBlock("ميس فخرالدين", "ذياب الخميس", "custom") === ""
);
check(
  "وصاحبُ الشركة يعتمد ما أدخله",
  selfApprovalBlock("سامي الأسد", "سامي الأسد", "owner") === "",
  "فلو مُنع توقّف العملُ كلُّه"
);
check(
  "والمديرُ العام كذلك",
  selfApprovalBlock("ذياب الخميس", "ذياب الخميس", "manager") === ""
);
check("والمهندسُ لا يُستثنى", mayApproveOwn("engineer") === false);
check("ولا السكرتير", mayApproveOwn("secretary") === false);
check("ولا المخصَّص", mayApproveOwn("custom") === false);
check(
  "وما لا يُعرف مُدخِلُه لا يُمنع",
  selfApprovalBlock("", "ميس فخرالدين", "custom") === "",
  "فالمنعُ على ظنٍّ أسوأُ من إذنٍ على جهل"
);
check(
  "والفراغاتُ لا تصنع شخصين",
  selfApprovalBlock("  ميس فخرالدين ", "ميس فخرالدين", "custom") !== "",
  "فاسمٌ بفراغٍ زائدٍ هو هو"
);

const entrants = enteredByMap([entry()]);
check(
  "والحكمُ على الحركة يُجمع بينهما",
  canApproveMovement(movement, "ميس فخرالدين", "custom", entrants) !== "" &&
    canApproveMovement(movement, "ذياب الخميس", "custom", entrants) === ""
);

console.log("\nوالاعتمادُ وحدَه يُكتب، لا ما سواه:\n");

const stored = {
  id: "m1",
  entryNo: 1990,
  date: "2026-10-21",
  amount: 60,
  debitCode: "5120",
  description: "ثلاثُ يوميات",
  approval: "بانتظار الاعتماد",
  approvedBy: "",
  approvedAt: "",
  approvalNote: "",
};

const tampered = {
  ...stored,
  amount: 6000,
  debitCode: "6290",
  description: "مبلغٌ آخر",
  approval: "معتمدة",
  approvedBy: "ميس فخرالدين",
  approvedAt: "2026-10-22T08:00:00.000Z",
};

const merged = mergeApproval(stored, tampered);
check("الاعتمادُ يُكتب", merged?.approval === "معتمدة");
check("واسمُ من اعتمد", merged?.approvedBy === "ميس فخرالدين");
check(
  "والمبلغُ لا يُمسّ",
  merged?.amount === 60,
  `${merged?.amount} — ولو أرسل الجهازُ غيرَه`
);
check("والحسابُ لا يُمسّ", merged?.debitCode === "5120");
check("والبيانُ لا يُمسّ", merged?.description === "ثلاثُ يوميات");
check(
  "وما لم يتغيّر لا يُكتب",
  mergeApproval(stored, { ...stored }) === null,
  "فلا يُرفع رقمُ التغيير فتُوقَظ الأجهزةُ بلا فائدة"
);
check(
  "والرفضُ يمرّ كالاعتماد",
  mergeApproval(stored, { ...stored, approval: "مرفوضة" })?.approval ===
    "مرفوضة"
);

console.log("\nوفي الخادم والشاشة:\n");

check(
  "الخادمُ يأخذ الاعتمادَ إن رُدّت الكتابة",
  /const approving =\s*\n\s*refused\.some\(\(r\) => r\.field === "movements"\) &&\s*\n\s*user\.permissions\.includes\("movements\.approve"\)/.test(
    route
  ),
  "وهي علّةُ شهادة المهندس نفسُها"
);
check(
  "ويُنادى approveOnly بدوره واسمه",
  /approveOnly\(db, sent, user\.permissions, \{[\s\S]{0,60}name: user\.name,[\s\S]{0,40}role: user\.role,/.test(
    route
  )
);
check(
  "وما مُنع يُقال لصاحبه بقيده",
  /قيد \$\{row\.entryNo\}: \$\{row\.reason\}/.test(route),
  "فلا يحسبه معتمداً عنده"
);
check(
  "وما مرّ لا يُقال إنّه رُدّ",
  /if \(result\.approved > 0\) \{\s*\n\s*told = told\.filter\(\(r\) => r\.field !== "movements"\);/.test(
    route
  )
);
check(
  "والشاشةُ تُقال له قبل أن يضغط",
  /const blockOf = \(movement: Movement\) =>/.test(page) &&
    /canApproveMovement\(movement, approverName, approverRole, entrants\)/.test(
      page
    )
);
check(
  "وزرُّ الاعتماد يُستبدل بالسبب",
  /\{blockOf\(m\) \? \(/.test(page),
  "فلا يُضغط زرٌّ يُردّ"
);
check(
  "والرفضُ لا يُمنع",
  /if \(state === "معتمدة"\) \{/.test(page),
  "فمن أدخلها يرفض ما أدخله ويصحّحه"
);
check(
  "ويُحسب المُدخِلون مرّةً لا لكلِّ صفّ",
  /useMemo\(\(\) => enteredByMap\(audit\), \[audit\]\)/.test(page)
);

console.log(
  bad === 0
    ? "\n✓ من أدخل حركةً لا يعتمدها، ومن يعتمد ولا يُدخل يصل اعتمادُه"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
