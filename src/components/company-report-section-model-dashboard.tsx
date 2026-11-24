"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AlertTriangle, Copy, Eye, EyeOff, FolderPlus, GripVertical, Pencil, Plus, Save, Star, Trash2, X } from "lucide-react";
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
  createNewReportSectionModelSections,
  resolveReportSectionModelDefaults,
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
    sections: createNewReportSectionModelSections(),
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
  // Text is rendered straight from the incoming models. Normalizing on every
  // keystroke would trim the space just typed and refill a name that was just
  // cleared, so the models are only cleaned when loaded and when saved.
  const normalized = models;
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
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [sectionDropTarget, setSectionDropTarget] = useState<{ id: string; after: boolean } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [sidebarWidthReady, setSidebarWidthReady] = useState(false);
  const [resizingSidebar, setResizingSidebar] = useState(false);
  const [pendingFocusItemId, setPendingFocusItemId] = useState<string | null>(null);
  const [pendingSidebarFocusSectionId, setPendingSidebarFocusSectionId] = useState<string | null>(null);
  const [sidebarItemTitle, setSidebarItemTitle] = useState("");
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const editBaselineModelsRef = useRef<string | null>(null);

  const cloneModels = (value: MvCompanyReportSectionModel[]) =>
    JSON.parse(JSON.stringify(value)) as MvCompanyReportSectionModel[];
  const hasUnsavedChanges = Boolean(
    editingId &&
      editBaselineModelsRef.current !== null &&
      JSON.stringify(normalized) !== editBaselineModelsRef.current,
  );

  useEffect(() => {
    try {
      const storedWidth = Number(window.localStorage.getItem("vt-sections-w"));
      if (storedWidth >= 180 && storedWidth <= 560) setSidebarWidth(storedWidth);
    } catch {
      // The editor still works when localStorage is unavailable.
    } finally {
      setSidebarWidthReady(true);
    }
  }, []);

  useEffect(() => {
    if (!sidebarWidthReady) return;
    try {
      window.localStorage.setItem("vt-sections-w", String(sidebarWidth));
    } catch {
      // Persisting the preferred sidebar width is an optional enhancement.
    }
  }, [sidebarWidth, sidebarWidthReady]);

  useEffect(() => {
    if (editingId && !normalized.some((model) => model.id === editingId)) setEditingId(null);
  }, [editingId, normalized]);

  // An empty name is fine while typing, but saving drops any section or item
  // without a title, so leaving a name field empty restores the previous name.
  const nameBeforeEditRef = useRef<Record<string, string>>({});
  const rememberName = (key: string, value: string) => {
    nameBeforeEditRef.current[key] = value;
  };
  const finalizeName = (key: string, value: string, fallback: string) =>
    value.trim() || nameBeforeEditRef.current[key]?.trim() || fallback;

  const active = normalized.find((model) => model.id === editingId) ?? null;
  const activeSection = active
    ? active.sections.find((section) => section.id === activeSectionId) ?? active.sections[0] ?? null
    : null;
  const editorOpen = Boolean(editingId);

  useEffect(() => setSidebarItemTitle(""), [activeSectionId]);

  useEffect(() => {
    if (!pendingFocusItemId || !editorOpen) return;
    const input = document.querySelector<HTMLInputElement>(
      `[data-report-item-id="${pendingFocusItemId}"] input`,
    );
    if (!input) return;
    input.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    input.focus();
    input.select();
    setPendingFocusItemId(null);
  }, [activeSection, editorOpen, pendingFocusItemId]);

  useEffect(() => {
    if (!pendingSidebarFocusSectionId || !editorOpen) return;
    const input = document.querySelector<HTMLInputElement>(
      `[data-sidebar-item-input="${pendingSidebarFocusSectionId}"]`,
    );
    if (!input) return;
    input.focus();
    setPendingSidebarFocusSectionId(null);
  }, [activeSection, editorOpen, pendingSidebarFocusSectionId]);

  const commit = (next: MvCompanyReportSectionModel[]) =>
    onChange(resolveReportSectionModelDefaults(next));
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
  const addItemBelowSection = (
    sectionId: string,
    options: { title?: string; focus?: "detail" | "sidebar" } = {},
  ) => {
    if (!active) return;
    const section = active.sections.find((entry) => entry.id === sectionId);
    const itemCount = active.sections.reduce((total, entry) => total + entry.items.length, 0);
    if (!section || itemCount >= 160) return;
    const item = createReportSectionModelItem();
    const title = options.title?.trim();
    if (title) item.title = title.slice(0, 220);
    setActiveSectionId(sectionId);
    if (options.focus === "sidebar") {
      setSidebarItemTitle("");
      setPendingSidebarFocusSectionId(sectionId);
    } else {
      setPendingFocusItemId(item.id);
    }
    patchSection(sectionId, { items: [...section.items, item] });
  };

  const focusItemInDetail = (itemId: string) => {
    const input = document.querySelector<HTMLInputElement>(
      `[data-report-item-id="${itemId}"] input`,
    );
    input?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    input?.focus();
    input?.select();
  };
  const focusSidebarItemInput = (sectionId: string) => {
    setActiveSectionId(sectionId);
    setPendingSidebarFocusSectionId(sectionId);
    // If the section is already selected, React may keep the same state value
    // and therefore skip the effect; focus on the next frame as well so every
    // click reliably places the caret in the add-item field.
    window.requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(
        `[data-sidebar-item-input="${sectionId}"]`,
      );
      input?.focus();
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
    editBaselineModelsRef.current = JSON.stringify(normalized);
    commit([...normalized, model]);
    setEditingId(model.id);
    setActiveSectionId(model.sections[0]?.id ?? null);
  };
  const openModel = (modelId: string) => {
    const model = normalized.find((entry) => entry.id === modelId);
    editBaselineModelsRef.current = JSON.stringify(normalized);
    setEditingId(modelId);
    setActiveSectionId(model?.sections[0]?.id ?? null);
  };
  const requestCloseEditor = () => {
    if (hasUnsavedChanges) {
      setCloseConfirmOpen(true);
      return;
    }
    editBaselineModelsRef.current = null;
    setEditingId(null);
  };
  const discardAndCloseEditor = () => {
    const baseline = editBaselineModelsRef.current;
    if (baseline) {
      try {
        onChange(cloneModels(JSON.parse(baseline) as MvCompanyReportSectionModel[]));
      } catch {
        // Keep the current draft if a malformed snapshot ever occurs.
      }
    }
    editBaselineModelsRef.current = null;
    setCloseConfirmOpen(false);
    setEditingId(null);
  };
  const saveAndCloseEditor = async () => {
    const saved = await onSave();
    if (!saved) return;
    editBaselineModelsRef.current = null;
    setCloseConfirmOpen(false);
    setEditingId(null);
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
  const moveSection = (sectionId: string, destinationIndex: number) => {
    if (!active) return;
    const sections = [...active.sections];
    const sourceIndex = sections.findIndex((section) => section.id === sectionId);
    if (sourceIndex < 0 || destinationIndex < 0 || destinationIndex > sections.length) return;
    const [section] = sections.splice(sourceIndex, 1);
    if (!section) return;
    if (sourceIndex < destinationIndex) destinationIndex -= 1;
    sections.splice(destinationIndex, 0, section);
    patchModel(active.id, { sections });
  };
  const dropSection = (sectionId: string, targetSectionId: string, after: boolean) => {
    if (!active || !sectionId || sectionId === targetSectionId) return;
    const targetIndex = active.sections.findIndex((section) => section.id === targetSectionId);
    moveSection(sectionId, targetIndex + (after ? 1 : 0));
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
          إضافة نموذج الأقسام
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
                    onClick={() => openModel(model.id)}
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
                      onClick={() => openModel(model.id)}
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
                        editBaselineModelsRef.current = JSON.stringify(normalized);
                        const copy = cloneReportSectionModel(model);
                        commit([...normalized, copy]);
                        setEditingId(copy.id);
                        setActiveSectionId(copy.sections[0]?.id ?? null);
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

      <Dialog open={editorOpen} onOpenChange={(open) => !open && requestCloseEditor()}>
        <DialogContent
          hideCloseButton
          className="max-h-[88vh] max-w-5xl overflow-hidden rounded-xl border-slate-200 p-0"
          dir="rtl"
        >
          <button
            type="button"
            className="absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 transition hover:bg-rose-100 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-300"
            onClick={requestCloseEditor}
            title="إغلاق"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
          <DialogHeader className="flex-row items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5 pr-12 text-right">
            <DialogTitle className="text-[13px] font-black">{active?.name || "النموذج"}</DialogTitle>
            {active ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 rounded-md px-2 text-[10px] font-bold"
                onClick={() => {
                  const section = createReportSectionModelSection();
                  patchModel(active.id, { sections: [...active.sections, section] });
                  setActiveSectionId(section.id);
                  setPendingSidebarFocusSectionId(section.id);
                }}
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
                  onFocus={(event) => rememberName(`model:${active.id}`, event.target.value)}
                  onBlur={(event) => {
                    const name = finalizeName(`model:${active.id}`, event.target.value, "نموذج تقرير");
                    if (name !== active.name) patchModel(active.id, { name });
                  }}
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

              <div
                className={cn("vtd-grid", resizingSidebar && "resizing")}
                style={{ "--vtd-w": `${sidebarWidth}px` } as CSSProperties}
              >
                <nav className="vtd-list" aria-label="أقسام النموذج">
                  <p className="vtd-cap">الأقسام ({active.sections.length})</p>
                  {active.sections.map((section, index) => {
                    const selected = section.id === activeSection?.id;
                    const hidden = section.visibleInReport === false;
                    return (
                      <div key={section.id} className="vtd-section-group">
                      <div
                        role="button"
                        tabIndex={-1}
                        className={cn(
                          "vtd-it",
                          selected && "on",
                          hidden && "hid",
                          draggedSectionId === section.id && "drag",
                          sectionDropTarget?.id === section.id &&
                            draggedSectionId !== section.id &&
                            (sectionDropTarget.after ? "ov-b" : "ov-t"),
                        )}
                        aria-current={selected ? "true" : undefined}
                        onClick={(event) => {
                          const target = event.target as HTMLElement;
                          if (!target.closest("input, button")) {
                            focusSidebarItemInput(section.id);
                          } else {
                            setActiveSectionId(section.id);
                          }
                        }}
                        onDragOver={(event) => {
                          if (!draggedSectionId) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          const rect = event.currentTarget.getBoundingClientRect();
                          const after = event.clientY > rect.top + rect.height / 2;
                          if (sectionDropTarget?.id !== section.id || sectionDropTarget.after !== after) {
                            setSectionDropTarget({ id: section.id, after });
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          const rect = event.currentTarget.getBoundingClientRect();
                          dropSection(
                            draggedSectionId ?? "",
                            section.id,
                            event.clientY > rect.top + rect.height / 2,
                          );
                          setDraggedSectionId(null);
                          setSectionDropTarget(null);
                        }}
                      >
                        <span
                          className="vtd-grip"
                          draggable
                          tabIndex={0}
                          role="button"
                          title="اسحب لتغيير الترتيب — أو استخدم الأسهم ↑↓"
                          aria-label={`تحريك القسم ${section.title}`}
                          onClick={(event) => event.stopPropagation()}
                          onDragStart={(event) => {
                            setDraggedSectionId(section.id);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", section.id);
                            const row = event.currentTarget.closest(".vtd-it");
                            if (row instanceof HTMLElement) event.dataTransfer.setDragImage(row, 20, 16);
                          }}
                          onDragEnd={() => {
                            setDraggedSectionId(null);
                            setSectionDropTarget(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
                            event.preventDefault();
                            const sectionIndex = active.sections.findIndex((entry) => entry.id === section.id);
                            moveSection(
                              section.id,
                              event.key === "ArrowUp" ? sectionIndex - 1 : sectionIndex + 2,
                            );
                            const target = event.currentTarget;
                            window.setTimeout(() => target.focus(), 0);
                          }}
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                        <input
                          className="vtd-in vtd-n"
                          dir="ltr"
                          value={section.sectionNumber ?? ""}
                          placeholder={String(index + 1)}
                          maxLength={40}
                          aria-label="رقم القسم"
                          onFocus={() => setActiveSectionId(section.id)}
                          onChange={(event) => patchSection(section.id, { sectionNumber: event.target.value })}
                        />
                        <span className="vtd-t">
                          <input
                            className="vtd-in vtd-title"
                            value={section.title}
                            placeholder="اسم القسم"
                            maxLength={220}
                            aria-label="اسم القسم"
                            onFocus={(event) => {
                              setActiveSectionId(section.id);
                              rememberName(`section:${section.id}`, event.target.value);
                            }}
                            onChange={(event) => patchSection(section.id, { title: event.target.value })}
                            onBlur={(event) => {
                              const title = finalizeName(`section:${section.id}`, event.target.value, "قسم جديد");
                              if (title !== section.title) patchSection(section.id, { title });
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") event.currentTarget.blur();
                            }}
                          />
                          <small>
                            {section.items.length} بند{hidden ? " · مخفي" : ""}
                          </small>
                        </span>
                        <span className="vtd-acts" onClick={(event) => event.stopPropagation()}>
                          {visibilityButton(
                            section.visibleInReport !== false,
                            () => patchSection(section.id, { visibleInReport: section.visibleInReport === false }),
                            "القسم",
                          )}
                          <button
                            type="button"
                            className="vtd-del"
                            title="حذف القسم"
                            aria-label={`حذف القسم ${section.title}`}
                            onClick={() => {
                              const sections = active.sections.filter((entry) => entry.id !== section.id);
                              patchModel(active.id, { sections });
                              if (activeSection?.id === section.id) {
                                setActiveSectionId(sections[Math.min(index, sections.length - 1)]?.id ?? null);
                              }
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      </div>
                      {selected ? (
                        <div className="vtd-sidebar-items" aria-label={`بنود قسم ${section.title}`}>
                          {section.items.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className="vtd-sidebar-item"
                              onClick={() => focusItemInDetail(item.id)}
                              title={item.title}
                            >
                              <span className="vtd-sidebar-item-dot" />
                              <span>{item.title}</span>
                            </button>
                          ))}
                          <form
                            className="vtd-sidebar-add-item"
                            onSubmit={(event) => {
                              event.preventDefault();
                              if (!sidebarItemTitle.trim()) return;
                              addItemBelowSection(section.id, {
                                title: sidebarItemTitle,
                                focus: "sidebar",
                              });
                            }}
                          >
                            <span className="vtd-sidebar-add-icon"><Plus className="h-3 w-3" /></span>
                            <input
                              data-sidebar-item-input={section.id}
                              value={sidebarItemTitle}
                              onChange={(event) => setSidebarItemTitle(event.target.value)}
                              placeholder="بند جديد"
                              aria-label={`اكتب بنداً جديداً أسفل قسم ${section.title}`}
                              maxLength={220}
                              disabled={active.sections.reduce((total, entry) => total + entry.items.length, 0) >= 160}
                            />
                            <kbd>Enter</kbd>
                          </form>
                        </div>
                      ) : null}
                      </div>
                    );
                  })}
                </nav>

                <div
                  className="vtd-split"
                  role="separator"
                  aria-orientation="vertical"
                  aria-valuemin={180}
                  aria-valuemax={560}
                  aria-valuenow={sidebarWidth}
                  aria-label="عرض قائمة الأقسام"
                  tabIndex={0}
                  title="اسحب لتغيير عرض القائمة — نقر مزدوج للإرجاع"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    const startX = event.clientX;
                    const startWidth = sidebarWidth;
                    const separator = event.currentTarget;
                    separator.setPointerCapture?.(event.pointerId);
                    setResizingSidebar(true);
                    const move = (pointerEvent: PointerEvent) =>
                      setSidebarWidth(Math.max(180, Math.min(560, startWidth + (startX - pointerEvent.clientX))));
                    const finish = () => {
                      setResizingSidebar(false);
                      separator.removeEventListener("pointermove", move);
                      separator.removeEventListener("pointerup", finish);
                      separator.removeEventListener("pointercancel", finish);
                    };
                    separator.addEventListener("pointermove", move);
                    separator.addEventListener("pointerup", finish);
                    separator.addEventListener("pointercancel", finish);
                  }}
                  onDoubleClick={() => setSidebarWidth(250)}
                  onKeyDown={(event) => {
                    const delta = event.key === "ArrowLeft" ? 16 : event.key === "ArrowRight" ? -16 : 0;
                    if (!delta) return;
                    event.preventDefault();
                    setSidebarWidth((width) => Math.max(180, Math.min(560, width + delta)));
                  }}
                >
                  <i />
                </div>

                <div className="vtd-detail">
                  {activeSection ? (
                    <div className="vtd-card">
                      <div className="vtd-items">
                        {activeSection.items.map((item) => (
                          <div key={item.id} data-report-item-id={item.id} className="rounded-md bg-slate-50/70 p-1.5">
                            <div className="flex gap-1.5">
                              <Input
                                value={item.title}
                                onChange={(event) =>
                                  patchItem(activeSection.id, item.id, { title: event.target.value })
                                }
                                onFocus={(event) => rememberName(`item:${item.id}`, event.target.value)}
                                onBlur={(event) => {
                                  const title = finalizeName(`item:${item.id}`, event.target.value, "بند جديد");
                                  if (title !== item.title) patchItem(activeSection.id, item.id, { title });
                                }}
                                placeholder="عنوان البند أو التعريف"
                                className="h-7 border-slate-200 bg-white text-[10.5px] font-bold"
                                maxLength={220}
                              />
                              {visibilityButton(
                                item.visibleInReport !== false,
                                () =>
                                  patchItem(activeSection.id, item.id, {
                                    visibleInReport: item.visibleInReport === false,
                                  }),
                                "البند",
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 rounded-md text-rose-500 hover:bg-rose-50"
                                onClick={() =>
                                  patchSection(activeSection.id, {
                                    items: activeSection.items.filter((entry) => entry.id !== item.id),
                                  })
                                }
                                title="حذف البند"
                                aria-label="حذف البند"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <Textarea
                              value={displayReportModelText(item.body ?? "", variableOptions)}
                              onChange={(event) =>
                                patchItem(activeSection.id, item.id, {
                                  body: storeReportModelText(event.target.value, variableOptions),
                                })
                              }
                              placeholder="نص البند"
                              className="mt-1.5 min-h-[58px] resize-y rounded-md border-slate-200 bg-white px-2 py-1.5 text-[10.5px] leading-5"
                              maxLength={50_000}
                            />
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <Select onValueChange={(source) => insertVariable(activeSection.id, item.id, source)}>
                                <SelectTrigger className="h-7 w-[170px] rounded-md border-slate-200 bg-white text-[9.5px] font-bold shadow-none">
                                  <SelectValue placeholder="إدراج قيمة من بيانات التقرير" />
                                </SelectTrigger>
                                <SelectContent dir="rtl" className="max-h-72">
                                  {variableOptions.map((option) => (
                                    <SelectItem
                                      key={option.source}
                                      value={option.source}
                                      className="text-[10px] font-semibold"
                                    >
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {(item.body ?? "").match(/\{\{[^{}]+\}\}/g)?.map((token, index) => {
                                const source = sourceForReportModelVariable(token.slice(2, -2));
                                const label =
                                  variableOptions.find((option) => option.source === source)?.label ??
                                  "قيمة مرتبطة";
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
                          variant="outline"
                          size="sm"
                          className="mt-2 h-8 w-full justify-center gap-1.5 rounded-lg border-dashed border-sky-200 bg-sky-50/60 text-[10px] font-black text-[#0C447C] hover:bg-sky-100"
                          onClick={() => addItemBelowSection(activeSection.id)}
                          disabled={active.sections.reduce((total, entry) => total + entry.items.length, 0) >= 160}
                          aria-label={`إضافة بند جديد أسفل آخر بند في قسم ${activeSection.title}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          إضافة بند
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="vtd-empty">لا توجد أقسام بعد — أضف قسماً من الأعلى.</div>
                  )}
                </div>
              </div>
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
                onClick={requestCloseEditor}
              disabled={saving}
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <DialogContent className="max-w-md rounded-2xl border-slate-200 p-0" dir="rtl">
          <DialogHeader className="border-b border-slate-100 px-4 py-3 text-right">
            <DialogTitle className="flex items-center gap-2 text-[14px] font-black text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
              </span>
              تغييرات غير محفوظة
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 py-4 text-right text-[12px] font-semibold leading-6 text-slate-600">
            هل أنت متأكد من إغلاق نافذة النموذج بدون حفظ التغييرات؟
          </div>
          <DialogFooter className="flex-row justify-start gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:justify-start sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              className="h-8 rounded-lg border-rose-200 px-3 text-[11px] font-black text-rose-700 hover:bg-rose-50"
              onClick={discardAndCloseEditor}
            >
              إغلاق بدون حفظ
            </Button>
            <Button
              type="button"
              className="h-8 gap-1.5 rounded-lg bg-[#0C447C] px-3 text-[11px] font-black text-white hover:bg-[#0a3a66]"
              disabled={saving}
              onClick={() => void saveAndCloseEditor()}
            >
              <Save className="h-3.5 w-3.5" />
              حفظ وإغلاق
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-8 rounded-lg px-3 text-[11px] font-bold text-slate-600"
              onClick={() => setCloseConfirmOpen(false)}
            >
              متابعة التعديل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
