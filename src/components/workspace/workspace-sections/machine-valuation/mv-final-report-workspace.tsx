"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Eye,
  ExternalLink,
  FileText,
  Images,
  Loader2,
  Presentation,
  Settings2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  downloadMergedReportFiles,
  mergeWordReportTemplateViaServer,
  prepareMvWordMergeInput,
} from "@/lib/mv-word-template";
import {
  downloadMergedPptxFiles,
  mergePptxReportTemplateViaServer,
} from "@/lib/mv-pptx-template/server-merge";
import {
  countProjectAssetImages,
  MvProjectReportHeader,
  mvSimpleReportStepHref,
  readVisitedSimpleReportSteps,
  type MvSimpleReportStepId,
  writeVisitedSimpleReportSteps,
} from "./mv-simple-report-navigation";
import { computeCompletedSimpleReportSteps } from "./mv-simple-project-progress";
import type { MvProject, MvProjectReportData, MvSubProject } from "./types";
import { useMvInPageNavigation } from "./mv-inpage-navigation";
import { MvWorkflowPageFrame, MvWorkflowPageScrollBody } from "./mv-workflow-page-frame";
import {
  loadProjectSummarySafe,
  readProjectSummaryCache,
  writeProjectSummaryCache,
} from "./mv-project-summary-loader";
import { mvErrorMessage } from "./mv-api-client";
import { useMvI18n } from "./mv-i18n";
import { MvErrorState, MvPageLoading } from "./mv-ui";
import {
  buildMvWordImageLayout,
  normalizeMvWordAssetImagesPerRow,
  normalizeMvWordClientImagesPerRow,
  recommendedMvWordAssetImagesPerPage,
} from "./mv-word-template-settings";
import { systemArabicFont as reportFont } from "@/lib/system-fonts";
import { MvDialogContent } from "./mv-dialog";
import {
  finalReportPreviewCacheKey,
  finalReportPreviewStamp,
  readFinalReportPreviewCacheAsync,
  writeFinalReportPreviewCache,
} from "./mv-final-report-preview-cache";

function MvSystemReportLoading() {
  const { t } = useMvI18n();
  return (
    <div
      className="flex h-full min-h-0 items-center justify-center rounded-xl bg-white text-slate-600"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="me-2 h-4 w-4 animate-spin text-sky-700" aria-hidden />
      <span className="text-[12px] font-bold">
        {t("report.finalReportPage.loadingSystemReport")}
      </span>
    </div>
  );
}

const MvSystemReportWorkspace = dynamic(() => import("./mv-valuation-report-workspace"), {
  ssr: false,
  loading: MvSystemReportLoading,
});

type BusyAction =
  | null
  | "word"
  | "word-preview"
  | "pptx"
  | "pptx-preview"
  | "settings"
  | "template-selection";

type PreviewState = {
  source: "word" | "pptx";
  url: string;
};

type ReportFormat = "word" | "pptx";
type FinalReportTab = ReportFormat | "system";

type CompanyDocumentTemplateOption = {
  id: string;
  name: string;
  fileName: string;
};

type ImageLayoutDraft = {
  assetImagesPerRow: number;
  clientImagesPerRow: number;
};

const PPTX_IMAGES_PER_ROW_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

function normalizePptxImagesPerRow(value: unknown): number {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) ? Math.max(1, Math.min(6, parsed)) : 3;
}

function companyDocumentTemplateOptions(
  reportDefaults: unknown,
  format: ReportFormat,
): CompanyDocumentTemplateOption[] {
  if (!reportDefaults || typeof reportDefaults !== "object" || Array.isArray(reportDefaults)) return [];
  const defaults = reportDefaults as Record<string, unknown>;
  const listKey = format === "word" ? "wordTemplates" : "pptxTemplates";
  const legacyKey = format === "word" ? "wordTemplate" : "pptxTemplate";
  const candidates = Array.isArray(defaults[listKey])
    ? defaults[listKey] as unknown[]
    : defaults[legacyKey]
      ? [defaults[legacyKey]]
      : [];
  const seen = new Set<string>();
  return candidates.slice(0, 20).flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return [];
    const row = candidate as Record<string, unknown>;
    const hasFile =
      (typeof row.gridFsFileId === "string" && row.gridFsFileId.trim().length > 0) ||
      (typeof row.fileUrl === "string" && row.fileUrl.trim().length > 0) ||
      (typeof row.fileDataUrl === "string" && row.fileDataUrl.startsWith("data:"));
    if (!hasFile) return [];
    const id = typeof row.id === "string" && row.id.trim()
      ? row.id.trim()
      : `${format}-template-${index + 1}`;
    if (seen.has(id)) return [];
    seen.add(id);
    const fileName = typeof row.fileName === "string" && row.fileName.trim()
      ? row.fileName.trim()
      : format === "word" ? "word-template.docx" : "powerpoint-template.pptx";
    const name = typeof row.name === "string" && row.name.trim()
      ? row.name.trim()
      : fileName.replace(/\.(docx|pptx)$/i, "").trim();
    return [{ id, name, fileName }];
  });
}

function mergePositiveCount(incoming: number | undefined, previous: number | undefined): number | undefined {
  if (typeof incoming === "number" && incoming > 0) return incoming;
  if (typeof previous === "number" && previous > 0) return previous;
  return incoming ?? previous;
}

function mergeProjectSummaryCounts(previous: MvProject | null | undefined, incoming: MvProject): MvProject {
  return {
    ...incoming,
    assetImageCount: mergePositiveCount(incoming.assetImageCount, previous?.assetImageCount),
    valuationAccountImageCount: mergePositiveCount(
      incoming.valuationAccountImageCount,
      previous?.valuationAccountImageCount,
    ),
    clientDocumentImageCount: mergePositiveCount(
      incoming.clientDocumentImageCount,
      previous?.clientDocumentImageCount,
    ),
  };
}

function SummaryStat({
  label,
  value,
  accent,
  emphasize,
}: {
  label: string;
  value: string | number;
  accent: "sky" | "emerald" | "violet" | "amber" | "brand";
  emphasize?: boolean;
}) {
  const accentClass =
    accent === "sky"
      ? "border-sky-100 bg-sky-50/80 text-sky-900"
      : accent === "emerald"
        ? "border-emerald-100 bg-emerald-50/80 text-emerald-900"
        : accent === "violet"
          ? "border-violet-100 bg-violet-50/80 text-violet-900"
          : accent === "brand"
            ? "border-cyan-100 bg-cyan-50/90 text-cyan-950"
            : "border-amber-100 bg-amber-50/80 text-amber-950";
  return (
    <div className={cn("min-w-0 rounded-lg border px-2 py-1.5", accentClass)}>
      <p className="truncate text-[9px] font-bold leading-3 opacity-65">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate font-black leading-4 tabular-nums tracking-tight",
          emphasize ? "text-[12px]" : "text-[11px]",
        )}
        title={String(value)}
      >
        {value}
      </p>
    </div>
  );
}

const FINAL_REPORT_TAB_TRIGGER_CLASS =
  "relative h-11 min-w-0 gap-2 rounded-none border-b-[3px] border-transparent bg-transparent px-2 text-[12px] font-bold text-slate-500 shadow-none ring-0 ring-offset-0 transition-colors hover:text-[#0C447C] focus-visible:ring-0 data-[state=active]:border-[#0C447C] data-[state=active]:bg-transparent data-[state=active]:text-[#0C447C] data-[state=active]:shadow-none sm:px-4 sm:text-[13.5px]";

export default function MvFinalReportWorkspace({ projectId }: { projectId: string }) {
  const { t, dir, isArabic } = useMvI18n();
  const { navigate } = useMvInPageNavigation();
  const { toast } = useToast();

  const [project, setProject] = useState<MvProject | null>(null);
  const [subProjects, setSubProjects] = useState<MvSubProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [busyLabel, setBusyLabel] = useState("");
  const [wordTemplates, setWordTemplates] = useState<CompanyDocumentTemplateOption[]>([]);
  const [pptxTemplates, setPptxTemplates] = useState<CompanyDocumentTemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [selectedWordTemplateId, setSelectedWordTemplateId] = useState("");
  const [selectedPptxTemplateId, setSelectedPptxTemplateId] = useState("");
  const [activeTab, setActiveTab] = useState<FinalReportTab>("word");
  const [systemReportMounted, setSystemReportMounted] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [layoutSettingsFormat, setLayoutSettingsFormat] = useState<ReportFormat | null>(null);
  const pageContentRef = useRef<HTMLElement>(null);
  const [imageLayoutDraft, setImageLayoutDraft] = useState<ImageLayoutDraft>({
    assetImagesPerRow: 4,
    clientImagesPerRow: 2,
  });
  const [visitedSteps, setVisitedSteps] = useState<Set<MvSimpleReportStepId>>(
    () => new Set(readVisitedSimpleReportSteps(projectId)),
  );

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(isArabic ? "ar" : "en"),
    [isArabic],
  );

  const handleTabChange = useCallback((value: string) => {
    if (value !== "word" && value !== "pptx" && value !== "system") return;
    setActiveTab(value);
    if (value === "system") setSystemReportMounted(true);
  }, []);

  useEffect(() => {
    if (activeTab !== "system" || !systemReportMounted) return;
    const pageContent = pageContentRef.current;
    const pageScroller = pageContent?.parentElement;
    const reportViewport = pageContent?.querySelector<HTMLElement>(
      "[data-mv-system-report-viewport]",
    );
    if (!pageContent || !pageScroller || !reportViewport) return;

    const movePageChromeOutOfView = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.deltaY <= 0 ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ) return;
      const deltaScale =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? pageScroller.clientHeight
            : 1;
      const deltaY = event.deltaY * deltaScale;
      const remainingTopGap =
        reportViewport.getBoundingClientRect().top - pageScroller.getBoundingClientRect().top;
      const remainingPageScroll =
        pageScroller.scrollHeight - pageScroller.clientHeight - pageScroller.scrollTop;
      const appliedDelta = Math.min(deltaY, remainingTopGap, remainingPageScroll);
      if (appliedDelta <= 0.5) return;

      pageScroller.scrollTop += appliedDelta;
      event.preventDefault();
      event.stopPropagation();
    };

    // Give the outer page the first downward wheel movement so the summary and
    // tabs leave the viewport; once aligned, the report's own page scroller takes over.
    pageContent.addEventListener("wheel", movePageChromeOutOfView, {
      capture: true,
      passive: false,
    });
    return () => {
      pageContent.removeEventListener("wheel", movePageChromeOutOfView, true);
    };
  }, [activeTab, systemReportMounted]);

  useEffect(() => {
    const steps = readVisitedSimpleReportSteps(projectId);
    if (!steps.includes("final-report")) {
      const next = [...steps, "final-report" as const];
      writeVisitedSimpleReportSteps(projectId, next);
      setVisitedSteps(new Set(next));
    } else {
      setVisitedSteps(new Set(steps));
    }
  }, [projectId]);

  const load = useCallback(async (signal?: AbortSignal) => {
    const cached =
      readProjectSummaryCache(projectId, "report") ??
      readProjectSummaryCache(projectId, "summary");
    if (cached?.project?._id === projectId) {
      setProject(cached.project);
      if (cached.subProjects.length > 0) setSubProjects(cached.subProjects);
    }
    if (!(cached?.project?._id === projectId)) setLoading(true);
    setLoadError(null);
    try {
      const { payload, error } = await loadProjectSummarySafe(projectId, {
        mode: "report",
        signal,
        timeoutMs: 30_000,
        forceRefresh: (cached?.project?.assetImageCount ?? 0) === 0,
      });
      if (signal?.aborted) return;
      if (!payload?.project) {
        setLoadError(mvErrorMessage(error, t("report.finalReportPage.loadFailed")));
        return;
      }
      setProject((current) => mergeProjectSummaryCounts(current ?? cached?.project, payload.project));
      setSubProjects((current) =>
        payload.subProjects && payload.subProjects.length > 0 ? payload.subProjects : current,
      );
      writeProjectSummaryCache(
        projectId,
        {
          project: mergeProjectSummaryCounts(cached?.project, payload.project),
          subProjects:
            payload.subProjects && payload.subProjects.length > 0
              ? payload.subProjects
              : cached?.subProjects ?? [],
        },
        "report",
      );
    } catch (error) {
      if (signal?.aborted) return;
      setLoadError(mvErrorMessage(error, t("report.finalReportPage.loadFailed")));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    setSelectedWordTemplateId("");
    setSelectedPptxTemplateId("");
    void fetch("/api/company/report-defaults", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error("failed");
        return (await response.json()) as { reportDefaults?: unknown };
      })
      .then((data) => {
        if (cancelled) return;
        setWordTemplates(companyDocumentTemplateOptions(data.reportDefaults, "word"));
        setPptxTemplates(companyDocumentTemplateOptions(data.reportDefaults, "pptx"));
      })
      .catch(() => {
        if (!cancelled) {
          setWordTemplates([]);
          setPptxTemplates([]);
        }
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!project || templatesLoading) return;
    setSelectedWordTemplateId((current) => {
      if (current && wordTemplates.some((template) => template.id === current)) return current;
      const saved = project.reportData?.wordTemplateId?.trim() ?? "";
      return wordTemplates.some((template) => template.id === saved) ? saved : "";
    });
  }, [project, templatesLoading, wordTemplates]);

  useEffect(() => {
    if (!project || templatesLoading) return;
    setSelectedPptxTemplateId((current) => {
      if (current && pptxTemplates.some((template) => template.id === current)) return current;
      const saved = project.reportData?.pptxTemplateId?.trim() ?? "";
      return pptxTemplates.some((template) => template.id === saved) ? saved : "";
    });
  }, [pptxTemplates, project, templatesLoading]);

  useEffect(() => {
    if (!project) return;
    const format = activeTab === "pptx" ? "pptx" : activeTab === "word" ? "word" : null;
    if (!format) return;
    const templateId = format === "word" ? selectedWordTemplateId : selectedPptxTemplateId;
    if (!templateId) return;
    const stamp = finalReportPreviewStamp({
      templateId,
      updatedAt: project.updatedAt,
      assetImagesPerRow:
        format === "word"
          ? project.reportData?.wordAssetImagesPerRow
          : project.reportData?.pptxAssetImagesPerRow,
      clientImagesPerRow:
        format === "word"
          ? project.reportData?.clientDocumentsImagesPerRow
          : project.reportData?.pptxClientImagesPerRow,
    });
    let cancelled = false;
    void readFinalReportPreviewCacheAsync(
      finalReportPreviewCacheKey(projectId, format),
      stamp,
    ).then((cached) => {
      if (cancelled || !cached) return;
      setPreview((current) => {
        if (current?.source === format && current.url) return current;
        if (current?.url) URL.revokeObjectURL(current.url);
        return { source: format, url: URL.createObjectURL(cached.blob) };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    project,
    projectId,
    selectedPptxTemplateId,
    selectedWordTemplateId,
  ]);

  useEffect(() => {
    return () => {
      if (preview?.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview?.url]);

  const assetImageCount = useMemo(() => countProjectAssetImages(subProjects), [subProjects]);
  const lastKnownAssetImageCountRef = useRef(0);
  const displayedAssetImageCount =
    assetImageCount || project?.assetImageCount || lastKnownAssetImageCountRef.current || 0;
  if (displayedAssetImageCount > 0) lastKnownAssetImageCountRef.current = displayedAssetImageCount;
  const valuationImageCount =
    project?.valuationAccountingWorkspace?.images?.length ??
    project?.valuationAccountImageCount ??
    0;
  const clientDocumentImageCount =
    project?.clientDocumentsWorkspace?.images?.length ??
    project?.clientDocumentImageCount ??
    0;

  const completedSteps = useMemo(
    () =>
      new Set(
        computeCompletedSimpleReportSteps({
          reportData: project?.reportData,
          assetImageCount:
            displayedAssetImageCount > 0
              ? displayedAssetImageCount
              : (project?.assetImageCount ?? 0),
          valuationAccountImageCount: valuationImageCount,
          clientDocumentImageCount,
          visitedFinalReport: visitedSteps.has("final-report"),
        }),
      ),
    [
      clientDocumentImageCount,
      displayedAssetImageCount,
      project?.assetImageCount,
      project?.reportData,
      valuationImageCount,
      visitedSteps,
    ],
  );

  const onStepSelect = useCallback(
    (stepId: MvSimpleReportStepId) => {
      navigate(mvSimpleReportStepHref(projectId, stepId));
    },
    [navigate, projectId],
  );

  const setPreviewBlob = useCallback((
    source: "word" | "pptx",
    blob: Blob,
    stamp: string,
  ) => {
    setPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return { source, url: URL.createObjectURL(blob) };
    });
    writeFinalReportPreviewCache(finalReportPreviewCacheKey(projectId, source), {
      source,
      blob,
      stamp,
    });
  }, [projectId]);

  const selectCompanyDocumentTemplate = useCallback(async (
    format: ReportFormat,
    templateId: string,
  ) => {
    if (!project || busy) return;
    const templates = format === "word" ? wordTemplates : pptxTemplates;
    if (!templates.some((template) => template.id === templateId)) return;
    const previousId = format === "word" ? selectedWordTemplateId : selectedPptxTemplateId;
    if (templateId === previousId) return;

    if (format === "word") setSelectedWordTemplateId(templateId);
    else setSelectedPptxTemplateId(templateId);
    setPreview((current) => {
      if (current?.url) URL.revokeObjectURL(current.url);
      return null;
    });
    setBusy("template-selection");
    setBusyLabel(t("report.finalReportPage.savingTemplateSelection"));

    const reportData: MvProjectReportData = {
      ...(project.reportData ?? {}),
      ...(format === "word" ? { wordTemplateId: templateId } : { pptxTemplateId: templateId }),
    };
    try {
      const response = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: project.name,
          reportType: project.reportType ?? "simple",
          reportData,
        }),
      });
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { project?: MvProject };
      const updated = mergeProjectSummaryCounts(
        project,
        payload.project ?? { ...project, reportData, updatedAt: new Date().toISOString() },
      );
      setProject(updated);
      writeProjectSummaryCache(projectId, { project: updated, subProjects }, "report");
      toast({ description: t("report.finalReportPage.templateSelectionSaved") });
    } catch {
      if (format === "word") setSelectedWordTemplateId(previousId);
      else setSelectedPptxTemplateId(previousId);
      toast({ variant: "destructive", description: t("report.finalReportPage.templateSelectionSaveFailed") });
    } finally {
      setBusy(null);
      setBusyLabel("");
    }
  }, [
    busy,
    pptxTemplates,
    project,
    projectId,
    selectedPptxTemplateId,
    selectedWordTemplateId,
    subProjects,
    t,
    toast,
    wordTemplates,
  ]);

  const openImageLayoutSettings = useCallback(
    (format: ReportFormat) => {
      if (!project) return;
      const reportData = project.reportData ?? {};
      setImageLayoutDraft(
        format === "word"
          ? {
              assetImagesPerRow: normalizeMvWordAssetImagesPerRow(
                reportData.wordAssetImagesPerRow,
              ),
              clientImagesPerRow: normalizeMvWordClientImagesPerRow(
                reportData.clientDocumentsImagesPerRow,
              ),
            }
          : {
              assetImagesPerRow: normalizePptxImagesPerRow(reportData.pptxAssetImagesPerRow),
              clientImagesPerRow: normalizePptxImagesPerRow(reportData.pptxClientImagesPerRow),
            },
      );
      setLayoutSettingsFormat(format);
    },
    [project],
  );

  const saveImageLayoutSettings = useCallback(async () => {
    if (!project || !layoutSettingsFormat || busy) return;
    const normalizedDraft =
      layoutSettingsFormat === "word"
        ? {
            assetImagesPerRow: normalizeMvWordAssetImagesPerRow(imageLayoutDraft.assetImagesPerRow),
            clientImagesPerRow: normalizeMvWordClientImagesPerRow(imageLayoutDraft.clientImagesPerRow),
          }
        : {
            assetImagesPerRow: normalizePptxImagesPerRow(imageLayoutDraft.assetImagesPerRow),
            clientImagesPerRow: normalizePptxImagesPerRow(imageLayoutDraft.clientImagesPerRow),
          };
    const reportData: MvProjectReportData = {
      ...(project.reportData ?? {}),
      ...(layoutSettingsFormat === "word"
        ? {
            wordAssetImagesPerRow: normalizedDraft.assetImagesPerRow as 1 | 2 | 3 | 4 | 5 | 6,
            clientDocumentsImagesPerRow: normalizedDraft.clientImagesPerRow as 1 | 2 | 3,
          }
        : {
            pptxAssetImagesPerRow: normalizedDraft.assetImagesPerRow as 1 | 2 | 3 | 4 | 5 | 6,
            pptxClientImagesPerRow: normalizedDraft.clientImagesPerRow as 1 | 2 | 3 | 4 | 5 | 6,
          }),
    };

    setBusy("settings");
    setBusyLabel(t("report.finalReportPage.savingSettings"));
    try {
      const response = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: project.name,
          reportType: project.reportType ?? "simple",
          reportData,
        }),
      });
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { project?: MvProject };
      const updated = mergeProjectSummaryCounts(
        project,
        payload.project ?? {
          ...project,
          reportData,
          updatedAt: new Date().toISOString(),
        },
      );
      setProject(updated);
      writeProjectSummaryCache(projectId, { project: updated, subProjects }, "report");
      setLayoutSettingsFormat(null);
      toast({ description: t("report.finalReportPage.settingsSaved") });
    } catch {
      toast({ variant: "destructive", description: t("report.finalReportPage.settingsSaveFailed") });
    } finally {
      setBusy(null);
      setBusyLabel("");
    }
  }, [
    busy,
    imageLayoutDraft,
    layoutSettingsFormat,
    project,
    projectId,
    subProjects,
    t,
    toast,
  ]);

  const runWord = useCallback(
    async (mode: "file" | "preview") => {
      if (!project || busy) return;
      if (!selectedWordTemplateId) {
        toast({
          variant: "destructive",
          description: t("report.finalReportPage.selectWordTemplateFirst"),
        });
        return;
      }
      const action: BusyAction = mode === "file" ? "word" : "word-preview";
      setBusy(action);
      setBusyLabel(
        mode === "file"
          ? t("report.finalReportPage.preparingWord")
          : t("report.finalReportPage.preparingPdf"),
      );
      try {
        const projectName = project.name || t("projects.table.project");
        const mergeInput = await prepareMvWordMergeInput({
          projectName,
          displayNumber: project.displayNumber,
          reportData: project.reportData ?? {},
          assetImageSources: [],
          valuationImageSources: [],
          clientImageSources: [],
          loadImages: false,
        });
        const result = await mergeWordReportTemplateViaServer({
          projectId,
          templateId: selectedWordTemplateId,
          mergeInput,
          assetImageUrls: [],
          valuationImageUrls: [],
          clientImageUrls: [],
          alsoPdf: mode !== "file",
          useStoredProjectState: true,
          imageLayout: buildMvWordImageLayout(project.reportData ?? {}),
        });

        if (mode === "file") {
          downloadMergedReportFiles({
            docxBlob: result.blob,
            baseName: projectName,
            includeDocx: true,
          });
          toast({ description: t("report.finalReportPage.doneWord") });
          return;
        }

        if (!result.pdfBlob) {
          throw new Error(result.pdfError || t("report.finalReportPage.pdfFailed"));
        }

        setPreviewBlob(
          "word",
          result.pdfBlob,
          finalReportPreviewStamp({
            templateId: selectedWordTemplateId,
            updatedAt: project.updatedAt,
            assetImagesPerRow: project.reportData?.wordAssetImagesPerRow,
            clientImagesPerRow: project.reportData?.clientDocumentsImagesPerRow,
          }),
        );
        toast({ description: t("report.finalReportPage.previewReady") });
      } catch (error) {
        toast({
          variant: "destructive",
          description:
            error instanceof Error && error.message.trim()
              ? error.message
              : t("report.finalReportPage.pdfFailed"),
        });
      } finally {
        setBusy(null);
        setBusyLabel("");
      }
    },
    [busy, project, projectId, selectedWordTemplateId, setPreviewBlob, t, toast],
  );

  const runPptx = useCallback(
    async (mode: "file" | "preview") => {
      if (!project || busy) return;
      if (!selectedPptxTemplateId) {
        toast({
          variant: "destructive",
          description: t("report.finalReportPage.selectPptxTemplateFirst"),
        });
        return;
      }
      const action: BusyAction = mode === "file" ? "pptx" : "pptx-preview";
      setBusy(action);
      setBusyLabel(
        mode === "file"
          ? t("report.finalReportPage.preparingPptx")
          : t("report.finalReportPage.preparingPdf"),
      );
      try {
        const projectName = project.name || t("projects.table.project");
        const result = await mergePptxReportTemplateViaServer({
          projectId,
          templateId: selectedPptxTemplateId,
          useStoredProjectState: true,
          alsoPdf: mode !== "file",
          imageLayout: {
            assetImagesPerRow: normalizePptxImagesPerRow(
              project.reportData?.pptxAssetImagesPerRow,
            ),
            clientImagesPerRow: normalizePptxImagesPerRow(
              project.reportData?.pptxClientImagesPerRow,
            ),
          },
        });

        if (mode === "file") {
          downloadMergedPptxFiles({
            pptxBlob: result.blob,
            baseName: projectName,
            includePptx: true,
          });
          toast({ description: t("report.finalReportPage.donePptx") });
          return;
        }

        if (!result.pdfBlob) {
          throw new Error(result.pdfError || t("report.finalReportPage.pdfFailed"));
        }

        setPreviewBlob(
          "pptx",
          result.pdfBlob,
          finalReportPreviewStamp({
            templateId: selectedPptxTemplateId,
            updatedAt: project.updatedAt,
            assetImagesPerRow: project.reportData?.pptxAssetImagesPerRow,
            clientImagesPerRow: project.reportData?.pptxClientImagesPerRow,
          }),
        );
        toast({ description: t("report.finalReportPage.previewReady") });
      } catch (error) {
        toast({
          variant: "destructive",
          description:
            error instanceof Error && error.message.trim()
              ? error.message
              : t("report.finalReportPage.pdfFailed"),
        });
      } finally {
        setBusy(null);
        setBusyLabel("");
      }
    },
    [busy, project, projectId, selectedPptxTemplateId, setPreviewBlob, t, toast],
  );

  if (!project) {
    return (
      <MvWorkflowPageFrame className={reportFont.className} dir={dir}>
        {loading ? (
          <MvPageLoading label={t("report.finalReportPage.loading")} />
        ) : (
          <MvErrorState
            title={t("report.finalReportPage.loadFailed")}
            description={loadError ?? t("common.error.loadDescription")}
            onRetry={() => void load()}
          />
        )}
      </MvWorkflowPageFrame>
    );
  }

  const reportData = project.reportData ?? {};
  const reportTitle = (reportData.reportTitle || "").trim();
  const reportReference = (reportData.reportReference || "").trim();
  const clientName = (reportData.clientName || "").trim();
  const finalValue =
    typeof reportData.finalValue === "number" && Number.isFinite(reportData.finalValue)
      ? reportData.finalValue
      : null;
  const finalValueLabel =
    finalValue == null
      ? t("report.finalReportPage.valueUnset")
      : numberFormatter.format(finalValue);

  const renderDocumentReportTab = (format: ReportFormat) => {
    const isWord = format === "word";
    const templates = isWord ? wordTemplates : pptxTemplates;
    const selectedTemplateId = isWord ? selectedWordTemplateId : selectedPptxTemplateId;
    const activePreview = preview?.source === format ? preview : null;
    const selectLabel = isWord
      ? t("report.finalReportPage.selectWordTemplate")
      : t("report.finalReportPage.selectPptxTemplate");

    return (
      <div className="mx-auto w-full max-w-6xl space-y-2.5">
        <article
          className={cn(
            "overflow-hidden rounded-2xl border bg-white shadow-sm",
            isWord ? "border-emerald-200/80" : "border-orange-200/80",
          )}
          aria-busy={Boolean(busy)}
        >
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 border-b px-3 py-2.5",
              isWord
                ? "border-emerald-100 bg-emerald-50/60"
                : "border-orange-100 bg-orange-50/60",
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white",
                isWord ? "bg-emerald-600" : "bg-orange-500",
              )}
              aria-hidden
            >
              {isWord ? <FileText className="h-4 w-4" /> : <Presentation className="h-4 w-4" />}
            </span>
            <Select
              value={selectedTemplateId || undefined}
              disabled={Boolean(busy) || templatesLoading || templates.length === 0}
              onValueChange={(value) => void selectCompanyDocumentTemplate(format, value)}
            >
              <SelectTrigger
                className={cn(
                  "h-9 min-w-0 flex-1 rounded-xl bg-white text-[11px] font-bold sm:max-w-md",
                  isWord ? "border-emerald-200" : "border-orange-200",
                )}
                aria-label={selectLabel}
              >
                <SelectValue placeholder={selectLabel} />
              </SelectTrigger>
              <SelectContent dir={dir}>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {busy ? (
              <span
                className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 text-[10px] font-bold text-slate-600"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                <span className="truncate">{busyLabel}</span>
              </span>
            ) : null}
          </div>

          {selectedTemplateId ? (
            <div className="grid gap-1.5 p-2.5 sm:grid-cols-3">
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "h-9 gap-1.5 rounded-xl text-[11px] font-black",
                  isWord
                    ? "border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                    : "border-orange-200 text-orange-800 hover:bg-orange-50",
                )}
                disabled={Boolean(busy)}
                onClick={() => openImageLayoutSettings(format)}
              >
                <Settings2 className="h-4 w-4" aria-hidden />
                {t("report.finalReportPage.imageSettings")}
              </Button>
              <Button
                type="button"
                className={cn(
                  "h-9 gap-1.5 rounded-xl text-[11px] font-black text-white",
                  isWord
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-orange-500 hover:bg-orange-600",
                )}
                disabled={Boolean(busy)}
                onClick={() => void (isWord ? runWord("file") : runPptx("file"))}
              >
                {busy === format ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="h-4 w-4" aria-hidden />
                )}
                {isWord
                  ? t("report.finalReportPage.downloadWord")
                  : t("report.finalReportPage.downloadPptx")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "h-9 gap-1.5 rounded-xl text-[11px] font-black",
                  isWord
                    ? "border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                    : "border-orange-200 text-orange-800 hover:bg-orange-50",
                )}
                disabled={Boolean(busy)}
                onClick={() => void (isWord ? runWord("preview") : runPptx("preview"))}
              >
                {busy === `${format}-preview` ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
                {t("report.finalReportPage.convertAndPreviewPdf")}
              </Button>
            </div>
          ) : (
            <div className="p-2.5">
              <p
                className={cn(
                  "rounded-xl border border-dashed px-3 py-3 text-center text-[10px] font-bold",
                  isWord
                    ? "border-emerald-200 bg-emerald-50/40 text-emerald-900"
                    : "border-orange-200 bg-orange-50/40 text-orange-900",
                )}
              >
                {templatesLoading
                  ? t("report.finalReportPage.loadingTemplates")
                  : templates.length
                    ? t("report.finalReportPage.chooseTemplateToShowActions")
                    : isWord
                      ? t("report.finalReportPage.missingWordTemplate")
                      : t("report.finalReportPage.missingPptxTemplate")}
              </p>
            </div>
          )}
        </article>

        {activePreview ? (
          <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="flex justify-end border-b border-slate-100 bg-slate-50/80 px-2.5 py-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-lg text-[10.5px] font-black"
              >
                <a href={activePreview.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  {t("report.finalReportPage.previewOpenTab")}
                </a>
              </Button>
            </div>
            <div className="bg-slate-50/60 p-1.5">
              <iframe
                title={`${t("report.finalReportPage.previewTitle")} - ${
                  isWord
                    ? t("report.finalReportPage.wordCardTitle")
                    : t("report.finalReportPage.pptxCardTitle")
                }`}
                src={activePreview.url}
                className="h-[min(68vh,820px)] min-h-[420px] w-full rounded-xl border border-slate-200 bg-white"
              />
            </div>
          </section>
        ) : null}
      </div>
    );
  };

  return (
    <MvWorkflowPageFrame
      className={cn(
        reportFont.className,
        "bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_28%),linear-gradient(180deg,#f8fafc,#f1f5f9)]",
      )}
      dir={dir}
    >
      <MvProjectReportHeader
        projectId={projectId}
        project={project}
        subProjects={subProjects}
        activeStep="final-report"
        visitedSteps={Array.from(visitedSteps)}
        completedSteps={Array.from(completedSteps)}
        onStepSelect={onStepSelect}
        compact
      />

      <MvWorkflowPageScrollBody>
        <main
          ref={pageContentRef}
          className={cn(
            "mx-auto min-w-0 w-full max-w-[1920px] px-2 sm:px-3",
            activeTab === "system"
              ? "space-y-1.5 py-1.5"
              : "space-y-2.5 py-3",
          )}
        >
          <section
            className="shrink-0 rounded-xl border border-slate-200/80 bg-white px-2 py-1.5 shadow-sm sm:px-2.5"
            title={reportTitle || undefined}
          >
            <div className="mb-1 flex min-w-0 items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-700">
                <Images className="h-3 w-3" aria-hidden />
              </span>
              <h2 className="text-[11px] font-black leading-4 text-slate-950">
                {t("report.finalReportPage.summaryTitle")}
              </h2>
            </div>
            <div className="grid grid-flow-col auto-cols-[minmax(7.25rem,1fr)] gap-1 overflow-x-auto pb-0.5 lg:grid-flow-row lg:grid-cols-6 lg:auto-cols-auto lg:overflow-visible lg:pb-0">
              <SummaryStat
                label={t("report.finalReportPage.finalValue")}
                value={finalValueLabel}
                accent="brand"
                emphasize
              />
              <SummaryStat
                label={t("report.finalReportPage.reportReference")}
                value={reportReference || "—"}
                accent="amber"
                emphasize
              />
              <SummaryStat
                label={t("report.finalReportPage.clientName")}
                value={clientName || "—"}
                accent="amber"
              />
              <SummaryStat
                label={t("report.finalReportPage.assetImages")}
                value={numberFormatter.format(displayedAssetImageCount)}
                accent="sky"
              />
              <SummaryStat
                label={t("report.finalReportPage.valuationImages")}
                value={numberFormatter.format(valuationImageCount)}
                accent="emerald"
              />
              <SummaryStat
                label={t("report.finalReportPage.clientFiles")}
                value={numberFormatter.format(clientDocumentImageCount)}
                accent="violet"
              />
            </div>
          </section>

          <Tabs
            value={activeTab}
            onValueChange={handleTabChange}
            dir={dir}
            className="min-w-0"
          >
            <TabsList
              className="grid h-auto w-full shrink-0 grid-cols-3 rounded-none border-b border-slate-200 bg-transparent p-0 text-slate-500 shadow-none"
              aria-label={t("report.finalReportPage.tabsAriaLabel")}
            >
              <TabsTrigger value="word" className={FINAL_REPORT_TAB_TRIGGER_CLASS}>
                <FileText className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{t("report.finalReportPage.wordTab")}</span>
              </TabsTrigger>
              <TabsTrigger value="pptx" className={FINAL_REPORT_TAB_TRIGGER_CLASS}>
                <Presentation className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{t("report.finalReportPage.pptxTab")}</span>
              </TabsTrigger>
              <TabsTrigger value="system" className={FINAL_REPORT_TAB_TRIGGER_CLASS}>
                <Settings2 className="h-4 w-4 shrink-0" aria-hidden />
                <span className="min-w-0 truncate">{t("report.finalReportPage.systemTab")}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="word" className="mt-2.5 min-w-0">
              {renderDocumentReportTab("word")}
            </TabsContent>

            <TabsContent value="pptx" className="mt-2.5 min-w-0">
              {renderDocumentReportTab("pptx")}
            </TabsContent>

            <TabsContent
              value="system"
              forceMount
              className="mt-1 min-w-0 data-[state=active]:block data-[state=inactive]:hidden"
            >
              {systemReportMounted ? (
                <div
                  data-mv-system-report-viewport
                  className="flex h-[calc(100dvh-10rem)] min-h-[520px] overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm"
                >
                  <MvSystemReportWorkspace
                    projectId={projectId}
                    variant="embedded-system"
                  />
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </main>
      </MvWorkflowPageScrollBody>

      <Dialog
        open={layoutSettingsFormat !== null}
        onOpenChange={(open) => {
          if (!open && busy !== "settings") setLayoutSettingsFormat(null);
        }}
      >
        <MvDialogContent
          className="max-w-md gap-0 overflow-hidden rounded-2xl border-slate-200 p-0 shadow-2xl"
          dir={dir}
        >
          <DialogHeader className="border-b border-slate-100 bg-gradient-to-l from-sky-50 via-white to-white px-5 py-4 pe-14 text-start">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm",
                  layoutSettingsFormat === "pptx" ? "bg-orange-500" : "bg-emerald-600",
                )}
              >
                {layoutSettingsFormat === "pptx" ? (
                  <Presentation className="h-5 w-5" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
              </span>
              <div>
                <DialogTitle className="text-[15px] font-black text-slate-950">
                  {t("report.finalReportPage.imageSettingsTitle")}
                </DialogTitle>
                <DialogDescription className="mt-0.5 text-[11px] font-semibold text-slate-500">
                  {layoutSettingsFormat === "pptx"
                    ? t("report.finalReportPage.pptxCardTitle")
                    : t("report.finalReportPage.wordCardTitle")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 bg-slate-50/70 p-4">
            <p className="text-[11px] font-semibold leading-5 text-slate-600">
              {t("report.finalReportPage.imageSettingsHint")}
            </p>
            <div className="space-y-2">
              {[
                {
                  key: "assetImagesPerRow" as const,
                  label: t("report.finalReportPage.assetImages"),
                  perItem:
                    layoutSettingsFormat === "word"
                      ? recommendedMvWordAssetImagesPerPage(imageLayoutDraft.assetImagesPerRow)
                      : imageLayoutDraft.assetImagesPerRow * imageLayoutDraft.assetImagesPerRow,
                },
                {
                  key: "clientImagesPerRow" as const,
                  label: t("report.finalReportPage.clientFiles"),
                  perItem: imageLayoutDraft.clientImagesPerRow * imageLayoutDraft.clientImagesPerRow,
                },
              ].map((field) => {
                const options =
                  layoutSettingsFormat === "word" && field.key === "clientImagesPerRow"
                    ? [1, 2, 3]
                    : PPTX_IMAGES_PER_ROW_OPTIONS;
                return (
                  <div
                    key={field.key}
                    className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-[12px] font-black text-slate-800" htmlFor={field.key}>
                        {field.label}
                      </label>
                      <select
                        id={field.key}
                        value={imageLayoutDraft[field.key]}
                        disabled={busy === "settings"}
                        onChange={(event) =>
                          setImageLayoutDraft((current) => ({
                            ...current,
                            [field.key]: Number(event.target.value),
                          }))
                        }
                        className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[12px] font-black text-slate-800 outline-none focus:border-sky-400"
                      >
                        {options.map((value) => (
                          <option key={value} value={value}>
                            {numberFormatter.format(value)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="mt-2 text-[10px] font-semibold text-slate-500">
                      {t("report.finalReportPage.imagesPerRowAndUnit", {
                        perRow: numberFormatter.format(imageLayoutDraft[field.key]),
                        perUnit: numberFormatter.format(field.perItem),
                        unit:
                          layoutSettingsFormat === "pptx"
                            ? t("report.finalReportPage.slide")
                            : t("report.finalReportPage.page"),
                      })}
                    </p>
                  </div>
                );
              })}
              <div className="rounded-xl border border-slate-200 bg-slate-100/80 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] font-black text-slate-700">
                    {t("report.finalReportPage.valuationImages")}
                  </p>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-[10px] font-black text-white">
                    {t("report.finalReportPage.fixedLayout")}
                  </span>
                </div>
                <p className="mt-2 text-[10px] font-semibold text-slate-500">
                  {t("report.finalReportPage.valuationFixedLayout", {
                    unit:
                      layoutSettingsFormat === "pptx"
                        ? t("report.finalReportPage.slide")
                        : t("report.finalReportPage.page"),
                  })}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              className="h-9 rounded-xl text-[11px] font-black"
              disabled={busy === "settings"}
              onClick={() => setLayoutSettingsFormat(null)}
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              className="h-9 gap-1.5 rounded-xl text-[11px] font-black"
              disabled={Boolean(busy)}
              onClick={() => void saveImageLayoutSettings()}
            >
              {busy === "settings" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("report.finalReportPage.saveSettings")}
            </Button>
          </div>
        </MvDialogContent>
      </Dialog>
    </MvWorkflowPageFrame>
  );
}
