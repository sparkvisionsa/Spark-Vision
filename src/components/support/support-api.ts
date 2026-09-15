import { useCallback } from "react";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import type { SupportFile } from "./support-types";

export class SupportApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
function responseMessage(text: string, status: number) {
  try {
    const payload = JSON.parse(text) as { message?: unknown };
    if (typeof payload.message === "string") return payload.message;
  } catch { /* A reverse proxy may return a plain-text error. */ }
  if (status === 413) return "حجم التسجيل أكبر من الحد المسموح لهذه المحاولة. سيُرفع على أجزاء صغيرة؛ حاول مرة أخرى.";
  return "تعذر تنفيذ الطلب. حاول مرة أخرى.";
}
export function useSupportApi() {
  const { csrfToken } = useAuthTracking();
  return useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(`/api/support${path}`, {
      ...options, credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken, ...options.headers },
    });
    const text = await response.text();
    if (!response.ok) throw new SupportApiError(responseMessage(text, response.status), response.status);
    try { return JSON.parse(text) as T; }
    catch { throw new SupportApiError("وصل رد غير صالح من الخادم. حاول مرة أخرى.", response.status); }
  }, [csrfToken]);
}
export const supportError = (error: unknown) => error instanceof Error ? error.message : "تعذر تنفيذ الطلب";
function uploadChunk(url: string, chunk: Blob, offset: number, csrfToken: string, onProgress: (loaded: number) => void, signal?: AbortSignal) {
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
    xhr.upload.onprogress = event => onProgress(event.loaded);
    xhr.onload = () => {
      cleanup();
      if (xhr.status < 200 || xhr.status >= 300) return reject(new SupportApiError(responseMessage(xhr.responseText, xhr.status), xhr.status));
      try { resolve((JSON.parse(xhr.responseText) as { offset: number }).offset); }
      catch { reject(new Error("وصل رد غير صالح أثناء رفع التسجيل.")); }
    };
    xhr.onerror = () => { cleanup(); reject(new Error("انقطع الاتصال. الملف محفوظ هنا؛ يمكنك إعادة الرفع.")); };
    xhr.ontimeout = () => { cleanup(); reject(new Error("انتهت مهلة الرفع. حاول مجدداً.")); };
    xhr.onabort = () => { cleanup(); reject(new DOMException("تم إلغاء الرفع", "AbortError")); };
    if (signal?.aborted) { reject(new DOMException("تم إلغاء الرفع", "AbortError")); return; }
    signal?.addEventListener("abort", abort, { once: true });
    xhr.send(chunk);
  });
}
export async function uploadSupportFile(ticketId: string, file: Blob, filename: string, csrfToken: string, onProgress: (value: number) => void, signal?: AbortSignal): Promise<SupportFile> {
  const base = `/api/support/tickets/${encodeURIComponent(ticketId)}/files/uploads`;
  const request = async <T,>(url: string, init: RequestInit): Promise<T> => {
    const response = await fetch(url, { ...init, credentials: "include", cache: "no-store", signal, headers: { "X-CSRF-Token": csrfToken, ...init.headers } });
    const text = await response.text();
    if (!response.ok) throw new SupportApiError(responseMessage(text, response.status), response.status);
    try { return JSON.parse(text) as T; }
    catch { throw new Error("وصل رد غير صالح من الخادم أثناء رفع التسجيل."); }
  };
  let uploadId = "";
  try {
    const started = await request<{ uploadId: string; chunkSize: number }>(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: filename, size: file.size }) });
    uploadId = started.uploadId;
    const url = `${base}/${encodeURIComponent(uploadId)}`;
    let offset = 0;
    while (offset < file.size) {
      if (signal?.aborted) throw new DOMException("تم إلغاء الرفع", "AbortError");
      const chunk = file.slice(offset, Math.min(offset + started.chunkSize, file.size));
      const baseOffset = offset;
      offset = await uploadChunk(url, chunk, offset, csrfToken, loaded => onProgress(Math.min(99, Math.round((baseOffset + loaded) / file.size * 100))), signal);
    }
    const completed = await request<{ file: SupportFile }>(`${url}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    onProgress(100);
    return completed.file;
  } catch (error) {
    if (uploadId) void fetch(`${base}/${encodeURIComponent(uploadId)}`, { method: "DELETE", credentials: "include", keepalive: true, headers: { "X-CSRF-Token": csrfToken } }).catch(() => undefined);
    throw error;
  }
}
