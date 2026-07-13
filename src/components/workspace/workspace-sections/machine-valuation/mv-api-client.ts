import { beginMvLoading } from "./mv-loading-state";

export type MvApiErrorKind =
  | "offline"
  | "timeout"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "server"
  | "network"
  | "unknown";

export class MvApiError extends Error {
  readonly status: number | null;
  readonly kind: MvApiErrorKind;

  constructor(message: string, options: { status?: number | null; kind?: MvApiErrorKind } = {}) {
    super(message);
    this.name = "MvApiError";
    this.status = options.status ?? null;
    this.kind = options.kind ?? "unknown";
  }
}

type MvFetchOptions = {
  timeoutMs?: number;
  retries?: number;
  retryBaseMs?: number;
  trackLoading?: boolean;
  loadingLabel?: string;
};

type JsonCacheRow = {
  /** null أثناء التنفيذ حتى يبقى الطلب البطيء single-flight مهما طال. */
  expiresAt: number | null;
  promise: Promise<unknown>;
};

const jsonRequestCache = new Map<string, JsonCacheRow>();

function apiErrorKind(status: number): MvApiErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status >= 500) return "server";
  return "unknown";
}

async function responseErrorMessage(response: Response) {
  const fallback =
    response.status === 401 ? "انتهت الجلسة. سجّل الدخول ثم أعد المحاولة."
      : response.status === 403 ? "ليس لديك صلاحية لتنفيذ هذا الإجراء."
        : response.status === 404 ? "لم يتم العثور على البيانات المطلوبة."
          : response.status >= 500 ? "الخادم غير متاح مؤقتًا. أعد المحاولة بعد قليل."
            : `تعذر إكمال الطلب (${response.status}).`;
  try {
    const body = await response.clone().json() as { message?: unknown; error?: unknown };
    const candidate = typeof body.message === "string"
      ? body.message
      : typeof body.error === "string" ? body.error : "";
    return candidate.trim() || fallback;
  } catch {
    return fallback;
  }
}

function retryAfterMs(response: Response, attempt: number, baseMs: number) {
  const raw = response.headers.get("Retry-After")?.trim();
  if (raw) {
    const seconds = Number(raw);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const at = Date.parse(raw);
    if (Number.isFinite(at)) return Math.max(0, at - Date.now());
  }
  const jitter = Math.floor(Math.random() * 180);
  return Math.min(8000, baseMs * (2 ** attempt) + jitter);
}

function canRetry(method: string, status?: number) {
  if (method !== "GET" && method !== "HEAD") return false;
  if (status == null) return true;
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function isMvAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function signalAbortReason(signal: AbortSignal) {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException("The operation was aborted.", "AbortError");
}

function waitWithSignal<T>(promise: Promise<T>, signal?: AbortSignal | null): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signalAbortReason(signal));

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      cleanup();
      reject(signalAbortReason(signal));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

function delayWithSignal(ms: number, signal?: AbortSignal | null) {
  if (!signal) return new Promise<void>((resolve) => setTimeout(resolve, ms));
  if (signal.aborted) return Promise.reject(signalAbortReason(signal));
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timeout);
      cleanup();
      reject(signalAbortReason(signal));
    };
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function mvFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: MvFetchOptions = {},
): Promise<Response> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new MvApiError("لا يوجد اتصال بالإنترنت.", { kind: "offline" });
  }

  const method = (init.method ?? "GET").toUpperCase();
  const retries = Math.max(0, options.retries ?? (method === "GET" || method === "HEAD" ? 1 : 0));
  const timeoutMs = Math.max(1000, options.timeoutMs ?? 15_000);
  const retryBaseMs = Math.max(100, options.retryBaseMs ?? 450);
  // شاشة الشعار مخصّصة للبيانات الأولية فقط. طلبات الخلفية opt-in حتى لا تحجب الواجهة.
  const finishLoading = options.trackLoading === true && (method === "GET" || method === "HEAD")
    ? beginMvLoading(options.loadingLabel)
    : null;

  try {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (init.signal?.aborted) throw signalAbortReason(init.signal);
      const controller = new AbortController();
      let timedOut = false;
      const onExternalAbort = () => controller.abort(init.signal?.reason);
      init.signal?.addEventListener("abort", onExternalAbort, { once: true });
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      try {
        const response = await fetch(input, {
          credentials: "include",
          ...init,
          signal: controller.signal,
        });
        if (response.ok) return response;

        if (attempt < retries && canRetry(method, response.status)) {
          await delayWithSignal(retryAfterMs(response, attempt, retryBaseMs), init.signal);
          continue;
        }
        throw new MvApiError(await responseErrorMessage(response), {
          status: response.status,
          kind: apiErrorKind(response.status),
        });
      } catch (error) {
        if (init.signal?.aborted) throw error;
        if (timedOut) {
          if (attempt < retries && canRetry(method)) {
            await delayWithSignal(retryBaseMs * (attempt + 1), init.signal);
            continue;
          }
          throw new MvApiError("استغرق الخادم وقتًا أطول من المتوقع. أعد المحاولة.", { kind: "timeout" });
        }
        if (error instanceof MvApiError) throw error;
        if (isMvAbortError(error)) throw error;
        if (attempt < retries && canRetry(method)) {
          await delayWithSignal(retryBaseMs * (attempt + 1), init.signal);
          continue;
        }
        throw new MvApiError("تعذر الاتصال بالخادم. تحقق من الشبكة ثم أعد المحاولة.", {
          kind: "network",
        });
      } finally {
        clearTimeout(timeout);
        init.signal?.removeEventListener("abort", onExternalAbort);
      }
    }
  } finally {
    finishLoading?.();
  }

  throw new MvApiError("تعذر إكمال الطلب.");
}

export async function mvFetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: MvFetchOptions & { cacheKey?: string; cacheTtlMs?: number; forceRefresh?: boolean } = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const cacheKey = method === "GET" ? options.cacheKey : undefined;
  if (cacheKey) {
    if (options.forceRefresh) jsonRequestCache.delete(cacheKey);
    const cached = jsonRequestCache.get(cacheKey);
    if (cached && (cached.expiresAt === null || cached.expiresAt > Date.now())) {
      return waitWithSignal(cached.promise as Promise<T>, init.signal);
    }
    if (cached) jsonRequestCache.delete(cacheKey);
  }

  if (init.signal?.aborted) throw signalAbortReason(init.signal);

  // A shared cached request must outlive the tab/component that created it.
  // Each caller cancels only its own wait through waitWithSignal below.
  const requestInit = cacheKey && init.signal ? { ...init, signal: undefined } : init;
  const promise = mvFetch(input, requestInit, options).then(async (response) => {
    try {
      return await response.json() as T;
    } catch {
      throw new MvApiError("أعاد الخادم بيانات غير مكتملة. أعد المحاولة.", {
        status: response.status,
        kind: "server",
      });
    }
  });

  if (cacheKey) {
    const row: JsonCacheRow = {
      expiresAt: null,
      promise,
    };
    jsonRequestCache.set(cacheKey, row);
    void promise.then(
      () => {
        if (jsonRequestCache.get(cacheKey) === row) {
          row.expiresAt = Date.now() + Math.max(0, options.cacheTtlMs ?? 12_000);
        }
      },
      () => undefined,
    );
    void promise.catch(() => {
      if (jsonRequestCache.get(cacheKey) === row) jsonRequestCache.delete(cacheKey);
    });
  }
  return waitWithSignal(promise, init.signal);
}

export function invalidateMvApiCache(prefix?: string) {
  if (!prefix) {
    jsonRequestCache.clear();
    return;
  }
  for (const key of jsonRequestCache.keys()) {
    if (key.startsWith(prefix)) jsonRequestCache.delete(key);
  }
}

export function mvErrorMessage(error: unknown, fallback = "تعذر إكمال العملية.") {
  if (isMvAbortError(error)) return fallback;
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}
