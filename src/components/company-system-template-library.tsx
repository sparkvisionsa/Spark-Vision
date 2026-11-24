"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Copy,
  Eye,
  FileImage,
  ImagePlus,
  ArrowDown,
  ArrowUp,
  LayoutTemplate,
  Loader2,
  Palette,
  Pencil,
  Plus,
  Redo2,
  Ruler,
  Save,
  ScanLine,
  Search,
  Table2,
  Settings2,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { LanguageContext } from "@/components/layout-provider";
import type {
  MvCompanyReportSummaryTable,
  MvCompanyReportSystemTemplateDefinition,
  MvCompanyReportTemplateCanvasElement,
  MvCompanyReportTemplateCanvasPage,
} from "@/components/workspace/workspace-sections/machine-valuation/types";
import {
  buildSummaryFieldCatalog,
  SUMMARY_CUSTOM_ROW_KEY,
  SUMMARY_TABLE_DEFAULT_LABEL_PCT,
  SUMMARY_TABLE_MAX_FIELDS,
} from "@/components/system-template-summary-table";
import { buildTemplateVariableCatalog, TemplateVariableSelect } from "@/components/system-template-variables";
import { createDefaultReportDataModel, type MvReportDataModel } from "@/components/workspace/workspace-sections/machine-valuation/mv-report-data-models";
import {
  defaultSystemTemplateCanvasElements,
  SystemTemplateCanvasEditor,
  templateReportDateLabel,
  type SystemTemplateCanvasBindings,
  type SystemTemplateEditorPanel,
} from "@/components/system-report-template-canvas";
import {
  SystemTemplateReportPreview,
  type SystemTemplatePreviewData,
} from "@/components/system-template-report-preview";

type Template = MvCompanyReportSystemTemplateDefinition;
type CanvasElement = MvCompanyReportTemplateCanvasElement;
type StudioPage = MvCompanyReportTemplateCanvasPage;

const SYSTEM_TEMPLATE_IMAGE_LIMIT = 3_000_000;
const SYSTEM_TEMPLATE_IMAGES_TOTAL_LIMIT = 12_000_000;
const HISTORY_LIMIT = 80;
const HISTORY_COALESCE_MS = 450;

const PROFESSIONAL_FONTS = [
  { name: "IBM Plex Sans Arabic", family: "'IBM Plex Sans Arabic', sans-serif", url: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap" },
  { name: "Noto Kufi Arabic", family: "'Noto Kufi Arabic', sans-serif", url: "https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;500;600;700;800&display=swap" },
  { name: "Noto Sans Arabic", family: "'Noto Sans Arabic', sans-serif", url: "https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@300;400;500;600;700;800;900&display=swap" },
  { name: "Cairo", family: "Cairo, sans-serif", url: "https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap" },
  { name: "Tajawal", family: "Tajawal, sans-serif", url: "https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap" },
  { name: "Almarai", family: "Almarai, sans-serif", url: "https://fonts.googleapis.com/css2?family=Almarai:wght@300;400;700;800&display=swap" },
  { name: "Alexandria", family: "Alexandria, sans-serif", url: "https://fonts.googleapis.com/css2?family=Alexandria:wght@300;400;500;600;700;800&display=swap" },
  { name: "Readex Pro", family: "'Readex Pro', sans-serif", url: "https://fonts.googleapis.com/css2?family=Readex+Pro:wght@300;400;500;600;700&display=swap" },
  { name: "Rubik", family: "Rubik, sans-serif", url: "https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700;800&display=swap" },
  { name: "Changa", family: "Changa, sans-serif", url: "https://fonts.googleapis.com/css2?family=Changa:wght@300;400;500;600;700;800&display=swap" },
  { name: "Amiri", family: "Amiri, serif", url: "https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" },
  { name: "Arial", family: "Arial, sans-serif", url: "" },
];

/** Restrained palettes suited to official valuation reports. */
const PALETTES: Array<{ name: string; primary: string; secondary: string; accent: string; header: string; footer: string }> = [
  { name: "كحلي وذهبي", primary: "#0C447C", secondary: "#061B2D", accent: "#C9A227", header: "#FFFFFF", footer: "#F4F7FA" },
  { name: "أخضر مؤسسي", primary: "#0F5B4A", secondary: "#062E25", accent: "#B8955A", header: "#FFFFFF", footer: "#F2F7F5" },
  { name: "عنابي", primary: "#7A1E2C", secondary: "#3A0B14", accent: "#C8A45C", header: "#FFFFFF", footer: "#FAF4F4" },
  { name: "فحمي", primary: "#2B3440", secondary: "#11161C", accent: "#D0A13B", header: "#FFFFFF", footer: "#F4F5F7" },
  { name: "أزرق بترولي", primary: "#0E5E6F", secondary: "#05282F", accent: "#E0B04B", header: "#FFFFFF", footer: "#F1F7F8" },
  { name: "رمادي ملكي", primary: "#3D3A73", secondary: "#191734", accent: "#BFA16A", header: "#FFFFFF", footer: "#F5F5FA" },
];

function fontFamilyFromGoogleUrl(url: string) {
  const match = url.match(/[?&]family=([^:&]+)/i);
  if (!match?.[1]) return null;
  const name = decodeURIComponent(match[1].replace(/\+/g, " ")).trim();
  return name ? `'${name}', sans-serif` : null;
}

function templateAssetsSize(assets: Template["assets"]): number {
  return Object.values(assets).reduce((total, asset) => total + (typeof asset === "string" ? asset.length : 0), 0);
}

function templateCanvasImagesSize(template: Template): number {
  return (template.canvasElements ?? []).reduce(
    (total, element) => total + (typeof element.imageDataUrl === "string" ? element.imageDataUrl.length : 0),
    0,
  );
}

function templateMediaSize(template: Template): number {
  return templateAssetsSize(template.assets) + templateCanvasImagesSize(template);
}

export function createEmptySystemTemplate(): Template {
  const now = new Date().toISOString();
  return {
    id: `system-template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: "قالب نظام جديد",
    description: "",
    createdAt: now,
    updatedAt: now,
    canvasElements: defaultSystemTemplateCanvasElements(),
    colors: {
      primary: "#0C447C",
      secondary: "#061B2D",
      accent: "#C9A227",
      coverText: "#FFFFFF",
      text: "#0F172A",
      mutedText: "#475569",
      pageBackground: "#FFFFFF",
      headerBackground: "#FFFFFF",
      footerBackground: "#F4F7FA",
      closingPrimary: "#0C447C",
      closingSecondary: "#061B2D",
      closingText: "#FFFFFF",
    },
    typography: {
      fontFamily: "Arial, sans-serif",
      headingFontFamily: "Arial, sans-serif",
      baseFontSize: 12.5,
      headingScale: 1,
      lineHeight: 1.7,
      fontWeight: 500,
    },
    assets: {},
    layout: {
      backgroundFit: "cover",
      contentAlign: "right",
      logoPosition: "right",
      pageMarginMm: 12,
      headerHeightMm: 22,
      footerHeightMm: 18,
      coverOverlayOpacity: 0.18,
      borderRadiusPx: 0,
      showHeader: true,
      showFooter: true,
      showLogo: true,
      showWatermark: false,
      coverColorMode: "gradient",
      coverGradientAngle: 145,
      closingColorMode: "gradient",
      closingGradientAngle: 145,
      closingOverlayOpacity: 0.18,
    },
  };
}

function deepCopyTemplate(source: Template): Template {
  return {
    ...source,
    colors: { ...source.colors },
    typography: { ...source.typography },
    assets: { ...source.assets },
    layout: { ...source.layout },
    canvasElements: (source.canvasElements ?? []).map((element) => ({ ...element })),
  };
}

function cloneSystemTemplate(source: Template): Template {
  const now = new Date().toISOString();
  return {
    ...deepCopyTemplate(source),
    id: `system-template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: `${source.name} - نسخة`,
    createdAt: now,
    updatedAt: now,
  };
}

async function readTemplateImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("الملف المختار ليس صورة صالحة.");
  if (file.size > SYSTEM_TEMPLATE_IMAGE_LIMIT) throw new Error("حجم الصورة يجب ألا يتجاوز 3 ميجابايت.");
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة."));
    reader.readAsDataURL(file);
  });
}

/* ───────────── Compact form controls ───────────── */

/** Default executive-summary rows when the table is first switched on. */
const SUMMARY_DEFAULT_KEYS = [
  "clientName",
  "intendedUsers",
  "valuationPurpose",
  "intendedUse",
  "valuationBasis",
  "valuePremise",
  "valuationMethod",
  "inspectionDate",
  "valuationDate",
  "reportIssueDate",
  "finalValue",
  "finalValueWords",
];

function SectionTitle({ children }: { children: ReactNode }) {
  return <h4 className="px-0.5 pt-1 text-[10px] font-black text-slate-800">{children}</h4>;
}

function NumberField({ label, value, min, max, step = 1, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void;
}) {
  return (
    <Label className="grid min-w-0 gap-0.5">
      <span className="truncate text-[9px] font-black text-slate-500">{label}</span>
      <span className="relative">
        <Input type="number" value={Math.round(value * 100) / 100} min={min} max={max} step={step} onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next)));
        }} className={cn("h-7 px-1.5 text-[10px] font-bold", suffix && "pl-7")} />
        {suffix ? <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">{suffix}</span> : null}
      </span>
    </Label>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <Label className="grid min-w-0 gap-0.5">
      <span className="truncate text-[9px] font-black text-slate-500">{label}</span>
      <span className="flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-1">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#FFFFFF"} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-5 w-6 shrink-0 cursor-pointer border-0 bg-transparent p-0" />
        <input
          dir="ltr"
          value={text}
          maxLength={7}
          onChange={(event) => {
            const next = event.target.value.toUpperCase();
            if (!/^#?[0-9A-F]{0,6}$/.test(next)) return;
            const normalized = next.startsWith("#") ? next : `#${next}`;
            setText(normalized);
            if (/^#[0-9A-F]{6}$/.test(normalized)) onChange(normalized);
          }}
          onBlur={() => setText(value)}
          className="min-w-0 flex-1 bg-transparent text-left text-[10px] font-bold text-slate-700 outline-none"
        />
      </span>
    </Label>
  );
}

function ToggleRow({ label, checked, onChange, children }: { label: string; checked: boolean; onChange: (checked: boolean) => void; children?: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
      <span className="min-w-0 flex-1 truncate text-[10px] font-black text-slate-700">{label}</span>
      {children}
    </div>
  );
}

function ImageField({ label, value, onChange, onError }: {
  label: string; value?: string | null; onChange: (value: string | null) => void; onError: (message: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-1">
      <div className="flex h-11 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <FileImage className="h-4 w-4 text-slate-300" />}
      </div>
      <span className="min-w-0 flex-1 truncate text-[10px] font-black text-slate-700">{label}</span>
      <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md bg-[#0C447C] px-2 text-[9px] font-black text-white hover:bg-[#0a3a6a]">
        <ImagePlus className="h-3 w-3" />{value ? "استبدال" : "رفع"}
        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => {
          const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
          void readTemplateImage(file).then(onChange).catch((error) => onError(error instanceof Error ? error.message : "تعذر قراءة الصورة."));
        }} />
      </label>
      {value ? <Button type="button" size="icon" variant="outline" className="h-7 w-7 text-rose-600" title="إزالة" aria-label={`إزالة ${label}`} onClick={() => onChange(null)}><X className="h-3.5 w-3.5" /></Button> : null}
    </div>
  );
}

export type SystemTemplateCompanyPreviewData = SystemTemplatePreviewData;

function canvasBindings(data: SystemTemplatePreviewData): SystemTemplateCanvasBindings {
  return {
    logoSrc: data.logoSrc,
    companyName: data.companyName || "شركة التقييم",
    reportTitle: data.reportTitle || "تقرير تقييم الآلات والمعدات",
    clientName: data.clientName || "اسم العميل",
    commercialRegistration: `السجل التجاري: ${data.commercialRegistration || "—"}`,
    companyManagerName: `مدير الشركة: ${data.managerName || "—"}`,
    companyManagerMembership: `رقم العضوية: ${data.managerMembershipNo || "—"}`,
    reportReference: `الرقم المرجعي: ${data.reportReference || "VT-2026-001"}`,
    reportDate: templateReportDateLabel(data.reportDate || new Date().toISOString().slice(0, 10)),
  };
}

const PAGE_LABELS: Record<StudioPage, string> = { cover: "الغلاف", interior: "صفحة داخلية", closing: "الخاتمة" };

/* ───────────── Library + studio ───────────── */

export function CompanySystemTemplateLibrary({
  templates,
  selectedTemplateId,
  officialPreview,
  companyData,
  disabled = false,
  reportDataModels,
  onCommit,
  onPreviewOfficial,
}: {
  templates: Template[];
  selectedTemplateId: string;
  officialPreview: ReactNode;
  companyData: SystemTemplateCompanyPreviewData;
  disabled?: boolean;
  /** Company report-data models: their fields feed the executive-summary table. */
  reportDataModels?: MvReportDataModel[];
  /**
   * Persists the library (templates + approved template) to the server.
   * Resolves to `true` only after the server confirmed the save.
   */
  onCommit: (templates: Template[], selectedTemplateId: string) => Promise<boolean> | boolean;
  onPreviewOfficial: () => void;
}) {
  const isEnglishUi = useContext(LanguageContext)?.language === "en";
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<Template>(() => createEmptySystemTemplate());
  const draftRef = useRef(draft);
  const savedSnapshotRef = useRef("");
  const historyRef = useRef<{ past: Template[]; future: Template[]; lastAt: number }>({ past: [], future: [], lastAt: 0 });
  const [, setHistoryTick] = useState(0);
  const [page, setPage] = useState<StudioPage>("cover");
  const [summarySearch, setSummarySearch] = useState("");
  const [summaryModelId, setSummaryModelId] = useState("");
  const effectiveDataModels = useMemo(
    () => (reportDataModels && reportDataModels.length > 0 ? reportDataModels : [createDefaultReportDataModel()]),
    [reportDataModels],
  );
  const summaryCatalog = useMemo(() => buildSummaryFieldCatalog(effectiveDataModels), [effectiveDataModels]);
  const variableCatalog = useMemo(() => buildTemplateVariableCatalog(effectiveDataModels), [effectiveDataModels]);
  const [expandedSummaryRow, setExpandedSummaryRow] = useState<string | null>(null);
  const [fontSearch, setFontSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const officialSelected = selectedTemplateId === "default-report-template";
  const selectedName = useMemo(
    () => officialSelected ? "Value Tech الرسمي" : templates.find((item) => item.id === selectedTemplateId)?.name ?? "Value Tech الرسمي",
    [officialSelected, selectedTemplateId, templates],
  );
  const bindings = useMemo(() => canvasBindings(companyData), [companyData]);

  /* History-aware draft updates (undo / redo). */
  const commit = useCallback((next: Template, options: { coalesce?: boolean } = {}) => {
    const history = historyRef.current;
    const now = Date.now();
    if (!(options.coalesce !== false && now - history.lastAt < HISTORY_COALESCE_MS && history.past.length > 0)) {
      history.past.push(draftRef.current);
      if (history.past.length > HISTORY_LIMIT) history.past.shift();
    }
    history.lastAt = now;
    history.future = [];
    draftRef.current = next;
    setDraft(next);
    setHistoryTick((tick) => tick + 1);
  }, []);
  const undo = useCallback(() => {
    const history = historyRef.current;
    const previous = history.past.pop();
    if (!previous) return;
    history.future.push(draftRef.current);
    history.lastAt = 0;
    draftRef.current = previous;
    setDraft(previous);
    setHistoryTick((tick) => tick + 1);
  }, []);
  const redo = useCallback(() => {
    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) return;
    history.past.push(draftRef.current);
    history.lastAt = 0;
    draftRef.current = next;
    setDraft(next);
    setHistoryTick((tick) => tick + 1);
  }, []);

  const patch = (next: Partial<Template>) => commit({ ...draftRef.current, ...next, updatedAt: new Date().toISOString() });
  const patchColors = (next: Partial<Template["colors"]>) => patch({ colors: { ...draftRef.current.colors, ...next } });
  const patchTypography = (next: Partial<Template["typography"]>) => patch({ typography: { ...draftRef.current.typography, ...next } });
  const patchLayout = (next: Partial<Template["layout"]>) => patch({ layout: { ...draftRef.current.layout, ...next } });

  const exceedsMediaLimit = (candidate: Template) => {
    const libraryMediaSize = templates.filter((template) => template.id !== candidate.id).reduce((total, template) => total + templateMediaSize(template), 0);
    return libraryMediaSize + templateMediaSize(candidate) > SYSTEM_TEMPLATE_IMAGES_TOTAL_LIMIT;
  };
  const patchAsset = (key: keyof Template["assets"], value: string | null) => {
    const candidate = { ...draftRef.current, assets: { ...draftRef.current.assets, [key]: value } };
    if (exceedsMediaLimit(candidate)) {
      setError("تجاوز إجمالي صور مكتبة القوالب الحد الآمن للحفظ. استخدم صور WebP مضغوطة أو احذف صورة قديمة.");
      return;
    }
    setError(null);
    patch({ assets: candidate.assets });
  };
  const updateCanvasElements = (canvasElements: CanvasElement[]) => {
    if (exceedsMediaLimit({ ...draftRef.current, canvasElements })) {
      setError("تجاوز إجمالي صور مكتبة القوالب الحد الآمن للحفظ. استخدم صور WebP مضغوطة أو احذف صورة قديمة.");
      return;
    }
    setError(null);
    patch({ canvasElements });
  };

  const canvasPage = page;
  const isTextElement = (element: CanvasElement) => element.kind === "text" || element.kind === "binding";
  /** Page text colour — also recolours the page's text elements so the change is visible everywhere. */
  const applyPageTextColor = (value: string) => {
    const current = draftRef.current;
    commit({
      ...current,
      updatedAt: new Date().toISOString(),
      colors: { ...current.colors, ...(page === "interior" ? { text: value } : page === "closing" ? { closingText: value } : { coverText: value }) },
      canvasElements: (current.canvasElements ?? []).map((element) => element.page === canvasPage && isTextElement(element) && !(page === "interior" && element.binding === "companyName") ? { ...element, color: value } : element),
    });
  };
  /** Accent colour — recolours shapes that were using the previous accent on every page. */
  const recolorShapes = (elements: CanvasElement[], from: string, to: string) =>
    elements.map((element) => element.kind === "shape" && element.backgroundColor?.toUpperCase() === from.toUpperCase() ? { ...element, backgroundColor: to } : element);
  const applyAccentColor = (value: string) => {
    const current = draftRef.current;
    commit({
      ...current,
      updatedAt: new Date().toISOString(),
      colors: { ...current.colors, accent: value },
      canvasElements: recolorShapes(current.canvasElements ?? [], current.colors.accent, value),
    });
  };
  const applyPrimaryColor = (value: string) => {
    const current = draftRef.current;
    commit({
      ...current,
      updatedAt: new Date().toISOString(),
      colors: { ...current.colors, primary: value },
      canvasElements: (current.canvasElements ?? []).map((element) => element.page === "interior" && isTextElement(element) && element.color?.toUpperCase() === current.colors.primary.toUpperCase() ? { ...element, color: value } : element),
    });
  };
  const applyPalette = (palette: (typeof PALETTES)[number]) => {
    const current = draftRef.current;
    const elements = recolorShapes(current.canvasElements ?? [], current.colors.accent, palette.accent).map((element) =>
      element.page === "interior" && isTextElement(element) && element.color?.toUpperCase() === current.colors.primary.toUpperCase() ? { ...element, color: palette.primary } : element,
    );
    commit({
      ...current,
      updatedAt: new Date().toISOString(),
      colors: {
        ...current.colors,
        primary: palette.primary,
        secondary: palette.secondary,
        accent: palette.accent,
        closingPrimary: palette.primary,
        closingSecondary: palette.secondary,
        headerBackground: palette.header,
        footerBackground: palette.footer,
      },
      canvasElements: elements,
    });
  };

  /** Fit header/footer zones tightly around the interior elements placed in them. */
  const fitInteriorZones = () => {
    const current = draftRef.current;
    const interior = (current.canvasElements ?? []).filter((element) => element.page === "interior" && !element.hidden);
    const top = interior.filter((element) => element.y + element.height / 2 < 30);
    const bottom = interior.filter((element) => element.y + element.height / 2 > 70);
    const roundUpHalfMm = (value: number) => Math.ceil(value * 2) / 2;
    const headerMm = top.length ? roundUpHalfMm((Math.max(...top.map((element) => element.y + element.height)) / 100) * 297 + 1.5) : 0;
    const footerMm = bottom.length ? roundUpHalfMm(297 - (Math.min(...bottom.map((element) => element.y)) / 100) * 297 + 1.5) : 0;
    patchLayout({
      headerHeightMm: Math.min(50, headerMm),
      footerHeightMm: Math.min(50, footerMm),
      showHeader: headerMm > 0,
      showFooter: footerMm > 0,
    });
  };

  useEffect(() => {
    const url = draft.typography.googleFontUrl?.trim();
    if (!url || PROFESSIONAL_FONTS.some((font) => font.url === url)) return;
    const family = fontFamilyFromGoogleUrl(url);
    if (!family || draft.typography.fontFamily === family) return;
    commit({ ...draftRef.current, typography: { ...draftRef.current.typography, fontFamily: family, headingFontFamily: family } }, { coalesce: true });
  }, [commit, draft.typography.fontFamily, draft.typography.googleFontUrl]);

  const startEditing = (template: Template) => {
    const copy = deepCopyTemplate(template);
    draftRef.current = copy;
    savedSnapshotRef.current = JSON.stringify(copy);
    historyRef.current = { past: [], future: [], lastAt: 0 };
    setDraft(copy);
    setPage("cover");
    setError(null);
    setConfirmDiscard(false);
    setEditorOpen(true);
  };
  const openNew = () => startEditing(createEmptySystemTemplate());
  const isDirty = editorOpen && JSON.stringify(draft) !== savedSnapshotRef.current;
  const requestClose = () => {
    if (isDirty && !confirmDiscard) { setConfirmDiscard(true); return; }
    setConfirmDiscard(false);
    setEditorOpen(false);
  };
  const [saving, setSaving] = useState<false | "save" | "approve" | "library">(false);
  const persistLibrary = async (nextTemplates: Template[], nextSelectedId: string, mode: "save" | "approve" | "library") => {
    if (saving) return false;
    setSaving(mode);
    try {
      return (await onCommit(nextTemplates, nextSelectedId)) === true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  };

  const save = async (approve: boolean) => {
    const current = draftRef.current;
    if (!current.name.trim()) { setError("اكتب اسم القالب قبل الحفظ."); return; }
    const normalized = { ...current, name: current.name.trim(), description: current.description?.trim(), updatedAt: new Date().toISOString() };
    const nextTemplates = templates.some((item) => item.id === normalized.id)
      ? templates.map((item) => item.id === normalized.id ? normalized : item)
      : [...templates, normalized];
    setError(null);
    const ok = await persistLibrary(nextTemplates, approve ? normalized.id : selectedTemplateId, approve ? "approve" : "save");
    if (!ok) {
      setError("تعذر حفظ القالب على الخادم. تحقق من الاتصال ثم أعد المحاولة.");
      return;
    }
    savedSnapshotRef.current = JSON.stringify(current);
    setConfirmDiscard(false);
    setEditorOpen(false);
  };

  useEffect(() => {
    if (!editorOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input,textarea,select,[contenteditable=true]")) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) { event.preventDefault(); undo(); }
      else if (key === "y" || (key === "z" && event.shiftKey)) { event.preventDefault(); redo(); }
      else if (key === "s") { event.preventDefault(); void save(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  /* ── Contextual settings panels (only what applies to the current page) ── */
  const closing = page === "closing";
  const colorMode = closing ? (draft.layout.closingColorMode ?? draft.layout.coverColorMode ?? "gradient") : (draft.layout.coverColorMode ?? "gradient");
  const colorsPanel = (
    <div className="space-y-2">
      <SectionTitle>لوحات جاهزة</SectionTitle>
      <div className="grid grid-cols-3 gap-1">
        {PALETTES.map((palette) => {
          const active = draft.colors.primary.toUpperCase() === palette.primary && draft.colors.accent.toUpperCase() === palette.accent;
          return (
            <button key={palette.name} type="button" title={palette.name} onClick={() => applyPalette(palette)} className={cn("overflow-hidden rounded-md border text-[9px] font-black", active ? "border-[#0C447C] ring-2 ring-sky-100" : "border-slate-200 hover:border-sky-300")}>
              <span className="flex h-5">
                <span className="flex-[3]" style={{ background: `linear-gradient(145deg, ${palette.secondary}, ${palette.primary})` }} />
                <span className="flex-1" style={{ background: palette.accent }} />
              </span>
              <span className="block truncate bg-white px-1 py-0.5 text-slate-700">{palette.name}</span>
            </button>
          );
        })}
      </div>
      {page === "interior" ? (
        <>
          <SectionTitle>الصفحة</SectionTitle>
          <div className="grid grid-cols-2 gap-1.5">
            <ColorField label="الخلفية" value={draft.colors.pageBackground} onChange={(value) => patchColors({ pageBackground: value })} />
            <ColorField label="النص" value={draft.colors.text} onChange={applyPageTextColor} />
            <ColorField label="العناوين" value={draft.colors.primary} onChange={applyPrimaryColor} />
            <ColorField label="النص الثانوي" value={draft.colors.mutedText} onChange={(value) => patchColors({ mutedText: value })} />
            <ColorField label="التمييز والفواصل" value={draft.colors.accent} onChange={applyAccentColor} />
          </div>
          <SectionTitle>الترويسة والتذييل</SectionTitle>
          <div className="grid grid-cols-2 gap-1.5">
            <ColorField label="خلفية الترويسة" value={draft.colors.headerBackground} onChange={(value) => patchColors({ headerBackground: value })} />
            <ColorField label="خلفية التذييل" value={draft.colors.footerBackground} onChange={(value) => patchColors({ footerBackground: value })} />
          </div>
        </>
      ) : (
        <>
          <SectionTitle>{PAGE_LABELS[page]}</SectionTitle>
          <div className="grid grid-cols-2 rounded-md bg-slate-100 p-0.5">
            {(["solid", "gradient"] as const).map((mode) => (
              <button key={mode} type="button" onClick={() => patchLayout(closing ? { closingColorMode: mode } : { coverColorMode: mode })} className={cn("h-6 rounded text-[10px] font-black", (mode === "solid") === (colorMode === "solid") ? "bg-white text-[#0C447C] shadow-sm" : "text-slate-500")}>{mode === "solid" ? "لون واحد" : "تدرّج"}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <ColorField label={colorMode === "solid" ? "اللون" : "اللون الأول"} value={closing ? (draft.colors.closingPrimary ?? draft.colors.primary) : draft.colors.primary} onChange={(value) => closing ? patchColors({ closingPrimary: value }) : applyPrimaryColor(value)} />
            {colorMode !== "solid" ? <ColorField label="اللون الثاني" value={closing ? (draft.colors.closingSecondary ?? draft.colors.secondary) : draft.colors.secondary} onChange={(value) => patchColors(closing ? { closingSecondary: value } : { secondary: value })} /> : null}
            <ColorField label="النصوص" value={closing ? (draft.colors.closingText ?? draft.colors.coverText) : draft.colors.coverText} onChange={applyPageTextColor} />
            <ColorField label="التمييز" value={draft.colors.accent} onChange={applyAccentColor} />
            {colorMode !== "solid" ? <NumberField label="زاوية التدرّج" suffix="°" value={closing ? (draft.layout.closingGradientAngle ?? 145) : (draft.layout.coverGradientAngle ?? 145)} min={0} max={360} onChange={(value) => patchLayout(closing ? { closingGradientAngle: value } : { coverGradientAngle: value })} /> : null}
          </div>
        </>
      )}
    </div>
  );

  const fontsPanel = (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        <NumberField label="حجم النص" suffix="px" value={draft.typography.baseFontSize} min={8} max={24} step={0.5} onChange={(value) => patchTypography({ baseFontSize: value })} />
        <NumberField label="ارتفاع السطر" value={draft.typography.lineHeight} min={1} max={3} step={0.05} onChange={(value) => patchTypography({ lineHeight: value })} />
        <NumberField label="الوزن" value={draft.typography.fontWeight} min={300} max={900} step={100} onChange={(value) => patchTypography({ fontWeight: value })} />
      </div>
      <div className="relative"><Search className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><Input value={fontSearch} onChange={(event) => setFontSearch(event.target.value)} placeholder="بحث عن خط" className="h-7 pr-7 text-[10px]" /></div>
      <div className="space-y-0.5">
        {PROFESSIONAL_FONTS.filter((font) => font.name.toLowerCase().includes(fontSearch.trim().toLowerCase())).map((font) => {
          const active = draft.typography.fontFamily === font.family;
          return (
            <button key={font.name} type="button" onClick={() => patchTypography({ fontFamily: font.family, headingFontFamily: font.family, googleFontUrl: font.url || undefined })} className={cn("flex h-8 w-full items-center justify-between gap-2 rounded-md border px-2 text-right", active ? "border-[#0C447C] bg-sky-50" : "border-transparent bg-slate-50 hover:border-slate-200")}>
              {font.url ? <style>{`@import url('${font.url}');`}</style> : null}
              <span className="text-[13px] font-bold text-slate-800" style={{ fontFamily: font.family }}>تقرير تقييم معتمد</span>
              <span dir="ltr" className={cn("text-[9px] font-black", active ? "text-[#0C447C]" : "text-slate-400")}>{font.name}</span>
            </button>
          );
        })}
      </div>
      <Label className="grid gap-0.5">
        <span className="text-[9px] font-black text-slate-500">رابط Google Fonts</span>
        <Input dir="ltr" value={draft.typography.googleFontUrl ?? ""} placeholder="https://fonts.googleapis.com/css2?family=..." onChange={(event) => { const url = event.target.value.trim(); if (!url || /^https:\/\/fonts\.googleapis\.com\//i.test(url)) patchTypography({ googleFontUrl: url || undefined }); }} className="h-7 text-left text-[9px]" />
      </Label>
    </div>
  );

  const reportError = (message: string) => setError(message);
  const imagesPanel = (
    <div className="space-y-1">
      {page === "cover" ? <ImageField label="خلفية الغلاف" value={draft.assets.coverBackgroundImage} onChange={(value) => patchAsset("coverBackgroundImage", value)} onError={reportError} /> : null}
      {page === "closing" ? <ImageField label="خلفية الخاتمة" value={draft.assets.closingBackgroundImage} onChange={(value) => patchAsset("closingBackgroundImage", value)} onError={reportError} /> : null}
      {page === "interior" ? (
        <>
          <ImageField label="خلفية الصفحات الطولية" value={draft.assets.portraitPageBackgroundImage} onChange={(value) => patchAsset("portraitPageBackgroundImage", value)} onError={reportError} />
          <ImageField label="خلفية الصفحات العرضية" value={draft.assets.landscapePageBackgroundImage} onChange={(value) => patchAsset("landscapePageBackgroundImage", value)} onError={reportError} />
          <ImageField label="صورة الترويسة" value={draft.assets.headerImage} onChange={(value) => patchAsset("headerImage", value)} onError={reportError} />
          <ImageField label="صورة التذييل" value={draft.assets.footerImage} onChange={(value) => patchAsset("footerImage", value)} onError={reportError} />
        </>
      ) : null}
      {page !== "interior" || draft.assets.portraitPageBackgroundImage || draft.assets.coverBackgroundImage || draft.assets.closingBackgroundImage ? (
        <div className="grid grid-cols-2 rounded-md bg-slate-100 p-0.5">
          {(["cover", "fill"] as const).map((fit) => (
            <button key={fit} type="button" onClick={() => patchLayout({ backgroundFit: fit })} className={cn("h-6 rounded text-[10px] font-black", draft.layout.backgroundFit === fit ? "bg-white text-[#0C447C] shadow-sm" : "text-slate-500")}>{fit === "cover" ? "تغطية" : "ملء كامل"}</button>
          ))}
        </div>
      ) : null}
    </div>
  );

  const layoutPanel = (
    <div className="space-y-1.5">
      {page === "interior" ? (
        <>
          <NumberField label="الهامش الجانبي" suffix="mm" value={draft.layout.pageMarginMm} min={4} max={30} step={0.5} onChange={(value) => patchLayout({ pageMarginMm: value })} />
          <ToggleRow label="الترويسة" checked={draft.layout.showHeader} onChange={(showHeader) => patchLayout({ showHeader })}>
            {draft.layout.showHeader ? <span className="w-20"><NumberField label="" suffix="mm" value={draft.layout.headerHeightMm} min={0} max={50} step={0.5} onChange={(value) => patchLayout({ headerHeightMm: value })} /></span> : null}
          </ToggleRow>
          <ToggleRow label="التذييل" checked={draft.layout.showFooter} onChange={(showFooter) => patchLayout({ showFooter })}>
            {draft.layout.showFooter ? <span className="w-20"><NumberField label="" suffix="mm" value={draft.layout.footerHeightMm} min={0} max={50} step={0.5} onChange={(value) => patchLayout({ footerHeightMm: value })} /></span> : null}
          </ToggleRow>
          <Button type="button" variant="outline" className="h-7 w-full gap-1 text-[10px] font-black" onClick={fitInteriorZones}><ScanLine className="h-3.5 w-3.5" />ضبط الترويسة والتذييل على العناصر</Button>
          <ToggleRow label="شعار الشركة" checked={draft.layout.showLogo} onChange={(showLogo) => patchLayout({ showLogo })} />
          <ToggleRow label="علامة مائية باسم الشركة" checked={draft.layout.showWatermark} onChange={(showWatermark) => patchLayout({ showWatermark })} />
        </>
      ) : (
        <NumberField label="تعتيم الخلفية" value={closing ? (draft.layout.closingOverlayOpacity ?? draft.layout.coverOverlayOpacity) : draft.layout.coverOverlayOpacity} min={0} max={0.9} step={0.05} onChange={(value) => patchLayout(closing ? { closingOverlayOpacity: value } : { coverOverlayOpacity: value })} />
      )}
      <NumberField label="استدارة حواف الصفحة" suffix="px" value={draft.layout.borderRadiusPx} min={0} max={32} onChange={(value) => patchLayout({ borderRadiusPx: value })} />
    </div>
  );

  const summaryTable: MvCompanyReportSummaryTable = draft.summaryTable ?? { enabled: false, labelColumnPct: SUMMARY_TABLE_DEFAULT_LABEL_PCT, fields: [] };
  const patchSummary = (next: Partial<MvCompanyReportSummaryTable>) => {
    const current = draftRef.current.summaryTable ?? { enabled: false, labelColumnPct: SUMMARY_TABLE_DEFAULT_LABEL_PCT, fields: [] };
    patch({ summaryTable: { ...current, ...next } });
  };
  const summaryFields = summaryTable.fields;
  const summaryKeys = new Set(summaryFields.map((field) => field.sourceKey));
  const addSummaryFields = (entries: Array<{ sourceKey: string; label: string; type: "text" | "textarea" | "number" | "date" }>) => {
    const current = draftRef.current.summaryTable?.fields ?? [];
    const existing = new Set(current.map((field) => field.sourceKey));
    const added = entries
      .filter((entry) => !existing.has(entry.sourceKey))
      .map((entry, index) => ({ id: `summary-${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 6)}`, sourceKey: entry.sourceKey, label: entry.label, type: entry.type }));
    patchSummary({ fields: [...current, ...added].slice(0, SUMMARY_TABLE_MAX_FIELDS) });
  };
  const moveSummaryField = (index: number, delta: -1 | 1) => {
    const next = [...summaryFields];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    patchSummary({ fields: next });
  };
  const activeSummaryGroup = summaryCatalog.find((group) => group.modelId === summaryModelId) ?? summaryCatalog[0];
  const summarySearchText = summarySearch.trim();
  const visibleSummaryFields = (activeSummaryGroup?.fields ?? []).filter((field) => !summarySearchText || `${field.label} ${field.sectionTitle}`.includes(summarySearchText));
  const summaryPanel = (
    <div className="space-y-1.5" onPointerDownCapture={() => { if (page !== "interior") setPage("interior"); }} data-testid="summary-table-panel">
      <ToggleRow
        label="جدول في الملخص التنفيذي"
        checked={summaryTable.enabled}
        onChange={(enabled) => {
          if (enabled && summaryFields.length === 0) {
            const catalogFields = summaryCatalog.flatMap((group) => group.fields);
            const defaults = SUMMARY_DEFAULT_KEYS.flatMap((key) => catalogFields.find((field) => field.sourceKey === key) ?? []);
            const current = draftRef.current.summaryTable ?? { enabled: false, labelColumnPct: SUMMARY_TABLE_DEFAULT_LABEL_PCT, fields: [] };
            patch({ summaryTable: { ...current, enabled: true, fields: defaults.map((field, index) => ({ id: `summary-${Date.now().toString(36)}-${index}`, sourceKey: field.sourceKey, label: field.label, type: field.type })) } });
            return;
          }
          patchSummary({ enabled });
        }}
      />
      {summaryTable.enabled ? (
        <>
          <Input aria-label="عنوان الجدول" value={summaryTable.title ?? ""} placeholder="عنوان الجدول" maxLength={180} onChange={(event) => patchSummary({ title: event.target.value })} className="h-7 px-2 text-[10.5px] font-bold md:text-[10.5px]" />
          <NumberField label="عرض عمود الحقول" suffix="%" value={summaryTable.labelColumnPct ?? SUMMARY_TABLE_DEFAULT_LABEL_PCT} min={20} max={70} onChange={(labelColumnPct) => patchSummary({ labelColumnPct })} />
          <SectionTitle>حقول الجدول ({summaryFields.length})</SectionTitle>
          <div className="space-y-0.5" data-testid="summary-table-fields">
            {summaryFields.map((field, index) => {
              const custom = field.sourceKey === SUMMARY_CUSTOM_ROW_KEY;
              const expanded = custom || expandedSummaryRow === field.id || Boolean(field.valueTemplate);
              const setRow = (next: Partial<typeof field>) => patchSummary({ fields: summaryFields.map((item) => item.id === field.id ? { ...item, ...next } : item) });
              return (
              <div key={field.id} className={cn("rounded-md border bg-white p-0.5", field.valueTemplate || custom ? "border-sky-200" : "border-slate-200")}>
              <div className="flex items-center gap-0.5">
                <Input aria-label={`اسم الحقل ${index + 1}`} value={field.label} maxLength={180} onChange={(event) => patchSummary({ fields: summaryFields.map((item) => item.id === field.id ? { ...item, label: event.target.value } : item) })} className="h-6 min-w-0 flex-1 border-0 px-1.5 text-[10.5px] font-bold shadow-none focus-visible:ring-1 md:text-[10.5px]" />
                <button type="button" className="flex h-6 w-5 items-center justify-center text-slate-400 hover:text-slate-800 disabled:opacity-30" disabled={index === 0} title="أعلى" aria-label={`نقل ${field.label} لأعلى`} onClick={() => moveSummaryField(index, -1)}><ArrowUp className="h-3 w-3" /></button>
                <button type="button" className="flex h-6 w-5 items-center justify-center text-slate-400 hover:text-slate-800 disabled:opacity-30" disabled={index === summaryFields.length - 1} title="أسفل" aria-label={`نقل ${field.label} لأسفل`} onClick={() => moveSummaryField(index, 1)}><ArrowDown className="h-3 w-3" /></button>
                {!custom ? (
                  <button type="button" className={cn("flex h-6 w-5 items-center justify-center hover:text-[#0C447C]", expanded ? "text-[#0C447C]" : "text-slate-400")} title="تعديل القيمة" aria-label={`تعديل قيمة ${field.label}`} aria-pressed={expanded} onClick={() => setExpandedSummaryRow((current) => current === field.id ? null : field.id)}><Pencil className="h-3 w-3" /></button>
                ) : null}
                <button type="button" className="flex h-6 w-5 items-center justify-center text-slate-300 hover:text-rose-600" title="حذف" aria-label={`حذف ${field.label} من الجدول`} onClick={() => patchSummary({ fields: summaryFields.filter((item) => item.id !== field.id) })}><Trash2 className="h-3 w-3" /></button>
              </div>
              {expanded ? (
                <div className="mt-0.5 space-y-0.5 border-t border-slate-100 pt-0.5">
                  <Textarea
                    aria-label={`قيمة الحقل ${index + 1}`}
                    value={field.valueTemplate ?? ""}
                    rows={2}
                    maxLength={1000}
                    placeholder={custom ? "القيمة" : `{{${field.sourceKey}}}`}
                    onChange={(event) => setRow({ valueTemplate: event.target.value })}
                    className="min-h-0 px-1.5 py-1 text-[10.5px] font-semibold md:text-[10.5px]"
                  />
                  <TemplateVariableSelect
                    options={variableCatalog}
                    onInsert={(token) => {
                      const current = field.valueTemplate ?? "";
                      setRow({ valueTemplate: current ? `${current}${/\s$/.test(current) ? "" : " "}${token}` : token });
                    }}
                  />
                </div>
              ) : null}
              </div>
              );
            })}
          </div>
          <SectionTitle>إضافة حقول</SectionTitle>
          {summaryCatalog.length > 1 ? (
            <div className="flex flex-wrap gap-0.5">
              {summaryCatalog.map((group) => (
                <button key={group.modelId} type="button" onClick={() => setSummaryModelId(group.modelId)} className={cn("h-6 rounded-md border px-2 text-[9.5px] font-black", group.modelId === activeSummaryGroup?.modelId ? "border-[#0C447C] bg-[#0C447C] text-white" : "border-slate-200 bg-white text-slate-600 hover:border-sky-300")}>{group.modelName}</button>
              ))}
            </div>
          ) : null}
          <div className="flex gap-1">
            <div className="relative min-w-0 flex-1"><Search className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" /><Input value={summarySearch} onChange={(event) => setSummarySearch(event.target.value)} placeholder="بحث" aria-label="بحث في الحقول" className="h-7 pr-6 text-[10px] md:text-[10px]" /></div>
            <Button type="button" variant="outline" className="h-7 px-2 text-[10px] font-black" onClick={() => addSummaryFields(visibleSummaryFields)}>إضافة الكل</Button>
            <Button
              type="button"
              variant="outline"
              className="h-7 gap-1 px-2 text-[10px] font-black"
              onClick={() => {
                const current = draftRef.current.summaryTable?.fields ?? [];
                const id = `summary-custom-${Date.now().toString(36)}`;
                patchSummary({ fields: [...current, { id, sourceKey: SUMMARY_CUSTOM_ROW_KEY, label: "بند جديد", type: "text" as const, valueTemplate: "" }].slice(0, SUMMARY_TABLE_MAX_FIELDS) });
                setExpandedSummaryRow(id);
              }}
            ><Plus className="h-3 w-3" />صف مخصص</Button>
          </div>
          <div className="grid grid-cols-2 gap-0.5" data-testid="summary-table-catalog">
            {visibleSummaryFields.map((field) => {
              const added = summaryKeys.has(field.sourceKey);
              return (
                <button
                  key={field.sourceKey}
                  type="button"
                  title={field.sectionTitle}
                  aria-pressed={added}
                  onClick={() => added ? patchSummary({ fields: summaryFields.filter((item) => item.sourceKey !== field.sourceKey) }) : addSummaryFields([field])}
                  className={cn("flex h-7 min-w-0 items-center gap-1 rounded-md border px-1.5 text-right text-[9.5px] font-black", added ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50")}
                >
                  {added ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <Plus className="h-3 w-3 shrink-0 text-slate-400" />}
                  <span className="truncate">{field.label}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );

  const panels: SystemTemplateEditorPanel[] = [
    { key: "colors", label: "الألوان", icon: <Palette className="h-3.5 w-3.5" />, content: colorsPanel },
    { key: "fonts", label: "الخطوط", icon: <Type className="h-3.5 w-3.5" />, content: fontsPanel },
    { key: "images", label: "الصور", icon: <FileImage className="h-3.5 w-3.5" />, content: imagesPanel },
    { key: "layout", label: "التخطيط", icon: <Ruler className="h-3.5 w-3.5" />, content: layoutPanel },
    { key: "summary", label: "الجدول", icon: <Table2 className="h-3.5 w-3.5" />, content: summaryPanel },
  ];

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;

  return (
    <>
      <section className="space-y-2" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <div className="flex min-w-0 items-center gap-2">
            <LayoutTemplate className="h-4 w-4 shrink-0 text-[#0C447C]" />
            <h3 className="text-[14px] font-black text-slate-900">مكتبة قوالب النظام</h3>
            <Badge className="truncate rounded-full bg-sky-50 text-[10px] text-[#0C447C] shadow-none hover:bg-sky-50">المعتمد: {selectedName}</Badge>
          </div>
          <Button type="button" onClick={openNew} disabled={disabled} className="h-8 gap-1 rounded-lg bg-[#0C447C] px-3 text-[11px] font-black"><Plus className="h-4 w-4" />قالب جديد</Button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          <article className={cn("overflow-hidden rounded-xl border bg-white shadow-sm", officialSelected ? "border-[#0C447C] ring-2 ring-[#0C447C]/15" : "border-slate-200")}>
            <div className="relative overflow-hidden bg-slate-100 py-2">{officialPreview}<Button type="button" size="icon" variant="secondary" className="absolute left-2 top-2 h-7 w-7 rounded-full bg-white shadow-sm" title="معاينة" aria-label="معاينة القالب الرسمي" onClick={onPreviewOfficial}><Eye className="h-3.5 w-3.5" /></Button></div>
            <div className="space-y-1.5 p-2">
              <div className="flex items-center justify-between gap-1"><h4 className="truncate text-[12px] font-black">Value Tech الرسمي</h4>{officialSelected ? <Badge className="gap-0.5 bg-[#0C447C] px-1.5 text-[9px]"><CheckCircle2 className="h-3 w-3" />معتمد</Badge> : <Badge variant="secondary" className="px-1.5 text-[9px]">رسمي</Badge>}</div>
              <Button type="button" className="h-7 w-full rounded-md bg-[#0C447C] text-[10px] font-black" variant={officialSelected ? "outline" : "default"} disabled={disabled || officialSelected} onClick={() => void persistLibrary(templates, "default-report-template", "library")}>{officialSelected ? "القالب المعتمد" : "اعتماد"}</Button>
            </div>
          </article>

          {templates.map((template) => {
            const selected = template.id === selectedTemplateId;
            const deleting = pendingDelete === template.id;
            return (
              <article key={template.id} className={cn("overflow-hidden rounded-xl border bg-white shadow-sm", selected ? "border-[#0C447C] ring-2 ring-[#0C447C]/15" : "border-slate-200")}>
                <button type="button" className="block w-full bg-slate-100 p-2" title="تحرير" onClick={() => startEditing(template)}>
                  <div className="mx-auto aspect-[210/297] w-full max-w-[220px]"><SystemTemplateReportPreview template={template} page="cover" data={companyData} /></div>
                </button>
                <div className="space-y-1.5 p-2">
                  <div className="flex items-center justify-between gap-1"><h4 className="truncate text-[12px] font-black" title={template.name}>{template.name}</h4>{selected ? <Badge className="gap-0.5 bg-[#0C447C] px-1.5 text-[9px]"><CheckCircle2 className="h-3 w-3" />معتمد</Badge> : null}</div>
                  {deleting ? (
                    <div className="grid grid-cols-2 gap-1">
                      <Button type="button" size="sm" variant="destructive" className="h-7 text-[10px] font-black" onClick={() => { void persistLibrary(templates.filter((item) => item.id !== template.id), selectedTemplateId === template.id ? "default-report-template" : selectedTemplateId, "library").then((ok) => { if (ok) setPendingDelete(null); }); }}>تأكيد الحذف</Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-[10px] font-black" onClick={() => setPendingDelete(null)}>تراجع</Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Button type="button" className="h-7 flex-1 rounded-md bg-[#0C447C] px-1 text-[10px] font-black" variant={selected ? "outline" : "default"} disabled={disabled || selected || Boolean(saving)} onClick={() => void persistLibrary(templates, template.id, "library")}>{selected ? "المعتمد" : "اعتماد"}</Button>
                      <Button type="button" size="icon" variant="outline" className="h-7 w-7" title="تحرير" aria-label={`تحرير ${template.name}`} onClick={() => startEditing(template)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="icon" variant="outline" className="h-7 w-7" title="نسخ" aria-label={`نسخ ${template.name}`} disabled={Boolean(saving)} onClick={() => void persistLibrary([...templates, cloneSystemTemplate(template)], selectedTemplateId, "library")}><Copy className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="icon" variant="outline" className="h-7 w-7 text-rose-600" title={selected ? "لا يمكن حذف القالب المعتمد" : "حذف"} aria-label={`حذف ${template.name}`} disabled={selected} onClick={() => setPendingDelete(template.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          <button type="button" onClick={openNew} disabled={disabled} className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sky-200 bg-sky-50/40 text-[12px] font-black text-[#0C447C] transition hover:border-[#0C447C] hover:bg-sky-50 disabled:opacity-50">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0C447C] text-white shadow"><Plus className="h-6 w-6" /></span>
            قالب جديد
          </button>
        </div>
      </section>

      <Dialog open={editorOpen} onOpenChange={(open) => { if (open) setEditorOpen(true); else requestClose(); }}>
        <DialogContent className="!fixed !inset-0 flex !h-auto !w-auto !max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden rounded-none bg-slate-50 p-0 sm:!inset-1 sm:rounded-lg" hideCloseButton dir="rtl" onEscapeKeyDown={(event) => event.preventDefault()}>
          {draft.typography.googleFontUrl ? <style>{`@import url('${draft.typography.googleFontUrl}');`}</style> : null}
          <DialogHeader className="shrink-0 space-y-0 border-b border-slate-200 bg-white px-1.5 py-1 text-right">
            <DialogTitle className="sr-only">استوديو إنشاء قالب النظام</DialogTitle>
            <DialogDescription className="sr-only">تصميم صفحات الغلاف والصفحات الداخلية والخاتمة للتقرير النهائي.</DialogDescription>
            <div className="flex flex-wrap items-center gap-1.5">
              <Settings2 className="h-4 w-4 shrink-0 text-[#0C447C]" />
              <Input aria-label="اسم القالب" value={draft.name} maxLength={120} onChange={(event) => patch({ name: event.target.value })} className="h-8 w-full min-w-0 bg-white px-2 text-[12px] font-black sm:w-[240px]" />
              <div className="grid h-8 grid-cols-3 gap-0.5 rounded-lg bg-slate-100 p-0.5" role="tablist" aria-label="صفحة التصميم">
                {(Object.keys(PAGE_LABELS) as StudioPage[]).map((key) => (
                  <button key={key} type="button" role="tab" aria-selected={page === key} data-testid={`template-page-${key}`} onClick={() => setPage(key)} className={cn("rounded-md px-3 text-[10px] font-black", page === key ? "bg-[#0C447C] text-white shadow" : "text-slate-600 hover:bg-white")}>{PAGE_LABELS[key]}</button>
                ))}
              </div>
              <div className="flex gap-0.5">
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={!canUndo} title="تراجع (Ctrl+Z)" aria-label="تراجع" onClick={undo}><Undo2 className="h-4 w-4" /></Button>
                <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={!canRedo} title="إعادة (Ctrl+Y)" aria-label="إعادة" onClick={redo}><Redo2 className="h-4 w-4" /></Button>
              </div>
              {error ? <p role="alert" className="flex min-w-0 max-w-full items-center gap-1 truncate rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700">{error}<button type="button" aria-label="إغلاق التنبيه" onClick={() => setError(null)}><X className="h-3 w-3" /></button></p> : null}
              <div className="ms-auto flex items-center gap-1">
                {confirmDiscard ? (
                  <>
                    <span className="text-[10px] font-black text-amber-700">تجاهل التعديلات غير المحفوظة؟</span>
                    <Button type="button" variant="destructive" className="h-8 px-2.5 text-[10px] font-black" onClick={() => { setConfirmDiscard(false); setEditorOpen(false); }}>تجاهل</Button>
                    <Button type="button" variant="outline" className="h-8 px-2.5 text-[10px] font-black" onClick={() => setConfirmDiscard(false)}>متابعة التحرير</Button>
                  </>
                ) : (
                  <>
                    <Button type="button" variant="outline" className="h-8 gap-1 px-2.5 text-[10px] font-black" disabled={Boolean(saving)} onClick={() => void save(false)}>{saving === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}حفظ</Button>
                    <Button type="button" className="h-8 gap-1 bg-[#0C447C] px-2.5 text-[10px] font-black" disabled={Boolean(saving)} onClick={() => void save(true)}>{saving === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}حفظ واعتماد</Button>
                  </>
                )}
              </div>
              <button
                type="button"
                aria-label="إغلاق"
                title="إغلاق"
                data-testid="system-template-studio-close"
                onClick={requestClose}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-rose-600 text-white shadow-sm transition hover:bg-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300",
                  isEnglishUi ? "order-first" : "order-last",
                )}
              ><X className="h-4 w-4" strokeWidth={3} /></button>
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 p-1">
            <SystemTemplateCanvasEditor
              template={draft}
              page={page}
              bindings={bindings}
              panels={panels}
              variables={variableCatalog}
              renderPreview={(previewPage) => <SystemTemplateReportPreview template={draft} page={previewPage} data={companyData} />}
              onChange={updateCanvasElements}
              onError={setError}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
