/**
 * جسر إلى lib/ids.ts — المصدر الوحيد لاشتقاق المعرّفات.
 *
 * السكربتات تعمل على Node والتطبيق على Next، والقاعدة واحدة. ولو
 * نُسخت في موضعين لاختلفا يوماً ولانكسرت الروابط بين الجداول.
 */
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const ids = await jiti.import("../lib/ids.ts");

export const uuidFor = ids.uuidFor;
export const isUuid = ids.isUuid;
