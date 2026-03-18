"use client";

import { useContext } from "react";
import Link from "@/components/prefetch-link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Building2, Cpu, ExternalLink, LayoutGrid, Library } from "lucide-react";
import { LanguageContext } from "@/components/layout-provider";
import ValueTechShell from "@/components/value-tech-shell";
import ValueTechHero from "@/components/value-tech-hero";

const copy = {
  en: {
    heroBadge: "Valuation platform",
    heroTitle: "Value Tech",
    heroSubtitle: "One hub for valuation products and workflows. Professional tools, trusted data, and clear steps for real estate and machinery.",
    heroCta: "Explore our products",
    heroCtaHint: "Scroll to our products section",
    title: "Value Tech",
    subtitle: "A unified hub for valuation products and workflows.",
    introTitle: "About Value Tech",
    introBody:
      "Value Tech is your digital workspace for running valuation operations with clarity and speed. From desktop applications to data sources and guided valuation flows, everything is organized in one modern experience inspired by leading business suites.",
    desktopTitle: "Value Tech Desktop App",
    desktopDescription:
      "Professional desktop application to manage valuation reports and submissions with clear, guided steps.",
    desktopHoverDesc: "Manage reports and submissions from one powerful desktop app.",
    sourcesTitle: "Information Sources",
    sourcesDescription:
      "Central library of valuation references and market data to support accurate decisions.",
    sourcesHoverDesc: "Access trusted references and market data in one place.",
    realEstateTitle: "Real Estate Valuation",
    realEstateDescription:
      "Structured, step-by-step workflow to complete real estate valuations with confidence.",
    realEstateHoverDesc: "Complete property valuations with guided, repeatable steps.",
    machinesTitle: "Machines Valuation",
    machinesDescription:
      "Coming soon: a dedicated flow to manage and document machinery and equipment valuations.",
    machinesHoverDesc: "Document and value machinery and equipment—coming soon.",
    sidebarUserGuest: "Guest",
    sidebarUserSubtitle: "Sign in later to sync your workspace.",
    sidebarSectionTitle: "Value Tech Products",
    sidebarRealEstate: "Real Estate Valuation",
    sidebarMachines: "Machines Valuation",
    sidebarSources: "Information Sources",
    sidebarApp: "Value Tech App",
    sidebarClients: "Clients",
    sidebarSettings: "Settings",
    comingSoon: "Coming soon",
    productsSectionTitle: "Our products",
  },
  ar: {
    heroBadge: "منصة التقييم",
    heroTitle: "فاليو تك",
    heroSubtitle: "منصة واحدة لمنتجات ومسارات التقييم. أدوات احترافية، بيانات موثوقة، وخطوات واضحة للعقارات والآلات.",
    heroCta: "استكشاف منتجاتنا",
    heroCtaHint: "الانتقال إلى قسم المنتجات",
    title: "فاليو تك",
    subtitle: "منصة موحدة لمنتجات وخدمات التقييم.",
    introTitle: "نبذة عن فاليو تك",
    introBody:
      "فاليو تك هي مساحة العمل الرقمية الخاصة بك لإدارة عمليات التقييم بسهولة وسلاسة. من استخدام نوع التقييم سواء الالات او عقارات إلى مصادر معلومات التقييم، وصولًا إلى تطبيق سطح المكتب المسئول عن رفع تقاريرك في اسرع وقت، كل شيء منظم في تجربة حديثة مستوحاة من منصات الأعمال الاحترافية.",
    desktopTitle: "تطبيق فاليو تك لسطح المكتب",
    desktopDescription:
      "تطبيق احترافي لإدارة تقارير التقييم ورفعها بخطوات واضحة وموجهة.",
    desktopHoverDesc: "إدارة التقارير والرفع من تطبيق سطح مكتب واحد.",
    sourcesTitle: "مصادر المعلومات",
    sourcesDescription:
      "مكتبة مركزية لمصادر بيانات التقييم والأسعار لدعم قرارات أدق.",
    sourcesHoverDesc: "الوصول إلى مراجع وبيانات السوق الموثوقة في مكان واحد.",
    realEstateTitle: "تقييم العقارات",
    realEstateDescription:
      "عملية تقييم عقاري بخطوات ثابتة وواضحة من البداية حتى الاعتماد.",
    realEstateHoverDesc: "إنجاز تقييمات العقارات بخطوات موجهة وقابلة للتكرار.",
    machinesTitle: "تقييم الآلات",
    machinesDescription:
      "قريبًا: مسار مخصص لإدارة وتوثيق تقييم المعدات والآلات.",
    machinesHoverDesc: "توثيق وتقييم المعدات والآلات — قريبًا.",
    sidebarUserGuest: "ضيف",
    sidebarUserSubtitle: "يمكنك تسجيل الدخول لاحقًا لربط حسابك.",
    sidebarSectionTitle: "منتجات فاليو تك",
    sidebarRealEstate: "تقييم العقارات",
    sidebarMachines: "تقييم الآلات",
    sidebarSources: "مصادر المعلومات",
    sidebarApp: "تطبيق فاليو تك",
    sidebarClients: "العملاء",
    sidebarSettings: "الإعدادات",
    comingSoon: "قريبًا",
    productsSectionTitle: "منتجاتنا",
  },
} as const;

export default function ValueTechHubPage() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;

  const isArabic = langContext.language === "ar";
  const t = isArabic ? copy.ar : copy.en;

  return (
    <ValueTechShell>
      <ValueTechHero
        copy={{
          badge: t.heroBadge,
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

      <section className="grid gap-6 md:grid-cols-[minmax(0,2fr)]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">{t.introTitle}</h2>
          <p className="text-sm leading-relaxed text-slate-600">{t.introBody}</p>
        </div>
      </section>

      <section id="products" className="scroll-mt-8 animate-slide-in-up">
        <h2 className="mb-6 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
          {t.productsSectionTitle}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {/* Desktop App */}
          <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-emerald-300/80 hover:shadow-2xl hover:shadow-emerald-500/10">
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
              <Image
                src="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600"
                alt=""
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute inset-0 flex flex-col justify-end p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <p className="text-sm font-medium leading-relaxed text-white drop-shadow-md">
                  {t.desktopHoverDesc}
                </p>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <LayoutGrid className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{t.desktopTitle}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{t.desktopDescription}</p>
              <div className="mt-4 flex-1" />
              <Button asChild className="w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
                <Link href="/value-tech-app" className="inline-flex items-center justify-center gap-2">
                  {isArabic ? "فتح التطبيق" : "Open App"}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </article>

          {/* Information Sources */}
          <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-cyan-300/80 hover:shadow-2xl hover:shadow-cyan-500/10">
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
              <Image
                src="https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600"
                alt=""
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute inset-0 flex flex-col justify-end p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <p className="text-sm font-medium leading-relaxed text-white drop-shadow-md">
                  {t.sourcesHoverDesc}
                </p>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
                <Library className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{t.sourcesTitle}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{t.sourcesDescription}</p>
              <div className="mt-4 flex-1" />
              <Button asChild variant="outline" className="w-full rounded-xl border-cyan-300 text-cyan-800 hover:bg-cyan-600 hover:text-white">
                <Link href="/evaluation-source">{isArabic ? "فتح المصادر" : "Open Sources"}</Link>
              </Button>
            </div>
          </article>

          {/* Real Estate */}
          <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-sky-300/80 hover:shadow-2xl hover:shadow-sky-500/10">
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
              <Image
                src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600"
                alt=""
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute inset-0 flex flex-col justify-end p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <p className="text-sm font-medium leading-relaxed text-white drop-shadow-md">
                  {t.realEstateHoverDesc}
                </p>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                <Building2 className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{t.realEstateTitle}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{t.realEstateDescription}</p>
              <div className="mt-4 flex-1" />
              <Button asChild variant="outline" className="w-full rounded-xl border-sky-300 text-sky-800 hover:bg-sky-600 hover:text-white">
                <Link href="/real-estate-valuation">{isArabic ? "بدء التقييم" : "Start Valuation"}</Link>
              </Button>
            </div>
          </article>

          {/* Machines */}
          <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 border-dashed bg-emerald-50/50 shadow-lg transition-all duration-300 hover:-translate-y-2 hover:border-emerald-400/80 hover:shadow-2xl hover:shadow-emerald-500/10">
            <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
              <Image
                src="https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600"
                alt=""
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/85 via-slate-900/30 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="absolute inset-0 flex flex-col justify-end p-5 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <p className="text-sm font-medium leading-relaxed text-white drop-shadow-md">
                  {t.machinesHoverDesc}
                </p>
              </div>
            </div>
            <div className="flex flex-1 flex-col p-5">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Cpu className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{t.machinesTitle}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{t.machinesDescription}</p>
              <div className="mt-4 flex-1" />
              <Button asChild variant="outline" className="w-full rounded-xl border-emerald-400 bg-emerald-600 text-white hover:bg-emerald-700">
                <Link href="/machine-valuation">{t.comingSoon}</Link>
              </Button>
            </div>
          </article>
        </div>
      </section>
    </ValueTechShell>
  );
}
