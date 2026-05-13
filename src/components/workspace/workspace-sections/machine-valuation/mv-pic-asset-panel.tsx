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
  FileText,
  FileAudio,
  Gauge,
  GripVertical,
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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

const numberFormatter = new Intl.NumberFormat("ar-SA");

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatNumberish(v: number | string | null | undefined): string {
  if (v == null) return "—";
  if (typeof v === "number" && Number.isFinite(v)) return numberFormatter.format(v);
  return String(v);
}

function picAssetTypeLabel(t: string): string {
  const k = t.toLowerCase();
  if (k === "vehicles" || k === "vehicle" || k === "car" || k === "cars") return "مركبات";
  if (k === "machinery" || k === "machine") return "آلات ومعدات";
  if (k === "electronics" || k === "electronic") return "إلكترونيات";
  if (k === "furniture") return "أثاث";
  if (k === "other") return "أخرى";
  return t || "—";
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
    if ("fileId" in im && im.fileId) return im.fileId;
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
    throw new Error("استجابة غير صالحة من الخادم");
  }
  const pic = (data as { picAsset?: PicAsset }).picAsset;
  if (!pic) throw new Error("لم تُعاد بيانات الأصل من الخادم");
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
          toast({ title: "تم الحفظ", description: "تم تحديث الصور." });
        }
      } catch (e) {
        onPatched(before);
        toast({
          variant: "destructive",
          title: "تعذّر الحفظ",
          description: e instanceof Error ? e.message : "حدث خطأ",
        });
      } finally {
        if (!silent) {
          setWorking(false);
        }
      }
    },
    [asset, onPatched, projectId, subProjectId, toast],
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
      dir="rtl"
    >
      {mode === "full" ? (
        <div className="border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-sm sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight text-slate-900">أصل المجلد</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {formatShortDate(asset.updatedAt)}
              </span>
              {working ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500" aria-live="polite">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  جاري الحفظ…
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
                عرض بيانات الأصول
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
            جاري حفظ ترتيب الصور…
          </div>
        ) : null}
        {images.length === 0 ? (
          <div className="flex min-h-[120px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center">
            <ImageIcon className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">لا توجد صور مرفوعة بعد</p>
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
                  aria-label={`معاينة صورة ${idx + 1}`}
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
                  <p className="text-[10px] font-medium text-white">صورة {idx + 1}</p>
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
                        aria-label="إجراءات الصورة"
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
                        حذف
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
        <DialogContent className="max-h-[90vh] max-w-5xl border-0 bg-black/90 p-0 text-white">
          <DialogTitle className="sr-only">
            معرض الصور — {images.length} صورة — تمرير عمودي
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
        </DialogContent>
      </Dialog>

      {/* بيانات الأصول — في المسار الكامل فقط */}
      {mode === "full" ? (
      (() => {
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
        <DialogContent
          className="max-h-[min(90vh,880px)] max-w-lg gap-0 overflow-hidden rounded-3xl border border-slate-200/60 p-0 shadow-2xl sm:max-w-xl"
          dir="rtl"
        >
          <DialogTitle className="sr-only">بيانات الأصل — {asset.name}</DialogTitle>
          <div className="relative overflow-hidden bg-gradient-to-bl from-[#0C447C] via-[#0c4a8a] to-slate-900 px-5 pb-5 pt-6 text-right text-white">
            <div className="pointer-events-none absolute -left-16 -top-12 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl" />
            <p className="relative text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
              أصل المجلد
            </p>
            <h2 className="relative mt-1 text-lg font-bold leading-snug sm:text-xl">بيانات الأصل</h2>
            <p className="relative mt-1.5 break-words text-sm font-medium text-sky-100/95" dir="auto">
              {asset.name}
            </p>
            <div className="relative mt-3 flex flex-wrap justify-end gap-1.5">
              <Badge
                variant="secondary"
                className="border-0 bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm"
              >
                <ImageIcon className="me-1 inline h-3.5 w-3.5 opacity-90" />
                {numberFormatter.format(imageTotal)} {imageTotal === 1 ? "صورة" : "صور"}
              </Badge>
              {voiceTotal > 0 ? (
                <Badge
                  variant="secondary"
                  className="border-0 bg-violet-500/35 px-2.5 py-0.5 text-[11px] font-medium text-violet-50 backdrop-blur-sm"
                >
                  <Mic className="ms-0.5 inline h-3.5 w-3.5" />
                  {numberFormatter.format(voiceTotal)} صوت
                </Badge>
              ) : null}
            </div>
          </div>
          <ScrollArea className="max-h-[min(64vh,640px)]">
            <div className="space-y-4 bg-slate-50/30 px-4 py-4 sm:px-5">
              <DataSection title="التعريف" icon={<Tag className="h-3.5 w-3.5" />}>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Field label="اسم المجلد" value={asset.name} />
                  <Field label="الرمز" value={asset.code} />
                  <Field label="مُستكمل" value={asset.isDone ? "نعم" : "لا"} />
                  <Field label="متواجد" value={asset.isPresent ? "نعم" : "لا"} />
                </div>
              </DataSection>
              <DataSection title="الوصف والحالة" icon={<FileText className="h-3.5 w-3.5" />}>
                <div className="space-y-3.5">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">وصف</p>
                    <p
                      className="mt-1.5 min-h-[1.5rem] rounded-lg bg-white/60 px-2.5 py-2 text-sm leading-relaxed text-slate-900"
                      dir="auto"
                    >
                      {asset.writtenDescription?.trim() ? asset.writtenDescription : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">الحالة</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900" dir="auto">
                      {asset.condition?.trim() ? asset.condition : "—"}
                    </p>
                  </div>
                </div>
              </DataSection>
              <DataSection title="المواصفات" icon={<Package className="h-3.5 w-3.5" />}>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Field label="نوع الأصل" value={picAssetTypeLabel(String(asset.assetType))} />
                  <Field label="العلامة" value={asset.brand} />
                  <Field label="الموديل" value={asset.model} />
                  <Field label="سنة الصنع" value={formatNumberish(asset.manufactureYear)} />
                  <Field
                    className="sm:col-span-2"
                    label="المسافة المقطوعة (كم)"
                    value={formatNumberish(asset.kilometersDriven)}
                    icon={<Gauge className="h-3.5 w-3.5 text-slate-400" />}
                  />
                </div>
              </DataSection>
              {voiceNotes.length > 0 ? (
                <DataSection title="ملاحظات صوتية" icon={<Mic className="h-3.5 w-3.5" />}>
                  <div className="space-y-2.5">
                    {voiceNotes.map((v, i) => (
                      <div
                        key={isExternalVoice(v) ? `v-${v._id ?? v.url}-${i}` : `g-${(v as { fileId: string }).fileId}-${i}`}
                        className="overflow-hidden rounded-2xl border border-violet-200/60 bg-gradient-to-b from-violet-50/90 to-white p-3 shadow-sm"
                      >
                        {isExternalVoice(v) ? (
                          <div className="space-y-2">
                            {typeof v.duration === "number" && Number.isFinite(v.duration) ? (
                              <p className="text-[11px] text-violet-800">المدة تقريباً: {v.duration} ث</p>
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
                            فتح مرفق صوتي من التخزين
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </DataSection>
              ) : null}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
        );
      })()
      ) : null}

      <AlertDialog open={deleteIdx != null} onOpenChange={(o) => !o && setDeleteIdx(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الصورة؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم إزالتها نهائياً من بيانات الأصل. يمكنك التراجع بتحديث الصفحة فقط إذا ألغي الطلب.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDeleteConfirm()}
              className="bg-red-600 hover:bg-red-700"
            >
              حذف
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
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
  icon?: React.ReactNode;
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
      <p className="mt-0.5 text-sm font-medium text-slate-900" dir="auto">
        {value != null && String(value).trim() !== "" ? String(value) : "—"}
      </p>
    </div>
  );
}
