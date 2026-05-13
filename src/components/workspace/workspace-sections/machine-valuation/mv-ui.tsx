"use client";

import type { ReactNode } from "react";
import Link from "@/components/prefetch-link";
import {
  Check,
  ChevronLeft,
  Circle,
  FileBarChart2,
  FolderKanban,
  Lock,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type MvAssetType = "vehicles" | "machinery" | "electronics" | "furniture" | "other";
export type MvSaveState = "idle" | "saving" | "saved" | "error";
export type MvWorkflowStepId =
  | "import"
  | "review"
  | "classify"
  | "market"
  | "cost"
  | "adjustments"
  | "report";

export const MV_ASSET_TYPE_META: Record<
  MvAssetType,
  { label: string; fill: string; text: string; border: string }
> = {
  vehicles: {
    label: "سيارات",
    fill: "var(--asset-vehicles-fill)",
    text: "var(--asset-vehicles-text)",
    border: "var(--asset-vehicles-border)",
  },
  machinery: {
    label: "معدات",
    fill: "var(--asset-machinery-fill)",
    text: "var(--asset-machinery-text)",
    border: "var(--asset-machinery-border)",
  },
  electronics: {
    label: "أجهزة",
    fill: "var(--asset-electronics-fill)",
    text: "var(--asset-electronics-text)",
    border: "var(--asset-electronics-border)",
  },
  furniture: {
    label: "أثاث",
    fill: "var(--asset-furniture-fill)",
    text: "var(--asset-furniture-text)",
    border: "var(--asset-furniture-border)",
  },
  other: {
    label: "أخرى",
    fill: "var(--asset-other-fill)",
    text: "var(--asset-other-text)",
    border: "var(--asset-other-border)",
  },
};

export const MV_WORKFLOW_STEPS: {
  id: MvWorkflowStepId;
  label: string;
  mobileLabel: string;
}[] = [
  { id: "import", label: "الاستيراد", mobileLabel: "الاستيراد" },
  { id: "review", label: "مراجعة البيانات", mobileLabel: "المراجعة" },
  { id: "classify", label: "تصنيف الأصول", mobileLabel: "التصنيف" },
  { id: "market", label: "نهج السوق", mobileLabel: "السوق" },
  { id: "cost", label: "نهج التكلفة", mobileLabel: "التكلفة" },
  { id: "adjustments", label: "التعديلات", mobileLabel: "التعديلات" },
  { id: "report", label: "التقرير", mobileLabel: "التقرير" },
];

export function formatSarCurrency(value: number) {
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: "SAR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function MvAssetTypeBadge({
  assetType,
  className,
}: {
  assetType: MvAssetType;
  className?: string;
}) {
  const meta = MV_ASSET_TYPE_META[assetType];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-[1.4]",
        className,
      )}
      style={{
        background: meta.fill,
        color: meta.text,
        borderColor: meta.border,
      }}
    >
      {meta.label}
    </span>
  );
}

export function MvStatusBadge({
  label,
  tone,
  className,
}: {
  label: string;
  tone: "success" | "info" | "warning" | "danger";
  className?: string;
}) {
  const tones = {
    success: {
      background: "var(--color-background-success)",
      color: "var(--color-text-success)",
    },
    info: {
      background: "var(--color-background-info)",
      color: "var(--color-text-info)",
    },
    warning: {
      background: "var(--color-background-warning)",
      color: "var(--color-text-warning)",
    },
    danger: {
      background: "var(--color-background-danger)",
      color: "var(--color-text-danger)",
    },
  } as const;

  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium", className)}
      style={tones[tone]}
    >
      {label}
    </span>
  );
}

export interface MvBreadcrumbSegment {
  label: string;
  href?: string;
}

export function MvTopBar({
  breadcrumbs,
  status,
  saveState = "idle",
  onRetry,
  trailing,
  sticky = true,
  compact = false,
  className,
}: {
  breadcrumbs: MvBreadcrumbSegment[];
  status?: ReactNode;
  saveState?: MvSaveState;
  onRetry?: () => void;
  trailing?: ReactNode;
  sticky?: boolean;
  /** شريط أقصر وأضيق للمسار والحالة (إعداد التقرير وغيره) */
  compact?: boolean;
  className?: string;
}) {
  const saveContent =
    saveState === "saving" ? (
      <span className="inline-flex items-center gap-2 text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
        <span className="h-2 w-2 animate-pulse rounded-full bg-[#378ADD]" />
        جاري الحفظ
      </span>
    ) : saveState === "saved" ? (
      <span className="inline-flex items-center gap-2 text-[12px]" style={{ color: "var(--color-text-success)" }}>
        <Save className="h-3.5 w-3.5" />
        تم الحفظ
      </span>
    ) : saveState === "error" ? (
      <span className="inline-flex items-center gap-2 text-[12px]" style={{ color: "var(--color-text-danger)" }}>
        <Circle className="h-2.5 w-2.5 fill-current" />
        خطأ في الحفظ
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md px-2 py-1 text-[11px] font-medium underline-offset-2 hover:underline"
          >
            إعادة المحاولة
          </button>
        ) : null}
      </span>
    ) : null;

  const topBarTrailing = trailing ?? saveContent;

  return (
    <div
      className={cn(
        sticky
          ? "sticky top-14 z-40 border-b bg-[var(--color-background-primary)]"
          : "border-b bg-[var(--color-background-primary)]",
        className,
      )}
      style={{ borderColor: "var(--color-border-tertiary)" }}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between",
          compact
            ? "min-h-7 gap-1.5 px-2.5 py-0.5 md:min-h-7 md:py-0.5"
            : "min-h-12 gap-3 px-5 py-2 md:py-0",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 flex-wrap items-center",
            compact ? "gap-1 text-[10px] leading-tight sm:text-[11px]" : "gap-2 text-[13px]",
          )}
        >
          {breadcrumbs.map((segment, index) => {
            const isLast = index === breadcrumbs.length - 1;

            return (
              <span key={`${segment.label}-${index}`} className="inline-flex min-w-0 items-center gap-2">
                {index > 0 ? (
                  <span
                    className={compact ? "text-[10px] sm:text-[11px]" : "text-[13px]"}
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    ›
                  </span>
                ) : null}
                {isLast || !segment.href ? (
                  <span className="truncate font-medium" style={{ color: "var(--color-text-primary)" }}>
                    {segment.label}
                  </span>
                ) : (
                  <Link
                    href={segment.href}
                    className="truncate transition-colors"
                    style={{ color: "var(--color-text-tertiary)" }}
                  >
                    {segment.label}
                  </Link>
                )}
              </span>
            );
          })}
          {status ? <span className="me-2">{status}</span> : null}
        </div>

        {topBarTrailing ? <div className="ms-auto">{topBarTrailing}</div> : null}
      </div>
    </div>
  );
}

export function MvStepper({
  currentStepId,
  stepStates,
  onStepChange,
  sticky = true,
  variant = "default",
  className,
}: {
  currentStepId: MvWorkflowStepId;
  stepStates?: Partial<Record<MvWorkflowStepId, "completed" | "current" | "pending" | "locked">>;
  onStepChange?: (stepId: MvWorkflowStepId) => void;
  sticky?: boolean;
  /** شريط نصي مضغوط بعرض الشاشة (مثل مسار المشروع) */
  variant?: "default" | "bar";
  className?: string;
}) {
  const currentIndex = MV_WORKFLOW_STEPS.findIndex((step) => step.id === currentStepId);

  if (variant === "bar") {
    return (
      <div
        className={cn(
          sticky
            ? "sticky top-12 z-30 border-b border-slate-200 bg-[var(--color-background-primary)]"
            : "border-b border-slate-200 bg-[var(--color-background-primary)]",
          className,
        )}
        dir="rtl"
      >
        <div className="hidden w-full min-w-0 sm:flex">
          {MV_WORKFLOW_STEPS.map((step, index) => {
            const state =
              stepStates?.[step.id] ??
              (index < currentIndex ? "completed" : index === currentIndex ? "current" : "pending");

            return (
              <div key={step.id} className="flex min-w-0 flex-1 items-stretch">
                {index > 0 ? <div className="my-0.5 w-px shrink-0 self-stretch bg-slate-200" aria-hidden /> : null}
                <button
                  type="button"
                  onClick={() => onStepChange?.(step.id)}
                  disabled={state === "locked"}
                  className={cn(
                    "flex min-h-9 flex-1 items-center justify-center px-1 py-1 text-center text-[10px] font-medium leading-tight transition sm:px-2 sm:text-[11px]",
                    state === "current" && "bg-sky-50 font-semibold text-[#0C447C]",
                    state === "completed" && "text-emerald-800",
                    state === "pending" && "text-slate-500 hover:bg-slate-50",
                    state === "locked" && "cursor-not-allowed opacity-40",
                  )}
                >
                  <span className="line-clamp-2">{step.label}</span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="px-3 py-2 sm:hidden">
          <div className="text-[11px] font-medium" style={{ color: "var(--color-text-primary)" }}>
            {MV_WORKFLOW_STEPS[currentIndex]?.mobileLabel ?? "—"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        sticky
          ? "sticky top-[6.5rem] z-30 border-b bg-[var(--color-background-primary)]"
          : "border-b bg-[var(--color-background-primary)]",
        className,
      )}
      style={{ borderColor: "var(--color-border-tertiary)" }}
    >
      <div className="hidden items-start px-5 py-3 sm:flex">
        {MV_WORKFLOW_STEPS.map((step, index) => {
          const state =
            stepStates?.[step.id] ??
            (index < currentIndex ? "completed" : index === currentIndex ? "current" : "pending");

          const baseCircle =
            state === "completed"
              ? {
                  background: "#EAF3DE",
                  color: "#27500A",
                  border: "1px solid #EAF3DE",
                }
              : state === "current"
                ? {
                    background: "#E6F1FB",
                    color: "#0C447C",
                    border: "1.5px solid #378ADD",
                  }
                : {
                    background: "var(--color-background-secondary)",
                    color: "var(--color-text-tertiary)",
                    border: "1px solid var(--color-border-tertiary)",
                  };

          return (
            <div key={step.id} className="flex min-w-[72px] flex-1 items-start">
              <button
                type="button"
                onClick={() => onStepChange?.(step.id)}
                className="flex min-w-[72px] flex-col items-center text-center"
                disabled={state === "locked"}
              >
                <span
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[12px] font-medium"
                  style={baseCircle}
                >
                  {state === "completed" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : state === "locked" ? (
                    <Lock className="h-2.5 w-2.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className="mt-1 max-w-[68px] text-[10px] leading-tight"
                  style={{
                    color:
                      state === "current"
                        ? "var(--color-text-info)"
                        : "var(--color-text-secondary)",
                    fontWeight: state === "current" ? 500 : 400,
                  }}
                >
                  {step.label}
                </span>
              </button>
              {index < MV_WORKFLOW_STEPS.length - 1 ? (
                <div
                  className="mt-[15px] h-px flex-1"
                  style={{
                    background: state === "completed" ? "#3B6D11" : "var(--color-border-tertiary)",
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="space-y-2 px-5 py-3 sm:hidden">
        <div className="text-[12px] font-medium" style={{ color: "var(--color-text-primary)" }}>
          الخطوة {currentIndex + 1} من {MV_WORKFLOW_STEPS.length} —{" "}
          {MV_WORKFLOW_STEPS[currentIndex]?.mobileLabel}
        </div>
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--color-background-secondary)]">
          <div
            className="h-full rounded-full bg-[#378ADD]"
            style={{ width: `${((currentIndex + 1) / MV_WORKFLOW_STEPS.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function MvMetricCard({
  title,
  value,
  icon,
  hint,
}: {
  title: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border bg-[var(--color-background-secondary)] p-4" style={{ borderColor: "var(--color-border-tertiary)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
            {title}
          </p>
          <div className="text-[28px] font-medium leading-none" style={{ color: "var(--color-text-primary)" }}>
            {value}
          </div>
          {hint ? (
            <p className="text-[11px]" style={{ color: "var(--color-text-tertiary)" }}>
              {hint}
            </p>
          ) : null}
        </div>
        {icon ? <div className="rounded-xl bg-white p-2">{icon}</div> : null}
      </div>
    </div>
  );
}

export function MvEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-2xl border"
        style={{
          borderColor: "var(--color-border-tertiary)",
          color: "var(--color-text-tertiary)",
          background: "var(--color-background-secondary)",
        }}
      >
        {icon ?? <FolderKanban className="h-6 w-6" />}
      </div>
      <div className={description ? "space-y-1" : undefined}>
        <h3 className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>
          {title}
        </h3>
        {description ? (
          <p className="max-w-md text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function MvSectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="space-y-1">
        <h2 className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>
          {title}
        </h2>
        {description ? (
          <p className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function MvRailItem({
  title,
  subtitle,
  active,
  statusDot,
  trailing,
  onClick,
}: {
  title: string;
  subtitle: string;
  active?: boolean;
  statusDot?: string;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full border-b px-3 py-3 text-right transition-colors",
        active && "bg-[#F0F7FF]",
      )}
      style={{
        borderColor: "var(--color-border-tertiary)",
        borderRight: active ? "2.5px solid #378ADD" : "2.5px solid transparent",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="truncate text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>
            {title}
          </div>
          <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--color-text-secondary)" }}>
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: statusDot ?? "var(--color-border-tertiary)" }}
            />
            {subtitle}
          </div>
        </div>
        {trailing}
      </div>
    </button>
  );
}

export function MvMiniPanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-white p-4 shadow-sm" style={{ borderColor: "var(--color-border-tertiary)" }}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon ?? <FileBarChart2 className="h-4 w-4 text-[#378ADD]" />}
          <h3 className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>
            {title}
          </h3>
        </div>
        <ChevronLeft className="h-4 w-4 text-[var(--color-text-tertiary)]" />
      </div>
      {children}
    </section>
  );
}
