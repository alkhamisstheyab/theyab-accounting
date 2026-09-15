/**
 * يفحص سجلّ المطابقة اليومية.
 *
 *   node db/check-match-log.mjs
 *
 * عليه يقوم قرار النقل إلى الخادم، فلا يكفي أن يبدو صحيحاً. وأخطر ما
 * فيه أن يعدّ يوماً مختلفاً متطابقاً، أو أن يعدّ ضغطاتٍ في يومٍ واحد
 * أياماً — فيُنقل النظام على عدٍّ كاذب.
 */
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

/* تخزينٌ مصطنع: الوحدة تكتب في المتصفّح، وهنا تكتب في خريطة */
const store = new Map();
globalThis.window = globalThis;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const {
  recordMatch,
  matchRuns,
  agreeingStreak,
  lastDisagreement,
  comparedToday,
  verdict,
  REQUIRED_STREAK,
} = await jiti.import("../lib/match-log.ts");

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const at = (day, hour = 9) => `${day}T${String(hour).padStart(2, "0")}:00:00.000Z`;
const agree = (day, hour) => recordMatch({ at: at(day, hour), agree: true, off: [], rows: 0 });
const differ = (day, hour, off = ["movements"], rows = 3) =>
  recordMatch({ at: at(day, hour), agree: false, off, rows });

const reset = () => store.clear();

console.log("");

/* ---- 1. البداية ---- */
check("بلا مقارنات: لا عدّ ولا استعداد", agreeingStreak() === 0 && !verdict().ready);

/* ---- 2. العدّ يتراكم ---- */
reset();
for (let d = 1; d <= 5; d++) agree(`2026-09-0${d}`);
check("خمسة أيام متطابقة تُعدّ خمسة", agreeingStreak() === 5, String(agreeingStreak()));
check(
  "ولا تكفي للنقل",
  !verdict().ready,
  verdict().text
);

/* ---- 3. يومٌ مختلف يقطع العدّ ---- */
differ("2026-09-06");
check("يومٌ مختلف يعيد العدّ إلى صفر", agreeingStreak() === 0, String(agreeingStreak()));
check(
  "ويُقال أين اختلفتا",
  verdict().text.includes("movements"),
  verdict().text
);

/* ---- 4. العدّ يبدأ من جديد ---- */
for (let d = 7; d <= 13; d++) agree(`2026-09-${String(d).padStart(2, "0")}`);
check(
  `سبعة أيام بعده تبلغ المطلوب (${REQUIRED_STREAK})`,
  agreeingStreak() === 7 && verdict().ready,
  verdict().text
);

/* ---- 5. اليوم الواحد لا يُعدّ مرتين ---- */
reset();
agree("2026-09-01", 9);
agree("2026-09-01", 14);
agree("2026-09-01", 17);
check(
  "ثلاث مقارنات في يومٍ واحد يومٌ واحد",
  matchRuns().length === 1 && agreeingStreak() === 1,
  `${matchRuns().length} سجلاً · العدّ ${agreeingStreak()}`
);

/* ---- 6. وآخر مقارنةٍ في اليوم هي حكمه ---- */
reset();
differ("2026-09-01", 9);
agree("2026-09-01", 17);
check(
  "من اختلف صباحاً وأصلح فتطابق مساءً: يومُه تطابق",
  matchRuns().length === 1 && matchRuns()[0].agree === true
);

agree("2026-09-02", 9);
differ("2026-09-02", 16);
check(
  "ومن تطابق صباحاً واختلف مساءً: يومُه اختلاف",
  matchRuns()[1].agree === false && agreeingStreak() === 0
);

/* ---- 7. يومٌ لم يُقارَن فيه لا يقطع العدّ ---- */
reset();
agree("2026-09-01");
agree("2026-09-02");
/* سافر أسبوعاً */
agree("2026-09-10");
check(
  "انقطاع أيامٍ بلا مقارنة يُبطئ ولا يُبطل",
  agreeingStreak() === 3,
  `${agreeingStreak()} أيام في ${matchRuns().length} سجلات`
);

/* ---- 8. الترتيب يصحّ ولو سُجّل معكوساً ---- */
reset();
agree("2026-09-03");
agree("2026-09-01");
differ("2026-09-02");
const days = matchRuns().map((r) => r.day);
check(
  "السجلّ مرتّبٌ بالأيام مهما كان ترتيب التسجيل",
  days.join(",") === "2026-09-01,2026-09-02,2026-09-03",
  days.join("، ")
);
check(
  "والعدّ يُحسب من آخر يومٍ إلى الوراء",
  agreeingStreak() === 1,
  String(agreeingStreak())
);

/* ---- 9. آخر اختلاف يُعرف ---- */
check(
  "وأقرب يومٍ اختلفتا فيه معلوم",
  lastDisagreement()?.day === "2026-09-02",
  String(lastDisagreement()?.day)
);

/* ---- 10. أقورن اليوم؟ ---- */
check("أقورن اليوم: نعم", comparedToday("2026-09-02"));
check("أقورن اليوم: لا", !comparedToday("2026-09-09"));

/* ---- 11. السجلّ يبقى بعد إغلاق الصفحة ---- */
reset();
agree("2026-09-01");
agree("2026-09-02");
const raw = store.get("theyab:match-log");
store.clear();
store.set("theyab:match-log", raw);
check(
  "السجلّ يبقى بعد إغلاق الصفحة",
  agreeingStreak() === 2,
  String(agreeingStreak())
);

/* ---- 12. تخزينٌ تالف لا يُسقط الشاشة ---- */
store.set("theyab:match-log", "{ليس جيسون");
check("تخزينٌ تالف يُقرأ فارغاً ولا يُسقط شيئاً", matchRuns().length === 0);

/* ---- 13. لا ينمو بلا حدّ ---- */
reset();
for (let i = 0; i < 260; i++) {
  const d = new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
  agree(d);
}
check(
  "لا ينمو بلا حدّ",
  matchRuns().length === 200,
  `${matchRuns().length} سجلاً من 260 يوماً`
);
check("ويبقى الأحدث لا الأقدم", matchRuns()[matchRuns().length - 1].day === "2026-09-17",
  matchRuns()[matchRuns().length - 1].day);

console.log(
  bad === 0
    ? "\n✓ سجلّ المطابقة: يعدّ الأيام لا الضغطات، وينقطع بالاختلاف وحده"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
