"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { MvProjectWorkflowStatus } from "./types";
import { MvStatusBadge } from "./mv-ui";

export type MvProjectWorkflowStatusOption = {
  value: MvProjectWorkflowStatus;
  labelAr: string;
  labelEn: string;
};

export const MV_PROJECT_WORKFLOW_STATUS_FALLBACK: MvProjectWorkflowStatusOption[] = [
  { value: "new", labelAr: "جديد", labelEn: "New" },
  { value: "review", labelAr: "قيد المراجعة", labelEn: "Under review" },
  { value: "approved", labelAr: "معتمد", labelEn: "Approved" },
];

function getStatusTone(status: MvProjectWorkflowStatus): "info" | "warning" | "success" {
  if (status === "approved") return "success";
  if (status === "review") return "warning";
  return "info";
}

function labelForStatus(
  status: MvProjectWorkflowStatus,
  options: MvProjectWorkflowStatusOption[],
  isArabic: boolean,
) {
  const match = options.find((option) => option.value === status);
  if (!match) return status;
  return isArabic ? match.labelAr : match.labelEn;
}

export function MvProjectWorkflowStatusSelect({
  projectId,
  value,
  options,
  isArabic = true,
  disabled = false,
  onChange,
  className,
}: {
  projectId: string;
  value: MvProjectWorkflowStatus;
  options: MvProjectWorkflowStatusOption[];
  isArabic?: boolean;
  disabled?: boolean;
  onChange: (projectId: string, nextStatus: MvProjectWorkflowStatus) => Promise<boolean>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSelect = async (nextStatus: MvProjectWorkflowStatus) => {
    if (nextStatus === value || saving || disabled) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      const ok = await onChange(projectId, nextStatus);
      if (ok) setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={(next) => !saving && setOpen(next)}>
      <DropdownMenuTrigger
        disabled={disabled || saving}
        className={cn(
          "inline-flex max-w-full items-center gap-0.5 rounded-full outline-none transition",
          "focus-visible:ring-2 focus-visible:ring-cyan-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
          (disabled || saving) && "cursor-not-allowed opacity-70",
          className,
        )}
        aria-label="تغيير حالة المشروع"
        onClick={(event) => event.stopPropagation()}
      >
        <MvStatusBadge
          label={labelForStatus(value, options, isArabic)}
          tone={getStatusTone(value)}
          className="whitespace-nowrap px-2 py-0.5 text-[10px]"
        />
        {saving ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-slate-400" aria-hidden />
        ) : (
          <ChevronDown className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10.5rem] rounded-lg p-1">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            className="cursor-pointer gap-2 text-[12px] font-semibold"
            onSelect={(event) => {
              event.preventDefault();
              void handleSelect(option.value);
            }}
          >
            <MvStatusBadge
              label={isArabic ? option.labelAr : option.labelEn}
              tone={getStatusTone(option.value)}
              className="whitespace-nowrap px-1.5 py-0.5 text-[10px]"
            />
            {option.value === value ? <Check className="ms-auto h-3.5 w-3.5 text-cyan-600" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
