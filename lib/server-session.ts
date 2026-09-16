/**
 * جلسة الخادم — من المتصفّح.
 *
 * دخول المتصفّح شيء ودخول الخادم شيء آخر، وهما اليوم منفصلان: الأول
 * يفتح الشاشات ويقرأ من جهازك، والثاني يأذن بالقراءة من القاعدة
 * والكتابة فيها. ولا تعمل المزامنة بغير الثاني.
 *
 * وستصير واحدةً في المرحلة الخامسة حين تُبدَّل المصادر، فيصير دخول
 * الخادم هو الدخول. وإلى ذلك الحين، هذا الملف هو الجسر بينهما.
 */

export type ServerUser = {
  id: string;
  name: string;
  jobTitle: string;
  role: string;
  permissions: string[];
  mustChangePassword: boolean;
};

async function body(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** من الداخل الآن؟ null إن لا جلسة */
export async function whoAmI(): Promise<ServerUser | null> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await body(res);
    return (data.user as ServerUser) ?? null;
  } catch {
    return null;
  }
}

export type SignInResult =
  | { ok: true; user: ServerUser }
  | { ok: false; error: string };

export async function signIn(name: string, password: string): Promise<SignInResult> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, password }),
    });
    const data = await body(res);
    if (!res.ok) {
      return { ok: false, error: String(data.error ?? "تعذّر الدخول") };
    }
    return { ok: true, user: data.user as ServerUser };
  } catch {
    return { ok: false, error: "تعذّر الوصول إلى الخادم" };
  }
}

export async function signOut(): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    /* انقطع الخطّ — والجلسة تنتهي بنفسها بعد أسبوعين */
  }
}

/** يغيّر كلمة المرور ويعيد سبب الرفض إن رُفضت */
export async function changePassword(
  current: string,
  next: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ current, next }),
    });
    const data = await body(res);
    if (!res.ok) return { ok: false, error: String(data.error ?? "تعذّر التغيير") };
    return { ok: true };
  } catch {
    return { ok: false, error: "تعذّر الوصول إلى الخادم" };
  }
}
