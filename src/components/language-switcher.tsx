"use client";

import React, { useContext } from "react";
import { Button } from "./ui/button";
import { LanguageContext } from "./layout-provider";
import { cn } from "@/lib/utils";

export function LanguageSwitcher() {
  const langContext = useContext(LanguageContext);

  if (!langContext) {
    return null;
  }

  const { language, setLanguage } = langContext;

  return (
    <div className="flex items-center rounded-full border p-1 text-sm">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "rounded-full h-7 px-3",
          language === "en" && "bg-muted text-foreground"
        )}
        onClick={() => setLanguage("en")}
      >
        EN
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "rounded-full h-7 px-3",
          language === "ar" && "bg-muted text-foreground"
        )}
        onClick={() => setLanguage("ar")}
      >
        AR
      </Button>
    </div>
  );
}
