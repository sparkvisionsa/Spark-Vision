"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, FolderPlus, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  type ActiveImportSheetRef,
  type AssetImportResult,
  mergeImportResults,
  normalizeImportResult,
  withSheetImportIds,
} from "./asset-import-panel";

const ACCEPTED_ASSET_IMPORT_FILES =
  ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/csv";

type AssetFolderImportColumn = { key: string; label: string };

interface MvAssetImageFoldersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  initialImportResult?: AssetImportResult | null;
  onImportResultChange?: (result: AssetImportResult | null) => void;
  onGenerated?: () => void | Promise<void>;
  showSkip?: boolean;
  skipLabel?: string;
  onSkip?: () => void;
}

function assetImportSessionStorageKey(projectId: string) {
  return `sv:asset-import:${projectId}`;
}

function readAssetImportFromSession(projectId: string): AssetImportResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(assetImportSessionStorageKey(projectId));
    if (!raw?.trim()) return null;
    const parsed = JSON.parse(raw) as AssetImportResult;
    if (!parsed || parsed.success !== true || parsed.projectId !== projectId) return null;
    return normalizeImportResult(parsed);
  } catch {
    return null;
  }
}

function writeAssetImportToSession(projectId: string, result: AssetImportResult | null) {
  if (typeof window === "undefined") return;
  if (result) {
    window.sessionStorage.setItem(assetImportSessionStorageKey(projectId), JSON.stringify(result));
  } else {
    window.sessionStorage.removeItem(assetImportSessionStorageKey(projectId));
  }
}

function parseMvAssetApiErrorMessage(responseText: string, fallback: string): string {
  try {
    const j = JSON.parse(responseText) as { message?: string | string[] };
    if (j.message) {
      return Array.isArray(j.message) ? j.message.join(" ") : String(j.message);
    }
  } catch {
    const t = responseText.trim();
    if (t.length > 0 && t.length < 600) return t;
  }
  return fallback;
}

export function MvAssetImageFoldersModal({
  open,
  onOpenChange,
  projectId,
  initialImportResult = null,
  onImportResultChange,
  onGenerated,
  showSkip,
  skipLabel = "تخطي والمتابعة",
  onSkip,
}: MvAssetImageFoldersModalProps) {
  const { toast } = useToast();
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<AssetImportResult | null>(initialImportResult);
  const [selectedSheet, setSelectedSheet] = useState<ActiveImportSheetRef | null>(null);
  const [columns, setColumns] = useState<AssetFolderImportColumn[]>([]);
  const [selectedColumnKey, setSelectedColumnKey] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [renamingSheet, setRenamingSheet] = useState(false);
  const [sheetNameDraft, setSheetNameDraft] = useState("");

  const setNextImportResult = useCallback(
    (next: AssetImportResult | null) => {
      const normalized = next ? normalizeImportResult(next) : null;
      setImportResult(normalized);
      onImportResultChange?.(normalized);
      if (projectId) writeAssetImportToSession(projectId, normalized);
    },
    [onImportResultChange, projectId],
  );

  const sheets = useMemo(() => {
    if (!importResult) return [];
    return withSheetImportIds(importResult).summary.sheets;
  }, [importResult]);

  const loadImportSummary = useCallback(async () => {
    if (!projectId) return;
    const sessionResult = readAssetImportFromSession(projectId);
    if (sessionResult) setNextImportResult(sessionResult);

    try {
      setLoadingSummary(true);
      const response = await fetch(`/api/assets/imports?projectId=${encodeURIComponent(projectId)}`, {
        credentials: "include",
      });
      if (!response.ok) return;
      const persisted = normalizeImportResult((await response.json()) as AssetImportResult);
      const next = persisted.projectId === projectId && persisted.summary.sheets.length > 0 ? persisted : null;
      setNextImportResult(next);
    } finally {
      setLoadingSummary(false);
    }
  }, [projectId, setNextImportResult]);

  useEffect(() => {
    if (!open) return;
    setImportResult(initialImportResult ? normalizeImportResult(initialImportResult) : null);
    void loadImportSummary();
  }, [loadImportSummary, open, projectId]);

  useEffect(() => {
    if (sheets.length === 0) {
      setSelectedSheet(null);
      setColumns([]);
      setSelectedColumnKey("");
      return;
    }
    setSelectedSheet((current) => {
      if (current && sheets.some((sheet) => sheet.importId === current.importId && sheet.sheetName === current.sheetName)) {
        return current;
      }
      const first = sheets[0]!;
      return { importId: first.importId, sheetName: first.sheetName };
    });
  }, [sheets]);

  useEffect(() => {
    setSheetNameDraft(selectedSheet?.sheetName ?? "");
  }, [selectedSheet]);

  useEffect(() => {
    if (!projectId || !selectedSheet?.importId.trim() || !selectedSheet.sheetName.trim()) {
      setColumns([]);
      setSelectedColumnKey("");
      return;
    }

    const ac = new AbortController();
    void (async () => {
      setLoadingColumns(true);
      try {
        const qs = new URLSearchParams({
          projectId,
          importId: selectedSheet.importId.trim(),
          sheetName: selectedSheet.sheetName.trim(),
          sheetColumns: "1",
          schemaAssetType: "other",
          page: "1",
          limit: "1",
        });
        const response = await fetch(`/api/assets?${qs.toString()}`, {
          credentials: "include",
          signal: ac.signal,
        });
        const text = await response.text();
        if (!response.ok) {
          setColumns([]);
          setSelectedColumnKey("");
          return;
        }
        const data = JSON.parse(text) as { columns?: AssetFolderImportColumn[] };
        const nextColumns = Array.isArray(data.columns) ? data.columns : [];
        setColumns(nextColumns);
        setSelectedColumnKey((current) =>
          nextColumns.some((column) => column.key === current) ? current : (nextColumns[0]?.key ?? ""),
        );
      } catch {
        if (!ac.signal.aborted) {
          setColumns([]);
          setSelectedColumnKey("");
        }
      } finally {
        if (!ac.signal.aborted) setLoadingColumns(false);
      }
    })();

    return () => ac.abort();
  }, [projectId, selectedSheet]);

  const handleExcelFile = useCallback(
    async (file: File) => {
      if (!projectId) return;
      setUploading(true);
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
        const text = await response.text();
        if (!response.ok) {
          throw new Error(parseMvAssetApiErrorMessage(text, "تعذر استيراد ملف اكسيل."));
        }

        const imported = normalizeImportResult(JSON.parse(text) as AssetImportResult);
        const merged = mergeImportResults(importResult, imported);
        setNextImportResult(merged);
        toast({ description: "تم تجهيز ملف اكسيل. اختر الشيت والعمود لتوليد مجلدات الصور." });
      } catch (error) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "تعذر استيراد ملف اكسيل.",
        });
      } finally {
        setUploading(false);
        if (excelInputRef.current) excelInputRef.current.value = "";
      }
    },
    [importResult, projectId, setNextImportResult, toast],
  );

  const generateFolders = useCallback(async () => {
    if (!projectId || !selectedSheet || !selectedColumnKey.trim()) {
      toast({ variant: "destructive", description: "أنشئ من ملف اكسيل ثم اختر الشيت والعمود." });
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch(
        `/api/mv/projects/${encodeURIComponent(projectId)}/asset-import-image-folders`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            columnKey: selectedColumnKey.trim(),
            importId: selectedSheet.importId.trim(),
            sheetName: selectedSheet.sheetName.trim(),
          }),
        },
      );
      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(parseMvAssetApiErrorMessage(responseText, "تعذر إنشاء مجلدات صور الأصول."));
      }

      const payload = JSON.parse(responseText) as {
        createdCount: number;
        existingCount: number;
        totalValues: number;
        parentFolderName: string;
      };
      toast({
        description: `تم ضبط ${new Intl.NumberFormat("ar-SA").format(payload.totalValues)} مجلداً تحت «${payload.parentFolderName}».`,
      });
      await onGenerated?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "تعذر إنشاء مجلدات صور الأصول.",
      });
    } finally {
      setGenerating(false);
    }
  }, [onGenerated, onOpenChange, projectId, selectedColumnKey, selectedSheet, toast]);

  const renameSelectedSheet = useCallback(async () => {
    if (!projectId || !selectedSheet || !importResult) return;
    const oldName = selectedSheet.sheetName.trim();
    const newName = sheetNameDraft.trim();
    if (!oldName || !newName || oldName === newName) {
      setSheetNameDraft(oldName);
      return;
    }

    setRenamingSheet(true);
    try {
      const response = await fetch("/api/assets/rename-sheet", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          importId: selectedSheet.importId,
          oldSheetName: oldName,
          newSheetName: newName,
        }),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(parseMvAssetApiErrorMessage(text, "تعذر حفظ اسم الشيت."));
      }

      const next: AssetImportResult = {
        ...importResult,
        summary: {
          ...importResult.summary,
          sheets: importResult.summary.sheets.map((sheet) =>
            sheet.importId === selectedSheet.importId && sheet.sheetName === oldName
              ? { ...sheet, sheetName: newName }
              : sheet,
          ),
        },
      };
      setNextImportResult(next);
      setSelectedSheet({ ...selectedSheet, sheetName: newName });
      setSheetNameDraft(newName);
      toast({ description: "تم تحديث اسم الشيت." });
    } catch (error) {
      setSheetNameDraft(oldName);
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "تعذر حفظ اسم الشيت.",
      });
    } finally {
      setRenamingSheet(false);
    }
  }, [importResult, projectId, selectedSheet, setNextImportResult, sheetNameDraft, toast]);

  const selectedSheetValue = selectedSheet ? `${selectedSheet.importId}::${selectedSheet.sheetName}` : "";
  const numberFormatter = new Intl.NumberFormat("ar-SA");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden border-slate-200 p-0 shadow-2xl sm:max-w-3xl" dir="rtl">
        <DialogHeader className="border-b border-slate-100 bg-white px-5 py-4 text-right">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <FolderPlus className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-[15px] font-black text-slate-950">انشاء مجلدات الاصول</DialogTitle>
              <DialogDescription className="mt-1 text-[12px] leading-5 text-slate-500">
                أنشئ من ملف اكسيل وحدد الشيت والعمود لإنشاء مجلدات صور الأصول في نفس الصفحة.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[calc(90vh-10.5rem)] space-y-4 overflow-y-auto px-5 py-4">
          <input
            ref={excelInputRef}
            type="file"
            className="hidden"
            accept={ACCEPTED_ASSET_IMPORT_FILES}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleExcelFile(file);
            }}
          />

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-stretch">
            <button
              type="button"
              onClick={() => excelInputRef.current?.click()}
              disabled={!projectId || uploading}
              className="flex min-h-[104px] w-full items-center gap-3 rounded-lg border border-dashed border-sky-200 bg-sky-50/40 px-4 py-3 text-right transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-sky-700 shadow-sm">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-black text-slate-950">انشاء من ملف اكسيل</span>
                <span className="mt-1 block text-[11px] leading-5 text-slate-500">
                  بعد الرفع ستظهر الشيتات تلقائياً، وسيتم اختيار أول شيت افتراضياً.
                </span>
              </span>
            </button>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                <p className="text-[12px] font-black text-slate-800">ملخص اكسيل</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-[10px] font-bold text-slate-500">الشيتات</p>
                  <p className="mt-1 text-lg font-black tabular-nums text-slate-950">
                    {loadingSummary ? "..." : numberFormatter.format(sheets.length)}
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <p className="text-[10px] font-bold text-slate-500">الصفوف</p>
                  <p className="mt-1 text-lg font-black tabular-nums text-slate-950">
                    {numberFormatter.format(importResult?.summary.totalRows ?? 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500">الشيت</span>
              <Select
                value={selectedSheetValue}
                onValueChange={(value) => {
                  const splitAt = value.indexOf("::");
                  if (splitAt < 0) return;
                  setSelectedSheet({
                    importId: value.slice(0, splitAt),
                    sheetName: value.slice(splitAt + 2),
                  });
                }}
                disabled={sheets.length === 0 || uploading || loadingSummary}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white text-[12px] font-semibold">
                  <SelectValue placeholder="اختر الشيت" />
                </SelectTrigger>
                <SelectContent className="text-right" dir="rtl">
                  {sheets.map((sheet) => (
                    <SelectItem
                      key={`${sheet.importId}:${sheet.sheetName}`}
                      value={`${sheet.importId}::${sheet.sheetName}`}
                      className="text-[12px]"
                    >
                      <span dir="auto">{sheet.sheetName}</span>
                      <span className="me-1 text-[10px] opacity-70">
                        ({numberFormatter.format(sheet.rowCount)})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={sheetNameDraft}
                onChange={(event) => setSheetNameDraft(event.target.value)}
                onBlur={() => void renameSelectedSheet()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
                disabled={!selectedSheet || uploading || loadingSummary || renamingSheet}
                className="h-10 rounded-lg border-slate-200 bg-white text-[12px] font-semibold"
                placeholder="تعديل اسم الشيت"
                dir="auto"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-500">اختر اسماء المجلدات حسب العمود</span>
              <Select
                value={selectedColumnKey}
                onValueChange={setSelectedColumnKey}
                disabled={columns.length === 0 || loadingColumns}
              >
                <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white text-[12px] font-semibold">
                  <SelectValue placeholder={loadingColumns ? "جاري تحميل الأعمدة..." : "اختر العمود"} />
                </SelectTrigger>
                <SelectContent className="text-right" dir="rtl">
                  {columns.map((column) => (
                    <SelectItem key={column.key} value={column.key} className="text-[12px]">
                      <span dir="auto">{column.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
          {showSkip ? (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-lg border-slate-200 bg-white px-4 text-[12px] font-bold"
              disabled={uploading || generating}
              onClick={() => {
                onSkip?.();
                onOpenChange(false);
              }}
            >
              {skipLabel}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-lg border-slate-200 bg-white px-4 text-[12px] font-bold"
              disabled={uploading || generating}
              onClick={() => onOpenChange(false)}
            >
              إغلاق
            </Button>
          )}
          <Button
            type="button"
            className="h-10 min-w-[160px] gap-2 rounded-lg bg-emerald-700 px-4 text-[12px] font-black text-white hover:bg-emerald-800"
            disabled={!selectedSheet || !selectedColumnKey || uploading || loadingColumns || generating}
            onClick={() => void generateFolders()}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
            انشاء مجلدات الاصول
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
