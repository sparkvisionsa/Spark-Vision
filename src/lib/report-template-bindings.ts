import type { MvReportDataModel } from "@/components/workspace/workspace-sections/machine-valuation/mv-report-data-models";

type TemplateSourceOption = {
  value: string;
  label: string;
  group: "report" | "project" | "image" | "other";
};

/**
 * These identifiers deliberately match the value catalogue built on the
 * server. Keeping only identifiers in storage (rather than arbitrary object
 * paths) makes bindings safe to use for every company and project.
 */
export const REPORT_TEMPLATE_SOURCE_OPTIONS: TemplateSourceOption[] = [
  { value: "reportTitle", label: "عنوان التقرير", group: "report" },
  { value: "reportReference", label: "الرقم المرجعي للتقرير", group: "report" },
  { value: "reportIssueDate", label: "تاريخ إصدار التقرير", group: "report" },
  { value: "clientName", label: "اسم العميل", group: "report" },
  { value: "clientId", label: "رقم/هوية العميل", group: "report" },
  { value: "clientEmail", label: "بريد العميل", group: "report" },
  { value: "clientPhone", label: "هاتف العميل", group: "report" },
  { value: "clientLegalType", label: "الصفة القانونية للعميل", group: "report" },
  { value: "clientIdentity", label: "تعريف العميل", group: "report" },
  { value: "clientActivity", label: "نشاط العميل", group: "report" },
  { value: "clientRepresentativeName", label: "ممثل العميل", group: "report" },
  { value: "clientRepresentativeRole", label: "صفة ممثل العميل", group: "report" },
  { value: "intendedUsers", label: "المستخدمون المقصودون", group: "report" },
  { value: "intendedUse", label: "الاستخدام المقصود", group: "report" },
  { value: "assetSingularPlural", label: "وصف الأصل/الأصول", group: "report" },
  { value: "assetSubjectDescription", label: "وصف الأصل محل التقييم", group: "report" },
  { value: "assetDetailedDescription", label: "الوصف التفصيلي للأصل", group: "report" },
  { value: "valuationMethod", label: "أسلوب التقييم", group: "report" },
  { value: "valuationBasis", label: "أساس القيمة", group: "report" },
  { value: "valuationBasisDefinition", label: "تعريف أساس القيمة", group: "report" },
  { value: "valuationPurpose", label: "الغرض من التقييم", group: "report" },
  { value: "valuationDate", label: "تاريخ التقييم", group: "report" },
  { value: "agreementDate", label: "تاريخ الاتفاقية", group: "report" },
  { value: "inspectionDate", label: "تاريخ المعاينة", group: "report" },
  { value: "inspectionLocation", label: "مدينة/موقع المعاينة", group: "report" },
  { value: "inspectionMapUrl", label: "رابط خريطة المعاينة", group: "report" },
  { value: "valuePremise", label: "فرضية القيمة", group: "report" },
  { value: "valuePremiseDefinition", label: "تعريف فرضية القيمة", group: "report" },
  { value: "finalValue", label: "القيمة النهائية رقمياً", group: "report" },
  { value: "finalValueWords", label: "القيمة النهائية كتابةً", group: "report" },
  { value: "finalValueOpinion", label: "رأي القيمة النهائي", group: "report" },
  { value: "currencyLabel", label: "العملة", group: "report" },
  { value: "standardsVersion", label: "إصدار المعايير", group: "report" },
  { value: "valuationFirmName", label: "اسم منشأة التقييم", group: "report" },
  { value: "valuationFirmLicense", label: "ترخيص منشأة التقييم", group: "report" },
  { value: "valuationFirmAddress", label: "عنوان منشأة التقييم", group: "report" },
  { value: "leadValuerName", label: "اسم المقيم الرئيسي", group: "report" },
  { value: "leadValuerTitle", label: "مسمى المقيم الرئيسي", group: "report" },
  { value: "leadValuerMembershipNo", label: "عضوية المقيم الرئيسي", group: "report" },
  { value: "scopeOfWorkDetails", label: "تفاصيل نطاق العمل", group: "report" },
  { value: "useRestriction", label: "قيود الاستخدام", group: "report" },
  { value: "externalSpecialistUse", label: "استخدام المختص الخارجي", group: "report" },
  { value: "esgConsiderations", label: "اعتبارات ESG", group: "report" },
  { value: "informationSources", label: "مصادر المعلومات", group: "report" },
  { value: "methodologyRationale", label: "مبررات المنهجية", group: "report" },
  { value: "costApproachDetails", label: "تفاصيل منهج التكلفة", group: "report" },
  { value: "importantAssumptions", label: "الافتراضات المهمة", group: "report" },
  { value: "generalAssumptions", label: "الافتراضات العامة", group: "report" },
  { value: "specialAssumptions", label: "الافتراضات الخاصة", group: "report" },
  { value: "projectName", label: "اسم المشروع", group: "project" },
  { value: "displayNumber", label: "رقم المشروع", group: "project" },
  { value: "images.asset", label: "صور الأصول", group: "image" },
  { value: "images.valuation", label: "صور حسابات القيمة", group: "image" },
  { value: "images.client", label: "صور ملفات العميل", group: "image" },
  { value: "images.certificate", label: "صور شهادة نظام الهيئة (قيمة)", group: "image" },
  { value: "field", label: "حقل مخصص من بيانات التقرير", group: "other" },
  { value: "static", label: "قيمة ثابتة يكتبها المستخدم", group: "other" },
];

const DEFAULT_BINDINGS: Record<string, string> = {
  "عنوان_التقرير": "reportTitle",
  "العميل": "clientName",
  "تاريخ_إصدار_التقرير": "reportIssueDate",
  "الرقم_المرجعي": "reportReference",
  "اسلوب_التقييم": "valuationMethod",
  "أسلوب_التقييم": "valuationMethod",
  "الغرض_من_التقييم": "valuationPurpose",
  "اساس_القيمة": "valuationBasis",
  "تاريخ_التقييم": "valuationDate",
  "تاريخ_الاتفاقية": "agreementDate",
  "تاريخ_المعاينة": "inspectionDate",
  "نشاط_الشركة": "clientActivity",
  "ممثل_العميل": "clientRepresentativeName",
  "صفة": "clientRepresentativeRole",
  "المدينة": "inspectionLocation",
  "رابط_قوقل_ماب": "inspectionMapUrl",
  "رأي_القيمة_رقما_وكتابة": "finalValueOpinion",
  "مرفق الصور1": "images.asset",
  "مرفق_الصور1": "images.asset",
  "صور_الاصول": "images.asset",
  "صور_الأصول": "images.asset",
  "assetImages": "images.asset",
  "assetImage": "images.asset",
  "صور_حسابات_القيمة": "images.valuation",
  "صورحساباتالقيمة": "images.valuation",
  "valuationImages": "images.valuation",
  "صور_ملفات_العميل": "images.client",
  "صورملفاتالعميل": "images.client",
  "clientImages": "images.client",
  "clientDocuments": "images.client",
  "صور_شهادة_قيمة": "images.certificate",
  "صور_شهادة_النظام": "images.certificate",
  "sceCertificateImages": "images.certificate",
  "certificateImages": "images.certificate",
};

export function normalizeTemplateVariableKey(value: string): string {
  return value.replace(/[\u200e\u200f\u202a-\u202e]/g, "").trim().toLocaleLowerCase();
}

/** Use readable Arabic names without diacritics, punctuation or bidi controls. */
function variableFromLabel(label: string): string {
  return normalizeTemplateVariableKey(label)
    .normalize("NFKD")
    .replace(/[\u0640\p{M}]/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

function matchKey(value: string): string {
  return variableFromLabel(value).replace(/_/g, "");
}

export type SuggestedTemplateVariable = {
  variable: string;
  sourceKey: string;
  label: string;
  sectionTitle: string;
};

export function buildSuggestedTemplateVariables(model: MvReportDataModel): SuggestedTemplateVariable[] {
  const seenSources = new Set<string>();
  const fields = model.sections.flatMap((section) => section.fields.flatMap((field) => {
    if (seenSources.has(field.sourceKey)) return [];
    seenSources.add(field.sourceKey);
    return [{ ...field, sectionTitle: section.title }];
  }));
  const bases = fields.map((field) => (variableFromLabel(field.label) || "حقل").slice(0, 90));
  const baseKeys = bases.map(matchKey);
  const counts = new Map<string, number>();
  for (const key of baseKeys) counts.set(key, (counts.get(key) ?? 0) + 1);
  const used = new Set<string>();
  return fields.map((field, index) => {
    const base = bases[index]!;
    const duplicate = counts.get(baseKeys[index]!)! > 1;
    const suffix = variableFromLabel(field.sourceKey).slice(0, 24) || String(index + 1);
    let variable = duplicate ? `${base}_${suffix}` : base;
    let counter = 2;
    // Word's stored variable names are limited to 120 characters.
    while (used.has(matchKey(variable)) || (counts.has(matchKey(variable)) && (duplicate || matchKey(variable) !== baseKeys[index]))) {
      variable = `${base}_${counter++}`;
    }
    used.add(matchKey(variable));
    return { variable, sourceKey: field.sourceKey, label: field.label, sectionTitle: field.sectionTitle };
  });
}

export function suggestedTemplateBinding(variable: string, model?: MvReportDataModel): string {
  const key = matchKey(variable);
  if (!key) return "";
  if (model) {
    const suggestions = buildSuggestedTemplateVariables(model);
    const generated = suggestions.find((item) => matchKey(item.variable) === key);
    if (generated) return generated.sourceKey;
    const fields = suggestions.filter((item) => matchKey(item.label) === key || matchKey(item.sourceKey) === key);
    if (fields.length > 1) return "";
    if (fields[0]) return fields[0].sourceKey;
  }
  const legacy = Object.entries(DEFAULT_BINDINGS).find(([name]) => matchKey(name) === key)?.[1];
  if (legacy) return legacy;
  return REPORT_TEMPLATE_SOURCE_OPTIONS.find((option) =>
    matchKey(option.value) === key || matchKey(option.label) === key,
  )?.value ?? "";
}

type TemplateMapping = { id: string; variable: string; sourceKey: string; staticValue?: string };

/** Preserve intentional edits when replacing a file; bind only newly found variables. */
export function mergeTemplateVariableMappings(opts: {
  variables: string[];
  previousMappings: TemplateMapping[];
  previousDetected: Set<string>;
  nextDetected: Set<string>;
  model: MvReportDataModel;
}): TemplateMapping[] {
  const preserved = opts.previousMappings.filter((mapping) => {
    const key = normalizeTemplateVariableKey(mapping.variable);
    return opts.nextDetected.has(key) || !opts.previousDetected.has(key);
  });
  const seen = new Set(preserved.map((mapping) => normalizeTemplateVariableKey(mapping.variable)));
  const seeded: TemplateMapping[] = [];
  for (const variable of opts.variables) {
    const key = normalizeTemplateVariableKey(variable);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const sourceKey = suggestedTemplateBinding(variable, opts.model);
    if (sourceKey) seeded.push({
      id: globalThis.crypto?.randomUUID?.() ?? `template-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      variable: variable.trim(),
      sourceKey,
    });
  }
  return [...preserved, ...seeded];
}

