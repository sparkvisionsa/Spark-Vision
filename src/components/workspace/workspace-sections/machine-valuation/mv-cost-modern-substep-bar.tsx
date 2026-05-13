"use client";

import { cn } from "@/lib/utils";
import { MV_COST_MODERN_SUBSTEPS } from "./mv-valuation-workflow-model";

interface MvCostModernSubstepBarProps {
  costModernIndex: number;
  onSelect: (index: number) => void;
  className?: string;
}

/** شريط ثانٍ تحت مراحل التقييم: خطوات الأحلال الحديثة فقط */
export default function MvCostModernSubstepBar({
  costModernIndex,
  onSelect,
  className,
}: MvCostModernSubstepBarProps) {
  return (
    <div
      className={cn(
        "border-b border-violet-200/70 bg-gradient-to-l from-violet-100/50 to-white px-3 py-2.5 md:px-5",
        className,
      )}
      dir="rtl"
    >
      <p className="mb-2 text-center text-[10px] font-semibold tracking-wide text-violet-800">
        خطوات الأحلال الحديثة ({costModernIndex + 1} / {MV_COST_MODERN_SUBSTEPS.length})
      </p>
      <nav
        className="flex gap-1 overflow-x-auto pb-0.5 pt-0.5"
        aria-label="خطوات الأحلال الحديثة"
      >
        {MV_COST_MODERN_SUBSTEPS.map((step, i) => {
          const done = i < costModernIndex;
          const current = i === costModernIndex;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelect(i)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-medium transition",
                current &&
                  "border-violet-600 bg-white font-semibold text-violet-900 shadow-sm ring-1 ring-violet-200",
                done && !current && "border-emerald-400 bg-emerald-50 text-emerald-900",
                !done && !current && "border-slate-200/90 bg-white/80 text-slate-500 hover:border-violet-300",
              )}
            >
              {i + 1}. {step.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
