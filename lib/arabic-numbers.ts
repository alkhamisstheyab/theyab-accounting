/**
 * تفقيط المبالغ — تحويل الرقم إلى كلمات عربية.
 *
 * الدينار الكويتي يتكوّن من 1000 فلس، فالكسر ثلاث خانات.
 */

const ONES = [
  "",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];

const TENS = [
  "",
  "",
  "عشرون",
  "ثلاثون",
  "أربعون",
  "خمسون",
  "ستون",
  "سبعون",
  "ثمانون",
  "تسعون",
];

const HUNDREDS = [
  "",
  "مائة",
  "مائتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
];

/** صيغ المفرد والمثنى والجمع لكل مرتبة */
const SCALES: { singular: string; dual: string; plural: string }[] = [
  { singular: "", dual: "", plural: "" },
  { singular: "ألف", dual: "ألفان", plural: "آلاف" },
  { singular: "مليون", dual: "مليونان", plural: "ملايين" },
  { singular: "مليار", dual: "ملياران", plural: "مليارات" },
];

/** يحوّل عدداً من 1 إلى 999 إلى كلمات */
function under1000(n: number): string {
  if (n === 0) return "";

  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;

  if (hundreds) parts.push(HUNDREDS[hundreds]);

  if (rest) {
    if (rest < 20) {
      parts.push(ONES[rest]);
    } else {
      const unit = rest % 10;
      const ten = Math.floor(rest / 10);
      // العربية تقدّم الآحاد على العشرات: خمسة وعشرون
      parts.push(unit ? `${ONES[unit]} و${TENS[ten]}` : TENS[ten]);
    }
  }

  return parts.join(" و");
}

/** يصوغ المرتبة بحسب عددها: ألف / ألفان / ثلاثة آلاف / أحد عشر ألفاً */
function scaleWord(count: number, level: number): string {
  const scale = SCALES[level];
  if (!scale.singular) return "";
  if (count === 1) return scale.singular;
  if (count === 2) return scale.dual;
  if (count <= 10) return scale.plural;
  // 11–99 تمييزها مفرد منصوب: أحد عشر ألفاً
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 99) return `${scale.singular}اً`;
  return scale.singular;
}

/** صيغ المعدود الخمس في العربية */
type CounterForms = {
  /** للواحد — يُذكر بلا عدد: دينار كويتي واحد */
  one: string;
  /** للاثنين — يُذكر بلا عدد: ديناران كويتيان */
  two: string;
  /** 3–10 جمع مجرور: ثلاثة دنانير كويتية */
  few: string;
  /** 11–99 مفرد منصوب: خمسة عشر ديناراً كويتياً */
  accusative: string;
  /** مضاعفات المائة والألف مفرد مجرور: مائة دينار كويتي */
  genitive: string;
};

const DINAR: CounterForms = {
  one: "دينار كويتي واحد",
  two: "ديناران كويتيان",
  few: "دنانير كويتية",
  accusative: "ديناراً كويتياً",
  genitive: "دينار كويتي",
};

const FILS: CounterForms = {
  one: "فلس واحد",
  two: "فلسان",
  few: "فلوس",
  accusative: "فلساً",
  genitive: "فلس",
};

/**
 * يصوغ العدد مع معدوده. التمييز في العربية يتبع آخر خانتين:
 * صفر → مجرور · 1 و2 → يُذكر المعدود وحده · 3–10 → جمع · 11–99 → منصوب.
 */
function withCounter(n: number, forms: CounterForms): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;

  const lastTwo = n % 100;
  const word =
    lastTwo === 0
      ? forms.genitive
      : lastTwo === 1 || lastTwo === 2
      ? forms.genitive
      : lastTwo <= 10
      ? forms.few
      : forms.accusative;

  return `${numberToArabicWords(n)} ${word}`;
}

/** يحوّل عدداً صحيحاً إلى كلمات عربية */
export function numberToArabicWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return "صفر";

  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const parts: string[] = [];
  for (let level = groups.length - 1; level >= 0; level--) {
    const group = groups[level];
    if (!group) continue;

    if (level === 0) {
      parts.push(under1000(group));
      continue;
    }

    const word = scaleWord(group, level);
    // ألف ومليون تُذكران وحدهما دون «واحد»
    if (group === 1 || group === 2) {
      parts.push(word);
    } else {
      parts.push(`${under1000(group)} ${word}`);
    }
  }

  return parts.filter(Boolean).join(" و");
}

/**
 * تفقيط مبلغ بالدينار الكويتي.
 *
 * مثال: 1250.500 → «فقط ألف ومائتان وخمسون ديناراً كويتياً وخمسمائة فلس لا غير»
 */
export function amountInWords(amount: number): string {
  const value = Math.abs(Number(amount) || 0);
  const dinars = Math.floor(value);
  const fils = Math.round((value - dinars) * 1000);

  const parts: string[] = [];
  if (dinars > 0) parts.push(withCounter(dinars, DINAR));
  if (fils > 0) parts.push(withCounter(fils, FILS));
  if (parts.length === 0) return "فقط صفر لا غير";

  const sign = Number(amount) < 0 ? "سالب " : "";
  return `فقط ${sign}${parts.join(" و")} لا غير`;
}
