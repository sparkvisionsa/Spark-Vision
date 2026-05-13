"use client";

import Link from "@/components/prefetch-link";
import { FileSpreadsheet, GitBranch, Scale } from "lucide-react";
import { MvProjectReportHeader } from "./mv-simple-report-navigation";
import { MvWorkflowPageFrame, MvWorkflowPageScrollBody } from "./mv-workflow-page-frame";

interface MvValuationPathHubProps {
  projectId: string;
  projectName: string | null;
}

/**
 * أولى صفحات «التقييم»: اختيار استيراد إكسيل مُهيأ أو المتابعة عبر المسار المدمج في النظام.
 * يشبه منطق «تحديد صور الأصول» (خياران من بطاقتين).
 */
export default function MvValuationPathHub({ projectId, projectName }: MvValuationPathHubProps) {
  return (
    <MvWorkflowPageFrame className="bg-[var(--color-background-primary)]" dir="rtl">
      <MvProjectReportHeader
        compact
        projectId={projectId}
        activeStep="valuation-actions"
        breadcrumbs={[
          { label: projectName ?? projectId, href: `/machine-valuation/${projectId}/workflow/report-data` },
          { label: "التقييم", href: `/machine-valuation/${projectId}/workflow/valuation` },
          { label: "اختيار المسار" },
        ]}
      />

      <MvWorkflowPageScrollBody>
        <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-4 px-4 py-3 pb-8">
          <div className="grid gap-4">
            <Link
              href={`/machine-valuation/${projectId}/workflow/valuation/ready-excel`}
              className="flex min-h-[152px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-8 text-center shadow-sm transition hover:border-amber-500 hover:bg-amber-50/50"
            >
              <FileSpreadsheet className="h-12 w-12 text-amber-600" aria-hidden />
              <span className="text-[16px] font-semibold text-slate-900">استيراد إكسيل جاهز</span>
            </Link>

            <Link
              href={`/machine-valuation/${projectId}/workflow/valuation/asset-types`}
              className="flex min-h-[152px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-8 text-center shadow-sm transition hover:border-sky-500 hover:bg-sky-50/40"
            >
              <div className="flex items-center gap-2">
                <Scale className="h-10 w-10 text-sky-600" aria-hidden />
                <GitBranch className="h-6 w-6 text-slate-400" aria-hidden />
              </div>
              <span className="text-[16px] font-semibold text-slate-900">التقييم من خلال النظام</span>
            </Link>
          </div>
        </div>
      </MvWorkflowPageScrollBody>
    </MvWorkflowPageFrame>
  );
}
