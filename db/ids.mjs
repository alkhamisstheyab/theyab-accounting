/**
 * تحويل معرّف التطبيق إلى uuid تقبله القاعدة.
 *
 * القاعدة تشترط uuid، وبعض المعرّفات القديمة نصوصٌ حرّة. فتُشتقّ منها
 * قيمة ثابتة: المعرّف نفسه في كل تشغيل، فلا تنكسر الروابط بين الجداول
 * ولا تتضاعف الصفوف عند إعادة النقل.
 *
 * ويشترك فيها النقل وفحص دورة الحالة، فيقارن الفحص ما كُتب فعلاً لا
 * ما ظُنّ أنه كُتب.
 */

const str = (v) => (v == null ? "" : String(v));

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v) => UUID.test(str(v));

let fallback = 0;

export function uuidFor(raw) {
  const s = str(raw);
  if (UUID.test(s)) return s;

  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 0x01000193) >>> 0;
    h2 = Math.imul(h2 + s.charCodeAt(i), 0x85ebca6b) >>> 0;
  }
  const seed = s || `auto-${fallback++}`;
  let h3 = 0;
  for (let i = 0; i < seed.length; i++) h3 = (h3 * 31 + seed.charCodeAt(i)) >>> 0;
  const hex = (n) => n.toString(16).padStart(8, "0");
  const raw32 = hex(h1) + hex(h2) + hex(h3) + hex((h1 ^ h2 ^ h3) >>> 0);
  return [
    raw32.slice(0, 8),
    raw32.slice(8, 12),
    "4" + raw32.slice(13, 16),
    "8" + raw32.slice(17, 20),
    raw32.slice(20, 32),
  ].join("-");
}
