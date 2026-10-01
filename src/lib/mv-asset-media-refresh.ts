/** Fallback for missed socket events, external database writers and standalone MongoDB. */
export function watchAssetMediaRevision(projectId: string, refresh: () => Promise<unknown>, intervalMs = 5000) {
  let stopped = false;
  let revision: string | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;
  let controller: AbortController | undefined;
  const check = async () => {
    if (stopped || inFlight) return;
    if (timer) clearTimeout(timer);
    inFlight = true;
    try {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 15_000);
      try {
        const response = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}/asset-media-revision`, {
          credentials: "include", cache: "no-store", signal: controller.signal,
        });
        if (!response.ok) return;
        const data = await response.json();
        if (stopped || typeof data.revision !== "string") return;
        if (data.revision !== revision) {
          const refreshed = await refresh();
          if (!stopped && refreshed !== false) revision = data.revision;
        }
      } finally { clearTimeout(timeout); }
    } catch { /* Keep the previous revision so reconnecting retries the missed change. */ }
    finally {
      inFlight = false;
      if (!stopped) timer = setTimeout(check, intervalMs);
    }
  };
  const resume = () => { void check(); };
  window.addEventListener("online", resume);
  document.addEventListener("visibilitychange", resume);
  void check();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    controller?.abort();
    window.removeEventListener("online", resume);
    document.removeEventListener("visibilitychange", resume);
  };
}
