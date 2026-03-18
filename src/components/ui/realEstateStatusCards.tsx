"use client";

import { useContext } from "react";
import {
  FileText,
  Eye,
  ClipboardList,
  SearchCheck,
  BadgeCheck,
  SendHorizonal,
  XCircle,
  Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";

type StatusCardData = {
  key: string;
  label: { en: string; ar: string };
  icon: LucideIcon;
  color: {
    bg: string;
    icon: string;
    border: string;
    number: string;
  };
};

export const STATUS_CARDS: StatusCardData[] = [
  {
    key: "new",
    label: { en: "New", ar: "جديدة" },
    icon: FileText,
    color: {
      bg: "bg-blue-50",
      icon: "text-blue-500",
      border: "border-blue-100",
      number: "text-blue-700",
    },
  },
  {
    key: "inspection",
    label: { en: "Inspection", ar: "المعاينة" },
    icon: Eye,
    color: {
      bg: "bg-violet-50",
      icon: "text-violet-500",
      border: "border-violet-100",
      number: "text-violet-700",
    },
  },
  {
    key: "review",
    label: { en: "Review", ar: "المراجعة" },
    icon: ClipboardList,
    color: {
      bg: "bg-amber-50",
      icon: "text-amber-500",
      border: "border-amber-100",
      number: "text-amber-700",
    },
  },
  {
    key: "audit",
    label: { en: "Audit", ar: "التدقيق" },
    icon: SearchCheck,
    color: {
      bg: "bg-orange-50",
      icon: "text-orange-500",
      border: "border-orange-100",
      number: "text-orange-700",
    },
  },
  {
    key: "approved",
    label: { en: "Approved", ar: "معتمدة" },
    icon: BadgeCheck,
    color: {
      bg: "bg-emerald-50",
      icon: "text-emerald-500",
      border: "border-emerald-100",
      number: "text-emerald-700",
    },
  },
  {
    key: "sent",
    label: { en: "Sent", ar: "مرسلة" },
    icon: SendHorizonal,
    color: {
      bg: "bg-cyan-50",
      icon: "text-cyan-500",
      border: "border-cyan-100",
      number: "text-cyan-700",
    },
  },
  {
    key: "cancelled",
    label: { en: "Cancelled", ar: "ملغية" },
    icon: XCircle,
    color: {
      bg: "bg-red-50",
      icon: "text-red-500",
      border: "border-red-100",
      number: "text-red-700",
    },
  },
  {
    key: "pending",
    label: { en: "Pending", ar: "معلقة" },
    icon: Clock,
    color: {
      bg: "bg-slate-50",
      icon: "text-slate-400",
      border: "border-slate-200",
      number: "text-slate-600",
    },
  },
];

// --- Single card ---

type ValuationStatusCardProps = {
  label: string;
  count: number;
  icon: LucideIcon;
  color: StatusCardData["color"];
  className?: string;
};

export function ValuationStatusCard({
  label,
  count,
  icon: Icon,
  color,
  className,
}: ValuationStatusCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border px-4 py-3 shadow-sm transition-shadow hover:shadow-md",
        color.bg,
        color.border,
        className,
      )}
    >
      <div className={cn("rounded-lg p-1.5", color.bg)}>
        <Icon className={cn("h-6 w-6 sm:h-8 sm:w-8", color.icon)} strokeWidth={1.75} />
      </div>
      <span
        className={cn(
          "text-xl font-bold leading-none tabular-nums sm:text-2xl",
          color.number,
        )}
      >
        {count}
      </span>
      <span className="text-center text-[10px] font-medium leading-tight text-slate-500 sm:text-[11px]">
        {label}
      </span>
    </div>
  );
}

// --- Card strip ---

type CountMap = Partial<Record<string, number>>;

type ValuationStatusStripProps = {
  counts?: CountMap;
  className?: string;
};

export function ValuationStatusStrip({
  counts = {},
  className,
}: ValuationStatusStripProps) {
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "en";

  return (
    <div className={cn("grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-8", className)}>
      {STATUS_CARDS.map((card) => (
        <ValuationStatusCard
          key={card.key}
          label={card.label[language]}
          count={counts[card.key] ?? 0}
          icon={card.icon}
          color={card.color}
        />
      ))}
    </div>
  );
}
