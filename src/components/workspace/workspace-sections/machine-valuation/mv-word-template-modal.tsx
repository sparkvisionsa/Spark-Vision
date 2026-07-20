"use client";

import { FileType } from "lucide-react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MvDialogContent } from "./mv-dialog";
import { MvWordTemplatePanel, type MvWordTemplatePanelProps } from "./mv-word-template-panel";

export interface MvWordTemplateModalProps extends MvWordTemplatePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MvWordTemplateModal({
  open,
  onOpenChange,
  ...panelProps
}: MvWordTemplateModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <MvDialogContent className="max-h-[min(92vh,760px)] max-w-lg gap-0 overflow-hidden rounded-2xl border-slate-200 p-0 shadow-2xl sm:max-w-xl">
        <DialogHeader className="border-b border-slate-100 bg-gradient-to-l from-sky-50 to-white px-5 py-4 pe-14 text-start">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0C447C] text-white shadow-sm">
              <FileType className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[15px] font-black text-slate-900">
                تحديث تقرير Word من بيانات المشروع
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[calc(min(92vh,760px)-4.75rem)] overflow-y-auto bg-slate-50/50 p-3.5">
          <MvWordTemplatePanel {...panelProps} layout="modal" />
        </div>
      </MvDialogContent>
    </Dialog>
  );
}
