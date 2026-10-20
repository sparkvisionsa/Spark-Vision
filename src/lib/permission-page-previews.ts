import type { ValueTechProductId } from "./value-tech-products";
import { mvAr } from "../components/workspace/workspace-sections/machine-valuation/mv-i18n/locales/ar";

export type PermissionPreviewDestination = {
  id: string;
  label: string;
  /** Internal product path. `:projectId` is replaced with the real preview project id. */
  path: string;
};

const nav = mvAr.navigation;
const settings = mvAr.settingsHub;
const destination = (id: string, label: string, path: string): PermissionPreviewDestination => ({ id, label, path });

/** Real application routes only. Mock screens and mock page markup do not belong here. */
const DESTINATIONS: Partial<Record<ValueTechProductId, Record<string, PermissionPreviewDestination[]>>> = {
  "machine-valuation": {
    projects: [destination("projects", nav.projects, "/machine-valuation/projects")],
    project_workflow: [destination("report-data", nav.simpleReportSteps.reportData, "/machine-valuation/:projectId/workflow/report-data")],
    asset_data: [destination("asset-data", nav.projectFolders.assetData, "/machine-valuation/:projectId/workflow/import")],
    asset_media: [
      destination("assets", nav.simpleReportSteps.assetImages, "/machine-valuation/:projectId/workflow/asset-images"),
      destination("attachments", nav.simpleReportSteps.reportFiles, "/machine-valuation/:projectId/workflow/files"),
      destination("client-files", nav.simpleReportSteps.clientFiles, "/machine-valuation/:projectId/workflow/client-files"),
      destination("certificate", nav.simpleReportSteps.certificate, "/machine-valuation/:projectId/workflow/certificate"),
      destination("inspector-files", nav.projectFolders.inspectorFiles, "/machine-valuation/:projectId/inspector-files"),
      destination("project-files", nav.projectFolders.openFilesShort, "/machine-valuation/:projectId/files"),
    ],
    valuation: [destination("valuation", nav.simpleReportSteps.valuationAccounts, "/machine-valuation/:projectId/workflow/valuation")],
    reports: [destination("report", nav.simpleReportSteps.finalReport, "/machine-valuation/:projectId/workflow/final-report")],
    data_extraction: [destination("extraction", nav.dataExtraction, "/machine-valuation/data-extraction")],
    clients: [destination("clients", nav.clients, "/machine-valuation/clients")],
    settings_company: [destination("company", settings.tabs.companyInfo, "/machine-valuation/settings/general/info")],
    settings_users: [destination("users", settings.tabs.companyUsers, "/machine-valuation/settings/general/users")],
    settings_permissions: [destination("permissions", settings.tabs.permissions, "/machine-valuation/settings/general/permissions")],
    settings_assets: [destination("classifications", settings.tabs.assetDescriptions, "/machine-valuation/settings/general/asset-descriptions")],
    settings_reports: [
      destination("data-models", settings.tabs.reportDataModels, "/machine-valuation/settings/report/report-data-models"),
      destination("word", settings.tabs.wordTemplates, "/machine-valuation/settings/report/word-template"),
      destination("pptx", settings.tabs.pptxTemplates, "/machine-valuation/settings/report/pptx-template"),
      destination("letterhead", settings.tabs.letterhead, "/machine-valuation/settings/report/letterhead"),
    ],
    settings_serial: [destination("serial", settings.serialNumbering, "/machine-valuation/settings/serial-numbering/reference")],
    support: [destination("support", nav.support, "/machine-valuation/support")],
  },
  "real-estate-valuation": {
    transactions: [destination("transactions", "لوحة المعاملات", "/real-estate-valuation")],
    valuation: [destination("valuation", "تفاصيل التقييم", "/real-estate-valuation")],
    property_media: [destination("property-media", "الصور والمرفقات", "/real-estate-valuation")],
    reports: [destination("property-report", "التقرير النهائي", "/real-estate-valuation")],
    clients: [destination("clients", "العملاء", "/clients")],
    support: [destination("support", "الدعم والتذاكر", "/real-estate-valuation/support")],
  },
};

export function permissionPreviewScreens(productId: ValueTechProductId, pageKey: string): PermissionPreviewDestination[] {
  return DESTINATIONS[productId]?.[pageKey] ?? [];
}

export function permissionPreviewWorkspaceUrl(path: string, projectId?: string): string | null {
  if (path.includes(":projectId") && !projectId) return null;
  const resolved = path.replace(":projectId", encodeURIComponent(projectId ?? ""));
  const separator = resolved.includes("?") ? "&" : "?";
  // Keep the public URL in the browser. Middleware rewrites it internally to `/w/...`;
  // using `/w` directly would make the machine workspace parse the wrong pathname.
  return `${resolved}${separator}permissionPreview=1`;
}
