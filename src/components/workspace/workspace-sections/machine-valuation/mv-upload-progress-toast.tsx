"use client";

import { CheckCircle2, FolderUp, ImageIcon, Loader2, TriangleAlert, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

export type MvUploadProgressToastState = "uploading" | "done" | "error";

export type MvUploadProgressToastProps = {
  phase: string;
  label: string;
  progress: number;
  state: MvUploadProgressToastState;
  detail?: string | null;
  /** `embedded`: full-width strip for use inside a dialog (e.g. dark modal); default is fixed bottom-right toast. */
  variant?: "toast" | "embedded";
};

/**
 * Modern, expressive upload progress card.
 *
 * Design choices:
 *  - Bottom-right floating glass card with a top gradient strip that itself
 *    *is* the progress bar (full width, clear visual % cue).
 *  - State-driven palette (sky for uploading, emerald for done, rose for
 *    error) drives the strip, icon bubble, percentage chip and the small
 *    accent line under the title — so the user reads state at a glance.
 *  - Folder vs. single-image upload swap a `FolderUp` / `ImageIcon` for
 *    instant context. While active the icon spins gently and a shimmer
 *    sweeps across the strip to reinforce the "live" feeling.
 *  - Counts use `tabular-nums` so they don't jitter as digits change.
 *
 * Props are unchanged so existing callers keep working.
 */
export function MvUploadProgressToast({
  phase,
  label,
  progress,
  state,
  detail,
  variant = "toast",
}: MvUploadProgressToastProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const busy = state === "uploading";
  const embedded = variant === "embedded";

  const palette = (() => {
    if (state === "error") {
      return {
        stripFrom: "from-rose-500",
        stripVia: "via-rose-500",
        stripTo: "to-rose-400",
        iconBubble: "from-rose-500 to-rose-600 text-white shadow-rose-500/30",
        accent: "bg-rose-500",
        chipBg: "bg-rose-50 text-rose-900 ring-rose-200",
        chipBorder: "border-rose-200",
        ringGlow: "ring-rose-200/60",
        Icon: TriangleAlert,
      } as const;
    }
    if (state === "done") {
      return {
        stripFrom: "from-emerald-500",
        stripVia: "via-emerald-500",
        stripTo: "to-emerald-400",
        iconBubble: "from-emerald-500 to-emerald-600 text-white shadow-emerald-500/30",
        accent: "bg-emerald-500",
        chipBg: "bg-emerald-50 text-emerald-900 ring-emerald-200",
        chipBorder: "border-emerald-200",
        ringGlow: "ring-emerald-200/60",
        Icon: CheckCircle2,
      } as const;
    }
    return {
      stripFrom: "from-sky-500",
      stripVia: "via-[#0C447C]",
      stripTo: "to-sky-400",
      iconBubble: "from-[#0C447C] to-sky-700 text-white shadow-sky-500/30",
      accent: "bg-[#0C447C]",
      chipBg: "bg-sky-50 text-[#0C447C] ring-sky-200",
      chipBorder: "border-sky-200",
      ringGlow: "ring-sky-200/60",
      Icon: UploadCloud,
    } as const;
  })();

  const isFolder = /مجلد|folder/i.test(phase) || /مجلد/.test(detail ?? "");
  const ContextIcon = isFolder ? FolderUp : ImageIcon;

  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-300",
        embedded
          ? cn(
              "relative z-10 w-full pointer-events-auto rounded-xl border border-slate-600/90 bg-slate-900/95 shadow-lg ring-1 ring-slate-700/80 backdrop-blur-md",
              palette.ringGlow,
            )
          : cn(
              "pointer-events-none fixed bottom-5 right-5 z-[80] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_18px_44px_rgba(15,23,42,0.18)] ring-1 backdrop-blur-md",
              palette.ringGlow,
            ),
      )}
      dir="rtl"
      role="status"
      aria-live="polite"
      aria-busy={busy}
    >
      {/* Top gradient strip = the progress bar itself. We layer:
           1) a faint full-width track so the user senses the remaining ratio
           2) the actual filled portion (gradient + width:pct%)
           3) an animated diagonal shimmer over the filled portion while busy */}
      <div className="relative h-1.5 w-full bg-slate-100/80">
        <div
          className={cn(
            "absolute inset-y-0 right-0 bg-gradient-to-l shadow-[0_0_18px_rgba(12,68,124,0.25)] transition-[width] duration-500 ease-out",
            palette.stripFrom,
            palette.stripVia,
            palette.stripTo,
          )}
          style={{ width: `${state === "uploading" && pct < 4 ? 4 : pct}%` }}
        >
          {busy ? (
            <span
              aria-hidden
              className="absolute inset-0 animate-[mv-progress-shimmer_1.6s_linear_infinite] bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.55)_50%,transparent_65%)] bg-[length:200%_100%]"
            />
          ) : null}
        </div>
        {busy ? (
          <span
            aria-hidden
            className={cn(
              "absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full shadow-[0_0_8px_rgba(12,68,124,0.7)]",
              palette.accent,
            )}
            style={{
              right: `calc(${state === "uploading" && pct < 4 ? 4 : pct}% - 4px)`,
              transition: "right 500ms ease-out",
            }}
          />
        ) : null}
      </div>

      <div className="px-3.5 py-3">
        <div className="flex items-start gap-3">
          {/* Stacked icon: a soft state-coloured bubble with a small context
              badge tucked into the corner showing whether it's a folder or
              a single image upload. */}
          <div className="relative shrink-0">
            <div
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br shadow-md",
                palette.iconBubble,
              )}
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" strokeWidth={2.5} />
              ) : (
                <palette.Icon className="h-5 w-5" strokeWidth={2.5} />
              )}
            </div>
            <span
              className={cn(
                "absolute -bottom-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-white text-slate-500 shadow-sm",
                state === "done" && "text-emerald-600",
                state === "error" && "text-rose-600",
                state === "uploading" && "text-[#0C447C]",
              )}
              aria-hidden
            >
              <ContextIcon className="h-3 w-3" strokeWidth={2.5} />
            </span>
          </div>

            <div className="min-w-0 flex-1 text-right">
            {/* Title row: phase on the right, big tabular percentage chip on
                the left so it always lines up regardless of digits. */}
            <div className="flex items-center justify-between gap-2">
              <p
                className={cn(
                  "min-w-0 flex-1 truncate text-[12.5px] font-black leading-tight",
                  embedded ? "text-slate-100" : "text-slate-900",
                )}
              >
                {phase}
              </p>
              <span
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-black tabular-nums ring-1",
                  embedded
                    ? "bg-slate-800/90 text-sky-200 ring-slate-600"
                    : palette.chipBg,
                )}
              >
                {state === "error" ? "خطأ" : state === "done" ? "اكتمل" : `${pct}%`}
              </span>
            </div>
            {/* Thin accent underline keeps the colour vocabulary consistent
                between the strip and the title block. */}
            <span className={cn("mt-1 block h-[2px] w-8 rounded-full", palette.accent)} aria-hidden />
            <p
              className={cn(
                "mt-1.5 truncate text-[11px] font-bold",
                embedded ? "text-slate-300" : "text-slate-700",
              )}
            >
              {label}
            </p>
            {detail ? (
              <p
                className={cn(
                  "mt-0.5 truncate text-[10.5px] font-semibold tabular-nums",
                  embedded ? "text-slate-500" : "text-slate-500",
                )}
              >
                {detail}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Local keyframes for the diagonal shimmer (kept inline so the
          component is fully self-contained and can be reused anywhere). */}
      <style jsx>{`
        @keyframes mv-progress-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );
}
