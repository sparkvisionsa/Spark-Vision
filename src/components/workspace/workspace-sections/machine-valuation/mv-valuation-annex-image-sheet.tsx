"use client";

import { useCallback, useState, type ReactNode } from "react";
import { RotateCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MvValuationAccountingImage } from "./mv-valuation-accounting-store";
import type { MvReportPageOrientation } from "./mv-report-page-shell";
import { MvReportPageShell } from "./mv-report-page-shell";

type Approach = { id: string; label: string };

function valuationImageSrc(projectId: string, image: { dataUrl?: string; fileId?: string }) {
  if (image.dataUrl) return image.dataUrl;
  if (image.fileId) return `/api/mv/projects/${projectId}/files/${image.fileId}/download`;
  return "";
}

/** نسبة عرض/ارتفاع أعلى من هذا الحد → صفحة عرضية (أفقية) لاستيعاب الجداول العريضة */
const LANDSCAPE_ASPECT_THRESHOLD = 1.12;

function AnnexSectionShell({
  id,
  title,
  children,
  headerExtra,
}: {
  id?: string;
  title: ReactNode;
  children: ReactNode;
  headerExtra?: ReactNode;
}) {
  return (
    <section
      {...(id ? { id, "data-mv-report-insert-anchor": id } : {})}
      dir="rtl"
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
  const [autoOrientation, setAutoOrientation] = useState<MvReportPageOrientation>("landscape");
  const rawSrc = valuationImageSrc(projectId, image);
  const imgSrc = resolveImageSrc ? resolveImageSrc(rawSrc) : rawSrc;
  const orientation = forcedOrientation ?? autoOrientation;
  const imageShadowFilter =
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
        title={titleNode ?? (
          <span className="text-[14px]">
            مرفق 1: {approach.label}
            {vIdx > 0 ? (
              <span className="ms-2 text-[11px] font-semibold text-slate-500">(تتمة — صورة {vIdx + 1})</span>
            ) : (
              <span className="ms-2 text-[11px] font-semibold text-slate-500">
                (اتجاه الصفحة يُحدَّد تلقائياً حسب نسبة عرض الصورة)
              </span>
            )}
          </span>
        )}
        headerExtra={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleOrientation}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-sky-100 bg-white/95 px-2 text-[10.5px] font-black text-sky-900 shadow-sm transition hover:bg-sky-50"
              title={orientation === "landscape" ? "تحويل الصفحة إلى طول" : "تحويل الصفحة إلى عرض"}
              aria-label="تدوير الصفحة"
            >
              <RotateCw className="h-3.5 w-3.5" />
              {orientation === "landscape" ? "طول" : "عرض"}
            </button>
            {onDelete ? (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex h-7 items-center justify-center rounded-md border border-red-100 bg-white/95 px-2 text-[10.5px] font-black text-red-600 shadow-sm transition hover:bg-red-50"
                title="إخفاء صورة الحسابات من التقرير"
                aria-label="إخفاء صورة الحسابات"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        }
      >
        <figure className="flex min-h-[132mm] w-full items-center justify-center rounded-xl bg-gradient-to-b from-slate-50/95 to-white p-2 ring-1 ring-[#0C447C]/12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgSrc}
            alt=""
            className="object-contain"
            style={{
              width: `${Math.min(100, image.displayWidthPercent ?? valuationImageWidth)}%`,
              maxHeight: orientation === "landscape" ? "158mm" : "245mm",
              height: "auto",
              borderRadius: imageCornerRadius,
              filter: imageShadowFilter,
              imageRendering: "-webkit-optimize-contrast",
            }}
            loading="lazy"
            onLoad={onImgLoad}
          />
        </figure>
        {insertedBlocksNode}
      </AnnexSectionShell>
    </MvReportPageShell>
  );
}
