"use client";

import { useContext } from "react";
import Link from "@/components/prefetch-link";
import {
  ArrowLeft,
  Building2,
  ClipboardList,
  Cpu,
  LayoutGrid,
  Library,
  Search,
  type LucideIcon,
} from "lucide-react";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";

type ProductCard = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  accent: "emerald" | "cyan" | "sky" | "indigo" | "violet" | "orange";
  status?: string;
};

const copy = {
  en: {
    title: "Value Tech Products",
    subtitle: "Choose the product you want to open.",
    open: "Open",
    comingSoon: "Coming soon",
    products: [
      {
        href: "/machine-valuation",
        title: "Machines & Equipment Valuation",
        description: "Workflow for machinery and equipment valuation projects.",
        icon: Cpu,
        accent: "indigo",
      },
      {
        href: "/real-estate-valuation",
        title: "Real Estate Valuation",
        description: "Structured workflow for professional real estate valuation operations.",
        icon: Building2,
        accent: "sky",
      },
      {
        href: "/value-tech-app",
        title: "Report Upload System",
        description: "Manage valuation reports and submissions through the desktop application.",
        icon: LayoutGrid,
        accent: "emerald",
      },
      {
        href: "/evaluation-source",
        title: "Information Sources",
        description: "Reference library for market data, pricing sources, and valuation support.",
        icon: Library,
        accent: "cyan",
      },
      {
        href: "/asset-inventory",
        title: "Asset Inventory",
        description: "Count, classify, and track organization assets accurately.",
        icon: ClipboardList,
        accent: "violet",
        status: "Coming soon",
      },
      {
        href: "/asset-inspection",
        title: "Asset Inspection",
        description: "Document asset condition and field inspection data.",
        icon: Search,
        accent: "orange",
        status: "Coming soon",
      },
    ] satisfies ProductCard[],
  },
  ar: {
    title: "منتجات فاليو تك",
    subtitle: "اختر المنتج المطلوب فتحه.",
    open: "فتح",
    comingSoon: "قريبًا",
    products: [
      {
        href: "/machine-valuation",
        title: "نظام تقييم الآلات والمعدات",
        description: "مسار عمل لمشاريع تقييم الآلات والمعدات.",
        icon: Cpu,
        accent: "indigo",
      },
      {
        href: "/real-estate-valuation",
        title: "نظام تقييم العقارات",
        description: "مسار عمل منظم لعمليات تقييم العقارات باحترافية.",
        icon: Building2,
        accent: "sky",
      },
      {
        href: "/value-tech-app",
        title: "نظام رفع التقارير",
        description: "إدارة تقارير التقييم ورفعها من خلال تطبيق سطح المكتب.",
        icon: LayoutGrid,
        accent: "emerald",
      },
      {
        href: "/evaluation-source",
        title: "مصادر المعلومات",
        description: "مكتبة مرجعية لبيانات السوق ومصادر الأسعار ودعم قرارات التقييم.",
        icon: Library,
        accent: "cyan",
      },
      {
        href: "/asset-inventory",
        title: "تطبيق حصر الأصول",
        description: "حصر وتصنيف وتتبع أصول المنشأة بدقة.",
        icon: ClipboardList,
        accent: "violet",
        status: "قريبًا",
      },
      {
        href: "/asset-inspection",
        title: "تطبيق معاينة الأصول",
        description: "توثيق حالة الأصول وبيانات المعاينة الميدانية.",
        icon: Search,
        accent: "orange",
        status: "قريبًا",
      },
    ] satisfies ProductCard[],
  },
} as const;

const accentClasses: Record<
  ProductCard["accent"],
  { icon: string; ring: string; cta: string; stripe: string; glow: string; badge: string }
> = {
  emerald: {
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-100 group-hover:bg-emerald-600 group-hover:text-white",
    ring: "hover:border-emerald-300 hover:shadow-emerald-900/12",
    cta: "text-emerald-700 bg-emerald-50 group-hover:bg-emerald-600 group-hover:text-white",
    stripe: "from-emerald-500 via-teal-400 to-cyan-400",
    glow: "bg-emerald-50",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  cyan: {
    icon: "bg-cyan-50 text-cyan-700 ring-cyan-100 group-hover:bg-cyan-600 group-hover:text-white",
    ring: "hover:border-cyan-300 hover:shadow-cyan-900/12",
    cta: "text-cyan-700 bg-cyan-50 group-hover:bg-cyan-600 group-hover:text-white",
    stripe: "from-cyan-500 via-sky-400 to-blue-500",
    glow: "bg-cyan-50",
    badge: "bg-cyan-50 text-cyan-700 ring-cyan-100",
  },
  sky: {
    icon: "bg-sky-50 text-sky-700 ring-sky-100 group-hover:bg-sky-600 group-hover:text-white",
    ring: "hover:border-sky-300 hover:shadow-sky-900/12",
    cta: "text-sky-700 bg-sky-50 group-hover:bg-sky-600 group-hover:text-white",
    stripe: "from-sky-500 via-blue-400 to-indigo-500",
    glow: "bg-sky-50",
    badge: "bg-sky-50 text-sky-700 ring-sky-100",
  },
  indigo: {
    icon: "bg-indigo-50 text-indigo-700 ring-indigo-100 group-hover:bg-indigo-600 group-hover:text-white",
    ring: "hover:border-indigo-300 hover:shadow-indigo-900/12",
    cta: "text-indigo-700 bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white",
    stripe: "from-indigo-500 via-violet-500 to-sky-500",
    glow: "bg-indigo-50",
    badge: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  },
  violet: {
    icon: "bg-violet-50 text-violet-700 ring-violet-100 group-hover:bg-violet-600 group-hover:text-white",
    ring: "hover:border-violet-300 hover:shadow-violet-900/12",
    cta: "text-violet-700 bg-violet-50 group-hover:bg-violet-600 group-hover:text-white",
    stripe: "from-violet-500 via-fuchsia-400 to-pink-400",
    glow: "bg-violet-50",
    badge: "bg-violet-50 text-violet-700 ring-violet-100",
  },
  orange: {
    icon: "bg-orange-50 text-orange-700 ring-orange-100 group-hover:bg-orange-600 group-hover:text-white",
    ring: "hover:border-orange-300 hover:shadow-orange-900/12",
    cta: "text-orange-700 bg-orange-50 group-hover:bg-orange-600 group-hover:text-white",
    stripe: "from-orange-500 via-amber-400 to-rose-400",
    glow: "bg-orange-50",
    badge: "bg-orange-50 text-orange-700 ring-orange-100",
  },
};

export default function ValueTechHubSection() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;

  const isArabic = langContext.language === "ar";
  const t = isArabic ? copy.ar : copy.en;

  return (
    <section id="products" className="mx-auto w-full max-w-6xl py-5" dir={isArabic ? "rtl" : "ltr"}>
      <div className="mb-6 flex flex-col gap-2 text-start">
        <div className="h-1.5 w-20 rounded-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400" />
        <h1 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">{t.title}</h1>
        <p className="max-w-xl text-sm font-medium leading-6 text-slate-500">{t.subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {t.products.map((product, index) => {
          const Icon = product.icon;
          const accent = accentClasses[product.accent];
          return (
            <Link
              key={product.href}
              href={product.href}
              style={{ animationDelay: `${index * 55}ms` }}
              className={cn(
                "group relative flex min-h-[188px] overflow-hidden rounded-lg border border-slate-200 bg-white p-4 text-start shadow-sm transition-all duration-300 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20",
                accent.ring,
              )}
            >
              <span className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", accent.stripe)} aria-hidden />
              <span
                className={cn(
                  "pointer-events-none absolute -top-10 end-4 h-24 w-24 rotate-45 opacity-60 transition-transform duration-500 group-hover:translate-y-2 group-hover:rotate-[55deg]",
                  accent.glow,
                )}
                aria-hidden
              />
              <div className="flex items-start justify-between gap-3">
                <span
                  className={cn(
                    "relative z-[1] flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ring-1 transition-all duration-300 group-hover:scale-105",
                    accent.icon,
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                {product.status ? (
                  <span className={cn("relative z-[1] rounded-full px-2.5 py-1 text-[11px] font-bold ring-1", accent.badge)}>
                    {product.status}
                  </span>
                ) : null}
              </div>

              <div className="relative z-[1] mt-4 min-w-0 flex-1">
                <h2 className="text-[15px] font-black leading-6 text-slate-950">{product.title}</h2>
                <p className="mt-2 line-clamp-2 text-[12px] font-medium leading-5 text-slate-500">
                  {product.description}
                </p>
              </div>

              <div
                className={cn(
                  "relative z-[1] mt-4 inline-flex w-fit items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] font-black transition-all duration-300",
                  accent.cta,
                )}
              >
                {t.open}
                <ArrowLeft
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    isArabic ? "group-hover:-translate-x-0.5" : "rotate-180 group-hover:translate-x-0.5",
                  )}
                  aria-hidden
                />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
