"use client";

import { useContext, useState } from "react";
import { FileUp, Table2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";

const copy = {
  en: {
    label: "Add Data",
    importFile: "Import file (Excel / PDF / Word)",
    createSheet: "New spreadsheet",
  },
  ar: {
    label: "إضافة بيانات",
    importFile: "استيراد ملف (Excel / PDF / Word)",
    createSheet: "جدول جديد",
  },
} as const;

interface DataImportSelectorProps {
  onSelectImport: () => void;
  onSelectCreate: () => void;
}

export default function DataImportSelector({
  onSelectImport,
  onSelectCreate,
}: DataImportSelectorProps) {
  const langCtx = useContext(LanguageContext);
  const isArabic = langCtx?.language === "ar";
  const t = isArabic ? copy.ar : copy.en;
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold",
            "bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-sm shadow-emerald-500/15",
            "ring-1 ring-emerald-500/20 ring-offset-1 ring-offset-white",
            "hover:from-emerald-500 hover:to-teal-500 hover:shadow-md",
            "active:scale-[0.99] transition-all duration-200",
          )}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/15">
            <Table2 className="h-3.5 w-3.5" />
          </span>
          {t.label}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 opacity-90 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[min(100vw-2rem,20rem)] rounded-lg border border-slate-200/90 p-1 shadow-lg"
      >
        <DropdownMenuItem
          onClick={onSelectImport}
          className={cn(
            "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-[11px] font-semibold",
            "text-slate-800 outline-none",
            "data-[highlighted]:bg-sky-100 data-[highlighted]:text-slate-900",
            "focus:bg-sky-100 focus:text-slate-900",
          )}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-700 transition-colors group-data-[highlighted]:bg-sky-200/90">
            <FileUp className="h-3.5 w-3.5 text-sky-700" />
          </span>
          <span className="min-w-0 leading-tight">{t.importFile}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onSelectCreate}
          className={cn(
            "group mt-0.5 flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-[11px] font-semibold",
            "text-slate-800 outline-none",
            "data-[highlighted]:bg-emerald-100 data-[highlighted]:text-slate-900",
            "focus:bg-emerald-100 focus:text-slate-900",
          )}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-800 transition-colors group-data-[highlighted]:bg-emerald-200/90">
            <Table2 className="h-3.5 w-3.5 text-emerald-800" />
          </span>
          <span className="min-w-0 leading-tight">{t.createSheet}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
