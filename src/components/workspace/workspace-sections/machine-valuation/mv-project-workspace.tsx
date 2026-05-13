"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { SmartGridAssetRecord, SmartGridAssetType } from "@/components/smart-grid/SmartGrid";
import type { MvSaveState, MvWorkflowStepId } from "./mv-ui";
import {
  MV_WORKFLOW_STEPS,
  MvStatusBadge,
  MvStepper,
  MvTopBar,
} from "./mv-ui";
import MvAssetWorkspace, { type MvAssetWorkspaceSnapshot } from "./mv-asset-workspace";
import MvMainPipelineStepper from "./mv-main-pipeline-stepper";
import {
  MV_MAIN_WORKFLOW_STEPS,
  mainWorkflowSlugToAssetSection,
  type MvMainWorkflowSlug,
} from "./mv-main-workflow-model";
import type { MvProject, MvSheetData, MvSubProject } from "./types";

function resolveStepFromHash(hash: string): MvWorkflowStepId {
  const normalized = hash.replace(/^#/, "") as MvWorkflowStepId;
  return MV_WORKFLOW_STEPS.some((step) => step.id === normalized) ? normalized : "import";
}

function scrollToStep(stepId: MvWorkflowStepId) {
  if (typeof window === "undefined") return;
  const element = window.document.getElementById(stepId);
  window.history.replaceState(null, "", `#${stepId}`);
  window.dispatchEvent(new CustomEvent("sv:mv-open-step", { detail: { stepId } }));
  element?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resolveProjectStatus(snapshot: MvAssetWorkspaceSnapshot | null) {
  if (!snapshot || (!snapshot.importResult && snapshot.rows.length === 0)) {
    return <MvStatusBadge label="بانتظار الاستيراد" tone="warning" />;
  }

  if (snapshot.rows.length > 0 && snapshot.completedCount === snapshot.rows.length) {
    return <MvStatusBadge label="مكتمل" tone="success" />;
  }

  if (snapshot.rows.length > 0) {
    return <MvStatusBadge label="قيد التنفيذ" tone="info" />;
  }

  return <MvStatusBadge label="مراجعة" tone="warning" />;
}

function resolveStepStates(snapshot: MvAssetWorkspaceSnapshot | null, currentStep: MvWorkflowStepId) {
  const currentIndex = MV_WORKFLOW_STEPS.findIndex((step) => step.id === currentStep);
  const hasAssets = Boolean(snapshot?.importResult) || (snapshot?.rows.length ?? 0) > 0;

  return Object.fromEntries(
    MV_WORKFLOW_STEPS.map((step, index) => {
      if (!hasAssets && index > 0) {
        return [step.id, index === currentIndex ? "current" : "locked"];
      }
      if (index < currentIndex) {
        return [step.id, "completed"];
      }
      if (index === currentIndex) {
        return [step.id, "current"];
      }
      return [step.id, "pending"];
    }),
  ) as Partial<Record<MvWorkflowStepId, "completed" | "current" | "pending" | "locked">>;
}

interface MvProjectWorkspaceProps {
  projectId: string;
  /** عند التواجد داخل `/workflow/...`: شريط المسار الرئيسي وقسم واحد في مساحة الأصول */
  workflowMainStep?: MvMainWorkflowSlug | null;
}

export default function MvProjectWorkspace({
  projectId,
  workflowMainStep = null,
}: MvProjectWorkspaceProps) {
  const [project, setProject] = useState<MvProject | null>(null);
  const [subProjects, setSubProjects] = useState<MvSubProject[]>([]);
  const [sheets, setSheets] = useState<MvSheetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<MvWorkflowStepId>("import");
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<MvAssetWorkspaceSnapshot | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [projectResponse, sheetsResponse] = await Promise.all([
        fetch(`/api/mv/projects/${projectId}`, { credentials: "include" }),
        fetch(`/api/mv/sheets?projectId=${projectId}`, { credentials: "include" }),
      ]);

      if (projectResponse.ok) {
        const data = (await projectResponse.json()) as {
          project: MvProject;
          subProjects: MvSubProject[];
        };
        setProject(data.project);
        setSubProjects(data.subProjects ?? []);
      }

      if (sheetsResponse.ok) {
        setSheets((await sheetsResponse.json()) as MvSheetData[]);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (workflowMainStep) return;
    if (typeof window === "undefined") return;

    const applyHash = () => {
      setCurrentStep(resolveStepFromHash(window.location.hash));
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [workflowMainStep]);

  const stepStates = useMemo(
    () => resolveStepStates(workspaceSnapshot, currentStep),
    [currentStep, workspaceSnapshot],
  );

  const topBarSaveState = (workspaceSnapshot?.saveState ?? "idle") as MvSaveState;

  if (loading) {
    return (
      <div className="min-h-screen" dir="rtl">
        <MvTopBar
          breadcrumbs={[{ label: "تحميل المشروع..." }]}
          saveState="idle"
        />
        <div className="space-y-4 px-5 py-5">
          <div className="h-24 animate-pulse rounded-2xl bg-white/80" />
          <div className="h-16 animate-pulse rounded-2xl bg-white/80" />
          <div className="h-[32rem] animate-pulse rounded-2xl bg-white/80" />
        </div>
      </div>
    );
  }

  const fullPageAssetSection = workflowMainStep
    ? mainWorkflowSlugToAssetSection(workflowMainStep)
    : null;

  return (
    <div className={cn("min-h-screen", workflowMainStep && "pb-24")} dir="rtl">
      <div className="sticky top-14 z-40 border-b border-slate-200/80 bg-[var(--color-background-primary)]">
        <MvTopBar
          breadcrumbs={[
            { label: project?.name ?? projectId },
            ...(workflowMainStep
              ? [
                  {
                    label:
                      MV_MAIN_WORKFLOW_STEPS.find((s) => s.slug === workflowMainStep)?.label ??
                      workflowMainStep,
                  },
                ]
              : []),
          ]}
          status={resolveProjectStatus(workspaceSnapshot)}
          saveState={topBarSaveState}
          onRetry={() => scrollToStep("review")}
          sticky={false}
        />

        {workflowMainStep ? (
          <MvMainPipelineStepper projectId={projectId} currentSlug={workflowMainStep} />
        ) : (
          <MvStepper
            variant="bar"
            currentStepId={currentStep}
            stepStates={stepStates}
            onStepChange={(stepId) => {
              setCurrentStep(stepId);
              scrollToStep(stepId);
            }}
            sticky={false}
          />
        )}
      </div>

      <div className="px-5 pb-5 pt-3 md:pt-4">
        <MvAssetWorkspace
          projectId={projectId}
          projectName={project?.name ?? "المشروع"}
          subProjects={subProjects}
          sheets={sheets}
          onStateChange={setWorkspaceSnapshot}
          fullPageSection={fullPageAssetSection}
        />
      </div>
    </div>
  );
}
