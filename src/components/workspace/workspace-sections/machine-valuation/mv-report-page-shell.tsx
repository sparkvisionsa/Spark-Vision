"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  REPORT_BODY_CONTENT_FOOTER_GAP_PX,
  REPORT_INTERIOR_FRAME_MM,
} from "./mv-report-page-metrics";
import type { MvCompanyReportLetterheadTemplate } from "./types";

export type MvReportPageVariant = "cover" | "interior";
export type MvReportPageOrientation = "portrait" | "landscape";

const MvReportLetterheadContext = createContext<MvCompanyReportLetterheadTemplate | null>(null);

const VALUE_TECH_OFFICIAL_TEMPLATE_ID = "default-report-template";
const VALUE_TECH_COVER_ARTWORK = "/report-assets/value-tech-machine-valuation-cover-v1.png";
const VALUE_TECH_DIVIDER_ARTWORK = "/report-assets/value-tech-machine-valuation-divider-portrait-v1.png";

function millimeters(value: number) {
  return `${value}mm`;
}

/**
 * يحدد ما إذا كان غلاف التقرير ذا خلفية داكنة (نص أبيض) أم فاتحة (نص داكن).
 * يُستخدم خارج الـ Shell لتحديد ألوان أبناء الغلاف عندما يكون التصميم
 * «بدون إطار» (‎`coverChildrenChromeless`‎) بحيث تظهر النصوص فوق خلفية الغلاف
 * مباشرة وليس فوق بطاقة بيضاء داخلية.
 */
export function isMvReportDarkCover(
  templateId: string | null | undefined,
): boolean {
  switch (templateId) {
    case "executive-navy":
    case "industrial-amber":
    case "premium-burgundy":
    case "powerpoint-deck":
    case "field-teal":
    case "default-report-template":
    case null:
    case undefined:
      return true;
    default:
      return false;
  }
}

export function MvReportLetterheadProvider({
  value,
  children,
}: {
  value?: MvCompanyReportLetterheadTemplate | null;
  children: ReactNode;
}) {
  return (
    <MvReportLetterheadContext.Provider value={value ?? null}>
      {children}
    </MvReportLetterheadContext.Provider>
  );
}

function ReportLogoImg({ src, className, style }: { src: string; className?: string; style?: CSSProperties }) {
  const cross =
    src.startsWith("http://") || src.startsWith("https://") ? ("anonymous" as const) : undefined;
  /* eslint-disable-next-line @next/next/no-img-element */
  return <img src={src} alt="" className={className} style={style} crossOrigin={cross} />;
}

function ReportBackgroundImage({ src, fit = "fill" }: { src: string; fit?: "fill" | "cover" }) {
  const cross =
    src.startsWith("http://") || src.startsWith("https://") ? ("anonymous" as const) : undefined;
  /* eslint-disable-next-line @next/next/no-img-element */
  return (
    <img
      src={src}
      alt=""
      className={cn(
        "pointer-events-none absolute inset-0 z-0 h-full w-full select-none",
        fit === "cover" ? "object-cover" : "object-fill",
      )}
      crossOrigin={cross}
      data-mv-report-letterhead-background
    />
  );
}

const LETTERHEAD_SAFE_AREA = {
  cover: {
    paddingInline: "16mm",
    paddingTop: "36mm",
    paddingBottom: "24mm",
  },
  portrait: {
    paddingInline: millimeters(REPORT_INTERIOR_FRAME_MM.portrait.paddingInline),
    headerHeight: millimeters(REPORT_INTERIOR_FRAME_MM.portrait.header),
    footerHeight: millimeters(REPORT_INTERIOR_FRAME_MM.portrait.footer),
    bodyPaddingTop: millimeters(REPORT_INTERIOR_FRAME_MM.portrait.bodyPaddingTop),
    bodyPaddingBottom: millimeters(REPORT_INTERIOR_FRAME_MM.portrait.bodyPaddingBottom),
  },
  landscape: {
    paddingInline: millimeters(REPORT_INTERIOR_FRAME_MM.landscape.paddingInline),
    headerHeight: millimeters(REPORT_INTERIOR_FRAME_MM.landscape.header),
    footerHeight: millimeters(REPORT_INTERIOR_FRAME_MM.landscape.footer),
    bodyPaddingTop: millimeters(REPORT_INTERIOR_FRAME_MM.landscape.bodyPaddingTop),
    bodyPaddingBottom: millimeters(REPORT_INTERIOR_FRAME_MM.landscape.bodyPaddingBottom),
  },
} as const;

export interface MvReportPageShellProps {
  variant: MvReportPageVariant;
  orientation?: MvReportPageOrientation;
  companyName: string;
  companyNameNode?: ReactNode;
  /** السجل التجاري — يُعرض بجانب اسم الشركة. */
  commercialRegistration?: string;
  logoSrc: string | null;
  /** أسطر الفوتر (ديناميكية من الشركة / المستخدم / المشروع) */
  footerLines: string[];
  /**
   * محتوى فوتر مخصّص للغلاف فقط (variant="cover"): عند تمريره يحلّ محل
   * عرض ‎`footerLines`‎ الافتراضي.
   */
  coverFooterContent?: ReactNode;
  /** محتوى فوتر للصفحات الداخلية — label + value في صف واحد بدون اقتطاع. */
  footerContent?: ReactNode;
  /** Chooses the built-in Value Tech artwork for a cover or a section divider. */
  coverArtwork?: "hero" | "divider";
  /**
   * Cover فقط: يلغي بطاقة الخلفية البيضاء حول الـ ‎children‎ في الأغلفة الداكنة
   * عند تفعيلها يظهر المحتوى مباشرة فوق الخلفية الكحلية (تصميم مطابق لتقارير
   * الجهات المهنية الرسمية).
   */
  coverChildrenChromeless?: boolean;
  /** علامة مائية «مسودة» على كامل الورقة (وضع المسودة) */
  draftWatermark?: boolean;
  letterheadTemplate?: MvCompanyReportLetterheadTemplate | null;
  children: ReactNode;
  className?: string;
}

/**
 * صفحة تقرير بمقاس A4 (عرض أو طول) — هيدر/فوتر للصفحات الداخلية، وغلاف مميز للصفحة الأولى.
 * يُلتقط كل غلاف عبر ‎data-mv-report-sheet‎ لتصدير PDF منفصل باتجاه صحيح.
 */
function DraftWatermarkLayer({ orientation = "portrait" }: { orientation?: MvReportPageOrientation }) {
  const isLandscape = orientation === "landscape";
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute inset-0 flex items-center justify-center whitespace-nowrap text-center font-black leading-none text-[#0C447C]/[0.075] motion-safe:select-none"
        style={{
          fontSize: isLandscape ? "42mm" : "50mm",
          letterSpacing: 0,
          transform: "rotate(-34deg) scaleX(1.08)",
          textShadow: "0 0 1px rgba(12,68,124,0.1)",
          mixBlendMode: "multiply",
        }}
      >
        مسودة
      </div>
      <div className="absolute left-1/2 top-1/2 h-[115%] w-px -translate-x-1/2 -translate-y-1/2 rotate-[56deg] bg-[#0C447C]/[0.06]" />
      <div
        className="absolute left-1/2 top-1/2 h-[115%] w-px -translate-x-1/2 -translate-y-1/2 rotate-[56deg] bg-[#c9a227]/[0.045]"
        style={{ marginInlineStart: isLandscape ? "96mm" : "70mm" }}
      />
      <div
        className="absolute left-1/2 top-1/2 h-[115%] w-px -translate-x-1/2 -translate-y-1/2 rotate-[56deg] bg-[#c9a227]/[0.045]"
        style={{ marginInlineStart: isLandscape ? "-96mm" : "-70mm" }}
      />
    </div>
  );
}

/** A subtle permanent identity layer for the official Value Tech template. */
function ValueTechOfficialWatermark({ orientation }: { orientation: MvReportPageOrientation }) {
  const landscape = orientation === "landscape";
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0 opacity-[0.027]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(12,68,124,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(12,68,124,0.16) 1px, transparent 1px)",
          backgroundSize: landscape ? "15mm 15mm" : "13mm 13mm",
          maskImage: "linear-gradient(135deg, transparent 2%, black 32%, transparent 82%)",
        }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/value-tech-icon.png"
        alt=""
        className="absolute left-1/2 top-1/2 h-auto w-[88mm] -translate-x-1/2 -translate-y-1/2 opacity-[0.035] grayscale"
      />
      <span
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center text-[11px] font-black tracking-[0.56em] text-[#0C447C]/[0.07]"
        style={{ transform: "translate(-50%, -50%) rotate(-38deg)" }}
      >
        VALUE TECH · PROFESSIONAL VALUATION
      </span>
    </div>
  );
}

function reportTemplateChrome(templateId: string) {
  switch (templateId) {
    case "default-report-template":
      return {
        cover: "bg-[#061b2d] text-white",
        header: "border-b border-[#0C447C]/18 border-t-[2px] border-t-[#c9a227] bg-white/95 text-[#061b2d]",
        footer: "border-t-2 border-[#c9a227] bg-[#f4f7fa] text-[#061b2d]",
        brand: "text-white",
      };
    case "executive-navy":
      return {
        cover: "bg-gradient-to-br from-slate-950 via-[#0C447C] to-sky-800 text-white",
        header: "border-b-2 border-sky-500 bg-gradient-to-l from-slate-950 via-[#0C447C] to-sky-700 px-[3mm] pb-2 pt-3 text-white",
        footer: "border-t border-sky-200/50 bg-slate-950 px-[3mm] py-2 text-white",
        brand: "text-white",
      };
    case "industrial-amber":
      return {
        cover: "bg-gradient-to-br from-stone-950 via-stone-900 to-amber-700 text-white",
        header: "border-b-2 border-amber-500 bg-gradient-to-l from-stone-950 via-stone-900 to-amber-700 px-[3mm] pb-2 pt-3 text-white",
        footer: "border-t border-amber-300/60 bg-stone-950 px-[3mm] py-2 text-amber-50",
        brand: "text-amber-50",
      };
    case "minimal-graphite":
      return {
        cover: "bg-white text-zinc-950",
        header: "border-b-2 border-zinc-950 bg-white px-[3mm] pb-2 pt-3",
        footer: "border-t border-zinc-950 bg-white px-[3mm] py-2",
        brand: "text-zinc-950",
      };
    case "field-teal":
      return {
        cover: "bg-gradient-to-br from-teal-900 via-cyan-700 to-lime-500 text-white",
        header: "border-b-2 border-lime-500 bg-gradient-to-l from-teal-900 via-cyan-700 to-lime-500 px-[3mm] pb-2 pt-3 text-white",
        footer: "border-t border-teal-200 bg-gradient-to-b from-white to-cyan-50 px-[3mm] py-2",
        brand: "text-white",
      };
    case "premium-burgundy":
      return {
        cover: "bg-gradient-to-br from-rose-950 via-red-900 to-amber-600 text-white",
        header: "border-b-2 border-amber-500 bg-gradient-to-l from-rose-950 via-red-900 to-amber-600 px-[3mm] pb-2 pt-3 text-white",
        footer: "border-t border-amber-300/70 bg-[#fff8f2] px-[3mm] py-2",
        brand: "text-white",
      };
    case "creative-blocks":
      return {
        cover: "bg-white text-slate-950",
        header: "border-b-2 border-fuchsia-600 bg-gradient-to-l from-fuchsia-50 via-sky-50 to-emerald-50 px-[3mm] pb-2 pt-3",
        footer: "border-t border-sky-200 bg-gradient-to-l from-white via-sky-50 to-emerald-50 px-[3mm] py-2",
        brand: "text-slate-950",
      };
    case "powerpoint-deck":
      return {
        cover: "bg-gradient-to-br from-slate-950 via-orange-800 to-amber-500 text-white",
        header: "border-b-2 border-orange-500 bg-gradient-to-l from-slate-950 via-orange-800 to-amber-500 px-[3mm] pb-2 pt-3 text-white",
        footer: "border-t border-orange-200 bg-gradient-to-b from-white to-amber-50 px-[3mm] py-2",
        brand: "text-white",
      };
    case "modern-letterhead":
      return {
        cover: "bg-gradient-to-br from-emerald-50 via-white to-teal-100",
        header: "border-b-2 border-emerald-600 bg-gradient-to-l from-emerald-50 via-white to-teal-50 px-[3mm] pb-2 pt-3",
        footer: "border-t border-emerald-100 bg-gradient-to-b from-white to-emerald-50 px-[3mm] py-2",
        brand: "text-emerald-900",
      };
    case "classic-letterhead":
      return {
        cover: "bg-gradient-to-br from-[#c5d8eb] via-[#eef6fb] to-white",
        header: "border-b-2 border-[#0C447C]/90 bg-gradient-to-l from-[#f6f9fc] via-white to-[#eef6fb] px-[3mm] pb-2 pt-3",
        footer: "border-t border-slate-200/90 bg-gradient-to-b from-[#f8fafc] to-[#eef2f7] px-[3mm] py-2",
        brand: "text-[#0C447C]",
      };
    default:
      return {
        cover: "bg-gradient-to-br from-[#003a57] via-[#004b6b] to-[#005a80] text-white",
        header: "border-b-2 border-[#0C447C]/90 bg-gradient-to-l from-[#f6f9fc] via-white to-[#eef6fb] px-[3mm] pb-2 pt-3",
        footer: "border-t border-slate-200/90 bg-gradient-to-b from-[#f8fafc] to-[#eef2f7] px-[3mm] py-2",
        brand: "text-white",
      };
  }
}

function ReportTemplateCoverDecor({ templateId }: { templateId: string }) {
  if (templateId === "default-report-template") {
    return (
      <>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,14,28,0.98)_0%,rgba(4,24,45,0.93)_38%,rgba(4,24,45,0.54)_61%,rgba(4,24,45,0.08)_100%)]" aria-hidden />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[4mm] bg-[#c9a227]" aria-hidden />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)",
            backgroundSize: "14mm 14mm",
            maskImage: "linear-gradient(90deg, black 0%, black 36%, transparent 74%)",
          }}
        />
        <div className="pointer-events-none absolute left-[18mm] top-[24mm] h-px w-[65mm] bg-[#c9a227]/75" aria-hidden />
        <div className="pointer-events-none absolute bottom-[28mm] left-[18mm] right-[18mm] h-px bg-white/25" aria-hidden />
      </>
    );
  }
  if (templateId === "executive-navy") {
    return (
      <>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[34%] bg-slate-950/70" aria-hidden />
        <div className="pointer-events-none absolute left-[10mm] right-[78mm] top-[28mm] h-px bg-sky-300/70" aria-hidden />
      </>
    );
  }
  if (templateId === "industrial-amber") {
    return (
      <>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[30%] bg-amber-500/90" aria-hidden />
        <div className="pointer-events-none absolute right-[20mm] top-[38mm] h-[140mm] w-[90mm] border border-amber-300/55" aria-hidden />
        <div className="pointer-events-none absolute inset-x-[18mm] bottom-[36mm] h-px bg-amber-300/70" aria-hidden />
        <div className="pointer-events-none absolute inset-y-[28mm] right-[34mm] w-px bg-amber-300/40" aria-hidden />
      </>
    );
  }
  if (templateId === "minimal-graphite") {
    return (
      <>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[12mm] bg-zinc-950" aria-hidden />
        <div className="pointer-events-none absolute left-[24mm] right-[24mm] top-[32mm] h-px bg-zinc-950" aria-hidden />
        <div className="pointer-events-none absolute bottom-[34mm] left-[24mm] h-px w-[70mm] bg-zinc-300" aria-hidden />
      </>
    );
  }
  if (templateId === "field-teal") {
    return (
      <>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[42mm] bg-teal-950/40" aria-hidden />
        <div className="pointer-events-none absolute bottom-[30mm] right-[18mm] h-[44mm] w-[70mm] border border-white/50 bg-white/10" aria-hidden />
        <div className="pointer-events-none absolute bottom-[30mm] left-[18mm] h-[44mm] w-[54mm] bg-lime-300/25" aria-hidden />
      </>
    );
  }
  if (templateId === "premium-burgundy") {
    return (
      <>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[36mm] bg-rose-950/70" aria-hidden />
        <div className="pointer-events-none absolute bottom-0 right-0 h-[78mm] w-[120mm] bg-rose-950/75" aria-hidden />
        <div className="pointer-events-none absolute bottom-[78mm] right-0 h-[2mm] w-[120mm] bg-amber-500" aria-hidden />
        <div className="pointer-events-none absolute left-[22mm] top-[58mm] h-[86mm] w-[58mm] border border-amber-300/70 bg-white/10" aria-hidden />
      </>
    );
  }
  if (templateId === "creative-blocks") {
    return (
      <>
        <div className="pointer-events-none absolute right-0 top-0 h-[78mm] w-[94mm] bg-fuchsia-700" aria-hidden />
        <div className="pointer-events-none absolute left-0 top-0 h-[56mm] w-[116mm] bg-sky-600" aria-hidden />
        <div className="pointer-events-none absolute bottom-0 right-[34mm] h-[82mm] w-[86mm] bg-emerald-500" aria-hidden />
        <div className="pointer-events-none absolute bottom-[58mm] left-[20mm] h-[45mm] w-[52mm] border-[3px] border-slate-950" aria-hidden />
      </>
    );
  }
  if (templateId === "powerpoint-deck") {
    return (
      <>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-[44%] bg-gradient-to-b from-orange-500 to-amber-400" aria-hidden />
        <div className="pointer-events-none absolute right-[20mm] top-[56mm] h-[95mm] w-[72mm] border border-white/35 bg-white/10" aria-hidden />
        <div className="pointer-events-none absolute bottom-[44mm] right-[20mm] h-[2mm] w-[72mm] bg-white/80" aria-hidden />
      </>
    );
  }
  return (
    <>
      {/* لمسات ذهبية ناعمة فوق الكحلي العميق لإضفاء طابع رسمي يشبه تقارير «إنفاذ/تقييم» */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 18%, rgba(255,255,255,0.85) 0, transparent 38%), radial-gradient(circle at 82% 82%, rgba(201,162,39,0.55) 0, transparent 42%)",
        }}
      />
      <div className="pointer-events-none absolute inset-x-[18mm] top-[28mm] h-px bg-white/15" aria-hidden />
      <div className="pointer-events-none absolute inset-x-[18mm] bottom-[36mm] h-px bg-[#c9a227]/40" aria-hidden />
      <div className="pointer-events-none absolute left-1/2 bottom-[30mm] h-[3px] w-[120px] -translate-x-1/2 rounded-full bg-gradient-to-l from-transparent via-[#c9a227] to-transparent" aria-hidden />
    </>
  );
}

export function MvReportPageShell({
  variant,
  orientation = "portrait",
  companyName,
  companyNameNode,
  commercialRegistration,
  logoSrc,
  footerLines,
  coverFooterContent,
  footerContent,
  coverArtwork = "hero",
  coverChildrenChromeless = false,
  draftWatermark = false,
  letterheadTemplate,
  children,
  className,
}: MvReportPageShellProps) {
  const inheritedLetterheadTemplate = useContext(MvReportLetterheadContext);
  const activeLetterheadTemplate = letterheadTemplate ?? inheritedLetterheadTemplate;
  const land = orientation === "landscape";
  const shellDim = land ? "h-[210mm] w-[297mm]" : "h-[297mm] w-[210mm]";
  const letterheadEnabled = activeLetterheadTemplate?.enabled === true;
  const coverBackground = letterheadEnabled ? activeLetterheadTemplate?.coverImageDataUrl || null : null;
  const pageBackground = letterheadEnabled
    ? land
      ? activeLetterheadTemplate?.landscapePageImageDataUrl || activeLetterheadTemplate?.pageImageDataUrl || null
      : activeLetterheadTemplate?.pageImageDataUrl || null
    : null;
  const effectiveLogoSrc = (letterheadEnabled ? activeLetterheadTemplate?.logoDataUrl || null : null) || logoSrc;
  const footerImageSrc = letterheadEnabled ? activeLetterheadTemplate?.footerImageDataUrl || null : null;
  const customInteriorLetterhead = Boolean(pageBackground);
  const safeArea = land ? LETTERHEAD_SAFE_AREA.landscape : LETTERHEAD_SAFE_AREA.portrait;
  const showDefaultFooterText = !letterheadEnabled && footerLines.length > 0;
  const activeTemplateId = activeLetterheadTemplate?.templateId ?? "default-report-template";
  const isValueTechOfficial = activeTemplateId === VALUE_TECH_OFFICIAL_TEMPLATE_ID;
  const builtInCoverArtwork = isValueTechOfficial
    ? coverArtwork === "divider"
      ? VALUE_TECH_DIVIDER_ARTWORK
      : VALUE_TECH_COVER_ARTWORK
    : null;
  const resolvedCoverBackground = coverBackground || builtInCoverArtwork;
  const reportFrame = REPORT_INTERIOR_FRAME_MM[land ? "landscape" : "portrait"];
  const templateChrome = reportTemplateChrome(activeTemplateId);
  const coverTemplateClass = templateChrome.cover;
  const headerTemplateClass = templateChrome.header;
  const footerTemplateClass = templateChrome.footer;
  const darkChromeTemplate =
    activeTemplateId === "executive-navy" ||
    activeTemplateId === "industrial-amber" ||
    activeTemplateId === "premium-burgundy" ||
    activeTemplateId === "powerpoint-deck";
  // غلاف القالب الافتراضي صار كحلياً غامقاً، لذا نعامله كـ«غلاف داكن» (دون التأثير على الصفحات الداخلية).
  const darkCoverChrome = darkChromeTemplate || activeTemplateId === "default-report-template";
  const headerAccentTextClass = darkChromeTemplate ? "text-white" : "text-[#0C447C]";
  const interiorFooterTextClass = darkChromeTemplate ? "text-white" : "text-slate-950";
  const coverFooterTextClass = darkCoverChrome ? "text-white" : "text-slate-950";

  if (variant === "cover") {
    const customCover = Boolean(coverBackground);
    const showCoverBrand = !customCover;
    const officialCoverLayout = isValueTechOfficial && !customCover;
    const coverContentStyle: CSSProperties | undefined = customCover
      ? {
          paddingInline: LETTERHEAD_SAFE_AREA.cover.paddingInline,
          paddingTop: LETTERHEAD_SAFE_AREA.cover.paddingTop,
          paddingBottom: LETTERHEAD_SAFE_AREA.cover.paddingBottom,
        }
      : undefined;
    return (
      <div
        dir="rtl"
        data-mv-report-sheet
        data-mv-report-orientation="portrait"
        data-mv-report-variant="cover"
        data-mv-letterhead-active={letterheadEnabled ? "true" : undefined}
        data-mv-letterhead-background={resolvedCoverBackground ? "true" : undefined}
        className={cn(
          "relative mx-auto mb-8 overflow-hidden rounded-md shadow-[0_16px_48px_-14px_rgba(12,68,124,0.38)] ring-1 ring-[#0C447C]/20",
          customCover ? "bg-white" : coverTemplateClass,
          "h-[297mm] w-[210mm] transition-shadow duration-500 ease-out hover:shadow-[0_22px_55px_-16px_rgba(12,68,124,0.42)]",
          className,
        )}
      >
        {resolvedCoverBackground ? (
          <ReportBackgroundImage
            src={resolvedCoverBackground}
            fit={coverBackground ? "fill" : "cover"}
          />
        ) : null}
        {!customCover ? (
          <ReportTemplateCoverDecor templateId={activeTemplateId} />
        ) : null}
        <div
          className={cn(
            "relative z-[1] flex h-[297mm] min-h-0 flex-col overflow-hidden",
            customCover ? "px-0 pb-0 pt-0" : "px-[4mm] pb-[7mm] pt-[9mm]",
          )}
          style={coverContentStyle}
          data-mv-report-page-content
        >
          {/*
            تخطيط الغلاف بنمط مستوحى من تقارير الجهات المهنية:
            • منطقة علوية (~45% من الارتفاع): لوجو الشركة + اسمها مركّزاً.
            • منطقة سفلية (~30%): محتوى ‎children‎ (عنوان التقرير + اسم العميل).
            • شريط فوتر سفلي مضغوط بأربع خانات (مخصّص عبر ‎coverFooterContent‎)
              يحلّ محل ‎footerLines‎ الافتراضي عند تمريره.
          */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {showCoverBrand ? (
              <div
                className={cn(
                  "flex flex-col justify-end gap-4",
                  officialCoverLayout
                    ? "mr-auto w-full max-w-[92mm] items-start px-0 text-right"
                    : "items-center px-6 text-center",
                )}
                style={{ flexBasis: officialCoverLayout ? "39%" : "45%" }}
              >
                {effectiveLogoSrc ? (
                  <ReportLogoImg
                    src={effectiveLogoSrc}
                    className={cn(
                      "h-32 max-h-[140px] w-auto max-w-[300px] bg-transparent object-contain",
                      officialCoverLayout ? "mr-0" : "mx-auto",
                      darkCoverChrome && "drop-shadow-[0_2px_10px_rgba(0,0,0,0.18)]",
                    )}
                    style={{ backgroundColor: "transparent" }}
                  />
                ) : (
                  <div className="h-2 w-24 rounded-full bg-[#0C447C]/20" aria-hidden />
                )}
                {companyName || companyNameNode ? (
                  <div className={cn(
                    officialCoverLayout ? "max-w-full text-right" : "max-w-[85%] text-center",
                    "space-y-1",
                  )}>
                    <div className={cn(
                      officialCoverLayout ? "text-right" : "text-center",
                      "text-[22px] font-black leading-snug tracking-tight text-white sm:text-[26px]",
                      templateChrome.brand,
                    )}>
                      {companyNameNode ?? companyName}
                    </div>
                    {commercialRegistration?.trim() ? (
                      <p className={cn(
                        officialCoverLayout ? "text-right" : "text-center",
                        "text-[11px] font-bold tracking-wide text-white/80",
                      )}>
                        السجل التجاري: {commercialRegistration.trim()}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div
              className={cn(
                "flex flex-1 flex-col",
                officialCoverLayout
                  ? "items-start justify-end px-[18mm] pb-[25mm] text-right"
                  : "items-center justify-center px-6 text-center",
              )}
            >
              <div
                className={cn(
                  "w-full",
                  officialCoverLayout && "mr-auto max-w-[92mm]",
                  darkCoverChrome && !coverChildrenChromeless &&
                    "max-w-xl rounded-2xl bg-white/92 p-5 shadow-[0_18px_50px_-22px_rgba(0,0,0,0.45)] ring-1 ring-white/70 backdrop-blur",
                )}
              >
                {children}
              </div>
            </div>
          </div>
          <footer
            data-mv-report-footer
            className={cn(
              "relative z-[1] mt-auto shrink-0",
              coverFooterTextClass,
              footerImageSrc
                ? "py-1 px-2 text-[9px] font-semibold leading-relaxed bg-transparent"
                : coverFooterContent
                  ? isValueTechOfficial
                    ? "min-h-[11mm] border-t-2 border-[#c9a227] bg-[#031525]/92 px-[3mm] py-[1mm] text-white backdrop-blur-[2px]"
                    : "min-h-[11mm] border-t border-white/25 bg-black/25 px-[3mm] py-[1mm] text-white"
                  : letterheadEnabled
                    ? "bg-transparent px-2 py-3 text-[9px] font-semibold leading-relaxed"
                    : darkCoverChrome
                      ? "border-t border-white/20 bg-black/20 px-2 py-3 text-[9px] font-semibold leading-relaxed backdrop-blur-[2px]"
                      : "border-t border-[#0C447C]/12 bg-white/88 px-2 py-3 text-[9px] font-semibold leading-relaxed backdrop-blur-[2px]",
            )}
          >
            {footerImageSrc ? (
              <ReportLogoImg
                src={footerImageSrc}
                className="mx-auto h-auto w-full max-w-full object-contain"
                style={{ maxHeight: "18mm" }}
              />
            ) : coverFooterContent ? (
              coverFooterContent
            ) : showDefaultFooterText ? (
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                {footerLines.map((line, i) => (
                  <span key={`${i}-${line}`}>{line}</span>
                ))}
              </div>
            ) : !letterheadEnabled ? (
              <p className="text-center text-slate-400">—</p>
            ) : null}
          </footer>
        </div>
        {draftWatermark ? <DraftWatermarkLayer orientation="portrait" /> : null}
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      data-mv-report-sheet
      data-mv-report-orientation={land ? "landscape" : "portrait"}
      data-mv-report-variant="interior"
      data-mv-letterhead-active={letterheadEnabled ? "true" : undefined}
      data-mv-letterhead-background={pageBackground ? "true" : undefined}
      className={cn(
        "relative mx-auto mb-8 flex flex-col overflow-hidden rounded-md bg-white shadow-[0_10px_36px_-10px_rgba(15,23,42,0.22)] ring-1 ring-[#0C447C]/10",
        shellDim,
        className,
      )}
    >
      {pageBackground ? <ReportBackgroundImage src={pageBackground} /> : null}
      {isValueTechOfficial && !customInteriorLetterhead ? (
        <ValueTechOfficialWatermark orientation={orientation} />
      ) : null}
      <header
        className={cn(
          "relative z-[1] shrink-0",
          customInteriorLetterhead
            ? "bg-transparent"
            : headerTemplateClass,
        )}
        style={
          customInteriorLetterhead
            ? {
                minHeight: safeArea.headerHeight,
                height: safeArea.headerHeight,
                paddingInline: safeArea.paddingInline,
                paddingTop: land ? "3mm" : "4mm",
                paddingBottom: "2mm",
              }
            : {
                minHeight: millimeters(reportFrame.header),
                height: millimeters(reportFrame.header),
                paddingInline: millimeters(reportFrame.paddingInline),
                paddingTop: land ? "3mm" : "4mm",
                paddingBottom: "2mm",
              }
        }
      >
        {isValueTechOfficial && !customInteriorLetterhead ? (
          <div className="flex h-full items-center gap-2.5" dir="rtl">
            {effectiveLogoSrc ? (
              <ReportLogoImg src={effectiveLogoSrc} className="h-10 w-auto max-w-[130px] object-contain" />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-[#0C447C]/10" aria-hidden />
            )}
            <div className="min-w-0">
              <div className="min-w-0 break-words text-[10px] font-black leading-snug text-[#061b2d]">
                {companyNameNode ?? (companyName || "—")}
              </div>
              {commercialRegistration?.trim() ? (
                <div className="mt-0.5 break-words text-[7.5px] font-bold leading-snug text-[#35516a]">
                  السجل التجاري: {commercialRegistration.trim()}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col items-center gap-1" dir="rtl">
            {!customInteriorLetterhead && effectiveLogoSrc ? (
              <ReportLogoImg src={effectiveLogoSrc} className="h-14 max-h-16 w-auto max-w-[200px] object-contain" />
            ) : customInteriorLetterhead ? null : (
              <div className="h-10 w-24 rounded bg-slate-100" aria-hidden />
            )}
            {!customInteriorLetterhead ? (
              <div className={cn("max-w-full text-center text-[11px] font-black leading-snug", headerAccentTextClass)}>
                {companyNameNode ?? (companyName || "—")}
              </div>
            ) : null}
          </div>
        )}
      </header>

      <div
        className={cn(
          "relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden text-right",
          customInteriorLetterhead ? "px-0" : "px-0 py-0",
        )}
        style={
          customInteriorLetterhead
            ? {
                paddingInline: safeArea.paddingInline,
                paddingTop: safeArea.bodyPaddingTop,
                paddingBottom: `calc(${safeArea.bodyPaddingBottom} + ${REPORT_BODY_CONTENT_FOOTER_GAP_PX}px)`,
              }
            : {
                paddingInline: millimeters(reportFrame.paddingInline),
                paddingTop: millimeters(reportFrame.bodyPaddingTop),
                paddingBottom: `calc(${millimeters(reportFrame.bodyPaddingBottom)} + ${REPORT_BODY_CONTENT_FOOTER_GAP_PX}px)`,
              }
        }
        data-mv-report-page-content
      >
        {children}
      </div>

      <footer
        data-mv-report-footer
        className={cn(
          "relative z-[1] mt-auto shrink-0 overflow-hidden",
          customInteriorLetterhead
            ? "bg-transparent"
            : footerImageSrc
              ? "bg-transparent"
              : footerTemplateClass,
        )}
        style={
          customInteriorLetterhead
              ? {
                minHeight: safeArea.footerHeight,
                height: safeArea.footerHeight,
                paddingInline: safeArea.paddingInline,
                paddingTop: footerImageSrc ? "0.5mm" : "1mm",
                paddingBottom: footerImageSrc ? "0.5mm" : land ? "3mm" : "4mm",
              }
            : {
                minHeight: millimeters(reportFrame.footer),
                height: millimeters(reportFrame.footer),
                paddingInline: millimeters(reportFrame.paddingInline),
                paddingTop: footerImageSrc ? "0.5mm" : "2mm",
                paddingBottom: footerImageSrc ? "0.5mm" : "2mm",
              }
        }
      >
        <div
          className={cn(
            footerContent
              ? "flex h-full w-full min-w-0 items-stretch overflow-hidden"
              : "flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-center text-[8px] font-semibold leading-relaxed",
            interiorFooterTextClass,
            footerImageSrc && "h-full min-h-[10mm] items-center",
            !footerContent && isValueTechOfficial && !customInteriorLetterhead && "h-full items-center justify-stretch gap-x-3 gap-y-0.5 text-[8px] text-[#35516a]",
          )}
        >
          {footerImageSrc ? (
            <ReportLogoImg
              src={footerImageSrc}
              className="mx-auto h-auto w-full max-w-full object-contain"
              style={{ maxHeight: land ? "10mm" : "14mm" }}
            />
          ) : footerContent ? (
            footerContent
          ) : showDefaultFooterText ? (
            footerLines.map((line, i) => <span key={`${i}-${line}`}>{line}</span>)
          ) : !letterheadEnabled ? (
            <span className="text-slate-400">—</span>
          ) : null}
        </div>
      </footer>
      {draftWatermark ? <DraftWatermarkLayer orientation={orientation} /> : null}
    </div>
  );
}

export interface MvReportSectionDividerProps {
  sequence: string;
  title: ReactNode;
  companyName: string;
  companyNameNode?: ReactNode;
  commercialRegistration?: string;
  logoSrc: string | null;
  footerLines: string[];
  coverFooterContent?: ReactNode;
  draftWatermark?: boolean;
}

/**
 * A full A4 divider used between major Value Tech report chapters.  It is a
 * real report sheet (not a visual overlay), so it is numbered and exported to
 * PDF exactly like every other page.
 */
export function MvReportSectionDivider({
  sequence,
  title,
  companyName,
  companyNameNode,
  commercialRegistration,
  logoSrc,
  footerLines,
  coverFooterContent,
  draftWatermark = false,
}: MvReportSectionDividerProps) {
  return (
    <MvReportPageShell
      variant="cover"
      coverArtwork="divider"
      companyName={companyName}
      companyNameNode={companyNameNode}
      commercialRegistration={commercialRegistration}
      logoSrc={logoSrc}
      footerLines={footerLines}
      draftWatermark={draftWatermark}
      coverChildrenChromeless
      coverFooterContent={coverFooterContent}
    >
      <section className="mx-auto w-full max-w-[125mm] space-y-5 px-5 text-center text-white" dir="rtl">
        <p className="text-[10px] font-black tracking-[0.26em] text-[#f0d877]">القسم {sequence}</p>
        <div className="mx-auto h-px w-[58mm] bg-gradient-to-l from-transparent via-[#c9a227] to-transparent" />
        <h2 className="text-[30px] font-black leading-[1.28] tracking-tight sm:text-[39px]">{title}</h2>
      </section>
    </MvReportPageShell>
  );
}
