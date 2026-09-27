/**
 * يفحص تنبيهات وثائق العمالة — الإقامة وإذن العمل.
 *
 *   node db/check-staff-documents.mjs [نسخة.json]
 *
 * انتهاء الإقامة ليس تأخيراً إدارياً: غرامةٌ تُحسب باليوم، والعمل بإذنٍ
 * منتهٍ مسؤوليةٌ على الشركة. وكان التنبيه لا يظهر إلا لمن يفتح شاشة
 * الموظفين — ومن لا يفتحها لا يعلم — فصار يُعرض على من يدخل النظام.
 *
 * والذي يُخشى منه:
 *   • أن يُنبَّه إلى كويتيٍّ لا إقامة له ولا إذن عمل.
 *   • أن تمرّ وثيقةٌ منتهية بلا تنبيه لأن تاريخها لم يُسجَّل أصلاً.
 *   • أن يُنبَّه من لا يملك الاطّلاع على ملفّ الموظفين.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { staffDocuments, DOCUMENT_ALERT_DAYS, buildNotices } = await jiti.import(
  "../lib/notifications.ts"
);

const TODAY = "2026-09-27";
const person = (over) => ({
  id: "e-" + Math.random().toString(36).slice(2),
  name: "عامل",
  active: true,
  isKuwaiti: false,
  residencyExpiry: "",
  workPermitExpiry: "",
  ...over,
});

console.log("\nالوثائق تُقرأ على حالها:\n");

const rows = staffDocuments(
  [
    person({ name: "منتهية إقامته", residencyExpiry: "2026-09-01", workPermitExpiry: "2027-01-01" }),
    person({ name: "قريبٌ انتهاؤه", residencyExpiry: "2026-10-07", workPermitExpiry: "2027-01-01" }),
    person({ name: "بعيدٌ أجله", residencyExpiry: "2027-06-01", workPermitExpiry: "2027-06-01" }),
    person({ name: "بلا وثائق" }),
    person({ name: "كويتي", isKuwaiti: true }),
    person({ name: "من ترك العمل", active: false }),
  ],
  TODAY
);

check(
  "المنتهية تُفرَز وحدها",
  rows.expired.length === 1 && rows.expired[0].employee.name === "منتهية إقامته",
  `${rows.expired.length} · ${rows.expired[0]?.days} يوماً`
);
check(
  "والقريبة وحدها",
  rows.soon.length === 1 && rows.soon[0].days === 10,
  `${rows.soon.length} · بعد ${rows.soon[0]?.days} يوماً`
);
check("والبعيدة لا تُزعج", !rows.soon.some((r) => r.date === "2027-06-01"));
check(
  "وغير المسجَّلة تُكشف — الوثيقة التي لا تاريخ لها لا تُنبّه أحداً",
  rows.missing.length === 2,
  `${rows.missing.length}`
);
check(
  "والكويتي لا يُسأل عن إقامةٍ ولا إذن",
  ![...rows.expired, ...rows.soon, ...rows.missing].some(
    (r) => r.employee.name === "كويتي"
  )
);
check(
  "ومن ترك العمل لا يُنبَّه إليه",
  ![...rows.expired, ...rows.soon, ...rows.missing].some(
    (r) => r.employee.name === "من ترك العمل"
  )
);
check("والمهلة ستون يوماً", DOCUMENT_ALERT_DAYS === 60);

console.log("\nوتصل صاحبها في الصفحة الرئيسية:\n");

const notices = buildNotices({
  movements: [],
  contractors: [],
  projects: [],
  employees: [
    person({ name: "منتهية إقامته", residencyExpiry: "2026-09-01" }),
    person({ name: "قريبٌ انتهاؤه", workPermitExpiry: "2026-10-07" }),
  ],
  quotations: [],
  workItems: [],
  audit: [],
  backup: null,
  lastSeenAt: "",
  userName: "ذياب",
  today: TODAY,
  backupEveryDays: 10,
});

const byId = (id) => notices.find((n) => n.id === id);
check("المنتهية إشعارُ عمل", byId("documents-expired")?.tone === "action");
check("والقريبة تنبيه", byId("documents-expiring")?.tone === "warn");
check("وغير المسجَّلة خبر", byId("documents-missing")?.tone === "info");
check(
  "وكلُّها تُحيل إلى شاشة الموظفين",
  ["documents-expired", "documents-expiring", "documents-missing"].every(
    (id) => byId(id)?.page === "الموظفون"
  )
);
check(
  "ولا تُعرض إلا لمن يطّلع على ملفّهم",
  byId("documents-expired")?.needs === "employees.view"
);
check(
  "ويُذكر في الإشعار كم مضى وكم بقي",
  /منذ \d+ يوماً/.test(byId("documents-expired")?.detail ?? "") &&
    /بعد \d+ يوماً/.test(byId("documents-expiring")?.detail ?? "")
);

/* ---- وعلى الدفاتر الحقيقية إن أُعطيت ---- */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const store = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.localStorage = globalThis.window.localStorage;
  const { parseBackup } = await jiti.import("../lib/storage.ts");
  const state = parseBackup(fs.readFileSync(BACKUP, "utf8"));
  const real = staffDocuments(state.employees, TODAY);

  console.log("\nوعلى دفاتر الشركة:\n");
  for (const r of real.expired) {
    console.log(`     ✗ ${r.employee.name}: ${r.label} منتهية منذ ${Math.abs(r.days)} يوماً`);
  }
  for (const r of real.soon) {
    console.log(`     ! ${r.employee.name}: ${r.label} بعد ${r.days} يوماً (${r.date})`);
  }
  console.log(`     · غير مسجَّلة: ${real.missing.length} وثيقة`);
  check(
    "لا وثيقة منتهية على رأس العمل",
    real.expired.length === 0,
    real.expired.length ? "تُجدَّد قبل الغرامة" : "الحمد لله"
  );
}

console.log(
  bad === 0
    ? "\n✓ الإقامة وإذن العمل يُنبَّه إليهما قبل الانقضاء، والكويتي لا يُسأل عنهما"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
