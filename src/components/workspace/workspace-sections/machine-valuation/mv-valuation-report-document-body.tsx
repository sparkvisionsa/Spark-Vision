"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, EyeOff, FileText, GripVertical, Heading2, ImageIcon, Trash2, X } from "lucide-react";
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

/**
 * صورة أصل واحدة داخل المرفق 2 — مع دعم السحب والإفلات لإعادة الترتيب
 * وزر حذف عند التمرير. لا توجد أسهم في الأعلى — الترتيب يتم بالسحب فقط.
 */
function AssetPhotoFigure({
  file,
  projectId,
  widthPercent,
  cornerRadius,
  resolveImageSrc,
  onReorder,
  onDelete,
}: {
  file: MvDriveFile;
  projectId: string;
  widthPercent: number;
  cornerRadius: number;
  resolveImageSrc?: (src: string) => string;
  onReorder: (fromId: string, toId: string) => void;
  onDelete: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [dragging, setDragging] = useState(false);
  const src = resolveImageSrc ? resolveImageSrc(downloadHref(projectId, file)) : downloadHref(projectId, file);
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
      style={{ width: `${widthPercent}%` }}
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
          onClick={onDelete}
          className="flex h-6 w-6 items-center justify-center rounded border border-red-100 bg-white/95 text-red-600 shadow-sm hover:bg-red-50"
          aria-label="إخفاء الصورة"
          title="إخفاء"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        className="block w-full bg-slate-100 object-cover"
        style={{
          aspectRatio: "4 / 3",
          borderRadius: cornerRadius || "var(--mv-image-radius, 0px)",
          filter: "var(--mv-image-shadow, none)",
        }}
        loading="lazy"
      />
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
  logoSrc,
  footerLines,
  draftWatermark,
  onTitleChange,
  onBodyChange,
  onRemove,
  insertedAfter,
}: {
  section: MvReportEditableSection;
  companyName: string;
  companyNameNode: ReactNode;
  logoSrc: string | null;
  footerLines: string[];
  draftWatermark: boolean;
  onTitleChange: (value: string) => void;
  onBodyChange: (html: string) => void;
  onRemove: () => void;
  insertedAfter: (anchorId: string) => ReactNode;
}) {
  return (
    <MvReportPageShell
      variant="interior"
      companyName={companyName}
      companyNameNode={companyNameNode}
      logoSrc={logoSrc}
      footerLines={footerLines}
      draftWatermark={draftWatermark}
    >
      <SectionShell
        id={`custom:${section.id}`}
        title={
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
              dir="rtl"
              value={section.title}
              onChange={onTitleChange}
              className="w-full max-w-full rounded-lg border border-transparent bg-sky-50/30 px-2 py-1 text-right text-[17px] font-black outline-none focus:border-sky-300 focus:bg-white"
              multiline={false}
            />
          </div>
        }
        headerExtra={
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
        }
      >
        <ClearableRichHtmlField html={section.body} onHtmlChange={onBodyChange} />
        {insertedAfter(`custom:${section.id}`)}
      </SectionShell>
    </MvReportPageShell>
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
        "mv-report-chrome relative py-4 transition print:hidden",
        dragOver && "py-7",
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
      className="mb-3 border-b-2 border-[#0C447C]/25 pb-2 text-right font-black leading-snug text-[#0C447C]"
      style={{ fontSize: "calc(16px * var(--mv-heading-scale, 1))" }}
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
        <textarea
          dir="rtl"
          value={block.content ?? ""}
          onChange={(event) => onUpdate(block.id, { content: event.target.value })}
          rows={5}
          className="min-h-32 w-full resize-y rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-right text-[12px] font-medium text-slate-800 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
          style={{ lineHeight: "var(--mv-paragraph-leading, 1.75)" }}
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
  /** نصف قطر حواف الصور (px) — عرض فقط، لا يؤثر على جودة التقرير. */
  imageCornerRadius?: number;
  /** ارتفاع السطر في الفقرات (×) — عرض فقط. */
  paragraphLineHeight?: number;
  /** مقياس حجم خط عناوين الأقسام (×) — عرض فقط. */
  headingScale?: number;
  /** قوة ظل الصور (0..4) — عرض فقط. */
  imageShadow?: number;
  valuationAccountImages: MvValuationAccountingImage[];
  resolveImageSrc?: (src: string) => string;
  moveImage: (fileId: string, direction: -1 | 1) => void;
  hideImage: (fileId: string) => void;
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
  imageCornerRadius = 0,
  paragraphLineHeight = 1.75,
  headingScale = 1,
  imageShadow = 0,
  valuationAccountImages,
  resolveImageSrc,
  moveImage,
  hideImage,
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
        "whitespace-pre-wrap text-[12px] font-medium text-slate-800",
        className,
      )}
      style={{ lineHeight: "var(--mv-paragraph-leading, 1.75)" }}
      placeholder="—"
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
  const [insertMenu, setInsertMenu] = useState<{
    anchorId: string;
    x: number;
    y: number;
    position: "before" | "after";
  } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pendingImageAnchorRef = useRef<string>("report-cover");
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
  const boundary = (afterAnchorId: string) => (
    <>
      {editableSections
        .filter((s) => s.insertAfterAnchorId === afterAnchorId)
        .map((section) => (
          <CustomSectionShell
            key={section.id}
            section={section}
            companyName={companyName}
            companyNameNode={editableCompanyNameNode}
            logoSrc={logoSrc}
            footerLines={reportFooterLines}
            draftWatermark={sheetDraft}
            onTitleChange={(value) => updateEditableSection(section.id, { title: value })}
            onBodyChange={(next) => updateEditableSection(section.id, { body: next })}
            onRemove={() => removeEditableSection(section.id)}
            insertedAfter={insertedAfter}
          />
        ))}
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
  return (
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
      {hiddenSectionsCss ? <style>{hiddenSectionsCss}</style> : null}
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

      {boundary("report-cover")}

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
                {MV_REPORT_TOC_ROWS.map((row) => {
                  const clickable = !!onTocAnchorClick;
                  return (
                    <tr
                      key={`${row.num}-${row.title}`}
                      className={cn(
                        "border-b border-slate-200/80 transition",
                        clickable && "cursor-pointer hover:bg-sky-50/60",
                      )}
                      onClick={(event) => {
                        if (!clickable) return;
                        const target = event.target as HTMLElement | null;
                        if (target?.closest('[contenteditable="true"], input, textarea, button, a')) return;
                        onTocAnchorClick?.(row.anchor);
                      }}
                    >
                      <td className="px-2 py-1.5 align-top font-black tabular-nums text-[#0C447C]">
                        {/*
                          لا نضع رقم الفهرس داخل mv-report-chrome أو زر مخفي عن اللقطة —
                          تصدير PDF (html2canvas + ignoreElements) ومعاينة التقرير تتخطى/تخفي
                          ذلك الصنف؛ يبقى الانتقال عبر النقر على الصف خارج الحقول التحريرية.
                        */}
                        <span className="inline-block min-w-[2rem]">{row.num}</span>
                      </td>
                      <td className="px-2 py-1.5 align-top font-semibold text-slate-900">
                        <EditableBlock
                          value={editableText(`toc.${row.anchor}.title`, row.title)}
                          onChange={(value) => setTextOverride(`toc.${row.anchor}.title`, value)}
                          className={cn(
                            "min-h-[1.25rem]",
                            clickable && "hover:text-[#0C447C]",
                          )}
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
                  );
                })}
              </tbody>
            </table>
          </div>
          {insertedAfter("report-toc")}
        </section>
      </MvReportPageShell>

      {boundary("report-toc")}

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
                `تم التقييم وإصدار هذا التقرير وفقاً لاتفاقية تنفيذ أعمال التقييم بين شركة ${textValue(companyName, "الجهة المُقيِّمة")} للعميل ${clientName} حسب نطاق العمل المتفق عليه والموضح في «نطاق التقييم»، وذلك بغرض ${textValue(reportData.valuationPurpose, "التقييم")} على أساس ${textValue(reportData.valuationBasis, "القيمة السوقية")} في تاريخ التقييم ${dateValue(reportData.valuationDate)} م.`,
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
      </MvReportPageShell>

      {boundary("mv-toc-2")}

      <MvReportPageShell
        variant="interior"
        companyName={companyName}
        companyNameNode={editableCompanyNameNode}
        logoSrc={logoSrc}
        footerLines={reportFooterLines}
        draftWatermark={sheetDraft}
      >
        {narrativeB1?.trim() ? (
          <div className="mb-3">
            <ClearableRichHtmlField html={narrativeB1} onHtmlChange={onNarrativeB1} />
          </div>
        ) : null}

        {/* 3.0 الامتثال لمعايير التقييم الدولية */}
        <section id="mv-toc-3" data-mv-report-insert-anchor="mv-toc-3" className="mt-2 space-y-2">
          {editableHeading("mv-toc-3", "3.0 الامتثال لمعايير التقييم الدولية")}
          {narrativeBlock("section.complianceStatement", renderCompanyDefault("scope", "complianceStatement"))}
          {insertedAfter("mv-toc-3")}
        </section>

        {/* 4.0 إقرار بالاستقلالية وعدم تضارب المصالح */}
        <section id="mv-toc-4" data-mv-report-insert-anchor="mv-toc-4" className="mt-5 space-y-2">
          {editableHeading("mv-toc-4", "4.0 إقرار بالاستقلالية وعدم تضارب المصالح")}
          {narrativeBlock("section.independenceStatement", renderCompanyDefault("scope", "independenceStatement"))}
          {insertedAfter("mv-toc-4")}
        </section>

        {/* 5.0 هوية المقيم — narrative paragraph built from project + company fields */}
        <section id="mv-toc-5" data-mv-report-insert-anchor="mv-toc-5" className="mt-5 space-y-2">
          {editableHeading("mv-toc-5", "5.0 هوية المقيم")}
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
                reportData.leadValuerMembershipNo?.trim()
                  ? `، عضوية رقم: ${reportData.leadValuerMembershipNo.trim()}`
                  : ""
              }.`,
            ].join("\n"),
          )}
          {insertedAfter("mv-toc-5")}
        </section>

        {/* 6.0 هوية العميل (المستخدم المقصود) */}
        <section id="mv-toc-6" data-mv-report-insert-anchor="mv-toc-6" className="mt-5 space-y-2">
          {editableHeading("mv-toc-6", "6.0 هوية العميل (المستخدم المقصود)")}
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

        {/* 7.0 هوية المستخدمين المقصودين الآخرين */}
        <section id="mv-toc-7" data-mv-report-insert-anchor="mv-toc-7" className="mt-5 space-y-2">
          {editableHeading("mv-toc-7", "7.0 هوية المستخدمين المقصودين الآخرين")}
          {narrativeBlock(
            "section.intendedUsers",
            textValue(reportData.intendedUsers, "لا يوجد مستخدمون مقصودون آخرون."),
          )}
          {insertedAfter("mv-toc-7")}
        </section>
      </MvReportPageShell>

      {boundary("mv-toc-7")}

      <MvReportPageShell
        variant="interior"
        companyName={companyName}
        companyNameNode={editableCompanyNameNode}
        logoSrc={logoSrc}
        footerLines={reportFooterLines}
        draftWatermark={sheetDraft}
      >
        {narrativeB2?.trim() ? (
          <div className="mb-3">
            <ClearableRichHtmlField html={narrativeB2} onHtmlChange={onNarrativeB2} />
          </div>
        ) : null}

        {/* 8.0 نطاق العمل */}
        <section id="mv-toc-8" data-mv-report-insert-anchor="mv-toc-8" className="mt-2 space-y-2">
          {editableHeading("mv-toc-8", "8.0 نطاق العمل")}
          {narrativeBlock(
            "scopeOfWorkDetails",
            fieldOrCompanyDefault(reportData.scopeOfWorkDetails, "scope", "scopeOfWorkDetails"),
          )}
          {insertedAfter("mv-toc-8")}
        </section>

        {/* 9.0 الغرض من التقييم — single dynamic line */}
        <section id="mv-toc-9" data-mv-report-insert-anchor="mv-toc-9" className="mt-5 space-y-2">
          {editableHeading("mv-toc-9", "9.0 الغرض من التقييم")}
          {narrativeBlock(
            "section.valuationPurpose",
            `الغرض المتبع هو ${textValue(reportData.valuationPurpose, "غير محدد")}.`,
          )}
          {insertedAfter("mv-toc-9")}
        </section>

        {/* 10.0 الاستخدام المقصود */}
        <section id="mv-toc-10" data-mv-report-insert-anchor="mv-toc-10" className="mt-5 space-y-2">
          {editableHeading("mv-toc-10", "10.0 الاستخدام المقصود")}
          {narrativeBlock(
            "section.intendedUse",
            reportData.intendedUse?.trim()
              ? `يتم استخدام هذا التقرير للعميل ${textValue(clientName, "العميل")} والمستخدمون الآخرون لمساعدتهم في معرفة رأي القيمة للأصل محل التقييم لغرض ${reportData.intendedUse.trim()}.`
              : renderCompanyDefault("scope", "intendedUseStatement"),
          )}
          {insertedAfter("mv-toc-10")}
        </section>

        {/* 11.0 أساس القيمة المستخدم */}
        <section id="mv-toc-11" data-mv-report-insert-anchor="mv-toc-11" className="mt-5 space-y-2">
          {editableHeading("mv-toc-11", "11.0 أساس القيمة المستخدم")}
          {narrativeBlock(
            "section.valuationBasisIntro",
            `أساس القيمة المعتمد في هذا التقرير هو: ${textValue(reportData.valuationBasis, "القيمة السوقية")}.`,
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

        {/* 12.0 فرضية القيمة */}
        <section id="mv-toc-12" data-mv-report-insert-anchor="mv-toc-12" className="mt-5 space-y-2">
          {editableHeading("mv-toc-12", "12.0 فرضية القيمة")}
          {narrativeBlock(
            "valuePremise",
            reportData.valuePremise?.trim() ||
              companyDefault("scope", "valuePremiseDefinition") ||
              "غير محدد.",
          )}
          {insertedAfter("mv-toc-12")}
        </section>

        {/* 13.0 القيود على الاستخدام أو التوزيع أو النشر */}
        <section id="mv-toc-13" data-mv-report-insert-anchor="mv-toc-13" className="mt-5 space-y-2">
          {editableHeading("mv-toc-13", "13.0 القيود على الاستخدام أو التوزيع أو النشر")}
          {narrativeBlock(
            "useRestriction",
            reportData.useRestriction?.trim() || renderCompanyDefault("scope", "useRestriction"),
          )}
          {insertedAfter("mv-toc-13")}
        </section>
      </MvReportPageShell>

      {boundary("mv-toc-13")}

      <MvReportPageShell
        variant="interior"
        companyName={companyName}
        companyNameNode={editableCompanyNameNode}
        logoSrc={logoSrc}
        footerLines={reportFooterLines}
        draftWatermark={sheetDraft}
      >
        {narrativeB3?.trim() ? (
          <div className="mb-3">
            <ClearableRichHtmlField html={narrativeB3} onHtmlChange={onNarrativeB3} />
          </div>
        ) : null}

        {/* 14.0 الاستعانة بأخصائيين */}
        <section id="mv-toc-14" data-mv-report-insert-anchor="mv-toc-14" className="mt-2 space-y-2">
          {editableHeading("mv-toc-14", "14.0 الاستعانة بأخصائيين")}
          {narrativeBlock(
            "externalSpecialistUse",
            fieldOrCompanyDefault(reportData.externalSpecialistUse, "scope", "externalSpecialistUse"),
          )}
          {insertedAfter("mv-toc-14")}
        </section>

        {/* 15.0 العوامل البيئية والاجتماعية والحوكمة */}
        <section id="mv-toc-15" data-mv-report-insert-anchor="mv-toc-15" className="mt-5 space-y-2">
          {editableHeading("mv-toc-15", "15.0 العوامل البيئية والاجتماعية والحوكمة")}
          {narrativeBlock(
            "esgConsiderations",
            fieldOrCompanyDefault(reportData.esgConsiderations, "scope", "esgConsiderations"),
          )}
          {insertedAfter("mv-toc-15")}
        </section>

        {/* 16.0 نوع التقرير */}
        <section id="mv-toc-16" data-mv-report-insert-anchor="mv-toc-16" className="mt-5 space-y-2">
          {editableHeading("mv-toc-16", "16.0 نوع التقرير")}
          {narrativeBlock(
            "section.reportTypeLine",
            `نوع التقرير ${textValue(reportData.reportTypeLabel, "غير محدد")} ويتم إيصال التقييم عن طريق البريد الإلكتروني.`,
          )}
          {insertedAfter("mv-toc-16")}
        </section>

        {/* 17.0 طبيعة ومصادر المعلومات */}
        <section id="mv-toc-17" data-mv-report-insert-anchor="mv-toc-17" className="mt-5 space-y-2">
          {editableHeading(
            "mv-toc-17",
            "17.0 طبيعة ومصادر المعلومات التي تم الاعتماد عليها (المدخلات الرئيسية المستخدمة)",
          )}
          {narrativeBlock(
            "informationSources",
            fieldOrCompanyDefault(reportData.informationSources, "scope", "informationSources"),
          )}
          {insertedAfter("mv-toc-17")}
        </section>
      </MvReportPageShell>

      {boundary("mv-toc-17")}

      <MvReportPageShell variant="interior" companyName={companyName} companyNameNode={editableCompanyNameNode} logoSrc={logoSrc} footerLines={reportFooterLines}
        draftWatermark={sheetDraft}>
        {/* 18.0 الأصل محل التقييم */}
        <section id="mv-toc-18" data-mv-report-insert-anchor="mv-toc-18" className="space-y-2">
          {editableHeading("mv-toc-18", "18.0 الأصل محل التقييم")}
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

        {/* 18.1 الوصف الجزئي */}
        <section id="mv-toc-18-1" data-mv-report-insert-anchor="mv-toc-18-1" className="mt-5 space-y-2">
          {editableHeading("mv-toc-18-1", "18.1 الوصف الجزئي")}
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

        {/* 19.0 العملة */}
        <section id="mv-toc-19" data-mv-report-insert-anchor="mv-toc-19" className="mt-5 space-y-2">
          {editableHeading("mv-toc-19", "19.0 العملة")}
          {narrativeBlock(
            "section.currencyLine",
            `العملة المستخدمة هي ${effectiveCurrencyLabel}.`,
          )}
          {insertedAfter("mv-toc-19")}
        </section>

        {/* 20.0 المعاينة */}
        <section id="mv-toc-20" data-mv-report-insert-anchor="mv-toc-20" className="mt-5 space-y-2">
          {editableHeading("mv-toc-20", "20.0 المعاينة")}
          {narrativeBlock(
            "section.inspectionLine",
            `تمت المعاينة بـ${effectiveInspectionLocation} بتاريخ ${dateValue(reportData.inspectionDate)} م.${
              effectiveInspectionMapUrl ? `\nالموقع: ${effectiveInspectionMapUrl}` : ""
            }`,
            "break-words",
          )}
          {insertedAfter("mv-toc-20")}
        </section>
      </MvReportPageShell>

      {boundary("mv-toc-20")}

      <MvReportPageShell
        variant="interior"
        companyName={companyName}
        companyNameNode={editableCompanyNameNode}
        logoSrc={logoSrc}
        footerLines={reportFooterLines}
        draftWatermark={sheetDraft}
      >
        {narrativeB4?.trim() ? (
          <div className="mb-3">
            <ClearableRichHtmlField html={narrativeB4} onHtmlChange={onNarrativeB4} />
          </div>
        ) : null}

        {/* 21.0 منهجية التقييم والتحليل */}
        <section id="mv-toc-21" data-mv-report-insert-anchor="mv-toc-21" className="mt-2 space-y-2">
          {editableHeading("mv-toc-21", "21.0 منهجية التقييم والتحليل")}
          {narrativeBlock(
            "methodologyRationale",
            fieldOrCompanyDefault(reportData.methodologyRationale, "methodology", "methodologyRationale"),
          )}
          {insertedAfter("mv-toc-21")}
        </section>

        {/* 22.0 تطبيق أسلوب التكلفة */}
        <section id="mv-toc-22" data-mv-report-insert-anchor="mv-toc-22" className="mt-5 space-y-2">
          {editableHeading("mv-toc-22", "22.0 تطبيق أسلوب التكلفة")}
          {narrativeBlock(
            "costApproachDetails",
            fieldOrCompanyDefault(reportData.costApproachDetails, "methodology", "costApproachDetails"),
          )}
          {insertedAfter("mv-toc-22")}
        </section>

        {/* 22.1 القيمة المتبقية (القيمة التخريدية) */}
        <section id="mv-toc-22-1" data-mv-report-insert-anchor="mv-toc-22-1" className="mt-5 space-y-2">
          {editableHeading("mv-toc-22-1", "22.1 القيمة المتبقية (القيمة التخريدية)")}
          {narrativeBlock("salvageValueDescription", companyDefault("methodology", "salvageValueDescription"))}
          {insertedAfter("mv-toc-22-1")}
        </section>

        {/* 22.2 الإهلاك المادي */}
        <section id="mv-toc-22-2" data-mv-report-insert-anchor="mv-toc-22-2" className="mt-5 space-y-2">
          {editableHeading("mv-toc-22-2", "22.2 الإهلاك المادي")}
          {narrativeBlock(
            "physicalDepreciationDescription",
            companyDefault("methodology", "physicalDepreciationDescription"),
          )}
          {insertedAfter("mv-toc-22-2")}
        </section>

        {/* 22.3 التقادم الوظيفي */}
        <section id="mv-toc-22-3" data-mv-report-insert-anchor="mv-toc-22-3" className="mt-5 space-y-2">
          {editableHeading("mv-toc-22-3", "22.3 التقادم الوظيفي")}
          {narrativeBlock(
            "functionalObsolescenceDescription",
            companyDefault("methodology", "functionalObsolescenceDescription"),
          )}
          {insertedAfter("mv-toc-22-3")}
        </section>

        {/* 22.4 التقادم الاقتصادي */}
        <section id="mv-toc-22-4" data-mv-report-insert-anchor="mv-toc-22-4" className="mt-5 space-y-2">
          {editableHeading("mv-toc-22-4", "22.4 التقادم الاقتصادي")}
          {narrativeBlock(
            "economicObsolescenceDescription",
            companyDefault("methodology", "economicObsolescenceDescription"),
          )}
          {insertedAfter("mv-toc-22-4")}
        </section>

        {/* 23.0 الافتراضات المهمة والافتراضات الخاصة */}
        <section id="mv-toc-23" data-mv-report-insert-anchor="mv-toc-23" className="mt-5 space-y-2">
          {editableHeading("mv-toc-23", "23.0 الافتراضات المهمة والافتراضات الخاصة")}
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
      </MvReportPageShell>

      {boundary("mv-toc-23")}

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

      {boundary("mv-toc-24")}
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
            logoSrc={logoSrc}
            footerLines={reportFooterLines}
            draftWatermark={sheetDraft}
            onTitleChange={(value) => updateEditableSection(section.id, { title: value })}
            onBodyChange={(next) => updateEditableSection(section.id, { body: next })}
            onRemove={() => removeEditableSection(section.id)}
            insertedAfter={insertedAfter}
          />
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
                {chunk.map((file) => (
                  <AssetPhotoFigure
                    key={file._id}
                    file={file}
                    projectId={projectId}
                    widthPercent={assetImageWidth}
                    cornerRadius={imageCornerRadius}
                    resolveImageSrc={resolveImageSrc}
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

      {boundary("mv-annex-sce")}
    </div>
  );
}
