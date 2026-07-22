import PizZip from "pizzip";
import { isValidImageBytes } from "./docx-validate";
import {
  buildImageCellFromTemplate,
  buildImageParagraphFromTemplate,
  extractImageRunTemplate,
} from "./docx-image-template";
import { ensureDocumentDrawingNamespaces } from "./docx-xml-namespaces";
import { repairWordXml } from "./docx-xml-utils";
import { validatePartBeforeWrite } from "./docx-package-validate";
import { resolveImageBookmarkDef } from "./bookmarks";
import { yieldToMain } from "./docx-yield";
import type { MvWordMergeImageItem } from "./build-context";
import type { MvWordMergeInput } from "./build-context";
import {
  findBookmarkRanges,
  findImageBookmarkReplaceRegion,
  type MvWordBookmarkMergeStats,
} from "./docx-bookmark-shared";

const DOCUMENT_PATH = "word/document.xml";
const REls_PATH = "word/_rels/document.xml.rels";
const CONTENT_TYPES_PATH = "[Content_Types].xml";

const ASSET_IMAGE_CX = 1900000;
const ASSET_IMAGE_CY = 1420000;
const EMU_PER_TWIP = 635;
const DEFAULT_PAGE_WIDTH_TWIPS = 11906;
const DEFAULT_PAGE_MARGIN_TWIPS = 1440;
const ASSET_IMAGE_GAP_TWIPS = 15;
const VALUATION_IMAGE_PAGE_WIDTH_RATIO = 0.9;
const VALUATION_IMAGE_RTL_RIGHT_MARGIN_RATIO = 0.03;
const VALUATION_IMAGE_FALLBACK_ASPECT_RATIO = 0.72;
const IMAGE_RASTER_MAX_SIDE = 1800;
const VALUATION_IMAGE_RASTER_MAX_SIDE = 4000;
const VALUATION_IMAGE_MAX_BYTES = 8_000_000;

function ensureRelationshipsFile(zip: PizZip): string {
  const existing = zip.file(REls_PATH)?.asText();
  if (existing?.trim()) return existing;
  const empty =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  zip.file(REls_PATH, empty);
  return empty;
}

function nextRelationshipId(relsXml: string): string {
  const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1] ?? 0));
  return `rId${(ids.length > 0 ? Math.max(...ids) : 0) + 1}`;
}

function nextMediaPath(zip: PizZip): string {
  const names = Object.keys(zip.files).filter((n) => /^word\/media\/image\d+\.[a-z]+$/i.test(n));
  const numbers = names.map((n) => Number(n.match(/image(\d+)/i)?.[1] ?? 0));
  return `word/media/image${(numbers.length > 0 ? Math.max(...numbers) : 0) + 1}.jpeg`;
}

function nextDrawingDocPrId(documentXml: string): number {
  const ids = [
    ...documentXml.matchAll(/\bwp:docPr\b[^>]*?\bid="(\d+)"/g),
    ...documentXml.matchAll(/\bpic:cNvPr\b[^>]*?\bid="(\d+)"/g),
  ].map((m) => Number(m[1] ?? 0));
  return (ids.length > 0 ? Math.max(...ids) : 0) + 100;
}

function ensureContentTypesForMedia(zip: PizZip, mediaPath: string): void {
  const xml = zip.file(CONTENT_TYPES_PATH)?.asText();
  if (!xml) return;
  const partName = `/${mediaPath.replace(/\\/g, "/")}`;
  if (xml.includes(`PartName="${partName}"`)) return;

  let updated = xml;
  if (!/Extension="jpeg"/i.test(updated)) {
    updated = updated.replace(
      "</Types>",
      '<Default Extension="jpeg" ContentType="image/jpeg"/></Types>',
    );
  }
  updated = updated.replace(
    "</Types>",
    `<Override PartName="${partName}" ContentType="image/jpeg"/></Types>`,
  );
  zip.file(CONTENT_TYPES_PATH, updated);
}

function twipsToEmu(value: number): number {
  return Math.round(value * EMU_PER_TWIP);
}

function readWAttr(xml: string | undefined, name: string, fallback: number): number {
  if (!xml) return fallback;
  const pattern = new RegExp(`\\bw:${name}="(-?\\d+)"`);
  const value = Number(xml.match(pattern)?.[1]);
  return Number.isFinite(value) ? value : fallback;
}

function firstMatchValue(xml: string, pattern: RegExp): string | undefined {
  return xml.match(pattern)?.[0];
}

function lastMatchValue(xml: string, pattern: RegExp): string | undefined {
  let value: string | undefined;
  for (const match of xml.matchAll(pattern)) {
    value = match[0];
  }
  return value;
}

function sectionXmlAtOrAfter(documentXml: string, offset: number): string {
  const after = documentXml.slice(Math.max(0, offset));
  return (
    firstMatchValue(after, /<w:sectPr\b[\s\S]*?<\/w:sectPr>/) ??
    firstMatchValue(after, /<w:sectPr\b[^>]*\/>/) ??
    lastMatchValue(documentXml, /<w:sectPr\b[\s\S]*?<\/w:sectPr>/g) ??
    lastMatchValue(documentXml, /<w:sectPr\b[^>]*\/>/g) ??
    ""
  );
}

function documentPageMetricsTwips(documentXml: string): {
  pageWidth: number;
  marginLeft: number;
  marginRight: number;
} {
  const sectionXml = sectionXmlAtOrAfter(documentXml, 0);
  const pageSizeXml = sectionXml.match(/<w:pgSz\b[^>]*\/?>/)?.[0];
  const pageMarginXml = sectionXml.match(/<w:pgMar\b[^>]*\/?>/)?.[0];

  return {
    pageWidth: readWAttr(pageSizeXml, "w", DEFAULT_PAGE_WIDTH_TWIPS),
    marginLeft: readWAttr(pageMarginXml, "left", DEFAULT_PAGE_MARGIN_TWIPS),
    marginRight: readWAttr(pageMarginXml, "right", DEFAULT_PAGE_MARGIN_TWIPS),
  };
}

function valuationImageLayout(documentXml: string, offset: number): {
  cx: number;
  leftIndentTwips: number;
  rightIndentTwips: number;
  startIndentTwips: number;
  endIndentTwips: number;
} {
  const sectionXml = sectionXmlAtOrAfter(documentXml, offset);
  const { pageWidth, marginLeft, marginRight } = documentPageMetricsTwips(sectionXml);
  const targetWidth = Math.max(1, Math.round(pageWidth * VALUATION_IMAGE_PAGE_WIDTH_RATIO));
  const desiredRightMargin = Math.max(0, Math.round(pageWidth * VALUATION_IMAGE_RTL_RIGHT_MARGIN_RATIO));
  const desiredLeftMargin = Math.max(0, pageWidth - targetWidth - desiredRightMargin);
  const leftIndentTwips = desiredLeftMargin - marginLeft;
  const rightIndentTwips = desiredRightMargin - marginRight;

  return {
    cx: twipsToEmu(targetWidth),
    leftIndentTwips,
    rightIndentTwips,
    startIndentTwips: rightIndentTwips,
    endIndentTwips: leftIndentTwips,
  };
}

function valuationImageExtent(
  image: MvWordMergeImageItem,
  targetCx: number,
): { cx: number; cy: number } {
  const width = Number(image.width);
  const height = Number(image.height);
  const aspect =
    Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
      ? height / width
      : VALUATION_IMAGE_FALLBACK_ASPECT_RATIO;
  return {
    cx: targetCx,
    cy: Math.max(1, Math.round(targetCx * aspect)),
  };
}

async function rasterizeImage(
  buffer: ArrayBuffer,
  options?: { highFidelity?: boolean },
): Promise<Uint8Array | null> {
  const rawBytes = new Uint8Array(buffer);
  const highFidelity = options?.highFidelity === true;
  const maxBytes = highFidelity ? VALUATION_IMAGE_MAX_BYTES : 3_000_000;

  if (isValidImageBytes(rawBytes, "jpeg") && rawBytes.byteLength <= maxBytes) {
    return rawBytes;
  }

  if (typeof window === "undefined") {
    return isValidImageBytes(rawBytes, "jpeg") ? rawBytes : null;
  }

  try {
    const blob = new Blob([buffer]);
    const url = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    URL.revokeObjectURL(url);

    const maxSide = highFidelity ? VALUATION_IMAGE_RASTER_MAX_SIDE : IMAGE_RASTER_MAX_SIDE;
    const jpegQuality = highFidelity ? 0.95 : 0.88;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight, 1));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return isValidImageBytes(rawBytes, "jpeg") ? rawBytes : null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const out = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", jpegQuality);
    });
    const bytes = new Uint8Array(await out.arrayBuffer());
    return isValidImageBytes(bytes, "jpeg") ? bytes : null;
  } catch {
    return isValidImageBytes(rawBytes, "jpeg") ? rawBytes : null;
  }
}

async function addImageToPackage(
  zip: PizZip,
  relsXml: string,
  image: MvWordMergeImageItem,
  options?: { highFidelity?: boolean },
): Promise<{ relsXml: string; embedId: string } | null> {
  const bytes = await rasterizeImage(image.image, options);
  if (!bytes) return null;

  const embedId = nextRelationshipId(relsXml);
  const mediaPath = nextMediaPath(zip);
  const mediaTarget = mediaPath.replace(/^word\//, "");
  zip.file(mediaPath, bytes);
  ensureContentTypesForMedia(zip, mediaPath);

  const relationship = `<Relationship Id="${embedId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${mediaTarget}"/>`;
  return {
    relsXml: relsXml.replace("</Relationships>", `${relationship}</Relationships>`),
    embedId,
  };
}

function buildEmptyCell(): string {
  return `<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/><w:tcMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tcMar></w:tcPr><w:p/></w:tc>`;
}

function buildAssetImagesTable(rowsXml: string): string {
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblCellSpacing w:w="${ASSET_IMAGE_GAP_TWIPS}" w:type="dxa"/><w:tblBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid>${rowsXml}</w:tbl>`;
}

async function buildAssetImagesBlock(
  zip: PizZip,
  relsXml: string,
  images: MvWordMergeImageItem[],
  docPrBase: number,
  runTemplate: string,
): Promise<{ block: string; relsXml: string; count: number }> {
  let rels = relsXml;
  let docPrId = docPrBase;
  let count = 0;
  const rows: string[] = [];

  for (let i = 0; i < images.length; i += 3) {
    const chunk = images.slice(i, i + 3);
    const cells: string[] = [];

    for (const image of chunk) {
      const added = await addImageToPackage(zip, rels, image);
      if (!added) {
        cells.push(buildEmptyCell());
        continue;
      }
      rels = added.relsXml;
      cells.push(
        buildImageCellFromTemplate(runTemplate, added.embedId, docPrId, ASSET_IMAGE_CX, ASSET_IMAGE_CY),
      );
      docPrId += 2;
      count += 1;
    }

    while (cells.length < 3) cells.push(buildEmptyCell());
    rows.push(`<w:tr>${cells.join("")}</w:tr>`);
  }

  return { block: buildAssetImagesTable(rows.join("")), relsXml: rels, count };
}

async function buildValuationImagesBlock(
  zip: PizZip,
  relsXml: string,
  images: MvWordMergeImageItem[],
  docPrBase: number,
  runTemplate: string,
  layout: ReturnType<typeof valuationImageLayout>,
): Promise<{ block: string; relsXml: string; count: number }> {
  let rels = relsXml;
  let docPrId = docPrBase;
  let count = 0;
  const parts: string[] = [];

  for (const image of images) {
    const added = await addImageToPackage(zip, rels, image, { highFidelity: true });
    if (!added) continue;
    rels = added.relsXml;
    const extent = valuationImageExtent(image, layout.cx);
    parts.push(
      buildImageParagraphFromTemplate(
        runTemplate,
        added.embedId,
        docPrId,
        extent.cx,
        extent.cy,
        {
          align: "right",
          leftIndentTwips: layout.leftIndentTwips,
          rightIndentTwips: layout.rightIndentTwips,
          startIndentTwips: layout.startIndentTwips,
          endIndentTwips: layout.endIndentTwips,
        },
      ),
    );
    docPrId += 2;
    count += 1;
    await yieldToMain();
  }

  return { block: parts.join(""), relsXml: rels, count };
}

export async function applyImageBookmarksToDocument(
  zip: PizZip,
  documentXml: string,
  input: MvWordMergeInput,
  stats: MvWordBookmarkMergeStats,
  imageRunTemplate: string,
): Promise<{ xml: string; relsXml: string | null }> {
  let xml = ensureDocumentDrawingNamespaces(documentXml);
  const ranges = findBookmarkRanges(xml);

  const imageOps: Array<{
    region: { start: number; end: number };
    layout: "grid3" | "stack";
    field: "assetImages" | "valuationImages" | "clientImages";
    images: MvWordMergeImageItem[];
  }> = [];
  const seenRegions = new Set<string>();

  for (const range of ranges) {
    const imageDef = resolveImageBookmarkDef(range.name);
    if (!imageDef) continue;
    const images =
      imageDef.field === "assetImages"
        ? input.assetImages
        : imageDef.field === "clientImages"
          ? input.clientImages
          : input.valuationImages;
    if (images.length === 0) continue;

    const removePlaceholders = imageDef.field === "assetImages" || imageDef.field === "clientImages";
    const region = findImageBookmarkReplaceRegion(xml, range.startIndex, removePlaceholders);
    if (!region) continue;

    const regionKey = `${region.start}:${region.end}`;
    if (seenRegions.has(regionKey)) continue;

    seenRegions.add(regionKey);
    imageOps.push({ region, layout: imageDef.layout, field: imageDef.field, images });
  }

  if (imageOps.length === 0) return { xml: documentXml, relsXml: null };

  let relsXml = ensureRelationshipsFile(zip);
  let docPrId = nextDrawingDocPrId(xml);
  let relsDirty = false;

  imageOps.sort((a, b) => b.region.start - a.region.start);

  for (const op of imageOps) {
    const valuationLayout = op.layout === "stack" ? valuationImageLayout(xml, op.region.start) : null;
    const built =
      op.layout === "grid3"
        ? await buildAssetImagesBlock(zip, relsXml, op.images, docPrId, imageRunTemplate)
        : await buildValuationImagesBlock(
            zip,
            relsXml,
            op.images,
            docPrId,
            imageRunTemplate,
            valuationLayout ?? valuationImageLayout(xml, op.region.start),
          );

    if (built.count === 0) {
      stats.imageErrors.push("تعذر تحميل بعض الصور.");
      continue;
    }

    relsXml = built.relsXml;
    docPrId += op.images.length * 2 + 1;

    const candidate = repairWordXml(
      xml.slice(0, op.region.start) + built.block + xml.slice(op.region.end),
    );
    const validation = validatePartBeforeWrite(candidate, DOCUMENT_PATH);
    if (!validation.ok) {
      stats.imageErrors.push(validation.error ?? "تعذر إدراج الصور.");
      continue;
    }

    xml = candidate;
    relsDirty = true;
    if (op.field === "assetImages") stats.assetImagesInserted += built.count;
    else if (op.field === "clientImages") stats.clientImagesInserted += built.count;
    else stats.valuationImagesInserted += built.count;
    await yieldToMain();
  }

  return { xml, relsXml: relsDirty ? relsXml : null };
}

export function extractDocumentImageTemplate(documentXml: string): string {
  return extractImageRunTemplate(documentXml);
}
