"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  FilePlus2,
  Layers3,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  cloneReportDataModel,
  createReportDataModelField,
  createReportDataModelSection,
  isReportDataModelCustomField,
  normalizeReportDataModels,
  type MvReportDataModel,
  type MvReportDataModelField,
} from "@/components/workspace/workspace-sections/machine-valuation/mv-report-data-models";

type Props = {
  models: MvReportDataModel[];
  saving?: boolean;
  dirty?: boolean;
  onChange: (models: MvReportDataModel[]) => void;
  onSave: () => void | Promise<void>;
};

const MODEL_LIMIT = 12;

export function CompanyReportDataModelDashboard({
  models,
  saving = false,
  dirty = false,
  onChange,
  onSave,
}: Props) {
  const normalizedModels = useMemo(() => normalizeReportDataModels(models), [models]);
  const [selectedId, setSelectedId] = useState(normalizedModels[0]?.id ?? "");
  const selected = normalizedModels.find((model) => model.id === selectedId) ?? normalizedModels[0]!;
  // Keep the settings page compact on entry: sections are expanded only on
  // demand, or when the administrator adds a new section to edit it.
  const [openSectionIds, setOpenSectionIds] = useState<string[]>([]);

  useEffect(() => {
    if (!normalizedModels.some((model) => model.id === selectedId)) {
      setSelectedId(normalizedModels[0]?.id ?? "");
    }
  }, [normalizedModels, selectedId]);

  useEffect(() => {
    setOpenSectionIds([]);
  }, [selected.id]);

  const updateSelected = (updater: (model: MvReportDataModel) => MvReportDataModel) => {
    onChange(normalizedModels.map((model) => (model.id === selected.id ? updater(model) : model)));
  };

  const addModel = () => {
    if (normalizedModels.length >= MODEL_LIMIT) return;
    const next = cloneReportDataModel(selected);
    onChange([...normalizedModels, next]);
    setSelectedId(next.id);
  };

  const removeSelected = () => {
    if (selected.isDefault) return;
    if (!window.confirm(`حذف نموذج «${selected.name}»؟`)) return;
    const next = normalizedModels.filter((model) => model.id !== selected.id);
    onChange(next);
    setSelectedId(next[0]?.id ?? "");
  };

  const updateSection = (
    sectionId: string,
    updater: (section: MvReportDataModel["sections"][number]) => MvReportDataModel["sections"][number],
  ) => {
    updateSelected((model) => ({
      ...model,
      sections: model.sections.map((section) => (section.id === sectionId ? updater(section) : section)),
    }));
  };

  const updateField = (
    sectionId: string,
    fieldId: string,
    updater: (field: MvReportDataModelField) => MvReportDataModelField,
  ) => {
    updateSection(sectionId, (section) => ({
      ...section,
      fields: section.fields.map((field) => (field.id === fieldId ? updater(field) : field)),
    }));
  };

  const allSectionsOpen =
    selected.sections.length > 0 &&
    selected.sections.every((section) => openSectionIds.includes(section.id));
  const toggleSection = (sectionId: string) => {
    setOpenSectionIds((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );
  };
  const setAllSectionsOpen = (open: boolean) => {
    setOpenSectionIds(open ? selected.sections.map((section) => section.id) : []);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-l from-sky-50/70 via-white to-white px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-950 text-white shadow-sm">
            <Layers3 className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-black text-slate-950">نماذج بيانات التقرير</h2>
            <p className="truncate text-[10.5px] font-semibold text-slate-500">
              اختر الحقول التي تظهر في المشروع وتتوفر كمصادر لقوالب Word وPowerPoint.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="h-8 rounded-lg bg-slate-100 px-2.5 text-[10px] font-black text-slate-600">
            {normalizedModels.length}/{MODEL_LIMIT}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 rounded-lg px-2.5 text-[10px] font-black"
            disabled={saving || normalizedModels.length >= MODEL_LIMIT}
            onClick={addModel}
          >
            <Copy className="h-3.5 w-3.5" />
            نموذج جديد
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1 rounded-lg bg-[#0C447C] px-2.5 text-[10px] font-black hover:bg-[#0a3a66]"
            disabled={saving || !dirty}
            onClick={() => void onSave()}
          >
            <Save className="h-3.5 w-3.5" />
            حفظ
          </Button>
        </div>
      </header>

      <div className="grid min-h-[390px] lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-b border-slate-100 bg-slate-50/70 p-2 lg:border-b-0 lg:border-l">
          <p className="px-1.5 pb-1 text-[10px] font-black tracking-wide text-slate-400">النماذج المحفوظة</p>
          <div className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-y-auto">
            {normalizedModels.map((model) => {
              const active = model.id === selected.id;
              const fieldCount = model.sections.reduce((sum, section) => sum + section.fields.length, 0);
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelectedId(model.id)}
                  className={cn(
                    "min-w-[170px] rounded-xl border px-2.5 py-2 text-right transition lg:min-w-0",
                    active
                      ? "border-sky-200 bg-white text-[#0C447C] shadow-sm ring-1 ring-sky-100"
                      : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-black">{model.name}</span>
                    {model.isDefault ? (
                      <span className="shrink-0 rounded-md bg-sky-50 px-1.5 py-0.5 text-[8px] font-black text-sky-700">افتراضي</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[9px] font-semibold text-slate-400">
                    {model.sections.length} أقسام · {fieldCount} حقول
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0 p-3">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
            <Label className="grid min-w-[220px] flex-1 gap-1.5 text-[10px] font-black text-slate-500">
              اسم النموذج
              <Input
                value={selected.name}
                onChange={(event) => updateSelected((model) => ({ ...model, name: event.target.value.slice(0, 160) }))}
                className="h-9 rounded-lg border-slate-200 bg-white text-[12px] font-black text-slate-900 shadow-none"
                disabled={saving}
                maxLength={160}
              />
            </Label>
            {!selected.isDefault ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 gap-1.5 rounded-lg px-2.5 text-[10px] font-black text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                disabled={saving}
                onClick={removeSelected}
              >
                <Trash2 className="h-3.5 w-3.5" />
                حذف النموذج
              </Button>
            ) : (
              <span className="pb-1 text-[9px] font-semibold text-slate-400">يبقى النموذج الافتراضي متاحًا دائمًا للمشاريع الحالية.</span>
            )}
          </div>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-2.5 py-1.5">
            <p className="text-[9.5px] font-bold text-slate-500">
              {selected.sections.length} أقسام · {selected.sections.reduce((sum, section) => sum + section.fields.length, 0)} حقول
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 rounded-md px-2 text-[9px] font-black text-slate-600 hover:bg-sky-50 hover:text-sky-800"
              onClick={() => setAllSectionsOpen(!allSectionsOpen)}
              disabled={saving || selected.sections.length === 0}
            >
              {allSectionsOpen ? <ChevronsDownUp className="h-3.5 w-3.5" /> : <ChevronsUpDown className="h-3.5 w-3.5" />}
              {allSectionsOpen ? "طي الكل" : "فتح الكل"}
            </Button>
          </div>

          <div className="space-y-1.5">
            {selected.sections.map((section) => {
              const sectionOpen = openSectionIds.includes(section.id);
              const systemFieldCount = section.fields.filter((field) => field.system).length;
              return (
              <section key={section.id} className={cn("overflow-hidden rounded-xl border bg-white transition-colors", sectionOpen ? "border-sky-200/90 shadow-sm" : "border-slate-200/80")}>
                <div className={cn("flex flex-wrap items-center gap-1.5 px-2.5 py-1.5", sectionOpen ? "bg-sky-50/65" : "bg-slate-50/70")}>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-white hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                    aria-label={sectionOpen ? "طي القسم" : "فتح القسم"}
                    aria-expanded={sectionOpen}
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", sectionOpen && "rotate-180")} />
                  </button>
                  <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", sectionOpen ? "bg-sky-900 text-white" : "bg-slate-200 text-slate-600")}>
                    <Layers3 className="h-3.5 w-3.5" />
                  </span>
                  <Input
                    value={section.title}
                    onChange={(event) => updateSection(section.id, (current) => ({ ...current, title: event.target.value.slice(0, 180) }))}
                    className="h-7 min-w-[150px] flex-1 rounded-md border-slate-200 bg-white text-[10px] font-black shadow-none"
                    aria-label="اسم القسم"
                    disabled={saving}
                    maxLength={180}
                  />
                  <span className="shrink-0 text-[8px] font-bold text-slate-400">{section.fields.length} حقل · {systemFieldCount} نظام</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 rounded-md px-2 text-[9px] font-black"
                    disabled={saving}
                    onClick={() => updateSection(section.id, (current) => ({
                      ...current,
                      fields: [...current.fields, createReportDataModelField()],
                    }))}
                  >
                    <Plus className="h-3 w-3" />
                    حقل
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                    disabled={
                      saving ||
                      selected.sections.length <= 1 ||
                      ["basic", "client", "finalValue", "basisPremise", "participants"].includes(section.id)
                    }
                    onClick={() => {
                      if (!window.confirm(`حذف قسم «${section.title}» بكل حقوله؟`)) return;
                      updateSelected((model) => ({
                        ...model,
                        sections: model.sections.filter((current) => current.id !== section.id),
                      }));
                    }}
                    title={
                      ["basic", "client", "finalValue", "basisPremise", "participants"].includes(section.id)
                        ? "الأقسام الأساسية تبقى متاحة في كل نموذج"
                        : "حذف القسم"
                    }
                    aria-label="حذف القسم"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {sectionOpen ? (
                <div className="divide-y divide-slate-100">
                  <div className="hidden grid-cols-[minmax(0,1fr)_98px_64px_32px] items-center gap-2 bg-slate-50/60 px-2.5 py-1 text-[8px] font-black tracking-wide text-slate-400 sm:grid">
                    <span>الحقل ومصدره</span>
                    <span>النوع</span>
                    <span>الإلزام</span>
                    <span />
                  </div>
                  {section.fields.map((field) => {
                    const custom = isReportDataModelCustomField(field);
                    return (
                      <div key={field.id} className="grid gap-1.5 px-2.5 py-1.5 sm:grid-cols-[minmax(0,1fr)_98px_64px_32px] sm:items-center">
                        <label className="grid min-w-0 gap-0.5">
                          <Input
                            value={field.label}
                            onChange={(event) => updateField(section.id, field.id, (current) => ({ ...current, label: event.target.value.slice(0, 180) }))}
                            className="h-7 rounded-md border-slate-200 text-[10px] font-bold shadow-none"
                            aria-label="اسم الحقل"
                            disabled={saving}
                            maxLength={180}
                          />
                          <span className="flex min-w-0 items-center gap-1.5 px-0.5">
                            <span className={cn("shrink-0 rounded px-1 py-0.5 text-[7.5px] font-black", custom ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-500")}>
                              {custom ? "مخصص" : "نظام"}
                            </span>
                            <code dir="ltr" className="truncate text-[8px] font-semibold text-slate-400">{field.sourceKey}</code>
                          </span>
                        </label>
                        <Select
                          value={field.type}
                          disabled={saving || !custom}
                          onValueChange={(type) =>
                            updateField(section.id, field.id, (current) => ({
                              ...current,
                              type: type as MvReportDataModelField["type"],
                            }))
                          }
                        >
                          <SelectTrigger className="h-7 rounded-md border-slate-200 text-[9px] font-bold shadow-none">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent dir="rtl">
                            <SelectItem value="text">نص</SelectItem>
                            <SelectItem value="textarea">نص مطوّل</SelectItem>
                            <SelectItem value="number">رقم</SelectItem>
                            <SelectItem value="date">تاريخ</SelectItem>
                          </SelectContent>
                        </Select>
                        <label className="flex h-7 items-center gap-1 rounded-md px-1 text-[8.5px] font-bold text-slate-600">
                          <Checkbox
                            checked={field.required}
                            disabled={saving}
                            onCheckedChange={(checked) => updateField(section.id, field.id, (current) => ({ ...current, required: checked === true }))}
                          />
                          مطلوب
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-300 hover:bg-rose-50 hover:text-rose-700"
                          disabled={saving}
                          onClick={() =>
                            updateSection(section.id, (current) => ({
                              ...current,
                              fields: current.fields.filter((item) => item.id !== field.id),
                            }))
                          }
                          title="حذف الحقل من هذا النموذج"
                          aria-label="حذف الحقل"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                  {section.fields.length === 0 ? (
                    <div className="px-3 py-4 text-center text-[10px] font-semibold text-slate-400">لا توجد حقول في هذا القسم بعد.</div>
                  ) : null}
                </div>
                ) : null}
              </section>
            );
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 h-9 w-full gap-1.5 rounded-xl border-dashed text-[10px] font-black text-slate-600"
            disabled={saving || selected.sections.length >= 30}
            onClick={() => {
              const nextSection = createReportDataModelSection();
              updateSelected((model) => ({ ...model, sections: [...model.sections, nextSection] }));
              setOpenSectionIds((current) =>
                current.includes(nextSection.id) ? current : [...current, nextSection.id],
              );
            }}
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            إضافة قسم
          </Button>
        </section>
      </div>
    </div>
  );
}
