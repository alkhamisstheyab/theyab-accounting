/**
 * يفحص قفل دفعات المقاولين لسنة ٢٠٢٥.
 *
 *   node db/check-closed-payments.mjs <نسخة.json>
 *
 * القفل قرارٌ محاسبي لا يُعاد النظر فيه كل يوم، فخطؤه يبقى. ويُخشى منه
 * أمران: أن يُقفل ما قيل إنه يبقى مفتوحاً — دفعةٌ لمشروعٍ قائم لا تُصحَّح
 * بعدها — أو أن يترك مفتوحاً ما قيل إنه أُقفل.
 *
 * فيُفحص على الدفاتر الحقيقية بالعدد والمبلغ كما أُقرّ القرار عليهما.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-closed-payments.mjs <نسخة.json>");
  process.exit(1);
}

const { parseBackup } = await jiti.import("../lib/storage.ts");
const { isClosedContractorPayment, CONTRACTOR_PAYMENTS_CLOSURE } = await jiti.import(
  "../lib/closed-payments.ts"
);
const { isLinkCandidate } = await jiti.import("../lib/contract-links.ts");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const sum = (list) => list.reduce((t, m) => t + Number(m.amount || 0), 0).toFixed(3);

const { movements } = parseBackup(fs.readFileSync(BACKUP, "utf8"));
const rule = CONTRACTOR_PAYMENTS_CLOSURE;

const onContractors2025 = movements.filter(
  (m) =>
    m.fiscalYear === rule.year &&
    (m.debitCode === rule.account || m.creditCode === rule.account)
);
const closed = movements.filter(isClosedContractorPayment);
const open = onContractors2025.filter((m) => !isClosedContractorPayment(m));

console.log(
  `\nدفعات المقاولين في ${rule.year}: ${onContractors2025.length} حركة · ${sum(onContractors2025)} د.ك\n`
);

/* ---- ما أُقرّ عليه القرار ---- */
check("تُقفل ٤٧ حركة", closed.length === 47, String(closed.length));
check("بمبلغ ١٦٬١٥٤٫١٦١", sum(closed) === "16154.161", sum(closed));
check("وتبقى ٤ مفتوحة", open.length === 4, String(open.length));
check("بمبلغ ١٬٣٠٠", sum(open) === "1300.000", sum(open));

/* ---- ما يبقى مفتوحاً هو ما ذُكر فيه مشروعٌ قائم صراحةً ---- */
check(
  "كل مفتوحةٍ مذكورٌ فيها مشروعٌ قائم",
  open.every((m) => rule.openProjects.includes(m.project)),
  [...new Set(open.map((m) => m.project))].join("، ")
);
check(
  "ولا مُقفلةٌ مذكورٌ فيها مشروعٌ قائم",
  closed.every((m) => !rule.openProjects.includes(m.project))
);

/* ---- لا يتجاوز القفل حدوده ---- */
const otherYears = movements.filter(
  (m) => m.fiscalYear !== rule.year && isClosedContractorPayment(m)
);
check("لا يمسّ سنةً غير ٢٠٢٥", otherYears.length === 0, String(otherYears.length));

const otherAccounts = movements.filter(
  (m) =>
    isClosedContractorPayment(m) &&
    m.debitCode !== rule.account &&
    m.creditCode !== rule.account
);
check("ولا حساباً غير ٥١٢٠", otherAccounts.length === 0, String(otherAccounts.length));

/* ---- أداة الربط الجماعي لا تعرضها ---- */
const offered = closed.filter(isLinkCandidate);
check("أداة الربط الجماعي لا تعرض المُقفلة", offered.length === 0, String(offered.length));

const openOffered = open.filter(isLinkCandidate);
check(
  "وتعرض المفتوحة غير المربوطة",
  openOffered.length === open.filter((m) => !m.contractNumber && m.debitCode === rule.account).length,
  `${openOffered.length} من ${open.length}`
);

/* ---- التحويل إلى دفعة مقفلة يُعرف ---- */
const sample = movements.find(
  (m) => m.fiscalYear === 2026 && m.debitCode === rule.account
);
if (sample) {
  const turned = { ...sample, fiscalYear: 2025, project: "مصروفات مشتركة" };
  check("حركةٌ تُعدَّل لتصير دفعةً مقفلة تُعرف فتُرفض", isClosedContractorPayment(turned));
}

console.log(
  bad === 0
    ? "\n✓ القفل: ٤٧ تُقفل و٤ تبقى — كما أُقرّ"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
