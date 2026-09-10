"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Copy, Eye, EyeOff, FilePlus2, FolderPlus, Plus, Star, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  cloneReportSectionModel,
  createReportSectionModelItem,
  createReportSectionModelSection,
  normalizeReportSectionModels,
} from "@/components/workspace/workspace-sections/machine-valuation/mv-report-section-models";
import { createReportCustomId } from "@/components/workspace/workspace-sections/machine-valuation/mv-report-custom-fields";
import type {
  MvCompanyReportSectionModel,
  MvCompanyReportSectionModelItem,
  MvCompanyReportSectionModelSection,
} from "@/components/workspace/workspace-sections/machine-valuation/types";

type Props = {
  models: MvCompanyReportSectionModel[];
  loading?: boolean;
  saving?: boolean;
  dirty?: boolean;
  onChange: (models: MvCompanyReportSectionModel[]) => void;
};

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
      className="h-8 w-8 shrink-0 rounded-lg text-slate-500 hover:bg-sky-50 hover:text-[#0C447C]"
      onClick={onClick}
      title={action + label + suffix}
      aria-label={action + label + suffix}
    >
      {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </Button>
  );
}

export function CompanyReportSectionModelDashboard({
  models,
  loading = false,
  saving = false,
  dirty = false,
  onChange,
}: Props) {
  const normalized = useMemo(() => normalizeReportSectionModels(models), [models]);
  const [activeId, setActiveId] = useState<string>(normalized[0]?.id ?? "");

  useEffect(() => {
    if (!normalized.some((model) => model.id === activeId)) {
      setActiveId(normalized[0]?.id ?? "");
    }
  }, [activeId, normalized]);

  const active = normalized.find((model) => model.id === activeId) ?? null;
  const commit = (next: MvCompanyReportSectionModel[]) => onChange(normalizeReportSectionModels(next));
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
              items: section.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
            }
          : section,
      ),
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-400">
        جارٍ تحميل نماذج التقرير…
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-l from-sky-50/80 via-white to-white px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <FilePlus2 className="h-4.5 w-4.5 text-[#0C447C]" />
            <h3 className="text-[14px] font-black text-slate-900">نماذج أقسام وتعريفات التقرير</h3>
            {dirty ? (
              <Badge className="border-amber-100 bg-amber-50 text-[10px] text-amber-700 hover:bg-amber-50">تعديلات غير محفوظة</Badge>
            ) : null}
          </div>
          <p className="mt-1 max-w-3xl text-[11px] font-medium leading-5 text-slate-500">
            أنشئ نموذجًا باسمك، ثم أضف أقسامه وبنوده وتعريفاته. أيقونة العين تتحكم في الظهور داخل التقرير النهائي.
          </p>
        </div>
        <Button
          type="button"
          className="h-9 rounded-xl bg-[#0C447C] text-[11px] hover:bg-[#0a3a66]"
          onClick={() => {
            const model = newModel();
            commit([...normalized, model]);
            setActiveId(model.id);
          }}
          disabled={saving || normalized.length >= 12}
        >
          <Plus className="h-4 w-4" />
          إضافة نموذج
        </Button>
      </div>

      <div className="grid min-h-[540px] lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="border-l border-slate-100 bg-slate-50/70 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-black text-slate-700">النماذج</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">{normalized.length}</span>
          </div>
          <div className="space-y-1.5">
            {normalized.map((model) => {
              const selected = model.id === activeId;
              return (
                <div key={model.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveId(model.id)}
                    className={cn(
                      "min-w-0 flex-1 rounded-xl border px-2.5 py-2 text-right transition",
                      selected
                        ? "border-sky-200 bg-white text-[#0C447C] shadow-sm"
                        : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white",
                    )}
                  >
                    <span className="block truncate text-[11px] font-black">{model.name}</span>
                    <span className="mt-0.5 block text-[9px] font-medium text-slate-400">{model.sections.length} أقسام</span>
                  </button>
                  {visibilityButton(
                    model.visibleInReport !== false,
                    () => patchModel(model.id, { visibleInReport: model.visibleInReport === false }),
                    "النموذج",
                  )}
                </div>
              );
            })}
          </div>
          {normalized.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] font-bold leading-5 text-slate-400">
              أضف أول نموذج لتبدأ بتكوين التقرير.
            </div>
          ) : null}
        </aside>

        <div className="min-w-0 p-4">
          {active ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="min-w-[200px] flex-1">
                  <Label className="mb-1 block text-[11px] font-bold text-slate-600">اسم النموذج</Label>
                  <Input
                    value={active.name}
                    onChange={(event) => patchModel(active.id, { name: event.target.value })}
                    className="h-9 rounded-xl border-slate-200 bg-white text-[12px] font-black"
                    maxLength={160}
                  />
                </div>
                <Button
                  type="button"
                  variant={active.isDefault ? "secondary" : "outline"}
                  className="h-9 rounded-xl text-[11px]"
                  onClick={() => commit(normalized.map((model) => ({ ...model, isDefault: model.id === active.id })))}
                >
                  <Star className="h-3.5 w-3.5" />
                  {active.isDefault ? "النموذج الافتراضي" : "تعيين كافتراضي"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl text-[11px]"
                  onClick={() => {
                    const copied = cloneReportSectionModel(active);
                    commit([...normalized, copied]);
                    setActiveId(copied.id);
                  }}
                  disabled={normalized.length >= 12}
                >
                  <Copy className="h-3.5 w-3.5" />
                  نسخ
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-xl border-rose-100 text-[11px] text-rose-600 hover:bg-rose-50"
                  onClick={() => {
                    if (window.confirm("حذف نموذج «" + active.name + "»؟")) {
                      const next = normalized.filter((model) => model.id !== active.id);
                      commit(next);
                      setActiveId(next[0]?.id ?? "");
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف النموذج
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[12px] font-black text-slate-800">الأقسام والبنود</h4>
                  <p className="mt-0.5 text-[10.5px] text-slate-500">يمكنك ترتيب النص كما تريد، وإخفاء القسم أو البند دون حذفه.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-xl text-[11px]"
                  onClick={() => patchModel(active.id, { sections: [...active.sections, createReportSectionModelSection()] })}
                  disabled={active.sections.length >= 30}
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  إضافة قسم
                </Button>
              </div>

              <div className="space-y-3">
                {active.sections.map((section) => (
                  <div key={section.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="grid gap-2 sm:grid-cols-[90px_minmax(0,1fr)_auto]">
                      <Input
                        value={section.sectionNumber ?? ""}
                        onChange={(event) => patchSection(section.id, { sectionNumber: event.target.value })}
                        placeholder="رقم القسم"
                        className="h-9 rounded-xl border-slate-200 text-[11px] font-bold"
                        dir="ltr"
                        maxLength={40}
                      />
                      <Input
                        value={section.title}
                        onChange={(event) => patchSection(section.id, { title: event.target.value })}
                        placeholder="اسم القسم"
                        className="h-9 rounded-xl border-slate-200 text-[12px] font-black"
                        maxLength={220}
                      />
                      <div className="flex items-center justify-end gap-1">
                        {visibilityButton(
                          section.visibleInReport !== false,
                          () => patchSection(section.id, { visibleInReport: section.visibleInReport === false }),
                          "القسم",
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-50"
                          onClick={() => patchModel(active.id, { sections: active.sections.filter((item) => item.id !== section.id) })}
                          title="حذف القسم"
                          aria-label="حذف القسم"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                      {section.items.map((item) => (
                        <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                          <div className="flex gap-2">
                            <Input
                              value={item.title}
                              onChange={(event) => patchItem(section.id, item.id, { title: event.target.value })}
                              placeholder="عنوان البند أو التعريف"
                              className="h-8 border-slate-200 bg-white text-[11px] font-bold"
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
                              className="h-8 w-8 shrink-0 rounded-lg text-rose-500 hover:bg-rose-50"
                              onClick={() => patchSection(section.id, { items: section.items.filter((entry) => entry.id !== item.id) })}
                              title="حذف البند"
                              aria-label="حذف البند"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <Textarea
                            value={item.body ?? ""}
                            onChange={(event) => patchItem(section.id, item.id, { body: event.target.value })}
                            placeholder="نص التعريف أو البند الذي سيظهر داخل التقرير"
                            className="mt-2 min-h-[72px] resize-y border-slate-200 bg-white text-[11px] leading-5"
                            maxLength={50_000}
                          />
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 rounded-lg px-2 text-[11px] text-[#0C447C] hover:bg-sky-50"
                        onClick={() => patchSection(section.id, { items: [...section.items, createReportSectionModelItem()] })}
                        disabled={active.sections.reduce((total, entry) => total + entry.items.length, 0) >= 160}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        إضافة بند أو تعريف
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
