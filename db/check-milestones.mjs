/**
 * يفحص متابعةَ المراحل بمواعيدها وتنبيهَ ما توقّف.
 *
 *   npm run check:milestones [نسخة.json]
 *
 * وكانت التنبيهاتُ كلُّها على ما **وقع**: دفعةٌ استُحقّت ولم تُسدَّد،
 * حركةٌ تنتظر اعتماداً. ولم يكن فيها شيءٌ على ما **سيقع** — فلا يُعلم
 * أنّ مرحلةً موعدُها بعد ثلاثةِ أيّامٍ ولم يُعاينها المهندس، ولا أنّ
 * عملاً توقّف منذ شهرٍ ولم يُسأل عنه.
 *
 * وثلاثةٌ تُحرس:
 *
 *   • **لا تنبيهَ على ما لم يُكتب له موعد.** فالسكوتُ لا يُقاس به، ومن
 *     ولَّد المواعيدَ من مدّة العقد نبّه على تخمين.
 *
 *   • **والموقوفُ لا يُعدّ متأخّراً.** فالمرحلةُ تتوقّف لا بتقصير:
 *     انتظارُ مدعومٍ أو ترخيصٍ أو دفعةٍ من العميل. ولو عُدّ متأخّراً
 *     لنُبّه عليه كلَّ يومٍ بلا فائدة — وتنبيهٌ يُكرَّر بلا عملٍ
 *     يُهمَل، ثم يُهمل معه الصادق.
 *
 *   • **والمنجَزُ يخرج من المتابعة.** ولو بقي فيها لظنّ المهندسُ أنّ
 *     عليه عملاً وقد فعله.
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
const m = await jiti.import("../lib/milestones.ts");
const { buildNotices } = await jiti.import("../lib/notifications.ts");
const { normalizeState } = await jiti.import("../lib/storage.ts");
const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");
const lib = fs.readFileSync(path.join(ROOT, "lib/milestones.ts"), "utf8");

const TODAY = new Date("2026-10-20T00:00:00Z");

const inst = (number, extra = {}) => ({
  number,
  value: "1000",
  condition: "",
  status: "",
  approved: false,
  approvedBy: "",
  approvedAt: "",
  approvalNote: "",
  confirmed: false,
  confirmedBy: "",
  confirmedAt: "",
  confirmNote: "",
  stage: "مرحلة " + number,
  ...extra,
});

const contract = (number, installments, extra = {}) => ({
  id: "c" + number,
  name: "فلان",
  specialty: "",
  phone: "",
  project: "قسيمة",
  contractNumber: number,
  contractType: "جاري التنفيذ",
  workType: "بناء",
  contractValue: 10000,
  installmentsCount: installments.length,
  counterpartyType: "مقاول",
  documentType: "عقد",
  parentContractNumber: "",
  contractDate: "2026-01-01",
  installments,
  ...extra,
});

/* ------------------------------------------------------------------ */
console.log("\nلا متابعةَ لما لم يُكتب له موعد:\n");

check(
  "مرحلةٌ بلا موعدٍ لا تُعدّ",
  m.milestones([contract("1", [inst(1)])], TODAY).length === 0,
  "فالسكوتُ لا يُقاس به"
);
check(
  "ولا يُولَّد الموعدُ من مدّة العقد",
  /ولا يُولَّد من مدّة العقد/.test(
    fs.readFileSync(path.join(ROOT, "lib/storage.ts"), "utf8")
  ),
  "فتوزيعُها على المراحل تخمينٌ يُنبّه على غير علم"
);
check(
  "والمعتمَدُ يخرج من المتابعة",
  m.milestones(
    [contract("2", [inst(1, { expectedDate: "2026-10-01", approved: true })])],
    TODAY
  ).length === 0,
  "ولو بقي ظنّ المهندسُ أنّ عليه عملاً وقد فعله"
);
check(
  "وعقدٌ أُنهي لا يُتابَع",
  m.milestones(
    [
      contract("3", [inst(1, { expectedDate: "2026-10-01" })], {
        closure: {
          kind: "فسخ",
          date: "2026-10-05",
          reason: "امتناع",
          note: "",
          by: "ذياب",
          at: "2026-10-05T00:00:00Z",
        },
      }),
    ],
    TODAY
  ).length === 0,
  "فلا عملَ فيه يُنتظر"
);

/* ------------------------------------------------------------------ */
console.log("\nوالحالُ أربع:\n");

const rows = m.milestones(
  [
    contract("10", [
      inst(1, { expectedDate: "2026-10-01" }),
      inst(2, { expectedDate: "2026-10-22" }),
      inst(3, { expectedDate: "2026-12-01" }),
      inst(4, {
        expectedDate: "2026-09-01",
        stalled: true,
        stalledReason: "انتظار المدعوم",
        stalledAt: "2026-09-10",
      }),
    ]),
  ],
  TODAY
);
const at = (n) => rows.find((r) => r.number === n);

check("ما مضى موعدُه متأخّر", at(1).state === "متأخّرة", `${at(1).days} يوماً`);
check(
  "وما قَرُب يقرب",
  at(2).state === "يقرب" && at(2).days === 2,
  `بعد ${at(2).days} يوماً`
);
check("وما بَعُد في موعده", at(3).state === "في موعدها", `بعد ${at(3).days} يوماً`);
check(
  "والموقوفُ موقوفٌ لا متأخّر",
  at(4).state === "موقوفة",
  "ومضى موعدُه ومع ذلك لا يُعدّ متأخّراً"
);
check(
  "ويُحسب طولُ توقّفه",
  at(4).stalledDays === 40,
  `${at(4).stalledDays} يوماً`
);
check(
  "والأشدُّ أوّلاً",
  rows.map((r) => r.number).join(",") === "1,4,2,3",
  rows.map((r) => `${r.number}:${r.state}`).join(" · ")
);
check(
  "وحدُّ القرب أسبوع",
  m.SOON_DAYS === 7,
  "فيكفي لمعاينةٍ وترتيب"
);
check(
  "وحدُّ التوقّف الطويل أسبوعان",
  m.STALL_DAYS === 14,
  "فأقلُّ منهما انتظارٌ معتاد"
);

const sum = m.milestoneSummary(rows);
check(
  "والمجاميعُ تُقرأ",
  sum.late.length === 1 &&
    sum.soon.length === 1 &&
    sum.stalled.length === 1 &&
    sum.longStalled.length === 1 &&
    sum.onTime.length === 1
);
check(
  "وموقوفٌ قصيرٌ ليس طويلاً",
  m.milestoneSummary(
    m.milestones(
      [
        contract("11", [
          inst(1, {
            expectedDate: "2026-10-01",
            stalled: true,
            stalledReason: "مادّة",
            stalledAt: "2026-10-18",
          }),
        ]),
      ],
      TODAY
    )
  ).longStalled.length === 0,
  "فيومان انتظارٌ لا توقّف"
);
check(
  "والوصفُ يُقرأ بالكلام",
  m.milestoneLabel(at(1)).includes("تأخّرت") &&
    m.milestoneLabel(at(4)).includes("موقوفةٌ منذ"),
  `${m.milestoneLabel(at(1))} · ${m.milestoneLabel(at(4))}`
);

/* ------------------------------------------------------------------ */
console.log("\nوالتنبيهُ يُجمع ولا يُكرَّر:\n");

const base = {
  movements: [],
  projects: [],
  employees: [],
  quotations: [],
  workItems: [],
  audit: [],
  messages: [],
  backup: { at: new Date().toISOString(), movementCount: 0 },
  today: "2026-10-20",
  lastSeenAt: "2026-10-19T00:00:00.000Z",
  userName: "ذياب",
  backupEveryDays: 10,
};

const many = Array.from({ length: 9 }, (_, i) =>
  inst(i + 1, { expectedDate: "2026-10-01" })
);
const notices = buildNotices({
  ...base,
  contractors: [contract("20", many)],
});
const late = notices.filter((n) => n.id === "milestones-late");
check(
  "تسعُ مراحلَ متأخّرةٍ تنبيهٌ واحد",
  late.length === 1 && late[0].count === 9,
  `${late.length} تنبيهاً · العدد ${late[0]?.count}`
);
check(
  "ويُسمّى أقدمُها",
  late[0].detail.includes("العقد 20"),
  "فلا يُترك عامّاً لا يُعمل به"
);
check(
  "ويُقال له أن يُوسِّم الموقوفَ",
  late[0].detail.includes("موقوفاً"),
  "فلا يُعدّ ما توقّف بعذرٍ متأخّراً"
);
check(
  "وصفحتُه متابعةُ المراحل",
  late[0].page === "متابعة المراحل"
);

const soon = buildNotices({
  ...base,
  contractors: [contract("21", [inst(1, { expectedDate: "2026-10-22" })])],
}).filter((n) => n.id === "milestones-soon");
check("وتنبيهٌ لما يقرب", soon.length === 1, soon[0]?.title);

const stalledNotice = buildNotices({
  ...base,
  contractors: [
    contract("22", [
      inst(1, {
        expectedDate: "2026-10-01",
        stalled: true,
        stalledReason: "انتظار الترخيص",
        stalledAt: "2026-09-01",
      }),
    ]),
  ],
}).filter((n) => n.id === "milestones-stalled");
check(
  "وتنبيهٌ لما توقّف طويلاً",
  stalledNotice.length === 1 &&
    stalledNotice[0].detail.includes("انتظار الترخيص"),
  stalledNotice[0]?.title
);
check(
  "ولا تنبيهَ لموقوفٍ قصير",
  buildNotices({
    ...base,
    contractors: [
      contract("23", [
        inst(1, {
          expectedDate: "2026-10-01",
          stalled: true,
          stalledReason: "مادّة",
          stalledAt: "2026-10-18",
        }),
      ]),
    ],
  }).filter((n) => n.id === "milestones-stalled").length === 0
);
check(
  "ولا تنبيهَ بلا مواعيد",
  buildNotices({ ...base, contractors: [contract("24", [inst(1)])] }).filter(
    (n) => String(n.id).startsWith("milestones")
  ).length === 0
);
/*
  والشرطُ على ما يُقاس لا على عبارةٍ يقطعها سطر: فأوّلُ ما كُتب طلب
  جملةً من تعليقٍ موزّعٍ على سطرين، فأخفق على شِفْرٍ صحيح. والمفحوصُ
  أنّ التنبيهاتَ تُجمع: مئةُ مرحلةٍ لا تُخرج مئةَ تنبيه.
*/
const hundred = buildNotices({
  ...base,
  contractors: [
    contract(
      "25",
      Array.from({ length: 100 }, (_, i) =>
        inst(i + 1, { expectedDate: "2026-10-01" })
      )
    ),
  ],
}).filter((n) => String(n.id).startsWith("milestones"));
check(
  "ومئةُ مرحلةٍ لا تُخرج مئةَ تنبيه",
  hundred.length <= 3 && hundred[0]?.count === 100,
  `${hundred.length} تنبيهاتٍ لمئةِ مرحلة`
);

/* ------------------------------------------------------------------ */
console.log("\nوفي الشاشة:\n");

check("صفحةٌ في القائمة", /"متابعة المراحل",/.test(page));
check(
  "والموعدُ يُكتب منها",
  /onSetExpected\(/.test(page) && /type="date"/.test(page)
);
check(
  "والتوقّفُ يُوسَم بسببه",
  /سببُ التوقّف — ولو كلمةً/.test(page) &&
    /فموقوفٌ بلا سببٍ لا يُسأل عنه أحد/.test(page)
);
check(
  "ويومُ التوقّف يُثبت مرّةً",
  /i\.stalledAt \|\| todayISO\(\)/.test(page),
  "فلو كُتب في كلّ تعديلٍ عاد العدّادُ إلى الصفر"
);
check(
  "ومراحلُ بلا موعدٍ تُعرض ليُكتب لها",
  /مراحلُ بلا موعدٍ متوقَّع/.test(page)
);
check(
  "و«عاد العمل» يرفع التوقّف",
  /عاد العمل/.test(page)
);

/* ---- الحفظ ---- */
const back = normalizeState({
  contractors: [
    contract("30", [
      inst(1, {
        expectedDate: "2026-11-01",
        stalled: true,
        stalledReason: "انتظار",
        stalledAt: "2026-10-01",
      }),
    ]),
  ],
}).contractors[0].installments[0];
check(
  "وما كُتب يعود كما كُتب",
  back.expectedDate === "2026-11-01" &&
    back.stalled === true &&
    back.stalledReason === "انتظار" &&
    back.stalledAt === "2026-10-01",
  "فحقلٌ يُحفظ ولا يُحمَّل يسقط صامتاً"
);

/* ------------------------------------------------------------------ */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const { parseBackup } = await jiti.import("../lib/storage.ts");
  const state = parseBackup(fs.readFileSync(BACKUP, "utf8"));
  const live = m.milestones(state.contractors, new Date());
  const summary = m.milestoneSummary(live);
  let undated = 0;
  for (const c of state.contractors) {
    if (c.closure) continue;
    for (const i of c.installments ?? []) {
      if (!i.approved && !i.expectedDate) undated += 1;
    }
  }
  console.log("\nوعلى دفاتر الشركة:\n");
  console.log(
    `     لها موعدٌ متوقَّع: ${live.length} · متأخّرة: ${summary.late.length} · يقرب: ${summary.soon.length} · موقوفة: ${summary.stalled.length}`
  );
  console.log(
    `     ومراحلُ لم تُعتمد وبلا موعد: ${undated} — تُكتب مواعيدُها فتبدأ المتابعة`
  );
}

console.log(
  bad === 0
    ? "\n✓ المتابعة: بموعدٍ يُكتب لا يُولَّد، والموقوفُ ليس متأخّراً، والتنبيهُ يُجمع فلا يُهمَل"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
