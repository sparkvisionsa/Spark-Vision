import { createReportCustomId } from "./mv-report-custom-fields";
import type {
  MvCompanyReportSectionModel,
  MvCompanyReportSectionModelItem,
  MvCompanyReportSectionModelSection,
  MvReportEditableSection,
} from "./types";

export const MV_DEFAULT_REPORT_SECTION_MODEL_ID = "mv-report-sections-standard";
export const MV_REPORT_SECTION_MODEL_LIMIT = 12;
export const MV_REPORT_SECTION_MODEL_SECTION_LIMIT = 30;
export const MV_REPORT_SECTION_MODEL_ITEM_LIMIT = 160;

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cloneItem(item: MvCompanyReportSectionModelItem): MvCompanyReportSectionModelItem {
  return { ...item };
}

function cloneSection(
  section: MvCompanyReportSectionModelSection,
): MvCompanyReportSectionModelSection {
  return { ...section, items: section.items.map(cloneItem) };
}

export function createReportSectionModelItem(): MvCompanyReportSectionModelItem {
  return {
    id: createReportCustomId("report-item"),
    title: "بند جديد",
    body: "",
    visibleInReport: true,
  };
}

export function createReportSectionModelSection(): MvCompanyReportSectionModelSection {
  return {
    id: createReportCustomId("report-section"),
    title: "قسم جديد",
    visibleInReport: true,
    items: [createReportSectionModelItem()],
  };
}

export function createDefaultReportSectionModel(): MvCompanyReportSectionModel {
  return {
    id: MV_DEFAULT_REPORT_SECTION_MODEL_ID,
    name: "النموذج القياسي",
    isDefault: true,
    visibleInReport: true,
    sections: [
      {
        id: "report-definitions",
        title: "التعريفات والملاحظات",
        visibleInReport: true,
        items: [
          {
            id: "report-definition",
            title: "تعريف جديد",
            body: "",
            visibleInReport: true,
          },
        ],
      },
    ],
  };
}

export function normalizeReportSectionModels(value: unknown): MvCompanyReportSectionModel[] {
  const rawModels = Array.isArray(value) ? value.slice(0, MV_REPORT_SECTION_MODEL_LIMIT) : [];
  const models: MvCompanyReportSectionModel[] = [];
  const seenModels = new Set<string>();

  for (const rawModel of rawModels) {
    if (!rawModel || typeof rawModel !== "object" || Array.isArray(rawModel)) continue;
    const modelRaw = rawModel as Record<string, unknown>;
    const id = cleanText(modelRaw.id, 120);
    if (!id || seenModels.has(id)) continue;
    seenModels.add(id);

    const rawSections = Array.isArray(modelRaw.sections)
      ? modelRaw.sections.slice(0, MV_REPORT_SECTION_MODEL_SECTION_LIMIT)
      : [];
    const sections: MvCompanyReportSectionModelSection[] = [];
    const seenSections = new Set<string>();
    let itemCount = 0;

    for (const rawSection of rawSections) {
      if (!rawSection || typeof rawSection !== "object" || Array.isArray(rawSection)) continue;
      const sectionRaw = rawSection as Record<string, unknown>;
      const sectionId = cleanText(sectionRaw.id, 120);
      const title = cleanText(sectionRaw.title, 220);
      if (!sectionId || !title || seenSections.has(sectionId)) continue;
      seenSections.add(sectionId);
      const rawItems = Array.isArray(sectionRaw.items) ? sectionRaw.items : [];
      const items: MvCompanyReportSectionModelItem[] = [];
      const seenItems = new Set<string>();
      for (const rawItem of rawItems) {
        if (itemCount >= MV_REPORT_SECTION_MODEL_ITEM_LIMIT) break;
        if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) continue;
        const itemRaw = rawItem as Record<string, unknown>;
        const itemId = cleanText(itemRaw.id, 120);
        const itemTitle = cleanText(itemRaw.title, 220);
        if (!itemId || !itemTitle || seenItems.has(itemId)) continue;
        seenItems.add(itemId);
        items.push({
          id: itemId,
          title: itemTitle,
          body: cleanText(itemRaw.body, 50_000),
          visibleInReport: itemRaw.visibleInReport !== false,
        });
        itemCount += 1;
      }
      sections.push({
        id: sectionId,
        title,
        ...(cleanText(sectionRaw.sectionNumber, 40)
          ? { sectionNumber: cleanText(sectionRaw.sectionNumber, 40) }
          : {}),
        visibleInReport: sectionRaw.visibleInReport !== false,
        items,
      });
    }

    if (sections.length === 0) continue;
    models.push({
      id,
      name: cleanText(modelRaw.name, 160) || "نموذج تقرير",
      isDefault: modelRaw.isDefault === true || id === MV_DEFAULT_REPORT_SECTION_MODEL_ID,
      visibleInReport: modelRaw.visibleInReport !== false,
      sections,
    });
  }

  const defaultIndex = models.findIndex((model) => model.isDefault);
  return models.map((model, index) => ({
    ...model,
    isDefault: defaultIndex >= 0 && index === defaultIndex,
  }));
}

export function cloneReportSectionModel(
  source: MvCompanyReportSectionModel,
): MvCompanyReportSectionModel {
  return {
    id: createReportCustomId("report-model"),
    name: `${source.name} - نسخة`,
    visibleInReport: source.visibleInReport !== false,
    isDefault: false,
    sections: source.sections.map((section) => ({
      ...cloneSection(section),
      id: createReportCustomId("report-section"),
      items: section.items.map((item) => ({
        ...cloneItem(item),
        id: createReportCustomId("report-item"),
      })),
    })),
  };
}

export function getReportSectionModel(
  models: readonly MvCompanyReportSectionModel[] | null | undefined,
  id: string | null | undefined,
): MvCompanyReportSectionModel | null {
  const requestedId = typeof id === "string" ? id.trim() : "";
  if (!requestedId) return null;
  return normalizeReportSectionModels(models).find((model) => model.id === requestedId) ?? null;
}

/**
 * Converts visible model sections into the existing editable-section contract.
 * The source identifiers make a selection change deterministic and avoid
 * duplicating model sections in a project's saved report state.
 */
export function materializeReportSectionModel(
  model: MvCompanyReportSectionModel | null | undefined,
): MvReportEditableSection[] {
  if (!model || model.visibleInReport === false) return [];
  return model.sections
    .filter((section) => section.visibleInReport !== false)
    .map((section): MvReportEditableSection | null => {
      const visibleItems = section.items.filter((item) => item.visibleInReport !== false);
      if (visibleItems.length === 0) return null;
      const body = visibleItems
        .map((item) => (item.body.trim() ? `${item.title}\n${item.body.trim()}` : item.title))
        .join("\n\n");
      return {
        id: `report-model:${model.id}:${section.id}`,
        reportSectionModelId: model.id,
        reportSectionModelSectionId: section.id,
        ...(section.sectionNumber ? { sectionNumber: section.sectionNumber } : {}),
        title: section.title,
        body,
      } satisfies MvReportEditableSection;
    })
    .filter((section): section is MvReportEditableSection => section != null);
}
