
"use client";

import {
  useCallback,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import ValueTechServiceNavbar from "@/components/value-tech-service-navbar";
import ValueTechServiceFooter from "@/components/value-tech-service-footer";
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

type SearchSuggestionsResponse = {
  items: string[];
};

type EvaluationSourcePageProps = {
  tag0?: string;
  excludeTag1Values?: string[];
  enableBrandFilter?: boolean;
  enableModelFilter?: boolean;
  enableModelYearFilter?: boolean;
  enableMileageFilter?: boolean;
  dataSources?: Array<"haraj" | "yallamotor" | "syarah">;
  progressiveAdvancedFilters?: boolean;
  requireSearchClickToApplyFilters?: boolean;
};

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

type FilterState = typeof defaultFilters;

function buildNextFiltersState(current: FilterState, updates: Partial<FilterState>): FilterState {
  const next = { ...current, ...updates };
  if ("brand" in updates && updates.brand !== current.brand) {
    next.model = "";
  }
  return next;
}

function hasFilterStateChanged(current: FilterState, next: FilterState) {
  return (Object.keys(defaultFilters) as Array<keyof FilterState>).some(
    (key) => current[key] !== next[key]
  );
}

const SEARCH_HISTORY_STORAGE_KEY = "evaluation-source-search-history";
const SEARCH_HISTORY_MAX_ITEMS = 10;
const LIST_RESPONSE_CACHE_MAX_ITEMS = 120;
const SEARCH_SUGGESTIONS_MAX_ITEMS = 12;
const SEARCH_SUGGESTIONS_MIN_CHARS = 1;
const SEARCH_SUGGESTIONS_REMOTE_MIN_CHARS = 2;
const SEARCH_SUGGESTIONS_DEBOUNCE_MS = 90;
const SEARCH_SUGGESTIONS_CACHE_MAX_ITEMS = 120;
const OPTION_POOL_PAGE_SIZE = 200;
const OPTION_POOL_MAX_PAGES = 12;
const OPTION_POOL_MAX_ITEMS = 2400;
const OPTION_POOL_STORAGE_KEY_PREFIX = "evaluation-source-option-pool";
const OPTION_POOL_STORAGE_VERSION = 1;
const OPTION_POOL_STORAGE_TTL_MS = 12 * 60 * 60 * 1000;

type OptionPoolCacheItem = Pick<
  EvaluationSourceItem,
  "id" | "source" | "tags" | "carModelYear" | "mileage"
>;

type OptionPoolCachePayload = {
  version: number;
  updatedAt: number;
  items: OptionPoolCacheItem[];
  modelYears?: string[];
};

function toOptionPoolCacheItem(item: EvaluationSourceItem): OptionPoolCacheItem {
  const normalizedId =
    typeof item.id === "string" ? item.id.trim() : String(item.id ?? "").trim();
  const normalizedTags = Array.isArray(item.tags)
    ? item.tags
        .map((tag) => (typeof tag === "string" ? tag.trim() : String(tag ?? "").trim()))
        .filter(Boolean)
    : [];

  return {
    id: normalizedId || getEvaluationItemIdentity(item),
    source: item.source ?? "haraj",
    tags: normalizedTags,
    carModelYear:
      typeof item.carModelYear === "number" && Number.isFinite(item.carModelYear)
        ? item.carModelYear
        : null,
    mileage:
      typeof item.mileage === "number" && Number.isFinite(item.mileage)
        ? item.mileage
        : null,
  };
}

function toOptionPoolStateItem(item: OptionPoolCacheItem): EvaluationSourceItem {
  return {
    id: item.id,
    title: "Untitled",
    city: "",
    postDate: null,
    priceNumeric: null,
    priceFormatted: null,
    hasImage: false,
    imagesCount: 0,
    commentsCount: 0,
    tags: Array.isArray(item.tags) ? item.tags : [],
    carModelYear:
      typeof item.carModelYear === "number" && Number.isFinite(item.carModelYear)
        ? item.carModelYear
        : null,
    mileage:
      typeof item.mileage === "number" && Number.isFinite(item.mileage)
        ? item.mileage
        : null,
    phone: "",
    url: "",
    source: item.source ?? "haraj",
    priceCompare: null,
  };
}

function buildOptionPoolStorageKey({
  tag0,
  sources,
  excludeTag1Values,
}: {
  tag0?: string;
  sources: Array<"haraj" | "yallamotor" | "syarah">;
  excludeTag1Values?: string[];
}) {
  const normalizedTag0 = (tag0 ?? "").trim().toLowerCase();
  const normalizedSources = [...sources]
    .map((source) => source.trim().toLowerCase())
    .sort()
    .join(",");
  const normalizedExcluded = (excludeTag1Values ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(",");

  return `${OPTION_POOL_STORAGE_KEY_PREFIX}:${normalizedTag0}:${normalizedSources}:${normalizedExcluded}`;
}

function parseOptionPoolCachePayload(raw: string): OptionPoolCachePayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<OptionPoolCachePayload>;
    if (
      !parsed ||
      parsed.version !== OPTION_POOL_STORAGE_VERSION ||
      typeof parsed.updatedAt !== "number" ||
      !Array.isArray(parsed.items)
    ) {
      return null;
    }

    const items: OptionPoolCacheItem[] = parsed.items
      .filter(
        (item): item is OptionPoolCacheItem =>
          Boolean(item) &&
          typeof item.id === "string" &&
          (item.source === "haraj" || item.source === "yallamotor" || item.source === "syarah")
      )
      .slice(0, OPTION_POOL_MAX_ITEMS)
      .map((item) => ({
        id: item.id.trim(),
        source: item.source,
        tags: Array.isArray(item.tags)
          ? item.tags
              .map((tag) => (typeof tag === "string" ? tag.trim() : String(tag ?? "").trim()))
              .filter(Boolean)
          : [],
        carModelYear:
          typeof item.carModelYear === "number" && Number.isFinite(item.carModelYear)
            ? item.carModelYear
            : null,
        mileage:
          typeof item.mileage === "number" && Number.isFinite(item.mileage)
            ? item.mileage
            : null,
      }));

    const modelYears = Array.isArray(parsed.modelYears)
      ? parsed.modelYears
          .filter((year): year is string => typeof year === "string")
          .map((year) => year.trim())
          .filter(Boolean)
      : undefined;

    return {
      version: OPTION_POOL_STORAGE_VERSION,
      updatedAt: parsed.updatedAt,
      items,
      modelYears,
    };
  } catch {
    return null;
  }
}

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

function setCachedSearchSuggestions(
  cache: Map<string, string[]>,
  cacheKey: string,
  value: string[]
) {
  cache.set(cacheKey, value);
  while (cache.size > SEARCH_SUGGESTIONS_CACHE_MAX_ITEMS) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cache.delete(oldestKey);
  }
}

function getEvaluationItemIdentity(item: EvaluationSourceItem, fallbackIndex = 0) {
  const source = item.source ?? "haraj";
  const normalizedId =
    typeof item.id === "string" ? item.id.trim() : String(item.id ?? "").trim();
  if (normalizedId) {
    return `${source}-${normalizedId}`;
  }

  const normalizedUrl =
    typeof item.url === "string" ? item.url.trim() : String(item.url ?? "").trim();
  if (normalizedUrl) {
    return `${source}-url:${normalizedUrl}`;
  }

  const normalizedTitle =
    typeof item.title === "string" ? item.title.trim() : String(item.title ?? "").trim();
  return `${source}-fallback:${normalizedTitle}|${item.postDate ?? ""}|${fallbackIndex}`;
}

function dedupeEvaluationItems(items: EvaluationSourceItem[]) {
  if (items.length === 0) return items;

  const seen = new Set<string>();
  const deduped: EvaluationSourceItem[] = [];

  items.forEach((item, index) => {
    const identity = getEvaluationItemIdentity(item, index);
    if (seen.has(identity)) return;
    seen.add(identity);
    deduped.push(item);
  });

  return deduped;
}

function normalizeListResponse(response: ListResponse): ListResponse {
  return {
    ...response,
    items: dedupeEvaluationItems(response.items ?? []),
  };
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
      searchPlaceholder: "Search everything: title, brand, model, city, year, mileage, price...",
      advancedSearch: "Advanced search",
      hideAdvancedSearch: "Hide advanced search",
      clearHistory: "Clear",
      city: "City",
      cityPlaceholder: "Search city",
      brand: "Brand",
      brandPlaceholder: "Type or select brand",
      model: "Model",
      modelPlaceholder: "Type or select model",
      manufactureYear: " Year",
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
      searchPlaceholder: "ابحث في كل شيء: العنوان، الماركة، الطراز، المدينة، السنة، العداد، السعر...",
      advancedSearch: "بحث متقدم",
      hideAdvancedSearch: "إخفاء البحث المتقدم",
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
  const numericValue = getPriceNumber(value, formatted);
  if (numericValue === null) return "-";
  return String(numericValue);
}

function formatMileage(value: number | null, withUnit = false) {
  if (value === null || value === undefined) return "-";
  const base = new Intl.NumberFormat("en-US").format(value);
  return withUnit ? `${base} km` : base;
}

function getPriceNumber(value: number | null, formatted?: string | null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (!formatted) return null;

  const normalized = formatted.replace(/[\u0660-\u0669]/g, (digit) =>
    String(digit.charCodeAt(0) - 0x0660)
  );
  const match = normalized.match(/[0-9][0-9,.]*/);
  if (!match) return null;

  const parsed = Number(match[0].replace(/,/g, ""));
  return Number.isNaN(parsed) ? null : parsed;
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
    .replace(/([\u0600-\u06FF])\u0648(?=\u0627\u0644)/g, "$1 \u0648")
    .replace(/([\u0600-\u06FF])\u0641(?=\u0627\u0644)/g, "$1 \u0641")
    .replace(/([\u0600-\u06FF])\u0628(?=\u0627\u0644)/g, "$1 \u0628")
    .replace(/([\u0600-\u06FF])\u0644(?=\u0627\u0644)/g, "$1 \u0644")
    .replace(/([\u0600-\u06FF])(\u0627\u0644)/g, "$1 $2")
    .replace(/\u0629(?=[\u0600-\u06FF])/g, "\u0629 ");

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
const DROPDOWN_INITIAL_VISIBLE_OPTIONS = 80;
const DROPDOWN_LOAD_MORE_STEP = 120;
const DROPDOWN_EMPTY_QUERY_VISIBLE_OPTIONS = 120;

type IndexedVehicleOption = {
  label: string;
  lowered: string;
  canonical: string;
};
const EMPTY_STRING_OPTIONS: string[] = [];
const EMPTY_INDEXED_VEHICLE_OPTIONS: IndexedVehicleOption[] = [];

function buildContinuousYearOptions(values: string[]) {
  const currentYear = new Date().getFullYear();
  const uniqueSortedYears = sortYearOptionsDescending(
    Array.from(
      new Set(
        values
          .map((value) => Number.parseInt(value, 10))
          .filter((year) => Number.isFinite(year))
          .filter((year) => year <= currentYear)
          .map((year) => String(year))
      )
    )
  );
  if (!uniqueSortedYears.includes(String(currentYear))) {
    uniqueSortedYears.unshift(String(currentYear));
  }

  if (uniqueSortedYears.length === 0) {
    return [String(currentYear)];
  }

  const newestYear = currentYear;
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

function buildIndexedVehicleOptions(options: string[]): IndexedVehicleOption[] {
  return options.map((option) => {
    const label = option.trim();
    return {
      label,
      lowered: label.toLowerCase(),
      canonical: toVehicleCanonicalKey(label),
    };
  });
}

function filterVehicleOptionsByInput(options: IndexedVehicleOption[], input: string) {
  const query = input.trim();
  if (!query) return options.map((option) => option.label);

  const canonicalQuery = toVehicleCanonicalKey(query);
  const loweredQuery = query.toLowerCase();
  const shouldUseFuzzyMatch = query.length >= 3;

  return options.filter((option) => {
    if (option.lowered.includes(loweredQuery)) {
      return true;
    }

    if (canonicalQuery && option.canonical.includes(canonicalQuery)) {
      return true;
    }

    if (!shouldUseFuzzyMatch) {
      return false;
    }

    return isVehicleTextMatch(option.label, query);
  }).map((option) => option.label);
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
  progressiveAdvancedFilters = false,
  requireSearchClickToApplyFilters = false,
}: EvaluationSourcePageProps) {
  const langContext = useContext(LanguageContext);
  const { trackAction } = useAuthTracking();
  const language = langContext?.language ?? "ar";
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
  const showMoreOptionsLabel = isArabic ? "\u0625\u0638\u0647\u0627\u0631 \u0627\u0644\u0645\u0632\u064A\u062F" : "Show more";
  const loadingSuggestionsLabel = isArabic ? "\u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0627\u0642\u062A\u0631\u0627\u062D\u0627\u062A..." : "Loading suggestions...";
  const noSuggestionsLabel = isArabic ? "\u0644\u0627 \u062A\u0648\u062C\u062F \u0627\u0642\u062A\u0631\u0627\u062D\u0627\u062A" : "No suggestions found";
  const localSuggestionLabel = isArabic ? "\u0645\u062D\u0644\u064A" : "Local";
  const liveSuggestionLabel = isArabic ? "\u0645\u0628\u0627\u0634\u0631" : "Live";
  const historySuggestionLabel = isArabic ? "\u0627\u0644\u0633\u062C\u0644" : "History";
  const openBrandOptionsLabel = isArabic ? "\u0639\u0631\u0636 \u062E\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u0627\u0631\u0643\u0629" : "Show brand options";
  const openModelOptionsLabel = isArabic ? "\u0639\u0631\u0636 \u062E\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0637\u0631\u0627\u0632" : "Show model options";
  const openModelYearOptionsLabel = isArabic ? "\u0639\u0631\u0636 \u062E\u064A\u0627\u0631\u0627\u062A \u0633\u0646\u0629 \u0627\u0644\u0635\u0646\u0639" : "Show manufacture year options";
  const activeFiltersLabel = isArabic ? "\u0627\u0644\u0641\u0644\u0627\u062A\u0631 \u0627\u0644\u0646\u0634\u0637\u0629" : "Active filters";
  const pendingApplyLabel = isArabic ? "\u0628\u0627\u0646\u062A\u0638\u0627\u0631 \u062A\u0637\u0628\u064A\u0642" : "Pending apply";
  const readyLabel = isArabic ? "\u062C\u0627\u0647\u0632" : "Ready";
  const resetFiltersLabel = isArabic ? "\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0636\u0628\u0637" : "Reset";
  const advancedSearchLabel = t.filters.advancedSearch;
  const filterLabelClass =
    "shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.16em] text-slate-500";
  const mileageFilterLabelClass =
    "shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.16em] text-slate-500";
  const filterFieldContainerClass = progressiveAdvancedFilters
    ? "flex items-center gap-1.5 px-0 py-0"
    : "flex h-full flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-white px-2.5 py-2.5 shadow-[0_8px_18px_rgba(15,23,42,0.05)] transition-colors hover:border-emerald-200";
  const searchableFilterInputClass = progressiveAdvancedFilters
    ? "h-8 w-full min-w-0 rounded-md border-slate-200 bg-white pr-8 text-xs transition-colors focus-visible:border-emerald-300 focus-visible:ring-emerald-400/30"
    : "h-9 w-full min-w-0 rounded-lg border-slate-200 bg-slate-50/70 pr-9 text-sm transition-colors focus-visible:border-emerald-300 focus-visible:bg-white focus-visible:ring-emerald-400/30";
  const searchableFilterInputWithLeadingIconClass = progressiveAdvancedFilters
    ? "h-8 w-full min-w-0 rounded-md border-slate-200 bg-white pl-7 pr-8 text-xs transition-colors focus-visible:border-emerald-300 focus-visible:ring-emerald-400/30"
    : "h-9 w-full min-w-0 rounded-lg border-slate-200 bg-slate-50/70 pl-8 pr-9 text-sm transition-colors focus-visible:border-emerald-300 focus-visible:bg-white focus-visible:ring-emerald-400/30";
  const filterSelectTriggerClass = progressiveAdvancedFilters
    ? "h-8 w-full min-w-0 rounded-md border-slate-200 bg-white text-xs transition-colors focus:ring-emerald-400/30"
    : "h-9 w-full min-w-0 rounded-lg border-slate-200 bg-slate-50/70 text-sm transition-colors focus:ring-emerald-400/30";
  const searchableDropdownClass =
    "absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-y-auto overscroll-contain rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-[0_16px_34px_rgba(15,23,42,0.14)] backdrop-blur";
  const searchableDropdownOptionClass = `block w-full rounded-md px-3 py-2 text-sm transition hover:bg-slate-100 ${
    isArabic ? "text-right" : "text-left"
  }`;
  const getSourceDisplayName = useCallback((source: EvaluationSourceItem["source"]) => {
    if (source === "yallamotor") return t.filters.sourceOptions.yallamotor;
    if (source === "syarah") return t.filters.sourceOptions.syarah;
    return t.filters.sourceOptions.haraj;
  }, [t.filters.sourceOptions.haraj, t.filters.sourceOptions.syarah, t.filters.sourceOptions.yallamotor]);
  const mileageMinPlaceholder = "Min";
  const mileageMaxPlaceholder = "Max";
  const resolvedSources = useMemo<Array<"haraj" | "yallamotor" | "syarah">>(
    () => (dataSources?.length ? dataSources : ["haraj"]),
    [dataSources]
  );
  const optionPoolStorageKey = useMemo(
    () =>
      buildOptionPoolStorageKey({
        tag0,
        sources: resolvedSources,
        excludeTag1Values,
      }),
    [tag0, resolvedSources, excludeTag1Values]
  );
  const showSourceFilter = resolvedSources.length > 1;
  const useCombinedSources = resolvedSources.length > 1 || resolvedSources[0] !== "haraj";
  const hasAdvancedFilterControls =
    enableBrandFilter || enableModelFilter || enableModelYearFilter || enableMileageFilter || showSourceFilter;
  const listEndpoint = toApiUrl(
    useCombinedSources ? "/api/cars-sources" : "/api/haraj-scrape"
  );
  const suggestionsEndpoint = toApiUrl("/api/cars-sources/suggestions");
  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(!progressiveAdvancedFilters);
  const showAdvancedFilters = !progressiveAdvancedFilters || advancedFiltersOpen;
  const showSearchAuxControls = !progressiveAdvancedFilters || advancedFiltersOpen;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
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
  const [liveSearchSuggestions, setLiveSearchSuggestions] = useState<string[]>([]);
  const [liveSearchSuggestionsLoading, setLiveSearchSuggestionsLoading] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [searchSuggestionActiveIndex, setSearchSuggestionActiveIndex] = useState(-1);
  const [shouldLoadOptionPool, setShouldLoadOptionPool] = useState(false);
  const [shouldLoadModelYears, setShouldLoadModelYears] = useState(false);
  const [optionPoolLoaded, setOptionPoolLoaded] = useState(false);
  const [optionPoolLoading, setOptionPoolLoading] = useState(false);
  const [brandDropdownOpen, setBrandDropdownOpen] = useState(false);
  const [brandDropdownShowAll, setBrandDropdownShowAll] = useState(false);
  const [brandOptionsRenderLimit, setBrandOptionsRenderLimit] = useState(
    DROPDOWN_INITIAL_VISIBLE_OPTIONS
  );
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [modelDropdownShowAll, setModelDropdownShowAll] = useState(false);
  const [modelOptionsRenderLimit, setModelOptionsRenderLimit] = useState(
    DROPDOWN_INITIAL_VISIBLE_OPTIONS
  );
  const [modelYearDropdownOpen, setModelYearDropdownOpen] = useState(false);
  const [modelYearDropdownShowAll, setModelYearDropdownShowAll] = useState(false);
  const [modelYearOptionsRenderLimit, setModelYearOptionsRenderLimit] = useState(
    DROPDOWN_INITIAL_VISIBLE_OPTIONS
  );
  const [commentsMode, setCommentsMode] = useState<"comments" | "priceCompare">("comments");
  const [modalPriceCompare, setModalPriceCompare] =
    useState<EvaluationSourceItem["priceCompare"] | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">("register");
  const [registrationRequiredMessage, setRegistrationRequiredMessage] =
    useState<string | null>(null);
  const [, startFilterSelectionTransition] = useTransition();
  const listResponseCacheRef = useRef<Map<string, ListResponse>>(new Map());
  const searchSuggestionsCacheRef = useRef<Map<string, string[]>>(new Map());
  const searchDropdownRef = useRef<HTMLDivElement | null>(null);
  const brandDropdownRef = useRef<HTMLDivElement | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement | null>(null);
  const modelYearDropdownRef = useRef<HTMLDivElement | null>(null);
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search.trim()) count += 1;
    if (filters.match) count += 1;
    if (filters.brand.trim()) count += 1;
    if (filters.model.trim()) count += 1;
    if (filters.modelYear.trim()) count += 1;
    if (showSourceFilter && filters.source !== "all") count += 1;
    if (filters.hasImage !== "any") count += 1;
    if (filters.hasPrice !== "any") count += 1;
    if (filters.hasComments !== "any") count += 1;
    if (enableMileageFilter && filters.hasMileage !== "any") count += 1;
    if (enableMileageFilter && filters.mileageMin.trim()) count += 1;
    if (enableMileageFilter && filters.mileageMax.trim()) count += 1;
    if (filters.sort !== defaultFilters.sort) count += 1;
    return count;
  }, [filters, enableMileageFilter, showSourceFilter]);
  const hasPendingFilterChanges = useMemo(() => {
    if (!requireSearchClickToApplyFilters) return false;
    return (Object.keys(defaultFilters) as Array<keyof FilterState>).some(
      (key) => filters[key] !== appliedFilters[key]
    );
  }, [filters, appliedFilters, requireSearchClickToApplyFilters]);
  const hasAdvancedFilterSelections = useMemo(() => {
    const hasSelections = (state: FilterState) => {
      if (state.match) return true;
      if (state.brand.trim()) return true;
      if (state.model.trim()) return true;
      if (state.modelYear.trim()) return true;
      if (showSourceFilter && state.source !== "all") return true;
      if (state.hasImage !== "any") return true;
      if (state.hasPrice !== "any") return true;
      if (state.hasComments !== "any") return true;
      if (enableMileageFilter && state.hasMileage !== "any") return true;
      if (enableMileageFilter && state.mileageMin.trim()) return true;
      if (enableMileageFilter && state.mileageMax.trim()) return true;
      if (state.sort !== defaultFilters.sort) return true;
      return false;
    };

    return hasSelections(filters) || hasSelections(appliedFilters);
  }, [filters, appliedFilters, enableMileageFilter, showSourceFilter]);
  const deferredSearchValue = useDeferredValue(filters.search);
  const deferredBrandValue = useDeferredValue(filters.brand);
  const deferredModelValue = useDeferredValue(filters.model);
  const deferredModelYearValue = useDeferredValue(filters.modelYear);
  const deferredSourceValue = useDeferredValue(filters.source);
  const filteredSearchHistorySuggestions = useMemo(() => {
    const searchValue = deferredSearchValue.trim().toLowerCase();
    if (!searchValue) return searchHistory;
    return searchHistory.filter((item) => item.toLowerCase().includes(searchValue));
  }, [deferredSearchValue, searchHistory]);
  const localSearchSuggestions = useMemo(() => {
    const searchValue = deferredSearchValue.trim().toLowerCase();
    if (searchValue.length < SEARCH_SUGGESTIONS_MIN_CHARS) return [];

    const sourceItems = data?.items ?? [];
    if (sourceItems.length === 0) return [];

    const suggestions: string[] = [];
    const seen = new Set<string>();

    for (const item of sourceItems) {
      const title = typeof item.title === "string" ? item.title.trim() : "";
      const brand = typeof item.tags?.[1] === "string" ? item.tags[1].trim() : "";
      const model = typeof item.tags?.[2] === "string" ? item.tags[2].trim() : "";
      const city = typeof item.city === "string" ? item.city.trim() : "";
      const modelYear =
        typeof item.carModelYear === "number" && Number.isFinite(item.carModelYear)
          ? String(Math.trunc(item.carModelYear))
          : "";
      const mileage =
        typeof item.mileage === "number" && Number.isFinite(item.mileage)
          ? `${Math.trunc(item.mileage)} km`
          : "";
      const priceText = typeof item.priceFormatted === "string" ? item.priceFormatted.trim() : "";
      const candidates = [
        title && title.toLowerCase() !== "untitled" ? title : "",
        brand,
        model,
        city,
        modelYear,
        mileage,
        priceText,
        brand && model ? `${brand} ${model}` : "",
        brand && model && modelYear ? `${brand} ${model} ${modelYear}` : "",
        brand && modelYear ? `${brand} ${modelYear}` : "",
        model && modelYear ? `${model} ${modelYear}` : "",
      ];

      for (const candidate of candidates) {
        const normalizedCandidate = candidate.toLowerCase();
        if (!candidate || !normalizedCandidate.includes(searchValue)) continue;
        if (seen.has(normalizedCandidate)) continue;
        seen.add(normalizedCandidate);
        suggestions.push(candidate);
        if (suggestions.length >= SEARCH_SUGGESTIONS_MAX_ITEMS) {
          return suggestions;
        }
      }
    }

    return suggestions;
  }, [deferredSearchValue, data]);
  const mergedSearchSuggestions = useMemo(() => {
    const merged: string[] = [];
    const seen = new Set<string>();
    const pushSuggestion = (value: string) => {
      const normalized = value.trim();
      if (!normalized) return;
      const key = normalized.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(normalized);
    };

    for (const suggestion of liveSearchSuggestions) {
      pushSuggestion(suggestion);
    }
    for (const suggestion of localSearchSuggestions) {
      pushSuggestion(suggestion);
    }
    for (const suggestion of filteredSearchHistorySuggestions) {
      pushSuggestion(suggestion);
    }

    return merged.slice(0, SEARCH_SUGGESTIONS_MAX_ITEMS);
  }, [filteredSearchHistorySuggestions, liveSearchSuggestions, localSearchSuggestions]);
  const localSearchSuggestionLookup = useMemo(
    () => new Set(localSearchSuggestions.map((item) => item.trim().toLowerCase())),
    [localSearchSuggestions]
  );
  const liveSearchSuggestionLookup = useMemo(
    () => new Set(liveSearchSuggestions.map((item) => item.trim().toLowerCase())),
    [liveSearchSuggestions]
  );
  const shouldShowSearchLoadingIndicator =
    liveSearchSuggestionsLoading && mergedSearchSuggestions.length === 0;
  useEffect(() => {
    if (!progressiveAdvancedFilters) return;
    if (!hasAdvancedFilterSelections) return;
    setAdvancedFiltersOpen(true);
  }, [progressiveAdvancedFilters, hasAdvancedFilterSelections]);

  useEffect(() => {
    if (searchSuggestionActiveIndex >= mergedSearchSuggestions.length) {
      setSearchSuggestionActiveIndex(-1);
    }
  }, [searchSuggestionActiveIndex, mergedSearchSuggestions.length]);

  useEffect(() => {
    setBrandOptionsRenderLimit(DROPDOWN_INITIAL_VISIBLE_OPTIONS);
  }, [filters.brand, brandDropdownShowAll, brandDropdownOpen]);

  useEffect(() => {
    setModelOptionsRenderLimit(DROPDOWN_INITIAL_VISIBLE_OPTIONS);
  }, [filters.model, modelDropdownShowAll, modelDropdownOpen]);

  useEffect(() => {
    setModelYearOptionsRenderLimit(DROPDOWN_INITIAL_VISIBLE_OPTIONS);
  }, [filters.modelYear, modelYearDropdownShowAll, modelYearDropdownOpen]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(target)) {
        setSearchDropdownOpen(false);
        setSearchSuggestionActiveIndex(-1);
      }
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

  const updateFilters = useCallback((updates: Partial<FilterState>) => {
    setFilters((prev) => {
      const next = buildNextFiltersState(prev, updates);
      return hasFilterStateChanged(prev, next) ? next : prev;
    });
  }, []);

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

  const applyFiltersSnapshot = (nextFilters: FilterState) => {
    trackAction({
      actionType: "search",
      actionDetails: {
        query: nextFilters.search,
        match: nextFilters.match,
        city: nextFilters.city,
        brand: nextFilters.brand,
        model: nextFilters.model,
        year: nextFilters.modelYear,
        source: nextFilters.source,
      },
    });
    saveSearchToHistory(nextFilters.search);
    setAppliedFilters({ ...nextFilters });
    setPage(1);
  };

  const applyFilters = () => {
    setSearchDropdownOpen(false);
    setSearchSuggestionActiveIndex(-1);
    applyFiltersSnapshot(filters);
  };

  const applyFilterSelection = useCallback((updates: Partial<FilterState>) => {
    startFilterSelectionTransition(() => {
      setFilters((prev) => {
        const next = buildNextFiltersState(prev, updates);
        return hasFilterStateChanged(prev, next) ? next : prev;
      });
    });
  }, [startFilterSelectionTransition]);

  const applySearchSuggestion = (suggestion: string, autoApply = false) => {
    const normalizedSuggestion = suggestion.trim();
    if (!normalizedSuggestion) return;
    const next = buildNextFiltersState(filters, { search: normalizedSuggestion });
    setFilters(next);
    setSearchDropdownOpen(false);
    setSearchSuggestionActiveIndex(-1);
    if (autoApply && requireSearchClickToApplyFilters) {
      applyFiltersSnapshot(next);
    }
  };

  const handleEnterSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      if (mergedSearchSuggestions.length === 0) return;
      event.preventDefault();
      setSearchDropdownOpen(true);
      setSearchSuggestionActiveIndex((previous) =>
        previous < mergedSearchSuggestions.length - 1 ? previous + 1 : 0
      );
      return;
    }

    if (event.key === "ArrowUp") {
      if (mergedSearchSuggestions.length === 0) return;
      event.preventDefault();
      setSearchDropdownOpen(true);
      setSearchSuggestionActiveIndex((previous) =>
        previous > 0 ? previous - 1 : mergedSearchSuggestions.length - 1
      );
      return;
    }

    if (event.key === "Escape") {
      setSearchDropdownOpen(false);
      setSearchSuggestionActiveIndex(-1);
      return;
    }

    if (event.key !== "Enter") return;
    if (searchDropdownOpen && mergedSearchSuggestions.length > 0) {
      event.preventDefault();
      const selectedIndex = searchSuggestionActiveIndex >= 0 ? searchSuggestionActiveIndex : 0;
      const selectedSuggestion = mergedSearchSuggestions[selectedIndex];
      if (selectedSuggestion) {
        applySearchSuggestion(selectedSuggestion, true);
        return;
      }
    }

    if (!requireSearchClickToApplyFilters) return;
    event.preventDefault();
    applyFilters();
  };

  const handleSearchInputChange = (value: string) => {
    setFilters((prev) => buildNextFiltersState(prev, { search: value }));
    setSearchSuggestionActiveIndex(-1);
    setSearchDropdownOpen(Boolean(value.trim()));
  };

  const handleSearchInputFocus = () => {
    if (filters.search.trim() || filteredSearchHistorySuggestions.length > 0) {
      setSearchDropdownOpen(true);
    }
  };

  const resetFilters = () => {
    trackAction({
      actionType: "filters_reset",
    });
    const resetState = { ...defaultFilters };
    setFilters(resetState);
    setAppliedFilters(resetState);
    setLiveSearchSuggestions([]);
    setSearchDropdownOpen(false);
    setSearchSuggestionActiveIndex(-1);
    setBrandDropdownOpen(false);
    setBrandDropdownShowAll(false);
    setModelDropdownOpen(false);
    setModelDropdownShowAll(false);
    setModelYearDropdownOpen(false);
    setModelYearDropdownShowAll(false);
    if (progressiveAdvancedFilters) {
      setAdvancedFiltersOpen(false);
    }
    setPage(1);
  };

  const ensureOptionPoolLoaded = () => {
    if (!enableBrandFilter && !enableModelFilter) {
      return;
    }
    if (optionPoolLoaded || optionPoolLoading) return;
    setShouldLoadOptionPool(true);
  };

  const ensureModelYearOptionsLoaded = () => {
    if (!enableModelYearFilter) {
      return;
    }
    if (allModelYearOptions.length > 0) return;
    setShouldLoadModelYears(true);
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
  const searchSuggestionsQueryString = useMemo(() => {
    if (!searchDropdownOpen) {
      return "";
    }

    const searchText = deferredSearchValue.trim();
    if (searchText.length < SEARCH_SUGGESTIONS_REMOTE_MIN_CHARS) {
      return "";
    }

    const params = new URLSearchParams();
    params.set("q", searchText);
    params.set("limit", String(SEARCH_SUGGESTIONS_MAX_ITEMS));
    if (tag0) params.set("tag0", tag0);

    const selectedSource = deferredSourceValue?.trim();
    const availableSources = resolvedSources;
    const sourcesParam =
      !selectedSource || selectedSource === "all"
        ? availableSources
        : availableSources.includes(selectedSource as "haraj" | "yallamotor" | "syarah")
          ? [selectedSource]
          : availableSources;
    params.set("sources", sourcesParam.join(","));

    if (enableBrandFilter && deferredBrandValue) params.set("tag1", deferredBrandValue);
    if (enableModelFilter && deferredModelValue) params.set("tag2", deferredModelValue);
    if (enableModelYearFilter && deferredModelYearValue) {
      params.set("carModelYear", deferredModelYearValue);
    }
    if (excludeTag1Values && excludeTag1Values.length > 0) {
      const filtered = excludeTag1Values.map((value) => value.trim()).filter(Boolean);
      if (filtered.length > 0) params.set("excludeTag1", filtered.join(","));
    }

    return params.toString();
  }, [
    searchDropdownOpen,
    deferredSearchValue,
    deferredSourceValue,
    deferredBrandValue,
    deferredModelValue,
    deferredModelYearValue,
    resolvedSources,
    tag0,
    excludeTag1Values,
    enableBrandFilter,
    enableModelFilter,
    enableModelYearFilter,
  ]);
  const searchSuggestionsRequestUrl = useMemo(
    () =>
      searchSuggestionsQueryString
        ? `${suggestionsEndpoint}?${searchSuggestionsQueryString}`
        : "",
    [searchSuggestionsQueryString, suggestionsEndpoint]
  );

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
    if (!optionPoolStorageKey) return;

    try {
      const raw = window.localStorage.getItem(optionPoolStorageKey);
      if (!raw) return;

      const parsed = parseOptionPoolCachePayload(raw);
      if (!parsed) return;
      if (Date.now() - parsed.updatedAt > OPTION_POOL_STORAGE_TTL_MS) {
        window.localStorage.removeItem(optionPoolStorageKey);
        return;
      }

      if (parsed.items.length > 0) {
        const hydratedItems = dedupeEvaluationItems(
          parsed.items.map((item) => toOptionPoolStateItem(item))
        );
        if (hydratedItems.length > 0) {
          setOptionPool((previous) => (previous.length > 0 ? previous : hydratedItems));
          setOptionPoolLoaded(true);
        }
      }

      if (enableModelYearFilter && Array.isArray(parsed.modelYears) && parsed.modelYears.length > 0) {
        setAllModelYearOptions((previous) =>
          previous.length > 0 ? previous : parsed.modelYears ?? []
        );
      }
    } catch {
      // Ignore malformed local cache and continue with network fetch.
    }
  }, [optionPoolStorageKey, enableModelYearFilter]);

  useEffect(() => {
    if (
      (enableBrandFilter || enableModelFilter) &&
      !optionPoolLoaded &&
      !optionPoolLoading &&
      !shouldLoadOptionPool
    ) {
      setShouldLoadOptionPool(true);
    }
    if (enableModelYearFilter && allModelYearOptions.length === 0 && !shouldLoadModelYears) {
      setShouldLoadModelYears(true);
    }
  }, [
    enableBrandFilter,
    enableModelFilter,
    enableModelYearFilter,
    optionPoolLoaded,
    optionPoolLoading,
    shouldLoadOptionPool,
    allModelYearOptions.length,
    shouldLoadModelYears,
    optionsBaseQueryString,
    modelYearOptionsQueryString,
  ]);

  useEffect(() => {
    if (!optionPoolStorageKey || optionPool.length === 0) return;

    try {
      const payload: OptionPoolCachePayload = {
        version: OPTION_POOL_STORAGE_VERSION,
        updatedAt: Date.now(),
        items: optionPool.slice(0, OPTION_POOL_MAX_ITEMS).map(toOptionPoolCacheItem),
        ...(allModelYearOptions.length > 0 ? { modelYears: allModelYearOptions } : {}),
      };
      window.localStorage.setItem(optionPoolStorageKey, JSON.stringify(payload));
    } catch {
      // localStorage can fail in strict privacy modes.
    }
  }, [optionPoolStorageKey, optionPool, allModelYearOptions]);

  useEffect(() => {
    if (!searchSuggestionsRequestUrl) {
      setLiveSearchSuggestions([]);
      setLiveSearchSuggestionsLoading(false);
      setSearchSuggestionActiveIndex(-1);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const cached = searchSuggestionsCacheRef.current.get(searchSuggestionsRequestUrl);
    if (cached) {
      setLiveSearchSuggestions(cached);
      setLiveSearchSuggestionsLoading(false);
    } else {
      setLiveSearchSuggestions([]);
      setLiveSearchSuggestionsLoading(true);
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(searchSuggestionsRequestUrl, {
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
          throw new Error("Failed to fetch search suggestions.");
        }

        const payload = (await response.json()) as SearchSuggestionsResponse;
        const nextSuggestions = Array.isArray(payload.items)
          ? payload.items
              .filter((item): item is string => typeof item === "string")
              .map((item) => item.trim())
              .filter(Boolean)
              .slice(0, SEARCH_SUGGESTIONS_MAX_ITEMS)
          : [];

        if (!active) return;
        setCachedSearchSuggestions(
          searchSuggestionsCacheRef.current,
          searchSuggestionsRequestUrl,
          nextSuggestions
        );
        setLiveSearchSuggestions(nextSuggestions);
        setLiveSearchSuggestionsLoading(false);
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        if (active) {
          setLiveSearchSuggestions(cached ?? []);
          setLiveSearchSuggestionsLoading(false);
        }
      }
    }, SEARCH_SUGGESTIONS_DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchSuggestionsRequestUrl, triggerRegistrationRequired]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const load = async () => {
      setError(null);
      const cachedResponse = listResponseCacheRef.current.get(listRequestUrl);
      if (cachedResponse) {
        const normalizedCachedResponse = normalizeListResponse(cachedResponse);
        setCachedListResponse(
          listResponseCacheRef.current,
          listRequestUrl,
          normalizedCachedResponse
        );
        setData(normalizedCachedResponse);
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
        const result = normalizeListResponse((await response.json()) as ListResponse);
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
                const normalizedNextResult = normalizeListResponse(nextResult);
                setCachedListResponse(
                  listResponseCacheRef.current,
                  nextPageUrl,
                  normalizedNextResult
                );
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
    if (!enableModelYearFilter || !shouldLoadModelYears) return;
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
          setShouldLoadModelYears(false);
        }
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        if (active) {
          setAllModelYearOptions([]);
          setShouldLoadModelYears(false);
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
    shouldLoadModelYears,
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
        const pageSize = OPTION_POOL_PAGE_SIZE;
        const maxPages = OPTION_POOL_MAX_PAGES;
        const maxItems = OPTION_POOL_MAX_ITEMS;
        let currentPage = 1;
        let totalItems: number | null = null;
        const collected: EvaluationSourceItem[] = [];
        let hasPublishedFirstChunk = false;

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
          const result = normalizeListResponse((await response.json()) as ListResponse);
          const fetchedItems = result.items ?? [];
          if (fetchedItems.length > 0) {
            collected.push(...fetchedItems);
          }
          if (active && fetchedItems.length > 0 && !hasPublishedFirstChunk) {
            setOptionPool(dedupeEvaluationItems(fetchedItems));
            setOptionPoolLoaded(true);
            hasPublishedFirstChunk = true;
          }
          if (typeof result.total === "number" && result.total >= 0) {
            totalItems = Math.min(result.total, maxItems);
          }
          if (fetchedItems.length === 0) break;
          if (totalItems !== null && collected.length >= totalItems) break;
          if (result.hasNext === false) break;
          currentPage += 1;
        }

        if (active) {
          const dedupedCollected = dedupeEvaluationItems(collected);
          if (dedupedCollected.length > 0) {
            setOptionPool(dedupedCollected);
            setOptionPoolLoaded(true);
          }
          setOptionPoolLoading(false);
          setShouldLoadOptionPool(false);
        }
      } catch {
        if (controller.signal.aborted) {
          return;
        }
        if (active) {
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
  const optionItems = optionPool.length > 0 ? optionPool : items;
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

  const optionDerived = useMemo(() => {
    const brandMap = new Map<string, string>();
    const allModelMap = new Map<string, string>();
    const modelsByBrandMap = new Map<string, Map<string, string>>();

    for (const item of optionItems) {
      const brand = item.tags?.[1]?.trim();
      const model = item.tags?.[2]?.trim();

      let brandKey = "";
      if (brand) {
        brandKey = toVehicleCanonicalKey(brand);
        if (brandKey) {
          brandMap.set(brandKey, pickPreferredLabel(brandMap.get(brandKey), brand));
        }
      }

      if (model) {
        const modelKey = toVehicleCanonicalKey(model);
        if (modelKey) {
          allModelMap.set(modelKey, pickPreferredLabel(allModelMap.get(modelKey), model));
          if (brandKey) {
            const scopedModels = modelsByBrandMap.get(brandKey) ?? new Map<string, string>();
            scopedModels.set(modelKey, pickPreferredLabel(scopedModels.get(modelKey), model));
            modelsByBrandMap.set(brandKey, scopedModels);
          }
        }
      }
    }

    const brandEntries = Array.from(brandMap.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const brandOptions = brandEntries.map((entry) => entry.label);
    const allModelOptions = Array.from(allModelMap.values()).sort((a, b) => a.localeCompare(b));

    const modelsByBrand = new Map<string, string[]>();
    for (const [brandKey, modelsMap] of modelsByBrandMap.entries()) {
      modelsByBrand.set(
        brandKey,
        Array.from(modelsMap.values()).sort((a, b) => a.localeCompare(b))
      );
    }

    return {
      brandEntries,
      brandOptions,
      allModelOptions,
      modelsByBrand,
    };
  }, [optionItems]);

  const brandOptions = optionDerived.brandOptions;
  const brandOptionIndex = useMemo(
    () => (brandDropdownOpen ? buildIndexedVehicleOptions(brandOptions) : EMPTY_INDEXED_VEHICLE_OPTIONS),
    [brandOptions, brandDropdownOpen]
  );

  const modelOptions = useMemo(() => {
    if (!modelDropdownOpen) {
      return EMPTY_STRING_OPTIONS;
    }

    const brandQuery = deferredBrandValue.trim();
    if (!brandQuery) {
      return optionDerived.allModelOptions;
    }

    const canonicalBrandQuery = toVehicleCanonicalKey(brandQuery);
    if (canonicalBrandQuery) {
      const directModels = optionDerived.modelsByBrand.get(canonicalBrandQuery);
      if (directModels) {
        return directModels;
      }
    }

    const loweredBrandQuery = brandQuery.toLowerCase();
    const matchedBrandKeys = optionDerived.brandEntries
      .filter((entry) => {
        if (entry.label.toLowerCase().includes(loweredBrandQuery)) return true;
        if (canonicalBrandQuery && entry.key.includes(canonicalBrandQuery)) return true;
        return isVehicleTextMatch(entry.label, brandQuery);
      })
      .map((entry) => entry.key);

    if (matchedBrandKeys.length === 0) {
      return [];
    }

    const mergedModelMap = new Map<string, string>();
    for (const brandKey of matchedBrandKeys) {
      const models = optionDerived.modelsByBrand.get(brandKey) ?? [];
      for (const model of models) {
        const modelKey = toVehicleCanonicalKey(model);
        if (!modelKey) continue;
        mergedModelMap.set(modelKey, pickPreferredLabel(mergedModelMap.get(modelKey), model));
      }
    }

    return Array.from(mergedModelMap.values()).sort((a, b) => a.localeCompare(b));
  }, [optionDerived, deferredBrandValue, modelDropdownOpen]);
  const modelOptionIndex = useMemo(() => {
    if (!modelDropdownOpen) {
      return EMPTY_INDEXED_VEHICLE_OPTIONS;
    }
    return buildIndexedVehicleOptions(modelOptions);
  }, [modelOptions, modelDropdownOpen]);

  const filteredBrandOptions = useMemo(() => {
    if (!brandDropdownOpen) {
      return EMPTY_STRING_OPTIONS;
    }
    return filterVehicleOptionsByInput(brandOptionIndex, deferredBrandValue);
  }, [brandOptionIndex, deferredBrandValue, brandDropdownOpen]);
  const filteredModelOptions = useMemo(() => {
    if (!modelDropdownOpen) {
      return EMPTY_STRING_OPTIONS;
    }
    return filterVehicleOptionsByInput(modelOptionIndex, deferredModelValue);
  }, [modelOptionIndex, deferredModelValue, modelDropdownOpen]);

  const visibleBrandOptions = useMemo(() => {
    if (!brandDropdownOpen) return EMPTY_STRING_OPTIONS;
    if (brandDropdownShowAll) return filteredBrandOptions;
    if (!deferredBrandValue.trim()) {
      return filteredBrandOptions.slice(0, DROPDOWN_EMPTY_QUERY_VISIBLE_OPTIONS);
    }
    return filteredBrandOptions;
  }, [brandDropdownOpen, brandDropdownShowAll, filteredBrandOptions, deferredBrandValue]);
  const renderedBrandOptions = useMemo(
    () => visibleBrandOptions.slice(0, brandOptionsRenderLimit),
    [visibleBrandOptions, brandOptionsRenderLimit]
  );
  const hasMoreBrandOptions = renderedBrandOptions.length < visibleBrandOptions.length;

  const visibleModelOptions = useMemo(() => {
    if (!modelDropdownOpen) return EMPTY_STRING_OPTIONS;
    if (modelDropdownShowAll) return filteredModelOptions;
    if (!deferredModelValue.trim()) {
      return filteredModelOptions.slice(0, DROPDOWN_EMPTY_QUERY_VISIBLE_OPTIONS);
    }
    return filteredModelOptions;
  }, [modelDropdownOpen, modelDropdownShowAll, filteredModelOptions, deferredModelValue]);
  const renderedModelOptions = useMemo(
    () => visibleModelOptions.slice(0, modelOptionsRenderLimit),
    [visibleModelOptions, modelOptionsRenderLimit]
  );
  const hasMoreModelOptions = renderedModelOptions.length < visibleModelOptions.length;

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
    if (!modelYearDropdownOpen) return EMPTY_STRING_OPTIONS;
    if (modelYearDropdownShowAll) {
      return modelYearOptions;
    }

    const query = deferredModelYearValue.trim();
    if (!query) {
      return modelYearOptions;
    }

    return modelYearOptions.filter((year) => year.includes(query));
  }, [modelYearDropdownOpen, modelYearDropdownShowAll, modelYearOptions, deferredModelYearValue]);
  const modelYearOptionsForRender = useMemo(() => {
    if (!deferredModelYearValue.trim() && !modelYearDropdownShowAll) {
      return visibleModelYearOptions.slice(0, DROPDOWN_EMPTY_QUERY_VISIBLE_OPTIONS);
    }
    return visibleModelYearOptions;
  }, [visibleModelYearOptions, deferredModelYearValue, modelYearDropdownShowAll]);
  const renderedModelYearOptions = useMemo(
    () => modelYearOptionsForRender.slice(0, modelYearOptionsRenderLimit),
    [modelYearOptionsForRender, modelYearOptionsRenderLimit]
  );
  const hasMoreModelYearOptions =
    renderedModelYearOptions.length < modelYearOptionsForRender.length;

  const fetchDetail = useCallback(async (item: EvaluationSourceItem) => {
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
  }, []);

  const openDetails = useCallback(async (item: EvaluationSourceItem) => {
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
  }, [fetchDetail, trackAction]);

  const openImages = useCallback(async (item: EvaluationSourceItem) => {
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
  }, [fetchDetail, trackAction]);

  const openComments = useCallback(async (item: EvaluationSourceItem) => {
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
  }, [fetchDetail, trackAction]);

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

  const tableRows = useMemo(
    () =>
      items.map((item, index) => {
        const sourceName = getSourceDisplayName(item.source);
        const sourceUrl = resolveSourceUrl(item);

        return (
          <TableRow key={getEvaluationItemIdentity(item, index)}>
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
                getPriceNumber(item.priceNumeric, item.priceFormatted) !== null
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
      }),
    [items, getSourceDisplayName, openDetails, openImages, openComments, t, trackAction]
  );

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
        getPriceNumber(item.priceNumeric, item.priceFormatted) ?? "",
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

  return (
    <div className={`min-h-screen bg-[#f7f4ee] text-slate-900 ${plex.className}`}>
      <ValueTechServiceNavbar />
      <main className="overflow-x-hidden">
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
            <div
              className={`relative overflow-visible border border-slate-200/80 ${
                progressiveAdvancedFilters
                  ? "rounded-2xl bg-white p-2 shadow-sm xl:p-2.5"
                  : "rounded-[28px] bg-gradient-to-br from-white via-[#fffdf8] to-[#f4f8ef] p-4 shadow-[0_16px_44px_rgba(15,23,42,0.11)] xl:p-5"
              }`}
            >
              <div className="relative flex flex-wrap items-start justify-between gap-2 sm:gap-3">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                    {t.filters.badge}
                  </span>
                  <h2 className={`text-lg font-semibold text-slate-900 sm:text-xl ${sora.className}`}>{t.filters.title}</h2>
                  <p className="text-xs text-slate-600 sm:text-sm">
                    {requireSearchClickToApplyFilters
                      ? t.filters.searchModeSubtitle
                      : t.filters.subtitle}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-slate-300 bg-white/90 px-3 py-1 text-xs font-medium text-slate-700">
                    {activeFiltersLabel}: {activeFilterCount}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                      hasPendingFilterChanges
                        ? "border border-amber-300 bg-amber-100 text-amber-700 shadow-[0_4px_14px_rgba(245,158,11,0.15)]"
                        : "border border-emerald-300 bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {hasPendingFilterChanges ? pendingApplyLabel : readyLabel}
                  </span>
                </div>
              </div>

              <div className="relative mt-2 p-1">
                <div className="p-0.5">
                  <div
                    id="advanced-filters-panel"
                    className={`grid gap-1.5 sm:grid-cols-2 ${
                      progressiveAdvancedFilters
                        ? showSourceFilter
                          ? "xl:grid-cols-4"
                          : "xl:grid-cols-3"
                        : showSourceFilter
                          ? "xl:grid-cols-6"
                          : "xl:grid-cols-5"
                    }`}
                  >
                    <div
                      className={`flex flex-col gap-1 sm:col-span-2 ${
                        progressiveAdvancedFilters ? "xl:col-span-full" : "xl:col-span-2"
                      }`}
                    >
                      <div className="flex w-full min-w-0 items-center justify-center gap-1.5">
                        <div
                          className="relative min-w-[170px] w-full sm:w-[52%] lg:w-[45%] xl:w-[38%] flex-none"
                          ref={searchDropdownRef}
                        >
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                          {shouldShowSearchLoadingIndicator ? (
                            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-emerald-500" />
                          ) : null}
                          <Input
                            value={filters.search}
                            onChange={(event) => handleSearchInputChange(event.target.value)}
                            onKeyDown={handleEnterSearchKeyDown}
                            onFocus={handleSearchInputFocus}
                            placeholder={progressiveAdvancedFilters ? "" : t.filters.searchPlaceholder}
                            autoComplete="off"
                            className="h-9 w-full min-w-0 rounded-md border-slate-300 bg-white pl-8 pr-8 text-xs shadow-[inset_0_0_0_1px_rgba(16,185,129,0.16),0_0_0_1px_rgba(15,23,42,0.05)] transition-colors focus-visible:border-slate-300 focus-visible:shadow-[inset_0_0_0_1px_rgba(16,185,129,0.5),0_0_0_3px_rgba(16,185,129,0.14)] focus-visible:ring-0"
                          />
                          {searchDropdownOpen ? (
                            <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_34px_rgba(15,23,42,0.14)]">
                              {mergedSearchSuggestions.length > 0 ? (
                                <div className="max-h-64 overflow-y-auto p-1.5">
                                  {mergedSearchSuggestions.map((value, index) => {
                                    const isActive = index === searchSuggestionActiveIndex;
                                    const normalizedSuggestion = value.trim().toLowerCase();
                                    const isLiveSuggestion = liveSearchSuggestionLookup.has(
                                      normalizedSuggestion
                                    );
                                    const isLocalSuggestion = localSearchSuggestionLookup.has(
                                      normalizedSuggestion
                                    );
                                    return (
                                      <button
                                        key={`${value}-${index}`}
                                        type="button"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => applySearchSuggestion(value, true)}
                                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                                          isActive
                                            ? "bg-emerald-100 text-emerald-800"
                                            : "text-slate-700 hover:bg-slate-100"
                                        }`}
                                      >
                                        <span className="truncate">{value}</span>
                                        <span className="ml-3 shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-600">
                                          {isLiveSuggestion
                                            ? liveSuggestionLabel
                                            : isLocalSuggestion
                                              ? localSuggestionLabel
                                              : historySuggestionLabel}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : shouldShowSearchLoadingIndicator ? (
                                <p className="px-3 py-2 text-xs text-slate-500">
                                  {loadingSuggestionsLabel}
                                </p>
                              ) : deferredSearchValue.trim().length >= SEARCH_SUGGESTIONS_MIN_CHARS &&
                                  !liveSearchSuggestionsLoading ? (
                                <p className="px-3 py-2 text-xs text-slate-500">
                                  {noSuggestionsLabel}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                        {progressiveAdvancedFilters && requireSearchClickToApplyFilters ? (
                          <Button
                            type="button"
                            className="h-9 rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white transition hover:bg-emerald-600"
                            onClick={applyFilters}
                          >
                            {t.filters.search}
                          </Button>
                        ) : null}
                        {progressiveAdvancedFilters && hasAdvancedFilterControls ? (
                          <div className="inline-flex items-center gap-1 pl-0.5">
                            <span className="text-[11px] font-semibold text-slate-700">
                              {advancedSearchLabel}
                            </span>
                            <button
                              type="button"
                              onClick={() => setAdvancedFiltersOpen((prev) => !prev)}
                              aria-expanded={showAdvancedFilters}
                              aria-controls="advanced-filters-panel"
                              aria-label={advancedSearchLabel}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
                            >
                              <ChevronDown
                                className={`h-3.5 w-3.5 transition-transform ${
                                  showAdvancedFilters ? "rotate-180 text-emerald-700" : "text-slate-500"
                                }`}
                              />
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {!progressiveAdvancedFilters && showSearchAuxControls ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex h-9 shrink-0 select-none items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 whitespace-nowrap text-xs font-semibold text-slate-600">
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
                            className="h-9 w-fit shrink-0 whitespace-nowrap rounded-lg border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50"
                            onClick={clearSearchHistory}
                            disabled={searchHistory.length === 0}
                          >
                            {t.filters.clearHistory}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                    {showAdvancedFilters && enableBrandFilter ? (
                      <div className={filterFieldContainerClass}>
                        <Label className={filterLabelClass}>
                          {t.filters.brand}
                        </Label>
                        <div className="relative min-w-0 w-full sm:flex-1" ref={brandDropdownRef}>
                          <Input
                            value={filters.brand}
                            onChange={(event) => {
                              ensureOptionPoolLoaded();
                              setBrandDropdownShowAll(false);
                              setBrandDropdownOpen(true);
                              updateFilters({ brand: event.target.value });
                            }}
                            onKeyDown={handleEnterSearchKeyDown}
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
                            className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700"
                            aria-label={openBrandOptionsLabel}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          {brandDropdownOpen ? (
                            <div className={searchableDropdownClass}>
                              {optionPoolLoading && optionItems.length === 0 ? (
                                <div className="px-3 py-2 text-center text-sm text-slate-400">{loadingOptionsLabel}</div>
                              ) : null}
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setBrandDropdownOpen(false);
                                  setBrandDropdownShowAll(false);
                                  applyFilterSelection({ brand: "" });
                                }}
                                className={`${searchableDropdownOptionClass} ${
                                  filters.brand ? "text-slate-700" : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {clearBrandLabel}
                              </button>
                              {renderedBrandOptions.map((brand, index) => (
                                <button
                                  key={`${brand}-${index}`}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    setBrandDropdownOpen(false);
                                    setBrandDropdownShowAll(false);
                                    applyFilterSelection({ brand });
                                  }}
                                  className={`${searchableDropdownOptionClass} ${
                                    brand.trim().toLowerCase() === filters.brand.trim().toLowerCase()
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {brand}
                                </button>
                              ))}
                              {hasMoreBrandOptions ? (
                                <button
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() =>
                                    setBrandOptionsRenderLimit((prev) =>
                                      prev + DROPDOWN_LOAD_MORE_STEP
                                    )
                                  }
                                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                                >
                                  {showMoreOptionsLabel}
                                </button>
                              ) : null}
                              {visibleBrandOptions.length === 0 ? (
                                <div className="px-3 py-2 text-center text-sm text-slate-400">{noOptionsLabel}</div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {showAdvancedFilters && enableModelFilter ? (
                      <div className={filterFieldContainerClass}>
                        <Label className={filterLabelClass}>
                          {t.filters.model}
                        </Label>
                        <div className="relative min-w-0 w-full sm:flex-1" ref={modelDropdownRef}>
                          <Input
                            value={filters.model}
                            onChange={(event) => {
                              ensureOptionPoolLoaded();
                              setModelDropdownShowAll(false);
                              setModelDropdownOpen(true);
                              updateFilters({ model: event.target.value });
                            }}
                            onKeyDown={handleEnterSearchKeyDown}
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
                            className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700"
                            aria-label={openModelOptionsLabel}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          {modelDropdownOpen ? (
                            <div className={searchableDropdownClass}>
                              {optionPoolLoading && optionItems.length === 0 ? (
                                <div className="px-3 py-2 text-center text-sm text-slate-400">{loadingOptionsLabel}</div>
                              ) : null}
                              <button
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setModelDropdownOpen(false);
                                  setModelDropdownShowAll(false);
                                  applyFilterSelection({ model: "" });
                                }}
                                className={`${searchableDropdownOptionClass} ${
                                  filters.model ? "text-slate-700" : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {clearModelLabel}
                              </button>
                              {renderedModelOptions.map((model, index) => (
                                <button
                                  key={`${model}-${index}`}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    setModelDropdownOpen(false);
                                    setModelDropdownShowAll(false);
                                    applyFilterSelection({ model });
                                  }}
                                  className={`${searchableDropdownOptionClass} ${
                                    model.trim().toLowerCase() === filters.model.trim().toLowerCase()
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {model}
                                </button>
                              ))}
                              {hasMoreModelOptions ? (
                                <button
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() =>
                                    setModelOptionsRenderLimit((prev) =>
                                      prev + DROPDOWN_LOAD_MORE_STEP
                                    )
                                  }
                                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                                >
                                  {showMoreOptionsLabel}
                                </button>
                              ) : null}
                              {visibleModelOptions.length === 0 ? (
                                <div className="px-3 py-2 text-center text-sm text-slate-400">{noOptionsLabel}</div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {showAdvancedFilters && enableModelYearFilter ? (
                      <div className={filterFieldContainerClass}>
                        <Label className={filterLabelClass}>
                          {t.filters.manufactureYear}
                        </Label>
                        <div className="relative min-w-0 w-full sm:flex-1" ref={modelYearDropdownRef}>
                          <Tag className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            value={filters.modelYear}
                            onChange={(event) => {
                              ensureModelYearOptionsLoaded();
                              setModelYearDropdownShowAll(false);
                              setModelYearDropdownOpen(true);
                              updateFilters({ modelYear: event.target.value });
                            }}
                            onKeyDown={handleEnterSearchKeyDown}
                            onFocus={() => {
                              ensureModelYearOptionsLoaded();
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
                              ensureModelYearOptionsLoaded();
                              setModelYearDropdownShowAll(true);
                              setModelYearDropdownOpen(true);
                            }}
                            className="absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700"
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
                                  setModelYearDropdownOpen(false);
                                  setModelYearDropdownShowAll(false);
                                  applyFilterSelection({ modelYear: "" });
                                }}
                                className={`${searchableDropdownOptionClass} ${
                                  filters.modelYear ? "text-slate-700" : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {clearModelYearLabel}
                              </button>
                              {renderedModelYearOptions.map((year, index) => (
                                <button
                                  key={`${year}-${index}`}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    setModelYearDropdownOpen(false);
                                    setModelYearDropdownShowAll(false);
                                    applyFilterSelection({ modelYear: year });
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
                              {hasMoreModelYearOptions ? (
                                <button
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() =>
                                    setModelYearOptionsRenderLimit((prev) =>
                                      prev + DROPDOWN_LOAD_MORE_STEP
                                    )
                                  }
                                  className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                                >
                                  {showMoreOptionsLabel}
                                </button>
                              ) : null}
                              {visibleModelYearOptions.length === 0 ? (
                                <div className="px-3 py-2 text-center text-sm text-slate-400">{noOptionsLabel}</div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {showAdvancedFilters && showSourceFilter ? (
                      <div className={filterFieldContainerClass}>
                        <Label className={filterLabelClass}>
                          {t.filters.source}
                        </Label>
                        <div className="w-full min-w-0 sm:flex-1">
                          <Select
                            value={filters.source}
                            onValueChange={(value) => updateFilters({ source: value })}
                          >
                            <SelectTrigger className={filterSelectTriggerClass}>
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
                  {showAdvancedFilters ? (
                    <div
                      className={`mt-1.5 grid gap-1.5 md:grid-cols-2 ${
                        enableMileageFilter ? "xl:grid-cols-12" : "xl:grid-cols-8"
                      }`}
                    >
                    <div
                      className={`${
                        enableMileageFilter ? "xl:col-span-6" : "xl:col-span-5"
                      }`}
                    >
                      <div
                        className={`grid gap-1.5 sm:grid-cols-2 ${
                          enableMileageFilter ? "lg:grid-cols-4" : "lg:grid-cols-3"
                        }`}
                      >
                        <button
                          type="button"
                          aria-pressed={filters.hasImage === "true"}
                          onClick={() =>
                            updateFilters({ hasImage: filters.hasImage === "true" ? "any" : "true" })
                          }
                          className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition ${
                            filters.hasImage === "true"
                              ? "border-emerald-700 bg-emerald-700 text-white"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border ${
                              filters.hasImage === "true"
                                ? "border-white bg-white/20"
                                : "border-slate-400 bg-white"
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
                          className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition ${
                            filters.hasPrice === "true"
                              ? "border-emerald-700 bg-emerald-700 text-white"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border ${
                              filters.hasPrice === "true"
                                ? "border-white bg-white/20"
                                : "border-slate-400 bg-white"
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
                          className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition ${
                            filters.hasComments === "true"
                              ? "border-emerald-700 bg-emerald-700 text-white"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border ${
                              filters.hasComments === "true"
                                ? "border-white bg-white/20"
                                : "border-slate-400 bg-white"
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
                            className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border px-2.5 text-xs font-medium transition ${
                              filters.hasMileage === "true"
                                ? "border-emerald-700 bg-emerald-700 text-white"
                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span
                              className={`inline-flex h-4 w-4 items-center justify-center rounded-sm border ${
                                filters.hasMileage === "true"
                                  ? "border-white bg-white/20"
                                  : "border-slate-400 bg-white"
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
                      <div
                        className={`xl:col-span-4 ${
                          progressiveAdvancedFilters
                            ? "flex items-center gap-1.5"
                            : "flex flex-col gap-1"
                        }`}
                      >
                        <Label className={mileageFilterLabelClass}>
                          {mileageLabel}
                        </Label>
                        <div className="grid min-w-0 grid-cols-2 gap-1.5 flex-1">
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={filters.mileageMin}
                            onChange={(event) => updateFilters({ mileageMin: event.target.value })}
                            onKeyDown={handleEnterSearchKeyDown}
                            placeholder={mileageMinPlaceholder}
                            className="h-9 w-full rounded-lg border-slate-200 bg-slate-50/70 text-sm focus-visible:border-emerald-300 focus-visible:bg-white focus-visible:ring-emerald-400/30"
                          />
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={filters.mileageMax}
                            onChange={(event) => updateFilters({ mileageMax: event.target.value })}
                            onKeyDown={handleEnterSearchKeyDown}
                            placeholder={mileageMaxPlaceholder}
                            className="h-9 w-full rounded-lg border-slate-200 bg-slate-50/70 text-sm focus-visible:border-emerald-300 focus-visible:bg-white focus-visible:ring-emerald-400/30"
                          />
                        </div>
                      </div>
                    ) : null}
                    <div
                      className={`${filterFieldContainerClass} ${
                        enableMileageFilter ? "xl:col-span-2" : "xl:col-span-3"
                      }`}
                    >
                      <Label className={filterLabelClass}>
                        {t.filters.sortBy}
                      </Label>
                      <div className="w-full min-w-0">
                        <Select
                          value={filters.sort}
                          onValueChange={(value) => updateFilters({ sort: value })}
                        >
                          <SelectTrigger className={filterSelectTriggerClass}>
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
                  ) : null}
                  {requireSearchClickToApplyFilters && !progressiveAdvancedFilters ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-3 py-3 shadow-[0_8px_20px_rgba(16,185,129,0.10)]">
                      <p className="text-xs text-slate-500">
                        {hasPendingFilterChanges ? pendingApplyLabel : readyLabel}
                      </p>
                      <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 rounded-xl border-slate-300 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50"
                        onClick={resetFilters}
                      >
                        {resetFiltersLabel}
                      </Button>
                      <Button
                        type="button"
                        className="h-10 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(5,150,105,0.24)] transition hover:bg-emerald-600"
                        onClick={applyFilters}
                      >
                        {t.filters.search}
                      </Button>
                      </div>
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
                        {tableRows}
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
      <ValueTechServiceFooter />
    </div>
  );
}




