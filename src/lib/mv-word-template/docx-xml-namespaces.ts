/** يضمن وجود مساحات الأسماء (namespaces) اللازمة لإدراج الصور دون تلف document.xml */

const DOCUMENT_DRAWING_NAMESPACES: Record<string, string> = {
  "xmlns:wp": "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
  "xmlns:a": "http://schemas.openxmlformats.org/drawingml/2006/main",
  "xmlns:pic": "http://schemas.openxmlformats.org/drawingml/2006/picture",
  "xmlns:r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  "xmlns:mc": "http://schemas.openxmlformats.org/markup-compatibility/2006",
  "xmlns:w14": "http://schemas.microsoft.com/office/word/2010/wordml",
  "xmlns:wpc": "http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas",
  "xmlns:wpg": "http://schemas.microsoft.com/office/word/2010/wordprocessingGroup",
  "xmlns:wpi": "http://schemas.microsoft.com/office/word/2010/wordprocessingInk",
  "xmlns:wps": "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
};

function escapeNsKey(key: string): string {
  return key.replace(":", "\\:");
}

export function ensureDocumentDrawingNamespaces(documentXml: string): string {
  const match = documentXml.match(/<w:document\b([^>]*)>/);
  if (!match) return documentXml;

  let attrs = match[1] ?? "";
  for (const [key, uri] of Object.entries(DOCUMENT_DRAWING_NAMESPACES)) {
    const pattern = new RegExp(`${escapeNsKey(key)}="`);
    if (!pattern.test(attrs)) {
      attrs += ` ${key}="${uri}"`;
    }
  }

  return documentXml.replace(/<w:document\b[^>]*>/, `<w:document${attrs}>`);
}

/** التحقق من XML بعد إصلاح السمات الشائعة */
export function validateWordPartXml(xml: string, partPath: string): { ok: boolean; error?: string } {
  if (!xml.trim()) return { ok: false, error: "ملف XML فارغ." };
  if (typeof DOMParser === "undefined") return { ok: true };

  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    const text = parseError.textContent?.trim() || "XML parser error";
    return { ok: false, error: `${partPath}: ${text.slice(0, 280)}` };
  }
  return { ok: true };
}
