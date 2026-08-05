"use client";

import React, { useContext } from "react";
import Link from "@/components/prefetch-link";
import {
  ArrowUpLeft,
  Building2,
  ClipboardList,
  Cpu,
  LayoutGrid,
  Library,
  Search,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "../ui/heading";
import { LanguageContext } from "../layout-provider";
import { SectionReveal } from "./section-reveal";

type ProductCard = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: string;
};

const portfolioCopy = {
  ar: {
    title: "أعمالنا",
    subtitle: "تعرّف على منتجات فاليو تك المصممة لتطوير أعمال التقييم وإدارة الأصول.",
    open: "عرض المنتج",
    products: [
      {
        href: "/machine-valuation",
        title: "نظام تقييم الآلات والمعدات",
        description: "منصة متكاملة لإدارة مشاريع تقييم الآلات والمعدات وإعداد بيانات وتقارير التقييم باحترافية.",
        icon: Cpu,
        color: "from-primary to-sky-600",
      },
      {
        href: "/real-estate-valuation",
        title: "نظام تقييم العقارات",
        description: "مسار عمل منظم يساعد فرق التقييم على تنفيذ عمليات تقييم العقارات بدقة وسهولة.",
        icon: Building2,
        color: "from-slate-700 to-slate-900",
      },
      {
        href: "/value-tech-app",
        title: "نظام رفع التقارير",
        description: "تطبيق مخصص لإدارة تقارير التقييم ورفعها ومتابعة عمليات الإرسال من مكان واحد.",
        icon: LayoutGrid,
        color: "from-teal-600 to-cyan-700",
      },
      {
        href: "/evaluation-source",
        title: "مصادر المعلومات",
        description: "مكتبة رقمية لمصادر الأسعار وبيانات السوق والمراجع المساندة لاتخاذ قرارات تقييم أدق.",
        icon: Library,
        color: "from-sky-600 to-blue-700",
      },
      {
        href: "/asset-inventory",
        title: "تطبيق حصر الأصول",
        description: "حل رقمي لحصر أصول المنشأة وتصنيفها وتنظيم بياناتها ومتابعتها بكفاءة.",
        icon: ClipboardList,
        color: "from-indigo-600 to-slate-700",
      },
      {
        href: "/asset-inspection",
        title: "تطبيق معاينة الأصول",
        description: "أداة ميدانية لتسجيل حالة الأصول وتوثيق بيانات وصور المعاينة بطريقة منظمة.",
        icon: Search,
        color: "from-cyan-700 to-teal-700",
      },
    ] satisfies ProductCard[],
  },
  en: {
    title: "Our Work",
    subtitle: "Explore Value Tech products built for valuation operations and asset management.",
    open: "View product",
    products: [
      {
        href: "/machine-valuation",
        title: "Machines & Equipment Valuation",
        description: "An integrated platform for managing machinery valuation projects, data, and professional reports.",
        icon: Cpu,
        color: "from-primary to-sky-600",
      },
      {
        href: "/real-estate-valuation",
        title: "Real Estate Valuation",
        description: "A structured workflow that helps valuation teams complete property appraisals accurately.",
        icon: Building2,
        color: "from-slate-700 to-slate-900",
      },
      {
        href: "/value-tech-app",
        title: "Report Upload System",
        description: "A dedicated application for managing, uploading, and tracking valuation reports in one place.",
        icon: LayoutGrid,
        color: "from-teal-600 to-cyan-700",
      },
      {
        href: "/evaluation-source",
        title: "Information Sources",
        description: "A digital library of market data, pricing sources, and references for better valuation decisions.",
        icon: Library,
        color: "from-sky-600 to-blue-700",
      },
      {
        href: "/asset-inventory",
        title: "Asset Inventory",
        description: "A digital solution for counting, classifying, organizing, and tracking company assets.",
        icon: ClipboardList,
        color: "from-indigo-600 to-slate-700",
      },
      {
        href: "/asset-inspection",
        title: "Asset Inspection",
        description: "A field tool for recording asset condition and documenting inspection data and photos.",
        icon: Search,
        color: "from-cyan-700 to-teal-700",
      },
    ] satisfies ProductCard[],
  },
} as const;

export default function PortfolioSection() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;
  const { language } = langContext;
  const t = portfolioCopy[language];

  return (
    <section id="portfolio" className="home-section home-section-soft py-20 md:py-28">
      <div className="container relative">
        <SectionReveal className="mx-auto max-w-5xl text-center">
          <SectionHeading title={t.title} subtitle={t.subtitle} className="home-section-heading" />
        </SectionReveal>

      <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {t.products.map((product, index) => {
          const Icon = product.icon;
          return (
            <SectionReveal
              key={product.href}
              className="h-full"
              delay={80 + index * 65}
            >
              <Link
                href={product.href}
                className="home-product-card group relative flex min-h-64 h-full flex-col rounded-2xl border bg-card/90 p-6 text-start backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${product.color}`} />
                <span className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${product.color} text-white shadow-lg transition-transform duration-500 group-hover:scale-105 group-hover:rotate-2`}>
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="relative z-10 mt-5 text-lg font-bold tracking-tight text-foreground">{product.title}</h3>
                <p className="relative z-10 mt-3 flex-1 text-sm leading-7 text-muted-foreground">{product.description}</p>
                <span className="relative z-10 mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">
                  {t.open}
                  <ArrowUpLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1 group-hover:-translate-y-1" aria-hidden="true" />
                </span>
              </Link>
            </SectionReveal>
          );
        })}
      </div>
      </div>
    </section>
  );
}
