import type { RecorderSurface } from "@/hooks/use-screen-recorder";
import { listScreenRecordings, type StoredRecordingMeta } from "@/lib/helper-tools-recordings";

export type RemoteRecording = Omit<StoredRecordingMeta, "ownerKey" | "remoteId"> & {
  ownerKind: "user" | "guest";
  ownerLabel: string;
  status?: "uploading" | "processing" | "ready" | "failed";
  failureReason?: string | null;
  thumbnailUrl?: string | null;
  hlsUrl?: string | null;
};

export class ScreenRecordingListError extends Error {
  constructor(readonly localItems: StoredRecordingMeta[], cause?: unknown) {
    super(cause instanceof Error ? cause.message : "Could not load saved recordings");
  }
}

function messageFrom(text: string, status: number) {
  try {
    const payload = JSON.parse(text) as { message?: unknown };
    if (typeof payload.message === "string") return payload.message;
  } catch {
    /* ignore */
  }
  if (status === 401) return "انتهت الجلسة. حدّث الصفحة ثم أعد المحاولة.";
  if (status === 413) return "حجم التسجيل أكبر من الحد المسموح.";
  return "تعذر حفظ التسجيل على الخادم.";
}

class HelperRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function helperRequest<T>(path: string, csrfToken: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/helper-tools/recordings${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    signal,
    headers: {
      "X-CSRF-Token": csrfToken,
      ...init.headers,
    },
  });
  const text = await response.text();
  if (!response.ok) throw new HelperRequestError(messageFrom(text, response.status), response.status);
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("وصل رد غير صالح من الخادم.");
  }
}

export function helperRecordingFileUrl(id: string, options?: { downloadName?: string }) {
  const base = `/api/helper-tools/recordings/${encodeURIComponent(id)}/file`;
  if (!options?.downloadName) return base;
  return `${base}?download=${encodeURIComponent(options.downloadName)}`;
}

export function helperRecordingManifestUrl(id: string) {
  return `/api/helper-tools/recordings/${encodeURIComponent(id)}/manifest.m3u8`;
}

export async function getRemoteScreenRecordingDownloadUrl(csrfToken: string, id: string, name: string) {
  const query = `?name=${encodeURIComponent(name)}`;
  const result = await helperRequest<{ url: string }>(`/${encodeURIComponent(id)}/download-link${query}`, csrfToken);
  if (!result.url) throw new Error("تعذر إنشاء رابط تنزيل التسجيل.");
  return result.url;
}

export async function listRemoteScreenRecordings(csrfToken: string, source?: RecorderSurface): Promise<RemoteRecording[]> {
  const query = source ? `?source=${encodeURIComponent(source)}` : "";
  const result = await helperRequest<{ recordings: RemoteRecording[] }>(query, csrfToken, { method: "GET" });
  return result.recordings ?? [];
}

export async function updateRemoteScreenRecording(csrfToken: string, id: string, description: string) {
  await helperRequest(`/${encodeURIComponent(id)}`, csrfToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
}

export async function deleteRemoteScreenRecording(csrfToken: string, id: string) {
  await helperRequest(`/${encodeURIComponent(id)}`, csrfToken, { method: "DELETE" });
}

class UploadChunkHttpError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

class StorageResponseHeaderError extends Error {}

const multipartResumeByBlob = new WeakMap<Blob, { uploadId: string; partSize: number }>();
const multipartRequestIdByBlob = new WeakMap<Blob, string>();

export async function beginStreamingRecording(input: { filename: string; mime: string; source: RecorderSurface; description: string; csrfToken: string; seconds: number; clientRequestId: string }) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await helperRequest<{ uploadId: string; recordingId: string; partSize: number }>("/multipart", input.csrfToken, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: input.filename, maxSize: 1024 * 1024 * 1024, source: input.source, seconds: Math.max(1, input.seconds), description: input.description, mime: input.mime, clientRequestId: input.clientRequestId }),
      });
    } catch (error) {
      const status = error instanceof HelperRequestError ? error.status : 0;
      if (status && status < 500 && status !== 408 && status !== 429) throw error;
      if (!navigator.onLine) await new Promise<void>((resolve) => window.addEventListener("online", () => resolve(), { once: true }));
      else await new Promise<void>((resolve) => window.setTimeout(resolve, Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5))));
    }
  }
}

export async function uploadStreamingRecordingPart(input: { uploadId: string; partNumber: number; chunk: Blob; csrfToken: string; onProgress?: (loaded: number) => void }) {
  for (let attempt = 0; ; attempt++) {
    try {
      const signed = await helperRequest<{ url: string }>(`/multipart/${encodeURIComponent(input.uploadId)}/parts/${input.partNumber}/url`, input.csrfToken, { method: "GET" });
      return await uploadSignedPart(signed.url, input.chunk, undefined, input.onProgress);
    } catch (error) {
      if (error instanceof StorageResponseHeaderError) throw error;
      const status = error instanceof HelperRequestError || error instanceof UploadChunkHttpError ? error.status : 0;
      const retryable = status === 0 || status >= 500 || status === 408 || status === 429;
      if (!retryable) throw error;
      if (!navigator.onLine) await new Promise<void>((resolve) => window.addEventListener("online", () => resolve(), { once: true }));
      else await new Promise<void>((resolve) => window.setTimeout(resolve, Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5))));
    }
  }
}

export async function completeStreamingRecording(input: { uploadId: string; size: number; seconds: number; parts: Array<{ partNumber: number; etag: string }>; csrfToken: string }) {
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await helperRequest<{ recording: RemoteRecording }>(`/multipart/${encodeURIComponent(input.uploadId)}/complete`, input.csrfToken, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ size: input.size, seconds: input.seconds, parts: input.parts }),
      });
      return result.recording;
    } catch (error) {
      const status = error instanceof HelperRequestError ? error.status : 0;
      if (status && status < 500 && status !== 408 && status !== 429) throw error;
      if (!navigator.onLine) await new Promise<void>((resolve) => window.addEventListener("online", () => resolve(), { once: true }));
      else await new Promise<void>((resolve) => window.setTimeout(resolve, Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5))));
    }
  }
}

function uploadChunkOnce(url: string, chunk: Blob, offset: number, csrfToken: string, signal?: AbortSignal) {
  return new Promise<number>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PATCH", url);
    xhr.withCredentials = true;
    xhr.timeout = 2 * 60_000;
    xhr.setRequestHeader("X-CSRF-Token", csrfToken);
    xhr.setRequestHeader("X-Upload-Offset", String(offset));
    xhr.setRequestHeader("X-Upload-Length", String(chunk.size));
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    const abort = () => xhr.abort();
    const cleanup = () => signal?.removeEventListener("abort", abort);
    xhr.onload = () => {
      cleanup();
      if (xhr.status < 200 || xhr.status >= 300) return reject(new UploadChunkHttpError(messageFrom(xhr.responseText, xhr.status), xhr.status));
      try {
        resolve((JSON.parse(xhr.responseText) as { offset: number }).offset);
      } catch {
        reject(new Error("وصل رد غير صالح أثناء رفع التسجيل."));
      }
    };
    xhr.onerror = () => {
      cleanup();
      reject(new Error("انقطع الاتصال أثناء حفظ التسجيل على الخادم."));
    };
    xhr.ontimeout = () => {
      cleanup();
      reject(new Error("انتهت مهلة رفع التسجيل."));
    };
    xhr.onabort = () => {
      cleanup();
      reject(new DOMException("تم إلغاء الرفع", "AbortError"));
    };
    if (signal?.aborted) {
      reject(new DOMException("تم إلغاء الرفع", "AbortError"));
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    xhr.send(chunk);
  });
}

async function uploadChunk(url: string, chunk: Blob, offset: number, csrfToken: string, signal?: AbortSignal) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await uploadChunkOnce(url, chunk, offset, csrfToken, signal);
    } catch (error) {
      lastError = error;
      if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) throw error;
      if (error instanceof UploadChunkHttpError && error.status < 500 && error.status !== 408 && error.status !== 429) throw error;
      if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function uploadScreenRecordingAttempt(input: {
  blob: Blob;
  filename: string;
  source: RecorderSurface;
  seconds: number;
  description: string;
  csrfToken: string;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}): Promise<RemoteRecording> {
  let started = multipartResumeByBlob.get(input.blob);
  if (!started) {
    let clientRequestId = multipartRequestIdByBlob.get(input.blob);
    if (!clientRequestId) { clientRequestId = crypto.randomUUID(); multipartRequestIdByBlob.set(input.blob, clientRequestId); }
    started = await helperRequest<{ uploadId: string; recordingId: string; partSize: number }>(
    "/multipart",
    input.csrfToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.filename,
        maxSize: 1024 * 1024 * 1024,
        source: input.source,
        seconds: input.seconds,
        description: input.description,
        mime: input.blob.type || "video/webm",
        clientRequestId,
      }),
    },
    input.signal,
  );
    multipartResumeByBlob.set(input.blob, started);
  }
  const parts: Array<{ partNumber: number; etag: string }> = [];
  try {
    const previous = await helperRequest<{ parts: Array<{ partNumber: number; etag: string }> }>(`/multipart/${encodeURIComponent(started.uploadId)}/parts`, input.csrfToken, { method: "GET" }, input.signal);
    const uploadedParts = new Map(previous.parts.map((part) => [part.partNumber, part.etag]));
    let partNumber = 1;
    let transferred = 0;
    for (let offset = 0; offset < input.blob.size; offset += started.partSize) {
      if (input.signal?.aborted) throw new DOMException("تم إلغاء الرفع", "AbortError");
      const chunk = input.blob.slice(offset, Math.min(offset + started.partSize, input.blob.size));
      let etag = uploadedParts.get(partNumber);
      if (!etag) {
        const signed = await helperRequest<{ url: string }>(`/multipart/${encodeURIComponent(started.uploadId)}/parts/${partNumber}/url`, input.csrfToken, { method: "GET" }, input.signal);
        etag = await uploadSignedPart(signed.url, chunk, input.signal, (loaded) => input.onProgress?.(Math.min(99, Math.round((transferred + loaded) / input.blob.size * 100))));
      }
      transferred += chunk.size;
      parts.push({ partNumber, etag });
      partNumber++;
    }
    const result = await helperRequest<{ recording: RemoteRecording }>(
      `/multipart/${encodeURIComponent(started.uploadId)}/complete`,
      input.csrfToken,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ size: input.blob.size, parts }) },
      input.signal,
    );
    multipartResumeByBlob.delete(input.blob);
    multipartRequestIdByBlob.delete(input.blob);
    input.onProgress?.(100);
    return result.recording;
  } catch (error) {
    if (error instanceof HelperRequestError && error.status < 500 && error.status !== 408 && error.status !== 429) {
      await helperRequest(`/multipart/${encodeURIComponent(started.uploadId)}`, input.csrfToken, { method: "DELETE" }).catch(() => undefined);
      multipartResumeByBlob.delete(input.blob);
    }
    throw error;
  }
}

async function uploadSignedPart(url: string, chunk: Blob, signal?: AbortSignal, onProgress?: (loaded: number) => void): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url);
        xhr.timeout = 5 * 60_000;
        const abort = () => xhr.abort();
        signal?.addEventListener("abort", abort, { once: true });
        const clean = () => signal?.removeEventListener("abort", abort);
        xhr.onload = () => {
          clean();
          if (xhr.status < 200 || xhr.status >= 300) return reject(new UploadChunkHttpError("تعذر رفع جزء الفيديو إلى التخزين.", xhr.status));
          const etag = xhr.getResponseHeader("ETag")?.replace(/^"|"$/g, "");
          if (!etag) return reject(new StorageResponseHeaderError("لم يُعدّ التخزين رقم تحقق الجزء."));
          resolve(etag);
        };
        xhr.onerror = () => { clean(); reject(new TypeError("network")); };
        xhr.ontimeout = () => { clean(); reject(new TypeError("timeout")); };
        xhr.onabort = () => { clean(); reject(new DOMException("تم إلغاء الرفع", "AbortError")); };
        xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress?.(event.loaded); };
        xhr.send(chunk);
      });
    } catch (error) {
      lastError = error;
      if (signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) throw error;
      if (error instanceof StorageResponseHeaderError) throw error;
      if (error instanceof UploadChunkHttpError && error.status < 500 && error.status !== 408 && error.status !== 429) throw error;
      if (!navigator.onLine) await new Promise<void>((resolve, reject) => {
        const onOnline = () => { window.removeEventListener("offline", onOffline); resolve(); };
        const onOffline = () => { window.removeEventListener("online", onOnline); reject(new TypeError("offline")); };
        window.addEventListener("online", onOnline, { once: true });
        window.addEventListener("offline", onOffline, { once: true });
        signal?.addEventListener("abort", () => { window.removeEventListener("online", onOnline); reject(new DOMException("تم إلغاء الرفع", "AbortError")); }, { once: true });
      });
      else if (attempt < 4) await new Promise<void>((resolve) => window.setTimeout(resolve, Math.min(20_000, 800 * 2 ** attempt)));
    }
  }
  throw lastError;
}

export async function uploadScreenRecording(input: {
  blob: Blob;
  filename: string;
  source: RecorderSurface;
  seconds: number;
  description: string;
  csrfToken: string;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}): Promise<RemoteRecording> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await uploadScreenRecordingAttempt(input);
    } catch (error) {
      if (error instanceof StorageResponseHeaderError) throw error;
      const status = error instanceof HelperRequestError || error instanceof UploadChunkHttpError ? error.status : 0;
      const retryableStatus = status === 0 || status >= 500 || status === 408 || status === 429 || (error instanceof UploadChunkHttpError && status === 400);
      if (!retryableStatus || input.signal?.aborted || (error instanceof DOMException && error.name === "AbortError")) throw error;
      const delay = Math.min(30_000, 900 * 2 ** Math.min(attempt, 5));
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, delay);
        input.signal?.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("تم إلغاء الرفع", "AbortError")); }, { once: true });
      });
    }
  }
}

export function toLibraryItem(remote: RemoteRecording, ownerKey: string): StoredRecordingMeta {
  return {
    id: remote.id,
    createdAt: remote.createdAt,
    source: remote.source,
    seconds: remote.seconds,
    description: remote.description,
    mime: remote.mime,
    size: remote.size,
    ownerKey,
    ownerKind: remote.ownerKind,
    ownerLabel: remote.ownerLabel,
    remoteId: remote.id,
    status: remote.status ?? "ready",
    failureReason: remote.failureReason,
    thumbnailUrl: remote.thumbnailUrl,
    hlsUrl: remote.hlsUrl,
  };
}

export async function listVisibleScreenRecordings(
  ownerKey: string,
  csrfToken: string,
  source?: RecorderSurface,
): Promise<StoredRecordingMeta[]> {
  const local = await listScreenRecordings(ownerKey, source);
  let remote: RemoteRecording[] = [];
  try {
    remote = await listRemoteScreenRecordings(csrfToken, source);
  } catch (cause) {
    throw new ScreenRecordingListError(local, cause);
  }
  const remoteItems = remote.map((row) => toLibraryItem(row, ownerKey));
  const remoteIds = new Set(remoteItems.map((row) => row.id));
  const extras = local.filter((row) => !row.remoteId || !remoteIds.has(row.remoteId));
  return [...remoteItems, ...extras].sort((a, b) => b.createdAt - a.createdAt);
}
