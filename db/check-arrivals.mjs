/**
 * يفحص أنّ ما يصل من الخادم يُسمّى لا يُعدّ وحدَه.
 *
 *   npm run check:arrivals
 *
 * وعلّتُه سؤالُ صاحب الشركة: «تصلني رسالةٌ أنّه وصلني صفٌّ جديدٌ أو
 * أكثر — كيف أعرف ما هو الشيء الذي وصلني؟». ولم يكن له جواب: العددُ
 * يُحفظ ويُرمى ما هو. والمطابقةُ لا تُجيبه، فالصفوفُ ضُمّت فصار
 * الجهازُ والخادمُ سواءً فتقول «لا فرق». وسجلُّ التدقيق يسجّل أفعالَ
 * الناس لا وصولَ الصفوف.
 *
 * فيُفحص:
 *   • أنّ المجموعةَ تُسمّى بعربيّتها لا بمفتاحها في الشِّفر.
 *   • أنّ الصفَّ يُسمّى بما يُعرف به — رقمُ قيدٍ أو اسمٌ — لا بمعرّفه.
 *   • أنّ الأسماءَ ثلاثةٌ لا أكثر، ويُقال إنّ بعدها بقيّة.
 *   • أنّ ما وصل مرّتين يُجمع في سطرٍ واحدٍ لا سطرين.
 *   • أنّه يُمسح بعد قراءته.
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

const sync = fs.readFileSync(path.join(ROOT, "lib/sync.ts"), "utf8");
const page = fs.readFileSync(path.join(ROOT, "app/page.tsx"), "utf8");

console.log("\nما وصل يُسمّى، في المزامنة:\n");

check(
  "الحالةُ تحمل تفصيلَ ما وصل",
  /adoptedRows: \{ field: string; count: number; samples: string\[\] \}\[\]/.test(
    sync
  ),
  "لا العددَ وحدَه"
);
check(
  "ويُبتدأ فارغاً",
  /adopted: 0,\s*\n\s*adoptedRows: \[\],/.test(sync)
);
check(
  "ويُسمّى الصفُّ عند وصوله لا بعده",
  /samples: gained\.map\(rowLabel\)/.test(sync),
  "فالصفوفُ بين يدينا حينها وحدَها"
);
check(
  "ورقمُ القيد أدلُّ من المعرّف",
  /return `قيد \$\{no\}`/.test(sync)
);
check(
  "ثمّ الاسمُ ثمّ العنوانُ ثمّ التاريخ",
  /\["name", "title", "employeeName", "party", "project"\]/.test(sync)
);
check(
  "وثلاثةُ أسماءٍ لا أكثر",
  /\.slice\(0, 3\)/.test(sync),
  "فمن وصله خمسون لا يقرأ خمسين اسماً"
);
check(
  "وما وصل مرّتين يُجمع في سطرٍ واحد",
  /function mergeAdopted\(/.test(sync) && /found\.count \+= entry\.count/.test(sync)
);
check(
  "ولا يُكرَّر الاسمُ في السطر",
  /if \(!found\.samples\.includes\(sample\)\) found\.samples\.push\(sample\)/.test(
    sync
  )
);
check(
  "ويُمسح بعد قراءته",
  /export function clearAdopted\(\): void \{\s*publish\(\{ adopted: 0, adoptedRows: \[\] \}\);/.test(
    sync
  )
);

console.log("\nوفي الشريط الجانبيّ:\n");

check(
  "العددُ يُقال ثمّ يُفصَّل",
  /serverState\.adopted > 0/.test(page) &&
    /serverState\.adoptedRows\.map/.test(page)
);
check(
  "والمجموعةُ بعربيّتها",
  /FIELD_LABELS\[row\.field\] \?\? row\.field/.test(page),
  "لا بمفتاحها في الشِّفر"
);
check(
  "والمجموعاتُ الثلاثُ الجديدةُ مسمّاةٌ فيها",
  /messages: "الرسائل"/.test(page) &&
    /parties: "سجلّ الأطراف"/.test(page) &&
    /minutes: "تقارير الاجتماعات"/.test(page),
  "فما يصل منها لا يُعرف بمفتاحه"
);
check(
  "ويُقال إنّ بعد الثلاثة بقيّة",
  /row\.count > row\.samples\.length \? " …" : ""/.test(page)
);
check("وزرُّ «قرأتُه» يمسحه", /onClick=\{clearAdopted\}/.test(page));

/* ---- والمنطقُ يُجرَّب لا يُقرأ ---- */
console.log("\nوالجمعُ يُجرَّب:\n");

/*
  والدالّتان تُحمَّلان من موضعهما لا تُنتزعان من النصّ: فنصٌّ يُقتطع
  بالأقواس يُكسَر بتعديلٍ في التسمية، والمحمولُ هو الذي يعمل في الشاشة.
*/
const localStorage = {
  store: new Map(),
  getItem(k) {
    return this.store.has(k) ? this.store.get(k) : null;
  },
  setItem(k, v) {
    this.store.set(k, String(v));
  },
  removeItem(k) {
    this.store.delete(k);
  },
};
globalThis.window = {
  localStorage,
  addEventListener() {},
  removeEventListener() {},
};
globalThis.localStorage = localStorage;

const jiti = createJiti(import.meta.url);
const { rowLabel, mergeAdopted } = await jiti.import("../lib/sync.ts");

check(
  "قيدٌ يُسمّى برقمه",
  rowLabel({ id: "a4f9", entryNo: 1851 }) === "قيد 1851",
  rowLabel({ id: "a4f9", entryNo: 1851 })
);
check(
  "وطرفٌ يُسمّى باسمه",
  rowLabel({ id: "b1", name: "أبو شمس" }) === "أبو شمس"
);
check(
  "ومن لا رقمَ له ولا اسمَ يُسمّى بتاريخه",
  rowLabel({ id: "c1", date: "2026-10-20" }) === "2026-10-20"
);
check(
  "ومن لا شيءَ له لا يُسمّى بمعرّفه",
  rowLabel({ id: "d1" }) === "",
  "فمعرّفٌ من ستّةٍ وثلاثين حرفاً لا يدلّ"
);
check(
  "واسمٌ من فراغاتٍ لا يُعدّ اسماً",
  rowLabel({ id: "e1", name: "   ", date: "2026-10-20" }) === "2026-10-20"
);

const once = mergeAdopted([], [
  { field: "movements", count: 2, samples: ["قيد 1851", "قيد 1852"] },
]);
const twice = mergeAdopted(once, [
  { field: "movements", count: 1, samples: ["قيد 1853"] },
  { field: "dues", count: 1, samples: ["أبو شمس"] },
]);

check(
  "والمجموعةُ الواحدةُ سطرٌ واحدٌ بعد وصولين",
  twice.filter((r) => r.field === "movements").length === 1
);
check(
  "وعددُها مجموعُ الوصولين",
  twice.find((r) => r.field === "movements").count === 3
);
check(
  "ومجموعةٌ جديدةٌ تُضاف سطراً",
  twice.some((r) => r.field === "dues" && r.samples[0] === "أبو شمس")
);
check(
  "ولا يُمسّ ما وصل أوّلاً",
  once.find((r) => r.field === "movements").count === 2,
  "فالجمعُ ينسخ ولا يكتب فوق الأصل"
);

const many = mergeAdopted(
  [{ field: "movements", count: 3, samples: ["أ", "ب", "ج"] }],
  [{ field: "movements", count: 1, samples: ["د"] }]
);
check(
  "وثلاثةُ أسماءٍ لا تزيد بوصولٍ رابع",
  many[0].samples.length === 3 && many[0].count === 4,
  `${many[0].samples.length} اسماً من ${many[0].count}`
);

console.log(
  bad === 0
    ? "\n✓ ما يصل من الخادم يُسمّى بابَه وأوّلَ ما فيه، ويُمسح بعد قراءته"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
