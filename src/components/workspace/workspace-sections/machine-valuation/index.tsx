"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { isMvMainWorkflowSlug } from "./mv-main-workflow-model";
import { parseValuationPhaseSlug } from "./mv-valuation-workflow-model";
import MvReportDataWorkspace from "./mv-report-data-workspace";
import MvValuationReportWorkspace from "./mv-valuation-report-workspace";
import MvValuationShell from "./mv-valuation-shell";
import MvWorkflowShell from "./mv-workflow-shell";
import { useMvInPageNavigation } from "./mv-inpage-navigation";
import CompanyAdminDashboard from "@/components/company-admin-dashboard";

/** هيكل خفيف أثناء تحميل مقطع ديناميكي — دون تغطية كاملة للشاشة (يختلف عن PageTransitionLoader لجذر الـ workspace). */
function MvRouteSkeleton() {
  return (
    <div className="animate-pulse space-y-4 rounded-2xl border border-slate-200/80 bg-white/60 p-6">
      <div className="h-8 w-48 rounded-lg bg-slate-200/80" />
      <div className="h-32 w-full rounded-xl bg-slate-100" />
      <div className="h-24 w-full rounded-xl bg-slate-100" />
    </div>
  );
}

const ProjectsList = dynamic(() => import("./projects-list"), {
  loading: () => <MvRouteSkeleton />,
});
const MvDashboardHome = dynamic(() => import("./mv-dashboard-home"), {
  loading: () => <MvRouteSkeleton />,
});
const MvProjectWorkspace = dynamic(() => import("./mv-project-workspace"), {
  loading: () => <MvRouteSkeleton />,
});
const MvDriveExplorer = dynamic(() => import("./mv-drive-explorer"), {
  loading: () => <MvRouteSkeleton />,
});
const MvInspectorFilesWorkspace = dynamic(() => import("./mv-inspector-files-workspace"), {
  loading: () => <MvRouteSkeleton />,
});
const SubProjectDetail = dynamic(() => import("./sub-project-detail"), {
  loading: () => <MvRouteSkeleton />,
});

function parseMvPath(pathname: string) {
  const base = "/machine-valuation";
  if (!pathname.startsWith(base)) return { view: "projects" as const, segments: [] };

  const rest = pathname.slice(base.length).replace(/^\/+/, "").replace(/\/+$/, "");
  if (!rest) return { view: "projects" as const, segments: [] };

  const segments = rest.split("/").filter(Boolean);
  if (segments[0] === "dashboard") {
    return { view: "dashboard" as const, segments };
  }
  if (segments[0] === "projects") {
    if (segments.length === 1) return { view: "projects" as const, segments };
    return { view: "dashboard" as const, segments };
  }
  if (segments.length === 1 && segments[0] === "company") {
    return { view: "company-admin" as const, segments };
  }
  if (segments.length === 1) {
    return { view: "report-data-workflow" as const, projectId: segments[0]!, segments };
  }
  if (segments.length >= 2) {
    const projectId = segments[0]!;
    const second = segments[1]!;
    if (second === "workflow") {
      if (!segments[2]) {
        return { view: "report-data-workflow" as const, projectId, segments };
      }
      if (segments[2] === "report-data" && segments.length === 3) {
        return { view: "report-data-workflow" as const, projectId, segments };
      }
      if (segments[2] === "report" && segments.length === 3) {
        return { view: "report-workflow" as const, projectId, segments };
      }
      if (segments[2] === "valuation") {
        if (segments.length === 3) {
          return {
            view: "valuation-workflow" as const,
            projectId,
            valuationPhase: "hub" as const,
            segments,
          };
        }
        const valuationPhase = parseValuationPhaseSlug(segments[3]);
        return { view: "valuation-workflow" as const, projectId, valuationPhase, segments };
      }
      if (segments[2] === "asset-images" || segments[2] === "folders") {
        const sub = segments[3];
        const assetImagesSub: "local" | "system" | null =
          sub === "local" ? "local" : sub === "system" ? "system" : null;
        return {
          view: "workflow" as const,
          projectId,
          stepSlug: "asset-images" as const,
          assetImagesSub,
          segments,
        };
      }
      if (!isMvMainWorkflowSlug(segments[2])) {
        return { view: "report-data-workflow" as const, projectId, segments };
      }
      const stepSlug = segments[2];
      return { view: "workflow" as const, projectId, stepSlug, segments };
    }
    if (second === "legacy") {
      return { view: "legacy-workspace" as const, projectId, segments };
    }
    if (second === "files") {
      return { view: "project-files" as const, projectId, segments };
    }
    if (second === "inspector-files") {
      return { view: "inspector-files" as const, projectId, segments };
    }
    return {
      view: "sub-project-detail" as const,
      projectId,
      subProjectId: second,
      segments,
    };
  }
  return { view: "projects" as const, segments: [] };
}

export default function MachineValuationSection() {
  const { currentPath } = useMvInPageNavigation();
  const pathname = currentPath || "/machine-valuation";
  const route = useMemo(() => parseMvPath(pathname), [pathname]);

  switch (route.view) {
    case "company-admin":
      return <CompanyAdminDashboard variant="embedded" />;
    case "workflow":
      return (
        <MvWorkflowShell
          projectId={route.projectId!}
          stepSlug={route.stepSlug!}
          assetImagesSub={"assetImagesSub" in route ? route.assetImagesSub : undefined}
        />
      );
    case "valuation-workflow":
      return (
        <MvValuationShell projectId={route.projectId!} phaseSlug={route.valuationPhase!} />
      );
    case "report-workflow":
      return <MvValuationReportWorkspace projectId={route.projectId!} />;
    case "report-data-workflow":
      return <MvReportDataWorkspace projectId={route.projectId!} />;
    case "legacy-workspace":
      return <MvProjectWorkspace projectId={route.projectId!} />;
    case "project-files":
      return <MvDriveExplorer projectId={route.projectId!} />;
    case "inspector-files":
      return <MvInspectorFilesWorkspace projectId={route.projectId!} />;
    case "sub-project-detail":
      return (
        <SubProjectDetail
          projectId={route.projectId!}
          subProjectId={route.subProjectId!}
        />
      );
    case "projects":
      return <ProjectsList />;
    case "dashboard":
      return <MvDashboardHome />;
    default:
      return <ProjectsList />;
  }
}
