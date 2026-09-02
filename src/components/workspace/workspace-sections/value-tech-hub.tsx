"use client";

import { useContext } from "react";
import Link from "@/components/prefetch-link";
import {
  ArrowUpRight,
  Building2,
  ClipboardList,
  Cpu,
  FileCog,
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
  status?: string;
};

const copy = {
  en: {
    pageTitle: "Value Tech Products & Services",
    // pageSubtitle:
    //   "Smart asset valuation solutions to support your decisions with confidence and professionalism.",
    navigate: "Go",
    soon: "Coming soon",
    products: [
      {
        href: "/machine-valuation",
        title: "Machines & Equipment Valuation",
        description: "Professional appraisal workflows for industrial assets and equipment.",
        icon: Cpu,
      },
      {
        href: "/real-estate-valuation",
        title: "Real Estate Valuation",
        description: "Structured workflows for professional real estate valuation operations.",
        icon: Building2,
      },
      {
        href: "/value-tech-app",
        title: "Report Upload System",
        description: "Manage valuation reports and submissions through the desktop application.",
        icon: LayoutGrid,
      },
      {
        href: "/evaluation-source",
        title: "Information Sources",
        description: "Market data, pricing references, and sources that support valuation decisions.",
        icon: Library,
      },
      {
        href: "/asset-inventory",
        title: "Asset Inventory",
        description: "Count, classify, and track organization assets accurately.",
        icon: ClipboardList,
      },
      {
        href: "/asset-inspection",
        title: "Asset Inspection",
        description: "Document asset condition and field inspection data.",
        icon: Search,
      },
      {
        href: "/helper-tools",
        title: "Helper Tools",
        description: "Fast local tools for PDF conversion and Saudi riyal number wording.",
        icon: FileCog,
      },
    ] satisfies ProductCard[],
  },
  ar: {
    pageTitle: "منتجات وخدمات فاليو تك",
    // pageSubtitle: "حلول تقييم الأصول الذكية لدعم قراراتك بثقة واحترافية",
    navigate: "انتقال",
    soon: "قريبًا",
    products: [
      {
        href: "/machine-valuation",
        title: "نظام تقييم الآلات والمعدات",
        description: "منصة متكاملة لتقييم الآلات والمعدات الصناعية وفق أعلى المعايير المهنية.",
        icon: Cpu,
      },
      {
        href: "/real-estate-valuation",
        title: "نظام تقييم العقارات",
        description: "مسار عمل منظم لعمليات تقييم العقارات باحترافية.",
        icon: Building2,
      },
      {
        href: "/value-tech-app",
        title: "نظام رفع التقارير",
        description: "إدارة تقارير التقييم ورفعها من خلال تطبيق سطح المكتب.",
        icon: LayoutGrid,
      },
      {
        href: "/evaluation-source",
        title: "مصادر المعلومات",
        description: "بيانات السوق ومصادر الأسعار والمراجع الداعمة لقرارات التقييم.",
        icon: Library,
      },
      {
        href: "/asset-inventory",
        title: "تطبيق حصر الأصول",
        description: "حصر وتصنيف وتتبع أصول المنشأة بدقة.",
        icon: ClipboardList,
      },
      {
        href: "/asset-inspection",
        title: "تطبيق معاينة الأصول",
        description: "توثيق حالة الأصول وبيانات المعاينة الميدانية.",
        icon: Search,
      },
      {
        href: "/helper-tools",
        title: "الأدوات المساعدة",
        description: "أدوات محلية سريعة لتحويل الملفات وتفقيط  .",
        icon: FileCog,
      },
    ] satisfies ProductCard[],
  },
} as const;

function ProductCardTile({
  product,
  navigateLabel,
  soonLabel,
  isArabic,
  index,
}: {
  product: ProductCard;
  navigateLabel: string;
  soonLabel: string;
  isArabic: boolean;
  index: number;
}) {
  const Icon = product.icon;

  const body = (
    <div
      className="relative z-[1] flex h-full min-h-[9rem] flex-col p-5 sm:min-h-[9.25rem] sm:p-6"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <div className="flex items-start gap-4">
        <div className="vt-product-icon-ring">
          <Icon className="vt-product-icon" strokeWidth={1.65} aria-hidden />
        </div>

        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
          <h2 className="vt-product-title sm:text-[1.02rem]">{product.title}</h2>
          {product.status ? (
            <span className="vt-product-soon-badge">{product.status ?? soonLabel}</span>
          ) : null}
          <p className="line-clamp-2 text-xs leading-5 text-slate-500">{product.description}</p>
        </div>
      </div>

      <div
        className={cn(
          "vt-product-card-footer mt-auto flex pt-4",
          isArabic ? "justify-end" : "justify-start",
        )}
      >
        <span className="vt-product-navigate">
          {navigateLabel}
          <ArrowUpRight
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
              isArabic && "-scale-x-100 group-hover:translate-x-[-2px]",
            )}
            aria-hidden
          />
        </span>
      </div>
    </div>
  );

  const className = cn(
    "group vt-product-card text-start motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1",
  );

  return (
    <Link
      href={product.href}
      style={{ animationDelay: `${index * 50}ms` }}
      className={cn(
        className,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9963a]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
      )}
    >
      {body}
    </Link>
  );
}

export default function ValueTechHubSection() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;

  const isArabic = langContext.language === "ar";
  const t = isArabic ? copy.ar : copy.en;

  return (
    <section
      id="products"
      className="flex w-full flex-col py-0"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <header className="vt-products-hero">
        <h1 className="vt-products-hero-title text-xl font-black tracking-tight sm:text-[1.65rem]">
          {t.pageTitle}
        </h1>
        <div className="vt-products-hero-divider" aria-hidden />
        {/* <p className="vt-products-hero-subtitle">{t.pageSubtitle}</p> */}
      </header>

      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3 xl:gap-6">
        {t.products.map((product, index) => (
          <ProductCardTile
            key={product.href}
            product={product}
            navigateLabel={t.navigate}
            soonLabel={t.soon}
            isArabic={isArabic}
            index={index}
          />
        ))}
      </div>
    </section>
  );
}
