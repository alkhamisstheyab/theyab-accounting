/**
 * يحرس شكل العقد المطبوع.
 *
 *   node db/check-print-shape.mjs
 *
 * شكل العقد ضُبط على تسع مراجعاتٍ للصور: الشعار كان مقطوعاً، ومعلومات
 * الشركة أسفل الصفحة مقطوعة، والطباعة «مشوّهة وغير مرتّبة بتاتاً».
 * وكلّ خللٍ منها كان يقع صامتاً — يبدو على الشاشة سليماً ويخرج على
 * الورق ناقصاً.
 *
 * فهذا الفحص يمسك ما ضُبط، لا ليقول إن الشكل جميل — ذلك لا يحكم به
 * برنامج — بل ليمنع عودة الأخطاء المعروفة بعينها:
 *
 *   • ورقة الشركة تختفي لأن الملف زال أو تغيّر اسمه.
 *   • تُستبدل بصورةٍ أبعادها غير أبعادها، فيُقطع الشعار أو تُشوّه.
 *   • تُطبع بيضاء لأن المتصفّح يُسقط صور الخلفية عند الطباعة.
 *   • يعود الشريطان إلى متن الصفحة بدل thead/tfoot فلا يتكرّران.
 *   • يُمنع وعاء العقد من الانقسام فيُحشر في صفحة ويضيع ما زاد.
 *
 * ولا يعني نجاحُه أن الطباعة مراجَعة: يعني أن ما رُوجع لم ينكسر.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

console.log("");

/* ------------------------------------------------------------------ */
/* ورقة الشركة                                                         */
/* ------------------------------------------------------------------ */
const LETTERHEAD = "public/letterhead.jpg";
const WIDTH = 1529;
const HEIGHT = 2166;

const full = path.join(ROOT, LETTERHEAD);
const exists = fs.existsSync(full);
check("ورقة الشركة موجودة", exists, LETTERHEAD);

if (exists) {
  const bytes = fs.readFileSync(full);

  /** أبعاد JPEG من علامة SOF */
  const size = (() => {
    let i = 2;
    while (i < bytes.length) {
      if (bytes[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = bytes[i + 1];
      const isSOF =
        marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isSOF) {
        return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
      }
      i += 2 + bytes.readUInt16BE(i + 2);
    }
    return null;
  })();

  check(
    `أبعادها ${WIDTH}×${HEIGHT} كما تفترض الشيفرة`,
    size?.width === WIDTH && size?.height === HEIGHT,
    size ? `${size.width}×${size.height}` : "تعذّرت القراءة"
  );

  /*
    محفوظة في المستودع، وإلا وصلت الشيفرة إلى الخادم بلا ترويسة وخرج
    العقد بشريطين أبيضين — ولا رسالة خطأ: صورة الخلفية إن غابت لم تُشتكَ.
  */
  let tracked = "";
  try {
    tracked = execFileSync("git", ["ls-files", LETTERHEAD], {
      cwd: ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    tracked = "";
  }
  check("محفوظة في المستودع فتصل الخادم", tracked === LETTERHEAD, tracked || "غير محفوظة");
}

/* ------------------------------------------------------------------ */
/* الشيفرة                                                             */
/* ------------------------------------------------------------------ */
const page = read("app/page.tsx");

check(
  'الترويسة تُقرأ من "/letterhead.jpg"',
  page.includes('const LETTERHEAD = "/letterhead.jpg"')
);

/*
  النسبتان تُشتقّان من عرض الصورة نفسه: الشريط الأعلى ٣٤٠ بكسلاً من
  أعلاها والأسفل ٣٠٠ من أسفلها. ولو تغيّر العرض ولم تتغيّرا لانزلق
  الشعار عن موضعه — وهو عين ما اشتُكي منه أول مرة.
*/
check(
  `الشريط الأعلى بنسبة ${WIDTH} / 340`,
  page.includes(`aspectRatio: "${WIDTH} / 340"`)
);
check(
  `الشريط الأسفل بنسبة ${WIDTH} / 300`,
  page.includes(`aspectRatio: "${WIDTH} / 300"`)
);

check(
  "الشريطان يقرآن الصورة بعرض الورقة لا بمقاسٍ ثابت",
  (page.match(/backgroundSize: "100% auto"/g) ?? []).length >= 2
);
check(
  "أحدهما من أعلى الصورة والآخر من أسفلها",
  page.includes('backgroundPosition: "top center"') &&
    page.includes('backgroundPosition: "bottom center"')
);

/*
  في thead و tfoot لا في متن الصفحة: هما وحدهما يتكرّران في كل صفحة
  ويحجزان مكانهما. والموضع الثابت (position: fixed) يتكرّر لكنه يعلو
  على النصّ فيطمسه.
*/
const theadAt = page.indexOf("<thead>", page.indexOf("contract-paper"));
const firstBand = page.indexOf("contract-letterhead");
const tfootAt = page.indexOf("<tfoot>", firstBand);
const secondBand = page.indexOf("contract-letterhead", firstBand + 1);

check(
  "الشريط الأول داخل thead",
  theadAt > 0 && theadAt < firstBand && firstBand < tfootAt,
  `thead@${theadAt} · شريط@${firstBand} · tfoot@${tfootAt}`
);
check(
  "والثاني داخل tfoot",
  tfootAt > 0 && tfootAt < secondBand,
  `tfoot@${tfootAt} · شريط@${secondBand}`
);
check(
  "ولا موضع ثابت يطمس النصّ",
  !/position:\s*["']?fixed/.test(page.slice(theadAt, secondBand + 200))
);

/* ------------------------------------------------------------------ */
/* قواعد الطباعة                                                       */
/* ------------------------------------------------------------------ */
const css = read("app/globals.css");

/*
  المتصفّح يُسقط ألوان الخلفية وصورها عند الطباعة توفيراً للحبر، فتخرج
  الورقة بلا ترويسة وهي على الشاشة تامّة. وهذه القاعدة تمنعه.
*/
check(
  "ورقة العقد تُطبع بألوانها وصورها",
  /\.contract-sheet\s*,\s*\.contract-sheet\s*\*\s*\{[^}]*print-color-adjust:\s*exact/s.test(css)
);
check(
  "وبالبادئة التي تفهمها المتصفّحات القديمة",
  css.includes("-webkit-print-color-adjust: exact")
);

check("مقاس الورقة A4 وهوامشها مضبوطة", /@page\s*\{[^}]*size:\s*A4/s.test(css));

check(
  "خلايا ورقة العقد بلا حدود ولا حشو",
  /\.contract-paper\s*>\s*thead\s*>\s*tr\s*>\s*td/.test(css)
);

/*
  الصفّ لا ينقسم قاعدةً عامة، ووعاء العقد يُستثنى منها: هو العقد كلّه،
  فإن مُنع من الانقسام حُشر في صفحةٍ واحدة وضاع ما زاد عنها.
*/
check(
  "ووعاء العقد مستثنى من منع الانقسام",
  /break-inside:\s*auto/.test(css),
  /break-inside:\s*auto/.test(css) ? "" : "بدونه يُحشر العقد في صفحة"
);

/* ------------------------------------------------------------------ */
/* الأوراق المصمّمة: الفاتورة والسندات وعرض السعر وقسيمة الراتب         */
/* ------------------------------------------------------------------ */
/*
  كانت تخرج عند الطباعة بشكلٍ وألوانٍ غير التي صُمّمت: قاعدة جداول
  التقارير تطوّق خلاياها بإطاراتٍ رمادية، والمتصفّح يحذف ألوان خلفيتها
  (الشريط الذهبي، التذييل البيج، صفّ الإجمالي الكحلي).
*/
const marked = (page.match(/voucher-body designed-sheet/g) ?? []).length;
check("الأوراق المصمّمة الثلاث معلَّمة", marked === 3, `${marked}`);
check(
  "والعقد غير معلَّم — قواعده له وحده",
  !/contract-sheet[^"]*designed-sheet|designed-sheet[^"]*contract-sheet/.test(page)
);
check(
  "تُطبع بألوانها",
  /\.designed-sheet\s*,\s*\.designed-sheet\s*\*\s*\{[^}]*print-color-adjust:\s*exact/s.test(css)
);
check(
  "وإطارات جداول التقارير لا تمسّها",
  /\bth:where\(:not\(\.designed-sheet \*\)\)/.test(css) &&
    /\btd:where\(:not\(\.designed-sheet \*\)\)/.test(css) &&
    /thead th:where\(:not\(\.designed-sheet \*\)\)/.test(css) &&
    !/^\s*(thead\s+)?th\s*,?\s*$/m.test(css)
);

console.log(
  bad === 0
    ? "\n✓ شكل العقد المطبوع كما ضُبط — ولم ينكسر منه شيء"
    : `\n✗ ${bad} فحصاً أخفق — راجع قبل أي طباعة`
);
process.exit(bad === 0 ? 0 : 1);
