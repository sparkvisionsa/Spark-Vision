import { useCallback } from "react";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import type { SupportFile } from "./support-types";

export class SupportApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export function useSupportApi() {
  const { csrfToken } = useAuthTracking();
  return useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(`/api/support${path}`, {
      ...options, credentials: "include", cache: "no-store",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken, ...options.headers },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new SupportApiError(typeof payload.message === "string" ? payload.message : "تعذر تنفيذ الطلب. حاول مرة أخرى.", response.status);
    return payload as T;
  }, [csrfToken]);
}
export const supportError = (error: unknown) => error instanceof Error ? error.message : "تعذر تنفيذ الطلب";
export function uploadSupportFile(ticketId: string, file: Blob, filename: string, csrfToken: string, onProgress: (value: number) => void, signal?: AbortSignal): Promise<SupportFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/support/tickets/${encodeURIComponent(ticketId)}/files`);
    xhr.withCredentials = true;
    xhr.timeout = 10 * 60_000;
    xhr.setRequestHeader("X-CSRF-Token", csrfToken);
    const abort = () => xhr.abort();
    const cleanup = () => signal?.removeEventListener("abort", abort);
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.min(99, Math.round(event.loaded / event.total * 100))); };
    xhr.onload = () => {
      cleanup();
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status < 200 || xhr.status >= 300) throw new Error(data.message || "تعذر رفع الملف");
        onProgress(100); resolve(data.file);
      } catch (error) { reject(error); }
    };
    xhr.onerror = () => { cleanup(); reject(new Error("انقطع الاتصال. الملف محفوظ هنا؛ يمكنك إعادة الرفع.")); };
    xhr.ontimeout = () => { cleanup(); reject(new Error("انتهت مهلة الرفع. حاول مجدداً.")); };
    xhr.onabort = () => { cleanup(); reject(new DOMException("تم إلغاء الرفع", "AbortError")); };
    const data = new FormData(); data.append("file", file, filename);
    if (signal?.aborted) { reject(new DOMException("تم إلغاء الرفع", "AbortError")); return; }
    signal?.addEventListener("abort", abort, { once: true });
    xhr.send(data);
  });
}
