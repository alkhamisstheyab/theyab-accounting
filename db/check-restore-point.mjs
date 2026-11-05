/**
 * يفحص نقطةَ الأمان — ومحوَها.
 *
 *   npm run check:restore-point
 *
 * وقعت هذه في ٥ نوفمبر ٢٠٢٦: أتمّ صاحبُ الشركة حركاتِ يومه وأراد
 * الحفظَ، فجاءه بالأحمر «تعذّر الحفظ في التخزين المحلي — قد تكون
 * المساحة ممتلئة».
 *
 * ودفاترُه ٢٫٦ ميغا (الحضور ٩٤٠ ك.ب · الحركات ٨٢٧ · التدقيق ٤٥٠ ·
 * العقود ٢٧٥)، وحدُّ المتصفّح نحو خمسة. و«نقطةُ الأمان» — صورةٌ كاملةٌ
 * من التخزين تُؤخذ قبل أوّل كتابةٍ في كلّ جلسة — مثلُها. فصار المحفوظ
 * نسختين، فامتلأت المساحة. **فكانت الحمايةُ سببَ الخلل الذي بُنيت
 * لتمنعه.**
 *
 * وشاشةُ الإعدادات تعرض زرَّ الاستعادة وحدَه — وهو الخطر: يُرجع الجهازَ
 * إلى ما قبل أوّل تعديلٍ في الجلسة فيضيع عملُ اليوم — ولا تعرض المحوَ
 * وهو السلامة. فقال: «هناك زرّ استعادة نقطة الامان» — ليس غيره.
 *
 * فثلاثةٌ تُحرس هنا:
 *   ١) للنقطة زرُّ محوٍ لا زرُّ استعادةٍ وحدَه، ويُقال حجمُها.
 *   ٢) ولا تُؤخذ إن كانت ستُضاعف ما لا يحتمله التخزين.
 *   ٣) ولا تُؤخذ ناقصةً أبداً — فصورةٌ فيها بعضُ المجموعات واستُعيدت
 *      خلطت قديماً بجديد.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const read = (rel) =>
  fs.readFileSync(path.join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

const store = read("lib/storage.ts");
const page = read("app/page.tsx");

/* ------------------------------------------------------------------ */
console.log("\nوللنقطة بابُ محوٍ لا بابُ استعادةٍ وحدَه:\n");

check(
  "الدالّةُ موجودةٌ ومصدَّرة",
  /export function clearRestorePoint\(\): boolean/.test(store)
);
check(
  "وتمحو المفتاحَ نفسَه الذي كُتب",
  /localStorage\.removeItem\(RESTORE_KEY\)/.test(store)
);
check(
  "ولا تُؤخذ ثانيةً في الجلسة نفسِها",
  /sessionStorage\.setItem\("restorePointTaken", "1"\)/.test(
    store.slice(store.indexOf("export function clearRestorePoint"))
  ),
  "وإلّا مُحيت ثمّ كُتبت فوراً فلم تُفرَّغ مساحة"
);
check("والشاشةُ فيها زرُّ المحو", /امحُ نقطة الأمان وفرّغ المساحة/.test(page));
check(
  "وهو يستدعيها",
  /if \(clearRestorePoint\(\)\) window\.location\.reload\(\);/.test(page)
);
check(
  "ويُقال في الشاشة حجمُها",
  /point\.bytes \/ 1024 \/ 1024/.test(page),
  "فمن لا يعرف أنّها ٢٫٦ ميغا لا يعرف لماذا امتلأ تخزينُه"
);
check(
  "ويُطمأن أنّ الدفاتر لا تُمَسّ",
  /لا يُمسّ شيءٌ من دفاترك/.test(page.replace(/\s+/g, " ")),
  "فزرٌّ فيه لفظُ «محو» لا يُضغط بلا بيان"
);

/* ------------------------------------------------------------------ */
console.log("\nولا تُضاعِف ما لا يحتمله التخزين:\n");

check(
  "لها حدُّ حجمٍ مكتوب",
  /const RESTORE_MAX_BYTES = [\d_]+;/.test(store)
);

const limit = Number(
  (store.match(/const RESTORE_MAX_BYTES = ([\d_]+);/) ?? [])[1]?.replace(
    /_/g,
    ""
  )
);
check(
  "والحدُّ أقلُّ من نصف ما يسمح به المتصفّح",
  limit > 0 && limit < 2_500_000,
  `${(limit / 1024 / 1024).toFixed(2)} ميغا — والنقطةُ صورةٌ ثانية، فمجموعُهما ضِعفُه`
);
check(
  "ويُقاس المجموعُ قبل الكتابة",
  /bytes \+= value\.length;/.test(store) &&
    /if \(bytes > RESTORE_MAX_BYTES\)/.test(store)
);
check(
  "وإن تجاوز مُحيت القديمةُ ولم تُكتب جديدة",
  /if \(bytes > RESTORE_MAX_BYTES\) \{\s*\n\s*localStorage\.removeItem\(RESTORE_KEY\);/.test(
    store
  ),
  "فنقطةٌ قديمةٌ باقيةٌ تملأ المساحةَ ولا تُفيد"
);

/* ------------------------------------------------------------------ */
console.log("\nولا تُؤخذ ناقصة:\n");

const capture = store.slice(
  store.indexOf("export function captureRestorePoint"),
  store.indexOf("export function readRestorePoint")
);
check(
  "لا تصفيةَ على المجموعات — إمّا كاملةً وإمّا لا شيء",
  !/\.filter\(/.test(capture) && /for \(const key of Object\.values\(KEYS\)\)/.test(capture),
  "فصورةٌ فيها بعضُها واستُعيدت خلطت قديماً بجديد"
);
check(
  "والخروجُ قبل الكتابة لا بعدها",
  capture.indexOf("if (bytes > RESTORE_MAX_BYTES)") <
    capture.indexOf("localStorage.setItem(\n      RESTORE_KEY")
);

console.log(
  bad === 0
    ? "\n✓ نقطةُ الأمان تُمحى كما تُستعاد، ولا تُؤخذ إن ملأت التخزين"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
