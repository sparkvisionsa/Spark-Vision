"use client";

import { Tajawal } from "next/font/google";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Download,
  Eye,
  FileText,
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
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  MvProjectReportHeader,
  readVisitedSimpleReportSteps,
  writeVisitedSimpleReportSteps,
} from "./mv-simple-report-navigation";
import type {
  MvDriveFile,
  MvProject,
  MvProjectReportData,
  MvReportPageOrientationPreference,
  MvReportEditableSection,
  MvSubProject,
  PicAssetImage,
} from "./types";
import {
  emptyValuationAccountingStore,
  mergeValuationAccountingStores,
  readValuationAccountingStore,
  valuationAccountingStoreForApi,
  writeValuationAccountingStore,
  type MvValuationAccountingImage,
  type MvValuationAccountingStore,
} from "./mv-valuation-accounting-store";
import { MvReportImagesControlPanel } from "./mv-report-images-control-panel";
import { mvAutoPdfDownloadStorageKey, postReportPdfExportToParent } from "./mv-home-routes";
import { useMvInPageNavigation } from "./mv-inpage-navigation";
import { MV_WORKFLOW_SESSION, readMvWorkflowSessionJson, writeMvWorkflowSessionJson } from "./mv-workflow-session-cache";
import { fetchWithRetry, mapWithConcurrency } from "./mv-concurrent-fetch";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { MvWorkflowPageFrame } from "./mv-workflow-page-frame";
import { ReportRichSelectionToolbar } from "./mv-report-rich-selection-toolbar";
import { MvValuationReportDocumentBody } from "./mv-valuation-report-document-body";
import {
  MV_DEFAULT_NARRATIVE_B1,
  MV_DEFAULT_NARRATIVE_B2,
  MV_DEFAULT_NARRATIVE_B3,
  MV_DEFAULT_NARRATIVE_B4,
} from "./mv-valuation-report-narrative-defaults";
import { MV_REPORT_SCROLL_ANCHOR_ORDER, MV_REPORT_TOC_ROWS } from "./mv-valuation-report-toc";

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
    [data-mv-report-sheet] * {
      -webkit-font-smoothing: antialiased !important;
    }
    [data-mv-report-sheet] img,
    [data-mv-report-sheet] picture img {
      image-rendering: auto !important;
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
 * دقة لقطة الشاشة لمخرجات PDF: أعلى scale يعني نصًا وألوانًا أوضح (وملفًا أكبر وحملًا أكبر على الذاكرة).
 * يُقيَّد عند ورق ضخمة جدًا بالبيكسل لتفادي تجاوز حد المتصفح/العملية.
 */
const REPORT_PDF_CAPTURE_SCALE_PORTRAIT = 3.05;
const REPORT_PDF_CAPTURE_SCALE_LANDSCAPE = 2.92;
/** ~١٢–٥٠ مليون بكسل تقليدياً آمِن على سطح المكتب الحديث */
const REPORT_PDF_CAPTURE_MAX_MEGAPIXELS = 48;

function resolveReportPdfCaptureScale(boxW: number, boxH: number, landscape: boolean): number {
  const preferred = landscape ? REPORT_PDF_CAPTURE_SCALE_LANDSCAPE : REPORT_PDF_CAPTURE_SCALE_PORTRAIT;
  const areaPixels = Math.max(1, boxW * boxH);
  const cap = Math.sqrt((REPORT_PDF_CAPTURE_MAX_MEGAPIXELS * 1_000_000) / areaPixels);
  const next = Math.max(1.65, Math.min(preferred, cap));
  return Math.round(next * 1000) / 1000;
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
    return url.origin === window.location.origin && url.pathname.includes("/files/") && url.pathname.endsWith("/download");
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

function reportDriveFileImageSrc(projectId: string, file: MvDriveFile) {
  const anyFile = file as MvDriveFile & { sourceUrl?: string };
  if (anyFile.sourceUrl) return anyFile.sourceUrl;
  return `/api/mv/projects/${projectId}/files/${file._id}/download`;
}

function reportValuationImageSrc(projectId: string, image: { dataUrl?: string; fileId?: string }) {
  if (image.dataUrl) return image.dataUrl;
  if (image.fileId) return `/api/mv/projects/${projectId}/files/${image.fileId}/download`;
  return "";
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

async function waitForReportImages(root: HTMLElement, timeoutMs = 12000) {
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
          if (typeof img.decode === "function") {
            try {
              await Promise.race([img.decode(), sleep(Math.min(timeoutMs, 2500))]);
            } catch {
              // Decode failures should not block capture; html2canvas can still render placeholders/fallbacks.
            }
          }
        })(),
    ),
  );
}

async function waitForReportStableLayout(root: HTMLElement, timeoutMs = 2600) {
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
          dir="rtl"
          className="inline-block align-top will-change-transform"
          style={{
            transform: `translateZ(0) scale(${layout.s})`,
            transformOrigin: "top left",
            backfaceVisibility: "hidden",
          }}
        >
          {children}
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

const MV_REPORT_NAV_GROUPS: Array<{
  title: string;
  anchor: ReportSectionId;
  icon: ReactNode;
  activeAnchors: string[];
}> = [
  {
    title: "أقسام الغلاف",
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
    title: "قسم رأي القيمة ومعدو التقرير",
    anchor: "mv-toc-24",
    icon: <FileText className="h-3 w-3" />,
    activeAnchors: ["mv-toc-24"],
  },
  {
    title: "قسم حسابات القيمة",
    anchor: "mv-annex-1",
    icon: <FileText className="h-3 w-3" />,
    activeAnchors: ["mv-annex-1"],
  },
  {
    title: "قسم صور الأصول",
    anchor: "mv-annex-2",
    icon: <ImageIcon className="h-3 w-3" />,
    activeAnchors: ["mv-annex-2"],
  },
  {
    title: "قسم ملفات أخرى",
    anchor: "mv-annex-3",
    icon: <FileText className="h-3 w-3" />,
    activeAnchors: ["mv-annex-3"],
  },
  {
    title: "قسم شهادة التسجيل",
    anchor: "mv-annex-sce",
    icon: <FileText className="h-3 w-3" />,
    activeAnchors: ["mv-annex-sce"],
  },
  {
    title: "صفحة الخاتمة",
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
  roleLabel: string;
  signatureImageDataUrl: string;
};

type PreparerFieldEdits = Record<string, { name: string; roleLabel: string }>;

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
      const o = v as { name?: unknown; roleLabel?: unknown };
      out[k] = {
        name: typeof o.name === "string" ? o.name : "",
        roleLabel: typeof o.roleLabel === "string" ? o.roleLabel : "",
      };
    }
    return out;
  }
  const legacy = bundle.signatureRows;
  if (!Array.isArray(legacy)) return {};
  const out: PreparerFieldEdits = {};
  for (const r of legacy) {
    if (!r || typeof r !== "object") continue;
    const o = r as { id?: unknown; name?: unknown; roleLabel?: unknown };
    const id = typeof o.id === "string" ? o.id : "";
    if (!id) continue;
    out[id] = {
      name: typeof o.name === "string" ? o.name : "",
      roleLabel: typeof o.roleLabel === "string" ? o.roleLabel : "",
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
      title: typeof s.title === "string" ? s.title : "قسم جديد",
      body: typeof s.body === "string" ? s.body : "",
      ...(typeof s.insertAfterAnchorId === "string" && s.insertAfterAnchorId.trim()
        ? { insertAfterAnchorId: s.insertAfterAnchorId.trim() }
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

function isReportDraftMode(data: MvProjectReportData | undefined | null) {
  return data?.reportPresentationDraft !== false;
}

function withDraftDefaultReportData(data: MvProjectReportData | undefined | null): MvProjectReportData {
  return {
    ...(data ?? {}),
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
          dir="rtl"
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
  assetImagesUniformSize: false,
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
  assetImagesUniformSize: false,
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
  const draftModeOverrideRef = useRef<boolean | null>(null);
  const [files, setFiles] = useState<MvDriveFile[]>(() => initialFiles);
  const [loading, setLoading] = useState(() => initialProject == null);
  const [reportMediaLoading, setReportMediaLoading] = useState(false);
  const [valuationAccountStore, setValuationAccountStore] =
    useState<MvValuationAccountingStore>(() => emptyValuationAccountingStore());
  const [companySignatories, setCompanySignatories] = useState<ReportSignatureRow[]>([]);
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
  const [preparerFieldEdits, setPreparerFieldEdits] = useState<PreparerFieldEdits>(() =>
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [assetImagesPreviewOpen, setAssetImagesPreviewOpen] = useState(false);
  const [reportImageCacheVersion, setReportImageCacheVersion] = useState(0);
  const reportImageWarmKeyRef = useRef("");
  const loadRunRef = useRef(0);
  const [reportSaving, setReportSaving] = useState(false);
  /** Toggles the right-side floating settings drawer (page metrics + images). */
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [settingsDrawerTab, setSettingsDrawerTab] = useState<"layout" | "images">("layout");
  const [settingsImagesTab, setSettingsImagesTab] = useState<"assets" | "valuation">("assets");
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
    const reportSessionProject = readMvWorkflowSessionJson<ValuationReportSessionBundle>(
      MV_WORKFLOW_SESSION.valuationReportWorkspace(projectId),
    )?.project;
    const summarySessionProject = readMvWorkflowSessionJson<{ project?: MvProject | null }>(
      MV_WORKFLOW_SESSION.projectSummary(projectId),
    )?.project;
    const hasFastProject = reportSessionProject != null || summarySessionProject != null || projectRef.current != null;
    if (!hasFastProject) setLoading(true);
    try {
      const projectSummaryUrl = `/api/mv/projects/${projectId}?picAssetMode=summary`;
      const projectRequest = fetch(projectSummaryUrl, { credentials: "include" });
      const filesRequest = fetch(`/api/mv/projects/${projectId}/asset-image-files`, {
        credentials: "include",
      }).catch(() => null);

      const projectRes = await projectRequest;
      if (runId !== loadRunRef.current) return;

      const projectPayload = projectRes.ok
        ? ((await projectRes.json()) as { project?: MvProject; subProjects?: MvSubProject[] })
        : null;
      if (runId !== loadRunRef.current) return;

      const fetchedProject = withDraftDefaultProject(projectPayload?.project ?? null);
      const previewSubs = Array.isArray(projectPayload?.subProjects) ? projectPayload!.subProjects! : [];
      const quickProject =
        projectRes.ok && fetchedProject
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

      const filesRes = await filesRequest;
      if (runId !== loadRunRef.current) return;
      const driveRowsRaw = filesRes?.ok
        ? ((await filesRes.json().catch(() => [])) as unknown)
        : [];
      const driveRows = Array.isArray(driveRowsRaw) ? (driveRowsRaw as MvDriveFile[]) : [];
      setFiles(driveRows);

      let picRows: (MvDriveFile & { sourceUrl?: string })[] = [];
      try {
        const photoSubs = previewSubs.filter((s) => Boolean(s.picAsset?._id));
        if (photoSubs.length > 0) {
          // Run sub-project detail fetches in parallel with high concurrency to
          // minimise the time before report images become available.
          const details = (
            await mapWithConcurrency(photoSubs, 8, async (s) => {
              const r = await fetchWithRetry(
                `/api/mv/projects/${projectId}/subprojects/${encodeURIComponent(s._id)}`,
                { credentials: "include" },
              );
              if (!r.ok) return null;
              return (await r.json()) as MvSubProject & { picAsset?: { images?: PicAssetImage[] } | null };
            })
          ).filter(
            (row): row is MvSubProject & { picAsset?: { images?: PicAssetImage[] } | null } => row != null,
          );
          picRows = details.flatMap((sub) => {
            const images = (sub.picAsset?.images ?? []) as PicAssetImage[];
            const mapped: ((MvDriveFile & { sourceUrl?: string }) | null)[] = images.map((im, idx) => {
              const isExternal = typeof (im as { url?: unknown }).url === "string";
              const url = isExternal ? String((im as { url: string }).url) : "";
              const fileId = "fileId" in (im as object) ? String((im as { fileId?: string }).fileId || "") : "";
              const sourceUrl = url || (fileId ? `/api/mv/projects/${projectId}/files/${fileId}/download` : "");
              if (!sourceUrl) return null;
              /** صور التطبيق في التقرير فقط عند التحديد الصريح في خطوة صور الأصول */
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
            });
            return mapped.filter((x): x is MvDriveFile & { sourceUrl?: string } => x != null);
          });
        }
      } catch {
        // ignore pic asset load failures; drive files still show
      }

      if (runId !== loadRunRef.current) return;
      setReportMediaLoading(false);
      const merged = [...driveRows, ...picRows];
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
      if (eagerSources.length > 0) {
        void preloadReportImageCache(eagerSources).then(() => {
          if (runId === loadRunRef.current) setReportImageCacheVersion((v) => v + 1);
        });
      }
      setProject((prev) => {
        const nextP =
          projectRes.ok && fetchedProject
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
          files: merged,
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
    } finally {
      if (runId === loadRunRef.current) {
        setLoading(false);
        setReportMediaLoading(false);
      }
    }
  }, [projectId, sessionKey]);

  useEffect(() => {
    void load();
  }, [load, projectId]);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

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

  useEffect(
    () => () => {
      if (reportDataPersistTimerRef.current) window.clearTimeout(reportDataPersistTimerRef.current);
    },
    [],
  );

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
          reportSignatoryRows?: Array<{
            id?: string;
            name?: string;
            roleLabel?: string;
            signatureImageDataUrl?: string;
          }>;
          reportDefaults?: {
            scope?: Record<string, string | undefined>;
            methodology?: Record<string, string | undefined>;
            assumptions?: Record<string, string | undefined>;
          } | null;
        };
        setCompanyBrand({
          name: typeof data.companyName === "string" ? data.companyName.trim() : "",
          logoSrc: resolveMvCompanyLogo(data.logoDataUrl),
        });
        const rows = Array.isArray(data.reportSignatoryRows) ? data.reportSignatoryRows : [];
        setCompanySignatories(
          rows.map((r) => ({
            id: typeof r.id === "string" && r.id ? r.id : newId(),
            name: typeof r.name === "string" ? r.name : "",
            roleLabel: typeof r.roleLabel === "string" ? r.roleLabel : "",
            signatureImageDataUrl:
              typeof r.signatureImageDataUrl === "string" && r.signatureImageDataUrl.startsWith("data:image/")
                ? r.signatureImageDataUrl
                : "",
          })),
        );
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
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const serverAccountingKey = useMemo(
    () => JSON.stringify(project?.valuationAccountingWorkspace ?? null),
    [project?.valuationAccountingWorkspace],
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
    setPdfExportLabel("جاري تجهيز التقرير للتنزيل…");
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
      setPdfExportLabel("تحميل صور التقرير…");
      await preloadReportImageCache(collectReportImageSources(root));
      setReportImageCacheVersion((v) => v + 1);
      await waitNextFrame();
      await waitNextFrame();
      primeReportImagesForCapture(root);
      await waitForReportImages(root);
      await waitForReportFonts();
      restoreCaptureLayout = prepareReportCaptureLayout(root);
      await waitNextFrame();
      await waitForReportStableLayout(root);
      primeReportImagesForCapture(root);
      await waitForReportImages(root);

      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const sheets = Array.from(root.querySelectorAll<HTMLElement>("[data-mv-report-sheet]"));
      if (sheets.length === 0) return;

      let pdf: import("jspdf").jsPDF | null = null;

      for (let i = 0; i < sheets.length; i++) {
        setPdfExportLabel(`تصدير الصفحة ${i + 1} من ${sheets.length}…`);
        setPdfExportProgress(15 + Math.round(((i + 0.35) / sheets.length) * 80));
        const el = sheets[i]!;
        const landscape = el.dataset.mvReportOrientation === "landscape";
        const orientation = landscape ? "l" : "p";
        const { w, h } = getSheetPixelBox(el);
        const scale = resolveReportPdfCaptureScale(w, h, landscape);

        const canvas = await html2canvas(el, {
          scale,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          width: w,
          height: h,
          windowWidth: w,
          windowHeight: h,
          imageTimeout: 30000,
          removeContainer: true,
          ignoreElements: (node) => (node as HTMLElement).classList?.contains("mv-report-chrome") ?? false,
          onclone: applyMvReportCaptureClone,
        });

        const imgData = canvas.toDataURL("image/png", 1);
        const pdfW = landscape ? 841.89 : 595.28;
        const pdfH = landscape ? 595.28 : 841.89;

        if (!pdf) {
          pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
        } else {
          pdf.addPage("a4", orientation);
        }

        pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH, undefined, "NONE");
        canvas.width = 1;
        canvas.height = 1;
      }

      if (pdf) {
        setPdfExportProgress(98);
        setPdfExportLabel("حفظ ملف PDF…");
        const safeName = (project?.name || "report").replace(/[\\/:*?"<>|]+/g, "-");
        pdf.save(`${safeName}-valuation-report.pdf`);
        setPdfExportProgress(100);
        exportOk = true;
        if (!hostedInIframe) {
          toast({ description: "تم تنزيل التقرير النهائي." });
        }
      }
    } catch (error) {
      if (!hostedInIframe) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "تعذر تصدير التقرير إلى PDF.",
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
  }, [loading, project?.name, projectId, reportMediaLoading, toast]);

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

  const updatePreparerField = useCallback(
    (id: string, field: "name" | "roleLabel", value: string) => {
      setPreparerFieldEdits((prev) => {
        const row = companySignatories.find((x) => x.id === id);
        const base = prev[id] ?? { name: row?.name ?? "", roleLabel: row?.roleLabel ?? "" };
        return {
          ...prev,
          [id]: { ...base, [field]: value },
        };
      });
    },
    [companySignatories],
  );

  const preparerDisplayRows = useMemo(() => {
    return companySignatories.map((s) => {
      const ed = preparerFieldEdits[s.id];
      if (!ed) return { ...s };
      return { ...s, name: ed.name, roleLabel: ed.roleLabel };
    });
  }, [companySignatories, preparerFieldEdits]);

  const reportImageSources = useMemo(() => {
    const sources: string[] = [];
    if (companyBrand.logoSrc) sources.push(companyBrand.logoSrc);
    for (const file of orderedImages) sources.push(reportDriveFileImageSrc(projectId, file));
    for (const image of orderedValuationImages) sources.push(reportValuationImageSrc(projectId, image));
    for (const row of preparerDisplayRows) {
      if (row.signatureImageDataUrl) sources.push(row.signatureImageDataUrl);
    }
    return sources.filter(Boolean);
  }, [companyBrand.logoSrc, orderedImages, orderedValuationImages, preparerDisplayRows, projectId]);

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
    if (user?.username?.trim()) lines.push(`المستخدم الحالي: ${user.username.trim()}`);
    if (profile?.email?.trim()) lines.push(`بريد: ${profile.email.trim()}`);
    if (profile?.phone?.trim()) lines.push(`هاتف: ${profile.phone.trim()}`);
    const creator = project?.createdByName?.trim();
    if (creator) lines.push(`منشئ المشروع: ${creator}`);
    if (lines.length === 0) lines.push("تقرير تقييم مهني — Spark Vision");
    return lines;
  }, [companyBrand.name, user?.username, profile?.email, profile?.phone, project?.createdByName]);

  const persistProjectReportData = useCallback(
    async (nextReportData: MvProjectReportData) => {
      const p = projectRef.current;
      if (!p?._id) return;
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
        if (!res.ok) return;
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
      } catch {
        /* ignore */
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
        const prevBundle = readMvWorkflowSessionJson<ValuationReportSessionBundle>(sessionKey) ?? {};
        writeMvWorkflowSessionJson(sessionKey, { ...prevBundle, project: next, fetchedAt: Date.now() });
        if (reportDataPersistTimerRef.current) window.clearTimeout(reportDataPersistTimerRef.current);
        reportDataPersistTimerRef.current = window.setTimeout(() => {
          reportDataPersistTimerRef.current = null;
          void persistProjectReportData(rd);
        }, 900);
        return next;
      });
    },
    [persistProjectReportData, sessionKey],
  );

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
      await persistProjectReportData(rd);
      toast({ description: "تم حفظ إعدادات التقرير في قاعدة البيانات." });
    } catch {
      toast({
        variant: "destructive",
        description: "تعذر حفظ إعدادات التقرير. حاول مرة أخرى.",
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

  const reportDocumentProps = {
    projectId,
    project,
    projectName,
    reportData,
    companyBrand,
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
    updatePreparerField,
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

  return (
    <MvWorkflowPageFrame
      className={cn("bg-[var(--color-background-primary)]", reportFont.className)}
      dir="rtl"
    >
      <MvProjectReportHeader
        compact
        projectId={projectId}
        project={project}
        activeStep="report-preview"
        breadcrumbs={[
          { label: projectName, href: `/machine-valuation/${projectId}/workflow/report-data` },
          { label: "إعداد التقرير" },
        ]}
      />

      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1920px] flex-1 flex-col overflow-hidden px-0.5 pb-1 pt-1 sm:px-1">
        {/* === Slim premium toolbar === */}
        <div
          className={cn(
            "mv-report-chrome mb-1.5 flex shrink-0 items-center gap-1 rounded-xl border border-slate-200/80 bg-white/95 px-1.5 py-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur",
            "sm:gap-1.5 sm:px-2",
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 shrink-0 rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#0C447C]",
              !navCollapsed && "bg-slate-100/70 text-[#0C447C]",
            )}
            title={navCollapsed ? "إظهار قائمة التنقل" : "إخفاء قائمة التنقل"}
            aria-label="قائمة الأقسام"
            aria-pressed={!navCollapsed}
            onClick={() => setNavCollapsed((v) => !v)}
          >
            <ListTree className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 shrink-0 rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#0C447C]",
              settingsDrawerOpen && "bg-slate-100/70 text-[#0C447C]",
            )}
            title="مقاسات وتنسيق الصفحة"
            aria-label="إعدادات التقرير"
            aria-pressed={settingsDrawerOpen}
            onClick={() => {
              setSettingsDrawerTab("layout");
              setSettingsDrawerOpen((v) => !v);
            }}
          >
            <Sliders className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 shrink-0 rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#0C447C]",
              settingsDrawerOpen && settingsDrawerTab === "images" && "bg-slate-100/70 text-[#0C447C]",
            )}
            title="ترتيب وحجم الصور"
            aria-label="إدارة الصور"
            onClick={() => {
              setSettingsDrawerTab("images");
              setSettingsImagesTab("assets");
              setSettingsDrawerOpen(true);
            }}
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </Button>

          <span className="hidden h-4 w-px bg-slate-200 sm:block" aria-hidden />

          <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
            <span
              className={cn(
                "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[9.5px] font-black",
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
              {draftMode ? "مسودة" : "نهائي"}
            </span>
            {loading ? (
              <span className="inline-flex h-5 items-center gap-1 rounded-full bg-slate-100 px-2 text-[9.5px] font-bold text-slate-700">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                تحديث البيانات
              </span>
            ) : reportMediaLoading ? (
              <span className="inline-flex h-5 items-center gap-1 rounded-full bg-sky-50 px-2 text-[9.5px] font-bold text-sky-900">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                تحميل الصور
              </span>
            ) : null}
          </div>

          <span className="ms-auto inline-flex sm:ms-0" />

          {/* Draft toggle: compact pill */}
          <button
            type="button"
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-[10.5px] font-black transition disabled:cursor-not-allowed disabled:opacity-60",
              draftMode
                ? "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
            )}
            disabled={loading}
            title={
              draftMode
                ? "وضع المسودة مفعل: علامة مائية وإخفاء التوقيعات."
                : "وضع المسودة مغلق: تظهر التوقيعات بدون علامة مائية."
            }
            onClick={toggleDraftMode}
            aria-pressed={draftMode}
          >
            <span
              className={cn(
                "relative h-3 w-6 rounded-full transition-colors",
                draftMode ? "bg-amber-500" : "bg-slate-300",
              )}
              aria-hidden
            >
              <span
                className={cn(
                  "absolute top-0.5 h-2 w-2 rounded-full bg-white shadow-sm transition-transform",
                  draftMode ? "-translate-x-[0.7rem]" : "translate-x-[-0.125rem]",
                )}
              />
            </span>
            <span className="hidden sm:inline">مسودة</span>
          </button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1 border-slate-200 bg-white px-2 text-[10.5px] font-bold text-slate-700 hover:bg-slate-50 hover:text-[#0C447C]"
            disabled={loading || reportMediaLoading}
            onClick={openReportPreview}
            title="معاينة بصيغة PDF قبل التنزيل"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">معاينة</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1 border-slate-200 bg-white px-2 text-[10.5px] font-bold text-slate-700 hover:bg-slate-50 hover:text-[#0C447C]"
            disabled={downloadingPdf || loading || reportMediaLoading}
            onClick={() => void downloadAsPdf()}
            title="تنزيل التقرير بصيغة PDF"
          >
            {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 shrink-0 gap-1 bg-emerald-700 px-2.5 text-[10.5px] font-black text-white shadow-sm hover:bg-emerald-800"
            disabled={reportSaving || loading}
            onClick={() => void saveReportSettingsNow()}
            title="حفظ التغييرات على التقرير"
          >
            {reportSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            حفظ
          </Button>
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
                      أقسام التقرير
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNavCollapsed(true)}
                    title="طي القائمة"
                    aria-label="طي قائمة التنقل"
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
                    title="فتح القائمة"
                    aria-label="فتح قائمة التنقل"
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
                {MV_REPORT_NAV_GROUPS.map((row) => (
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
                    أقسام إضافية
                  </p>
                ) : null}
                {editableSections.map((s) => (
                  <ReportTocItem
                    key={s.id}
                    active={activeSection === `custom:${s.id}`}
                    icon={<FileText className="h-3 w-3" />}
                    title={s.title.trim() || "قسم إضافي"}
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
                aria-label="إغلاق لوحة الإعدادات"
                onClick={() => setSettingsDrawerOpen(false)}
                className="mv-report-chrome fixed inset-0 z-[120] bg-slate-900/20 backdrop-blur-[1px] lg:hidden"
              />
              <div
                role="dialog"
                aria-label="إعدادات التقرير"
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
                    <span className="text-[11px] font-black text-slate-800">إعدادات التقرير</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettingsDrawerOpen(false)}
                    title="إغلاق"
                    aria-label="إغلاق"
                    className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="shrink-0 border-b border-slate-100 px-2 py-1.5">
                  <div className="flex gap-0.5 rounded-md bg-slate-100/70 p-0.5 ring-1 ring-slate-200/70">
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
                      مقاسات الصفحة
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
                      الصور
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
                  {settingsDrawerTab === "layout" ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-1.5">
                        <p className="text-[10px] font-bold text-slate-500">
                          عدّل المقاسات وفراغات الأقسام والصور.
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 px-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-100 hover:text-[#0C447C]"
                          title="إعادة المقاسات للافتراضي"
                          onClick={resetLayoutToDefaults}
                        >
                          <RotateCcw className="h-3 w-3" />
                          افتراضي
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        <ControlSlider
                          icon={<Ruler className="h-3.5 w-3.5" />}
                          label="هامش يمين/يسار"
                          value={marginX}
                          min={0}
                          max={120}
                          step={2}
                          suffix="px"
                          onChange={setMarginX}
                        />
                        <ControlSlider
                          icon={<Ruler className="h-3.5 w-3.5" />}
                          label="هامش أعلى/أسفل"
                          value={marginY}
                          min={0}
                          max={140}
                          step={2}
                          suffix="px"
                          onChange={setMarginY}
                        />
                        <ControlSlider
                          icon={<Settings2 className="h-3.5 w-3.5" />}
                          label="فراغ بين الأقسام"
                          value={sectionGap}
                          min={0}
                          max={72}
                          step={2}
                          suffix="px"
                          onChange={setSectionGap}
                        />
                        <ControlSlider
                          icon={<ImageIcon className="h-3.5 w-3.5" />}
                          label="فراغ مجموعات الصور"
                          value={imageGroupGap}
                          min={0}
                          max={120}
                          step={2}
                          suffix="px"
                          onChange={setImageGroupGap}
                        />
                        <ControlSlider
                          icon={<ImageIcon className="h-3.5 w-3.5" />}
                          label="فراغ بين صور المجموعة"
                          value={imageInnerGap}
                          min={0}
                          max={40}
                          step={2}
                          suffix="px"
                          onChange={setImageInnerGap}
                        />
                        <ControlSlider
                          icon={<ImageIcon className="h-3.5 w-3.5" />}
                          label="عرض صور الأصول"
                          value={assetImageWidth}
                          min={24}
                          max={100}
                          step={2}
                          suffix="%"
                          onChange={setAssetImageWidth}
                        />
                        <ControlSlider
                          icon={<ImageIcon className="h-3.5 w-3.5" />}
                          label="عرض صور الإجراءات"
                          value={valuationImageWidth}
                          min={40}
                          max={100}
                          step={2}
                          suffix="%"
                          onChange={setValuationImageWidth}
                        />
                        <ControlSlider
                          icon={<ImageIcon className="h-3.5 w-3.5" />}
                          label="استدارة حواف الصور"
                          value={imageCornerRadius}
                          min={0}
                          max={24}
                          step={1}
                          suffix="px"
                          onChange={setImageCornerRadius}
                        />
                        <ControlSlider
                          icon={<ImageIcon className="h-3.5 w-3.5" />}
                          label="ظل الصور"
                          value={imageShadow}
                          min={0}
                          max={4}
                          step={1}
                          onChange={setImageShadow}
                        />
                        <ControlSlider
                          icon={<FileText className="h-3.5 w-3.5" />}
                          label="ارتفاع السطر في الفقرات"
                          value={Math.round(paragraphLineHeight * 100)}
                          min={140}
                          max={220}
                          step={5}
                          suffix="%"
                          onChange={(v) => setParagraphLineHeight(v / 100)}
                        />
                        <ControlSlider
                          icon={<FileText className="h-3.5 w-3.5" />}
                          label="مقياس عناوين الأقسام"
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
            aria-label="جاري تحميل التقرير"
          >
            <div
              dir="rtl"
              className="pointer-events-auto inline-flex w-auto max-w-[min(560px,calc(100%-1rem))] items-center gap-2 rounded-full border border-sky-200/80 bg-white/95 px-3 py-1.5 shadow-[0_8px_24px_rgba(12,68,124,0.16)] ring-1 ring-sky-100/70 backdrop-blur-md"
            >
              <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-sky-300/40" aria-hidden />
                <Loader2 className="relative h-3.5 w-3.5 animate-spin text-[#0C447C]" />
              </span>
              <p className="min-w-0 flex-1 truncate text-[11.5px] font-black text-slate-900">
                جاري تحميل بيانات التقرير…
              </p>
              {reportMediaLoading ? (
                <span className="hidden shrink-0 rounded-full bg-sky-50 px-1.5 py-0.5 text-[9.5px] font-bold text-sky-900 sm:inline">
                  تحميل الصور
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
          aria-label={pdfExportLabel || "جاري تنزيل التقرير"}
        >
          <div className="ms-auto flex w-full max-w-3xl flex-col gap-2 text-right" dir="rtl">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 flex-1 text-[12px] font-black text-slate-900">
                {pdfExportLabel || "جاري تنزيل التقرير النهائي…"}
              </p>
              <p className="shrink-0 text-[11px] font-bold tabular-nums text-emerald-800" dir="ltr">
                {pdfExportProgress}%
              </p>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200/90" dir="rtl">
              <div
                className="absolute inset-y-0 right-0 rounded-full bg-emerald-700 transition-all duration-300"
                style={{ width: `${pdfExportProgress}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <Dialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      >
        <DialogContent
          className="!fixed !inset-3 !left-3 !right-3 !top-3 !bottom-3 flex h-[calc(100dvh-1.5rem)] !max-h-none w-auto !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl border-slate-200/90 bg-gradient-to-b from-[#e8edf4] via-white to-[#f0f4fa] p-0 shadow-2xl ring-1 ring-slate-900/10 sm:!inset-5 sm:h-[calc(100dvh-2.5rem)]"
          dir="rtl"
        >
          <DialogHeader className="relative shrink-0 border-b border-[#0C447C]/10 bg-gradient-to-l from-white via-sky-50/30 to-[#e8f0fa] px-4 py-3 pe-36 text-right sm:px-5 sm:py-3.5 sm:pe-40">
            <DialogTitle className="text-base font-black text-[#0a1f33] sm:text-lg">معاينة التقرير النهائية</DialogTitle>
            <p className="mt-1 text-[11px] font-semibold text-slate-500">
              نفس الشكل المُصدَّر كـ PDF — يتم التقاط كل صفحة بدقة أعلى من الشاشة الاعتيادية لخطوط أوضح وصور أقل ضبابية؛ حجم التنزيل قد يزيد قليلاً.
            </p>
            <Button
              type="button"
              size="sm"
              className="absolute left-4 top-3 h-8 gap-1.5 bg-[#0C447C] px-3 text-[11px] font-black text-white shadow-sm hover:bg-[#09345f] sm:left-5"
              disabled={downloadingPdf || loading || reportMediaLoading}
              onClick={() => void downloadAsPdf()}
              title="Download PDF"
            >
              {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              PDF
            </Button>
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
              aria-label="معاينة التقرير"
            >
              <ReportViewportFit
                scrollRef={previewScrollRef}
                gutterPx={Math.max(0, Math.round(marginX * 2))}
              >
                <MvValuationReportDocumentBody {...reportDocumentProps} />
              </ReportViewportFit>
            </article>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={assetImagesPreviewOpen}
        onOpenChange={setAssetImagesPreviewOpen}
      >
        <DialogContent
          className="!fixed !inset-4 flex h-[calc(100dvh-2rem)] !max-h-none w-auto !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-2xl border-slate-200/90 bg-gradient-to-b from-[#e8edf4] via-white to-[#f0f4fa] p-0 shadow-2xl sm:!inset-6 sm:h-[calc(100dvh-3rem)]"
          dir="rtl"
        >
          <DialogHeader className="shrink-0 border-b border-[#0C447C]/10 bg-white px-4 py-3 text-right">
            <DialogTitle className="text-base font-black text-[#0a1f33]">معاينة صفحة صور الأصول</DialogTitle>
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
              aria-label="معاينة صفحة صور الأصول"
            >
              <ReportViewportFit
                scrollRef={assetImagesPreviewScrollRef}
                gutterPx={Math.max(0, Math.round(marginX * 2))}
              >
                <MvValuationReportDocumentBody {...reportDocumentProps} />
              </ReportViewportFit>
            </article>
          </div>
        </DialogContent>
      </Dialog>
      <ReportRichSelectionToolbar containerRef={reportPdfRef} enabled={!loading && !previewOpen && !assetImagesPreviewOpen} />
    </MvWorkflowPageFrame>
  );
}
