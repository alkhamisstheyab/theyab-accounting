/**
 * الإشعارات — ما ينتظر المستخدم حين يدخل النظام.
 *
 * قرار مجلس الإدارة في ١٢ سبتمبر ٢٠٢٦: يُنبَّه صاحب الشركة والمدير العام
 * والمدير العام المالي والإداري بما تمّ وبما ينتظر قرارهم.
 *
 * وهي **محسوبة لا مخزّنة**: تُشتقّ من حالة النظام لحظة عرضها، فلا يبقى
 * إشعار عن دفعة اعتُمدت أو حركة صُحّحت. والإشعار الذي لا يزول بزوال سببه
 * يُفقد الثقة في بقية الإشعارات.
 *
 * وكل إشعار مشروط بصلاحية: لا يُنبَّه أحد إلى ما لا يستطيع فعله.
 */

import { Movement, isApproved, isNonProject, round3 } from "./accounting";
import { milestoneSummary, milestones } from "./milestones";
import { AuditEntry } from "./audit";
import type { AttendanceDay, Employee } from "./payroll";
import {
  PROBATION_DAYS,
  PROBATION_SOON,
  underProbation,
  type OpenProbation,
} from "./probation";
import { Permission } from "./permissions";
import { Quotation, WorkItem, isCostStale, quotationAgeDays } from "./quotations";
import {
  BackupMeta,
  daysSince,
} from "./file-backup";
import {
  type Message, Contractor, Installment, Project, installmentNet, isInstallmentDue } from "./storage";
import { allDurations, daysBetween } from "./contract-dates";

export type NoticeTone = "action" | "warn" | "info";

/**
 * تصفيةٌ تُطبَّق على الشاشة التي يفتحها الإشعار.
 *
 * فالشاشةُ تعرض العقودَ كلَّها، والإشعارُ يتكلّم عن بضعةٍ منها — ومن
 * فتحها من الإشعار كان يفتّش في الجميع ليعرف أيُّها المقصود. وطلبه صاحب
 * الشركة في ٢٨ أكتوبر ٢٠٢٦: «لا يأخذني إلى جميع العقود وأبحث فيهم
 * جميعهم… فهذا مضيعة للوقت، ومن الممكن أن يتأخّر صرفُ دفعة مستحقّة».
 */
export type NoticeFocus = "تنتظر إقرارك" | "مستحقة لم تُصرف";

export type Notice = {
  id: string;
  tone: NoticeTone;
  title: string;
  detail: string;
  /** الشاشة التي يُعالَج فيها */
  page?: string;
  /** وما يُعرض فيها من أول وهلة — فلا يُبحث عن المقصود بين الجميع */
  focus?: NoticeFocus;
  /** العدد المعروض على الشارة */
  count?: number;
  /** الصلاحية التي بدونها لا يُعرض */
  needs?: Permission;
};

export type NoticeInput = {
  movements: Movement[];
  contractors: Contractor[];
  /** المشاريع — لتأمين المواقع ومدده */
  projects: Project[];
  /** الموظفون — لإقاماتهم وأذون عملهم وفترات تجربتهم */
  employees: Employee[];
  /** الدوامُ — ومنه تُحسب أيّامُ العمل في التجربة، فالحدُّ بأيّام العمل */
  attendance: AttendanceDay[];
  quotations: Quotation[];
  workItems: WorkItem[];
  audit: AuditEntry[];
  /** طلباتُ العمل — ما وصل هذا الجهازَ منها، وهو مُرشَّحٌ على الخادم */
  messages: Message[];
  backup: BackupMeta | null;
  /** آخر دخول سابق لهذا المستخدم — لعرض ما استجدّ بعده */
  lastSeenAt: string;
  /** اسم المستخدم الحالي، فلا يُنبَّه إلى فعل نفسه */
  userName: string;
  /** تاريخ اليوم — يُمرَّر ليكون الحساب قابلاً للفحص */
  today: string;
  /** كل كم يوم تُؤخذ نسخة احتياطية — سياسة المجلس عشرة أيام */
  backupEveryDays: number;
};

const fmt3 = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });

/** الدفعات التي اعتمدها المهندس ولم تُقرّها الإدارة بعد */
export function awaitingConfirmation(
  contractors: Contractor[]
): { contract: Contractor; installment: Installment }[] {
  const rows: { contract: Contractor; installment: Installment }[] = [];
  for (const contract of contractors) {
    for (const installment of contract.installments) {
      if (installment.approved && !installment.confirmed) {
        rows.push({ contract, installment });
      }
    }
  }
  return rows;
}

/**
 * دفعاتُ عقدٍ واحدٍ المستحقّةُ التي لم يُصرف منها شيء.
 *
 * وتُصفّى بها شاشةُ اعتماد المراحل أيضاً، فيُعرض ما في الإشعار وحده —
 * والعدُّ والعرضُ من دالّةٍ واحدة، فلا يختلف ما يُقال عمّا يُرى.
 */
export function dueUnpaidOf(
  contract: Contractor,
  movements: Movement[]
): { installment: Installment; value: number }[] {
  if (contract.counterpartyType === "عميل") return []; // دفعات العميل واردة لا صادرة

  const paid = new Map<number, number>();
  for (const m of movements) {
    if (!isApproved(m)) continue;
    if (m.contractNumber !== contract.contractNumber) continue;

    /*
      المبلغُ الموزَّع يُنسب كلُّ حصّةٍ منه إلى دفعتها.

      وكان يُقرأ رقمُ الدفعة وحده، والموزَّعُ لا رقمَ دفعةٍ له — فدفعةٌ
      سُدّدت ضمن مبلغٍ موزَّعٍ على عدّة دفعات تبقى في التنبيه «لم يُصرف
      منها شيء» أبداً. ومن أربعةٍ وعشرين سطراً عُرضت على صاحب الشركة في
      ٢٨ أكتوبر ٢٠٢٦ كان سبعةٌ من هذا الباب — مدفوعةٌ تُعرض مستحقّة.
    */
    const splits = m.installmentSplits ?? [];
    if (splits.length > 0) {
      for (const part of splits) {
        const no = Number(part.number) || 0;
        paid.set(no, round3((paid.get(no) ?? 0) + (Number(part.amount) || 0)));
      }
      continue;
    }

    const key = Number(m.installmentNumber) || 0;
    paid.set(key, round3((paid.get(key) ?? 0) + m.amount));
  }

  const rows: { installment: Installment; value: number }[] = [];
  for (const installment of contract.installments) {
    if (!isInstallmentDue(installment)) continue;
    /*
      والعبرةُ بالصافي بعد الخصم: دفعةٌ خُصمت بالكامل لا شيءَ فيها يُصرف،
      فعرضُها مستحقّةً مطالبةٌ بمالٍ أُسقط. ودفعةُ العمر الأولى في ٥٠٠٦
      (٧٠٠ قيمةً و٧٠٠ خصماً بعد إنهاء العقد بالتراضي) كانت منها.
    */
    const value = installmentNet(installment);
    if (value <= 0) continue;
    if ((paid.get(installment.number) ?? 0) > 0) continue;
    rows.push({ installment, value });
  }
  return rows;
}

/** دفعات مستحقة لم يُصرف منها شيء */
export function dueUnpaid(
  contractors: Contractor[],
  movements: Movement[]
): { contract: Contractor; installment: Installment; value: number }[] {
  const rows: { contract: Contractor; installment: Installment; value: number }[] =
    [];

  for (const contract of contractors)
    for (const row of dueUnpaidOf(contract, movements))
      rows.push({ contract, ...row });

  return rows;
}

/**
 * حالة تأمين الموقع لكل مشروع قائم.
 *
 * والتنبيه قبل الانتهاء بشهر: مدّةٌ تكفي لمراجعة شركة التأمين وتجديد
 * الوثيقة قبل أن يعمل أحدٌ في موقعٍ بلا غطاء.
 *
 * والمشاريع المنتهية لا يُنبَّه إليها: لا عاملَ فيها يُؤمَّن عليه.
 */
export const INSURANCE_ALERT_DAYS = 30;

export type InsuranceState = "سارٍ" | "يقترب" | "منتهٍ" | "غير مسجّل";

export type InsuranceRow = {
  project: Project;
  state: InsuranceState;
  /** موجبٌ قبل الانتهاء، سالبٌ بعده، وصفرٌ لغير المسجّل */
  daysLeft: number;

  /**
   * أيُنبَّه على هذا الموقع؟
   *
   * والتنبيهُ غيرُ التسجيل، وقد خُلطا فأضرّ الخلطُ: جُعل الصفُّ لا
   * يُنشأ إلا لمشروعٍ يُنبَّه عليه، فاختفت لوحةُ تسجيل الوثيقة من
   * المشاريع التي ليس علينا فيها شيء — ومن أراد أن يحفظ وثيقةً مُنع.
   *
   * ووقع ذلك في مشروع بدر الأسد: عقدُه ينصّ على أن **الشركة** تتحمّل
   * التأمين على سلامة العمال، فهي أوجبُ ما يُسجَّل — وليس فيه عقدُ
   * منفّذٍ غيرُ محدَّد، فلم يكن له صفٌّ ولا لوحة.
   *
   * فصار لكل مشروعٍ نشطٍ صفُّه — تُعرض به اللوحة — ويُقيَّد التنبيه
   * بهذا الحقل وحده.
   */
  alert: boolean;
};

/**
 * العقود التي لا تُلقي وثيقة التأمين على منفّذها.
 *
 * قاعدة الشركة: لا تُؤمّن على مشروعٍ إلا إن كان التنفيذ بعمّالها.
 * والتنفيذ كلُّه بمقاولين، فالوثيقة على المنفّذ — بشرط أن ينصّ عقدُه.
 *
 * فمن نصَّ عقدُه فليس علينا منه شيء، ومن أُعفي بقرارٍ فكذلك — والقرار
 * مكتوبٌ سببُه. ومن لم يُحدَّد فيه شيء فالوثيقةُ علينا في موقعه.
 *
 * وعقدُ العميل لا يدخل: ذاك من يدفع لنا لا من ينفّذ.
 */
export function uninsuredContracts(contractors: Contractor[]): Contractor[] {
  return contractors.filter(
    (c) =>
      c.counterpartyType !== "عميل" &&
      /*
        حالان معروفان لا غير. وما سواهما — فراغٌ أو قيمةٌ لا يعرفها
        النظام — يُعدّ غيرَ محدَّد: فلا تُحسب تغطيةً قيمةٌ لم تُقصد.
      */
      c.insuranceDuty !== "المقاول" &&
      c.insuranceDuty !== "لا تلزم"
  );
}

/** أسماء المشاريع التي فيها عقدٌ غيرُ مغطّى */
const projectsNeedingPolicy = (contractors: Contractor[]): Set<string> =>
  new Set(
    uninsuredContracts(contractors)
      .map((c) => (c.project ?? "").trim())
      .filter(Boolean)
  );

export function projectInsurance(
  projects: Project[],
  today: string,
  contractors: Contractor[] = []
): InsuranceRow[] {
  /*
    لا يُنبَّه على مشروعٍ كلُّ عقوده تُلقي الوثيقة على منفّذها — ولا على
    مشروعٍ لا عقدَ منفّذٍ له أصلاً، فلا شيء يُحكم به.

    وكان يُنبَّه على كل مشروعٍ نشطٍ بلا وثيقة، فظهرت سبعةُ مشاريع
    «غير مسجّلة» وليس على الشركة فيها شيء — والتنبيه الذي لا يُعمل به
    يُعلّم قارئه أن يتخطّى التنبيهات كلَّها.
  */
  const needs = projectsNeedingPolicy(contractors);
  const rows: InsuranceRow[] = [];
  for (const project of projects) {
    if (project.status && project.status !== "نشط") continue;
    /* «عام» و«مصروفات مشتركة» وعاءان محاسبيان لا موقعَ لهما */
    if (isNonProject(project.name)) continue;

    const end = project.insuranceEnd ?? "";
    /*
      مَن له وثيقةٌ يُنبَّه على انقضائها كائناً ما كان عقدُه — فالمال
      أُنفق فيها، وانقضاؤها بلا علمٍ هو الذي بُني التنبيه له. ومن لا
      وثيقة له لا يُنبَّه إلا إن كان في موقعه عقدٌ غيرُ محدَّد.
    */
    const owed = needs.has(project.name.trim());

    if (!end) {
      rows.push({ project, state: "غير مسجّل", daysLeft: 0, alert: owed });
      continue;
    }
    const daysLeft = daysBetween(today, end);
    rows.push({
      project,
      state:
        daysLeft < 0
          ? "منتهٍ"
          : daysLeft <= INSURANCE_ALERT_DAYS
            ? "يقترب"
            : "سارٍ",
      daysLeft,
      alert: true,
    });
  }
  return rows.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** كم يوماً بقي على انتهاء وثيقة — سالب يعني منتهية */
const daysLeft = (date: string, today: string): number =>
  Math.round(
    (new Date(date + "T00:00:00Z").getTime() -
      new Date(today + "T00:00:00Z").getTime()) /
      86_400_000
  );

/**
 * وثائق العمالة: الإقامة وإذن العمل.
 *
 * وانتهاؤها ليس تأخيراً إدارياً: الإقامة المنتهية غرامةٌ يومية، والعمل
 * بإذنٍ منتهٍ مسؤوليةٌ على الشركة. ولا يُنبَّه إليها في شاشة الموظفين
 * وحدها — من لا يفتحها لا يعلم — بل تُعرض على من يدخل النظام.
 *
 * والكويتي لا إقامة له ولا إذن عمل، فلا يُسأل عنهما.
 */
export const DOCUMENT_ALERT_DAYS = 60;

export type DocumentRow = {
  employee: Employee;
  label: string;
  date: string;
  days: number;
};

export function staffDocuments(
  employees: Employee[],
  today: string
): { expired: DocumentRow[]; soon: DocumentRow[]; missing: DocumentRow[] } {
  const expired: DocumentRow[] = [];
  const soon: DocumentRow[] = [];
  const missing: DocumentRow[] = [];

  for (const employee of employees) {
    if (employee.active === false) continue;
    if (employee.isKuwaiti) continue;

    for (const [label, date] of [
      ["الإقامة", employee.residencyExpiry],
      ["إذن العمل", employee.workPermitExpiry],
    ] as const) {
      const value = (date ?? "").trim();
      if (!value) {
        missing.push({ employee, label, date: "", days: 0 });
        continue;
      }
      const days = daysLeft(value, today);
      if (days < 0) expired.push({ employee, label, date: value, days });
      else if (days <= DOCUMENT_ALERT_DAYS) {
        soon.push({ employee, label, date: value, days });
      }
    }
  }

  const byDays = (a: DocumentRow, b: DocumentRow) => a.days - b.days;
  return {
    expired: expired.sort(byDays),
    soon: soon.sort(byDays),
    missing,
  };
}

/**
 * طلبُ عملٍ موجَّهٌ إليه — وهو أوّلُ ما يجب أن يراه.
 *
 * فالتنبيهاتُ كلُّها مشتقّةٌ من الدفاتر: تقول له «ثَمَّ حركةٌ تنتظر».
 * وهذا وحده نداءٌ باسمه من إنسان. فيُقدَّم عليها جميعاً في الترتيب،
 * ولا يُنتظر به دخولُه شاشةَ الأعمال — فطلبٌ لا يراه صاحبُه كأنه لم
 * يُرسل، وذاك نقضُ البابِ كلِّه.
 */
function taskNotices(input: NoticeInput): Notice[] {
  const mine = (input.messages ?? []).filter(
    (m) => m.toName === input.userName && m.state !== "أُنجزت"
  );
  if (mine.length === 0) return [];

  const fresh = mine.filter((m) => m.state === "جديدة");
  const asker = [...new Set(mine.map((m) => m.fromName))].join(" و");

  return [
    {
      id: "my-tasks",
      tone: "warn",
      title:
        mine.length === 1
          ? `طلبُ عملٍ من ${asker}`
          : `${mine.length} طلباتِ عملٍ من ${asker}`,
      detail:
        (fresh.length > 0 && fresh.length !== mine.length
          ? `${fresh.length} منها لم تُقرأ بعد. `
          : "") + mine[0].body.slice(0, 120),
      page: "الأعمال",
      count: mine.length,
    },
  ];
}

/**
 * تنبيهاتُ المراحل: ما يقرب موعدُه، وما تأخّر، وما توقّف.
 *
 * وكانت التنبيهاتُ كلُّها على ما **وقع**. وهذه على ما **سيقع** — وبها
 * تُدرك المرحلةُ قبل أن تتعثّر.
 *
 * ويُجمع كلُّ بابٍ في تنبيهٍ واحدٍ لا تنبيهٍ لكلِّ مرحلة: فعشرون
 * تنبيهاً في شاشةٍ واحدةٍ تُقرأ كأنها لا شيء، ثم يُهمل معها الصادق.
 */
function milestoneNotices(input: NoticeInput): Notice[] {
  const rows = milestones(input.contractors, new Date(`${input.today}T00:00:00Z`));
  const sum = milestoneSummary(rows);
  const out: Notice[] = [];

  const name = (m: (typeof rows)[number]) =>
    `العقد ${m.contractNumber} د${m.number}${m.stage ? " · " + m.stage : ""}`;

  if (sum.late.length > 0) {
    out.push({
      id: "milestones-late",
      /* و«action» أشدُّ ما عندنا — فالمتأخّرُ يُعمَل فيه لا يُقرأ */
      tone: "action",
      title:
        sum.late.length === 1
          ? "مرحلةٌ تأخّرت عن موعدها المتوقَّع"
          : `${sum.late.length} مراحلَ تأخّرت عن مواعيدها`,
      detail:
        `أقدمُها ${name(sum.late[0])} — ${Math.abs(sum.late[0].days)} يوماً. ` +
        "ومن توقّف عملُه بعذرٍ فوسِّمه «موقوفاً» بسببه، فلا يُعدّ متأخّراً.",
      page: "متابعة المراحل",
      count: sum.late.length,
    });
  }

  if (sum.soon.length > 0) {
    out.push({
      id: "milestones-soon",
      tone: "warn",
      title:
        sum.soon.length === 1
          ? "مرحلةٌ يقرب موعدُها"
          : `${sum.soon.length} مراحلَ تقرب مواعيدُها`,
      detail:
        `أقربُها ${name(sum.soon[0])} — ` +
        (sum.soon[0].days === 0 ? "اليوم" : `بعد ${sum.soon[0].days} يوماً`) +
        ". فيُعاينها المهندسُ ليعتمدها في موعدها.",
      page: "متابعة المراحل",
      count: sum.soon.length,
    });
  }

  if (sum.longStalled.length > 0) {
    out.push({
      id: "milestones-stalled",
      tone: "warn",
      title:
        sum.longStalled.length === 1
          ? "عملٌ موقوفٌ منذ أسبوعين فأكثر"
          : `${sum.longStalled.length} أعمالٍ موقوفةٌ منذ أسبوعين فأكثر`,
      detail:
        `أطولُها ${name(sum.longStalled[0])} — ${sum.longStalled[0].stalledDays} يوماً` +
        (sum.longStalled[0].stalledReason
          ? `: ${sum.longStalled[0].stalledReason}`
          : " بلا سببٍ مكتوب") +
        ". ويُسأل عنه.",
      page: "متابعة المراحل",
      count: sum.longStalled.length,
    });
  }

  return out;
}

export function buildNotices(input: NoticeInput): Notice[] {
  const notices: Notice[] = [];

  /* ونداءُ إنسانٍ باسمه يُقدَّم على كلّ ما اشتُقّ من الدفاتر */
  notices.push(...taskNotices(input));
  /* وما سيقع قبل أن يقع — فالإدراكُ قبل التعثّر */
  notices.push(...milestoneNotices(input));

  /* ---- ما ينتظر قراراً ---- */

  const pending = input.movements.filter(
    (m) => m.approval === "بانتظار الاعتماد"
  );
  if (pending.length > 0) {
    const total = round3(pending.reduce((s, m) => s + m.amount, 0));
    notices.push({
      id: "pending-movements",
      tone: "action",
      title: `${pending.length} حركة بانتظار اعتمادك`,
      detail: `بمجموع ${fmt3(total)} د.ك — خارج الدفاتر حتى تُعتمد.`,
      page: "اعتماد الحركات",
      count: pending.length,
      needs: "movements.approve",
    });
  }

  const toConfirm = awaitingConfirmation(input.contractors);
  if (toConfirm.length > 0) {
    const total = round3(
      toConfirm.reduce((s, r) => s + (Number(r.installment.value) || 0), 0)
    );
    notices.push({
      id: "pending-confirmations",
      tone: "action",
      title: `${toConfirm.length} مرحلة اعتمدها المهندس وتنتظر إقرارك`,
      detail: `بمجموع ${fmt3(total)} د.ك — لا تصير الدفعة مستحقة قبل إقرارك.`,
      page: "اعتماد المراحل",
      focus: "تنتظر إقرارك",
      count: toConfirm.length,
      needs: "contracts.confirm",
    });
  }

  const unpaid = dueUnpaid(input.contractors, input.movements);
  if (unpaid.length > 0) {
    const total = round3(unpaid.reduce((s, r) => s + r.value, 0));
    notices.push({
      id: "due-unpaid",
      tone: "warn",
      title: `${unpaid.length} دفعة مستحقة لم تُصرف`,
      detail: `بمجموع ${fmt3(total)} د.ك — أُقرّت ولم يُصرف منها شيء بعد.`,
      page: "اعتماد المراحل",
      focus: "مستحقة لم تُصرف",
      count: unpaid.length,
      needs: "contractors.view",
    });
  }

  /* ---- ما يحتاج مراجعة ---- */

  const stale = input.workItems.filter(
    (w) => w.active && w.cost > 0 && isCostStale(w)
  );
  if (stale.length > 0) {
    notices.push({
      id: "stale-costs",
      tone: "warn",
      title: `${stale.length} بنداً تكلفته قديمة`,
      detail:
        "أسعار السوق تتحرك أسبوعياً، وعرضٌ مبنيّ على تكلفة قديمة يخسر وهو يبدو رابحاً.",
      page: "بنود الأعمال",
      count: stale.length,
      needs: "quotations.cost",
    });
  }

  const staleQuotes = input.quotations.filter(
    (q) => q.status === "مسودة" && quotationAgeDays(q) >= 7
  );
  if (staleQuotes.length > 0) {
    notices.push({
      id: "stale-quotations",
      tone: "info",
      title: `${staleQuotes.length} عرض سعر راكد`,
      detail: "مسودات لم تُمسّ منذ أسبوع — قدّمها للعميل أو علّمها مرفوضة.",
      page: "عروض الأسعار",
      count: staleQuotes.length,
      needs: "quotations.view",
    });
  }

  /* ---- المدد والانتهاءات ---- */

  const durations = allDurations(input.contractors, input.today);

  const ended = durations.filter((d) => d.status === "انتهت");
  if (ended.length > 0) {
    const onUs = round3(
      ended.filter((d) => d.penaltyAgainst === "الشركة").reduce((s, d) => s + d.penalty, 0)
    );
    const worst = ended[0];
    notices.push({
      id: "ended-durations",
      tone: "warn",
      title: `${ended.length} عقداً مضت مدته المنصوص عليها`,
      detail:
        `أطولها ${worst.contract.contractNumber} — ${worst.contract.name} بـ ${worst.lateDays} يوماً.` +
        (onUs > 0
          ? ` وتقدير الشرط الجزائي على الشركة ${fmt3(onUs)} د.ك.`
          : "") +
        " والحساب تقويمي والعقود بأيام عمل، فهي قائمة تُراجَع لا حكم.",
      page: "المقاولون",
      count: ended.length,
      needs: "contractors.view",
    });
  }

  const soon = durations.filter((d) => d.status === "تقترب");
  if (soon.length > 0) {
    notices.push({
      id: "ending-durations",
      tone: "info",
      title: `${soon.length} عقداً تقترب مدته من الانتهاء`,
      detail: soon
        .map((d) => `${d.contract.contractNumber} بعد ${d.daysLeft} يوماً`)
        .join(" · "),
      page: "المقاولون",
      count: soon.length,
      needs: "contractors.view",
    });
  }

  /* ---- تأمين المواقع ---- */

  const insurance = projectInsurance(
    input.projects,
    input.today,
    input.contractors
  );

  const lapsed = insurance.filter((r) => r.alert && r.state === "منتهٍ");
  if (lapsed.length > 0) {
    notices.push({
      id: "insurance-expired",
      tone: "action",
      title: `${lapsed.length} موقعاً تأمينه منتهٍ`,
      detail:
        lapsed
          .map((r) => `${r.project.name} منذ ${Math.abs(r.daysLeft)} يوماً`)
          .join(" · ") +
        " — والعمل قائم، فالمسؤولية على الشركة حتى يُجدَّد.",
      page: "المشاريع",
      count: lapsed.length,
      needs: "projects.view",
    });
  }

  const expiring = insurance.filter((r) => r.alert && r.state === "يقترب");
  if (expiring.length > 0) {
    notices.push({
      id: "insurance-expiring",
      tone: "warn",
      title: `${expiring.length} موقعاً يقترب انتهاء تأمينه`,
      detail: expiring
        .map((r) => `${r.project.name} بعد ${r.daysLeft} يوماً (${r.project.insuranceEnd})`)
        .join(" · "),
      page: "المشاريع",
      count: expiring.length,
      needs: "projects.view",
    });
  }

  const uninsured = insurance.filter((r) => r.alert && r.state === "غير مسجّل");
  if (uninsured.length > 0) {
    notices.push({
      id: "insurance-missing",
      tone: "info",
      title: `${uninsured.length} مشروعاً بلا وثيقة تأمين مسجّلة`,
      detail:
        uninsured.map((r) => r.project.name).join(" · ") +
        " — وفيها عقدٌ لا يُلقي الوثيقة على منفّذه، فهي على الشركة.",
      page: "المشاريع",
      count: uninsured.length,
      needs: "projects.manage",
    });
  }

  /*
    العقود التي لا تنصّ: تُعرض بأسمائها لا بعددها، فالعلاج فيها أمران —
    إمّا أن يُضاف إلى العقد نصٌّ يُلقي الوثيقة على منفّذه، وإمّا أن
    تُشترى وثيقةٌ للموقع. وكلاهما قرارٌ يُتّخذ بعينه.
  */
  const unclear = uninsuredContracts(input.contractors);
  if (unclear.length > 0) {
    notices.push({
      id: "contracts-no-insurance-clause",
      tone: "warn",
      title: `${unclear.length} عقداً لا ينصّ على تأمين منفّذه`,
      detail:
        unclear
          .slice(0, 6)
          .map((c) => `${c.contractNumber} — ${c.name}`)
          .join(" · ") +
        (unclear.length > 6 ? ` · وغيرها` : "") +
        " — فالوثيقة على الشركة في مواقعها حتى يُنصّ عليها في العقد.",
      page: "المقاولون",
      count: unclear.length,
      needs: "contractors.view",
    });
  }

  /* ---- فتراتُ التجربة ---- */

  /*
    والتجربةُ لها موعدٌ يفوت: من مضت مئةُ يومِ عملٍ ولم يُقرَّر فيه
    ثُبّت بحكم الواقع، فإنهاؤه بعدها فصلٌ لا إنهاءُ تجربة ويختلف ما
    يستحقّه. فالسكوتُ عنه يُسقط حقَّ القرار، ولا يُدرى أنّه سقط.
  */
  const probations = underProbation(
    input.employees,
    input.attendance,
    input.today
  );
  const over = probations.filter((p) => p.overdue);
  const near = probations.filter((p) => !p.overdue && p.remaining <= PROBATION_SOON);

  const named = (rows: OpenProbation[]) =>
    rows
      .map((p) =>
        p.hasAttendance
          ? `${p.name} (${p.worked} يومَ عمل)`
          : `${p.name} (لا دوامَ مسجَّل)`
      )
      .join(" · ");

  if (over.length > 0) {
    notices.push({
      id: "probation-over",
      tone: "action",
      title:
        over.length === 1
          ? "فترةُ تجربةٍ مضت ولم يُقرَّر فيها"
          : `${over.length} فتراتِ تجربةٍ مضت ولم يُقرَّر فيها`,
      detail:
        named(over) +
        " — ومن مضت تجربتُه ثُبّت بحكم الواقع، فإنهاؤه بعدها فصلٌ لا" +
        " إنهاءُ تجربة. فثبِّته أو راجع ما يستحقّه قبل الإنهاء.",
      page: "الموظفون",
      count: over.length,
      needs: "employees.manage",
    });
  }

  if (near.length > 0) {
    notices.push({
      id: "probation-soon",
      tone: "warn",
      title:
        near.length === 1
          ? "فترةُ تجربةٍ تقترب من نهايتها"
          : `${near.length} فتراتِ تجربةٍ تقترب من نهايتها`,
      detail:
        named(near) +
        ` — والحدُّ ${PROBATION_DAYS} يومَ عملٍ (قانون العمل ٦/٢٠١٠ م٣٠).` +
        " فالقرارُ تثبيتٌ أو إنهاء، ويحتاج مهلةً.",
      page: "الموظفون",
      count: near.length,
      needs: "employees.manage",
    });
  }

  /* ---- وثائق العمالة ---- */

  const documents = staffDocuments(input.employees, input.today);

  if (documents.expired.length > 0) {
    notices.push({
      id: "documents-expired",
      tone: "action",
      title: `${documents.expired.length} وثيقة عاملٍ منتهية`,
      detail:
        documents.expired
          .map(
            (r) =>
              `${r.employee.name}: ${r.label} منذ ${Math.abs(r.days)} يوماً`
          )
          .join(" · ") + " — والغرامة تُحسب باليوم.",
      page: "الموظفون",
      count: documents.expired.length,
      needs: "employees.view",
    });
  }

  if (documents.soon.length > 0) {
    notices.push({
      id: "documents-expiring",
      tone: "warn",
      title: `${documents.soon.length} وثيقة عاملٍ تنتهي قريباً`,
      detail: documents.soon
        .map((r) => `${r.employee.name}: ${r.label} بعد ${r.days} يوماً (${r.date})`)
        .join(" · "),
      page: "الموظفون",
      count: documents.soon.length,
      needs: "employees.view",
    });
  }

  if (documents.missing.length > 0) {
    notices.push({
      id: "documents-missing",
      tone: "info",
      title: `${documents.missing.length} وثيقة غير مسجَّلة في ملفّات العمالة`,
      detail:
        [
          ...new Set(
            documents.missing.map((r) => `${r.employee.name} (${r.label})`)
          ),
        ].join(" · ") + " — سجّل تاريخ انتهائها ليُنبَّه إليها قبل انقضائها.",
      page: "الموظفون",
      count: documents.missing.length,
      needs: "employees.manage",
    });
  }

  /* ---- سلامة البيانات ---- */

  const sinceBackup = input.backup ? daysSince(input.backup.at) : -1;
  const newSinceBackup = input.backup
    ? input.movements.length - input.backup.movementCount
    : input.movements.length;

  if (sinceBackup < 0) {
    notices.push({
      id: "no-backup",
      tone: "warn",
      title: "لا توجد نسخة احتياطية",
      detail: "بيانات الشركة كلها في متصفح هذا الجهاز — خذ نسخة الآن.",
      page: "الإعدادات",
      needs: "backup.run",
    });
  } else if (sinceBackup >= input.backupEveryDays) {
    notices.push({
      id: "old-backup",
      tone: "warn",
      title: `مضى ${sinceBackup} يوماً على آخر نسخة احتياطية`,
      detail:
        newSinceBackup > 0
          ? `سياسة المجلس كل ${input.backupEveryDays} أيام، و${newSinceBackup} حركة أُدخلت بعدها.`
          : `سياسة المجلس كل ${input.backupEveryDays} أيام.`,
      page: "الإعدادات",
      needs: "backup.run",
    });
  }

  return notices;
}

/**
 * ما جرى منذ آخر دخول للمستخدم — أفعال غيره وحدها.
 *
 * لا معنى لتنبيه المرء إلى ما فعله بنفسه، ولا إلى الدخول والخروج.
 */
export function activitySince(
  audit: AuditEntry[],
  lastSeenAt: string,
  userName: string,
  limit = 12
): AuditEntry[] {
  if (!lastSeenAt) return [];
  return audit
    .filter(
      (e) =>
        e.at > lastSeenAt &&
        e.user !== userName &&
        e.entity !== "جلسة"
    )
    .slice(0, limit);
}
