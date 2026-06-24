"use client";

import { downloadBlob } from "./pptx-export";

/**
 * تصدير تقرير التقييم إلى ملف Word (.docx) قابل للقراءة والتعديل.
 *
 * النهج الأساسي: المرور على شجرة DOM لكل صفحة تقرير، واستخراج المحتوى الفعلي
 * (عناوين، فقرات، جداول، صور) ثم بناء مستند Word OOXML حقيقي بدلاً من إدراج
 * صورة لكل صفحة. ذلك يجعل الملف خفيفاً، واضحاً، وقابلاً للتعديل في Word.
 *
 * يبقى المسار القديم (Image-based) متاحاً عبر buildDocxFromPngPages لمن يحتاجه.
 */

// ---------- ثوابت قياس الصفحة ----------
// EMU: 914,400 EMU = 1 بوصة = 96 بكسل CSS → 9525 EMU لكل بكسل.
// TWIPS: 1440 twip = 1 بوصة = 567 twip لكل سم تقريباً.

const A4_PORTRAIT_EMU = { cx: 7_560_000, cy: 10_692_000 } as const;
const A4_LANDSCAPE_EMU = { cx: 10_692_000, cy: 7_560_000 } as const;
const A4_PORTRAIT_TWIPS = { w: 11_906, h: 16_838 } as const;
const A4_LANDSCAPE_TWIPS = { w: 16_838, h: 11_906 } as const;
/** هوامش معقولة داخل المستند (1.5 سم تقريباً) - لجعل المحتوى متنفساً وقابلاً للتحرير. */
const DEFAULT_MARGIN_TWIPS = { top: 720, right: 720, bottom: 720, left: 720, header: 360, footer: 360 } as const;
const EMU_PER_PX = 9525;
const PX_PER_INCH = 96;
const TWIPS_PER_INCH = 1440;
const PX_TO_TWIPS = TWIPS_PER_INCH / PX_PER_INCH;
const HALF_POINTS_PER_PX = (72 * 2) / PX_PER_INCH; // 1 بكسل = 0.75 نقطة = 1.5 نصف نقطة
const MAX_CONTENT_WIDTH_TWIPS = {
  portrait: A4_PORTRAIT_TWIPS.w - DEFAULT_MARGIN_TWIPS.left - DEFAULT_MARGIN_TWIPS.right,
  landscape: A4_LANDSCAPE_TWIPS.w - DEFAULT_MARGIN_TWIPS.left - DEFAULT_MARGIN_TWIPS.right,
} as const;
const MAX_CONTENT_WIDTH_EMU = {
  portrait: Math.round(MAX_CONTENT_WIDTH_TWIPS.portrait * (EMU_PER_PX / PX_TO_TWIPS)),
  landscape: Math.round(MAX_CONTENT_WIDTH_TWIPS.landscape * (EMU_PER_PX / PX_TO_TWIPS)),
} as const;

// ---------- أدوات الترميز والـ ZIP (متوافقة مع المسار القديم) ----------

const textEncoder = new TextEncoder();

/**
 * يحذف المحارف غير المسموح بها في XML 1.0 (محارف التحكم باستثناء tab/LF/CR
 * والنطاقات المحجوزة)، ثم يهرّب الرموز الخاصة. عدم القيام بذلك يؤدي إلى ملف
 * docx «تالف» لأن Word يرفض المستندات التي تحتوي على بايتات تحكم نصية.
 */
function sanitizeXmlText(value: string) {
  if (!value) return "";
  // إزالة محارف XML 1.0 غير الصالحة: 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F-0x84, 0x86-0x9F, surrogates يتيمة، و 0xFFFE/0xFFFF.
  return value.replace(
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u0084\u0086-\u009F\uFDD0-\uFDEF\uFFFE\uFFFF]/g,
    "",
  );
}

function xmlEscape(value: string) {
  return sanitizeXmlText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function bytesFromString(value: string) {
  return textEncoder.encode(value);
}

function bytesFromBase64(base64: string) {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function pngBytesFromDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/i);
  if (!match) throw new Error("Word export expects PNG page images.");
  return bytesFromBase64(match[1]!);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    c = crcTable[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function writeU16(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeU32(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function buildStoredZip(entries: Array<{ path: string; data: Uint8Array }>, mimeType: string) {
  const parts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime();

  for (const entry of entries) {
    const name = bytesFromString(entry.path);
    const crc = crc32(entry.data);
    const local: number[] = [];
    writeU32(local, 0x04034b50);
    writeU16(local, 20);
    writeU16(local, 0x0800);
    writeU16(local, 0);
    writeU16(local, dosTime);
    writeU16(local, dosDate);
    writeU32(local, crc);
    writeU32(local, entry.data.length);
    writeU32(local, entry.data.length);
    writeU16(local, name.length);
    writeU16(local, 0);
    const localBytes = concatBytes([new Uint8Array(local), name, entry.data]);
    parts.push(localBytes);

    const central: number[] = [];
    writeU32(central, 0x02014b50);
    writeU16(central, 20);
    writeU16(central, 20);
    writeU16(central, 0x0800);
    writeU16(central, 0);
    writeU16(central, dosTime);
    writeU16(central, dosDate);
    writeU32(central, crc);
    writeU32(central, entry.data.length);
    writeU32(central, entry.data.length);
    writeU16(central, name.length);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU32(central, 0);
    writeU32(central, offset);
    centralParts.push(concatBytes([new Uint8Array(central), name]));
    offset += localBytes.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end: number[] = [];
  writeU32(end, 0x06054b50);
  writeU16(end, 0);
  writeU16(end, 0);
  writeU16(end, entries.length);
  writeU16(end, entries.length);
  writeU32(end, centralDirectory.length);
  writeU32(end, offset);
  writeU16(end, 0);

  const zipBytes = concatBytes([...parts, centralDirectory, new Uint8Array(end)]);
  const zipBuffer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength);
  return new Blob([zipBuffer], { type: mimeType });
}

// =============================================================================
// المسار القديم: تصدير قائم على الصور (يبقى كحلٍّ احتياطي)
// =============================================================================

export type DocxImagePage = {
  dataUrl: string;
  width: number;
  height: number;
  title?: string;
  landscape?: boolean;
};

function imageSectionPr(landscape: boolean, type?: "nextPage") {
  const twips = landscape ? A4_LANDSCAPE_TWIPS : A4_PORTRAIT_TWIPS;
  return `<w:sectPr>${type ? `<w:type w:val="${type}"/>` : ""}<w:pgSz w:w="${twips.w}" w:h="${twips.h}"${
    landscape ? ' w:orient="landscape"' : ""
  }/><w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="0"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
}

function imagePageDrawing(page: DocxImagePage, index: number) {
  const ext = page.landscape ? A4_LANDSCAPE_EMU : A4_PORTRAIT_EMU;
  const title = xmlEscape(page.title || `Report page ${index}`);
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251658240" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionH><wp:positionV relativeFrom="page"><wp:posOffset>0</wp:posOffset></wp:positionV><wp:extent cx="${ext.cx}" cy="${ext.cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${index}" name="${title}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${index}" name="${title}.png"/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId${index}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${ext.cx}" cy="${ext.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:anchor></w:drawing></w:r></w:p>`;
}

function imageBasedDocumentXml(pages: DocxImagePage[]) {
  const body = pages
    .map((page, i) => {
      const index = i + 1;
      const drawing = imagePageDrawing(page, index);
      if (i === pages.length - 1) return drawing;
      return `${drawing}<w:p><w:pPr>${imageSectionPr(Boolean(page.landscape), "nextPage")}</w:pPr></w:p>`;
    })
    .join("");
  const last = pages[pages.length - 1]!;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${OOXML_NAMESPACES}><w:body>${body}${imageSectionPr(Boolean(last.landscape))}</w:body></w:document>`;
}

function imageBasedDocumentRelsXml(pageCount: number) {
  const rels = Array.from(
    { length: pageCount },
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/page${i + 1}.png"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

const OOXML_NAMESPACES = [
  'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"',
  'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"',
  'xmlns:o="urn:schemas-microsoft-com:office:office"',
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
  'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"',
  'xmlns:v="urn:schemas-microsoft-com:vml"',
  'xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"',
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
  'xmlns:w10="urn:schemas-microsoft-com:office:word"',
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
  'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"',
  'xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"',
  'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"',
  'xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"',
  'xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"',
  'xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"',
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"',
  'mc:Ignorable="w14 w15 wp14"',
].join(" ");

const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;

function contentTypesXmlFor(extensions: Set<string>, hasStyles = true) {
  const defaults = [
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`,
    `<Default Extension="xml" ContentType="application/xml"/>`,
  ];
  if (extensions.has("png")) defaults.push(`<Default Extension="png" ContentType="image/png"/>`);
  if (extensions.has("jpeg")) defaults.push(`<Default Extension="jpeg" ContentType="image/jpeg"/>`);
  if (extensions.has("jpg")) defaults.push(`<Default Extension="jpg" ContentType="image/jpeg"/>`);
  if (extensions.has("gif")) defaults.push(`<Default Extension="gif" ContentType="image/gif"/>`);
  const overrides = [
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>`,
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>`,
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>`,
  ];
  if (hasStyles) {
    overrides.push(
      `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>`,
    );
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${defaults.join("")}${overrides.join("")}</Types>`;
}

const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Spark Vision</Application></Properties>`;

function coreXml(title: string) {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(title)}</dc:title><dc:creator>Spark Vision</dc:creator><cp:lastModifiedBy>Spark Vision</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

export function buildDocxFromPngPages(pages: DocxImagePage[], title = "Spark Vision Report") {
  if (pages.length === 0) throw new Error("لا توجد صفحات لتصدير Word.");
  const entries: Array<{ path: string; data: Uint8Array }> = [
    { path: "[Content_Types].xml", data: bytesFromString(contentTypesXmlFor(new Set(["png"]), false)) },
    { path: "_rels/.rels", data: bytesFromString(rootRelsXml) },
    { path: "docProps/app.xml", data: bytesFromString(appXml) },
    { path: "docProps/core.xml", data: bytesFromString(coreXml(title)) },
    { path: "word/document.xml", data: bytesFromString(imageBasedDocumentXml(pages)) },
    { path: "word/_rels/document.xml.rels", data: bytesFromString(imageBasedDocumentRelsXml(pages.length)) },
  ];

  pages.forEach((page, index) => {
    entries.push({ path: `word/media/page${index + 1}.png`, data: pngBytesFromDataUrl(page.dataUrl) });
  });

  return buildStoredZip(entries, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}

export function downloadDocxFromPngPages(pages: DocxImagePage[], filename: string, title?: string) {
  const safeFilename = filename.toLowerCase().endsWith(".docx") ? filename : `${filename}.docx`;
  downloadBlob(buildDocxFromPngPages(pages, title), safeFilename);
}

// =============================================================================
// المسار الجديد: تصدير قابل للقراءة والتعديل من DOM الحقيقي
// =============================================================================

export type DocxSheetSource = {
  /** الجذر داخل DOM لصفحة التقرير (عادةً `[data-mv-report-sheet]`). */
  root: HTMLElement;
  /** هل هذه الصفحة بالعرض الأفقي؟ */
  landscape?: boolean;
  /** عنوان اختياري للصفحة (لأغراض metadata). */
  title?: string;
};

type Run = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  /** Hex بدون # */
  color?: string;
  /** Hex بدون # للخلفية */
  highlight?: string;
  /** بنصف نقطة (half-points) - مثلاً 24 = 12pt */
  sizeHalfPoints?: number;
  /** اسم الخط */
  fontFamily?: string;
  /** نص في اتجاه RTL (يقوم Word بترتيب bidi) */
  rtl?: boolean;
};

type ParagraphAlignment = "left" | "right" | "center" | "both" | "distribute";

type ParagraphBlock = {
  kind: "paragraph";
  runs: Run[];
  alignment?: ParagraphAlignment;
  bidi?: boolean;
  level?: number; // 1..6
  indentLeftTwips?: number;
  indentRightTwips?: number;
  spaceBeforeTwips?: number;
  spaceAfterTwips?: number;
  lineHeight240?: number; // معامل (240 = single)
  pageBreakBefore?: boolean;
  /** فقرة كصورة مدرجة inline */
  inlineImage?: { rId: string; widthEmu: number; heightEmu: number; nameId: number };
  /** خصائص section (تُلصق بآخر فقرة في القسم) */
  sectionProps?: SectionProps;
};

type CellSpan = "restart" | "continue";

type TableCellBlock = {
  blocks: ParagraphBlock[];
  widthTwips?: number;
  gridSpan?: number;
  vMerge?: CellSpan;
  background?: string;
  verticalAlign?: "top" | "center" | "bottom";
};

type TableRowBlock = {
  cells: TableCellBlock[];
  heightTwips?: number;
  isHeader?: boolean;
};

type TableBlock = {
  kind: "table";
  rows: TableRowBlock[];
  colWidthsTwips: number[];
  totalWidthTwips: number;
  bidi?: boolean;
};

type SectionProps = {
  landscape?: boolean;
  type?: "nextPage" | "continuous";
};

type DocBlock = ParagraphBlock | TableBlock;

type ImageEntry = {
  rId: string;
  filename: string;
  extension: "png" | "jpeg" | "gif";
  data: Uint8Array;
};

// ---------- استخراج DOM ----------

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === 1;
}

function isText(node: Node): node is Text {
  return node.nodeType === 3;
}

function getDisplay(el: HTMLElement): string {
  try {
    return window.getComputedStyle(el).display;
  } catch {
    return "";
  }
}

const INLINE_DISPLAY_VALUES = new Set([
  "inline",
  "inline-block",
  "inline-flex",
  "ruby",
  "contents",
]);

function isBlockLike(el: HTMLElement, display: string) {
  if (!display) return false;
  if (display === "none") return false;
  if (display.startsWith("table") || display === "list-item" || display === "flex" || display === "grid" || display === "block") {
    return true;
  }
  if (INLINE_DISPLAY_VALUES.has(display)) return false;
  // العناصر الكتلية الافتراضية
  const tag = el.tagName;
  return (
    tag === "P" ||
    tag === "DIV" ||
    tag === "SECTION" ||
    tag === "ARTICLE" ||
    tag === "HEADER" ||
    tag === "FOOTER" ||
    tag === "ASIDE" ||
    tag === "NAV" ||
    tag === "MAIN" ||
    tag === "LI" ||
    tag === "UL" ||
    tag === "OL" ||
    tag === "FIGURE" ||
    tag === "FIGCAPTION" ||
    tag === "BLOCKQUOTE" ||
    tag === "HR" ||
    /^H[1-6]$/.test(tag)
  );
}

/** هل العنصر مخفي بصرياً (لا يجب تصديره)؟ */
function isElementHidden(el: HTMLElement): boolean {
  if (el.getAttribute("aria-hidden") === "true") return true;
  if (el.hasAttribute("hidden")) return true;
  if (el.classList.contains("mv-report-chrome")) return true;
  if (el.hasAttribute("data-mv-report-letterhead-background")) return true;
  try {
    const style = window.getComputedStyle(el);
    if (style.display === "none") return true;
    if (style.visibility === "hidden" || style.visibility === "collapse") return true;
    const opacity = parseFloat(style.opacity || "1");
    if (Number.isFinite(opacity) && opacity < 0.05) return true;
  } catch {
    /* ignore */
  }
  // مكونات زخرفية: مطلقة الموضع + بدون نص ولا صور
  return false;
}

/** هل العنصر زخرفة مطلقة الموضع نريد تجاهلها؟ */
function isPurelyDecorative(el: HTMLElement): boolean {
  if (el.tagName === "IMG") return false;
  if (el.tagName === "TABLE") return false;
  try {
    const style = window.getComputedStyle(el);
    if (style.position !== "absolute" && style.position !== "fixed") return false;
    // لو فيه نص أو صور حقيقية، لا تحذف
    if (el.textContent && el.textContent.trim().length > 0) return false;
    if (el.querySelector("img")) return false;
    return true;
  } catch {
    return false;
  }
}

function pxToTwips(px: number) {
  return Math.round(px * PX_TO_TWIPS);
}

function pxToHalfPoints(px: number) {
  return Math.max(8, Math.round(px * HALF_POINTS_PER_PX));
}

function pxToEmu(px: number) {
  return Math.max(0, Math.round(px * EMU_PER_PX));
}

function rgbToHex(value: string): string | undefined {
  const match = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) return undefined;
  const r = parseInt(match[1]!, 10);
  const g = parseInt(match[2]!, 10);
  const b = parseInt(match[3]!, 10);
  if ([r, g, b].some((v) => Number.isNaN(v))) return undefined;
  return [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function colorFromComputed(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const hex = rgbToHex(value);
  if (!hex) return undefined;
  // اعتبر الأبيض/الأسود الافتراضي بلا لون - يُريح Word ويحافظ على القراءة
  if (hex === "000000") return undefined;
  return hex;
}

function backgroundColorFromComputed(value: string | undefined): string | undefined {
  if (!value) return undefined;
  // rgba(... , 0) → شفاف
  const transparent = value.match(/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(\.0+)?\s*\)$/i);
  if (transparent) return undefined;
  const hex = rgbToHex(value);
  if (!hex) return undefined;
  if (hex === "FFFFFF") return undefined;
  return hex;
}

function alignmentFromTextAlign(value: string | undefined): ParagraphAlignment | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (v === "right" || v === "end") return "right";
  if (v === "left" || v === "start") return "left";
  if (v === "center") return "center";
  if (v === "justify") return "both";
  return undefined;
}

function headingLevelFromTag(tag: string): number | undefined {
  const match = tag.match(/^H([1-6])$/);
  if (!match) return undefined;
  return parseInt(match[1]!, 10);
}

/** يحدد إن كان النص أساساً عربي/RTL */
function hasRtlText(text: string): boolean {
  // النطاقات العربية/العبرية والفارسية/الأردية
  return /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFEFC]/.test(text);
}

// ---------- محمّل الصور (يحول أي صورة إلى bytes) ----------

const imageCache = new Map<string, Promise<ImageEntry | null>>();

function detectImageExtension(mimeType: string | null, src: string): "png" | "jpeg" | "gif" {
  const lowerSrc = src.toLowerCase();
  if (mimeType) {
    if (mimeType.includes("png")) return "png";
    if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpeg";
    if (mimeType.includes("gif")) return "gif";
  }
  if (lowerSrc.includes(".png")) return "png";
  if (lowerSrc.includes(".jpg") || lowerSrc.includes(".jpeg")) return "jpeg";
  if (lowerSrc.includes(".gif")) return "gif";
  return "png";
}

async function fetchImageAsEntry(src: string, rId: string, filename: string): Promise<ImageEntry | null> {
  if (!src) return null;
  // data:URL مباشرة
  if (src.startsWith("data:")) {
    const match = src.match(/^data:([^;,]+)?(?:;[^,]*)?,(.*)$/i);
    if (!match) return null;
    const mime = (match[1] || "image/png").toLowerCase();
    const payload = match[2] || "";
    const ext = detectImageExtension(mime, src);
    try {
      const bytes = src.includes(";base64,")
        ? bytesFromBase64(payload)
        : bytesFromString(decodeURIComponent(payload));
      return { rId, filename: `${filename}.${ext}`, extension: ext, data: bytes };
    } catch {
      return null;
    }
  }
  // URL خارجي/داخلي عبر fetch
  try {
    const response = await fetch(src, { credentials: "include", mode: "cors" });
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const ext = detectImageExtension(response.headers.get("Content-Type"), src);
    return { rId, filename: `${filename}.${ext}`, extension: ext, data: new Uint8Array(buffer) };
  } catch {
    // محاولة احتياطية: عبر canvas (تتطلب CORS متاحاً)
    try {
      const dataUrl = await loadImageToDataUrlViaCanvas(src);
      if (!dataUrl) return null;
      return fetchImageAsEntry(dataUrl, rId, filename);
    } catch {
      return null;
    }
  }
}

function loadImageToDataUrlViaCanvas(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 1;
        canvas.height = img.naturalHeight || 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        try {
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function getImageEntry(src: string, rId: string, filename: string): Promise<ImageEntry | null> {
  if (!src) return null;
  const cacheKey = `${src}::${rId}`;
  if (!imageCache.has(cacheKey)) {
    imageCache.set(cacheKey, fetchImageAsEntry(src, rId, filename));
  }
  return imageCache.get(cacheKey)!;
}

// ---------- المعالج الرئيسي ----------

type WalkContext = {
  blocks: DocBlock[];
  currentRuns: Run[];
  currentBidi: boolean;
  currentAlignment: ParagraphAlignment | undefined;
  currentLevel: number | undefined;
  styleStack: StyleFrame[];
  imageRequests: Array<{ src: string; widthEmu: number; heightEmu: number; alt: string }>;
  /** أقصى عرض للصور في القسم الحالي (بوحدة EMU) */
  maxImageWidthEmu: number;
};

type StyleFrame = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  superscript: boolean;
  subscript: boolean;
  color?: string;
  highlight?: string;
  sizeHalfPoints?: number;
  fontFamily?: string;
  preserveWhitespace: boolean;
};

function initialStyleFrame(): StyleFrame {
  return {
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    superscript: false,
    subscript: false,
    preserveWhitespace: false,
  };
}

function deriveStyleFromComputed(el: HTMLElement, parent: StyleFrame): StyleFrame {
  const next: StyleFrame = { ...parent };
  let style: CSSStyleDeclaration | null = null;
  try {
    style = window.getComputedStyle(el);
  } catch {
    style = null;
  }
  if (style) {
    const weight = parseInt(style.fontWeight || "400", 10);
    if (!Number.isNaN(weight) && weight >= 600) next.bold = true;
    if (style.fontStyle === "italic" || style.fontStyle === "oblique") next.italic = true;
    if (style.textDecorationLine?.includes("underline")) next.underline = true;
    if (style.textDecorationLine?.includes("line-through")) next.strike = true;
    if (style.verticalAlign === "super") next.superscript = true;
    if (style.verticalAlign === "sub") next.subscript = true;
    const c = colorFromComputed(style.color);
    if (c) next.color = c;
    // لا نُورِّث «highlight» من background-color الخاص بأي حاوية، وإلا تحوّل كل
    // كلمة داخل عنصر ملوّن إلى تظليل نصي (highlight) في Word مما يُفسد العرض
    // ويُضخّم الملف. نسمح بالتظليل فقط للعلامات الصريحة (mark / data-highlight).
    const fontSizePx = parseFloat(style.fontSize || "0");
    if (Number.isFinite(fontSizePx) && fontSizePx > 0) {
      next.sizeHalfPoints = pxToHalfPoints(fontSizePx);
    }
    const family = style.fontFamily;
    if (family && family.trim()) {
      // أخذ أول خط فقط، وإزالة علامات التنصيص
      const first = family.split(",")[0]!.trim().replace(/^['"]|['"]$/g, "");
      if (first) next.fontFamily = first;
    }
    if (style.whiteSpace === "pre" || style.whiteSpace === "pre-wrap" || style.whiteSpace === "break-spaces") {
      next.preserveWhitespace = true;
    }
  }
  const tag = el.tagName;
  if (tag === "B" || tag === "STRONG") next.bold = true;
  if (tag === "I" || tag === "EM") next.italic = true;
  if (tag === "U") next.underline = true;
  if (tag === "S" || tag === "STRIKE" || tag === "DEL") next.strike = true;
  if (tag === "SUP") next.superscript = true;
  if (tag === "SUB") next.subscript = true;
  // التظليل النصي صريح فقط: <mark> أو data-highlight="#hex"
  if (tag === "MARK") {
    const bg = style ? backgroundColorFromComputed(style.backgroundColor) : undefined;
    next.highlight = bg || "FFF59D"; // أصفر تظليل افتراضي
  }
  const explicitHighlight = el.getAttribute("data-highlight");
  if (explicitHighlight) {
    next.highlight = explicitHighlight.replace(/^#/, "").toUpperCase();
  }
  return next;
}

function topStyle(ctx: WalkContext): StyleFrame {
  return ctx.styleStack[ctx.styleStack.length - 1] ?? initialStyleFrame();
}

function appendTextRun(ctx: WalkContext, text: string) {
  if (!text) return;
  const style = topStyle(ctx);
  // تطبيع المسافات إذا لم نكن في وضع preserve
  let processed = text;
  if (!style.preserveWhitespace) {
    processed = processed.replace(/\s+/g, " ");
  }
  // تخطي النص الذي يصبح فارغاً ولا توجد نصوص سابقة في الفقرة
  if (!processed) return;
  if (processed === " " && ctx.currentRuns.length === 0) return;
  const isRtl = hasRtlText(processed);
  if (isRtl) ctx.currentBidi = true;
  ctx.currentRuns.push({
    text: processed,
    bold: style.bold || undefined,
    italic: style.italic || undefined,
    underline: style.underline || undefined,
    strike: style.strike || undefined,
    superscript: style.superscript || undefined,
    subscript: style.subscript || undefined,
    color: style.color,
    highlight: style.highlight,
    sizeHalfPoints: style.sizeHalfPoints,
    fontFamily: style.fontFamily,
    rtl: isRtl,
  });
}

const LINE_BREAK_MARKER = "\u0001LINE_BREAK\u0001";

function appendLineBreak(ctx: WalkContext) {
  ctx.currentRuns.push({ text: LINE_BREAK_MARKER });
}

function flushParagraph(ctx: WalkContext, opts?: {
  alignment?: ParagraphAlignment;
  level?: number;
  bidi?: boolean;
  force?: boolean;
}) {
  // إذا لم يكن هناك runs ولا نطلب إجبار، تجاهل
  const hasRuns = ctx.currentRuns.length > 0;
  if (!hasRuns && !opts?.force) return;
  const para: ParagraphBlock = {
    kind: "paragraph",
    runs: ctx.currentRuns,
    alignment: opts?.alignment ?? ctx.currentAlignment,
    bidi: (opts?.bidi ?? ctx.currentBidi) || undefined,
    level: opts?.level ?? ctx.currentLevel,
  };
  ctx.blocks.push(para);
  ctx.currentRuns = [];
  ctx.currentBidi = false;
  ctx.currentAlignment = undefined;
  ctx.currentLevel = undefined;
}

function pushParagraphBlock(ctx: WalkContext, para: ParagraphBlock) {
  ctx.blocks.push(para);
}

function paragraphPropsFromElement(el: HTMLElement): {
  alignment?: ParagraphAlignment;
  level?: number;
  bidi?: boolean;
} {
  const result: { alignment?: ParagraphAlignment; level?: number; bidi?: boolean } = {};
  const level = headingLevelFromTag(el.tagName);
  if (level) result.level = level;
  try {
    const style = window.getComputedStyle(el);
    const align = alignmentFromTextAlign(style.textAlign);
    if (align) result.alignment = align;
    const dir = style.direction || el.getAttribute("dir") || "";
    if (dir === "rtl") result.bidi = true;
  } catch {
    /* ignore */
  }
  return result;
}

function processImage(ctx: WalkContext, el: HTMLImageElement) {
  const src = el.currentSrc || el.src;
  if (!src) return;
  const rect = el.getBoundingClientRect();
  let widthPx = rect.width || el.naturalWidth || 200;
  let heightPx = rect.height || el.naturalHeight || 150;
  if (widthPx < 1) widthPx = el.naturalWidth || 200;
  if (heightPx < 1) heightPx = el.naturalHeight || 150;
  // تجاهل الأيقونات الزخرفية الصغيرة جداً
  const minPx = Math.min(widthPx, heightPx);
  if (minPx < 16) return;
  // تحجيم لا يتجاوز عرض المحتوى
  const maxEmu = ctx.maxImageWidthEmu || MAX_CONTENT_WIDTH_EMU.portrait;
  let widthEmu = pxToEmu(widthPx);
  let heightEmu = pxToEmu(heightPx);
  if (widthEmu > maxEmu) {
    const ratio = maxEmu / widthEmu;
    widthEmu = maxEmu;
    heightEmu = Math.round(heightEmu * ratio);
  }
  const alt = el.getAttribute("alt") || "image";
  ctx.imageRequests.push({ src, widthEmu, heightEmu, alt });
  const nameId = ctx.imageRequests.length;
  const rId = `imgRel${nameId}`;
  // نضع الصورة كفقرة مستقلة لتظهر بشكل مرتب وقابلة للتعديل
  flushParagraph(ctx);
  pushParagraphBlock(ctx, {
    kind: "paragraph",
    runs: [],
    alignment: "center",
    inlineImage: { rId, widthEmu, heightEmu, nameId },
  });
}

function processTable(ctx: WalkContext, el: HTMLTableElement) {
  flushParagraph(ctx);
  const rows: TableRowBlock[] = [];
  const tableRect = el.getBoundingClientRect();
  // اجمع كل خلية في كل صف (نتجاهل colspan/rowspan المعقدة لكن ندعم gridSpan الأساسي)
  const trList = Array.from(el.querySelectorAll<HTMLTableRowElement>("tr"));
  if (trList.length === 0) return;
  // حدد أعمدة الجدول من أكبر صف
  const maxCols = trList.reduce((max, tr) => {
    const cells = Array.from(tr.children).filter(
      (c): c is HTMLTableCellElement => c.tagName === "TD" || c.tagName === "TH",
    );
    const total = cells.reduce((s, c) => s + Math.max(1, c.colSpan || 1), 0);
    return Math.max(max, total);
  }, 0);
  if (maxCols === 0) return;
  // قياس عرض الجدول الإجمالي (بالـ twips)، مقيّداً بأقصى عرض محتوى
  const sectionLandscape = ctx.maxImageWidthEmu === MAX_CONTENT_WIDTH_EMU.landscape;
  const maxTableTwips = sectionLandscape
    ? MAX_CONTENT_WIDTH_TWIPS.landscape
    : MAX_CONTENT_WIDTH_TWIPS.portrait;
  let totalWidthTwips = pxToTwips(tableRect.width || 0);
  if (totalWidthTwips <= 0 || totalWidthTwips > maxTableTwips) {
    totalWidthTwips = maxTableTwips;
  }
  // اجمع عرض كل عمود من الصف الأول (الأكثر شيوعاً) أو نوزع بالتساوي
  const firstFullRow = trList.find((tr) => {
    const cells = Array.from(tr.children).filter(
      (c): c is HTMLTableCellElement => c.tagName === "TD" || c.tagName === "TH",
    );
    const total = cells.reduce((s, c) => s + Math.max(1, c.colSpan || 1), 0);
    return total === maxCols;
  }) || trList[0]!;
  let colWidthsTwips: number[] = new Array(maxCols).fill(Math.floor(totalWidthTwips / maxCols));
  const cellsFirst = Array.from(firstFullRow.children).filter(
    (c): c is HTMLTableCellElement => c.tagName === "TD" || c.tagName === "TH",
  );
  if (cellsFirst.length > 0) {
    const widths: number[] = [];
    let colCursor = 0;
    for (const cell of cellsFirst) {
      const span = Math.max(1, cell.colSpan || 1);
      const cellRect = cell.getBoundingClientRect();
      let cellTwips = pxToTwips(cellRect.width || 0);
      if (cellTwips <= 0) cellTwips = Math.floor(totalWidthTwips / maxCols) * span;
      const perCol = Math.floor(cellTwips / span);
      for (let i = 0; i < span; i += 1) {
        widths[colCursor + i] = perCol;
      }
      colCursor += span;
    }
    while (widths.length < maxCols) widths.push(Math.floor(totalWidthTwips / maxCols));
    const sum = widths.reduce((s, v) => s + v, 0);
    if (sum > 0) {
      // تطبيع لإجمالي عرض الجدول
      const scale = totalWidthTwips / sum;
      colWidthsTwips = widths.map((w) => Math.max(360, Math.round(w * scale)));
    }
  }

  let bidi = false;
  for (const tr of trList) {
    const cells = Array.from(tr.children).filter(
      (c): c is HTMLTableCellElement => c.tagName === "TD" || c.tagName === "TH",
    );
    if (cells.length === 0) continue;
    const cellBlocks: TableCellBlock[] = [];
    let colCursor = 0;
    for (const cell of cells) {
      const span = Math.max(1, cell.colSpan || 1);
      const cellCtx: WalkContext = {
        blocks: [],
        currentRuns: [],
        currentBidi: false,
        currentAlignment: undefined,
        currentLevel: undefined,
        styleStack: [deriveStyleFromComputed(cell, topStyle(ctx))],
        imageRequests: ctx.imageRequests,
        maxImageWidthEmu: ctx.maxImageWidthEmu,
      };
      // طبق محاذاة الخلية تلقائياً
      const cellProps = paragraphPropsFromElement(cell);
      if (cellProps.alignment) cellCtx.currentAlignment = cellProps.alignment;
      if (cellProps.bidi) {
        cellCtx.currentBidi = true;
        bidi = true;
      }
      walkChildren(cell, cellCtx);
      flushParagraph(cellCtx);
      // ضمان وجود فقرة واحدة على الأقل في كل خلية
      const cellBlocksOnly = cellCtx.blocks.filter((b): b is ParagraphBlock => b.kind === "paragraph");
      if (cellBlocksOnly.length === 0) {
        cellBlocksOnly.push({ kind: "paragraph", runs: [] });
      }
      let widthTwips = 0;
      for (let i = 0; i < span; i += 1) {
        widthTwips += colWidthsTwips[colCursor + i] ?? 0;
      }
      let background: string | undefined;
      let verticalAlign: TableCellBlock["verticalAlign"];
      try {
        const cellStyle = window.getComputedStyle(cell);
        background = backgroundColorFromComputed(cellStyle.backgroundColor);
        const va = cellStyle.verticalAlign;
        if (va === "top") verticalAlign = "top";
        else if (va === "bottom") verticalAlign = "bottom";
        else verticalAlign = "center";
      } catch {
        verticalAlign = "center";
      }
      cellBlocks.push({
        blocks: cellBlocksOnly,
        widthTwips,
        gridSpan: span,
        background,
        verticalAlign,
      });
      colCursor += span;
    }
    rows.push({ cells: cellBlocks, isHeader: tr.parentElement?.tagName === "THEAD" || cells.every((c) => c.tagName === "TH") });
  }
  if (rows.length === 0) return;
  ctx.blocks.push({
    kind: "table",
    rows,
    colWidthsTwips,
    totalWidthTwips,
    bidi: bidi || undefined,
  });
}

function walkChildren(parent: Node, ctx: WalkContext) {
  for (let i = 0; i < parent.childNodes.length; i += 1) {
    const node = parent.childNodes[i]!;
    if (isText(node)) {
      appendTextRun(ctx, node.textContent || "");
      continue;
    }
    if (!isElement(node)) continue;
    walkElement(node, ctx);
  }
}

function walkElement(el: HTMLElement, ctx: WalkContext) {
  if (isElementHidden(el)) return;
  if (isPurelyDecorative(el)) return;
  const tag = el.tagName;

  if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT" || tag === "BUTTON" || tag === "SVG" || tag === "CANVAS" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    // إدخالات النموذج: استخرج القيمة كنص
    if (tag === "INPUT") {
      const input = el as HTMLInputElement;
      const t = (input.type || "text").toLowerCase();
      if (t !== "checkbox" && t !== "radio" && t !== "hidden" && t !== "button" && t !== "submit") {
        appendTextRun(ctx, input.value || "");
      }
    } else if (tag === "TEXTAREA") {
      appendTextRun(ctx, (el as HTMLTextAreaElement).value || "");
    } else if (tag === "SELECT") {
      const sel = el as HTMLSelectElement;
      const opt = sel.options[sel.selectedIndex];
      if (opt) appendTextRun(ctx, opt.text || "");
    }
    return;
  }

  if (tag === "BR") {
    appendLineBreak(ctx);
    return;
  }

  if (tag === "HR") {
    flushParagraph(ctx);
    pushParagraphBlock(ctx, {
      kind: "paragraph",
      runs: [{ text: "—".repeat(20), color: "BFBFBF" }],
      alignment: "center",
    });
    return;
  }

  if (tag === "IMG") {
    processImage(ctx, el as HTMLImageElement);
    return;
  }

  if (tag === "TABLE") {
    processTable(ctx, el as HTMLTableElement);
    return;
  }

  // ادفع style frame جديد
  const nextFrame = deriveStyleFromComputed(el, topStyle(ctx));
  ctx.styleStack.push(nextFrame);

  const display = getDisplay(el);
  const blockLike = isBlockLike(el, display);

  if (blockLike) {
    // اغلق الفقرة الحالية أولاً
    flushParagraph(ctx);
    const props = paragraphPropsFromElement(el);
    const prevAlignment = ctx.currentAlignment;
    const prevLevel = ctx.currentLevel;
    const prevBidi = ctx.currentBidi;
    if (props.alignment) ctx.currentAlignment = props.alignment;
    if (props.level) ctx.currentLevel = props.level;
    if (props.bidi) ctx.currentBidi = true;
    walkChildren(el, ctx);
    flushParagraph(ctx);
    ctx.currentAlignment = prevAlignment;
    ctx.currentLevel = prevLevel;
    ctx.currentBidi = prevBidi;
  } else {
    walkChildren(el, ctx);
  }

  ctx.styleStack.pop();
}

// ---------- توليد OOXML ----------

function runXml(run: Run, defaultBidi: boolean): string {
  if (run.text === LINE_BREAK_MARKER) {
    return `<w:r><w:br/></w:r>`;
  }
  if (!run.text) return "";
  // ترتيب عناصر <w:rPr> يجب أن يتبع تسلسل ECMA-376 (CT_RPr) وإلا اعتبر Word الملف تالفاً.
  // التسلسل: rFonts → b/bCs → i/iCs → strike → color → sz/szCs → u → shd → vertAlign → rtl
  const rPr: string[] = [];
  if (run.fontFamily) {
    const font = xmlEscape(run.fontFamily);
    rPr.push(`<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/>`);
  }
  if (run.bold) rPr.push("<w:b/>", "<w:bCs/>");
  if (run.italic) rPr.push("<w:i/>", "<w:iCs/>");
  if (run.strike) rPr.push("<w:strike/>");
  if (run.color) rPr.push(`<w:color w:val="${run.color}"/>`);
  if (run.sizeHalfPoints) {
    rPr.push(`<w:sz w:val="${run.sizeHalfPoints}"/>`, `<w:szCs w:val="${run.sizeHalfPoints}"/>`);
  }
  if (run.underline) rPr.push('<w:u w:val="single"/>');
  if (run.highlight) rPr.push(`<w:shd w:val="clear" w:color="auto" w:fill="${run.highlight}"/>`);
  if (run.superscript) rPr.push('<w:vertAlign w:val="superscript"/>');
  if (run.subscript) rPr.push('<w:vertAlign w:val="subscript"/>');
  if (run.rtl || defaultBidi) rPr.push("<w:rtl/>");
  const rPrXml = rPr.length ? `<w:rPr>${rPr.join("")}</w:rPr>` : "";
  // قد يحتوي النص على فواصل أسطر متعددة في حال preserve - نقسمها
  if (run.text.includes("\n")) {
    const parts = run.text.split("\n");
    const inner = parts
      .map((part, i) => {
        const escaped = xmlEscape(part);
        const seg = escaped ? `<w:t xml:space="preserve">${escaped}</w:t>` : "";
        return i < parts.length - 1 ? `${seg}<w:br/>` : seg;
      })
      .join("");
    return `<w:r>${rPrXml}${inner}</w:r>`;
  }
  const escaped = xmlEscape(run.text);
  return `<w:r>${rPrXml}<w:t xml:space="preserve">${escaped}</w:t></w:r>`;
}

function inlineDrawingXml(rId: string, widthEmu: number, heightEmu: number, nameId: number, alt = ""): string {
  const title = xmlEscape(alt || `Image ${nameId}`);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${nameId}" name="${title}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${nameId}" name="${title}.png"/><pic:cNvPicPr><a:picLocks noChangeAspect="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

function sectionPrXml(props: SectionProps): string {
  const landscape = Boolean(props.landscape);
  const twips = landscape ? A4_LANDSCAPE_TWIPS : A4_PORTRAIT_TWIPS;
  const m = DEFAULT_MARGIN_TWIPS;
  return `<w:sectPr>${props.type ? `<w:type w:val="${props.type}"/>` : ""}<w:pgSz w:w="${twips.w}" w:h="${twips.h}"${landscape ? ' w:orient="landscape"' : ""}/><w:pgMar w:top="${m.top}" w:right="${m.right}" w:bottom="${m.bottom}" w:left="${m.left}" w:header="${m.header}" w:footer="${m.footer}" w:gutter="0"/><w:cols w:space="708"/><w:bidi/><w:docGrid w:linePitch="360"/></w:sectPr>`;
}

function paragraphXml(p: ParagraphBlock, defaultBidi: boolean): string {
  // ترتيب عناصر <w:pPr> يجب أن يتبع تسلسل ECMA-376 (CT_PPr):
  // pStyle → pageBreakBefore → bidi → spacing → ind → jc → sectPr
  const pPr: string[] = [];
  if (p.level) {
    pPr.push(`<w:pStyle w:val="Heading${Math.min(6, p.level)}"/>`);
  }
  if (p.pageBreakBefore) pPr.push("<w:pageBreakBefore/>");
  const isBidi = (p.bidi ?? defaultBidi) === true;
  if (isBidi) pPr.push("<w:bidi/>");
  if (p.spaceBeforeTwips || p.spaceAfterTwips || p.lineHeight240) {
    const parts: string[] = [];
    if (p.spaceBeforeTwips != null) parts.push(`w:before="${p.spaceBeforeTwips}"`);
    if (p.spaceAfterTwips != null) parts.push(`w:after="${p.spaceAfterTwips}"`);
    if (p.lineHeight240) parts.push(`w:line="${p.lineHeight240}"`, `w:lineRule="auto"`);
    pPr.push(`<w:spacing ${parts.join(" ")}/>`);
  }
  if (p.indentLeftTwips || p.indentRightTwips) {
    const parts: string[] = [];
    if (p.indentLeftTwips) parts.push(`w:left="${p.indentLeftTwips}"`);
    if (p.indentRightTwips) parts.push(`w:right="${p.indentRightTwips}"`);
    pPr.push(`<w:ind ${parts.join(" ")}/>`);
  }
  if (p.alignment) pPr.push(`<w:jc w:val="${p.alignment}"/>`);
  if (p.sectionProps) {
    pPr.push(sectionPrXml(p.sectionProps));
  }
  const pPrXml = pPr.length ? `<w:pPr>${pPr.join("")}</w:pPr>` : "";

  let runsXml = "";
  if (p.inlineImage) {
    runsXml = inlineDrawingXml(p.inlineImage.rId, p.inlineImage.widthEmu, p.inlineImage.heightEmu, p.inlineImage.nameId);
  } else {
    runsXml = p.runs.map((r) => runXml(r, isBidi)).join("");
  }
  return `<w:p>${pPrXml}${runsXml}</w:p>`;
}

function tableXml(t: TableBlock, defaultBidi: boolean): string {
  const isBidi = t.bidi ?? defaultBidi;
  const grid = t.colWidthsTwips
    .map((w) => `<w:gridCol w:w="${w}"/>`)
    .join("");
  // ترتيب عناصر <w:tblPr> يجب أن يتبع تسلسل ECMA-376 (CT_TblPr):
  // bidiVisual → tblW → jc → tblBorders → tblLayout → tblLook
  const tblPr = `<w:tblPr>${isBidi ? "<w:bidiVisual/>" : ""}<w:tblW w:w="${t.totalWidthTwips}" w:type="dxa"/><w:jc w:val="${isBidi ? "right" : "left"}"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:left w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:right w:val="single" w:sz="4" w:space="0" w:color="999999"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="CCCCCC"/></w:tblBorders><w:tblLayout w:type="fixed"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>`;
  const grids = `<w:tblGrid>${grid}</w:tblGrid>`;
  const rowsXml = t.rows
    .map((row) => {
      const cellsXml = row.cells
        .map((cell) => {
          const props: string[] = [];
          if (cell.widthTwips) props.push(`<w:tcW w:w="${cell.widthTwips}" w:type="dxa"/>`);
          if (cell.gridSpan && cell.gridSpan > 1) props.push(`<w:gridSpan w:val="${cell.gridSpan}"/>`);
          if (cell.background) props.push(`<w:shd w:val="clear" w:color="auto" w:fill="${cell.background}"/>`);
          if (cell.verticalAlign) props.push(`<w:vAlign w:val="${cell.verticalAlign}"/>`);
          const tcPr = props.length ? `<w:tcPr>${props.join("")}</w:tcPr>` : "";
          const blocksXml = cell.blocks.map((b) => paragraphXml(b, isBidi)).join("");
          return `<w:tc>${tcPr}${blocksXml || `<w:p/>`}</w:tc>`;
        })
        .join("");
      const trPr = row.isHeader ? `<w:trPr><w:tblHeader/></w:trPr>` : "";
      return `<w:tr>${trPr}${cellsXml}</w:tr>`;
    })
    .join("");
  return `<w:tbl>${tblPr}${grids}${rowsXml}</w:tbl>`;
}

function blockXml(b: DocBlock, defaultBidi: boolean): string {
  if (b.kind === "paragraph") return paragraphXml(b, defaultBidi);
  return tableXml(b, defaultBidi);
}

// ---------- بناء المستند بالكامل ----------

const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" mc:Ignorable="w14">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Arial" w:eastAsia="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:lang w:val="ar-SA" w:eastAsia="ar-SA" w:bidi="ar-SA"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:bidi/>
        <w:spacing w:after="120" w:line="276" w:lineRule="auto"/>
        <w:jc w:val="right"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:color w:val="0C447C"/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="200" w:after="100"/><w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:color w:val="0C447C"/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="Heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="160" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:color w:val="0C447C"/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading4">
    <w:name w:val="Heading 4"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="120" w:after="60"/><w:outlineLvl w:val="3"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:color w:val="1F4E79"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading5">
    <w:name w:val="Heading 5"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="100" w:after="60"/><w:outlineLvl w:val="4"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading6">
    <w:name w:val="Heading 6"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="80" w:after="40"/><w:outlineLvl w:val="5"/></w:pPr>
    <w:rPr><w:b/><w:bCs/><w:i/><w:iCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>
  </w:style>
</w:styles>`;

export async function buildDocxFromSheets(
  sheets: DocxSheetSource[],
  options: { title?: string } = {},
): Promise<Blob> {
  if (sheets.length === 0) {
    throw new Error("لا توجد صفحات لتصدير Word.");
  }

  const allBlocks: DocBlock[] = [];
  let lastLandscape = false;
  const globalImageRequests: WalkContext["imageRequests"] = [];

  for (let s = 0; s < sheets.length; s += 1) {
    const sheet = sheets[s]!;
    const landscape = Boolean(sheet.landscape);
    lastLandscape = landscape;
    const ctx: WalkContext = {
      blocks: [],
      currentRuns: [],
      currentBidi: false,
      currentAlignment: undefined,
      currentLevel: undefined,
      styleStack: [initialStyleFrame()],
      imageRequests: globalImageRequests,
      maxImageWidthEmu: landscape ? MAX_CONTENT_WIDTH_EMU.landscape : MAX_CONTENT_WIDTH_EMU.portrait,
    };
    walkChildren(sheet.root, ctx);
    flushParagraph(ctx);

    // ضمان وجود فقرة واحدة على الأقل لكل صفحة (لأن sectionPr يجب أن تكون مرفقة بفقرة)
    if (ctx.blocks.length === 0) {
      ctx.blocks.push({ kind: "paragraph", runs: [] });
    }

    allBlocks.push(...ctx.blocks);

    // إذا لم تكن آخر صفحة، أضف فقرة فارغة في نهاية الصفحة تحمل sectionProps.
    // الفقرة الفارغة في الأسفل تضمن أن أي جدول في نهاية الصفحة لا "يتسرب" إلى القسم التالي،
    // لأن sectPr في OOXML تنطبق فقط على المحتوى السابق ومُتضمَّناً الفقرة التي تحملها.
    const isLast = s === sheets.length - 1;
    if (!isLast) {
      allBlocks.push({
        kind: "paragraph",
        runs: [],
        sectionProps: { landscape, type: "nextPage" },
      });
    }
  }

  // اجلب الصور
  const imageEntries: Array<{ rId: string; filename: string; bytes: Uint8Array; extension: string }> = [];
  for (let i = 0; i < globalImageRequests.length; i += 1) {
    const req = globalImageRequests[i]!;
    const rId = `imgRel${i + 1}`;
    const baseFilename = `image${i + 1}`;
    let entry = await getImageEntry(req.src, rId, baseFilename);
    if (!entry) {
      // محاولة احتياطية أخيرة عبر canvas
      try {
        const dataUrl = await loadImageToDataUrlViaCanvas(req.src);
        if (dataUrl) entry = await fetchImageAsEntry(dataUrl, rId, baseFilename);
      } catch {
        entry = null;
      }
    }
    if (entry) {
      imageEntries.push({ rId, filename: entry.filename, bytes: entry.data, extension: entry.extension });
    } else {
      // أنشئ صورة شفافة بسيطة (placeholder) بدلاً من كسر الملف
      const placeholder = createTransparentPngBytes();
      imageEntries.push({ rId, filename: `${baseFilename}.png`, bytes: placeholder, extension: "png" });
    }
  }

  // أزل أي إشارات إلى صور لم تتحمل (في حالة فشل تام)؛ لكن مع placeholder لن تظل الإشارة معطلة.
  // اضمن أن جميع المراجع المستخدمة في paragraphXml موجودة في imageEntries (نفس الترتيب).

  const blocksBodyXml = allBlocks.map((b) => blockXml(b, true)).join("");
  const finalSectionXml = sectionPrXml({ landscape: lastLandscape });

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${OOXML_NAMESPACES}><w:body>${blocksBodyXml}${finalSectionXml}</w:body></w:document>`;

  // علاقات المستند
  const docRelsParts: string[] = [
    `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
  ];
  for (const ent of imageEntries) {
    docRelsParts.push(
      `<Relationship Id="${ent.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${ent.filename}"/>`,
    );
  }
  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${docRelsParts.join("")}</Relationships>`;

  const extensions = new Set<string>(["png"]);
  for (const ent of imageEntries) extensions.add(ent.extension);

  const entries: Array<{ path: string; data: Uint8Array }> = [
    { path: "[Content_Types].xml", data: bytesFromString(contentTypesXmlFor(extensions, true)) },
    { path: "_rels/.rels", data: bytesFromString(rootRelsXml) },
    { path: "docProps/app.xml", data: bytesFromString(appXml) },
    { path: "docProps/core.xml", data: bytesFromString(coreXml(options.title || "Spark Vision Report")) },
    { path: "word/styles.xml", data: bytesFromString(stylesXml) },
    { path: "word/document.xml", data: bytesFromString(documentXml) },
    { path: "word/_rels/document.xml.rels", data: bytesFromString(docRelsXml) },
  ];

  for (const ent of imageEntries) {
    entries.push({ path: `word/media/${ent.filename}`, data: ent.bytes });
  }

  return buildStoredZip(entries, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
}

export async function downloadDocxFromSheets(
  sheets: DocxSheetSource[],
  filename: string,
  options: { title?: string } = {},
): Promise<void> {
  const safeFilename = filename.toLowerCase().endsWith(".docx") ? filename : `${filename}.docx`;
  const blob = await buildDocxFromSheets(sheets, options);
  downloadBlob(blob, safeFilename);
}

/** PNG شفافة 1×1 - placeholder عند فشل تحميل صورة. */
function createTransparentPngBytes(): Uint8Array {
  // PNG ثابتة معروفة 1x1 شفافة
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  return bytesFromBase64(base64);
}
