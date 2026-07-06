"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Database,
  Download,
  FileAudio,
  FileSpreadsheet,
  ImageIcon,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Car,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import type { MvSubProject, PicAsset, PicAssetImage, PicAssetVoiceNote } from "./types";
import { patchMvSubprojectPicAsset } from "./mv-pic-asset-panel";

const numberFormatter = new Intl.NumberFormat("ar-SA");
const dateFormatter = new Intl.DateTimeFormat("ar-SA", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const TABLE_PAGE_SIZE = 10;

type AssetTab = "vehicles" | "other";

interface PreviewEntry extends PicAssetFolderEntry {}

const ASSET_TYPE_OPTIONS: {
  value: string;
  label: string;
  aliases: Set<string>;
}[] = [
  { value: "vehicles", label: "مركبات", aliases: new Set(["vehicles", "vehicle", "car", "cars"]) },
  { value: "machinery", label: "آلات ومعدات", aliases: new Set(["machinery", "machine"]) },
  { value: "electronics", label: "إلكترونيات", aliases: new Set(["electronics", "electronic"]) },
  { value: "furniture", label: "أثاث", aliases: new Set(["furniture"]) },
  { value: "other", label: "أخرى", aliases: new Set(["other"]) },
];

/** نوع الأصل بصيغة عربية موحّدة لعرض الجدول. */
function assetTypeLabel(t: unknown): string {
  if (typeof t !== "string") return "—";
  const opt = ASSET_TYPE_OPTIONS.find((o) => o.value === t.toLowerCase() || o.aliases.has(t.toLowerCase()));
  if (opt) return opt.label;
  return t || "—";
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

function quantityLabel(pic: PicAsset | null | undefined): string {
  const t = readQuantity(pic);
  if (!t) return "—";
  const n = Number(t);
  return Number.isFinite(n) ? numberFormatter.format(n) : t;
}

/** تسمية النوع الفرعي (‎subAssetType‎) للعرض في الجدول. */
function subAssetTypeLabel(pic: PicAsset | null | undefined): string {
  const t = readSubAssetType(pic);
  return t ? t : "—";
}

type EditableAssetField =
  | "name"
  | "brand"
  | "model"
  | "manufactureYear"
  | "kilometersDriven"
  | "condition"
  | "notes";

function fieldRawValue(row: AssetTableRow, field: EditableAssetField): string {
  const pic = row.picAsset;
  if (field === "name") return (pic?.name ?? row.sub.name ?? "").trim();
  if (!pic) return "";
  if (field === "brand") return typeof pic.brand === "string" ? pic.brand.trim() : "";
  if (field === "model") return typeof pic.model === "string" ? pic.model.trim() : "";
  if (field === "manufactureYear") return pic.manufactureYear != null ? String(pic.manufactureYear).trim() : "";
  if (field === "kilometersDriven") return pic.kilometersDriven != null ? String(pic.kilometersDriven).trim() : "";
  const v = pic[field];
  return typeof v === "string" ? v.trim() : "";
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
  useEffect(() => {
    setDraft(value);
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
    "w-full min-w-[120px] rounded-md border border-transparent bg-white/80 px-2 py-1 text-[12px] text-slate-800 shadow-sm transition hover:border-slate-200 focus:border-sky-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:opacity-60";

  return (
    <div className="relative mx-auto max-w-[420px]">
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
          className={cn(sharedClass, "min-h-[4.5rem] resize-y whitespace-pre-wrap break-words leading-relaxed")}
        />
      ) : (
        <input
          type="text"
          value={draft}
          dir="auto"
          disabled={saving}
          placeholder={placeholder}
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

function isVehicleAsset(t: unknown): boolean {
  if (typeof t !== "string") return false;
  const k = t.toLowerCase();
  return k === "vehicles" || k === "vehicle" || k === "car" || k === "cars";
}

/** نص بحث شامل — كل حقول الأصل المعروضة والمخفية. */
function buildAssetSearchText(row: AssetTableRow): string {
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
    pic?.name ?? row.sub.name,
    pic?._id,
    pic?.subAssetType,
    readSubAssetType(pic),
    readQuantity(pic),
    pic?.brand,
    pic?.model,
    pic?.code,
    pic?.condition,
    pic?.notes,
    pic?.assetType,
    assetTypeLabel(pic?.assetType),
    formatNumberish(pic?.quantity),
    formatNumberish(pic?.manufactureYear),
    formatNumberish(pic?.kilometersDriven),
    formatBool(pic?.isPresent),
    formatBool(pic?.isDone),
    formatDate(pic?.createdAt ?? row.sub.createdAt),
    formatDate(pic?.updatedAt ?? row.sub.updatedAt),
    imageCount > 0 ? String(imageCount) : "",
    voiceCount > 0 ? String(voiceCount) : "",
  ];
  return parts
    .filter((p) => typeof p === "string" && p.trim() && p !== "—")
    .join(" ")
    .toLowerCase();
}

function imageCountText(r: AssetTableRow): string {
  const arr = normalizePicAssetImages(r.picAsset);
  const c =
    arr.length > 0
      ? arr.length
      : typeof r.picAsset?.imageCount === "number" && Number.isFinite(r.picAsset.imageCount)
        ? Math.max(0, r.picAsset.imageCount)
        : 0;
  return c === 0 ? "—" : numberFormatter.format(c);
}

function voiceNotesSummaryText(r: AssetTableRow): string {
  const arr = r.picAsset?.voiceNotes;
  const c =
    Array.isArray(arr) && arr.length > 0
      ? arr.length
      : typeof r.picAsset?.voiceNoteCount === "number" && Number.isFinite(r.picAsset.voiceNoteCount)
        ? Math.max(0, r.picAsset.voiceNoteCount)
        : 0;
  return c === 0 ? "0" : `${numberFormatter.format(c)} مقطع`;
}

const SHARED_TAIL_COLUMNS: ColumnDef[] = [
  {
    key: "condition",
    label: "الحالة",
    text: (r) => formatText(r.picAsset?.condition),
    minWidth: 140,
  },
  { key: "isPresent", label: "متواجد", text: (r) => formatBool(r.picAsset?.isPresent), minWidth: 72 },
  { key: "isDone", label: "مُستكمل", text: (r) => formatBool(r.picAsset?.isDone), minWidth: 72 },
  { key: "imageCount", label: "عدد الصور", text: imageCountText, minWidth: 88 },
  {
    key: "voiceNotes",
    label: "الملاحظات الصوتية",
    text: voiceNotesSummaryText,
    render: ({ row, projectId }) => <VoiceNotesCell asset={row.picAsset} projectId={projectId} />,
    minWidth: 220,
  },
  {
    key: "notes",
    label: "الملاحظات",
    text: (r) => formatText(r.picAsset?.notes),
    minWidth: 220,
  },
  {
    key: "createdAt",
    label: "تاريخ الإنشاء",
    text: (r) => formatDate(r.picAsset?.createdAt ?? r.sub.createdAt),
    minWidth: 150,
  },
  {
    key: "updatedAt",
    label: "آخر تحديث",
    text: (r) => formatDate(r.picAsset?.updatedAt ?? r.sub.updatedAt),
    minWidth: 150,
  },
];

const VEHICLE_COLUMNS: ColumnDef[] = [
  { key: "_", label: "#", text: (r) => numberFormatter.format(r.index + 1), minWidth: 56 },
  {
    key: "preview",
    label: "صور",
    text: imageCountText,
    minWidth: 72,
  },
  { key: "parentPath", label: "مسار المجلد", text: (r) => r.parentPath, minWidth: 200 },
  { key: "name", label: "اسم الأصل", text: (r) => formatText(r.picAsset?.name ?? r.sub.name), minWidth: 180 },
  { key: "brand", label: "العلامة", text: (r) => formatText(r.picAsset?.brand), minWidth: 110 },
  { key: "model", label: "الموديل", text: (r) => formatText(r.picAsset?.model), minWidth: 110 },
  {
    key: "manufactureYear",
    label: "سنة الصنع",
    text: (r) => formatNumberish(r.picAsset?.manufactureYear),
    minWidth: 96,
  },
  {
    key: "kilometersDriven",
    label: "الكم المقطوع",
    text: (r) => formatNumberish(r.picAsset?.kilometersDriven),
    minWidth: 110,
  },
  ...SHARED_TAIL_COLUMNS,
];

const OTHER_COLUMNS: ColumnDef[] = [
  { key: "_", label: "#", text: (r) => numberFormatter.format(r.index + 1), minWidth: 56 },
  {
    key: "preview",
    label: "صور",
    text: imageCountText,
    minWidth: 72,
  },
  { key: "parentPath", label: "مسار المجلد", text: (r) => r.parentPath, minWidth: 200 },
  { key: "name", label: "اسم الأصل", text: (r) => formatText(r.picAsset?.name ?? r.sub.name), minWidth: 180 },
  {
    key: "subAssetType",
    label: "نوع الأصل",
    text: (r) => subAssetTypeLabel(r.picAsset),
    minWidth: 120,
  },
  {
    key: "quantity",
    label: "الكمية",
    text: (r) => quantityLabel(r.picAsset),
    minWidth: 80,
  },
  ...SHARED_TAIL_COLUMNS,
];

const EDITABLE_COLUMN_KEYS = new Set([
  "name",
  "brand",
  "model",
  "manufactureYear",
  "kilometersDriven",
  "condition",
  "notes",
]);

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return dateFormatter.format(date);
}

function formatBool(v: boolean | null | undefined): string {
  if (v === true) return "نعم";
  if (v === false) return "لا";
  return "—";
}

function formatNumberish(v: number | string | null | undefined): string {
  if (v == null) return "—";
  if (typeof v === "number" && Number.isFinite(v)) return numberFormatter.format(v);
  const s = String(v).trim();
  return s ? s : "—";
}

function formatText(v: string | null | undefined, fallback = "—"): string {
  if (typeof v !== "string") return fallback;
  const t = v.trim();
  return t ? t : fallback;
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: PicAsset | null;
  assetName: string;
  projectId: string;
}) {
  const images = useMemo(() => normalizePicAssetImages(asset), [asset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl border-0 bg-black/90 p-0 text-white" dir="rtl">
        <DialogTitle className="sr-only">
          صور الأصل — {assetName} — {images.length} صورة
        </DialogTitle>
        {images.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 px-6 py-10 text-center text-white/70">
            <ImageIcon className="h-10 w-10 opacity-40" />
            <p className="text-sm">لا توجد صور لهذا الأصل.</p>
          </div>
        ) : (
          <div
            className="max-h-[min(88vh,900px)] overflow-y-auto scroll-smooth overscroll-contain [scrollbar-gutter:stable]"
            style={{ scrollSnapType: "y mandatory" as const }}
          >
            {images.map((im, idx) => (
              <div
                key={picAssetImageKey(im, idx)}
                className="flex min-h-[min(72vh,640px)] snap-start snap-always flex-col items-center justify-center border-b border-white/10 px-3 py-6 last:border-b-0 sm:px-5"
              >
                <p className="mb-2 text-xs text-white/50">
                  {numberFormatter.format(idx + 1)} / {numberFormatter.format(images.length)}
                </p>
                {isExternalPicVideo(im) ? (
                  <video
                    src={picAssetImageSrc(im, projectId)}
                    className="max-h-[min(65vh,720px)] w-full max-w-full object-contain"
                    playsInline
                    controls
                    preload="metadata"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={picAssetImageSrc(im, projectId)}
                    alt=""
                    className="max-h-[min(65vh,720px)] w-full max-w-full object-contain"
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AssetThumbnailCell({
  asset,
  assetName,
  subProjectId,
  projectId,
  loadingDetails,
  onOpenGallery,
}: {
  asset: PicAsset | null;
  assetName: string;
  subProjectId: string;
  projectId: string;
  loadingDetails: boolean;
  onOpenGallery: (asset: PicAsset, name: string, subProjectId: string) => void;
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
    return <span className="text-[12px] font-bold tabular-nums text-slate-300">—</span>;
  }

  if (pendingImages && loadingDetails) {
    return (
      <span
        className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400"
        title="جاري تحميل الصور…"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
    );
  }

  const handleOpen = () => onOpenGallery(asset, assetName, subProjectId);

  if (!thumb) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700 transition hover:bg-sky-100"
        title={`عرض ${numberFormatter.format(imageCount)} صورة`}
        aria-label={`عرض صور ${assetName}`}
      >
        <ImageIcon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="group/thumb relative mx-auto block h-10 w-10 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-sm transition hover:border-sky-300 hover:ring-2 hover:ring-sky-200"
      title={`عرض ${numberFormatter.format(imageCount)} صورة`}
      aria-label={`عرض صور ${assetName}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={picAssetImageThumbSrc(thumb, projectId)}
        alt=""
        className="h-full w-full object-cover transition group-hover/thumb:scale-105"
      />
      {imageCount > 1 ? (
        <span className="absolute bottom-0 left-0 rounded-tr-md bg-black/65 px-1 py-0.5 text-[9px] font-bold tabular-nums text-white">
          {numberFormatter.format(imageCount)}
        </span>
      ) : null}
    </button>
  );
}

function VoiceNotesCell({
  asset,
  projectId,
}: {
  asset: PicAsset | null;
  projectId: string;
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
          {numberFormatter.format(summaryCount)} مقطع
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

export function MvAssetDataTableModal({
  open,
  onOpenChange,
  projectId,
  projectName,
}: MvAssetDataTableModalProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<AssetTab>("vehicles");
  const [exporting, setExporting] = useState(false);
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
  const loadIdRef = useRef(0);
  const hydrateCancelRef = useRef<(() => void) | null>(null);
  const folderLookupRef = useRef<FolderLookup | null>(null);
  folderLookupRef.current = folderLookup;

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
        onUpdate: (subId, next) => {
          if (loadIdRef.current !== loadId) return;
          setEntries((prev) => {
            const merged = prev.map((e) =>
              e.sub._id === subId
                ? { sub: next.sub, picAsset: mergePicAssetFromApi(e.picAsset, next.picAsset) }
                : e,
            );
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
        if (field === "name") {
          const trimmed = nextValue.trim();
          if (!trimmed) {
            toast({ variant: "destructive", description: "اسم الأصل مطلوب." });
            return;
          }
          const updated = await patchMvSubprojectPicAsset(projectId, subId, { name: trimmed });
          applyEntryUpdate(subId, (e) => ({
            ...e,
            sub: { ...e.sub, name: trimmed },
            picAsset: mergePicAssetPreferFull(e.picAsset, { ...updated, name: trimmed }),
          }));
        } else if (field === "manufactureYear" || field === "kilometersDriven") {
          const trimmed = nextValue.trim();
          const payload = { [field]: trimmed ? trimmed : null };
          const updated = await patchMvSubprojectPicAsset(projectId, subId, payload);
          applyEntryUpdate(subId, (e) => ({
            ...e,
            picAsset: mergePicAssetPreferFull(e.picAsset, updated),
          }));
        } else if (field === "brand" || field === "model") {
          const payload = { [field]: nextValue.trim() || null };
          const updated = await patchMvSubprojectPicAsset(projectId, subId, payload);
          applyEntryUpdate(subId, (e) => ({
            ...e,
            picAsset: mergePicAssetPreferFull(e.picAsset, updated),
          }));
        } else {
          const payload: Record<string, string | null> = {
            [field]: nextValue.trim() || null,
          };
          const updated = await patchMvSubprojectPicAsset(projectId, subId, payload);
          applyEntryUpdate(subId, (e) => ({
            ...e,
            picAsset: mergePicAssetPreferFull(e.picAsset, updated),
          }));
        }
        toast({ description: "تم حفظ التعديل في قاعدة البيانات." });
      } catch (e) {
        toast({
          variant: "destructive",
          title: "تعذّر الحفظ",
          description: e instanceof Error ? e.message : "حدث خطأ أثناء حفظ التعديل.",
        });
        throw e;
      } finally {
        setSavingCell(null);
      }
    },
    [applyEntryUpdate, projectId, toast],
  );

  const renderEditableCell = useCallback(
    (colKey: string, row: AssetTableRow) => {
      if (!EDITABLE_COLUMN_KEYS.has(colKey)) return null;
      const field = colKey as EditableAssetField;
      const saving = savingCell === `${row.sub._id}:${field}`;
      const singleLine =
        field === "name" ||
        field === "brand" ||
        field === "model" ||
        field === "manufactureYear" ||
        field === "kilometersDriven";
      return (
        <EditableTextCell
          value={fieldRawValue(row, field)}
          saving={saving}
          required={field === "name"}
          multiline={!singleLine}
          placeholder={field === "name" ? "اسم الأصل" : "—"}
          onSave={async (v) => saveAssetField(row, field, v)}
        />
      );
    },
    [saveAssetField, savingCell],
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
        if (loadIdRef.current === myLoadId) setError("تعذّر تحميل بيانات الأصول من الخادم.");
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
      const firstPageIds = summaryEntries.slice(0, TABLE_PAGE_SIZE).map((e) => e.sub._id);

      if (loadIdRef.current === myLoadId) {
        folderLookupRef.current = lookup;
        setFolderLookup(lookup);
        let mergedEntries: PreviewEntry[] = [];
        setEntries((prev) => {
          const prevBySubId = new Map(prev.map((e) => [e.sub._id, e]));
          mergedEntries = summaryEntries.map((entry) => {
            const existing = prevBySubId.get(entry.sub._id);
            const mergedPic = mergePicAssetFromApi(existing?.picAsset ?? null, entry.picAsset);
            const mergedName =
              mergedPic?.name?.trim() ||
              entry.sub.name ||
              existing?.sub.name ||
              "";
            return {
              sub: { ...entry.sub, name: mergedName },
              picAsset: mergedPic,
            };
          });
          persistEntriesCache(mergedEntries, lookup);
          return mergedEntries;
        });
        setLoading(false);
        startBackgroundHydrate(myLoadId, mergedEntries, lookup, firstPageIds);
      }
    } catch (e) {
      if (loadIdRef.current === myLoadId) {
        setError(e instanceof Error ? e.message : "خطأ غير متوقع أثناء تحميل البيانات.");
      }
    } finally {
      if (loadIdRef.current === myLoadId && !hasCachedRows) {
        setLoading(false);
      }
    }
  }, [persistEntriesCache, projectId, startBackgroundHydrate]);

  useEffect(() => {
    if (!open) return;
    void loadAssetFolders();
    return () => {
      hydrateCancelRef.current?.();
    };
  }, [open, projectId, loadAssetFolders]);

  useEffect(() => {
    setPage(0);
  }, [query, activeTab]);

  const allRows = useMemo<AssetTableRow[]>(() => {
    const filtered = entries.filter((e) => e.picAsset != null);
    const sorted = filtered.sort((a, b) => {
      const an = (a.picAsset?.name ?? a.sub.name ?? "").toString();
      const bn = (b.picAsset?.name ?? b.sub.name ?? "").toString();
      return an.localeCompare(bn, "ar-SA", { numeric: true, sensitivity: "base" });
    });
    return sorted.map((entry, index) => ({
      index,
      ...entry,
      parentPath:
        folderLookup != null
          ? buildAssetParentFolderPath(entry.sub, folderLookup.byId, folderLookup.photosRootId)
          : "—",
    }));
  }, [entries, folderLookup]);

  const searchedRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) => buildAssetSearchText(r).includes(q));
  }, [allRows, query]);

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

  const visibleColumns = activeTab === "vehicles" ? VEHICLE_COLUMNS : OTHER_COLUMNS;
  const tabRowsAll = activeTab === "vehicles" ? vehicleRowsAll : otherRowsAll;
  const visibleRows = activeTab === "vehicles" ? vehicleRows : otherRows;
  const rows = allRows;

  const totalPages = Math.max(1, Math.ceil(visibleRows.length / TABLE_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [page, safePage]);

  const pagedRows = useMemo(() => {
    const start = safePage * TABLE_PAGE_SIZE;
    return visibleRows.slice(start, start + TABLE_PAGE_SIZE);
  }, [visibleRows, safePage]);

  useEffect(() => {
    if (!open || pagedRows.length === 0) return;
    let cancelled = false;
    const targets = pagedRows.filter((row) => picAssetNeedsMediaFetch(row.picAsset));
    if (targets.length === 0) return;
    void (async () => {
      for (const row of targets) {
        if (cancelled) return;
        const detail = await fetchPicAssetDetail(projectId, row.sub._id);
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

  const handleExportExcel = async () => {
    if (rows.length === 0) {
      toast({ variant: "destructive", description: "لا توجد بيانات أصول للتصدير." });
      return;
    }
    setExporting(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const appendSheet = (sheetName: string, cols: ColumnDef[], data: AssetTableRow[]) => {
        if (data.length === 0) return;
        const header = cols.map((c) => c.label);
        const body = data.map((r) => cols.map((c) => c.text(r)));
        const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
        ws["!cols"] = cols.map((c) => ({
          wch: Math.max(10, Math.min(60, Math.ceil((c.minWidth ?? 140) / 8))),
        }));
        XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
      };
      appendSheet("المركبات", VEHICLE_COLUMNS, vehicleRows);
      appendSheet("أصول أخرى", OTHER_COLUMNS, otherRows);
      if (wb.SheetNames.length === 0) {
        toast({ variant: "destructive", description: "لا توجد بيانات للتصدير." });
        return;
      }
      const safeName = (projectName ?? "project").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      XLSX.writeFile(wb, `بيانات-الأصول-${safeName}-${ts}.xlsx`, { bookType: "xlsx" });
      toast({
        description: `تم تصدير ${numberFormatter.format(vehicleRows.length + otherRows.length)} صفاً إلى Excel.`,
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "تعذّر التصدير",
        description: e instanceof Error ? e.message : "حدث خطأ غير متوقع",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[92vh] w-[96vw] max-w-[1400px] flex-col gap-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-0"
        dir="rtl"
      >
        <DialogTitle className="sr-only">
          بيانات الأصول — {projectName ?? "المشروع"}
        </DialogTitle>

        <div className="relative shrink-0 overflow-hidden bg-gradient-to-bl from-[#0C447C] via-[#0c4a8a] to-slate-900 px-5 py-4 text-white">
          <div className="pointer-events-none absolute -left-16 -top-12 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
                {projectName ?? "المشروع"}
              </p>
              <h2 className="mt-0.5 flex items-center gap-2 text-base font-bold sm:text-lg">
                <Database className="h-4 w-4 opacity-90" />
                بيانات الأصول
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-sky-100/90">
                <span>
                  إجمالي الأصول: {numberFormatter.format(rows.length)} — المركبات:{" "}
                  {numberFormatter.format(vehicleRows.length)} — أخرى:{" "}
                  {numberFormatter.format(otherRows.length)}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/85">
                  بحث شامل في كل الحقول — التعديل يُحفظ عند الخروج من الحقل
                </span>
                {loading || loadingDetails ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/80">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {loadingDetails ? "جاري تحميل الصور والملاحظات…" : "تحديث…"}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/60" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="بحث شامل في بيانات الأصول…"
                  className="h-9 w-[min(92vw,280px)] border-white/20 bg-white/10 pe-2 ps-7 text-[12px] text-white placeholder:text-white/50 focus-visible:ring-white/40"
                  dir="auto"
                />
                {query ? (
                  <button
                    type="button"
                    aria-label="مسح البحث"
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
                disabled={exporting || rows.length === 0}
                onClick={() => void handleExportExcel()}
                className="h-9 gap-1.5 rounded-lg bg-emerald-500 px-3 text-[12px] font-bold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50"
              >
                {exporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                تصدير Excel
              </Button>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-4 pt-1">
          <button
            type="button"
            onClick={() => setActiveTab("vehicles")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-2 text-[12px] font-bold transition",
              activeTab === "vehicles"
                ? "border-sky-200 bg-sky-50 text-sky-900"
                : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800",
            )}
          >
            <Car className="h-3.5 w-3.5" />
            المركبات
            <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] tabular-nums text-slate-600 shadow-sm">
              {numberFormatter.format(vehicleRows.length)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("other")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-2 text-[12px] font-bold transition",
              activeTab === "other"
                ? "border-violet-200 bg-violet-50 text-violet-900"
                : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800",
            )}
          >
            <Package className="h-3.5 w-3.5" />
            أصول أخرى
            <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] tabular-nums text-slate-600 shadow-sm">
              {numberFormatter.format(otherRows.length)}
            </span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-50/40">
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
                إعادة المحاولة
              </Button>
            </div>
          ) : loading && rows.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 px-6 text-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              <p className="text-[12px]">جاري تحميل بيانات الأصول…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 px-6 text-center text-slate-500">
              <FileSpreadsheet className="h-8 w-8 text-slate-300" />
              <p className="text-[12px] font-medium">لا توجد بيانات أصول لعرضها بعد.</p>
              <p className="text-[11px] text-slate-400">
                أنشئ مجلدات أصول أو استورد بياناتها لتظهر هنا.
              </p>
            </div>
          ) : visibleRows.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 px-6 text-center text-slate-500">
              <Search className="h-7 w-7 text-slate-300" />
              <p className="text-[12px] font-medium">
                {query.trim()
                  ? "لا توجد نتائج مطابقة لبحثك في هذا التبويب."
                  : activeTab === "vehicles"
                    ? "لا توجد مركبات مسجّلة بعد."
                    : "لا توجد أصول أخرى مسجّلة بعد."}
              </p>
            </div>
          ) : (
            <table className="w-full border-separate border-spacing-0 text-[12px]" dir="rtl">
              <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-sm">
                <tr>
                  {visibleColumns.map((col, idx) => (
                    <th
                      key={col.key}
                      className={cn(
                        "whitespace-nowrap border-b border-slate-200 px-3 py-2 text-center text-[11px] font-bold text-slate-700",
                        idx === 0 && "sticky right-0 z-20 bg-slate-100/95 shadow-[1px_0_0_0_rgb(226,232,240)]",
                      )}
                      style={{ minWidth: col.minWidth ?? 120 }}
                    >
                      {col.label}
                    </th>
                  ))}
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
                      const isName = col.key === "name";
                      const isParentPath = col.key === "parentPath";
                      const isSubAssetType = col.key === "subAssetType";
                      const isQuantity = col.key === "quantity";
                      return (
                        <td
                          key={col.key}
                          className={cn(
                            "border-b border-slate-100 px-3 py-2 text-center align-middle text-slate-800",
                            isFirst &&
                              "sticky right-0 z-10 bg-white font-bold tabular-nums text-slate-500 shadow-[1px_0_0_0_rgb(241,245,249)] group-hover:bg-sky-50/60",
                            isName && "font-semibold text-slate-900",
                            isParentPath && "text-right text-[11px] leading-relaxed",
                            (isSubAssetType || isQuantity) && "font-medium tabular-nums text-slate-900",
                            textValue === "—" && !isFirst && col.key !== "preview" && "text-slate-400",
                          )}
                          style={{ minWidth: col.minWidth ?? 120 }}
                        >
                          {col.key === "preview" ? (
                            <AssetThumbnailCell
                              asset={row.picAsset}
                              assetName={formatText(row.picAsset?.name ?? row.sub.name, "")}
                              subProjectId={row.sub._id}
                              projectId={projectId}
                              loadingDetails={loadingDetails}
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

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-2.5 text-[11px] text-slate-500">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              {query.trim()
                ? `معروض ${numberFormatter.format(visibleRows.length)} من ${numberFormatter.format(tabRowsAll.length)} — ${activeTab === "vehicles" ? "المركبات" : "أصول أخرى"}`
                : `${activeTab === "vehicles" ? "المركبات" : "أصول أخرى"}: ${numberFormatter.format(visibleRows.length)}`}
              {" — "}إجمالي المشروع: {numberFormatter.format(rows.length)}
            </span>
            {visibleRows.length > TABLE_PAGE_SIZE ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 tabular-nums">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={safePage <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  aria-label="الصفحة السابقة"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <span>
                  صفحة {numberFormatter.format(safePage + 1)} / {numberFormatter.format(totalPages)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  aria-label="الصفحة التالية"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
              </span>
            ) : null}
            {loadingDetails ? (
              <span className="inline-flex items-center gap-1 text-sky-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                جاري تحميل الصور والملاحظات في الخلفية…
              </span>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 rounded-md border-slate-200 bg-white px-3 text-[11px] hover:bg-slate-50"
          >
            إغلاق
          </Button>
        </div>
      </DialogContent>
      </Dialog>

      <AssetImagesGalleryModal
        open={galleryAsset != null}
        onOpenChange={(o) => !o && setGalleryAsset(null)}
        asset={galleryAsset?.asset ?? null}
        assetName={galleryAsset?.name ?? ""}
        projectId={projectId}
      />
    </>
  );
}
