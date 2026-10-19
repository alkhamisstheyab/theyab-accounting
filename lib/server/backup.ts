/**
 * النسخة الاحتياطية من الخادم.
 *
 * كانت النسخة لا تُؤخذ إلا من المتصفّح بيد صاحبه: يفتح الإعدادات
 * فيضغط، والنظام يُلِحّ عليه «مضى كذا يوماً». وفيها ثلاث علل:
 *
 *   الأولى أنها تعتمد على أن يتذكّر إنسان. فإن سافر أو شُغل أو نسي،
 *   مضت الأسابيع بلا نسخة ولا يدري.
 *
 *   والثانية أنها تحمل **ما في ذلك الجهاز** لا ما في الدفاتر. فجهازٌ
 *   لم يتّصل منذ يومين نسختُه ناقصةٌ يومين، ومن أخذها وهو محجوبٌ عن
 *   الرواتب أخذ نسخةً بلا رواتب — ولو استُرجعت لمحت ما لم يره.
 *
 *   والثالثة — وهي أخفاها وأمرُّها — أن المتصفّح لا يرى تجزئة كلمة
 *   المرور قطّ: تُنزع من كل صفٍّ يخرج من القاعدة (SECRETS في permits).
 *   فنسخةُ المتصفّح `pinHash` فيها فراغٌ لكلِّ مستخدم. والاسترجاع
 *   يقرأ كلمات المرور من هذا الحقل بعينه. فمن استرجع نسخةَ متصفّحٍ
 *   أخرج نظاماً **لا يدخله أحدٌ ولا صاحبُه** — فالدخول يشترط
 *   `Boolean(hash)`، والفراغ لا يُطابقه شيء.
 *
 * فهذه تُقرأ من القاعدة نفسها: كاملةً لا مرشَّحة، وبالتجزئات من
 * عمودها لا من `data`. وصورتُها صورةُ نسخة المتصفّح حرفاً بحرف —
 * يقبلها `migrate.mjs` ويقرؤها الاستيراد، فما لا يُسترجع ليس نسخة.
 */

import { exportBackup, type AppState } from "../storage";
import { readState, type Queryable } from "./state";

const asObject = (v: unknown): Record<string, unknown> | null => {
  if (v == null) return null;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return typeof v === "object" ? (v as Record<string, unknown>) : null;
};

/**
 * المستخدمون بتجزئاتهم.
 *
 * والتجزئة والصفُّ من استعلامٍ واحد، فلا تُطابَق بالترتيب ولا
 * بالمعرّف: معرّفُ العمود `uuid` ومعرّفُ التطبيق في `data` قد
 * يختلفان — وقد اختلفا فعلاً، فـ`migrate` يحوّل بـ`uuidFor`.
 */
async function usersWithHashes(db: Queryable): Promise<AppState["users"]> {
  const { rows } = await db.query(
    `SELECT data, password_hash FROM users ORDER BY name`
  );
  const users: Record<string, unknown>[] = [];
  for (const row of rows) {
    const user = asObject(row.data);
    if (!user || Object.keys(user).length === 0) continue;
    users.push({ ...user, pinHash: String(row.password_hash ?? "") });
  }
  return users as AppState["users"];
}

/**
 * الحالة كاملةً كما تصلح للاسترجاع.
 *
 * ولا تمرّ على `readableState`: ذاك للمتصفّح، يُرشّح بما يقرؤه صاحبُ
 * الجلسة. والنسخةُ المرشَّحةُ ليست نسخة — فإن استُرجعت محت ما حُجب.
 */
export async function backupState(db: Queryable): Promise<AppState> {
  /*
    صورةُ لحظةٍ واحدة. والحالة تُقرأ على عشرين استعلاماً، والمستوى
    المعتاد (READ COMMITTED) يرى كلُّ استعلامٍ ما كُتب قبله — فتُلتقط
    حركةٌ بلا عقدها، أو دفعةٌ أُقرّت بعد قراءة إقرارها.
  */
  await db.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
  const state = await readState(db);
  return { ...state, users: await usersWithHashes(db) };
}

/** النسخة نصّاً، بصورة ملفّ النسخة نفسها */
export async function serverBackup(db: Queryable): Promise<string> {
  return exportBackup(await backupState(db));
}
