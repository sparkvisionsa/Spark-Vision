"use client";

import { Tajawal } from "next/font/google";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  AlertCircle,
  AudioLines,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  FileType2,
  Image as ImageIcon,
  Loader2,
  Mic,
  MicOff,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { MvInspectorFile, MvInspectorLogicalFileType, MvProject } from "./types";
import { MvTopBar } from "./mv-ui";
import { MV_PROJECTS_TABLE_PATH } from "./mv-home-routes";
import {
  MV_ALL_LOCATIONS_VALUE,
  MvLocationMultiSelect,
  mvLocationId,
  mvLocationLabel,
  normalizeMvLocationSelection,
} from "./mv-location-multi-select";

const font = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

const ACCEPT = "";
const DEFAULT_INSPECTOR_FILE_LOCATION_IDS = [MV_ALL_LOCATIONS_VALUE];

/** تنزيل أو بث عبر واجهة التطبيق لجميع ملفات المعاين. */
function inspectorFileDownloadHref(projectId: string, f: MvInspectorFile, mode: "attachment" | "inline"): string {
  const fid = encodeURIComponent(f.id);
  const base = `/api/mv/projects/${projectId}/inspectorFiles/${fid}/download`;
  return mode === "attachment" ? `${base}?attachment=1` : base;
}

function inspectorFileMediaSrc(projectId: string, f: MvInspectorFile): string {
  return inspectorFileDownloadHref(projectId, f, "inline");
}

function inspectorFileLocationIds(file: MvInspectorFile): string[] {
  return Array.isArray(file.locationIds)
    ? file.locationIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];
}

type UploadJobState = "queued" | "uploading" | "done" | "error";

type UploadJob = {
  clientId: string;
  name: string;
  state: UploadJobState;
  progress: number;
};

function MvCircularUploadRing({
  progress,
  indeterminate,
  state,
}: {
  progress: number;
  indeterminate?: boolean;
  state: UploadJobState;
}) {
  const r = 15;
  const stroke = 2.5;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, progress));
  const dash = c * (1 - pct / 100);
  const done = state === "done";
  const err = state === "error";

  return (
    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
      <svg className="absolute inset-0 h-9 w-9 -rotate-90" viewBox="0 0 36 36" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" stroke="#e8eaed" strokeWidth={stroke} />
        {!indeterminate && !done && !err ? (
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke="#1a73e8"
            strokeWidth={stroke}
            strokeDasharray={c}
            strokeDashoffset={dash}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-200 ease-out"
          />
        ) : null}
        {indeterminate && !done && !err ? (
          <circle
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke="#1a73e8"
            strokeWidth={stroke}
            strokeDasharray={`${c * 0.22} ${c}`}
            strokeLinecap="round"
            className="origin-[18px_18px] animate-spin"
            style={{ animationDuration: "0.9s" }}
          />
        ) : null}
      </svg>
      {done ? <Check className="relative z-[1] h-[18px] w-[18px] text-emerald-600" strokeWidth={2.5} aria-hidden /> : null}
      {err ? <AlertCircle className="relative z-[1] h-5 w-5 text-rose-600" strokeWidth={2.2} aria-hidden /> : null}
    </div>
  );
}

export default function MvInspectorFilesWorkspace({ projectId }: { projectId: string }) {
  return <MvInspectorFilesPanel projectId={projectId} />;
}

function TypeIcon({ type, className }: { type: MvInspectorLogicalFileType; className?: string }) {
  const cls = cn("h-5 w-5", className);
  switch (type) {
    case "pdf":
      return <FileText className={cls} />;
    case "excel":
      return <FileSpreadsheet className={cls} />;
    case "word":
      return <FileType2 className={cls} />;
    case "image":
      return <ImageIcon className={cls} />;
    case "video":
      return <Video className={cls} />;
    case "audio":
      return <AudioLines className={cls} />;
    default:
      return <FileText className={cls} />;
  }
}

export function MvInspectorFilesPanel({
  projectId,
  initialProject = null,
  embedded = false,
  initialLocationIds = DEFAULT_INSPECTOR_FILE_LOCATION_IDS,
  locationSelectionLocked = false,
  className,
  onProjectLoaded,
}: {
  projectId: string;
  initialProject?: MvProject | null;
  embedded?: boolean;
  initialLocationIds?: string[];
  locationSelectionLocked?: boolean;
  className?: string;
  onProjectLoaded?: (project: MvProject) => void;
}) {
  const { toast } = useToast();
  const [project, setProject] = useState<MvProject | null>(initialProject);
  const [files, setFiles] = useState<MvInspectorFile[]>(initialProject?.inspectorFiles ?? []);
  const [loading, setLoading] = useState(!initialProject);
  const [uploadJobs, setUploadJobs] = useState<UploadJob[]>([]);
  const uploadQueueRef = useRef(Promise.resolve());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [recording, setRecording] = useState(false);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>(initialLocationIds);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onProjectLoadedRef = useRef(onProjectLoaded);

  useEffect(() => {
    onProjectLoadedRef.current = onProjectLoaded;
  }, [onProjectLoaded]);

  useEffect(() => {
    if (!initialProject) return;
    setProject(initialProject);
    setFiles(initialProject.inspectorFiles ?? []);
    setLoading(false);
  }, [initialProject]);

  useEffect(() => {
    const locations = project?.locations ?? initialProject?.locations ?? [];
    setSelectedLocationIds(normalizeMvLocationSelection(initialLocationIds, locations));
  }, [initialLocationIds, initialProject?.locations, project?.locations]);

  const load = useCallback(async (options: { showLoading?: boolean } = {}) => {
    const showLoading = options.showLoading ?? true;
    try {
      if (showLoading) setLoading(true);
      const res = await fetch(`/api/mv/projects/${projectId}?picAssetMode=summary`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (showLoading) {
          setProject(null);
          setFiles([]);
        }
        return;
      }
      const data = (await res.json()) as { project?: MvProject };
      setProject(data.project ?? null);
      setFiles(data.project?.inspectorFiles ?? []);
      if (data.project) onProjectLoadedRef.current?.(data.project);
    } catch {
      if (showLoading) {
        setProject(null);
        setFiles([]);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load({ showLoading: !initialProject?._id });
  }, [initialProject?._id, load]);

  useEffect(() => {
    const valid = new Set(files.map((f) => f.id));
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [files]);

  const patchUploadJob = useCallback((clientId: string, patch: Partial<UploadJob>) => {
    setUploadJobs((rows) => rows.map((row) => (row.clientId === clientId ? { ...row, ...patch } : row)));
  }, []);

  const scheduleRemoveUploadJob = useCallback((clientId: string, delayMs: number) => {
    window.setTimeout(() => {
      setUploadJobs((rows) => rows.filter((row) => row.clientId !== clientId));
    }, delayMs);
  }, []);

  const uploadOne = useCallback(
    (file: File, clientId: string) => {
      patchUploadJob(clientId, { state: "uploading", progress: 0 });
      const fd = new FormData();
      fd.append("file", file);
      fd.append(
        "locationIds",
        JSON.stringify(selectedLocationIds.includes(MV_ALL_LOCATIONS_VALUE) ? [] : selectedLocationIds),
      );
      const xhrUrl = `/api/mv/projects/${projectId}/inspectorFiles`;

      return new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", xhrUrl);
        xhr.withCredentials = true;
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            const pct = Math.round((100 * ev.loaded) / Math.max(ev.total, 1));
            patchUploadJob(clientId, { progress: pct });
          }
        };
        xhr.onload = () => {
          let raw: unknown = null;
          try {
            raw = xhr.responseText ? JSON.parse(xhr.responseText) : null;
          } catch {
            raw = null;
          }
          if (xhr.status < 200 || xhr.status >= 300) {
            let msg = "تعذر الرفع.";
            if (raw && typeof raw === "object") {
              const o = raw as { message?: unknown; error?: unknown };
              if (typeof o.message === "string" && o.message.trim()) msg = o.message.trim();
              else if (o.error === "upstream_unreachable")
                msg =
                  "الخلفية غير متاحة من الخادم. على السحابة عيّن MV_INTERNAL_API_ORIGIN أو BACKEND_URL لعنوان Nest.";
            }
            toast({ variant: "destructive", title: file.name, description: msg });
            patchUploadJob(clientId, { state: "error", progress: 0 });
            scheduleRemoveUploadJob(clientId, 8000);
            resolve();
            return;
          }
          const body = raw as { inspectorFiles?: MvInspectorFile[] };
          if (Array.isArray(body.inspectorFiles)) setFiles(body.inspectorFiles);
          patchUploadJob(clientId, { state: "done", progress: 100 });
          scheduleRemoveUploadJob(clientId, 2800);
          resolve();
        };
        xhr.onerror = () => {
          toast({ variant: "destructive", title: file.name, description: "خطأ شبكة أثناء الرفع." });
          patchUploadJob(clientId, { state: "error", progress: 0 });
          scheduleRemoveUploadJob(clientId, 5000);
          resolve();
        };
        xhr.send(fd);
      });
    },
    [projectId, selectedLocationIds, toast, patchUploadJob, scheduleRemoveUploadJob],
  );

  /** طابور رفع متسلسل على الخادم؛ تقدم كل ملف عبر XHR كما في Google Drive. */
  const uploadFiles = useCallback(
    (list: File[]) => {
      if (list.length === 0) return;
      const jobs: UploadJob[] = list.map((file) => ({
        clientId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        name: file.name,
        state: "queued",
        progress: 0,
      }));
      setUploadJobs((prev) => [...prev, ...jobs]);
      list.forEach((file, i) => {
        const job = jobs[i];
        uploadQueueRef.current = uploadQueueRef.current.then(() => uploadOne(file, job.clientId));
      });
    },
    [uploadOne],
  );

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    recorderRef.current = null;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    } else {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setRecording(false);
    }
  }, []);

  const startRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime =
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        const streamLive = streamRef.current;
        streamRef.current = null;
        streamLive?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const name = `تسجيل-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.webm`;
        const file = new File([blob], name, { type: blob.type || "audio/webm" });
        chunksRef.current = [];
        setRecording(false);
        void uploadFiles([file]);
      };
      rec.start(200);
      setRecording(true);
    } catch {
      toast({ variant: "destructive", title: "الميكروفون", description: "تحقق من أذونات المتصفح." });
    }
  };

  useEffect(() => {
    return () => {
      const rec = recorderRef.current;
      recorderRef.current = null;
      if (rec && rec.state !== "inactive") rec.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/mv/projects/${projectId}/inspectorFiles/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const raw = await res.json().catch(() => null);
      if (!res.ok) {
        toast({ variant: "destructive", title: "حذف" });
        return;
      }
      const body = raw as { inspectorFiles?: MvInspectorFile[] };
      if (Array.isArray(body.inspectorFiles)) setFiles(body.inspectorFiles);
      else void load({ showLoading: false });
      setSelectedIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } finally {
      setDeletingId(null);
    }
  };

  const removeMany = async (ids: string[]) => {
    if (ids.length === 0) return;
    setBulkDeleting(true);
    let failed = 0;
    try {
      for (const id of ids) {
        const res = await fetch(`/api/mv/projects/${projectId}/inspectorFiles/${encodeURIComponent(id)}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) failed += 1;
      }
      if (failed > 0) {
        toast({
          variant: "destructive",
          title: "حذف جماعي",
          description: `تعذر حذف ${failed} من ${ids.length} ملفًا.`,
        });
      }
      setSelectedIds(new Set());
      await load({ showLoading: false });
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const allSelected = files.length > 0 && selectedIds.size === files.length;
  const someSelected = selectedIds.size > 0;

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = "";
    void uploadFiles(list);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void uploadFiles(e.dataTransfer.files ? Array.from(e.dataTransfer.files) : []);
  };

  if (loading) {
    if (embedded) {
      return (
        <div className={cn(font.className, "space-y-4 p-4")} dir="rtl">
          <div className="h-12 animate-pulse rounded-xl bg-slate-200/70" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-slate-200/50" />
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className={cn(font.className, "min-h-screen bg-slate-950/[0.03]")} dir="rtl">
        <MvTopBar breadcrumbs={[{ label: "…" }]} saveState="idle" />
        <div className="mx-auto max-w-6xl px-4 py-10">
          <div className="h-16 animate-pulse rounded-2xl bg-slate-200/60" />
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-slate-200/50" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    if (embedded) {
      return (
        <div className={cn(font.className, "p-8 text-center")} dir="rtl">
          <p className="font-semibold text-slate-800">تعذر تحميل المشروع.</p>
        </div>
      );
    }
    return (
      <div className={cn(font.className, "min-h-screen")} dir="rtl">
        <MvTopBar breadcrumbs={[{ label: "ملفات المعاين" }]} saveState="error" />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="font-semibold text-slate-800">تعذر تحميل المشروع.</p>
          <Button className="mt-4" variant="outline" asChild>
            <a href={MV_PROJECTS_TABLE_PATH}>المشاريع</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        font.className,
        "relative flex scroll-smooth flex-col bg-[#f4f6f9] antialiased",
        embedded ? "h-[min(78vh,760px)] min-h-0" : "min-h-screen",
        className,
      )}
      dir="rtl"
    >
      {!embedded ? (
        <MvTopBar
          breadcrumbs={[
            { label: "المشاريع", href: MV_PROJECTS_TABLE_PATH },
            { label: project.name, href: `/machine-valuation/${projectId}/workflow/report-data` },
            { label: "ملفات المعاين" },
          ]}
          saveState="idle"
        />
      ) : null}

      <div
        className={cn(
          "z-20 border-b border-slate-200/90 bg-white/95 px-3 py-2 shadow-sm backdrop-blur transition-shadow duration-200 sm:px-4",
          embedded ? "shrink-0" : "sticky top-0",
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
          <input ref={inputRef} type="file" className="hidden" accept={ACCEPT} multiple onChange={onInputChange} />
          <MvLocationMultiSelect
            locations={project.locations ?? []}
            value={selectedLocationIds}
            onChange={setSelectedLocationIds}
            disabled={locationSelectionLocked}
            className="min-w-[210px]"
            label={locationSelectionLocked ? "موقع الرفع" : "إرسال الملفات إلى"}
          />
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="ms-1 h-3.5 w-3.5" />
            رفع
          </Button>
          <div
            role="presentation"
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              "flex min-h-[36px] min-w-[120px] flex-1 items-center justify-center rounded-lg border border-dashed px-2 py-1.5 text-[11px] font-medium text-slate-500 transition-[background-color,border-color,color,box-shadow] duration-200 ease-out sm:min-w-[200px]",
              dragOver
                ? "border-sky-500 bg-sky-50 text-sky-800 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.35)]"
                : "border-slate-200 bg-slate-50/80",
            )}
          >
            إفلات هنا
          </div>
          <Button
            type="button"
            size="sm"
            variant={recording ? "secondary" : "outline"}
            className={cn("h-9 rounded-lg px-3 text-xs font-bold", recording && "border-rose-300 text-rose-800")}
            onClick={() => (recording ? stopRecording() : void startRecording())}
          >
            {recording ? <MicOff className="ms-1 h-3.5 w-3.5" /> : <Mic className="ms-1 h-3.5 w-3.5" />}
            {recording ? "إيقاف" : "تسجيل"}
          </Button>

          {files.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-s border-slate-200 ps-2">
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => {
                    const on = v === true;
                    setSelectedIds(on ? new Set(files.map((f) => f.id)) : new Set());
                  }}
                  aria-label="تحديد الكل"
                />
                تحديد الكل
              </label>
              {someSelected ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-[11px] font-bold"
                    disabled={bulkDeleting}
                    onClick={() => setSelectedIds(new Set())}
                  >
                    إلغاء التحديد
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    className="h-8 px-2 text-[11px] font-bold"
                    disabled={bulkDeleting}
                    onClick={() => void removeMany([...selectedIds])}
                  >
                    {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `حذف المحدد (${selectedIds.size})`}
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-[11px] font-bold text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                disabled={bulkDeleting}
                onClick={() => setDeleteAllOpen(true)}
              >
                حذف الكل
              </Button>
            </div>
          ) : null}

          <span className="ms-auto flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
            {uploadJobs.some((j) => j.state === "uploading" || j.state === "queued") ? (
              <span className="inline-flex items-center gap-1 text-sky-700">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                {uploadJobs.filter((j) => j.state === "uploading" || j.state === "queued").length}
              </span>
            ) : null}
            <span>{files.length}</span>
          </span>
        </div>
      </div>

      <div
        className={cn(
          "mx-auto w-full max-w-6xl flex-1 px-3 py-4 sm:px-4 motion-reduce:scroll-auto",
          embedded ? "min-h-0 overflow-y-auto" : "",
        )}
      >
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 py-24 text-slate-400">
            <Upload className="h-10 w-10 opacity-40" />
            <p className="mt-3 text-sm font-semibold">لا ملفات</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {files.map((f) => (
              <div
                key={f.id}
                className="group relative flex aspect-square flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-0 transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex h-9 shrink-0 items-center justify-between gap-1 border-b border-slate-100 bg-white px-2">
                  <Checkbox
                    checked={selectedIds.has(f.id)}
                    onCheckedChange={(v) => toggleSelect(f.id, v === true)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`تحديد ${f.name}`}
                  />
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 rounded-md"
                      title="تنزيل"
                      asChild
                    >
                      <a
                        href={inspectorFileDownloadHref(projectId, f, "attachment")}
                        download={f.name}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7 rounded-md"
                      title="حذف"
                      disabled={deletingId === f.id || bulkDeleting}
                      onClick={(e) => {
                        e.stopPropagation();
                        void remove(f.id);
                      }}
                    >
                      {deletingId === f.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="relative min-h-0 flex-1 bg-slate-100">
                  {f.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={inspectorFileMediaSrc(projectId, f)}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : f.type === "video" ? (
                    <div className="flex h-full w-full min-h-0 items-center justify-center p-1">
                      <video
                        src={inspectorFileMediaSrc(projectId, f)}
                        className="max-h-full max-w-full rounded object-contain"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    </div>
                  ) : f.type === "audio" ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2">
                      <AudioLines className="h-8 w-8 text-sky-600" />
                      <audio src={inspectorFileMediaSrc(projectId, f)} controls className="w-full max-w-[90%] text-[10px]" />
                    </div>
                  ) : f.type === "pdf" ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                      <FileText className="h-10 w-10 text-red-600/90" />
                    </div>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1">
                      <TypeIcon type={f.type} className="h-10 w-10 text-slate-500" />
                    </div>
                  )}
                </div>

                <div className="shrink-0 border-t border-slate-100 bg-white px-2 py-1.5 text-right">
                  <p className="truncate text-[11px] font-bold text-slate-800" title={f.name}>
                    {f.name}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
                    {(() => {
                      const ids = inspectorFileLocationIds(f);
                      if (ids.length === 0) return "كل مواقع المعاينة";
                      return ids
                        .map((id) => {
                          const index = (project.locations ?? []).findIndex(
                            (location, locationIndex) => mvLocationId(location, locationIndex) === id,
                          );
                          return index >= 0 ? mvLocationLabel((project.locations ?? [])[index]!, index) : "";
                        })
                        .filter(Boolean)
                        .join("، ");
                    })()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {uploadJobs.length > 0 ? (
        <div
          className={cn(
            "pointer-events-auto z-[60] flex gap-2 overflow-x-auto overflow-y-visible px-3 pt-1 sm:px-4",
            embedded
              ? "absolute bottom-3 start-3 max-w-[calc(100%-1.5rem)] pb-0"
              : "fixed bottom-0 start-0 max-w-[100vw] pb-[max(0.75rem,env(safe-area-inset-bottom))]",
          )}
          dir="rtl"
        >
          {uploadJobs.map((job) => (
            <div
              key={job.clientId}
              className="flex min-w-[min(220px,85vw)] max-w-[min(280px,88vw)] shrink-0 items-center gap-2.5 rounded-xl border border-slate-200/95 bg-white py-2.5 ps-2.5 pe-3 shadow-[0_4px_24px_rgba(0,0,0,0.12)]"
            >
              <MvCircularUploadRing
                progress={job.progress}
                indeterminate={job.state === "queued"}
                state={job.state}
              />
              <div className="min-w-0 flex-1 text-right">
                <p className="truncate text-[12px] font-semibold text-slate-800" title={job.name}>
                  {job.name}
                </p>
                <p className="text-[10px] font-medium text-slate-500">
                  {job.state === "queued"
                    ? "في الانتظار…"
                    : job.state === "uploading"
                      ? `${job.progress}%`
                      : job.state === "done"
                        ? "تم الرفع"
                        : "فشل الرفع"}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <AlertDialogContent dir="rtl" className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف كل ملفات المعاين؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف {files.length} ملفًا من المشروع والتخزين. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel type="button">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                setDeleteAllOpen(false);
                void removeMany(files.map((x) => x.id));
              }}
            >
              حذف الكل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
