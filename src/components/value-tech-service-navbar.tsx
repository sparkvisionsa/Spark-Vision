"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Building2,
  Car,
  Compass,
  Flag,
  Layers,
  LayoutGrid,
  Laptop,
  Shapes,
  Sparkles,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "@/components/prefetch-link";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
};

const copy = {
  en: {
    backToSparkVision: "Back to SparkVision",
    valueTechHub: "Value Tech Home",
    valueTechApp: "Value Tech App",
    evaluationSource: "Evaluation Source",
    appSections: "Value Tech App Sections",
    appOverview: "Overview",
    appFeatures: "Features",
    appWorkflow: "Workflow",
    installGuide: "Install Guide",
    appTrust: "Trust",
    appGetStarted: "Get Started",
    evaluationSections: "Evaluation Source Categories",
    overview: "Overview",
    cars: "Cars",
    realEstate: "Real Estate",
    other: "Other",
  },
  ar: {
    backToSparkVision:
      "\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 SparkVision",
    valueTechHub: "\u0635\u0641\u062d\u0629 Value Tech",
    valueTechApp: "\u062a\u0637\u0628\u064a\u0642 Value Tech",
    evaluationSource: "\u0645\u0635\u0627\u062f\u0631 \u0627\u0644\u062a\u0642\u064a\u064a\u0645",
    appSections: "\u0623\u0642\u0633\u0627\u0645 \u062a\u0637\u0628\u064a\u0642 Value Tech",
    appOverview: "\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629",
    appFeatures: "\u0627\u0644\u0645\u0645\u064a\u0632\u0627\u062a",
    appWorkflow: "\u0633\u064a\u0631 \u0627\u0644\u0639\u0645\u0644",
    installGuide: "\u062f\u0644\u064a\u0644 \u0627\u0644\u062a\u062b\u0628\u064a\u062a",
    appTrust: "\u0627\u0644\u0645\u0648\u062b\u0648\u0642\u064a\u0629",
    appGetStarted: "\u0627\u0628\u062f\u0623 \u0627\u0644\u0622\u0646",
    evaluationSections:
      "\u062a\u0635\u0646\u064a\u0641\u0627\u062a \u0645\u0635\u0627\u062f\u0631 \u0627\u0644\u062a\u0642\u064a\u064a\u0645",
    overview: "\u0646\u0638\u0631\u0629 \u0639\u0627\u0645\u0629",
    cars: "\u0627\u0644\u0633\u064a\u0627\u0631\u0627\u062a",
    realEstate: "\u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062a",
    other: "\u0623\u062e\u0631\u0649",
  },
} as const;

export default function ValueTechServiceNavbar() {
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "ar";
  const isArabic = language === "ar";
  const t = copy[language];
  const pathname = usePathname() || "/";
  const [currentHash, setCurrentHash] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateHash = () => {
      setCurrentHash(window.location.hash || "");
    };

    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, [pathname]);

  const primaryItems = useMemo<NavItem[]>(
    () => [
      {
        href: "/value-tech",
        label: t.valueTechHub,
        icon: LayoutGrid,
        match: (path) => path === "/value-tech",
      },
      {
        href: "/value-tech-app",
        label: t.valueTechApp,
        icon: Laptop,
        match: (path) => path.startsWith("/value-tech-app"),
      },
      {
        href: "/evaluation-source",
        label: t.evaluationSource,
        icon: Layers,
        match: (path) =>
          path.startsWith("/evaluation-source") || path.startsWith("/evaluation-sourc"),
      },
    ],
    [t.evaluationSource, t.valueTechApp, t.valueTechHub]
  );

  const appSecondaryItems = useMemo(
    () => [
      {
        href: "/value-tech-app#overview",
        hash: "#overview",
        label: t.appOverview,
        icon: Compass,
      },
      {
        href: "/value-tech-app#features",
        hash: "#features",
        label: t.appFeatures,
        icon: Sparkles,
      },
      {
        href: "/value-tech-app#workflow",
        hash: "#workflow",
        label: t.appWorkflow,
        icon: LayoutGrid,
      },
      {
        href: "/value-tech-app#install",
        hash: "#install",
        label: t.installGuide,
        icon: Wrench,
      },
      {
        href: "/value-tech-app#trust",
        hash: "#trust",
        label: t.appTrust,
        icon: ShieldCheck,
      },
      {
        href: "/value-tech-app#cta",
        hash: "#cta",
        label: t.appGetStarted,
        icon: Flag,
      },
    ],
    [
      t.appFeatures,
      t.appGetStarted,
      t.appOverview,
      t.appTrust,
      t.appWorkflow,
      t.installGuide,
    ]
  );

  const evaluationSecondaryItems = useMemo(
    () => [
      {
        href: "/evaluation-source",
        label: t.overview,
        icon: LayoutGrid,
        active: pathname === "/evaluation-source" || pathname === "/evaluation-sourc",
      },
      {
        href: "/evaluation-source/cars",
        label: t.cars,
        icon: Car,
        active: pathname.startsWith("/evaluation-source/cars"),
      },
      {
        href: "/evaluation-source/real-estate",
        label: t.realEstate,
        icon: Building2,
        active: pathname.startsWith("/evaluation-source/real-estate"),
      },
      {
        href: "/evaluation-source/other",
        label: t.other,
        icon: Shapes,
        active: pathname.startsWith("/evaluation-source/other"),
      },
    ],
    [pathname, t.cars, t.other, t.overview, t.realEstate]
  );

  const isEvaluationRoute =
    pathname.startsWith("/evaluation-source") || pathname.startsWith("/evaluation-sourc");
  const isValueTechAppRoute = pathname.startsWith("/value-tech-app");
  const appRouteItems = isValueTechAppRoute
    ? appSecondaryItems.map((item, index) => {
        const activeHash =
          currentHash.length > 0 ? currentHash === item.hash : index === 0;
        return {
          ...item,
          active: activeHash,
        };
      })
    : [];
  const inlineItems = isEvaluationRoute ? evaluationSecondaryItems : appRouteItems;

  const theme = isValueTechAppRoute
    ? {
        header: "border-amber-300/25 bg-slate-950/95",
        shell: "border-amber-300/30 bg-slate-900/95 shadow-[0_18px_40px_-30px_rgba(251,191,36,0.6)]",
        brand: "text-white",
        logoWrap: "bg-amber-300/20 text-amber-200",
        backButton: "border border-amber-300/50 bg-amber-300 text-slate-950 hover:brightness-110",
        primaryActive: "bg-amber-300 text-slate-950",
        primaryIdle: "text-slate-200 hover:bg-slate-800 hover:text-white",
        secondaryActive: "bg-amber-300/20 text-amber-100",
        secondaryIdle: "text-slate-300 hover:bg-slate-800 hover:text-white",
        divider: "bg-slate-700",
      }
    : {
        header: "border-slate-200/90 bg-white/95",
        shell: "border-slate-200 bg-white/95 shadow-[0_14px_30px_-26px_rgba(15,23,42,0.55)]",
        brand: "text-slate-900",
        logoWrap: "bg-slate-900 text-white",
        backButton: "border border-cyan-600/20 bg-cyan-600 text-white hover:bg-cyan-700",
        primaryActive: "bg-slate-900 text-white",
        primaryIdle: "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
        secondaryActive: "bg-cyan-100 text-cyan-900",
        secondaryIdle: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        divider: "bg-slate-200",
      };

  return (
    <header className={cn("sticky top-0 z-50 border-b backdrop-blur-md", theme.header)}>
      <div className="container py-1.5">
        <div className={cn("flex h-12 items-center gap-2 rounded-xl border px-2", theme.shell)}>
          <Link href="/value-tech" className="inline-flex shrink-0 items-center gap-1.5">
            <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md", theme.logoWrap)}>
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className={cn("text-sm font-semibold", theme.brand)}>Value Tech</span>
          </Link>

          <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap">
            {primaryItems.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition",
                    active ? theme.primaryActive : theme.primaryIdle
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}

            {inlineItems.length > 0 ? <span className={cn("mx-1 h-4 w-px shrink-0", theme.divider)} /> : null}

            {inlineItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition",
                  item.active ? theme.secondaryActive : theme.secondaryIdle
                )}
                aria-current={item.active ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <Link
            href="/"
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition",
              theme.backButton
            )}
          >
            <span className="hidden sm:inline">{t.backToSparkVision}</span>
            <span className="sm:hidden">{isArabic ? "\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629" : "Home"}</span>
            <ArrowUpRight className={cn("h-3.5 w-3.5", isArabic ? "rotate-180" : "")} />
          </Link>
        </div>
      </div>
    </header>
  );
}
