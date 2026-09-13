/**
 * يختبر منطق الدخول على PostgreSQL حقيقية (PGlite) بلا خادم ولا متصفح.
 * يحاكي نفس الاستعلامات التي يكتبها lib/server/auth.ts حرفياً.
 */
import fs from "fs";
import path from "path";
import { PGlite } from "@electric-sql/pglite";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const DUMMY = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.7VmQbLPvJl8p3B0uY0Yt5zK3Qw1ZaLq";

let pass = 0;
let fail = 0;
const check = (label, ok, extra = "") => {
  console.log(`  ${ok ? "✓" : "✗"} ${label}${extra ? "  — " + extra : ""}`);
  ok ? pass++ : fail++;
};

const db = await PGlite.create();
await db.exec(fs.readFileSync(path.join("db", "schema.sql"), "utf8"));

const uuid = () =>
  "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () =>
    Math.floor(Math.random() * 16).toString(16)
  );

async function verifyPassword(plain, hash) {
  const matched = await bcrypt.compare(plain, hash || DUMMY);
  return Boolean(hash) && matched;
}

async function login(name, password) {
  const { rows } = await db.query(
    `SELECT id, name, permissions, password_hash, failed_attempts, locked_until
     FROM users WHERE name = $1 AND active`,
    [name.trim()]
  );
  const row = rows[0];

  if (row?.locked_until && new Date(row.locked_until) > new Date()) {
    return { ok: false, reason: "locked" };
  }
  const good = await verifyPassword(password, row?.password_hash ?? null);
  if (!row || !good) {
    if (row) {
      const attempts = row.failed_attempts + 1;
      const lock =
        attempts >= MAX_ATTEMPTS
          ? new Date(Date.now() + LOCK_MINUTES * 60_000)
          : null;
      await db.query(
        `UPDATE users SET failed_attempts = $2, locked_until = $3 WHERE id = $1`,
        [row.id, lock ? 0 : attempts, lock?.toISOString() ?? null]
      );
    }
    return { ok: false, reason: "bad" };
  }
  await db.query(
    `UPDATE users SET failed_attempts = 0, locked_until = NULL, last_seen_at = now() WHERE id = $1`,
    [row.id]
  );
  const token = randomBytes(32).toString("base64url");
  await db.query(
    `INSERT INTO sessions (token, user_id, expires_at, user_agent) VALUES ($1,$2,$3,'')`,
    [token, row.id, new Date(Date.now() + 14 * 86400_000).toISOString()]
  );
  return { ok: true, token, user: row };
}

async function sessionUser(token) {
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.permissions FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now() AND u.active`,
    [token]
  );
  return rows[0] ?? null;
}

/* ---------------- التهيئة ---------------- */

const ownerId = uuid();
const clerkId = uuid();
await db.query(
  `INSERT INTO users (id,name,job_title,role,permissions,password_hash) VALUES ($1,$2,$3,$4,$5,$6)`,
  [ownerId, "ذياب الخميس", "صاحب الشركة", "owner", ["movements.approve", "users.manage"], await bcrypt.hash("Theyab#2026", 12)]
);
await db.query(
  `INSERT INTO users (id,name,job_title,role,permissions,password_hash) VALUES ($1,$2,$3,$4,$5,$6)`,
  [clerkId, "سكرتيرة", "سكرتيرة", "secretary", ["movements.view"], await bcrypt.hash("Office#2026", 12)]
);

console.log("\n— كلمة المرور —");
check("الصحيحة تُقبل", (await login("ذياب الخميس", "Theyab#2026")).ok);
check("الخاطئة تُرفض", !(await login("ذياب الخميس", "wrongpass")).ok);
check("اسم غير موجود يُرفض", !(await login("لا أحد", "anything")).ok);

const { rows: stored } = await db.query(`SELECT password_hash FROM users WHERE id=$1`, [ownerId]);
check(
  "الكلمة لا تُخزَّن صريحة",
  !stored[0].password_hash.includes("Theyab") && stored[0].password_hash.startsWith("$2")
);

console.log("\n— الإيقاف بعد المحاولات —");
for (let i = 0; i < MAX_ATTEMPTS; i++) await login("سكرتيرة", "nope" + i);
const locked = await login("سكرتيرة", "Office#2026");
check("يُقفل بعد 5 محاولات حتى بالكلمة الصحيحة", !locked.ok && locked.reason === "locked");

await db.query(`UPDATE users SET locked_until = NULL, failed_attempts = 0 WHERE id=$1`, [clerkId]);
check("يعود بعد رفع الإيقاف", (await login("سكرتيرة", "Office#2026")).ok);

console.log("\n— الجلسة —");
const session = await login("ذياب الخميس", "Theyab#2026");
check("الرمز يعطي المستخدم", (await sessionUser(session.token))?.name === "ذياب الخميس");
check("رمز مزوّر لا يعطي شيئاً", (await sessionUser("forged-token")) === null);

await db.query(`UPDATE sessions SET expires_at = now() - interval '1 day' WHERE token=$1`, [session.token]);
check("الجلسة المنتهية ترفض", (await sessionUser(session.token)) === null);

const live = await login("ذياب الخميس", "Theyab#2026");
await db.query(`UPDATE users SET active = false WHERE id=$1`, [ownerId]);
check("إيقاف الحساب يُبطل جلسته القائمة", (await sessionUser(live.token)) === null);
await db.query(`UPDATE users SET active = true WHERE id=$1`, [ownerId]);

console.log("\n— الصلاحيات على الخادم —");
const clerk = await sessionUser((await login("سكرتيرة", "Office#2026")).token);
check("السكرتيرة لا تملك الاعتماد", !clerk.permissions.includes("movements.approve"));
const owner = await sessionUser((await login("ذياب الخميس", "Theyab#2026")).token);
check("صاحب الشركة يملكه", owner.permissions.includes("movements.approve"));

console.log("\n— قيود القاعدة —");
try {
  await db.query(`INSERT INTO users (id,name,role) VALUES ($1,'ذياب الخميس','owner')`, [uuid()]);
  check("اسم مستخدم مكرر", false, "قُبل!");
} catch {
  check("اسم مستخدم مكرر يُرفض", true);
}
try {
  await db.query(
    `INSERT INTO movements (id,entry_no,fiscal_year,approval) VALUES ($1,1,2026,'شيء آخر')`,
    [uuid()]
  );
  check("حالة اعتماد غير معروفة", false, "قُبلت!");
} catch {
  check("حالة اعتماد غير معروفة تُرفض", true);
}
await db.query(`DELETE FROM users WHERE id=$1`, [clerkId]);
const { rows: orphan } = await db.query(`SELECT count(*)::int n FROM sessions WHERE user_id=$1`, [clerkId]);
check("حذف المستخدم يحذف جلساته", orphan[0].n === 0);

await db.close();
console.log(`\nنجح ${pass} · فشل ${fail}`);
process.exit(fail === 0 ? 0 : 1);
