"use client";

import { useContext } from "react";
import { ClipboardList, ArrowRight } from "lucide-react";
import Link from "@/components/prefetch-link";
import { Button } from "@/components/ui/button";
import { LanguageContext } from "@/components/layout-provider";

const copy = {
  en: {
    title: "Asset Inventory System",
    description:
      "A comprehensive tool to count, classify, and track all your organization's assets accurately. This product is currently under development and will be available soon.",
    comingSoon: "Coming Soon",
    features: [
      "Complete asset counting and classification",
      "Barcode and QR code scanning",
      "Real-time inventory tracking",
      "Detailed reporting and analytics",
    ],
    backToHub: "Back to Value Tech",
  },
  ar: {
    title: "تطبيق حصر الأصول",
    description:
      "أداة شاملة لحصر وتصنيف وتتبع جميع أصول مؤسستك بدقة وكفاءة عالية. هذا المنتج قيد التطوير حاليًا وسيتوفر قريبًا.",
    comingSoon: "قريبًا",
    features: [
      "حصر وتصنيف شامل للأصول",
      "مسح الباركود ورموز QR",
      "تتبع المخزون في الوقت الفعلي",
      "تقارير وتحليلات تفصيلية",
    ],
    backToHub: "العودة إلى فاليو تك",
  },
} as const;

export default function AssetInventorySection() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;

  const isArabic = langContext.language === "ar";
  const t = isArabic ? copy.ar : copy.en;

  return (
    <div className="flex items-center justify-center px-4 py-10 text-center">
      <div className="max-w-lg space-y-6 rounded-3xl border border-slate-200/80 bg-white/80 p-8 shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
          <ClipboardList className="h-8 w-8" />
        </div>

        <h1 className="text-2xl font-bold text-slate-900">{t.title}</h1>

        <p className="text-sm leading-relaxed text-slate-600">{t.description}</p>

        <div className={`text-${isArabic ? "right" : "left"} space-y-2 rounded-2xl bg-violet-50/60 p-4`}>
          {t.features.map((feature, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
              {feature}
            </div>
          ))}
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-4 py-2 text-sm font-semibold text-violet-700">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-violet-500" />
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
