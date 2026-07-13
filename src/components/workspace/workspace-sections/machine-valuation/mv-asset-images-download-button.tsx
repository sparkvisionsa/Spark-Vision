"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Folder, ImageIcon, Loader2, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type DownloadPhase =
  | "preparing"
  | "folders"
  | "images"
  | "finalizing"
  | "completed"
  | "failed";

type AssetImagesDownloadProgress = {
  id: string;
  phase: DownloadPhase;
  folderTotal: number;
  foldersCompleted: number;
  imageTotal: number;
  imagesCompleted: number;
  bytesTotal: number;
  bytesProcessed: number;
  percent: number;
  currentFileName: string | null;
  error: string | null;
};

const phaseLabels: Record<DownloadPhase, string> = {
  preparing: "جارٍ تجهيز قائمة الملفات…",
  folders: "جارٍ إنشاء المجلدات…",
  images: "جارٍ إضافة الصور إلى الأرشيف…",
  finalizing: "جارٍ إنهاء ملف ZIP…",
  completed: "اكتمل تجهيز وتنزيل الأرشيف",
  failed: "تعذر إكمال تنزيل الأرشيف",
};

function initialProgress(id: string): AssetImagesDownloadProgress {
  return {
    id,
    phase: "preparing",
    folderTotal: 0,
    foldersCompleted: 0,
    imageTotal: 0,
    imagesCompleted: 0,
    bytesTotal: 0,
    bytesProcessed: 0,
    percent: 1,
    currentFileName: null,
    error: null,
  };
}

function makeDownloadId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `download-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function MvAssetImagesDownloadButton({
  projectId,
  className,
  children,
  title,
  disabled = false,
  buttonRef,
}: {
  projectId: string;
  className?: string;
  children: ReactNode;
  title?: string;
  disabled?: boolean;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const [progressVisible, setProgressVisible] = useState(false);
  const [progress, setProgress] = useState<AssetImagesDownloadProgress | null>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) clearTimeout(pollingRef.current);
    pollingRef.current = null;
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    if (progress?.phase !== "completed") return;
    const timeout = setTimeout(() => setProgressVisible(false), 5000);
    return () => clearTimeout(timeout);
  }, [progress?.phase]);

  const pollProgress = useCallback((downloadId: string, notFoundAttempts = 0) => {
    stopPolling();
    const run = async () => {
      if (activeIdRef.current !== downloadId) return;
      try {
        const response = await fetch(
          `/api/mv/projects/${encodeURIComponent(projectId)}/asset-image-files/download-progress/${encodeURIComponent(downloadId)}`,
          { cache: "no-store" },
        );
        if (response.status === 404 && notFoundAttempts < 30) {
          pollingRef.current = setTimeout(() => pollProgress(downloadId, notFoundAttempts + 1), 1000);
          return;
        }
        if (!response.ok) throw new Error(`تعذر قراءة حالة التنزيل (${response.status})`);
        const next = await response.json() as AssetImagesDownloadProgress;
        setProgress(next);
        if (next.phase === "completed" || next.phase === "failed") {
          activeIdRef.current = null;
          return;
        }
        pollingRef.current = setTimeout(() => pollProgress(downloadId), 1000);
      } catch (error) {
        if (activeIdRef.current !== downloadId) return;
        setProgress((current) => ({
          ...(current ?? initialProgress(downloadId)),
          phase: "failed",
          error: error instanceof Error ? error.message : "تعذر متابعة حالة التنزيل.",
        }));
        activeIdRef.current = null;
      }
    };
    void run();
  }, [projectId, stopPolling]);

  const startDownload = useCallback(() => {
    if (disabled || activeIdRef.current) {
      if (activeIdRef.current) setProgressVisible(true);
      return;
    }
    const downloadId = makeDownloadId();
    activeIdRef.current = downloadId;
    setProgress(initialProgress(downloadId));
    setProgressVisible(true);

    const anchor = document.createElement("a");
    anchor.href = `/api/mv/projects/${encodeURIComponent(projectId)}/asset-image-files/download?downloadId=${encodeURIComponent(downloadId)}`;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    pollingRef.current = setTimeout(() => pollProgress(downloadId), 500);
  }, [disabled, pollProgress, projectId]);

  const phase = progress?.phase ?? "preparing";
  const isDone = phase === "completed";
  const isFailed = phase === "failed";
  const percent = Math.max(0, Math.min(100, Math.round(progress?.percent ?? 0)));

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={startDownload}
        disabled={disabled}
        title={title}
        aria-label={title}
        className={className}
      >
        {children}
      </button>

      {progressVisible && progress && typeof document !== "undefined" ? createPortal(
        <div
          dir="rtl"
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-[100] w-[min(22rem,calc(100vw-2rem))] animate-in fade-in slide-in-from-bottom-2 rounded-xl border border-slate-200 bg-white p-3.5 text-right shadow-2xl"
        >
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              isDone ? "bg-emerald-100 text-emerald-700" : isFailed ? "bg-red-100 text-red-700" : "bg-sky-100 text-sky-700",
            )}>
              {isDone ? <CheckCircle2 className="h-4 w-4" /> : isFailed ? <AlertCircle className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-slate-900">تنزيل صور الأصول</p>
              <p className={cn("mt-0.5 truncate text-[11px] font-medium", isFailed ? "text-red-600" : "text-slate-500")}>
                {isFailed ? (progress.error || phaseLabels.failed) : phaseLabels[phase]}
              </p>
            </div>
            <span className="text-sm font-black tabular-nums text-slate-800">{percent}%</span>
            <button
              type="button"
              onClick={() => setProgressVisible(false)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="إخفاء حالة التنزيل"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <Progress dir="ltr" value={percent} className="mt-3 h-1.5 bg-slate-100 [&>div]:bg-emerald-600" />

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2 text-xs">
              <span className="flex items-center gap-1.5 font-bold text-slate-500">
                <Folder className="h-3.5 w-3.5 text-sky-600" /> المجلدات
              </span>
              <span className="font-black tabular-nums text-slate-900">
                {progress.foldersCompleted} / {progress.folderTotal}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-2 text-xs">
              <span className="flex items-center gap-1.5 font-bold text-slate-500">
                <ImageIcon className="h-3.5 w-3.5 text-emerald-600" /> الصور
              </span>
              <span className="font-black tabular-nums text-slate-900">
                {progress.imagesCompleted} / {progress.imageTotal}
              </span>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
