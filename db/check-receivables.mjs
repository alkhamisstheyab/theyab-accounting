/**
 * يفحص كشفَ العملاء وحسابَ التأخير.
 *
 *   npm run check:receivables [نسخة.json]
 *
 * وهذه أرقامٌ تُحاور بها عميلاً وتُسلّمه بها ورقة — فخطأٌ فيها ليس
 * خطأً في شاشة، بل مطالبةٌ بما لا يُستحقّ أو تركٌ لحقٍّ يُستحقّ.
 *
 * وأخطرُ ما يُفحص هنا اثنان:
 *
 *   • **ألّا يُحسب المصروفُ مرّتين**: دفعتان متأخّرتان مدّتاهما
 *     متداخلتان، ولو جُمع لكلٍّ ما أُنفق في مدّتها لتضاعف الرقم.
 *
 *   • **ألّا يُدّعى تأخيرٌ بلا تاريخ**: الدفعةُ بلا تاريخ استحقاقٍ
 *     تأخيرُها «لا يُعلم» لا صفر — فالصفرُ دعوى بأن لا تأخير.
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
const { clientStatement, clientStatements, receivedOn } = await jiti.import(
  "../lib/receivables.ts"
);
const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");
const lib = fs.readFileSync(path.join(ROOT, "lib/receivables.ts"), "utf8");

const TODAY = new Date("2026-10-19T00:00:00Z");

/* ------------------------------------------------------------------ */
/* عميلٌ مصنوعٌ: حالاتُه كلُّها معلومةٌ سلفاً                            */
/* ------------------------------------------------------------------ */
const installment = (number, value, extra = {}) => ({
  number,
  value: String(value),
  condition: "",
  status: "",
  approved: true,
  approvedBy: "م. نوح",
  approvedAt: "2026-01-01T00:00:00.000Z",
  approvalNote: "",
  confirmed: true,
  confirmedBy: "ذياب",
  confirmedAt: "2026-01-01T00:00:00.000Z",
  confirmNote: "",
  ...extra,
});

const contract = {
  id: "c1",
  name: "عميلٌ مصنوع",
  specialty: "",
  phone: "",
  project: "مشروعٌ مصنوع",
  contractNumber: "9001",
  contractType: "جاري التنفيذ",
  workType: "بناء",
  contractValue: 100000,
  installmentsCount: 4,
  counterpartyType: "عميل",
  documentType: "عقد",
  parentContractNumber: "",
  contractDate: "2026-01-01",
  delayPenaltyPerDay: 25,
  maxPenaltyPercent: 5,
  installments: [
    /* ١: مستحقّةٌ منذ ١٠٠ يوم، لم يصل منها شيء */
    installment(1, 10000, { dueDate: "2026-07-11", stage: "التجهيز" }),
    /* ٢: مستحقّةٌ منذ ٥٠ يوماً، وصل نصفُها */
    installment(2, 8000, { dueDate: "2026-08-30", stage: "الهيكل" }),
    /* ٣: مستحقّةٌ ووصلت كاملةً — فلا تُعدّ */
    installment(3, 5000, { dueDate: "2026-09-01", stage: "الطابوق" }),
    /* ٤: لم تُقرّ، ووصل عليها مالٌ — سَبْقٌ لا تأخّر */
    installment(4, 7000, { confirmed: false, approved: false, stage: "التشطيب" }),
  ],
};

const movement = (id, date, amount, extra = {}) => ({
  id,
  date,
  fiscalYear: 2026,
  entryNo: id,
  movementType: "إيرادات",
  amount,
  project: "مشروعٌ مصنوع",
  contractNumber: "9001",
  approval: "معتمدة",
  ...extra,
});

const movements = [
  movement("r1", "2026-09-20", 4000, { installmentNumber: 2 }),
  movement("r2", "2026-09-25", 5000, { installmentNumber: 3 }),
  movement("r3", "2026-10-01", 3000, { installmentNumber: 4 }),
  /* ومصروفاتٌ على قسيمته: اثنان في مدّة التأخير وواحدٌ قبلها */
  movement("e1", "2026-06-01", 1000, { movementType: "مصروفات", contractNumber: "" }),
  movement("e2", "2026-08-01", 2500, { movementType: "مصروفات", contractNumber: "" }),
  movement("e3", "2026-10-05", 1500, { movementType: "مصروفات", contractNumber: "" }),
];

const s = clientStatement("مشروعٌ مصنوع", [contract], movements, TODAY);

console.log("\nالمطلوبُ يُحسب من المُقرّ وحده:\n");

check(
  "ما أُقرّ: ١٠٠٠٠ + ٨٠٠٠ + ٥٠٠٠",
  s.due === 23000,
  String(s.due)
);
check("وما قُبض على المُقرّ: ٤٠٠٠ + ٥٠٠٠", s.received === 9000, String(s.received));
check(
  "فالمطلوبُ ١٤٠٠٠",
  s.owed === 14000,
  `${s.owed} — من ${s.items.length} دفعةً`
);
check(
  "والمستوفاةُ لا تُعدّ",
  !s.items.some((i) => i.number === 3),
  "الدفعة ٣ وصلت كاملةً"
);
check(
  "وما لم تُقرّ ليست مطلوبةً، ومالُها سَبْقٌ",
  s.paidAhead === 3000 && !s.items.some((i) => i.number === 4),
  `مقدّماً ${s.paidAhead}`
);

console.log("\nوالتأخير يُقاس بتاريخ الاستحقاق:\n");

check(
  "أقدمُ استحقاقٍ هو الأوّل",
  s.oldestDue === "2026-07-11" && s.items[0].number === 1,
  s.oldestDue
);
check("وأيامُه ١٠٠", s.lateDays === 100, String(s.lateDays));
check(
  "والدفعاتُ مرتَّبةٌ بالأقدم",
  s.items.map((i) => i.number).join(",") === "1,2",
  s.items.map((i) => `${i.number}:${i.lateDays}`).join(" · ")
);
check(
  "ووزنُه مجموعُ (مبلغٍ × أيامه)",
  s.weightedDays === 10000 * 100 + 4000 * 50,
  `${s.weightedDays} دينار·يوم`
);

console.log("\nوما أُنفق في مدّته يُحسب مرّةً لا لكلِّ دفعة:\n");

check(
  "من أقدم استحقاقٍ إلى اليوم: ٢٥٠٠ + ١٥٠٠",
  s.spentWhileLate === 4000,
  `${s.spentWhileLate} من ${s.spentEntries} حركة`
);
check(
  "وما قبل الاستحقاق لا يُحسب",
  s.spentWhileLate !== 5000,
  "مصروفُ ١ يونيو خارج المدّة"
);
check(
  "والمقبوضُ ليس مصروفاً",
  s.spentEntries === 2,
  "الإيراداتُ لا تُعدّ إنفاقاً"
);
/*
  والتداخلُ هو الخطر: مدّةُ الدفعة ١ تشمل مدّةَ الدفعة ٢ كلَّها. فلو
  حُسب لكلٍّ ما أُنفق في مدّتها لبلغ ٤٠٠٠ + ١٥٠٠ = ٥٥٠٠ — وهو تضاعفٌ
  في رقمٍ يُحاور به عميل.
*/
check(
  "ولا يُجمع لكلِّ دفعةٍ على حدة",
  s.spentWhileLate === 4000,
  "وإلا تضاعف المصروفُ بتداخل المدد"
);
check(
  "والحسابُ على المدّة مجموعةً في الشِّفْر",
  /يُحسب على المدّة مجموعةً لا على كلِّ دفعةٍ وحدها/.test(lib)
);

console.log("\nوالغرامةُ التي تسقط عنّا — حُجّةٌ لا ديْن:\n");

check(
  "تُحسب بأيام التأخير × غرامة اليوم",
  s.penaltyWaived === Math.min(100 * 25, 100000 * 0.05),
  `${s.penaltyWaived} — ${s.penaltyBasis}`
);
check("ويُذكر أساسُها", s.penaltyBasis.includes("25"), s.penaltyBasis);
check(
  "ولا تُقيَّد في الدفاتر",
  /حُجّةٌ للشركة لا ديْنٌ على العميل/.test(lib)
);
check(
  "ولا تُكتب في الكشف المسلَّم",
  !/penaltyWaived/.test(
    page.slice(page.indexOf("function ClientStatementSheet"), page.indexOf("function ClientsDuePage"))
  ),
  "ولو كُتبت لصارت مطالبةً بما لا يُستحقّ"
);

/* ---- وشرطُ الأسبوعين ---- */
const soon = {
  ...contract,
  installments: [installment(1, 10000, { dueDate: "2026-10-10" })],
};
const s2 = clientStatement("مشروعٌ مصنوع", [soon], [], TODAY);
check(
  "ولا تقع قبل تجاوز الأسبوعين",
  s2.lateDays === 9 && s2.penaltyWaived === 0,
  `${s2.lateDays} يوماً — ونصُّ العقد: «بمدة تتجاوز أسبوعين»`
);

console.log("\nوبلا تاريخٍ لا يُدّعى تأخير:\n");

const undated = {
  ...contract,
  installments: [installment(1, 10000, { dueDate: undefined })],
};
const s3 = clientStatement("مشروعٌ مصنوع", [undated], [], TODAY);
check("التأخيرُ «لا يُعلم» لا صفر", s3.items[0].lateDays === null);
check("ولا يُحسب له وزن", s3.weightedDays === 0);
check("ولا مصروفٌ في مدّة", s3.spentWhileLate === 0);
check("ولا غرامة", s3.penaltyWaived === 0, "فالصفرُ دعوى بأن لا تأخير");
check(
  "والشاشةُ تقول «لا يُعلم»",
  /لا يُعلم/.test(page) && /بلا تاريخ استحقاق، فلا يُقاس تأخيرُها/.test(page)
);

console.log("\nوالنسبةُ لكلّ دفعةٍ تُقرأ من التوزيع ومن الرقم الواحد:\n");

check(
  "الموزَّعُ يُنسب حصّةً حصّة",
  receivedOn(
    [{ amount: 500, installmentSplits: [{ number: 1, amount: 200 }, { number: 2, amount: 300 }] }],
    1
  ) === 200
);
check(
  "وغيرُ الموزَّع كلُّه لدفعته",
  receivedOn([{ amount: 500, installmentNumber: 3 }], 3) === 500
);
check(
  "ولا يُخلط البابان",
  receivedOn(
    [{ amount: 500, installmentNumber: 3, installmentSplits: [{ number: 1, amount: 200 }] }],
    3
  ) === 0,
  "الموزَّعةُ لا تُحسب مرّةً أخرى برقمها"
);

console.log("\nوفي الشاشة بابٌ إليه:\n");

check("صفحةٌ في القائمة", /"المطلوب من العملاء",/.test(page));
check(
  "مربوطةٌ بصلاحية الاطّلاع على العقود",
  /"المطلوب من العملاء": "contractors\.view"/.test(
    fs.readFileSync(path.join(ROOT, "lib/permissions.ts"), "utf8")
  )
);
check(
  "وتاريخُ الاستحقاق يُكتب من الكشف",
  /onSetDueDate\(/.test(page) && /type="date"/.test(page)
);
check(
  "ويُسجَّل تعديلُه في سجلّ التدقيق",
  /تاريخ استحقاق الدفعة \$\{installmentNumber\}/.test(page)
);
check(
  "ويُكتب وحدَه يومَ اعتماد المهندس",
  /dueDate: approved\s+\? installment\.dueDate \|\| todayISO\(\)/.test(page),
  "ولا يُكتب فوق تاريخٍ صحّحته الإدارة"
);

/* ------------------------------------------------------------------ */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const { parseBackup } = await jiti.import("../lib/storage.ts");
  const state = parseBackup(fs.readFileSync(BACKUP, "utf8"));
  const rows = clientStatements(state.contractors, state.movements, new Date());
  const owing = rows.filter((r) => r.owed > 0.001);
  console.log("\nوعلى دفاتر الشركة:\n");
  for (const r of rows) {
    console.log(
      `     ${String(r.project).padEnd(34)} مطلوب ${String(r.owed).padStart(9)}` +
        (r.paidAhead > 0.001 ? ` · مقدّماً ${r.paidAhead}` : "") +
        (r.lateDays != null ? ` · ${r.lateDays} يوماً` : "")
    );
  }
  const undatedRows = rows.reduce(
    (n, r) => n + r.items.filter((i) => !i.dueDate).length,
    0
  );
  console.log(
    `\n     المطلوب جملةً: ${
      Math.round(owing.reduce((a, r) => a + r.owed, 0) * 1000) / 1000
    } د.ك من ${owing.length} عميلاً`
  );
  if (undatedRows > 0) {
    console.log(
      `     وبلا تاريخ استحقاق: ${undatedRows} دفعةً — تُكتب مرّةً فيُقاس تأخيرُها`
    );
  }
}

console.log(
  bad === 0
    ? "\n✓ الكشف: يُحسب المطلوبُ من المُقرّ، والتأخيرُ بتاريخه، والمصروفُ مرّةً، والغرامةُ حُجّةٌ لا تُطالَب"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
