"use client";

import { cn } from "@/lib/utils";
import {
  MV_VALUATION_PHASES,
  type MvValuationPhaseSlug,
  valuationPhaseIndex,
} from "./mv-valuation-workflow-model";

interface MvValuationPhaseStepperProps {
  /** محجوز للتوافق — التنقل يتم من جدول المشاريع فقط */
  projectId?: string;
  currentPhase: MvValuationPhaseSlug;
  className?: string;
}

export default function MvValuationPhaseStepper({
  currentPhase,
  className,
}: MvValuationPhaseStepperProps) {
  if (currentPhase === "hub" || currentPhase === "ready-excel") {
    return null;
  }
  const currentIndex = valuationPhaseIndex(currentPhase);

  return (
    <div
      className={cn(
        "border-b border-violet-200/80 bg-gradient-to-l from-violet-50/90 to-white px-3 py-3 md:px-5",
        className,
      )}
      dir="rtl"
    >
      <p className="mb-2 text-center text-[10px] font-semibold tracking-wide text-violet-700">
        مراحل التقييم
      </p>
      <nav
        className="flex flex-wrap items-center justify-center gap-1.5 md:gap-2"
        aria-label="مراحل التقييم الفرعية"
      >
        {MV_VALUATION_PHASES.map((phase, index) => {
          const isCurrent = phase.slug === currentPhase;
          const isDone = index < currentIndex;

          return (
            <div
              key={phase.slug}
              className={cn(
                "flex min-w-0 max-w-[8rem] flex-col items-center gap-1 rounded-xl border px-1.5 py-2 text-center md:max-w-[10rem] md:px-2",
                isCurrent &&
                  "border-violet-500 bg-violet-100/90 text-violet-950 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.35)]",
                !isCurrent && isDone && "border-emerald-300 bg-emerald-50/90 text-emerald-900",
                !isCurrent && !isDone && "border-slate-200/90 bg-white text-slate-500",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  isCurrent && "bg-violet-600 text-white",
                  !isCurrent && isDone && "bg-emerald-600 text-white",
                  !isCurrent && !isDone && "border border-slate-200 bg-slate-50 text-slate-500",
                )}
              >
                {isDone ? "✓" : index + 1}
              </span>
              <span className="line-clamp-2 text-[10px] font-medium leading-tight md:text-[11px]">
                {phase.shortLabel}
              </span>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
