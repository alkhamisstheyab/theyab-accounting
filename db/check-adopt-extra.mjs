/**
 * يفحص ضمَّ ما على الخادم وليس في الجهاز.
 *
 *   npm run check:adopt [نسخة.json]
 *
 * السحبُ تزايديّ: يسأل الخادم «ما بعد الرقم كذا». فإن سقط صفٌّ من
 * الجهاز ومضى المؤشّرُ عن رقمه، لم يعد إليه السحبُ أبداً — فيبقى على
 * الخادم بلا بابٍ يدخل منه. والقراءةُ الكاملة تقع في كل اتصال، لكنها
 * كانت تُستعمل **صورةً للمقارنة** لا تُطبَّق على الشاشة: فيُعرف الفرق
 * ولا يُسدّ.
 *
 * ووقع: كتب م. نوح مستحقّاً لأبي شمس (٦٠ د.ك · ٣ أكتوبر ٢٠٢٦، رقم
 * التغيير ٥٤٤٦٧) فلم يصل جهاز صاحب الشركة — وفي جهازه صفوفٌ أرقامُها
 * أعلى (٥٤٤٧٣ · ٥٤٥٤٧)، فالسحبُ مرّ عليه ولم يأخذه. وسأل عنه فلم يجده
 * في شاشة الإقرار، وهو الحركةُ الوحيدةُ التي تنتظر إقراراً في الدفاتر.
 *
 * وكان في شاشة المقارنة ما هو أخطر: الزائدُ على الخادم يُحمل على أنه
 * «ما حذفتَه من جهازك ولم يبلغه حذفُك»، ويُعرض زرُّ حذفه من الخادم —
 * فلو ضُغط لمُحي عملُ المهندس، ونصُّ التأكيد يُطمئن صاحبَه.
 *
 * فالمفحوص هنا ثلاثة: أن الضمَّ يُضيف، وأنه **لا يبعث ما دُفن** عمداً،
 * وأن الشاشة تعرض البابين ولا تَزعم أحد السببين.
 */
import fs from "fs";

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const sync = fs.readFileSync("lib/sync.ts", "utf8");
const page = fs.readFileSync("app/page.tsx", "utf8");

console.log("\nللجهاز بابٌ يدخل منه عملُ غيره:\n");

check(
  "دالّةُ الضمّ موجودة",
  /function adoptFromSnapshot\(\): number/.test(sync)
);
check(
  "وتُنادى عند كل اتصال — فالقراءة الكاملة تُطبَّق لا تُركن",
  /adoptFromSnapshot\(\);\s+\/\* ما تغيّر في المتصفّح قبل الاتصال يُرسل الآن \*\//.test(
    sync
  )
);
check(
  "وإن سبق الاتصالُ معرفةَ حالة الجهاز أُجّل إلى أول حفظ",
  /adoptWanted = true;/.test(sync) &&
    /if \(adoptWanted\) \{\s+adoptWanted = false;\s+adoptFromSnapshot\(\);/.test(sync)
);
check(
  "وبابٌ صريحٌ من شاشة المقارنة",
  /export async function adoptExtra\(local: AppState\): Promise<number>/.test(sync)
);

console.log("\nوالضمُّ يُضيف ولا يحذف:\n");

check(
  "لا يُرسل حذفاً قطّ",
  /applier\(\{ upserts, deletes: \{\}, rev: status\.rev \}\);/.test(sync)
);
check(
  "ولا يبعث ما دفنه الجهاز ولم يُرسل دفنَه",
  /const buried = new Set\(tombs\[field\] \?\? \[\]\);/.test(sync) &&
    /!here\.has\(key\) && !buried\.has\(key\)/.test(sync),
  "وإلا عاد ما حُذف عمداً"
);
check(
  "ولا يُحسب نقصاً ما لا يقرؤه صاحبُ الصلاحية",
  /if \(hidden\.has\(field\)\) continue;/.test(sync),
  "المجموعة المحجوبة تصل فارغةً"
);

console.log("\nويُقال لصاحبه إن وصله عملُ غيره:\n");

check("حقلٌ في حال المزامنة", /adopted: number;/.test(sync));
check("يُبتدأ بصفر", /adopted: 0,/.test(sync));
check(
  "ويُنشر عند الضمّ",
  /publish\(\{ adopted: status\.adopted \+ rows \}\);/.test(sync)
);
check(
  "ويُعرض في شريط الخادم",
  /وصلك \{serverState\.adopted\} صفاً كان على الخادم ولم يكن عندك/.test(page)
);

console.log("\nوشاشة المقارنة تعرض البابين ولا تَزعم:\n");

check(
  "لم يعد العنوان يَزعم أنك حذفتَها",
  !/صفاً حذفتَه من جهازك/.test(page) &&
    /صفاً ليس في جهازك/.test(page)
);
check(
  "ويُذكر السببان",
  /ولهذا سببان، فانظر أيُّهما قبل أن تختار/.test(page) &&
    /وإمّا أنها عملُ غيرك لم يصل جهازك/.test(page)
);
check(
  "وزرُّ الضمّ معروض",
  /أضِفها إلى جهازي/.test(page) && /onClick=\{pullExtra\}/.test(page)
);
check(
  "والحذف لم يَعُد هو الظاهرَ وحده",
  /onClick=\{purgeStale\}/.test(page) &&
    page.indexOf("onClick={pullExtra}") < page.indexOf("onClick={purgeStale}"),
  "الضمُّ قبله في الترتيب"
);
check(
  "ونصُّ تأكيد الحذف يقول الاحتمالين",
  /وإمّا أنها عملُ غيرك لم يصل جهازك — فالحذف يمحو عمله/.test(page)
);
check(
  "ويدلّ على الضمّ عند الشكّ",
  /وإن لم تكن على يقين فاضغط «أضِفها إلى جهازي» أولاً/.test(page)
);

/* ---- وعلى نسخة الشركة: هل في الجهاز نقصٌ عن الخادم؟ ---- */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const d = JSON.parse(fs.readFileSync(BACKUP, "utf8")).data;
  const pending = d.movements.filter((m) => m.approval !== "معتمدة");
  console.log("\nوعلى نسخة الجهاز:\n");
  console.log(`     حركات: ${d.movements.length} · تنتظر إقراراً: ${pending.length}`);
  for (const m of pending)
    console.log(`       ${m.fiscalYear}/${m.entryNo} · ${m.amount} · ${m.description ?? ""}`);
  console.log(
    "     والحقيقة عند الخادم — والفرق يُكشف بـ«قارن الآن» ويُسدّ بـ«أضِفها إلى جهازي»"
  );
}

console.log(
  bad === 0
    ? "\n✓ ما كتبه غيرُك يصلك، وما دفنتَه لا يُبعث، والحذف لا يُعرض وحده"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
