/** التحقق من سلامة أجزاء XML داخل حزمة Word (.docx) */

const XML_PART_RE = /^word\/(document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i;
const OPC_XML_RE =
  /^(\[Content_Types\]\.xml|_rels\/\.rels|word\/_rels\/document\.xml\.rels|word\/_rels\/header\d+\.xml\.rels|word\/_rels\/footer\d+\.xml\.rels)$/i;

export function isWordXmlPartPath(path: string): boolean {
  return XML_PART_RE.test(path) || OPC_XML_RE.test(path);
}

export function validateWordXmlContent(xml: string): { ok: boolean; error?: string } {
  if (!xml.trim()) return { ok: false, error: "ملف XML فارغ." };
  if (typeof DOMParser === "undefined") return { ok: true };

  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    const text = parseError.textContent?.trim() || "XML parser error";
    return { ok: false, error: text.slice(0, 240) };
  }
  return { ok: true };
}

export function validateZipXmlParts(
  fileNames: string[],
  readText: (path: string) => string | null,
): { ok: boolean; path?: string; error?: string } {
  for (const path of fileNames) {
    if (!isWordXmlPartPath(path)) continue;
    const xml = readText(path);
    if (xml == null) continue;
    const result = validateWordXmlContent(xml);
    if (!result.ok) {
      return { ok: false, path, error: result.error };
    }
  }
  return { ok: true };
}

export function isValidImageBytes(bytes: Uint8Array, ext: string): boolean {
  if (bytes.byteLength < 16) return false;
  const normalized = ext.toLowerCase().replace("jpg", "jpeg");
  if (normalized === "png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (normalized === "gif") {
    return bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
  }
  if (normalized === "bmp") {
    return bytes[0] === 0x42 && bytes[1] === 0x4d;
  }
  return bytes[0] === 0xff && bytes[1] === 0xd8;
}
