/**
 * تحميل مسبق لمقاطع خطوات المشروع المبسط حتى لا ينتظر المستخدم
 * تنزيل/تحليل الحزمة عند كل تنقل بين التبويبات.
 */
const preloaders: Array<() => Promise<unknown>> = [
  () => import("./mv-workflow-shell"),
  () => import("./mv-report-data-workspace"),
  () => import("./mv-asset-images-hub"),
  () => import("./mv-valuation-shell"),
  () => import("./mv-client-files-shell"),
  () => import("./mv-valuation-report-workspace"),
  () => import("./mv-asset-data-workspace"),
  () => import("./mv-valuation-accounting-workspace"),
  () => import("./mv-client-files-workspace"),
];

let started = false;
let eagerStarted = false;

function runPreloaders() {
  for (const load of preloaders) {
    void load().catch(() => {
      /* تجاهل فشل التحميل المسبق — التنقل سيعيد المحاولة */
    });
  }
}

export function prefetchMvWorkflowChunks(options?: { eager?: boolean }) {
  if (typeof window === "undefined") return;

  if (options?.eager) {
    if (eagerStarted) return;
    eagerStarted = true;
    started = true;
    // فوري: أهم لتحسين زمن التنقل بين التبويبات
    runPreloaders();
    return;
  }

  if (started) return;
  started = true;
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => runPreloaders(), { timeout: 1800 });
  } else {
    window.setTimeout(runPreloaders, 200);
  }
}
