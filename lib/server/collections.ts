/**
 * أعمدة الجداول: أين تُكتب كل مجموعة، وبأي أعمدة.
 *
 * وهُويّة المجموعات — أيّها صفوف وبأي مفتاح تُعرف — في lib/collections.ts
 * يعرفها الطرفان. وهنا ما لا يعني إلا الخادم: اسم الجدول وأعمدته.
 *
 * والأعمدة نسخةٌ من الكائن لا مصدرٌ له: الصفّ كلّه محفوظ في data،
 * وهذه الأعمدة للاستعلام والفهرسة والقيود. فلا يلزم أن تغطّي كل
 * حقل — يلزم أن تغطّي ما يُستعلم عنه.
 */

import {
  COUNTERPARTY_TYPES,
  ROW_COLLECTIONS,
  WHOLE_FIELDS,
  type RowCollection,
} from "../collections";
import { uuidFor } from "../ids";

export { COUNTERPARTY_TYPES, WHOLE_FIELDS };

type Row = Record<string, unknown>;

export type Collection = RowCollection & {
  table: string;
  /** الأعمدة المشتقّة من الكائن، عدا id و data و rev */
  columns: (o: Row) => Row;
  /**
   * أعمدةٌ يملكها الخادم ولا يكتبها المتصفّح.
   *
   * كلمة المرور منها. فالمتصفّح يحمل نسخةً من المستخدم فيها التجزئة
   * كما كانت يوم استُنسخت، ولو أرسلها لكتبها فوق ما غيّره صاحبها على
   * الخادم — فيعود الرقم القديم يفتح وصاحبه يحسبه أُغلق.
   *
   * فتُكتب عند الإنشاء وحده، ثم لا تُمَسّ. وتُعاد إلى data من الصفّ
   * القائم، فلا يختلف العمود عن الكائن.
   */
  guarded?: { column: string; key: string }[];
};

const str = (v: unknown): string => (v == null ? "" : String(v));
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const int = (v: unknown): number => Math.trunc(num(v));
/** التاريخ الفارغ NULL لا نصّاً فارغاً — القاعدة ترفض '' كتاريخ */
const day = (v: unknown): string | null =>
  /^\d{4}-\d{2}-\d{2}/.test(str(v)) ? str(v).slice(0, 10) : null;
const when = (v: unknown): string | null => (str(v) ? str(v) : null);

/** الجدول والأعمدة لكل مجموعة — والمفتاح يأتي من التعريف المشترك */
const TABLES: Record<
  string,
  { table: string; columns: (o: Row) => Row; guarded?: Collection["guarded"] }
> = {
  movements: {
    table: "movements",
    columns: (m) => ({
      entry_no: int(m.entryNo),
      fiscal_year: int(m.fiscalYear),
      entry_date: day(m.date),
      movement_type: str(m.movementType),
      description: str(m.description),
      item_code: str(m.itemCode),
      item_name: str(m.itemName),
      debit_code: str(m.debitCode),
      credit_code: str(m.creditCode),
      amount: num(m.amount),
      project: str(m.project),
      person: str(m.person),
      payment_method: str(m.paymentMethod),
      party: str(m.party),
      contract_number: str(m.contractNumber),
      installment_number: m.installmentNumber ? int(m.installmentNumber) : null,
      source: str(m.source) || "app",
      approval: str(m.approval) || "معتمدة",
      approved_by: str(m.approvedBy),
      approved_at: when(m.approvedAt),
      approval_note: str(m.approvalNote),
    }),
  },
  projects: {
    table: "projects",
    columns: (p) => ({
      name: str(p.name),
      budget: num(p.budget),
      start_date: day(p.startDate),
      status: str(p.status) || "نشط",
    }),
  },
  contractors: {
    table: "contracts",
    columns: (c) => ({
      contract_number: str(c.contractNumber),
      counterparty_type: COUNTERPARTY_TYPES.includes(str(c.counterpartyType))
        ? str(c.counterpartyType)
        : "مقاول",
      document_type: str(c.documentType) || "عقد",
      parent_contract_number: str(c.parentContractNumber),
      name: str(c.name),
      specialty: str(c.specialty),
      phone: str(c.phone),
      project: str(c.project),
      contract_type: str(c.contractType),
      work_type: str(c.workType),
      contract_value: num(c.contractValue),
      contract_date: day(c.contractDate),
      civil_id: str(c.civilId),
      passport_number: str(c.passportNumber),
      nationality: str(c.nationality),
      address: str(c.address),
      plot: str(c.plot),
      block: str(c.block),
      area: str(c.area),
      license_number: str(c.licenseNumber),
      building_description: str(c.buildingDescription),
      duration_days: int(c.durationDays),
      expected_end_date: day(c.expectedEndDate),
      delay_penalty_per_day: num(c.delayPenaltyPerDay),
      max_penalty_percent: num(c.maxPenaltyPercent),
      termination_after_days: int(c.terminationAfterDays),
      warranty_years: int(c.warrantyYears),
      preamble: str(c.preamble),
      notes: str(c.notes),
      clauses: JSON.stringify(c.clauses ?? []),
      obligations: JSON.stringify(c.obligations ?? []),
      installments: JSON.stringify(c.installments ?? []),
    }),
  },
  materials: {
    table: "materials",
    columns: (m) => ({
      name: str(m.name),
      indicative_price: m.unitPrice == null ? 0 : num(m.unitPrice),
    }),
  },
  materialReceipts: {
    table: "material_receipts",
    columns: (r) => ({
      receipt_date: day(r.date),
      project: str(r.project),
      material: str(r.material),
      quantity: num(r.quantity),
      unit_price: r.unitPrice == null ? null : num(r.unitPrice),
      received_by: str(r.receivedBy),
      notes: str(r.note),
    }),
  },
  users: {
    table: "users",
    guarded: [
      { column: "password_hash", key: "pinHash" },
      { column: "must_change_pin", key: "mustChangePin" },
    ],
    columns: (u) => ({
      name: str(u.name),
      job_title: str(u.jobTitle),
      role: str(u.role),
      permissions: Array.isArray(u.permissions) ? u.permissions.map(str) : [],
      password_hash: str(u.pinHash),
      must_change_pin: u.mustChangePin === true,
      active: u.active !== false,
      last_seen_at: when(u.lastSeenAt),
    }),
  },
  employees: {
    table: "employees",
    columns: (e) => ({ name: str(e.name), active: e.active !== false }),
  },
  attendance: {
    table: "attendance",
    columns: (a) => ({
      /* عمودٌ من نوع uuid يشير إلى موظف، ومعرّف التطبيق نصّ مثل emp-008 */
      employee_id: uuidFor(str(a.employeeId)),
      day: day(a.date),
      status: str(a.status),
      hours: num(a.hours),
      overtime: num(a.overtimeHours),
      note: str(a.note),
    }),
  },
  payrollRuns: {
    table: "payroll_runs",
    columns: (r) => ({
      month: str(r.month),
      fiscal_year: int(r.fiscalYear),
      status: str(r.status) || "مسودة",
      created_at: when(r.createdAt),
      created_by: str(r.createdBy),
      approved_at: when(r.approvedAt),
      approved_by: str(r.approvedBy),
      lines: JSON.stringify(r.lines ?? []),
      deductions: JSON.stringify(r.deductions ?? {}),
      note: str(r.note),
    }),
  },
  workItems: {
    table: "work_items",
    columns: (w) => ({
      stage: str(w.stage),
      section: str(w.section),
      name: str(w.name),
      detail: str(w.detail),
      description: str(w.description),
      unit: str(w.unit),
      quantity: num(w.quantity),
      cost: num(w.cost),
      material_cost: num(w.materialCost),
      cost_updated_at: when(w.costUpdatedAt),
      cost_updated_by: str(w.costUpdatedBy),
      price: num(w.price),
      material_price: num(w.materialPrice),
      essential: w.essential === true,
      active: w.active !== false,
      notes: str(w.notes),
    }),
  },
  quotations: {
    table: "quotations",
    columns: (q) => ({
      number: str(q.number),
      quote_date: day(q.date),
      status: str(q.status) || "مسودة",
      client_name: str(q.clientName),
      client_phone: str(q.clientPhone),
      client_civil_id: str(q.clientCivilId),
      client_address: str(q.clientAddress),
      area: str(q.area),
      block: str(q.block),
      plot: str(q.plot),
      license_number: str(q.licenseNumber),
      building_description: str(q.buildingDescription),
      built_area: num(q.builtArea),
      scope: str(q.scope),
      pricing_mode: str(q.pricingMode) || "مصنعية ومواد",
      margin_percent: num(q.marginPercent),
      duration_days: int(q.durationDays),
      validity_days: int(q.validityDays),
      notes: str(q.notes),
      contract_number: str(q.contractNumber),
      lines: JSON.stringify(q.lines ?? []),
      created_by: str(q.createdBy),
      created_at: when(q.createdAt),
      edited_at: when(q.updatedAt),
    }),
  },
  invoices: {
    table: "invoices",
    columns: (i) => ({
      number: str(i.number),
      invoice_date: day(i.date),
      client_name: str(i.clientName),
      client_civil_id: str(i.clientCivilId),
      client_phone: str(i.clientPhone),
      project_location: str(i.projectLocation),
      project: str(i.project),
      contract_title: str(i.contractTitle),
      installment_label: str(i.installmentLabel),
      contract_number: str(i.contractNumber),
      installment_number: i.installmentNumber ? int(i.installmentNumber) : null,
      payment_method: str(i.paymentMethod),
      lines: JSON.stringify(i.lines ?? []),
      notes: str(i.notes),
      created_by: str(i.createdBy),
      created_at: when(i.createdAt),
    }),
  },
  audit: {
    table: "audit_log",
    columns: (a) => ({
      at: when(a.at),
      actor: str(a.user),
      action: str(a.action),
      entity: str(a.entity),
      summary: str(a.summary),
      before_val: a.before == null ? null : str(a.before),
      after_val: a.after == null ? null : str(a.after),
    }),
  },
};

/** الوصف الكامل: هُويّةٌ مشتركة + جدولٌ وأعمدة */
export const COLLECTIONS: Collection[] = ROW_COLLECTIONS.map((c) => ({
  ...c,
  ...TABLES[c.field],
}));

export const collectionOf = (field: string): Collection | undefined =>
  COLLECTIONS.find((c) => c.field === field);
