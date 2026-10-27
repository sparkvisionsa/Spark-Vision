"use client";

import {
  createImagePdf,
  type BrowserImagePdfOptions,
} from "@/lib/browser-image-pdf";

/**
 * Creates a PDF from the images selected inside the simplified asset workflow.
 * The settings intentionally use the same browser renderer as the helper
 * "Images and PDF to PDF" tool so both entry points produce identical layouts.
 */

export type MvAssetImagePdfSource = {
  url: string;
  name?: string;
  mimeType?: string;
};

export type MvAssetImagesPdfResult = {
  blob: Blob;
  imageCount: number;
  failedNames: string[];
};

export type MvAssetImagesPdfProgress = {
  stage: "loading" | "converting" | "saving" | "complete";
  percent: number;
  completed: number;
  total: number;
  failed: number;
};

export type MvAssetImagesPdfSettings = Omit<BrowserImagePdfOptions, "rtl" | "onProgress">;

export const DEFAULT_MV_ASSET_IMAGES_PDF_SETTINGS: MvAssetImagesPdfSettings = {
  imagesPerRow: 3,
  imagesPerPage: 15,
  fit: "stretch",
  orientation: "portrait",
  quality: "best",
};

// Give React and the browser a chance to paint between CPU-heavy PDF steps.
const yieldForPaint = () => new Promise<void>((resolve) => window.setTimeout(resolve, 16));

function imageExtension(name: string): string {
  return name.trim().toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/)?.[1] ?? "";
}

function isImageSource(source: MvAssetImagePdfSource): boolean {
  const mime = (source.mimeType ?? "").trim().toLowerCase();
  if (mime.startsWith("image/")) return true;
  return /^(jpe?g|png|gif|webp|bmp|svg|heic|heif|tiff?)$/.test(imageExtension(source.name ?? source.url));
}

function fetchImageBlob(source: MvAssetImagePdfSource): Promise<Blob> {
  return fetch(source.url, {
    cache: "no-store",
    credentials: "same-origin",
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`image_download_failed_${response.status}`);
    }
    const blob = await response.blob();
    // The project file endpoint may intentionally return octet-stream while
    // the stored file is still an image. Decoding below remains the final
    // validation, so do not reject such responses prematurely.
    if (
      blob.type &&
      !blob.type.startsWith("image/") &&
      blob.type !== "application/octet-stream" &&
      !((source.mimeType ?? "").toLowerCase().startsWith("image/"))
    ) {
      throw new Error("image_response_is_not_an_image");
    }
    return blob;
  });
}

async function loadImageFile(source: MvAssetImagePdfSource, index: number): Promise<File> {
  const blob = await fetchImageBlob(source);
  const rawName = source.name?.trim() || `asset-image-${index + 1}`;
  const name = imageExtension(rawName) ? rawName : `${rawName}.jpg`;
  const type = blob.type.startsWith("image/")
    ? blob.type
    : source.mimeType?.startsWith("image/")
      ? source.mimeType
      : "image/jpeg";
  return new File([blob], name, { type });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 15_000);
}

function safePdfFilename(value: string): string {
  const base = value.trim().replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-").replace(/\s+/g, " ");
  return (base || "asset-images") + "-report-images.pdf";
}

export async function buildAssetImagesPdf(params: {
  sources: readonly MvAssetImagePdfSource[];
  filenameBase: string;
  settings?: Partial<MvAssetImagesPdfSettings>;
  rtl?: boolean;
  onProgress?: (progress: MvAssetImagesPdfProgress) => void;
}): Promise<MvAssetImagesPdfResult> {
  const sources = params.sources.filter((source) => source.url.trim() && isImageSource(source));
  if (sources.length === 0) {
    throw new Error("no_report_images_selected");
  }

  const prepared: File[] = [];
  const failedNames: string[] = [];
  const reportProgress = (stage: MvAssetImagesPdfProgress["stage"], percent: number, completed: number, total: number) => {
    params.onProgress?.({ stage, percent, completed, total, failed: failedNames.length });
  };
  reportProgress("loading", 0, 0, sources.length);
  await yieldForPaint();
  for (const [index, source] of sources.entries()) {
    try {
      prepared.push(await loadImageFile(source, index));
    } catch {
      failedNames.push(source.name?.trim() || source.url);
    }
    const processed = prepared.length + failedNames.length;
    reportProgress("loading", Math.round(processed / sources.length * 60), processed, sources.length);
    await yieldForPaint();
  }

  if (prepared.length === 0) {
    throw new Error("report_images_could_not_be_loaded");
  }

  reportProgress("converting", 60, 0, prepared.length);
  await yieldForPaint();
  const settings: MvAssetImagesPdfSettings = {
    ...DEFAULT_MV_ASSET_IMAGES_PDF_SETTINGS,
    ...params.settings,
  };
  const result = await createImagePdf(prepared, {
    ...settings,
    rtl: params.rtl,
    onProgress: (done, total) => {
      reportProgress(
        "converting",
        60 + Math.round((done / Math.max(1, total)) * 35),
        done,
        total,
      );
    },
  });
  failedNames.push(...result.failed);
  const imageCount = prepared.length - result.failed.length;

  reportProgress("saving", 98, imageCount, imageCount);
  await yieldForPaint();
  downloadBlob(result.blob, safePdfFilename(params.filenameBase));
  // The browser owns saving to disk; completion here means download was started.
  reportProgress("complete", 100, imageCount, imageCount);
  return { blob: result.blob, imageCount, failedNames };
}
