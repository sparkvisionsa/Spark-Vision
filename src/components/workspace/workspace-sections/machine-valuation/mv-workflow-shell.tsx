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
  const [project, setProject] = useState<MvProject | null>(null);

  const loadProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/mv/projects/${projectId}`, { credentials: "include" });
      if (!response.ok) return;
      const data = (await response.json()) as { project: MvProject };
      setProject(data.project);
    } catch {
      setProject(null);
    }
  }, [projectId]);

  useEffect(() => {
    if (stepSlug === "import") {
      return;
    }
    void loadProject();
  }, [loadProject, stepSlug]);

  if (stepSlug === "import") {
    return <MvAssetDataWorkspace projectId={projectId} />;
  }

  if (stepSlug === "asset-images") {
    if (assetImagesSub === "local") {
      return <MvAssetImagesLocalWorkspace projectId={projectId} projectName={project?.name ?? null} />;
    }
    if (assetImagesSub === "system") {
      return <MvAssetImagesSystemWorkspace projectId={projectId} projectName={project?.name ?? null} />;
    }
    return <MvAssetImagesHub projectId={projectId} projectName={project?.name ?? null} />;
  }

  return (
    <WorkflowPlaceholder
      projectId={projectId}
      projectName={project?.name ?? projectId}
      stepSlug={stepSlug}
    />
  );
}
