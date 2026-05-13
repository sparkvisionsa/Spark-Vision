/**
 * Limits parallel requests and retries on 429 so MV API throttles are not tripped
 * when loading many subprojects.
 */

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { maxRetries?: number },
): Promise<Response> {
  const maxRetries = options?.maxRetries ?? 6;
  let last: Response | undefined;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const r = await fetch(input, init);
    last = r;
    if (r.status !== 429) return r;
    const ra = r.headers.get("Retry-After");
    const fromHeader =
      ra != null && ra.trim() !== "" && !Number.isNaN(Number(ra)) ? Number(ra) * 1000 : null;
    const backoff = 450 * 2 ** attempt;
    const waitMs = Math.min(12000, Math.max(250, fromHeader ?? backoff));
    await new Promise((res) => setTimeout(res, waitMs));
  }
  return last!;
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
