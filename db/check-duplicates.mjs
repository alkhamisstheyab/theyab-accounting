/**
 * يفحص الإمساك بالحركة المكرَّرة.
 *
 *   node db/check-duplicates.mjs <نسخة.json>
 *
 * طلبُ صاحب الشركة في ٢١ سبتمبر ٢٠٢٦: يُنبَّه إلى المكرَّر، ولا يُقبل
 * حتى يُقرّ أنها حركةٌ أخرى.
 *
 * والذي يُخشى منه:
 *   • أن يمرّ المكرَّر التامّ صامتاً — وهو ما بُني الفحص لأجله.
 *   • أن يُنبَّه إلى ما ليس مكرَّراً فيُملّ التنبيه ويُتجاوز بلا نظر.
 *   • أن تُعدّ الحركة تكراراً لنفسها عند تعديلها.
 *   • أن يبقى الإقرار سارياً بعد تغيير المبلغ أو التاريخ، فتمرّ
 *     المكرَّرةُ بإقرارٍ أُعطي لغيرها.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-duplicates.mjs <نسخة.json>");
  process.exit(1);
}

const { parseBackup } = await jiti.import("../lib/storage.ts");
const { findDuplicateMovements, duplicateSignature, DUPLICATE_WINDOW_DAYS } =
  await jiti.import("../lib/duplicates.ts");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { movements } = parseBackup(fs.readFileSync(BACKUP, "utf8"));

/* حركةٌ حقيقية من الدفاتر تُعاد كتابتها كما هي */
const original = movements.find(
  (m) => m.amount > 0 && m.description && m.project && m.debitCode && m.creditCode
);

console.log("\nالمكرَّر التامّ يُمسَك:\n");

const again = { ...original, id: "جديدة" };
const exact = findDuplicateMovements(again, movements);
check(
  "إعادة كتابة الحركة نفسها تُمسَك",
  exact.length > 0 && exact[0].exact,
  `القيد ${original.entryNo} · ${exact[0]?.reason ?? "—"}`
);
check(
  "والقيد المُشار إليه هو الأصل",
  exact.some((d) => d.movement.id === original.id)
);

/* ضغطة حفظٍ مكرّرة: نفس كل شيء وبيانٌ بفروق شكلية */
const spaced = {
  ...again,
  description: ` ${original.description.replace(/\s+/g, "  ")} `,
};
check(
  "والفروق الشكلية في البيان لا تُخفيه",
  findDuplicateMovements(spaced, movements).some((d) => d.exact)
);

console.log("\nوما ليس مكرَّراً يمرّ:\n");

check(
  "اختلاف المبلغ يكفي — حركةٌ أخرى",
  findDuplicateMovements({ ...again, amount: original.amount + 1.5 }, movements)
    .length === 0
);
const farDate = (() => {
  const d = new Date(original.date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + DUPLICATE_WINDOW_DAYS + 1);
  return d.toISOString().slice(0, 10);
})();
check(
  `وما تجاوز ${DUPLICATE_WINDOW_DAYS} أيام لا يُنبَّه إليه`,
  findDuplicateMovements({ ...again, date: farDate }, movements).every(
    (d) => d.movement.id !== original.id
  ),
  `${farDate} — والأصل ${original.date}`
);
check(
  "والحركة لا تُعدّ تكراراً لنفسها عند تعديلها",
  findDuplicateMovements(original, movements).every(
    (d) => d.movement.id !== original.id
  )
);
check(
  "ولا تنبيه على مسوّدة بلا مبلغ أو بلا تاريخ",
  findDuplicateMovements({ ...again, amount: 0 }, movements).length === 0 &&
    findDuplicateMovements({ ...again, date: "" }, movements).length === 0
);

console.log("\nوالإقرار يخصّ ما أُقرّ عليه:\n");

const signature = duplicateSignature(again);
check(
  "بصمةٌ واحدة لمسوّدةٍ واحدة",
  signature === duplicateSignature({ ...again })
);
check(
  "وتتغيّر بتغيّر المبلغ",
  duplicateSignature({ ...again, amount: original.amount + 1 }) !== signature
);
check(
  "وبتغيّر التاريخ",
  duplicateSignature({ ...again, date: farDate }) !== signature
);
check(
  "وبتغيّر البيان",
  duplicateSignature({ ...again, description: original.description + " ٢" }) !==
    signature
);
check(
  "ولا تتغيّر بمسافةٍ زائدة — فلا يُطلب إقرارٌ جديد بلا سبب",
  duplicateSignature(spaced) === signature
);

console.log("\nوقياسٌ على الدفاتر كما هي:\n");

/*
  الدفاتر فيها متساوياتٌ بحقّها: أربع عمولات تحويل بدينارٍ في يوم،
  وتعبئتا بنزين بثلاثة. فهذه ستُنبَّه ويُقرّ عليها بضغطة — وذلك
  المطلوب. وإنما يُقاس العدد لئلا تتحوّل القاعدة إلى تنبيهٍ على كل
  حركةٍ فيُتجاوز بلا نظر.
*/
let exactPairs = 0;
for (const m of movements) {
  const hits = findDuplicateMovements(m, movements).filter((d) => d.exact);
  if (hits.length > 0) exactPairs++;
}
const share = (exactPairs / movements.length) * 100;
check(
  "التنبيه التامّ على أقلّية من الدفاتر — لا يغرق المستخدم",
  share < 20,
  `${exactPairs} من ${movements.length} حركة · ${share.toFixed(1)}٪`
);

/* والشاشة تمنع الحفظ حتى يُقرّ */
const page = fs.readFileSync("app/page.tsx", "utf8");
check("وشاشة الإدخال تمنع الحفظ حتى يُقرّ", page.includes("dupBlocking"));
check(
  "وتعرض المشتبه بها في جدول",
  page.includes("راجعتُها، وهذه حركة أخرى — احفظها")
);

console.log(
  bad === 0
    ? "\n✓ المكرَّر يُمسَك ويُعرض، ولا يُحفظ إلا بإقرارٍ يخصّه"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
