/** تنزيل محلي لملفات الوسائط المنتَجة في المتصفح (تسجيلات، صور، ملفات محوَّلة). */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** يحوّل وصفاً كتبه المستخدم إلى اسم ملف صالح على Windows وmacOS وLinux. */
export function safeMediaFileName(text: string, fallback: string) {
  const cleaned = text
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 80)
    .trim();
  return cleaned || fallback;
}

/** طابع زمني محلي مقروء يُستخدم في أسماء الملفات: 2026-09-17-14-05. */
export function fileNameTimestamp(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}`;
}
