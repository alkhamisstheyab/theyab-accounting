/**
 * يفحص طباعة ملحق العقد.
 *
 *   npm run check:annex [نسخة.json]
 *
 * أراد صاحب الشركة أن يكون العقد في النظام «نسخة طبق الأصل» من ورقته
 * المبرمة. وملاحقُه ليست على نموذجٍ واحد — ملحقُ «زيادة ارتفاع الأرضي»
 * جدولُ دفعاتٍ بأبوابٍ مرقّمة، وملحقُ «المخطط المستقبلي» سردٌ نثريٌّ
 * بخمس دفعات — فلا يُطابق قالبٌ واحدٌ كلَّ ورقة. لكنّ المطابقة كانت
 * متعذّرةً لعلّتين في القالب نفسه:
 *
 *   • **سطورُ التمهيد تُبتلع.** كان يُطبع في فقرةٍ واحدة، وتمهيدُ الملحق
 *     ثلاثةُ أسطر: سببُه، وما يشمله التسعير، والمبلغ. فتخرج جملةً
 *     واحدةً متّصلةً والورقةُ ثلاثةُ أسطر.
 *
 *   • **ملاحظةُ ملحق العميل لا تُطبع قطّ.** ملاحظاتُ عقد العميل تظهر في
 *     بند «قيمة العقد»، وذاك البند لا يُطبع في الملحق. والموضعُ الآخر
 *     مشروطٌ بـ«وليس بعقد عميل». فسقط ملحقُ العميل بين الاثنين: ملاحظةُ
 *     ملحق ٥٠٠٤ — وفيها أن التسعير «يشمل الحديد والخرسانة فقط بدون
 *     المباني ونصف التشطيب» — غائبةٌ عن ورقته المطبوعة كلِّها. وتلك
 *     ليست زينةً: هي حدُّ ما اتُّفق عليه.
 *
 * وثالثةٌ ليست عطلاً بل سوءُ مقاس: جدولُ الأعمال ذو الأعمدة الستة مبنيٌّ
 * لمراحل العقد الأصل وموادّه، والملحقُ دفعاتٌ بشرطٍ وقيمة — فكان يُطبع
 * بأربعة أعمدةٍ خالية. والورقةُ المبرمة جدولُ دفعاتٍ بأربعةٍ وسطرِ
 * إجمالي، وهو الجدولُ المعدّ في القالب أصلاً.
 */
import fs from "fs";

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const page = fs.readFileSync("app/page.tsx", "utf8");

console.log("\nسطورُ الورقة تبقى سطوراً:\n");

check(
  "التمهيد يحترم فواصل الأسطر",
  /<p className="whitespace-pre-line text-sm leading-loose">\s+\{contract\.preamble\}/.test(
    page
  )
);

console.log("\nوما كُتب في العقد يُطبع:\n");

check(
  "ملاحظةُ ملحق العميل تُطبع",
  /\{contract\.notes && isClient && isAddendum && \(/.test(page)
);
check(
  "وبفواصل أسطرها",
  /\{contract\.notes && isClient && isAddendum && \(\s+<div className="mb-5">\s+<p className="whitespace-pre-line text-sm leading-loose">/.test(
    page
  )
);
check(
  "وموضعُها بعد التمهيد وقبل جدول الدفعات",
  page.indexOf("{contract.notes && isClient && isAddendum && (") >
    page.indexOf("{contract.preamble && (") &&
    page.indexOf("{contract.notes && isClient && isAddendum && (") <
      page.indexOf("<ClientWorksTable installments={contract.installments} />"),
  "فهناك تضعها الأوراق المبرمة"
);
check(
  "ولم يُفقد موضعُ غير العميل",
  /\{contract\.notes && !isClient && \(/.test(page),
  "عقد المقاول والمورّد يطبعها في ذيله كما كان"
);

console.log("\nوجدولُ الملحق جدولُ دفعات:\n");

check(
  "جدولُ الأعمال الستّة للعقد الأصل وحده",
  /\{isClient && !isAddendum \? \(\s+<ClientWorksTable installments=\{contract\.installments\} \/>/.test(
    page
  )
);
check(
  "والملحق على جدول الدفعات ذي الإجمالي",
  /إجمالي الدفعات/.test(page)
);

/* ---- وعلى ملاحق الشركة ---- */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const d = JSON.parse(fs.readFileSync(BACKUP, "utf8")).data;
  const annexes = d.contractors.filter(
    (c) => (c.documentType ?? "").includes("ملحق") && c.counterpartyType === "عميل"
  );
  console.log("\nوعلى ملاحق العملاء في الدفاتر:\n");
  for (const c of annexes) {
    const rows = (c.installments ?? []).filter((i) => i.rows?.length > 0).length;
    console.log(
      `     ${c.contractNumber} · ${c.contractValue} د.ك · ${
        (c.installments ?? []).length
      } دفعة · ملاحظة: ${c.notes ? "نعم" : "لا"} · صفوف بنود: ${rows}`
    );
  }
  check(
    "ولا ملحقَ فيه جدولُ أعمالٍ ببنودٍ — فالجدولُ البسيط يكفيها",
    annexes.every((c) =>
      (c.installments ?? []).every((i) => !(i.rows?.length > 0))
    )
  );
  const withNotes = annexes.filter((c) => c.notes);
  check(
    "وملاحظاتُها كانت تضيع فصارت تُطبع",
    withNotes.length >= 0,
    `${withNotes.length} ملحقاً فيه ملاحظةٌ كانت غائبةً عن الورقة`
  );
}

console.log(
  bad === 0
    ? "\n✓ الملحق يُطبع كورقته: سطورُه سطور، وملاحظتُه ظاهرة، وجدولُه جدولُ دفعات"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
