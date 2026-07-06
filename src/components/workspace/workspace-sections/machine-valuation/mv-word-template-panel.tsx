"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileType, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  downloadWordBlob,
  listKnownBookmarkNames,
  mergeWordReportTemplateSmart,
  MV_WORD_ALL_BOOKMARKS,
  prepareMvWordMergeInput,
  scanDocxBookmarks,
} from "@/lib/mv-word-template";
import { resolveImageBookmarkDef, resolveTextBookmarkDef } from "@/lib/mv-word-template/bookmarks";
import type { MvProjectReportData } from "./types";

export type MvWordTemplateImageSource = {
  url: string;
  caption?: string;
};

type CompanyWordTemplate = {
  fileName?: string;
  fileUrl?: string | null;
  uploadedAt?: string;
  sizeBytes?: number;
  bookmarkNames?: string[];
};

function normalizeCompanyWordTemplate(value: unknown): CompanyWordTemplate | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as CompanyWordTemplate;
  const fileUrl = typeof data.fileUrl === "string" ? data.fileUrl.trim() : "";
  if (
    !fileUrl ||
    !(
      fileUrl.startsWith("/uploads/company-report-templates/") ||
      (fileUrl.startsWith("/files/") && fileUrl.toLowerCase().endsWith(".docx"))
    )
  ) {
    return null;
  }
  return {
    fileName: typeof data.fileName === "string" && data.fileName.trim() ? data.fileName.trim() : "قالب Word",
    fileUrl,
    uploadedAt: typeof data.uploadedAt === "string" ? data.uploadedAt : undefined,
    sizeBytes: typeof data.sizeBytes === "number" ? data.sizeBytes : undefined,
    bookmarkNames: Array.isArray(data.bookmarkNames) ? data.bookmarkNames.map(String).filter(Boolean) : [],
  };
}

async function fetchCompanyWordTemplateBuffer(fileUrl: string): Promise<ArrayBuffer> {
  const response = await fetch(fileUrl, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error("تعذر تحميل قالب Word من إعدادات الشركة.");
  return response.arrayBuffer();
}

export interface MvWordTemplatePanelProps {
  projectId: string;
  projectName: string;
  displayNumber?: number | null;
  reportData: MvProjectReportData;
  assetImageSources: MvWordTemplateImageSource[];
  valuationImageSources: MvWordTemplateImageSource[];
  onReportDataPatch: (patch: Partial<MvProjectReportData>) => void;
  disabled?: boolean;
  layout?: "drawer" | "modal";
}

export function MvWordTemplatePanel({
  projectId,
  projectName,
  displayNumber,
  reportData,
  assetImageSources,
  valuationImageSources,
  disabled = false,
  layout = "drawer",
}: MvWordTemplatePanelProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [mergeStage, setMergeStage] = useState("");
  const [mergeProgress, setMergeProgress] = useState<number | null>(null);
  const [foundBookmarks, setFoundBookmarks] = useState<string[]>([]);
  const [companyWordTemplate, setCompanyWordTemplate] = useState<CompanyWordTemplate | null>(null);

  const hasCompanyTemplate = Boolean(companyWordTemplate?.fileUrl);
  const templateFileName = companyWordTemplate?.fileName?.trim() || "قالب Word";
  const hasTemplate = hasCompanyTemplate;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/company/report-defaults", {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as { reportDefaults?: { wordTemplate?: unknown } | null };
        if (!cancelled) setCompanyWordTemplate(normalizeCompanyWordTemplate(payload.reportDefaults?.wordTemplate));
      } catch {
        if (!cancelled) setCompanyWordTemplate(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runMergeAndDownload = useCallback(
    async (templateBuffer: ArrayBuffer) => {
      setGenerating(true);
      setMergeProgress(12);
      setMergeStage("جاري تحضير البيانات والصور…");
      try {
        const mergeInput = await prepareMvWordMergeInput({
          projectName,
          displayNumber,
          reportData,
          assetImageSources,
          valuationImageSources,
        });

        setMergeProgress(46);
        setMergeStage("جاري دمج الإشارات المرجعية على الخادم…");
        const { blob, bookmarkStats, mergeSource } = await mergeWordReportTemplateSmart({
          projectId,
          templateBuffer,
          mergeInput,
          assetImageUrls: assetImageSources.map((s) => s.url),
          valuationImageUrls: valuationImageSources.map((s) => s.url),
        });
        const safeName = (projectName || "report").replace(/[\\/:*?"<>|]+/g, "-");
        const filename = `${safeName}-updated-report.docx`;

        setMergeProgress(88);
        setMergeStage("جاري تنزيل الملف…");
        downloadWordBlob(blob, filename);
        setMergeProgress(100);

        const knownFound = bookmarkStats.bookmarksFound.filter(
          (name) => resolveTextBookmarkDef(name) || resolveImageBookmarkDef(name),
        );

        if (bookmarkStats.imageErrors.length > 0) {
          toast({
            variant: bookmarkStats.textBookmarksFilled > 0 ? "default" : "destructive",
            description:
              bookmarkStats.textBookmarksFilled > 0
                ? `تم تحديث ${bookmarkStats.textBookmarksFilled} إشارة نصية. ${bookmarkStats.imageErrors[0]}`
                : bookmarkStats.imageErrors[0],
          });
        } else if (
          knownFound.length === 0 &&
          bookmarkStats.textBookmarksFilled === 0 &&
          bookmarkStats.assetImagesInserted === 0 &&
          bookmarkStats.valuationImagesInserted === 0
        ) {
          toast({
            variant: "destructive",
            description:
              "تم تنزيل الملف، لكن لم يُعثر على إشارات مرجعية معروفة. تأكد من إضافة Bookmarks بالأسماء المتفق عليها داخل Word.",
          });
        } else if (bookmarkStats.textBookmarksFilled === 0 && bookmarkStats.assetImagesInserted === 0 && bookmarkStats.valuationImagesInserted === 0) {
          toast({
            variant: "destructive",
            description:
              "وُجدت إشارات مرجعية، لكن لا توجد بيانات أو صور في المشروع لملئها. أكمل بيانات التقرير والصور ثم أعد المحاولة.",
          });
        } else {
          toast({
            description: [
              mergeSource === "server" ? "تم تحديث التقرير على الخادم وتنزيله." : "تم تحديث التقرير (متصفح) وتنزيله.",
              bookmarkStats.textBookmarksFilled >= 0 && bookmarkStats.textBookmarksFilled > 0
                ? `${bookmarkStats.textBookmarksFilled} إشارة نصية.`
                : mergeSource === "server"
                  ? "تم دمج البيانات والصور."
                  : "",
              bookmarkStats.assetImagesInserted > 0
                ? `${bookmarkStats.assetImagesInserted} صورة أصول.`
                : "",
              bookmarkStats.valuationImagesInserted > 0
                ? `${bookmarkStats.valuationImagesInserted} صورة حسابات.`
                : "",
            ]
              .filter(Boolean)
              .join(" "),
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "تعذر تحديث ملف Word.",
        });
        throw error;
      } finally {
        setGenerating(false);
        setMergeStage("");
        window.setTimeout(() => setMergeProgress(null), 300);
      }
    },
    [assetImageSources, displayNumber, projectId, projectName, reportData, toast, valuationImageSources],
  );

  const generateMergedReport = useCallback(async () => {
    if (!hasTemplate) return;
    try {
      const templateBuffer = await fetchCompanyWordTemplateBuffer(companyWordTemplate?.fileUrl || "");
      const cached = companyWordTemplate?.bookmarkNames ?? [];
      if (cached.length > 0) {
        setFoundBookmarks(cached);
      } else {
        setMergeStage("جاري قراءة الإشارات المرجعية…");
        const bookmarks = scanDocxBookmarks(templateBuffer);
        setFoundBookmarks(bookmarks);
      }
      await runMergeAndDownload(templateBuffer);
    } catch {
      /* toast in runMergeAndDownload */
    }
  }, [
    companyWordTemplate?.bookmarkNames,
    companyWordTemplate?.fileUrl,
    hasTemplate,
    runMergeAndDownload,
  ]);

  const busy = disabled || generating;
  const displayBookmarks = foundBookmarks.length > 0 ? foundBookmarks : companyWordTemplate?.bookmarkNames ?? [];
  const matchedCount = displayBookmarks.filter(
    (name) => resolveTextBookmarkDef(name) || resolveImageBookmarkDef(name),
  ).length;

  return (
    <div className={cn("space-y-2.5", layout === "modal" && "space-y-3")}>
      <div
        className={cn(
          "rounded-xl border border-sky-200/80 bg-gradient-to-b from-sky-50/90 to-white p-2.5 shadow-sm",
          layout === "modal" && "p-3",
        )}
      >
        <div className="mb-2 flex items-start gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0C447C]/10 text-[#0C447C]">
            <FileType className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 text-right">
            <p className="text-[11.5px] font-black text-slate-900">تحديث تقرير Word بالإشارات المرجعية</p>
            <p className="mt-0.5 text-[9.5px] font-semibold leading-snug text-slate-600">
              يتم دمج بيانات هذا المشروع مع قالب Word المحفوظ مسبقاً في بيانات إعداد التقرير النهائي للشركة.
            </p>
          </div>
        </div>

        {!hasTemplate ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-right">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p className="text-[10px] font-bold leading-5 text-amber-900">
              يجب رفع قالب ملف Word أولاً من بيانات إعداد التقرير النهائي في إعدادات الشركة.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-2 py-1.5">
              <div className="min-w-0 flex-1 text-right">
                <p className="truncate text-[10.5px] font-black text-emerald-900">{templateFileName}</p>
                <p className="text-[9px] font-semibold text-emerald-700">
                  قالب Word نشط من إعدادات الشركة
                </p>
              </div>
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            </div>
          </div>
        )}
      </div>

      {hasTemplate ? (
        <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center gap-1">
            <Badge className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] text-slate-700">
              إشارات في الملف: {displayBookmarks.length}
            </Badge>
            <Badge className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] text-emerald-800">
              معروفة: {matchedCount}
            </Badge>
            <Badge className="rounded-full bg-sky-100 px-2 py-0.5 text-[9px] text-sky-800">
              صور أصول: {assetImageSources.length}
            </Badge>
            <Badge className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] text-violet-800">
              صور حسابات: {valuationImageSources.length}
            </Badge>
          </div>

          {displayBookmarks.length > 0 ? (
            <p className="mb-2 text-[9px] font-semibold leading-relaxed text-slate-600">
              {displayBookmarks.slice(0, 12).join(" · ")}
              {displayBookmarks.length > 12 ? " …" : ""}
            </p>
          ) : null}

          <details className="mb-2 rounded-lg border border-slate-100 bg-slate-50/70 p-1.5">
            <summary className="cursor-pointer text-[9.5px] font-black text-slate-700">
              الإشارات المرجعية المدعومة ({listKnownBookmarkNames().length})
            </summary>
            <div className="mt-1.5 max-h-32 space-y-1 overflow-y-auto">
              {MV_WORD_ALL_BOOKMARKS.map((def) => (
                <p key={def.field} className="text-[9px] text-slate-600">
                  <span className="font-mono font-bold">{def.names.join("، ")}</span>
                  {" → "}
                  {def.labelAr}
                </p>
              ))}
            </div>
          </details>

          {mergeProgress != null ? (
            <div className="mb-2 rounded-lg border border-emerald-100 bg-emerald-50/70 px-2 py-1.5">
              <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-black text-emerald-800">
                <span>{mergeStage || "جاري تجهيز ملف Word…"}</span>
                <span dir="ltr">{Math.round(mergeProgress)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-emerald-700 transition-all duration-300"
                  style={{ width: `${Math.max(4, Math.min(100, mergeProgress))}%` }}
                />
              </div>
            </div>
          ) : null}

          <Button
            type="button"
            className="h-9 w-full gap-2 rounded-lg bg-emerald-700 text-[11px] font-black hover:bg-emerald-800"
            disabled={busy}
            onClick={() => void generateMergedReport()}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {generating && mergeStage ? mergeStage : "ابدأ الدمج وتنزيل Word"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
