"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  isCustomFieldValueMissing,
  normalizeReportCustomFields,
  normalizeReportCustomSections,
} from "./mv-report-custom-fields";
import {
  getReportDataModel,
  isReportDataModelCustomField,
  normalizeReportDataModels,
  type MvReportDataModel,
} from "./mv-report-data-models";
import { MvErrorState, MvPageLoading } from "./mv-ui";
import { systemArabicFont as reportFont } from "@/lib/system-fonts";

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
  customFields: [],
  customSections: [],
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
    customFields: normalizeReportCustomFields(data?.customFields),
    customSections: normalizeReportCustomSections(data?.customSections),
  };
}

const MODEL_BUILT_IN_SECTION_IDS = new Set<string>(MV_REPORT_COLLAPSIBLE_IDS);

/**
 * Materialize the model's company fields in the project's existing custom
 * field store.  Values stay inside `reportData`, which also lets the merge
 * services expose the same keys to Word and PowerPoint.
 */
function applyReportDataModel(
  current: MvProjectReportData,
  model: MvReportDataModel,
): MvProjectReportData {
  const currentFields = normalizeReportCustomFields(current.customFields);
  const currentSections = normalizeReportCustomSections(current.customSections);
  const previousValueById = new Map(currentFields.map((field) => [field.id, field.value ?? ""]));
  const modelFields = model.sections
    .flatMap((section) =>
      section.fields
        .filter(isReportDataModelCustomField)
        .map((field) => ({ sectionId: section.id, field })),
    )
    .filter(({ field }) => field.sourceKey.slice("field:".length).trim().length > 0);
  const modelFieldIds = new Set(modelFields.map(({ field }) => field.sourceKey.slice("field:".length)));
  const manualFields = currentFields.filter((field) => !field.modelId && !modelFieldIds.has(field.id));
  const generatedFields = modelFields.map(({ sectionId, field }) => {
    const id = field.sourceKey.slice("field:".length);
    return {
      id,
      sectionId,
      modelId: model.id,
      label: field.label,
      type: field.type,
      required: field.required,
      value: previousValueById.get(id) ?? "",
    };
  });
  const modelSections = model.sections
    .filter((section) => !MODEL_BUILT_IN_SECTION_IDS.has(section.id))
    .map((section) => ({ id: section.id, title: section.title, modelId: model.id }));
  const modelSectionIds = new Set(modelSections.map((section) => section.id));
  const manualSections = currentSections.filter(
    (section) => !section.modelId && !modelSectionIds.has(section.id),
  );

  return {
    ...current,
    reportDataModelId: model.id,
    customFields: [...manualFields, ...generatedFields],
    customSections: [...manualSections, ...modelSections],
  };
}

function reportDataNeedsModelMaterialization(
  data: MvProjectReportData,
  model: MvReportDataModel,
): boolean {
  if (data.reportDataModelId !== model.id) return true;
  const fields = normalizeReportCustomFields(data.customFields);
  const modelFieldIds = new Set(
    model.sections
      .flatMap((section) => section.fields)
      .filter(isReportDataModelCustomField)
      .map((field) => field.sourceKey.slice("field:".length)),
  );
  if (fields.some((field) => field.modelId === model.id && !modelFieldIds.has(field.id))) return true;
  for (const field of model.sections.flatMap((section) => section.fields).filter(isReportDataModelCustomField)) {
    const id = field.sourceKey.slice("field:".length);
    const stored = fields.find((item) => item.id === id && item.modelId === model.id);
    if (
      !stored ||
      stored.label !== field.label ||
      stored.type !== field.type ||
      stored.required !== field.required ||
      stored.sectionId !== model.sections.find((section) => section.fields.includes(field))?.id
    ) {
      return true;
    }
  }
  const sections = normalizeReportCustomSections(data.customSections);
  return model.sections
    .filter((section) => !MODEL_BUILT_IN_SECTION_IDS.has(section.id))
    .some((section) => {
      const stored = sections.find((item) => item.id === section.id && item.modelId === model.id);
      return !stored || stored.title !== section.title;
    });
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
      (Array.isArray(data.valuationTeam) && data.valuationTeam.length > 0) ||
      (Array.isArray(data.customFields) && data.customFields.length > 0) ||
      (Array.isArray(data.customSections) && data.customSections.length > 0),
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
  const [reportDataModels, setReportDataModels] = useState<MvReportDataModel[]>(() =>
    normalizeReportDataModels(null),
  );
  const [reportDataModelsLoaded, setReportDataModelsLoaded] = useState(false);
  const [modelChoiceOpen, setModelChoiceOpen] = useState(false);
  const [pendingModelId, setPendingModelId] = useState("");
  // يبدأ نموذج المشروع المبسط مطوياً دائماً، حتى عند العودة إلى مشروع يحتوي
  // على بيانات محفوظة أو أقسام مخصصة من نموذج بيانات التقرير.
  const [openSections, setOpenSections] = useState<Record<MvReportCollapsibleSectionId, boolean>>(() =>
    createMvReportCollapsibleState(false),
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
        setOpenSections(createMvReportCollapsibleState(false));
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
      setOpenSections(createMvReportCollapsibleState(false));
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
    void mvFetchJson<{
      reportSignatoryRows?: unknown[];
      reportDefaults?: { reportDataModels?: unknown };
    }>(
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
        const models = normalizeReportDataModels(data.reportDefaults?.reportDataModels);
        setReportDataModels(models);
        setPendingModelId((current) => current || models[0]?.id || "");
      })
      .catch(() => {
        if (!cancelled) {
          setPreparerOptions([]);
          const models = normalizeReportDataModels(null);
          setReportDataModels(models);
          setPendingModelId((current) => current || models[0]?.id || "");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreparersLoading(false);
          setPreparersLoaded(true);
          setReportDataModelsLoaded(true);
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

  useEffect(() => {
    if (!project || !reportDataModelsLoaded) return;
    const selectedId = reportData.reportDataModelId?.trim() ?? "";
    const selectedIsAvailable = reportDataModels.some((model) => model.id === selectedId);
    if (selectedIsAvailable) {
      const selectedModel = getReportDataModel(reportDataModels, selectedId);
      if (reportDataNeedsModelMaterialization(reportData, selectedModel)) {
        setReportData((current) => applyReportDataModel(current, selectedModel));
      }
      setModelChoiceOpen(false);
      return;
    }
    if (reportDataModels.length <= 1) {
      const defaultModel = reportDataModels[0]!;
      if (reportDataNeedsModelMaterialization(reportData, defaultModel)) {
        setReportData((current) => applyReportDataModel(current, defaultModel));
      }
      setModelChoiceOpen(false);
      return;
    }
    setPendingModelId(reportDataModels[0]?.id ?? "");
    setModelChoiceOpen(true);
  }, [project, reportData, reportDataModels, reportDataModelsLoaded]);

  const activeReportDataModel = useMemo(
    () => getReportDataModel(reportDataModels, reportData.reportDataModelId),
    [reportData.reportDataModelId, reportDataModels],
  );

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
        visitedFinalReport: visitedSteps.has("final-report"),
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
    const missingForSystemField = (sourceKey: string) => {
      if (sourceKey === "projectName") return textMissing(editableProjectName);
      if (sourceKey === "displayNumber") {
        return typeof project?.displayNumber !== "number" || !Number.isFinite(project.displayNumber);
      }
      if (sourceKey === "finalValue") return reportData.finalValue == null;
      if (sourceKey === "valuationTeam") {
        return !Array.isArray(reportData.valuationTeam) || reportData.valuationTeam.length === 0;
      }
      const value = reportData[sourceKey as keyof MvProjectReportData];
      if (typeof value === "string") return textMissing(value);
      if (typeof value === "number") return !Number.isFinite(value);
      return value == null;
    };
    const checks: Array<{
      key: string;
      label: string;
      section: string;
      missing: boolean;
    }> = activeReportDataModel.sections.flatMap((section) =>
      section.fields
        .filter((field) => field.required && !isReportDataModelCustomField(field))
        .map((field) => ({
          key: field.sourceKey,
          label: field.label,
          section: section.id,
          missing: missingForSystemField(field.sourceKey),
        })),
    );

    const valuationTeamRequired = activeReportDataModel.sections.some((section) =>
      section.fields.some(
        (field) => field.sourceKey === "valuationTeam" && field.required,
      ),
    );
    if (valuationTeamRequired && Array.isArray(reportData.valuationTeam)) {
      reportData.valuationTeam.forEach((member) => {
        checks.push({
          key: `valuationTeamRole:${member.id}`,
          label: `${t("reportData.participants.roleField")}: ${member.name || t("reportData.participants.nameMissing")}`,
          section: "participants",
          missing: textMissing(member.role),
        });
      });
    }
    for (const field of reportData.customFields ?? []) {
      // Optional custom fields are intentionally excluded from completion
      // and missing-field calculations, just like every other optional input.
      if (!field.required) continue;
      checks.push({
        key: `customField:${field.id}`,
        label: field.label,
        section: field.sectionId,
        missing: isCustomFieldValueMissing(field),
      });
    }
    return checks;
  }, [activeReportDataModel, editableProjectName, project?.displayNumber, reportData, t]);

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

  const persistReportData = async (
    reportDataOverride?: MvProjectReportData,
    options: { silent?: boolean } = {},
  ): Promise<boolean> => {
    if (!project) return false;
    const name = editableProjectName.trim();
    if (!name) {
      if (!options.silent) {
        toast({ variant: "destructive", description: t("reportData.nameRequired") });
      }
      return false;
    }

    setShowUnsavedCoach(false);
    pendingNavigationRef.current = null;

    const sourceReportData = reportDataOverride ?? reportData;
    const normalizedData = normalizeReportData({
      ...sourceReportData,
      finalValueWords:
        sourceReportData.finalValue == null
          ? ""
          : numberToArabicRiyalWords(sourceReportData.finalValue),
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
      invalidateMvApiCache("projects:");
      markVisited("report-data");
      if (!options.silent) toast({ description: t("reportData.saved") });
      return true;
    } catch {
      if (!options.silent) {
        toast({ variant: "destructive", description: t("reportData.saveFailed") });
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  const selectReportDataModel = useCallback(
    async (modelId: string) => {
      const model = getReportDataModel(reportDataModels, modelId);
      const nextReportData = applyReportDataModel(reportData, model);
      setPendingModelId(model.id);

      // اختيار النموذج هو إعداد للمشروع نفسه، وليس مجرد تفضيل لواجهة الصفحة.
      // نحفظه فوراً كي لا يعود سؤال الاختيار عند دخول المشروع في المرة التالية.
      const saved = await persistReportData(nextReportData, { silent: true });
      if (!saved) {
        toast({
          variant: "destructive",
          description: "تعذر حفظ نموذج بيانات التقرير. حاول مرة أخرى.",
        });
        return;
      }

      setOpenSections(createMvReportCollapsibleState(false));
      setModelChoiceOpen(false);
      toast({ description: `تم حفظ نموذج «${model.name}» لهذا المشروع.` });
    },
    [persistReportData, reportData, reportDataModels, toast],
  );

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
    setReportData(applyReportDataModel(normalizeReportData(null), activeReportDataModel));
    setOpenSections(createMvReportCollapsibleState(true));
    toast({ description: t("reportData.reset.done") });
  }, [activeReportDataModel, markDirty, t, toast]);

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
          {!reportDataModelsLoaded || modelChoiceOpen ? (
            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-200/80 bg-white/90 px-5 text-center shadow-sm">
              <div className="max-w-sm">
                <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </span>
                <p className="mt-3 text-[13px] font-black text-slate-900">جاري تجهيز نموذج بيانات التقرير</p>
                <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
                  اختر نموذجًا مناسبًا للمشروع قبل إدخال بيانات التقرير.
                </p>
              </div>
            </div>
          ) : (
            <>
              <section className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 shadow-sm">
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-slate-400">نموذج بيانات التقرير</p>
                  <p className="truncate text-[12px] font-black text-slate-900">{activeReportDataModel.name}</p>
                </div>
                {reportDataModels.length > 1 ? (
                  <Select
                    value={activeReportDataModel.id}
                    onValueChange={(nextId) => {
                      if (nextId === activeReportDataModel.id) return;
                      if (
                        reportDataLooksFilled(reportData) &&
                        !window.confirm("سيبقى المحتوى الحالي محفوظًا، وستتغير الحقول الظاهرة حسب النموذج الجديد. متابعة؟")
                      ) {
                        return;
                      }
                      selectReportDataModel(nextId);
                    }}
                  >
                    <SelectTrigger className="h-8 w-[min(19rem,100%)] rounded-lg border-slate-200 bg-slate-50 text-[10px] font-bold shadow-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      {reportDataModels.map((model) => (
                        <SelectItem key={model.id} value={model.id} className="text-[11px] font-bold">
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </section>
              <MvReportDataForm
                project={project}
                editableProjectName={editableProjectName}
                reportData={reportData}
                reportDataModel={activeReportDataModel}
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
            </>
          )}
        </main>
      </MvWorkflowPageScrollBody>

      <MvCloneReportDataDialog
        open={cloneDialogOpen}
        onOpenChange={setCloneDialogOpen}
        currentProjectId={projectId}
        onCloned={handleReportDataCloned}
      />

      <Dialog
        open={modelChoiceOpen}
        onOpenChange={(open) => {
          // A project with multiple company models must deliberately choose
          // one; the dialog therefore cannot be dismissed as an empty form.
          if (open) setModelChoiceOpen(true);
        }}
      >
        <DialogContent
          dir={dir}
          className="w-[calc(100%-2rem)] max-w-md gap-0 overflow-hidden rounded-3xl border border-white/80 bg-white p-0 text-right shadow-[0_24px_80px_-20px_rgba(15,23,42,0.45)]"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <div className="h-1 bg-gradient-to-l from-sky-700 via-sky-500 to-cyan-400" />
          <div className="p-5 sm:p-6">
            <DialogHeader className="space-y-1.5 text-right sm:text-right">
              <DialogTitle className="text-[17px] font-black text-slate-950">اختر نموذجًا للمشروع</DialogTitle>
              <DialogDescription className="text-[12px] font-semibold leading-5 text-slate-500">
                تعتمد الحقول الظاهرة ومصادر الربط في القوالب على النموذج الذي تختاره لهذا المشروع.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5">
              <label className="grid gap-1.5 text-[10px] font-black text-slate-500">
                نموذج بيانات التقرير
                <Select value={pendingModelId} onValueChange={setPendingModelId} disabled={saving}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-slate-50 text-[12px] font-black shadow-none">
                    <SelectValue placeholder="اختر النموذج" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {reportDataModels.map((model) => (
                      <SelectItem key={model.id} value={model.id} className="text-[12px] font-bold">
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
            <DialogFooter className="mt-5 sm:justify-start">
              <Button
                type="button"
                className="h-10 w-full rounded-xl bg-[#0C447C] text-[12px] font-black hover:bg-[#0a3a66]"
                disabled={!pendingModelId || saving}
                onClick={() => void selectReportDataModel(pendingModelId)}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? "جاري حفظ النموذج…" : "استخدام هذا النموذج"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

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
                {missingFieldLabels.map((label, index) => (
                  <li key={`${label}-${index}`} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-slate-100">
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
