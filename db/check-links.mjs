/**
 * يعرض ما ستقترحه أداة الربط على نسخةٍ احتياطية حقيقية.
 *
 *   node db/check-links.mjs <نسخة.json> [اسم المشروع]
 *
 * سبب وجوده: تجميع الحركات بكنية من دُفع له مبنيٌّ على أوصافٍ كتبها
 * صاحب الشركة بيده، لا على قاعدةٍ مضمونة. فلا يُعرف أن التجميع نافع
 * إلا بتجربته على أوصافه هو — لا على أمثلةٍ من عندي.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { groupCandidates, linkSummary, planLinks, linkedByInstallment } =
  await jiti.import("../lib/contract-links.ts");

const file = process.argv[2];
if (!file) {
  console.error("الاستعمال: node db/check-links.mjs <نسخة.json> [المشروع]");
  process.exit(1);
}
const project = process.argv[3];

const backup = JSON.parse(fs.readFileSync(file, "utf8"));
const data = backup.data || backup;
const movements = data.movements || [];
const contractors = data.contractors || [];

const s = linkSummary(movements);
console.log(`الحركات: ${movements.length} · العقود: ${contractors.length}`);
console.log(`مرشّحة للربط: ${s.candidates} حركة · ${s.candidatesTotal} د.ك`);
console.log(`مستبعدة (نقليات على حساب المقاولين): ${s.excluded} حركة · ${s.excludedTotal} د.ك`);
console.log(`مرتبطة أصلاً: ${s.linked} حركة · ${s.linkedTotal} د.ك\n`);

const groups = groupCandidates(movements, project);
console.log(`${groups.length} مجموعة:\n`);
console.log(
  "المشروع".padEnd(30) + "من دُفع له".padEnd(36) + "حركات" + "     المبلغ   المدة"
);
console.log("".padEnd(92, "-"));
for (const g of groups) {
  console.log(
    (g.project || "—").slice(0, 28).padEnd(30) +
      g.label.slice(0, 34).padEnd(36) +
      String(g.movements.length).padStart(4) +
      String(g.total).padStart(11) +
      "   " +
      g.from +
      " → " +
      g.to
  );
}

/*
  مقياس النفع: كم قراراً يوفّره التجميع. فإن كانت المجموعات بعدد
  الحركات فالأداة لم تصنع شيئاً.
*/
const single = groups.filter((g) => g.movements.length === 1).length;
console.log(
  `\nالقرارات: ${groups.length} مجموعة بدل ${s.candidates} حركة` +
    ` — منها ${single} مجموعة بحركة واحدة.`
);

/* عيّنة من اقتراح الدفعات على أكبر مجموعة، إن وُجد لمشروعها عقد */
const top = groups[0];
if (top) {
  const candidates = contractors.filter((c) => c.project === top.project);
  if (candidates.length > 0) {
    const contract = candidates[0];
    console.log(
      `\nمثال — «${top.label}» على العقد ${contract.contractNumber} (${contract.name}):`
    );
    const plan = planLinks(
      top.movements,
      contract,
      linkedByInstallment(movements, contract.contractNumber)
    );
    for (const row of plan) {
      console.log(
        "  " +
          row.movement.date +
          "  " +
          String(row.movement.amount).padStart(9) +
          "  ← " +
          (row.installmentNumber ? "الدفعة " + row.installmentNumber : "بلا دفعة").padEnd(12) +
          row.reason
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/* محاكاة: هل يظهر الربط في «المدفوع» فعلاً؟                            */
/* ------------------------------------------------------------------ */

/*
  الربط بلا أثرٍ في «المدفوع» ربطٌ صوري. فتُطبَّق الخطة على نسخةٍ من
  الحركات، ويُعاد حساب مدفوع العقد من الحساب نفسه الذي تقرؤه الشاشة.
*/
if (top && contractors.length > 0) {
  const contract =
    contractors.find((c) => c.project === top.project) ?? contractors[0];
  const plan = planLinks(
    top.movements,
    contract,
    linkedByInstallment(movements, contract.contractNumber)
  );
  const linked = new Map(plan.map((r) => [r.movement.id, r]));
  const after = movements.map((m) => {
    const r = linked.get(m.id);
    return r
      ? { ...m, contractNumber: contract.contractNumber, installmentNumber: r.installmentNumber }
      : m;
  });

  const paidBefore = linkedByInstallment(movements, contract.contractNumber);
  const paidAfter = linkedByInstallment(after, contract.contractNumber);
  const sum = (m) => [...m.values()].reduce((a, b) => a + b, 0);
  const planned = plan.reduce((a, r) => a + (Number(r.movement.amount) || 0), 0);

  console.log(`\nمحاكاة على العقد ${contract.contractNumber} (${contract.name}):`);
  console.log(`  المدفوع قبل الربط: ${Math.round(sum(paidBefore) * 1000) / 1000}`);
  console.log(`  المخطَّط ربطه:      ${Math.round(planned * 1000) / 1000}`);
  console.log(`  المدفوع بعد الربط: ${Math.round(sum(paidAfter) * 1000) / 1000}`);

  const ok = Math.abs(sum(paidAfter) - sum(paidBefore) - planned) < 0.001;
  console.log(
    ok
      ? "  \u2713 الفرق يساوي المخطَّط بالضبط — الربط يظهر في المدفوع"
      : "  \u2717 الفرق لا يساوي المخطَّط"
  );
  if (!ok) process.exit(1);
}
