/**
 * تحويل صفحات PDF إلى صور JPEG عالية الوضوح مع قص الهوامش البيضاء —
 * ملفات العميل + إجراءات التقييم (مرفق 1 / مرفق 3).
 */

/** ~320 DPI (72×4.5) لأقصى وضوح عند الطباعة ودمج Word */
export const MV_PDF_UPLOAD_RENDER_SCALE = 4.5;
export const MV_PDF_UPLOAD_MAX_PAGE_PIXELS = 56_000_000;
export const MV_PDF_PARALLEL_PAGES = 2;
export const MV_PDF_PAGE_EXPORT_JPEG_QUALITY = 0.985;

export type MvPdfPageImageFile = {
  file: File;
  pageNumber: number;
  pageCount: number;
};

function safeImageFileBaseName(name: string) {
  const base = name.replace(/\.[^.]+$/i, "").trim() || "pdf-page";
  return base.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").slice(0, 110);
}

export function canvasToJpegFile(
  canvas: HTMLCanvasElement,
  fileName: string,
  quality: number = MV_PDF_PAGE_EXPORT_JPEG_QUALITY,
): Promise<File> {
  const safeName = /\.(jpe?g)$/i.test(fileName) ? fileName : `${fileName.replace(/\.png$/i, "")}.jpg`;
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("تعذر إنشاء صورة من صفحة PDF."));
          return;
        }
        resolve(new File([blob], safeName, { type: "image/jpeg" }));
      },
      "image/jpeg",
      quality,
    );
  });
}

export function trimCanvasWhiteMargins(
  canvas: HTMLCanvasElement,
  options?: { threshold?: number; padding?: number },
): { canvas: HTMLCanvasElement; cropped: boolean } {
  const width = canvas.width;
  const height = canvas.height;
  if (width < 2 || height < 2) return { canvas, cropped: false };

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { canvas, cropped: false };

  let pixels: ImageData;
  try {
    pixels = ctx.getImageData(0, 0, width, height);
  } catch {
    return { canvas, cropped: false };
  }

  const threshold = Math.min(255, Math.max(180, options?.threshold ?? 248));
  const isContent = (index: number) => {
    const alpha = pixels.data[index + 3] ?? 255;
    if (alpha < 10) return false;
    const r = pixels.data[index] ?? 255;
    const g = pixels.data[index + 1] ?? 255;
    const b = pixels.data[index + 2] ?? 255;
    return r < threshold || g < threshold || b < threshold;
  };

  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if (!isContent(row + x * 4)) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) return { canvas, cropped: false };

  const padding = Math.max(0, Math.round(options?.padding ?? 12));
  const sx = Math.max(0, left - padding);
  const sy = Math.max(0, top - padding);
  const ex = Math.min(width - 1, right + padding);
  const ey = Math.min(height - 1, bottom + padding);
  const sw = ex - sx + 1;
  const sh = ey - sy + 1;

  if (sw >= width - 2 && sh >= height - 2) return { canvas, cropped: false };

  const out = document.createElement("canvas");
  out.width = Math.max(1, sw);
  out.height = Math.max(1, sh);
  const outCtx = out.getContext("2d", { alpha: false });
  if (!outCtx) return { canvas, cropped: false };
  outCtx.fillStyle = "#ffffff";
  outCtx.fillRect(0, 0, out.width, out.height);
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return { canvas: out, cropped: true };
}

export async function renderPdfPageToJpegFile(
  pdf: { getPage: (pageNumber: number) => Promise<import("pdfjs-dist").PDFPageProxy> },
  pageNumber: number,
  pageCount: number,
  baseName: string,
): Promise<MvPdfPageImageFile> {
  const page = await pdf.getPage(pageNumber);
  let scale = MV_PDF_UPLOAD_RENDER_SCALE;
  let viewport = page.getViewport({ scale });
  const pagePixels = viewport.width * viewport.height;
  if (pagePixels > MV_PDF_UPLOAD_MAX_PAGE_PIXELS) {
    scale *= Math.sqrt(MV_PDF_UPLOAD_MAX_PAGE_PIXELS / pagePixels);
    viewport = page.getViewport({ scale });
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d", {
    alpha: false,
    colorSpace: "srgb",
  } as CanvasRenderingContext2DSettings);
  if (!ctx) throw new Error("تعذر تجهيز صفحة PDF كصورة.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  await page.render({
    canvas,
    canvasContext: ctx,
    viewport,
    intent: "print",
  } as Parameters<typeof page.render>[0]).promise;

  const suffix = pageCount > 1 ? `-page-${String(pageNumber).padStart(2, "0")}` : "";
  const trimmed = trimCanvasWhiteMargins(canvas, {
    padding: Math.max(10, Math.round(8 * scale)),
    threshold: 248,
  });
  const imageFile = await canvasToJpegFile(trimmed.canvas, `${baseName}${suffix}.jpg`);
  if (trimmed.cropped) {
    trimmed.canvas.width = 1;
    trimmed.canvas.height = 1;
  }
  canvas.width = 1;
  canvas.height = 1;
  return { file: imageFile, pageNumber, pageCount };
}

export async function convertPdfFileToPageImages(
  file: File,
  options?: {
    onProgress?: (done: number, total: number) => void;
    shouldStop?: () => boolean;
  },
): Promise<MvPdfPageImageFile[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pageCount = pdf.numPages;
  const baseName = safeImageFileBaseName(file.name);
  const out: MvPdfPageImageFile[] = [];

  try {
    options?.onProgress?.(0, pageCount);
    for (let start = 1; start <= pageCount; start += MV_PDF_PARALLEL_PAGES) {
      if (options?.shouldStop?.()) break;
      const end = Math.min(pageCount, start + MV_PDF_PARALLEL_PAGES - 1);
      const batch: Promise<MvPdfPageImageFile>[] = [];
      for (let p = start; p <= end; p += 1) {
        if (options?.shouldStop?.()) break;
        batch.push(renderPdfPageToJpegFile(pdf, p, pageCount, baseName));
      }
      if (batch.length === 0) break;
      const rendered = await Promise.all(batch);
      out.push(...rendered);
      options?.onProgress?.(end, pageCount);
    }
  } finally {
    await pdf.destroy();
  }

  return out;
}

export function isPdfFile(file: File) {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export function isImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name);
}
