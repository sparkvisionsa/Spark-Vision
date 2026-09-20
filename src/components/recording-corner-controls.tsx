"use client";

import { Pause, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRecordingClock } from "@/hooks/use-screen-recorder";

type RecordingCornerControlsProps = {
  paused: boolean;
  seconds: number;
  remaining: number;
  countdown: boolean;
  onTogglePause: () => void;
  onStop: () => void;
  label: string;
};

/** شريط تحكم صغير في الزاوية لا يغطي وسط الشاشة أثناء التسجيل. */
export function RecordingCornerControls({
  paused,
  seconds,
  remaining,
  countdown,
  onTogglePause,
  onStop,
  label,
}: RecordingCornerControlsProps) {
  return (
    <div
      data-support-recorder-control
      className="fixed bottom-3 start-3 z-[85] flex items-center gap-1 rounded-full bg-slate-950/92 px-1.5 py-1 text-white shadow-lg ring-1 ring-white/10 backdrop-blur-sm print:hidden"
      role="region"
      aria-label={label}
    >
      <span className={cn("ms-1 h-1.5 w-1.5 shrink-0 rounded-full", paused ? "bg-amber-400" : "animate-pulse bg-red-500")} />
      <span className="px-0.5 font-mono text-[11px] tabular-nums leading-none" aria-label="مدة التسجيل">
        {formatRecordingClock(seconds)}
      </span>
      {countdown ? (
        <span role="timer" className="font-mono text-[10px] tabular-nums text-red-200">
          {formatRecordingClock(remaining)}
        </span>
      ) : null}
      <button
        type="button"
        onClick={onTogglePause}
        aria-label={paused ? "استئناف" : "إيقاف مؤقت"}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white hover:bg-white/10"
      >
        {paused ? <Play className="h-3 w-3 fill-current" /> : <Pause className="h-3 w-3" />}
      </button>
      <button
        type="button"
        onClick={onStop}
        aria-label="إنهاء التسجيل"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
      >
        <Square className="h-2.5 w-2.5 fill-current" />
      </button>
    </div>
  );
}
