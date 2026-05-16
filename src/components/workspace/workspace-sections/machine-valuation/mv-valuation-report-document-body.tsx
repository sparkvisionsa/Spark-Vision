"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, FileText, Heading2, ImageIcon, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  MvDriveFile,
  MvProject,
  MvProjectReportData,
  MvReportEditableSection,
  MvReportInsertedBlock,
  MvReportInsertedBlockKind,
} from "./types";
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

function newReportBlockId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `block-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function DeleteFieldButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        "mv-report-chrome absolute -left-2 top-0 z-20 hidden h-6 w-6 items-center justify-center rounded-md border border-red-100 bg-white/95 text-red-600 shadow-sm transition hover:bg-red-50 group-hover/report-editable:flex focus:flex print:hidden",
        className,
      )}
      aria-label="حذف"
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

function EditableBlock({
  value,
  onChange,
  className,
  multiline = true,
  dir = "rtl",
  placeholder,
  onDelete,
  deletable = true,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  multiline?: boolean;
  dir?: "rtl" | "ltr" | "auto";
  placeholder?: string;
  onDelete?: () => void;
  deletable?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const composing = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if ((el.textContent ?? "") !== value) el.textContent = value;
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    onChange(el.textContent ?? "");
  };

  const inline = className?.includes("inline-block");
  const handleDelete = () => {
    if (ref.current) ref.current.textContent = "";
    if (onDelete) onDelete();
    else onChange("");
  };

  return (
    <div className={cn("group/report-editable relative min-w-0", inline ? "inline-block" : "block")}>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        dir={dir}
        role="textbox"
        aria-label={placeholder}
        aria-multiline={multiline}
        className={cn(
          "min-w-0 whitespace-pre-wrap rounded-md text-right outline-none transition focus:bg-sky-50/60 focus:ring-2 focus:ring-sky-100",
          className,
        )}
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={() => {
          composing.current = false;
          emit();
        }}
        onInput={() => {
          if (!composing.current) emit();
        }}
        onKeyDown={(event) => {
          if (!multiline && event.key === "Enter") {
            event.preventDefault();
            ref.current?.blur();
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
        }}
      >
      </div>
      {deletable ? <DeleteFieldButton onClick={handleDelete} /> : null}
    </div>
  );
}

function ClearableRichHtmlField({
  html,
  onHtmlChange,
  className,
  emptyHtml = "",
}: {
  html: string;
  onHtmlChange: (next: string) => void;
  className?: string;
  emptyHtml?: string;
}) {
  return (
    <div className="group/report-editable relative">
      <ReportRichHtmlField html={html} onHtmlChange={onHtmlChange} className={className} />
      <DeleteFieldButton onClick={() => onHtmlChange(emptyHtml)} />
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
    <section
      {...(id ? { id, "data-mv-report-insert-anchor": id } : {})}
      dir="rtl"
      className={cn("scroll-mt-4 text-right", className)}
    >
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

const INSERTED_IMAGE_TARGET_CHARS = 2_500_000;
const INSERTED_IMAGE_MAX_SIDE = 1800;
const EMPTY_RICH_HTML = "<p><br></p>";

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image"));
    reader.readAsDataURL(file);
  });
}

function loadImageFromDataUrl(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to decode image"));
    image.src = dataUrl;
  });
}

async function readInsertedReportImageDataUrl(file: File) {
  const raw = await readFileAsDataUrl(file);
  if (!raw || raw.length <= INSERTED_IMAGE_TARGET_CHARS || file.type === "image/svg+xml") return raw;

  try {
    const image = await loadImageFromDataUrl(raw);
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    if (!naturalWidth || !naturalHeight) return raw;

    const scale = Math.min(1, INSERTED_IMAGE_MAX_SIDE / Math.max(naturalWidth, naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return raw;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    let quality = 0.88;
    let compressed = canvas.toDataURL("image/jpeg", quality);
    while (compressed.length > INSERTED_IMAGE_TARGET_CHARS && quality > 0.62) {
      quality -= 0.08;
      compressed = canvas.toDataURL("image/jpeg", quality);
    }
    return compressed || raw;
  } catch {
    return raw;
  }
}

function sectionHeading(title: string, onChange?: (value: string) => void) {
  return (
    <div
      dir="rtl"
      className="mb-3 border-b-2 border-[#0C447C]/25 pb-2 text-right text-[16px] font-black leading-snug text-[#0C447C]"
    >
      {onChange ? (
        <EditableBlock
          value={title}
          onChange={onChange}
          className="min-h-[1.75rem] w-full"
          placeholder="عنوان القسم"
          multiline={false}
        />
      ) : (
        title
      )}
    </div>
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type ReportInfoRow = {
  label: string;
  value: ReactNode;
  labelEditKey?: string;
  labelEditValue?: string;
  editKey?: string;
  editValue?: string;
  dir?: "rtl" | "ltr" | "auto";
};

function reportNodeHasValue(value: ReactNode) {
  if (value == null || value === false) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

function ReportInfoTable({
  rows,
  className,
  onTextOverride,
}: {
  rows: ReportInfoRow[];
  className?: string;
  onTextOverride?: (key: string, value: string) => void;
}) {
  const visibleRows = rows.filter((row) => row.editKey || row.labelEditKey || reportNodeHasValue(row.value));
  if (visibleRows.length === 0) return null;
  return (
    <div className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white/80", className)}>
      <table className="w-full border-collapse text-right text-[11px]">
        <tbody>
          {visibleRows.map((row) => (
            <tr key={`${row.labelEditKey ?? row.label}-${row.editKey ?? "value"}`} className="border-b border-slate-100 last:border-0">
              <th className="w-[34%] bg-sky-50/70 px-3 py-2 align-top font-black text-[#0C447C]">
                {row.labelEditKey && onTextOverride ? (
                  <EditableBlock
                    value={row.labelEditValue ?? row.label}
                    onChange={(value) => onTextOverride(row.labelEditKey!, value)}
                    className="min-h-[1.5rem] px-1 py-0.5"
                    multiline={false}
                    placeholder="عنوان الحقل"
                  />
                ) : (
                  row.label
                )}
              </th>
              <td className="whitespace-pre-wrap px-3 py-2 align-top font-semibold leading-6 text-slate-800">
                {row.editKey && onTextOverride ? (
                  <EditableBlock
                    value={row.editValue ?? ""}
                    onChange={(value) => onTextOverride(row.editKey!, value)}
                    dir={row.dir ?? "rtl"}
                    className="min-h-[1.5rem] px-1 py-0.5"
                    placeholder="—"
                  />
                ) : (
                  row.value
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportTextPanel({
  title,
  titleEditKey,
  value,
  editKey,
  onTextOverride,
}: {
  title: string;
  titleEditKey?: string;
  value: string | null | undefined;
  editKey?: string;
  onTextOverride?: (key: string, value: string) => void;
}) {
  const text = value?.trim();
  if (!text && !editKey) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/85 px-3 py-3 text-[12px] leading-7 text-slate-800">
      <div className="font-black text-[#0C447C]">
        {titleEditKey && onTextOverride ? (
          <EditableBlock
            value={title}
            onChange={(next) => onTextOverride(titleEditKey, next)}
            className="min-h-[1.5rem] px-1 py-0.5"
            multiline={false}
            placeholder="عنوان الحقل"
          />
        ) : (
          title
        )}
      </div>
      {editKey && onTextOverride ? (
        <EditableBlock
          value={value ?? ""}
          onChange={(next) => onTextOverride(editKey, next)}
          className="mt-1 min-h-[2rem] font-medium"
          placeholder="غير محدد"
        />
      ) : (
        <p className="mt-1 whitespace-pre-wrap font-medium">{text}</p>
      )}
    </div>
  );
}

function InsertedReportBlocks({
  anchorId,
  blocks,
  onUpdate,
  onRemove,
}: {
  anchorId: string;
  blocks: MvReportInsertedBlock[];
  onUpdate: (id: string, patch: Partial<MvReportInsertedBlock>) => void;
  onRemove: (id: string) => void;
}) {
  const visible = blocks.filter((block) => block.anchorId === anchorId);
  if (visible.length === 0) return null;

  return (
    <div className="mt-4 space-y-3" data-mv-report-insert-anchor={anchorId}>
      {visible.map((block) => (
        <div
          key={block.id}
          className={cn(
            "group relative rounded-xl border border-transparent px-1 py-1 transition hover:border-sky-100 hover:bg-sky-50/20",
            block.kind === "image" && "bg-white/40",
          )}
        >
          <button
            type="button"
            className="mv-report-chrome absolute left-1 top-1 z-10 hidden h-7 w-7 items-center justify-center rounded-md border border-red-100 bg-white/95 text-red-600 shadow-sm transition hover:bg-red-50 group-hover:flex print:hidden"
            aria-label="حذف العنصر"
            onClick={() => onRemove(block.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          {block.kind === "heading" ? (
            <input
              dir="rtl"
              value={block.content ?? ""}
              onChange={(event) => onUpdate(block.id, { content: event.target.value })}
              className="w-full rounded-lg border border-sky-100 bg-white/90 px-3 py-2 text-right text-[17px] font-black leading-snug text-[#0C447C] outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          ) : block.kind === "paragraph" ? (
            <textarea
              dir="rtl"
              value={block.content ?? ""}
              onChange={(event) => onUpdate(block.id, { content: event.target.value })}
              rows={5}
              className="min-h-32 w-full resize-y rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-right text-[12px] font-medium leading-7 text-slate-800 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            />
          ) : (
            <figure className="space-y-2 rounded-xl border border-slate-200 bg-white/85 p-2">
              {block.imageDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={block.imageDataUrl}
                  alt=""
                  className="mx-auto block max-h-[160mm] max-w-full rounded-lg object-contain"
                />
              ) : (
                <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center text-[12px] font-bold text-slate-500">
                  لم يتم تحميل الصورة بعد
                </div>
              )}
              <EditableBlock
                value={block.caption ?? ""}
                onChange={(value) => onUpdate(block.id, { caption: value })}
                className="min-h-[1.5rem] text-center text-[11px] font-semibold text-slate-600"
                placeholder="تعليق الصورة"
              />
            </figure>
          )}
        </div>
      ))}
    </div>
  );
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
  resolveImageSrc?: (src: string) => string;
  moveImage: (fileId: string, direction: -1 | 1) => void;
  hideImage: (fileId: string) => void;
  navigate: (href: string) => void;
  editableSections: MvReportEditableSection[];
  updateEditableSection: (id: string, patch: Partial<MvReportEditableSection>) => void;
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
  resolveImageSrc,
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
  const fallbackReferenceLabel = project?._id ? String(project._id).slice(-12) : projectId;
  const textOverrides = reportData.reportTextOverrides ?? {};
  const hasTextOverride = (key: string) => Object.prototype.hasOwnProperty.call(textOverrides, key);
  const editableText = (key: string, fallback: string) => (hasTextOverride(key) ? textOverrides[key] ?? "" : fallback);
  const setTextOverride = (key: string, value: string) => {
    onReportDataPatch({
      reportTextOverrides: {
        ...textOverrides,
        [key]: value,
      },
    });
  };
  const labelText = (key: string, fallback: string) => editableText(`label.${key}`, fallback);
  const labelRow = (
    key: string,
    fallback: string,
    row: Omit<ReportInfoRow, "label" | "labelEditKey" | "labelEditValue">,
  ): ReportInfoRow => ({
    ...row,
    label: labelText(key, fallback),
    labelEditKey: `label.${key}`,
    labelEditValue: labelText(key, fallback),
  });
  const editableLabel = (key: string, fallback: string) => (
    <EditableBlock
      value={labelText(key, fallback)}
      onChange={(value) => setTextOverride(`label.${key}`, value)}
      className="inline-block min-w-[3.5rem] px-1 align-baseline text-[#0C447C]/80"
      multiline={false}
      placeholder="عنوان الحقل"
    />
  );
  const referenceLabel = editableText("reportReference", textValue(reportData.reportReference, fallbackReferenceLabel));
  const reportTitle = editableText("reportTitle", textValue(reportData.reportTitle, "تقرير تقييم معدات وآلات"));
  const { logoSrc } = companyBrand;
  const companyName = editableText("valuationFirmName", textValue(reportData.valuationFirmName, companyBrand.name));
  const fallbackInspectionLocation = inspectionLocationText?.trim() || "غير محدد";
  const effectiveInspectionLocation = editableText(
    "inspectionLocation",
    textValue(reportData.inspectionLocation, fallbackInspectionLocation),
  );
  const effectiveInspectionMapUrl = editableText("inspectionMapUrl", reportData.inspectionMapUrl?.trim() || inspectionMapUrl);
  const effectiveCurrencyLabel = editableText("currencyLabel", textValue(reportData.currencyLabel, "الريال السعودي (ر.س)"));
  const leadValuerName =
    editableText("leadValuerName", reportData.leadValuerName?.trim() || primarySignatory?.name?.trim() || "");
  const projectDisplayName = editableText("projectName", projectName);
  const clientName = editableText("clientName", textValue(reportData.clientName));
  const clientPhone = editableText("clientPhone", textValue(reportData.clientPhone, ""));
  const clientEmail = editableText("clientEmail", textValue(reportData.clientEmail, ""));
  const clientRepresentativeName = editableText(
    "clientRepresentativeName",
    textValue(reportData.clientRepresentativeName, ""),
  );
  const valuationFirmLicense = editableText(
    "valuationFirmLicense",
    textValue(reportData.valuationFirmLicense, ""),
  );
  const reportTeamRows = (reportData.valuationTeam ?? []).filter((row) =>
    Boolean(row.name?.trim() || row.title?.trim() || row.membershipNo?.trim() || row.role?.trim()),
  );
  const sheetDraft = draftWatermark;

  const receivedClientDocumentsHtml =
    reportData.receivedClientDocumentsHtml?.trim() || MV_DEFAULT_RECEIVED_CLIENT_DOCUMENTS_HTML;
  const sceRegistrationHtml =
    reportData.sceRegistrationCertificateHtml?.trim() || MV_DEFAULT_SCE_REGISTRATION_HTML;

  const assetColumnsPerPage = Math.max(1, Math.floor(100 / Math.max(assetImageWidth, 1)));
  const assetRowsPerPage = assetColumnsPerPage <= 1 ? 1 : 3;
  const assetPhotoChunks = chunkArray(orderedImages, Math.max(1, assetColumnsPerPage * assetRowsPerPage));

  const valuationSheets = includeValuationAccountImages
    ? MV_VALUATION_ACCOUNTING_APPROACHES.flatMap((approach) => {
        const imgs = valuationAccountImages.filter((im) => im.approachId === approach.id);
        return imgs.map((image) => ({ approach, image }));
      })
    : [];
  const editableCompanyNameNode = (
    <EditableBlock
      value={companyName}
      onChange={(value) => setTextOverride("valuationFirmName", value)}
      className="mx-auto max-w-full text-center"
      placeholder="اسم الشركة"
    />
  );
  const insertedBlocks = reportData.reportInsertedBlocks ?? [];
  const insertedBlocksRef = useRef<MvReportInsertedBlock[]>(insertedBlocks);
  const [insertMenu, setInsertMenu] = useState<{ anchorId: string; x: number; y: number } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pendingImageAnchorRef = useRef<string>("report-cover");

  useLayoutEffect(() => {
    insertedBlocksRef.current = insertedBlocks;
  }, [insertedBlocks]);

  const updateInsertedBlocks = (next: MvReportInsertedBlock[]) => {
    insertedBlocksRef.current = next;
    onReportDataPatch({ reportInsertedBlocks: next });
  };

  const addInsertedBlock = (anchorId: string, kind: MvReportInsertedBlockKind, imageDataUrl?: string) => {
    const block: MvReportInsertedBlock = {
      id: newReportBlockId(),
      anchorId,
      kind,
      ...(kind === "heading"
        ? { content: "" }
        : kind === "paragraph"
          ? { content: "" }
          : { imageDataUrl: imageDataUrl ?? "", caption: "" }),
    };
    updateInsertedBlocks([...insertedBlocksRef.current, block]);
    setInsertMenu(null);
  };

  const updateInsertedBlock = (id: string, patch: Partial<MvReportInsertedBlock>) => {
    updateInsertedBlocks(insertedBlocksRef.current.map((block) => (block.id === id ? { ...block, ...patch } : block)));
  };

  const removeInsertedBlock = (id: string) => {
    updateInsertedBlocks(insertedBlocksRef.current.filter((block) => block.id !== id));
  };

  const insertedAfter = (anchorId: string) => (
    <InsertedReportBlocks
      anchorId={anchorId}
      blocks={insertedBlocks}
      onUpdate={updateInsertedBlock}
      onRemove={removeInsertedBlock}
    />
  );

  const editableHeading = (key: string, fallback: string) =>
    sectionHeading(editableText(`heading.${key}`, fallback), (value) => setTextOverride(`heading.${key}`, value));

  const openInsertMenu = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (
      target.closest(
        '[contenteditable="true"], input, textarea, select, button, a, .mv-report-chrome, [data-mv-report-insert-menu]',
      )
    ) {
      return;
    }
    const selection = typeof window !== "undefined" ? window.getSelection() : null;
    if (selection && !selection.isCollapsed) return;
    event.preventDefault();
    const anchorEl = target.closest<HTMLElement>("[data-mv-report-insert-anchor]");
    const sheetAnchorEl = target
      .closest<HTMLElement>("[data-mv-report-sheet]")
      ?.querySelector<HTMLElement>("[data-mv-report-insert-anchor]");
    const anchorId =
      anchorEl?.dataset.mvReportInsertAnchor ||
      sheetAnchorEl?.dataset.mvReportInsertAnchor ||
      sheetAnchorEl?.id;
    if (!anchorId) return;
    const menuWidth = 208;
    const menuHeight = 160;
    setInsertMenu({
      anchorId,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    });
  };

  const chooseImageForAnchor = (anchorId: string) => {
    pendingImageAnchorRef.current = anchorId;
    setInsertMenu(null);
    imageInputRef.current?.click();
  };

  useEffect(() => {
    if (!insertMenu) return;
    const closeMenu = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-mv-report-insert-menu]")) setInsertMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setInsertMenu(null);
    };
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [insertMenu]);

  const insertMenuNode =
    insertMenu && typeof document !== "undefined"
      ? createPortal(
          <div
            className="mv-report-chrome fixed z-[520] w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 text-right shadow-xl shadow-slate-900/15 ring-1 ring-slate-900/5 print:hidden"
            style={{ left: insertMenu.x, top: insertMenu.y }}
            data-mv-report-insert-menu
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-extrabold text-slate-800 hover:bg-sky-50 hover:text-sky-900"
              onClick={() => addInsertedBlock(insertMenu.anchorId, "heading")}
            >
              <Heading2 className="h-4 w-4" />
              إضافة عنوان
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-extrabold text-slate-800 hover:bg-sky-50 hover:text-sky-900"
              onClick={() => addInsertedBlock(insertMenu.anchorId, "paragraph")}
            >
              <FileText className="h-4 w-4" />
              إضافة براجراف
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-extrabold text-slate-800 hover:bg-sky-50 hover:text-sky-900"
              onClick={() => chooseImageForAnchor(insertMenu.anchorId)}
            >
              <ImageIcon className="h-4 w-4" />
              إرفاق صورة
            </button>
            <button
              type="button"
              className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-100 px-2 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-50"
              onClick={() => setInsertMenu(null)}
            >
              <X className="h-3.5 w-3.5" />
              إغلاق
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      dir="rtl"
      className="mx-auto flex w-max flex-col items-center text-right"
      style={{ gap: sectionGap }}
      onContextMenuCapture={openInsertMenu}
      onClickCapture={(event) => {
        const target = event.target as HTMLElement | null;
        if (insertMenu && !target?.closest("[data-mv-report-insert-menu]")) setInsertMenu(null);
      }}
    >
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          void readInsertedReportImageDataUrl(file)
            .then((dataUrl) => {
              if (dataUrl) addInsertedBlock(pendingImageAnchorRef.current, "image", dataUrl);
            })
            .catch(() => undefined);
        }}
      />
      {insertMenuNode}
      <MvReportPageShell
        variant="cover"
        companyName={companyName}
        companyNameNode={editableCompanyNameNode}
        logoSrc={logoSrc}
        footerLines={reportFooterLines}
        draftWatermark={sheetDraft}
      >
        <div id="report-cover" data-mv-report-insert-anchor="report-cover" className="w-full max-w-lg space-y-5">
          <EditableBlock
            value={reportTitle}
            onChange={(value) => setTextOverride("reportTitle", value)}
            className="px-2 py-2 text-[24px] font-black leading-tight text-[#0a1f33] sm:text-[30px]"
            placeholder="عنوان التقرير"
          />
          <EditableBlock
            value={editableText("coverSubtitle", "تقرير مهني مبسط للآلات والمعدات")}
            onChange={(value) => setTextOverride("coverSubtitle", value)}
            className="mx-auto max-w-md px-2 text-center text-[14px] font-extrabold leading-7 text-[#0C447C]/80"
            placeholder="العنوان الفرعي"
          />
          <div className="rounded-2xl border border-[#0C447C]/15 bg-white/90 px-4 py-5 text-right shadow-sm ring-1 ring-sky-100/80 backdrop-blur-sm">
            <div className="grid gap-3 text-[12px] font-bold leading-7 text-slate-800 sm:grid-cols-2">
              <div>
                {editableLabel("cover.clientName", "العميل:")}{" "}
                <EditableBlock
                  value={clientName}
                  onChange={(value) => setTextOverride("clientName", value)}
                  className="inline-block min-w-[6rem] px-1 align-baseline"
                  multiline={false}
                  placeholder="اسم العميل"
                />
              </div>
              <div className="text-right">
                {editableLabel("cover.reportReference", "المرجع:")}{" "}
                <EditableBlock
                  value={referenceLabel}
                  onChange={(value) => setTextOverride("reportReference", value)}
                  className="inline-block min-w-[5rem] px-1 text-left align-baseline [unicode-bidi:plaintext]"
                  dir="ltr"
                  multiline={false}
                  placeholder="رقم المرجع"
                />
              </div>
              <div>
                {editableLabel("cover.reportIssueDate", "تاريخ الإصدار:")}{" "}
                <EditableBlock
                  value={editableText("reportIssueDateDisplay", dateValue(reportData.reportIssueDate))}
                  onChange={(value) => setTextOverride("reportIssueDateDisplay", value)}
                  className="inline-block min-w-[6rem] px-1 align-baseline"
                  multiline={false}
                  placeholder="تاريخ الإصدار"
                />
              </div>
              <div>
                {editableLabel("cover.leadValuerName", "المقيّم (ممثل):")}{" "}
                <EditableBlock
                  value={leadValuerName || "—"}
                  onChange={(value) => setTextOverride("leadValuerName", value)}
                  className="inline-block min-w-[5rem] px-1 align-baseline"
                  multiline={false}
                  placeholder="اسم المقيم"
                />
              </div>
              <div>
                {editableLabel("cover.valuationFirmLicense", "ترخيص شركة التقييم:")}{" "}
                <EditableBlock
                  value={valuationFirmLicense}
                  onChange={(value) => setTextOverride("valuationFirmLicense", value)}
                  className="inline-block min-w-[5rem] px-1 text-left align-baseline [unicode-bidi:plaintext]"
                  dir="ltr"
                  multiline={false}
                  placeholder="رقم الترخيص"
                />
              </div>
              <div>
                {editableLabel("cover.clientRepresentativeName", "ممثل العميل:")}{" "}
                <EditableBlock
                  value={clientRepresentativeName}
                  onChange={(value) => setTextOverride("clientRepresentativeName", value)}
                  className="inline-block min-w-[5rem] px-1 align-baseline"
                  multiline={false}
                  placeholder="ممثل العميل"
                />
              </div>
              <div className="sm:col-span-2">
                {editableLabel("cover.projectName", "المشروع:")}{" "}
                <EditableBlock
                  value={projectDisplayName}
                  onChange={(value) => setTextOverride("projectName", value)}
                  className="inline-block min-w-[8rem] px-1 align-baseline"
                  multiline={false}
                  placeholder="اسم المشروع"
                />
              </div>
              <div className="sm:col-span-2 text-[11px] font-semibold text-slate-600">
                <EditableBlock
                  value={editableText(
                    "clientContactLine",
                    [clientPhone, clientEmail].filter(Boolean).join(" · "),
                  )}
                  onChange={(value) => setTextOverride("clientContactLine", value)}
                  className="min-h-[1.5rem] px-1"
                  multiline={false}
                  placeholder="بيانات التواصل"
                />
              </div>
            </div>
          </div>
          <EditableBlock
            value={editableText("coverConfidentialityNote", "وثيقة مهنية — يُراعى سرية الاستخدام وفق نطاق الاتفاق.")}
            onChange={(value) => setTextOverride("coverConfidentialityNote", value)}
            className="text-[10px] font-bold text-slate-500"
            placeholder="ملاحظة الغلاف"
          />
          {insertedAfter("report-cover")}
        </div>
      </MvReportPageShell>

      <MvReportPageShell
        variant="interior"
        orientation="portrait"
        companyName={companyName}
        companyNameNode={editableCompanyNameNode}
        logoSrc={logoSrc}
        footerLines={reportFooterLines}
        draftWatermark={sheetDraft}
      >
        <section id="report-toc" data-mv-report-insert-anchor="report-toc" className="scroll-mt-4">
          <EditableBlock
            value={editableText("heading.report-toc", "الفهرس")}
            onChange={(value) => setTextOverride("heading.report-toc", value)}
            className="text-center text-[20px] font-black text-[#0C447C]"
            multiline={false}
            placeholder="عنوان الفهرس"
          />
          <EditableBlock
            value={editableText("paragraph.report-toc-note", "أرقام الصفحة مرتبطة بترقيم الصفحات في التقرير (يشمل الغلاف).")}
            onChange={(value) => setTextOverride("paragraph.report-toc-note", value)}
            className="mx-auto mt-2 max-w-2xl text-center text-[10px] font-semibold text-slate-500"
            placeholder="وصف الفهرس"
          />
          <div className="mt-4 overflow-x-hidden rounded-xl border border-[#0C447C]/12 bg-white/60">
            <table className="w-full min-w-[300px] border-collapse text-[11px]">
              <thead>
                <tr className="border-b-2 border-[#0C447C] bg-sky-50/80">
                  <th className="w-12 px-2 py-2 text-right text-[10px] font-black text-[#0C447C]">
                    <EditableBlock
                      value={labelText("toc.num", "رقم")}
                      onChange={(value) => setTextOverride("label.toc.num", value)}
                      className="min-h-[1.25rem]"
                      multiline={false}
                    />
                  </th>
                  <th className="px-2 py-2 text-right text-[10px] font-black text-[#0C447C]">
                    <EditableBlock
                      value={labelText("toc.item", "البند")}
                      onChange={(value) => setTextOverride("label.toc.item", value)}
                      className="min-h-[1.25rem]"
                      multiline={false}
                    />
                  </th>
                  <th className="w-14 px-2 py-2 text-center text-[10px] font-black text-[#0C447C]">
                    <EditableBlock
                      value={labelText("toc.page", "صفحة")}
                      onChange={(value) => setTextOverride("label.toc.page", value)}
                      className="min-h-[1.25rem] text-center"
                      multiline={false}
                    />
                  </th>
                </tr>
              </thead>
              <tbody>
                {MV_REPORT_TOC_ROWS.map((row) => (
                  <tr key={`${row.num}-${row.title}`} className="border-b border-slate-200/80">
                    <td className="px-2 py-1.5 align-top font-black tabular-nums text-slate-800">{row.num}</td>
                    <td className="px-2 py-1.5 align-top font-semibold text-slate-900">
                      <EditableBlock
                        value={editableText(`toc.${row.anchor}.title`, row.title)}
                        onChange={(value) => setTextOverride(`toc.${row.anchor}.title`, value)}
                        className="min-h-[1.25rem]"
                        multiline={false}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center tabular-nums text-slate-600">
                      <EditableBlock
                        value={editableText(`toc.${row.anchor}.page`, tocApproxPages[row.anchor] ?? "…")}
                        onChange={(value) => setTextOverride(`toc.${row.anchor}.page`, value)}
                        className="min-h-[1.25rem] text-center"
                        dir="ltr"
                        multiline={false}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {insertedAfter("report-toc")}
        </section>
      </MvReportPageShell>

      <MvReportPageShell
        variant="interior"
        companyName={companyName}
        companyNameNode={editableCompanyNameNode}
        logoSrc={logoSrc}
        footerLines={reportFooterLines}
        draftWatermark={sheetDraft}
      >
        <section id="mv-toc-1" data-mv-report-insert-anchor="mv-toc-1" className="space-y-3">
          {editableHeading("mv-toc-1", "1.0 مقدمة")}
          <div className="space-y-3 text-[12px] font-medium leading-7 text-slate-800">
            <EditableBlock
              value={editableText(
                "paragraph.intro",
                `تم إعداد هذا التقرير من قبل ${textValue(companyName, "الجهة المُقيِّمة")} للعميل ${clientName} في إطار العمل على مشروع ${projectDisplayName}، وذلك بغرض ${textValue(reportData.valuationPurpose)} مع مراعاة أساس القيمة المعتمد ${textValue(reportData.valuationBasis || reportData.valuePremise)}.`,
              )}
              onChange={(value) => setTextOverride("paragraph.intro", value)}
              className="leading-7"
            />
          </div>
          <ClearableRichHtmlField html={introExtraHtml} onHtmlChange={onIntroExtraHtml} />
          {insertedAfter("mv-toc-1")}
        </section>
        <section id="mv-toc-2" data-mv-report-insert-anchor="mv-toc-2" className="mt-6">
          {editableHeading("mv-toc-2", "2.0 التواريخ المستخدمة")}
          <ul className="list-disc space-y-1.5 pe-4 text-[12px] font-semibold leading-7 text-slate-800">
            <li>
              <EditableBlock
                value={editableText(
                  "dates.agreement",
                  reportData.agreementDate
                    ? `تاريخ الاتفاقية (نطاق العمل): ${dateValue(reportData.agreementDate)}.`
                    : "تاريخ الاتفاقية: غير محدد — يُضاف من «بيانات التقرير».",
                )}
                onChange={(value) => setTextOverride("dates.agreement", value)}
                className={!reportData.agreementDate && !hasTextOverride("dates.agreement") ? "text-slate-500" : undefined}
              />
            </li>
            <li>
              <EditableBlock
                value={editableText("dates.inspection", `تاريخ المعاينة: ${dateValue(reportData.inspectionDate)}.`)}
                onChange={(value) => setTextOverride("dates.inspection", value)}
              />
            </li>
            <li>
              <EditableBlock
                value={editableText("dates.valuation", `تاريخ التقييم: ${dateValue(reportData.valuationDate)}.`)}
                onChange={(value) => setTextOverride("dates.valuation", value)}
              />
            </li>
            <li>
              <EditableBlock
                value={editableText("dates.issue", `تاريخ إصدار التقرير: ${dateValue(reportData.reportIssueDate)}.`)}
                onChange={(value) => setTextOverride("dates.issue", value)}
              />
            </li>
          </ul>
          {insertedAfter("mv-toc-2")}
        </section>
        <section id="mv-assignment-summary" data-mv-report-insert-anchor="mv-assignment-summary" className="mt-6">
          {editableHeading("mv-assignment-summary", "بيانات التكليف المختصرة")}
          <ReportInfoTable
            onTextOverride={setTextOverride}
            rows={[
              labelRow("assignment.reference", "رقم المرجع", { value: referenceLabel, editKey: "reportReference", editValue: referenceLabel, dir: "ltr" }),
              labelRow("assignment.reportType", "نوع التقرير المهني", { value: reportData.reportTypeLabel, editKey: "reportTypeLabel", editValue: editableText("reportTypeLabel", textValue(reportData.reportTypeLabel, "")) }),
              labelRow("assignment.standards", "المعايير المطبقة", { value: reportData.standardsVersion, editKey: "standardsVersion", editValue: editableText("standardsVersion", textValue(reportData.standardsVersion, "")) }),
              labelRow("assignment.valuationBasis", "أساس القيمة", { value: reportData.valuationBasis, editKey: "valuationBasis", editValue: editableText("valuationBasis", textValue(reportData.valuationBasis, "")) }),
              labelRow("assignment.valuationPurpose", "الغرض من التقييم", { value: reportData.valuationPurpose, editKey: "valuationPurpose", editValue: editableText("valuationPurpose", textValue(reportData.valuationPurpose, "")) }),
              labelRow("assignment.intendedUse", "الاستخدام المستهدف", { value: reportData.intendedUse, editKey: "intendedUse", editValue: editableText("intendedUse", textValue(reportData.intendedUse, "")) }),
              labelRow("assignment.intendedUsers", "المستخدمون المستهدفون", { value: reportData.intendedUsers, editKey: "intendedUsers", editValue: editableText("intendedUsers", textValue(reportData.intendedUsers, "")) }),
              labelRow("assignment.currency", "العملة", { value: effectiveCurrencyLabel, editKey: "currencyLabel", editValue: effectiveCurrencyLabel }),
            ]}
          />
          {insertedAfter("mv-assignment-summary")}
        </section>
      </MvReportPageShell>

      <MvReportPageShell variant="interior" companyName={companyName} companyNameNode={editableCompanyNameNode} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
        <div id="mv-b1" data-mv-report-insert-anchor="mv-b1">
          <ClearableRichHtmlField html={narrativeB1} onHtmlChange={onNarrativeB1} />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ReportInfoTable
              onTextOverride={setTextOverride}
              rows={[
                labelRow("valuer.firmName", "شركة التقييم", { value: companyName, editKey: "valuationFirmName", editValue: companyName }),
                labelRow("valuer.license", "رقم الترخيص", { value: valuationFirmLicense, editKey: "valuationFirmLicense", editValue: valuationFirmLicense, dir: "ltr" }),
                labelRow("valuer.address", "العنوان", { value: reportData.valuationFirmAddress, editKey: "valuationFirmAddress", editValue: editableText("valuationFirmAddress", textValue(reportData.valuationFirmAddress, "")) }),
                labelRow("valuer.leadName", "المقيم المسؤول", { value: leadValuerName, editKey: "leadValuerName", editValue: leadValuerName }),
                labelRow("valuer.leadTitle", "صفة المقيم", { value: reportData.leadValuerTitle, editKey: "leadValuerTitle", editValue: editableText("leadValuerTitle", textValue(reportData.leadValuerTitle, "")) }),
                labelRow("valuer.membershipNo", "رقم العضوية", { value: reportData.leadValuerMembershipNo, editKey: "leadValuerMembershipNo", editValue: editableText("leadValuerMembershipNo", textValue(reportData.leadValuerMembershipNo, "")), dir: "ltr" }),
              ]}
            />
            <ReportInfoTable
              onTextOverride={setTextOverride}
              rows={[
                labelRow("client.name", "العميل", { value: clientName, editKey: "clientName", editValue: clientName }),
                labelRow("client.legalType", "الشكل النظامي", { value: reportData.clientLegalType, editKey: "clientLegalType", editValue: editableText("clientLegalType", textValue(reportData.clientLegalType, "")) }),
                labelRow("client.activity", "النشاط", { value: reportData.clientActivity, editKey: "clientActivity", editValue: editableText("clientActivity", textValue(reportData.clientActivity, "")) }),
                labelRow("client.representative", "ممثل العميل", { value: clientRepresentativeName, editKey: "clientRepresentativeName", editValue: clientRepresentativeName }),
                labelRow("client.representativeRole", "صفة الممثل", { value: reportData.clientRepresentativeRole, editKey: "clientRepresentativeRole", editValue: editableText("clientRepresentativeRole", textValue(reportData.clientRepresentativeRole, "")) }),
                labelRow("client.intendedUsers", "المستخدمون المستهدفون", { value: reportData.intendedUsers, editKey: "intendedUsers", editValue: editableText("intendedUsers", textValue(reportData.intendedUsers, "")) }),
              ]}
            />
          </div>
          {insertedAfter("mv-b1")}
        </div>
      </MvReportPageShell>

      <MvReportPageShell variant="interior" companyName={companyName} companyNameNode={editableCompanyNameNode} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
        <div id="mv-b2" data-mv-report-insert-anchor="mv-b2">
          <ClearableRichHtmlField html={narrativeB2} onHtmlChange={onNarrativeB2} />
          <div className="mt-4 space-y-3">
            <ReportTextPanel
              title={labelText("panel.scopeOfWorkDetails", "تفاصيل نطاق العمل")}
              titleEditKey="label.panel.scopeOfWorkDetails"
              value={editableText("scopeOfWorkDetails", textValue(reportData.scopeOfWorkDetails, ""))}
              editKey="scopeOfWorkDetails"
              onTextOverride={setTextOverride}
            />
            <ReportInfoTable
              onTextOverride={setTextOverride}
              rows={[
                labelRow("scope.valuationBasis", "أساس القيمة", { value: reportData.valuationBasis, editKey: "valuationBasis", editValue: editableText("valuationBasis", textValue(reportData.valuationBasis, "")) }),
                labelRow("scope.valuationBasisDefinition", "تعريف أساس القيمة", { value: reportData.valuationBasisDefinition, editKey: "valuationBasisDefinition", editValue: editableText("valuationBasisDefinition", textValue(reportData.valuationBasisDefinition, "")) }),
                labelRow("scope.valuePremise", "فرضية القيمة", { value: reportData.valuePremise, editKey: "valuePremise", editValue: editableText("valuePremise", textValue(reportData.valuePremise, "")) }),
                labelRow("scope.useRestriction", "قيود الاستخدام والتوزيع", { value: reportData.useRestriction, editKey: "useRestriction", editValue: editableText("useRestriction", textValue(reportData.useRestriction, "")) }),
              ]}
            />
          </div>
          {insertedAfter("mv-b2")}
        </div>
      </MvReportPageShell>

      <MvReportPageShell variant="interior" companyName={companyName} companyNameNode={editableCompanyNameNode} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
        <div id="mv-b3" data-mv-report-insert-anchor="mv-b3">
          <ClearableRichHtmlField html={narrativeB3} onHtmlChange={onNarrativeB3} />
          <div className="mt-4 space-y-3">
            <ReportInfoTable
              onTextOverride={setTextOverride}
              rows={[
                labelRow("sources.externalSpecialistUse", "المختصون الخارجيون", { value: reportData.externalSpecialistUse, editKey: "externalSpecialistUse", editValue: editableText("externalSpecialistUse", textValue(reportData.externalSpecialistUse, "")) }),
                labelRow("sources.esgConsiderations", "اعتبارات ESG", { value: reportData.esgConsiderations, editKey: "esgConsiderations", editValue: editableText("esgConsiderations", textValue(reportData.esgConsiderations, "")) }),
                labelRow("sources.reportType", "نوع التقرير", { value: reportData.reportTypeLabel, editKey: "reportTypeLabel", editValue: editableText("reportTypeLabel", textValue(reportData.reportTypeLabel, "")) }),
              ]}
            />
            <ReportTextPanel
              title={labelText("panel.informationSources", "مصادر المعلومات والمدخلات الرئيسية")}
              titleEditKey="label.panel.informationSources"
              value={editableText("informationSources", textValue(reportData.informationSources, ""))}
              editKey="informationSources"
              onTextOverride={setTextOverride}
            />
          </div>
          {insertedAfter("mv-b3")}
        </div>
      </MvReportPageShell>

      <MvReportPageShell variant="interior" companyName={companyName} companyNameNode={editableCompanyNameNode} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
        <section id="mv-toc-18" data-mv-report-insert-anchor="mv-toc-18">
          {editableHeading("mv-toc-18", "18.0 الأصل محل التقييم")}
          <EditableBlock
            value={editableText(
              "paragraph.assetSubject",
              `يتعلق هذا التقرير بالأصول ضمن نطاق المعاينة والمعلومات المقدمة من العميل${
                assetFolderLabels.length > 0 ? `، بما في ذلك: ${assetFolderLabels.join("، ")}` : ""
              }. التفاصيل والصور في الملحقات.`,
            )}
            onChange={(value) => setTextOverride("paragraph.assetSubject", value)}
            className="text-[12px] font-medium leading-7 text-slate-800"
          />
          <div className="mt-3">
            <ReportTextPanel
              title={labelText("panel.assetSubjectDescription", "وصف الأصل محل التقييم")}
              titleEditKey="label.panel.assetSubjectDescription"
              value={editableText("assetSubjectDescription", textValue(reportData.assetSubjectDescription, ""))}
              editKey="assetSubjectDescription"
              onTextOverride={setTextOverride}
            />
          </div>
          {insertedAfter("mv-toc-18")}
        </section>
        <section id="mv-toc-18-1" data-mv-report-insert-anchor="mv-toc-18-1" className="mt-5">
          {editableHeading("mv-toc-18-1", "18.1 الوصف الجزئي")}
          <EditableBlock
            value={editableText(
              "paragraph.partialDescription",
              "يُعرض الوصف الجزئي وحسابات القيمة في «مرفق 1»، والصور في «مرفق 2»، والمستندات المستلمة من العميل في «مرفق 3»، وبيان شهادة التسجيل في بوابة «تقييم» في «مرفق 4».",
            )}
            onChange={(value) => setTextOverride("paragraph.partialDescription", value)}
            className="text-[12px] font-medium leading-7 text-slate-800"
          />
          <div className="mt-3">
            <ReportTextPanel
              title={labelText("panel.assetDetailedDescription", "الوصف التفصيلي للأصول")}
              titleEditKey="label.panel.assetDetailedDescription"
              value={editableText("assetDetailedDescription", textValue(reportData.assetDetailedDescription, ""))}
              editKey="assetDetailedDescription"
              onTextOverride={setTextOverride}
            />
          </div>
          {insertedAfter("mv-toc-18-1")}
        </section>
        <section id="mv-toc-19" data-mv-report-insert-anchor="mv-toc-19" className="mt-5">
          {editableHeading("mv-toc-19", "19.0 العملة")}
          <EditableBlock
            value={editableText("paragraph.currency", `العملة المعتمدة: ${effectiveCurrencyLabel}.`)}
            onChange={(value) => setTextOverride("paragraph.currency", value)}
            className="text-[12px] font-medium leading-7 text-slate-800"
          />
          {insertedAfter("mv-toc-19")}
        </section>
        <section id="mv-toc-20" data-mv-report-insert-anchor="mv-toc-20" className="mt-5">
          {editableHeading("mv-toc-20", "20.0 المعاينة")}
          <EditableBlock
            value={editableText(
              "paragraph.inspection",
              `تمت المعاينة في ${effectiveInspectionLocation} بتاريخ ${dateValue(reportData.inspectionDate)}${
                effectiveInspectionMapUrl ? ` — ${effectiveInspectionMapUrl}` : ""
              }.`,
            )}
            onChange={(value) => setTextOverride("paragraph.inspection", value)}
            className="break-words text-[12px] font-medium leading-7 text-slate-800"
          />
          {insertedAfter("mv-toc-20")}
        </section>
      </MvReportPageShell>

      <MvReportPageShell variant="interior" companyName={companyName} companyNameNode={editableCompanyNameNode} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
        <div id="mv-b4" data-mv-report-insert-anchor="mv-b4">
          <ClearableRichHtmlField html={narrativeB4} onHtmlChange={onNarrativeB4} />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <ReportTextPanel
              title={labelText("panel.methodologyRationale", "مبررات اختيار المنهجية")}
              titleEditKey="label.panel.methodologyRationale"
              value={editableText("methodologyRationale", textValue(reportData.methodologyRationale, ""))}
              editKey="methodologyRationale"
              onTextOverride={setTextOverride}
            />
            <ReportTextPanel
              title={labelText("panel.costApproachDetails", "تفاصيل تطبيق أسلوب التكلفة")}
              titleEditKey="label.panel.costApproachDetails"
              value={editableText("costApproachDetails", textValue(reportData.costApproachDetails, ""))}
              editKey="costApproachDetails"
              onTextOverride={setTextOverride}
            />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <ReportTextPanel
              title={labelText("panel.importantAssumptions", "إفادات مهمة")}
              titleEditKey="label.panel.importantAssumptions"
              value={editableText("importantAssumptions", textValue(reportData.importantAssumptions, ""))}
              editKey="importantAssumptions"
              onTextOverride={setTextOverride}
            />
            <ReportTextPanel
              title={labelText("panel.specialAssumptions", "إفادات خاصة")}
              titleEditKey="label.panel.specialAssumptions"
              value={editableText("specialAssumptions", textValue(reportData.specialAssumptions, ""))}
              editKey="specialAssumptions"
              onTextOverride={setTextOverride}
            />
          </div>
          {insertedAfter("mv-b4")}
        </div>
      </MvReportPageShell>

      <MvReportPageShell variant="interior" companyName={companyName} companyNameNode={editableCompanyNameNode} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
        <section id="mv-toc-24" data-mv-report-insert-anchor="mv-toc-24">
          {editableHeading("mv-toc-24", "24.0 رأي القيمة")}
          <div className="rounded-xl border-2 border-[#0C447C]/20 bg-gradient-to-l from-sky-50/80 to-white px-4 py-5">
            <EditableBlock
              value={editableText("paragraph.valueOpinion", "بعد الأخذ بالاعتبار البيانات ذات العلاقة والمبادئ المهنية، فإن رأي القيمة يُقدَّر بـ:")}
              onChange={(value) => setTextOverride("paragraph.valueOpinion", value)}
              className="text-[12px] font-semibold leading-7 text-slate-700"
            />
            <EditableBlock
              value={editableText("finalValueDisplay", currencyValue(reportData.finalValue))}
              onChange={(value) => setTextOverride("finalValueDisplay", value)}
              className="mt-3 text-center text-[22px] font-black text-[#0C447C]"
              multiline={false}
              placeholder="القيمة النهائية"
            />
            <EditableBlock
              value={editableText("finalValueWords", textValue(reportData.finalValueWords, ""))}
              onChange={(value) => setTextOverride("finalValueWords", value)}
              className="mt-2 min-h-[1.5rem] text-center text-[13px] font-bold text-slate-700"
              placeholder="القيمة كتابة"
            />
            <EditableBlock
              value={editableText("paragraph.valueCurrency", `العملة: ${effectiveCurrencyLabel}`)}
              onChange={(value) => setTextOverride("paragraph.valueCurrency", value)}
              className="mt-2 text-center text-[11px] font-bold text-slate-500"
              multiline={false}
            />
          </div>
          {reportTeamRows.length > 0 ? (
            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full table-fixed border-collapse text-right text-[11px]">
                <thead>
                  <tr className="bg-sky-50/90">
                    <th className="w-[25%] border-b border-slate-200 px-2 py-2 font-black text-[#0C447C]">
                      <EditableBlock
                        value={labelText("team.name", "الاسم")}
                        onChange={(value) => setTextOverride("label.team.name", value)}
                        className="min-h-[1.5rem]"
                        multiline={false}
                      />
                    </th>
                    <th className="w-[25%] border-b border-slate-200 px-2 py-2 font-black text-[#0C447C]">
                      <EditableBlock
                        value={labelText("team.title", "الصفة")}
                        onChange={(value) => setTextOverride("label.team.title", value)}
                        className="min-h-[1.5rem]"
                        multiline={false}
                      />
                    </th>
                    <th className="w-[18%] border-b border-slate-200 px-2 py-2 font-black text-[#0C447C]">
                      <EditableBlock
                        value={labelText("team.membershipNo", "رقم العضوية")}
                        onChange={(value) => setTextOverride("label.team.membershipNo", value)}
                        className="min-h-[1.5rem]"
                        multiline={false}
                      />
                    </th>
                    <th className="border-b border-slate-200 px-2 py-2 font-black text-[#0C447C]">
                      <EditableBlock
                        value={labelText("team.role", "الدور")}
                        onChange={(value) => setTextOverride("label.team.role", value)}
                        className="min-h-[1.5rem]"
                        multiline={false}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reportTeamRows.map((row) => (
                    <tr key={row.id}>
                      <td className="border-b border-slate-100 px-2 py-2 align-top font-bold text-slate-900">
                        <EditableBlock
                          value={editableText(`team.${row.id}.name`, textValue(row.name))}
                          onChange={(value) => setTextOverride(`team.${row.id}.name`, value)}
                          className="min-h-[1.5rem]"
                          multiline={false}
                        />
                      </td>
                      <td className="border-b border-slate-100 px-2 py-2 align-top text-slate-700">
                        <EditableBlock
                          value={editableText(`team.${row.id}.title`, textValue(row.title))}
                          onChange={(value) => setTextOverride(`team.${row.id}.title`, value)}
                          className="min-h-[1.5rem]"
                          multiline={false}
                        />
                      </td>
                      <td className="border-b border-slate-100 px-2 py-2 align-top text-left tabular-nums text-slate-700" dir="ltr">
                        <EditableBlock
                          value={editableText(`team.${row.id}.membershipNo`, textValue(row.membershipNo))}
                          onChange={(value) => setTextOverride(`team.${row.id}.membershipNo`, value)}
                          className="min-h-[1.5rem] text-left"
                          dir="ltr"
                          multiline={false}
                        />
                      </td>
                      <td className="border-b border-slate-100 px-2 py-2 align-top text-slate-700">
                        <EditableBlock
                          value={editableText(`team.${row.id}.role`, textValue(row.role))}
                          onChange={(value) => setTextOverride(`team.${row.id}.role`, value)}
                          className="min-h-[1.5rem]"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {preparerDisplayRows.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] font-semibold text-slate-500">
                لا صفوف من لوحة الشركة — أضف مقيّمين وتوقيعات من لوحة إدارة الشركة.
              </p>
            ) : (
              <table className="w-full table-fixed border-collapse text-right text-[11px]">
                <thead>
                  <tr className="bg-sky-50/90">
                    <th className="w-[42%] border-b border-slate-200 px-2 py-2 font-black text-[#0C447C]">
                      <EditableBlock
                        value={labelText("preparer.nameAndRole", "المقيّم والدور")}
                        onChange={(value) => setTextOverride("label.preparer.nameAndRole", value)}
                        className="min-h-[1.5rem]"
                        multiline={false}
                      />
                    </th>
                    <th className="border-b border-slate-200 px-2 py-2 font-black text-[#0C447C]">
                      <EditableBlock
                        value={labelText("preparer.signature", "التوقيع")}
                        onChange={(value) => setTextOverride("label.preparer.signature", value)}
                        className="min-h-[1.5rem]"
                        multiline={false}
                      />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preparerDisplayRows.map((row) => (
                    <tr key={row.id}>
                      <td className="border-b border-slate-100 p-0 align-top">
                        <div className="flex flex-col gap-1 px-2 py-2">
                          <EditableBlock
                            dir="rtl"
                            value={row.name}
                            onChange={(value) => updatePreparerField(row.id, "name", value)}
                            className="mv-report-preparer-field min-h-8 w-full rounded border border-slate-200 bg-white px-2 py-1 text-[12px] font-semibold outline-none focus:border-sky-400 print:border-0"
                            multiline={false}
                          />
                          <EditableBlock
                            dir="rtl"
                            value={row.roleLabel}
                            onChange={(value) => updatePreparerField(row.id, "roleLabel", value)}
                            className="mv-report-preparer-field min-h-7 w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] outline-none focus:border-sky-400 print:border-0"
                            multiline={false}
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
          {insertedAfter("mv-toc-24")}
        </section>
      </MvReportPageShell>

      <InsertSectionCue onAdd={addEditableSection} />

      {editableSections.map((section) => (
        <Fragment key={section.id}>
          <MvReportPageShell variant="interior" companyName={companyName} companyNameNode={editableCompanyNameNode} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
            <SectionShell
              id={`custom:${section.id}`}
              title={
                <EditableBlock
                  dir="rtl"
                  value={section.title}
                  onChange={(value) => updateEditableSection(section.id, { title: value })}
                  className="w-full max-w-full rounded-lg border border-transparent bg-sky-50/30 px-2 py-1 text-right text-[17px] font-black outline-none focus:border-sky-300 focus:bg-white"
                  multiline={false}
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
              <ClearableRichHtmlField
                html={section.body}
                onHtmlChange={(next) => updateEditableSection(section.id, { body: next })}
              />
              {insertedAfter(`custom:${section.id}`)}
            </SectionShell>
          </MvReportPageShell>
          <InsertSectionCue onAdd={addEditableSection} />
        </Fragment>
      ))}

      {!includeValuationAccountImages ? (
        <MvReportPageShell variant="interior" companyName={companyName} companyNameNode={editableCompanyNameNode} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
          <SectionShell
            id="mv-annex-1"
            title={
              <EditableBlock
                value={editableText("heading.mv-annex-1", "مرفق 1: الوصف الجزئي وحسابات القيمة")}
                onChange={(value) => setTextOverride("heading.mv-annex-1", value)}
                className="min-h-[1.75rem]"
                multiline={false}
              />
            }
          >
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-[12px] font-extrabold text-amber-900">
              تم إيقاف عرض صور إجراءات التقييم من خطوة إجراءات التقييم.
            </div>
            {insertedAfter("mv-annex-1")}
          </SectionShell>
        </MvReportPageShell>
      ) : valuationAccountImages.length === 0 ? (
        <MvReportPageShell variant="interior" companyName={companyName} companyNameNode={editableCompanyNameNode} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
          <SectionShell
            id="mv-annex-1"
            title={
              <EditableBlock
                value={editableText("heading.mv-annex-1", "مرفق 1: الوصف الجزئي وحسابات القيمة")}
                onChange={(value) => setTextOverride("heading.mv-annex-1", value)}
                className="min-h-[1.75rem]"
                multiline={false}
              />
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
            {insertedAfter("mv-annex-1")}
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
            resolveImageSrc={resolveImageSrc}
            insertedBlocksNode={insertedAfter(vIdx === 0 ? "mv-annex-1" : `mv-annex-1-${vIdx}`)}
            titleNode={
              <EditableBlock
                value={editableText(
                  vIdx === 0 ? "heading.mv-annex-1" : `heading.mv-annex-1-${vIdx}`,
                  vIdx === 0 ? `مرفق 1: ${approach.label}` : `مرفق 1: ${approach.label} (تتمة — صورة ${vIdx + 1})`,
                )}
                onChange={(value) =>
                  setTextOverride(vIdx === 0 ? "heading.mv-annex-1" : `heading.mv-annex-1-${vIdx}`, value)
                }
                className="min-h-[1.75rem] text-[14px]"
                multiline={false}
              />
            }
          />
        ))
      )}

      {assetPhotoChunks.map((chunk, chunkIdx) => (
        <MvReportPageShell
          key={`assets-${chunkIdx}`}
          variant="interior"
          companyName={companyName}
          companyNameNode={editableCompanyNameNode}
          logoSrc={logoSrc}
          footerLines={reportFooterLines}
        draftWatermark={sheetDraft}
        >
          <SectionShell
            id={chunkIdx === 0 ? "mv-annex-2" : `mv-annex-2-${chunkIdx}`}
            title={
              <EditableBlock
                value={editableText(
                  chunkIdx === 0 ? "heading.mv-annex-2" : `heading.mv-annex-2-${chunkIdx}`,
                  chunkIdx === 0 ? "مرفق 2: صور الأصول" : `مرفق 2 (تتمة ${chunkIdx + 1})`,
                )}
                onChange={(value) =>
                  setTextOverride(chunkIdx === 0 ? "heading.mv-annex-2" : `heading.mv-annex-2-${chunkIdx}`, value)
                }
                className="min-h-[1.75rem]"
                multiline={false}
              />
            }
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
              <div
                className="flex flex-wrap gap-0 p-0"
                style={{ columnGap: imageInnerGap, rowGap: imageGroupGap }}
              >
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
                        src={resolveImageSrc ? resolveImageSrc(downloadHref(projectId, file)) : downloadHref(projectId, file)}
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
            {insertedAfter(chunkIdx === 0 ? "mv-annex-2" : `mv-annex-2-${chunkIdx}`)}
          </SectionShell>
        </MvReportPageShell>
      ))}

      <MvReportPageShell
        variant="interior"
        companyName={companyName}
        companyNameNode={editableCompanyNameNode}
        logoSrc={logoSrc}
        footerLines={reportFooterLines}
        draftWatermark={sheetDraft}
      >
        <SectionShell
          id="mv-annex-3"
          title={
            <EditableBlock
              value={editableText("heading.mv-annex-3", "مرفق 3: مستندات مستلمة من العميل")}
              onChange={(value) => setTextOverride("heading.mv-annex-3", value)}
              className="min-h-[1.75rem]"
              multiline={false}
            />
          }
        >
          <ClearableRichHtmlField
            html={receivedClientDocumentsHtml}
            onHtmlChange={(next) => onReportDataPatch({ receivedClientDocumentsHtml: next })}
            emptyHtml={EMPTY_RICH_HTML}
          />
          {insertedAfter("mv-annex-3")}
        </SectionShell>
      </MvReportPageShell>

      <MvReportPageShell
        variant="interior"
        companyName={companyName}
        companyNameNode={editableCompanyNameNode}
        logoSrc={logoSrc}
        footerLines={reportFooterLines}
        draftWatermark={sheetDraft}
      >
        <SectionShell
          id="mv-annex-sce"
          title={
            <EditableBlock
              value={editableText(
                "heading.mv-annex-sce",
                "شهادة التسجيل في بوابة الخدمات الإلكترونية للهيئة السعودية للمقيمين المعتمدين «تقييم»",
              )}
              onChange={(value) => setTextOverride("heading.mv-annex-sce", value)}
              className="min-h-[1.75rem] text-[14px] font-black leading-snug text-[#0a1f33]"
              multiline={false}
            />
          }
        >
          <ClearableRichHtmlField
            html={sceRegistrationHtml}
            onHtmlChange={(next) => onReportDataPatch({ sceRegistrationCertificateHtml: next })}
            emptyHtml={EMPTY_RICH_HTML}
          />
          {insertedAfter("mv-annex-sce")}
        </SectionShell>
      </MvReportPageShell>

      <InsertSectionCue onAdd={addEditableSection} />
    </div>
  );
}
