"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, CheckCircle2, Printer, Signature } from "lucide-react";
import { Button } from "@/components/ui/button";
import SmartGrid, {
  type CellChange,
  type SmartGridAssetRecord,
  type SmartGridAssetType,
} from "@/components/smart-grid/SmartGrid";
import ValuationFormPanel from "@/components/valuation-forms/ValuationFormPanel";
import { serializeValuationValues } from "@/components/valuation-forms/shared";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { MvSheetData, MvSubProject } from "./types";
import AssetImportPanel, {
  type ActiveImportSheetRef,
  type AssetImportResult,
  mergeImportResults,
  migrateStoredActiveRef,
  normalizeImportResult,
  resolveSmartGridImport,
} from "./asset-import-panel";
import { readActiveImportSheetRef, writeActiveImportSheetRef } from "./mv-asset-import-active-sheet";
import {
  MV_WORKFLOW_STEPS,
  formatSarCurrency,
  MV_ASSET_TYPE_META,
  MvAssetTypeBadge,
  MvEmptyState,
  MvRailItem,
  type MvSaveState,
  type MvWorkflowStepId,
} from "./mv-ui";

export interface MvAssetWorkspaceSnapshot {
  importResult: AssetImportResult | null;
  assetType: SmartGridAssetType;
  activeAsset: SmartGridAssetRecord | null;
  rows: SmartGridAssetRecord[];
  saveState: MvSaveState;
  completedCount: number;
}

interface MvAssetWorkspaceProps {
  projectId: string;
  projectName: string;
  subProjects: MvSubProject[];
  sheets: MvSheetData[];
  onStateChange?: (snapshot: MvAssetWorkspaceSnapshot) => void;
  /** عند المسار الكامل: إظهار قسم واحد فقط (استيراد / مراجعة الشبكة) */
  fullPageSection?: MvWorkflowStepId | null;
}

type RailFilter = "all" | "completed" | "not_started";

function getTextValue(asset: SmartGridAssetRecord | null, key: string, fallback = "") {
  if (!asset) return fallback;
  const directValue = asset[key];
  if (typeof directValue === "string" && directValue.trim()) return directValue;
  const normalizedValue = asset.normalizedData?.[key];
  if (typeof normalizedValue === "string" && normalizedValue.trim()) return normalizedValue;
  const rawValue = asset.rawData?.[key];
  if (typeof rawValue === "string" && rawValue.trim()) return rawValue;
  return fallback;
}

function getNumberValue(asset: SmartGridAssetRecord | null, key: string) {
  if (!asset) return undefined;
  const candidates = [asset[key], asset.normalizedData?.[key], asset.rawData?.[key]];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function resolveAssetTitle(asset: SmartGridAssetRecord) {
  return (
    getTextValue(asset, "name") ||
    getTextValue(asset, "assetName") ||
    getTextValue(asset, "assetId") ||
    getTextValue(asset, "model") ||
    getTextValue(asset, "manufacturer") ||
    `أصل ${asset.rowIndex ?? ""}`.trim()
  );
}

function resolveAssetStatus(asset: SmartGridAssetRecord) {
  if (asset.status === "valued" || asset.status === "archived") {
    return { label: "مكتمل", dot: "#3B6D11", completed: true };
  }
  if (asset.status === "reviewed") {
    return { label: "قيد التقييم", dot: "#378ADD", completed: false };
  }
  return { label: "لم يبدأ", dot: "#D3D1C7", completed: false };
}

function buildMarketComparables(asset: SmartGridAssetRecord | null) {
  const originalCost = getNumberValue(asset, "originalCost") ?? 185000;
  const condition = getNumberValue(asset, "condition") ?? 3;
  const conditionBoost = 1 + (condition - 3) * 0.04;

  return [
    { source: "حراج حكومي", price: originalCost * 0.96, adjustment: -5 },
    { source: "معرض تجهيزات", price: originalCost * 1.04, adjustment: 3 },
    { source: "مورد صناعي", price: originalCost * 1.01 * conditionBoost, adjustment: 1 },
  ].map((item) => ({
    ...item,
    final: item.price * (1 + item.adjustment / 100),
  }));
}

const DEFAULT_SECTION_STATE: Record<MvWorkflowStepId, boolean> = {
  import: false,
  review: false,
  classify: false,
  market: false,
  cost: false,
  adjustments: false,
  report: false,
};

function MvWorkflowSectionHeader({
  stepId,
  title,
  description,
  summary,
  expanded,
  onToggle,
  children,
  presentation = "accordion",
  chromeless = false,
}: {
  stepId: MvWorkflowStepId;
  title: string;
  description: string;
  summary: ReactNode;
  expanded: boolean;
  onToggle: (stepId: MvWorkflowStepId) => void;
  children: ReactNode;
  presentation?: "accordion" | "plain" | "minimal";
  /** مع minimal: إخفاء عنوان القسم لعرض المحتوى من أعلى الصفحة (مثل شبكة إكسل) */
  chromeless?: boolean;
}) {
  const stepIndex = MV_WORKFLOW_STEPS.findIndex((step) => step.id === stepId);
  const isPlain = presentation === "plain";
  const isMinimal = presentation === "minimal";

  if (isMinimal && chromeless) {
    return (
      <div className="text-right" dir="rtl">
        <div id={`${stepId}-content`}>{children}</div>
      </div>
    );
  }

  if (isMinimal) {
    return (
      <div className="px-3 pb-3 pt-2 text-right" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <h2 className="text-sm font-semibold text-[#0C447C]">{title}</h2>
          {summary ? (
            <span className="text-[11px] text-slate-500 tabular-nums">{summary}</span>
          ) : null}
        </div>
        <div id={`${stepId}-content`} className="pt-3">
          {children}
        </div>
      </div>
    );
  }

  if (isPlain) {
    return (
      <div className="px-4 pb-4 pt-4 text-right" dir="rtl">
        <div className="flex items-start gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-medium"
            style={{
              background: "#E6F1FB",
              color: "#0C447C",
              border: "1.5px solid #378ADD",
            }}
          >
            {stepIndex + 1}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {title}
            </div>
            <p className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
              {description}
            </p>
            <div className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
              {summary}
            </div>
          </div>
        </div>
        <div
          id={`${stepId}-content`}
          className="mt-4 border-t px-0 pb-0 pt-4"
          style={{ borderColor: "var(--color-border-tertiary)" }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onToggle(stepId)}
        className="flex w-full items-start justify-between gap-4 px-4 py-4 text-right transition-colors hover:bg-[var(--color-background-secondary)]"
        aria-expanded={expanded}
        aria-controls={`${stepId}-content`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-medium"
            style={{
              background: expanded ? "#E6F1FB" : "var(--color-background-secondary)",
              color: expanded ? "#0C447C" : "var(--color-text-secondary)",
              border: expanded ? "1.5px solid #378ADD" : "1px solid var(--color-border-tertiary)",
            }}
          >
            {stepIndex + 1}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>
              {title}
            </div>
            <p className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
              {description}
            </p>
            <div className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
              {summary}
            </div>
          </div>
        </div>

        <span className="mt-1 inline-flex items-center gap-2 text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
          {expanded ? "إخفاء التفاصيل" : "إظهار التفاصيل"}
          <ChevronDown
            className="h-4 w-4 transition-transform"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </span>
      </button>
      {expanded ? (
        <div
          id={`${stepId}-content`}
          className="border-t px-4 pb-4"
          style={{ borderColor: "var(--color-border-tertiary)" }}
        >
          {children}
        </div>
      ) : null}
    </>
  );
}

export default function MvAssetWorkspace({
  projectId,
  projectName,
  subProjects: _subProjects,
  sheets: _sheets,
  onStateChange,
  fullPageSection = null,
}: MvAssetWorkspaceProps) {
  const { toast } = useToast();
  const storageKey = `sv:asset-import:${projectId}`;
  const [assetType, setAssetType] = useState<SmartGridAssetType>("other");
  const [activeAsset, setActiveAsset] = useState<SmartGridAssetRecord | null>(null);
  const [rows, setRows] = useState<SmartGridAssetRecord[]>([]);
  const [refreshToken, setRefreshToken] = useState(0);
  const [importResult, setImportResult] = useState<AssetImportResult | null>(null);
  const [activeImportSheet, setActiveImportSheet] = useState<ActiveImportSheetRef | null>(null);
  const [railFilter, setRailFilter] = useState<RailFilter>("all");
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [saveState, setSaveState] = useState<MvSaveState>("idle");
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] =
    useState<Record<MvWorkflowStepId, boolean>>(DEFAULT_SECTION_STATE);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawValue = window.sessionStorage.getItem(storageKey);
    if (!rawValue) return;
    try {
      const parsed = JSON.parse(rawValue) as AssetImportResult;
      if (parsed.projectId !== projectId) return;
      if (!Array.isArray(parsed.summary?.sheets)) {
        parsed.summary = { ...parsed.summary, sheets: [] };
      }
      const normalized = normalizeImportResult(parsed);
      setImportResult(normalized);
      setAssetType("other");
      const stored = readActiveImportSheetRef(projectId);
      const migrated = migrateStoredActiveRef(stored, normalized);
      if (migrated) {
        setActiveImportSheet(migrated);
      } else {
        setActiveImportSheet(null);
      }
    } catch {
      window.sessionStorage.removeItem(storageKey);
    }
  }, [projectId, storageKey]);

  const persistActiveImportSheet = (ref: ActiveImportSheetRef | null) => {
    setActiveImportSheet(ref);
  };

  useEffect(() => {
    writeActiveImportSheetRef(projectId, activeImportSheet);
  }, [activeImportSheet, projectId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (importResult) {
      window.sessionStorage.setItem(storageKey, JSON.stringify(importResult));
    } else {
      window.sessionStorage.removeItem(storageKey);
    }
  }, [importResult, storageKey]);

  useEffect(() => {
    if (fullPageSection) {
      setExpandedSections(() => {
        const next = { ...DEFAULT_SECTION_STATE };
        next[fullPageSection] = true;
        return next;
      });
      return;
    }

    if (typeof window === "undefined") return;

    const openSectionFromHash = () => {
      const hash = window.location.hash.replace(/^#/, "") as MvWorkflowStepId;
      if (!MV_WORKFLOW_STEPS.some((step) => step.id === hash)) return;
      setExpandedSections((current) => ({ ...current, [hash]: true }));
    };

    const handleOpenStep = (event: Event) => {
      const detail = (event as CustomEvent<{ stepId?: MvWorkflowStepId }>).detail;
      if (!detail?.stepId) return;
      setExpandedSections((current) => ({ ...current, [detail.stepId!]: true }));
    };

    openSectionFromHash();
    window.addEventListener("hashchange", openSectionFromHash);
    window.addEventListener("sv:mv-open-step", handleOpenStep as EventListener);
    return () => {
      window.removeEventListener("hashchange", openSectionFromHash);
      window.removeEventListener("sv:mv-open-step", handleOpenStep as EventListener);
    };
  }, [fullPageSection]);

  useEffect(() => {
    if (rows.length === 0) {
      setActiveAsset(null);
      return;
    }
    if (!activeAsset) {
      setActiveAsset(rows[0] ?? null);
      return;
    }
    const matchingRow = rows.find((row) => row.id === activeAsset.id);
    setActiveAsset(matchingRow ?? rows[0] ?? null);
  }, [activeAsset, rows]);

  const completedCount = useMemo(
    () => rows.filter((asset) => resolveAssetStatus(asset).completed).length,
    [rows],
  );

  useEffect(() => {
    onStateChange?.({
      importResult,
      assetType,
      activeAsset,
      rows,
      saveState,
      completedCount,
    });
  }, [activeAsset, assetType, completedCount, importResult, onStateChange, rows, saveState]);

  const filteredRailAssets = useMemo(() => {
    return rows.filter((asset) => {
      const status = resolveAssetStatus(asset);
      if (railFilter === "completed") return status.completed;
      if (railFilter === "not_started") return asset.status === "pending_review";
      return true;
    });
  }, [railFilter, rows]);

  const marketComparables = useMemo(() => buildMarketComparables(activeAsset), [activeAsset]);
  const marketAverage = useMemo(() => {
    if (marketComparables.length === 0) return 0;
    return marketComparables.reduce((sum, item) => sum + item.final, 0) / marketComparables.length;
  }, [marketComparables]);

  const originalCost = getNumberValue(activeAsset, "originalCost") ?? marketAverage;
  const condition = getNumberValue(activeAsset, "condition") ?? 3;
  const physicalDepreciation = Math.min(60, Math.max(10, (6 - condition) * 10));
  const technicalDepreciation = activeAsset?.assetType === "machinery" ? 5 : 3;
  const externalDepreciation = 5;
  const depreciatedValue =
    originalCost *
    (1 - physicalDepreciation / 100) *
    (1 - technicalDepreciation / 100) *
    (1 - externalDepreciation / 100);

  const handleImported = (result: AssetImportResult) => {
    const normalized = normalizeImportResult(result);
    setImportResult((prev) => {
      const merged = mergeImportResults(prev, normalized);
      setActiveImportSheet((ar) => {
        if (!ar) return null;
        return merged.summary.sheets.some(
          (s) => s.importId === ar.importId && s.sheetName === ar.sheetName,
        )
          ? ar
          : null;
      });
      return merged;
    });
    setAssetType("other");
    setActiveAsset(null);
    setRefreshToken((current) => current + 1);
    setSaveState("saved");
    toast({ description: "تم الاستيراد." });
  };

  const handleImportResultChange = (next: AssetImportResult | null) => {
    setImportResult(next);
    if (!next) {
      setActiveImportSheet(null);
      writeActiveImportSheetRef(projectId, null);
      setRows([]);
      setActiveAsset(null);
    }
    setRefreshToken((current) => current + 1);
  };

  const gridImport = resolveSmartGridImport(importResult, activeImportSheet);

  const handleSave = (changes: CellChange[]) => {
    if (changes.length > 0) {
      setSaveState("saved");
    }
  };

  const handleFormSubmit = async (values: Record<string, unknown>) => {
    if (!activeAsset) return;
    try {
      setIsSavingForm(true);
      setSaveState("saving");
      const response = await fetch(`/api/assets/${activeAsset.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          changes: serializeValuationValues(values),
        }),
      });
      if (!response.ok) {
        throw new Error("تعذر حفظ نموذج التقييم.");
      }
      const updatedAsset = (await response.json()) as SmartGridAssetRecord;
      setActiveAsset(updatedAsset);
      setRows((current) => current.map((row) => (row.id === updatedAsset.id ? updatedAsset : row)));
      setRefreshToken((current) => current + 1);
      setSaveState("saved");
      toast({ description: "تم حفظ نموذج التقييم بنجاح." });
    } catch (error) {
      setSaveState("error");
      toast({
        variant: "destructive",
        description:
          error instanceof Error ? error.message : "تعذر حفظ نموذج التقييم.",
      });
    } finally {
      setIsSavingForm(false);
    }
  };

  const toggleSection = (stepId: MvWorkflowStepId) => {
    setExpandedSections((current) => ({ ...current, [stepId]: !current[stepId] }));
  };

  const showWorkflowSection = (id: MvWorkflowStepId) => !fullPageSection || fullPageSection === id;
  const sectionPresentation = (id: MvWorkflowStepId): "accordion" | "minimal" =>
    fullPageSection === id ? "minimal" : "accordion";

  return (
    <div className={cn("space-y-6", fullPageSection && "space-y-0")} dir="rtl">
      {showWorkflowSection("import") ? (
        <section
          id="import"
          className="scroll-mt-40 overflow-hidden rounded-lg border bg-white shadow-sm"
          style={{ borderColor: "var(--color-border-tertiary)" }}
        >
          <div className="px-3 pb-3 pt-2">
            <AssetImportPanel
              stepTitle="استيراد البيانات"
              projectId={projectId}
              importResult={importResult}
              onImported={handleImported}
              onImportResultChange={handleImportResultChange}
              activeSheet={activeImportSheet}
              onActiveSheetChange={persistActiveImportSheet}
              onSheetsDirty={() => setRefreshToken((current) => current + 1)}
              onClearImport={() => {
                setImportResult(null);
                setActiveImportSheet(null);
                writeActiveImportSheetRef(projectId, null);
                setRows([]);
                setActiveAsset(null);
                setRefreshToken((current) => current + 1);
              }}
            />
          </div>
        </section>
      ) : null}

      {showWorkflowSection("review") ? (
      <section
        id="review"
        className="scroll-mt-40 rounded-lg border bg-white shadow-sm"
        style={{ borderColor: "var(--color-border-tertiary)" }}
      >
        <MvWorkflowSectionHeader
          stepId="review"
          title="معالجة ومراجعة البيانات"
          description=""
          summary={rows.length > 0 ? `${rows.length} أصل` : ""}
          expanded={expandedSections.review}
          onToggle={toggleSection}
          presentation="minimal"
          chromeless
        >
          <SmartGrid
            projectId={projectId}
            importId={gridImport.importId}
            importSheetName={gridImport.sheetName}
            assetType="other"
            omitAssetTypeFilter
            schemaAssetType="other"
            rowCheckboxColumn
            editOnSingleClick
            sheetColumns
            allowAppendImportRows
            onSave={handleSave}
            onRowsLoaded={setRows}
            onSaveStateChange={setSaveState}
            refreshToken={refreshToken}
          />
        </MvWorkflowSectionHeader>
      </section>
      ) : null}

      {showWorkflowSection("classify") ? (
      <section
        id="classify"
        className="scroll-mt-52 overflow-hidden rounded-[18px] border bg-white shadow-sm"
        style={{ borderColor: "var(--color-border-tertiary)" }}
      >
        <MvWorkflowSectionHeader
          stepId="classify"
          title="تصنيف الأصول ونموذج التقييم"
          description="اختر الأصل من القائمة اليمنى ثم حدّث بياناته الأساسية والفنية مباشرة."
          summary={
            activeAsset
              ? `الأصل النشط: ${resolveAssetTitle(activeAsset)}`
              : rows.length > 0
                ? `${rows.length} أصل متاح للتقييم`
                : "لن يظهر النموذج قبل توفر أصل محدد"
          }
          expanded={expandedSections.classify}
          onToggle={toggleSection}
          presentation={sectionPresentation("classify")}
        >
          <div className="mt-4 flex h-auto flex-col overflow-hidden rounded-[14px] border lg:h-[calc(100vh-12rem)] lg:flex-row" style={{ borderColor: "var(--color-border-tertiary)" }}>
            <aside
              className="w-full shrink-0 border-b lg:w-[220px] lg:border-b-0 lg:border-l"
              style={{ borderColor: "var(--color-border-tertiary)" }}
            >
              <div
                className="sticky top-0 space-y-3 border-b px-3 py-3"
                style={{ borderColor: "var(--color-border-tertiary)", background: "var(--color-background-secondary)" }}
              >
                <div className="text-[12px] font-medium">أصول {projectName}</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setRailFilter("all")}
                    className="rounded-full border px-2.5 py-1 text-[10px]"
                    style={{
                      borderColor: railFilter === "all" ? "#B5D4F4" : "var(--color-border-tertiary)",
                      background: railFilter === "all" ? "#E6F1FB" : "white",
                      color: railFilter === "all" ? "#0C447C" : "var(--color-text-secondary)",
                    }}
                  >
                    الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setRailFilter("completed")}
                    className="rounded-full border px-2.5 py-1 text-[10px]"
                    style={{
                      borderColor: railFilter === "completed" ? "#97C459" : "var(--color-border-tertiary)",
                      background: railFilter === "completed" ? "#EAF3DE" : "white",
                      color: railFilter === "completed" ? "#27500A" : "var(--color-text-secondary)",
                    }}
                  >
                    مكتمل
                  </button>
                  <button
                    type="button"
                    onClick={() => setRailFilter("not_started")}
                    className="rounded-full border px-2.5 py-1 text-[10px]"
                    style={{
                      borderColor: railFilter === "not_started" ? "#F0997B" : "var(--color-border-tertiary)",
                      background: railFilter === "not_started" ? "#FFF3EF" : "white",
                      color: railFilter === "not_started" ? "#A32D2D" : "var(--color-text-secondary)",
                    }}
                  >
                    لم يبدأ
                  </button>
                </div>
              </div>

              <div className="max-h-[380px] overflow-y-auto lg:max-h-[calc(100vh-18rem)]">
                {filteredRailAssets.length === 0 ? (
                  <MvEmptyState
                    title="لا توجد أصول"
                    description="ابدأ بالاستيراد أولاً أو غيّر فلتر الحالة لعرض مزيد من الأصول."
                  />
                ) : (
                  filteredRailAssets.map((asset) => {
                    const status = resolveAssetStatus(asset);
                    return (
                      <MvRailItem
                        key={asset.id}
                        title={resolveAssetTitle(asset)}
                        subtitle={status.label}
                        active={activeAsset?.id === asset.id}
                        statusDot={status.dot}
                        trailing={<MvAssetTypeBadge assetType={asset.assetType} />}
                        onClick={() => setActiveAsset(asset)}
                      />
                    );
                  })
                )}
              </div>

              <div
                className="space-y-2 border-t px-3 py-3"
                style={{ borderColor: "var(--color-border-tertiary)", background: "var(--color-background-secondary)" }}
              >
                <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                  <span>
                    {completedCount} / {rows.length} مكتمل
                  </span>
                  <span>{rows.length} أصل</span>
                </div>
                <div className="h-[3px] overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[#378ADD]"
                    style={{ width: rows.length > 0 ? `${(completedCount / rows.length) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            </aside>

            <div className="flex-1 overflow-y-auto p-4">
              <ValuationFormPanel asset={activeAsset} saving={isSavingForm} onSubmit={handleFormSubmit} />
            </div>
          </div>
        </MvWorkflowSectionHeader>
      </section>
      ) : null}

      {showWorkflowSection("market") ? (
      <section
        id="market"
        className="scroll-mt-52 overflow-hidden rounded-[18px] border bg-white shadow-sm"
        style={{ borderColor: "var(--color-border-tertiary)" }}
      >
        <MvWorkflowSectionHeader
          stepId="market"
          title="نهج السوق"
          description="قراءة سريعة لأسعار المقارنات المحتملة ومتوسط القيمة المرجّحة للأصل المحدد."
          summary={
            activeAsset
              ? `${marketComparables.length} مقارنات • متوسط ${formatSarCurrency(marketAverage || 0)}`
              : "اختر أصلاً لعرض المقارنات السوقية"
          }
          expanded={expandedSections.market}
          onToggle={toggleSection}
          presentation={sectionPresentation("market")}
        >
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_280px]">
            <div className="rounded-2xl border bg-[var(--color-background-secondary)] p-4" style={{ borderColor: "var(--color-border-tertiary)" }}>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-white p-3">
                  <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                    الأصل المحدد
                  </p>
                  <p className="mt-1 text-[15px] font-medium">{activeAsset ? resolveAssetTitle(activeAsset) : "اختر أصلاً"}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                    متوسط المقارنات
                  </p>
                  <p className="mt-1 text-[15px] font-medium">{formatSarCurrency(marketAverage || 0)}</p>
                </div>
                <div className="rounded-xl bg-white p-3">
                  <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                    الحالة
                  </p>
                  <p className="mt-1 text-[15px] font-medium">{condition} / 5</p>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border bg-white" style={{ borderColor: "var(--color-border-tertiary)" }}>
                <table className="min-w-full text-right text-[12px]">
                  <thead style={{ background: "#F1EFE8" }}>
                    <tr>
                      <th className="px-4 py-3">المصدر</th>
                      <th className="px-4 py-3">السعر</th>
                      <th className="px-4 py-3">التعديل</th>
                      <th className="px-4 py-3">المعدل</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketComparables.map((item) => (
                      <tr key={item.source} className="border-t" style={{ borderColor: "var(--color-border-tertiary)" }}>
                        <td className="px-4 py-3">{item.source}</td>
                        <td className="px-4 py-3 text-left tabular-nums">{formatSarCurrency(item.price)}</td>
                        <td className="px-4 py-3 text-left tabular-nums">
                          {item.adjustment > 0 ? "+" : ""}
                          {item.adjustment}%
                        </td>
                        <td className="px-4 py-3 text-left tabular-nums">{formatSarCurrency(item.final)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border bg-[#EAF3DE] p-4" style={{ borderColor: "#97C459" }}>
              <p className="text-[11px]" style={{ color: "#27500A" }}>
                القيمة السوقية المرجّحة
              </p>
              <p className="mt-2 text-[24px] font-medium" style={{ color: "#27500A" }}>
                {formatSarCurrency(marketAverage || 0)}
              </p>
              <div className="mt-4 border-t pt-3 text-[12px]" style={{ borderColor: "#97C459", color: "#27500A" }}>
                تم احتساب المتوسط من {marketComparables.length} مصادر مقارنة مع مراعاة حالة الأصل الحالي.
              </div>
            </div>
          </div>
        </MvWorkflowSectionHeader>
      </section>
      ) : null}

      {showWorkflowSection("cost") ? (
      <section
        id="cost"
        className="scroll-mt-52 overflow-hidden rounded-[18px] border bg-white shadow-sm"
        style={{ borderColor: "var(--color-border-tertiary)" }}
      >
        <MvWorkflowSectionHeader
          stepId="cost"
          title="نهج التكلفة"
          description="تكلفة الاستبدال الحالية، الإهلاك الفني والوظيفي، ثم القيمة النهائية التقديرية."
          summary={
            activeAsset
              ? `تكلفة ${formatSarCurrency(originalCost || 0)} • قيمة مستخلصة ${formatSarCurrency(Math.max(0, depreciatedValue))}`
              : "افتح هذه المرحلة بعد اختيار أصل لحساب نهج التكلفة"
          }
          expanded={expandedSections.cost}
          onToggle={toggleSection}
          presentation={sectionPresentation("cost")}
        >
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border bg-[var(--color-background-secondary)] p-4" style={{ borderColor: "var(--color-border-tertiary)" }}>
                <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                  تكلفة الاستبدال الحالية
                </p>
                <p className="mt-2 text-[18px] font-medium">{formatSarCurrency(originalCost || 0)}</p>
              </div>
              <div className="rounded-2xl border bg-[var(--color-background-secondary)] p-4" style={{ borderColor: "var(--color-border-tertiary)" }}>
                <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                  الإهلاك المادي
                </p>
                <p className="mt-2 text-[18px] font-medium">{physicalDepreciation}%</p>
              </div>
              <div className="rounded-2xl border bg-[var(--color-background-secondary)] p-4" style={{ borderColor: "var(--color-border-tertiary)" }}>
                <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                  إهلاك وظيفي
                </p>
                <p className="mt-2 text-[18px] font-medium">{technicalDepreciation}%</p>
              </div>
              <div className="rounded-2xl border bg-[var(--color-background-secondary)] p-4" style={{ borderColor: "var(--color-border-tertiary)" }}>
                <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                  إهلاك خارجي
                </p>
                <p className="mt-2 text-[18px] font-medium">{externalDepreciation}%</p>
              </div>
            </div>

            <div className="rounded-2xl border bg-[#EAF3DE] p-4" style={{ borderColor: "#97C459" }}>
              <p className="text-[11px]" style={{ color: "#27500A" }}>
                القيمة المستخلصة
              </p>
              <p className="mt-2 text-[24px] font-medium" style={{ color: "#27500A" }}>
                {formatSarCurrency(Math.max(0, depreciatedValue))}
              </p>
              <div className="mt-4 space-y-2 border-t pt-3 text-[12px]" style={{ borderColor: "#97C459" }}>
                <div className="flex items-center justify-between">
                  <span>تكلفة الاستبدال</span>
                  <span>{formatSarCurrency(originalCost || 0)}</span>
                </div>
                <div className="flex items-center justify-between text-[var(--color-text-danger)]">
                  <span>إهلاك مادي</span>
                  <span>-{physicalDepreciation}%</span>
                </div>
                <div className="flex items-center justify-between text-[var(--color-text-danger)]">
                  <span>إهلاك وظيفي + خارجي</span>
                  <span>-{technicalDepreciation + externalDepreciation}%</span>
                </div>
              </div>
            </div>
          </div>
        </MvWorkflowSectionHeader>
      </section>
      ) : null}

      {showWorkflowSection("adjustments") ? (
      <section
        id="adjustments"
        className="scroll-mt-52 overflow-hidden rounded-[18px] border bg-white shadow-sm"
        style={{ borderColor: "var(--color-border-tertiary)" }}
      >
        <MvWorkflowSectionHeader
          stepId="adjustments"
          title="التعديلات النهائية"
          description="مراجعة مؤشرات الصيانة والموقع والحالة التشغيلية قبل تثبيت القيمة النهائية."
          summary={
            activeAsset
              ? `حالة ${condition}/5 • ${condition <= 2 ? "مخاطر تشغيلية مرتفعة" : "مخاطر تشغيلية منخفضة"}`
              : "افتح هذه المرحلة لمراجعة جاهزية الأصل قبل اعتماد التقرير"
          }
          expanded={expandedSections.adjustments}
          onToggle={toggleSection}
          presentation={sectionPresentation("adjustments")}
        >
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {[
              { title: "تشغيل فعلي", value: activeAsset ? "مفعل" : "غير محدد", checked: true },
              { title: "مخاطر تشغيلية", value: condition <= 2 ? "مرتفعة" : "منخفضة", checked: condition <= 2 },
              { title: "جاهزية التقرير", value: activeAsset ? "قابلة للاعتماد" : "تحتاج أصل محدد", checked: Boolean(activeAsset) },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border p-4"
                style={{
                  borderColor: "var(--color-border-tertiary)",
                  background: item.checked ? "var(--color-background-info)" : "var(--color-background-secondary)",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
                      {item.title}
                    </p>
                    <p className="mt-2 text-[16px] font-medium">{item.value}</p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-[#378ADD]" />
                </div>
              </div>
            ))}
          </div>
        </MvWorkflowSectionHeader>
      </section>
      ) : null}

      {showWorkflowSection("report") ? (
      <section
        id="report"
        className="scroll-mt-52 overflow-hidden rounded-[18px] border bg-white shadow-sm"
        style={{ borderColor: "var(--color-border-tertiary)" }}
      >
        <MvWorkflowSectionHeader
          stepId="report"
          title="التقرير"
          description="معاينة نهائية للتقرير مع خيارات التصدير والتوقيع الرقمي قبل الاعتماد."
          summary={
            signedAt
              ? `موقّع في ${signedAt}`
              : `قيمة مرجّحة ${formatSarCurrency(Math.max(marketAverage, depreciatedValue, 0))}`
          }
          expanded={expandedSections.report}
          onToggle={toggleSection}
          presentation={sectionPresentation("report")}
        >
        <div
          className="flex flex-wrap items-center gap-2 border-b px-4 py-3"
          style={{ borderColor: "var(--color-border-tertiary)", background: "var(--color-background-primary)" }}
        >
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-md text-[12px]">
            إعداد
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 rounded-md text-[12px]">
            معاينة
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-md border-[#F0997B] text-[12px] text-[#712B13]"
            onClick={() => window.print()}
          >
            <Printer className="h-3.5 w-3.5" />
            PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-md border-[#5DCAA5] text-[12px] text-[#085041]"
            onClick={() => {
              const query = new URLSearchParams({
                projectId,
                format: "xlsx",
                assetType,
              });
              window.open(`/api/assets/export?${query.toString()}`, "_blank", "noopener,noreferrer");
            }}
          >
            Excel
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-md bg-[#378ADD] text-[12px] text-white hover:bg-[#2d77be]"
            onClick={() =>
              setSignedAt(
                new Intl.DateTimeFormat("ar-SA", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date()),
              )
            }
          >
            <Signature className="h-3.5 w-3.5" />
            {signedAt ? "موقّع ✓" : "توقيع رقمي"}
          </Button>
          {signedAt ? (
            <span className="text-[10px]" style={{ color: "var(--color-text-secondary)" }}>
              {signedAt}
            </span>
          ) : null}
        </div>

        <div className="overflow-y-auto bg-[#E8E8E4] p-5">
          <div className="mx-auto min-h-[560px] w-[420px] rounded bg-white px-8 py-8 shadow-sm">
            <div className="text-center">
              <h3 className="text-[14px] font-medium">تقرير تقييم الآلات والمعدات</h3>
              <p className="mt-2 text-[10.5px]" style={{ color: "#333" }}>
                {projectName} • {new Intl.DateTimeFormat("ar-SA").format(new Date())}
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="rounded bg-[#F5F5F5] px-3 py-2">
                <div className="text-[14px] font-medium">{formatSarCurrency(Math.max(marketAverage, depreciatedValue, 0))}</div>
                <div className="text-[9px]" style={{ color: "#888" }}>
                  إجمالي القيمة المرجّحة
                </div>
              </div>
              <div className="rounded bg-[#F5F5F5] px-3 py-2">
                <div className="text-[14px] font-medium">{rows.length}</div>
                <div className="text-[9px]" style={{ color: "#888" }}>
                  عدد الأصول
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <h4 className="text-[12px] font-medium">الملخص الفني</h4>
              <p className="text-[10.5px]" style={{ color: "#333", lineHeight: 1.6 }}>
                يستند هذا الملخص إلى الأصل المحدد حالياً داخل مساحة العمل الذكية، مع مراجعة بيانات الحالة والتكلفة الأصلية ونهج السوق والتعديلات النهائية قبل إصدار التقرير.
              </p>
            </div>

            <div className="mt-8 overflow-hidden rounded">
              <table className="min-w-full text-right text-[10px]">
                <thead style={{ background: "#F5F5F5" }}>
                  <tr>
                    <th className="px-3 py-2 font-medium">البند</th>
                    <th className="px-3 py-2 font-medium">القيمة</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b" style={{ borderColor: "#F0F0F0" }}>
                    <td className="px-3 py-2">الأصل المحدد</td>
                    <td className="px-3 py-2">{activeAsset ? resolveAssetTitle(activeAsset) : "—"}</td>
                  </tr>
                  <tr className="border-b" style={{ borderColor: "#F0F0F0" }}>
                    <td className="px-3 py-2">متوسط السوق</td>
                    <td className="px-3 py-2">{formatSarCurrency(marketAverage || 0)}</td>
                  </tr>
                  <tr className="border-b" style={{ borderColor: "#F0F0F0" }}>
                    <td className="px-3 py-2">نهج التكلفة</td>
                    <td className="px-3 py-2">{formatSarCurrency(Math.max(0, depreciatedValue))}</td>
                  </tr>
                  <tr className="border-b" style={{ borderColor: "#F0F0F0" }}>
                    <td className="px-3 py-2">الحالة</td>
                    <td className="px-3 py-2">{condition} / 5</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </MvWorkflowSectionHeader>
      </section>
      ) : null}
    </div>
  );
}
