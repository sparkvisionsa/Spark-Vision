"use client";

import { useState, useContext, Fragment } from "react";
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


// ─── Pair board (four linked-status frames) ───────────────────────────────────

type PairState = {
  key: string;
  color: string;
  label: { en: string; ar: string };
  note: { en: string; ar: string };
};

type PairFrameData = {
  a: string;
  b: string;
  title: { en: string; ar: string };
  subtitle: { en: string; ar: string };
  states: [PairState, PairState];
};

const PAIR_FRAMES: PairFrameData[] = [
  {
    a: "#ef8c2d",
    b: "#2f83e6",
    title: { en: "Intake & Inspection", ar: "الاستلام والمعاينة" },
    subtitle: { en: "File start stage", ar: "مرحلة بدء الملف" },
    states: [
      {
        key: "new",
        color: "#ef8c2d",
        label: { en: "New", ar: "جديدة" },
        note: { en: "Incoming requests", ar: "طلبات واردة" },
      },
      {
        key: "inspection",
        color: "#2f83e6",
        label: { en: "Inspection", ar: "المعاينة" },
        note: { en: "Data collection", ar: "جمع البيانات" },
      },
    ],
  },
  {
    a: "#7a56d8",
    b: "#13abc7",
    title: { en: "Quality Control", ar: "ضبط الجودة" },
    subtitle: { en: "Report inspection & review", ar: "فحص ومراجعة التقرير" },
    states: [
      {
        key: "review",
        color: "#7a56d8",
        label: { en: "Review", ar: "المراجعة" },
        note: { en: "Initial review", ar: "مراجعة أولية" },
      },
      {
        key: "audit",
        color: "#13abc7",
        label: { en: "Audit", ar: "التدقيق" },
        note: { en: "Final audit", ar: "تدقيق نهائي" },
      },
    ],
  },
  {
    a: "#20ad68",
    b: "#c8873d",
    title: { en: "Completion & Delivery", ar: "الإنجاز والتسليم" },
    subtitle: { en: "Completed outputs", ar: "المخرجات المكتملة" },
    states: [
      {
        key: "approved",
        color: "#20ad68",
        label: { en: "Approved", ar: "معتمدة" },
        note: { en: "Ready to send", ar: "جاهزة للإرسال" },
      },
      {
        key: "sent",
        color: "#c8873d",
        label: { en: "Sent", ar: "مرسلة" },
        note: { en: "Delivery complete", ar: "اكتمل التسليم" },
      },
    ],
  },
  {
    a: "#7b8797",
    b: "#ed4b5e",
    title: { en: "Exceptions", ar: "الاستثناءات" },
    subtitle: { en: "Needs a decision", ar: "حالات تحتاج قرارًا" },
    states: [
      {
        key: "pending",
        color: "#7b8797",
        label: { en: "Pending", ar: "معلقة" },
        note: { en: "Needs follow-up", ar: "تحتاج متابعة" },
      },
      {
        key: "cancelled",
        color: "#ed4b5e",
        label: { en: "Cancelled", ar: "ملغية" },
        note: { en: "Path stopped", ar: "توقف المسار" },
      },
    ],
  },
];

type ValuationStatusPairBoardProps = {
  counts?: CountMap;
  activeStatus?: string | null;
  onStatusClick?: (status: string | null) => void;
  className?: string;
};

type TaqeemStatus = {
  key: string;
  color: string;
  label: { en: string; ar: string };
};

const TAQEEM_STATUSES: TaqeemStatus[] = [
  { key: "new", color: "#ef8c2d", label: { en: "New", ar: "جديد" } },
  {
    key: "submitted",
    color: "#2f83e6",
    label: { en: "Sent to Taqeem", ar: "مُرسلة إلى تقييم" },
  },
  {
    key: "sent-approver",
    color: "#7a56d8",
    label: { en: "Sent to Approver", ar: "مرسلة إلى المعتمد" },
  },
  {
    key: "approved",
    color: "#20ad68",
    label: { en: "Approved", ar: "معتمدة" },
  },
];



export function ValuationStatusPairBoard({
  counts = {},
  activeStatus,
  onStatusClick,
  className,
}: ValuationStatusPairBoardProps) {
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "en";
  const isRtl = language === "ar";

  const total = Object.values(counts).reduce((sum, n) => sum + (n ?? 0), 0);

  const [activeTaqeem, setActiveTaqeem] = useState<string | null>(null);

  const handleClick = (key: string) => {
    if (!onStatusClick) return;
    onStatusClick(activeStatus === key ? null : key);
  };

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_7px_22px_rgba(32,55,95,0.045)]",
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{isRtl ? "إجمالي المعاملات" : "Total transactions"}</span>
          <strong className="text-sm text-slate-800 tabular-nums">
            {total}
          </strong>
        </div>
        <button
          type="button"
          onClick={() => onStatusClick?.(null)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:border-cyan-300 hover:text-cyan-700",
            !activeStatus && "border-cyan-400 text-cyan-700",
          )}
        >
          {isRtl ? "عرض الكل" : "Show all"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PAIR_FRAMES.map((frame, i) => (
          <div
            key={i}
            className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 p-3.5"
            style={{
              background: `linear-gradient(145deg, ${frame.a}0d, ${frame.b}0a)`,
            }}
          >
            <div
               className="pointer-events-none absolute -bottom-[55px] -start-[25px] h-[130px] w-[130px] rounded-full"
               style={{ backgroundColor: `${frame.b}12` }}
             />
            <div className="mb-3 flex items-center justify-between gap-2">
              <strong className="text-[13px] text-slate-800">
                {frame.title[language]}
              </strong>
              <span className="whitespace-nowrap text-[11px] text-slate-400">
                {frame.subtitle[language]}
              </span>
            </div>
            <div className="mt-auto grid grid-cols-[1fr_1px_1fr] items-stretch gap-2">
              {frame.states.map((s, idx) => (
                <Fragment key={s.key}>
                  {idx === 1 && (
                    <div
                      key={`div-${i}`}
                      className="bg-gradient-to-b from-transparent via-slate-200 to-transparent"
                    />
                  )}
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => handleClick(s.key)}
                    className={cn(
                      "flex flex-col items-start rounded-xl px-2 py-1.5 text-start transition-all hover:-translate-y-0.5",
                      activeStatus === s.key && "shadow-sm",
                    )}
                    style={{
                      backgroundColor:
                        activeStatus === s.key ? `${s.color}14` : "transparent",
                    }}
                  >
                    <span
                      className="mb-2.5 h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: s.color,
                        boxShadow: `0 0 0 5px ${s.color}1f`,
                      }}
                    />
                    <b className="text-2xl font-extrabold leading-none tabular-nums text-slate-800">

                      {counts[s.key] ?? 0}
                    </b>
                    <span
                      className="mt-2 text-xs font-extrabold"
                      style={{ color: s.color }}
                    >
                      {s.label[language]}
                    </span>
                    <small className="mt-0.5 text-[10px] text-slate-400">
                      {s.note[language]}
                    </small>
                  </button>
                </Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Taqeem statuses — visual only for now, no wiring */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2.5 border-t border-slate-100 pt-3.5">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
          {isRtl ? "حالات تقييم" : "Taqeem Statuses"}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          {TAQEEM_STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() =>
                setActiveTaqeem((prev) => (prev === s.key ? null : s.key))
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-bold text-slate-700 transition-colors",
                activeTaqeem === s.key && "text-white",
              )}
              style={
                activeTaqeem === s.key
                  ? { backgroundColor: s.color, borderColor: s.color }
                  : undefined
              }
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: activeTaqeem === s.key ? "#fff" : s.color }}
              />
              {s.label[language]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
