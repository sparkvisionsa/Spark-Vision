"use client";

import React, {
  useState,
  useEffect,
  createContext,
  useMemo,
  useLayoutEffect,
} from "react";

type Language = "en" | "ar";

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  dir: "ltr" | "rtl";
}

export const LanguageContext = createContext<LanguageContextType | null>(null);

// Custom hook to handle SSR and CSR for language persistence
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function LayoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguage] = useState<Language>("ar");

  // Set language from localStorage on initial load
  useIsomorphicLayoutEffect(() => {
    const storedLang = localStorage.getItem("spark-vision-lang") as Language;
    if (storedLang && ["en", "ar"].includes(storedLang)) {
      setLanguage(storedLang);
    }
  }, []);

  // Update HTML attributes and localStorage when language changes
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    localStorage.setItem("spark-vision-lang", language);
  }, [language]);

  const dir = useMemo<"ltr" | "rtl">(
    () => (language === "ar" ? "rtl" : "ltr"),
    [language]
  );

  const value = useMemo(
    () => ({ language, setLanguage, dir }),
    [language, dir]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}
