"use client";

import { useContext } from "react";
import { Cpu, ArrowRight } from "lucide-react";
import Link from "@/components/prefetch-link";
import { Button } from "@/components/ui/button";
import { LanguageContext } from "@/components/layout-provider";

const copy = {
  en: {
    title: "Machines Valuation System",
    description:
      "A dedicated workflow to manage, document, and complete machinery and equipment valuations professionally. This product is currently under development and will be available soon.",
    comingSoon: "Coming Soon",
    features: [
      "Structured valuation workflows for all equipment types",
      "Detailed machinery specifications and condition logging",
      "Market comparison and depreciation analysis",
      "Automated professional valuation report generation",
    ],
    backToHub: "Back to Value Tech",
  },
  ar: {
    title: "نظام تقييم الآلات",
    description:
      "مسار عمل متكامل لإدارة وتوثيق وإتمام تقييم الآلات والمعدات باحترافية عالية. هذا المنتج قيد التطوير حاليًا وسيتوفر قريبًا.",
    comingSoon: "قريبًا",
    features: [
      "مسارات تقييم منظمة لجميع أنواع المعدات",
      "تسجيل تفصيلي لمواصفات وحالة الآلات",
      "تحليل مقارنات السوق والاستهلاك",
      "إنشاء تقارير تقييم احترافية تلقائيًا",
    ],
    backToHub: "العودة إلى فاليو تك",
  },
} as const;

export default function MachineValuationSection() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;

  const isArabic = langContext.language === "ar";
  const t = isArabic ? copy.ar : copy.en;

  return (
    <div className="flex items-center justify-center px-4 py-10 text-center">
      <div className="max-w-lg space-y-6 rounded-3xl border border-slate-200/80 bg-white/80 p-8 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <Cpu className="h-8 w-8" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900">{t.title}</h1>

        <p className="text-sm leading-relaxed text-slate-600">{t.description}</p>

        <div className={`text-${isArabic ? "right" : "left"} space-y-2 rounded-2xl bg-emerald-50/60 p-4`}>
          {t.features.map((feature, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              {feature}
            </div>
          ))}
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          {t.comingSoon}
        </div>

        <div>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/value-tech" className="inline-flex items-center gap-2">
              <ArrowRight className={`h-4 w-4 ${isArabic ? "" : "rotate-180"}`} />
              {t.backToHub}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
