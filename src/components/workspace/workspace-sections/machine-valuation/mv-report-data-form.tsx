"use client";

import type { ReactNode, Ref } from "react";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardList,
  Coins,
  Copy,
  Hash,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Scale,
  ShieldCheck,
  Signature,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Client as MachineClient } from "@/lib/types/clients";
import { cn } from "@/lib/utils";
import { useMvI18n } from "./mv-i18n";
import { numberToArabicRiyalWords } from "./mv-arabic-number-words";
import {
  normalizeReportTeam,
  reportTeamMemberFromOption,
  type MvReportPreparerOption,
} from "./mv-report-preparers";
import type { MvProject, MvProjectReportData, MvReportTeamMember } from "./types";

const NO_CLIENT_SELECTED = "__no-client__";

/**
 * Sections actually shown inside the per-project report-data form.
 *
 * The previous `firm`, `scope`, `methodology`, `team` and `assumptions`
 * sections were moved to the company admin panel (tab «بيانات إعداد التقرير
 * النهائي»). Per-project edits for those areas now happen inline inside the
 * report preview itself, which renders narrative paragraphs instead of form
 * fields.
 */
export type MvReportCollapsibleSectionId =
  | "basic"
  | "client"
  | "finalValue"
  | "basisPremise"
  | "participants";

export const MV_REPORT_COLLAPSIBLE_IDS: MvReportCollapsibleSectionId[] = [
  "basic",
  "client",
  "finalValue",
  "basisPremise",
  "participants",
];

export function createMvReportCollapsibleState(
  open: boolean,
): Record<MvReportCollapsibleSectionId, boolean> {
  return MV_REPORT_COLLAPSIBLE_IDS.reduce(
    (state, id) => ({ ...state, [id]: open }),
    {} as Record<MvReportCollapsibleSectionId, boolean>,
  );
}

function ReportSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
  dir,
  invalid = false,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
  dir: "rtl" | "ltr";
  invalid?: boolean;
}) {
  return (
    <label className="grid gap-2 text-start">
      <span className="text-[11px] font-bold text-slate-500">{label}</span>
      <Select value={value || undefined} onValueChange={onChange} dir={dir}>
        <SelectTrigger
          aria-invalid={invalid || undefined}
          className={cn(
            "h-11 rounded-lg border-slate-300/80 bg-white px-3 text-[13px] font-bold text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.05)] focus:border-sky-500 focus:ring-2 focus:ring-sky-100",
            invalid && "border-red-500 ring-2 ring-red-100 focus:border-red-500 focus:ring-red-100",
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function ReportField({
  label,
  children,
  invalid = false,
}: {
  label: string;
  children: ReactNode;
  invalid?: boolean;
}) {
  return (
    <label className="grid gap-2 text-start">
      <span className={cn("text-[11px] font-bold text-slate-500", invalid && "text-red-700")}>
        {label}
      </span>
      <span
        className={cn(
          "contents",
          invalid &&
            "[&>*]:border-red-500 [&>*]:ring-2 [&>*]:ring-red-100 [&>*:focus]:border-red-500 [&>*:focus]:ring-red-100",
        )}
      >
        {children}
      </span>
      {invalid ? (
        <span className="-mt-1 text-[10px] font-bold text-red-600">هذا الحقل مطلوب للتقرير النهائي</span>
      ) : null}
    </label>
  );
}

function ReportSection({
  id,
  title,
  icon,
  open,
  onOpenChange,
  children,
  completion = 0,
}: {
  id: MvReportCollapsibleSectionId;
  title: string;
  icon: ReactNode;
  open: boolean;
  onOpenChange: (id: MvReportCollapsibleSectionId, open: boolean) => void;
  children: ReactNode;
  completion?: number;
}) {
  const safeCompletion = Math.max(0, Math.min(100, Math.round(completion)));
  const progressTone =
    safeCompletion === 100
      ? "bg-emerald-500"
      : safeCompletion >= 80
        ? "bg-orange-500"
        : safeCompletion >= 50
          ? "bg-amber-400"
          : "bg-red-500";
  const progressTextTone =
    safeCompletion === 100
      ? "text-emerald-700"
      : safeCompletion >= 80
        ? "text-orange-700"
        : safeCompletion >= 50
          ? "text-amber-700"
          : "text-red-700";
  return (
    <Collapsible open={open} onOpenChange={(next) => onOpenChange(id, next)}>
      <section
        className={cn(
          "overflow-hidden rounded-lg border bg-white/95 shadow-sm shadow-slate-900/5 transition-colors duration-300",
          open ? "border-sky-200/90 ring-1 ring-sky-100/80" : "border-slate-200/90",
        )}
      >
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-4 bg-white px-4 py-3.5 text-start transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm transition-colors",
                open ? "bg-sky-950" : "bg-slate-900",
              )}
            >
              {icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[14px] font-extrabold text-slate-950">{title}</span>
                <span className={cn("shrink-0 text-[11px] font-black tabular-nums", progressTextTone)}>
                  {safeCompletion}%
                </span>
              </span>
              <span className="mt-1.5 block h-1.5 w-full min-w-28 overflow-hidden rounded-full bg-slate-200">
                <span
                  className={cn("block h-full rounded-full transition-[width,background-color] duration-500", progressTone)}
                  style={{ width: `${safeCompletion}%` }}
                />
              </span>
            </span>
          </div>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition group-hover:border-sky-200 group-hover:text-sky-800">
            <ChevronDown className={cn("h-4 w-4 transition duration-300", open && "rotate-180")} />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent className="mv-curtain-content">
          <div className="border-t border-slate-100 bg-slate-50/40 p-4 sm:p-5">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

export function MvReportDataForm({
  project,
  editableProjectName,
  reportData,
  clientOptions = [],
  preparerOptions = [],
  preparersLoading = false,
  saving,
  openSections,
  saveButtonRef,
  highlightSave = false,
  invalidFieldKeys,
  sectionCompletion,
  onProjectNameChange,
  onReportDataChange,
  onSectionOpenChange,
  onToggleAllSections,
  onSave,
  onReset,
  onCloneFromProject,
}: {
  project: MvProject;
  editableProjectName: string;
  reportData: MvProjectReportData;
  clientOptions?: MachineClient[];
  preparerOptions?: MvReportPreparerOption[];
  preparersLoading?: boolean;
  saving: boolean;
  openSections: Record<MvReportCollapsibleSectionId, boolean>;
  saveButtonRef?: Ref<HTMLButtonElement>;
  highlightSave?: boolean;
  invalidFieldKeys?: ReadonlySet<string>;
  sectionCompletion?: Partial<Record<MvReportCollapsibleSectionId, number>>;
  onProjectNameChange: (value: string) => void;
  onReportDataChange: (patch: Partial<MvProjectReportData>) => void;
  onSectionOpenChange: (id: MvReportCollapsibleSectionId, open: boolean) => void;
  onToggleAllSections: () => void;
  onSave: () => void;
  onReset?: () => void;
  onCloneFromProject?: () => void;
}) {
  const { t, isArabic, dir } = useMvI18n();
  const [preparersPopoverOpen, setPreparersPopoverOpen] = useState(false);
  const allSectionsOpen = MV_REPORT_COLLAPSIBLE_IDS.every((id) => openSections[id]);
  const fieldInvalid = (key: string) => invalidFieldKeys?.has(key) === true;
  const SectionToggleIcon = allSectionsOpen ? ChevronsDownUp : ChevronsUpDown;
  const inputClass =
    "h-11 rounded-lg border-slate-300/80 bg-white px-3 text-[13px] font-bold text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.05)] focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-100";
  const textareaClass =
    "min-h-28 resize-y rounded-lg border-slate-300/80 bg-white px-3 py-2.5 text-[13px] font-bold leading-7 text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.05)] focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-100";
  const finalValue = reportData.finalValue ?? null;
  const reportDisplayNumber =
    typeof project.displayNumber === "number" && Number.isFinite(project.displayNumber)
      ? project.displayNumber
      : null;
  const selectedPreparers = useMemo(
    () => normalizeReportTeam(reportData.valuationTeam, preparerOptions),
    [preparerOptions, reportData.valuationTeam],
  );
  const selectedPreparerIds = useMemo(
    () => new Set(selectedPreparers.map((row) => row.id)),
    [selectedPreparers],
  );
  const preparerOptionById = useMemo(
    () => new Map(preparerOptions.map((option) => [option.id, option])),
    [preparerOptions],
  );

  const updateValuationTeam = (next: MvReportTeamMember[]) => {
    onReportDataChange({ valuationTeam: normalizeReportTeam(next, preparerOptions) });
  };

  const togglePreparer = (option: MvReportPreparerOption, checked: boolean) => {
    if (option.isCompanyAdmin && !checked) return;
    if (checked) {
      if (selectedPreparerIds.has(option.id)) return;
      updateValuationTeam([
        ...selectedPreparers,
        reportTeamMemberFromOption(option, selectedPreparers, preparerOptions),
      ]);
      return;
    }
    updateValuationTeam(selectedPreparers.filter((row) => row.id !== option.id));
  };

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(isArabic ? "ar-SA" : "en-US"),
    [isArabic],
  );

  const valuationMethodOptions = useMemo(
    () => [
      t("reportData.options.method.cost"),
      t("reportData.options.method.market"),
      t("reportData.options.method.comparables"),
      t("reportData.options.method.costAndMarket"),
    ],
    [t],
  );
  const valuationPurposeOptions = useMemo(
    () => [
      t("reportData.options.purpose.sale"),
      t("reportData.options.purpose.purchase"),
      t("reportData.options.purpose.accounting"),
      t("reportData.options.purpose.mortgage"),
      t("reportData.options.purpose.bankruptcy"),
      t("reportData.options.purpose.financing"),
      t("reportData.options.purpose.insurance"),
      t("reportData.options.purpose.disputes"),
      t("reportData.options.purpose.other"),
    ],
    [t],
  );
  const valuePremiseOptions = useMemo(
    () => [
      t("reportData.options.premise.highestBest"),
      t("reportData.options.premise.currentUse"),
      t("reportData.options.premise.orderlyLiquidation"),
      t("reportData.options.premise.forcedSale"),
    ],
    [t],
  );
  const valuationBasisOptions = useMemo(
    () => [
      t("reportData.options.basis.marketValue"),
      t("reportData.options.basis.marketRent"),
      t("reportData.options.basis.equitableValue"),
      t("reportData.options.basis.investmentValue"),
      t("reportData.options.basis.synergisticValue"),
      t("reportData.options.basis.liquidationValue"),
      t("reportData.options.basis.fairValue"),
      t("reportData.options.basis.fairMarketValue"),
      t("reportData.options.basis.other"),
    ],
    [t],
  );
  const professionalReportTypeOptions = useMemo(
    () => [
      t("reportData.options.professional.detailed"),
      t("reportData.options.professional.summary"),
      t("reportData.options.professional.reviewWithValue"),
      t("reportData.options.professional.reviewNoValue"),
    ],
    [t],
  );

  const clientTemplateValue = (client: MachineClient, key: string) => client.templateFieldValues?.[key]?.trim() ?? "";
  const handleClientSelect = (clientId: string) => {
    if (clientId === NO_CLIENT_SELECTED) {
      onReportDataChange({
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
      });
      return;
    }
    const client = clientOptions.find((item) => item.id === clientId);
    if (!client) return;
    onReportDataChange({
      clientId: client.id,
      clientName: client.name ?? "",
      clientEmail: client.email ?? "",
      clientPhone: client.phone ?? "",
      clientLegalType: clientTemplateValue(client, "clientLegalType"),
      clientActivity: clientTemplateValue(client, "clientActivity"),
      clientRepresentativeName: clientTemplateValue(client, "clientRepresentativeName"),
      clientRepresentativeRole: clientTemplateValue(client, "clientRepresentativeRole"),
      intendedUsers: clientTemplateValue(client, "intendedUsers"),
      intendedUse: clientTemplateValue(client, "intendedUse"),
    });
  };

  return (
    <section className="relative min-w-0 overflow-x-hidden" dir={dir}>
      <div className="min-w-0 space-y-3">
        <ReportSection
          id="basic"
          title={t("reportData.sections.basic")}
          icon={<ClipboardList className="h-5 w-5" />}
          open={openSections.basic}
          onOpenChange={onSectionOpenChange}
          completion={sectionCompletion?.basic}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <ReportField label={t("reportData.fields.displayNumber")}>
              <div className="relative">
                <Input
                  value={
                    reportDisplayNumber == null
                      ? t("common.notAvailable")
                      : numberFormatter.format(reportDisplayNumber)
                  }
                  readOnly
                  disabled
                  dir="ltr"
                  aria-label={t("reportData.fields.displayNumberAria")}
                  className={cn(
                    inputClass,
                    "bg-sky-50/70 text-left font-black tabular-nums text-[#0C447C] cursor-not-allowed",
                  )}
                />
                <Hash
                  aria-hidden
                  className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0C447C]/60"
                />
              </div>
            </ReportField>
            <ReportField label={t("reportData.fields.projectName")} invalid={fieldInvalid("projectName")}>
              <Input
                value={editableProjectName}
                onChange={(event) => onProjectNameChange(event.target.value)}
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label={t("reportData.fields.coverTitle")} invalid={fieldInvalid("reportTitle")}>
              <Input
                value={reportData.reportTitle ?? ""}
                onChange={(event) => onReportDataChange({ reportTitle: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder={t("reportData.fields.coverTitlePlaceholder")}
              />
            </ReportField>
            <ReportField label={t("reportData.fields.reference")} invalid={fieldInvalid("reportReference")}>
              <Input
                value={reportData.reportReference ?? ""}
                onChange={(event) => onReportDataChange({ reportReference: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label={t("reportData.fields.reportType")}>
              <Input
                value={
                  project.reportType === "advanced"
                    ? t("reportData.fields.reportTypeAdvanced")
                    : t("reportData.fields.reportTypeSimple")
                }
                readOnly
                className={cn(inputClass, "bg-slate-100/80 text-slate-500")}
              />
            </ReportField>
            <ReportField label={t("reportData.fields.assetSingularPlural")}>
              <Input
                value={reportData.assetSingularPlural ?? ""}
                onChange={(event) =>
                  onReportDataChange({ assetSingularPlural: event.target.value })
                }
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportSelect
              label={t("reportData.fields.valuationMethod")}
              value={reportData.valuationMethod ?? ""}
              options={valuationMethodOptions}
              placeholder={t("reportData.placeholders.selectMethod")}
              onChange={(value) => onReportDataChange({ valuationMethod: value })}
              dir={dir}
              invalid={fieldInvalid("valuationMethod")}
            />
            <ReportSelect
              label={t("reportData.fields.valuationPurpose")}
              value={reportData.valuationPurpose ?? ""}
              options={valuationPurposeOptions}
              placeholder={t("reportData.placeholders.selectPurpose")}
              onChange={(value) => onReportDataChange({ valuationPurpose: value })}
              dir={dir}
              invalid={fieldInvalid("valuationPurpose")}
            />
            <ReportSelect
              label={t("reportData.fields.valuePremise")}
              value={reportData.valuePremise ?? ""}
              options={valuePremiseOptions}
              placeholder={t("reportData.placeholders.selectPremise")}
              onChange={(value) => onReportDataChange({ valuePremise: value })}
              dir={dir}
              invalid={fieldInvalid("valuePremise")}
            />
            <ReportSelect
              label={t("reportData.fields.valuationBasis")}
              value={reportData.valuationBasis ?? ""}
              options={valuationBasisOptions}
              placeholder={t("reportData.placeholders.selectBasis")}
              onChange={(value) => onReportDataChange({ valuationBasis: value })}
              dir={dir}
              invalid={fieldInvalid("valuationBasis")}
            />
            <ReportSelect
              label={t("reportData.fields.professionalReportType")}
              value={reportData.reportTypeLabel ?? ""}
              options={professionalReportTypeOptions}
              placeholder={t("reportData.placeholders.selectProfessionalType")}
              onChange={(value) => onReportDataChange({ reportTypeLabel: value })}
              dir={dir}
              invalid={fieldInvalid("reportTypeLabel")}
            />
            <ReportField label={t("reportData.fields.standards")} invalid={fieldInvalid("standardsVersion")}>
              <Input
                value={reportData.standardsVersion ?? ""}
                onChange={(event) => onReportDataChange({ standardsVersion: event.target.value })}
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label={t("reportData.fields.currency")} invalid={fieldInvalid("currencyLabel")}>
              <Input
                value={reportData.currencyLabel ?? ""}
                onChange={(event) => onReportDataChange({ currencyLabel: event.target.value })}
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label={t("reportData.fields.issueDate")} invalid={fieldInvalid("reportIssueDate")}>
              <Input
                type="date"
                value={reportData.reportIssueDate ?? ""}
                onChange={(event) => onReportDataChange({ reportIssueDate: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label={t("reportData.fields.inspectionDate")} invalid={fieldInvalid("inspectionDate")}>
              <Input
                type="date"
                value={reportData.inspectionDate ?? ""}
                onChange={(event) => onReportDataChange({ inspectionDate: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label={t("reportData.fields.valuationDate")} invalid={fieldInvalid("valuationDate")}>
              <Input
                type="date"
                value={reportData.valuationDate ?? ""}
                onChange={(event) => onReportDataChange({ valuationDate: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label={t("reportData.fields.agreementDate")} invalid={fieldInvalid("agreementDate")}>
              <Input
                type="date"
                value={reportData.agreementDate ?? ""}
                onChange={(event) => onReportDataChange({ agreementDate: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label={t("reportData.fields.inspectionLocation")} invalid={fieldInvalid("inspectionLocation")}>
              <Input
                value={reportData.inspectionLocation ?? ""}
                onChange={(event) => onReportDataChange({ inspectionLocation: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder={t("reportData.fields.inspectionLocationPlaceholder")}
              />
            </ReportField>
            <ReportField label={t("reportData.fields.inspectionMapUrl")}>
              <Input
                value={reportData.inspectionMapUrl ?? ""}
                onChange={(event) => onReportDataChange({ inspectionMapUrl: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
                placeholder="https://maps.app.goo.gl/..."
              />
            </ReportField>
          </div>
        </ReportSection>

        <ReportSection
          id="client"
          title={t("reportData.sections.client")}
          icon={<UserRound className="h-5 w-5" />}
          open={openSections.client}
          onOpenChange={onSectionOpenChange}
          completion={sectionCompletion?.client}
        >
          <div className="mb-3">
            <ReportField label={t("reportData.client.select")}>
              <Select
                value={reportData.clientId || NO_CLIENT_SELECTED}
                onValueChange={handleClientSelect}
                dir={dir}
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder={t("reportData.client.selectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT_SELECTED}>{t("reportData.client.none")}</SelectItem>
                  {clientOptions.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </ReportField>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <ReportField label={t("reportData.client.name")} invalid={fieldInvalid("clientName")}>
              <Input
                value={reportData.clientName ?? ""}
                onChange={(event) => onReportDataChange({ clientName: event.target.value })}
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label={t("reportData.client.email")}>
              <Input
                type="email"
                value={reportData.clientEmail ?? ""}
                onChange={(event) => onReportDataChange({ clientEmail: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label={t("reportData.client.phone")}>
              <Input
                value={reportData.clientPhone ?? ""}
                onChange={(event) => onReportDataChange({ clientPhone: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label={t("reportData.client.legalType")}>
              <Input
                value={reportData.clientLegalType ?? ""}
                onChange={(event) => onReportDataChange({ clientLegalType: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder={t("reportData.client.legalTypePlaceholder")}
              />
            </ReportField>
            <ReportField label={t("reportData.client.activity")} invalid={fieldInvalid("clientActivity")}>
              <Input
                value={reportData.clientActivity ?? ""}
                onChange={(event) => onReportDataChange({ clientActivity: event.target.value })}
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label={t("reportData.client.representative")} invalid={fieldInvalid("clientRepresentativeName")}>
              <Input
                value={reportData.clientRepresentativeName ?? ""}
                onChange={(event) => onReportDataChange({ clientRepresentativeName: event.target.value })}
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label={t("reportData.client.representativeRole")} invalid={fieldInvalid("clientRepresentativeRole")}>
              <Input
                value={reportData.clientRepresentativeRole ?? ""}
                onChange={(event) => onReportDataChange({ clientRepresentativeRole: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder={t("reportData.client.representativeRolePlaceholder")}
              />
            </ReportField>
            <ReportField label={t("reportData.client.intendedUsers")} invalid={fieldInvalid("intendedUsers")}>
              <Input
                value={reportData.intendedUsers ?? ""}
                onChange={(event) => onReportDataChange({ intendedUsers: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder={t("reportData.client.intendedUsersPlaceholder")}
              />
            </ReportField>
            <ReportField label={t("reportData.client.intendedUse")} invalid={fieldInvalid("intendedUse")}>
              <Input
                value={reportData.intendedUse ?? ""}
                onChange={(event) => onReportDataChange({ intendedUse: event.target.value })}
                className={inputClass}
                dir="auto"
              />
            </ReportField>
          </div>
        </ReportSection>

        <ReportSection
          id="finalValue"
          title={t("reportData.sections.finalValue")}
          icon={<Coins className="h-5 w-5" />}
          open={openSections.finalValue}
          onOpenChange={onSectionOpenChange}
          completion={sectionCompletion?.finalValue}
        >
          <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
            <ReportField label={t("reportData.finalValue.amount")} invalid={fieldInvalid("finalValue")}>
              <Input
                type="number"
                min="0"
                value={finalValue == null ? "" : String(finalValue)}
                onChange={(event) => {
                  const raw = event.target.value;
                  const nextValue = raw === "" ? null : Number(raw);
                  const safeValue =
                    typeof nextValue === "number" && Number.isFinite(nextValue) ? nextValue : null;
                  onReportDataChange({
                    finalValue: safeValue,
                    finalValueWords: safeValue == null ? "" : numberToArabicRiyalWords(safeValue),
                  });
                }}
                className={cn(inputClass, "text-left text-[13px] font-bold")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label={t("reportData.finalValue.words")}>
              <Input
                value={reportData.finalValueWords ?? ""}
                readOnly
                className={cn(inputClass, "bg-emerald-50/80 font-extrabold text-emerald-900")}
              />
            </ReportField>
          </div>
        </ReportSection>

        <ReportSection
          id="basisPremise"
          title={t("reportData.sections.basisPremise")}
          icon={<Scale className="h-5 w-5" />}
          open={openSections.basisPremise}
          onOpenChange={onSectionOpenChange}
          completion={sectionCompletion?.basisPremise}
        >
          <div className="grid gap-3">
            <ReportField label={t("reportData.basisPremise.assetSubjectDescription")} invalid={fieldInvalid("assetSubjectDescription")}>
              <Input
                value={reportData.assetSubjectDescription ?? ""}
                onChange={(event) =>
                  onReportDataChange({ assetSubjectDescription: event.target.value })
                }
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label={t("reportData.basisPremise.valuationBasisDefinition")} invalid={fieldInvalid("valuationBasisDefinition")}>
              <Textarea
                value={reportData.valuationBasisDefinition ?? ""}
                onChange={(event) =>
                  onReportDataChange({ valuationBasisDefinition: event.target.value })
                }
                className={textareaClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label={t("reportData.basisPremise.valuePremiseDefinition")} invalid={fieldInvalid("valuePremiseDefinition")}>
              <Textarea
                value={reportData.valuePremiseDefinition ?? ""}
                onChange={(event) =>
                  onReportDataChange({ valuePremiseDefinition: event.target.value })
                }
                className={cn(textareaClass, "min-h-40")}
                dir="auto"
              />
            </ReportField>
          </div>
        </ReportSection>

        <ReportSection
          id="participants"
          title={t("reportData.sections.participants")}
          icon={<UsersRound className="h-5 w-5" />}
          open={openSections.participants}
          onOpenChange={onSectionOpenChange}
          completion={sectionCompletion?.participants}
        >
          <div className="grid gap-4">
            <div
              className={cn(
                "flex flex-col gap-3 rounded-xl border border-sky-100 bg-sky-50/60 p-3 sm:flex-row sm:items-center sm:justify-between",
                fieldInvalid("valuationTeam") && "border-red-500 bg-red-50/60 ring-2 ring-red-100",
              )}
            >
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold text-sky-950">
                  {t("reportData.participants.selectTitle")}
                </p>
                <p className="mt-1 text-[11px] font-medium leading-5 text-slate-600">
                  {t("reportData.participants.description")}
                </p>
              </div>
              <Popover open={preparersPopoverOpen} onOpenChange={setPreparersPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-sky-200 bg-white px-3 text-[12px] font-extrabold text-sky-950 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
                  >
                    <Plus className="h-4 w-4" />
                    {t("reportData.participants.selectButton", {
                      count: selectedPreparers.length,
                    })}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  side="bottom"
                  sideOffset={8}
                  collisionPadding={16}
                  className="z-[500] flex w-[min(92vw,34rem)] max-h-[min(72dvh,36rem)] flex-col overflow-hidden rounded-xl border-slate-200 p-0 shadow-xl"
                  dir={dir}
                >
                  <div className="shrink-0 border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-[12px] font-extrabold text-slate-900">
                      {t("reportData.participants.dropdownTitle")}
                    </p>
                    <p className="mt-1 text-[10.5px] text-slate-500">
                      {t("reportData.participants.dropdownHint")}
                    </p>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                    {preparersLoading ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-[12px] text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("reportData.participants.loading")}
                      </div>
                    ) : preparerOptions.length === 0 ? (
                      <p className="px-3 py-8 text-center text-[12px] leading-6 text-slate-500">
                        {t("reportData.participants.emptyOptions")}
                      </p>
                    ) : (
                      preparerOptions.map((option) => {
                        const selected = selectedPreparerIds.has(option.id);
                        return (
                          <label
                            key={option.id}
                            className={cn(
                              "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition",
                              selected
                                ? "border-sky-200 bg-sky-50/80"
                                : "border-transparent hover:border-slate-200 hover:bg-slate-50",
                              option.isCompanyAdmin && "cursor-default",
                            )}
                          >
                            <Checkbox
                              checked={selected}
                              disabled={option.isCompanyAdmin}
                              onCheckedChange={(value) => togglePreparer(option, value === true)}
                              className="mt-1"
                              aria-label={option.name || t("reportData.participants.nameMissing")}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-[12px] font-extrabold text-slate-950">
                                  {option.name || t("reportData.participants.nameMissing")}
                                </span>
                                {option.isCompanyAdmin ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold text-amber-800">
                                    <ShieldCheck className="h-3 w-3" />
                                    {t("reportData.participants.fixedManager")}
                                  </span>
                                ) : option.isReportOnly ? (
                                  <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-extrabold text-violet-800">
                                    {t("reportData.participants.reportOnlyBadge")}
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-0.5 block text-[10.5px] font-semibold text-slate-500">
                                {option.jobTitle || t("reportData.participants.jobMissing")}
                                {option.membershipNo
                                  ? ` · ${t("reportData.participants.membership")}: ${option.membershipNo}`
                                  : ""}
                              </span>
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <div className="shrink-0 border-t border-slate-100 bg-white p-3">
                    <button
                      type="button"
                      onClick={() => setPreparersPopoverOpen(false)}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-3 text-[12px] font-extrabold text-white shadow-sm transition hover:bg-sky-700"
                    >
                      <Plus className="h-4 w-4" />
                      {t("reportData.participants.add")}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {selectedPreparers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-[12px] text-slate-500">
                {t("reportData.participants.emptySelection")}
              </div>
            ) : (
              <div className="grid gap-2">
                <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(220px,1fr)_150px] gap-3 px-3 text-[10.5px] font-extrabold text-slate-500 md:grid">
                  <span>{t("reportData.participants.appraiserData")}</span>
                  <span>{t("reportData.participants.appraiserRole")}</span>
                  <span className="text-center">{t("reportData.participants.signature")}</span>
                </div>
                {selectedPreparers.map((member) => {
                  const option = preparerOptionById.get(member.id);
                  const isManager = option?.isCompanyAdmin === true;
                  return (
                    <div
                      key={member.id}
                      className="relative grid gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[minmax(0,1.2fr)_minmax(220px,1fr)_150px] md:items-center"
                    >
                      <div className="flex min-w-0 items-start gap-2.5">
                        {!isManager ? (
                          <button
                            type="button"
                            onClick={() =>
                              updateValuationTeam(
                                selectedPreparers.filter((row) => row.id !== member.id),
                              )
                            }
                            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-100 hover:text-red-700"
                            title={t("reportData.participants.remove")}
                            aria-label={t("reportData.participants.remove")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : (
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-600">
                            <ShieldCheck className="h-4 w-4" />
                          </span>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-[13px] font-black text-slate-950">
                              {member.name || t("reportData.participants.nameMissing")}
                            </p>
                            {isManager ? (
                              <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                                {t("reportData.participants.fixedManager")}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[11px] font-semibold text-slate-600">
                            {member.title || t("reportData.participants.jobMissing")}
                          </p>
                          <p className="mt-0.5 text-[10.5px] font-semibold text-slate-400">
                            {member.membershipNo
                              ? `${t("reportData.participants.membership")}: ${member.membershipNo}`
                              : t("reportData.participants.membershipMissing")}
                          </p>
                        </div>
                      </div>

                      <ReportField
                        label={t("reportData.participants.roleField")}
                        invalid={fieldInvalid(`valuationTeamRole:${member.id}`)}
                      >
                        <Input
                          value={member.role ?? ""}
                          onChange={(event) =>
                            updateValuationTeam(
                              selectedPreparers.map((row) =>
                                row.id === member.id
                                  ? { ...row, role: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          className={inputClass}
                          dir="auto"
                        />
                      </ReportField>

                      <div className="flex min-h-20 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-2">
                        {option?.signatureImageDataUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={option.signatureImageDataUrl}
                            alt={t("reportData.participants.signatureAlt", {
                              name: member.name || "",
                            })}
                            className="max-h-16 max-w-full object-contain"
                          />
                        ) : (
                          <span className="flex flex-col items-center gap-1 text-[10px] font-semibold text-slate-400">
                            <Signature className="h-6 w-6" />
                            {t("reportData.participants.signatureMissing")}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ReportSection>
      </div>

      <aside
        className={cn(
          "pointer-events-none fixed bottom-4 end-3 z-[60] sm:bottom-auto sm:top-36",
          highlightSave && "z-[130]",
        )}
      >
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={onToggleAllSections}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300/90 bg-white text-slate-700 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
            title={allSectionsOpen ? t("reportData.sections.collapseAll") : t("reportData.sections.expandAll")}
            aria-label={allSectionsOpen ? t("reportData.sections.collapseAll") : t("reportData.sections.expandAll")}
          >
            <SectionToggleIcon className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </button>

          <button
            type="button"
            onClick={onCloneFromProject}
            disabled={!onCloneFromProject || saving}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300/90 bg-white text-slate-700 shadow-[0_8px_20px_-10px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
            title={t("reportData.clone.button")}
            aria-label={t("reportData.clone.button")}
          >
            <Copy className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </button>

          <button
            ref={saveButtonRef}
            type="button"
            onClick={onSave}
            disabled={saving || !editableProjectName.trim()}
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-900 bg-slate-900 text-white shadow-[0_10px_24px_-10px_rgba(15,23,42,0.7)] transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0",
              highlightSave && "mv-save-coach-target ring-2 ring-white/80 ring-offset-2 ring-offset-slate-900",
            )}
            title={saving ? t("reportData.saveCard.saving") : t("reportData.saveCard.save")}
            aria-label={saving ? t("reportData.saveCard.saving") : t("reportData.saveCard.save")}
          >
            {saving ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2.25} />
            ) : (
              <Save className="h-[18px] w-[18px]" strokeWidth={2.25} />
            )}
          </button>

          <button
            type="button"
            onClick={onReset}
            disabled={!onReset || saving}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-300/80 bg-white/95 text-slate-500 shadow-[0_6px_16px_-10px_rgba(15,23,42,0.4)] transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
            title={t("reportData.reset.button")}
            aria-label={t("reportData.reset.button")}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>
      </aside>
    </section>
  );
}
