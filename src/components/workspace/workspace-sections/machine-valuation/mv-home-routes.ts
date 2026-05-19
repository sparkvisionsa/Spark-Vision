/** الصفحة الرئيسية لجدول المشاريع — نقطة العودة بعد خطوات العمل */
export const MV_PROJECTS_TABLE_PATH = "/machine-valuation/projects";

export function mvAutoPdfDownloadStorageKey(projectId: string) {
  return `mv:auto-pdf-download:${projectId}`;
}

/** تُرسل من صفحة إعداد التقرير داخل iframe إلى نافذة الأم (مثلاً جدول المشاريع) بعد انتهاء محاولة تصدير PDF */
export const MV_REPORT_PDF_PARENT_MESSAGE = "mv-report-pdf-export-finished" as const;

export function postReportPdfExportToParent(projectId: string, ok: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (window.parent !== window.self) {
      window.parent.postMessage(
        { type: MV_REPORT_PDF_PARENT_MESSAGE, projectId, ok },
        window.location.origin,
      );
    }
  } catch {
    /* ignore */
  }
}
