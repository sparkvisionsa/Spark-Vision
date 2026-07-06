/** يحوّل HTML بسيطاً إلى نص مناسب لملف Word */
export function htmlToPlainTextForWord(html?: string | null): string {
  if (!html?.trim()) return "";
  if (typeof document === "undefined") {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const root = document.createElement("div");
  root.innerHTML = html;
  return (root.textContent ?? root.innerText ?? "").replace(/\n{3,}/g, "\n\n").trim();
}
