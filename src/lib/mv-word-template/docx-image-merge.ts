import PizZip from "pizzip";
import { buildFallbackImageParagraphTemplate } from "./docx-default-image";
import { isValidImageBytes, validateWordXmlContent } from "./docx-validate";
import {
  isImageRelationship,
  sanitizeXmlText,
  xmlEscape,
} from "./docx-xml-utils";
import type { MvWordMergeImageItem } from "./build-context";

export type DocxImageMergeStats = {
  assetReplaced: number;
  valuationReplaced: number;
  assetInserted: number;
  valuationInserted: number;
};

type EmbedSlot = {
  embedId: string;
  paragraphIndex: number;
};

const ASSET_SECTION_MARKERS = [
  /صور\s*الأصول/i,
  /صور\s*المعاينة/i,
  /صور\s*الأصل/i,
  /معرض\s*الصور/i,
  /الملحق\s*(?:رقم\s*)?2\b/i,
  /ملحق\s*(?:رقم\s*)?2\b/i,
  /الملحق\s*الثاني/i,
  /صور\s*المشروع/i,
  /الأصول\s*المعاينة/i,
  /صور\s*المعدات/i,
];

const VALUATION_SECTION_MARKERS = [
  /حسابات\s*القيمة/i,
  /حساب\s*القيمة/i,
  /إجراءات\s*التقييم/i,
  /ملاحق\s*الحسابات/i,
  /الملحق\s*(?:رقم\s*)?3\b/i,
  /ملحق\s*(?:رقم\s*)?3\b/i,
  /الملحق\s*الثالث/i,
  /أسلوب\s*السوق/i,
  /أسلوب\s*التكلفة/i,
  /المقارنات\s*السوقية/i,
  /جدول\s*الحسابات/i,
  /معادلات\s*التقييم/i,
];

function extractParagraphs(documentXml: string): string[] {
  return [...documentXml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].map((match) => match[0] ?? "");
}

function extractParagraphText(paragraphXml: string): string {
  const withBreaks = paragraphXml
    .replace(/<w:tab[^/]*\/>/g, " ")
    .replace(/<w:br[^/]*\/>/g, "\n");
  const parts: string[] = [];
  for (const match of withBreaks.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)) {
    parts.push(match[1] ?? "");
  }
  return parts.join("").replace(/\s+/g, " ").trim();
}

function findFirstParagraphIndex(paragraphTexts: string[], patterns: RegExp[]): number {
  for (let index = 0; index < paragraphTexts.length; index += 1) {
    const text = paragraphTexts[index] ?? "";
    if (patterns.some((pattern) => pattern.test(text))) return index;
  }
  return -1;
}

function inferSectionFromContext(paragraphTexts: string[], paragraphIndex: number): "asset" | "valuation" | null {
  const start = Math.max(0, paragraphIndex - 18);
  const context = paragraphTexts.slice(start, paragraphIndex + 1).join("\n");
  if (VALUATION_SECTION_MARKERS.some((pattern) => pattern.test(context))) return "valuation";
  if (ASSET_SECTION_MARKERS.some((pattern) => pattern.test(context))) return "asset";
  return null;
}

function collectImageEmbedIdsInParagraph(paragraphXml: string, relsXml: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const match of paragraphXml.matchAll(/r:embed="(rId\d+)"/g)) {
    const embedId = match[1];
    if (!embedId || seen.has(embedId) || !isImageRelationship(relsXml, embedId)) continue;
    seen.add(embedId);
    ids.push(embedId);
  }

  for (const match of paragraphXml.matchAll(/<v:imagedata\b[^>]*\br:id="(rId\d+)"/g)) {
    const embedId = match[1];
    if (!embedId || seen.has(embedId) || !isImageRelationship(relsXml, embedId)) continue;
    seen.add(embedId);
    ids.push(embedId);
  }

  return ids;
}

function collectEmbedSlots(documentXml: string, relsXml: string): EmbedSlot[] {
  const paragraphs = extractParagraphs(documentXml);
  const seen = new Set<string>();
  const slots: EmbedSlot[] = [];

  paragraphs.forEach((paragraphXml, paragraphIndex) => {
    for (const embedId of collectImageEmbedIdsInParagraph(paragraphXml, relsXml)) {
      if (seen.has(embedId)) continue;
      seen.add(embedId);
      slots.push({ embedId, paragraphIndex });
    }
  });

  return slots;
}

function classifyEmbedSlots(
  documentXml: string,
  slots: EmbedSlot[],
  assetImageCount: number,
  valuationImageCount: number,
): { asset: EmbedSlot[]; valuation: EmbedSlot[] } {
  const paragraphs = extractParagraphs(documentXml);
  const paragraphTexts = paragraphs.map(extractParagraphText);
  const assetAnchor = findFirstParagraphIndex(paragraphTexts, ASSET_SECTION_MARKERS);
  const valuationAnchor = findFirstParagraphIndex(paragraphTexts, VALUATION_SECTION_MARKERS);

  const asset: EmbedSlot[] = [];
  const valuation: EmbedSlot[] = [];
  const unclassified: EmbedSlot[] = [];

  for (const slot of slots) {
    const contextSection = inferSectionFromContext(paragraphTexts, slot.paragraphIndex);
    if (contextSection === "asset") {
      asset.push(slot);
      continue;
    }
    if (contextSection === "valuation") {
      valuation.push(slot);
      continue;
    }

    if (assetAnchor >= 0 && valuationAnchor >= 0) {
      if (slot.paragraphIndex >= valuationAnchor) valuation.push(slot);
      else if (slot.paragraphIndex >= assetAnchor) asset.push(slot);
      else unclassified.push(slot);
      continue;
    }

    if (valuationAnchor >= 0 && slot.paragraphIndex >= valuationAnchor) {
      valuation.push(slot);
      continue;
    }
    if (assetAnchor >= 0 && slot.paragraphIndex >= assetAnchor) {
      asset.push(slot);
      continue;
    }

    unclassified.push(slot);
  }

  const skipLeading = assetAnchor < 0 && valuationAnchor < 0 ? Math.min(2, unclassified.length) : 0;
  const pool = unclassified.slice(skipLeading);

  for (const slot of pool) {
    const assetNeed = Math.max(0, assetImageCount - asset.length);
    const valuationNeed = Math.max(0, valuationImageCount - valuation.length);
    if (assetNeed >= valuationNeed && assetNeed > 0) asset.push(slot);
    else if (valuationNeed > 0) valuation.push(slot);
    else asset.push(slot);
  }

  return { asset, valuation };
}

function getRelationshipTarget(relsXml: string, embedId: string): string | null {
  const forward = relsXml.match(
    new RegExp(`<Relationship\\b[^>]*\\bId="${embedId}"[^>]*\\bTarget="([^"]+)"`, "i"),
  );
  if (forward?.[1]) return forward[1];
  const reverse = relsXml.match(
    new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${embedId}"`, "i"),
  );
  return reverse?.[1] ?? null;
}

function resolveMediaPath(target: string): string {
  const normalized = target.replace(/^\.\//, "");
  if (normalized.startsWith("word/")) return normalized;
  if (normalized.startsWith("/")) return normalized.slice(1);
  return `word/${normalized}`;
}

function mediaExtension(path: string): "jpeg" | "png" | "gif" | "bmp" {
  const ext = path.split(".").pop()?.toLowerCase() ?? "jpeg";
  if (ext === "png") return "png";
  if (ext === "gif") return "gif";
  if (ext === "bmp") return "bmp";
  return "jpeg";
}

async function loadImageElement(buffer: ArrayBuffer): Promise<CanvasImageSource> {
  const blob = new Blob([buffer]);
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      /* fall through */
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("decode"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function rasterizeImage(
  buffer: ArrayBuffer,
  mime: "image/jpeg" | "image/png",
): Promise<Uint8Array | null> {
  if (typeof window === "undefined") {
    const ext = mime === "image/png" ? "png" : "jpeg";
    const bytes = new Uint8Array(buffer);
    return isValidImageBytes(bytes, ext) ? bytes : null;
  }

  try {
    const source = await loadImageElement(buffer);
    const width =
      "naturalWidth" in source
        ? Math.max(1, source.naturalWidth)
        : Math.max(1, (source as ImageBitmap).width);
    const height =
      "naturalHeight" in source
        ? Math.max(1, source.naturalHeight)
        : Math.max(1, (source as ImageBitmap).height);

    const maxSide = 2200;
    const scale = Math.min(1, maxSide / Math.max(width, height, 1));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
    if ("close" in source && typeof source.close === "function") {
      source.close();
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("blob"))),
        mime,
        mime === "image/jpeg" ? 0.9 : undefined,
      );
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const ext = mime === "image/png" ? "png" : "jpeg";
    return isValidImageBytes(bytes, ext) ? bytes : null;
  } catch {
    return null;
  }
}

async function convertImageForMediaPath(
  buffer: ArrayBuffer,
  mediaPath: string,
): Promise<Uint8Array | null> {
  const ext = mediaExtension(mediaPath);
  const bytes =
    ext === "png" ? await rasterizeImage(buffer, "image/png") : await rasterizeImage(buffer, "image/jpeg");
  if (!bytes) return null;
  return isValidImageBytes(bytes, ext) ? bytes : null;
}

async function replaceEmbedMedia(
  zip: PizZip,
  relsPath: string,
  embedId: string,
  imageBuffer: ArrayBuffer,
): Promise<boolean> {
  const relsXml = zip.file(relsPath)?.asText();
  if (!relsXml) return false;
  const target = getRelationshipTarget(relsXml, embedId);
  if (!target) return false;
  const mediaPath = resolveMediaPath(target);
  const bytes = await convertImageForMediaPath(imageBuffer, mediaPath);
  if (!bytes) return false;
  zip.file(mediaPath, bytes);
  return true;
}

const CONTENT_TYPES_PATH = "[Content_Types].xml";

const MEDIA_CONTENT_TYPES: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  bmp: "image/bmp",
};

function ensureContentTypesForMedia(zip: PizZip, mediaPath: string): void {
  const xml = zip.file(CONTENT_TYPES_PATH)?.asText();
  if (!xml) return;

  const partName = `/${mediaPath.replace(/\\/g, "/")}`;
  if (xml.includes(`PartName="${partName}"`)) return;

  const ext = mediaPath.split(".").pop()?.toLowerCase() ?? "jpeg";
  const normalizedExt = ext === "jpg" ? "jpeg" : ext;
  const contentType = MEDIA_CONTENT_TYPES[normalizedExt] ?? MEDIA_CONTENT_TYPES.jpeg;

  let updated = xml;
  if (!new RegExp(`Extension="${normalizedExt}"`, "i").test(updated)) {
    updated = updated.replace(
      "</Types>",
      `<Default Extension="${normalizedExt}" ContentType="${contentType}"/></Types>`,
    );
  }

  updated = updated.replace(
    "</Types>",
    `<Override PartName="${partName}" ContentType="${contentType}"/></Types>`,
  );
  zip.file(CONTENT_TYPES_PATH, updated);
}

function nextRelationshipId(relsXml: string): string {
  const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1] ?? 0));
  const max = ids.length > 0 ? Math.max(...ids) : 0;
  return `rId${max + 1}`;
}

function nextMediaPath(zip: PizZip, ext: "jpeg" | "png" = "jpeg"): string {
  const names = Object.keys(zip.files).filter((name) => /^word\/media\/image\d+\.[a-z]+$/i.test(name));
  const numbers = names.map((name) => Number(name.match(/image(\d+)/i)?.[1] ?? 0));
  const next = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
  return `word/media/image${next}.${ext}`;
}

function nextDrawingDocPrId(documentXml: string): number {
  const ids = [...documentXml.matchAll(/\b(?:wp:docPr|pic:cNvPr)\b[^>]*\bid="(\d+)"/g)].map((m) =>
    Number(m[1] ?? 0),
  );
  return (ids.length > 0 ? Math.max(...ids) : 0) + 1;
}

function extractImageParagraphTemplate(zip: PizZip, documentXml: string): string {
  const pattern = /<w:p\b[^>]*>[\s\S]*?<w:drawing>[\s\S]*?<\/w:drawing>[\s\S]*?<\/w:p>/;

  for (const name of [documentXml, ...Object.keys(zip.files)]) {
    const xml =
      name === documentXml ? documentXml : zip.file(name)?.asText() ?? "";
    if (!xml) continue;
    if (name !== documentXml && !/^word\/(header\d+|footer\d+)\.xml$/i.test(name)) continue;
    const match = xml.match(pattern);
    if (match?.[0]) return match[0];
  }

  return buildFallbackImageParagraphTemplate();
}

function buildHeadingParagraph(title: string): string {
  return `<w:p><w:pPr><w:jc w:val="center"/><w:bidi/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>${xmlEscape(sanitizeXmlText(title))}</w:t></w:r></w:p>`;
}

function buildCaptionParagraph(caption: string): string {
  return `<w:p><w:pPr><w:jc w:val="center"/><w:bidi/></w:pPr><w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>${xmlEscape(sanitizeXmlText(caption))}</w:t></w:r></w:p>`;
}

function cloneImageParagraph(
  paragraphTemplate: string,
  embedId: string,
  docPrId: number,
): string {
  return paragraphTemplate
    .replace(/r:embed="rId\d+"/g, `r:embed="${embedId}"`)
    .replace(/r:id="rId\d+"/g, `r:id="${embedId}"`)
    .replace(/wp:docPr\b([^>]*)\bid="\d+"/g, `wp:docPr$1id="${docPrId}"`)
    .replace(/pic:cNvPr\b([^>]*)\bid="\d+"/g, `pic:cNvPr$1id="${docPrId}"`);
}

function appendRelationship(relsXml: string, embedId: string, mediaTarget: string): string {
  const relationship = `<Relationship Id="${embedId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${mediaTarget}"/>`;
  return relsXml.replace("</Relationships>", `${relationship}</Relationships>`);
}

async function addImageToPackage(
  zip: PizZip,
  relsXml: string,
  image: MvWordMergeImageItem,
  mediaExt: "jpeg" | "png" | "gif" | "bmp",
): Promise<{ relsXml: string; embedId: string } | null> {
  const embedId = nextRelationshipId(relsXml);
  const storedExt: "jpeg" | "png" = mediaExt === "png" ? "png" : "jpeg";
  const mediaPath = nextMediaPath(zip, storedExt);
  const mediaTarget = mediaPath.replace(/^word\//, "");
  const bytes = await convertImageForMediaPath(image.image, mediaPath);
  if (!bytes) return null;
  zip.file(mediaPath, bytes);
  ensureContentTypesForMedia(zip, mediaPath);
  return { relsXml: appendRelationship(relsXml, embedId, mediaTarget), embedId };
}

async function replaceSlots(
  zip: PizZip,
  relsPath: string,
  slots: EmbedSlot[],
  images: MvWordMergeImageItem[],
): Promise<{ replaced: number; remaining: MvWordMergeImageItem[] }> {
  const count = Math.min(slots.length, images.length);
  let replaced = 0;
  for (let index = 0; index < count; index += 1) {
    const ok = await replaceEmbedMedia(zip, relsPath, slots[index]!.embedId, images[index]!.image);
    if (ok) replaced += 1;
  }
  return { replaced, remaining: images.slice(count) };
}

async function appendImageSection(
  zip: PizZip,
  relsPath: string,
  documentXml: string,
  heading: string,
  images: MvWordMergeImageItem[],
  paragraphTemplate: string,
): Promise<{ documentXml: string; insertedCount: number }> {
  if (images.length === 0) return { documentXml, insertedCount: 0 };

  let relsXml = zip.file(relsPath)?.asText() ?? "";
  let block = buildHeadingParagraph(heading);
  let docPrId = nextDrawingDocPrId(documentXml);
  let insertedCount = 0;

  const templateEmbed = paragraphTemplate.match(/r:embed="(rId\d+)"/)?.[1];
  const templateTarget = templateEmbed ? getRelationshipTarget(relsXml, templateEmbed) : null;
  const mediaExt = templateTarget ? mediaExtension(resolveMediaPath(templateTarget)) : "jpeg";

  for (const image of images) {
    const added = await addImageToPackage(zip, relsXml, image, mediaExt);
    if (!added) continue;
    relsXml = added.relsXml;
    block += cloneImageParagraph(paragraphTemplate, added.embedId, docPrId);
    docPrId += 1;
    insertedCount += 1;
    if (image.caption?.trim()) {
      block += buildCaptionParagraph(image.caption.trim());
    }
    block += `<w:p><w:pPr/></w:p>`;
  }

  if (insertedCount === 0) return { documentXml, insertedCount: 0 };

  zip.file(relsPath, relsXml);

  const bodyClose = documentXml.lastIndexOf("</w:body>");
  if (bodyClose < 0) return { documentXml, insertedCount: 0 };
  return {
    documentXml: `${documentXml.slice(0, bodyClose)}${block}${documentXml.slice(bodyClose)}`,
    insertedCount,
  };
}

export async function applyImageMergeToPackage(
  zip: PizZip,
  assetImages: MvWordMergeImageItem[],
  valuationImages: MvWordMergeImageItem[],
): Promise<DocxImageMergeStats> {
  return applyImageMergeToDocumentPart(
    zip,
    "word/document.xml",
    assetImages,
    valuationImages,
    true,
  );
}

/** @deprecated استخدم applyImageMergeToPackage */
export async function applyImageMergeToDocument(
  zip: PizZip,
  assetImages: MvWordMergeImageItem[],
  valuationImages: MvWordMergeImageItem[],
): Promise<DocxImageMergeStats> {
  return applyImageMergeToPackage(zip, assetImages, valuationImages);
}

async function applyImageMergeToDocumentPart(
  zip: PizZip,
  documentPath: string,
  assetImages: MvWordMergeImageItem[],
  valuationImages: MvWordMergeImageItem[],
  allowAppend: boolean,
): Promise<DocxImageMergeStats> {
  const stats: DocxImageMergeStats = {
    assetReplaced: 0,
    valuationReplaced: 0,
    assetInserted: 0,
    valuationInserted: 0,
  };

  if (assetImages.length === 0 && valuationImages.length === 0) return stats;

  const relsPath = documentPath.replace(/^word\//, "word/_rels/") + ".rels";
  const originalXml = zip.file(documentPath)?.asText();
  const relsXml = zip.file(relsPath)?.asText();
  if (!originalXml || !relsXml) return stats;

  const paragraphTemplate = extractImageParagraphTemplate(zip, originalXml);
  const slots = collectEmbedSlots(originalXml, relsXml);
  const { asset: assetSlots, valuation: valuationSlots } = classifyEmbedSlots(
    originalXml,
    slots,
    assetImages.length,
    valuationImages.length,
  );

  const assetResult = await replaceSlots(zip, relsPath, assetSlots, assetImages);
  const valuationResult = await replaceSlots(zip, relsPath, valuationSlots, valuationImages);
  stats.assetReplaced = assetResult.replaced;
  stats.valuationReplaced = valuationResult.replaced;

  let documentXml = originalXml;
  const assetsToInsert =
    assetResult.remaining.length > 0 ? assetResult.remaining : assetSlots.length === 0 ? assetImages : [];
  const valuationsToInsert =
    valuationResult.remaining.length > 0
      ? valuationResult.remaining
      : valuationSlots.length === 0
        ? valuationImages
        : [];

  if (assetsToInsert.length > 0 && allowAppend) {
    const assetAppend = await appendImageSection(
      zip,
      relsPath,
      documentXml,
      "صور الأصول",
      assetsToInsert,
      paragraphTemplate,
    );
    documentXml = assetAppend.documentXml;
    stats.assetInserted = assetAppend.insertedCount;
  }

  if (valuationsToInsert.length > 0 && allowAppend) {
    const valuationAppend = await appendImageSection(
      zip,
      relsPath,
      documentXml,
      "صور حسابات القيمة",
      valuationsToInsert,
      paragraphTemplate,
    );
    documentXml = valuationAppend.documentXml;
    stats.valuationInserted = valuationAppend.insertedCount;
  }

  const xmlValidation = validateWordXmlContent(documentXml);
  if (!xmlValidation.ok) {
    throw new Error(`تعذر تحديث صور المستند: ${xmlValidation.error ?? "XML غير صالح"}`);
  }
  zip.file(documentPath, documentXml);
  return stats;
}
