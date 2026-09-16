/**
 * الكتابة إلى القاعدة صفّاً صفّاً.
 *
 * النظام في المتصفّح يكتب حالته كلها في كل تغيير، وذلك سليمٌ على
 * جهازٍ واحد وقاتلٌ على خادمٍ مشترك: السكرتيرة تحفظ حركةً فتمحو
 * اعتماداً وقّعه المدير قبلها بدقيقتين، بلا خطأ ولا تنبيه.
 *
 * فيُرسَل ما تغيّر وحده. اثنان على صفّين مختلفين لا يتصادمان أبداً،
 * واثنان على الصفّ نفسه يغلب آخرهما — ويُسجَّل في الصفّ من كتبه ومتى،
 * وفي سجل التدقيق ما جرى.
 *
 * وكل كتابة تأخذ رقماً من تسلسلٍ واحد، فيُعرف بعدها ما استجدّ.
 */

/*
  بلا "server-only": هذا الملف أوامرُ SQL على واجهةٍ تُمرَّر إليه، لا
  اتّصالَ فيه ولا سرّ. وبه تُفحص الكتابة على قاعدةٍ محلّية من سطر
  الأوامر. والاتّصال وحده — lib/server/db.ts — هو المحجوز على الخادم.
*/
import { COLLECTIONS, WHOLE_FIELDS, collectionOf } from "./collections";
import type { Queryable } from "./state";

/** تحويل معرّف التطبيق إلى uuid — القاعدة تشترطه */
import { uuidFor as uuid } from "../ids";
export { uuidFor } from "../ids";

type Row = Record<string, unknown>;

/** ما يطلبه المتصفّح: صفوفٌ تُكتب وأخرى تُحذف */
export type ChangeSet = {
  /** لكل مجموعة: الصفوف المضافة أو المعدّلة */
  upserts?: Record<string, Row[]>;
  /** لكل مجموعة: معرّفات ما حُذف */
  deletes?: Record<string, string[]>;
  /** المجموعات الصغيرة تُكتب كاملةً */
  whole?: Record<string, unknown>;
};

export type ApplyResult = {
  /** أعلى رقم تغيير بعد الكتابة — يحفظه المتصفّح ليسأل بعده */
  rev: number;
  written: number;
  deleted: number;
};

/** أعلى رقم تغيير في القاعدة الآن */
export async function currentRev(db: Queryable): Promise<number> {
  const { rows } = await db.query("SELECT last_value::bigint AS v FROM change_seq");
  return Number(rows[0]?.v ?? 0);
}

/**
 * يكتب صفوف مجموعةٍ واحدة.
 *
 * INSERT ... ON CONFLICT: الصفّ الجديد يُضاف والقائم يُحدَّث، في أمرٍ
 * واحد. فلا يُسأل أولاً «أموجود؟» ثم يُكتب — وبين السؤال والكتابة
 * يتّسع الوقت لكاتبٍ آخر.
 */
async function upsert(
  db: Queryable,
  field: string,
  rows: Row[],
  actor: string
): Promise<number> {
  const collection = collectionOf(field);
  if (!collection || rows.length === 0) return 0;

  for (const row of rows) {
    const key = collection.keyOf(row);
    if (!key) continue;

    const cols = collection.columns(row);
    const names = ["id", ...Object.keys(cols), "data", "updated_by", "updated_at", "rev"];
    const values: unknown[] = [
      uuid(key),
      ...Object.values(cols),
      JSON.stringify(row),
      actor,
    ];

    const placeholders = values.map((_, i) => `$${i + 1}`);
    placeholders.push("now()", "nextval('change_seq')");

    /*
      الأعمدة المحروسة يملكها الخادم: تُكتب عند الإنشاء ثم لا يمسّها
      المتصفّح. وأهمّها كلمة المرور — ولولا هذا لكتب المتصفّح تجزئةً
      قديمة يحملها فوق كلمةٍ غيّرها صاحبها على الخادم.

      وتُعاد إلى data من الصفّ القائم، فلا يختلف العمود عن الكائن —
      ولو اختلفا لأظهرت المقارنة اليومية فرقاً لا يزول أبداً.
    */
    const guarded = collection.guarded ?? [];
    const guardedColumns = new Set(guarded.map((g) => g.column));

    const updates = names
      .filter((n) => n !== "id" && !guardedColumns.has(n))
      .map((n) => {
        if (n === "updated_at") return "updated_at = now()";
        if (n === "rev") return "rev = nextval('change_seq')";
        if (n === "data" && guarded.length > 0) {
          const keep = guarded
            .map((g) => `'${g.key}', ${collection.table}.${g.column}`)
            .join(", ");
          return `data = EXCLUDED.data || jsonb_build_object(${keep})`;
        }
        return `${n} = EXCLUDED.${n}`;
      });

    await db.query(
      `INSERT INTO ${collection.table} (${names.join(",")})
       VALUES (${placeholders.join(",")})
       ON CONFLICT (id) DO UPDATE SET ${updates.join(", ")}`,
      values
    );
  }
  return rows.length;
}

/** يحذف صفوفاً ويترك لكلٍّ شاهداً، فيعرف المتصفّح أنها زالت */
async function remove(
  db: Queryable,
  field: string,
  ids: string[],
  actor: string
): Promise<number> {
  const collection = collectionOf(field);
  if (!collection || ids.length === 0) return 0;

  for (const id of ids) {
    await db.query(`DELETE FROM ${collection.table} WHERE id = $1::uuid`, [uuid(id)]);
    await db.query(
      `INSERT INTO deletions (collection, row_id, actor, rev)
       VALUES ($1, $2, $3, nextval('change_seq'))
       ON CONFLICT (collection, row_id)
       DO UPDATE SET actor = EXCLUDED.actor, at = now(), rev = nextval('change_seq')`,
      [field, uuid(id), actor]
    );
  }
  return ids.length;
}

/** المجموعات الصغيرة: تُمحى وتُكتب كاملةً في معاملة واحدة */
async function writeWhole(
  db: Queryable,
  field: string,
  value: unknown
): Promise<number> {
  switch (field) {
    case "chart": {
      await db.query("DELETE FROM accounts");
      let order = 0;
      for (const a of (value ?? []) as Row[]) {
        await db.query(
          `INSERT INTO accounts (code,name,parent,type,nature,level,statement,active,postable,sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            String(a.code ?? ""),
            String(a.name ?? ""),
            String(a.parent ?? ""),
            String(a.type ?? ""),
            String(a.nature ?? ""),
            Number(a.level) || 3,
            String(a.statement ?? ""),
            a.active !== false,
            a.postable !== false,
            order++,
          ]
        );
      }
      return 1;
    }
    case "items": {
      await db.query("DELETE FROM items");
      let order = 0;
      for (const i of (value ?? []) as Row[]) {
        await db.query(`INSERT INTO items (code,name,account,sort_order) VALUES ($1,$2,$3,$4)`, [
          String(i.code ?? ""),
          String(i.name ?? ""),
          String(i.account ?? ""),
          order++,
        ]);
      }
      return 1;
    }
    case "payments": {
      await db.query("DELETE FROM payment_methods");
      let order = 0;
      for (const p of (value ?? []) as Row[]) {
        await db.query(`INSERT INTO payment_methods (label,account,sort_order) VALUES ($1,$2,$3)`, [
          String(p.label ?? ""),
          String(p.account ?? ""),
          order++,
        ]);
      }
      return 1;
    }
    case "people": {
      await db.query("DELETE FROM people");
      let order = 0;
      for (const name of (value ?? []) as string[]) {
        await db.query(`INSERT INTO people (name,sort_order) VALUES ($1,$2)`, [String(name), order++]);
      }
      return 1;
    }
    case "company": {
      const c = (value ?? {}) as Row;
      await db.query(
        `UPDATE company SET name=$1,name_en=$2,logo=$3,address=$4,phone=$5,
                email=$6,cr_number=$7,approval_threshold=$8,backup_every_days=$9,
                updated_at=now()
          WHERE id = 1`,
        [
          String(c.name ?? ""),
          String(c.nameEn ?? ""),
          String(c.logo ?? ""),
          String(c.address ?? ""),
          String(c.phone ?? ""),
          String(c.email ?? ""),
          String(c.crNumber ?? ""),
          Number(c.approvalThreshold) || 0,
          Number(c.backupEveryDays) || 10,
        ]
      );
      return 1;
    }
    case "payrollSettings": {
      await db.query(
        `INSERT INTO payroll_settings (id,data) VALUES (1,$1::jsonb)
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
        [JSON.stringify(value ?? {})]
      );
      return 1;
    }
    case "openingBalances": {
      await db.query("DELETE FROM opening_balances");
      const byYear = (value ?? {}) as Record<string, Record<string, Row>>;
      for (const [year, accounts] of Object.entries(byYear)) {
        for (const [code, entry] of Object.entries(accounts)) {
          await db.query(
            `INSERT INTO opening_balances (fiscal_year,account_code,debit,credit)
             VALUES ($1,$2,$3,$4)`,
            [
              Number(year) || 0,
              code,
              Number(entry?.debit) || 0,
              Number(entry?.credit) || 0,
            ]
          );
        }
      }
      return 1;
    }
    case "yearLocks": {
      await db.query("DELETE FROM year_locks");
      const locks = (value ?? {}) as Record<string, Row>;
      for (const [year, lock] of Object.entries(locks)) {
        await db.query(
          `INSERT INTO year_locks (fiscal_year,closed_at,closed_by,note)
           VALUES ($1,$2,$3,$4)`,
          [
            Number(year) || 0,
            String(lock?.closedAt ?? new Date().toISOString()),
            String(lock?.closedBy ?? ""),
            String(lock?.note ?? ""),
          ]
        );
      }
      return 1;
    }
    default:
      return 0;
  }
}

/**
 * يطبّق مجموعة تغييرات على اتصالٍ داخل معاملةٍ فتحها غيره.
 *
 * هذه هي التي يستدعيها الخادم: المعاملة تُفتح على اتصالٍ واحد من
 * المجمّع (inTransaction في db.ts) ثم يُعمل داخلها.
 */
export async function applyChangesIn(
  db: Queryable,
  changes: ChangeSet,
  actor: string
): Promise<{ written: number; deleted: number }> {
  let written = 0;
  let deleted = 0;

  for (const [field, rows] of Object.entries(changes.upserts ?? {})) {
    written += await upsert(db, field, rows, actor);
  }
  for (const [field, ids] of Object.entries(changes.deletes ?? {})) {
    deleted += await remove(db, field, ids, actor);
  }
  for (const [field, value] of Object.entries(changes.whole ?? {})) {
    if (!(WHOLE_FIELDS as readonly string[]).includes(field)) continue;
    written += await writeWhole(db, field, value);
  }

  return { written, deleted };
}

/**
 * يطبّق مجموعة تغييرات ويفتح المعاملة بنفسه.
 *
 * لاتصالٍ واحد لا مجمّع: PGlite في الفحوص وسطر الأوامر. وعلى الخادم
 * تُستعمل applyChangesIn داخل inTransaction، وإلا وقع BEGIN على اتصال
 * والإدراج على آخر.
 *
 * وفي الحالين: إمّا أن تُكتب كلها أو لا يُكتب منها شيء — حركةٌ تُحفظ
 * وقيدُها لا يُحفظ أسوأ من ألا يُحفظ شيء.
 */
export async function applyChanges(
  db: Queryable,
  changes: ChangeSet,
  actor: string
): Promise<ApplyResult> {
  await db.query("BEGIN");
  let counts: { written: number; deleted: number };
  try {
    counts = await applyChangesIn(db, changes, actor);
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }

  return { rev: await currentRev(db), ...counts };
}
/**
 * ما استجدّ بعد رقمٍ ما — صفوفٌ كُتبت ومعرّفاتٌ حُذفت.
 *
 * به يرى المدير اعتماد المهندس وهو يقع، وترى السكرتيرة حركةً حذفها
 * غيرها فتزول من شاشتها.
 */
export async function changesSince(
  db: Queryable,
  since: number
): Promise<{ rev: number; upserts: Record<string, Row[]>; deletes: Record<string, string[]> }> {
  const upserts: Record<string, Row[]> = {};
  const deletes: Record<string, string[]> = {};

  for (const collection of COLLECTIONS) {
    const { rows } = await db.query(
      `SELECT data FROM ${collection.table} WHERE rev > $1 ORDER BY rev`,
      [since]
    );
    if (rows.length > 0) {
      upserts[collection.field] = rows.map((r) =>
        typeof r.data === "string" ? JSON.parse(r.data) : (r.data as Row)
      );
    }
  }

  const { rows: gone } = await db.query(
    `SELECT collection, row_id FROM deletions WHERE rev > $1 ORDER BY rev`,
    [since]
  );
  for (const r of gone) {
    (deletes[String(r.collection)] ??= []).push(String(r.row_id));
  }

  return { rev: await currentRev(db), upserts, deletes };
}
