"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Copy, Eye, EyeOff, FolderPlus, Pencil, Plus, Save, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { REPORT_TEMPLATE_SOURCE_OPTIONS } from "@/components/company-report-document-template-dashboard";
import {
  cloneReportSectionModel,
  createReportSectionModelItem,
  createReportSectionModelSection,
  normalizeReportSectionModels,
} from "@/components/workspace/workspace-sections/machine-valuation/mv-report-section-models";
import { normalizeReportDataModels, type MvReportDataModel } from "@/components/workspace/workspace-sections/machine-valuation/mv-report-data-models";
import { createReportCustomId } from "@/components/workspace/workspace-sections/machine-valuation/mv-report-custom-fields";
import type {
  MvCompanyReportSectionModel,
  MvCompanyReportSectionModelItem,
  MvCompanyReportSectionModelSection,
} from "@/components/workspace/workspace-sections/machine-valuation/types";

type Props = {
  models: MvCompanyReportSectionModel[];
  reportDataModels?: MvReportDataModel[];
  loading?: boolean;
  saving?: boolean;
  onChange: (models: MvCompanyReportSectionModel[]) => void;
  onSave: () => Promise<boolean>;
};

type ModelVariableOption = { source: string; label: string };

const LEGACY_MODEL_VARIABLE_SOURCES: Record<string, string> = {
  "project.name": "projectName",
  "project.clientName": "clientName",
  "project.clientEmail": "clientEmail",
  "project.clientPhone": "clientPhone",
  "company.name": "valuationFirmName",
  "reportData.reportTitle": "reportTitle",
  "reportData.reportReference": "reportReference",
  "reportData.reportIssueDate": "reportIssueDate",
  "reportData.inspectionDate": "inspectionDate",
  "reportData.valuationDate": "valuationDate",
  "reportData.finalValue": "finalValue",
  "reportData.currency": "currencyLabel",
  "reportData.leadValuerName": "leadValuerName",
  "project.assetImages": "images.asset",
  "project.valuationAccountingWorkspace.images": "images.valuation",
};

function sourceForReportModelVariable(source: string): string {
  return LEGACY_MODEL_VARIABLE_SOURCES[source.trim()] ?? source.trim();
}

function displayReportModelText(value: string, options: readonly ModelVariableOption[]): string {
  const labels = new Map(options.map((option) => [option.source, option.label]));
  return value.replace(/{{\s*([^{}]+?)\s*}}/g, (_token, rawSource: string) => {
    const source = sourceForReportModelVariable(rawSource);
    return `«${labels.get(source) ?? "قيمة مرتبطة"}»`;
  });
}

function storeReportModelText(value: string, options: readonly ModelVariableOption[]): string {
  const sourceByLabel = new Map(options.map((option) => [option.label, option.source]));
  return value.replace(/«\s*([^»]+?)\s*»/g, (token, rawLabel: string) => {
    return sourceByLabel.get(rawLabel.trim()) ? `{{${sourceByLabel.get(rawLabel.trim())}}}` : token;
  });
}

function newModel(): MvCompanyReportSectionModel {
  return {
    id: createReportCustomId("report-model"),
    name: "نموذج تقرير جديد",
    visibleInReport: true,
    sections: [createReportSectionModelSection()],
  };
}

function visibilityButton(visible: boolean, onClick: () => void, label: string): ReactNode {
  const action = visible ? "إخفاء " : "إظهار ";
  const suffix = visible ? " من التقرير" : " في التقرير";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 rounded-md text-slate-500 hover:bg-sky-50 hover:text-[#0C447C]"
      onClick={onClick}
      title={action + label + suffix}
      aria-label={action + label + suffix}
    >
      {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
    </Button>
  );
}

export function CompanyReportSectionModelDashboard({
  models,
  reportDataModels = [],
  loading = false,
  saving = false,
  onChange,
  onSave,
}: Props) {
  const normalized = useMemo(() => normalizeReportSectionModels(models), [models]);
  const normalizedReportDataModels = useMemo(
    () => normalizeReportDataModels(reportDataModels),
    [reportDataModels],
  );
  const variableOptions = useMemo((): ModelVariableOption[] => {
    const options: ModelVariableOption[] = REPORT_TEMPLATE_SOURCE_OPTIONS
      .filter((option) => option.value !== "static" && option.value !== "field")
      .map((option) => ({ source: option.value, label: option.label }));
    for (const model of normalizedReportDataModels) {
      for (const section of model.sections) {
        for (const field of section.fields) {
          options.push({ source: field.sourceKey, label: field.label });
        }
      }
    }
    const seen = new Set<string>();
    return options.filter((option) => {
      if (!option.source || seen.has(option.source)) return false;
      seen.add(option.source);
      return true;
    });
  }, [normalizedReportDataModels]);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (editingId && !normalized.some((model) => model.id === editingId)) setEditingId(null);
  }, [editingId, normalized]);

  const active = normalized.find((model) => model.id === editingId) ?? null;
  const editorOpen = Boolean(editingId);
  const commit = (next: MvCompanyReportSectionModel[]) => onChange(normalizeReportSectionModels(next));
  const setDefaultModel = (modelId: string) =>
    commit(
      normalized.map((model) => ({
        ...model,
        // Setting a model as the default also makes it eligible to be used in
        // the final report. This prevents an invisible default selection.
        ...(model.id === modelId ? { isDefault: true, visibleInReport: true } : { isDefault: false }),
      })),
    );
  const patchModel = (modelId: string, patch: Partial<MvCompanyReportSectionModel>) =>
    commit(normalized.map((model) => (model.id === modelId ? { ...model, ...patch } : model)));
  const patchSection = (sectionId: string, patch: Partial<MvCompanyReportSectionModelSection>) => {
    if (!active) return;
    patchModel(active.id, {
      sections: active.sections.map((section) =>
        section.id === sectionId ? { ...section, ...patch } : section,
      ),
    });
  };
  const patchItem = (
    sectionId: string,
    itemId: string,
    patch: Partial<MvCompanyReportSectionModelItem>,
  ) => {
    if (!active) return;
    patchModel(active.id, {
      sections: active.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              items: section.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      ...patch,
                      // Editing a paragraph in a system-backed section is an
                      // explicit choice to replace its dynamic built-in text.
                      ...(section.systemAnchor && Object.prototype.hasOwnProperty.call(patch, "body")
                        ? { overrideSystemContent: true }
                        : {}),
                    }
                  : item,
              ),
            }
          : section,
      ),
    });
  };
  const insertVariable = (sectionId: string, itemId: string, source: string) => {
    if (!active || !source) return;
    const item = active.sections
      .find((section) => section.id === sectionId)
      ?.items.find((entry) => entry.id === itemId);
    if (!item) return;
    const token = `{{${source}}}`;
    patchItem(sectionId, itemId, {
      body: item.body.trim() ? `${item.body.trim()} ${token}` : token,
    });
  };
  const openNewModel = () => {
    const model = newModel();
    commit([...normalized, model]);
    setEditingId(model.id);
  };
  const removeModel = (model: MvCompanyReportSectionModel) => {
    if (normalized.length === 1) {
      window.alert("أضف نموذجاً آخر أولاً؛ يجب أن يبقى نموذج افتراضي واحد للتقرير النهائي.");
      return;
    }
    if (!window.confirm(`حذف نموذج «${model.name}»؟`)) return;
    commit(normalized.filter((entry) => entry.id !== model.id));
    if (editingId === model.id) setEditingId(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-400">
        جارٍ تحميل النماذج…
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm" dir="rtl">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <span className="text-[12px] font-black text-slate-800">النماذج</span>
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1 rounded-lg bg-[#0C447C] px-2.5 text-[10.5px] font-black hover:bg-[#0a3a66]"
          onClick={openNewModel}
          disabled={saving || normalized.length >= 12}
        >
          <Plus className="h-3.5 w-3.5" />
          إضافة نموذج
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-right">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-[10px] font-bold text-slate-500">
            <tr>
              <th className="px-3 py-2">اسم النموذج</th>
              <th className="w-24 px-3 py-2">الأقسام</th>
              <th className="w-20 px-3 py-2">الحالة</th>
              <th className="w-48 px-3 py-2 text-left">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {normalized.map((model) => (
              <tr key={model.id} className="transition hover:bg-slate-50/70">
                <td className="px-3 py-2.5">
                  <button
                    type="button"
                    className="max-w-full truncate text-[11px] font-black text-slate-800 hover:text-[#0C447C]"
                    onClick={() => setEditingId(model.id)}
                  >
                    {model.name}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-[11px] font-bold text-slate-600">{model.sections.length}</td>
                <td className="px-3 py-2.5">
                  <span
                    className={cn(
                      "inline-flex h-5 items-center rounded-full px-2 text-[9px] font-black",
                      model.visibleInReport !== false
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {model.visibleInReport !== false ? "ظاهر" : "مخفي"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center justify-end gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md text-slate-600 hover:bg-sky-50 hover:text-[#0C447C]"
                      onClick={() => setEditingId(model.id)}
                      title="تعديل النموذج"
                      aria-label="تعديل النموذج"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-7 w-7 rounded-md",
                        model.isDefault
                          ? "text-amber-500 hover:bg-amber-50"
                          : "text-slate-400 hover:bg-slate-100 hover:text-amber-500",
                      )}
                      onClick={() => setDefaultModel(model.id)}
                      title={model.isDefault ? "النموذج الافتراضي" : "تعيين كافتراضي"}
                      aria-label={model.isDefault ? "النموذج الافتراضي" : "تعيين كافتراضي"}
                    >
                      <Star className={cn("h-3.5 w-3.5", model.isDefault && "fill-current")} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md text-slate-500 hover:bg-slate-100 hover:text-[#0C447C]"
                      onClick={() => {
                        const copy = cloneReportSectionModel(model);
                        commit([...normalized, copy]);
                        setEditingId(copy.id);
                      }}
                      disabled={saving || normalized.length >= 12}
                      title="نسخ النموذج"
                      aria-label="نسخ النموذج"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    {visibilityButton(
                      model.visibleInReport !== false,
                      () => patchModel(model.id, { visibleInReport: model.visibleInReport === false }),
                      "النموذج",
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md text-rose-500 hover:bg-rose-50"
                      onClick={() => removeModel(model)}
                      title="حذف النموذج"
                      aria-label="حذف النموذج"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {normalized.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-[11px] font-bold text-slate-400">
                  لا توجد نماذج.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Dialog open={editorOpen} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent
          hideCloseButton
          className="max-h-[88vh] max-w-5xl overflow-hidden rounded-xl border-slate-200 p-0"
          dir="rtl"
        >
          <DialogHeader className="flex-row items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 text-right">
            <DialogTitle className="text-[13px] font-black">{active?.name || "النموذج"}</DialogTitle>
            {active ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 rounded-md px-2 text-[10px] font-bold"
                onClick={() => patchModel(active.id, { sections: [...active.sections, createReportSectionModelSection()] })}
                disabled={active.sections.length >= 50}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                إضافة قسم
              </Button>
            ) : null}
          </DialogHeader>

          {active ? (
            <div className="max-h-[calc(88vh-106px)] space-y-2 overflow-y-auto p-3">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-2">
                <Input
                  value={active.name}
                  onChange={(event) => patchModel(active.id, { name: event.target.value })}
                  className="h-8 min-w-[180px] flex-1 rounded-md border-slate-200 bg-white text-[11px] font-black"
                  placeholder="اسم النموذج"
                  maxLength={160}
                />
                <Button
                  type="button"
                  variant={active.isDefault ? "secondary" : "outline"}
                  size="sm"
                  className="h-8 gap-1 rounded-md px-2 text-[10px]"
                  onClick={() => setDefaultModel(active.id)}
                >
                  <Star className={cn("h-3.5 w-3.5", active.isDefault && "fill-current")} />
                  {active.isDefault ? "افتراضي" : "تعيين افتراضي"}
                </Button>
                {visibilityButton(
                  active.visibleInReport !== false,
                  () => patchModel(active.id, { visibleInReport: active.visibleInReport === false }),
                  "النموذج",
                )}
              </div>

              {active.sections.map((section) => (
                <div key={section.id} className="rounded-lg border border-slate-200 bg-white p-2">
                  <div className="grid gap-1.5 sm:grid-cols-[76px_minmax(0,1fr)_auto]">
                    <Input
                      value={section.sectionNumber ?? ""}
                      onChange={(event) => patchSection(section.id, { sectionNumber: event.target.value })}
                      placeholder="رقم"
                      className="h-8 rounded-md border-slate-200 text-[10.5px] font-bold"
                      dir="ltr"
                      maxLength={40}
                    />
                    <Input
                      value={section.title}
                      onChange={(event) => patchSection(section.id, { title: event.target.value })}
                      placeholder="اسم القسم"
                      className="h-8 rounded-md border-slate-200 text-[11px] font-black"
                      maxLength={220}
                    />
                    <div className="flex items-center justify-end gap-0.5">
                      {visibilityButton(
                        section.visibleInReport !== false,
                        () => patchSection(section.id, { visibleInReport: section.visibleInReport === false }),
                        "القسم",
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-md text-rose-500 hover:bg-rose-50"
                        onClick={() => patchModel(active.id, { sections: active.sections.filter((item) => item.id !== section.id) })}
                        title="حذف القسم"
                        aria-label="حذف القسم"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
                    {section.items.map((item) => (
                      <div key={item.id} className="rounded-md bg-slate-50/70 p-1.5">
                        <div className="flex gap-1.5">
                          <Input
                            value={item.title}
                            onChange={(event) => patchItem(section.id, item.id, { title: event.target.value })}
                            placeholder="عنوان البند أو التعريف"
                            className="h-7 border-slate-200 bg-white text-[10.5px] font-bold"
                            maxLength={220}
                          />
                          {visibilityButton(
                            item.visibleInReport !== false,
                            () => patchItem(section.id, item.id, { visibleInReport: item.visibleInReport === false }),
                            "البند",
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 rounded-md text-rose-500 hover:bg-rose-50"
                            onClick={() => patchSection(section.id, { items: section.items.filter((entry) => entry.id !== item.id) })}
                            title="حذف البند"
                            aria-label="حذف البند"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Textarea
                          value={displayReportModelText(item.body ?? "", variableOptions)}
                          onChange={(event) =>
                            patchItem(section.id, item.id, {
                              body: storeReportModelText(event.target.value, variableOptions),
                            })
                          }
                          placeholder="نص البند"
                          className="mt-1.5 min-h-[58px] resize-y rounded-md border-slate-200 bg-white px-2 py-1.5 text-[10.5px] leading-5"
                          maxLength={50_000}
                        />
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Select onValueChange={(source) => insertVariable(section.id, item.id, source)}>
                            <SelectTrigger className="h-7 w-[170px] rounded-md border-slate-200 bg-white text-[9.5px] font-bold shadow-none">
                              <SelectValue placeholder="إدراج قيمة من بيانات التقرير" />
                            </SelectTrigger>
                            <SelectContent dir="rtl" className="max-h-72">
                              {variableOptions.map((option) => (
                                <SelectItem key={option.source} value={option.source} className="text-[10px] font-semibold">
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {(item.body ?? "").match(/\{\{[^{}]+\}\}/g)?.map((token, index) => {
                            const source = sourceForReportModelVariable(token.slice(2, -2));
                            const label = variableOptions.find((option) => option.source === source)?.label ?? "قيمة مرتبطة";
                            return (
                              <span
                                key={`${token}-${index}`}
                                className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-[#0C447C]"
                              >
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 justify-start gap-1 rounded-md px-1.5 text-[10px] font-bold text-[#0C447C] hover:bg-sky-50"
                      onClick={() => patchSection(section.id, { items: [...section.items, createReportSectionModelItem()] })}
                      disabled={active.sections.reduce((total, entry) => total + entry.items.length, 0) >= 160}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      إضافة بند
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <DialogFooter className="sticky bottom-0 flex-row justify-start gap-2 border-t border-slate-100 bg-white px-3 py-2 sm:justify-start sm:space-x-0">
            <Button
              type="button"
              size="sm"
              className="h-7 gap-1 rounded-md bg-[#0C447C] text-[10px] font-black hover:bg-[#0a3a66]"
              disabled={saving}
              onClick={async () => {
                const saved = await onSave();
                if (saved) setEditingId(null);
              }}
            >
              <Save className="h-3.5 w-3.5" />
              حفظ
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-md text-[10px]"
              onClick={() => setEditingId(null)}
              disabled={saving}
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
