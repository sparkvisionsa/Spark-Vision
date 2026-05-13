"use client";

import { Tajawal } from "next/font/google";
import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import Link from "@/components/prefetch-link";
import { ClipboardList, FileEdit, Images, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MV_PROJECTS_TABLE_PATH } from "./mv-home-routes";
import { MvTopBar } from "./mv-ui";
import { useMvInPageNavigation } from "./mv-inpage-navigation";
import {
  countProjectAssetImages,
  hasMeaningfulSimpleReportData,
  MvProjectReportHeader,
  mvSimpleReportStepHref,
  readVisitedSimpleReportSteps,
  type MvSimpleReportStepId,
  writeVisitedSimpleReportSteps,
} from "./mv-simple-report-navigation";
import { MvWorkflowPageFrame, MvWorkflowPageScrollBody } from "./mv-workflow-page-frame";
import type { MvProject, MvProjectReportData, MvSubProject } from "./types";

interface MvProjectHomeProps {
  projectId: string;
}

const projectFont = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800", "900"],
  display: "swap",
});

const numberFormatter = new Intl.NumberFormat("ar-SA");

const REPORT_FLOW_CARDS: {
  stepId: MvSimpleReportStepId;
  title: string;
  hint: string;
  icon: typeof ClipboardList;
}[] = [
  {
    stepId: "report-data",
    title: "بيانات التقرير",
    hint: "البيانات الأساسية للعميل والتواريخ والغرض والقيمة النهائية.",
    icon: ClipboardList,
  },
  {
    stepId: "asset-images",
    title: "صور الأصول",
    hint: "اختيار وارتباط صور الأصول المراد إدراجها ضمن مسار العمل.",
    icon: Images,
  },
  {
    stepId: "valuation-actions",
    title: "إجراءات التقييم",
    hint: "خطوات التقييم وربط الإكسيل والمنهجية المعتمدة للمشروع.",
    icon: LineChart,
  },
  {
    stepId: "report-preview",
    title: "إعداد التقرير",
    hint: "معاينة أقسام التقرير النهائي والهوامش ومحتوى الصور كما في الطباعة.",
    icon: FileEdit,
  },
];

export default function MvProjectHome({ projectId }: MvProjectHomeProps) {
  const { navigate } = useMvInPageNavigation();
  const [project, setProject] = useState<MvProject | null>(null);
  const [subProjects, setSubProjects] = useState<MvSubProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [visitedSteps, setVisitedSteps] = useState<Set<MvSimpleReportStepId>>(
    () => new Set(["report-data"]),
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/mv/projects/${projectId}?picAssetMode=summary`, {
        credentials: "include",
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        project: MvProject;
        subProjects: MvSubProject[];
      };
      setProject(data.project);
      setSubProjects(data.subProjects ?? []);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setVisitedSteps(new Set(readVisitedSimpleReportSteps(projectId)));
    void load();
  }, [load, projectId]);

  const markVisited = useCallback(
    (stepId: MvSimpleReportStepId) => {
      setVisitedSteps((current) => {
        const next = new Set(current);
        next.add(stepId);
        writeVisitedSimpleReportSteps(projectId, Array.from(next));
        return next;
      });
    },
    [projectId],
  );

  const assetImageCount = useMemo(() => countProjectAssetImages(subProjects), [subProjects]);

  const completedSteps = useMemo(() => {
    const completed = new Set<MvSimpleReportStepId>();
    if (hasMeaningfulSimpleReportData(project?.reportData)) completed.add("report-data");
    if (assetImageCount > 0) completed.add("asset-images");
    if ((project?.sheetCount ?? 0) > 0) completed.add("valuation-actions");
    if (hasMeaningfulSimpleReportData(project?.reportData) && visitedSteps.has("report-preview")) {
      completed.add("report-preview");
    }
    return completed;
  }, [assetImageCount, project?.reportData, project?.sheetCount, visitedSteps]);

  const onStepSelect = useCallback(
    (stepId: MvSimpleReportStepId) => {
      markVisited(stepId);
      const href = mvSimpleReportStepHref(projectId, stepId);
      startTransition(() => {
        navigate(href);
      });
    },
    [markVisited, navigate, projectId],
  );

  if (loading) {
    return (
      <MvWorkflowPageFrame className={cn(projectFont.className)} dir="rtl">
        <MvTopBar breadcrumbs={[{ label: "..." }]} saveState="idle" />
        <MvWorkflowPageScrollBody>
          <div className="space-y-3 px-4 py-4">
            <div className="h-20 animate-pulse rounded-[1.5rem] bg-white/80" />
            <div className="h-32 animate-pulse rounded-[1.5rem] bg-white/80" />
            <div className="h-96 animate-pulse rounded-[1.5rem] bg-white/80" />
          </div>
        </MvWorkflowPageScrollBody>
      </MvWorkflowPageFrame>
    );
  }

  if (!project) {
    return (
      <MvWorkflowPageFrame
        className={cn(projectFont.className, "bg-[var(--color-background-primary)]")}
        dir="rtl"
      >
        <MvTopBar breadcrumbs={[{ label: "المشروع" }]} saveState="error" />
        <MvWorkflowPageScrollBody>
          <div className="mx-auto max-w-xl px-4 py-10 text-center">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="font-bold text-slate-950">تعذر تحميل المشروع.</p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => navigate(MV_PROJECTS_TABLE_PATH)}
              >
                العودة للمشاريع
              </Button>
            </div>
          </div>
        </MvWorkflowPageScrollBody>
      </MvWorkflowPageFrame>
    );
  }

  return (
    <MvWorkflowPageFrame
      className={cn(
        projectFont.className,
        "bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_32%),linear-gradient(180deg,#f8fafc,#eef2f7_52%,#f8fafc)]",
      )}
      dir="rtl"
    >
      <MvProjectReportHeader
        projectId={projectId}
        project={project}
        subProjects={subProjects}
        activeStep={null}
        visitedSteps={Array.from(visitedSteps)}
        completedSteps={Array.from(completedSteps)}
        onStepSelect={onStepSelect}
        compact
      />

      <MvWorkflowPageScrollBody>
      <main className="mx-auto max-w-6xl px-3 py-6 pb-8 sm:px-5">
        <header className="mb-6 border-b border-slate-200/80 pb-5">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-sky-700">المشروع</p>
          <h1 className="mt-1 text-[22px] font-black text-slate-950 sm:text-[26px]">{project.name}</h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-7 text-slate-600">
            نفس شريط الخطوات أعلاه يعمل من أي صفحة مسار (`workflow/...`). اختر خطوة للانتقال مباشرةً إلى
            الصفحة التفصيلية الموحّدة — لا يوجد نسخان منفصلان لبيانات التقرير أو معاينة التقرير.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {REPORT_FLOW_CARDS.map((card) => {
            const href = mvSimpleReportStepHref(projectId, card.stepId);
            const Icon = card.icon;
            return (
              <Link
                key={card.stepId}
                href={href}
                onClick={() => markVisited(card.stepId)}
                className="group flex flex-col rounded-[1.25rem] border border-slate-200/90 bg-white/95 p-5 text-right shadow-md shadow-slate-900/5 transition hover:border-sky-300 hover:shadow-lg hover:shadow-sky-900/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[15px] font-black text-slate-950">{card.title}</span>
                    <span className="text-[12px] font-medium leading-6 text-slate-500">{card.hint}</span>
                  </div>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-950 text-white shadow-inner shadow-sky-900/20 transition group-hover:bg-sky-800">
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <span className="mt-4 text-[11px] font-bold text-sky-800">فتح صفحة الخطوة في المسار الموحّد ←</span>
              </Link>
            );
          })}
        </div>

        <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white/60 px-4 py-4 text-[12px] leading-7 text-slate-600">
          <p className="font-extrabold text-slate-800">ملخص سريع</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            <li>
              صور مرتبطة بالتقرير:{" "}
              <span className="font-black text-slate-900">{numberFormatter.format(assetImageCount)}</span>
            </li>
            <li>
              أوراق إكسيل:{" "}
              <span className="font-black text-slate-900">
                {numberFormatter.format(project.sheetCount ?? 0)}
              </span>
            </li>
          </ul>
        </section>
      </main>
      </MvWorkflowPageScrollBody>
    </MvWorkflowPageFrame>
  );
}
