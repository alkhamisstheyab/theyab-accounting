/**
 * الصلاحيات التي فات المستخدمَ منحُها.
 *
 * الصلاحيات تُنسخ على المستخدم **يوم إنشائه**، ولا تُقرأ من قالب دوره
 * بعد ذلك. فمن أُنشئ قبل أن تُضاف صلاحيةٌ إلى قالبه لا يأخذها أبداً —
 * ولا يُنبَّه إلى ذلك أحد.
 *
 * ووقع ذلك فعلاً: بُنيت شاشة المستحقات ليُثبت فيها المهندسُ ما وجب
 * ساعةَ تمام العمل، وأُضيفت `dues.view` و`dues.create` إلى قالب «مهندس
 * مشرف». ونوحٌ وميس أُنشئا قبلها، فبقيا على تسعٍ من إحدى عشرة — فكانت
 * الشاشة التي صُنعت لأجلهما تغيب من قائمتهما كأنها لا تخصّهما، ولم
 * يُعلم بذلك حتى شكا المهندس بعد يومٍ من فتح النظام.
 *
 * وعِلّةُ النسخ مقصودة: منحُ صلاحيةٍ بلا قرار أخطرُ من حجبها، فلا
 * يُوسَّع على أحدٍ من تلقاء النظام — إلا المالكَ والمدير، فدورهما
 * معرَّفٌ بأنه «كلُّ شيء».
 *
 * فالعلاج أن يُكشف الفرق لا أن يُسدّ من تلقائه: يُعرض لصاحب القرار
 * ما نقص ومتى، ويُمنح بضغطة.
 */

import { ALL_PERMISSIONS, roleDefinition, type Permission } from "./permissions";

/** ما يملكه القالب ولا يملكه صاحبه */
export type RoleDrift = {
  /** الناقص عن قالب الدور */
  missing: Permission[];
  /** ما عنده زائدٌ على القالب — قد يكون توسيعاً مقصوداً، فلا يُنزع */
  extra: Permission[];
};

/**
 * يقارن صلاحيات المستخدم بقالب دوره.
 *
 * و«مخصّص» لا قالب له — صلاحياته هي ما قُرّر له بعينه، فلا نقصَ فيه
 * ولا زيادة. وكذلك المالك والمدير: دورهما كلُّ الصلاحيات، ويُعاد منحُها
 * عند كل تحميل، فلا يَثبت فيهما فرق.
 */
export function roleDrift(
  role: string,
  permissions: readonly string[]
): RoleDrift {
  if (role === "custom") return { missing: [], extra: [] };

  const template = roleDefinition(role as never).permissions;
  const has = new Set(permissions);
  const inTemplate = new Set<string>(template);

  return {
    missing: template.filter((p) => !has.has(p)),
    extra: permissions.filter(
      (p): p is Permission =>
        !inTemplate.has(p) && ALL_PERMISSIONS.includes(p as Permission)
    ),
  };
}

/** أينقص صاحبَ هذا الدور شيءٌ من قالبه؟ */
export const lacksRolePermissions = (
  role: string,
  permissions: readonly string[]
): boolean => roleDrift(role, permissions).missing.length > 0;

/**
 * الصلاحيات بعد ضمّ ما نقص.
 *
 * يُضمّ الناقصُ ويبقى الزائد: من وُسّع عليه بقرارٍ لا يُنزع عنه بتحديثٍ
 * من قالب.
 */
export function withRoleTemplate(
  role: string,
  permissions: readonly Permission[]
): Permission[] {
  const { missing } = roleDrift(role, permissions);
  if (missing.length === 0) return [...permissions];
  return [...permissions, ...missing];
}
