"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, Images, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export type MvClientDocumentsImagesPerRow = 1 | 2 | 3;

type CompanyWordTemplate = {
  fileName?: string;
  fileUrl?: string | null;
  uploadedAt?: string;
  sizeBytes?: number;
  bookmarkNames?: string[];
};

/** صور حسابات القيمة في Word: صورة واحدة ثابتة في الصف/الصفحة. */
const VALUATION_IMAGES_PER_ROW = 1;
const DEFAULT_ASSET_IMAGES_PER_ROW = 4;

function recommendedAssetImagesPerPage(imagesPerRow: number): number {
  if (imagesPerRow <= 1) return 2;
  if (imagesPerRow === 2) return 4;
  return imagesPerRow * (imagesPerRow >= 4 ? 5 : 4);
}

function normalizeAssetImagesPerRow(value: unknown): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_ASSET_IMAGES_PER_ROW;
  return Math.max(1, Math.min(6, n));
}

function normalizeClientImagesPerRow(value: unknown): MvClientDocumentsImagesPerRow {
  const n = Math.trunc(Number(value));
  if (n === 1 || n === 3) return n;
  return 2;
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
  options?: number[];
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

export function MvWordTemplatePanel({
  projectId,
  projectName,
  displayNumber,
  reportData,
  assetImageSources,
  valuationImageSources,
  clientImageSources = [],
  onReportDataPatch,
  disabled = false,
  layout = "drawer",
}: MvWordTemplatePanelProps) {
  const { t, dir } = useMvI18n();
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [mergeStage, setMergeStage] = useState("");
  const [mergeProgress, setMergeProgress] = useState<number | null>(null);
  const [companyWordTemplate, setCompanyWordTemplate] = useState<CompanyWordTemplate | null>(null);
  const [assetImagesPerRow, setAssetImagesPerRow] = useState(DEFAULT_ASSET_IMAGES_PER_ROW);
  const [clientImagesPerRow, setClientImagesPerRow] = useState<MvClientDocumentsImagesPerRow>(() =>
    normalizeClientImagesPerRow(reportData.clientDocumentsImagesPerRow),
  );

  const assetImagesPerPage = recommendedAssetImagesPerPage(assetImagesPerRow);
  const clientImagesPerPage = clientImagesPerRow * clientImagesPerRow;
  const hasCompanyTemplate = Boolean(companyWordTemplate?.fileUrl);
  const templateFileName = companyWordTemplate?.fileName?.trim() || t("report.wordTemplate.defaultName");
  const hasTemplate = hasCompanyTemplate;
  const mergeImageCount =
    assetImageSources.length + valuationImageSources.length + clientImageSources.length;
  const mergeStartedAtRef = useRef<number | null>(null);

  useEffect(() => {
    setClientImagesPerRow(normalizeClientImagesPerRow(reportData.clientDocumentsImagesPerRow));
  }, [reportData.clientDocumentsImagesPerRow]);

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

  const updateClientImagesPerRow = useCallback(
    (value: number) => {
      const next = normalizeClientImagesPerRow(value);
      setClientImagesPerRow(next);
      onReportDataPatch({ clientDocumentsImagesPerRow: next });
    },
    [onReportDataPatch],
  );

  const imageLayout = useMemo(
    () => ({
      imagesPerRow: assetImagesPerRow,
      imagesPerPage: assetImagesPerPage,
      clientImagesPerRow,
      clientImagesPerPage,
    }),
    [assetImagesPerPage, assetImagesPerRow, clientImagesPerPage, clientImagesPerRow],
  );

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
          imageLayout,
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
          bookmarkStats.valuationImagesInserted === 0 &&
          (bookmarkStats.clientImagesInserted ?? 0) === 0
        ) {
          toast({
            variant: "destructive",
            description: t("report.wordTemplate.toastNoBookmarks"),
          });
        } else if (
          bookmarkStats.textBookmarksFilled === 0 &&
          bookmarkStats.assetImagesInserted === 0 &&
          bookmarkStats.valuationImagesInserted === 0 &&
          (bookmarkStats.clientImagesInserted ?? 0) === 0
        ) {
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
              bookmarkStats.textBookmarksFilled > 0
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
              (bookmarkStats.clientImagesInserted ?? 0) > 0
                ? t("report.wordTemplate.toastClientImages", {
                    count: bookmarkStats.clientImagesInserted,
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
            <div className="space-y-2">
              <p className="text-[10px] font-black text-slate-600">
                {t("report.wordTemplate.imageStatsTitle")}
              </p>
              <ImageStatRow
                label={t("report.wordTemplate.assetImagesLabel")}
                count={assetImageSources.length}
                perRow={assetImagesPerRow}
                editable
                options={[1, 2, 3, 4, 5, 6]}
                disabled={busy}
                onChange={(value) => setAssetImagesPerRow(normalizeAssetImagesPerRow(value))}
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
