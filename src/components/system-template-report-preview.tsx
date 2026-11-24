"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { MvReportPageShell } from "@/components/workspace/workspace-sections/machine-valuation/mv-report-page-shell";
import { formatTemplateReportDate } from "@/components/system-report-template-canvas";
import { hasActiveSummaryTable, SUMMARY_CUSTOM_ROW_KEY, SystemTemplateSummaryTable } from "@/components/system-template-summary-table";
import { interpolateTemplateText, TemplateVariablesProvider, type TemplateVariableResolver } from "@/components/system-template-variables";
import type {
  MvCompanyReportSystemTemplate,
  MvCompanyReportSystemTemplateDefinition,
  MvCompanyReportTemplateCanvasPage,
} from "@/components/workspace/workspace-sections/machine-valuation/types";

const PX_PER_MM = 96 / 25.4;
const A4_SHORT_PX = 210 * PX_PER_MM;
const A4_LONG_PX = 297 * PX_PER_MM;

export type SystemTemplatePreviewData = {
  companyName: string;
  logoSrc?: string | null;
  commercialRegistration?: string;
  managerName?: string;
  managerMembershipNo?: string;
  reportTitle?: string;
  clientName?: string;
  reportReference?: string;
  reportDate?: string;
};

/** Sample values so the studio shows a filled table; the report uses the project's real values. */
const SAMPLE_SUMMARY_VALUES: Record<string, string> = {
  displayNumber: "1024",
  projectName: "تقييم خط إنتاج المصنع",
  assetSingularPlural: "آلات ومعدات",
  valuationMethod: "أسلوب التكلفة",
  valuationPurpose: "أغراض التمويل",
  valuePremise: "الاستخدام الحالي",
  valuationBasis: "القيمة السوقية",
  reportTypeLabel: "تقرير مفصل",
  standardsVersion: "معايير التقييم الدولية 2025",
  currencyLabel: "ريال سعودي",
  inspectionLocation: "الرياض",
  clientId: "1010123456",
  clientEmail: "client@example.com",
  clientPhone: "0500000000",
  clientLegalType: "شركة ذات مسؤولية محدودة",
  clientActivity: "صناعي",
  clientRepresentativeName: "محمد أحمد",
  clientRepresentativeRole: "المدير المالي",
  intendedUsers: "العميل والجهة الممولة",
  intendedUse: "تقديم التقرير للجهة الممولة",
  finalValue: "3,545,000 ر.س",
  finalValueWords: "ثلاثة ملايين وخمسمائة وخمسة وأربعون ألف ريال",
  valuationTeam: "فريق التقييم المعتمد",
};

export type SystemTemplateSummaryPreviewContext = {
  reportTitle: string;
  clientName: string;
  reportReference: string;
  reportDate: string;
  /** Sample values for `{{variables}}` (same resolver the page uses). */
  resolve?: TemplateVariableResolver;
};

function sampleSummaryValue(sourceKey: string, type: string | undefined, ctx: SystemTemplateSummaryPreviewContext) {
  if (sourceKey === "reportTitle") return ctx.reportTitle;
  if (sourceKey === "clientName") return ctx.clientName;
  if (sourceKey === "reportReference") return ctx.reportReference;
  if (sourceKey === "reportIssueDate") return ctx.reportDate;
  if (SAMPLE_SUMMARY_VALUES[sourceKey]) return SAMPLE_SUMMARY_VALUES[sourceKey];
  if (type === "date" || /Date$/.test(sourceKey)) return ctx.reportDate;
  if (type === "number") return "1,250";
  return "قيمة الحقل";
}

function SampleInteriorContent({ template, ctx }: { template: MvCompanyReportSystemTemplateDefinition; ctx: SystemTemplateSummaryPreviewContext }) {
  const heading = { color: "var(--mv-template-primary, #0C447C)", fontFamily: "var(--mv-heading-font, inherit)" } as const;
  const summary = template.summaryTable;
  if (hasActiveSummaryTable(summary)) {
    return (
      <div className="space-y-[3mm] text-right" dir="rtl">
        <h2 className="flex items-center gap-2 text-[15px] font-black" style={heading}>
          <span className="rounded px-1.5 py-0.5 text-[11px] text-white" style={{ background: "var(--mv-template-primary, #0C447C)" }}>3</span>
          الملخص التنفيذي
        </h2>
        <SystemTemplateSummaryTable
          table={summary}
          rows={summary.fields.map((field) => ({
            id: field.id,
            label: field.label || field.sourceKey,
            value: field.valueTemplate?.trim()
              ? interpolateTemplateText(field.valueTemplate.trim(), ctx.resolve)
              : field.sourceKey === SUMMARY_CUSTOM_ROW_KEY ? "" : sampleSummaryValue(field.sourceKey, field.type, ctx),
          }))}
        />
      </div>
    );
  }
  return (
    <div className="space-y-[3mm] text-right" dir="rtl">
      <h2 className="flex items-center gap-2 text-[15px] font-black" style={heading}>
        <span className="rounded px-1.5 py-0.5 text-[11px] text-white" style={{ background: "var(--mv-template-primary, #0C447C)" }}>1.0</span>
        نطاق العمل والغرض من التقييم
      </h2>
      <p className="text-justify leading-[inherit]">
        تم إعداد هذا التقرير وفقاً لمعايير التقييم الدولية لتقدير القيمة السوقية للآلات والمعدات محل التقييم كما في تاريخ التقييم، استناداً إلى المعاينة الميدانية والمستندات المقدمة من العميل.
      </p>
      <table className="w-full border-collapse text-[0.92em]">
        <thead>
          <tr style={{ background: "var(--mv-template-primary, #0C447C)", color: "#fff" }}>
            {["البند", "الوصف", "القيمة (ر.س)"].map((cell) => <th key={cell} className="border border-slate-300 px-2 py-1 font-black">{cell}</th>)}
          </tr>
        </thead>
        <tbody>
          {[["1", "خط إنتاج رئيسي", "2,450,000"], ["2", "معدات مساندة", "780,000"], ["3", "مركبات تشغيلية", "315,000"]].map((row) => (
            <tr key={row[0]} className="odd:bg-slate-50/70">
              {row.map((cell, index) => <td key={index} className="border border-slate-200 px-2 py-1">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="text-[13px] font-black" style={heading}>1.1 أساس القيمة</h3>
      <p className="text-justify leading-[inherit]">
        القيمة السوقية هي المبلغ المقدر الذي ينبغي على أساسه مبادلة الأصول في تاريخ التقييم بين مشترٍ راغب وبائع راغب في معاملة على أساس محايد.
      </p>
    </div>
  );
}

/**
 * Renders a template page with the exact component the final report uses
 * (`MvReportPageShell`) and scales the physical A4 sheet to fit its box, so
 * what the studio and the template pickers show is what the report renders.
 */
export function SystemTemplateReportPreview({
  template,
  page,
  data,
  className,
  orientation = "portrait",
}: {
  template: MvCompanyReportSystemTemplateDefinition;
  page: MvCompanyReportTemplateCanvasPage;
  data: SystemTemplatePreviewData;
  className?: string;
  orientation?: "portrait" | "landscape";
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const landscape = page === "interior" && orientation === "landscape";
  const sheetWidth = landscape ? A4_LONG_PX : A4_SHORT_PX;
  const sheetHeight = landscape ? A4_SHORT_PX : A4_LONG_PX;

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const fit = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      setScale(Math.min(width / sheetWidth, height / sheetHeight));
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    return () => observer.disconnect();
  }, [sheetHeight, sheetWidth]);

  const letterhead = useMemo<MvCompanyReportSystemTemplate>(
    () => ({ templateId: template.id, outputFormat: "pdf", customTemplates: [template] }),
    [template],
  );
  const companyName = data.companyName || "شركة التقييم";
  const reportTitle = data.reportTitle || "تقرير تقييم الآلات والمعدات";
  const clientName = data.clientName || "اسم العميل";
  const reference = data.reportReference || "VT-2026-001";
  const reportDate = formatTemplateReportDate(data.reportDate || new Date().toISOString().slice(0, 10)) ?? "";
  const footerLines = [
    data.commercialRegistration ? `السجل التجاري: ${data.commercialRegistration}` : null,
    data.managerName ? `مدير الشركة: ${data.managerName}` : null,
    data.managerMembershipNo ? `رقم العضوية: ${data.managerMembershipNo}` : null,
    `الرقم المرجعي: ${reference}`,
    `تاريخ التقرير: ${reportDate}`,
  ].filter((line): line is string => Boolean(line));
  const general: Record<string, string> = {
    companyName,
    commercialRegistration: data.commercialRegistration ?? "",
    companyManagerName: data.managerName ?? "",
    companyManagerMembership: data.managerMembershipNo ?? "",
    reportDate,
  };
  const resolveVariable: TemplateVariableResolver = (key) =>
    key in general ? general[key] : sampleSummaryValue(key, undefined, { reportTitle, clientName, reportReference: reference, reportDate });
  const shared = {
    companyName,
    commercialRegistration: data.commercialRegistration,
    reportTitle,
    clientName,
    companyManagerName: data.managerName || undefined,
    companyManagerMembership: data.managerMembershipNo || undefined,
    reportReference: reference,
    reportDate,
    logoSrc: data.logoSrc ?? null,
    footerLines,
    letterheadTemplate: letterhead,
    className: "!m-0 !shadow-none !ring-0 hover:!shadow-none",
  };

  return (
    <div ref={hostRef} className={cn("relative h-full w-full overflow-hidden", className)} dir="rtl">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 shadow-[0_10px_30px_-8px_rgba(15,23,42,0.35)]"
        style={{
          width: sheetWidth,
          height: sheetHeight,
          transform: `translate(-50%, -50%) scale(${scale})`,
          visibility: scale > 0 ? "visible" : "hidden",
        }}
        aria-hidden
        data-testid={`system-template-report-preview-${page}`}
      >
        <TemplateVariablesProvider resolve={resolveVariable}>
        {page === "interior" ? (
          <MvReportPageShell variant="interior" orientation={landscape ? "landscape" : "portrait"} {...shared}>
            <SampleInteriorContent template={template} ctx={{ reportTitle, clientName, reportReference: reference, reportDate, resolve: resolveVariable }} />
          </MvReportPageShell>
        ) : page === "closing" ? (
          <MvReportPageShell variant="cover" coverArtwork="closing" coverChildrenChromeless {...shared}>
            <section className="w-full max-w-lg space-y-6 text-center">
              <p className="text-[42px] font-black leading-tight text-[var(--mv-cover-text,#fff)]">Thank You</p>
              <p className="text-[15px] font-extrabold leading-8 text-[var(--mv-cover-text,#fff)]">شكراً لثقتكم</p>
            </section>
          </MvReportPageShell>
        ) : (
          <MvReportPageShell variant="cover" coverChildrenChromeless {...shared}>
            <div className="w-full max-w-3xl space-y-5 text-center">
              <p className="text-[36px] font-black leading-[1.25] text-[var(--mv-cover-text,#fff)]">{reportTitle}</p>
              <div className="mx-auto h-[3px] w-[120px] rounded-full bg-gradient-to-l from-transparent via-[#c9a227] to-transparent" />
              <p className="text-[20px] font-extrabold leading-7 text-[var(--mv-cover-text,#fff)]">({clientName})</p>
            </div>
          </MvReportPageShell>
        )}
        </TemplateVariablesProvider>
      </div>
    </div>
  );
}
