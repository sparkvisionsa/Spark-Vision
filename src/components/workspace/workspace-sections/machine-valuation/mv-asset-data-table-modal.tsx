"use client";
import { useResourceRefresh } from "@/components/support/realtime-provider";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  Columns2,
  Database,
  Download,
  Eye,
  EyeOff,
  FileAudio,
  FileSpreadsheet,
  Filter,
  FolderTree,
  GripVertical,
  ImageIcon,
  Layers,
  Loader2,
  Maximize2,
  Minimize2,
  Pin,
  RotateCcw,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  Car,
  Package,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { MvDialogContent } from "./mv-dialog";
import { MvImageZoomDialog } from "./mv-report-images-select-modal";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  buildPhotosRootAssetEntries,
  entryHasFullPicAssetMedia,
  fetchPicAssetDetail,
  hydratePicAssetEntriesProgressive,
  mergePicAssetPreferFull,
  mergePicAssetFromApi,
  picAssetNeedsMediaFetch,
  type PicAssetFolderEntry,
} from "./mv-pic-asset-progressive-load";
import { writePicAssetFoldersSessionCache } from "./mv-pic-asset-session-cache";
import {
  MV_WORKFLOW_SESSION,
  readMvWorkflowSessionJson,
} from "./mv-workflow-session-cache";
import { buildAssetParentFolderPath } from "./mv-subproject-helpers";
import type { MvSubProject, PicAsset, PicAssetImage, PicAssetVoiceNote } from "./types"
import { patchMvSubprojectPicAsset } from "./mv-pic-asset-panel";
import { getAssetTypeMeta, useMvI18n, type MvT } from "./mv-i18n";
import {
  EMPTY_ASSET_DESCRIPTION_CATALOG,
  fetchAssetDescriptionCatalog,
  formatAssetDescriptionLabel,
  type AssetDescriptionCatalog,
} from "@/lib/company-asset-descriptions";

const TABLE_PAGE_SIZES = [5, 10, 50, 100] as const;
type TablePageSize = (typeof TABLE_PAGE_SIZES)[number];
const DEFAULT_TABLE_PAGE_SIZE: TablePageSize = 10;
const ASSET_TABLE_COLUMN_PREFERENCES_KEY = "mv:asset-data-table:columns:v1";
const PINNED_ASSET_IMAGE_COLUMN_KEY = "preview";

type AssetTab = "vehicles" | "other";
type AssetExportLayout = "standard" | "current";

interface PreviewEntry extends PicAssetFolderEntry {}

const ASSET_TYPE_ALIASES: Record<string, "vehicles" | "machinery" | "electronics" | "furniture" | "other"> = {
  vehicle: "vehicles",
  car: "vehicles",
  cars: "vehicles",
  machinery: "machinery",
  machine: "machinery",
  electronics: "electronics",
  electronic: "electronics",
  furniture: "furniture",
  other: "other",
};

type TableFormatContext = {
  t: MvT;
  numberFormatter: Intl.NumberFormat;
  dateFormatter: Intl.DateTimeFormat;
  notAvailable: string;
};

function createTableFormatContext(isArabic: boolean, t: MvT): TableFormatContext {
  return {
    t,
    notAvailable: t("common.notAvailable"),
    numberFormatter: createNumberFormatter(isArabic),
    dateFormatter: createDateFormatter(isArabic),
  };
}

function createNumberFormatter(isArabic: boolean) {
  return new Intl.NumberFormat(isArabic ? "ar-SA" : "en-US");
}

function createDateFormatter(isArabic: boolean) {
  return new Intl.DateTimeFormat(isArabic ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** نوع الأصل بصيغة موحّدة لعرض الجدول. */
function assetTypeLabel(value: unknown, tr: MvT): string {
  if (typeof value !== "string") return "—";
  const meta = getAssetTypeMeta(tr);
  const key = value.toLowerCase();
  if (key in meta) return meta[key as keyof typeof meta].label;
  const mapped = ASSET_TYPE_ALIASES[key];
  if (mapped) return meta[mapped].label;
  return value || "—";
}

/** قراءة ‎subAssetType‎ كما يُرسل من الـ API (نص حر من كولكشن ‎assets‎). */
function readSubAssetType(pic: PicAsset | null | undefined): string {
  if (!pic) return "";
  const v = pic.subAssetType;
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/** قراءة الكمية كما تُرسل من الـ API. */
function readQuantity(pic: PicAsset | null | undefined): string {
  if (!pic || pic.quantity == null) return "";
  if (typeof pic.quantity === "number" && Number.isFinite(pic.quantity)) {
    return String(pic.quantity);
  }
  if (typeof pic.quantity === "string") return pic.quantity.trim();
  return "";
}

function quantityLabel(pic: PicAsset | null | undefined, ctx: TableFormatContext): string {
  const raw = readQuantity(pic);
  if (!raw) return ctx.notAvailable;
  const n = Number(raw);
  return Number.isFinite(n) ? ctx.numberFormatter.format(n) : raw;
}

function assetDescriptionText(pic: PicAsset | null | undefined, fallback: string): string {
  return formatAssetDescriptionLabel(pic?.assetDescription) || fallback;
}

function picAssetName(pic: PicAsset | null | undefined, fallback = ""): string {
  const name = typeof pic?.name === "string" ? pic.name.trim() : "";
  if (name) return name;
  const label = typeof pic?.lable === "string" ? pic.lable.trim() : "";
  return label || fallback;
}

function picAssetCategory(pic: PicAsset | null | undefined): string {
  return typeof pic?.category === "string" ? pic.category.trim() : "";
}

function picAssetKind(pic: PicAsset | null | undefined): string {
  return typeof pic?.type === "string" ? pic.type.trim() : "";
}

/** رابط الصورة الرئيسية من ‎assets.images.main.url‎. */
function picAssetMainImageUrl(pic: PicAsset | null | undefined): string {
  const image = pic?.mainImage;
  if (!image || typeof image !== "object") return "";
  const url = "url" in image && typeof image.url === "string" ? image.url.trim() : "";
  return url;
}

function uniqueCatalogLabels(items: { label: string }[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const item of items) {
    const label = item.label.trim();
    const key = label.toLocaleLowerCase("ar");
    if (!label || seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

function locationValue(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** مكان الأصل من ‎assets.asset_location‎ في الجذر. */
function originalAssetLocationText(pic: PicAsset | null | undefined, ctx: TableFormatContext): string {
  return locationValue(pic?.asset_location) || ctx.t("projects.assetTable.columns.assetLocationNoData");
}

/**
 * مكان الأصل الحالي:
 * - ‎newAssetLocation‎ عند وجوده.
 * - «لم يتغير» عندما يوجد مكان أصلي فقط.
 * - «لا يوجد» عندما تغيب القيمتان.
 */
function currentAssetLocationText(pic: PicAsset | null | undefined, ctx: TableFormatContext): string {
  const currentLocation = locationValue(pic?.newAssetLocation);
  if (currentLocation) return currentLocation;
  if (locationValue(pic?.asset_location)) {
    return ctx.t("projects.assetTable.columns.assetLocationUnchanged");
  }
  return ctx.t("projects.assetTable.columns.assetLocationNoData");
}

type EditableAssetField =
  | "lable"
  | "asset_location"
  | "brand"
  | "model"
  | "manufactureYear"
  | "kilometersDriven"
  | "condition"
  | "notes"
  | "category"
  | "type"
  | "assetDescription";

function fieldRawValue(row: AssetTableRow, field: EditableAssetField): string {
  const pic = row.picAsset;
  if (field === "lable") return picAssetName(pic, row.sub.name ?? "");
  if (field === "category") return picAssetCategory(pic);
  if (field === "type") return picAssetKind(pic);
  if (field === "assetDescription") return assetDescriptionText(pic, "");
  if (field === "asset_location") return typeof pic?.asset_location === "string" ? pic.asset_location.trim() : "";
  if (!pic) return "";
  if (field === "brand") return typeof pic.brand === "string" ? pic.brand.trim() : "";
  if (field === "model") return typeof pic.model === "string" ? pic.model.trim() : "";
  if (field === "manufactureYear") return pic.manufactureYear != null ? String(pic.manufactureYear).trim() : "";
  if (field === "kilometersDriven") return pic.kilometersDriven != null ? String(pic.kilometersDriven).trim() : "";
  if (field === "condition" || field === "notes") {
    const v = pic[field];
    return typeof v === "string" ? v.trim() : "";
  }
  return "";
}

function EditableTextCell({
  value,
  onSave,
  multiline,
  saving,
  required,
  placeholder,
}: {
  value: string;
  onSave: (next: string) => Promise<void>;
  multiline?: boolean;
  saving?: boolean;
  required?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const previousServerValue = useRef(value);
  useEffect(() => {
    const previous = previousServerValue.current;
    previousServerValue.current = value;
    setDraft(current => current === previous ? value : current);
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (required && !trimmed) {
      setDraft(value);
      return;
    }
    if (trimmed === value.trim()) return;
    void onSave(trimmed).catch(() => setDraft(value));
  };

  const sharedClass =
    "w-full min-w-[88px] rounded border border-transparent bg-white/80 px-1.5 py-0.5 text-[11px] text-slate-800 shadow-sm transition hover:border-slate-200 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:opacity-60";

  return (
    <div className="relative mx-auto w-full max-w-none">
      {multiline ? (
        <textarea
          value={draft}
          rows={3}
          dir="auto"
          disabled={saving}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(value);
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          className={cn(sharedClass, "min-h-[3.5rem] resize-y whitespace-pre-wrap break-words leading-relaxed")}
        />
      ) : (
        <input
          type="text"
          value={draft}
          dir="auto"
          disabled={saving}
          placeholder={placeholder}
          title={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === "Escape") {
              setDraft(value);
              (e.target as HTMLInputElement).blur();
            }
          }}
          className={sharedClass}
        />
      )}
      {saving ? (
        <Loader2 className="pointer-events-none absolute left-1 top-1.5 h-3.5 w-3.5 animate-spin text-sky-500" />
      ) : null}
    </div>
  );
}

/**
 * حقل قابل للكتابة مع قائمة اقتراحات من مواقع الأصول الموجودة في المشروع.
 * يبقى إدخال النص متاحاً حتى يمكن تصحيح قيمة خيار أو إضافة مكان جديد مباشرة.
 */
function AssetLocationSelectCell({
  value,
  options,
  onSave,
  saving,
  placeholder,
}: {
  value: string;
  options: string[];
  onSave: (next: string) => Promise<void>;
  saving?: boolean;
  placeholder: string;
}) {
  const [draft, setDraft] = useState(value);
  const listId = `asset-location-options-${useId()}`;

  const previousServerValue = useRef(value);
  useEffect(() => {
    const previous = previousServerValue.current;
    previousServerValue.current = value;
    setDraft(current => current === previous ? value : current);
  }, [value]);

  const commit = () => {
    const next = draft.trim();
    if (next === value.trim()) return;
    void onSave(next).catch(() => setDraft(value));
  };

  return (
    <div className="relative mx-auto max-w-[220px]">
      <input
        value={draft}
        list={listId}
        dir="auto"
        disabled={saving}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setDraft(value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-full rounded-md border border-transparent bg-white/80 px-2 py-1 text-[12px] text-slate-800 shadow-sm transition hover:border-slate-200 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      {saving ? (
        <Loader2 className="pointer-events-none absolute left-1 top-1.5 h-3.5 w-3.5 animate-spin text-sky-500" />
      ) : null}
    </div>
  );
}

function CatalogLabelSelectCell({
  value,
  options,
  saving,
  placeholder,
  emptyHint,
  searchPlaceholder,
  notAvailable,
  onSave,
}: {
  value: string;
  options: string[];
  saving?: boolean;
  placeholder: string;
  emptyHint: string;
  searchPlaceholder: string;
  notAvailable: string;
  onSave: (next: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const labels = useMemo(() => {
    const next = [...options];
    if (value && !next.some((item) => item === value)) next.unshift(value);
    return next;
  }, [options, value]);
  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("ar");
    if (!needle) return labels;
    return labels.filter((item) => item.toLocaleLowerCase("ar").includes(needle));
  }, [labels, q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative mx-auto min-w-[160px] max-w-[240px] text-right">
      <button
        type="button"
        disabled={saving}
        dir="rtl"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-1 rounded-md border border-transparent bg-white/80 px-2 py-1 text-[12px] text-slate-800 shadow-sm transition hover:border-slate-200 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
      >
        <span className={cn("truncate", !value && "text-slate-400")}>{value || placeholder}</span>
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sky-500" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        )}
      </button>
      {open ? (
        <div className="absolute z-40 mt-1 w-[min(18rem,70vw)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="relative mb-1.5">
            <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 rounded-lg border-slate-200 pe-7 text-[12px]"
              dir="auto"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            <button
              type="button"
              className="mb-1 w-full rounded-md px-2 py-1 text-right text-[11px] text-slate-400 hover:bg-slate-50"
              onClick={() => {
                setOpen(false);
                if (value) void onSave("");
              }}
            >
              {notAvailable}
            </button>
            {filtered.length === 0 ? (
              <p className="px-2 py-3 text-[11px] text-slate-400">{emptyHint}</p>
            ) : (
              filtered.map((label) => (
                <button
                  key={label}
                  type="button"
                  dir="auto"
                  className={cn(
                    "flex w-full rounded-md px-2 py-1.5 text-right text-[12px] hover:bg-sky-50",
                    label === value && "bg-sky-50 font-semibold text-sky-800",
                  )}
                  onClick={() => {
                    setOpen(false);
                    if (label !== value) void onSave(label);
                  }}
                >
                  {label}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isVehicleAsset(t: unknown): boolean {
  if (typeof t !== "string") return false;
  const k = t.toLowerCase();
  return k === "vehicles" || k === "vehicle" || k === "car" || k === "cars";
}

/** نص بحث شامل — كل حقول الأصل المعروضة والمخفية. */
function buildAssetSearchText(row: AssetTableRow, ctx: TableFormatContext): string {
  const pic = row.picAsset;
  const imageCount =
    pic && Array.isArray(pic.images) && pic.images.length > 0
      ? pic.images.length
      : typeof pic?.imageCount === "number"
        ? pic.imageCount
        : 0;
  const voiceCount =
    pic && Array.isArray(pic.voiceNotes) && pic.voiceNotes.length > 0
      ? pic.voiceNotes.length
      : typeof pic?.voiceNoteCount === "number"
        ? pic.voiceNoteCount
        : 0;
  const parts = [
    row.parentPath,
    pic?.lable,
    pic?.name ?? row.sub.name,
    pic?._id,
    pic?.subAssetType,
    assetDescriptionText(pic, ""),
    pic?.assetDescription?.category,
    pic?.assetDescription?.type,
    pic?.assetDescription?.name,
    pic?.category,
    pic?.type,
    pic?.asset_location,
    pic?.newAssetLocation,
    readSubAssetType(pic),
    readQuantity(pic),
    pic?.brand,
    pic?.model,
    pic?.code,
    pic?.client_code,
    pic?.employer,
    pic?.val_tech_id,
    picAssetMainImageUrl(pic),
    pic?.asset_source,
    pic?.condition,
    formatCondition(pic?.condition, ctx),
    pic?.notes,
    pic?.assetType,
    assetTypeLabel(pic?.assetType, ctx.t),
    formatNumberish(pic?.quantity, ctx),
    formatNumberish(pic?.manufactureYear, ctx),
    formatNumberish(pic?.kilometersDriven, ctx),
    formatBool(pic?.isPresent, ctx),
    formatBool(pic?.isDone, ctx),
    formatDate(pic?.createdAt ?? row.sub.createdAt, ctx),
    formatDate(pic?.updatedAt ?? row.sub.updatedAt, ctx),
    imageCount > 0 ? String(imageCount) : "",
    voiceCount > 0 ? String(voiceCount) : "",
  ];
  return parts
    .filter((p) => typeof p === "string" && p.trim() && p !== ctx.notAvailable)
    .join(" ")
    .toLowerCase();
}

function imageCountText(r: AssetTableRow, ctx: TableFormatContext): string {
  const arr = normalizePicAssetImages(r.picAsset);
  const c =
    arr.length > 0
      ? arr.length
      : typeof r.picAsset?.imageCount === "number" && Number.isFinite(r.picAsset.imageCount)
        ? Math.max(0, r.picAsset.imageCount)
        : 0;
  return c === 0 ? ctx.notAvailable : ctx.numberFormatter.format(c);
}

function voiceNotesSummaryText(r: AssetTableRow, ctx: TableFormatContext): string {
  const arr = r.picAsset?.voiceNotes;
  const c =
    Array.isArray(arr) && arr.length > 0
      ? arr.length
      : typeof r.picAsset?.voiceNoteCount === "number" && Number.isFinite(r.picAsset.voiceNoteCount)
        ? Math.max(0, r.picAsset.voiceNoteCount)
        : 0;
  return c === 0 ? "0" : ctx.t("projects.assetTable.voiceClip", { count: ctx.numberFormatter.format(c) });
}

function buildSharedTailColumns(ctx: TableFormatContext): ColumnDef[] {
  const c = (key: string) => ctx.t(`projects.assetTable.columns.${key}`);
  return [
    {
      key: "condition",
      label: c("condition"),
      text: (r) => formatCondition(r.picAsset?.condition, ctx),
      minWidth: 110,
    },
    { key: "isPresent", label: c("isPresent"), text: (r) => formatBool(r.picAsset?.isPresent, ctx), minWidth: 64 },
    { key: "isDone", label: c("isDone"), text: (r) => formatBool(r.picAsset?.isDone, ctx), minWidth: 64 },
    {
      key: "voiceNotes",
      label: c("voiceNotes"),
      text: (r) => voiceNotesSummaryText(r, ctx),
      render: ({ row, projectId }) => (
        <VoiceNotesCell asset={row.picAsset} projectId={projectId} ctx={ctx} />
      ),
      minWidth: 170,
      excludeFromExport: true,
    },
    {
      key: "notes",
      label: c("notes"),
      text: (r) => formatText(r.picAsset?.notes, ctx.notAvailable),
      minWidth: 170,
    },
    {
      key: "createdAt",
      label: c("createdAt"),
      text: (r) => formatDate(r.picAsset?.createdAt ?? r.sub.createdAt, ctx),
      minWidth: 125,
    },
    {
      key: "updatedAt",
      label: c("updatedAt"),
      text: (r) => formatDate(r.picAsset?.updatedAt ?? r.sub.updatedAt, ctx),
      minWidth: 125,
    },
    {
      key: "asset_source",
      label: c("assetSource"),
      text: (r) => formatAssetSource(r.picAsset?.asset_source, ctx),
      minWidth: 100,
    },
  ];
}

function buildLeadingColumns(ctx: TableFormatContext): ColumnDef[] {
  const c = (key: string) => ctx.t(`projects.assetTable.columns.${key}`);
  return [
    { key: "_", label: "#", text: (r) => ctx.numberFormatter.format(r.index + 1), minWidth: 44 },
    {
      key: "val_tech_id",
      label: c("valTechId"),
      text: (r) => formatText(r.picAsset?.val_tech_id, ctx.notAvailable),
      minWidth: 115,
    },
    { key: "preview", label: c("mainImage"), text: (r) => imageCountText(r, ctx), minWidth: 64 },
    {
      key: "mainImageUrl",
      label: c("mainImageUrl"),
      text: (r) => formatText(picAssetMainImageUrl(r.picAsset), ctx.notAvailable),
      minWidth: 180,
      render: ({ row }) => {
        const url = picAssetMainImageUrl(row.picAsset);
        if (!url) return <span className="text-slate-400">{ctx.notAvailable}</span>;
        return (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            dir="ltr"
            className="mx-auto block max-w-[320px] break-all text-left text-[11px] font-medium text-sky-700 hover:underline"
          >
            {url}
          </a>
        );
      },
    },
    {
      key: "lable",
      label: c("lable"),
      text: (r) => formatText(picAssetName(r.picAsset, r.sub.name), ctx.notAvailable),
      minWidth: 130,
    },
    { key: "parentPath", label: c("parentPath"), text: (r) => r.parentPath, minWidth: 160 },
    {
      key: "category",
      label: c("category"),
      text: (r) => formatText(picAssetCategory(r.picAsset), ctx.notAvailable),
      minWidth: 110,
    },
    {
      key: "type",
      label: c("type"),
      text: (r) => formatText(picAssetKind(r.picAsset), ctx.notAvailable),
      minWidth: 120,
    },
    {
      key: "asset_location",
      label: c("assetLocation"),
      text: (r) => originalAssetLocationText(r.picAsset, ctx),
      minWidth: 130,
    },
    {
      key: "newAssetLocation",
      label: c("currentAssetLocation"),
      text: (r) => currentAssetLocationText(r.picAsset, ctx),
      minWidth: 130,
    },
    { key: "client_code", label: c("clientCode"), text: (r) => formatText(r.picAsset?.client_code, ctx.notAvailable), minWidth: 120 },
    { key: "code", label: c("code"), text: (r) => formatText(r.picAsset?.code, ctx.notAvailable), minWidth: 120 },
    { key: "employer", label: c("employer"), text: (r) => formatText(r.picAsset?.employer, ctx.notAvailable), minWidth: 110 },
  ];
}

function buildVehicleColumns(ctx: TableFormatContext): ColumnDef[] {
  const c = (key: string) => ctx.t(`projects.assetTable.columns.${key}`);
  return [
    ...buildLeadingColumns(ctx),
    { key: "brand", label: c("brand"), text: (r) => formatText(r.picAsset?.brand, ctx.notAvailable), minWidth: 90 },
    { key: "model", label: c("model"), text: (r) => formatText(r.picAsset?.model, ctx.notAvailable), minWidth: 90 },
    {
      key: "manufactureYear",
      label: c("manufactureYear"),
      text: (r) => formatNumberish(r.picAsset?.manufactureYear, ctx),
      minWidth: 82,
    },
    {
      key: "kilometersDriven",
      label: c("kilometersDriven"),
      text: (r) => formatNumberish(r.picAsset?.kilometersDriven, ctx),
      minWidth: 95,
    },
    ...buildSharedTailColumns(ctx),
  ];
}

function buildOtherColumns(ctx: TableFormatContext): ColumnDef[] {
  const c = (key: string) => ctx.t(`projects.assetTable.columns.${key}`);
  return [
    ...buildLeadingColumns(ctx),
    {
      key: "quantity",
      label: c("quantity"),
      text: (r) => quantityLabel(r.picAsset, ctx),
      minWidth: 68,
    },
    ...buildSharedTailColumns(ctx),
  ];
}

const EDITABLE_COLUMN_KEYS = new Set([
  "lable",
  "category",
  "type",
  "assetDescription",
  "asset_location",
  "brand",
  "model",
  "manufactureYear",
  "kilometersDriven",
  "condition",
  "notes",
]);

function formatDate(value: string | null | undefined, ctx: TableFormatContext): string {
  if (!value) return ctx.notAvailable;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return ctx.notAvailable;
  return ctx.dateFormatter.format(date);
}

function formatBool(v: boolean | null | undefined, ctx: TableFormatContext): string {
  if (v === true) return ctx.t("common.yes");
  if (v === false) return ctx.t("common.no");
  return ctx.notAvailable;
}

function formatNumberish(v: number | string | null | undefined, ctx: TableFormatContext): string {
  if (v == null) return ctx.notAvailable;
  if (typeof v === "number" && Number.isFinite(v)) return ctx.numberFormatter.format(v);
  const s = String(v).trim();
  return s ? s : ctx.notAvailable;
}

function formatText(v: string | null | undefined, fallback: string): string {
  if (typeof v !== "string") return fallback;
  const trimmed = v.trim();
  return trimmed ? trimmed : fallback;
}

const ASSET_SOURCE_FILTER_KEYS = ["client", "system", "app"] as const;
type AssetSourceFilterKey = (typeof ASSET_SOURCE_FILTER_KEYS)[number];

function normalizeAssetSourceKey(value: string | null | undefined): AssetSourceFilterKey | null {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "عميل" || raw === "client") return "client";
  if (raw === "نظام" || raw === "system") return "system";
  if (raw === "تطبيق" || raw === "app") return "app";
  return null;
}

function assetSourceFilterLabel(key: AssetSourceFilterKey, t: MvT): string {
  if (key === "client") return t("projects.assetTable.columns.assetSourceClient");
  if (key === "system") return t("projects.assetTable.columns.assetSourceSystem");
  return t("projects.assetTable.columns.assetSourceApp");
}

function formatAssetSource(value: string | null | undefined, ctx: TableFormatContext): string {
  const key = normalizeAssetSourceKey(value);
  return key ? assetSourceFilterLabel(key, ctx.t) : ctx.notAvailable;
}

function rowMatchesSourceFilter(row: AssetTableRow, selected: ReadonlySet<AssetSourceFilterKey>): boolean {
  if (selected.size === 0) return true;
  const key = normalizeAssetSourceKey(row.picAsset?.asset_source);
  return key != null && selected.has(key);
}

type ClientRawValue = string | number | boolean | null;
type ClientRawData = Record<string, ClientRawValue>;

const CLIENT_RAW_SYSTEM_KEYS = new Set([
  "notes",
  "quantity",
  "subAssetType",
  "client_code",
  "employer",
  "asset_location",
  "hasNotes",
]);

const CLIENT_SHEET_COLUMN_KEY = "__clientSheetName";

function picAssetRawData(pic: PicAsset | null | undefined): ClientRawData {
  const raw = pic?.rawData;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw;
}

function collectClientRawKeys(rows: AssetTableRow[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(picAssetRawData(row.picAsset))) {
      const field = key.trim();
      if (!field || CLIENT_RAW_SYSTEM_KEYS.has(field) || seen.has(field)) continue;
      seen.add(field);
      keys.push(field);
    }
  }
  return keys;
}

function collectClientSheetNames(rows: AssetTableRow[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const row of rows) {
    const name = row.picAsset?.sheetName?.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

function formatClientRawCell(value: ClientRawValue | undefined): string | number | boolean {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value;
  return String(value);
}

function clientRowsFromExport(rows: AssetTableRow[]): AssetTableRow[] {
  return rows.filter((row) => normalizeAssetSourceKey(row.picAsset?.asset_source) === "client");
}

async function attachClientRawDataToRows(projectId: string, rows: AssetTableRow[]): Promise<AssetTableRow[]> {
  const needsFetch = rows.some((row) => row.picAsset != null && row.picAsset.rawData === undefined);
  if (!needsFetch) return rows;
  const res = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}?picAssetMode=summary`, {
    credentials: "include",
  });
  if (!res.ok) return rows;
  const data = (await res.json()) as { subProjects?: MvSubProject[] };
  const byId = new Map<string, ClientRawData | null>();
  for (const sub of data.subProjects ?? []) {
    const pic = sub.picAsset;
    if (pic?._id && pic.rawData !== undefined) byId.set(pic._id, pic.rawData);
  }
  if (byId.size === 0) return rows;
  return rows.map((row) => {
    const id = row.picAsset?._id;
    if (!id || !row.picAsset || !byId.has(id)) return row;
    return { ...row, picAsset: { ...row.picAsset, rawData: byId.get(id) ?? {} } };
  });
}

function HeaderFilterMenu({
  open,
  onClose,
  anchorRef,
  minWidth = 240,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement>;
  minWidth?: number;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<{
    mobile: boolean;
    left: number;
    width: number;
    maxHeight: number;
    top?: number;
    bottom?: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    const updateLayout = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const mobile = viewportWidth < 640;
      if (mobile) {
        setLayout({
          mobile: true,
          left: 8,
          width: Math.max(0, viewportWidth - 16),
          bottom: 8,
          maxHeight: Math.max(0, viewportHeight - 16),
        });
        return;
      }

      const rect = anchor.getBoundingClientRect();
      const viewportPadding = 12;
      const gap = 8;
      const width = Math.min(Math.max(minWidth, 220), viewportWidth - viewportPadding * 2);
      const left = Math.min(
        Math.max(viewportPadding, rect.left + rect.width / 2 - width / 2),
        viewportWidth - viewportPadding - width,
      );
      const availableBelow = viewportHeight - rect.bottom - viewportPadding - gap;
      const availableAbove = rect.top - viewportPadding - gap;
      const preferredHeight = Math.min(640, viewportHeight * 0.72);
      const openBelow =
        availableBelow >= Math.min(300, preferredHeight) || availableBelow >= availableAbove;
      const availableHeight = openBelow ? availableBelow : availableAbove;
      setLayout({
        mobile: false,
        left,
        width,
        maxHeight: Math.max(0, Math.min(preferredHeight, availableHeight)),
        ...(openBelow
          ? { top: rect.bottom + gap }
          : { bottom: viewportHeight - rect.top + gap }),
      });
    };

    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      updateLayout();
    };

    updateLayout();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updateLayout);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updateLayout);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [anchorRef, minWidth, onClose, open]);

  if (!open || !layout || typeof document === "undefined") return null;
  const style: CSSProperties = {
    left: layout.left,
    width: layout.width,
    maxHeight: layout.maxHeight,
    ...(layout.top != null ? { top: layout.top } : {}),
    ...(layout.bottom != null ? { bottom: layout.bottom } : {}),
  };

  return createPortal(
    <>
      {layout.mobile ? (
        <div
          aria-hidden="true"
          className="pointer-events-auto fixed inset-0 z-[970] bg-slate-950/45 backdrop-blur-[1px]"
          onMouseDown={onClose}
        />
      ) : null}
      <div
        ref={menuRef}
        role="dialog"
        style={style}
        className="pointer-events-auto fixed z-[980] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.55)] sm:rounded-xl"
        onMouseDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {layout.mobile ? (
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
        ) : null}
        {children}
      </div>
    </>,
    document.body,
  );
}

function headerFilterButtonClass(active: boolean) {
  return cn(
    "inline-flex h-8 w-full min-w-0 items-center justify-between gap-1 rounded-md border px-2 text-[11px] font-semibold shadow-sm transition sm:w-auto sm:min-w-[8rem] sm:max-w-[14rem]",
    active
      ? "border-sky-300 bg-white text-sky-900"
      : "border-white/20 bg-white/10 text-white hover:bg-white/15",
  );
}

function AssetSourceFilterSelect({
  selected,
  onChange,
  t,
}: {
  selected: ReadonlySet<AssetSourceFilterKey>;
  onChange: (next: Set<AssetSourceFilterKey>) => void;
  t: MvT;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const buttonLabel = (() => {
    if (selected.size === 0) return t("projects.assetTable.sourceFilterAll");
    if (selected.size === 1) {
      const only = ASSET_SOURCE_FILTER_KEYS.find((key) => selected.has(key));
      return only ? assetSourceFilterLabel(only, t) : t("projects.assetTable.sourceFilterAll");
    }
    return t("projects.assetTable.sourceFilterSelected", {
      count: String(selected.size),
    });
  })();

  const toggle = (key: AssetSourceFilterKey) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  };

  return (
    <div className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        dir="rtl"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("projects.assetTable.sourceFilterLabel")}
        onClick={() => setOpen((value) => !value)}
        className={headerFilterButtonClass(selected.size > 0)}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 shrink-0 opacity-80" />
          <span className="truncate">{buttonLabel}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </button>
      <HeaderFilterMenu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        minWidth={220}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-2.5 py-2">
          <p className="text-[11px] font-bold text-slate-600">{t("projects.assetTable.sourceFilterLabel")}</p>
          {selected.size > 0 ? (
            <button
              type="button"
              className="text-[11px] font-semibold text-sky-700 hover:underline"
              onClick={() => onChange(new Set())}
            >
              {t("projects.assetTable.sourceFilterClear")}
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-1.5 [scrollbar-gutter:stable]" role="listbox" aria-multiselectable="true">
          {ASSET_SOURCE_FILTER_KEYS.map((key) => {
            const checked = selected.has(key);
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={checked}
                dir="rtl"
                onClick={() => toggle(key)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12px] hover:bg-sky-50",
                  checked && "bg-sky-50 font-semibold text-sky-900",
                )}
              >
                <span>{assetSourceFilterLabel(key, t)}</span>
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border",
                    checked ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 bg-white",
                  )}
                >
                  {checked ? <Check className="h-3 w-3" /> : null}
                </span>
              </button>
            );
          })}
        </div>
      </HeaderFilterMenu>
    </div>
  );
}

function AssetPathFilterSelect({
  value,
  options,
  onChange,
  t,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
  t: MvT;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("ar");
    if (!needle) return options;
    return options.filter((item) => item.toLocaleLowerCase("ar").includes(needle));
  }, [options, search]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  return (
    <div className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        dir="rtl"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("projects.assetTable.pathFilterLabel")}
        onClick={() => setOpen((next) => !next)}
        className={headerFilterButtonClass(Boolean(value))}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <FolderTree className="h-3.5 w-3.5 shrink-0 opacity-80" />
          <span className="truncate">{value || t("projects.assetTable.pathFilterAll")}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </button>
      <HeaderFilterMenu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={buttonRef}
        minWidth={280}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-2.5 py-2">
          <p className="text-[11px] font-bold text-slate-600">{t("projects.assetTable.pathFilterLabel")}</p>
          {value ? (
            <button
              type="button"
              className="text-[11px] font-semibold text-sky-700 hover:underline"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              {t("projects.assetTable.pathFilterClear")}
            </button>
          ) : null}
        </div>
        <div className="shrink-0 border-b border-slate-100 p-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("projects.assetTable.pathFilterSearch")}
              className="h-8 rounded-lg border-slate-200 pe-7 text-[12px]"
              dir="auto"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain p-1.5 [scrollbar-gutter:stable]" role="listbox">
          <button
            type="button"
            role="option"
            aria-selected={!value}
            dir="rtl"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12px] hover:bg-sky-50",
              !value && "bg-sky-50 font-semibold text-sky-900",
            )}
          >
            <span>{t("projects.assetTable.pathFilterAll")}</span>
            {!value ? <Check className="h-3.5 w-3.5 text-sky-700" /> : null}
          </button>
          {filtered.length === 0 ? (
            <p className="px-2 py-3 text-[11px] text-slate-400">{t("projects.assetTable.pathFilterEmpty")}</p>
          ) : (
            filtered.map((path) => {
              const checked = path === value;
              return (
                <button
                  key={path}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  dir="auto"
                  onClick={() => {
                    onChange(path);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-start justify-between gap-2 rounded-lg px-2 py-1.5 text-right text-[12px] hover:bg-sky-50",
                    checked && "bg-sky-50 font-semibold text-sky-900",
                  )}
                >
                  <span className="min-w-0 whitespace-normal break-words">{path}</span>
                  {checked ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-700" /> : null}
                </button>
              );
            })
          )}
        </div>
      </HeaderFilterMenu>
    </div>
  );
}

const CONDITION_KEYS = [
  "new",
  "excellent",
  "good",
  "veryGood",
  "acceptable",
  "poor",
  "scrape",
] as const;

type ConditionKey = (typeof CONDITION_KEYS)[number];

function normalizeConditionKey(value: string): ConditionKey | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const compact = trimmed.replace(/[\s_-]+/g, "").toLowerCase();
  const aliases: Record<string, ConditionKey> = {
    new: "new",
    excellent: "excellent",
    good: "good",
    verygood: "veryGood",
    acceptable: "acceptable",
    poor: "poor",
    scrape: "scrape",
    scrap: "scrape",
  };
  return aliases[compact] ?? null;
}

/** عرض حالة الأصل بالعربية/لغة الواجهة بدل مفتاح الإنجليزية المخزَّن. */
function formatCondition(value: string | null | undefined, ctx: TableFormatContext): string {
  if (typeof value !== "string") return ctx.notAvailable;
  const trimmed = value.trim();
  if (!trimmed) return ctx.notAvailable;
  const key = normalizeConditionKey(trimmed);
  if (!key) return trimmed;
  return ctx.t(`projects.assetTable.condition.${key}`);
}

function isExternalVoice(
  v: PicAssetVoiceNote,
): v is { url: string; publicId?: string; _id?: string; createdAt?: string; duration?: number } {
  return typeof (v as { url?: string }).url === "string" && (v as { url: string }).url.length > 0;
}

function voiceNoteSrc(v: PicAssetVoiceNote, projectId: string): string | null {
  if (isExternalVoice(v)) return v.url;
  const id = (v as { fileId?: string }).fileId;
  if (typeof id !== "string" || !id) return null;
  return `/api/mv/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(id)}/download`;
}

function voiceNoteKey(v: PicAssetVoiceNote, idx: number): string {
  if (isExternalVoice(v)) return `v-${v._id ?? v.url}-${idx}`;
  return `g-${(v as { fileId: string }).fileId}-${idx}`;
}

interface CellRenderArgs {
  row: AssetTableRow;
  projectId: string;
}

interface ColumnDef {
  key: string;
  label: string;
  /** قيمة نصية تُستعمل للبحث والتصدير لإكسيل. */
  text: (row: AssetTableRow) => string;
  /** عرض الخلية في الواجهة — افتراضياً نص ‎`text`‎. */
  render?: (args: CellRenderArgs) => ReactNode;
  /** أعمدة المركبة تخفى عند عدم وجود أي أصل مركبة. */
  vehicleOnly?: boolean;
  minWidth?: number;
  /** يُعرض في الجدول ولا يُصدَّر إلى Excel. */
  excludeFromExport?: boolean;
}

interface AssetTableRow {
  index: number;
  sub: MvSubProject;
  picAsset: PicAsset | null;
  parentPath: string;
}

interface FolderLookup {
  photosRootId: string;
  byId: Map<string, MvSubProject>;
}

type ColumnDropPlacement = "before" | "after";

interface AssetTableColumnPreferences {
  order: string[];
  hidden: string[];
}

function uniqueColumnKeys(columns: readonly ColumnDef[]): string[] {
  return Array.from(new Set(columns.map((column) => column.key)));
}

function mergeColumnKeyOrders(...columnGroups: Array<readonly ColumnDef[]>): string[] {
  const merged: string[] = [];
  for (const columns of columnGroups) {
    const keys = uniqueColumnKeys(columns);
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]!;
      if (merged.includes(key)) continue;
      const nextExisting = keys.slice(index + 1).find((candidate) => merged.includes(candidate));
      if (nextExisting) {
        merged.splice(merged.indexOf(nextExisting), 0, key);
        continue;
      }
      const previousExisting = keys.slice(0, index).reverse().find((candidate) => merged.includes(candidate));
      if (previousExisting) {
        merged.splice(merged.indexOf(previousExisting) + 1, 0, key);
      } else {
        merged.push(key);
      }
    }
  }
  return merged;
}

function normalizeColumnOrder(order: readonly string[], availableKeys: readonly string[]): string[] {
  const available = new Set(availableKeys);
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const key of order) {
    if (!available.has(key) || seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }
  for (const key of availableKeys) {
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }
  return normalized;
}

function readAssetTableColumnPreferences(availableKeys: readonly string[]): AssetTableColumnPreferences {
  const fallback = { order: [...availableKeys], hidden: [] };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(ASSET_TABLE_COLUMN_PREFERENCES_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AssetTableColumnPreferences>;
    const order = Array.isArray(parsed.order)
      ? parsed.order.filter((key): key is string => typeof key === "string")
      : [];
    const available = new Set(availableKeys);
    const hidden = Array.isArray(parsed.hidden)
      ? Array.from(
          new Set(parsed.hidden.filter((key): key is string => typeof key === "string" && available.has(key))),
        )
      : [];
    return { order: normalizeColumnOrder(order, availableKeys), hidden };
  } catch {
    return fallback;
  }
}

function writeAssetTableColumnPreferences(preferences: AssetTableColumnPreferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ASSET_TABLE_COLUMN_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // تبقى التفضيلات فعّالة في الجلسة إذا كان التخزين المحلي غير متاح.
  }
}

function orderColumnDefs(columns: readonly ColumnDef[], order: readonly string[]): ColumnDef[] {
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const ordered = normalizeColumnOrder(order, uniqueColumnKeys(columns))
    .map((key) => byKey.get(key))
    .filter((column): column is ColumnDef => column != null);
  const pinnedIndex = ordered.findIndex((column) => column.key === PINNED_ASSET_IMAGE_COLUMN_KEY);
  if (pinnedIndex > 0) {
    const [pinned] = ordered.splice(pinnedIndex, 1);
    if (pinned) ordered.unshift(pinned);
  }
  return ordered;
}

function reorderColumnKeys(
  current: readonly string[],
  sourceKey: string,
  targetKey: string,
  placement: ColumnDropPlacement,
): string[] {
  if (sourceKey === targetKey || sourceKey === PINNED_ASSET_IMAGE_COLUMN_KEY) return [...current];
  const next = [...current];
  const sourceIndex = next.indexOf(sourceKey);
  const targetIndex = next.indexOf(targetKey);
  if (sourceIndex < 0 || targetIndex < 0) return next;
  next.splice(sourceIndex, 1);
  if (targetKey === PINNED_ASSET_IMAGE_COLUMN_KEY) {
    next.unshift(sourceKey);
    return next;
  }
  const adjustedTargetIndex = next.indexOf(targetKey);
  const insertAt = adjustedTargetIndex + (placement === "after" ? 1 : 0);
  next.splice(Math.max(0, insertAt), 0, sourceKey);
  return next;
}

function AssetTableColumnManager({
  columns,
  hiddenKeys,
  totalHiddenCount,
  onToggle,
  onRestoreAll,
  onResetOrder,
  onMove,
  t,
}: {
  columns: ColumnDef[];
  hiddenKeys: ReadonlySet<string>;
  totalHiddenCount: number;
  onToggle: (key: string) => void;
  onRestoreAll: () => void;
  onResetOrder: () => void;
  onMove: (sourceKey: string, targetKey: string, placement: ColumnDropPlacement) => void;
  t: MvT;
}) {
  const [open, setOpen] = useState(false);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const finishDrag = () => {
    setDraggingKey(null);
    setDragOverKey(null);
  };

  return (
    <div className="relative min-w-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("projects.assetTable.columnManagerLabel")}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => setOpen((value) => !value)}
        className={headerFilterButtonClass(totalHiddenCount > 0)}
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Columns2 className="h-3.5 w-3.5 shrink-0 opacity-80" />
          <span className="truncate">{t("projects.assetTable.columnManagerLabel")}</span>
          {totalHiddenCount > 0 ? (
            <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-black text-sky-800">
              {totalHiddenCount}
            </span>
          ) : null}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </button>
      <HeaderFilterMenu
        open={open}
        onClose={() => {
          setOpen(false);
          finishDrag();
        }}
        anchorRef={buttonRef}
        minWidth={320}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-3 py-2.5">
          <div>
            <p className="text-[12px] font-black text-slate-800">
              {t("projects.assetTable.columnManagerTitle")}
            </p>
            <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
              {totalHiddenCount > 0
                ? t("projects.assetTable.hiddenColumnsCount", { count: String(totalHiddenCount) })
                : t("projects.assetTable.allColumnsVisible")}
            </p>
          </div>
          {totalHiddenCount > 0 ? (
            <button
              type="button"
              onClick={onRestoreAll}
              className="shrink-0 text-[10px] font-bold text-sky-700 hover:underline"
            >
              {t("projects.assetTable.restoreAllColumns")}
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2 [scrollbar-gutter:stable]" role="list">
          {columns.map((column, index) => {
            const hidden = hiddenKeys.has(column.key);
            const pinned = column.key === PINNED_ASSET_IMAGE_COLUMN_KEY;
            return (
              <div
                key={column.key}
                role="listitem"
                draggable={!pinned}
                onDragStart={(event) => {
                  if (pinned) {
                    event.preventDefault();
                    return;
                  }
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", column.key);
                  setDraggingKey(column.key);
                }}
                onDragEnd={finishDrag}
                onDragOver={(event) => {
                  if (!draggingKey || draggingKey === column.key) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  setDragOverKey(column.key);
                }}
                onDragLeave={() => {
                  if (dragOverKey === column.key) setDragOverKey(null);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (!draggingKey || draggingKey === column.key) return finishDrag();
                  const rect = event.currentTarget.getBoundingClientRect();
                  const placement = event.clientY > rect.top + rect.height / 2 ? "after" : "before";
                  onMove(draggingKey, column.key, placement);
                  finishDrag();
                }}
                className={cn(
                  "flex items-center gap-1 rounded-lg border px-1.5 py-1.5 transition",
                  hidden ? "border-slate-100 bg-slate-50 text-slate-400" : "border-slate-200 bg-white text-slate-700",
                  draggingKey === column.key && "opacity-40",
                  dragOverKey === column.key && "border-sky-400 bg-sky-50 ring-1 ring-sky-200",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                    pinned ? "cursor-default text-sky-700" : "cursor-grab text-slate-400 active:cursor-grabbing",
                  )}
                  title={
                    pinned
                      ? t("projects.assetTable.pinnedImageColumn")
                      : t("projects.assetTable.dragColumn", { name: column.label })
                  }
                >
                  {pinned ? <Pin className="h-3.5 w-3.5" /> : <GripVertical className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold" title={column.label}>
                  {column.label}
                </span>
                {!pinned ? (
                  <span className="flex shrink-0 items-center">
                    <button
                      type="button"
                      disabled={index <= 1}
                      onClick={() => onMove(column.key, columns[index - 1]!.key, "before")}
                      className="flex h-7 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-25"
                      aria-label={t("projects.assetTable.moveColumnUp", { name: column.label })}
                      title={t("projects.assetTable.moveColumnUp", { name: column.label })}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={index >= columns.length - 1}
                      onClick={() => onMove(column.key, columns[index + 1]!.key, "after")}
                      className="flex h-7 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-25"
                      aria-label={t("projects.assetTable.moveColumnDown", { name: column.label })}
                      title={t("projects.assetTable.moveColumnDown", { name: column.label })}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-pressed={!hidden}
                  onClick={() => onToggle(column.key)}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition",
                    hidden
                      ? "bg-slate-200 text-slate-600 hover:bg-sky-100 hover:text-sky-700"
                      : "text-slate-500 hover:bg-red-50 hover:text-red-600",
                  )}
                  aria-label={
                    hidden
                      ? t("projects.assetTable.showColumn", { name: column.label })
                      : t("projects.assetTable.hideColumn", { name: column.label })
                  }
                  title={
                    hidden
                      ? t("projects.assetTable.showColumn", { name: column.label })
                      : t("projects.assetTable.hideColumn", { name: column.label })
                  }
                >
                  {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="shrink-0 border-t border-slate-100 p-2">
          <button
            type="button"
            onClick={onResetOrder}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t("projects.assetTable.resetColumnOrder")}
          </button>
        </div>
      </HeaderFilterMenu>
    </div>
  );
}

function isExternalPicImage(
  im: PicAssetImage,
): im is { url: string; publicId?: string; _id?: string; createdAt?: string; thumbnailUrl?: string | null } {
  return typeof (im as { url?: string }).url === "string" && (im as { url: string }).url.length > 0;
}

function isExternalPicVideo(im: PicAssetImage): boolean {
  if (!isExternalPicImage(im)) return false;
  const mt = (im as { mediaType?: string }).mediaType?.toLowerCase();
  if (mt === "video") return true;
  const mime = (im as { mimeType?: string }).mimeType?.toLowerCase() ?? "";
  if (mime.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|m4v|ogv|mkv)(\?|#|$)/i.test(im.url);
}

function picAssetImageSrc(im: PicAssetImage, projectId: string): string {
  if (isExternalPicImage(im)) return im.url;
  return `/api/mv/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent((im as { fileId: string }).fileId)}/download`;
}

function picAssetImageThumbSrc(im: PicAssetImage, projectId: string): string {
  if (isExternalPicImage(im)) {
    const thumb = im.thumbnailUrl;
    if (typeof thumb === "string" && thumb.trim()) return thumb;
    return im.url;
  }
  return picAssetImageSrc(im, projectId);
}

function picAssetImageKey(im: PicAssetImage, idx: number): string {
  if ("fileId" in im && im.fileId) return `f-${im.fileId}`;
  if (isExternalPicImage(im)) return `u-${im._id ?? im.url}-${idx}`;
  return `x-${idx}`;
}

function normalizePicAssetImages(asset: PicAsset | null): PicAssetImage[] {
  if (!asset || !Array.isArray(asset.images)) return [];
  return asset.images;
}

const EXCEL_ASSET_IMAGE_WIDTH = 144;
const EXCEL_ASSET_IMAGE_HEIGHT = 108;

function assetMainImageSrc(row: AssetTableRow, projectId: string): string | null {
  const image = row.picAsset?.mainImage;
  if (!image || isExternalPicVideo(image)) return null;
  return picAssetImageSrc(image, projectId);
}

function isSameOriginUrl(url: string): boolean {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return true;
  }
}

async function imageUrlToExcelPng(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      credentials: isSameOriginUrl(url) ? "include" : "omit",
    });
    if (!response.ok) return null;

    const imageBlob = await response.blob();
    if (!imageBlob.type.startsWith("image/")) return null;

    const objectUrl = URL.createObjectURL(imageBlob);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const next = new Image();
        next.onload = () => resolve(next);
        next.onerror = () => reject(new Error("Could not load asset image."));
        next.src = objectUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = EXCEL_ASSET_IMAGE_WIDTH;
      canvas.height = EXCEL_ASSET_IMAGE_HEIGHT;
      const context = canvas.getContext("2d");
      if (!context) return null;

      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, Math.round((canvas.width - width) / 2), Math.round((canvas.height - height) / 2), width, height);
      return canvas.toDataURL("image/png");
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    return null;
  }
}

async function exportAssetDataWorkbook({
  projectId,
  filename,
  vehicleColumns,
  otherColumns,
  vehicleRows,
  otherRows,
  vehicleSheetName,
  otherSheetName,
  isArabic,
  includeClientRawData = false,
  clientGroupLabel,
  systemGroupLabel,
  clientSheetColumnLabel,
}: {
  projectId: string;
  filename: string;
  vehicleColumns: ColumnDef[];
  otherColumns: ColumnDef[];
  vehicleRows: AssetTableRow[];
  otherRows: AssetTableRow[];
  vehicleSheetName: string;
  otherSheetName: string;
  isArabic: boolean;
  includeClientRawData?: boolean;
  clientGroupLabel?: string;
  systemGroupLabel?: string;
  clientSheetColumnLabel?: string;
}): Promise<void> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Spark Vision";
  workbook.created = new Date();
  workbook.modified = new Date();

  const headerFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0F766E" } };
  const clientGroupFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF0C447C" } };
  const clientHeaderFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1D4ED8" } };
  const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 11 };
  const bodyFont = { name: "Calibri", size: 11, color: { argb: "FF0F172A" } };
  const thin = { style: "thin" as const, color: { argb: "FFCBD5E1" } };
  const cellBorder = { top: thin, left: thin, bottom: thin, right: thin };
  const oddFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8FAFC" } };
  const evenFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFFFFFF" } };
  const clientOddFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEFF6FF" } };
  const clientEvenFill = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8FBFF" } };

  const allExportRows = [...vehicleRows, ...otherRows];
  const sheetNames = collectClientSheetNames(allExportRows);
  const rawKeys = includeClientRawData ? collectClientRawKeys(allExportRows) : [];
  const clientKeys =
    includeClientRawData && rawKeys.length > 0
      ? sheetNames.length > 1
        ? [CLIENT_SHEET_COLUMN_KEY, ...rawKeys]
        : rawKeys
      : [];
  const dualHeaders = clientKeys.length > 0;

  const appendSheet = async (sheetName: string, columns: ColumnDef[], rows: AssetTableRow[]) => {
    if (rows.length === 0) return;
    const exportCols = columns.filter((column) => !column.excludeFromExport);
    const headerRowCount = dualHeaders ? 2 : 1;
    const totalCols = exportCols.length + clientKeys.length;
    if (totalCols === 0) return;

    const worksheet = workbook.addWorksheet(sheetName.slice(0, 31), {
      views: [{ state: "frozen", ySplit: headerRowCount, rightToLeft: isArabic, showGridLines: false }],
      properties: { defaultRowHeight: 22, tabColor: { argb: dualHeaders ? "FF0C447C" : "FF0F766E" } },
      pageSetup: {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9,
        horizontalCentered: true,
      },
    });
    const imageColumnIndex = exportCols.findIndex((column) => column.key === "preview") + clientKeys.length;
    const allColDefs = [
      ...clientKeys.map((key) => ({
        key: `raw:${key}`,
        width: Math.max(14, Math.min(36, Math.ceil((key === CLIENT_SHEET_COLUMN_KEY ? 16 : key.length) * 1.1))),
      })),
      ...exportCols.map((column) => ({
        key: column.key,
        width:
          column.key === "preview"
            ? 22
            : Math.max(12, Math.min(42, Math.ceil((column.minWidth ?? 140) / 7))),
      })),
    ];
    worksheet.columns = allColDefs.map((column) => ({
      key: column.key,
      width: column.width,
    }));

    const paintRange = (
      rowNumber: number,
      startCol: number,
      endCol: number,
      fill: typeof headerFill,
      height = 28,
    ) => {
      const row = worksheet.getRow(rowNumber);
      row.height = height;
      for (let col = startCol; col <= endCol; col += 1) {
        const cell = row.getCell(col);
        cell.font = headerFont;
        cell.fill = fill;
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        cell.border = cellBorder;
      }
    };

    if (dualHeaders) {
      const clientEnd = clientKeys.length;
      const systemStart = clientEnd + 1;
      worksheet.getRow(1).getCell(1).value = clientGroupLabel || "";
      worksheet.getRow(1).getCell(systemStart).value = systemGroupLabel || "";
      if (clientEnd > 1) worksheet.mergeCells(1, 1, 1, clientEnd);
      if (exportCols.length > 1) worksheet.mergeCells(1, systemStart, 1, totalCols);
      paintRange(1, 1, clientEnd, clientGroupFill, 26);
      paintRange(1, systemStart, totalCols, headerFill, 26);

      clientKeys.forEach((key, index) => {
        worksheet.getRow(2).getCell(index + 1).value =
          key === CLIENT_SHEET_COLUMN_KEY ? clientSheetColumnLabel || key : key;
      });
      exportCols.forEach((column, index) => {
        worksheet.getRow(2).getCell(clientEnd + index + 1).value = column.label;
      });
      paintRange(2, 1, clientEnd, clientHeaderFill);
      paintRange(2, systemStart, totalCols, headerFill);
    } else {
      exportCols.forEach((column, index) => {
        worksheet.getRow(1).getCell(index + 1).value = column.label;
      });
      paintRange(1, 1, exportCols.length, headerFill);
    }

    if (totalCols > 0) {
      worksheet.autoFilter = {
        from: { row: headerRowCount, column: 1 },
        to: { row: headerRowCount, column: totalCols },
      };
    }

    const imageRows = rows.map((row, rowIndex) => {
      const clientValues = clientKeys.map((key) => {
        if (key === CLIENT_SHEET_COLUMN_KEY) return row.picAsset?.sheetName?.trim() || "";
        return formatClientRawCell(picAssetRawData(row.picAsset)[key]);
      });
      const systemValues = exportCols.map((column) => (column.key === "preview" ? "" : column.text(row)));
      const worksheetRow = worksheet.addRow([...clientValues, ...systemValues]);
      worksheetRow.height = imageColumnIndex >= clientKeys.length ? 86 : 22;
      worksheetRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const isClientCell = colNumber <= clientKeys.length;
        const colKey = isClientCell ? clientKeys[colNumber - 1] : exportCols[colNumber - clientKeys.length - 1]?.key;
        cell.font = bodyFont;
        cell.border = cellBorder;
        cell.fill = isClientCell
          ? rowIndex % 2 === 0
            ? clientOddFill
            : clientEvenFill
          : rowIndex % 2 === 0
            ? oddFill
            : evenFill;
        cell.alignment = {
          vertical: "middle",
          wrapText: true,
          horizontal:
            colKey === "parentPath" || colKey === "lable" || colKey === "notes"
              ? isArabic
                ? "right"
                : "left"
              : "center",
        };
      });
      return { row, worksheetRow };
    });

    if (exportCols.every((column) => column.key !== "preview")) return;
    const images = await Promise.all(
      imageRows.map(({ row }) => {
        const source = assetMainImageSrc(row, projectId);
        return source ? imageUrlToExcelPng(source) : Promise.resolve(null);
      }),
    );
    for (let index = 0; index < images.length; index += 1) {
      const image = images[index];
      if (!image) continue;
      const imageId = workbook.addImage({ base64: image, extension: "png" });
      worksheet.addImage(imageId, {
        tl: {
          col: imageColumnIndex + 0.12,
          row: imageRows[index].worksheetRow.number - 0.92,
        },
        ext: { width: EXCEL_ASSET_IMAGE_WIDTH, height: EXCEL_ASSET_IMAGE_HEIGHT },
        editAs: "oneCell",
      });
    }
  };

  await appendSheet(vehicleSheetName, vehicleColumns, vehicleRows);
  await appendSheet(otherSheetName, otherColumns, otherRows);
  if (workbook.worksheets.length === 0) {
    throw new Error("No asset data to export.");
  }

  const buffer = new Uint8Array(await workbook.xlsx.writeBuffer());
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const download = document.createElement("a");
  download.href = downloadUrl;
  download.download = filename;
  document.body.appendChild(download);
  download.click();
  download.remove();
  URL.revokeObjectURL(downloadUrl);
}

function firstStillImage(images: PicAssetImage[]): PicAssetImage | null {
  for (const im of images) {
    if (!isExternalPicVideo(im)) return im;
  }
  return images[0] ?? null;
}

function AssetImagesGalleryModal({
  open,
  onOpenChange,
  asset,
  assetName,
  projectId,
  ctx,
  dir,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: PicAsset | null;
  assetName: string;
  projectId: string;
  ctx: TableFormatContext;
  dir: "rtl" | "ltr";
}) {
  const images = useMemo(() => normalizePicAssetImages(asset), [asset]);
  const [previewImage, setPreviewImage] = useState<{ name: string; previewUrl: string } | null>(null);

  useEffect(() => {
    if (!open) setPreviewImage(null);
  }, [open]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <MvDialogContent closeOnDark className="max-h-[90vh] max-w-5xl border-0 bg-black/90 p-0 text-white" dir={dir}>
          <DialogTitle className="sr-only">
            {ctx.t("projects.assetTable.galleryTitle", {
              name: assetName,
              count: ctx.numberFormatter.format(images.length),
            })}
          </DialogTitle>
          {images.length === 0 ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 px-6 py-10 text-center text-white/70">
              <ImageIcon className="h-10 w-10 opacity-40" />
              <p className="text-sm">{ctx.t("projects.assetTable.noImages")}</p>
            </div>
          ) : (
            <div
              className="max-h-[min(88vh,900px)] overflow-y-auto overflow-x-hidden scroll-smooth overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ scrollSnapType: "y mandatory" as const }}
            >
              {images.map((im, idx) => {
                const imageName = `${assetName} ${ctx.numberFormatter.format(idx + 1)}`.trim();
                const imageSrc = picAssetImageSrc(im, projectId);
                return (
                  <div
                    key={picAssetImageKey(im, idx)}
                    className="flex min-h-[min(72vh,640px)] snap-start snap-always flex-col items-center justify-center border-b border-white/10 px-3 py-6 last:border-b-0 sm:px-5"
                  >
                    <p className="mb-2 text-xs text-white/50">
                      {ctx.numberFormatter.format(idx + 1)} / {ctx.numberFormatter.format(images.length)}
                    </p>
                    {isExternalPicVideo(im) ? (
                      <video
                        src={imageSrc}
                        className="max-h-[min(65vh,720px)] w-full max-w-full object-contain"
                        playsInline
                        controls
                        preload="metadata"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPreviewImage({ name: imageName, previewUrl: imageSrc })}
                        className="group/image relative flex w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-xl bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                        aria-label={ctx.t("assetImages.reportSelect.previewNamedImage", { name: imageName })}
                        title={ctx.t("assetImages.reportSelect.previewNamedImage", { name: imageName })}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageSrc}
                          alt={imageName}
                          draggable={false}
                          className="max-h-[min(65vh,720px)] w-full max-w-full object-contain transition duration-300 group-hover/image:scale-[1.01]"
                        />
                        <span className="absolute bottom-3 end-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-slate-950/75 text-white shadow-lg backdrop-blur transition group-hover/image:scale-105 group-hover/image:bg-emerald-700">
                          <ZoomIn className="h-4 w-4" aria-hidden />
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </MvDialogContent>
      </Dialog>
      {previewImage ? <MvImageZoomDialog image={previewImage} onClose={() => setPreviewImage(null)} /> : null}
    </>
  );
}

function AssetThumbnailCell({
  asset,
  assetName,
  subProjectId,
  projectId,
  loadingDetails,
  onOpenGallery,
  ctx,
}: {
  asset: PicAsset | null;
  assetName: string;
  subProjectId: string;
  projectId: string;
  loadingDetails: boolean;
  onOpenGallery: (asset: PicAsset, name: string, subProjectId: string) => void;
  ctx: TableFormatContext;
}) {
  const images = useMemo(() => normalizePicAssetImages(asset), [asset]);
  const thumb = useMemo(() => firstStillImage(images), [images]);
  const imageCount =
    images.length > 0
      ? images.length
      : typeof asset?.imageCount === "number" && Number.isFinite(asset.imageCount)
        ? Math.max(0, asset.imageCount)
        : 0;
  const pendingImages = picAssetNeedsMediaFetch(asset);

  if (!asset || imageCount === 0) {
    return <span className="text-[12px] font-bold tabular-nums text-slate-300">{ctx.notAvailable}</span>;
  }

  if (pendingImages && loadingDetails) {
    return (
      <span
        className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400"
        title={ctx.t("projects.assetTable.loadingImages")}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
    );
  }

  const handleOpen = () => onOpenGallery(asset, assetName, subProjectId);
  const viewImagesLabel = ctx.t("projects.assetTable.viewImages", {
    count: ctx.numberFormatter.format(imageCount),
  });
  const viewImagesAria = ctx.t("projects.assetTable.viewImagesAria", { name: assetName });

  if (!thumb) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition hover:bg-sky-100"
        title={viewImagesLabel}
        aria-label={viewImagesAria}
      >
        <ImageIcon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="group/thumb relative mx-auto block h-9 w-9 overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-sm transition hover:border-sky-300 hover:ring-2 hover:ring-sky-200"
      title={viewImagesLabel}
      aria-label={viewImagesAria}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={picAssetImageThumbSrc(thumb, projectId)}
        alt=""
        className="h-full w-full object-cover transition group-hover/thumb:scale-105"
      />
      {imageCount > 1 ? (
        <span className="absolute bottom-0 left-0 rounded-tr-md bg-black/65 px-1 py-0.5 text-[9px] font-bold tabular-nums text-white">
          {ctx.numberFormatter.format(imageCount)}
        </span>
      ) : null}
    </button>
  );
}

function VoiceNotesCell({
  asset,
  projectId,
  ctx,
}: {
  asset: PicAsset | null;
  projectId: string;
  ctx: TableFormatContext;
}) {
  const notes = useMemo<PicAssetVoiceNote[]>(() => {
    if (!asset || !Array.isArray(asset.voiceNotes)) return [];
    return asset.voiceNotes.map((v) => (typeof v === "string" ? { fileId: v } : v));
  }, [asset]);

  const summaryCount = useMemo(() => {
    if (notes.length > 0) return notes.length;
    if (typeof asset?.voiceNoteCount === "number" && Number.isFinite(asset.voiceNoteCount)) {
      return Math.max(0, asset.voiceNoteCount);
    }
    return 0;
  }, [asset?.voiceNoteCount, notes.length]);

  if (notes.length === 0) {
    if (summaryCount > 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">
          <FileAudio className="h-3 w-3" />
          {ctx.t("projects.assetTable.voiceClip", { count: ctx.numberFormatter.format(summaryCount) })}
        </span>
      );
    }
    return <span className="text-[12px] font-bold tabular-nums text-slate-400">0</span>;
  }

  return (
    <div className="mx-auto flex w-full max-w-[260px] flex-col items-stretch gap-1.5">
      {notes.map((v, i) => {
        const src = voiceNoteSrc(v, projectId);
        if (!src) return null;
        return (
          <div
            key={voiceNoteKey(v, i)}
            className="rounded-lg border border-violet-100 bg-violet-50/60 px-1.5 py-1 shadow-sm"
          >
            <audio
              controls
              preload="none"
              src={src}
              className="block h-7 w-full"
            >
              <track kind="captions" />
            </audio>
          </div>
        );
      })}
    </div>
  );
}

export interface MvAssetDataTableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string | null;
}

/**
 * تصدير أصول المشروع إلى إكسيل مباشرة — دون فتح نافذة بيانات الأصول. تُستخدم من قائمة
 * إجراءات جدول المشاريع، وتعتمد على نفس منطق الأعمدة المستخدم داخل زر "تصدير إكسيل"
 * في النافذة أعلاه، حتى يتطابق تنسيق الملف الناتج تمامًا في كل مكان.
 */
export async function exportProjectAssetsExcel({
  projectId,
  projectName,
  t,
  isArabic,
}: {
  projectId: string;
  projectName?: string | null;
  t: MvT;
  isArabic: boolean;
}): Promise<{ count: number }> {
  const res = await fetch(`/api/mv/projects/${projectId}?picAssetMode=summary`, {
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(t("projects.assetTable.loadFailed"));
  }
  const data = (await res.json()) as { subProjects?: MvSubProject[] };
  const { previewRoot, byId, entries: summaryEntries } = buildPhotosRootAssetEntries(data.subProjects ?? []);

  const tableCtx = createTableFormatContext(isArabic, t);
  const rows: AssetTableRow[] = summaryEntries
    .filter((entry) => entry.picAsset != null)
    .map((entry, index) => ({
      index,
      ...entry,
      parentPath: previewRoot
        ? buildAssetParentFolderPath(entry.sub, byId, previewRoot._id)
        : tableCtx.notAvailable,
    }));

  if (rows.length === 0) {
    throw new Error(t("projects.assetTable.exportNoData"));
  }

  const vehicleColumns = buildVehicleColumns(tableCtx);
  const otherColumns = buildOtherColumns(tableCtx);
  const vehicleRows = rows
    .filter((r) => isVehicleAsset(r.picAsset?.assetType))
    .map((row, index) => ({ ...row, index }));
  const otherRows = rows
    .filter((r) => !isVehicleAsset(r.picAsset?.assetType))
    .map((row, index) => ({ ...row, index }));

  const safeName = (projectName ?? "project").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  await exportAssetDataWorkbook({
    projectId,
    filename: `${t("projects.assetTable.exportFilePrefix")}-${safeName}-${ts}.xlsx`,
    vehicleColumns,
    otherColumns,
    vehicleRows,
    otherRows,
    vehicleSheetName: t("projects.assetTable.sheetVehicles"),
    otherSheetName: t("projects.assetTable.sheetOther"),
    isArabic,
  });

  return { count: vehicleRows.length + otherRows.length };
}

export function MvAssetDataTableModal({
  open,
  onOpenChange,
  projectId,
  projectName,
}: MvAssetDataTableModalProps) {
  const { t, dir, isArabic } = useMvI18n();
  const tableCtx = useMemo(() => createTableFormatContext(isArabic, t), [isArabic, t]);
  const vehicleColumns = useMemo(() => buildVehicleColumns(tableCtx), [tableCtx]);
  const otherColumns = useMemo(() => buildOtherColumns(tableCtx), [tableCtx]);
  const discoveredColumnKeys = useMemo(
    () => mergeColumnKeyOrders(vehicleColumns, otherColumns),
    [otherColumns, vehicleColumns],
  );
  const allColumnKeysSignature = discoveredColumnKeys.join("|");
  const allColumnKeys = useMemo(
    () => allColumnKeysSignature.split("|").filter(Boolean),
    [allColumnKeysSignature],
  );
  const [columnOrder, setColumnOrder] = useState<string[]>(() => allColumnKeys);
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<Set<string>>(() => new Set());
  const [columnPreferencesReady, setColumnPreferencesReady] = useState(false);
  const [draggingHeaderColumn, setDraggingHeaderColumn] = useState<string | null>(null);
  const [headerDropTarget, setHeaderDropTarget] = useState<string | null>(null);
  const [columnAutoScrollDirection, setColumnAutoScrollDirection] = useState<"left" | "right" | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const columnAutoScrollFrameRef = useRef<number | null>(null);
  const columnAutoScrollSpeedRef = useRef(0);
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [sourceFilters, setSourceFilters] = useState<Set<AssetSourceFilterKey>>(new Set());
  const [pathFilter, setPathFilter] = useState("");
  const [activeTab, setActiveTab] = useState<AssetTab>("vehicles");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [expandedAssetNameCell, setExpandedAssetNameCell] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportLayoutDialogOpen, setExportLayoutDialogOpen] = useState(false);
  const [clientExportDialogOpen, setClientExportDialogOpen] = useState(false);
  const [entries, setEntries] = useState<PreviewEntry[]>(() => {
    if (typeof window === "undefined") return [];
    const cached = readMvWorkflowSessionJson<{ entries?: PreviewEntry[]; entriesFull?: boolean }>(
      MV_WORKFLOW_SESSION.previewPhotoFolders(projectId),
    );
    if (Array.isArray(cached?.entries) && cached.entries.length > 0) {
      return cached.entries;
    }
    return [];
  });
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folderLookup, setFolderLookup] = useState<FolderLookup | null>(() => {
    if (typeof window === "undefined") return null;
    const cached = readMvWorkflowSessionJson<{ photosRootId?: string; byId?: Record<string, MvSubProject> }>(
      MV_WORKFLOW_SESSION.previewPhotoFolders(projectId),
    );
    if (cached?.photosRootId && cached.byId && typeof cached.byId === "object") {
      return { photosRootId: cached.photosRootId, byId: new Map(Object.entries(cached.byId)) };
    }
    return null;
  });
  const [galleryAsset, setGalleryAsset] = useState<{ asset: PicAsset; name: string } | null>(null);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const [catalog, setCatalog] = useState<AssetDescriptionCatalog>(EMPTY_ASSET_DESCRIPTION_CATALOG);
  const loadIdRef = useRef(0);
  const hydrateCancelRef = useRef<(() => void) | null>(null);
  const folderLookupRef = useRef<FolderLookup | null>(null);
  folderLookupRef.current = folderLookup;

  useEffect(() => {
    const preferences = readAssetTableColumnPreferences(allColumnKeys);
    setColumnOrder(preferences.order);
    setHiddenColumnKeys(new Set(preferences.hidden));
    setColumnPreferencesReady(true);
    // لا تتغير المفاتيح عند تبديل اللغة؛ يعاد التطبيع فقط عند إضافة عمود برمجياً.
  }, [allColumnKeysSignature]);

  useEffect(() => {
    if (!columnPreferencesReady) return;
    writeAssetTableColumnPreferences({
      order: normalizeColumnOrder(columnOrder, allColumnKeys),
      hidden: Array.from(hiddenColumnKeys).filter((key) => allColumnKeys.includes(key)),
    });
  }, [allColumnKeys, columnOrder, columnPreferencesReady, hiddenColumnKeys]);

  const toggleColumnVisibility = useCallback((key: string) => {
    setHiddenColumnKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const restoreAllColumns = useCallback(() => {
    setHiddenColumnKeys(new Set());
  }, []);

  const resetColumnOrder = useCallback(() => {
    setColumnOrder([...allColumnKeys]);
  }, [allColumnKeys]);

  const moveColumn = useCallback(
    (sourceKey: string, targetKey: string, placement: ColumnDropPlacement) => {
      setColumnOrder((current) =>
        reorderColumnKeys(normalizeColumnOrder(current, allColumnKeys), sourceKey, targetKey, placement),
      );
    },
    [allColumnKeys],
  );

  const stopColumnDragAutoScroll = useCallback(() => {
    columnAutoScrollSpeedRef.current = 0;
    if (columnAutoScrollFrameRef.current != null) {
      window.cancelAnimationFrame(columnAutoScrollFrameRef.current);
      columnAutoScrollFrameRef.current = null;
    }
    setColumnAutoScrollDirection(null);
  }, []);

  const startColumnDragAutoScroll = useCallback(() => {
    if (columnAutoScrollFrameRef.current != null) return;
    const tick = () => {
      const speed = columnAutoScrollSpeedRef.current;
      const scrollElement = tableScrollRef.current;
      if (!scrollElement || speed === 0) {
        columnAutoScrollFrameRef.current = null;
        return;
      }
      scrollElement.scrollBy({ left: speed, behavior: "auto" });
      columnAutoScrollFrameRef.current = window.requestAnimationFrame(tick);
    };
    columnAutoScrollFrameRef.current = window.requestAnimationFrame(tick);
  }, []);

  const updateColumnDragAutoScroll = useCallback(
    (clientX: number) => {
      const scrollElement = tableScrollRef.current;
      if (!scrollElement) return;
      const rect = scrollElement.getBoundingClientRect();
      const edgeSize = Math.min(110, Math.max(56, rect.width * 0.18));
      const maxSpeed = 26;
      let speed = 0;

      if (clientX < rect.left + edgeSize) {
        const intensity = Math.min(1, Math.max(0, (rect.left + edgeSize - clientX) / edgeSize));
        speed = -Math.max(4, maxSpeed * intensity);
      } else if (clientX > rect.right - edgeSize) {
        const intensity = Math.min(1, Math.max(0, (clientX - (rect.right - edgeSize)) / edgeSize));
        speed = Math.max(4, maxSpeed * intensity);
      }

      columnAutoScrollSpeedRef.current = speed;
      const direction = speed < 0 ? "left" : speed > 0 ? "right" : null;
      setColumnAutoScrollDirection((current) => (current === direction ? current : direction));
      if (speed === 0) {
        if (columnAutoScrollFrameRef.current != null) {
          window.cancelAnimationFrame(columnAutoScrollFrameRef.current);
          columnAutoScrollFrameRef.current = null;
        }
        return;
      }
      startColumnDragAutoScroll();
    },
    [startColumnDragAutoScroll],
  );

  useEffect(() => {
    if (!draggingHeaderColumn) stopColumnDragAutoScroll();
    return stopColumnDragAutoScroll;
  }, [draggingHeaderColumn, stopColumnDragAutoScroll]);

  const assetLocationOptions = useMemo(
    () =>
      Array.from(
        new Set(
          entries
            .map((entry) => entry.picAsset?.asset_location?.trim() ?? "")
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "ar-SA", { sensitivity: "base" })),
    [entries],
  );

  const persistEntriesCache = useCallback(
    (nextEntries: PreviewEntry[], lookup: FolderLookup | null = folderLookupRef.current) => {
      if (!lookup) return;
      writePicAssetFoldersSessionCache(projectId, {
        photosRootId: lookup.photosRootId,
        byId: Object.fromEntries(lookup.byId.entries()),
        entries: nextEntries,
      });
    },
    [projectId],
  );

  const startBackgroundHydrate = useCallback(
    (
      loadId: number,
      summaryEntries: PreviewEntry[],
      lookup: FolderLookup,
      prioritySubIds: readonly string[] = [],
    ) => {
      hydrateCancelRef.current?.();
      const { cancel } = hydratePicAssetEntriesProgressive(projectId, summaryEntries, {
        concurrency: 4,
        prioritySubIds,
        isCancelled: () => loadIdRef.current !== loadId,
        shouldSkip: (entry) => entryHasFullPicAssetMedia(entry.picAsset),
        onBatchUpdate: (updates) => {
          if (loadIdRef.current !== loadId) return;
          const byId = new Map(updates.map((update) => [update.subId, update.next]));
          setEntries((prev) => {
            const merged = prev.map((entry) => {
              const next = byId.get(entry.sub._id);
              return next
                ? { sub: next.sub, picAsset: mergePicAssetFromApi(entry.picAsset, next.picAsset) }
                : entry;
            });
            persistEntriesCache(merged, lookup);
            return merged;
          });
        },
        onComplete: () => {
          if (loadIdRef.current !== loadId) return;
          setLoadingDetails(false);
          setEntries((current) => {
            persistEntriesCache(current, lookup);
            return current;
          });
        },
      });
      hydrateCancelRef.current = cancel;
    },
    [persistEntriesCache, projectId],
  );

  const applyEntryUpdate = useCallback(
    (subId: string, updater: (entry: PreviewEntry) => PreviewEntry) => {
      setEntries((prev) => {
        const next = prev.map((e) => (e.sub._id === subId ? updater(e) : e));
        persistEntriesCache(next);
        return next;
      });
    },
    [persistEntriesCache],
  );

  const saveAssetField = useCallback(
    async (row: AssetTableRow, field: EditableAssetField, nextValue: string) => {
      if (!row.picAsset) return;
      const subId = row.sub._id;
      const cellKey = `${subId}:${field}`;
      setSavingCell(cellKey);
      try {
        const trimmed = nextValue.trim();
        if (field === "assetDescription") return;
        if (field === "lable" && !trimmed) {
          toast({ variant: "destructive", description: t("projects.assetTable.nameRequired") });
          return;
        }

        const payload: Record<string, unknown> =
          field === "lable"
            ? { name: trimmed }
            : field === "manufactureYear" || field === "kilometersDriven"
              ? {
                  [field]: trimmed
                    ? Number.isFinite(Number(trimmed.replace(/,/g, "")))
                      ? Number(trimmed.replace(/,/g, ""))
                      : trimmed
                    : null,
                }
              : { [field]: trimmed || null };

        const updated = await patchMvSubprojectPicAsset(projectId, subId, payload);
        applyEntryUpdate(subId, (e) => ({
          ...e,
          sub: field === "lable" ? { ...e.sub, name: trimmed } : e.sub,
          picAsset:
            field === "lable"
            ? mergePicAssetPreferFull(e.picAsset, { ...updated, name: trimmed })
              : field === "category" || field === "type"
                ? mergePicAssetFromApi(e.picAsset, { ...updated, [field]: trimmed || null })
                : mergePicAssetPreferFull(e.picAsset, updated),
        }));
        toast({ description: t("projects.assetTable.saveSuccess") });
      } catch (e) {
        toast({
          variant: "destructive",
          title: t("projects.assetTable.saveFailedTitle"),
          description: e instanceof Error ? e.message : t("projects.assetTable.saveFailed"),
        });
      } finally {
        setSavingCell(null);
      }
    },
    [applyEntryUpdate, projectId, t, toast],
  );

  const renderEditableCell = useCallback(
    (colKey: string, row: AssetTableRow) => {
      if (!EDITABLE_COLUMN_KEYS.has(colKey)) return null;
      const field = colKey as EditableAssetField;
      const saving = savingCell === `${row.sub._id}:${field}`;

      if (field === "category") {
        return (
          <CatalogLabelSelectCell
            value={picAssetCategory(row.picAsset)}
            options={uniqueCatalogLabels(catalog.categories)}
            saving={saving}
            placeholder={t("projects.assetTable.categoryPlaceholder")}
            emptyHint={t("projects.assetTable.categoryEmpty")}
            searchPlaceholder={t("projects.assetTable.categorySearch")}
            notAvailable={tableCtx.notAvailable}
            onSave={async (v) => saveAssetField(row, "category", v)}
          />
        );
      }

      if (field === "type") {
        const categoryLabel = picAssetCategory(row.picAsset);
        const selectedCategory = catalog.categories.find(
          (item) => item.label.trim() === categoryLabel,
        );
        const scopedTypes = selectedCategory
          ? catalog.types.filter((item) => item.categoryId === selectedCategory.id)
          : catalog.types;
        return (
          <CatalogLabelSelectCell
            value={picAssetKind(row.picAsset)}
            options={uniqueCatalogLabels(scopedTypes.length > 0 ? scopedTypes : catalog.types)}
            saving={saving}
            placeholder={t("projects.assetTable.typePlaceholder")}
            emptyHint={t("projects.assetTable.typeEmpty")}
            searchPlaceholder={t("projects.assetTable.typeSearch")}
            notAvailable={tableCtx.notAvailable}
            onSave={async (v) => saveAssetField(row, "type", v)}
          />
        );
      }

      if (field === "asset_location") {
        const value = fieldRawValue(row, field);
        return (
          <AssetLocationSelectCell
            value={value}
            options={assetLocationOptions}
            saving={saving}
            placeholder={
              value ? t("projects.assetTable.locationPlaceholder") : t("projects.assetTable.columns.assetLocationNoData")
            }
            onSave={async (v) => saveAssetField(row, field, v)}
          />
        );
      }

      if (field === "condition") {
        const raw = fieldRawValue(row, field);
        const selected = normalizeConditionKey(raw) ?? "";
        return (
          <div className="relative mx-auto max-w-[180px]">
            <select
              value={selected}
              disabled={saving}
              dir="rtl"
              onChange={(e) => {
                const next = e.target.value;
                void saveAssetField(row, "condition", next);
              }}
              className="w-full rounded-md border border-transparent bg-white/80 px-2 py-1 text-[12px] text-slate-800 shadow-sm transition hover:border-slate-200 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
            >
              <option value="">{tableCtx.notAvailable}</option>
              {CONDITION_KEYS.map((key) => (
                <option key={key} value={key}>
                  {t(`projects.assetTable.condition.${key}`)}
                </option>
              ))}
            </select>
            {saving ? (
              <Loader2 className="pointer-events-none absolute left-1 top-1.5 h-3.5 w-3.5 animate-spin text-sky-500" />
            ) : null}
          </div>
        );
      }

      const singleLine =
        field === "lable" ||
        field === "brand" ||
        field === "model" ||
        field === "manufactureYear" ||
        field === "kilometersDriven";
      return (
        <EditableTextCell
          value={fieldRawValue(row, field)}
          saving={saving}
          required={field === "lable"}
          multiline={!singleLine}
          placeholder={field === "lable" ? t("projects.assetTable.lablePlaceholder") : tableCtx.notAvailable}
          onSave={async (v) => saveAssetField(row, field, v)}
        />
      );
    },
    [
      assetLocationOptions,
      catalog.categories,
      catalog.types,
      saveAssetField,
      savingCell,
      t,
      tableCtx.notAvailable,
    ],
  );

  const openAssetGallery = useCallback(
    async (asset: PicAsset, name: string, subProjectId: string) => {
      let resolved = asset;
      if (picAssetNeedsMediaFetch(asset)) {
        try {
          const row = await fetchPicAssetDetail(projectId, subProjectId);
          if (row?.picAsset) {
            resolved = row.picAsset;
            setEntries((prev) =>
              prev.map((e) =>
                e.sub._id === subProjectId
                  ? { ...e, picAsset: mergePicAssetFromApi(e.picAsset, row.picAsset) }
                  : e,
              ),
            );
          }
        } catch {
          /* عرض ما تتوفر من بيانات */
        }
      }
      setGalleryAsset({ asset: resolved, name });
    },
    [projectId],
  );

  const loadAssetFolders = useCallback(async () => {
    const myLoadId = ++loadIdRef.current;
    hydrateCancelRef.current?.();
    const cached = readMvWorkflowSessionJson<{ entries?: PreviewEntry[] }>(
      MV_WORKFLOW_SESSION.previewPhotoFolders(projectId),
    );
    const hasCachedRows = Array.isArray(cached?.entries) && cached.entries.length > 0;
    setError(null);
    if (!hasCachedRows) setLoading(true);
    setLoadingDetails(true);
    try {
      const res = await fetch(`/api/mv/projects/${projectId}?picAssetMode=summary`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (loadIdRef.current === myLoadId) setError(t("projects.assetTable.loadFailed"));
        return;
      }
      const data = (await res.json()) as { subProjects?: MvSubProject[] };
      const { previewRoot, byId, entries: summaryEntries } = buildPhotosRootAssetEntries(
        data.subProjects ?? [],
      );
      if (!previewRoot) {
        if (loadIdRef.current === myLoadId) setEntries([]);
        return;
      }
      const lookup: FolderLookup = { photosRootId: previewRoot._id, byId };
      const firstPageIds = summaryEntries.slice(0, DEFAULT_TABLE_PAGE_SIZE).map((e) => e.sub._id);

      if (loadIdRef.current === myLoadId) {
        folderLookupRef.current = lookup;
        setFolderLookup(lookup);
        const previous = new Map(entriesRef.current.map(entry => [entry.sub._id, entry]));
        const mergedEntries = summaryEntries.map(entry => {
          const mergedPic = mergePicAssetFromApi(previous.get(entry.sub._id)?.picAsset ?? null, entry.picAsset);
          return { sub: { ...entry.sub, name: mergedPic?.name?.trim() || mergedPic?.lable?.trim() || entry.sub.name }, picAsset: mergedPic };
        });
        entriesRef.current = mergedEntries;
        setEntries(mergedEntries);
        persistEntriesCache(mergedEntries, lookup);
        setLoading(false);
        startBackgroundHydrate(myLoadId, mergedEntries, lookup, firstPageIds);
      }
    } catch (e) {
      if (loadIdRef.current === myLoadId) {
        setError(e instanceof Error ? e.message : t("projects.assetTable.loadUnexpected"));
      }
    } finally {
      if (loadIdRef.current === myLoadId && !hasCachedRows) {
        setLoading(false);
      }
    }
  }, [persistEntriesCache, projectId, startBackgroundHydrate, t]);

  const pendingRealtimeRefresh = useRef(false);
  const refreshFromSocket = () => {
    if (!open) return;
    if (savingCell) { pendingRealtimeRefresh.current = true; return; }
    void loadAssetFolders();
  };
  useResourceRefresh("mv", refreshFromSocket, projectId);
  useResourceRefresh("assets", refreshFromSocket, projectId);
  useEffect(() => {
    if (open && !savingCell && pendingRealtimeRefresh.current) {
      pendingRealtimeRefresh.current = false;
      void loadAssetFolders();
    }
  }, [open, savingCell, loadAssetFolders]);

  useEffect(() => {
    if (!open) return;
    void loadAssetFolders();
    return () => {
      loadIdRef.current += 1;
      hydrateCancelRef.current?.();
    };
  }, [open, projectId, loadAssetFolders]);

  useEffect(() => {
    if (!open) {
      setIsFullscreen(false);
      setExportLayoutDialogOpen(false);
      setClientExportDialogOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetchAssetDescriptionCatalog()
      .then((next) => {
        if (!cancelled) setCatalog(next);
      })
      .catch(() => {
        if (!cancelled) setCatalog(EMPTY_ASSET_DESCRIPTION_CATALOG);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    setSourceFilters(new Set());
    setPathFilter("");
    setPage(0);
    setPageSize(DEFAULT_TABLE_PAGE_SIZE);
  }, [projectId]);

  useEffect(() => {
    setPage(0);
  }, [query, activeTab, sourceFilters, pathFilter]);

  const allRows = useMemo<AssetTableRow[]>(() => {
    const filtered = entries.filter((e) => e.picAsset != null);
    const sorted = filtered.sort((a, b) => {
      const an = picAssetName(a.picAsset, a.sub.name);
      const bn = picAssetName(b.picAsset, b.sub.name);
      return an.localeCompare(bn, "ar-SA", { numeric: true, sensitivity: "base" });
    });
    return sorted.map((entry, index) => ({
      index,
      ...entry,
      parentPath:
        folderLookup != null
          ? buildAssetParentFolderPath(entry.sub, folderLookup.byId, folderLookup.photosRootId)
          : tableCtx.notAvailable,
    }));
  }, [entries, folderLookup, tableCtx.notAvailable]);

  const sourceFilteredRows = useMemo(
    () => allRows.filter((row) => rowMatchesSourceFilter(row, sourceFilters)),
    [allRows, sourceFilters],
  );

  const pathOptions = useMemo(() => {
    const seen = new Set<string>();
    const paths: string[] = [];
    for (const row of sourceFilteredRows) {
      const path = row.parentPath.trim();
      if (!path || path === tableCtx.notAvailable || seen.has(path)) continue;
      seen.add(path);
      paths.push(path);
    }
    return paths.sort((a, b) => a.localeCompare(b, "ar-SA", { numeric: true, sensitivity: "base" }));
  }, [sourceFilteredRows, tableCtx.notAvailable]);

  useEffect(() => {
    if (pathFilter && !pathOptions.includes(pathFilter)) setPathFilter("");
  }, [pathFilter, pathOptions]);

  const pathFilteredRows = useMemo(
    () => (pathFilter ? sourceFilteredRows.filter((row) => row.parentPath === pathFilter) : sourceFilteredRows),
    [pathFilter, sourceFilteredRows],
  );

  const searchedRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return pathFilteredRows;
    return pathFilteredRows.filter((r) => buildAssetSearchText(r, tableCtx).includes(q));
  }, [pathFilteredRows, query, tableCtx]);

  const sourceFilterActive = sourceFilters.size > 0;
  const pathFilterActive = Boolean(pathFilter);
  const tableFilterActive = Boolean(query.trim()) || sourceFilterActive || pathFilterActive;

  const vehicleRowsAll = useMemo(
    () =>
      allRows
        .filter((r) => isVehicleAsset(r.picAsset?.assetType))
        .map((row, index) => ({ ...row, index })),
    [allRows],
  );

  const otherRowsAll = useMemo(
    () =>
      allRows
        .filter((r) => !isVehicleAsset(r.picAsset?.assetType))
        .map((row, index) => ({ ...row, index })),
    [allRows],
  );

  const vehicleRows = useMemo(
    () =>
      searchedRows
        .filter((r) => isVehicleAsset(r.picAsset?.assetType))
        .map((row, index) => ({ ...row, index })),
    [searchedRows],
  );

  const otherRows = useMemo(
    () =>
      searchedRows
        .filter((r) => !isVehicleAsset(r.picAsset?.assetType))
        .map((row, index) => ({ ...row, index })),
    [searchedRows],
  );

  const activeTabColumns = activeTab === "vehicles" ? vehicleColumns : otherColumns;
  const configurableColumns = useMemo(() => {
    const byKey = new Map(
      [...vehicleColumns, ...otherColumns].map((column) => [column.key, column]),
    );
    return orderColumnDefs(Array.from(byKey.values()), columnOrder);
  }, [columnOrder, otherColumns, vehicleColumns]);
  const orderedColumns = useMemo(
    () => orderColumnDefs(activeTabColumns, columnOrder),
    [activeTabColumns, columnOrder],
  );
  const visibleColumns = useMemo(
    () => orderedColumns.filter((column) => !hiddenColumnKeys.has(column.key)),
    [hiddenColumnKeys, orderedColumns],
  );
  const currentVehicleExportColumns = useMemo(
    () => orderColumnDefs(vehicleColumns, columnOrder).filter((column) => !hiddenColumnKeys.has(column.key)),
    [columnOrder, hiddenColumnKeys, vehicleColumns],
  );
  const currentOtherExportColumns = useMemo(
    () => orderColumnDefs(otherColumns, columnOrder).filter((column) => !hiddenColumnKeys.has(column.key)),
    [columnOrder, hiddenColumnKeys, otherColumns],
  );
  const tabRowsAll = activeTab === "vehicles" ? vehicleRowsAll : otherRowsAll;
  const visibleRows = activeTab === "vehicles" ? vehicleRows : otherRows;
  const rows = allRows;

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [page, safePage]);

  const pagedRows = useMemo(() => {
    const start = safePage * pageSize;
    return visibleRows.slice(start, start + pageSize);
  }, [pageSize, safePage, visibleRows]);

  useEffect(() => {
    if (!open || pagedRows.length === 0) return;
    let cancelled = false;
    const targets = pagedRows.filter((row) => picAssetNeedsMediaFetch(row.picAsset));
    if (targets.length === 0) return;
    void (async () => {
      for (const row of targets) {
        if (cancelled) return;
        const detail = await fetchPicAssetDetail(projectId, row.sub._id).catch(() => null);
        if (cancelled || !detail?.picAsset) continue;
        setEntries((prev) => {
          const merged = prev.map((e) =>
            e.sub._id === row.sub._id
              ? { sub: detail.sub, picAsset: mergePicAssetFromApi(e.picAsset, detail.picAsset) }
              : e,
          );
          persistEntriesCache(merged);
          return merged;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pagedRows, persistEntriesCache, projectId]);

  const exportRowCount = vehicleRows.length + otherRows.length;
  const clientExportMeta = useMemo(() => {
    const clientRows = clientRowsFromExport([...vehicleRows, ...otherRows]);
    const sheets = collectClientSheetNames(clientRows);
    return {
      rowCount: clientRows.length,
      sheetCount: sheets.length,
      sheetNames: sheets,
    };
  }, [otherRows, vehicleRows]);

  const runExportExcel = useCallback(
    async (includeClientRawData: boolean, layout: AssetExportLayout = "standard") => {
      if (exportRowCount === 0) {
        toast({
          variant: "destructive",
          description: tableFilterActive
            ? t("projects.assetTable.exportNoRows")
            : t("projects.assetTable.exportNoData"),
        });
        return;
      }
      const selectedVehicleColumns = layout === "current" ? currentVehicleExportColumns : vehicleColumns;
      const selectedOtherColumns = layout === "current" ? currentOtherExportColumns : otherColumns;
      const hasExportableColumns =
        selectedVehicleColumns.some((column) => !column.excludeFromExport) ||
        selectedOtherColumns.some((column) => !column.excludeFromExport);
      if (!hasExportableColumns) {
        toast({
          variant: "destructive",
          description: t("projects.assetTable.exportNoVisibleColumns"),
        });
        return;
      }

      setExportLayoutDialogOpen(false);
      setClientExportDialogOpen(false);
      setExporting(true);
      try {
        let nextVehicleRows = vehicleRows;
        let nextOtherRows = otherRows;
        if (layout === "current") includeClientRawData = false;
        if (includeClientRawData) {
          const [enrichedVehicles, enrichedOthers] = await Promise.all([
            attachClientRawDataToRows(projectId, vehicleRows),
            attachClientRawDataToRows(projectId, otherRows),
          ]);
          nextVehicleRows = enrichedVehicles;
          nextOtherRows = enrichedOthers;
          const rawKeys = collectClientRawKeys([...nextVehicleRows, ...nextOtherRows]);
          if (rawKeys.length === 0) {
            toast({ description: t("projects.assetTable.exportClientRawMissing") });
            includeClientRawData = false;
          }
        }
        const safeName = (projectName ?? "project").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
        const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        const layoutSuffix =
          layout === "current" ? `-${t("projects.assetTable.exportCurrentFileSuffix")}` : "";
        await exportAssetDataWorkbook({
          projectId,
          filename: `${t("projects.assetTable.exportFilePrefix")}-${safeName}${layoutSuffix}-${ts}.xlsx`,
          vehicleColumns: selectedVehicleColumns,
          otherColumns: selectedOtherColumns,
          vehicleRows: nextVehicleRows,
          otherRows: nextOtherRows,
          vehicleSheetName: t("projects.assetTable.sheetVehicles"),
          otherSheetName: t("projects.assetTable.sheetOther"),
          isArabic,
          includeClientRawData,
          clientGroupLabel: t("projects.assetTable.exportClientGroup"),
          systemGroupLabel: t("projects.assetTable.exportSystemGroup"),
          clientSheetColumnLabel: t("projects.assetTable.exportClientSheetColumn"),
        });
        toast({
          description: t("projects.assetTable.exportSuccess", {
            count: tableCtx.numberFormatter.format(nextVehicleRows.length + nextOtherRows.length),
          }),
        });
      } catch (e) {
        toast({
          variant: "destructive",
          title: t("projects.assetTable.exportFailedTitle"),
          description: e instanceof Error ? e.message : t("projects.assetTable.exportUnexpected"),
        });
      } finally {
        setExporting(false);
      }
    },
    [
      currentOtherExportColumns,
      currentVehicleExportColumns,
      exportRowCount,
      isArabic,
      otherColumns,
      otherRows,
      projectId,
      projectName,
      t,
      tableCtx.numberFormatter,
      tableFilterActive,
      toast,
      vehicleColumns,
      vehicleRows,
    ],
  );

  const requestExportExcel = () => {
    if (exportRowCount === 0) {
      toast({
        variant: "destructive",
        description: tableFilterActive
          ? t("projects.assetTable.exportNoRows")
          : t("projects.assetTable.exportNoData"),
      });
      return;
    }
    setExportLayoutDialogOpen(true);
  };

  const selectExportLayout = (layout: AssetExportLayout) => {
    setExportLayoutDialogOpen(false);
    if (layout === "standard" && sourceFilters.has("client") && clientExportMeta.rowCount > 0) {
      setClientExportDialogOpen(true);
      return;
    }
    void runExportExcel(false, layout);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <MvDialogContent
        closeOnDark
        className={cn(
          "flex flex-col gap-0 overflow-hidden bg-white p-0",
          isFullscreen
            ? "h-[100dvh] max-h-[100dvh] w-screen max-w-none rounded-none border-0"
            : "h-[100dvh] max-h-[100dvh] w-screen max-w-none rounded-none border-0 sm:h-[min(94vh,calc(100dvh-1.5rem))] sm:max-h-[min(94vh,calc(100dvh-1.5rem))] sm:w-[min(96vw,1400px)] sm:max-w-[1400px] sm:rounded-2xl sm:border sm:border-slate-200",
        )}
        dir={dir}
      >
        <DialogTitle className="sr-only">
          {t("projects.assetTable.title")} — {projectName ?? t("projects.assetTable.projectFallback")}
        </DialogTitle>
        <button
          type="button"
          onClick={() => setIsFullscreen((current) => !current)}
          className="absolute end-14 top-4 z-[70] flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/95 text-slate-900 shadow-md transition hover:bg-white hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2"
          aria-label={
            isFullscreen
              ? t("projects.assetTable.exitFullscreen")
              : t("projects.assetTable.enterFullscreen")
          }
          title={
            isFullscreen
              ? t("projects.assetTable.exitFullscreen")
              : t("projects.assetTable.enterFullscreen")
          }
        >
          {isFullscreen ? <Minimize2 className="h-[17px] w-[17px]" /> : <Maximize2 className="h-[17px] w-[17px]" />}
        </button>

        <div className="relative z-30 max-h-[45dvh] shrink-0 overflow-y-auto overscroll-contain bg-gradient-to-bl from-[#0C447C] via-[#0c4a8a] to-slate-900 px-2.5 py-2 pe-24 text-white sm:max-h-none sm:overflow-visible sm:px-4 sm:py-2.5 sm:pe-24">
          <div className="pointer-events-none absolute -left-16 -top-12 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="relative flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
                {projectName ?? t("projects.assetTable.projectFallback")}
              </p>
              <h2 className="mt-0.5 flex items-center gap-1.5 text-sm font-bold sm:text-base">
                <Database className="h-4 w-4 opacity-90" />
                {t("projects.assetTable.title")}
              </h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-sky-100/90">
                <span>
                  {t("projects.assetTable.totalSummary", {
                    total: tableCtx.numberFormatter.format(searchedRows.length),
                    vehicles: tableCtx.numberFormatter.format(vehicleRows.length),
                    other: tableCtx.numberFormatter.format(otherRows.length),
                  })}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/85">
                  {t("projects.assetTable.searchHint")}
                </span>
                {loading || loadingDetails ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/80">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {loadingDetails ? t("projects.assetTable.loadingMedia") : t("projects.assetTable.refreshing")}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="grid w-full min-w-0 grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center lg:w-auto lg:justify-end">
              <AssetTableColumnManager
                columns={configurableColumns}
                hiddenKeys={hiddenColumnKeys}
                totalHiddenCount={hiddenColumnKeys.size}
                onToggle={toggleColumnVisibility}
                onRestoreAll={restoreAllColumns}
                onResetOrder={resetColumnOrder}
                onMove={moveColumn}
                t={t}
              />
              <AssetSourceFilterSelect
                selected={sourceFilters}
                onChange={setSourceFilters}
                t={t}
              />
              <AssetPathFilterSelect
                value={pathFilter}
                options={pathOptions}
                onChange={setPathFilter}
                t={t}
              />
              <div className="relative min-w-0 sm:col-auto">
                <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/60" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("projects.assetTable.searchPlaceholder")}
                  className="h-8 w-full rounded-md border-white/20 bg-white/10 pe-2 ps-7 text-[11px] text-white placeholder:text-white/50 focus-visible:ring-white/40 sm:w-[240px]"
                  dir="auto"
                />
                {query ? (
                  <button
                    type="button"
                    aria-label={t("projects.assetTable.clearSearch")}
                    onClick={() => setQuery("")}
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                disabled={exporting || exportRowCount === 0}
                onClick={() => void requestExportExcel()}
                className="col-span-2 h-8 w-full justify-center gap-1 rounded-md bg-emerald-500 px-2.5 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50 sm:col-auto sm:w-auto"
              >
                {exporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {t("projects.assetTable.exportExcel")}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 pt-1 sm:px-4">
          <button
            type="button"
            onClick={() => setActiveTab("vehicles")}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-2 text-[12px] font-bold transition",
              activeTab === "vehicles"
                ? "border-sky-200 bg-sky-50 text-sky-900"
                : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800",
            )}
          >
            <Car className="h-3.5 w-3.5" />
            {t("projects.assetTable.vehicles")}
            <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] tabular-nums text-slate-600 shadow-sm">
              {tableCtx.numberFormatter.format(vehicleRows.length)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("other")}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-2 text-[12px] font-bold transition",
              activeTab === "other"
                ? "border-violet-200 bg-violet-50 text-violet-900"
                : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800",
            )}
          >
            <Package className="h-3.5 w-3.5" />
            {t("projects.assetTable.otherAssets")}
            <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] tabular-nums text-slate-600 shadow-sm">
              {tableCtx.numberFormatter.format(otherRows.length)}
            </span>
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          <div
            ref={tableScrollRef}
            className="h-full overflow-auto bg-slate-50/40"
            onDragOver={(event) => {
              if (!draggingHeaderColumn) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              updateColumnDragAutoScroll(event.clientX);
            }}
            onDragLeave={(event) => {
              const nextTarget = event.relatedTarget as Node | null;
              if (nextTarget && event.currentTarget.contains(nextTarget)) return;
              stopColumnDragAutoScroll();
            }}
            onDrop={stopColumnDragAutoScroll}
          >
          {error ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 px-6 text-center text-red-600">
              <p className="text-[12px] font-semibold">{error}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void loadAssetFolders()}
                className="h-8 text-[11px]"
              >
                {t("common.retry")}
              </Button>
            </div>
          ) : loading && rows.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 px-6 text-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              <p className="text-[12px]">{t("projects.assetTable.loadingAssets")}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 px-6 text-center text-slate-500">
              <FileSpreadsheet className="h-8 w-8 text-slate-300" />
              <p className="text-[12px] font-medium">{t("projects.assetTable.empty")}</p>
              <p className="text-[11px] text-slate-400">{t("projects.assetTable.emptyHint")}</p>
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 px-6 text-center text-slate-500">
              <Search className="h-7 w-7 text-slate-300" />
              <p className="text-[12px] font-medium">
                {query.trim()
                  ? t("projects.assetTable.noSearchResults")
                  : pathFilterActive
                    ? t("projects.assetTable.noPathFilterResults")
                    : sourceFilterActive
                    ? t("projects.assetTable.noSourceFilterResults")
                    : activeTab === "vehicles"
                      ? t("projects.assetTable.noVehicles")
                      : t("projects.assetTable.noOtherAssets")}
              </p>
            </div>
          ) : visibleColumns.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 px-6 text-center text-slate-500">
              <Columns2 className="h-8 w-8 text-slate-300" />
              <p className="text-[12px] font-semibold">{t("projects.assetTable.allColumnsHidden")}</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={restoreAllColumns}
                className="h-8 gap-1.5 border-sky-200 bg-white text-[11px] font-bold text-sky-800 hover:bg-sky-50"
              >
                <Eye className="h-3.5 w-3.5" />
                {t("projects.assetTable.restoreAllColumns")}
              </Button>
            </div>
          ) : (
            <table className="w-full border-separate border-spacing-0 text-[11px]" dir={dir}>
              <thead className="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-sm">
                <tr>
                  {visibleColumns.map((col) => {
                    const isPinnedImage = col.key === PINNED_ASSET_IMAGE_COLUMN_KEY;
                    return (
                      <th
                        key={col.key}
                        onDragOver={(event) => {
                          if (!draggingHeaderColumn || draggingHeaderColumn === col.key) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          setHeaderDropTarget(col.key);
                        }}
                        onDragLeave={() => {
                          if (headerDropTarget === col.key) setHeaderDropTarget(null);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (!draggingHeaderColumn || draggingHeaderColumn === col.key) {
                            stopColumnDragAutoScroll();
                            setDraggingHeaderColumn(null);
                            setHeaderDropTarget(null);
                            return;
                          }
                          const rect = event.currentTarget.getBoundingClientRect();
                          const after = dir === "rtl"
                            ? event.clientX < rect.left + rect.width / 2
                            : event.clientX > rect.left + rect.width / 2;
                          moveColumn(
                            draggingHeaderColumn,
                            col.key,
                            isPinnedImage ? "after" : after ? "after" : "before",
                          );
                          stopColumnDragAutoScroll();
                          setDraggingHeaderColumn(null);
                          setHeaderDropTarget(null);
                        }}
                        className={cn(
                          "whitespace-nowrap border-b border-slate-200 px-1.5 py-1.5 text-center text-[10px] font-bold text-slate-700 transition-colors",
                          isPinnedImage &&
                            "sticky z-40 bg-slate-100/95 shadow-[1px_0_0_0_rgb(203,213,225),-8px_0_16px_-14px_rgb(15,23,42)]",
                          headerDropTarget === col.key && "bg-sky-100/95 ring-2 ring-inset ring-sky-400",
                        )}
                        style={{
                          minWidth: col.minWidth ?? 100,
                          ...(isPinnedImage ? { insetInlineStart: 0 } : {}),
                        }}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span
                            draggable={!isPinnedImage}
                            onDragStart={(event) => {
                              if (isPinnedImage) {
                                event.preventDefault();
                                return;
                              }
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", col.key);
                              setDraggingHeaderColumn(col.key);
                            }}
                            onDragEnd={() => {
                              stopColumnDragAutoScroll();
                              setDraggingHeaderColumn(null);
                              setHeaderDropTarget(null);
                            }}
                            className={cn(
                              "flex h-6 w-5 shrink-0 items-center justify-center rounded",
                              isPinnedImage
                                ? "cursor-default text-sky-700"
                                : "cursor-grab text-slate-400 hover:bg-slate-200 hover:text-slate-700 active:cursor-grabbing",
                            )}
                            title={
                              isPinnedImage
                                ? t("projects.assetTable.pinnedImageColumn")
                                : t("projects.assetTable.dragColumn", { name: col.label })
                            }
                          >
                            {isPinnedImage ? <Pin className="h-3 w-3" /> : <GripVertical className="h-3.5 w-3.5" />}
                          </span>
                          <span>{col.label}</span>
                          <button
                            type="button"
                            draggable={false}
                            onClick={() => toggleColumnVisibility(col.key)}
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            aria-label={t("projects.assetTable.hideColumn", { name: col.label })}
                            title={t("projects.assetTable.hideColumn", { name: col.label })}
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row) => (
                  <tr
                    key={row.picAsset?._id ?? row.sub._id}
                    className="group transition hover:bg-sky-50/60"
                  >
                    {visibleColumns.map((col, idx) => {
                      const textValue = col.text(row);
                      const isFirst = idx === 0;
                      const isPinnedImage = col.key === PINNED_ASSET_IMAGE_COLUMN_KEY;
                      const isLable = col.key === "lable";
                      const isAssetType = col.key === "type";
                      const isCategory = col.key === "category";
                      const isParentPath = col.key === "parentPath";
                      const isQuantity = col.key === "quantity";
                      const assetNameCellKey = `${row.picAsset?._id ?? row.sub._id}:lable`;
                      const isExpandedAssetName =
                        isLable && expandedAssetNameCell === assetNameCellKey;
                      const baseCellWidth = col.minWidth ?? 100;
                      const expandedAssetNameWidth = isExpandedAssetName
                        ? Math.max(baseCellWidth, Math.min(720, Array.from(textValue).length * 7.5 + 52))
                        : baseCellWidth;
                      return (
                        <td
                          key={col.key}
                          title={isLable ? textValue : undefined}
                          onMouseEnter={
                            isLable ? () => setExpandedAssetNameCell(assetNameCellKey) : undefined
                          }
                          onMouseLeave={
                            isLable
                              ? () =>
                                  setExpandedAssetNameCell((current) =>
                                    current === assetNameCellKey ? null : current,
                                  )
                              : undefined
                          }
                          className={cn(
                            "border-b border-slate-100 px-2 py-1.5 text-center align-middle text-slate-800 transition-[min-width,width] duration-200",
                            isPinnedImage &&
                              "sticky z-20 bg-white shadow-[1px_0_0_0_rgb(226,232,240),-8px_0_16px_-14px_rgb(15,23,42)] group-hover:bg-sky-50",
                            isFirst && !isPinnedImage && "font-bold tabular-nums text-slate-500",
                            (isLable || isAssetType || isCategory) && "font-semibold text-slate-900",
                            isParentPath && "text-right text-[11px] leading-relaxed",
                            isQuantity && "font-medium tabular-nums text-slate-900",
                            textValue === tableCtx.notAvailable && !isFirst && col.key !== "preview" && "text-slate-400",
                          )}
                          style={{
                            minWidth: expandedAssetNameWidth,
                            ...(isExpandedAssetName ? { width: expandedAssetNameWidth } : {}),
                            ...(isPinnedImage ? { insetInlineStart: 0 } : {}),
                          }}
                        >
                          {col.key === "preview" ? (
                            <AssetThumbnailCell
                              asset={row.picAsset}
                              assetName={formatText(picAssetName(row.picAsset, row.sub.name), "")}
                              subProjectId={row.sub._id}
                              projectId={projectId}
                              loadingDetails={loadingDetails}
                              ctx={tableCtx}
                              onOpenGallery={(asset, name, subId) => void openAssetGallery(asset, name, subId)}
                            />
                          ) : EDITABLE_COLUMN_KEYS.has(col.key) ? (
                            renderEditableCell(col.key, row) ?? (
                              <div className="mx-auto max-w-[420px] whitespace-pre-wrap break-words">{textValue}</div>
                            )
                          ) : col.render ? (
                            col.render({ row, projectId })
                          ) : (
                            <div
                              className={cn(
                                "mx-auto max-w-[420px] whitespace-pre-wrap break-words",
                                isParentPath && "text-right",
                              )}
                              dir={isParentPath ? "auto" : "auto"}
                            >
                              {textValue}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          </div>
          {draggingHeaderColumn && columnAutoScrollDirection === "left" ? (
            <div
              className="pointer-events-none absolute inset-y-0 left-0 z-[60] flex w-16 items-center justify-start bg-gradient-to-r from-sky-500/30 via-sky-300/10 to-transparent ps-2"
              aria-hidden="true"
            >
              <span className="flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-sky-700/90 text-white shadow-lg">
                <ChevronLeft className="h-5 w-5" />
              </span>
            </div>
          ) : null}
          {draggingHeaderColumn && columnAutoScrollDirection === "right" ? (
            <div
              className="pointer-events-none absolute inset-y-0 right-0 z-[60] flex w-16 items-center justify-end bg-gradient-to-l from-sky-500/30 via-sky-300/10 to-transparent pe-2"
              aria-hidden="true"
            >
              <span className="flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-sky-700/90 text-white shadow-lg">
                <ChevronRight className="h-5 w-5" />
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-stretch justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:px-4 sm:py-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <span>
              {tableFilterActive
                ? t("projects.assetTable.displayedCount", {
                    shown: tableCtx.numberFormatter.format(visibleRows.length),
                    total: tableCtx.numberFormatter.format(tabRowsAll.length),
                    tab: activeTab === "vehicles" ? t("projects.assetTable.vehicles") : t("projects.assetTable.otherAssets"),
                  })
                : t("projects.assetTable.tabCount", {
                    tab: activeTab === "vehicles" ? t("projects.assetTable.vehicles") : t("projects.assetTable.otherAssets"),
                    count: tableCtx.numberFormatter.format(visibleRows.length),
                  })}
              {" — "}
              {t("projects.assetTable.projectTotal", { count: tableCtx.numberFormatter.format(rows.length) })}
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value) as TablePageSize);
                setPage(0);
              }}
            >
              <SelectTrigger className="h-7 w-[92px] rounded-md border-slate-200 bg-slate-50 text-[10px] shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TABLE_PAGE_SIZES.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {t("projects.pagination.perPage", {
                      size: tableCtx.numberFormatter.format(size),
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {totalPages > 1 ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 tabular-nums">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={safePage <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  aria-label={t("projects.pagination.prev")}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <span>
                  {t("projects.assetTable.pageOf", {
                    current: tableCtx.numberFormatter.format(safePage + 1),
                    total: tableCtx.numberFormatter.format(totalPages),
                  })}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  aria-label={t("projects.pagination.next")}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              </span>
            ) : null}
            {loadingDetails ? (
              <span className="inline-flex items-center gap-1 text-sky-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("projects.assetTable.loadingMediaBg")}
              </span>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 w-full rounded-md border-slate-200 bg-white px-3 text-[11px] hover:bg-slate-50 sm:w-auto"
          >
            {t("common.close")}
          </Button>
        </div>

        {exportLayoutDialogOpen ? (
          <div className="absolute inset-0 z-[65] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-md sm:p-4">
            <div className="relative my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-white shadow-[0_30px_80px_-24px_rgba(12,68,124,0.55)] sm:rounded-[28px]">
              <div className="relative overflow-hidden bg-gradient-to-bl from-[#0C447C] via-[#0c4a8a] to-slate-900 px-4 py-4 text-white sm:px-6 sm:py-5">
                <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-sky-400/25 blur-3xl" />
                <p className="relative text-[9px] font-semibold uppercase tracking-[0.22em] text-white/55">
                  Spark Vision
                </p>
                <h3 className="relative mt-1 flex items-center gap-2 text-base font-black sm:text-lg">
                  <Download className="h-4 w-4 text-sky-200 sm:h-5 sm:w-5" />
                  {t("projects.assetTable.exportLayoutDialogTitle")}
                </h3>
                <p className="relative mt-1.5 text-[11px] leading-5 text-sky-50/90 sm:text-[12px]">
                  {t("projects.assetTable.exportLayoutDialogLead")}
                </p>
              </div>
              <div className="space-y-3 px-4 py-4 sm:px-6 sm:py-5">
                <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={() => selectExportLayout("standard")}
                    className="group rounded-xl border border-slate-200 bg-white p-3 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md disabled:opacity-60 sm:rounded-2xl sm:p-4"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#0C447C] text-white shadow-sm sm:h-9 sm:w-9 sm:rounded-xl">
                      <Database className="h-4 w-4" />
                    </span>
                    <p className="mt-2 text-[12px] font-black text-slate-900 sm:mt-3 sm:text-[13px]">
                      {t("projects.assetTable.exportStandardTitle")}
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-500 sm:text-[11px] sm:leading-5">
                      {t("projects.assetTable.exportStandardHint")}
                    </p>
                  </button>
                  <button
                    type="button"
                    disabled={
                      exporting ||
                      ![...currentVehicleExportColumns, ...currentOtherExportColumns].some(
                        (column) => !column.excludeFromExport,
                      )
                    }
                    onClick={() => selectExportLayout("current")}
                    className="group rounded-xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-3 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-2xl sm:p-4"
                  >
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm sm:h-9 sm:w-9 sm:rounded-xl">
                      <Columns2 className="h-4 w-4" />
                    </span>
                    <p className="mt-2 text-[12px] font-black text-slate-900 sm:mt-3 sm:text-[13px]">
                      {t("projects.assetTable.exportCurrentTitle")}
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-500 sm:text-[11px] sm:leading-5">
                      {t("projects.assetTable.exportCurrentHint", {
                        count: tableCtx.numberFormatter.format(
                          new Set(
                            [...currentVehicleExportColumns, ...currentOtherExportColumns]
                              .filter((column) => !column.excludeFromExport)
                              .map((column) => column.key),
                          ).size,
                        ),
                      })}
                    </p>
                  </button>
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={exporting}
                    onClick={() => setExportLayoutDialogOpen(false)}
                    className="h-8 rounded-lg px-3 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                  >
                    {t("projects.assetTable.exportClientDialogCancel")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {clientExportDialogOpen ? (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md">
            <div className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-white/15 bg-white shadow-[0_30px_80px_-24px_rgba(12,68,124,0.55)]">
              <div className="relative overflow-hidden bg-gradient-to-bl from-[#0C447C] via-[#0c4a8a] to-slate-900 px-6 py-5 text-white">
                <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-sky-400/25 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-8 right-6 h-24 w-24 rounded-full bg-emerald-300/20 blur-2xl" />
                <p className="relative text-[10px] font-semibold uppercase tracking-[0.22em] text-white/55">
                  Spark Vision
                </p>
                <h3 className="relative mt-1 flex items-center gap-2 text-lg font-black">
                  <Layers className="h-5 w-5 text-sky-200" />
                  {t("projects.assetTable.exportClientDialogTitle")}
                </h3>
                <p className="relative mt-2 max-w-lg text-[13px] leading-6 text-sky-50/90">
                  {t("projects.assetTable.exportClientDialogLead")}
                </p>
                <div className="relative mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold text-white">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    {t("projects.assetTable.exportClientDialogRows", {
                      count: tableCtx.numberFormatter.format(clientExportMeta.rowCount),
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-[11px] font-semibold text-white">
                    <Columns2 className="h-3.5 w-3.5" />
                    {t("projects.assetTable.exportClientDialogSheets", {
                      count: tableCtx.numberFormatter.format(Math.max(1, clientExportMeta.sheetCount)),
                    })}
                  </span>
                </div>
              </div>
              <div className="space-y-3 px-6 py-5">
                <p className="text-[12px] leading-6 text-slate-500">
                  {t("projects.assetTable.exportClientDialogBody")}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={() => void runExportExcel(true, "standard")}
                    className="group rounded-2xl border border-sky-100 bg-gradient-to-b from-sky-50 to-white p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-lg disabled:opacity-60"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#0C447C] text-white shadow-sm">
                      <Layers className="h-4 w-4" />
                    </span>
                    <p className="mt-3 text-[13px] font-black text-slate-900">
                      {t("projects.assetTable.exportClientDialogInclude")}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">
                      {t("projects.assetTable.exportClientDialogIncludeHint")}
                    </p>
                  </button>
                  <button
                    type="button"
                    disabled={exporting}
                    onClick={() => void runExportExcel(false, "standard")}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md disabled:opacity-60"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                      <Database className="h-4 w-4" />
                    </span>
                    <p className="mt-3 text-[13px] font-black text-slate-900">
                      {t("projects.assetTable.exportClientDialogSystemOnly")}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-slate-500">
                      {t("projects.assetTable.exportClientDialogSystemOnlyHint")}
                    </p>
                  </button>
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={exporting}
                    onClick={() => setClientExportDialogOpen(false)}
                    className="h-9 rounded-xl px-4 text-[12px] font-semibold text-slate-500 hover:text-slate-800"
                  >
                    {t("projects.assetTable.exportClientDialogCancel")}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </MvDialogContent>
      </Dialog>

      <AssetImagesGalleryModal
        open={galleryAsset != null}
        onOpenChange={(o) => !o && setGalleryAsset(null)}
        asset={galleryAsset?.asset ?? null}
        assetName={galleryAsset?.name ?? ""}
        projectId={projectId}
        ctx={tableCtx}
        dir={dir}
      />
    </>
  );
}
