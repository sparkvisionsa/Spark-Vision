import type PizZip from "pizzip";
import {
  prepareXmlForWrite,
  validatePartBeforeWrite,
} from "./docx-package-validate";
import {
  balanceRunTags,
  decodeXmlEntities,
  repairWordXml,
  sanitizeXmlText,
  trimOrphanRunEdges,
  writeWtTextNodes,
  xmlEscape,
} from "./docx-xml-utils";

export type BookmarkRange = {
  name: string;
  id: string;
  startIndex: number;
  endIndex: number;
  innerStart: number;
  innerEnd: number;
};

export type ParagraphRange = {
  start: number;
  end: number;
};

export type MvWordBookmarkMergeStats = {
  textBookmarksFilled: number;
  textBookmarksSkipped: number;
  assetImagesInserted: number;
  valuationImagesInserted: number;
  bookmarksFound: string[];
  imageErrors: string[];
};

const COVER_BOOKMARK_FONT_FAMILY = "Tajawal";
/** عناوين غلاف التقرير فقط — لا تشمل عنوانغ / عنواناصل داخل فقرات الجسم */
const COVER_TITLE_BOOKMARK_NAMES = ["عنوان", "غلاف"];
const COVER_CLIENT_BOOKMARK_NAMES = ["عميلغلاف"];
/** إشارات عنوان تظهر داخل جمل التقرير ويجب أن ترث تنسيق الفقرة المحيطة */
const INLINE_TITLE_BOOKMARK_NAMES = ["عنوانغ", "عنواناصل"];

function normalizeCoverBookmarkName(name: string): string {
  return name
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/[\s_\-.،؛:\u060C\u061B\u0640]+/g, "")
    .trim()
    .toLowerCase();
}

function isCoverFontBookmark(name: string): boolean {
  const normalized = normalizeCoverBookmarkName(name);
  if (INLINE_TITLE_BOOKMARK_NAMES.some((item) => normalizeCoverBookmarkName(item) === normalized)) {
    return false;
  }
  return [...COVER_TITLE_BOOKMARK_NAMES, ...COVER_CLIENT_BOOKMARK_NAMES].some(
    (item) => normalizeCoverBookmarkName(item) === normalized,
  );
}

function applyCoverBookmarkFont(name: string, rPr: string): string {
  if (!isCoverFontBookmark(name)) return rPr;

  const fonts = `<w:rFonts w:ascii="${COVER_BOOKMARK_FONT_FAMILY}" w:hAnsi="${COVER_BOOKMARK_FONT_FAMILY}" w:eastAsia="${COVER_BOOKMARK_FONT_FAMILY}" w:cs="${COVER_BOOKMARK_FONT_FAMILY}" w:hint="cs"/>`;
  if (!rPr.trim()) return `<w:rPr>${fonts}</w:rPr>`;

  const withoutFonts = rPr.replace(/<w:rFonts\b[^>]*(?:\/>|>[\s\S]*?<\/w:rFonts>)/g, "");
  if (/^<w:rPr\b[^>]*\/>$/.test(withoutFonts.trim())) {
    return withoutFonts.replace(/\/>\s*$/, `>${fonts}</w:rPr>`);
  }
  return withoutFonts.replace(/<w:rPr\b[^>]*>/, (match) => `${match}${fonts}`);
}

export function findBookmarkRanges(xml: string): BookmarkRange[] {
  const endById = new Map<string, { innerEnd: number; endIndex: number }>();
  const endTagRe = /<w:bookmarkEnd\b([^>]*?)(?:\s*\/>|>\s*<\/w:bookmarkEnd>)/g;

  for (const match of xml.matchAll(endTagRe)) {
    const attrs = match[1] ?? "";
    const idMatch = attrs.match(/\bw:id="(\d+)"/);
    if (!idMatch || match.index == null) continue;
    endById.set(idMatch[1]!, {
      innerEnd: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  const ranges: BookmarkRange[] = [];
  const startTagRe = /<w:bookmarkStart\b([^>]*?)(?:\s*\/>|>\s*<\/w:bookmarkStart>)/g;

  for (const match of xml.matchAll(startTagRe)) {
    const attrs = match[1] ?? "";
    const idMatch = attrs.match(/\bw:id="(\d+)"/);
    const nameMatch =
      attrs.match(/\bw:name="([^"]+)"/) ?? attrs.match(/\bw:name='([^']+)'/);
    if (!idMatch || !nameMatch || match.index == null) continue;

    const id = idMatch[1]!;
    const end = endById.get(id);
    if (!end) continue;

    const startTagEnd = match.index + match[0].length;
    ranges.push({
      name: decodeXmlEntities(nameMatch[1]!),
      id,
      startIndex: match.index,
      endIndex: end.endIndex,
      innerStart: startTagEnd,
      innerEnd: end.innerEnd,
    });
  }

  return ranges;
}

export function findParagraphOpenTag(xml: string, position: number): number {
  let searchPos = position;
  while (searchPos >= 0) {
    const idx = xml.lastIndexOf("<w:p", searchPos);
    if (idx < 0) return -1;
    const next = xml[idx + 4];
    if (next === ">" || next === " " || next === "\t" || next === "\r" || next === "\n") {
      return idx;
    }
    searchPos = idx - 1;
  }
  return -1;
}

export function findEnclosingParagraph(xml: string, position: number): ParagraphRange | null {
  const start = findParagraphOpenTag(xml, position);
  if (start < 0) return null;
  const end = xml.indexOf("</w:p>", position);
  if (end < 0) return null;
  return { start, end: end + 6 };
}

function findRunOpenTag(xml: string, position: number): number {
  let searchPos = position;
  while (searchPos >= 0) {
    const idx = xml.lastIndexOf("<w:r", searchPos);
    if (idx < 0) return -1;
    const next = xml[idx + 4];
    if (next === ">" || next === " " || next === "\t" || next === "\r" || next === "\n") {
      return idx;
    }
    searchPos = idx - 1;
  }
  return -1;
}

function isInsideRun(xml: string, position: number): boolean {
  const runStart = findRunOpenTag(xml, position);
  if (runStart < 0) return false;
  const runEnd = xml.indexOf("</w:r>", runStart);
  return runEnd >= 0 && position < runEnd;
}

/** يستخرج w:rPr من أول run داخل الإشارة للحفاظ على الخط والتنسيق */
export function extractFirstRunProperties(inner: string): string {
  for (const runMatch of inner.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g)) {
    const runInner = runMatch[1] ?? "";
    const selfClosing = runInner.match(/<w:rPr\b[^/]*\/>/);
    if (selfClosing?.[0]) return selfClosing[0];
    const block = runInner.match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/);
    if (block?.[0]) return block[0];
  }

  const selfClosing = inner.match(/<w:rPr\b[^/]*\/>/);
  if (selfClosing?.[0]) return selfClosing[0];

  const block = inner.match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/);
  return block?.[0] ?? "";
}

/** يستخرج w:rPr من run يحيط بالموضع (للإشارات الفارغة وسط الجملة) */
export function extractRunPropertiesAtPosition(xml: string, position: number): string {
  const runStart = findRunOpenTag(xml, position);
  if (runStart < 0) return "";
  const runEnd = xml.indexOf("</w:r>", runStart);
  if (runEnd < 0) return "";
  return extractFirstRunProperties(xml.slice(runStart, runEnd + 6));
}

function buildTextRunWithFormatting(text: string, rPr: string): string {
  const safe = xmlEscape(sanitizeXmlText(text));
  const preserve = /^\s|\s$|\n/.test(text) ? ' xml:space="preserve"' : "";
  const rPrBlock = rPr || "";
  return `<w:r>${rPrBlock}<w:t${preserve}>${safe}</w:t></w:r>`;
}

function buildTextRunContentOnly(text: string, rPr: string): string {
  const safe = xmlEscape(sanitizeXmlText(text));
  const preserve = /^\s|\s$|\n/.test(text) ? ' xml:space="preserve"' : "";
  const rPrBlock = rPr || "";
  return `${rPrBlock}<w:t${preserve}>${safe}</w:t>`;
}

function buildBookmarkTextContent(text: string, rPr: string, insideRun: boolean): string {
  return insideRun
    ? buildTextRunContentOnly(text, rPr)
    : buildTextRunWithFormatting(text, rPr);
}

/** إشارة موزّعة على أكثر من run — إعادة بناء على مستوى الفقرة دون كسر XML */
function replaceSpanningBookmark(
  xml: string,
  range: BookmarkRange,
  text: string,
  rPr: string,
): string {
  const startTag = xml.slice(range.startIndex, range.innerStart);
  const endTag = xml.slice(range.innerEnd, range.endIndex);
  const startInsideRun = isInsideRun(xml, range.startIndex);
  const inner = xml.slice(range.innerStart, range.innerEnd);
  const crossesRuns =
    /<\/w:r>\s*<w:r\b/.test(inner) || /^<\/w:r>/.test(inner.trim()) || /<w:r\b/.test(inner);

  if (!crossesRuns) {
    const newInner = startInsideRun
      ? buildTextRunContentOnly(text, rPr)
      : buildTextRunWithFormatting(text, rPr);
    return xml.slice(0, range.startIndex) + startTag + newInner + endTag + xml.slice(range.endIndex);
  }

  const para = findEnclosingParagraph(xml, range.startIndex);
  if (!para) {
    const middle = `${startTag}${buildTextRunWithFormatting(text, rPr)}${endTag}`;
    return xml.slice(0, range.startIndex) + middle + xml.slice(range.endIndex);
  }

  const localStart = range.startIndex - para.start;
  const localEnd = range.endIndex - para.start;
  const paraXml = xml.slice(para.start, para.end);

  let beforeXml = balanceRunTags(paraXml.slice(0, localStart));
  let afterXml = trimOrphanRunEdges(paraXml.slice(localEnd));
  afterXml = balanceRunTags(afterXml);

  const middle = `${startTag}${buildTextRunWithFormatting(text, rPr)}${endTag}`;
  const newPara = repairWordXml(beforeXml + middle + afterXml);

  return xml.slice(0, para.start) + newPara + xml.slice(para.end);
}

function isSimpleBookmarkInner(inner: string, startInsideRun: boolean): boolean {
  if (/<\/w:r>\s*<w:r\b/.test(inner)) return false;
  if (startInsideRun && /<w:r\b/.test(inner)) return false;

  const runOpens = (inner.match(/<w:r\b/g) ?? []).length;
  const runCloses = (inner.match(/<\/w:r>/g) ?? []).length;
  return runOpens === runCloses && runOpens <= 1;
}

export function listParagraphRanges(xml: string): ParagraphRange[] {
  const paragraphs: ParagraphRange[] = [];
  for (const match of xml.matchAll(/<w:p\b/g)) {
    if (match.index == null) continue;
    const start = match.index;
    const end = xml.indexOf("</w:p>", start);
    if (end < 0) continue;
    paragraphs.push({ start, end: end + 6 });
  }
  return paragraphs;
}

function paragraphContainsDrawing(paragraphXml: string): boolean {
  return /<w:drawing\b/.test(paragraphXml) || /<w:pict\b/.test(paragraphXml);
}

function paragraphIsPlaceholderImage(paragraphXml: string): boolean {
  if (!paragraphContainsDrawing(paragraphXml)) return false;
  const textOnly = paragraphXml
    .replace(/<w:bookmarkStart\b[^>]*(?:\/>|>[\s\S]*?<\/w:bookmarkStart>)/g, "")
    .replace(/<w:bookmarkEnd\b[^>]*(?:\/>|>[\s\S]*?<\/w:bookmarkEnd>)/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s/g, "");
  return textOnly.length === 0;
}

/** يحدد نطاق الفقرات للاستبدال: يحذف صور placeholder قبل الإشارة عند الحاجة */
export function findImageBookmarkReplaceRegion(
  xml: string,
  bookmarkStartIndex: number,
  removePlaceholderImages: boolean,
): { start: number; end: number } | null {
  const bookmarkParagraph = findEnclosingParagraph(xml, bookmarkStartIndex);
  if (!bookmarkParagraph) return null;

  let replaceStart = bookmarkParagraph.start;
  const replaceEnd = bookmarkParagraph.end;

  if (!removePlaceholderImages) {
    return { start: replaceStart, end: replaceEnd };
  }

  const paragraphs = listParagraphRanges(xml);
  const bookmarkIdx = paragraphs.findIndex((p) => p.start === bookmarkParagraph.start);
  if (bookmarkIdx < 0) return { start: replaceStart, end: replaceEnd };

  for (let i = bookmarkIdx - 1; i >= 0; i -= 1) {
    const para = paragraphs[i]!;
    const paraXml = xml.slice(para.start, para.end);
    if (paragraphIsPlaceholderImage(paraXml)) {
      replaceStart = para.start;
      continue;
    }
    break;
  }

  return { start: replaceStart, end: replaceEnd };
}

export function replaceBookmarkTextSafely(xml: string, range: BookmarkRange, text: string): string {
  if (!text.trim()) return xml;

  const startTag = xml.slice(range.startIndex, range.innerStart);
  const endTag = xml.slice(range.innerEnd, range.endIndex);
  const inner = xml.slice(range.innerStart, range.innerEnd);
  const startInsideRun = isInsideRun(xml, range.startIndex);
  const rPr =
    extractFirstRunProperties(inner) || extractRunPropertiesAtPosition(xml, range.startIndex);
  const styledRPr = applyCoverBookmarkFont(range.name, rPr);

  if (/<\/w:r>\s*<w:r\b/.test(inner)) {
    return replaceSpanningBookmark(xml, range, text, styledRPr);
  }

  if (!isSimpleBookmarkInner(inner, startInsideRun)) {
    if (startInsideRun && /<w:r\b/.test(inner)) {
      return replaceSpanningBookmark(xml, range, text, styledRPr);
    }
    const bookmarkBlock = `${startTag}${buildBookmarkTextContent(text, styledRPr, startInsideRun)}${endTag}`;
    return xml.slice(0, range.startIndex) + bookmarkBlock + xml.slice(range.endIndex);
  }

  let newInner: string;

  if (/<w:t\b/.test(inner)) {
    newInner = isCoverFontBookmark(range.name)
      ? buildBookmarkTextContent(text, styledRPr, startInsideRun)
      : writeWtTextNodes(inner, text);
  } else if (startInsideRun) {
    newInner = buildTextRunContentOnly(text, styledRPr);
  } else {
    newInner = buildTextRunWithFormatting(text, styledRPr);
  }

  return xml.slice(0, range.startIndex) + startTag + newInner + endTag + xml.slice(range.endIndex);
}

/** بديل أبسط عند فشل الاستبدال الآمن — يحافظ على الإشارة داخل الجملة */
export function replaceBookmarkTextFallback(
  xml: string,
  range: BookmarkRange,
  text: string,
): string {
  if (!text.trim()) return xml;

  const startTag = xml.slice(range.startIndex, range.innerStart);
  const endTag = xml.slice(range.innerEnd, range.endIndex);
  const startInsideRun = isInsideRun(xml, range.startIndex);
  const rPr =
    extractFirstRunProperties(xml.slice(range.innerStart, range.innerEnd)) ||
    extractRunPropertiesAtPosition(xml, range.startIndex);
  const styledRPr = applyCoverBookmarkFont(range.name, rPr);
  const newInner = startInsideRun
    ? buildTextRunContentOnly(text, styledRPr)
    : buildTextRunWithFormatting(text, styledRPr);

  return xml.slice(0, range.startIndex) + startTag + newInner + endTag + xml.slice(range.endIndex);
}

export function listMergeablePartPaths(fileNames: string[]): string[] {
  return fileNames.filter((name) => /^word\/(document|header\d+|footer\d+)\.xml$/i.test(name));
}

export function tryWriteXmlPart(
  zip: PizZip,
  path: string,
  xml: string,
  errors?: string[],
): boolean {
  const validation = validatePartBeforeWrite(xml, path);
  if (!validation.ok) {
    errors?.push(validation.error ?? `تعذر تحديث ${path}`);
    return false;
  }
  zip.file(path, validation.repaired ?? prepareXmlForWrite(xml));
  return true;
}
