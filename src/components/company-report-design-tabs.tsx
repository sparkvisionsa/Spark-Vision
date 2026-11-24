"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FileText, MonitorUp, Palette, PenLine } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type CompanyReportDesignTab = "system" | "letterhead" | "word" | "pptx";

type Props = {
  initialTab?: CompanyReportDesignTab;
  systemTemplates: ReactNode;
  reportSections: ReactNode;
  companyLetterhead: ReactNode;
  wordTemplates: ReactNode;
  pptxTemplates: ReactNode;
};

const tabClass = cn(
  "h-10 rounded-none border-b-2 border-transparent bg-transparent px-3 text-[11px] font-black text-slate-500 shadow-none",
  "hover:text-slate-900 data-[state=active]:border-[#0C447C] data-[state=active]:bg-transparent data-[state=active]:text-[#0C447C] data-[state=active]:shadow-none sm:px-5",
);

export function CompanyReportDesignTabs({
  initialTab = "system",
  systemTemplates,
  reportSections,
  companyLetterhead,
  wordTemplates,
  pptxTemplates,
}: Props) {
  const [tab, setTab] = useState<CompanyReportDesignTab>(initialTab);
  const [systemTab, setSystemTab] = useState<"templates" | "sections">("templates");

  useEffect(() => setTab(initialTab), [initialTab]);

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as CompanyReportDesignTab)} dir="rtl">
      <TabsList className="grid h-auto w-full grid-cols-2 rounded-none border-b border-slate-200 bg-transparent p-0 sm:grid-cols-4">
        <TabsTrigger value="system" className={tabClass}>
          <Palette className="ml-1.5 h-3.5 w-3.5" />
          قوالب النظام
        </TabsTrigger>
        <TabsTrigger value="letterhead" className={tabClass}>
          <PenLine className="ml-1.5 h-3.5 w-3.5" />
          قالب كليشة الشركة
        </TabsTrigger>
        <TabsTrigger value="word" className={tabClass}>
          <FileText className="ml-1.5 h-3.5 w-3.5" />
          قالب Word
        </TabsTrigger>
        <TabsTrigger value="pptx" className={tabClass}>
          <MonitorUp className="ml-1.5 h-3.5 w-3.5" />
          قالب PowerPoint
        </TabsTrigger>
      </TabsList>

      <TabsContent value="system" className="mt-3 outline-none">
        <Tabs value={systemTab} onValueChange={(value) => setSystemTab(value as "templates" | "sections")} dir="rtl">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-none border-b border-slate-200 bg-transparent p-0">
            <TabsTrigger value="templates" className={tabClass}>قالب النظام</TabsTrigger>
            <TabsTrigger value="sections" className={tabClass}>أقسام وتعريفات التقرير</TabsTrigger>
          </TabsList>
          <TabsContent value="templates" className="mt-3 outline-none">{systemTemplates}</TabsContent>
          <TabsContent value="sections" className="mt-3 outline-none">{reportSections}</TabsContent>
        </Tabs>
      </TabsContent>
      <TabsContent value="letterhead" className="mt-3 outline-none">{companyLetterhead}</TabsContent>
      <TabsContent value="word" className="mt-3 outline-none">{wordTemplates}</TabsContent>
      <TabsContent value="pptx" className="mt-3 outline-none">{pptxTemplates}</TabsContent>
    </Tabs>
  );
}
