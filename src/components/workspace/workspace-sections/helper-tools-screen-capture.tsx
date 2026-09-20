"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check, Download, Image as ImageIcon, Mic, MicOff, Monitor, MonitorSmartphone, Pencil, Plus, Trash2, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { downloadBlob, fileNameTimestamp, safeMediaFileName } from "@/lib/download-media";
import { formatRecordingClock, recordingExtension, type RecorderSurface } from "@/hooks/use-screen-recorder";
import { SeekableVideo } from "@/components/seekable-video";
import { useHelperRecording } from "@/components/helper-recording-provider";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { finalizeRecordingBlob } from "@/lib/fix-recording-duration";
import {
  deleteScreenRecording,
  listScreenRecordings,
  readScreenRecording,
  updateScreenRecordingDescription,
  type StoredRecordingMeta,
} from "@/lib/helper-tools-recordings";
import {
  deleteRemoteScreenRecording,
  helperRecordingFileUrl,
  listVisibleScreenRecordings,
  updateRemoteScreenRecording,
} from "@/lib/helper-tools-recordings-api";

const DESCRIPTION_MAX = 200;
type SourceFilter = "all" | RecorderSurface;

const text = {
  ar: {
    title: "تصوير الشاشة",
    intro: "سجّل أي شاشة أو تبويب النظام، مع الميكروفون والكاميرا اختيارياً.",
    source: "المصدر",
    system: "النظام",
    any: "تسجيل عام",
    micOn: "ميكروفون",
    micOff: "بدون ميكروفون",
    cameraOn: "كاميرا",
    cameraOff: "بدون كاميرا",
    record: "ابدأ التسجيل",
    starting: "بانتظار المشاركة…",
    recordingLocked: "التسجيل الحالي قيد العمل. أنهِه من الشريط أعلاه قبل بدء تسجيل آخر.",
    description: "اسم التسجيل",
    download: "تنزيل",
    frame: "إطار",
    close: "إغلاق",
    saveAndClose: "حفظ وإغلاق",
    videoName: "اسم الفيديو",
    liveCamera: "معاينة الكاميرا",
    delete: "حذف",
    edit: "تعديل الاسم",
    save: "حفظ",
    cancel: "إلغاء",
    newRecording: "تسجيل جديد",
    defaultName: "تسجيل-الشاشة",
    preview: "معاينة التسجيل",
    library: "التسجيلات السابقة",
    filter: "المصدر",
    all: "الكل",
    empty: "لا توجد تسجيلات في هذا المصدر بعد.",
    date: "التاريخ",
    duration: "المدة",
    size: "الحجم",
    caption: "الاسم",
    actions: "إجراءات",
    watch: "مشاهدة",
    deleteTitle: "حذف التسجيل؟",
    deleteBody: "سيُحذف هذا التسجيل من هذا الجهاز ولا يمكن استرجاعه.",
  },
  en: {
    title: "Screen capture",
    intro: "Record any screen or this system tab, with optional microphone and camera.",
    source: "Source",
    system: "This system",
    any: "Entire screen",
    micOn: "Microphone",
    micOff: "No microphone",
    cameraOn: "Camera",
    cameraOff: "No camera",
    record: "Start recording",
    starting: "Waiting…",
    recordingLocked: "A recording is already in progress. Stop it from the bar above before starting another.",
    description: "Recording name",
    download: "Download",
    frame: "Frame",
    close: "Close",
    saveAndClose: "Save and close",
    videoName: "Video name",
    liveCamera: "Camera preview",
    delete: "Delete",
    edit: "Edit name",
    save: "Save",
    cancel: "Cancel",
    newRecording: "New recording",
    defaultName: "screen-recording",
    preview: "Recording preview",
    library: "Previous recordings",
    filter: "Source",
    all: "All",
    empty: "No recordings for this source yet.",
    date: "Date",
    duration: "Duration",
    size: "Size",
    caption: "Name",
    actions: "Actions",
    watch: "Watch",
    deleteTitle: "Delete this recording?",
    deleteBody: "This recording will be removed from this device and cannot be recovered.",
  },
} as const;

function formatRecordedAt(value: number, arabic: boolean) {
  return new Intl.DateTimeFormat(arabic ? "ar-SA" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function HelperToolsScreenCapture({ arabic }: { arabic: boolean }) {
  const labels = arabic ? text.ar : text.en;
  const {
    surface, setSurface, withMicrophone, setWithMicrophone, withCamera, setWithCamera,
    cameraError, setCameraError, description, setDescription,
    recording, recordedSurface, savedId, libraryError, owner, active, starting,
    startRecording, newRecording,
  } = useHelperRecording();
  const { csrfToken } = useAuthTracking();
  const live = active || starting;
  const settingsLocked = live;
  const [url, setUrl] = useState("");
  const [items, setItems] = useState<StoredRecordingMeta[]>([]);
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [openUrl, setOpenUrl] = useState("");
  const [openBlob, setOpenBlob] = useState<Blob | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const preview = useRef<HTMLVideoElement>(null);
  const libraryPreview = useRef<HTMLVideoElement>(null);
  const captionInput = useRef<HTMLInputElement>(null);

  const refreshLibrary = useCallback(async () => {
    if (!owner) { setItems([]); return; }
    setItems(await listVisibleScreenRecordings(owner.key, csrfToken, filter === "all" ? undefined : filter));
  }, [filter, owner, csrfToken]);

  useEffect(() => { void refreshLibrary(); }, [refreshLibrary, savedId, recording.blob]);
  useEffect(() => {
    if (!recording.blob) { setUrl(""); return; }
    const objectUrl = URL.createObjectURL(recording.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [recording.blob]);
  useEffect(() => {
    if (openId && !items.some((item) => item.id === openId)) setOpenId(null);
  }, [items, openId]);
  useEffect(() => {
    if (!openId) { setOpenUrl(""); setOpenBlob(null); return; }
    setOpenUrl("");
    setOpenBlob(null);
    let objectUrl = "";
    let cancelled = false;
    const ownerKey = owner?.key;
    void (async () => {
      if (!ownerKey) return;
      const local = await readScreenRecording(openId, ownerKey);
      const cachedId = local ? null : (await listScreenRecordings(ownerKey)).find((row) => row.remoteId === openId)?.id;
      const cached = cachedId ? await readScreenRecording(cachedId, ownerKey) : null;
      const row = local ?? cached;
      if (cancelled) return;
      if (row) {
        const playable = row.seconds > 0 ? await finalizeRecordingBlob(row.blob, row.seconds * 1000) : row.blob;
        if (cancelled) return;
        objectUrl = URL.createObjectURL(playable);
        setOpenBlob(playable);
        setOpenUrl(objectUrl);
        return;
      }
      const itemRemote = /^[a-f\d]{24}$/i.test(openId);
      if (itemRemote) {
        setOpenBlob(null);
        setOpenUrl(helperRecordingFileUrl(openId));
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [openId, owner?.key]);
  useEffect(() => {
    if (editingId) captionInput.current?.focus();
  }, [editingId]);

  const sourceLabel = (value: RecorderSurface) => (value === "system" ? labels.system : labels.any);
  const fileFor = (item: StoredRecordingMeta) =>
    `${safeMediaFileName(item.description, `${labels.defaultName}-${fileNameTimestamp(new Date(item.createdAt))}`)}.${item.mime.includes("mp4") ? "mp4" : "webm"}`;
  const baseName = safeMediaFileName(description, `${labels.defaultName}-${fileNameTimestamp()}`);
  const videoName = `${baseName}.${recordingExtension(recording.blob)}`;
  const saveVideo = () => { if (recording.blob) downloadBlob(recording.blob, videoName); };
  const saveFrameFrom = async (node: HTMLVideoElement | null, name: string) => {
    if (!node?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = node.videoWidth;
    canvas.height = node.videoHeight;
    canvas.getContext("2d")?.drawImage(node, 0, 0);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (png) downloadBlob(png, name);
  };
  const startCaptionEdit = (item: StoredRecordingMeta) => {
    setEditingId(item.id);
    setEditingValue(item.description);
  };
  const cancelCaptionEdit = () => {
    setEditingId(null);
    setEditingValue("");
  };
  const saveCaption = async (id: string) => {
    if (!owner) return;
    const next = editingValue.trim().slice(0, DESCRIPTION_MAX);
    const item = items.find((row) => row.id === id);
    await updateScreenRecordingDescription(id, owner.key, next);
    if (item?.remoteId || /^[a-f\d]{24}$/i.test(id)) {
      await updateRemoteScreenRecording(csrfToken, item?.remoteId || id, next).catch(() => undefined);
    }
    if (id === savedId) setDescription(next);
    setEditingId(null);
    setEditingValue("");
    await refreshLibrary();
  };
  const downloadItem = async (item: StoredRecordingMeta) => {
    if (!owner) return;
    setBusyId(item.id);
    try {
      let blob: Blob | null = item.id === openId ? openBlob : null;
      if (!blob) {
        const local = await readScreenRecording(item.id, owner.key);
        blob = local?.blob ?? null;
      }
      if (!blob && (item.remoteId || /^[a-f\d]{24}$/i.test(item.id))) {
        const response = await fetch(helperRecordingFileUrl(item.remoteId || item.id), { credentials: "include" });
        if (response.ok) blob = await response.blob();
      }
      if (!blob) return;
      const playable = item.seconds > 0 ? await finalizeRecordingBlob(blob, item.seconds * 1000) : blob;
      downloadBlob(playable, fileFor(item));
    } finally {
      setBusyId(null);
    }
  };
  const removeLibraryItem = async (id: string) => {
    if (!owner) return;
    const item = items.find((row) => row.id === id);
    const locals = owner ? await listScreenRecordings(owner.key) : [];
    const localMatches = locals.filter((row) => row.id === id || row.remoteId === id || (item?.remoteId && row.remoteId === item.remoteId));
    for (const row of localMatches) await deleteScreenRecording(row.id, owner.key);
    if (item?.remoteId || /^[a-f\d]{24}$/i.test(id)) {
      await deleteRemoteScreenRecording(csrfToken, item?.remoteId || id).catch(() => undefined);
    }
    if (openId === id) setOpenId(null);
    if (editingId === id) cancelCaptionEdit();
    if (savedId === id) newRecording();
    setDeleteId(null);
    await refreshLibrary();
  };
  const startFresh = () => {
    if (live) return;
    newRecording();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-3 px-1 pb-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-base font-bold text-slate-900">{labels.title}</h1>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">{labels.intro}</p>
        </div>
        {(recording.blob || live) && (
          <Button
            size="sm"
            disabled={live || !recording.blob}
            className="h-8 rounded-lg bg-slate-900 px-3 text-xs hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-40"
            onClick={startFresh}
          >
            <Plus className="h-3.5 w-3.5" />
            {labels.newRecording}
          </Button>
        )}
      </div>

      <section className={cn("space-y-3 rounded-xl border bg-white p-3", live ? "border-red-200" : "border-slate-200")}>
        <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
          <p className="text-[11px] font-bold text-slate-400">{labels.source}</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={labels.source}>
            {([
              { id: "any" as const, label: labels.any, icon: MonitorSmartphone },
              { id: "system" as const, label: labels.system, icon: Monitor },
            ]).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                disabled={settingsLocked}
                aria-pressed={surface === id}
                onClick={() => setSurface(id)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60",
                  surface === id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="switch"
            disabled={settingsLocked}
            aria-checked={withMicrophone}
            aria-label={withMicrophone ? labels.micOn : labels.micOff}
            title={withMicrophone ? labels.micOn : labels.micOff}
            onClick={() => setWithMicrophone(!withMicrophone)}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60",
              withMicrophone ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
            )}
          >
            {withMicrophone ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            role="switch"
            disabled={settingsLocked}
            aria-checked={withCamera}
            aria-label={withCamera ? labels.cameraOn : labels.cameraOff}
            title={withCamera ? labels.cameraOn : labels.cameraOff}
            onClick={() => { setCameraError(""); setWithCamera(!withCamera); }}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60",
              withCamera ? "bg-sky-500 text-white" : "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
            )}
          >
            {withCamera ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            disabled={live}
            aria-label={starting ? labels.starting : labels.record}
            onClick={startRecording}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-red-500 px-3 text-xs font-bold text-white transition hover:bg-red-600 disabled:pointer-events-none disabled:opacity-40"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-white" />
            {starting ? labels.starting : labels.record}
          </button>
        </div>
        {live ? <p className="text-[11px] leading-5 text-red-700">{labels.recordingLocked}</p> : null}
        {live && recording.cameraPreview ? (
          <div className="flex items-end gap-3 rounded-2xl border border-sky-100 bg-slate-950/95 p-2.5 shadow-inner">
            <div className="overflow-hidden rounded-xl ring-2 ring-white/80 shadow-lg">
              <video
                autoPlay
                muted
                playsInline
                aria-label={labels.liveCamera}
                className="h-36 w-48 -scale-x-100 bg-slate-900 object-cover"
                ref={(node) => {
                  if (!node) return;
                  if (node.srcObject !== recording.cameraPreview) node.srcObject = recording.cameraPreview;
                  void node.play().catch(() => undefined);
                }}
              />
            </div>
            <p className="pb-1 text-[11px] font-semibold text-white/80">{labels.liveCamera}</p>
          </div>
        ) : null}
      </section>

      {(recording.error || cameraError || libraryError) && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700">{recording.error || cameraError || libraryError}</p>
      )}
      {recording.notice && !recording.error && (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-800">{recording.notice}</p>
      )}

      {recording.blob && url && !live && (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <SeekableVideo ref={preview} src={url} aria-label={labels.preview} className="aspect-video max-h-[42vh] w-full bg-slate-950" />
          <div className="border-t border-slate-100 bg-gradient-to-l from-slate-50 to-white p-3">
            <p className="mb-2.5 text-[11px] tabular-nums text-slate-500">
              {formatRecordingClock(recording.seconds)} · {formatSize(recording.blob.size)} · {sourceLabel(recordedSurface)}
            </p>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
              <label className="grid w-full gap-1 sm:w-1/2">
                <span className="text-[11px] font-semibold text-slate-600">{labels.videoName}</span>
                <Input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={DESCRIPTION_MAX}
                  placeholder={labels.defaultName}
                  className="h-10 rounded-xl border-slate-200 bg-white text-sm shadow-sm focus-visible:ring-sky-500"
                />
              </label>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  className="h-10 rounded-xl bg-sky-600 px-4 text-xs font-semibold shadow-sm hover:bg-sky-700"
                  onClick={saveVideo}
                >
                  <Download className="h-3.5 w-3.5" />
                  {labels.download}
                </Button>
                <Button
                  className="h-10 rounded-xl bg-slate-900 px-4 text-xs font-semibold shadow-sm hover:bg-slate-800"
                  onClick={startFresh}
                >
                  <Check className="h-3.5 w-3.5" />
                  {labels.saveAndClose}
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
            <p className="text-xs font-bold text-slate-800">{labels.library}</p>
          <div className="flex flex-wrap gap-1 sm:ms-auto" role="group" aria-label={labels.filter}>
            {([
              { id: "all" as const, label: labels.all },
              { id: "any" as const, label: labels.any },
              { id: "system" as const, label: labels.system },
            ]).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={cn(
                  "h-7 shrink-0 rounded-md px-2.5 text-[11px] font-semibold whitespace-nowrap",
                  filter === id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-slate-400">{labels.empty}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-start text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500">
                  <th className="min-w-[12rem] px-3 py-2.5 text-start">{labels.videoName}</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-start">{labels.date}</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-start">{labels.duration}</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-start">{labels.size}</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-start">{labels.source}</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-start">{labels.actions}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const editing = editingId === item.id;
                  return (
                    <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2 align-middle">
                          {editing ? (
                            <div className="flex items-center gap-1">
                              <Input
                                ref={captionInput}
                                value={editingValue}
                                maxLength={DESCRIPTION_MAX}
                                aria-label={labels.videoName}
                                className="h-8 text-xs"
                                onChange={(event) => setEditingValue(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") void saveCaption(item.id);
                                  if (event.key === "Escape") cancelCaptionEdit();
                                }}
                              />
                              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-emerald-700 hover:bg-emerald-50" aria-label={labels.save} onClick={() => void saveCaption(item.id)}>
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" aria-label={labels.cancel} onClick={cancelCaptionEdit}>
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm font-semibold leading-5 text-slate-900 break-words">
                              {item.description || labels.defaultName}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs text-slate-700">
                          {formatRecordedAt(item.createdAt, arabic)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-middle font-mono text-xs tabular-nums text-slate-600">
                          {formatRecordingClock(item.seconds)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs tabular-nums text-slate-600">
                          {formatSize(item.size)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs text-slate-600">
                          {sourceLabel(item.source)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 align-middle">
                          <div className="flex items-center gap-0.5">
                            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-violet-700 hover:bg-violet-50" aria-label={labels.watch} title={labels.watch} onClick={() => setOpenId(item.id)}>
                              <Video className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100" aria-label={labels.edit} title={labels.edit} onClick={() => startCaptionEdit(item)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" disabled={busyId === item.id} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sky-700 hover:bg-sky-50 disabled:opacity-40" aria-label={labels.download} title={labels.download} onClick={() => void downloadItem(item)}>
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50" aria-label={labels.delete} title={labels.delete} onClick={() => setDeleteId(item.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={Boolean(openId)} onOpenChange={(open) => { if (!open) setOpenId(null); }}>
        <DialogContent className="max-w-4xl gap-3 overflow-hidden p-4 sm:rounded-2xl" dir={arabic ? "rtl" : "ltr"}>
          <DialogTitle className={cn("pe-8 text-base", arabic ? "text-right" : "text-left")}>
            {items.find((item) => item.id === openId)?.description || labels.preview}
          </DialogTitle>
          <DialogDescription className="sr-only">{labels.watch}</DialogDescription>
          {openUrl ? (
            <>
              <SeekableVideo ref={libraryPreview} src={openUrl} className="aspect-video w-full rounded-lg bg-slate-950" />
              <div className="flex flex-wrap gap-1.5">
                <Button
                  variant="outline"
                  className="h-8 rounded-lg px-3 text-xs"
                  onClick={() => {
                    const item = items.find((row) => row.id === openId);
                    if (!item) return;
                    void saveFrameFrom(libraryPreview.current, fileFor(item).replace(/\.[^.]+$/, ".png"));
                  }}
                >
                  <ImageIcon className="h-3.5 w-3.5" />{labels.frame}
                </Button>
              </div>
            </>
          ) : (
            <div className="aspect-video w-full rounded-lg bg-slate-950" />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent className="max-w-md rounded-2xl" dir={arabic ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>{labels.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription className={arabic ? "text-right" : "text-left"}>{labels.deleteBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={arabic ? "sm:flex-row-reverse sm:space-x-0 sm:gap-2" : undefined}>
            <AlertDialogCancel>{labels.cancel}</AlertDialogCancel>
            <AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={() => { if (deleteId) void removeLibraryItem(deleteId); }}>
              {labels.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
