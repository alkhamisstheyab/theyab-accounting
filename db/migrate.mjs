/**
 * ينقل نسخة احتياطية من النظام الحالي إلى قاعدة PostgreSQL.
 *
 *   node db/migrate.mjs <ملف النسخة> [رابط القاعدة]
 *
 * بلا رابط يعمل على PostgreSQL مضمّنة داخل Node (PGlite) — فيُختبر
 * النقل كاملاً على الجهاز قبل وجود أي حساب سحابي، وبنفس SQL حرفياً.
 *
 * لا يكتب شيئاً في ملف النسخة، ويبدأ من قاعدة فارغة في كل مرة.
 */

import fs from "fs";
import { uuidFor } from "./ids.mjs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** أنواع الأطراف الثلاثة — والرابع غير موجود، فما خرج عنها مقاول */
const COUNTERPARTY_TYPES = ["عميل", "مقاول", "مورّد"];

const BACKUP = process.argv[2];

/** الرابط من سطر الأوامر، وإلا من .env.local — فلا يُكتب سرّ في أمر */
function urlFromEnvFile() {
  try {
    const raw = fs.readFileSync(".env.local", "utf8").replace(/^﻿/, "");
    const line = raw
      .split(/\r?\n/)
      .find((l) => l.trim().startsWith("DATABASE_URL="));
    return line ? line.trim().slice("DATABASE_URL=".length).replace(/^["']|["']$/g, "") : "";
  } catch {
    return "";
  }
}

const DB_URL =
  process.argv[3] === "--local" ? "" : process.argv[3] || urlFromEnvFile();

if (!BACKUP) {
  console.error("الاستعمال: node db/migrate.mjs <ملف النسخة> [رابط القاعدة]");
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* الاتصال                                                             */
/* ------------------------------------------------------------------ */

async function connect() {
  if (DB_URL) {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: DB_URL });
    await client.connect();
    return {
      kind: "postgres",
      query: (sql, params) => client.query(sql, params),
      // البيان المُعَدّ لا يقبل أوامر متعدّدة، فالمخطّط يمرّ من هنا
      exec: (sql) => client.query(sql),
      close: () => client.end(),
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  /*
    بلا مجلّد تبقى القاعدة في الذاكرة وتزول بانتهاء الأمر. والمجلّد
    يلزم لفحص دورة الحالة: تُنقل هنا ثم تُقرأ من عملية أخرى.
  */
  const dataDir = process.argv[5] || undefined;
  const db = dataDir ? new PGlite(dataDir) : await PGlite.create();
  return {
    kind: "pglite",
    query: (sql, params) => db.query(sql, params),
    exec: (sql) => db.exec(sql),
    close: () => db.close(),
  };
}

/* ------------------------------------------------------------------ */
/* أدوات                                                               */
/* ------------------------------------------------------------------ */

const str = (v) => (v == null ? "" : String(v));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
/** التاريخ الفارغ NULL لا سلسلة فارغة — القاعدة ترفض '' كتاريخ */
const date = (v) => (/^\d{4}-\d{2}-\d{2}/.test(str(v)) ? str(v).slice(0, 10) : null);
const stamp = (v) => (str(v) ? str(v) : null);

/** المعرّفات القديمة نصوص مثل «xl-00001»، والقاعدة تريد UUID */
/* uuidFor مشتركة مع فحص دورة الحالة — انظر db/ids.mjs */

/**
 * يملأ عمود data بكائن التطبيق كاملاً بعد إدراج الأعمدة المسمّاة.
 *
 * الأعمدة تخدم الاستعلام والفهرسة والقيود، وdata يحفظ ما لا عمود له
 * — فحقلٌ يُضاف إلى النوع في التطبيق ينتقل بلا تعديل مخطّط. وبغيره
 * يضيع الحقل صامتاً، ولا يُكتشف إلا بعد شهور.
 */
async function fillData(db, table, objects, key = 'id') {
  const rows = objects.filter((o) => o && o[key] != null);
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const values = [];
    const params = [];
    chunk.forEach((o, n) => {
      params.push(uuidFor(o[key]), JSON.stringify(o));
      values.push("($" + (n * 2 + 1) + "::uuid, $" + (n * 2 + 2) + "::jsonb)");
    });
    try { await db.query(
      `UPDATE ${table} AS t SET data = v.d::jsonb
         FROM (VALUES ${values.join(',')}) AS v(id, d)
        WHERE t.id = v.id::uuid`,
      params
    ); } catch (e) { throw new Error(table + ": " + e.message); }
  }
  return rows.length;
}
async function insertMany(db, table, columns, rows) {
  if (rows.length === 0) return 0;
  const CHUNK = 200;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const values = [];
    const params = [];
    slice.forEach((row, r) => {
      values.push(
        "(" + columns.map((_, c) => `$${r * columns.length + c + 1}`).join(",") + ")"
      );
      params.push(...row);
    });
    await db.query(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES ${values.join(",")}`,
      params
    );
    done += slice.length;
  }
  return done;
}

/* ------------------------------------------------------------------ */
/* النقل                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  const parsed = JSON.parse(fs.readFileSync(BACKUP, "utf8"));
  const d = parsed.data ?? parsed;

  const db = await connect();
  console.log(`القاعدة: ${db.kind === "pglite" ? "مضمّنة في Node (اختبار)" : DB_URL.replace(/:[^:@/]+@/, ":***@")}`);

  const schema = fs.readFileSync(path.join(HERE, "schema.sql"), "utf8");
  await db.exec(schema);
  console.log("أُنشئت الجداول ✓\n");

  const report = [];
  const add = (label, n) => report.push([label, n]);

  /* الشركة */
  const c = d.company ?? {};
  await db.query(
    `INSERT INTO company (id,name,name_en,logo,address,phone,email,cr_number,approval_threshold,backup_every_days)
     VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      str(c.name),
      str(c.nameEn),
      str(c.logo),
      str(c.address),
      str(c.phone),
      str(c.email),
      str(c.crNumber),
      num(c.approvalThreshold),
      Number(c.backupEveryDays) || 10,
    ]
  );
  add("الشركة", 1);

  /* المستخدمون */
  add(
    "المستخدمون",
    await insertMany(
      db,
      "users",
      ["id", "name", "job_title", "role", "permissions", "password_hash", "must_change_pin", "active", "last_seen_at", "created_at"],
      (d.users ?? []).map((u) => [
        uuidFor(u.id),
        str(u.name),
        str(u.jobTitle),
        str(u.role),
        Array.isArray(u.permissions) ? u.permissions.map(str) : [],
        str(u.pinHash),
        u.mustChangePin === true,
        u.active !== false,
        stamp(u.lastSeenAt),
        stamp(u.createdAt) ?? new Date().toISOString(),
      ])
    )
  );

  /* البيانات الأساسية */
  add(
    "دليل الحسابات",
    await insertMany(
      db,
      "accounts",
      ["code", "name", "parent", "type", "nature", "level", "statement", "active", "postable", "sort_order"],
      (d.chart ?? []).map((a, order) => [
        str(a.code),
        str(a.name),
        str(a.parent),
        str(a.type),
        str(a.nature),
        Number(a.level) || 3,
        str(a.statement),
        a.active !== false,
        a.postable !== false,
        order,
      ])
    )
  );

  add(
    "البنود",
    await insertMany(
      db,
      "items",
      ["code", "name", "account", "sort_order"],
      (d.items ?? []).map((i, order) => [str(i.code), str(i.name), str(i.account), order])
    )
  );

  add(
    "طرق الدفع",
    await insertMany(
      db,
      "payment_methods",
      ["label", "account", "sort_order"],
      (d.payments ?? []).map((p, order) => [str(p.label), str(p.account), order])
    )
  );

  add(
    "الأشخاص",
    await insertMany(
      db,
      "people",
      ["name", "sort_order"],
      [...new Set((d.people ?? []).map(str).filter(Boolean))].map((n, order) => [n, order])
    )
  );

  /* المشاريع */
  const seenProject = new Set();
  add(
    "المشاريع",
    await insertMany(
      db,
      "projects",
      ["id", "name", "budget", "start_date", "status"],
      (d.projects ?? [])
        .filter((p) => {
          const n = str(p.name);
          if (!n || seenProject.has(n)) return false;
          seenProject.add(n);
          return true;
        })
        .map((p) => [uuidFor(p.id), str(p.name), num(p.budget), date(p.startDate), str(p.status) || "نشط"])
    )
  );

  /* العقود */
  add(
    "العقود",
    await insertMany(
      db,
      "contracts",
      ["id", "contract_number", "counterparty_type", "document_type", "parent_contract_number", "name", "specialty", "phone", "project", "contract_type", "work_type", "contract_value", "contract_date", "civil_id", "passport_number", "nationality", "address", "plot", "block", "area", "license_number", "building_description", "duration_days", "expected_end_date", "delay_penalty_per_day", "max_penalty_percent", "termination_after_days", "warranty_years", "preamble", "notes", "clauses", "obligations", "installments"],
      (d.contractors ?? []).map((x) => [
        uuidFor(x.id),
        str(x.contractNumber),
        COUNTERPARTY_TYPES.includes(x.counterpartyType)
          ? x.counterpartyType
          : "مقاول",
        str(x.documentType) || "عقد",
        str(x.parentContractNumber),
        str(x.name),
        str(x.specialty),
        str(x.phone),
        str(x.project),
        str(x.contractType),
        str(x.workType),
        num(x.contractValue),
        date(x.contractDate),
        str(x.civilId),
        str(x.passportNumber),
        str(x.nationality),
        str(x.address),
        str(x.plot),
        str(x.block),
        str(x.area),
        str(x.licenseNumber),
        str(x.buildingDescription),
        Number(x.durationDays) || 0,
        date(x.expectedEndDate),
        num(x.delayPenaltyPerDay),
        num(x.maxPenaltyPercent),
        Number(x.terminationAfterDays) || 0,
        Number(x.warrantyYears) || 0,
        str(x.preamble),
        str(x.notes),
        JSON.stringify(x.clauses ?? []),
        JSON.stringify(x.obligations ?? []),
        JSON.stringify(x.installments ?? []),
      ])
    )
  );

  /* الحركات */
  add(
    "الحركات",
    await insertMany(
      db,
      "movements",
      ["id", "entry_no", "fiscal_year", "entry_date", "movement_type", "description", "item_code", "item_name", "debit_code", "credit_code", "amount", "project", "person", "payment_method", "party", "contract_number", "installment_number", "source", "approval", "approved_by", "approved_at", "approval_note"],
      (d.movements ?? []).map((m) => [
        uuidFor(m.id),
        Number(m.entryNo) || 0,
        Number(m.fiscalYear) || 0,
        date(m.date),
        str(m.movementType),
        str(m.description),
        str(m.itemCode),
        str(m.itemName),
        str(m.debitCode),
        str(m.creditCode),
        num(m.amount),
        str(m.project),
        str(m.person),
        str(m.paymentMethod),
        str(m.party),
        str(m.contractNumber),
        Number(m.installmentNumber) || null,
        m.source === "excel" ? "excel" : "app",
        ["بانتظار الاعتماد", "معتمدة", "مرفوضة"].includes(m.approval) ? m.approval : "معتمدة",
        str(m.approvedBy),
        stamp(m.approvedAt),
        str(m.approvalNote),
      ])
    )
  );

  /* الأرصدة الافتتاحية */
  const openingRows = [];
  for (const [year, accounts] of Object.entries(d.openingBalances ?? {})) {
    for (const [code, value] of Object.entries(accounts ?? {})) {
      openingRows.push([Number(year), str(code), num(value?.debit), num(value?.credit)]);
    }
  }
  add(
    "الأرصدة الافتتاحية",
    await insertMany(db, "opening_balances", ["fiscal_year", "account_code", "debit", "credit"], openingRows)
  );

  add(
    "إقفال السنوات",
    await insertMany(
      db,
      "year_locks",
      ["fiscal_year", "closed_at", "closed_by", "note"],
      Object.entries(d.yearLocks ?? {}).map(([year, lock]) => [
        Number(year),
        stamp(lock?.closedAt) ?? new Date().toISOString(),
        str(lock?.closedBy),
        str(lock?.note),
      ])
    )
  );

  /* المواد */
  add(
    "المواد",
    await insertMany(
      db,
      "materials",
      ["id", "name", "unit", "indicative_price", "notes"],
      (d.materials ?? []).map((m) => [uuidFor(m.id), str(m.name), str(m.unit), num(m.indicativePrice ?? m.price), str(m.notes)])
    )
  );

  add(
    "استلام المواد",
    await insertMany(
      db,
      "material_receipts",
      ["id", "receipt_date", "project", "material_id", "material", "quantity", "unit", "unit_price", "supplier", "received_by", "notes"],
      (d.materialReceipts ?? []).map((r) => [
        uuidFor(r.id),
        date(r.date),
        str(r.project),
        r.materialId ? uuidFor(r.materialId) : null,
        str(r.material ?? r.materialName),
        num(r.quantity),
        str(r.unit),
        r.unitPrice == null ? null : num(r.unitPrice),
        str(r.supplier),
        str(r.receivedBy),
        str(r.notes),
      ])
    )
  );

  /* الرواتب */
  add(
    "الموظفون",
    await insertMany(
      db,
      "employees",
      ["id", "name", "data", "active"],
      (d.employees ?? []).map((e) => [uuidFor(e.id), str(e.name), JSON.stringify(e), e.active !== false])
    )
  );

  const seenDay = new Set();
  add(
    "سجلات الحضور",
    await insertMany(
      db,
      "attendance",
      ["id", "employee_id", "day", "status", "hours", "overtime", "note"],
      (d.attendance ?? [])
        .filter((a) => {
          const key = `${a.employeeId}|${a.date}`;
          if (!a.employeeId || !date(a.date) || seenDay.has(key)) return false;
          seenDay.add(key);
          return true;
        })
        .map((a) => [uuidFor(a.employeeId + "|" + a.date), uuidFor(a.employeeId), date(a.date), str(a.status), num(a.hours), num(a.overtime), str(a.note)])
    )
  );

  add(
    "مسيّرات الرواتب",
    await insertMany(
      db,
      "payroll_runs",
      ["id", "month", "fiscal_year", "status", "created_at", "created_by", "approved_at", "approved_by", "posted_movement_ids", "lines", "deductions", "note"],
      (d.payrollRuns ?? []).map((r) => [
        uuidFor(r.id),
        str(r.month),
        Number(r.fiscalYear) || 0,
        str(r.status) || "مسودة",
        stamp(r.createdAt),
        str(r.createdBy),
        stamp(r.approvedAt),
        str(r.approvedBy),
        (r.postedMovementIds ?? []).map(uuidFor),
        JSON.stringify(r.lines ?? []),
        JSON.stringify(r.deductions ?? {}),
        str(r.note),
      ])
    )
  );

  await db.query(`INSERT INTO payroll_settings (id,data) VALUES (1,$1)`, [
    JSON.stringify(d.payrollSettings ?? {}),
  ]);
  add("إعدادات الرواتب", 1);

  /* عروض الأسعار */
  add(
    "بنود الأعمال",
    await insertMany(
      db,
      "work_items",
      ["id", "stage", "section", "name", "detail", "description", "unit", "quantity", "cost", "material_cost", "cost_updated_at", "cost_updated_by", "price", "material_price", "essential", "active", "notes"],
      (d.workItems ?? []).map((w) => [
        uuidFor(w.id),
        str(w.stage),
        str(w.section),
        str(w.name),
        str(w.detail),
        str(w.description),
        str(w.unit),
        num(w.quantity),
        num(w.cost),
        num(w.materialCost),
        stamp(w.costUpdatedAt),
        str(w.costUpdatedBy),
        num(w.price),
        num(w.materialPrice),
        w.essential === true,
        w.active !== false,
        str(w.notes),
      ])
    )
  );

  add(
    "عروض الأسعار",
    await insertMany(
      db,
      "quotations",
      ["id", "number", "quote_date", "status", "client_name", "client_phone", "client_civil_id", "client_address", "area", "block", "plot", "license_number", "building_description", "built_area", "scope", "pricing_mode", "margin_percent", "duration_days", "validity_days", "notes", "contract_number", "lines", "created_by", "created_at", "edited_at"],
      (d.quotations ?? []).map((q) => [
        uuidFor(q.id),
        str(q.number),
        date(q.date),
        str(q.status),
        str(q.clientName),
        str(q.clientPhone),
        str(q.clientCivilId),
        str(q.clientAddress),
        str(q.area),
        str(q.block),
        str(q.plot),
        str(q.licenseNumber),
        str(q.buildingDescription),
        num(q.builtArea),
        str(q.scope),
        str(q.pricingMode) || "مصنعية ومواد",
        num(q.marginPercent),
        Number(q.durationDays) || 0,
        Number(q.validityDays) || 0,
        str(q.notes),
        str(q.contractNumber),
        JSON.stringify(q.lines ?? []),
        str(q.createdBy),
        stamp(q.createdAt),
        stamp(q.updatedAt),
      ])
    )
  );

  add(
    "الفواتير",
    await insertMany(
      db,
      "invoices",
      ["id", "number", "invoice_date", "client_name", "client_civil_id", "client_phone", "project_location", "project", "contract_title", "installment_label", "contract_number", "installment_number", "payment_method", "lines", "notes", "created_by", "created_at"],
      (d.invoices ?? []).map((v) => [
        uuidFor(v.id),
        str(v.number),
        date(v.date),
        str(v.clientName),
        str(v.clientCivilId),
        str(v.clientPhone),
        str(v.projectLocation),
        str(v.project),
        str(v.contractTitle),
        str(v.installmentLabel),
        str(v.contractNumber),
        Number(v.installmentNumber) || null,
        str(v.paymentMethod),
        JSON.stringify(v.lines ?? []),
        str(v.notes),
        str(v.createdBy),
        stamp(v.createdAt),
      ])
    )
  );

  /* سجل التدقيق */
  add(
    "سجل التدقيق",
    await insertMany(
      db,
      "audit_log",
      ["id", "at", "actor", "action", "entity", "summary", "before_val", "after_val"],
      (d.audit ?? []).map((e) => [
        uuidFor(e.id),
        stamp(e.at) ?? new Date().toISOString(),
        str(e.user),
        str(e.action),
        str(e.entity),
        str(e.summary),
        e.before == null ? null : str(e.before),
        e.after == null ? null : str(e.after),
      ])
    )
  );

  /* ---------------- التقرير ---------------- */

  console.log("ما نُقل:");
  for (const [label, n] of report) {
    console.log(`  ${label.padEnd(22)} ${String(n).padStart(6)}`);
  }

  /* ---------------- التحقق ---------------- */


  /*
    كائن التطبيق كاملاً في data — الأعمدة المسمّاة فوقه للاستعلام.
    الحضور مفتاحه مركّب فيُملأ باستعلامه، والموظفون يُكتب كائنهم
    كاملاً أصلاً.
  */
  await fillData(db, "users", d.users ?? []);
  await fillData(db, "projects", d.projects ?? []);
  await fillData(db, "contracts", d.contractors ?? []);
  await fillData(db, "movements", d.movements ?? []);
  await fillData(db, "materials", d.materials ?? []);
  await fillData(db, "material_receipts", d.materialReceipts ?? []);
  await fillData(db, "work_items", d.workItems ?? []);
  await fillData(db, "quotations", d.quotations ?? []);
  await fillData(db, "invoices", d.invoices ?? []);
  await fillData(db, "payroll_runs", d.payrollRuns ?? []);
  await fillData(db, "audit_log", d.audit ?? []);
  for (const a of d.attendance ?? []) {
    if (!a?.employeeId || !date(a.date)) continue;
    await db.query(
      `UPDATE attendance SET data = $1::jsonb WHERE id = $2::uuid`,
      [JSON.stringify(a), uuidFor(a.employeeId + "|" + a.date)]
    );
  }
  console.log("\nالتحقق من سلامة النقل:");

  const source = d.movements ?? [];
  const { rows: counted } = await db.query("SELECT count(*)::int AS n FROM movements");
  const okCount = counted[0].n === source.length;
  console.log(
    `  عدد الحركات        ${counted[0].n} / ${source.length}  ${okCount ? "✓" : "✗"}`
  );

  const srcSum = source.reduce((s, m) => s + num(m.amount), 0);
  const { rows: summed } = await db.query(
    "SELECT coalesce(sum(amount),0)::text AS t FROM movements"
  );
  const dbSum = Number(summed[0].t);
  const okSum = Math.abs(dbSum - srcSum) < 0.0005;
  console.log(
    `  مجموع المبالغ      ${dbSum.toFixed(3)} / ${srcSum.toFixed(3)}  ${okSum ? "✓" : "✗"}`
  );

  // ميزان المراجعة من القاعدة: المعتمدة وحدها، كما في التطبيق
  const { rows: balance } = await db.query(`
    SELECT coalesce(sum(amount),0)::text AS debit FROM movements WHERE approval = 'معتمدة'
  `);
  const { rows: perYear } = await db.query(`
    SELECT fiscal_year, count(*)::int AS n, sum(amount)::text AS total
    FROM movements WHERE approval = 'معتمدة'
    GROUP BY fiscal_year ORDER BY fiscal_year
  `);
  console.log(`  المعتمدة           ${Number(balance[0].debit).toFixed(3)}`);
  for (const r of perYear) {
    console.log(
      `    سنة ${r.fiscal_year}        ${String(r.n).padStart(5)} حركة   ${Number(r.total).toFixed(3)}`
    );
  }

  // القيد المزدوج: مجموع المدين = مجموع الدائن بحكم البنية
  const { rows: unbalanced } = await db.query(`
    SELECT count(*)::int AS n FROM movements
    WHERE debit_code = '' OR credit_code = '' OR debit_code = credit_code
  `);
  console.log(
    `  قيود ناقصة الطرفين ${unbalanced[0].n}  ${unbalanced[0].n === 0 ? "✓" : "⚠ تحتاج مراجعة"}`
  );

  await db.close();

  const allOk = okCount && okSum;
  console.log(allOk ? "\n✓ النقل مطابق للمصدر" : "\n✗ هناك فرق — لا تعتمد هذه القاعدة");
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error("\nفشل النقل:", e.message);
  process.exit(1);
});
