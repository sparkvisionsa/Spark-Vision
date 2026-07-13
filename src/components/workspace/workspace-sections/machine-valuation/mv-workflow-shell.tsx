"use client";

import { useCallback, useEffect, useState } from "react";
import MvAssetDataWorkspace from "./mv-asset-data-workspace";
import MvAssetImagesHub from "./mv-asset-images-hub";
import MvAssetImagesLocalWorkspace from "./mv-asset-images-local-workspace";
import MvAssetImagesSystemWorkspace from "./mv-asset-images-system-workspace";
import { MV_MAIN_WORKFLOW_STEPS, type MvMainWorkflowSlug } from "./mv-main-workflow-model";
import { MvProjectReportHeader } from "./mv-simple-report-navigation";
import { MvWorkflowPageFrame, MvWorkflowPageScrollBody } from "./mv-workflow-page-frame";
import type { MvProject } from "./types";
import { isMvAbortError, mvErrorMessage, mvFetchJson } from "./mv-api-client";
import { MvErrorState, MvPageLoading } from "./mv-ui";
import { MV_WORKFLOW_SESSION, readMvWorkflowSessionJson, writeMvWorkflowSessionJson } from "./mv-workflow-session-cache";

interface MvWorkflowShellProps {
  projectId: string;
  stepSlug: MvMainWorkflowSlug;
  /** فرع ‎/workflow/asset-images/(local|system)‎ */
  assetImagesSub?: "local" | "system" | null;
}

function WorkflowPlaceholder({
  projectId,
  projectName,
  stepSlug,
}: {
  projectId: string;
  projectName: string;
  stepSlug: MvMainWorkflowSlug;
}) {
  const title = MV_MAIN_WORKFLOW_STEPS.find((step) => step.slug === stepSlug)?.label ?? stepSlug;

  return (
    <MvWorkflowPageFrame className="bg-[var(--color-background-primary)]" dir="rtl">
      <MvProjectReportHeader
        compact
        projectId={projectId}
        activeStep={stepSlug === "asset-images" ? "asset-images" : "valuation-actions"}
        breadcrumbs={[{ label: projectName }, { label: title }]}
      />
      <MvWorkflowPageScrollBody>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-6 shadow-sm">
            <h1 className="text-[15px] font-semibold text-slate-900">{title}</h1>
            <p className="mt-2 text-[12px] leading-6 text-slate-600">
              هذه الصفحة ستُحدَّث في المرحلة التالية حسب مسار العمل الجديد. تم إلغاء شريط الخطوات
              القديم، وسيبقى الدخول إلى هذه الخطوة مباشرة من قائمة الإجراءات.
            </p>
          </div>
        </div>
      </MvWorkflowPageScrollBody>
    </MvWorkflowPageFrame>
  );
}

export default function MvWorkflowShell({ projectId, stepSlug, assetImagesSub }: MvWorkflowShellProps) {
  const [project, setProject] = useState<MvProject | null>(() =>
    readMvWorkflowSessionJson<{ project?: MvProject }>(MV_WORKFLOW_SESSION.projectSummary(projectId))?.project ?? null,
  );
  const [loadingProject, setLoadingProject] = useState(() =>
    stepSlug !== "import" &&
    readMvWorkflowSessionJson<{ project?: MvProject }>(MV_WORKFLOW_SESSION.projectSummary(projectId))?.project == null,
  );
  const [projectError, setProjectError] = useState<string | null>(null);

  const loadProject = useCallback(async (signal?: AbortSignal) => {
    setLoadingProject(true);
    setProjectError(null);
    try {
      const data = await mvFetchJson<{ project: MvProject }>(
        `/api/mv/projects/${projectId}?picAssetMode=summary`,
        { signal },
        {
          cacheKey: `project-summary:${projectId}`,
          cacheTtlMs: 12_000,
          retries: 1,
          timeoutMs: 15_000,
          loadingLabel: "جارٍ تجهيز بيانات المشروع…",
        },
      );
      if (signal?.aborted) return;
      setProject(data.project);
      const cachedSummary = readMvWorkflowSessionJson<Record<string, unknown>>(
        MV_WORKFLOW_SESSION.projectSummary(projectId),
      );
      writeMvWorkflowSessionJson(MV_WORKFLOW_SESSION.projectSummary(projectId), {
        ...(cachedSummary ?? {}),
        project: data.project,
        fetchedAt: Date.now(),
      });
    } catch (error) {
      if (signal?.aborted || isMvAbortError(error)) return;
      setProject((current) => (current?._id === projectId ? current : null));
      setProjectError(mvErrorMessage(error, "تعذر تحميل بيانات المشروع."));
    } finally {
      if (!signal?.aborted) setLoadingProject(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (stepSlug === "import") {
      return;
    }
    const controller = new AbortController();
    void loadProject(controller.signal);
    return () => controller.abort();
  }, [loadProject, stepSlug]);

  const activeProject = project?._id === projectId ? project : null;

  if (stepSlug === "import") {
    return <MvAssetDataWorkspace projectId={projectId} />;
  }

  if (loadingProject && !activeProject) {
    return <MvPageLoading label="جارٍ تحميل المشروع ومرحلة العمل…" />;
  }

  if (!activeProject) {
    return (
      <MvErrorState
        title="تعذر فتح المشروع"
        description={projectError ?? "لم نتمكن من تحميل بيانات المشروع."}
        onRetry={() => void loadProject()}
      />
    );
  }

  if (stepSlug === "asset-images") {
    if (assetImagesSub === "local") {
      return <MvAssetImagesLocalWorkspace projectId={projectId} projectName={activeProject.name ?? null} />;
    }
    if (assetImagesSub === "system") {
      return <MvAssetImagesSystemWorkspace projectId={projectId} projectName={activeProject.name ?? null} />;
    }
    return <MvAssetImagesHub projectId={projectId} projectName={activeProject.name ?? null} />;
  }

  return (
    <WorkflowPlaceholder
      projectId={projectId}
      projectName={activeProject.name ?? projectId}
      stepSlug={stepSlug}
    />
  );
}
