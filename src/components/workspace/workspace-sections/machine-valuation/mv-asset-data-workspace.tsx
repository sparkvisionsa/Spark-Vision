"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  GripVertical,
  Images,
  Loader2,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import SmartGrid, { type CellChange } from "@/components/smart-grid/SmartGrid";
import DataImportSelector from "./data-import-selector";
import {
  type AssetImportResult,
  type AssetImportSheetStat,
  mergeImportResults,
  normalizeImportResult,
  stripSheetFromImportResult,
  updateSheetStatsInImportResult,
  withSheetImportIds,
} from "./asset-import-panel";
import { readActiveImportSheetRef, writeActiveImportSheetRef } from "./mv-asset-import-active-sheet";
import { MV_PROJECTS_TABLE_PATH } from "./mv-home-routes";
import { useMvInPageNavigation } from "./mv-inpage-navigation";
import { MvTopBar } from "./mv-ui";
import type { MvProject } from "./types";

const ACCEPTED_ASSET_FILES =
  ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/csv,application/zip,application/octet-stream";

/* ------------------------------------------------------------------ */
/*  GridModal — modal with built-in horizontal/vertical scroll handle */
/* ------------------------------------------------------------------ */
interface GridModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

function GridModal({ open, onOpenChange, title, children }: GridModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const cachedEl = useRef<HTMLElement | null>(null);

  const [info, setInfo] = useState({
    found: false,
    hasH: false,
    canL: false,
    canR: false,
    pct: 0,
  });

  const getEl = useCallback((): HTMLElement | null => {
    if (cachedEl.current?.isConnected) return cachedEl.current;
    cachedEl.current =
      (contentRef.current?.querySelector("[data-grid-scroll]") as HTMLElement | null) ??
      (contentRef.current?.querySelector(".sg-scroll") as HTMLElement | null);
    return cachedEl.current;
  }, []);

  const sync = useCallback(() => {
    const el = getEl();
    if (!el) {
      setInfo((p) => (p.found ? { found: false, hasH: false, canL: false, canR: false, pct: 0 } : p));
      return;
    }
    const hOver = el.scrollWidth - el.clientWidth;
    const hAbs = Math.abs(el.scrollLeft);
    const hasH = hOver > 1;
    setInfo((prev) => {
      const next = {
        found: true,
        hasH,
        canL: hasH && hAbs < hOver - 2,
        canR: hasH && hAbs > 2,
        pct: hOver > 0 ? hAbs / hOver : 0,
      };
      if (
        prev.found === next.found &&
        prev.hasH === next.hasH &&
        prev.canL === next.canL &&
        prev.canR === next.canR &&
        Math.abs(prev.pct - next.pct) < 0.005
      )
        return prev;
      return next;
    });
  }, [getEl]);

  useEffect(() => {
    if (!open) {
      cachedEl.current = null;
      return;
    }
    const id = setInterval(sync, 200);
    return () => clearInterval(id);
  }, [open, sync]);

  useEffect(() => {
    if (!open) return;
    const el = getEl();
    if (!el) return;
    const handler = () => sync();
    el.addEventListener("scroll", handler, { passive: true });
    const ro = new ResizeObserver(() => sync());
    ro.observe(el);
    const tbl = el.querySelector("table");
    if (tbl) ro.observe(tbl);
    return () => {
      el.removeEventListener("scroll", handler);
      ro.disconnect();
    };
  }, [open, getEl, sync, info.found]);

  useEffect(() => {
    if (!open) return;
    const container = contentRef.current;
    if (!container) return;
    const observer = new MutationObserver(() => requestAnimationFrame(sync));
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [open, sync]);

  const scrollH = useCallback(
    (dir: "left" | "right") => {
      const el = getEl();
      if (!el) return;
      const step = Math.max(el.clientWidth * 0.5, 250);
      el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
    },
    [getEl],
  );

  const handleTrackDrag = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const el = getEl();
      const track = trackRef.current;
      if (!el || !track) return;
      document.body.style.cursor = "grabbing";

      const trackRect = track.getBoundingClientRect();
      const maxScroll = el.scrollWidth - el.clientWidth;

      const move = (me: MouseEvent) => {
        const x = me.clientX - trackRect.left;
        const pct = Math.max(0, Math.min(1, 1 - x / trackRect.width));
        el.scrollLeft = -(pct * maxScroll);
        sync();
      };
      const up = () => {
        document.body.style.cursor = "";
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      };
      move(e.nativeEvent);
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    },
    [getEl, sync],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[92vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-0 [&>button:last-child]:!left-3 [&>button:last-child]:!top-2 [&>button:last-child]:!right-auto [&>button:last-child]:!z-[60] [&>button:last-child]:rounded-lg [&>button:last-child]:bg-slate-100 [&>button:last-child]:p-1.5"
        dir="rtl"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>

        {/* ① SmartGrid toolbar (اسم + إحصائيات + إجراءات) ← ② سكرول أفقي ← ③ الجدول */}
        <div ref={contentRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
          {children}
        </div>

        {/* شريط التمرير الأفقي — أسفل المودال */}
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 border-t px-3 py-1 transition-colors",
            info.hasH ? "border-sky-100 bg-sky-50/50" : "border-slate-100 bg-slate-50/30",
          )}
        >
          <button
            type="button"
            disabled={!info.canR}
            onClick={() => scrollH("right")}
            className={cn(
              "rounded-md p-1 transition",
              info.hasH ? "text-slate-500 hover:bg-white hover:text-slate-700 disabled:opacity-30" : "text-slate-300 disabled:opacity-20",
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div
            ref={trackRef}
            className={cn(
              "relative h-3 flex-1 rounded-full transition-colors",
              info.hasH ? "cursor-pointer bg-slate-200/70" : "bg-slate-100/60",
            )}
            onMouseDown={info.hasH ? handleTrackDrag : undefined}
          >
            {info.hasH ? (
              <>
                <div
                  className="absolute top-0 h-full rounded-full bg-sky-400/60 transition-all duration-100"
                  style={{ right: `${info.pct * 100}%`, width: "20%", transform: "translateX(50%)" }}
                />
                <div
                  className="absolute top-1/2 flex h-5 w-7 -translate-y-1/2 cursor-grab items-center justify-center rounded-md border border-sky-300 bg-white shadow-sm active:cursor-grabbing"
                  style={{ right: `calc(${info.pct * 100}% - 14px)` }}
                >
                  <GripVertical className="h-3 w-3 text-sky-400" />
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center gap-1.5 select-none">
                <GripVertical className="h-3 w-3 text-slate-300" />
                <span className="text-[9px] text-slate-300">⟷ تمرير أفقي</span>
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={!info.canL}
            onClick={() => scrollH("left")}
            className={cn(
              "rounded-md p-1 transition",
              info.hasH ? "text-slate-500 hover:bg-white hover:text-slate-700 disabled:opacity-30" : "text-slate-300 disabled:opacity-20",
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MvAssetDataWorkspaceProps {
  projectId: string;
}

export default function MvAssetDataWorkspace({ projectId }: MvAssetDataWorkspaceProps) {
  const { navigate } = useMvInPageNavigation();
  const { toast } = useToast();
  const storageKey = `sv:asset-import:${projectId}`;
  const persistentStorageKey = `sv:asset-import:persistent:${projectId}`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [project, setProject] = useState<MvProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [importResult, setImportResult] = useState<AssetImportResult | null>(null);
  const [importHydrated, setImportHydrated] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [viewingSheet, setViewingSheet] = useState<AssetImportSheetStat | null>(null);
  const [manualGridOpen, setManualGridOpen] = useState(false);
  const [manualImportId, setManualImportId] = useState<string | null>(null);
  const [manualSheetName, setManualSheetName] = useState<string | null>(null);
  const [isCreatingManual, setIsCreatingManual] = useState(false);
  const [deletingSheet, setDeletingSheet] = useState<string | null>(null);
  const [sheetDisplayName, setSheetDisplayName] = useState<string | null>(null);
  const originalSheetNameRef = useRef<string | null>(null);
  const importTouchedRef = useRef(false);

  const handleSheetDimensionsChange = useCallback(
    (payload: {
      sheetName: string;
      importId?: string;
      rowCount: number;
      columnCount: number;
    }) => {
      importTouchedRef.current = true;
      setImportResult((prev) => {
        if (!prev) return prev;
        return updateSheetStatsInImportResult(
          prev,
          payload.sheetName,
          {
            rowCount: payload.rowCount,
            columnCount: payload.columnCount,
          },
          payload.importId,
        );
      });
      setViewingSheet((vs) =>
        vs &&
        vs.sheetName === payload.sheetName &&
        (!payload.importId || vs.importId === payload.importId)
          ? {
              ...vs,
              rowCount: payload.rowCount,
              columnCount: payload.columnCount,
            }
          : vs,
      );
    },
    [],
  );

  const loadProject = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/mv/projects/${projectId}`, { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as { project: MvProject };
        setProject(data.project);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const syncStoredActiveSheetRef = useCallback(
    (normalized: AssetImportResult) => {
      const stored = readActiveImportSheetRef(projectId);
      if (stored?.sheetName) {
        const sid =
          stored.importId?.trim() ||
          normalized.summary.sheets.find((s) => s.sheetName === stored.sheetName.trim())?.importId;
        if (
          sid &&
          normalized.summary.sheets.some(
            (s) => s.importId === sid && s.sheetName === stored.sheetName.trim(),
          )
        ) {
          writeActiveImportSheetRef(projectId, { importId: sid, sheetName: stored.sheetName.trim() });
        }
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      setImportHydrated(true);
      return;
    }

    let cancelled = false;

    const readStoredImport = (raw: string | null) => {
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw) as AssetImportResult;
        if (parsed.projectId !== projectId) return null;
        const normalized = normalizeImportResult(parsed);
        return normalized.summary.sheets.length > 0 ? normalized : null;
      } catch {
        return null;
      }
    };

    const readSessionImport = () => readStoredImport(window.sessionStorage.getItem(storageKey));
    const readPersistentImport = () => readStoredImport(window.localStorage.getItem(persistentStorageKey));

    const loadPersistedImport = async () => {
      const sessionImport = readSessionImport();
      const persistentImport = readPersistentImport();
      const localSnapshot = sessionImport ?? persistentImport;
      if (localSnapshot && !cancelled) {
        setImportResult(localSnapshot);
        syncStoredActiveSheetRef(localSnapshot);
      }

      try {
        const response = await fetch(`/api/assets/imports?projectId=${encodeURIComponent(projectId)}`, {
          credentials: "include",
        });
        if (!response.ok) return;
        const persisted = normalizeImportResult((await response.json()) as AssetImportResult);
        if (persisted.projectId !== projectId || cancelled || importTouchedRef.current) return;
        const next = persisted.summary.sheets.length > 0 ? persisted : null;
        if (next) {
          setImportResult(next);
          syncStoredActiveSheetRef(next);
        } else if (!localSnapshot) {
          setImportResult(null);
          writeActiveImportSheetRef(projectId, null);
        }
      } catch {
        // Keep the latest local snapshot if loading from server fails.
      } finally {
        if (!cancelled) setImportHydrated(true);
      }
    };

    void loadPersistedImport();

    return () => {
      cancelled = true;
    };
  }, [persistentStorageKey, projectId, storageKey, syncStoredActiveSheetRef]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!importHydrated) return;
    if (importResult) {
      window.sessionStorage.setItem(storageKey, JSON.stringify(importResult));
      window.localStorage.setItem(persistentStorageKey, JSON.stringify(importResult));
    } else {
      window.sessionStorage.removeItem(storageKey);
      window.localStorage.removeItem(persistentStorageKey);
    }
  }, [importHydrated, importResult, persistentStorageKey, storageKey]);

  const handleFile = async (file: File) => {
    setUploadError("");
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
      const text = await response.text();
      if (!response.ok) {
        let msg = "تعذّر استيراد ملف الأصول.";
        try {
          const j = JSON.parse(text) as { message?: string | string[] };
          if (j?.message) msg = Array.isArray(j.message) ? j.message.join(" ") : String(j.message);
        } catch {
          if (text.length < 400) msg = text;
        }
        throw new Error(msg);
      }
      const result = normalizeImportResult(JSON.parse(text) as AssetImportResult);
      importTouchedRef.current = true;
      setImportResult((prev) => mergeImportResults(prev, result));
      setRefreshToken((c) => c + 1);
      toast({ description: "تم استيراد الأصول." });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "تعذّر استيراد ملف الأصول.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateManualSheet = async () => {
    setUploadError("");
    setIsCreatingManual(true);
    try {
      const headers = Array.from({ length: 10 }, (_, i) => `عمود${i + 1}`).join(",");
      const placeholderRow = new Array(10).fill("-").join(",");
      const bom = "\uFEFF";
      const blob = new Blob([bom + [headers, placeholderRow].join("\n")], {
        type: "text/csv;charset=utf-8",
      });
      const file = new File([blob], "إدخال يدوي.csv", { type: "text/csv" });

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
        let msg = "تعذّر إنشاء الجدول.";
        try {
          const j = JSON.parse(text) as { message?: string | string[] };
          if (j?.message) msg = Array.isArray(j.message) ? j.message.join(" ") : String(j.message);
        } catch {
          if (text.length < 400) msg = text;
        }
        throw new Error(msg);
      }
      const result = normalizeImportResult(JSON.parse(text) as AssetImportResult);

      const sheetName = result.summary.sheets[0]?.sheetName ?? null;

      const addRowBody = JSON.stringify({
        projectId,
        importId: result.importId,
        ...(sheetName ? { sheetName } : {}),
      });
      await Promise.all(
        Array.from({ length: 9 }, () =>
          fetch("/api/assets/rows", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: addRowBody,
          }),
        ),
      );

      importTouchedRef.current = true;
      setImportResult((prev) => mergeImportResults(prev, result));
      setManualImportId(result.importId);
      setManualSheetName(sheetName);
      setManualGridOpen(true);
      setRefreshToken((c) => c + 1);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "تعذّر إنشاء الجدول.");
    } finally {
      setIsCreatingManual(false);
    }
  };

  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const handleDeleteAll = async () => {
    if (!importResult) return;
    if (!window.confirm("حذف جميع الشيتات والبيانات المرتبطة بها؟ لا يمكن التراجع.")) return;
    setIsDeletingAll(true);
    setUploadError("");
    try {
      const sheetsToDelete = withSheetImportIds(importResult).summary.sheets;
      for (const s of sheetsToDelete) {
        const qs = new URLSearchParams({
          projectId,
          importId: s.importId,
          sheetName: s.sheetName,
        });
        const res = await fetch(`/api/assets/import-sheet?${qs.toString()}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) {
          const text = await res.text();
          let msg = `تعذّر حذف ورقة «${s.sheetName}».`;
          try {
            const j = JSON.parse(text) as { message?: string | string[] };
            if (j.message) msg = Array.isArray(j.message) ? j.message.join(" ") : j.message;
          } catch { /* ignore */ }
          throw new Error(msg);
        }
      }
      importTouchedRef.current = true;
      setImportResult(null);
      writeActiveImportSheetRef(projectId, null);
      setViewingSheet(null);
      setRefreshToken((c) => c + 1);
      toast({ description: "تم حذف جميع الشيتات." });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "تعذّر حذف الشيتات.");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleDeleteSheet = async (sheet: AssetImportSheetStat) => {
    if (!importResult) return;
    const norm = withSheetImportIds(importResult);
    const sid = sheet.importId ?? norm.importId;
    if (!window.confirm(`حذف ورقة «${sheet.sheetName}»؟ لا يمكن التراجع.`)) return;
    setDeletingSheet(`${sid}:${sheet.sheetName}`);
    setUploadError("");
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
      const next = stripSheetFromImportResult(importResult, sheet.sheetName, sid);
      importTouchedRef.current = true;
      setImportResult(next);
      if (!next) writeActiveImportSheetRef(projectId, null);
      if (
        viewingSheet?.sheetName === sheet.sheetName &&
        (viewingSheet.importId ?? "") === sid
      ) {
        setViewingSheet(null);
      }
      setRefreshToken((c) => c + 1);
      toast({ description: `تم حذف ورقة «${sheet.sheetName}».` });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "تعذّر حذف الورقة.");
    } finally {
      setDeletingSheet(null);
    }
  };

  const sheets = importResult?.summary.sheets ?? [];

  if (loading) {
    return (
      <div className="min-h-screen" dir="rtl">
        <MvTopBar breadcrumbs={[{ label: "..." }]} saveState="idle" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background-primary)]" dir="rtl">
      <MvTopBar
        breadcrumbs={[{ label: project?.name ?? projectId }, { label: "إضافة بيانات الأصول" }]}
        saveState="idle"
      />

      <div
        className="border-b border-slate-200/90 bg-slate-50/95"
        style={{ borderColor: "var(--color-border-tertiary)" }}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-start gap-2 px-3 py-2.5 md:px-5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-slate-200 bg-white text-[11px] text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => navigate(MV_PROJECTS_TABLE_PATH)}
          >
            العودة لجدول المشاريع
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5 border-0 bg-[#0C447C] text-[11px] text-white shadow-sm hover:bg-[#0a3a66]"
            onClick={() => navigate(`/machine-valuation/${projectId}/workflow/asset-images`)}
          >
            <Images className="h-3.5 w-3.5" />
            التالي: تحديد صور الأصول
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={ACCEPTED_ASSET_FILES}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.currentTarget.value = "";
        }}
      />

      <div className="mx-auto max-w-7xl space-y-2 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <DataImportSelector
              onSelectImport={() => inputRef.current?.click()}
              onSelectCreate={() => void handleCreateManualSheet()}
              labels={{
                label: "إضافة بيانات الأصول",
                importFile: "استيراد بيانات",
                createSheet: "إضافة بيانات يدويا",
              }}
            />
            {isUploading || isCreatingManual ? (
              <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {isCreatingManual ? "جارٍ إنشاء الجدول…" : "جارٍ الاستيراد…"}
              </span>
            ) : null}
          </div>

          {importResult ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isDeletingAll}
              onClick={() => void handleDeleteAll()}
              className="h-7 gap-1 text-[10px] text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              {isDeletingAll ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Trash2 className="h-3 w-3" />
              )}
              حذف الكل
            </Button>
          ) : null}
        </div>

        {uploadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
            {uploadError}
          </div>
        ) : null}

        {sheets.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sheets.map((s) => {
              const sid = s.importId ?? importResult?.importId ?? "";
              const busy = deletingSheet === `${sid}:${s.sheetName}`;
              return (
                <button
                  key={`${sid}:${s.sheetName}`}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    originalSheetNameRef.current = s.sheetName;
                    writeActiveImportSheetRef(projectId, { importId: sid, sheetName: s.sheetName });
                    setViewingSheet(s);
                  }}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg border bg-white p-2.5 text-right shadow-sm transition",
                    "hover:border-sky-300 hover:shadow-md",
                    busy && "pointer-events-none opacity-50",
                  )}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700 transition group-hover:bg-sky-100">
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-slate-900">
                      {s.sheetName}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {s.rowCount} صف · {s.columnCount} عمود
                    </p>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    className="rounded p-1 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteSheet(s);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.stopPropagation();
                        void handleDeleteSheet(s);
                      }
                    }}
                  >
                    {busy ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ) : !importResult ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-white/60 text-center">
            <FileSpreadsheet className="mb-2 h-7 w-7 text-slate-300" />
            <p className="text-[11px] text-slate-500">
              اضغط على "إضافة بيانات الأصول" لاستيراد ملف أو إدخال بيانات يدوياً
            </p>
          </div>
        ) : (
          <p className="py-4 text-center text-[11px] text-slate-400">
            لا توجد أوراق ببيانات في هذا الاستيراد.
          </p>
        )}
      </div>

      <GridModal
        open={Boolean(viewingSheet) || manualGridOpen}
        onOpenChange={(open) => {
          if (!open) {
            setViewingSheet(null);
            setManualGridOpen(false);
            setSheetDisplayName(null);
            originalSheetNameRef.current = null;
          }
        }}
        title={sheetDisplayName ?? viewingSheet?.sheetName ?? manualSheetName ?? "إدخال يدوي"}
      >
        <SmartGrid
          projectId={projectId}
          importId={
            viewingSheet && importResult
              ? viewingSheet.importId ?? importResult.importId
              : manualImportId ?? ""
          }
          importSheetName={originalSheetNameRef.current ?? manualSheetName ?? undefined}
          assetType="other"
          omitAssetTypeFilter
          schemaAssetType="other"
          editOnSingleClick
          sheetColumns
          rowCheckboxColumn
          allowAppendImportRows
          quickAddMode={manualGridOpen}
          displaySheetName={sheetDisplayName ?? viewingSheet?.sheetName ?? manualSheetName ?? "إدخال يدوي"}
          onSheetNameChange={(newName) => {
            const oldName = originalSheetNameRef.current ?? viewingSheet?.sheetName ?? manualSheetName ?? "";
            const impId =
              viewingSheet && importResult
                ? viewingSheet.importId ?? importResult.importId
                : manualImportId ?? "";

            if (!oldName || !impId || oldName === newName) {
              setSheetDisplayName(newName);
              return;
            }

            setSheetDisplayName(newName);

            void (async () => {
              try {
                const res = await fetch("/api/assets/rename-sheet", {
                  method: "PATCH",
                  credentials: "include",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ projectId, importId: impId, oldSheetName: oldName, newSheetName: newName }),
                });
                if (!res.ok) {
                  const body = await res.text().catch(() => "");
                  let msg = "تعذّر حفظ اسم الورقة.";
                  try { const j = JSON.parse(body); if (j?.message) msg = Array.isArray(j.message) ? j.message.join(" ") : j.message; } catch {}
                  toast({ variant: "destructive", description: msg });
                  setSheetDisplayName(oldName);
                  return;
                }

                originalSheetNameRef.current = newName;
                if (viewingSheet) {
                  setViewingSheet((prev) => prev ? { ...prev, sheetName: newName } : prev);
                }
                importTouchedRef.current = true;
                setImportResult((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    summary: {
                      ...prev.summary,
                      sheets: prev.summary.sheets.map((s) =>
                        s.sheetName === oldName && s.importId === impId
                          ? { ...s, sheetName: newName }
                          : s,
                      ),
                    },
                  };
                });
                toast({ description: "تم تحديث اسم الورقة." });
              } catch {
                toast({ variant: "destructive", description: "تعذّر حفظ اسم الورقة." });
                setSheetDisplayName(oldName);
              }
            })();
          }}
          onSave={(_changes: CellChange[]) => {}}
          onSheetDimensionsChange={handleSheetDimensionsChange}
          refreshToken={refreshToken}
        />
      </GridModal>
    </div>
  );
}
