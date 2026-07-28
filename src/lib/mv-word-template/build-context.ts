import type { MvProjectReportData } from "@/components/workspace/workspace-sections/machine-valuation/types";

export type MvWordMergeImageItem = {
  image: ArrayBuffer;
  caption?: string;
  width?: number;
  height?: number;
};

export type MvWordMergeInput = {
  projectName: string;
  displayNumber?: number | null;
  reportData: MvProjectReportData;
  assetImages: MvWordMergeImageItem[];
  valuationImages: MvWordMergeImageItem[];
  clientImages: MvWordMergeImageItem[];
};

export type MvWordTemplateVariableValues = Record<string, string>;

function formatDateAr(value?: unknown) {
  if (value == null) return "";
  const raw = typeof value === "string" ? value.trim() : "";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date =
    value instanceof Date
      ? value
      : typeof value === "number"
        ? new Date(value)
        : iso
          ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
          : new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function coerceFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const normalized = value
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[^\d.-]/g, "");
  if (!normalized.trim()) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatFinalValueAmount(value: unknown): string {
  const amount = coerceFiniteNumber(value);
  if (amount == null) return "";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(amount);
}

function formatFinalValue(value: unknown) {
  return formatFinalValueAmount(value);
}

function formatFinalValueOpinion(reportData: MvProjectReportData): string {
  const amount = formatFinalValueAmount(reportData.finalValue);
  const words = reportData.finalValueWords?.trim() ?? "";
  if (!amount) return words;

  const numericValue = `(${amount} ر.س)`;
  return words ? `${numericValue}${words}` : numericValue;
}

function buildClientIdentity(reportData: MvProjectReportData): string {
  const parts = [
    reportData.clientLegalType?.trim(),
    reportData.clientRepresentativeName?.trim(),
    reportData.clientRepresentativeRole?.trim(),
    reportData.intendedUsers?.trim(),
  ].filter(Boolean);
  return parts.join(" — ");
}

/** القيم الحالية التي يستبدل بها الخادم متغيرات « » أو << >> داخل القالب المضمّن. */
export function buildTemplateVariableValues(
  input: MvWordMergeInput,
): MvWordTemplateVariableValues {
  const { reportData, projectName, displayNumber } = input;
  const text = (value: unknown): string =>
    typeof value === "string" ? value.trim() : "";

  const values: MvWordTemplateVariableValues = {
    projectName: projectName.trim(),
    displayNumber:
      typeof displayNumber === "number" && Number.isFinite(displayNumber)
        ? String(displayNumber)
        : "",
    reportTitle: reportData.reportTitle?.trim() || projectName?.trim() || "",
    reportReference:
      reportData.reportReference?.trim() ||
      (typeof displayNumber === "number" && Number.isFinite(displayNumber)
        ? String(displayNumber)
        : ""),
    clientName: reportData.clientName?.trim() || "",
    clientId: text(reportData.clientId),
    clientEmail: text(reportData.clientEmail),
    clientPhone: text(reportData.clientPhone),
    clientLegalType: text(reportData.clientLegalType),
    clientIdentity: buildClientIdentity(reportData),
    clientActivity: reportData.clientActivity?.trim() || "",
    clientRepresentativeName: reportData.clientRepresentativeName?.trim() || "",
    clientRepresentativeRole: reportData.clientRepresentativeRole?.trim() || "",
    intendedUsers: reportData.intendedUsers?.trim() || "",
    intendedUse: text(reportData.intendedUse),
    assetSingularPlural: reportData.assetSingularPlural?.trim() || "",
    assetSubjectDescription: reportData.assetSubjectDescription?.trim() || "",
    assetDetailedDescription: text(reportData.assetDetailedDescription),
    valuationMethod: reportData.valuationMethod?.trim() ?? "",
    valuationBasis: reportData.valuationBasis?.trim() ?? "",
    valuationBasisDefinition: reportData.valuationBasisDefinition?.trim() ?? "",
    valuationPurpose: reportData.valuationPurpose?.trim() ?? "",
    reportTypeLabel: text(reportData.reportTypeLabel),
    standardsVersion: text(reportData.standardsVersion),
    currencyLabel: text(reportData.currencyLabel),
    agreementDate: formatDateAr(reportData.agreementDate),
    reportIssueDate: formatDateAr(reportData.reportIssueDate),
    valuationDate: formatDateAr(reportData.valuationDate),
    inspectionDate: formatDateAr(reportData.inspectionDate),
    valuePremise: reportData.valuePremise?.trim() ?? "",
    valuePremiseDefinition: reportData.valuePremiseDefinition?.trim() ?? "",
    finalValue: formatFinalValue(reportData.finalValue),
    finalValueAmount: formatFinalValueAmount(reportData.finalValue),
    finalValueWords: reportData.finalValueWords?.trim() ?? "",
    finalValueOpinion: formatFinalValueOpinion(reportData),
    inspectionLocation: reportData.inspectionLocation?.trim() ?? "",
    inspectionMapUrl: reportData.inspectionMapUrl?.trim() ?? "",
    valuationFirmName: text(reportData.valuationFirmName),
    valuationFirmLicense: text(reportData.valuationFirmLicense),
    valuationFirmAddress: text(reportData.valuationFirmAddress),
    leadValuerName: text(reportData.leadValuerName),
    leadValuerTitle: text(reportData.leadValuerTitle),
    leadValuerMembershipNo: text(reportData.leadValuerMembershipNo),
    scopeOfWorkDetails: text(reportData.scopeOfWorkDetails),
    useRestriction: text(reportData.useRestriction),
    externalSpecialistUse: text(reportData.externalSpecialistUse),
    esgConsiderations: text(reportData.esgConsiderations),
    informationSources: text(reportData.informationSources),
    methodologyRationale: text(reportData.methodologyRationale),
    costApproachDetails: text(reportData.costApproachDetails),
    importantAssumptions: text(reportData.importantAssumptions),
    generalAssumptions: text(reportData.generalAssumptions),
    specialAssumptions: text(reportData.specialAssumptions),
  };

  for (const [key, value] of Object.entries(reportData.reportTextOverrides ?? {})) {
    values[key] = typeof value === "string" ? value.trim() : "";
  }

  return values;
}

export function buildImageLoopData(images: MvWordMergeImageItem[]) {
  return images.map((item) => ({
    caption: item.caption ?? "",
    image: item.image,
    width: item.width,
    height: item.height,
  }));
}

/** @deprecated استخدم buildTemplateVariableValues */
export function buildScalarMergeValues(input: MvWordMergeInput): Record<string, string> {
  return buildTemplateVariableValues(input);
}
