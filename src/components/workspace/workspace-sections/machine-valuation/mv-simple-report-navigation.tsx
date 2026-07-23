"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/prefetch-link";
import { Check, ChevronDown, Database, Download, Folder, FolderKanban, FolderOpen, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MvTopBar, type MvBreadcrumbSegment } from "./mv-ui";
import { MV_PROJECTS_TABLE_PATH } from "./mv-home-routes";
import { isRootSubProjectParent, sortSubProjectsForDisplay } from "./mv-subproject-helpers";
import type { MvProject, MvProjectReportData, MvSubProject } from "./types";
import { MV_WORKFLOW_SESSION, readMvWorkflowSessionJson, writeMvWorkflowSessionJson } from "./mv-workflow-session-cache";
import { MvAssetDataTableModal } from "./mv-asset-data-table-modal";
import { MvAssetImagesDownloadButton } from "./mv-asset-images-download-button";
import {
  computeCompletedSimpleReportSteps,
  hasMeaningfulSimpleReportData,
} from "./mv-simple-project-progress";
import { getSimpleReportSteps, useMvI18n } from "./mv-i18n";

export { hasMeaningfulSimpleReportData };
export type MvSimpleReportStepId =
  | "report-data"
  | "asset-images"
  | "valuation-actions"
  | "client-files"
  | "report-preview";

const SIMPLE_REPORT_STEP_IDS = new Set<MvSimpleReportStepId>([
  "report-data",
  "asset-images",
  "valuation-actions",
  "client-files",
  "report-preview",
]);

function visitedStorageKey(projectId: string) {
  return `mv:simple-report-visited:${projectId}`;
}

export function readVisitedSimpleReportSteps(projectId: string): MvSimpleReportStepId[] {
  if (typeof window === "undefined") return ["report-data"];
  try {
    const raw = window.localStorage.getItem(visitedStorageKey(projectId));
    if (!raw) return ["report-data"];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return ["report-data"];
    return parsed.filter(
      (value): value is MvSimpleReportStepId =>
        typeof value === "string" && SIMPLE_REPORT_STEP_IDS.has(value as MvSimpleReportStepId),
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
  if (stepId === "valuation-actions") return `/machine-valuation/${projectId}/workflow/valuation`;
  if (stepId === "client-files") return `/machine-valuation/${projectId}/workflow/client-files`;
  if (stepId === "report-preview") return `/machine-valuation/${projectId}/workflow/report`;
  if (stepId === "report-data") return `/machine-valuation/${projectId}/workflow/report-data`;
  return `/machine-valuation/${projectId}/workflow/report-data`;
}

function MvToolbarAction({
  icon,
  label,
  compact,
  accent,
  variant = "outline",
  ...triggerProps
}: {
  icon: ReactNode;
  label: string;
  compact: boolean;
  accent: "sky" | "emerald" | "slate" | "brand";
  variant?: "outline" | "solid";
} & (
  | { as: "link"; href: string }
  | { as: "button"; onClick: () => void }
)) {
  const sizeClass = compact ? "h-8 w-8" : "h-9 gap-2 px-3";
  const accentClass =
    variant === "solid"
      ? "border-transparent bg-[#0C447C] text-white shadow-sm hover:bg-[#0a3a66] focus-visible:ring-sky-300"
      : cn(
          "border bg-white shadow-sm",
          accent === "sky" &&
            "border-sky-200 text-sky-700 hover:border-sky-300 hover:bg-sky-50 focus-visible:ring-sky-300",
          accent === "emerald" &&
            "border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 focus-visible:ring-emerald-300",
          accent === "slate" &&
            "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-slate-300",
        );

  const className = cn(
    "inline-flex shrink-0 items-center justify-center rounded-xl text-[12px] font-bold transition-all",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
    "active:scale-[0.97]",
    sizeClass,
    accentClass,
  );

  const content = (
    <>
      {icon}
      {!compact ? <span className="whitespace-nowrap">{label}</span> : null}
    </>
  );

  const trigger =
    triggerProps.as === "link" ? (
      <Link href={triggerProps.href} aria-label={label} className={className}>
        {content}
      </Link>
    ) : (
      <button type="button" onClick={triggerProps.onClick} aria-label={label} className={className}>
        {content}
      </button>
    );

  if (!compact) return trigger;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="bottom" className="text-[11px] font-bold">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function MvProjectFoldersMenu({
  projectId,
  projectName,
  folders,
  compact = false,
}: {
  projectId: string;
  projectName?: string | null;
  folders: MvSubProject[];
  compact?: boolean;
}) {
  const { t, isArabic, dir } = useMvI18n();
  const [open, setOpen] = useState(false);
  const [assetDataOpen, setAssetDataOpen] = useState(false);
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
    <TooltipProvider>
      <div className={cn("flex items-center rounded-2xl bg-slate-50/70 p-1", compact ? "gap-1" : "gap-1.5")}>
        <MvToolbarAction
          as="link"
          href={`/machine-valuation/${projectId}/files`}
          label={t("navigation.projectFolders.openFilesShort")}
          compact={compact}
          accent="sky"
          icon={<FolderOpen className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />}
        />

        <MvToolbarAction
          as="button"
          onClick={() => setAssetDataOpen(true)}
          label={t("navigation.projectFolders.assetData")}
          compact={compact}
          accent="brand"
          variant="solid"
          icon={<Database className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />}
        />

        <MvAssetDataTableModal
          open={assetDataOpen}
          onOpenChange={setAssetDataOpen}
          projectId={projectId}
          projectName={projectName ?? null}
        />

        {compact ? (
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <MvAssetImagesDownloadButton
                  projectId={projectId}
                  title={t("navigation.projectFolders.downloadImages")}
                  className={cn(
                    "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-white text-emerald-700 shadow-sm transition-all",
                    "hover:border-emerald-300 hover:bg-emerald-50 active:scale-[0.97]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-1",
                  )}
                >
                  <Download className="h-3.5 w-3.5" />
                </MvAssetImagesDownloadButton>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[11px] font-bold">
              {t("navigation.projectFolders.downloadImages")}
            </TooltipContent>
          </Tooltip>
        ) : (
          <MvAssetImagesDownloadButton
            projectId={projectId}
            title={t("navigation.projectFolders.downloadImages")}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 text-[12px] font-bold text-emerald-700 shadow-sm transition-all",
              "hover:border-emerald-300 hover:bg-emerald-50 active:scale-[0.97]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-1",
            )}
          >
            <Download className="h-4 w-4" />
            <span className="whitespace-nowrap">{t("navigation.projectFolders.downloadImagesShort")}</span>
          </MvAssetImagesDownloadButton>
        )}

        <span className="mx-0.5 h-5 w-px shrink-0 bg-slate-200" aria-hidden />

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
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                  <LayoutGrid className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-extrabold text-slate-900">{t("navigation.projectFolders.menu")}</p>
                  <p className="text-[10.5px] font-medium text-slate-400">{t("navigation.projectFolders.menuHint")}</p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                {t("navigation.projectFolders.foldersCount", { count: numberFormatter.format(folders.length) })}
              </span>
            </div>

            <div className="grid max-h-[60vh] gap-1.5 overflow-y-auto p-2.5 sm:grid-cols-2">
              <Link
                href={`/machine-valuation/${projectId}/inspector-files`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl border border-violet-100 bg-violet-50/90 px-2.5 py-2 text-start transition hover:border-violet-200 hover:bg-violet-50 sm:col-span-2"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                  <Folder className="h-4 w-4 fill-current" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-bold text-violet-950">
                    {t("navigation.projectFolders.inspectorFiles")}
                  </span>
                  <span className="block truncate text-[10.5px] font-medium text-violet-700/90">
                    {t("navigation.projectFolders.inspectorFilesHint")}
                  </span>
                </span>
              </Link>

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
      </div>
    </TooltipProvider>
  );
}

const stepStripLinkClass = (
  isActive: boolean,
  isDone: boolean,
  isVisited: boolean,
  compact?: boolean,
) =>
  cn(
    "relative flex w-full min-w-0 flex-col items-center justify-center rounded-none border-0 border-b-[3px] border-transparent bg-transparent text-center shadow-none transition-colors",
    compact ? "min-h-[1.7rem] px-0.5 py-0.5" : "min-h-[2.5rem] px-1 py-1.5",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-1",
    isActive && "border-slate-900 font-extrabold text-slate-900",
    !isActive && isDone && "font-bold text-emerald-700 hover:text-emerald-800",
    !isActive && !isDone && isVisited && "font-bold text-orange-600 hover:text-orange-700",
    !isActive && !isDone && !isVisited && "font-bold text-slate-400 hover:text-slate-500",
  );

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
  const { t } = useMvI18n();
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
    <div
      className={cn(
        "border-t border-slate-100 bg-slate-50/80",
        compact ? "py-0" : "py-0.5",
      )}
    >
      <div
        className={cn(
          "mx-auto grid max-w-7xl grid-cols-5",
          compact ? "px-1.5 sm:px-2" : "px-2 sm:px-4",
        )}
      >
        {steps.map((step) => {
          const isActive = activeStep != null && activeStep === step.id;
          const isDone = completed.has(step.id);
          const isVisited = visited.has(step.id);
          const label = (
            <span
              className={cn(
                "inline-flex max-w-[11rem] items-center justify-center gap-0.5 truncate font-bold leading-tight",
                compact
                  ? "max-w-[7.5rem] text-[9px] sm:max-w-[9rem] sm:text-[11px]"
                  : "gap-1 text-[11px] sm:max-w-[11rem] sm:text-[13px]",
              )}
            >
              {isDone ? (
                <Check
                  className={cn("shrink-0 text-emerald-600", compact ? "h-2.5 w-2.5" : "h-3 w-3")}
                  strokeWidth={2.75}
                  aria-hidden
                />
              ) : null}
              {step.title}
            </span>
          );

          if (onStepSelect) {
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onStepSelect(step.id)}
                aria-current={isActive ? "step" : undefined}
                className={stepStripLinkClass(isActive, isDone, isVisited, compact)}
              >
                {label}
              </button>
            );
          }

          return (
            <Link
              key={step.id}
              href={mvSimpleReportStepHref(projectId, step.id)}
              scroll={false}
              prefetch
              aria-current={isActive ? "step" : undefined}
              className={stepStripLinkClass(isActive, isDone, isVisited, compact)}
            >
              {label}
            </Link>
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

    return computeCompletedSimpleReportSteps({
      reportData: loadedProject?.reportData,
      assetImageCount:
        assetImageCount > 0 ? assetImageCount : (loadedProject?.assetImageCount ?? 0),
      valuationAccountImageCount,
      clientDocumentImageCount,
      visitedReportPreview: visitedSteps?.includes("report-preview"),
    });
  }, [
    completedSteps,
    loadedProject?.assetImageCount,
    loadedProject?.clientDocumentImageCount,
    loadedProject?.clientDocumentsWorkspace?.images,
    loadedProject?.reportData,
    loadedProject?.valuationAccountImageCount,
    loadedProject?.valuationAccountingWorkspace?.images,
    loadedSubProjects,
    visitedSteps,
  ]);

  const topBreadcrumbs =
    breadcrumbs ??
    [
      { label: t("navigation.projects"), href: MV_PROJECTS_TABLE_PATH },
      { label: loadedProject?.name ?? projectId },
    ];

  return (
    <header className="sticky top-0 z-30 w-full shrink-0 border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <MvTopBar
        sticky={false}
        compact={compact}
        className="border-0 bg-transparent"
        breadcrumbs={topBreadcrumbs}
        status={
          <span
            className={cn(
              "rounded-full bg-slate-100 font-bold text-slate-600",
              compact ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[10px]",
            )}
          >
            {loadedProject?.reportType === "advanced"
              ? t("navigation.reportTypeBadge.advanced")
              : t("navigation.reportTypeBadge.simple")}
          </span>
        }
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
        visitedSteps={visitedSteps}
        completedSteps={computedCompleted}
        onStepSelect={onStepSelect}
      />
    </header>
  );
}
