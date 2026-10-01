"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, FileInput, FileSearch, FileText, Loader2, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { invalidateMvApiCache } from "./mv-api-client";
import { writeProjectSummaryCache } from "./mv-project-summary-loader";
import { useMvI18n } from "./mv-i18n";
import type { MvProject } from "./types";
import {
  mergeExtractedFieldsIntoReportData,
  type MvImportedExtractionDocument,
  type MvImportedExtractionField,
} from "./mv-project-data-import";

const EXTRACTION_API = "/api/mv/data-extraction";
const MAX_FILES = 8;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;

type EditableImportedField = MvImportedExtractionField & { clientId: string; fileName: string };

function responseMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "message" in body && typeof body.message === "string") return body.message;
  return fallback;
}

export function MvProjectDataImportDialog({
  project,
  open,
  onOpenChange,
  onImported,
}: {
  project: MvProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (project: MvProject) => void;
}) {
  const { isArabic, dir } = useMvI18n();
  const { csrfToken } = useAuthTracking();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fields, setFields] = useState<EditableImportedField[]>([]);
  const [sectionTitle, setSectionTitle] = useState("");
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState("");
  const busy = processing || merging;
  const text = (ar: string, en: string) => isArabic ? ar : en;

  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setFields([]);
    setError("");
    setDragging(false);
    setSectionTitle(text("البيانات المستوردة من الملفات", "Imported file data"));
  }, [open, isArabic]);

  const addFiles = (incoming: File[]) => {
    if (busy) return;
    const next = [...files];
    let issue = "";
    for (const file of incoming) {
      if (!/\.(pdf|jpe?g|png|webp|heic|heif|avif|gif|tiff?|bmp)$/i.test(file.name)) {
        issue = text("استخدم صورًا أو ملفات PDF فقط.", "Use images or PDF files only.");
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        issue = text("الحد الأقصى للملف 15 ميجابايت.", "Maximum file size is 15 MB.");
        continue;
      }
      if (next.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) continue;
      if (next.length >= MAX_FILES || next.reduce((sum, item) => sum + item.size, 0) + file.size > MAX_TOTAL_BYTES) {
        issue = text("الحد الأقصى 8 ملفات بإجمالي 40 ميجابايت.", "Up to 8 files and 40 MB total.");
        continue;
      }
      next.push(file);
    }
    setFiles(next);
    setError(issue);
  };

  const extract = async () => {
    if (!files.length || busy) return;
    setProcessing(true);
    setError("");
    try {
      const form = new FormData();
      files.forEach(file => form.append("files", file, file.name));
      const response = await fetch(EXTRACTION_API, {
        method: "POST",
        body: form,
        credentials: "include",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
      });
      const body = await response.json().catch(() => null) as { documents?: MvImportedExtractionDocument[] } | null;
      if (!response.ok) throw new Error(responseMessage(body, text("تعذر استخراج البيانات.", "Could not extract data.")));
      const imported = (body?.documents ?? []).flatMap(document =>
        (document.fields ?? []).map(field => ({
          ...field,
          clientId: crypto.randomUUID(),
          fileName: document.fileName,
        })),
      ).filter(field => field.label.trim() && field.value.trim());
      setFields(imported);
      if (!imported.length) {
        setError(text("لم يتم العثور على حقول قابلة للاستيراد في الملفات.", "No importable fields were found."));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text("تعذر استخراج البيانات.", "Could not extract data."));
    } finally {
      setProcessing(false);
    }
  };

  const copyValue = async (field: EditableImportedField) => {
    try {
      await navigator.clipboard.writeText(field.value);
      toast({ description: text("تم نسخ القيمة.", "Value copied.") });
    } catch {
      toast({ variant: "destructive", description: text("تعذر نسخ القيمة.", "Could not copy value.") });
    }
  };

  const mergeIntoProject = async () => {
    if (!project || !fields.length || !sectionTitle.trim() || busy) return;
    setMerging(true);
    setError("");
    try {
      const projectResponse = await fetch(`/api/mv/projects/${project._id}?picAssetMode=summary`, { credentials: "include" });
      const projectBody = await projectResponse.json().catch(() => null) as { project?: MvProject; subProjects?: unknown[] } | MvProject | null;
      if (!projectResponse.ok) throw new Error(responseMessage(projectBody, text("تعذر تحميل بيانات المشروع.", "Could not load project data.")));
      const fresh = projectBody && "project" in projectBody ? projectBody.project : projectBody as MvProject | null;
      if (!fresh?._id) throw new Error(text("تعذر تحميل بيانات المشروع.", "Could not load project data."));
      if (fresh.reportType !== "simple") throw new Error(text("الاستيراد متاح للمشاريع المبسطة فقط.", "Import is available for simplified projects only."));

      const merged = mergeExtractedFieldsIntoReportData(fresh.reportData, fields, sectionTitle);
      if (!merged.importedCount) {
        throw new Error(merged.reason === "section-limit"
          ? text("وصل المشروع إلى الحد الأقصى لأقسام بيانات التقرير.", "The project reached the report section limit.")
          : text("وصل المشروع إلى الحد الأقصى لحقول بيانات التقرير.", "The project reached the report field limit."));
      }

      const response = await fetch(`/api/mv/projects/${fresh._id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) },
        body: JSON.stringify({ name: fresh.name, reportType: "simple", reportData: merged.reportData }),
      });
      const body = await response.json().catch(() => null) as { project?: MvProject } | null;
      if (!response.ok) throw new Error(responseMessage(body, text("تعذر دمج البيانات في المشروع.", "Could not merge data into the project.")));
      const updated = body?.project ?? { ...fresh, reportData: merged.reportData, updatedAt: new Date().toISOString() };
      writeProjectSummaryCache(updated._id, { project: updated, subProjects: [] }, "report");
      invalidateMvApiCache("projects:");
      toast({
        description: merged.skippedCount
          ? text(`تم استيراد ${merged.importedCount} حقل وتجاوز ${merged.skippedCount} بسبب حد الحقول.`, `Imported ${merged.importedCount} fields; ${merged.skippedCount} exceeded the limit.`)
          : text(`تمت إضافة ${merged.importedCount} حقل إلى بيانات التقرير.`, `${merged.importedCount} fields were added to report data.`),
      });
      onOpenChange(false);
      onImported(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : text("تعذر دمج البيانات في المشروع.", "Could not merge data into the project."));
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!busy) onOpenChange(next); }}>
      <DialogContent hideCloseButton dir={dir} className="!flex h-[min(92dvh,880px)] w-[min(96vw,1120px)] !max-w-none flex-col gap-0 overflow-hidden rounded-xl border-slate-200 p-0 shadow-2xl">
        <header className="flex flex-none items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
          <div className="min-w-0">
            <DialogTitle className="flex items-center gap-2 text-sm font-black text-slate-950"><FileInput className="h-4.5 w-4.5 text-cyan-700" />{text("استيراد بيانات من ملفات", "Import data from files")}</DialogTitle>
            <DialogDescription className="truncate text-[11px] text-slate-500">{project?.name}</DialogDescription>
          </div>
          <Button variant="outline" size="sm" className="h-8 px-2 text-xs" disabled={busy} onClick={() => onOpenChange(false)}><X className="h-3.5 w-3.5" />{text("إغلاق", "Close")}</Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif,.gif,.tif,.tiff,.bmp" className="sr-only" aria-label={text("اختيار ملفات الاستيراد", "Choose import files")} onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
          <div
            role="button"
            tabIndex={busy ? -1 : 0}
            onClick={() => !busy && inputRef.current?.click()}
            onKeyDown={event => { if (!busy && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); inputRef.current?.click(); } }}
            onDragOver={event => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={event => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }}
            className={cn("flex min-h-16 items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-center transition", dragging ? "border-cyan-600 bg-cyan-50" : "border-slate-300 bg-white hover:bg-slate-50", busy && "opacity-60")}
          >
            <UploadCloud className="h-6 w-6 text-cyan-700" />
            <span className="text-xs font-bold">{text("اسحب الصور أو ملفات PDF هنا", "Drop images or PDFs here")}</span>
          </div>

          {!!files.length && <div className="mt-1.5 flex flex-wrap gap-1">{files.map((file, index) => <span key={`${file.name}-${index}`} className="flex max-w-full items-center gap-1 rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px]"><FileText className="h-3.5 w-3.5 text-cyan-700" /><span className="max-w-56 truncate" dir="auto">{file.name}</span><button type="button" disabled={busy} aria-label={text("إزالة الملف", "Remove file")} onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))}><X className="h-3 w-3 text-slate-400 hover:text-red-600" /></button></span>)}</div>}

          <div className="mt-1.5 flex items-center gap-1.5">
            <Button size="sm" className="h-8 bg-cyan-700 text-xs hover:bg-cyan-800" disabled={!files.length || busy} onClick={() => void extract()}>{processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}{text("استخراج البيانات", "Extract data")}</Button>
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy} onClick={() => inputRef.current?.click()}><Plus className="h-3.5 w-3.5" />{text("إضافة ملفات", "Add files")}</Button>
            {!!fields.length && <span className="text-[11px] font-bold text-emerald-700">{fields.length} {text("حقل", "fields")}</span>}
          </div>

          {error && <p role="alert" className="mt-1.5 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</p>}

          {!!fields.length && <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 p-1.5"><Input aria-label={text("اسم قسم البيانات المستوردة", "Imported data section name")} value={sectionTitle} maxLength={180} onChange={event => setSectionTitle(event.target.value)} className="h-8 bg-white text-xs font-bold" /></div>
            <div className="max-h-[52dvh] divide-y divide-slate-100 overflow-y-auto overscroll-contain">
              {fields.map(field => <div key={field.clientId} className="grid grid-cols-[minmax(105px,30%)_minmax(0,1fr)_52px] items-start gap-1 px-1.5 py-1">
                <Input aria-label={text("اسم الحقل المستورد", "Imported field name")} dir="auto" value={field.label} maxLength={180} onChange={event => setFields(current => current.map(item => item.clientId === field.clientId ? { ...item, label: event.target.value } : item))} className="h-8 px-1.5 text-xs font-bold" />
                <Textarea aria-label={field.label} dir="auto" value={field.value} rows={Math.min(4, Math.max(1, Math.ceil(field.value.length / 90)))} maxLength={4000} onChange={event => setFields(current => current.map(item => item.clientId === field.clientId ? { ...item, value: event.target.value } : item))} className="min-h-8 resize-y px-2 py-1 text-xs leading-5" />
                <div className="flex items-center"><button type="button" onClick={() => void copyValue(field)} aria-label={text(`نسخ قيمة ${field.label}`, `Copy ${field.label} value`)} className="rounded p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-700"><Copy className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setFields(current => current.filter(item => item.clientId !== field.clientId))} aria-label={text(`حذف ${field.label}`, `Delete ${field.label}`)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></div>
              </div>)}
            </div>
          </div>}
        </div>

        <footer className="flex flex-none items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2">
          <Button variant="outline" className="h-9 px-4 text-xs" disabled={busy} onClick={() => onOpenChange(false)}>{text("إلغاء", "Cancel")}</Button>
          <Button className="h-9 min-w-44 bg-slate-950 px-4 text-xs text-white hover:bg-slate-800" disabled={!fields.length || !sectionTitle.trim() || busy} onClick={() => void mergeIntoProject()}>{merging ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileInput className="h-4 w-4" />}{text("دمج في بيانات التقرير", "Merge into report data")}</Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
