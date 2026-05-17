"use client";

import { cn } from "@/lib/utils";

export type MvUploadProgressToastState = "uploading" | "done" | "error";

export type MvUploadProgressToastProps = {
  phase: string;
  label: string;
  progress: number;
  state: MvUploadProgressToastState;
  detail?: string | null;
};

export function MvUploadProgressToast({
  phase,
  label,
  progress,
  state,
  detail,
}: MvUploadProgressToastProps) {
  const pct = Math.max(0, Math.min(100, progress));
  const busy = state === "uploading";
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const ringColor =
    state === "error" ? "text-red-500" : state === "done" ? "text-emerald-500" : "text-[#0C447C]";

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[80] w-[min(19rem,calc(100vw-1.25rem))] rounded-xl border border-slate-200/90 bg-white/98 px-3 py-2.5 shadow-[0_8px_28px_rgba(15,23,42,0.14)] backdrop-blur-sm"
      dir="rtl"
      role="status"
      aria-live="polite"
      aria-busy={busy}
    >
      <div className="flex items-center gap-3">
        <div className="relative h-11 w-11 shrink-0">
          <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44" aria-hidden>
            <circle
              cx="22"
              cy="22"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              className="text-slate-100"
            />
            <circle
              cx="22"
              cy="22"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="3.5"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={cn("transition-all duration-300", ringColor, busy && "animate-pulse")}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-extrabold tabular-nums text-slate-700">
            {state === "error" ? "!" : state === "done" ? "✓" : `${Math.round(pct)}%`}
          </span>
        </div>
        <div className="min-w-0 flex-1 text-right">
          <p className="truncate text-[12px] font-black text-slate-900">{phase}</p>
          <p className="mt-0.5 truncate text-[10px] font-bold text-slate-600">{label}</p>
          {detail ? (
            <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">{detail}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
