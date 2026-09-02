"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Download,
  Gauge,
  Images,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  downloadMergedReportFiles,
  mergeWordReportTemplateSmart,
  prepareMvWordMergeInput,
} from "@/lib/mv-word-template";
import type { MvProjectReportData } from "./types";
import { useMvI18n } from "./mv-i18n";
import {
  MV_WORD_ASSET_IMAGES_PER_ROW_OPTIONS,
  MV_WORD_IMAGE_QUALITY_OPTIONS,
  normalizeMvWordAssetImagesPerRow,
  normalizeMvWordClientImagesPerRow,
  normalizeMvWordImageQuality,
  recommendedMvWordAssetImagesPerPage,
} from "./mv-word-template-settings";

export type MvWordTemplateImageSource = {
  url: string;
  caption?: string;
};

export type MvClientDocumentsImagesPerRow = 1 | 2 | 3;

/** صور حسابات القيمة في Word: صورة واحدة ثابتة في الصف/الصفحة. */
const VALUATION_IMAGES_PER_ROW = 1;

export interface MvWordTemplatePanelProps {
  projectId: string;
  projectName: string;
  displayNumber?: number | null;
  reportData: MvProjectReportData;
  assetImageSources: MvWordTemplateImageSource[];
  valuationImageSources: MvWordTemplateImageSource[];
  clientImageSources?: MvWordTemplateImageSource[];
  onReportDataPatch: (patch: Partial<MvProjectReportData>) => void;
  onBeforeMerge?: () => Promise<void>;
  /**
   * `unknown` is intentionally non-blocking: the merge endpoint remains the
   * source of truth if the company-settings metadata cannot be read.
   */
  templateAvailability?: "available" | "missing" | "unknown";
  companyTemplateFileName?: string | null;
  disabled?: boolean;
  layout?: "drawer" | "modal";
}

function ImageStatRow({
  label,
  count,
  perRow,
  editable,
  options,
  disabled,
  onChange,
  hint,
}: {
  label: string;
  count: number;
  perRow: number;
  editable?: boolean;
  options?: readonly number[];
  disabled?: boolean;
  onChange?: (value: number) => void;
  hint?: string;
}) {
  const selectOptions = options ?? [1, 2, 3];
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-slate-800">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Images className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-black text-slate-900">{label}</p>
            <p className="text-[10px] font-bold tabular-nums text-slate-500">{count}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[10px] font-bold text-slate-500">في الصف</span>
          {editable ? (
            <select
              value={perRow}
              disabled={disabled}
              onChange={(event) => onChange?.(Number(event.target.value))}
              className="h-9 min-w-[4.5rem] rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-black text-slate-900 shadow-none outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
              aria-label={label}
            >
              {selectOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <div className="flex h-9 min-w-[4.5rem] items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-xs font-black tabular-nums text-slate-700">
              {perRow}
            </div>
          )}
        </div>
      </div>
      {hint ? (
        <p className="mt-1.5 text-[9.5px] font-semibold leading-4 text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

function WordImageQualityRow({
  label,
  value,
  disabled,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-slate-800">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
            <Gauge className="h-4 w-4" />
          </span>
          <p className="min-w-0 flex-1 truncate text-[11px] font-black text-slate-900">
            {label}
          </p>
        </div>
        <select
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-9 min-w-[5.5rem] rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-black text-slate-900 shadow-none outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
          aria-label={label}
          dir="ltr"
        >
          {MV_WORD_IMAGE_QUALITY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}%
            </option>
          ))}
        </select>
      </div>
      {hint ? (
        <p className="mt-1.5 text-[9.5px] font-semibold leading-4 text-slate-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function MvWordTemplatePanel({
  projectId,
  projectName,
  displayNumber,
  reportData,
  assetImageSources,
  valuationImageSources,
  clientImageSources = [],
  onReportDataPatch,
  onBeforeMerge,
  templateAvailability = "unknown",
  companyTemplateFileName,
  disabled = false,
  layout = "drawer",
}: MvWordTemplatePanelProps) {
  const { t, dir } = useMvI18n();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [mergeStage, setMergeStage] = useState("");
  const [mergeProgress, setMergeProgress] = useState<number | null>(null);
  const [assetImagesPerRow, setAssetImagesPerRow] = useState(() =>
    normalizeMvWordAssetImagesPerRow(reportData.wordAssetImagesPerRow),
  );
  const [wordImageQuality, setWordImageQuality] = useState(() =>
    normalizeMvWordImageQuality(reportData.wordImageQuality),
  );
  const [clientImagesPerRow, setClientImagesPerRow] = useState<MvClientDocumentsImagesPerRow>(() =>
    normalizeMvWordClientImagesPerRow(reportData.clientDocumentsImagesPerRow),
  );

  const assetImagesPerPage = recommendedMvWordAssetImagesPerPage(assetImagesPerRow);
  const clientImagesPerPage = clientImagesPerRow * clientImagesPerRow;
  const templateMissing = templateAvailability === "missing";
  const templateFileName =
    templateAvailability === "available" && companyTemplateFileName?.trim()
      ? companyTemplateFileName.trim()
      : t("report.wordTemplate.companyTemplate");
  const mergeImageCount =
    assetImageSources.length + valuationImageSources.length + clientImageSources.length;
  const mergeStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    setAssetImagesPerRow(
      normalizeMvWordAssetImagesPerRow(reportData.wordAssetImagesPerRow),
    );
    setWordImageQuality(normalizeMvWordImageQuality(reportData.wordImageQuality));
    setClientImagesPerRow(
      normalizeMvWordClientImagesPerRow(reportData.clientDocumentsImagesPerRow),
    );
  }, [
    reportData.clientDocumentsImagesPerRow,
    reportData.wordAssetImagesPerRow,
    reportData.wordImageQuality,
  ]);

  /** أثناء انتظار الخادم (مرحلة ~46%) حرّك الشريط ببطء حتى لا يبدو متجمّداً مع مئات الصور. */
  useEffect(() => {
    if (!generating) {
      mergeStartedAtRef.current = null;
      return;
    }
    mergeStartedAtRef.current = Date.now();
    const expectedMs = Math.min(12 * 60_000, Math.max(45_000, 30_000 + mergeImageCount * 900));
    const id = window.setInterval(() => {
      setMergeProgress((prev) => {
        if (prev == null || prev < 46 || prev >= 88) return prev;
        const started = mergeStartedAtRef.current ?? Date.now();
        const ratio = Math.min(0.97, (Date.now() - started) / expectedMs);
        return Math.max(prev, Math.min(84, Math.round(46 + ratio * 38)));
      });
    }, 800);
    return () => clearInterval(id);
  }, [generating, mergeImageCount]);

  const updateClientImagesPerRow = useCallback(
    (value: number) => {
      const next = normalizeMvWordClientImagesPerRow(value);
      setClientImagesPerRow(next);
      onReportDataPatch({ clientDocumentsImagesPerRow: next });
    },
    [onReportDataPatch],
  );

  const updateAssetImagesPerRow = useCallback(
    (value: number) => {
      const next = normalizeMvWordAssetImagesPerRow(value);
      setAssetImagesPerRow(next);
      onReportDataPatch({ wordAssetImagesPerRow: next });
    },
    [onReportDataPatch],
  );

  const updateWordImageQuality = useCallback(
    (value: number) => {
      const next = normalizeMvWordImageQuality(value);
      setWordImageQuality(next);
      onReportDataPatch({ wordImageQuality: next });
    },
    [onReportDataPatch],
  );

  const imageLayout = useMemo(
    () => ({
      imagesPerRow: assetImagesPerRow,
      imagesPerPage: assetImagesPerPage,
      clientImagesPerRow,
      clientImagesPerPage,
      imageQuality: wordImageQuality,
    }),
    [
      assetImagesPerPage,
      assetImagesPerRow,
      clientImagesPerPage,
      clientImagesPerRow,
      wordImageQuality,
    ],
  );

  const runMergeAndDownload = useCallback(
    async () => {
      if (templateMissing) return;
      setGenerating(true);
      setMergeProgress(12);
      setMergeStage(t("report.wordTemplate.preparing"));
      try {
        await onBeforeMerge?.();
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
        const { blob, mergeStats } = await mergeWordReportTemplateSmart({
          projectId,
          mergeInput,
          assetImageUrls: assetImageSources.map((s) => s.url),
          valuationImageUrls: valuationImageSources.map((s) => s.url),
          clientImageUrls: clientImageSources.map((s) => s.url),
          alsoPdf: false,
          useStoredProjectState: true,
          imageLayout,
        });
        const safeName = (projectName || "report").replace(/[\\/:*?"<>|]+/g, "-");

        setMergeProgress(88);
        setMergeStage(t("report.wordTemplate.downloading"));
        downloadMergedReportFiles({
          docxBlob: blob,
          baseName: safeName,
        });
        setMergeProgress(100);

        const hasMergedContent =
          mergeStats.variablesFilled > 0 ||
          mergeStats.assetImagesInserted > 0 ||
          mergeStats.valuationImagesInserted > 0 ||
          mergeStats.clientImagesInserted > 0;

        if (mergeStats.warnings.length > 0) {
          const warningDetail = mergeStats.warnings.join(" ");
          toast({
            variant: hasMergedContent ? "default" : "destructive",
            description:
              hasMergedContent
                ? t("report.wordTemplate.toastVariablesUpdated", {
                    count: mergeStats.variablesFilled,
                    detail: warningDetail,
                  })
                : warningDetail,
          });
        } else if (
          mergeStats.variablesFound.length === 0 &&
          !hasMergedContent
        ) {
          toast({
            variant: "destructive",
            description: t("report.wordTemplate.toastNoVariables"),
          });
        } else if (!hasMergedContent) {
          toast({
            variant: "destructive",
            description: t("report.wordTemplate.toastNoData"),
          });
        } else {
          toast({
            description: [
              t("report.wordTemplate.toastUpdatedServer"),
              mergeStats.variablesFilled > 0
                ? t("report.wordTemplate.toastVariableCount", { count: mergeStats.variablesFilled })
                : t("report.wordTemplate.toastMergedData"),
              mergeStats.assetImagesInserted > 0
                ? t("report.wordTemplate.toastAssetImages", { count: mergeStats.assetImagesInserted })
                : "",
              mergeStats.valuationImagesInserted > 0
                ? t("report.wordTemplate.toastValuationImages", { count: mergeStats.valuationImagesInserted })
                : "",
              mergeStats.clientImagesInserted > 0
                ? t("report.wordTemplate.toastClientImages", {
                    count: mergeStats.clientImagesInserted,
                  })
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
      imageLayout,
      onBeforeMerge,
      projectId,
      projectName,
      reportData,
      t,
      toast,
      templateMissing,
      valuationImageSources,
    ],
  );

  const generateMergedReport = useCallback(async () => {
    try {
      await runMergeAndDownload();
    } catch {
      /* toast in runMergeAndDownload */
    }
  }, [runMergeAndDownload]);

  const busy = disabled || generating || templateMissing;

  return (
    <div className={cn(layout === "modal" ? "p-1" : "space-y-2.5")} dir={dir}>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_35px_-24px_rgba(15,23,42,0.45)]">
          <div
            className={cn(
              "flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3",
              templateMissing ? "bg-amber-50/80" : "bg-emerald-50/60",
            )}
          >
            <div className="min-w-0 text-right">
              <p className="truncate text-[11px] font-black text-slate-900">{templateFileName}</p>
              <p className={cn(
                "mt-0.5 text-[9px] font-semibold",
                templateMissing ? "text-amber-700" : "text-emerald-700",
              )}>
                {templateMissing
                  ? t("report.wordTemplate.missingCompanyTemplateHint")
                  : t("report.wordTemplate.companyTemplateHint")}
              </p>
            </div>
            {templateMissing ? (
              <CircleAlert className="h-5 w-5 shrink-0 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            )}
          </div>

          <div className="space-y-3 p-4">
            {templateMissing ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-right">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <CircleAlert className="h-4 w-4" />
                  </span>
                  <p className="min-w-0 flex-1 text-[10px] font-semibold leading-5 text-amber-900">
                    {t("report.wordTemplate.missingCompanyTemplateDescription")}
                  </p>
                </div>
              </div>
            ) : (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-600">
                {t("report.wordTemplate.imageStatsTitle")}
              </p>
              <ImageStatRow
                label={t("report.wordTemplate.assetImagesLabel")}
                count={assetImageSources.length}
                perRow={assetImagesPerRow}
                editable
                options={MV_WORD_ASSET_IMAGES_PER_ROW_OPTIONS}
                disabled={busy}
                onChange={updateAssetImagesPerRow}
                hint={t("report.wordTemplate.assetPerRowHint", {
                  perRow: String(assetImagesPerRow),
                  perPage: String(assetImagesPerPage),
                })}
              />
              <ImageStatRow
                label={t("report.wordTemplate.valuationImagesLabel")}
                count={valuationImageSources.length}
                perRow={VALUATION_IMAGES_PER_ROW}
                hint={t("report.wordTemplate.valuationFixedPerRowHint")}
              />
              <ImageStatRow
                label={t("report.wordTemplate.clientImagesLabel")}
                count={clientImageSources.length}
                perRow={clientImagesPerRow}
                editable
                options={[1, 2, 3]}
                disabled={busy}
                onChange={updateClientImagesPerRow}
                hint={t("report.wordTemplate.clientPerRowHint", {
                  perRow: String(clientImagesPerRow),
                  perPage: String(clientImagesPerPage),
                })}
              />
              <WordImageQualityRow
                label={t("report.wordTemplate.imageQualityLabel")}
                value={wordImageQuality}
                disabled={busy}
                onChange={updateWordImageQuality}
                hint={t("report.wordTemplate.imageQualityHint", {
                  quality: String(wordImageQuality),
                })}
              />
            </div>
            )}

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
              {generating && mergeStage
                ? mergeStage
                : templateMissing
                  ? t("report.wordTemplate.uploadCompanyTemplateFirst")
                  : t("report.wordTemplate.startMerge")}
            </Button>
          </div>
        </div>
    </div>
  );
}
