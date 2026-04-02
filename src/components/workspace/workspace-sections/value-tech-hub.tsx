"use client";

import { useContext, useEffect, useRef } from "react";
import Link from "@/components/prefetch-link";
import Image from "next/image";
import { ArrowLeft, Building2, ClipboardList, Cpu, LayoutGrid, Library, Search } from "lucide-react";
import { LanguageContext } from "@/components/layout-provider";
import ValueTechHero from "@/components/value-tech-hero";

const copy = {
  en: {
    heroTitle: "Value Tech",
    heroSubtitle: "One hub for valuation products and workflows. Professional tools, trusted data, and clear steps for real estate and machinery.",
    heroCta: "Explore our products",
    heroCtaHint: "Scroll to our products section",
    introTitle: "About Value Tech",
    introSubtitle: "Your all-in-one digital platform for professional valuation operations",
    introBody:
      "Value Tech brings together everything you need to run valuation workflows with precision, speed, and confidence. A unified experience designed for professionals who demand quality.",
    introHighlights: [
      { title: "Valuation Systems", desc: "Real estate and machinery valuations with structured, repeatable workflows that ensure accuracy every time." },
      { title: "Report Management", desc: "Upload, manage, and track your valuation reports through a powerful desktop application with guided steps." },
      { title: "Data Sources", desc: "A centralized library of market data, references, and pricing intelligence to support every decision." },
      { title: "Asset Tools", desc: "Comprehensive inventory counting and on-site inspection tools to document and track all your assets." },
    ] as { title: string; desc: string }[],
    desktopTitle: "Report Upload System",
    desktopDescription: "Professional desktop application to manage valuation reports and submissions with clear, guided steps.",
    desktopHoverDesc: "Manage reports and submissions from one powerful desktop app.",
    sourcesTitle: "Information Sources System",
    sourcesDescription: "Central library of valuation references and market data to support accurate decisions.",
    sourcesHoverDesc: "Access trusted references and market data in one place.",
    realEstateTitle: "Real Estate Valuation System",
    realEstateDescription: "Structured, step-by-step workflow to complete real estate valuations with confidence.",
    realEstateHoverDesc: "Complete property valuations with guided, repeatable steps.",
    machinesTitle: "Machines Valuation System",
    machinesDescription: "Coming soon: a dedicated flow to manage and document machinery and equipment valuations.",
    machinesHoverDesc: "Document and value machinery and equipment—coming soon.",
    assetInventoryTitle: "Asset Inventory System",
    assetInventoryDescription: "Coming soon: a comprehensive tool to count, classify, and track all your organization's assets accurately.",
    assetInventoryHoverDesc: "Count, classify, and manage every asset in your organization.",
    assetInspectionTitle: "Asset Inspection System",
    assetInspectionDescription: "Coming soon: a specialized application to inspect, evaluate, and document the condition of assets on-site.",
    assetInspectionHoverDesc: "Inspect and document asset conditions with guided workflows.",
    comingSoon: "Coming soon",
    startNow: "Start Now",
    productsSectionTitle: "Our products",
    statsProducts: "Products & Systems",
    statsDigital: "Digital & Cloud",
    statsAvailable: "Always Available",
  },
  ar: {
    heroTitle: "فاليو تك",
    heroSubtitle: "منصة واحدة لمنتجات ومسارات التقييم. أدوات احترافية، بيانات موثوقة، وخطوات واضحة للعقارات والآلات.",
    heroCta: "استكشاف منتجاتنا",
    heroCtaHint: "الانتقال إلى قسم المنتجات",
    introTitle: "نبذة عن فاليو تك",
    introSubtitle: "منصتك الرقمية المتكاملة لعمليات التقييم الاحترافية",
    introBody:
      "فاليو تك تجمع كل ما تحتاجه لإدارة مسارات التقييم بدقة وسرعة وثقة. تجربة موحدة مصممة للمحترفين الذين يطلبون الجودة.",
    introHighlights: [
      { title: "أنظمة التقييم", desc: "تقييم العقارات والآلات بمسارات عمل منظمة وقابلة للتكرار تضمن الدقة في كل مرة." },
      { title: "إدارة التقارير", desc: "ارفع وأدِر وتابع تقارير التقييم من خلال تطبيق سطح مكتب احترافي بخطوات موجهة." },
      { title: "مصادر البيانات", desc: "مكتبة مركزية لبيانات السوق والمراجع والمعلومات السعرية لدعم كل قرار تقييمي." },
      { title: "أدوات الأصول", desc: "أدوات شاملة لحصر الأصول ومعاينتها ميدانيًا لتوثيق وتتبع جميع ممتلكات مؤسستك." },
    ] as { title: string; desc: string }[],
    desktopTitle: "نظام رفع التقارير",
    desktopDescription: "تطبيق احترافي لإدارة تقارير التقييم ورفعها بخطوات واضحة وموجهة.",
    desktopHoverDesc: "إدارة التقارير والرفع من تطبيق سطح مكتب واحد.",
    sourcesTitle: "مصادر المعلومات",
    sourcesDescription: "مكتبة مركزية لمصادر بيانات التقييم والأسعار لدعم قرارات أدق.",
    sourcesHoverDesc: "الوصول إلى مراجع وبيانات السوق الموثوقة في مكان واحد.",
    realEstateTitle: "نظام تقييم العقارات",
    realEstateDescription: "عملية تقييم عقاري بخطوات ثابتة وواضحة من البداية حتى الاعتماد.",
    realEstateHoverDesc: "إنجاز تقييمات العقارات بخطوات موجهة وقابلة للتكرار.",
    machinesTitle: "نظام تقييم الآلات",
    machinesDescription: "قريبًا: مسار مخصص لإدارة وتوثيق تقييم المعدات والآلات.",
    machinesHoverDesc: "توثيق وتقييم المعدات والآلات — قريبًا.",
    assetInventoryTitle: "تطبيق حصر الأصول",
    assetInventoryDescription: "قريبًا: أداة شاملة لحصر وتصنيف وتتبع جميع أصول مؤسستك بدقة وكفاءة.",
    assetInventoryHoverDesc: "حصر وتصنيف وإدارة كل أصل في مؤسستك.",
    assetInspectionTitle: "تطبيق معاينة الأصول",
    assetInspectionDescription: "قريبًا: تطبيق متخصص لمعاينة وتقييم وتوثيق حالة الأصول ميدانيًا.",
    assetInspectionHoverDesc: "معاينة وتوثيق حالة الأصول بمسارات عمل موجهة.",
    comingSoon: "قريبًا",
    startNow: "ابدأ الآن",
    productsSectionTitle: "منتجاتنا",
    statsProducts: "منتجات وأنظمة",
    statsDigital: "رقمي وسحابي",
    statsAvailable: "وصول متاح دائمًا",
  },
} as const;

function useScrollReveal() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const targets = root.querySelectorAll(
      ".vt-reveal, .vt-reveal-scale, .vt-card-stagger, .vt-count-pop",
    );

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("vt-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );

    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return containerRef;
}

export default function ValueTechHubSection() {
  const langContext = useContext(LanguageContext);
  const containerRef = useScrollReveal();

  if (!langContext) return null;

  const isArabic = langContext.language === "ar";
  const t = isArabic ? copy.ar : copy.en;

  return (
    <div ref={containerRef}>
      {/* ═══ Hero ═══ */}
      <ValueTechHero
        copy={{
          badge: "",
          title: t.heroTitle,
          subtitle: t.heroSubtitle,
          cta: t.heroCta,
          ctaHint: t.heroCtaHint,
        }}
        isArabic={isArabic}
        videoSrc="https://assets.mixkit.co/videos/preview/mixkit-digital-animation-of-data-and-network-connections-41372-large.mp4"
        className="animation-fade-in-up"
        ctaScrollToId="products"
      />

      {/* ═══ Shimmer divider ═══ */}
      <div className="my-8 flex items-center gap-4">
        <div className="vt-shimmer-line flex-1" />
        <div className="vt-pulse-ring flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/20">
          <svg width="14" height="14" viewBox="0 0 36 36" fill="none" aria-hidden="true">
            <path d="M11.5 11L18 26L24.5 11" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="vt-shimmer-line flex-1" />
      </div>

      {/* ═══ About section ═══ */}
      <section className="vt-reveal-scale relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white via-slate-50/80 to-emerald-50/40 shadow-sm">
        {/* Decorative orbs */}
        <div className="vt-float-slow absolute -top-20 -end-20 h-56 w-56 rounded-full bg-gradient-to-br from-emerald-400/12 to-cyan-400/12 blur-3xl" />
        <div className="vt-float-medium absolute -bottom-16 -start-16 h-44 w-44 rounded-full bg-gradient-to-tr from-sky-400/12 to-teal-400/12 blur-3xl" />
        <div className="vt-float-medium absolute top-1/3 end-1/4 h-32 w-32 rounded-full bg-gradient-to-br from-violet-400/6 to-pink-400/6 blur-3xl" />

        {/* Header */}
        <div className="relative p-6 md:p-8 pb-0 md:pb-0">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
            <div className="vt-pulse-ring flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/20">
              <svg width="24" height="24" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                <path d="M11.5 11L18 26L24.5 11" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18 7.5L19.2 9.5L18 11.5L16.8 9.5Z" fill="white" fillOpacity="0.8" />
              </svg>
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
                {t.introTitle}
              </h2>
              <p className="text-sm font-medium bg-gradient-to-r from-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                {t.introSubtitle}
              </p>
              <p className="text-[13px] leading-[1.7] text-slate-600 pt-1">
                {t.introBody}
              </p>
            </div>
          </div>
        </div>

        {/* Product highlights grid */}
        <div className="relative grid gap-3 p-6 md:p-8 pt-5 md:pt-5 sm:grid-cols-2">
          {t.introHighlights.map((item, i) => {
            const colors = [
              { bg: "bg-emerald-50", border: "border-emerald-200/60", dot: "bg-emerald-500", text: "text-emerald-700" },
              { bg: "bg-sky-50", border: "border-sky-200/60", dot: "bg-sky-500", text: "text-sky-700" },
              { bg: "bg-cyan-50", border: "border-cyan-200/60", dot: "bg-cyan-500", text: "text-cyan-700" },
              { bg: "bg-violet-50", border: "border-violet-200/60", dot: "bg-violet-500", text: "text-violet-700" },
            ];
            const c = colors[i % colors.length];
            return (
              <div
                key={i}
                className={`vt-count-pop rounded-xl border ${c.border} ${c.bg} p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`h-2 w-2 rounded-full ${c.dot}`} />
                  <h3 className={`text-[13px] font-bold ${c.text}`}>{item.title}</h3>
                </div>
                <p className="text-[11px] leading-[1.7] text-slate-600">{item.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Stats bar */}
        <div className="relative border-t border-slate-200/60 bg-slate-50/50 px-6 py-4 md:px-8">
          <div className="grid grid-cols-3 gap-3">
            <div className="vt-count-pop text-center">
              <p className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent md:text-2xl">6+</p>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500 md:text-[11px]">{t.statsProducts}</p>
            </div>
            <div className="vt-count-pop text-center">
              <p className="text-xl font-bold bg-gradient-to-r from-cyan-600 to-sky-600 bg-clip-text text-transparent md:text-2xl">100%</p>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500 md:text-[11px]">{t.statsDigital}</p>
            </div>
            <div className="vt-count-pop text-center">
              <p className="text-xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent md:text-2xl">24/7</p>
              <p className="mt-0.5 text-[10px] font-medium text-slate-500 md:text-[11px]">{t.statsAvailable}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Shimmer divider ═══ */}
      <div className="my-8 flex items-center gap-3">
        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 vt-float-medium" />
        <div className="vt-shimmer-line flex-1" />
        <div className="h-2 w-2 rounded-full bg-cyan-400 vt-float-slow" />
        <div className="vt-shimmer-line flex-1" />
        <div className="h-1.5 w-1.5 rounded-full bg-sky-400 vt-float-medium" />
      </div>

      {/* ═══ Products section ═══ */}
      <section id="products" className="scroll-mt-8">
        <div className="vt-reveal mb-6 flex items-center gap-3">
          <div className="h-8 w-1 rounded-full bg-gradient-to-b from-emerald-500 to-cyan-500" />
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            {t.productsSectionTitle}
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Desktop App */}
          <Link href="/value-tech-app" className="vt-card-stagger group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300/80 hover:shadow-lg hover:shadow-emerald-500/8">
            <div className="relative h-32 overflow-hidden">
              <Image src="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80" alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-110" sizes="(max-width:640px) 100vw, 33vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 transition-all duration-300 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
                <p className="text-[11px] leading-relaxed text-white/90">{t.desktopHoverDesc}</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 transition-colors group-hover:bg-emerald-200">
                  <LayoutGrid className="h-4 w-4" />
                </div>
                <h3 className="text-[13px] font-semibold text-slate-900 leading-tight">{t.desktopTitle}</h3>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 line-clamp-2">{t.desktopDescription}</p>
              <div className="mt-3 flex items-center justify-end">
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-all group-hover:bg-emerald-700 group-hover:shadow-md group-hover:shadow-emerald-500/20">
                  {t.startNow}
                  <ArrowLeft className={`h-3 w-3 transition-transform duration-300 group-hover:${isArabic ? "-translate-x-0.5" : "translate-x-0.5"} ${isArabic ? "" : "rotate-180"}`} />
                </span>
              </div>
            </div>
          </Link>

          {/* Information Sources */}
          <Link href="/evaluation-source" className="vt-card-stagger group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/80 hover:shadow-lg hover:shadow-cyan-500/8">
            <div className="relative h-32 overflow-hidden">
              <Image src="https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=80" alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-110" sizes="(max-width:640px) 100vw, 33vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 transition-all duration-300 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
                <p className="text-[11px] leading-relaxed text-white/90">{t.sourcesHoverDesc}</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 transition-colors group-hover:bg-cyan-200">
                  <Library className="h-4 w-4" />
                </div>
                <h3 className="text-[13px] font-semibold text-slate-900 leading-tight">{t.sourcesTitle}</h3>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 line-clamp-2">{t.sourcesDescription}</p>
              <div className="mt-3 flex items-center justify-end">
                <span className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-all group-hover:bg-cyan-700 group-hover:shadow-md group-hover:shadow-cyan-500/20">
                  {t.startNow}
                  <ArrowLeft className={`h-3 w-3 ${isArabic ? "" : "rotate-180"}`} />
                </span>
              </div>
            </div>
          </Link>

          {/* Real Estate */}
          <Link href="/real-estate-valuation" className="vt-card-stagger group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-sky-300/80 hover:shadow-lg hover:shadow-sky-500/8">
            <div className="relative h-32 overflow-hidden">
              <Image src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&q=80" alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-110" sizes="(max-width:640px) 100vw, 33vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 transition-all duration-300 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
                <p className="text-[11px] leading-relaxed text-white/90">{t.realEstateHoverDesc}</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 transition-colors group-hover:bg-sky-200">
                  <Building2 className="h-4 w-4" />
                </div>
                <h3 className="text-[13px] font-semibold text-slate-900 leading-tight">{t.realEstateTitle}</h3>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 line-clamp-2">{t.realEstateDescription}</p>
              <div className="mt-3 flex items-center justify-end">
                <span className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-all group-hover:bg-sky-700 group-hover:shadow-md group-hover:shadow-sky-500/20">
                  {t.startNow}
                  <ArrowLeft className={`h-3 w-3 ${isArabic ? "" : "rotate-180"}`} />
                </span>
              </div>
            </div>
          </Link>

          {/* Machines - Coming Soon */}
          <Link href="/machine-valuation" className="vt-card-stagger group relative flex flex-col overflow-hidden rounded-2xl border border-dashed border-slate-300/80 bg-white/60 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-300/80 hover:bg-white hover:shadow-lg hover:shadow-emerald-500/8">
            <div className="relative h-32 overflow-hidden">
              <Image src="https://images.unsplash.com/photo-1565043666747-69f6646db940?w=400&q=80" alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-110" sizes="(max-width:640px) 100vw, 33vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 transition-all duration-300 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
                <p className="text-[11px] leading-relaxed text-white/90">{t.machinesHoverDesc}</p>
              </div>
              <div className="absolute top-2 end-2 rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
                {t.comingSoon}
              </div>
            </div>
            <div className="flex flex-1 flex-col p-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Cpu className="h-4 w-4" />
                </div>
                <h3 className="text-[13px] font-semibold text-slate-900 leading-tight">{t.machinesTitle}</h3>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 line-clamp-2">{t.machinesDescription}</p>
              <div className="mt-3 flex items-center justify-end">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-500">{t.comingSoon}</span>
              </div>
            </div>
          </Link>

          {/* Asset Inventory - Coming Soon */}
          <Link href="/asset-inventory" className="vt-card-stagger group relative flex flex-col overflow-hidden rounded-2xl border border-dashed border-slate-300/80 bg-white/60 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-violet-300/80 hover:bg-white hover:shadow-lg hover:shadow-violet-500/8">
            <div className="relative h-32 overflow-hidden">
              <Image src="https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=80" alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-110" sizes="(max-width:640px) 100vw, 33vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 transition-all duration-300 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
                <p className="text-[11px] leading-relaxed text-white/90">{t.assetInventoryHoverDesc}</p>
              </div>
              <div className="absolute top-2 end-2 rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
                {t.comingSoon}
              </div>
            </div>
            <div className="flex flex-1 flex-col p-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                  <ClipboardList className="h-4 w-4" />
                </div>
                <h3 className="text-[13px] font-semibold text-slate-900 leading-tight">{t.assetInventoryTitle}</h3>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 line-clamp-2">{t.assetInventoryDescription}</p>
              <div className="mt-3 flex items-center justify-end">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-500">{t.comingSoon}</span>
              </div>
            </div>
          </Link>

          {/* Asset Inspection - Coming Soon */}
          <Link href="/asset-inspection" className="vt-card-stagger group relative flex flex-col overflow-hidden rounded-2xl border border-dashed border-slate-300/80 bg-white/60 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-orange-300/80 hover:bg-white hover:shadow-lg hover:shadow-orange-500/8">
            <div className="relative h-32 overflow-hidden">
              <Image src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&q=80" alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-110" sizes="(max-width:640px) 100vw, 33vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 transition-all duration-300 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0">
                <p className="text-[11px] leading-relaxed text-white/90">{t.assetInspectionHoverDesc}</p>
              </div>
              <div className="absolute top-2 end-2 rounded-full bg-white/90 backdrop-blur-sm px-2.5 py-1 text-[10px] font-semibold text-slate-600 shadow-sm">
                {t.comingSoon}
              </div>
            </div>
            <div className="flex flex-1 flex-col p-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700">
                  <Search className="h-4 w-4" />
                </div>
                <h3 className="text-[13px] font-semibold text-slate-900 leading-tight">{t.assetInspectionTitle}</h3>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 line-clamp-2">{t.assetInspectionDescription}</p>
              <div className="mt-3 flex items-center justify-end">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-semibold text-slate-500">{t.comingSoon}</span>
              </div>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
