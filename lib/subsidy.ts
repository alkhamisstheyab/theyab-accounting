/**
 * المدعوم: ما خُصّص للقسيمة، وما سُحب منه، وما بقي.
 *
 * والمدعومُ في الكويت كميّةٌ قبل أن يكون قيمة: الدولةُ تُخصّص لقسيمة
 * المالك حديداً وخرسانةً وطابوقاً وإسمنتاً بعددٍ معلوم، ويُصرف بإذن
 * صرفٍ من التموين. فالحسابُ بوجهين معاً: من حفظ القيمةَ وحدها لم يعرف
 * كم بقي له من الأكياس، ومن حفظ الكميّةَ وحدها لم يعرف ما أضافته
 * الحصّةُ إلى قيمة العقد.
 *
 * وثلاثةٌ تُحرس هنا:
 *
 *   • **الباقي لا يَنزل عن صفر في العرض**، لكنّ الزيادةَ تُقال صريحةً:
 *     من سحب أكثرَ من حصّته فذاك خطأٌ يُصلَح أو مادةٌ تُشترى بالسعر
 *     التجاريّ — وطيُّه بإظهار صفرٍ يُخفي عجزاً حقيقيّاً.
 *
 *   • **سحبٌ بلا حصّةٍ لا يُطرح من غيرها**: فسحبٌ نُسب إلى حصّةٍ
 *     حُذفت يبقى معروضاً وحدَه، ولا يُحمَّل على مادةٍ أخرى.
 *
 *   • **الرسومُ على من أثبته العقد**: في عقد العجمي على المالك، وفي
 *     عقد بوعباس على الشركة. فمن لم يُثبتها طالَب بها من لا تلزمه.
 */

import { round3 } from "./accounting";
import type { Project, SubsidyDraw, SubsidyLine } from "./storage";

export type SubsidyLineState = {
  line: SubsidyLine;
  /** عددُ السحوب من هذه الحصّة */
  draws: number;
  drawnQuantity: number;
  drawnValue: number;
  /** الباقي — ويكون سالباً إن زاد السحبُ على الحصّة */
  remainingQuantity: number;
  remainingValue: number;
  /** سُحب أكثرُ من الحصّة — في الكميّة أو القيمة */
  overdrawn: boolean;
  /** استُنفدت: لا كميّةَ ولا قيمةَ باقية */
  exhausted: boolean;
};

export type ProjectSubsidy = {
  project: string;
  lines: SubsidyLineState[];
  /** سحوبٌ نُسبت إلى حصّةٍ لا وجودَ لها — تُعرض ولا تُطرح من غيرها */
  orphanDraws: SubsidyDraw[];
  value: number;
  drawnValue: number;
  remainingValue: number;
  /** على من الرسوم، كما أُثبت في الحصص — وقد تختلف */
  feesOn: string[];
  overdrawn: boolean;
};

const EPS = 0.001;

export function projectSubsidy(project: Project): ProjectSubsidy {
  const lines = project.subsidy ?? [];
  const draws = project.subsidyDraws ?? [];

  const byLine = new Map<string, SubsidyDraw[]>();
  for (const draw of draws) {
    const list = byLine.get(draw.lineId) ?? [];
    list.push(draw);
    byLine.set(draw.lineId, list);
  }

  const states: SubsidyLineState[] = lines.map((line) => {
    const mine = byLine.get(line.id) ?? [];
    const drawnQuantity = round3(mine.reduce((sum, d) => sum + d.quantity, 0));
    const drawnValue = round3(mine.reduce((sum, d) => sum + d.value, 0));
    const remainingQuantity = round3(line.quantity - drawnQuantity);
    const remainingValue = round3(line.value - drawnValue);
    return {
      line,
      draws: mine.length,
      drawnQuantity,
      drawnValue,
      remainingQuantity,
      remainingValue,
      /* والزيادةُ تُقال: صفرٌ معروضٌ مكانَ عجزٍ يُخفيه */
      overdrawn: remainingQuantity < -EPS || remainingValue < -EPS,
      exhausted:
        Math.abs(remainingQuantity) <= EPS && Math.abs(remainingValue) <= EPS,
    };
  });

  const known = new Set(lines.map((l) => l.id));
  const orphanDraws = draws.filter((d) => !known.has(d.lineId));

  const value = round3(lines.reduce((sum, l) => sum + l.value, 0));
  const drawnValue = round3(states.reduce((sum, s) => sum + s.drawnValue, 0));

  const feesOn = [
    ...new Set(lines.map((l) => (l.feesOn ?? "").trim()).filter(Boolean)),
  ];

  return {
    project: project.name,
    lines: states,
    orphanDraws,
    value,
    drawnValue,
    remainingValue: round3(value - drawnValue),
    feesOn,
    overdrawn: states.some((s) => s.overdrawn),
  };
}

/** مشاريعُ لها مدعوم — والأكثرُ باقياً أوّلاً، فهو ما يُتابع */
export function subsidyByProject(projects: readonly Project[]): ProjectSubsidy[] {
  return projects
    .filter((p) => (p.subsidy ?? []).length > 0 || (p.subsidyDraws ?? []).length > 0)
    .map(projectSubsidy)
    .sort((a, b) => b.remainingValue - a.remainingValue);
}

/**
 * موادُ المدعوم المعتادة في الكويت.
 *
 * تُقترح ولا تُلزم: فالمدعومُ يتغيّر بقرار الدولة، ومن قُيّد بقائمةٍ
 * مكتوبةٍ في الشِّفْر لم يستطع كتابةَ ما استُجدّ إلا بتعديل البرنامج.
 */
export const SUBSIDY_MATERIALS = [
  "حديد",
  "خرسانة جاهزة",
  "طابوق أسود",
  "طابوق أبيض",
  "إسمنت",
  "تكييف",
  "ألومنيوم وأبواب ونوافذ",
];

export const SUBSIDY_UNITS = ["كيس", "متر مكعّب", "طن", "عدد", "وحدة", "مقطوعة"];
