"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Calculator, FileText, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { MvProjectReportHeader, MvSimpleReportStepNavigation } from "./mv-simple-report-navigation";
import { MvWorkflowPageFrame } from "./mv-workflow-page-frame";
import { useMvI18n } from "./mv-i18n";

type AttachmentTab = "valuation" | "client" | "certificate";

function MvAttachmentPanelLoading() {
  return (
    <div className="flex min-h-[14rem] items-center justify-center p-4 text-[11px] font-bold text-slate-500">
      جارٍ تجهيز المرفقات…
    </div>
  );
}

const MvValuationAccountingWorkspace = dynamic(
  () => import("./mv-valuation-accounting-workspace"),
  { loading: () => <MvAttachmentPanelLoading /> },
);

const MvClientFilesWorkspace = dynamic(
  () => import("./mv-client-files-workspace"),
  { loading: () => <MvAttachmentPanelLoading /> },
);

function tabFromHash(): AttachmentTab {
  if (typeof window === "undefined") return "valuation";
  const value = window.location.hash.replace("#", "");
  if (value === "client" || value === "certificate") return value;
  return "valuation";
}

const attachmentTabs = [
  {
    id: "valuation" as const,
    title: "حسابات القيمة",
    icon: Calculator,
    iconClassName: "bg-sky-100 text-sky-700",
  },
  {
    id: "client" as const,
    title: "ملفات العميل",
    icon: FileText,
    iconClassName: "bg-violet-100 text-violet-700",
  },
  {
    id: "certificate" as const,
    title: "شهادة نظام الهيئة",
    icon: ShieldCheck,
    iconClassName: "bg-emerald-100 text-emerald-700",
  },
];

export default function MvReportFilesHub({ projectId }: { projectId: string }) {
  const { dir } = useMvI18n();
  const [tab, setTab] = useState<AttachmentTab>(tabFromHash);

  useEffect(() => {
    const syncTabFromHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", syncTabFromHash);
    return () => window.removeEventListener("hashchange", syncTabFromHash);
  }, []);

  useEffect(() => {
    const nextHash = "#" + tab;
    if (window.location.hash === nextHash) return;
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search + nextHash);
  }, [tab]);

  return (
    <MvWorkflowPageFrame className="bg-[var(--color-background-primary)]" dir={dir}>
      <MvProjectReportHeader
        compact
        projectId={projectId}
        activeStep="report-files"
        breadcrumbs={[{ label: "المرفقات" }]}
      />

      <main className="mx-auto flex min-h-0 w-full max-w-[96rem] flex-1 px-2 py-2 sm:px-3">
        <section className="flex min-h-0 w-full flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" dir="rtl">
          <aside className="flex shrink-0 flex-col border-b border-slate-200 bg-slate-50/80 lg:w-56 lg:border-b-0 lg:border-l">
            <nav className="flex gap-1.5 overflow-x-auto p-2 lg:flex-1 lg:flex-col lg:overflow-y-auto" aria-label="أقسام المرفقات">
              {attachmentTabs.map((item) => {
                const Icon = item.icon;
                const isActive = item.id === tab;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={cn(
                      "group flex min-w-[9.5rem] items-center gap-2 rounded-lg border px-2.5 py-2 text-right transition duration-200 lg:min-w-0",
                      isActive
                        ? "border-[#0C447C] bg-[#0C447C] text-white shadow-md shadow-sky-900/15"
                        : "border-transparent bg-white/70 text-slate-700 hover:border-slate-200 hover:bg-white",
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition",
                        isActive ? "bg-white/15 text-white" : item.iconClassName,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-black">{item.title}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
            <div className="min-h-0 flex-1">
              {tab === "valuation" ? <MvValuationAccountingWorkspace projectId={projectId} embedded /> : null}
              {tab === "client" ? <MvClientFilesWorkspace projectId={projectId} embedded /> : null}
              {tab === "certificate" ? <MvClientFilesWorkspace projectId={projectId} kind="certificate" embedded /> : null}
            </div>
          </div>
        </section>
      </main>
      <MvSimpleReportStepNavigation projectId={projectId} activeStep="report-files" />
    </MvWorkflowPageFrame>
  );
}
