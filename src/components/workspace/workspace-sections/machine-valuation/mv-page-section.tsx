"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Compact section shell for Machine Valuation (dense, tool-like layout) */
export function MvPageSection({
  title,
  badge,
  action,
  children,
  className,
}: {
  title: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm",
        className,
      )}
    >
      <div className="flex flex-col gap-1 border-b border-slate-100 bg-slate-50/90 px-2 py-1.5 sm:flex-row sm:items-center sm:justify-between sm:px-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">
            {title}
          </h2>
          {badge != null ? (
            <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded bg-slate-200/90 px-1 text-[10px] font-semibold tabular-nums text-slate-600">
              {badge}
            </span>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-2 sm:p-2.5">{children}</div>
    </section>
  );
}

export function MvMetaPill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded bg-slate-100/90 px-1.5 py-px text-[10px] font-medium tabular-nums text-slate-600",
        className,
      )}
    >
      {children}
    </span>
  );
}
