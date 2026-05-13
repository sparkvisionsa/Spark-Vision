"use client";

import { Tajawal } from "next/font/google";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { numberToArabicRiyalWords } from "./mv-arabic-number-words";
import {
  countProjectAssetImages,
  hasMeaningfulSimpleReportData,
  MvProjectReportHeader,
  mvSimpleReportStepHref,
  readVisitedSimpleReportSteps,
  type MvSimpleReportStepId,
  writeVisitedSimpleReportSteps,
} from "./mv-simple-report-navigation";
import {
  createMvReportCollapsibleState,
  MV_REPORT_COLLAPSIBLE_IDS,
  MvReportDataForm,
  type MvReportCollapsibleSectionId,
} from "./mv-report-data-form";
import type { MvProject, MvProjectReportData, MvSubProject } from "./types";
import { useMvInPageNavigation } from "./mv-inpage-navigation";
import { MV_WORKFLOW_SESSION, writeMvWorkflowSessionJson } from "./mv-workflow-session-cache";
import { MvWorkflowPageFrame, MvWorkflowPageScrollBody } from "./mv-workflow-page-frame";

const reportFont = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
});

const EMPTY_REPORT_DATA: MvProjectReportData = {
  valuationMethod: "",
  valuationPurpose: "",
  valuePremise: "",
  includeAssetImages: true,
  reportIssueDate: "",
  agreementDate: "",
  inspectionDate: "",
  valuationDate: "",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  importantAssumptions: "",
  specialAssumptions: "",
  finalValue: null,
  finalValueWords: "",
  reportPresentationDraft: false,
  receivedClientDocumentsHtml: "",
  sceRegistrationCertificateHtml: "",
};

function normalizeReportData(data: MvProjectReportData | undefined | null): MvProjectReportData {
  const finalValue =
    typeof data?.finalValue === "number" && Number.isFinite(data.finalValue) ? data.finalValue : null;
  return {
    ...EMPTY_REPORT_DATA,
    ...(data ?? {}),
    includeAssetImages: data?.includeAssetImages !== false,
    reportPresentationDraft: data?.reportPresentationDraft === true,
    finalValue,
    finalValueWords:
      finalValue == null
        ? data?.finalValueWords ?? ""
        : numberToArabicRiyalWords(finalValue),
  };
}

interface MvReportDataWorkspaceProps {
  projectId: string;
}

const REPORT_DATA_CACHE_KEY = (projectId: string) => `sv:mv:report-data:${projectId}`;

function readCachedReportState(projectId: string): {
  project: MvProject;
  subProjects: MvSubProject[];
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(REPORT_DATA_CACHE_KEY(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { project?: MvProject; subProjects?: MvSubProject[] };
    if (!parsed?.project?._id) return null;
    return {
      project: parsed.project,
      subProjects: Array.isArray(parsed.subProjects) ? parsed.subProjects : [],
    };
  } catch {
    return null;
  }
}

function writeCachedReportState(projectId: string, data: {
  project: MvProject;
  subProjects: MvSubProject[];
}) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(REPORT_DATA_CACHE_KEY(projectId), JSON.stringify(data));
    writeMvWorkflowSessionJson(MV_WORKFLOW_SESSION.projectSummary(projectId), {
      project: data.project,
      subProjects: data.subProjects,
      fetchedAt: Date.now(),
    });
  } catch {
    // best effort cache
  }
}

export default function MvReportDataWorkspace({ projectId }: MvReportDataWorkspaceProps) {
  const { navigate } = useMvInPageNavigation();
  const { toast } = useToast();
  const initialCached = readCachedReportState(projectId);
  const [project, setProject] = useState<MvProject | null>(initialCached?.project ?? null);
  const [subProjects, setSubProjects] = useState<MvSubProject[]>(initialCached?.subProjects ?? []);
  /** مع وجود كاش الجلسة لا نُظهر شاشة التحميل أثناء إعادة المزامنة */
  const [loading, setLoading] = useState(() => initialCached?.project == null);
  const [saving, setSaving] = useState(false);
  const reportDataDirtyRef = useRef(false);
  const projectNameDirtyRef = useRef(false);
  const [visitedSteps, setVisitedSteps] = useState<Set<MvSimpleReportStepId>>(
    () => new Set(["report-data"]),
  );
  const [reportData, setReportData] = useState<MvProjectReportData>(() =>
    normalizeReportData(initialCached?.project.reportData),
  );
  const [editableProjectName, setEditableProjectName] = useState(() => initialCached?.project.name ?? "");
  const [openSections, setOpenSections] = useState<Record<MvReportCollapsibleSectionId, boolean>>(() =>
    createMvReportCollapsibleState(false),
  );

  const load = useCallback(async () => {
    const cached = readCachedReportState(projectId);
    const blockUi = cached?.project == null;
    if (blockUi) setLoading(true);
    try {
      const response = await fetch(`/api/mv/projects/${projectId}?picAssetMode=summary`, {
        credentials: "include",
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        project: MvProject;
        subProjects: MvSubProject[];
      };
      setProject(data.project);
      setSubProjects(data.subProjects ?? []);
      writeCachedReportState(projectId, { project: data.project, subProjects: data.subProjects ?? [] });
      if (!projectNameDirtyRef.current) setEditableProjectName(data.project.name ?? "");
      if (!reportDataDirtyRef.current) setReportData(normalizeReportData(data.project.reportData));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const cached = readCachedReportState(projectId);
    projectNameDirtyRef.current = false;
    reportDataDirtyRef.current = false;
    setProject(cached?.project ?? null);
    setSubProjects(cached?.subProjects ?? []);
    setEditableProjectName(cached?.project.name ?? "");
    setReportData(normalizeReportData(cached?.project.reportData));
    setLoading(cached?.project == null);
    setVisitedSteps(new Set(readVisitedSimpleReportSteps(projectId)));
    setOpenSections(createMvReportCollapsibleState(false));
    void load();
  }, [load, projectId]);

  const markVisited = useCallback(
    (stepId: MvSimpleReportStepId) => {
      setVisitedSteps((current) => {
        const next = new Set(current);
        next.add(stepId);
        writeVisitedSimpleReportSteps(projectId, Array.from(next));
        return next;
      });
    },
    [projectId],
  );

  useEffect(() => {
    markVisited("report-data");
  }, [markVisited]);

  const assetImageCount = useMemo(() => countProjectAssetImages(subProjects), [subProjects]);

  const completedSteps = useMemo(() => {
    const completed = new Set<MvSimpleReportStepId>();
    if (hasMeaningfulSimpleReportData(project?.reportData)) completed.add("report-data");
    if (assetImageCount > 0) completed.add("asset-images");
    if ((project?.sheetCount ?? 0) > 0) completed.add("valuation-actions");
    if (hasMeaningfulSimpleReportData(project?.reportData) && visitedSteps.has("report-preview")) {
      completed.add("report-preview");
    }
    return completed;
  }, [assetImageCount, project?.reportData, project?.sheetCount, visitedSteps]);

  const handleSaveReportData = async () => {
    if (!project) return;
    const name = editableProjectName.trim();
    if (!name) {
      toast({ variant: "destructive", description: "اسم التقرير مطلوب." });
      return;
    }

    const normalizedData = normalizeReportData({
      ...reportData,
      finalValueWords:
        reportData.finalValue == null ? "" : numberToArabicRiyalWords(reportData.finalValue),
    });

    try {
      setSaving(true);
      const response = await fetch(`/api/mv/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          reportType: project.reportType ?? "simple",
          reportData: normalizedData,
        }),
      });
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as { project?: MvProject };
      const updated = payload.project ?? {
        ...project,
        name,
        reportData: normalizedData,
        updatedAt: new Date().toISOString(),
      };
      setProject(updated);
      setEditableProjectName(updated.name);
      setReportData(normalizeReportData(updated.reportData));
      projectNameDirtyRef.current = false;
      reportDataDirtyRef.current = false;
      writeCachedReportState(projectId, { project: updated, subProjects });
      markVisited("report-data");
      toast({ description: "تم حفظ بيانات التقرير." });
    } catch {
      toast({ variant: "destructive", description: "تعذر حفظ بيانات التقرير." });
    } finally {
      setSaving(false);
    }
  };

  const onStepSelect = useCallback(
    (stepId: MvSimpleReportStepId) => {
      markVisited(stepId);
      const href = mvSimpleReportStepHref(projectId, stepId);
      startTransition(() => {
        navigate(href);
      });
    },
    [markVisited, navigate, projectId],
  );

  const handleProjectNameChange = useCallback((value: string) => {
    projectNameDirtyRef.current = true;
    setEditableProjectName(value);
  }, []);

  const handleReportDataChange = useCallback((patch: Partial<MvProjectReportData>) => {
    reportDataDirtyRef.current = true;
    setReportData((current) => ({ ...current, ...patch }));
  }, []);

  if (!project) {
    return (
      <MvWorkflowPageFrame className={reportFont.className} dir="rtl">
        <div className="mx-auto max-w-xl px-4 py-16 text-center text-sm text-slate-500">
          {loading ? "جاري التحميل…" : "تعذر تحميل بيانات المشروع."}
        </div>
      </MvWorkflowPageFrame>
    );
  }

  return (
    <MvWorkflowPageFrame
      className={cn(
        reportFont.className,
        "bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_32%),linear-gradient(180deg,#f8fafc,#eef2f7_52%,#f8fafc)]",
      )}
      dir="rtl"
    >
      <MvProjectReportHeader
        projectId={projectId}
        project={project}
        subProjects={subProjects}
        activeStep="report-data"
        visitedSteps={Array.from(visitedSteps)}
        completedSteps={Array.from(completedSteps)}
        onStepSelect={onStepSelect}
        compact
      />

      <MvWorkflowPageScrollBody>
        <main className="mx-auto max-w-7xl px-3 py-2 sm:px-5">
          <MvReportDataForm
            project={project}
            editableProjectName={editableProjectName}
            reportData={reportData}
            saving={saving}
            openSections={openSections}
            onProjectNameChange={handleProjectNameChange}
            onReportDataChange={handleReportDataChange}
            onSectionOpenChange={(id, open) => setOpenSections((c) => ({ ...c, [id]: open }))}
            onToggleAllSections={() =>
              setOpenSections((current) => {
                const shouldOpen = !MV_REPORT_COLLAPSIBLE_IDS.every((id) => current[id]);
                return createMvReportCollapsibleState(shouldOpen);
              })
            }
            onSave={handleSaveReportData}
          />
        </main>
      </MvWorkflowPageScrollBody>
    </MvWorkflowPageFrame>
  );
}
