"use client";

import { useEffect, useRef, useState } from "react";
import { FilePlus2, FileSearch, FileText, Loader2, Plus, Trash2, UploadCloud, X } from "lucide-react";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  createReportDataModelField,
  createReportDataModelSection,
  type MvReportDataModelSection,
} from "./mv-report-data-models";
import type { MvReportCustomFieldType } from "./mv-report-custom-fields";

const EXTRACTION_API = "/api/mv/data-extraction";
const ACCEPTED_FILES = /\.(pdf|jpe?g|png|webp|heic|heif|avif|gif|tiff?|bmp)$/i;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

type ExtractedField = { id?: string; label?: string; value?: string; category?: string; inputType?: string };
type ExtractedDocument = { fileName?: string; fields?: ExtractedField[]; engine?: "local" | "gemini"; message?: string };
type InferredTemplateField = { label: string; type: MvReportCustomFieldType };

function responseMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "message" in body && typeof body.message === "string") return body.message;
  return fallback;
}

const DATE_LABEL = /(?:تاريخ|موعد|انتهاء|إصدار|اصدار|ميلاد|date|expiry|issued)/i;
const DATE_VALUE = /(?:^|\s)(?:\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}|\d{1,2}\s+(?:محرم|صفر|ربيع|جمادى|رجب|شعبان|رمضان|شوال|ذو القعدة|ذو الحجة|يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)\s+\d{3,4})(?:\s|$)/i;
const IDENTIFIER_LABEL = /(?:رقم|هوية|سجل|ترخيص|رخصة|قضية|مرجع|مرجعي|جوال|هاتف|هاتف|بريد|رمز|كود|plate|id|reference|license|phone|email)/i;
const NUMERIC_LABEL = /(?:عدد|كمية|مساحة|قيمة|مبلغ|سعر|تكلفة|وزن|طول|عرض|ارتفاع|نسبة|متر|كيلو|عمر|مدة|years?|amount|price|value|area|quantity|weight|height|width|length)/i;
const LONG_TEXT_LABEL = /(?:وصف|تفاصيل|ملاحظات|محتوى|شرح|بيان|حدود|شروط|تعهد|أسباب|description|details|notes|remarks|content)/i;

function toLatinDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function inferFieldType(label: string, value: string): MvReportCustomFieldType {
  const cleanValue = value.trim();
  if (DATE_LABEL.test(label) || DATE_VALUE.test(toLatinDigits(cleanValue))) return "date";
  if (LONG_TEXT_LABEL.test(label) || cleanValue.length > 160 || /[\r\n]/.test(cleanValue)) return "textarea";
  const normalizedNumber = toLatinDigits(cleanValue).replace(/[٬،,\s]/g, "");
  if (!IDENTIFIER_LABEL.test(label) && (NUMERIC_LABEL.test(label) || /^[-+]?\d+(?:\.\d+)?$/.test(normalizedNumber))) return "number";
  return "text";
}

function fieldTypeLabel(type: MvReportCustomFieldType) {
  return type === "date" ? "تاريخ" : type === "number" ? "رقم" : type === "textarea" ? "نص مطوّل" : "نص";
}

function isInputType(value: unknown): value is MvReportCustomFieldType {
  return value === "text" || value === "textarea" || value === "number" || value === "date";
}

export function MvReportDataModelFileSectionDialog({
  open,
  onOpenChange,
  remainingFields,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  remainingFields: number;
  onCreate: (section: MvReportDataModelSection) => void;
}) {
  const { csrfToken } = useAuthTracking();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("بيانات مستخرجة من ملف");
  const [fields, setFields] = useState<InferredTemplateField[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setTitle("بيانات مستخرجة من ملف");
    setFields([]);
    setDragging(false);
    setError("");
  }, [open]);

  const addFiles = (incoming: File[]) => {
    const next = [...files];
    let issue = "";
    for (const file of incoming) {
      if (!ACCEPTED_FILES.test(file.name)) {
        issue = "استخدم صورًا أو ملفات PDF فقط.";
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        issue = "الحد الأقصى للملف 15 ميجابايت.";
        continue;
      }
      if (!next.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) next.push(file);
    }
    setFiles(next.slice(0, 8));
    setError(issue);
  };

  const extract = async () => {
    if (!files.length || loading) return;
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file, file.name));
      const response = await fetch(EXTRACTION_API, {
        method: "POST",
        body: form,
        credentials: "include",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
      });
      const body = await response.json().catch(() => null) as { documents?: ExtractedDocument[] } | null;
      if (!response.ok) throw new Error(responseMessage(body, "تعذر استخراج الحقول من الملف."));
      const documents = body?.documents ?? [];
      const allExtractedFields = documents.flatMap((document) => document.fields ?? []);
      const fallbackOnly =
        allExtractedFields.length <= 2 &&
        allExtractedFields.some((field) => /^(?:النص المستخرج|extracted text)$/iu.test((field.label ?? "").trim()));
      if (fallbackOnly) {
        setFields([]);
        throw new Error("لم يكتمل التحليل الذكي للملف، لذلك لم يتم إنشاء قسم ناقص. أعد المحاولة بعد التأكد من تشغيل GEMINI_API_KEY في الخادم.");
      }
      const seen = new Set<string>();
      const nextFields = allExtractedFields
        .map((field) => ({
          label: (field.label ?? "").trim().slice(0, 180),
          type: isInputType(field.inputType)
            ? field.inputType
            : inferFieldType(field.label ?? "", field.value ?? ""),
        }))
        .filter((field) => {
          const key = field.label.replace(/\s+/g, " ").toLocaleLowerCase();
          if (!field.label || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      setFields(nextFields.slice(0, Math.max(0, remainingFields)));
      if (!nextFields.length) setError("لم يتم العثور على أسماء حقول قابلة للاستخدام في الملف.");
      if (nextFields.length > remainingFields) setError(`تمت قراءة ${nextFields.length} حقلًا، ويمكن إضافة ${remainingFields} فقط في هذا النموذج.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر استخراج الحقول من الملف.");
    } finally {
      setLoading(false);
    }
  };

  const createSection = () => {
    const cleanFields = fields.map((field) => ({ ...field, label: field.label.trim().slice(0, 180) })).filter((field) => field.label).slice(0, remainingFields);
    if (!title.trim() || !cleanFields.length) return;
    const modelFields = cleanFields.map((field) => ({ ...createReportDataModelField(), label: field.label, type: field.type, required: false }));
    const section = createReportDataModelSection();
    onCreate({ ...section, title: title.trim().slice(0, 180), fields: modelFields });
    toast({ description: `تم إنشاء قسم يحتوي على ${modelFields.length} حقلًا دون قيم.` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!loading) onOpenChange(next); }}>
      <DialogContent hideCloseButton dir="rtl" className="!flex h-[min(90dvh,760px)] w-[min(96vw,820px)] !max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0">
        <header className="flex items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2">
          <div className="min-w-0"><DialogTitle className="flex items-center gap-2 text-sm font-black"><FilePlus2 className="h-4 w-4 text-cyan-700" />إنشاء قسم من ملف</DialogTitle><DialogDescription className="text-[11px]">تُحفظ أسماء الحقول فقط داخل نموذج التقرير.</DialogDescription></div>
          <Button variant="outline" size="sm" className="h-8 px-2 text-xs" disabled={loading} onClick={() => onOpenChange(false)}><X className="h-3.5 w-3.5" />إغلاق</Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif,.gif,.tif,.tiff,.bmp" className="sr-only" aria-label="اختيار ملف لإنشاء الحقول" onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
          <button type="button" disabled={loading} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }} className={cn("flex min-h-16 w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs font-bold hover:bg-slate-50", dragging ? "border-cyan-600 bg-cyan-50" : "border-slate-300 bg-white", loading && "opacity-60")}><UploadCloud className="h-5 w-5 text-cyan-700" />اسحب ملفًا أو اختر صورة / PDF</button>
          {!!files.length && <div className="mt-1.5 flex flex-wrap gap-1">{files.map((file, index) => <span key={`${file.name}-${index}`} className="flex items-center gap-1 rounded border bg-white px-1.5 py-1 text-[11px]"><FileText className="h-3.5 w-3.5 text-cyan-700" /><span className="max-w-52 truncate" dir="auto">{file.name}</span><button type="button" disabled={loading} aria-label="إزالة الملف" onClick={() => setFiles((current) => current.filter((_, item) => item !== index))}><X className="h-3 w-3 text-slate-400" /></button></span>)}</div>}
          <div className="mt-1.5 flex items-center gap-1.5"><Button size="sm" className="h-8 bg-cyan-700 text-xs hover:bg-cyan-800" disabled={!files.length || loading || remainingFields <= 0} onClick={() => void extract()}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}استخراج أسماء الحقول</Button><span className="text-[10px] font-bold text-slate-400">المتاح: {remainingFields} حقل</span>{fields.length ? <span className="text-[10px] font-black text-emerald-700">تم استخراج {fields.length} حقلًا</span> : null}</div>
          {error ? <p role="alert" className="mt-1.5 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</p> : null}
          {!!fields.length && <div className="mt-2 overflow-hidden rounded-lg border bg-white"><div className="border-b bg-slate-50 p-1.5"><Input aria-label="اسم القسم المستخرج" value={title} onChange={(event) => setTitle(event.target.value)} className="h-8 text-xs font-bold" maxLength={180} /></div><div className="max-h-[46dvh] divide-y overflow-y-auto">{fields.map((field, index) => <div key={`${field.label}-${index}`} className="flex items-center gap-1 p-1.5"><Input aria-label="اسم الحقل المستخرج" value={field.label} onChange={(event) => setFields((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} className="h-8 text-xs font-bold" maxLength={180} /><span className="shrink-0 rounded bg-cyan-50 px-2 py-1 text-[9px] font-black text-cyan-800">{fieldTypeLabel(field.type)}</span><button type="button" aria-label={`حذف ${field.label}`} onClick={() => setFields((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div></div>}
        </div>
        <footer className="flex justify-end gap-2 border-t bg-slate-50 px-3 py-2"><Button variant="outline" className="h-9 text-xs" disabled={loading} onClick={() => onOpenChange(false)}>إلغاء</Button><Button className="h-9 bg-slate-950 text-xs hover:bg-slate-800" disabled={!fields.length || !title.trim() || loading} onClick={createSection}><Plus className="h-4 w-4" />إنشاء القسم</Button></footer>
      </DialogContent>
    </Dialog>
  );
}
