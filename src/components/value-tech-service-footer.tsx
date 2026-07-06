"use client";

import { Fragment, useContext } from "react";
import { usePathname } from "next/navigation";
import { BadgeCheck, BriefcaseBusiness, LockKeyhole } from "lucide-react";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";

const copy = {
  en: {
    copyright: "© Spark Vision - Value Tech 2026",
    trust: [
      { label: "Trusted", icon: BadgeCheck },
      { label: "Secure", icon: LockKeyhole },
      { label: "Professional", icon: BriefcaseBusiness },
    ],
  },
  ar: {
    copyright: "© Spark Vision - Value Tech 2026",
    trust: [
      { label: "موثوق", icon: BadgeCheck },
      { label: "آمن", icon: LockKeyhole },
      { label: "احترافي", icon: BriefcaseBusiness },
    ],
  },
} as const;

function HubFooter() {
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "ar";
  const t = copy[language];
  const isArabic = language === "ar";

  return (
    <footer className="vt-hub-footer px-4 py-3 sm:px-6 sm:py-3.5" role="contentinfo">
      <div
        className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2.5 sm:flex-row sm:justify-between sm:gap-4"
        dir={isArabic ? "rtl" : "ltr"}
      >
        <div className="flex items-center gap-2 text-center sm:text-start">
          <span className="vt-hub-footer-v" aria-hidden>
            V
          </span>
          <p className="text-[0.72rem] font-medium tracking-wide text-[#f5cd7b]/88 sm:text-[0.78rem]">
            {t.copyright}
          </p>
        </div>

        <div
          className={cn(
            "flex flex-wrap items-center justify-center gap-3 sm:gap-5",
            isArabic && "flex-row-reverse",
          )}
          aria-label={isArabic ? "مؤشرات الثقة" : "Trust indicators"}
        >
          {t.trust.map((item, index) => {
            const Icon = item.icon;
            return (
              <Fragment key={item.label}>
                {index > 0 ? (
                  <span
                    className="hidden h-3.5 w-px shrink-0 bg-[rgba(232,184,90,0.28)] sm:block"
                    aria-hidden
                  />
                ) : null}
                <div className="flex items-center gap-1.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(232,184,90,0.32)] bg-[rgba(255,255,255,0.06)]">
                    <Icon className="h-3 w-3 text-[#f5cd7b]" strokeWidth={1.8} aria-hidden />
                  </span>
                  <span className="text-[0.72rem] font-semibold text-[#f5cd7b]/92 sm:text-[0.78rem]">
                    {item.label}
                  </span>
                </div>
              </Fragment>
            );
          })}
        </div>
      </div>
    </footer>
  );
}

function DefaultFooter() {
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "ar";
  const pathname = usePathname() || "/";
  const isValueTechAppRoute = pathname.startsWith("/value-tech-app");
  const theme = isValueTechAppRoute
    ? {
        root: "border-t border-amber-300/15 bg-slate-950",
        topLine: "via-amber-300/70",
        text: "text-slate-400",
      }
    : {
        root: "border-t border-slate-200 bg-slate-950",
        topLine: "via-cyan-300/70",
        text: "text-slate-400",
      };

  const text =
    language === "ar"
      ? "© 2026 Spark Vision - Value Tech. جميع الحقوق محفوظة."
      : "© 2026 Spark Vision - Value Tech. All rights reserved.";

  return (
    <footer
      className={cn(
        "fixed bottom-0 inset-x-0 z-40 flex items-center justify-center px-3 py-1 text-center text-[11px] leading-tight sm:text-xs",
        theme.root,
        theme.text,
      )}
      role="contentinfo"
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          theme.topLine,
        )}
      />
      <p className="relative">{text}</p>
    </footer>
  );
}

export default function ValueTechServiceFooter({
  variant = "default",
}: {
  variant?: "default" | "hub";
}) {
  if (variant === "hub") {
    return <HubFooter />;
  }

  return <DefaultFooter />;
}
