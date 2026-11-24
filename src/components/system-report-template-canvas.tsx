"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignLeft,
  AlignRight,
  BringToFront,
  Check,
  Copy,
  Database,
  Eye,
  EyeOff,
  ImagePlus,
  Layers3,
  Lock,
  LockOpen,
  Magnet,
  Maximize2,
  Plus,
  SendToBack,
  Shapes,
  Search,
  Trash2,
  Type,
  ZoomIn,
  ZoomOut,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  interpolateTemplateText,
  TEMPLATE_VARIABLE_PATTERN,
  templateVariableToken,
  TemplateVariableSelect,
  type TemplateVariableOption,
  useTemplateVariables,
} from "@/components/system-template-variables";
import { cn } from "@/lib/utils";
import type {
  MvCompanyReportSystemTemplateDefinition,
  MvCompanyReportTemplateCanvasBinding,
  MvCompanyReportTemplateCanvasElement,
  MvCompanyReportTemplateCanvasPage,
  MvCompanyReportTemplateCanvasShape,
} from "@/components/workspace/workspace-sections/machine-valuation/types";
import {
  REPORT_BODY_CONTENT_FOOTER_GAP_PX,
  resolveReportInteriorFrameMm,
} from "@/components/workspace/workspace-sections/machine-valuation/mv-report-page-metrics";

const CANVAS_IMAGE_MAX_BYTES = 3_000_000;
const MIN_ELEMENT_SIZE = 2;
const CANVAS_REFERENCE_WIDTH_PX = 794;
const ZOOM_LEVELS = [0.5, 0.67, 0.8, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
const ZOOM_MIN = ZOOM_LEVELS[0]!;
const ZOOM_MAX = ZOOM_LEVELS[ZOOM_LEVELS.length - 1]!;
const A4_ASPECT = 210 / 297;
/** Multiple diagonal lines (both directions) inside the selected element's box. */
const ELEMENT_HATCH = "repeating-linear-gradient(45deg, rgba(14,165,233,0.45) 0 1px, transparent 1px 7px), repeating-linear-gradient(-45deg, rgba(14,165,233,0.25) 0 1px, transparent 1px 7px), linear-gradient(rgba(14,165,233,0.06), rgba(14,165,233,0.06))";

function canvasId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function stepZoom(zoom: number, direction: 1 | -1) {
  if (direction > 0) return ZOOM_LEVELS.find((level) => level > zoom + 0.001) ?? ZOOM_MAX;
  return [...ZOOM_LEVELS].reverse().find((level) => level < zoom - 0.001) ?? ZOOM_MIN;
}

/**
 * Scrollable viewport that zooms the whole page area (not a lens): at 100% the
 * page fits the box; zooming in enlarges the page itself and scrollbars appear
 * horizontally and vertically. Ctrl/⌘ + wheel zooms around the cursor.
 */
function ZoomViewport({
  zoom,
  onZoomChange,
  aspect = A4_ASPECT,
  padding = 6,
  className,
  surfaceRef,
  surfaceClassName,
  surfaceStyle,
  surfaceProps,
  testId,
  children,
}: {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  aspect?: number;
  padding?: number;
  className?: string;
  surfaceRef?: React.Ref<HTMLDivElement>;
  surfaceClassName?: string;
  surfaceStyle?: CSSProperties;
  surfaceProps?: React.HTMLAttributes<HTMLDivElement> & { "data-testid"?: string };
  testId?: string;
  children: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<{ fx: number; fy: number; cx: number; cy: number } | null>(null);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const requestZoom = useCallback((next: number, clientX?: number, clientY?: number) => {
    const host = hostRef.current;
    const value = clamp(Math.round(next * 100) / 100, ZOOM_MIN, ZOOM_MAX);
    if (!host || value === zoomRef.current) return;
    const rect = host.getBoundingClientRect();
    const cx = clientX === undefined ? host.clientWidth / 2 : clientX - rect.left;
    const cy = clientY === undefined ? host.clientHeight / 2 : clientY - rect.top;
    anchorRef.current = {
      fx: (host.scrollLeft + cx) / Math.max(1, host.scrollWidth),
      fy: (host.scrollTop + cy) / Math.max(1, host.scrollHeight),
      cx,
      cy,
    };
    onZoomChange(value);
  }, [onZoomChange]);

  // Button zoom keeps the visible centre fixed; wheel zoom keeps the cursor point fixed.
  const lastZoomRef = useRef(zoom);
  useLayoutEffect(() => {
    const host = hostRef.current;
    const previous = lastZoomRef.current;
    lastZoomRef.current = zoom;
    if (!host || previous === zoom) return;
    const anchor = anchorRef.current ?? {
      fx: (host.scrollLeft + host.clientWidth / 2) / Math.max(1, host.scrollWidth * (previous / zoom)),
      fy: (host.scrollTop + host.clientHeight / 2) / Math.max(1, host.scrollHeight * (previous / zoom)),
      cx: host.clientWidth / 2,
      cy: host.clientHeight / 2,
    };
    anchorRef.current = null;
    host.scrollLeft = anchor.fx * host.scrollWidth - anchor.cx;
    host.scrollTop = anchor.fy * host.scrollHeight - anchor.cy;
  }, [zoom]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      requestZoom(zoomRef.current * (event.deltaY < 0 ? 1.1 : 1 / 1.1), event.clientX, event.clientY);
    };
    host.addEventListener("wheel", handleWheel, { passive: false });
    return () => host.removeEventListener("wheel", handleWheel);
  }, [requestZoom]);

  // Sized in pure CSS (container units of the scroll box) so the page follows
  // layout changes in the same frame — no measuring lag.
  const fitWidth = `min(100cqw - ${padding * 2}px, (100cqh - ${padding * 2}px) * ${aspect})`;
  const width = `max(0px, calc(${fitWidth} * ${zoom}))`;
  const height = `max(0px, calc(${fitWidth} * ${zoom / aspect}))`;

  return (
    <div ref={hostRef} dir="ltr" className={cn("relative min-h-0 min-w-0 overflow-auto overscroll-contain [container-type:size]", className)} data-testid={testId} data-zoom={zoom}>
      <div className="flex min-h-full min-w-full items-center justify-center" style={{ width: "max-content", height: "max-content", padding }}>
        <div
          {...surfaceProps}
          ref={surfaceRef}
          dir="rtl"
          className={cn("relative shrink-0", surfaceClassName)}
          style={{ ...surfaceStyle, width, height }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function ZoomControls({
  zoom,
  onZoomChange,
  scope,
  className,
}: {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  scope: string;
  className?: string;
}) {
  const button = "flex h-full w-7 items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-[#0C447C] disabled:opacity-35 disabled:hover:bg-transparent";
  return (
    <div className={cn("inline-flex h-7 items-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm", className)} dir="ltr">
      <button type="button" className={button} aria-label={`تصغير ${scope}`} title="تصغير" disabled={zoom <= ZOOM_MIN} onClick={() => onZoomChange(stepZoom(zoom, -1))}><ZoomOut className="h-3.5 w-3.5" /></button>
      <button type="button" className="h-full min-w-[44px] border-x border-slate-200 px-1 text-[10px] font-black tabular-nums text-slate-700 hover:bg-slate-100" aria-label={`ملاءمة ${scope}`} title="ملاءمة الصفحة" onClick={() => onZoomChange(1)}>{Math.round(zoom * 100)}%</button>
      <button type="button" className={button} aria-label={`تكبير ${scope}`} title="تكبير" disabled={zoom >= ZOOM_MAX} onClick={() => onZoomChange(stepZoom(zoom, 1))}><ZoomIn className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function snap(value: number, enabled: boolean) {
  return enabled ? Math.round(value / 2) * 2 : Math.round(value * 10) / 10;
}

const FOOTER_BINDINGS: MvCompanyReportTemplateCanvasBinding[] = [
  "commercialRegistration",
  "companyManagerName",
  "companyManagerMembership",
  "reportReference",
];

const ARABIC_DIGITS = /[\u0660-\u0669\u06F0-\u06F9]/g;

/**
 * Formats the report date as `2026/08/02 م` (year/month/day, Gregorian).
 * Accepts ISO dates and `dd/mm/yyyy` values (with or without "م"); any other
 * value (e.g. a Hijri date) is returned unchanged.
 */
export function formatTemplateReportDate(value: string | null | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw || raw === "—") return undefined;
  if (/ه/.test(raw)) return raw;
  const normalized = raw
    .replace(ARABIC_DIGITS, (digit) => String((digit.charCodeAt(0) & 0xf) % 10))
    .replace(/[\u200e\u200f\u061c]/g, "")
    .replace(/\s*م\s*$/, "")
    .trim();
  let year: string | undefined;
  let month: string | undefined;
  let day: string | undefined;
  const ymd = normalized.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:T[\d:.]+Z?)?$/);
  const dmy = normalized.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (ymd) [, year, month, day] = ymd;
  else if (dmy) [, day, month, year] = dmy;
  if (!year || !month || !day) return raw;
  return `${year}/${month.padStart(2, "0")}/${day.padStart(2, "0")} م`;
}

/** Report-date field content: "تاريخ التقرير 2026/08/02 م". */
export function templateReportDateLabel(value: string | null | undefined): ReactNode {
  const formatted = formatTemplateReportDate(value);
  if (!formatted) return undefined;
  return <>تاريخ التقرير <span className="whitespace-nowrap"><bdi dir="ltr">{formatted.replace(/ م$/, "")}</bdi> م</span></>;
}

function defaultFooterCanvasElements(page: "cover" | "interior"): MvCompanyReportTemplateCanvasElement[] {
  const labels: Array<[MvCompanyReportTemplateCanvasBinding, string]> = [
    ["commercialRegistration", "السجل التجاري"],
    ["companyManagerName", "مدير الشركة"],
    ["companyManagerMembership", "رقم العضوية"],
    ["reportReference", "الرقم المرجعي"],
    ...(page === "cover" ? [["reportDate", "تاريخ التقرير"] as [MvCompanyReportTemplateCanvasBinding, string]] : []),
  ];
  const cover = page === "cover";
  return labels.map(([binding, name], index) => ({
    id: `${page}-footer-${binding}`,
    name,
    page,
    kind: "binding",
    binding,
    x: cover ? 2.5 + index * 19.2 : 4 + index * 23.5,
    y: cover ? 91.4 : 94.2,
    width: cover ? 17.8 : 21,
    height: page === "cover" ? 6 : 5,
    rotation: 0,
    zIndex: 30,
    opacity: 1,
    color: page === "cover" ? "#FFFFFF" : "#334155",
    fontSize: 14,
    fontWeight: 700,
    textAlign: "center",
  }));
}

export function defaultSystemTemplateCanvasElements(): MvCompanyReportTemplateCanvasElement[] {
  return [
    {
      id: "cover-logo",
      name: "شعار الشركة",
      page: "cover",
      kind: "logo",
      x: 37,
      y: 10,
      width: 26,
      height: 12,
      rotation: 0,
      zIndex: 20,
      opacity: 1,
    },
    {
      id: "cover-company-name",
      name: "اسم الشركة",
      page: "cover",
      kind: "binding",
      binding: "companyName",
      x: 14,
      y: 24,
      width: 72,
      height: 7,
      rotation: 0,
      zIndex: 20,
      opacity: 1,
      color: "#FFFFFF",
      fontSize: 20,
      fontWeight: 800,
      textAlign: "center",
    },
    {
      id: "cover-accent-line",
      name: "خط التمييز",
      page: "cover",
      kind: "shape",
      x: 33,
      y: 35,
      width: 34,
      height: 0.7,
      rotation: 0,
      zIndex: 10,
      opacity: 1,
      backgroundColor: "#C9A227",
      borderRadius: 10,
    },
    {
      id: "cover-report-title",
      name: "عنوان التقرير",
      page: "cover",
      kind: "binding",
      binding: "reportTitle",
      x: 8,
      y: 43,
      width: 84,
      height: 12,
      rotation: 0,
      zIndex: 20,
      opacity: 1,
      color: "#FFFFFF",
      fontSize: 32,
      fontWeight: 900,
      textAlign: "center",
    },
    {
      id: "cover-client-name",
      name: "اسم العميل",
      page: "cover",
      kind: "binding",
      binding: "clientName",
      x: 14,
      y: 58,
      width: 72,
      height: 8,
      rotation: 0,
      zIndex: 20,
      opacity: 1,
      color: "#FFFFFF",
      fontSize: 20,
      fontWeight: 700,
      textAlign: "center",
    },
    ...defaultFooterCanvasElements("cover"),
    {
      id: "interior-logo",
      name: "شعار الترويسة",
      page: "interior",
      kind: "logo",
      x: 79,
      y: 1.4,
      width: 15,
      height: 5.2,
      rotation: 0,
      zIndex: 30,
      opacity: 1,
    },
    {
      id: "interior-company-name",
      name: "اسم الشركة في الترويسة",
      page: "interior",
      kind: "binding",
      binding: "companyName",
      x: 6,
      y: 2,
      width: 70,
      height: 4,
      rotation: 0,
      zIndex: 30,
      opacity: 1,
      color: "#0C447C",
      fontSize: 18,
      fontWeight: 800,
      textAlign: "right",
    },
    ...defaultFooterCanvasElements("interior"),
    {
      id: "closing-logo",
      name: "شعار الخاتمة",
      page: "closing",
      kind: "logo",
      x: 38,
      y: 16,
      width: 24,
      height: 11,
      rotation: 0,
      zIndex: 20,
      opacity: 1,
    },
    {
      id: "closing-content",
      name: "نص الخاتمة",
      page: "closing",
      kind: "binding",
      binding: "reportContent",
      x: 12,
      y: 38,
      width: 76,
      height: 24,
      rotation: 0,
      zIndex: 20,
      opacity: 1,
      color: "#FFFFFF",
      fontSize: 22,
      fontWeight: 800,
      textAlign: "center",
    },
    {
      id: "closing-footer",
      name: "بيانات أسفل الخاتمة",
      page: "closing",
      kind: "binding",
      binding: "footerContent",
      x: 5,
      y: 90,
      width: 90,
      height: 7,
      rotation: 0,
      zIndex: 30,
      opacity: 1,
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: 700,
      textAlign: "center",
    },
  ];
}

export type SystemTemplateCanvasBindings = {
  logoSrc?: string | null;
  companyName?: ReactNode;
  reportContent?: ReactNode;
  footerContent?: ReactNode;
  reportTitle?: ReactNode;
  clientName?: ReactNode;
  commercialRegistration?: ReactNode;
  companyManagerName?: ReactNode;
  companyManagerMembership?: ReactNode;
  reportReference?: ReactNode;
  reportDate?: ReactNode;
};

const DATA_FIELDS: Array<{ binding: MvCompanyReportTemplateCanvasBinding; label: string; group: string }> = [
  { binding: "reportTitle", label: "عنوان التقرير", group: "بيانات التقرير" },
  { binding: "clientName", label: "اسم العميل", group: "بيانات التقرير" },
  { binding: "reportReference", label: "الرقم المرجعي للتقرير", group: "بيانات التقرير" },
  { binding: "reportDate", label: "تاريخ التقرير", group: "بيانات التقرير" },
  { binding: "companyName", label: "اسم الشركة", group: "بيانات الشركة" },
  { binding: "commercialRegistration", label: "السجل التجاري للشركة", group: "بيانات الشركة" },
  { binding: "companyManagerName", label: "اسم مدير الشركة", group: "بيانات الشركة" },
  { binding: "companyManagerMembership", label: "رقم عضوية مدير الشركة", group: "بيانات الشركة" },
];

const SHAPES: Array<{ type: MvCompanyReportTemplateCanvasShape; label: string; previewClass: string }> = [
  { type: "rectangle", label: "مستطيل", previewClass: "rounded-sm" },
  { type: "rounded", label: "مستطيل دائري", previewClass: "rounded-lg" },
  { type: "circle", label: "دائرة", previewClass: "rounded-full" },
  { type: "pill", label: "كبسولة", previewClass: "rounded-full scale-y-50" },
  { type: "line", label: "خط", previewClass: "h-1 rounded-full" },
  { type: "triangle", label: "مثلث", previewClass: "[clip-path:polygon(50%_0,100%_100%,0_100%)]" },
  { type: "diamond", label: "معيّن", previewClass: "rotate-45 scale-75" },
  { type: "hexagon", label: "سداسي", previewClass: "[clip-path:polygon(25%_0,75%_0,100%_50%,75%_100%,25%_100%,0_50%)]" },
  { type: "star", label: "نجمة", previewClass: "[clip-path:polygon(50%_0,61%_35%,98%_35%,68%_57%,79%_92%,50%_70%,21%_92%,32%_57%,2%_35%,39%_35%)]" },
  { type: "arrow", label: "سهم", previewClass: "[clip-path:polygon(0_30%,65%_30%,65%_0,100%_50%,65%_100%,65%_70%,0_70%)]" },
  { type: "chevron", label: "شيفرون", previewClass: "[clip-path:polygon(0_0,65%_0,100%_50%,65%_100%,0_100%,35%_50%)]" },
  { type: "speech", label: "فقاعة نص", previewClass: "[clip-path:polygon(0_0,100%_0,100%_78%,35%_78%,20%_100%,20%_78%,0_78%)]" },
];

function shapeClipPath(shapeType?: MvCompanyReportTemplateCanvasShape) {
  switch (shapeType) {
    case "triangle": return "polygon(50% 0, 100% 100%, 0 100%)";
    case "diamond": return "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)";
    case "hexagon": return "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)";
    case "star": return "polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 92%, 50% 70%, 21% 92%, 32% 57%, 2% 35%, 39% 35%)";
    case "arrow": return "polygon(0 30%, 65% 30%, 65% 0, 100% 50%, 65% 100%, 65% 70%, 0 70%)";
    case "chevron": return "polygon(0 0, 65% 0, 100% 50%, 65% 100%, 0 100%, 35% 50%)";
    case "speech": return "polygon(0 0, 100% 0, 100% 78%, 35% 78%, 20% 100%, 20% 78%, 0 78%)";
    default: return undefined;
  }
}

function elementStyle(element: MvCompanyReportTemplateCanvasElement): CSSProperties {
  const logicalFontSize = element.fontSize ?? ((element.kind === "text" || element.kind === "binding") ? 16 : undefined);
  return {
    position: "absolute",
    left: `${element.x}%`,
    top: `${element.y}%`,
    width: `${element.width}%`,
    height: `${element.height}%`,
    zIndex: element.zIndex,
    opacity: element.opacity,
    transform: `rotate(${element.rotation}deg)`,
    transformOrigin: "center",
    color: element.color,
    backgroundColor: element.backgroundColor,
    borderColor: element.borderColor,
    borderWidth: element.borderWidth,
    borderStyle: element.borderWidth ? "solid" : undefined,
    borderRadius: element.borderRadius,
    fontFamily: element.fontFamily,
    // Canvas text is authored against the A4 short edge. `cqmin` equals the page
    // width on portrait sheets and the page height on landscape sheets, so text
    // keeps its physical size in the editor, previews, report and PDF export.
    fontSize: logicalFontSize === undefined ? undefined : `${(logicalFontSize / CANVAS_REFERENCE_WIDTH_PX) * 100}cqmin`,
    lineHeight: 1.25,
    fontWeight: element.fontWeight,
    textAlign: element.textAlign,
    clipPath: element.kind === "shape" ? shapeClipPath(element.shapeType) : undefined,
    ...(element.kind === "shape" && element.shapeType === "circle" ? { borderRadius: "50%" } : {}),
    ...(element.kind === "shape" && element.shapeType === "pill" ? { borderRadius: 9999 } : {}),
  };
}

function CanvasTextFrame({ children, preserveWhitespace = false }: { children: ReactNode; preserveWhitespace?: boolean }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;
    let animationFrame = 0;

    const fit = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        content.style.fontSize = "1em";
        const availableWidth = Math.max(1, frame.clientWidth);
        const availableHeight = Math.max(1, frame.clientHeight);
        const widthScale = availableWidth / Math.max(1, content.scrollWidth);
        const heightScale = availableHeight / Math.max(1, content.scrollHeight);
        const scale = Math.max(0.42, Math.min(1, widthScale, heightScale));
        content.style.fontSize = `${Math.floor(scale * 1000) / 1000}em`;
      });
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    document.fonts?.ready.then(fit).catch(() => undefined);
    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
    };
  }, [children]);

  return (
    <div ref={frameRef} className="flex h-full min-w-0 w-full items-center overflow-hidden">
      <div
        ref={contentRef}
        className={cn(
          "min-w-0 w-full [overflow-wrap:anywhere] [&_*]:!max-w-full [&_*]:!text-[inherit]",
          preserveWhitespace ? "whitespace-pre-wrap" : "whitespace-normal",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function ElementVisual({
  element,
  bindings,
  preview = false,
}: {
  element: MvCompanyReportTemplateCanvasElement;
  bindings: SystemTemplateCanvasBindings;
  preview?: boolean;
}) {
  // Report/preview data (when provided) replaces `{{variables}}` in text.
  const resolveVariables = useTemplateVariables();
  if (element.kind === "logo") {
    return bindings.logoSrc ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={bindings.logoSrc} alt="" className="h-full w-full object-contain" />
    ) : preview ? (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-current/35 bg-white/10 text-[9px] font-black">الشعار</div>
    ) : null;
  }
  if (element.kind === "image") {
    return element.imageDataUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={element.imageDataUrl} alt="" className="h-full w-full object-cover" />
    ) : preview ? (
      <div className="flex h-full w-full items-center justify-center border border-dashed border-slate-400 bg-slate-100 text-[9px] text-slate-500">صورة</div>
    ) : null;
  }
  if (element.kind === "shape") return <div className="h-full w-full" />;
  if (element.kind === "binding") {
    const content = element.binding ? bindings[element.binding] : null;
    return <CanvasTextFrame>{content ?? (preview ? element.name : null)}</CanvasTextFrame>;
  }
  return <CanvasTextFrame preserveWhitespace>{(resolveVariables ? interpolateTemplateText(element.text ?? "", resolveVariables) : element.text) || (preview ? "نص جديد" : "")}</CanvasTextFrame>;
}

/** Printed values that mean "no data" (the report's own placeholders). */
const EMPTY_FIELD_VALUES = new Set(["", "—", "-", "غير محدد"]);
const STRUCTURAL_BINDINGS = new Set<string>(["reportContent", "footerContent"]);

/**
 * Names of the data this element should print but has no value for in the
 * report (empty data field, or `{{variable}}` without a value). Exported
 * reports are checked for these before export.
 */
function missingElementData(
  element: MvCompanyReportTemplateCanvasElement,
  bindings: SystemTemplateCanvasBindings,
  resolveVariables: ReturnType<typeof useTemplateVariables>,
): string[] {
  if (element.kind === "binding" && element.binding && !STRUCTURAL_BINDINGS.has(element.binding)) {
    const content = bindings[element.binding];
    const empty =
      content === null ||
      content === undefined ||
      content === false ||
      (typeof content === "string" && EMPTY_FIELD_VALUES.has(content.trim()));
    if (!empty) return [];
    return [DATA_FIELDS.find((field) => field.binding === element.binding)?.label ?? element.name];
  }
  if (element.kind === "text" && element.text && resolveVariables) {
    const missing: string[] = [];
    for (const match of element.text.matchAll(TEMPLATE_VARIABLE_PATTERN)) {
      const key = match[1]!;
      if (EMPTY_FIELD_VALUES.has(resolveVariables(key)?.trim() ?? "")) missing.push(templateVariableToken(key));
    }
    return missing;
  }
  return [];
}

function ElementSlot({
  element,
  bindings,
  preview,
}: {
  element: MvCompanyReportTemplateCanvasElement;
  bindings: SystemTemplateCanvasBindings;
  preview: boolean;
}) {
  const resolveVariables = useTemplateVariables();
  const missing = preview ? [] : missingElementData(element, bindings, resolveVariables);
  return (
    <div
      style={elementStyle(element)}
      data-mv-template-element={element.id}
      data-mv-template-missing={missing.length > 0 ? missing.join("|") : undefined}
    >
      <ElementVisual element={element} bindings={bindings} preview={preview} />
    </div>
  );
}

export function SystemTemplateElementLayer({
  elements,
  page,
  bindings,
  preview = false,
  className,
}: {
  elements: MvCompanyReportTemplateCanvasElement[];
  page: MvCompanyReportTemplateCanvasPage;
  bindings: SystemTemplateCanvasBindings;
  preview?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 z-[5] overflow-hidden [container-type:size]", className)} data-mv-template-element-layer>
      {elements
        .filter((element) => element.page === page && !element.hidden)
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((element) => (
          <ElementSlot key={element.id} element={element} bindings={bindings} preview={preview} />
        ))}
    </div>
  );
}

type Interaction = {
  mode: "move" | "resize";
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startElement: MvCompanyReportTemplateCanvasElement;
};

async function readCanvasImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("اختر ملف صورة صالحاً.");
  if (file.size > CANVAS_IMAGE_MAX_BYTES) throw new Error("حجم الصورة يجب ألا يتجاوز 3 ميجابايت.");
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة."));
    reader.readAsDataURL(file);
  });
}

function TinyNumber({ label, value, min, max, step = 1, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <Label className="grid min-w-0 gap-0.5 text-[9px] font-black text-slate-500">
      <span className="truncate">{label}</span>
      <Input
        type="number"
        value={Math.round(value * 100) / 100}
        min={min}
        max={max}
        step={step}
        className="h-7 px-1.5 text-[10px] font-bold"
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(clamp(next, min, max));
        }}
      />
    </Label>
  );
}

export type SystemTemplateEditorPanel = {
  key: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
};

const A4_PORTRAIT_HEIGHT_PX = (297 * 96) / 25.4;

/** Interior zones (percent of an A4 portrait sheet) — identical to the report shell. */
function interiorZones(template: MvCompanyReportSystemTemplateDefinition) {
  const frame = resolveReportInteriorFrameMm("portrait", template);
  const headerPct = (frame.header / 297) * 100;
  const footerPct = (frame.footer / 297) * 100;
  const marginPct = (frame.paddingInline / 210) * 100;
  const bodyTopPct = ((frame.header + frame.bodyPaddingTop) / 297) * 100;
  const bodyBottomPct =
    ((frame.footer + frame.bodyPaddingBottom) / 297) * 100 +
    (REPORT_BODY_CONTENT_FOOTER_GAP_PX / A4_PORTRAIT_HEIGHT_PX) * 100;
  return { frame, headerPct, footerPct, marginPct, bodyTopPct, bodyBottomPct };
}

function elementIntersects(
  element: MvCompanyReportTemplateCanvasElement,
  box: { left: number; top: number; right: number; bottom: number },
) {
  return element.x < box.right && element.x + element.width > box.left && element.y < box.bottom && element.y + element.height > box.top;
}

export function SystemTemplateCanvasEditor({
  template,
  page,
  bindings,
  panels = [],
  renderPreview,
  variables = [],
  onChange,
  onError,
}: {
  template: MvCompanyReportSystemTemplateDefinition;
  page: MvCompanyReportTemplateCanvasPage;
  bindings?: SystemTemplateCanvasBindings;
  /** Extra settings panels shown beside the canvas (colors, fonts, images, layout). */
  panels?: SystemTemplateEditorPanel[];
  /** Renders the real report page for the live preview (keeps 1:1 fidelity). */
  renderPreview?: (page: MvCompanyReportTemplateCanvasPage) => ReactNode;
  /** Report variables (`{{key}}`) that text on any page may contain. */
  variables?: TemplateVariableOption[];
  onChange: (elements: MvCompanyReportTemplateCanvasElement[]) => void;
  onError: (message: string | null) => void;
}) {
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [picker, setPicker] = useState<"shapes" | "data" | null>(null);
  const [dataSearch, setDataSearch] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [activePanel, setActivePanel] = useState("elements");
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const elements = template.canvasElements ?? [];
  const pageElements = useMemo(
    () => elements.filter((element) => element.page === page).sort((a, b) => b.zIndex - a.zIndex),
    [elements, page],
  );
  const selected = elements.find((element) => element.id === selectedId) ?? null;
  const hasLogo = pageElements.some((element) => element.kind === "logo" && !element.hidden);
  const hasCompanyName = pageElements.some((element) => element.binding === "companyName" && !element.hidden);
  const hasFooterFields = pageElements.some((element) => element.binding && FOOTER_BINDINGS.includes(element.binding) && !element.hidden);
  const zones = interiorZones(template);
  const bodyBox = {
    left: zones.marginPct,
    right: 100 - zones.marginPct,
    top: zones.bodyTopPct,
    bottom: 100 - zones.bodyBottomPct,
  };
  // Interior elements that sit on top of the report body would cover report text.
  const overlapping = page === "interior"
    ? pageElements.filter((element) => !element.hidden && element.opacity > 0.15 && elementIntersects(element, bodyBox))
    : [];
  const hasInteriorFooterBinding = page === "interior" && pageElements.some(
    (element) => !element.hidden && (element.binding === "footerContent" || (element.binding && FOOTER_BINDINGS.includes(element.binding)) || element.binding === "reportDate"),
  );
  const allPanels: SystemTemplateEditorPanel[] = [
    { key: "elements", label: "العناصر", icon: <Layers3 className="h-3.5 w-3.5" />, content: null },
    ...panels,
  ];

  useEffect(() => {
    if (selected && selected.page !== page) setSelectedId(null);
  }, [page, selected]);

  useEffect(() => {
    if (!editingId) return;
    const editor = canvasRef.current?.querySelector<HTMLElement>("[data-canvas-text-editor]");
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editingId]);

  const updateElement = useCallback((id: string, patch: Partial<MvCompanyReportTemplateCanvasElement>) => {
    onChange(elements.map((element) => element.id === id ? { ...element, ...patch } : element));
  }, [elements, onChange]);

  const removeElement = useCallback((id: string) => {
    onChange(elements.filter((element) => element.id !== id));
    setSelectedId((current) => current === id ? null : current);
  }, [elements, onChange]);

  const selectElement = (id: string | null) => {
    setSelectedId(id);
    if (id) setActivePanel("elements");
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input,textarea,select,[contenteditable=true]")) return;
      if (event.key === "Escape" && selected) { setSelectedId(null); return; }
      if (!selected) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateRef.current?.();
        return;
      }
      if (selected.locked) return;
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        removeElement(selected.id);
        return;
      }
      const delta = event.shiftKey ? 2 : 0.5;
      const patch: Partial<MvCompanyReportTemplateCanvasElement> = {};
      if (event.key === "ArrowLeft") patch.x = clamp(selected.x - delta, 0, 100 - selected.width);
      if (event.key === "ArrowRight") patch.x = clamp(selected.x + delta, 0, 100 - selected.width);
      if (event.key === "ArrowUp") patch.y = clamp(selected.y - delta, 0, 100 - selected.height);
      if (event.key === "ArrowDown") patch.y = clamp(selected.y + delta, 0, 100 - selected.height);
      if (Object.keys(patch).length > 0) {
        event.preventDefault();
        updateElement(selected.id, patch);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removeElement, selected, updateElement]);

  const beginInteraction = (
    event: ReactPointerEvent<HTMLDivElement>,
    element: MvCompanyReportTemplateCanvasElement,
    mode: Interaction["mode"],
  ) => {
    event.preventDefault();
    event.stopPropagation();
    selectElement(element.id);
    if (element.locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      mode,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startElement: { ...element },
    };
  };

  const moveInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    const interaction = interactionRef.current;
    const canvas = canvasRef.current;
    if (!interaction || !canvas || interaction.pointerId !== event.pointerId) return;
    const rect = canvas.getBoundingClientRect();
    const dx = ((event.clientX - interaction.startClientX) / rect.width) * 100;
    const dy = ((event.clientY - interaction.startClientY) / rect.height) * 100;
    const start = interaction.startElement;
    if (interaction.mode === "move") {
      let nextX = clamp(snap(start.x + dx, snapEnabled), 0, 100 - start.width);
      let nextY = clamp(snap(start.y + dy, snapEnabled), 0, 100 - start.height);
      const nextGuides: { x?: number; y?: number } = {};
      if (snapEnabled) {
        const others = elements.filter((element) => element.page === page && element.id !== start.id && !element.hidden);
        // Page centre, margins and (on interior pages) the header/body/footer edges are snap targets too.
        const zoneXs = page === "interior" ? [zones.marginPct, 100 - zones.marginPct] : [];
        const zoneYs = page === "interior" ? [zones.headerPct, 100 - zones.footerPct] : [];
        const targetXs = [50, ...zoneXs, ...others.flatMap((element) => [element.x, element.x + element.width / 2, element.x + element.width])];
        const targetYs = [50, ...zoneYs, ...others.flatMap((element) => [element.y, element.y + element.height / 2, element.y + element.height])];
        const movingXs = [nextX, nextX + start.width / 2, nextX + start.width];
        const movingYs = [nextY, nextY + start.height / 2, nextY + start.height];
        let bestX: { delta: number; guide: number } | null = null;
        let bestY: { delta: number; guide: number } | null = null;
        for (const moving of movingXs) for (const target of targetXs) {
          const delta = target - moving;
          if (Math.abs(delta) <= 0.9 && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) bestX = { delta, guide: target };
        }
        for (const moving of movingYs) for (const target of targetYs) {
          const delta = target - moving;
          if (Math.abs(delta) <= 0.9 && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) bestY = { delta, guide: target };
        }
        if (bestX) { nextX = clamp(nextX + bestX.delta, 0, 100 - start.width); nextGuides.x = bestX.guide; }
        if (bestY) { nextY = clamp(nextY + bestY.delta, 0, 100 - start.height); nextGuides.y = bestY.guide; }
      }
      setGuides(nextGuides);
      updateElement(start.id, { x: nextX, y: nextY });
    } else {
      updateElement(start.id, {
        width: clamp(snap(start.width + dx, snapEnabled), MIN_ELEMENT_SIZE, 100 - start.x),
        height: clamp(snap(start.height + dy, snapEnabled), start.kind === "shape" && start.shapeType === "line" ? 0.3 : MIN_ELEMENT_SIZE, 100 - start.y),
      });
    }
  };

  const endInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactionRef.current?.pointerId === event.pointerId) interactionRef.current = null;
    setGuides({});
  };

  const addElement = (kind: "text" | "shape" | "logo" | "binding", binding?: MvCompanyReportTemplateCanvasBinding, shapeType: MvCompanyReportTemplateCanvasShape = "rectangle") => {
    if ((kind === "logo" || binding) && elements.some((element) => element.page === page && (kind === "logo" ? element.kind === "logo" : element.binding === binding))) {
      const existing = elements.find((element) => element.page === page && (kind === "logo" ? element.kind === "logo" : element.binding === binding));
      if (existing?.hidden) updateElement(existing.id, { hidden: false });
      selectElement(existing?.id ?? null);
      return;
    }
    const compactShape = kind === "shape" && ["circle", "triangle", "diamond", "hexagon", "star"].includes(shapeType);
    const field = binding ? DATA_FIELDS.find((item) => item.binding === binding) : undefined;
    const textColor = page === "interior" ? template.colors.text : page === "closing" ? (template.colors.closingText ?? template.colors.coverText) : template.colors.coverText;
    const element: MvCompanyReportTemplateCanvasElement = {
      id: canvasId(kind),
      name: kind === "text" ? "نص" : kind === "shape" ? (SHAPES.find((shape) => shape.type === shapeType)?.label ?? "شكل") : kind === "logo" ? "شعار الشركة" : field?.label ?? "اسم الشركة",
      page,
      kind,
      ...(binding ? { binding } : {}),
      ...(kind === "shape" ? { shapeType } : {}),
      ...(kind === "text" ? { text: "اكتب النص هنا", color: textColor, fontSize: 18, fontWeight: 700, textAlign: "center" as const } : {}),
      ...(kind === "binding" ? { color: textColor, fontSize: page === "interior" ? 15 : 16, fontWeight: 700, textAlign: "center" as const } : {}),
      ...(kind === "shape" ? { backgroundColor: template.colors.accent, borderRadius: shapeType === "rounded" ? 14 : shapeType === "pill" ? 100 : 0 } : {}),
      x: compactShape ? 40 : 30,
      y: 38,
      width: compactShape ? 20 : 40,
      height: kind === "shape" ? (shapeType === "line" ? 0.5 : compactShape ? 14.15 : 10) : kind === "binding" ? 5 : 12,
      rotation: 0,
      zIndex: Math.max(0, ...elements.map((item) => item.zIndex)) + 1,
      opacity: 1,
    };
    onChange([...elements, element]);
    selectElement(element.id);
    onError(null);
  };

  const addImage = async (file: File) => {
    try {
      const imageDataUrl = await readCanvasImage(file);
      const element: MvCompanyReportTemplateCanvasElement = {
        id: canvasId("image"),
        name: file.name.slice(0, 120),
        page,
        kind: "image",
        imageDataUrl,
        x: 25,
        y: 30,
        width: 50,
        height: 25,
        rotation: 0,
        zIndex: Math.max(0, ...elements.map((item) => item.zIndex)) + 1,
        opacity: 1,
        borderRadius: 0,
      };
      onChange([...elements, element]);
      selectElement(element.id);
      onError(null);
    } catch (error) {
      onError(error instanceof Error ? error.message : "تعذر إضافة الصورة.");
    }
  };

  const duplicateRef = useRef<(() => void) | null>(null);
  const duplicateSelected = () => {
    if (!selected) return;
    const clone = {
      ...selected,
      id: canvasId("element"),
      name: `${selected.name} (2)`,
      x: clamp(selected.x + 3, 0, 100 - selected.width),
      y: clamp(selected.y + 3, 0, 100 - selected.height),
      zIndex: Math.max(0, ...elements.map((item) => item.zIndex)) + 1,
      locked: false,
    };
    onChange([...elements, clone]);
    selectElement(clone.id);
  };
  duplicateRef.current = duplicateSelected;

  const addVariableElement = (option: TemplateVariableOption) => {
    const textColor = page === "interior" ? template.colors.text : page === "closing" ? (template.colors.closingText ?? template.colors.coverText) : template.colors.coverText;
    const element: MvCompanyReportTemplateCanvasElement = {
      id: canvasId("text"),
      name: option.label,
      page,
      kind: "text",
      text: `{{${option.key}}}`,
      color: textColor,
      fontSize: page === "interior" ? 14 : 16,
      fontWeight: 700,
      textAlign: "center",
      x: 25,
      y: 40,
      width: 50,
      height: 5,
      rotation: 0,
      zIndex: Math.max(0, ...elements.map((item) => item.zIndex)) + 1,
      opacity: 1,
    };
    onChange([...elements, element]);
    selectElement(element.id);
    onError(null);
  };

  const restoreFooterFields = () => {
    const restored = defaultFooterCanvasElements(page === "closing" ? "cover" : page).map((element) => ({
      ...element,
      id: `${page}-${element.id}-${Date.now()}`,
      page,
      color: page === "interior" ? template.colors.mutedText : page === "closing" ? (template.colors.closingText ?? template.colors.coverText) : template.colors.coverText,
    }));
    onChange([...elements.filter((element) => !(element.page === page && element.binding && FOOTER_BINDINGS.includes(element.binding) && element.hidden)), ...restored]);
    selectElement(restored[0]?.id ?? null);
  };

  const backgroundImage = page === "cover"
    ? template.assets.coverBackgroundImage
    : page === "closing"
      ? template.assets.closingBackgroundImage
      : template.assets.portraitPageBackgroundImage;
  const pagePrimary = page === "closing" ? (template.colors.closingPrimary ?? template.colors.primary) : template.colors.primary;
  const pageSecondary = page === "closing" ? (template.colors.closingSecondary ?? template.colors.secondary) : template.colors.secondary;
  const pageTextColor = page === "closing" ? (template.colors.closingText ?? template.colors.coverText) : page === "interior" ? template.colors.text : template.colors.coverText;
  const pageColorMode = page === "closing" ? (template.layout.closingColorMode ?? template.layout.coverColorMode) : template.layout.coverColorMode;
  const pageGradientAngle = page === "closing" ? (template.layout.closingGradientAngle ?? template.layout.coverGradientAngle ?? 145) : (template.layout.coverGradientAngle ?? 145);
  const pageOverlayOpacity = page === "closing" ? (template.layout.closingOverlayOpacity ?? template.layout.coverOverlayOpacity) : template.layout.coverOverlayOpacity;
  const pageFill = page === "interior"
    ? "none"
    : pageColorMode === "solid"
      ? `linear-gradient(${pagePrimary}, ${pagePrimary})`
      : `linear-gradient(${pageGradientAngle}deg, ${pageSecondary}, ${pagePrimary})`;
  const surfaceStyle: CSSProperties = {
    borderRadius: template.layout.borderRadiusPx,
    backgroundColor: page === "interior" ? template.colors.pageBackground : pageSecondary,
    backgroundImage: backgroundImage ? `url(${backgroundImage})` : pageFill,
    backgroundSize: backgroundImage ? (template.layout.backgroundFit === "fill" ? "100% 100%" : "cover") : "cover",
    backgroundPosition: "center",
    color: pageTextColor,
    fontFamily: template.typography.fontFamily,
  };

  const sampleBindings: SystemTemplateCanvasBindings = {
    companyName: bindings?.companyName ?? "شركة التقييم",
    logoSrc: bindings?.logoSrc,
    reportTitle: bindings?.reportTitle ?? "تقرير تقييم الآلات والمعدات",
    clientName: bindings?.clientName ?? "اسم العميل",
    commercialRegistration: bindings?.commercialRegistration ?? "السجل التجاري: 1010000000",
    companyManagerName: bindings?.companyManagerName ?? "مدير الشركة: —",
    companyManagerMembership: bindings?.companyManagerMembership ?? "رقم العضوية: —",
    reportReference: bindings?.reportReference ?? "الرقم المرجعي: VT-2026-001",
    reportDate: bindings?.reportDate ?? "تاريخ التقرير: —",
    reportContent: bindings?.reportContent ?? (page === "closing" ? "شكراً لثقتكم" : "تقرير تقييم الآلات والمعدات"),
    footerContent: bindings?.footerContent ?? "الرقم المرجعي · تاريخ التقرير",
  };
  const editorBindings: SystemTemplateCanvasBindings = {
    logoSrc: bindings?.logoSrc ?? null,
    companyName: "اسم الشركة",
    reportTitle: "عنوان التقرير",
    clientName: "اسم العميل",
    commercialRegistration: "السجل التجاري",
    companyManagerName: "مدير الشركة",
    companyManagerMembership: "رقم العضوية",
    reportReference: "الرقم المرجعي",
    reportDate: "تاريخ التقرير",
    reportContent: "محتوى التقرير",
    footerContent: "بيانات التذييل",
  };
  const dataBindingKeys = new Set<string>(DATA_FIELDS.map((field) => field.binding));
  const filteredVariables = variables.filter((option) =>
    !dataBindingKeys.has(option.key) && (!dataSearch.trim() || `${option.label} ${option.group}`.includes(dataSearch.trim())),
  );
  const filteredDataFields = DATA_FIELDS.filter((field) =>
    !dataSearch.trim() || `${field.label} ${field.group}`.includes(dataSearch.trim()),
  );

  const renderLivePreview = () => renderPreview ? renderPreview(page) : (
    <div className="relative h-full w-full overflow-hidden bg-white shadow-xl" style={surfaceStyle}>
      {page !== "interior" ? <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: pageOverlayOpacity }} /> : null}
      <SystemTemplateElementLayer elements={elements} page={page} bindings={sampleBindings} preview />
    </div>
  );

  const toolButton = "h-7 gap-1 px-2 text-[10px] font-black";
  const textElement = selected && (selected.kind === "text" || selected.kind === "binding");

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 overflow-y-auto lg:overflow-hidden" dir="rtl">
      <div className="grid min-h-[760px] flex-1 gap-1 lg:min-h-0 lg:grid-cols-[292px_minmax(0,1.12fr)_minmax(0,0.88fr)]">
        {/* Settings panel */}
        <aside className="order-2 flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white lg:order-1">
          <div className="grid shrink-0 gap-0.5 border-b border-slate-200 bg-slate-50 p-0.5" style={{ gridTemplateColumns: `repeat(${allPanels.length}, minmax(0, 1fr))` }}>
            {allPanels.map((panel) => (
              <button
                key={panel.key}
                type="button"
                data-testid={`template-panel-${panel.key}`}
                onClick={() => setActivePanel(panel.key)}
                className={cn(
                  "flex h-10 flex-col items-center justify-center gap-0.5 rounded-md text-[9px] font-black transition",
                  activePanel === panel.key ? "bg-[#0C447C] text-white shadow-sm" : "text-slate-600 hover:bg-white",
                )}
              >
                {panel.icon}
                {panel.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {activePanel === "elements" ? (
              <div className="space-y-1.5">
                <div className={cn("space-y-0.5 overflow-y-auto", selected && "max-h-[190px]")}>
                  {pageElements.map((element) => (
                    <div key={element.id} className={cn("flex items-center gap-1 rounded-md border px-1 text-[10px] font-bold", selectedId === element.id ? "border-sky-300 bg-sky-50 text-sky-900" : "border-transparent bg-slate-50 text-slate-600 hover:border-slate-200")}>
                      <button type="button" className="flex h-6 w-5 shrink-0 items-center justify-center text-slate-400 hover:text-slate-700" title={element.hidden ? "إظهار" : "إخفاء"} onClick={() => updateElement(element.id, { hidden: !element.hidden })}>{element.hidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</button>
                      <button type="button" onClick={() => selectElement(element.id)} className={cn("h-6 min-w-0 flex-1 truncate text-right", element.hidden && "opacity-45")}>{element.name}</button>
                      {overlapping.some((item) => item.id === element.id) ? <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" /> : null}
                      <button type="button" className="flex h-6 w-5 shrink-0 items-center justify-center text-slate-300 hover:text-rose-600" title="حذف" aria-label={`حذف ${element.name} من القائمة`} onClick={() => removeElement(element.id)}><Trash2 className="h-3 w-3" /></button>
                      <button type="button" className="flex h-6 w-5 shrink-0 items-center justify-center text-slate-400 hover:text-slate-700" title={element.locked ? "إلغاء القفل" : "قفل"} onClick={() => updateElement(element.id, { locked: !element.locked })}>{element.locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3 opacity-40" />}</button>
                    </div>
                  ))}
                </div>
                {selected ? (
                  <section className="space-y-1.5 border-t border-slate-100 pt-1.5" data-testid="system-template-element-properties">
                    <Input aria-label="اسم العنصر" value={selected.name} maxLength={120} className="h-7 px-2 text-[10px] font-black" onChange={(event) => updateElement(selected.id, { name: event.target.value })} />
                    {textElement ? (
                      <>
                        {selected.binding === "companyName" ? null : (
                          <div className="grid grid-cols-2 rounded-md bg-slate-100 p-0.5">
                            <button type="button" className={cn("h-6 rounded text-[10px] font-black", selected.kind === "text" ? "bg-white text-[#0C447C] shadow-sm" : "text-slate-500")} onClick={() => updateElement(selected.id, { kind: "text", binding: undefined, text: selected.text ?? selected.name })}>نص ثابت</button>
                            <button type="button" className={cn("h-6 rounded text-[10px] font-black", selected.kind === "binding" ? "bg-white text-[#0C447C] shadow-sm" : "text-slate-500")} onClick={() => updateElement(selected.id, { kind: "binding", binding: selected.binding ?? "reportTitle" })}>حقل بيانات</button>
                          </div>
                        )}
                        {selected.kind === "text" ? (
                          <>
                            <Textarea aria-label="النص" value={selected.text ?? ""} rows={2} className="min-h-0 px-2 py-1 text-[11px]" onChange={(event) => updateElement(selected.id, { text: event.target.value })} />
                            {variables.length > 0 ? (
                              <TemplateVariableSelect
                                options={variables}
                                onInsert={(token) => {
                                  const current = selected.text ?? "";
                                  updateElement(selected.id, { text: current && current !== "اكتب النص هنا" ? `${current}${/\s$/.test(current) ? "" : " "}${token}` : token });
                                }}
                              />
                            ) : null}
                          </>
                        ) : selected.binding !== "companyName" ? (
                          <select aria-label="مصدر البيانات" value={selected.binding ?? "reportTitle"} onChange={(event) => updateElement(selected.id, { binding: event.target.value as MvCompanyReportTemplateCanvasBinding })} className="h-7 w-full rounded-md border border-slate-200 bg-white px-1.5 text-[10px] font-bold text-slate-700">
                            {DATA_FIELDS.map((field) => <option key={field.binding} value={field.binding}>{field.label}</option>)}
                            {selected.binding === "reportContent" || selected.binding === "footerContent" ? <option value={selected.binding}>{selected.name}</option> : null}
                          </select>
                        ) : null}
                        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-1">
                          <TinyNumber label="الحجم" value={selected.fontSize ?? 16} min={6} max={96} onChange={(fontSize) => updateElement(selected.id, { fontSize })} />
                          <TinyNumber label="الوزن" value={selected.fontWeight ?? 500} min={100} max={900} step={100} onChange={(fontWeight) => updateElement(selected.id, { fontWeight })} />
                          <div className="flex h-7 overflow-hidden rounded-md border border-slate-200">
                            {([ ["right", AlignRight], ["center", AlignCenter], ["left", AlignLeft] ] as const).map(([align, Icon]) => (
                              <button key={align} type="button" title={align === "right" ? "يمين" : align === "center" ? "وسط" : "يسار"} onClick={() => updateElement(selected.id, { textAlign: align })} className={cn("flex w-7 items-center justify-center", (selected.textAlign ?? "right") === align ? "bg-[#0C447C] text-white" : "bg-white text-slate-500 hover:bg-slate-50")}><Icon className="h-3.5 w-3.5" /></button>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : null}
                    <div className="grid grid-cols-4 gap-1">
                      <TinyNumber label="X %" value={selected.x} min={0} max={100 - selected.width} step={0.5} onChange={(x) => updateElement(selected.id, { x })} />
                      <TinyNumber label="Y %" value={selected.y} min={0} max={100 - selected.height} step={0.5} onChange={(y) => updateElement(selected.id, { y })} />
                      <TinyNumber label="العرض" value={selected.width} min={MIN_ELEMENT_SIZE} max={100 - selected.x} step={0.5} onChange={(width) => updateElement(selected.id, { width })} />
                      <TinyNumber label="الارتفاع" value={selected.height} min={0.3} max={100 - selected.y} step={0.1} onChange={(height) => updateElement(selected.id, { height })} />
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <TinyNumber label="الدوران" value={selected.rotation} min={-180} max={180} onChange={(rotation) => updateElement(selected.id, { rotation })} />
                      <TinyNumber label="الشفافية" value={selected.opacity} min={0} max={1} step={0.05} onChange={(opacity) => updateElement(selected.id, { opacity })} />
                      <TinyNumber label="الاستدارة" value={selected.borderRadius ?? 0} min={0} max={100} onChange={(borderRadius) => updateElement(selected.id, { borderRadius })} />
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {selected.kind !== "shape" && selected.kind !== "image" && selected.kind !== "logo" ? <ColorControl label="لون النص" value={selected.color} onChange={(color) => updateElement(selected.id, { color })} /> : null}
                      <ColorControl label={selected.kind === "shape" ? "لون الشكل" : "الخلفية"} value={selected.backgroundColor} onChange={(backgroundColor) => updateElement(selected.id, { backgroundColor })} onClear={selected.kind === "shape" ? undefined : () => updateElement(selected.id, { backgroundColor: undefined })} />
                      <ColorControl label="الإطار" value={selected.borderColor} onChange={(borderColor) => updateElement(selected.id, { borderColor, borderWidth: selected.borderWidth || 1 })} onClear={() => updateElement(selected.id, { borderColor: undefined, borderWidth: 0 })} />
                      <TinyNumber label="سماكة الإطار" value={selected.borderWidth ?? 0} min={0} max={20} onChange={(borderWidth) => updateElement(selected.id, { borderWidth })} />
                    </div>
                    <div className="grid grid-cols-7 gap-0.5">
                      <IconAction title="توسيط أفقي" onClick={() => updateElement(selected.id, { x: (100 - selected.width) / 2 })}><AlignCenterHorizontal className="h-3.5 w-3.5" /></IconAction>
                      <IconAction title="توسيط رأسي" onClick={() => updateElement(selected.id, { y: (100 - selected.height) / 2 })}><AlignCenterVertical className="h-3.5 w-3.5" /></IconAction>
                      <IconAction title="إلى الأمام" onClick={() => updateElement(selected.id, { zIndex: Math.max(...elements.map((item) => item.zIndex), 0) + 1 })}><BringToFront className="h-3.5 w-3.5" /></IconAction>
                      <IconAction title="إلى الخلف" onClick={() => updateElement(selected.id, { zIndex: Math.min(...elements.map((item) => item.zIndex), 0) - 1 })}><SendToBack className="h-3.5 w-3.5" /></IconAction>
                      <IconAction title={selected.hidden ? "إظهار" : "إخفاء"} onClick={() => updateElement(selected.id, { hidden: !selected.hidden })}>{selected.hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</IconAction>
                      <IconAction title="تكرار" onClick={duplicateSelected}><Copy className="h-3.5 w-3.5" /></IconAction>
                      <IconAction title="حذف" danger onClick={() => removeElement(selected.id)}><Trash2 className="h-3.5 w-3.5" /></IconAction>
                    </div>
                  </section>
                ) : null}
              </div>
            ) : allPanels.find((panel) => panel.key === activePanel)?.content}
          </div>
        </aside>

        {/* Canvas */}
        <div className="order-1 flex min-h-0 flex-col rounded-lg border border-slate-200 bg-slate-100 lg:order-2">
          <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-slate-200 bg-white p-1">
            <Button type="button" size="sm" variant="outline" className={toolButton} onClick={() => addElement("text")}><Type className="h-3.5 w-3.5" />نص</Button>
            <Button type="button" size="sm" variant={picker === "data" ? "default" : "outline"} className={toolButton} onClick={() => setPicker((current) => current === "data" ? null : "data")}><Database className="h-3.5 w-3.5" />بيانات</Button>
            <Button type="button" size="sm" variant={picker === "shapes" ? "default" : "outline"} className={toolButton} onClick={() => setPicker((current) => current === "shapes" ? null : "shapes")}><Shapes className="h-3.5 w-3.5" />شكل</Button>
            <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-black text-slate-700 hover:bg-slate-50">
              <ImagePlus className="h-3.5 w-3.5" />صورة
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void addImage(file); }} />
            </label>
            {overlapping.length > 0 ? (
              <button type="button" data-testid="system-template-overlap-warning" className="inline-flex h-7 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 text-[10px] font-black text-amber-800" onClick={() => {
                const index = overlapping.findIndex((item) => item.id === selectedId);
                selectElement(overlapping[(index + 1) % overlapping.length]!.id);
              }}><AlertTriangle className="h-3.5 w-3.5" />تداخل مع المحتوى ({overlapping.length})</button>
            ) : null}
            <ZoomControls zoom={canvasZoom} onZoomChange={setCanvasZoom} scope="التعديل" className="mr-auto" />
            <button type="button" aria-pressed={snapEnabled} title="المحاذاة الذكية" aria-label="المحاذاة الذكية" onClick={() => setSnapEnabled((value) => !value)} className={cn("inline-flex h-7 w-8 items-center justify-center rounded-md border", snapEnabled ? "border-sky-300 bg-sky-50 text-[#0C447C]" : "border-slate-200 bg-white text-slate-400")}><Magnet className="h-3.5 w-3.5" /></button>
          </div>

          {picker === "shapes" ? <div className="grid shrink-0 grid-cols-6 gap-1 border-b border-slate-200 bg-white p-1">
            {SHAPES.map((shape) => <button key={shape.type} type="button" title={shape.label} className="flex h-9 items-center justify-center rounded-md border border-slate-100 hover:border-sky-300 hover:bg-sky-50" onClick={() => { addElement("shape", undefined, shape.type); setPicker(null); }}><span className={cn("block h-5 w-7 bg-[#0C447C]", shape.previewClass)} /></button>)}
          </div> : null}

          {picker === "data" ? <div className="shrink-0 space-y-1 border-b border-slate-200 bg-white p-1">
            <div className="relative"><Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><Input value={dataSearch} onChange={(event) => setDataSearch(event.target.value)} placeholder="بحث" className="h-7 pr-7 text-[10px]" /></div>
            <div className="grid grid-cols-3 gap-1">
              <DataChip label="شعار الشركة" exists={hasLogo} onClick={() => { addElement("logo"); setPicker(null); }} />
              <DataChip label="اسم الشركة" exists={hasCompanyName} onClick={() => { addElement("binding", "companyName"); setPicker(null); }} />
              <DataChip label="حقول التذييل" exists={hasFooterFields} onClick={() => { restoreFooterFields(); setPicker(null); }} />
              {filteredDataFields.filter((field) => field.binding !== "companyName").map((field) => (
                <DataChip key={field.binding} label={field.label} exists={pageElements.some((element) => element.binding === field.binding && !element.hidden)} onClick={() => { addElement("binding", field.binding); setPicker(null); }} />
              ))}
            </div>
            {filteredVariables.length > 0 ? (
              <>
                <h4 className="px-0.5 pt-0.5 text-[10px] font-black text-slate-800">متغيرات النموذج</h4>
                <div className="grid max-h-[180px] grid-cols-3 gap-1 overflow-y-auto" data-testid="system-template-variable-picker">
                  {filteredVariables.map((option) => (
                    <DataChip
                      key={option.key}
                      label={option.label}
                      exists={pageElements.some((element) => element.kind === "text" && !element.hidden && (element.text ?? "").includes(`{{${option.key}}}`))}
                      onClick={() => { addVariableElement(option); setPicker(null); }}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div> : null}

          <ZoomViewport
            zoom={canvasZoom}
            onZoomChange={setCanvasZoom}
            className="flex-1"
            testId="system-template-canvas-viewport"
            surfaceRef={canvasRef}
            surfaceClassName="touch-none overflow-hidden bg-white shadow-xl [container-type:size]"
            surfaceStyle={surfaceStyle}
            surfaceProps={{ "data-testid": "system-template-canvas", onPointerDown: () => { setSelectedId(null); setPicker(null); } }}
          >
              {page !== "interior" ? <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: pageOverlayOpacity }} /> : null}
              {page === "interior" ? (
                <div className="pointer-events-none absolute inset-0" data-testid="system-template-interior-zones">
                  {zones.headerPct > 0 ? (
                    <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: `${zones.headerPct}%`, backgroundColor: template.colors.headerBackground, borderBottom: `1px solid ${template.colors.accent}` }}>
                      {template.assets.headerImage ? <img src={template.assets.headerImage} alt="" className="h-full w-full object-fill" /> : null}
                    </div>
                  ) : null}
                  {zones.footerPct > 0 ? (
                    <div className="absolute inset-x-0 bottom-0 overflow-hidden" style={{ height: `${zones.footerPct}%`, ...(hasInteriorFooterBinding && !template.assets.footerImage ? {} : { backgroundColor: template.colors.footerBackground, borderTop: `1px solid ${template.colors.accent}` }) }}>
                      {template.assets.footerImage && !hasInteriorFooterBinding ? <img src={template.assets.footerImage} alt="" className="h-full w-full object-contain" /> : null}
                    </div>
                  ) : null}
                  <div
                    className="absolute flex items-start justify-center border border-dashed border-sky-400/70 bg-sky-400/[0.04]"
                    style={{ left: `${bodyBox.left}%`, right: `${100 - bodyBox.right}%`, top: `${bodyBox.top}%`, bottom: `${100 - bodyBox.bottom}%` }}
                  >
                    <span className="mt-1 rounded bg-sky-500/80 px-1.5 py-0.5 text-[8px] font-black text-white">محتوى التقرير</span>
                  </div>
                </div>
              ) : null}
              {guides.x !== undefined ? <div className="pointer-events-none absolute inset-y-0 z-[200] w-px bg-fuchsia-500" style={{ left: `${guides.x}%` }} /> : null}
              {guides.y !== undefined ? <div className="pointer-events-none absolute inset-x-0 z-[200] h-px bg-fuchsia-500" style={{ top: `${guides.y}%` }} /> : null}
              {pageElements.map((element) => {
                if (element.hidden) return null;
                const active = selectedId === element.id;
                return (
                  <div
                    key={element.id}
                    data-testid={`system-template-canvas-element-${element.id}`}
                    style={elementStyle(element)}
                    className={cn(
                      "group cursor-move select-none",
                      active ? "outline outline-2 outline-offset-1 outline-sky-500" : "hover:outline hover:outline-1 hover:outline-sky-400/70",
                      element.locked && "cursor-not-allowed",
                    )}
                    onPointerDown={(event) => beginInteraction(event, element, "move")}
                    onPointerMove={moveInteraction}
                    onPointerUp={endInteraction}
                    onPointerCancel={endInteraction}
                    onDoubleClick={(event) => {
                      if (element.kind !== "text" || element.locked) return;
                      event.preventDefault();
                      event.stopPropagation();
                      setEditingId(element.id);
                    }}
                  >
                    {element.kind === "text" && editingId === element.id ? (
                      <div
                        data-canvas-text-editor
                        contentEditable
                        suppressContentEditableWarning
                        className="flex h-full w-full cursor-text items-center overflow-hidden whitespace-pre-wrap outline-none"
                        onPointerDown={(event) => event.stopPropagation()}
                        onBlur={(event) => {
                          updateElement(element.id, { text: event.currentTarget.innerText });
                          setEditingId(null);
                        }}
                      >
                        {element.text}
                      </div>
                    ) : <ElementVisual element={element} bindings={editorBindings} preview />}
                    {/* Editor-only: diagonal hatching marks the area the element occupies. */}
                    <div
                      aria-hidden
                      data-testid={active ? "system-template-element-hatch" : undefined}
                      className={cn(
                        "pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity",
                        active ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                      )}
                      style={{ backgroundImage: ELEMENT_HATCH, outline: active ? "1px dashed rgba(2,132,199,0.9)" : undefined }}
                    />
                    {active ? (
                      <button
                        type="button"
                        aria-label={`حذف ${element.name}`}
                        title="حذف العنصر"
                        data-testid="system-template-element-delete"
                        className={cn(
                          "absolute z-[2] flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-rose-600 text-white shadow-md hover:bg-rose-700",
                          element.y < 3 ? "top-0.5" : "-top-2.5",
                          element.x < 3 ? "left-0.5" : "-left-2.5",
                        )}
                        onPointerDown={(event) => event.stopPropagation()}
                        onDoubleClick={(event) => event.stopPropagation()}
                        onClick={(event) => { event.stopPropagation(); removeElement(element.id); }}
                      ><Trash2 className="h-2.5 w-2.5" strokeWidth={2.5} /></button>
                    ) : null}
                    {active && !element.locked ? (
                      <div
                        className="absolute -bottom-1.5 -left-1.5 h-3 w-3 cursor-nesw-resize rounded-sm border-2 border-white bg-sky-600 shadow"
                        onPointerDown={(event) => beginInteraction(event, element, "resize")}
                        onPointerMove={moveInteraction}
                        onPointerUp={endInteraction}
                        onPointerCancel={endInteraction}
                      />
                    ) : null}
                  </div>
                );
              })}
          </ZoomViewport>
        </div>

        {/* Live preview — the real report page renderer */}
        <aside className="order-3 hidden min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-200/70 lg:flex" data-testid="system-template-live-preview">
          <div className="relative flex min-h-0 flex-1 flex-col">
            <ZoomViewport zoom={previewZoom} onZoomChange={setPreviewZoom} className="flex-1" testId="system-template-preview-viewport">{renderLivePreview()}</ZoomViewport>
            <div className="absolute left-2 top-2 z-10 flex items-center gap-1">
              <Button type="button" size="icon" variant="outline" className="h-7 w-7 rounded-md bg-white/95 shadow-sm" aria-label="معاينة بالحجم الكامل" title="معاينة بالحجم الكامل" onClick={() => setPreviewOpen(true)}><Maximize2 className="h-3.5 w-3.5" /></Button>
              <ZoomControls zoom={previewZoom} onZoomChange={setPreviewZoom} scope="المعاينة" />
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          dir="rtl"
          overlayClassName="z-[950] bg-slate-950/90"
          className="!fixed !inset-1 z-[960] flex !h-auto !w-auto !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-xl border-slate-700 bg-slate-950 p-0 text-white"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>المعاينة النهائية</DialogTitle>
            <DialogDescription>معاينة الصفحة كما ستظهر في التقرير النهائي.</DialogDescription>
          </DialogHeader>
          <div className="relative flex min-h-0 flex-1 flex-col" data-testid="system-template-full-preview">
            <ZoomViewport zoom={previewZoom} onZoomChange={setPreviewZoom} padding={10} className="flex-1">{renderLivePreview()}</ZoomViewport>
            <ZoomControls zoom={previewZoom} onZoomChange={setPreviewZoom} scope="المعاينة" className="absolute left-3 top-3 z-20 h-8" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IconAction({ title, onClick, danger = false, children }: { title: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <Button type="button" size="icon" variant="outline" className={cn("h-7 w-full", danger && "text-rose-600 hover:text-rose-700")} title={title} aria-label={title} onClick={onClick}>{children}</Button>
  );
}

function DataChip({ label, exists, onClick }: { label: string; exists: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex h-7 items-center justify-between gap-1 rounded-md border px-1.5 text-right text-[10px] font-black", exists ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-sky-50")}>
      <span className="truncate">{label}</span>
      {exists ? <Check className="h-3 w-3 shrink-0" /> : <Plus className="h-3 w-3 shrink-0 text-slate-400" />}
    </button>
  );
}

function ColorControl({ label, value, onChange, onClear }: { label: string; value?: string; onChange: (value: string) => void; onClear?: () => void }) {
  const safe = value && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
  return (
    <Label className="grid gap-0.5 text-[9px] font-black text-slate-500">
      {label}
      <span className="flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-1">
        <input type="color" value={safe ?? "#FFFFFF"} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-5 w-6 shrink-0 cursor-pointer border-0 bg-transparent p-0" />
        <span dir="ltr" className={cn("min-w-0 flex-1 truncate text-[9px] font-bold", !safe && "text-slate-400")}>{safe ?? "—"}</span>
        {onClear && safe ? <button type="button" title="إزالة" className="shrink-0 text-slate-400 hover:text-rose-600" onClick={(event) => { event.preventDefault(); onClear(); }}><X className="h-3 w-3" /></button> : null}
      </span>
    </Label>
  );
}
