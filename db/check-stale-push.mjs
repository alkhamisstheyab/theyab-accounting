/**
 * يفحص أن الجهاز لا يكتب نسختَه القديمة فوق الجديدة.
 *
 *   npm run check:stale
 *
 * في ١٨ أكتوبر ٢٠٢٦ مُحي **تسعةَ عشرَ إقراراً للإدارة واعتمادان** من
 * عقود الشركة بعد أن وقعت وسُجّلت. ولم يضع مالٌ ولا قيد — الحركاتُ
 * كلُّها معتمدة والميزانُ سليم — وإنما ضاعت القرارات وحدها، واستُردّت
 * من سجلّ التدقيق بـ`restore-confirmations.mjs`.
 *
 * وعلّتُها أن المزامنة كانت تحسب الفرق بين الجهاز والخادم وتعدّ **كلَّ
 * فرقٍ** تغييراً محلياً يُرسل. ولا تفرّق بين:
 *   • «أنا عدّلتُ هذا»            ← يُرسل بحقّ
 *   • «نسختي قديمةٌ وقد تقدّم الخادم» ← يُكتب القديمُ فوق الجديد
 *
 * فأقرّ صاحب الشركة أربعَ عشرةَ دفعةً في ١٤ أكتوبر، ثم فتح جهازُ م. ميس
 * في ١٥ بنسخةٍ أقدم فكتبها فوق ثلاثة عقود، ثم فعل جهازُه هو في ١٨
 * بثمانية. وكلُّ جهازٍ يتشبّث بنسخته ويكتبها فوق الآخر.
 *
 * فصار الجهاز لا يُرسل إلا ما مسَّه صاحبُه بيده، وما لم يمسّه يُؤخذ من
 * الخادم — غائباً كان أو قديماً.
 */
import fs from "fs";

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const sync = fs.readFileSync("lib/sync.ts", "utf8");

console.log("\nالجهاز يعرف ما مسَّه صاحبُه:\n");

check("سجلٌّ لما مُسّ", /const touched = new Map<string, Set<string>>\(\);/.test(sync));
check(
  "يُكتب عند كل حفظ قبل أن يصير الحاضرُ ماضياً",
  /noteLocalEdits\(state\);\s+latest = state;/.test(sync)
);
check(
  "والأساسُ صورةٌ لا مرجعٌ إلى حالة الشاشة",
  /let baseline: AppState \| null = null;/.test(sync) &&
    /const now = snapshotForServer\(after\);/.test(sync),
  "فمن عدّل المصفوفة في موضعها ثم أبلغ بها، قُورن الشيءُ بنفسه"
);
check(
  "وجهازٌ لم يُبلّغ بحاله قطّ: ما فيه عملُه هو",
  /if \(!before\) \{[\s\S]{0,400}markTouched\(field, collection\.keyOf\(row\)\);/.test(sync)
);
check(
  "وخطُّ البدء يُثبّت الصورة عند التحميل",
  /baseline = snapshotForServer\(state\);/.test(sync)
);
check(
  "والمردودُ يبقى ممسوساً ليُعاد",
  /const refusedNames = new Set\(refused\.map\(\(r\) => r\.field\)\);/.test(sync),
  "وإلا ظهر «لا شيء في الانتظار» وعملُ صاحبه في جهازه وحده"
);
check(
  "والصفُّ يُعدّ ممسوساً متى خالف ما كان عليه هنا",
  /if \(before1 && same\(comparable\(before1, owned\), comparable\(row, owned\)\)\) continue;/.test(
    sync
  )
);
check(
  "ولا يُعدّ ممسوساً ما صار نسخةَ الخادم",
  /const atServer = srv\.get\(key\);\s+if \(atServer && same\(comparable\(atServer, owned\), comparable\(row, owned\)\)\) continue;/.test(
    sync
  ),
  "وإلا عاد ما يصل من غيرك يُرسل إليه فيدور بلا نهاية"
);

console.log("\nولا يُرسل إلا ما مُسّ:\n");

check(
  "الإرسالُ يُرشَّح بالممسوس",
  /const mine = touched\.get\(field\);\s+const kept = \(rows as Record<string, unknown>\[\]\)\.filter\(\(row\) =>\s+mine\?\.has\(collection\.keyOf\(row\)\)\s+\);/.test(
    sync
  )
);
check(
  "والمجموعةُ الخاوية تُحذف من الطلب",
  /if \(changes\.upserts && Object\.keys\(changes\.upserts\)\.length === 0\) \{\s+delete changes\.upserts;/.test(
    sync
  ),
  "وإلا بُعثت دفعةٌ خاوية"
);
check(
  "وما بلغ الخادمَ يُنسى فلا يُعاد",
  /forgetTouched\(written as Record<string, unknown\[\]>\);/.test(sync)
);
check(
  "والحذفُ على حاله — يحرسه شاهدُ القبر لا هذا",
  /const tombs = readTombs\(\);/.test(sync)
);

console.log("\nوما لم يمسّه يُؤخذ من الخادم:\n");

check(
  "الضمُّ يشمل المختلفَ لا الغائبَ وحده",
  /const local = here\.get\(key\);\s+if \(!local\) return true;\s+return !same\(comparable\(local, owned\), comparable\(r, owned\)\);/.test(
    sync
  )
);
check(
  "ولا يُضمّ ما مسَّه صاحبُ الجهاز",
  /if \(mine\?\.has\(key\)\) return false;/.test(sync),
  "فعملُه أولى من نسخة الخادم حتى يُرسل"
);
check(
  "ولا يُبعث ما دُفن",
  /if \(buried\.has\(key\)\) return false;/.test(sync)
);

console.log("\nوأداةُ الاسترداد باقيةٌ لما مضى:\n");

const restore = fs.existsSync("db/restore-confirmations.mjs")
  ? fs.readFileSync("db/restore-confirmations.mjs", "utf8")
  : "";
check("السكربت موجود", restore.length > 0);
check(
  "ويعرض قبل أن يكتب",
  /const APPLY = process\.argv\.includes\("--apply"\);/.test(restore)
);
check(
  "ويستردّ باسم من قرّر لا باسم من استردّ",
  /fixed\.confirmedBy = d\.confirm\.by;/.test(restore) &&
    /fixed\.approvedBy = d\.approve\.by;/.test(restore),
  "فالشهادةُ شهادتُه"
);
check(
  "ولا يُقرّ ما لا اعتمادَ له",
  /إقرارٌ بلا اعتماد، يُترك/.test(restore)
);
check(
  "ويكتب وجهَي الصفّ معاً",
  /SET data = \$2::jsonb,\s+installments = \$3::jsonb/.test(restore),
  "عمودٌ يقرؤه الخادم وكائنٌ يقرؤه المتصفّح"
);
check(
  "ولا يمسّ ما لم يزل",
  /if \(touched\) row\.__next/.test(restore)
);

console.log("\nوما مُسّ يبقى بعد إغلاق المتصفّح:\n");

/*
  من عمل والخطُّ مقطوع ثم أغلق قبل أن يُرسل، يعود فيجد عملَه في جهازه.
  ولو نُسي أنه مسَّه لعُدّ صفُّه قديماً، فأُخذ من الخادم وضاع ما عمل —
  وهو عكسُ العلّة التي أُصلحت، وأشدُّ منها.
*/
check(
  "يُحفظ في مخزن المتصفّح",
  /const TOUCHED_KEY = "theyab:touched";/.test(sync) &&
    /function writeTouched\(\): void \{/.test(sync)
);
check(
  "ويُقرأ عند الإقلاع",
  /for \(const \[field, keys\] of readTouched\(\)\) touched\.set\(field, keys\);/.test(sync)
);
check(
  "ويُكتب عند كل مسٍّ جديد",
  /set\.add\(key\);\s+touched\.set\(field, set\);\s+writeTouched\(\);/.test(sync)
);
check(
  "ويُمحى ما بلغ الخادم",
  /if \(set\.size === 0\) touched\.delete\(field\);\s+\}\s+writeTouched\(\);/.test(sync)
);
check(
  "ولا يُعطّله تخزينٌ ممنوع",
  /تخزينٌ ممنوع أو تالف/.test(sync),
  "فالقراءة والكتابة في حرز"
);

console.log(
  bad === 0
    ? "\n✓ لا يُرسل إلا ما مُسّ، وما لم يُمسّ يُؤخذ من الخادم — فلا يُكتب قديمٌ فوق جديد"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
