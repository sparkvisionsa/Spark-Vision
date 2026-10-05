"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Copy,
  FileText,
  FileUp,
  Loader2,
  Plus,
  Presentation,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
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
import { buildSuggestedTemplateVariables, normalizeTemplateVariableKey as normalizeVariable, REPORT_TEMPLATE_SOURCE_OPTIONS, suggestedTemplateBinding } from "@/lib/report-template-bindings";
import {
  getReportDataModel,
  MV_DEFAULT_REPORT_DATA_MODEL_ID,
  normalizeReportDataModels,
  type MvReportDataModel,
} from "@/components/workspace/workspace-sections/machine-valuation/mv-report-data-models";

export type ReportDocumentTemplateFormat = "word" | "pptx";

export type CompanyReportTemplateVariableMappingForm = {
  id: string;
  /** The raw placeholder text, without << >> or « ». */
  variable: string;
  /** A server-side catalogue field id, `static`, or one of the report image sources. */
  sourceKey: string;
  staticValue?: string;
};

export type CompanyReportDocumentTemplateForm = {
  /** Stable selector used by projects and merge requests. */
  id: string;
  /** Administrator-facing name; independent from the uploaded file name. */
  name: string;
  reportDataModelId?: string;
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

export { REPORT_TEMPLATE_SOURCE_OPTIONS, suggestedTemplateBinding } from "@/lib/report-template-bindings";

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

function formatTemplateSize(sizeBytes?: number) {
  if (!sizeBytes) return "محفوظ";
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;
}

function valueHintForSource(sourceKey: string) {
  if (sourceKey === "images.asset") return "تُدرج صور الأصول من المشروع";
  if (sourceKey === "images.valuation") return "تُدرج صور حسابات القيمة من تبويب المرفقات";
  if (sourceKey === "images.client") return "تُدرج صور ملفات العميل من تبويب المرفقات";
  if (sourceKey === "images.certificate") return "تُدرج صورة شهادة نظام الهيئة من تبويب المرفقات";
  if (sourceKey) return "تُملأ تلقائيًا من بيانات المشروع";
  return "—";
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
  const assetImageFields = REPORT_TEMPLATE_SOURCE_OPTIONS.filter(
    (option) => option.value === "images.asset" && matches(option.label, option.value),
  );
  const attachmentImageFields = REPORT_TEMPLATE_SOURCE_OPTIONS.filter(
    (option) =>
      (option.value === "images.valuation" || option.value === "images.client" || option.value === "images.certificate") &&
      matches(option.label, option.value),
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
        "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-right transition hover:bg-sky-50",
        value === sourceKey && "bg-sky-50 text-sky-900",
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-bold">{label}</span>
        {note ? <span className="block truncate text-[10px] font-semibold text-slate-400">{note}</span> : null}
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
            "h-10 w-full justify-between rounded-xl bg-white px-3 text-right text-[12px] font-semibold shadow-none",
            value ? "border-emerald-200" : "border-amber-300 bg-amber-50/40",
          )}
        >
          <span className="min-w-0 truncate">{sourceLabelForTemplate(value, [activeModel, ...models])}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
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
              <SelectTrigger className="mb-2 h-9 rounded-lg border-slate-200 bg-white text-[12px] font-bold shadow-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id} className="text-[12px] font-bold">
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-slate-400 focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100">
            <Search className="h-3.5 w-3.5 shrink-0" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث عن قسم أو حقل"
              className="h-8 border-0 bg-transparent p-0 text-[12px] font-semibold shadow-none focus-visible:ring-0"
              autoFocus
            />
          </label>
        </div>

        <div className="max-h-[340px] overflow-y-auto p-1.5">
          <button
            type="button"
            onClick={() => select("")}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-right text-[12px] font-bold text-slate-500 hover:bg-slate-50",
              !value && "bg-slate-100 text-slate-800",
            )}
          >
            بدون ربط حاليًا
            {!value ? <Check className="h-3.5 w-3.5" /> : null}
          </button>

          {modelGroups.map((section) => (
            <div key={section.id} className="mt-1.5">
              <p className="px-2.5 py-1 text-[10px] font-black tracking-wide text-slate-400">{section.title}</p>
              {section.fields.map((field) => optionButton(field.sourceKey, field.label, field.system ? "حقل النظام" : "حقل مخصص"))}
            </div>
          ))}

          {extraReportFields.length > 0 ? (
            <div className="mt-1.5">
              <p className="px-2.5 py-1 text-[10px] font-black tracking-wide text-slate-400">بيانات التقرير الأخرى</p>
              {extraReportFields.map((field) => optionButton(field.value, field.label))}
            </div>
          ) : null}
          {projectFields.length > 0 ? (
            <div className="mt-1.5">
              <p className="px-2.5 py-1 text-[10px] font-black tracking-wide text-slate-400">بيانات المشروع</p>
              {projectFields.map((field) => optionButton(field.value, field.label))}
            </div>
          ) : null}
          {assetImageFields.length > 0 ? (
            <div className="mt-1.5">
              <p className="px-2.5 py-1 text-[10px] font-black tracking-wide text-slate-400">صور الأصول</p>
              {assetImageFields.map((field) => optionButton(field.value, field.label, "من صور الأصول في المشروع"))}
            </div>
          ) : null}
          {attachmentImageFields.length > 0 ? (
            <div className="mt-1.5">
              <p className="px-2.5 py-1 text-[10px] font-black tracking-wide text-slate-400">المرفقات</p>
              {attachmentImageFields.map((field) => optionButton(field.value, field.label, "من تبويب المرفقات"))}
            </div>
          ) : null}
          {specialFields.length > 0 ? (
            <div className="mt-1.5">
              <p className="px-2.5 py-1 text-[10px] font-black tracking-wide text-slate-400">خيارات خاصة</p>
              {specialFields.map((field) => optionButton(field.value, field.label))}
            </div>
          ) : null}

          {modelGroups.length === 0 && extraReportFields.length === 0 && projectFields.length === 0 && assetImageFields.length === 0 && attachmentImageFields.length === 0 && specialFields.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] font-semibold text-slate-400">لا توجد نتائج مطابقة.</p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function FilePickButton({
  accept,
  disabled,
  uploading,
  isPptx,
  label,
  onFile,
}: {
  accept: string;
  disabled?: boolean;
  uploading?: boolean;
  isPptx: boolean;
  label: string;
  onFile: (file: File) => void;
}) {
  return (
    <label
      className={cn(
        "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-black text-white",
        isPptx ? "bg-orange-500 hover:bg-orange-600" : "bg-emerald-600 hover:bg-emerald-700",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <input
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = "";
          if (file) onFile(file);
        }}
      />
      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
      {uploading ? "جارٍ القراءة…" : label}
    </label>
  );
}

function TemplateStep({ number, title, text, children }: { number: string; title: string; text: string; children: ReactNode }) {
  return (
    <section className="border-b border-slate-100 px-4 py-3">
      <div className="mb-2 flex items-start gap-2.5">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white">{number}</span>
        <div className="min-w-0">
          <h3 className="text-[13px] font-black text-slate-950">{title}</h3>
          <p className="mt-0.5 text-[11px] font-semibold leading-5 text-slate-500">{text}</p>
        </div>
      </div>
      {children}
    </section>
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
  suggestedSource?: string;
  label?: string;
  sectionTitle?: string;
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
  onUploadNew: (file: File, modelId: string) => Promise<boolean>;
  onReplace: (file: File, modelId: string) => Promise<boolean>;
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
  const [variableQuery, setVariableQuery] = useState("");
  const [preparingNewTemplate, setPreparingNewTemplate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const models = useMemo(() => normalizeReportDataModels(reportDataModels), [reportDataModels]);
  const selectedTemplate = templates.find((item) => item.id === selectedTemplateId) ?? null;
  const [activeReportDataModelId, setActiveReportDataModelId] = useState(selectedTemplate?.reportDataModelId ?? MV_DEFAULT_REPORT_DATA_MODEL_ID);
  const template = preparingNewTemplate ? null : selectedTemplate;
  const showingSuggestions = !template;
  const busy = saving || uploading || loading;
  const activeModel = getReportDataModel(models, activeReportDataModelId);
  useEffect(() => {
    if (!preparingNewTemplate) setActiveReportDataModelId(selectedTemplate?.reportDataModelId ?? MV_DEFAULT_REPORT_DATA_MODEL_ID);
  }, [preparingNewTemplate, selectedTemplate?.id, selectedTemplate?.reportDataModelId]);
  useEffect(() => {
    setNewVariable("");
    setVariableQuery("");
  }, [selectedTemplateId, preparingNewTemplate]);
  useEffect(() => {
    if (!models.some((model) => model.id === activeReportDataModelId)) {
      setActiveReportDataModelId(MV_DEFAULT_REPORT_DATA_MODEL_ID);
    }
  }, [activeReportDataModelId, models]);
  const isPptx = format === "pptx";
  const formatTitle = isPptx ? "قوالب PowerPoint" : "قوالب Word";
  const extension = isPptx ? ".pptx" : ".docx";
  const reachedTemplateLimit = templates.length >= 20;
  const accept = isPptx
    ? ".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
    : ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const detectedVariables = template?.bookmarkNames ?? [];
  const mappings = template?.variableMappings ?? [];
  const excluded = template?.excludedVariableNames ?? [];

  const rows = useMemo<TemplateRow[]>(() => {
    if (showingSuggestions) {
      return buildSuggestedTemplateVariables(activeModel).map((item) => ({
        ...item, suggestedSource: item.sourceKey, detected: false,
      }));
    }
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
  }, [activeModel, showingSuggestions, detectedVariables, excluded, mappings]);

  const hasConfiguredSource = (sourceKey: string) =>
    Boolean(sourceKey) && (!sourceKey.startsWith("field:") || Boolean(sourceKey.slice("field:".length).trim()));
  // Count only persisted/local mapping rows — never treat auto-suggestions as saved links.
  const mappedCount = rows.filter((row) => row.detected && hasConfiguredSource(row.mapping?.sourceKey ?? "")).length;
  const normalizedVariableQuery = variableQuery.trim().toLocaleLowerCase("ar");
  const visibleRows = normalizedVariableQuery
    ? rows.filter((row) =>
        row.variable.toLocaleLowerCase("ar").includes(normalizedVariableQuery) ||
        (row.label ?? "").toLocaleLowerCase("ar").includes(normalizedVariableQuery) ||
        (row.sectionTitle ?? "").toLocaleLowerCase("ar").includes(normalizedVariableQuery),
      )
    : rows;

  const startNewTemplate = () => {
    setPreparingNewTemplate(true);
    setActiveReportDataModelId(MV_DEFAULT_REPORT_DATA_MODEL_ID);
    setNewVariable("");
    setVariableQuery("");
    setUploadError("");
    setCopyNotice("");
  };

  const cancelNewTemplate = () => {
    setPreparingNewTemplate(false);
    setUploadError("");
    setCopyNotice("");
  };

  const uploadTemplate = async (file: File, replace = false) => {
    if (busy) return;
    setUploading(true);
    setUploadError("");
    try {
      const saved = await (replace ? onReplace : onUploadNew)(file, activeModel.id);
      if (saved) {
        setPreparingNewTemplate(false);
        setCopyNotice("");
      } else {
        setUploadError("تعذر حفظ القالب. راجع رسالة الخطأ وحاول رفعه مجددًا؛ ما زال النموذج المختار متاحًا.");
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "تعذر رفع القالب. حاول مجددًا.");
    } finally {
      setUploading(false);
    }
  };

  const copyVariable = async (variable: string) => {
    try {
      await navigator.clipboard.writeText(`<<${variable}>>`);
      setCopyNotice(`تم نسخ <<${variable}>>. الصقه في القالب على جهازك.`);
    } catch {
      setCopyNotice(`تعذر النسخ تلقائيًا. حدد المتغير <<${variable}>> وانسخه يدويًا.`);
    }
  };

  const saveButton = onSave ? (
    <Button
      type="button"
      size="sm"
      className="h-8 shrink-0 gap-1 rounded-lg bg-[#0C447C] px-2.5 text-[11px] font-black hover:bg-[#0a3a66] disabled:opacity-60"
      disabled={busy}
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
      sourceKey: current?.sourceKey ?? suggestedTemplateBinding(variable, activeModel),
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
          sourceKey: suggestedTemplateBinding(variable, activeModel),
        },
      ],
      excludedVariableNames: excluded,
    });
    setNewVariable("");
  };

  const modelSelect = (
    <Select value={activeModel.id} onValueChange={setActiveReportDataModelId} disabled={busy}>
      <SelectTrigger aria-labelledby={`${format}-data-model-label`} className="h-10 w-full max-w-md rounded-xl bg-white text-[13px] font-bold shadow-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent dir="rtl">
        {models.map((model) => (
          <SelectItem key={model.id} value={model.id} className="text-[12px] font-bold">
            {model.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const newTemplateButton = (
    <Button
      type="button"
      variant="outline"
      className="h-9 shrink-0 gap-1 rounded-xl px-3 text-[12px] font-black"
      disabled={busy || reachedTemplateLimit}
      onClick={startNewTemplate}
    >
      <Plus className="h-3.5 w-3.5" />
      {reachedTemplateLimit ? "اكتمل العدد" : templates.length ? "أضف قالب آخر" : "أضف قالب جديد"}
    </Button>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white" dir="rtl">
      <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white",
            isPptx ? "bg-orange-600" : "bg-emerald-700",
          )}
        >
          {isPptx ? <Presentation className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <h2 className="text-[14px] font-black text-slate-950">{formatTitle}</h2>
          <p className="text-[11px] font-semibold text-slate-500">
            {showingSuggestions ? "جهّز الملف من نموذج البيانات ثم ارفعه" : "اربط متغيرات الملف بمصادر المشروع"}
          </p>
        </div>
        {templates.length > 0 ? (
          <Select
            value={template?.id ?? ""}
            onValueChange={(id) => {
              setPreparingNewTemplate(false);
              setUploadError("");
              setCopyNotice("");
              onSelect(id);
            }}
            disabled={busy}
          >
            <SelectTrigger className="h-9 w-[min(16rem,100%)] rounded-xl bg-slate-50 px-2 text-[12px] font-bold shadow-none" aria-label="اختيار القالب">
              <span className={cn("min-w-0 flex-1 truncate text-right", !template && "text-slate-400")}>
                {preparingNewTemplate ? "تجهيز قالب جديد" : template?.name || "اختر قالبًا"}
              </span>
            </SelectTrigger>
            <SelectContent dir="rtl">
              {templates.map((item) => (
                <SelectItem key={item.id} value={item.id} className="text-[12px] font-bold">
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Badge variant="secondary" className="h-8 rounded-lg bg-slate-100 px-2 text-[10px] font-black text-slate-600">
          {templates.length}/20
        </Badge>
        {template ? newTemplateButton : null}
        {template ? (
          <span className={cn("inline-flex h-8 items-center rounded-lg px-2 text-[10px] font-black", dirty ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700")}>
            {dirty ? "غير محفوظ" : "محفوظ"}
          </span>
        ) : null}
        <span className="ms-auto">{saveButton}</span>
      </header>

      {uploadError ? <p role="alert" className="border-b border-orange-200 bg-orange-50 px-2.5 py-1.5 text-[12px] font-semibold text-orange-800">{uploadError}</p> : null}
      {copyNotice ? <p role="status" className="border-b border-sky-100 bg-sky-50 px-2.5 py-1.5 text-[12px] font-semibold text-sky-800">{copyNotice}</p> : null}

      {loading ? (
        <div className="flex h-24 items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <span id={`${format}-data-model-label`} className="sr-only">نموذج بيانات التقرير</span>
          {showingSuggestions ? (
            <>
              <TemplateStep
                number="1"
                title="اختر نموذج بيانات التقرير"
                text="المتغيرات التالية تُبنى من هذا النموذج. غيّر النموذج أولًا إذا كان القالب لتقرير آخر."
              >
                {modelSelect}
              </TemplateStep>
              <TemplateStep
                number="2"
                title="انسخ المتغيرات إلى الملف"
                text={`ضع كل متغير في ملف ${isPptx ? "PowerPoint" : "Word"} بالمكان الذي تريد ظهور قيمته فيه. صور حسابات القيمة وصور ملفات العميل وصورة شهادة نظام الهيئة تُؤخذ من تبويب المرفقات، وصور الأصول من صور المشروع.`}
              >
                <label className="flex h-9 max-w-md items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 text-slate-400 focus-within:border-sky-300">
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <Input
                    value={variableQuery}
                    onChange={(event) => setVariableQuery(event.target.value)}
                    placeholder="ابحث عن حقل أو متغير"
                    className="h-8 border-0 bg-transparent p-0 text-[12px] font-semibold shadow-none focus-visible:ring-0"
                  />
                </label>
              </TemplateStep>
            </>
          ) : template ? (
            <section className="border-b border-slate-100 px-4 py-3">
              <p className="text-[11px] font-black text-slate-400">القالب المرفوع</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
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
                  className="h-10 min-w-[12rem] flex-1 rounded-xl border-slate-200 text-[13px] font-bold shadow-none"
                  placeholder="اسم القالب"
                  aria-label="اسم القالب"
                  maxLength={160}
                  disabled={busy}
                  required
                />
                <span className="min-w-0 max-w-[16rem] truncate text-[11px] font-bold text-slate-500" dir="ltr" title={template.fileName}>
                  {template.fileName} · {formatTemplateSize(template.sizeBytes)}
                </span>
                <FilePickButton
                  accept={accept}
                  disabled={busy}
                  uploading={uploading}
                  isPptx={isPptx}
                  label="استبدال الملف"
                  onFile={(file) => void uploadTemplate(file, true)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 gap-1 px-2 text-[12px] font-black text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                  disabled={busy}
                  onClick={() => void onRemove()}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف
                </Button>
              </div>
              <div className="mt-3 max-w-md">
                <p className="mb-1 text-[11px] font-black text-slate-700">نموذج البيانات المستخدم للربط</p>
                {modelSelect}
              </div>
            </section>
          ) : null}

          {!showingSuggestions ? (
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-[13px] font-black text-slate-950">ربط المتغيرات المكتشفة</h3>
              <p className="mt-0.5 text-[11px] font-semibold leading-5 text-slate-500">
                هذه الأسماء وُجدت داخل الملف. اختر لكل متغير مصدره: حقل من النموذج، أو صور الأصول، أو إحدى صور المرفقات.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="h-6 rounded-md bg-emerald-50 px-2 text-[10px] font-black text-emerald-700">
                  {mappedCount} مربوط
                </Badge>
                {rows.length - mappedCount > 0 ? (
                  <Badge variant="secondary" className="h-6 rounded-md bg-amber-50 px-2 text-[10px] font-black text-amber-800">
                    {rows.length - mappedCount} بدون ربط
                  </Badge>
                ) : null}
                <label className="flex h-9 min-w-[12rem] flex-1 items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 text-slate-400 focus-within:border-sky-300">
                  <Search className="h-3.5 w-3.5 shrink-0" />
                  <Input
                    value={variableQuery}
                    onChange={(event) => setVariableQuery(event.target.value)}
                    placeholder="ابحث في المتغيرات"
                    className="h-8 border-0 bg-transparent p-0 text-[12px] font-semibold shadow-none focus-visible:ring-0"
                  />
                </label>
                <Input
                  value={newVariable}
                  onChange={(event) => setNewVariable(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addVariable();
                    }
                  }}
                  placeholder="<<متغير>>"
                  aria-label="اسم المتغير الجديد"
                  className="h-9 w-36 rounded-xl text-[12px] shadow-none"
                  disabled={busy}
                  dir="ltr"
                />
                <Button type="button" variant="outline" size="sm" className="h-9 gap-1 px-2 text-[11px] font-black" disabled={busy || !newVariable.trim()} onClick={addVariable}>
                  <Plus className="h-3 w-3" />
                  إضافة
                </Button>
              </div>
            </div>
          ) : null}

          <div className="max-h-[70vh] overflow-auto border-t border-slate-100">
            <Table className="w-full min-w-0">
              <TableHeader className="sticky top-0 z-10 bg-slate-50">
                <TableRow className="hover:bg-slate-50">
                  <TableHead className="h-8 px-2 text-right text-[11px] font-black">المتغير</TableHead>
                  <TableHead className="h-8 px-2 text-right text-[11px] font-black">{showingSuggestions ? "المصدر" : "يربط بـ"}</TableHead>
                  {!showingSuggestions ? <TableHead className="h-8 w-10 px-1" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showingSuggestions ? 2 : 3} className="h-16 text-center text-[12px] font-semibold text-slate-500">
                      {normalizedVariableQuery
                        ? "لا توجد نتائج."
                        : showingSuggestions
                          ? "لا توجد حقول في هذا النموذج. اختر نموذجًا آخر أو أضف حقولًا إلى نموذج بيانات التقرير."
                          : "لم تُكتشف متغيرات؛ أضف متغيراً أو استبدل الملف بنسخة تحتوي على <<اسم_المتغير>>."}
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleRows.map((row) => {
                    const storedSourceKey = row.mapping?.sourceKey?.trim() ?? "";
                    const suggested = !showingSuggestions && !storedSourceKey ? suggestedTemplateBinding(row.variable, activeModel) : "";
                    const chosenSource = row.suggestedSource ?? storedSourceKey;
                    const manualCustomField =
                      storedSourceKey.startsWith("field:") &&
                      !isModelSourceKey(storedSourceKey, models);
                    const sourceIsConfigured = row.detected && hasConfiguredSource(storedSourceKey);
                    const mapping = row.mapping;
                    const suggestedLabel = suggested
                      ? sourceLabelForTemplate(suggested, [activeModel, ...models])
                      : undefined;
                    const isImage = (chosenSource || row.suggestedSource || "").startsWith("images.");
                    return (
                      <TableRow key={normalizeVariable(row.variable)} className="group hover:bg-slate-50/70">
                        <TableCell className="px-2 py-1.5 align-middle">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {!showingSuggestions ? (
                              sourceIsConfigured
                                ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                : <CircleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            ) : null}
                            {showingSuggestions && row.label ? (
                              <span className="text-[12px] font-bold text-slate-800">{row.label}</span>
                            ) : null}
                            <code
                              className={cn(
                                "select-text break-all rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                                sourceIsConfigured ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700",
                              )}
                              dir="ltr"
                            >
                              {`<<${row.variable}>>`}
                            </code>
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-slate-500" aria-label={`نسخ <<${row.variable}>>`} title="نسخ المتغير" onClick={() => void copyVariable(row.variable)}>
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            {!row.detected && !showingSuggestions ? (
                              <span className="rounded bg-violet-50 px-1 text-[9px] font-black text-violet-700">غير موجود</span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="px-2 py-1.5 align-middle">
                          {showingSuggestions ? (
                            <p className="text-[12px] font-semibold leading-5 text-slate-600">
                              {row.sectionTitle ? <span className="mb-0.5 block text-[10px] font-black text-slate-400">{row.sectionTitle}</span> : null}
                              {isImage ? valueHintForSource(chosenSource) : "يُملأ من هذا الحقل عند إنشاء التقرير"}
                            </p>
                          ) : (
                            <div className="grid gap-1">
                              <TemplateDataSourcePicker
                                value={chosenSource}
                                models={models}
                                activeModelId={activeReportDataModelId}
                                disabled={busy}
                                onModelChange={setActiveReportDataModelId}
                                onChange={(value) =>
                                  updateMapping(row.variable, {
                                    sourceKey: value,
                                    staticValue: value === "static" ? mapping?.staticValue ?? "" : undefined,
                                  })
                                }
                              />
                              {!storedSourceKey && suggestedLabel ? (
                                <button type="button" className="text-[10px] font-bold text-sky-700 hover:underline disabled:opacity-50" disabled={busy} onClick={() => updateMapping(row.variable, { sourceKey: suggested })}>
                                  تطبيق الاقتراح: {suggestedLabel}
                                </button>
                              ) : null}
                              {chosenSource === "static" ? (
                                <Input
                                  value={mapping?.staticValue ?? ""}
                                  onChange={(event) => updateMapping(row.variable, { staticValue: event.target.value, sourceKey: "static" })}
                                  className="h-8 rounded-lg text-[12px] shadow-none"
                                  placeholder="اكتب القيمة الثابتة"
                                  disabled={busy}
                                />
                              ) : manualCustomField ? (
                                <Input
                                  value={storedSourceKey.slice("field:".length)}
                                  onChange={(event) => updateMapping(row.variable, { sourceKey: `field:${event.target.value.trim()}` })}
                                  className="h-8 rounded-lg text-[12px] shadow-none"
                                  placeholder="اسم الحقل"
                                  disabled={busy}
                                  dir="ltr"
                                />
                              ) : null}
                            </div>
                          )}
                        </TableCell>
                        {!showingSuggestions ? (
                          <TableCell className="px-1 py-1.5 text-left align-middle">
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-slate-300 hover:bg-rose-50 hover:text-rose-700" disabled={busy} onClick={() => removeRow(row)} title="حذف من لوحة الربط">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {showingSuggestions ? (
            <TemplateStep
              number="3"
              title="ارفع الملف بعد لصق المتغيرات"
              text="يُقرأ الملف وتُربط المتغيرات المعروفة بمصادرها. يمكنك بعدها مراجعة أي متغير لم يُربط."
            >
              <div className="flex flex-wrap items-center gap-2">
                {newTemplateButton}
                {preparingNewTemplate ? (
                  <>
                    <FilePickButton
                      accept={accept}
                      disabled={busy || reachedTemplateLimit}
                      uploading={uploading}
                      isPptx={isPptx}
                      label={`رفع ملف ${extension}`}
                      onFile={(file) => void uploadTemplate(file)}
                    />
                    <Button type="button" variant="ghost" className="h-9 px-2 text-[12px] font-black text-slate-500" disabled={busy} onClick={cancelNewTemplate}>
                      <X className="h-3.5 w-3.5" />
                      إلغاء
                    </Button>
                  </>
                ) : null}
              </div>
            </TemplateStep>
          ) : null}
        </>
      )}
    </div>
  );
}
