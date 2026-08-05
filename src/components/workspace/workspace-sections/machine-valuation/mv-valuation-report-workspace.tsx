"use client";

import { Tajawal } from "next/font/google";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Eye,
  FileText,
  FileType,
  ImageIcon,
  ListTree,
  Loader2,
  PencilRuler,
  RotateCcw,
  Ruler,
  Save,
  Settings2,
  Sliders,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog,  DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MvDialogContent } from "./mv-dialog";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  MvProjectReportHeader,
  readVisitedSimpleReportSteps,
  writeVisitedSimpleReportSteps,
} from "./mv-simple-report-navigation";
import type {
  MvDriveFile,
  MvCompanyAiReportTemplate,
  MvCompanyReportCustomSection,
  MvCompanyReportLetterheadTemplate,
  MvProject,
  MvProjectReportData,
  MvReportPageOrientationPreference,
  MvReportEditableSection,
  MvSubProject,
  PicAssetImage,
} from "./types"
import {
  emptyValuationAccountingStore,
  mergeValuationAccountingStores,
  readValuationAccountingStore,
  resolveValuationAccountingImageSrc,
  valuationAccountingStoreForApi,
  writeValuationAccountingStore,
  type MvValuationAccountingImage,
  type MvValuationAccountingStore,
} from "./mv-valuation-accounting-store";
import {
  clientDocumentImagesForReport,
  mergeClientDocumentsStores,
  readClientDocumentsStore,
  resolveClientDocumentImageSrc,
  writeClientDocumentsStore,
  type MvClientDocumentsStore,
} from "./mv-client-documents-store";
import { MvReportExportMenu, type MvReportExportFormat } from "./mv-report-export-menu";
import { MvWordTemplateModal } from "./mv-word-template-modal";
import { buildMvWordImageLayout } from "./mv-word-template-settings";
import {
  downloadMergedReportFiles,
  mergeWordReportTemplateSmart,
  prepareMvWordMergeInput,
} from "@/lib/mv-word-template";
import { MvReportImagesControlPanel } from "./mv-report-images-control-panel";
import { mvAutoPdfDownloadStorageKey, postReportPdfExportToParent } from "./mv-home-routes";
import { useMvInPageNavigation } from "./mv-inpage-navigation";
import { MV_WORKFLOW_SESSION, readMvWorkflowSessionJson, writeMvWorkflowSessionJson } from "./mv-workflow-session-cache";
import { fetchWithRetry, mapWithConcurrency } from "./mv-concurrent-fetch";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { downloadDocxFromSheets, type DocxSheetSource } from "@/lib/docx-export";
import { downloadPptxFromPngSlides, type PptxImageSlide } from "@/lib/pptx-export";
import { MvWorkflowPageFrame } from "./mv-workflow-page-frame";
import { MvErrorState } from "./mv-ui";
import { mvErrorMessage, mvFetchJson } from "./mv-api-client";
import { useMvI18n, getMvT, type MvT } from "./mv-i18n";
import { ReportRichSelectionToolbar } from "./mv-report-rich-selection-toolbar";
import { MvValuationReportDocumentBody } from "./mv-valuation-report-document-body";
import {
  MV_DEFAULT_NARRATIVE_B1,
  MV_DEFAULT_NARRATIVE_B2,
  MV_DEFAULT_NARRATIVE_B3,
  MV_DEFAULT_NARRATIVE_B4,
} from "./mv-valuation-report-narrative-defaults";
import { MV_REPORT_SCROLL_ANCHOR_ORDER, MV_REPORT_TOC_ROWS } from "./mv-valuation-report-toc";
import { ReportViewportScaleContext } from "./mv-report-viewport-scale";
import {
  normalizeReportPreparerOptions,
  normalizeReportTeam,
  type MvReportPreparerOption,
} from "./mv-report-preparers";

function applyMvReportCaptureClone(clonedDoc: Document) {
  const stableCaptureStyle = clonedDoc.createElement("style");
  stableCaptureStyle.textContent = `
    [data-mv-report-sheet] {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
      filter: none !important;
      transition: none !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      -webkit-font-smoothing: antialiased !important;
      -moz-osx-font-smoothing: grayscale !important;
    }
    [data-mv-report-sheet][data-mv-report-orientation="portrait"] {
      width: 210mm !important;
      height: 297mm !important;
      min-width: 210mm !important;
      max-width: 210mm !important;
      min-height: 297mm !important;
      max-height: 297mm !important;
    }
    [data-mv-report-sheet][data-mv-report-orientation="landscape"] {
      width: 297mm !important;
      height: 210mm !important;
      min-width: 297mm !important;
      max-width: 297mm !important;
      min-height: 210mm !important;
      max-height: 210mm !important;
    }
    [data-mv-report-page-content] {
      min-height: 0 !important;
      overflow: hidden !important;
    }
    [data-mv-report-sheet] * {
      -webkit-font-smoothing: antialiased !important;
    }
    [data-mv-report-sheet] img,
    [data-mv-report-sheet] picture img {
      image-rendering: auto !important;
    }
    [data-mv-annex-hq-wrap] {
      transform: none !important;
      width: 100% !important;
    }
  `;
  clonedDoc.head.appendChild(stableCaptureStyle);
  clonedDoc.querySelectorAll(".mv-report-chrome").forEach((n) => n.remove());
  clonedDoc.querySelectorAll<HTMLElement>("[data-mv-report-scale-viewport]").forEach((el) => {
    el.style.overflow = "visible";
    el.style.maxWidth = "none";
  });
  clonedDoc.querySelectorAll<HTMLElement>("[data-mv-report-scale-shell]").forEach((el) => {
    el.style.transform = "none";
    el.style.transformOrigin = "top left";
    el.style.willChange = "auto";
  });
  clonedDoc.querySelectorAll<HTMLElement>("[data-mv-report-sheet]").forEach((el) => {
    el.style.margin = "0";
    el.style.marginBottom = "0";
    el.style.transform = "none";
    el.style.opacity = "1";
    el.style.filter = "none";
    el.style.animation = "none";
    el.style.transition = "none";
    el.style.boxShadow = "none";
    el.style.borderRadius = "0";
  });
  clonedDoc.querySelectorAll<HTMLElement>("[data-mv-report-sheet], [data-mv-report-sheet] *").forEach((el) => {
    el.style.letterSpacing = "0";
    el.style.fontKerning = "normal";
    el.style.textRendering = "optimizeLegibility";
    el.style.fontFeatureSettings = '"liga" 1, "calt" 1, "kern" 1';
  });
  clonedDoc.querySelectorAll("img").forEach((raw) => {
    raw.setAttribute("loading", "eager");
    raw.setAttribute("decoding", "sync");
  });
  clonedDoc.querySelectorAll("input.mv-report-preparer-field").forEach((raw) => {
    const inp = raw as HTMLInputElement;
    const span = clonedDoc.createElement("span");
    span.textContent = inp.value.trim() || "—";
    span.className = "my-1 block text-[12px] font-semibold text-slate-900";
    inp.replaceWith(span);
  });
}

function mvExportToastDescription(error: unknown, fallbackKey: string, t: MvT): string {
  if (!(error instanceof Error)) return t(fallbackKey);
  if (error.message.startsWith("report.")) return t(error.message);
  return error.message;
}

/** يضمن التقاط الصفحات العريضة والمحتوى الممتد دون قص في html2canvas */
const CSS_PX_PER_MM = 96 / 25.4;

function expectedA4CssBox(landscape: boolean) {
  return {
    w: Math.round((landscape ? 297 : 210) * CSS_PX_PER_MM),
    h: Math.round((landscape ? 210 : 297) * CSS_PX_PER_MM),
  };
}

function getSheetPixelBox(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const landscape = el.dataset.mvReportOrientation === "landscape";
  const expected = expectedA4CssBox(landscape);
  const w = Math.max(Math.ceil(rect.width), el.offsetWidth, expected.w, 1);
  const h = Math.max(Math.ceil(rect.height), el.offsetHeight, expected.h, 1);
  return { w, h };
}

/**
 * دقة لقطة الشاشة — توازن بين وضوح النص/الصور وسرعة التصدير.
 */
const REPORT_PDF_CAPTURE_SCALE_PORTRAIT = 2.65;
const REPORT_PDF_CAPTURE_SCALE_LANDSCAPE = 2.45;
/** حد أمان للبكسل — يمنع تجاوز ذاكرة المتصفح ويبطئ html2canvas */
const REPORT_PDF_CAPTURE_MAX_MEGAPIXELS = 48;
const REPORT_PDF_CAPTURE_MIN_SCALE = 0.25;
/** JPEG أسرع بكثير من PNG داخل jsPDF */
const REPORT_PDF_JPEG_QUALITY = 0.91;

function resolveReportPdfCaptureScale(boxW: number, boxH: number, landscape: boolean): number {
  const preferred = landscape ? REPORT_PDF_CAPTURE_SCALE_LANDSCAPE : REPORT_PDF_CAPTURE_SCALE_PORTRAIT;
  const areaPixels = Math.max(1, boxW * boxH);
  const cap = Math.sqrt((REPORT_PDF_CAPTURE_MAX_MEGAPIXELS * 1_000_000) / areaPixels);
  const next = Math.max(REPORT_PDF_CAPTURE_MIN_SCALE, Math.min(preferred, cap));
  return Math.round(next * 1000) / 1000;
}

function reportPdfPageMetrics(landscape: boolean) {
  return landscape
    ? { orientation: "l" as const, pdfW: 841.89, pdfH: 595.28 }
    : { orientation: "p" as const, pdfW: 595.28, pdfH: 841.89 };
}

function resolveReportPdfSliceCssHeight(boxW: number, boxH: number, landscape: boolean) {
  const { pdfW, pdfH } = reportPdfPageMetrics(landscape);
  const expected = expectedA4CssBox(landscape);
  const fullPageHeight = Math.max(expected.h, Math.round(boxW * (pdfH / pdfW)));
  return boxH <= fullPageHeight + 4 ? Math.max(1, boxH) : Math.max(1, fullPageHeight);
}

async function canvasToReportJpegBytes(
  canvas: HTMLCanvasElement,
  quality = REPORT_PDF_JPEG_QUALITY,
) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (next) => {
        if (next) resolve(next);
        else reject(new Error("report.export.pdfCompressFailed"));
      },
      "image/jpeg",
      quality,
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

async function canvasToReportPngBytes(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (next) => {
        if (next) resolve(next);
        else reject(new Error("report.export.pdfCompressFailed"));
      },
      "image/png",
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

function prepareReportCaptureLayout(root: HTMLElement) {
  const sheets = Array.from(root.querySelectorAll<HTMLElement>("[data-mv-report-sheet]"));
  const scaleShells = Array.from(root.querySelectorAll<HTMLElement>("[data-mv-report-scale-shell]"));
  const scaleViewports = Array.from(root.querySelectorAll<HTMLElement>("[data-mv-report-scale-viewport]"));
  const savedSheets = sheets.map((el) => ({
    el,
    animation: el.style.animation,
    transition: el.style.transition,
    opacity: el.style.opacity,
    transform: el.style.transform,
    filter: el.style.filter,
  }));
  const savedShells = scaleShells.map((el) => ({
    el,
    transform: el.style.transform,
    transformOrigin: el.style.transformOrigin,
    willChange: el.style.willChange,
  }));
  const savedViewports = scaleViewports.map((el) => ({
    el,
    width: el.style.width,
    height: el.style.height,
    minHeight: el.style.minHeight,
    maxWidth: el.style.maxWidth,
    overflow: el.style.overflow,
  }));

  for (const el of sheets) {
    el.style.animation = "none";
    el.style.transition = "none";
    el.style.opacity = "1";
    el.style.transform = "none";
    el.style.filter = "none";
  }

  for (const el of scaleShells) {
    el.style.transform = "none";
    el.style.transformOrigin = "top left";
    el.style.willChange = "auto";
  }

  for (const el of scaleViewports) {
    const shell = el.querySelector<HTMLElement>("[data-mv-report-scale-shell]");
    const width = shell ? Math.max(shell.scrollWidth, shell.offsetWidth, 1) : Math.max(el.scrollWidth, 1);
    const height = shell ? Math.max(shell.scrollHeight, shell.offsetHeight, 1) : Math.max(el.scrollHeight, 1);
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.minHeight = `${height}px`;
    el.style.maxWidth = "none";
    el.style.overflow = "visible";
  }

  return () => {
    for (const item of savedViewports) {
      item.el.style.width = item.width;
      item.el.style.height = item.height;
      item.el.style.minHeight = item.minHeight;
      item.el.style.maxWidth = item.maxWidth;
      item.el.style.overflow = item.overflow;
    }
    for (const item of savedShells) {
      item.el.style.transform = item.transform;
      item.el.style.transformOrigin = item.transformOrigin;
      item.el.style.willChange = item.willChange;
    }
    for (const item of savedSheets) {
      item.el.style.animation = item.animation;
      item.el.style.transition = item.transition;
      item.el.style.opacity = item.opacity;
      item.el.style.transform = item.transform;
      item.el.style.filter = item.filter;
    }
  };
}

/**
 * Concurrency for parallel image downloads. Higher values shave seconds off
 * initial preview load when the asset gallery has many photos.
 */
const REPORT_IMAGE_DOWNLOAD_CONCURRENCY = 8;
const REPORT_IMAGE_RETRY_DELAYS_MS = [400, 900, 1800, 3400];
const REPORT_BACKGROUND_IMAGE_WARM_DELAY_MS = 40;
const REPORT_PREVIEW_WARM_IMAGE_LIMIT = 18;
const reportImageObjectUrlCache = new Map<string, string>();
const reportImagePromiseCache = new Map<string, Promise<string>>();

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function normalizeReportImageSrc(rawSrc: string) {
  if (!rawSrc || typeof window === "undefined") return rawSrc;
  try {
    return new URL(rawSrc, window.location.href).href;
  } catch {
    return rawSrc;
  }
}

function shouldCacheReportImage(rawSrc: string) {
  if (!rawSrc || typeof window === "undefined") return false;
  if (rawSrc.startsWith("data:") || rawSrc.startsWith("blob:")) return false;
  try {
    const url = new URL(rawSrc, window.location.href);
    return (
      url.origin === window.location.origin &&
      ((url.pathname.includes("/files/") && url.pathname.endsWith("/download")) ||
        url.pathname.startsWith("/uploads/company-report-templates/"))
    );
  } catch {
    return false;
  }
}

function getCachedReportImageSrc(rawSrc: string) {
  if (!shouldCacheReportImage(rawSrc)) return rawSrc;
  return reportImageObjectUrlCache.get(normalizeReportImageSrc(rawSrc)) ?? rawSrc;
}

async function fetchReportImageCached(rawSrc: string) {
  if (!shouldCacheReportImage(rawSrc)) return rawSrc;
  const key = normalizeReportImageSrc(rawSrc);
  const cached = reportImageObjectUrlCache.get(key);
  if (cached) return cached;
  const existing = reportImagePromiseCache.get(key);
  if (existing) return existing;

  const promise = (async () => {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= REPORT_IMAGE_RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        const res = await fetch(key, {
          credentials: "include",
          cache: "force-cache",
        });
        if (res.status === 429 && attempt < REPORT_IMAGE_RETRY_DELAYS_MS.length) {
          await sleep(REPORT_IMAGE_RETRY_DELAYS_MS[attempt]! + Math.floor(Math.random() * 250));
          continue;
        }
        if (!res.ok) throw new Error(`Image download failed: ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        reportImageObjectUrlCache.set(key, objectUrl);
        return objectUrl;
      } catch (err) {
        lastError = err;
        if (attempt < REPORT_IMAGE_RETRY_DELAYS_MS.length) {
          await sleep(REPORT_IMAGE_RETRY_DELAYS_MS[attempt]!);
          continue;
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Image download failed");
  })();

  reportImagePromiseCache.set(key, promise);
  try {
    return await promise;
  } finally {
    reportImagePromiseCache.delete(key);
  }
}

async function preloadReportImageCache(
  srcs: string[],
  onProgress?: (done: number, total: number) => void,
) {
  const unique = Array.from(new Set(srcs.filter((src) => shouldCacheReportImage(src))));
  if (unique.length === 0) return;
  let done = 0;
  await mapWithConcurrency(unique, REPORT_IMAGE_DOWNLOAD_CONCURRENCY, async (src) => {
    try {
      await fetchReportImageCached(src);
    } catch {
      // A failed image should not block the whole report preview.
    } finally {
      done += 1;
      onProgress?.(done, unique.length);
    }
  });
}

/** يحمّل فقط الصور غير المخزّنة مسبقاً — أسرع عند التصدير المتكرر. */
async function preloadMissingReportImageCache(
  srcs: string[],
  onProgress?: (done: number, total: number) => void,
) {
  const unique = Array.from(new Set(srcs.filter((src) => shouldCacheReportImage(src))));
  if (unique.length === 0) return;
  const missing = unique.filter((src) => !reportImageObjectUrlCache.has(normalizeReportImageSrc(src)));
  let done = unique.length - missing.length;
  onProgress?.(done, unique.length);
  if (missing.length === 0) return;
  await mapWithConcurrency(missing, REPORT_IMAGE_DOWNLOAD_CONCURRENCY, async (src) => {
    try {
      await fetchReportImageCached(src);
    } catch {
      /* ignore */
    } finally {
      done += 1;
      onProgress?.(done, unique.length);
    }
  });
}

function applyCachedReportImageSrcs(root: HTMLElement) {
  root.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    const raw = img.getAttribute("src") || img.currentSrc || img.src;
    if (!raw || !shouldCacheReportImage(raw)) return;
    const cached = reportImageObjectUrlCache.get(normalizeReportImageSrc(raw));
    if (cached && img.src !== cached) img.src = cached;
  });
}

async function prepareReportDocumentForCapture(root: HTMLElement): Promise<() => void> {
  await preloadMissingReportImageCache(collectReportImageSources(root));
  applyCachedReportImageSrcs(root);
  primeReportImagesForCapture(root);
  await waitForReportImages(root, 9000);
  await waitForReportFonts();
  const restoreLayout = prepareReportCaptureLayout(root);
  root.setAttribute("data-mv-report-capture", "1");
  await waitNextFrame();
  await waitForReportStableLayout(root, 900);
  primeReportImagesForCapture(root);
  return () => {
    root.removeAttribute("data-mv-report-capture");
    restoreLayout();
  };
}

function reportDriveFileImageSrc(projectId: string, file: MvDriveFile) {
  const anyFile = file as MvDriveFile & { sourceUrl?: string };
  if (anyFile.sourceUrl) return anyFile.sourceUrl;
  return `/api/mv/projects/${projectId}/files/${file._id}/download`;
}

function reportValuationImageSrc(projectId: string, image: { dataUrl?: string; fileId?: string }) {
  return resolveValuationAccountingImageSrc(projectId, image);
}

function waitNextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function primeReportImagesForCapture(root: HTMLElement) {
  root.querySelectorAll<HTMLImageElement>("img").forEach((img) => {
    img.loading = "eager";
    img.decoding = "sync";
    const src = img.currentSrc || img.getAttribute("src") || img.src;
    if (src && img.src !== src) img.src = src;
  });
}

async function waitForReportFonts() {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await document.fonts.ready;
  } catch {
    // Capturing can continue with fallback fonts if the browser refuses a font promise.
  }
}

async function waitForReportImages(root: HTMLElement, timeoutMs = 9000) {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("img")).filter((img) => Boolean(img.src));
  if (imgs.length === 0) return;
  await Promise.allSettled(
    imgs.map(
      (img) =>
        (async () => {
          if (!img.complete) {
            await new Promise<void>((resolve) => {
              let finished = false;
              const finish = () => {
                if (finished) return;
                finished = true;
                window.clearTimeout(timer);
                img.removeEventListener("load", finish);
                img.removeEventListener("error", finish);
                resolve();
              };
              const timer = window.setTimeout(finish, timeoutMs);
              img.addEventListener("load", finish, { once: true });
              img.addEventListener("error", finish, { once: true });
            });
          }
          if (typeof img.decode === "function" && img.naturalWidth > 0) {
            try {
              await Promise.race([img.decode(), sleep(Math.min(timeoutMs, 800))]);
            } catch {
              /* continue */
            }
          }
        })(),
    ),
  );
}

async function waitForReportStableLayout(root: HTMLElement, timeoutMs = 900) {
  const startedAt = performance.now();
  let previous = "";
  while (performance.now() - startedAt < timeoutMs) {
    await waitNextFrame();
    const sheets = Array.from(root.querySelectorAll<HTMLElement>("[data-mv-report-sheet]"));
    const next = sheets
      .map((sheet) => {
        const box = getSheetPixelBox(sheet);
        const rect = sheet.getBoundingClientRect();
        return `${box.w}x${box.h}@${Math.round(rect.top)}:${Math.round(rect.left)}`;
      })
      .join("|");
    if (next && next === previous) {
      await waitNextFrame();
      return;
    }
    previous = next;
  }
}

function collectReportImageSources(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLImageElement>("img"))
    .map((img) => img.getAttribute("src") || img.currentSrc || img.src)
    .filter((src): src is string => Boolean(src));
}

/**
 * يعرض التقرير بمقياس يتناسب مع عرض اللوحة (بدون شريط تمرير أفقي)
 * مع الحفاظ على مقاسات A4 المنطقية للتصدير — يشبه عرض PDF مُقَيَّماً للنافذة.
 */
function ReportViewportFit({
  scrollRef,
  gutterPx,
  children,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  gutterPx: number;
  children: ReactNode;
}) {
  const { dir } = useMvI18n();
  const innerRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{ s: number; boxW: number; boxH: number }>({
    s: 1,
    boxW: 0,
    boxH: 0,
  });

  const recalc = useCallback(() => {
    const sc = scrollRef.current;
    const inner = innerRef.current;
    if (!sc || !inner) return;
    requestAnimationFrame(() => {
      const W = Math.max(1, inner.scrollWidth, inner.offsetWidth);
      const H = Math.max(1, inner.scrollHeight, inner.offsetHeight);
      const avail = Math.max(0, sc.clientWidth - gutterPx);
      const s = avail > 0 ? Math.min(1, Math.max(0.12, avail / W)) : 1;
      const next = { s, boxW: W * s, boxH: H * s };
      setLayout((prev) =>
        Math.abs(prev.s - next.s) < 0.001 &&
        Math.abs(prev.boxW - next.boxW) < 0.5 &&
        Math.abs(prev.boxH - next.boxH) < 0.5
          ? prev
          : next,
      );
    });
  }, [scrollRef, gutterPx]);

  useLayoutEffect(() => {
    recalc();
    const sc = scrollRef.current;
    const inner = innerRef.current;
    if (!sc) return;
    const roScroll = new ResizeObserver(recalc);
    roScroll.observe(sc);
    const roInner = inner ? new ResizeObserver(recalc) : null;
    if (inner) roInner!.observe(inner);
    window.addEventListener("orientationchange", recalc);
    return () => {
      roScroll.disconnect();
      roInner?.disconnect();
      window.removeEventListener("orientationchange", recalc);
    };
  }, [recalc, scrollRef]);

  useEffect(() => {
    recalc();
    const frame = requestAnimationFrame(() => recalc());
    const timer = window.setTimeout(recalc, 80);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [children, recalc]);

  return (
    /* LTR هنا فقط لضبط المقياس ومنع قصّ جانبي عند ‎dir=rtl‎ في الصفحة */
    <div className="flex w-full justify-center" dir="ltr">
      <div
        data-mv-report-scale-viewport
        className="mx-auto max-w-full overflow-hidden rounded-lg shadow-[0_1px_0_0_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04]"
        style={{
          width: layout.boxW > 0 ? layout.boxW : "fit-content",
          maxWidth: "100%",
          height: layout.boxH > 0 ? layout.boxH : "auto",
          minHeight: layout.boxH > 0 ? layout.boxH : undefined,
        }}
      >
        <div
          ref={innerRef}
          data-mv-report-scale-shell
          dir={dir}
          className="inline-block align-top will-change-transform"
          style={{
            transform: `translateZ(0) scale(${layout.s})`,
            transformOrigin: "top left",
            backfaceVisibility: "hidden",
          }}
        >
          <ReportViewportScaleContext.Provider value={layout.s}>
            {children}
          </ReportViewportScaleContext.Provider>
        </div>
      </div>
    </div>
  );
}

function resolveMvCompanyLogo(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  if (t.startsWith("data:image/")) return t;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("/")) return t;
  return null;
}

interface MvValuationReportWorkspaceProps {
  projectId: string;
}

type ReportSectionId = string;
type ReportPageOrientations = Record<string, MvReportPageOrientationPreference>;

const MV_REPORT_NAV_GROUPS = (t: MvT): Array<{
  title: string;
  anchor: ReportSectionId;
  icon: ReactNode;
  activeAnchors: string[];
}> => [
  {
    title: t("report.nav.coverSections"),
    anchor: "report-cover",
    icon: <ClipboardList className="h-3 w-3" />,
    activeAnchors: [
      "report-cover",
      "report-toc",
      ...MV_REPORT_TOC_ROWS.filter((row) => row.anchor.startsWith("mv-toc-") && row.anchor !== "mv-toc-24").map(
        (row) => row.anchor,
      ),
    ],
  },
  {
    title: t("report.nav.opinionSection"),
    anchor: "mv-toc-24",
    icon: <FileText className="h-3 w-3" />,
    activeAnchors: ["mv-toc-24"],
  },
  {
    title: t("report.nav.accountsSection"),
    anchor: "mv-annex-1",
    icon: <FileText className="h-3 w-3" />,
    activeAnchors: ["mv-annex-1"],
  },
  {
    title: t("report.nav.assetImagesSection"),
    anchor: "mv-annex-2",
    icon: <ImageIcon className="h-3 w-3" />,
    activeAnchors: ["mv-annex-2"],
  },
  {
    title: t("report.nav.otherFilesSection"),
    anchor: "mv-annex-3",
    icon: <FileText className="h-3 w-3" />,
    activeAnchors: ["mv-annex-3"],
  },
  {
    title: t("report.nav.registrationSection"),
    anchor: "mv-annex-sce",
    icon: <FileText className="h-3 w-3" />,
    activeAnchors: ["mv-annex-sce"],
  },
  {
    title: t("report.nav.closingPage"),
    anchor: "mv-report-closing",
    icon: <FileText className="h-3 w-3" />,
    activeAnchors: ["mv-report-closing"],
  },
];

function isReportNavGroupActive(activeSection: ReportSectionId, activeAnchors: string[]) {
  return activeAnchors.some((anchor) => activeSection === anchor || activeSection.startsWith(`${anchor}-`));
}

type ReportSignatureRow = {
  id: string;
  name: string;
  jobTitle: string;
  roleLabel: string;
  membershipNo: string;
  signatureImageDataUrl: string;
  isCompanyAdmin: boolean;
};

type PreparerFieldEdits = Record<string, { name: string; roleLabel: string; membershipNo: string }>;

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now()}-${Math.random()}`;
}

function migratePreparerFieldEdits(bundle: {
  preparerFieldEdits?: unknown;
  signatureRows?: unknown;
} | null | undefined): PreparerFieldEdits {
  if (!bundle) return {};
  const direct = bundle.preparerFieldEdits;
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    const out: PreparerFieldEdits = {};
    for (const [k, v] of Object.entries(direct as Record<string, unknown>)) {
      if (!v || typeof v !== "object" || Array.isArray(v)) continue;
      const o = v as { name?: unknown; roleLabel?: unknown; membershipNo?: unknown };
      out[k] = {
        name: typeof o.name === "string" ? o.name : "",
        roleLabel: typeof o.roleLabel === "string" ? o.roleLabel : "",
        membershipNo: typeof o.membershipNo === "string" ? o.membershipNo : "",
      };
    }
    return out;
  }
  const legacy = bundle.signatureRows;
  if (!Array.isArray(legacy)) return {};
  const out: PreparerFieldEdits = {};
  for (const r of legacy) {
    if (!r || typeof r !== "object") continue;
    const o = r as { id?: unknown; name?: unknown; roleLabel?: unknown; membershipNo?: unknown };
    const id = typeof o.id === "string" ? o.id : "";
    if (!id) continue;
    out[id] = {
      name: typeof o.name === "string" ? o.name : "",
      roleLabel: typeof o.roleLabel === "string" ? o.roleLabel : "",
      membershipNo: typeof o.membershipNo === "string" ? o.membershipNo : "",
    };
  }
  return out;
}

function normalizeEditableSections(raw: unknown): MvReportEditableSection[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter((s): s is Record<string, unknown> => Boolean(s) && typeof s === "object")
    .map((s) => ({
      id: typeof s.id === "string" ? s.id : newId(),
      ...(typeof s.sectionNumber === "string" && s.sectionNumber.trim()
        ? { sectionNumber: s.sectionNumber.trim() }
        : {}),
      title: typeof s.title === "string" ? s.title : "قسم جديد",
      body: typeof s.body === "string" ? s.body : "",
      ...(typeof s.insertAfterAnchorId === "string" && s.insertAfterAnchorId.trim()
        ? { insertAfterAnchorId: s.insertAfterAnchorId.trim() }
        : {}),
      ...(typeof s.companyDefaultSectionId === "string" && s.companyDefaultSectionId.trim()
        ? { companyDefaultSectionId: s.companyDefaultSectionId.trim() }
        : {}),
    }));
}

function normalizeReportPageOrientations(raw: unknown): ReportPageOrientations {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ReportPageOrientations = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key) continue;
    if (value === "portrait" || value === "landscape") out[key] = value;
  }
  return out;
}

const DEFAULT_REPORT_TEMPLATE_ID = "default-report-template";
const COMPANY_LETTERHEAD_TEMPLATE_ID = "company-letterhead";
const AI_REPORT_TEMPLATE_ID_PREFIX = "ai-template:";

/**
 * الاسم المحلي `MvCompanyAiTemplate` مُبقًى عليه (بدل إعادة تسمية كل الاستخدامات
 * في هذا الملف) لكنه الآن مجرد كنية للنوع المشترك المعرّف في `types.ts`، والذي
 * يستهلكه أيضاً مُركِّب صفحات التقرير (`MvValuationReportDocumentBody`) عبر
 * الخاصية `aiTemplate` لبناء الأقسام ديناميكياً بدل الاعتماد فقط على صور الغلاف.
 */
type MvCompanyAiTemplate = MvCompanyAiReportTemplate;

type MvReportTemplateOption = {
  id: string;
  title: string;
  description: string;
  badge: string;
  outputFormat: "pdf" | "pptx";
  accentClass: string;
  previewKind:
    | "default"
    | "classic"
    | "modern"
    | "executive"
    | "industrial"
    | "minimal"
    | "field"
    | "premium"
    | "creative"
    | "deck"
    | "letterhead"
    | "ai";
  usesCompanyLetterhead?: boolean;
  usesAiTemplate?: boolean;
  aiTemplate?: MvCompanyAiTemplate;
};

const REPORT_TEMPLATE_OPTIONS = (t: MvT): MvReportTemplateOption[] => [
  {
    id: DEFAULT_REPORT_TEMPLATE_ID,
    title: t("report.templates.default.title"),
    description: t("report.templates.default.description"),
    badge: "PDF",
    outputFormat: "pdf",
    accentClass: "from-slate-700 to-slate-500",
    previewKind: "default",
  },
  {
    id: "classic-letterhead",
    title: t("report.templates.classic.title"),
    description: t("report.templates.classic.description"),
    badge: "PDF",
    outputFormat: "pdf",
    accentClass: "from-sky-600 to-cyan-500",
    previewKind: "classic",
  },
  {
    id: "modern-letterhead",
    title: t("report.templates.modern.title"),
    description: t("report.templates.modern.description"),
    badge: "PDF",
    outputFormat: "pdf",
    accentClass: "from-emerald-600 to-teal-500",
    previewKind: "modern",
  },
  {
    id: "executive-navy",
    title: t("report.templates.executive.title"),
    description: t("report.templates.executive.description"),
    badge: "PDF",
    outputFormat: "pdf",
    accentClass: "from-slate-950 via-[#0C447C] to-sky-500",
    previewKind: "executive",
  },
  {
    id: "industrial-amber",
    title: t("report.templates.industrial.title"),
    description: t("report.templates.industrial.description"),
    badge: "PDF",
    outputFormat: "pdf",
    accentClass: "from-stone-900 via-amber-700 to-orange-500",
    previewKind: "industrial",
  },
  {
    id: "minimal-graphite",
    title: t("report.templates.minimal.title"),
    description: t("report.templates.minimal.description"),
    badge: "PDF",
    outputFormat: "pdf",
    accentClass: "from-zinc-950 to-zinc-500",
    previewKind: "minimal",
  },
  {
    id: "field-teal",
    title: t("report.templates.field.title"),
    description: t("report.templates.field.description"),
    badge: "PDF",
    outputFormat: "pdf",
    accentClass: "from-teal-800 via-cyan-700 to-lime-500",
    previewKind: "field",
  },
  {
    id: "premium-burgundy",
    title: t("report.templates.premium.title"),
    description: t("report.templates.premium.description"),
    badge: "PDF",
    outputFormat: "pdf",
    accentClass: "from-rose-950 via-red-800 to-amber-500",
    previewKind: "premium",
  },
  {
    id: "creative-blocks",
    title: t("report.templates.creative.title"),
    description: t("report.templates.creative.description"),
    badge: "PDF",
    outputFormat: "pdf",
    accentClass: "from-fuchsia-700 via-sky-600 to-emerald-500",
    previewKind: "creative",
  },
  {
    id: "powerpoint-deck",
    title: t("report.templates.deck.title"),
    description: t("report.templates.deck.description"),
    badge: "PPTX",
    outputFormat: "pptx",
    accentClass: "from-orange-600 to-amber-500",
    previewKind: "deck",
  },
  {
    id: COMPANY_LETTERHEAD_TEMPLATE_ID,
    title: t("report.templates.letterhead.title"),
    description: t("report.templates.letterhead.description"),
    badge: t("report.templates.letterhead.badge"),
    outputFormat: "pdf",
    accentClass: "from-amber-600 to-orange-500",
    previewKind: "letterhead",
    usesCompanyLetterhead: true,
  },
];

function findReportTemplateOption(id: string | null | undefined, t: MvT): MvReportTemplateOption {
  const options = REPORT_TEMPLATE_OPTIONS(t);
  return options.find((item) => item.id === id) ?? options[0]!;
}

function normalizeReportTemplateId(id: string | null | undefined, t: MvT): string {
  if (typeof id === "string" && id.startsWith(AI_REPORT_TEMPLATE_ID_PREFIX)) return id.trim().slice(0, 180);
  return findReportTemplateOption(typeof id === "string" ? id : null, t).id;
}

function findReportTemplateOptionFrom(
  options: MvReportTemplateOption[],
  id: string | null | undefined,
): MvReportTemplateOption {
  return options.find((item) => item.id === id) ?? options[0]!;
}

function normalizeReportTemplateIdFrom(options: MvReportTemplateOption[], id: string | null | undefined): string {
  if (typeof id !== "string") return options[0]!.id;
  return findReportTemplateOptionFrom(options, id).id;
}

function normalizeCompanyAiTemplatesForReport(raw: unknown, t: MvT): MvCompanyAiTemplate[] {
  if (!Array.isArray(raw)) return [];
  const image = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.startsWith("data:image/") || trimmed.startsWith("/uploads/company-report-templates/")
      ? trimmed
      : null;
  };
  return raw
    .slice(0, 20)
    .map((item, index) => {
      const data = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
      const id = typeof data.id === "string" && data.id.trim() ? data.id.trim() : `ai-template-${index + 1}`;
      const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : t("report.templates.aiName", { n: index + 1 });
      return {
        id,
        name,
        analysisSummary: typeof data.analysisSummary === "string" ? data.analysisSummary : "",
        sourceFileName: typeof data.sourceFileName === "string" ? data.sourceFileName : "",
        coverImageDataUrl: image(data.coverImageDataUrl),
        pageImageDataUrl: image(data.pageImageDataUrl),
        landscapePageImageDataUrl: image(data.landscapePageImageDataUrl),
        theme: data.theme && typeof data.theme === "object" && !Array.isArray(data.theme) ? (data.theme as Record<string, unknown>) : {},
        layout:
          data.layout && typeof data.layout === "object" && !Array.isArray(data.layout)
            ? (data.layout as Record<string, unknown>)
            : {},
        sections: Array.isArray(data.sections) ? data.sections.slice(0, 60) as MvCompanyAiTemplate["sections"] : [],
        dynamicVariables: Array.isArray(data.dynamicVariables)
          ? data.dynamicVariables.slice(0, 120) as MvCompanyAiTemplate["dynamicVariables"]
          : [],
      };
    })
    .filter((template) => template.name.trim());
}

function hasCompanyLetterheadImages(template: MvCompanyReportLetterheadTemplate | null | undefined): boolean {
  if (!template) return false;
  return Boolean(
    template.coverImageDataUrl ||
      template.pageImageDataUrl ||
      template.landscapePageImageDataUrl ||
      template.logoDataUrl ||
      template.footerImageDataUrl ||
      template.signatureStampDataUrl,
  );
}

function ReportTemplateArtwork({
  option,
  previewImage,
  large = false,
}: {
  option: MvReportTemplateOption;
  previewImage?: string | null;
  large?: boolean;
}) {
  if (previewImage) {
    return (
      <img
        src={previewImage}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  const titleBars = large ? "space-y-3" : "space-y-1.5";
  const lineClass = large ? "h-2.5" : "h-1.5";
  const blockClass = large ? "h-24" : "h-10";

  return (
    <div className={cn("absolute inset-0 overflow-hidden", large ? "text-[11px]" : "text-[9px]")}>
      {option.previewKind === "ai" ? (
        <>
          <div className="absolute inset-0 bg-violet-950" />
          <div className="absolute inset-x-0 top-0 h-[18%] bg-gradient-to-l from-violet-700 via-sky-600 to-emerald-500" />
          <div className="absolute right-[9%] top-[23%] h-[18%] w-[34%] rounded-sm border border-white/25 bg-white/10" />
          <div className="absolute bottom-[12%] left-[9%] right-[9%] h-px bg-white/30" />
          <div className="absolute bottom-[16%] left-[12%] h-[16%] w-[28%] rounded bg-white/15" />
        </>
      ) : option.previewKind === "executive" ? (
        <>
          <div className="absolute inset-y-0 right-0 w-[35%] bg-slate-950" />
          <div className="absolute inset-x-0 top-0 h-[18%] bg-gradient-to-l from-sky-500 via-[#0C447C] to-slate-950" />
          <div className="absolute bottom-[12%] left-[10%] right-[42%] h-px bg-sky-300/70" />
          <div className="absolute bottom-[15%] left-[10%] h-[18%] w-[22%] border border-sky-200/70 bg-white/80" />
        </>
      ) : option.previewKind === "industrial" ? (
        <>
          <div className="absolute inset-0 bg-stone-950" />
          <div className="absolute inset-y-0 left-0 w-[28%] bg-amber-500" />
          <div className="absolute right-[12%] top-[18%] h-[62%] w-[55%] border border-amber-300/60 bg-stone-900" />
          <div className="absolute inset-x-0 bottom-[16%] h-px bg-amber-400/70" />
          <div className="absolute inset-y-0 right-[16%] w-px bg-amber-400/40" />
        </>
      ) : option.previewKind === "minimal" ? (
        <>
          <div className="absolute inset-0 bg-white" />
          <div className="absolute inset-y-0 right-0 w-[10%] bg-zinc-950" />
          <div className="absolute left-[12%] top-[13%] h-px w-[68%] bg-zinc-950" />
          <div className="absolute bottom-[12%] left-[12%] h-px w-[40%] bg-zinc-300" />
        </>
      ) : option.previewKind === "field" ? (
        <>
          <div className="absolute inset-0 bg-cyan-50" />
          <div className="absolute inset-x-0 top-0 h-[23%] bg-gradient-to-l from-teal-900 via-cyan-700 to-lime-500" />
          <div className="absolute bottom-[14%] right-[9%] h-[25%] w-[38%] border border-teal-200 bg-white" />
          <div className="absolute bottom-[14%] left-[9%] h-[25%] w-[32%] bg-teal-100" />
        </>
      ) : option.previewKind === "premium" ? (
        <>
          <div className="absolute inset-0 bg-[#fff8f2]" />
          <div className="absolute inset-x-0 top-0 h-[18%] bg-gradient-to-l from-rose-950 via-red-800 to-amber-500" />
          <div className="absolute bottom-0 right-0 h-[30%] w-[55%] bg-rose-950" />
          <div className="absolute bottom-[30%] right-0 h-1 w-[55%] bg-amber-500" />
          <div className="absolute left-[10%] top-[23%] h-[42%] w-[34%] border border-amber-400/70 bg-white" />
        </>
      ) : option.previewKind === "creative" ? (
        <>
          <div className="absolute inset-0 bg-white" />
          <div className="absolute right-0 top-0 h-[34%] w-[48%] bg-fuchsia-700" />
          <div className="absolute left-0 top-0 h-[24%] w-[52%] bg-sky-600" />
          <div className="absolute bottom-0 right-[18%] h-[30%] w-[42%] bg-emerald-500" />
          <div className="absolute bottom-[18%] left-[8%] h-[22%] w-[25%] border-2 border-slate-900" />
        </>
      ) : option.previewKind === "deck" ? (
        <>
          <div className="absolute inset-0 bg-slate-950" />
          <div className="absolute inset-y-0 left-0 w-[44%] bg-gradient-to-b from-orange-500 to-amber-400" />
          <div className="absolute right-[10%] top-[18%] h-[46%] w-[38%] border border-white/35 bg-white/10" />
          <div className="absolute bottom-[16%] right-[10%] h-1 w-[38%] bg-white/80" />
        </>
      ) : option.previewKind === "modern" ? (
        <>
          <div className="absolute inset-0 bg-emerald-50" />
          <div className="absolute inset-x-0 top-0 h-[18%] bg-gradient-to-l from-emerald-700 to-teal-500" />
          <div className="absolute bottom-[14%] left-[10%] right-[10%] h-[18%] bg-white ring-1 ring-emerald-100" />
        </>
      ) : option.previewKind === "classic" ? (
        <>
          <div className="absolute inset-0 bg-sky-50" />
          <div className="absolute inset-x-0 top-0 h-[16%] bg-gradient-to-l from-[#0C447C] to-sky-500" />
          <div className="absolute inset-x-[10%] bottom-[12%] h-px bg-[#0C447C]/35" />
        </>
      ) : (
        <>
          {/* معاينة القالب الافتراضي: غلاف كحلي عميق مستوحى من تقارير «إنفاذ/تقييم» */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#081f36] via-[#0c3052] to-[#0e3658]" />
          <div className="absolute inset-x-[12%] top-[18%] h-px bg-white/20" />
          <div className="absolute inset-x-[14%] bottom-[18%] h-px bg-[#c9a227]/55" />
          <div className="absolute bottom-[14%] left-1/2 h-[2px] w-[28%] -translate-x-1/2 rounded-full bg-gradient-to-l from-transparent via-[#c9a227] to-transparent" />
          <div className="absolute inset-x-[18%] top-[34%] h-[28%] rounded-md bg-white/92 ring-1 ring-white/70" />
        </>
      )}

      <div
        className={cn(
          "absolute rounded-sm bg-white/90 p-2 shadow-sm ring-1 ring-slate-900/10",
          large ? "left-[12%] right-[12%] top-[30%]" : "left-[12%] right-[12%] top-[32%]",
          option.previewKind === "executive" && "right-[42%] bg-white text-slate-950",
          option.previewKind === "industrial" && "left-[16%] right-[36%] bg-stone-100",
          option.previewKind === "minimal" && "left-[18%] right-[18%] top-[25%] shadow-none ring-0",
          option.previewKind === "deck" && "left-[49%] right-[9%] bg-white/95",
        )}
      >
        <div className={titleBars}>
          <div className={cn(lineClass, "w-1/2 rounded bg-slate-800")} />
          <div className={cn(lineClass, "w-full rounded bg-slate-300")} />
          <div className={cn(lineClass, "w-10/12 rounded bg-slate-200")} />
          {large ? <div className={cn(lineClass, "w-8/12 rounded bg-slate-200")} /> : null}
        </div>
        <div className={cn("mt-3 grid grid-cols-2 gap-2", large && "mt-5 gap-3")}>
          <div className={cn(blockClass, "rounded bg-slate-100")} />
          <div className={cn(blockClass, "rounded bg-slate-100")} />
        </div>
      </div>
    </div>
  );
}

function isReportDraftMode(data: MvProjectReportData | undefined | null) {
  return data?.reportPresentationDraft !== false;
}

function withDraftDefaultReportData(data: MvProjectReportData | undefined | null): MvProjectReportData {
  return {
    ...(data ?? {}),
    reportTemplateId: normalizeReportTemplateId(data?.reportTemplateId, getMvT()),
    reportPresentationDraft: isReportDraftMode(data),
  };
}

function withDraftDefaultProject(project: MvProject | null | undefined): MvProject | null {
  if (!project) return null;
  return {
    ...project,
    reportData: withDraftDefaultReportData(project.reportData),
  };
}

const reportFont = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
});

function normalizePath(path: string) {
  return path.replace(/\\/g, "/").split("/").filter(Boolean).join("/");
}

function folderPathFromFile(file: MvDriveFile) {
  if (file.folderPath) return normalizePath(file.folderPath);
  const path = normalizePath(file.relativePath || file.name);
  const parts = path.split("/").filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "صور مباشرة";
}

function ReportTocItem({
  active,
  icon,
  title,
  onClick,
  collapsed = false,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  onClick: () => void;
  collapsed?: boolean;
}) {
  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        aria-label={title}
        className={cn(
          "group relative mx-auto flex h-7 w-7 items-center justify-center rounded-md transition",
          active
            ? "bg-[#0C447C] text-white shadow-sm ring-1 ring-[#0C447C]/40"
            : "text-slate-500 hover:bg-slate-100 hover:text-[#0C447C]",
        )}
      >
        <span className="[&_svg]:h-3 [&_svg]:w-3">{icon}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right transition",
        active
          ? "bg-sky-50 text-[#0a1f33]"
          : "text-slate-600 hover:bg-slate-50/80 hover:text-slate-900",
      )}
    >
      {active ? (
        <span
          className="absolute right-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-[#0C447C]"
          aria-hidden
        />
      ) : null}
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded",
          active ? "bg-[#0C447C] text-white" : "bg-slate-100 text-slate-500",
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[10.5px] leading-snug",
          active ? "font-black" : "font-bold",
        )}
      >
        {title}
      </span>
    </button>
  );
}

function ControlSlider({
  icon,
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const { dir } = useMvI18n();
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <label className="grid min-w-0 gap-1 rounded-md border border-slate-200/80 bg-white px-2 py-1.5 text-right transition hover:border-slate-300">
      <span className="flex items-center justify-between gap-2 text-[10px] font-bold text-slate-600">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-[#0C447C] opacity-80 [&_svg]:h-3 [&_svg]:w-3">{icon}</span>
          <span className="min-w-0 truncate leading-tight">{label}</span>
        </span>
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-black tabular-nums text-[#0C447C]">
          {Math.round(value)}
          {suffix ?? ""}
        </span>
      </span>
      <div className="flex items-center gap-2">
        <Slider
          dir={dir}
          className="min-w-0 flex-1 py-1"
          min={min}
          max={max}
          step={step}
          value={[value]}
          onValueChange={(next) => {
            const first = next[0];
            if (typeof first === "number") onChange(first);
          }}
        />
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : min}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(clamp(n));
          }}
          className="h-7 w-[3rem] shrink-0 rounded-md border border-slate-200 bg-white px-1 text-center text-[10.5px] font-black tabular-nums text-[#0C447C] outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-300"
        />
      </div>
    </label>
  );
}

type ReportLayoutPrefs = {
  marginX: number;
  marginY: number;
  sectionGap: number;
  imageGroupGap: number;
  imageInnerGap: number;
  assetImageWidth: number;
  valuationImageWidth: number;
  assetImagesPerPage: number;
  assetImagesPerRow: number;
  assetImagesUniformSize: boolean;
  /** نصف قطر حواف الصور (px). 0 = حواف حادة. */
  imageCornerRadius: number;
  /** ارتفاع السطر داخل الفقرات (×). */
  paragraphLineHeight: number;
  /** مقياس حجم خط عناوين الأقسام (×). */
  headingScale: number;
  /** قوة ظل الصور (0 = بدون ظل، 1..4 = مستويات تدرج). */
  imageShadow: number;
};

type ValuationReportSessionBundle = {
  project: MvProject | null;
  files: MvDriveFile[];
  fetchedAt: number;
  /** تعديلات محلية على الاسم والدور فقط؛ التوقيع يأتي من لوحة الشركة. */
  preparerFieldEdits?: PreparerFieldEdits;
  /** @deprecated — يُستورد إلى preparerFieldEdits عند التحميل */
  signatureRows?: ReportSignatureRow[];
  signatureRowsCompanySynced?: boolean;
  editableSections?: MvReportEditableSection[];
  reportLayout?: ReportLayoutPrefs;
  reportNarrativeB1?: string;
  reportNarrativeB2?: string;
  reportNarrativeB3?: string;
  reportNarrativeB4?: string;
  reportIntroExtraHtml?: string;
  reportPageOrientations?: ReportPageOrientations;
};

type ReportAssetImageFilesPage = {
  items: MvDriveFile[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
};

type ReportPicAssetSubProject = MvSubProject & {
  picAsset?: { images?: PicAssetImage[] } | null;
};

function reportRowsFromPicAssetSubProject(
  projectId: string,
  sub: ReportPicAssetSubProject,
): (MvDriveFile & { sourceUrl?: string })[] {
  const images = (sub.picAsset?.images ?? []) as PicAssetImage[];
  return images
    .map((im, idx): (MvDriveFile & { sourceUrl?: string }) | null => {
      const isExternal = typeof (im as { url?: unknown }).url === "string";
      const url = isExternal ? String((im as { url: string }).url) : "";
      const fileId = "fileId" in (im as object) ? String((im as { fileId?: string }).fileId || "") : "";
      const sourceUrl = url || (fileId ? `/api/mv/projects/${projectId}/files/${fileId}/download` : "");
      if (!sourceUrl) return null;
      const includeInReport =
        typeof (im as { includeInReport?: unknown }).includeInReport === "boolean"
          ? (im as { includeInReport: boolean }).includeInReport
          : false;
      const keyPart =
        (im as { _id?: string })._id ||
        (im as { publicId?: string }).publicId ||
        sourceUrl;
      const mimeRaw = (im as { mimeType?: unknown }).mimeType;
      const mime =
        typeof mimeRaw === "string" && mimeRaw.trim().length > 0
          ? mimeRaw.trim()
          : /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(sourceUrl)
            ? "video/mp4"
            : "image/jpeg";
      const isVid = mime.startsWith("video/");
      return {
        _id: `picasset:${sub._id}:${keyPart}:${idx}`,
        projectId,
        name: isVid ? `video-${idx + 1}.mp4` : `image-${idx + 1}.jpg`,
        scope: "asset-images",
        relativePath: `${sub.name}/${isVid ? `video-${idx + 1}.mp4` : `image-${idx + 1}.jpg`}`,
        folderPath: sub.name,
        mimeType: mime,
        sizeBytes: 0,
        uploadedAt: (im as { createdAt?: string }).createdAt || new Date(0).toISOString(),
        updatedAt: (im as { createdAt?: string }).createdAt || new Date(0).toISOString(),
        includeInReport,
        sourceUrl,
      };
    })
    .filter((row): row is MvDriveFile & { sourceUrl?: string } => row != null);
}

function dedupeReportMediaRows(rows: MvDriveFile[]): MvDriveFile[] {
  const seen = new Set<string>();
  const output: MvDriveFile[] = [];
  for (const file of rows) {
    const sourceUrl = (file as MvDriveFile & { sourceUrl?: string }).sourceUrl?.trim() || "";
    const fileIdFromUrl = sourceUrl.match(/\/files\/([^/?#]+)\/download(?:[?#]|$)/i)?.[1];
    const key = sourceUrl
      ? fileIdFromUrl
        ? `file:${decodeURIComponent(fileIdFromUrl)}`
        : `url:${stableReportMediaUrl(sourceUrl)}`
      : `file:${file._id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(file);
  }
  return output;
}

function stableReportMediaUrl(url: string): string {
  const raw = url.trim();
  try {
    const parsed = new URL(raw);
    return `${parsed.origin.toLowerCase()}${parsed.pathname}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

/**
 * يدمج صفوف GridFS مع صفوف صور التطبيق دون إسقاط التحديد.
 * كانت صور التطبيق تُفرض كمصدر وحيد وتُحوَّل القيم الناقصة إلى false فتمسح اختيار GridFS.
 * السياسة: الصورة تظهر في التقرير إذا كانت محدّدة في أي من المصدرين (OR).
 */
function mergeReportAssetMediaRows(
  driveRows: MvDriveFile[],
  picRows: (MvDriveFile & { sourceUrl?: string })[],
): MvDriveFile[] {
  const picIncludeByFileId = new Map<string, boolean>();
  const picIncludeByUrl = new Map<string, boolean>();

  for (const file of picRows) {
    const included = file.includeInReport === true;
    const sourceUrl = file.sourceUrl?.trim() || "";
    const fileIdFromUrl = sourceUrl.match(/\/files\/([^/?#]+)\/download(?:[?#]|$)/i)?.[1];
    if (fileIdFromUrl) {
      const fid = decodeURIComponent(fileIdFromUrl);
      picIncludeByFileId.set(fid, picIncludeByFileId.get(fid) === true || included);
    } else if (sourceUrl) {
      const urlKey = stableReportMediaUrl(sourceUrl);
      picIncludeByUrl.set(urlKey, picIncludeByUrl.get(urlKey) === true || included);
    }
  }

  const resolveMergedInclude = (
    driveIncluded: boolean,
    picFlag: boolean | undefined,
  ): boolean => {
    if (picFlag === undefined) return driveIncluded;
    return driveIncluded || picFlag;
  };

  const adjustedDrive = driveRows.map((file) => {
    if (picIncludeByFileId.has(String(file._id))) {
      return {
        ...file,
        includeInReport: resolveMergedInclude(
          file.includeInReport === true,
          picIncludeByFileId.get(String(file._id)),
        ),
      };
    }
    const driveSource = (file as MvDriveFile & { sourceUrl?: string }).sourceUrl?.trim() || "";
    if (!driveSource) return file;
    const fileIdFromUrl = driveSource.match(/\/files\/([^/?#]+)\/download(?:[?#]|$)/i)?.[1];
    if (fileIdFromUrl) {
      const fid = decodeURIComponent(fileIdFromUrl);
      if (picIncludeByFileId.has(fid)) {
        return {
          ...file,
          includeInReport: resolveMergedInclude(
            file.includeInReport === true,
            picIncludeByFileId.get(fid),
          ),
        };
      }
      return file;
    }
    const urlKey = stableReportMediaUrl(driveSource);
    if (picIncludeByUrl.has(urlKey)) {
      return {
        ...file,
        includeInReport: resolveMergedInclude(
          file.includeInReport === true,
          picIncludeByUrl.get(urlKey),
        ),
      };
    }
    return file;
  });

  const driveFileIds = new Set(adjustedDrive.map((file) => String(file._id)));
  const adjustedPic = picRows.map((file) => {
    const sourceUrl = file.sourceUrl?.trim() || "";
    const fileIdFromUrl = sourceUrl.match(/\/files\/([^/?#]+)\/download(?:[?#]|$)/i)?.[1];
    if (fileIdFromUrl) {
      const fid = decodeURIComponent(fileIdFromUrl);
      const driveMatch = adjustedDrive.find((row) => String(row._id) === fid);
      if (driveMatch) {
        return { ...file, includeInReport: driveMatch.includeInReport === true };
      }
      if (driveFileIds.has(fid)) {
        return file;
      }
    }
    return file;
  });

  return dedupeReportMediaRows([...adjustedDrive, ...adjustedPic]);
}

const defaultReportLayout: ReportLayoutPrefs = {
  marginX: 0,
  marginY: 20,
  sectionGap: 22,
  imageGroupGap: 12,
  imageInnerGap: 4,
  assetImageWidth: 32,
  valuationImageWidth: 86,
  assetImagesPerPage: 9,
  assetImagesPerRow: 3,
  assetImagesUniformSize: true,
  imageCornerRadius: 6,
  paragraphLineHeight: 1.75,
  headingScale: 1,
  imageShadow: 0,
};

const legacyDefaultReportLayout: ReportLayoutPrefs = {
  marginX: 0,
  marginY: 28,
  sectionGap: 28,
  imageGroupGap: 12,
  imageInnerGap: 4,
  assetImageWidth: 32,
  valuationImageWidth: 86,
  assetImagesPerPage: 9,
  assetImagesPerRow: 3,
  assetImagesUniformSize: true,
  imageCornerRadius: 0,
  paragraphLineHeight: 1.75,
  headingScale: 1,
  imageShadow: 0,
};

function readLayoutFromBundle(bundle: ValuationReportSessionBundle | null | undefined): ReportLayoutPrefs {
  const raw = bundle?.reportLayout;
  if (!raw || typeof raw !== "object") return { ...defaultReportLayout };
  const o = raw as Record<string, unknown>;
  const n = (k: keyof ReportLayoutPrefs, fallback: number) => {
    const v = o[k as string];
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  };
  const layout = {
    marginX: n("marginX", defaultReportLayout.marginX),
    marginY: n("marginY", defaultReportLayout.marginY),
    sectionGap: n("sectionGap", defaultReportLayout.sectionGap),
    imageGroupGap: n("imageGroupGap", defaultReportLayout.imageGroupGap),
    imageInnerGap: n("imageInnerGap", defaultReportLayout.imageInnerGap),
    assetImageWidth: n("assetImageWidth", defaultReportLayout.assetImageWidth),
    valuationImageWidth: n("valuationImageWidth", defaultReportLayout.valuationImageWidth),
    assetImagesPerPage: n("assetImagesPerPage", defaultReportLayout.assetImagesPerPage),
    assetImagesPerRow: n("assetImagesPerRow", defaultReportLayout.assetImagesPerRow),
    assetImagesUniformSize:
      typeof o.assetImagesUniformSize === "boolean" ? o.assetImagesUniformSize : defaultReportLayout.assetImagesUniformSize,
    imageCornerRadius: n("imageCornerRadius", defaultReportLayout.imageCornerRadius),
    paragraphLineHeight: n("paragraphLineHeight", defaultReportLayout.paragraphLineHeight),
    headingScale: n("headingScale", defaultReportLayout.headingScale),
    imageShadow: n("imageShadow", defaultReportLayout.imageShadow),
  };
  const isLegacyDefault = (Object.keys(legacyDefaultReportLayout) as (keyof ReportLayoutPrefs)[]).every(
    (key) => layout[key] === legacyDefaultReportLayout[key],
  );
  return isLegacyDefault ? { ...defaultReportLayout } : layout;
}

export default function MvValuationReportWorkspace({ projectId }: MvValuationReportWorkspaceProps) {
  const { t, dir } = useMvI18n();
  const { navigate } = useMvInPageNavigation();
  const { toast } = useToast();
  const { user, profile } = useAuthTracking();
  const sessionKey = MV_WORKFLOW_SESSION.valuationReportWorkspace(projectId);
  const initialBundle = readMvWorkflowSessionJson<ValuationReportSessionBundle>(sessionKey);
  const initialProjectSummary = readMvWorkflowSessionJson<{
    project?: MvProject | null;
    subProjects?: MvSubProject[];
    fetchedAt?: number;
  }>(MV_WORKFLOW_SESSION.projectSummary(projectId));
  const initialAssetImageFiles = readMvWorkflowSessionJson<{ rows?: MvDriveFile[] }>(
    MV_WORKFLOW_SESSION.assetImageFiles(projectId),
  );
  const initialProject = withDraftDefaultProject(initialBundle?.project ?? initialProjectSummary?.project ?? null);
  const initialFiles =
    initialBundle?.files ??
    (Array.isArray(initialAssetImageFiles?.rows) ? initialAssetImageFiles.rows : []);
  const initialLayout = readLayoutFromBundle(initialBundle ?? undefined);
  const [project, setProject] = useState<MvProject | null>(() => initialProject);
  const projectRef = useRef<MvProject | null>(project);
  const reportDataPersistTimerRef = useRef<number | null>(null);
  const reportDataPersistRequestRef = useRef(0);
  const beforeWordMergeRef = useRef<() => Promise<void>>(async () => undefined);
  const draftModeOverrideRef = useRef<boolean | null>(null);
  const [files, setFiles] = useState<MvDriveFile[]>(() => initialFiles);
  const [loading, setLoading] = useState(() => initialProject == null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reportMediaLoading, setReportMediaLoading] = useState(false);
  const [valuationAccountStore, setValuationAccountStore] =
    useState<MvValuationAccountingStore>(() => emptyValuationAccountingStore());
  const [clientDocumentsStore, setClientDocumentsStore] =
    useState<MvClientDocumentsStore>(() => readClientDocumentsStore(projectId));
  const [companySignatories, setCompanySignatories] = useState<MvReportPreparerOption[]>([]);
  const [companyAdminMembershipNo, setCompanyAdminMembershipNo] = useState<string | null>(null);
  const [companyBrand, setCompanyBrand] = useState<{ name: string; logoSrc: string | null }>({
    name: "",
    logoSrc: null,
  });
  /**
   * Templates pulled from the company-admin tab. They feed narrative paragraphs
   * in the report preview as fallback text when the per-project field is empty.
   */
  const [companyReportDefaults, setCompanyReportDefaults] = useState<{
    scope: Record<string, string>;
    methodology: Record<string, string>;
    assumptions: Record<string, string>;
  }>({
    scope: {},
    methodology: {},
    assumptions: {},
  });
  const [companyDefaultSections, setCompanyDefaultSections] = useState<MvCompanyReportCustomSection[]>([]);
  const [letterheadTemplate, setLetterheadTemplate] = useState<MvCompanyReportLetterheadTemplate | null>(null);
  const [companyAiTemplates, setCompanyAiTemplates] = useState<MvCompanyAiTemplate[]>([]);
  const [preparerFieldEdits] = useState<PreparerFieldEdits>(() =>
    migratePreparerFieldEdits(initialBundle),
  );
  const [editableSections, setEditableSections] = useState<MvReportEditableSection[]>(() =>
    normalizeEditableSections(initialBundle?.project?.reportData?.reportEditableSections ?? initialBundle?.editableSections),
  );
  const [narrativeB1, setNarrativeB1] = useState(
    () => initialBundle?.project?.reportData?.reportNarrativeB1 ?? initialBundle?.reportNarrativeB1 ?? MV_DEFAULT_NARRATIVE_B1,
  );
  const [narrativeB2, setNarrativeB2] = useState(
    () => initialBundle?.project?.reportData?.reportNarrativeB2 ?? initialBundle?.reportNarrativeB2 ?? MV_DEFAULT_NARRATIVE_B2,
  );
  const [narrativeB3, setNarrativeB3] = useState(
    () => initialBundle?.project?.reportData?.reportNarrativeB3 ?? initialBundle?.reportNarrativeB3 ?? MV_DEFAULT_NARRATIVE_B3,
  );
  const [narrativeB4, setNarrativeB4] = useState(
    () => initialBundle?.project?.reportData?.reportNarrativeB4 ?? initialBundle?.reportNarrativeB4 ?? MV_DEFAULT_NARRATIVE_B4,
  );
  const [introExtraHtml, setIntroExtraHtml] = useState(
    () =>
      typeof initialBundle?.project?.reportData?.reportIntroExtraHtml === "string"
        ? initialBundle.project.reportData.reportIntroExtraHtml
        : typeof initialBundle?.reportIntroExtraHtml === "string"
          ? initialBundle.reportIntroExtraHtml
          : "",
  );
  const [tocApproxPages, setTocApproxPages] = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState<ReportSectionId>("report-cover");
  const [marginX, setMarginX] = useState(initialLayout.marginX);
  const [marginY, setMarginY] = useState(initialLayout.marginY);
  const [sectionGap, setSectionGap] = useState(initialLayout.sectionGap);
  const [imageGroupGap, setImageGroupGap] = useState(initialLayout.imageGroupGap);
  const [imageInnerGap, setImageInnerGap] = useState(initialLayout.imageInnerGap);
  const [assetImageWidth, setAssetImageWidth] = useState(initialLayout.assetImageWidth);
  const [valuationImageWidth, setValuationImageWidth] = useState(initialLayout.valuationImageWidth);
  const [assetImagesPerPage, setAssetImagesPerPage] = useState(initialLayout.assetImagesPerPage);
  const [assetImagesPerRow, setAssetImagesPerRow] = useState(initialLayout.assetImagesPerRow);
  const [assetImagesUniformSize, setAssetImagesUniformSize] = useState(initialLayout.assetImagesUniformSize);
  const [imageCornerRadius, setImageCornerRadius] = useState(initialLayout.imageCornerRadius);
  const [paragraphLineHeight, setParagraphLineHeight] = useState(initialLayout.paragraphLineHeight);
  const [headingScale, setHeadingScale] = useState(initialLayout.headingScale);
  const [imageShadow, setImageShadow] = useState(initialLayout.imageShadow);
  const [imageOrder, setImageOrder] = useState<string[]>([]);
  const [valuationImageOrder, setValuationImageOrder] = useState<string[]>([]);
  const [reportPageOrientations, setReportPageOrientations] = useState<ReportPageOrientations>(() =>
    normalizeReportPageOrientations(
      initialBundle?.project?.reportData?.reportPageOrientations ?? initialBundle?.reportPageOrientations,
    ),
  );
  const [hiddenImageIds, setHiddenImageIds] = useState<Set<string>>(() => new Set());
  const [pdfExportProgress, setPdfExportProgress] = useState<number | null>(null);
  const [pdfExportLabel, setPdfExportLabel] = useState("");
  const autoPdfTriggeredRef = useRef(false);
  const reportSectionsScrollRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const assetImagesPreviewScrollRef = useRef<HTMLDivElement>(null);
  const reportPdfRef = useRef<HTMLElement | null>(null);
  const previewReportRef = useRef<HTMLElement | null>(null);
  const assetImagesPreviewReportRef = useRef<HTMLElement | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingPptx, setDownloadingPptx] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [downloadingDocxTemplate, setDownloadingDocxTemplate] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [assetImagesPreviewOpen, setAssetImagesPreviewOpen] = useState(false);
  const [reportImageCacheVersion, setReportImageCacheVersion] = useState(0);
  const reportImageWarmKeyRef = useRef("");
  const loadRunRef = useRef(0);
  const loadAbortRef = useRef<AbortController | null>(null);
  const [reportSaving, setReportSaving] = useState(false);
  /** Toggles the right-side floating settings drawer (page metrics + images). */
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [settingsDrawerTab, setSettingsDrawerTab] = useState<"templates" | "layout" | "images">("templates");
  const [wordTemplateModalOpen, setWordTemplateModalOpen] = useState(false);
  const [settingsImagesTab, setSettingsImagesTab] = useState<"assets" | "valuation">("assets");
  const [pendingReportTemplateId, setPendingReportTemplateId] = useState(() =>
    normalizeReportTemplateId(initialProject?.reportData?.reportTemplateId, getMvT()),
  );
  const [reportTemplatePreviewId, setReportTemplatePreviewId] = useState<string | null>(null);
  const [desktopReportChrome, setDesktopReportChrome] = useState(false);
  /** Persists user preference for the navigation sidebar collapsed/expanded state. */
  const [navCollapsed, setNavCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("mv-report-nav-collapsed") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("mv-report-nav-collapsed", navCollapsed ? "1" : "0");
    } catch {
      // Ignore storage errors (private mode, quota, etc.).
    }
  }, [navCollapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 1024px)");
    const sync = () => setDesktopReportChrome(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const resetLayoutToDefaults = useCallback(() => {
    const d = defaultReportLayout;
    setMarginX(d.marginX);
    setMarginY(d.marginY);
    setSectionGap(d.sectionGap);
    setImageGroupGap(d.imageGroupGap);
    setImageInnerGap(d.imageInnerGap);
    setAssetImageWidth(d.assetImageWidth);
    setValuationImageWidth(d.valuationImageWidth);
    setAssetImagesPerPage(d.assetImagesPerPage);
    setAssetImagesPerRow(d.assetImagesPerRow);
    setAssetImagesUniformSize(d.assetImagesUniformSize);
    setImageCornerRadius(d.imageCornerRadius);
    setParagraphLineHeight(d.paragraphLineHeight);
    setHeadingScale(d.headingScale);
    setImageShadow(d.imageShadow);
  }, []);

  const load = useCallback(async () => {
    const runId = ++loadRunRef.current;
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const reportSessionProject = readMvWorkflowSessionJson<ValuationReportSessionBundle>(
      MV_WORKFLOW_SESSION.valuationReportWorkspace(projectId),
    )?.project;
    const summarySessionProject = readMvWorkflowSessionJson<{ project?: MvProject | null }>(
      MV_WORKFLOW_SESSION.projectSummary(projectId),
    )?.project;
    const hasFastProject = reportSessionProject != null || summarySessionProject != null || projectRef.current != null;
    if (!hasFastProject) setLoading(true);
    setLoadError(null);
    try {
      const projectSummaryUrl = `/api/mv/projects/${projectId}?picAssetMode=summary`;
      const projectRequest = mvFetchJson<{ project?: MvProject; subProjects?: MvSubProject[] }>(
        projectSummaryUrl,
        { signal: controller.signal },
        {
          cacheKey: `project-summary:${projectId}`,
          cacheTtlMs: 90_000,
          loadingLabel: t("report.loadingLabel"),
        },
      );

      const projectPayload = await projectRequest;
      if (runId !== loadRunRef.current) return;

      const fetchedProject = withDraftDefaultProject(projectPayload?.project ?? null);
      const previewSubs = Array.isArray(projectPayload?.subProjects) ? projectPayload.subProjects : [];
      const quickProject =
        fetchedProject
          ? {
              ...fetchedProject,
              reportData: {
                ...(fetchedProject.reportData ?? {}),
                ...(draftModeOverrideRef.current === null
                  ? {}
                  : { reportPresentationDraft: draftModeOverrideRef.current }),
              },
            }
          : null;

      const cachedReportBundle = readMvWorkflowSessionJson<ValuationReportSessionBundle>(sessionKey);
      const cachedAssetRows = readMvWorkflowSessionJson<{ rows?: MvDriveFile[] }>(
        MV_WORKFLOW_SESSION.assetImageFiles(projectId),
      );
      const cachedFiles =
        cachedReportBundle?.files ??
        (Array.isArray(cachedAssetRows?.rows) ? cachedAssetRows.rows : []);
      const mergeWithCachedMedia = (incoming: MvDriveFile[]) => {
        const seen = new Set(incoming.map((file) => file._id));
        return dedupeReportMediaRows([
          ...incoming,
          ...cachedFiles.filter((file) => !seen.has(file._id)),
        ]);
      };
      setProject((prev) => {
        const nextP = quickProject ?? prev;
        const prevBundle = readMvWorkflowSessionJson<ValuationReportSessionBundle>(sessionKey) ?? {};
        writeMvWorkflowSessionJson(sessionKey, {
          ...prevBundle,
          project: nextP,
          files: cachedFiles,
          fetchedAt: Date.now(),
        });
        if (nextP) {
          writeMvWorkflowSessionJson(MV_WORKFLOW_SESSION.projectSummary(projectId), {
            project: nextP,
            subProjects: previewSubs,
            fetchedAt: Date.now(),
          });
        }
        return nextP;
      });
      setLoading(false);
      setReportMediaLoading(true);

      let driveRows: MvDriveFile[] = [];
      let picRows: (MvDriveFile & { sourceUrl?: string })[] = [];
      const publishPartialMedia = () => {
        if (runId !== loadRunRef.current) return;
        const next = mergeWithCachedMedia(mergeReportAssetMediaRows(driveRows, picRows));
        startTransition(() => setFiles(next));
      };

      const loadDriveRowsProgressively = async () => {
        const seenIds = new Set<string>();
        const seenCursors = new Set<string>();
        let cursor = "0";
        let firstPage = true;
        let completed = false;
        while (!seenCursors.has(cursor)) {
          seenCursors.add(cursor);
          const limit = firstPage ? 100 : 250;
          const query = new URLSearchParams({ cursor, limit: String(limit) });
          const payload = await mvFetchJson<ReportAssetImageFilesPage | MvDriveFile[]>(
            `/api/mv/projects/${encodeURIComponent(projectId)}/asset-image-files?${query.toString()}`,
            { signal: controller.signal },
            {
              cacheKey: `asset-image-files-page:${projectId}:${cursor}:${limit}`,
              cacheTtlMs: 2_000,
              retries: 1,
              retryBaseMs: 650,
              timeoutMs: firstPage ? 12_000 : 18_000,
              trackLoading: false,
            },
          );
          if (runId !== loadRunRef.current) return;
          const page: ReportAssetImageFilesPage = Array.isArray(payload)
            ? { items: payload, nextCursor: null, hasMore: false, total: payload.length }
            : {
                items: Array.isArray(payload.items) ? payload.items : [],
                nextCursor: typeof payload.nextCursor === "string" ? payload.nextCursor : null,
                hasMore: payload.hasMore === true,
                total: Number.isFinite(payload.total) ? payload.total : 0,
              };
          for (const row of page.items) {
            if (!row?._id || seenIds.has(row._id)) continue;
            seenIds.add(row._id);
            driveRows.push(row);
          }
          publishPartialMedia();
          firstPage = false;
          if (!page.hasMore || !page.nextCursor) {
            completed = true;
            break;
          }
          cursor = page.nextCursor;
          await new Promise<void>((resolve) => window.setTimeout(resolve, 35));
        }
        if (!completed) throw new Error("report_asset_image_pagination_incomplete");
      };

      const loadPicRowsProgressively = async () => {
        const photoSubs = previewSubs.filter((sub) => Boolean(sub.picAsset?._id));
        for (let offset = 0; offset < photoSubs.length; offset += 40) {
          const ids = photoSubs.slice(offset, offset + 40).map((sub) => sub._id);
          const query = new URLSearchParams({ ids: ids.join(",") });
          const payload = await mvFetchJson<{ items?: ReportPicAssetSubProject[] }>(
            `/api/mv/projects/${encodeURIComponent(projectId)}/subproject-details?${query.toString()}`,
            { signal: controller.signal },
            {
              retries: 1,
              retryBaseMs: 700,
              timeoutMs: 18_000,
              trackLoading: false,
            },
          );
          if (runId !== loadRunRef.current) return;
          const rows = Array.isArray(payload.items) ? payload.items : [];
          picRows = [...picRows, ...rows.flatMap((sub) => reportRowsFromPicAssetSubProject(projectId, sub))];
          publishPartialMedia();
          if (offset + 40 < photoSubs.length) {
            await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
          }
        }
      };

      const mediaResults = await Promise.allSettled([
        loadDriveRowsProgressively(),
        loadPicRowsProgressively(),
      ]);

      if (runId !== loadRunRef.current) return;
      setReportMediaLoading(false);
      const streamedMedia = mergeReportAssetMediaRows(driveRows, picRows);
      const mediaComplete = mediaResults.every((result) => result.status === "fulfilled");
      const merged = mediaComplete ? streamedMedia : mergeWithCachedMedia(streamedMedia);
      setFiles(merged);
      // Eagerly warm the image cache for the merged set so the preview renders
      // with real images immediately instead of swapping in after the warm
      // timer fires.
      const eagerSources = merged
        .map((f) => {
          const fileWithSource = f as MvDriveFile & { sourceUrl?: string };
          return (
            fileWithSource.sourceUrl ||
            `/api/mv/projects/${projectId}/files/${encodeURIComponent(String(fileWithSource._id))}/download`
          );
        })
        .filter((src): src is string => Boolean(src));
      const warmSources = eagerSources.slice(0, REPORT_PREVIEW_WARM_IMAGE_LIMIT);
      if (warmSources.length > 0) {
        void preloadReportImageCache(warmSources).then(() => {
          if (runId === loadRunRef.current) setReportImageCacheVersion((v) => v + 1);
        });
      }
      setProject((prev) => {
        const nextP =
          fetchedProject
            ? {
                ...fetchedProject,
                reportData: {
                  ...(fetchedProject.reportData ?? {}),
                  ...(draftModeOverrideRef.current === null
                    ? {}
                    : { reportPresentationDraft: draftModeOverrideRef.current }),
                },
              }
            : prev;
        const prevBundle = readMvWorkflowSessionJson<ValuationReportSessionBundle>(sessionKey) ?? {};
        writeMvWorkflowSessionJson(sessionKey, {
          ...prevBundle,
          project: nextP,
          // دفعة تمهيدية للجلسة فقط؛ بقية الصور تُستعاد تدريجيًا دون تجميد التخزين المتزامن.
          files: merged.slice(0, 500),
          fetchedAt: Date.now(),
        });
        if (nextP) {
          writeMvWorkflowSessionJson(MV_WORKFLOW_SESSION.projectSummary(projectId), {
            project: nextP,
            subProjects: previewSubs,
            fetchedAt: Date.now(),
          });
        }
        return nextP;
      });
    } catch (error) {
      if (runId === loadRunRef.current) {
        setLoadError(mvErrorMessage(error, t("report.loadFailed")));
      }
    } finally {
      if (runId === loadRunRef.current) {
        setLoading(false);
        setReportMediaLoading(false);
        if (loadAbortRef.current === controller) loadAbortRef.current = null;
      }
    }
  }, [projectId, sessionKey]);

  useEffect(() => {
    void load();
    return () => {
      loadRunRef.current += 1;
      loadAbortRef.current?.abort();
      loadAbortRef.current = null;
    };
  }, [load, projectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void import("jspdf");
      void import("html2canvas");
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [projectId]);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const reportTemplateOptions = useMemo<MvReportTemplateOption[]>(
    () => [
      ...REPORT_TEMPLATE_OPTIONS(t),
      ...companyAiTemplates.map((template) => ({
        id: `${AI_REPORT_TEMPLATE_ID_PREFIX}${template.id}`,
        title: template.name,
        description:
          template.analysisSummary ||
          template.sourceFileName ||
          t("report.templates.aiFallback"),
        badge: "AI",
        outputFormat: "pdf" as const,
        accentClass: "from-violet-700 via-sky-600 to-emerald-500",
        previewKind: "ai" as const,
        usesAiTemplate: true,
        aiTemplate: template,
      })),
    ],
    [companyAiTemplates, t],
  );

  useEffect(() => {
    setPendingReportTemplateId(normalizeReportTemplateIdFrom(reportTemplateOptions, project?.reportData?.reportTemplateId));
  }, [project?._id, project?.reportData?.reportTemplateId, reportTemplateOptions]);

  useEffect(() => {
    const rd = project?.reportData;
    if (!rd) return;
    if (Array.isArray(rd.reportEditableSections)) {
      setEditableSections(normalizeEditableSections(rd.reportEditableSections));
    }
    if (typeof rd.reportNarrativeB1 === "string") setNarrativeB1(rd.reportNarrativeB1);
    if (typeof rd.reportNarrativeB2 === "string") setNarrativeB2(rd.reportNarrativeB2);
    if (typeof rd.reportNarrativeB3 === "string") setNarrativeB3(rd.reportNarrativeB3);
    if (typeof rd.reportNarrativeB4 === "string") setNarrativeB4(rd.reportNarrativeB4);
    if (typeof rd.reportIntroExtraHtml === "string") setIntroExtraHtml(rd.reportIntroExtraHtml);
    if (rd.reportPageOrientations && typeof rd.reportPageOrientations === "object") {
      setReportPageOrientations(normalizeReportPageOrientations(rd.reportPageOrientations));
    }
  }, [loading, project?._id]);

  /**
   * Kick off the company-defaults request immediately on mount — it does not
   * depend on the project payload and running it in parallel with the main
   * `load()` shaves a round-trip off the initial render time.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/company/report-defaults", { credentials: "include" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          companyName?: string;
          logoDataUrl?: string | null;
          companyAdminMembershipNo?: string | null;
          companyAdminName?: string | null;
          reportSignatoryRows?: Array<{
            id?: string;
            name?: string;
            jobTitle?: string;
            roleLabel?: string;
            membershipNo?: string;
            signatureImageDataUrl?: string;
            memberRole?: string;
            isCompanyAdmin?: boolean;
          }>;
          reportDefaults?: {
            scope?: Record<string, string | undefined>;
            methodology?: Record<string, string | undefined>;
            assumptions?: Record<string, string | undefined>;
            customSections?: Array<{
              id?: string;
              sectionNumber?: string;
              title?: string;
              body?: string;
            }>;
            letterhead?: MvCompanyReportLetterheadTemplate | null;
            aiTemplates?: unknown[];
          } | null;
        };
        setCompanyBrand({
          name: typeof data.companyName === "string" ? data.companyName.trim() : "",
          logoSrc: resolveMvCompanyLogo(data.logoDataUrl),
        });
        setCompanyAdminMembershipNo(
          typeof data.companyAdminMembershipNo === "string" && data.companyAdminMembershipNo.trim()
            ? data.companyAdminMembershipNo.trim()
            : null,
        );
        const rows = Array.isArray(data.reportSignatoryRows) ? data.reportSignatoryRows : [];
        setCompanySignatories(normalizeReportPreparerOptions(rows));
        const pickStrings = (
          source: Record<string, string | undefined> | undefined,
        ): Record<string, string> => {
          if (!source || typeof source !== "object") return {};
          const out: Record<string, string> = {};
          for (const [key, value] of Object.entries(source)) {
            if (typeof value === "string" && value.trim()) out[key] = value;
          }
          return out;
        };
        setCompanyReportDefaults({
          scope: pickStrings(data.reportDefaults?.scope),
          methodology: pickStrings(data.reportDefaults?.methodology),
          assumptions: pickStrings(data.reportDefaults?.assumptions),
        });
        const customSections = Array.isArray(data.reportDefaults?.customSections)
          ? data.reportDefaults.customSections
              .map((section, index) => ({
                id: typeof section.id === "string" && section.id ? section.id : `company-section-${index + 1}`,
                sectionNumber: typeof section.sectionNumber === "string" ? section.sectionNumber : "",
                title: typeof section.title === "string" ? section.title : "",
                body: typeof section.body === "string" ? section.body : "",
              }))
              .filter((section) => section.title.trim() || section.body.trim())
          : [];
        setCompanyDefaultSections(customSections);
        const rawLetterhead = data.reportDefaults?.letterhead;
        const image = (value: unknown): string | null => {
          if (typeof value !== "string") return null;
          const trimmed = value.trim();
          return trimmed.startsWith("data:image/") || trimmed.startsWith("/uploads/company-report-templates/")
            ? trimmed
            : null;
        };
        setLetterheadTemplate(
          rawLetterhead
            ? {
                enabled: rawLetterhead.enabled === true,
                templateId: typeof rawLetterhead.templateId === "string" ? rawLetterhead.templateId : null,
                outputFormat: rawLetterhead.outputFormat === "pptx" ? "pptx" : "pdf",
                coverImageDataUrl: image(rawLetterhead.coverImageDataUrl),
                pageImageDataUrl: image(rawLetterhead.pageImageDataUrl),
                landscapePageImageDataUrl: image(rawLetterhead.landscapePageImageDataUrl),
                logoDataUrl: image(rawLetterhead.logoDataUrl),
                footerImageDataUrl: image(rawLetterhead.footerImageDataUrl),
                signatureStampDataUrl: image(rawLetterhead.signatureStampDataUrl),
              }
            : null,
        );
        setCompanyAiTemplates(normalizeCompanyAiTemplatesForReport(data.reportDefaults?.aiTemplates, t));
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [t]);

  const serverAccountingKey = useMemo(
    () => JSON.stringify(project?.valuationAccountingWorkspace ?? null),
    [project?.valuationAccountingWorkspace],
  );
  const serverClientDocsKey = useMemo(
    () => JSON.stringify(project?.clientDocumentsWorkspace ?? null),
    [project?.clientDocumentsWorkspace],
  );

  useEffect(() => {
    if (!project) return;
    const local = readValuationAccountingStore(projectId);
    const merged = mergeValuationAccountingStores(project.valuationAccountingWorkspace, local);
    setValuationAccountStore((prev) =>
      JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged,
    );
    writeValuationAccountingStore(projectId, merged);
  }, [project, projectId, serverAccountingKey]);

  useEffect(() => {
    if (!project) return;
    const local = readClientDocumentsStore(projectId);
    const merged = mergeClientDocumentsStores(project.clientDocumentsWorkspace, local);
    setClientDocumentsStore((prev) =>
      JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged,
    );
    writeClientDocumentsStore(projectId, merged);
  }, [project, projectId, serverClientDocsKey]);

  useEffect(() => {
    if (typeof window === "undefined" || loading) return;
    const prev = readMvWorkflowSessionJson<ValuationReportSessionBundle>(sessionKey) ?? {};
    writeMvWorkflowSessionJson(sessionKey, {
      ...prev,
      project,
      files,
      fetchedAt: Date.now(),
      preparerFieldEdits,
      editableSections,
      reportNarrativeB1: narrativeB1,
      reportNarrativeB2: narrativeB2,
      reportNarrativeB3: narrativeB3,
      reportNarrativeB4: narrativeB4,
      reportIntroExtraHtml: introExtraHtml,
      reportPageOrientations,
      reportLayout: {
        marginX,
        marginY,
        sectionGap,
        imageGroupGap,
        imageInnerGap,
        assetImageWidth,
        valuationImageWidth,
        assetImagesPerPage,
        assetImagesPerRow,
        assetImagesUniformSize,
        imageCornerRadius,
        paragraphLineHeight,
        headingScale,
        imageShadow,
      },
    });
  }, [
    project,
    files,
    preparerFieldEdits,
    editableSections,
    narrativeB1,
    narrativeB2,
    narrativeB3,
    narrativeB4,
    introExtraHtml,
    reportPageOrientations,
    loading,
    sessionKey,
    marginX,
    marginY,
    sectionGap,
    imageGroupGap,
    imageInnerGap,
    assetImageWidth,
    valuationImageWidth,
    assetImagesPerPage,
    assetImagesPerRow,
    assetImagesUniformSize,
    imageCornerRadius,
    paragraphLineHeight,
    headingScale,
    imageShadow,
  ]);

  const openReportPreview = useCallback(() => {
    if (loading || reportMediaLoading) return;
    setPreviewOpen(true);
  }, [loading, reportMediaLoading]);

  const downloadAsPdf = useCallback(async () => {
    if (loading || reportMediaLoading) return;
    const hostedInIframe = typeof window !== "undefined" && window.parent !== window.self;
    setDownloadingPdf(true);
    setPdfExportProgress(3);
    setPdfExportLabel(t("report.export.preparing"));
    let restoreCaptureLayout: (() => void) | null = null;
    const scrollEl = reportSectionsScrollRef.current;
    const prevTop = scrollEl?.scrollTop ?? 0;
    const prevLeft = scrollEl?.scrollLeft ?? 0;
    let exportOk = false;
    try {
      const root = reportPdfRef.current;
      if (!root) return;
      if (scrollEl) {
        scrollEl.scrollTop = 0;
        scrollEl.scrollLeft = 0;
      }

      setPdfExportProgress(12);
      setPdfExportLabel(t("report.export.loadingImages"));
      restoreCaptureLayout = await prepareReportDocumentForCapture(root);

      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const sheets = Array.from(root.querySelectorAll<HTMLElement>("[data-mv-report-sheet]"));
      if (sheets.length === 0) return;

      let pdf: import("jspdf").jsPDF | null = null;

      for (let i = 0; i < sheets.length; i++) {
        setPdfExportLabel(t("report.export.exportingPage", { current: i + 1, total: sheets.length }));
        setPdfExportProgress(15 + Math.round(((i + 0.35) / sheets.length) * 80));
        const el = sheets[i]!;
        const landscape = el.dataset.mvReportOrientation === "landscape";
        const { orientation, pdfW, pdfH } = reportPdfPageMetrics(landscape);
        const { w, h } = getSheetPixelBox(el);
        const sliceHeightCss = resolveReportPdfSliceCssHeight(w, h, landscape);
        const sliceCount = Math.max(1, Math.ceil(h / sliceHeightCss));
        const scale = resolveReportPdfCaptureScale(w, sliceHeightCss, landscape);

        for (let sliceIndex = 0; sliceIndex < sliceCount; sliceIndex += 1) {
          if (sliceCount > 1) {
            setPdfExportLabel(t("report.export.exportingSlice", { page: i + 1, slice: sliceIndex + 1, total: sheets.length }));
          }
          const canvas = await html2canvas(el, {
            scale,
            useCORS: true,
            allowTaint: false,
            logging: false,
            backgroundColor: "#ffffff",
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: sliceIndex * sliceHeightCss,
            width: w,
            height: sliceHeightCss,
            windowWidth: w,
            windowHeight: sliceHeightCss,
            imageTimeout: 12000,
            removeContainer: true,
            ignoreElements: (node) => (node as HTMLElement).classList?.contains("mv-report-chrome") ?? false,
            onclone: applyMvReportCaptureClone,
          });
          try {
            const imgData = await canvasToReportJpegBytes(canvas);
            if (!pdf) {
              pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
            } else {
              pdf.addPage("a4", orientation);
            }
            pdf.addImage(imgData, "JPEG", 0, 0, pdfW, pdfH, `mv-report-${i + 1}-${sliceIndex + 1}`, "FAST");
          } finally {
            canvas.width = 1;
            canvas.height = 1;
          }
        }
      }

      if (pdf) {
        setPdfExportProgress(98);
        setPdfExportLabel(t("report.export.savingPdf"));
        const safeName = (project?.name || "report").replace(/[\\/:*?"<>|]+/g, "-");
        pdf.save(`${safeName}-valuation-report.pdf`);
        setPdfExportProgress(100);
        exportOk = true;
        if (!hostedInIframe) {
          toast({ description: t("report.export.downloadedPdf") });
        }
      }
    } catch (error) {
      if (!hostedInIframe) {
        toast({
          variant: "destructive",
          description: mvExportToastDescription(error, "report.export.pdfFailed", t),
        });
      }
    } finally {
      restoreCaptureLayout?.();
      if (scrollEl) {
        scrollEl.scrollTop = prevTop;
        scrollEl.scrollLeft = prevLeft;
      }
      setDownloadingPdf(false);
      setPdfExportProgress(null);
      setPdfExportLabel("");
      if (hostedInIframe) {
        postReportPdfExportToParent(projectId, exportOk);
      }
    }
  }, [loading, project?.name, projectId, reportMediaLoading, t, toast]);

  const downloadAsPptx = useCallback(async () => {
    if (loading || reportMediaLoading) return;
    setDownloadingPptx(true);
    setPdfExportProgress(3);
    setPdfExportLabel(t("report.export.preparingPpt"));
    let restoreCaptureLayout: (() => void) | null = null;
    const scrollEl = reportSectionsScrollRef.current;
    const prevTop = scrollEl?.scrollTop ?? 0;
    const prevLeft = scrollEl?.scrollLeft ?? 0;

    try {
      const root = reportPdfRef.current;
      if (!root) return;
      if (scrollEl) {
        scrollEl.scrollTop = 0;
        scrollEl.scrollLeft = 0;
      }

      setPdfExportProgress(12);
      setPdfExportLabel(t("report.export.loadingImages"));
      restoreCaptureLayout = await prepareReportDocumentForCapture(root);

      const { default: html2canvas } = await import("html2canvas");
      const sheets = Array.from(root.querySelectorAll<HTMLElement>("[data-mv-report-sheet]"));
      if (sheets.length === 0) return;
      const slides: PptxImageSlide[] = [];
      let slideCounter = 0;

      for (let i = 0; i < sheets.length; i += 1) {
        const el = sheets[i]!;
        const landscape = el.dataset.mvReportOrientation === "landscape";
        const { w, h } = getSheetPixelBox(el);
        const sliceHeightCss = resolveReportPdfSliceCssHeight(w, h, landscape);
        const sliceCount = Math.max(1, Math.ceil(h / sliceHeightCss));
        const scale = resolveReportPdfCaptureScale(w, sliceHeightCss, landscape);

        for (let sliceIndex = 0; sliceIndex < sliceCount; sliceIndex += 1) {
          slideCounter += 1;
          setPdfExportLabel(
            sliceCount > 1
              ? t("report.export.convertingSlice", { page: i + 1, slice: sliceIndex + 1 })
              : t("report.export.convertingSlide", { current: i + 1, total: sheets.length }),
          );
          setPdfExportProgress(15 + Math.round(((slideCounter - 0.4) / Math.max(sheets.length, slideCounter)) * 78));

          const canvas = await html2canvas(el, {
            scale,
            useCORS: true,
            allowTaint: false,
            logging: false,
            backgroundColor: "#ffffff",
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: sliceIndex * sliceHeightCss,
            width: w,
            height: sliceHeightCss,
            windowWidth: w,
            windowHeight: sliceHeightCss,
            imageTimeout: 30000,
            removeContainer: true,
            ignoreElements: (node) => (node as HTMLElement).classList?.contains("mv-report-chrome") ?? false,
            onclone: applyMvReportCaptureClone,
          });
          slides.push({
            dataUrl: canvas.toDataURL("image/png", 1),
            width: canvas.width,
            height: canvas.height,
            title: sliceCount > 1
              ? t("report.export.pageSliceTitle", { page: i + 1, slice: sliceIndex + 1 })
              : t("report.export.pageTitle", { n: i + 1 }),
            landscape,
          });
          canvas.width = 1;
          canvas.height = 1;
        }
      }

      setPdfExportProgress(98);
      setPdfExportLabel(t("report.export.savingPpt"));
      const safeName = (project?.name || "report").replace(/[\\/:*?"<>|]+/g, "-");
      downloadPptxFromPngSlides(slides, `${safeName}-valuation-report.pptx`, `${project?.name || "Valuation Report"} PowerPoint`);
      setPdfExportProgress(100);
      toast({ description: t("report.export.downloadedPpt") });
    } catch (error) {
      toast({
        variant: "destructive",
        description: mvExportToastDescription(error, "report.export.pptFailed", t),
      });
    } finally {
      restoreCaptureLayout?.();
      if (scrollEl) {
        scrollEl.scrollTop = prevTop;
        scrollEl.scrollLeft = prevLeft;
      }
      setDownloadingPptx(false);
      setPdfExportProgress(null);
      setPdfExportLabel("");
    }
  }, [loading, project?.name, reportMediaLoading, t, toast]);

  const downloadAsDocx = useCallback(async () => {
    if (loading || reportMediaLoading) return;
    setDownloadingDocx(true);
    setPdfExportProgress(3);
    setPdfExportLabel(t("report.export.preparingWord"));
    const scrollEl = reportSectionsScrollRef.current;
    const prevTop = scrollEl?.scrollTop ?? 0;
    const prevLeft = scrollEl?.scrollLeft ?? 0;

    try {
      const root = reportPdfRef.current;
      if (!root) return;
      if (scrollEl) {
        scrollEl.scrollTop = 0;
        scrollEl.scrollLeft = 0;
      }

      setPdfExportProgress(12);
      setPdfExportLabel(t("report.export.loadingImages"));
      await preloadMissingReportImageCache(collectReportImageSources(root));
      applyCachedReportImageSrcs(root);
      primeReportImagesForCapture(root);
      await waitForReportImages(root);
      await waitForReportFonts();
      await waitNextFrame();

      const sheets = Array.from(root.querySelectorAll<HTMLElement>("[data-mv-report-sheet]"));
      if (sheets.length === 0) return;

      const sources: DocxSheetSource[] = sheets.map((el, i) => ({
        root: el,
        landscape: el.dataset.mvReportOrientation === "landscape",
        title: t("report.export.pageTitle", { n: i + 1 }),
      }));

      setPdfExportProgress(50);
      setPdfExportLabel(t("report.export.generatingWord"));
      const safeName = (project?.name || "report").replace(/[\\/:*?"<>|]+/g, "-");
      await downloadDocxFromSheets(
        sources,
        `${safeName}-valuation-report.docx`,
        { title: `${project?.name || "Valuation Report"} Word` },
      );
      setPdfExportProgress(100);
      toast({ description: t("report.export.downloadedWord") });
    } catch (error) {
      toast({
        variant: "destructive",
        description: mvExportToastDescription(error, "report.export.wordFailed", t),
      });
    } finally {
      if (scrollEl) {
        scrollEl.scrollTop = prevTop;
        scrollEl.scrollLeft = prevLeft;
      }
      setDownloadingDocx(false);
      setPdfExportProgress(null);
      setPdfExportLabel("");
    }
  }, [loading, project?.name, reportMediaLoading, t, toast]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (autoPdfTriggeredRef.current) return;
    if (loading || reportMediaLoading || downloadingPdf) return;
    const key = mvAutoPdfDownloadStorageKey(projectId);
    if (window.sessionStorage.getItem(key) !== "1") return;
    autoPdfTriggeredRef.current = true;
    window.sessionStorage.removeItem(key);
    void downloadAsPdf();
  }, [downloadAsPdf, downloadingPdf, loading, projectId, reportMediaLoading]);

  useEffect(() => {
    const steps = readVisitedSimpleReportSteps(projectId);
    if (!steps.includes("report-preview")) {
      writeVisitedSimpleReportSteps(projectId, [...steps, "report-preview"]);
    }
  }, [projectId]);

  const reportData: MvProjectReportData = useMemo(
    () => withDraftDefaultReportData(project?.reportData),
    [project?.reportData],
  );
  const draftMode = isReportDraftMode(reportData);
  const appliedReportTemplateId = normalizeReportTemplateIdFrom(reportTemplateOptions, reportData.reportTemplateId);
  const appliedReportTemplate = findReportTemplateOptionFrom(reportTemplateOptions, appliedReportTemplateId);
  const reportTemplatePreviewOption = reportTemplatePreviewId
    ? findReportTemplateOptionFrom(reportTemplateOptions, reportTemplatePreviewId)
    : null;
  const companyLetterheadReady = hasCompanyLetterheadImages(letterheadTemplate);
  const includeAssetImages = reportData.includeAssetImages !== false;
  const includeValuationAccountImages =
    reportData.includeValuationAccountImages !== false &&
    valuationAccountStore.includeInReport !== false;
  const valuationAccountImages = useMemo(
    () =>
      includeValuationAccountImages
        ? valuationAccountStore.images.filter((image) => image.includeInReport !== false)
        : [],
    [includeValuationAccountImages, valuationAccountStore.images],
  );
  const valuationImageIdKey = valuationAccountImages.map((image) => image.id).join("|");

  useEffect(() => {
    const ids = valuationImageIdKey ? valuationImageIdKey.split("|") : [];
    setValuationImageOrder((current) => {
      const known = new Set(current);
      return [...current.filter((id) => ids.includes(id)), ...ids.filter((id) => !known.has(id))];
    });
  }, [valuationImageIdKey]);

  const orderedValuationImages = useMemo(() => {
    const byId = new Map(valuationAccountImages.map((image) => [image.id, image]));
    return valuationImageOrder
      .map((id) => byId.get(id))
      .filter((image): image is MvValuationAccountingImage => image != null);
  }, [valuationAccountImages, valuationImageOrder]);

  const clientDocumentImages = useMemo(
    () => clientDocumentImagesForReport(clientDocumentsStore),
    [clientDocumentsStore],
  );

  const persistValuationAccountingFromReport = useCallback(
    async (nextStore: MvValuationAccountingStore) => {
      writeValuationAccountingStore(projectId, nextStore);
      setValuationAccountStore(nextStore);
      try {
        await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            valuationAccountingWorkspace: valuationAccountingStoreForApi(nextStore),
          }),
        });
      } catch {
        /* ignore */
      }
    },
    [projectId],
  );

  const reorderValuationImages = useCallback(
    (nextOrder: string[]) => {
      setValuationImageOrder(nextOrder);
      const byId = new Map(valuationAccountStore.images.map((image) => [image.id, image]));
      const reordered = [
        ...nextOrder.map((id) => byId.get(id)).filter(Boolean),
        ...valuationAccountStore.images.filter((image) => !nextOrder.includes(image.id)),
      ] as MvValuationAccountingImage[];
      void persistValuationAccountingFromReport({ ...valuationAccountStore, images: reordered });
    },
    [persistValuationAccountingFromReport, valuationAccountStore],
  );

  const updateValuationImageWidth = useCallback(
    (imageId: string, width: number) => {
      const nextStore: MvValuationAccountingStore = {
        ...valuationAccountStore,
        images: valuationAccountStore.images.map((image) =>
          image.id === imageId ? { ...image, displayWidthPercent: width } : image,
        ),
      };
      void persistValuationAccountingFromReport(nextStore);
    },
    [persistValuationAccountingFromReport, valuationAccountStore],
  );

  const hideValuationImage = useCallback(
    (imageId: string) => {
      const nextStore: MvValuationAccountingStore = {
        ...valuationAccountStore,
        images: valuationAccountStore.images.map((image) =>
          image.id === imageId ? { ...image, includeInReport: false } : image,
        ),
      };
      setValuationImageOrder((current) => current.filter((id) => id !== imageId));
      void persistValuationAccountingFromReport(nextStore);
    },
    [persistValuationAccountingFromReport, valuationAccountStore],
  );

  /** فقط الصور المعلّمة للتقرير في خطوة صور الأصول (جهاز أو تطبيق) */
  const selectedImages = useMemo(
    () => (includeAssetImages ? files.filter((file) => file.includeInReport === true) : []),
    [files, includeAssetImages],
  );
  const selectedImageIdKey = selectedImages.map((file) => file._id).join("|");

  useEffect(() => {
    const ids = selectedImageIdKey ? selectedImageIdKey.split("|") : [];
    setImageOrder((current) => {
      const currentSet = new Set(current);
      return [
        ...current.filter((id) => ids.includes(id)),
        ...ids.filter((id) => !currentSet.has(id)),
      ];
    });
    setHiddenImageIds((current) => {
      const idsSet = new Set(ids);
      const next = new Set<string>();
      current.forEach((id) => {
        if (idsSet.has(id)) next.add(id);
      });
      return next;
    });
  }, [selectedImageIdKey]);

  const orderedImages = useMemo(() => {
    const byId = new Map(selectedImages.map((file) => [file._id, file]));
    return imageOrder
      .map((id) => byId.get(id))
      .filter((file): file is MvDriveFile => file != null && !hiddenImageIds.has(file._id));
  }, [hiddenImageIds, imageOrder, selectedImages]);

  const wordTemplateAssetImageSources = useMemo(
    () =>
      orderedImages
        .filter((file) => !file.mimeType?.startsWith("video/"))
        .map((file) => {
          const fileWithSource = file as MvDriveFile & { sourceUrl?: string };
          const url =
            fileWithSource.sourceUrl ||
            `/api/mv/projects/${projectId}/files/${encodeURIComponent(String(file._id))}/download`;
          return { url, caption: file.name };
        })
        .filter((row) => Boolean(row.url)),
    [orderedImages, projectId],
  );

  const wordTemplateValuationImageSources = useMemo(
    () =>
      orderedValuationImages.map((image) => ({
        url: resolveValuationAccountingImageSrc(projectId, image),
        caption: image.name || image.sourceFileName,
      })).filter((row) => Boolean(row.url)),
    [orderedValuationImages, projectId],
  );

  const wordTemplateClientImageSources = useMemo(
    () =>
      clientDocumentImages
        .map((image) => ({
          url: resolveClientDocumentImageSrc(projectId, image),
          caption: image.name || image.sourceFileName,
        }))
        .filter((row) => Boolean(row.url)),
    [clientDocumentImages, projectId],
  );

  const isSimpleReport = (project?.reportType ?? "simple") === "simple";

  const downloadAsDocxTemplate = useCallback(async () => {
    if (loading || reportMediaLoading) return;
    setDownloadingDocxTemplate(true);
    setPdfExportProgress(8);
    setPdfExportLabel(t("report.export.preparingWordData"));
    try {
      await beforeWordMergeRef.current();
      const mergeInput = await prepareMvWordMergeInput({
        projectName: project?.name || "report",
        displayNumber: project?.displayNumber,
        reportData,
        assetImageSources: wordTemplateAssetImageSources,
        valuationImageSources: wordTemplateValuationImageSources,
        clientImageSources: wordTemplateClientImageSources,
        loadImages: false,
      });
      setPdfExportProgress(55);
      setPdfExportLabel(t("report.wordTemplate.merging"));
      const result = await mergeWordReportTemplateSmart({
        projectId,
        mergeInput,
        assetImageUrls: wordTemplateAssetImageSources.map((s) => s.url),
        valuationImageUrls: wordTemplateValuationImageSources.map((s) => s.url),
        clientImageUrls: wordTemplateClientImageSources.map((s) => s.url),
        alsoPdf: false,
        useStoredProjectState: true,
        imageLayout: buildMvWordImageLayout(reportData),
      });
      const safeName = (project?.name || "report").replace(/[\\/:*?"<>|]+/g, "-");
      downloadMergedReportFiles({
        docxBlob: result.blob,
        baseName: safeName,
      });
      setPdfExportProgress(100);
      const mergeStats = result.mergeStats;
      const hasMergedContent =
        mergeStats.variablesFilled > 0 ||
        mergeStats.assetImagesInserted > 0 ||
        mergeStats.valuationImagesInserted > 0 ||
        mergeStats.clientImagesInserted > 0;
      const warningDetail = mergeStats.warnings.filter(Boolean).join(" ");
      const successLabel = t("report.export.wordTemplate");
      toast({
        variant: hasMergedContent ? "default" : "destructive",
        description: warningDetail
          ? hasMergedContent
            ? `${successLabel} ${warningDetail}`
            : warningDetail
          : hasMergedContent
            ? successLabel
            : t("report.wordTemplate.toastNoData"),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description: mvExportToastDescription(error, "report.export.wordTemplateFailed", t),
      });
    } finally {
      setDownloadingDocxTemplate(false);
      setPdfExportProgress(null);
      setPdfExportLabel("");
    }
  }, [
    loading,
    project?.displayNumber,
    project?.name,
    projectId,
    reportData,
    reportMediaLoading,
    t,
    toast,
    wordTemplateAssetImageSources,
    wordTemplateClientImageSources,
    wordTemplateValuationImageSources,
  ]);

  const assetFolderLabels = useMemo(() => {
    const set = new Set<string>();
    orderedImages.forEach((file) => set.add(folderPathFromFile(file)));
    return [...set].filter(Boolean);
  }, [orderedImages]);

  const moveImage = useCallback((fileId: string, direction: -1 | 1) => {
    setImageOrder((current) => {
      const next = [...current];
      const index = next.indexOf(fileId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }, []);

  const hideImage = useCallback((fileId: string) => {
    setHiddenImageIds((current) => new Set(current).add(fileId));
    setImageOrder((current) => current.filter((id) => id !== fileId));
  }, []);

  const preparerDisplayRows = useMemo(() => {
    const selected = normalizeReportTeam(reportData.valuationTeam, companySignatories);
    const optionById = new Map(companySignatories.map((row) => [row.id, row]));
    return selected.map((member): ReportSignatureRow => {
      const source = optionById.get(member.id);
      return {
        id: member.id,
        name: source?.name || member.name || "",
        jobTitle: source?.jobTitle || member.title || "",
        roleLabel: member.role || "",
        membershipNo: source?.membershipNo || member.membershipNo || "",
        signatureImageDataUrl: source?.signatureImageDataUrl || "",
        isCompanyAdmin: source?.isCompanyAdmin === true,
      };
    });
  }, [companySignatories, reportData.valuationTeam]);

  const reportImageSources = useMemo(() => {
    const sources: string[] = [];
    if (companyBrand.logoSrc) sources.push(companyBrand.logoSrc);
    if (letterheadTemplate?.coverImageDataUrl) sources.push(letterheadTemplate.coverImageDataUrl);
    if (letterheadTemplate?.pageImageDataUrl) sources.push(letterheadTemplate.pageImageDataUrl);
    if (letterheadTemplate?.landscapePageImageDataUrl) sources.push(letterheadTemplate.landscapePageImageDataUrl);
    if (letterheadTemplate?.logoDataUrl) sources.push(letterheadTemplate.logoDataUrl);
    if (letterheadTemplate?.footerImageDataUrl) sources.push(letterheadTemplate.footerImageDataUrl);
    if (letterheadTemplate?.signatureStampDataUrl) sources.push(letterheadTemplate.signatureStampDataUrl);
    // لا داعٍ لتحميل صور قوالب AI مسبقاً — لم تعد تُستخدم كخلفية إطلاقاً (انظر `renderedLetterheadTemplate` أعلاه).
    for (const file of orderedImages.slice(0, REPORT_PREVIEW_WARM_IMAGE_LIMIT)) {
      sources.push(reportDriveFileImageSrc(projectId, file));
    }
    const remainingWarmSlots = Math.max(0, REPORT_PREVIEW_WARM_IMAGE_LIMIT - orderedImages.length);
    for (const image of orderedValuationImages.slice(0, remainingWarmSlots)) {
      sources.push(reportValuationImageSrc(projectId, image));
    }
    for (const row of preparerDisplayRows) {
      if (row.signatureImageDataUrl) sources.push(row.signatureImageDataUrl);
    }
    return sources.filter(Boolean);
  }, [companyBrand.logoSrc, letterheadTemplate, orderedImages, orderedValuationImages, preparerDisplayRows, projectId]);

  const reportImageSourcesKey = useMemo(
    () =>
      reportImageSources
        .filter((src) => shouldCacheReportImage(src))
        .map((src) => normalizeReportImageSrc(src))
        .join("|"),
    [reportImageSources],
  );

  const resolveReportImageSrc = useCallback(
    (src: string) => getCachedReportImageSrc(src),
    [reportImageCacheVersion],
  );

  const renderedLetterheadTemplate = useMemo<MvCompanyReportLetterheadTemplate | null>(() => {
    if (appliedReportTemplateId === DEFAULT_REPORT_TEMPLATE_ID) return null;
    const appliedTemplate = findReportTemplateOptionFrom(reportTemplateOptions, appliedReportTemplateId);
    if (appliedTemplate.usesAiTemplate && appliedTemplate.aiTemplate) {
      /**
       * لا نستخدم أي لقطة شاشة من ملف PDF المرفوع (غلاف أو صفحة داخلية) كخلفية إطلاقاً.
       * كل لقطة رُفعت تحوي نصاً حقيقياً ثابتاً بلونه وخطه الأصليين من المستند المصدر
       * (عنوان، اسم عميل، فهرس...)، وتراكيب مباشرة تحته/فوقه محتوى ديناميكياً بتصميمنا
       * الخاص (نص أبيض ثابت يفرض تصميماً داكناً) كان يُسبب تعارضاً/تراكب نص لا يمكن
       * ضمان سلامته لملف مرفوع عشوائي — بل كانت الخلفية نفسها تتسرب أيضاً إلى صفحة
       * الشكر الختامية (نفس `variant="cover"`). لذلك نتعامل مع قالب AI بالضبط كما
       * نتعامل مع أي قالب جاهز مبني بالكود (مثل «executive-navy»): بلا صور خلفية إطلاقاً
       * (`enabled: false`)، معرّف قالب غير معروف لدى `reportTemplateChrome`/
       * `ReportTemplateCoverDecor` فيسقط تلقائياً وبأمان على تصميم الغلاف الاحترافي
       * الافتراضي (كحلي/ذهبي) — نفس جودة والاتساق البصري لبقية التقرير تماماً.
       * محتوى الصفحات الداخلية لقالب AI يُبنى ديناميكياً من `aiTemplate.sections` داخل
       * `MvValuationReportDocumentBody`، لا من أي صورة.
       */
      return {
        enabled: false,
        templateId: appliedTemplate.id,
        outputFormat: "pdf",
      };
    }
    if (appliedReportTemplateId !== COMPANY_LETTERHEAD_TEMPLATE_ID) {
      return {
        enabled: false,
        templateId: appliedTemplate.id,
        outputFormat: appliedTemplate.outputFormat,
      };
    }
    if (!letterheadTemplate) return null;
    if (!hasCompanyLetterheadImages(letterheadTemplate)) return null;
    const image = (src?: string | null) => (src ? getCachedReportImageSrc(src) : null);
    return {
      enabled: true,
      templateId: COMPANY_LETTERHEAD_TEMPLATE_ID,
      outputFormat: "pdf",
      coverImageDataUrl: image(letterheadTemplate.coverImageDataUrl),
      pageImageDataUrl: image(letterheadTemplate.pageImageDataUrl),
      landscapePageImageDataUrl: image(letterheadTemplate.landscapePageImageDataUrl),
      logoDataUrl: image(letterheadTemplate.logoDataUrl),
      footerImageDataUrl: image(letterheadTemplate.footerImageDataUrl),
      signatureStampDataUrl: image(letterheadTemplate.signatureStampDataUrl),
    };
  }, [appliedReportTemplateId, letterheadTemplate, reportImageCacheVersion, reportTemplateOptions]);

  useEffect(() => {
    if (loading || reportImageSources.length === 0) return;
    if (reportImageWarmKeyRef.current === reportImageSourcesKey) return;
    reportImageWarmKeyRef.current = reportImageSourcesKey;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void preloadReportImageCache(reportImageSources).then(() => {
        if (!cancelled) setReportImageCacheVersion((v) => v + 1);
      });
    }, REPORT_BACKGROUND_IMAGE_WARM_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loading, reportImageSources, reportImageSourcesKey]);

  const projectName = project?.name ?? projectId;
  const primarySignatory = preparerDisplayRows[0];
  const inspectionLocationLine = useMemo(() => {
    const loc = project?.locations?.[0];
    if (!loc) return { text: "غير محدد", mapUrl: "" as string };
    const bits = [loc.city, loc.region].filter(Boolean).join("، ");
    const mapUrl = (loc.mapUrl ?? "").trim();
    return { text: bits || "موقع المعاينة", mapUrl };
  }, [project?.locations]);

  const reportFooterLines = useMemo(() => {
    const lines: string[] = [];
    if (companyBrand.name.trim()) lines.push(`الشركة: ${companyBrand.name.trim()}`);
    const currentUserIdentifier = user?.phone?.trim() || user?.username?.trim();
    if (currentUserIdentifier) lines.push(`المستخدم الحالي: ${currentUserIdentifier}`);
    if (profile?.email?.trim()) lines.push(`بريد: ${profile.email.trim()}`);
    if (profile?.phone?.trim()) lines.push(`هاتف: ${profile.phone.trim()}`);
    const creator = project?.createdByName?.trim();
    if (creator) lines.push(`منشئ المشروع: ${creator}`);
    if (lines.length === 0) lines.push("تقرير تقييم مهني — Spark Vision");
    return lines;
  }, [companyBrand.name, user?.phone, user?.username, profile?.email, profile?.phone, project?.createdByName]);

  const persistProjectReportData = useCallback(
    async (nextReportData: MvProjectReportData): Promise<boolean> => {
      const p = projectRef.current;
      if (!p?._id) return false;
      const requestId = ++reportDataPersistRequestRef.current;
      const normalizedReportData = withDraftDefaultReportData(nextReportData);
      try {
        const res = await fetch(`/api/mv/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: p.name,
            reportType: p.reportType ?? "simple",
            reportData: normalizedReportData,
          }),
        });
        if (!res.ok) return false;
        const j = (await res.json()) as { project?: MvProject };
        if (j.project && requestId === reportDataPersistRequestRef.current) {
          const savedProject = withDraftDefaultProject(j.project)!;
          setProject((current) => {
            const currentDraft = current?._id === savedProject._id ? current?.reportData?.reportPresentationDraft : undefined;
            const nextProject =
              currentDraft === undefined
                ? savedProject
                : {
                    ...savedProject,
                    reportData: {
                      ...(savedProject.reportData ?? {}),
                      reportPresentationDraft: currentDraft,
                    },
                  };
            const prevBundle = readMvWorkflowSessionJson<ValuationReportSessionBundle>(sessionKey) ?? {};
            writeMvWorkflowSessionJson(sessionKey, { ...prevBundle, project: nextProject, fetchedAt: Date.now() });
            return nextProject;
          });
        }
        return true;
      } catch {
        return false;
      }
    },
    [projectId, sessionKey],
  );

  const onReportDataPatch = useCallback(
    (patch: Partial<MvProjectReportData>) => {
      setProject((p) => {
        if (!p) return p;
        const rd = withDraftDefaultReportData({ ...(p.reportData ?? {}), ...patch });
        if (typeof patch.reportPresentationDraft === "boolean") {
          draftModeOverrideRef.current = patch.reportPresentationDraft;
        }
        const next = { ...p, reportData: rd };
        projectRef.current = next;
        const prevBundle = readMvWorkflowSessionJson<ValuationReportSessionBundle>(sessionKey) ?? {};
        writeMvWorkflowSessionJson(sessionKey, { ...prevBundle, project: next, fetchedAt: Date.now() });
        if (reportDataPersistTimerRef.current) window.clearTimeout(reportDataPersistTimerRef.current);
        reportDataPersistTimerRef.current = window.setTimeout(() => {
          reportDataPersistTimerRef.current = null;
          void persistProjectReportData(rd).then((saved) => {
            if (saved) return;
            toast({
              variant: "destructive",
              description: t("report.settings.saveFailed"),
            });
          });
        }, 900);
        return next;
      });
    },
    [persistProjectReportData, sessionKey, t, toast],
  );

  const flushPendingReportDataForWord = useCallback(async () => {
    if (!reportDataPersistTimerRef.current) return;
    window.clearTimeout(reportDataPersistTimerRef.current);
    reportDataPersistTimerRef.current = null;
    const pendingReportData = projectRef.current?.reportData;
    if (!pendingReportData) return;
    const saved = await persistProjectReportData(pendingReportData);
    if (!saved) {
      throw new Error(t("report.settings.saveFailed"));
    }
  }, [persistProjectReportData, t]);

  // كلا مساري تنزيل Word (زر الشريط والنافذة) ينتظران أي حفظ محلي معلّق
  // ثم يتركان الخادم يقرأ أحدث نسخة موحدة للمشروع والصور والحسابات والعميل.
  beforeWordMergeRef.current = flushPendingReportDataForWord;

  useEffect(
    () => () => {
      if (!reportDataPersistTimerRef.current) return;
      window.clearTimeout(reportDataPersistTimerRef.current);
      reportDataPersistTimerRef.current = null;
      const pendingReportData = projectRef.current?.reportData;
      if (pendingReportData) void persistProjectReportData(pendingReportData);
    },
    [persistProjectReportData],
  );

  const updatePreparerRole = useCallback(
    (id: string, value: string) => {
      const currentTeam = normalizeReportTeam(
        projectRef.current?.reportData?.valuationTeam,
        companySignatories,
      );
      onReportDataPatch({
        valuationTeam: currentTeam.map((member) =>
          member.id === id ? { ...member, role: value } : member,
        ),
      });
    },
    [companySignatories, onReportDataPatch],
  );

  const applyReportTemplateById = useCallback((templateId: string) => {
    const option = findReportTemplateOptionFrom(reportTemplateOptions, templateId);
    setPendingReportTemplateId(option.id);
    if (option.usesCompanyLetterhead && !companyLetterheadReady) {
      toast({
        variant: "destructive",
        description: t("report.templates.uploadLetterheadFirst"),
      });
      return;
    }
    onReportDataPatch({ reportTemplateId: option.id });
    toast({ description: t("report.templates.applied", { title: option.title }) });
  }, [companyLetterheadReady, onReportDataPatch, reportTemplateOptions, t, toast]);

  const applyProjectReportTemplate = useCallback(() => {
    applyReportTemplateById(pendingReportTemplateId);
  }, [applyReportTemplateById, pendingReportTemplateId]);

  useEffect(() => {
    if (!project || companyDefaultSections.length === 0) return;
    setEditableSections((current) => {
      const existing = new Set<string>();
      for (const section of current) {
        if (section.companyDefaultSectionId) existing.add(section.companyDefaultSectionId);
        if (section.id.startsWith("company-default:")) existing.add(section.id.slice("company-default:".length));
      }
      const additions = companyDefaultSections
        .filter((section) => !existing.has(section.id))
        .map((section) => ({
          id: `company-default:${section.id}`,
          companyDefaultSectionId: section.id,
          sectionNumber: section.sectionNumber,
          title: section.title || "بند إضافي",
          body: section.body,
        }));
      if (additions.length === 0) return current;
      const next = [...current, ...additions];
      onReportDataPatch({ reportEditableSections: next });
      return next;
    });
  }, [companyDefaultSections, onReportDataPatch, project]);

  const saveReportSettingsNow = useCallback(async () => {
    const p = projectRef.current;
    if (!p) return;
    setReportSaving(true);
    if (reportDataPersistTimerRef.current) {
      window.clearTimeout(reportDataPersistTimerRef.current);
      reportDataPersistTimerRef.current = null;
    }
    const rd = withDraftDefaultReportData({
      ...(p.reportData ?? {}),
      reportNarrativeB1: narrativeB1,
      reportNarrativeB2: narrativeB2,
      reportNarrativeB3: narrativeB3,
      reportNarrativeB4: narrativeB4,
      reportIntroExtraHtml: introExtraHtml,
      reportEditableSections: editableSections,
      reportPageOrientations,
    });
    try {
      const saved = await persistProjectReportData(rd);
      if (!saved) throw new Error("report settings save failed");
      toast({ description: t("report.settings.saved") });
    } catch {
      toast({
        variant: "destructive",
        description: t("report.settings.saveFailed"),
      });
    } finally {
      setReportSaving(false);
    }
  }, [
    editableSections,
    introExtraHtml,
    narrativeB1,
    narrativeB2,
    narrativeB3,
    narrativeB4,
    persistProjectReportData,
    reportPageOrientations,
    toast,
  ]);

  const toggleDraftMode = useCallback(() => {
    setProject((p) => {
      if (!p) return p;
      const nextDraftMode = !isReportDraftMode(p.reportData);
      draftModeOverrideRef.current = nextDraftMode;
      const rd = {
        ...(p.reportData ?? {}),
        reportPresentationDraft: nextDraftMode,
      };
      const next = { ...p, reportData: rd };
      const prevBundle = readMvWorkflowSessionJson<ValuationReportSessionBundle>(sessionKey) ?? {};
      writeMvWorkflowSessionJson(sessionKey, { ...prevBundle, project: next, fetchedAt: Date.now() });
      if (reportDataPersistTimerRef.current) {
        window.clearTimeout(reportDataPersistTimerRef.current);
        reportDataPersistTimerRef.current = null;
      }
      void persistProjectReportData(rd);
      return next;
    });
  }, [persistProjectReportData, sessionKey]);

  const updateReportPageOrientation = useCallback(
    (pageKey: string, orientation: MvReportPageOrientationPreference) => {
      setReportPageOrientations((current) => {
        const next = { ...current, [pageKey]: orientation };
        onReportDataPatch({ reportPageOrientations: next });
        return next;
      });
    },
    [onReportDataPatch],
  );

  const updateIntroExtraHtml = useCallback(
    (html: string) => {
      setIntroExtraHtml(html);
      onReportDataPatch({ reportIntroExtraHtml: html });
    },
    [onReportDataPatch],
  );

  const updateNarrativeB1 = useCallback(
    (html: string) => {
      setNarrativeB1(html);
      onReportDataPatch({ reportNarrativeB1: html });
    },
    [onReportDataPatch],
  );

  const updateNarrativeB2 = useCallback(
    (html: string) => {
      setNarrativeB2(html);
      onReportDataPatch({ reportNarrativeB2: html });
    },
    [onReportDataPatch],
  );

  const updateNarrativeB3 = useCallback(
    (html: string) => {
      setNarrativeB3(html);
      onReportDataPatch({ reportNarrativeB3: html });
    },
    [onReportDataPatch],
  );

  const updateNarrativeB4 = useCallback(
    (html: string) => {
      setNarrativeB4(html);
      onReportDataPatch({ reportNarrativeB4: html });
    },
    [onReportDataPatch],
  );

  const sectionIdsOrdered = useMemo((): ReportSectionId[] => {
    return [
      ...MV_REPORT_SCROLL_ANCHOR_ORDER,
      ...editableSections.map((s) => `custom:${s.id}` as ReportSectionId),
    ];
  }, [editableSections]);

  /** ترقيم الصفحات في الهيدر + ربط الفهرس بورقة التقرير الفعلية. */
  useLayoutEffect(() => {
    const root = reportPdfRef.current;
    if (!root || loading) return;

    const labelSheets = (targetRoot: HTMLElement | null) => {
      if (!targetRoot) return [] as Element[];
      const targetSheets = Array.from(targetRoot.querySelectorAll("[data-mv-report-sheet]"));
      const total = targetSheets.length;
      targetSheets.forEach((sheet, i) => {
        const slot = sheet.querySelector("[data-mv-page-label-slot]");
        if (slot) slot.textContent = `${i + 1} / ${total}`;
      });
      return targetSheets;
    };

    const sheets = labelSheets(root);
    if (previewOpen) labelSheets(previewReportRef.current);

    const next: Record<string, string> = {};
    for (const row of MV_REPORT_TOC_ROWS) {
      const el = document.getElementById(row.anchor);
      if (!el) {
        next[row.anchor] = "—";
        continue;
      }
      let idx = 0;
      for (let si = 0; si < sheets.length; si++) {
        if (sheets[si]!.contains(el)) {
          idx = si + 1;
          break;
        }
      }
      next[row.anchor] = idx > 0 ? String(idx) : "—";
    }
    setTocApproxPages((prev) => {
      const same =
        Object.keys(prev).length === Object.keys(next).length &&
        Object.keys(next).every((k) => prev[k] === next[k]);
      return same ? prev : next;
    });
  }, [
    loading,
    narrativeB1,
    narrativeB2,
    narrativeB3,
    narrativeB4,
    introExtraHtml,
    editableSections,
    orderedImages.length,
    valuationAccountImages.length,
    reportData,
    project?.name,
    preparerDisplayRows.length,
    includeAssetImages,
    includeValuationAccountImages,
    companyBrand.name,
    companyBrand.logoSrc,
    previewOpen,
  ]);

  /**
   * Adds a new custom editable section. When `insertAfterAnchorId` is supplied
   * (from the "+" cue between any two sections), the new section is rendered
   * directly after that anchor — otherwise it appends at the end (legacy).
   */
  const addEditableSection = useCallback(
    (insertAfterAnchorId?: string) => {
      setEditableSections((list) => {
        const next = [
          ...list,
          { id: newId(), title: "قسم جديد", body: "", insertAfterAnchorId },
        ];
        onReportDataPatch({ reportEditableSections: next });
        return next;
      });
    },
    [onReportDataPatch],
  );

  /**
   * Moves a custom section so it renders after a different anchor (via the "+"
   * cue drop target). Keeps the section data intact — only the placement
   * metadata changes.
   */
  const moveEditableSectionTo = useCallback(
    (sectionId: string, insertAfterAnchorId?: string) => {
      setEditableSections((list) => {
        const idx = list.findIndex((s) => s.id === sectionId);
        if (idx < 0) return list;
        const updated = { ...list[idx], insertAfterAnchorId };
        const next = list.filter((_, i) => i !== idx);
        next.push(updated);
        onReportDataPatch({ reportEditableSections: next });
        return next;
      });
    },
    [onReportDataPatch],
  );

  const removeEditableSection = useCallback((id: string) => {
    setEditableSections((list) => {
      const next = list.filter((s) => s.id !== id);
      onReportDataPatch({ reportEditableSections: next });
      return next;
    });
    setActiveSection((current) => (current === `custom:${id}` ? "report-cover" : current));
  }, [onReportDataPatch]);

  const updateEditableSection = useCallback((id: string, patch: Partial<MvReportEditableSection>) => {
    setEditableSections((list) => {
      const next = list.map((s) => (s.id === id ? { ...s, ...patch } : s));
      onReportDataPatch({ reportEditableSections: next });
      return next;
    });
  }, [onReportDataPatch]);

  const appliedAiTemplate = useMemo(() => {
    const appliedTemplate = findReportTemplateOptionFrom(reportTemplateOptions, appliedReportTemplateId);
    return appliedTemplate.usesAiTemplate ? appliedTemplate.aiTemplate ?? null : null;
  }, [appliedReportTemplateId, reportTemplateOptions]);

  const reportDocumentProps = {
    projectId,
    project,
    projectName,
    reportData,
    companyBrand,
    letterheadTemplate: renderedLetterheadTemplate,
    aiTemplate: appliedAiTemplate,
    reportFooterLines,
    draftWatermark: draftMode,
    onReportDataPatch,
    tocApproxPages,
    sectionGap,
    narrativeB1,
    narrativeB2,
    narrativeB3,
    narrativeB4,
    introExtraHtml,
    onNarrativeB1: updateNarrativeB1,
    onNarrativeB2: updateNarrativeB2,
    onNarrativeB3: updateNarrativeB3,
    onNarrativeB4: updateNarrativeB4,
    onIntroExtraHtml: updateIntroExtraHtml,
    assetFolderLabels,
    inspectionLocationText: inspectionLocationLine.text,
    inspectionMapUrl: inspectionLocationLine.mapUrl,
    primarySignatory,
    preparerDisplayRows,
    companyAdminMembershipNo,
    currentUserMembershipNo: user?.valuationReportMembershipNo ?? null,
    updatePreparerRole,
    includeAssetImages,
    includeValuationAccountImages,
    orderedImages,
    imageOrder,
    imageGroupGap,
    imageInnerGap,
    assetImageWidth,
    valuationImageWidth,
    assetImagesPerPage,
    assetImagesPerRow,
    assetImagesUniformSize,
    imageCornerRadius,
    paragraphLineHeight,
    headingScale,
    imageShadow,
    reportPageOrientations,
    onReportPageOrientationChange: updateReportPageOrientation,
    valuationAccountImages: orderedValuationImages,
    clientDocumentImages,
    clientDocumentsImagesPerRow: reportData.clientDocumentsImagesPerRow ?? 2,
    resolveImageSrc: resolveReportImageSrc,
    moveImage,
    hideImage,
    hideValuationImage,
    setImageOrder,
    navigate,
    editableSections,
    updateEditableSection,
    removeEditableSection,
    addEditableSection,
    moveEditableSectionTo,
    companyReportDefaults,
    onTocAnchorClick: (anchorId: string) => scrollToSection(anchorId as ReportSectionId),
  };

  const scrollToSection = useCallback((id: ReportSectionId) => {
    setActiveSection(id);
    window.requestAnimationFrame(() => {
      const el = document.getElementById(id);
      const container = reportSectionsScrollRef.current;
      if (!el) return;
      if (container) {
        const cRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const padding = 8;
        const nextTop =
          container.scrollTop + (elRect.top - cRect.top) - padding;
        container.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }, []);

  useEffect(() => {
    const container = reportSectionsScrollRef.current;
    if (!container || loading) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const cRect = container.getBoundingClientRect();
        const anchor = cRect.top + 72;
        let current: ReportSectionId = "report-cover";
        for (const id of sectionIdsOrdered) {
          const el = document.getElementById(id);
          if (!el) continue;
          const top = el.getBoundingClientRect().top;
          if (top <= anchor) current = id;
        }
        setActiveSection((prev) => (prev === current ? prev : current));
      });
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      container.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [loading, sectionIdsOrdered]);

  const showReportPreparationModal = false;
  const navPanelGutterPx = desktopReportChrome ? (navCollapsed ? 44 : 188) : 0;
  const settingsPanelGutterPx = desktopReportChrome && settingsDrawerOpen ? 304 : 0;
  const reportChromeGutterPx = navPanelGutterPx + settingsPanelGutterPx;

  const exportingFormat = useMemo<MvReportExportFormat | null>(() => {
    if (downloadingPdf) return "pdf";
    if (downloadingPptx) return "pptx";
    if (downloadingDocxTemplate) return "docx-template";
    if (downloadingDocx) return "docx";
    return null;
  }, [downloadingPdf, downloadingPptx, downloadingDocx, downloadingDocxTemplate]);

  const exportActionsDisabled = loading || reportMediaLoading || exportingFormat != null;

  const handleReportExport = useCallback(
    (format: MvReportExportFormat) => {
      if (exportActionsDisabled) return;
      if (format === "pdf") void downloadAsPdf();
      else if (format === "pptx") void downloadAsPptx();
      else if (format === "docx-template") void downloadAsDocxTemplate();
      else void downloadAsDocx();
    },
    [downloadAsDocx, downloadAsDocxTemplate, downloadAsPdf, downloadAsPptx, exportActionsDisabled],
  );

  useEffect(() => {
    if (!assetImagesPreviewOpen) return;
    const timer = window.setTimeout(() => {
      const root = assetImagesPreviewReportRef.current;
      const sc = assetImagesPreviewScrollRef.current;
      const el = root?.querySelector<HTMLElement>("#mv-annex-2");
      if (!root || !sc || !el) return;
      const rootRect = root.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      sc.scrollTop += elRect.top - rootRect.top - 16;
    }, 120);
    return () => window.clearTimeout(timer);
  }, [assetImagesPreviewOpen]);

  if (!project && !loading && loadError) {
    return (
      <MvWorkflowPageFrame className={cn("bg-[var(--color-background-primary)]", reportFont.className)} dir={dir}>
        <MvProjectReportHeader
          compact
          projectId={projectId}
          activeStep="report-preview"
          breadcrumbs={[{ label: projectId }, { label: t("report.breadcrumb") }]}
        />
        <MvErrorState
          title={t("report.openFailed")}
          description={loadError}
          onRetry={() => void load()}
          className="flex-1"
        />
      </MvWorkflowPageFrame>
    );
  }

  return (
    <MvWorkflowPageFrame
      className={cn("bg-[var(--color-background-primary)]", reportFont.className)}
      dir={dir}
    >
      <MvProjectReportHeader
        compact
        projectId={projectId}
        project={project}
        activeStep="report-preview"
        breadcrumbs={[
          { label: projectName, href: `/machine-valuation/${projectId}/workflow/report-data` },
          { label: t("report.breadcrumb") },
        ]}
      />

      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1920px] flex-1 flex-col overflow-hidden px-0.5 pb-1 pt-1 sm:px-1">
        {/* === شريط أدوات التقرير — responsive === */}
        <div
          className={cn(
            "mv-report-chrome mb-1.5 flex shrink-0 flex-col gap-2 rounded-xl border border-slate-200/80 bg-white/95 p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur sm:gap-2.5 lg:flex-row lg:items-center lg:justify-between",
          )}
        >
          {/* أدوات التنقل والإعدادات */}
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 shrink-0 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#0C447C]",
                !navCollapsed && "bg-slate-100/80 text-[#0C447C]",
              )}
              title={navCollapsed ? t("report.nav.showNav") : t("report.nav.hideNav")}
              aria-label={t("report.nav.sectionsList")}
              aria-pressed={!navCollapsed}
              onClick={() => setNavCollapsed((v) => !v)}
            >
              <ListTree className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "h-8 w-8 shrink-0 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#0C447C]",
                settingsDrawerOpen && settingsDrawerTab !== "images" && "bg-slate-100/80 text-[#0C447C]",
              )}
              title={t("report.toolbar.templatesSettings")}
              aria-label={t("report.toolbar.reportSettings")}
              aria-pressed={settingsDrawerOpen && settingsDrawerTab !== "images"}
              onClick={() => {
                setSettingsDrawerTab("templates");
                setSettingsDrawerOpen((v) => !v);
              }}
            >
              <Sliders className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 shrink-0 gap-1.5 rounded-lg px-2 text-slate-500 hover:bg-slate-100 hover:text-[#0C447C]",
                settingsDrawerOpen && settingsDrawerTab === "images" && "bg-slate-100/80 text-[#0C447C]",
              )}
              title={t("report.toolbar.imageLayout")}
              aria-label={t("report.toolbar.manageImages")}
              onClick={() => {
                setSettingsDrawerTab("images");
                setSettingsImagesTab("assets");
                setSettingsDrawerOpen(true);
              }}
            >
              <ImageIcon className="h-4 w-4" />
              <span className="hidden text-[10.5px] font-black sm:inline">{t("report.toolbar.images")}</span>
              <span className="rounded-md bg-white px-1.5 py-0.5 text-[9px] font-black tabular-nums text-[#0C447C] ring-1 ring-slate-200">
                {selectedImages.length}
              </span>
            </Button>

            <span className="mx-0.5 hidden h-5 w-px bg-slate-200 md:block" aria-hidden />

            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-[9.5px] font-black",
                  draftMode
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    draftMode ? "bg-amber-500" : "bg-emerald-500",
                  )}
                  aria-hidden
                />
                {draftMode ? t("report.toolbar.draft") : t("report.toolbar.final")}
              </span>
              {loading ? (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-slate-100 px-2 text-[9.5px] font-bold text-slate-700">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="hidden sm:inline">{t("report.toolbar.refreshing")}</span>
                </span>
              ) : reportMediaLoading ? (
                <span className="inline-flex h-6 items-center gap-1 rounded-full bg-sky-50 px-2 text-[9.5px] font-bold text-sky-900">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="hidden sm:inline">{t("report.toolbar.loadingImages")}</span>
                </span>
              ) : null}
            </div>
          </div>

          {/* القالب + الإجراءات */}
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end lg:gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 sm:min-w-[240px] sm:flex-initial">
              <div className="flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 shadow-sm sm:min-w-[180px] sm:max-w-[260px]">
                <FileText className="h-3.5 w-3.5 shrink-0 text-[#0C447C]" />
                <span className="hidden shrink-0 text-[10px] font-black text-slate-500 lg:inline">{t("report.toolbar.template")}</span>
                <Select value={pendingReportTemplateId} onValueChange={applyReportTemplateById}>
                  <SelectTrigger
                    className="h-7 min-w-0 flex-1 border-0 bg-transparent px-1 text-right text-[10.5px] font-black text-slate-800 shadow-none outline-none ring-0 focus:ring-0 [&>span]:truncate"
                    title={t("report.toolbar.selectTemplate")}
                  >
                    <SelectValue placeholder={t("report.toolbar.selectTemplate")} />
                  </SelectTrigger>
                  <SelectContent className="z-[760]">
                    {reportTemplateOptions.map((option) => (
                      <SelectItem
                        key={option.id}
                        value={option.id}
                        disabled={option.usesCompanyLetterhead && !companyLetterheadReady}
                      >
                        {option.title} - {option.badge}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isSimpleReport ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0 gap-1.5 rounded-lg border-sky-200 bg-sky-50/80 px-2.5 text-[10.5px] font-black text-[#0C447C] hover:bg-sky-100"
                  disabled={loading || reportMediaLoading}
                  onClick={() => setWordTemplateModalOpen(true)}
                  title={t("report.toolbar.downloadWord")}
                >
                  <FileType className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("report.toolbar.downloadWord")}</span>
                </Button>
              ) : null}

              <label
                htmlFor="mv-report-draft-mode-switch"
                className={cn(
                  "inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-[11px] font-black shadow-sm transition",
                  loading && "cursor-not-allowed opacity-60",
                  draftMode
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-emerald-200 bg-emerald-50 text-emerald-900",
                )}
                title={
                  draftMode
                    ? t("report.toolbar.draftOn")
                    : t("report.toolbar.draftOff")
                }
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md",
                    draftMode ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800",
                  )}
                  aria-hidden
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                </span>
                <span className="hidden sm:inline">{draftMode ? t("report.toolbar.draft") : t("report.toolbar.final")}</span>
                <Switch
                  id="mv-report-draft-mode-switch"
                  checked={draftMode}
                  onCheckedChange={() => toggleDraftMode()}
                  disabled={loading}
                  dir="ltr"
                  aria-label={t("report.toolbar.toggleDraft")}
                  className="border-0 shadow-inner data-[state=checked]:bg-amber-500 data-[state=unchecked]:bg-emerald-500"
                />
              </label>
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 rounded-lg border-slate-200 bg-white px-2.5 text-[10.5px] font-bold text-slate-700 hover:bg-slate-50 hover:text-[#0C447C]"
                disabled={loading || reportMediaLoading}
                onClick={openReportPreview}
                title={t("report.toolbar.previewBeforeExport")}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{t("report.toolbar.preview")}</span>
              </Button>

              <MvReportExportMenu
                disabled={exportActionsDisabled}
                exportingFormat={exportingFormat}
                onExport={handleReportExport}
              />

              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0 gap-1.5 rounded-lg bg-emerald-700 px-3 text-[10.5px] font-black text-white shadow-sm hover:bg-emerald-800"
                disabled={reportSaving || loading}
                onClick={() => void saveReportSettingsNow()}
                title={t("report.toolbar.saveChanges")}
              >
                {reportSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>{t("report.toolbar.save")}</span>
              </Button>
            </div>
          </div>
        </div>

        {/* === Workspace body (sidebar + canvas) === */}
        <div className="relative flex min-h-0 w-full flex-1 gap-0 overflow-hidden">
          <aside
            className={cn(
              "mv-report-chrome absolute right-0 top-0 z-[90] shrink-0 transition-[width] duration-200 ease-out print:hidden",
              "max-h-[min(42vh,300px)] min-h-0 lg:max-h-none lg:h-full",
              navCollapsed ? "hidden lg:block lg:w-10" : "w-[min(250px,calc(100%-0.5rem))] lg:w-[180px] xl:w-[188px]",
            )}
          >
            <div className="flex h-full max-h-[min(38vh,280px)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur lg:max-h-none">
              {!navCollapsed ? (
                <div className="flex shrink-0 items-center justify-between gap-1 border-b border-slate-100 px-2 py-1.5">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#0C447C] text-white">
                      <ListTree className="h-3 w-3" />
                    </span>
                    <span className="min-w-0 truncate text-[10.5px] font-black text-slate-800">
                      {t("report.nav.reportSections")}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNavCollapsed(true)}
                    title={t("report.nav.collapseList")}
                    aria-label={t("report.nav.collapseNav")}
                    className="hidden h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:flex"
                  >
                    <ChevronsRight className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="hidden shrink-0 items-center justify-center border-b border-slate-100 py-1.5 lg:flex">
                  <button
                    type="button"
                    onClick={() => setNavCollapsed(false)}
                    title={t("report.nav.expandList")}
                    aria-label={t("report.nav.expandNav")}
                    className="flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-[#0C447C]"
                  >
                    <ChevronsLeft className="h-3 w-3" />
                  </button>
                </div>
              )}

              <nav
                className={cn(
                  "min-h-0 flex-1 overflow-y-auto overscroll-contain",
                  navCollapsed ? "space-y-1 px-1 py-1.5" : "space-y-0.5 px-1.5 py-1.5",
                )}
              >
                {MV_REPORT_NAV_GROUPS(t).map((row) => (
                  <ReportTocItem
                    key={row.anchor}
                    active={isReportNavGroupActive(activeSection, row.activeAnchors)}
                    icon={row.icon}
                    title={row.title}
                    onClick={() => {
                      scrollToSection(row.anchor);
                      if (row.anchor === "mv-annex-2") {
                        setSettingsImagesTab("assets");
                        setSettingsDrawerTab("images");
                        setSettingsDrawerOpen(true);
                      }
                    }}
                    collapsed={navCollapsed}
                  />
                ))}
                {editableSections.length > 0 && !navCollapsed ? (
                  <p className="px-1 pt-1.5 pb-0.5 text-[9px] font-black uppercase tracking-wider text-slate-400">
                    {t("report.nav.additionalSections")}
                  </p>
                ) : null}
                {editableSections.map((s) => (
                  <ReportTocItem
                    key={s.id}
                    active={activeSection === `custom:${s.id}`}
                    icon={<FileText className="h-3 w-3" />}
                    title={s.title.trim() || t("report.nav.extraSection")}
                    onClick={() => scrollToSection(`custom:${s.id}`)}
                    collapsed={navCollapsed}
                  />
                ))}
              </nav>
            </div>
          </aside>

          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-b from-slate-100/40 via-slate-50/30 to-slate-100/40 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div
              ref={reportSectionsScrollRef}
              className={cn(
                "min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [overflow-anchor:none]",
                "touch-pan-y [-webkit-overflow-scrolling:touch]",
                "transition-[padding] duration-200 ease-out",
                !navCollapsed && "lg:pr-[188px]",
                navCollapsed && "lg:pr-11",
                settingsDrawerOpen && "lg:pl-[304px]",
                "bg-transparent",
              )}
            >
              <article
                ref={(el) => {
                  reportPdfRef.current = el;
                }}
                className={cn(
                  "mx-auto min-h-0 w-full bg-transparent pb-8 text-slate-950",
                )}
                style={{
                  padding: `${marginY}px ${marginX}px`,
                }}
              >
                <ReportViewportFit
                  scrollRef={reportSectionsScrollRef}
                  gutterPx={Math.max(0, Math.round(marginX * 2) + reportChromeGutterPx)}
                >
                  <MvValuationReportDocumentBody {...reportDocumentProps} />
                </ReportViewportFit>
              </article>
            </div>
          </main>

          {/* === Settings drawer (margins + images) === */}
          {settingsDrawerOpen ? (
            <>
              {/* Backdrop only on mobile so desktop keeps the canvas visible alongside the drawer. */}
              <button
                type="button"
                aria-label={t("report.toolbar.closeSettings")}
                onClick={() => setSettingsDrawerOpen(false)}
                className="mv-report-chrome fixed inset-0 z-[120] bg-slate-900/20 backdrop-blur-[1px] lg:hidden"
              />
              <div
                role="dialog"
                aria-label={t("report.toolbar.reportSettings")}
                className={cn(
                  "mv-report-chrome absolute inset-y-0 left-0 z-[130] flex w-[min(340px,92vw)] flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white/95 shadow-[0_8px_32px_rgba(15,23,42,0.10)] backdrop-blur",
                  "lg:w-[300px]",
                  "lg:bg-white",
                )}
              >
                <div className="flex shrink-0 items-center justify-between gap-1.5 border-b border-slate-100 px-2.5 py-1.5">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-[#0C447C] text-white">
                      <Sliders className="h-3 w-3" />
                    </span>
                    <span className="text-[11px] font-black text-slate-800">{t("report.toolbar.reportSettings")}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettingsDrawerOpen(false)}
                    title={t("report.toolbar.close")}
                    aria-label={t("report.toolbar.close")}
                    className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="shrink-0 border-b border-slate-100 px-2 py-1.5">
                  <div className="flex gap-0.5 rounded-md bg-slate-100/70 p-0.5 ring-1 ring-slate-200/70">
                    <button
                      type="button"
                      onClick={() => setSettingsDrawerTab("templates")}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded px-1.5 py-1 text-[10.5px] font-black transition",
                        settingsDrawerTab === "templates"
                          ? "bg-white text-[#0C447C] shadow-sm"
                          : "text-slate-500 hover:bg-white/50",
                      )}
                    >
                      <FileText className="h-3 w-3" />
                      {t("report.settings.tabs.templates")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsDrawerTab("layout")}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded px-1.5 py-1 text-[10.5px] font-black transition",
                        settingsDrawerTab === "layout"
                          ? "bg-white text-[#0C447C] shadow-sm"
                          : "text-slate-500 hover:bg-white/50",
                      )}
                    >
                      <PencilRuler className="h-3 w-3" />
                      {t("report.settings.tabs.layout")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsDrawerTab("images")}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded px-1.5 py-1 text-[10.5px] font-black transition",
                        settingsDrawerTab === "images"
                          ? "bg-white text-[#0C447C] shadow-sm"
                          : "text-slate-500 hover:bg-white/50",
                      )}
                    >
                      <ImageIcon className="h-3 w-3" />
                      {t("report.settings.tabs.images")}
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
                  {settingsDrawerTab === "templates" ? (
                    <div className="space-y-2.5">
                      <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-[10.5px] font-black text-slate-700">{t("report.toolbar.selectTemplate")}</span>
                          <Badge className="rounded-full bg-slate-100 px-2 py-0.5 text-[9.5px] text-slate-700">
                            {appliedReportTemplate.title}
                          </Badge>
                        </div>
                        <Select value={pendingReportTemplateId} onValueChange={setPendingReportTemplateId}>
                          <SelectTrigger className="h-8 rounded-lg border-slate-200 bg-white text-right text-[11px] font-black">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[760]">
                            {reportTemplateOptions.map((option) => (
                              <SelectItem
                                key={option.id}
                                value={option.id}
                                disabled={option.usesCompanyLetterhead && !companyLetterheadReady}
                              >
                                {option.title} - {option.badge}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          size="sm"
                          className="mt-2 h-8 w-full rounded-lg bg-[#0C447C] text-[11px] font-black hover:bg-[#09345f]"
                          disabled={loading || pendingReportTemplateId === appliedReportTemplateId}
                          onClick={applyProjectReportTemplate}
                        >
                          {t("report.settings.apply")}
                        </Button>
                      </div>

                      <div className="grid gap-2">
                        {reportTemplateOptions.map((option) => {
                          const active = option.id === appliedReportTemplateId;
                          const pending = option.id === pendingReportTemplateId;
                          const disabled = Boolean(option.usesCompanyLetterhead && !companyLetterheadReady);
                          const previewImage = option.usesAiTemplate
                            ? option.aiTemplate?.coverImageDataUrl || option.aiTemplate?.pageImageDataUrl
                            : option.usesCompanyLetterhead
                            ? letterheadTemplate?.coverImageDataUrl ||
                              letterheadTemplate?.pageImageDataUrl ||
                              letterheadTemplate?.landscapePageImageDataUrl
                            : null;
                          return (
                            <div
                              key={option.id}
                              className={cn(
                                "overflow-hidden rounded-xl border bg-white shadow-sm",
                                active
                                  ? "border-emerald-300 ring-2 ring-emerald-100"
                                  : pending
                                    ? "border-sky-300 ring-2 ring-sky-100"
                                    : "border-slate-200",
                                disabled && "opacity-60",
                              )}
                            >
                              <div className="relative h-24 bg-slate-50">
                                <ReportTemplateArtwork option={option} previewImage={previewImage} />
                                <Badge className="absolute left-2 top-2 rounded-full bg-white px-2 py-0.5 text-[9px] text-slate-800 shadow-sm">
                                  {option.badge}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 p-2">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 shrink-0 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-[#0C447C]"
                                  title={t("report.toolbar.preview")}
                                  aria-label={t("report.preview.templateAria", { title: option.title })}
                                  onClick={() => setReportTemplatePreviewId(option.id)}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <div className="min-w-0 flex-1 text-right">
                                  <div className="truncate text-[11.5px] font-black text-slate-900">{option.title}</div>
                                  <p className="mt-0.5 line-clamp-2 text-[9.5px] font-semibold leading-snug text-slate-500">
                                    {option.description}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={pending ? "secondary" : "outline"}
                                  className="h-7 shrink-0 rounded-lg px-2 text-[10px] font-black"
                                  disabled={disabled}
                                  onClick={() => setPendingReportTemplateId(option.id)}
                                >
                                  {active ? t("report.toolbar.applied") : pending ? t("report.toolbar.selected") : t("report.toolbar.choose")}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : settingsDrawerTab === "layout" ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="text-[10px] font-bold text-slate-500">
                          {t("report.settings.layoutHint")}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 px-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-100 hover:text-[#0C447C]"
                          title={t("report.toolbar.resetLayout")}
                          onClick={resetLayoutToDefaults}
                        >
                          <RotateCcw className="h-3 w-3" />
                          {t("report.settings.default")}
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        <ControlSlider
                          icon={<Ruler className="h-3.5 w-3.5" />}
                          label={t("report.toolbar.marginHorizontal")}
                          value={marginX}
                          min={0}
                          max={120}
                          step={2}
                          suffix="px"
                          onChange={setMarginX}
                        />
                        <ControlSlider
                          icon={<Ruler className="h-3.5 w-3.5" />}
                          label={t("report.toolbar.marginVertical")}
                          value={marginY}
                          min={0}
                          max={140}
                          step={2}
                          suffix="px"
                          onChange={setMarginY}
                        />
                        <ControlSlider
                          icon={<Settings2 className="h-3.5 w-3.5" />}
                          label={t("report.toolbar.sectionGap")}
                          value={sectionGap}
                          min={0}
                          max={72}
                          step={2}
                          suffix="px"
                          onChange={setSectionGap}
                        />
                        <ControlSlider
                          icon={<ImageIcon className="h-3.5 w-3.5" />}
                          label={t("report.toolbar.imageGroupGap")}
                          value={imageGroupGap}
                          min={0}
                          max={120}
                          step={2}
                          suffix="px"
                          onChange={setImageGroupGap}
                        />
                        <ControlSlider
                          icon={<ImageIcon className="h-3.5 w-3.5" />}
                          label={t("report.toolbar.imageInnerGap")}
                          value={imageInnerGap}
                          min={0}
                          max={40}
                          step={2}
                          suffix="px"
                          onChange={setImageInnerGap}
                        />
                        <ControlSlider
                          icon={<ImageIcon className="h-3.5 w-3.5" />}
                          label={t("report.toolbar.assetImageWidth")}
                          value={assetImageWidth}
                          min={24}
                          max={100}
                          step={2}
                          suffix="%"
                          onChange={setAssetImageWidth}
                        />
                        <ControlSlider
                          icon={<ImageIcon className="h-3.5 w-3.5" />}
                          label={t("report.toolbar.actionImageWidth")}
                          value={valuationImageWidth}
                          min={40}
                          max={100}
                          step={2}
                          suffix="%"
                          onChange={setValuationImageWidth}
                        />
                        <ControlSlider
                          icon={<ImageIcon className="h-3.5 w-3.5" />}
                          label={t("report.toolbar.imageRadius")}
                          value={imageCornerRadius}
                          min={0}
                          max={24}
                          step={1}
                          suffix="px"
                          onChange={setImageCornerRadius}
                        />
                        <ControlSlider
                          icon={<ImageIcon className="h-3.5 w-3.5" />}
                          label={t("report.toolbar.imageShadow")}
                          value={imageShadow}
                          min={0}
                          max={4}
                          step={1}
                          onChange={setImageShadow}
                        />
                        <ControlSlider
                          icon={<FileText className="h-3.5 w-3.5" />}
                          label={t("report.toolbar.paragraphLineHeight")}
                          value={Math.round(paragraphLineHeight * 100)}
                          min={140}
                          max={220}
                          step={5}
                          suffix="%"
                          onChange={(v) => setParagraphLineHeight(v / 100)}
                        />
                        <ControlSlider
                          icon={<FileText className="h-3.5 w-3.5" />}
                          label={t("report.toolbar.headingScale")}
                          value={Math.round(headingScale * 100)}
                          min={85}
                          max={120}
                          step={5}
                          suffix="%"
                          onChange={(v) => setHeadingScale(v / 100)}
                        />
                      </div>
                    </div>
                  ) : (
                    <MvReportImagesControlPanel
                      projectId={projectId}
                      activeTab={settingsImagesTab}
                      onTabChange={setSettingsImagesTab}
                      assetFiles={selectedImages}
                      assetOrder={imageOrder}
                      assetWidthPercent={assetImageWidth}
                      assetImagesPerPage={assetImagesPerPage}
                      assetImagesPerRow={assetImagesPerRow}
                      assetImagesUniformSize={assetImagesUniformSize}
                      onAssetReorder={setImageOrder}
                      getAssetImageSrc={(file) => reportDriveFileImageSrc(projectId, file)}
                      onAssetWidthChange={setAssetImageWidth}
                      onAssetImagesPerPageChange={setAssetImagesPerPage}
                      onAssetImagesPerRowChange={(count) => {
                        const next = Math.min(20, Math.max(1, Math.round(count)));
                        setAssetImagesPerRow(next);
                        setAssetImageWidth(Math.round((100 / next) * 100) / 100);
                      }}
                      onAssetImagesUniformSizeChange={setAssetImagesUniformSize}
                      imageGroupGap={imageGroupGap}
                      imageInnerGap={imageInnerGap}
                      imageCornerRadius={imageCornerRadius}
                      imageShadow={imageShadow}
                      onImageGroupGapChange={setImageGroupGap}
                      onImageInnerGapChange={setImageInnerGap}
                      onImageCornerRadiusChange={setImageCornerRadius}
                      onImageShadowChange={setImageShadow}
                      onAssetPreview={() => setAssetImagesPreviewOpen(true)}
                      onManageAssetImages={() => navigate(`/machine-valuation/${projectId}/workflow/asset-images`)}
                      valuationImages={valuationAccountImages}
                      valuationOrder={valuationImageOrder}
                      onValuationReorder={reorderValuationImages}
                      onValuationWidthChange={updateValuationImageWidth}
                    />
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {showReportPreparationModal ? (
        <>
          {/* Full-screen frosted blur over the page chrome — keeps the
              workspace visible but signals that interaction should pause. */}
          <div
            className="mv-report-chrome fixed inset-0 z-[640] bg-white/45 backdrop-blur-md"
            aria-hidden
          />
          {/* Slim top toast with the loading state, mirroring the design
              language of the redesigned toolbar (small icon, compact pill). */}
          <div
            className="mv-report-chrome pointer-events-none fixed inset-x-0 top-14 z-[650] flex justify-center px-2 sm:top-20"
            role="status"
            aria-live="polite"
            aria-label={t("report.export.loadingReport")}
          >
            <div
              dir={dir}
              className="pointer-events-auto inline-flex w-auto max-w-[min(560px,calc(100%-1rem))] items-center gap-2 rounded-full border border-sky-200/80 bg-white/95 px-3 py-1.5 shadow-[0_8px_24px_rgba(12,68,124,0.16)] ring-1 ring-sky-100/70 backdrop-blur-md"
            >
              <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-sky-300/40" aria-hidden />
                <Loader2 className="relative h-3.5 w-3.5 animate-spin text-[#0C447C]" />
              </span>
              <p className="min-w-0 flex-1 truncate text-[11.5px] font-black text-slate-900">
                {t("report.loading.reportData")}
              </p>
              {reportMediaLoading ? (
                <span className="hidden shrink-0 rounded-full bg-sky-50 px-1.5 py-0.5 text-[9.5px] font-bold text-sky-900 sm:inline">
                  {t("report.loading.images")}
                </span>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {pdfExportProgress != null ? (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[660] border-t border-emerald-200/90 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.14)] backdrop-blur-md"
          role="status"
          aria-live="polite"
          aria-label={pdfExportLabel || t("report.export.downloading")}
        >
          <div className="ms-auto flex w-full max-w-3xl flex-col gap-2 text-right" dir={dir}>
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 flex-1 text-[12px] font-black text-slate-900">
                {pdfExportLabel || t("report.export.downloading")}
              </p>
              <p className="shrink-0 text-[11px] font-bold tabular-nums text-emerald-800" dir="ltr">
                {pdfExportProgress}%
              </p>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200/90" dir={dir}>
              <div
                className="absolute inset-y-0 right-0 rounded-full bg-emerald-700 transition-all duration-300"
                style={{ width: `${pdfExportProgress}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {isSimpleReport ? (
        <MvWordTemplateModal
          open={wordTemplateModalOpen}
          onOpenChange={setWordTemplateModalOpen}
          projectId={projectId}
          projectName={project?.name || "report"}
          displayNumber={project?.displayNumber}
          reportData={reportData}
          assetImageSources={wordTemplateAssetImageSources}
          valuationImageSources={wordTemplateValuationImageSources}
          clientImageSources={wordTemplateClientImageSources}
          onReportDataPatch={onReportDataPatch}
          onBeforeMerge={flushPendingReportDataForWord}
          disabled={loading || reportMediaLoading}
        />
      ) : null}

      <Dialog
        open={reportTemplatePreviewOption != null}
        onOpenChange={(open) => {
          if (!open) setReportTemplatePreviewId(null);
        }}
      >
        <MvDialogContent className="max-w-3xl rounded-2xl border-slate-200 p-0" dir={dir}>
          <DialogHeader className="border-b border-slate-100 bg-white px-4 py-3 pe-14 text-start">
            <DialogTitle className="text-base font-black text-slate-900">
              {reportTemplatePreviewOption?.title ?? t("report.toolbar.previewTemplate")}
            </DialogTitle>
          </DialogHeader>
          <div className="bg-slate-100 p-4">
            <div className="mx-auto aspect-[210/297] max-h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="relative h-full w-full bg-white">
                {reportTemplatePreviewOption ? (
                  <ReportTemplateArtwork
                    option={reportTemplatePreviewOption}
                    previewImage={
                      reportTemplatePreviewOption.usesAiTemplate
                        ? reportTemplatePreviewOption.aiTemplate?.coverImageDataUrl ||
                          reportTemplatePreviewOption.aiTemplate?.pageImageDataUrl ||
                          null
                        : reportTemplatePreviewOption.usesCompanyLetterhead
                        ? letterheadTemplate?.coverImageDataUrl ||
                          letterheadTemplate?.pageImageDataUrl ||
                          letterheadTemplate?.landscapePageImageDataUrl
                        : null
                    }
                    large
                  />
                ) : null}
              </div>
            </div>
            {reportTemplatePreviewOption?.description ? (
              <p className="mx-auto mt-3 max-w-xl text-center text-[12px] font-semibold leading-relaxed text-slate-600">
                {reportTemplatePreviewOption.description}
              </p>
            ) : null}
          </div>
        </MvDialogContent>
      </Dialog>

      <Dialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      >
        <MvDialogContent
          className="!fixed !inset-3 !left-3 !right-3 !top-3 !bottom-3 flex h-[calc(100dvh-1.5rem)] !max-h-none w-auto !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl border-slate-200/90 bg-gradient-to-b from-[#e8edf4] via-white to-[#f0f4fa] p-0 shadow-2xl ring-1 ring-slate-900/10 sm:!inset-5 sm:h-[calc(100dvh-2.5rem)]"
          dir={dir}
        >
          <DialogHeader className="flex shrink-0 flex-col gap-3 border-b border-[#0C447C]/10 bg-gradient-to-l from-white via-sky-50/30 to-[#e8f0fa] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-3.5">
            <div className="min-w-0 flex-1 text-right">
              <DialogTitle className="text-base font-black text-[#0a1f33] sm:text-lg">
                {t("report.preview.finalTitle")}
              </DialogTitle>
              <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-500">
                {t("report.preview.finalHint")}
              </p>
            </div>
            <MvReportExportMenu
              variant="preview"
              disabled={exportActionsDisabled}
              exportingFormat={exportingFormat}
              onExport={handleReportExport}
              className="self-end sm:self-auto"
            />
          </DialogHeader>
          <div
            ref={previewScrollRef}
            className="min-h-0 flex-1 overflow-auto overscroll-contain bg-[#cbd5e1]/25 p-3 sm:p-5"
          >
            <article
              ref={(el) => {
                previewReportRef.current = el;
              }}
              className="pointer-events-none mx-auto min-h-0 w-full bg-transparent pb-8 text-slate-950 [&_.mv-report-chrome]:!hidden"
              style={{ padding: `${marginY}px ${marginX}px` }}
              aria-label={t("report.preview.report")}
            >
              <ReportViewportFit
                scrollRef={previewScrollRef}
                gutterPx={Math.max(0, Math.round(marginX * 2))}
              >
                <MvValuationReportDocumentBody {...reportDocumentProps} />
              </ReportViewportFit>
            </article>
          </div>
        </MvDialogContent>
      </Dialog>
      <Dialog
        open={assetImagesPreviewOpen}
        onOpenChange={setAssetImagesPreviewOpen}
      >
        <MvDialogContent
          className="!fixed !inset-4 flex h-[calc(100dvh-2rem)] !max-h-none w-auto !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl border-slate-200/90 bg-gradient-to-b from-[#e8edf4] via-white to-[#f0f4fa] p-0 shadow-2xl sm:!inset-6 sm:h-[calc(100dvh-3rem)]"
          dir={dir}
        >
          <DialogHeader className="shrink-0 border-b border-[#0C447C]/10 bg-white px-4 py-3 text-right">
            <DialogTitle className="text-base font-black text-[#0a1f33]">{t("report.preview.assetImagesPage")}</DialogTitle>
          </DialogHeader>
          <div
            ref={assetImagesPreviewScrollRef}
            className="min-h-0 flex-1 overflow-auto overscroll-contain bg-[#cbd5e1]/25 p-3 sm:p-5"
          >
            <article
              ref={(el) => {
                assetImagesPreviewReportRef.current = el;
              }}
              className="mx-auto min-h-0 w-full bg-transparent pb-8 text-slate-950 [&_.mv-report-chrome]:!hidden"
              style={{ padding: `${marginY}px ${marginX}px` }}
              aria-label={t("report.preview.assetImagesPage")}
            >
              <ReportViewportFit
                scrollRef={assetImagesPreviewScrollRef}
                gutterPx={Math.max(0, Math.round(marginX * 2))}
              >
                <MvValuationReportDocumentBody {...reportDocumentProps} />
              </ReportViewportFit>
            </article>
          </div>
        </MvDialogContent>
      </Dialog>
      <ReportRichSelectionToolbar containerRef={reportPdfRef} enabled={!loading && !previewOpen && !assetImagesPreviewOpen} />
    </MvWorkflowPageFrame>
  );
}
