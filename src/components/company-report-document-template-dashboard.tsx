"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, FileText, Loader2, Plus, Presentation, Save, Search, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  getReportDataModel,
  normalizeReportDataModels,
  type MvReportDataModel,
} from "@/components/workspace/workspace-sections/machine-valuation/mv-report-data-models";

export type ReportDocumentTemplateFormat = "word" | "pptx";

export type CompanyReportTemplateVariableMappingForm = {
  id: string;
  /** The raw placeholder text, without << >> or « ». */
  variable: string;
  /** A server-side catalogue field id, `static`, or `images.asset` / `images.valuation` / `images.client`. */
  sourceKey: string;
  staticValue?: string;
};

export type CompanyReportDocumentTemplateForm = {
  /** Stable selector used by projects and merge requests. */
  id: string;
  /** Administrator-facing name; independent from the uploaded file name. */
  name: string;
  fileName: string;
  fileUrl: string | null;
  fileDataUrl?: string | null;
  gridFsFileId?: string | null;
  uploadedAt: string;
  sizeBytes?: number;
  /** Variables found in the last uploaded version of the template. */
  bookmarkNames: string[];
  /** Compatibility alias used by early PowerPoint settings payloads. */
  variableNames?: string[];
  /** Bindings intentionally added by the company administrator. */
  variableMappings?: CompanyReportTemplateVariableMappingForm[];
  /** Detected rows removed from this dashboard. Re-uploading resets this list. */
  excludedVariableNames?: string[];
};

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
};

function normalizeVariable(value: string): string {
  return value.replace(/[\u200e\u200f\u202a-\u202e]/g, "").trim().toLocaleLowerCase();
}

function normalizeMarkerVariable(value: string): string {
  return normalizeVariable(value).replace(/[\s_:\-./]+/g, "");
}

export function suggestedTemplateBinding(variable: string): string {
  const normalized = normalizeVariable(variable);
  const direct = Object.entries(DEFAULT_BINDINGS).find(
    ([key]) =>
      normalizeVariable(key) === normalized ||
      normalizeMarkerVariable(key) === normalizeMarkerVariable(variable),
  )?.[1];
  if (direct) return direct;
  return REPORT_TEMPLATE_SOURCE_OPTIONS.some((option) => normalizeVariable(option.value) === normalized)
    ? variable.trim()
    : "";
}

function sourceLabelForTemplate(
  value: string,
  models: readonly MvReportDataModel[],
): string {
  if (!value) return "اختر مصدر البيانات";
  if (value === "static") return "قيمة ثابتة";
  if (value === "field:") return "حقل مخصص يدوي";
  const modelField = models
    .flatMap((model) => model.sections.flatMap((section) => section.fields))
    .find((field) => field.sourceKey === value);
  if (modelField) return modelField.label;
  const legacy = REPORT_TEMPLATE_SOURCE_OPTIONS.find((option) => option.value === value);
  if (legacy) return legacy.label;
  if (value.startsWith("field:")) return `حقل مخصص: ${value.slice("field:".length) || "غير محدد"}`;
  return value;
}

function isModelSourceKey(value: string, models: readonly MvReportDataModel[]): boolean {
  return models.some((model) =>
    model.sections.some((section) => section.fields.some((field) => field.sourceKey === value)),
  );
}

type TemplateDataSourcePickerProps = {
  value: string;
  models: readonly MvReportDataModel[];
  activeModelId: string;
  disabled?: boolean;
  onModelChange: (modelId: string) => void;
  onChange: (value: string) => void;
};

/** A compact searchable picker grouped exactly as the project report-data form. */
function TemplateDataSourcePicker({
  value,
  models,
  activeModelId,
  disabled = false,
  onModelChange,
  onChange,
}: TemplateDataSourcePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const activeModel = getReportDataModel(models, activeModelId);
  const normalizedQuery = query.trim().toLocaleLowerCase("ar");
  const matches = (label: string, sourceKey: string) =>
    !normalizedQuery ||
    label.toLocaleLowerCase("ar").includes(normalizedQuery) ||
    sourceKey.toLocaleLowerCase("en").includes(normalizedQuery);

  const modelGroups = activeModel.sections
    .map((section) => ({
      id: section.id,
      title: section.title,
      fields: section.fields.filter((field) => matches(field.label, field.sourceKey)),
    }))
    .filter((section) => section.fields.length > 0);
  const selectedModelSourceKeys = new Set(
    activeModel.sections.flatMap((section) => section.fields.map((field) => field.sourceKey)),
  );
  const extraReportFields = REPORT_TEMPLATE_SOURCE_OPTIONS.filter(
    (option) =>
      option.group === "report" &&
      !selectedModelSourceKeys.has(option.value) &&
      matches(option.label, option.value),
  );
  const projectFields = REPORT_TEMPLATE_SOURCE_OPTIONS.filter(
    (option) => option.group === "project" && matches(option.label, option.value),
  );
  const visualFields = REPORT_TEMPLATE_SOURCE_OPTIONS.filter(
    (option) => option.group === "image" && matches(option.label, option.value),
  );
  const specialFields = [
    { value: "static", label: "قيمة ثابتة تكتبها يدويًا" },
    { value: "field:", label: "حقل مخصص يدوي" },
  ].filter((option) => matches(option.label, option.value));

  const select = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };
  const optionButton = (sourceKey: string, label: string, note?: string) => (
    <button
      key={sourceKey}
      type="button"
      onClick={() => select(sourceKey)}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-right transition hover:bg-sky-50",
        value === sourceKey && "bg-sky-50 text-sky-900",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-[10.5px] font-bold">{label}</span>
        {note ? <span className="block truncate text-[8.5px] font-semibold text-slate-400">{note}</span> : null}
      </span>
      {value === sourceKey ? <Check className="h-3.5 w-3.5 shrink-0 text-sky-700" /> : null}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-8 w-full justify-between rounded-lg bg-white px-2 text-right text-[10px] font-semibold shadow-none",
            value ? "border-emerald-100" : "border-amber-200",
          )}
        >
          <span className="min-w-0 truncate">{sourceLabelForTemplate(value, models)}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={5}
        className="w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-xl border-slate-200 p-0 shadow-xl"
        dir="rtl"
      >
        <div className="border-b border-slate-100 bg-slate-50/80 p-2">
          {models.length > 1 ? (
            <Select value={activeModel.id} onValueChange={onModelChange}>
              <SelectTrigger className="mb-2 h-8 rounded-lg border-slate-200 bg-white text-[10px] font-black shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id} className="text-[11px] font-bold">
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <label className="flex h-8 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-slate-400 focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث عن قسم أو حقل"
              className="h-7 border-0 bg-transparent p-0 text-[10px] font-semibold shadow-none focus-visible:ring-0"
              autoFocus
            />
          </label>
        </div>

        <div className="max-h-[340px] overflow-y-auto p-1.5">
          <button
            type="button"
            onClick={() => select("")}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-right text-[10px] font-bold text-slate-500 hover:bg-slate-50",
              !value && "bg-slate-100 text-slate-800",
            )}
          >
            بدون ربط حاليًا
            {!value ? <Check className="h-3.5 w-3.5" /> : null}
          </button>

          {modelGroups.map((section) => (
            <div key={section.id} className="mt-1.5">
              <p className="px-2.5 py-1 text-[9px] font-black tracking-wide text-slate-400">{section.title}</p>
              {section.fields.map((field) => optionButton(field.sourceKey, field.label, field.system ? "حقل النظام" : "حقل مخصص"))}
            </div>
          ))}

          {extraReportFields.length > 0 ? (
            <div className="mt-1.5">
              <p className="px-2.5 py-1 text-[9px] font-black tracking-wide text-slate-400">بيانات التقرير الأخرى</p>
              {extraReportFields.map((field) => optionButton(field.value, field.label))}
            </div>
          ) : null}
          {projectFields.length > 0 ? (
            <div className="mt-1.5">
              <p className="px-2.5 py-1 text-[9px] font-black tracking-wide text-slate-400">بيانات المشروع</p>
              {projectFields.map((field) => optionButton(field.value, field.label))}
            </div>
          ) : null}
          {visualFields.length > 0 || specialFields.length > 0 ? (
            <div className="mt-1.5">
              <p className="px-2.5 py-1 text-[9px] font-black tracking-wide text-slate-400">خيارات خاصة</p>
              {visualFields.map((field) => optionButton(field.value, field.label))}
              {specialFields.map((field) => optionButton(field.value, field.label))}
            </div>
          ) : null}

          {modelGroups.length === 0 && extraReportFields.length === 0 && projectFields.length === 0 && visualFields.length === 0 && specialFields.length === 0 ? (
            <p className="px-3 py-6 text-center text-[10px] font-semibold text-slate-400">لا توجد نتائج مطابقة.</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function createMappingId() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `template-variable-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type TemplateRow = {
  variable: string;
  mapping?: CompanyReportTemplateVariableMappingForm;
  detected: boolean;
};

export type CompanyReportDocumentTemplateDashboardProps = {
  format: ReportDocumentTemplateFormat;
  templates: CompanyReportDocumentTemplateForm[];
  /** Company report-data models used to group the source picker. */
  reportDataModels?: MvReportDataModel[];
  selectedTemplateId: string;
  loading?: boolean;
  saving?: boolean;
  /** True when local mapping edits have not been persisted yet. */
  dirty?: boolean;
  onSelect: (templateId: string) => void;
  onUploadNew: (file: File) => void | Promise<void>;
  onReplace: (file: File) => void | Promise<void>;
  onRename: (name: string, finalize?: boolean) => void;
  onRemove: () => void | Promise<void>;
  onChange: (next: {
    variableMappings: CompanyReportTemplateVariableMappingForm[];
    excludedVariableNames: string[];
  }) => void;
  onSave?: () => void | Promise<void>;
};

export function CompanyReportDocumentTemplateDashboard({
  format,
  templates,
  reportDataModels = [],
  selectedTemplateId,
  loading = false,
  saving = false,
  dirty = false,
  onSelect,
  onUploadNew,
  onReplace,
  onRename,
  onRemove,
  onChange,
  onSave,
}: CompanyReportDocumentTemplateDashboardProps) {
  const [newVariable, setNewVariable] = useState("");
  const models = useMemo(() => normalizeReportDataModels(reportDataModels), [reportDataModels]);
  const [activeReportDataModelId, setActiveReportDataModelId] = useState(models[0]?.id ?? "");
  const template = templates.find((item) => item.id === selectedTemplateId) ?? null;
  useEffect(() => setNewVariable(""), [selectedTemplateId]);
  useEffect(() => {
    if (!models.some((model) => model.id === activeReportDataModelId)) {
      setActiveReportDataModelId(models[0]?.id ?? "");
    }
  }, [activeReportDataModelId, models]);
  const isPptx = format === "pptx";
  const formatTitle = isPptx ? "قالب PowerPoint" : "قالب Word";
  const extension = isPptx ? ".pptx" : ".docx";
  const maxSizeLabel = isPptx ? "35 MB" : "25 MB";
  const reachedTemplateLimit = templates.length >= 20;
  const icon = isPptx ? <Presentation className="h-5 w-5" /> : <FileText className="h-5 w-5" />;
  const detectedVariables = template?.bookmarkNames ?? [];
  const mappings = template?.variableMappings ?? [];
  const excluded = template?.excludedVariableNames ?? [];

  const rows = useMemo<TemplateRow[]>(() => {
    const excludedSet = new Set(excluded.map(normalizeVariable));
    const mappingByVariable = new Map<string, CompanyReportTemplateVariableMappingForm>();
    for (const mapping of mappings) {
      const name = mapping.variable.trim();
      if (name && !mappingByVariable.has(normalizeVariable(name))) {
        mappingByVariable.set(normalizeVariable(name), mapping);
      }
    }

    const output: TemplateRow[] = [];
    const seen = new Set<string>();
    for (const raw of detectedVariables) {
      const variable = raw.trim();
      const key = normalizeVariable(variable);
      if (!variable || seen.has(key) || excludedSet.has(key)) continue;
      seen.add(key);
      output.push({ variable, mapping: mappingByVariable.get(key), detected: true });
    }
    for (const mapping of mappings) {
      const variable = mapping.variable.trim();
      const key = normalizeVariable(variable);
      if (!variable || seen.has(key)) continue;
      seen.add(key);
      output.push({ variable, mapping, detected: false });
    }
    return output.sort((a, b) => Number(b.detected) - Number(a.detected) || a.variable.localeCompare(b.variable, "ar"));
  }, [detectedVariables, excluded, mappings]);

  const hasConfiguredSource = (sourceKey: string) =>
    Boolean(sourceKey) && (!sourceKey.startsWith("field:") || Boolean(sourceKey.slice("field:".length).trim()));
  // Count only persisted/local mapping rows — never treat auto-suggestions as saved links.
  const mappedCount = rows.filter((row) => hasConfiguredSource(row.mapping?.sourceKey ?? "")).length;

  const saveButton = onSave ? (
    <Button
      type="button"
      size="sm"
      className="h-9 shrink-0 gap-1.5 rounded-lg bg-[#0C447C] px-3 text-[11px] font-black hover:bg-[#0a3a66] disabled:opacity-60"
      disabled={saving || loading}
      onClick={() => void onSave()}
    >
      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      حفظ
    </Button>
  ) : null;

  const updateMapping = (variable: string, patch: Partial<CompanyReportTemplateVariableMappingForm>) => {
    const key = normalizeVariable(variable);
    const current = mappings.find((item) => normalizeVariable(item.variable) === key);
    const nextItem: CompanyReportTemplateVariableMappingForm = {
      id: current?.id ?? createMappingId(),
      variable: current?.variable || variable.trim(),
      sourceKey: current?.sourceKey ?? suggestedTemplateBinding(variable),
      staticValue: current?.staticValue,
      ...patch,
    };
    const next = current
      ? mappings.map((item) => (item.id === current.id ? nextItem : item))
      : [...mappings, nextItem];
    onChange({ variableMappings: next, excludedVariableNames: excluded });
  };

  const removeRow = (row: TemplateRow) => {
    const variableKey = normalizeVariable(row.variable);
    const nextMappings = mappings.filter((item) => normalizeVariable(item.variable) !== variableKey);
    const nextExcluded = row.detected
      ? [...new Set([...excluded, row.variable])]
      : excluded;
    onChange({ variableMappings: nextMappings, excludedVariableNames: nextExcluded });
  };

  const addVariable = () => {
    const variable = newVariable.trim().replace(/^<<\s*|\s*>>$/g, "").replace(/^«\s*|\s*»$/g, "");
    if (!variable) return;
    if (rows.some((row) => normalizeVariable(row.variable) === normalizeVariable(variable))) {
      setNewVariable("");
      return;
    }
    onChange({
      variableMappings: [
        ...mappings,
        {
          id: createMappingId(),
          variable,
          sourceKey: suggestedTemplateBinding(variable),
        },
      ],
      excludedVariableNames: excluded,
    });
    setNewVariable("");
  };

  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50/60 shadow-sm"
      dir="rtl"
    >
      <section className="bg-white px-2.5 py-2.5 sm:px-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              isPptx ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700",
            )}
            title={formatTitle}
          >
            {icon}
          </span>

          <div className="min-w-[210px] flex-[1_1_360px]">
            <Select
              value={template?.id}
              onValueChange={onSelect}
              disabled={saving || templates.length === 0}
            >
              <SelectTrigger
                className={cn(
                  "h-9 rounded-lg bg-slate-50 px-3 text-[12px] font-bold shadow-none",
                  isPptx ? "border-orange-100" : "border-emerald-100",
                )}
                aria-label="اختيار القالب"
              >
                <span className={cn("min-w-0 flex-1 truncate text-right", !template && "text-slate-400")}>
                  {template?.name ||
                    (templates.length
                      ? "اختر قالبًا"
                      : `لا توجد قوالب ${isPptx ? "PowerPoint" : "Word"}`)}
                </span>
              </SelectTrigger>
              <SelectContent dir="rtl">
                {templates.map((item) => (
                  <SelectItem key={item.id} value={item.id} className="h-auto py-2">
                    <span className="grid min-w-[230px] gap-0.5 text-right">
                      <span className="truncate text-[11px] font-black text-slate-900">{item.name}</span>
                      <span className="truncate text-[9px] font-semibold text-slate-400" dir="ltr">
                        {item.fileName}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Badge
            variant="secondary"
            className="h-8 shrink-0 rounded-lg bg-slate-100 px-2.5 text-[10px] font-black text-slate-600"
            title="عدد القوالب من الحد الأقصى"
          >
            {templates.length}/20
          </Badge>

          <label
            className={cn(
              "inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-black text-white shadow-sm transition",
              isPptx ? "bg-orange-500 hover:bg-orange-600" : "bg-emerald-600 hover:bg-emerald-700",
              (saving || reachedTemplateLimit) && "pointer-events-none opacity-60",
            )}
            title={`إرفاق قالب ${extension} جديد (حتى ${maxSizeLabel})`}
          >
            <input
              type="file"
              accept={
                isPptx
                  ? ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  : ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              }
              className="sr-only"
              disabled={saving || reachedTemplateLimit}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (file) void onUploadNew(file);
              }}
            />
            <Plus className="h-3.5 w-3.5" />
            {reachedTemplateLimit ? "اكتمل العدد" : "قالب جديد"}
          </label>

          {template ? (
            <span
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-[10px] font-black",
                dirty ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  dirty ? "bg-amber-500" : "bg-emerald-500",
                )}
              />
              {dirty ? "غير محفوظ" : "محفوظ"}
            </span>
          ) : null}

          {saveButton}
        </div>
      </section>

      {loading ? (
        <div className="flex h-24 items-center justify-center border-t border-slate-100 bg-white text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : template ? (
        <>
          <section
            className={cn(
              "border-t border-slate-100 px-2.5 py-2 sm:px-3",
              isPptx
                ? "bg-gradient-to-l from-orange-50/80 via-white to-white"
                : "bg-gradient-to-l from-emerald-50/80 via-white to-white",
            )}
          >
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid min-w-[220px] flex-[1_1_280px] gap-1 text-right">
                <span className="text-[10px] font-black text-slate-500">اسم القالب الظاهر في القائمة</span>
              <Input
                value={template.name}
                onChange={(event) => onRename(event.target.value, false)}
                onBlur={() => onRename(template.name, true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onRename(template.name, true);
                    event.currentTarget.blur();
                  }
                }}
                className="h-9 rounded-lg border-slate-200 bg-white text-[12px] font-bold shadow-none"
                placeholder="اسم القالب"
                aria-label="اسم القالب"
                title="اسم القالب الظاهر في صفحة إعداد التقرير"
                maxLength={160}
                disabled={saving}
                required
              />
              </label>

              <div className="grid min-w-[220px] flex-[1_1_300px] gap-1">
                <span className="text-[10px] font-black text-slate-500">الملف المرفوع</span>
              <div className="flex h-9 items-center gap-2 rounded-lg border border-white/80 bg-white/80 px-2.5 shadow-sm">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    isPptx ? "bg-orange-500" : "bg-emerald-500",
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-700" dir="ltr">
                  {template.fileName}
                </span>
                <span className="shrink-0 text-[9px] font-semibold text-slate-400">
                  {template.sizeBytes
                    ? `${(template.sizeBytes / 1024 / 1024).toFixed(2)} MB`
                    : "محفوظ"}
                  {" · "}
                  {template.uploadedAt
                    ? new Date(template.uploadedAt).toLocaleDateString("ar")
                    : "بدون تاريخ"}
                </span>
              </div>
              </div>

              <label
                className={cn(
                  "inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border bg-white px-3 text-[11px] font-black shadow-sm transition",
                  isPptx
                    ? "border-orange-200 text-orange-700 hover:bg-orange-50"
                    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
                  saving && "pointer-events-none opacity-60",
                )}
                title={`استبدال الملف الحالي بملف ${extension} (حتى ${maxSizeLabel})`}
              >
                <input
                  type="file"
                  accept={
                    isPptx
                      ? ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                      : ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  }
                  className="sr-only"
                  disabled={saving}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = "";
                    if (file) void onReplace(file);
                  }}
                />
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                استبدال
              </label>

              <Button
                type="button"
                variant="ghost"
                className="h-9 shrink-0 gap-1.5 rounded-lg px-2.5 text-[11px] font-black text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                disabled={saving}
                onClick={() => void onRemove()}
                title={`حذف ${formatTitle}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">حذف</span>
              </Button>
            </div>
          </section>

          <section className="border-t border-slate-100 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 sm:px-3">
              <div className="order-2 flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="secondary"
                  className="h-6 rounded-md bg-slate-100 px-2 text-[9px] font-black text-slate-600"
                >
                  {rows.length} متغير
                </Badge>
                <Badge
                  variant="secondary"
                  className="h-6 rounded-md bg-emerald-50 px-2 text-[9px] font-black text-emerald-700"
                >
                  {mappedCount} مربوط
                </Badge>
                {rows.length - mappedCount > 0 ? (
                  <Badge
                    variant="secondary"
                    className="h-6 rounded-md bg-amber-50 px-2 text-[9px] font-black text-amber-800"
                  >
                    {rows.length - mappedCount} غير مربوط
                  </Badge>
                ) : null}
              </div>

              <div className="order-1 flex min-w-[260px] flex-[1_1_360px] items-center justify-end gap-1.5 sm:max-w-md">
                <Input
                  value={newVariable}
                  onChange={(event) => setNewVariable(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addVariable();
                    }
                  }}
                  placeholder="<<متغير_جديد>>"
                  aria-label="اسم المتغير الجديد"
                  className="h-8 min-w-0 rounded-lg text-[11px] shadow-none"
                  disabled={saving}
                  dir="ltr"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 gap-1 rounded-lg px-2.5 text-[10px] font-black"
                  disabled={saving || !newVariable.trim()}
                  onClick={addVariable}
                >
                  <Plus className="h-3 w-3" />
                  إضافة
                </Button>
              </div>
            </div>

            <div className="max-h-[560px] overflow-auto border-t border-slate-100">
              <Table className="min-w-[760px]">
                <TableHeader className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                  <TableRow className="h-8 hover:bg-slate-50">
                    <TableHead className="h-8 min-w-44 px-3 text-right text-[10px] font-black">
                      المتغير
                    </TableHead>
                    <TableHead className="h-8 min-w-64 px-3 text-right text-[10px] font-black">
                      مصدر البيانات
                    </TableHead>
                    <TableHead className="h-8 min-w-52 px-3 text-right text-[10px] font-black">
                      القيمة
                    </TableHead>
                    <TableHead className="h-8 w-11 px-2" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-20 text-center text-[11px] font-semibold text-slate-500"
                      >
                        {"لم تُكتشف متغيرات؛ أضف متغيراً أو استبدل الملف بنسخة تحتوي على <<اسم_المتغير>>."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                        // Only an explicit mapping row is "selected". Suggested
                        // bindings are hints — showing them as the Select value
                        // made reloads look unbound after the admin never saved.
                        const storedSourceKey = row.mapping?.sourceKey?.trim() ?? "";
                        const suggested = !storedSourceKey ? suggestedTemplateBinding(row.variable) : "";
                        const chosenSource = storedSourceKey;
                        const manualCustomField =
                          storedSourceKey.startsWith("field:") &&
                          !isModelSourceKey(storedSourceKey, models);
                        const sourceIsConfigured = hasConfiguredSource(storedSourceKey);
                        const mapping = row.mapping;
                        const suggestedLabel = suggested
                          ? REPORT_TEMPLATE_SOURCE_OPTIONS.find((option) => option.value === suggested)?.label
                          : undefined;
                        return (
                          <TableRow
                            key={normalizeVariable(row.variable)}
                            className="group hover:bg-slate-50/70"
                          >
                            <TableCell className="px-3 py-1.5 align-middle">
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "h-2 w-2 shrink-0 rounded-full",
                                    sourceIsConfigured ? "bg-emerald-500" : "bg-amber-400",
                                  )}
                                  title={sourceIsConfigured ? "مرتبط" : "غير مرتبط"}
                                />
                                <code
                                  className="break-all rounded-md bg-slate-100 px-1.5 py-1 text-[10px] font-bold text-slate-700"
                                  dir="ltr"
                                >
                                  {`<<${row.variable}>>`}
                                </code>
                                {!row.detected ? (
                                  <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[8px] font-black text-violet-700">
                                    يدوي
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-1.5 align-middle">
                              <TemplateDataSourcePicker
                                value={chosenSource}
                                models={models}
                                activeModelId={activeReportDataModelId}
                                disabled={saving}
                                onModelChange={setActiveReportDataModelId}
                                onChange={(value) =>
                                  updateMapping(row.variable, {
                                    sourceKey: value,
                                    staticValue: value === "static" ? mapping?.staticValue ?? "" : undefined,
                                  })
                                }
                              />
                              {!sourceIsConfigured && suggestedLabel ? (
                                <button
                                  type="button"
                                  className="mt-1 text-[9px] font-bold text-sky-700 underline-offset-2 hover:underline disabled:opacity-50"
                                  disabled={saving}
                                  onClick={() =>
                                    updateMapping(row.variable, { sourceKey: suggested })
                                  }
                                >
                                  تطبيق الاقتراح: {suggestedLabel}
                                </button>
                              ) : null}
                            </TableCell>
                            <TableCell className="px-3 py-1.5 align-middle">
                              {chosenSource === "static" ? (
                                <Input
                                  value={mapping?.staticValue ?? ""}
                                  onChange={(event) =>
                                    updateMapping(row.variable, {
                                      staticValue: event.target.value,
                                      sourceKey: "static",
                                    })
                                  }
                                  className="h-8 rounded-lg text-[10px] shadow-none"
                                  placeholder="اكتب القيمة الثابتة"
                                  disabled={saving}
                                />
                              ) : manualCustomField ? (
                                <Input
                                  value={storedSourceKey.slice("field:".length)}
                                  onChange={(event) =>
                                    updateMapping(row.variable, {
                                      sourceKey: `field:${event.target.value.trim()}`,
                                    })
                                  }
                                  className="h-8 rounded-lg text-[10px] shadow-none"
                                  placeholder="اسم حقل التقرير أو reportTextOverrides"
                                  disabled={saving}
                                  dir="ltr"
                                />
                              ) : (
                                <span className="inline-flex h-8 items-center text-[9px] font-semibold text-slate-400">
                                  {chosenSource === "images.asset"
                                    ? "صور الأصول"
                                    : chosenSource === "images.valuation"
                                      ? "صور حسابات القيمة"
                                      : chosenSource === "images.client"
                                        ? "صور ملفات العميل"
                                        : chosenSource
                                          ? "تلقائي من النظام"
                                          : "—"}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-left align-middle">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-slate-300 hover:bg-rose-50 hover:text-rose-700 group-hover:text-slate-400"
                                disabled={saving}
                                onClick={() => removeRow(row)}
                                title="حذف من لوحة الربط"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      ) : (
        <div className="flex min-h-24 items-center justify-center gap-2 border-t border-slate-100 bg-white px-4 py-7 text-center text-[11px] font-semibold text-slate-500">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              isPptx ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600",
            )}
          >
            {icon}
          </span>
          <span>
            {templates.length
              ? "اختر قالباً من القائمة لإدارته."
              : `أرفق أول ${formatTitle} من زر «قالب جديد».`}
          </span>
        </div>
      )}
    </div>
  );
}
