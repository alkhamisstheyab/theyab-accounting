/**
 * فحصُ النسخة: أتعود الدفاترُ منها أم لا؟
 *
 * النسخةُ تُكتب كلَّ ليلةٍ، ولا يُعلم أتصلح للاسترجاع حتى يُحتاج إليها
 * — وذاك أسوأُ وقتٍ للعلم. فمن ظنّ أنّ عنده نسخاً وهي لا تعود، أسوأُ
 * حالاً من يعلم أنْ لا نسخةَ عنده: الأوّلُ لا يحتاط والثاني يحتاط.
 *
 * فتُسحب النسخةُ **من المخزن** بعد كتابتها — لا تُفحص من الذاكرة، فذاك
 * يفحص الذاكرةَ لا المخزن — وتُفكّ وتُقرأ بالدالّة التي يقرأ بها
 * الاسترجاعُ نفسُه (`parseBackup`)، ثم تُقاس بثلاثة:
 *
 *   • **أمانةُ القراءة**: ما في الملفّ من صفوفٍ يصل كلُّه إلى الحالة
 *     بعد التسوية. وهذا أخطرُها: حقلٌ يُحفظ ولا يُحمَّل يسقط صامتاً،
 *     ولا يُكتشف إلا بعد شهورٍ حين يُسأل عن رقمٍ فلا يوجد.
 *   • **ما يُدخل بها**: تجزئاتُ كلمات المرور — وبغيرها تعود الدفاترُ
 *     ولا يعود البابُ الذي يُدخل منه.
 *   • **قياسٌ بالدفاتر الحيّة**: نسخةٌ فيها نصفُ ما في القاعدة نسخةٌ
 *     مقطوعة. والأقلُّ بقليلٍ طبيعيٌّ — فالدفاترُ تكبر بعد أخذها.
 */

import type { AppState } from "../storage";
import { parseBackup } from "../storage";

export type VerifyCheck = { name: string; ok: boolean; detail: string };

export type Verdict = {
  ok: boolean;
  at: string;
  /** مسارُ النسخة المفحوصة في المخزن */
  path: string;
  checks: VerifyCheck[];
};

/** المجموعاتُ التي تُعدّ صفوفاً — والبقيّةُ كائناتٌ لا تُحصى بالطول */
const ROWS = [
  "movements",
  "projects",
  "contractors",
  "users",
  "employees",
  "attendance",
  "payrollRuns",
  "materials",
  "materialReceipts",
  "workItems",
  "quotations",
  "invoices",
  "audit",
] as const;

const count = (state: Partial<AppState>, field: string): number => {
  const value = (state as Record<string, unknown>)[field];
  return Array.isArray(value) ? value.length : 0;
};

export function verifyBackup(
  content: string,
  path: string,
  live: AppState
): Verdict {
  const checks: VerifyCheck[] = [];
  const add = (name: string, ok: boolean, detail = "") =>
    checks.push({ name, ok, detail });

  /* ---- ١. تُقرأ أصلاً ---- */
  let raw: Record<string, unknown>;
  let state: AppState;
  try {
    raw = (JSON.parse(content).data ?? {}) as Record<string, unknown>;
    state = parseBackup(content);
    add("الملفّ يُقرأ بالدالّة التي يقرأ بها الاسترجاع", true);
  } catch (error) {
    add(
      "الملفّ يُقرأ بالدالّة التي يقرأ بها الاسترجاع",
      false,
      String((error as Error)?.message ?? error)
    );
    return { ok: false, at: new Date().toISOString(), path, checks };
  }

  /* ---- ٢. أمانةُ القراءة: لا يسقط صفٌّ في التسوية ---- */
  const dropped: string[] = [];
  for (const field of ROWS) {
    const before = count(raw as Partial<AppState>, field);
    const after = count(state, field);
    if (after < before) dropped.push(`${field}: ${before} ← ${after}`);
  }
  add(
    "ولا يسقط منه صفٌّ عند القراءة",
    dropped.length === 0,
    dropped.length === 0 ? `${ROWS.length} مجموعةً` : dropped.join(" · ")
  );

  /* ---- ٣. ما يُدخل بها ---- */
  const users = state.users ?? [];
  const withHash = users.filter(
    (u) => typeof u.pinHash === "string" && u.pinHash.length > 20
  ).length;
  add(
    "وفيه كلماتُ المرور",
    users.length > 0 && withHash === users.length,
    `${withHash} من ${users.length}`
  );

  /* ---- ٤. الدفاترُ فيه ---- */
  add(
    "وفيه الحركاتُ وسجلُّ التدقيق",
    (state.movements ?? []).length > 0 && (state.audit ?? []).length > 0,
    `${(state.movements ?? []).length} حركة · ${(state.audit ?? []).length} تدقيق`
  );

  /* ---- ٥. أرقامُ القيود لا تتكرّر في السنة ---- */
  const seen = new Set<string>();
  const twice: string[] = [];
  for (const m of state.movements ?? []) {
    const key = `${m.fiscalYear}/${m.entryNo}`;
    if (m.entryNo && seen.has(key)) twice.push(key);
    else if (m.entryNo) seen.add(key);
  }
  add(
    "وأرقامُ القيود لا تتكرّر في السنة",
    twice.length === 0,
    twice.length === 0 ? "" : twice.slice(0, 5).join("، ")
  );

  /* ---- ٦. قياسٌ بالدفاتر الحيّة ---- */
  /*
    والأقلُّ بقليلٍ طبيعيّ: النسخةُ أُخذت قبل لحظاتٍ والدفاترُ تكبر.
    وإنما يُنكَر النقصُ الفاحش — نسخةٌ فيها نصفُ ما في القاعدة.
  */
  const short: string[] = [];
  for (const field of ROWS) {
    const here = count(state, field);
    const there = count(live, field);
    if (there >= 20 && here < there * 0.95) {
      short.push(`${field}: ${here} من ${there}`);
    }
  }
  add(
    "وما فيه يقارب ما في القاعدة",
    short.length === 0,
    short.length === 0
      ? `${count(state, "movements")} حركة مقابل ${count(live, "movements")}`
      : short.join(" · ")
  );

  return {
    ok: checks.every((c) => c.ok),
    at: new Date().toISOString(),
    path,
    checks,
  };
}
