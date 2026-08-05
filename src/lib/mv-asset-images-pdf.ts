"use client";

/**
 * Creates a print-friendly PDF from the images selected for an asset report.
 * Images are fitted inside their slots (never cropped), with two slots per
 * A4 page when the selection contains more than one image.
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

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const PAGE_MARGIN_PT = 14;
const SLOT_GAP_PT = 8;
const MAX_RASTER_DIMENSION = 2400;

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

type PreparedImage = {
  dataUrl: string;
  width: number;
  height: number;
};

async function prepareImage(source: MvAssetImagePdfSource): Promise<PreparedImage> {
  const blob = await fetchImageBlob(source);
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("image_decode_failed"));
      element.src = objectUrl;
    });

    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    if (!sourceWidth || !sourceHeight) throw new Error("image_has_no_dimensions");

    // Rasterising through a bounded canvas makes PNG/WebP/SVG behave
    // consistently in jsPDF and avoids excessive memory for very large photos.
    const scale = Math.min(1, MAX_RASTER_DIMENSION / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("image_canvas_unavailable");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.92),
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
}): Promise<MvAssetImagesPdfResult> {
  const sources = params.sources.filter((source) => source.url.trim() && isImageSource(source));
  if (sources.length === 0) {
    throw new Error("no_report_images_selected");
  }

  const prepared: PreparedImage[] = [];
  const failedNames: string[] = [];
  for (const source of sources) {
    try {
      prepared.push(await prepareImage(source));
    } catch {
      failedNames.push(source.name?.trim() || source.url);
    }
  }

  if (prepared.length === 0) {
    throw new Error("report_images_could_not_be_loaded");
  }

  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
  const imageSlotsPerPage = prepared.length === 1 ? 1 : 2;
  const pageWidth = pdf.internal.pageSize.getWidth() || A4_WIDTH_PT;
  const pageHeight = pdf.internal.pageSize.getHeight() || A4_HEIGHT_PT;
  const contentWidth = pageWidth - PAGE_MARGIN_PT * 2;
  const slotHeight =
    (pageHeight - PAGE_MARGIN_PT * 2 - SLOT_GAP_PT * (imageSlotsPerPage - 1)) / imageSlotsPerPage;

  prepared.forEach((image, index) => {
    const slotIndex = index % imageSlotsPerPage;
    if (index > 0 && slotIndex === 0) pdf.addPage("a4", "portrait");

    const slotX = PAGE_MARGIN_PT;
    const slotY = PAGE_MARGIN_PT + slotIndex * (slotHeight + SLOT_GAP_PT);
    const scale = Math.min(contentWidth / image.width, slotHeight / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const drawX = slotX + (contentWidth - drawWidth) / 2;
    const drawY = slotY + (slotHeight - drawHeight) / 2;

    pdf.setDrawColor(226, 232, 240);
    pdf.setLineWidth(0.5);
    pdf.rect(slotX, slotY, contentWidth, slotHeight);
    pdf.addImage(image.dataUrl, "JPEG", drawX, drawY, drawWidth, drawHeight, undefined, "FAST");
  });

  const blob = pdf.output("blob");
  downloadBlob(blob, safePdfFilename(params.filenameBase));
  return { blob, imageCount: prepared.length, failedNames };
}
