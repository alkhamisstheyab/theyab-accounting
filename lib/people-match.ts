/**
 * مطابقة الاسم المكتوب في الحركة بصاحبه في ملفّ الموظفين.
 *
 * قيود السلف والعهد تحمل اسم صاحبها في خانة «الدافع/المستلم» لا معرّفه،
 * والاسم يُكتب كما يُنادى به: «مصطفى الأنصاري» لمن في ملفّه «مصطفى
 * عبدالماليك محمد الأنصاري». فالمطابقة الحرفية لا تجده، فلا يظهر رصيد
 * سلفته في المسيّر ولا يُخصم — وقد وقع هذا فعلاً في مسيّر سبتمبر ٢٠٢٦.
 *
 * والقاعدة التي اعتمدها صاحب الشركة: **اسمان يكفيان** — الأول والأخير.
 * فمن اتّفق أولُ اسمه وآخرُه فهو هو، وما بينهما أسماءُ آباءٍ تُكتب وتُترك.
 *
 * وحيث أشكل الأمر لم يُخمَّن: إن وافق الاسمُ موظفَين فلا مطابقة، لأن
 * خصم سلفةٍ من غير صاحبها أسوأ من ألّا يظهر تنبيهٌ.
 */

import { normalizeArabic } from "./contract-links";

/**
 * الكلمة مجرَّدةً من «ال» التعريف.
 *
 * «الأنصاري» و«أنصاري» اسمٌ واحد يُكتب بالوجهين، والتجريد يقع على
 * الطرفين معاً فلا يُخلّ بالمقارنة.
 */
const bare = (word: string): string =>
  word.startsWith("ال") && word.length > 3 ? word.slice(2) : word;

/** كلمات الاسم مسوّاةً: الألف والياء والتاء والتشكيل ثم «ال» */
export function nameWords(name: string): string[] {
  return normalizeArabic(name)
    .split(" ")
    .filter((w) => w.length > 0)
    .map(bare);
}

/**
 * أهما اسمٌ واحد؟
 *
 * إمّا تطابقٌ تامّ بعد التسوية، وإمّا اتّفاقُ الأول والأخير — وذلك لا
 * يكون باسمٍ مفردٍ، فـ«حسين» وحده لا يدلّ على أحد.
 */
export function sameName(a: string, b: string): boolean {
  const x = nameWords(a);
  const y = nameWords(b);
  if (x.length === 0 || y.length === 0) return false;
  if (x.join(" ") === y.join(" ")) return true;
  if (x.length < 2 || y.length < 2) return false;
  return x[0] === y[0] && x[x.length - 1] === y[y.length - 1];
}

/**
 * يجد صاحب الاسم بين الموظفين — أو لا يجده.
 *
 * التطابق التامّ مقدَّمٌ على الاسمين، فلو كان في الملفّ «محمد علي» و«محمد
 * صالح علي» فالمكتوب «محمد علي» له لا لغيره. وما بقي مشتبهاً رُدّ فارغاً.
 */
export function matchPerson<T extends { name: string }>(
  name: string,
  people: readonly T[]
): T | null {
  const target = nameWords(name).join(" ");
  if (!target) return null;

  const exact = people.filter((p) => nameWords(p.name).join(" ") === target);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  const loose = people.filter((p) => sameName(p.name, name));
  return loose.length === 1 ? loose[0] : null;
}
