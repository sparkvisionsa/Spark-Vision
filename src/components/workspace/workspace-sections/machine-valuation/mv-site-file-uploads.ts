"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MvInspectorFile } from "./types";

/** Files uploaded at the same time (the server appends each one atomically). */
export const MV_SITE_UPLOAD_CONCURRENCY = 3;

export type MvSiteUploadState = "queued" | "uploading" | "done" | "error";

export type MvSiteUploadJob = {
  clientId: string;
  /** Target site; `null` = general project file (all sites). */
  siteId: string | null;
  name: string;
  size: number;
  state: MvSiteUploadState;
  progress: number;
  error?: string;
};

type QueuedUpload = { clientId: string; siteId: string | null; file: File };

/** Inspector files attached to one site (`null` = general files linked to no site). */
export function inspectorFilesForSite(files: readonly MvInspectorFile[], siteId: string | null): MvInspectorFile[] {
  return files.filter((file) => {
    const ids = Array.isArray(file.locationIds) ? file.locationIds.filter(Boolean) : [];
    return siteId == null ? ids.length === 0 : ids.includes(siteId);
  });
}

/** Adds or replaces a file by id — results arriving out of order never drop a file. */
export function upsertInspectorFile(files: readonly MvInspectorFile[], file: MvInspectorFile): MvInspectorFile[] {
  const index = files.findIndex((item) => item.id === file.id);
  if (index < 0) return [...files, file];
  const next = files.slice();
  next[index] = file;
  return next;
}

export function formatMvFileSize(bytes: number | undefined): string {
  if (!bytes || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function uploadErrorMessage(status: number, raw: unknown, fallback: string): string {
  if (raw && typeof raw === "object") {
    const message = (raw as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
    if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  }
  if (status === 413) return "حجم الملف أكبر من المسموح.";
  return fallback;
}

/**
 * Upload queue for inspection-site files: a few files in parallel with
 * per-file progress; failed files stay listed with a retry instead of
 * disappearing; `beforeUpload` makes sure the target site exists on the
 * server first (it is saved automatically, the user never "saves first").
 */
export function useMvSiteFileUploads({
  projectId,
  beforeUpload,
  onUploaded,
  messages,
}: {
  projectId: string;
  beforeUpload: (siteId: string | null) => Promise<boolean>;
  onUploaded: (file: MvInspectorFile) => void;
  messages: { failed: string; network: string; siteNotSaved: string };
}) {
  const [jobs, setJobs] = useState<MvSiteUploadJob[]>([]);
  const queueRef = useRef<QueuedUpload[]>([]);
  const filesRef = useRef(new Map<string, QueuedUpload>());
  const activeRef = useRef(0);
  const latest = useRef({ projectId, beforeUpload, onUploaded, messages });
  latest.current = { projectId, beforeUpload, onUploaded, messages };

  const patch = useCallback((clientId: string, next: Partial<MvSiteUploadJob>) => {
    setJobs((rows) => rows.map((row) => (row.clientId === clientId ? { ...row, ...next } : row)));
  }, []);

  const fail = useCallback(
    (clientId: string, error: string) => patch(clientId, { state: "error", progress: 0, error }),
    [patch],
  );

  const run = useCallback(
    async (item: QueuedUpload) => {
      const { projectId: pid, beforeUpload: ensure, messages: text } = latest.current;
      patch(item.clientId, { state: "uploading", progress: 0, error: undefined });
      const ready = await ensure(item.siteId).catch(() => false);
      if (!ready) {
        fail(item.clientId, text.siteNotSaved);
        return;
      }
      await new Promise<void>((resolve) => {
        const form = new FormData();
        form.append("file", item.file);
        form.append("locationIds", JSON.stringify(item.siteId ? [item.siteId] : []));
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/mv/projects/${pid}/inspectorFiles`);
        xhr.withCredentials = true;
        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          // Keep 100% for the moment the server has stored the file.
          patch(item.clientId, { progress: Math.min(99, Math.round((100 * event.loaded) / Math.max(event.total, 1))) });
        };
        xhr.onload = () => {
          let raw: unknown = null;
          try {
            raw = xhr.responseText ? JSON.parse(xhr.responseText) : null;
          } catch {
            raw = null;
          }
          const file = (raw as { file?: MvInspectorFile } | null)?.file;
          if (xhr.status < 200 || xhr.status >= 300 || !file?.id) {
            fail(item.clientId, uploadErrorMessage(xhr.status, raw, text.failed));
          } else {
            filesRef.current.delete(item.clientId);
            latest.current.onUploaded(file);
            patch(item.clientId, { state: "done", progress: 100 });
            window.setTimeout(() => setJobs((rows) => rows.filter((row) => row.clientId !== item.clientId)), 1200);
          }
          resolve();
        };
        xhr.onerror = () => {
          fail(item.clientId, text.network);
          resolve();
        };
        xhr.send(form);
      });
    },
    [fail, patch],
  );

  const pump = useCallback(() => {
    while (activeRef.current < MV_SITE_UPLOAD_CONCURRENCY && queueRef.current.length > 0) {
      const item = queueRef.current.shift()!;
      activeRef.current += 1;
      void run(item).finally(() => {
        activeRef.current -= 1;
        pump();
      });
    }
  }, [run]);

  const upload = useCallback(
    (list: readonly File[], siteId: string | null) => {
      if (list.length === 0) return;
      const items = list.map((file) => ({
        clientId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        siteId,
        file,
      }));
      for (const item of items) filesRef.current.set(item.clientId, item);
      setJobs((rows) => [
        ...rows,
        ...items.map((item) => ({
          clientId: item.clientId,
          siteId,
          name: item.file.name,
          size: item.file.size,
          state: "queued" as const,
          progress: 0,
        })),
      ]);
      queueRef.current.push(...items);
      pump();
    },
    [pump],
  );

  const retry = useCallback(
    (clientId: string) => {
      const item = filesRef.current.get(clientId);
      if (!item) return;
      patch(clientId, { state: "queued", progress: 0, error: undefined });
      queueRef.current.push(item);
      pump();
    },
    [patch, pump],
  );

  const dismiss = useCallback((clientId: string) => {
    filesRef.current.delete(clientId);
    setJobs((rows) => rows.filter((row) => row.clientId !== clientId));
  }, []);

  const pendingCount = jobs.filter((job) => job.state === "queued" || job.state === "uploading").length;
  const failedCount = jobs.filter((job) => job.state === "error").length;

  // Leaving the page would cut the uploads in progress.
  useEffect(() => {
    if (pendingCount === 0) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pendingCount]);

  return { jobs, upload, retry, dismiss, pendingCount, failedCount };
}
