"use client";

import { FileType } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
      <DialogContent className="max-h-[min(92vh,820px)] max-w-lg gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="border-b border-slate-100 bg-gradient-to-b from-sky-50/90 to-white px-4 py-3 text-right">
          <div className="flex items-start gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0C447C]/10 text-[#0C447C]">
              <FileType className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-black text-slate-900">
                تحديث تقرير Word من بيانات المشروع
              </DialogTitle>
              <DialogDescription className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-600">
                سيتم استخدام قالب Word المحفوظ في إعدادات الشركة، ثم ملء الإشارات المرجعية
                (Bookmarks) ببيانات وصور المشروع وتنزيل التقرير تلقائياً.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="max-h-[calc(min(92vh,820px)-5.5rem)] overflow-y-auto px-3 py-3">
          <MvWordTemplatePanel {...panelProps} layout="modal" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
