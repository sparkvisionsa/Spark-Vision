"use client";

import { Tajawal } from "next/font/google";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
const DEFAULT_STANDARDS_VERSION = "معايير التقييم الدولية IVS 2025";
const DEFAULT_CURRENCY_LABEL = "الريال السعودي (ر.س)";
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
  standardsVersion: DEFAULT_STANDARDS_VERSION,
  scopeOfWorkDetails: "",
  useRestriction: "",
  externalSpecialistUse: "",
  esgConsiderations: "",
  informationSources: "",
  assetSubjectDescription: DEFAULT_ASSET_SUBJECT_DESCRIPTION,
  assetDetailedDescription: "",
  inspectionLocation: "",
  inspectionMapUrl: "",
  currencyLabel: DEFAULT_CURRENCY_LABEL,
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
  wordImageQuality: 100,
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
    standardsVersion:
      data?.standardsVersion?.trim() || DEFAULT_STANDARDS_VERSION,
    currencyLabel:
      data?.currencyLabel?.trim() || DEFAULT_CURRENCY_LABEL,
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
  const [incompleteWarningOpen, setIncompleteWarningOpen] = useState(false);
  const [missingFieldLabels, setMissingFieldLabels] = useState<string[]>([]);
  const [invalidFieldKeys, setInvalidFieldKeys] = useState<Set<string>>(
    () => new Set(),
  );
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

  const reportFieldChecks = useMemo(() => {
    const textMissing = (value: unknown) =>
      typeof value !== "string" || value.trim().length === 0;
    const checks: Array<{
      key: string;
      label: string;
      section: MvReportCollapsibleSectionId;
      missing: boolean;
    }> = [
      { key: "projectName", label: t("reportData.fields.projectName"), section: "basic", missing: textMissing(editableProjectName) },
      { key: "reportTitle", label: t("reportData.fields.coverTitle"), section: "basic", missing: textMissing(reportData.reportTitle) },
      { key: "reportReference", label: t("reportData.fields.reference"), section: "basic", missing: textMissing(reportData.reportReference) },
      { key: "valuationMethod", label: t("reportData.fields.valuationMethod"), section: "basic", missing: textMissing(reportData.valuationMethod) },
      { key: "valuationPurpose", label: t("reportData.fields.valuationPurpose"), section: "basic", missing: textMissing(reportData.valuationPurpose) },
      { key: "valuePremise", label: t("reportData.fields.valuePremise"), section: "basic", missing: textMissing(reportData.valuePremise) },
      { key: "valuationBasis", label: t("reportData.fields.valuationBasis"), section: "basic", missing: textMissing(reportData.valuationBasis) },
      { key: "reportTypeLabel", label: t("reportData.fields.professionalReportType"), section: "basic", missing: textMissing(reportData.reportTypeLabel) },
      { key: "standardsVersion", label: t("reportData.fields.standards"), section: "basic", missing: textMissing(reportData.standardsVersion) },
      { key: "currencyLabel", label: t("reportData.fields.currency"), section: "basic", missing: textMissing(reportData.currencyLabel) },
      { key: "reportIssueDate", label: t("reportData.fields.issueDate"), section: "basic", missing: textMissing(reportData.reportIssueDate) },
      { key: "inspectionDate", label: t("reportData.fields.inspectionDate"), section: "basic", missing: textMissing(reportData.inspectionDate) },
      { key: "valuationDate", label: t("reportData.fields.valuationDate"), section: "basic", missing: textMissing(reportData.valuationDate) },
      { key: "agreementDate", label: t("reportData.fields.agreementDate"), section: "basic", missing: textMissing(reportData.agreementDate) },
      { key: "inspectionLocation", label: t("reportData.fields.inspectionLocation"), section: "basic", missing: textMissing(reportData.inspectionLocation) },
      { key: "clientName", label: t("reportData.client.name"), section: "client", missing: textMissing(reportData.clientName) },
      { key: "clientActivity", label: t("reportData.client.activity"), section: "client", missing: textMissing(reportData.clientActivity) },
      { key: "clientRepresentativeName", label: t("reportData.client.representative"), section: "client", missing: textMissing(reportData.clientRepresentativeName) },
      { key: "clientRepresentativeRole", label: t("reportData.client.representativeRole"), section: "client", missing: textMissing(reportData.clientRepresentativeRole) },
      { key: "intendedUsers", label: t("reportData.client.intendedUsers"), section: "client", missing: textMissing(reportData.intendedUsers) },
      { key: "intendedUse", label: t("reportData.client.intendedUse"), section: "client", missing: textMissing(reportData.intendedUse) },
      { key: "finalValue", label: t("reportData.finalValue.amount"), section: "finalValue", missing: reportData.finalValue == null },
      { key: "assetSubjectDescription", label: t("reportData.basisPremise.assetSubjectDescription"), section: "basisPremise", missing: textMissing(reportData.assetSubjectDescription) },
      { key: "valuationBasisDefinition", label: t("reportData.basisPremise.valuationBasisDefinition"), section: "basisPremise", missing: textMissing(reportData.valuationBasisDefinition) },
      { key: "valuePremiseDefinition", label: t("reportData.basisPremise.valuePremiseDefinition"), section: "basisPremise", missing: textMissing(reportData.valuePremiseDefinition) },
      {
        key: "valuationTeam",
        label: t("reportData.sections.participants"),
        section: "participants",
        missing: !Array.isArray(reportData.valuationTeam) || reportData.valuationTeam.length === 0,
      },
    ];

    if (Array.isArray(reportData.valuationTeam)) {
      reportData.valuationTeam.forEach((member) => {
        checks.push({
          key: `valuationTeamRole:${member.id}`,
          label: `${t("reportData.participants.roleField")}: ${member.name || t("reportData.participants.nameMissing")}`,
          section: "participants",
          missing: textMissing(member.role),
        });
      });
    }
    return checks;
  }, [editableProjectName, reportData, t]);

  const sectionCompletion = useMemo(
    () =>
      MV_REPORT_COLLAPSIBLE_IDS.reduce(
        (result, section) => {
          const checks = reportFieldChecks.filter((check) => check.section === section);
          const complete = checks.filter((check) => !check.missing).length;
          result[section] = checks.length === 0 ? 100 : Math.round((complete / checks.length) * 100);
          return result;
        },
        {} as Record<MvReportCollapsibleSectionId, number>,
      ),
    [reportFieldChecks],
  );

  const displayedInvalidFieldKeys = useMemo(
    () =>
      new Set(
        reportFieldChecks
          .filter((check) => check.missing && invalidFieldKeys.has(check.key))
          .map((check) => check.key),
      ),
    [invalidFieldKeys, reportFieldChecks],
  );

  const persistReportData = async () => {
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
      setInvalidFieldKeys(new Set());
      setMissingFieldLabels([]);
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

  const handleSaveReportData = async () => {
    const missing = reportFieldChecks.filter((check) => check.missing);
    if (missing.length > 0) {
      setMissingFieldLabels(missing.map((item) => item.label));
      setInvalidFieldKeys(new Set(missing.map((item) => item.key)));
      setOpenSections(createMvReportCollapsibleState(true));
      setIncompleteWarningOpen(true);
      return;
    }
    await persistReportData();
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
            invalidFieldKeys={displayedInvalidFieldKeys}
            sectionCompletion={sectionCompletion}
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

      <AlertDialog open={incompleteWarningOpen} onOpenChange={setIncompleteWarningOpen}>
        <AlertDialogContent
          overlayClassName="bg-slate-950/35 backdrop-blur-md"
          className="w-[calc(100%-2rem)] max-w-[26rem] gap-0 overflow-hidden rounded-3xl border border-white/80 bg-white/95 p-0 text-start shadow-[0_24px_80px_-20px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:rounded-3xl"
          dir={dir}
        >
          <div className="h-1 bg-gradient-to-r from-rose-500 via-red-500 to-orange-400" />
          <div className="p-5 sm:p-6">
            <AlertDialogHeader className="space-y-1.5 text-center sm:text-center">
              <div className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-50 to-rose-100 text-red-600 ring-1 ring-red-100 shadow-sm">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </div>
              <AlertDialogTitle className="text-center text-[17px] font-black text-slate-950">
                {t("reportData.incomplete.title")}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-xs font-semibold leading-5 text-slate-500">
                {t("reportData.incomplete.description", { count: missingFieldLabels.length })}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="mt-4 rounded-2xl bg-slate-50/90 p-3 ring-1 ring-inset ring-slate-200/80">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-extrabold text-slate-600">
                  {t("reportData.incomplete.listTitle")}
                </p>
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-100 px-2 text-[10px] font-black tabular-nums text-red-700">
                  {missingFieldLabels.length}
                </span>
              </div>
              <ul className="max-h-28 space-y-1 overflow-y-auto pe-1 text-[11px] font-bold text-slate-700">
                {missingFieldLabels.map((label) => (
                  <li key={label} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-slate-100">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                    <span className="truncate">{label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <AlertDialogFooter className="mt-4 grid grid-cols-2 gap-2 sm:grid sm:space-x-0">
              <AlertDialogCancel className="mt-0 h-10 rounded-xl border-slate-200 text-xs font-extrabold text-slate-700 shadow-none hover:bg-slate-50">
                {t("reportData.incomplete.fillFields")}
              </AlertDialogCancel>
              <AlertDialogAction
                className="h-10 rounded-xl bg-slate-950 text-xs font-extrabold shadow-lg shadow-slate-900/15 hover:bg-slate-800"
                onClick={() => void persistReportData()}
              >
                {t("reportData.incomplete.saveAnyway")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <MvUnsavedSaveCoach
        open={showUnsavedCoach}
        saveButtonEl={saveButtonEl}
        onDismiss={dismissUnsavedCoach}
        onIgnore={ignoreUnsavedAndLeave}
      />
    </MvWorkflowPageFrame>
  );
}
