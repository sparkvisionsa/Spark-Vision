"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import {
  Download,
  FileImage,
  FileText,
  FileSpreadsheet,
  Filter,
  ImageIcon,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Scissors,
  Settings,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import SmartGrid from "@/components/smart-grid/SmartGrid";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  normalizeImportResult,
  type ActiveImportSheetRef,
  type AssetImportResult,
  type AssetImportSheetStat,
} from "./asset-import-panel";
import { useMvInPageNavigation } from "./mv-inpage-navigation";
import { MV_PROJECTS_TABLE_PATH } from "./mv-home-routes";
import {
  MvProjectReportHeader,
  readVisitedSimpleReportSteps,
  writeVisitedSimpleReportSteps,
} from "./mv-simple-report-navigation";
import { MvWorkflowPageFrame, MvWorkflowPageScrollBody } from "./mv-workflow-page-frame";
import { MvUploadProgressToast } from "./mv-upload-progress-toast";
import {
  approachLabel,
  emptyValuationAccountingStore,
  mergeValuationAccountingStores,
  MV_VALUATION_ACCOUNTING_APPROACHES,
  MV_VALUATION_ACCOUNTING_FILE_KIND_LABEL,
  parseValuationAccountingStoreFromApi,
  readValuationAccountingStore,
  valuationAccountingStoreForApi,
  writeValuationAccountingStore,
  type MvValuationAccountingApproachId,
  type MvValuationAccountingFileKind,
  type MvValuationAccountingImage,
  type MvValuationAccountingSourceFile,
  type MvValuationAccountingStore,
} from "./mv-valuation-accounting-store";
import { uploadProjectFileAndReturnId } from "./mv-project-gridfs-upload";
import { writeReportSlice, type MvValuationReportSlice } from "./mv-valuation-report-slice";
import type { MvProject, MvProjectReportData } from "./types";

const EXCEL_ACCEPT =
  ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";
const PDF_ACCEPT = ".pdf,application/pdf";
const IMAGE_ACCEPT = "image/*,.png,.jpg,.jpeg,.webp";
const CROP_TABLE_SELECTOR = 'table[data-account-crop-table="1"]';
const DEFAULT_QUALITY_SCALE = 4;
const DEFAULT_PDF_RENDER_SCALE = 3;
/** أقل قليلاً من 3.1 لتسريع التحويل مع بقاء الجودة مناسبة للتقرير */
const PDF_UPLOAD_RENDER_SCALE = 2.1;
const PDF_UPLOAD_MAX_PAGE_PIXELS = 18_000_000;
/** صفحات PDF تُعرض بالتوازي (worker واحد لكن عمليات الرسم متوازية) */
const PDF_PARALLEL_PAGES = 4;
const PDF_UPLOAD_PARALLEL_UPLOADS = 4;
/** صور Excel تُولَّد على دفعات لتقليل زمن الانتظار */
const EXCEL_IMAGE_CONCURRENCY = 2;
const DEFAULT_EXCEL_ROWS_PER_IMAGE = 15;
const EXCEL_ROWS_PER_IMAGE_OPTIONS = [5, 10, 15, 20] as const;
const DEFAULT_EXCEL_PDF_ROWS_PER_IMAGE = 20;
const MIN_EXCEL_PDF_ROWS_PER_IMAGE = 1;
const MAX_EXCEL_PDF_ROWS_PER_IMAGE = 200;
const EXCEL_PDF_MIN_COLUMN_WIDTH_PX = 64;
const EXCEL_PDF_MAX_COLUMN_WIDTH_PX = 420;
const EXCEL_PDF_DEFAULT_COLUMN_WIDTH_PX = 120;
const EXCEL_PDF_ROW_HEIGHT_PX = 42;
const EXCEL_PDF_CELL_FONT_PX = 18;
const EXCEL_PDF_CELL_PAD_X_PX = 12;
const EXCEL_PDF_CONTENT_PADDING_PX = 2;
const EXCEL_PDF_RENDER_SCALE = 3;
const EXCEL_PDF_MAX_CANVAS_DIMENSION_PX = 32_000;
const EXCEL_PDF_MAX_CANVAS_PIXELS = 32_000_000;

type CropSelection = { x: number; y: number; width: number; height: number };
type PdfPageImageFile = { file: File; pageNumber: number; pageCount: number };
type ExcelPdfSheet = {
  name: string;
  rows: string[][];
  columnWidths: number[];
  rowCount: number;
  columnCount: number;
};
type PendingUploadKind = Extract<MvValuationAccountingFileKind, "excel" | "pdf">;
type PendingUploadStatus = "processing" | "ready" | "error" | "saving";
type PendingUploadPreview = {
  id: string;
  kind: PendingUploadKind;
  approachId: MvValuationAccountingApproachId;
  files: File[];
  originalFiles?: File[];
  status: PendingUploadStatus;
  title: string;
  message: string;
  previewDataUrl?: string;
  estimatedImageCount?: number;
  pageCount?: number;
  sheetName?: string;
  rowCount?: number;
  columnCount?: number;
  excelRowsPerImage?: number;
  error?: string;
};
type UploadControl = {
  shouldStop?: () => boolean;
  onImage?: (image: MvValuationAccountingImage) => void;
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function waitFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

type AccountFileProgressCb = (done: number, total: number, phase: string) => void | Promise<void>;

async function flushProgress(cb: AccountFileProgressCb | undefined, done: number, total: number, phase: string) {
  await cb?.(done, total, phase);
  await waitFrame();
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("تعذر قراءة الملف."));
    reader.readAsDataURL(file);
  });
}

function dataUrlToUint8Array(dataUrl: string) {
  const base64 = dataUrl.split(",", 2)[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function safeImageFileBaseName(name: string) {
  const base = name.replace(/\.[^.]+$/i, "").trim() || "pdf-page";
  return base.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").slice(0, 110);
}

function arabicTextScore(value: string) {
  const arabic = (value.match(/[\u0600-\u06FF]/g) ?? []).length;
  const mojibake = (value.match(/[ØÙÃÂ]/g) ?? []).length;
  const replacement = (value.match(/\uFFFD/g) ?? []).length;
  return arabic * 3 - mojibake * 2 - replacement * 4;
}

function repairMojibakeArabic(value: string) {
  const raw = value.trim();
  if (!raw || !/[ØÙÃÂ]/.test(raw)) return raw;
  try {
    const bytes = Uint8Array.from(Array.from(raw, (char) => char.charCodeAt(0) & 0xff));
    const decoded = new TextDecoder("utf-8").decode(bytes).trim();
    return arabicTextScore(decoded) > arabicTextScore(raw) ? decoded : raw;
  } catch {
    return raw;
  }
}

function cleanAccountingText(value: string) {
  return repairMojibakeArabic(value)
    .replace(/\uFFFD/g, "")
    .replace(/[_]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim() || value.trim();
}

function cropImageFileName(sourceName: string) {
  const baseName = safeImageFileBaseName(cleanAccountingText(sourceName));
  return `${baseName || "excel-crop"}-crop.png`;
}

function canvasToPngFile(canvas: HTMLCanvasElement, fileName: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("تعذر إنشاء صورة من صفحة PDF."));
          return;
        }
        resolve(new File([blob], fileName, { type: "image/png" }));
      },
      "image/png",
      1,
    );
  });
}

function trimCanvasWhiteMargins(
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
  outCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return { canvas: out, cropped: true };
}

async function renderPdfPageToPngFile(
  // PDF.js document — الأنواع ثقيلة هنا؛ نعتمد على واجهة getPage فقط في وقت التشغيل
  pdf: { getPage: (pageNumber: number) => Promise<import("pdfjs-dist").PDFPageProxy> },
  pageNumber: number,
  pageCount: number,
  baseName: string,
): Promise<PdfPageImageFile> {
  const page = await pdf.getPage(pageNumber);
  let scale = PDF_UPLOAD_RENDER_SCALE;
  let viewport = page.getViewport({ scale });
  const pagePixels = viewport.width * viewport.height;
  if (pagePixels > PDF_UPLOAD_MAX_PAGE_PIXELS) {
    scale *= Math.sqrt(PDF_UPLOAD_MAX_PAGE_PIXELS / pagePixels);
    viewport = page.getViewport({ scale });
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("تعذر تجهيز صفحة PDF كصورة.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;

  const suffix = pageCount > 1 ? `-page-${String(pageNumber).padStart(2, "0")}` : "";
  const trimmed = trimCanvasWhiteMargins(canvas, {
    padding: Math.max(8, Math.round(10 * scale)),
    threshold: 248,
  });
  const imageFile = await canvasToPngFile(trimmed.canvas, `${baseName}${suffix}.png`);
  if (trimmed.cropped) {
    trimmed.canvas.width = 1;
    trimmed.canvas.height = 1;
  }
  canvas.width = 1;
  canvas.height = 1;
  return { file: imageFile, pageNumber, pageCount };
}

async function processPdfToValuationImages(
  projectId: string,
  file: File,
  pdfSource: MvValuationAccountingSourceFile,
  activeApproach: MvValuationAccountingApproachId,
  cleanFileName: string,
  onProgress?: AccountFileProgressCb,
  control?: UploadControl,
): Promise<MvValuationAccountingImage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const pageCount = pdf.numPages;
  const baseName = safeImageFileBaseName(cleanAccountingText(file.name));
  const out: MvValuationAccountingImage[] = [];

  try {
    await flushProgress(onProgress, 0, pageCount, "تحويل ورفع صفحات PDF");
    for (let start = 1; start <= pageCount; start += PDF_PARALLEL_PAGES) {
      if (control?.shouldStop?.()) break;
      const end = Math.min(pageCount, start + PDF_PARALLEL_PAGES - 1);
      const renderBatch: Promise<PdfPageImageFile>[] = [];
      for (let p = start; p <= end; p += 1) {
        if (control?.shouldStop?.()) break;
        renderBatch.push(renderPdfPageToPngFile(pdf, p, pageCount, baseName));
      }
      if (renderBatch.length === 0) break;
      const rendered = await Promise.all(renderBatch);
      for (let u = 0; u < rendered.length; u += PDF_UPLOAD_PARALLEL_UPLOADS) {
        if (control?.shouldStop?.()) break;
        const chunk = rendered.slice(u, u + PDF_UPLOAD_PARALLEL_UPLOADS);
        const ids = await Promise.all(chunk.map((item) => uploadProjectFileAndReturnId(projectId, item.file, { valuationAccounting: true })));
        for (let i = 0; i < chunk.length; i += 1) {
          if (control?.shouldStop?.()) break;
          const pageImage = chunk[i]!;
          const uploadedId = ids[i]!;
          const pageLabel =
            pageImage.pageCount > 1
              ? `${cleanFileName} — صفحة ${pageImage.pageNumber}`
              : `${cleanFileName} — صورة كاملة`;
          const image: MvValuationAccountingImage = {
            id: createId("account-image"),
            approachId: activeApproach,
            sourceId: pdfSource.id,
            sourceKind: "pdf",
            sourceFileName: cleanFileName,
            name: `${approachLabel(activeApproach)} - ${pageLabel}`,
            fileId: uploadedId,
            createdAt: new Date().toISOString(),
            displayWidthPercent: 90,
            displayMaxHeightPx: 1100,
            qualityScale: PDF_UPLOAD_RENDER_SCALE,
            includeInReport: true,
            autoGenerated: true,
            autoPageIndex: pageImage.pageNumber,
            autoPageCount: pageImage.pageCount,
            crop: {
              pageNumber: pageImage.pageNumber,
              x: 0,
              y: 0,
              width: 1,
              height: 1,
            },
          };
          out.push(image);
          control?.onImage?.(image);
        }
      }
      await flushProgress(onProgress, end, pageCount, "تحويل ورفع صفحات PDF");
    }
  } finally {
    await pdf.destroy();
  }

  out.sort((a, b) => (a.autoPageIndex ?? 0) - (b.autoPageIndex ?? 0));
  return out;
}

async function buildPdfUploadPreview(file: File): Promise<{
  previewDataUrl: string;
  pageCount: number;
  estimatedImageCount: number;
}> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  try {
    const page = await pdf.getPage(1);
    let scale = PDF_UPLOAD_RENDER_SCALE;
    let viewport = page.getViewport({ scale });
    const pagePixels = viewport.width * viewport.height;
    if (pagePixels > PDF_UPLOAD_MAX_PAGE_PIXELS) {
      scale *= Math.sqrt(PDF_UPLOAD_MAX_PAGE_PIXELS / pagePixels);
      viewport = page.getViewport({ scale });
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("تعذر تجهيز معاينة PDF.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const trimmed = trimCanvasWhiteMargins(canvas, {
      padding: Math.max(8, Math.round(10 * scale)),
      threshold: 248,
    });
    const previewDataUrl = trimmed.canvas.toDataURL("image/png");
    if (trimmed.cropped) {
      trimmed.canvas.width = 1;
      trimmed.canvas.height = 1;
    }
    canvas.width = 1;
    canvas.height = 1;
    return {
      previewDataUrl,
      pageCount: pdf.numPages,
      estimatedImageCount: pdf.numPages,
    };
  } finally {
    await pdf.destroy();
  }
}

function fileDownloadUrl(projectId: string, fileId: string) {
  return `/api/mv/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/download`;
}

async function fetchFileArrayBuffer(projectId: string, fileId: string) {
  const res = await fetch(fileDownloadUrl(projectId, fileId), { credentials: "include" });
  if (!res.ok) throw new Error(`تعذر تحميل الملف من الخادم (${res.status}).`);
  return await res.arrayBuffer();
}

async function fetchFileBlob(projectId: string, fileId: string) {
  const res = await fetch(fileDownloadUrl(projectId, fileId), { credentials: "include" });
  if (!res.ok) throw new Error(`تعذر تحميل الملف من الخادم (${res.status}).`);
  return await res.blob();
}

async function fetchValuationExcelFileBlob(projectId: string, fileId: string) {
  const res = await fetch(
    `/api/mv/projects/${encodeURIComponent(projectId)}/valuation-excel-files/${encodeURIComponent(fileId)}/download`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error(`تعذر تحميل ملف Excel من الخادم (${res.status}).`);
  return await res.blob();
}

async function uploadValuationExcelFileAndReturnId(projectId: string, file: File): Promise<string> {
  const startedAt = Date.now();
  const formData = new FormData();
  formData.append("files", file, file.name);
  const res = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}/valuation-excel-files`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = "تعذر رفع ملف Excel للتخزين.";
    try {
      const parsed = JSON.parse(text) as { message?: unknown };
      if (typeof parsed.message === "string" && parsed.message.trim()) msg = parsed.message.trim();
    } catch {
      const t = text.trim();
      if (t && t.length < 400) msg = t;
    }
    throw new Error(msg);
  }
  try {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) {
      const first = parsed[0] as { _id?: unknown } | undefined;
      if (first && typeof first._id === "string" && first._id.trim()) return first._id;
    }
  } catch {
    /* ignore */
  }
  const listRes = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}/valuation-excel-files`, { credentials: "include" });
  if (!listRes.ok) throw new Error("تم الرفع لكن تعذر تحديث قائمة ملفات Excel.");
  const rows = (await listRes.json().catch(() => [])) as unknown;
  const files = Array.isArray(rows) ? (rows as { _id: string; name: string; sizeBytes: number; uploadedAt: string }[]) : [];
  const candidates = files
    .filter((f) => typeof f?._id === "string" && f.name === file.name && Number(f.sizeBytes) === Number(file.size))
    .map((f) => ({ ...f, ts: new Date(f.uploadedAt).getTime() }))
    .filter((f) => Number.isFinite(f.ts) && f.ts >= startedAt - 15_000)
    .sort((a, b) => b.ts - a.ts);
  if (candidates[0]?._id) return candidates[0]._id;
  throw new Error("تم الرفع لكن لم يمكن تحديد معرّف ملف Excel.");
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:\/\//i.test(src)) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("تعذر تحميل الصورة."));
    image.src = src;
  });
}

function accountingImageSrc(projectId: string, image: Pick<MvValuationAccountingImage, "fileId" | "dataUrl">) {
  if (image.dataUrl) return image.dataUrl;
  if (image.fileId) return fileDownloadUrl(projectId, image.fileId);
  return "";
}

function downloadAccountingImage(projectId: string, image: MvValuationAccountingImage, fileName: string) {
  const href = image.dataUrl ? image.dataUrl : image.fileId ? fileDownloadUrl(projectId, image.fileId) : "";
  if (!href) return;
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 KB";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function normalizeExcelRowsPerImage(value: unknown) {
  const n = typeof value === "number" ? Math.round(value) : Number(value);
  return EXCEL_ROWS_PER_IMAGE_OPTIONS.includes(n as (typeof EXCEL_ROWS_PER_IMAGE_OPTIONS)[number])
    ? n
    : DEFAULT_EXCEL_ROWS_PER_IMAGE;
}

function excelSheetSettingsKey(sheetId: string, sheetName: string) {
  return `${sheetId}::${sheetName}`;
}

function normalizeVisibleExcelHeaders(sheet: ValuationExcelSheetDetails, requested?: string[]) {
  const headers = sheet.headers.length > 0 ? sheet.headers : ["Column 1"];
  if (!Array.isArray(requested) || requested.length === 0) return headers;
  const allowed = new Set(headers);
  const next = requested.filter((header) => allowed.has(header));
  return next.length > 0 ? next : headers;
}

function normalizeExcelColumnSize(value: unknown) {
  const item = value && typeof value === "object" ? value as { widthPx?: unknown; minHeightPx?: unknown } : {};
  const width =
    typeof item.widthPx === "number" && Number.isFinite(item.widthPx)
      ? Math.min(900, Math.max(72, Math.round(item.widthPx)))
      : undefined;
  const minHeight =
    typeof item.minHeightPx === "number" && Number.isFinite(item.minHeightPx)
      ? Math.min(180, Math.max(28, Math.round(item.minHeightPx)))
      : undefined;
  return { widthPx: width, minHeightPx: minHeight };
}

function distributeExcelImageRanges(totalRows: number, preferredRowsPerImage: number) {
  const total = Math.max(0, Math.floor(totalRows));
  if (total <= 0) return [] as { start: number; end: number }[];
  const preferred = normalizeExcelRowsPerImage(preferredRowsPerImage);
  const softMax = preferred + Math.max(2, Math.floor(preferred * 0.25));
  if (total <= softMax) return [{ start: 0, end: total }];

  const pageCount = Math.max(
    2,
    Math.ceil(total / softMax),
    Math.round(total / preferred),
  );
  const baseSize = Math.floor(total / pageCount);
  const extra = total % pageCount;
  const ranges: { start: number; end: number }[] = [];
  let cursor = 0;
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const size = baseSize + (pageIndex >= pageCount - extra ? 1 : 0);
    if (size <= 0) continue;
    ranges.push({ start: cursor, end: cursor + size });
    cursor += size;
  }
  return ranges;
}

function sourceKindIcon(kind: MvValuationAccountingFileKind) {
  if (kind === "excel") return <FileSpreadsheet className="h-4 w-4" />;
  if (kind === "pdf") return <FileText className="h-4 w-4" />;
  return <FileImage className="h-4 w-4" />;
}

function pushPick(prev: number[], n: number): number[] {
  if (prev.length < 2) return [...prev, n];
  return [prev[1]!, n];
}

function getFirstSheet(result: AssetImportResult | undefined): ActiveImportSheetRef | null {
  const first = result?.summary.sheets?.[0];
  if (!first) return null;
  return { importId: first.importId, sheetName: first.sheetName };
}

function normalizeSelection(selection: CropSelection | null): CropSelection | null {
  if (!selection) return null;
  const width = Math.abs(selection.width);
  const height = Math.abs(selection.height);
  if (width < 6 || height < 6) return null;
  return {
    x: selection.width < 0 ? selection.x + selection.width : selection.x,
    y: selection.height < 0 ? selection.y + selection.height : selection.y,
    width,
    height,
  };
}

/** ملاءمة أبعاد البكسل داخل منطقة التمرير (بدون مُضاعف المعاينة اليدوي) */
function computeMediaLayoutFit(bw: number, bh: number, vw: number, vh: number): number {
  if (bw < 2 || bh < 2 || vw < 40 || vh < 40) return 1;
  const pad = 48;
  const fitW = Math.max(64, vw - pad);
  const fitH = Math.max(64, vh - pad);
  return Math.max(0.04, Math.min(fitW / bw, fitH / bh, 1));
}

async function enhanceImageDataUrl(
  dataUrl: string,
  options?: { scale?: number; contrast?: number; brightness?: number },
) {
  if (!dataUrl.startsWith("data:image/") || dataUrl === "data:,") {
    throw new Error("الصورة الحالية غير صالحة للتحسين.");
  }
  const image = await loadImage(dataUrl);
  const requestedScale = Math.min(4, Math.max(1, options?.scale ?? 2.5));
  const maxSide = 12000;
  const maxPixels = 42_000_000;
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  const scale = Math.max(
    0.2,
    Math.min(
      requestedScale,
      maxSide / Math.max(1, naturalWidth),
      maxSide / Math.max(1, naturalHeight),
      Math.sqrt(maxPixels / Math.max(1, naturalWidth * naturalHeight)),
    ),
  );
  const contrast = Math.min(1.45, Math.max(1, options?.contrast ?? 1.16));
  const brightness = Math.min(1.16, Math.max(1, options?.brightness ?? 1.04));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر إنشاء سياق تحسين الصورة.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.filter = `contrast(${Math.round(contrast * 100)}%) brightness(${Math.round(brightness * 100)}%)`;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const nextDataUrl = canvas.toDataURL("image/png");
  if (!nextDataUrl.startsWith("data:image/png") || nextDataUrl === "data:,") {
    throw new Error("حجم الصورة كبير جداً للتحسين. قلّل الدقة أو اختر نطاقاً أصغر.");
  }
  return nextDataUrl;
}

async function captureTableRegionDataUrl(
  table: HTMLTableElement,
  bounds: { cmin: number; cmax: number; rmin: number; rmax: number },
  options?: {
    includeHeader?: boolean;
    qualityScale?: number;
    bleedCssPx?: number;
    rowHeightCssPx?: number;
    cellFontCssPx?: number;
    headerFontCssPx?: number;
    cellPadXCssPx?: number;
    cellPadYCssPx?: number;
  },
): Promise<string> {
  const { cmin, cmax, rmin, rmax } = bounds;
  const includeHeader = options?.includeHeader === true;
  const cell = (r: number, c: number) =>
    table.querySelector(`td[data-sg-drow="${r}"][data-sg-dcol="${c}"]`) as HTMLElement | null;
  const headerDataCell = (c: number) =>
    table.querySelector(`th[data-sg-hcol="${c}"]`) as HTMLElement | null;

  await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  const selectedColumnCount = cmax - cmin + 1;
  const selectedRowCount = rmax - rmin + 1;
  if (selectedColumnCount < 1 || selectedRowCount < 1) {
    throw new Error("نطاق القص غير صالح.");
  }

  const readText = (element: HTMLElement | null, selector?: string) => {
    const target = selector ? element?.querySelector(selector) : element;
    return cleanAccountingText((target?.textContent ?? "").replace(/\s+/g, " ").trim());
  };

  const columns = Array.from({ length: selectedColumnCount }, (_, offset) => {
    const columnNumber = cmin + offset;
    const header = headerDataCell(columnNumber);
    if (includeHeader && !header) {
      throw new Error("تعذر العثور على ترويسة الأعمدة لهذا النطاق.");
    }
    const sampleCell = cell(rmin, columnNumber);
    if (!sampleCell) {
      throw new Error("تعذر العثور على حدود النطاق داخل الجدول. تأكد أن الصفوف والأعمدة ظاهرة.");
    }
    const headerWidth = header?.offsetWidth ?? 0;
    const sampleWidth = sampleCell.offsetWidth;
    // هامش بسيط لحدود الخلية/الإطار حتى لا يُقصّ آخر عمود (خصوصًا مع RTL والحدود)
    const measured = Math.max(headerWidth, sampleWidth);
    return {
      number: columnNumber,
      width: Math.max(96, Math.ceil(measured) + 8),
      label: readText(header, "[data-account-crop-header-label]") || readText(header) || `عمود ${columnNumber}`,
    };
  });

  const rows = Array.from({ length: selectedRowCount }, (_, rowOffset) => {
    const rowNumber = rmin + rowOffset;
    let rowHeight = Math.max(28, Math.round(options?.rowHeightCssPx ?? 0));
    const values = columns.map((column) => {
      const dataCell = cell(rowNumber, column.number);
      if (!dataCell) {
        throw new Error("تعذر العثور على حدود النطاق داخل الجدول. تأكد أن الصفوف والأعمدة ظاهرة.");
      }
      rowHeight = Math.max(rowHeight, Math.ceil(dataCell.getBoundingClientRect().height));
      return readText(dataCell, "[data-account-crop-cell-text]") || readText(dataCell);
    });
    return { number: rowNumber, height: rowHeight, values };
  });

  const bleed = Math.round(Math.min(48, Math.max(0, options?.bleedCssPx ?? 3)));
  const cellPadX = Math.round(Math.min(32, Math.max(2, options?.cellPadXCssPx ?? 10)));
  const cellPadY = Math.round(Math.min(32, Math.max(2, options?.cellPadYCssPx ?? 8)));
  const headerFontPx = Math.max(10, Math.round(options?.headerFontCssPx ?? 13));
  const cellFontPx = Math.max(10, Math.round(options?.cellFontCssPx ?? 14));
  const headerLineHeight = Math.ceil(headerFontPx * 1.38);
  const cellLineHeight = Math.ceil(cellFontPx * 1.36);
  const fontFamily = getComputedStyle(table).fontFamily || "Arial, sans-serif";

  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  if (!measureCtx) throw new Error("تعذر تجهيز مساحة قياس الصورة.");

  const wrapText = (text: string, maxWidth: number, font: string) => {
    const normalized = cleanAccountingText(text).replace(/\s+/g, " ").trim();
    if (!normalized) return [""];
    measureCtx.font = font;
    const words = normalized.split(" ");
    const lines: string[] = [];
    let current = "";
    const pushLongWord = (word: string) => {
      let part = "";
      Array.from(word).forEach((char) => {
        const next = `${part}${char}`;
        if (part && measureCtx.measureText(next).width > maxWidth) {
          lines.push(part);
          part = char;
        } else {
          part = next;
        }
      });
      current = part;
    };
    words.forEach((word) => {
      const next = current ? `${current} ${word}` : word;
      if (measureCtx.measureText(next).width <= maxWidth) {
        current = next;
        return;
      }
      if (current) lines.push(current);
      if (measureCtx.measureText(word).width > maxWidth) {
        pushLongWord(word);
      } else {
        current = word;
      }
    });
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  };

  const headerFont = `800 ${headerFontPx}px ${fontFamily}`;
  const cellFont = `700 ${cellFontPx}px ${fontFamily}`;
  const headerPadX = Math.max(10, cellPadX);
  const headerPadY = Math.max(8, cellPadY);

  /** توسيع عرض العمود حسب أوسع سطر فعلي بعد الرسم لتفادي قصّ الجانب الأيمن (RTL/عربي) */
  const TEXT_WIDTH_PAD = 18;
  for (let ci = 0; ci < columns.length; ci++) {
    const col = columns[ci]!;
    let maxLineW = 0;
    measureCtx.font = headerFont;
    const headerLines = wrapText(col.label, Math.max(24, col.width - headerPadX * 2), headerFont);
    headerLines.forEach((line) => {
      maxLineW = Math.max(maxLineW, measureCtx.measureText(line).width);
    });
    measureCtx.font = cellFont;
    rows.forEach((row) => {
      const val = row.values[ci] ?? "";
      const cellLines = wrapText(val, Math.max(24, col.width - cellPadX * 2), cellFont);
      cellLines.forEach((line) => {
        maxLineW = Math.max(maxLineW, measureCtx.measureText(line).width);
      });
    });
    col.width = Math.max(col.width, Math.ceil(maxLineW + cellPadX * 2 + TEXT_WIDTH_PAD));
  }

  const visualColumns = [...columns].reverse();
  const visualRows = rows.map((row) => ({
    ...row,
    values: [...row.values].reverse(),
  }));

  const headerHeight = includeHeader
    ? Math.max(
        42,
        ...visualColumns.map((column) => {
          const lines = wrapText(column.label, Math.max(20, column.width - headerPadX * 2), headerFont);
          return lines.length * headerLineHeight + headerPadY * 2;
        }),
      )
    : 0;
  const rowHeights = visualRows.map((row) =>
    Math.max(
      row.height,
      ...row.values.map((value, index) => {
        const column = visualColumns[index];
        const lines = wrapText(value, Math.max(20, (column?.width ?? 96) - cellPadX * 2), cellFont);
        return lines.length * cellLineHeight + cellPadY * 2;
      }),
    ),
  );
  const tableWidth = visualColumns.reduce((sum, column) => sum + column.width, 0);
  const tableHeight = headerHeight + rowHeights.reduce((sum, height) => sum + height, 0);
  const cssWidth = Math.ceil(tableWidth + bleed * 2 + 2 + 6 + selectedColumnCount * 6);
  const cssHeight = Math.ceil(tableHeight + Math.max(bleed, includeHeader ? 8 : 0) + bleed + 2);
  if (cssWidth < 1 || cssHeight < 1) throw new Error("نطاق القص غير صالح.");

  const requestedScale = Math.max(
    2.5,
    options?.qualityScale ?? DEFAULT_QUALITY_SCALE,
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  );
  const maxCanvasSide = 30000;
  const maxCanvasPixels = 120_000_000;
  const scaleLimit = Math.min(
    requestedScale,
    maxCanvasSide / cssWidth,
    maxCanvasSide / cssHeight,
    Math.sqrt(maxCanvasPixels / Math.max(1, cssWidth * cssHeight)),
  );
  const safeScale = Number.isFinite(scaleLimit) && scaleLimit > 0 ? scaleLimit : 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(cssWidth * safeScale));
  canvas.height = Math.max(1, Math.ceil(cssHeight * safeScale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر إنشاء صورة النطاق.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.scale(safeScale, safeScale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cssWidth, cssHeight);
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const topPad = Math.max(bleed, includeHeader ? 8 : 0);
  let y = topPad;
  let x = bleed;
  const drawWrappedText = (
    text: string,
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
    font: string,
    lineHeight: number,
    color: string,
    padX: number,
  ) => {
    const lines = wrapText(text, Math.max(20, boxW - padX * 2), font);
    ctx.font = font;
    ctx.fillStyle = color;
    const totalTextHeight = lines.length * lineHeight;
    const startY = boxY + boxH / 2 - totalTextHeight / 2 + lineHeight / 2;
    lines.forEach((line, index) => {
      // بدون maxWidth: المعامل الرابع يفرض تصغير النص في المتصفح فيبدو «متلاشيًا» أو مقصوصًا
      const cx = Math.round(boxX + boxW / 2);
      const cy = Math.round(startY + index * lineHeight);
      ctx.fillText(line, cx, cy);
    });
  };

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(bleed + 0.5, y + 0.5, tableWidth, tableHeight);

  if (includeHeader) {
    x = bleed;
    visualColumns.forEach((column) => {
      ctx.fillStyle = "#0C447C";
      ctx.fillRect(x, y, column.width, headerHeight);
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.strokeRect(x + 0.5, y + 0.5, column.width, headerHeight);
      drawWrappedText(column.label, x, y, column.width, headerHeight, headerFont, headerLineHeight, "#ffffff", headerPadX);
      x += column.width;
    });
    y += headerHeight;
  }

  visualRows.forEach((row, rowIndex) => {
    x = bleed;
    const rowHeight = rowHeights[rowIndex] ?? row.height;
    row.values.forEach((value, columnIndex) => {
      const column = visualColumns[columnIndex];
      const width = column?.width ?? 96;
      ctx.fillStyle = rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc";
      ctx.fillRect(x, y, width, rowHeight);
      ctx.strokeStyle = "#e2e8f0";
      ctx.strokeRect(x + 0.5, y + 0.5, width, rowHeight);
      drawWrappedText(value, x, y, width, rowHeight, cellFont, cellLineHeight, "#0f172a", cellPadX);
      x += width;
    });
    y += rowHeight;
  });

  return canvas.toDataURL("image/png");
}

function cropCanvasSelection(
  canvas: HTMLCanvasElement,
  selection: CropSelection,
): { dataUrl: string; crop: CropSelection } {
  const rect = canvas.getBoundingClientRect();
  const sx = Math.max(0, Math.round((selection.x * canvas.width) / rect.width));
  const sy = Math.max(0, Math.round((selection.y * canvas.height) / rect.height));
  const sw = Math.min(canvas.width - sx, Math.round((selection.width * canvas.width) / rect.width));
  const sh = Math.min(canvas.height - sy, Math.round((selection.height * canvas.height) / rect.height));
  if (sw < 4 || sh < 4) throw new Error("حدد مساحة أكبر للاقتطاع.");
  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("تعذر إنشاء صورة القص.");
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return {
    dataUrl: out.toDataURL("image/png"),
    crop: { x: sx, y: sy, width: sw, height: sh },
  };
}

function downloadDataUrl(dataUrl: string, fileName: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

interface MvValuationAccountingWorkspaceProps {
  projectId: string;
}

type ValuationExcelCellValue = string | number | boolean | null;

interface ValuationExcelSheetDetails {
  id: string;
  name: string;
  headers: string[];
  rows: Record<string, ValuationExcelCellValue>[];
}

interface ValuationUploadSheetSummary {
  _id: string;
  name: string;
  headers?: string[];
  rowCount?: number;
}

interface ValuationUploadResponse {
  persisted?: boolean;
  savedSheets?: ValuationUploadSheetSummary[];
  saveErrors?: string[];
  sourceFileName?: string;
  sheetCount?: number;
}

async function importValuationExcelSheets(
  projectId: string,
  file: File,
  cleanFileName: string,
  importId: string,
): Promise<AssetImportResult> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("projectId", projectId);
  formData.append("persist", "true");
  formData.append("sourceFileNameUtf8", cleanFileName);

  const response = await fetch("/api/mv/upload", {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const text = await response.text();
  if (!response.ok) {
    let message = "تعذر قراءة ملف Excel لإجراءات التقييم.";
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (parsed.message) message = Array.isArray(parsed.message) ? parsed.message.join(" ") : parsed.message;
    } catch {
      if (text.trim() && text.length < 400) message = text.trim();
    }
    throw new Error(message);
  }

  const parsed = JSON.parse(text) as ValuationUploadResponse;
  const savedSheets = Array.isArray(parsed.savedSheets) ? parsed.savedSheets : [];
  if (savedSheets.length === 0) {
    throw new Error("تم رفع الملف لكن لم يتم حفظ أي شيت صالح لإجراءات التقييم.");
  }

  const sheets = savedSheets.map((sheet) => ({
    importId: sheet._id,
    sheetName: sheet.name,
    rowCount: Math.max(0, Number(sheet.rowCount ?? 0)),
    columnCount: Array.isArray(sheet.headers) ? sheet.headers.length : 0,
  }));

  return normalizeImportResult({
    success: true,
    projectId,
    importId,
    summary: {
      totalSheets: sheets.length,
      totalRows: sheets.reduce((sum, sheet) => sum + sheet.rowCount, 0),
      byType: { vehicles: 0, machinery: 0, electronics: 0, furniture: 0, other: 0 },
      warnings: Array.isArray(parsed.saveErrors) ? parsed.saveErrors.filter(Boolean) : [],
      sheets,
    },
  });
}

async function fetchValuationExcelSheet(sheetId: string): Promise<ValuationExcelSheetDetails> {
  const response = await fetch(`/api/mv/sheets/${encodeURIComponent(sheetId)}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("تعذر تحميل بيانات شيت إجراءات التقييم.");
  }
  const parsed = (await response.json()) as {
    _id?: string;
    name?: string;
    headers?: string[];
    rows?: Record<string, ValuationExcelCellValue>[];
  };
  return {
    id: parsed._id ?? sheetId,
    name: parsed.name ?? "Sheet",
    headers: Array.isArray(parsed.headers) ? parsed.headers.map((header) => String(header ?? "")) : [],
    rows: Array.isArray(parsed.rows) ? parsed.rows : [],
  };
}

function excelCellDisplay(value: ValuationExcelCellValue | undefined) {
  if (value === null || value === undefined || value === "") return "(فارغ)";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  return cleanAccountingText(String(value));
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font: string,
) {
  const normalized = cleanAccountingText(text).replace(/\s+/g, " ").trim();
  if (!normalized) return [""];
  ctx.font = font;
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  const pushLongWord = (word: string) => {
    let part = "";
    Array.from(word).forEach((char) => {
      const next = `${part}${char}`;
      if (part && ctx.measureText(next).width > maxWidth) {
        lines.push(part);
        part = char;
      } else {
        part = next;
      }
    });
    current = part;
  };

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      return;
    }
    if (current) lines.push(current);
    if (ctx.measureText(word).width > maxWidth) {
      pushLongWord(word);
    } else {
      current = word;
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

async function renderValuationExcelRowsImageDataUrl({
  sheet,
  visibleHeaders,
  columnSizes,
  rowStart,
  rowEnd,
  rowHeight,
  columnWidthMul,
  cellFont,
  headerFont,
  padX,
  padY,
  qualityScale,
}: {
  sheet: ValuationExcelSheetDetails;
  visibleHeaders?: string[];
  columnSizes?: Record<string, { widthPx?: number; minHeightPx?: number }>;
  rowStart: number;
  rowEnd: number;
  rowHeight: number;
  columnWidthMul: number;
  cellFont: number;
  headerFont: number;
  padX: number;
  padY: number;
  qualityScale: number;
}) {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }

  const headers = normalizeVisibleExcelHeaders(sheet, visibleHeaders);
  const rows = sheet.rows.slice(Math.max(0, rowStart), Math.max(rowStart, rowEnd));
  if (rows.length === 0) throw new Error("لا توجد صفوف صالحة لتوليد صورة Excel.");

  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  if (!measureCtx) throw new Error("تعذر تجهيز قياس صورة Excel.");

  const fontFamily = "Arial, Tahoma, sans-serif";
  const headerFontPx = Math.max(10, Math.round(headerFont));
  const cellFontPx = Math.max(10, Math.round(cellFont));
  const cellPadX = Math.round(Math.min(32, Math.max(2, padX)));
  const cellPadY = Math.round(Math.min(32, Math.max(2, padY)));
  const headerPadX = Math.max(10, cellPadX);
  const headerPadY = Math.max(8, cellPadY);
  const headerLineHeight = Math.ceil(headerFontPx * 1.38);
  const cellLineHeight = Math.ceil(cellFontPx * 1.36);
  const headerFontCss = `900 ${headerFontPx}px ${fontFamily}`;
  const cellFontCss = `900 ${cellFontPx}px ${fontFamily}`;
  const baseColumnWidth = Math.max(88, Math.round(132 * Math.max(0.6, columnWidthMul)));

  const columns = headers.map((header) => ({
    label: cleanAccountingText(header),
    key: header,
    width: normalizeExcelColumnSize(columnSizes?.[header]).widthPx ?? baseColumnWidth,
    minHeight: normalizeExcelColumnSize(columnSizes?.[header]).minHeightPx,
  }));
  const imageRows = rows.map((row) => ({
    values: headers.map((header) => excelCellDisplay(row[header])),
  }));

  const textWidthPad = 28;
  columns.forEach((column, columnIndex) => {
    let maxLineWidth = 0;
    measureCtx.font = headerFontCss;
    maxLineWidth = Math.max(maxLineWidth, measureCtx.measureText(column.label).width);
    imageRows.forEach((row) => {
      measureCtx.font = cellFontCss;
      maxLineWidth = Math.max(maxLineWidth, measureCtx.measureText(row.values[columnIndex] ?? "").width);
    });
    column.width = Math.max(column.width, Math.ceil(maxLineWidth + cellPadX * 2 + textWidthPad));
  });

  const visualColumns = [...columns].reverse();
  const visualRows = imageRows.map((row) => ({ values: [...row.values].reverse() }));
  const headerHeight = Math.max(
    42,
    ...visualColumns.map((column) => {
      const lines = wrapCanvasText(measureCtx, column.label, column.width - headerPadX * 2, headerFontCss);
      return lines.length * headerLineHeight + headerPadY * 2;
    }),
  );
  const rowHeights = visualRows.map((row) =>
    Math.max(
      rowHeight,
      ...row.values.map((value, index) => {
        const column = visualColumns[index];
        const width = column?.width ?? baseColumnWidth;
        const lines = wrapCanvasText(measureCtx, value, width - cellPadX * 2, cellFontCss);
        return Math.max(column?.minHeight ?? 0, lines.length * cellLineHeight + cellPadY * 2);
      }),
    ),
  );

  const bleed = 8;
  const tableWidth = visualColumns.reduce((sum, column) => sum + column.width, 0);
  const tableHeight = headerHeight + rowHeights.reduce((sum, height) => sum + height, 0);
  const cssWidth = Math.ceil(tableWidth + bleed * 2 + 2);
  const cssHeight = Math.ceil(tableHeight + bleed * 2 + 2);
  const requestedScale = Math.max(
    2.5,
    qualityScale * 1.35,
    typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  );
  const maxCanvasSide = 30000;
  const maxCanvasPixels = 120_000_000;
  const scaleLimit = Math.min(
    requestedScale,
    maxCanvasSide / cssWidth,
    maxCanvasSide / cssHeight,
    Math.sqrt(maxCanvasPixels / Math.max(1, cssWidth * cssHeight)),
  );
  const safeScale = Number.isFinite(scaleLimit) && scaleLimit > 0 ? scaleLimit : 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(cssWidth * safeScale));
  canvas.height = Math.max(1, Math.ceil(cssHeight * safeScale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذر إنشاء صورة Excel.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.scale(safeScale, safeScale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cssWidth, cssHeight);
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const drawText = (
    text: string,
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
    font: string,
    lineHeight: number,
    color: string,
    horizontalPad: number,
  ) => {
    const lines = wrapCanvasText(ctx, text, Math.max(20, boxW - horizontalPad * 2), font);
    ctx.font = font;
    ctx.fillStyle = color;
    const totalTextHeight = lines.length * lineHeight;
    const startY = boxY + boxH / 2 - totalTextHeight / 2 + lineHeight / 2;
    lines.forEach((line, index) => {
      ctx.fillText(line, Math.round(boxX + boxW / 2), Math.round(startY + index * lineHeight));
    });
  };

  let x = bleed;
  let y = bleed;
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(bleed + 0.5, y + 0.5, tableWidth, tableHeight);

  visualColumns.forEach((column) => {
    ctx.fillStyle = "#0C447C";
    ctx.fillRect(x, y, column.width, headerHeight);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.strokeRect(x + 0.5, y + 0.5, column.width, headerHeight);
    drawText(column.label, x, y, column.width, headerHeight, headerFontCss, headerLineHeight, "#ffffff", headerPadX);
    x += column.width;
  });
  y += headerHeight;

  visualRows.forEach((row, rowIndex) => {
    x = bleed;
    const h = rowHeights[rowIndex] ?? rowHeight;
    row.values.forEach((value, columnIndex) => {
      const width = visualColumns[columnIndex]?.width ?? baseColumnWidth;
      ctx.fillStyle = rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc";
      ctx.fillRect(x, y, width, h);
      ctx.strokeStyle = "#e2e8f0";
      ctx.strokeRect(x + 0.5, y + 0.5, width, h);
      drawText(value, x, y, width, h, cellFontCss, cellLineHeight, "#0f172a", cellPadX);
      x += width;
    });
    y += h;
  });

  return canvas.toDataURL("image/png");
}

function normalizeExcelPdfRowsPerImage(value: unknown) {
  const n = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(n)) return DEFAULT_EXCEL_PDF_ROWS_PER_IMAGE;
  return Math.max(
    MIN_EXCEL_PDF_ROWS_PER_IMAGE,
    Math.min(MAX_EXCEL_PDF_ROWS_PER_IMAGE, Math.round(n)),
  );
}

function excelPdfCellText(cell: unknown) {
  if (!cell || typeof cell !== "object") return "";
  const c = cell as { w?: unknown; v?: unknown };
  if (typeof c.w === "string") return cleanAccountingText(c.w);
  if (c.v === null || c.v === undefined) return "";
  if (c.v instanceof Date) return c.v.toLocaleDateString("ar-SA");
  return cleanAccountingText(String(c.v));
}

function clampExcelPdfDimension(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function excelPdfColumnWidth(raw: unknown) {
  const col = raw && typeof raw === "object" ? (raw as { wpx?: unknown; width?: unknown; wch?: unknown }) : {};
  if (typeof col.wpx === "number" && Number.isFinite(col.wpx)) {
    return clampExcelPdfDimension(col.wpx, EXCEL_PDF_MIN_COLUMN_WIDTH_PX, EXCEL_PDF_MAX_COLUMN_WIDTH_PX);
  }
  if (typeof col.width === "number" && Number.isFinite(col.width)) {
    return clampExcelPdfDimension(
      col.width * 9 + EXCEL_PDF_CELL_PAD_X_PX * 2,
      EXCEL_PDF_MIN_COLUMN_WIDTH_PX,
      EXCEL_PDF_MAX_COLUMN_WIDTH_PX,
    );
  }
  if (typeof col.wch === "number" && Number.isFinite(col.wch)) {
    return clampExcelPdfDimension(
      col.wch * 9 + EXCEL_PDF_CELL_PAD_X_PX * 2,
      EXCEL_PDF_MIN_COLUMN_WIDTH_PX,
      EXCEL_PDF_MAX_COLUMN_WIDTH_PX,
    );
  }
  return EXCEL_PDF_DEFAULT_COLUMN_WIDTH_PX;
}

async function readExcelSheetsForPdf(
  file: File,
  options?: { firstSheetOnly?: boolean; sheetRows?: number },
): Promise<ExcelPdfSheet[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
    raw: false,
    sheetStubs: true,
  });

  const sheets: ExcelPdfSheet[] = [];
  const sheetNames = options?.firstSheetOnly ? workbook.SheetNames.slice(0, 1) : workbook.SheetNames;
  for (const sheetName of sheetNames) {
    const worksheet = workbook.Sheets[sheetName] as
      | (Record<string, unknown> & {
          "!ref"?: string;
          "!cols"?: unknown[];
        })
      | undefined;
    if (!worksheet?.["!ref"]) continue;
    const range = XLSX.utils.decode_range(worksheet["!ref"]);
    const firstCol = range.s.c;
    const lastCol = range.e.c;
    const rowsLimit =
      options?.sheetRows && options.sheetRows > 0
        ? normalizeExcelPdfRowsPerImage(options.sheetRows)
        : null;
    let firstRow = range.s.r;

    if (rowsLimit) {
      let foundContentRow = false;
      for (let r = range.s.r; r <= range.e.r; r += 1) {
        for (let c = firstCol; c <= lastCol; c += 1) {
          if (excelPdfCellText(worksheet[XLSX.utils.encode_cell({ r, c })]).trim()) {
            firstRow = r;
            foundContentRow = true;
            break;
          }
        }
        if (foundContentRow) break;
      }
    }

    const lastRow = rowsLimit ? Math.min(range.e.r, firstRow + rowsLimit - 1) : range.e.r;
    const rawRows: string[][] = [];
    let minContentRow = Number.POSITIVE_INFINITY;
    let maxContentRow = -1;
    let minContentCol = Number.POSITIVE_INFINITY;
    let maxContentCol = -1;

    for (let r = firstRow; r <= lastRow; r += 1) {
      const row: string[] = [];
      for (let c = firstCol; c <= lastCol; c += 1) {
        const text = excelPdfCellText(worksheet[XLSX.utils.encode_cell({ r, c })]);
        if (text.trim()) {
          const rowIndex = rawRows.length;
          minContentRow = Math.min(minContentRow, rowIndex);
          maxContentRow = Math.max(maxContentRow, rowIndex);
          minContentCol = Math.min(minContentCol, c);
          maxContentCol = Math.max(maxContentCol, c);
        }
        row.push(text);
      }
      rawRows.push(row);
    }

    if (maxContentRow < 0 || maxContentCol < minContentCol) continue;
    const colStart = Math.max(0, minContentCol - firstCol);
    const colEnd = Math.max(colStart, maxContentCol - firstCol);
    const rows = rawRows
      .slice(Math.max(0, minContentRow), maxContentRow + 1)
      .map((row) => row.slice(colStart, colEnd + 1));
    const colCount = Math.max(1, colEnd - colStart + 1);
    const rawCols = Array.isArray(worksheet["!cols"]) ? worksheet["!cols"] : [];
    const columnWidths = Array.from({ length: colCount }, (_, index) =>
      excelPdfColumnWidth(rawCols[minContentCol + index]),
    );
    sheets.push({
      name: cleanAccountingText(sheetName) || "Sheet",
      rows,
      columnWidths,
      rowCount: rows.length,
      columnCount: colCount,
    });
  }

  if (sheets.length === 0) {
    throw new Error("لم يتم العثور على شيت صالح داخل ملف Excel.");
  }
  return sheets;
}

function renderExcelPdfPageDataUrl(
  sheet: ExcelPdfSheet,
  rowStart: number,
  rowEnd: number,
): string {
  const rows = sheet.rows.slice(Math.max(0, rowStart), Math.max(rowStart + 1, rowEnd));
  const visibleRows = rows.length > 0 ? rows : [Array.from({ length: Math.max(1, sheet.columnCount) }, () => "")];
  const colCount = Math.max(sheet.columnCount, ...visibleRows.map((row) => row.length), 1);
  const fontFamily = "Calibri, Arial, sans-serif";
  const cellFont = `${EXCEL_PDF_CELL_FONT_PX}px ${fontFamily}`;
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  if (!measureCtx) throw new Error("تعذر إنشاء صورة معاينة Excel.");
  measureCtx.font = cellFont;
  const columnWidths = Array.from({ length: colCount }, (_, index) => {
    const base = sheet.columnWidths[index] ?? EXCEL_PDF_DEFAULT_COLUMN_WIDTH_PX;
    let measured = base;
    for (const row of visibleRows) {
      const text = row[index] ?? "";
      if (text) {
        measured = Math.max(measured, measureCtx.measureText(text).width + EXCEL_PDF_CELL_PAD_X_PX * 2);
      }
    }
    return clampExcelPdfDimension(
      measured,
      EXCEL_PDF_MIN_COLUMN_WIDTH_PX,
      EXCEL_PDF_MAX_COLUMN_WIDTH_PX,
    );
  });
  const tableWidth = Math.max(1, columnWidths.reduce((sum, width) => sum + width, 0));
  const tableHeight = Math.max(EXCEL_PDF_ROW_HEIGHT_PX, visibleRows.length * EXCEL_PDF_ROW_HEIGHT_PX);
  const cssWidth = tableWidth + EXCEL_PDF_CONTENT_PADDING_PX * 2 + 1;
  const cssHeight = tableHeight + EXCEL_PDF_CONTENT_PADDING_PX * 2 + 1;
  const pixelScale = Math.min(
    EXCEL_PDF_RENDER_SCALE,
    Math.sqrt(EXCEL_PDF_MAX_CANVAS_PIXELS / Math.max(1, cssWidth * cssHeight)),
    EXCEL_PDF_MAX_CANVAS_DIMENSION_PX / Math.max(1, cssWidth),
    EXCEL_PDF_MAX_CANVAS_DIMENSION_PX / Math.max(1, cssHeight),
  );
  const renderScale = Number.isFinite(pixelScale) && pixelScale > 0 ? pixelScale : 1;

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(cssWidth * renderScale));
  canvas.height = Math.max(1, Math.ceil(cssHeight * renderScale));
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("تعذر إنشاء صورة معاينة Excel.");
  ctx.scale(renderScale, renderScale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  ctx.save();
  ctx.translate(EXCEL_PDF_CONTENT_PADDING_PX, EXCEL_PDF_CONTENT_PADDING_PX);
  ctx.strokeStyle = "#d9e1e8";
  ctx.lineWidth = 1 / renderScale;
  ctx.textBaseline = "middle";

  let y = 0;
  visibleRows.forEach((row) => {
    let x = 0;
    for (let colIndex = 0; colIndex < colCount; colIndex += 1) {
      const width = columnWidths[colIndex] ?? EXCEL_PDF_DEFAULT_COLUMN_WIDTH_PX;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, width, EXCEL_PDF_ROW_HEIGHT_PX);
      ctx.strokeStyle = "#d9e1e8";
      ctx.strokeRect(
        x + 0.5 / renderScale,
        y + 0.5 / renderScale,
        width,
        EXCEL_PDF_ROW_HEIGHT_PX,
      );

      const text = row[colIndex] ?? "";
      if (text) {
        const isArabic = /[\u0600-\u06FF]/.test(text);
        ctx.save();
        ctx.beginPath();
        ctx.rect(
          x + EXCEL_PDF_CELL_PAD_X_PX / 2,
          y + 2,
          Math.max(1, width - EXCEL_PDF_CELL_PAD_X_PX),
          Math.max(1, EXCEL_PDF_ROW_HEIGHT_PX - 4),
        );
        ctx.clip();
        ctx.font = cellFont;
        ctx.direction = isArabic ? "rtl" : "ltr";
        ctx.textAlign = isArabic ? "right" : "left";
        ctx.fillStyle = "#111827";
        ctx.fillText(
          text,
          isArabic ? x + width - EXCEL_PDF_CELL_PAD_X_PX : x + EXCEL_PDF_CELL_PAD_X_PX,
          y + EXCEL_PDF_ROW_HEIGHT_PX / 2,
        );
        ctx.restore();
      }
      x += width;
    }
    y += EXCEL_PDF_ROW_HEIGHT_PX;
  });

  ctx.restore();
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1 / renderScale;
  ctx.strokeRect(
    EXCEL_PDF_CONTENT_PADDING_PX + 0.5 / renderScale,
    EXCEL_PDF_CONTENT_PADDING_PX + 0.5 / renderScale,
    tableWidth,
    tableHeight,
  );
  return canvas.toDataURL("image/png");
}

function excelPdfPageRanges(sheet: ExcelPdfSheet, rowsPerImage: number) {
  const n = normalizeExcelPdfRowsPerImage(rowsPerImage);
  const ranges: { start: number; end: number }[] = [];
  for (let start = 0; start < sheet.rows.length; start += n) {
    ranges.push({ start, end: Math.min(sheet.rows.length, start + n) });
  }
  return ranges.length > 0 ? ranges : [{ start: 0, end: Math.min(sheet.rows.length, n) }];
}

async function buildExcelPdfPreviewFromOriginalFile(file: File, rowsPerImage: number) {
  const normalizedRows = normalizeExcelPdfRowsPerImage(rowsPerImage);
  const sheets = await readExcelSheetsForPdf(file, {
    firstSheetOnly: true,
    sheetRows: normalizedRows,
  });
  const firstSheet = sheets[0]!;
  const previewDataUrl = renderExcelPdfPageDataUrl(
    firstSheet,
    0,
    Math.min(firstSheet.rows.length, normalizedRows),
  );
  return {
    previewDataUrl,
    estimatedImageCount: 1,
    sheetName: firstSheet.name,
    rowCount: firstSheet.rowCount,
    columnCount: firstSheet.columnCount,
  };
}

async function buildExcelPdfFromOriginalFile(
  file: File,
  options: { rowsPerImage: number },
): Promise<{
  pdfFile: File;
  previewDataUrl: string;
  estimatedImageCount: number;
  sheetName: string;
  rowCount: number;
  columnCount: number;
}> {
  const sheets = await readExcelSheetsForPdf(file);
  const rowsPerImage = normalizeExcelPdfRowsPerImage(options.rowsPerImage);
  const pages: { dataUrl: string; sheet: ExcelPdfSheet; pageIndex: number; pageCount: number }[] = [];

  for (const sheet of sheets) {
    const ranges = excelPdfPageRanges(sheet, rowsPerImage);
    for (let pageIndex = 0; pageIndex < ranges.length; pageIndex += 1) {
      const range = ranges[pageIndex]!;
      pages.push({
        dataUrl: renderExcelPdfPageDataUrl(sheet, range.start, range.end),
        sheet,
        pageIndex,
        pageCount: ranges.length,
      });
    }
  }

  if (pages.length === 0) throw new Error("تعذر إنشاء PDF من ملف Excel.");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  for (let i = 0; i < pages.length; i += 1) {
    if (i > 0) pdf.addPage("a4", "landscape");
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const image = await loadImage(pages[i]!.dataUrl);
    const fit = Math.min(pageW / Math.max(1, image.naturalWidth), pageH / Math.max(1, image.naturalHeight));
    const drawW = image.naturalWidth * fit;
    const drawH = image.naturalHeight * fit;
    pdf.addImage(
      pages[i]!.dataUrl,
      "PNG",
      (pageW - drawW) / 2,
      (pageH - drawH) / 2,
      drawW,
      drawH,
      undefined,
      "FAST",
    );
  }

  const firstSheet = pages[0]!.sheet;
  return {
    pdfFile: new File([pdf.output("blob")], `${safeImageFileBaseName(file.name)}.pdf`, {
      type: "application/pdf",
    }),
    previewDataUrl: pages[0]!.dataUrl,
    estimatedImageCount: pages.length,
    sheetName: firstSheet.name,
    rowCount: sheets.reduce((sum, sheet) => sum + sheet.rowCount, 0),
    columnCount: firstSheet.columnCount,
  };
}

type ExcelAutoImageJob = {
  sheet: ValuationExcelSheetDetails;
  visibleHeaders: string[];
  columnSizes: Record<string, { widthPx?: number; minHeightPx?: number }>;
  range: { start: number; end: number };
  pageIndex: number;
  rangesLength: number;
  cleanSourceName: string;
};

async function buildAutomaticExcelImages({
  projectId,
  source,
  rowsPerImage,
  rowHeight,
  columnWidthMul,
  cellFont,
  headerFont,
  padX,
  padY,
  qualityScale,
  onProgress,
}: {
  projectId: string;
  source: MvValuationAccountingSourceFile;
  rowsPerImage: number;
  rowHeight: number;
  columnWidthMul: number;
  cellFont: number;
  headerFont: number;
  padX: number;
  padY: number;
  qualityScale: number;
  onProgress?: AccountFileProgressCb;
}) {
  const importResult = source.importResult;
  const sheets = importResult?.summary.sheets ?? [];
  const cleanSourceName = cleanAccountingText(source.name);
  const normalizedRowsPerImage = normalizeExcelRowsPerImage(rowsPerImage);

  await flushProgress(onProgress, 0, 0, "تحضير شيتات Excel");

  const jobs: ExcelAutoImageJob[] = [];
  for (const sheetStat of sheets) {
    const sheet = await fetchValuationExcelSheet(sheetStat.importId);
    const sheetKey = excelSheetSettingsKey(sheetStat.importId, sheetStat.sheetName);
    const visibleHeaders = normalizeVisibleExcelHeaders(sheet, source.excelVisibleColumnsBySheet?.[sheetKey]);
    const columnSizes = source.excelColumnSizesBySheet?.[sheetKey] ?? {};
    const ranges = distributeExcelImageRanges(sheet.rows.length, normalizedRowsPerImage);
    for (let pageIndex = 0; pageIndex < ranges.length; pageIndex += 1) {
      const range = ranges[pageIndex]!;
      jobs.push({
        sheet,
        visibleHeaders,
        columnSizes,
        range,
        pageIndex,
        rangesLength: ranges.length,
        cleanSourceName,
      });
    }
  }

  const total = jobs.length;
  if (total === 0) {
    await flushProgress(onProgress, 0, 0, "لا توجد صور لتوليدها");
    return [];
  }

  await flushProgress(onProgress, 0, total, "توليد ورفع صور الجداول");

  const images: MvValuationAccountingImage[] = [];
  let done = 0;

  for (let i = 0; i < jobs.length; i += EXCEL_IMAGE_CONCURRENCY) {
    const batch = jobs.slice(i, i + EXCEL_IMAGE_CONCURRENCY);
    const batchImages = await Promise.all(
      batch.map(async (job) => {
        const dataUrl = await renderValuationExcelRowsImageDataUrl({
          sheet: job.sheet,
          visibleHeaders: job.visibleHeaders,
          columnSizes: job.columnSizes,
          rowStart: job.range.start,
          rowEnd: job.range.end,
          rowHeight,
          columnWidthMul,
          cellFont,
          headerFont,
          padX,
          padY,
          qualityScale,
        });
        const blob = await fetch(dataUrl).then((response) => response.blob());
        const pageLabel = job.rangesLength > 1 ? `-${job.pageIndex + 1}-of-${job.rangesLength}` : "";
        const file = new File(
          [blob],
          `${safeImageFileBaseName(job.cleanSourceName)}-${safeImageFileBaseName(job.sheet.name)}${pageLabel}.png`,
          { type: "image/png" },
        );
        const fileId = await uploadProjectFileAndReturnId(projectId, file, { valuationAccounting: true });
        const pageText = job.rangesLength > 1 ? ` - صورة ${job.pageIndex + 1} من ${job.rangesLength}` : "";
        const img: MvValuationAccountingImage = {
          id: createId("account-image"),
          approachId: source.approachId,
          sourceId: source.id,
          sourceKind: "excel",
          sourceFileName: job.cleanSourceName,
          name: `${approachLabel(source.approachId)} - ${job.cleanSourceName} - ${cleanAccountingText(job.sheet.name)}${pageText}`,
          fileId,
          createdAt: new Date().toISOString(),
          displayWidthPercent: 88,
          displayMaxHeightPx: 960,
          qualityScale: 1,
          includeInReport: true,
          autoGenerated: true,
          autoPageIndex: job.pageIndex + 1,
          autoPageCount: job.rangesLength,
          autoRowsPerImage: normalizedRowsPerImage,
          crop: {
            sheetName: job.sheet.name,
            pageNumber: job.pageIndex + 1,
            x: 1,
            y: job.range.start + 1,
            width: Math.max(1, job.visibleHeaders.length),
            height: job.range.end - job.range.start,
          },
        };
        return img;
      }),
    );
    images.push(...batchImages);
    done += batch.length;
    await flushProgress(onProgress, done, total, "توليد ورفع صور الجداول");
  }

  return images;
}

function rowsForMvApiPut(rows: Record<string, ValuationExcelCellValue>[]): Record<string, string | number | null>[] {
  return rows.map((row) => {
    const o: Record<string, string | number | null> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined) o[k] = null;
      else if (typeof v === "number" && Number.isFinite(v)) o[k] = v;
      else if (typeof v === "boolean") o[k] = v ? "true" : "false";
      else o[k] = String(v);
    }
    return o;
  });
}

async function updateValuationExcelSheet(
  sheetId: string,
  body: { name?: string; headers?: string[]; rows?: Record<string, ValuationExcelCellValue>[] },
): Promise<void> {
  const response = await fetch(`/api/mv/sheets/${encodeURIComponent(sheetId)}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      ...(body.rows ? { rows: rowsForMvApiPut(body.rows) } : {}),
    }),
  });
  if (!response.ok) {
    let message = "تعذر حفظ تغييرات الشيت.";
    try {
      const j = (await response.json()) as { message?: string | string[] };
      if (j.message) message = Array.isArray(j.message) ? j.message.join(" ") : String(j.message);
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
}

type MvCropColumnFilter = { mode: "contains" | "equals"; value: string };

function mvCropFilterActive(filter: MvCropColumnFilter | undefined) {
  return Boolean(filter?.value?.trim());
}

function uniqueMvHeaderLabel(base: string, existing: string[]) {
  let label = base;
  let n = 2;
  while (existing.includes(label)) {
    label = `${base} (${n})`;
    n += 1;
  }
  return label;
}

function ValuationExcelCropGrid({
  sheet,
  sheetId,
  visibleColumnKeys,
  columnSizes,
  rowHeight,
  columnWidthMul,
  cellFont,
  headerFont,
  padX,
  padY,
  previewZoom,
  onVisibleColumnKeysChange,
  onColumnSizeChange,
  onSheetSynced,
}: {
  sheet: ValuationExcelSheetDetails;
  sheetId: string;
  visibleColumnKeys: string[];
  columnSizes: Record<string, { widthPx?: number; minHeightPx?: number }>;
  rowHeight: number;
  columnWidthMul: number;
  cellFont: number;
  headerFont: number;
  padX: number;
  padY: number;
  previewZoom: number;
  onVisibleColumnKeysChange: (columns: string[]) => void;
  onColumnSizeChange: (column: string, size: { widthPx?: number; minHeightPx?: number }) => void;
  onSheetSynced: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const [columnFilters, setColumnFilters] = useState<Record<number, MvCropColumnFilter>>({});
  const [mutationBusy, setMutationBusy] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameColumnNumber, setRenameColumnNumber] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [sizeOpen, setSizeOpen] = useState(false);
  const [sizeColumnNumber, setSizeColumnNumber] = useState<number | null>(null);
  const [sizeWidthDraft, setSizeWidthDraft] = useState("");
  const [sizeHeightDraft, setSizeHeightDraft] = useState("");

  const columns = sheet.headers.length > 0 ? sheet.headers : ["Column 1"];
  const visibleSet = useMemo(() => {
    const visible = normalizeVisibleExcelHeaders(sheet, visibleColumnKeys);
    return new Set(visible);
  }, [sheet, visibleColumnKeys]);
  const visibleColumns = columns.filter((header) => visibleSet.has(header));
  const defaultColumnWidth = Math.max(88, Math.round(132 * Math.max(0.6, columnWidthMul)));
  const getColumnSize = (header: string) => normalizeExcelColumnSize(columnSizes[header]);
  const autoColumnWidths = useMemo(() => {
    const widths: Record<string, number> = {};
    columns.forEach((header) => {
      let maxChars = Array.from(cleanAccountingText(header)).length;
      sheet.rows.forEach((row) => {
        maxChars = Math.max(maxChars, Array.from(excelCellDisplay(row[header])).length);
      });
      widths[header] = Math.min(900, Math.max(defaultColumnWidth, Math.ceil(maxChars * Math.max(8, cellFont * 0.72) + padX * 2 + 34)));
    });
    return widths;
  }, [cellFont, columns, defaultColumnWidth, padX, sheet.rows]);
  const getColumnWidth = (header: string) => getColumnSize(header).widthPx ?? autoColumnWidths[header] ?? defaultColumnWidth;
  const getColumnMinHeight = (header: string) => getColumnSize(header).minHeightPx ?? rowHeight;

  const visibleRowEntries = useMemo(() => {
    return sheet.rows
      .map((row, i) => ({ rowNumber: i + 1, row }))
      .filter(({ rowNumber, row }) => {
        for (const [colKey, filter] of Object.entries(columnFilters)) {
          if (!mvCropFilterActive(filter)) continue;
          const col = Number(colKey);
          const headerKey = sheet.headers[col - 1];
          if (!headerKey) continue;
          const raw = row[headerKey];
          const cellText =
            raw === null || raw === undefined ? "" : cleanAccountingText(String(raw)).replace(/\s+/g, " ").trim();
          const needle = filter.value.trim();
          if (filter.mode === "equals") {
            if (cellText !== needle) return false;
          } else if (!cellText.includes(needle)) {
            return false;
          }
        }
        return true;
      });
  }, [sheet.rows, sheet.headers, columnFilters]);

  const runMutation = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      setMutationBusy(true);
      try {
        await fn();
        await onSheetSynced();
        toast({ description: label });
      } catch (error) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "تعذر تنفيذ العملية.",
        });
      } finally {
        setMutationBusy(false);
      }
    },
    [onSheetSynced, toast],
  );

  const openRename = useCallback((columnNumber: number) => {
    const h = sheet.headers[columnNumber - 1];
    setRenameDraft(h ? cleanAccountingText(h) : "");
    setRenameColumnNumber(columnNumber);
    setRenameOpen(true);
  }, [sheet.headers]);

  const openSizeDialog = useCallback((columnNumber: number) => {
    const h = sheet.headers[columnNumber - 1];
    if (!h) return;
    const size = getColumnSize(h);
    setSizeColumnNumber(columnNumber);
    setSizeWidthDraft(String(size.widthPx ?? getColumnWidth(h)));
    setSizeHeightDraft(String(size.minHeightPx ?? rowHeight));
    setSizeOpen(true);
  }, [columnSizes, rowHeight, sheet.headers]);

  const applySizeDialog = useCallback(() => {
    if (sizeColumnNumber == null) return;
    const h = sheet.headers[sizeColumnNumber - 1];
    if (!h) return;
    const width = Math.min(900, Math.max(72, Math.round(Number(sizeWidthDraft) || getColumnWidth(h))));
    const minHeight = Math.min(180, Math.max(28, Math.round(Number(sizeHeightDraft) || rowHeight)));
    onColumnSizeChange(h, { widthPx: width, minHeightPx: minHeight });
    setSizeOpen(false);
    setSizeColumnNumber(null);
  }, [
    getColumnWidth,
    onColumnSizeChange,
    rowHeight,
    sheet.headers,
    sizeColumnNumber,
    sizeHeightDraft,
    sizeWidthDraft,
  ]);

  const applyRename = useCallback(() => {
    if (renameColumnNumber == null) return;
    const colIdx = renameColumnNumber - 1;
    const oldKey = sheet.headers[colIdx];
    const newKey = renameDraft.trim();
    if (!oldKey || !newKey || newKey === oldKey) {
      setRenameOpen(false);
      return;
    }
    if (sheet.headers.some((h, i) => i !== colIdx && h === newKey)) {
      toast({ variant: "destructive", description: "يوجد عمود بنفس الاسم بالفعل." });
      return;
    }
    const nextHeaders = [...sheet.headers];
    nextHeaders[colIdx] = newKey;
    const nextRows = sheet.rows.map((r) => {
      const { [oldKey]: val, ...rest } = r;
      return { ...rest, [newKey]: val } as Record<string, ValuationExcelCellValue>;
    });
    void runMutation("تم تعديل اسم العمود.", () =>
      updateValuationExcelSheet(sheetId, { headers: nextHeaders, rows: nextRows }),
    );
    setRenameOpen(false);
    setRenameColumnNumber(null);
  }, [renameColumnNumber, renameDraft, runMutation, sheet.headers, sheet.rows, sheetId, toast]);

  const deleteColumn = useCallback(
    (columnNumber: number) => {
      if (sheet.headers.length <= 1) {
        toast({ variant: "destructive", description: "لا يمكن حذف آخر عمود في الشيت." });
        return;
      }
      const colIdx = columnNumber - 1;
      const key = sheet.headers[colIdx];
      if (!key) return;
      const nextHeaders = sheet.headers.filter((_, i) => i !== colIdx);
      const nextRows = sheet.rows.map((r) => {
        const copy = { ...r };
        delete copy[key];
        return copy;
      });
      void runMutation("تم حذف العمود.", () =>
        updateValuationExcelSheet(sheetId, { headers: nextHeaders, rows: nextRows }),
      );
    },
    [runMutation, sheet.headers, sheet.rows, sheetId, toast],
  );

  const addColumn = useCallback(() => {
    const label = uniqueMvHeaderLabel(`عمود ${sheet.headers.length + 1}`, sheet.headers);
    const nextHeaders = [...sheet.headers, label];
    const nextRows = sheet.rows.map((r) => ({ ...r, [label]: null }));
    void runMutation("تمت إضافة عمود.", () =>
      updateValuationExcelSheet(sheetId, { headers: nextHeaders, rows: nextRows }),
    );
  }, [runMutation, sheet.headers, sheet.rows, sheetId]);

  const addRow = useCallback(() => {
    const empty: Record<string, ValuationExcelCellValue> = {};
    sheet.headers.forEach((h) => {
      empty[h] = null;
    });
    const nextRows = [...sheet.rows, empty];
    void runMutation("تمت إضافة صف.", () =>
      updateValuationExcelSheet(sheetId, { headers: sheet.headers, rows: nextRows }),
    );
  }, [runMutation, sheet.headers, sheet.rows, sheetId]);

  const setColumnVisible = useCallback(
    (header: string, checked: boolean) => {
      const current = normalizeVisibleExcelHeaders(sheet, visibleColumnKeys);
      if (checked) {
        onVisibleColumnKeysChange(columns.filter((item) => item === header || current.includes(item)));
        return;
      }
      const next = current.filter((item) => item !== header);
      onVisibleColumnKeysChange(next.length > 0 ? next : current);
    },
    [columns, onVisibleColumnKeysChange, sheet, visibleColumnKeys],
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-md border border-slate-200 bg-white">
      <div
        className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-gradient-to-b from-slate-50/90 to-white px-2 py-1.5"
        data-sg-exclude-from-capture="1"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="max-w-[200px] truncate text-[11px] font-bold text-slate-800" title={sheet.name}>
            {cleanAccountingText(sheet.name)}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {sheet.rows.length} صف · {sheet.headers.length} عمود
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-[11px]"
            disabled={mutationBusy}
            onClick={() => addColumn()}
          >
            {mutationBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            عمود
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-[11px]"
            disabled={mutationBusy}
            onClick={() => addRow()}
          >
            {mutationBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            صف
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-2 py-2">
        <span className="text-[10px] font-black text-slate-700">الأعمدة الظاهرة في الصورة</span>
        {columns.map((header) => (
          <label
            key={`visible-${header}`}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 text-[10px] font-bold text-slate-700"
          >
            <input
              type="checkbox"
              checked={visibleSet.has(header)}
              onChange={(event) => setColumnVisible(header, event.currentTarget.checked)}
              className="h-3.5 w-3.5 accent-[#0C447C]"
            />
            <span className="max-w-[10rem] truncate">{cleanAccountingText(header)}</span>
          </label>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div
          className="inline-block min-w-full"
          style={
            previewZoom !== 1
              ? ({ zoom: previewZoom } as CSSProperties & { zoom?: number })
              : undefined
          }
        >
          <table
            data-account-crop-table="1"
            dir="rtl"
            className="border-separate border-spacing-0 text-right antialiased"
            style={{
              minWidth: Math.max(
                visibleColumns.reduce((sum, header) => sum + getColumnWidth(header), 0) + 52,
                1,
              ),
            }}
          >
            <thead className="sticky top-0 z-30 bg-[#0C447C] shadow-[0_2px_0_#062640]">
              <tr>
                <th
                  className="sticky right-0 z-40 border-b border-[#0a3560] bg-[#0C447C] px-1 py-2 text-center text-[10px] font-extrabold text-white"
                  style={{ width: 52, minWidth: 52, maxWidth: 52 }}
                >
                  رقم
                </th>
                {visibleColumns.map((header) => {
                  const columnNumber = columns.indexOf(header) + 1;
                  const filter = columnFilters[columnNumber];
                  const filtered = mvCropFilterActive(filter);
                  return (
                    <th
                      key={`${sheet.id}-h-${columnNumber}`}
                      data-sg-hcol={columnNumber}
                      className={cn(
                        "border-b border-l px-2 py-2 text-center align-middle font-extrabold text-white",
                        "border-l-white/20 bg-[#0C447C]",
                      )}
                      style={{
                        minWidth: getColumnWidth(header),
                        width: getColumnWidth(header),
                        overflow: "visible",
                      }}
                    >
                      <div className="flex w-full min-w-0 items-start gap-2">
                        <div className="min-w-0 flex-1 text-center text-white">
                          <div
                            data-account-crop-header-label="1"
                            className="line-clamp-3 min-w-0 break-words px-0.5 font-extrabold leading-snug"
                            style={{ fontSize: headerFont }}
                          >
                            {cleanAccountingText(header)}
                          </div>
                        </div>
                        <div
                          data-sg-exclude-from-capture="1"
                          className="flex shrink-0 flex-col gap-0.5 border-r border-white/25 pe-1.5"
                        >
                          <label
                            title="إظهار في الصورة"
                            className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-white/35 bg-white/10 text-amber-100 hover:bg-white/20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={visibleSet.has(header)}
                              onChange={(event) => setColumnVisible(header, event.currentTarget.checked)}
                              className="h-3.5 w-3.5 accent-amber-300"
                              aria-label={`إظهار ${cleanAccountingText(header)} في الصورة`}
                            />
                          </label>
                          <Popover modal={false}>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                title="فلترة"
                                onPointerDown={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                className={cn(
                                  "inline-flex h-6 w-6 items-center justify-center rounded border border-white/35 bg-white/10 text-white transition-colors hover:bg-white/20",
                                  filtered && "border-amber-400 bg-amber-200/90 text-amber-950",
                                )}
                                aria-label={`فلترة ${cleanAccountingText(header)}`}
                              >
                                <Filter className="h-3 w-3" strokeWidth={2.25} />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="z-[960] w-72 space-y-3 rounded-lg border p-3 shadow-md"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-slate-800">{cleanAccountingText(header)}</p>
                                <p className="text-xs text-slate-500">فلترة مؤقتة على المعاينة — أرقام الصفوف ثابتة.</p>
                              </div>
                              <div className="space-y-2">
                                <Select
                                  value={filter?.mode ?? "contains"}
                                  onValueChange={(value: "contains" | "equals") =>
                                    setColumnFilters((current) => ({
                                      ...current,
                                      [columnNumber]: {
                                        mode: value,
                                        value: current[columnNumber]?.value ?? "",
                                      },
                                    }))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="نوع المطابقة" />
                                  </SelectTrigger>
                                  <SelectContent className="z-[970]">
                                    <SelectItem value="contains">يحتوي على</SelectItem>
                                    <SelectItem value="equals">يساوي</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  placeholder="أدخل قيمة الفلترة"
                                  value={filter?.value ?? ""}
                                  onChange={(event) =>
                                    setColumnFilters((current) => ({
                                      ...current,
                                      [columnNumber]: {
                                        mode: current[columnNumber]?.mode ?? "contains",
                                        value: event.target.value,
                                      },
                                    }))
                                  }
                                />
                              </div>
                              <div className="flex items-center justify-between gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setColumnFilters((current) => {
                                      const next = { ...current };
                                      delete next[columnNumber];
                                      return next;
                                    })
                                  }
                                >
                                  مسح الفلتر
                                </Button>
                                <span className="text-xs text-slate-400">
                                  {filtered ? "الفلتر مفعّل" : "بدون فلتر"}
                                </span>
                              </div>
                            </PopoverContent>
                          </Popover>

                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                title="المزيد"
                                onPointerDown={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex h-6 w-6 items-center justify-center rounded border border-white/35 bg-white/10 text-white transition-colors hover:bg-white/20"
                                aria-label={`إجراءات ${cleanAccountingText(header)}`}
                              >
                                <MoreVertical className="h-3 w-3" strokeWidth={2.25} />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="z-[960] min-w-[10rem]">
                              <DropdownMenuItem
                                className="cursor-pointer"
                                disabled={mutationBusy}
                                onClick={() => openRename(columnNumber)}
                              >
                                <Pencil className="ml-2 h-3.5 w-3.5" />
                                تعديل اسم الرأس
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer"
                                disabled={mutationBusy}
                                onClick={() => openSizeDialog(columnNumber)}
                              >
                                <Settings className="ml-2 h-3.5 w-3.5" />
                                مقاس العمود
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer text-red-600 focus:text-red-600"
                                disabled={mutationBusy || sheet.headers.length <= 1}
                                onClick={() => deleteColumn(columnNumber)}
                              >
                                <Trash2 className="ml-2 h-3.5 w-3.5" />
                                حذف العمود
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRowEntries.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + 1}
                    className="border-b px-4 py-10 text-center text-sm font-medium text-slate-500"
                  >
                    لا توجد صفوف مطابقة للفلاتر الحالية
                  </td>
                </tr>
              ) : null}
              {visibleRowEntries.map(({ rowNumber, row }, visIdx) => (
                <tr
                  key={`${sheet.id}-r-${rowNumber}`}
                  className="border-b"
                  style={{
                    height: rowHeight,
                    background: visIdx % 2 === 0 ? "#ffffff" : "#f8fafc",
                  }}
                >
                  <td
                    className="sticky right-0 z-20 border-b px-1 py-0 text-center align-middle text-[12px] font-extrabold tabular-nums text-slate-950"
                    style={{
                      width: 52,
                      minWidth: 52,
                      maxWidth: 52,
                      height: rowHeight,
                      background: visIdx % 2 === 0 ? "#ffffff" : "#f8fafc",
                    }}
                  >
                    {rowNumber}
                  </td>
                  {visibleColumns.map((header) => {
                    const columnNumber = columns.indexOf(header) + 1;
                    const value = row[header];
                    const display =
                      value == null || value === "" ? "" : cleanAccountingText(String(value));
                    return (
                      <td
                        key={`${sheet.id}-r-${rowNumber}-c-${columnNumber}`}
                        data-sg-drow={rowNumber}
                        data-sg-dcol={columnNumber}
                        className="border-b border-l border-l-slate-300/90 text-center align-middle font-extrabold text-slate-950"
                        style={{
                          minWidth: getColumnWidth(header),
                          width: getColumnWidth(header),
                          height: getColumnMinHeight(header),
                          paddingLeft: padX,
                          paddingRight: padX,
                          paddingTop: padY,
                          paddingBottom: padY,
                          fontSize: cellFont,
                        }}
                      >
                        <div data-account-crop-cell-text="1" className="min-w-0 break-words text-center leading-snug">
                          {display || "(فارغ)"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="z-[940] sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل اسم عمود</DialogTitle>
            <DialogDescription>سيتم تحديث الشيت على الخادم فور التأكيد.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label className="text-xs font-bold text-slate-600">اسم الرأس الجديد</Label>
            <Input value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} dir="auto" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setRenameOpen(false)}>
              إلغاء
            </Button>
            <Button type="button" size="sm" onClick={() => applyRename()} disabled={mutationBusy}>
              {mutationBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sizeOpen} onOpenChange={setSizeOpen}>
        <DialogContent className="z-[940] sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>مقاس العمود</DialogTitle>
            <DialogDescription>يتأثر العرض في المعاينة والصور التي يتم توليدها من Excel.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <Label className="grid gap-1 text-xs font-bold text-slate-600">
              العرض بالبكسل
              <Input
                value={sizeWidthDraft}
                onChange={(e) => setSizeWidthDraft(e.target.value)}
                inputMode="numeric"
                dir="ltr"
              />
            </Label>
            <Label className="grid gap-1 text-xs font-bold text-slate-600">
              أقل ارتفاع للخلية
              <Input
                value={sizeHeightDraft}
                onChange={(e) => setSizeHeightDraft(e.target.value)}
                inputMode="numeric"
                dir="ltr"
              />
            </Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSizeOpen(false)}>
              إلغاء
            </Button>
            <Button type="button" size="sm" onClick={() => applySizeDialog()}>
              حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MvValuationAccountingWorkspace({
  projectId,
}: MvValuationAccountingWorkspaceProps) {
  const { navigate } = useMvInPageNavigation();
  const { toast } = useToast();
  const [project, setProject] = useState<MvProject | null>(null);
  const [store, setStore] = useState<MvValuationAccountingStore>(() =>
    emptyValuationAccountingStore(),
  );
  const [activeApproach, setActiveApproach] =
    useState<MvValuationAccountingApproachId>("market");
  const [uploadingKind, setUploadingKind] = useState<MvValuationAccountingFileKind | null>(null);
  const [accountingImageDropActive, setAccountingImageDropActive] = useState(false);
  const [fileProcessOverlay, setFileProcessOverlay] = useState<{
    phase: string;
    current: number;
    total: number;
    fileName?: string;
    startedAt: number;
  } | null>(null);
  const [, setFileProcessElapsedTick] = useState(0);
  const [editorSourceId, setEditorSourceId] = useState<string | null>(null);
  const [editorSaving, setEditorSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<MvValuationAccountingImage | null>(null);
  const [autoExcelBusySourceIds, setAutoExcelBusySourceIds] = useState<string[]>([]);
  const [pendingUploadPreview, setPendingUploadPreview] = useState<PendingUploadPreview | null>(null);
  const [pendingPreviewPixelPerfect, setPendingPreviewPixelPerfect] = useState(false);
  const [pendingPreviewZoom, setPendingPreviewZoom] = useState(1);
  const [pendingPreviewNatural, setPendingPreviewNatural] = useState<{ w: number; h: number } | null>(null);
  const [excelPreparingSourceIds, setExcelPreparingSourceIds] = useState<string[]>([]);
  const pendingUploadTokenRef = useRef(0);
  const uploadStopRequestedRef = useRef(false);

  const [excelGridOpen, setExcelGridOpen] = useState(false);
  const [excelColPicks, setExcelColPicks] = useState<number[]>([]);
  const [excelRowPicks, setExcelRowPicks] = useState<number[]>([]);
  const [excelIncludeHeader, setExcelIncludeHeader] = useState(true);
  const [excelCaptureBusy, setExcelCaptureBusy] = useState(false);
  const [excelGridRefresh, setExcelGridRefresh] = useState(0);
  const [excelPreviewRowHeight, setExcelPreviewRowHeight] = useState(50);
  const [excelPreviewColMul, setExcelPreviewColMul] = useState(1);
  const [excelPreviewCellFont, setExcelPreviewCellFont] = useState(15);
  const [excelPreviewHeaderFont, setExcelPreviewHeaderFont] = useState(14);
  const [excelPreviewPadX, setExcelPreviewPadX] = useState(12);
  const [excelPreviewPadY, setExcelPreviewPadY] = useState(8);
  const [excelPreviewZoom, setExcelPreviewZoom] = useState(1);
  const [excelCaptureBleed, setExcelCaptureBleed] = useState(3);
  const resetExcelPreviewSettings = useCallback(() => {
    setExcelPreviewRowHeight(50);
    setExcelPreviewColMul(1);
    setExcelPreviewCellFont(15);
    setExcelPreviewHeaderFont(14);
    setExcelPreviewPadX(12);
    setExcelPreviewPadY(8);
    setExcelPreviewZoom(1);
    setExcelCaptureBleed(3);
  }, []);
  const [valuationExcelSheet, setValuationExcelSheet] = useState<ValuationExcelSheetDetails | null>(null);
  const [valuationExcelSheetLoading, setValuationExcelSheetLoading] = useState(false);
  const [valuationExcelSheetError, setValuationExcelSheetError] = useState<string | null>(null);
  const mediaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mediaCanvasEpoch, setMediaCanvasEpoch] = useState(0);
  const bindMediaCanvas = useCallback((node: HTMLCanvasElement | null) => {
    mediaCanvasRef.current = node;
    if (node) setMediaCanvasEpoch((e) => e + 1);
  }, []);
  const mediaDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [mediaSelection, setMediaSelection] = useState<CropSelection | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaCaptureBusy, setMediaCaptureBusy] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [qualityScale, setQualityScale] = useState(DEFAULT_QUALITY_SCALE);
  const [pdfRenderScale, setPdfRenderScale] = useState(DEFAULT_PDF_RENDER_SCALE);
  const [mediaPreviewZoom, setMediaPreviewZoom] = useState(1);
  /** مقياس لملاءمة أبعاد البكسل للنافذة عند مُضاعف المعاينة = 1 */
  const [mediaLayoutFit, setMediaLayoutFit] = useState(1);
  /** أبعاد لوحة الرسم (بكسل الصورة / PDF) بعد آخر رسم */
  const [mediaIntrinsicSize, setMediaIntrinsicSize] = useState({ w: 0, h: 0 });
  const mediaViewportRef = useRef<HTMLDivElement | null>(null);
  const [mediaViewportHeight, setMediaViewportHeight] = useState(0);
  const [mediaViewportWidth, setMediaViewportWidth] = useState(0);
  const mediaZoomTouchedRef = useRef(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewPixelPerfect, setPreviewPixelPerfect] = useState(false);
  const [previewNatural, setPreviewNatural] = useState<{ w: number; h: number } | null>(null);
  const [previewEnhanceScale, setPreviewEnhanceScale] = useState(1.5);
  const [previewEnhanceContrast, setPreviewEnhanceContrast] = useState(1.12);
  const [previewEnhanceBrightness, setPreviewEnhanceBrightness] = useState(1.03);
  const [previewEnhanceBusy, setPreviewEnhanceBusy] = useState(false);
  const [previewSaving, setPreviewSaving] = useState(false);

  type CropHandle = "move" | "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
  const cropDragRef = useRef<{
    handle: CropHandle;
    startPoint: { x: number; y: number };
    startSel: CropSelection;
  } | null>(null);

  useEffect(() => {
    if (!fileProcessOverlay) return;
    const id = window.setInterval(() => setFileProcessElapsedTick((n) => n + 1), 450);
    return () => clearInterval(id);
  }, [fileProcessOverlay]);

  useEffect(() => {
    setPendingPreviewNatural(null);
    setPendingPreviewPixelPerfect(false);
    setPendingPreviewZoom(1);
  }, [pendingUploadPreview?.id]);

  const pushFileProcess = useCallback(
    (patch: { phase: string; current: number; total: number; fileName?: string }) => {
      setFileProcessOverlay((prev) => ({
        phase: patch.phase,
        current: patch.current,
        total: patch.total,
        fileName: patch.fileName ?? prev?.fileName,
        startedAt: prev?.startedAt ?? Date.now(),
      }));
    },
    [],
  );

  const editorSource = useMemo(
    () => store.sources.find((source) => source.id === editorSourceId) ?? null,
    [editorSourceId, store.sources],
  );

  const editorImages = useMemo(() => {
    if (!editorSourceId) return [];
    return store.images
      .filter((image) => image.sourceId === editorSourceId)
      .slice()
      .sort((a, b) => {
        const ap = a.autoPageIndex ?? 10_000;
        const bp = b.autoPageIndex ?? 10_000;
        if (ap !== bp) return ap - bp;
        return a.createdAt.localeCompare(b.createdAt);
      });
  }, [editorSourceId, store.images]);

  const serverSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAccountingSaveRef = useRef<MvValuationAccountingStore | null>(null);

  const flushAccountingWorkspaceToServer = useCallback(async () => {
    const snapshot = pendingAccountingSaveRef.current;
    pendingAccountingSaveRef.current = null;
    if (!snapshot) return;
    try {
      const res = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          valuationAccountingWorkspace: valuationAccountingStoreForApi(snapshot),
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { project?: MvProject };
        if (data.project) setProject(data.project);
      } else {
        toast({
          variant: "destructive",
          description: "تعذر مزامنة إجراءات التقييم مع الخادم. سيتم الإبقاء على النسخة المحلية.",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        description: "تعذر مزامنة إجراءات التقييم مع الخادم. سيتم الإبقاء على النسخة المحلية.",
      });
    }
  }, [projectId, toast]);

  const persistStore = useCallback(
    (updater: (current: MvValuationAccountingStore) => MvValuationAccountingStore) => {
      setStore((current) => {
        const next = updater(current);
        const ok = writeValuationAccountingStore(projectId, next);
        if (!ok) {
          toast({
            variant: "destructive",
            description:
              "تعذر حفظ كل بيانات الصور محلياً. قلل حجم الملف أو احذف بعض الصور الكبيرة.",
          });
        }
        pendingAccountingSaveRef.current = next;
        if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current);
        serverSaveTimerRef.current = setTimeout(() => {
          serverSaveTimerRef.current = null;
          void flushAccountingWorkspaceToServer();
        }, 650);
        return next;
      });
    },
    [projectId, toast, flushAccountingWorkspaceToServer],
  );

  const saveEditorModalAndClose = useCallback(async () => {
    if (serverSaveTimerRef.current) {
      clearTimeout(serverSaveTimerRef.current);
      serverSaveTimerRef.current = null;
    }
    pendingAccountingSaveRef.current = readValuationAccountingStore(projectId);
    setEditorSaving(true);
    try {
      await flushAccountingWorkspaceToServer();
      toast({ description: "تم حفظ التغييرات في قاعدة البيانات." });
      setEditorSourceId(null);
    } catch {
      toast({
        variant: "destructive",
        description: "تعذر حفظ التغييرات. حاول مرة أخرى.",
      });
    } finally {
      setEditorSaving(false);
    }
  }, [flushAccountingWorkspaceToServer, projectId, toast]);

  const savePreviewModalAndClose = useCallback(async () => {
    if (serverSaveTimerRef.current) {
      clearTimeout(serverSaveTimerRef.current);
      serverSaveTimerRef.current = null;
    }
    pendingAccountingSaveRef.current = readValuationAccountingStore(projectId);
    setPreviewSaving(true);
    try {
      await flushAccountingWorkspaceToServer();
      toast({ description: "تم حفظ الصور في قاعدة البيانات وستظهر في إعداد التقرير." });
      setPreviewImage(null);
    } catch {
      toast({
        variant: "destructive",
        description: "تعذر حفظ الصور. حاول مرة أخرى.",
      });
    } finally {
      setPreviewSaving(false);
    }
  }, [flushAccountingWorkspaceToServer, projectId, toast]);

  const loadProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/mv/projects/${projectId}`, { credentials: "include" });
      if (!res.ok) return;
      const data = (await res.json()) as { project?: MvProject };
      setProject(data.project ?? null);
    } catch {
      setProject(null);
    }
  }, [projectId]);

  useEffect(() => {
    setStore(readValuationAccountingStore(projectId));
    void loadProject();
    const visited = readVisitedSimpleReportSteps(projectId);
    if (!visited.includes("valuation-actions")) {
      writeVisitedSimpleReportSteps(projectId, [...visited, "valuation-actions"]);
    }
  }, [loadProject, projectId]);

  const serverWorkspaceKey = useMemo(
    () => JSON.stringify(project?.valuationAccountingWorkspace ?? null),
    [project?.valuationAccountingWorkspace],
  );

  useEffect(() => {
    if (!project) return;
    const local = readValuationAccountingStore(projectId);
    const merged = mergeValuationAccountingStores(project.valuationAccountingWorkspace, local);
    setStore((prev) => (JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged));
    writeValuationAccountingStore(projectId, merged);
    const fromServer = parseValuationAccountingStoreFromApi(project.valuationAccountingWorkspace);
    const sTime = fromServer?.updatedAt ? Date.parse(fromServer.updatedAt) : 0;
    const lTime = local.updatedAt ? Date.parse(local.updatedAt) : 0;
    if (lTime > sTime) {
      pendingAccountingSaveRef.current = valuationAccountingStoreForApi(merged);
      void flushAccountingWorkspaceToServer();
    }
  }, [project, projectId, serverWorkspaceKey, flushAccountingWorkspaceToServer]);

  useEffect(
    () => () => {
      if (serverSaveTimerRef.current) {
        clearTimeout(serverSaveTimerRef.current);
        serverSaveTimerRef.current = null;
      }
      const snap = pendingAccountingSaveRef.current ?? readValuationAccountingStore(projectId);
      pendingAccountingSaveRef.current = snap;
      void flushAccountingWorkspaceToServer();
    },
    [flushAccountingWorkspaceToServer, projectId],
  );

  useEffect(() => {
    setExcelColPicks([]);
    setExcelRowPicks([]);
    setExcelGridOpen(false);
    setMediaSelection(null);
    setPdfPage(1);
    setPdfPageCount(1);
    mediaZoomTouchedRef.current = false;
    setMediaPreviewZoom(1);
    setMediaIntrinsicSize({ w: 0, h: 0 });
    setMediaLayoutFit(1);
  }, [editorSourceId]);

  useEffect(() => {
    const node = mediaViewportRef.current;
    if (!node) return;
    const update = () => {
      setMediaViewportHeight(node.clientHeight);
      setMediaViewportWidth(node.clientWidth);
      const c = mediaCanvasRef.current;
      if (c && c.width >= 2 && c.height >= 2) {
        const vw = node.clientWidth;
        const vh = node.clientHeight;
        if (vw >= 40 && vh >= 40) {
          setMediaLayoutFit(computeMediaLayoutFit(c.width, c.height, vw, vh));
        }
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [editorSource?.id]);

  const commitMediaCanvasLayout = useCallback((canvas: HTMLCanvasElement) => {
    const node = mediaViewportRef.current;
    let vw = node?.clientWidth ?? 0;
    let vh = node?.clientHeight ?? 0;
    if (vw < 40 || vh < 40) {
      vw = mediaViewportWidth;
      vh = mediaViewportHeight;
    }
    if (vw < 40) vw = 900;
    if (vh < 40) vh = 560;
    setMediaIntrinsicSize({ w: canvas.width, h: canvas.height });
    setMediaLayoutFit(computeMediaLayoutFit(canvas.width, canvas.height, vw, vh));
  }, [mediaViewportWidth, mediaViewportHeight]);

  useEffect(() => {
    const source = editorSource;
    if (!source || (source.kind !== "image" && source.kind !== "pdf")) return;
    let cancelled = false;
    const canvas = mediaCanvasRef.current;
    if (!canvas) return;
    setMediaBusy(true);
    setMediaSelection(null);

    void (async () => {
      try {
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("تعذر إنشاء مساحة عرض الملف.");
        if (source.kind === "image") {
          if (source.fileId) {
            const blob = await fetchFileBlob(projectId, source.fileId);
            if (cancelled) return;
            const objUrl = URL.createObjectURL(blob);
            try {
              const image = await loadImage(objUrl);
              if (cancelled) return;
              canvas.width = image.naturalWidth || image.width;
              canvas.height = image.naturalHeight || image.height;
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
              setPdfPageCount(1);
              if (!cancelled) commitMediaCanvasLayout(canvas);
            } finally {
              URL.revokeObjectURL(objUrl);
            }
            return;
          }
          if (!source.dataUrl) throw new Error("ملف الصورة غير متاح.");
          const image = await loadImage(source.dataUrl);
          if (cancelled) return;
          canvas.width = image.naturalWidth || image.width;
          canvas.height = image.naturalHeight || image.height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          setPdfPageCount(1);
          commitMediaCanvasLayout(canvas);
          return;
        }

        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        let bytes: Uint8Array;
        if (source.fileId) {
          const buf = await fetchFileArrayBuffer(projectId, source.fileId);
          if (cancelled) return;
          bytes = new Uint8Array(buf);
        } else if (source.dataUrl) {
          bytes = dataUrlToUint8Array(source.dataUrl);
        } else {
          throw new Error("ملف PDF غير متاح.");
        }
        const documentTask = pdfjs.getDocument({ data: bytes });
        const pdf = await documentTask.promise;
        if (cancelled) return;
        const nextPage = Math.min(Math.max(1, pdfPage), pdf.numPages);
        setPdfPageCount(pdf.numPages);
        if (nextPage !== pdfPage) {
          setPdfPage(nextPage);
          return;
        }
        const page = await pdf.getPage(nextPage);
        const viewport = page.getViewport({ scale: pdfRenderScale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (!cancelled) commitMediaCanvasLayout(canvas);
      } catch (error) {
        if (!cancelled) {
          toast({
            variant: "destructive",
            description: error instanceof Error ? error.message : "تعذر عرض الملف.",
          });
        }
      } finally {
        if (!cancelled) setMediaBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    editorSource?.dataUrl,
    editorSource?.fileId,
    editorSource?.id,
    editorSource?.kind,
    mediaCanvasEpoch,
    pdfPage,
    pdfRenderScale,
    projectId,
    toast,
    commitMediaCanvasLayout,
  ]);

  const updateSource = useCallback(
    (id: string, patch: Partial<MvValuationAccountingSourceFile>) => {
      persistStore((current) => ({
        ...current,
        sources: current.sources.map((source) =>
          source.id === id ? { ...source, ...patch } : source,
        ),
      }));
    },
    [persistStore],
  );

  const updateImage = useCallback(
    (id: string, patch: Partial<MvValuationAccountingImage>) => {
      persistStore((current) => ({
        ...current,
        images: current.images.map((image) => (image.id === id ? { ...image, ...patch } : image)),
      }));
    },
    [persistStore],
  );

  const removeSource = useCallback(
    (id: string) => {
      persistStore((current) => ({
        ...current,
        sources: current.sources.filter((source) => source.id !== id),
        images: current.images.filter((image) => image.sourceId !== id),
      }));
      setEditorSourceId(null);
      toast({ description: "تم حذف الملف وكل الصور المرتبطة به." });
    },
    [persistStore, toast],
  );

  const removeImage = useCallback(
    (id: string) => {
      persistStore((current) => ({
        ...current,
        images: current.images.filter((image) => image.id !== id),
      }));
      setPreviewImage((current) => (current?.id === id ? null : current));
      toast({ description: "تم حذف الصورة." });
    },
    [persistStore, toast],
  );

  const addCapturedImage = useCallback(
    async (
      source: MvValuationAccountingSourceFile,
      rawDataUrl: string,
      crop?: MvValuationAccountingImage["crop"],
      options?: { skipEnhance?: boolean },
    ) => {
      /** تحسين ما بعد القص يعيد رسم الصورة وقد يقص الأعمدة/يلطّخ النص؛ معاينة القص تستخدم PNG الخام */
      const finalDataUrl =
        options?.skipEnhance === true
          ? rawDataUrl
          : await enhanceImageDataUrl(rawDataUrl, {
              scale: qualityScale,
              contrast: 1.18,
              brightness: 1.05,
            });
      const cleanSourceName = cleanAccountingText(source.name);
      const blob = await fetch(finalDataUrl).then((r) => r.blob());
      const file = new File([blob], cropImageFileName(cleanSourceName), {
        type: "image/png",
      });
      const uploadedFileId = await uploadProjectFileAndReturnId(projectId, file, {
        valuationAccounting: true,
      });
      const image: MvValuationAccountingImage = {
        id: createId("account-image"),
        approachId: source.approachId,
        sourceId: source.id,
        sourceKind: source.kind,
        sourceFileName: cleanSourceName,
        name: `${approachLabel(source.approachId)} - ${cleanSourceName}`,
        fileId: uploadedFileId,
        createdAt: new Date().toISOString(),
        displayWidthPercent: 88,
        displayMaxHeightPx: 960,
        qualityScale: options?.skipEnhance === true ? 1 : qualityScale,
        includeInReport: true,
        crop,
      };
      persistStore((current) => ({ ...current, images: [...current.images, image] }));
      toast({
        description:
          options?.skipEnhance === true
            ? "تم حفظ صورة الجدول كما في المعاينة (بدون إعادة تحجيم قد تقص الحواف)."
            : "تم اقتطاع الصورة وتحسين جودتها وحفظها للتقرير.",
      });
    },
    [persistStore, projectId, qualityScale, toast],
  );

  const activeExcelSheets: AssetImportSheetStat[] = editorSource?.importResult?.summary.sheets ?? [];
  const activeSheet = editorSource?.activeSheet ?? getFirstSheet(editorSource?.importResult);
  const activeSheetKey = activeSheet ? `${activeSheet.importId}::${activeSheet.sheetName}` : undefined;
  const activeSheetSettingsKey = activeSheet
    ? excelSheetSettingsKey(activeSheet.importId, activeSheet.sheetName)
    : "";

  useEffect(() => {
    if (editorSource?.kind !== "excel") return;
    if (activeSheet?.importId && activeSheet.sheetName) {
      setExcelGridOpen(true);
    }
  }, [activeSheet?.importId, activeSheet?.sheetName, editorSource?.kind]);

  useEffect(() => {
    if (
      editorSource?.kind !== "excel" ||
      editorSource.excelDataSource !== "mv-sheets" ||
      !activeSheet?.importId
    ) {
      setValuationExcelSheet(null);
      setValuationExcelSheetError(null);
      setValuationExcelSheetLoading(false);
      return;
    }

    let cancelled = false;
    setValuationExcelSheetLoading(true);
    setValuationExcelSheetError(null);
    void (async () => {
      try {
        const sheet = await fetchValuationExcelSheet(activeSheet.importId);
        if (cancelled) return;
        setValuationExcelSheet(sheet);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "تعذر تحميل شيت إجراءات التقييم.";
        setValuationExcelSheet(null);
        setValuationExcelSheetError(message);
      } finally {
        if (!cancelled) setValuationExcelSheetLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSheet?.importId, editorSource?.excelDataSource, editorSource?.kind]);

  const setActiveSheet = useCallback(
    (sourceId: string, sheet: ActiveImportSheetRef | null) => {
      updateSource(sourceId, { activeSheet: sheet });
      setExcelColPicks([]);
      setExcelRowPicks([]);
      setExcelGridRefresh((n) => n + 1);
    },
    [updateSource],
  );

  const prepareExcelSourceForSmartGrid = useCallback(
    async (source: MvValuationAccountingSourceFile) => {
      if (source.kind !== "excel" || source.importResult) {
        setExcelGridOpen(true);
        return;
      }
      if (!source.fileId) {
        toast({
          variant: "destructive",
          description: "ملف Excel الأصلي غير متاح لتحضير الجدول الذكي.",
        });
        return;
      }
      if (excelPreparingSourceIds.includes(source.id)) return;
      setExcelPreparingSourceIds((current) =>
        current.includes(source.id) ? current : [...current, source.id],
      );
      try {
        const blob = await fetchValuationExcelFileBlob(projectId, source.fileId);
        const excelFile = new File([blob], source.originalName || source.name, {
          type: source.mimeType || blob.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const importResult = await importValuationExcelSheets(
          projectId,
          excelFile,
          cleanAccountingText(source.name),
          source.fileId,
        );
        updateSource(source.id, {
          excelDataSource: "mv-sheets",
          excelRowsPerImage: source.excelRowsPerImage ?? DEFAULT_EXCEL_ROWS_PER_IMAGE,
          importResult,
          activeSheet: getFirstSheet(importResult),
        });
        setExcelGridOpen(true);
        toast({ description: "تم تحضير الجدول الذكي من ملف Excel الأصلي." });
      } catch (error) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "تعذر تحضير الجدول الذكي من ملف Excel.",
        });
      } finally {
        setExcelPreparingSourceIds((current) => current.filter((id) => id !== source.id));
      }
    },
    [excelPreparingSourceIds, projectId, toast, updateSource],
  );

  const setSourceVisibleColumns = useCallback(
    (sourceId: string, sheetKey: string, columns: string[]) => {
      updateSource(sourceId, {
        excelVisibleColumnsBySheet: {
          ...(store.sources.find((source) => source.id === sourceId)?.excelVisibleColumnsBySheet ?? {}),
          [sheetKey]: columns,
        },
      });
    },
    [store.sources, updateSource],
  );

  const setSourceColumnSize = useCallback(
    (
      sourceId: string,
      sheetKey: string,
      column: string,
      size: { widthPx?: number; minHeightPx?: number },
    ) => {
      const source = store.sources.find((item) => item.id === sourceId);
      updateSource(sourceId, {
        excelColumnSizesBySheet: {
          ...(source?.excelColumnSizesBySheet ?? {}),
          [sheetKey]: {
            ...(source?.excelColumnSizesBySheet?.[sheetKey] ?? {}),
            [column]: size,
          },
        },
      });
    },
    [store.sources, updateSource],
  );

  const excelCropColBounds = useMemo(() => {
    if (excelColPicks.length < 2) return null;
    return { min: Math.min(...excelColPicks), max: Math.max(...excelColPicks) };
  }, [excelColPicks]);

  const excelCropRowBounds = useMemo(() => {
    if (excelRowPicks.length < 2) return null;
    return { min: Math.min(...excelRowPicks), max: Math.max(...excelRowPicks) };
  }, [excelRowPicks]);

  const commitUpload = useCallback(
    async (
      kind: MvValuationAccountingFileKind,
      selectedFiles: File[],
      targetApproach: MvValuationAccountingApproachId = activeApproach,
      options?: { originalExcelFiles?: File[] },
    ) => {
      const files = selectedFiles.filter((file) => file.size > 0);
      if (files.length === 0) return false;
      uploadStopRequestedRef.current = false;
      setUploadingKind(kind);
      const sessionStart = Date.now();
      setFileProcessOverlay({
        phase:
          kind === "excel"
            ? "جارٍ رفع ملف Excel…"
            : kind === "pdf"
              ? "جارٍ رفع ملف PDF…"
              : "جارٍ رفع الصورة…",
        current: 0,
        total: 0,
        fileName: cleanAccountingText(files[0]?.name ?? ""),
        startedAt: sessionStart,
      });
      await waitFrame();
      try {
        const nextSources: MvValuationAccountingSourceFile[] = [];
        const nextImages: MvValuationAccountingImage[] = [];
        let convertedPdfPageCount = 0;
        let generatedExcelImageCount = 0;
        const excelGenerationErrors: string[] = [];
        for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
          const file = files[fileIndex]!;
          if (uploadStopRequestedRef.current) break;
          const cleanFileName = cleanAccountingText(file.name);
          pushFileProcess({
            phase:
              kind === "excel"
                ? "جارٍ معالجة Excel…"
                : kind === "pdf"
                  ? "جارٍ معالجة PDF…"
                  : "جارٍ معالجة الصورة…",
            current: 0,
            total: 0,
            fileName: cleanFileName,
          });
          await waitFrame();
          if (kind === "excel") {
            pushFileProcess({
              phase: "رفع ملف Excel إلى الخادم…",
              current: 0,
              total: 0,
              fileName: cleanFileName,
            });
            const storedExcelFileId = await uploadValuationExcelFileAndReturnId(projectId, file);
            pushFileProcess({
              phase: "استيراد الشيتات وتحليل الأعمدة…",
              current: 0,
              total: 0,
              fileName: cleanFileName,
            });
            const importResult = await importValuationExcelSheets(
              projectId,
              file,
              cleanFileName,
              storedExcelFileId,
            );
            const source: MvValuationAccountingSourceFile = {
              id: createId("account-source"),
              approachId: targetApproach,
              kind,
              name: cleanFileName,
              originalName: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              createdAt: new Date().toISOString(),
              fileId: storedExcelFileId,
              excelDataSource: "mv-sheets",
              excelRowsPerImage: DEFAULT_EXCEL_ROWS_PER_IMAGE,
              importResult,
              activeSheet: getFirstSheet(importResult),
            };
            nextSources.push(source);
            try {
              const automaticImages = await buildAutomaticExcelImages({
                projectId,
                source,
                rowsPerImage: DEFAULT_EXCEL_ROWS_PER_IMAGE,
                rowHeight: excelPreviewRowHeight,
                columnWidthMul: excelPreviewColMul,
                cellFont: excelPreviewCellFont,
                headerFont: excelPreviewHeaderFont,
                padX: excelPreviewPadX,
                padY: excelPreviewPadY,
                qualityScale,
                onProgress: async (done, total, phase) => {
                  pushFileProcess({
                    phase,
                    current: done,
                    total,
                    fileName: cleanFileName,
                  });
                  await waitFrame();
                },
              });
              generatedExcelImageCount += automaticImages.length;
              nextImages.push(...automaticImages);
            } catch (error) {
              excelGenerationErrors.push(
                `${cleanFileName}: ${error instanceof Error ? error.message : "تعذر توليد الصور التلقائية."}`,
              );
            }
          } else if (kind === "pdf") {
            const originalExcelFile = options?.originalExcelFiles?.[fileIndex];
            if (originalExcelFile && !uploadStopRequestedRef.current) {
              pushFileProcess({
                phase: "حفظ ملف Excel الأصلي كمسودة متقدمة...",
                current: 0,
                total: 0,
                fileName: cleanAccountingText(originalExcelFile.name),
              });
              const storedExcelFileId = await uploadValuationExcelFileAndReturnId(projectId, originalExcelFile);
              const excelDraftSource: MvValuationAccountingSourceFile = {
                id: createId("account-source"),
                approachId: targetApproach,
                kind: "excel",
                name: cleanAccountingText(originalExcelFile.name),
                originalName: originalExcelFile.name,
                mimeType: originalExcelFile.type,
                sizeBytes: originalExcelFile.size,
                createdAt: new Date().toISOString(),
                fileId: storedExcelFileId,
                excelRowsPerImage: DEFAULT_EXCEL_ROWS_PER_IMAGE,
              };
              nextSources.push(excelDraftSource);
              persistStore((current) => ({
                ...current,
                sources: current.sources.some((source) => source.id === excelDraftSource.id)
                  ? current.sources
                  : [...current.sources, excelDraftSource],
              }));
            }
            if (uploadStopRequestedRef.current) break;
            pushFileProcess({
              phase: originalExcelFile ? "حفظ ملف PDF الناتج من Excel…" : "رفع ملف PDF الأصلي…",
              current: 0,
              total: 0,
              fileName: cleanFileName,
            });
            const pdfFileId = await uploadProjectFileAndReturnId(projectId, file, {
              valuationAccounting: true,
            });
            const pdfSource: MvValuationAccountingSourceFile = {
              id: createId("account-source"),
              approachId: targetApproach,
              kind: "pdf",
              name: cleanFileName,
              originalName: file.name,
              mimeType: file.type || "application/pdf",
              sizeBytes: file.size,
              createdAt: new Date().toISOString(),
              fileId: pdfFileId,
            };
            nextSources.push(pdfSource);
            persistStore((current) => ({
              ...current,
              sources: current.sources.some((source) => source.id === pdfSource.id)
                ? current.sources
                : [...current.sources, pdfSource],
            }));
            const pdfImages = await processPdfToValuationImages(
              projectId,
              file,
              pdfSource,
              targetApproach,
              cleanFileName,
              async (done, total, phase) => {
                pushFileProcess({
                  phase,
                  current: done,
                  total,
                  fileName: cleanFileName,
                });
                await waitFrame();
              },
              {
                shouldStop: () => uploadStopRequestedRef.current,
                onImage: (image) => {
                  persistStore((current) => ({
                    ...current,
                    images: current.images.some((item) => item.id === image.id)
                      ? current.images
                      : [...current.images, image],
                  }));
                },
              },
            );
            convertedPdfPageCount += pdfImages.length;
            nextImages.push(...pdfImages);
          } else {
            pushFileProcess({
              phase: "رفع الصورة…",
              current: 0,
              total: 1,
              fileName: cleanFileName,
            });
            const uploadedId = await uploadProjectFileAndReturnId(projectId, file, {
              valuationAccounting: true,
            });
            pushFileProcess({
              phase: "تم حفظ الصورة",
              current: 1,
              total: 1,
              fileName: cleanFileName,
            });
            const imageSource: MvValuationAccountingSourceFile = {
              id: createId("account-source"),
              approachId: targetApproach,
              kind,
              name: cleanFileName,
              originalName: file.name,
              mimeType: file.type,
              sizeBytes: file.size,
              createdAt: new Date().toISOString(),
              fileId: uploadedId,
            };
            nextSources.push(imageSource);
            nextImages.push({
              id: createId("account-image"),
              approachId: targetApproach,
              sourceId: imageSource.id,
              sourceKind: "image",
              sourceFileName: cleanFileName,
              name: `${approachLabel(targetApproach)} - ${cleanFileName}`,
              fileId: uploadedId,
              createdAt: new Date().toISOString(),
              displayWidthPercent: 90,
              displayMaxHeightPx: 960,
              qualityScale: 2.5,
              includeInReport: true,
              autoGenerated: true,
            });
          }
        }
        persistStore((current) => ({
          ...current,
          sources: [
            ...current.sources,
            ...nextSources.filter((source) => !current.sources.some((item) => item.id === source.id)),
          ],
          images: [
            ...current.images,
            ...nextImages.filter((image) => !current.images.some((item) => item.id === image.id)),
          ],
        }));
        const firstGeneratedImage = nextImages[0] ?? null;
        if (firstGeneratedImage) {
          /** بعد رفع Excel/PDF/صورة: نعرض الصورة فقط في معاينة بسيطة
           *  دون فتح مودال القص تلقائيًا. */
          setPreviewImage(firstGeneratedImage);
        }
        toast({
          description:
            kind === "excel"
              ? `تم رفع ${files.length} ملف Excel وتوليد ${generatedExcelImageCount} صورة تلقائياً في ${approachLabel(targetApproach)}.`
              : convertedPdfPageCount > 0
              ? `تم تحويل PDF إلى ${convertedPdfPageCount} صورة عالية الجودة وربطها بـ ${approachLabel(targetApproach)}.`
              : `تم رفع ${files.length} ملف إلى ${approachLabel(targetApproach)}.`,
        });
        if (excelGenerationErrors.length > 0) {
          toast({
            variant: "destructive",
            description: excelGenerationErrors.slice(0, 2).join(" | "),
          });
        }
        return true;
      } catch (error) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "تعذر رفع الملف.",
        });
        return false;
      } finally {
        setUploadingKind(null);
        setFileProcessOverlay(null);
      }
    },
    [
      activeApproach,
      excelPreviewCellFont,
      excelPreviewColMul,
      excelPreviewHeaderFont,
      excelPreviewPadX,
      excelPreviewPadY,
      excelPreviewRowHeight,
      persistStore,
      projectId,
      pushFileProcess,
      qualityScale,
      toast,
    ],
  );

  const closePendingUploadPreview = useCallback(() => {
    pendingUploadTokenRef.current += 1;
    uploadStopRequestedRef.current = true;
    setPendingUploadPreview(null);
    setPendingPreviewNatural(null);
    setUploadingKind(null);
    setFileProcessOverlay(null);
  }, []);

  const prepareUploadPreview = useCallback(
    async (
      kind: PendingUploadKind,
      selectedFiles: File[],
      targetApproach: MvValuationAccountingApproachId,
    ) => {
      const files = selectedFiles.filter((file) => file.size > 0);
      if (files.length === 0) return;
      const token = pendingUploadTokenRef.current + 1;
      pendingUploadTokenRef.current = token;
      const id = createId("pending-upload");
      const cleanFirstName = cleanAccountingText(files[0]?.name ?? "");
      setPendingUploadPreview({
        id,
        kind,
        approachId: targetApproach,
        files,
        status: "processing",
        title: cleanFirstName,
        message:
          kind === "excel"
            ? "جاري تحويل Excel إلى PDF مؤقت للمعاينة فقط..."
            : "جاري تجهيز معاينة PDF...",
      });
      setUploadingKind(kind);
      setFileProcessOverlay({
        phase:
          kind === "excel"
            ? "جاري تحويل Excel إلى PDF مؤقت للمعاينة فقط..."
            : "جاري تجهيز معاينة PDF...",
        current: 0,
        total: 0,
        fileName: cleanFirstName,
        startedAt: Date.now(),
      });
      await waitFrame();

      try {
        if (kind === "excel") {
          const rowsPerImage = DEFAULT_EXCEL_PDF_ROWS_PER_IMAGE;
          const preview = await buildExcelPdfPreviewFromOriginalFile(files[0]!, rowsPerImage);
          if (pendingUploadTokenRef.current !== token) return;
          setPendingUploadPreview({
            id,
            kind: "excel",
            approachId: targetApproach,
            files,
            status: "ready",
            title: cleanFirstName,
            message:
              files.length > 1
                ? `تم تجهيز عينة من أول ملف. عند المتابعة سيتم حفظ ملفات Excel الأصلية وملفات PDF الناتجة وصور كل الملفات (${files.length}).`
                : "تم تجهيز عينة الصورة النهائية. عند المتابعة سيتم حفظ ملف Excel الأصلي وملف PDF الناتج وكل الصور.",
            previewDataUrl: preview.previewDataUrl,
            estimatedImageCount: preview.estimatedImageCount,
            sheetName: preview.sheetName,
            rowCount: preview.rowCount,
            columnCount: preview.columnCount,
            excelRowsPerImage: rowsPerImage,
          });
        } else {
          const preview = await buildPdfUploadPreview(files[0]!);
          if (pendingUploadTokenRef.current !== token) return;
          setPendingUploadPreview({
            id,
            kind,
            approachId: targetApproach,
            files,
            status: "ready",
            title: cleanFirstName,
            message:
              files.length > 1
                ? `تم تجهيز عينة من أول PDF. عند المتابعة سيتم قص وتخزين صفحات كل الملفات (${files.length}).`
                : "تم تجهيز عينة الصفحة الأولى بعد قص الهوامش البيضاء. عند المتابعة سيتم حفظ كل الصفحات.",
            previewDataUrl: preview.previewDataUrl,
            estimatedImageCount: preview.estimatedImageCount,
            pageCount: preview.pageCount,
          });
        }
      } catch (error) {
        if (pendingUploadTokenRef.current !== token) return;
        const message = error instanceof Error ? error.message : "تعذر تجهيز المعاينة.";
        setPendingUploadPreview((current) =>
          current?.id === id
            ? {
                ...current,
                status: "error",
                message,
                error: message,
              }
            : current,
        );
        toast({ variant: "destructive", description: message });
      } finally {
        if (pendingUploadTokenRef.current === token) {
          setUploadingKind(null);
          setFileProcessOverlay(null);
        }
      }
    },
    [
      excelPreviewCellFont,
      excelPreviewColMul,
      excelPreviewHeaderFont,
      excelPreviewPadX,
      excelPreviewPadY,
      excelPreviewRowHeight,
      qualityScale,
      toast,
    ],
  );

  const refreshPendingExcelPreview = useCallback(async () => {
    const pending = pendingUploadPreview;
    if (!pending || pending.kind !== "excel" || pending.files.length === 0) return;
    const rowsPerImage = normalizeExcelPdfRowsPerImage(pending.excelRowsPerImage);
    setPendingUploadPreview({
      ...pending,
      status: "processing",
      message: "جاري تحديث معاينة Excel حسب عدد الصفوف...",
      excelRowsPerImage: rowsPerImage,
    });
    setUploadingKind("excel");
    setFileProcessOverlay({
      phase: "جاري تحديث معاينة Excel حسب عدد الصفوف...",
      current: 0,
      total: 0,
      fileName: cleanAccountingText(pending.files[0]?.name ?? pending.title),
      startedAt: Date.now(),
    });
    await waitFrame();
    try {
      const preview = await buildExcelPdfPreviewFromOriginalFile(pending.files[0]!, rowsPerImage);
      setPendingUploadPreview((current) =>
        current?.id === pending.id
          ? {
              ...current,
              status: "ready",
              message:
                current.files.length > 1
                  ? `تم تحديث العينة. عند المتابعة سيتم حفظ ملفات Excel الأصلية وملفات PDF الناتجة وصور كل الملفات (${current.files.length}).`
                  : "تم تحديث العينة. عند المتابعة سيتم حفظ ملف Excel الأصلي وملف PDF الناتج وكل الصور.",
              previewDataUrl: preview.previewDataUrl,
              estimatedImageCount: preview.estimatedImageCount,
              sheetName: preview.sheetName,
              rowCount: preview.rowCount,
              columnCount: preview.columnCount,
              excelRowsPerImage: rowsPerImage,
            }
          : current,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر تحديث معاينة Excel.";
      setPendingUploadPreview((current) =>
        current?.id === pending.id
          ? { ...current, status: "error", message, error: message }
          : current,
      );
      toast({ variant: "destructive", description: message });
    } finally {
      setUploadingKind(null);
      setFileProcessOverlay(null);
    }
  }, [pendingUploadPreview, toast]);

  const handleUpload = useCallback(
    async (kind: MvValuationAccountingFileKind, list: FileList | null) => {
      const files = Array.from(list ?? []).filter((file) => file.size > 0);
      if (files.length === 0) return;
      if (kind === "image" || kind === "pdf") {
        await commitUpload(kind, files, activeApproach);
        return;
      }
      const rowsPerImage = DEFAULT_EXCEL_PDF_ROWS_PER_IMAGE;
      const pdfFiles: File[] = [];
      try {
        uploadStopRequestedRef.current = false;
        setUploadingKind("excel");
        setFileProcessOverlay({
          phase: "جاري تحويل Excel ورفع الصور تلقائياً…",
          current: 0,
          total: files.length,
          fileName: cleanAccountingText(files[0]?.name ?? ""),
          startedAt: Date.now(),
        });
        await waitFrame();
        for (let index = 0; index < files.length; index += 1) {
          if (uploadStopRequestedRef.current) break;
          const file = files[index]!;
          pushFileProcess({
            phase: "جاري تحويل Excel إلى PDF…",
            current: index,
            total: files.length,
            fileName: cleanAccountingText(file.name),
          });
          await waitFrame();
          const converted = await buildExcelPdfFromOriginalFile(file, { rowsPerImage });
          pdfFiles.push(converted.pdfFile);
        }
        if (uploadStopRequestedRef.current || pdfFiles.length === 0) return;
        await commitUpload("pdf", pdfFiles, activeApproach, { originalExcelFiles: files });
      } catch (error) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "تعذر رفع ملف Excel.",
        });
      } finally {
        setUploadingKind(null);
        setFileProcessOverlay(null);
      }
    },
    [activeApproach, commitUpload, pushFileProcess, toast],
  );

  const continuePendingUpload = useCallback(async () => {
    const pending = pendingUploadPreview;
    if (!pending || pending.status !== "ready") return;
    setPendingUploadPreview({ ...pending, status: "saving", message: "جاري إنشاء كل الصور وحفظها..." });
    if (pending.kind === "excel") {
      const rowsPerImage = normalizeExcelPdfRowsPerImage(pending.excelRowsPerImage);
      const pdfFiles: File[] = [];
      try {
        uploadStopRequestedRef.current = false;
        setUploadingKind("excel");
        setFileProcessOverlay({
          phase: "جاري إنشاء PDF من Excel...",
          current: 0,
          total: pending.files.length,
          fileName: cleanAccountingText(pending.files[0]?.name ?? pending.title),
          startedAt: Date.now(),
        });
        for (let index = 0; index < pending.files.length; index += 1) {
          if (uploadStopRequestedRef.current) break;
          const file = pending.files[index]!;
          pushFileProcess({
            phase: "جاري إنشاء PDF من Excel...",
            current: index,
            total: pending.files.length,
            fileName: cleanAccountingText(file.name),
          });
          await waitFrame();
          const converted = await buildExcelPdfFromOriginalFile(file, { rowsPerImage });
          pdfFiles.push(converted.pdfFile);
          pushFileProcess({
            phase: "تم إنشاء PDF من Excel",
            current: index + 1,
            total: pending.files.length,
            fileName: cleanAccountingText(file.name),
          });
          await waitFrame();
        }
        if (uploadStopRequestedRef.current) {
          setPendingUploadPreview({ ...pending, status: "ready" });
          return;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "تعذر إنشاء PDF من Excel.";
        toast({ variant: "destructive", description: message });
        setPendingUploadPreview({ ...pending, status: "ready", message });
        return;
      } finally {
        setUploadingKind(null);
        setFileProcessOverlay(null);
      }
      const ok = await commitUpload("pdf", pdfFiles, pending.approachId, {
        originalExcelFiles: pending.files,
      });
      if (ok) {
        closePendingUploadPreview();
        return;
      }
      setPendingUploadPreview({ ...pending, status: "ready" });
      return;
    }

    const ok = await commitUpload(pending.kind, pending.files, pending.approachId, {
      originalExcelFiles: pending.originalFiles,
    });
    if (ok) {
      closePendingUploadPreview();
      return;
    }
    setPendingUploadPreview({ ...pending, status: "ready" });
  }, [closePendingUploadPreview, commitUpload, pendingUploadPreview, pushFileProcess, toast]);

  const applyExcelCapture = useCallback(async () => {
    if (!editorSource || editorSource.kind !== "excel" || !activeSheet) return;
    if (!excelCropColBounds || !excelCropRowBounds) {
      toast({
        variant: "destructive",
        description: "حدد عمودين وصفين لتكوين مستطيل القص.",
      });
      return;
    }
    const table = document.querySelector(CROP_TABLE_SELECTOR) as HTMLTableElement | null;
    if (!table) {
      toast({ variant: "destructive", description: "تعذر العثور على الجدول داخل المودال." });
      return;
    }
    setExcelCaptureBusy(true);
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const dataUrl = await captureTableRegionDataUrl(
        table,
        {
          cmin: excelCropColBounds.min,
          cmax: excelCropColBounds.max,
          rmin: excelCropRowBounds.min,
          rmax: excelCropRowBounds.max,
        },
        {
          includeHeader: excelIncludeHeader,
          qualityScale,
          bleedCssPx: excelCaptureBleed,
          rowHeightCssPx: excelPreviewRowHeight,
          cellFontCssPx: excelPreviewCellFont,
          headerFontCssPx: excelPreviewHeaderFont,
          cellPadXCssPx: excelPreviewPadX,
          cellPadYCssPx: excelPreviewPadY,
        },
      );
      const slice: MvValuationReportSlice = {
        colStart: excelCropColBounds.min,
        colEnd: excelCropColBounds.max,
        rowStart: excelCropRowBounds.min,
        rowEnd: excelCropRowBounds.max,
        imageColStart: excelCropColBounds.min,
        imageColEnd: excelCropColBounds.max,
        imageRowStart: excelCropRowBounds.min,
        imageRowEnd: excelCropRowBounds.max,
        importId: activeSheet.importId,
        sheetName: activeSheet.sheetName,
      };
      writeReportSlice(projectId, slice);
      await addCapturedImage(
        editorSource,
        dataUrl,
        {
          sheetName: activeSheet.sheetName,
          x: excelCropColBounds.min,
          y: excelCropRowBounds.min,
          width: excelCropColBounds.max - excelCropColBounds.min + 1,
          height: excelCropRowBounds.max - excelCropRowBounds.min + 1,
        },
        { skipEnhance: true },
      );
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "تعذر قص الصورة من Excel.",
      });
    } finally {
      setExcelCaptureBusy(false);
    }
  }, [
    activeSheet,
    addCapturedImage,
    editorSource,
    excelCropColBounds,
    excelCropRowBounds,
    excelIncludeHeader,
    excelCaptureBleed,
    excelPreviewCellFont,
    excelPreviewHeaderFont,
    excelPreviewPadX,
    excelPreviewPadY,
    excelPreviewRowHeight,
    projectId,
    qualityScale,
    toast,
  ]);

  const regenerateAutomaticExcelImages = useCallback(
    async (source: MvValuationAccountingSourceFile) => {
      if (source.kind !== "excel" || !source.importResult) {
        toast({ variant: "destructive", description: "ملف Excel غير جاهز لإعادة توليد الصور." });
        return;
      }
      const rowsPerImage = normalizeExcelRowsPerImage(source.excelRowsPerImage);
      setAutoExcelBusySourceIds((ids) => [...new Set([...ids, source.id])]);
      const cleanName = cleanAccountingText(source.name);
      setFileProcessOverlay({
        phase: "إعادة توليد صور Excel",
        current: 0,
        total: 0,
        fileName: cleanName,
        startedAt: Date.now(),
      });
      await waitFrame();
      try {
        const images = await buildAutomaticExcelImages({
          projectId,
          source: { ...source, excelRowsPerImage: rowsPerImage },
          rowsPerImage,
          rowHeight: excelPreviewRowHeight,
          columnWidthMul: excelPreviewColMul,
          cellFont: excelPreviewCellFont,
          headerFont: excelPreviewHeaderFont,
          padX: excelPreviewPadX,
          padY: excelPreviewPadY,
          qualityScale,
          onProgress: async (done, total, phase) => {
            pushFileProcess({
              phase,
              current: done,
              total,
              fileName: cleanName,
            });
            await waitFrame();
          },
        });
        persistStore((current) => ({
          ...current,
          sources: current.sources.map((item) =>
            item.id === source.id ? { ...item, excelRowsPerImage: rowsPerImage } : item,
          ),
          images: [
            ...current.images.filter(
              (image) => !(image.sourceId === source.id && image.autoGenerated === true),
            ),
            ...images,
          ],
        }));
        toast({
          description: `تمت إعادة توليد ${images.length} صورة تلقائية من ${cleanAccountingText(source.name)}.`,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "تعذر إعادة توليد صور Excel.",
        });
      } finally {
        setAutoExcelBusySourceIds((ids) => ids.filter((id) => id !== source.id));
        setFileProcessOverlay(null);
      }
    },
    [
      excelPreviewCellFont,
      excelPreviewColMul,
      excelPreviewHeaderFont,
      excelPreviewPadX,
      excelPreviewPadY,
      excelPreviewRowHeight,
      persistStore,
      projectId,
      pushFileProcess,
      qualityScale,
      toast,
    ],
  );

  const pointerPoint = useCallback((event: PointerEvent) => {
    const canvas = mediaCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(rect.width, Math.max(0, event.clientX - rect.left)),
      y: Math.min(rect.height, Math.max(0, event.clientY - rect.top)),
    };
  }, []);

  const clampSel = useCallback((sel: CropSelection) => {
    const canvas = mediaCanvasRef.current;
    if (!canvas) return sel;
    const rect = canvas.getBoundingClientRect();
    const minSize = 8;
    const x1 = Math.max(0, Math.min(sel.x, rect.width - minSize));
    const y1 = Math.max(0, Math.min(sel.y, rect.height - minSize));
    const x2 = Math.max(x1 + minSize, Math.min(sel.x + sel.width, rect.width));
    const y2 = Math.max(y1 + minSize, Math.min(sel.y + sel.height, rect.height));
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  }, []);

  const hitTestHandle = useCallback((p: { x: number; y: number }, sel: CropSelection): CropHandle | null => {
    const h = 14;
    const x1 = sel.x;
    const y1 = sel.y;
    const x2 = sel.x + sel.width;
    const y2 = sel.y + sel.height;
    const near = (a: number, b: number) => Math.abs(a - b) <= h;
    const inX = p.x >= x1 - h && p.x <= x2 + h;
    const inY = p.y >= y1 - h && p.y <= y2 + h;
    if (!inX || !inY) return null;
    const left = near(p.x, x1);
    const right = near(p.x, x2);
    const top = near(p.y, y1);
    const bottom = near(p.y, y2);
    if (left && top) return "nw";
    if (right && top) return "ne";
    if (right && bottom) return "se";
    if (left && bottom) return "sw";
    if (top && p.x > x1 && p.x < x2) return "n";
    if (bottom && p.x > x1 && p.x < x2) return "s";
    if (left && p.y > y1 && p.y < y2) return "w";
    if (right && p.y > y1 && p.y < y2) return "e";
    if (p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2) return "move";
    return null;
  }, []);

  const applyDrag = useCallback((point: { x: number; y: number }) => {
    const drag = cropDragRef.current;
    if (!drag) return;
    const dx = point.x - drag.startPoint.x;
    const dy = point.y - drag.startPoint.y;
    const s = drag.startSel;
    const x1 = s.x;
    const y1 = s.y;
    const x2 = s.x + s.width;
    const y2 = s.y + s.height;
    let next: CropSelection = s;
    switch (drag.handle) {
      case "move":
        next = { ...s, x: x1 + dx, y: y1 + dy };
        break;
      case "nw":
        next = { x: x1 + dx, y: y1 + dy, width: x2 - (x1 + dx), height: y2 - (y1 + dy) };
        break;
      case "n":
        next = { x: x1, y: y1 + dy, width: s.width, height: y2 - (y1 + dy) };
        break;
      case "ne":
        next = { x: x1, y: y1 + dy, width: x2 + dx - x1, height: y2 - (y1 + dy) };
        break;
      case "e":
        next = { x: x1, y: y1, width: x2 + dx - x1, height: s.height };
        break;
      case "se":
        next = { x: x1, y: y1, width: x2 + dx - x1, height: y2 + dy - y1 };
        break;
      case "s":
        next = { x: x1, y: y1, width: s.width, height: y2 + dy - y1 };
        break;
      case "sw":
        next = { x: x1 + dx, y: y1, width: x2 - (x1 + dx), height: y2 + dy - y1 };
        break;
      case "w":
        next = { x: x1 + dx, y: y1, width: x2 - (x1 + dx), height: s.height };
        break;
      default:
        break;
    }
    setMediaSelection(clampSel(next));
  }, [clampSel]);

  const fileBlobToDataUrl = useCallback((blob: Blob) => {
    return new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result ?? ""));
      r.onerror = () => reject(r.error ?? new Error("تعذر قراءة الملف."));
      r.readAsDataURL(blob);
    });
  }, []);

  const ensureImageDataUrl = useCallback(async (image: MvValuationAccountingImage) => {
    if (image.dataUrl) return image.dataUrl;
    if (!image.fileId) throw new Error("الصورة غير متاحة.");
    const blob = await fetchFileBlob(projectId, image.fileId);
    return await fileBlobToDataUrl(blob);
  }, [fileBlobToDataUrl, projectId]);

  const applyMediaCapture = useCallback(async () => {
    if (!editorSource || (editorSource.kind !== "image" && editorSource.kind !== "pdf")) return;
    const canvas = mediaCanvasRef.current;
    const selection = normalizeSelection(mediaSelection);
    if (!canvas || !selection) {
      toast({ variant: "destructive", description: "حدد مستطيلاً واضحاً على الملف أولاً." });
      return;
    }
    setMediaCaptureBusy(true);
    try {
      const cropped = cropCanvasSelection(canvas, selection);
      await addCapturedImage(editorSource, cropped.dataUrl, {
        ...cropped.crop,
        pageNumber: editorSource.kind === "pdf" ? pdfPage : undefined,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "تعذر قص الصورة.",
      });
    } finally {
      setMediaCaptureBusy(false);
    }
  }, [addCapturedImage, editorSource, mediaSelection, pdfPage, toast]);

  const handleIncludeInReport = useCallback(
    async (checked: boolean) => {
      persistStore((current) => ({ ...current, includeInReport: checked }));
      const currentReportData: MvProjectReportData = project?.reportData ?? {};
      try {
        const response = await fetch(`/api/mv/projects/${projectId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportData: {
              ...currentReportData,
              includeValuationAccountImages: checked,
            },
          }),
        });
        if (response.ok) {
          const data = (await response.json()) as { project?: MvProject };
          if (data.project) setProject(data.project);
        }
      } catch {
        toast({
          variant: "destructive",
          description: "تم حفظ الاختيار محلياً، لكن تعذر تحديث بيانات المشروع الآن.",
        });
      }
    },
    [persistStore, project?.reportData, projectId, toast],
  );

  const projectName = project?.name ?? projectId;
  const canOpenExcelGrid = Boolean(
    editorSource?.kind === "excel" && activeSheet?.importId && activeSheet.sheetName,
  );
  /** عرض/ارتفاع CSS للـ canvas: يطابق getBoundingClientRect مع نسبة البكسل الداخلية (دقة القص) */
  const mediaCanvasDisplayStyle = useMemo<CSSProperties>(() => {
    const { w, h } = mediaIntrinsicSize;
    if (w < 1 || h < 1) {
      return { display: "block", maxWidth: "100%" };
    }
    const scale = Math.max(0.04, mediaLayoutFit) * Math.max(0.2, mediaPreviewZoom);
    return {
      display: "block",
      width: Math.max(1, Math.round(w * scale)),
      height: Math.max(1, Math.round(h * scale)),
      maxWidth: "none",
    };
  }, [mediaIntrinsicSize.w, mediaIntrinsicSize.h, mediaLayoutFit, mediaPreviewZoom]);

  return (
    <MvWorkflowPageFrame className="bg-[var(--color-background-primary)]" dir="rtl">
      <MvProjectReportHeader
        compact
        projectId={projectId}
        project={project}
        activeStep="valuation-actions"
        breadcrumbs={[
          { label: projectName, href: `/machine-valuation/${projectId}/workflow/report-data` },
          { label: "إجراءات التقييم" },
        ]}
      />

      <div className="shrink-0 border-b border-slate-200 bg-white/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3">
          {MV_VALUATION_ACCOUNTING_APPROACHES.map((approach) => {
            const active = activeApproach === approach.id;
            const count = store.sources.filter((source) => source.approachId === approach.id).length;
            return (
              <button
                key={approach.id}
                type="button"
                onClick={() => setActiveApproach(approach.id)}
                className={cn(
                  "inline-flex h-10 min-w-[9rem] items-center justify-center gap-2 rounded-md border px-4 text-[13px] font-extrabold transition",
                  active
                    ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50",
                )}
              >
                {approach.label}
                {count > 0 ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px]",
                      active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <MvWorkflowPageScrollBody className="pb-6 md:pb-8">
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-5">
        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-[18px] font-black text-slate-950">ملفات حسابات القيمة</h1>
              <p className="mt-1 text-[12px] font-medium text-slate-500">
                الملفات الجديدة تُربط بالتبويب النشط حالياً: {approachLabel(activeApproach)}.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-[12px] font-bold text-slate-700">
                <Switch
                  checked={store.includeInReport}
                  onCheckedChange={(checked) => void handleIncludeInReport(checked)}
                  dir="ltr"
                />
                عرض الصور في التقرير
              </label>

              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <label>
                  <input
                    type="file"
                    className="hidden"
                    accept={EXCEL_ACCEPT}
                    multiple
                    onChange={(event) => {
                      void handleUpload("excel", event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                  {uploadingKind === "excel" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  رفع Excel
                </label>
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <label>
                  <input
                    type="file"
                    className="hidden"
                    accept={PDF_ACCEPT}
                    multiple
                    onChange={(event) => {
                      void handleUpload("pdf", event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                  {uploadingKind === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  رفع PDF
                </label>
              </Button>
              <Button asChild size="sm" className="gap-1.5 bg-[#0C447C] hover:bg-[#0a3a66]">
                <label>
                  <input
                    type="file"
                    className="hidden"
                    accept={IMAGE_ACCEPT}
                    multiple
                    onChange={(event) => {
                      void handleUpload("image", event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                  {uploadingKind === "image" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  رفع صورة
                </label>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4">
          {(() => {
            const approach =
              MV_VALUATION_ACCOUNTING_APPROACHES.find((item) => item.id === activeApproach) ??
              MV_VALUATION_ACCOUNTING_APPROACHES[0]!;
            const sources = store.sources.filter((source) => source.approachId === approach.id);
            const images = store.images.filter((image) => image.approachId === approach.id);
            return (
              <div
                key={approach.id}
                className={cn(
                  "rounded-lg border bg-white p-4 shadow-sm transition",
                  accountingImageDropActive
                    ? "border-sky-400 ring-2 ring-sky-100"
                    : "border-slate-200",
                )}
                onDragOver={(event) => {
                  if (!Array.from(event.dataTransfer.types).includes("Files")) return;
                  event.preventDefault();
                  setAccountingImageDropActive(true);
                  event.dataTransfer.dropEffect = "copy";
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                  setAccountingImageDropActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setAccountingImageDropActive(false);
                  const picked = Array.from(event.dataTransfer.files).filter(
                    (file) =>
                      file.type.startsWith("image/") ||
                      /\.(jpe?g|png|gif|webp|bmp|heic|heif|svg|tif)/i.test(file.name),
                  );
                  if (picked.length === 0) return;
                  const transfer = new DataTransfer();
                  picked.forEach((file) => transfer.items.add(file));
                  void handleUpload("image", transfer.files);
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-[16px] font-black text-slate-950">{approach.label}</h2>
                    <p className="mt-1 text-[11px] font-bold text-slate-500">
                      {sources.length > 0
                        ? `${sources.length} ملف حسابات، ${images.length} صورة مرتبطة`
                        : "لم يتم رفع ملفات لهذا الأسلوب بعد."}
                    </p>
                  </div>
                </div>

                {sources.length === 0 ? (
                  <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-[12px] font-bold text-slate-500">
                    ارفع ملف Excel أو PDF أو صورة من الأعلى، أو اسحب صوراً وأفلتها هنا.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4">
                    {sources.map((source) => {
                      const sourceImages = images.filter((image) => image.sourceId === source.id);
                      const autoBusy = autoExcelBusySourceIds.includes(source.id);
                      return (
                        <div
                          key={source.id}
                          className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex min-w-0 items-start gap-2">
                              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-sky-700 shadow-sm">
                                {sourceKindIcon(source.kind)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-black text-slate-900">
                                  {cleanAccountingText(source.name)}
                                </p>
                                <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-500">
                                  <span>{MV_VALUATION_ACCOUNTING_FILE_KIND_LABEL[source.kind]}</span>
                                  <span>{formatBytes(source.sizeBytes)}</span>
                                  <span>{sourceImages.length} صورة</span>
                                  {source.kind === "excel" ? (
                                    <span>{normalizeExcelRowsPerImage(source.excelRowsPerImage)} صف/صورة</span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={source.kind === "excel" ? "outline" : "secondary"}
                                className="h-8 gap-1.5 px-2 text-[11px] font-bold"
                                disabled={autoBusy || excelPreparingSourceIds.includes(source.id)}
                                onClick={() => {
                                  setEditorSourceId(source.id);
                                  if (source.kind === "excel") void prepareExcelSourceForSmartGrid(source);
                                }}
                              >
                                {excelPreparingSourceIds.includes(source.id) ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : source.kind === "excel" ? (
                                  <Settings className="h-3.5 w-3.5" />
                                ) : (
                                  <Scissors className="h-3.5 w-3.5" />
                                )}
                                {source.kind === "excel" ? "تعديل قص الصورة" : "قص الصورة"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:bg-red-50"
                                onClick={() => removeSource(source.id)}
                                aria-label="حذف الملف"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>

                          {autoBusy ? (
                            <div className="mt-3 flex items-center gap-2 rounded-md border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] font-bold text-sky-800">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              جارٍ إعادة توليد صور Excel...
                            </div>
                          ) : null}

                          {sourceImages.length > 0 ? (
                            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                              {sourceImages.map((image) => (
                                <figure
                                  key={image.id}
                                  className="overflow-hidden rounded-lg border border-slate-200 bg-white"
                                >
                                  <button
                                    type="button"
                                    className="block w-full bg-slate-100"
                                    onClick={() => setPreviewImage(image)}
                                  >
                                    <img
                                      src={accountingImageSrc(projectId, image)}
                                      alt={cleanAccountingText(image.name)}
                                      className="h-44 w-full object-contain"
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  </button>
                                  <figcaption className="space-y-2 border-t border-slate-100 px-3 py-2">
                                    <div className="flex items-start justify-between gap-2">
                                      <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-700">
                                        {cleanAccountingText(image.name)}
                                      </span>
                                      <div className="flex shrink-0 items-center gap-1">
                                        {image.autoGenerated ? (
                                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">
                                            تلقائية
                                          </span>
                                        ) : null}
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-red-600 hover:bg-red-50"
                                          onClick={() => removeImage(image.id)}
                                          aria-label="حذف الصورة"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                      </div>
                                    </div>
                                    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1.5">
                                      <span className="text-[10px] font-extrabold text-slate-600">في التقرير</span>
                                      <Switch
                                        checked={image.includeInReport !== false}
                                        onCheckedChange={(checked) => updateImage(image.id, { includeInReport: checked })}
                                        className="scale-90"
                                        dir="ltr"
                                      />
                                    </label>
                                  </figcaption>
                                </figure>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-white px-3 py-4 text-center text-[11px] font-bold text-slate-500">
                              لا توجد صور مرتبطة بهذا الملف بعد.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </section>

        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="outline" onClick={() => navigate(MV_PROJECTS_TABLE_PATH)}>
            العودة لجدول المشاريع
          </Button>
          <Button
            type="button"
            className="bg-emerald-700 hover:bg-emerald-800"
            onClick={() => navigate(`/machine-valuation/${projectId}/workflow/report`)}
          >
            الانتقال إلى إعداد التقرير
          </Button>
        </div>
      </main>
      </MvWorkflowPageScrollBody>

      <Dialog
        open={editorSource !== null}
        onOpenChange={(open) => {
          if (!open) setEditorSourceId(null);
        }}
      >
        <DialogContent
          className={cn(
            // مودال القص: أصغر قليلاً من Fullscreen + Responsive.
            "fixed left-1/2 top-1/2 z-[920] flex h-[96dvh] w-[min(96vw,1680px)] max-w-[99vw] -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-0 shadow-2xl",
            "sm:rounded-2xl",
            "overscroll-contain [scrollbar-gutter:stable]",
            "[&>button]:hidden",
          )}
          dir="rtl"
        >
          {editorSource ? (
            <>
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 sm:px-4">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-[#0C447C]">
                    {sourceKindIcon(editorSource.kind)}
                  </span>
                  <div className="min-w-0">
                    <DialogTitle className="truncate text-start text-[14px] font-black text-slate-950 sm:text-[16px]">
                      إجراءات {MV_VALUATION_ACCOUNTING_FILE_KIND_LABEL[editorSource.kind]} - {cleanAccountingText(editorSource.name)}
                    </DialogTitle>
                    <DialogDescription className="mt-0.5 text-right text-[10px] font-semibold text-slate-500 sm:text-[11px]">
                      {approachLabel(editorSource.approachId)} - قص الصور وضبط الاسم والأبعاد والجودة.
                    </DialogDescription>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 self-end">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="h-7 gap-1 px-2 text-[11px] font-bold"
                    onClick={() => removeSource(editorSource.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف الملف
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    onClick={() => setEditorSourceId(null)}
                    aria-label="إغلاق"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-100/70">
                  <div className="flex min-h-0 flex-1 flex-col">
                    {editorSource.kind === "excel" ? (
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                        <div className="shrink-0 border-b border-slate-200 bg-white px-2.5 py-1.5 sm:px-3">
                          {/* صف واحد: اسم الملف + اختر الشيت + ترويسة الأعمدة */}
                          <div className="grid grid-cols-1 gap-1.5 md:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_auto] md:items-end">
                            <Label className="grid min-w-0 gap-0.5 text-[10px] font-extrabold text-slate-600">
                              اسم الملف
                              <Input
                                value={cleanAccountingText(editorSource.name)}
                                onChange={(event) => updateSource(editorSource.id, { name: event.target.value })}
                                className="h-7 bg-white px-2 text-[11px]"
                              />
                            </Label>
                            <Label className="grid min-w-0 gap-0.5 text-[10px] font-extrabold text-slate-600">
                              اختر الشيت
                              <Select
                                value={activeSheetKey}
                                onValueChange={(value) => {
                                  const i = value.indexOf("::");
                                  if (i <= 0) return;
                                  setActiveSheet(editorSource.id, {
                                    importId: value.slice(0, i),
                                    sheetName: value.slice(i + 2),
                                  });
                                }}
                              >
                                <SelectTrigger className="h-7 w-full bg-white px-2 text-[11px]">
                                  <SelectValue placeholder="اختر الشيت" />
                                </SelectTrigger>
                                <SelectContent className="z-[960]">
                                  {activeExcelSheets.map((sheet) => (
                                    <SelectItem
                                      key={`${sheet.importId}::${sheet.sheetName}`}
                                      value={`${sheet.importId}::${sheet.sheetName}`}
                                    >
                                      {sheet.sheetName} - {sheet.rowCount} صف / {sheet.columnCount} عمود
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Label>
                            <label className="flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 text-[10px] font-extrabold text-slate-700">
                              <Switch
                                checked={excelIncludeHeader}
                                onCheckedChange={setExcelIncludeHeader}
                                className="scale-[0.82]"
                                dir="ltr"
                              />
                              ترويسة الأعمدة
                            </label>
                          </div>

                          {/* إعدادات معاينة الاقتطاع - ظاهرة افتراضياً */}
                          <div className="mt-1.5 rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-1.5">
                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-[10px] font-black text-slate-800">إعدادات الاقتطاع</p>
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1 px-2 text-[10px] font-bold"
                                  onClick={resetExcelPreviewSettings}
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  إعادة ضبط
                                </Button>
                              </div>
                            </div>
                            <div className="grid gap-x-3 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
                              <Label className="grid min-w-0 gap-0.5 text-[10px] font-bold text-slate-600">
                                ارتفاع الصف: {excelPreviewRowHeight}px
                                <Slider
                                  min={36}
                                  max={96}
                                  step={2}
                                  value={[excelPreviewRowHeight]}
                                  onValueChange={(v) => setExcelPreviewRowHeight(v[0] ?? 52)}
                                />
                              </Label>
                              <Label className="grid min-w-0 gap-0.5 text-[10px] font-bold text-slate-600">
                                عرض الأعمدة: ×{excelPreviewColMul.toFixed(2)}
                                <Slider
                                  min={0.75}
                                  max={1.6}
                                  step={0.05}
                                  value={[excelPreviewColMul]}
                                  onValueChange={(v) => setExcelPreviewColMul(v[0] ?? 1)}
                                />
                              </Label>
                              <Label className="grid min-w-0 gap-0.5 text-[10px] font-bold text-slate-600">
                                تكبير المعاينة: {Math.round(excelPreviewZoom * 100)}%
                                <Slider
                                  min={0.75}
                                  max={1.35}
                                  step={0.05}
                                  value={[excelPreviewZoom]}
                                  onValueChange={(v) => setExcelPreviewZoom(v[0] ?? 1)}
                                />
                              </Label>
                              <Label className="grid min-w-0 gap-0.5 text-[10px] font-bold text-slate-600">
                                خط البيانات: {excelPreviewCellFont}px
                                <Slider
                                  min={11}
                                  max={22}
                                  step={1}
                                  value={[excelPreviewCellFont]}
                                  onValueChange={(v) => setExcelPreviewCellFont(v[0] ?? 14)}
                                />
                              </Label>
                              <Label className="grid min-w-0 gap-0.5 text-[10px] font-bold text-slate-600">
                                خط الترويسة: {excelPreviewHeaderFont}px
                                <Slider
                                  min={10}
                                  max={20}
                                  step={1}
                                  value={[excelPreviewHeaderFont]}
                                  onValueChange={(v) => setExcelPreviewHeaderFont(v[0] ?? 13)}
                                />
                              </Label>
                              <Label className="grid min-w-0 gap-0.5 text-[10px] font-bold text-slate-600">
                                حشو أفقي/عمودي: {excelPreviewPadX}/{excelPreviewPadY}px
                                <div className="flex gap-1.5">
                                  <Slider
                                    className="flex-1"
                                    min={4}
                                    max={24}
                                    step={1}
                                    value={[excelPreviewPadX]}
                                    onValueChange={(v) => setExcelPreviewPadX(v[0] ?? 10)}
                                  />
                                  <Slider
                                    className="flex-1"
                                    min={4}
                                    max={24}
                                    step={1}
                                    value={[excelPreviewPadY]}
                                    onValueChange={(v) => setExcelPreviewPadY(v[0] ?? 8)}
                                  />
                                </div>
                              </Label>
                              <Label className="grid min-w-0 gap-0.5 text-[10px] font-bold text-slate-600 sm:col-span-2 lg:col-span-2 2xl:col-span-1">
                                هامش إضافي عند الاقتطاع (لتفادي قص الهيدر): {excelCaptureBleed}px
                                <Slider
                                  min={0}
                                  max={16}
                                  step={1}
                                  value={[excelCaptureBleed]}
                                  onValueChange={(v) => setExcelCaptureBleed(v[0] ?? 3)}
                                />
                              </Label>
                            </div>
                          </div>
                        </div>

                        <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-1.5 sm:p-2">
                          {excelGridOpen && canOpenExcelGrid && activeSheet ? (
                            <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                              <div className="flex shrink-0 flex-col gap-1.5 border-b border-slate-200 bg-slate-50 px-2 py-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                                <p className="min-w-0 text-[10px] font-bold leading-snug text-slate-600 sm:text-[11px]">
                                  اختر الأعمدة الظاهرة من مربعات الاختيار. إعادة التوليد تستخدم كل الصفوف مع التوزيع المتوازن.
                                </p>
                                <div className="flex flex-wrap items-center justify-end gap-1.5">
                                  <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1">
                                    <span className="text-[10px] font-bold text-slate-600">صفوف الصورة</span>
                                    <Select
                                      value={String(normalizeExcelRowsPerImage(editorSource.excelRowsPerImage))}
                                      onValueChange={(value) =>
                                        updateSource(editorSource.id, {
                                          excelRowsPerImage: normalizeExcelRowsPerImage(value),
                                        })
                                      }
                                    >
                                      <SelectTrigger className="h-7 w-[5.5rem] bg-white px-2 text-[11px]">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent className="z-[960]">
                                        {EXCEL_ROWS_PER_IMAGE_OPTIONS.map((option) => (
                                          <SelectItem key={option} value={String(option)}>
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-8 w-full shrink-0 gap-1.5 px-3 text-[11px] font-bold bg-[#0C447C] hover:bg-[#0a3a66] sm:w-auto"
                                    disabled={
                                      autoExcelBusySourceIds.includes(editorSource.id) ||
                                      (editorSource.excelDataSource === "mv-sheets" &&
                                        (valuationExcelSheetLoading || !valuationExcelSheet))
                                    }
                                    onClick={() => void regenerateAutomaticExcelImages(editorSource)}
                                  >
                                    {autoExcelBusySourceIds.includes(editorSource.id) ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Settings className="h-3.5 w-3.5" />
                                    )}
                                    إعادة توليد الصور
                                  </Button>
                                </div>
                              </div>
                              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-1.5 sm:p-2">
                                {editorSource.excelDataSource === "mv-sheets" ? (
                                  valuationExcelSheetLoading ? (
                                    <div className="flex h-full items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-white text-[12px] font-bold text-slate-500">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      جارٍ تحميل شيت إجراءات التقييم...
                                    </div>
                                  ) : valuationExcelSheetError ? (
                                    <div className="flex h-full items-center justify-center rounded-md border border-dashed border-red-200 bg-red-50 px-4 text-center text-[12px] font-bold text-red-700">
                                      {valuationExcelSheetError}
                                    </div>
                                  ) : valuationExcelSheet ? (
                                    <ValuationExcelCropGrid
                                      key={`${valuationExcelSheet.id}-${excelGridRefresh}`}
                                      sheet={valuationExcelSheet}
                                      sheetId={valuationExcelSheet.id}
                                      visibleColumnKeys={normalizeVisibleExcelHeaders(
                                        valuationExcelSheet,
                                        editorSource.excelVisibleColumnsBySheet?.[activeSheetSettingsKey],
                                      )}
                                      columnSizes={editorSource.excelColumnSizesBySheet?.[activeSheetSettingsKey] ?? {}}
                                      rowHeight={excelPreviewRowHeight}
                                      columnWidthMul={excelPreviewColMul}
                                      cellFont={excelPreviewCellFont}
                                      headerFont={excelPreviewHeaderFont}
                                      padX={excelPreviewPadX}
                                      padY={excelPreviewPadY}
                                      previewZoom={excelPreviewZoom}
                                      onVisibleColumnKeysChange={(columns) =>
                                        setSourceVisibleColumns(editorSource.id, activeSheetSettingsKey, columns)
                                      }
                                      onColumnSizeChange={(column, size) =>
                                        setSourceColumnSize(editorSource.id, activeSheetSettingsKey, column, size)
                                      }
                                      onSheetSynced={async () => {
                                        if (!activeSheet?.importId) return;
                                        const s = await fetchValuationExcelSheet(activeSheet.importId);
                                        setValuationExcelSheet(s);
                                        setExcelGridRefresh((n) => n + 1);
                                      }}
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-300 bg-white px-4 text-center text-[12px] font-bold text-slate-500">
                                      لا توجد بيانات محفوظة لهذا الشيت.
                                    </div>
                                  )
                                ) : (
                                  <SmartGrid
                                    key={`${activeSheet.importId}-${activeSheet.sheetName}-${excelGridRefresh}`}
                                    projectId={projectId}
                                    importId={activeSheet.importId}
                                    importSheetName={activeSheet.sheetName}
                                    assetType="other"
                                    omitAssetTypeFilter
                                    schemaAssetType="other"
                                    sheetColumns
                                    listPageSize={10_000}
                                    accountCropMode
                                    accountCropFillHeight
                                    accountCropColBounds={excelCropColBounds}
                                    accountCropRowBounds={excelCropRowBounds}
                                    accountCropRowHeightPx={excelPreviewRowHeight}
                                    accountCropColumnWidthMul={excelPreviewColMul}
                                    accountCropCellFontPx={excelPreviewCellFont}
                                    accountCropHeaderFontPx={excelPreviewHeaderFont}
                                    accountCropCellPadXPx={excelPreviewPadX}
                                    accountCropCellPadYPx={excelPreviewPadY}
                                    accountCropPreviewZoom={excelPreviewZoom}
                                    onAccountCropColumnPick={(c) => setExcelColPicks((p) => pushPick(p, c))}
                                    onAccountCropRowPick={(r) => setExcelRowPicks((p) => pushPick(p, r))}
                                    onSave={() => setExcelGridRefresh((n) => n + 1)}
                                    refreshToken={excelGridRefresh}
                                  />
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="flex h-full min-h-[12rem] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 text-center text-[12px] font-bold leading-relaxed text-slate-500 sm:text-[13px]">
                              اختر شيتًا صالحًا لعرض الجدول الذكي وقص صورة الحسابات.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                        <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 bg-white px-4 py-2.5">
                          <p className="text-[11px] font-bold text-slate-600">
                            اسحب مستطيلاً فوق الملف كما في أداة القص، ثم اضغط تطبيق القص.
                          </p>
                          <div className="flex flex-wrap items-end gap-3">
                            {editorSource.kind === "pdf" ? (
                              <>
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={pdfPage <= 1}
                                    onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                                  >
                                    السابق
                                  </Button>
                                  <span className="px-2 text-[11px] font-black text-slate-700">
                                    {pdfPage} / {pdfPageCount}
                                  </span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={pdfPage >= pdfPageCount}
                                    onClick={() => setPdfPage((p) => Math.min(pdfPageCount, p + 1))}
                                  >
                                    التالي
                                  </Button>
                                </div>
                                <Label className="grid min-w-[10rem] flex-1 gap-1 text-[10px] font-bold text-slate-600">
                                  وضوح عرض PDF (يتأثر على جودة القص): ×{pdfRenderScale.toFixed(2)}
                                  <Slider
                                    min={1.25}
                                    max={4}
                                    step={0.05}
                                    value={[pdfRenderScale]}
                                    onValueChange={(v) => setPdfRenderScale(v[0] ?? DEFAULT_PDF_RENDER_SCALE)}
                                  />
                                </Label>
                              </>
                            ) : null}
                            <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <span className="text-[10px] font-bold text-slate-600">
                                  تكبير العرض: {Math.round(mediaPreviewZoom * 100)}% (بعد ملاءمة النافذة)
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px] font-bold text-[#0C447C]"
                                  onClick={() => {
                                    mediaZoomTouchedRef.current = false;
                                    setMediaPreviewZoom(1);
                                  }}
                                >
                                  إعادة ملاءمة
                                </Button>
                              </div>
                              <Slider
                                min={0.35}
                                max={2.75}
                                step={0.05}
                                value={[mediaPreviewZoom]}
                                onValueChange={(v) => {
                                  mediaZoomTouchedRef.current = true;
                                  setMediaPreviewZoom(v[0] ?? 1);
                                }}
                              />
                            </div>
                            <Button
                              type="button"
                              className="gap-1.5 bg-[#0C447C] hover:bg-[#0a3a66]"
                              disabled={mediaBusy || mediaCaptureBusy}
                              onClick={() => void applyMediaCapture()}
                            >
                              {mediaCaptureBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
                              تطبيق القص
                            </Button>
                          </div>
                        </div>
                        <div
                          ref={mediaViewportRef}
                          className="h-[50dvh] min-h-[50dvh] flex-none overflow-auto bg-slate-950/95"
                        >
                          <div className="flex min-h-full w-full items-start justify-center p-4 sm:p-5">
                            <div
                              dir="ltr"
                              className="relative inline-block rounded-md bg-white shadow-[0_18px_55px_rgba(0,0,0,0.28)]"
                            >
                              <canvas
                                ref={bindMediaCanvas}
                                className="rounded-md border border-slate-300 bg-white"
                                style={mediaCanvasDisplayStyle}
                              />
                              <div
                                className="absolute inset-0 cursor-crosshair touch-none"
                                style={{ touchAction: "none" }}
                                onPointerDown={(event) => {
                                  if (event.button !== 0 && event.pointerType === "mouse") return;
                                  const point = pointerPoint(event);
                                  if (!point) return;
                                  const current = normalizeSelection(mediaSelection);
                                  if (current) {
                                    const h = hitTestHandle(point, current);
                                    if (h) {
                                      cropDragRef.current = { handle: h, startPoint: point, startSel: current };
                                    } else {
                                      cropDragRef.current = null;
                                      mediaDragStartRef.current = point;
                                      setMediaSelection({ x: point.x, y: point.y, width: 0, height: 0 });
                                    }
                                  } else {
                                    cropDragRef.current = null;
                                    mediaDragStartRef.current = point;
                                    setMediaSelection({ x: point.x, y: point.y, width: 0, height: 0 });
                                  }
                                  event.currentTarget.setPointerCapture(event.pointerId);
                                }}
                                onPointerMove={(event) => {
                                  const start = mediaDragStartRef.current;
                                  const point = pointerPoint(event);
                                  if (!point) return;
                                  if (cropDragRef.current) {
                                    applyDrag(point);
                                    return;
                                  }
                                  if (!start) return;
                                  setMediaSelection(
                                    clampSel({
                                      x: Math.min(start.x, point.x),
                                      y: Math.min(start.y, point.y),
                                      width: Math.abs(point.x - start.x),
                                      height: Math.abs(point.y - start.y),
                                    }),
                                  );
                                }}
                                onPointerUp={(event) => {
                                  mediaDragStartRef.current = null;
                                  cropDragRef.current = null;
                                  try {
                                    event.currentTarget.releasePointerCapture(event.pointerId);
                                  } catch {
                                    /* ignore */
                                  }
                                }}
                                onPointerCancel={(event) => {
                                  mediaDragStartRef.current = null;
                                  cropDragRef.current = null;
                                  try {
                                    event.currentTarget.releasePointerCapture(event.pointerId);
                                  } catch {
                                    /* ignore */
                                  }
                                }}
                                onLostPointerCapture={() => {
                                  mediaDragStartRef.current = null;
                                  cropDragRef.current = null;
                                }}
                              />
                              {mediaBusy ? (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/75">
                                  <Loader2 className="h-8 w-8 animate-spin text-sky-700" />
                                </div>
                              ) : null}
                              {normalizeSelection(mediaSelection) ? (
                                (() => {
                                  const s = normalizeSelection(mediaSelection)!;
                                  const handleDot = (x: number, y: number) => (
                                    <span
                                      className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-700 bg-amber-300 shadow"
                                      style={{ left: x, top: y }}
                                    />
                                  );
                                  return (
                                    <div
                                      className="pointer-events-none absolute border-2 border-amber-400 bg-amber-200/15 shadow-[0_0_0_9999px_rgba(15,23,42,0.22)]"
                                      style={{ left: s.x, top: s.y, width: s.width, height: s.height }}
                                    >
                                      {handleDot(0, 0)}
                                      {handleDot(s.width, 0)}
                                      {handleDot(s.width, s.height)}
                                      {handleDot(0, s.height)}
                                      {handleDot(s.width / 2, 0)}
                                      {handleDot(s.width, s.height / 2)}
                                      {handleDot(s.width / 2, s.height)}
                                      {handleDot(0, s.height / 2)}
                                    </div>
                                  );
                                })()
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {editorImages.length > 0 ? (
                  <aside className="flex w-[min(13.75rem,34vw)] shrink-0 flex-col border-s border-slate-200 bg-white">
                    <div className="shrink-0 border-b border-slate-100 px-2.5 py-2">
                      <p className="text-[11px] font-black text-slate-800">معاينات الصور</p>
                      <p className="mt-0.5 text-[9px] font-semibold leading-snug text-slate-500">
                        يمين الشاشة: الملف والجدول · يسار القائمة: الصور الناتجة (مرّر للأسفل)
                      </p>
                    </div>
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-2 py-2">
                      {editorImages.map((im) => (
                        <div
                          key={im.id}
                          className="rounded-lg border border-slate-200/90 bg-gradient-to-b from-slate-50 to-white p-1.5 shadow-sm"
                        >
                          <button
                            type="button"
                            className="block w-full overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200/80 transition hover:ring-sky-300"
                            onClick={() => setPreviewImage(im)}
                          >
                            <img
                              src={accountingImageSrc(projectId, im)}
                              alt=""
                              className="mx-auto h-[5.5rem] w-full object-contain"
                              loading="lazy"
                              decoding="async"
                            />
                          </button>
                          <p className="mt-1 line-clamp-2 min-h-[2rem] text-[9px] font-bold leading-tight text-slate-700">
                            {cleanAccountingText(im.name)}
                          </p>
                          <label className="mt-1 flex cursor-pointer items-center justify-between gap-2 rounded-md border border-slate-100 bg-white/90 px-1.5 py-1">
                            <span className="text-[9px] font-extrabold text-slate-600">عرض في التقرير</span>
                            <Switch
                              checked={im.includeInReport !== false}
                              onCheckedChange={(checked) => updateImage(im.id, { includeInReport: checked })}
                              className="scale-90"
                              dir="ltr"
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  </aside>
                ) : null}
              </div>

              <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-3 py-2.5 sm:px-4">
                <p className="text-[10px] font-semibold text-slate-500 sm:text-[11px]">
                  التغييرات تُحفظ محلياً تلقائياً. اضغط «حفظ» لمزامنة القاعدة فوراً.
                </p>
                <Button
                  type="button"
                  className="h-9 min-w-[7.5rem] gap-1.5 bg-emerald-700 px-4 text-[12px] font-bold hover:bg-emerald-800"
                  disabled={editorSaving}
                  onClick={() => void saveEditorModalAndClose()}
                >
                  {editorSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  حفظ
                </Button>
              </footer>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={previewImage !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewImage(null);
        }}
      >
        <DialogContent
          className={cn(
            // معاينة منفصلة: أكبر قليلاً + Scroll داخلي.
            "fixed left-1/2 top-1/2 z-[930] flex h-[86dvh] w-[min(92vw,1400px)] max-w-[96vw] -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950 p-0 text-white shadow-2xl",
            "sm:rounded-2xl",
            "[&>button]:hidden",
          )}
          dir="rtl"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-3 py-2.5 sm:px-4">
            <DialogTitle className="flex min-w-0 flex-1 items-center gap-2 text-[14px] font-black sm:text-base">
              <ImageIcon className="h-4 w-4 shrink-0 text-amber-300" />
              <span className="truncate">
                {previewImage ? cleanAccountingText(previewImage.name) : "معاينة الصورة"}
              </span>
            </DialogTitle>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 border-slate-600 bg-transparent text-white hover:bg-slate-800"
              onClick={() => setPreviewImage(null)}
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-slate-900 p-4">
            {previewImage ? (
              <div className="flex min-h-[min(70vh,720px)] items-center justify-center">
                <img
                  key={previewImage.dataUrl ?? previewImage.fileId ?? previewImage.id}
                  src={accountingImageSrc(projectId, previewImage)}
                  alt={cleanAccountingText(previewImage.name)}
                  decoding="async"
                  onError={() => {
                    toast({ variant: "destructive", description: "تعذر عرض الصورة الحالية." });
                  }}
                  className="max-h-[min(78vh,900px)] w-auto max-w-full rounded-sm bg-white object-contain shadow-2xl shadow-black/40"
                />
              </div>
            ) : null}
          </div>
          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/95 px-3 py-2.5 sm:px-4">
            <p className="text-[10px] font-semibold text-slate-400 sm:text-[11px]">
              اضغط «حفظ» لإظهار الصور في إعداد التقرير.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 border-slate-600 bg-transparent px-3 text-[12px] text-white hover:bg-slate-800"
                onClick={() => setPreviewImage(null)}
              >
                إغلاق
              </Button>
              <Button
                type="button"
                className="h-9 min-w-[7rem] gap-1.5 bg-emerald-600 px-4 text-[12px] font-bold hover:bg-emerald-700"
                disabled={previewSaving}
                onClick={() => void savePreviewModalAndClose()}
              >
                {previewSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ
              </Button>
            </div>
          </footer>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingUploadPreview !== null}
        onOpenChange={(open) => {
          if (!open) closePendingUploadPreview();
        }}
      >
        <DialogContent
          className={cn(
            "fixed left-1/2 top-1/2 z-[940] flex h-[88dvh] w-[min(94vw,1320px)] max-w-[96vw] -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden rounded-xl border border-slate-800/70 bg-slate-950 p-0 text-white shadow-2xl",
            "sm:rounded-2xl",
            "[&>button]:hidden",
          )}
          dir="rtl"
        >
          {pendingUploadPreview ? (
            <>
              <DialogHeader className="shrink-0 border-b border-slate-800 bg-slate-950/95 px-3 py-3 text-right sm:px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="flex min-w-0 items-center gap-2 text-[14px] font-black sm:text-base">
                      {pendingUploadPreview.kind === "excel" ? (
                        <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-300" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-red-300" />
                      )}
                      <span className="truncate">{cleanAccountingText(pendingUploadPreview.title)}</span>
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-[12px] font-semibold text-slate-300">
                      {pendingUploadPreview.message}
                    </DialogDescription>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 shrink-0 border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
                    onClick={closePendingUploadPreview}
                    aria-label="إغلاق"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-bold text-slate-200">
                    {approachLabel(pendingUploadPreview.approachId)}
                  </span>
                  <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-bold text-slate-200">
                    {pendingUploadPreview.files.length} ملف
                  </span>
                  {pendingUploadPreview.kind !== "excel" && pendingUploadPreview.estimatedImageCount ? (
                    <span className="rounded-md border border-emerald-800 bg-emerald-950/60 px-2 py-1 text-[11px] font-bold text-emerald-200">
                      {pendingUploadPreview.estimatedImageCount} صورة متوقعة
                    </span>
                  ) : null}
                  {pendingUploadPreview.pageCount ? (
                    <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-bold text-slate-200">
                      {pendingUploadPreview.pageCount} صفحة PDF
                    </span>
                  ) : null}
                  {pendingUploadPreview.sheetName ? (
                    <span className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-bold text-slate-200">
                      {pendingUploadPreview.sheetName} · {pendingUploadPreview.rowCount ?? 0} صف ·{" "}
                      {pendingUploadPreview.columnCount ?? 0} عمود
                    </span>
                  ) : null}
                </div>

                {pendingUploadPreview.previewDataUrl ? (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Button
                      type="button"
                      variant={pendingPreviewPixelPerfect ? "default" : "secondary"}
                      size="sm"
                      className={cn(
                        "h-8 px-2 text-[11px]",
                        pendingPreviewPixelPerfect
                          ? "bg-amber-600 text-white hover:bg-amber-700"
                          : "border-slate-700 text-slate-200",
                      )}
                      onClick={() => setPendingPreviewPixelPerfect(true)}
                    >
                      1:1
                    </Button>
                    <Button
                      type="button"
                      variant={!pendingPreviewPixelPerfect ? "default" : "secondary"}
                      size="sm"
                      className={cn(
                        "h-8 px-2 text-[11px]",
                        !pendingPreviewPixelPerfect
                          ? "bg-amber-600 text-white hover:bg-amber-700"
                          : "border-slate-700 text-slate-200",
                      )}
                      onClick={() => setPendingPreviewPixelPerfect(false)}
                    >
                      ملائم للشاشة
                    </Button>
                    <div className="flex min-w-[12rem] flex-1 items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1.5">
                      <span className="text-[11px] font-bold text-slate-300">Zoom</span>
                      <Slider
                        min={0.5}
                        max={2.5}
                        step={0.05}
                        value={[pendingPreviewZoom]}
                        onValueChange={(v) => setPendingPreviewZoom(v[0] ?? 1)}
                        className="flex-1"
                      />
                      <span className="text-[11px] font-bold text-slate-300" dir="ltr">
                        {Math.round(pendingPreviewZoom * 100)}%
                      </span>
                    </div>
                    {pendingUploadPreview.kind === "excel" ? (
                      <label className="flex min-w-[13rem] items-center gap-2 rounded-md border border-slate-800 bg-slate-950/40 px-2 py-1.5">
                        <span className="whitespace-nowrap text-[11px] font-bold text-slate-300">
                          صفوف الصورة
                        </span>
                        <Input
                          type="number"
                          min={MIN_EXCEL_PDF_ROWS_PER_IMAGE}
                          max={MAX_EXCEL_PDF_ROWS_PER_IMAGE}
                          value={normalizeExcelPdfRowsPerImage(pendingUploadPreview.excelRowsPerImage)}
                          onChange={(event) => {
                            const rows = normalizeExcelPdfRowsPerImage(event.target.value);
                            setPendingUploadPreview((current) =>
                              current?.id === pendingUploadPreview.id
                                ? { ...current, excelRowsPerImage: rows }
                                : current,
                            );
                          }}
                          className="h-7 w-20 border-slate-700 bg-slate-900 text-center text-[12px] font-bold text-white"
                          dir="ltr"
                        />
                      </label>
                    ) : null}
                    {pendingPreviewNatural ? (
                      <span className="text-[11px] font-semibold text-slate-400" dir="ltr">
                        {pendingPreviewNatural.w} × {pendingPreviewNatural.h} px
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-auto bg-[linear-gradient(45deg,rgba(255,255,255,0.035)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.035)_75%),linear-gradient(45deg,rgba(255,255,255,0.035)_25%,transparent_25%,transparent_75%,rgba(255,255,255,0.035)_75%)] bg-[length:24px_24px] bg-[position:0_0,12px_12px] p-3 sm:p-4">
                {pendingUploadPreview.status === "processing" ? (
                  <div className="flex h-full min-h-[24rem] items-center justify-center">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Loader2 className="h-9 w-9 animate-spin text-amber-300" />
                      <p className="text-[13px] font-bold text-slate-200">جاري تجهيز المعاينة...</p>
                    </div>
                  </div>
                ) : pendingUploadPreview.status === "error" ? (
                  <div className="flex h-full min-h-[24rem] items-center justify-center">
                    <div className="max-w-lg rounded-lg border border-red-800 bg-red-950/50 px-4 py-4 text-center">
                      <p className="text-[13px] font-black text-red-100">تعذر تجهيز المعاينة</p>
                      <p className="mt-1 text-[12px] font-semibold text-red-200">
                        {pendingUploadPreview.error ?? pendingUploadPreview.message}
                      </p>
                    </div>
                  </div>
                ) : pendingUploadPreview.previewDataUrl ? (
                  <div
                    className={cn(
                      "flex min-h-full min-w-0",
                      pendingPreviewPixelPerfect
                        ? "items-start justify-start overflow-auto"
                        : "items-center justify-center overflow-auto p-1",
                    )}
                    style={pendingPreviewPixelPerfect ? { direction: "ltr" } : undefined}
                  >
                    <img
                      key={pendingUploadPreview.previewDataUrl}
                      src={pendingUploadPreview.previewDataUrl}
                      alt="معاينة الصورة النهائية"
                      decoding="async"
                      onLoad={(event) => {
                        setPendingPreviewNatural({
                          w: event.currentTarget.naturalWidth,
                          h: event.currentTarget.naturalHeight,
                        });
                      }}
                      className="rounded-sm bg-white shadow-2xl shadow-black/40"
                      style={
                        pendingPreviewPixelPerfect
                          ? {
                              width: "auto",
                              height: "auto",
                              maxWidth: "none",
                              maxHeight: "none",
                              transform: `scale(${pendingPreviewZoom})`,
                              transformOrigin: "top left",
                              imageRendering: "auto",
                              display: "block",
                            }
                          : {
                              display: "block",
                              width: "auto",
                              height: "auto",
                              maxWidth: "100%",
                              maxHeight: "min(72vh, 980px)",
                              objectFit: "contain" as const,
                              transform: `scale(${pendingPreviewZoom})`,
                              transformOrigin: "center center",
                              imageRendering: "auto",
                            }
                      }
                    />
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-950/95 px-3 py-3 sm:px-4">
                <p className="min-w-0 flex-1 text-[11px] font-semibold text-slate-400">
                  المعالجة تتم تلقائياً بعد اختيار الملف.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 border-slate-700 bg-slate-900 px-3 text-[12px] text-white hover:bg-slate-800"
                  onClick={closePendingUploadPreview}
                >
                  إغلاق
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {fileProcessOverlay ? (
        <MvUploadProgressToast
          phase={fileProcessOverlay.phase}
          label={
            fileProcessOverlay.fileName
              ? cleanAccountingText(fileProcessOverlay.fileName)
              : "معالجة الملفات"
          }
          progress={
            fileProcessOverlay.total > 0
              ? Math.min(100, Math.round((fileProcessOverlay.current / fileProcessOverlay.total) * 100))
              : 8
          }
          state="uploading"
          detail={
            fileProcessOverlay.total > 0
              ? `${fileProcessOverlay.current} / ${fileProcessOverlay.total}`
              : null
          }
        />
      ) : null}
    </MvWorkflowPageFrame>
  );
}
