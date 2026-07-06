import PizZip from "pizzip";
import {
  resolveImageBookmarkDef,
  resolveTextBookmarkDef,
} from "./bookmarks";
import {
  findBookmarkRanges,
  findEnclosingParagraph,
} from "./docx-bookmark-shared";
import { repairWordXml } from "./docx-xml-utils";
import { validateWordPartXml } from "./docx-xml-namespaces";
import { yieldToMain } from "./docx-yield";

const DOCUMENT_PATH = "word/document.xml";

function listMergeablePartPaths(fileNames: string[]): string[] {
  return fileNames.filter((name) => /^word\/(document|header\d+|footer\d+)\.xml$/i.test(name));
}

function buildPlaceholderRun(placeholder: string): string {
  return `<w:r><w:t>${placeholder}</w:t></w:r>`;
}

function buildImageLoopBlock(loopField: "assetImages" | "valuationImages"): string {
  return [
    `<w:p><w:r><w:t>{#${loopField}}</w:t></w:r></w:p>`,
    `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:t>{image}</w:t></w:r></w:p>`,
    `<w:p><w:r><w:t>{/${loopField}}</w:t></w:r></w:p>`,
  ].join("");
}

function replaceBookmarkInner(xml: string, range: ReturnType<typeof findBookmarkRanges>[number], innerXml: string): string {
  const startTag = xml.slice(range.startIndex, range.innerStart);
  const endTag = xml.slice(range.innerEnd, range.endIndex);
  return xml.slice(0, range.startIndex) + startTag + innerXml + endTag + xml.slice(range.endIndex);
}

function replaceParagraph(xml: string, paragraph: { start: number; end: number }, newBlock: string): string {
  return xml.slice(0, paragraph.start) + newBlock + xml.slice(paragraph.end);
}

/**
 * يحوّل الإشارات المرجعية في Word إلى وسوم docxtemplater ({clientName} …).
 * يُعاد فحص الملف بعد كل تعديل لتجنّب تلف XML.
 */
export async function injectDocxPlaceholders(
  zip: PizZip,
): Promise<{ ok: boolean; error?: string }> {
  const partPaths = listMergeablePartPaths(Object.keys(zip.files));

  for (const partPath of partPaths) {
    let xml = zip.file(partPath)?.asText() ?? "";
    if (!xml) continue;

    let changed = false;
    let guard = 0;

    while (guard < 200) {
      guard += 1;
      const ranges = findBookmarkRanges(xml);
      if (ranges.length === 0) break;

      let applied = false;

      for (const range of ranges) {
        const imageDef = resolveImageBookmarkDef(range.name);
        if (imageDef && partPath === DOCUMENT_PATH) {
          const paragraph = findEnclosingParagraph(xml, range.startIndex);
          if (!paragraph) continue;

          const loopField = imageDef.field;
          const candidate = repairWordXml(
            replaceParagraph(xml, paragraph, buildImageLoopBlock(loopField)),
          );
          if (!validateWordPartXml(candidate, partPath).ok) continue;

          xml = candidate;
          changed = true;
          applied = true;
          break;
        }

        const textDef = resolveTextBookmarkDef(range.name);
        if (!textDef) continue;

        const placeholder = `{${textDef.field}}`;
        const candidate = repairWordXml(
          replaceBookmarkInner(xml, range, buildPlaceholderRun(placeholder)),
        );
        if (!validateWordPartXml(candidate, partPath).ok) continue;

        xml = candidate;
        changed = true;
        applied = true;
        break;
      }

      if (!applied) break;
      await yieldToMain();
    }

    if (changed) {
      const validation = validateWordPartXml(repairWordXml(xml), partPath);
      if (!validation.ok) {
        return { ok: false, error: validation.error ?? `تعذر تحضير ${partPath}` };
      }
      zip.file(partPath, repairWordXml(xml));
    }
  }

  return { ok: true };
}
