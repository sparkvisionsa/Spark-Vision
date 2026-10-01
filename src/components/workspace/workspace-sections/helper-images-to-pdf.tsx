"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  Cog,
  Download,
  Eye,
  FileImage,
  FilePlus2,
  FileText,
  FolderUp,
  GripVertical,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { downloadBlob } from "@/lib/download-media";
import {
  createImagePdf,
  renderPdfPreviewPages,
  type PdfImageFit,
  type PdfOutputQuality,
  type PdfPageOrientation,
} from "@/lib/browser-image-pdf";
import { convertPdfFileToPageImages, isImageFile, isPdfFile } from "./machine-valuation/mv-pdf-page-images";

type ComposerItem = {
  id: string;
  file: File;
  fromPdf: boolean;
};

type Copy = {
  upload: string;
  folder: string;
  preview: string;
  previewTitle: string;
  download: string;
  cancel: string;
  settings: string;
  drop: string;
  accepted: string;
  empty: string;
  removeAll: string;
  imagesPerRow: string;
  imagesPerPage: string;
  imageFit: string;
  orientation: string;
  quality: string;
  portrait: string;
  landscape: string;
  contain: string;
  cover: string;
  stretch: string;
  original: string;
  best: string;
  high: string;
  compact: string;
  converting: string;
  creating: string;
  preparingPreview: string;
  failed: string;
  invalid: string;
  reorder: string;
};

const COPY: Record<"ar" | "en", Copy> = {
  ar: {
    upload: "إضافة ملفات",
    folder: "مجلد",
    preview: "معاينة وتنزيل",
    previewTitle: "معاينة PDF",
    download: "تنزيل",
    cancel: "إلغاء",
    settings: "إعدادات PDF",
    drop: "اسحب الصور أو ملفات PDF هنا",
    accepted: "صور وPDF",
    empty: "أضف صورًا أو PDF",
    removeAll: "حذف الكل",
    imagesPerRow: "الصور في الصف",
    imagesPerPage: "الصور في الصفحة",
    imageFit: "شكل الصورة",
    orientation: "اتجاه الصفحة",
    quality: "الجودة",
    portrait: "طولي",
    landscape: "عرضي",
    contain: "احتواء كامل",
    cover: "ملء مع اقتطاع",
    stretch: "تمديد",
    original: "الحجم الأصلي",
    best: "الأفضل · 300 DPI",
    high: "عالية · 240 DPI",
    compact: "مدمجة · 160 DPI",
    converting: "تحويل PDF",
    creating: "إنشاء الملف",
    preparingPreview: "تجهيز المعاينة",
    failed: "تعذر تجهيز بعض الملفات",
    invalid: "لم يتم العثور على صور أو ملفات PDF صالحة",
    reorder: "اسحب لتغيير الترتيب",
  },
  en: {
    upload: "Add files",
    folder: "Folder",
    preview: "Preview & download",
    previewTitle: "PDF preview",
    download: "Download",
    cancel: "Cancel",
    settings: "PDF settings",
    drop: "Drop images or PDF files here",
    accepted: "Images and PDF",
    empty: "Add images or PDF files",
    removeAll: "Clear all",
    imagesPerRow: "Images per row",
    imagesPerPage: "Images per page",
    imageFit: "Image fit",
    orientation: "Page orientation",
    quality: "Quality",
    portrait: "Portrait",
    landscape: "Landscape",
    contain: "Fit without crop",
    cover: "Fill and crop",
    stretch: "Stretch",
    original: "Original size",
    best: "Best · 300 DPI",
    high: "High · 240 DPI",
    compact: "Compact · 160 DPI",
    converting: "Converting PDF",
    creating: "Creating file",
    preparingPreview: "Preparing preview",
    failed: "Some files could not be prepared",
    invalid: "No valid image or PDF files found",
    reorder: "Drag to reorder",
  },
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function HelperImagesToPdf({ arabic }: { arabic: boolean }) {
  const t = COPY[arabic ? "ar" : "en"];
  const [items, setItems] = useState<ComposerItem[]>([]);
  const [imagesPerRow, setImagesPerRow] = useState(3);
  const [imagesPerPage, setImagesPerPage] = useState(15);
  const [fit, setFit] = useState<PdfImageFit>("stretch");
  const [orientation, setOrientation] = useState<PdfPageOrientation>("portrait");
  const [quality, setQuality] = useState<PdfOutputQuality>("best");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewPages, setPreviewPages] = useState<Blob[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const draggedIndex = useRef<number | null>(null);
  const dragDepth = useRef(0);

  const previews = useMemo(
    () => items.map((item) => ({ ...item, url: URL.createObjectURL(item.file) })),
    [items],
  );
  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews]);
  const previewPageUrls = useMemo(() => previewPages.map((page) => URL.createObjectURL(page)), [previewPages]);
  useEffect(() => () => {
    previewPageUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [previewPageUrls]);

  const addFiles = async (incoming: FileList | File[]) => {
    if (busy) return;
    const files = Array.from(incoming).filter((file) => isImageFile(file) || isPdfFile(file));
    if (!files.length) {
      setError(t.invalid);
      return;
    }
    setBusy(true);
    setError("");
    const added: ComposerItem[] = [];
    try {
      for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
        const file = files[fileIndex]!;
        if (isImageFile(file)) {
          added.push({ id: newId(), file, fromPdf: false });
          setProgress(`${fileIndex + 1} / ${files.length}`);
          continue;
        }
        const pages = await convertPdfFileToPageImages(file, {
          onProgress: (done, total) => setProgress(`${t.converting} ${done} / ${total}`),
          trimWhiteMargins: false,
        });
        added.push(...pages.map((page) => ({ id: newId(), file: page.file, fromPdf: true })));
      }
      setItems((current) => [...current, ...added]);
    } catch {
      if (added.length) setItems((current) => [...current, ...added]);
      setError(t.failed);
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const buildPdf = async () => {
    if (!items.length || busy) return null;
    setBusy(true);
    setError("");
    try {
      const result = await createImagePdf(
        items.map((item) => item.file),
        {
          imagesPerRow,
          imagesPerPage,
          fit,
          orientation,
          quality,
          rtl: arabic,
          onProgress: (done, total) => setProgress(`${t.creating} ${done} / ${total}`),
        },
      );
      if (result.failed.length) setError(`${t.failed}: ${result.failed.length}`);
      return result.blob;
    } catch {
      setError(t.failed);
      return null;
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const previewPdf = async () => {
    const blob = await buildPdf();
    if (!blob) return;
    setBusy(true);
    try {
      const pages = await renderPdfPreviewPages(
        blob,
        (done, total) => setProgress(`${t.preparingPreview} ${done} / ${total}`),
      );
      setPreviewPages(pages);
      setPreviewBlob(blob);
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const onExternalDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    setItems((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (moved) next.splice(to, 0, moved);
      return next;
    });
  };

  const fitLabel = { contain: t.contain, cover: t.cover, stretch: t.stretch, original: t.original }[fit];

  return (
    <section
      className="space-y-2"
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepth.current += 1;
        if (event.dataTransfer.types.includes("Files")) setDragOver(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (!dragDepth.current) setDragOver(false);
      }}
      onDrop={onExternalDrop}
    >
      <input
        ref={fileInput}
        type="file"
        accept="image/*,.pdf,application/pdf"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) void addFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={folderInput}
        type="file"
        accept="image/*,.pdf,application/pdf"
        multiple
        className="hidden"
        {...({ webkitdirectory: "" } as object)}
        onChange={(event) => {
          if (event.target.files) void addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
        <Button size="sm" className="h-8 px-2.5" disabled={busy} onClick={() => fileInput.current?.click()}>
          <Upload className="h-3.5 w-3.5" />{t.upload}
        </Button>
        <Button size="sm" variant="outline" className="h-8 px-2.5" disabled={busy} onClick={() => folderInput.current?.click()}>
          <FolderUp className="h-3.5 w-3.5" />{t.folder}
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 px-2.5" title={t.settings}>
              <Cog className="h-4 w-4" />
              <span className="hidden sm:inline">{imagesPerRow}×{imagesPerPage} · {fitLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align={arabic ? "start" : "end"} className="w-[min(22rem,calc(100vw-1rem))] space-y-2.5 p-3" dir={arabic ? "rtl" : "ltr"}>
            <SettingSelect label={t.imagesPerRow} value={String(imagesPerRow)} onChange={(value) => setImagesPerRow(Number(value))}>
              {[1, 2, 3, 4].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}
            </SettingSelect>
            <SettingSelect label={t.imagesPerPage} value={String(imagesPerPage)} onChange={(value) => setImagesPerPage(Number(value))}>
              {Array.from({ length: 16 }, (_, index) => index + 1).map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}
            </SettingSelect>
            <SettingSelect label={t.imageFit} value={fit} onChange={(value) => setFit(value as PdfImageFit)}>
              <SelectItem value="contain">{t.contain}</SelectItem>
              <SelectItem value="cover">{t.cover}</SelectItem>
              <SelectItem value="stretch">{t.stretch}</SelectItem>
              <SelectItem value="original">{t.original}</SelectItem>
            </SettingSelect>
            <SettingSelect label={t.orientation} value={orientation} onChange={(value) => setOrientation(value as PdfPageOrientation)}>
              <SelectItem value="portrait">{t.portrait}</SelectItem>
              <SelectItem value="landscape">{t.landscape}</SelectItem>
            </SettingSelect>
            <SettingSelect label={t.quality} value={quality} onChange={(value) => setQuality(value as PdfOutputQuality)}>
              <SelectItem value="best">{t.best}</SelectItem>
              <SelectItem value="high">{t.high}</SelectItem>
              <SelectItem value="compact">{t.compact}</SelectItem>
            </SettingSelect>
          </PopoverContent>
        </Popover>
        {items.length ? (
          <Button size="sm" variant="ghost" className="h-8 px-2 text-slate-500 hover:text-red-600" disabled={busy} onClick={() => setItems([])} title={t.removeAll}>
            <Trash2 className="h-3.5 w-3.5" /><span className="hidden md:inline">{t.removeAll}</span>
          </Button>
        ) : null}
        <span className="min-w-0 flex-1 truncate px-1 text-[11px] font-medium text-slate-500">
          {progress || (items.length ? `${items.length} ${t.accepted}` : "")}
        </span>
        <Button size="sm" className="h-8 bg-slate-900 px-3 hover:bg-slate-800" disabled={!items.length || busy} onClick={() => void previewPdf()}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
          {t.preview}
        </Button>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{error}</div> : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => fileInput.current?.click()}
        className={cn(
          "flex h-20 w-full items-center justify-center gap-2 rounded-lg border border-dashed bg-white/70 px-3 text-sm font-semibold text-slate-600 transition",
          "hover:border-cyan-500 hover:bg-cyan-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500",
          dragOver && "border-cyan-500 bg-cyan-50 text-cyan-800 ring-2 ring-cyan-200",
          busy && "cursor-wait opacity-60",
        )}
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin text-cyan-700" /> : <FilePlus2 className="h-5 w-5 text-cyan-700" />}
        <span>{items.length ? t.drop : t.empty}</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{t.accepted}</span>
      </button>

      {previews.length ? (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8">
          {previews.map((item, index) => (
            <article
              key={item.id}
              draggable={!busy}
              onDragStart={(event) => {
                draggedIndex.current = index;
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("application/x-helper-image-index", String(index));
              }}
              onDragEnd={() => { draggedIndex.current = null; }}
              onDragOver={(event) => {
                if (draggedIndex.current !== null) event.preventDefault();
              }}
              onDrop={(event) => {
                if (event.dataTransfer.files.length) return;
                event.preventDefault();
                event.stopPropagation();
                const from = Number(event.dataTransfer.getData("application/x-helper-image-index"));
                if (Number.isInteger(from)) reorder(from, index);
                draggedIndex.current = null;
              }}
              className="group relative overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
              title={t.reorder}
            >
              <img src={item.url} alt={item.file.name} className="aspect-[4/3] w-full bg-slate-100 object-cover" draggable={false} />
              <div className="flex h-7 items-center gap-1 px-1.5">
                <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-slate-400" />
                {item.fromPdf ? <FileText className="h-3 w-3 shrink-0 text-red-500" /> : <FileImage className="h-3 w-3 shrink-0 text-cyan-600" />}
                <span className="min-w-0 flex-1 truncate text-[10px] text-slate-600">{item.file.name}</span>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                className="absolute top-1 rounded-full bg-slate-950/75 p-1 text-white opacity-90 transition hover:bg-red-600 sm:opacity-0 sm:group-hover:opacity-100"
                style={{ [arabic ? "left" : "right"]: "0.25rem" }}
                aria-label={`${t.removeAll}: ${item.file.name}`}
              >
                <X className="h-3 w-3" />
              </button>
              <span className="absolute top-1 rounded bg-black/65 px-1 py-0.5 text-[9px] font-bold text-white" style={{ [arabic ? "right" : "left"]: "0.25rem" }}>
                {index + 1}
              </span>
            </article>
          ))}
        </div>
      ) : null}

      <Dialog
        open={Boolean(previewBlob)}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewBlob(null);
            setPreviewPages([]);
          }
        }}
      >
        <DialogContent hideCloseButton className="h-[92dvh] w-[min(96vw,72rem)] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden border-0 p-0" dir={arabic ? "rtl" : "ltr"}>
          <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-white px-3">
            <DialogTitle className="min-w-0 flex-1 truncate text-sm">{t.previewTitle}</DialogTitle>
            <Button
              size="sm"
              className="h-8 px-2.5"
              disabled={!previewBlob}
              onClick={() => previewBlob && downloadBlob(previewBlob, "images.pdf")}
            >
              <Download className="h-4 w-4" />{t.download}
            </Button>
            <DialogClose asChild>
              <Button size="sm" variant="outline" className="h-8 px-2.5">
                {t.cancel}
              </Button>
            </DialogClose>
          </div>
          <div className="min-h-0 overflow-y-auto bg-slate-200 p-2 sm:p-3">
            {previewPageUrls.map((url, index) => (
              <img
                key={url}
                src={url}
                alt={`${t.previewTitle} ${index + 1}`}
                className="mx-auto mb-2 h-auto w-full max-w-[52rem] bg-white shadow-md last:mb-0"
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SettingSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="grid grid-cols-[minmax(0,1fr)_9.5rem] items-center gap-2 text-xs font-medium text-slate-700">
      <span>{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </label>
  );
}
