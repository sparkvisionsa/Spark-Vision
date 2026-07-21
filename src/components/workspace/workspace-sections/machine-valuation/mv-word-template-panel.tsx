"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Download, Images, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  downloadWordBlob,
  mergeWordReportTemplateSmart,
  prepareMvWordMergeInput,
} from "@/lib/mv-word-template";
import { resolveImageBookmarkDef, resolveTextBookmarkDef } from "@/lib/mv-word-template/bookmarks";
import type { MvProjectReportData } from "./types";
import { useMvI18n } from "./mv-i18n";

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

function recommendedImagesPerPage(imagesPerRow: number): number {
  return imagesPerRow * (imagesPerRow >= 4 ? 5 : 4);
}

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
    fileName: typeof data.fileName === "string" && data.fileName.trim() ? data.fileName.trim() : undefined,
    fileUrl,
    uploadedAt: typeof data.uploadedAt === "string" ? data.uploadedAt : undefined,
    sizeBytes: typeof data.sizeBytes === "number" ? data.sizeBytes : undefined,
    bookmarkNames: Array.isArray(data.bookmarkNames) ? data.bookmarkNames.map(String).filter(Boolean) : [],
  };
}

export interface MvWordTemplatePanelProps {
  projectId: string;
  projectName: string;
  displayNumber?: number | null;
  reportData: MvProjectReportData;
  assetImageSources: MvWordTemplateImageSource[];
  valuationImageSources: MvWordTemplateImageSource[];
  clientImageSources?: MvWordTemplateImageSource[];
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
  clientImageSources = [],
  disabled = false,
  layout = "drawer",
}: MvWordTemplatePanelProps) {
  const { t, dir } = useMvI18n();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [mergeStage, setMergeStage] = useState("");
  const [mergeProgress, setMergeProgress] = useState<number | null>(null);
  const [companyWordTemplate, setCompanyWordTemplate] = useState<CompanyWordTemplate | null>(null);
  const [imagesPerRow, setImagesPerRow] = useState(4);
  const imagesPerPage = recommendedImagesPerPage(imagesPerRow);

  const hasCompanyTemplate = Boolean(companyWordTemplate?.fileUrl);
  const templateFileName = companyWordTemplate?.fileName?.trim() || t("report.wordTemplate.defaultName");
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
    async () => {
      setGenerating(true);
      setMergeProgress(12);
      setMergeStage(t("report.wordTemplate.preparing"));
      try {
        const mergeInput = await prepareMvWordMergeInput({
          projectName,
          displayNumber,
          reportData,
          assetImageSources,
          valuationImageSources,
          clientImageSources,
          loadImages: false,
        });

        setMergeProgress(46);
        setMergeStage(t("report.wordTemplate.merging"));
        const { blob, bookmarkStats, mergeSource } = await mergeWordReportTemplateSmart({
          projectId,
          templateBuffer: new ArrayBuffer(0),
          mergeInput,
          assetImageUrls: assetImageSources.map((s) => s.url),
          valuationImageUrls: valuationImageSources.map((s) => s.url),
          clientImageUrls: clientImageSources.map((s) => s.url),
          imageLayout: { imagesPerRow, imagesPerPage },
        });
        const safeName = (projectName || "report").replace(/[\\/:*?"<>|]+/g, "-");
        const filename = `${safeName}-updated-report.docx`;

        setMergeProgress(88);
        setMergeStage(t("report.wordTemplate.downloading"));
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
                ? t("report.wordTemplate.toastTextUpdated", {
                    count: bookmarkStats.textBookmarksFilled,
                    detail: bookmarkStats.imageErrors[0] ?? "",
                  })
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
            description: t("report.wordTemplate.toastNoBookmarks"),
          });
        } else if (bookmarkStats.textBookmarksFilled === 0 && bookmarkStats.assetImagesInserted === 0 && bookmarkStats.valuationImagesInserted === 0) {
          toast({
            variant: "destructive",
            description: t("report.wordTemplate.toastNoData"),
          });
        } else {
          toast({
            description: [
              mergeSource === "server"
                ? t("report.wordTemplate.toastUpdatedServer")
                : t("report.wordTemplate.toastUpdatedBrowser"),
              bookmarkStats.textBookmarksFilled >= 0 && bookmarkStats.textBookmarksFilled > 0
                ? t("report.wordTemplate.toastTextCount", { count: bookmarkStats.textBookmarksFilled })
                : mergeSource === "server"
                  ? t("report.wordTemplate.toastMergedData")
                  : "",
              bookmarkStats.assetImagesInserted > 0
                ? t("report.wordTemplate.toastAssetImages", { count: bookmarkStats.assetImagesInserted })
                : "",
              bookmarkStats.valuationImagesInserted > 0
                ? t("report.wordTemplate.toastValuationImages", { count: bookmarkStats.valuationImagesInserted })
                : "",
            ]
              .filter(Boolean)
              .join(" "),
          });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : t("report.wordTemplate.mergeFailed"),
        });
        throw error;
      } finally {
        setGenerating(false);
        setMergeStage("");
        window.setTimeout(() => setMergeProgress(null), 300);
      }
    },
    [
      assetImageSources,
      clientImageSources,
      displayNumber,
      imagesPerPage,
      imagesPerRow,
      projectId,
      projectName,
      reportData,
      t,
      toast,
      valuationImageSources,
    ],
  );

  const generateMergedReport = useCallback(async () => {
    if (!hasTemplate) return;
    try {
      await runMergeAndDownload();
    } catch {
      /* toast in runMergeAndDownload */
    }
  }, [hasTemplate, runMergeAndDownload]);

  const busy = disabled || generating;

  return (
    <div className={cn(layout === "modal" ? "p-1" : "space-y-2.5")} dir={dir}>
      {!hasTemplate ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-right">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p className="text-[11px] font-bold leading-5 text-amber-900">
              {t("report.wordTemplate.uploadFirst")}
            </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_35px_-24px_rgba(15,23,42,0.45)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-emerald-50/60 px-4 py-3">
            <div className="min-w-0 text-right">
              <p className="truncate text-[11px] font-black text-slate-900">{templateFileName}</p>
              <p className="mt-0.5 text-[9px] font-semibold text-emerald-700">
                {t("report.wordTemplate.activeFromCompany")}
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          </div>

          <div className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sky-800">
                <Images className="h-4 w-4 shrink-0" />
                <span className="text-[10px] font-black">
                  {t("report.wordTemplate.assetImages", { count: assetImageSources.length })}
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-violet-800">
                <Images className="h-4 w-4 shrink-0" />
                <span className="text-[10px] font-black">
                  {t("report.wordTemplate.valuationImages", { count: valuationImageSources.length })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <label className="space-y-1.5 text-[10px] font-bold text-slate-700">
                <span>{t("report.wordTemplate.imagesPerRow")}</span>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={imagesPerRow}
                  disabled={busy}
                  onChange={(event) =>
                    setImagesPerRow(Math.max(1, Math.min(6, Number(event.target.value) || 1)))
                  }
                  className="h-9 rounded-lg border-slate-200 bg-white text-center text-xs font-black shadow-none"
                />
              </label>
              <label className="space-y-1.5 text-[10px] font-bold text-slate-700">
                <span>{t("report.wordTemplate.imagesPerPage")}</span>
                <div className="flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-center text-xs font-black text-slate-700">
                  {imagesPerPage}
                </div>
              </label>
            </div>

          {mergeProgress != null ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-black text-emerald-800">
                <span>{mergeStage || t("report.wordTemplate.preparingFile")}</span>
                <span dir="ltr">{Math.round(mergeProgress)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-emerald-700 transition-all duration-300"
                  style={{ width: `${Math.max(4, Math.min(100, mergeProgress))}%` }}
                />
              </div>
            </div>
          ) : null}

          <Button
            type="button"
            className="h-11 w-full gap-2 rounded-xl bg-emerald-700 text-xs font-black shadow-sm hover:bg-emerald-800"
            disabled={busy}
            onClick={() => void generateMergedReport()}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {generating && mergeStage ? mergeStage : t("report.wordTemplate.startMerge")}
          </Button>
        </div>
        </div>
      )}
    </div>
  );
}
