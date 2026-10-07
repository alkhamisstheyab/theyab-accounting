/**
 * يفحص توحيد اسمٍ اختلف رسمه.
 *
 *   node db/check-person-unify.mjs <نسخة.json>
 *
 * اسم المهندس مكتوبٌ في الحركات «م.نوح» بلا مسافة، وفي قائمة الأشخاص
 * «م. نوح» بمسافة. فلمّا صُحّح مستلمُ عهدته من القائمة، صار في متابعة
 * العهد شخصان: واحدٌ عليه صرفُ ٢٣٠ بلا إنفاق، وآخر عليه إنفاقُ ٢٢٧٫٥
 * بلا صرف. ولا يُقفل رصيدُ أيّهما، وهما رجلٌ واحد.
 *
 * والذي يُخشى من تصحيحٍ كهذا:
 *   • أن يمسّ حساباً أو مبلغاً أو اعتماداً — فيتغيّر الميزان من حيث
 *     أُريد تغيير اسم.
 *   • أن يطال اسماً آخر يشبهه.
 *   • ألّا يُقفل الرصيد بعده، فيكون قد نُقل الخطأ لا صُحّح.
 */
import fs from "fs";
import { createJiti } from "jiti";

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-person-unify.mjs <نسخة.json>");
  process.exit(1);
}

const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = { localStorage, addEventListener() {}, removeEventListener() {} };
globalThis.localStorage = localStorage;

const jiti = createJiti(import.meta.url);
const { parseBackup } = await jiti.import("../lib/storage.ts");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const state = parseBackup(fs.readFileSync(BACKUP, "utf8"));

const FROM = "م.نوح";
const TO = "م. نوح";

/* التصحيح كما تفعله اللوحة: الاسم وحده يتغيّر */
const match = (m) => m.person === FROM;
const targets = state.movements.filter(match);
const after = state.movements.map((m) =>
  match(m) ? { ...m, person: TO } : m
);

console.log("\nما يطاله التصحيح:\n");

/*
  التصحيح قد يكون مطبَّقاً سلفاً — وهو الغاية لا الإخفاق. فيُقال ذلك
  ويُتخطّى ما لا معنى لفحصه بعده، ولا يُعدّ فشلاً فحصٌ نجح عمله.
*/
const done = targets.length === 0;
if (done) {
  console.log("  ✓ التصحيح مطبَّق سلفاً — لا «" + FROM + "» في هذه النسخة");
} else {
  check("حركاتٌ مكتوبٌ فيها الاسم بلا مسافة", targets.length > 0, `${targets.length} حركة`);
}
check(
  "ولا يطال اسماً آخر",
  after.filter((m) => m.person === TO).length ===
    state.movements.filter((m) => m.person === TO).length + targets.length
);
check(
  "ولم يبقَ من الرسم القديم شيء",
  after.every((m) => m.person !== FROM)
);

console.log("\nولا يمسّ حساباً ولا مبلغاً ولا اعتماداً:\n");

const sameBut = (a, b) => {
  for (const key of Object.keys({ ...a, ...b })) {
    if (key === "person") continue;
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) return key;
  }
  return "";
};
const changed = state.movements
  .map((m, i) => sameBut(m, after[i]))
  .filter(Boolean);
check("لم يتغيّر إلا الاسم", changed.length === 0, changed.join("، ") || "لا شيء سواه");

const total = (list) => list.reduce((s, m) => s + m.amount, 0);
check(
  "ومجموع المبالغ كما هو",
  total(state.movements).toFixed(3) === total(after).toFixed(3),
  `${total(after).toFixed(3)} د.ك`
);
check(
  "وعدد المعتمدة كما هو",
  state.movements.filter((m) => m.approval === "معتمدة").length ===
    after.filter((m) => m.approval === "معتمدة").length
);

console.log("\nوالرصيد يُقفل بعده:\n");

const balance = (list, who) =>
  list
    .filter((m) => m.person === who && m.approval === "معتمدة")
    .reduce(
      (s, m) =>
        s + (m.debitCode === "1140" ? m.amount : m.creditCode === "1140" ? -m.amount : 0),
      0
    );

const beforeSplit = [balance(state.movements, FROM), balance(state.movements, TO)];
if (done) {
  console.log(
    "  ✓ الرصيد مجتمعٌ على اسمٍ واحد — «" + TO + "» " + beforeSplit[1].toFixed(3)
  );
} else {
  check(
    "قبله: شخصان ورصيدان",
    beforeSplit[0] !== 0 && beforeSplit[1] !== 0,
    `«${FROM}» ${beforeSplit[0].toFixed(3)} · «${TO}» ${beforeSplit[1].toFixed(3)}`
  );
}

const merged = balance(after, TO);
check(
  "وبعده: اسمٌ واحد ورصيدٌ واحد",
  Math.abs(merged - (beforeSplit[0] + beforeSplit[1])) < 0.001,
  `${merged.toFixed(3)} د.ك`
);
check(
  "وهو المتبقّي في ذمّته فعلاً",
  merged > 0 && merged < 10,
  `${merged.toFixed(3)} د.ك من عهدةٍ صُرفت ٢٣٠`
);

console.log("\nوباقي أصحاب العهد:\n");

const holders = [
  ...new Set(
    after
      .filter((m) => m.debitCode === "1140" || m.creditCode === "1140")
      .map((m) => m.person || "(بلا اسم)")
  ),
];
for (const who of holders) {
  const v = balance(after, who);
  console.log(`     ${who.padEnd(22)} ${v.toFixed(3)}`);
}
check(
  "ولا رصيد سالب — فالإنفاق لا يسبق الصرف",
  holders.every((who) => balance(after, who) >= -0.001)
);

/* واللوحة */
const page = fs.readFileSync("app/page.tsx", "utf8");
check("وللتصحيح موضعه في اللوحة", page.includes('id: "noah-name-unify"'));
check(
  "ولتوحيد الطرف موضعه أيضاً",
  page.includes('id: "abdullatif-name-unify"') &&
    page.includes('toParty: "عبداللطيف ابواحمد"')
);
check(
  "ويُطبَّق على الطرف لا على الدافع",
  page.includes("if (fix.toParty) next.party = fix.toParty;")
);

/* والصيغ الخمس تُجمع في واحدة على بيانات الشركة */
const spellings = [
  "ابو احمد",
  "عبداللطيف",
  "عبداللطيف أحمد (أبو أحمد النجار)",
  "عبداللطيف أحمد عبداللطيف حسوب",
  "بو احمد النجار",
];
const hits = state.movements.filter((m) => spellings.includes((m.party ?? "").trim()));
check(
  "وتطال كل صيغة كُتب بها اسمه",
  hits.length > 0,
  `${hits.length} حركة · ${[...new Set(hits.map((m) => m.party))].length} صيغة`
);
const unified = state.movements.map((m) =>
  spellings.includes((m.party ?? "").trim())
    ? { ...m, party: "عبداللطيف ابواحمد" }
    : m
);
check(
  "ولا يتغيّر بها مبلغٌ ولا حساب",
  unified.every((m, i) => {
    const before = state.movements[i];
    return m.amount === before.amount && m.debitCode === before.debitCode &&
      m.creditCode === before.creditCode && m.approval === before.approval &&
      (m.contractNumber ?? "") === (before.contractNumber ?? "");
  })
);
/*
  المقياس الزيادة لا العدد المطلق.

  كان الشرط أن يكون عددُ ما يحمل الاسم الصحيح بعد التوحيد مساوياً
  لعدد الصيغ المُوحَّدة — وذلك يصحّ لو لم يكن في الدفاتر حركةٌ تحمله
  أصلاً. وقد صار يحمله سبعُ حركات، فأخفق الشرط على توحيدٍ ناجح.

  والمفحوص أن كلَّ صيغةٍ انتقلت، فلم تبقَ واحدةٌ ولم يُمسَّ غيرُها:
  يزيد الاسمُ الصحيح بعدد ما انتقل، ويخلو من الصيغ القديمة.
*/
const named = (list) =>
  list.filter((m) => (m.party ?? "").trim() === "عبداللطيف ابواحمد").length;
check(
  "ويجتمع عمله تحت اسمٍ واحد",
  named(unified) === named(state.movements) + hits.length &&
    unified.every((m) => !spellings.includes((m.party ?? "").trim())),
  `${hits.length} حركة بمجموع ${hits
    .reduce((x, m) => x + m.amount, 0)
    .toFixed(3)} د.ك — صار ${named(unified)} بعد ${named(state.movements)}`
);
check("ويُقال في المعاينة إلى أي اسمٍ تنتقل", page.includes("ويصير اسم صاحبها كلِّها"));
check(
  "ولا يمسّ التطبيقُ حساباً ولا مبلغاً",
  page.includes("if (fix.toPerson) next.person = fix.toPerson;")
);

console.log(
  bad === 0
    ? "\n✓ اسمٌ واحد ورصيدٌ واحد — ولم يتغيّر حسابٌ ولا مبلغ ولا اعتماد"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
