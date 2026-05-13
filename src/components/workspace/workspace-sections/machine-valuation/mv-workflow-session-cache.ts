/**
 * تخزين مؤقت في sessionStorage لبيانات مسار التقرير خلال الجلسة فقط.
 * يقلل إعادة الجلب من الخادم عند التنقل بين الخطوات دون الإبقاء على بيانات قديمة بين الجلسات.
 */

const CACHE_VER = 1;

export const MV_WORKFLOW_SESSION = {
  projectSummary: (projectId: string) => `sv:mv:wf:v${CACHE_VER}:summary:${projectId}`,
  assetImageFiles: (projectId: string) => `sv:mv:wf:v${CACHE_VER}:asset-files:${projectId}`,
  previewPhotoFolders: (projectId: string) => `sv:mv:wf:v${CACHE_VER}:preview-folders:${projectId}`,
  valuationReportWorkspace: (projectId: string) => `sv:mv:wf:v${CACHE_VER}:valuation-report:${projectId}`,
} as const;

export function readMvWorkflowSessionJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeMvWorkflowSessionJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* تجاهل امتلاء التخزين */
  }
}

export function clearMvWorkflowSessionKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
