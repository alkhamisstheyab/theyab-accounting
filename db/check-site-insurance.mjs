/**
 * يفحص تأمين مواقع المشاريع وتنبيه تجديده.
 *
 *   node db/check-site-insurance.mjs <نسخة.json>
 *
 * طلبُ صاحب الشركة في ٢١ سبتمبر ٢٠٢٦: لكل مشروعٍ وثيقةُ تأمينٍ على من
 * يعمل فيه، لها تاريخ انتهاء. وانتهاؤها والعمل قائم مسؤوليةٌ على
 * الشركة، ولا يُعرف إلا بالسؤال. فيُنبَّه إليها قبل انقضائها بمدّةٍ
 * تكفي للتجديد.
 *
 * والذي يُخشى منه:
 *   • أن تُحفظ الوثيقة فلا تعود عند إعادة الفتح.
 *   • أن يأتي التنبيه بعد الانتهاء لا قبله.
 *   • أن يُنبَّه إلى مشاريع مغلقة لا عاملَ فيها.
 *   • أن يُنسى المشروع الذي لا وثيقة له أصلاً — وهو أخطرها.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-site-insurance.mjs <نسخة.json>");
  process.exit(1);
}

const { parseBackup, exportBackup } = await jiti.import("../lib/storage.ts");
const { projectInsurance, INSURANCE_ALERT_DAYS, buildNotices } = await jiti.import(
  "../lib/notifications.ts"
);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const TODAY = "2026-09-21";
const shift = (days) => {
  const d = new Date(TODAY + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const state = parseBackup(fs.readFileSync(BACKUP, "utf8"));
const BUCKETS = ["عام", "مصروفات مشتركة"];
const active = state.projects.filter(
  (p) => p.status === "نشط" && !BUCKETS.includes(p.name)
);
check("مشاريع نشطة في النسخة", active.length >= 4, `${active.length}`);

/* أربع حالات: سارٍ، يقترب، منتهٍ، وبلا وثيقة */
const cases = [
  { name: active[0].name, end: shift(200), want: "سارٍ" },
  { name: active[1].name, end: shift(INSURANCE_ALERT_DAYS - 1), want: "يقترب" },
  { name: active[2].name, end: shift(-5), want: "منتهٍ" },
  { name: active[3].name, end: "", want: "غير مسجّل" },
];

const withPolicies = {
  ...state,
  projects: state.projects.map((p) => {
    const c = cases.find((x) => x.name === p.name);
    if (!c || !c.end) return p;
    return {
      ...p,
      insurer: "الشركة العربية الإسلامية للتأمين التكافلي",
      policyNumber: "POL-" + c.want,
      insuranceStart: shift(-160),
      insuranceEnd: c.end,
      insuranceValue: 120,
      insuranceNote: "تأمين على العاملين في الموقع",
    };
  }),
};

console.log("\nالحالات الأربع:\n");

const rows = new Map(
  projectInsurance(withPolicies.projects, TODAY).map((r) => [r.project.name, r])
);
for (const c of cases) {
  const row = rows.get(c.name);
  check(
    `«${c.name}» ← ${c.want}`,
    row?.state === c.want,
    `${row?.state ?? "—"}${row && c.end ? ` · ${row.daysLeft} يوماً` : ""}`
  );
}

/* الحدّ نفسه: يومٌ قبل المدّة يُنبَّه، ويومٌ بعدها لا */
const edge = (days) =>
  projectInsurance(
    [{ ...active[0], insuranceEnd: shift(days) }],
    TODAY
  )[0].state;
check(
  `التنبيه يبدأ قبل الانتهاء بـ ${INSURANCE_ALERT_DAYS} يوماً بالضبط`,
  edge(INSURANCE_ALERT_DAYS) === "يقترب" &&
    edge(INSURANCE_ALERT_DAYS + 1) === "سارٍ",
  `${edge(INSURANCE_ALERT_DAYS)} ← ${edge(INSURANCE_ALERT_DAYS + 1)}`
);
check("ويومُ الانتهاء نفسه ليس منتهياً بعد", edge(0) === "يقترب");
check("وما بعده منتهٍ", edge(-1) === "منتهٍ");

/* المشروع المغلق لا يُنبَّه إليه — لا عاملَ فيه */
const closed = projectInsurance(
  [{ ...active[2], status: "مغلق", insuranceEnd: shift(-5) }],
  TODAY
);
check("والمشروع المغلق لا يُنبَّه إليه", closed.length === 0);

/* الوعاءان المحاسبيان ليسا موقعَ عمل */
check(
  "و«عام» و«مصروفات مشتركة» خارج التأمين — لا موقعَ لهما",
  projectInsurance(
    BUCKETS.map((name) => ({ id: name, name, budget: 0, startDate: "", status: "نشط" })),
    TODAY
  ).length === 0
);

console.log("\nالإشعارات على الشاشة الرئيسية:\n");

const notices = buildNotices({
  movements: withPolicies.movements,
  contractors: withPolicies.contractors,
  projects: withPolicies.projects,
  quotations: withPolicies.quotations,
  workItems: withPolicies.workItems,
  audit: withPolicies.audit,
  backup: null,
  today: TODAY,
  lastSeenAt: TODAY,
  userName: "ذياب الخميس",
  backupEveryDays: 10,
});

const byId = (id) => notices.find((n) => n.id === id);
check("إشعارٌ بالمنتهي", Boolean(byId("insurance-expired")), byId("insurance-expired")?.title);
check("وإشعارٌ بالمقترب", Boolean(byId("insurance-expiring")), byId("insurance-expiring")?.title);
check(
  "وإشعارٌ بمن لا وثيقة له",
  Boolean(byId("insurance-missing")),
  byId("insurance-missing")?.title
);
check(
  "وكلّها تحيل إلى شاشة المشاريع وتشترط صلاحيتها",
  ["insurance-expired", "insurance-expiring", "insurance-missing"].every(
    (id) => byId(id)?.page === "المشاريع" && byId(id)?.needs?.startsWith("projects.")
  )
);
check(
  "والمنتهي أشدّها — فهو إجراءٌ لا خبر",
  byId("insurance-expired")?.tone === "action"
);

/* وثيقةٌ سارية لا إشعار لها */
const allValid = buildNotices({
  movements: state.movements,
  contractors: state.contractors,
  projects: state.projects.map((p) => ({ ...p, insuranceEnd: shift(200) })),
  quotations: state.quotations,
  workItems: state.workItems,
  audit: state.audit,
  backup: null,
  today: TODAY,
  lastSeenAt: TODAY,
  userName: "ذياب الخميس",
  backupEveryDays: 10,
});
check(
  "ولا إشعار حين تكون الوثائق كلّها سارية",
  !allValid.some((n) => n.id.startsWith("insurance-"))
);

console.log("\nوتُحفظ فتعود:\n");

const reread = parseBackup(exportBackup(withPolicies));
const back = reread.projects.find((p) => p.name === cases[0].name);
check(
  "الوثيقة تعود من النسخة الاحتياطية كاملة",
  back.insurer === "الشركة العربية الإسلامية للتأمين التكافلي" &&
    back.policyNumber === "POL-سارٍ" &&
    back.insuranceEnd === cases[0].end &&
    back.insuranceValue === 120,
  `${back.insurer ?? "—"} · ${back.insuranceEnd ?? "—"}`
);
check(
  "والمشاريع بلا وثيقة تبقى بلا حقولٍ فارغة تُلبِس",
  reread.projects
    .filter((p) => !cases.some((c) => c.name === p.name && c.end))
    .every((p) => p.insuranceEnd === undefined)
);

console.log(
  bad === 0
    ? "\n✓ تأمين الموقع يُسجَّل ويُحفظ، والتنبيه يسبق الانتهاء بشهر"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
