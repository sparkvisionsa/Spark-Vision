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
const LANGUAGE_STORAGE_KEY = "spark-vision-lang";

// Custom hook to handle SSR and CSR for language persistence
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function LayoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [language, setLanguage] = useState<Language>("ar");

  // Enforce Arabic as the global startup default on each app load.
  useIsomorphicLayoutEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, "ar");
    } catch {
      // localStorage may be unavailable in strict privacy modes.
    }
    setLanguage("ar");
  }, []);

  // Update HTML attributes and localStorage when language changes
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
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
