"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ClipboardEvent,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ArrowUp, EyeOff, FileText, GripVertical, Heading2, ImageIcon, RotateCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  MvDriveFile,
  MvProject,
  MvProjectReportData,
  MvCompanyAiReportTemplate,
  MvCompanyReportLetterheadTemplate,
  MvReportEditableSection,
  MvReportInsertedBlock,
  MvReportInsertedBlockKind,
  MvReportPageOrientationPreference,
} from "./types";
import {
  buildAiReportFlowChildren,
  type MvAiReportTopicKey,
  type MvAiVariableContext,
} from "./mv-ai-report-sections";
import type { MvReportTocRow } from "./mv-valuation-report-toc";
import {
  MV_VALUATION_ACCOUNTING_APPROACHES,
  type MvValuationAccountingImage,
} from "./mv-valuation-accounting-store";
import {
  resolveClientDocumentImageSrc,
  type MvClientDocumentImage,
} from "./mv-client-documents-store";
import { ReportRichHtmlField } from "./mv-report-rich-selection-toolbar";
import { MV_REPORT_CHAPTERS, MV_REPORT_TOC_ROWS, mvReportAnnexHeading, mvReportTocHeading } from "./mv-valuation-report-toc";
import {
  MV_DEFAULT_ASSET_SUMMARY_TEXT,
  MV_DEFAULT_EXCLUSIONS_TEXT,
  MV_DEFAULT_RECEIVED_CLIENT_DOCUMENTS_HTML,
  MV_DEFAULT_SCE_REGISTRATION_HTML,
  MV_DEFAULT_VALUATION_PROCEDURES_TEXT,
} from "./mv-valuation-report-narrative-defaults";
import { MvValuationAnnexImageSheet } from "./mv-valuation-annex-image-sheet";
import {
  MvReportLetterheadProvider,
  MvReportPageShell,
  MvReportSectionDivider,
} from "./mv-report-page-shell";
import { ReportFlowPages } from "./mv-report-section-group";
import { MvReportTocPages } from "./mv-report-toc-pages";

type ReportSignatureRow = {
  id: string;
  name: string;
  jobTitle: string;
  roleLabel: string;
  membershipNo: string;
  signatureImageDataUrl: string;
  isCompanyAdmin: boolean;
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
  style,
  multiline = true,
  dir = "rtl",
  placeholder,
  onDelete,
  deletable = true,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  style?: CSSProperties;
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
        style={style}
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
      <div className="mb-2 flex shrink-0 flex-wrap items-end justify-between gap-2">
        <div
          className="min-w-0 flex-1 text-right text-[17px] font-black leading-tight text-[#0a1f33] sm:text-[19px]"
          style={{ letterSpacing: 0 }}
        >
          {title}
        </div>
        {headerExtra ? <div className="mv-report-chrome shrink-0 print:hidden">{headerExtra}</div> : null}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

function PageRotateButton({
  orientation,
  onClick,
  label = "تدوير الصفحة",
}: {
  orientation: MvReportPageOrientationPreference;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mv-report-chrome inline-flex h-7 items-center gap-1 rounded-md border border-sky-100 bg-white/95 px-2 text-[10.5px] font-black text-sky-900 shadow-sm transition hover:bg-sky-50 print:hidden"
      title={orientation === "landscape" ? "تحويل الصفحة إلى طول" : "تحويل الصفحة إلى عرض"}
      aria-label={label}
    >
      <RotateCw className="h-3.5 w-3.5" />
      {orientation === "landscape" ? "طول" : "عرض"}
    </button>
  );
}

/**
 * صورة أصل واحدة داخل المرفق 2 — مع دعم السحب والإفلات لإعادة الترتيب
 * وزر حذف عند التمرير. لا توجد أسهم في الأعلى — الترتيب يتم بالسحب فقط.
 */
function AssetPhotoFigure({
  file,
  projectId,
  widthPercent,
  widthCss,
  cornerRadius,
  resolveImageSrc,
  onReorder,
  onDelete,
  pageOrientation,
  onRotatePage,
  uniformSize,
}: {
  file: MvDriveFile;
  projectId: string;
  widthPercent: number;
  widthCss?: string;
  cornerRadius: number;
  resolveImageSrc?: (src: string) => string;
  onReorder: (fromId: string, toId: string) => void;
  onDelete: () => void;
  pageOrientation: MvReportPageOrientationPreference;
  onRotatePage: () => void;
  uniformSize: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const src = resolveImageSrc ? resolveImageSrc(downloadHref(projectId, file)) : downloadHref(projectId, file);
  const maxImageHeightMm = widthPercent >= 80 ? (pageOrientation === "landscape" ? 148 : 232) : widthPercent >= 50 ? 104 : 68;
  return (
    <figure
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", file._id);
        event.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => {
        setDragging(false);
        setDragOver(false);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const fromId = event.dataTransfer.getData("text/plain");
        if (fromId && fromId !== file._id) onReorder(fromId, file._id);
      }}
      className={cn(
        "group relative break-inside-avoid bg-white transition",
        dragging && "opacity-60",
        dragOver && "ring-2 ring-sky-400 ring-offset-1 ring-offset-white",
      )}
      style={{ width: widthCss ?? `${widthPercent}%` }}
    >
      <div className="mv-report-chrome absolute left-0.5 top-0.5 z-10 flex gap-0.5 opacity-100 lg:opacity-0 lg:transition lg:group-hover:opacity-100">
        <span
          className="flex h-6 w-6 cursor-grab items-center justify-center rounded border border-slate-200 bg-white/95 text-slate-500 shadow-sm active:cursor-grabbing"
          aria-label="اسحب لإعادة الترتيب"
          title="اسحب لإعادة الترتيب"
        >
          <GripVertical className="h-3 w-3" />
        </span>
        <button
          type="button"
          onClick={onRotatePage}
          className="flex h-6 w-6 items-center justify-center rounded border border-sky-100 bg-white/95 text-sky-700 shadow-sm hover:bg-sky-50"
          aria-label="تدوير الصفحة"
          title={pageOrientation === "landscape" ? "تحويل الصفحة إلى طول" : "تحويل الصفحة إلى عرض"}
        >
          <RotateCw className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex h-6 w-6 items-center justify-center rounded border border-red-100 bg-white/95 text-red-600 shadow-sm hover:bg-red-50"
          aria-label="إخفاء الصورة"
          title="إخفاء"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <div
        className={cn(
          "flex w-full items-center justify-center bg-white",
          uniformSize ? "overflow-hidden" : "",
        )}
        style={{
          aspectRatio: uniformSize ? "4 / 3" : undefined,
          maxHeight: uniformSize ? undefined : `${maxImageHeightMm}mm`,
          borderRadius: cornerRadius || "var(--mv-image-radius, 0px)",
          filter: "var(--mv-image-shadow, none)",
        }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          className={cn(
            "block bg-white",
            /* توحيد المساحة: تمطيط لملء الإطار (object-fill) — بدون قصّ وبدون فراغات */
            uniformSize ? "h-full w-full object-fill" : "h-auto w-full object-contain",
          )}
          style={{
            maxHeight: uniformSize ? "100%" : `${maxImageHeightMm}mm`,
            imageRendering: "auto",
          }}
          loading="eager"
        />
      </div>
    </figure>
  );
}

/**
 * Inline "+" cue between any two pages. Clicking inserts a new editable
 * section anchored to `afterAnchorId`. The cue also accepts drag-and-drop of
 * existing custom-section drag handles so users can re-order without leaving
 * the canvas.
 */
/**
 * Renders a single user-added editable section as a full report page, with a
 * drag handle in the heading so it can be re-anchored by dropping on any
 * `InsertSectionCue`. The MvReportPageShell wraps the content so it shares the
 * same paper styling as built-in pages.
 */
function CustomSectionShell({
  section,
  companyName,
  companyNameNode,
  commercialRegistration,
  logoSrc,
  footerLines,
  draftWatermark,
  onTitleChange,
  onNumberChange,
  onBodyChange,
  onRemove,
  insertedAfter,
}: {
  section: MvReportEditableSection;
  companyName: string;
  companyNameNode: ReactNode;
  commercialRegistration?: string;
  logoSrc: string | null;
  footerLines: string[];
  draftWatermark: boolean;
  onTitleChange: (value: string) => void;
  onNumberChange: (value: string) => void;
  onBodyChange: (html: string) => void;
  onRemove: () => void;
  insertedAfter: (anchorId: string) => ReactNode;
}) {
  return (
    <ReportFlowPages
      shellProps={{
        companyName,
        companyNameNode,
        commercialRegistration,
        logoSrc,
        footerLines,
        draftWatermark,
      }}
      measureRevision={`${section.id}:${section.sectionNumber}:${section.title}:${section.body}`}
    >
      <section
        id={`custom:${section.id}`}
        data-mv-report-insert-anchor={`custom:${section.id}`}
        dir="rtl"
        className="scroll-mt-4 text-right"
      >
        <div className="mb-2 flex shrink-0 flex-wrap items-end justify-between gap-2">
          <div
            className="min-w-0 flex-1 text-right text-[17px] font-black leading-tight text-[#0a1f33] sm:text-[19px]"
            style={{ letterSpacing: 0 }}
          >
            <div className="flex items-center gap-2">
            <span
              className="mv-report-chrome flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-md border border-slate-200 bg-white/95 text-slate-500 shadow-sm active:cursor-grabbing print:hidden"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("application/x-mv-custom-section", section.id);
                event.dataTransfer.effectAllowed = "move";
              }}
              aria-label="اسحب لإعادة وضع القسم في مكان آخر"
              title="اسحب لإعادة وضع القسم في مكان آخر"
            >
              <GripVertical className="h-4 w-4" />
            </span>
            <EditableBlock
              dir="ltr"
              value={section.sectionNumber ?? ""}
              onChange={onNumberChange}
              className="w-20 shrink-0 rounded-lg border border-transparent bg-sky-50/30 px-2 py-1 text-center text-[15px] font-black outline-none focus:border-sky-300 focus:bg-white"
              multiline={false}
              placeholder="رقم"
            />
            <EditableBlock
              dir="rtl"
              value={section.title}
              onChange={onTitleChange}
              className="w-full max-w-full rounded-lg border border-transparent bg-sky-50/30 px-2 py-1 text-right text-[17px] font-black outline-none focus:border-sky-300 focus:bg-white"
              multiline={false}
            />
            </div>
          </div>
          <div className="mv-report-chrome shrink-0 print:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600"
            aria-label="حذف القسم"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          </div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ClearableRichHtmlField html={section.body} onHtmlChange={onBodyChange} />
          {insertedAfter(`custom:${section.id}`)}
        </div>
      </section>
    </ReportFlowPages>
  );
}

function InsertSectionCue({
  onAdd,
  afterAnchorId,
  onDropSection,
}: {
  onAdd: (afterAnchorId?: string) => void;
  afterAnchorId?: string;
  onDropSection?: (sectionId: string, afterAnchorId?: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const isDropTarget = !!onDropSection;
  return (
    <div
      className={cn(
        "mv-report-chrome relative py-2 transition print:hidden",
        dragOver && "py-5",
      )}
      onDragOver={
        isDropTarget
          ? (event) => {
              if (!event.dataTransfer.types.includes("application/x-mv-custom-section")) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOver(true);
            }
          : undefined
      }
      onDragLeave={isDropTarget ? () => setDragOver(false) : undefined}
      onDrop={
        isDropTarget
          ? (event) => {
              event.preventDefault();
              setDragOver(false);
              const sectionId = event.dataTransfer.getData("application/x-mv-custom-section");
              if (sectionId) onDropSection?.(sectionId, afterAnchorId);
            }
          : undefined
      }
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-l from-transparent via-slate-200 to-transparent transition",
          dragOver && "h-1 rounded-full bg-sky-300 via-sky-300",
        )}
        aria-hidden
      />
      <div className="relative flex justify-center px-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onAdd(afterAnchorId)}
          className={cn(
            "gap-1.5 border-dashed border-sky-300/80 bg-white/95 px-4 text-[12px] font-extrabold text-sky-950 shadow-sm transition hover:border-sky-400 hover:bg-sky-50",
            dragOver && "border-sky-500 bg-sky-50 text-sky-900",
          )}
        >
          {dragOver ? "إفلات لنقل القسم هنا" : "إضافة قسم للتقرير"}
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

/**
 * يُستخرج رقم عضوية المقيم المعتمد للغلاف من:
 * 1) بيانات المشروع ‎leadValuerMembershipNo‎
 * 2) صف المقيم المطابق لاسمه في «المقيمون والتوقيعات» (‎valuationReportMembershipNo‎ لكل مستخدم)
 * 3) مدير الشركة المحدد صراحةً في إعدادات الشركة
 * 4) المقيم الرئيسي / أي مقيم له رقم / المستخدم الحالي
 */
function resolveLeadValuerMembershipNo(args: {
  reportMembershipNo?: string | null;
  /** ‎users.valuationReportMembershipNo‎ لمدير الشركة — المصدر الأساسي للغلاف */
  companyAdminMembershipNo?: string | null;
  leadValuerName?: string | null;
  preparerRows: ReportSignatureRow[];
  primarySignatory?: ReportSignatureRow;
  currentUserMembershipNo?: string | null;
}): string {
  const fromReport = args.reportMembershipNo?.trim();
  if (fromReport) return fromReport;

  const fromCompanyAdmin = args.companyAdminMembershipNo?.trim();
  if (fromCompanyAdmin) return fromCompanyAdmin;

  const normalize = (value: string) => value.trim().toLowerCase();
  const targetName = normalize(args.leadValuerName ?? "");

  if (targetName) {
    const byName = args.preparerRows.find(
      (row) => normalize(row.name) === targetName && row.membershipNo?.trim(),
    );
    if (byName?.membershipNo?.trim()) return byName.membershipNo.trim();
  }

  const companyManager = args.preparerRows.find(
    (row) => row.isCompanyAdmin && row.membershipNo?.trim(),
  );
  if (companyManager?.membershipNo?.trim()) return companyManager.membershipNo.trim();

  if (args.primarySignatory?.membershipNo?.trim()) return args.primarySignatory.membershipNo.trim();

  const anyWithMembership = args.preparerRows.find((row) => row.membershipNo?.trim());
  if (anyWithMembership?.membershipNo?.trim()) return anyWithMembership.membershipNo.trim();

  return args.currentUserMembershipNo?.trim() ?? "";
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

/**
 * صيغة تاريخ مختصرة لشريط فوتر الغلاف (dd/mm/yyyyم) — مطابقة لتقارير المرجعيات
 * المهنية. عند تعذّر التحويل تُعيد القيمة الأصلية لتجنّب إخفاء معلومة.
 */
function shortDateValue(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}م`;
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

async function readFirstPdfPageAsReportImageDataUrl(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  try {
    const page = await pdf.getPage(1);
    let scale = 2.6;
    let viewport = page.getViewport({ scale });
    const maxPixels = 18_000_000;
    const pixels = viewport.width * viewport.height;
    if (pixels > maxPixels) {
      scale *= Math.sqrt(maxPixels / pixels);
      viewport = page.getViewport({ scale });
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("تعذر تحويل ملف PDF إلى صورة.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png");
    canvas.width = 1;
    canvas.height = 1;
    return dataUrl;
  } finally {
    await pdf.destroy();
  }
}

/**
 * عنوان قسم بنمط احترافي مستوحى من تقارير الهيئة السعودية للمقيمين المعتمدين
 * (تقييم): شريط جانبي ذهبي (يمين) + خط سفلي بحري + خط Tajawal سميك + لون كحلي
 * عميق #0C447C. الحجم قابل للتعديل عبر متغير CSS --mv-heading-scale.
 */
function sectionHeading(title: string, onChange?: (value: string) => void) {
  return (
    <div
      dir="rtl"
      className="mb-3 flex items-stretch gap-2 border-b border-[#0C447C]/35 pb-2 text-right font-black leading-snug text-[#0C447C]"
      style={{ fontSize: "calc(17px * var(--mv-heading-scale, 1))" }}
    >
      <span
        aria-hidden
        className="w-[3px] shrink-0 rounded-sm bg-gradient-to-b from-[#c9a227] via-[#d4af3e] to-[#9b7a17]"
      />
      <div className="min-w-0 flex-1 pt-[2px]">
        {onChange ? (
          <EditableBlock
            value={title}
            onChange={onChange}
            className="min-h-[1.75rem] w-full tracking-tight"
            placeholder="عنوان القسم"
            multiline={false}
          />
        ) : (
          <span className="tracking-tight">{title}</span>
        )}
      </div>
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

/**
 * Renders the user-inserted blocks (heading / paragraph / image) for a given
 * anchor. `position` selects whether to show blocks targeted BEFORE or AFTER
 * the section's main narrative — the right-click menu picks the appropriate
 * one based on click Y relative to the section.
 *
 * Images additionally expose lightweight on-canvas controls (alignment,
 * width slider) and accept drag-and-drop to reorder within the same anchor.
 */
function InsertedReportBlocks({
  anchorId,
  blocks,
  position = "after",
  onUpdate,
  onRemove,
  onReorder,
}: {
  anchorId: string;
  blocks: MvReportInsertedBlock[];
  position?: "before" | "after";
  onUpdate: (id: string, patch: Partial<MvReportInsertedBlock>) => void;
  onRemove: (id: string) => void;
  onReorder?: (fromId: string, toId: string) => void;
}) {
  const visible = blocks.filter((block) => {
    if (block.anchorId !== anchorId) return false;
    const blockPosition = block.position ?? "after";
    return blockPosition === position;
  });
  if (visible.length === 0) return null;

  return (
    <div
      className={cn(
        "space-y-3",
        position === "after" ? "mt-4" : "mb-4",
      )}
      data-mv-report-insert-anchor={anchorId}
      data-mv-report-insert-position={position}
    >
      {visible.map((block) => (
        <InsertedBlockRow
          key={block.id}
          block={block}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onReorder={onReorder}
        />
      ))}
    </div>
  );
}

function InsertedBlockRow({
  block,
  onUpdate,
  onRemove,
  onReorder,
}: {
  block: MvReportInsertedBlock;
  onUpdate: (id: string, patch: Partial<MvReportInsertedBlock>) => void;
  onRemove: (id: string) => void;
  onReorder?: (fromId: string, toId: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const isImage = block.kind === "image";
  const align = block.align ?? "center";
  const widthPercent = block.widthPercent ?? 80;
  return (
    <div
      draggable={!!onReorder}
      onDragStart={
        onReorder
          ? (event) => {
              event.dataTransfer.setData("application/x-mv-inserted-block", block.id);
              event.dataTransfer.effectAllowed = "move";
            }
          : undefined
      }
      onDragOver={
        onReorder
          ? (event) => {
              if (!event.dataTransfer.types.includes("application/x-mv-inserted-block")) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOver(true);
            }
          : undefined
      }
      onDragLeave={onReorder ? () => setDragOver(false) : undefined}
      onDrop={
        onReorder
          ? (event) => {
              event.preventDefault();
              setDragOver(false);
              const fromId = event.dataTransfer.getData("application/x-mv-inserted-block");
              if (fromId && fromId !== block.id) onReorder(fromId, block.id);
            }
          : undefined
      }
      className={cn(
        "group relative rounded-xl border border-transparent px-1 py-1 transition hover:border-sky-100 hover:bg-sky-50/20",
        isImage && "bg-white/40",
        dragOver && "border-sky-300 bg-sky-50/40",
      )}
    >
      <div className="mv-report-chrome absolute left-1 top-1 z-10 hidden gap-0.5 group-hover:flex print:hidden">
        {onReorder ? (
          <span
            className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md border border-slate-200 bg-white/95 text-slate-500 shadow-sm active:cursor-grabbing"
            aria-label="اسحب لإعادة الترتيب"
            title="اسحب لإعادة الترتيب"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        ) : null}
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-red-100 bg-white/95 text-red-600 shadow-sm transition hover:bg-red-50"
          aria-label="حذف العنصر"
          onClick={() => onRemove(block.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {block.kind === "heading" ? (
        <input
          dir="rtl"
          value={block.content ?? ""}
          onChange={(event) => onUpdate(block.id, { content: event.target.value })}
          className="w-full rounded-lg border border-sky-100 bg-white/90 px-3 py-2 text-right text-[17px] font-black leading-snug text-[#0C447C] outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
        />
      ) : block.kind === "paragraph" ? (
        <EditableBlock
          dir="rtl"
          value={block.content ?? ""}
          onChange={(value) => onUpdate(block.id, { content: value })}
          className="min-h-32 w-full rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-right text-[12px] font-medium text-slate-800 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          style={{ lineHeight: "var(--mv-paragraph-leading, 1.75)" }}
          placeholder="اكتب الفقرة هنا"
          deletable={false}
        />
      ) : (
        <figure className="space-y-2 rounded-xl border border-slate-200 bg-white/85 p-2">
          <div
            className={cn(
              "flex w-full",
              align === "start" && "justify-start",
              align === "center" && "justify-center",
              align === "end" && "justify-end",
            )}
          >
            {block.imageDataUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={block.imageDataUrl}
                alt=""
                draggable={false}
                className="block max-h-[160mm] object-contain"
                style={{
                  width: `${widthPercent}%`,
                  borderRadius: "var(--mv-image-radius, 8px)",
                  filter: "var(--mv-image-shadow, none)",
                }}
              />
            ) : (
              <div className="flex min-h-32 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center text-[12px] font-bold text-slate-500">
                لم يتم تحميل الصورة بعد
              </div>
            )}
          </div>
          {/* On-canvas image position controls (hidden in PDF capture) */}
          <div className="mv-report-chrome flex flex-wrap items-center justify-between gap-2 print:hidden" dir="rtl">
            <div className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5 text-slate-500">
              <button
                type="button"
                aria-label="محاذاة لليمين"
                title="يمين"
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-bold",
                  align === "start" ? "bg-sky-100 text-sky-900" : "hover:bg-slate-100",
                )}
                onClick={() => onUpdate(block.id, { align: "start" })}
              >
                يمين
              </button>
              <button
                type="button"
                aria-label="توسيط"
                title="منتصف"
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-bold",
                  align === "center" ? "bg-sky-100 text-sky-900" : "hover:bg-slate-100",
                )}
                onClick={() => onUpdate(block.id, { align: "center" })}
              >
                منتصف
              </button>
              <button
                type="button"
                aria-label="محاذاة لليسار"
                title="يسار"
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-bold",
                  align === "end" ? "bg-sky-100 text-sky-900" : "hover:bg-slate-100",
                )}
                onClick={() => onUpdate(block.id, { align: "end" })}
              >
                يسار
              </button>
            </div>
            <label className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
              <span>عرض</span>
              <input
                type="range"
                min={20}
                max={100}
                step={2}
                value={widthPercent}
                onChange={(event) => onUpdate(block.id, { widthPercent: Number(event.target.value) })}
                className="h-1 w-32 cursor-pointer accent-[#0C447C]"
              />
              <span className="tabular-nums">{widthPercent}%</span>
            </label>
          </div>
          <EditableBlock
            value={block.caption ?? ""}
            onChange={(value) => onUpdate(block.id, { caption: value })}
            className="min-h-[1.5rem] text-center text-[11px] font-semibold text-slate-600"
            placeholder="تعليق الصورة"
          />
        </figure>
      )}
    </div>
  );
}

export interface MvValuationReportDocumentBodyProps {
  projectId: string;
  project: MvProject | null;
  projectName: string;
  reportData: MvProjectReportData;
  companyBrand: { name: string; logoSrc: string | null; commercialRegistration?: string | null };
  letterheadTemplate?: MvCompanyReportLetterheadTemplate | null;
  /**
   * قالب تقرير مُستخرج بالذكاء الاصطناعي — عند وجوده، تُبنى صفحات التقرير من
   * `aiTemplate.sections` (مطابَقة بأقسام موثوقة موجودة أو مُركَّبة كقسم AI عام)
   * بدل الترتيب الافتراضي الثابت. انظر `buildAiReportFlowChildren`.
   */
  aiTemplate?: MvCompanyAiReportTemplate | null;
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
  /** ‎users.valuationReportMembershipNo‎ لمدير الشركة (من ‎/api/company/report-defaults‎) */
  companyAdminMembershipNo?: string | null;
  /** رقم العضوية من ملف المستخدم الحالي (‎valuationReportMembershipNo‎) */
  currentUserMembershipNo?: string | null;
  updatePreparerRole: (id: string, value: string) => void;
  includeAssetImages: boolean;
  includeValuationAccountImages: boolean;
  orderedImages: MvDriveFile[];
  imageOrder: string[];
  imageGroupGap: number;
  imageInnerGap: number;
  assetImageWidth: number;
  valuationImageWidth: number;
  assetImagesPerPage?: number;
  assetImagesPerRow?: number;
  assetImagesUniformSize?: boolean;
  /** نصف قطر حواف الصور (px) — عرض فقط، لا يؤثر على جودة التقرير. */
  imageCornerRadius?: number;
  /** ارتفاع السطر في الفقرات (×) — عرض فقط. */
  paragraphLineHeight?: number;
  /** مقياس حجم خط عناوين الأقسام (×) — عرض فقط. */
  headingScale?: number;
  /** قوة ظل الصور (0..4) — عرض فقط. */
  imageShadow?: number;
  /** اتجاهات الصفحات اليدوية: مفاتيحها anchor الصفحة أو valuation:imageId. */
  reportPageOrientations?: Record<string, MvReportPageOrientationPreference>;
  onReportPageOrientationChange?: (pageKey: string, orientation: MvReportPageOrientationPreference) => void;
  valuationAccountImages: MvValuationAccountingImage[];
  /** صور مستندات العميل من خطوة «ملفات العميل» — تُعرض في مرفق 3. */
  clientDocumentImages?: MvClientDocumentImage[];
  /** عدد الصور في الصف/الارتفاع لمرفق 3 (1|2|3 → صفحة N×N). */
  clientDocumentsImagesPerRow?: 1 | 2 | 3;
  resolveImageSrc?: (src: string) => string;
  moveImage: (fileId: string, direction: -1 | 1) => void;
  hideImage: (fileId: string) => void;
  hideValuationImage?: (imageId: string) => void;
  /**
   * يضبط ترتيب صور الأصول كاملاً — يُستخدم لإعادة الترتيب عبر السحب والإفلات.
   * يحل محل الأسهم القديمة في أعلى كل صورة.
   */
  setImageOrder?: (orderUpdater: (current: string[]) => string[]) => void;
  navigate: (href: string) => void;
  editableSections: MvReportEditableSection[];
  updateEditableSection: (id: string, patch: Partial<MvReportEditableSection>) => void;
  removeEditableSection: (id: string) => void;
  addEditableSection: (insertAfterAnchorId?: string) => void;
  moveEditableSectionTo?: (sectionId: string, insertAfterAnchorId?: string) => void;
  /** وضع مسودة: علامة مائية وإخفاء صور التوقيع في 24.0 */
  draftWatermark: boolean;
  onReportDataPatch: (patch: Partial<MvProjectReportData>) => void;
  /**
   * قوالب أقسام التقرير الافتراضية للشركة (نطاق العمل، المنهجية، الافتراضات).
   * تُستعمل كنصوص افتراضية في صفحة الإعداد إذا لم يحدد المشروع قيمة خاصة.
   */
  companyReportDefaults?: {
    scope?: Record<string, string>;
    methodology?: Record<string, string>;
    assumptions?: Record<string, string>;
  };
  /**
   * يُستدعى عند النقر على عنصر في الفهرس — يقوم بالقفز إلى القسم المرتبط
   * داخل لوحة المعاينة. اختياري لأن نفس المكون قد يُستعمل في معاينة لا تدعم
   * التمرير الداخلي.
   */
  onTocAnchorClick?: (anchorId: string) => void;
}

export function MvValuationReportDocumentBody({
  projectId,
  project,
  projectName,
  reportData,
  companyBrand,
  letterheadTemplate,
  aiTemplate,
  reportFooterLines: _reportFooterLines,
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
  companyAdminMembershipNo,
  currentUserMembershipNo,
  updatePreparerRole,
  includeAssetImages,
  includeValuationAccountImages,
  orderedImages,
  imageOrder,
  imageGroupGap,
  imageInnerGap,
  assetImageWidth,
  valuationImageWidth,
  assetImagesPerPage = 9,
  assetImagesPerRow = 3,
  assetImagesUniformSize = true,
  imageCornerRadius = 0,
  paragraphLineHeight = 1.75,
  headingScale = 1,
  imageShadow = 0,
  reportPageOrientations = {},
  onReportPageOrientationChange,
  valuationAccountImages,
  clientDocumentImages = [],
  clientDocumentsImagesPerRow = 2,
  resolveImageSrc,
  moveImage,
  hideImage,
  hideValuationImage,
  setImageOrder,
  navigate,
  editableSections,
  updateEditableSection,
  removeEditableSection,
  addEditableSection,
  moveEditableSectionTo,
  onTocAnchorClick,
  draftWatermark,
  onReportDataPatch,
  companyReportDefaults,
}: MvValuationReportDocumentBodyProps) {
  const fallbackReferenceLabel = project?._id ? String(project._id).slice(-12) : projectId;
  const textOverrides = reportData.reportTextOverrides ?? {};
  const hasTextOverride = (key: string) => Object.prototype.hasOwnProperty.call(textOverrides, key);
  const editableText = (key: string, fallback: string) => (hasTextOverride(key) ? textOverrides[key] ?? "" : fallback);
  /** مثل ‎editableText‎ لكن يتجاهل التعديل اليدوي إذا كان فارغاً ويعود للقيمة الديناميكية. */
  const editableTextOrDynamicFallback = (key: string, fallback: string) => {
    if (hasTextOverride(key)) {
      const overridden = (textOverrides[key] ?? "").trim();
      if (overridden) return overridden;
    }
    return fallback;
  };
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
  /**
   * Reads the seeded/template text the company-admin saved for a given report
   * section (sourced from "بيانات إعداد التقرير النهائي" in the company panel).
   * Returns an empty string when nothing has been configured, which lets us
   * cleanly chain it after the project-specific value.
   */
  const companyDefault = (
    group: "scope" | "methodology" | "assumptions",
    key: string,
  ): string => {
    const groupDefaults = companyReportDefaults?.[group];
    if (!groupDefaults) return "";
    const value = groupDefaults[key];
    return typeof value === "string" ? value : "";
  };
  /**
   * Returns the trimmed project field value, falling back to the company-level
   * template if the project has not overridden it.
   */
  const fieldOrCompanyDefault = (
    projectValue: string | null | undefined,
    group: "scope" | "methodology" | "assumptions",
    key: string,
  ): string => {
    const trimmed = projectValue?.trim();
    if (trimmed) return trimmed;
    return companyDefault(group, key);
  };
  /**
   * Returns a company-default text with `{companyName}` / `{clientName}` /
   * `{leadValuerName}` placeholders substituted with their resolved values.
   * Used by the independence statement and other narrative defaults where the
   * paragraph naturally mentions parties by name.
   */
  const renderCompanyDefault = (
    group: "scope" | "methodology" | "assumptions",
    key: string,
  ): string => {
    const raw = companyDefault(group, key);
    if (!raw) return "";
    return raw
      .replace(/\{companyName\}/g, companyName || "الجهة المُقيِّمة")
      .replace(/\{clientName\}/g, clientName || "العميل")
      .replace(/\{leadValuerName\}/g, leadValuerName || "المقيم المسؤول");
  };
  /**
   * Renders a narrative paragraph (multi-line, RTL, editable) used for the
   * long descriptive blocks (scope of work, methodology rationale, etc.).
   * `line-height` is driven by the `--mv-paragraph-leading` CSS variable so the
   * settings drawer can re-tune the reading rhythm in one place.
   */
  const narrativeBlock = (key: string, fallback: string, className?: string) => (
    <EditableBlock
      value={editableText(key, fallback)}
      onChange={(value) => setTextOverride(key, value)}
      className={cn(
        "whitespace-pre-wrap break-words text-[12px] font-medium text-slate-800",
        className,
      )}
      style={{ lineHeight: "var(--mv-paragraph-leading, 1.75)" }}
      placeholder="—"
    />
  );
  const referenceLabel = editableText("reportReference", textValue(reportData.reportReference, fallbackReferenceLabel));
  const reportTitle = editableText("reportTitle", textValue(reportData.reportTitle, "تقرير تقييم معدات وآلات"));
  const { logoSrc, commercialRegistration: companyCommercialRegistration } = companyBrand;
  const companyName = editableText("valuationFirmName", textValue(reportData.valuationFirmName, companyBrand.name));
  const commercialRegistration = companyCommercialRegistration?.trim() || "";
  const fallbackInspectionLocation = inspectionLocationText?.trim() || "غير محدد";
  const effectiveInspectionLocation = editableText(
    "inspectionLocation",
    textValue(reportData.inspectionLocation, fallbackInspectionLocation),
  );
  const effectiveInspectionMapUrl = editableText("inspectionMapUrl", reportData.inspectionMapUrl?.trim() || inspectionMapUrl);
  const effectiveCurrencyLabel = editableText("currencyLabel", textValue(reportData.currencyLabel, "الريال السعودي (ر.س)"));
  const finalValueDisplay = editableText("finalValueDisplay", currencyValue(reportData.finalValue));
  const finalValueWords = editableText("finalValueWords", textValue(reportData.finalValueWords, ""));
  const valueOpinionSentence = `بعد الأخذ في الاعتبار جميع البيانات ذات الصلة والمبادئ المنصوص عليها، فإننا نرى أن رأي قيمة التصفية (${finalValueDisplay}) ${finalValueWords ? `${finalValueWords} لا غير` : ""}`.trim();

  /**
   * عنوان قسم 25.0 «تطبيق أسلوب التقييم» ديناميكي حسب «أسلوب التقييم» المختار
   * داخل خطوة «بيانات التقرير». الافتراضي: أسلوب التقييم (عام). تظهر الأقسام
   * الفرعية 25.1 → 25.4 (تخريد/إهلاك/تقادم) فقط مع أسلوب التكلفة (أو مزجه).
   */
  const valuationMethodRaw = (reportData.valuationMethod || "").trim();
  const usesCostApproach = /تكلفة|cost/i.test(valuationMethodRaw);
  const usesMarketApproach = /سوق|market|مقارن/i.test(valuationMethodRaw);
  const usesIncomeApproach = /دخل|income/i.test(valuationMethodRaw);
  const valuationApproachLabel = valuationMethodRaw || "أسلوب التقييم";
  const applyApproachHeading = `25.0 تطبيق ${valuationApproachLabel}`;
  const showCostSubSections = usesCostApproach || (!usesMarketApproach && !usesIncomeApproach && !valuationMethodRaw);
  const leadValuerName =
    editableText("leadValuerName", reportData.leadValuerName?.trim() || primarySignatory?.name?.trim() || "");
  const leadValuerMembershipFallback = useMemo(
    () =>
      resolveLeadValuerMembershipNo({
        reportMembershipNo: reportData.leadValuerMembershipNo,
        companyAdminMembershipNo,
        leadValuerName: reportData.leadValuerName?.trim() || primarySignatory?.name?.trim() || "",
        preparerRows: preparerDisplayRows,
        primarySignatory,
        currentUserMembershipNo,
      }),
    [
      reportData.leadValuerMembershipNo,
      reportData.leadValuerName,
      companyAdminMembershipNo,
      preparerDisplayRows,
      primarySignatory,
      currentUserMembershipNo,
    ],
  );
  const leadValuerMembershipDisplay = editableTextOrDynamicFallback(
    "leadValuerMembershipNo",
    leadValuerMembershipFallback || "—",
  );
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
  const sheetDraft = draftWatermark;

  /**
   * عناصر الغلاف — نص أبيض على الخلفية الكحلية/الداكنة كما في نموذج التقرير.
   */
  const coverPrimaryTextClass = "text-white";
  const coverSecondaryTextClass = "text-white";
  const reportIssueDateDisplay = editableText(
    "reportIssueDateDisplay",
    shortDateValue(reportData.reportIssueDate),
  );
  const identityFooterLines = [
    companyName,
    commercialRegistration ? `السجل التجاري: ${commercialRegistration}` : "",
    leadValuerName ? `المقيم المعتمد: ${leadValuerName}` : "",
    leadValuerMembershipDisplay && leadValuerMembershipDisplay !== "—"
      ? `عضوية رقم: ${leadValuerMembershipDisplay}`
      : "",
    referenceLabel ? `الرقم المرجعي: ${referenceLabel}` : "",
    reportIssueDateDisplay ? `تاريخ التقرير: ${reportIssueDateDisplay}` : "",
  ].filter(Boolean);
  const renderIdentityFooter = (tone: "cover" | "interior") => {
    const isCover = tone === "cover";
    const kickerClass = isCover
      ? "text-[6.5px] font-extrabold leading-none text-[#e4c56a]"
      : "text-[6px] font-extrabold leading-none text-[#6d8499]";
    const primaryClass = isCover
      ? "min-w-0 break-words text-[10px] font-black leading-[1.2] text-white"
      : "min-w-0 break-words text-[8px] font-black leading-[1.2] text-[#071929]";
    const secondaryClass = isCover
      ? "min-w-0 break-words text-[7px] font-semibold leading-[1.15] text-white/80"
      : "min-w-0 break-words text-[6.5px] font-semibold leading-[1.15] text-[#3d556b]";
    const colClass = cn(
      "flex min-h-0 min-w-0 flex-col justify-center gap-0.5 px-[2mm] text-right",
      "[&:not(:first-child)]:border-s",
      isCover ? "border-[#c9a227]/40" : "border-[#0C447C]/14",
    );
    const kicker = (key: string, fallback: string) =>
      isCover ? (
        <EditableBlock
          value={labelText(key, fallback)}
          onChange={(value) => setTextOverride(`label.${key}`, value)}
          className={cn("inline-block px-0 py-0 align-baseline", kickerClass)}
          multiline={false}
          deletable={false}
          placeholder="عنوان الحقل"
        />
      ) : (
        <span className={kickerClass}>{fallback}</span>
      );
    const inlineValue = (
      value: string,
      onChange: (next: string) => void,
      className: string,
      placeholder: string,
      dir?: "rtl" | "ltr",
    ) => (
      <EditableBlock
        value={value}
        onChange={onChange}
        className={cn(
          "block min-w-0 px-0 py-0",
          isCover && "focus:bg-white/10 focus:ring-[#c9a227]/35",
          className,
        )}
        multiline={false}
        deletable={false}
        placeholder={placeholder}
        dir={dir}
      />
    );
    const metaLine = (label: string, value: ReactNode) => (
      <div className={cn("flex min-w-0 items-baseline gap-x-1", secondaryClass)}>
        <span className="shrink-0">{label}</span>
        <div className="min-w-0 flex-1 break-words">{value}</div>
      </div>
    );

    return (
      <div className="grid h-full w-full min-w-0 grid-cols-4" dir="rtl">
        <section className={colClass}>
          {kicker("cover.companyName", "الشركة المقيمة")}
          <div className={primaryClass}>{companyName || "—"}</div>
          {commercialRegistration
            ? metaLine("السجل التجاري:", commercialRegistration)
            : null}
        </section>
        <section className={colClass}>
          {kicker("cover.leadValuerLabel", "المقيم المعتمد")}
          {inlineValue(
            leadValuerName || "—",
            (value) => setTextOverride("leadValuerName", value),
            primaryClass,
            "اسم المقيم",
          )}
          {metaLine(
            "عضوية رقم:",
            inlineValue(
              leadValuerMembershipDisplay,
              (value) => setTextOverride("leadValuerMembershipNo", value),
              cn(secondaryClass, "text-left [unicode-bidi:plaintext]"),
              "—",
              "ltr",
            ),
          )}
        </section>
        <section className={colClass}>
          {kicker("cover.reportIssueDate", "تاريخ التقرير")}
          {inlineValue(
            reportIssueDateDisplay,
            (value) => setTextOverride("reportIssueDateDisplay", value),
            primaryClass,
            "—",
          )}
        </section>
        <section className={colClass}>
          {kicker("cover.reportReference", "الرقم المرجعي")}
          {inlineValue(
            referenceLabel,
            (value) => setTextOverride("reportReference", value),
            cn(primaryClass, "[unicode-bidi:plaintext]"),
            "—",
            "ltr",
          )}
        </section>
      </div>
    );
  };
  const reportIdentityFooter = renderIdentityFooter("cover");
  const interiorIdentityFooter = renderIdentityFooter("interior");

  const receivedClientDocumentsHtml =
    reportData.receivedClientDocumentsHtml?.trim() || MV_DEFAULT_RECEIVED_CLIENT_DOCUMENTS_HTML;
  const sceRegistrationHtml =
    reportData.sceRegistrationCertificateHtml?.trim() || MV_DEFAULT_SCE_REGISTRATION_HTML;

  const assetPhotosPerRow = Math.min(20, Math.max(1, Math.round(assetImagesPerRow || 3)));
  const requestedAssetPhotosPerPage = Math.min(24, Math.max(1, Math.round(assetImagesPerPage || 9)));
  // A 4:3 asset tile must leave enough room for the annex heading, its
  // controls and page margins.  Treat the user preference as an upper bound
  // rather than allowing a large gallery to overflow an A4 sheet silently.
  // Use the smaller capacity of portrait and landscape so rotating a gallery
  // page cannot turn an otherwise valid sheet into a clipped one.
  const imageRowGapMm = Math.max(0, imageGroupGap) / (96 / 25.4);
  const assetCapacityForFrame = (contentWidthMm: number, galleryHeightMm: number) => {
    const tileHeightMm = (contentWidthMm / assetPhotosPerRow) * 0.75;
    const rows = Math.max(
      1,
      Math.floor((galleryHeightMm + imageRowGapMm) / (tileHeightMm + imageRowGapMm)),
    );
    return rows * assetPhotosPerRow;
  };
  const safeAssetPhotosPerPage = Math.min(
    24,
    assetCapacityForFrame(186, 180),
    assetCapacityForFrame(269, 138),
  );
  const assetPhotosPerPage = Math.min(requestedAssetPhotosPerPage, safeAssetPhotosPerPage);
  const assetPhotoWidthCss = (orientation: MvReportPageOrientationPreference) =>
    assetPhotosPerRow <= 1
      ? orientation === "landscape"
        ? "min(100%, 185mm)"
        : "100%"
      : `calc((100% - ${Math.max(0, imageInnerGap) * (assetPhotosPerRow - 1)}px) / ${assetPhotosPerRow})`;
  const assetPhotoChunks: MvDriveFile[][] =
    orderedImages.length > 0 ? chunkArray(orderedImages, assetPhotosPerPage) : [[]];
  const clientDocsPerRow = (
    clientDocumentsImagesPerRow === 1 || clientDocumentsImagesPerRow === 3
      ? clientDocumentsImagesPerRow
      : 2
  ) as 1 | 2 | 3;
  const clientDocsPerPage = clientDocsPerRow * clientDocsPerRow;
  const clientDocChunks: MvClientDocumentImage[][] =
    clientDocumentImages.length > 0
      ? chunkArray(clientDocumentImages, clientDocsPerPage)
      : [[]];
  const clientDocsGridClass =
    clientDocsPerRow === 1
      ? "grid-cols-1 grid-rows-1"
      : clientDocsPerRow === 3
        ? "grid-cols-3 grid-rows-3"
        : "grid-cols-2 grid-rows-2";

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
  const editableCoverCompanyNameNode = (
    <EditableBlock
      value={companyName}
      onChange={(value) => setTextOverride("valuationFirmName", value)}
      className="mx-auto max-w-full text-center text-white"
      placeholder="اسم الشركة"
    />
  );
  const interiorShellProps = {
    companyName,
    companyNameNode: editableCompanyNameNode,
    commercialRegistration,
    logoSrc,
    footerLines: identityFooterLines,
    footerContent: interiorIdentityFooter,
    draftWatermark: sheetDraft,
  };
  const flowForceBreakAnchors = useMemo(() => {
    const anchors = new Set<string>();
    for (const section of editableSections) {
      const anchor = section.insertAfterAnchorId?.trim();
      if (anchor) anchors.add(anchor);
    }
    return anchors;
  }, [editableSections]);
  const flowMeasureRevision = useMemo(
    () =>
      [
        paragraphLineHeight,
        headingScale,
        sectionGap,
        introExtraHtml,
        narrativeB1,
        narrativeB2,
        narrativeB3,
        narrativeB4,
        reportData,
        showCostSubSections,
        aiTemplate?.id ?? "",
        aiTemplate?.sections?.length ?? 0,
      ].join("\u0001"),
    [
      paragraphLineHeight,
      headingScale,
      sectionGap,
      introExtraHtml,
      narrativeB1,
      narrativeB2,
      narrativeB3,
      narrativeB4,
      reportData,
      showCostSubSections,
      aiTemplate,
    ],
  );
  const insertedBlocks = reportData.reportInsertedBlocks ?? [];
  const insertedBlocksRef = useRef<MvReportInsertedBlock[]>(insertedBlocks);
  const [insertMenu, setInsertMenu] = useState<{
    anchorId: string;
    x: number;
    y: number;
    position: "before" | "after";
  } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const receivedDocsPdfInputRef = useRef<HTMLInputElement>(null);
  const receivedDocsImageInputRef = useRef<HTMLInputElement>(null);
  const scePdfInputRef = useRef<HTMLInputElement>(null);
  const sceImageInputRef = useRef<HTMLInputElement>(null);
  const pendingImageAnchorRef = useRef<string>("report-cover");
  const [receivedDocsDropActive, setReceivedDocsDropActive] = useState(false);
  const [receivedDocsPdfBusy, setReceivedDocsPdfBusy] = useState(false);
  const [sceDropActive, setSceDropActive] = useState(false);
  const [scePdfBusy, setScePdfBusy] = useState(false);
  /**
   * IDs of built-in section anchors hidden by the user. We CSS-hide them so the
   * layout naturally collapses (content beneath flows up). Bringing them back
   * is done from the navigation sidebar (when at least one is hidden).
   */
  const hiddenAnchorIds = reportData.reportHiddenAnchorIds ?? [];
  const toggleHiddenAnchor = (anchorId: string, hidden: boolean) => {
    const current = reportData.reportHiddenAnchorIds ?? [];
    const next = hidden
      ? Array.from(new Set([...current, anchorId]))
      : current.filter((id) => id !== anchorId);
    onReportDataPatch({ reportHiddenAnchorIds: next });
  };

  useLayoutEffect(() => {
    insertedBlocksRef.current = insertedBlocks;
  }, [insertedBlocks]);

  const updateInsertedBlocks = (next: MvReportInsertedBlock[]) => {
    insertedBlocksRef.current = next;
    onReportDataPatch({ reportInsertedBlocks: next });
  };

  const addInsertedImageBlock = (
    anchorId: string,
    imageDataUrl: string,
    position: "before" | "after" = "after",
    widthPercent = 80,
  ) => {
    const block: MvReportInsertedBlock = {
      id: newReportBlockId(),
      anchorId,
      kind: "image",
      position,
      imageDataUrl,
      caption: "",
      align: "center",
      widthPercent,
    };
    updateInsertedBlocks([...insertedBlocksRef.current, block]);
    setInsertMenu(null);
  };

  const addInsertedBlock = (
    anchorId: string,
    kind: MvReportInsertedBlockKind,
    imageDataUrl?: string,
    position: "before" | "after" = "after",
  ) => {
    const block: MvReportInsertedBlock = {
      id: newReportBlockId(),
      anchorId,
      kind,
      position,
      ...(kind === "heading"
        ? { content: "" }
        : kind === "paragraph"
          ? { content: "" }
          : { imageDataUrl: imageDataUrl ?? "", caption: "", align: "center", widthPercent: 80 }),
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

  /** Reorder inserted blocks within the same anchor + position bucket. */
  const reorderInsertedBlock = (fromId: string, toId: string) => {
    const list = insertedBlocksRef.current;
    const fromIdx = list.findIndex((b) => b.id === fromId);
    const toIdx = list.findIndex((b) => b.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = list.slice();
    const [moved] = next.splice(fromIdx, 1);
    const insertAt = next.findIndex((b) => b.id === toId);
    next.splice(insertAt < 0 ? next.length : insertAt, 0, moved);
    updateInsertedBlocks(next);
  };

  const insertedAfter = (anchorId: string) => (
    <InsertedReportBlocks
      anchorId={anchorId}
      blocks={insertedBlocks}
      position="after"
      onUpdate={updateInsertedBlock}
      onRemove={removeInsertedBlock}
      onReorder={reorderInsertedBlock}
    />
  );

  const insertedBefore = (anchorId: string) => (
    <InsertedReportBlocks
      anchorId={anchorId}
      blocks={insertedBlocks}
      position="before"
      onUpdate={updateInsertedBlock}
      onRemove={removeInsertedBlock}
      onReorder={reorderInsertedBlock}
    />
  );

  /**
   * A cover or image sheet has a deliberately fixed A4 composition.  User
   * insertions can be arbitrarily long, so render them on normal flowing A4
   * pages immediately after their anchor rather than allowing them to be
   * hidden behind a fixed footer.
   */
  const insertedAfterOnOwnPages = (anchorId: string) => {
    const matchingBlocks = insertedBlocks.filter(
      (block) => block.anchorId === anchorId && (block.position ?? "after") === "after",
    );
    if (matchingBlocks.length === 0) return null;
    const revision = matchingBlocks
      .map((block) => `${block.id}:${block.kind}:${block.content ?? ""}:${block.imageDataUrl?.length ?? 0}`)
      .join("|");
    return (
      <ReportFlowPages shellProps={interiorShellProps} measureRevision={`inserted:${anchorId}:${revision}`}>
        <section dir="rtl" className="text-right">
          <div>{insertedAfter(anchorId)}</div>
        </section>
      </ReportFlowPages>
    );
  };

  /**
   * Section heading + hover-only "حذف القسم" action. The supplied `key`
   * doubles as the anchor ID for built-in numbered sections (e.g. `mv-toc-3`),
   * so the same call site controls both the editable label and the visibility.
   */
  /**
   * Renders a "page boundary" between two report shells:
   *  - first emits any custom editable sections targeting `afterAnchorId`
   *  - then an inline "+" cue so the user can append a new custom section after
   *    that exact spot (and also accepts drag-and-drop of existing customs).
   * This is what makes the "add section after any built-in section" UX work.
   */
  const customSectionsAfter = (afterAnchorId: string) =>
    editableSections
      .filter((s) => s.insertAfterAnchorId === afterAnchorId)
      .map((section) => (
        <CustomSectionShell
          key={section.id}
          section={section}
          companyName={companyName}
          companyNameNode={editableCompanyNameNode}
          commercialRegistration={commercialRegistration}
          logoSrc={logoSrc}
          footerLines={identityFooterLines}
          draftWatermark={sheetDraft}
          onNumberChange={(value) => updateEditableSection(section.id, { sectionNumber: value })}
          onTitleChange={(value) => updateEditableSection(section.id, { title: value })}
          onBodyChange={(next) => updateEditableSection(section.id, { body: next })}
          onRemove={() => removeEditableSection(section.id)}
          insertedAfter={insertedAfter}
        />
      ));

  const boundary = (afterAnchorId: string) => (
    <>
      {customSectionsAfter(afterAnchorId)}
      <InsertSectionCue
        afterAnchorId={afterAnchorId}
        onAdd={addEditableSection}
        onDropSection={moveEditableSectionTo}
      />
    </>
  );

  const editableHeading = (key: string, fallback: string, options?: { hideable?: boolean }) => {
    const isAnchor =
      key.startsWith("mv-toc-") ||
      key.startsWith("mv-annex-") ||
      key === "report-cover" ||
      key === "report-toc";
    const hideable = options?.hideable ?? key.startsWith("mv-toc-");
    return (
      <>
        <div className="group/section-heading relative">
          {sectionHeading(
            editableText(`heading.${key}`, fallback),
            (value) => setTextOverride(`heading.${key}`, value),
          )}
          {hideable ? (
            <button
              type="button"
              className="mv-report-chrome absolute -top-1 left-0 hidden h-7 items-center gap-1 rounded-md border border-red-100 bg-white/95 px-2 text-[10.5px] font-bold text-red-600 shadow-sm transition hover:bg-red-50 group-hover/section-heading:flex print:hidden"
              title="حذف القسم وإزاحة المحتوى إلى الأعلى"
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  !window.confirm("هل تريد إخفاء هذا القسم من التقرير؟ يمكن استرجاعه من قائمة الأقسام المخفية.")
                ) {
                  return;
                }
                toggleHiddenAnchor(key, true);
              }}
            >
              <Trash2 className="h-3 w-3" />
              حذف القسم
            </button>
          ) : null}
        </div>
        {/* "before" inserted blocks render right below the heading so they
            land roughly where the user clicked when they used the "أعلى"
            option in the right-click insert menu. */}
        {isAnchor ? insertedBefore(key) : null}
      </>
    );
  };

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
    // The closest section that owns an anchor wins — if no direct match we
    // fall back to the section's top-level anchor (rare but possible if the
    // user right-clicks on a gap between paragraphs).
    const anchorEl = target.closest<HTMLElement>("[data-mv-report-insert-anchor]");
    const sheetAnchorEl = target
      .closest<HTMLElement>("[data-mv-report-sheet]")
      ?.querySelector<HTMLElement>("[data-mv-report-insert-anchor]");
    const ownerEl = anchorEl ?? sheetAnchorEl;
    const anchorId =
      anchorEl?.dataset.mvReportInsertAnchor ||
      sheetAnchorEl?.dataset.mvReportInsertAnchor ||
      sheetAnchorEl?.id;
    if (!anchorId) return;
    // Decide whether the user clicked in the upper or lower half of the
    // owning section so the new block lands roughly where they clicked.
    let position: "before" | "after" = "after";
    if (ownerEl) {
      const rect = ownerEl.getBoundingClientRect();
      const middle = rect.top + rect.height / 2;
      position = event.clientY <= middle ? "before" : "after";
    }
    const menuWidth = 220;
    const menuHeight = 180;
    setInsertMenu({
      anchorId,
      position,
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
    });
  };

  const pendingImagePositionRef = useRef<"before" | "after">("after");
  const chooseImageForAnchor = (anchorId: string, position: "before" | "after" = "after") => {
    pendingImageAnchorRef.current = anchorId;
    pendingImagePositionRef.current = position;
    setInsertMenu(null);
    imageInputRef.current?.click();
  };

  const isReportPdfFile = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isReportImageFile = (file: File) =>
    file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name);

  const addReportImageFile = async (anchorId: string, file: File) => {
    const dataUrl = await readInsertedReportImageDataUrl(file);
    if (dataUrl) addInsertedImageBlock(anchorId, dataUrl, "after", 96);
  };

  const addReportPdfFile = async (anchorId: string, file: File, setBusy: (busy: boolean) => void) => {
    setBusy(true);
    try {
      const dataUrl = await readFirstPdfPageAsReportImageDataUrl(file);
      if (dataUrl) addInsertedImageBlock(anchorId, dataUrl, "after", 96);
    } finally {
      setBusy(false);
    }
  };

  const handleReportAttachmentFile = (
    anchorId: string,
    file: File | null | undefined,
    setBusy: (busy: boolean) => void,
  ) => {
    if (!file) return;
    if (isReportPdfFile(file)) {
      void addReportPdfFile(anchorId, file, setBusy);
      return;
    }
    if (isReportImageFile(file)) {
      void addReportImageFile(anchorId, file);
    }
  };

  const handleReceivedDocsPickedFile = (file: File | null | undefined) => {
    handleReportAttachmentFile("mv-annex-3", file, setReceivedDocsPdfBusy);
  };

  const handleReceivedDocsPaste = (event: ClipboardEvent<HTMLElement>) => {
    const file = Array.from(event.clipboardData.files).find((item) => isReportImageFile(item) || isReportPdfFile(item));
    if (!file) return;
    event.preventDefault();
    handleReceivedDocsPickedFile(file);
  };

  const handleReceivedDocsDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setReceivedDocsDropActive(false);
    handleReceivedDocsPickedFile(event.dataTransfer.files?.[0]);
  };

  const handleScePickedFile = (file: File | null | undefined) => {
    handleReportAttachmentFile("mv-annex-sce", file, setScePdfBusy);
  };

  const handleScePaste = (event: ClipboardEvent<HTMLElement>) => {
    const file = Array.from(event.clipboardData.files).find((item) => isReportImageFile(item) || isReportPdfFile(item));
    if (!file) return;
    event.preventDefault();
    handleScePickedFile(file);
  };

  const handleSceDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setSceDropActive(false);
    handleScePickedFile(event.dataTransfer.files?.[0]);
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
            <p
              className="border-b border-slate-100 px-2 pb-1.5 pt-0.5 text-[10px] font-bold text-slate-400"
              dir="rtl"
            >
              {insertMenu.position === "before" ? "إدراج أعلى المكان المختار" : "إدراج أسفل المكان المختار"}
            </p>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-extrabold text-slate-800 hover:bg-sky-50 hover:text-sky-900"
              onClick={() => addInsertedBlock(insertMenu.anchorId, "heading", undefined, insertMenu.position)}
            >
              <Heading2 className="h-4 w-4" />
              إضافة عنوان
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-extrabold text-slate-800 hover:bg-sky-50 hover:text-sky-900"
              onClick={() => addInsertedBlock(insertMenu.anchorId, "paragraph", undefined, insertMenu.position)}
            >
              <FileText className="h-4 w-4" />
              إضافة براجراف
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-extrabold text-slate-800 hover:bg-sky-50 hover:text-sky-900"
              onClick={() => chooseImageForAnchor(insertMenu.anchorId, insertMenu.position)}
            >
              <ImageIcon className="h-4 w-4" />
              إرفاق صورة
            </button>
            <div className="my-1 h-px bg-slate-100" />
            <div className="flex gap-1 px-2 py-1" dir="rtl">
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-md px-1.5 py-1 text-[10.5px] font-bold transition",
                  insertMenu.position === "before"
                    ? "bg-sky-100 text-sky-900"
                    : "text-slate-500 hover:bg-slate-100",
                )}
                onClick={() => setInsertMenu({ ...insertMenu, position: "before" })}
              >
                أعلى
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-md px-1.5 py-1 text-[10.5px] font-bold transition",
                  insertMenu.position === "after"
                    ? "bg-sky-100 text-sky-900"
                    : "text-slate-500 hover:bg-slate-100",
                )}
                onClick={() => setInsertMenu({ ...insertMenu, position: "after" })}
              >
                أسفل
              </button>
            </div>
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

  const imageShadowFilter =
    imageShadow > 0
      ? [
          "drop-shadow(0 1px 1px rgba(15,23,42,0.06))",
          "drop-shadow(0 2px 2px rgba(15,23,42,0.04))",
          "drop-shadow(0 3px 6px rgba(15,23,42,0.08))",
          "drop-shadow(0 6px 14px rgba(15,23,42,0.12))",
        ]
          .slice(0, imageShadow)
          .join(" ")
      : undefined;
  const hiddenSectionsCss =
    hiddenAnchorIds.length > 0
      ? hiddenAnchorIds.map((id) => `[id="${id}"]`).join(",") + "{display:none !important;}"
      : "";
  const reportRenderCss = `
    ${hiddenSectionsCss}
    .mv-report-canvas-root [data-mv-report-sheet] {
      color: #020617;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: geometricPrecision;
    }
    .mv-report-canvas-root [data-mv-report-sheet] :where(p, li, td, th, [contenteditable], input, textarea):not(.mv-report-chrome *) {
      color: #020617;
      letter-spacing: 0;
    }
    /* غلاف التقرير: نص أبيض — يتجاوز القاعدة العامة أعلاه */
    .mv-report-canvas-root [data-mv-report-sheet][data-mv-report-variant="cover"] {
      color: #ffffff;
    }
    .mv-report-canvas-root [data-mv-report-sheet][data-mv-report-variant="cover"] :where(p, li, td, th, [contenteditable], input, textarea, span):not(.mv-report-chrome *) {
      color: #ffffff;
    }
    .mv-report-canvas-root [data-mv-report-sheet][data-mv-report-variant="cover"] [contenteditable]:focus {
      background: rgba(255, 255, 255, 0.12);
      --tw-ring-color: rgba(255, 255, 255, 0.35);
    }
    .mv-report-canvas-root [data-mv-letterhead-background="true"] [data-mv-report-page-content] {
      isolation: isolate;
    }
    .mv-report-canvas-root [data-mv-letterhead-background="true"] [data-mv-report-insert-anchor] {
      max-width: 100%;
    }
  `;
  const pageOrientation = (
    pageKey: string,
    fallback: MvReportPageOrientationPreference = "portrait",
  ): MvReportPageOrientationPreference => reportPageOrientations[pageKey] ?? fallback;
  const togglePageOrientation = (pageKey: string, fallback: MvReportPageOrientationPreference = "portrait") => {
    const current = pageOrientation(pageKey, fallback);
    onReportPageOrientationChange?.(pageKey, current === "landscape" ? "portrait" : "landscape");
  };
  /**
   * سجلّ الأقسام الأساسية — كل عنصر هو نفس محتوى القسم الافتراضي الديناميكي بلا أي
   * تغيير في المنطق أو النص (مجرد إعادة تنظيم إلى خريطة يمكن الوصول لعناصرها بالاسم)،
   * بحيث يمكن لمسار قالب الذكاء الاصطناعي أدناه إعادة استخدام نفس المحتوى الموثوق
   * والمرتبط ببيانات المشروع الحالية، دون إعادة كتابته أو تكراره.
   *
   * لا يوجد أي تمييز بصري (لون/خط) خاص بقالب AI هنا عمداً: الأقسام المطابقة والأقسام
   * العامة تُعرض بنفس تصميم وألوان وخط القالب الافتراضي المُختبَر تماماً، لضمان تقرير
   * نهائي متسق ومهني بصرياً بصرف النظر عن الملف المرفوع (الذي قد يحوي ألواناً أو
   * تصميماً غير مناسبين لتقرير رسمي).
   */
  const topic_intro: ReactNode = (
        <section key="mv-toc-1" id="mv-toc-1" data-mv-report-insert-anchor="mv-toc-1" className="space-y-3">
          {editableHeading("mv-toc-1", mvReportTocHeading("mv-toc-1"))}
          <div className="space-y-3 text-[12px] font-medium leading-7 text-slate-800">
            <EditableBlock
              value={editableText(
                "paragraph.intro",
                `تم التقييم وإصدار هذا التقرير وفقاً لاتفاقية تنفيذ أعمال التقييم بين شركة ${textValue(companyName, "الجهة المُقيِّمة")} للعميل ${clientName} حسب نطاق العمل المتفق عليه والموضح في «نطاق التقييم»، وذلك بغرض ${textValue(reportData.valuationPurpose, "التقييم")} على أساس ${textValue(reportData.valuationBasis, "القيمة السوقية")} في تاريخ التقييم ${dateValue(reportData.valuationDate)} م.`,
              )}
              onChange={(value) => setTextOverride("paragraph.intro", value)}
              className="leading-7"
            />
          </div>
          <ClearableRichHtmlField html={introExtraHtml} onHtmlChange={onIntroExtraHtml} />
          {insertedAfter("mv-toc-1")}
        </section>
  );
  const topic_datesUsed: ReactNode = (
        <section key="mv-toc-2" id="mv-toc-2" data-mv-report-insert-anchor="mv-toc-2" className="mt-6">
          {editableHeading("mv-toc-2", mvReportTocHeading("mv-toc-2"))}
          <ul className="list-disc space-y-1.5 pe-4 text-[12px] font-semibold text-slate-800" style={{ lineHeight: "var(--mv-paragraph-leading, 1.75)" }}>
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
  );
  const topic_compliance: ReactNode = (
        <section key="mv-toc-3" id="mv-toc-3" data-mv-report-insert-anchor="mv-toc-3" className="mt-2 space-y-2">
          {editableHeading("mv-toc-3", mvReportTocHeading("mv-toc-3"))}
          {narrativeBlock("section.complianceStatement", renderCompanyDefault("scope", "complianceStatement"))}
          {insertedAfter("mv-toc-3")}
        </section>
  );
  const topic_independence: ReactNode = (
        <section key="mv-toc-4" id="mv-toc-4" data-mv-report-insert-anchor="mv-toc-4" className="mt-5 space-y-2">
          {editableHeading("mv-toc-4", mvReportTocHeading("mv-toc-4"))}
          {narrativeBlock("section.independenceStatement", renderCompanyDefault("scope", "independenceStatement"))}
          {insertedAfter("mv-toc-4")}
        </section>
  );
  const topic_valuerIdentity: ReactNode = (
        <section key="mv-toc-5" id="mv-toc-5" data-mv-report-insert-anchor="mv-toc-5" className="mt-5 space-y-2">
          {editableHeading("mv-toc-5", mvReportTocHeading("mv-toc-5"))}
          {narrativeBlock(
            "section.valuerIdentity",
            [
              `يتولى عمليات التقييم شركة ${textValue(companyName, "الجهة المُقيِّمة")}${
                valuationFirmLicense ? ` للتقييم ترخيص رقم: ${valuationFirmLicense}` : ""
              }${
                reportData.valuationFirmAddress?.trim()
                  ? `، وعنوانها الرئيسي: ${reportData.valuationFirmAddress.trim()}`
                  : ""
              }.`,
              `يقود تقييم هذا التقرير ${leadValuerName ? `الأستاذ ${leadValuerName}` : "المقيم المسؤول"}${
                reportData.leadValuerTitle?.trim() ? `، ${reportData.leadValuerTitle.trim()}` : ""
              }${
                reportData.leadValuerMembershipNo?.trim() || leadValuerMembershipFallback
                  ? `، عضوية رقم: ${(reportData.leadValuerMembershipNo?.trim() || leadValuerMembershipFallback).trim()}`
                  : ""
              }.`,
            ].join("\n"),
          )}
          {insertedAfter("mv-toc-5")}
        </section>
  );
  const topic_clientIdentity: ReactNode = (
        <section key="mv-toc-6" id="mv-toc-6" data-mv-report-insert-anchor="mv-toc-6" className="mt-5 space-y-2">
          {editableHeading("mv-toc-6", mvReportTocHeading("mv-toc-6"))}
          {narrativeBlock(
            "section.clientIdentity",
            `بحسب اتفاقية تنفيذ أعمال التقييم فإن العميل هو ${textValue(clientName, "العميل")}${
              reportData.clientLegalType?.trim() ? ` نوعها ${reportData.clientLegalType.trim()}` : ""
            }${
              reportData.clientActivity?.trim() ? ` نشاطها ${reportData.clientActivity.trim()}` : ""
            }${
              clientRepresentativeName ? ` يمثلها الأستاذ/${clientRepresentativeName}` : ""
            }${
              reportData.clientRepresentativeRole?.trim()
                ? ` صفته ${reportData.clientRepresentativeRole.trim()}`
                : ""
            }.`,
          )}
          {insertedAfter("mv-toc-6")}
        </section>
  );
  const topic_intendedUsers: ReactNode = (
        <section key="mv-toc-7" id="mv-toc-7" data-mv-report-insert-anchor="mv-toc-7" className="mt-5 space-y-2">
          {editableHeading("mv-toc-7", mvReportTocHeading("mv-toc-7"))}
          {narrativeBlock(
            "section.intendedUsers",
            textValue(reportData.intendedUsers, "لا يوجد مستخدمون مقصودون آخرون."),
          )}
          {insertedAfter("mv-toc-7")}
        </section>
  );
  const topic_assetSummary: ReactNode = (
        <section
          key="mv-toc-asset-summary"
          id="mv-toc-asset-summary"
          data-mv-report-insert-anchor="mv-toc-asset-summary"
          className="mt-5 space-y-2"
        >
          {editableHeading("mv-toc-asset-summary", mvReportTocHeading("mv-toc-asset-summary"))}
          {narrativeBlock(
            "section.assetSummary",
            `${
              assetFolderLabels.length > 0
                ? `${assetFolderLabels.join("، ")}. `
                : ""
            }${MV_DEFAULT_ASSET_SUMMARY_TEXT}`,
          )}
          {insertedAfter("mv-toc-asset-summary")}
        </section>
  );
  const topic_scopeOfWork: ReactNode = (
        <section key="mv-toc-8" id="mv-toc-8" data-mv-report-insert-anchor="mv-toc-8" className="mt-2 space-y-2">
          {editableHeading("mv-toc-8", mvReportTocHeading("mv-toc-8"))}
          {narrativeBlock(
            "scopeOfWorkDetails",
            fieldOrCompanyDefault(reportData.scopeOfWorkDetails, "scope", "scopeOfWorkDetails"),
          )}
          {insertedAfter("mv-toc-8")}
        </section>
  );
  const topic_valuationPurpose: ReactNode = (
        <section key="mv-toc-9" id="mv-toc-9" data-mv-report-insert-anchor="mv-toc-9" className="mt-5 space-y-2">
          {editableHeading("mv-toc-9", mvReportTocHeading("mv-toc-9"))}
          {narrativeBlock(
            "section.valuationPurpose",
            `الغرض المتبع في هذا التقرير لتقييم الأصل كما في نطاق التقييم هو ${textValue(reportData.valuationPurpose, "غير محدد")}، حيث أن الغرض يحدد أساس القيمة المناسب حسب الحالة العامة للاستخدام المقصود من التقرير.`,
          )}
          {insertedAfter("mv-toc-9")}
        </section>
  );
  const topic_intendedUse: ReactNode = (
        <section key="mv-toc-10" id="mv-toc-10" data-mv-report-insert-anchor="mv-toc-10" className="mt-5 space-y-2">
          {editableHeading("mv-toc-10", mvReportTocHeading("mv-toc-10"))}
          {narrativeBlock(
            "section.intendedUse",
            reportData.intendedUse?.trim()
              ? `يتم استخدام هذا التقرير للعميل ${textValue(clientName, "العميل")} لمساعدته في إجراءات ${reportData.intendedUse.trim()} للأصول محل التقييم.`
              : renderCompanyDefault("scope", "intendedUseStatement"),
          )}
          {insertedAfter("mv-toc-10")}
        </section>
  );
  const topic_valuationBasis: ReactNode = (
        <section key="mv-toc-11" id="mv-toc-11" data-mv-report-insert-anchor="mv-toc-11" className="mt-5 space-y-2">
          {editableHeading("mv-toc-11", mvReportTocHeading("mv-toc-11"))}
          {narrativeBlock(
            "section.valuationBasisIntro",
            `الأساس المناسب هو: ${textValue(reportData.valuationBasis, "القيمة السوقية")}.`,
          )}
          {narrativeBlock(
            "valuationBasisDefinition",
            fieldOrCompanyDefault(
              reportData.valuationBasisDefinition,
              "scope",
              "valuationBasisDefinition",
            ),
          )}
          {insertedAfter("mv-toc-11")}
        </section>
  );
  const topic_valuePremise: ReactNode = (
        <section key="mv-toc-12" id="mv-toc-12" data-mv-report-insert-anchor="mv-toc-12" className="mt-5 space-y-2">
          {editableHeading("mv-toc-12", mvReportTocHeading("mv-toc-12"))}
          {narrativeBlock(
            "valuePremise",
            reportData.valuePremiseDefinition?.trim() ||
              reportData.valuePremise?.trim() ||
              companyDefault("scope", "valuePremiseDefinition") ||
              "غير محدد.",
          )}
          {insertedAfter("mv-toc-12")}
        </section>
  );
  const topic_useRestriction: ReactNode = (
        <section key="mv-toc-13" id="mv-toc-13" data-mv-report-insert-anchor="mv-toc-13" className="mt-5 space-y-2">
          {editableHeading("mv-toc-13", mvReportTocHeading("mv-toc-13"))}
          {narrativeBlock(
            "useRestriction",
            reportData.useRestriction?.trim() || renderCompanyDefault("scope", "useRestriction"),
          )}
          {insertedAfter("mv-toc-13")}
        </section>
  );
  const topic_externalSpecialists: ReactNode = (
        <section key="mv-toc-14" id="mv-toc-14" data-mv-report-insert-anchor="mv-toc-14" className="mt-2 space-y-2">
          {editableHeading("mv-toc-14", mvReportTocHeading("mv-toc-14"))}
          {narrativeBlock(
            "externalSpecialistUse",
            fieldOrCompanyDefault(reportData.externalSpecialistUse, "scope", "externalSpecialistUse"),
          )}
          {insertedAfter("mv-toc-14")}
        </section>
  );
  const topic_esg: ReactNode = (
        <section key="mv-toc-15" id="mv-toc-15" data-mv-report-insert-anchor="mv-toc-15" className="mt-5 space-y-2">
          {editableHeading("mv-toc-15", mvReportTocHeading("mv-toc-15"))}
          {narrativeBlock(
            "esgConsiderations",
            fieldOrCompanyDefault(reportData.esgConsiderations, "scope", "esgConsiderations"),
          )}
          {insertedAfter("mv-toc-15")}
        </section>
  );
  const topic_reportType: ReactNode = (
        <section key="mv-toc-16" id="mv-toc-16" data-mv-report-insert-anchor="mv-toc-16" className="mt-5 space-y-2">
          {editableHeading("mv-toc-16", mvReportTocHeading("mv-toc-16"))}
          {narrativeBlock(
            "section.reportTypeLine",
            `نوع التقرير ${textValue(reportData.reportTypeLabel, "مفصَّل")} ويتم إيصال التقييم عن طريق البريد الإلكتروني.`,
          )}
          {insertedAfter("mv-toc-16")}
        </section>
  );
  const topic_informationSources: ReactNode = (
        <section key="mv-toc-17" id="mv-toc-17" data-mv-report-insert-anchor="mv-toc-17" className="mt-5 space-y-2">
          {editableHeading("mv-toc-17", mvReportTocHeading("mv-toc-17"))}
          {narrativeBlock(
            "informationSources",
            fieldOrCompanyDefault(reportData.informationSources, "scope", "informationSources"),
          )}
          {insertedAfter("mv-toc-17")}
        </section>
  );
  const topic_assetSubject: ReactNode = (
        <section key="mv-toc-18" id="mv-toc-18" data-mv-report-insert-anchor="mv-toc-18" className="space-y-2">
          {editableHeading("mv-toc-18", mvReportTocHeading("mv-toc-18"))}
          {narrativeBlock(
            "section.assetSubjectIntro",
            `${
              assetFolderLabels.length > 0
                ? `يشمل الأصل محل التقييم: ${assetFolderLabels.join("، ")}. `
                : ""
            }${fieldOrCompanyDefault(reportData.assetSubjectDescription, "methodology", "assetSubjectDescription")}`,
          )}
          {insertedAfter("mv-toc-18")}
        </section>
  );
  const topic_partialDescription: ReactNode = (
        <section key="mv-toc-18-1" id="mv-toc-18-1" data-mv-report-insert-anchor="mv-toc-18-1" className="mt-5 space-y-2">
          {editableHeading("mv-toc-18-1", mvReportTocHeading("mv-toc-18-1"))}
          {narrativeBlock(
            "section.partialDescriptionIntro",
            "يُعرض الوصف الجزئي وحسابات القيمة في «مرفق 1»، والصور في «مرفق 2»، والمستندات المستلمة من العميل في «مرفق 3»، وبيان شهادة التسجيل في بوابة «تقييم» في «مرفق 4».",
          )}
          {narrativeBlock(
            "assetDetailedDescription",
            fieldOrCompanyDefault(
              reportData.assetDetailedDescription,
              "methodology",
              "assetDetailedDescription",
            ),
          )}
          {insertedAfter("mv-toc-18-1")}
        </section>
  );
  const topic_exclusions: ReactNode = (
        <section
          key="mv-toc-exclusions"
          id="mv-toc-exclusions"
          data-mv-report-insert-anchor="mv-toc-exclusions"
          className="mt-5 space-y-2"
        >
          {editableHeading("mv-toc-exclusions", mvReportTocHeading("mv-toc-exclusions"))}
          {narrativeBlock("section.exclusionsList", MV_DEFAULT_EXCLUSIONS_TEXT)}
          {insertedAfter("mv-toc-exclusions")}
        </section>
  );
  const topic_currency: ReactNode = (
        <section key="mv-toc-19" id="mv-toc-19" data-mv-report-insert-anchor="mv-toc-19" className="mt-5 space-y-2">
          {editableHeading("mv-toc-19", mvReportTocHeading("mv-toc-19"))}
          {narrativeBlock(
            "section.currencyLine",
            `العملة المستخدمة هي ${effectiveCurrencyLabel}.`,
          )}
          {insertedAfter("mv-toc-19")}
        </section>
  );
  const topic_valuationProcedures: ReactNode = (
        <section
          key="mv-toc-procedures"
          id="mv-toc-procedures"
          data-mv-report-insert-anchor="mv-toc-procedures"
          className="mt-5 space-y-2"
        >
          {editableHeading("mv-toc-procedures", mvReportTocHeading("mv-toc-procedures"))}
          {narrativeBlock("section.valuationProcedures", MV_DEFAULT_VALUATION_PROCEDURES_TEXT)}
          {insertedAfter("mv-toc-procedures")}
        </section>
  );
  const topic_inspection: ReactNode = (
        <section key="mv-toc-20" id="mv-toc-20" data-mv-report-insert-anchor="mv-toc-20" className="mt-5 space-y-2">
          {editableHeading("mv-toc-20", mvReportTocHeading("mv-toc-20"))}
          {narrativeBlock(
            "section.inspectionLine",
            `تمت المعاينة في ${effectiveInspectionLocation} بتاريخ ${dateValue(reportData.inspectionDate)} م.${
              effectiveInspectionMapUrl ? `\nالموقع: ${effectiveInspectionMapUrl}` : ""
            }`,
            "break-words",
          )}
          {insertedAfter("mv-toc-20")}
        </section>
  );
  const topic_methodologyRationale: ReactNode = (
        <section key="mv-toc-21" id="mv-toc-21" data-mv-report-insert-anchor="mv-toc-21" className="mt-2 space-y-2">
          {editableHeading("mv-toc-21", mvReportTocHeading("mv-toc-21"))}
          {narrativeBlock(
            "methodologyRationale",
            fieldOrCompanyDefault(reportData.methodologyRationale, "methodology", "methodologyRationale"),
          )}
          {insertedAfter("mv-toc-21")}
        </section>
  );
  const topic_assumptions: ReactNode = (
        <section key="mv-toc-23" id="mv-toc-23" data-mv-report-insert-anchor="mv-toc-23" className="mt-5 space-y-2">
          {editableHeading("mv-toc-23", mvReportTocHeading("mv-toc-23"))}
          {narrativeBlock(
            "generalAssumptions",
            fieldOrCompanyDefault(
              reportData.generalAssumptions || reportData.importantAssumptions,
              "assumptions",
              "generalAssumptions",
            ),
          )}
          {(() => {
            const specialText = fieldOrCompanyDefault(
              reportData.specialAssumptions,
              "assumptions",
              "specialAssumptions",
            );
            return specialText.trim() ? narrativeBlock("specialAssumptions", specialText) : null;
          })()}
          {insertedAfter("mv-toc-23")}
        </section>
  );
  const topic_valueOpinion: ReactNode = (
        <section key="mv-toc-24" id="mv-toc-24" data-mv-report-insert-anchor="mv-toc-24">
          {editableHeading("mv-toc-24", mvReportTocHeading("mv-toc-24"))}
          <div className="mt-3 space-y-6 text-right">
            <EditableBlock
              value={editableText("paragraph.valueOpinion", valueOpinionSentence)}
              onChange={(value) => setTextOverride("paragraph.valueOpinion", value)}
              className="text-[12.5px] font-semibold leading-8 text-slate-950"
            />
            {preparerDisplayRows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-[12px] font-semibold text-slate-500">
                لا صفوف من لوحة الشركة — أضف مقيّمين وتوقيعات من لوحة إدارة الشركة.
              </p>
            ) : (
              <div className="mx-auto max-w-[620px]" dir="rtl">
                <div className="grid grid-cols-[minmax(210px,1.35fr)_minmax(180px,1fr)_minmax(105px,0.7fr)] items-center gap-x-5 border-b border-slate-200 pb-2 text-center text-[11.5px] font-bold text-slate-950">
                  <EditableBlock
                    value={labelText("preparer.details", "بيانات المقيم")}
                    onChange={(value) => setTextOverride("label.preparer.details", value)}
                    className="min-h-[1.25rem] text-center"
                    multiline={false}
                  />
                  <EditableBlock
                    value={labelText("preparer.role", "دور المقيم")}
                    onChange={(value) => setTextOverride("label.preparer.role", value)}
                    className="min-h-[1.25rem] text-center"
                    multiline={false}
                  />
                  <EditableBlock
                    value={labelText("preparer.signature", "التوقيع")}
                    onChange={(value) => setTextOverride("label.preparer.signature", value)}
                    className="min-h-[1.25rem] text-center"
                    multiline={false}
                  />
                </div>
                {preparerDisplayRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid min-h-[88px] grid-cols-[minmax(210px,1.35fr)_minmax(180px,1fr)_minmax(105px,0.7fr)] items-center gap-x-5 border-b border-slate-100 py-2 last:border-b-0"
                  >
                    <div className="space-y-0.5 text-center text-slate-950">
                      <p className="text-[12px] font-bold leading-6">{row.name || "—"}</p>
                      <p className="text-[11px] font-semibold leading-5">{row.jobTitle || "—"}</p>
                      <p className="text-[10.5px] font-bold leading-5 tabular-nums">
                        {row.membershipNo ? `عضوية رقم: ${row.membershipNo}` : "عضوية رقم: —"}
                      </p>
                    </div>
                    <div className="flex min-h-[58px] items-center justify-center">
                      <EditableBlock
                        dir="rtl"
                        value={row.roleLabel}
                        onChange={(value) => updatePreparerRole(row.id, value)}
                        className="mv-report-preparer-field min-h-10 w-full rounded border border-transparent bg-transparent px-1 py-1 text-center text-[11.5px] font-semibold leading-5 outline-none focus:border-sky-300 print:border-0"
                        multiline
                      />
                    </div>
                    <div className="flex min-h-[58px] items-center justify-center">
                      {!sheetDraft && row.signatureImageDataUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={row.signatureImageDataUrl}
                          alt=""
                          className="max-h-[58px] max-w-[105px] object-contain"
                        />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-1 flex justify-center">
              <div className="min-w-[170px] text-center">
                <EditableBlock
                  value={labelText("preparer.stamp", "الختم")}
                  onChange={(value) => setTextOverride("label.preparer.stamp", value)}
                  className="min-h-[1.25rem] text-center text-[11.5px] font-semibold text-slate-950"
                  multiline={false}
                />
                {!sheetDraft && letterheadTemplate?.enabled && letterheadTemplate.signatureStampDataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={letterheadTemplate.signatureStampDataUrl}
                    alt=""
                    className="mx-auto mt-1 max-h-16 max-w-[170px] object-contain"
                  />
                ) : (
                  <div className="mx-auto mt-3 h-px w-[150px] bg-slate-300" />
                )}
              </div>
            </div>
          </div>
          {insertedAfter("mv-toc-24")}
        </section>
  );
  const topic_costApproach: ReactNode = (
    <Fragment key="mv-toc-22">
        <section key="mv-toc-22" id="mv-toc-22" data-mv-report-insert-anchor="mv-toc-22" className="mt-5 space-y-2">
          {editableHeading("mv-toc-22", applyApproachHeading)}
          {narrativeBlock(
            "costApproachDetails",
            fieldOrCompanyDefault(reportData.costApproachDetails, "methodology", "costApproachDetails"),
          )}
          {insertedAfter("mv-toc-22")}
        </section>
        {showCostSubSections ? (
          <>
            <section key="mv-toc-22-1" id="mv-toc-22-1" data-mv-report-insert-anchor="mv-toc-22-1" className="mt-5 space-y-2">
              {editableHeading("mv-toc-22-1", mvReportTocHeading("mv-toc-22-1"))}
              {narrativeBlock("salvageValueDescription", companyDefault("methodology", "salvageValueDescription"))}
              {insertedAfter("mv-toc-22-1")}
            </section>

            <section key="mv-toc-22-2" id="mv-toc-22-2" data-mv-report-insert-anchor="mv-toc-22-2" className="mt-5 space-y-2">
              {editableHeading("mv-toc-22-2", mvReportTocHeading("mv-toc-22-2"))}
              {narrativeBlock(
                "physicalDepreciationDescription",
                companyDefault("methodology", "physicalDepreciationDescription"),
              )}
              {insertedAfter("mv-toc-22-2")}
            </section>

            <section key="mv-toc-22-3" id="mv-toc-22-3" data-mv-report-insert-anchor="mv-toc-22-3" className="mt-5 space-y-2">
              {editableHeading("mv-toc-22-3", mvReportTocHeading("mv-toc-22-3"))}
              {narrativeBlock(
                "functionalObsolescenceDescription",
                companyDefault("methodology", "functionalObsolescenceDescription"),
              )}
              {insertedAfter("mv-toc-22-3")}
            </section>

            <section key="mv-toc-22-4" id="mv-toc-22-4" data-mv-report-insert-anchor="mv-toc-22-4" className="mt-5 space-y-2">
              {editableHeading("mv-toc-22-4", mvReportTocHeading("mv-toc-22-4"))}
              {narrativeBlock(
                "economicObsolescenceDescription",
                companyDefault("methodology", "economicObsolescenceDescription"),
              )}
              {insertedAfter("mv-toc-22-4")}
            </section>
          </>
        ) : null}
    </Fragment>
  );

  const narrativeB1Node: ReactNode = narrativeB1?.trim() ? (
    <div key="mv-narrative-b1" className="mb-3">
      <ClearableRichHtmlField html={narrativeB1} onHtmlChange={onNarrativeB1} />
    </div>
  ) : null;
  const narrativeB2Node: ReactNode = narrativeB2?.trim() ? (
    <div key="mv-narrative-b2" className="mb-3">
      <ClearableRichHtmlField html={narrativeB2} onHtmlChange={onNarrativeB2} />
    </div>
  ) : null;
  const narrativeB3Node: ReactNode = narrativeB3?.trim() ? (
    <div key="mv-narrative-b3" className="mb-3">
      <ClearableRichHtmlField html={narrativeB3} onHtmlChange={onNarrativeB3} />
    </div>
  ) : null;
  const narrativeB4Node: ReactNode = narrativeB4?.trim() ? (
    <div key="mv-narrative-b4" className="mb-3">
      <ClearableRichHtmlField html={narrativeB4} onHtmlChange={onNarrativeB4} />
    </div>
  ) : null;

  const topicSections: Partial<Record<MvAiReportTopicKey, ReactNode>> = {
    intro: topic_intro,
    datesUsed: topic_datesUsed,
    compliance: topic_compliance,
    independence: topic_independence,
    valuerIdentity: topic_valuerIdentity,
    clientIdentity: topic_clientIdentity,
    intendedUsers: topic_intendedUsers,
    assetSummary: topic_assetSummary,
    scopeOfWork: topic_scopeOfWork,
    valuationPurpose: topic_valuationPurpose,
    intendedUse: topic_intendedUse,
    valuationBasis: topic_valuationBasis,
    valuePremise: topic_valuePremise,
    useRestriction: topic_useRestriction,
    externalSpecialists: topic_externalSpecialists,
    esg: topic_esg,
    reportType: topic_reportType,
    informationSources: topic_informationSources,
    assetSubject: topic_assetSubject,
    partialDescription: topic_partialDescription,
    exclusions: topic_exclusions,
    currency: topic_currency,
    valuationProcedures: topic_valuationProcedures,
    inspection: topic_inspection,
    methodologyRationale: topic_methodologyRationale,
    assumptions: topic_assumptions,
    valueOpinion: topic_valueOpinion,
    costApproach: topic_costApproach,
  };

  /** ترتيب العرض الافتراضي (غير مرتبط بقالب AI) — مطابق تماماً لما كان موجوداً سابقاً. */
  const defaultFlowChildren: ReactNode[] = [
    topic_intro,
    topic_datesUsed,
    narrativeB1Node,
    topic_compliance,
    topic_independence,
    topic_valuerIdentity,
    topic_clientIdentity,
    topic_intendedUsers,
    topic_assetSummary,
    narrativeB2Node,
    topic_scopeOfWork,
    topic_valuationPurpose,
    topic_intendedUse,
    topic_valuationBasis,
    topic_valuePremise,
    topic_useRestriction,
    narrativeB3Node,
    topic_externalSpecialists,
    topic_esg,
    topic_reportType,
    topic_informationSources,
    topic_assetSubject,
    topic_partialDescription,
    topic_exclusions,
    topic_currency,
    topic_valuationProcedures,
    topic_inspection,
    narrativeB4Node,
    topic_methodologyRationale,
    topic_costApproach,
    topic_assumptions,
    topic_valueOpinion,
  ];

  /**
   * عند تطبيق قالب ذكاء اصطناعي، نستبدل القائمة الثابتة أعلاه بقائمة مبنية من
   * `aiTemplate.sections` — كل قسم مكتشف من AI يُطابَق بموضوع من `topicSections`
   * (فيُعرض محتواه الديناميكي الموثوق كما هو)، أو يُعرض كقسم AI عام مستقل إن لم
   * يطابق أي موضوع معروف. الأقسام الافتراضية غير المُطابَقة لا تُعرض إطلاقاً —
   * وهذا ما يُخفي القالب الأساسي فعلياً عند تفعيل قالب AI، بدل تراكب الاثنين.
   */
  const aiVariableContext: MvAiVariableContext = {
    projectName: projectDisplayName,
    clientName,
    clientPhone,
    clientEmail,
    companyName,
    valuationDateDisplay: dateValue(reportData.valuationDate),
    reportIssueDateDisplay: dateValue(reportData.reportIssueDate),
    inspectionDateDisplay: dateValue(reportData.inspectionDate),
    finalValueDisplay,
    finalValueWords,
    currencyLabel: effectiveCurrencyLabel,
    reportReference: referenceLabel,
    reportTitle,
    leadValuerName,
    assetFolderLabelsText: assetFolderLabels.join("، "),
    assetImagesCountText:
      orderedImages.length > 0 ? `${orderedImages.length} صورة أصول مرفقة في مرفق 2` : "",
    valuationImagesCountText:
      valuationAccountImages.length > 0
        ? `${valuationAccountImages.length} صورة حسابات قيمة مرفقة في مرفق 1`
        : "",
    signatoryNamesText: preparerDisplayRows.map((row) => row.name).filter(Boolean).join("، "),
  };
  const aiFlow = buildAiReportFlowChildren({
    aiTemplate,
    topicSections,
    ctx: aiVariableContext,
  });
  const flowChildren: ReactNode[] = aiFlow?.nodes ?? defaultFlowChildren;
  /**
   * فهرس (TOC) مطابق تماماً لما يظهر فعلاً في المتن عند تفعيل قالب AI — بترقيم تسلسلي
   * نظيف (1.0، 2.0…) بدل الفهرس الثابت الذي كان يسرد الأقسام الافتراضية الـ27 كاملة
   * دوماً، بصرف النظر عمّا اختاره قالب AI فعلياً (وهو ما كان يجعل الفهرس مضللاً/غير
   * مطابق للمحتوى الحقيقي في التقرير).
   */
  const tocRows: MvReportTocRow[] = aiFlow
    ? aiFlow.tocRows.map((row, index) => ({ ...row, num: `${index + 1}.0` }))
    : MV_REPORT_TOC_ROWS;
  const usesValueTechOfficialLayout =
    !aiFlow && (letterheadTemplate?.templateId ?? "default-report-template") === "default-report-template";
  const renderNarrativeFlow = (nodes: ReactNode[], groupId: string) => (
    <ReportFlowPages
      shellProps={interiorShellProps}
      forceBreakAfterAnchors={flowForceBreakAnchors}
      renderCustomAfterAnchor={customSectionsAfter}
      renderPageEndCue={(lastAnchorId) => (
        <InsertSectionCue
          afterAnchorId={lastAnchorId}
          onAdd={addEditableSection}
          onDropSection={moveEditableSectionTo}
        />
      )}
      measureRevision={`${flowMeasureRevision}:${groupId}`}
      measureEnvStyle={{
        ["--mv-paragraph-leading" as string]: String(paragraphLineHeight),
        ["--mv-heading-scale" as string]: String(headingScale),
      }}
    >
      {nodes}
    </ReportFlowPages>
  );
  return (
    <MvReportLetterheadProvider value={letterheadTemplate}>
    <div
      dir="rtl"
      className="mv-report-canvas-root mx-auto flex w-max flex-col items-center text-right"
      style={{
        gap: sectionGap,
        // CSS variables drive the heading scale and paragraph leading without
        // patching each component — capture also picks them up because the
        // PDF render shares the same DOM.
        ["--mv-heading-scale" as never]: headingScale,
        ["--mv-paragraph-leading" as never]: paragraphLineHeight,
        ["--mv-image-radius" as never]: `${imageCornerRadius}px`,
        ["--mv-image-shadow" as never]: imageShadowFilter ?? "none",
      } as CSSProperties}
      onContextMenuCapture={openInsertMenu}
      onClickCapture={(event) => {
        const target = event.target as HTMLElement | null;
        if (insertMenu && !target?.closest("[data-mv-report-insert-menu]")) setInsertMenu(null);
      }}
    >
      <style>{reportRenderCss}</style>
      {hiddenAnchorIds.length > 0 ? (
        <div
          className="mv-report-chrome w-full max-w-3xl rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-right text-[11px] shadow-sm print:hidden"
          dir="rtl"
        >
          <p className="mb-1.5 flex items-center gap-1 font-black text-amber-900">
            <EyeOff className="h-3.5 w-3.5" />
            أقسام مخفية ({hiddenAnchorIds.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {hiddenAnchorIds.map((anchorId) => {
              const tocRow = MV_REPORT_TOC_ROWS.find((row) => row.anchor === anchorId);
              const label = tocRow ? `${tocRow.num} ${tocRow.title}` : anchorId;
              return (
                <button
                  key={anchorId}
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10.5px] font-bold text-amber-900 transition hover:bg-amber-100"
                  onClick={() => toggleHiddenAnchor(anchorId, false)}
                  title="استعادة القسم"
                >
                  <ArrowUp className="h-3 w-3" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
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
              if (dataUrl)
                addInsertedBlock(
                  pendingImageAnchorRef.current,
                  "image",
                  dataUrl,
                  pendingImagePositionRef.current,
                );
            })
            .catch(() => undefined);
        }}
      />
      <input
        ref={receivedDocsPdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          handleReceivedDocsPickedFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={receivedDocsImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          handleReceivedDocsPickedFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={scePdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          handleScePickedFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={sceImageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          handleScePickedFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {insertMenuNode}
      <MvReportPageShell
        variant="cover"
        companyName={companyName}
        companyNameNode={editableCoverCompanyNameNode}
        commercialRegistration={commercialRegistration}
        logoSrc={logoSrc}
        footerLines={identityFooterLines}
        draftWatermark={sheetDraft}
        coverChildrenChromeless
        coverFooterContent={reportIdentityFooter}
      >
        {/*
          محتوى الغلاف الرئيسي — مبسّط ليطابق تصميم تقارير الجهات المهنية:
          • عنوان كبير في المنتصف السفلي بخط أبيض على الخلفية الكحلية مباشرة.
          • اسم العميل بارزاً تحت العنوان مع قوسين كما في النموذج.
          • فاصل ذهبي رفيع بين العنوان واسم العميل.
          الفوتر بثلاثة أعمدة يُمرَّر عبر ‎coverFooterContent‎.
        */}
        <div
          id="report-cover"
          data-mv-report-insert-anchor="report-cover"
          className="w-full max-w-3xl space-y-5 text-center"
        >
          <EditableBlock
            value={reportTitle}
            onChange={(value) => setTextOverride("reportTitle", value)}
            className={cn(
              "mx-auto px-3 py-2 text-center text-[28px] font-black leading-[1.25] tracking-tight text-white sm:text-[36px]",
              coverPrimaryTextClass,
            )}
            placeholder="عنوان التقرير"
          />

          <div
            aria-hidden
            className="mx-auto h-[3px] w-[120px] rounded-full bg-gradient-to-l from-transparent via-[#c9a227] to-transparent"
          />

          <EditableBlock
            value={clientName ? `(${clientName})` : "—"}
            onChange={(value) => {
              const trimmed = value.trim().replace(/^\(/, "").replace(/\)$/, "");
              setTextOverride("clientName", trimmed);
            }}
            className={cn(
              "mx-auto max-w-xl px-2 text-center text-[16px] font-extrabold leading-7 text-white sm:text-[20px]",
              coverSecondaryTextClass,
            )}
            multiline={false}
            placeholder="(اسم العميل)"
          />

        </div>
      </MvReportPageShell>

      {insertedAfterOnOwnPages("report-cover")}

      {boundary("report-cover")}

      <MvReportTocPages
        companyName={companyName}
        companyNameNode={editableCompanyNameNode}
        commercialRegistration={commercialRegistration}
        logoSrc={logoSrc}
        footerLines={identityFooterLines}
        draftWatermark={sheetDraft}
        editableSections={editableSections}
        rows={tocRows}
        tocApproxPages={tocApproxPages}
        onTocAnchorClick={onTocAnchorClick}
        editableText={editableText}
        labelText={labelText}
        setTextOverride={setTextOverride}
        updateEditableSection={updateEditableSection}
        insertedAfter={insertedAfter}
        EditableBlock={EditableBlock}
      />

      {boundary("report-toc")}

      {usesValueTechOfficialLayout ? (
        <>
          <MvReportSectionDivider
            sequence={MV_REPORT_CHAPTERS[0].sequence}
            title={MV_REPORT_CHAPTERS[0].title}
            companyName={companyName}
            companyNameNode={editableCompanyNameNode}
            commercialRegistration={commercialRegistration}
            logoSrc={logoSrc}
            footerLines={identityFooterLines}
            coverFooterContent={reportIdentityFooter}
            draftWatermark={sheetDraft}
          />
          {renderNarrativeFlow(defaultFlowChildren.slice(0, 9), "governance")}
          <MvReportSectionDivider
            sequence={MV_REPORT_CHAPTERS[1].sequence}
            title={MV_REPORT_CHAPTERS[1].title}
            companyName={companyName}
            companyNameNode={editableCompanyNameNode}
            commercialRegistration={commercialRegistration}
            logoSrc={logoSrc}
            footerLines={identityFooterLines}
            coverFooterContent={reportIdentityFooter}
            draftWatermark={sheetDraft}
          />
          {renderNarrativeFlow(defaultFlowChildren.slice(9, 25), "scope")}
          <MvReportSectionDivider
            sequence={MV_REPORT_CHAPTERS[2].sequence}
            title={MV_REPORT_CHAPTERS[2].title}
            companyName={companyName}
            companyNameNode={editableCompanyNameNode}
            commercialRegistration={commercialRegistration}
            logoSrc={logoSrc}
            footerLines={identityFooterLines}
            coverFooterContent={reportIdentityFooter}
            draftWatermark={sheetDraft}
          />
          {renderNarrativeFlow(defaultFlowChildren.slice(25), "analysis")}
        </>
      ) : (
        renderNarrativeFlow(flowChildren, "primary")
      )}

      {/* Legacy custom sections without a target anchor render at the very end,
          right before the annexes. */}
      {editableSections
        .filter((section) => !section.insertAfterAnchorId)
        .map((section) => (
          <CustomSectionShell
            key={section.id}
            section={section}
            companyName={companyName}
            companyNameNode={editableCompanyNameNode}
            commercialRegistration={commercialRegistration}
            logoSrc={logoSrc}
            footerLines={identityFooterLines}
            draftWatermark={sheetDraft}
            onNumberChange={(value) => updateEditableSection(section.id, { sectionNumber: value })}
            onTitleChange={(value) => updateEditableSection(section.id, { title: value })}
            onBodyChange={(next) => updateEditableSection(section.id, { body: next })}
            onRemove={() => removeEditableSection(section.id)}
            insertedAfter={insertedAfter}
          />
        ))}

      {usesValueTechOfficialLayout ? (
        <MvReportSectionDivider
          sequence={MV_REPORT_CHAPTERS[3].sequence}
          title={MV_REPORT_CHAPTERS[3].title}
          companyName={companyName}
          companyNameNode={editableCompanyNameNode}
          commercialRegistration={commercialRegistration}
          logoSrc={logoSrc}
          footerLines={identityFooterLines}
          coverFooterContent={reportIdentityFooter}
          draftWatermark={sheetDraft}
        />
      ) : null}

      {!includeValuationAccountImages ? (
        <ReportFlowPages
          shellProps={interiorShellProps}
          measureRevision={`annex-valuation-disabled:${insertedBlocks.length}`}
        >
          <SectionShell
            id="mv-annex-1"
            title={
              <EditableBlock
                value={editableText("heading.mv-annex-1", "مرفق 1: حسابات القيمة")}
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
        </ReportFlowPages>
      ) : valuationAccountImages.length === 0 ? (
        <ReportFlowPages
          shellProps={interiorShellProps}
          measureRevision={`annex-valuation-empty:${insertedBlocks.length}`}
        >
          <SectionShell
            id="mv-annex-1"
            title={
              <EditableBlock
                value={editableText("heading.mv-annex-1", "مرفق 1: حسابات القيمة")}
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
        </ReportFlowPages>
      ) : (
        valuationSheets.map(({ approach, image }, vIdx) => {
          const anchorId = vIdx === 0 ? "mv-annex-1" : `mv-annex-1-${vIdx}`;
          const pageKey = `valuation:${image.id}`;
          return (
            <Fragment key={image.id}>
              <MvValuationAnnexImageSheet
                projectId={projectId}
                approach={approach}
                image={image}
                vIdx={vIdx}
                companyName={companyName}
                commercialRegistration={commercialRegistration}
                logoSrc={logoSrc}
                footerLines={identityFooterLines}
                valuationImageWidth={valuationImageWidth}
                imageCornerRadius={imageCornerRadius}
                imageShadow={imageShadow}
                draftWatermark={sheetDraft}
                resolveImageSrc={resolveImageSrc}
                forcedOrientation={reportPageOrientations[pageKey]}
                onOrientationChange={(orientation) => onReportPageOrientationChange?.(pageKey, orientation)}
                onDelete={hideValuationImage ? () => hideValuationImage(image.id) : undefined}
                titleNode={
                  <EditableBlock
                    value={editableText(
                      vIdx === 0 ? "heading.mv-annex-1" : `heading.mv-annex-1-${vIdx}`,
                      "مرفق 1: حسابات القيمة",
                    )}
                    onChange={(value) =>
                      setTextOverride(vIdx === 0 ? "heading.mv-annex-1" : `heading.mv-annex-1-${vIdx}`, value)
                    }
                    className="min-h-[1.75rem] text-[14px]"
                    multiline={false}
                  />
                }
              />
              {insertedAfterOnOwnPages(anchorId)}
            </Fragment>
          );
        })
      )}

      {assetPhotoChunks.map((chunk, chunkIdx) => {
        const anchorId = chunkIdx === 0 ? "mv-annex-2" : `mv-annex-2-${chunkIdx}`;
        const orientation = pageOrientation(anchorId, "portrait");
        return (
          <ReportFlowPages
            key={`assets-${chunkIdx}`}
            orientation={orientation}
            shellProps={{
              companyName,
              companyNameNode: editableCompanyNameNode,
              commercialRegistration,
              logoSrc,
              footerLines: identityFooterLines,
              draftWatermark: sheetDraft,
            }}
            measureRevision={`asset-photos:${anchorId}:${chunk.map((item) => item._id).join(",")}:${assetImageWidth}:${assetPhotosPerRow}`}
          >
            <SectionShell
              id={anchorId}
              title={
                <EditableBlock
                  value={editableText(
                    chunkIdx === 0 ? "heading.mv-annex-2" : `heading.mv-annex-2-${chunkIdx}`,
                    "مرفق 2: صور الأصول",
                  )}
                  onChange={(value) =>
                    setTextOverride(chunkIdx === 0 ? "heading.mv-annex-2" : `heading.mv-annex-2-${chunkIdx}`, value)
                  }
                  className="min-h-[1.75rem]"
                  multiline={false}
                />
              }
              headerExtra={
                <PageRotateButton
                  orientation={orientation}
                  onClick={() => togglePageOrientation(anchorId, "portrait")}
                />
              }
            >
            {!includeAssetImages ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-[12px] font-extrabold text-amber-900">
                تم إيقاف عرض صور الأصول من تبويب رفع الصور.
              </div>
            ) : chunk.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-white/80 px-5 py-10 text-center shadow-sm">
                <p className="text-[13px] font-black text-slate-700">لا توجد صور أصول محددة للتقرير.</p>
                <p className="mx-auto mt-2 max-w-md text-[11px] font-semibold leading-6 text-slate-500">
                  اختر الصور من خطوة «تحديد صور الأصول» أو من تبويب الصور في إعداد التقرير، وسيتم ترتيبها هنا تلقائياً قبل التصدير.
                </p>
              </div>
            ) : (
              <div
                className="flex flex-wrap gap-0 p-0"
                style={{ columnGap: imageInnerGap, rowGap: imageGroupGap }}
              >
                {chunk.map((file) => (
                  <AssetPhotoFigure
                    key={file._id}
                    file={file}
                    projectId={projectId}
                    widthPercent={assetImageWidth}
                    widthCss={assetPhotoWidthCss(orientation)}
                    cornerRadius={imageCornerRadius}
                    resolveImageSrc={resolveImageSrc}
                    pageOrientation={orientation}
                    onRotatePage={() => togglePageOrientation(anchorId, "portrait")}
                    uniformSize={assetImagesUniformSize}
                    onReorder={(fromId, toId) => {
                      if (!setImageOrder) {
                        moveImage(fromId, 0 as -1 | 1);
                        return;
                      }
                      setImageOrder((current) => {
                        if (fromId === toId) return current;
                        const next = current.filter((id) => id !== fromId);
                        const toIndex = next.indexOf(toId);
                        if (toIndex < 0) return [...next, fromId];
                        next.splice(toIndex, 0, fromId);
                        return next;
                      });
                    }}
                    onDelete={() => hideImage(file._id)}
                  />
                ))}
              </div>
            )}
              {insertedAfter(anchorId)}
            </SectionShell>
          </ReportFlowPages>
        );
      })}

      {clientDocChunks.map((chunk, chunkIdx) => {
        const anchorId = chunkIdx === 0 ? "mv-annex-3" : `mv-annex-3-${chunkIdx}`;
        const orientation = pageOrientation(anchorId, "portrait");
        return (
          <ReportFlowPages
            key={`client-docs-${chunkIdx}`}
            orientation={orientation}
            fitToPage={chunk.length > 0}
            shellProps={{
              companyName,
              companyNameNode: editableCompanyNameNode,
              commercialRegistration,
              logoSrc,
              footerLines: identityFooterLines,
              footerContent: interiorIdentityFooter,
              draftWatermark: sheetDraft,
            }}
            measureRevision={`client-documents:${anchorId}:${chunk.map((item) => item.id).join(",")}:${receivedClientDocumentsHtml}`}
          >
            <SectionShell
              id={anchorId}
              className="flex h-full min-h-0 flex-1 flex-col"
              title={
                <EditableBlock
                  value={editableText(
                    chunkIdx === 0 ? "heading.mv-annex-3" : `heading.mv-annex-3-${chunkIdx}`,
                    "مرفق 3: مستندات العميل",
                  )}
                  onChange={(value) =>
                    setTextOverride(
                      chunkIdx === 0 ? "heading.mv-annex-3" : `heading.mv-annex-3-${chunkIdx}`,
                      value,
                    )
                  }
                  className="min-h-[1.75rem]"
                  multiline={false}
                />
              }
              headerExtra={
                <div className="flex flex-wrap items-center gap-1">
                  {chunkIdx === 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => navigate(`/machine-valuation/${projectId}/workflow/client-files`)}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-sky-100 bg-white/95 px-2 text-[10.5px] font-black text-sky-900 shadow-sm transition hover:bg-sky-50"
                        title="إدارة ملفات العميل"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        ملفات العميل
                      </button>
                      <button
                        type="button"
                        onClick={() => receivedDocsPdfInputRef.current?.click()}
                        disabled={receivedDocsPdfBusy}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-sky-100 bg-white/95 px-2 text-[10.5px] font-black text-sky-900 shadow-sm transition hover:bg-sky-50 disabled:opacity-60"
                        title="إرفاق PDF إضافي داخل التقرير"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {receivedDocsPdfBusy ? "تحويل..." : "إرفاق PDF"}
                      </button>
                      <button
                        type="button"
                        onClick={() => receivedDocsImageInputRef.current?.click()}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-sky-100 bg-white/95 px-2 text-[10.5px] font-black text-sky-900 shadow-sm transition hover:bg-sky-50"
                        title="إرفاق صورة إضافية داخل التقرير"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        إرفاق صورة
                      </button>
                    </>
                  ) : null}
                  <PageRotateButton
                    orientation={orientation}
                    onClick={() => togglePageOrientation(anchorId, "portrait")}
                  />
                </div>
              }
            >
              {chunk.length === 0 ? (
                <div
                  tabIndex={0}
                  onPaste={handleReceivedDocsPaste}
                  onDragOver={(event) => {
                    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
                    event.preventDefault();
                    setReceivedDocsDropActive(true);
                    event.dataTransfer.dropEffect = "copy";
                  }}
                  onDragLeave={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                    setReceivedDocsDropActive(false);
                  }}
                  onDrop={handleReceivedDocsDrop}
                  className={cn(
                    "rounded-lg outline-none transition",
                    receivedDocsDropActive && "ring-2 ring-sky-300 ring-offset-2 ring-offset-white",
                  )}
                >
                  <div className="mb-3 rounded-lg border border-dashed border-slate-300 bg-white/80 px-5 py-8 text-center shadow-sm">
                    <p className="text-[13px] font-black text-slate-700">لا توجد مستندات عميل بعد.</p>
                    <p className="mx-auto mt-2 max-w-md text-[11px] font-semibold leading-6 text-slate-500">
                      ارفع ملفات PDF أو صوراً من خطوة «ملفات العميل» قبل إعداد التقرير، وستظهر هنا حسب عدد الصور في الصف (1 أو 2 أو 3).
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-3 h-8 rounded-lg text-[11px] font-bold"
                      onClick={() => navigate(`/machine-valuation/${projectId}/workflow/client-files`)}
                    >
                      فتح ملفات العميل
                    </Button>
                  </div>
                  <ClearableRichHtmlField
                    html={receivedClientDocumentsHtml}
                    onHtmlChange={(next) => onReportDataPatch({ receivedClientDocumentsHtml: next })}
                    emptyHtml={EMPTY_RICH_HTML}
                  />
                </div>
              ) : (
                /* ارتفاع الشبكة = المساحة تحت العنوان؛ الصورة كاملة داخل الخلية بدون اقتطاع */
                <div className="flex min-h-0 flex-1 flex-col px-[2%] pt-[1.5%] pb-[1.5%]">
                  <div
                    className={cn("grid min-h-0 flex-1 gap-1", clientDocsGridClass)}
                    style={{ gridAutoRows: "minmax(0, 1fr)" }}
                  >
                    {chunk.map((image) => {
                      const rawSrc = resolveClientDocumentImageSrc(projectId, image);
                      const src = resolveImageSrc ? resolveImageSrc(rawSrc) : rawSrc;
                      return (
                        <figure
                          key={image.id}
                          className="flex min-h-0 flex-col overflow-hidden bg-white"
                        >
                          <div className="flex min-h-0 flex-1 items-center justify-center p-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={src}
                              alt={image.name}
                              className="max-h-full max-w-full object-contain"
                              loading="lazy"
                            />
                          </div>
                        </figure>
                      );
                    })}
                  </div>
                </div>
              )}
              {chunkIdx === 0 ? insertedAfter("mv-annex-3") : null}
            </SectionShell>
          </ReportFlowPages>
        );
      })}

      <ReportFlowPages
        shellProps={interiorShellProps}
        measureRevision={`sce:${sceRegistrationHtml}`}
        measureEnvStyle={{
          ["--mv-paragraph-leading" as string]: String(paragraphLineHeight),
          ["--mv-heading-scale" as string]: String(headingScale),
        }}
      >
        <section
          id="mv-annex-sce"
          data-mv-report-insert-anchor="mv-annex-sce"
          dir="rtl"
          className="scroll-mt-4 text-right"
        >
          <div className="mb-2 flex shrink-0 flex-wrap items-end justify-between gap-2">
            <div
              className="min-w-0 flex-1 text-right text-[17px] font-black leading-tight text-[#0a1f33] sm:text-[19px]"
              style={{ letterSpacing: 0 }}
            >
            <EditableBlock
              value={editableText(
                "heading.mv-annex-sce",
                mvReportAnnexHeading("mv-annex-sce"),
              )}
              onChange={(value) => setTextOverride("heading.mv-annex-sce", value)}
              className="min-h-[1.75rem] text-[14px] font-black leading-snug text-[#0a1f33]"
              multiline={false}
            />
            </div>
            <div className="mv-report-chrome shrink-0 print:hidden">
              <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => scePdfInputRef.current?.click()}
                disabled={scePdfBusy}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-sky-100 bg-white/95 px-2 text-[10.5px] font-black text-sky-900 shadow-sm transition hover:bg-sky-50 disabled:opacity-60"
                title="إرفاق ملف PDF وتحويل أول صفحة إلى صورة"
              >
                <FileText className="h-3.5 w-3.5" />
                {scePdfBusy ? "تحويل..." : "إرفاق PDF"}
              </button>
              <button
                type="button"
                onClick={() => sceImageInputRef.current?.click()}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-sky-100 bg-white/95 px-2 text-[10.5px] font-black text-sky-900 shadow-sm transition hover:bg-sky-50"
                title="إرفاق صورة شهادة التسجيل"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                إرفاق صورة
              </button>
              </div>
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div
            tabIndex={0}
            onPaste={handleScePaste}
            onDragOver={(event) => {
              if (!Array.from(event.dataTransfer.types).includes("Files")) return;
              event.preventDefault();
              setSceDropActive(true);
              event.dataTransfer.dropEffect = "copy";
            }}
            onDragLeave={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node)) return;
              setSceDropActive(false);
            }}
            onDrop={handleSceDrop}
            className={cn(
              "rounded-lg outline-none transition",
              sceDropActive && "ring-2 ring-sky-300 ring-offset-2 ring-offset-white",
            )}
          >
            <ClearableRichHtmlField
              html={sceRegistrationHtml}
              onHtmlChange={(next) => onReportDataPatch({ sceRegistrationCertificateHtml: next })}
              emptyHtml={EMPTY_RICH_HTML}
            />
            </div>
            {insertedAfter("mv-annex-sce")}
          </div>
        </section>
      </ReportFlowPages>

      {boundary("mv-annex-sce")}

      <MvReportPageShell
        variant="cover"
        coverArtwork="divider"
        companyName={companyName}
        companyNameNode={editableCompanyNameNode}
        commercialRegistration={commercialRegistration}
        logoSrc={logoSrc}
        footerLines={identityFooterLines}
        coverFooterContent={reportIdentityFooter}
        draftWatermark={sheetDraft}
      >
        <section
          id="mv-report-closing"
          data-mv-report-insert-anchor="mv-report-closing"
          className="w-full max-w-lg space-y-6 text-center"
        >
          <EditableBlock
            value={editableText("closing.thankYou", "Thank You")}
            onChange={(value) => setTextOverride("closing.thankYou", value)}
            className="px-2 py-2 text-center text-[34px] font-black leading-tight text-slate-950 sm:text-[42px]"
            multiline={false}
            placeholder="Thank You"
          />
          <EditableBlock
            value={editableText("closing.note", "شكراً لثقتكم")}
            onChange={(value) => setTextOverride("closing.note", value)}
            className="mx-auto max-w-md px-2 text-center text-[15px] font-extrabold leading-8 text-slate-950"
            placeholder="نص الخاتمة"
          />
        </section>
      </MvReportPageShell>

      {insertedAfterOnOwnPages("mv-report-closing")}
    </div>
    </MvReportLetterheadProvider>
  );
}
