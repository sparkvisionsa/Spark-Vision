import type { MvProjectReportData } from "./types";
import {
  createReportCustomId,
  MV_REPORT_CUSTOM_FIELD_LIMIT,
  MV_REPORT_CUSTOM_SECTION_LIMIT,
  MV_REPORT_CUSTOM_VALUE_MAX_LENGTH,
  normalizeReportCustomFields,
  normalizeReportCustomSections,
  type MvReportCustomField,
  type MvReportCustomFieldType,
} from "./mv-report-custom-fields";

export type MvImportedExtractionField = {
  id?: string;
  label: string;
  value: string;
  category?: string;
  section?: string;
  row?: number;
  page?: number;
};

export type MvImportedExtractionDocument = {
  id: string;
  fileName: string;
  documentType?: string;
  status: "completed" | "empty" | "error";
  fields: MvImportedExtractionField[];
  message?: string;
};

function inferImportedFieldType(field: MvImportedExtractionField): MvReportCustomFieldType {
  const value = field.value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && field.category === "date") return "date";
  if (field.category === "financial" && /^-?\d+(?:\.\d+)?$/.test(value)) return "number";
  if (value.includes("\n") || value.length > 160) return "textarea";
  return "text";
}

function importedLabels(fields: MvImportedExtractionField[]) {
  const totalByLabel = new Map<string, number>();
  for (const field of fields) {
    const key = field.label.trim().toLocaleLowerCase();
    totalByLabel.set(key, (totalByLabel.get(key) ?? 0) + 1);
  }
  const used = new Map<string, number>();
  return fields.map((field) => {
    const clean = field.label.trim();
    const key = clean.toLocaleLowerCase();
    const occurrence = (used.get(key) ?? 0) + 1;
    used.set(key, occurrence);
    if ((totalByLabel.get(key) ?? 0) <= 1) return clean;
    const context = field.section?.trim();
    return `${clean} (${context || occurrence})`.slice(0, 180);
  });
}

export function mergeExtractedFieldsIntoReportData(
  current: MvProjectReportData | undefined,
  sourceFields: MvImportedExtractionField[],
  sectionTitle: string,
  idFactory: (prefix: string) => string = createReportCustomId,
) {
  const existingFields = normalizeReportCustomFields(current?.customFields);
  const existingSections = normalizeReportCustomSections(current?.customSections);
  if (existingSections.length >= MV_REPORT_CUSTOM_SECTION_LIMIT) {
    return { reportData: current ?? {}, importedCount: 0, skippedCount: sourceFields.length, reason: "section-limit" as const };
  }

  const usable = sourceFields.filter(field => field.label.trim() && field.value.trim());
  const available = Math.max(0, MV_REPORT_CUSTOM_FIELD_LIMIT - existingFields.length);
  if (available === 0) {
    return { reportData: current ?? {}, importedCount: 0, skippedCount: usable.length, reason: "field-limit" as const };
  }

  const selected = usable.slice(0, available);
  const labels = importedLabels(selected);
  const sectionId = idFactory("imported-section");
  const importedFields: MvReportCustomField[] = selected.map((field, index) => ({
    id: idFactory("imported-field"),
    sectionId,
    label: labels[index]!.slice(0, 180),
    type: inferImportedFieldType(field),
    required: false,
    value: field.value.slice(0, MV_REPORT_CUSTOM_VALUE_MAX_LENGTH),
  }));

  return {
    reportData: {
      ...(current ?? {}),
      customSections: [...existingSections, { id: sectionId, title: sectionTitle.trim().slice(0, 180) }],
      customFields: [...existingFields, ...importedFields],
    },
    importedCount: importedFields.length,
    skippedCount: Math.max(0, usable.length - importedFields.length),
    sectionId,
  };
}

