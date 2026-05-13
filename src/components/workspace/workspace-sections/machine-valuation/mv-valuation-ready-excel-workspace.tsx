"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Images,
  Loader2,
  Plus,
  Table2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import SmartGrid from "@/components/smart-grid/SmartGrid";
import {
  mergeImportResults,
  normalizeImportResult,
  type ActiveImportSheetRef,
  type AssetImportResult,
  type AssetImportSheetStat,
} from "./asset-import-panel";
import { cn } from "@/lib/utils";
import { MvProjectReportHeader } from "./mv-simple-report-navigation";
import { MvWorkflowPageFrame, MvWorkflowPageScrollBody } from "./mv-workflow-page-frame";
import { useMvInPageNavigation } from "./mv-inpage-navigation";
import { uploadProjectFileAndReturnId } from "./mv-project-gridfs-upload";
import {
  buildReadyExcelWorkspaceForSave,
  mergeValuationReadyExcelWorkspaces,
  readReadyExcelWorkspaceFromSession,
  readyExcelAccountImageSrc,
  valuationReadyExcelWorkspaceForApi,
  writeReadyExcelSessionCache,
  type MvReadyExcelAccountImage,
} from "./mv-valuation-ready-excel-persist";
import type { MvProject } from "./types";
import {
  readReportSlice,
  writeReportSlice,
  type MvValuationReportSlice,
} from "./mv-valuation-report-slice";

function downloadAccountImageFile(projectId: string, img: MvReadyExcelAccountImage) {
  if (typeof document === "undefined") return;
  const href = img.dataUrl || readyExcelAccountImageSrc(projectId, img);
  if (!href) return;
  const a = document.createElement("a");
  a.href = href;
  a.download = `mv-account-${img.id}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function pushAccountPick(prev: number[], n: number): number[] {
  if (prev.length < 2) return [...prev, n];
  return [prev[1]!, n];
}

/** اقتطاع مرتبط بإحداثيات خلايا (data-sg-drow / data-sg-dcol) بعد رسم html2canvas للجدول */
async function captureTableRegionDataUrl(
  table: HTMLTableElement,
  bounds: { cmin: number; cmax: number; rmin: number; rmax: number },
  options?: { includeHeader?: boolean },
): Promise<string> {
  const { cmin, cmax, rmin, rmax } = bounds;
  const includeHeader = options?.includeHeader === true;
  const cell = (r: number, c: number) =>
    table.querySelector(`td[data-sg-drow="${r}"][data-sg-dcol="${c}"]`) as HTMLElement | null;
  const headerDataCell = (c: number) =>
    table.querySelector(`th[data-sg-hcol="${c}"]`) as HTMLElement | null;
  const corners: [number, number][] = [
    [rmin, cmin],
    [rmin, cmax],
    [rmax, cmin],
    [rmax, cmax],
  ];
  for (const [r, c] of corners) {
    if (!cell(r, c)) {
      throw new Error(
        `تعذّر إيجاد الخلية (صف ${r}، عمود ${c}). تأكد أن الصفين والعمودين ضمن البيانات الظاهرة (بدون فلترة تخفيهما) وأن الورقة محمّلة كاملة.`,
      );
    }
  }
  if (includeHeader) {
    if (!headerDataCell(cmin) || !headerDataCell(cmax)) {
      throw new Error(
        "تعذّر إيجاد ترويسة الأعمدة للنطاق — أعد فتح الجدول أو اختر «بدون ترويسة».",
      );
    }
  }
  const tableRect = table.getBoundingClientRect();
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const expand = (b: DOMRect) => {
    left = Math.min(left, b.left);
    top = Math.min(top, b.top);
    right = Math.max(right, b.right);
    bottom = Math.max(bottom, b.bottom);
  };
  for (const [r, c] of corners) {
    expand(cell(r, c)!.getBoundingClientRect());
  }
  if (includeHeader) {
    expand(headerDataCell(cmin)!.getBoundingClientRect());
    expand(headerDataCell(cmax)!.getBoundingClientRect());
  }
  const x = left - tableRect.left;
  const y = top - tableRect.top;
  const w = right - left;
  const h = bottom - top;
  if (w < 1 || h < 1) {
    throw new Error("نطاق الاقتطاع غير صالح.");
  }
  // هامش أمان صغير لتجنب قطع آخر عمود/صف بسبب تقريبات sub-pixel
  // (يظهر غالبًا بعد تغييرات عرض الأعمدة/ارتفاع الصفوف أو تحسينات العرض).
  const padCssPx = 4;
  const paddedX = x - padCssPx;
  const paddedY = y - padCssPx;
  const paddedW = w + padCssPx * 2;
  const paddedH = h + padCssPx * 2;
  table.scrollIntoView({ block: "nearest", inline: "nearest" });
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const { default: html2canvas } = await import("html2canvas");
  const canvas = await html2canvas(table, {
    scale: dpr,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    ignoreElements: (element) =>
      element instanceof Element && Boolean(element.closest("[data-sg-exclude-from-capture]")),
  });
  // استخدم floor/ceil لتضمين كامل النطاق بدل قطع الحافة بسبب Math.round
  const sx = Math.max(0, Math.floor(paddedX * dpr));
  const sy = Math.max(0, Math.floor(paddedY * dpr));
  const sw = Math.min(canvas.width - sx, Math.ceil(paddedW * dpr));
  const sh = Math.min(canvas.height - sy, Math.ceil(paddedH * dpr));
  if (sw < 1 || sh < 1) {
    throw new Error("فشل حساب مربع الاقتطاع في الصورة.");
  }
  const out = document.createElement("canvas");
  out.width = sw;
  out.height = sh;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("تعذّر إنشاء سياق الرسم.");
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  return out.toDataURL("image/png");
}

interface MvValuationReadyExcelWorkspaceProps {
  projectId: string;
  projectName: string | null;
}

export default function MvValuationReadyExcelWorkspace({
  projectId,
  projectName,
}: MvValuationReadyExcelWorkspaceProps) {
  const { navigate } = useMvInPageNavigation();
  const { toast } = useToast();
  const [importResult, setImportResult] = useState<AssetImportResult | null>(null);
  const [gridOpen, setGridOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [gridRefresh, setGridRefresh] = useState(0);
  const [activeSheet, setActiveSheet] = useState<ActiveImportSheetRef | null>(null);
  const [accountColPicks, setAccountColPicks] = useState<number[]>([]);
  const [accountRowPicks, setAccountRowPicks] = useState<number[]>([]);
  const [accountImages, setAccountImages] = useState<MvReadyExcelAccountImage[]>([]);
  const [accountImagesModalOpen, setAccountImagesModalOpen] = useState(false);
  const [accountCaptureBusy, setAccountCaptureBusy] = useState(false);
  const [accountCaptureIncludeHeader, setAccountCaptureIncludeHeader] = useState(true);
  const [accountImagePreview, setAccountImagePreview] = useState<MvReadyExcelAccountImage | null>(null);
  /** نسبة من عرض/ارتفاع النافذة لعرض «ملائم للشاشة» — الصورة تُقيَّد دون تمدد يَهْبِش التفاصيل */
  const [previewMaxWvw, setPreviewMaxWvw] = useState(92);
  const [previewMaxHvh, setPreviewMaxHvh] = useState(88);
  /** عند true: عرض البكسلات كما هي مع تمرير (أوضح للنص والجداول) */
  const [previewPixelPerfect, setPreviewPixelPerfect] = useState(false);
  const [previewNatural, setPreviewNatural] = useState<{ w: number; h: number } | null>(null);
  const resetPreviewSettings = useCallback(() => {
    setPreviewPixelPerfect(false);
    setPreviewMaxWvw(92);
    setPreviewMaxHvh(88);
  }, []);

  const [, setSlice] = useState<MvValuationReportSlice>(() => ({
    colStart: 1,
    colEnd: 20,
    rowStart: 1,
    rowEnd: 500,
    imageColStart: undefined,
    imageColEnd: undefined,
    imageRowStart: undefined,
    imageRowEnd: undefined,
  }));

  const [project, setProject] = useState<MvProject | null>(null);
  const readyExcelHydratedRef = useRef(false);

  const loadProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { project?: MvProject };
      setProject(data.project ?? null);
    } catch {
      setProject(null);
    }
  }, [projectId]);

  const serverReadyKey = useMemo(
    () => JSON.stringify(project?.valuationReadyExcelWorkspace ?? null),
    [project?.valuationReadyExcelWorkspace],
  );

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = readReportSlice(projectId);
    if (stored) setSlice((s) => ({ ...s, ...stored }));
  }, [projectId]);

  useEffect(() => {
    if (!project) return;
    const sessionLocal = readReadyExcelWorkspaceFromSession(projectId, readReportSlice);
    const merged = mergeValuationReadyExcelWorkspaces(project.valuationReadyExcelWorkspace, sessionLocal);
    setImportResult((prev) =>
      JSON.stringify(prev) === JSON.stringify(merged.importResult) ? prev : merged.importResult,
    );
    setAccountImages((prev) =>
      JSON.stringify(prev) === JSON.stringify(merged.accountImages) ? prev : merged.accountImages,
    );
    if (merged.reportSlice) {
      writeReportSlice(projectId, merged.reportSlice);
      setSlice((s) => ({ ...s, ...merged.reportSlice }));
    }
    readyExcelHydratedRef.current = true;
  }, [project, projectId, serverReadyKey]);

  useEffect(() => {
    if (!project || !readyExcelHydratedRef.current) return;
    const t = setTimeout(() => {
      const slice = readReportSlice(projectId);
      const payload = valuationReadyExcelWorkspaceForApi(
        buildReadyExcelWorkspaceForSave(importResult, accountImages, slice),
      );
      void (async () => {
        try {
          const res = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ valuationReadyExcelWorkspace: payload }),
          });
          if (res.ok) {
            const data = (await res.json()) as { project?: MvProject };
            if (data.project) setProject(data.project);
          } else {
            toast({
              variant: "destructive",
              description: "تعذر حفظ بيانات «إكسيل جاهز» على الخادم.",
            });
          }
        } catch {
          toast({
            variant: "destructive",
            description: "تعذر حفظ بيانات «إكسيل جاهز» على الخادم.",
          });
        }
        writeReadyExcelSessionCache(projectId, importResult, accountImages);
      })();
    }, 750);
    return () => clearTimeout(t);
  }, [accountImages, importResult, project, projectId, toast]);

  useEffect(() => {
    if (gridOpen) {
      setAccountColPicks([]);
      setAccountRowPicks([]);
    }
  }, [gridOpen]);

  useEffect(() => {
    setPreviewNatural(null);
  }, [accountImagePreview?.id]);

  const sheets: AssetImportSheetStat[] = importResult?.summary.sheets ?? [];

  const activeImportId = activeSheet?.importId?.trim() ?? "";
  const activeSheetName = activeSheet?.sheetName?.trim() ?? "";

  useEffect(() => {
    if (sheets.length === 0) {
      setActiveSheet(null);
      return;
    }
    const first = sheets[0]!;
    setActiveSheet((prev) => {
      if (prev) {
        const hit = sheets.some(
          (s) => s.importId === prev.importId && s.sheetName === prev.sheetName,
        );
        if (hit) return prev;
      }
      return { importId: first.importId, sheetName: first.sheetName };
    });
  }, [sheets]);

  const handleFiles = useCallback(
    async (list: FileList | File[]) => {
      const files = Array.from(list).filter((f) => f && f.size > 0);
      if (files.length === 0) return;
      setUploading(true);
      try {
        for (const file of files) {
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
            let msg = "تعذّر استيراد الملف.";
            try {
              const j = JSON.parse(text) as { message?: string | string[] };
              if (j?.message) msg = Array.isArray(j.message) ? j.message.join(" ") : String(j.message);
            } catch {
              if (text.length < 300) msg = text;
            }
            throw new Error(msg);
          }
          const result = normalizeImportResult(JSON.parse(text) as AssetImportResult);
          setImportResult((prev) => mergeImportResults(prev, result));
        }
        setGridRefresh((n) => n + 1);
        toast({ description: `تمت معالجة ${files.length} ملف(ات) بنجاح.` });
      } catch (e) {
        toast({
          variant: "destructive",
          description: e instanceof Error ? e.message : "تعذّر رفع الملفات.",
        });
      } finally {
        setUploading(false);
      }
    },
    [projectId, toast],
  );

  const canOpenGrid = activeImportId.length > 0 && activeSheetName.length > 0;

  const openGrid = useCallback(() => {
    if (!canOpenGrid) {
      toast({ variant: "destructive", description: "استورد ملفات ثم اختر ورقة صالحة." });
      return;
    }
    setGridOpen(true);
  }, [canOpenGrid, toast]);

  const accountCropColBounds = useMemo(() => {
    if (accountColPicks.length < 2) return null;
    return { min: Math.min(...accountColPicks), max: Math.max(...accountColPicks) };
  }, [accountColPicks]);

  const accountCropRowBounds = useMemo(() => {
    if (accountRowPicks.length < 2) return null;
    return { min: Math.min(...accountRowPicks), max: Math.max(...accountRowPicks) };
  }, [accountRowPicks]);

  const applyAccountCapture = useCallback(async () => {
    if (!activeSheet) {
      toast({ variant: "destructive", description: "اختر ورقة أولاً." });
      return;
    }
    if (!accountCropColBounds || !accountCropRowBounds) {
      toast({
        variant: "destructive",
        description: "استخدم أيقونة العمود مرتين (حدّان) واضغط رقم الصف مرتين (حدّان) لتحديد المستطيل.",
      });
      return;
    }
    const cmin = accountCropColBounds.min;
    const cmax = accountCropColBounds.max;
    const rmin = accountCropRowBounds.min;
    const rmax = accountCropRowBounds.max;
    const table = document.querySelector(
      "table[data-account-crop-table=\"1\"]",
    ) as HTMLTableElement | null;
    if (!table) {
      toast({ variant: "destructive", description: "تعذّر العثور على الجدول — أعد فتح النافذة." });
      return;
    }
    setAccountCaptureBusy(true);
    try {
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      const dataUrl = await captureTableRegionDataUrl(
        table,
        { cmin, cmax, rmin, rmax },
        { includeHeader: accountCaptureIncludeHeader },
      );
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `acc-${Date.now()}`;
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const file = new File([blob], `ready-excel-crop-${id}.png`, { type: "image/png" });
      const fileId = await uploadProjectFileAndReturnId(projectId, file, {
        valuationAccounting: true,
      });
      const nextImg: MvReadyExcelAccountImage = {
        id,
        fileId,
        createdAt: new Date().toISOString(),
      };
      setAccountImages((prev) => [...prev, nextImg]);
      setSlice((s) => {
        const next: MvValuationReportSlice = {
          ...s,
          importId: activeSheet!.importId,
          sheetName: activeSheet!.sheetName,
          imageColStart: cmin,
          imageColEnd: cmax,
          imageRowStart: rmin,
          imageRowEnd: rmax,
        };
        writeReportSlice(projectId, next);
        return next;
      });
      toast({ description: "تم اقتطاع الصورة وحفظها. يمكنك عرضها من «صور الحسابات»." });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "تعذّر اقتطاع الصورة.",
      });
    } finally {
      setAccountCaptureBusy(false);
    }
  }, [
    accountCropColBounds,
    accountCropRowBounds,
    accountCaptureIncludeHeader,
    activeSheet,
    projectId,
    toast,
  ]);

  const removeAccountImage = useCallback(
    (id: string) => {
      setAccountImages((prev) => prev.filter((x) => x.id !== id));
      toast({ description: "تم حذف الصورة." });
    },
    [toast],
  );

  const title = useMemo(
    () => (projectName && projectName.trim() ? projectName : projectId),
    [projectName, projectId],
  );

  return (
    <MvWorkflowPageFrame className="bg-[var(--color-background-primary)]" dir="rtl">
      <MvProjectReportHeader
        compact
        projectId={projectId}
        project={project}
        activeStep="valuation-actions"
        breadcrumbs={[
          { label: title, href: `/machine-valuation/${projectId}/workflow/report-data` },
          { label: "التقييم", href: `/machine-valuation/${projectId}/workflow/valuation` },
          { label: "إكسيل جاهز" },
        ]}
      />

      <MvWorkflowPageScrollBody>
      <div className="mx-auto min-h-full max-w-4xl space-y-4 px-4 py-5 pb-8">
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/90 px-4 py-10"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void handleFiles(e.dataTransfer.files);
          }}
        >
          {uploading ? (
            <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
          ) : (
            <Upload className="h-10 w-10 text-amber-600" />
          )}
          <p className="text-sm font-medium text-slate-800">أفلت الملفات هنا أو</p>
          <label>
            <input
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              multiple
              onChange={(e) => e.target.files && void handleFiles(e.target.files)}
            />
            <span className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#0C447C] px-4 py-2 text-sm font-medium text-white">
              <Plus className="h-4 w-4" />
              اختر ملفات
            </span>
          </label>
        </div>

        {sheets.length > 0 ? (
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">الأوراق المستوردة</h2>
            <ul className="space-y-1.5 text-[12px] text-slate-600">
              {sheets.map((s) => (
                <li key={`${s.importId}:${s.sheetName}`} className="flex flex-wrap items-center gap-2">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-mono text-[11px] text-slate-500">{s.importId.slice(0, 8)}…</span>
                  <span className="font-medium text-slate-800">{s.sheetName}</span>
                  <span>
                    — {s.rowCount} صف / {s.columnCount} عمود
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="space-y-1">
                <p className="text-[11px] text-slate-500">ورقة للمعاينة</p>
                <Select
                  value={
                    activeSheet
                      ? `${activeSheet.importId}::${activeSheet.sheetName}`
                      : undefined
                  }
                  onValueChange={(v) => {
                    const i = v.indexOf("::");
                    if (i <= 0) return;
                    setActiveSheet({ importId: v.slice(0, i), sheetName: v.slice(i + 2) });
                  }}
                >
                  <SelectTrigger className="w-full min-w-[12rem] bg-white sm:w-80">
                    <SelectValue placeholder="اختر ورقة" />
                  </SelectTrigger>
                  <SelectContent>
                    {sheets.map((s) => (
                      <SelectItem key={`${s.importId}::${s.sheetName}`} value={`${s.importId}::${s.sheetName}`}>
                        {s.sheetName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                onClick={openGrid}
                disabled={!canOpenGrid}
                className="gap-1.5 bg-slate-900 text-white hover:bg-slate-800"
              >
                <Table2 className="h-4 w-4" />
                فتح الجدول الذكي
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-center text-[12px] text-slate-500">لا توجد بيانات بعد — ارفع ملفات Excel أعلاه.</p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/machine-valuation/${projectId}/workflow/valuation`)}
          >
            ← رجوع لاختيار المسار
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/machine-valuation/${projectId}/workflow/report-data`)}
          >
            صفحة المشروع
          </Button>
        </div>
      </div>
      </MvWorkflowPageScrollBody>

      <Dialog open={gridOpen} onOpenChange={setGridOpen}>
        <DialogContent
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            "fixed inset-0 left-0 top-0 z-50 h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0 shadow-2xl",
            "data-[state=open]:!zoom-in-100 data-[state=closed]:!zoom-out-100",
            "[&>button]:hidden",
          )}
          dir="rtl"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:px-4">
            <div className="min-w-0 flex-1 pe-2 text-right">
              <DialogTitle className="text-start text-base leading-snug sm:text-lg">
                الجدول الذكي — اقتطاع صور الحسابات
              </DialogTitle>
            </div>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-12 w-12 shrink-0 rounded-full border-2 border-slate-500 bg-white text-slate-900 shadow-md hover:border-red-600 hover:bg-red-50 hover:text-red-800"
              onClick={() => setGridOpen(false)}
              aria-label="إغلاق"
            >
              <X className="h-7 w-7" strokeWidth={2.5} />
            </Button>
          </div>
          <DialogHeader className="shrink-0 space-y-2 border-b border-slate-200/90 bg-slate-50/80 px-3 py-3 text-right sm:px-4">
            <DialogDescription className="text-[12px] text-slate-600">
              اضغط أيقونة التحديد بجانب ترويسة العمود مرتين (عمود بداية ونهاية)، واضغط رقم الصف مرتين
              (صف بداية ونهاية). ثم اضغط <strong>تطبيق</strong> لحفظ المستطيل كصورة. الترويسة في الجدول
              تُظهر بلون مميّز وخط واضح لتحسين الصورة. الجداول الكبيرة قد تبطئ المعاينة عند التحميل
              كاملةً.
            </DialogDescription>
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-0.5 text-right">
                <p className="text-[12px] font-medium text-slate-800">تضمين ترويسة الأعمدة في الصورة</p>
                <p className="text-[10px] leading-snug text-slate-500">
                  عطّل الخيار لاقتطاع بيانات الصفوف دون صف عناوين الأعمدة.
                </p>
              </div>
              <div className="flex shrink-0 items-center justify-end gap-2 sm:justify-center">
                <span className="text-[11px] text-slate-600">
                  {accountCaptureIncludeHeader ? "مع الترويسة" : "بدون ترويسة"}
                </span>
                <Switch
                  checked={accountCaptureIncludeHeader}
                  onCheckedChange={setAccountCaptureIncludeHeader}
                  dir="ltr"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <p className="min-w-0 flex-1 text-[11px] text-slate-500">
                {accountCropColBounds && accountCropRowBounds ? (
                  <>
                    نطاق الأعمدة: {accountCropColBounds.min}–{accountCropColBounds.max} — الصفوف:{" "}
                    {accountCropRowBounds.min}–{accountCropRowBounds.max}
                  </>
                ) : (
                  "لم يُحدَد المستطيل بالكامل بعد (عمودان + صفان)."
                )}
              </p>
              <Button
                type="button"
                className="gap-1.5 bg-[#0C447C] text-white hover:bg-[#0a3a6a] disabled:opacity-50"
                disabled={!canOpenGrid || accountCaptureBusy}
                onClick={() => void applyAccountCapture()}
              >
                {accountCaptureBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                تطبيق
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-1.5"
                onClick={() => setAccountImagesModalOpen(true)}
              >
                <Images className="h-4 w-4" />
                صور الحسابات
                {accountImages.length > 0 ? (
                  <span className="rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-900">
                    {accountImages.length}
                  </span>
                ) : null}
              </Button>
            </div>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-1 pb-1 pt-0 sm:px-2 sm:pb-2">
            {canOpenGrid ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200/90 bg-slate-100/40">
                <SmartGrid
                  key={`${activeImportId}-${activeSheetName}-${gridRefresh}`}
                  projectId={projectId}
                  importId={activeImportId}
                  importSheetName={activeSheetName}
                  assetType="other"
                  omitAssetTypeFilter
                  schemaAssetType="other"
                  sheetColumns
                  listPageSize={10_000}
                  accountCropMode
                  accountCropFillHeight
                  accountCropColBounds={accountCropColBounds}
                  accountCropRowBounds={accountCropRowBounds}
                  onAccountCropColumnPick={(c) => setAccountColPicks((p) => pushAccountPick(p, c))}
                  onAccountCropRowPick={(r) => setAccountRowPicks((p) => pushAccountPick(p, r))}
                  onSave={() => setGridRefresh((n) => n + 1)}
                  refreshToken={gridRefresh}
                />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={accountImagesModalOpen} onOpenChange={setAccountImagesModalOpen}>
        <DialogContent
          className="flex max-h-[min(90vh,800px)] w-[min(96vw,520px)] max-w-[96vw] flex-col gap-0 overflow-hidden p-0"
          dir="rtl"
        >
          <DialogHeader className="shrink-0 border-b border-slate-200 px-4 py-3 text-right">
            <DialogTitle>صور الحسابات</DialogTitle>
            <DialogDescription className="text-[12px] text-slate-600">
              الصور المقتطَعة من الجدول. تنزيل أو حذف أو معاينة؛ دمجها في PDF يُضاف لاحقاً.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {accountImages.length === 0 ? (
              <p className="text-center text-sm text-slate-500">لا توجد صور محفوظة بعد.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {accountImages.map((img) => (
                  <li
                    key={img.id}
                    className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/80 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-3 py-2">
                      <span className="text-[11px] text-slate-500" dir="ltr">
                        {new Date(img.createdAt).toLocaleString("ar-SA", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                      <div className="flex items-center gap-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-[#0C447C] hover:bg-sky-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadAccountImageFile(projectId, img);
                          }}
                          aria-label="تنزيل الصورة"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => removeAccountImage(img.id)}
                          aria-label="حذف الصورة"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="p-2">
                      <button
                        type="button"
                        className="block w-full rounded-lg ring-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        onClick={() => setAccountImagePreview(img)}
                      >
                        <img
                          src={readyExcelAccountImageSrc(projectId, img)}
                          alt="صورة حساب"
                          loading="lazy"
                          decoding="async"
                          className="max-h-[min(50vh,480px)] w-full object-contain"
                          style={{ imageRendering: "auto" }}
                        />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={accountImagePreview !== null}
        onOpenChange={(open) => {
          if (!open) setAccountImagePreview(null);
        }}
      >
        <DialogContent
          className={cn(
            "z-[100] flex max-h-[96vh] w-[min(96vw,1680px)] max-w-[96vw] flex-col gap-0 overflow-hidden border-slate-600 bg-slate-900 p-0 text-slate-100 shadow-2xl",
            "sm:max-w-[min(96vw,1680px)]",
          )}
          dir="rtl"
        >
          <DialogHeader className="shrink-0 space-y-3 border-b border-slate-700 px-4 py-3 text-right">
            <DialogTitle className="text-base text-white">معاينة الصورة</DialogTitle>
            <div className="flex flex-wrap items-center gap-2">
              {accountImagePreview ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-slate-500 text-slate-100 hover:bg-slate-800"
                  onClick={() => downloadAccountImageFile(projectId, accountImagePreview)}
                >
                  <Download className="ms-1 h-4 w-4" />
                  تنزيل PNG
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-slate-600 text-slate-200 hover:bg-slate-800"
                onClick={resetPreviewSettings}
              >
                إعادة ضبط
              </Button>
              <Button
                type="button"
                size="sm"
                variant={previewPixelPerfect ? "secondary" : "default"}
                className={!previewPixelPerfect ? "bg-amber-600 text-white hover:bg-amber-700" : "border-slate-600 text-slate-200"}
                onClick={() => setPreviewPixelPerfect(false)}
              >
                ملائم للعرض (تحكم بالأبعاد)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={previewPixelPerfect ? "default" : "secondary"}
                className={previewPixelPerfect ? "bg-amber-600 text-white hover:bg-amber-700" : "border-slate-600 text-slate-200"}
                onClick={() => setPreviewPixelPerfect(true)}
              >
                دقة كاملة 1:1 (تمرير)
              </Button>
            </div>
            {!previewPixelPerfect ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[11px] text-slate-400">
                    أقصى عرض (% من عرض الشاشة)
                  </Label>
                  <Slider
                    value={[previewMaxWvw]}
                    onValueChange={(v) => setPreviewMaxWvw(v[0] ?? 92)}
                    min={35}
                    max={100}
                    step={1}
                    className="py-1"
                  />
                  <p className="text-center text-[11px] tabular-nums text-slate-500" dir="ltr">
                    {previewMaxWvw}%
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-slate-400">
                    أقصى ارتفاع (% من ارتفاع الشاشة)
                  </Label>
                  <Slider
                    value={[previewMaxHvh]}
                    onValueChange={(v) => setPreviewMaxHvh(v[0] ?? 88)}
                    min={35}
                    max={100}
                    step={1}
                    className="py-1"
                  />
                  <p className="text-center text-[11px] tabular-nums text-slate-500" dir="ltr">
                    {previewMaxHvh}%
                  </p>
                </div>
              </div>
            ) : previewNatural ? (
              <p className="text-[11px] text-slate-400" dir="ltr">
                {previewNatural.w} × {previewNatural.h} px — مرّر للاتجاهات لرؤية كامل الصورة
              </p>
            ) : (
              <p className="text-[11px] text-slate-500">جاري تحميل أبعاد الصورة…</p>
            )}
          </DialogHeader>
          <div className="min-h-0 flex-1 bg-slate-950">
            {accountImagePreview ? (
              <div
                className={cn(
                  "w-full p-3",
                  previewPixelPerfect
                    ? "max-h-[min(88vh,1100px)] overflow-auto"
                    : "flex min-h-[min(68vh,720px)] max-h-[min(88vh,1100px)] items-center justify-center overflow-hidden",
                )}
                style={previewPixelPerfect ? { direction: "ltr" } : undefined}
              >
                <img
                  key={accountImagePreview.id}
                  src={readyExcelAccountImageSrc(projectId, accountImagePreview)}
                  alt="معاينة صورة الحسابات"
                  decoding="async"
                  onLoad={(e) => {
                    const { naturalWidth, naturalHeight } = e.currentTarget;
                    setPreviewNatural({ w: naturalWidth, h: naturalHeight });
                  }}
                  className="select-none"
                  style={
                    previewPixelPerfect
                      ? {
                          width: "auto",
                          height: "auto",
                          maxWidth: "none",
                          maxHeight: "none",
                          imageRendering: "auto",
                          display: "block",
                        }
                      : {
                          maxWidth: `min(${previewMaxWvw}vw, 100%)`,
                          maxHeight: `${previewMaxHvh}vh`,
                          width: "auto",
                          height: "auto",
                          objectFit: "contain" as const,
                          imageRendering: "auto",
                          display: "block",
                        }
                  }
                />
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </MvWorkflowPageFrame>
  );
}
