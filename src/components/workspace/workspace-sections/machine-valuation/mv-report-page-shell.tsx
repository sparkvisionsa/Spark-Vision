"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MvReportPageVariant = "cover" | "interior";
export type MvReportPageOrientation = "portrait" | "landscape";

function ReportLogoImg({ src, className }: { src: string; className?: string }) {
  const cross =
    src.startsWith("http://") || src.startsWith("https://") ? ("anonymous" as const) : undefined;
  /* eslint-disable-next-line @next/next/no-img-element */
  return <img src={src} alt="" className={className} crossOrigin={cross} />;
}

export interface MvReportPageShellProps {
  variant: MvReportPageVariant;
  orientation?: MvReportPageOrientation;
  companyName: string;
  logoSrc: string | null;
  /** أسطر الفوتر (ديناميكية من الشركة / المستخدم / المشروع) */
  footerLines: string[];
  /** علامة مائية «مسودة» على كامل الورقة (وضع المسودة) */
  draftWatermark?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * صفحة تقرير بمقاس A4 (عرض أو طول) — هيدر/فوتر للصفحات الداخلية، وغلاف مميز للصفحة الأولى.
 * يُلتقط كل غلاف عبر ‎data-mv-report-sheet‎ لتصدير PDF منفصل باتجاه صحيح.
 */
function DraftWatermarkLayer() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[25] flex flex-col justify-evenly overflow-hidden"
      aria-hidden
    >
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className="flex justify-center text-[clamp(2.25rem,6.5vw,3.5rem)] font-black tracking-[0.4em] text-slate-900/[0.065] motion-safe:select-none"
          style={{ transform: "rotate(-18deg)" }}
        >
          مسودة
        </div>
      ))}
    </div>
  );
}

export function MvReportPageShell({
  variant,
  orientation = "portrait",
  companyName,
  logoSrc,
  footerLines,
  draftWatermark = false,
  children,
  className,
}: MvReportPageShellProps) {
  const land = orientation === "landscape";
  const shellDim = land ? "w-[297mm] min-h-[210mm]" : "w-[210mm] min-h-[297mm]";

  if (variant === "cover") {
    return (
      <div
        dir="rtl"
        data-mv-report-sheet
        data-mv-report-orientation="portrait"
        data-mv-report-variant="cover"
        className={cn(
          "relative mx-auto mb-8 overflow-hidden rounded-md bg-gradient-to-br from-[#c5d8eb] via-[#e4edf6] to-[#dce6f2] shadow-[0_16px_48px_-14px_rgba(12,68,124,0.38)] ring-1 ring-[#0C447C]/20 motion-safe:animate-mv-report-sheet-reveal",
          "w-[210mm] min-h-[297mm] transition-shadow duration-500 ease-out hover:shadow-[0_22px_55px_-16px_rgba(12,68,124,0.42)]",
          className,
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 animate-mv-report-soft-pulse"
          style={{
            background:
              "radial-gradient(1100px 420px at 100% 0%, #0C447C 0%, transparent 58%), radial-gradient(760px 340px at 0% 100%, #b8860b 0%, transparent 52%), linear-gradient(168deg, rgba(255,255,255,0.5) 0%, rgba(224,242,254,0.45) 42%, rgba(248,250,252,0.85) 100%)",
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute -left-16 top-24 h-40 w-40 rotate-12 rounded-3xl border-2 border-[#0C447C]/20 bg-sky-100/40 shadow-sm" aria-hidden />
        <div className="pointer-events-none absolute -right-10 bottom-32 h-32 w-32 -rotate-6 rounded-full border-2 border-[#c9a227]/30 bg-amber-50/50 shadow-sm" aria-hidden />
        <div className="relative z-[1] flex min-h-[297mm] flex-col px-[8mm] pb-[10mm] pt-[12mm]">
          <div
            className="absolute left-5 top-5 z-10 rounded-full bg-white/90 px-3 py-1 text-[10px] font-black tabular-nums text-[#0C447C] shadow-sm ring-1 ring-[#0C447C]/15"
            data-mv-page-label-slot
            aria-live="polite"
            dir="ltr"
          >
            —
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
            {logoSrc ? (
              <div className="rounded-2xl bg-white/95 px-6 py-4 shadow-[0_8px_30px_-8px_rgba(12,68,124,0.25)] ring-1 ring-white/80 backdrop-blur-sm transition-transform duration-300 ease-out motion-safe:hover:scale-[1.02]">
                <ReportLogoImg src={logoSrc} className="mx-auto h-20 max-h-28 w-auto max-w-[200px] object-contain" />
              </div>
            ) : (
              <div className="h-2 w-24 rounded-full bg-[#0C447C]/20" aria-hidden />
            )}
            {companyName ? (
              <p className="max-w-[85%] text-[18px] font-black leading-snug text-[#0C447C] sm:text-[20px]">
                {companyName}
              </p>
            ) : null}
            {children}
          </div>
          <footer className="relative z-[1] mt-auto border-t border-[#0C447C]/12 bg-white/88 px-2 py-3 text-[9px] font-semibold leading-relaxed text-slate-600 backdrop-blur-[2px]">
            {footerLines.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                {footerLines.map((line, i) => (
                  <span key={`${i}-${line}`}>{line}</span>
                ))}
              </div>
            ) : (
              <p className="text-center text-slate-400">—</p>
            )}
          </footer>
        </div>
        {draftWatermark ? <DraftWatermarkLayer /> : null}
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      data-mv-report-sheet
      data-mv-report-orientation={land ? "landscape" : "portrait"}
      data-mv-report-variant="interior"
      className={cn(
        "relative mx-auto mb-8 flex flex-col overflow-hidden rounded-md bg-white shadow-[0_10px_36px_-10px_rgba(15,23,42,0.22)] ring-1 ring-[#0C447C]/10 motion-safe:animate-mv-report-sheet-reveal transition-shadow duration-500 ease-out hover:shadow-[0_14px_44px_-12px_rgba(12,68,124,0.18)]",
        shellDim,
        className,
      )}
    >
      <header className="shrink-0 border-b-2 border-[#0C447C]/90 bg-gradient-to-l from-[#f6f9fc] via-white to-[#eef6fb] px-[8mm] pb-2 pt-3">
        {/* dir=ltr يثبّت رقم الصفحة على اليسار البصري بغض النظر عن اتجاه التقرير */}
        <div className="grid grid-cols-[minmax(3.25rem,auto)_1fr] items-start gap-3" dir="ltr">
          <div
            className="min-w-[3rem] pt-1 text-left text-[11px] font-black tabular-nums text-[#0C447C]"
            data-mv-page-label-slot
            aria-live="polite"
          >
            —
          </div>
          <div className="flex min-w-0 flex-col items-center gap-1" dir="rtl">
            {logoSrc ? (
              <ReportLogoImg src={logoSrc} className="h-10 max-h-12 w-auto max-w-[140px] object-contain" />
            ) : (
              <div className="h-8 w-20 rounded bg-slate-100" aria-hidden />
            )}
            <span className="max-w-full truncate text-center text-[11px] font-black text-[#0C447C]">
              {companyName || "—"}
            </span>
          </div>
        </div>
      </header>

      <div className={cn("min-h-0 flex-1 px-[8mm] py-4 text-right", land && "py-3")}>{children}</div>

      <footer className="relative z-[1] mt-auto shrink-0 border-t border-slate-200/90 bg-gradient-to-b from-[#f8fafc] to-[#eef2f7] px-[8mm] py-2">
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-center text-[8px] font-semibold leading-relaxed text-slate-600">
          {footerLines.length > 0 ? (
            footerLines.map((line, i) => <span key={`${i}-${line}`}>{line}</span>)
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </div>
      </footer>
      {draftWatermark ? <DraftWatermarkLayer /> : null}
    </div>
  );
}
