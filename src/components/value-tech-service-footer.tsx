"use client";

import { useContext } from "react";
import { ArrowUpRight, ChevronRight, LayoutGrid, Layers, Laptop } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "@/components/prefetch-link";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";

const copy = {
  en: {
    title: "Value Tech",
    subtitle: "Professional workspace for app access and evaluation data sources.",
    quickLinks: "Quick Links",
    valueTechHome: "Value Tech Home",
    valueTechApp: "Value Tech App",
    evaluationSource: "Evaluation Source",
    categories: "Categories",
    cars: "Cars",
    realEstate: "Real Estate",
    other: "Other",
    backToSparkVision: "Return to SparkVision",
    copyright: "All rights reserved.",
  },
  ar: {
    title: "Value Tech",
    subtitle:
      "\u0645\u0633\u0627\u062d\u0629 \u0639\u0645\u0644 \u0627\u062d\u062a\u0631\u0627\u0641\u064a\u0629 \u0644\u0644\u062a\u0637\u0628\u064a\u0642 \u0648\u0645\u0635\u0627\u062f\u0631 \u0627\u0644\u062a\u0642\u064a\u064a\u0645.",
    quickLinks: "\u0631\u0648\u0627\u0628\u0637 \u0633\u0631\u064a\u0639\u0629",
    valueTechHome: "\u0635\u0641\u062d\u0629 Value Tech",
    valueTechApp: "\u062a\u0637\u0628\u064a\u0642 Value Tech",
    evaluationSource: "\u0645\u0635\u0627\u062f\u0631 \u0627\u0644\u062a\u0642\u064a\u064a\u0645",
    categories: "\u062a\u0635\u0646\u064a\u0641\u0627\u062a \u0627\u0644\u0645\u0635\u0627\u062f\u0631",
    cars: "\u0627\u0644\u0633\u064a\u0627\u0631\u0627\u062a",
    realEstate: "\u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062a",
    other: "\u0623\u062e\u0631\u0649",
    backToSparkVision:
      "\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 SparkVision",
    copyright: "\u062c\u0645\u064a\u0639 \u0627\u0644\u062d\u0642\u0648\u0642 \u0645\u062d\u0641\u0648\u0638\u0629.",
  },
} as const;

export default function ValueTechServiceFooter() {
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "ar";
  const isArabic = language === "ar";
  const t = copy[language];
  const pathname = usePathname() || "/";
  const isValueTechAppRoute = pathname.startsWith("/value-tech-app");
  const theme = isValueTechAppRoute
    ? {
        root: "border-amber-300/15 bg-slate-950",
        card:
          "border-amber-300/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900 shadow-[0_24px_80px_-40px_rgba(251,191,36,0.65)]",
        badge: "border-amber-300/40 bg-amber-400/10 text-amber-200",
        title: "text-white",
        subtitle: "text-slate-300",
        cta: "bg-gradient-to-r from-amber-300 to-amber-500 text-slate-950 hover:brightness-110",
        sectionLabel: "text-slate-400",
        link: "text-slate-200 hover:text-amber-200",
        icon: "text-amber-300",
        divider: "border-slate-700",
        copyright: "text-slate-400",
        topLine: "via-amber-300/70",
      }
    : {
        root: "border-slate-200 bg-slate-950",
        card:
          "border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800/90 shadow-[0_24px_80px_-40px_rgba(8,145,178,0.7)]",
        badge: "border-cyan-400/40 bg-cyan-400/10 text-cyan-200",
        title: "text-white",
        subtitle: "text-slate-300",
        cta: "bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 hover:brightness-110",
        sectionLabel: "text-slate-400",
        link: "text-slate-200 hover:text-cyan-200",
        icon: "text-cyan-300",
        divider: "border-slate-800",
        copyright: "text-slate-400",
        topLine: "via-cyan-300/70",
      };

  return (
    <footer className={cn("relative border-t text-slate-100", theme.root)}>
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          theme.topLine
        )}
      />
      <div className="container py-12">
        <div className={cn("relative overflow-hidden rounded-3xl border p-6 sm:p-8", theme.card)}>
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />

          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr_1fr]">
            <div className="space-y-4">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]",
                  theme.badge
                )}
              >
                Value Tech
              </span>
              <h2 className={cn("text-2xl font-semibold", theme.title)}>{t.title}</h2>
              <p className={cn("max-w-md text-sm leading-7", theme.subtitle)}>{t.subtitle}</p>

              <Link
                href="/"
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
                  theme.cta
                )}
              >
                {t.backToSparkVision}
                <ArrowUpRight className={cn("h-4 w-4", isArabic ? "rotate-180" : "")} />
              </Link>
            </div>

            <div>
              <h3 className={cn("text-sm font-semibold uppercase tracking-[0.18em]", theme.sectionLabel)}>
                {t.quickLinks}
              </h3>
              <ul className="mt-4 space-y-3">
                {[
                  { href: "/value-tech", label: t.valueTechHome, icon: LayoutGrid },
                  { href: "/value-tech-app", label: t.valueTechApp, icon: Laptop },
                  { href: "/evaluation-source", label: t.evaluationSource, icon: Layers },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn("inline-flex items-center gap-2 text-sm transition", theme.link)}
                      >
                        <Icon className={cn("h-4 w-4", theme.icon)} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <h3 className={cn("text-sm font-semibold uppercase tracking-[0.18em]", theme.sectionLabel)}>
                {t.categories}
              </h3>
              <ul className="mt-4 space-y-3">
                {[
                  { href: "/evaluation-source/cars", label: t.cars },
                  { href: "/evaluation-source/real-estate", label: t.realEstate },
                  { href: "/evaluation-source/other", label: t.other },
                ].map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn("inline-flex items-center gap-1 text-sm transition", theme.link)}
                    >
                      {item.label}
                      <ChevronRight className={cn("h-4 w-4", isArabic ? "rotate-180" : "")} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={cn("relative mt-8 border-t pt-4 text-xs", theme.divider, theme.copyright)}>
            &copy; {new Date().getFullYear()} Spark Vision - Value Tech. {t.copyright}
          </div>
        </div>
      </div>
    </footer>
  );
}
