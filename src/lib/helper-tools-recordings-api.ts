import type { RecorderSurface } from "@/hooks/use-screen-recorder";
import { listScreenRecordings, type StoredRecordingMeta } from "@/lib/helper-tools-recordings";

export type RemoteRecording = Omit<StoredRecordingMeta, "ownerKey" | "remoteId"> & {
  ownerKind: "user" | "guest";
  ownerLabel: string;
};

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
  if (!response.ok) throw new Error(messageFrom(text, response.status));
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("وصل رد غير صالح من الخادم.");
  }
}

export function helperRecordingFileUrl(id: string) {
  return `/api/helper-tools/recordings/${encodeURIComponent(id)}/file`;
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

function uploadChunk(url: string, chunk: Blob, offset: number, csrfToken: string, signal?: AbortSignal) {
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
      if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(messageFrom(xhr.responseText, xhr.status)));
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

export async function uploadScreenRecording(input: {
  blob: Blob;
  filename: string;
  source: RecorderSurface;
  seconds: number;
  description: string;
  csrfToken: string;
  signal?: AbortSignal;
}): Promise<RemoteRecording> {
  const base = "/api/helper-tools/recordings/uploads";
  const started = await helperRequest<{ uploadId: string; chunkSize: number }>(
    "/uploads",
    input.csrfToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.filename,
        size: input.blob.size,
        source: input.source,
        seconds: input.seconds,
        description: input.description,
        mime: input.blob.type || "video/webm",
      }),
    },
    input.signal,
  );
  const url = `${base}/${encodeURIComponent(started.uploadId)}`;
  try {
    let offset = 0;
    while (offset < input.blob.size) {
      if (input.signal?.aborted) throw new DOMException("تم إلغاء الرفع", "AbortError");
      const chunk = input.blob.slice(offset, Math.min(offset + started.chunkSize, input.blob.size));
      offset = await uploadChunk(url, chunk, offset, input.csrfToken, input.signal);
    }
    const completed = await helperRequest<{ recording: RemoteRecording }>(
      `/uploads/${encodeURIComponent(started.uploadId)}/complete`,
      input.csrfToken,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
      input.signal,
    );
    return completed.recording;
  } catch (error) {
    await helperRequest(`/uploads/${encodeURIComponent(started.uploadId)}`, input.csrfToken, { method: "DELETE" }).catch(() => undefined);
    throw error;
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
  } catch {
    remote = [];
  }
  const remoteItems = remote.map((row) => toLibraryItem(row, ownerKey));
  const remoteIds = new Set(remoteItems.map((row) => row.id));
  const extras = local.filter((row) => !row.remoteId || !remoteIds.has(row.remoteId));
  return [...remoteItems, ...extras].sort((a, b) => b.createdAt - a.createdAt);
}
