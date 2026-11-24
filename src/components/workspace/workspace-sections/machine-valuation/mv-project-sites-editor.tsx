"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import {
  AlertCircle,
  AudioLines,
  Check,
  CloudUpload,
  Download,
  FileSpreadsheet,
  FileText,
  FileType2,
  Image as ImageIcon,
  Loader2,
  Mic,
  Paperclip,
  RotateCcw,
  Square,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useProductPermissions } from "@/hooks/use-product-permissions";
import { cn } from "@/lib/utils";
import type { MvInspectorFile, MvInspectorLogicalFileType, MvProject } from "./types";
import {
  projectContactDataFromInspectionSites,
  projectInspectionSitesFromData,
  type MvProjectInspectionSiteForm,
} from "./mv-project-contact-data";
import { MvInspectionLocationsFields } from "./mv-inspection-locations-fields";
import { mvLocationId } from "./mv-location-multi-select";
import {
  formatMvFileSize,
  inspectorFilesForSite,
  upsertInspectorFile,
  useMvSiteFileUploads,
  type MvSiteUploadJob,
} from "./mv-site-file-uploads";
import { invalidateMvApiCache } from "./mv-api-client";
import { useMvI18n } from "./mv-i18n";

export type MvSitesSaveStatus = "saved" | "pending" | "saving" | "error";

export type MvProjectSitesEditorState = {
  status: MvSitesSaveStatus;
  pendingUploads: number;
  failedUploads: number;
};

export type MvProjectSitesEditorHandle = {
  /** Saves what is not saved yet; resolves `true` when everything is on the server. */
  flush: () => Promise<boolean>;
  pendingUploads: () => number;
  retrySave: () => void;
};

const AUTOSAVE_DELAY_MS = 700;

type SavedSites = {
  locations: MvProject["locations"];
  contacts: MvProject["contacts"];
  inspectionAssignments?: MvProject["inspectionAssignments"];
  inspectorFiles?: MvInspectorFile[];
  updatedAt?: string;
};

/** Server list wins for files it knows; files uploaded meanwhile are kept. */
function mergeServerFiles(local: readonly MvInspectorFile[], server: readonly MvInspectorFile[] | undefined) {
  if (!Array.isArray(server)) return local.slice();
  const known = new Set(server.map((file) => file.id));
  return [...server, ...local.filter((file) => !known.has(file.id))];
}

function inspectorFileHref(projectId: string, file: MvInspectorFile, attachment: boolean) {
  const base = `/api/mv/projects/${projectId}/inspectorFiles/${encodeURIComponent(file.id)}/download`;
  return attachment ? `${base}?attachment=1` : base;
}

function FileTypeIcon({ type, className }: { type: MvInspectorLogicalFileType; className?: string }) {
  const cls = cn("h-6 w-6", className);
  switch (type) {
    case "pdf":
      return <FileText className={cn(cls, "text-red-600")} />;
    case "excel":
      return <FileSpreadsheet className={cn(cls, "text-emerald-700")} />;
    case "word":
      return <FileType2 className={cn(cls, "text-sky-700")} />;
    case "image":
      return <ImageIcon className={cn(cls, "text-slate-500")} />;
    case "video":
      return <Video className={cn(cls, "text-violet-600")} />;
    case "audio":
      return <AudioLines className={cn(cls, "text-sky-600")} />;
    default:
      return <FileText className={cn(cls, "text-slate-500")} />;
  }
}

function useAudioRecorder(onRecorded: (file: File) => void, prefix: string, onDenied: () => void) {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setRecording(false);
    }
  }, []);

  const start = useCallback(async () => {
    if (recorderRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = ["audio/webm;codecs=opus", "audio/webm"].find(
        (type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type),
      );
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0) return;
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        onRecordedRef.current(new File([blob], `${prefix}-${stamp}.webm`, { type: blob.type || "audio/webm" }));
      };
      recorder.start(200);
      setRecording(true);
    } catch {
      onDenied();
    }
  }, [onDenied, prefix]);

  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  return { recording, start, stop };
}

function UploadJobTile({
  job,
  onRetry,
  onDismiss,
}: {
  job: MvSiteUploadJob;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const { t } = useMvI18n();
  const failed = job.state === "error";
  return (
    <li
      className={cn(
        "flex flex-col justify-between gap-1.5 rounded-xl border bg-white p-2 text-start",
        failed ? "border-rose-200 bg-rose-50/60" : "border-sky-100",
      )}
      title={job.error || job.name}
    >
      <div className="flex items-start gap-1.5">
        {failed ? (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
        ) : job.state === "done" ? (
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
        ) : (
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-sky-600" aria-hidden />
        )}
        <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-800" dir="auto">
          {job.name}
        </p>
      </div>
      {failed ? (
        <>
          <p className="line-clamp-2 text-[10px] font-semibold leading-snug text-rose-700">
            {job.error || t("inspector.sites.uploadFailed")}
          </p>
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="outline" className="h-7 flex-1 gap-1 rounded-lg px-2 text-[10.5px] font-bold" onClick={onRetry}>
              <RotateCcw className="h-3 w-3" aria-hidden />
              {t("inspector.sites.retry")}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-lg text-slate-500"
              onClick={onDismiss}
              aria-label={t("inspector.sites.dismiss")}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-200",
                job.state === "done" ? "bg-emerald-500" : "bg-sky-500",
                job.state === "queued" && "w-0",
              )}
              style={job.state === "queued" ? undefined : { width: `${Math.max(4, job.progress)}%` }}
            />
          </div>
          <p className="text-[10px] font-semibold text-slate-500">
            {job.state === "queued"
              ? t("inspector.sites.queued")
              : job.state === "done"
                ? t("inspector.sites.uploaded")
                : `${job.progress}% · ${formatMvFileSize(job.size)}`}
          </p>
        </>
      )}
    </li>
  );
}

function FileTile({
  projectId,
  file,
  canDownload,
  canDelete,
  deleting,
  onDelete,
}: {
  projectId: string;
  file: MvInspectorFile;
  canDownload: boolean;
  canDelete: boolean;
  deleting: boolean;
  onDelete: () => void;
}) {
  const { t } = useMvI18n();
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 3500);
    return () => window.clearTimeout(timer);
  }, [confirming]);

  return (
    <li className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <a
        href={canDownload ? inspectorFileHref(projectId, file, false) : undefined}
        target="_blank"
        rel="noreferrer"
        className="flex aspect-[4/3] items-center justify-center bg-slate-100"
        title={file.name}
      >
        {file.type === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={inspectorFileHref(projectId, file, false)}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <FileTypeIcon type={file.type} className="h-8 w-8" />
        )}
      </a>
      <div className="px-2 py-1.5">
        <p className="truncate text-[11px] font-bold text-slate-800" dir="auto" title={file.name}>
          {file.name}
        </p>
        <p className="text-[10px] font-semibold text-slate-400">{formatMvFileSize(file.sizeBytes)}</p>
      </div>
      {canDownload || canDelete ? (
        <div
          className={cn(
            "absolute end-1 top-1 flex gap-1 transition-opacity",
            confirming || deleting ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
          )}
        >
          {canDownload && !confirming ? (
            <a
              href={inspectorFileHref(projectId, file, true)}
              download={file.name}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 text-slate-700 shadow-sm ring-1 ring-slate-200 hover:text-slate-950"
              title={t("inspector.files.download")}
              aria-label={t("inspector.files.download")}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
            </a>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }
                setConfirming(false);
                onDelete();
              }}
              className={cn(
                "flex h-7 items-center justify-center gap-1 rounded-lg shadow-sm ring-1 transition",
                confirming
                  ? "bg-rose-600 px-2 text-[10.5px] font-bold text-white ring-rose-600"
                  : "w-7 bg-white/95 text-rose-600 ring-slate-200 hover:bg-rose-50",
              )}
              title={t("inspector.files.deleteTitle")}
              aria-label={confirming ? t("inspector.sites.confirmDelete") : t("inspector.files.deleteTitle")}
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              )}
              {confirming ? t("inspector.sites.confirmDelete") : null}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function SiteFilesSection({
  projectId,
  siteId,
  title,
  hint,
  files,
  jobs,
  canUpload,
  canDownload,
  canDelete,
  deletingId,
  disabled,
  onUpload,
  onRetry,
  onDismiss,
  onDelete,
}: {
  projectId: string;
  siteId: string | null;
  title: string;
  hint?: string;
  files: MvInspectorFile[];
  jobs: MvSiteUploadJob[];
  canUpload: boolean;
  canDownload: boolean;
  canDelete: boolean;
  deletingId: string | null;
  disabled?: boolean;
  onUpload: (files: File[], siteId: string | null) => void;
  onRetry: (clientId: string) => void;
  onDismiss: (clientId: string) => void;
  onDelete: (file: MvInspectorFile) => void;
}) {
  const { t } = useMvI18n();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const onDenied = useCallback(
    () => toast({ variant: "destructive", title: t("inspector.files.micTitle"), description: t("inspector.files.micPermission") }),
    [t, toast],
  );
  const recorder = useAudioRecorder(
    (file) => onUpload([file], siteId),
    t("inspector.files.recordingPrefix"),
    onDenied,
  );
  const uploading = jobs.filter((job) => job.state === "queued" || job.state === "uploading").length;
  const empty = files.length === 0 && jobs.length === 0;
  const acceptDrop = canUpload && !disabled;

  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    onUpload(list, siteId);
  };
  const dragHandlers = acceptDrop
    ? {
        onDragEnter: (event: DragEvent) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setDragOver(true);
        },
        onDragOver: (event: DragEvent) => {
          if (!event.dataTransfer.types.includes("Files")) return;
          event.preventDefault();
          setDragOver(true);
        },
        onDragLeave: (event: DragEvent) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          setDragOver(false);
        },
        onDrop: (event: DragEvent) => {
          event.preventDefault();
          setDragOver(false);
          onUpload(event.dataTransfer.files ? Array.from(event.dataTransfer.files) : [], siteId);
        },
      }
    : {};

  return (
    <div
      {...dragHandlers}
      className={cn(
        "relative border-t border-slate-200/80 bg-slate-50/70 px-3 py-2.5 transition-colors",
        dragOver && "bg-sky-50 ring-2 ring-inset ring-sky-400",
      )}
    >
      {canUpload ? (
        <input ref={inputRef} type="file" multiple className="hidden" onChange={onInput} disabled={disabled} />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Paperclip className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <p className="text-[12px] font-black text-slate-800">{title}</p>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10.5px] font-bold text-slate-600 ring-1 ring-slate-200">
          {files.length}
        </span>
        {uploading > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10.5px] font-bold text-sky-800">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t("inspector.sites.uploadingCount", { count: uploading })}
          </span>
        ) : null}
        {canUpload ? (
          <div className="ms-auto flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "h-8 gap-1.5 rounded-lg px-2.5 text-[11px] font-bold",
                recorder.recording && "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100",
              )}
              disabled={disabled}
              onClick={() => (recorder.recording ? recorder.stop() : void recorder.start())}
            >
              {recorder.recording ? (
                <Square className="h-3 w-3 fill-current" aria-hidden />
              ) : (
                <Mic className="h-3.5 w-3.5" aria-hidden />
              )}
              {recorder.recording ? t("inspector.sites.stopRecording") : t("inspector.sites.record")}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5 rounded-lg bg-slate-900 px-3 text-[11px] font-bold text-white hover:bg-slate-800"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <CloudUpload className="h-3.5 w-3.5" aria-hidden />
              {t("inspector.sites.pick")}
            </Button>
          </div>
        ) : null}
      </div>
      {hint ? <p className="mt-1 text-[11px] font-medium text-slate-500">{hint}</p> : null}

      {empty ? (
        canUpload ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/70 px-3 py-4 text-[11.5px] font-semibold text-slate-500 transition hover:border-sky-300 hover:bg-sky-50/60 hover:text-sky-800 disabled:pointer-events-none disabled:opacity-50"
          >
            <CloudUpload className="h-4 w-4" aria-hidden />
            {t("inspector.sites.dropOrPick")}
          </button>
        ) : (
          <p className="mt-2 text-[11px] font-medium text-slate-400">{t("inspector.files.noFiles")}</p>
        )
      ) : (
        <ul className="mt-2 grid max-h-[19rem] grid-cols-2 gap-2 overflow-y-auto pe-0.5 sm:grid-cols-4 lg:grid-cols-5">
          {jobs.map((job) => (
            <UploadJobTile
              key={job.clientId}
              job={job}
              onRetry={() => onRetry(job.clientId)}
              onDismiss={() => onDismiss(job.clientId)}
            />
          ))}
          {files.map((file) => (
            <FileTile
              key={file.id}
              projectId={projectId}
              file={file}
              canDownload={canDownload}
              canDelete={canDelete}
              deleting={deletingId === file.id}
              onDelete={() => onDelete(file)}
            />
          ))}
        </ul>
      )}
      {dragOver ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-sky-50/80 text-[12px] font-black text-sky-800">
          {t("inspector.sites.dropNow")}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Inspection sites of a project and the files of each site, on one screen:
 * edits are saved automatically, files are attached directly inside each
 * site card (the site is saved first on its own), nothing to "save first".
 */
export const MvProjectSitesEditor = forwardRef<
  MvProjectSitesEditorHandle,
  {
    project: MvProject;
    pickerPopoverHost: HTMLElement | null;
    onProjectChange: (patch: Partial<MvProject>) => void;
    onStateChange?: (state: MvProjectSitesEditorState) => void;
  }
>(function MvProjectSitesEditor({ project, pickerPopoverHost, onProjectChange, onStateChange }, ref) {
  const { t } = useMvI18n();
  const { toast } = useToast();
  const { can } = useProductPermissions("machine-valuation");
  const canUpload = can("asset_media.upload");
  const canDelete = can("asset_media.delete");
  const canDownload = can("asset_media.download");
  const projectId = project._id;

  const [sites, setSites] = useState<MvProjectInspectionSiteForm[]>(() =>
    projectInspectionSitesFromData(project.locations, project.contacts, t),
  );
  const [files, setFiles] = useState<MvInspectorFile[]>(() => project.inspectorFiles ?? []);
  const [uploadTargets, setUploadTargets] = useState<ReadonlySet<string>>(() => new Set());
  const [status, setStatus] = useState<MvSitesSaveStatus>("saved");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const keepSiteIds = useMemo(() => {
    const keep = new Set(uploadTargets);
    for (const file of files) for (const id of file.locationIds ?? []) keep.add(id);
    return keep;
  }, [files, uploadTargets]);

  const payloadKey = useCallback(
    (forms: MvProjectInspectionSiteForm[], keep: ReadonlySet<string>) =>
      JSON.stringify(projectContactDataFromInspectionSites(forms, t, { keepSiteIds: keep })),
    [t],
  );
  const currentKey = useMemo(() => payloadKey(sites, keepSiteIds), [keepSiteIds, payloadKey, sites]);

  const savedKeyRef = useRef(currentKey);
  const savedSiteIdsRef = useRef(new Set((project.locations ?? []).map((location, index) => mvLocationId(location, index))));
  const live = useRef({ sites, keepSiteIds, files });
  live.current = { sites, keepSiteIds, files };
  const chainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const timerRef = useRef<number | null>(null);
  const onProjectChangeRef = useRef(onProjectChange);
  onProjectChangeRef.current = onProjectChange;

  const doSave = useCallback(async (): Promise<boolean> => {
    const sentKey = payloadKey(live.current.sites, live.current.keepSiteIds);
    if (sentKey === savedKeyRef.current) {
      setStatus("saved");
      return true;
    }
    setStatus("saving");
    try {
      const response = await fetch(`/api/mv/projects/${projectId}/locations`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: sentKey,
      });
      const raw = (await response.json().catch(() => null)) as (SavedSites & { ok?: boolean }) | null;
      if (!response.ok || !raw?.ok) throw new Error("save_failed");
      savedKeyRef.current = sentKey;
      savedSiteIdsRef.current = new Set((raw.locations ?? []).map((location, index) => mvLocationId(location, index)));
      const mergedFiles = mergeServerFiles(live.current.files, raw.inspectorFiles);
      setFiles(mergedFiles);
      invalidateMvApiCache(`project-summary:${projectId}`);
      onProjectChangeRef.current({
        locations: raw.locations,
        contacts: raw.contacts,
        ...(raw.inspectionAssignments ? { inspectionAssignments: raw.inspectionAssignments } : {}),
        inspectorFiles: mergedFiles,
        ...(raw.updatedAt ? { updatedAt: raw.updatedAt } : {}),
      });
      setStatus(payloadKey(live.current.sites, live.current.keepSiteIds) === sentKey ? "saved" : "pending");
      return true;
    } catch {
      setStatus("error");
      return false;
    }
  }, [payloadKey, projectId]);

  /** Saves run one after another: never two requests racing each other. */
  const save = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    chainRef.current = chainRef.current.then(doSave, doSave);
    return chainRef.current;
  }, [doSave]);

  useEffect(() => {
    if (currentKey === savedKeyRef.current) return;
    setStatus((previous) => (previous === "saving" ? previous : "pending"));
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void save();
    }, AUTOSAVE_DELAY_MS);
  }, [currentKey, save]);

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  /** The upload target exists on the server before the file is sent. */
  const ensureSiteSaved = useCallback(
    async (siteId: string | null) => {
      if (siteId == null) return true;
      if (!live.current.sites.some((site) => site.id === siteId)) return false;
      if (!live.current.keepSiteIds.has(siteId)) {
        live.current = { ...live.current, keepSiteIds: new Set([...live.current.keepSiteIds, siteId]) };
        setUploadTargets((previous) => new Set([...previous, siteId]));
      }
      const ok = await save();
      return ok && savedSiteIdsRef.current.has(siteId);
    },
    [save],
  );

  const onUploaded = useCallback((file: MvInspectorFile) => {
    setFiles((previous) => upsertInspectorFile(previous, file));
  }, []);

  const uploads = useMvSiteFileUploads({
    projectId,
    beforeUpload: ensureSiteSaved,
    onUploaded,
    messages: {
      failed: t("inspector.sites.uploadFailed"),
      network: t("inspector.files.uploadNetworkError"),
      siteNotSaved: t("inspector.sites.siteNotSaved"),
    },
  });
  const pendingUploadsRef = useRef(0);
  pendingUploadsRef.current = uploads.pendingCount;

  // Keep the project list / inspectors tab in step with the files.
  const firstFilesRef = useRef(true);
  useEffect(() => {
    if (firstFilesRef.current) {
      firstFilesRef.current = false;
      return;
    }
    onProjectChangeRef.current({ inspectorFiles: files });
  }, [files]);

  useEffect(() => {
    onStateChange?.({ status, pendingUploads: uploads.pendingCount, failedUploads: uploads.failedCount });
  }, [onStateChange, status, uploads.failedCount, uploads.pendingCount]);

  useImperativeHandle(
    ref,
    () => ({
      flush: async () => {
        await save();
        return payloadKey(live.current.sites, live.current.keepSiteIds) === savedKeyRef.current;
      },
      pendingUploads: () => pendingUploadsRef.current,
      retrySave: () => void save(),
    }),
    [payloadKey, save],
  );

  const deleteFile = useCallback(
    async (file: MvInspectorFile) => {
      setDeletingId(file.id);
      try {
        const response = await fetch(`/api/mv/projects/${projectId}/inspectorFiles/${encodeURIComponent(file.id)}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!response.ok && response.status !== 404) throw new Error("delete_failed");
        setFiles((previous) => previous.filter((item) => item.id !== file.id));
      } catch {
        toast({ variant: "destructive", title: file.name, description: t("inspector.sites.deleteFailed") });
      } finally {
        setDeletingId(null);
      }
    },
    [projectId, t, toast],
  );

  const handleUpload = useCallback(
    (list: File[], siteId: string | null) => {
      if (!canUpload || list.length === 0) return;
      uploads.upload(list, siteId);
    },
    [canUpload, uploads],
  );

  const siteIds = useMemo(() => new Set(sites.map((site) => site.id)), [sites]);
  const generalFiles = useMemo(
    () => files.filter((file) => !(file.locationIds ?? []).some((id) => siteIds.has(id))),
    [files, siteIds],
  );
  const generalJobs = uploads.jobs.filter((job) => job.siteId == null);

  return (
    <div className="space-y-3">
      <p className="rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-2 text-[11.5px] font-semibold leading-relaxed text-sky-900">
        {t("inspector.sites.autosaveHint")}
      </p>
      <MvInspectionLocationsFields
        value={sites}
        onChange={setSites}
        pickerPopoverHost={pickerPopoverHost}
        siteFileCount={(siteId) => inspectorFilesForSite(files, siteId).length}
        isSiteBusy={(siteId) =>
          uploads.jobs.some((job) => job.siteId === siteId && (job.state === "queued" || job.state === "uploading"))
        }
        renderSiteFooter={(site) => (
          <SiteFilesSection
            projectId={projectId}
            siteId={site.id}
            title={t("inspector.sites.siteFiles")}
            files={inspectorFilesForSite(files, site.id)}
            jobs={uploads.jobs.filter((job) => job.siteId === site.id)}
            canUpload={canUpload}
            canDownload={canDownload}
            canDelete={canDelete}
            deletingId={deletingId}
            onUpload={handleUpload}
            onRetry={uploads.retry}
            onDismiss={uploads.dismiss}
            onDelete={(file) => void deleteFile(file)}
          />
        )}
      />
      {generalFiles.length > 0 || generalJobs.length > 0 ? (
        <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
          <SiteFilesSection
            projectId={projectId}
            siteId={null}
            title={t("inspector.sites.generalFiles")}
            hint={t("inspector.sites.generalFilesHint")}
            files={generalFiles}
            jobs={generalJobs}
            canUpload={canUpload}
            canDownload={canDownload}
            canDelete={canDelete}
            deletingId={deletingId}
            onUpload={handleUpload}
            onRetry={uploads.retry}
            onDismiss={uploads.dismiss}
            onDelete={(file) => void deleteFile(file)}
          />
        </section>
      ) : null}
    </div>
  );
});
