"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MV_MAIN_WORKFLOW_STEPS,
  type MvMainWorkflowSlug,
  mainWorkflowStepIndex,
} from "./mv-main-workflow-model";
import {
  MV_MAIN_WORKFLOW_PROGRESS_EVENT,
  readCompletedMainPhases,
} from "./mv-main-workflow-progress";

interface MvMainPipelineStepperProps {
  projectId: string;
  currentSlug: MvMainWorkflowSlug;
  className?: string;
}

/** شريط مسار رئيسي: ترقيم، أسهم نحو التالي، أخضر بعد «حفظ والتالي»، كهرماني/رمادي إن تخطّيت دون حفظ */
export default function MvMainPipelineStepper({
  projectId,
  currentSlug,
  className,
}: MvMainPipelineStepperProps) {
  const currentIdx = mainWorkflowStepIndex(currentSlug);
  const [completed, setCompleted] = useState<MvMainWorkflowSlug[]>([]);

  const refreshCompleted = useCallback(() => {
    setCompleted(readCompletedMainPhases(projectId));
  }, [projectId]);

  useEffect(() => {
    refreshCompleted();
    window.addEventListener(MV_MAIN_WORKFLOW_PROGRESS_EVENT, refreshCompleted);
    return () => window.removeEventListener(MV_MAIN_WORKFLOW_PROGRESS_EVENT, refreshCompleted);
  }, [refreshCompleted]);

  const completedSet = new Set(completed);

  return (
    <nav
      className={cn(
        "flex w-full min-w-0 flex-nowrap items-center justify-center gap-0 border-b border-slate-200 bg-[var(--color-background-primary)] px-1 py-2 sm:px-2",
        className,
      )}
      aria-label="المسار الرئيسي"
      dir="rtl"
    >
      {MV_MAIN_WORKFLOW_STEPS.map((step, index) => {
        const isCurrent = step.slug === currentSlug;
        const isPast = index < currentIdx;
        const savedHere = completedSet.has(step.slug);
        const pendingPast = isPast && !savedHere;

        const circleClass = cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums transition-colors",
          isCurrent && "bg-sky-600 text-white ring-2 ring-sky-200",
          !isCurrent && savedHere && "bg-emerald-600 text-white",
          !isCurrent && !savedHere && pendingPast && "border border-amber-400 bg-amber-50 text-amber-800",
          !isCurrent && !savedHere && !pendingPast && "bg-slate-200 text-slate-600",
        );

        const labelClass = cn(
          "mt-0.5 line-clamp-2 text-center text-[10px] font-medium leading-tight transition-colors sm:text-[11px]",
          isCurrent && "font-semibold text-[#0C447C]",
          !isCurrent && savedHere && "text-emerald-800",
          !isCurrent && !savedHere && pendingPast && "text-amber-800",
          !isCurrent && !savedHere && !pendingPast && "text-slate-500",
        );

        return (
          <Fragment key={step.slug}>
            {index > 0 ? (
              <ChevronLeft
                className="mx-0.5 h-4 w-4 shrink-0 text-slate-300 sm:mx-1 sm:h-[18px] sm:w-[18px]"
                aria-hidden
                strokeWidth={2.25}
              />
            ) : null}
            <div
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center rounded-lg px-1 py-1 sm:px-2",
                isCurrent && "bg-sky-50/90",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span className={circleClass}>{index + 1}</span>
              <span className={labelClass}>{step.shortLabel}</span>
            </div>
          </Fragment>
        );
      })}
    </nav>
  );
}
