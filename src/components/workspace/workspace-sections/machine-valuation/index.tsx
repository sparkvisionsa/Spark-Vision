"use client";

import dynamic from "next/dynamic";
import { useMemo, type ComponentType } from "react";
import { isMvMainWorkflowSlug } from "./mv-main-workflow-model";
import { useMvInPageNavigation } from "./mv-inpage-navigation";
import { useMvI18n } from "./mv-i18n";
import { MvPageLoading } from "./mv-ui";
import { loadClientChunk } from "@/lib/load-client-chunk";
import { resolveSettingsSection, resolveSettingsTab } from "./mv-settings-nav";

/** هيكل خفيف أثناء تحميل مقطع ديناميكي — دون تغطية كاملة للشاشة (يختلف عن PageTransitionLoader لجذر الـ workspace). */
function MvRouteSkeleton() {
  const { t } = useMvI18n();
  return <MvPageLoading label={t("index.openingWorkspace")} />;
}

function lazyPage<T extends { default: ComponentType<any> }>(loader: () => Promise<T>) {
  return dynamic(() => loadClientChunk(loader), {
    loading: () => <MvRouteSkeleton />,
  });
}

const ProjectsList = lazyPage(() => import("./projects-list"));
const ClientsPage = lazyPage(() => import("@/components/clients/clients-page"));
const MvSettingsHub = lazyPage(() => import("./mv-settings-hub"));
const MvDriveExplorer = lazyPage(() => import("./mv-drive-explorer"));
const MvInspectorFilesWorkspace = lazyPage(() => import("./mv-inspector-files-workspace"));
const SubProjectDetail = lazyPage(() => import("./sub-project-detail"));
const MvWorkflowShell = lazyPage(() => import("./mv-workflow-shell"));
const MvValuationShell = lazyPage(() => import("./mv-valuation-shell"));
const MvClientFilesShell = lazyPage(() => import("./mv-client-files-shell"));
const SupportPage = lazyPage(() => import("@/components/support/support-page"));
const DeveloperRequestsPage = lazyPage(() => import("@/components/support/developer-requests-page"));
const MvSceCertificateShell = lazyPage(() => import("./mv-sce-certificate-shell"));
const MvReportFilesHub = lazyPage(() => import("./mv-report-files-hub"));
const MvReportDataWorkspace = lazyPage(() => import("./mv-report-data-workspace"));
const MvFinalReportWorkspace = lazyPage(() => import("./mv-final-report-workspace"));

function parseMvPath(pathname: string) {
  pathname = pathname.split(/[?#]/)[0]!;
  const base = "/machine-valuation";
  if (!pathname.startsWith(base)) return { view: "projects" as const, segments: [] };

  const rest = pathname.slice(base.length).replace(/^\/+/, "").replace(/\/+$/, "");
  if (!rest) return { view: "projects" as const, segments: [] };

  const segments = rest.split("/").filter(Boolean);
  if (segments[0] === "support") return { view: "support" as const, segments };
  if (segments[0] === "developer-requests") return { view: "developer-requests" as const, segments };
  if (segments[0] === "dashboard") {
    return { view: "projects" as const, segments };
  }
  if (segments[0] === "projects") {
    if (segments.length === 1) return { view: "projects" as const, segments };
    return { view: "projects" as const, segments };
  }
  if (segments[0] === "settings") {
    const settingsSection = resolveSettingsSection(segments[1]);
    const settingsTab = resolveSettingsTab(settingsSection, segments[2]);
    return { view: "settings" as const, settingsSection, settingsTab, segments };
  }
  if (segments.length === 1 && segments[0] === "company") {
    return {
      view: "settings" as const,
      settingsSection: "general" as const,
      settingsTab: "info",
      segments,
    };
  }
  if (segments.length === 1 && segments[0] === "report-settings") {
    return {
      view: "settings" as const,
      settingsSection: "report" as const,
      settingsTab: "word-template",
      segments,
    };
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
      if (segments[2] === "files") {
        return { view: "report-files-workflow" as const, projectId, segments };
      }
      if (segments[2] === "certificate") {
        return { view: "certificate-workflow" as const, projectId, segments };
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
    case "support":
      return <SupportPage />;
    case "developer-requests":
      return <DeveloperRequestsPage />;
    case "settings":
      return (
        <MvSettingsHub
          section={route.settingsSection ?? "general"}
          tab={route.settingsTab ?? "info"}
        />
      );
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
    case "report-files-workflow":
      return <MvReportFilesHub projectId={route.projectId!} />;
    case "certificate-workflow":
      return <MvSceCertificateShell projectId={route.projectId!} />;
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
