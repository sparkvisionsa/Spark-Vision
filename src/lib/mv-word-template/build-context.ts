import type { MvProjectReportData } from "@/components/workspace/workspace-sections/machine-valuation/types";
import type { MvWordBookmarkTextField } from "./bookmarks";

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
};

function hasMergeValue(value: unknown): value is string | number {
  if (value == null) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim().length > 0;
  return false;
}

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
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(amount);
}

function formatFinalValue(value: unknown, _currency?: string | null) {
  // القالب يحتوي عادة على «ر.س.» بجانب إشارة «قيمة» — نملأ الرقم فقط لتفادي التكرار
  return formatFinalValueAmount(value);
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

/** قيم الحقول النصية المرتبطة بالإشارات المرجعية */
export function buildBookmarkTextValues(input: MvWordMergeInput): Record<MvWordBookmarkTextField, string> {
  const { reportData, projectName } = input;

  const values: Record<MvWordBookmarkTextField, string> = {
    reportTitle: reportData.reportTitle?.trim() || projectName?.trim() || "",
    clientName: reportData.clientName?.trim() || "",
    clientIdentity: buildClientIdentity(reportData),
    valuationBasis: reportData.valuationBasis?.trim() ?? "",
    valuationPurpose: reportData.valuationPurpose?.trim() ?? "",
    agreementDate: formatDateAr(reportData.agreementDate),
    reportIssueDate: formatDateAr(reportData.reportIssueDate),
    valuationDate: formatDateAr(reportData.valuationDate),
    inspectionDate: formatDateAr(reportData.inspectionDate),
    valuePremise: reportData.valuePremise?.trim() ?? "",
    finalValue: formatFinalValue(reportData.finalValue, reportData.currencyLabel),
    finalValueAmount: formatFinalValueAmount(reportData.finalValue),
    finalValueWords: reportData.finalValueWords?.trim() ?? "",
    inspectionLocation: reportData.inspectionLocation?.trim() ?? "",
    inspectionMapUrl: reportData.inspectionMapUrl?.trim() ?? "",
  };

  for (const [key, value] of Object.entries(reportData.reportTextOverrides ?? {})) {
    if (!value?.trim()) continue;
    if (key in values) {
      (values as Record<string, string>)[key] = value.trim();
    }
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

/** @deprecated استخدم buildBookmarkTextValues */
export function buildScalarMergeValues(input: MvWordMergeInput): Record<string, string> {
  return buildBookmarkTextValues(input) as unknown as Record<string, string>;
}
