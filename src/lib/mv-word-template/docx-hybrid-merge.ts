import PizZip from "pizzip";
import type { MvWordMergeInput } from "./build-context";
import { buildBookmarkTextValues } from "./build-context";
import {
  applyImageBookmarksToDocument,
  extractDocumentImageTemplate,
} from "./docx-bookmark-images";
import {
  findBookmarkRanges,
  listMergeablePartPaths,
  replaceBookmarkTextSafely,
  replaceBookmarkTextFallback,
  tryWriteXmlPart,
  type MvWordBookmarkMergeStats,
} from "./docx-bookmark-shared";
import {
  cloneDocxBuffer,
  generateSafeDocxBuffer,
  validateDocxBuffer,
  validateDocxPackage,
} from "./docx-package-validate";
import { yieldToMain } from "./docx-yield";
import { resolveImageBookmarkDef, resolveTextBookmarkDef } from "./bookmarks";
import { fixConcatenatedXmlAttributes } from "./docx-xml-utils";

const DOCUMENT_PATH = "word/document.xml";
const REls_PATH = "word/_rels/document.xml.rels";

async function applyTextBookmarksToPart(
  zip: PizZip,
  partPath: string,
  textValues: ReturnType<typeof buildBookmarkTextValues>,
  stats: MvWordBookmarkMergeStats,
): Promise<void> {
  let xml = zip.file(partPath)?.asText() ?? "";
  if (!xml || findBookmarkRanges(xml).length === 0) return;

  const skippedIds = new Set<string>();
  const failedIds = new Set<string>();
  let guard = 0;

  while (guard < 300) {
    guard += 1;
    const ranges = findBookmarkRanges(xml);
    if (ranges.length === 0) break;

    let applied = false;

    for (const range of ranges) {
      if (failedIds.has(range.id)) continue;

      const textDef = resolveTextBookmarkDef(range.name);
      if (!textDef) continue;

      const value = textValues[textDef.field];
      if (!value?.trim()) {
        if (!skippedIds.has(range.id)) {
          skippedIds.add(range.id);
          stats.textBookmarksSkipped += 1;
        }
        continue;
      }

      let next = replaceBookmarkTextSafely(xml, range, value);
      if (next === xml) {
        next = replaceBookmarkTextFallback(xml, range, value);
      }
      if (next === xml) {
        failedIds.add(range.id);
        continue;
      }

      const writeErrors: string[] = [];
      if (!tryWriteXmlPart(zip, partPath, next, writeErrors)) {
        const fallback = replaceBookmarkTextFallback(xml, range, value);
        if (fallback !== xml && fallback !== next && tryWriteXmlPart(zip, partPath, fallback, writeErrors)) {
          next = fallback;
        } else {
          failedIds.add(range.id);
          continue;
        }
      }

      xml = zip.file(partPath)?.asText() ?? next;
      stats.textBookmarksFilled += 1;
      applied = true;
      break;
    }

    if (!applied) break;
    if (guard % 4 === 0) await yieldToMain();
  }
}

/**
 * دمج آمن: نصوص أولاً مع تحقق كامل، ثم صور على نسخة منفصلة — أي فشل يُرجع النسخة النصية السليمة.
 */
export async function mergeWordHybrid(
  templateBuffer: ArrayBuffer,
  input: MvWordMergeInput,
): Promise<{ buffer: ArrayBuffer; stats: MvWordBookmarkMergeStats }> {
  await yieldToMain();

  const stats: MvWordBookmarkMergeStats = {
    textBookmarksFilled: 0,
    textBookmarksSkipped: 0,
    assetImagesInserted: 0,
    valuationImagesInserted: 0,
    bookmarksFound: [],
    imageErrors: [],
  };

  const templateZip = new PizZip(templateBuffer);
  if (!templateZip.file(DOCUMENT_PATH)) {
    throw new Error("ملف Word غير صالح: document.xml مفقود.");
  }

  for (const partPath of listMergeablePartPaths(Object.keys(templateZip.files))) {
    const xml = templateZip.file(partPath)?.asText() ?? "";
    for (const range of findBookmarkRanges(xml)) {
      stats.bookmarksFound.push(range.name);
    }
  }
  stats.bookmarksFound = [...new Set(stats.bookmarksFound)];

  const zip = cloneDocxBuffer(templateBuffer);
  const textValues = buildBookmarkTextValues(input);
  const partPaths = listMergeablePartPaths(Object.keys(zip.files));

  for (const partPath of partPaths) {
    const raw = zip.file(partPath)?.asText() ?? "";
    if (raw) {
      zip.file(partPath, fixConcatenatedXmlAttributes(raw));
    }
  }

  for (const partPath of partPaths) {
    await applyTextBookmarksToPart(zip, partPath, textValues, stats);
    await yieldToMain();
  }

  const textValidation = validateDocxPackage(zip);
  if (!textValidation.ok) {
    stats.imageErrors.push(textValidation.error ?? "فشل دمج النصوص — تم إرجاع القالب الأصلي.");
    stats.textBookmarksFilled = 0;
    stats.textBookmarksSkipped = 0;
    const originalOk = validateDocxBuffer(templateBuffer);
    if (originalOk.ok) {
      return { buffer: templateBuffer, stats };
    }
    throw new Error(textValidation.error ?? "ملف Word الناتج غير صالح.");
  }

  let safeBuffer = generateSafeDocxBuffer(zip);
  let bufferValidation = validateDocxBuffer(safeBuffer);
  if (!bufferValidation.ok) {
    throw new Error(bufferValidation.error ?? "ملف Word الناتج غير صالح.");
  }

  const hasImages = input.assetImages.length > 0 || input.valuationImages.length > 0;
  if (!hasImages) {
    return { buffer: safeBuffer, stats };
  }

  const hasImageBookmark = stats.bookmarksFound.some((name) => resolveImageBookmarkDef(name));
  if (!hasImageBookmark) {
    stats.imageErrors.push("لم تُعثر على إشارة صوراصول أو صورحسابات في ملف Word.");
    return { buffer: safeBuffer, stats };
  }

  const imageZip = cloneDocxBuffer(safeBuffer);
  const documentXml = imageZip.file(DOCUMENT_PATH)?.asText() ?? "";
  const imageRunTemplate = extractDocumentImageTemplate(documentXml);

  const assetBefore = stats.assetImagesInserted;
  const valuationBefore = stats.valuationImagesInserted;

  const { xml: withImages, relsXml } = await applyImageBookmarksToDocument(
    imageZip,
    documentXml,
    input,
    stats,
    imageRunTemplate,
  );

  const imagesAdded =
    stats.assetImagesInserted + stats.valuationImagesInserted > assetBefore + valuationBefore;

  if (!imagesAdded) {
    stats.imageErrors.push("تعذر إدراج الصور — تم حفظ النصوص فقط.");
    return { buffer: safeBuffer, stats };
  }

  if (relsXml) {
    imageZip.file(REls_PATH, relsXml);
  }

  const writeErrors: string[] = [];
  if (!tryWriteXmlPart(imageZip, DOCUMENT_PATH, withImages, writeErrors)) {
    stats.imageErrors.push(writeErrors[0] ?? "تعذر حفظ الصور — تم حفظ النصوص فقط.");
    stats.assetImagesInserted = assetBefore;
    stats.valuationImagesInserted = valuationBefore;
    return { buffer: safeBuffer, stats };
  }

  const imagePackageValidation = validateDocxPackage(imageZip);
  if (!imagePackageValidation.ok) {
    stats.imageErrors.push(imagePackageValidation.error ?? "ملف الصور غير صالح — تم حفظ النصوص فقط.");
    stats.assetImagesInserted = assetBefore;
    stats.valuationImagesInserted = valuationBefore;
    return { buffer: safeBuffer, stats };
  }

  const imageBuffer = generateSafeDocxBuffer(imageZip);
  bufferValidation = validateDocxBuffer(imageBuffer);
  if (!bufferValidation.ok) {
    stats.imageErrors.push(bufferValidation.error ?? "تعذر إنشاء ملف الصور — تم حفظ النصوص فقط.");
    stats.assetImagesInserted = assetBefore;
    stats.valuationImagesInserted = valuationBefore;
    return { buffer: safeBuffer, stats };
  }

  await yieldToMain();
  return { buffer: imageBuffer, stats };
}

export function scanDocxBookmarks(buffer: ArrayBuffer): string[] {
  const zip = new PizZip(buffer);
  const found = new Set<string>();

  for (const partPath of listMergeablePartPaths(Object.keys(zip.files))) {
    const xml = zip.file(partPath)?.asText() ?? "";
    for (const range of findBookmarkRanges(xml)) {
      found.add(range.name);
    }
  }

  return [...found];
}
