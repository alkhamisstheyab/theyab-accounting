/**
 * يفحص استرداد قيود التدقيق من الخادم.
 *
 *   node db/check-merge-audit.mjs <نسخة.json>
 *
 * سجلّ التدقيق لا يُحذف منه شيء على الخادم. فقيدٌ عنده وليس في الجهاز —
 * وقع في جلسةٍ ثم استُبدل سجلّ الجهاز باستيرادٍ كامل — لا يزول بمحوه هناك،
 * بل بأن يستردّه الجهاز.
 *
 * وأخطر ما في الاسترداد أن يكتب فوق شيء، أو يُدخل القيد مرتين، أو يُفسد
 * الترتيب. فيُفحص على السجلّ الحقيقي وعلى ما وقع اليوم بعينه.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-merge-audit.mjs <نسخة.json>");
  process.exit(1);
}

const { parseBackup } = await jiti.import("../lib/storage.ts");
const { mergeAudit, AUDIT_LIMIT } = await jiti.import("../lib/audit.ts");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const log = parseBackup(fs.readFileSync(BACKUP, "utf8")).audit;
console.log(`\nسجلّ الجهاز: ${log.length} قيداً\n`);

/* ما وقع اليوم: ثلاثة قيود أرسلتها جلسةٌ ثم استُبدل السجلّ */
const lost = [
  {
    id: "lost-1",
    at: "2026-09-16T10:30:13.000Z",
    user: "المالك",
    action: "استيراد",
    entity: "بيانات النظام",
    summary: "استبدال كامل للبيانات — 1480 حركة",
  },
  {
    id: "lost-2",
    at: "2026-09-16T10:30:16.000Z",
    user: "ذياب الخميس",
    action: "دخول",
    entity: "جلسة",
    summary: "تسجيل دخول",
  },
  {
    id: "lost-3",
    at: "2026-09-16T10:43:31.000Z",
    user: "ذياب الخميس",
    action: "دخول",
    entity: "جلسة",
    summary: "تسجيل دخول",
  },
];

const merged = mergeAudit(log, lost);

check("القيود الثلاثة تُضاف", merged.length === log.length + 3, `${log.length} ← ${merged.length}`);
check(
  "ولا يُمحى من السجلّ القائم شيء",
  log.every((e) => merged.some((m) => m.id === e.id))
);
check(
  "ولا يُكتب فوق قيدٍ قائم",
  log.every((e) => {
    const m = merged.find((x) => x.id === e.id);
    return m && m.summary === e.summary && m.at === e.at && m.user === e.user;
  })
);

/* مرّة ثانية: لا تكرار */
const twice = mergeAudit(merged, lost);
check("والاسترداد مرّتين لا يكرّر", twice.length === merged.length, `${twice.length}`);

/* قيدٌ موجود أصلاً لا يدخل */
const existing = log[0];
const noop = mergeAudit(log, [existing]);
check("وقيدٌ موجود أصلاً لا يدخل", noop.length === log.length);
check("ولا يُنشئ نسخةً جديدة حين لا شيء يُضاف", noop === log);

/* الترتيب: الأحدث أولاً كما يكتبه appendEntry */
const ordered = merged.every(
  (e, i) => i === 0 || merged[i - 1].at >= e.at
);
check("والترتيب بالوقت، الأحدث أولاً", ordered);

/* قيدٌ بلا معرّف لا يدخل — فلا يتكاثر */
const blank = mergeAudit(log, [{ ...lost[0], id: "" }]);
check("وقيدٌ بلا معرّف لا يدخل", blank.length === log.length);

/* الحدّ */
check(
  `ولا يتجاوز حدّ السجلّ (${AUDIT_LIMIT})`,
  merged.length <= AUDIT_LIMIT
);

console.log(
  bad === 0
    ? "\n✓ الاسترداد: يُضيف ولا يكتب فوق شيء، ولا يكرّر"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
