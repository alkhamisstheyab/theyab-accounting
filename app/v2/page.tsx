import { redirect } from "next/navigation";

/**
 * كان النظام يُطوَّر على /v2 قبل اعتماده.
 * أصبح على / — وهذا التحويل يُبقي الروابط القديمة تعمل.
 */
export default function V2Redirect() {
  redirect("/");
}
