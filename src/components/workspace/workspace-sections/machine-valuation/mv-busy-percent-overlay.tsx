"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function MvBusyPercentOverlay({
  open,
  percent,
  label,
  dir,
}: {
  open: boolean;
  percent: number;
  label: string;
  dir?: "rtl" | "ltr";
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  const clamped = Math.max(0, Math.min(100, Math.round(percent)));

  return createPortal(
    <div
      className="fixed inset-0 z-[960] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-md"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-busy="true"
      aria-label={label}
      dir={dir}
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/25 bg-white p-5 shadow-2xl shadow-slate-950/40">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-black text-slate-900">{label}</p>
          <span className="tabular-nums text-[13px] font-black text-sky-700">{clamped}%</span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn(
              "h-full rounded-full bg-gradient-to-l from-cyan-500 via-sky-500 to-emerald-500 transition-[width] duration-300 ease-out",
            )}
            style={{ width: `${clamped}%` }}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
