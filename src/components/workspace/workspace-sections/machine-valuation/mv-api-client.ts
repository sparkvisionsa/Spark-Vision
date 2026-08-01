import { getMvT, readMvLanguage } from "./mv-i18n";
import { beginMvLoading } from "./mv-loading-state";

function mvT() {
  return getMvT(readMvLanguage());
}

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
  /** Allow retries for POST/PATCH/PUT/DELETE on timeout / 5xx (idempotent ops only). */
  retryMutations?: boolean;
};

type JsonCacheRow = {
  /** null أثناء التنفيذ حتى يبقى الطلب البطيء single-flight مهما طال. */
  expiresAt: number | null;
  /** بعد انتهاء freshness يبقى الناتج صالحًا كـ stale حتى هذا الوقت. */
  staleExpiresAt: number;
  promise: Promise<unknown>;
  resolved?: unknown;
  hasResolved: boolean;
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
  const t = mvT();
  const fallback =
    response.status === 401 ? t("errors.api.unauthorized")
      : response.status === 403 ? t("errors.api.forbidden")
        : response.status === 404 ? t("errors.api.notFound")
          : response.status >= 500 ? t("errors.api.server")
            : t("errors.api.httpStatus", { status: response.status });
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

function canRetry(
  method: string,
  status: number | undefined,
  options: Pick<MvFetchOptions, "retryMutations">,
) {
  const isRead = method === "GET" || method === "HEAD";
  if (!isRead && !options.retryMutations) return false;
  if (status == null) return true;
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function isMvAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

export function isMvTimeoutError(error: unknown) {
  return error instanceof MvApiError && error.kind === "timeout";
}

export function isMvTransientError(error: unknown) {
  if (!(error instanceof MvApiError)) return false;
  return (
    error.kind === "timeout" ||
    error.kind === "network" ||
    error.kind === "server" ||
    error.status === 408 ||
    error.status === 425 ||
    error.status === 429 ||
    (typeof error.status === "number" && error.status >= 500)
  );
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
  const t = mvT();
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new MvApiError(t("errors.api.offline"), { kind: "offline" });
  }

  const method = (init.method ?? "GET").toUpperCase();
  const retries = Math.max(
    0,
    options.retries ?? (method === "GET" || method === "HEAD" ? 2 : 0),
  );
  const timeoutMs = Math.max(
    1000,
    options.timeoutMs ?? (method === "GET" || method === "HEAD" ? 25_000 : 45_000),
  );
  const retryBaseMs = Math.max(100, options.retryBaseMs ?? 450);
  // شاشة الشعار مخصّصة للبيانات الأولية فقط. طلبات الخلفية opt-in حتى لا تحجب الواجهة.
  const finishLoading = options.trackLoading === true && (method === "GET" || method === "HEAD")
    ? beginMvLoading(options.loadingLabel ?? t("common.loading.default"))
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

        if (attempt < retries && canRetry(method, response.status, options)) {
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
          if (attempt < retries && canRetry(method, undefined, options)) {
            await delayWithSignal(retryBaseMs * (attempt + 1), init.signal);
            continue;
          }
          throw new MvApiError(t("errors.api.timeout"), { kind: "timeout" });
        }
        if (error instanceof MvApiError) throw error;
        if (isMvAbortError(error)) throw error;
        if (attempt < retries && canRetry(method, undefined, options)) {
          await delayWithSignal(retryBaseMs * (attempt + 1), init.signal);
          continue;
        }
        throw new MvApiError(t("errors.api.network"), {
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

  throw new MvApiError(t("errors.api.unknown"));
}

export async function mvFetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: MvFetchOptions & {
    cacheKey?: string;
    cacheTtlMs?: number;
    /** How long a successful response stays usable after freshness expires (SWR). */
    staleTtlMs?: number;
    forceRefresh?: boolean;
  } = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const cacheKey = method === "GET" ? options.cacheKey : undefined;
  const freshTtl = Math.max(0, options.cacheTtlMs ?? 45_000);
  const staleTtl = Math.max(freshTtl, options.staleTtlMs ?? Math.max(freshTtl * 8, 5 * 60_000));
  const now = Date.now();

  if (cacheKey) {
    if (options.forceRefresh) jsonRequestCache.delete(cacheKey);
    const cached = jsonRequestCache.get(cacheKey);
    if (cached) {
      // In-flight single-flight
      if (cached.expiresAt === null) {
        return waitWithSignal(cached.promise as Promise<T>, init.signal);
      }
      // Fresh hit
      if (cached.expiresAt > now) {
        if (cached.hasResolved) {
          return waitWithSignal(Promise.resolve(cached.resolved as T), init.signal);
        }
        return waitWithSignal(cached.promise as Promise<T>, init.signal);
      }
      // Stale-while-revalidate: serve stale immediately and refresh in background
      if (cached.hasResolved && cached.staleExpiresAt > now) {
        void refreshJsonCache<T>(input, init, options, cacheKey, freshTtl, staleTtl);
        return waitWithSignal(Promise.resolve(cached.resolved as T), init.signal);
      }
      jsonRequestCache.delete(cacheKey);
    }
  }

  if (init.signal?.aborted) throw signalAbortReason(init.signal);

  return startJsonRequest<T>(input, init, options, cacheKey, freshTtl, staleTtl);
}

async function startJsonRequest<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  options: MvFetchOptions,
  cacheKey: string | undefined,
  freshTtl: number,
  staleTtl: number,
): Promise<T> {
  // A shared cached request must outlive the tab/component that created it.
  // Each caller cancels only its own wait through waitWithSignal below.
  const requestInit = cacheKey && init.signal ? { ...init, signal: undefined } : init;
  const promise = mvFetch(input, requestInit, options).then(async (response) => {
    try {
      return await response.json() as T;
    } catch {
      throw new MvApiError(mvT()("errors.api.serverInvalidResponse"), {
        status: response.status,
        kind: "server",
      });
    }
  });

  if (cacheKey) {
    const row: JsonCacheRow = {
      expiresAt: null,
      staleExpiresAt: Date.now() + staleTtl,
      promise,
      hasResolved: false,
    };
    jsonRequestCache.set(cacheKey, row);
    void promise.then(
      (value) => {
        if (jsonRequestCache.get(cacheKey) !== row) return;
        row.resolved = value;
        row.hasResolved = true;
        row.expiresAt = Date.now() + freshTtl;
        row.staleExpiresAt = Date.now() + staleTtl;
      },
      () => {
        if (jsonRequestCache.get(cacheKey) === row && !row.hasResolved) {
          jsonRequestCache.delete(cacheKey);
        }
      },
    );
  }
  return waitWithSignal(promise, init.signal);
}

function refreshJsonCache<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  options: MvFetchOptions,
  cacheKey: string,
  freshTtl: number,
  staleTtl: number,
) {
  const existing = jsonRequestCache.get(cacheKey);
  // Already refreshing
  if (existing && existing.expiresAt === null) return;

  const staleResolved = existing?.hasResolved ? existing.resolved : undefined;
  const requestInit = { ...init, signal: undefined };
  const promise = mvFetch(input, requestInit, options).then(async (response) => {
    try {
      return await response.json() as T;
    } catch {
      throw new MvApiError(mvT()("errors.api.serverInvalidResponse"), {
        status: response.status,
        kind: "server",
      });
    }
  });

  const row: JsonCacheRow = {
    expiresAt: null,
    staleExpiresAt: existing?.staleExpiresAt ?? Date.now() + staleTtl,
    promise,
    resolved: staleResolved,
    hasResolved: existing?.hasResolved ?? false,
  };
  jsonRequestCache.set(cacheKey, row);
  void promise.then(
    (value) => {
      if (jsonRequestCache.get(cacheKey) !== row) return;
      row.resolved = value;
      row.hasResolved = true;
      row.expiresAt = Date.now() + freshTtl;
      row.staleExpiresAt = Date.now() + staleTtl;
    },
    () => {
      // Keep serving previous stale value on background failure
      if (jsonRequestCache.get(cacheKey) !== row) return;
      if (row.hasResolved) {
        row.expiresAt = Date.now() + Math.min(12_000, freshTtl);
        return;
      }
      jsonRequestCache.delete(cacheKey);
    },
  );
}

export function peekMvApiCache<T>(cacheKey: string): T | null {
  const cached = jsonRequestCache.get(cacheKey);
  if (!cached?.hasResolved) return null;
  if (cached.staleExpiresAt <= Date.now()) return null;
  return cached.resolved as T;
}

export function seedMvApiCache<T>(cacheKey: string, value: T, ttlMs = 45_000, staleTtlMs?: number) {
  const freshTtl = Math.max(0, ttlMs);
  const staleTtl = Math.max(freshTtl, staleTtlMs ?? Math.max(freshTtl * 8, 5 * 60_000));
  const now = Date.now();
  jsonRequestCache.set(cacheKey, {
    expiresAt: now + freshTtl,
    staleExpiresAt: now + staleTtl,
    promise: Promise.resolve(value),
    resolved: value,
    hasResolved: true,
  });
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

export function mvErrorMessage(error: unknown, fallback?: string) {
  const resolvedFallback = fallback ?? mvT()("errors.api.unknown");
  if (isMvAbortError(error)) return resolvedFallback;
  return error instanceof Error && error.message.trim() ? error.message : resolvedFallback;
}
