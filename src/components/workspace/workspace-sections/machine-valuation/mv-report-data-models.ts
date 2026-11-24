import {
  createReportCustomId,
  isReportCustomFieldType,
  type MvReportCustomFieldType,
} from "./mv-report-custom-fields";

/**
 * A report-data model is the company-owned catalogue behind the simple
 * project's report-data page.  System fields keep their existing source key;
 * fields added by a company get a stable `field:<id>` key that Word/PPTX can
 * safely merge as well.
 */
export type MvReportDataModelField = {
  id: string;
  label: string;
  sourceKey: string;
  type: MvReportCustomFieldType;
  required: boolean;
  system?: boolean;
};

export type MvReportDataModelSection = {
  id: string;
  title: string;
  fields: MvReportDataModelField[];
};

export type MvReportDataModel = {
  id: string;
  name: string;
  isDefault?: boolean;
  sections: MvReportDataModelSection[];
};

export const MV_DEFAULT_REPORT_DATA_MODEL_ID = "mv-report-model-individual";
export const MV_REPORT_DATA_MODEL_LIMIT = 12;
export const MV_REPORT_DATA_MODEL_SECTION_LIMIT = 30;
export const MV_REPORT_DATA_MODEL_FIELD_LIMIT = 120;

type SystemField = Omit<MvReportDataModelField, "id" | "system"> & { id?: string };

const system = (
  sourceKey: string,
  label: string,
  type: MvReportCustomFieldType = "text",
  required = false,
): SystemField => ({ sourceKey, label, type, required });

/** The same visible groups used in the simplified project's report-data page. */
const DEFAULT_SECTIONS: Array<{ id: string; title: string; fields: SystemField[] }> = [
  {
    id: "basic",
    title: "البيانات الأساسية",
    fields: [
      system("displayNumber", "رقم المشروع"),
      system("projectName", "اسم المشروع", "text", true),
      system("reportTitle", "عنوان التقرير", "text", true),
      system("reportReference", "الرقم المرجعي للتقرير", "text", true),
      system("assetSingularPlural", "مسمى الأصل / الأصول"),
      system("valuationMethod", "أسلوب التقييم", "text", true),
      system("valuationPurpose", "الغرض من التقييم", "text", true),
      system("valuePremise", "فرضية القيمة", "text", true),
      system("valuationBasis", "أساس القيمة", "text", true),
      system("reportTypeLabel", "نوع التقرير المهني", "text", true),
      system("standardsVersion", "إصدار المعايير", "text", true),
      system("currencyLabel", "العملة", "text", true),
      system("reportIssueDate", "تاريخ إصدار التقرير", "date", true),
      system("inspectionDate", "تاريخ المعاينة", "date", true),
      system("valuationDate", "تاريخ التقييم", "date", true),
      system("agreementDate", "تاريخ الاتفاقية", "date"),
      system("inspectionLocation", "موقع المعاينة"),
      system("inspectionMapUrl", "رابط خريطة المعاينة"),
    ],
  },
  {
    id: "client",
    title: "بيانات العميل",
    fields: [
      system("clientId", "رقم / هوية العميل"),
      system("clientName", "اسم العميل", "text", true),
      system("clientEmail", "البريد الإلكتروني للعميل"),
      system("clientPhone", "هاتف العميل"),
      system("clientLegalType", "الصفة القانونية للعميل"),
      system("clientActivity", "نشاط العميل", "text", true),
      system("clientRepresentativeName", "ممثل العميل", "text", true),
      system("clientRepresentativeRole", "صفة ممثل العميل", "text", true),
      system("intendedUsers", "المستخدمون المقصودون", "text", true),
      system("intendedUse", "الاستخدام المقصود", "text", true),
    ],
  },
  {
    id: "finalValue",
    title: "رأي القيمة",
    fields: [
      system("finalValue", "القيمة النهائية رقميًا", "number", true),
      system("finalValueWords", "القيمة النهائية كتابةً"),
    ],
  },
  {
    id: "basisPremise",
    title: "أساس وفرضية القيمة",
    fields: [
      system("assetSubjectDescription", "وصف الأصل محل التقييم", "textarea", true),
      system("assetDetailedDescription", "الوصف التفصيلي للأصل", "textarea"),
      system("valuationBasisDefinition", "تعريف أساس القيمة", "textarea", true),
      system("valuePremiseDefinition", "تعريف فرضية القيمة", "textarea", true),
    ],
  },
  {
    id: "participants",
    title: "المشاركون في الإعداد",
    fields: [system("valuationTeam", "فريق إعداد التقرير", "text", true)],
  },
];

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cloneField(field: MvReportDataModelField): MvReportDataModelField {
  return { ...field };
}

function cloneSection(section: MvReportDataModelSection): MvReportDataModelSection {
  return { ...section, fields: section.fields.map(cloneField) };
}

export function createDefaultReportDataModel(): MvReportDataModel {
  return {
    id: MV_DEFAULT_REPORT_DATA_MODEL_ID,
    name: "نموذج البيانات",
    isDefault: true,
    sections: DEFAULT_SECTIONS.map((section) => ({
      id: section.id,
      title: section.title,
      fields: section.fields.map((field) => ({
        id: field.id ?? field.sourceKey,
        label: field.label,
        sourceKey: field.sourceKey,
        type: field.type,
        required: field.required,
        system: true,
      })),
    })),
  };
}

export function normalizeReportDataModels(value: unknown): MvReportDataModel[] {
  const rawModels = Array.isArray(value) ? value.slice(0, MV_REPORT_DATA_MODEL_LIMIT) : [];
  const seenModels = new Set<string>();
  const models: MvReportDataModel[] = [];

  for (const raw of rawModels) {
    const model = parseReportDataModel(raw);
    if (!model || seenModels.has(model.id)) continue;
    seenModels.add(model.id);
    models.push(model);
  }

  const defaultIndex = models.findIndex(
    (model) => model.id === MV_DEFAULT_REPORT_DATA_MODEL_ID || model.isDefault,
  );
  if (defaultIndex < 0) return [createDefaultReportDataModel(), ...models];

  const defaultModel = models[defaultIndex]!;
  const normalizedDefault: MvReportDataModel = {
    ...defaultModel,
    id: MV_DEFAULT_REPORT_DATA_MODEL_ID,
    isDefault: true,
  };
  const rest = models
    .filter((_, index) => index !== defaultIndex)
    .map((model) => ({ ...model, isDefault: false }));
  return [normalizedDefault, ...rest];
}

function parseReportDataModel(raw: unknown): MvReportDataModel | null {
  {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const modelRaw = raw as Record<string, unknown>;
    const id = cleanText(modelRaw.id, 120);
    if (!id) return null;
    const sectionsRaw = Array.isArray(modelRaw.sections)
      ? modelRaw.sections.slice(0, MV_REPORT_DATA_MODEL_SECTION_LIMIT)
      : [];
    const seenSections = new Set<string>();
    const sections: MvReportDataModelSection[] = [];
    let fieldCount = 0;
    for (const rawSection of sectionsRaw) {
      if (!rawSection || typeof rawSection !== "object" || Array.isArray(rawSection)) continue;
      const sectionRaw = rawSection as Record<string, unknown>;
      const sectionId = cleanText(sectionRaw.id, 120);
      const title = cleanText(sectionRaw.title, 180);
      if (!sectionId || !title || seenSections.has(sectionId)) continue;
      seenSections.add(sectionId);
      const rawFields = Array.isArray(sectionRaw.fields) ? sectionRaw.fields : [];
      const seenFields = new Set<string>();
      const fields: MvReportDataModelField[] = [];
      for (const rawField of rawFields) {
        if (fieldCount >= MV_REPORT_DATA_MODEL_FIELD_LIMIT) break;
        if (!rawField || typeof rawField !== "object" || Array.isArray(rawField)) continue;
        const fieldRaw = rawField as Record<string, unknown>;
        const fieldId = cleanText(fieldRaw.id, 120);
        const label = cleanText(fieldRaw.label, 180);
        const sourceKey = cleanText(fieldRaw.sourceKey, 180);
        if (!fieldId || !label || !sourceKey || seenFields.has(fieldId)) continue;
        seenFields.add(fieldId);
        fields.push({
          id: fieldId,
          label,
          sourceKey,
          type: isReportCustomFieldType(fieldRaw.type) ? fieldRaw.type : "text",
          required: fieldRaw.required === true,
          system: fieldRaw.system === true || !sourceKey.startsWith("field:"),
        });
        fieldCount += 1;
      }
      sections.push({ id: sectionId, title, fields });
    }
    if (sections.length === 0) return null;
    const rawName = cleanText(modelRaw.name, 160);
    const isDefault = modelRaw.isDefault === true || id === MV_DEFAULT_REPORT_DATA_MODEL_ID;
    return {
      id,
      name:
        isDefault && (rawName === "نموذج أفراد" || rawName === "نموذج الافراد" || rawName === "نموذج فرد")
          ? "نموذج البيانات"
          : rawName || "نموذج البيانات",
      isDefault,
      sections,
    };
  }
}

/** The project's own copy of a model (no default injection, no catalogue rules). */
export function normalizeReportDataModelSnapshot(value: unknown): MvReportDataModel | null {
  const model = parseReportDataModel(value);
  return model ? { id: model.id, name: model.name, sections: model.sections } : null;
}

export function createReportDataModelSnapshot(model: MvReportDataModel): MvReportDataModel {
  return { id: model.id, name: model.name, sections: model.sections.map(cloneSection) };
}

export type MvProjectReportDataModelSource =
  /** The company model still exists: the project follows its definition. */
  | "company"
  /** The company model is gone: the project's saved copy is used. */
  | "snapshot"
  /** Older project without a copy: rebuilt from the project's own fields. */
  | "recovered";

type ProjectModelData = {
  reportDataModelId?: string;
  reportDataModelSnapshot?: unknown;
  customFields?: ReadonlyArray<{
    id: string;
    sectionId: string;
    modelId?: string;
    label: string;
    type: MvReportCustomFieldType;
    required: boolean;
  }>;
  customSections?: ReadonlyArray<{ id: string; modelId?: string; title: string }>;
};

/** The model id a project was set up with (explicit, or inherited by its fields). */
export function projectReportDataModelId(data: ProjectModelData | null | undefined): string {
  const explicit = data?.reportDataModelId?.trim() ?? "";
  if (explicit) return explicit;
  const snapshotId = normalizeReportDataModelSnapshot(data?.reportDataModelSnapshot)?.id ?? "";
  if (snapshotId) return snapshotId;
  return (data?.customFields ?? []).find((field) => field.modelId?.trim())?.modelId?.trim() ?? "";
}

/**
 * The model a project works with. A project never silently moves to another
 * model: when the company model was deleted, the project's copy (or, for older
 * projects, a copy rebuilt from its own sections and fields) keeps the form,
 * the data and the template bindings exactly as they were.
 */
export function resolveProjectReportDataModel(
  companyModels: readonly MvReportDataModel[] | undefined,
  data: ProjectModelData | null | undefined,
): { model: MvReportDataModel; source: MvProjectReportDataModelSource } | null {
  const id = projectReportDataModelId(data);
  if (!id) return null;
  const company = normalizeReportDataModels(companyModels).find((model) => model.id === id);
  if (company) return { model: company, source: "company" };
  const snapshot = normalizeReportDataModelSnapshot(data?.reportDataModelSnapshot);
  if (snapshot && snapshot.id === id) return { model: snapshot, source: "snapshot" };
  const base = createDefaultReportDataModel();
  if (id === MV_DEFAULT_REPORT_DATA_MODEL_ID) {
    return { model: { id: base.id, name: base.name, sections: base.sections }, source: "recovered" };
  }
  // Older project whose model was deleted before copies existed: keep every
  // system field visible (nothing hidden) and rebuild the model's own
  // sections/fields from what the project stored.
  const fields = data?.customFields ?? [];
  const modelFieldsOf = (sectionId: string) =>
    fields
      .filter((field) => field.modelId === id && field.sectionId === sectionId)
      .map(recoveredField);
  const sections: MvReportDataModelSection[] = base.sections.map((section) => ({
    ...section,
    fields: [...section.fields, ...modelFieldsOf(section.id)],
  }));
  for (const section of data?.customSections ?? []) {
    if (section.modelId !== id || sections.some((item) => item.id === section.id)) continue;
    sections.push({ id: section.id, title: section.title, fields: modelFieldsOf(section.id) });
  }
  return { model: { id, name: "نموذج المشروع المحفوظ", sections }, source: "recovered" };
}

function recoveredField(field: {
  id: string;
  label: string;
  type: MvReportCustomFieldType;
  required: boolean;
}): MvReportDataModelField {
  return {
    id: field.id,
    label: field.label,
    sourceKey: `field:${field.id}`,
    type: field.type,
    required: field.required,
    system: false,
  };
}

export function getReportDataModel(
  models: readonly MvReportDataModel[] | undefined,
  id: string | null | undefined,
): MvReportDataModel {
  const normalized = normalizeReportDataModels(models);
  return normalized.find((model) => model.id === id) ?? normalized[0]!;
}

export function createReportDataModelField(): MvReportDataModelField {
  const id = createReportCustomId("model-field");
  return {
    id,
    sourceKey: `field:${id}`,
    label: "حقل جديد",
    type: "text",
    required: false,
    system: false,
  };
}

export function createReportDataModelSection(): MvReportDataModelSection {
  return { id: createReportCustomId("model-section"), title: "قسم جديد", fields: [] };
}

/** Duplicate a model without sharing custom field identities between models. */
export function cloneReportDataModel(source: MvReportDataModel): MvReportDataModel {
  const modelId = createReportCustomId("report-model");
  return {
    id: modelId,
    name: `${source.name} - نسخة`,
    isDefault: false,
    sections: source.sections.map((section) => {
      const keepSectionId = ["basic", "client", "finalValue", "basisPremise", "participants"].includes(
        section.id,
      );
      return {
        id: keepSectionId ? section.id : createReportCustomId("model-section"),
        title: section.title,
        fields: section.fields.map((field) => {
          if (field.system || !field.sourceKey.startsWith("field:")) return cloneField(field);
          const nextId = createReportCustomId("model-field");
          return {
            ...field,
            id: nextId,
            sourceKey: `field:${nextId}`,
            system: false,
          };
        }),
      };
    }),
  };
}

export function isReportDataModelCustomField(field: MvReportDataModelField): boolean {
  return field.sourceKey.startsWith("field:");
}
