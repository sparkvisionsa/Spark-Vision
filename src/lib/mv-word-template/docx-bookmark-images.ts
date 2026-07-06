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
const VALUATION_IMAGE_CX = 5500000;
const VALUATION_IMAGE_CY = 4000000;
const IMAGE_RASTER_MAX_SIDE = 1800;

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

async function rasterizeImage(buffer: ArrayBuffer): Promise<Uint8Array | null> {
  const rawBytes = new Uint8Array(buffer);
  if (isValidImageBytes(rawBytes, "jpeg") && rawBytes.byteLength <= 3_000_000) {
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

    const scale = Math.min(1, IMAGE_RASTER_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight, 1));
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
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.88);
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
): Promise<{ relsXml: string; embedId: string } | null> {
  const bytes = await rasterizeImage(image.image);
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
  return `<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr><w:p/></w:tc>`;
}

function buildAssetImagesTable(rowsXml: string): string {
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders><w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/><w:gridCol w:w="3000"/></w:tblGrid>${rowsXml}</w:tbl>`;
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
): Promise<{ block: string; relsXml: string; count: number }> {
  let rels = relsXml;
  let docPrId = docPrBase;
  let count = 0;
  const parts: string[] = [];

  for (const image of images) {
    const added = await addImageToPackage(zip, rels, image);
    if (!added) continue;
    rels = added.relsXml;
    parts.push(
      buildImageParagraphFromTemplate(
        runTemplate,
        added.embedId,
        docPrId,
        VALUATION_IMAGE_CX,
        VALUATION_IMAGE_CY,
        true,
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
    images: MvWordMergeImageItem[];
  }> = [];
  const seenRegions = new Set<string>();

  for (const range of ranges) {
    const imageDef = resolveImageBookmarkDef(range.name);
    if (!imageDef) continue;
    const images = imageDef.field === "assetImages" ? input.assetImages : input.valuationImages;
    if (images.length === 0) continue;

    const removePlaceholders = imageDef.field === "assetImages";
    const region = findImageBookmarkReplaceRegion(xml, range.startIndex, removePlaceholders);
    if (!region) continue;

    const regionKey = `${region.start}:${region.end}`;
    if (seenRegions.has(regionKey)) continue;

    seenRegions.add(regionKey);
    imageOps.push({ region, layout: imageDef.layout, images });
  }

  if (imageOps.length === 0) return { xml: documentXml, relsXml: null };

  let relsXml = ensureRelationshipsFile(zip);
  let docPrId = nextDrawingDocPrId(xml);
  let relsDirty = false;

  imageOps.sort((a, b) => b.region.start - a.region.start);

  for (const op of imageOps) {
    const built =
      op.layout === "grid3"
        ? await buildAssetImagesBlock(zip, relsXml, op.images, docPrId, imageRunTemplate)
        : await buildValuationImagesBlock(zip, relsXml, op.images, docPrId, imageRunTemplate);

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
    if (op.layout === "grid3") stats.assetImagesInserted += built.count;
    else stats.valuationImagesInserted += built.count;
    await yieldToMain();
  }

  return { xml, relsXml: relsDirty ? relsXml : null };
}

export function extractDocumentImageTemplate(documentXml: string): string {
  return extractImageRunTemplate(documentXml);
}
