/**
 * يفحص أنّ كلَّ مجموعةٍ تُحفظ تُحلُّ في الشاشة أيضاً.
 *
 *   npm run check:install
 *
 * وعلّتُه علّةٌ وقعت: أُضيفت ثلاثُ مجموعاتٍ — الرسائلُ والأطرافُ
 * وتقاريرُ الاجتماعات — فكُتبت في الحفظ وفي الخادم وفي التسوية، ونُسيت
 * في موضعين: `applyWholeState` ودالّةِ الإقلاع. فصار الحفظُ يكتبها
 * والتحميلُ لا يقرؤها.
 *
 * ولم تظهر العلّةُ في أيِّ فحصٍ قائم: الحالةُ تُسوّى صحيحةً، والخادمُ
 * يحفظ ويُرجع، والتسويةُ تردّ ما كُتب. والشاشةُ وحدَها لا تقرأ. فأرسل
 * صاحبُ الشركة خمسةَ طلباتٍ ووصلت الخادمَ، ثمّ حدّث الصفحة فقالت له
 * «لم تطلب من أحدٍ شيئاً بعد» — وأعاد السؤال ثلاثَ مرّات.
 *
 * والتحذيرُ كان مكتوباً فوق الدالّة نفسِها: «نسيان مجموعةٍ منها لا
 * يظهر إلا حين يفتح صاحبها شاشتها فيجدها خاوية». فالتعليقُ لا يحرس،
 * والفحصُ يحرس.
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
const { emptyState } = await jiti.import("../lib/storage.ts");

const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");

/** جسمُ دالّةٍ من أوّلها إلى أوّل `};` بعدها */
const bodyOf = (opener) => {
  const at = page.indexOf(opener);
  if (at < 0) throw new Error(`لا موضع: ${opener}`);
  const end = page.indexOf("\n  };", at);
  return page.slice(at, end < 0 ? page.length : end);
};

/* مجموعاتُ الحالة كما هي في lib/storage.ts — لا قائمةً مكتوبةً بيدٍ هنا */
const fields = Object.keys(emptyState());

console.log(`\nمجموعاتُ الحالة: ${fields.length}\n`);

/* ---- ١) تُحلّ عند إحلال حالةٍ كاملة ---- */
const whole = bodyOf("const applyWholeState = (state: AppState) => {");
const missingWhole = fields.filter((f) => !whole.includes(`state.${f}`));
check(
  "applyWholeState تُحلّ كلَّ مجموعة",
  missingWhole.length === 0,
  missingWhole.length ? `ناقصٌ: ${missingWhole.join(" · ")}` : `${fields.length} مجموعة`
);

/* ---- ٢) وتُقرأ عند الإقلاع ---- */
/*
  ودالّةُ الإقلاع لا تُحدّ بـ`};` فجسمُها طويلٌ فيه دوالُّ أخرى —
  فتُقرأ من `const { state, errors } = loadState();` إلى `setLoaded(true)`.
*/
const bootAt = page.indexOf("const { state, errors } = loadState();");
const bootEnd = page.indexOf("setLoaded(true);", bootAt);
check(
  "ودالّةُ الإقلاع موجودة",
  bootAt > 0 && bootEnd > bootAt
);
const boot = page.slice(bootAt, bootEnd);

/*
  وبعضُ المجموعات تُحلّ في الإقلاع بوجهٍ آخر: العروضُ تُنقّى من
  المنقضي، والسنةُ تُشتقّ، والإعداداتُ تُقرأ من موضعها. فيُطلب أن
  يُذكر اسمُها لا أن تُحلّ حرفيّاً.
*/
const missingBoot = fields.filter(
  (f) => !boot.includes(`state.${f}`) && !boot.includes(`${f},`)
);
check(
  "والإقلاعُ يقرأ كلَّ مجموعة",
  missingBoot.length === 0,
  missingBoot.length ? `ناقصٌ: ${missingBoot.join(" · ")}` : `${fields.length} مجموعة`
);

/* ---- ٣) وتُحفظ ---- */
const saveAt = page.indexOf("    const state = {", bootEnd);
const saveEnd = page.indexOf("};", saveAt);
const save = page.slice(saveAt, saveEnd);
const missingSave = fields.filter((f) => !new RegExp(`\\b${f},`).test(save));
check(
  "والحفظُ يكتب كلَّ مجموعة",
  missingSave.length === 0,
  missingSave.length ? `ناقصٌ: ${missingSave.join(" · ")}` : `${fields.length} مجموعة`
);

/* ---- ٤) والثلاثُ المستجدّةُ بأسمائها ---- */
console.log("\nوالثلاثُ التي سقطت أوّلَ مرّة:\n");
for (const field of ["messages", "parties", "minutes"]) {
  check(
    `«${field}» تُحلّ وتُقرأ وتُحفظ`,
    whole.includes(`state.${field}`) &&
      boot.includes(`state.${field}`) &&
      new RegExp(`\\b${field},`).test(save)
  );
}

/* ---- ٥) وما يأتي من الخادم يُحَلّ ---- */
/*
  وهذا الموضعُ الثالثُ الذي سقطت فيه الثلاث: مُحِلُّ الصفوف الواردة
  يحمل جدولَ مُسنِدين، ومجموعةٌ لا مُسنِدَ لها تُسقَط صامتةً — فيُرسل
  الخادمُ ويُلقي الجهاز. ولا يظهر ذلك في فحصٍ للتسوية ولا للخادم.
*/
console.log("\nوما يأتي من الخادم يُحَلّ:\n");

const { ROW_COLLECTIONS } = await jiti.import("../lib/collections.ts");
const settersAt = page.indexOf("const setters: Partial<");
const settersEnd = page.indexOf("};", settersAt);
check("جدولُ المُسنِدين موجود", settersAt > 0 && settersEnd > settersAt);
const setters = page.slice(settersAt, settersEnd);

const rowFields = ROW_COLLECTIONS.map((c) => String(c.field));
const noSetter = rowFields.filter((f) => !new RegExp(`\\b${f}: set`).test(setters));
check(
  "ولكلِّ مجموعةٍ تُكتب صفّاً صفّاً مُسنِدٌ فيه",
  noSetter.length === 0,
  noSetter.length
    ? `بلا مُسنِد: ${noSetter.join(" · ")}`
    : `${rowFields.length} مجموعة`
);
check(
  "ولا يُسكت عمّا لا مُسنِدَ له",
  /console\.warn\(`مجموعةٌ واردةٌ بلا مُسنِدٍ في الشاشة/.test(page),
  "فالسقوطُ الصامتُ هو العلّة"
);

/* ---- ٦) والموضعان لا يفترقان ---- */
/*
  فمن أضاف مجموعةً في أحدهما ونسي الآخر وقع في العلّة نفسِها من بابٍ
  آخر: يراها عند الاستعادة ولا يراها عند الفتح، أو بالعكس.
*/
const inWhole = fields.filter((f) => whole.includes(`state.${f}`));
const inBoot = fields.filter((f) => boot.includes(`state.${f}`) || boot.includes(`${f},`));
check(
  "والإحلالُ والإقلاعُ يتّفقان",
  inWhole.length === inBoot.length && inWhole.every((f) => inBoot.includes(f)),
  `${inWhole.length} و${inBoot.length}`
);

console.log(
  bad === 0
    ? "\n✓ كلُّ مجموعةٍ تُحفظ تُقرأ وتُحلّ — فلا تختفي بإعادة الفتح"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
