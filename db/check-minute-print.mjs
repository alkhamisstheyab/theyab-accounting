/**
 * يفحص طباعةَ تقرير الاجتماع ومشاركتَه ملفّاً.
 *
 *   npm run check:minute-print
 *
 * وطلبُه (٢٩ أكتوبر ٢٠٢٦): «أريد أن أضيف إمكانية الطباعة بعد كتابة
 * التقرير، وكذلك تجهيزه على هيئة PDF لمشاركته مع العميل أو أيّ طرفٍ
 * آخر». فالتقريرُ يُكتب في النظام ويُقرأ خارجَه، وما بقي في شاشةٍ لا
 * يدخلها العميلُ لم يبلغه.
 *
 * وثلاثةٌ تُحرس هنا:
 *
 *   ١) **اسمُ الملفّ.** المتصفّحُ يسمّي ما يحفظه «حفظاً كـ PDF» بعنوان
 *      المستند لا باسم الزرّ — فلولا تسميةٌ قبل الطباعة وصل العميلَ
 *      ملفٌّ باسم النظام، وعشرةٌ مثلُه في بريده لا يُفرَّق بينها.
 *      ويُعاد الاسمُ بعد الطباعة، وإلا بقي معلّقاً في عنوان الصفحة.
 *
 *   ٢) **ما خلف الورقة لا يُطبع معها.** والإخفاءُ قائمةُ أسماءٍ تُكتب
 *      بيدٍ كلَّما أُضيفت ورقة، فتُنسى. وكانت ساقطةً منها ورقتان قبل
 *      هذا اليوم: براءةُ الذمّة وكشفُ العميل — تُطبعان ومعهما صفحاتُ
 *      الشاشة التي تحتهما. فيُقابل الفحصُ القائمةَ بالأوراق المعروضة
 *      فعلاً، فلا تسقط ورقةٌ ثالثة.
 *
 *   ٣) **المطبوعُ هو المحفوظ.** زرُّ «احفظ واطبع» يطبع ما حُفظ لا ما
 *      في الشاشة: فسطرُ التزامٍ فارغٌ يُسقطه الحفظُ ولا يصحّ أن يُطبع.
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

/* نهاياتُ السطور تُسوَّى: ملفُّ الشاشة بـCRLF */
const page = fs
  .readFileSync(path.join(ROOT, "app/page.tsx"), "utf8")
  .replace(/\r\n/g, "\n");
const flat = page.replace(/\s+/g, " ");

/* ------------------------------------------------------------------ */
/* بابُ الطباعة                                                        */
/* ------------------------------------------------------------------ */
console.log("\nمن كتب التقرير وجد بابَ طباعته:\n");

check(
  "لكلِّ تقريرٍ في القائمة زرُّ طباعة",
  /onClick=\{\(\) => onPrint\(minute\)\}/.test(page)
);
check(
  "ولا يشترط صلاحيةَ التعديل",
  page.indexOf("onPrint(minute)") <
    page.indexOf("{canManage && (\n                        <>"),
  "فالسكرتيرُ يطبع ولا يُعدّل"
);
check(
  "و«احفظ واطبع» يطبع بعد الكتابة كما طُلب",
  /احفظ واطبع/.test(page) &&
    /const saved = commit\(\);\s*\n\s*if \(saved\) onPrint\(saved\);/.test(page),
  "فلا يُحفظ ثمّ يُبحث عنه في القائمة ليُطبع"
);
check(
  "والمطبوعُ هو المحفوظُ لا ما في الشاشة",
  /decisions: editing\.decisions\.filter\(\(d\) => d\.text\.trim\(\) !== ""\),/.test(
    page
  ) && /return clean;/.test(page),
  "فسطرُ الالتزام الفارغُ يُسقطه الحفظ"
);
check(
  "والحفظُ يمتنع فيُعيد لا شيء — فلا يُطبع ما لم يُحفظ",
  /window\.alert\("اكتب تاريخ الاجتماع"\);\s*\n\s*return null;/.test(page)
);

/* ------------------------------------------------------------------ */
/* اسمُ الملفّ                                                          */
/* ------------------------------------------------------------------ */
console.log("\nوالملفُّ يُسمّى بتقريره:\n");

const grab = (head, end) => {
  const at = page.indexOf(head);
  if (at < 0) throw new Error(`لا موضع: ${head}`);
  const stop = page.indexOf(end, at);
  return page.slice(at, stop < 0 ? undefined : stop);
};

const minuteFileName = new Function(
  grab("function minuteFileName(minute: Minute): string {", "\n/**")
    .replace("(minute: Minute): string", "(minute)") +
    "\nreturn minuteFileName;"
)();

check(
  "الاسمُ فيه نوعُ التقرير ومشروعُه وتاريخُه",
  minuteFileName({
    kind: "اجتماع",
    project: "مشروع عواطف القرطاس",
    date: "2026-10-29",
  }) === "تقرير اجتماع - مشروع عواطف القرطاس - 2026-10-29",
  minuteFileName({
    kind: "اجتماع",
    project: "مشروع عواطف القرطاس",
    date: "2026-10-29",
  })
);
check(
  "وبلا مشروعٍ لا يبقى فاصلٌ فارغ",
  minuteFileName({ kind: "مكالمة", project: "", date: "2026-10-29" }) ===
    "تقرير مكالمة - 2026-10-29",
  minuteFileName({ kind: "مكالمة", project: "", date: "2026-10-29" })
);
check(
  "وما يرفضه نظامُ الملفّات يُبدَل",
  !/[\\/:*?"<>|]/.test(
    minuteFileName({ kind: "زيارة موقع", project: 'ق/5 "أ"', date: "2026-10-29" })
  ),
  minuteFileName({ kind: "زيارة موقع", project: 'ق/5 "أ"', date: "2026-10-29" })
);

console.log("\nوعنوانُ المستند يُسمّى ثمّ يُعاد:\n");

const printAs = grab("function printAs(name: string) {", "\n/**");
check("يُسمّى قبل الطباعة", /document\.title = name;/.test(printAs));
check(
  "ويُعاد بعدها",
  /window\.addEventListener\("afterprint", restore\)/.test(printAs) &&
    /document\.title = was;/.test(printAs)
);
check(
  "ولا يُعاد مرّتين",
  /if \(done\) return;/.test(printAs),
  "فالمتصفّحُ قد يُطلق afterprint ويسبقه المؤقِّت"
);
check(
  "ومتصفّحٌ لا يُطلق afterprint لا يبقى الاسمُ فيه معلّقاً",
  /window\.setTimeout\(restore,/.test(printAs)
);

/* ------------------------------------------------------------------ */
/* الورقة                                                              */
/* ------------------------------------------------------------------ */
console.log("\nوالورقةُ تُطبع بشكل مستندات الشركة:\n");

const sheet = grab("function MinuteSheet({", "function MinutesPage({");

check(
  "تحمل صفَّي الطباعة فيعمل فيها تنسيقُ الورق",
  /voucher-body designed-sheet/.test(sheet),
  "وبلا designed-sheet تُطوَّق جداولُها بإطاراتٍ رمادية"
);
check(
  "وأزرارُها وشرحُها لا يُطبعان",
  /className="p-6 pb-0 no-print"/.test(sheet)
);
check(
  "وفيها ترويسةُ الشركة وتذييلُها",
  /\{company\.name\}/.test(sheet) && /\{company\.phone\}/.test(sheet)
);
check(
  "وتُطبع الحاضرين — وهم حُجّةُ التقرير",
  /الحاضرون/.test(sheet) && /minute\.attendees/.test(sheet)
);
check(
  "وما قيل، وما التُزم به وحالُه",
  /minute\.body/.test(sheet) &&
    /ما التُزم به/.test(sheet) &&
    /decision\.done/.test(sheet) &&
    /مضى موعدُه/.test(sheet)
);
check(
  "والصورُ المرفقة",
  /api\/photos\?path=/.test(sheet),
  "فالعيبُ يُرى ولا يُوصف"
);
check(
  "وموضعُ توقيعِ الطرفين — فهي تُشارَك لا تُحفظ فقط",
  /عن الشركة/.test(sheet) && /الطرف الآخر/.test(sheet)
);
check(
  "ويُقال له كيف يُحفظ PDF",
  /حفظ كـ PDF/.test(flat),
  "فالوجهةُ في نافذة الطباعة لا في النظام"
);

/* ------------------------------------------------------------------ */
/* وما خلف الورقة لا يُطبع معها                                        */
/* ------------------------------------------------------------------ */
console.log("\nولا تُطبع الشاشةُ خلف الورقة:\n");

const hideAt = page.indexOf('? "hide-when-printing"');
check("شرطُ الإخفاء موجود", hideAt > 0);

const condition = page.slice(
  page.lastIndexOf("flex min-h-screen ${", hideAt),
  hideAt
);

/*
  الأوراقُ المعروضةُ فعلاً: كلُّ `{حالة && (<ورقة` في أعلى الشجرة.
  فالقائمةُ تُقابل بها، ولا تُكتب هنا بيدٍ ثانية — فتُنسى مرّتين.

  والمقصودُ ما يُطبع وحدَه: وعلامتُه `voucher-sheet` في تعريفه — وهي
  نفسُها التي يُخرجها تنسيقُ الطباعة من مجرى الصفحة. ولوحةٌ تُعرض في
  متن الشاشة ولا تُطبع (كاختيار شروط العقد) ليست منها.
*/
const bodyOf = (component) => {
  const at = page.indexOf(`function ${component}(`);
  if (at < 0) return "";
  const end = page.indexOf("\nfunction ", at + 1);
  return page.slice(at, end < 0 ? undefined : end);
};

/* والفاتورةُ والسندُ يستعيران الورقةَ من قالبٍ واحد، فيُتبَع القالب */
const isPrintable = (component, seen = new Set()) => {
  if (seen.has(component)) return false;
  seen.add(component);
  const body = bodyOf(component);
  if (body.includes("voucher-sheet")) return true;
  return [...body.matchAll(/<(\w*Sheet)\b/g)].some((m) =>
    isPrintable(m[1], seen)
  );
};

const shown = [
  ...page.matchAll(/\{(\w+)[^{}]*?&&[^{}]*?\(\s*<(\w*Sheet)\b/g),
]
  .map((m) => ({ state: m[1], component: m[2] }))
  .filter((x) => isPrintable(x.component));

check(
  "والأوراقُ المعروضةُ تُعرف من الشاشة لا من قائمةٍ ثانية",
  shown.length >= 8,
  `وُجدت ${shown.length}`
);

for (const { state, component } of shown) {
  check(
    `${component} مذكورةٌ في شرط الإخفاء`,
    new RegExp(`\\b${state}\\b`).test(condition),
    "وإلا طُبعت معها صفحاتُ الشاشة التي تحتها"
  );
}

check(
  "وورقةُ التقرير معروضةٌ في أعلى الشجرة",
  /\{minuteSheet && \(\s*\n\s*<MinuteSheet/.test(page),
  "ولو عُرضت داخل الشاشة لأخفاها الإخفاءُ نفسُه"
);
check(
  "وتأخذ بيانَ الشركة ويومَها",
  /company=\{company\}\s*\n\s*today=\{todayISO\(\)\}/.test(page)
);

console.log(
  bad === 0
    ? "\n✓ التقريرُ يُطبع بعد كتابته، ويُحفظ ملفّاً باسمه، ولا يُطبع خلفه شيء"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
