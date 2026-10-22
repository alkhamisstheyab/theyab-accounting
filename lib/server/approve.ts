/**
 * اعتمادُ الحركات على الخادم: يُكتب الاعتمادُ وحدَه، ولا يُعتمد ما أدخله صاحبُه.
 *
 * ومسألتان اجتمعتا هنا.
 *
 * **الأولى: من يعتمد ولا يُدخل كان اعتمادُه يُردّ.** فالكتابةُ في
 * مجموعة الحركات تطلب «إدخال حركة» أو «تعديل حركة»، و«اعتماد الحركات»
 * ليست منهما. فمن أُعطي الاعتمادَ وحدَه — كالمهندسة المكتبيّة — اعتمد
 * في جهازه فظهرت الحركةُ معتمدةً أمامه، وردَّ الخادمُ الصفَّ، فلا تدخل
 * الدفاترَ ولا يعلم صاحبُ الشركة أنّ أحداً اعتمد. وهي العلّةُ نفسُها
 * التي وقعت لشهادة المهندس في العقود، وعلاجُها واحد: يُقرأ الصفُّ
 * المحفوظ، ويُؤخذ من الوارد **حقولُ الاعتماد وحدَها**، ويبقى ما سواها
 * — المبلغُ والحسابُ والتاريخُ والبيان — كما هو عند الخادم. فلا
 * يُحتاج إلى الثقة بما أرسل: المحفوظُ هو الأصل، والواردُ لا يزيد عليه
 * إلا اعتماداً.
 *
 * **والثانية: من أدخل حركةً لا يعتمدها.** ويُعرف المُدخِلُ من سجلّ
 * التدقيق لا من الصفّ — فالصفُّ لا يحمل اسمَه، والسجلُّ يحمله لكلِّ
 * قيدٍ منذ أوّل يوم ولا يُحذف منه شيء. ويُستثنى صاحبُ الشركة والمديرُ
 * العام، فتفصيلُ ذلك في lib/approval.ts.
 *
 * والحارسُ في الخادم لا في الشاشة: فالإخفاءُ في الشاشة يُجاوزه من
 * يفتح أدوات المطوّر، وما لم يُكتب في القاعدة لا يُعتمد بحيلة.
 */

import { mayApproveOwn, selfApprovalBlock } from "../approval";
import type { Queryable } from "./state";

/** ما يكتبه صاحبُ «اعتماد الحركات» في الحركة — ولا شيءَ غيرَه */
const APPROVAL_FIELDS = [
  "approval",
  "approvedBy",
  "approvedAt",
  "approvalNote",
] as const;

type Row = Record<string, unknown>;

const str = (v: unknown): string => (v == null ? "" : String(v));

/**
 * يدمج الاعتمادَ في الصفّ المحفوظ ويردّ الناتج.
 *
 * ويردّ `null` إن لم يتغيّر شيء — فلا يُكتب صفٌّ بلا سبب فيُرفع رقمُ
 * تغييره، فيُوقظ أجهزةَ الناس بلا فائدة.
 */
export function mergeApproval(stored: Row, incoming: Row): Row | null {
  let changed = false;
  const merged: Row = { ...stored };
  for (const field of APPROVAL_FIELDS) {
    if (!(field in incoming)) continue;
    if (str(incoming[field]) === str(stored[field])) continue;
    merged[field] = incoming[field];
    changed = true;
  }
  return changed ? merged : null;
}

/** من أدخل القيدَ، من سجلّ التدقيق المحفوظ */
async function entrantOf(
  db: Queryable,
  entryNo: unknown,
  date: unknown
): Promise<string> {
  const stamp = `قيد ${str(entryNo)} · ${str(date)}`;
  const { rows } = await db.query(
    `SELECT actor FROM audit_log
      WHERE entity = 'حركة' AND action = 'إنشاء'
        AND (coalesce(summary,'') || ' ' || coalesce(after_val,'')) LIKE '%' || $1 || '%'
      ORDER BY at ASC LIMIT 1`,
    [stamp]
  );
  return rows.length > 0 ? str(rows[0].actor) : "";
}

export type ApprovalOutcome = {
  /** الصفوفُ التي يُكتب اعتمادُها */
  merged: Row[];
  /** ما مُنع، ومعه سببُه — يُعرض على صاحبه */
  blocked: { entryNo: string; reason: string }[];
};

/**
 * يأخذ من الوارد اعتمادَه وحدَه، ويمنع اعتمادَ المرء ما أدخله.
 *
 * وهو يُنادى حين تُردّ كتابةُ الحركات ومعه «اعتماد الحركات» — كما
 * يُنادى `certifyOnly` لشهادة المهندس.
 */
export async function approveOnly(
  db: Queryable,
  rows: unknown[],
  permissions: readonly string[],
  user: { name: string; role: string }
): Promise<ApprovalOutcome> {
  const out: ApprovalOutcome = { merged: [], blocked: [] };
  if (!permissions.includes("movements.approve")) return out;

  for (const raw of rows) {
    const incoming = (raw ?? {}) as Row;
    const id = str(incoming.id);
    if (!id) continue;

    const { rows: found } = await db.query(
      "SELECT data FROM movements WHERE id = $1",
      [id]
    );
    if (found.length === 0) continue;

    const stored = (
      typeof found[0].data === "string"
        ? JSON.parse(found[0].data)
        : found[0].data
    ) as Row;

    /*
      ولا يُسأل السجلُّ إلا عند الحاجة: فصاحبُ الشركة مستثنى، وصفٌّ
      لم يتغيّر اعتمادُه لا يُنظر فيه. وسؤالُ السجلّ لكلِّ صفٍّ في كلِّ
      رفعةٍ ثقلٌ بلا فائدة.
    */
    const merged = mergeApproval(stored, incoming);
    if (!merged) continue;

    if (!mayApproveOwn(user.role)) {
      const entrant = await entrantOf(db, stored.entryNo, stored.date);
      const reason = selfApprovalBlock(entrant, user.name, user.role);
      if (reason) {
        out.blocked.push({ entryNo: str(stored.entryNo), reason });
        continue;
      }
    }

    out.merged.push(merged);
  }

  return out;
}
