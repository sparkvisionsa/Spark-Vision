export type PdfImageFit = "contain" | "cover" | "stretch" | "original";
export type PdfPageOrientation = "portrait" | "landscape";
export type PdfOutputQuality = "best" | "high" | "compact";

export type BrowserImagePdfOptions = {
  imagesPerRow: number;
  imagesPerPage: number;
  fit: PdfImageFit;
  orientation: PdfPageOrientation;
  quality: PdfOutputQuality;
  rtl?: boolean;
  onProgress?: (done: number, total: number) => void;
};

const QUALITY: Record<PdfOutputQuality, { dpi: number; jpeg: number }> = {
  best: { dpi: 300, jpeg: 0.985 },
  high: { dpi: 240, jpeg: 0.96 },
  compact: { dpi: 160, jpeg: 0.9 },
};

const PAGE_MARGIN_PT = 10;
const CELL_GAP_PT = 7;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`image_decode_failed:${file.name}`));
    };
    image.src = url;
  });
}

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("image_encode_failed"));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      "image/jpeg",
      quality,
    );
  });
}

function drawImageToCell(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  fit: PdfImageFit,
) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) throw new Error("image_has_no_dimensions");

  if (fit === "stretch") {
    context.drawImage(image, 0, 0, width, height);
    return;
  }

  if (fit === "cover") {
    const sourceRatio = sourceWidth / sourceHeight;
    const targetRatio = width / height;
    let sx = 0;
    let sy = 0;
    let sw = sourceWidth;
    let sh = sourceHeight;
    if (sourceRatio > targetRatio) {
      sw = sourceHeight * targetRatio;
      sx = (sourceWidth - sw) / 2;
    } else {
      sh = sourceWidth / targetRatio;
      sy = (sourceHeight - sh) / 2;
    }
    context.drawImage(image, sx, sy, sw, sh, 0, 0, width, height);
    return;
  }

  const containScale = Math.min(width / sourceWidth, height / sourceHeight);
  const scale = fit === "original" ? Math.min(1, containScale) : containScale;
  const drawWidth = Math.max(1, Math.round(sourceWidth * scale));
  const drawHeight = Math.max(1, Math.round(sourceHeight * scale));
  const x = Math.round((width - drawWidth) / 2);
  const y = Math.round((height - drawHeight) / 2);
  context.drawImage(image, x, y, drawWidth, drawHeight);
}

async function prepareCellImage(
  file: File,
  widthPt: number,
  heightPt: number,
  fit: PdfImageFit,
  dpi: number,
  jpegQuality: number,
) {
  const image = await loadImage(file);
  const width = Math.max(1, Math.round((widthPt * dpi) / 72));
  const height = Math.max(1, Math.round((heightPt * dpi) / 72));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false, colorSpace: "srgb" } as CanvasRenderingContext2DSettings);
  if (!context) throw new Error("image_canvas_unavailable");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  drawImageToCell(context, image, width, height, fit);
  const bytes = await canvasToJpegBytes(canvas, jpegQuality);
  canvas.width = 1;
  canvas.height = 1;
  return bytes;
}

export async function createImagePdf(files: File[], options: BrowserImagePdfOptions) {
  if (files.length === 0) throw new Error("no_images");
  const { jsPDF } = await import("jspdf");
  const orientation = options.orientation;
  const pdf = new jsPDF({ orientation, unit: "pt", format: "a4", compress: true });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const perPage = Math.max(1, Math.min(16, Math.round(options.imagesPerPage)));
  const columns = Math.max(1, Math.min(perPage, Math.min(4, Math.round(options.imagesPerRow))));
  const rows = Math.ceil(perPage / columns);
  const cellWidth = (pageWidth - PAGE_MARGIN_PT * 2 - CELL_GAP_PT * (columns - 1)) / columns;
  const cellHeight = (pageHeight - PAGE_MARGIN_PT * 2 - CELL_GAP_PT * (rows - 1)) / rows;
  const render = QUALITY[options.quality];
  const failed: string[] = [];

  options.onProgress?.(0, files.length);
  for (let index = 0; index < files.length; index += 1) {
    const pageSlot = index % perPage;
    if (index > 0 && pageSlot === 0) pdf.addPage("a4", orientation);
    const logicalColumn = pageSlot % columns;
    const column = options.rtl ? columns - logicalColumn - 1 : logicalColumn;
    const row = Math.floor(pageSlot / columns);
    const x = PAGE_MARGIN_PT + column * (cellWidth + CELL_GAP_PT);
    const y = PAGE_MARGIN_PT + row * (cellHeight + CELL_GAP_PT);

    try {
      const imageBytes = await prepareCellImage(
        files[index]!,
        cellWidth,
        cellHeight,
        options.fit,
        render.dpi,
        render.jpeg,
      );
      pdf.addImage(imageBytes, "JPEG", x, y, cellWidth, cellHeight, undefined, "NONE");
    } catch {
      failed.push(files[index]!.name);
    }
    options.onProgress?.(index + 1, files.length);
  }

  if (failed.length === files.length) throw new Error("all_images_failed");
  return { blob: pdf.output("blob"), failed };
}

export async function renderPdfPreviewPages(
  blob: Blob,
  onProgress?: (done: number, total: number) => void,
) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  const pages: Blob[] = [];

  try {
    onProgress?.(0, pdf.numPages);
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.35 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));
      const context = canvas.getContext("2d", { alpha: false, colorSpace: "srgb" } as CanvasRenderingContext2DSettings);
      if (!context) throw new Error("preview_canvas_unavailable");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport } as Parameters<typeof page.render>[0]).promise;
      const image = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => value ? resolve(value) : reject(new Error("preview_encode_failed")), "image/jpeg", 0.92);
      });
      pages.push(image);
      canvas.width = 1;
      canvas.height = 1;
      page.cleanup();
      onProgress?.(pageNumber, pdf.numPages);
    }
  } finally {
    await pdf.destroy();
  }

  return pages;
}
