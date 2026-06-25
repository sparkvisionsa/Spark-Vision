"use client";

import { useContext } from "react";
import Link from "@/components/prefetch-link";
import {
  ArrowUpRight,
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
  icon: LucideIcon;
  status?: string;
};

const copy = {
  en: {
    pageTitle: "Value Tech Products & Services",
    navigate: "Go",
    soon: "Coming soon",
    products: [
      { href: "/machine-valuation", title: "Machines & Equipment Valuation", icon: Cpu },
      { href: "/real-estate-valuation", title: "Real Estate Valuation", icon: Building2 },
      { href: "/value-tech-app", title: "Report Upload System", icon: LayoutGrid },
      { href: "/evaluation-source", title: "Information Sources", icon: Library },
      { href: "/asset-inventory", title: "Asset Inventory", icon: ClipboardList, status: "Coming soon" },
      { href: "/asset-inspection", title: "Asset Inspection", icon: Search, status: "Coming soon" },
    ] satisfies ProductCard[],
  },
  ar: {
    pageTitle: "منتجات وخدمات فاليو تك",
    navigate: "انتقال",
    soon: "قريبًا",
    products: [
      { href: "/machine-valuation", title: "نظام تقييم الآلات والمعدات", icon: Cpu },
      { href: "/real-estate-valuation", title: "نظام تقييم العقارات", icon: Building2 },
      { href: "/value-tech-app", title: "نظام رفع التقارير", icon: LayoutGrid },
      { href: "/evaluation-source", title: "مصادر المعلومات", icon: Library },
      { href: "/asset-inventory", title: "تطبيق حصر الأصول", icon: ClipboardList, status: "قريبًا" },
      { href: "/asset-inspection", title: "تطبيق معاينة الأصول", icon: Search, status: "قريبًا" },
    ] satisfies ProductCard[],
  },
} as const;

/** لون كحلي موحّد للصفحة والكاردات */
const NAVY = "#0c2547";

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
    <>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10"
        aria-hidden
      />

      <div className="relative z-[1] flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] ring-1 ring-white/10 transition-colors duration-300 group-hover:bg-white/[0.11] group-hover:ring-white/20">
          <Icon className="h-[18px] w-[18px] text-slate-200" strokeWidth={2} aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14px] font-bold leading-snug text-white sm:text-[15px]">
            {product.title}
          </h2>
          {!isSoon ? (
            <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 transition-colors group-hover:text-slate-200">
              {navigateLabel}
              <ArrowUpRight
                className={cn(
                  "h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5",
                  isArabic && "-scale-x-100 group-hover:-translate-x-0.5",
                )}
                aria-hidden
              />
            </span>
          ) : (
            <span className="mt-1 inline-block text-[11px] font-medium text-slate-500">
              {product.status ?? soonLabel}
            </span>
          )}
        </div>

        {!isSoon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-slate-300 transition-all duration-300 group-hover:border-white/20 group-hover:bg-white/[0.08] group-hover:text-white">
            <ArrowUpRight
              className={cn("h-3.5 w-3.5", isArabic && "-scale-x-100")}
              aria-hidden
            />
          </span>
        ) : null}
      </div>
    </>
  );

  const className = cn(
    "group relative overflow-hidden rounded-2xl border border-white/[0.08] p-3.5 text-start transition-all duration-300 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1",
    !isSoon && "hover:-translate-y-0.5 hover:border-white/18 hover:bg-white/[0.04]",
    isSoon && "cursor-default opacity-55",
  );

  if (isSoon) {
    return (
      <div style={{ animationDelay: `${index * 40}ms`, backgroundColor: NAVY }} className={className} aria-disabled>
        {body}
      </div>
    );
  }

  return (
    <Link
      href={product.href}
      style={{ animationDelay: `${index * 40}ms`, backgroundColor: NAVY }}
      className={cn(className, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25")}
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
      className="flex w-full flex-col justify-center gap-6 py-4 md:gap-7 md:py-6"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <header className="text-center md:text-start">
        <div className="mx-auto mb-3 h-1 w-16 rounded-full bg-white/25 md:mx-0" />
        <h1 className="text-2xl font-black tracking-tight text-white md:text-[1.75rem]">
          {t.pageTitle}
        </h1>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
