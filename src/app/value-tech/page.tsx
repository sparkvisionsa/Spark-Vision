"use client";

import { useContext } from "react";
import Link from "@/components/prefetch-link";
import ValueTechServiceNavbar from "@/components/value-tech-service-navbar";
import ValueTechServiceFooter from "@/components/value-tech-service-footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";
import { LanguageContext } from "@/components/layout-provider";

const copy = {
  en: {
    title: "Value Tech",
    subtitle: "Choose where you want to go.",
    installTitle: "Install Desktop App",
    installDescription: "Open the full Value Tech App page with installation and workflow details.",
    installCta: "Open Value Tech App",
    evalTitle: "Evaluation Source",
    evalDescription: "Open evaluation source tools for cars, real estate, and other categories.",
    evalCta: "Open Evaluation Source",
  },
  ar: {
    title: "فاليو تك",
    subtitle: "اختر الوجهة التي تريدها.",
    installTitle: "تثبيت تطبيق سطح المكتب",
    installDescription: "افتح صفحة تطبيق فاليو تك الكاملة مع تفاصيل التثبيت وسير العمل.",
    installCta: "فتح صفحة تطبيق فاليو تك",
    evalTitle: "مصادر التقييم",
    evalDescription: "افتح أدوات مصادر التقييم للسيارات والعقارات والفئات الأخرى.",
    evalCta: "فتح مصادر التقييم",
  },
} as const;

export default function ValueTechHubPage() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;
  const showValueTechAppCard = true;

  const t = langContext.language === "ar" ? copy.ar : copy.en;

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-slate-900">
      <ValueTechServiceNavbar />
      <main className="px-6 py-14">
        <section className="mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-xl">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-900">{t.title}</h1>
            <p className="mt-2 text-sm text-slate-500">{t.subtitle}</p>
          </div>

          <div className={`mt-10 grid gap-6 ${showValueTechAppCard ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
            {showValueTechAppCard ? (
              <Card className="h-full border-slate-200">
                <CardHeader>
                  <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Download className="h-5 w-5" />
                  </div>
                  <CardTitle>{t.installTitle}</CardTitle>
                  <CardDescription>{t.installDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
                    <Link href="/value-tech-app">
                      {t.installCta}
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            <Card className="h-full border-slate-200">
              <CardHeader>
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
                  <ExternalLink className="h-5 w-5" />
                </div>
                <CardTitle>{t.evalTitle}</CardTitle>
                <CardDescription>{t.evalDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  asChild
                  variant="outline"
                  className="w-full border-cyan-300 bg-white text-cyan-800 transition-colors hover:border-cyan-700 hover:bg-cyan-600 hover:text-white"
                >
                  <Link href="/evaluation-source">
                    {t.evalCta}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <ValueTechServiceFooter />
    </div>
  );
}
