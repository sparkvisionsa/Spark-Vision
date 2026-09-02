"use client";

import PizZip from "pizzip";
import { buildTemplateVariableValues } from "@/lib/mv-word-template/build-context";
import type { MvProjectReportData } from "@/components/workspace/workspace-sections/machine-valuation/types";

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const SLIDE_PART_RE = /^ppt\/slides\/slide(\d+)\.xml$/i;
const TEXT_NODE_RE = /<a:t(\s[^>]*)?>([\s\S]*?)<\/a:t>/g;
const PARAGRAPH_RE = /<a:p(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g;
const SHAPE_RE = /<p:sp(?:\s[^>]*)?>[\s\S]*?<\/p:sp>/g;
const TEMPLATE_VARIABLE_RE =
  /(?:<<\s*([^<>\r\n]{1,160}?)\s*>>|>>\s*([^<>\r\n]{1,160}?)\s*<<|«\s*([^«»\r\n]{1,160}?)\s*»|»\s*([^«»\r\n]{1,160}?)\s*«)/g;
const IMAGE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const SLIDE_REL_TYPE =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide";
const SLIDE_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.presentationml.slide+xml";

/**
 * Existing Word templates use Arabic placeholder names. Keep those names valid
 * in PPTX templates too, while allowing the system's English value keys and
 * custom report-text overrides to be used directly.
 */
const PLACEHOLDER_ALIASES: Record<string, string> = {
  "عنوان_التقرير": "reportTitle",
  "العميل": "clientName",
  "تاريخ_إصدار_التقرير": "reportIssueDate",
  "الرقم_المرجعي": "reportReference",
  "اسلوب_التقييم": "valuationMethod",
  "أسلوب_التقييم": "valuationMethod",
  "الأسلوب_المستخدم": "valuationMethod",
  "الغرض_من_التقييم": "valuationPurpose",
  "اساس_القيمة": "valuationBasis",
  "تاريخ_التقييم": "valuationDate",
  "تاريخ_الاتفاقية": "agreementDate",
  "تاريخ_المعاينة": "inspectionDate",
  "أصلأصول": "assetSingularPlural",
  "نشاط_الشركة": "clientActivity",
  "ممثل_العميل": "clientRepresentativeName",
  "صفتة": "clientRepresentativeRole",
  "هوية_المستخدمين_الأخرين": "intendedUsers",
  "الأصل_المعنية_الأصل_محل_التقييم": "assetSubjectDescription",
  "أساس_القيمة_المستخدم": "valuationBasisDefinition",
  "فرضية_القيمة": "valuePremiseDefinition",
  "المدينة": "inspectionLocation",
  "رابط_قوقل_ماب": "inspectionMapUrl",
  "رأي_القيمة_رقما_وكتابتا": "finalValueOpinion",
};

export type MvPptxTemplateImageSource = {
  url: string;
  caption?: string;
};

export type MvPptxTemplateImage = {
  image: ArrayBuffer;
  caption?: string;
  sourceName?: string;
};

export type MvPptxTemplateScan = {
  variables: string[];
  /** Number of asset-image placeholders found in the presentation. */
  assetImageMarkers: number;
  /** Raw labels of image placeholders, retained for configurable mappings. */
  assetImageMarkerNames: string[];
  slideCount: number;
};

export type MvPptxMergeStats = {
  variablesFound: string[];
  variablesFilled: number;
  assetImagesInserted: number;
  assetImageMarkers: number;
  slidesAdded: number;
  warnings: string[];
};

export type MvPptxMergeInput = {
  template: ArrayBuffer;
  projectName: string;
  displayNumber?: number | null;
  reportData: MvProjectReportData;
  assetImages: MvPptxTemplateImage[];
};

export type MvPptxMergeResult = {
  blob: Blob;
  mergeStats: MvPptxMergeStats;
};

export type MvPptxLoadImageResult = {
  images: MvPptxTemplateImage[];
  warnings: string[];
};

type PptxImageBinary = {
  data: ArrayBuffer;
  extension: "jpeg" | "png" | "gif" | "bmp" | "tiff";
  contentType: string;
};

type MarkerShape = {
  shapeXml: string;
  markerText: string;
};

type ImagePlacement = {
  x: number;
  y: number;
  cx: number;
  cy: number;
  columns: number;
  perSlide: number;
};

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function xmlDecode(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&#(\d+);/g, (_, decimal: string) => {
      const code = Number.parseInt(decimal, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    })
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function normalizeTemplateName(value: string): string {
  return value.replace(/[\u200e\u200f\u202a-\u202e]/g, "").trim();
}

function normalizeMarkerText(value: string): string {
  return normalizeTemplateName(value)
    .replace(/[\s\u0640]/g, "")
    .replace(/[：:]/g, "")
    .toLocaleLowerCase();
}

function textFromXml(xml: string): string {
  return Array.from(xml.matchAll(TEXT_NODE_RE), (match) => xmlDecode(match[2] ?? "")).join("");
}

function isAssetImageMarker(value: string): boolean {
  const normalized = normalizeMarkerText(value);
  return (
    normalized.includes("صورالاصول") ||
    normalized.includes("صورالأصول") ||
    normalized.includes("الصورالفوتوغرافية") ||
    normalized.includes("مرفقالصور") ||
    normalized.includes("صورحساباتالقيمة") ||
    normalized.includes("صورملفاتالعميل") ||
    normalized.includes("assetimages") ||
    normalized.includes("assetimage")
  );
}

function slidePaths(zip: PizZip): string[] {
  return Object.keys(zip.files)
    .filter((path) => SLIDE_PART_RE.test(path))
    .sort((a, b) => {
      const aNo = Number(SLIDE_PART_RE.exec(a)?.[1] ?? 0);
      const bNo = Number(SLIDE_PART_RE.exec(b)?.[1] ?? 0);
      return aNo - bNo;
    });
}

function readZipText(zip: PizZip, path: string): string {
  const file = zip.file(path);
  if (!file) throw new Error(`ملف PowerPoint غير مكتمل: ${path}`);
  return file.asText();
}

function findMarkersInSlide(xml: string): MarkerShape[] {
  const markers: MarkerShape[] = [];
  for (const match of xml.matchAll(SHAPE_RE)) {
    const shapeXml = match[0] ?? "";
    const markerText = textFromXml(shapeXml);
    if (markerText && isAssetImageMarker(markerText)) {
      markers.push({ shapeXml, markerText });
    }
  }
  return markers;
}

/** Read variables and asset-image markers from all slides of a PPTX template. */
export function scanPptxTemplate(buffer: ArrayBuffer): MvPptxTemplateScan {
  const zip = new PizZip(buffer);
  const variables = new Set<string>();
  const assetImageMarkerNames = new Set<string>();
  let assetImageMarkers = 0;
  const paths = slidePaths(zip);

  for (const path of paths) {
    const xml = readZipText(zip, path);
    for (const paragraph of xml.matchAll(PARAGRAPH_RE)) {
      const text = textFromXml(paragraph[0] ?? "");
      for (const match of text.matchAll(TEMPLATE_VARIABLE_RE)) {
        const name = normalizeTemplateName(
          match[1] ?? match[2] ?? match[3] ?? match[4] ?? "",
        );
        if (name) variables.add(name);
      }
    }
    const markers = findMarkersInSlide(xml);
    assetImageMarkers += markers.length;
    for (const marker of markers) {
      const name = normalizeTemplateName(marker.markerText);
      if (name) assetImageMarkerNames.add(name);
    }
  }

  return {
    variables: [...variables],
    assetImageMarkers,
    assetImageMarkerNames: [...assetImageMarkerNames],
    slideCount: paths.length,
  };
}

function findValueKey(
  variableName: string,
  values: Record<string, string>,
): string | null {
  const normalized = normalizeTemplateName(variableName);
  const direct = Object.keys(values).find(
    (key) => normalizeTemplateName(key) === normalized,
  );
  if (direct) return direct;

  const aliased = Object.entries(PLACEHOLDER_ALIASES).find(
    ([name]) => normalizeTemplateName(name) === normalized,
  )?.[1];
  return aliased && Object.prototype.hasOwnProperty.call(values, aliased)
    ? aliased
    : null;
}

function rewriteParagraphVariables(
  paragraphXml: string,
  values: Record<string, string>,
  stats: { variablesFound: Set<string>; variablesFilled: number },
): string {
  let nextStart = 0;
  const nodes = Array.from(paragraphXml.matchAll(TEXT_NODE_RE)).map((match) => {
    const text = xmlDecode(match[2] ?? "");
    const start = nextStart;
    nextStart += text.length;
    return {
      attrs: match[1] ?? "",
      text,
      start,
      end: start + text.length,
    };
  });
  const fullText = nodes.map((node) => node.text).join("");
  if (!/[<«>»]/.test(fullText)) return paragraphXml;

  const replacements: Array<{
    start: number;
    end: number;
    targetNode: number;
    value: string;
  }> = [];
  for (const match of fullText.matchAll(TEMPLATE_VARIABLE_RE)) {
    const raw = match[0] ?? "";
    const rawVariableName =
      match[1] ?? match[2] ?? match[3] ?? match[4] ?? "";
    const variableName = normalizeTemplateName(rawVariableName);
    if (!variableName || match.index == null) continue;
    stats.variablesFound.add(variableName);
    const key = findValueKey(variableName, values);
    if (!key) continue;

    const start = match.index;
    const end = start + raw.length;
    const variableStart = start + Math.max(0, raw.indexOf(rawVariableName));
    const targetNode = nodes.findIndex(
      (node) => node.start <= variableStart && node.end > variableStart,
    );
    replacements.push({
      start,
      end,
      targetNode:
        targetNode >= 0
          ? targetNode
          : nodes.findIndex((node) => node.start < end && node.end > start),
      value: values[key] ?? "",
    });
    stats.variablesFilled += 1;
  }
  if (replacements.length === 0) return paragraphXml;

  const rewrittenNodeText = nodes.map((node, nodeIndex) => {
    let cursor = node.start;
    let output = "";
    for (const replacement of replacements) {
      const overlapStart = Math.max(node.start, replacement.start);
      const overlapEnd = Math.min(node.end, replacement.end);
      if (overlapStart >= overlapEnd) continue;
      output += node.text.slice(cursor - node.start, overlapStart - node.start);
      if (replacement.targetNode === nodeIndex) output += replacement.value;
      cursor = overlapEnd;
    }
    return output + node.text.slice(cursor - node.start);
  });

  let textNodeIndex = 0;
  return paragraphXml.replace(
    TEXT_NODE_RE,
    (_whole: string, attrs = "") => {
      const text = rewrittenNodeText[textNodeIndex] ?? "";
      textNodeIndex += 1;
      return `<a:t${attrs}>${xmlEscape(text)}</a:t>`;
    },
  );
}

function replaceVariablesInSlide(
  xml: string,
  values: Record<string, string>,
  stats: { variablesFound: Set<string>; variablesFilled: number },
): string {
  return xml.replace(PARAGRAPH_RE, (paragraph) =>
    rewriteParagraphVariables(paragraph, values, stats),
  );
}

function imageBinaryFromBuffer(buffer: ArrayBuffer): PptxImageBinary | null {
  const bytes = new Uint8Array(buffer);
  const at = (index: number) => bytes[index] ?? -1;

  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    return { data: buffer, extension: "jpeg", contentType: "image/jpeg" };
  }
  if (
    at(0) === 0x89 &&
    at(1) === 0x50 &&
    at(2) === 0x4e &&
    at(3) === 0x47 &&
    at(4) === 0x0d &&
    at(5) === 0x0a &&
    at(6) === 0x1a &&
    at(7) === 0x0a
  ) {
    return { data: buffer, extension: "png", contentType: "image/png" };
  }
  if (at(0) === 0x47 && at(1) === 0x49 && at(2) === 0x46) {
    return { data: buffer, extension: "gif", contentType: "image/gif" };
  }
  if (at(0) === 0x42 && at(1) === 0x4d) {
    return { data: buffer, extension: "bmp", contentType: "image/bmp" };
  }
  const isTiffLittle = at(0) === 0x49 && at(1) === 0x49 && at(2) === 0x2a && at(3) === 0x00;
  const isTiffBig = at(0) === 0x4d && at(1) === 0x4d && at(2) === 0x00 && at(3) === 0x2a;
  if (isTiffLittle || isTiffBig) {
    return { data: buffer, extension: "tiff", contentType: "image/tiff" };
  }
  return null;
}

async function convertUnsupportedImageToPng(
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<PptxImageBinary | null> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return null;
  }
  try {
    const bitmap = await createImageBitmap(
      new Blob([buffer], { type: mimeType || "application/octet-stream" }),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, bitmap.width);
    canvas.height = Math.max(1, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const png = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!png) return null;
    return {
      data: await png.arrayBuffer(),
      extension: "png",
      contentType: "image/png",
    };
  } catch {
    return null;
  }
}

async function normalizeImageForPptx(
  buffer: ArrayBuffer,
  mimeType: string,
): Promise<PptxImageBinary | null> {
  const supported = imageBinaryFromBuffer(buffer);
  return supported ?? convertUnsupportedImageToPng(buffer, mimeType);
}

/**
 * Load selected project images in the browser. This keeps private project image
 * URLs behind the authenticated browser session and avoids copying them to a
 * public temporary location just to construct a PPTX file.
 */
export async function loadPptxTemplateImages(
  sources: MvPptxTemplateImageSource[],
  onProgress?: (completed: number, total: number) => void,
): Promise<MvPptxLoadImageResult> {
  const images: MvPptxTemplateImage[] = [];
  const warnings: string[] = [];
  const usable = sources.filter((source) => source.url.trim());
  let completed = 0;

  for (const source of usable) {
    try {
      const response = await fetch(source.url, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const contentType = response.headers.get("content-type") || "";
      const normalized = await normalizeImageForPptx(
        await response.arrayBuffer(),
        contentType,
      );
      if (!normalized) {
        throw new Error("صيغة الصورة غير مدعومة في PowerPoint");
      }
      images.push({
        image: normalized.data,
        caption: source.caption,
        sourceName: source.caption || source.url,
      });
    } catch (error) {
      const label = source.caption?.trim() || "صورة أصل";
      const detail = error instanceof Error && error.message ? ` (${error.message})` : "";
      warnings.push(`تعذر تحميل ${label}${detail}.`);
    } finally {
      completed += 1;
      onProgress?.(completed, usable.length);
    }
  }

  return { images, warnings };
}

function imageExtension(binary: PptxImageBinary): string {
  return binary.extension;
}

function contentTypeDefault(extension: string, contentType: string): string {
  return `<Default Extension="${extension}" ContentType="${contentType}"/>`;
}

function ensureImageContentType(zip: PizZip, binary: PptxImageBinary): void {
  const path = "[Content_Types].xml";
  const xml = readZipText(zip, path);
  const hasExtension = new RegExp(
    `<Default\\s+Extension=[\"']${imageExtension(binary)}[\"']`,
    "i",
  ).test(xml);
  if (hasExtension) return;
  zip.file(
    path,
    xml.replace(
      /<\/Types>\s*$/i,
      `${contentTypeDefault(imageExtension(binary), binary.contentType)}</Types>`,
    ),
  );
}

function nextRelationshipId(relsXml: string): number {
  let max = 0;
  for (const match of relsXml.matchAll(/\bId=["']rId(\d+)["']/gi)) {
    max = Math.max(max, Number(match[1] ?? 0));
  }
  return max + 1;
}

function nextShapeId(slideXml: string): number {
  let max = 1;
  for (const match of slideXml.matchAll(/<p:cNvPr\b[^>]*\bid=["'](\d+)["']/gi)) {
    max = Math.max(max, Number(match[1] ?? 0));
  }
  return max + 1;
}

function findSlideSize(zip: PizZip): { cx: number; cy: number } {
  const xml = readZipText(zip, "ppt/presentation.xml");
  const match = xml.match(/<p:sldSz\b[^>]*\bcx=["'](\d+)["'][^>]*\bcy=["'](\d+)["'][^>]*\/>/i);
  const cx = Number(match?.[1] ?? 12192000);
  const cy = Number(match?.[2] ?? 6858000);
  return {
    cx: Number.isFinite(cx) && cx > 0 ? cx : 12192000,
    cy: Number.isFinite(cy) && cy > 0 ? cy : 6858000,
  };
}

function markerPlacement(
  marker: MarkerShape,
  slideSize: { cx: number; cy: number },
): ImagePlacement {
  const xfrm = marker.shapeXml.match(/<a:xfrm\b[^>]*>[\s\S]*?<\/a:xfrm>/i)?.[0] ?? "";
  const off = xfrm.match(/<a:off\b[^>]*\bx=["'](\d+)["'][^>]*\by=["'](\d+)["'][^>]*\/>/i);
  const ext = xfrm.match(/<a:ext\b[^>]*\bcx=["'](\d+)["'][^>]*\bcy=["'](\d+)["'][^>]*\/>/i);
  const markerY = Number(off?.[2] ?? 0);
  const markerHeight = Number(ext?.[2] ?? 0);
  const sideMargin = 304800;
  const bottomMargin = 304800;
  const gap = 152400;
  const topGap = 152400;
  const maxColumns = 3;
  const startY = Math.min(
    Math.max(sideMargin, markerY + markerHeight + topGap),
    Math.max(sideMargin, slideSize.cy - bottomMargin - 914400),
  );
  const availableWidth = Math.max(914400, slideSize.cx - sideMargin * 2);
  const availableHeight = Math.max(914400, slideSize.cy - startY - bottomMargin);
  const columns = Math.max(1, Math.min(maxColumns, Math.floor((availableWidth + gap) / 1828800)));
  const rows = availableHeight >= 2_400_000 ? 2 : 1;
  const cx = Math.max(457200, Math.floor((availableWidth - gap * (columns - 1)) / columns));
  const cy = Math.max(457200, Math.floor((availableHeight - gap * (rows - 1)) / rows));
  return {
    x: sideMargin,
    y: startY,
    cx,
    cy,
    columns,
    perSlide: columns * rows,
  };
}

function pictureXml(opts: {
  shapeId: number;
  relationshipId: string;
  name: string;
  x: number;
  y: number;
  cx: number;
  cy: number;
}): string {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${opts.shapeId}" name="${xmlEscape(opts.name)}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${opts.relationshipId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${opts.x}" y="${opts.y}"/><a:ext cx="${opts.cx}" cy="${opts.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

function slideRelsPath(slidePath: string): string {
  const fileName = slidePath.slice(slidePath.lastIndexOf("/") + 1);
  return `ppt/slides/_rels/${fileName}.rels`;
}

function newSlideRelsXml(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
}

function addImagesToSlide(opts: {
  zip: PizZip;
  slidePath: string;
  slideXml: string;
  images: MvPptxTemplateImage[];
  placement: ImagePlacement;
  imageSequenceStart: number;
}): { inserted: number; nextImageSequence: number } {
  const relsPath = slideRelsPath(opts.slidePath);
  let relsXml = opts.zip.file(relsPath)?.asText() ?? newSlideRelsXml();
  let nextRel = nextRelationshipId(relsXml);
  let nextShape = nextShapeId(opts.slideXml);
  let nextImageSequence = opts.imageSequenceStart;
  const pictures: string[] = [];
  const relations: string[] = [];
  const columns = opts.placement.columns;

  for (let index = 0; index < opts.images.length; index += 1) {
    const item = opts.images[index]!;
    const binary = imageBinaryFromBuffer(item.image);
    if (!binary) continue;
    ensureImageContentType(opts.zip, binary);
    const mediaName = `spark-vision-asset-${String(nextImageSequence).padStart(5, "0")}.${imageExtension(binary)}`;
    nextImageSequence += 1;
    opts.zip.file(`ppt/media/${mediaName}`, binary.data);

    const row = Math.floor(index / columns);
    const column = index % columns;
    const relationshipId = `rId${nextRel}`;
    nextRel += 1;
    relations.push(
      `<Relationship Id="${relationshipId}" Type="${IMAGE_REL_TYPE}" Target="../media/${mediaName}"/>`,
    );
    pictures.push(
      pictureXml({
        shapeId: nextShape,
        relationshipId,
        name: item.caption?.trim() || `صورة أصل ${index + 1}`,
        // Place the first photo directly under the configured RTL image marker.
        x:
          opts.placement.x +
          (columns - 1 - column) * (opts.placement.cx + 152400),
        y: opts.placement.y + row * (opts.placement.cy + 152400),
        cx: opts.placement.cx,
        cy: opts.placement.cy,
      }),
    );
    nextShape += 1;
  }

  if (pictures.length === 0) return { inserted: 0, nextImageSequence };
  const treeClose = "</p:spTree>";
  const at = opts.slideXml.lastIndexOf(treeClose);
  if (at < 0) throw new Error("تعذر العثور على مساحة إدراج الصور داخل شريحة PowerPoint.");
  const outputSlide =
    opts.slideXml.slice(0, at) + pictures.join("") + opts.slideXml.slice(at);
  relsXml = relsXml.replace(/<\/Relationships>\s*$/i, `${relations.join("")}</Relationships>`);
  opts.zip.file(opts.slidePath, outputSlide);
  opts.zip.file(relsPath, relsXml);
  return { inserted: pictures.length, nextImageSequence };
}

function appendSlideContentType(zip: PizZip, slideNumber: number): void {
  const path = "[Content_Types].xml";
  const xml = readZipText(zip, path);
  const partName = `/ppt/slides/slide${slideNumber}.xml`;
  if (xml.includes(`PartName="${partName}"`)) return;
  zip.file(
    path,
    xml.replace(
      /<\/Types>\s*$/i,
      `<Override PartName="${partName}" ContentType="${SLIDE_CONTENT_TYPE}"/></Types>`,
    ),
  );
}

function appendPresentationSlide(zip: PizZip, slideNumber: number): void {
  const presentationPath = "ppt/presentation.xml";
  const relsPath = "ppt/_rels/presentation.xml.rels";
  let presentationXml = readZipText(zip, presentationPath);
  let relsXml = readZipText(zip, relsPath);
  let highestSlideId = 255;
  for (const match of presentationXml.matchAll(/<p:sldId\b[^>]*\bid=["'](\d+)["']/gi)) {
    highestSlideId = Math.max(highestSlideId, Number(match[1] ?? 0));
  }
  const relationshipId = `rId${nextRelationshipId(relsXml)}`;
  if (!/<p:sldIdLst\b/i.test(presentationXml)) {
    throw new Error("ملف PowerPoint لا يحتوي على قائمة شرائح صالحة.");
  }
  presentationXml = presentationXml.replace(
    /<\/p:sldIdLst>/i,
    `<p:sldId id="${highestSlideId + 1}" r:id="${relationshipId}"/></p:sldIdLst>`,
  );
  relsXml = relsXml.replace(
    /<\/Relationships>\s*$/i,
    `<Relationship Id="${relationshipId}" Type="${SLIDE_REL_TYPE}" Target="slides/slide${slideNumber}.xml"/></Relationships>`,
  );
  zip.file(presentationPath, presentationXml);
  zip.file(relsPath, relsXml);
  appendSlideContentType(zip, slideNumber);

  const appPath = "docProps/app.xml";
  const appFile = zip.file(appPath);
  if (appFile) {
    const count = slidePaths(zip).length;
    const appXml = appFile
      .asText()
      .replace(/<Slides>\d+<\/Slides>/i, `<Slides>${count}</Slides>`)
      .replace(
        /(<vt:lpstr>Slides<\/vt:lpstr><\/vt:variant>\s*<vt:variant><vt:i4>)\d+(<\/vt:i4>)/i,
        `$1${count}$2`,
      );
    zip.file(appPath, appXml);
  }
}

function nextSlideNumber(zip: PizZip): number {
  const highest = slidePaths(zip).reduce((max, path) => {
    const number = Number(SLIDE_PART_RE.exec(path)?.[1] ?? 0);
    return Math.max(max, number);
  }, 0);
  return highest + 1;
}

function buildTextValues(input: MvPptxMergeInput): Record<string, string> {
  return buildTemplateVariableValues({
    projectName: input.projectName,
    displayNumber: input.displayNumber,
    reportData: input.reportData,
    assetImages: [],
    valuationImages: [],
    clientImages: [],
  });
}

/**
 * Merge a PPTX template in the browser. Text placeholders use the same syntax
 * as the Word feature: <<field>> or «field». Put <<صور_الاصول>>,
 * <<صور_حسابات_القيمة>>, or <<صور_ملفات_العميل>> under the matching annex
 * title to insert those images beneath the marker.
 */
export function mergePptxReportTemplate(input: MvPptxMergeInput): MvPptxMergeResult {
  const zip = new PizZip(input.template);
  const values = buildTextValues(input);
  const variableStats = { variablesFound: new Set<string>(), variablesFilled: 0 };
  const initialSlidePaths = slidePaths(zip);
  let target:
    | {
        slidePath: string;
        slideXml: string;
        relsXml: string;
        marker: MarkerShape;
      }
    | undefined;
  let assetImageMarkers = 0;

  for (const path of initialSlidePaths) {
    const originalXml = readZipText(zip, path);
    const xml = replaceVariablesInSlide(originalXml, values, variableStats);
    zip.file(path, xml);
    const markers = findMarkersInSlide(xml);
    assetImageMarkers += markers.length;
    if (!target && markers[0]) {
      target = {
        slidePath: path,
        slideXml: xml,
        relsXml: zip.file(slideRelsPath(path))?.asText() ?? newSlideRelsXml(),
        marker: markers[0],
      };
    }
  }

  const warnings: string[] = [];
  let assetImagesInserted = 0;
  let slidesAdded = 0;
  let imageSequence = 1;
  const validImages = input.assetImages.filter((item) => imageBinaryFromBuffer(item.image));
  const skippedImages = input.assetImages.length - validImages.length;
  if (skippedImages > 0) {
    warnings.push(`تعذر إدراج ${skippedImages} صورة لأن صيغتها غير مدعومة في PowerPoint.`);
  }

  if (input.assetImages.length > 0 && !target) {
    warnings.push('لم يُعثر على علامة الصور «مرفق الصور1» داخل قالب PowerPoint.');
  }

  if (target && validImages.length > 0) {
    const slideSize = findSlideSize(zip);
    const placement = markerPlacement(target.marker, slideSize);
    const chunks: MvPptxTemplateImage[][] = [];
    for (let index = 0; index < validImages.length; index += placement.perSlide) {
      chunks.push(validImages.slice(index, index + placement.perSlide));
    }

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const chunk = chunks[chunkIndex]!;
      let slidePath = target.slidePath;
      let slideXml = target.slideXml;
      if (chunkIndex > 0) {
        const number = nextSlideNumber(zip);
        slidePath = `ppt/slides/slide${number}.xml`;
        slideXml = target.slideXml;
        zip.file(slidePath, slideXml);
        zip.file(slideRelsPath(slidePath), target.relsXml);
        appendPresentationSlide(zip, number);
        slidesAdded += 1;
      }
      const result = addImagesToSlide({
        zip,
        slidePath,
        slideXml,
        images: chunk,
        placement,
        imageSequenceStart: imageSequence,
      });
      imageSequence = result.nextImageSequence;
      assetImagesInserted += result.inserted;
    }
  }

  const blob = zip.generate({
    type: "blob",
    mimeType: PPTX_MIME,
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    blob,
    mergeStats: {
      variablesFound: [...variableStats.variablesFound],
      variablesFilled: variableStats.variablesFilled,
      assetImagesInserted,
      assetImageMarkers,
      slidesAdded,
      warnings,
    },
  };
}

export function downloadPptxTemplateBlob(blob: Blob, filename: string): void {
  const safe = filename.toLowerCase().endsWith(".pptx") ? filename : `${filename}.pptx`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safe;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
