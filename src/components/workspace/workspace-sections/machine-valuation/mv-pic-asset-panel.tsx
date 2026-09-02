"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CalendarClock,
  Car,
  FileText,
  FileAudio,
  Gauge,
  GripVertical,
  Hash,
  ImageIcon,
  Loader2,
  Mic,
  MoreVertical,
  Package,
  PanelLeftOpen,
  Tag,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { MvDialogContent } from "./mv-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { PicAsset, PicAssetImage, PicAssetVoiceNote } from "./types";
import { getMvT, readMvLanguage, useMvI18n, type MvT } from "./mv-i18n";

function createNumberFormatter(isArabic: boolean) {
  return new Intl.NumberFormat(isArabic ? "ar-SA" : "en-US");
}

function formatShortDate(value: string, isArabic: boolean, notAvailable: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return notAvailable;
  return new Intl.DateTimeFormat(isArabic ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatNumberish(
  v: number | string | null | undefined,
  formatter: Intl.NumberFormat,
  notAvailable: string,
): string {
  if (v == null) return notAvailable;
  if (typeof v === "number" && Number.isFinite(v)) return formatter.format(v);
  return String(v);
}

function picAssetTypeLabel(t: MvT, assetType: string): string {
  const k = assetType.toLowerCase();
  if (k === "vehicles" || k === "vehicle" || k === "car" || k === "cars") {
    return t("assetTypes.table.vehicles");
  }
  if (k === "machinery" || k === "machine") return t("assetTypes.table.machinery");
  if (k === "electronics" || k === "electronic") return t("assetTypes.table.electronics");
  if (k === "furniture") return t("assetTypes.furniture");
  if (k === "other") return t("assetTypes.other");
  return assetType || t("common.notAvailable");
}

/** المركبة فقط — الحقول الخاصة بالعلامة/الموديل/سنة الصنع/الكم لا تظهر إلا لها */
function picAssetIsVehicle(t: unknown): boolean {
  if (typeof t !== "string") return false;
  const k = t.toLowerCase();
  return k === "vehicles" || k === "vehicle" || k === "car" || k === "cars";
}

function picAssetIsOther(t: unknown): boolean {
  if (typeof t !== "string") return true;
  const k = t.toLowerCase();
  return k === "other";
}

function picAssetTypeDisplayValue(asset: PicAsset, t: MvT, notAvailable: string): string {
  if (picAssetIsOther(asset.assetType)) {
    const sub = typeof asset.subAssetType === "string" ? asset.subAssetType.trim() : "";
    return sub || notAvailable;
  }
  return picAssetTypeLabel(t, String(asset.assetType));
}

function formatFullDate(
  value: string | null | undefined,
  isArabic: boolean,
  notAvailable: string,
): string {
  if (!value) return notAvailable;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return notAvailable;
  return new Intl.DateTimeFormat(isArabic ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isExternalPicImage(im: PicAssetImage): im is { url: string; publicId?: string; _id?: string; createdAt?: string } {
  return typeof (im as { url?: string }).url === "string" && (im as { url: string }).url.length > 0;
}

function isExternalVoice(v: PicAssetVoiceNote): v is {
  url: string;
  publicId?: string;
  _id?: string;
  createdAt?: string;
  duration?: number;
} {
  return typeof (v as { url?: string }).url === "string" && (v as { url: string }).url.length > 0;
}

function imageKey(im: PicAssetImage, idx: number): string {
  if ("fileId" in im && im.fileId) return `f-${im.fileId}`;
  if (isExternalPicImage(im)) return `u-${im._id ?? im.url}-${idx}`;
  return `x-${idx}`;
}

function lightboxImageSrc(im: PicAssetImage, projectId: string): string {
  if (isExternalPicImage(im)) return im.url;
  return `/api/mv/projects/${projectId}/files/${(im as { fileId: string }).fileId}/download`;
}

function isExternalPicVideo(im: PicAssetImage): boolean {
  if (!isExternalPicImage(im)) return false;
  const mt = (im as { mediaType?: string }).mediaType?.toLowerCase();
  if (mt === "video") return true;
  const mime = (im as { mimeType?: string }).mimeType?.toLowerCase() ?? "";
  if (mime.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|m4v|ogv|mkv)(\?|#|$)/i.test(im.url);
}

export function mvPicAssetImagesToPatchPayload(images: PicAssetImage[]): unknown[] {
  return images.map((im) => {
    if (isExternalPicImage(im)) {
      const o: Record<string, unknown> = { url: im.url };
      if (im.publicId) o.publicId = im.publicId;
      if (im._id) o._id = im._id;
      if (im.createdAt) o.createdAt = im.createdAt;
      if (typeof im.mediaType === "string" && im.mediaType.length > 0) o.mediaType = im.mediaType;
      if (typeof im.mimeType === "string" && im.mimeType.length > 0) o.mimeType = im.mimeType;
      if (im.duration === null) o.duration = null;
      else if (typeof im.duration === "number" && Number.isFinite(im.duration)) o.duration = im.duration;
      if (im.thumbnailUrl === null) o.thumbnailUrl = null;
      else if (typeof im.thumbnailUrl === "string" && im.thumbnailUrl.length > 0) o.thumbnailUrl = im.thumbnailUrl;
      if (typeof (im as { includeInReport?: unknown }).includeInReport === "boolean") {
        o.includeInReport = (im as { includeInReport: boolean }).includeInReport;
      }
      return o;
    }
    if ("fileId" in im && im.fileId) {
      const includeInReport = (im as { includeInReport?: unknown }).includeInReport;
      if (typeof includeInReport === "boolean") {
        return { fileId: im.fileId, includeInReport };
      }
      return im.fileId;
    }
    return im;
  });
}

export async function patchMvSubprojectPicAsset(
  projectId: string,
  subProjectId: string,
  body: Record<string, unknown>,
): Promise<PicAsset> {
  const res = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}/subprojects/${encodeURIComponent(subProjectId)}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || res.statusText);
  }
  let data: unknown;
  try {
    data = JSON.parse(text) as { picAsset?: PicAsset };
  } catch {
    throw new Error(getMvT(readMvLanguage())("assetImages.picPanel.invalidServerResponse"));
  }
  const pic = (data as { picAsset?: PicAsset }).picAsset;
  if (!pic) throw new Error(getMvT(readMvLanguage())("assetImages.picPanel.assetNotReturned"));
  return pic;
}

export interface MvPicAssetPanelProps {
  projectId: string;
  /** معرّف مجلد العرض (نفس ‎subProjectId‎ في المسار) */
  subProjectId: string;
  asset: PicAsset;
  /** يُمرَّر الأصل كما عاد من الخادم بعد ‎PATCH‎ ناجح — لتحديث الواجهة دون إعادة تحميل كامل */
  onPatched: (updated: PicAsset) => void;
  /** ‎imagesOnly: شبكة + سحب + مودال فقط (بدون رأس وبدون بيانات الأصل) */
  mode?: "full" | "imagesOnly";
  /** عند تمريرها: مربع تحديد على كل صورة (لشريط إجراءات عالمي مثل ‎/asset-images/system‎) */
  selectionKeyForIndex?: (index: number) => string;
  selectedKeys?: Set<string>;
  onToggleSelectionKey?: (key: string) => void;
}

export function MvPicAssetPanel({
  projectId,
  subProjectId,
  asset,
  onPatched,
  mode = "full",
  selectionKeyForIndex,
  selectedKeys,
  onToggleSelectionKey,
}: MvPicAssetPanelProps) {
  const { toast } = useToast();
  const { t, dir, isArabic } = useMvI18n();
  const numberFormatter = useMemo(() => createNumberFormatter(isArabic), [isArabic]);
  const notAvailable = t("common.notAvailable");
  const [working, setWorking] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [deleteIdx, setDeleteIdx] = useState<number | null>(null);
  const dragFrom = useRef<number | null>(null);

  const images = asset.images ?? [];
  const voiceNotes: PicAssetVoiceNote[] = (asset.voiceNotes ?? []).map((v) =>
    typeof v === "string" ? { fileId: v } : v,
  );

  const openLightbox = useCallback((i: number) => setLightbox(i), []);
  const closeLightbox = useCallback(() => setLightbox(null), []);

  const lightboxIdPrefix = useMemo(
    () => `sv-lb-${subProjectId.replace(/[^a-zA-Z0-9_-]+/g, "_")}`,
    [subProjectId],
  );
  const slideElementId = useCallback((idx: number) => `${lightboxIdPrefix}-s-${idx}`, [lightboxIdPrefix]);

  const persistImages = useCallback(
    async (nextImages: PicAssetImage[], options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      const before: PicAsset = {
        ...asset,
        images: [...(asset.images ?? [])],
      };
      const optimistic: PicAsset = {
        ...asset,
        images: nextImages,
        updatedAt: new Date().toISOString(),
      };
      onPatched(optimistic);
      if (!silent) {
        setWorking(true);
      }
      try {
        const updated = await patchMvSubprojectPicAsset(projectId, subProjectId, {
          images: mvPicAssetImagesToPatchPayload(nextImages),
        });
        onPatched(updated);
        if (!silent) {
          toast({ title: t("common.save.saved"), description: t("assetImages.picPanel.savedImages") });
        }
      } catch (e) {
        onPatched(before);
        toast({
          variant: "destructive",
          title: t("common.save.error"),
          description: e instanceof Error ? e.message : t("assetImages.picPanel.genericError"),
        });
      } finally {
        if (!silent) {
          setWorking(false);
        }
      }
    },
    [asset, onPatched, projectId, subProjectId, t, toast],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (deleteIdx == null) return;
    const i = deleteIdx;
    setDeleteIdx(null);
    const next = images.filter((_, idx) => idx !== i);
    await persistImages(next);
  }, [deleteIdx, images, persistImages]);

  const onDragStart = (idx: number) => {
    dragFrom.current = idx;
  };
  const onDropOn = (idx: number) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from == null || from === idx || from < 0 || idx < 0) return;
    const next = [...images];
    const [m] = next.splice(from, 1);
    if (!m) return;
    next.splice(idx, 0, m);
    void persistImages(next, { silent: mode === "imagesOnly" });
  };

  /** بعد فتح المودال، مرّر إلى الصورة التي نُقِر عليها */
  useLayoutEffect(() => {
    if (lightbox == null) return;
    const id = slideElementId(lightbox);
    const run = () =>
      document.getElementById(id)?.scrollIntoView({ block: "start", behavior: "auto" });
    run();
    const t1 = window.setTimeout(run, 0);
    const t2 = window.setTimeout(run, 120);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [lightbox, slideElementId]);

  useEffect(() => {
    if (lightbox == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, closeLightbox]);

  return (
    <section
      className={cn(
        mode === "full" &&
          "overflow-hidden rounded-2xl border border-slate-200/90 bg-gradient-to-b from-slate-50/80 via-white to-white shadow-sm ring-1 ring-slate-200/50",
        mode === "imagesOnly" && "contents",
      )}
      dir={dir}
    >
      {mode === "full" ? (
        <div className="border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-sm sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight text-slate-900">
                {t("assetImages.picPanel.folderAsset")}
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {formatShortDate(asset.updatedAt, isArabic, notAvailable)}
              </span>
              {working ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500" aria-live="polite">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("assetImages.picPanel.saving")}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="default"
                className="h-9 gap-2 rounded-xl bg-[#0C447C] px-3 text-xs font-medium text-white shadow-sm hover:bg-[#0a3a6a]"
                onClick={() => setDataOpen(true)}
              >
                <PanelLeftOpen className="h-4 w-4" />
                {t("assetImages.picPanel.viewAssetData")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={mode === "full" ? "p-4 sm:p-5" : "w-full p-0"}>
        {mode === "imagesOnly" && working ? (
          <div
            className="mb-2 flex items-center justify-end gap-1.5 text-[11px] text-slate-500"
            aria-live="polite"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("assetImages.picPanel.savingOrder")}
          </div>
        ) : null}
        {images.length === 0 ? (
          <div className="flex min-h-[120px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center">
            <ImageIcon className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">{t("assetImages.picPanel.noImagesYet")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {images.map((im, idx) => (
              <div
                key={imageKey(im, idx)}
                role="listitem"
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDropOn(idx)}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-sm transition hover:border-sky-300/60 hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => openLightbox(idx)}
                  className="absolute inset-0 z-0 block h-full w-full"
                  aria-label={t("assetImages.picPanel.previewImageAria", { n: String(idx + 1) })}
                />
                {isExternalPicImage(im) ? (
                  isExternalPicVideo(im) ? (
                    <video
                      src={im.url}
                      className="h-full w-full object-cover"
                      playsInline
                      muted
                      preload="metadata"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={im.url} alt="" className="h-full w-full object-cover" />
                  )
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/mv/projects/${projectId}/files/${(im as { fileId: string }).fileId}/download`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="pointer-events-none absolute left-1.5 top-1.5 z-10 flex items-center gap-0.5 rounded-md bg-black/40 px-1 py-0.5 text-white backdrop-blur-sm">
                  <GripVertical className="h-3.5 w-3.5 opacity-80" />
                </div>
                <div className="pointer-events-none absolute bottom-0 right-0 left-0 bg-gradient-to-t from-black/55 to-transparent px-2 py-2 pt-6">
                  <p className="text-[10px] font-medium text-white">
                    {t("assetImages.picPanel.imageLabel", { n: String(idx + 1) })}
                  </p>
                </div>
                {onToggleSelectionKey && selectionKeyForIndex ? (
                  <div
                    className="pointer-events-auto absolute bottom-1.5 left-1.5 z-20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedKeys?.has(selectionKeyForIndex(idx)) ?? false}
                      onCheckedChange={() => onToggleSelectionKey(selectionKeyForIndex(idx))}
                      className="h-4 w-4 border-white/80 bg-white/90 shadow-sm data-[state=checked]:bg-sky-600"
                    />
                  </div>
                ) : null}
                <div className="pointer-events-auto absolute right-1.5 top-1.5 z-20">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60"
                        aria-label={t("assetImages.actions.imageMenu")}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40" onCloseAutoFocus={(e) => e.preventDefault()}>
                      <DropdownMenuItem
                        className="cursor-pointer text-red-600 focus:text-red-600"
                        onSelect={() => setDeleteIdx(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {t("common.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox: تمرير رأسي بين جميع الصور */}
      <Dialog open={lightbox != null} onOpenChange={(o) => !o && closeLightbox()}>
        <MvDialogContent closeOnDark className="max-h-[90vh] max-w-5xl border-0 bg-black/90 p-0 text-white">
          <DialogTitle className="sr-only">
            {t("assetImages.picPanel.lightboxTitle", { count: String(images.length) })}
          </DialogTitle>
          {lightbox != null && images.length > 0 ? (
            <div
              className="max-h-[min(88vh,900px)] overflow-y-auto scroll-smooth overscroll-contain [scrollbar-gutter:stable]"
              style={{ scrollSnapType: "y mandatory" as const }}
            >
              {images.map((im, idx) => (
                <div
                  key={imageKey(im, idx)}
                  id={slideElementId(idx)}
                  className="flex min-h-[min(72vh,640px)] snap-start snap-always flex-col items-center justify-center border-b border-white/10 px-3 py-6 last:border-b-0 sm:px-5"
                >
                  <p className="mb-2 text-xs text-white/50">
                    {idx + 1} / {images.length}
                  </p>
                  {isExternalPicVideo(im) ? (
                    <video
                      src={lightboxImageSrc(im, projectId)}
                      className="max-h-[min(65vh,720px)] w-full max-w-full object-contain"
                      playsInline
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={lightboxImageSrc(im, projectId)}
                        alt=""
                        className="max-h-[min(65vh,720px)] w-full max-w-full object-contain"
                      />
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </MvDialogContent>
      </Dialog>

      {/* بيانات الأصول — في المسار الكامل فقط */}
      {mode === "full" ? (
      (() => {
        const assetLabel = asset.name ?? asset.lable ?? notAvailable;
        const imageTotal =
          (asset.images?.length ?? 0) > 0
            ? (asset.images?.length ?? 0)
            : typeof asset.imageCount === "number" && Number.isFinite(asset.imageCount)
              ? Math.max(0, asset.imageCount)
              : 0;
        const voiceTotal =
          voiceNotes.length > 0
            ? voiceNotes.length
            : typeof asset.voiceNoteCount === "number" && Number.isFinite(asset.voiceNoteCount)
              ? Math.max(0, asset.voiceNoteCount)
              : 0;
        return (
      <Dialog open={dataOpen} onOpenChange={setDataOpen}>
        <MvDialogContent
          className="max-h-[min(90vh,880px)] max-w-lg gap-0 overflow-hidden rounded-3xl border border-slate-200/60 p-0 shadow-2xl sm:max-w-xl"
          dir={dir}
        >
          <DialogTitle className="sr-only">
            {t("assetImages.picPanel.assetDataSrOnly", { name: assetLabel })}
          </DialogTitle>
          <div className="relative overflow-hidden bg-gradient-to-bl from-[#0C447C] via-[#0c4a8a] to-slate-900 px-5 pb-5 pt-6 text-right text-white">
            <div className="pointer-events-none absolute -left-16 -top-12 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl" />
            <p className="relative text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
              {t("assetImages.picPanel.folderAsset")}
            </p>
            <h2 className="relative mt-1 text-lg font-bold leading-snug sm:text-xl">
              {t("assetImages.picPanel.assetDataTitle")}
            </h2>
            <p className="relative mt-1.5 break-words text-sm font-medium text-sky-100/95" dir="auto">
              {assetLabel}
            </p>
            <div className="relative mt-3 flex flex-wrap justify-end gap-1.5">
              <Badge
                variant="secondary"
                className="border-0 bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm"
              >
                <ImageIcon className="me-1 inline h-3.5 w-3.5 opacity-90" />
                {numberFormatter.format(imageTotal)}{" "}
                {imageTotal === 1
                  ? t("assetImages.picPanel.imageSingular")
                  : t("assetImages.picPanel.imagePlural")}
              </Badge>
              {voiceTotal > 0 ? (
                <Badge
                  variant="secondary"
                  className="border-0 bg-violet-500/35 px-2.5 py-0.5 text-[11px] font-medium text-violet-50 backdrop-blur-sm"
                >
                  <Mic className="ms-0.5 inline h-3.5 w-3.5" />
                  {numberFormatter.format(voiceTotal)} {t("assetImages.picPanel.voiceCount")}
                </Badge>
              ) : null}
            </div>
          </div>
          <ScrollArea className="max-h-[min(64vh,640px)]">
            <div className="space-y-4 bg-slate-50/30 px-4 py-4 sm:px-5">
              <DataSection title={t("assetImages.picPanel.sections.basicId")} icon={<Tag className="h-3.5 w-3.5" />}>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Field label={t("assetImages.picPanel.fields.folderName")} value={assetLabel} className="sm:col-span-2" notAvailable={notAvailable} />
                  {picAssetIsVehicle(asset.assetType) ? (
                    <Field label={t("assetImages.picPanel.fields.brand")} value={asset.brand} notAvailable={notAvailable} />
                  ) : (
                    <Field
                      label={t("assetImages.picPanel.fields.assetType")}
                      value={picAssetTypeDisplayValue(asset, t, notAvailable)}
                      notAvailable={notAvailable}
                    />
                  )}
                  {!picAssetIsVehicle(asset.assetType) ? (
                    <Field
                      label={t("assetImages.picPanel.fields.quantity")}
                      value={formatNumberish(asset.quantity, numberFormatter, notAvailable)}
                      notAvailable={notAvailable}
                    />
                  ) : null}
                  <Field label={t("assetImages.picPanel.fields.clientCode")} value={asset.client_code} notAvailable={notAvailable} />
                  <Field label={t("assetImages.picPanel.fields.employer")} value={asset.employer} notAvailable={notAvailable} />
                  <Field label={t("assetImages.picPanel.fields.code")} value={asset.code} notAvailable={notAvailable} />
                  <Field label={t("assetImages.picPanel.fields.valTechId")} value={asset.val_tech_id} notAvailable={notAvailable} />
                  <Field label={t("assetImages.picPanel.fields.isDone")} value={asset.isDone ? t("common.yes") : t("common.no")} notAvailable={notAvailable} />
                  <Field label={t("assetImages.picPanel.fields.isPresent")} value={asset.isPresent ? t("common.yes") : t("common.no")} notAvailable={notAvailable} />
                </div>
              </DataSection>

              <DataSection title={t("assetImages.picPanel.sections.conditionNotes")} icon={<FileText className="h-3.5 w-3.5" />}>
                <div className="space-y-3">
                  <LongTextField
                    label={t("assetImages.picPanel.fields.condition")}
                    value={asset.condition}
                    placeholder={t("assetImages.picPanel.placeholders.noCondition")}
                    notAvailable={notAvailable}
                  />
                  <LongTextField
                    label={t("assetImages.picPanel.fields.notes")}
                    value={asset.notes}
                    placeholder={t("assetImages.picPanel.placeholders.noNotes")}
                    notAvailable={notAvailable}
                  />
                </div>
              </DataSection>

              {picAssetIsVehicle(asset.assetType) ? (
                <DataSection title={t("assetImages.picPanel.sections.vehicleData")} icon={<Car className="h-3.5 w-3.5" />}>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <Field label={t("assetImages.picPanel.fields.brand")} value={asset.brand} notAvailable={notAvailable} />
                    <Field label={t("assetImages.picPanel.fields.model")} value={asset.model} notAvailable={notAvailable} />
                    <Field
                      label={t("assetImages.picPanel.fields.manufactureYear")}
                      value={formatNumberish(asset.manufactureYear, numberFormatter, notAvailable)}
                      notAvailable={notAvailable}
                    />
                    <Field
                      label={t("assetImages.picPanel.fields.kilometers")}
                      value={formatNumberish(asset.kilometersDriven, numberFormatter, notAvailable)}
                      icon={<Gauge className="h-3.5 w-3.5 text-slate-400" />}
                      notAvailable={notAvailable}
                    />
                  </div>
                </DataSection>
              ) : null}

              <DataSection title={t("assetImages.picPanel.sections.registryInfo")} icon={<Hash className="h-3.5 w-3.5" />}>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Field label={t("assetImages.picPanel.fields.assetId")} value={asset._id} className="sm:col-span-2" notAvailable={notAvailable} />
                  <Field label={t("assetImages.picPanel.fields.sheetName")} value={asset.sheetName} notAvailable={notAvailable} />
                  <Field label={t("assetImages.picPanel.fields.importId")} value={asset.importId} notAvailable={notAvailable} />
                </div>
              </DataSection>

              <DataSection title={t("assetImages.picPanel.sections.dates")} icon={<CalendarClock className="h-3.5 w-3.5" />}>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Field
                    label={t("assetImages.picPanel.fields.createdAt")}
                    value={formatFullDate(asset.createdAt, isArabic, notAvailable)}
                    notAvailable={notAvailable}
                  />
                  <Field
                    label={t("assetImages.picPanel.fields.updatedAt")}
                    value={formatFullDate(asset.updatedAt, isArabic, notAvailable)}
                    notAvailable={notAvailable}
                  />
                </div>
              </DataSection>

              <DataSection title={t("assetImages.picPanel.sections.media")} icon={<Package className="h-3.5 w-3.5" />}>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Field
                    label={t("assetImages.picPanel.fields.imageCount")}
                    value={numberFormatter.format(imageTotal)}
                    icon={<ImageIcon className="h-3.5 w-3.5 text-slate-400" />}
                    notAvailable={notAvailable}
                  />
                  <Field
                    label={t("assetImages.picPanel.fields.voiceNoteCount")}
                    value={numberFormatter.format(voiceTotal)}
                    icon={<Mic className="h-3.5 w-3.5 text-slate-400" />}
                    notAvailable={notAvailable}
                  />
                </div>
                {voiceNotes.length > 0 ? (
                  <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {t("assetImages.picPanel.voiceNotes", { count: numberFormatter.format(voiceNotes.length) })}
                    </p>
                    {voiceNotes.map((v, i) => (
                      <div
                        key={isExternalVoice(v) ? `v-${v._id ?? v.url}-${i}` : `g-${(v as { fileId: string }).fileId}-${i}`}
                        className="overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-b from-violet-50/90 to-white p-3 shadow-sm"
                      >
                        {isExternalVoice(v) ? (
                          <div className="space-y-2">
                            {typeof v.duration === "number" && Number.isFinite(v.duration) ? (
                              <p className="text-[11px] text-violet-800">
                                {t("assetImages.picPanel.approxDuration", { seconds: String(v.duration) })}
                              </p>
                            ) : null}
                            <audio controls className="h-9 w-full max-w-full" src={v.url} preload="metadata">
                              <track kind="captions" />
                            </audio>
                          </div>
                        ) : (
                          <a
                            href={`/api/mv/projects/${projectId}/files/${(v as { fileId: string }).fileId}/download`}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0C447C] underline decoration-[#0C447C]/30 underline-offset-2"
                            target="_blank"
                            rel="noreferrer"
                          >
                            <FileAudio className="h-3.5 w-3.5 shrink-0 opacity-80" />
                            {t("assetImages.picPanel.openStoredAudio")}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </DataSection>
            </div>
          </ScrollArea>
        </MvDialogContent>
      </Dialog>
        );
      })()
      ) : null}

      <AlertDialog open={deleteIdx != null} onOpenChange={(o) => !o && setDeleteIdx(null)}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("assetImages.picPanel.deleteImageTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("assetImages.picPanel.deleteImageDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteConfirm()}
              className="bg-red-600 hover:bg-red-700"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function DataSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm sm:p-4">
      <div className="mb-2.5 flex items-center gap-2 border-b border-slate-100/90 pb-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0C447C]/12 to-sky-500/10 text-[#0C447C]">
          {icon}
        </span>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  className,
  icon,
  notAvailable,
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
  icon?: React.ReactNode;
  notAvailable: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-100/90 bg-slate-50/50 p-2.5 transition hover:bg-slate-50/90",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
        {icon ?? null}
      </div>
      <p className="mt-0.5 break-words text-sm font-medium text-slate-900" dir="auto">
        {value != null && String(value).trim() !== "" ? String(value) : notAvailable}
      </p>
    </div>
  );
}

function LongTextField({
  label,
  value,
  placeholder,
  notAvailable,
}: {
  label: string;
  value: string | null | undefined;
  placeholder?: string;
  notAvailable: string;
}) {
  const text = typeof value === "string" ? value.trim() : "";
  const hasText = text.length > 0;
  return (
    <div className="rounded-xl border border-slate-100/90 bg-slate-50/50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div
        className={cn(
          "mt-1.5 min-h-[3rem] whitespace-pre-wrap break-words rounded-lg border border-slate-100 bg-white px-3 py-2.5 text-sm leading-7",
          hasText ? "text-slate-900" : "text-slate-400",
        )}
        dir="auto"
      >
        {hasText ? text : placeholder ?? notAvailable}
      </div>
    </div>
  );
}
