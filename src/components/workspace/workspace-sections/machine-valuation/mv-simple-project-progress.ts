import type { MvProjectReportData } from "./types";

export type MvSimpleReportStepId =
  | "report-data"
  | "asset-images"
  | "valuation-actions"
  | "client-files"
  | "report-preview";

export const MV_SIMPLE_REPORT_STEP_COUNT = 5;

/** حقول «بيانات التقرير» الأساسية — يجب اكتمالها لاعتبار الخطوة منتهية (✓). */
const SIMPLE_REPORT_DATA_REQUIRED_FIELDS = [
  "valuationMethod",
  "valuationPurpose",
  "valuePremise",
  "valuationBasis",
  "reportTitle",
  "reportIssueDate",
  "inspectionDate",
  "valuationDate",
  "inspectionLocation",
  "clientName",
] as const satisfies readonly (keyof MvProjectReportData)[];

function isReportFieldFilled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function hasMeaningfulSimpleReportData(
  data: MvProjectReportData | undefined | null,
): boolean {
  if (!data) return false;
  return Boolean(
    data.valuationMethod ||
      data.reportReference ||
      data.reportTitle ||
      data.valuationPurpose ||
      data.valuePremise ||
      data.valuationBasis ||
      data.reportIssueDate ||
      data.agreementDate ||
      data.inspectionDate ||
      data.valuationDate ||
      data.clientName ||
      data.clientEmail ||
      data.clientPhone ||
      data.clientLegalType ||
      data.clientActivity ||
      data.clientRepresentativeName ||
      data.intendedUsers ||
      data.intendedUse ||
      data.inspectionLocation ||
      data.inspectionMapUrl ||
      data.finalValue != null,
  );
}

/** بيانات التقرير: الحقول الأساسية مكتملة. */
export function isSimpleReportDataStepComplete(
  data: MvProjectReportData | undefined | null,
): boolean {
  if (!data) return false;
  return SIMPLE_REPORT_DATA_REQUIRED_FIELDS.every((key) => isReportFieldFilled(data[key]));
}

/** صور الأصول: توجد صور في مجلدات/أصول المشروع. */
export function isAssetImagesStepComplete(assetImageCount: number): boolean {
  return assetImageCount > 0;
}

/** إجراءات التقييم: صورة حسابات قيمة واحدة على الأقل (أي تاب من الثلاثة). */
export function isValuationActionsStepComplete(valuationAccountImageCount: number): boolean {
  return valuationAccountImageCount > 0;
}

/** ملفات العميل: صورة مستند واحدة على الأقل. */
export function isClientFilesStepComplete(clientDocumentImageCount: number): boolean {
  return clientDocumentImageCount > 0;
}

/** إعداد التقرير: زيارة الخطوة مع بيانات مكتملة، أو قالب/قيمة نهائية محفوظة. */
export function isReportPreviewStepComplete(
  data: MvProjectReportData | undefined | null,
  options?: { visitedReportPreview?: boolean },
): boolean {
  if (data?.finalValue != null && Number.isFinite(Number(data.finalValue))) return true;
  if (isReportFieldFilled(data?.reportTemplateId)) return true;
  if (options?.visitedReportPreview && isSimpleReportDataStepComplete(data)) return true;
  return false;
}

export type MvSimpleStepCompletionInput = {
  reportData?: MvProjectReportData | null;
  assetImageCount?: number;
  valuationAccountImageCount?: number;
  clientDocumentImageCount?: number;
  visitedReportPreview?: boolean;
};

export function computeCompletedSimpleReportSteps(
  input: MvSimpleStepCompletionInput,
): MvSimpleReportStepId[] {
  const done: MvSimpleReportStepId[] = [];

  if (isSimpleReportDataStepComplete(input.reportData)) {
    done.push("report-data");
  }
  if (isAssetImagesStepComplete(input.assetImageCount ?? 0)) {
    done.push("asset-images");
  }
  if (isValuationActionsStepComplete(input.valuationAccountImageCount ?? 0)) {
    done.push("valuation-actions");
  }
  if (isClientFilesStepComplete(input.clientDocumentImageCount ?? 0)) {
    done.push("client-files");
  }
  if (isReportPreviewStepComplete(input.reportData, {
    visitedReportPreview: input.visitedReportPreview,
  })) {
    done.push("report-preview");
  }

  return done;
}

export function computeSimpleProjectProgressPct(input: MvSimpleStepCompletionInput): number {
  const completed = computeCompletedSimpleReportSteps(input).length;
  return Math.round((completed / MV_SIMPLE_REPORT_STEP_COUNT) * 100);
}

export function projectProgressPctFromProject(project: {
  progressPct?: number;
  reportData?: MvProjectReportData | null;
  assetImageCount?: number;
  picAssetCount?: number;
  valuationAccountImageCount?: number;
  clientDocumentImageCount?: number;
  valuationAccountingWorkspace?: { images?: unknown[] } | null;
  clientDocumentsWorkspace?: { images?: unknown[] } | null;
}): number {
  if (typeof project.progressPct === "number" && Number.isFinite(project.progressPct)) {
    return Math.max(0, Math.min(100, Math.round(project.progressPct)));
  }

  const valuationAccountImageCount =
    project.valuationAccountImageCount ??
    (Array.isArray(project.valuationAccountingWorkspace?.images)
      ? project.valuationAccountingWorkspace.images.length
      : 0);
  const clientDocumentImageCount =
    project.clientDocumentImageCount ??
    (Array.isArray(project.clientDocumentsWorkspace?.images)
      ? project.clientDocumentsWorkspace.images.length
      : 0);

  return computeSimpleProjectProgressPct({
    reportData: project.reportData,
    assetImageCount: project.assetImageCount,
    valuationAccountImageCount,
    clientDocumentImageCount,
  });
}

/** عدد مجلدات الأصول داخل «صور الأصول» (pic assets). */
export function projectAssetFolderCount(project: {
  picAssetCount?: number;
}): number {
  const count = project.picAssetCount ?? 0;
  return Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0;
}
