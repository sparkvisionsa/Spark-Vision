"use client";

import { Pause, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRecordingClock, type RecorderSurface } from "@/hooks/use-screen-recorder";

type HelperRecordingBannerProps = {
  paused: boolean;
  starting: boolean;
  seconds: number;
  remaining: number;
  countdown: boolean;
  source: RecorderSurface;
  arabic: boolean;
  onTogglePause: () => void;
  onStop: () => void;
};

const copy = {
  ar: {
    live: "التسجيل قيد العمل",
    paused: "التسجيل متوقف مؤقتاً",
    starting: "بانتظار مشاركة الشاشة…",
    hint: "لا يمكن بدء تسجيل جديد قبل إنهاء التسجيل الحالي",
    system: "النظام",
    any: "تسجيل عام",
    pause: "إيقاف مؤقت",
    resume: "استئناف",
    stop: "إنهاء",
  },
  en: {
    live: "Recording in progress",
    paused: "Recording paused",
    starting: "Waiting for screen share…",
    hint: "Finish the current recording before starting another",
    system: "This system",
    any: "Entire screen",
    pause: "Pause",
    resume: "Resume",
    stop: "Stop",
  },
} as const;

export function HelperRecordingBanner({
  paused,
  starting,
  seconds,
  remaining,
  countdown,
  source,
  arabic,
  onTogglePause,
  onStop,
}: HelperRecordingBannerProps) {
  const labels = arabic ? copy.ar : copy.en;
  const title = starting ? labels.starting : paused ? labels.paused : labels.live;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-2.5 shadow-sm",
        starting ? "border-slate-200 bg-slate-50" : paused ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50",
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", starting ? "bg-slate-400" : paused ? "bg-amber-500" : "animate-pulse bg-red-500")} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-slate-900">{title}</p>
        <p className="text-[11px] leading-4 text-slate-600">
          {source === "any" ? labels.any : labels.system} · {labels.hint}
        </p>
      </div>
      <span className="font-mono text-sm font-semibold tabular-nums text-slate-900" aria-label={title}>
        {formatRecordingClock(seconds)}
      </span>
      {countdown && !starting ? (
        <span className="font-mono text-[11px] tabular-nums text-red-700">{formatRecordingClock(remaining)}</span>
      ) : null}
      {!starting ? (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onTogglePause}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
          >
            {paused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5" />}
            {paused ? labels.resume : labels.pause}
          </button>
          <button
            type="button"
            onClick={onStop}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-red-600 px-2.5 text-[11px] font-semibold text-white hover:bg-red-700"
          >
            <Square className="h-3 w-3 fill-current" />
            {labels.stop}
          </button>
        </div>
      ) : null}
    </div>
  );
}
