"use client";

import { useCallback, useState, type ReactNode } from "react";
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
}: {
  id?: string;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <section {...(id ? { id } : {})} dir="rtl" className={cn("scroll-mt-4 text-right")}>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div
          className="min-w-0 flex-1 text-right text-[17px] font-black leading-tight text-[#0a1f33] sm:text-[19px]"
          style={{ letterSpacing: 0 }}
        >
          {title}
        </div>
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
  draftWatermark,
}: {
  projectId: string;
  approach: Approach;
  image: MvValuationAccountingImage;
  vIdx: number;
  companyName: string;
  logoSrc: string | null;
  footerLines: string[];
  valuationImageWidth: number;
  draftWatermark: boolean;
}) {
  const [orientation, setOrientation] = useState<MvReportPageOrientation>("landscape");

  const onImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const im = e.currentTarget;
    const nw = im.naturalWidth;
    const nh = im.naturalHeight;
    if (nw <= 0 || nh <= 0) return;
    const ratio = nw / nh;
    setOrientation(ratio >= LANDSCAPE_ASPECT_THRESHOLD ? "landscape" : "portrait");
  }, []);

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
        id={vIdx === 0 ? "mv-annex-1" : undefined}
        title={
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
        }
      >
        <figure className="flex min-h-[132mm] w-full items-center justify-center rounded-xl bg-gradient-to-b from-slate-50/95 to-white p-2 ring-1 ring-[#0C447C]/12">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={valuationImageSrc(projectId, image)}
            alt=""
            className="object-contain"
            style={{
              width: `${valuationImageWidth}%`,
              maxHeight: orientation === "landscape" ? "158mm" : "245mm",
              height: "auto",
              imageRendering: "-webkit-optimize-contrast",
            }}
            loading="lazy"
            onLoad={onImgLoad}
          />
        </figure>
      </AnnexSectionShell>
    </MvReportPageShell>
  );
}
