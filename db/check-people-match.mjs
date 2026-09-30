/**
 * يفحص مطابقة الاسم المكتوب في الحركة بصاحبه في ملفّ الموظفين.
 *
 *   node db/check-people-match.mjs [نسخة.json]
 *
 * قيود السلف تحمل الاسم لا المعرّف، والاسم يُكتب كما يُنادى به. فوقع في
 * مسيّر سبتمبر ٢٠٢٦ أن سلفة «مصطفى الأنصاري» لم تظهر لأن ملفّه يقول
 * «مصطفى عبدالماليك محمد الأنصاري».
 *
 * والذي يُخشى منه بعد التوسيع: أن يُخصم من غير صاحبه. فالفحص يشدّد على
 * أن المشتبه لا يُطابَق، وأن الاسم المفرد لا يدلّ على أحد.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { sameName, matchPerson, nameWords } = await jiti.import(
  "../lib/people-match.ts"
);

console.log("\nالاسمان يكفيان:\n");

check(
  "«مصطفى الأنصاري» هو «مصطفى عبدالماليك محمد الأنصاري»",
  sameName("مصطفى الأنصاري", "مصطفى عبدالماليك محمد الأنصاري")
);
check(
  "والتطابق التامّ باقٍ على حاله",
  sameName("عبداللطيف كريمي", "عبداللطيف كريمي")
);
check(
  "و«خالد صالح» هو «خالد شميس الدين أمين صالح»",
  sameName("خالد صالح", "خالد شميس الدين أمين صالح")
);

console.log("\nوالكتابة تُسوّى قبل المقارنة:\n");

check("الألف بأشكالها", sameName("مصطفى الانصاري", "مصطفى الأنصاري"));
check("و«ال» التعريف تُجرَّد", sameName("مصطفى انصاري", "مصطفى الأنصاري"));
check("والياء والتاء", sameName("سلمى مراد", "سلمي مراد"));
check("والمسافات الزائدة", sameName("  مصطفى   الأنصاري ", "مصطفى الأنصاري"));
check(
  "والتشكيل",
  nameWords("مُصْطَفى الأنصاري").join(" ") === nameWords("مصطفى الانصاري").join(" ")
);

console.log("\nوما ليس هو لا يُطابَق:\n");

check("آخر الاسم مختلف", !sameName("مصطفى الأنصاري", "مصطفى عبدالماليك محمد"));
check("وأوّله مختلف", !sameName("محمد الأنصاري", "مصطفى عبدالماليك محمد الأنصاري"));
check("والاسم المفرد لا يدلّ على أحد", !sameName("حسين", "حسين علي محمد"));
check(
  "ومفردٌ بمفردٍ مثله يتطابق تماماً — فهو هو",
  sameName("حسين", "حسين")
);
check(
  "لكن المفرد لا يُوسَّع على من حمله بين اسمين",
  !sameName("حسين", "علي حسين محمد")
);
check("والفارغ لا يُطابِق شيئاً", !sameName("", "مصطفى الأنصاري"));

console.log("\nوالمشتبِه يُرَدّ ولا يُخمَّن:\n");

const two = [
  { id: "a", name: "محمد سالم علي" },
  { id: "b", name: "محمد صالح علي" },
];
check("اسمٌ يوافق موظفَين فلا أحد", matchPerson("محمد علي", two) === null);
check(
  "وإن تطابق أحدهما تماماً فهو له",
  matchPerson("محمد صالح علي", two)?.id === "b"
);

const staff = [
  { id: "emp-003", name: "عبداللطيف كريمي" },
  { id: "emp-005", name: "مصطفى عبدالماليك محمد الأنصاري" },
  { id: "emp-011", name: "خالد شميس الدين أمين صالح" },
];
check("ومن ليس منهم لا يُنسب إليهم", matchPerson("أبو أحمد النجار", staff) === null);
check("والمقاول لا يُحسب موظفاً", matchPerson("سيجما للتكييف", staff) === null);
check("ويُوجد صاحب السلفة", matchPerson("مصطفى الأنصاري", staff)?.id === "emp-005");

/* ---- وعلى ملفّات الشركة ---- */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const d = JSON.parse(fs.readFileSync(BACKUP, "utf8")).data;
  const ADVANCE = "1240";

  console.log("\nوعلى ملفّات الشركة — حساب سلف الموظفين:\n");

  const byId = new Map();
  const orphans = [];
  for (const m of d.movements) {
    if (m.approval !== "معتمدة") continue;
    const sign = m.debitCode === ADVANCE ? 1 : m.creditCode === ADVANCE ? -1 : 0;
    if (sign === 0) continue;
    const person = (m.person || "").trim();
    const owner = person ? matchPerson(person, d.employees) : null;
    if (!owner) {
      orphans.push(`${m.entryNo} (${person || "بلا اسم"})`);
      continue;
    }
    byId.set(owner.id, (byId.get(owner.id) ?? 0) + sign * m.amount);
  }

  for (const [id, amount] of byId) {
    const e = d.employees.find((x) => x.id === id);
    console.log(`     ${e.name}: ${amount.toFixed(3)} د.ك`);
  }
  check(
    "كلُّ قيد سلفةٍ عُرف صاحبه",
    orphans.length === 0,
    orphans.length ? orphans.join("، ") : "لا متروك"
  );
  check(
    "وسلفة مصطفى ظهرت بعد أن كانت تختفي",
    (byId.get("emp-005") ?? 0) !== 0 ||
      d.movements.every((m) => m.creditCode !== ADVANCE || !/مصطفى/.test(m.person || "")),
    `${(byId.get("emp-005") ?? 0).toFixed(3)} د.ك`
  );

  /* ولا اسمَ موظفٍ يشتبه بآخر — فالمطابقة بالاسمين تقتضي تمايزهم */
  const clashes = [];
  for (const e of d.employees) {
    const hits = d.employees.filter((o) => sameName(o.name, e.name));
    if (hits.length > 1) clashes.push(e.name);
  }
  check(
    "ولا موظفَين يتشابه أوّل اسمهما وآخره",
    clashes.length === 0,
    clashes.join("، ") || "كلُّهم متمايزون"
  );
}

console.log(
  bad === 0
    ? "\n✓ اسمان يكفيان، والمشتبِه يُرَدّ"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
