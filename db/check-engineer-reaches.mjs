/**
 * يفحص أن عمل المهندس يصل الخادم — شهادةً وأثراً.
 *
 *   npm run check:engineer [نسخة.json]
 *
 * سأل صاحب الشركة: «المهندس نوح اعتمد لعبداللطيف النجار الدفعة الأخيرة
 * بخصم مئة دينار، ولم يظهر لي الاعتماد» ثم: «دخلتُ التدقيق ولم يظهر لي
 * أن نوحاً أدخل أي عملية». وقُرئ الخادم فإذا ثلاثةُ أعطالٍ منفصلة:
 *
 * **١. الشهادة تُردّ.** الكتابة في مجموعة العقود تطلب «إدارة
 * المقاولين»، والمهندس لا يملكها ولا يصحّ أن يملكها — لو ملكها لغيّر
 * قيمة العقد وشروطه. وإنما يملك «اعتماد إنجاز المراحل». فكان الصفُّ
 * يُردّ كلُّه: يعتمد في جهازه فتظهر الدفعة معتمدةً أمامه، ولا يصل
 * الخادمَ شيء. والعلاج تضييقُ ما يُكتب لا توسيعُ الإذن: يُقرأ الصفُّ
 * المحفوظ ويُؤخذ من الوارد حقولُ الشهادة وحدها.
 *
 * **٢. سجلّ التدقيق لا يصله منهم شيء.** من لا يقرأ مجموعةً فجهازُه لا
 * يرسلها — قاعدةٌ صحيحة في أصلها («ما لا تراه لا تملك نسخته»). لكنّ
 * السجلّ لا يُقرأ ليعرف كاتبُه عملَ نفسه، بل ليعرف صاحبُ الشركة عملَ
 * الناس. فكان في الخادم ٩٠٠ قيداً لصاحب الشركة وصفرٌ للمهندسين. ولا
 * خطر في الإضافة: السجلّ لا يُحذف منه شيء عند الخادم.
 *
 * **٣. الخصم يظهر على عقدٍ آخر.** خانتا الخصم وسببه كانتا حالةً واحدةً
 * للشاشة كلِّها، والخانات تُرسم داخل بطاقة كل عقد — فما يُكتب في
 * بطاقةٍ يظهر في البطاقات كلِّها، ويُطبَّق على أيِّ دفعةٍ تُعتمد بعده
 * أيّاً كان عقدُها. وهو مالٌ يُحسم من مستحقّ رجل.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { mergeCertification } = await jiti.import("../lib/server/certify.ts");

const APPROVAL = [
  "approved",
  "approvedBy",
  "approvedAt",
  "approvalNote",
  "deduction",
  "deductionReason",
];

const stored = {
  id: "c1",
  contractNumber: "3003",
  name: "عبداللطيف أحمد عبداللطيف حسوب",
  contractValue: 5000,
  installments: [
    { number: 1, value: "200", condition: "أعمدة الأرضي", approved: true },
    { number: 2, value: "450", condition: "فك الطبانات" },
  ],
};

console.log("\nالشهادة تمرّ، والكتابة لا:\n");

const sent = {
  id: "c1",
  contractNumber: "9999",
  name: "اسمٌ آخر",
  contractValue: 1,
  installments: [
    { number: 1, value: "200", condition: "أعمدة الأرضي", approved: true },
    {
      number: 2,
      value: "999999",
      condition: "شرطٌ غُيّر",
      approved: true,
      approvedBy: "نوح احمد ابراهيم",
      approvedAt: "2026-10-08T07:00:00.000Z",
      deduction: "100",
      deductionReason: "تأخير",
    },
  ],
};
const merged = mergeCertification(stored, sent, APPROVAL);

check("الاعتماد يُكتب", merged?.installments[1].approved === true);
check("ومعه اسم من اعتمد", merged?.installments[1].approvedBy === "نوح احمد ابراهيم");
check("والخصم وسببه", merged?.installments[1].deduction === "100" && merged?.installments[1].deductionReason === "تأخير");

console.log("\nوما سوى الشهادة يبقى كما عند الخادم:\n");
check("قيمة العقد لا تُمسّ", merged?.contractValue === 5000);
check("ورقمه", merged?.contractNumber === "3003");
check("واسم صاحبه", merged?.name === "عبداللطيف أحمد عبداللطيف حسوب");
check("وقيمة الدفعة", merged?.installments[1].value === "450");
check("وشرطها", merged?.installments[1].condition === "فك الطبانات");

console.log("\nولا يُكتب صفٌّ بلا سبب:\n");
check(
  "إرسالٌ لا شهادة فيه لا يُكتب",
  mergeCertification(stored, { id: "c1", installments: [{ number: 2, value: "9" }] }, APPROVAL) ===
    null,
  "وإلا رُفع رقم التغيير فأُوقظت الأجهزة بلا فائدة"
);
check(
  "وعقدٌ بلا دفعاتٍ محفوظة لا شهادة عليه",
  mergeCertification({ id: "c1", installments: [] }, sent, APPROVAL) === null
);
check(
  "ودفعةٌ لا نظير لها عند الخادم تُهمل",
  (() => {
    const r = mergeCertification(
      stored,
      { id: "c1", installments: [{ number: 99, approved: true }] },
      APPROVAL
    );
    return r === null;
  })(),
  "فلا يُنشئ المهندس دفعةً"
);

console.log("\nوالإقرار لمن يملكه وحده:\n");
const onlyApprove = mergeCertification(
  stored,
  {
    id: "c1",
    installments: [{ number: 2, approved: true, confirmed: true, confirmedBy: "نوح" }],
  },
  APPROVAL
);
check("من يملك الاعتماد لا يُقرّ", onlyApprove?.installments[1].confirmed === undefined);

console.log("\nوالخادم يُمرّرها دون توسيع الإذن:\n");
const route = fs.readFileSync("app/api/data/route.ts", "utf8");
check("مسار الكتابة يعرف الشهادة", /certifyOnly/.test(route));
check(
  "ولا يُمرّرها إلا لمن يملك اعتماداً أو إقراراً",
  /user\.permissions\.includes\("contracts\.approve"\)/.test(route) &&
    /user\.permissions\.includes\("contracts\.confirm"\)/.test(route)
);
check(
  "ولا يُقال لصاحبها إنها رُدّت وقد كُتبت",
  /result\.certified > 0/.test(route),
  "وإلا ظنّ عملَه ضائعاً"
);
const permits = fs.readFileSync("lib/server/permits.ts", "utf8");
check(
  "وقاعدة العقود على حالها — الإذن لم يُوسَّع",
  /contractors: \{\s+write: \["contractors\.manage"\]/.test(permits)
);

console.log("\nوأثرُ العمل يبلغ السجلّ ولو حُجب عن صاحبه:\n");
const sync = fs.readFileSync("lib/sync.ts", "utf8");
check(
  "ما يُضاف إلى التدقيق يُرسل",
  /const sendsAnyway = \(part: string, field: string\) =>\s+part === "upserts" && field === "audit";/.test(
    sync
  )
);
check(
  "والحذف منه لا يُرسل",
  /if \(hidden\.has\(field\) && !sendsAnyway\(part, field\)\)/.test(sync)
);
check(
  "والخادم يردّ الحذف منه على الجميع",
  /const NEVER_DELETED = new Set\(\["audit"\]\);/.test(permits)
);

console.log("\nوالخصم لا يتعدّى عقدَه:\n");
const page = fs.readFileSync("app/page.tsx", "utf8");
check(
  "خانة الخصم لكل عقدٍ على حدة",
  /const \[deductionBy, setDeductionBy\] = useState<Record<string, string>>\(\{\}\);/.test(
    page
  ) && /value=\{deductionBy\[contract\.id\] \?\? ""\}/.test(page)
);
check(
  "وسببُه كذلك",
  /value=\{reasonBy\[contract\.id\] \?\? ""\}/.test(page)
);
check(
  "وملاحظة الاعتماد كذلك",
  /value=\{noteBy\[contract\.id\] \?\? ""\}/.test(page)
);
check(
  "والاعتماد يقرأ خانات عقده هو",
  /const deduction = deductionBy\[contractId\] \?\? "";/.test(page)
);
check(
  "ويُمسح بعده ما لهذا العقد وحده",
  /const clear = \(prev: Record<string, string>\) => \{\s+const next = \{ \.\.\.prev \};\s+delete next\[contractId\];/.test(
    page
  )
);

/* ---- وعلى دفاتر الشركة ---- */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const d = JSON.parse(fs.readFileSync(BACKUP, "utf8")).data;
  const actors = {};
  /* الحقل «user» في النسخة و«actor» في عمود الخادم */
  for (const e of d.audit ?? []) {
    const who = e.user ?? e.actor ?? "بلا اسم";
    actors[who] = (actors[who] ?? 0) + 1;
  }
  console.log("\nوسجلّ التدقيق في النسخة بأصحابه:\n");
  for (const [who, n] of Object.entries(actors).sort((a, b) => b[1] - a[1]))
    console.log(`     ${String(n).padStart(5)} · ${who}`);
  const silent = (d.users ?? []).filter(
    (u) => u.active !== false && !actors[u.name] && !(u.permissions ?? []).includes("audit.view")
  );
  console.log(
    `     ومن لا أثر له ولا يقرأ السجلّ: ${
      silent.map((u) => u.name).join(" · ") || "لا أحد"
    }`
  );
  console.log("     وبعد هذا الإصلاح يُكتب عملُهم باسمهم — وما مضى لا يُستردّ");
}

console.log(
  bad === 0
    ? "\n✓ المهندس يشهد فتصل شهادتُه، ويُكتب أثرُه، ولا يتعدّى خصمُه عقدَه"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
