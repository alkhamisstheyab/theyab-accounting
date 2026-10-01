/**
 * يفحص كشفَ الصلاحيات التي فات المستخدمَ منحُها.
 *
 *   npm run check:role-drift [نسخة.json]
 *
 * الصلاحيات تُنسخ على المستخدم **يوم إنشائه** ولا تُقرأ من قالب دوره
 * بعده. وذلك مقصود: منحُ صلاحيةٍ بلا قرار أخطرُ من حجبها.
 *
 * لكنّه يصمت حين يجب أن ينطق. أُضيفت `dues.view` و`dues.create` إلى
 * قالب «مهندس مشرف» بعد إنشاء المهندسَين، فبقيا على تسعٍ من إحدى عشرة
 * — فكانت شاشةُ المستحقات التي بُنيت ليُثبت فيها المهندسُ ما وجب ساعةَ
 * تمام العمل **تغيب من قائمتهما**، ولم يُعلم بذلك حتى شكا أحدهما بعد
 * يومٍ من فتح النظام للعاملين.
 *
 * والذي يُخشى منه في العلاج:
 *   • أن يُنزع من أحدٍ توسيعٌ مُنح له بقرار.
 *   • أن يُحسب «مخصّص» ناقصاً وهو لا قالب له.
 *   • أن يُمنح أحدٌ شيئاً بلا أثرٍ في سجلّ التدقيق.
 */
import fs from "fs";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? " — " + detail : ""}`);
};

const { roleDrift, lacksRolePermissions, withRoleTemplate } = await jiti.import(
  "../lib/role-drift.ts"
);
const { roleDefinition, ALL_PERMISSIONS } = await jiti.import(
  "../lib/permissions.ts"
);

const engineer = roleDefinition("engineer").permissions;

console.log("\nالناقص عن القالب يُكشف:\n");

const behind = engineer.filter((p) => !p.startsWith("dues."));
const drift = roleDrift("engineer", behind);
check(
  "مهندسٌ بلا المستحقات ينقصه اثنتان",
  drift.missing.length === 2,
  drift.missing.join("، ")
);
check(
  "وهما بعينهما",
  drift.missing.includes("dues.view") && drift.missing.includes("dues.create")
);
check("ولا زائدَ عنده", drift.extra.length === 0);
check("ويُقال إنه ناقص", lacksRolePermissions("engineer", behind));

const full = roleDrift("engineer", engineer);
check("ومن استوفى قالبه لا ينقصه شيء", full.missing.length === 0);
check("ولا يُقال إنه ناقص", !lacksRolePermissions("engineer", engineer));

console.log("\nوالتوسيع بقرارٍ لا يُنزع:\n");

const widened = [...engineer, "movements.view"];
const w = roleDrift("engineer", widened);
check("يُعدّ زائداً", w.extra.includes("movements.view"), w.extra.join("، "));
check("ولا يُعدّ ناقصاً", w.missing.length === 0);
const after = withRoleTemplate("engineer", widened);
check("ويبقى بعد المنح", after.includes("movements.view"));

const mended = withRoleTemplate("engineer", behind);
check(
  "والناقص يُضمّ",
  mended.includes("dues.view") && mended.includes("dues.create"),
  `${mended.length} صلاحية`
);
check(
  "ولا يُكرَّر شيء",
  new Set(mended).size === mended.length,
  `${new Set(mended).size} من ${mended.length}`
);

console.log("\nو«مخصّص» لا قالب له:\n");

const custom = roleDrift("custom", ["projects.view"]);
check("فلا نقصَ فيه", custom.missing.length === 0);
check("ولا زيادة", custom.extra.length === 0);
check(
  "ولا يُمسّ بالمنح",
  withRoleTemplate("custom", ["projects.view"]).length === 1
);

console.log("\nوغير المعروف من الصلاحيات لا يُعدّ زائداً:\n");
const junk = roleDrift("engineer", [...engineer, "لا.وجود.له"]);
check("يُطرح الغريب", junk.extra.length === 0, junk.extra.join("، "));

console.log("\nوالشاشة تكشف وتَمنح:\n");
const page = fs.readFileSync("app/page.tsx", "utf8");
check("وسمٌ في صفّ من ينقصه", page.includes("من دوره"));
check(
  "ولوحةٌ تُسمّي الناقصين وما نقصهم",
  page.includes(".missing.map(permissionLabel)")
);
check("وزرٌّ يمنحهم", page.includes("امنحهم ما نقص"));
check("ويُستأذن قبله", page.includes("ولا يُنزع منهم شيء"));
check(
  "ويُسجَّل المنح باسم صاحبه",
  page.includes("`منح ${u.name} ما نقص من قالب")
);
check(
  "والبيان القديم «التحقق في المتصفح» أُزيل",
  !page.includes("التحقق يجري داخل\n          المتصفح") &&
    !page.includes("الصلاحيات هنا تنظّم الواجهة ولا تحمي البيانات")
);

/* ---- وعلى ملفّات الشركة ---- */
const BACKUP = process.argv[2];
if (BACKUP && fs.existsSync(BACKUP)) {
  const d = JSON.parse(fs.readFileSync(BACKUP, "utf8")).data;
  console.log("\nوعلى مستخدمي الشركة:\n");
  let behindNow = 0;
  for (const u of d.users ?? []) {
    const r = roleDrift(u.role, u.permissions ?? []);
    const extra = r.extra.length ? ` · زائد: ${r.extra.join("، ")}` : "";
    console.log(
      `     ${u.name} (${u.role}) — ${(u.permissions ?? []).length} صلاحية` +
        (r.missing.length ? ` · ينقصه: ${r.missing.join("، ")}` : " · مستوفٍ") +
        extra
    );
    if (r.missing.length) behindNow++;
  }
  check(
    "لا أحد ينقصه شيءٌ من قالبه اليوم",
    behindNow === 0,
    behindNow ? `${behindNow} ناقصاً` : "الجميع مستوفون"
  );
  check(
    "وكلُّ صلاحيةٍ محفوظةٍ معروفة",
    (d.users ?? []).every((u) =>
      (u.permissions ?? []).every((p) => ALL_PERMISSIONS.includes(p))
    )
  );
}

console.log(
  bad === 0
    ? "\n✓ ما نقص يُكشف ويُمنح، وما وُسّع بقرارٍ يبقى"
    : `\n✗ ${bad} فحصاً أخفق`
);
process.exit(bad === 0 ? 0 : 1);
