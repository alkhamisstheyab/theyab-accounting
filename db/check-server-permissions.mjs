/**
 * يفحص الصلاحيات على الخادم — آخر أعمال المرحلة الخامسة.
 *
 *   node db/check-server-permissions.mjs
 *
 * ما دامت البيانات في المتصفّح كانت الصلاحيات إخفاءً للأزرار. وفتحُ
 * النظام للموظفين يجعلها حمايةً حقيقية أو لا شيء: من يفتح أدوات
 * المطوّر يرى ما وصل جهازه كلّه، ويرسل ما يشاء إن لم يُردّ.
 *
 * فيُفحص البابان معاً:
 *   • الكتابة — طلبٌ بلا صلاحيته يُرفض كلّه، لا بعضه.
 *   • القراءة — ما لا يقرؤه صاحبه لا يُرسل إليه أصلاً، لا في الحالة
 *     الأولى ولا فيما يصله بالسحب بعدها.
 *
 * والفحص على قاعدةٍ حقيقية — PGlite — وبصلاحيات الأدوار كما هي في
 * النظام، لا بصلاحيات مُصطنعة للفحص.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createJiti } from "jiti";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { PGlite } = await import("@electric-sql/pglite");
const { ROLES, ALL_PERMISSIONS } = await jiti.import("../lib/permissions.ts");
const { ROW_COLLECTIONS, WHOLE_FIELDS } = await jiti.import("../lib/collections.ts");
const { readState } = await jiti.import("../lib/server/state.ts");
const { applyChanges, changesSince } = await jiti.import("../lib/server/writes.ts");
const { canRead, readableState, readableChanges, refusalReason } =
  await jiti.import("../lib/server/permits.ts");

const of = (key) => ROLES.find((r) => r.key === key).permissions;
const owner = of("owner");
const secretary = of("secretary");
const engineer = of("engineer");

const db = new PGlite();
await db.exec(fs.readFileSync(path.join(HERE, "schema.sql"), "utf8"));

/* ------------------------------------------------------------------ */
/* بياناتٌ كالتي في العمل                                              */
/* ------------------------------------------------------------------ */

await applyChanges(
  db,
  {
    upserts: {
      movements: [
        {
          id: "mv-1",
          entryNo: 1801,
          fiscalYear: 2026,
          date: "2026-09-24",
          movementType: "مصروف",
          description: "راتب شهر سبتمبر",
          itemName: "رواتب",
          debitCode: "6110",
          creditCode: "1111",
          amount: 620,
          project: "",
          paymentMethod: "نقدي",
          source: "app",
          approval: "معتمدة",
        },
      ],
      employees: [
        {
          id: "emp-1",
          name: "موظف",
          active: true,
          basicSalary: 620,
          civilId: "290010100123",
        },
      ],
      attendance: [
        {
          id: "att-1",
          employeeId: "emp-1",
          date: "2026-09-01",
          status: "حاضر",
          hours: 8,
        },
      ],
      payrollRuns: [
        { id: "pr-1", month: "2026-09", fiscalYear: 2026, status: "مسودة", lines: [] },
      ],
      users: [
        {
          id: "usr-1",
          name: "المحاسب",
          jobTitle: "محاسب",
          role: "custom",
          permissions: ["movements.view"],
          pinHash: "a".repeat(64),
          mustChangePin: false,
          active: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          lastSeenAt: "",
        },
      ],
      audit: [
        {
          id: "aud-1",
          at: "2026-09-24T08:00:00.000Z",
          user: "ذياب",
          action: "إضافة",
          entity: "حركة",
          summary: "القيد 1801",
        },
      ],
      invoices: [{ id: "inv-1", number: "2026/1", client: "عميل", total: 500 }],
    },
    whole: {
      openingBalances: { 2026: { 1111: { debit: "1000", credit: "" } } },
      payrollSettings: { workDays: 26 },
    },
  },
  "ذياب"
);

const full = await readState(db);

/* ------------------------------------------------------------------ */
console.log("\nكل مجموعةٍ لها حكمٌ في القراءة — فلا تُنسى واحدة:\n");

const fields = [...ROW_COLLECTIONS.map((c) => c.field), ...WHOLE_FIELDS];
const uncovered = fields.filter((f) => !canRead(f, ALL_PERMISSIONS));
check(
  "لا مجموعة بلا قاعدة",
  uncovered.length === 0,
  uncovered.join("، ") || "الجميع مشمول"
);

/* ------------------------------------------------------------------ */
console.log("\nالسكرتيرة — اطّلاعٌ وطباعة:\n");

const forSecretary = readableState(full, secretary);
check("تصلها الحركات", forSecretary.movements.length === 1);
check("ولا يصلها ملفّ الموظفين", forSecretary.employees.length === 0);
check("ولا حضورهم", forSecretary.attendance.length === 0);
check("ولا مسيّر الرواتب", forSecretary.payrollRuns.length === 0);
check("ولا إعداداته", Object.keys(forSecretary.payrollSettings ?? {}).length === 0);
check("ولا سجل التدقيق", forSecretary.audit.length === 0);
check(
  "وتصلها الأرصدة الافتتاحية — لها صلاحيتها",
  Object.keys(forSecretary.openingBalances).length === 1
);

const wrote = refusalReason({ upserts: { movements: [{ id: "x" }] } }, secretary);
check("ولا تكتب حركة", wrote !== null, wrote ?? "");
check(
  "ولا تحذف حركة",
  refusalReason({ deletes: { movements: ["mv-1"] } }, secretary) !== null
);
check(
  "ولا تمسّ الموظفين",
  refusalReason({ upserts: { employees: [{ id: "e" }] } }, secretary) !== null
);

/* ------------------------------------------------------------------ */
console.log("\nالمهندس — مشاريعه وعقودها:\n");

const forEngineer = readableState(full, engineer);
check(
  "تصله الحركات كما كانت — بها يُعرف المدفوع على العقود",
  forEngineer.movements.length === 1
);
check("ولا يصله ملفّ الموظفين", forEngineer.employees.length === 0);
check("ولا سجل التدقيق", forEngineer.audit.length === 0);
check("ولا فواتير العملاء", forEngineer.invoices.length === 0);
check(
  "ولا الأرصدة الافتتاحية",
  Object.keys(forEngineer.openingBalances).length === 0
);
check(
  "ويكتب في المواد — عملُه",
  refusalReason({ upserts: { materialReceipts: [{ id: "r" }] } }, engineer) === null
);
check(
  "ولا يكتب حركة",
  refusalReason({ upserts: { movements: [{ id: "x" }] } }, engineer) !== null
);

/* ------------------------------------------------------------------ */
console.log("\nالمالك — كل شيء، إلا ما لا يخرج لأحد:\n");

const forOwner = readableState(full, owner);
check(
  "تصله الحركات والموظفون والسجل",
  forOwner.movements.length === 1 &&
    forOwner.employees.length === 1 &&
    forOwner.audit.length === 1
);
check(
  "ولا تخرج تجزئة كلمة المرور — ولو إليه",
  forOwner.users.every((u) => !u.pinHash),
  JSON.stringify(forOwner.users.map((u) => u.pinHash ?? ""))
);
const stored = (await db.query("SELECT password_hash FROM users")).rows[0];
check(
  "وهي في القاعدة لم تُمَسّ",
  String(stored.password_hash).length === 64,
  String(stored.password_hash).slice(0, 8)
);
check(
  "ولا يحذف من سجل التدقيق — الشاهد لا يُمحى",
  refusalReason({ deletes: { audit: ["aud-1"] } }, owner) !== null
);
check(
  "ويكتب ما شاء سواه",
  refusalReason(
    { upserts: { movements: [{ id: "x" }], employees: [{ id: "e" }] } },
    owner
  ) === null
);

/* ------------------------------------------------------------------ */
console.log("\nوما يصل بالسحب يُصفّى كما تُصفّى القراءة الأولى:\n");

const incoming = await changesSince(db, 0);
check(
  "عند المالك كل ما استجدّ",
  Boolean(readableChanges(incoming, owner).upserts.employees)
);

const pulled = readableChanges(incoming, secretary);
check("ولا يصل السكرتيرة موظفٌ من الباب الآخر", !pulled.upserts.employees);
check("ولا حضور", !pulled.upserts.attendance);
check("ولا سجل", !pulled.upserts.audit);
check("وتصلها الحركات", (pulled.upserts.movements ?? []).length === 1);
check(
  "ولا تخرج التجزئة بالسحب أيضاً",
  (pulled.upserts.users ?? []).every((u) => !u.pinHash)
);
check("والرقم يصلها كما هو — وإلا سألت عمّا وصلها", pulled.rev === incoming.rev);

const gone = {
  rev: 9,
  upserts: {},
  deletes: { employees: ["emp-1"], movements: ["mv-1"] },
};
const seen = readableChanges(gone, secretary);
check(
  "وحذفُ ما لا تراه لا يصلها — فلا تعرف بوجوده من زواله",
  !seen.deletes.employees && seen.deletes.movements.length === 1
);

/* ------------------------------------------------------------------ */
console.log("\nوالمجموعة المجهولة تُردّ لا تُقبل:\n");

check("لا تُقرأ", !canRead("secrets", owner));
check(
  "ولا تُكتب",
  refusalReason({ upserts: { secrets: [{ id: "x" }] } }, owner) !== null
);

await db.close();

console.log(
  bad === 0
    ? "\n✓ لا يكتب أحدٌ ما ليس له، ولا يصل جهازَه ما لا يقرؤه"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
