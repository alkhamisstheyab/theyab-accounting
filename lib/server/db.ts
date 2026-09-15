import "server-only";

import { Pool, type QueryResultRow } from "pg";

import type { Queryable } from "./state";

/**
 * الاتصال بقاعدة البيانات.
 *
 * مجمّع اتصالات واحد للعملية كلها: فتح اتصال لكل طلب يُنهك القاعدة،
 * وNext في التطوير يعيد تحميل الوحدات فيُنشئ مجمّعاً جديداً كل مرة —
 * لذلك يُحفظ على globalThis.
 *
 * ولا يُستورد هذا الملف إلا على الخادم: "server-only" يجعل استيراده من
 * مكوّن عميل خطأ بناء لا تسريباً صامتاً لرابط القاعدة.
 */

const globalForDb = globalThis as unknown as { __pool?: Pool };

function pool(): Pool {
  if (globalForDb.__pool) return globalForDb.__pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL غير مضبوط — أضفه في ملف .env.local قبل تشغيل الخادم."
    );
  }

  const created = new Pool({
    connectionString,
    // المزوّدون السحابيون يشترطون TLS، والخادم المحلي لا يوفّره
    ssl: /\blocalhost\b|\b127\.0\.0\.1\b/.test(connectionString)
      ? undefined
      : { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  globalForDb.__pool = created;
  return created;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await pool().query<T>(sql, params);
  return result.rows;
}

/** أول صف أو null — للاستعلامات التي تتوقّع واحداً */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * ينفّذ دالة داخل معاملة واحدة.
 *
 * الكتابات المحاسبية لا تُجزّأ: حركة تُسجَّل وسجل تدقيق يُكتب معها إما
 * أن يقعا معاً أو لا يقع أيّهما.
 */
export async function transaction<T>(
  work: (run: typeof query) => Promise<T>
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const run = (async <R extends QueryResultRow = QueryResultRow>(
      sql: string,
      params: unknown[] = []
    ) => (await client.query<R>(sql, params)).rows) as typeof query;

    const result = await work(run);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/* ------------------------------------------------------------------ */
/* واجهة واحدة للقراءة والكتابة                                        */
/* ------------------------------------------------------------------ */

/*
  دوالّ القراءة والكتابة (state.ts و writes.ts) تعمل على واجهة Queryable
  المجرّدة، فتقبل pg على الخادم و PGlite في الفحص. وهنا يُوصَل الطرفان.
*/

/** للقراءة: كل استعلام يأخذ اتصالاً من المجمّع ويعيده */
export const readable: Queryable = {
  query: async (text, values = []) => ({ rows: await query(text, values) }),
};

/**
  معاملة بواجهة Queryable.

  ولا غنى عنها للكتابة: المجمّع يعطي لكل استعلام اتصالاً قد يختلف، فلو
  كُتبت المعاملة عليه لوقع BEGIN على اتصال والإدراج على آخر — فلا تُلغى
  الكتابة عند الخطأ ولا تُحفظ الحركة وقيدُها معاً.
 */
export function inTransaction<T>(
  work: (db: Queryable) => Promise<T>
): Promise<T> {
  return transaction((run) =>
    work({
      query: async (text, values = []) => ({ rows: await run(text, values) }),
    })
  );
}
