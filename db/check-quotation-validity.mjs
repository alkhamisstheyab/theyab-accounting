/**
 * يفحص صلاحية عروض الأسعار وما يُمحى بها.
 *
 *   node db/check-quotation-validity.mjs <نسخة.json>
 *
 * المحو لا رجعة فيه، فلا يكفي أن تُقرأ القاعدة فتبدو صحيحة: تُجرّب على
 * العروض الحقيقية وعلى ما قد يقع بعد شهر وشهرين.
 *
 * وأهمّ ما يُفحص أن ما لا يجوز محوه لا يُمحى:
 *   • المقبول — هو أصل العقد وسندُه.
 *   • المرتبط برقم عقد ولو لم تتغيّر حالته.
 *   • المسودة — لا مدّة لها، فالمدّة تبدأ يوم يخرج العرض إلى العميل.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-quotation-validity.mjs <نسخة.json>");
  process.exit(1);
}

const { parseBackup } = await jiti.import("../lib/storage.ts");
const { partitionExpired, isExpired, isBindingQuotation, validUntil, daysLeft } =
  await jiti.import("../lib/quotations.ts");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const state = parseBackup(fs.readFileSync(BACKUP, "utf8"));
const quotations = state.quotations;
const TODAY = new Date().toISOString().slice(0, 10);

console.log(`\nعروض الأسعار: ${quotations.length} · اليوم ${TODAY}\n`);

const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - String(s).length));
console.log(
  "  " + pad("الرقم", 13) + pad("الحالة", 9) + pad("قُدِّم", 12) + pad("ينقضي", 12) + "الحال"
);
console.log("  " + "-".repeat(58));
for (const q of quotations) {
  const until = validUntil(q);
  const left = daysLeft(q, TODAY);
  const verdict = isBindingQuotation(q)
    ? "سند عقد — لا يُمحى"
    : !until
      ? "لم يُقدَّم — لا مدّة له"
      : left < 0
        ? `انقضى منذ ${-left} يوماً — يُمحى`
        : `بقي ${left} يوماً`;
  console.log(
    "  " +
      pad(q.number, 13) +
      pad(q.status, 9) +
      pad(q.submittedAt || "—", 12) +
      pad(until || "—", 12) +
      verdict
  );
}
console.log("");

/* ---- 1. لا شيء من عروضه يُمحى اليوم ---- */
const now = partitionExpired(quotations, TODAY);
check(
  "لا يُمحى شيء من العروض القائمة اليوم",
  now.expired.length === 0,
  now.expired.map((q) => q.number).join("، ")
);

/* ---- 2. المسودّة لا تنقضي مهما طال الزمن ---- */
const drafts = quotations.filter((q) => q.status === "مسودة");
const farFuture = "2030-01-01";
const later = partitionExpired(quotations, farFuture);
const draftsGone = later.expired.filter((q) => q.status === "مسودة");
check(
  `المسودّات تبقى ولو بعد سنوات (${drafts.length} مسودة)`,
  draftsGone.length === 0,
  draftsGone.map((q) => q.number).join("، ")
);

/* ---- 3. المقبول لا يُمحى ولو انقضى ---- */
const binding = quotations.filter(isBindingQuotation);
const bindingGone = later.expired.filter(isBindingQuotation);
check(
  `المقبول وسند العقد لا يُمحى (${binding.length}: ${binding.map((q) => q.number).join("، ")})`,
  bindingGone.length === 0,
  bindingGone.map((q) => q.number).join("، ")
);

/* ---- 4. وما قُدِّم وانقضى يُمحى فعلاً ---- */
const submitted = {
  ...quotations[0],
  id: "q-fahs-1",
  number: "Q-فحص-001",
  status: "مقدَّم",
  contractNumber: "",
  submittedAt: "2026-01-01",
  validityDays: 30,
};
check(
  "عرضٌ قُدِّم وانقضت مدّته يُمحى",
  partitionExpired([submitted], TODAY).expired.length === 1
);

/* ---- 5. وقبل انقضائها لا يُمسّ ---- */
const fresh = { ...submitted, id: "q-fahs-2", submittedAt: TODAY };
check(
  "وقبل انقضائها لا يُمسّ",
  partitionExpired([fresh], TODAY).expired.length === 0,
  `بقي ${daysLeft(fresh, TODAY)} يوماً`
);

/* ---- 6. اليوم الأخير ما زال سارياً ---- */
const lastDay = {
  ...submitted,
  id: "q-fahs-3",
  submittedAt: new Date(new Date(TODAY).getTime() - 30 * 86400000)
    .toISOString()
    .slice(0, 10),
};
check(
  "يوم الانقضاء نفسه ما زال سارياً لا منقضياً",
  !isExpired(lastDay, TODAY) && daysLeft(lastDay, TODAY) === 0,
  `بقي ${daysLeft(lastDay, TODAY)}`
);

const dayAfter = {
  ...submitted,
  id: "q-fahs-4",
  submittedAt: new Date(new Date(TODAY).getTime() - 31 * 86400000)
    .toISOString()
    .slice(0, 10),
};
check("واليوم الذي يليه ينقضي", isExpired(dayAfter, TODAY));

/* ---- 7. المرفوض يُمحى كغيره ---- */
const rejected = { ...submitted, id: "q-fahs-5", status: "مرفوض" };
check("المرفوض المنقضي يُمحى كغيره", partitionExpired([rejected], TODAY).expired.length === 1);

/* ---- 8. مقبولٌ بلا رقم عقد لا يُمحى أيضاً ---- */
const accepted = { ...submitted, id: "q-fahs-6", status: "مقبول", contractNumber: "" };
check(
  "والمقبول ولو بلا رقم عقد لا يُمحى",
  partitionExpired([accepted], TODAY).expired.length === 0
);

/* ---- 9. ومربوطٌ بعقدٍ وحالته «مقدَّم» لا يُمحى ---- */
const linked = { ...submitted, id: "q-fahs-7", contractNumber: "2010" };
check(
  "والمرتبط بعقدٍ لا يُمحى وإن بقيت حالته «مقدَّم»",
  partitionExpired([linked], TODAY).expired.length === 0
);

/* ---- 10. الترقية: ما كان غير مسودة ولا ختم له يأخذ تاريخه ---- */
const migrated = parseBackup(
  JSON.stringify({
    data: {
      quotations: [
        { id: "x1", number: "Q-قديم-1", status: "مرفوض", date: "2026-01-05", lines: [] },
        { id: "x2", number: "Q-قديم-2", status: "مسودة", date: "2026-01-05", lines: [] },
      ],
    },
  })
);
const [old1, old2] = migrated.quotations;
check(
  "الترقية تعطي المقدَّم القديم تاريخه ختماً",
  old1.submittedAt === "2026-01-05",
  String(old1.submittedAt)
);
check("ولا تعطي المسودة ختماً", !old2.submittedAt, String(old2.submittedAt));

console.log(
  bad === 0
    ? "\n✓ الصلاحية: تنقضي في وقتها، وما هو سندُ عقدٍ لا يُمحى"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
