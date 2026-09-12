"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/prefetch-link";
import { ArrowLeft, ArrowRight, ChevronDown, Folder, FolderKanban, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { MvTopBar, type MvBreadcrumbSegment } from "./mv-ui";
import { MV_PROJECTS_TABLE_PATH } from "./mv-home-routes";
import { useMvInPageNavigation } from "./mv-inpage-navigation";
import { isRootSubProjectParent, sortSubProjectsForDisplay } from "./mv-subproject-helpers";
import type { MvProject, MvProjectReportData, MvSubProject } from "./types";
import { MV_WORKFLOW_SESSION, readMvWorkflowSessionJson, writeMvWorkflowSessionJson } from "./mv-workflow-session-cache";
import {
  computeCompletedSimpleReportSteps,
  hasMeaningfulSimpleReportData,
} from "./mv-simple-project-progress";
import { getSimpleReportSteps, useMvI18n } from "./mv-i18n";

export { hasMeaningfulSimpleReportData };
export type MvSimpleReportStepId =
  | "report-data"
  | "asset-images"
  | "report-files"
  | "final-report";

const SIMPLE_REPORT_STEP_IDS = new Set<MvSimpleReportStepId>([
  "report-data",
  "asset-images",
  "report-files",
  "final-report",
]);
const VISITED_STEPS_EVENT = "mv-simple-report-steps-changed";

function visitedStorageKey(projectId: string) {
  return `mv:simple-report-visited:${projectId}`;
}

function normalizeVisitedStepId(value: string): MvSimpleReportStepId | null {
  if (value === "report-preview") return "final-report";
  if (value === "valuation-actions" || value === "client-files" || value === "certificate") return "report-files";
  if (SIMPLE_REPORT_STEP_IDS.has(value as MvSimpleReportStepId)) {
    return value as MvSimpleReportStepId;
  }
  return null;
}

export function readVisitedSimpleReportSteps(projectId: string): MvSimpleReportStepId[] {
  if (typeof window === "undefined") return ["report-data"];
  try {
    const raw = window.localStorage.getItem(visitedStorageKey(projectId));
    if (!raw) return ["report-data"];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return ["report-data"];
    return Array.from(
      new Set(
        parsed
          .map((value) => (typeof value === "string" ? normalizeVisitedStepId(value) : null))
          .filter((value): value is MvSimpleReportStepId => Boolean(value)),
      ),
    );
  } catch {
    return ["report-data"];
  }
}

export function writeVisitedSimpleReportSteps(
  projectId: string,
  steps: MvSimpleReportStepId[],
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    visitedStorageKey(projectId),
    JSON.stringify(Array.from(new Set(steps))),
  );
  window.dispatchEvent(new CustomEvent<string>(VISITED_STEPS_EVENT, { detail: projectId }));
}

export function countProjectAssetImages(subProjects: MvSubProject[]): number {
  return subProjects.reduce((total, folder) => {
    const pic = folder.picAsset;
    if (!pic) return total;
    return total + (pic.imageCount ?? pic.images?.length ?? 0);
  }, 0);
}

/** روابط موحّدة لخطوات التقرير داخل `workflow/...` لتفادي اختلاف التصميم بين المسارات. */
export function mvSimpleReportStepHref(projectId: string, stepId: MvSimpleReportStepId): string {
  if (stepId === "asset-images") return `/machine-valuation/${projectId}/workflow/asset-images`;
  if (stepId === "report-files") return `/machine-valuation/${projectId}/workflow/files#valuation`;
  if (stepId === "final-report") return `/machine-valuation/${projectId}/workflow/final-report`;
  if (stepId === "report-data") return `/machine-valuation/${projectId}/workflow/report-data`;
  return `/machine-valuation/${projectId}/workflow/report-data`;
}

/**
 * تنقّل موحّد ثابت أسفل صفحات مراحل التقرير المبسّط. البداية والنهاية تعودان
 * إلى قائمة المشاريع، لتبقى دورة العمل واضحة دون أزرار متكررة داخل المحتوى.
 */
export function MvSimpleReportStepNavigation({
  projectId,
  activeStep,
  className,
}: {
  projectId: string;
  activeStep: MvSimpleReportStepId;
  className?: string;
}) {
  const { t, dir, isArabic } = useMvI18n();
  const { navigate } = useMvInPageNavigation();
  const steps = useMemo(() => getSimpleReportSteps(t), [t]);
  const activeIndex = Math.max(0, steps.findIndex((step) => step.id === activeStep));
  const previousStep = activeIndex > 0 ? steps[activeIndex - 1] : null;
  const nextStep = activeIndex < steps.length - 1 ? steps[activeIndex + 1] : null;
  const BackIcon = isArabic ? ArrowRight : ArrowLeft;
  const NextIcon = isArabic ? ArrowLeft : ArrowRight;
  const previousHref = previousStep
    ? mvSimpleReportStepHref(projectId, previousStep.id)
    : MV_PROJECTS_TABLE_PATH;
  const nextHref = nextStep
    ? mvSimpleReportStepHref(projectId, nextStep.id)
    : MV_PROJECTS_TABLE_PATH;
  const previousLabel = previousStep
    ? t("navigation.simpleReportPager.previous", { step: previousStep.title })
    : t("navigation.simpleReportPager.backToProjects");
  const nextLabel = nextStep
    ? t("navigation.simpleReportPager.next", { step: nextStep.title })
    : t("navigation.simpleReportPager.backToProjects");

  return (
    <nav
      className={cn(
        "flex shrink-0 items-center justify-between gap-1.5 border-t border-slate-200 bg-white/95 px-2 py-1 shadow-[0_-2px_8px_rgba(15,23,42,0.035)] backdrop-blur sm:px-3",
        className,
      )}
      dir={dir}
      aria-label={t("navigation.simpleReportPager.label")}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 max-w-[calc(50%-0.25rem)] gap-1 rounded-md border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
        onClick={() => navigate(previousHref)}
        title={previousLabel}
      >
        <BackIcon className="h-3 w-3 shrink-0" aria-hidden />
        <span className="truncate">{previousLabel}</span>
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-7 max-w-[calc(50%-0.25rem)] gap-1 rounded-md bg-[#0C447C] px-2 text-[10px] font-bold text-white hover:bg-[#0a3a66]"
        onClick={() => navigate(nextHref)}
        title={nextLabel}
      >
        <span className="truncate">{nextLabel}</span>
        <NextIcon className="h-3 w-3 shrink-0" aria-hidden />
      </Button>
    </nav>
  );
}

export function MvProjectFoldersMenu({
  projectId,
  folders,
  compact = false,
}: {
  projectId: string;
  /** يُقبل للتوافق مع الاستدعاءات القديمة؛ القائمة تعرض المجلدات فقط. */
  projectName?: string | null;
  folders: MvSubProject[];
  compact?: boolean;
}) {
  const { t, isArabic, dir } = useMvI18n();
  const [open, setOpen] = useState(false);
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(isArabic ? "ar-SA" : "en-US"),
    [isArabic],
  );

  const menuButtonClass = cn(
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 shadow-sm transition-all",
    "hover:border-slate-300 hover:bg-slate-50 active:scale-[0.97]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-1",
    "data-[state=open]:border-sky-300 data-[state=open]:bg-sky-50 data-[state=open]:text-sky-800",
    compact ? "h-8 px-2.5 text-[12px]" : "h-9 px-3 text-[12px]",
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              title={t("navigation.projectFolders.menu")}
              aria-label={t("navigation.projectFolders.menu")}
              data-state={open ? "open" : "closed"}
              className={menuButtonClass}
            >
              <FolderKanban className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
              {!compact ? <span>{t("navigation.projectFolders.menu")}</span> : null}
              <ChevronDown
                className={cn(
                  "shrink-0 text-slate-400 transition-transform",
                  compact ? "h-3 w-3" : "h-3.5 w-3.5",
                  open && "rotate-180",
                )}
              />
            </button>
          </PopoverTrigger>

          <PopoverContent
            dir={dir}
            align="end"
            collisionPadding={12}
            sideOffset={8}
            className="w-[min(94vw,30rem)] rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl shadow-slate-900/15"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <LayoutGrid className="h-4 w-4" />
                </span>
                <p className="min-w-0 truncate text-[12.5px] font-extrabold text-slate-900">{t("navigation.projectFolders.menu")}</p>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                {t("navigation.projectFolders.foldersCount", { count: numberFormatter.format(folders.length) })}
              </span>
            </div>

            <div className="grid max-h-[60vh] gap-1.5 overflow-y-auto p-2 sm:grid-cols-2">
              {folders.length === 0 ? (
                <div className="col-span-full flex flex-col items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-6 text-center">
                  <Folder className="h-5 w-5 text-slate-300" />
                  <p className="text-[11px] font-medium text-slate-400">{t("navigation.projectFolders.empty")}</p>
                </div>
              ) : (
                folders.map((folder, index) => (
                  <Link
                    key={folder._id}
                    href={`/machine-valuation/${projectId}/${folder._id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2 text-start transition hover:border-slate-200 hover:bg-slate-50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
                      <Folder className="h-4 w-4 fill-current" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-slate-800">
                      {folder.name}
                    </span>
                    <span className="shrink-0 text-[10px] font-black text-slate-300">
                      {numberFormatter.format(index + 1)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </PopoverContent>
    </Popover>
  );
}

const stepStripLinkClass = (
  isActive: boolean,
  isDone: boolean,
  isVisited: boolean,
  compact?: boolean,
) =>
  cn(
    "flex min-w-0 flex-[0_1_auto] items-center justify-center bg-transparent text-center transition-colors",
    compact ? "min-h-10 px-1 py-1 sm:min-h-11 sm:px-1.5" : "min-h-12 px-1.5 py-1.5 sm:px-2",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-inset",
    isDone && "text-emerald-700",
    !isDone && isActive && "text-[#0C447C]",
    !isDone && !isActive && isVisited && "text-orange-700",
    !isDone && !isActive && !isVisited && "text-slate-400 hover:text-slate-600",
  );

const stepCircleClass = (
  isActive: boolean,
  isDone: boolean,
  isVisited: boolean,
  compact?: boolean,
) =>
  cn(
    "inline-flex shrink-0 items-center justify-center rounded-full border font-black tabular-nums",
    compact ? "h-6 w-6 text-[10px] sm:h-7 sm:w-7 sm:text-[11px]" : "h-8 w-8 text-[12px]",
    isDone && "border-emerald-600 bg-emerald-600 text-white",
    !isDone && isActive && "border-[#0C447C] bg-[#0C447C] text-white",
    !isDone && !isActive && isVisited && "border-orange-500 bg-orange-500 text-white",
    !isDone && !isActive && !isVisited && "border-slate-300 bg-white text-slate-500",
  );

const stepConnectorClass = "h-px min-w-2 flex-1 bg-slate-300 sm:min-w-4 md:min-w-8";

export function MvSimpleReportStepStrip({
  projectId,
  activeStep,
  visitedSteps = [],
  completedSteps = [],
  onStepSelect,
  compact = false,
}: {
  projectId: string;
  activeStep: MvSimpleReportStepId | null;
  visitedSteps?: MvSimpleReportStepId[];
  completedSteps?: MvSimpleReportStepId[];
  onStepSelect?: (stepId: MvSimpleReportStepId) => void;
  compact?: boolean;
}) {
  const { t, dir } = useMvI18n();
  const steps = useMemo(() => getSimpleReportSteps(t), [t]);
  const visited = new Set(visitedSteps);
  const completed = new Set(completedSteps);
  const router = useRouter();

  useEffect(() => {
    if (onStepSelect) return;
    for (const step of steps) {
      void router.prefetch(mvSimpleReportStepHref(projectId, step.id));
    }
  }, [onStepSelect, projectId, router, steps]);

  useEffect(() => {
    void import("./mv-workflow-chunk-prefetch").then((mod) =>
      mod.prefetchMvWorkflowChunks({ eager: true }),
    );
  }, []);

  return (
    <div className={cn("border-t border-slate-100 bg-slate-50/80", compact ? "py-1" : "py-1.5")} dir={dir}>
      <div className={cn("flex w-full items-center", compact ? "px-2 sm:px-3" : "px-3 sm:px-4")}>
        {steps.map((step, index) => {
          const isActive = activeStep != null && activeStep === step.id;
          const isDone = completed.has(step.id);
          const isVisited = visited.has(step.id);
          const content = (
            <span className="relative inline-flex min-w-0 max-w-full items-center gap-1.5 pb-2">
              <span className={stepCircleClass(isActive, isDone, isVisited, compact)}>
                {index + 1}
              </span>
              <span
                className={cn(
                  "min-w-0 line-clamp-2 text-start font-extrabold leading-tight",
                  compact
                    ? "max-w-[3.5rem] text-[10px] sm:max-w-[8rem] sm:text-[11.5px]"
                    : "max-w-[8rem] text-[12px] sm:max-w-[11rem] sm:text-[13px]",
                )}
              >
                {step.title}
              </span>
              {isActive ? (
                <span aria-hidden className="absolute -inset-x-1 bottom-0 h-1.5 rounded-full bg-current" />
              ) : null}
            </span>
          );

          const stepTrigger = onStepSelect ? (
            <button
              type="button"
              onClick={() => onStepSelect(step.id)}
              aria-current={isActive ? "step" : undefined}
              className={stepStripLinkClass(isActive, isDone, isVisited, compact)}
            >
              {content}
            </button>
          ) : (
            <Link
              href={mvSimpleReportStepHref(projectId, step.id)}
              scroll={false}
              prefetch
              aria-current={isActive ? "step" : undefined}
              className={stepStripLinkClass(isActive, isDone, isVisited, compact)}
            >
              {content}
            </Link>
          );

          return (
            <div key={step.id} className="contents">
              {stepTrigger}
              {index < steps.length - 1 ? (
                <span className={stepConnectorClass} aria-hidden />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MvProjectReportHeader({
  projectId,
  project,
  subProjects,
  activeStep,
  visitedSteps,
  completedSteps,
  breadcrumbs,
  onStepSelect,
  compact = false,
}: {
  projectId: string;
  project?: MvProject | null;
  subProjects?: MvSubProject[];
  activeStep: MvSimpleReportStepId | null;
  visitedSteps?: MvSimpleReportStepId[];
  completedSteps?: MvSimpleReportStepId[];
  breadcrumbs?: MvBreadcrumbSegment[];
  onStepSelect?: (stepId: MvSimpleReportStepId) => void;
  /** شريط مدمج تحت النافبار مباشرة (أقصر) */
  compact?: boolean;
}) {
  const { t } = useMvI18n();
  const [loadedProject, setLoadedProject] = useState<MvProject | null>(project ?? null);
  const [loadedSubProjects, setLoadedSubProjects] = useState<MvSubProject[]>(subProjects ?? []);

  useEffect(() => {
    if (project) setLoadedProject(project);
  }, [project]);

  useEffect(() => {
    if (subProjects) setLoadedSubProjects(subProjects);
  }, [subProjects]);

  useEffect(() => {
    if (project && subProjects) return;
    const cached = readMvWorkflowSessionJson<{
      project?: MvProject;
      subProjects?: MvSubProject[];
    }>(MV_WORKFLOW_SESSION.projectSummary(projectId));
    if (cached?.project && !project) setLoadedProject(cached.project);
    if (cached?.subProjects && !subProjects) setLoadedSubProjects(cached.subProjects);

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/mv/projects/${projectId}?picAssetMode=summary`, {
          credentials: "include",
        });
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as {
          project?: MvProject;
          subProjects?: MvSubProject[];
        };
        if (cancelled) return;
        if (!project) setLoadedProject(data.project ?? null);
        if (!subProjects) setLoadedSubProjects(data.subProjects ?? []);
        if (data.project) {
          writeMvWorkflowSessionJson(MV_WORKFLOW_SESSION.projectSummary(projectId), {
            project: data.project,
            subProjects: data.subProjects ?? [],
            fetchedAt: Date.now(),
          });
        }
      } catch {
        if (!cancelled) {
          if (!project) setLoadedProject(null);
          if (!subProjects) setLoadedSubProjects([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project, projectId, subProjects]);

  const rootFolders = useMemo(
    () => sortSubProjectsForDisplay(loadedSubProjects.filter((folder) => isRootSubProjectParent(folder.parent))),
    [loadedSubProjects],
  );

  const [storedVisitedSteps, setStoredVisitedSteps] = useState<MvSimpleReportStepId[]>(() =>
    readVisitedSimpleReportSteps(projectId),
  );

  useEffect(() => {
    const syncVisitedSteps = () => setStoredVisitedSteps(readVisitedSimpleReportSteps(projectId));
    const onVisitedStepsChanged = (event: Event) => {
      const changedProjectId = (event as CustomEvent<string>).detail;
      if (!changedProjectId || changedProjectId === projectId) syncVisitedSteps();
    };

    syncVisitedSteps();
    window.addEventListener(VISITED_STEPS_EVENT, onVisitedStepsChanged);
    window.addEventListener("storage", syncVisitedSteps);
    return () => {
      window.removeEventListener(VISITED_STEPS_EVENT, onVisitedStepsChanged);
      window.removeEventListener("storage", syncVisitedSteps);
    };
  }, [projectId]);

  useEffect(() => {
    if (!activeStep) return;
    const currentSteps = readVisitedSimpleReportSteps(projectId);
    if (!currentSteps.includes(activeStep)) {
      writeVisitedSimpleReportSteps(projectId, [...currentSteps, activeStep]);
    }
  }, [activeStep, projectId]);

  const resolvedVisitedSteps = useMemo(
    () => Array.from(new Set([...storedVisitedSteps, ...(visitedSteps ?? []), ...(activeStep ? [activeStep] : [])])),
    [activeStep, storedVisitedSteps, visitedSteps],
  );

  const computedCompleted = useMemo(() => {
    if (completedSteps) return completedSteps;
    const assetImageCount = countProjectAssetImages(loadedSubProjects);
    const valuationAccountImageCount =
      loadedProject?.valuationAccountingWorkspace?.images?.length ??
      loadedProject?.valuationAccountImageCount ??
      0;
    const clientDocumentImageCount =
      loadedProject?.clientDocumentsWorkspace?.images?.length ??
      loadedProject?.clientDocumentImageCount ??
      0;
    const sceCertificateImageCount =
      loadedProject?.sceCertificateWorkspace?.images?.length ??
      loadedProject?.sceCertificateImageCount ??
      0;

    return computeCompletedSimpleReportSteps({
      reportData: loadedProject?.reportData,
      assetImageCount:
        assetImageCount > 0 ? assetImageCount : (loadedProject?.assetImageCount ?? 0),
      valuationAccountImageCount,
      clientDocumentImageCount,
      sceCertificateImageCount,
      visitedFinalReport: resolvedVisitedSteps.includes("final-report"),
    });
  }, [
    completedSteps,
    loadedProject?.assetImageCount,
    loadedProject?.clientDocumentImageCount,
    loadedProject?.clientDocumentsWorkspace?.images,
    loadedProject?.sceCertificateImageCount,
    loadedProject?.sceCertificateWorkspace?.images,
    loadedProject?.reportData,
    loadedProject?.valuationAccountImageCount,
    loadedProject?.valuationAccountingWorkspace?.images,
    loadedSubProjects,
    resolvedVisitedSteps,
  ]);

  const steps = useMemo(() => getSimpleReportSteps(t), [t]);
  const suppliedProjectLabel = breadcrumbs?.find(
    (breadcrumb) => breadcrumb.href === `/machine-valuation/${projectId}/workflow/report-data`,
  )?.label;
  const projectLabel = loadedProject?.name ?? project?.name ?? suppliedProjectLabel ?? projectId;
  const reportTypeLabel =
    loadedProject?.reportType === "advanced"
      ? t("navigation.reportTypeBadge.advanced")
      : t("navigation.reportTypeBadge.simple");
  const activeStepLabel = steps.find((step) => step.id === activeStep)?.title;
  const sectionLabel = activeStepLabel ?? breadcrumbs?.[breadcrumbs.length - 1]?.label;
  const topBreadcrumbs: MvBreadcrumbSegment[] = [
    { label: t("navigation.projects"), href: MV_PROJECTS_TABLE_PATH },
    { label: projectLabel, href: `/machine-valuation/${projectId}/workflow/report-data` },
    ...(sectionLabel ? [{ label: sectionLabel }] : []),
    { label: reportTypeLabel },
  ];

  return (
    <header className="sticky top-0 z-30 w-full shrink-0 border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <MvTopBar
        sticky={false}
        compact={compact}
        className="border-0 bg-transparent"
        breadcrumbs={topBreadcrumbs}
        trailing={
          <MvProjectFoldersMenu
            compact={compact}
            projectId={projectId}
            projectName={loadedProject?.name ?? null}
            folders={rootFolders}
          />
        }
      />
      <MvSimpleReportStepStrip
        compact={compact}
        projectId={projectId}
        activeStep={activeStep}
        visitedSteps={resolvedVisitedSteps}
        completedSteps={computedCompleted}
        onStepSelect={onStepSelect}
      />
    </header>
  );
}
