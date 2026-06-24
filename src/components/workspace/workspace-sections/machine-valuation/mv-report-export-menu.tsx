"use client";

import { ChevronDown, Download, FileText, Loader2, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type MvReportExportFormat = "pdf" | "pptx" | "docx";

const FORMAT_OPTIONS: Array<{
  id: MvReportExportFormat;
  label: string;
  hint: string;
  icon: typeof FileText;
  iconClass: string;
}> = [
  {
    id: "pdf",
    label: "PDF",
    hint: "تقرير جاهز للطباعة والمشاركة",
    icon: Download,
    iconClass: "text-[#0C447C]",
  },
  {
    id: "pptx",
    label: "PowerPoint",
    hint: "عرض تقديمي — شريحة لكل صفحة",
    icon: Presentation,
    iconClass: "text-amber-700",
  },
  {
    id: "docx",
    label: "Word",
    hint: "مستند قابل للتعديل",
    icon: FileText,
    iconClass: "text-sky-700",
  },
];

export interface MvReportExportMenuProps {
  disabled?: boolean;
  exportingFormat: MvReportExportFormat | null;
  onExport: (format: MvReportExportFormat) => void;
  variant?: "toolbar" | "preview";
  className?: string;
}

export function MvReportExportMenu({
  disabled = false,
  exportingFormat,
  onExport,
  variant = "toolbar",
  className,
}: MvReportExportMenuProps) {
  const exporting = exportingFormat != null;
  const activeOption = FORMAT_OPTIONS.find((opt) => opt.id === exportingFormat);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          disabled={disabled || exporting}
          className={cn(
            variant === "preview"
              ? "h-8 gap-1.5 bg-[#0C447C] px-3 text-[11px] font-black text-white shadow-sm hover:bg-[#09345f]"
              : "h-8 gap-1.5 border-0 bg-gradient-to-l from-[#0C447C] to-[#0a5a94] px-3 text-[10.5px] font-black text-white shadow-sm hover:from-[#09345f] hover:to-[#084670]",
            className,
          )}
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="max-w-[7rem] truncate sm:max-w-none">
            {exporting ? `تصدير ${activeOption?.label ?? ""}…` : "تصدير"}
          </span>
          {!exporting ? <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-85" /> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[760] min-w-[12.5rem] rounded-xl p-1.5">
        <DropdownMenuLabel className="px-2 py-1 text-[10px] font-black text-slate-500">
          اختر صيغة التصدير
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {FORMAT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = exportingFormat === opt.id;
          return (
            <DropdownMenuItem
              key={opt.id}
              disabled={disabled || (exporting && !isActive)}
              className="cursor-pointer gap-2.5 rounded-lg py-2 pe-3 ps-2"
              onClick={() => onExport(opt.id)}
            >
              {isActive ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-600" />
              ) : (
                <Icon className={cn("h-4 w-4 shrink-0", opt.iconClass)} />
              )}
              <div className="min-w-0 text-right">
                <p className="text-[12px] font-black leading-tight text-slate-900">{opt.label}</p>
                <p className="text-[10px] font-semibold leading-snug text-slate-500">{opt.hint}</p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
