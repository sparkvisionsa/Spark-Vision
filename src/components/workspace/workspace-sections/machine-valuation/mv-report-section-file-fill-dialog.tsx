"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FileInput, FileSearch, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { MvReportCustomField } from "./mv-report-custom-fields";

const EXTRACTION_API = "/api/mv/data-extraction";
const ACCEPTED_FILES = /\.(pdf|jpe?g|png|webp|heic|heif|avif|gif|tiff?|bmp)$/i;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

type ExtractedField = { label?: string; value?: string; inputType?: string };
type ExtractedDocument = { fileName?: string; fields?: ExtractedField[] };
type Match = { fieldId: string; label: string; value: string; confidence: number };

function responseMessage(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "message" in body && typeof body.message === "string") return body.message;
  return fallback;
}

function normalizedLabel(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function matchScore(expected: string, actual: string) {
  const left = normalizedLabel(expected);
  const right = normalizedLabel(actual);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.88;
  const leftWords = new Set(left.split(" ").filter(Boolean));
  const rightWords = new Set(right.split(" ").filter(Boolean));
  const shared = [...leftWords].filter((word) => rightWords.has(word)).length;
  return shared / Math.max(leftWords.size, rightWords.size);
}

function buildMatches(fields: MvReportCustomField[], extracted: ExtractedField[]) {
  const used = new Set<number>();
  const matches: Match[] = [];
  for (const field of fields) {
    let bestIndex = -1;
    let bestScore = 0;
    extracted.forEach((candidate, index) => {
      if (used.has(index) || !candidate.label?.trim() || !candidate.value?.trim()) return;
      const score = matchScore(field.label, candidate.label);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0 && bestScore >= 0.62) {
      used.add(bestIndex);
      matches.push({ fieldId: field.id, label: field.label, value: extracted[bestIndex]!.value!.trim(), confidence: bestScore });
    }
  }
  return matches;
}

export function MvReportSectionFileFillDialog({
  open,
  onOpenChange,
  sectionTitle,
  fields,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionTitle: string;
  fields: MvReportCustomField[];
  onApply: (values: Array<{ id: string; value: string }>) => void;
}) {
  const { csrfToken } = useAuthTracking();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const unmatchedCount = useMemo(() => Math.max(0, fields.length - matches.length), [fields.length, matches.length]);

  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setMatches([]);
    setDragging(false);
    setError("");
  }, [open, sectionTitle]);

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
      form.append("targetFields", JSON.stringify(fields.map((field) => field.label)));
      const response = await fetch(EXTRACTION_API, {
        method: "POST",
        body: form,
        credentials: "include",
        headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
      });
      const body = await response.json().catch(() => null) as { documents?: ExtractedDocument[] } | null;
      if (!response.ok) throw new Error(responseMessage(body, "تعذر استخراج بيانات الملف."));
      const extracted = (body?.documents ?? []).flatMap((document) => document.fields ?? []);
      const nextMatches = buildMatches(fields, extracted);
      setMatches(nextMatches);
      if (!nextMatches.length) setError("لم تتطابق أسماء الحقول في الملف مع حقول هذا القسم.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر استخراج بيانات الملف.");
    } finally {
      setLoading(false);
    }
  };

  const apply = () => {
    if (!matches.length) return;
    onApply(matches.map(({ fieldId, value }) => ({ id: fieldId, value })));
    toast({ description: `تم ملء ${matches.length} حقلًا في قسم «${sectionTitle}».` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!loading) onOpenChange(next); }}>
      <DialogContent hideCloseButton dir="rtl" className="!flex h-[min(90dvh,760px)] w-[min(96vw,820px)] !max-w-none flex-col gap-0 overflow-hidden rounded-xl p-0">
        <header className="flex items-center justify-between gap-2 border-b bg-slate-50 px-3 py-2">
          <div className="min-w-0"><DialogTitle className="flex items-center gap-2 text-sm font-black"><FileInput className="h-4 w-4 text-cyan-700" />ملء الحقول من ملف</DialogTitle><DialogDescription className="truncate text-[11px]">{sectionTitle}</DialogDescription></div>
          <Button variant="outline" size="sm" className="h-8 px-2 text-xs" disabled={loading} onClick={() => onOpenChange(false)}><X className="h-3.5 w-3.5" />إغلاق</Button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif,.gif,.tif,.tiff,.bmp" className="sr-only" aria-label="اختيار ملف لملء الحقول" onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
          <button type="button" disabled={loading} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }} className={cn("flex min-h-16 w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs font-bold hover:bg-slate-50", dragging ? "border-cyan-600 bg-cyan-50" : "border-slate-300 bg-white", loading && "opacity-60")}><UploadCloud className="h-5 w-5 text-cyan-700" />اسحب ملفًا أو اختر صورة / PDF</button>
          {!!files.length && <div className="mt-1.5 flex flex-wrap gap-1">{files.map((file, index) => <span key={`${file.name}-${index}`} className="flex items-center gap-1 rounded border bg-white px-1.5 py-1 text-[11px]"><FileText className="h-3.5 w-3.5 text-cyan-700" /><span className="max-w-52 truncate" dir="auto">{file.name}</span><button type="button" disabled={loading} aria-label="إزالة الملف" onClick={() => setFiles((current) => current.filter((_, item) => item !== index))}><X className="h-3 w-3 text-slate-400" /></button></span>)}</div>}
          <div className="mt-1.5 flex items-center gap-1.5"><Button size="sm" className="h-8 bg-cyan-700 text-xs hover:bg-cyan-800" disabled={!files.length || !fields.length || loading} onClick={() => void extract()}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}استخراج وملء الحقول</Button>{!!matches.length && <span className="text-[10px] font-bold text-emerald-700">{matches.length}/{fields.length} مطابق</span>}</div>
          <p className="mt-1 text-[10px] font-semibold text-slate-500">تُرسل أسماء حقول هذا القسم إلى التحليل ليُرجع القيم بالمسمّيات نفسها.</p>
          {error ? <p role="alert" className="mt-1.5 rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</p> : null}
          {!!matches.length && <div className="mt-2 overflow-hidden rounded-lg border bg-white"><div className="flex items-center justify-between border-b bg-slate-50 px-2 py-1.5 text-[10px] font-bold text-slate-500"><span>القيم المطابقة</span><span>{unmatchedCount ? `${unmatchedCount} حقل لم يجد قيمة` : "جميع الحقول مطابقة"}</span></div><div className="max-h-[46dvh] divide-y overflow-y-auto">{matches.map((match) => <div key={match.fieldId} className="grid grid-cols-[minmax(110px,30%)_minmax(0,1fr)_24px] items-start gap-1 p-1.5"><span className="pt-1.5 text-xs font-black text-slate-800">{match.label}</span><p dir="auto" className="rounded bg-slate-50 px-2 py-1.5 text-xs leading-5 text-slate-700">{match.value}</p><Check className="mt-1.5 h-3.5 w-3.5 text-emerald-600" /></div>)}</div></div>}
        </div>
        <footer className="flex justify-end gap-2 border-t bg-slate-50 px-3 py-2"><Button variant="outline" className="h-9 text-xs" disabled={loading} onClick={() => onOpenChange(false)}>إلغاء</Button><Button className="h-9 bg-slate-950 text-xs hover:bg-slate-800" disabled={!matches.length || loading} onClick={apply}><Check className="h-4 w-4" />تطبيق القيم المطابقة</Button></footer>
      </DialogContent>
    </Dialog>
  );
}
