import PizZip from "pizzip";
import { extractWtTextNodes } from "./docx-xml-utils";

const WORD_TEXT_PART_RE =
  /^word\/(?:document|header\d+|footer\d+|footnotes|endnotes)\.xml$/i;
const TEMPLATE_VARIABLE_RE =
  /(?:<<\s*([^<>\r\n]{1,160}?)\s*>>|>>\s*([^<>\r\n]{1,160}?)\s*<<|«\s*([^«»\r\n]{1,160}?)\s*»|»\s*([^«»\r\n]{1,160}?)\s*«)/g;

function normalizeTemplateVariableName(value: string): string {
  return value
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .trim();
}

/**
 * يستخرج أسماء متغيرات القالب النصية حتى عندما تقسمها Word بين عدة runs.
 * يدعم الصيغتين «اسم_المتغير» و<<اسم_المتغير>> في قوالب الشركات المختلفة.
 */
export function inspectDocxTemplate(buffer: ArrayBuffer): { variables: string[]; hasContent: boolean } {
  const zip = new PizZip(buffer);
  if (!zip.file("word/document.xml")) throw new Error("ملف Word غير صالح أو غير مكتمل. أعد حفظه بصيغة .docx ثم حاول مجددًا.");
  const found = new Set<string>();
  let hasContent = false;

  for (const partPath of Object.keys(zip.files)) {
    if (!WORD_TEXT_PART_RE.test(partPath)) continue;
    const xml = zip.file(partPath)?.asText() ?? "";
    const text = extractWtTextNodes(
      xml.replace(/<\/w:p>/g, "<w:t>\n</w:t></w:p>"),
    );
    hasContent ||= Boolean(text.replace(/[\s\u200b-\u200f\u202a-\u202e]/g, "")) || /<w:(?:drawing|pict|object)\b/.test(xml);
    for (const match of text.matchAll(TEMPLATE_VARIABLE_RE)) {
      const name = normalizeTemplateVariableName(match[1] ?? match[2] ?? match[3] ?? match[4] ?? "");
      if (name) found.add(name);
    }
  }

  return { variables: [...found], hasContent };
}

export function scanDocxTemplateVariables(buffer: ArrayBuffer): string[] {
  return inspectDocxTemplate(buffer).variables;
}
