/**
 * يفحص أن «اليوم» يومُ الكويت لا يوم غرينتش.
 *
 *   node db/check-kuwait-day.mjs
 *
 * الكويت تسبق غرينتش بثلاث ساعات، فما بين منتصف الليل والثالثة فجراً
 * يكون اليوم عندنا يوماً وعند `toISOString` يومَ أمس. ومن عمل في تلك
 * الساعات قُيّدت حركته بتاريخ أمس، وحُسبت مقارنتُه ليومٍ مضى فكتبت فوق
 * حكمه — وكلاهما خطأٌ صامت لا رسالة له.
 *
 * فيُفحص الحدّان: آخر لحظةٍ من اليوم، وأول لحظةٍ من الذي يليه.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

/* متصفّحٌ مصطنع — سجلّ المطابقة في تخزينه */
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = { localStorage, addEventListener() {}, removeEventListener() {} };
globalThis.localStorage = localStorage;

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { dayOf, todayISO, KUWAIT_OFFSET_HOURS } = await jiti.import("../lib/today.ts");
const { recordMatch, agreeingStreak, comparedToday } = await jiti.import(
  "../lib/match-log.ts"
);

console.log("\nالحدّ بين اليومين — بتوقيت الكويت:\n");

check("الإزاحة ثلاث ساعات ثابتة", KUWAIT_OFFSET_HOURS === 3);

/* 20:59:59 غرينتش = 23:59:59 بالكويت — آخر اليوم */
check(
  "آخر دقيقةٍ من اليوم لا تُحسب على الغد",
  dayOf("2026-09-24T20:59:59.999Z") === "2026-09-24",
  dayOf("2026-09-24T20:59:59.999Z")
);

/* 21:00 غرينتش = منتصف ليل الكويت — أول الغد */
check(
  "ومنتصف الليل يبدأ اليوم الجديد",
  dayOf("2026-09-24T21:00:00.000Z") === "2026-09-25",
  dayOf("2026-09-24T21:00:00.000Z")
);

/* 22:00 غرينتش = الواحدة بعد منتصف الليل — وهذه كانت تُحسب لأمس */
const lateNight = "2026-09-24T22:00:00.000Z";
check(
  "والواحدة ليلاً يومُها يومها",
  dayOf(lateNight) === "2026-09-25",
  dayOf(lateNight)
);
check(
  "وهي التي كان غرينتش يردّها إلى أمس",
  lateNight.slice(0, 10) === "2026-09-24",
  "وهذا هو الخطأ الذي أُصلح"
);

check("والنهار لا يتغيّر", dayOf("2026-09-24T09:00:00.000Z") === "2026-09-24");
check("واللحظة الفاسدة تُردّ فارغة", dayOf("ليس تاريخاً") === "");
check("واليوم يُقرأ بلا وسيط", /^\d{4}-\d{2}-\d{2}$/.test(todayISO()), todayISO());

console.log("\nوسجلّ المطابقة يعدّ أيام الكويت:\n");

/* يومان متتاليان، آخرهما مقارنةٌ في الواحدة ليلاً */
recordMatch({ at: "2026-09-24T17:00:00.000Z", agree: true, off: [], rows: 0 });
const runs = recordMatch({ at: lateNight, agree: true, off: [], rows: 0 });

check("يومان لا يوم", runs.length === 2, runs.map((r) => r.day).join(" · "));
check("والعدّ اثنان", agreeingStreak(runs) === 2, String(agreeingStreak(runs)));
check(
  "ولم تُكتب مقارنةُ الليل فوق حكم أمس",
  runs[0].day === "2026-09-24" && runs[1].day === "2026-09-25"
);
check(
  "ومن قارن ليلاً لا يُطلب منه أن يعيد",
  comparedToday("2026-09-25", runs)
);

console.log("\nوالشاشة تأخذ يومها من الموضع نفسه:\n");

const page = fs.readFileSync("app/page.tsx", "utf8");
check(
  "لا يومَ ثانياً في الشاشة",
  !page.includes("const todayISO = () => new Date().toISOString()")
);
check("بل تستورده", page.includes('import { todayISO } from "@/lib/today";'));
check(
  "ولا تاريخَ يُشتقّ من غرينتش",
  !page.includes("new Date().toISOString().slice(0, 10)")
);

console.log(
  bad === 0
    ? "\n✓ اليوم يومُ الكويت — ومن عمل بعد منتصف الليل قُيّد عملُه في يومه"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
