import PizZip from "pizzip";
import { validateWordXmlContent, validateZipXmlParts } from "./docx-validate";
import { repairWordXml } from "./docx-xml-utils";

const DOCUMENT_PATH = "word/document.xml";
const REls_PATH = "word/_rels/document.xml.rels";

/** يتحقق من عدم وجود w:t خارج w:r (سبب شائع لتلف Word) */
function validateNoOrphanTextNodes(xml: string): { ok: boolean; error?: string } {
  const withoutRuns = xml.replace(/<w:r\b[\s\S]*?<\/w:r>/g, "");
  if (/<w:t\b/.test(withoutRuns)) {
    return { ok: false, error: "عنصر نص خارج run." };
  }
  return { ok: true };
}

/** يتحقق من أن كل r:embed في document.xml له Relationship وملف media */
function validateDocumentImageRelationships(zip: PizZip): { ok: boolean; error?: string } {
  const documentXml = zip.file(DOCUMENT_PATH)?.asText() ?? "";
  const relsXml = zip.file(REls_PATH)?.asText() ?? "";
  if (!documentXml || !relsXml) return { ok: true };

  const embedIds = [...documentXml.matchAll(/\br:embed="(rId\d+)"/g)].map((m) => m[1]!);
  for (const id of embedIds) {
    const relMatch =
      relsXml.match(new RegExp(`<Relationship\\b[^>]*\\bId="${id}"[^>]*\\bTarget="([^"]+)"`, "i")) ??
      relsXml.match(new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${id}"`, "i"));
    if (!relMatch) {
      return { ok: false, error: `علاقة صورة مفقودة: ${id}` };
    }
    const target = relMatch[1]!.replace(/^\.\.\//, "word/");
    const mediaPath = target.startsWith("word/") ? target : `word/${target}`;
    if (!zip.file(mediaPath)) {
      return { ok: false, error: `ملف صورة مفقود: ${mediaPath}` };
    }
  }
  return { ok: true };
}

/** يتحقق من عدم وجود w:r داخل w:r (سبب شائع لتلف Word) */
function validateNoNestedRuns(xml: string): { ok: boolean; error?: string } {
  if (/<w:r\b(?:(?!<\/w:r>)[\s\S])*<w:r\b/.test(xml)) {
    return { ok: false, error: "بنية run متداخلة في XML." };
  }
  return { ok: true };
}

export function validateDocxPackage(zip: PizZip): { ok: boolean; error?: string; path?: string } {
  const xmlCheck = validateZipXmlParts(Object.keys(zip.files), (path) => zip.file(path)?.asText() ?? null);
  if (!xmlCheck.ok) return xmlCheck;

  for (const path of Object.keys(zip.files)) {
    if (!/^word\/(document|header\d+|footer\d+)\.xml$/i.test(path)) continue;
    let xml = zip.file(path)?.asText() ?? "";
    let nested = validateNoNestedRuns(xml);
    if (!nested.ok) {
      xml = repairWordXml(xml);
      zip.file(path, xml);
      nested = validateNoNestedRuns(xml);
      if (!nested.ok) return { ok: false, path, error: nested.error };
    }
    const orphanText = validateNoOrphanTextNodes(xml);
    if (!orphanText.ok) return { ok: false, path, error: orphanText.error };
  }

  const relsCheck = validateDocumentImageRelationships(zip);
  if (!relsCheck.ok) return { ok: false, path: REls_PATH, error: relsCheck.error };

  return { ok: true };
}

export function validateDocxBuffer(buffer: ArrayBuffer): { ok: boolean; error?: string; path?: string } {
  try {
    const zip = new PizZip(buffer);
    return validateDocxPackage(zip);
  } catch {
    return { ok: false, error: "تعذر قراءة ملف Word." };
  }
}

export function generateSafeDocxBuffer(zip: PizZip): ArrayBuffer {
  const mimetypeFile = zip.file("mimetype");
  if (mimetypeFile) {
    zip.file("mimetype", mimetypeFile.asText(), { compression: "STORE" });
  }

  return zip.generate({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    platform: "UNIX",
  }) as ArrayBuffer;
}

export function cloneDocxBuffer(buffer: ArrayBuffer): PizZip {
  return new PizZip(buffer);
}

/** يُصلح document.xml قبل الكتابة */
export function prepareXmlForWrite(xml: string): string {
  return repairWordXml(xml);
}

export function validatePartBeforeWrite(
  xml: string,
  partPath: string,
): { ok: boolean; error?: string; repaired?: string } {
  let repaired = prepareXmlForWrite(xml);
  let parsed = validateWordXmlContent(repaired);
  if (!parsed.ok) {
    repaired = repairWordXml(xml);
    repaired = prepareXmlForWrite(repaired);
    parsed = validateWordXmlContent(repaired);
    if (!parsed.ok) {
      const detail = parsed.error ?? "";
      if (/mismatch|parser/i.test(detail)) {
        return { ok: false, error: "بنية XML غير متوازنة — تعذر حفظ التعديل." };
      }
      return parsed;
    }
  }

  if (/^word\/(document|header\d+|footer\d+)\.xml$/i.test(partPath)) {
    let nested = validateNoNestedRuns(repaired);
    if (!nested.ok) {
      repaired = prepareXmlForWrite(repaired);
      nested = validateNoNestedRuns(repaired);
      if (!nested.ok) return nested;
    }
    const orphanText = validateNoOrphanTextNodes(repaired);
    if (!orphanText.ok) return orphanText;
  }

  return { ok: true, repaired };
}
