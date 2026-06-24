"use client";

import type { ReactNode } from "react";
import {
  BadgeCheck,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  ClipboardList,
  Coins,
  Hash,
  Save,
  UserRound,
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
import type { Client as MachineClient } from "@/lib/types/clients";
import { cn } from "@/lib/utils";
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

const VALUATION_METHOD_OPTIONS = [
  "أسلوب التكلفة",
  "أسلوب السوق",
  "المقارنات",
  "التكلفة والسوق معاً",
];
const VALUATION_PURPOSE_OPTIONS = [
  "شراء",
  "بيع",
  "محاسبة",
  "رهن",
  "إفلاس",
  "تمويل",
  "تأمين",
  "نزاعات و تقاضي",
  "أخرى",
];
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
const PROFESSIONAL_REPORT_TYPE_OPTIONS = [
  "تقرير مفصل",
  "ملخص تقرير",
  "مراجعه مع قيمة جديدة",
  "مراجعه بدون قيمة جديدة",
];

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
  const allSectionsOpen = MV_REPORT_COLLAPSIBLE_IDS.every((id) => openSections[id]);
  const SectionToggleIcon = allSectionsOpen ? ChevronsDownUp : ChevronsUpDown;
  const inputClass =
    "h-11 rounded-lg border-slate-300/80 bg-white px-3 text-[13px] font-bold text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.05)] focus-visible:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-100";
  const finalValue = reportData.finalValue ?? null;
  const reportDisplayNumber =
    typeof project.displayNumber === "number" && Number.isFinite(project.displayNumber)
      ? project.displayNumber
      : null;
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
            <ReportField label="رقم التقرير داخل الشركة (تسلسلي)">
              <div className="relative">
                <Input
                  value={reportDisplayNumber == null ? "—" : String(reportDisplayNumber)}
                  readOnly
                  disabled
                  dir="ltr"
                  aria-label="الرقم التسلسلي للتقرير (غير قابل للتعديل)"
                  className={cn(
                    inputClass,
                    "bg-sky-50/70 text-left font-black tabular-nums text-[#0C447C] cursor-not-allowed",
                  )}
                />
                <Hash
                  aria-hidden
                  className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0C447C]/60"
                />
              </div>
            </ReportField>
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
                placeholder="تقرير تقييم أصول ملموسة"
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
            <ReportSelect
              label="نوع التقرير المهني"
              value={reportData.reportTypeLabel ?? ""}
              options={PROFESSIONAL_REPORT_TYPE_OPTIONS}
              placeholder="اختر نوع التقرير المهني"
              onChange={(value) => onReportDataChange({ reportTypeLabel: value })}
            />
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
            <ReportField label="موقع المعاينة">
              <Input
                value={reportData.inspectionLocation ?? ""}
                onChange={(event) => onReportDataChange({ inspectionLocation: event.target.value })}
                className={inputClass}
                dir="auto"
                placeholder="المدينة / الموقع / العنوان"
              />
            </ReportField>
            <ReportField label="رابط الخريطة للمعاينة">
              <Input
                value={reportData.inspectionMapUrl ?? ""}
                onChange={(event) => onReportDataChange({ inspectionMapUrl: event.target.value })}
                className={cn(inputClass, "text-left")}
                dir="ltr"
                placeholder="https://maps.app.goo.gl/..."
              />
            </ReportField>
          </div>
          {/* <p className="mt-4 rounded-lg border border-dashed border-sky-200/80 bg-sky-50/60 px-3 py-2 text-[11.5px] font-bold leading-6 text-sky-900">
            ملاحظة: نصوص «نطاق العمل والقيود»، «الأصل والمنهجية والمعاينة»، و«الافتراضات» تُدار الآن من «لوحة الشركة → بيانات إعداد التقرير النهائي» وتُدمج تلقائياً داخل التقرير بأسلوب نصي مع البيانات الديناميكية لهذا المشروع.
          </p> */}
        </ReportSection>

        <ReportSection
          id="client"
          title="معلومات العميل"
          icon={<UserRound className="h-5 w-5" />}
          open={openSections.client}
          onOpenChange={onSectionOpenChange}
        >
          <div className="mb-3">
            <ReportField label="اختيار العميل">
              <Select
                value={reportData.clientId || NO_CLIENT_SELECTED}
                onValueChange={handleClientSelect}
                dir="rtl"
              >
                <SelectTrigger className={inputClass}>
                  <SelectValue placeholder="اختر العميل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CLIENT_SELECTED}>بدون عميل محدد</SelectItem>
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
                    <dt className="font-bold text-slate-500">رقم التقرير</dt>
                    <dd className="mt-1 break-words font-extrabold text-slate-900">
                      {reportDisplayNumber == null ? "—" : reportDisplayNumber.toString()}
                    </dd>
                  </div>
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
