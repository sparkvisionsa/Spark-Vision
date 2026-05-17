/** الصفحة الرئيسية لجدول المشاريع — نقطة العودة بعد خطوات العمل */
export const MV_PROJECTS_TABLE_PATH = "/machine-valuation/projects";

export function mvAutoPdfDownloadStorageKey(projectId: string) {
  return `mv:auto-pdf-download:${projectId}`;
}
