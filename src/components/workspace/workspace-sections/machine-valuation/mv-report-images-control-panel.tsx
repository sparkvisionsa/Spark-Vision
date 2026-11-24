"use client";

import { useCallback, useState } from "react";
import { Eye, GripVertical, ImageIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { MvDriveFile } from "./types";
import type { MvValuationAccountingImage } from "./mv-valuation-accounting-store";
import { resolveValuationAccountingImageSrc } from "./mv-valuation-accounting-store";
import { useMvI18n } from "./mv-i18n";
import {
  assetGalleryHeightMm,
  ASSET_PHOTOS_MAX_PER_PAGE,
  ASSET_PHOTOS_MAX_PER_ROW,
  planAssetPhotoGrid,
  type AssetPhotoFit,
} from "./mv-asset-photo-grid";
import { getReportInteriorBodyMaxPx, REPORT_INTERIOR_FRAME_MM } from "./mv-report-page-metrics";

const ASSET_PER_PAGE_PRESETS = [1, 2, 4, 6, 9, 12, 16, 20, 24] as const;

function SegmentedChoice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5">
      <span className="text-[9px] font-semibold text-slate-600">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex gap-0.5 rounded-md bg-slate-100 p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded px-1 py-1 text-[9.5px] font-black transition",
              value === option.value ? "bg-[#0C447C] text-white shadow-sm" : "text-slate-600 hover:bg-white",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Thumbnail of the planned page grid (portrait A4). */
function AssetGridPreview({ columns, rows, count }: { columns: number; rows: number; count: number }) {
  return (
    <div
      aria-hidden
      className="mx-auto grid aspect-[210/297] w-14 shrink-0 gap-[2px] rounded-sm border border-slate-300 bg-white p-[3px] pt-[7px] shadow-sm"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
      data-testid="asset-grid-preview"
    >
      {Array.from({ length: columns * rows }, (_, i) => (
        <span key={i} className={cn("rounded-[1px]", i < count ? "bg-sky-300/80" : "bg-slate-100")} />
      ))}
    </div>
  );
}

function reorderIds(order: string[], fromId: string, toId: string) {
  if (fromId === toId) return order;
  const next = order.filter((id) => id !== fromId);
  const toIndex = next.indexOf(toId);
  if (toIndex < 0) return [...next, fromId];
  next.splice(toIndex, 0, fromId);
  return next;
}

function DraggableRow({
  id,
  label,
  thumbSrc,
  widthPercent,
  widthLabel,
  onWidthChange,
  onReorder,
  showWidthSlider = true,
  sliderDir,
}: {
  id: string;
  label: string;
  thumbSrc?: string;
  widthPercent: number;
  widthLabel: string;
  onWidthChange: (value: number) => void;
  onReorder: (fromId: string, toId: string) => void;
  showWidthSlider?: boolean;
  sliderDir?: "ltr" | "rtl";
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const fromId = event.dataTransfer.getData("text/plain");
        if (fromId) onReorder(fromId, id);
      }}
      className={cn(
        "rounded-lg border bg-white p-2.5 transition",
        dragOver ? "border-sky-400 bg-sky-50/80" : "border-slate-200",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 cursor-grab text-slate-400 active:cursor-grabbing" aria-hidden>
          <GripVertical className="h-4 w-4" />
        </span>
        {thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbSrc} alt="" className="h-14 w-20 shrink-0 rounded-md bg-slate-100 object-cover ring-1 ring-slate-200" />
        ) : (
          <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400 ring-1 ring-slate-200">
            <ImageIcon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[11px] font-bold leading-snug text-slate-800">{label}</p>
          {showWidthSlider ? (
            <label className="mt-1.5 grid gap-1">
              <span className="text-[9px] font-semibold text-slate-500">
                {widthLabel}: {Math.round(widthPercent)}%
              </span>
              <Slider
                dir={sliderDir ?? "rtl"}
                min={24}
                max={100}
                step={2}
                value={[widthPercent]}
                onValueChange={(v) => onWidthChange(v[0] ?? widthPercent)}
                className="py-0.5"
              />
            </label>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ImageSettingSlider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
  sliderDir,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
  sliderDir?: "ltr" | "rtl";
}) {
  return (
    <label className="grid gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5">
      <span className="flex items-center justify-between gap-2 text-[9px] font-semibold text-slate-600">
        <span>{label}</span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-black tabular-nums text-[#0C447C]">
          {Math.round(value)}
          {suffix ?? ""}
        </span>
      </span>
      <Slider
        dir={sliderDir ?? "rtl"}
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? value)}
        className="py-0.5"
      />
    </label>
  );
}

export function MvReportImagesControlPanel({
  projectId,
  activeTab,
  onTabChange,
  assetFiles,
  assetOrder,
  assetWidthPercent,
  assetImagesPerPage,
  assetImagesPerRow,
  assetImagesUniformSize,
  assetImagesAutoLayout = true,
  assetImagesFit = "cover",
  assetImagesNumbered = false,
  onAssetImagesAutoLayoutChange,
  onAssetImagesFitChange,
  onAssetImagesNumberedChange,
  assetPageCount,
  onAssetReorder,
  getAssetImageSrc,
  onAssetWidthChange,
  onAssetImagesPerPageChange,
  onAssetImagesPerRowChange,
  onAssetImagesUniformSizeChange,
  imageGroupGap,
  imageInnerGap,
  imageCornerRadius,
  imageShadow,
  onImageGroupGapChange,
  onImageInnerGapChange,
  onImageCornerRadiusChange,
  onImageShadowChange,
  onAssetPreview,
  onManageAssetImages,
  valuationImages,
  valuationOrder,
  onValuationReorder,
  onValuationWidthChange,
}: {
  projectId: string;
  activeTab?: "assets" | "valuation";
  onTabChange?: (tab: "assets" | "valuation") => void;
  assetFiles: MvDriveFile[];
  assetOrder: string[];
  assetWidthPercent: number;
  assetImagesPerPage: number;
  assetImagesPerRow: number;
  assetImagesUniformSize: boolean;
  assetImagesAutoLayout?: boolean;
  assetImagesFit?: AssetPhotoFit;
  assetImagesNumbered?: boolean;
  onAssetImagesAutoLayoutChange?: (enabled: boolean) => void;
  onAssetImagesFitChange?: (fit: AssetPhotoFit) => void;
  onAssetImagesNumberedChange?: (enabled: boolean) => void;
  assetPageCount?: number;
  onAssetReorder: (next: string[]) => void;
  getAssetImageSrc: (file: MvDriveFile) => string;
  onAssetWidthChange: (width: number) => void;
  onAssetImagesPerPageChange: (count: number) => void;
  onAssetImagesPerRowChange: (count: number) => void;
  onAssetImagesUniformSizeChange: (enabled: boolean) => void;
  imageGroupGap: number;
  imageInnerGap: number;
  imageCornerRadius: number;
  imageShadow: number;
  onImageGroupGapChange: (value: number) => void;
  onImageInnerGapChange: (value: number) => void;
  onImageCornerRadiusChange: (value: number) => void;
  onImageShadowChange: (value: number) => void;
  onAssetPreview: () => void;
  onManageAssetImages?: () => void;
  valuationImages: MvValuationAccountingImage[];
  valuationOrder: string[];
  onValuationReorder: (next: string[]) => void;
  onValuationWidthChange: (imageId: string, width: number) => void;
}) {
  const { t, dir } = useMvI18n();
  const [localTab, setLocalTab] = useState<"assets" | "valuation">("assets");
  const tab = activeTab ?? localTab;
  const setTab = (next: "assets" | "valuation") => {
    setLocalTab(next);
    onTabChange?.(next);
  };

  const handleAssetReorder = useCallback(
    (fromId: string, toId: string) => {
      onAssetReorder(reorderIds(assetOrder, fromId, toId));
    },
    [assetOrder, onAssetReorder],
  );

  const handleValuationReorder = useCallback(
    (fromId: string, toId: string) => {
      onValuationReorder(reorderIds(valuationOrder, fromId, toId));
    },
    [valuationOrder, onValuationReorder],
  );

  const assetById = new Map(assetFiles.map((f) => [f._id, f]));
  const portraitFrame = REPORT_INTERIOR_FRAME_MM.portrait;
  const gridPlan = planAssetPhotoGrid({
    perPage: assetImagesPerPage,
    widthMm: 210 - portraitFrame.paddingInline * 2,
    heightMm: assetGalleryHeightMm(getReportInteriorBodyMaxPx("portrait", portraitFrame)),
    gapXmm: (imageInnerGap * 25.4) / 96,
    gapYmm: (imageGroupGap * 25.4) / 96,
    columns: assetImagesAutoLayout ? undefined : assetImagesPerRow,
  });
  const pages = assetPageCount ?? Math.max(1, Math.ceil(assetOrder.length / Math.max(1, gridPlan.perPage)));
  const setPerPage = (n: number) => onAssetImagesPerPageChange(Math.min(ASSET_PHOTOS_MAX_PER_PAGE, Math.max(1, Math.round(n))));
  const valuationById = new Map(valuationImages.map((im) => [im.id, im]));

  return (
    <div className="mt-2 rounded-lg border border-slate-200/90 bg-slate-50/60 p-2">
      <div className="mb-2 rounded-lg border border-sky-100 bg-white px-2.5 py-2 text-right shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-black text-[#0C447C]">{t("report.imagesPanel.title")}</p>
            <p className="mt-0.5 text-[9.5px] font-semibold leading-4 text-slate-500">
              {t("report.imagesPanel.description")}
            </p>
          </div>
          <span className="shrink-0 rounded-md bg-sky-50 px-2 py-1 text-[11px] font-black tabular-nums text-[#0C447C]">
            {assetOrder.length}
          </span>
        </div>
        {onManageAssetImages ? (
          <button
            type="button"
            onClick={onManageAssetImages}
            className="mt-2 inline-flex h-7 w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 text-[10px] font-black text-slate-700 transition hover:bg-sky-50 hover:text-[#0C447C]"
          >
            <ImageIcon className="h-3 w-3" />
            {t("report.imagesPanel.openAssetImages")}
          </button>
        ) : null}
      </div>
      <div className="mb-1.5 flex gap-0.5 rounded-md bg-white p-0.5 ring-1 ring-slate-200/80">
        <button
          type="button"
          onClick={() => setTab("assets")}
          className={cn(
            "flex-1 rounded px-1 py-1.5 text-[10.5px] font-black transition",
            tab === "assets" ? "bg-sky-800 text-white" : "text-slate-600 hover:bg-slate-50",
          )}
        >
          {t("report.imagesPanel.tabAssets", { count: String(assetOrder.length) })}
        </button>
        <button
          type="button"
          onClick={() => setTab("valuation")}
          className={cn(
            "flex-1 rounded px-1 py-1.5 text-[10.5px] font-black transition",
            tab === "valuation" ? "bg-sky-800 text-white" : "text-slate-600 hover:bg-slate-50",
          )}
        >
          {t("report.imagesPanel.tabValuation", { count: String(valuationOrder.length) })}
        </button>
      </div>
      <p className="mb-1.5 px-0.5 text-[9.5px] font-semibold leading-snug text-slate-500">
        {t("report.imagesPanel.dragHint")}
      </p>
      {tab === "assets" ? (
        <div className="mb-2 grid gap-1.5">
          <button
            type="button"
            onClick={onAssetPreview}
            className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-sky-100 bg-white text-[10px] font-black text-sky-900 shadow-sm transition hover:bg-sky-50"
          >
            <Eye className="h-3 w-3" />
            {t("report.preview.assetImagesPage")}
          </button>
          <div className="grid gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5">
            <div className="flex items-center gap-2">
              <AssetGridPreview columns={gridPlan.columns} rows={gridPlan.rows} count={gridPlan.perPage} />
              <div className="grid min-w-0 flex-1 gap-1">
                <label className="flex items-center justify-between gap-1.5">
                  <span className="text-[9px] font-semibold text-slate-600">{t("report.imagesPanel.imagesPerPage")}</span>
                  <span className="flex items-center gap-0.5">
                    <button type="button" aria-label="-" onClick={() => setPerPage(assetImagesPerPage - 1)} className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-[12px] font-black text-slate-600 hover:bg-slate-50">−</button>
                    <input
                      type="number"
                      min={1}
                      max={ASSET_PHOTOS_MAX_PER_PAGE}
                      step={1}
                      aria-label={t("report.imagesPanel.imagesPerPage")}
                      value={Number.isFinite(assetImagesPerPage) ? assetImagesPerPage : 9}
                      onChange={(event) => {
                        const n = Number(event.target.value);
                        if (Number.isFinite(n)) setPerPage(n);
                      }}
                      className="h-6 w-10 rounded-md border border-slate-200 bg-white px-1 text-center text-[11px] font-black tabular-nums text-[#0C447C] outline-none focus:border-sky-400"
                    />
                    <button type="button" aria-label="+" onClick={() => setPerPage(assetImagesPerPage + 1)} className="flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-[12px] font-black text-slate-600 hover:bg-slate-50">+</button>
                  </span>
                </label>
                <p className="text-[9px] font-bold tabular-nums text-[#0C447C]" data-testid="asset-grid-summary">
                  {t("report.imagesPanel.gridSummary", {
                    cols: String(gridPlan.columns),
                    rows: String(gridPlan.rows),
                    pages: String(pages),
                  })}
                </p>
                {gridPlan.perPage < assetImagesPerPage ? (
                  <p className="text-[8.5px] font-bold leading-4 text-amber-700">
                    {t("report.imagesPanel.maxPerPage", { count: String(gridPlan.perPage) })}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-0.5">
              {ASSET_PER_PAGE_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPerPage(n)}
                  aria-pressed={assetImagesPerPage === n}
                  className={cn(
                    "h-6 min-w-[26px] flex-1 rounded border text-[10px] font-black tabular-nums transition",
                    assetImagesPerPage === n
                      ? "border-[#0C447C] bg-[#0C447C] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:bg-sky-50",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <SegmentedChoice
            label={t("report.imagesPanel.layoutMode")}
            value={assetImagesAutoLayout ? "auto" : "manual"}
            options={[
              { value: "auto", label: t("report.imagesPanel.layoutAuto") },
              { value: "manual", label: t("report.imagesPanel.layoutManual") },
            ]}
            onChange={(mode) => onAssetImagesAutoLayoutChange?.(mode === "auto")}
          />
          {assetImagesAutoLayout ? (
            <p className="px-0.5 text-[9px] font-semibold leading-4 text-slate-500">{t("report.imagesPanel.layoutAutoHint")}</p>
          ) : (
            <label className="flex items-center justify-between gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5">
              <span className="text-[9px] font-semibold text-slate-600">{t("report.imagesPanel.imagesPerRow")}</span>
              <input
                type="number"
                min={1}
                max={ASSET_PHOTOS_MAX_PER_ROW}
                step={1}
                aria-label={t("report.imagesPanel.imagesPerRow")}
                value={Number.isFinite(assetImagesPerRow) ? assetImagesPerRow : 3}
                onChange={(event) => {
                  const n = Number(event.target.value);
                  if (Number.isFinite(n)) onAssetImagesPerRowChange(Math.min(ASSET_PHOTOS_MAX_PER_ROW, Math.max(1, Math.round(n))));
                }}
                className="h-6 w-12 rounded-md border border-slate-200 bg-white px-1 text-center text-[11px] font-black tabular-nums text-[#0C447C] outline-none focus:border-sky-400"
              />
            </label>
          )}
          <SegmentedChoice<AssetPhotoFit>
            label={t("report.imagesPanel.fitMode")}
            value={assetImagesFit}
            options={[
              { value: "cover", label: t("report.imagesPanel.fitCover") },
              { value: "contain", label: t("report.imagesPanel.fitContain") },
              { value: "fill", label: t("report.imagesPanel.fitFill") },
            ]}
            onChange={(fit) => {
              onAssetImagesFitChange?.(fit);
              onAssetImagesUniformSizeChange(fit !== "contain");
            }}
          />
          <label className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-700">
            <span>{t("report.imagesPanel.numbered")}</span>
            <input
              type="checkbox"
              checked={assetImagesNumbered}
              onChange={(event) => onAssetImagesNumberedChange?.(event.target.checked)}
              className="h-4 w-4 accent-[#0C447C]"
            />
          </label>
        </div>
      ) : null}
      <div className="mb-2 grid gap-1.5">
        <ImageSettingSlider label={t("report.toolbar.imageGroupGap")} value={imageGroupGap} min={0} max={120} step={2} suffix="px" sliderDir={dir} onChange={onImageGroupGapChange} />
        <ImageSettingSlider label={t("report.toolbar.imageInnerGap")} value={imageInnerGap} min={0} max={40} step={2} suffix="px" sliderDir={dir} onChange={onImageInnerGapChange} />
        <ImageSettingSlider label={t("report.toolbar.imageRadius")} value={imageCornerRadius} min={0} max={24} step={1} suffix="px" sliderDir={dir} onChange={onImageCornerRadiusChange} />
        <ImageSettingSlider label={t("report.toolbar.imageShadow")} value={imageShadow} min={0} max={4} step={1} sliderDir={dir} onChange={onImageShadowChange} />
      </div>
      <div className="max-h-[min(42vh,360px)] space-y-1.5 overflow-y-auto overscroll-contain">
        {tab === "assets" ? (
          assetOrder.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-center">
              <p className="text-[10.5px] font-black text-slate-600">{t("report.imagesPanel.noAssetImages")}</p>
              <p className="mt-1 text-[9.5px] font-semibold leading-5 text-slate-500">
                {t("report.imagesPanel.noAssetImagesHint")}
              </p>
              {onManageAssetImages ? (
                <button
                  type="button"
                  onClick={onManageAssetImages}
                  className="mt-2 inline-flex h-7 items-center justify-center gap-1 rounded-md bg-[#0C447C] px-3 text-[10px] font-black text-white transition hover:bg-[#09345f]"
                >
                  <ImageIcon className="h-3 w-3" />
                  {t("report.imagesPanel.selectImages")}
                </button>
              ) : null}
            </div>
          ) : (
            assetOrder.map((id) => {
              const file = assetById.get(id);
              if (!file) return null;
              const name = file.name?.trim() || t("report.imagesPanel.imageFallback");
              return (
                <DraggableRow
                  key={id}
                  id={id}
                  label={name}
                  thumbSrc={getAssetImageSrc(file)}
                  widthPercent={assetWidthPercent}
                  widthLabel={t("report.imagesPanel.widthLabel")}
                  onWidthChange={onAssetWidthChange}
                  onReorder={handleAssetReorder}
                  showWidthSlider={false}
                  sliderDir={dir}
                />
              );
            })
          )
        ) : valuationOrder.length === 0 ? (
          <p className="py-3 text-center text-[10px] font-bold text-slate-500">
            {t("report.imagesPanel.noValuationImages")}
          </p>
        ) : (
          valuationOrder.map((id) => {
            const image = valuationById.get(id);
            if (!image) return null;
            const src = resolveValuationAccountingImageSrc(projectId, image) || undefined;
            return (
              <DraggableRow
                key={id}
                id={id}
                label={image.name}
                thumbSrc={src}
                widthPercent={image.displayWidthPercent ?? 88}
                widthLabel={t("report.imagesPanel.imageWidthLabel")}
                onWidthChange={(w) => onValuationWidthChange(id, w)}
                onReorder={handleValuationReorder}
                sliderDir={dir}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
