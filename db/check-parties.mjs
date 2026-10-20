/**
 * يفحص سجلَّ الأطراف والعقدَ الفوريّ.
 *
 *   npm run check:parties [نسخة.json]
 *
 * وكان الطرفُ لا وجودَ له إلا في عقده: بياناتُه مكتوبةٌ في كلِّ عقدٍ
 * من عقوده، فمن له ثلاثةُ عقودٍ مكتوبٌ ثلاثَ مرّات — ولو تغيّر هاتفُه
 * صُحّح في ثلاثةٍ أو بقي قديماً في اثنين.
 *
 * وثلاثةٌ تُحرس:
 *
 *   • **العزل**: سجلُّ الموردين لا يُخالطه عميل، فالاستعلامُ عن مقاولٍ
 *     لا يَخرج منه عقدُ عميل.
 *
 *   • **ألّا يُترك السجلُّ فارغاً**: فقد جاء بعد العقود. فيُستخرج منها
 *     من ليس فيه، ويُضاف بضغطةٍ ببياناته كما في عقده.
 *
 *   • **ألّا يُحذف من تُعومل معه**: يُوقَف فلا يُقترح، ويبقى أثرُه في
 *     عقوده — ومن حُذف سجلُّه بقيت عقودُه بلا صاحبٍ يُعرف.
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
const parties = await jiti.import("../lib/parties.ts");
const { normalizeState, emptyState } = await jiti.import("../lib/storage.ts");
const { ROW_COLLECTIONS } = await jiti.import("../lib/collections.ts");
const { COLLECTIONS } = await jiti.import("../lib/server/collections.ts");

const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");
const permitsSrc = fs.readFileSync(path.join(ROOT, "lib/server/permits.ts"), "utf8");
const schema = fs.readFileSync(path.join(HERE, "schema.sql"), "utf8");
const lib = fs.readFileSync(path.join(ROOT, "lib/parties.ts"), "utf8");

/* ------------------------------------------------------------------ */
console.log("\nالمجموعةُ مبنيّةٌ في طبقاتها:\n");

check("في الحالة", Object.prototype.hasOwnProperty.call(emptyState(), "parties"));
check("وفي الصفوف", ROW_COLLECTIONS.some((c) => c.field === "parties"));
check(
  "وفي جداول الخادم",
  (COLLECTIONS ?? []).some((c) => c.field === "parties" && c.table === "parties")
);
check(
  "وفي هجرةٍ تنزل على قاعدةٍ عاملة",
  fs.existsSync(path.join(HERE, "migrations", "002-parties.sql"))
);
check(
  "ويَنقلها الاسترجاع",
  /await fillData\(db, "parties"/.test(
    fs.readFileSync(path.join(HERE, "migrate.mjs"), "utf8")
  ),
  "ومجموعةٌ لا يَنقلها تضيع عند أوّل استرجاع"
);
/* والمخطَّطُ لا يذكرها بعد — والهجرةُ وحدَها لا تكفي */
check(
  "ومذكورةٌ في المخطَّط",
  /CREATE TABLE parties/.test(schema),
  "فقاعدةُ من يبدأ اليومَ كقاعدة من بدأ أمس"
);

/* ------------------------------------------------------------------ */
console.log("\nوالعزلُ: سجلٌّ لا يُخالطه غيرُه:\n");

const party = (name, extra = {}) => ({
  id: "P-" + name,
  name,
  kind: "مقاول",
  specialty: "",
  phone: "",
  civilId: "",
  address: "",
  nationality: "",
  licenseNumber: "",
  notes: "",
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...extra,
});

const all = [
  party("نجّارٌ أوّل", { specialty: "نجّار" }),
  party("نجّارٌ ثانٍ", { specialty: "نجّار" }),
  party("حدّاد", { specialty: "حدّاد" }),
  party("مورّدُ خرسانة", { kind: "مورّد", specialty: "خرسانة جاهزة" }),
  party("عميلٌ", { kind: "عميل", specialty: "" }),
  party("بلا صنعة", { specialty: "" }),
  party("موقوف", { specialty: "نجّار", active: false }),
];

const contractorGroups = parties.partiesBySpecialty(all, "مقاول");
check(
  "المقاولون وحدَهم",
  contractorGroups.flatMap((g) => g.parties).every((p) => p.kind === "مقاول"),
  `${contractorGroups.flatMap((g) => g.parties).length} مقاولاً`
);
check(
  "ولا عميلَ فيهم",
  !contractorGroups.some((g) => g.parties.some((p) => p.kind === "عميل"))
);
check(
  "ومجموعون على تخصّصاتهم",
  contractorGroups.map((g) => g.specialty).join("، ") === "حدّاد، نجّار، بلا تخصّص",
  contractorGroups.map((g) => `${g.specialty}:${g.parties.length}`).join(" · ")
);
check(
  "و«بلا تخصّص» آخرُهم ولا يُخفى",
  contractorGroups[contractorGroups.length - 1].specialty === "بلا تخصّص",
  "فإخفاؤه يُنسيه وهو أحقُّ بأن يُكمَل بيانُه"
);
check(
  "والموردون في بابهم",
  parties.partiesBySpecialty(all, "مورّد").length === 1 &&
    parties.partiesBySpecialty(all, "مورّد")[0].specialty === "خرسانة جاهزة"
);
check(
  "والموقوفُ في السجلّ لا يُحذف",
  contractorGroups
    .flatMap((g) => g.parties)
    .some((p) => p.name === "موقوف" && !p.active),
  "ويُخفى في الشاشة بخيار"
);

/* ------------------------------------------------------------------ */
console.log("\nولا يُترك السجلُّ فارغاً — يُستخرج من العقود:\n");

const contracts = [
  {
    contractNumber: "6004",
    name: "مصطفى الأمير",
    counterpartyType: "مقاول",
    specialty: "صحّي",
    phone: "99",
    civilId: "123",
    nationality: "مصري",
    address: "حولي",
  },
  {
    contractNumber: "6005",
    name: "شركة السور",
    counterpartyType: "مورّد",
    specialty: "خرسانة",
  },
  {
    /* نفسُ المقاول في عقدٍ ثانٍ — ولا يُضاف مرّتين */
    contractNumber: "6010",
    name: "مصطفى الأمير",
    counterpartyType: "مقاول",
    specialty: "صحّي",
    phone: "مختلف",
  },
  { contractNumber: "6001", name: "حسن العجمي", counterpartyType: "عميل" },
];

const missing = parties.unregistered(contracts, [], "مقاول");
check(
  "يُستخرج من ليس في السجلّ",
  missing.length === 1 && missing[0].name === "مصطفى الأمير",
  `${missing.length}`
);
check(
  "ولا يُكرَّر من له عقودٌ عدّة",
  missing.length === 1,
  "فأوّلُ عقدٍ يُحمل منه البيان"
);
check(
  "وببياناته كما في عقده",
  missing[0].phone === "99" && missing[0].civilId === "123" && missing[0].specialty === "صحّي"
);
check(
  "ولا يُخلط نوعٌ بنوع",
  parties.unregistered(contracts, [], "مورّد").length === 1 &&
    parties.unregistered(contracts, [], "مورّد")[0].name === "شركة السور"
);
check(
  "ومن كان في السجلّ لا يُستخرج",
  parties.unregistered(contracts, [party("مصطفى الأمير")], "مقاول").length === 0
);
check("وبابُه في الشاشة", /أضِفهم من عقودهم/.test(page));

/* ---- وعقودُ الطرف تُقرأ بالاسم ---- */
check(
  "وعقودُ الطرف تُقرأ بالاسم",
  parties.partyContracts(contracts, party("مصطفى الأمير")).length === 2,
  "فعقودُ الشركة كُتبت قبل السجلّ ولا معرّفَ فيها يُربط به"
);
check(
  "ولا يُنسب إلى من بلا اسمٍ شيء",
  parties.partyContracts(contracts, party("")).length === 0 ||
    parties.partyContracts(contracts, { ...party(""), name: "" }).length === 0,
  "فاسمٌ فارغٌ لا يُطابق فراغاً"
);

/* ------------------------------------------------------------------ */
console.log("\nوالعقدُ الفوريّ:\n");

check("بابُه في السجلّ", /عقد فوريّ/.test(page));
check(
  "ولا يُفتح مع عميل",
  /party\.active && party\.kind !== "عميل"/.test(page),
  "فالعقدُ معه وارِدٌ لا صادر، وله بابُه"
);
check(
  "ويُبنى بالمسوِّي لا بكائنٍ مكتوب",
  /normalizeState\(\{\s*\n?\s*contractors: \[/.test(page),
  "فحقلٌ يُضاف غداً يناله من تلقائه"
);
check(
  "وبرقمٍ لم يُستعمل",
  /while \(used\.has\(String\(next\)\)\) next \+= 1;/.test(page),
  "فرقمٌ مكرَّرٌ يُفسد كشفَ العقود كلَّه"
);
check(
  "وبلا قيمةٍ مخترعة",
  /فعقدٌ بقيمةٍ لم تُتّفق أسوأُ من لا عقد/.test(page),
  "وتُكمل قيمتُه في شاشة المقاولين"
);
check("ويُنقل إلى موضع إكماله", /setPage\("المقاولون"\);/.test(page));
check("ويُسجَّل", /عقدٌ فوريٌّ/.test(page));

/* ------------------------------------------------------------------ */
console.log("\nوالصلاحيةُ والحفظ:\n");

check(
  "يقرؤها من يقرأ العقود",
  /parties: \["contractors\.view", "contractors\.manage"\]/.test(permitsSrc)
);
check(
  "ويكتبها من يُديرها",
  /parties: \{\s*\n?\s*write: \["contractors\.manage"\]/.test(permitsSrc)
);
check(
  "والإيقافُ لا الحذف",
  /ولا يُحذف من تعامَلَ معه/.test(permitsSrc) || /ولا يُحذف من تعامَلتَ معه/.test(page)
);

const back = normalizeState({ parties: all }).parties;
check(
  "وما كُتب يعود كما كُتب",
  back.length === all.length &&
    back.find((p) => p.name === "موقوف")?.active === false &&
    back.find((p) => p.name === "مورّدُ خرسانة")?.kind === "مورّد",
  `${back.length} طرفاً`
);
check(
  "ونوعٌ مجهولٌ يصير «مقاول» ولا يُسقط الصفّ",
  normalizeState({ parties: [{ name: "س", kind: "نوعٌ غريب" }] }).parties[0].kind ===
    "مقاول"
);
check(
  "والتخصّصاتُ تُقترح ولا تُلزم",
  /تُقترح ولا تُلزم/.test(lib) && parties.SPECIALTIES.length > 10,
  `${parties.SPECIALTIES.length} تخصّصاً مقترحاً`
);

/* ------------------------------------------------------------------ */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const { parseBackup } = await jiti.import("../lib/storage.ts");
  const state = parseBackup(fs.readFileSync(BACKUP, "utf8"));
  console.log("\nوعلى دفاتر الشركة:\n");
  console.log(`     في السجلّ: ${(state.parties ?? []).length}`);
  for (const kind of ["مقاول", "مورّد", "عميل"]) {
    const found = parties.unregistered(state.contractors, state.parties ?? [], kind);
    console.log(`     ${String(kind).padEnd(7)} في العقود وليس في السجلّ: ${found.length}`);
    for (const row of found.slice(0, 6)) {
      console.log(
        `        ${row.name}${row.specialty ? ` — ${row.specialty}` : ""}`
      );
    }
    if (found.length > 6) console.log(`        … و${found.length - 6} غيرهم`);
  }
}

console.log(
  bad === 0
    ? "\n✓ السجلّ: معزولٌ بتخصّصاته، يُستخرج من العقود، ولا يُحذف من تُعومل معه"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
