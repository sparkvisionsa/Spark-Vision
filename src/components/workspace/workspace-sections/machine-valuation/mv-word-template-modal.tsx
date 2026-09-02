"use client";

import { useEffect, useState } from "react";
import { FileText, Presentation } from "lucide-react";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MvDialogContent } from "./mv-dialog";
import { MvWordTemplatePanel, type MvWordTemplatePanelProps } from "./mv-word-template-panel";
import {
  MvPptxTemplatePanel,
  type MvPptxTemplatePanelProps,
} from "./mv-pptx-template-panel";
import { useMvI18n } from "./mv-i18n";

export type MvReportTemplateTab = "word" | "pptx";

export interface MvWordTemplateModalProps extends MvWordTemplatePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: MvReportTemplateTab;
  /** PowerPoint has its own company-level template availability. */
  pptxTemplateAvailability?: MvPptxTemplatePanelProps["templateAvailability"];
  pptxCompanyTemplateFileName?: MvPptxTemplatePanelProps["companyTemplateFileName"];
}

/** A single report-template dialog with adjacent Word and PowerPoint tabs. */
export function MvWordTemplateModal({
  open,
  onOpenChange,
  initialTab = "word",
  pptxTemplateAvailability,
  pptxCompanyTemplateFileName,
  ...panelProps
}: MvWordTemplateModalProps) {
  const { t, dir } = useMvI18n();
  const [activeTab, setActiveTab] = useState<MvReportTemplateTab>(initialTab);

  useEffect(() => {
    if (open) setActiveTab(initialTab);
  }, [initialTab, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <MvDialogContent
        className="max-h-[min(92vh,820px)] max-w-lg gap-0 overflow-hidden rounded-2xl border-slate-200 p-0 shadow-2xl sm:max-w-xl"
        dir={dir}
      >
        <DialogHeader className="border-b border-slate-100 bg-gradient-to-l from-sky-50 to-white px-5 py-4 pe-14 text-start">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0C447C] text-white shadow-sm">
              {activeTab === "word" ? (
                <FileText className="h-5 w-5" />
              ) : (
                <Presentation className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[15px] font-black text-slate-900">
                {t("report.templateModal.title")}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as MvReportTemplateTab)}
          className="min-h-0"
        >
          <div className="border-b border-slate-100 bg-white px-3 pt-2.5">
            <TabsList className="grid h-9 w-full grid-cols-2 rounded-xl bg-slate-100 p-1">
              <TabsTrigger
                value="word"
                className="gap-1.5 rounded-lg text-[10.5px] font-black data-[state=active]:text-[#0C447C]"
              >
                <FileText className="h-3.5 w-3.5" />
                {t("report.templateModal.word")}
              </TabsTrigger>
              <TabsTrigger
                value="pptx"
                className="gap-1.5 rounded-lg text-[10.5px] font-black data-[state=active]:text-orange-700"
              >
                <Presentation className="h-3.5 w-3.5" />
                {t("report.templateModal.pptx")}
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="max-h-[calc(min(92vh,820px)-7.75rem)] overflow-y-auto bg-slate-50/50 p-3.5">
            <TabsContent value="word" className="m-0">
              <MvWordTemplatePanel {...panelProps} layout="modal" />
            </TabsContent>
            <TabsContent value="pptx" className="m-0">
              <MvPptxTemplatePanel
                {...panelProps}
                layout="modal"
                templateAvailability={pptxTemplateAvailability}
                companyTemplateFileName={pptxCompanyTemplateFileName}
              />
            </TabsContent>
          </div>
        </Tabs>
      </MvDialogContent>
    </Dialog>
  );
}
