/**
 * سجلُّ الأطراف: المقاولون والموردون والعملاء.
 *
 * وكان الطرفُ لا وجودَ له إلا في عقده: جدولُ العقود يحمل اسمَ المقاول
 * وهاتفَه ومدنيَّه في كلِّ عقدٍ من عقوده. فمن له ثلاثةُ عقودٍ مكتوبٌ
 * ثلاثَ مرّات — ولو تغيّر هاتفُه صُحّح في ثلاثةِ مواضعَ أو بقي قديماً
 * في اثنين. ولم يكن له بابٌ يُعدَّل منه، ولا تخصّصٌ يُجمع به.
 *
 * و«الأشخاص» في النظام أسماءٌ مجرّدةٌ تصلح للاختيار في قائمة، ولا
 * تصلح سجلّاً.
 *
 * وعزلُ الموردين عن العملاء مقصودٌ: فالاستعلامُ عن مقاولٍ لا يُخالطه
 * عميلٌ، والعقدُ معه صادرٌ لا وارد. وبالتخصّص يُجمع أهلُ الصنعة:
 * النجّارون وحدَهم، والحدّادون وحدَهم.
 */

import type { CounterpartyType } from "./storage";

export type Party = {
  id: string;
  name: string;
  /** عميل · مقاول · مورّد — وبه يُعزل سجلٌّ عن سجلّ */
  kind: CounterpartyType;
  /** النجّار والحدّاد والبنّاء والصحّي — وبه يُجمع أهلُ الصنعة */
  specialty: string;
  phone: string;
  civilId: string;
  address: string;
  nationality: string;
  /** السجلُّ التجاريُّ للشركات، والترخيصُ للأفراد */
  licenseNumber: string;
  notes: string;
  /** ولا يُحذف من تعامَلَ معه: يُوقَف فلا يُقترح، ويبقى أثرُه في عقوده */
  active: boolean;
  createdAt: string;
};

/**
 * التخصّصاتُ المعتادةُ في مقاولات البناء.
 *
 * تُقترح ولا تُلزم: فالصنائعُ تتجدّد، ومن قُيّد بقائمةٍ مكتوبةٍ في
 * الشِّفْر لم يستطع كتابةَ صنعةٍ جديدةٍ إلا بتعديل البرنامج.
 */
export const SPECIALTIES = [
  "بنّاء",
  "حدّاد",
  "نجّار",
  "صحّي",
  "كهربائي",
  "تكييف",
  "دهّان",
  "بلاط وأرضيات",
  "جبس وديكور",
  "ألومنيوم",
  "زجاج",
  "عزل",
  "حفر وتدعيم",
  "خرسانة جاهزة",
  "طابوق وبلاط",
  "استشارات هندسية",
  "نقليات",
  "مواد بناء",
  "مساحة",
];

/* ------------------------------------------------------------------ */

export type PartyGroup = {
  specialty: string;
  parties: Party[];
};

/**
 * أطرافُ نوعٍ واحدٍ مجموعةً على تخصّصاتهم.
 *
 * ومن لا تخصّصَ له يُجمع في «بلا تخصّص» ويُعرض آخراً — ولا يُخفى:
 * فإخفاؤه يُنسيه، وهو أحقُّ بأن يُكمَل بيانُه من غيره.
 */
export function partiesBySpecialty(
  parties: readonly Party[],
  kind: CounterpartyType
): PartyGroup[] {
  const mine = parties.filter((p) => p.kind === kind);
  const groups = new Map<string, Party[]>();

  for (const party of mine) {
    const key = (party.specialty || "").trim() || "بلا تخصّص";
    const list = groups.get(key) ?? [];
    list.push(party);
    groups.set(key, list);
  }

  return [...groups]
    .map(([specialty, list]) => ({
      specialty,
      parties: [...list].sort((a, b) => a.name.localeCompare(b.name, "ar")),
    }))
    .sort((a, b) => {
      if (a.specialty === "بلا تخصّص") return 1;
      if (b.specialty === "بلا تخصّص") return -1;
      return a.specialty.localeCompare(b.specialty, "ar");
    });
}

/**
 * عقودُ طرفٍ وما له فيها.
 *
 * والمطابقةُ بالاسم: فعقودُ الشركة كُتبت قبل هذا السجلّ، ولا معرّفَ
 * فيها يُربط به. ومن انتظر ربطاً صريحاً لم يرَ عقداً من عقوده
 * القائمة.
 */
export const partyContracts = <T extends { name?: string }>(
  contracts: readonly T[],
  party: Party
): T[] =>
  contracts.filter(
    (c) => (c.name ?? "").trim() === party.name.trim() && party.name.trim() !== ""
  );

/**
 * أطرافٌ في العقود وليست في السجلّ.
 *
 * فالسجلُّ جاء بعد العقود، ولو تُرك فارغاً لبقي بلا فائدة. فيُستخرج
 * منها ما يُضاف بضغطة — بأسمائهم وهواتفهم ومدنيّاتهم كما في عقودهم.
 */
export function unregistered<
  T extends {
    name?: string;
    counterpartyType?: string;
    specialty?: string;
    phone?: string;
    civilId?: string;
    nationality?: string;
    address?: string;
  },
>(contracts: readonly T[], parties: readonly Party[], kind: CounterpartyType) {
  const known = new Set(parties.map((p) => p.name.trim()).filter(Boolean));
  const found = new Map<string, Omit<Party, "id" | "createdAt">>();

  for (const contract of contracts) {
    const name = (contract.name ?? "").trim();
    if (!name || known.has(name)) continue;
    if (contract.counterpartyType !== kind) continue;
    /* وأوّلُ عقدٍ يُحمل منه البيان، وما بعده لا يُزيحه */
    if (found.has(name)) continue;
    found.set(name, {
      name,
      kind,
      specialty: (contract.specialty ?? "").trim(),
      phone: (contract.phone ?? "").trim(),
      civilId: (contract.civilId ?? "").trim(),
      address: (contract.address ?? "").trim(),
      nationality: (contract.nationality ?? "").trim(),
      licenseNumber: "",
      notes: "",
      active: true,
    });
  }

  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name, "ar"));
}
