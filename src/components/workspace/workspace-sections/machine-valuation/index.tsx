"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import ProjectsList from "./projects-list";
import ProjectDetail from "./project-detail";
import SubProjectDetail from "./sub-project-detail";

function parseMvPath(pathname: string) {
  const base = "/machine-valuation";
  if (!pathname.startsWith(base)) return { view: "projects" as const, segments: [] };

  const rest = pathname.slice(base.length).replace(/^\/+/, "").replace(/\/+$/, "");
  if (!rest) return { view: "projects" as const, segments: [] };

  const segments = rest.split("/").filter(Boolean);
  if (segments.length === 1) {
    return { view: "project-detail" as const, projectId: segments[0], segments };
  }
  if (segments.length >= 2) {
    return {
      view: "sub-project-detail" as const,
      projectId: segments[0],
      subProjectId: segments[1],
      segments,
    };
  }
  return { view: "projects" as const, segments: [] };
}

export default function MachineValuationSection() {
  const pathname = usePathname() || "/machine-valuation";
  const route = useMemo(() => parseMvPath(pathname), [pathname]);

  switch (route.view) {
    case "project-detail":
      return <ProjectDetail projectId={route.projectId!} />;
    case "sub-project-detail":
      return (
        <SubProjectDetail
          projectId={route.projectId!}
          subProjectId={route.subProjectId!}
        />
      );
    default:
      return <ProjectsList />;
  }
}
