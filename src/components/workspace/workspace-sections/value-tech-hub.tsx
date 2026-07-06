"use client";

import { useContext } from "react";
import Link from "@/components/prefetch-link";
import {
  ArrowUpRight,
  Building2,
  ClipboardList,
  Cpu,
  FileText,
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
        description: "Structured property valuation aligned with market standards.",
        icon: Building2,
      },
      {
        href: "/value-tech-app",
        title: "Report Upload System",
        description: "Upload and manage valuation reports with confidence.",
        icon: FileText,
      },
      {
        href: "/evaluation-source",
        title: "Information Sources",
        description: "Centralized references and valuation data sources.",
        icon: Library,
      },
      {
        href: "/asset-inventory",
        title: "Asset Inventory",
        description: "Field-ready workflows for asset counting and verification.",
        icon: ClipboardList,
        status: "Coming soon",
      },
      {
        href: "/asset-inspection",
        title: "Asset Inspection",
        description: "On-site inspection tools for asset condition review.",
        icon: Search,
        status: "Coming soon",
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
        description: "حلول تقييم عقاري منظمة ومتوافقة مع متطلبات السوق والمعايير المعتمدة.",
        icon: Building2,
      },
      {
        href: "/value-tech-app",
        title: "نظام رفع التقارير",
        description: "رفع وإدارة تقارير التقييم بسهولة وموثوقية عالية.",
        icon: FileText,
      },
      {
        href: "/evaluation-source",
        title: "مصادر المعلومات",
        description: "مرجع موحد لمصادر البيانات والمعلومات الداعمة لعمليات التقييم.",
        icon: Library,
      },
      {
        href: "/asset-inventory",
        title: "تطبيق حصر الأصول",
        description: "أدوات ميدانية لحصر الأصول والتحقق منها بدقة.",
        icon: ClipboardList,
        status: "قريبًا",
      },
      {
        href: "/asset-inspection",
        title: "تطبيق معاينة الأصول",
        description: "معاينة ميدانية لحالة الأصول وتوثيقها بشكل احترافي.",
        icon: Search,
        status: "قريبًا",
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
  const isSoon = Boolean(product.status);

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
          {isSoon ? (
            <span className="vt-product-soon-badge">{product.status ?? soonLabel}</span>
          ) : null}
        </div>
      </div>

      {!isSoon ? (
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
      ) : null}
    </div>
  );

  const className = cn(
    "group vt-product-card text-start motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1",
    isSoon && "vt-product-card--soon cursor-default",
  );

  if (isSoon) {
    return (
      <div
        style={{ animationDelay: `${index * 50}ms` }}
        className={className}
        aria-disabled
      >
        {body}
      </div>
    );
  }

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
