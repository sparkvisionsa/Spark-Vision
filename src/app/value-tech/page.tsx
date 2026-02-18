"use client";

import { useContext } from "react";
import Link from "@/components/prefetch-link";
import Header from "@/components/header";
import Footer from "@/components/footer";
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
    title: "\u0641\u0627\u0644\u064A\u0648 \u062A\u0643",
    subtitle: "\u0627\u062E\u062A\u0631 \u0627\u0644\u0648\u062C\u0647\u0629 \u0627\u0644\u062A\u064A \u062A\u0631\u064A\u062F\u0647\u0627.",
    installTitle: "\u062A\u062B\u0628\u064A\u062A \u062A\u0637\u0628\u064A\u0642 \u0633\u0637\u062D \u0627\u0644\u0645\u0643\u062A\u0628",
    installDescription: "\u0627\u0641\u062A\u062D \u0635\u0641\u062D\u0629 \u062A\u0637\u0628\u064A\u0642 Value Tech \u0627\u0644\u0643\u0627\u0645\u0644\u0629 \u0645\u0639 \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u062A\u062B\u0628\u064A\u062A \u0648\u0633\u064A\u0631 \u0627\u0644\u0639\u0645\u0644.",
    installCta: "\u0641\u062A\u062D \u0635\u0641\u062D\u0629 Value Tech App",
    evalTitle: "\u0645\u0635\u0627\u062F\u0631 \u0627\u0644\u062A\u0642\u064A\u064A\u0645",
    evalDescription: "\u0627\u0641\u062A\u062D \u0623\u062F\u0648\u0627\u062A \u0645\u0635\u0627\u062F\u0631 \u0627\u0644\u062A\u0642\u064A\u064A\u0645 \u0644\u0644\u0633\u064A\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0639\u0642\u0627\u0631\u0627\u062A \u0648\u0627\u0644\u0641\u0626\u0627\u062A \u0627\u0644\u0623\u062E\u0631\u0649.",
    evalCta: "\u0641\u062A\u062D \u0645\u0635\u0627\u062F\u0631 \u0627\u0644\u062A\u0642\u064A\u064A\u0645",
  },
} as const;

export default function ValueTechHubPage() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;
  const showValueTechAppCard = false;

  const t = langContext.language === "ar" ? copy.ar : copy.en;

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-slate-900">
      <Header />
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
                  <Link href="/evaluation-sourc">
                    {t.evalCta}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
