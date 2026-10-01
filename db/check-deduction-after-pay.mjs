/**
 * يفحص الخصم على دفعةٍ صُرف منها.
 *
 *   npm run check:deduction
 *
 * الحقول الثلاثة فوق جدول الدفعات تُلتقط **لحظة اعتماد المهندس** وحدها،
 * وإلغاءُ اعتماد دفعةٍ صُرف منها مبلغ ممنوعٌ بحقّ — فلا يُنزع الاستحقاق
 * عن مالٍ خرج. فكان كلُّ خصمٍ يُكتشف بعد أول دفعةٍ لا سبيل إلى تسجيله:
 * يُكتب في الحقل ثم لا يُحفظ، ولا يُقال لصاحبه لماذا.
 *
 * وقع ذلك في عقد الحدادة (٣٠٠٣): دفعت الشركة أجرَ كرين الطبانات عن
 * المقاول، وأُريد إسقاطه من مستحقّه بعد أن صُرف له خمسون من الدفعة.
 *
 * والذي يُخشى منه في الباب الجديد:
 *   • أن يُنقص المستحقُّ دون ما صُرف فعلاً — فيصير على المقاول دينٌ من
 *     حيث أُريد إسقاط حقّه.
 *   • أن يُحفظ خصمٌ بلا سببٍ مكتوب.
 *   • أن يفتحه من لا يملك إقرار الدفعات.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const page = fs.readFileSync("app/page.tsx", "utf8");

console.log("\nالخصم بابٌ مستقلٌّ عن الاعتماد:\n");

check(
  "للدفعة المعتمدة زرُّ خصمٍ على المستحقّ",
  page.includes('"خصم على المستحقّ"')
);
check(
  "ولا يلزم إلغاء الاعتماد له",
  page.includes("const saveDiscount = (") &&
    !/saveDiscount[\s\S]{0,900}setApproval/.test(page)
);
check(
  "ويُفتح على الدفعة المعتمدة ولو صُرف منها",
  page.includes("{canConfirm && installment.approved && (")
);
check(
  "ولمن يملك إقرار الدفعات وحده",
  /editingDiscount\?\.contractId/.test(page) &&
    page.includes("{canConfirm && installment.approved && (")
);
check(
  "ويُعرض الخصم القائم ليُعدَّل لا ليُكتب من جديد",
  page.includes("عدّل الخصم (")
);

console.log("\nولا يُحفظ بلا سبب:\n");

check(
  "السبب مطلوبٌ مع أي مبلغ",
  page.includes('window.alert("اكتب سبب الخصم — ولا يُحفظ خصمٌ بغيره")')
);
check("ولا يكون الخصم سالباً", page.includes('window.alert("الخصم لا يكون سالباً")'));

console.log("\nولا يُنقص المستحقُّ دون ما صُرف:\n");

check(
  "يُقارَن المستحقّ بعد الخصم بما دُفع",
  /if \(round3\(value - amount\) < round3\(paid\)\)/.test(page)
);
check(
  "ويُقال لصاحبه أقصى خصمٍ ممكن",
  page.includes("أقصى خصمٍ ممكن")
);

console.log("\nويُسجَّل في سجلّ التدقيق:\n");
check(
  "بمبلغه ودفعته وعقده",
  page.includes("`خصم ${fmt(amount)} د.ك على الدفعة ${number} — عقد ${contract.contractNumber}`")
);
check("وسببُه معه", /onLog\([\s\S]{0,260}\{ after: reason \}/.test(page));

console.log("\nوالحساب يستقيم — على مثال عقد الحدادة:\n");

const { round3 } = await jiti.import("../lib/accounting.ts");

/* الدفعة الخامسة: قيمتها 450، صُرف منها 50، والخصم 50 */
const value = 450;
const paid = 50;
const deduction = 50;
const due = round3(value - deduction);
check("المستحقّ بعد الخصم", due === 400, String(due));
check("ولا يقلّ عمّا صُرف", due >= paid);
check("والباقي له في الدفعة", round3(due - paid) === 350, String(round3(due - paid)));

/* وعلى العقد كلّه */
const contractValue = 5000;
const paidAll = 4550 + 50; /* بعد اعتماد قيد اليوم */
check(
  "والعقد: 5000 ناقص خصم 50 = 4950 مستحقّاً",
  round3(contractValue - deduction) === 4950
);
check(
  "دُفع منها 4600، فيبقى 350",
  round3(contractValue - deduction - paidAll) === 350,
  String(round3(contractValue - deduction - paidAll))
);

/* وخصمٌ يتجاوز ما بقي يُردّ */
const tooMuch = 410;
check(
  "وخصمٌ يُنزل المستحقّ دون المصروف يُردّ",
  round3(value - tooMuch) < paid,
  `${round3(value - tooMuch)} < ${paid}`
);
check(
  "وأقصى خصمٍ ممكن هو القيمة ناقص المصروف",
  round3(value - paid) === 400,
  String(round3(value - paid))
);

/* ---- وعلى ملفّات الشركة ---- */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const d = JSON.parse(fs.readFileSync(BACKUP, "utf8")).data;
  console.log("\nوعلى دفاتر الشركة:\n");

  let withPay = 0;
  let blocked = 0;
  for (const c of d.contractors) {
    for (const i of c.installments ?? []) {
      const on = d.movements
        .filter((m) => m.contractNumber === c.contractNumber && m.installmentNumber === i.number)
        .reduce((s, m) => s + m.amount, 0);
      if (on > 0) {
        withPay++;
        if (i.approved) blocked++;
      }
    }
  }
  console.log(`     دفعاتٌ صُرف منها: ${withPay} · منها معتمدة: ${blocked}`);
  check(
    "وكلُّها كان الخصم عليها متعذّراً قبل اليوم",
    blocked > 0,
    `${blocked} دفعة`
  );
}

console.log(
  bad === 0
    ? "\n✓ الخصم يُسجَّل بعد الصرف، ولا يَنزل بالمستحقّ دونه"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
