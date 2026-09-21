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
import { AuditEntry } from "./audit";
import { Permission } from "./permissions";
import { Quotation, WorkItem, isCostStale, quotationAgeDays } from "./quotations";
import {
  BackupMeta,
  daysSince,
} from "./file-backup";
import { Contractor, Installment, Project, isInstallmentDue } from "./storage";
import { allDurations, daysBetween } from "./contract-dates";

export type NoticeTone = "action" | "warn" | "info";

export type Notice = {
  id: string;
  tone: NoticeTone;
  title: string;
  detail: string;
  /** الشاشة التي يُعالَج فيها */
  page?: string;
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
  quotations: Quotation[];
  workItems: WorkItem[];
  audit: AuditEntry[];
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

/** دفعات مستحقة لم يُصرف منها شيء */
export function dueUnpaid(
  contractors: Contractor[],
  movements: Movement[]
): { contract: Contractor; installment: Installment; value: number }[] {
  const rows: { contract: Contractor; installment: Installment; value: number }[] =
    [];

  for (const contract of contractors) {
    if (contract.counterpartyType === "عميل") continue; // دفعات العميل واردة لا صادرة
    const paid = new Map<number, number>();
    for (const m of movements) {
      if (!isApproved(m)) continue;
      if (m.contractNumber !== contract.contractNumber) continue;
      const key = Number(m.installmentNumber) || 0;
      paid.set(key, round3((paid.get(key) ?? 0) + m.amount));
    }
    for (const installment of contract.installments) {
      if (!isInstallmentDue(installment)) continue;
      const value = round3(Number(installment.value) || 0);
      if (value <= 0) continue;
      if ((paid.get(installment.number) ?? 0) > 0) continue;
      rows.push({ contract, installment, value });
    }
  }
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
};

export function projectInsurance(
  projects: Project[],
  today: string
): InsuranceRow[] {
  const rows: InsuranceRow[] = [];
  for (const project of projects) {
    if (project.status && project.status !== "نشط") continue;
    /* «عام» و«مصروفات مشتركة» وعاءان محاسبيان لا موقعَ لهما */
    if (isNonProject(project.name)) continue;
    const end = project.insuranceEnd ?? "";
    if (!end) {
      rows.push({ project, state: "غير مسجّل", daysLeft: 0 });
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
    });
  }
  return rows.sort((a, b) => a.daysLeft - b.daysLeft);
}

export function buildNotices(input: NoticeInput): Notice[] {
  const notices: Notice[] = [];

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

  const insurance = projectInsurance(input.projects, input.today);

  const lapsed = insurance.filter((r) => r.state === "منتهٍ");
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

  const expiring = insurance.filter((r) => r.state === "يقترب");
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

  const uninsured = insurance.filter((r) => r.state === "غير مسجّل");
  if (uninsured.length > 0) {
    notices.push({
      id: "insurance-missing",
      tone: "info",
      title: `${uninsured.length} مشروعاً بلا وثيقة تأمين مسجّلة`,
      detail:
        uninsured.map((r) => r.project.name).join(" · ") +
        " — سجّل الوثيقة وتاريخ انتهائها ليُنبَّه إليها قبل انقضائها.",
      page: "المشاريع",
      count: uninsured.length,
      needs: "projects.manage",
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
