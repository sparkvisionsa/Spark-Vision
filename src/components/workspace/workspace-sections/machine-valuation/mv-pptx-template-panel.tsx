"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Download,
  Images,
  Loader2,
  Presentation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { downloadPptxTemplateBlob } from "@/lib/mv-pptx-template";
import { mergePptxReportTemplateViaServer } from "@/lib/mv-pptx-template/server-merge";
import type { MvProjectReportData } from "./types";
import type { MvWordTemplateImageSource } from "./mv-word-template-panel";
import { useMvI18n } from "./mv-i18n";

export interface MvPptxTemplatePanelProps {
  projectId: string;
  projectName: string;
  displayNumber?: number | null;
  reportData: MvProjectReportData;
  assetImageSources: MvWordTemplateImageSource[];
  onBeforeMerge?: () => Promise<void>;
  /**
   * Read from the company settings endpoint. `unknown` deliberately leaves
   * the action available so an older endpoint or a transient permissions
   * issue cannot be mistaken for a missing company template.
   */
  templateAvailability?: "available" | "missing" | "unknown";
  companyTemplateFileName?: string | null;
  disabled?: boolean;
  layout?: "drawer" | "modal";
}

function safePptxDownloadName(projectName: string): string {
  const safe = (projectName || "report")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");
  return `${safe || "report"}-merged-presentation.pptx`;
}

export function MvPptxTemplatePanel({
  projectId,
  projectName,
  assetImageSources,
  onBeforeMerge,
  templateAvailability = "unknown",
  companyTemplateFileName,
  disabled = false,
  layout = "drawer",
}: MvPptxTemplatePanelProps) {
  const { t, dir } = useMvI18n();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [stage, setStage] = useState("");
  const mergeStartedAtRef = useRef<number | null>(null);
  const templateMissing = templateAvailability === "missing";
  const savedTemplateName =
    templateAvailability === "available" && companyTemplateFileName?.trim()
      ? companyTemplateFileName.trim()
      : t("report.pptxTemplate.companyTemplate");

  // The server fetches and normalizes the original files. Move the progress bar
  // while it does that work, so a large image set does not look stalled.
  useEffect(() => {
    if (!generating) {
      mergeStartedAtRef.current = null;
      return;
    }
    mergeStartedAtRef.current = Date.now();
    const expectedMs = Math.min(
      12 * 60_000,
      Math.max(40_000, 25_000 + assetImageSources.length * 1_000),
    );
    const interval = window.setInterval(() => {
      setProgress((previous) => {
        if (previous == null || previous < 38 || previous >= 88) return previous;
        const started = mergeStartedAtRef.current ?? Date.now();
        const ratio = Math.min(0.97, (Date.now() - started) / expectedMs);
        return Math.max(previous, Math.min(84, Math.round(38 + ratio * 46)));
      });
    }, 800);
    return () => window.clearInterval(interval);
  }, [assetImageSources.length, generating]);

  const mergeAndDownload = useCallback(async () => {
    if (generating || disabled || templateMissing) return;
    setGenerating(true);
    setProgress(8);
    setStage(t("report.pptxTemplate.preparing"));
    try {
      await onBeforeMerge?.();
      setProgress(38);
      setStage(t("report.pptxTemplate.merging"));
      const result = await mergePptxReportTemplateViaServer({
        projectId,
        // The server resolves the saved company/project template.  Template
        // administration intentionally lives in the templates dashboard, not
        // in this download dialog.
        useStoredProjectState: true,
      });
      setProgress(90);
      setStage(t("report.pptxTemplate.downloading"));
      downloadPptxTemplateBlob(result.blob, safePptxDownloadName(projectName));
      setProgress(100);

      const warnings = result.mergeStats.warnings;
      const hasMergedContent =
        result.mergeStats.variablesFilled > 0 || result.mergeStats.assetImagesInserted > 0;
      const summary = [
        result.mergeStats.variablesFilled > 0
          ? t("report.pptxTemplate.toastVariables", {
              count: result.mergeStats.variablesFilled,
            })
          : "",
        result.mergeStats.assetImagesInserted > 0
          ? t("report.pptxTemplate.toastImages", {
              count: result.mergeStats.assetImagesInserted,
            })
          : "",
        result.mergeStats.slidesAdded > 0
          ? t("report.pptxTemplate.toastSlides", {
              count: result.mergeStats.slidesAdded,
            })
          : "",
        ...warnings,
      ]
        .filter(Boolean)
        .join(" ");
      toast({
        variant: hasMergedContent ? "default" : "destructive",
        description: hasMergedContent
          ? `${t("report.pptxTemplate.done")} ${summary}`.trim()
          : summary || t("report.pptxTemplate.noData"),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        description:
          error instanceof Error && error.message
            ? error.message
            : t("report.pptxTemplate.mergeFailed"),
      });
    } finally {
      setGenerating(false);
      setStage("");
      window.setTimeout(() => setProgress(null), 350);
    }
  }, [
    disabled,
    generating,
    onBeforeMerge,
    projectId,
    projectName,
    templateMissing,
    t,
    toast,
  ]);

  const busy = disabled || generating || templateMissing;

  return (
    <div className={cn(layout === "modal" ? "p-1" : "space-y-2.5")} dir={dir}>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_35px_-24px_rgba(15,23,42,0.45)]">
        <div className={cn(
          "flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3",
          templateMissing ? "bg-amber-50/80" : "bg-orange-50/70",
        )}>
          <div className="min-w-0 text-right">
            <p className="truncate text-[11px] font-black text-slate-900">
              {savedTemplateName}
            </p>
            <p className="mt-0.5 text-[9px] font-semibold text-orange-700">
              {templateMissing
                ? t("report.pptxTemplate.missingCompanyTemplateHint")
                : t("report.pptxTemplate.companyTemplateHint")}
            </p>
          </div>
          {templateMissing ? (
            <CircleAlert className="h-5 w-5 shrink-0 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          )}
        </div>

        <div className="space-y-3 p-4">
          <div className={cn(
            "rounded-xl border p-3",
            templateMissing ? "border-amber-200 bg-amber-50/70" : "border-orange-100 bg-orange-50/60",
          )}>
            <div className="flex items-start gap-2.5 text-right">
              <span className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                templateMissing ? "bg-amber-100 text-amber-700" : "bg-orange-100 text-orange-700",
              )}>
                {templateMissing ? <CircleAlert className="h-4 w-4" /> : <Presentation className="h-4 w-4" />}
              </span>
              <p className={cn(
                "min-w-0 flex-1 text-[10px] font-semibold leading-5",
                templateMissing ? "text-amber-900" : "text-orange-900",
              )}>
                {templateMissing
                  ? t("report.pptxTemplate.missingCompanyTemplateDescription")
                  : t("report.pptxTemplate.companyTemplateDescription")}
              </p>
            </div>
          </div>

          {!templateMissing ? <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
            <div className="flex items-center gap-2 text-slate-800">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                <Images className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black text-slate-900">
                  {t("report.pptxTemplate.assetImages", { count: assetImageSources.length })}
                </p>
                <p className="mt-0.5 text-[9.5px] font-semibold leading-4 text-slate-500">
                  {t("report.pptxTemplate.companyTemplateImagesHint")}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black tabular-nums text-slate-700">
                {assetImageSources.length}
              </span>
            </div>
          </div> : null}

          {progress != null ? (
            <div className="rounded-xl border border-orange-100 bg-orange-50/70 px-3 py-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-black text-orange-900">
                <span>{stage || t("report.pptxTemplate.preparing")}</span>
                <span dir="ltr">{Math.round(progress)}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-orange-600 transition-all duration-300"
                  style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
                />
              </div>
            </div>
          ) : null}

          <Button
            type="button"
            className="h-11 w-full gap-2 rounded-xl bg-orange-600 text-xs font-black shadow-sm hover:bg-orange-700"
            disabled={busy}
            onClick={() => void mergeAndDownload()}
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {generating && stage
              ? stage
              : templateMissing
                ? t("report.pptxTemplate.uploadCompanyTemplateFirst")
                : t("report.pptxTemplate.startMerge")}
          </Button>
        </div>
      </div>
    </div>
  );
}
