"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Clipboard, Copy, Download, ExternalLink, FileImage, FileSearch, FileText, History, Loader2, Plus, Save, Search, Trash2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { cn } from "@/lib/utils";
import { useMvI18n } from "./mv-i18n";

type Field = {
  id: string; label: string; value: string; category: string;
  confidence: "high" | "medium" | "low"; page?: number; section?: string; row?: number; reviewed?: boolean;
  source?: { x: number; y: number; width: number; height: number };
};
type ExtractionDocument = {
  id: string; fileName: string; mimeType: string; documentType: string; language: string;
  status: "completed" | "empty" | "error"; fields: Field[]; message?: string;
  pages?: { page: number; text: string }[]; pageCount?: number; needsReview?: boolean; engine?: "local" | "gemini";
  createdAt?: string; updatedAt?: string; sourceUrl?: string; thumbnailUrl?: string;
};
type HistoryItem = Omit<ExtractionDocument, "fields" | "pages"> & { fieldCount: number };
type HistoryResponse = { items: HistoryItem[]; nextCursor: string | null };
const API = "/api/mv/data-extraction";
const isSaved = (id: string) => /^[a-f\d]{24}$/i.test(id);
const historyItem = ({ fields, pages: _pages, ...document }: ExtractionDocument): HistoryItem => ({ ...document, fieldCount: fields.length });
const csvCell = (value: unknown) => '"' + String(value ?? "").replace(/"/g, '""') + '"';

function download(contents: string, mime: string, name: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement("a");
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function MvDataExtractionWorkspace() {
  const { language, dir } = useMvI18n();
  const ar = language === "ar";
  const t = useCallback((arabic: string, english: string) => ar ? arabic : english, [ar]);
  const { toast } = useToast();
  const { user, csrfToken } = useAuthTracking();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [active, setActive] = useState<ExtractionDocument | null>(null);
  const [dirty, setDirty] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [query, setQuery] = useState("");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const busy = processing || saving || Boolean(loadingId);
  const identity = (user?.id ?? "") + ":" + (user?.companyId ?? "");
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const csrf = useRef(csrfToken);
  csrf.current = csrfToken;

  const reportError = useCallback((error: unknown) => {
    toast({ variant: "destructive", description: error instanceof Error ? error.message : t("تعذر إتمام العملية.", "The operation failed.") });
  }, [t, toast]);

  const request = useCallback(async <T,>(url: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(url, {
      credentials: "include", ...options,
      headers: { ...(options?.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...(csrf.current ? { "x-csrf-token": csrf.current } : {}), ...options?.headers },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(typeof body?.message === "string" ? body.message : "تعذر إتمام العملية / Request failed");
    return body as T;
  }, []);

  const loadHistory = useCallback(async (cursor?: string, signal?: AbortSignal) => {
    const owner = currentIdentity.current;
    setLoadingHistory(true); setHistoryError("");
    try {
      const result = await request<HistoryResponse>(API + "/history" + (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""), { signal });
      if (currentIdentity.current !== owner || signal?.aborted) return;
      setHistory(current => cursor ? [...current, ...result.items.filter(item => !current.some(old => old.id === item.id))] : result.items);
      setNextCursor(result.nextCursor);
    } catch (error) {
      if (!signal?.aborted && currentIdentity.current === owner) setHistoryError(error instanceof Error ? error.message : "تعذر تحميل السجل / Could not load history");
    } finally { if (!signal?.aborted && currentIdentity.current === owner) setLoadingHistory(false); }
  }, [request]);

  useEffect(() => {
    setActive(null); setDirty(false); setFiles([]); setHistory([]); setNextCursor(null); setSelectedField(null);
    if (!user?.id) return;
    const controller = new AbortController();
    void loadHistory(undefined, controller.signal);
    return () => controller.abort();
  }, [identity, loadHistory, user?.id]);

  useEffect(() => {
    if (!dirty && !processing) return;
    const guard = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, processing]);

  const saveActive = async () => {
    if (!active || !dirty) return;
    if (!isSaved(active.id)) throw new Error(t("هذه النتيجة لم تُحفظ في السجل.", "This result has not been saved to history."));
    setSaving(true);
    const owner = currentIdentity.current;
    try {
      const result = await request<ExtractionDocument>(API + "/history/" + active.id, { method: "PATCH", body: JSON.stringify({ fields: active.fields }) });
      if (currentIdentity.current !== owner) return;
      setActive(result); setDirty(false);
      setHistory(current => current.map(item => item.id === result.id ? historyItem(result) : item));
    } finally { setSaving(false); }
  };

  const openHistory = async (id: string) => {
    if (busy || active?.id === id) return;
    setLoadingId(id);
    const owner = currentIdentity.current;
    try {
      await saveActive();
      const document = await request<ExtractionDocument>(API + "/history/" + id);
      if (currentIdentity.current !== owner) return;
      setActive(document); setDirty(false); setSelectedField(null); setQuery(""); setReviewOnly(false);
    } catch (error) { reportError(error); }
    finally { setLoadingId(null); }
  };

  const addFiles = (incoming: File[]) => {
    if (busy) return;
    const next = [...files];
    let error = "";
    for (const file of incoming) {
      if (!/\.(pdf|jpe?g|png|webp|heic|heif|avif|gif|tiff?|bmp)$/i.test(file.name)) { error = t("استخدم صورة أو ملف PDF.", "Use an image or PDF file."); continue; }
      if (file.size > 15 * 1024 * 1024) { error = t("الحد الأقصى للملف 15 ميجابايت.", "Maximum file size is 15 MB."); continue; }
      if (next.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) continue;
      if (next.length >= 8 || next.reduce((sum, item) => sum + item.size, 0) + file.size > 40 * 1024 * 1024) { error = t("الحد الأقصى 8 ملفات بإجمالي 40 ميجابايت.", "Up to 8 files, 40 MB in total."); continue; }
      next.push(file);
    }
    setFiles(next);
    if (error) reportError(new Error(error));
  };

  const extract = async () => {
    if (!files.length || busy) return;
    if (!user) return reportError(new Error(t("سجل الدخول أولاً.", "Sign in first.")));
    const owner = currentIdentity.current;
    setProcessing(true);
    try {
      await saveActive();
      const form = new FormData();
      files.forEach(file => form.append("files", file, file.name));
      const result = await request<{ documents: ExtractionDocument[] }>(API, { method: "POST", body: form });
      if (currentIdentity.current !== owner) return;
      setActive(result.documents[0] ?? null); setSelectedField(null); setDirty(false); setQuery(""); setReviewOnly(false); setFiles([]);
      await loadHistory();
      const failed = result.documents.filter(item => item.status === "error").length;
      const fallback = result.documents.some(item => item.engine === "local" && item.message);
      const empty = result.documents.every(item => item.status === "empty");
      toast({ variant: failed ? "destructive" : "default", description: failed
        ? t("تعذرت قراءة بعض الملفات. التفاصيل محفوظة في السجل.", "Some files could not be read. Details are in history.")
        : fallback ? t("حُفظت النتائج باستخدام القراءة المحلية بعد تعذر تحليل AI. راجع التنبيه والقيم المستخرجة.", "Results saved using local OCR after AI was unavailable. Review the warning and extracted values.")
        : empty ? t("حُفظت الملفات، ولم يُعثر على حقول نصية واضحة.", "Files saved; no clear text fields were found.")
        : t("تم استخراج البيانات وحفظ الملفات في السجل.", "Data extracted and files saved to history.") });
    } catch (error) { reportError(error); }
    finally { setProcessing(false); }
  };

  const editField = (id: string, patch: Partial<Field>) => {
    setActive(current => current ? { ...current, fields: current.fields.map(field => field.id === id ? { ...field, ...patch, reviewed: true } : field) } : null);
    setDirty(true);
  };
  const removeField = (id: string) => {
    setActive(current => current ? { ...current, fields: current.fields.filter(field => field.id !== id) } : null);
    setDirty(true);
  };
  const addField = () => {
    setActive(current => current ? { ...current, fields: [...current.fields, { id: crypto.randomUUID(), label: "", value: "", category: "other", confidence: "high", section: t("حقول إضافية", "Additional fields"), reviewed: true }] } : null);
    setDirty(true); setReviewOnly(false); setQuery("");
  };

  const exportData = (format: "json" | "csv") => {
    if (!active) return;
    if (format === "json") return download(JSON.stringify(active, null, 2), "application/json;charset=utf-8", active.fileName + ".json");
    const rows = [["File", "Section", "Row", "Field", "Value", "Page", "Reviewed"], ...active.fields.map(f => [active.fileName, f.section ?? "", f.row ?? "", f.label, f.value, f.page ?? "", f.reviewed ? "Yes" : "No"])];
    const safeCell = (value: unknown) => csvCell(typeof value === "string" && /^[=+@\-\t\r]/.test(value) ? "'" + value : value);
    download("\ufeff" + rows.map(row => row.map(safeCell).join(",")).join("\r\n"), "text/csv;charset=utf-8", active.fileName + ".csv");
  };
  const copy = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.fields.map(f => [f.section, f.row, f.label].filter(Boolean).join(" / ") + ": " + f.value).join("\n"));
      toast({ description: t("تم النسخ.", "Copied.") });
    } catch (error) { reportError(error); }
  };
  const copyFieldValue = async (field: Field) => {
    try {
      await navigator.clipboard.writeText(field.value);
      toast({ description: t("تم نسخ القيمة.", "Value copied.") });
    } catch (error) { reportError(error); }
  };

  const closeActive = async () => {
    if (processing || saving || loadingId) return;
    try {
      await saveActive();
      setActive(null); setDirty(false); setSelectedField(null); setQuery(""); setReviewOnly(false);
    } catch (error) { reportError(error); }
  };

  const removeDocument = async () => {
    if (!deleteId) return;
    setLoadingId(deleteId);
    try {
      await request(API + "/history/" + deleteId, { method: "DELETE" });
      setHistory(current => current.filter(item => item.id !== deleteId));
      if (active?.id === deleteId) { setActive(null); setDirty(false); }
      setDeleteId(null);
    } catch (error) { reportError(error); }
    finally { setLoadingId(null); }
  };

  const reviewCount = active?.fields.filter(f => !f.reviewed && f.confidence !== "high").length ?? 0;
  const sections = useMemo(() => {
    const groups = new Map<string, Field[]>();
    for (const field of active?.fields ?? []) {
      if (query && ![field.label, field.value, field.section ?? ""].join(" ").toLocaleLowerCase().includes(query.toLocaleLowerCase())) continue;
      if (reviewOnly && (field.reviewed || field.confidence === "high")) continue;
      const key = [field.page ?? 1, field.section || t("بيانات المستند", "Document details"), field.row ?? ""].join("\u0000");
      groups.set(key, [...(groups.get(key) ?? []), field]);
    }
    return Array.from(groups, ([key, fields]) => ({ key, fields, section: fields[0]!.section || t("بيانات المستند", "Document details"), row: fields[0]!.row, page: fields[0]!.page ?? 1 }));
  }, [active, query, reviewOnly, t]);
  const formatDate = (date?: string) => date ? new Intl.DateTimeFormat(ar ? "ar-SA-u-ca-gregory" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(date)) : "";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-1.5 overflow-x-hidden overflow-y-auto overscroll-contain px-0.5 pb-2 text-slate-800 [-webkit-overflow-scrolling:touch]" dir={dir}>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <h1 className="flex items-center gap-2 text-base font-black text-slate-900"><FileSearch className="h-5 w-5 text-cyan-700" />{t("استخراج البيانات", "Data extraction")}</h1>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => inputRef.current?.click()}><Plus className="h-4 w-4" />{t("إضافة ملفات", "Add files")}</Button>
          <Button size="sm" className="h-8 bg-cyan-700 hover:bg-cyan-800" disabled={!files.length || busy} onClick={extract}>{processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}{processing ? t("جارٍ الاستخراج والحفظ…", "Extracting and saving…") : t("استخراج البيانات", "Extract data")}</Button>
        </div>
      </div>

      <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.avif,.gif,.tif,.tiff,.bmp" className="sr-only" aria-label={t("اختيار ملفات الاستخراج", "Choose extraction files")} disabled={busy} onChange={event => { addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
      <div role="button" tabIndex={busy ? -1 : 0} aria-disabled={busy} onClick={() => !busy && inputRef.current?.click()} onKeyDown={event => { if (!busy && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); inputRef.current?.click(); } }} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)); }} className={cn("flex min-h-16 items-center justify-center gap-3 rounded-lg border border-dashed px-3 py-2 text-center transition", dragging ? "border-cyan-600 bg-cyan-50" : "border-slate-300 bg-white hover:bg-slate-50", busy && "opacity-60")}>
        <UploadCloud className="h-6 w-6 shrink-0 text-cyan-700" />
        <div><p className="text-sm font-bold">{t("اسحب الصور أو ملفات PDF هنا", "Drop images or PDF files here")}</p><p className="text-[11px] text-slate-500">{t("حتى 8 ملفات · 15 م.ب للملف · تُحفظ مع نتائجها في السجل", "Up to 8 files · 15 MB each · Saved with results in history")}</p></div>
      </div>
      {files.length > 0 && <div className="flex flex-wrap gap-1.5">{files.map((file, index) => <div key={file.name + index} className="flex max-w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs"><FileText className="h-3.5 w-3.5 shrink-0 text-cyan-700" /><span className="max-w-64 truncate" dir="auto">{file.name}</span><span className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(1)} MB</span><button type="button" disabled={busy} aria-label={t("إزالة", "Remove")} className="p-1 text-slate-400 hover:text-red-600" onClick={() => setFiles(current => current.filter((_, i) => i !== index))}><X className="h-3 w-3" /></button></div>)}</div>}
      {processing && <p role="status" className="flex items-center gap-2 px-1 text-xs text-cyan-800"><Loader2 className="h-3.5 w-3.5 animate-spin" />{t("قراءة الصفحات والخلايا كاملة…", "Reading all pages and cells…")}</p>}

      <section aria-label={t("سجل الاستخراج", "Extraction history")} className="rounded-lg border border-slate-200 bg-white p-2">
        <div className="mb-2 flex items-center justify-between"><span className="flex items-center gap-1.5 text-xs font-bold"><History className="h-4 w-4 text-cyan-700" />{t("السجل", "History")}</span><button type="button" disabled={loadingHistory || busy} onClick={() => void loadHistory()} className="text-[11px] text-cyan-700">{loadingHistory ? t("جارٍ التحميل…", "Loading…") : t("تحديث", "Refresh")}</button></div>
        {historyError && <p role="alert" className="text-xs text-red-600">{historyError}</p>}
        {!history.length && !loadingHistory && !historyError && <p className="px-1 py-2 text-xs text-slate-400">{t("ستظهر ملفاتك هنا بعد استخراج البيانات.", "Your files will appear here after extraction.")}</p>}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {history.map(item => <div key={item.id} className={cn("group flex min-w-0 items-center rounded-md border", active?.id === item.id ? "border-cyan-600 bg-cyan-50/70" : "border-slate-200 hover:border-cyan-300")}>
            <button type="button" disabled={busy} aria-pressed={active?.id === item.id} onClick={() => void openHistory(item.id)} className="flex min-w-0 flex-1 items-center gap-2 p-1.5 text-start">
              <span className="flex h-14 w-11 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-slate-50">{item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover object-top" /> : <FileImage className="h-5 w-5 text-slate-400" />}</span>
              <span className="min-w-0"><span className="block truncate text-xs font-bold" dir="auto" title={item.fileName}>{item.fileName}</span><span className="mt-0.5 block text-[10px] text-slate-500">{formatDate(item.createdAt)}</span><span className={cn("block text-[10px]", item.status === "error" ? "text-red-600" : "text-cyan-800")}>{loadingId === item.id ? t("جارٍ الفتح…", "Opening…") : item.status === "error" ? t("تعذرت القراءة", "Could not read") : item.fieldCount + " " + t("حقل", "fields")}</span></span>
            </button>
            <button type="button" disabled={busy} onClick={() => setDeleteId(item.id)} aria-label={t("حذف", "Delete") + " " + item.fileName} className="mx-1 rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>)}
        </div>
        {nextCursor && <button type="button" disabled={loadingHistory || busy} onClick={() => void loadHistory(nextCursor)} className="mt-2 text-xs font-bold text-cyan-700">{t("تحميل المزيد", "Load more")}</button>}
      </section>

      <Dialog open={Boolean(active)} onOpenChange={open => { if (!open) void closeActive(); }}>
      {active && <DialogContent hideCloseButton dir={dir} className="!flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] !max-w-[1600px] flex-col gap-0 overflow-hidden rounded-xl border-slate-200 p-0 shadow-2xl sm:h-[94dvh] sm:w-[96vw]">
        <header className="flex flex-none flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-2.5 py-2">
          <div className="min-w-0"><DialogTitle className="truncate text-sm font-bold" dir="auto">{active.fileName}</DialogTitle><DialogDescription className="text-[11px] text-slate-500">{active.documentType} · {active.fields.length} {t("حقل", "fields")}{active.pageCount ? " · " + active.pageCount + " " + t("صفحة", "pages") : ""}{active.engine ? " · " + (active.engine === "gemini" ? t("تحليل AI", "AI analysis") : t("OCR محلي", "Local OCR")) : ""}</DialogDescription></div>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={copy}><Clipboard className="h-3 w-3" />{t("نسخ", "Copy")}</Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => exportData("csv")}><Download className="h-3 w-3" />CSV</Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => exportData("json")}>JSON</Button>
            <Button size="sm" className="h-7 bg-cyan-700 px-2 text-xs hover:bg-cyan-800" disabled={!dirty || busy} onClick={() => void saveActive().catch(reportError)}>{saving ? <Loader2 className="h-3 w-3 animate-spin" /> : dirty ? <Save className="h-3 w-3" /> : <Check className="h-3 w-3" />}{dirty ? t("حفظ التعديلات", "Save changes") : t("محفوظ", "Saved")}</Button>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" disabled={busy} onClick={() => void closeActive()}><X className="h-3.5 w-3.5" />{t("إغلاق", "Close")}</Button>
          </div>
        </header>
        {active.message && <p role="alert" className={cn("border-b px-3 py-2 text-xs", active.status === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800")}>{active.message}</p>}
        <div className="grid min-h-0 flex-1 items-stretch gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(300px,40%)] lg:overflow-hidden">
          <div className="flex min-h-[52dvh] min-w-0 flex-col overflow-hidden p-1.5 lg:min-h-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-1"><div className="relative min-w-40 flex-1"><Search className="absolute start-2 top-2 h-3.5 w-3.5 text-slate-400" /><Input aria-label={t("البحث في الحقول", "Search fields")} placeholder={t("ابحث في الحقول والقيم", "Search fields and values")} value={query} onChange={event => setQuery(event.target.value)} className="h-8 ps-7 text-xs" /></div>{reviewCount > 0 && <button type="button" aria-pressed={reviewOnly} onClick={() => setReviewOnly(!reviewOnly)} className={cn("flex h-8 items-center gap-1 rounded-md border px-2 text-[11px]", reviewOnly ? "border-amber-400 bg-amber-100 text-amber-900" : "border-amber-200 bg-amber-50 text-amber-800")}><AlertCircle className="h-3.5 w-3.5" />{reviewCount} {t("للمراجعة", "to review")}</button>}</div>
            <div
              role="region"
              aria-label={t("الحقول المستخرجة", "Extracted fields")}
              tabIndex={0}
              className="min-h-0 max-h-[58dvh] flex-1 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-slate-200 [scrollbar-gutter:stable] [-webkit-overflow-scrolling:touch] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600/40 lg:max-h-none"
            >
              {sections.map(group => <div key={group.key} className="border-t border-slate-200 first:border-t-0">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-100/80 px-2 py-1 text-[11px] font-bold"><span>{group.section}{group.row ? " · " + t("سطر", "Row") + " " + group.row : ""}</span>{(active.pageCount ?? 1) > 1 && <span className="text-[10px] font-normal text-slate-500">{t("صفحة", "Page")} {group.page}</span>}</div>
                <div className="divide-y divide-slate-100">
                  {group.fields.map(field => <div key={field.id} onFocus={() => setSelectedField(field)} className={cn("grid grid-cols-[minmax(90px,32%)_minmax(0,1fr)_24px] items-start gap-1 px-1.5 py-1", selectedField?.id === field.id && "bg-cyan-50/50")}>
                    <Input dir="auto" aria-label={t("اسم الحقل", "Field name")} value={field.label} disabled={busy} onChange={event => editField(field.id, { label: event.target.value })} className="h-8 rounded-sm border-transparent bg-transparent px-1 text-xs font-bold shadow-none hover:border-slate-200 focus-visible:ring-1" />
                    <Textarea dir="auto" aria-label={field.label || t("القيمة", "Value")} value={field.value} disabled={busy} rows={Math.min(6, Math.max(1, field.value.split("\n").length, Math.ceil(field.value.length / 70)))} onChange={event => editField(field.id, { value: event.target.value })} className={cn("min-h-8 resize-y rounded border-slate-200 bg-white px-2 py-1 text-xs leading-6 shadow-none focus-visible:ring-1", !field.reviewed && field.confidence === "low" && "border-amber-300 bg-amber-50/30")} />
                    <div className="flex flex-col items-center"><button type="button" disabled={busy} aria-label={t(`نسخ قيمة ${field.label}`, `Copy ${field.label} value`)} title={t("نسخ القيمة", "Copy value")} onClick={() => void copyFieldValue(field)} className="rounded p-1 text-slate-400 hover:bg-cyan-50 hover:text-cyan-700"><Copy className="h-3.5 w-3.5" /></button><button type="button" disabled={busy} aria-label={t("تأكيد مراجعة الحقل", "Mark field reviewed")} title={field.reviewed ? t("تمت المراجعة", "Reviewed") : t("تأكيد المراجعة", "Mark reviewed")} onClick={() => editField(field.id, { reviewed: true })} className={cn("rounded p-1", field.reviewed ? "text-emerald-600" : "text-slate-300 hover:text-emerald-600")}><Check className="h-3.5 w-3.5" /></button><button type="button" disabled={busy} aria-label={t("حذف الحقل", "Delete field")} onClick={() => removeField(field.id)} className="rounded p-1 text-slate-300 hover:text-red-600"><Trash2 className="h-3 w-3" /></button></div>
                  </div>)}
                </div>
              </div>)}
              {!sections.length && <p className="py-4 text-center text-xs text-slate-500">{t("لا توجد حقول مطابقة.", "No matching fields.")}</p>}
            </div>
            <div className="flex flex-none items-start gap-1.5 pt-1.5"><button type="button" disabled={busy} onClick={addField} className="flex shrink-0 items-center gap-1 rounded border border-dashed border-slate-300 px-2 py-1 text-xs text-cyan-800"><Plus className="h-3.5 w-3.5" />{t("إضافة حقل", "Add field")}</button>{!!active.pages?.length && <details className="max-h-28 min-w-0 flex-1 overflow-auto rounded border border-slate-200 px-2 py-1"><summary className="cursor-pointer text-xs font-bold text-slate-600">{t("النص الكامل المقروء", "Full recognized text")}</summary>{active.pages.map(page => <div key={page.page} className="mt-2"><span className="text-[10px] text-slate-400">{t("صفحة", "Page")} {page.page}</span><pre dir="auto" className="mt-1 whitespace-pre-wrap break-words font-sans text-xs leading-6">{page.text}</pre></div>)}</details>}</div>
          </div>
          <aside className="flex min-h-[50dvh] min-w-0 flex-col overflow-hidden border-t border-slate-200 bg-slate-50 p-1.5 lg:min-h-0 lg:border-s lg:border-t-0">
            <div className="mb-1.5 flex flex-none items-center justify-between text-xs font-bold"><span>{t("الملف الأصلي", "Source file")}</span>{active.sourceUrl && <a href={active.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-normal text-cyan-700"><ExternalLink className="h-3 w-3" />{t("فتح / تنزيل", "Open / download")}</a>}</div>
            {active.sourceUrl ? active.mimeType === "application/pdf" ? <iframe key={active.id + "-" + (selectedField?.page ?? 1)} title={t("معاينة المستند الأصلي", "Source document preview")} src={active.sourceUrl + "#page=" + (selectedField?.page ?? 1)} className="h-[55dvh] min-h-0 w-full flex-1 rounded border border-slate-200 bg-white lg:h-full" /> : <div className="min-h-0 flex-1 overflow-auto rounded border border-slate-200 bg-white"><div className="relative"><img src={API + "/history/" + active.id + "/preview"} alt={active.fileName} className="block h-auto w-full" />{selectedField?.source && <span aria-hidden className="pointer-events-none absolute border-2 border-amber-500 bg-amber-200/25" style={{ left: selectedField.source.x * 100 + "%", top: selectedField.source.y * 100 + "%", width: selectedField.source.width * 100 + "%", height: selectedField.source.height * 100 + "%" }} />}</div></div> : <div className="flex h-40 items-center justify-center text-slate-400"><FileText className="h-8 w-8" /></div>}
          </aside>
        </div>
      </DialogContent>}
      </Dialog>
      <AlertDialog open={Boolean(deleteId)} onOpenChange={open => !open && !loadingId && setDeleteId(null)}><AlertDialogContent dir={dir}><AlertDialogHeader><AlertDialogTitle>{t("حذف الملف من السجل؟", "Delete this file from history?")}</AlertDialogTitle><AlertDialogDescription>{t("سيتم حذف الأصل والصورة المصغرة والبيانات المستخرجة لهذا الملف.", "The source, thumbnail and extracted data for this file will be deleted.")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={Boolean(loadingId)}>{t("إلغاء", "Cancel")}</AlertDialogCancel><AlertDialogAction disabled={Boolean(loadingId)} className="bg-red-600 hover:bg-red-700" onClick={event => { event.preventDefault(); void removeDocument(); }}>{loadingId ? <Loader2 className="h-4 w-4 animate-spin" /> : t("حذف", "Delete")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  );
}
