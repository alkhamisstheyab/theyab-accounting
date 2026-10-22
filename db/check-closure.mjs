/**
 * يفحص إنهاءَ العقود وبراءةَ الذمّة.
 *
 *   npm run check:closure [نسخة.json]
 *
 * وحالُ العقد كان مشتقّاً من دفعاته: «مُنتهٍ مالياً» إن لم يبقَ
 * مستحقّ. وذاك يصلح للقراءة ولا يصلح للإنهاء — فعقدٌ فُسخ بعد نصفه
 * ليس «منتهياً» ولا «جارياً»، وعقدٌ أُنهي بالتراضي على أقلَّ من قيمته
 * لا يُعرف من حسابه أنه أُنهي.
 *
 * وشرطان لا يُستغنى عنهما:
 *
 *   • **«الإنجاز» لا يصحّ وفي الذمّة مال.** فهو دعوى تمامِ العمل
 *     ووفاءِ المال، ومن ادّعاها وفي الذمّة مالٌ أثبت في دفاتره خبرين
 *     متناقضين، فلا يُعرف بعد سنةٍ أيُّهما الصحيح.
 *
 *   • **لا براءةَ ذمّةٍ وفي الذمّة مال.** فهي إقرارٌ بأن لا حقَّ
 *     لأحدٍ على الآخر — ومن أصدرها وفي الذمّة مالٌ أصدر إقراراً
 *     كاذباً يُحتجّ به عليه، ولا يُستدرك بعد التوقيع.
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
const c = await jiti.import("../lib/closure.ts");
const { normalizeState } = await jiti.import("../lib/storage.ts");
const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");
const lib = fs.readFileSync(path.join(ROOT, "lib/closure.ts"), "utf8");

const settled = { remaining: 0, paidUnapproved: 0, unwritten: false, valued: 1000 };

/* ------------------------------------------------------------------ */
console.log("\nالأوجهُ ثلاثة:\n");

check(
  "إنجازٌ وتراضٍ وفسخ",
  c.CLOSURE_KINDS.join(" · ") === "إنجاز · تراضٍ · فسخ",
  c.CLOSURE_KINDS.join(" · ")
);
check(
  "ولكلٍّ وصفُه",
  c.closureLabel({ kind: "فسخ" }) === "مفسوخ" &&
    c.closureLabel({ kind: "تراضٍ" }) === "أُنهي بالتراضي" &&
    c.closureLabel({ kind: "إنجاز" }) === "أُنهي بالإنجاز"
);
check("وبلا إنهاءٍ لا وصف", c.closureLabel(undefined) === null);

/* ------------------------------------------------------------------ */
console.log("\nو«الإنجاز» لا يصحّ وفي الذمّة مال:\n");

const owing = { ...settled, remaining: 5000 };
const done = c.canClose("إنجاز", owing, 10000);
check("يُمنع منعاً", !done.allowed, done.blocking[0]?.slice(0, 60));
check(
  "ويُقال له أيُّ وجهٍ يصلح",
  done.blocking[0].includes("تراضٍ") && done.blocking[0].includes("فسخ"),
  "فلا يُترك واقفاً بلا طريق"
);
check(
  "والتراضي يصحّ وفيه باقٍ",
  c.canClose("تراضٍ", owing, 10000).allowed,
  "فذاك بعينه موضعُه"
);
check("والفسخُ كذلك", c.canClose("فسخ", owing, 10000).allowed);
check(
  "والإنجازُ يصحّ إن بَرئ المال",
  c.canClose("إنجاز", settled, 1000).allowed
);
check(
  "وعقدٌ لم يُكتب جدولُه لا يُقال إنه أُنجز",
  !c.canClose("إنجاز", { ...settled, unwritten: true }, 0).allowed,
  "فلا يُقال انتهى وهو لم يبدأ"
);
check(
  "وجدولٌ ناقصٌ عن القيمة يُقال",
  c
    .canClose("إنجاز", { ...settled, valued: 600 }, 1000)
    .warnings.some((w) => w.includes("الجدولُ لم يُستوفَ")),
  "ولا يُمنع — فقد يكون الباقي ملحقاً"
);
check(
  "وزيادةُ المدفوع تُقال",
  c
    .canClose("إنجاز", { ...settled, remaining: -150 }, 1000)
    .warnings.some((w) => w.includes("زاد المدفوع")),
  "فتُراجع قبل الإقفال"
);
check(
  "ودفعاتٌ دخلها مالٌ بلا شهادةٍ تُقال",
  c
    .canClose("تراضٍ", { ...settled, paidUnapproved: 2800 }, 1000)
    .warnings.some((w) => w.includes("لم يشهد المهندس")),
  "فهي حالُ العجمي بعينها"
);
check(
  "ومن لا باقيَ له يُسأل: ألعلّه إنجاز؟",
  c
    .canClose("فسخ", settled, 1000)
    .warnings.some((w) => w.includes("ولعلّ وجهَه «إنجاز»"))
);

/* ------------------------------------------------------------------ */
console.log("\nولا براءةَ ذمّةٍ وفي الذمّة مال:\n");

const closure = {
  kind: "إنجاز",
  date: "2026-10-20",
  reason: "تمَّ العملُ وسُلّم",
  note: "",
  by: "ذياب",
  at: "2026-10-20T08:00:00.000Z",
};

check(
  "ولا تُصدَر قبل الإنهاء",
  !c.canIssueQuittance(undefined, { remaining: 0 }).allowed,
  c.canIssueQuittance(undefined, { remaining: 0 }).blocking[0]?.slice(0, 50)
);
check(
  "ولا تُصدَر وفي الذمّة مال",
  !c.canIssueQuittance(closure, { remaining: 1200 }).allowed,
  c.canIssueQuittance(closure, { remaining: 1200 }).blocking[0]?.slice(0, 64)
);
check(
  "وتُصدَر إن بَرئ المال بعد الإنهاء",
  c.canIssueQuittance(closure, { remaining: 0 }).allowed
);
check(
  "وزيادةُ المدفوع تُقال ولا تمنع",
  c.canIssueQuittance(closure, { remaining: -100 }).allowed &&
    c
      .canIssueQuittance(closure, { remaining: -100 })
      .warnings.some((w) => w.includes("لا تطالبه به")),
  "فالبراءةُ تُقرّ بأنك لا تطالبه بالزيادة"
);
check(
  "وتراضٍ بلا مبلغِ تسويةٍ يُقال",
  c
    .canIssueQuittance({ ...closure, kind: "تراضٍ" }, { remaining: 0 })
    .warnings.some((w) => w.includes("مبلغُ التسوية")),
  "فبراءةٌ بلا سندٍ تُسوّى به"
);
check(
  "وبراءةٌ ثانيةٌ تُقال",
  c
    .canIssueQuittance(
      { ...closure, quittanceAt: "2026-10-01T00:00:00.000Z" },
      { remaining: 0 }
    )
    .warnings.some((w) => w.includes("صدرت براءةٌ قبلَها")),
  "فإصدارُ ثانيةٍ يُشكّك في الأولى"
);

/* ------------------------------------------------------------------ */
console.log("\nوالحفظ:\n");

const base = {
  contractNumber: "9100",
  name: "فلان",
  counterpartyType: "مقاول",
  installments: [],
};

const back = normalizeState({
  contractors: [{ ...base, closure: { ...closure, settledAmount: 500 } }],
}).contractors[0];
check(
  "وما كُتب يعود كما كُتب",
  back.closure?.kind === "إنجاز" &&
    back.closure?.settledAmount === 500 &&
    back.closure?.reason === "تمَّ العملُ وسُلّم",
  JSON.stringify(back.closure?.kind)
);
check(
  "ووجهٌ مجهولٌ لا يُقبل",
  normalizeState({
    contractors: [{ ...base, closure: { ...closure, kind: "وجهٌ غريب" } }],
  }).contractors[0].closure === undefined,
  "فلا يُثبت إنهاءٌ بوجهٍ لا يُعرف"
);
check(
  "وإنهاءٌ بلا تاريخٍ لا يُقبل",
  normalizeState({
    contractors: [{ ...base, closure: { ...closure, date: "" } }],
  }).contractors[0].closure === undefined
);
check(
  "ولا يُسقط العقدُ كلُّه لذلك",
  normalizeState({
    contractors: [{ ...base, closure: { kind: "لا شيء" } }],
  }).contractors[0].contractNumber === "9100",
  "فإسقاطُه يُفقد العقدَ لا الإنهاءَ وحده"
);

/* ------------------------------------------------------------------ */
console.log("\nوفي الشاشة:\n");

check("أزرارُ الأوجه الثلاثة", /CLOSURE_KINDS\.map\(\(kind\)/.test(page));
check(
  "والممنوعُ معطَّلٌ ويُقال سببُه",
  /disabled=\{!verdict\.allowed\}/.test(page) &&
    /«الإنجاز» لا يصلح الآن/.test(page)
);
check(
  "والسببُ مطلوبٌ قبل الإنهاء",
  /اكتب السبب — ولا يُنهى عقدٌ بغيره/.test(page)
);
check(
  "ومبلغُ التسوية يُسأل في التراضي والفسخ",
  /المبلغُ الذي سُوّيت عليه الحقوق/.test(page)
);
check(
  "والإسقاطُ بما هو مبنيٌّ في الشاشة",
  /terminateContract\(contract\);/.test(page),
  "فلا يُنقل عملُ المال إلى الأمّ"
);
check(
  "والإنهاءُ يُعرض بوجهه وسببه ومن أنهاه",
  /closureLabel\(contract\.closure\)/.test(page) && /أنهاه \{contract\.closure\.by\}/.test(page)
);
check(
  "ويُرفع فيعود جارياً",
  /onReopen\(contract\)/.test(page) && /ارفع الإنهاء/.test(page)
);
check(
  "ويُقال إن المسقَطَ لا يعود برفعه",
  /وما أُسقط من دفعاتٍ لا يعود بهذا/.test(page),
  "فلا يُظنّ الرفعُ إعادةً للمال"
);

check("وبراءةُ الذمّة تُطبع", /function QuittanceSheet\(/.test(page));
check(
  "وتُقرأ بياناتُها من العقد",
  /\["رقم العقد", contract\.contractNumber\]/.test(page)
);
check(
  "وموضعُ نصّها معلَّمٌ ظاهر",
  /موضعُ صيغة براءة الذمة — تُستبدل بنصّ الشركة/.test(page) ||
    /موضعُ صيغة براءة الذمّة/.test(page),
  "فبندٌ يُوقَّع ويُحتجّ به لا يُخترع"
);
/*
  وكان يُطلب نصُّ البراءة كلُّه. ثمّ سلّمه صاحبُ الشركة في ٢٢ أكتوبر
  ٢٠٢٦ فحلّ محلَّ الموضع المعلَّم في عقود العملاء، وبقي المعلَّمُ
  لعقود المقاولين — فهو بلسانٍ آخر. فيُحرس أنّ الطلبَ ما زال مكتوباً
  لمن بقي، لا أنّه مكتوبٌ للجميع.
*/
check(
  "ويُقال لصاحبه ما يُرسل",
  /فأرسل صيغتَها بلسانه/.test(page),
  "للمقاولين والموردين — وصيغةُ العملاء وصلت"
);
check(
  "وإصدارُها يُستأذن فيه",
  /وهي حُجّةٌ عليك كما هي حُجّةٌ لك/.test(page)
);

/* ------------------------------------------------------------------ */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const { parseBackup, contractSettlement } = await jiti.import("../lib/storage.ts");
  const { approvedOnly } = await jiti.import("../lib/accounting.ts");
  const state = parseBackup(fs.readFileSync(BACKUP, "utf8"));
  const approved = approvedOnly(state.movements);
  console.log("\nوعلى دفاتر الشركة — أيُّ العقود يصلح للإنهاء بالإنجاز:\n");
  let ready = 0;
  let blocked = 0;
  for (const contract of state.contractors) {
    const settle = contractSettlement(approved, contract);
    const verdict = c.canClose("إنجاز", settle, contract.contractValue);
    if (verdict.allowed) {
      ready += 1;
      console.log(
        `     ${String(contract.contractNumber).padEnd(6)} ${String(
          contract.name
        ).slice(0, 30).padEnd(32)} ✓ يصلح`
      );
    } else {
      blocked += 1;
    }
  }
  console.log(
    `\n     يصلح للإنهاء بالإنجاز: ${ready} · ولا يصلح: ${blocked} (فيها باقٍ أو جدولٌ لم يُكتب)`
  );
}

/* ---- ونصُّ البراءة كما سلّمه صاحبُ الشركة ---- */
/*
  سلّمه في ٢٢ أكتوبر ٢٠٢٦ وهو منقولٌ بحرفه. وبندٌ يُوقَّع ويُحتجّ به
  لا يُخترع ولا يُحرَّف — فيُحرس لفظُه لا معناه، لئلّا يُصقَل بتعديلٍ
  لاحقٍ فيصير إقراراً لم يُرده.

  وهو بلسان الشركة مُنجِزةً وقابضة، فموضعُه عقدُ العميل وحدَه. ولو
  طُبع لمقاولٍ أقرّت الشركةُ أنّها قبضت مستحقّاتها من مقاولها — عكسُ
  الواقع، وإقرارٌ يُحتجّ به عليها.
*/
{
  const sheet = (() => {
    const at = page.indexOf("function QuittanceSheet(");
    if (at < 0) return "";
    const next = page.slice(at + 1).search(/\nfunction [A-Z]/);
    return page.slice(at, next < 0 ? undefined : at + 1 + next);
  })();

  /*
    والنصُّ يُقرأ بفراغٍ واحد: فهو ملفوفٌ على أسطرٍ في الشِّفر، فعبارةٌ
    متّصلةٌ لا تُطابقه ولو كانت فيه حرفاً بحرف. وهذه علّةٌ وقعت مراراً
    في هذه الفحوص: شرطٌ يُخفق على نصٍّ صحيحٍ لأنّ المحرّر لفّ سطراً.
  */
  const flat = sheet.replace(/\s+/g, " ");

  check("ورقةُ البراءة موجودة", sheet !== "");

  for (const phrase of [
    "بأننا قد أتممنا جميع الأعمال والالتزامات المتفق عليها",
    "لا توجد أي أعمال أو التزامات متبقية على الطرف",
    "باستلام",
    "كامل مستحقاتنا المالية المتعلقة بالأعمال المنفذة",
    "ولا يحق لنا بعد توقيع هذا الإقرار المطالبة بأي مبالغ مالية",
    "منتهياً ومغلقاً من الناحية المالية والتنفيذية",
    "بمثابة براءة ذمة ومخالصة نهائية بين الطرفين",
    "ووقع عليه الطرفان بكامل إرادتهما",
  ])
    check(`وفيه: «${phrase.slice(0, 34)}…»`, flat.includes(phrase));

  check(
    "واسمُ الشركة يُقرأ من بياناتها لا يُكتب في النصّ",
    sheet.includes("نقر نحن/ {company.name}"),
    "فلو كُتب حرفاً لاختلف عن ترويسة الورقة إن غُيّر"
  );
  check(
    "واسمُ الطرف الثاني من العقد",
    sheet.includes("<b>{contract.name}</b>")
  );
  check(
    "وعنوانُ العقد من نوع أعماله",
    sheet.includes("{contract.workType || contract.specialty"),
    "فالقوسُ في ورقته يُملأ ولا يُترك فارغاً"
  );

  check(
    "ولا يُطبع إلا لعقد عميل",
    /contract\.counterpartyType === "عميل" \?/.test(sheet),
    "فهو بلسان الشركة مُنجِزةً وقابضة"
  );
  check(
    "وللمقاولين موضعٌ معلَّمٌ ينتظر صيغتَه",
    sheet.includes("موضعُ صيغة براءة الذمّة للمقاولين والموردين"),
    "ولا تُخترع له صيغةٌ بالقياس"
  );
  check(
    "ويُقال لمَ لا تصلح صيغةُ العميل له",
    sheet.includes("مكتوبةٌ بلسان الشركة مُنجِزةً")
  );
  check(
    "ولا يبقى الموضعُ المعلَّمُ على عقد العميل",
    !/عميل" \?[\s\S]{0,400}border-dashed/.test(sheet),
    "فالنصُّ حلّ محلَّه"
  );
}

console.log(
  bad === 0
    ? "\n✓ الإنهاء: وجهٌ مثبَتٌ بسببه، ولا «إنجاز» وفي الذمّة مال، ولا براءةَ قبل أن يبرأ"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
