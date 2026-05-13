"use client";

import { Fragment, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MvDriveFile, MvProject, MvProjectReportData } from "./types";
import {
  MV_VALUATION_ACCOUNTING_APPROACHES,
  type MvValuationAccountingImage,
} from "./mv-valuation-accounting-store";
import { ReportRichHtmlField } from "./mv-report-rich-selection-toolbar";
import { MV_REPORT_TOC_ROWS } from "./mv-valuation-report-toc";
import {
  MV_DEFAULT_RECEIVED_CLIENT_DOCUMENTS_HTML,
  MV_DEFAULT_SCE_REGISTRATION_HTML,
} from "./mv-valuation-report-narrative-defaults";
import { MvValuationAnnexImageSheet } from "./mv-valuation-annex-image-sheet";
import { MvReportPageShell } from "./mv-report-page-shell";

type ReportSignatureRow = {
  id: string;
  name: string;
  roleLabel: string;
  signatureImageDataUrl: string;
};

type EditableReportSection = { id: string; title: string; body: string };

function EditableBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      contentEditable
      suppressContentEditableWarning
      dir="rtl"
      className={cn(
        "rounded-md text-right outline-none transition focus:bg-sky-50/60 focus:ring-2 focus:ring-sky-100",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SectionShell({
  id,
  title,
  children,
  headerExtra,
  className,
}: {
  id?: string;
  title: ReactNode;
  children: ReactNode;
  headerExtra?: ReactNode;
  className?: string;
}) {
  return (
    <section {...(id ? { id } : {})} dir="rtl" className={cn("scroll-mt-4 text-right", className)}>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div
          className="min-w-0 flex-1 text-right text-[17px] font-black leading-tight text-[#0a1f33] sm:text-[19px]"
          style={{ letterSpacing: 0 }}
        >
          {title}
        </div>
        {headerExtra ? <div className="mv-report-chrome shrink-0 print:hidden">{headerExtra}</div> : null}
      </div>
      {children}
    </section>
  );
}

function InsertSectionCue({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="mv-report-chrome relative py-5 print:hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-l from-transparent via-slate-200 to-transparent"
        aria-hidden
      />
      <div className="relative flex justify-center px-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="gap-1.5 border-dashed border-sky-300/80 bg-white/95 px-4 text-[12px] font-extrabold text-sky-950 shadow-sm transition hover:border-sky-400 hover:bg-sky-50"
        >
          إضافة قسم للتقرير
        </Button>
      </div>
    </div>
  );
}

function downloadHref(projectId: string, file: MvDriveFile) {
  const anyFile = file as MvDriveFile & { sourceUrl?: string };
  if (anyFile.sourceUrl) return anyFile.sourceUrl;
  return `/api/mv/projects/${projectId}/files/${file._id}/download`;
}

function textValue(value: string | number | null | undefined, fallback = "غير محدد") {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function dateValue(value: string | null | undefined) {
  if (!value) return "غير محدد";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

const sarFormatter = new Intl.NumberFormat("ar-SA", {
  style: "currency",
  currency: "SAR",
  maximumFractionDigits: 0,
});

function currencyValue(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "غير محدد";
  return sarFormatter.format(value);
}

function sectionHeading(title: string) {
  return (
    <h3 dir="rtl" className="mb-3 border-b-2 border-[#0C447C]/25 pb-2 text-right text-[16px] font-black leading-snug text-[#0C447C]">
      {title}
    </h3>
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export interface MvValuationReportDocumentBodyProps {
  projectId: string;
  project: MvProject | null;
  projectName: string;
  reportData: MvProjectReportData;
  companyBrand: { name: string; logoSrc: string | null };
  reportFooterLines: string[];
  tocApproxPages: Record<string, string>;
  sectionGap: number;
  narrativeB1: string;
  narrativeB2: string;
  narrativeB3: string;
  narrativeB4: string;
  introExtraHtml: string;
  onNarrativeB1: (html: string) => void;
  onNarrativeB2: (html: string) => void;
  onNarrativeB3: (html: string) => void;
  onNarrativeB4: (html: string) => void;
  onIntroExtraHtml: (html: string) => void;
  assetFolderLabels: string[];
  inspectionLocationText: string;
  inspectionMapUrl: string;
  primarySignatory?: ReportSignatureRow;
  preparerDisplayRows: ReportSignatureRow[];
  updatePreparerField: (id: string, field: "name" | "roleLabel", value: string) => void;
  includeAssetImages: boolean;
  includeValuationAccountImages: boolean;
  orderedImages: MvDriveFile[];
  imageOrder: string[];
  imageGroupGap: number;
  imageInnerGap: number;
  assetImageWidth: number;
  valuationImageWidth: number;
  valuationAccountImages: MvValuationAccountingImage[];
  moveImage: (fileId: string, direction: -1 | 1) => void;
  hideImage: (fileId: string) => void;
  navigate: (href: string) => void;
  editableSections: EditableReportSection[];
  updateEditableSection: (id: string, patch: Partial<EditableReportSection>) => void;
  removeEditableSection: (id: string) => void;
  addEditableSection: () => void;
  /** وضع مسودة: علامة مائية وإخفاء صور التوقيع في 24.0 */
  draftWatermark: boolean;
  onReportDataPatch: (patch: Partial<MvProjectReportData>) => void;
}

export function MvValuationReportDocumentBody({
  projectId,
  project,
  projectName,
  reportData,
  companyBrand,
  reportFooterLines,
  tocApproxPages,
  sectionGap,
  narrativeB1,
  narrativeB2,
  narrativeB3,
  narrativeB4,
  introExtraHtml,
  onNarrativeB1,
  onNarrativeB2,
  onNarrativeB3,
  onNarrativeB4,
  onIntroExtraHtml,
  assetFolderLabels,
  inspectionLocationText,
  inspectionMapUrl,
  primarySignatory,
  preparerDisplayRows,
  updatePreparerField,
  includeAssetImages,
  includeValuationAccountImages,
  orderedImages,
  imageOrder,
  imageGroupGap,
  imageInnerGap,
  assetImageWidth,
  valuationImageWidth,
  valuationAccountImages,
  moveImage,
  hideImage,
  navigate,
  editableSections,
  updateEditableSection,
  removeEditableSection,
  addEditableSection,
  draftWatermark,
  onReportDataPatch,
}: MvValuationReportDocumentBodyProps) {
  const referenceLabel = project?._id ? String(project._id).slice(-12) : projectId;
  const { name: companyName, logoSrc } = companyBrand;
  const sheetDraft = draftWatermark;

  const receivedClientDocumentsHtml =
    reportData.receivedClientDocumentsHtml?.trim() || MV_DEFAULT_RECEIVED_CLIENT_DOCUMENTS_HTML;
  const sceRegistrationHtml =
    reportData.sceRegistrationCertificateHtml?.trim() || MV_DEFAULT_SCE_REGISTRATION_HTML;

  const assetPhotoChunks = chunkArray(orderedImages, 8);

  const valuationSheets = includeValuationAccountImages
    ? MV_VALUATION_ACCOUNTING_APPROACHES.flatMap((approach) => {
        const imgs = valuationAccountImages.filter((im) => im.approachId === approach.id);
        return imgs.map((image) => ({ approach, image }));
      })
    : [];

  return (
    <div dir="rtl" className="mx-auto flex w-max flex-col items-center text-right" style={{ gap: sectionGap }}>
      <MvReportPageShell
        variant="cover"
        companyName={companyName}
        logoSrc={logoSrc}
        footerLines={reportFooterLines}
        draftWatermark={sheetDraft}
      >
        <div id="report-cover" className="w-full max-w-lg space-y-6">
          <EditableBlock className="px-2 py-2 text-[24px] font-black leading-tight text-[#0a1f33] sm:text-[30px]">
            تقرير تقييم معدات وآلات
          </EditableBlock>
          <div className="rounded-2xl border border-[#0C447C]/15 bg-white/90 px-4 py-5 text-right shadow-sm ring-1 ring-sky-100/80 backdrop-blur-sm">
            <div className="grid gap-3 text-[12px] font-bold leading-7 text-slate-800 sm:grid-cols-2">
              <p>
                <span className="text-[#0C447C]/80">العميل: </span>
                {textValue(reportData.clientName)}
              </p>
              <p className="text-right">
                <span className="text-[#0C447C]/80">المرجع: </span>
                <bdi dir="ltr" className="inline-block">
                  {referenceLabel}
                </bdi>
              </p>
              <p>
                <span className="text-[#0C447C]/80">تاريخ الإصدار: </span>
                {dateValue(reportData.reportIssueDate)}
              </p>
              <p>
                <span className="text-[#0C447C]/80">المقيّم (ممثل): </span>
                {primarySignatory?.name?.trim() ? primarySignatory.name : "—"}
              </p>
              <p className="sm:col-span-2">
                <span className="text-[#0C447C]/80">المشروع: </span>
                {projectName}
              </p>
              <p className="sm:col-span-2 text-[11px] font-semibold text-slate-600">
                {textValue(reportData.clientPhone, "")}
                {reportData.clientPhone && reportData.clientEmail ? " · " : ""}
                {textValue(reportData.clientEmail, "")}
              </p>
            </div>
          </div>
          <p className="text-[10px] font-bold text-slate-500">
            وثيقة مهنية — يُراعى سرية الاستخدام وفق نطاق الاتفاق.
          </p>
        </div>
      </MvReportPageShell>

      <MvReportPageShell
        variant="interior"
        orientation="portrait"
        companyName={companyName}
        logoSrc={logoSrc}
        footerLines={reportFooterLines}
        draftWatermark={sheetDraft}
      >
        <section id="report-toc" className="scroll-mt-4">
          <h2 className="text-center text-[20px] font-black text-[#0C447C]">الفهرس</h2>
          <p className="mx-auto mt-2 max-w-2xl text-center text-[10px] font-semibold text-slate-500">
            أرقام الصفحة مرتبطة بترقيم الصفحات في التقرير (يشمل الغلاف).
          </p>
          <div className="mt-4 overflow-x-hidden rounded-xl border border-[#0C447C]/12 bg-white/60">
            <table className="w-full min-w-[300px] border-collapse text-[11px]">
              <thead>
                <tr className="border-b-2 border-[#0C447C] bg-sky-50/80">
                  <th className="w-12 px-2 py-2 text-right text-[10px] font-black text-[#0C447C]">رقم</th>
                  <th className="px-2 py-2 text-right text-[10px] font-black text-[#0C447C]">البند</th>
                  <th className="w-14 px-2 py-2 text-center text-[10px] font-black text-[#0C447C]">صفحة</th>
                </tr>
              </thead>
              <tbody>
                {MV_REPORT_TOC_ROWS.map((row) => (
                  <tr key={`${row.num}-${row.title}`} className="border-b border-slate-200/80">
                    <td className="px-2 py-1.5 align-top font-black tabular-nums text-slate-800">{row.num}</td>
                    <td className="px-2 py-1.5 align-top font-semibold text-slate-900">{row.title}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums text-slate-600">
                      {tocApproxPages[row.anchor] ?? "…"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </MvReportPageShell>

      <MvReportPageShell
        variant="interior"
        companyName={companyName}
        logoSrc={logoSrc}
        footerLines={reportFooterLines}
        draftWatermark={sheetDraft}
      >
        <section id="mv-toc-1" className="space-y-3">
          {sectionHeading("1.0 مقدمة")}
          <div className="space-y-3 text-[12px] font-medium leading-7 text-slate-800">
            <p>
              تم إعداد هذا التقرير من قبل <strong>{textValue(companyName, "الجهة المُقيِّمة")}</strong> للعميل{" "}
              <strong>{textValue(reportData.clientName)}</strong> في إطار العمل على مشروع{" "}
              <strong>{projectName}</strong>، وذلك بغرض <strong>{textValue(reportData.valuationPurpose)}</strong> مع
              مراعاة أساس القيمة المعتمد <strong>{textValue(reportData.valuePremise)}</strong>.
            </p>
          </div>
          <ReportRichHtmlField
            html={introExtraHtml}
            onHtmlChange={onIntroExtraHtml}
            placeholder="نص تكميلي للمقدمة (اختياري)…"
          />
        </section>
        <section id="mv-toc-2" className="mt-6">
          {sectionHeading("2.0 التواريخ المستخدمة")}
          <ul className="list-disc space-y-1.5 pe-4 text-[12px] font-semibold leading-7 text-slate-800">
            {reportData.agreementDate ? (
              <li>تاريخ الاتفاقية (نطاق العمل): {dateValue(reportData.agreementDate)}.</li>
            ) : (
              <li className="text-slate-500">تاريخ الاتفاقية: غير محدد — يُضاف من «بيانات التقرير».</li>
            )}
            <li>تاريخ المعاينة: {dateValue(reportData.inspectionDate)}.</li>
            <li>تاريخ التقييم: {dateValue(reportData.valuationDate)}.</li>
            <li>تاريخ إصدار التقرير: {dateValue(reportData.reportIssueDate)}.</li>
          </ul>
        </section>
      </MvReportPageShell>

      <MvReportPageShell variant="interior" companyName={companyName} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
        <div id="mv-b1">
          <ReportRichHtmlField html={narrativeB1} onHtmlChange={onNarrativeB1} placeholder="النصوص المعيارية…" />
        </div>
      </MvReportPageShell>

      <MvReportPageShell variant="interior" companyName={companyName} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
        <div id="mv-b2">
          <ReportRichHtmlField html={narrativeB2} onHtmlChange={onNarrativeB2} placeholder="النصوص المعيارية…" />
        </div>
      </MvReportPageShell>

      <MvReportPageShell variant="interior" companyName={companyName} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
        <div id="mv-b3">
          <ReportRichHtmlField html={narrativeB3} onHtmlChange={onNarrativeB3} placeholder="النصوص المعيارية…" />
        </div>
      </MvReportPageShell>

      <MvReportPageShell variant="interior" companyName={companyName} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
        <section id="mv-toc-18">
          {sectionHeading("18.0 الأصل محل التقييم")}
          <p className="text-[12px] font-medium leading-7 text-slate-800">
            يتعلق هذا التقرير بالأصول ضمن نطاق المعاينة والمعلومات المقدمة من العميل
            {assetFolderLabels.length > 0 ? (
              <>
                ، بما في ذلك: <strong>{assetFolderLabels.join("، ")}</strong>
              </>
            ) : null}
            . التفاصيل والصور في الملحقات.
          </p>
        </section>
        <section id="mv-toc-18-1" className="mt-5">
          {sectionHeading("18.1 الوصف الجزئي")}
          <p className="text-[12px] font-medium leading-7 text-slate-800">
            يُعرض الوصف الجزئي وحسابات القيمة في «مرفق 1»، والصور في «مرفق 2»، والمستندات المستلمة من العميل
            في «مرفق 3»، وبيان شهادة التسجيل في بوابة «تقييم» في «مرفق 4».
          </p>
        </section>
        <section id="mv-toc-19" className="mt-5">
          {sectionHeading("19.0 العملة")}
          <p className="text-[12px] font-medium leading-7 text-slate-800">
            العملة المعتمدة: <strong>الريال السعودي (ر.س)</strong>.
          </p>
        </section>
        <section id="mv-toc-20" className="mt-5">
          {sectionHeading("20.0 المعاينة")}
          <p className="text-[12px] font-medium leading-7 text-slate-800">
            تمت المعاينة في <strong>{inspectionLocationText}</strong> بتاريخ{" "}
            <strong>{dateValue(reportData.inspectionDate)}</strong>
            {inspectionMapUrl ? (
              <>
                {" "}
                —{" "}
                <a href={inspectionMapUrl} className="break-all font-semibold text-[#0C447C] underline">
                  {inspectionMapUrl}
                </a>
              </>
            ) : null}
            .
          </p>
        </section>
      </MvReportPageShell>

      <MvReportPageShell variant="interior" companyName={companyName} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
        <div id="mv-b4">
          <ReportRichHtmlField html={narrativeB4} onHtmlChange={onNarrativeB4} placeholder="المنهجية والإفادات…" />
          {reportData.importantAssumptions?.trim() || reportData.specialAssumptions?.trim() ? (
            <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-sky-50/40 px-3 py-3 text-[12px] leading-7 text-slate-800">
              {reportData.importantAssumptions?.trim() ? (
                <div>
                  <p className="font-black text-[#0C447C]">إفادات مهمة</p>
                  <p className="mt-1 whitespace-pre-wrap font-medium">{reportData.importantAssumptions}</p>
                </div>
              ) : null}
              {reportData.specialAssumptions?.trim() ? (
                <div>
                  <p className="font-black text-[#0C447C]">إفادات خاصة</p>
                  <p className="mt-1 whitespace-pre-wrap font-medium">{reportData.specialAssumptions}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </MvReportPageShell>

      <MvReportPageShell variant="interior" companyName={companyName} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
        <section id="mv-toc-24">
          {sectionHeading("24.0 رأي القيمة")}
          <div className="rounded-xl border-2 border-[#0C447C]/20 bg-gradient-to-l from-sky-50/80 to-white px-4 py-5">
            <p className="text-[12px] font-semibold leading-7 text-slate-700">
              بعد الأخذ بالاعتبار البيانات ذات العلاقة والمبادئ المهنية، فإن رأي القيمة يُقدَّر بـ:
            </p>
            <p className="mt-3 text-center text-[22px] font-black text-[#0C447C]">{currencyValue(reportData.finalValue)}</p>
            {reportData.finalValueWords ? (
              <p className="mt-2 text-center text-[13px] font-bold text-slate-700">{reportData.finalValueWords}</p>
            ) : null}
          </div>
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {preparerDisplayRows.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] font-semibold text-slate-500">
                لا صفوف من لوحة الشركة — أضف مقيّمين وتوقيعات من لوحة إدارة الشركة.
              </p>
            ) : (
              <table className="w-full table-fixed border-collapse text-right text-[11px]">
                <thead>
                  <tr className="bg-sky-50/90">
                    <th className="w-[42%] border-b border-slate-200 px-2 py-2 font-black text-[#0C447C]">المقيّم والدور</th>
                    <th className="border-b border-slate-200 px-2 py-2 font-black text-[#0C447C]">التوقيع</th>
                  </tr>
                </thead>
                <tbody>
                  {preparerDisplayRows.map((row) => (
                    <tr key={row.id}>
                      <td className="border-b border-slate-100 p-0 align-top">
                        <div className="flex flex-col gap-1 px-2 py-2">
                          <input
                            dir="rtl"
                            value={row.name}
                            onChange={(e) => updatePreparerField(row.id, "name", e.target.value)}
                            placeholder="اسم المقيم"
                            className="mv-report-preparer-field h-8 w-full rounded border border-slate-200 bg-white px-2 text-[12px] font-semibold outline-none focus:border-sky-400 print:border-0"
                          />
                          <input
                            dir="rtl"
                            value={row.roleLabel}
                            onChange={(e) => updatePreparerField(row.id, "roleLabel", e.target.value)}
                            placeholder="الدور"
                            className="mv-report-preparer-field h-7 w-full rounded border border-slate-200 bg-white px-2 text-[11px] outline-none focus:border-sky-400 print:border-0"
                          />
                        </div>
                      </td>
                      <td className="border-b border-slate-100 p-2 align-middle">
                        <div className="flex min-h-[3.5rem] items-center justify-center">
                          {!sheetDraft && row.signatureImageDataUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={row.signatureImageDataUrl}
                              alt=""
                              className="max-h-20 max-w-full object-contain"
                            />
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </MvReportPageShell>

      <InsertSectionCue onAdd={addEditableSection} />

      {editableSections.map((section) => (
        <Fragment key={section.id}>
          <MvReportPageShell variant="interior" companyName={companyName} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
            <SectionShell
              id={`custom:${section.id}`}
              title={
                <input
                  dir="rtl"
                  value={section.title}
                  onChange={(e) => updateEditableSection(section.id, { title: e.target.value })}
                  className="w-full max-w-full rounded-lg border border-transparent bg-sky-50/30 px-2 py-1 text-right text-[17px] font-black outline-none focus:border-sky-300 focus:bg-white"
                />
              }
              headerExtra={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="حذف القسم"
                  onClick={() => removeEditableSection(section.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              }
            >
              <ReportRichHtmlField
                html={section.body}
                onHtmlChange={(next) => updateEditableSection(section.id, { body: next })}
                placeholder="اكتب محتوى القسم هنا…"
              />
            </SectionShell>
          </MvReportPageShell>
          <InsertSectionCue onAdd={addEditableSection} />
        </Fragment>
      ))}

      {!includeValuationAccountImages ? (
        <MvReportPageShell variant="interior" companyName={companyName} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
          <SectionShell
            id="mv-annex-1"
            title={
              <span>
                مرفق 1<span className="text-slate-500">: الوصف الجزئي وحسابات القيمة</span>
              </span>
            }
          >
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-[12px] font-extrabold text-amber-900">
              تم إيقاف عرض صور إجراءات التقييم من خطوة إجراءات التقييم.
            </div>
          </SectionShell>
        </MvReportPageShell>
      ) : valuationAccountImages.length === 0 ? (
        <MvReportPageShell variant="interior" companyName={companyName} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
          <SectionShell
            id="mv-annex-1"
            title={
              <span>
                مرفق 1<span className="text-slate-500">: الوصف الجزئي وحسابات القيمة</span>
              </span>
            }
          >
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
              <p className="text-[14px] font-black text-slate-700">لا توجد صور حسابات في التقرير بعد.</p>
              <Button
                type="button"
                className="mv-report-chrome mt-3 h-9 bg-[#0C447C] px-4 text-[11px] font-extrabold text-white"
                onClick={() => navigate(`/machine-valuation/${projectId}/workflow/valuation`)}
              >
                الانتقال إلى إجراءات التقييم
              </Button>
            </div>
          </SectionShell>
        </MvReportPageShell>
      ) : (
        valuationSheets.map(({ approach, image }, vIdx) => (
          <MvValuationAnnexImageSheet
            key={image.id}
            projectId={projectId}
            approach={approach}
            image={image}
            vIdx={vIdx}
            companyName={companyName}
            logoSrc={logoSrc}
            footerLines={reportFooterLines}
            valuationImageWidth={valuationImageWidth}
            draftWatermark={sheetDraft}
          />
        ))
      )}

      {assetPhotoChunks.map((chunk, chunkIdx) => (
        <MvReportPageShell
          key={`assets-${chunkIdx}`}
          variant="interior"
          companyName={companyName}
          logoSrc={logoSrc}
          footerLines={reportFooterLines}
        draftWatermark={sheetDraft}
        >
          <SectionShell
            id={chunkIdx === 0 ? "mv-annex-2" : `mv-annex-2-${chunkIdx}`}
            title={chunkIdx === 0 ? "مرفق 2: صور الأصول" : `مرفق 2 (تتمة ${chunkIdx + 1})`}
          >
            {!includeAssetImages ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-[12px] font-extrabold text-amber-900">
                تم إيقاف عرض صور الأصول من تبويب رفع الصور.
              </div>
            ) : chunk.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-8 text-center text-[12px] font-extrabold text-slate-500">
                لا توجد صور محددة للتقرير.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1 p-0" style={{ gap: imageInnerGap }}>
                {chunk.map((file) => {
                  const index = imageOrder.indexOf(file._id);
                  return (
                    <figure
                      key={file._id}
                      className="group relative break-inside-avoid bg-white"
                      style={{ width: `${assetImageWidth}%` }}
                    >
                      <div className="mv-report-chrome absolute left-0.5 top-0.5 z-10 flex gap-0.5 opacity-100 lg:opacity-0 lg:transition lg:group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => moveImage(file._id, -1)}
                          disabled={index <= 0}
                          className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white/95 text-slate-600 shadow-sm disabled:opacity-30"
                          aria-label="تحريك للأعلى"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveImage(file._id, 1)}
                          disabled={index >= imageOrder.length - 1}
                          className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white/95 text-slate-600 shadow-sm disabled:opacity-30"
                          aria-label="تحريك للأسفل"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => hideImage(file._id)}
                          className="flex h-6 w-6 items-center justify-center rounded border border-red-100 bg-white/95 text-red-600 shadow-sm"
                          aria-label="إخفاء"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={downloadHref(projectId, file)}
                        alt=""
                        className="block w-full bg-slate-100 object-cover"
                        style={{ aspectRatio: "4 / 3" }}
                        loading="lazy"
                      />
                    </figure>
                  );
                })}
              </div>
            )}
          </SectionShell>
        </MvReportPageShell>
      ))}

      <MvReportPageShell
        variant="interior"
        companyName={companyName}
        logoSrc={logoSrc}
        footerLines={reportFooterLines}
        draftWatermark={sheetDraft}
      >
        <SectionShell
          id="mv-annex-3"
          title={
            <span>
              مرفق 3<span className="text-slate-500">: مستندات مستلمة من العميل</span>
            </span>
          }
        >
          <ReportRichHtmlField
            html={receivedClientDocumentsHtml}
            onHtmlChange={(next) => onReportDataPatch({ receivedClientDocumentsHtml: next })}
            placeholder="اذكر المستندات المستلمة من العميل…"
          />
        </SectionShell>
      </MvReportPageShell>

      <MvReportPageShell
        variant="interior"
        companyName={companyName}
        logoSrc={logoSrc}
        footerLines={reportFooterLines}
        draftWatermark={sheetDraft}
      >
        <SectionShell
          id="mv-annex-sce"
          title={
            <span className="text-[14px] font-black leading-snug text-[#0a1f33]">
              شهادة التسجيل في بوابة الخدمات الإلكترونية للهيئة السعودية للمقيمين المعتمدين «تقييم»
            </span>
          }
        >
          <ReportRichHtmlField
            html={sceRegistrationHtml}
            onHtmlChange={(next) => onReportDataPatch({ sceRegistrationCertificateHtml: next })}
            placeholder="أدخل نص الشهادة أو المرجع…"
          />
        </SectionShell>
      </MvReportPageShell>

      <InsertSectionCue onAdd={addEditableSection} />
    </div>
  );
}
