/**
 * يفحص إقفال العقد بالتراضي.
 *
 *   npm run check:terminate [نسخة.json]
 *
 * العقد يُنهى قبل تمامه، فتبقى دفعاتٌ لم تُنفَّذ ولا تُدفع. والشاشة لا
 * تقبل خصماً إلا على دفعةٍ **معتمدة**، والاعتماد شهادةٌ بإنجازٍ وقع — فمن
 * اعتمد دفعةً لم تُنفَّذ ليُسقطها كذَب في الدفتر ليُصلح رقماً.
 *
 * ووقع ذلك في عقدَي م. عبدالعزيز العمر على بوعباس (٥٠٠٥ و٥٠٠٦): أُنهيا
 * باتفاقٍ موقَّع في ٠٣/٠٩/٢٠٢٦، وعشرٌ من إحدى عشرة دفعةً غيرُ معتمدة —
 * ومنها دفعتا الطابوق اللتان لم تُنفَّذا، وهما سببُ الإنهاء نفسه.
 *
 * والذي يُخشى منه في الباب الجديد:
 *   • أن يُنقص المستحقُّ دون ما صُرف، فيصير على المقاول دينٌ من حيث أُريد
 *     إسقاط حقّه.
 *   • أن يُقفل عقدٌ بلا سببٍ مكتوب.
 *   • أن يُشهد بإنجازٍ لم يقع — وهو ما بُني الباب لتفاديه.
 */
import fs from "fs";

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const page = fs.readFileSync("app/page.tsx", "utf8");

console.log("\nبابٌ ثالث لا يمرّ بالاعتماد:\n");

check("للعقد زرُّ إقفالٍ بالتراضي", page.includes("أقفل العقد بالتراضي"));
check("ودالّةٌ له", page.includes("const terminateContract = (contract: Contractor)"));

const fn = page.slice(
  page.indexOf("const terminateContract ="),
  page.indexOf("const saveDiscount =")
);
check(
  "ولا يمسّ الاعتماد ولا الإقرار",
  !/approved|confirmed/.test(fn),
  "فلا يُشهد بإنجازٍ لم يقع"
);
check("ويكتب الخصم وسببه وحدهما", /deduction:/.test(fn) && /deductionReason:/.test(fn));
  /* الصفحة بنهايات CRLF، فالمطابقة بتعبيرٍ يتسامح في فواصل الأسطر */
check(
  "ولمن يملك إقرار الدفعات",
  /\{canConfirm && \(\s+<div className="mb-4 rounded-xl border border-slate-300/.test(
    page
  )
);

console.log("\nولا يُقفل بلا سببٍ مكتوب:\n");
check(
  "يُطالَب بالسبب",
  fn.includes('window.alert("اكتب سبب الإنهاء — ولا يُقفل عقدٌ بغيره")')
);
check("ويُلغى بالإلغاء", fn.includes("if (reason === null) return;"));
check(
  "ويُقال له كم يُسقط وعلى كم دفعة",
  fn.includes("يسقط") && fn.includes("دفعة")
);

console.log("\nولا يَنزل بالمستحقّ دون ما صُرف:\n");
check(
  "الخصم هو الباقي بعد المصروف وبعد خصمٍ سابق",
  /\(Number\(i\.value\) \|\| 0\) - \(Number\(i\.deduction\) \|\| 0\) - paid/.test(fn)
);
check("وما لا باقيَ فيه لا يُمسّ", fn.includes("if (short <= 0) return i;"));
check(
  "ويُضمّ إلى خصمٍ سابقٍ لا يَمحوه",
  fn.includes("const already = Number(i.deduction) || 0;")
);
check(
  "وعقدٌ لا باقيَ فيه يُردّ",
  fn.includes('window.alert("لا باقيَ في هذا العقد — فهو مُقفلٌ أصلاً")')
);

console.log("\nويُسجَّل في سجلّ التدقيق:\n");
check("بمبلغه ورقم عقده", fn.includes("إقفال عقد ${contract.contractNumber} بالتراضي"));
check("وسببُه معه", /\{ after: reason\.trim\(\) \}/.test(fn));

/* ---- الحساب على عقدَي عبدالعزيز ---- */
console.log("\nوالحساب على عقدَي بوعباس:\n");

const five = [
  [1, 500, 500], [2, 750, 550], [3, 750, 0], [4, 2375, 2000],
  [5, 2375, 2075], [6, 2375, 2150], [7, 500, 0], [8, 1875, 0],
];
const six = [[1, 700, 0], [2, 400, 330], [3, 400, 0], [4, 350, 0]];
const drop = (rows) =>
  rows.reduce((s, [, value, paid]) => s + Math.max(value - paid, 0), 0);
const paidSum = (rows) => rows.reduce((s, [, , paid]) => s + paid, 0);

check("5005 يُسقط 4,225", drop(five) === 4225, String(drop(five)));
check("ويُقفل على المصروف 7,275", paidSum(five) === 7275, String(paidSum(five)));
check("5006 يُسقط 1,520", drop(six) === 1520, String(drop(six)));
check("ويُقفل على 330", paidSum(six) === 330, String(paidSum(six)));

const paidAll = paidSum(five) + paidSum(six);
check(
  "فجملةُ ما صُرف له 7,605",
  paidAll === 7605,
  String(paidAll)
);
check(
  "ومعه تسوية 2,301 يصير 9,906",
  paidAll + 2301 === 9906,
  String(paidAll + 2301)
);
check(
  "من عقدين قيمتهما 13,350 — فيسقط 3,444",
  13350 - 9906 === 3444,
  String(13350 - 9906)
);
check(
  "وهو مجموع ما أُسقط ناقصَ التسوية",
  drop(five) + drop(six) - 2301 === 3444,
  String(drop(five) + drop(six) - 2301)
);

/* ---- وعلى ملفّات الشركة ---- */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const d = JSON.parse(fs.readFileSync(BACKUP, "utf8")).data;
  console.log("\nوعلى دفاتر الشركة:\n");
  let blocked = 0;
  for (const c of d.contractors) {
    for (const i of c.installments ?? []) {
      const paid = d.movements
        .filter(
          (m) => m.contractNumber === c.contractNumber && m.installmentNumber === i.number
        )
        .reduce((s, m) => s + m.amount, 0);
      const short = (Number(i.value) || 0) - (Number(i.deduction) || 0) - paid;
      if (short > 0 && !i.approved) blocked++;
    }
  }
  check(
    "دفعاتٌ فيها باقٍ ولا اعتماد — كان إسقاطها متعذّراً",
    blocked > 0,
    `${blocked} دفعة`
  );
}

console.log(
  bad === 0
    ? "\n✓ يُقفل العقد بلا شهادةٍ كاذبة، ولا يَنزل بالمستحقّ دون المصروف"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
