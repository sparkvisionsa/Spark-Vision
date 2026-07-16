import { mvAr } from "./locales/ar";
import { mvEn } from "./locales/en";

export const mvTranslations = {
  ar: mvAr,
  en: mvEn,
} as const;

export type MvTranslations = typeof mvAr;
