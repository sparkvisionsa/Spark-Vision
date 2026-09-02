"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { isMvMainWorkflowSlug } from "./mv-main-workflow-model";
import { useMvInPageNavigation } from "./mv-inpage-navigation";
import { useMvI18n } from "./mv-i18n";
import { MvPageLoading } from "./mv-ui";

/** هيكل خفيف أثناء تحميل مقطع ديناميكي — دون تغطية كاملة للشاشة (يختلف عن PageTransitionLoader لجذر الـ workspace). */
function MvRouteSkeleton() {
  const { t } = useMvI18n();
  return <MvPageLoading label={t("index.openingWorkspace")} />;
}

const ProjectsList = dynamic(() => import("./projects-list"), {
  loading: () => <MvRouteSkeleton />,
});
const ClientsPage = dynamic(() => import("@/components/clients/clients-page"), {
  loading: () => <MvRouteSkeleton />,
});
const CompanyAdminDashboard = dynamic(() => import("@/components/company-admin-dashboard"), {
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
const MvWorkflowShell = dynamic(() => import("./mv-workflow-shell"), {
  loading: () => <MvRouteSkeleton />,
});
const MvValuationShell = dynamic(() => import("./mv-valuation-shell"), {
  loading: () => <MvRouteSkeleton />,
});
const MvClientFilesShell = dynamic(() => import("./mv-client-files-shell"), {
  loading: () => <MvRouteSkeleton />,
});
const MvReportDataWorkspace = dynamic(() => import("./mv-report-data-workspace"), {
  loading: () => <MvRouteSkeleton />,
});
const MvFinalReportWorkspace = dynamic(() => import("./mv-final-report-workspace"), {
  loading: () => <MvRouteSkeleton />,
});

function parseMvPath(pathname: string) {
  const base = "/machine-valuation";
  if (!pathname.startsWith(base)) return { view: "projects" as const, segments: [] };

  const rest = pathname.slice(base.length).replace(/^\/+/, "").replace(/\/+$/, "");
  if (!rest) return { view: "projects" as const, segments: [] };

  const segments = rest.split("/").filter(Boolean);
  if (segments[0] === "dashboard") {
    return { view: "projects" as const, segments };
  }
  if (segments[0] === "projects") {
    if (segments.length === 1) return { view: "projects" as const, segments };
    return { view: "projects" as const, segments };
  }
  if (segments.length === 1 && segments[0] === "company") {
    return { view: "company-admin" as const, segments };
  }
  if (segments.length === 1 && segments[0] === "report-settings") {
    return { view: "report-settings" as const, segments };
  }
  if (segments.length === 1 && segments[0] === "clients") {
    return { view: "clients" as const, segments };
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
      if (segments[2] === "final-report" && segments.length === 3) {
        return { view: "final-report-workflow" as const, projectId, segments };
      }
      // إعداد التقرير مخفي مؤقتاً — توجيه المسار القديم إلى التقرير النهائي
      if (segments[2] === "report" && segments.length === 3) {
        return { view: "final-report-workflow" as const, projectId, segments };
      }
      if (segments[2] === "valuation") {
        return { view: "valuation-workflow" as const, projectId, segments };
      }
      if (segments[2] === "client-files") {
        return { view: "client-files-workflow" as const, projectId, segments };
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
      return <CompanyAdminDashboard variant="embedded" productId="machine-valuation" />;
    case "report-settings":
      return <CompanyAdminDashboard variant="embedded" mode="report-defaults" productId="machine-valuation" />;
    case "clients":
      return <ClientsPage productId="machine-valuation" />;
    case "workflow":
      return (
        <MvWorkflowShell
          projectId={route.projectId!}
          stepSlug={route.stepSlug!}
          assetImagesSub={"assetImagesSub" in route ? route.assetImagesSub : undefined}
        />
      );
    case "valuation-workflow":
      return <MvValuationShell projectId={route.projectId!} />;
    case "client-files-workflow":
      return <MvClientFilesShell projectId={route.projectId!} />;
    case "final-report-workflow":
      return <MvFinalReportWorkspace projectId={route.projectId!} />;
    case "report-data-workflow":
      return <MvReportDataWorkspace projectId={route.projectId!} />;
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
    default:
      return <ProjectsList />;
  }
}
