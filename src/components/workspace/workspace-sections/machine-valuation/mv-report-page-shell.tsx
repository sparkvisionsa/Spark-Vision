"use client";

import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { REPORT_BODY_CONTENT_FOOTER_GAP_PX } from "./mv-report-page-metrics";
import type { MvCompanyReportLetterheadTemplate } from "./types";

export type MvReportPageVariant = "cover" | "interior";
export type MvReportPageOrientation = "portrait" | "landscape";

const MvReportLetterheadContext = createContext<MvCompanyReportLetterheadTemplate | null>(null);

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

function ReportBackgroundImage({ src }: { src: string }) {
  const cross =
    src.startsWith("http://") || src.startsWith("https://") ? ("anonymous" as const) : undefined;
  /* eslint-disable-next-line @next/next/no-img-element */
  return (
    <img
      src={src}
      alt=""
      className="pointer-events-none absolute inset-0 z-0 h-full w-full select-none object-fill"
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
    paddingInline: "13mm",
    headerHeight: "25mm",
    footerHeight: "18mm",
    bodyPaddingTop: "2mm",
    bodyPaddingBottom: "2mm",
  },
  landscape: {
    paddingInline: "14mm",
    headerHeight: "18mm",
    footerHeight: "14mm",
    bodyPaddingTop: "1.5mm",
    bodyPaddingBottom: "1.5mm",
  },
} as const;

export interface MvReportPageShellProps {
  variant: MvReportPageVariant;
  orientation?: MvReportPageOrientation;
  companyName: string;
  companyNameNode?: ReactNode;
  logoSrc: string | null;
  /** أسطر الفوتر (ديناميكية من الشركة / المستخدم / المشروع) */
  footerLines: string[];
  /**
   * محتوى فوتر مخصّص للغلاف فقط (variant="cover"): عند تمريره يحلّ محل
   * عرض ‎`footerLines`‎ الافتراضي، ويُستخدم لإظهار شريط 3 أعمدة في الغلاف
   * (المقيم المعتمد + رقم العضوية | الرقم المرجعي | تاريخ التقرير).
   */
  coverFooterContent?: ReactNode;
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

function reportTemplateChrome(templateId: string) {
  switch (templateId) {
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
  if (templateId === "executive-navy") {
    return (
      <>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[34%] bg-slate-950/70" aria-hidden />
        <div className="pointer-events-none absolute left-[10mm] right-[78mm] top-[28mm] h-px bg-sky-300/70" aria-hidden />
        <div className="pointer-events-none absolute bottom-[34mm] left-[18mm] h-[24mm] w-[48mm] border border-sky-200/60 bg-white/10" aria-hidden />
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
  logoSrc,
  footerLines,
  coverFooterContent,
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
        data-mv-letterhead-background={coverBackground ? "true" : undefined}
        className={cn(
          "relative mx-auto mb-8 overflow-hidden rounded-md shadow-[0_16px_48px_-14px_rgba(12,68,124,0.38)] ring-1 ring-[#0C447C]/20",
          customCover ? "bg-white" : coverTemplateClass,
          "h-[297mm] w-[210mm] transition-shadow duration-500 ease-out hover:shadow-[0_22px_55px_-16px_rgba(12,68,124,0.42)]",
          className,
        )}
      >
        {coverBackground ? <ReportBackgroundImage src={coverBackground} /> : null}
        {!customCover ? (
          <ReportTemplateCoverDecor templateId={activeTemplateId} />
        ) : null}
        <div
          className={cn(
            "relative z-[1] flex h-[297mm] flex-col",
            customCover ? "px-0 pb-0 pt-0" : "px-[4mm] pb-[7mm] pt-[9mm]",
          )}
          style={coverContentStyle}
          data-mv-report-page-content
        >
          <div
            className={cn(
              "absolute z-10 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black tabular-nums text-[#0C447C] shadow-sm ring-1 ring-[#0C447C]/15",
              customCover ? "left-[9mm] top-[8mm]" : "left-5 top-5",
            )}
            data-mv-page-label-slot
            aria-live="polite"
            dir="ltr"
          >
            —
          </div>
          {/*
            تخطيط الغلاف بنمط مستوحى من تقارير الجهات المهنية:
            • منطقة علوية (~45% من الارتفاع): لوجو الشركة + اسمها مركّزاً.
            • منطقة سفلية (~30%): محتوى ‎children‎ (عنوان التقرير + اسم العميل).
            • شريط فوتر سفلي بثلاثة أعمدة (مخصّص عبر ‎coverFooterContent‎)
              يحلّ محل ‎footerLines‎ الافتراضي عند تمريره.
          */}
          <div className="flex flex-1 flex-col">
            {showCoverBrand ? (
              <div className="flex flex-col items-center justify-end gap-4 px-6 text-center" style={{ flexBasis: "45%" }}>
                {effectiveLogoSrc ? (
                  <ReportLogoImg
                    src={effectiveLogoSrc}
                    className={cn(
                      "mx-auto h-32 max-h-[140px] w-auto max-w-[300px] bg-transparent object-contain",
                      darkCoverChrome && "drop-shadow-[0_2px_10px_rgba(0,0,0,0.18)]",
                    )}
                    style={{ backgroundColor: "transparent" }}
                  />
                ) : (
                  <div className="h-2 w-24 rounded-full bg-[#0C447C]/20" aria-hidden />
                )}
                {companyName || companyNameNode ? (
                  <div className={cn("max-w-[85%] text-center text-[22px] font-black leading-snug tracking-tight text-white sm:text-[26px]", templateChrome.brand)}>
                    {companyNameNode ?? companyName}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div
              className="flex flex-1 flex-col items-center justify-center px-6 text-center"
            >
              <div
                className={cn(
                  "w-full",
                  darkCoverChrome && !coverChildrenChromeless &&
                    "max-w-xl rounded-2xl bg-white/92 p-5 shadow-[0_18px_50px_-22px_rgba(0,0,0,0.45)] ring-1 ring-white/70 backdrop-blur",
                )}
              >
                {children}
              </div>
            </div>
          </div>
          <footer
            className={cn(
              "relative z-[1] mt-auto",
              coverFooterTextClass,
              footerImageSrc
                ? "py-1 px-2 text-[9px] font-semibold leading-relaxed bg-transparent"
                : coverFooterContent
                  ? "bg-[#f37021] px-4 py-3 text-white"
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
                paddingInline: safeArea.paddingInline,
                paddingTop: land ? "4mm" : "6mm",
                paddingBottom: "2mm",
              }
            : undefined
        }
      >
        {/* dir=ltr يثبّت رقم الصفحة على اليسار البصري بغض النظر عن اتجاه التقرير */}
        <div className="grid grid-cols-[minmax(3.25rem,auto)_1fr] items-start gap-3" dir="ltr">
          <div
            className={cn(
              "min-w-[3rem] pt-1 text-left text-[11px] font-black tabular-nums",
              headerAccentTextClass,
              customInteriorLetterhead && "rounded-full bg-white/88 px-2 py-0.5 shadow-sm ring-1 ring-[#0C447C]/10",
            )}
            data-mv-page-label-slot
            aria-live="polite"
          >
            —
          </div>
          <div className="flex min-w-0 flex-col items-center gap-1" dir="rtl">
            {!customInteriorLetterhead && effectiveLogoSrc ? (
              <ReportLogoImg src={effectiveLogoSrc} className="h-14 max-h-16 w-auto max-w-[200px] object-contain" />
            ) : customInteriorLetterhead ? null : (
              <div className="h-10 w-24 rounded bg-slate-100" aria-hidden />
            )}
            {!customInteriorLetterhead ? (
              <div className={cn("max-w-full truncate text-center text-[11px] font-black", headerAccentTextClass)}>
                {companyNameNode ?? (companyName || "—")}
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div
        className={cn(
          "relative z-[1] flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-visible text-right",
          customInteriorLetterhead ? "px-0" : "px-[3mm] py-3",
          !customInteriorLetterhead && land && "py-2",
        )}
        style={
          customInteriorLetterhead
            ? {
                paddingInline: safeArea.paddingInline,
                paddingTop: safeArea.bodyPaddingTop,
                paddingBottom: `calc(${safeArea.bodyPaddingBottom} + ${REPORT_BODY_CONTENT_FOOTER_GAP_PX}px)`,
              }
            : { paddingBottom: REPORT_BODY_CONTENT_FOOTER_GAP_PX }
        }
        data-mv-report-page-content
      >
        {children}
      </div>

      <footer
        className={cn(
          "relative z-[1] mt-auto shrink-0",
          customInteriorLetterhead
            ? "bg-transparent"
            : footerImageSrc
              ? "bg-transparent px-[3mm] py-2"
              : footerTemplateClass,
        )}
        style={
          customInteriorLetterhead
              ? {
                minHeight: safeArea.footerHeight,
                paddingInline: safeArea.paddingInline,
                paddingTop: footerImageSrc ? "0.5mm" : "1mm",
                paddingBottom: footerImageSrc ? "0.5mm" : land ? "3mm" : "4mm",
              }
            : undefined
        }
      >
        <div
          className={cn(
            "flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-center text-[8px] font-semibold leading-relaxed",
            interiorFooterTextClass,
            footerImageSrc && "h-full min-h-[10mm] items-center",
          )}
        >
          {footerImageSrc ? (
            <ReportLogoImg
              src={footerImageSrc}
              className="mx-auto h-auto w-full max-w-full object-contain"
              style={{ maxHeight: land ? "10mm" : "14mm" }}
            />
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
