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
    name: "نموذج فرد",
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
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const modelRaw = raw as Record<string, unknown>;
    const id = cleanText(modelRaw.id, 120);
    if (!id || seenModels.has(id)) continue;
    seenModels.add(id);
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
    if (sections.length === 0) continue;
    const rawName = cleanText(modelRaw.name, 160);
    const isDefault = modelRaw.isDefault === true || id === MV_DEFAULT_REPORT_DATA_MODEL_ID;
    models.push({
      id,
      name:
        isDefault && (rawName === "نموذج أفراد" || rawName === "نموذج الافراد")
          ? "نموذج فرد"
          : rawName || "نموذج بيانات التقرير",
      isDefault,
      sections,
    });
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
