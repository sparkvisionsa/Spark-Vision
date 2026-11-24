/**
 * Applying a report-data model to a project's report data.
 *
 * Rules (a report's data is never lost because of a model):
 * - The project keeps its own copy of the model (`reportDataModelSnapshot`),
 *   so deleting or editing the company model never empties the form.
 * - Fields that leave the model (the company removed them, or the user
 *   deliberately switched models) keep their values: a field holding a value
 *   becomes a project-owned field in the same section; only empty fields go.
 * - Switching back to a model re-adopts its fields with their previous values
 *   (field ids are stable).
 * - Applying the same model twice changes nothing (idempotent), so the page
 *   never loops or marks the report as edited for nothing.
 */
import {
  normalizeReportCustomFields,
  normalizeReportCustomSections,
  type MvReportCustomField,
  type MvReportCustomSection,
} from "./mv-report-custom-fields";
import {
  createReportDataModelSnapshot,
  isReportDataModelCustomField,
  normalizeReportDataModelSnapshot,
  type MvReportDataModel,
} from "./mv-report-data-models";
import type { MvProjectReportData } from "./types";

/** Sections that always exist in the report-data form (not stored as custom sections). */
export const MV_REPORT_DATA_BUILT_IN_SECTION_IDS: ReadonlySet<string> = new Set([
  "basic",
  "client",
  "finalValue",
  "basisPremise",
  "participants",
]);

const hasValue = (value: string | undefined) => typeof value === "string" && value.trim().length > 0;

export function applyReportDataModel(
  current: MvProjectReportData,
  model: MvReportDataModel,
): MvProjectReportData {
  const currentFields = normalizeReportCustomFields(current.customFields);
  const currentSections = normalizeReportCustomSections(current.customSections);
  const previousById = new Map(currentFields.map((field) => [field.id, field]));

  const modelFields = model.sections
    .flatMap((section) =>
      section.fields
        .filter(isReportDataModelCustomField)
        .map((field) => ({ sectionId: section.id, field, id: field.sourceKey.slice("field:".length).trim() })),
    )
    .filter(({ id }) => id.length > 0);
  const modelFieldIds = new Set(modelFields.map(({ id }) => id));

  const generatedFields: MvReportCustomField[] = modelFields.map(({ sectionId, field, id }) => ({
    id,
    sectionId,
    modelId: model.id,
    label: field.label,
    type: field.type,
    required: field.required,
    value: previousById.get(id)?.value ?? "",
  }));

  const keptFields: MvReportCustomField[] = currentFields.flatMap((field) => {
    if (modelFieldIds.has(field.id)) return [];
    if (!field.modelId) return [field];
    if (!hasValue(field.value)) return [];
    // The value outlives the model: keep it as the project's own field.
    const { modelId: _modelId, ...own } = field;
    return [own];
  });

  const modelSections: MvReportCustomSection[] = model.sections
    .filter((section) => !MV_REPORT_DATA_BUILT_IN_SECTION_IDS.has(section.id))
    .map((section) => ({ id: section.id, title: section.title, modelId: model.id }));
  const modelSectionIds = new Set(modelSections.map((section) => section.id));
  const sectionsInUse = new Set(keptFields.map((field) => field.sectionId));

  const keptSections: MvReportCustomSection[] = currentSections.flatMap((section) => {
    if (modelSectionIds.has(section.id)) return [];
    if (!section.modelId) return [section];
    if (!sectionsInUse.has(section.id)) return [];
    const { modelId: _modelId, ...own } = section;
    return [own];
  });

  return {
    ...current,
    reportDataModelId: model.id,
    reportDataModelSnapshot: createReportDataModelSnapshot(model),
    customFields: [...keptFields, ...generatedFields],
    customSections: [...keptSections, ...modelSections],
  };
}

function modelState(data: MvProjectReportData) {
  return JSON.stringify([
    data.reportDataModelId ?? "",
    normalizeReportDataModelSnapshot(data.reportDataModelSnapshot),
    normalizeReportCustomFields(data.customFields),
    normalizeReportCustomSections(data.customSections),
  ]);
}

export function reportDataNeedsModelMaterialization(
  data: MvProjectReportData,
  model: MvReportDataModel,
): boolean {
  return modelState(data) !== modelState(applyReportDataModel(data, model));
}

/**
 * Data a user typed on the report-data page. A project that already holds
 * any of it is an existing report: it is never asked to pick a model again.
 * (The reference number and the standard definitions are filled by the
 * system at creation time and therefore do not count.)
 */
export function reportDataHasUserInput(data: MvProjectReportData | null | undefined): boolean {
  if (!data) return false;
  const text = (value: unknown) => typeof value === "string" && value.trim().length > 0;
  return Boolean(
    text(data.reportTitle) ||
      text(data.valuationMethod) ||
      text(data.valuationPurpose) ||
      text(data.valuePremise) ||
      text(data.valuationBasis) ||
      text(data.reportTypeLabel) ||
      text(data.reportIssueDate) ||
      text(data.inspectionDate) ||
      text(data.valuationDate) ||
      text(data.intendedUse) ||
      text(data.intendedUsers) ||
      text(data.clientActivity) ||
      (typeof data.finalValue === "number" && Number.isFinite(data.finalValue)) ||
      (Array.isArray(data.customFields) && data.customFields.length > 0) ||
      (Array.isArray(data.customSections) && data.customSections.length > 0),
  );
}
