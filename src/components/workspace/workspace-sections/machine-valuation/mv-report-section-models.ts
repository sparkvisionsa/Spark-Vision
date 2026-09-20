import { createReportCustomId } from "./mv-report-custom-fields";
import type {
  MvCompanyReportSectionModel,
  MvCompanyReportSectionModelItem,
  MvCompanyReportSectionModelSection,
  MvReportEditableSection,
} from "./types";
import { MV_REPORT_TOC_ROWS } from "./mv-valuation-report-toc";

export const MV_DEFAULT_REPORT_SECTION_MODEL_ID = "mv-report-sections-standard";
export const MV_REPORT_SECTION_MODEL_LIMIT = 12;
// The system report itself has 41 entries (including all annexes and the
// closing page), so this must remain above that number.  A smaller limit was
// silently discarding the final seven entries during normalization.
export const MV_REPORT_SECTION_MODEL_SECTION_LIMIT = 50;
export const MV_REPORT_SECTION_MODEL_ITEM_LIMIT = 160;

type SystemModelItemSeed = { id: string; title: string; body: string };

/**
 * The detailed model mirrors every section which actually appears in the
 * system report. `systemAnchor` preserves the rich built-in rendering for
 * the default model while giving administrators one ordered, editable model.
 */
const SYSTEM_MODEL_ITEM_SEEDS: Record<string, SystemModelItemSeed[]> = {
  "mv-toc-1": [{ id: "system:intro", title: "النص الافتتاحي", body: "تقرير {{reportData.reportTitle}} المعد لصالح {{project.clientName}} بشأن {{project.name}}." }],
  "mv-toc-2": [{ id: "system:dates", title: "بيانات التواريخ", body: "تاريخ المعاينة: {{reportData.inspectionDate}}\nتاريخ التقييم: {{reportData.valuationDate}}\nتاريخ إصدار التقرير: {{reportData.reportIssueDate}}" }],
  "mv-toc-3": [{ id: "scope:complianceStatement", title: "بيان الالتزام", body: "" }],
  "mv-toc-4": [{ id: "scope:independenceStatement", title: "بيان الاستقلالية", body: "" }],
  "mv-toc-5": [{ id: "system:valuer-identity", title: "بيانات المقيم", body: "المقيم المسؤول: {{reportData.leadValuerName}}" }],
  "mv-toc-6": [{ id: "system:client-identity", title: "بيانات العميل", body: "العميل: {{project.clientName}}\nالبريد: {{project.clientEmail}}\nالهاتف: {{project.clientPhone}}" }],
  "mv-toc-7": [{ id: "scope:intendedUseStatement", title: "المستخدمون المقصودون", body: "" }],
  "mv-toc-asset-summary": [{ id: "system:asset-summary", title: "ملخص الأصول", body: "الأصول محل التقييم: {{project.assets}}" }],
  "mv-toc-8": [{ id: "scope:scopeOfWorkDetails", title: "تفاصيل نطاق العمل", body: "" }],
  "mv-toc-9": [{ id: "system:valuation-purpose", title: "غرض التقييم", body: "الغرض من التقييم: {{reportData.reportTitle}}" }],
  "mv-toc-10": [{ id: "system:intended-use", title: "الاستخدام المقصود", body: "يستخدم التقرير للأغراض المعتمدة للمشروع فقط." }],
  "mv-toc-11": [{ id: "scope:valuationBasisDefinition", title: "تعريف أساس القيمة", body: "" }],
  "mv-toc-12": [{ id: "scope:valuePremiseDefinition", title: "تعريف فرضية القيمة", body: "" }],
  "mv-toc-13": [{ id: "scope:useRestriction", title: "قيود الاستخدام", body: "" }],
  "mv-toc-14": [{ id: "scope:externalSpecialistUse", title: "الاستعانة بأخصائيين", body: "" }],
  "mv-toc-15": [{ id: "scope:esgConsiderations", title: "اعتبارات ESG", body: "" }],
  "mv-toc-16": [{ id: "system:report-type", title: "نوع التقرير", body: "نوع التقرير: {{reportData.reportTitle}}" }],
  "mv-toc-17": [{ id: "scope:informationSources", title: "مصادر المعلومات", body: "" }],
  "mv-toc-18": [{ id: "methodology:assetSubjectDescription", title: "وصف الأصل محل التقييم", body: "" }],
  "mv-toc-18-1": [{ id: "methodology:assetDetailedDescription", title: "الوصف الجزئي", body: "" }],
  "mv-toc-exclusions": [{ id: "system:exclusions", title: "الاستثناءات", body: "الاستثناءات والقيود الواردة في هذا التقرير." }],
  "mv-toc-19": [{ id: "system:currency", title: "العملة", body: "العملة المستخدمة: {{reportData.currency}}" }],
  "mv-toc-procedures": [{ id: "system:valuation-procedures", title: "إجراءات التقييم", body: "إجراءات التقييم موثقة وفق نطاق العمل والمعاينة." }],
  "mv-toc-20": [{ id: "system:inspection", title: "بيانات المعاينة", body: "تاريخ المعاينة: {{reportData.inspectionDate}}" }],
  "mv-toc-21": [{ id: "methodology:methodologyRationale", title: "مبررات المنهجية", body: "" }],
  "mv-toc-22": [{ id: "methodology:costApproachDetails", title: "تفاصيل أسلوب التقييم", body: "" }],
  "mv-toc-22-1": [{ id: "methodology:salvageValueDescription", title: "القيمة المتبقية", body: "" }],
  "mv-toc-22-2": [{ id: "methodology:physicalDepreciationDescription", title: "الإهلاك المادي", body: "" }],
  "mv-toc-22-3": [{ id: "methodology:functionalObsolescenceDescription", title: "التقادم الوظيفي", body: "" }],
  "mv-toc-22-4": [{ id: "methodology:economicObsolescenceDescription", title: "التقادم الاقتصادي", body: "" }],
  "mv-toc-23": [{ id: "assumptions:generalAssumptions", title: "الافتراضات العامة", body: "" }, { id: "assumptions:specialAssumptions", title: "الافتراضات الخاصة", body: "" }],
  "mv-toc-24": [{ id: "system:value-opinion", title: "رأي القيمة", body: "القيمة النهائية: {{reportData.finalValue}} {{reportData.currency}}" }],
  "mv-annex-1": [{ id: "system:valuation-annex", title: "صور حسابات القيمة", body: "{{project.valuationAccountingWorkspace.images}}" }],
  "mv-annex-2": [{ id: "system:assets-annex", title: "صور الأصول", body: "{{project.assetImages}}" }],
  "mv-annex-3": [{ id: "system:client-documents-annex", title: "ملفات العميل", body: "المرفقات المقدمة من العميل." }],
  "mv-annex-sce": [{ id: "system:sce-annex", title: "شهادة التسجيل", body: "شهادة التسجيل في بوابة «تقييم»." }],
  "mv-report-closing": [{ id: "system:closing", title: "الصفحة الختامية", body: "شكراً لثقتكم." }],
};

export function isSystemReportSectionModel(model: MvCompanyReportSectionModel | null | undefined): boolean {
  return model?.id === MV_DEFAULT_REPORT_SECTION_MODEL_ID;
}

export function createDetailedReportModelSections(): MvCompanyReportSectionModelSection[] {
  return MV_REPORT_TOC_ROWS.map((row) => ({
    id: `system:${row.anchor}`,
    title: row.title,
    sectionNumber: row.num,
    systemAnchor: row.anchor,
    visibleInReport: true,
    items: (SYSTEM_MODEL_ITEM_SEEDS[row.anchor] ?? [{ id: `system:item:${row.anchor}`, title: "محتوى القسم", body: "" }])
      .map((item) => ({ ...item, visibleInReport: true })),
  }));
}

function isLegacySparseDefaultModel(model: MvCompanyReportSectionModel): boolean {
  return model.id === MV_DEFAULT_REPORT_SECTION_MODEL_ID &&
    !model.sections.some((section) => section.systemAnchor || section.id.startsWith("system:")) &&
    model.sections.every((section) => section.id === "report-definitions");
}

/**
 * Version 1 of the editor capped sections at 30 while the system report has
 * 37. Existing saved detailed models therefore end exactly at section 25.4.
 * Restore only that known truncation shape; intentional future edits remain
 * untouched.
 */
function isTruncatedDetailedDefaultModel(model: MvCompanyReportSectionModel): boolean {
  return model.id === MV_DEFAULT_REPORT_SECTION_MODEL_ID &&
    model.sections.length === 30 &&
    model.sections.every((section) => Boolean(section.systemAnchor || section.id.startsWith("system:")));
}

function restoreTruncatedDetailedDefaultModel(
  model: MvCompanyReportSectionModel,
): MvCompanyReportSectionModel {
  const existingByAnchor = new Map(
    model.sections.map((section) => [section.systemAnchor || section.id.replace(/^system:/, ""), section] as const),
  );
  return {
    ...model,
    sections: createDetailedReportModelSections().map((seed) => {
      const existing = existingByAnchor.get(seed.systemAnchor!);
      if (!existing) return seed;
      const existingItems = new Map(existing.items.map((item) => [item.id, item] as const));
      return {
        ...seed,
        title: existing.title || seed.title,
        sectionNumber: existing.sectionNumber || seed.sectionNumber,
        visibleInReport: existing.visibleInReport !== false,
        items: seed.items.map((item) => ({
          ...item,
          ...(existingItems.get(item.id) ?? {}),
          visibleInReport: existingItems.get(item.id)?.visibleInReport !== false,
        })),
      };
    }),
  };
}

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
    name: "نموذج تقرير مفصل",
    isDefault: true,
    visibleInReport: true,
    sections: createDetailedReportModelSections(),
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
          ...(itemRaw.overrideSystemContent === true ? { overrideSystemContent: true } : {}),
        });
        itemCount += 1;
      }
      sections.push({
        id: sectionId,
        title,
        ...(cleanText(sectionRaw.sectionNumber, 40)
          ? { sectionNumber: cleanText(sectionRaw.sectionNumber, 40) }
          : {}),
        ...(cleanText(sectionRaw.systemAnchor, 160)
          ? { systemAnchor: cleanText(sectionRaw.systemAnchor, 160) }
          : {}),
        visibleInReport: sectionRaw.visibleInReport !== false,
        items,
      });
    }

    const normalizedModel: MvCompanyReportSectionModel = {
      id,
      name:
        id === MV_DEFAULT_REPORT_SECTION_MODEL_ID && cleanText(modelRaw.name, 160) === "النموذج القياسي"
          ? "نموذج تقرير مفصل"
          : cleanText(modelRaw.name, 160) || "نموذج تقرير",
      // The built-in detailed model is the initial default only.  Once an
      // administrator chooses another model, preserve that decision instead
      // of force-enabling the built-in one while normalizing the list.
      isDefault: modelRaw.isDefault === true,
      visibleInReport: modelRaw.visibleInReport !== false,
      sections,
    };
    models.push(
      isLegacySparseDefaultModel(normalizedModel)
        ? createDefaultReportSectionModel()
        : isTruncatedDetailedDefaultModel(normalizedModel)
          ? restoreTruncatedDetailedDefaultModel(normalizedModel)
          : normalizedModel,
    );
  }

  return resolveReportSectionModelDefaults(models);
}

/**
 * A hidden model must never become the automatic choice for a new project.
 * Keeps a valid explicit default when it is visible; otherwise uses the first
 * visible model, falling back to the first model only when every model is
 * intentionally hidden. Editable text is left untouched, so this is safe to
 * run while an administrator is still typing.
 */
export function resolveReportSectionModelDefaults(
  models: MvCompanyReportSectionModel[],
): MvCompanyReportSectionModel[] {
  const declaredDefaultIndex = models.findIndex(
    (model) => model.isDefault && model.visibleInReport !== false,
  );
  const firstVisibleIndex = models.findIndex((model) => model.visibleInReport !== false);
  const defaultIndex =
    declaredDefaultIndex >= 0
      ? declaredDefaultIndex
      : firstVisibleIndex >= 0
        ? firstVisibleIndex
        : models.length > 0
          ? 0
          : -1;
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
        // A copied model is intentionally independent of the system report.
        overrideSystemContent: true,
      })),
    })),
  };
}

export function getReportSectionModel(
  models: readonly MvCompanyReportSectionModel[] | null | undefined,
  id: string | null | undefined,
): MvCompanyReportSectionModel | null {
  const requestedId = typeof id === "string" ? id.trim() : "";
  const normalized = normalizeReportSectionModels(models);
  if (!requestedId) {
    return normalized.find((model) => model.isDefault) ?? normalized[0] ?? null;
  }
  return (
    normalized.find((model) => model.id === requestedId) ??
    normalized.find((model) => model.isDefault) ??
    normalized[0] ??
    null
  );
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
      // The detailed built-in model maps directly to the native report
      // anchors. It must never be materialized as a second set of free pages.
      if (model.id === MV_DEFAULT_REPORT_SECTION_MODEL_ID && section.systemAnchor) return null;
      // Items in the standard model with a stable source id already render in
      // the system report at their native position. Only newly-added items
      // become free report sections, preventing duplicated default content.
      const visibleItems = section.items.filter(
        (item) =>
          item.visibleInReport !== false &&
          !(
            model.id === MV_DEFAULT_REPORT_SECTION_MODEL_ID &&
            (
              /^(scope|methodology|assumptions):/.test(item.id) ||
              item.id.startsWith("custom:") ||
              item.id === "report-definition"
            )
          ),
      );
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
