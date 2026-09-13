/**
 * تصدير الجداول إلى CSV يفتحه Excel بالعربية سليمة.
 */

/** جدول للتصدير: اسم الورقة وصفوفها، أول صف هو الترويسة */
export type ExportTable = {
  name: string;
  rows: (string | number)[][];
};

function escapeCell(value: string | number): string {
  const text = String(value ?? "");
  // الفاصلة وعلامة التنصيص وسطر جديد تستوجب التحويط
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * يبني نص CSV.
 *
 * يُصدَّر بعلامة ترتيب البايت (BOM) لأن Excel على ويندوز يفترض ترميز
 * النظام بدونها فتظهر العربية رموزاً غير مفهومة.
 */
export function toCSV(rows: (string | number)[][]): string {
  const body = rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
  return `﻿${body}`;
}

export function downloadText(
  filename: string,
  text: string,
  mime = "text/csv;charset=utf-8"
) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** اسم ملف آمن: بلا محارف يرفضها نظام الملفات */
export function safeFileName(parts: string[], extension: string): string {
  const base = parts
    .filter(Boolean)
    .join(" - ")
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim();
  return `${base}.${extension}`;
}
