/**
 * Limits parallel requests and retries on 429 so MV API throttles are not tripped
 * when loading many subprojects.
 */

function abortReason(signal: AbortSignal): unknown {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException("The operation was aborted.", "AbortError");
}

function waitForRetry(ms: number, signal?: AbortSignal | null): Promise<void> {
  if (!signal) return new Promise((resolve) => setTimeout(resolve, ms));
  if (signal.aborted) return Promise.reject(abortReason(signal));
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timeout);
      cleanup();
      reject(abortReason(signal));
    };
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function timeoutError() {
  const error = new Error("استغرق الخادم وقتًا أطول من المتوقع.");
  error.name = "TimeoutError";
  return error;
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { maxRetries?: number; timeoutMs?: number },
): Promise<Response> {
  const maxRetries = Math.max(1, options?.maxRetries ?? 6);
  const timeoutMs = Math.max(1000, options?.timeoutMs ?? 25_000);
  let last: Response | undefined;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    if (init?.signal?.aborted) throw abortReason(init.signal);
    const controller = new AbortController();
    let timedOut = false;
    const abort = () => controller.abort(init?.signal?.reason);
    init?.signal?.addEventListener("abort", abort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const r = await fetch(input, { ...init, credentials: init?.credentials ?? "include", signal: controller.signal });
      last = r;
      const retryable = r.status === 408 || r.status === 425 || r.status === 429 || r.status >= 500;
      if (!retryable || attempt === maxRetries - 1) return r;

      const ra = r.headers.get("Retry-After")?.trim();
      const numericSeconds = ra && Number.isFinite(Number(ra)) ? Number(ra) * 1000 : null;
      const dateDelay = ra && numericSeconds == null && Number.isFinite(Date.parse(ra))
        ? Math.max(0, Date.parse(ra) - Date.now())
        : null;
      const backoff = 450 * 2 ** attempt + Math.floor(Math.random() * 160);
      const waitMs = Math.min(12_000, Math.max(250, numericSeconds ?? dateDelay ?? backoff));
      await waitForRetry(waitMs, init?.signal);
    } catch (error) {
      if (init?.signal?.aborted) throw error;
      lastError = timedOut ? timeoutError() : error;
      if (attempt === maxRetries - 1) throw lastError;
      await waitForRetry(timedOut ? 300 : 450 * (attempt + 1), init?.signal);
    } finally {
      clearTimeout(timeout);
      init?.signal?.removeEventListener("abort", abort);
    }
  }
  if (last) return last;
  throw lastError instanceof Error ? lastError : new Error("تعذر الاتصال بالخادم.");
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Math.min(Math.max(1, concurrency), items.length);

  const runWorker = async () => {
    while (true) {
      const i = next;
      next += 1;
      if (i >= items.length) break;
      results[i] = await fn(items[i]!, i);
    }
  };

  await Promise.all(Array.from({ length: workers }, runWorker));
  return results;
}
