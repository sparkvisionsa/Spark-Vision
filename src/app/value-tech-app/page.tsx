"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import {
  ArrowUp,
  CheckCircle2,
  Compass,
  Download,
  FileCheck2,
  Flag,
  Gauge,
  Layers3,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Cairo, Manrope, Playfair_Display } from "next/font/google";
import ValueTechShell from "@/components/value-tech-shell";
import { LanguageContext } from "@/components/layout-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

const DOWNLOAD_URL =
  "https://github.com/sparkvisionsa/ValueTech-Frontend/releases/download/v1.1.0/value-tech.exe";

const pageStyles = `
  @keyframes vtFloat {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  @keyframes vtFadeUp {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .vt-fade-up {
    animation: vtFadeUp 0.65s ease both;
  }

  .vt-float {
    animation: vtFloat 8s ease-in-out infinite;
  }
`;

const copy = {
  en: {
    heroBadge: "Desktop Platform",
    heroTitle: "Value Tech App",
    heroDescription:
      "A modern valuation workspace built for speed, clarity, and reliable report delivery.",
    heroPrimaryCta: "Download for Windows",
    stats: [
      { value: "98%", label: "Submission reliability" },
      { value: "4x", label: "Faster report cycle" },
      { value: "24/7", label: "Operational readiness" },
    ],
    sectionNavTitle: "Quick Navigation",
    sectionNav: [
      { href: "#overview", label: "Overview", icon: Compass },
      { href: "#features", label: "Features", icon: Sparkles },
      { href: "#workflow", label: "Workflow", icon: Layers3 },
      { href: "#install", label: "Install", icon: Wrench },
      { href: "#trust", label: "Trust", icon: ShieldCheck },
      { href: "#cta", label: "Get Started", icon: Flag },
    ],
    featuresTitle: "Designed for Professional Valuation Teams",
    featuresSubtitle:
      "Calm interface, focused flow, and practical tools that reduce friction in daily work.",
    features: [
      {
        title: "Guided report flow",
        description: "Structured steps keep your team aligned from entry to final submission.",
      },
      {
        title: "Reliable data handling",
        description: "Clean import patterns and safeguards reduce manual mistakes.",
      },
      {
        title: "Fast bulk operations",
        description: "Process large report sets with stable performance and clear progress.",
      },
      {
        title: "Built-in compliance mindset",
        description: "Operational checks help maintain standards across your workflow.",
      },
    ],
    workflowTitle: "Smooth Workflow Inside One Experience",
    workflow: [
      {
        title: "Choose service",
        description: "Start with the exact module you need, without unnecessary steps.",
      },
      {
        title: "Prepare and validate data",
        description: "Apply clear checks before upload to reduce rework later.",
      },
      {
        title: "Submit and monitor",
        description: "Track every report status from one consistent dashboard.",
      },
      {
        title: "Review and improve",
        description: "Use visible history to improve team quality and speed over time.",
      },
    ],
    installTitle: "Simple Installation, Fast Start",
    installDescription:
      "Get the app ready in minutes with a straightforward setup path.",
    installSteps: [
      "Download the ZIP package.",
      'Extract files and run "electron-python-app-setup-1.0.0.exe".',
      'If SmartScreen appears, click "More info" then "Run anyway".',
      "Complete installation and launch Value Tech.",
      "Sign in and start your first workflow.",
    ],
    trustTitle: "Security and Stability by Default",
    trustItems: [
      {
        title: "Protected sessions",
        description: "Operational access stays controlled with secure session handling.",
      },
      {
        title: "Consistent performance",
        description: "Balanced UI and lightweight patterns keep the app responsive.",
      },
      {
        title: "Audit-friendly process",
        description: "Clear traces help teams review actions and maintain accountability.",
      },
    ],
    testimonialsTitle: "Teams Trust Value Tech",
    testimonials: [
      {
        quote:
          "The workflow became much clearer for our team. We now submit with confidence and less back-and-forth.",
        author: "Operations Lead",
      },
      {
        quote:
          "The calm interface and clear sections made training new staff significantly easier.",
        author: "Appraisal Manager",
      },
    ],
    ctaTitle: "Ready to Work Faster With Better Control?",
    ctaDescription:
      "Start using Value Tech today and move your valuation operations to a smoother standard.",
    ctaPrimary: "Download Now",
    scrollTopLabel: "Back to top",
  },
  ar: {
    heroBadge: "منصة سطح مكتب",
    heroTitle: "تطبيق Value Tech",
    heroDescription:
      "مساحة عمل تقييم حديثة تجمع بين السرعة والوضوح والثبات في إنجاز التقارير.",
    heroPrimaryCta: "تنزيل التطبيق لويندوز",
    stats: [
      { value: "98%", label: "موثوقية الإرسال" },
      { value: "4x", label: "تسريع دورة التقارير" },
      { value: "24/7", label: "جاهزية تشغيل مستمرة" },
    ],
    sectionNavTitle: "التنقل السريع",
    sectionNav: [
      { href: "#overview", label: "نظرة عامة", icon: Compass },
      { href: "#features", label: "المميزات", icon: Sparkles },
      { href: "#workflow", label: "سير العمل", icon: Layers3 },
      { href: "#install", label: "التثبيت", icon: Wrench },
      { href: "#trust", label: "الموثوقية", icon: ShieldCheck },
      { href: "#cta", label: "ابدأ الآن", icon: Flag },
    ],
    featuresTitle: "مصمم لفرق التقييم الاحترافية",
    featuresSubtitle:
      "واجهة هادئة وتدفق واضح وأدوات عملية تقلل التعقيد اليومي في العمل.",
    features: [
      {
        title: "تدفق تقارير موجه",
        description: "خطوات منظمة تحافظ على اتساق العمل من البداية حتى الإرسال النهائي.",
      },
      {
        title: "تعامل موثوق مع البيانات",
        description: "أنماط إدخال واضحة وفحوصات مسبقة لتقليل الأخطاء اليدوية.",
      },
      {
        title: "عمليات دفعية سريعة",
        description: "تنفيذ عدد كبير من التقارير بأداء ثابت ومؤشرات تقدم واضحة.",
      },
      {
        title: "نهج امتثال مدمج",
        description: "نقاط تحقق تشغيلية تساعد في الحفاظ على جودة المعايير عبر الفريق.",
      },
    ],
    workflowTitle: "سير عمل سلس داخل تجربة واحدة",
    workflow: [
      {
        title: "اختيار الخدمة",
        description: "ابدأ مباشرة بالمسار المطلوب دون خطوات إضافية غير ضرورية.",
      },
      {
        title: "تحضير البيانات والتحقق",
        description: "طبّق فحوصات واضحة قبل الرفع لتقليل إعادة العمل لاحقًا.",
      },
      {
        title: "الإرسال والمتابعة",
        description: "تابع حالة كل تقرير من لوحة تحكم موحدة وسهلة.",
      },
      {
        title: "المراجعة والتحسين",
        description: "استفد من السجل الواضح لرفع الجودة وتسريع الأداء باستمرار.",
      },
    ],
    installTitle: "تثبيت بسيط وبداية سريعة",
    installDescription:
      "جهز التطبيق خلال دقائق عبر خطوات مباشرة وسهلة التنفيذ.",
    installSteps: [
      'قم بتنزيل ملف ثم اضغط للتسطيب "value-tech.exe".',
      'إذا ظهر SmartScreen اضغط "More info" ثم "Run anyway".',
      "أكمل التثبيت ثم شغّل تطبيق Value Tech.",
      "سجل الدخول وابدأ أول مسار عمل.",
    ],
    trustTitle: "الأمان والثبات كمعيار أساسي",
    trustItems: [
      {
        title: "جلسات محمية",
        description: "الوصول التشغيلي يظل مضبوطًا عبر إدارة جلسات آمنة.",
      },
      {
        title: "أداء ثابت",
        description: "تصميم متوازن وأنماط خفيفة تحافظ على سرعة الاستجابة.",
      },
      {
        title: "مسار مناسب للتدقيق",
        description: "سجل واضح للعمليات يساعد في المراجعة ورفع المساءلة.",
      },
    ],
    testimonialsTitle: "فرق العمل تثق في Value Tech",
    testimonials: [
      {
        quote:
          "أصبح مسار العمل أوضح بكثير للفريق، وننجز الإرسال بثقة وبمراجعات أقل.",
        author: "احمد ابراهيم  ",
      },
      {
        quote:
          "الواجهة الهادئة وتنظيم الأقسام سهل تدريب الموظفين الجدد بشكل ملحوظ.",
        author: "ابو عمر  ",
      },
    ],
    ctaTitle: "جاهز للعمل بسرعة أكبر وتحكم أفضل؟",
    ctaDescription:
      "ابدأ باستخدام Value Tech اليوم وارفع مستوى تشغيل التقييم لديك بشكل أكثر سلاسة.",
    ctaPrimary: "تنزيل الآن",
    scrollTopLabel: "العودة إلى الأعلى",
  },
} as const;

export default function ValueTechPage() {
  const context = useContext(LanguageContext);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = previous;
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 360);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!context) return null;

  const { language } = context;
  const isArabic = language === "ar";
  const t = copy[language];

  const pageFont = isArabic ? cairo.className : manrope.className;
  const headingFont = isArabic ? cairo.className : playfair.className;

  const featureIcons = [Sparkles, FileCheck2, Gauge, ShieldCheck] as const;
  const trustIcons = [LockKeyhole, Gauge, CheckCircle2] as const;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openDownload = () => {
    window.open(DOWNLOAD_URL, "_blank", "noopener,noreferrer");
  };

  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <ValueTechShell>
      <div
        className={cn("min-h-screen bg-[#edf3f4] text-slate-900 rounded-3xl", pageFont)}
        dir={isArabic ? "rtl" : "ltr"}
      >
      <style>{pageStyles}</style>

      <main className="relative overflow-hidden pb-20">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-cyan-300/25 blur-3xl" />
        <div className="pointer-events-none absolute right-0 top-80 h-80 w-80 rounded-full bg-teal-200/20 blur-3xl" />

        <section id="overview" className="scroll-mt-44 px-6 pb-14 pt-10">
          <div className="mx-auto max-w-6xl">
            <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="vt-fade-up space-y-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/70 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-800">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t.heroBadge}
                </span>

                <div className="space-y-3">
                  <h1 className={cn("text-4xl font-semibold leading-tight sm:text-5xl", headingFont)}>
                    {t.heroTitle}
                  </h1>
                  <p className="max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
                    {t.heroDescription}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={openDownload}
                    className="rounded-full bg-slate-900 px-6 text-white hover:bg-slate-800"
                  >
                    {t.heroPrimaryCta}
                    <Download className="ms-2 h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {t.stats.map((item) => (
                    <article
                      key={item.label}
                      className="rounded-2xl border border-slate-200 bg-white/85 p-4 shadow-[0_14px_32px_-24px_rgba(15,23,42,0.65)]"
                    >
                      <p className="text-2xl font-semibold text-slate-900">{item.value}</p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                        {item.label}
                      </p>
                    </article>
                  ))}
                </div>
              </div>

              <div className="vt-float rounded-3xl border border-cyan-200/80 bg-gradient-to-br from-white via-cyan-50 to-teal-50 p-5 shadow-[0_32px_70px_-40px_rgba(14,116,144,0.45)]">
                <div className="rounded-2xl border border-white/70 bg-white/80 p-4 backdrop-blur">
                  <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
                    <p className="text-sm font-semibold text-slate-800">Value Tech</p>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      Live
                    </span>
                  </div>
                  <div className="space-y-3">
                    {[
                      { icon: Layers3, label: isArabic ? "اختيار المسار" : "Select workflow" },
                      { icon: FileCheck2, label: isArabic ? "فحص البيانات" : "Validate data" },
                      { icon: Download, label: isArabic ? "رفع وإرسال" : "Upload and submit" },
                      { icon: CheckCircle2, label: isArabic ? "مراجعة الحالة" : "Track status" },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.label}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                        >
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="text-sm font-medium text-slate-700">{item.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="sticky top-24 z-30 px-6">
          <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200/80 bg-white/85 p-2 backdrop-blur">
            <div className="mb-2 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {t.sectionNavTitle}
            </div>
            <nav className="flex items-center gap-2 overflow-x-auto pb-1">
              {t.sectionNav.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-900"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </a>
                );
              })}
            </nav>
          </div>
        </div>

        <section id="features" className="scroll-mt-44 px-6 pb-14 pt-10">
          <div className="mx-auto max-w-6xl">
            <header className="mb-7 max-w-3xl">
              <h2 className={cn("text-3xl font-semibold", headingFont)}>{t.featuresTitle}</h2>
              <p className="mt-3 text-base leading-8 text-slate-600">{t.featuresSubtitle}</p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2">
              {t.features.map((feature, index) => {
                const Icon = featureIcons[index] || Sparkles;
                return (
                  <article
                    key={feature.title}
                    className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-[0_16px_38px_-28px_rgba(15,23,42,0.65)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_50px_-26px_rgba(14,116,144,0.38)]"
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-lg font-semibold text-slate-900">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{feature.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="workflow" className="scroll-mt-44 px-6 pb-14">
          <div className="mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-[0_20px_46px_-34px_rgba(15,23,42,0.7)] sm:p-8">
            <h2 className={cn("text-3xl font-semibold", headingFont)}>{t.workflowTitle}</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {t.workflow.map((step, index) => (
                <article
                  key={step.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5"
                >
                  <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="install" className="scroll-mt-44 px-6 pb-14">
          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-[0_20px_48px_-34px_rgba(15,23,42,0.72)] sm:p-7">
              <h2 className={cn("text-3xl font-semibold", headingFont)}>{t.installTitle}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{t.installDescription}</p>

              <div className="mt-6 space-y-3">
                {t.installSteps.map((step, index) => (
                  <div
                    key={step}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3"
                  >
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-sm font-semibold text-cyan-800">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-7 text-slate-700">{step}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 via-white to-teal-50 p-6 shadow-[0_26px_56px_-38px_rgba(8,145,178,0.5)] sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                Value Tech Setup
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                {isArabic ? "جاهز خلال دقائق" : "Ready in Minutes"}
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                {isArabic
                  ? "استخدم المثبت الرسمي لبدء العمل بسرعة مع تجربة ثابتة وواضحة."
                  : "Use the official installer to start quickly with a stable and clear experience."}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                {["Windows 10/11", "64-bit", "v1.0.0"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-semibold text-cyan-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <Button
                type="button"
                onClick={openDownload}
                className="mt-7 w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800"
              >
                {t.ctaPrimary}
                <Download className="ms-2 h-4 w-4" />
              </Button>
            </article>
          </div>
        </section>

        <section id="trust" className="scroll-mt-44 px-6 pb-14">
          <div className="mx-auto max-w-6xl">
            <h2 className={cn("text-3xl font-semibold", headingFont)}>{t.trustTitle}</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {t.trustItems.map((item, index) => {
                const Icon = trustIcons[index] || ShieldCheck;
                return (
                  <article
                    key={item.title}
                    className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.65)]"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="testimonials" className="scroll-mt-44 px-6 pb-14">
          <div className="mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-[0_20px_46px_-34px_rgba(15,23,42,0.7)] sm:p-8">
            <h2 className={cn("text-3xl font-semibold", headingFont)}>{t.testimonialsTitle}</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {t.testimonials.map((item) => (
                <article key={item.quote} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm leading-7 text-slate-700">{item.quote}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {item.author}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="cta" className="scroll-mt-44 px-6 pb-4">
          <div className="mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-cyan-950 p-8 text-white shadow-[0_30px_70px_-42px_rgba(15,23,42,0.85)]">
            <h2 className={cn("text-3xl font-semibold", headingFont)}>{t.ctaTitle}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-8 text-slate-200">{t.ctaDescription}</p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={openDownload}
                className="rounded-full bg-white px-6 text-slate-950 hover:bg-slate-200"
              >
                {t.ctaPrimary}
                <Download className="ms-2 h-4 w-4" />
              </Button>
            </div>

            <p className="mt-8 text-xs text-slate-300">&copy; {year} Spark Vision - Value Tech</p>
          </div>
        </section>
      </main>

      <button
        type="button"
        onClick={scrollToTop}
        aria-label={t.scrollTopLabel}
        className={cn(
          "fixed bottom-6 ltr:right-6 rtl:left-6 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full border border-cyan-300 bg-white text-cyan-800 shadow-[0_14px_30px_-20px_rgba(8,145,178,0.8)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-cyan-50",
          showScrollTop
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        )}
      >
        <ArrowUp className="h-5 w-5" />
      </button>
      </div>
    </ValueTechShell>
  );
}
