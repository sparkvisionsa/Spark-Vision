"use client";

import { Tajawal } from "next/font/google";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Client as MachineClient } from "@/lib/types/clients";
import { cn } from "@/lib/utils";
import { numberToArabicRiyalWords } from "./mv-arabic-number-words";
import {
  countProjectAssetImages,
  MvProjectReportHeader,
  mvSimpleReportStepHref,
  readVisitedSimpleReportSteps,
  type MvSimpleReportStepId,
  writeVisitedSimpleReportSteps,
} from "./mv-simple-report-navigation";
import { computeCompletedSimpleReportSteps } from "./mv-simple-project-progress";
import {
  createMvReportCollapsibleState,
  MV_REPORT_COLLAPSIBLE_IDS,
  MvReportDataForm,
  type MvReportCollapsibleSectionId,
} from "./mv-report-data-form";
import {
  normalizeReportPreparerOptions,
  normalizeReportTeam,
  reportTeamEquals,
  type MvReportPreparerOption,
} from "./mv-report-preparers";
import { MvCloneReportDataDialog } from "./mv-clone-report-data-dialog";
import { MvUnsavedSaveCoach } from "./mv-unsaved-save-coach";
import type { MvProject, MvProjectReportData, MvSubProject } from "./types";
import { useMvInPageNavigation } from "./mv-inpage-navigation";
import { MvWorkflowPageFrame, MvWorkflowPageScrollBody } from "./mv-workflow-page-frame";
import { invalidateMvApiCache, isMvAbortError, mvErrorMessage, mvFetchJson } from "./mv-api-client";
import {
  loadProjectSummarySafe,
  readProjectSummaryCache,
  writeProjectSummaryCache,
} from "./mv-project-summary-loader";
import { useMvI18n } from "./mv-i18n";
import { MvErrorState, MvPageLoading } from "./mv-ui";

const reportFont = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
});

const DEFAULT_ASSET_SINGULAR_PLURAL = "أصل/أصول";
const DEFAULT_ASSET_SUBJECT_DESCRIPTION = "الات ومعدات واجهزة متنوعه";
const DEFAULT_VALUATION_BASIS_DEFINITION =
  "الأساس المناسب سيكون قيمة التصفية بافتراض فرضية التقييم خارج الموقع والتي يتم تعريفها على النحو التالي:المبلغ الناتج عن بيع أصل أو مجموعة من الأصول بغرض التصفية مع اجبار البائع على البيع اعتبارا من تاريخ محدد. (-1أ60. IVS2025 102 أسس القيمة).";
const DEFAULT_VALUE_PREMISE_DEFINITION =
  "البيع القسري هـي قيمـة يسـتخدم مصطلـح «البيـع القـسري» غالبًـا في الظـروف التـي يكـون فيهـا البائـع تحـت الإجبـار للقيـام بالبيـع،ً ونتيجـة لذلـك تصبـح فـرة التسـويق غـر كافيـة، ويمكـن ألا يسـتطيع المشـرون القيـام بأعـمال الفحـص النـافي للجهالـة.ويعتمـد السـعر الـذي يمكـن الحصـول عليـه في هـذه الظـروف عـلى طبيعـة الضغـوط عـى البائـع وأسـباب عـدم إمكانيـةالقيـام بالتسـويق المناسـب. كـا يمكـن أن يبيـن هـذا السـعر تبعـات عـدم تمكـن البائـع مـن البيـع في الفتـرة المتاحـة. ولايمكـن تقديـر السـعر المحقـق مـن البيـع القـسري بصـورة معقولـة مـا لم تتضـح طبيعـة القيـود المفروضـة عـى البائـع وسـببها. ويبـن السـعر الـذي يقبـل بـه البائـع في عمليـة البيـع القـسري ظروفـه الخاصـة أكثـر مـن ظـروف بائـع راغـبً افـتـراضي . (120.1 IVS2025 102 أسس القيمة).";

const LEGACY_ARABIC_VALUATION_PURPOSES: Record<string, string> = {
  بيع: "البيع",
  شراء: "الشراء",
  محاسبة: "المحاسبة",
  رهن: "الرهن",
  إفلاس: "الإفلاس",
  تمويل: "التمويل",
  تأمين: "التأمين",
  "نزاعات و تقاضي": "النزاعات والتقاضي",
  أخرى: "الأخرى",
};

function normalizeValuationPurpose(value: string | undefined): string {
  const normalized = value?.trim() ?? "";
  return LEGACY_ARABIC_VALUATION_PURPOSES[normalized] ?? normalized;
}

const EMPTY_REPORT_DATA: MvProjectReportData = {
  reportReference: "",
  reportTitle: "",
  assetSingularPlural: DEFAULT_ASSET_SINGULAR_PLURAL,
  valuationMethod: "",
  valuationPurpose: "",
  valuePremise: "",
  valuePremiseDefinition: DEFAULT_VALUE_PREMISE_DEFINITION,
  valuationBasis: "",
  valuationBasisDefinition: DEFAULT_VALUATION_BASIS_DEFINITION,
  includeAssetImages: true,
  includeValuationAccountImages: true,
  reportIssueDate: "",
  agreementDate: "",
  inspectionDate: "",
  valuationDate: "",
  clientId: "",
  clientName: "",
  clientEmail: "",
  clientPhone: "",
  clientLegalType: "",
  clientActivity: "",
  clientRepresentativeName: "",
  clientRepresentativeRole: "",
  intendedUsers: "",
  intendedUse: "",
  valuationFirmName: "",
  valuationFirmLicense: "",
  valuationFirmAddress: "",
  leadValuerName: "",
  leadValuerTitle: "",
  leadValuerMembershipNo: "",
  reportTypeLabel: "",
  standardsVersion: "",
  scopeOfWorkDetails: "",
  useRestriction: "",
  externalSpecialistUse: "",
  esgConsiderations: "",
  informationSources: "",
  assetSubjectDescription: DEFAULT_ASSET_SUBJECT_DESCRIPTION,
  assetDetailedDescription: "",
  inspectionLocation: "",
  inspectionMapUrl: "",
  currencyLabel: "",
  methodologyRationale: "",
  costApproachDetails: "",
  importantAssumptions: "",
  generalAssumptions: "",
  specialAssumptions: "",
  finalValue: null,
  finalValueWords: "",
  reportPresentationDraft: true,
  receivedClientDocumentsHtml: "",
  wordAssetImagesPerRow: 4,
  wordImageQuality: 90,
  sceRegistrationCertificateHtml: "",
};

function normalizeReportData(data: MvProjectReportData | undefined | null): MvProjectReportData {
  const finalValue =
    typeof data?.finalValue === "number" && Number.isFinite(data.finalValue) ? data.finalValue : null;
  return {
    ...EMPTY_REPORT_DATA,
    ...(data ?? {}),
    assetSingularPlural:
      data?.assetSingularPlural?.trim() || DEFAULT_ASSET_SINGULAR_PLURAL,
    assetSubjectDescription:
      data?.assetSubjectDescription?.trim() || DEFAULT_ASSET_SUBJECT_DESCRIPTION,
    valuationBasisDefinition:
      data?.valuationBasisDefinition?.trim() || DEFAULT_VALUATION_BASIS_DEFINITION,
    valuePremiseDefinition:
      data?.valuePremiseDefinition?.trim() || DEFAULT_VALUE_PREMISE_DEFINITION,
    valuationPurpose: normalizeValuationPurpose(data?.valuationPurpose),
    includeAssetImages: data?.includeAssetImages !== false,
    includeValuationAccountImages: data?.includeValuationAccountImages !== false,
    reportPresentationDraft: data?.reportPresentationDraft !== false,
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

function reportDataLooksFilled(data: MvProjectReportData): boolean {
  return Boolean(
    data.reportTitle?.trim() ||
      data.reportReference?.trim() ||
      data.clientName?.trim() ||
      data.clientId?.trim() ||
      data.valuationMethod?.trim() ||
      data.valuationPurpose?.trim() ||
      data.reportIssueDate?.trim() ||
      data.finalValue != null ||
      (Array.isArray(data.valuationTeam) && data.valuationTeam.length > 0),
  );
}

export default function MvReportDataWorkspace({ projectId }: MvReportDataWorkspaceProps) {
  const { t, dir } = useMvI18n();
  const { navigate, registerNavigationBlocker } = useMvInPageNavigation();
  const { toast } = useToast();
  const initialCached = readProjectSummaryCache(projectId, "report");
  const [project, setProject] = useState<MvProject | null>(initialCached?.project ?? null);
  const [subProjects, setSubProjects] = useState<MvSubProject[]>(initialCached?.subProjects ?? []);
  const [loading, setLoading] = useState(() => initialCached?.project == null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const reportDataDirtyRef = useRef(false);
  const projectNameDirtyRef = useRef(false);
  const isDirtyRef = useRef(false);
  const saveButtonRef = useRef<HTMLButtonElement | null>(null);
  const pendingNavigationRef = useRef<string | null>(null);
  const tRef = useRef(t);
  tRef.current = t;
  const [saveButtonEl, setSaveButtonEl] = useState<HTMLElement | null>(null);
  const [showUnsavedCoach, setShowUnsavedCoach] = useState(false);
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [visitedSteps, setVisitedSteps] = useState<Set<MvSimpleReportStepId>>(
    () => new Set(["report-data"]),
  );
  const [reportData, setReportData] = useState<MvProjectReportData>(() =>
    normalizeReportData(initialCached?.project.reportData),
  );
  const [editableProjectName, setEditableProjectName] = useState(() => initialCached?.project.name ?? "");
  const [machineClients, setMachineClients] = useState<MachineClient[]>([]);
  const [preparerOptions, setPreparerOptions] = useState<MvReportPreparerOption[]>([]);
  const [preparersLoading, setPreparersLoading] = useState(true);
  const [preparersLoaded, setPreparersLoaded] = useState(false);
  const [openSections, setOpenSections] = useState<Record<MvReportCollapsibleSectionId, boolean>>(() =>
    createMvReportCollapsibleState(
      reportDataLooksFilled(normalizeReportData(initialCached?.project.reportData)),
    ),
  );

  const markClean = useCallback(() => {
    reportDataDirtyRef.current = false;
    projectNameDirtyRef.current = false;
    isDirtyRef.current = false;
  }, []);

  const markDirty = useCallback(() => {
    isDirtyRef.current = true;
  }, []);

  const revealUnsavedCoach = useCallback((nextPath?: string | null) => {
    pendingNavigationRef.current = nextPath ?? null;
    setSaveButtonEl(saveButtonRef.current);
    setShowUnsavedCoach(true);
  }, []);

  const dismissUnsavedCoach = useCallback(() => {
    pendingNavigationRef.current = null;
    setShowUnsavedCoach(false);
  }, []);

  const ignoreUnsavedAndLeave = useCallback(() => {
    const nextPath = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    markClean();
    setShowUnsavedCoach(false);
    if (nextPath) {
      startTransition(() => {
        navigate(nextPath);
      });
    }
  }, [markClean, navigate]);

  useEffect(() => {
    return registerNavigationBlocker(({ nextPath, currentPath }) => {
      if (!isDirtyRef.current) return true;
      const next = nextPath.split("?")[0]?.replace(/\/+$/, "") ?? nextPath;
      const current = currentPath.split("?")[0]?.replace(/\/+$/, "") ?? currentPath;
      if (next === current) return true;
      // Same report-data route variants
      const reportDataBase = `/machine-valuation/${projectId}/workflow/report-data`;
      const reportDataShort = `/machine-valuation/${projectId}`;
      if (next === reportDataBase || next === reportDataShort) return true;
      revealUnsavedCoach(nextPath);
      return false;
    });
  }, [projectId, registerNavigationBlocker, revealUnsavedCoach]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    const cached = readProjectSummaryCache(projectId, "report");
    const hasUsableCache = cached?.project?._id === projectId;
    if (!hasUsableCache) setLoading(true);
    setLoadError(null);
    try {
      const { payload, error } = await loadProjectSummarySafe(projectId, {
        mode: "report",
        signal,
        timeoutMs: 30_000,
      });
      if (signal?.aborted) return;
      if (!payload?.project) {
        setLoadError(
          mvErrorMessage(error, tRef.current("reportData.loadFailedTitle")),
        );
        setProject((current) => (current?._id === projectId ? current : null));
        return;
      }
      setProject(payload.project);
      setSubProjects(payload.subProjects ?? []);
      writeProjectSummaryCache(
        projectId,
        { project: payload.project, subProjects: payload.subProjects ?? [] },
        "report",
      );
      if (!projectNameDirtyRef.current) setEditableProjectName(payload.project.name ?? "");
      if (!reportDataDirtyRef.current) {
        const nextReportData = normalizeReportData(payload.project.reportData);
        setReportData(nextReportData);
        if (reportDataLooksFilled(nextReportData)) {
          setOpenSections(createMvReportCollapsibleState(true));
        }
      }
      setLoadError(null);
    } catch (error) {
      if (signal?.aborted || isMvAbortError(error)) return;
      setLoadError(mvErrorMessage(error, tRef.current("reportData.loadFailedTitle")));
      setProject((current) => (current?._id === projectId ? current : null));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const cached = readProjectSummaryCache(projectId, "report");
    projectNameDirtyRef.current = false;
    reportDataDirtyRef.current = false;
    isDirtyRef.current = false;
    pendingNavigationRef.current = null;
    setShowUnsavedCoach(false);
    setProject((current) => {
      if (cached?.project?._id === projectId) return cached.project;
      if (current?._id === projectId) return current;
      return null;
    });
    setSubProjects(cached?.project?._id === projectId ? cached.subProjects : []);
    if (cached?.project?._id === projectId) {
      setEditableProjectName(cached.project.name ?? "");
      setReportData(normalizeReportData(cached.project.reportData));
      setOpenSections(
        createMvReportCollapsibleState(
          reportDataLooksFilled(normalizeReportData(cached.project.reportData)),
        ),
      );
    } else {
      setEditableProjectName("");
      setReportData(normalizeReportData(null));
      setOpenSections(createMvReportCollapsibleState(false));
    }
    setLoading(cached?.project?._id !== projectId);
    setLoadError(null);
    setVisitedSteps(new Set(readVisitedSimpleReportSteps(projectId)));
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
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

  useEffect(() => {
    let cancelled = false;
    const loadMachineClients = async () => {
      try {
        const rows = await mvFetchJson<MachineClient[]>(
          "/api/clients?productId=machine-valuation",
          {},
          {
            cacheKey: "machine-valuation:clients",
            cacheTtlMs: 30_000,
            retries: 1,
            timeoutMs: 12_000,
            trackLoading: false,
          },
        );
        if (!cancelled) setMachineClients(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setMachineClients([]);
      }
    };
    void loadMachineClients();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPreparersLoading(true);
    setPreparersLoaded(false);
    void mvFetchJson<{ reportSignatoryRows?: unknown[] }>(
      "/api/company/report-defaults",
      {},
      {
        cacheKey: "machine-valuation:report-preparers",
        cacheTtlMs: 30_000,
        retries: 1,
        timeoutMs: 12_000,
        trackLoading: false,
      },
    )
      .then((data) => {
        if (cancelled) return;
        setPreparerOptions(normalizeReportPreparerOptions(data.reportSignatoryRows));
      })
      .catch(() => {
        if (!cancelled) setPreparerOptions([]);
      })
      .finally(() => {
        if (!cancelled) {
          setPreparersLoading(false);
          setPreparersLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!preparersLoaded) return;
    // مزامنة صامتة — لا تعلّم النموذج متسخًا حتى لا تُحجب بيانات المشروع القادمة من الخادم.
    setReportData((current) => {
      const nextTeam = normalizeReportTeam(current.valuationTeam, preparerOptions);
      if (reportTeamEquals(current.valuationTeam, nextTeam)) return current;
      return { ...current, valuationTeam: nextTeam };
    });
  }, [preparerOptions, preparersLoaded, reportData.valuationTeam]);

  const assetImageCount = useMemo(() => countProjectAssetImages(subProjects), [subProjects]);

  const completedSteps = useMemo(() => {
    const valuationAccountImageCount =
      project?.valuationAccountingWorkspace?.images?.length ??
      project?.valuationAccountImageCount ??
      0;
    const clientDocumentImageCount =
      project?.clientDocumentsWorkspace?.images?.length ??
      project?.clientDocumentImageCount ??
      0;

    return new Set(
      computeCompletedSimpleReportSteps({
        reportData: project?.reportData,
        assetImageCount: assetImageCount > 0 ? assetImageCount : (project?.assetImageCount ?? 0),
        valuationAccountImageCount,
        clientDocumentImageCount,
        visitedReportPreview: visitedSteps.has("report-preview"),
      }),
    );
  }, [
    assetImageCount,
    project?.assetImageCount,
    project?.clientDocumentImageCount,
    project?.clientDocumentsWorkspace?.images,
    project?.reportData,
    project?.valuationAccountImageCount,
    project?.valuationAccountingWorkspace?.images,
    visitedSteps,
  ]);

  const handleSaveReportData = async () => {
    if (!project) return;
    const name = editableProjectName.trim();
    if (!name) {
      toast({ variant: "destructive", description: t("reportData.nameRequired") });
      return;
    }

    setShowUnsavedCoach(false);
    pendingNavigationRef.current = null;

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
      markClean();
      writeProjectSummaryCache(projectId, { project: updated, subProjects }, "report");
      markVisited("report-data");
      toast({ description: t("reportData.saved") });
    } catch {
      toast({ variant: "destructive", description: t("reportData.saveFailed") });
    } finally {
      setSaving(false);
    }
  };

  const onStepSelect = useCallback(
    (stepId: MvSimpleReportStepId) => {
      const href = mvSimpleReportStepHref(projectId, stepId);
      if (isDirtyRef.current) {
        revealUnsavedCoach(href);
        return;
      }
      markVisited(stepId);
      startTransition(() => {
        navigate(href);
      });
    },
    [markVisited, navigate, projectId, revealUnsavedCoach],
  );

  const handleResetReportData = useCallback(() => {
    if (!window.confirm(t("reportData.reset.confirm"))) return;
    reportDataDirtyRef.current = true;
    markDirty();
    setReportData(normalizeReportData(null));
    setOpenSections(createMvReportCollapsibleState(true));
    toast({ description: t("reportData.reset.done") });
  }, [markDirty, t, toast]);

  const handleProjectNameChange = useCallback(
    (value: string) => {
      projectNameDirtyRef.current = true;
      markDirty();
      setEditableProjectName(value);
    },
    [markDirty],
  );

  const handleReportDataChange = useCallback(
    (patch: Partial<MvProjectReportData>) => {
      reportDataDirtyRef.current = true;
      markDirty();
      setReportData((current) => ({ ...current, ...patch }));
    },
    [markDirty],
  );

  const handleReportDataCloned = useCallback(
    (updated: MvProject) => {
      setProject((current) => {
        const merged: MvProject = {
          ...(current ?? updated),
          ...updated,
          reportData: updated.reportData,
          // احتفظ بالمساحات/العدّادات المحلية إن كان رد الاستنساخ خفيفًا
          valuationAccountingWorkspace:
            updated.valuationAccountingWorkspace ?? current?.valuationAccountingWorkspace,
          clientDocumentsWorkspace:
            updated.clientDocumentsWorkspace ?? current?.clientDocumentsWorkspace,
          assetImageCount: updated.assetImageCount ?? current?.assetImageCount,
          valuationAccountImageCount:
            updated.valuationAccountImageCount ?? current?.valuationAccountImageCount,
          clientDocumentImageCount:
            updated.clientDocumentImageCount ?? current?.clientDocumentImageCount,
          inspectorFiles: updated.inspectorFiles?.length
            ? updated.inspectorFiles
            : current?.inspectorFiles,
        };
        writeProjectSummaryCache(
          projectId,
          { project: merged, subProjects },
          "report",
        );
        return merged;
      });
      setReportData(normalizeReportData(updated.reportData));
      markClean();
      invalidateMvApiCache("projects:");
      invalidateMvApiCache(`project-summary:${projectId}`);
      invalidateMvApiCache(`project-report:${projectId}`);
      toast({ description: t("reportData.clone.success") });
    },
    [markClean, projectId, subProjects, t, toast],
  );

  if (!project) {
    return (
      <MvWorkflowPageFrame className={reportFont.className} dir={dir}>
        {loading ? (
          <MvPageLoading label={t("reportData.loading")} />
        ) : (
          <MvErrorState
            title={t("reportData.loadFailedTitle")}
            description={loadError ?? t("common.error.loadDescription")}
            onRetry={() => void load()}
          />
        )}
      </MvWorkflowPageFrame>
    );
  }

  return (
    <MvWorkflowPageFrame
      className={cn(
        reportFont.className,
        "bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_32%),linear-gradient(180deg,#f8fafc,#eef2f7_52%,#f8fafc)]",
      )}
      dir={dir}
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
        <main className="mx-auto min-w-0 max-w-7xl overflow-x-hidden px-3 py-2 sm:px-5">
          <MvReportDataForm
            project={project}
            editableProjectName={editableProjectName}
            reportData={reportData}
            clientOptions={machineClients}
            preparerOptions={preparerOptions}
            preparersLoading={preparersLoading}
            saving={saving}
            openSections={openSections}
            saveButtonRef={saveButtonRef}
            highlightSave={showUnsavedCoach}
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
            onReset={handleResetReportData}
            onCloneFromProject={() => setCloneDialogOpen(true)}
          />
        </main>
      </MvWorkflowPageScrollBody>

      <MvCloneReportDataDialog
        open={cloneDialogOpen}
        onOpenChange={setCloneDialogOpen}
        currentProjectId={projectId}
        onCloned={handleReportDataCloned}
      />

      <MvUnsavedSaveCoach
        open={showUnsavedCoach}
        saveButtonEl={saveButtonEl}
        onDismiss={dismissUnsavedCoach}
        onIgnore={ignoreUnsavedAndLeave}
      />
    </MvWorkflowPageFrame>
  );
}
