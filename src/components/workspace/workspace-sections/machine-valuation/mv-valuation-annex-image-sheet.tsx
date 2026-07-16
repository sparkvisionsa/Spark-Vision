"use client";

import { useCallback, useState, type ReactNode } from "react";
import { RotateCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MvValuationAccountingImage } from "./mv-valuation-accounting-store";
import { resolveValuationAccountingImageSrc } from "./mv-valuation-accounting-store";
import type { MvReportPageOrientation } from "./mv-report-page-shell";
import { MvReportPageShell } from "./mv-report-page-shell";
import { useReportViewportScale } from "./mv-report-viewport-scale";
import { useMvI18n } from "./mv-i18n";
type Approach = { id: string; label: string };

/** نسبة عرض/ارتفاع أعلى من هذا الحد → صفحة عرضية (أفقية) لاستيعاب الجداول العريضة */const LANDSCAPE_ASPECT_THRESHOLD = 1.12;

function AnnexSectionShell({
  id,
  title,
  children,
  headerExtra,
  dir,
}: {
  id?: string;
  title: ReactNode;
  children: ReactNode;
  headerExtra?: ReactNode;
  dir: "ltr" | "rtl";
}) {
  return (
    <section
      {...(id ? { id, "data-mv-report-insert-anchor": id } : {})}
      dir={dir}
      className={cn("scroll-mt-4 text-right")}
    >
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div
          className="min-w-0 flex-1 text-right text-[17px] font-black leading-tight text-[#0a1f33] sm:text-[19px]"
          style={{ letterSpacing: 0 }}
        >
          {title}
        </div>
        {headerExtra ? <div className="mv-report-chrome shrink-0 print:hidden">{headerExtra}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function MvValuationAnnexImageSheet({
  projectId,
  approach,
  image,
  vIdx,
  companyName,
  logoSrc,
  footerLines,
  valuationImageWidth,
  imageCornerRadius = 0,
  imageShadow = 0,
  draftWatermark,
  resolveImageSrc,
  forcedOrientation,
  onOrientationChange,
  onDelete,
  insertedBlocksNode,
  titleNode,
}: {
  projectId: string;
  approach: Approach;
  image: MvValuationAccountingImage;
  vIdx: number;
  companyName: string;
  logoSrc: string | null;
  footerLines: string[];
  valuationImageWidth: number;
  imageCornerRadius?: number;
  imageShadow?: number;
  draftWatermark: boolean;
  resolveImageSrc?: (src: string) => string;
  forcedOrientation?: MvReportPageOrientation;
  onOrientationChange?: (orientation: MvReportPageOrientation) => void;
  onDelete?: () => void;
  insertedBlocksNode?: ReactNode;
  titleNode?: ReactNode;
}) {
  const { t, dir } = useMvI18n();
  const [autoOrientation, setAutoOrientation] = useState<MvReportPageOrientation>("landscape");
  const viewScale = useReportViewportScale();
  const rawSrc = resolveValuationAccountingImageSrc(projectId, image);
  const imgSrc = resolveImageSrc ? resolveImageSrc(rawSrc) : rawSrc;
  const orientation = forcedOrientation ?? autoOrientation;
  const displayWidth = Math.min(100, Math.max(92, image.displayWidthPercent ?? valuationImageWidth));
  /** تعويض تصغير معاينة اللوحة لعرض الصورة بكثافة بكسل أعلى */
  const previewSharpness =
    viewScale > 0 && viewScale < 0.995 ? Math.min(2.5, 1 / viewScale) : 1;  const imageShadowFilter =
    imageShadow > 0
      ? `drop-shadow(0 ${Math.max(1, imageShadow)}px ${Math.max(3, imageShadow * 4)}px rgba(15,23,42,${0.08 + imageShadow * 0.03}))`
      : "none";

  const onImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const im = e.currentTarget;
    const nw = im.naturalWidth;
    const nh = im.naturalHeight;
    if (nw <= 0 || nh <= 0) return;
    const ratio = nw / nh;
    setAutoOrientation(ratio >= LANDSCAPE_ASPECT_THRESHOLD ? "landscape" : "portrait");
  }, []);

  const toggleOrientation = () => {
    onOrientationChange?.(orientation === "landscape" ? "portrait" : "landscape");
  };

  return (
    <MvReportPageShell
      variant="interior"
      orientation={orientation}
      companyName={companyName}
      logoSrc={logoSrc}
      footerLines={footerLines}
      draftWatermark={draftWatermark}
    >
      <AnnexSectionShell
        id={vIdx === 0 ? "mv-annex-1" : `mv-annex-1-${vIdx}`}
        dir={dir}
        title={titleNode ?? (
          <span className="text-[14px]">{t("report.annex.defaultTitle")}</span>
        )}
        headerExtra={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleOrientation}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-sky-100 bg-white/95 px-2 text-[10.5px] font-black text-sky-900 shadow-sm transition hover:bg-sky-50"
              title={
                orientation === "landscape"
                  ? t("report.annex.rotateToPortrait")
                  : t("report.annex.rotateToLandscape")
              }
              aria-label={t("report.annex.rotatePageAria")}
            >
              <RotateCw className="h-3.5 w-3.5" />
              {orientation === "landscape" ? t("report.annex.portrait") : t("report.annex.landscape")}
            </button>
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex h-7 items-center justify-center rounded-md border border-red-100 bg-white/95 px-2 text-[10.5px] font-black text-red-600 shadow-sm transition hover:bg-red-50"
                title={t("report.annex.hideImageTitle")}
                aria-label={t("report.annex.hideImageAria")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        }
      >
        <figure className="flex min-h-[132mm] w-full items-start justify-center rounded-xl bg-white p-1 ring-1 ring-[#0C447C]/12">
          <div
            className="flex w-full items-start justify-center"
            data-mv-annex-hq-wrap={previewSharpness > 1 ? "1" : undefined}
            style={
              previewSharpness > 1
                ? {
                    transform: `scale(${previewSharpness})`,
                    transformOrigin: "top center",
                    width: `${100 / previewSharpness}%`,
                  }
                : undefined
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imgSrc}
              alt=""
              className="object-contain"
              style={{
                width: `${displayWidth}%`,
                maxHeight: orientation === "landscape" ? "158mm" : "245mm",
                height: "auto",
                borderRadius: imageCornerRadius,
                filter: imageShadowFilter,
                imageRendering: "auto",
              }}
              loading="eager"
              decoding="sync"
              onLoad={onImgLoad}
            />
          </div>
        </figure>        {insertedBlocksNode}
      </AnnexSectionShell>
    </MvReportPageShell>
  );
}
