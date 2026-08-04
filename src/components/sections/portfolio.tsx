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
        color: "from-indigo-500 to-violet-500",
      },
      {
        href: "/real-estate-valuation",
        title: "نظام تقييم العقارات",
        description: "مسار عمل منظم يساعد فرق التقييم على تنفيذ عمليات تقييم العقارات بدقة وسهولة.",
        icon: Building2,
        color: "from-sky-500 to-blue-600",
      },
      {
        href: "/value-tech-app",
        title: "نظام رفع التقارير",
        description: "تطبيق مخصص لإدارة تقارير التقييم ورفعها ومتابعة عمليات الإرسال من مكان واحد.",
        icon: LayoutGrid,
        color: "from-emerald-500 to-teal-600",
      },
      {
        href: "/evaluation-source",
        title: "مصادر المعلومات",
        description: "مكتبة رقمية لمصادر الأسعار وبيانات السوق والمراجع المساندة لاتخاذ قرارات تقييم أدق.",
        icon: Library,
        color: "from-cyan-500 to-sky-600",
      },
      {
        href: "/asset-inventory",
        title: "تطبيق حصر الأصول",
        description: "حل رقمي لحصر أصول المنشأة وتصنيفها وتنظيم بياناتها ومتابعتها بكفاءة.",
        icon: ClipboardList,
        color: "from-violet-500 to-fuchsia-600",
      },
      {
        href: "/asset-inspection",
        title: "تطبيق معاينة الأصول",
        description: "أداة ميدانية لتسجيل حالة الأصول وتوثيق بيانات وصور المعاينة بطريقة منظمة.",
        icon: Search,
        color: "from-orange-500 to-amber-600",
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
        color: "from-indigo-500 to-violet-500",
      },
      {
        href: "/real-estate-valuation",
        title: "Real Estate Valuation",
        description: "A structured workflow that helps valuation teams complete property appraisals accurately.",
        icon: Building2,
        color: "from-sky-500 to-blue-600",
      },
      {
        href: "/value-tech-app",
        title: "Report Upload System",
        description: "A dedicated application for managing, uploading, and tracking valuation reports in one place.",
        icon: LayoutGrid,
        color: "from-emerald-500 to-teal-600",
      },
      {
        href: "/evaluation-source",
        title: "Information Sources",
        description: "A digital library of market data, pricing sources, and references for better valuation decisions.",
        icon: Library,
        color: "from-cyan-500 to-sky-600",
      },
      {
        href: "/asset-inventory",
        title: "Asset Inventory",
        description: "A digital solution for counting, classifying, organizing, and tracking company assets.",
        icon: ClipboardList,
        color: "from-violet-500 to-fuchsia-600",
      },
      {
        href: "/asset-inspection",
        title: "Asset Inspection",
        description: "A field tool for recording asset condition and documenting inspection data and photos.",
        icon: Search,
        color: "from-orange-500 to-amber-600",
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
    <section id="portfolio" className="container py-16 md:py-24">
      <div className="mx-auto max-w-5xl text-center">
        <div className="animation-fade-in-up">
          <SectionHeading
            title={t.title}
            subtitle={t.subtitle}
          />
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {t.products.map((product, index) => {
          const Icon = product.icon;
          return (
            <Link
              key={product.href}
              href={product.href}
              className="group animation-fade-in-up relative flex min-h-64 flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 text-start shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              style={{ animationDelay: `${0.4 + index * 0.1}s` }}
            >
              <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${product.color}`} />
              <span className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${product.color} text-white shadow-md`}>
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-foreground">{product.title}</h3>
              <p className="mt-3 flex-1 text-sm leading-7 text-muted-foreground">{product.description}</p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                {t.open}
                <ArrowUpLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
