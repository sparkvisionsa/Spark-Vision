"use client";

import { useRef, useState } from "react";
import { Loader2, RefreshCcw, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type AssetTypeCount = {
  vehicles: number;
  machinery: number;
  electronics: number;
  furniture: number;
  other: number;
};

export interface AssetImportSheetStat {
  sheetName: string;
  /** معرّف دفعة الاستيراد التي تنتمي إليها الورقة (للشبكة والحذف عند دمج عدة استيرادات) */
  importId: string;
  rowCount: number;
  columnCount: number;
}

/** ورقة نشطة للشبكة — يجمع الاسم مع importId عند وجود أكثر من دفعة استيراد */
export type ActiveImportSheetRef = { importId: string; sheetName: string };

export interface AssetImportSummary {
  totalSheets: number;
  totalRows: number;
  byType: AssetTypeCount;
  warnings: string[];
  sheets: AssetImportSheetStat[];
}

export interface AssetImportResult {
  success: true;
  projectId: string;
  importId: string;
  summary: AssetImportSummary;
}

interface AssetImportPanelProps {
  projectId: string;
  importResult: AssetImportResult | null;
  onImported: (result: AssetImportResult) => void;
  onClearImport: () => void;
  /** تحديث الملخص دون رسالة «تم الاستيراد» (مثلاً بعد حذف ورقة) */
  onImportResultChange?: (result: AssetImportResult | null) => void;
  /** ورقة واحدة للمعالجة والتقييم؛ null = كل الأوراق */
  activeSheet?: ActiveImportSheetRef | null;
  onActiveSheetChange?: (ref: ActiveImportSheetRef | null) => void;
  /** بعد حذف ورقة أو تعديل الملخص — إعادة جلب الشبكة */
  onSheetsDirty?: () => void;
  /** عنوان المرحلة في نفس صف أزرار الاستيراد (مسار العمل) */
  stepTitle?: string;
}

const ACCEPTED_ASSET_FILES =
  ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/csv,application/zip,application/octet-stream";

function messageFromFailedImportBody(text: string, status: number, fallback: string) {
  if (text) {
    try {
      const data = JSON.parse(text) as { message?: string | string[] };
      if (data?.message) {
        return Array.isArray(data.message) ? data.message.join(" ") : String(data.message);
      }
    } catch {
      if (text.length < 400) return text;
    }
  }
  if (status === 401) return "تسجيل الدخول مطلوب لاستيراد الأصول.";
  if (status === 413) return "حجم الملف كبير جداً بالنسبة للخادم. قلّل الحجم أو قسّم الملف.";
  if (status >= 500) return "خطأ في الخادم أثناء الاستيراد. حاول لاحقاً.";
  return fallback;
}

/** يضمن وجود importId على كل ورقة (بيانات قديمة أو رد الخادم بدون الحقل) */
export function withSheetImportIds(result: AssetImportResult): AssetImportResult {
  const id = result.importId;
  const sheets = result.summary.sheets.map((s) => ({
    ...s,
    importId: s.importId ?? id,
  }));
  return { ...result, summary: { ...result.summary, sheets } };
}

export function normalizeImportResult(result: AssetImportResult): AssetImportResult {
  const base = !Array.isArray(result.summary?.sheets)
    ? {
        ...result,
        summary: { ...result.summary, sheets: [] },
      }
    : result;
  return withSheetImportIds(base);
}

/** دمج استيراد جديد مع ملخص سابق دون حذف الشيتات القديمة */
export function mergeImportResults(
  previous: AssetImportResult | null,
  incoming: AssetImportResult,
): AssetImportResult {
  const next = normalizeImportResult(incoming);
  if (!previous) return next;
  const prev = normalizeImportResult(previous);
  if (prev.projectId !== next.projectId) return next;
  const sheets = [...prev.summary.sheets, ...next.summary.sheets];
  return {
    ...next,
    summary: {
      totalSheets: sheets.length,
      totalRows: sheets.reduce((a, s) => a + s.rowCount, 0),
      byType: {
        vehicles: prev.summary.byType.vehicles + next.summary.byType.vehicles,
        machinery: prev.summary.byType.machinery + next.summary.byType.machinery,
        electronics: prev.summary.byType.electronics + next.summary.byType.electronics,
        furniture: prev.summary.byType.furniture + next.summary.byType.furniture,
        other: prev.summary.byType.other + next.summary.byType.other,
      },
      warnings: [...prev.summary.warnings, ...next.summary.warnings],
      sheets,
    },
  };
}

/** مطابقة الورقة المحفوظة في الجلسة مع ملخص يحتوي importId لكل ورقة */
export function migrateStoredActiveRef(
  stored: { importId: string | null; sheetName: string } | null,
  importResult: AssetImportResult | null,
): ActiveImportSheetRef | null {
  if (!stored?.sheetName.trim() || !importResult) return null;
  const norm = withSheetImportIds(importResult);
  const name = stored.sheetName.trim();
  const importId =
    stored.importId?.trim() ||
    norm.summary.sheets.find((s) => s.sheetName === name)?.importId ||
    "";
  if (!importId) return null;
  const ok = norm.summary.sheets.some((s) => s.importId === importId && s.sheetName === name);
  return ok ? { importId, sheetName: name } : null;
}

/** importId واسم الورقة للشبكة الذكية عند اختيار ورقة محددة */
export function resolveSmartGridImport(
  importResult: AssetImportResult | null,
  active: ActiveImportSheetRef | null,
): { importId: string; sheetName: string | undefined } {
  if (!importResult) return { importId: "", sheetName: undefined };
  const norm = withSheetImportIds(importResult);
  if (active?.sheetName) {
    const sheet = norm.summary.sheets.find(
      (s) =>
        s.sheetName === active.sheetName &&
        (!active.importId || s.importId === active.importId),
    );
    if (sheet) return { importId: sheet.importId, sheetName: sheet.sheetName };
  }
  return { importId: norm.importId, sheetName: undefined };
}

/** بعد حذف ورقة من الخادم: تحديث ملخص الجلسة محلياً */
export function stripSheetFromImportResult(
  prev: AssetImportResult,
  sheetName: string,
  importId?: string,
): AssetImportResult | null {
  const norm = withSheetImportIds(prev);
  const removed =
    importId !== undefined
      ? norm.summary.sheets.find((s) => s.sheetName === sheetName && s.importId === importId)
      : norm.summary.sheets.find((s) => s.sheetName === sheetName);
  if (!removed) return prev;
  const nextSheets = norm.summary.sheets.filter((s) =>
    importId !== undefined
      ? !(s.sheetName === sheetName && s.importId === importId)
      : s.sheetName !== sheetName,
  );
  const rowDelta = removed.rowCount;
  const nextByType = { ...norm.summary.byType };
  nextByType.other = Math.max(0, nextByType.other - rowDelta);

  if (nextSheets.length === 0) return null;

  return {
    ...norm,
    summary: {
      ...norm.summary,
      sheets: nextSheets,
      totalRows: Math.max(0, norm.summary.totalRows - rowDelta),
      totalSheets: Math.max(0, norm.summary.totalSheets - 1),
      byType: nextByType,
    },
  };
}

/** تحديث عدد الصفوف/الأعمدة على كارد الشيت بعد إضافة صف أو عمود في الشبكة */
export function updateSheetStatsInImportResult(
  prev: AssetImportResult,
  sheetName: string,
  stats: { rowCount: number; columnCount: number },
  sheetImportId?: string,
): AssetImportResult {
  const norm = withSheetImportIds(prev);
  const idx = norm.summary.sheets.findIndex((s) =>
    sheetImportId !== undefined
      ? s.sheetName === sheetName && s.importId === sheetImportId
      : s.sheetName === sheetName,
  );
  if (idx === -1) return prev;
  const old = norm.summary.sheets[idx];
  if (old.rowCount === stats.rowCount && old.columnCount === stats.columnCount) {
    return prev;
  }
  const rowDelta = stats.rowCount - old.rowCount;
  const nextSheets = [...norm.summary.sheets];
  nextSheets[idx] = {
    ...old,
    rowCount: stats.rowCount,
    columnCount: stats.columnCount,
  };
  return {
    ...norm,
    summary: {
      ...norm.summary,
      sheets: nextSheets,
      totalRows: Math.max(0, norm.summary.totalRows + rowDelta),
      byType: {
        ...norm.summary.byType,
        other: Math.max(0, norm.summary.byType.other + rowDelta),
      },
    },
  };
}

export default function AssetImportPanel({
  projectId,
  importResult,
  onImported,
  onClearImport,
  onImportResultChange,
  activeSheet = null,
  onActiveSheetChange,
  onSheetsDirty,
  stepTitle,
}: AssetImportPanelProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [deletingSheet, setDeletingSheet] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setError("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", projectId);
      formData.append("sourceFileNameUtf8", file.name);

      const response = await fetch("/api/assets/import", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const responseText = await response.text();
      if (!response.ok) {
        const detail = messageFromFailedImportBody(
          responseText,
          response.status,
          "تعذّر استيراد ملف الأصول. تحقق من الصيغة وحجم الملف وتسجيل الدخول.",
        );
        throw new Error(detail);
      }

      const result = normalizeImportResult(JSON.parse(responseText) as AssetImportResult);
      onImported(result);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "تعذّر استيراد ملف الأصول.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const sheets = importResult?.summary.sheets ?? [];
  const showSheetActions = Boolean(importResult) && sheets.length > 0;

  const handleDeleteSheet = async (sheet: AssetImportSheetStat) => {
    if (!importResult) return;
    const norm = withSheetImportIds(importResult);
    const sid = sheet.importId ?? norm.importId;
    const ok = window.confirm(
      `حذف ورقة «${sheet.sheetName}» من هذا الاستيراد؟ سيُزال كل الصفوف المرتبطة بها من النظام ولا يمكن التراجع.`,
    );
    if (!ok) return;

    setDeletingSheet(`${sid}:${sheet.sheetName}`);
    setError("");
    try {
      const qs = new URLSearchParams({
        projectId,
        importId: sid,
        sheetName: sheet.sheetName,
      });
      const res = await fetch(`/api/assets/import-sheet?${qs.toString()}`, {
        method: "DELETE",
        credentials: "include",
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = "تعذّر حذف الورقة.";
        try {
          const j = JSON.parse(text) as { message?: string | string[] };
          if (j.message) msg = Array.isArray(j.message) ? j.message.join(" ") : j.message;
        } catch {
          if (text.length < 400) msg = text;
        }
        throw new Error(msg);
      }
      let deletedCount = 0;
      try {
        const j = JSON.parse(text) as { deletedCount?: number };
        if (typeof j.deletedCount === "number") deletedCount = j.deletedCount;
      } catch {
        /* ignore */
      }
      if (deletedCount === 0) {
        toast({
          variant: "destructive",
          description: "لم يُحذف أي صف — قد لا تتطابق الورقة مع الخادم. أعد الاستيراد إن لزم.",
        });
        return;
      }
      const next = stripSheetFromImportResult(importResult, sheet.sheetName, sid);
      if (onImportResultChange) {
        onImportResultChange(next);
      } else if (next) {
        onImported(next);
      } else {
        onClearImport();
      }
      if (activeSheet?.sheetName === sheet.sheetName && activeSheet?.importId === sid) {
        onActiveSheetChange?.(null);
      }
      onSheetsDirty?.();
      toast({
        description:
          deletedCount > 0
            ? `تم حذف ورقة «${sheet.sheetName}» (${deletedCount.toLocaleString("ar-SA")} صف).`
            : `تم حذف ورقة «${sheet.sheetName}».`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر حذف الورقة.");
    } finally {
      setDeletingSheet(null);
    }
  };

  const buttons = (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={ACCEPTED_ASSET_FILES}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.currentTarget.value = "";
        }}
      />
      <Button
        type="button"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
        className="gap-2 bg-[#0C447C] hover:bg-[#0a3a66]"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UploadCloud className="h-4 w-4" />
        )}
        {isUploading ? "جارٍ الاستيراد…" : "استيراد ملفات الأصول"}
      </Button>
      {importResult ? (
        <Button type="button" variant="outline" size="sm" onClick={onClearImport} className="gap-2">
          <RefreshCcw className="h-4 w-4" />
        اعادة تعيين الأصول
        </Button>
      ) : null}
    </div>
  );

  const errorBlock =
    error ? (
      <div className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</div>
    ) : null;

  const warningsBlock =
    importResult && importResult.summary.warnings.length > 0 ? (
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-2 py-2">
        <p className="text-[11px] font-semibold text-amber-900">تنبيهات</p>
        <ul className="mt-1 space-y-0.5 text-[11px] text-amber-950">
          {importResult.summary.warnings.slice(0, 8).map((warning) => (
            <li key={warning}>• {warning}</li>
          ))}
        </ul>
      </div>
    ) : null;

  const sheetCards =
    importResult && sheets.length > 0 ? (
      <div className="space-y-2">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sheets.map((s) => {
            const sid = s.importId ?? importResult?.importId ?? "";
            const isActive =
              Boolean(activeSheet) &&
              activeSheet?.sheetName === s.sheetName &&
              activeSheet?.importId === sid;
            const busy = deletingSheet === `${sid}:${s.sheetName}`;
            return (
              <div
                key={`${sid}:${s.sheetName}`}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border bg-white px-3 py-2 text-right shadow-sm transition-colors",
                  isActive ? "border-emerald-400 ring-1 ring-emerald-200" : "border-slate-200",
                )}
              >
                <div>
                  <p className="truncate text-[12px] font-semibold text-slate-900" title={s.sheetName}>
                    {s.sheetName}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                    {s.rowCount} صف · {s.columnCount} عمود
                  </p>
                </div>
                {showSheetActions ? (
                  <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                    {onActiveSheetChange ? (
                      <Button
                        type="button"
                        variant={isActive ? "secondary" : "outline"}
                        size="sm"
                        className="h-7 flex-1 text-[10px] sm:text-[11px]"
                        disabled={busy || isActive}
                        onClick={() => onActiveSheetChange({ importId: sid, sheetName: s.sheetName })}
                      >
                        {isActive ? "مفعّلة" : "تعيين للمعالجة"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-[10px] text-red-700 hover:bg-red-50 sm:text-[11px]"
                      disabled={busy}
                      onClick={() => void handleDeleteSheet(s)}
                    >
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      حذف
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {activeSheet && onActiveSheetChange ? (
          <div className="text-end">
            <button
              type="button"
              className="text-[11px] font-medium text-[#0C447C] underline-offset-2 hover:underline"
              onClick={() => onActiveSheetChange(null)}
            >
              عرض كل الأوراق
            </button>
          </div>
        ) : null}
      </div>
    ) : importResult ? (
      <p className="text-[11px] text-slate-400">لا توجد أوراق ببيانات في هذا الاستيراد.</p>
    ) : null;

  if (stepTitle) {
    return (
      <div className="space-y-2" dir="rtl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <h2 className="text-sm font-semibold text-[#0C447C]">{stepTitle}</h2>
          {buttons}
        </div>
        {errorBlock}
        {sheetCards}
        {warningsBlock}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-slate-200/80 bg-slate-50/60 p-3" dir="rtl">
      {buttons}
      {errorBlock}
      {sheetCards}
      {warningsBlock}
    </div>
  );
}
