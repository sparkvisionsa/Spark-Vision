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
  downloadSavedHelperPdf,
  listSavedHelperPdfs,
  saveHelperPdf,
  type SavedHelperPdf,
} from "@/lib/helper-pdfs-api";
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
  sourceId: string;
};

type Copy = {
  upload: string;
  folder: string;
  preview: string;
  previewTitle: string;
  downloadOriginal: string;
  downloadCompressed: string;
  compressing: string;
  noReduction: string;
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
  savedFiles: string;
  serial: string;
  imageCount: string;
  pdfCount: string;
  fileSize: string;
  fileDate: string;
  actions: string;
  download: string;
  emptySaved: string;
  saving: string;
  saveFailed: string;
};

const COPY: Record<"ar" | "en", Copy> = {
  ar: {
    upload: "إضافة ملفات",
    folder: "مجلد",
    preview: "معاينة وتنزيل",
    previewTitle: "معاينة PDF",
    downloadOriginal: "حفظ وتنزيل PDF عادي",
    downloadCompressed: "حفظ وتنزيل PDF مضغوط",
    compressing: "ضغط الملف",
    noReduction: "الملف الحالي هو الأصغر؛ تم تنزيله كما هو.",
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
    savedFiles: "ملفات PDF المحفوظة",
    serial: "م",
    imageCount: "عدد الصور",
    pdfCount: "ملفات PDF المرفقة",
    fileSize: "حجم الملف",
    fileDate: "تاريخ الملف",
    actions: "إجراءات",
    download: "تنزيل",
    emptySaved: "لا توجد ملفات PDF محفوظة بعد.",
    saving: "حفظ الملف",
    saveFailed: "تعذر حفظ ملف PDF",
  },
  en: {
    upload: "Add files",
    folder: "Folder",
    preview: "Preview & download",
    previewTitle: "PDF preview",
    downloadOriginal: "Save & download standard PDF",
    downloadCompressed: "Save & download compressed PDF",
    compressing: "Compressing file",
    noReduction: "The current PDF is already smaller; it was downloaded as is.",
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
    savedFiles: "Saved PDF files",
    serial: "No.",
    imageCount: "Images",
    pdfCount: "Attached PDFs",
    fileSize: "File size",
    fileDate: "File date",
    actions: "Actions",
    download: "Download",
    emptySaved: "No saved PDF files yet.",
    saving: "Saving file",
    saveFailed: "Could not save PDF",
  },
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function HelperImagesToPdf({
  arabic,
  overlayContainer,
  csrfToken = "",
}: {
  arabic: boolean;
  /** Host transient menus inside the parent modal, preserving pointer events. */
  overlayContainer?: HTMLElement | null;
  csrfToken?: string;
}) {
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
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [compressionNotice, setCompressionNotice] = useState("");
  const [previewPages, setPreviewPages] = useState<Blob[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [savedFiles, setSavedFiles] = useState<SavedHelperPdf[]>([]);
  const [savedFilesLoaded, setSavedFilesLoaded] = useState(false);
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
  useEffect(() => {
    let cancelled = false;
    void listSavedHelperPdfs()
      .then((files) => { if (!cancelled) setSavedFiles(files); })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setSavedFilesLoaded(true); });
    return () => { cancelled = true; };
  }, []);

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
        const sourceId = newId();
        if (isImageFile(file)) {
          added.push({ id: newId(), file, fromPdf: false, sourceId });
          setProgress(`${fileIndex + 1} / ${files.length}`);
          continue;
        }
        const pages = await convertPdfFileToPageImages(file, {
          onProgress: (done, total) => setProgress(`${t.converting} ${done} / ${total}`),
          trimWhiteMargins: false,
        });
        added.push(...pages.map((page) => ({ id: newId(), file: page.file, fromPdf: true, sourceId })));
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

  const buildPdf = async (outputQuality: PdfOutputQuality = quality) => {
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
          quality: outputQuality,
          rtl: arabic,
          onProgress: (done, total) => setProgress(`${outputQuality === "compressed" ? t.compressing : t.creating} ${done} / ${total}`),
        },
      );
      if (result.failed.length) {
        setError(`${t.failed}: ${result.failed.length}`);
        if (outputQuality === "compressed") return null;
      }
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
      setCompressedBlob(null);
      setCompressionNotice("");
    } catch {
      setError(t.failed);
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const saveAndDownload = async (blob: Blob, kind: "standard" | "compressed", filename: string) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setProgress(t.saving);
    try {
      const saved = await saveHelperPdf({
        blob,
        kind,
        imageCount: items.filter((item) => !item.fromPdf).length,
        pdfCount: new Set(items.filter((item) => item.fromPdf).map((item) => item.sourceId)).size,
        csrfToken,
      });
      setSavedFiles((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setSavedFilesLoaded(true);
      downloadBlob(blob, filename);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.saveFailed);
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const downloadCompressedPdf = async () => {
    if (!previewBlob || busy) return;
    setCompressionNotice("");
    const blob = compressedBlob ?? await buildPdf("compressed");
    if (!blob) return;
    if (!compressedBlob) setCompressedBlob(blob);
    if (blob.size < previewBlob.size) {
      await saveAndDownload(blob, "compressed", "images-compressed.pdf");
    } else {
      await saveAndDownload(previewBlob, "standard", "images.pdf");
      setCompressionNotice(t.noReduction);
    }
  };

  const downloadSaved = async (file: SavedHelperPdf) => {
    setError("");
    try {
      downloadBlob(await downloadSavedHelperPdf(file), file.name);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t.failed);
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
            <Button size="sm" variant="outline" className="h-8 px-2.5" title={t.settings} aria-label={t.settings}>
              <Cog className="h-4 w-4" />
              <span className="hidden sm:inline">{imagesPerRow}×{imagesPerPage} · {fitLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align={arabic ? "start" : "end"}
            container={overlayContainer}
            data-helper-tools-overlay
            className="z-[920] w-[min(22rem,calc(100vw-1rem))] space-y-2.5 p-3"
            dir={arabic ? "rtl" : "ltr"}
          >
            <SettingSelect portalContainer={overlayContainer} label={t.imagesPerRow} value={String(imagesPerRow)} onChange={(value) => setImagesPerRow(Number(value))}>
              {[1, 2, 3, 4].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}
            </SettingSelect>
            <SettingSelect portalContainer={overlayContainer} label={t.imagesPerPage} value={String(imagesPerPage)} onChange={(value) => setImagesPerPage(Number(value))}>
              {Array.from({ length: 16 }, (_, index) => index + 1).map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}
            </SettingSelect>
            <SettingSelect portalContainer={overlayContainer} label={t.imageFit} value={fit} onChange={(value) => setFit(value as PdfImageFit)}>
              <SelectItem value="contain">{t.contain}</SelectItem>
              <SelectItem value="cover">{t.cover}</SelectItem>
              <SelectItem value="stretch">{t.stretch}</SelectItem>
              <SelectItem value="original">{t.original}</SelectItem>
            </SettingSelect>
            <SettingSelect portalContainer={overlayContainer} label={t.orientation} value={orientation} onChange={(value) => setOrientation(value as PdfPageOrientation)}>
              <SelectItem value="portrait">{t.portrait}</SelectItem>
              <SelectItem value="landscape">{t.landscape}</SelectItem>
            </SettingSelect>
            <SettingSelect portalContainer={overlayContainer} label={t.quality} value={quality} onChange={(value) => setQuality(value as PdfOutputQuality)}>
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

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <h2 className="border-b border-slate-200 px-3 py-2 text-sm font-bold text-slate-800">{t.savedFiles}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-start font-semibold">{t.serial}</th>
                <th className="px-3 py-2 text-start font-semibold">{t.imageCount}</th>
                <th className="px-3 py-2 text-start font-semibold">{t.pdfCount}</th>
                <th className="px-3 py-2 text-start font-semibold">{t.fileSize}</th>
                <th className="px-3 py-2 text-start font-semibold">{t.fileDate}</th>
                <th className="px-3 py-2 text-start font-semibold">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {savedFiles.map((file) => (
                <tr key={file.id} className="text-slate-700">
                  <td className="px-3 py-2 font-bold tabular-nums">{file.sequence}</td>
                  <td className="px-3 py-2 tabular-nums">{file.imageCount}</td>
                  <td className="px-3 py-2 tabular-nums">{file.pdfCount}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatFileSize(file.size, arabic)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatFileDate(file.createdAt, arabic)}</td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void downloadSaved(file)}>
                      <Download className="h-3.5 w-3.5" />{t.download}
                    </Button>
                  </td>
                </tr>
              ))}
              {savedFilesLoaded && !savedFiles.length ? (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-slate-500">{t.emptySaved}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog
        open={Boolean(previewBlob)}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setPreviewBlob(null);
            setPreviewPages([]);
            setCompressedBlob(null);
            setCompressionNotice("");
          }
        }}
      >
        <DialogContent hideCloseButton className="grid h-[92dvh] w-[min(96vw,72rem)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden border-0 p-0" dir={arabic ? "rtl" : "ltr"}>
          <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-white px-3">
            <DialogTitle className="min-w-0 flex-1 truncate text-sm">{t.previewTitle}</DialogTitle>
            <DialogClose asChild>
              <Button size="sm" variant="outline" className="h-8 px-2.5" disabled={busy}>
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
          <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-white px-3 py-2">
            {error ? <span role="alert" className="me-auto text-xs text-red-700">{error}</span> : null}
            {compressionNotice ? <span role="status" className="me-auto text-xs text-slate-600">{compressionNotice}</span> : null}
            {progress ? <span role="status" className="me-auto text-xs text-slate-600">{progress}</span> : null}
            <Button size="sm" variant="outline" className="h-8 px-2.5" disabled={!previewBlob || busy || !csrfToken} onClick={() => previewBlob && void saveAndDownload(previewBlob, "standard", "images.pdf")}>
              <Download className="h-4 w-4" />{t.downloadOriginal}
            </Button>
            <Button size="sm" className="h-8 px-2.5" disabled={!previewBlob || busy || !csrfToken} onClick={() => void downloadCompressedPdf()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{t.downloadCompressed}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function formatFileSize(bytes: number, arabic: boolean) {
  const units = arabic ? ["بايت", "ك.ب", "م.ب", "ج.ب"] : ["B", "KB", "MB", "GB"];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${new Intl.NumberFormat(arabic ? "ar-SA" : "en-GB", { maximumFractionDigits: unit ? 1 : 0 }).format(value)} ${units[unit]}`;
}

function formatFileDate(value: string, arabic: boolean) {
  return new Intl.DateTimeFormat(arabic ? "ar-SA" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function SettingSelect({
  portalContainer,
  label,
  value,
  onChange,
  children,
}: {
  portalContainer?: HTMLElement | null;
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
        <SelectContent container={portalContainer} data-helper-tools-overlay>{children}</SelectContent>
      </Select>
    </label>
  );
}
