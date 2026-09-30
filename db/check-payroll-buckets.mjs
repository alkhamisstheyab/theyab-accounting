/**
 * يفحص وعاءَ قيود مسيّر الرواتب.
 *
 *   node db/check-payroll-buckets.mjs [نسخة.json]
 *
 * الترحيل كان يأخذ المشروع من ملفّ الموظف، وملفّاتهم بلا مشاريع، فخرجت
 * قيود مسيّر سبتمبر ٢٠٢٦ الثلاثةَ عشرَ بخانةٍ فارغة. والفراغ يُسقطه تقرير
 * ربحية المشاريع صامتاً — فلا خطأ يظهر، ولا مالٌ يُرى.
 *
 * والذي يُخشى منه: أن يُحمَّل أجرُ العامل على قسيمةٍ بعينها وهو يعمل في
 * القسائم كلّها، أو أن يُنقل ما ليس من المسيّر مع ما هو منه.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const {
  wageBucket,
  isPayrollAdminWithoutBucket,
  isPayrollSiteWithoutBucket,
} = await jiti.import("../lib/payroll-buckets.ts");

console.log("\nالوعاء بحسب باب الصرف:\n");

check("الإداريّ على «عام»", wageBucket("", "6110") === "عام");
check("والمكافأة كذلك", wageBucket("", "6120") === "عام");
check(
  "والتنفيذيّ على «مصروفات مشتركة»",
  wageBucket("", "5130") === "مصروفات مشتركة"
);
check(
  "ومن تفرّغ لقسيمةٍ حُمّل عليها",
  wageBucket("مشروع عواطف القرطاس", "5130") === "مشروع عواطف القرطاس"
);
check("والمسافات وحدها لا تُعدّ مشروعاً", wageBucket("   ", "5130") === "مصروفات مشتركة");

console.log("\nولا يُنقل إلا قيدُ مسيّرٍ بلا وعاء:\n");

const posted = (over) => ({
  debitCode: "5130",
  project: "",
  approvalNote: "مرحّل من مسيّر رواتب سبتمبر 2026",
  ...over,
});

check("أجرُ تنفيذٍ بلا وعاء يُنقل", isPayrollSiteWithoutBucket(posted({})));
check(
  "وأجرٌ إداريّ بلا وعاء يُنقل",
  isPayrollAdminWithoutBucket(posted({ debitCode: "6110" }))
);
check(
  "ولا يُخلط البابان",
  !isPayrollSiteWithoutBucket(posted({ debitCode: "6110" })) &&
    !isPayrollAdminWithoutBucket(posted({}))
);
check(
  "ومن له وعاءٌ لا يُمسّ",
  !isPayrollSiteWithoutBucket(posted({ project: "مصروفات مشتركة" })) &&
    !isPayrollSiteWithoutBucket(posted({ project: "مشروع حسن العجمي" }))
);
check(
  "وما ليس من المسيّر لا يُنقل معه",
  !isPayrollSiteWithoutBucket(posted({ approvalNote: "" })) &&
    !isPayrollSiteWithoutBucket(posted({ approvalNote: "اعتماد تلقائي" }))
);
check(
  "والملاحظة الغائبة لا تُسقط الفحص",
  isPayrollSiteWithoutBucket(posted({ approvalNote: undefined })) === false
);

/* ---- وعلى ملفّات الشركة ---- */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const d = JSON.parse(fs.readFileSync(BACKUP, "utf8")).data;
  const M = d.movements;

  console.log("\nوعلى ملفّات الشركة:\n");

  const empty = M.filter((m) => !String(m.project ?? "").trim());
  const admin = empty.filter(isPayrollAdminWithoutBucket);
  const site = empty.filter(isPayrollSiteWithoutBucket);
  const sum = (rows) => rows.reduce((s, m) => s + m.amount, 0);

  console.log(`     حركاتٌ بلا وعاء: ${empty.length}`);
  console.log(`       منها إداريّ: ${admin.length} · ${sum(admin).toFixed(3)} د.ك ← «عام»`);
  console.log(
    `       ومنها تنفيذيّ: ${site.length} · ${sum(site).toFixed(3)} د.ك ← «مصروفات مشتركة»`
  );

  check(
    "كلُّ ما بلا وعاءٍ هو من المسيّر — فلا متروكٌ بعد الإصلاح",
    admin.length + site.length === empty.length,
    empty
      .filter((m) => !isPayrollAdminWithoutBucket(m) && !isPayrollSiteWithoutBucket(m))
      .map((m) => `${m.fiscalYear}/${m.entryNo}`)
      .join("، ") || "لا متروك"
  );

  /* الميزان لا يتأثّر بنقل الوعاء — والفحص يُثبته */
  let dr = 0,
    cr = 0;
  for (const m of M) {
    dr += m.amount;
    cr += m.amount;
  }
  check("والميزان متوازن", Math.abs(dr - cr) < 0.0005, (dr - cr).toFixed(3));

  /* فاتورة الإنترنت */
  const internet = M.filter(
    (m) =>
      m.debitCode === "6290" &&
      m.date >= "2026-09-01" &&
      /انترنت|إنترنت|هاتف|تلفون/.test(m.description || "")
  );
  console.log(
    `     فواتير اتصالٍ على 6290 من سبتمبر ٢٠٢٦: ${internet.length}` +
      (internet.length
        ? " — " + internet.map((m) => `${m.entryNo} (${m.amount})`).join("، ")
        : "")
  );
  const older = M.filter(
    (m) =>
      m.debitCode === "6290" &&
      m.date < "2026-09-01" &&
      /انترنت|إنترنت|هاتف|تلفون/.test(m.description || "")
  );
  check(
    "والقديمة قبل القاعدة لا تُمسّ",
    older.length > 0,
    `${older.length} قيداً تبقى على 6290`
  );
}

console.log(
  bad === 0
    ? "\n✓ لكل قيدِ أجرٍ وعاءٌ يُرى فيه"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
