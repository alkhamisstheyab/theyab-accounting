import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

import { ALL_PERMISSIONS, Permission } from "../permissions";
import { query, queryOne, transaction } from "./db";

/**
 * الدخول والجلسات — على الخادم.
 *
 * الفرق الجوهري عن النسخة السابقة: التحقق لم يعد في المتصفح. كلمة المرور
 * لا تُقارَن إلا هنا، والصلاحية لا تُفحص إلا هنا، فلا يتجاوزها من يفتح
 * أدوات المطوّر. هذا هو الذي يحوّل الصلاحيات من تنظيم إلى حماية.
 */

const COOKIE = "theyab_session";
const SESSION_DAYS = 14;

/** كلفة bcrypt: 12 دورة — بطيئة على المهاجم، غير محسوسة للمستخدم */
const BCRYPT_ROUNDS = 12;

/** بعدها يُقفل الحساب مؤقتاً — النظام على الإنترنت يُجرَّب عليه آلياً */
export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export const MIN_PASSWORD_LENGTH = 8;

/**
 * صلاحيات الجلسة.
 *
 * دورا المالك والمدير العام معرَّفان بأنهما «كل الصلاحيات بلا استثناء»،
 * فتُمنح لهما الصلاحية المضافة حديثاً بلا تأشير. ولولا ذلك لبقيت شاشةٌ
 * جديدة محجوبةً عن صاحب الشركة حتى يُحدَّث صفُّه ويصل الخادم — وقد وقع
 * ذلك يوم أُضيفت شاشة المستحقات.
 *
 * وما سواهما يُقرأ من صفّه كما هو: منح صلاحيةٍ بلا قرار أخطر من حجبها.
 */
const sessionPermissions = (role: string, stored: unknown): Permission[] => {
  const kept = (Array.isArray(stored) ? stored : []).filter(
    (p): p is Permission => ALL_PERMISSIONS.includes(p as Permission)
  );
  return role === "owner" || role === "manager" ? ALL_PERMISSIONS : kept;
};

export type SessionUser = {
  id: string;
  name: string;
  jobTitle: string;
  role: string;
  permissions: Permission[];
  mustChangePassword: boolean;
};

/* ------------------------------------------------------------------ */
/* كلمات المرور                                                        */
/* ------------------------------------------------------------------ */

export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, BCRYPT_ROUNDS);

/**
 * يتحقّق من كلمة المرور.
 *
 * يُشغَّل التجزئة حتى على مستخدم غير موجود، فزمن الرد واحد في الحالتين
 * ولا يُستدلّ منه على وجود الحساب.
 */
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.7VmQbLPvJl8p3B0uY0Yt5zK3Qw1ZaLq";

/**
 * الأرقام السرّية القديمة — من زمن المتصفّح.
 *
 * كانت تُجزّأ في المتصفّح بـ SHA-256، وهي أربعة أرقام. وذلك مقبول على
 * جهازٍ في المكتب، وغيرُ مقبول على الإنترنت: عشرة آلاف احتمالٍ تُجرَّب
 * في ثوانٍ لولا إيقاف الحساب بعد خمس محاولات.
 *
 * ولو رُفضت هذه التجزئات عند النقل لما دخل أحدٌ الخادم أصلاً — ولقيل
 * له «كلمة المرور خاطئة» فظنّها نسياناً لا عطلاً. فتُقبل مرةً واحدة،
 * ويُلزَم صاحبها بكلمة مرورٍ حقيقية قبل أن يرى شيئاً.
 */
const isLegacyHash = (hash: string): boolean => /^[0-9a-f]{64}$/.test(hash);

const legacyDigest = (plain: string): string =>
  createHash("sha256").update(`theyab:${plain}`).digest("hex");

export async function verifyPassword(
  plain: string,
  hash: string | null
): Promise<boolean> {
  if (hash && isLegacyHash(hash)) {
    /* المقارنة في زمنٍ ثابت — ولو كان الهاش قديماً */
    const digest = Buffer.from(legacyDigest(plain), "hex");
    const stored = Buffer.from(hash, "hex");
    return digest.length === stored.length && timingSafeEqual(digest, stored);
  }

  // تُشغَّل المقارنة دائماً ثم يُحكم — وإلا اختصر الشرط وفضح زمنُ الردّ
  // أن الحساب بلا كلمة مرور
  const matched = await bcrypt.compare(plain, hash || DUMMY_HASH);
  return Boolean(hash) && matched;
}

/** أعلى تجزئةٍ قديمة تُلزم صاحبها بتغيير كلمته */
export const needsRealPassword = (hash: string | null): boolean =>
  Boolean(hash) && isLegacyHash(hash as string);

export function passwordProblem(plain: string): string | null {
  if (plain.length < MIN_PASSWORD_LENGTH) {
    return `كلمة المرور ${MIN_PASSWORD_LENGTH} محارف فأكثر`;
  }
  if (/^\d+$/.test(plain)) {
    return "لا تجعلها أرقاماً فقط — أضف حروفاً";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* الجلسات                                                             */
/* ------------------------------------------------------------------ */

const newToken = () => randomBytes(32).toString("base64url");

export async function createSession(
  userId: string,
  userAgent: string
): Promise<string> {
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);

  await query(
    `INSERT INTO sessions (token, user_id, expires_at, user_agent)
     VALUES ($1, $2, $3, $4)`,
    [token, userId, expires.toISOString(), userAgent.slice(0, 300)]
  );

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // على الإنترنت لا تُرسَل إلا عبر HTTPS؛ وفي التطوير المحلي بلا شهادة
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await query("DELETE FROM sessions WHERE token = $1", [token]);
  }
  jar.delete(COOKIE);
}

/** المستخدم الحالي من كعكة الجلسة، أو null */
export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;

  const row = await queryOne<{
    id: string;
    name: string;
    job_title: string;
    role: string;
    permissions: string[];
    must_change_pin: boolean;
    password_hash: string;
  }>(
    `SELECT u.id, u.name, u.job_title, u.role, u.permissions, u.must_change_pin,
            u.password_hash
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now() AND u.active`,
    [token]
  );

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    jobTitle: row.job_title,
    role: row.role,
    permissions: sessionPermissions(row.role, row.permissions),
    /* يُفحص في كل طلب لا عند الدخول وحده، وإلا تُخطّى بإعادة تحميل الصفحة */
    mustChangePassword:
      row.must_change_pin || needsRealPassword(row.password_hash),
  };
}

/* ------------------------------------------------------------------ */
/* الحراسة                                                             */
/* ------------------------------------------------------------------ */

export class AuthError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** يوجب جلسة قائمة، وإلا رفض الطلب */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) throw new AuthError(401, "يلزم تسجيل الدخول");
  return user;
}

/**
 * يوجب صلاحية بعينها.
 *
 * كل معالج يكتب أو يقرأ بيانات حسّاسة يبدأ بهذا السطر. والفحص هنا هو
 * الفحص الحقيقي — ما في الواجهة إخفاءٌ للأزرار لا أكثر.
 */
export async function requirePermission(
  permission: Permission
): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.permissions.includes(permission)) {
    throw new AuthError(403, "ليست لديك صلاحية هذا الإجراء");
  }
  return user;
}

/* ------------------------------------------------------------------ */
/* محاولات الدخول                                                      */
/* ------------------------------------------------------------------ */

export type LoginOutcome =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: string; lockedUntil?: Date };

/**
 * تسويةُ اسم المستخدم في قاعدة البيانات.
 *
 * الاسم يُكتب الآن بيد صاحبه ولا يُختار من قائمة، والعربية تُكتب الهمزة
 * فيها وتُترك: «نوح احمد ابراهيم» و«نوح أحمد إبراهيم» رجلٌ واحد، ومن
 * سُجّل بأحدهما وكتب الآخر مُنع — ثم مُنع خمساً فأُوقف حسابه ربع ساعة،
 * وهو لم يُخطئ في شيء.
 *
 * فتُسوّى قبل المقارنة: الألف بأشكالها، والياء المقصورة، والتاء
 * المربوطة، والتطويل، والتشكيل، والمسافات الزائدة.
 *
 * وكلمةُ المرور لا تُسوّى ولا حرفاً — تُقارَن كما كُتبت.
 */
const normalizedName = (expr: string): string =>
  `regexp_replace(
     translate(btrim(${expr}), 'أإآٱىةـًٌٍَُِّْ', 'اااايه'),
     '[[:space:]]+', ' ', 'g')`;

/**
 * يسجّل الدخول باسم المستخدم وكلمة المرور.
 *
 * رسالة الفشل واحدة سواء كان الاسم خاطئاً أو الكلمة — فلا يُعرف من
 * الرسالة أي الحسابات موجود.
 */
export async function login(
  name: string,
  password: string,
  userAgent: string
): Promise<LoginOutcome> {
  const matches = await query<{
    id: string;
    name: string;
    job_title: string;
    role: string;
    permissions: string[];
    password_hash: string;
    must_change_pin: boolean;
    failed_attempts: number;
    locked_until: Date | null;
  }>(
    `SELECT id, name, job_title, role, permissions, password_hash,
            must_change_pin, failed_attempts, locked_until
     FROM users
     WHERE ${normalizedName("name")} = ${normalizedName("$1")}
       AND active`,
    [name.trim()]
  );

  /*
    وحيث أشكل لم يُخمَّن: اسمان يستويان بعد التسوية حسابان لا حساب،
    و`queryOne` كان يأخذ أوّلهما فيُدخل رجلاً على حساب غيره لو وافقت
    كلمته. فيُقدَّم التطابق التامّ، فإن لم يكن فلا دخول — وهذا خللٌ في
    تسمية الحسابات يُراجع فيه المدير، لا خطأٌ من صاحبه.
  */
  let row = matches.length === 1 ? matches[0] : null;
  if (matches.length > 1) {
    const typed = name.trim();
    const exact = matches.filter((u) => u.name.trim() === typed);
    if (exact.length === 1) row = exact[0];
    else {
      return {
        ok: false,
        reason: "تعذّر تمييز الحساب — اسمان متشابهان. راجع المدير.",
      };
    }
  }

  if (row?.locked_until && row.locked_until > new Date()) {
    return {
      ok: false,
      reason: `الحساب موقوف مؤقتاً بعد محاولات خاطئة متكرّرة. حاول بعد قليل.`,
      lockedUntil: row.locked_until,
    };
  }

  const good = await verifyPassword(password, row?.password_hash ?? null);

  if (!row || !good) {
    if (row) {
      const attempts = row.failed_attempts + 1;
      const lock =
        attempts >= MAX_ATTEMPTS
          ? new Date(Date.now() + LOCK_MINUTES * 60_000)
          : null;
      await query(
        `UPDATE users SET failed_attempts = $2, locked_until = $3 WHERE id = $1`,
        [row.id, lock ? 0 : attempts, lock?.toISOString() ?? null]
      );
    }
    return { ok: false, reason: "اسم المستخدم أو كلمة المرور غير صحيحة" };
  }

  await transaction(async (run) => {
    await run(
      `UPDATE users SET failed_attempts = 0, locked_until = NULL,
              last_seen_at = now()
       WHERE id = $1`,
      [row.id]
    );
    // تنظيف الجلسات المنتهية عند كل دخول — أرخص من مهمة مجدولة
    await run(`DELETE FROM sessions WHERE expires_at < now()`);
  });

  await createSession(row.id, userAgent);

  return {
    ok: true,
    user: {
      id: row.id,
      name: row.name,
      jobTitle: row.job_title,
      role: row.role,
      permissions: sessionPermissions(row.role, row.permissions),
      /*
        من دخل برقمه السرّي القديم لا يمضي حتى يضع كلمة مرورٍ حقيقية:
        أربعة أرقام تكفي في المكتب ولا تكفي على الإنترنت.
      */
      mustChangePassword:
        row.must_change_pin || needsRealPassword(row.password_hash),
    },
  };
}

/** يغيّر المستخدم كلمة مروره بنفسه، بعد التحقق من الحالية */
export async function changeOwnPassword(
  userId: string,
  current: string,
  next: string
): Promise<{ ok: boolean; reason?: string }> {
  const row = await queryOne<{ password_hash: string }>(
    `SELECT password_hash FROM users WHERE id = $1 AND active`,
    [userId]
  );
  if (!row) return { ok: false, reason: "الحساب غير موجود" };

  if (!(await verifyPassword(current, row.password_hash))) {
    return { ok: false, reason: "كلمة المرور الحالية غير صحيحة" };
  }

  const problem = passwordProblem(next);
  if (problem) return { ok: false, reason: problem };

  if (await verifyPassword(next, row.password_hash)) {
    return { ok: false, reason: "كلمة المرور الجديدة مطابقة للحالية" };
  }

  await query(
    `UPDATE users SET password_hash = $2, must_change_pin = false WHERE id = $1`,
    [userId, await hashPassword(next)]
  );
  return { ok: true };
}

/**
 * محارف الكلمة المؤقّتة.
 *
 * تُقرأ من شاشةٍ وتُنقل في رسالة، فحُذف منها ما يلتبس: الصفر والحرف O،
 * والواحد مع l و I. ومن أملى كلمةً فيها حرفٌ ملتبس عاد صاحبها يسأل،
 * فيضيع من الوقت أكثر مما وُفِّر من طولها.
 */
const TEMP_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/**
 * يولّد كلمةً مؤقّتة.
 *
 * من مصدر عشوائيٍّ معمّى لا من `Math.random` — فهي كلمة مرورٍ وإن قصر
 * عمرها، وبين توليدها واستعمالها ساعاتٌ يُرسل فيها الاسم في رسالة.
 *
 * واثنا عشر محرفاً: أطول من الحدّ الأدنى بكثير، لأنها تُقرأ ولا تُحفظ.
 */
function temporaryPassword(length = 12): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += TEMP_ALPHABET[bytes[i] % TEMP_ALPHABET.length];
  }
  /* فيها حروفٌ قطعاً، فلا تُردّ بقاعدة «ليست أرقاماً فقط» */
  return out;
}

export type ResetOutcome =
  | { ok: true; name: string; password: string }
  | { ok: false; reason: string };

/**
 * يُعيد صاحبُ الصلاحية تعيين كلمة مرور مستخدمٍ آخر.
 *
 * كان هذا لا يُفعل إلا من سطر الأوامر على جهاز صاحب الشركة
 * (`db/reset-password.mjs`)، وهو لا يحمل حاسوبه معه. وفي شاشة
 * المستخدمين خانةُ «رقم الدخول» تُغري من يراها، والخادم يرفض ما تكتبه
 * **صامتاً** لأن عمود كلمة المرور محروس — فيظنّ المدير أنه أعاد التعيين،
 * ويُعطي الرجلَ رقماً لا يفتح، فيُحاول خمساً فيُوقَف حسابه.
 *
 * فصار من الشاشة: يولّد الخادم كلمةً مؤقّتة ويعرضها **مرّةً واحدة** على
 * من طلبها، ثم لا سبيل إلى قراءتها — المحفوظ تجزئتُها لا هي. ويُعلَّم
 * الحساب بأن يُلزَم صاحبه بكلمةٍ يعرفها وحده عند أول دخول، فلا تبقى
 * كلمةٌ يعرفها اثنان.
 *
 * ويُرفع معها كلُّ إيقافٍ وتُصفَّر المحاولات — فمن نسي كلمته أكثرَ ما
 * يكون قد حاول حتى أُوقف.
 */
export async function resetUserPassword(userId: string): Promise<ResetOutcome> {
  const row = await queryOne<{ id: string; name: string }>(
    `SELECT id, name FROM users WHERE id = $1`,
    [userId]
  );
  if (!row) return { ok: false, reason: "الحساب غير موجود" };

  const password = temporaryPassword();
  await query(
    `UPDATE users
        SET password_hash = $2,
            must_change_pin = true,
            failed_attempts = 0,
            locked_until = NULL
      WHERE id = $1`,
    [row.id, await hashPassword(password)]
  );

  return { ok: true, name: row.name, password };
}

/** مقارنة ثابتة الزمن — للأسرار خارج bcrypt */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
