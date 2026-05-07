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
    border: string;
    iconBg: string;
    iconColor: string;
    number: string;
    dot: string;
    label: string;
    bar: string;
  };
};

export const STATUS_CARDS: StatusCardData[] = [
  {
    key: "new",
    label: { en: "New", ar: "جديدة" },
    icon: FileText,
    color: {
      bg: "bg-blue-100",
      border: "border-blue-200",
      iconBg: "bg-blue-200",
      iconColor: "text-blue-700",
      number: "text-blue-800",
      dot: "bg-blue-400",
      label: "text-blue-800",
      bar: "bg-blue-700",
    },
  },
  {
    key: "inspection",
    label: { en: "Inspection", ar: "المعاينة" },
    icon: Eye,
    color: {
      bg: "bg-violet-100",
      border: "border-violet-200",
      iconBg: "bg-violet-200",
      iconColor: "text-violet-700",
      number: "text-violet-800",
      dot: "bg-violet-400",
      label: "text-violet-800",
      bar: "bg-violet-700",
    },
  },
  {
    key: "review",
    label: { en: "Review", ar: "المراجعة" },
    icon: ClipboardList,
    color: {
      bg: "bg-amber-100",
      border: "border-amber-200",
      iconBg: "bg-amber-200",
      iconColor: "text-amber-700",
      number: "text-amber-800",
      dot: "bg-amber-400",
      label: "text-amber-800",
      bar: "bg-amber-700",
    },
  },
  {
    key: "audit",
    label: { en: "Audit", ar: "التدقيق" },
    icon: SearchCheck,
    color: {
      bg: "bg-orange-100",
      border: "border-orange-200",
      iconBg: "bg-orange-200",
      iconColor: "text-orange-700",
      number: "text-orange-800",
      dot: "bg-orange-400",
      label: "text-orange-800",
      bar: "bg-orange-700",
    },
  },
  {
    key: "approved",
    label: { en: "Approved", ar: "معتمدة" },
    icon: BadgeCheck,
    color: {
      bg: "bg-emerald-100",
      border: "border-emerald-200",
      iconBg: "bg-emerald-200",
      iconColor: "text-emerald-700",
      number: "text-emerald-800",
      dot: "bg-emerald-400",
      label: "text-emerald-800",
      bar: "bg-emerald-700",
    },
  },
  {
    key: "sent",
    label: { en: "Sent", ar: "مرسلة" },
    icon: SendHorizonal,
    color: {
      bg: "bg-cyan-100",
      border: "border-cyan-200",
      iconBg: "bg-cyan-200",
      iconColor: "text-cyan-700",
      number: "text-cyan-800",
      dot: "bg-cyan-400",
      label: "text-cyan-800",
      bar: "bg-cyan-700",
    },
  },
  {
    key: "cancelled",
    label: { en: "Cancelled", ar: "ملغية" },
    icon: XCircle,
    color: {
      bg: "bg-red-100",
      border: "border-red-200",
      iconBg: "bg-red-200",
      iconColor: "text-red-700",
      number: "text-red-800",
      dot: "bg-red-400",
      label: "text-red-800",
      bar: "bg-red-700",
    },
  },
  {
    key: "pending",
    label: { en: "Pending", ar: "معلقة" },
    icon: Clock,
    color: {
      bg: "bg-slate-200",
      border: "border-slate-300",
      iconBg: "bg-slate-300",
      iconColor: "text-slate-600",
      number: "text-slate-700",
      dot: "bg-slate-500",
      label: "text-slate-700",
      bar: "bg-slate-600",
    },
  },
];

// --- Single card ---

type ValuationStatusCardProps = {
  label: string;
  count: number;
  icon: LucideIcon;
  color: StatusCardData["color"];
  isActive: boolean;
  onClick: () => void;
  className?: string;
};

export function ValuationStatusCard({
  label,
  count,
  icon: Icon,
  color,
  isActive,
  onClick,
  className,
}: ValuationStatusCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-4 pb-5 text-start transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400",
        color.bg,
        color.border,
        isActive && "shadow-md",
        className,
      )}
    >
      {/* Icon + count */}
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            color.iconBg,
          )}
        >
          <Icon
            className={cn("h-[18px] w-[18px]", color.iconColor)}
            strokeWidth={1.75}
          />
        </div>
        <span
          className={cn(
            "text-2xl font-bold tabular-nums leading-none",
            color.number,
          )}
        >
          {count}
        </span>
      </div>

      {/* Dot + label */}
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", color.dot)} />
        <span
          className={cn("text-xs font-semibold leading-tight", color.label)}
        >
          {label}
        </span>
      </div>

      {/* Small pill bar — only visible when active */}
      <span
        className={cn(
          "absolute bottom-2 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full transition-all duration-200",
          color.bar,
          isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0",
        )}
      />
    </button>
  );
}

// --- Card strip ---

type CountMap = Partial<Record<string, number>>;

type ValuationStatusStripProps = {
  counts?: CountMap;
  activeStatus?: string | null;
  onStatusClick?: (status: string | null) => void;
  className?: string;
};

export function ValuationStatusStrip({
  counts = {},
  activeStatus,
  onStatusClick,
  className,
}: ValuationStatusStripProps) {
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "en";

  const handleClick = (key: string) => {
    if (!onStatusClick) return;
    onStatusClick(activeStatus === key ? null : key);
  };

  return (
    <div
      className={cn(
        "grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-8",
        className,
      )}
    >
      {STATUS_CARDS.map((card) => (
        <ValuationStatusCard
          key={card.key}
          label={card.label[language]}
          count={counts[card.key] ?? 0}
          icon={card.icon}
          color={card.color}
          isActive={activeStatus === card.key}
          onClick={() => handleClick(card.key)}
        />
      ))}
    </div>
  );
}
