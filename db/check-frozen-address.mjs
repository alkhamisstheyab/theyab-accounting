/**
 * يفحص منع العناوين المجمَّدة من الكتابة.
 *
 *   node db/check-frozen-address.mjs
 *
 * أخطر ما في هذا الحارس أن يُخطئ في الاتجاه الآخر: أن يردّ العنوان الرئيسي
 * فتتوقّف المزامنة كلها — ولا تُكتب حركة. فيُفحص ذلك أولاً وأشدّ.
 *
 * ولا Vercel هنا، فتُصطنع طلباتٌ بالرؤوس التي يضعها، وبينها أسوأ الاحتمالات:
 * أن يضع في host عنوان النشر نفسه، والعنوان الحقيقي في x-forwarded-host.
 */
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { isFrozenAddress } = await jiti.import("../lib/server/frozen-address.ts");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const DEPLOYMENT = "theyab-accounting-9dq6ot62o-tariq-al-assad-construction.vercel.app";
const PRODUCTION = "theyab-accounting-tariq-al-assad-construction.vercel.app";
const BRANCH = "theyab-accounting-git-main-tariq-al-assad-construction.vercel.app";

const req = (headers) =>
  new Request("https://example.invalid/api/data", { method: "POST", headers });

const withEnv = (value, fn) => {
  const before = process.env.VERCEL_URL;
  if (value === undefined) delete process.env.VERCEL_URL;
  else process.env.VERCEL_URL = value;
  try {
    return fn();
  } finally {
    if (before === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = before;
  }
};

console.log("\nما يجب أن يمرّ — وخطؤه يوقف المزامنة:\n");

withEnv(DEPLOYMENT, () => {
  check("العنوان الرئيسي يكتب", !isFrozenAddress(req({ host: PRODUCTION })));
  check(
    "ولو وضع Vercel عنوان النشر في host والحقيقيّ في x-forwarded-host",
    !isFrozenAddress(req({ host: DEPLOYMENT, "x-forwarded-host": PRODUCTION }))
  );
  check("وعنوان الفرع الذي يتبع آخر نشر يكتب", !isFrozenAddress(req({ host: BRANCH })));
  check(
    "ونطاق الشركة إن أُضيف لاحقاً يكتب",
    !isFrozenAddress(req({ host: "system.tariqalasad.com" }))
  );
});

withEnv(undefined, () => {
  check(
    "وعلى الجهاز — بلا Vercel — لا يُردّ شيء",
    !isFrozenAddress(req({ host: DEPLOYMENT })) && !isFrozenAddress(req({ host: "localhost:3000" }))
  );
});

console.log("\nما يجب أن يُردّ:\n");

withEnv(DEPLOYMENT, () => {
  check("عنوان النشر المجمَّد يُردّ", isFrozenAddress(req({ host: DEPLOYMENT })));
  check(
    "ويُردّ ولو جاء في x-forwarded-host",
    isFrozenAddress(req({ host: PRODUCTION, "x-forwarded-host": DEPLOYMENT }))
  );
  check(
    "ولو اختلفت حالة الحروف",
    isFrozenAddress(req({ host: DEPLOYMENT.toUpperCase() }))
  );
  check("ولو أُلحق به منفذ", isFrozenAddress(req({ host: DEPLOYMENT + ":443" })));
  check(
    "ولو حمل x-forwarded-host أكثر من عنوان — يُؤخذ أوّلها",
    isFrozenAddress(req({ "x-forwarded-host": `${DEPLOYMENT}, proxy.internal` }))
  );
});

console.log(
  bad === 0
    ? "\n✓ الحارس: يردّ العنوان المجمَّد وحده، ولا يمسّ الرئيسي"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
