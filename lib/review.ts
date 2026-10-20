/**
 * مراجعةُ المدخلات: ما أُدخل في مدّةٍ، ومن أدخله، وما يُستوقف فيه.
 *
 * وليست جدولَ حركاتٍ آخر. الجدولُ يُعرض بتاريخ الحركة، والمراجعةُ
 * تُعرض **بوقت الإدخال**: فمن أدخل اليومَ حركةَ شهرٍ ماضٍ لا يراها من
 * يراجع «حركات اليوم»، وهي التي يجب أن تُراجَع اليوم.
 *
 * ووقتُ الإدخال ليس في كائن الحركة — وإنما في سجلّ التدقيق: «إنشاء ·
 * حركة · قيد ١٨٨٦ · ٢٠٢٦-١٠-١٥ · ٦٠٫٠٠٠ د.ك». فيُقرأ منه، ويُطابق
 * بالرقم والتاريخ معاً: فأرقامُ القيود تُعاد في كل سنةٍ ماليّة، ومن
 * طابق بالرقم وحده نسب حركةَ ٢٠٢٥ إلى من أدخل حركةَ ٢٠٢٦.
 *
 * وما لا يُوجد له سجلّ — كحركات ٢٠٢٥ المنقولة من الإكسل — يُقال فيه
 * «لا سجلّ» ولا يُنسب إلى أحد، ولا يُحسب أنه أُدخل اليوم.
 */

import { round3, type Movement } from "./accounting";
import type { AuditEntry } from "./audit";

const DAY = 86400000;

const iso = (at: Date): string => at.toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/* المدّة                                                              */
/* ------------------------------------------------------------------ */

export const REVIEW_RANGES = [
  "اليوم",
  "أمس",
  "آخر ٧ أيام",
  "آخر ٣٠ يوماً",
  "هذا الشهر",
  "الشهر الماضي",
  "مدّة أختارها",
] as const;

export type ReviewRange = (typeof REVIEW_RANGES)[number];

/**
 * حدَّا المدّة — من وإلى، بالتاريخ المحلّي.
 *
 * و«اليوم» يُحسب من ساعة الجهاز لا بالتوقيت العالمي: فمن يعمل في
 * الكويت ليلاً بعد التاسعة يكون في الغد عالميّاً، فتختفي مدخلاتُه من
 * «اليوم» وهي ساعتَها.
 */
export function reviewWindow(
  range: ReviewRange,
  today: Date,
  from = "",
  to = ""
): { from: string; to: string } {
  const local = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const day = iso(new Date(local.getTime() - local.getTimezoneOffset() * 60000));

  const back = (days: number) => {
    const at = new Date(local.getTime() - days * DAY);
    return iso(new Date(at.getTime() - at.getTimezoneOffset() * 60000));
  };
  const monthStart = (shift: number) => {
    const at = new Date(today.getFullYear(), today.getMonth() + shift, 1);
    return iso(new Date(at.getTime() - at.getTimezoneOffset() * 60000));
  };
  const monthEnd = (shift: number) => {
    const at = new Date(today.getFullYear(), today.getMonth() + shift + 1, 0);
    return iso(new Date(at.getTime() - at.getTimezoneOffset() * 60000));
  };

  switch (range) {
    case "اليوم":
      return { from: day, to: day };
    case "أمس":
      return { from: back(1), to: back(1) };
    case "آخر ٧ أيام":
      return { from: back(6), to: day };
    case "آخر ٣٠ يوماً":
      return { from: back(29), to: day };
    case "هذا الشهر":
      return { from: monthStart(0), to: day };
    case "الشهر الماضي":
      return { from: monthStart(-1), to: monthEnd(-1) };
    case "مدّة أختارها":
      /* وما لم يُختر حدٌّ فلا حدَّ — فالفراغُ يعني «كلَّ شيء» لا «لا شيء» */
      return { from: from || "0000-01-01", to: to || "9999-12-31" };
  }
}

/* ------------------------------------------------------------------ */
/* من أدخلها ومتى                                                      */
/* ------------------------------------------------------------------ */

export type EntryStamp = { at: string; user: string };

/** مفتاحُ المطابقة: الرقمُ والتاريخُ معاً، فالأرقامُ تُعاد كلَّ سنة */
const stampKey = (entryNo: string | number, date: string) =>
  `${String(entryNo)}|${String(date).slice(0, 10)}`;

export function entryStamps(
  audit: readonly AuditEntry[]
): Map<string, EntryStamp> {
  const stamps = new Map<string, EntryStamp>();
  for (const row of audit) {
    if (row.entity !== "حركة" || row.action !== "إنشاء") continue;
    const m = /قيد\s+(\d+)\s*·\s*(\d{4}-\d{2}-\d{2})/.exec(row.summary ?? "");
    if (!m) continue;
    const key = stampKey(m[1], m[2]);
    /* وأوّلُ إنشاءٍ هو الإدخال — وما بعده إعادةُ إنشاءٍ بعد حذف */
    const was = stamps.get(key);
    if (!was || row.at < was.at) stamps.set(key, { at: row.at, user: row.user });
  }
  return stamps;
}

/* ------------------------------------------------------------------ */
/* ما يُستوقف فيه                                                      */
/* ------------------------------------------------------------------ */

/**
 * علاماتُ المراجعة.
 *
 * وليست أخطاءً كلُّها — بل مواضعُ نظر. فالمراجعةُ أن يُسأل لا أن
 * يُحكم: «حركةٌ بلا مشروع» قد تكون إداريّةً صحيحة، وقد تكون مصروفَ
 * قسيمةٍ نُسي مشروعُها فلا يدخل ربحيّتَها.
 */
export type ReviewFlag =
  | "بلا مشروع"
  | "بلا طرف"
  | "تنتظر اعتماداً"
  | "مكرَّرةٌ محتملة"
  | "بلا سجلّ إدخال";

export type ReviewRow = {
  movement: Movement;
  stamp: EntryStamp | null;
  flags: ReviewFlag[];
};

/** حساباتُ تكاليف المشاريع — وما قُيّد عليها بلا مشروعٍ يُسأل عنه */
const PROJECT_COST = /^5[0-9]{3}$/;

export function reviewMovements(
  movements: readonly Movement[],
  audit: readonly AuditEntry[],
  options: {
    window: { from: string; to: string };
    /** بتاريخ الحركة أم بوقت إدخالها */
    by: "تاريخ الحركة" | "وقت الإدخال";
  }
): ReviewRow[] {
  const stamps = entryStamps(audit);
  const { from, to } = options.window;

  const picked: ReviewRow[] = [];
  for (const movement of movements) {
    const stamp =
      stamps.get(stampKey(movement.entryNo, movement.date)) ?? null;

    const when =
      options.by === "وقت الإدخال"
        ? stamp
          ? stamp.at.slice(0, 10)
          : null
        : (movement.date ?? "").slice(0, 10);

    /* ومن لا وقتَ إدخالٍ له لا يُعرض في مراجعة الإدخال — ولا يُنسب ليومٍ */
    if (!when) continue;
    if (when < from || when > to) continue;

    picked.push({ movement, stamp, flags: [] });
  }

  /* ---- المكرَّرُ المحتمل: نفسُ اليوم والمبلغ والبند ---- */
  const seen = new Map<string, number>();
  for (const row of picked) {
    const m = row.movement;
    const key = `${m.date}|${round3(m.amount)}|${m.itemName ?? ""}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  for (const row of picked) {
    const m = row.movement;
    const flags: ReviewFlag[] = [];

    if (!m.project && PROJECT_COST.test(m.debitCode ?? "")) {
      flags.push("بلا مشروع");
    }
    if (!(m.party ?? "").trim() && !(m.person ?? "").trim()) {
      flags.push("بلا طرف");
    }
    if (m.approval !== "معتمدة") flags.push("تنتظر اعتماداً");

    const key = `${m.date}|${round3(m.amount)}|${m.itemName ?? ""}`;
    if ((seen.get(key) ?? 0) > 1) flags.push("مكرَّرةٌ محتملة");

    if (!row.stamp) flags.push("بلا سجلّ إدخال");

    row.flags = flags;
  }

  /*
    والأحدثُ أوّلاً: المراجعةُ تبدأ بآخر ما دخل. وترتيبُها بوقت
    الإدخال إن عُرف، وإلّا فبرقم القيد — فهو تسلسلُ الإدخال نفسه.
  */
  return picked.sort((a, b) => {
    if (a.stamp && b.stamp) return b.stamp.at.localeCompare(a.stamp.at);
    if (a.stamp) return -1;
    if (b.stamp) return 1;
    return Number(b.movement.entryNo) - Number(a.movement.entryNo);
  });
}

export type ReviewSummary = {
  rows: number;
  total: number;
  byUser: { user: string; rows: number; total: number }[];
  flagged: number;
};

export function reviewSummary(rows: readonly ReviewRow[]): ReviewSummary {
  const byUser = new Map<string, { rows: number; total: number }>();
  let total = 0;
  let flagged = 0;

  for (const row of rows) {
    total = round3(total + row.movement.amount);
    if (row.flags.length > 0) flagged += 1;
    const user = row.stamp?.user ?? "بلا سجلّ";
    const was = byUser.get(user) ?? { rows: 0, total: 0 };
    byUser.set(user, {
      rows: was.rows + 1,
      total: round3(was.total + row.movement.amount),
    });
  }

  return {
    rows: rows.length,
    total,
    flagged,
    byUser: [...byUser]
      .map(([user, v]) => ({ user, ...v }))
      .sort((a, b) => b.rows - a.rows),
  };
}
