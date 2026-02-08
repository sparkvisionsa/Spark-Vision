
"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import Header from "@/components/header";
import Footer from "@/components/footer";
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
  ArrowUpRight,
  Check,
  Eye,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Search,
  Tag,
} from "lucide-react";
import { IBM_Plex_Sans, Sora } from "next/font/google";
import { LanguageContext } from "@/components/layout-provider";

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
  phone: string;
  url: string;
};

type ListResponse = {
  items: EvaluationSourceItem[];
  total: number;
  page: number;
  limit: number;
};

type EvaluationSourcePageProps = {
  tag0?: string;
  enableBrandFilter?: boolean;
  enableModelFilter?: boolean;
  enableModelYearFilter?: boolean;
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
  city: "",
  brand: "",
  model: "",
  modelYear: "",
  excludeAccessories: false,
  minPrice: "",
  maxPrice: "",
  hasImage: "any",
  hasPrice: "any",
  hasComments: "any",
  sort: "newest",
};

const copy = {
  en: {
    filters: {
      badge: "Magic Filters",
      title: "Filter and refine",
      subtitle: "Instant results as you type.",
      search: "Search",
      searchPlaceholder: "Title, Description",
      city: "City",
      cityPlaceholder: "Search city",
      brand: "Brand",
      brandPlaceholder: "Type or select brand",
      model: "Model",
      modelPlaceholder: "Type or select model",
      manufactureYear: "Manufacture Year",
      manufactureYearPlaceholder: "Type or select year",
      priceRange: "Price range",
      min: "Min",
      max: "Max",
      excludeAccessories: "Exclude Car accessories",
      hasImages: "Has images",
      hasPrice: "Has price",
      hasComments: "Has comments",
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
      city: "City",
      price: "Price",
      date: "Date",
      images: "Images",
      comments: "Comments",
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
      detailTitle: "Evaluation Source Detail",
      detailSubtitle: "Full record insights with structured sections.",
      summary: "Summary",
      tags: "Tags",
      noTags: "No tags listed.",
      notes: "Notes",
      noDescription: "No detailed description provided.",
      commentsSection: "Comments",
      imagesSection: "Images",
      loadingDetails: "Loading details...",
      unableDetails: "Unable to load details.",
      titleLabel: "Title",
      cityLabel: "City",
      priceLabel: "Price",
      phoneLabel: "Phone",
      sourceLabel: "Source",
      openListing: "Open listing",
      anonymous: "Anonymous",
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
      title: "تصفية وتنقيح",
      subtitle: "نتائج فورية أثناء الكتابة.",
      search: "بحث",
      searchPlaceholder: "العنوان، الوصف",
      city: "المدينة",
      cityPlaceholder: "ابحث عن مدينة",
      brand: "العلامة",
      brandPlaceholder: "اكتب أو اختر العلامة",
      model: "الموديل",
      modelPlaceholder: "اكتب أو اختر الموديل",
      manufactureYear: "سنة الصنع",
      manufactureYearPlaceholder: "اكتب أو اختر السنة",
      priceRange: "نطاق السعر",
      min: "الحد الأدنى",
      max: "الحد الأعلى",
      excludeAccessories: "استبعاد قطع الغيار والملحقات",
      hasImages: "مع صور",
      hasPrice: "مع سعر",
      hasComments: "مع تعليقات",
      sortBy: "ترتيب حسب",
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
      city: "المدينة",
      price: "السعر",
      date: "التاريخ",
      images: "الصور",
      comments: "التعليقات",
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
      loading: "جارٍ تحميل بيانات مصدر التقييم...",
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
      detailTitle: "تفاصيل مصدر التقييم",
      detailSubtitle: "تفاصيل كاملة بشكل منظّم.",
      summary: "ملخص",
      tags: "الوسوم",
      noTags: "لا توجد وسوم.",
      notes: "ملاحظات",
      noDescription: "لا يوجد وصف تفصيلي.",
      commentsSection: "التعليقات",
      imagesSection: "الصور",
      loadingDetails: "جارٍ تحميل التفاصيل...",
      unableDetails: "تعذّر تحميل التفاصيل.",
      titleLabel: "العنوان",
      cityLabel: "المدينة",
      priceLabel: "السعر",
      phoneLabel: "الهاتف",
      sourceLabel: "المصدر",
      openListing: "فتح الإعلان",
      anonymous: "مجهول",
    },
    carInfo: {
      title: "معلومات السيارة",
      empty: "لا تتوفر معلومات السيارة.",
      mileage: "المسافة المقطوعة",
      sellOrWaiver: "بيع أو تنازل",
    },
  },
} as const;

function formatEpoch(value: number | null) {
  if (!value) return "-";
  const asDate = value > 1_000_000_000_000 ? new Date(value) : new Date(value * 1000);
  if (Number.isNaN(asDate.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(asDate);
}

function formatPrice(value: number | null, formatted?: string | null) {
  if (formatted) return formatted;
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US").format(value);
}

function normalizeTag(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

export default function EvaluationSourcePage({
  tag0,
  enableBrandFilter = false,
  enableModelFilter = false,
  enableModelYearFilter = false,
}: EvaluationSourcePageProps) {
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "en";
  const t = language === "ar" ? copy.ar : copy.en;
  const [filters, setFilters] = useState(defaultFilters);
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

  const updateFilters = (updates: Partial<typeof defaultFilters>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setPage(1);
  };

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.city) params.set("city", filters.city);
    if (filters.minPrice) params.set("minPrice", filters.minPrice);
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
    if (filters.hasImage !== "any") params.set("hasImage", filters.hasImage);
    if (filters.hasPrice !== "any") params.set("hasPrice", filters.hasPrice);
    if (filters.hasComments !== "any") params.set("hasComments", filters.hasComments);
    if (filters.sort) params.set("sort", filters.sort);
    if (tag0) params.set("tag0", tag0);
    if (enableBrandFilter && filters.brand) params.set("tag1", filters.brand);
    if (enableModelFilter && filters.model) params.set("tag2", filters.model);
    if (enableModelYearFilter && filters.modelYear) params.set("carModelYear", filters.modelYear);
    if (filters.excludeAccessories) params.set("excludeTag1", "قطع غيار وملحقات");
    params.set("page", String(page));
    params.set("limit", String(limit));
    return params.toString();
  }, [filters, page, limit, tag0, enableBrandFilter, enableModelFilter, enableModelYearFilter]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setStatus("loading");
      setError(null);
      try {
        const response = await fetch(`/api/haraj-scrape?${queryString}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Failed to fetch evaluation source data.");
        }
        const result = (await response.json()) as ListResponse;
        if (active) {
          setData(result);
          setStatus("idle");
        }
      } catch (err) {
        if (active) {
          setStatus("error");
          setError(t.status.error);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [queryString]);

  const items = data?.items ?? [];
  const totalPages = Math.max(Math.ceil((data?.total ?? 0) / limit), 1);

  const cityOptions = useMemo(() => {
    return Array.from(new Set(items.map((item) => item.city).filter(Boolean))).sort();
  }, [items]);

  const brandOptions = useMemo(() => {
    return Array.from(
      new Set(
        items
          .map((item) => item.tags?.[1])
          .filter((value): value is string => Boolean(value))
      )
    ).sort();
  }, [items]);

  const modelOptions = useMemo(() => {
    const selectedBrand = normalizeTag(filters.brand);
    const filteredItems = selectedBrand
      ? items.filter((item) => normalizeTag(item.tags?.[1]) === selectedBrand)
      : items;
    return Array.from(
      new Set(
        filteredItems
          .map((item) => item.tags?.[2])
          .filter((value): value is string => Boolean(value))
      )
    ).sort();
  }, [items, filters.brand]);

  const modelYearOptions = useMemo(() => {
    const years = items
      .map((item) => item.carModelYear)
      .filter((value): value is number => value !== null && value !== undefined)
      .map((value) => String(value).trim())
      .filter(Boolean);
    const uniqueYears = Array.from(new Set(years));
    uniqueYears.sort((a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (!Number.isNaN(numA) && !Number.isNaN(numB)) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });
    return uniqueYears;
  }, [items]);

  useEffect(() => {
    if (!enableModelFilter) return;
    if (!filters.model) return;
    const selectedBrand = normalizeTag(filters.brand);
    if (!selectedBrand) return;
    const validModels = new Set(modelOptions.map((model) => normalizeTag(model)));
    if (!validModels.has(normalizeTag(filters.model))) {
      setFilters((prev) => ({ ...prev, model: "" }));
      setPage(1);
    }
  }, [filters.brand, filters.model, enableModelFilter, modelOptions]);

  useEffect(() => {
    if (!enableModelYearFilter) return;
    if (!filters.modelYear) return;
    const normalizedYear = filters.modelYear.trim();
    const validYears = new Set(modelYearOptions);
    if (!validYears.has(normalizedYear)) {
      setFilters((prev) => ({ ...prev, modelYear: "" }));
      setPage(1);
    }
  }, [filters.modelYear, enableModelYearFilter, modelYearOptions]);

  const fetchDetail = async (itemId: string) => {
    const response = await fetch(`/api/haraj-scrape/${encodeURIComponent(itemId)}`, {
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Unable to load document details.");
    }
    return (await response.json()) as Record<string, any>;
  };

  const openDetails = async (itemId: string) => {
    setDetailOpen(true);
    setDetailStatus("loading");
    setDetail(null);
    try {
      const doc = await fetchDetail(itemId);
      setDetail(doc);
      setDetailStatus("idle");
    } catch (err) {
      setDetailStatus("error");
    }
  };

  const openImages = async (itemId: string) => {
    setImagesOpen(true);
    setModalStatus("loading");
    setModalImages([]);
    try {
      const doc = await fetchDetail(itemId);
      const images = (doc?.item?.imagesList ?? doc?.imagesList ?? []) as string[];
      setModalImages(images);
      setModalStatus("idle");
    } catch (err) {
      setModalStatus("error");
    }
  };

  const openComments = async (itemId: string) => {
    setCommentsOpen(true);
    setModalStatus("loading");
    setModalComments([]);
    try {
      const doc = await fetchDetail(itemId);
      const comments =
        (doc?.comments ??
          doc?.gql?.comments?.json?.data?.comments?.items ??
          []) as Array<Record<string, any>>;
      setModalComments(comments);
      setModalStatus("idle");
    } catch (err) {
      setModalStatus("error");
    }
  };

  const detailImages = (detail?.item?.imagesList ?? []) as string[];
  const detailTags = (detail?.tags ?? detail?.item?.tags ?? []) as string[];
  const detailComments = (detail?.comments ?? []) as Array<Record<string, any>>;
  const carInfo = (detail?.item?.carInfo ??
    detail?.carInfo ??
    detail?.gql?.posts?.json?.data?.posts?.items?.[0]?.carInfo ??
    null) as Record<string, any> | null;
  const carMileage = carInfo?.mileage ?? null;
  const carInfoEntries =
    carInfo && typeof carInfo === "object" && !Array.isArray(carInfo)
      ? Object.entries(carInfo).filter(
          ([key, value]) => key !== "mileage" && value !== null && value !== undefined && value !== ""
        )
      : [];

  return (
    <div className={`min-h-screen bg-[#f7f4ee] text-slate-900 ${plex.className}`}>
      <style>{animationStyles}</style>
      <Header />
      <main className="relative overflow-hidden">
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
            <div className="relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-white/85 p-4 shadow-[0_35px_120px_-50px_rgba(16,185,129,0.55)] backdrop-blur">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-16 right-8 h-40 w-40 rounded-full bg-emerald-200/40 blur-3xl" />
                <div className="absolute -bottom-12 left-6 h-36 w-36 rounded-full bg-cyan-200/40 blur-3xl" />
                <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-r from-transparent via-emerald-200/40 to-transparent opacity-60" />
              </div>

              <div className="relative flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1 text-[10px] uppercase tracking-[0.35em] text-white">
                    {t.filters.badge}
                  </span>
                  <h2 className={`text-lg font-semibold text-slate-900 ${sora.className}`}>{t.filters.title}</h2>
                  <p className="text-xs text-slate-500">{t.filters.subtitle}</p>
                </div>
              </div>

              <div className="relative mt-3 rounded-2xl border border-slate-200/70 bg-slate-200/70 p-[1px]">
                <div className="grid gap-[1px] overflow-hidden rounded-[15px] bg-slate-200/70 md:grid-cols-2 lg:grid-cols-5">
                  <div className="flex items-center gap-2 bg-white/95 px-3 py-2">
                    <Label className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      {t.filters.search}
                    </Label>
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={filters.search}
                        onChange={(event) => updateFilters({ search: event.target.value })}
                        placeholder={t.filters.searchPlaceholder}
                        className="h-9 pl-8 text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white/95 px-3 py-2">
                    <Label className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      {t.filters.city}
                    </Label>
                    <div className="relative flex-1">
                      <MapPin className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        list="city-options"
                        value={filters.city}
                        onChange={(event) => updateFilters({ city: event.target.value })}
                        placeholder={t.filters.cityPlaceholder}
                        className="h-9 pl-8 text-sm"
                      />
                      <datalist id="city-options">
                        {cityOptions.map((city) => (
                          <option key={city} value={city} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  {enableBrandFilter ? (
                    <div className="flex items-center gap-2 bg-white/95 px-3 py-2">
                      <Label className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-[0.24em] text-slate-500">
                        {t.filters.brand}
                      </Label>
                      <div className="relative flex-1">
                        <Tag className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          list="brand-options"
                          value={filters.brand}
                          onChange={(event) => updateFilters({ brand: event.target.value })}
                          placeholder={t.filters.brandPlaceholder}
                          className="h-9 pl-8 text-sm"
                        />
                        <datalist id="brand-options">
                          {brandOptions.map((brand) => (
                            <option key={brand} value={brand} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                  ) : null}
                  {enableModelFilter ? (
                    <div className="flex items-center gap-2 bg-white/95 px-3 py-2">
                      <Label className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-[0.24em] text-slate-500">
                        {t.filters.model}
                      </Label>
                      <div className="relative flex-1">
                        <Tag className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          list="model-options"
                          value={filters.model}
                          onChange={(event) => updateFilters({ model: event.target.value })}
                          placeholder={t.filters.modelPlaceholder}
                          className="h-9 pl-8 text-sm"
                        />
                        <datalist id="model-options">
                          {modelOptions.map((model) => (
                            <option key={model} value={model} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                  ) : null}
                  {enableModelYearFilter ? (
                    <div className="flex items-center gap-2 bg-white/95 px-3 py-2">
                      <Label className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-[0.24em] text-slate-500">
                        {t.filters.manufactureYear}
                      </Label>
                      <div className="relative flex-1">
                        <Tag className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          list="model-year-options"
                          value={filters.modelYear}
                          onChange={(event) => updateFilters({ modelYear: event.target.value })}
                          placeholder={t.filters.manufactureYearPlaceholder}
                          className="h-9 pl-8 text-sm"
                        />
                        <datalist id="model-year-options">
                          {modelYearOptions.map((year) => (
                            <option key={year} value={year} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 bg-white/95 px-3 py-2">
                    <Label className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-[0.24em] text-slate-500">
                      {t.filters.priceRange}
                    </Label>
                    <div className="grid flex-1 grid-cols-2 gap-1">
                      <Input
                        value={filters.minPrice}
                        onChange={(event) => updateFilters({ minPrice: event.target.value })}
                        placeholder={t.filters.min}
                        className="h-9 text-sm"
                      />
                      <Input
                        value={filters.maxPrice}
                        onChange={(event) => updateFilters({ maxPrice: event.target.value })}
                        placeholder={t.filters.max}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div className="bg-white/95 px-2 py-2 lg:col-span-3">
                    <div className="grid gap-[1px] rounded-xl bg-slate-200/70 p-[1px] sm:grid-cols-2 lg:grid-cols-4">
                      <button
                        type="button"
                        aria-pressed={filters.excludeAccessories}
                        onClick={() => updateFilters({ excludeAccessories: !filters.excludeAccessories })}
                        className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-[11px] px-3 text-[10px] uppercase tracking-[0.24em] transition ${
                          filters.excludeAccessories
                            ? "bg-emerald-50 text-emerald-700 shadow-sm"
                            : "bg-white text-slate-500 hover:text-emerald-600"
                        }`}
                      >
                        {filters.excludeAccessories ? <Check className="h-3.5 w-3.5" /> : null}
                        {t.filters.excludeAccessories}
                      </button>
                      <button
                        type="button"
                        aria-pressed={filters.hasImage === "true"}
                        onClick={() =>
                          updateFilters({ hasImage: filters.hasImage === "true" ? "any" : "true" })
                        }
                        className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-[11px] px-3 text-[10px] uppercase tracking-[0.24em] transition ${
                          filters.hasImage === "true"
                            ? "bg-emerald-50 text-emerald-700 shadow-sm"
                            : "bg-white text-slate-500 hover:text-emerald-600"
                        }`}
                      >
                        {filters.hasImage === "true" ? <Check className="h-3.5 w-3.5" /> : null}
                        {t.filters.hasImages}
                      </button>
                      <button
                        type="button"
                        aria-pressed={filters.hasPrice === "true"}
                        onClick={() =>
                          updateFilters({ hasPrice: filters.hasPrice === "true" ? "any" : "true" })
                        }
                        className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-[11px] px-3 text-[10px] uppercase tracking-[0.24em] transition ${
                          filters.hasPrice === "true"
                            ? "bg-emerald-50 text-emerald-700 shadow-sm"
                            : "bg-white text-slate-500 hover:text-emerald-600"
                        }`}
                      >
                        {filters.hasPrice === "true" ? <Check className="h-3.5 w-3.5" /> : null}
                        {t.filters.hasPrice}
                      </button>
                      <button
                        type="button"
                        aria-pressed={filters.hasComments === "true"}
                        onClick={() =>
                          updateFilters({ hasComments: filters.hasComments === "true" ? "any" : "true" })
                        }
                        className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-[11px] px-3 text-[10px] uppercase tracking-[0.24em] transition ${
                          filters.hasComments === "true"
                            ? "bg-emerald-50 text-emerald-700 shadow-sm"
                            : "bg-white text-slate-500 hover:text-emerald-600"
                        }`}
                      >
                        {filters.hasComments === "true" ? <Check className="h-3.5 w-3.5" /> : null}
                        {t.filters.hasComments}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-white/95 px-3 py-2">
                    <Label className="shrink-0 whitespace-nowrap text-[10px] uppercase tracking-[0.24em] text-slate-500">
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
              </div>
            </div>

            <div className="mt-8 rounded-3xl border border-slate-200 bg-white/95 shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-900 text-white px-3 py-2 text-xs uppercase tracking-[0.25em]">
                    {t.table.badge}
                  </div>
                  <p className="text-sm text-slate-500">
                    {t.table.showing(items.length, page, totalPages)}
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
              </div>
            </div>

              <div className="px-6 py-4">
                {status === "loading" ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t.status.loading}
                  </div>
                ) : status === "error" ? (
                  <div className="text-sm text-rose-500">{t.status.error}</div>
                ) : items.length === 0 ? (
                  <div className="text-sm text-slate-500">{t.status.noRecords}</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[11px] uppercase tracking-[0.18em]">{t.table.title}</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-[0.18em]">{t.table.city}</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-[0.18em]">{t.table.price}</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-[0.18em]">{t.table.date}</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-[0.18em]">{t.table.images}</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-[0.18em]">{t.table.comments}</TableHead>
                        <TableHead className="text-[11px] uppercase tracking-[0.18em]">{t.table.actions}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm font-medium text-slate-900">
                            <div className="space-y-1">
                              <button
                                type="button"
                                onClick={() => openDetails(item.id)}
                                className="group inline-flex max-w-[280px] items-start rounded-md px-1 py-0.5 text-left rtl:text-right text-slate-900 transition-all hover:bg-emerald-50/70 hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white group-hover:scale-[1.02]"
                              >
                                <span className="line-clamp-2 underline decoration-transparent decoration-2 underline-offset-4 transition-colors group-hover:decoration-emerald-300">
                                  {item.title}
                                </span>
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-slate-600">{item.city || "-"}</TableCell>
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
                                onClick={() => openImages(item.id)}
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
                            {item.commentsCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => openComments(item.id)}
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
                            <div className="flex flex-wrap items-center gap-3">
                              <Button
                                size="sm"
                                className="h-8 gap-2 bg-slate-900 text-white hover:bg-slate-800"
                                onClick={() => openDetails(item.id)}
                              >
                                <Eye className="h-4 w-4" />
                                {t.table.seeMore}
                              </Button>
                              {item.url ? (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
                                >
                                  {t.table.openSource}
                                  <ArrowUpRight className="h-3 w-3" />
                                </a>
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-6 py-4 text-xs text-slate-500">
                <div>
                  {t.table.showingPage(page, totalPages)}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
                    {t.table.previous}
                  </Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}>
                    {t.table.next}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Dialog open={imagesOpen} onOpenChange={setImagesOpen}>
          <DialogContent className="max-w-3xl border border-slate-200 bg-white/95 p-0">
            <DialogHeader className="border-b border-slate-200 px-6 py-4">
              <DialogTitle className={`text-2xl font-semibold ${sora.className}`}>{t.modals.imagesTitle}</DialogTitle>
              <p className="text-sm text-slate-500">{t.modals.imagesSubtitle}</p>
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
            <DialogHeader className="border-b border-slate-200 px-6 py-4">
              <DialogTitle className={`text-2xl font-semibold ${sora.className}`}>{t.modals.commentsTitle}</DialogTitle>
              <p className="text-sm text-slate-500">{t.modals.commentsSubtitle}</p>
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
          <DialogContent className="max-w-[1600px] w-[96vw] border border-slate-200 bg-white/95 p-0">
            <DialogHeader className="border-b border-slate-200 px-6 py-4">
              <DialogTitle className={`text-2xl font-semibold ${sora.className}`}>{t.modals.detailTitle}</DialogTitle>
              <p className="text-sm text-slate-500">{t.modals.detailSubtitle}</p>
            </DialogHeader>
            <ScrollArea className="max-h-[80vh]">
              <div className="grid gap-6 p-6 lg:grid-cols-[30%_70%]">
                <div className="space-y-4">
                  <div className="rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-lg">
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
                  {carInfo ? (
                    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{t.carInfo.title}</p>
                      {carInfoEntries.length === 0 && (carMileage === null || carMileage === undefined) ? (
                        <p className="mt-3 text-xs text-slate-500">{t.carInfo.empty}</p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{t.carInfo.mileage}</span>
                            <span className="font-medium">{carMileage ?? "-"}</span>
                          </div>
                          {carInfoEntries.map(([key, value]) => (
                            <div
                              key={key}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                            >
                              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                                {key === "sellOrWaiver" ? t.carInfo.sellOrWaiver : key}
                              </span>
                              <span className="font-medium">{String(value)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{t.modals.summary}</p>
                    {detailStatus === "loading" ? (
                      <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.modals.loadingDetails}
                      </div>
                    ) : detailStatus === "error" ? (
                      <p className="mt-3 text-sm text-rose-500">{t.modals.unableDetails}</p>
                    ) : detail ? (
                      <div className="mt-4 overflow-x-auto">
                        <div className="flex items-center gap-4 text-sm text-slate-700 whitespace-nowrap">
                          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                            <span className="text-xs text-slate-400">{t.modals.titleLabel}</span>
                            <span className="font-medium text-slate-900">{detail?.title ?? detail?.item?.title ?? "-"}</span>
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                            <span className="text-xs text-slate-400">{t.modals.cityLabel}</span>
                            <span className="font-medium text-slate-900">
                              {detail?.city ?? detail?.item?.city ?? detail?.item?.geoCity ?? "-"}
                            </span>
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                            <span className="text-xs text-slate-400">{t.modals.priceLabel}</span>
                            <span className="font-medium text-slate-900">
                              {formatPrice(detail?.priceNumeric ?? detail?.item?.price?.numeric ?? null, detail?.item?.price?.formattedPrice ?? null)}
                            </span>
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                            <span className="text-xs text-slate-400">{t.modals.phoneLabel}</span>
                            <span className="font-medium text-slate-900">{detail?.phone ?? "-"}</span>
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
                            <span className="text-xs text-slate-400">{t.modals.sourceLabel}</span>
                            {detail?.url ? (
                              <a
                                href={detail.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-slate-950"
                              >
                                {t.modals.openListing} <ArrowUpRight className="h-3 w-3" />
                              </a>
                            ) : (
                              <span className="font-medium text-slate-900">-</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{t.modals.tags}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {detailTags.length === 0 ? (
                        <span className="text-xs text-slate-500">{t.modals.noTags}</span>
                      ) : (
                        detailTags.map((tag) => (
                          <span key={tag} className="rounded-full bg-slate-900/10 px-3 py-1 text-[11px] text-slate-700">
                            {tag}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{t.modals.notes}</p>
                    <p className="mt-3 text-sm text-slate-600 whitespace-pre-line">
                      {detail?.item?.bodyTEXT ?? detail?.item?.bodyHTML ?? t.modals.noDescription}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
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
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </main>
      <Footer />
    </div>
  );
}
