/**
 * تحميل مسبق لمقاطع خطوات المشروع بعد استقرار الصفحة الحالية،
 * حتى لا ينافس تجميع الصفحة الظاهرة (مثل لوحة الشركة) ويسبب ChunkLoadError.
 */
const preloaders: Array<() => Promise<unknown>> = [
  () => import("./mv-workflow-shell"),
  () => import("./mv-report-data-workspace"),
  () => import("./mv-asset-images-hub"),
  () => import("./mv-valuation-shell"),
  () => import("./mv-client-files-shell"),
  () => import("./mv-final-report-workspace"),
  () => import("./mv-valuation-report-workspace"),
  () => import("./mv-asset-data-workspace"),
  () => import("./mv-valuation-accounting-workspace"),
  () => import("./mv-client-files-workspace"),
];

const SKIP_SEGMENTS = new Set([
  "company",
  "settings",
  "clients",
  "projects",
  "dashboard",
  "support",
  "developer-requests",
  "report-settings",
]);

let started = false;

export function shouldPrefetchMvWorkflowChunks(pathname: string) {
  if (pathname.includes("/workflow/")) return true;
  const match = pathname.match(/\/machine-valuation\/([^/?#]+)/);
  const segment = match?.[1];
  if (!segment || SKIP_SEGMENTS.has(segment)) return false;
  return true;
}

async function runPreloaders() {
  for (const load of preloaders) {
    try {
      await load();
    } catch {
      /* تجاهل فشل التحميل المسبق — التنقل سيعيد المحاولة */
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
}

export function prefetchMvWorkflowChunks(options?: { eager?: boolean }) {
  if (typeof window === "undefined") return;
  if (started) return;
  started = true;
  const start = () => {
    void runPreloaders();
  };
  if (options?.eager) {
    window.setTimeout(start, 1600);
    return;
  }
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(start, { timeout: 4000 });
    return;
  }
  window.setTimeout(start, 800);
}
