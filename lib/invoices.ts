/**
 * فواتير العملاء.
 *
 * التصميم والحقول منقولة من نموذج الفاتورة المعتمد من مجلس الإدارة
 * (INV-006، عقد عواطف القرطاس): رقم الفاتورة وتاريخها وعنوان العقد ورقم
 * الدفعة، مقابل بيانات العميل، مقابل طريقة الدفع والمبلغ بالحروف — ثم
 * جدول «م / وصف الأعمال / المبلغ».
 *
 * والفاتورة تُصدَر عن دفعة في عقد عميل، ويُثبَّت رقمها وقت الإصدار فلا
 * يتغيّر بعده: مستند سُلِّم للعميل لا يجوز أن يتبدّل تحت يده.
 */

import { round3 } from "./accounting";

export type InvoiceLine = {
  description: string;
  amount: number;
};

export type Invoice = {
  id: string;
  /** كما يُطبع: INV - 007 */
  number: string;
  /** yyyy-mm-dd */
  date: string;

  clientName: string;
  clientCivilId: string;
  clientPhone: string;
  /** موقع المشروع كما يُكتب في الفاتورة */
  projectLocation: string;
  /** اسم المشروع في النظام — للربط لا للطباعة */
  project: string;

  /** عنوان العقد: «عقد تشطيب بالكامل» */
  contractTitle: string;
  /** رقم الدفعة نصاً: «الدفعة الثالثة» */
  installmentLabel: string;
  /** ربط بالعقد المسجّل — فارغ للفاتورة المستقلة */
  contractNumber: string;
  installmentNumber: number;

  paymentMethod: string;
  lines: InvoiceLine[];
  notes: string;

  createdBy: string;
  createdAt: string;
};

export const invoiceTotal = (invoice: Invoice): number =>
  round3(invoice.lines.reduce((sum, line) => sum + (line.amount || 0), 0));

/** الرقم التالي في تسلسل واحد لكل الفواتير، كما في النموذج المعتمد */
export function nextInvoiceNumber(existing: Invoice[]): string {
  const top = existing
    .map((i) => Number(String(i.number).replace(/\D+/g, "")) || 0)
    .reduce((max, n) => Math.max(max, n), 0);
  return `INV - ${String(top + 1).padStart(3, "0")}`;
}

/** ترتيب الدفعة بالعربية، كما تُكتب في الفواتير */
const ORDINALS = [
  "",
  "الأولى",
  "الثانية",
  "الثالثة",
  "الرابعة",
  "الخامسة",
  "السادسة",
  "السابعة",
  "الثامنة",
  "التاسعة",
  "العاشرة",
  "الحادية عشرة",
  "الثانية عشرة",
];

export const installmentLabel = (number: number): string =>
  ORDINALS[number] ? `الدفعة ${ORDINALS[number]}` : `الدفعة ${number}`;
