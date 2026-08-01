"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { MvProjectReportHeader } from "./mv-simple-report-navigation";
import { MvWorkflowPageFrame, MvWorkflowPageScrollBody } from "./mv-workflow-page-frame";
import type { MvProject } from "./types";
import { isMvAbortError, mvErrorMessage } from "./mv-api-client";
import {
  loadProjectSummarySafe,
  readProjectSummaryCache,
  writeProjectSummaryCache,
} from "./mv-project-summary-loader";
import { MvErrorState, MvPageLoading } from "./mv-ui";
import type { MvMainWorkflowSlug } from "./mv-main-workflow-model";
import { useMvI18n } from "./mv-i18n";
import { prefetchMvWorkflowChunks } from "./mv-workflow-chunk-prefetch";

function MvWorkflowImportLoading() {
  const { t } = useMvI18n();
  return <MvPageLoading label={t("workflow.loading.import")} />;
}

function MvWorkflowAssetImagesLoading() {
  const { t } = useMvI18n();
  return <MvPageLoading label={t("workflow.loading.assetImages")} />;
}

function MvWorkflowLocalImagesLoading() {
  const { t } = useMvI18n();
  return <MvPageLoading label={t("workflow.loading.localImages")} />;
}

function MvWorkflowSystemImagesLoading() {
  const { t } = useMvI18n();
  return <MvPageLoading label={t("workflow.loading.systemImages")} />;
}

const MvAssetDataWorkspace = dynamic(() => import("./mv-asset-data-workspace"), {
  loading: () => <MvWorkflowImportLoading />,
});
const MvAssetImagesHub = dynamic(() => import("./mv-asset-images-hub"), {
  loading: () => <MvWorkflowAssetImagesLoading />,
});
const MvAssetImagesLocalWorkspace = dynamic(() => import("./mv-asset-images-local-workspace"), {
  loading: () => <MvWorkflowLocalImagesLoading />,
});
const MvAssetImagesSystemWorkspace = dynamic(() => import("./mv-asset-images-system-workspace"), {
  loading: () => <MvWorkflowSystemImagesLoading />,
});

interface MvWorkflowShellProps {
  projectId: string;
  stepSlug: MvMainWorkflowSlug;
  /** فرع ‎/workflow/asset-images/(local|system)‎ */
  assetImagesSub?: "local" | "system" | null;
}

export default function MvWorkflowShell({ projectId, stepSlug, assetImagesSub }: MvWorkflowShellProps) {
  const { t, dir } = useMvI18n();
  const [project, setProject] = useState<MvProject | null>(
    () => readProjectSummaryCache(projectId, "summary")?.project ?? null,
  );
  const [loadingProject, setLoadingProject] = useState(
    () =>
      stepSlug !== "import" &&
      readProjectSummaryCache(projectId, "summary")?.project == null,
  );
  const [projectError, setProjectError] = useState<string | null>(null);

  const loadProject = useCallback(async (signal?: AbortSignal) => {
    const hasCached = Boolean(readProjectSummaryCache(projectId, "summary")?.project);
    if (!hasCached) {
      setLoadingProject(true);
      setProjectError(null);
    }
    try {
      const { payload, error } = await loadProjectSummarySafe(projectId, {
        mode: "summary",
        signal,
        timeoutMs: 25_000,
      });
      if (signal?.aborted) return;
      if (!payload?.project) {
        setProject((current) => (current?._id === projectId ? current : null));
        if (!hasCached) {
          setProjectError(mvErrorMessage(error, t("workflow.error.loadProjectData")));
        }
        return;
      }
      setProject(payload.project);
      writeProjectSummaryCache(
        projectId,
        { project: payload.project, subProjects: payload.subProjects },
        "summary",
      );
      setProjectError(null);
    } catch (error) {
      if (signal?.aborted || isMvAbortError(error)) return;
      setProject((current) => (current?._id === projectId ? current : null));
      if (!hasCached) {
        setProjectError(mvErrorMessage(error, t("workflow.error.loadProjectData")));
      }
    } finally {
      if (!signal?.aborted) setLoadingProject(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    if (stepSlug === "import") {
      return;
    }
    const controller = new AbortController();
    void loadProject(controller.signal);
    return () => controller.abort();
  }, [loadProject, stepSlug]);

  useEffect(() => {
    prefetchMvWorkflowChunks({ eager: true });
  }, []);

  const activeProject = project?._id === projectId ? project : null;

  if (stepSlug === "import") {
    return <MvAssetDataWorkspace projectId={projectId} />;
  }

  if (loadingProject && !activeProject) {
    return <MvPageLoading label={t("workflow.loading.project")} />;
  }

  if (!activeProject) {
    return (
      <MvErrorState
        title={t("workflow.error.openProject")}
        description={projectError ?? t("workflow.error.loadProjectData")}
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
    <MvWorkflowPageFrame className="bg-[var(--color-background-primary)]" dir={dir}>
      <MvProjectReportHeader
        compact
        projectId={projectId}
        activeStep="report-data"
        breadcrumbs={[{ label: activeProject.name ?? projectId }]}
      />
      <MvWorkflowPageScrollBody>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-6 shadow-sm">
            <h1 className="text-[15px] font-semibold text-slate-900">{t("navigation.unavailablePath.title")}</h1>
            <p className="mt-2 text-[12px] leading-6 text-slate-600">
              {t("navigation.unavailablePath.body")}
            </p>
          </div>
        </div>
      </MvWorkflowPageScrollBody>
    </MvWorkflowPageFrame>
  );
}
