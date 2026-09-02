export const MV_REPORT_CUSTOM_FIELD_TYPES = ["text", "textarea", "number", "date"] as const;

/** Keep the client limits aligned with the report-data sanitizer on the API. */
export const MV_REPORT_CUSTOM_FIELD_LIMIT = 80;
export const MV_REPORT_CUSTOM_SECTION_LIMIT = 30;
export const MV_REPORT_CUSTOM_ID_MAX_LENGTH = 120;
export const MV_REPORT_CUSTOM_LABEL_MAX_LENGTH = 180;
export const MV_REPORT_CUSTOM_VALUE_MAX_LENGTH = 4_000;

export type MvReportCustomFieldType = (typeof MV_REPORT_CUSTOM_FIELD_TYPES)[number];

export interface MvReportCustomField {
  id: string;
  sectionId: string;
  /** Set for fields inherited from a company report-data model. */
  modelId?: string;
  label: string;
  type: MvReportCustomFieldType;
  required: boolean;
  value?: string;
}

export interface MvReportCustomSection {
  id: string;
  /** Set for sections inherited from a company report-data model. */
  modelId?: string;
  title: string;
}

export function isReportCustomFieldType(value: unknown): value is MvReportCustomFieldType {
  return (
    typeof value === "string" &&
    (MV_REPORT_CUSTOM_FIELD_TYPES as readonly string[]).includes(value)
  );
}

export function createReportCustomId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${rand}`;
}

export function normalizeReportCustomFields(value: unknown): MvReportCustomField[] {
  if (!Array.isArray(value)) return [];
  const out: MvReportCustomField[] = [];
  for (const item of value.slice(0, MV_REPORT_CUSTOM_FIELD_LIMIT)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const id =
      typeof row.id === "string" ? row.id.trim().slice(0, MV_REPORT_CUSTOM_ID_MAX_LENGTH) : "";
    const sectionId =
      typeof row.sectionId === "string"
        ? row.sectionId.trim().slice(0, MV_REPORT_CUSTOM_ID_MAX_LENGTH)
        : "";
    const label =
      typeof row.label === "string"
        ? row.label.trim().slice(0, MV_REPORT_CUSTOM_LABEL_MAX_LENGTH)
        : "";
    if (!id || !sectionId || !label) continue;
    const modelId =
      typeof row.modelId === "string"
        ? row.modelId.trim().slice(0, MV_REPORT_CUSTOM_ID_MAX_LENGTH)
        : "";
    out.push({
      id,
      sectionId,
      ...(modelId ? { modelId } : {}),
      label,
      type: isReportCustomFieldType(row.type) ? row.type : "text",
      required: row.required === true,
      value:
        typeof row.value === "string"
          ? row.value.slice(0, MV_REPORT_CUSTOM_VALUE_MAX_LENGTH)
          : "",
    });
  }
  return out;
}

export function normalizeReportCustomSections(value: unknown): MvReportCustomSection[] {
  if (!Array.isArray(value)) return [];
  const out: MvReportCustomSection[] = [];
  for (const item of value.slice(0, MV_REPORT_CUSTOM_SECTION_LIMIT)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const id =
      typeof row.id === "string" ? row.id.trim().slice(0, MV_REPORT_CUSTOM_ID_MAX_LENGTH) : "";
    const title =
      typeof row.title === "string"
        ? row.title.trim().slice(0, MV_REPORT_CUSTOM_LABEL_MAX_LENGTH)
        : "";
    if (!id || !title) continue;
    const modelId =
      typeof row.modelId === "string"
        ? row.modelId.trim().slice(0, MV_REPORT_CUSTOM_ID_MAX_LENGTH)
        : "";
    out.push({ id, ...(modelId ? { modelId } : {}), title });
  }
  return out;
}

export function customFieldsForSection(
  fields: MvReportCustomField[] | undefined,
  sectionId: string,
): MvReportCustomField[] {
  return (fields ?? []).filter((field) => field.sectionId === sectionId);
}

export function isCustomFieldValueMissing(field: MvReportCustomField): boolean {
  if (!field.required) return false;
  return !(typeof field.value === "string" && field.value.trim().length > 0);
}
