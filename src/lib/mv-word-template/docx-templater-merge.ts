import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";
import PizZip from "pizzip";
import { buildImageLoopData, buildBookmarkTextValues, type MvWordMergeInput } from "./build-context";
import { validateZipXmlParts } from "./docx-validate";
import { yieldToMain } from "./docx-yield";

const DOCUMENT_PATH = "word/document.xml";

export type DocxTemplaterMergeStats = {
  rendered: boolean;
  error?: string;
};

function assetImageSize(): [number, number] {
  return [520, 390];
}

function buildRenderData(input: MvWordMergeInput) {
  const scalars = buildBookmarkTextValues(input);
  return {
    ...scalars,
    assetImages: buildImageLoopData(input.assetImages),
    valuationImages: buildImageLoopData(input.valuationImages),
  };
}

function validateOutputZip(zip: PizZip): { ok: boolean; error?: string } {
  return validateZipXmlParts(Object.keys(zip.files), (path) => zip.file(path)?.asText() ?? null);
}

/**
 * دمج موثوق عبر docxtemplater — ينتج ملف Word صالح للفتح في Microsoft Word.
 */
export async function renderDocxTemplate(
  zip: PizZip,
  input: MvWordMergeInput,
): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined") {
    return { ok: false, error: "docxtemplater يعمل في المتصفح فقط." };
  }

  try {
    const imageModule = new ImageModule({
      centered: true,
      getImage: (tagValue: unknown) => {
        if (tagValue instanceof ArrayBuffer) return tagValue;
        if (tagValue instanceof Uint8Array) {
          return tagValue.buffer.slice(
            tagValue.byteOffset,
            tagValue.byteOffset + tagValue.byteLength,
          ) as ArrayBuffer;
        }
        if (tagValue && typeof tagValue === "object" && "image" in tagValue) {
          const nested = (tagValue as { image?: unknown }).image;
          if (nested instanceof ArrayBuffer) return nested;
          if (nested instanceof Uint8Array) {
            return nested.buffer.slice(
              nested.byteOffset,
              nested.byteOffset + nested.byteLength,
            ) as ArrayBuffer;
          }
        }
        return new ArrayBuffer(0);
      },
      getSize: () => assetImageSize(),
    });

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "",
      modules: [imageModule],
    });

    await yieldToMain();
    doc.render(buildRenderData(input));
    await yieldToMain();

    const validation = validateOutputZip(zip);
    if (!validation.ok) {
      return { ok: false, error: validation.error ?? "ملف Word الناتج غير صالح." };
    }

    return { ok: true };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error && "properties" in error
          ? JSON.stringify((error as { properties?: unknown }).properties)
          : "تعذر دمج docxtemplater.";
    return { ok: false, error: message };
  }
}

export function generateDocxBuffer(zip: PizZip): ArrayBuffer {
  return zip.generate({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  }) as ArrayBuffer;
}

export function cloneTemplateZip(templateBuffer: ArrayBuffer): PizZip {
  return new PizZip(templateBuffer);
}

export function assertTemplateHasDocument(zip: PizZip): void {
  if (!zip.file(DOCUMENT_PATH)) {
    throw new Error("ملف Word غير صالح: document.xml مفقود.");
  }
}
