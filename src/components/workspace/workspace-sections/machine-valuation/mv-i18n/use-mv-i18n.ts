"use client";

import { useContext, useMemo } from "react";
import { LanguageContext } from "@/components/layout-provider";
import { mvTranslations, type MvTranslations } from "./translations";
import { createMvT, type MvLang } from "./resolve";

export function useMvI18n() {
  const langCtx = useContext(LanguageContext);
  const language: MvLang = langCtx?.language === "en" ? "en" : "ar";
  const isArabic = language === "ar";
  const dir: "ltr" | "rtl" = isArabic ? "rtl" : "ltr";
  const dict = mvTranslations[language];

  const t = useMemo(() => createMvT(dict as Record<string, unknown>), [dict]);

  return { language, isArabic, dir, t, dict: dict as MvTranslations };
}

export function getMvT(language: MvLang = "ar") {
  return createMvT(mvTranslations[language] as Record<string, unknown>);
}
