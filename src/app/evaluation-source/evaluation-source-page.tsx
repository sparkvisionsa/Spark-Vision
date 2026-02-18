
"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";
import AuthModal from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Check,
  Eye,
  Image as ImageIcon,
  Loader2,
  Search,
  Tag,
} from "lucide-react";
import { IBM_Plex_Sans, Sora } from "next/font/google";
import Image from "next/image";
import { LanguageContext } from "@/components/layout-provider";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { toApiUrl } from "@/lib/api-url";
import {
  isVehicleTextMatch,
  toVehicleCanonicalKey,
} from "@/lib/vehicle-name-match";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

type EvaluationSourceItem = {
  id: string;
  title: string;
  city: string;
  postDate: number | null;
  priceNumeric: number | null;
  priceFormatted: string | null;
  hasImage: boolean;
  imagesCount: number;
  commentsCount: number;
  tags: string[];
  carModelYear: number | null;
  mileage: number | null;
  phone: string;
  url: string;
  source: "haraj" | "yallamotor" | "syarah";
  priceCompare?: {
    min?: string | number | null;
    max?: string | number | null;
    current?: string | number | null;
  } | null;
};

type ListResponse = {
  items: EvaluationSourceItem[];
  total: number;
  page: number;
  limit: number;
  hasNext?: boolean;
};

type EvaluationSourcePageProps = {
  tag0?: string;
  excludeTag1Values?: string[];
  enableBrandFilter?: boolean;
  enableModelFilter?: boolean;
  enableModelYearFilter?: boolean;
  enableMileageFilter?: boolean;
  dataSources?: Array<"haraj" | "yallamotor" | "syarah">;
  requireSearchClickToApplyFilters?: boolean;
};

const animationStyles = `
@keyframes float-slow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-18px); }
}
@keyframes shimmer {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.float-slow {
  animation: float-slow 10s ease-in-out infinite;
}
.shimmer-bg {
  background-size: 200% 200%;
  animation: shimmer 12s ease-in-out infinite;
}
`;

const defaultFilters = {
  search: "",
  match: false,
  city: "",
  brand: "",
  model: "",
  modelYear: "",
  mileageMin: "",
  mileageMax: "",
  source: "all",
  hasImage: "any",
  hasPrice: "any",
  hasComments: "any",
  hasMileage: "any",
  sort: "newest",
};

const SEARCH_HISTORY_STORAGE_KEY = "evaluation-source-search-history";
const SEARCH_HISTORY_MAX_ITEMS = 10;
const LIST_RESPONSE_CACHE_MAX_ITEMS = 120;

function setCachedListResponse(
  cache: Map<string, ListResponse>,
  cacheKey: string,
  value: ListResponse
) {
  cache.set(cacheKey, value);
  while (cache.size > LIST_RESPONSE_CACHE_MAX_ITEMS) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

const copy = {
  en: {
    filters: {
      badge: "Magic Filters",
      title: "Filter and refine",
      subtitle: "Instant results as you type.",
      searchModeSubtitle: "Results update after you click Search.",
      search: "Search",
      match: "Match",
      searchPlaceholder: "Title, Description",
      clearHistory: "Clear",
      city: "City",
      cityPlaceholder: "Search city",
      brand: "Brand",
      brandPlaceholder: "Type or select brand",
      model: "Model",
      modelPlaceholder: "Type or select model",
      manufactureYear: "Manufacture Year",
      manufactureYearPlaceholder: "Type or select year",
      mileage: "Mileage",
      mileagePlaceholder: "Select mileage",
      mileageMin: "Min mileage",
      mileageMinPlaceholder: "Greater than or equal",
      mileageMax: "Max mileage",
      mileageMaxPlaceholder: "Less than or equal",
      source: "Source",
      sourcePlaceholder: "All sources",
      sourceOptions: {
        all: "All sources",
        haraj: "Haraj",
        yallamotor: "Yalla Motor",
        syarah: "Syarah",
      },
      hasImages: "Has images",
      hasPrice: "Has price",
      hasComments: "Has comments",
      hasMileage: "Has mileage",
      sortBy: "Sort by",
      sortOptions: {
        newest: "Newest",
        oldest: "Oldest",
        priceHigh: "Price high",
        priceLow: "Price low",
        comments: "Most comments",
      },
    },
    table: {
      badge: "Table",
      showing: (count: number, page: number, total: number) =>
        `Showing ${count} records (page ${page} of ${total})`,
      title: "Title",
      brand: "Brand",
      model: "Model",
      manufactureYear: "Year",
      mileage: "Mileage",
      price: "Price",
      date: "Date",
      images: "Images",
      comments: "Comments",
      priceCompareLabel: {
        min: "Min",
        max: "Max",
        current: "Current",
      },
      noPriceCompare: "No price compare",
      actions: "Actions",
      viewImages: (count: number) => `View images (${count})`,
      noImages: "No images",
      commentsCount: (count: number) => `${count} comments`,
      noComments: "0 comments",
      openSource: "Open source",
      seeMore: "See more",
      showingPage: (page: number, total: number) => `Showing page ${page} of ${total}`,
      previous: "Previous",
      next: "Next",
      rows: "Rows",
      rowsLabel: (count: number) => `${count} rows`,
    },
    status: {
      loading: "Loading evaluation source data...",
      error: "Unable to load data.",
      noRecords: "No records found for this filter set.",
    },
    modals: {
      imagesTitle: "Images",
      imagesSubtitle: "Scroll to view all listing images.",
      loadingImages: "Loading images...",
      unableImages: "Unable to load images.",
      noImages: "No images available.",
      commentsTitle: "Comments",
      commentsSubtitle: "Full comment history for this listing.",
      loadingComments: "Loading comments...",
      unableComments: "Unable to load comments.",
      noComments: "No comments recorded.",
      detailTitle: "Details",
      detailSubtitle: "Full record insights with structured sections.",
      summary: "Summary",
      tags: "Tags",
      noTags: "No tags listed.",
      notes: "Description",
      noDescription: "No detailed description provided.",
      commentsSection: "Comments",
      imagesSection: "Images",
      loadingDetails: "Loading details...",
      unableDetails: "Unable to load details.",
      titleLabel: "Title",
      cityLabel: "City",
      priceLabel: "Price",
      dateLabel: "date",
      sectionLabel: "Section",
      phoneLabel: "Phone",
      sourceLabel: "Source",
      openListing: "Open listing",
      anonymous: "Anonymous",
      featuresTitle: "Features",
      noFeatures: "No features listed.",
      priceCompareTitle: "Price compare",
    },
    carInfo: {
      title: "Car info",
      empty: "No car info available.",
      mileage: "Mileage",
      sellOrWaiver: "Sell or Waiver",
    },
  },
  ar: {
    filters: {
      badge: "مرشحات ذكية",
      title: "تصفية ",
      subtitle: "نتائج فورية أثناء الكتابة.",
      searchModeSubtitle: "يتم تحديث النتائج بعد الضغط على زر البحث.",
      search: "بحث",
      searchPlaceholder: "العنوان، الوصف",
      clearHistory: "مسح السجل",
      city: "المدينة",
      cityPlaceholder: "ابحث عن مدينة",
      brand: "الماركة",
      brandPlaceholder: "اكتب أو اختر الماركة",
      model: "الطراز",
      modelPlaceholder: "اكتب أو اختر الطراز",
      manufactureYear: "سنة الصنع",
      manufactureYearPlaceholder: "اكتب أو اختر السنة",
      source: "المصدر",
      sourcePlaceholder: "كل المصادر",
      sourceOptions: {
        all: "كل المصادر",
        haraj: "حراج",
        yallamotor: "يلا موتور",
        syarah: "\u0633\u064A\u0627\u0631\u0629",
      },
      hasImages: "مع صور",
      hasPrice: "مع سعر",
      hasComments: "مع تعليقات",
      hasMileage: "\u0645\u0639 \u0639\u062f\u0627\u062f \u0627\u0644\u0643\u064a\u0644\u0648\u0645\u062a\u0631\u0627\u062a",
      sortBy: "\u062A\u0631\u062A\u064A\u0628 \u062D\u0633\u0628",
      sortOptions: {
        newest: "الأحدث",
        oldest: "الأقدم",
        priceHigh: "الأعلى سعراً",
        priceLow: "الأقل سعراً",
        comments: "الأكثر تعليقات",
      },
    },
    table: {
      badge: "الجدول",
      showing: (count: number, page: number, total: number) =>
        `عرض ${count} سجل (الصفحة ${page} من ${total})`,
      title: "العنوان",
      brand: "الماركة",
      model: "الطراز",
      manufactureYear: "سنة الصنع",
      price: "السعر",
      date: "التاريخ",
      images: "الصور",
      comments: "التعليقات",
      priceCompareLabel: {
        min: "الأدنى",
        max: "الأعلى",
        current: "الحالي",
      },
      noPriceCompare: "لا توجد مقارنة سعر",
      actions: "الإجراءات",
      viewImages: (count: number) => `عرض الصور (${count})`,
      noImages: "بدون صور",
      commentsCount: (count: number) => `${count} تعليق`,
      noComments: "بدون تعليقات",
      openSource: "فتح الإعلان",
      seeMore: "عرض التفاصيل",
      showingPage: (page: number, total: number) => `الصفحة ${page} من ${total}`,
      previous: "السابق",
      next: "التالي",
      rows: "صفوف",
      rowsLabel: (count: number) => `${count} صف`,
    },
    status: {
      loading: "جارٍ تحميل بيانات مصادر التقييم...",
      error: "تعذّر تحميل البيانات.",
      noRecords: "لا توجد نتائج مطابقة لعوامل التصفية.",
    },
    modals: {
      imagesTitle: "الصور",
      imagesSubtitle: "مرّر لعرض جميع الصور.",
      loadingImages: "جارٍ تحميل الصور...",
      unableImages: "تعذّر تحميل الصور.",
      noImages: "لا توجد صور متاحة.",
      commentsTitle: "التعليقات",
      commentsSubtitle: "سجل التعليقات الكامل لهذا الإعلان.",
      loadingComments: "جارٍ تحميل التعليقات...",
      unableComments: "تعذّر تحميل التعليقات.",
      noComments: "لا توجد تعليقات.",
      detailTitle: "التفاصيل",
      detailSubtitle: "تفاصيل كاملة بشكل منظّم.",
      summary: "ملخص",
      tags: "الوسوم",
      noTags: "لا توجد وسوم.",
      notes: "الوصف",
      noDescription: "لا يوجد وصف تفصيلي.",
      commentsSection: "التعليقات",
      imagesSection: "الصور",
      loadingDetails: "جارٍ تحميل التفاصيل...",
      unableDetails: "تعذّر تحميل التفاصيل.",
      titleLabel: "العنوان",
      cityLabel: "المدينة",
      priceLabel: "السعر",
      dateLabel: "التاريخ ",
      sectionLabel: "القسم",
      phoneLabel: "الهاتف",
      sourceLabel: "المصدر",
      openListing: "فتح الإعلان",
      anonymous: "مجهول",
      featuresTitle: "الميزات",
      noFeatures: "لا توجد ميزات.",
      priceCompareTitle: "مقارنة السعر",
    },
    carInfo: {
      title: "معلومات السيارة",
      empty: "لا تتوفر معلومات السيارة.",
      mileage: "المسافة المقطوعة",
      sellOrWaiver: "بيع أو تنازل",
    },
  },
} as const;

const MIDDLE_EAST_TIME_ZONE = "Asia/Riyadh";

function formatEpoch(value: number | string | Date | null) {
  if (!value) return "-";

  if (typeof value === "object" && value !== null && "$date" in value) {
    return formatEpoch((value as { $date?: string }).$date ?? null);
  }

  const toDate = (input: number | string | Date) => {
    if (input instanceof Date) return input;

    if (typeof input === "number") {
      return input > 1_000_000_000_000
        ? new Date(input)
        : new Date(input * 1000);
    }

    const trimmed = input.trim();
    if (!trimmed) return new Date(NaN);

    const numericCandidate = trimmed.replace(/,/g, "");
    if (/^-?\d+(\.\d+)?$/.test(numericCandidate)) {
      const numericValue = Number(numericCandidate);
      if (!Number.isNaN(numericValue)) {
        return numericValue > 1_000_000_000_000
          ? new Date(numericValue)
          : new Date(numericValue * 1000);
      }
    }

    return new Date(trimmed);
  };

  const asDate = toDate(value);

  if (Number.isNaN(asDate.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: MIDDLE_EAST_TIME_ZONE,
  }).format(asDate);
}

function formatPrice(value: number | null, formatted?: string | null) {
  if (formatted) return formatted;
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMileage(value: number | null, withUnit = false) {
  if (value === null || value === undefined) return "-";
  const base = new Intl.NumberFormat("en-US").format(value);
  return withUnit ? `${base} km` : base;
}

function resolveSourceUrl(item: Pick<EvaluationSourceItem, "source" | "url">) {
  const rawUrl = typeof item.url === "string" ? item.url.trim() : "";
  if (!rawUrl) return "";
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  if (/^\/\//.test(rawUrl)) return `https:${rawUrl}`;
  if (/^(www\.)?haraj\.com\.sa\//i.test(rawUrl)) return `https://${rawUrl}`;
  if (/^(www\.)?yallamotor\.com\//i.test(rawUrl)) return `https://${rawUrl}`;
  if (/^(www\.)?syarah\.com\//i.test(rawUrl)) return `https://${rawUrl}`;

  const normalizedPath = rawUrl.replace(/^\/+/, "");
  if (item.source === "haraj") {
    return `https://haraj.com.sa/${normalizedPath}`;
  }
  if (item.source === "yallamotor") {
    return `https://www.yallamotor.com/${normalizedPath}`;
  }
  if (item.source === "syarah") {
    return `https://syarah.com/${normalizedPath}`;
  }
  return rawUrl;
}

function escapeCsvValue(value: unknown) {
  const cell = String(value ?? "");
  if (/[",\r\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function sanitizeDescriptionText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/&rlm;/gi, "")
    .replace(/\u200f/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&bull;/gi, " ")
    .replace(/&mdash;|&#8212;|&#x2014;/gi, "—")
    .replace(/^[ \t]*([—-]\s*){6,}[ \t]*$/gm, "")
    .replace(/([—-]\s*){10,}/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|ul|ol|section|article|h[1-6])\s*>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, " ")
    .replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatYallaDescription(value: string) {
  if (!value) return "";
  const arabicTokens = [
    "أبواب",
    "ابواب",
    "أبواب",
    "باب",
    "أمام",
    "امام",
    "خلف",
    "جانبي",
    "جانبية",
    "نهارية",
    "تشغيل",
    "قيادة",
    "تحكم",
    "عجلات",
    "عجلة",
    "طارة",
    "مقود",
    "مرايا",
    "مرآة",
    "كشاف",
    "مصابيح",
    "ضباب",
    "إضاءة",
    "اضاءة",
    "LED",
    "ليد",
    "نظام",
    "فرامل",
    "ABS",
    "EBD",
    "ESP",
    "ISOFIX",
    "USB",
    "AUX",
    "CD",
    "DVD",
    "كهربائية",
    "كهربائي",
    "يدوية",
    "يدوي",
    "أوتوماتيك",
    "اوتوماتيك",
    "ناقل",
    "الحركة",
    "دفع",
    "رباعي",
    "ثنائي",
    "شاشة",
    "معلومات",
    "وسائط",
    "ملاحة",
    "GPS",
    "بلوتوث",
    "اتصال",
    "فتحة",
    "فتحت",
    "سقف",
    "بانورامي",
    "بانوراما",
    "نور",
    "أمان",
    "امان",
    "وسائد",
    "هوائية",
    "حزام",
    "إنذار",
    "انذار",
    "قفل",
    "مركزي",
    "ذكي",
    "مفتاح",
    "دخول",
    "بدون",
    "مفتاح",
    "سمارت",
    "نظام",
    "مقاعد",
    "مقعد",
    "كاميرا",
    "حساس",
    "حساسات",
    "مستشعر",
    "مستشعرات",
    "رادار",
    "بلوتوث",
    "تحكم",
    "دخول",
    "بدون",
    "مفتاح",
    "شحن",
    "لاسلكي",
    "ملاحة",
    "صوت",
    "سماعات",
    "هوائية",
    "وسائد",
    "جلد",
    "جلدية",
    "بانورامي",
    "تشغيل",
    "نهارية",
    "إضاءة",
    "اضاءة",
    "مكيف",
    "تكييف",
    "تبريد",
    "تدفئة",
    "تسخين",
    "تدليك",
    "تهوية",
    "مساعد",
    "تنبيه",
    "تحذير",
    "مراقبة",
    "نقطة",
    "عمياء",
    "ركن",
    "بارك",
    "صف",
    "أصوات",
    "ضغط",
    "إطارات",
    "اطارات",
    "شحن",
    "سريع",
    "نظام",
    "ملاحة",
    "مواصفات",
    "خليجية",
    "صينية",
    "أوروبية",
    "اوروبية",
    "أمريكية",
    "امريكية",
  ];

  const escapeRegex = (input: string) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  let text = sanitizeDescriptionText(value);
  text = text.replace(/\*\*/g, "\n");

  text = text
    .replace(/([\u0600-\u06FF])و(?=ال)/g, "$1 و")
    .replace(/([\u0600-\u06FF])ف(?=ال)/g, "$1 ف")
    .replace(/([\u0600-\u06FF])ب(?=ال)/g, "$1 ب")
    .replace(/([\u0600-\u06FF])ل(?=ال)/g, "$1 ل")
    .replace(/([\u0600-\u06FF])(ال)/g, "$1 $2")
    .replace(/ة(?=[\u0600-\u06FF])/g, "ة ");

  for (const token of arabicTokens.sort((a, b) => b.length - a.length)) {
    const escaped = escapeRegex(token);
    const afterToken = new RegExp(`(${escaped})([\\u0600-\\u06FF])`, "g");
    const beforeToken = new RegExp(`([\\u0600-\\u06FF])(${escaped})`, "g");
    text = text.replace(afterToken, "$1 $2");
    text = text.replace(beforeToken, "$1 $2");
  }

  text = text
    .replace(/([a-z])([A-Z])/g, "$1\n$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1\n$2")
    .replace(/([0-9])([A-Za-z])/g, "$1\n$2")
    .replace(/([A-Za-z])([0-9])/g, "$1\n$2")
    .replace(/([\u0600-\u06FF])([A-Za-z0-9])/g, "$1\n$2")
    .replace(/([A-Za-z0-9])([\u0600-\u06FF])/g, "$1\n$2")
    .replace(/([.،!?:;])\s*/g, "$1\n");
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\s*\n\s*/g, "\n");
  text = text.replace(/\n{2,}/g, "\n");
  return text.trim();
}

function pickPreferredLabel(current: string | undefined, candidate: string) {
  if (!current) return candidate;
  const currentHasLatin = /[a-z]/i.test(current);
  const candidateHasLatin = /[a-z]/i.test(candidate);
  if (candidateHasLatin && !currentHasLatin) return candidate;
  if (candidate.length < current.length) return candidate;
  return current;
}

function sortYearOptionsDescending(values: string[]) {
  return [...values].sort((a, b) => {
    const numA = Number(a);
    const numB = Number(b);
    if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
      return numB - numA;
    }
    return b.localeCompare(a);
  });
}

const MAX_MODEL_YEAR_SPAN = 300;

function buildContinuousYearOptions(values: string[]) {
  const uniqueSortedYears = sortYearOptionsDescending(
    Array.from(
      new Set(
        values
          .map((value) => Number.parseInt(value, 10))
          .filter((year) => Number.isFinite(year))
          .map((year) => String(year))
      )
    )
  );

  if (uniqueSortedYears.length === 0) {
    return [];
  }

  const newestYear = Number.parseInt(uniqueSortedYears[0], 10);
  const oldestYear = Number.parseInt(uniqueSortedYears[uniqueSortedYears.length - 1], 10);
  if (
    Number.isNaN(newestYear) ||
    Number.isNaN(oldestYear) ||
    newestYear - oldestYear > MAX_MODEL_YEAR_SPAN
  ) {
    return uniqueSortedYears;
  }

  const fullRange: string[] = [];
  for (let year = newestYear; year >= oldestYear; year -= 1) {
    fullRange.push(String(year));
  }
  return fullRange;
}

const PRIVATE_COMMENT_MARKER = "رد خاص. يظهر للعارض فقط";

function filterVehicleOptionsByInput(options: string[], input: string) {
  const query = input.trim();
  if (!query) return options;

  const canonicalQuery = toVehicleCanonicalKey(query);
  const loweredQuery = query.toLowerCase();

  return options.filter((option) => {
    if (isVehicleTextMatch(option, query)) {
      return true;
    }

    const optionCanonical = toVehicleCanonicalKey(option);
    if (canonicalQuery && optionCanonical.includes(canonicalQuery)) {
      return true;
    }

    return option.toLowerCase().includes(loweredQuery);
  });
}

function filterVisibleComments(comments: Array<Record<string, any>>) {
  return comments.filter((comment) => {
    const body = typeof comment?.body === "string" ? comment.body.replace(/\s+/g, " ").trim() : "";
    return !body.includes(PRIVATE_COMMENT_MARKER);
  });
}

export default function EvaluationSourcePage({
  tag0,
  excludeTag1Values,
  enableBrandFilter = false,
  enableModelFilter = false,
  enableModelYearFilter = false,
  enableMileageFilter = false,
  dataSources,
  requireSearchClickToApplyFilters = false,
}: EvaluationSourcePageProps) {
  const langContext = useContext(LanguageContext);
  const { trackAction } = useAuthTracking();
  const language = langContext?.language ?? "en";
  const t = language === "ar" ? copy.ar : copy.en;
  const isArabic = language === "ar";
  const mileageLabel = isArabic ? "\u0639\u062f\u0627\u062f \u0627\u0644\u0643\u064a\u0644\u0648\u0645\u062a\u0631\u0627\u062a" : "Mileage";
  const matchLabel = isArabic ? "\u062A\u0637\u0627\u0628\u0642" : "Match";
  const sourceLinkLabel = isArabic ? "\u0631\u0627\u0628\u0637 \u0627\u0644\u0645\u0635\u062f\u0631" : "Source link";
  const clearBrandLabel = isArabic ? "\u0643\u0644 \u0627\u0644\u0645\u0627\u0631\u0643\u0627\u062A" : "All brands";
  const clearModelLabel = isArabic ? "\u0643\u0644 \u0627\u0644\u0637\u0631\u0627\u0632\u0627\u062A" : "All models";
  const clearModelYearLabel = isArabic ? "\u0643\u0644 \u0627\u0644\u0633\u0646\u0648\u0627\u062A" : "All years";
  const noOptionsLabel = isArabic ? "\u0644\u0627 \u062A\u0648\u062C\u062F \u062E\u064A\u0627\u0631\u0627\u062A" : "No options found";
  const loadingOptionsLabel = isArabic ? "\u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u062E\u064A\u0627\u0631\u0627\u062A..." : "Loading options...";
  const openBrandOptionsLabel = isArabic ? "\u0639\u0631\u0636 \u062E\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u0627\u0631\u0643\u0629" : "Show brand options";
  const openModelOptionsLabel = isArabic ? "\u0639\u0631\u0636 \u062E\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0637\u0631\u0627\u0632" : "Show model options";
  const openModelYearOptionsLabel = isArabic ? "\u0639\u0631\u0636 \u062E\u064A\u0627\u0631\u0627\u062A \u0633\u0646\u0629 \u0627\u0644\u0635\u0646\u0639" : "Show manufacture year options";
  const filterLabelClass = isArabic
    ? "shrink-0 whitespace-nowrap text-base font-extrabold uppercase tracking-[0.1em] text-slate-800"
    : "shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.06em] text-slate-800";
  const mileageFilterLabelClass = isArabic
    ? "shrink-0 whitespace-nowrap text-sm font-extrabold uppercase tracking-[0.1em] text-slate-800"
    : "shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.06em] text-slate-800";
  const searchableFilterInputClass =
    "h-9 pr-9 text-sm transition-colors focus-visible:border-emerald-400 focus-visible:ring-emerald-400";
  const searchableFilterInputWithLeadingIconClass =
    "h-9 w-full min-w-0 pl-8 pr-9 text-sm transition-colors focus-visible:border-emerald-400 focus-visible:ring-emerald-400";
  const searchableDropdownClass =
    "absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto overscroll-contain rounded-md border border-slate-200 bg-white py-1 shadow-lg";
  const searchableDropdownOptionClass = "block w-full px-3 py-2 text-center text-sm transition hover:bg-slate-100";
  const getSourceDisplayName = (source: EvaluationSourceItem["source"]) => {
    if (source === "yallamotor") return t.filters.sourceOptions.yallamotor;
    if (source === "syarah") return t.filters.sourceOptions.syarah;
    return t.filters.sourceOptions.haraj;
  };
  const mileageMinPlaceholder = "Min";
  const mileageMaxPlaceholder = "Max";
  const resolvedSources = useMemo(
    () => (dataSources?.length ? dataSources : ["haraj"]),
    [dataSources]
  );
  const showSourceFilter = resolvedSources.length > 1;
  const useCombinedSources = resolvedSources.length > 1 || resolvedSources[0] !== "haraj";
  const listEndpoint = toApiUrl(
    useCombinedSources ? "/api/cars-sources" : "/api/haraj-scrape"
  );
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [data, setData] = useState<ListResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading");
  const [, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailStatus, setDetailStatus] = useState<"idle" | "loading" | "error">("idle");
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [imagesOpen, setImagesOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [modalStatus, setModalStatus] = useState<"idle" | "loading" | "error">("idle");
  const [modalImages, setModalImages] = useState<string[]>([]);
  const [modalComments, setModalComments] = useState<Array<Record<string, any>>>([]);
  const [optionPool, setOptionPool] = useState<EvaluationSourceItem[]>([]);
  const [allModelYearOptions, setAllModelYearOptions] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [shouldLoadOptionPool, setShouldLoadOptionPool] = useState(
    enableBrandFilter || enableModelFilter
  );
  const [optionPoolLoaded, setOptionPoolLoaded] = useState(false);
  const [optionPoolLoading, setOptionPoolLoading] = useState(false);
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [brandDropdownShowAll, setBrandDropdownShowAll] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [modelDropdownShowAll, setModelDropdownShowAll] = useState(false);
  const [modelYearDropdownOpen, setModelYearDropdownOpen] = useState(false);
  const [modelYearDropdownShowAll, setModelYearDropdownShowAll] = useState(false);
  const [commentsMode, setCommentsMode] = useState<"comments" | "priceCompare">("comments");
  const [modalPriceCompare, setModalPriceCompare] =
    useState<EvaluationSourceItem["priceCompare"] | null>(null);
  const [mounted, setMounted] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">("register");
  const [registrationRequiredMessage, setRegistrationRequiredMessage] =
    useState<string | null>(null);
  const listResponseCacheRef = useRef<Map<string, ListResponse>>(new Map());
  const brandDropdownRef = useRef<HTMLDivElement | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement | null>(null);
  const modelYearDropdownRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(target)) {
        setBrandDropdownOpen(false);
      }
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(target)) {
        setModelDropdownOpen(false);
      }
      if (modelYearDropdownRef.current && !modelYearDropdownRef.current.contains(target)) {
        setModelYearDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  const triggerRegistrationRequired = useCallback(
    (message?: string) => {
      setRegistrationRequiredMessage(
        message ?? "Guest attempts exhausted. Please register to continue."
      );
      setStatus("error");
      setAuthModalMode("register");
      setAuthModalOpen(true);
      trackAction({
        actionType: "registration_required",
        actionDetails: {
          route: "evaluation-source",
        },
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("sv:open-auth-modal", {
            detail: { mode: "register" },
          })
        );
      }
    },
    [trackAction]
  );

  const updateFilters = (updates: Partial<typeof defaultFilters>) => {
    setFilters((prev) => {
      const next = { ...prev, ...updates };
      if ("brand" in updates && updates.brand !== prev.brand) {
        next.model = "";
      }
      return next;
    });
  };

  const toggleDateSort = useCallback(() => {
    const currentDateSort = appliedFilters.sort === "oldest" ? "oldest" : "newest";
    const nextDateSort = currentDateSort === "newest" ? "oldest" : "newest";

    setFilters((prev) => ({ ...prev, sort: nextDateSort }));
    setAppliedFilters((prev) => ({ ...prev, sort: nextDateSort }));
    setPage(1);
  }, [appliedFilters.sort]);

  const saveSearchToHistory = (searchValue: string) => {
    const normalizedValue = searchValue.trim();
    if (!normalizedValue) return;

    setSearchHistory((previous) => {
      const updated = [
        normalizedValue,
        ...previous.filter((item) => item.toLowerCase() !== normalizedValue.toLowerCase()),
      ].slice(0, SEARCH_HISTORY_MAX_ITEMS);
      try {
        window.localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // localStorage can fail in strict privacy modes; keep in-memory history.
      }
      return updated;
    });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    try {
      window.localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
    } catch {
      // localStorage can fail in strict privacy modes; state is already cleared.
    }
  };

  const applyFilters = () => {
    trackAction({
      actionType: "search",
      actionDetails: {
        query: filters.search,
        match: filters.match,
        city: filters.city,
        brand: filters.brand,
        model: filters.model,
        year: filters.modelYear,
        source: filters.source,
      },
    });
    saveSearchToHistory(filters.search);
    setAppliedFilters({ ...filters });
    setPage(1);
  };

  const resetFilters = () => {
    trackAction({
      actionType: "filters_reset",
    });
    const resetState = { ...defaultFilters };
    setFilters(resetState);
    setAppliedFilters(resetState);
    setBrandDropdownOpen(false);
    setBrandDropdownShowAll(false);
    setModelDropdownOpen(false);
    setModelDropdownShowAll(false);
    setModelYearDropdownOpen(false);
    setModelYearDropdownShowAll(false);
    setPage(1);
  };

  const ensureOptionPoolLoaded = () => {
    if (!enableBrandFilter && !enableModelFilter) {
      return;
    }
    if (optionPoolLoaded || optionPoolLoading) return;
    setShouldLoadOptionPool(true);
  };

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (appliedFilters.search) params.set("search", appliedFilters.search);
    if (appliedFilters.match && appliedFilters.search.trim()) {
      params.set("exactSearch", "true");
    }
    if (appliedFilters.city) params.set("city", appliedFilters.city);
    if (appliedFilters.hasImage !== "any") params.set("hasImage", appliedFilters.hasImage);
    if (appliedFilters.hasPrice !== "any") params.set("hasPrice", appliedFilters.hasPrice);
    if (appliedFilters.hasComments !== "any") params.set("hasComments", appliedFilters.hasComments);
    if (enableMileageFilter && appliedFilters.hasMileage !== "any") {
      params.set("hasMileage", appliedFilters.hasMileage);
    }
    if (appliedFilters.sort) params.set("sort", appliedFilters.sort);
    if (tag0) params.set("tag0", tag0);
    if (useCombinedSources) {
      const selectedSource = appliedFilters.source?.trim();
      const availableSources = resolvedSources;
      const sourcesParam =
        !selectedSource || selectedSource === "all"
          ? availableSources
          : availableSources.includes(selectedSource as "haraj" | "yallamotor" | "syarah")
            ? [selectedSource]
            : availableSources;
      params.set("sources", sourcesParam.join(","));
    }
    if (enableBrandFilter && appliedFilters.brand) params.set("tag1", appliedFilters.brand);
    if (enableModelFilter && appliedFilters.model) params.set("tag2", appliedFilters.model);
    if (enableModelYearFilter && appliedFilters.modelYear) {
      params.set("carModelYear", appliedFilters.modelYear);
    }
    if (enableMileageFilter) {
      const mileageMinValue = Number(appliedFilters.mileageMin);
      const mileageMaxValue = Number(appliedFilters.mileageMax);
      if (!Number.isNaN(mileageMinValue) && mileageMinValue > 0) {
        params.set("mileageMin", String(mileageMinValue));
      }
      if (!Number.isNaN(mileageMaxValue) && mileageMaxValue > 0) {
        params.set("mileageMax", String(mileageMaxValue));
      }
    }
    if (excludeTag1Values && excludeTag1Values.length > 0) {
      const filtered = excludeTag1Values.map((value) => value.trim()).filter(Boolean);
      if (filtered.length > 0) params.set("excludeTag1", filtered.join(","));
    }
    params.set("page", String(page));
    params.set("limit", String(limit));
    params.set("countMode", "none");
    return params.toString();
  }, [
    appliedFilters,
    page,
    limit,
    tag0,
    excludeTag1Values,
    enableBrandFilter,
    enableModelFilter,
    enableModelYearFilter,
    enableMileageFilter,
    useCombinedSources,
    resolvedSources,
  ]);
  const listRequestUrl = useMemo(() => `${listEndpoint}?${queryString}`, [listEndpoint, queryString]);

  const optionsBaseQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (tag0) params.set("tag0", tag0);
    params.set("fields", "options");
    params.set("countMode", "none");
    if (useCombinedSources) {
      params.set("sources", resolvedSources.join(","));
    }
    if (excludeTag1Values && excludeTag1Values.length > 0) {
      const filtered = excludeTag1Values.map((value) => value.trim()).filter(Boolean);
      if (filtered.length > 0) params.set("excludeTag1", filtered.join(","));
    }
    return params.toString();
  }, [tag0, excludeTag1Values, useCombinedSources, resolvedSources]);

  const modelYearOptionsQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (tag0) params.set("tag0", tag0);
    params.set("fields", "modelYears");
    params.set("countMode", "none");
    if (useCombinedSources) {
      params.set("sources", resolvedSources.join(","));
    }
    if (excludeTag1Values && excludeTag1Values.length > 0) {
      const filtered = excludeTag1Values.map((value) => value.trim()).filter(Boolean);
      if (filtered.length > 0) params.set("excludeTag1", filtered.join(","));
    }
    return params.toString();
  }, [tag0, excludeTag1Values, useCombinedSources, resolvedSources]);

  useEffect(() => {
    if (requireSearchClickToApplyFilters) return;
    setAppliedFilters(filters);
    setPage(1);
  }, [filters, requireSearchClickToApplyFilters]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      const sanitized = parsed
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, SEARCH_HISTORY_MAX_ITEMS);

      if (sanitized.length > 0) {
        setSearchHistory(sanitized);
      }
    } catch {
      setSearchHistory([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      setError(null);
      const cachedResponse = listResponseCacheRef.current.get(listRequestUrl);
      if (cachedResponse) {
        setData(cachedResponse);
        setStatus("idle");
      } else {
        setStatus("loading");
      }

      try {
        const response = await fetch(listRequestUrl, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status === 403) {
            const payload = (await response.json().catch(() => ({}))) as {
              error?: string;
              message?: string;
            };
            if (payload.error === "registration_required") {
              if (active) {
                triggerRegistrationRequired(payload.message);
              }
              return;
            }
          }
          throw new Error("Failed to fetch evaluation source data.");
        }
        const result = (await response.json()) as ListResponse;
        if (active) {
          setCachedListResponse(listResponseCacheRef.current, listRequestUrl, result);
          setData(result);
          setRegistrationRequiredMessage(null);
          setStatus("idle");
        }

        if (result.hasNext) {
          const nextParams = new URLSearchParams(queryString);
          nextParams.set("page", String((result.page ?? page) + 1));
          const nextPageUrl = `${listEndpoint}?${nextParams.toString()}`;
          if (!listResponseCacheRef.current.has(nextPageUrl)) {
            void fetch(nextPageUrl, { cache: "no-store" })
              .then((nextResponse) => {
                if (!nextResponse.ok) return null;
                return nextResponse.json() as Promise<ListResponse>;
              })
              .then((nextResult) => {
                if (!nextResult) return;
                setCachedListResponse(listResponseCacheRef.current, nextPageUrl, nextResult);
              })
              .catch(() => {
                // Next-page prefetch is best effort only.
              });
          }
        }
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        if (active) {
          setStatus("error");
          setError(t.status.error);
        }
      }
    };

    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [listRequestUrl, queryString, listEndpoint, page, triggerRegistrationRequired]);

  useEffect(() => {
    if (!enableModelYearFilter) return;
    let active = true;
    const controller = new AbortController();

    const loadModelYears = async () => {
      try {
        const response = await fetch(`${listEndpoint}?${modelYearOptionsQueryString}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          if (response.status === 403) {
            const payload = (await response.json().catch(() => ({}))) as {
              error?: string;
              message?: string;
            };
            if (payload.error === "registration_required") {
              if (active) {
                triggerRegistrationRequired(payload.message);
              }
              return;
            }
          }
          throw new Error("Failed to fetch model year options.");
        }
        const result = (await response.json()) as ListResponse;
        const years = result.items
          .map((item) => item.carModelYear)
          .filter((value): value is number => value !== null && value !== undefined)
          .map((value) => String(value).trim())
          .filter(Boolean);
        const uniqueSortedYears = buildContinuousYearOptions(years);
        if (active) {
          setAllModelYearOptions(uniqueSortedYears);
        }
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        if (active) {
          setAllModelYearOptions([]);
        }
      }
    };

    loadModelYears();
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    enableModelYearFilter,
    listEndpoint,
    modelYearOptionsQueryString,
    triggerRegistrationRequired,
  ]);

  useEffect(() => {
    if (!enableBrandFilter && !enableModelFilter) {
      return;
    }
    if (!shouldLoadOptionPool) return;
    let active = true;
    const controller = new AbortController();

    const loadOptions = async () => {
      if (active) setOptionPoolLoading(true);
      try {
        const pageSize = 200;
        const maxPages = 12;
        const maxItems = 2400;
        let currentPage = 1;
        let totalItems: number | null = null;
        const collected: EvaluationSourceItem[] = [];

        while (
          active &&
          currentPage <= maxPages &&
          collected.length < maxItems
        ) {
          const query = new URLSearchParams(optionsBaseQueryString);
          query.set("page", String(currentPage));
          query.set("limit", String(pageSize));

          const response = await fetch(`${listEndpoint}?${query.toString()}`, {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) {
            if (response.status === 403) {
              const payload = (await response.json().catch(() => ({}))) as {
                error?: string;
                message?: string;
              };
              if (payload.error === "registration_required") {
                if (active) {
                  triggerRegistrationRequired(payload.message);
                }
                break;
              }
            }
            break;
          }
          const result = (await response.json()) as ListResponse;
          const fetchedItems = result.items ?? [];
          collected.push(...fetchedItems);
          if (typeof result.total === "number" && result.total >= 0) {
            totalItems = Math.min(result.total, maxItems);
          }
          if (fetchedItems.length === 0) break;
          if (totalItems !== null && collected.length >= totalItems) break;
          if (result.hasNext === false) break;
          currentPage += 1;
        }

        if (active) {
          setOptionPool(collected);
          setOptionPoolLoaded(true);
          setOptionPoolLoading(false);
          setShouldLoadOptionPool(false);
        }
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        if (active) {
          setOptionPool([]);
          setOptionPoolLoading(false);
          setShouldLoadOptionPool(false);
        }
      }
    };

    loadOptions();
    return () => {
      active = false;
      controller.abort();
    };
  }, [
    enableBrandFilter,
    enableModelFilter,
    listEndpoint,
    optionsBaseQueryString,
    shouldLoadOptionPool,
    triggerRegistrationRequired,
  ]);

  const items = data?.items ?? [];
  const optionItems = optionPoolLoaded && optionPool.length > 0 ? optionPool : items;
  const activeDateSort = appliedFilters.sort === "oldest" ? "oldest" : "newest";
  const hasKnownTotal = typeof data?.total === "number" && data.total >= 0;
  const totalPages = hasKnownTotal ? Math.max(Math.ceil((data?.total ?? 0) / limit), 1) : null;
  const hasNextPage = hasKnownTotal ? page < (totalPages ?? 1) : Boolean(data?.hasNext);
  const showingSummary = hasKnownTotal
    ? t.table.showing(items.length, page, totalPages ?? 1)
    : isArabic
      ? `عرض ${items.length} سجل (الصفحة ${page})`
      : `Showing ${items.length} records (page ${page})`;
  const showingPageSummary = hasKnownTotal
    ? t.table.showingPage(page, totalPages ?? 1)
    : isArabic
      ? `الصفحة ${page}`
      : `Page ${page}`;

  const brandOptions = useMemo(() => {
    const optionsMap = new Map<string, string>();
    optionItems
      .map((item) => item.tags?.[1]?.trim())
      .filter((value): value is string => Boolean(value))
      .forEach((brand) => {
        const key = toVehicleCanonicalKey(brand);
        if (!key) return;
        optionsMap.set(key, pickPreferredLabel(optionsMap.get(key), brand));
      });
    return Array.from(optionsMap.values()).sort((a, b) => a.localeCompare(b));
  }, [optionItems]);

  const modelOptions = useMemo(() => {
    const filteredByBrand = filters.brand
      ? optionItems.filter((item) => isVehicleTextMatch(item.tags?.[1], filters.brand))
      : optionItems;
    const optionsMap = new Map<string, string>();
    filteredByBrand
      .map((item) => item.tags?.[2]?.trim())
      .filter((value): value is string => Boolean(value))
      .forEach((model) => {
        const key = toVehicleCanonicalKey(model);
        if (!key) return;
        optionsMap.set(key, pickPreferredLabel(optionsMap.get(key), model));
      });
    return Array.from(optionsMap.values()).sort((a, b) => a.localeCompare(b));
  }, [optionItems, filters.brand]);

  const visibleBrandOptions = useMemo(
    () =>
      brandDropdownShowAll
        ? brandOptions
        : filterVehicleOptionsByInput(brandOptions, filters.brand),
    [brandDropdownShowAll, brandOptions, filters.brand]
  );

  const visibleModelOptions = useMemo(
    () =>
      modelDropdownShowAll
        ? modelOptions
        : filterVehicleOptionsByInput(modelOptions, filters.model),
    [modelDropdownShowAll, modelOptions, filters.model]
  );

  const modelYearOptions = useMemo(() => {
    if (allModelYearOptions.length > 0) {
      return allModelYearOptions;
    }
    const years = optionItems
      .map((item) => item.carModelYear)
      .filter((value): value is number => value !== null && value !== undefined)
      .map((value) => String(value).trim())
      .filter(Boolean);
    return buildContinuousYearOptions(years);
  }, [allModelYearOptions, optionItems]);

  const visibleModelYearOptions = useMemo(() => {
    if (modelYearDropdownShowAll) {
      return modelYearOptions;
    }

    const query = filters.modelYear.trim();
    if (!query) {
      return modelYearOptions;
    }

    return modelYearOptions.filter((year) => year.includes(query));
  }, [modelYearDropdownShowAll, modelYearOptions, filters.modelYear]);

  const fetchDetail = async (item: EvaluationSourceItem) => {
    const source = item.source ?? "haraj";
    const endpoint = toApiUrl(
      source === "yallamotor"
        ? "/api/yallamotor-scrape"
        : source === "syarah"
          ? "/api/syarah-scrape"
          : "/api/haraj-scrape"
    );
    const response = await fetch(`${endpoint}/${encodeURIComponent(item.id)}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Unable to load document details.");
    }
    const doc = (await response.json()) as Record<string, any>;
    return { ...doc, __source: source } as Record<string, any>;
  };

  const openDetails = async (item: EvaluationSourceItem) => {
    trackAction({
      actionType: "open_details",
      actionDetails: {
        itemId: item.id,
        source: item.source,
      },
    });
    setDetailOpen(true);
    setDetailStatus("loading");
    setDetail(null);
    try {
      const doc = await fetchDetail(item);
      setDetail(doc);
      setDetailStatus("idle");
    } catch (err) {
      setDetailStatus("error");
    }
  };

  const openImages = async (item: EvaluationSourceItem) => {
    trackAction({
      actionType: "open_images",
      actionDetails: {
        itemId: item.id,
        source: item.source,
        imageCount: item.imagesCount,
      },
    });
    setImagesOpen(true);
    setModalStatus("loading");
    setModalImages([]);
    try {
      const doc = (await fetchDetail(item)) as Record<string, any>;
      const images =
        item.source === "yallamotor"
          ? ((doc?.detail?.images ?? doc?.images ?? []) as string[])
          : item.source === "syarah"
            ? ((doc?.images ?? (doc?.featured_image ? [doc.featured_image] : [])) as string[])
            : ((doc?.item?.imagesList ?? doc?.imagesList ?? []) as string[]);
      setModalImages(images);
      setModalStatus("idle");
    } catch (err) {
      setModalStatus("error");
    }
  };

  const openComments = async (item: EvaluationSourceItem) => {
    trackAction({
      actionType: "open_comments",
      actionDetails: {
        itemId: item.id,
        source: item.source,
        commentsCount: item.commentsCount,
      },
    });
    if (item.source === "yallamotor") {
      setCommentsOpen(true);
      setCommentsMode("priceCompare");
      setModalStatus("idle");
      setModalComments([]);
      setModalPriceCompare(item.priceCompare ?? null);
      return;
    }
    setCommentsOpen(true);
    setCommentsMode("comments");
    setModalStatus("loading");
    setModalComments([]);
    setModalPriceCompare(null);
    try {
      const doc = (await fetchDetail(item)) as Record<string, any>;
      const comments =
        (doc?.comments ??
          doc?.gql?.comments?.json?.data?.comments?.items ??
          []) as Array<Record<string, any>>;
      setModalComments(filterVisibleComments(comments));
      setModalStatus("idle");
    } catch (err) {
      setModalStatus("error");
    }
  };

  const detailSource = (detail as any)?.__source ?? (detail as any)?.source ?? "haraj";
  const isYallaDetail = detailSource === "yallamotor";
  const isSyarahDetail = detailSource === "syarah";
  const detailImages = (isYallaDetail
    ? detail?.detail?.images ?? detail?.images ?? []
    : isSyarahDetail
      ? detail?.images ?? (detail?.featured_image ? [detail.featured_image] : [])
      : detail?.item?.imagesList ?? detail?.imagesList ?? []) as string[];
  const detailTags = (isYallaDetail
    ? detail?.detail?.breadcrumb ?? detail?.breadcrumb ?? []
    : isSyarahDetail
      ? ["syarah", detail?.brand ?? "", detail?.model ?? "", detail?.trim ?? ""]
    : detail?.tags ?? detail?.item?.tags ?? []) as string[];
  const detailComments = filterVisibleComments(
    (isYallaDetail || isSyarahDetail
      ? []
      : detail?.comments ?? detail?.gql?.comments?.json?.data?.comments?.items ?? []) as Array<Record<string, any>>
  );
  const syarahCarInfo = isSyarahDetail
    ? ({
        origin: detail?.origin,
        fuel_type: detail?.fuel_type,
        transmission: detail?.transmission,
        engine_size: detail?.engine_size,
        cylinders: detail?.cylinders,
        horse_power: detail?.horse_power,
        drivetrain: detail?.drivetrain,
        engine_type: detail?.engine_type,
        fuel_tank_liters: detail?.fuel_tank_liters,
        fuel_economy_kml: detail?.fuel_economy_kml,
        seats: detail?.seats,
        chassis_number: detail?.chassis_number,
        plate_number: detail?.plate_number,
        body_is_clear: detail?.body_is_clear,
      } as Record<string, any>)
    : null;
  const carInfo = (isYallaDetail
    ? detail?.detail?.importantSpecs
    : isSyarahDetail
      ? syarahCarInfo
    : detail?.item?.carInfo ??
      detail?.carInfo ??
      detail?.gql?.posts?.json?.data?.posts?.items?.[0]?.carInfo ??
      null) as Record<string, any> | null;
  const carMileage = isSyarahDetail
    ? detail?.mileage_km ?? null
    : !isYallaDetail
      ? (carInfo as any)?.mileage ?? null
      : null;
  const carInfoEntries =
    carInfo && typeof carInfo === "object" && !Array.isArray(carInfo)
      ? Object.entries(carInfo).filter(
          ([key, value]) =>
            (isYallaDetail || isSyarahDetail ? true : key !== "mileage") &&
            value !== null &&
            value !== undefined &&
            value !== ""
        )
      : [];
  const detailFeatures = (isYallaDetail ? detail?.detail?.features ?? [] : []) as string[];
  const detailPriceCompare = isYallaDetail ? detail?.detail?.priceCompare ?? detail?.priceCompare ?? null : null;
  const detailSourceUrl = resolveSourceUrl({
    source: isYallaDetail ? "yallamotor" : isSyarahDetail ? "syarah" : "haraj",
    url: String(
      (isYallaDetail
        ? detail?.url ?? detail?.detail?.url
        : isSyarahDetail
          ? detail?.share_link ?? detail?.url
          : detail?.url ?? detail?.item?.URL) ?? ""
    ),
  });
  const detailNotes = isYallaDetail
    ? formatYallaDescription(detail?.detail?.description ?? "") || t.modals.noDescription
    : isSyarahDetail
      ? sanitizeDescriptionText(detail?.title ?? "") || t.modals.noDescription
      : sanitizeDescriptionText(detail?.item?.bodyTEXT ?? detail?.item?.bodyHTML ?? "") ||
        t.modals.noDescription;
  const normalizedDetailTags = detailTags
    .filter((tag): tag is string => Boolean(tag))
    .slice(isYallaDetail ? 3 : 1);
  const normalizedFeatures = detailFeatures.filter((feature) => Boolean(feature));
  const carInfoGridEntries = carInfo
    ? [
        ...(!isYallaDetail
          ? [
              {
                key: "mileage",
                label: t.carInfo.mileage,
                value: carMileage ?? "-",
              },
            ]
          : []),
        ...carInfoEntries.map(([key, value]) => ({
          key,
          label: key === "sellOrWaiver" ? t.carInfo.sellOrWaiver : key,
          value,
        })),
      ]
    : [];
  const priceCompareEntries = detailPriceCompare
    ? [
        { label: t.table.priceCompareLabel.min, value: detailPriceCompare.min ?? "-" },
        { label: t.table.priceCompareLabel.max, value: detailPriceCompare.max ?? "-" },
        { label: t.table.priceCompareLabel.current, value: detailPriceCompare.current ?? "-" },
      ]
    : [];
  const summaryItems =
    detail && detailStatus === "idle"
      ? isYallaDetail
        ? [
            {
              label: t.modals.titleLabel,
              value: detail?.cardTitle ?? detail?.detail?.breadcrumb?.slice(-1)?.[0] ?? "-",
            },
            {
              label: t.modals.cityLabel,
              value: detail?.detail?.breadcrumb?.[2] ?? "-",
            },
            {
              label: t.modals.priceLabel,
              value: detail?.cardPriceText ?? "-",
            },
            {
              label: t.modals.dateLabel,
              value: formatEpoch(detail?.fetchedAt ?? detail?.detailScrapedAt ?? null),
            },
            ...(detail?.sectionLabel
              ? [
                  {
                    label: t.modals.sectionLabel,
                    value: String(detail.sectionLabel),
                  },
                ]
              : []),
            {
              label: t.modals.sourceLabel,
              value: detailSourceUrl ? t.modals.openListing : "-",
              href: detailSourceUrl || undefined,
            },
          ]
        : isSyarahDetail
          ? [
              {
                label: t.modals.titleLabel,
                value: detail?.title ?? "-",
              },
              {
                label: t.modals.cityLabel,
                value: detail?.city ?? "-",
              },
              {
                label: t.modals.priceLabel,
                value: formatPrice(detail?.price_cash ?? detail?.priceNumeric ?? null, null),
              },
              {
                label: t.modals.dateLabel,
                value: formatEpoch(detail?.fetchedAt ?? null),
              },
              {
                label: t.modals.sourceLabel,
                value: detailSourceUrl ? t.modals.openListing : "-",
                href: detailSourceUrl || undefined,
              },
            ]
        : [
            {
              label: t.modals.titleLabel,
              value: detail?.title ?? detail?.item?.title ?? "-",
            },
            {
              label: t.modals.cityLabel,
              value: detail?.city ?? detail?.item?.city ?? detail?.item?.geoCity ?? "-",
            },
            {
              label: t.modals.priceLabel,
              value: formatPrice(
                detail?.priceNumeric ?? detail?.item?.price?.numeric ?? null,
                detail?.item?.price?.formattedPrice ?? null
              ),
            },
            {
              label: t.modals.phoneLabel,
              value: String(detail?.phone ?? "-"),
            },
            {
              label: t.modals.sourceLabel,
              value: detailSourceUrl ? t.modals.openListing : "-",
              href: detailSourceUrl || undefined,
            },
          ]
      : [];

  const exportCurrentRows = () => {
    if (items.length === 0) return;
    trackAction({
      actionType: "export",
      actionDetails: {
        format: "csv",
        rows: items.length,
        query: appliedFilters.search,
      },
    });

    const headers = [
      t.table.title,
      t.table.brand,
      t.table.model,
      t.table.manufactureYear,
      mileageLabel,
      t.table.price,
      t.table.date,
      t.table.images,
      t.table.comments,
      t.filters.source,
      sourceLinkLabel,
    ];

    const rows = items.map((item) => {
      const commentsValue =
        item.source === "yallamotor" ? t.modals.priceCompareTitle : String(item.commentsCount ?? 0);
      const sourceName = getSourceDisplayName(item.source);
      const sourceUrl = resolveSourceUrl(item);

      return [
        item.title ?? "-",
        item.tags?.[1] ?? "-",
        item.tags?.[2] ?? "-",
        item.carModelYear ?? "-",
        formatMileage(item.mileage),
        formatPrice(item.priceNumeric, item.priceFormatted),
        formatEpoch(item.postDate),
        item.imagesCount ?? 0,
        commentsValue,
        sourceName,
        sourceUrl || "-",
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    anchor.href = url;
    anchor.download = `evaluation-source-${items.length}-rows-${stamp}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!mounted) {
    return (
      <div className={`min-h-screen bg-[#f7f4ee] text-slate-900 ${plex.className}`}>
        <Header />
        <main className="px-6 py-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Loading page...
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-[#f7f4ee] text-slate-900 ${plex.className}`}>
      <style>{animationStyles}</style>
      <Header />
      <main className="relative overflow-x-hidden overflow-y-visible">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-16 right-10 h-48 w-48 rounded-full bg-amber-200/40 blur-3xl float-slow" />
          <div
            className="absolute top-1/3 -left-10 h-56 w-56 rounded-full bg-cyan-200/50 blur-3xl float-slow"
            style={{ animationDelay: "-4s" }}
          />
          <div
            className="absolute bottom-20 right-1/3 h-64 w-64 rounded-full bg-rose-200/40 blur-3xl float-slow"
            style={{ animationDelay: "-7s" }}
          />
        </div>

        {/* <section className="relative">
          <div className="w-full px-6 py-12">
            <div className="space-y-6">
                <Badge className="bg-slate-900 text-white px-4 py-2 text-xs uppercase tracking-[0.35em]">
                  Evaluation Source
                </Badge>
                <div className={`text-4xl md:text-5xl font-semibold leading-tight ${sora.className}`}>
                  Evaluation Source
                </div>
            </div>
          </div>
        </section> */}

        <section className="relative pb-16">
          <div className="w-full px-6">
            <div className="relative overflow-visible rounded-3xl border border-emerald-200/70 bg-white/85 p-4 shadow-[0_35px_120px_-50px_rgba(16,185,129,0.55)] backdrop-blur">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-16 right-8 h-40 w-40 rounded-full bg-emerald-200/40 blur-3xl" />
                <div className="absolute -bottom-12 left-6 h-36 w-36 rounded-full bg-cyan-200/40 blur-3xl" />
                <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-r from-transparent via-emerald-200/40 to-transparent opacity-60" />
              </div>

              <div className="relative flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  {/* <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[10px] uppercase tracking-[0.35em] text-white">
                    {t.filters.badge}
                  </span> */}
                  <h2 className={`text-lg font-semibold text-slate-900 ${sora.className}`}>{t.filters.title}</h2>
                  <p className="text-xs text-slate-500">
                    {requireSearchClickToApplyFilters
                      ? t.filters.searchModeSubtitle
                      : t.filters.subtitle}
                  </p>
                </div>
              </div>

              <div
                className="relative mt-3 rounded-2xl border border-slate-200/70 bg-slate-200/70 p-[1px]"
              >
                <div className="rounded-[15px] bg-slate-200/70">
                  <div
                    className={`grid gap-[1px] bg-slate-200/70 md:grid-cols-2 ${
                      showSourceFilter ? "lg:grid-cols-6" : "lg:grid-cols-5"
                    }`}
                  >
                    <div className="flex flex-col gap-2 bg-white/95 px-3 py-2 sm:flex-row sm:items-center lg:col-span-2">
                      <div className="flex shrink-0 items-center gap-3">
                        <Label className={filterLabelClass}>
                          {t.filters.search}
                        </Label>
                      </div>
                      <div className="flex w-full min-w-0 flex-1 flex-nowrap items-center gap-2">
                        <div className="relative w-full min-w-0 flex-1">
                          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            list="search-history-options"
                            value={filters.search}
                            onChange={(event) => updateFilters({ search: event.target.value })}
                            placeholder={t.filters.searchPlaceholder}
                            className="h-9 w-full min-w-[220px] pl-8 text-sm"
                          />
                          <datalist id="search-history-options">
                            {searchHistory.map((value) => (
                              <option key={value} value={value} />
                            ))}
                          </datalist>
                        </div>
                        <label className="inline-flex shrink-0 select-none items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-slate-600">
                          <input
                            type="checkbox"
                            checked={filters.match}
                            onChange={(event) => updateFilters({ match: event.target.checked })}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>{matchLabel}</span>
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 w-fit shrink-0 whitespace-nowrap border-slate-300 px-2 text-[11px] uppercase tracking-[0.12em]"
                          onClick={clearSearchHistory}
                          disabled={searchHistory.length === 0}
                        >
                          {t.filters.clearHistory}
                        </Button>
                      </div>
                    </div>
                    {enableBrandFilter ? (
                      <div className="flex items-center gap-2 bg-white/95 px-3 py-2">
                        <Label className={filterLabelClass}>
                          {t.filters.brand}
                        </Label>
                        <div className="relative min-w-0 flex-1" ref={brandDropdownRef}>
                          <Input
                            value={filters.brand}
                            onChange={(event) => {
                              ensureOptionPoolLoaded();
                              setBrandDropdownShowAll(false);
                              setBrandDropdownOpen(true);
                              updateFilters({ brand: event.target.value });
                            }}
                            onFocus={() => {
                              ensureOptionPoolLoaded();
                              setBrandDropdownShowAll(false);
                              setBrandDropdownOpen(true);
                            }}
                            placeholder={t.filters.brandPlaceholder}
                            className={searchableFilterInputClass}
                          />
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              ensureOptionPoolLoaded();
                              setBrandDropdownShowAll(true);
                              setBrandDropdownOpen(true);
                            }}
                            className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                            aria-label={openBrandOptionsLabel}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          {brandDropdownOpen ? (
                            <div className={searchableDropdownClass}>
                              {optionPoolLoading && !optionPoolLoaded ? (
                                <div className="px-3 py-2 text-center text-sm text-slate-400">{loadingOptionsLabel}</div>
                              ) : null}
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  updateFilters({ brand: "" });
                                  setBrandDropdownOpen(false);
                                  setBrandDropdownShowAll(false);
                                }}
                                className={`${searchableDropdownOptionClass} ${
                                  filters.brand ? "text-slate-700" : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {clearBrandLabel}
                              </button>
                              {visibleBrandOptions.map((brand) => (
                                <button
                                  key={brand}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    updateFilters({ brand });
                                    setBrandDropdownOpen(false);
                                    setBrandDropdownShowAll(false);
                                  }}
                                  className={`${searchableDropdownOptionClass} ${
                                    isVehicleTextMatch(brand, filters.brand)
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {brand}
                                </button>
                              ))}
                              {visibleBrandOptions.length === 0 ? (
                                <div className="px-3 py-2 text-center text-sm text-slate-400">{noOptionsLabel}</div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {enableModelFilter ? (
                      <div className="flex items-center gap-2 bg-white/95 px-3 py-2">
                        <Label className={filterLabelClass}>
                          {t.filters.model}
                        </Label>
                        <div className="relative min-w-0 flex-1" ref={modelDropdownRef}>
                          <Input
                            value={filters.model}
                            onChange={(event) => {
                              ensureOptionPoolLoaded();
                              setModelDropdownShowAll(false);
                              setModelDropdownOpen(true);
                              updateFilters({ model: event.target.value });
                            }}
                            onFocus={() => {
                              ensureOptionPoolLoaded();
                              setModelDropdownShowAll(false);
                              setModelDropdownOpen(true);
                            }}
                            placeholder={t.filters.modelPlaceholder}
                            className={searchableFilterInputClass}
                          />
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              ensureOptionPoolLoaded();
                              setModelDropdownShowAll(true);
                              setModelDropdownOpen(true);
                            }}
                            className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                            aria-label={openModelOptionsLabel}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          {modelDropdownOpen ? (
                            <div className={searchableDropdownClass}>
                              {optionPoolLoading && !optionPoolLoaded ? (
                                <div className="px-3 py-2 text-center text-sm text-slate-400">{loadingOptionsLabel}</div>
                              ) : null}
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  updateFilters({ model: "" });
                                  setModelDropdownOpen(false);
                                  setModelDropdownShowAll(false);
                                }}
                                className={`${searchableDropdownOptionClass} ${
                                  filters.model ? "text-slate-700" : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {clearModelLabel}
                              </button>
                              {visibleModelOptions.map((model) => (
                                <button
                                  key={model}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    updateFilters({ model });
                                    setModelDropdownOpen(false);
                                    setModelDropdownShowAll(false);
                                  }}
                                  className={`${searchableDropdownOptionClass} ${
                                    isVehicleTextMatch(model, filters.model)
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {model}
                                </button>
                              ))}
                              {visibleModelOptions.length === 0 ? (
                                <div className="px-3 py-2 text-center text-sm text-slate-400">{noOptionsLabel}</div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {enableModelYearFilter ? (
                      <div className={`flex gap-2 bg-white/95 px-3 py-2 ${isArabic ? "items-center" : "flex-col"}`}>
                        <Label className={filterLabelClass}>
                          {t.filters.manufactureYear}
                        </Label>
                        <div
                          className={`relative min-w-0 ${isArabic ? "flex-1" : "w-full"}`}
                          ref={modelYearDropdownRef}
                        >
                          <Tag className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            value={filters.modelYear}
                            onChange={(event) => {
                              setModelYearDropdownShowAll(false);
                              setModelYearDropdownOpen(true);
                              updateFilters({ modelYear: event.target.value });
                            }}
                            onFocus={() => {
                              setModelYearDropdownShowAll(false);
                              setModelYearDropdownOpen(true);
                            }}
                            placeholder={t.filters.manufactureYearPlaceholder}
                            className={searchableFilterInputWithLeadingIconClass}
                          />
                          <button
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              setModelYearDropdownShowAll(true);
                              setModelYearDropdownOpen(true);
                            }}
                            className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                            aria-label={openModelYearOptionsLabel}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          {modelYearDropdownOpen ? (
                            <div className={searchableDropdownClass}>
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  updateFilters({ modelYear: "" });
                                  setModelYearDropdownOpen(false);
                                  setModelYearDropdownShowAll(false);
                                }}
                                className={`${searchableDropdownOptionClass} ${
                                  filters.modelYear ? "text-slate-700" : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {clearModelYearLabel}
                              </button>
                              {visibleModelYearOptions.map((year) => (
                                <button
                                  key={year}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    updateFilters({ modelYear: year });
                                    setModelYearDropdownOpen(false);
                                    setModelYearDropdownShowAll(false);
                                  }}
                                  className={`${searchableDropdownOptionClass} ${
                                    year === filters.modelYear
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {year}
                                </button>
                              ))}
                              {visibleModelYearOptions.length === 0 ? (
                                <div className="px-3 py-2 text-center text-sm text-slate-400">{noOptionsLabel}</div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {showSourceFilter ? (
                      <div className="flex items-center gap-2 bg-white/95 px-3 py-2">
                        <Label className={filterLabelClass}>
                          {t.filters.source}
                        </Label>
                        <div className="flex-1">
                          <Select
                            value={filters.source}
                            onValueChange={(value) => updateFilters({ source: value })}
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder={t.filters.sourcePlaceholder} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">{t.filters.sourceOptions.all}</SelectItem>
                              {resolvedSources.includes("haraj") ? (
                                <SelectItem value="haraj">{t.filters.sourceOptions.haraj}</SelectItem>
                              ) : null}
                              {resolvedSources.includes("yallamotor") ? (
                                <SelectItem value="yallamotor">{t.filters.sourceOptions.yallamotor}</SelectItem>
                              ) : null}
                              {resolvedSources.includes("syarah") ? (
                                <SelectItem value="syarah">{t.filters.sourceOptions.syarah}</SelectItem>
                              ) : null}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div
                    className={`mt-[1px] grid gap-[1px] bg-slate-200/70 md:grid-cols-2 ${
                      enableMileageFilter ? "lg:grid-cols-10" : "lg:grid-cols-5"
                    }`}
                  >
                    <div className="bg-white/95 px-2 py-2 lg:col-span-4">
                      <div
                        className={`grid gap-[1px] rounded-xl bg-slate-200/70 p-[1px] sm:grid-cols-2 ${
                          enableMileageFilter ? "lg:grid-cols-4" : "lg:grid-cols-3"
                        }`}
                      >
                        <button
                          type="button"
                          aria-pressed={filters.hasImage === "true"}
                          onClick={() =>
                            updateFilters({ hasImage: filters.hasImage === "true" ? "any" : "true" })
                          }
                          className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-[11px] border px-3 text-xs uppercase tracking-[0.24em] transition ${
                            filters.hasImage === "true"
                              ? "border-emerald-700 bg-emerald-600 text-white shadow-sm"
                              : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          <span
                            className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border ${
                              filters.hasImage === "true"
                                ? "border-white bg-white/20"
                                : "border-emerald-600 bg-white"
                            }`}
                          >
                            {filters.hasImage === "true" ? <Check className="h-3 w-3" /> : null}
                          </span>
                          <span>{t.filters.hasImages}</span>
                        </button>
                        <button
                          type="button"
                          aria-pressed={filters.hasPrice === "true"}
                          onClick={() =>
                            updateFilters({ hasPrice: filters.hasPrice === "true" ? "any" : "true" })
                          }
                          className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-[11px] border px-3 text-xs uppercase tracking-[0.24em] transition ${
                            filters.hasPrice === "true"
                              ? "border-emerald-700 bg-emerald-600 text-white shadow-sm"
                              : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          <span
                            className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border ${
                              filters.hasPrice === "true"
                                ? "border-white bg-white/20"
                                : "border-emerald-600 bg-white"
                            }`}
                          >
                            {filters.hasPrice === "true" ? <Check className="h-3 w-3" /> : null}
                          </span>
                          <span>{t.filters.hasPrice}</span>
                        </button>
                        <button
                          type="button"
                          aria-pressed={filters.hasComments === "true"}
                          onClick={() =>
                            updateFilters({ hasComments: filters.hasComments === "true" ? "any" : "true" })
                          }
                          className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-[11px] border px-3 text-xs uppercase tracking-[0.24em] transition ${
                            filters.hasComments === "true"
                              ? "border-emerald-700 bg-emerald-600 text-white shadow-sm"
                              : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          <span
                            className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border ${
                              filters.hasComments === "true"
                                ? "border-white bg-white/20"
                                : "border-emerald-600 bg-white"
                            }`}
                          >
                            {filters.hasComments === "true" ? <Check className="h-3 w-3" /> : null}
                          </span>
                          <span>{t.filters.hasComments}</span>
                        </button>
                        {enableMileageFilter ? (
                          <button
                            type="button"
                            aria-pressed={filters.hasMileage === "true"}
                            onClick={() =>
                              updateFilters({ hasMileage: filters.hasMileage === "true" ? "any" : "true" })
                            }
                            className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-[11px] border px-3 text-xs uppercase tracking-[0.24em] transition ${
                              filters.hasMileage === "true"
                                ? "border-emerald-700 bg-emerald-600 text-white shadow-sm"
                                : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            <span
                              className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border ${
                                filters.hasMileage === "true"
                                  ? "border-white bg-white/20"
                                  : "border-emerald-600 bg-white"
                              }`}
                            >
                              {filters.hasMileage === "true" ? <Check className="h-3 w-3" /> : null}
                            </span>
                            <span>{t.filters.hasMileage}</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {enableMileageFilter ? (
                      <div className="flex items-center gap-2 bg-white/95 px-3 py-2 lg:col-span-4">
                        <Label className={mileageFilterLabelClass}>
                          {mileageLabel}
                        </Label>
                        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={filters.mileageMin}
                            onChange={(event) => updateFilters({ mileageMin: event.target.value })}
                            placeholder={mileageMinPlaceholder}
                            className="h-9 w-full text-sm"
                          />
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={filters.mileageMax}
                            onChange={(event) => updateFilters({ mileageMax: event.target.value })}
                            placeholder={mileageMaxPlaceholder}
                            className="h-9 w-full text-sm"
                          />
                        </div>
                      </div>
                    ) : null}
                    <div
                      className={`flex items-center gap-2 bg-white/95 px-3 py-2 ${
                        enableMileageFilter ? "lg:col-span-2" : ""
                      }`}
                    >
                      <Label className={filterLabelClass}>
                        {t.filters.sortBy}
                      </Label>
                      <div className="flex-1">
                        <Select
                          value={filters.sort}
                          onValueChange={(value) => updateFilters({ sort: value })}
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder={t.filters.sortOptions.newest} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="newest">{t.filters.sortOptions.newest}</SelectItem>
                            <SelectItem value="oldest">{t.filters.sortOptions.oldest}</SelectItem>
                            <SelectItem value="price-high">{t.filters.sortOptions.priceHigh}</SelectItem>
                            <SelectItem value="price-low">{t.filters.sortOptions.priceLow}</SelectItem>
                            <SelectItem value="comments">{t.filters.sortOptions.comments}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  {requireSearchClickToApplyFilters ? (
                    <div className="mt-3 flex flex-wrap justify-end gap-2 bg-white/95 px-3 py-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 border-slate-300 px-5 text-xs uppercase tracking-[0.18em]"
                        onClick={resetFilters}
                      >
                        Reset
                      </Button>
                      <Button
                        type="button"
                        className="h-9 bg-emerald-600 px-5 text-xs uppercase tracking-[0.18em] text-white hover:bg-emerald-700"
                        onClick={applyFilters}
                      >
                        {t.filters.search}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-slate-200 bg-white/95 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-900 text-white px-3 py-2 text-xs uppercase tracking-[0.25em]">
                    {t.table.badge}
                  </div>
                  <p className="text-sm text-slate-500">
                    {showingSummary}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={String(limit)}
                    onValueChange={(value) => {
                      setLimit(Number(value));
                      setPage(1);
                    }}
                  >
                  <SelectTrigger className="h-9 w-[120px] text-xs">
                      <SelectValue placeholder={t.table.rows} />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="15">{t.table.rowsLabel(15)}</SelectItem>
                      <SelectItem value="25">{t.table.rowsLabel(25)}</SelectItem>
                      <SelectItem value="50">{t.table.rowsLabel(50)}</SelectItem>
                      <SelectItem value="100">{t.table.rowsLabel(100)}</SelectItem>
                  </SelectContent>
                </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 border-emerald-200 px-3 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                    onClick={exportCurrentRows}
                    disabled={items.length === 0}
                    title={isArabic ? "تصدير" : "Export"}
                    aria-label={isArabic ? "تصدير" : "Export"}
                  >
                    <Image
                      src="/excelicon.png"
                      alt=""
                      width={18}
                      height={18}
                      className="h-[18px] w-[18px] object-contain"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold uppercase tracking-[0.08em]">
                      {isArabic ? "تصدير" : "Export"}
                    </span>
                  </Button>
              </div>
            </div>

              <div className="px-6 py-4">
                {status === "error" ? (
                  <div className="text-sm text-rose-500">
                    {registrationRequiredMessage ?? t.status.error}
                  </div>
                ) : items.length === 0 ? (
                  status === "loading" ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.status.loading}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">{t.status.noRecords}</div>
                  )
                ) : (
                  <>
                    {status === "loading" ? (
                      <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {t.status.loading}
                      </div>
                    ) : null}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className={`text-[12px] font-extrabold uppercase tracking-[0.2em] ${isArabic ? "!text-right" : ""}`}>
                            {t.table.title}
                          </TableHead>
                          <TableHead className={`text-[12px] font-extrabold uppercase tracking-[0.2em] ${isArabic ? "!text-right" : ""}`}>
                            {t.table.brand}
                          </TableHead>
                          <TableHead className={`text-[12px] font-extrabold uppercase tracking-[0.2em] ${isArabic ? "!text-right" : ""}`}>
                            {t.table.model}
                          </TableHead>
                          <TableHead className={`text-[12px] font-extrabold uppercase tracking-[0.2em] ${isArabic ? "!text-right" : ""}`}>
                            {t.table.manufactureYear}
                          </TableHead>
                          <TableHead className={`text-[12px] font-extrabold uppercase tracking-[0.2em] ${isArabic ? "!text-right" : ""}`}>
                            {mileageLabel}
                          </TableHead>
                          <TableHead className={`text-[12px] font-extrabold uppercase tracking-[0.2em] ${isArabic ? "!text-right" : ""}`}>
                            {t.table.price}
                          </TableHead>
                          <TableHead className={`text-[12px] font-extrabold uppercase tracking-[0.2em] ${isArabic ? "!text-right" : ""}`}>
                            <button
                              type="button"
                              onClick={toggleDateSort}
                              className={`inline-flex items-center gap-1 transition-colors hover:text-emerald-700 ${
                                isArabic ? "w-full justify-end" : ""
                              }`}
                              aria-label={
                                activeDateSort === "newest"
                                  ? `${t.table.date}: ${t.filters.sortOptions.newest}`
                                  : `${t.table.date}: ${t.filters.sortOptions.oldest}`
                              }
                              title={
                                activeDateSort === "newest"
                                  ? t.filters.sortOptions.newest
                                  : t.filters.sortOptions.oldest
                              }
                            >
                              <span>{t.table.date}</span>
                              {activeDateSort === "newest" ? (
                                <ArrowDown className="h-3.5 w-3.5" />
                              ) : (
                                <ArrowUp className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </TableHead>
                          <TableHead className={`text-[12px] font-extrabold uppercase tracking-[0.2em] ${isArabic ? "!text-right" : ""}`}>
                            {t.table.images}
                          </TableHead>
                          <TableHead className={`text-[12px] font-extrabold uppercase tracking-[0.2em] ${isArabic ? "!text-right" : ""}`}>
                            {t.table.comments}
                          </TableHead>
                          <TableHead className={`text-[12px] font-extrabold uppercase tracking-[0.2em] ${isArabic ? "!text-right" : ""}`}>
                            {t.table.actions}
                          </TableHead>
                          <TableHead className={`text-[12px] font-extrabold uppercase tracking-[0.2em] ${isArabic ? "!text-right" : ""}`}>
                            {t.filters.source}
                          </TableHead>
                          <TableHead className={`text-[12px] font-extrabold uppercase tracking-[0.2em] ${isArabic ? "!text-right" : ""}`}>
                            {sourceLinkLabel}
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => {
                          const sourceName = getSourceDisplayName(item.source);
                          const sourceUrl = resolveSourceUrl(item);

                          return (
                            <TableRow key={`${item.source}-${item.id}`}>
                            <TableCell className="text-sm font-medium text-slate-900">
                              <div className="space-y-1">
                                <button
                                  type="button"
                                  onClick={() => openDetails(item)}
                                  className="group inline-flex max-w-[280px] items-start rounded-md px-1 py-0.5 text-left rtl:text-right text-slate-900 transition-all hover:bg-emerald-50/70 hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white group-hover:scale-[1.02]"
                                >
                                  <span className="line-clamp-2 underline decoration-transparent decoration-2 underline-offset-4 transition-colors group-hover:decoration-emerald-300">
                                    {item.title}
                                  </span>
                                </button>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">{item.tags?.[1] || "-"}</TableCell>
                            <TableCell className="text-sm text-slate-600">{item.tags?.[2] || "-"}</TableCell>
                            <TableCell className="text-sm text-slate-600">{item.carModelYear ?? "-"}</TableCell>
                            <TableCell className="text-sm text-slate-600">{formatMileage(item.mileage, true)}</TableCell>
                            <TableCell
                              className={`text-sm ${
                                item.priceNumeric || item.priceFormatted
                                  ? "font-semibold text-amber-600"
                                  : "text-slate-600"
                              }`}
                            >
                              {formatPrice(item.priceNumeric, item.priceFormatted)}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">{formatEpoch(item.postDate)}</TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {item.imagesCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => openImages(item)}
                                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                                >
                                  <ImageIcon className="h-3 w-3" />
                                  {t.table.viewImages(item.imagesCount)}
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-400">
                                  <ImageIcon className="h-3 w-3" />
                                  {t.table.noImages}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {item.source === "yallamotor" ? (
                                <button
                                  type="button"
                                  onClick={() => openComments(item)}
                                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                                >
                                  {t.modals.priceCompareTitle}
                                </button>
                              ) : item.commentsCount > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => openComments(item)}
                                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                                >
                                  {t.table.commentsCount(item.commentsCount)}
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-400">
                                  {t.table.noComments}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                className="h-8 gap-2 bg-slate-900 text-white hover:bg-slate-800"
                                onClick={() => openDetails(item)}
                              >
                                <Eye className="h-4 w-4" />
                                {t.table.seeMore}
                              </Button>
                            </TableCell>
                            <TableCell className="text-[11px] text-slate-600">{sourceName}</TableCell>
                            <TableCell className="text-[11px] text-slate-600">
                              {sourceUrl ? (
                                <a
                                  href={sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() =>
                                    trackAction({
                                      actionType: "open_source_link",
                                      actionDetails: {
                                        itemId: item.id,
                                        source: item.source,
                                        url: sourceUrl,
                                      },
                                    })
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] text-emerald-700 underline decoration-emerald-300 underline-offset-2 transition hover:text-emerald-800 hover:decoration-emerald-500"
                                >
                                  <span aria-hidden="true" className="text-[12px] leading-none">↗</span>
                                  {t.table.openSource}
                                </a>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-6 py-4 text-xs text-slate-500">
                <div>
                  {showingPageSummary}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
                    {t.table.previous}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!hasNextPage}
                    onClick={() =>
                      setPage((prev) =>
                        hasKnownTotal ? Math.min(prev + 1, totalPages ?? prev + 1) : prev + 1
                      )
                    }
                  >
                    {t.table.next}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Dialog open={imagesOpen} onOpenChange={setImagesOpen}>
          <DialogContent className="max-w-3xl border border-slate-200 bg-white/95 p-0">
            <DialogHeader
              className={`border-b border-slate-200 px-6 py-4 ${isArabic ? "pr-14 text-right" : ""}`}
            >
              <DialogTitle
                className={`text-2xl font-semibold ${sora.className} ${isArabic ? "text-right" : ""}`}
              >
                {t.modals.imagesTitle}
              </DialogTitle>
              <p className={`text-sm text-slate-500 ${isArabic ? "text-right" : ""}`}>
                {t.modals.imagesSubtitle}
              </p>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 p-6">
                {modalStatus === "loading" ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.modals.loadingImages}
                  </div>
                ) : modalStatus === "error" ? (
                  <p className="text-sm text-rose-500">{t.modals.unableImages}</p>
                ) : modalImages.length === 0 ? (
                  <p className="text-sm text-slate-500">{t.modals.noImages}</p>
                ) : (
                  modalImages.map((src, index) => (
                    <div key={`${src}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <img src={src} alt="Listing" className="w-full object-cover" loading="lazy" />
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
          <DialogContent className="max-w-3xl border border-slate-200 bg-white/95 p-0">
            <DialogHeader
              className={`border-b border-slate-200 px-6 py-4 ${isArabic ? "pr-14 text-right" : ""}`}
            >
              <DialogTitle
                className={`text-2xl font-semibold ${sora.className} ${isArabic ? "text-right" : ""}`}
              >
                {t.modals.commentsTitle}
              </DialogTitle>
              <p className={`text-sm text-slate-500 ${isArabic ? "text-right" : ""}`}>
                {t.modals.commentsSubtitle}
              </p>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 p-6">
                {modalStatus === "loading" ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.modals.loadingComments}
                  </div>
                ) : modalStatus === "error" ? (
                  <p className="text-sm text-rose-500">{t.modals.unableComments}</p>
                ) : commentsMode === "priceCompare" ? (
                  <div className="space-y-3">
                    {[
                      { label: t.table.priceCompareLabel.min, value: modalPriceCompare?.min ?? "-" },
                      { label: t.table.priceCompareLabel.max, value: modalPriceCompare?.max ?? "-" },
                      { label: t.table.priceCompareLabel.current, value: modalPriceCompare?.current ?? "-" },
                    ].map((entry) => (
                      <div
                        key={entry.label}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                      >
                        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{entry.label}</span>
                        <span className="font-medium">{String(entry.value)}</span>
                      </div>
                    ))}
                  </div>
                ) : modalComments.length === 0 ? (
                  <p className="text-sm text-slate-500">{t.modals.noComments}</p>
                ) : (
                  modalComments.map((comment, index) => (
                    <div key={`${comment.id ?? index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                      <p className="text-xs text-slate-400">{comment.authorUsername ?? t.modals.anonymous}</p>
                      <p className="mt-2 whitespace-pre-line">{comment.body ?? "-"}</p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="w-[98vw] max-w-[98vw] border border-slate-200 bg-white/95 p-0 sm:w-[96vw] sm:max-w-[1600px]">
            <DialogHeader className="border-b border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <DialogTitle className={`text-2xl font-semibold ${sora.className}`}>{t.modals.detailTitle}</DialogTitle>
                {normalizedDetailTags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {normalizedDetailTags.map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-900/10 px-3 py-1 text-[11px] text-slate-700">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </DialogHeader>
            <ScrollArea className="max-h-[80vh]">
              <div className="grid gap-3 px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-2 grid-cols-1 lg:grid-cols-[minmax(0,30%)_minmax(0,70%)]">
                <div className="min-w-0 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{t.modals.notes}</p>
                    <p className="mt-3 text-sm text-slate-600 whitespace-pre-line">
                      {detailNotes}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-3 shadow-lg">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{t.modals.imagesSection}</p>
                    <div className="mt-4 max-h-[45vh] space-y-3 overflow-y-auto pr-2">
                      {detailImages.length === 0 ? (
                        <span className="text-xs text-slate-500">{t.modals.noImages}</span>
                      ) : (
                        detailImages.map((src, index) => (
                          <div
                            key={`${src}-${index}`}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                          >
                            <img src={src} alt="Listing" className="w-full object-cover" loading="lazy" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="min-w-0 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{t.modals.summary}</p>
                    {detailStatus === "loading" ? (
                      <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.modals.loadingDetails}
                      </div>
                    ) : detailStatus === "error" ? (
                      <p className="mt-3 text-sm text-rose-500">{t.modals.unableDetails}</p>
                    ) : detail ? (
                      <div className="mt-4">
                        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                          {summaryItems.map((item, index) => (
                            <div
                              key={`${item.label}-${index}`}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1"
                            >
                              <span className="text-xs text-slate-400">{item.label}</span>
                              {typeof item.href === "string" && item.href ? (
                                <a
                                  href={item.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() =>
                                    trackAction({
                                      actionType: "open_source_link",
                                      actionDetails: {
                                        source: detailSource,
                                        itemId: String(detail?.id ?? detail?._id ?? ""),
                                        context: "details_summary",
                                        url: item.href,
                                      },
                                    })
                                  }
                                  className="inline-flex items-center gap-1 font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-2 transition hover:text-emerald-800 hover:decoration-emerald-500"
                                >
                                  <span aria-hidden="true" className="text-[12px] leading-none">↗</span>
                                  {item.value}
                                </a>
                              ) : (
                                <span className="font-medium text-slate-900">{item.value}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {isYallaDetail && priceCompareEntries.length > 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{t.modals.priceCompareTitle}</p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        {priceCompareEntries.map((entry) => (
                          <div
                            key={entry.label}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                          >
                            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{entry.label}</span>
                            <span className="font-medium">{String(entry.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {carInfo ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{t.carInfo.title}</p>
                      {carInfoGridEntries.length === 0 ? (
                        <p className="mt-3 text-xs text-slate-500">{t.carInfo.empty}</p>
                      ) : (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                          {carInfoGridEntries.map((entry) => (
                            <div
                              key={entry.key}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                            >
                              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                {entry.label}
                              </span>
                              <span className="font-medium">{String(entry.value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {isYallaDetail && normalizedFeatures.length > 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{t.modals.featuresTitle}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {normalizedFeatures.map((feature) => (
                          <span
                            key={feature}
                            className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {!isYallaDetail ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{t.modals.commentsSection}</p>
                      <div className="mt-3 space-y-3">
                        {detailComments.length === 0 ? (
                          <span className="text-xs text-slate-500">{t.modals.noComments}</span>
                        ) : (
                          detailComments.slice(0, 6).map((comment, index) => (
                            <div
                              key={`${comment.id ?? index}`}
                              className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600"
                            >
                              <p className="text-xs text-slate-400">{comment.authorUsername ?? t.modals.anonymous}</p>
                              <p className="mt-1 whitespace-pre-line">{comment.body ?? "-"}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </main>
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        initialMode={authModalMode}
      />
      <Footer />
    </div>
  );
}

