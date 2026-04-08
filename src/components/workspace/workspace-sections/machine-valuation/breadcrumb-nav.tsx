"use client";

import { useContext } from "react";
import Link from "@/components/prefetch-link";
import { ChevronRight, Cpu } from "lucide-react";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";

export interface BreadcrumbSegment {
  label: string;
  href: string;
}

interface BreadcrumbNavProps {
  segments: BreadcrumbSegment[];
}

const copy = {
  en: { root: "Machine Valuation" },
  ar: { root: "تقييم الآلات" },
} as const;

export default function BreadcrumbNav({ segments }: BreadcrumbNavProps) {
  const langCtx = useContext(LanguageContext);
  const isArabic = langCtx?.language === "ar";
  const t = isArabic ? copy.ar : copy.en;

  const allSegments: BreadcrumbSegment[] = [
    { label: t.root, href: "/machine-valuation" },
    ...segments,
  ];

  return (
    <nav
      aria-label="breadcrumb"
      className="flex items-center gap-1 text-[11px] font-medium select-none"
    >
      {allSegments.map((seg, i) => {
        const isLast = i === allSegments.length - 1;
        return (
          <span key={seg.href} className="flex items-center gap-1">
            {i === 0 && (
              <Cpu className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
            )}
            {i > 0 && (
              <ChevronRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-slate-400",
                  isArabic && "rotate-180"
                )}
              />
            )}
            {isLast ? (
              <span className="text-slate-800 font-semibold truncate max-w-[220px]">
                {seg.label}
              </span>
            ) : (
              <Link
                href={seg.href}
                className="text-slate-500 hover:text-emerald-600 transition-colors truncate max-w-[200px]"
              >
                {seg.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
