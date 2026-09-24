/**
 * يفحص الكتابة صفّاً صفّاً على قاعدة حقيقية.
 *
 *   node db/check-writes.mjs <نسخة.json>
 *
 * ما يُفحص، وكلّه ممّا يقع في العمل اليومي لا ممّا يُتخيّل:
 *
 *  1. إضافة حركة: تُكتب ولا تمسّ غيرها.
 *  2. تعديل حركة: يُحدَّث صفّها وحده.
 *  3. حذف حركة: تزول، ويبقى لها شاهد فيعرف المتصفّح أنها زالت.
 *  4. كاتبان على صفّين مختلفين: لا يمحو أحدهما الآخر — وهذه هي
 *     المسألة التي من أجلها تُرِكت الكتابة الكاملة.
 *  5. «ما استجدّ بعد الرقم كذا» يُعيد ما كُتب بعده ولا شيء سواه.
 *  6. الحالة كلها تبقى سليمة بعد ذلك: تُقرأ فتطابق المتوقَّع.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createJiti } from "jiti";
import { uuidFor } from "./ids.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url);

const BACKUP = process.argv[2];
if (!BACKUP) {
  console.error("الاستعمال: node db/check-writes.mjs <نسخة.json>");
  process.exit(1);
}

const { readState } = await jiti.import("../lib/server/state.ts");
const { applyChanges, changesSince, currentRev } = await jiti.import(
  "../lib/server/writes.ts"
);

const dir = path.join(HERE, "..", ".roundtrip-writes");
fs.rmSync(dir, { recursive: true, force: true });

const { execFileSync } = await import("child_process");
console.log("ينقل النسخة إلى قاعدة محلية…");
execFileSync(
  process.execPath,
  [path.join(HERE, "migrate.mjs"), BACKUP, "--local", "--keep", dir],
  { stdio: ["ignore", "ignore", "inherit"] }
);

const { PGlite } = await import("@electric-sql/pglite");
const db = new PGlite(dir);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const before = await readState(db);
const startRev = await currentRev(db);
console.log(
  `\nالحالة الابتدائية: ${before.movements.length} حركة · رقم التغيير ${startRev}\n`
);

/* ---- 0. كل مجموعة تُكتب ---- */
/*
  الكتابة واحدة لكل الجداول الثلاثة عشر، فيكفي عمودٌ باسمٍ خاطئ في
  جدولٍ واحد ليسقط حفظُ شاشةٍ كاملة. فيُعاد هنا صفٌّ قائم من كل
  مجموعة كما هو: إن مرّت الكتابة فالأعمدة كلها على ما يُظَنّ.
*/
/*
  وما لا صفوف له في النسخة يُصطنع له صفّ ويُحذف بعده: الدوام والمواد
  ومسيّرات الرواتب ستمتلئ بعد شهر، ولا يُنتظر ذلك ليُعرف أتُكتب أم لا.
*/
const SAMPLE = {
  materials: { id: "aaaaaaa1-0000-4000-8000-000000000001", name: "مادة فحص", unitPrice: 1.5 },
  materialReceipts: {
    id: "aaaaaaa2-0000-4000-8000-000000000002",
    date: "2026-09-15",
    project: "عام",
    material: "مادة فحص",
    quantity: 2,
    unitPrice: 1.5,
    receivedBy: "فاحص",
    note: "",
  },
  attendance: {
    employeeId: "" /* يُملأ من أول موظف */,
    date: "2026-09-15",
    status: "حاضر",
    hours: 8,
    overtimeHours: 0,
    note: "",
  },
  payrollRuns: {
    id: "aaaaaaa3-0000-4000-8000-000000000003",
    month: "2026-09",
    fiscalYear: 2026,
    status: "مسودة",
    lines: [],
    deductions: {},
    note: "فحص",
  },
};
if (before.employees?.[0]) SAMPLE.attendance.employeeId = before.employees[0].id;
const { COLLECTIONS } = await jiti.import("../lib/server/collections.ts");
for (const c of COLLECTIONS) {
  const rows = before[c.field] ?? [];
  const made = rows.length === 0;
  const row = made ? SAMPLE[c.field] : rows[0];
  if (!row) {
    check(`${c.field} → ${c.table}`, false, "لا صفّ ولا مثال");
    continue;
  }
  const revBefore = await currentRev(db);
  let failed = "";
  try {
    await applyChanges(db, { upserts: { [c.field]: [row] } }, "فاحص");
  } catch (e) {
    failed = String(e?.message ?? e);
  }
  const { rows: n } = await db.query(
    `SELECT count(*)::int AS n, max(rev)::bigint AS r FROM ${c.table}`
  );
  const want = rows.length + (made ? 1 : 0);
  check(
    `${c.field} → ${c.table}`,
    !failed && n[0].n === want && Number(n[0].r) > revBefore,
    failed || `${n[0].n} / ${want} صفّاً${made ? " (صفّ مُصطنَع)" : ""}`
  );
  /* المُصطنَع يُحذف، فتبقى القاعدة كما وجدناها — والحذف نفسه يُفحص */
  if (made && !failed) {
    await applyChanges(db, { deletes: { [c.field]: [c.keyOf(row)] } }, "فاحص");
    const { rows: after } = await db.query(`SELECT count(*)::int AS n FROM ${c.table}`);
    check(`${c.field} — والحذف يزيله`, after[0].n === rows.length);
  }
}

/*
  والأعمدة المشتقّة تُفحص لا يُوثق بها.

  فالصفّ كلّه محفوظ في data، والأعمدة نسخةٌ منه للاستعلام والفهرسة —
  ونسخةٌ خاطئة لا يُشكى منها أحد: القراءة تعمل والتقارير تكذب. وقد وقع
  ذلك فعلاً: حرفٌ ضاع من تعبير التاريخ فصارت أعمدة التواريخ كلها فارغة،
  ولم يسقط شيء إلا حيث مُنع الفراغ.
*/
const DATED = [
  ["movements", "entry_date", "date"],
  ["contracts", "contract_date", "contractDate"],
  ["projects", "start_date", "startDate"],
  ["quotations", "quote_date", "date"],
  ["invoices", "invoice_date", "date"],
];
for (const [table, column, field] of DATED) {
  const collection = COLLECTIONS.find((c) => c.table === table);
  const rows = before[collection.field] ?? [];
  const withDate = rows.filter((r) => /^\d{4}-\d{2}-\d{2}/.test(String(r[field] ?? "")));
  if (withDate.length === 0) continue;
  const { rows: empty } = await db.query(
    `SELECT count(*)::int AS n FROM ${table} WHERE ${column} IS NULL`
  );
  check(
    `${table}.${column} ليس فارغاً`,
    empty[0].n === rows.length - withDate.length,
    `${empty[0].n} فارغاً من ${rows.length}`
  );
}

console.log("");
/* ---- 1. إضافة ---- */
const fresh = {
  id: "11111111-1111-4111-8111-111111111111",
  entryNo: 99001,
  fiscalYear: 2026,
  date: "2026-09-15",
  movementType: "مصروف",
  description: "حركة فحص — تُحذف بعد قليل",
  itemCode: "EXP004",
  itemName: "مواد إنشائية",
  debitCode: "5110",
  creditCode: "1111",
  amount: 12.345,
  project: "عام",
  person: "",
  paymentMethod: "نقدي",
  party: "",
  source: "فحص",
  approval: "بانتظار الاعتماد",
  approvedBy: "",
  approvedAt: "",
  approvalNote: "",
};

const added = await applyChanges(db, { upserts: { movements: [fresh] } }, "فاحص");
let state = await readState(db);
check(
  "إضافة حركة",
  state.movements.length === before.movements.length + 1,
  `${before.movements.length} ← ${state.movements.length}`
);
check("رقم التغيير تقدّم", added.rev > startRev, `${startRev} ← ${added.rev}`);

const stored = state.movements.find((m) => m.id === fresh.id);
check("المبلغ بثلاث خاناته", stored?.amount === 12.345, String(stored?.amount));
check("حالة الاعتماد كما أُرسلت", stored?.approval === "بانتظار الاعتماد");

/* ---- 2. تعديل ---- */
const afterAdd = await currentRev(db);
await applyChanges(
  db,
  { upserts: { movements: [{ ...fresh, approval: "معتمدة", approvedBy: "المدير العام" }] } },
  "المدير العام"
);
state = await readState(db);
const edited = state.movements.find((m) => m.id === fresh.id);
check(
  "تعديل الحركة لا يضيف صفّاً",
  state.movements.length === before.movements.length + 1
);
check("التعديل وصل", edited?.approval === "معتمدة" && edited?.approvedBy === "المدير العام");

const { rows: who } = await db.query(
  "SELECT updated_by FROM movements WHERE id = $1::uuid",
  [uuidFor(fresh.id)]
);
check("الصفّ يحمل من كتبه", who[0]?.updated_by === "المدير العام", who[0]?.updated_by);

/* ---- 3. كاتبان في وقتٍ واحد ---- */
/*
  هذه هي المسألة كلها. الاثنان فتحا النظام في اللحظة نفسها، فعند كلٍّ
  منهما صورةٌ من الحالة. ثم عدّل الأول حركةً وعدّل الثاني حركةً أخرى.

  ولو أرسل كلٌّ منهما حالته كاملةً لمحا الثاني عملَ الأول: صورته
  القديمة تحمل الحركة الأولى كما كانت قبل التعديل، فتعود كما كانت.
  أما هنا فلا يُرسَل إلا ما تغيّر، فلا يتصادمان.
*/
const snapshotA = await readState(db);  /* صورة الأول */
const snapshotB = await readState(db);  /* صورة الثاني، في اللحظة نفسها */

const rowA = snapshotA.movements.find((m) => m.id === fresh.id);
const rowB = snapshotB.movements.find((m) => m.id !== fresh.id);

/* الأول يعدّل حركته ويرسلها وحدها */
await applyChanges(
  db,
  { upserts: { movements: [{ ...rowA, description: "عدّلها الأول" }] } },
  "الأول"
);

/* والثاني يعدّل حركةً أخرى من صورته القديمة ويرسلها وحدها */
await applyChanges(
  db,
  { upserts: { movements: [{ ...rowB, description: "عدّلها الثاني" }] } },
  "الثاني"
);

state = await readState(db);
const afterA = state.movements.find((m) => m.id === rowA.id);
const afterB = state.movements.find((m) => m.id === rowB.id);
check(
  "عمل الأول لم يُمحَ بكتابة الثاني",
  afterA?.description === "عدّلها الأول",
  String(afterA?.description)
);
check("وعمل الثاني وصل", afterB?.description === "عدّلها الثاني");
check(
  "ولا صفّ ثالث ظهر",
  state.movements.length === before.movements.length + 1,
  String(state.movements.length)
);

/* والصورة القديمة عند الثاني ما زالت تحمل الحركة الأولى كما كانت — */
/* وهو ما كان سيُكتب فوق عمل الأول لو أُرسلت الحالة كاملةً.        */
check(
  "الفرق مثبت: صورة الثاني تحمل القديم",
  snapshotB.movements.find((m) => m.id === rowA.id)?.description !== "عدّلها الأول"
);
/* ---- 4. ما استجدّ ---- */
const since = await changesSince(db, afterAdd);
const changedIds = (since.upserts.movements ?? []).map((m) => m.id);
check(
  "«ما استجدّ» يعيد ما كُتب بعده ولا شيء سواه",
  changedIds.length === 2 &&
    changedIds.includes(rowA.id) &&
    changedIds.includes(rowB.id),
  `${changedIds.length} صفّاً`
);

/* ---- 5. حذف ---- */
await applyChanges(db, { deletes: { movements: [fresh.id] } }, "فاحص");
state = await readState(db);
check(
  "الحذف يزيل الصفّ",
  state.movements.length === before.movements.length,
  String(state.movements.length)
);

const afterDelete = await changesSince(db, afterAdd);
check(
  "وشاهد الحذف يصل المتصفّح",
  (afterDelete.deletes.movements ?? []).includes(uuidFor(fresh.id)),
  JSON.stringify(afterDelete.deletes.movements ?? [])
);

/* ---- 5.5 كلمة المرور يملكها الخادم ---- */
/*
  المتصفّح يحمل نسخةً من المستخدم فيها تجزئة كلمة المرور كما كانت يوم
  استُنسخت. فمن غيّر كلمته على الخادم ثم زامن جهازه، كانت نسخته القديمة
  تُكتب فوق الجديدة — فيعود ما قبلها يفتح وصاحبه يحسبه أُغلق.

  وهذا يُحاكى هنا حرفاً بحرف: صفّ مستخدمٍ يحمل تجزئةً قديمة يُرسَل إلى
  الخادم بعد أن غُيّرت كلمته فيه.
*/
{
  const person = before.users[0];
  const SERVER_HASH = "$2b$12$serverOwnedHashValueForTheCheckXXXXXXXXXXXXXXXXXXXXXX";

  await db.query(
    "UPDATE users SET password_hash = $2, must_change_pin = false WHERE id = $1::uuid",
    [uuidFor(person.id), SERVER_HASH]
  );

  /* المتصفّح يرسل الصفّ ومعه تجزئته القديمة وشيءٌ تغيّر فعلاً */
  await applyChanges(
    db,
    {
      upserts: {
        users: [
          {
            ...person,
            pinHash: "0".repeat(64),
            mustChangePin: true,
            jobTitle: (person.jobTitle ?? "") + " — عُدّل",
          },
        ],
      },
    },
    "المتصفّح"
  );

  const { rows: kept } = await db.query(
    "SELECT password_hash, must_change_pin, job_title, data->>'pinHash' AS in_data FROM users WHERE id = $1::uuid",
    [uuidFor(person.id)]
  );

  check(
    "كلمة المرور على الخادم لا يكتبها المتصفّح",
    kept[0]?.password_hash === SERVER_HASH,
    String(kept[0]?.password_hash).slice(0, 12)
  );
  check(
    "ولا الإلزام بتغييرها",
    kept[0]?.must_change_pin === false,
    String(kept[0]?.must_change_pin)
  );
  check(
    "وبقية الصفّ تُكتب كالمعتاد",
    String(kept[0]?.job_title).endsWith("عُدّل"),
    String(kept[0]?.job_title)
  );
  check(
    "و data تحمل تجزئة الخادم لا القديمة — فلا يبقى فرقٌ في المقارنة",
    kept[0]?.in_data === SERVER_HASH,
    String(kept[0]?.in_data).slice(0, 12)
  );

  const state = await readState(db);
  const read = state.users.find((u) => u.id === person.id);
  check(
    "والحالة المقروءة تحمل تجزئة الخادم",
    read?.pinHash === SERVER_HASH,
    String(read?.pinHash).slice(0, 12)
  );
}

/* ---- 6. الكتابة الكاملة للمجموعات الصغيرة ---- */
const renamed = { ...before.company, name: before.company.name + " (فحص)" };
await applyChanges(db, { whole: { company: renamed } }, "فاحص");
state = await readState(db);
check("بيانات الشركة تُكتب كاملةً", state.company.name === renamed.name);
await applyChanges(db, { whole: { company: before.company } }, "فاحص");

/* ---- 7. المعاملة: إمّا الكل أو لا شيء ---- */
const countBefore = (await readState(db)).movements.length;
let threw = false;
try {
  await applyChanges(
    db,
    {
      upserts: {
        movements: [
          { ...fresh, id: "22222222-2222-4222-8222-222222222222", entryNo: 99002 },
          /*
            سنةٌ لا تسعها القاعدة — والقاعدة ترفضها. ولا يصلح الرقم
            المكرّر لهذا الفحص بعد اليوم: صار يُعالَج بإعطاء التالي
            الحرّ لا بالرفض، وذلك مقصود — انظر check-entry-collision.
          */
          {
            ...fresh,
            id: "33333333-3333-4333-8333-333333333333",
            entryNo: 99003,
            fiscalYear: 999999,
          },
        ],
      },
    },
    "فاحص"
  );
} catch {
  threw = true;
}
const countAfter = (await readState(db)).movements.length;
check(
  "كتابةٌ فاشلة لا تترك نصفها",
  threw && countAfter === countBefore,
  `${countBefore} ← ${countAfter}`
);

/* ---- 8. الحالة سليمة في النهاية ---- */
const finalState = await readState(db);
check(
  "الحالة عادت إلى ما كانت",
  finalState.movements.length === before.movements.length &&
    finalState.contractors.length === before.contractors.length &&
    finalState.company.name === before.company.name
);

await db.close();
fs.rmSync(dir, { recursive: true, force: true });

console.log(
  bad === 0
    ? "\n✓ الكتابة صفّاً صفّاً تعمل كما وُصفت"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
