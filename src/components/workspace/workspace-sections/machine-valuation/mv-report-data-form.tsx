"use client";

import type { ReactNode } from "react";
import {
  BadgeCheck,
  Building2,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardList,
  Coins,
  Info,
  ListChecks,
  MapPinned,
  Plus,
  Save,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { numberToArabicRiyalWords } from "./mv-arabic-number-words";
import type { MvProject, MvProjectReportData, MvReportTeamMember } from "./types";

export type MvReportCollapsibleSectionId =
  | "basic"
  | "client"
  | "firm"
  | "scope"
  | "methodology"
  | "team"
  | "assumptions"
  | "finalValue";

export const MV_REPORT_COLLAPSIBLE_IDS: MvReportCollapsibleSectionId[] = [
  "basic",
  "client",
  "firm",
  "scope",
  "methodology",
  "team",
  "assumptions",
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

const VALUATION_METHOD_OPTIONS = [
  "أسلوب التكلفة",
  "أسلوب السوق",
  "المقارنات",
  "التكلفة والسوق معاً",
];
const VALUATION_PURPOSE_OPTIONS = ["شراء", "بيع", "محاسبة", "رهن", "إفلاس", "تمويل", "تأمين", "نزاعات و تقاضي", "أخرى"];
const VALUE_PREMISE_OPTIONS = [
  "الاستخدام الأعلى والأفضل",
  "الاستخدام الحالي",
  "التصفية المنظمة",
  "البيع القسري",
  "أخرى",
];
const VALUATION_BASIS_OPTIONS = [
  "القيمة السوقية",
  "القيمة العادلة",
  "القيمة الاستثمارية",
  "القيمة الخاصة",
  "القيمة التأمينية",
  "أخرى",
];

function createReportTeamMember(): MvReportTeamMember {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `member-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { id, name: "", title: "", membershipNo: "", role: "" };
}

function selectDisplay(value: string | undefined | null, fallback = "غير محدد") {
  return value && value.trim() ? value : fallback;
}

const sarFormatter = new Intl.NumberFormat("ar-SA", {
  style: "currency",
  currency: "SAR",
  maximumFractionDigits: 0,
});

function ReportSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2 text-right">
      <span className="text-[11px] font-bold text-slate-500">{label}</span>
      <Select value={value || undefined} onValueChange={onChange} dir="rtl">
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
    <label className="grid gap-2 text-right">
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
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-4 bg-white px-4 py-3.5 text-right transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200">
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
  saving: boolean;
  openSections: Record<MvReportCollapsibleSectionId, boolean>;
  onProjectNameChange: (value: string) => void;
  onReportDataChange: (patch: Partial<MvProjectReportData>) => void;
  onSectionOpenChange: (id: MvReportCollapsibleSectionId, open: boolean) => void;
  onToggleAllSections: () => void;
  onSave: () => void;
}) {
  const allSectionsOpen = MV_REPORT_COLLAPSIBLE_IDS.every((id) => openSections[id]);
  const SectionToggleIcon = allSectionsOpen ? ChevronsDownUp : ChevronsUpDown;
  const inputClass =
    "h-11 rounded-lg border-slate-300/80 bg-white px-3 text-[13px] font-bold text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.05)] focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-100";
  const textareaClass =
    "min-h-32 rounded-lg border-slate-300/80 bg-white px-3 py-2 text-[13px] font-bold leading-7 text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.05)] focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-100";
  const finalValue = reportData.finalValue ?? null;
  const teamRows = reportData.valuationTeam ?? [];
  const updateTeamMember = (id: string, patch: Partial<MvReportTeamMember>) => {
    onReportDataChange({
      valuationTeam: teamRows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    });
  };
  const addTeamMember = () => onReportDataChange({ valuationTeam: [...teamRows, createReportTeamMember()] });
  const removeTeamMember = (id: string) =>
    onReportDataChange({ valuationTeam: teamRows.filter((row) => row.id !== id) });

  return (
    <section className="relative min-h-[calc(100vh-9.5rem)]">
      <div className="space-y-3">
        <ReportSection
          id="basic"
          title="بيانات أساسية"
          icon={<ClipboardList className="h-5 w-5" />}
          open={openSections.basic}
          onOpenChange={onSectionOpenChange}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <ReportField label="اسم التقرير / المشروع">
              <Input
                value={editableProjectName}
                onChange={(event) => onProjectNameChange(event.target.value)}
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label="عنوان الغلاف داخل التقرير">
              <Input
                value={reportData.reportTitle ?? ""}
                onChange={(event) => onReportDataChange({ reportTitle: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder="تقرير تقييم معدات وآلات"
              />
            </ReportField>
            <ReportField label="رقم المرجع / رقم التقرير">
              <Input
                value={reportData.reportReference ?? ""}
                onChange={(event) => onReportDataChange({ reportReference: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
                placeholder="2600050001"
              />
            </ReportField>
            <ReportField label="نوع التقرير">
              <Input
                value={project.reportType === "advanced" ? "تقرير متقدم" : "تقرير مبسط"}
                readOnly
                className={cn(inputClass, "bg-slate-100/80 text-slate-500")}
              />
            </ReportField>
            <ReportSelect
              label="الأسلوب المستخدم داخل التقرير"
              value={reportData.valuationMethod ?? ""}
              options={VALUATION_METHOD_OPTIONS}
              placeholder="اختر أسلوب التقييم"
              onChange={(value) => onReportDataChange({ valuationMethod: value })}
            />
            <ReportSelect
              label="الغرض من التقييم"
              value={reportData.valuationPurpose ?? ""}
              options={VALUATION_PURPOSE_OPTIONS}
              placeholder="اختر الغرض"
              onChange={(value) => onReportDataChange({ valuationPurpose: value })}
            />
            <ReportSelect
              label="فرضية القيمة"
              value={reportData.valuePremise ?? ""}
              options={VALUE_PREMISE_OPTIONS}
              placeholder="اختر الفرضية"
              onChange={(value) => onReportDataChange({ valuePremise: value })}
            />
            <ReportSelect
              label="أساس القيمة"
              value={reportData.valuationBasis ?? ""}
              options={VALUATION_BASIS_OPTIONS}
              placeholder="اختر أساس القيمة"
              onChange={(value) => onReportDataChange({ valuationBasis: value })}
            />
            <ReportField label="نوع التقرير المهني">
              <Input
                value={reportData.reportTypeLabel ?? ""}
                onChange={(event) => onReportDataChange({ reportTypeLabel: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder="تقرير مفصل"
              />
            </ReportField>
            <ReportField label="المعايير والإصدارات المطبقة">
              <Input
                value={reportData.standardsVersion ?? ""}
                onChange={(event) => onReportDataChange({ standardsVersion: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder="معايير التقييم الدولية IVS 2025"
              />
            </ReportField>
            <ReportField label="العملة">
              <Input
                value={reportData.currencyLabel ?? ""}
                onChange={(event) => onReportDataChange({ currencyLabel: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder="الريال السعودي (ر.س)"
              />
            </ReportField>
            <ReportField label="تاريخ إصدار التقرير">
              <Input
                type="date"
                value={reportData.reportIssueDate ?? ""}
                onChange={(event) => onReportDataChange({ reportIssueDate: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label="تاريخ المعاينة">
              <Input
                type="date"
                value={reportData.inspectionDate ?? ""}
                onChange={(event) => onReportDataChange({ inspectionDate: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label="تاريخ التقييم">
              <Input
                type="date"
                value={reportData.valuationDate ?? ""}
                onChange={(event) => onReportDataChange({ valuationDate: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label="تاريخ الاتفاقية (نطاق العمل)">
              <Input
                type="date"
                value={reportData.agreementDate ?? ""}
                onChange={(event) => onReportDataChange({ agreementDate: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
          </div>
        </ReportSection>

        <ReportSection
          id="client"
          title="معلومات العميل"
          icon={<UserRound className="h-5 w-5" />}
          open={openSections.client}
          onOpenChange={onSectionOpenChange}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <ReportField label="اسم العميل">
              <Input
                value={reportData.clientName ?? ""}
                onChange={(event) => onReportDataChange({ clientName: event.target.value })}
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label="البريد الإلكتروني">
              <Input
                type="email"
                value={reportData.clientEmail ?? ""}
                onChange={(event) => onReportDataChange({ clientEmail: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label="رقم الهاتف">
              <Input
                value={reportData.clientPhone ?? ""}
                onChange={(event) => onReportDataChange({ clientPhone: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label="الشكل النظامي للعميل">
              <Input
                value={reportData.clientLegalType ?? ""}
                onChange={(event) => onReportDataChange({ clientLegalType: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder="مؤسسة / شركة / فرد"
              />
            </ReportField>
            <ReportField label="نشاط العميل">
              <Input
                value={reportData.clientActivity ?? ""}
                onChange={(event) => onReportDataChange({ clientActivity: event.target.value })}
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label="ممثل العميل">
              <Input
                value={reportData.clientRepresentativeName ?? ""}
                onChange={(event) => onReportDataChange({ clientRepresentativeName: event.target.value })}
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label="صفة ممثل العميل">
              <Input
                value={reportData.clientRepresentativeRole ?? ""}
                onChange={(event) => onReportDataChange({ clientRepresentativeRole: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder="مالك / مدير / وكيل"
              />
            </ReportField>
            <ReportField label="المستخدمون المستهدفون">
              <Input
                value={reportData.intendedUsers ?? ""}
                onChange={(event) => onReportDataChange({ intendedUsers: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder="العميل / جهة قضائية / جهة تمويل"
              />
            </ReportField>
            <ReportField label="الاستخدام المستهدف للتقرير">
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
          id="firm"
          title="هوية شركة التقييم والمقيم"
          icon={<Building2 className="h-5 w-5" />}
          open={openSections.firm}
          onOpenChange={onSectionOpenChange}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <ReportField label="اسم شركة التقييم">
              <Input
                value={reportData.valuationFirmName ?? ""}
                onChange={(event) => onReportDataChange({ valuationFirmName: event.target.value })}
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label="رقم الترخيص المهني">
              <Input
                value={reportData.valuationFirmLicense ?? ""}
                onChange={(event) => onReportDataChange({ valuationFirmLicense: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
            <ReportField label="عنوان الشركة">
              <Input
                value={reportData.valuationFirmAddress ?? ""}
                onChange={(event) => onReportDataChange({ valuationFirmAddress: event.target.value })}
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label="المقيم المعتمد / المسؤول">
              <Input
                value={reportData.leadValuerName ?? ""}
                onChange={(event) => onReportDataChange({ leadValuerName: event.target.value })}
                className={inputClass}
                dir="auto"
              />
            </ReportField>
            <ReportField label="صفة المقيم المسؤول">
              <Input
                value={reportData.leadValuerTitle ?? ""}
                onChange={(event) => onReportDataChange({ leadValuerTitle: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder="مقيم أساس / زميل معتمد"
              />
            </ReportField>
            <ReportField label="رقم العضوية">
              <Input
                value={reportData.leadValuerMembershipNo ?? ""}
                onChange={(event) => onReportDataChange({ leadValuerMembershipNo: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
              />
            </ReportField>
          </div>
        </ReportSection>

        <ReportSection
          id="scope"
          title="نطاق العمل والقيود"
          icon={<ListChecks className="h-5 w-5" />}
          open={openSections.scope}
          onOpenChange={onSectionOpenChange}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <ReportField label="تفاصيل نطاق العمل">
              <Textarea
                value={reportData.scopeOfWorkDetails ?? ""}
                onChange={(event) => onReportDataChange({ scopeOfWorkDetails: event.target.value })}
                className={textareaClass}
                placeholder="المقابلات، المعاينة، دراسة السوق، مراجعة المستندات، وأي أعمال تحقق."
              />
            </ReportField>
            <ReportField label="تعريف / توضيح أساس القيمة">
              <Textarea
                value={reportData.valuationBasisDefinition ?? ""}
                onChange={(event) => onReportDataChange({ valuationBasisDefinition: event.target.value })}
                className={textareaClass}
                placeholder="اكتب تعريف القيمة السوقية أو أساس القيمة المستخدم عند الحاجة."
              />
            </ReportField>
            <ReportField label="قيود الاستخدام والتوزيع">
              <Textarea
                value={reportData.useRestriction ?? ""}
                onChange={(event) => onReportDataChange({ useRestriction: event.target.value })}
                className={textareaClass}
              />
            </ReportField>
            <ReportField label="المختصون الخارجيون">
              <Textarea
                value={reportData.externalSpecialistUse ?? ""}
                onChange={(event) => onReportDataChange({ externalSpecialistUse: event.target.value })}
                className={textareaClass}
                placeholder="اذكر هل تم الاعتماد على مختصين خارجيين أو لا."
              />
            </ReportField>
            <ReportField label="اعتبارات الاستدامة والحوكمة ESG">
              <Textarea
                value={reportData.esgConsiderations ?? ""}
                onChange={(event) => onReportDataChange({ esgConsiderations: event.target.value })}
                className={textareaClass}
              />
            </ReportField>
            <ReportField label="مصادر المعلومات والمدخلات الرئيسية">
              <Textarea
                value={reportData.informationSources ?? ""}
                onChange={(event) => onReportDataChange({ informationSources: event.target.value })}
                className={textareaClass}
                placeholder="مستندات العميل، المعاينة، بيانات السوق، المقابلات، الجداول الحسابية."
              />
            </ReportField>
          </div>
        </ReportSection>

        <ReportSection
          id="methodology"
          title="الأصل والمنهجية والمعاينة"
          icon={<MapPinned className="h-5 w-5" />}
          open={openSections.methodology}
          onOpenChange={onSectionOpenChange}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <ReportField label="الأصل محل التقييم">
              <Textarea
                value={reportData.assetSubjectDescription ?? ""}
                onChange={(event) => onReportDataChange({ assetSubjectDescription: event.target.value })}
                className={textareaClass}
              />
            </ReportField>
            <ReportField label="الوصف التفصيلي للأصول">
              <Textarea
                value={reportData.assetDetailedDescription ?? ""}
                onChange={(event) => onReportDataChange({ assetDetailedDescription: event.target.value })}
                className={textareaClass}
              />
            </ReportField>
            <ReportField label="موقع المعاينة">
              <Input
                value={reportData.inspectionLocation ?? ""}
                onChange={(event) => onReportDataChange({ inspectionLocation: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder="المدينة / الموقع / العنوان"
              />
            </ReportField>
            <ReportField label="رابط الخريطة">
              <Input
                value={reportData.inspectionMapUrl ?? ""}
                onChange={(event) => onReportDataChange({ inspectionMapUrl: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
                placeholder="https://maps.google.com/..."
              />
            </ReportField>
            <ReportField label="مبررات اختيار المنهجية">
              <Textarea
                value={reportData.methodologyRationale ?? ""}
                onChange={(event) => onReportDataChange({ methodologyRationale: event.target.value })}
                className={textareaClass}
                placeholder="سبب استخدام أسلوب التكلفة أو السوق أو استبعاد أي أسلوب."
              />
            </ReportField>
            <ReportField label="تفاصيل تطبيق أسلوب التكلفة">
              <Textarea
                value={reportData.costApproachDetails ?? ""}
                onChange={(event) => onReportDataChange({ costApproachDetails: event.target.value })}
                className={textareaClass}
                placeholder="تكلفة الاستبدال، الاستنساخ، الإهلاك، الخردة، التقادم الوظيفي والاقتصادي."
              />
            </ReportField>
          </div>
        </ReportSection>

        <ReportSection
          id="team"
          title="فريق التقييم"
          icon={<UsersRound className="h-5 w-5" />}
          open={openSections.team}
          onOpenChange={onSectionOpenChange}
        >
          <div className="space-y-3">
            {teamRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-[12px] font-bold text-slate-500">
                لم تتم إضافة أعضاء فريق لهذا التقرير بعد.
              </div>
            ) : (
              teamRows.map((row, index) => (
                <div key={row.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-[12px] font-extrabold text-slate-800">عضو رقم {index + 1}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTeamMember(row.id)}
                      className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="حذف عضو الفريق"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <ReportField label="الاسم">
                      <Input
                        value={row.name ?? ""}
                        onChange={(event) => updateTeamMember(row.id, { name: event.target.value })}
                        className={inputClass}
                        dir="auto"
                      />
                    </ReportField>
                    <ReportField label="الصفة المهنية">
                      <Input
                        value={row.title ?? ""}
                        onChange={(event) => updateTeamMember(row.id, { title: event.target.value })}
                        className={inputClass}
                        dir="auto"
                      />
                    </ReportField>
                    <ReportField label="رقم العضوية">
                      <Input
                        value={row.membershipNo ?? ""}
                        onChange={(event) => updateTeamMember(row.id, { membershipNo: event.target.value })}
                        className={cn(inputClass, "text-left")}
                        dir="ltr"
                      />
                    </ReportField>
                    <ReportField label="الدور في التقرير">
                      <Input
                        value={row.role ?? ""}
                        onChange={(event) => updateTeamMember(row.id, { role: event.target.value })}
                        className={inputClass}
                        dir="auto"
                        placeholder="المعاينة / إعداد التقرير / المراجعة"
                      />
                    </ReportField>
                  </div>
                </div>
              ))
            )}
            <Button
              type="button"
              variant="outline"
              onClick={addTeamMember}
              className="h-10 rounded-lg border-sky-200 bg-white text-[12px] font-extrabold text-sky-950 hover:bg-sky-50"
            >
              <Plus className="h-4 w-4" />
              إضافة عضو فريق
            </Button>
          </div>
        </ReportSection>

        <ReportSection
          id="assumptions"
          title="الافتراضات"
          icon={<Info className="h-5 w-5" />}
          open={openSections.assumptions}
          onOpenChange={onSectionOpenChange}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <ReportField label="افتراضات مهمة">
              <Textarea
                value={reportData.importantAssumptions ?? ""}
                onChange={(event) => onReportDataChange({ importantAssumptions: event.target.value })}
                className={textareaClass}
                placeholder="اكتب الافتراضات الرئيسية المؤثرة على الرأي المهني."
              />
            </ReportField>
            <ReportField label="افتراضات خاصة">
              <Textarea
                value={reportData.specialAssumptions ?? ""}
                onChange={(event) => onReportDataChange({ specialAssumptions: event.target.value })}
                className={textareaClass}
                placeholder="اكتب أي افتراضات خاصة أو قيود نطاق."
              />
            </ReportField>
          </div>
        </ReportSection>

        <ReportSection
          id="finalValue"
          title="القيمة النهائية"
          icon={<Coins className="h-5 w-5" />}
          open={openSections.finalValue}
          onOpenChange={onSectionOpenChange}
        >
          <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
            <ReportField label="القيمة النهائية للتقرير">
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
            <ReportField label="الرقم كتابياً">
              <Input
                value={reportData.finalValueWords ?? ""}
                readOnly
                className={cn(inputClass, "bg-emerald-50/80 font-extrabold text-emerald-900")}
              />
            </ReportField>
          </div>
        </ReportSection>
      </div>

      <aside className="pointer-events-none fixed bottom-4 left-3 z-[60] sm:bottom-auto sm:top-36">
        <div className="pointer-events-auto flex flex-col items-start gap-2">
          <div className="group relative">
            <div className="relative z-10">
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-950/20 bg-white/95 text-sky-950 shadow-[0_0_18px_5px_rgba(8,47,73,0.32)] transition hover:border-sky-200 hover:bg-sky-50 hover:shadow-[0_0_22px_6px_rgba(8,47,73,0.38)]"
                title="عرض كارد حفظ التقرير"
                aria-label="عرض كارد حفظ التقرير"
              >
                <Save className="h-4 w-4" />
              </button>
            </div>

            <div className="pointer-events-none absolute left-9 top-0 w-48 translate-x-1 opacity-0 transition-all duration-200 ease-out group-hover:pointer-events-auto group-hover:translate-x-0 group-hover:opacity-100">
              <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white/95 text-slate-950 shadow-[0_18px_42px_rgba(15,23,42,0.14)] backdrop-blur-xl">
                <div className="border-b border-slate-100 bg-slate-950 px-2.5 py-2 text-white">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-emerald-300 ring-1 ring-white/10">
                      <BadgeCheck className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-extrabold">حفظ التقرير</p>
                      <p className="text-[9px] font-bold text-white/55">ملخص سريع</p>
                    </div>
                  </div>
                </div>

                <dl className="grid gap-1.5 p-2 text-[9px]">
                  <div className="rounded-lg border border-slate-200/70 bg-white/80 p-2">
                    <dt className="font-bold text-slate-500">الأسلوب</dt>
                    <dd className="mt-1 break-words font-extrabold text-slate-900">
                      {selectDisplay(reportData.valuationMethod)}
                    </dd>
                  </div>
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-2">
                    <dt className="font-bold text-emerald-700/70">القيمة النهائية</dt>
                    <dd className="mt-1 break-words font-extrabold text-emerald-950">
                      {finalValue == null ? "غير محدد" : sarFormatter.format(finalValue)}
                    </dd>
                  </div>
                </dl>

                <div className="border-t border-slate-100 p-2">
                  <Button
                    type="button"
                    onClick={onSave}
                    disabled={saving || !editableProjectName.trim()}
                    className="h-8 w-full rounded-lg bg-emerald-600 text-[10px] font-extrabold text-white shadow-sm shadow-emerald-900/15 hover:bg-emerald-700"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saving ? "جاري الحفظ..." : "حفظ التقرير"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleAllSections}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-sky-950/20 bg-white/95 text-sky-950 shadow-[0_0_18px_5px_rgba(8,47,73,0.32)] transition hover:border-sky-200 hover:bg-sky-50 hover:shadow-[0_0_22px_6px_rgba(8,47,73,0.38)]"
            title={allSectionsOpen ? "طي كل السكاشن" : "فتح كل السكاشن"}
            aria-label={allSectionsOpen ? "طي كل السكاشن" : "فتح كل السكاشن"}
          >
            <SectionToggleIcon className="h-4 w-4" />
          </button>
        </div>
      </aside>
    </section>
  );
}
