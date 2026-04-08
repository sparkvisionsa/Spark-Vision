"use client";

import { useContext } from "react";
import { usePathname } from "next/navigation";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";

const copy = {
  en: "© 2026 Spark Vision - Value Tech. All rights reserved.",
  ar: "© 2026 Spark Vision - Value Tech. جميع الحقوق محفوظة.",
} as const;

export default function ValueTechServiceFooter() {
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
      <p className="relative">{copy[language]}</p>
    </footer>
  );
}
