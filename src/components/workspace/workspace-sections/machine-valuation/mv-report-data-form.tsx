"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardList,
  Coins,
  Hash,
  Loader2,
  Save,
  UserRound,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
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
import type { MvProject, MvProjectReportData } from "./types";

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
export type MvReportCollapsibleSectionId = "basic" | "client" | "finalValue";

export const MV_REPORT_COLLAPSIBLE_IDS: MvReportCollapsibleSectionId[] = [
  "basic",
  "client",
  "finalValue",
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
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
  dir: "rtl" | "ltr";
}) {
  return (
    <label className="grid gap-2 text-start">
      <span className="text-[11px] font-bold text-slate-500">{label}</span>
      <Select value={value || undefined} onValueChange={onChange} dir={dir}>
        <SelectTrigger className="h-11 rounded-lg border-slate-300/80 bg-white px-3 text-[13px] font-bold text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.05)] focus:border-sky-500 focus:ring-2 focus:ring-sky-100">
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

function ReportField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-start">
      <span className="text-[11px] font-bold text-slate-500">{label}</span>
      {children}
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
}: {
  id: MvReportCollapsibleSectionId;
  title: string;
  icon: ReactNode;
  open: boolean;
  onOpenChange: (id: MvReportCollapsibleSectionId, open: boolean) => void;
  children: ReactNode;
}) {
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
            <span className="min-w-0">
              <span className="block text-[14px] font-extrabold text-slate-950">{title}</span>
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
  saving,
  openSections,
  onProjectNameChange,
  onReportDataChange,
  onSectionOpenChange,
  onToggleAllSections,
  onSave,
}: {
  project: MvProject;
  editableProjectName: string;
  reportData: MvProjectReportData;
  clientOptions?: MachineClient[];
  saving: boolean;
  openSections: Record<MvReportCollapsibleSectionId, boolean>;
  onProjectNameChange: (value: string) => void;
  onReportDataChange: (patch: Partial<MvProjectReportData>) => void;
  onSectionOpenChange: (id: MvReportCollapsibleSectionId, open: boolean) => void;
  onToggleAllSections: () => void;
  onSave: () => void;
}) {
  const { t, isArabic, dir } = useMvI18n();
  const allSectionsOpen = MV_REPORT_COLLAPSIBLE_IDS.every((id) => openSections[id]);
  const SectionToggleIcon = allSectionsOpen ? ChevronsDownUp : ChevronsUpDown;
  const inputClass =
    "h-11 rounded-lg border-slate-300/80 bg-white px-3 text-[13px] font-bold text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.05)] focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-100";
  const finalValue = reportData.finalValue ?? null;
  const reportDisplayNumber =
    typeof project.displayNumber === "number" && Number.isFinite(project.displayNumber)
      ? project.displayNumber
      : null;

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
      t("reportData.options.purpose.purchase"),
      t("reportData.options.purpose.sale"),
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
      t("reportData.options.basis.fairValue"),
      t("reportData.options.basis.investmentValue"),
      t("reportData.options.basis.specialValue"),
      t("reportData.options.basis.insuranceValue"),
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
            <ReportField label={t("reportData.fields.projectName")}>
              <Input
                value={editableProjectName}
                onChange={(event) => onProjectNameChange(event.target.value)}
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label={t("reportData.fields.coverTitle")}>
              <Input
                value={reportData.reportTitle ?? ""}
                onChange={(event) => onReportDataChange({ reportTitle: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder={t("reportData.fields.coverTitlePlaceholder")}
              />
            </ReportField>
            <ReportField label={t("reportData.fields.reference")}>
              <Input
                value={reportData.reportReference ?? ""}
                onChange={(event) => onReportDataChange({ reportReference: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
                placeholder="2600050001"
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
            <ReportSelect
              label={t("reportData.fields.valuationMethod")}
              value={reportData.valuationMethod ?? ""}
              options={valuationMethodOptions}
              placeholder={t("reportData.placeholders.selectMethod")}
              onChange={(value) => onReportDataChange({ valuationMethod: value })}
              dir={dir}
            />
            <ReportSelect
              label={t("reportData.fields.valuationPurpose")}
              value={reportData.valuationPurpose ?? ""}
              options={valuationPurposeOptions}
              placeholder={t("reportData.placeholders.selectPurpose")}
              onChange={(value) => onReportDataChange({ valuationPurpose: value })}
              dir={dir}
            />
            <ReportSelect
              label={t("reportData.fields.valuePremise")}
              value={reportData.valuePremise ?? ""}
              options={valuePremiseOptions}
              placeholder={t("reportData.placeholders.selectPremise")}
              onChange={(value) => onReportDataChange({ valuePremise: value })}
              dir={dir}
            />
            <ReportSelect
              label={t("reportData.fields.valuationBasis")}
              value={reportData.valuationBasis ?? ""}
              options={valuationBasisOptions}
              placeholder={t("reportData.placeholders.selectBasis")}
              onChange={(value) => onReportDataChange({ valuationBasis: value })}
              dir={dir}
            />
            <ReportSelect
              label={t("reportData.fields.professionalReportType")}
              value={reportData.reportTypeLabel ?? ""}
              options={professionalReportTypeOptions}
              placeholder={t("reportData.placeholders.selectProfessionalType")}
              onChange={(value) => onReportDataChange({ reportTypeLabel: value })}
              dir={dir}
            />
            <ReportField label={t("reportData.fields.standards")}>
              <Input
                value={reportData.standardsVersion ?? ""}
                onChange={(event) => onReportDataChange({ standardsVersion: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder={t("reportData.fields.standardsPlaceholder")}
              />
            </ReportField>
            <ReportField label={t("reportData.fields.currency")}>
              <Input
                value={reportData.currencyLabel ?? ""}
                onChange={(event) => onReportDataChange({ currencyLabel: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder={t("reportData.fields.currencyPlaceholder")}
              />
            </ReportField>
            <ReportField label={t("reportData.fields.issueDate")}>
              <Input
                type="date"
                value={reportData.reportIssueDate ?? ""}
                onChange={(event) => onReportDataChange({ reportIssueDate: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label={t("reportData.fields.inspectionDate")}>
              <Input
                type="date"
                value={reportData.inspectionDate ?? ""}
                onChange={(event) => onReportDataChange({ inspectionDate: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label={t("reportData.fields.valuationDate")}>
              <Input
                type="date"
                value={reportData.valuationDate ?? ""}
                onChange={(event) => onReportDataChange({ valuationDate: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label={t("reportData.fields.agreementDate")}>
              <Input
                type="date"
                value={reportData.agreementDate ?? ""}
                onChange={(event) => onReportDataChange({ agreementDate: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label={t("reportData.fields.inspectionLocation")}>
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
            <ReportField label={t("reportData.client.name")}>
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
            <ReportField label={t("reportData.client.activity")}>
              <Input
                value={reportData.clientActivity ?? ""}
                onChange={(event) => onReportDataChange({ clientActivity: event.target.value })}
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label={t("reportData.client.representative")}>
              <Input
                value={reportData.clientRepresentativeName ?? ""}
                onChange={(event) => onReportDataChange({ clientRepresentativeName: event.target.value })}
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label={t("reportData.client.representativeRole")}>
              <Input
                value={reportData.clientRepresentativeRole ?? ""}
                onChange={(event) => onReportDataChange({ clientRepresentativeRole: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder={t("reportData.client.representativeRolePlaceholder")}
              />
            </ReportField>
            <ReportField label={t("reportData.client.intendedUsers")}>
              <Input
                value={reportData.intendedUsers ?? ""}
                onChange={(event) => onReportDataChange({ intendedUsers: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder={t("reportData.client.intendedUsersPlaceholder")}
              />
            </ReportField>
            <ReportField label={t("reportData.client.intendedUse")}>
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
        >
          <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
            <ReportField label={t("reportData.finalValue.amount")}>
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
      </div>

      <aside className="pointer-events-none fixed bottom-4 end-3 z-[60] sm:bottom-auto sm:top-36">
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !editableProjectName.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-600/30 bg-emerald-600 text-white shadow-md transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            title={saving ? t("reportData.saveCard.saving") : t("reportData.saveCard.save")}
            aria-label={saving ? t("reportData.saveCard.saving") : t("reportData.saveCard.save")}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onToggleAllSections}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-sky-950 shadow-md transition hover:border-sky-200 hover:bg-sky-50"
            title={allSectionsOpen ? t("reportData.sections.collapseAll") : t("reportData.sections.expandAll")}
            aria-label={allSectionsOpen ? t("reportData.sections.collapseAll") : t("reportData.sections.expandAll")}
          >
            <SectionToggleIcon className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </section>
  );
}
