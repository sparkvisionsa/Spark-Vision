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
  ChevronDown,
  ClipboardList,
  Eye,
  FileText,
  ImageIcon,
  Loader2,
  RotateCcw,
  Ruler,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  MvReportEditableSection,
  MvSubProject,
  PicAssetImage,
} from "./types";
import {
  emptyValuationAccountingStore,
  mergeValuationAccountingStores,
  readValuationAccountingStore,
  writeValuationAccountingStore,
  type MvValuationAccountingStore,
} from "./mv-valuation-accounting-store";
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
function getSheetPixelBox(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const w = Math.max(Math.ceil(rect.width), 1);
  const h = Math.max(Math.ceil(rect.height), 1);
  return { w, h };
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

const REPORT_IMAGE_DOWNLOAD_CONCURRENCY = 2;
const REPORT_IMAGE_RETRY_DELAYS_MS = [650, 1400, 2800, 5200];
const REPORT_READY_ANIMATION_SETTLE_MS = 160;
const REPORT_INITIAL_IMAGE_WAIT_MS = 900;
const REPORT_INITIAL_FONT_WAIT_MS = 700;
const REPORT_BACKGROUND_IMAGE_WARM_DELAY_MS = 1800;
const reportImageObjectUrlCache = new Map<string, string>();
const reportImagePromiseCache = new Map<string, Promise<string>>();

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function settleWithin<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: number | null = null;
  try {
    await Promise.race([
      promise.catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = window.setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timer != null) window.clearTimeout(timer);
  }
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

async function waitForReportFonts() {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  try {
    await document.fonts.ready;
  } catch {
    // Capturing can continue with fallback fonts if the browser refuses a font promise.
  }
}

async function waitForReportImages(root: HTMLElement, timeoutMs = 12000) {
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("img")).filter(
    (img) => img.src && !img.complete,
  );
  if (imgs.length === 0) return;
  await Promise.allSettled(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
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
        }),
    ),
  );
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
            transform: `scale(${layout.s})`,
            transformOrigin: "top left",
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
    }));
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
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-1.5 rounded-lg border px-2 py-1.5 text-right transition-colors duration-200",
        active
          ? "border-sky-300 bg-sky-50 text-sky-950"
          : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white",
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded",
          active ? "bg-sky-800 text-white" : "bg-slate-100 text-slate-500",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 truncate text-[11px] font-extrabold">{title}</span>
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
  suffix: string;
  onChange: (value: number) => void;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <label className="grid min-w-0 flex-1 gap-1 rounded-lg border border-slate-200/70 bg-white px-2 py-1.5 text-right shadow-sm transition hover:border-slate-300">
      <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
        <span className="text-sky-800 opacity-90 [&_svg]:h-3 [&_svg]:w-3">{icon}</span>
        <span className="min-w-0 truncate leading-tight">{label}</span>
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
          className="h-8 w-[3.25rem] shrink-0 rounded-lg border border-slate-200 bg-white px-1 text-center text-[11px] font-black tabular-nums text-sky-950 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-300"
        />
        <span className="w-8 shrink-0 text-center text-[10px] font-bold text-slate-500">{suffix}</span>
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
};

const defaultReportLayout: ReportLayoutPrefs = {
  marginX: 8,
  marginY: 32,
  sectionGap: 22,
  imageGroupGap: 12,
  imageInnerGap: 4,
  assetImageWidth: 32,
  valuationImageWidth: 86,
};

const legacyDefaultReportLayout: ReportLayoutPrefs = {
  marginX: 24,
  marginY: 48,
  sectionGap: 28,
  imageGroupGap: 12,
  imageInnerGap: 4,
  assetImageWidth: 32,
  valuationImageWidth: 86,
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
  };
  const isLegacyDefault = (Object.keys(legacyDefaultReportLayout) as (keyof ReportLayoutPrefs)[]).every(
    (key) => layout[key] === legacyDefaultReportLayout[key],
  );
  return isLegacyDefault ? { ...defaultReportLayout } : layout;
}

export default function MvValuationReportWorkspace({ projectId }: MvValuationReportWorkspaceProps) {
  const { navigate } = useMvInPageNavigation();
  const { user, profile } = useAuthTracking();
  const sessionKey = MV_WORKFLOW_SESSION.valuationReportWorkspace(projectId);
  const initialBundle = readMvWorkflowSessionJson<ValuationReportSessionBundle>(sessionKey);
  const initialLayout = readLayoutFromBundle(initialBundle ?? undefined);
  const [project, setProject] = useState<MvProject | null>(() => withDraftDefaultProject(initialBundle?.project));
  const projectRef = useRef<MvProject | null>(project);
  const reportDataPersistTimerRef = useRef<number | null>(null);
  const reportDataPersistRequestRef = useRef(0);
  const draftModeOverrideRef = useRef<boolean | null>(null);
  const [files, setFiles] = useState<MvDriveFile[]>(() => initialBundle?.files ?? []);
  const [loading, setLoading] = useState(() => initialBundle?.project == null);
  const [preparingReport, setPreparingReport] = useState(true);
  const [reportMediaLoading, setReportMediaLoading] = useState(false);
  const reportPreparationRunRef = useRef(0);
  const [valuationAccountStore, setValuationAccountStore] =
    useState<MvValuationAccountingStore>(() => emptyValuationAccountingStore());
  const [companySignatories, setCompanySignatories] = useState<ReportSignatureRow[]>([]);
  const [companyBrand, setCompanyBrand] = useState<{ name: string; logoSrc: string | null }>({
    name: "",
    logoSrc: null,
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
  const [imageOrder, setImageOrder] = useState<string[]>([]);
  const [hiddenImageIds, setHiddenImageIds] = useState<Set<string>>(() => new Set());
  const reportSectionsScrollRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const reportPdfRef = useRef<HTMLElement | null>(null);
  const previewReportRef = useRef<HTMLElement | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportImageCacheVersion, setReportImageCacheVersion] = useState(0);
  const reportImageWarmKeyRef = useRef("");
  const loadRunRef = useRef(0);
  const [layoutBarExpanded, setLayoutBarExpanded] = useState(true);

  const resetLayoutToDefaults = useCallback(() => {
    const d = defaultReportLayout;
    setMarginX(d.marginX);
    setMarginY(d.marginY);
    setSectionGap(d.sectionGap);
    setImageGroupGap(d.imageGroupGap);
    setImageInnerGap(d.imageInnerGap);
    setAssetImageWidth(d.assetImageWidth);
    setValuationImageWidth(d.valuationImageWidth);
  }, []);

  const load = useCallback(async () => {
    const runId = ++loadRunRef.current;
    const hasSession = readMvWorkflowSessionJson<ValuationReportSessionBundle>(
      MV_WORKFLOW_SESSION.valuationReportWorkspace(projectId),
    )?.project != null;
    if (!hasSession) setLoading(true);
    try {
      const [projectRes, filesRes, previewRes] = await Promise.all([
        fetch(`/api/mv/projects/${projectId}`, { credentials: "include" }),
        fetch(`/api/mv/projects/${projectId}/asset-image-files`, { credentials: "include" }),
        fetch(`/api/mv/projects/${projectId}?picAssetMode=summary`, { credentials: "include" }),
      ]);
      if (runId !== loadRunRef.current) return;

      const [projectData, driveRowsRaw, previewData] = await Promise.all([
        projectRes.ok ? (projectRes.json() as Promise<{ project?: MvProject }>) : Promise.resolve(null),
        filesRes.ok ? (filesRes.json() as Promise<MvDriveFile[]>) : Promise.resolve([] as MvDriveFile[]),
        previewRes.ok
          ? (previewRes.json() as Promise<{ subProjects?: MvSubProject[] }>)
          : Promise.resolve(null),
      ]);
      if (runId !== loadRunRef.current) return;

      const fetchedProject = withDraftDefaultProject(projectData?.project ?? null);
      const driveRows = Array.isArray(driveRowsRaw) ? driveRowsRaw : [];
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

      setFiles(driveRows);
      setProject((prev) => {
        const nextP = quickProject ?? prev;
        const prevBundle = readMvWorkflowSessionJson<ValuationReportSessionBundle>(sessionKey) ?? {};
        writeMvWorkflowSessionJson(sessionKey, {
          ...prevBundle,
          project: nextP,
          files: driveRows,
          fetchedAt: Date.now(),
        });
        return nextP;
      });
      setLoading(false);
      setReportMediaLoading(
        (Array.isArray(previewData?.subProjects) ? previewData!.subProjects! : []).some((s) => Boolean(s.picAsset?._id)),
      );

      let picRows: (MvDriveFile & { sourceUrl?: string })[] = [];
      try {
        const subs = Array.isArray(previewData?.subProjects) ? previewData!.subProjects! : [];
        const photoSubs = subs.filter((s) => Boolean(s.picAsset?._id));
        if (photoSubs.length > 0) {
          const details = (
            await mapWithConcurrency(photoSubs, 2, async (s) => {
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
  }, [loading, project?._id]);

  useEffect(
    () => () => {
      if (reportDataPersistTimerRef.current) window.clearTimeout(reportDataPersistTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (loading || !project) return;

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
      } catch {
        /* ignore */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, project?._id]);

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
      reportLayout: {
        marginX,
        marginY,
        sectionGap,
        imageGroupGap,
        imageInnerGap,
        assetImageWidth,
        valuationImageWidth,
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
    loading,
    sessionKey,
    marginX,
    marginY,
    sectionGap,
    imageGroupGap,
    imageInnerGap,
    assetImageWidth,
    valuationImageWidth,
  ]);

  const openReportPreview = useCallback(() => {
    if (loading || preparingReport || reportMediaLoading) return;
    setPreviewOpen(true);
  }, [loading, preparingReport, reportMediaLoading]);

  const downloadAsPdf = useCallback(async () => {
    if (loading || preparingReport || reportMediaLoading) return;
    setDownloadingPdf(true);
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

      await preloadReportImageCache(collectReportImageSources(root));
      setReportImageCacheVersion((v) => v + 1);
      await waitNextFrame();
      await waitNextFrame();
      await waitForReportImages(root);
      await waitForReportFonts();
      restoreCaptureLayout = prepareReportCaptureLayout(root);
      await waitNextFrame();
      await waitNextFrame();
      await waitForReportImages(root);
      await waitForReportFonts();

      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const sheets = Array.from(root.querySelectorAll<HTMLElement>("[data-mv-report-sheet]"));
      if (sheets.length === 0) return;

      let pdf: import("jspdf").jsPDF | null = null;

      for (let i = 0; i < sheets.length; i++) {
        const el = sheets[i]!;
        const landscape = el.dataset.mvReportOrientation === "landscape";
        const orientation = landscape ? "l" : "p";
        const scale = landscape ? 2.75 : 2.5;
        const { w, h } = getSheetPixelBox(el);

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
      }

      if (pdf) {
        const safeName = (project?.name || "report").replace(/[\\/:*?"<>|]+/g, "-");
        pdf.save(`${safeName}-valuation-report.pdf`);
      }
    } finally {
      restoreCaptureLayout?.();
      if (scrollEl) {
        scrollEl.scrollTop = prevTop;
        scrollEl.scrollLeft = prevLeft;
      }
      setDownloadingPdf(false);
    }
  }, [loading, preparingReport, project?.name, reportMediaLoading]);

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
    for (const image of valuationAccountImages) sources.push(reportValuationImageSrc(projectId, image));
    for (const row of preparerDisplayRows) {
      if (row.signatureImageDataUrl) sources.push(row.signatureImageDataUrl);
    }
    return sources.filter(Boolean);
  }, [companyBrand.logoSrc, orderedImages, preparerDisplayRows, projectId, valuationAccountImages]);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const runId = ++reportPreparationRunRef.current;
    let cancelled = false;

    if (loading || !project) {
      setPreparingReport(true);
      return () => {
        cancelled = true;
      };
    }

    setPreparingReport(true);

    void (async () => {
      await waitNextFrame();
      await waitNextFrame();
      if (cancelled || runId !== reportPreparationRunRef.current) return;

      const root = reportPdfRef.current;
      await Promise.all([
        settleWithin(waitForReportFonts(), REPORT_INITIAL_FONT_WAIT_MS),
        root
          ? settleWithin(waitForReportImages(root, REPORT_INITIAL_IMAGE_WAIT_MS), REPORT_INITIAL_IMAGE_WAIT_MS + 100)
          : Promise.resolve(),
      ]);
      await sleep(REPORT_READY_ANIMATION_SETTLE_MS);
      await waitNextFrame();

      if (!cancelled && runId === reportPreparationRunRef.current) {
        setPreparingReport(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    project?._id,
  ]);

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

  const addEditableSection = useCallback(() => {
    setEditableSections((list) => {
      const next = [...list, { id: newId(), title: "قسم جديد", body: "" }];
      onReportDataPatch({ reportEditableSections: next });
      return next;
    });
  }, [onReportDataPatch]);

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
    valuationAccountImages,
    resolveImageSrc: resolveReportImageSrc,
    moveImage,
    hideImage,
    navigate,
    editableSections,
    updateEditableSection,
    removeEditableSection,
    addEditableSection,
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

  const showReportPreparationModal = loading || preparingReport || downloadingPdf;

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

      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1920px] min-h-0 flex-1 flex-col overflow-hidden px-2 pb-2 pt-1.5 sm:px-3">
        <div className="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden lg:flex-row lg:items-stretch lg:gap-3">
        <aside
          className={cn(
            "flex w-full shrink-0 flex-col lg:h-full lg:min-h-0 lg:max-h-full lg:w-[200px] xl:w-[220px]",
            "max-h-[min(38vh,280px)] min-h-0 lg:max-h-none",
          )}
        >
          <div className="flex h-full max-h-[min(38vh,280px)] min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white lg:max-h-none lg:min-h-0 lg:flex-1">
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-2.5 py-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-900 text-white">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <p className="text-[11px] font-bold text-slate-800">التنقل</p>
            </div>

            <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-1.5 py-1.5">
              <ReportTocItem
                active={activeSection === "report-cover"}
                icon={<ClipboardList className="h-3 w-3" />}
                title="الغلاف"
                onClick={() => scrollToSection("report-cover")}
              />
              <ReportTocItem
                active={activeSection === "report-toc"}
                icon={<FileText className="h-3 w-3" />}
                title="الفهرس"
                onClick={() => scrollToSection("report-toc")}
              />
              <div className="rounded-lg border border-slate-100 bg-slate-50/50 px-1 py-1">
                <p className="px-1 pb-0.5 text-[9px] font-bold text-slate-500">أقسام التقرير</p>
                <div className="max-h-[min(30vh,220px)] space-y-0.5 overflow-y-auto overscroll-contain lg:max-h-[min(52vh,420px)]">
                  {MV_REPORT_TOC_ROWS.map((row) => (
                    <ReportTocItem
                      key={`${row.num}-${row.title}`}
                      active={activeSection === row.anchor}
                      icon={<span className="text-[8px] font-black tabular-nums">{row.num}</span>}
                      title={row.title}
                      onClick={() => scrollToSection(row.anchor)}
                    />
                  ))}
                </div>
              </div>
              {editableSections.map((s) => (
                <ReportTocItem
                  key={s.id}
                  active={activeSection === `custom:${s.id}`}
                  icon={<FileText className="h-3 w-3" />}
                  title={s.title.trim() || "قسم إضافي"}
                  onClick={() => scrollToSection(`custom:${s.id}`)}
                />
              ))}
            </nav>
          </div>
        </aside>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overscroll-none rounded-xl border border-slate-200/80 bg-slate-100/40 lg:min-h-0">
          <div
            className={cn(
              "mv-report-chrome sticky top-0 z-[120] shrink-0 border-b border-slate-200/70 bg-white/95 backdrop-blur-md supports-[backdrop-filter]:bg-white/90",
              loading ? "rounded-xl" : "rounded-t-xl",
            )}
          >
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100/90 px-2 py-1.5 sm:px-2.5">
              <button
                type="button"
                onClick={() => setLayoutBarExpanded((v) => !v)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-right transition hover:bg-slate-50"
                aria-expanded={layoutBarExpanded}
              >
                <span className="text-[11px] font-bold text-slate-700">مقاسات الصفحة</span>
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200", layoutBarExpanded && "rotate-180")}
                />
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-slate-600 hover:bg-slate-100 hover:text-sky-800"
                title="إعادة المقاسات للافتراضي"
                aria-label="إعادة المقاسات للافتراضي"
                onClick={resetLayoutToDefaults}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <button
                type="button"
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-2.5 text-[11px] font-black transition disabled:cursor-not-allowed disabled:opacity-60",
                  draftMode
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                    : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
                disabled={loading || preparingReport}
                title={
                  draftMode
                    ? "وضع المسودة مفعل: علامة مائية وإخفاء التوقيعات."
                    : "وضع المسودة مغلق: لا توجد علامة مائية وتظهر التوقيعات."
                }
                onClick={toggleDraftMode}
                aria-pressed={draftMode}
              >
                <span>مسودة</span>
                <span
                  className={cn(
                    "relative h-4 w-8 rounded-full transition-colors",
                    draftMode ? "bg-emerald-500" : "bg-slate-300",
                  )}
                  aria-hidden
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform",
                      draftMode ? "-translate-x-[0.95rem]" : "translate-x-[-0.125rem]",
                    )}
                  />
                </span>
              </button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 border-sky-200 bg-white px-2.5 text-[11px] font-bold text-sky-950 hover:bg-sky-50"
                disabled={loading || preparingReport || reportMediaLoading}
                onClick={openReportPreview}
              >
                <Eye className="h-3.5 w-3.5" />
                معاينة
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 border-slate-200 bg-white px-2.5 text-[11px] font-bold hover:bg-slate-50"
                disabled={downloadingPdf || loading || preparingReport || reportMediaLoading}
                onClick={() => void downloadAsPdf()}
              >
                {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                PDF
              </Button>
              {reportMediaLoading ? (
                <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-sky-50 px-2.5 text-[10px] font-bold text-sky-900">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  جاري تحميل صور التقرير
                </span>
              ) : null}
            </div>

            {layoutBarExpanded ? (
              <div className="p-2 sm:p-2.5">
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
                  <ControlSlider
                    icon={<Ruler className="h-3.5 w-3.5 text-sky-800" />}
                    label="هامش يمين/يسار"
                    value={marginX}
                    min={0}
                    max={120}
                    step={2}
                    suffix="px"
                    onChange={setMarginX}
                  />
                  <ControlSlider
                    icon={<Ruler className="h-3.5 w-3.5 text-sky-800" />}
                    label="هامش أعلى/أسفل"
                    value={marginY}
                    min={0}
                    max={140}
                    step={2}
                    suffix="px"
                    onChange={setMarginY}
                  />
                  <ControlSlider
                    icon={<Settings2 className="h-3.5 w-3.5 text-sky-800" />}
                    label="فراغ بين الأقسام"
                    value={sectionGap}
                    min={0}
                    max={72}
                    step={2}
                    suffix="px"
                    onChange={setSectionGap}
                  />
                  <ControlSlider
                    icon={<ImageIcon className="h-3.5 w-3.5 text-sky-800" />}
                    label="فراغ مجموعات الصور"
                    value={imageGroupGap}
                    min={0}
                    max={120}
                    step={2}
                    suffix="px"
                    onChange={setImageGroupGap}
                  />
                  <ControlSlider
                    icon={<ImageIcon className="h-3.5 w-3.5 text-sky-800" />}
                    label="فراغ بين صور المجموعة"
                    value={imageInnerGap}
                    min={0}
                    max={40}
                    step={2}
                    suffix="px"
                    onChange={setImageInnerGap}
                  />
                  <ControlSlider
                    icon={<ImageIcon className="h-3.5 w-3.5 text-sky-800" />}
                    label="عرض صور الأصول"
                    value={assetImageWidth}
                    min={24}
                    max={100}
                    step={2}
                    suffix="%"
                    onChange={setAssetImageWidth}
                  />
                  <ControlSlider
                    icon={<ImageIcon className="h-3.5 w-3.5 text-sky-800" />}
                    label="عرض صور الإجراءات"
                    value={valuationImageWidth}
                    min={40}
                    max={100}
                    step={2}
                    suffix="%"
                    onChange={setValuationImageWidth}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div
            ref={reportSectionsScrollRef}
            className={cn(
              "min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [overflow-anchor:none]",
              "touch-pan-y [-webkit-overflow-scrolling:touch]",
              loading ? "rounded-xl border border-slate-200 bg-white" : "rounded-b-xl bg-[#e2e8f0]/55",
            )}
          >
            <article
              ref={(el) => {
                reportPdfRef.current = el;
              }}
              className={cn(
                "mx-auto min-h-0 w-full bg-transparent pb-8 text-slate-950",
                loading && "shadow-none",
              )}
              style={{
                padding: loading ? undefined : `${marginY}px ${marginX}px`,
              }}
            >
            {loading ? (
              <div className="flex min-h-[min(560px,60vh)] items-center justify-center text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <ReportViewportFit
                scrollRef={reportSectionsScrollRef}
                gutterPx={Math.max(0, Math.round(marginX * 2))}
              >
                <MvValuationReportDocumentBody {...reportDocumentProps} />
              </ReportViewportFit>
            )}
          </article>
          </div>
        </main>
        </div>
      </div>

      {showReportPreparationModal ? (
        <div
          className="fixed inset-0 z-[650] flex items-center justify-center bg-slate-950/15 px-4 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-label="جاري إعداد التقرير النهائي"
        >
          <div className="flex min-w-[240px] items-center justify-center gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-right shadow-2xl shadow-slate-950/15 ring-1 ring-white/70">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-[#0C447C]" />
            <span className="text-[13px] font-black text-slate-900">جاري إعداد التقرير النهائي</span>
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
          <DialogHeader className="shrink-0 border-b border-[#0C447C]/10 bg-gradient-to-l from-white via-sky-50/30 to-[#e8f0fa] px-4 py-3 text-right sm:px-5 sm:py-3.5">
            <DialogTitle className="text-base font-black text-[#0a1f33] sm:text-lg">معاينة التقرير النهائية</DialogTitle>
            <p className="mt-1 text-[11px] font-semibold text-slate-500">نفس الشكل الذي سيتم تنزيله بصيغة PDF</p>
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
                gutterPx={Math.max(24, Math.round(marginX * 2))}
              >
                <MvValuationReportDocumentBody {...reportDocumentProps} />
              </ReportViewportFit>
            </article>
          </div>
        </DialogContent>
      </Dialog>
      <ReportRichSelectionToolbar containerRef={reportPdfRef} enabled={!loading && !preparingReport && !previewOpen} />
    </MvWorkflowPageFrame>
  );
}
