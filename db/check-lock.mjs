/**
 * يفحص الدخول الموحّد وقفل الشاشة.
 *
 *   node db/check-lock.mjs
 *
 * كان في النظام بابان: دخولٌ في المتصفّح يفتح الشاشات، ودخولٌ في
 * الخادم يأذن بالقاعدة. والأول حارسٌ يجلس في البيت الذي يحرسه — من
 * فتح أدوات المطوّر قال له «أنا المالك» فصدّقه — ولأنه يعرض الأسماء
 * ليُختار منها، وجب أن تصل قائمة المستخدمين كلَّ جهاز.
 *
 * فصار باباً واحداً: اسمٌ يُكتب وكلمةٌ يفحصها الخادم.
 *
 * والذي يُخشى منه:
 *   • أن تُحفظ كلمة المرور في الجهاز تيسيراً — فتُقرأ من التخزين.
 *   • أن يبقى الحساب مفتوحاً لمن جلس على جهازٍ قام صاحبه عنه.
 *   • أن يضيع عملُ من قام، فيكره القفل ويعطّله.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

/* متصفّحٌ مصطنع — والتخزين فيه هو موضع الفحص */
const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = { localStorage, addEventListener() {}, removeEventListener() {} };
globalThis.localStorage = localStorage;

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { lastUser, rememberUser, forgetUser, IDLE_LOCK_MS, HIDDEN_LOCK_MS } =
  await jiti.import("../lib/session.ts");

console.log("\nالاسم يُحفظ والكلمة لا تُحفظ:\n");

check("أول فتحٍ للجهاز: لا اسم", lastUser() === "");

rememberUser("ذياب أحمد خميس");
check("ومن دخل حُفظ اسمه", lastUser() === "ذياب أحمد خميس", lastUser());

check(
  "ولا أثر لكلمة المرور في التخزين",
  ![...store.values()].some((v) => /كلمة|password|pass/i.test(String(v))) &&
    store.size === 1,
  `${store.size} مفتاحاً: ${[...store.keys()].join("، ")}`
);

forgetUser();
check("و«غيّر المستخدم» ينسى الاسم", lastUser() === "");

rememberUser("سكرتيرة");
rememberUser("محاسب");
check("والجهاز يتذكّر آخر من دخل منه وحده", lastUser() === "محاسب", lastUser());

console.log("\nوالمهل معقولة — لا تُرهق ولا تُفرّط:\n");

check(
  "الحاسوب ربع ساعة",
  IDLE_LOCK_MS === 15 * 60_000,
  `${IDLE_LOCK_MS / 60_000} دقيقة`
);
check(
  "وهي أطول من أن يبلغها من يعمل",
  IDLE_LOCK_MS >= 5 * 60_000,
  "دقيقةٌ واحدة تُلجئ الموظف إلى كلمةٍ ضعيفة أو ورقةٍ على الشاشة"
);
check(
  "والهاتف دقيقتان من غياب الصفحة",
  HIDDEN_LOCK_MS === 2 * 60_000,
  `${HIDDEN_LOCK_MS / 60_000} دقيقة`
);
check(
  "ولا تُقفل للحظةٍ يخرج فيها إلى الحاسبة",
  HIDDEN_LOCK_MS >= 60_000
);

console.log("\nوالشاشة: بابٌ واحد لا بابان:\n");

const page = fs.readFileSync("app/page.tsx", "utf8");

check("لا شاشة دخولٍ في المتصفّح", !page.includes("function LoginScreen"));
check("ولا اختيارَ من قائمة الأسماء", !page.includes("users={activeUsers}"));
check("بل اسمٌ يُكتب", page.includes('<Field label="اسم المستخدم">'));
check("وكلمةٌ يفحصها الخادم", page.includes("await serverSignIn(name.trim(), password)"));
check("ويُسأل الخادم عند الإقلاع من الداخل", page.includes("void whoAmI().then((who)"));
check(
  "والصلاحية من الخادم لا من صفٍّ في الجهاز",
  page.includes("permissions: session.permissions as Permission[]")
);
check("والاسم وحده يُحفظ", page.includes("rememberUser(who.name)"));
check("و«لستَ أنت؟» تنساه", page.includes("forgetUser();"));

check("وللشاشة قفلٌ بزرّه", page.includes("اقفل الآن"));
check("وقفلٌ عند السكون", page.includes("Date.now() - last >= IDLE_LOCK_MS"));
check(
  "وقفلٌ إذا غابت الصفحة على الهاتف",
  page.includes("Date.now() - goneAt >= HIDDEN_LOCK_MS")
);
check(
  "والقفل يفتحه كلمةُ صاحبه من الخادم",
  page.includes("await serverSignIn(name, password)")
);
check(
  "وهو ستارةٌ فوق العمل لا خروجٌ منه",
  page.includes("fixed inset-0 z-50") && page.includes("عملك باقٍ كما تركته")
);

console.log("\nوقائمة المستخدمين لم تعد تخرج لمن لا يديرهم:\n");

const permits = fs.readFileSync("lib/server/permits.ts", "utf8");
check('users مقيَّدة بـ users.manage', permits.includes('users: ["users.manage"]'));

console.log(
  bad === 0
    ? "\n✓ دخولٌ واحد: الاسم محفوظ، والكلمة لا تُحفظ، والشاشة تُقفل ولا تُفرّغ"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
