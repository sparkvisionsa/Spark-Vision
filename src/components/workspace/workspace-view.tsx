"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import ValueTechShell from "@/components/value-tech-shell";
import PageTransitionLoader from "@/components/ui/page-transition-loader";

const SECTION_LOADERS: Record<string, () => Promise<{ default: React.ComponentType<object> }>> = {
  vt: () => import("./workspace-sections/value-tech-hub"),
  "value-tech-app": () => import("./workspace-sections/value-tech-app"),
  "real-estate-valuation": () => import("./workspace-sections/real-estate-valuation"),
  "machine-valuation": () => import("./workspace-sections/machine-valuation/index"),
  "asset-inventory": () => import("./workspace-sections/asset-inventory"),
  "asset-inspection": () => import("./workspace-sections/asset-inspection"),
  clients: () => import("./workspace-sections/clients"),
  settings: () => import("./workspace-sections/settings"),
  "evaluation-source": () => import("./workspace-sections/evaluation-source-index"),
  "evaluation-source/cars": () => import("./workspace-sections/evaluation-source-cars"),
  "evaluation-source/real-estate": () => import("./workspace-sections/evaluation-source-real-estate"),
  "evaluation-source/other": () => import("./workspace-sections/evaluation-source-other"),
};

const PREFIX_SECTIONS = new Set(["machine-valuation"]);

function slugToKey(slug?: string[]): string {
  if (!slug || slug.length === 0) return "vt";
  const first = slug[0];
  if (PREFIX_SECTIONS.has(first)) return first;
  return slug.join("/");
}

function WorkspaceSkeleton() {
  return (
    <div className="animate-pulse space-y-4 rounded-2xl border border-slate-200/80 bg-white/60 p-6">
      <div className="h-8 w-48 rounded-lg bg-slate-200/80" />
      <div className="h-32 w-full rounded-xl bg-slate-100" />
      <div className="h-24 w-full rounded-xl bg-slate-100" />
    </div>
  );
}

function MissingSection() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-6 text-center text-sm text-amber-900">
      لم يتم العثور على هذه الصفحة.
    </div>
  );
}

export function WorkspaceView({ slug }: { slug?: string[] }) {
  const key = slugToKey(slug);
  const loader = SECTION_LOADERS[key];

  const Section = useMemo(() => {
    if (!loader) {
      return MissingSection;
    }
    return dynamic(loader, {
      loading: () => <PageTransitionLoader />,
    });
  }, [key, loader]);

  return (
    <ValueTechShell>
      <Section key={key} />
    </ValueTechShell>
  );
}
