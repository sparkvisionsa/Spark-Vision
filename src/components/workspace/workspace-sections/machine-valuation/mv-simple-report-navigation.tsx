"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/prefetch-link";
import { Check, ChevronDown, Folder, FolderKanban, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { MvTopBar, type MvBreadcrumbSegment } from "./mv-ui";
import { MV_PROJECTS_TABLE_PATH } from "./mv-home-routes";
import { isRootSubProjectParent, sortSubProjectsForDisplay } from "./mv-subproject-helpers";
import type { MvProject, MvProjectReportData, MvSubProject } from "./types";
import { MV_WORKFLOW_SESSION, readMvWorkflowSessionJson } from "./mv-workflow-session-cache";

export type MvSimpleReportStepId =
  | "report-data"
  | "asset-images"
  | "valuation-actions"
  | "report-preview";

export const MV_SIMPLE_REPORT_STEPS: {
  id: MvSimpleReportStepId;
  title: string;
}[] = [
  { id: "report-data", title: "بيانات التقرير" },
  { id: "asset-images", title: "صور الأصول" },
  { id: "valuation-actions", title: "إجراءات التقييم" },
  { id: "report-preview", title: "إعداد التقرير" },
];

const numberFormatter = new Intl.NumberFormat("ar-SA");

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
    const valid = new Set(MV_SIMPLE_REPORT_STEPS.map((step) => step.id));
    return parsed.filter(
      (value): value is MvSimpleReportStepId =>
        typeof value === "string" && valid.has(value as MvSimpleReportStepId),
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

export function hasMeaningfulSimpleReportData(
  data: MvProjectReportData | undefined | null,
): boolean {
  if (!data) return false;
  return Boolean(
    data.valuationMethod ||
      data.valuationPurpose ||
      data.valuePremise ||
      data.reportIssueDate ||
      data.agreementDate ||
      data.inspectionDate ||
      data.valuationDate ||
      data.clientName ||
      data.clientEmail ||
      data.clientPhone ||
      data.importantAssumptions ||
      data.specialAssumptions ||
      data.finalValue != null,
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
  if (stepId === "report-preview") return `/machine-valuation/${projectId}/workflow/report`;
  if (stepId === "report-data") return `/machine-valuation/${projectId}/workflow/report-data`;
  return `/machine-valuation/${projectId}/workflow/report-data`;
}

export function MvProjectFoldersMenu({
  projectId,
  folders,
  compact = false,
}: {
  projectId: string;
  folders: MvSubProject[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("flex items-center", compact ? "gap-1.5" : "gap-2")}>
      <Link
        href={`/machine-valuation/${projectId}/files`}
        title="الوصول إلى ملفات المشروع"
        aria-label="الوصول إلى ملفات المشروع"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50",
          compact ? "h-7 w-7 rounded-md" : "h-8 w-8 rounded-xl",
        )}
      >
        <FolderOpen className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
      </Link>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white font-bold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50",
            compact
              ? "h-7 px-2 text-[10px]"
              : "h-8 gap-2 rounded-xl px-3 text-[11px]",
          )}
        >
          <FolderKanban className={cn("shrink-0 text-sky-700", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
          مجلدات المشروع
          <ChevronDown
            className={cn(
              "shrink-0 text-slate-400 transition",
              compact ? "h-3 w-3" : "h-3.5 w-3.5",
              open && "rotate-180",
            )}
          />
        </button>

        {open ? (
          <div className="absolute left-0 top-full z-50 mt-2 w-[min(92vw,520px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
            <div className="grid gap-1.5 p-2 sm:grid-cols-2">
              <Link
                href={`/machine-valuation/${projectId}/inspector-files`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/90 px-2.5 py-2 text-right transition hover:border-violet-200 hover:bg-violet-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                  <Folder className="h-4 w-4 fill-current" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-bold text-violet-950">ملفات المعاين</span>
                  <span className="block truncate text-[10px] font-medium text-violet-700/90">
                    صور ووثائق المعاين الميداني
                  </span>
                </span>
              </Link>
              {folders.length === 0 ? (
                <div className="rounded-xl bg-slate-50 px-3 py-3 text-[11px] text-slate-500">
                  لا توجد مجلدات.
                </div>
              ) : (
                folders.map((folder, index) => (
                  <Link
                    key={folder._id}
                    href={`/machine-valuation/${projectId}/${folder._id}`}
                    className="flex items-center gap-2 rounded-xl border border-transparent px-2.5 py-2 text-right transition hover:border-slate-200 hover:bg-slate-50"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-500">
                      <Folder className="h-4 w-4 fill-current" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-800">
                      {folder.name}
                    </span>
                    <span className="text-[10px] font-black text-slate-300">
                      {numberFormatter.format(index + 1)}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
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
  const visited = new Set(visitedSteps);
  const completed = new Set(completedSteps);
  const router = useRouter();

  useEffect(() => {
    if (onStepSelect) return;
    for (const step of MV_SIMPLE_REPORT_STEPS) {
      void router.prefetch(mvSimpleReportStepHref(projectId, step.id));
    }
  }, [onStepSelect, projectId, router]);

  return (
    <div
      className={cn(
        "border-t border-slate-100 bg-slate-50/80",
        compact ? "py-0" : "py-0.5",
      )}
    >
      <div
        className={cn(
          "mx-auto grid max-w-7xl grid-cols-4",
          compact ? "px-1.5 sm:px-2" : "px-2 sm:px-4",
        )}
      >
        {MV_SIMPLE_REPORT_STEPS.map((step) => {
          const isActive = activeStep != null && activeStep === step.id;
          const isDone = completed.has(step.id);
          const isVisited = visited.has(step.id);
          const label = (
            <span
              className={cn(
                "inline-flex max-w-[11rem] items-center justify-center gap-0.5 truncate font-bold leading-tight",
                compact
                  ? "max-w-[9rem] text-[10px] sm:max-w-[10rem] sm:text-[11px]"
                  : "gap-1 text-[12px] sm:max-w-[12rem] sm:text-[14px]",
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
    const done: MvSimpleReportStepId[] = [];
    if (hasMeaningfulSimpleReportData(loadedProject?.reportData)) done.push("report-data");
    if (countProjectAssetImages(loadedSubProjects) > 0) done.push("asset-images");
    if ((loadedProject?.sheetCount ?? 0) > 0) done.push("valuation-actions");
    return done;
  }, [completedSteps, loadedProject?.reportData, loadedProject?.sheetCount, loadedSubProjects]);

  const topBreadcrumbs =
    breadcrumbs ??
    [
      { label: "المشاريع", href: MV_PROJECTS_TABLE_PATH },
      { label: loadedProject?.name ?? projectId },
    ];

  return (
    <header className="relative z-20 w-full shrink-0 border-b border-slate-200/90 bg-white shadow-[0_1px_0_0_rgba(15,23,42,0.04)]">
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
            {loadedProject?.reportType === "advanced" ? "متقدم" : "مبسط"}
          </span>
        }
        trailing={<MvProjectFoldersMenu compact={compact} projectId={projectId} folders={rootFolders} />}
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
