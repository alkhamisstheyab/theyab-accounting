/**
 * المستحقات — ما وجب للعامل والمقاول ولم يُدفع بعد.
 *
 * طلبه مجلس الإدارة والمهندسون في ٢٧ سبتمبر ٢٠٢٦، وعلّته من واقع العمل:
 * يُنجَز العمل فيستحقّ صاحبه أجره ساعتَه — نقلةُ خشب، كرينٌ ليوم، أجرُ
 * يوميةٍ لمن يعمل عند الطلب — ثم تُؤجَّل الدفعة بالتراضي لحسن العلاقة.
 * فإذا جاء السداد بعد أسابيع لم يُعرف المبلغ على وجهه، فيزيد أو ينقص،
 * وكلاهما ظلم: للرجل إن نقص، وللشركة إن زاد.
 *
 * فيُثبَّت الاستحقاق يوم يقع لا يوم يُدفع. والمهندس هو الذي يشهد إتمام
 * العمل، فهو الذي يُثبته، والإدارة تُقرّ المبلغ قبل أن يدخل الدفاتر.
 *
 * وليس هذا للمقاول صاحب العقد — فذاك له دفعاتٌ ومراحل واعتمادها في
 * «العقود». هذا لما لا عقد له.
 *
 * ولا جديد في المحاسبة: الاستحقاق قيدٌ مدينُه المصروف ودائنُه حساب
 * المستحقات، والسداد قيدٌ مدينُه المستحقات ودائنُه الصندوق أو البنك.
 * وحسابا دليلك موجودان منذ الإكسل ولم يُستعملا بعد.
 */

import { Movement, isApproved, round3, validate } from "./accounting";

/** 2120 مستحقات المقاولين · 2140 رواتب وأجور مستحقة */
export const CONTRACTOR_DUES = "2120";
export const WAGE_DUES = "2140";
export const DUES_ACCOUNTS = [CONTRACTOR_DUES, WAGE_DUES];

/** نوع العمل الذي استحقّ — يُختار بلفظ الموقع لا بلغة المحاسبة */
export type DueKind = {
  key: string;
  label: string;
  /** حساب المصروف الذي يُقيَّد مديناً */
  expense: string;
  /** حساب المستحقات الذي يُقيَّد دائناً */
  dues: string;
  note: string;
};

/**
 * أنواع ما يقع في المواقع، وحساب كلٍّ منها.
 *
 * والحسابات هي نفسها التي تُقيَّد عليها هذه المصروفات حين تُدفع نقداً،
 * فلا يختلف تصنيفُ العمل باختلاف وقت دفعه.
 */
export const DUE_KINDS: DueKind[] = [
  {
    key: "contractor",
    label: "عمل مقاول",
    expense: "5120",
    dues: CONTRACTOR_DUES,
    note: "مصنعية أو عمل مقاولٍ بلا عقد",
  },
  {
    key: "daily",
    label: "أجر يومية",
    expense: "5120",
    dues: WAGE_DUES,
    note: "عاملٌ باليومية عند الطلب",
  },
  {
    key: "equipment",
    label: "إيجار معدة",
    expense: "5140",
    dues: CONTRACTOR_DUES,
    note: "كرين، دكاك، مولد، كشاف",
  },
  {
    key: "transport",
    label: "نقل",
    expense: "5120",
    dues: CONTRACTOR_DUES,
    note: "نقل خشب أو حديد أو مواد",
  },
];

export const dueKind = (key: string): DueKind =>
  DUE_KINDS.find((k) => k.key === key) ?? DUE_KINDS[0];

/**
 * أهذه الحركة استحقاقٌ أم سداد؟
 *
 * الاستحقاق: حساب المستحقات دائن — نشأ الالتزام.
 * السداد: حساب المستحقات مدين — زال الالتزام أو بعضه.
 */
export const isDue = (m: Movement): boolean =>
  DUES_ACCOUNTS.includes(m.creditCode);

export const isDueSettlement = (m: Movement): boolean =>
  DUES_ACCOUNTS.includes(m.debitCode);

export type DueRow = {
  movement: Movement;
  /** المبلغ المستحقّ كما أُقرّ */
  amount: number;
  /** ما سُدّد منه */
  paid: number;
  /** ما بقي في ذمّة الشركة */
  remaining: number;
  /** كم يوماً مضى على استحقاقه */
  ageDays: number;
  settlements: Movement[];
  /** استحقاقٌ لم تُقرّه الإدارة بعد — لا يدخل الحسابات ولا يُسدَّد */
  pending: boolean;
};

export type DuePerson = {
  person: string;
  /** المُقرّ وغير المسدَّد */
  owed: number;
  /** المسجَّل بانتظار إقرار الإدارة */
  waiting: number;
  /** أقدم استحقاقٍ لم يُسدَّد، بالأيام */
  oldestDays: number;
  rows: DueRow[];
};

const daysBetween = (from: string, to: string): number => {
  const a = new Date(from + "T00:00:00Z").getTime();
  const b = new Date(to + "T00:00:00Z").getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
};

/**
 * يبني صفوف المستحقات وما سُدّد منها.
 *
 * والسداد يُنسب إلى استحقاقه بالربط الصريح (`dueId`) لا بالتخمين: فلو
 * وُزّع بالأقدم فالأقدم لظهر رجلٌ قُضي حقُّه وآخر لم يُقضَ، والمال واحد.
 * وما سُدّد بلا ربطٍ يُحسب على صاحبه إجمالاً ولا يُقفل استحقاقاً بعينه.
 */
export function buildDues(movements: Movement[], today: string) {
  const dues: DueRow[] = [];
  const settlementsByDue = new Map<string, Movement[]>();
  const loose: Movement[] = [];

  for (const m of movements) {
    if (!validate(m).valid) continue;
    if (!isDueSettlement(m)) continue;
    const id = (m.dueId ?? "").trim();
    if (!id) {
      loose.push(m);
      continue;
    }
    settlementsByDue.set(id, [...(settlementsByDue.get(id) ?? []), m]);
  }

  for (const m of movements) {
    if (!validate(m).valid) continue;
    if (!isDue(m)) continue;

    const settlements = settlementsByDue.get(m.id) ?? [];
    /* السداد غير المعتمد لا يُنقص الذمّة: لم يخرج المال بعد */
    const paid = round3(
      settlements.filter(isApproved).reduce((s, x) => s + x.amount, 0)
    );
    dues.push({
      movement: m,
      amount: round3(m.amount),
      paid,
      remaining: round3(m.amount - paid),
      ageDays: daysBetween(m.date, today),
      settlements,
      pending: !isApproved(m),
    });
  }

  dues.sort((a, b) => (a.movement.date < b.movement.date ? -1 : 1));

  const byPerson = new Map<string, DuePerson>();
  for (const row of dues) {
    const person = (row.movement.person || "").trim() || "بلا اسم";
    const entry =
      byPerson.get(person) ??
      ({ person, owed: 0, waiting: 0, oldestDays: 0, rows: [] } as DuePerson);
    entry.rows.push(row);
    if (row.pending) {
      entry.waiting = round3(entry.waiting + row.amount);
    } else {
      entry.owed = round3(entry.owed + row.remaining);
      if (row.remaining > 0) {
        entry.oldestDays = Math.max(entry.oldestDays, row.ageDays);
      }
    }
    byPerson.set(person, entry);
  }

  const people = [...byPerson.values()].sort((a, b) => b.owed - a.owed);

  return {
    dues,
    people,
    /* سدادٌ على حساب المستحقات بلا ربطٍ باستحقاقه — يُكشف ليُربط */
    loose,
    totalOwed: round3(people.reduce((s, p) => s + p.owed, 0)),
    totalWaiting: round3(people.reduce((s, p) => s + p.waiting, 0)),
  };
}

/** ما يُسدَّد الآن: المُقرّ الذي بقي منه شيء */
export const payableDues = (rows: DueRow[]): DueRow[] =>
  rows.filter((r) => !r.pending && r.remaining > 0.0005);

/**
 * سبب منع السداد، أو فارغ إن جاز.
 *
 * فلا يُدفع ما لم تُقرّه الإدارة، ولا يُدفع أكثر مما بقي — وهما العلّتان
 * اللتان من أجلهما طُلبت الشاشة.
 */
export function settlementProblem(row: DueRow, amount: number): string {
  if (row.pending) return "لم تُقرّ الإدارة هذا الاستحقاق بعد";
  if (!(amount > 0)) return "المبلغ غير صحيح";
  if (amount > row.remaining + 0.0005) {
    return `المتبقّي ${row.remaining.toFixed(3)} د.ك — لا يُدفع أكثر منه`;
  }
  return "";
}
