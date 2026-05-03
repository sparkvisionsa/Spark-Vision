"use client";

import { useState, useContext, useEffect } from "react";
import { LanguageContext } from "@/components/layout-provider";

// ─── Types ────────────────────────────────────────────────────────────────────

type SubView = "hub" | "regions" | "cities" | "neighborhoods";

interface Region {
  id: number;
  titleAr: string;
  titleEn: string;
}

interface City {
  id: number;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  regionId: number;
  active: boolean;
}

interface Neighborhood {
  id: number;
  titleAr: string;
  titleEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  regionId: number;
  cityId: number;
  active: boolean;
}

// ─── Static seed data (mirrors the HTML samples) ─────────────────────────────

const REGIONS: Region[] = [
  { id: 1, titleAr: "منطقة الرياض", titleEn: "Riyadh" },
  { id: 2, titleAr: "منطقة مكة المكرمة", titleEn: "Makkah" },
  { id: 3, titleAr: "منطقة المدينة المنورة", titleEn: "Madinah" },
  { id: 4, titleAr: "منطقة القصيم", titleEn: "Qassim" },
  { id: 5, titleAr: "المنطقة الشرقية", titleEn: "Eastern Province" },
  { id: 6, titleAr: "منطقة عسير", titleEn: "Asir" },
  { id: 7, titleAr: "منطقة تبوك", titleEn: "Tabuk" },
  { id: 8, titleAr: "منطقة حائل", titleEn: "Hail" },
  { id: 9, titleAr: "منطقة الحدود الشمالية", titleEn: "Northern Borders" },
  { id: 10, titleAr: "منطقة جازان", titleEn: "Jazan" },
  { id: 11, titleAr: "منطقة نجران", titleEn: "Najran" },
  { id: 12, titleAr: "منطقة الباحة", titleEn: "Bahah" },
  { id: 13, titleAr: "منطقة الجوف", titleEn: "Jawf" },
];

const CITIES: City[] = [
  { id: 1, titleAr: "الرياض", titleEn: "Riyadh", regionId: 1, active: true },
  {
    id: 2,
    titleAr: "المجمعة",
    titleEn: "Al Majma'ah",
    regionId: 1,
    active: true,
  },
  {
    id: 3,
    titleAr: "العيطلية",
    titleEn: "Al 'Aytaliyah",
    regionId: 1,
    active: true,
  },
  {
    id: 4,
    titleAr: "حزوة / العمانية",
    titleEn: "Hizwah (Al Umaniyah)",
    regionId: 1,
    active: true,
  },
  { id: 5, titleAr: "الافلاج", titleEn: "Al Aflaj", regionId: 1, active: true },
  {
    id: 6,
    titleAr: "الوسيعة",
    titleEn: "Al Wasi'ah",
    regionId: 1,
    active: true,
  },
  { id: 7, titleAr: "تمرية", titleEn: "Tamriyah", regionId: 1, active: true },
  {
    id: 8,
    titleAr: "ابو خسيفاء",
    titleEn: "Abu Khusayfa",
    regionId: 1,
    active: true,
  },
  { id: 9, titleAr: "النخيل", titleEn: "An Nakhil", regionId: 1, active: true },
  {
    id: 10,
    titleAr: "السحيمي",
    titleEn: "As Suhaymi",
    regionId: 1,
    active: true,
  },
];

const NEIGHBORHOODS: Neighborhood[] = [
  {
    id: 1,
    titleAr: "العمل",
    titleEn: "Al Amal Dist.",
    regionId: 1,
    cityId: 1,
    active: true,
  },
  {
    id: 2,
    titleAr: "النموذجية",
    titleEn: "Al Namudhajiyah Dist.",
    regionId: 1,
    cityId: 1,
    active: true,
  },
  {
    id: 3,
    titleAr: "الجرادية",
    titleEn: "Al Jarradiyah Dist.",
    regionId: 1,
    cityId: 1,
    active: true,
  },
  {
    id: 4,
    titleAr: "الصناعية",
    titleEn: "Al Sinaiyah Dist.",
    regionId: 1,
    cityId: 1,
    active: true,
  },
  {
    id: 5,
    titleAr: "منفوحة الجديدة",
    titleEn: "Manfuha Al Jadidah Dist.",
    regionId: 1,
    cityId: 1,
    active: true,
  },
  {
    id: 6,
    titleAr: "الفاخرية",
    titleEn: "Al Fakhiriyah Dist.",
    regionId: 1,
    cityId: 1,
    active: true,
  },
  {
    id: 7,
    titleAr: "الديرة",
    titleEn: "Al Dirah Dist.",
    regionId: 1,
    cityId: 1,
    active: true,
  },
  {
    id: 8,
    titleAr: "ام الحمام الشرق",
    titleEn: "East Umm Al Hamam Dist.",
    regionId: 1,
    cityId: 1,
    active: true,
  },
  {
    id: 9,
    titleAr: "الشرفية",
    titleEn: "Al Sharafiyah Dist.",
    regionId: 1,
    cityId: 1,
    active: true,
  },
  {
    id: 10,
    titleAr: "الهدا",
    titleEn: "Al Hada Dist.",
    regionId: 1,
    cityId: 1,
    active: true,
  },
];

// ─── Copy ─────────────────────────────────────────────────────────────────────

const COPY = {
  ar: {
    settings: "الإعدادات",
    citiesAndNeighborhoods: "المدن والأحياء",
    citiesAndNeighborhoodsDesc:
      "إدارة المناطق والمدن والأحياء في المملكة العربية السعودية",
    regions: "المناطق",
    regionsDesc: "إدارة مناطق المملكة",
    cities: "المدن",
    citiesDesc: "إدارة مدن المملكة",
    neighborhoods: "الأحياء",
    neighborhoodsDesc: "إدارة أحياء المدن",
    addRegion: "إضافة منطقة",
    addCity: "إضافة مدينة",
    addNeighborhood: "إضافة حي",
    titleAr: "الاسم بالعربية",
    titleEn: "الاسم بالإنجليزية",
    descriptionAr: "الوصف بالعربية",
    descriptionEn: "الوصف بالإنجليزية",
    region: "المنطقة",
    city: "المدينة",
    status: "الحالة",
    active: "فعّال",
    inactive: "غير فعّال",
    add: "إضافة",
    search: "بحث",
    searchPlaceholder: "ابحث...",
    selectRegion: "اختر المنطقة",
    selectCity: "اختر المدينة",
    allRegions: "كل المناطق",
    allCities: "كل المدن",
    required: "هذا الحقل مطلوب",
    back: "رجوع",
    edit: "تعديل",
    noResults: "لا توجد نتائج",
    showing: "عرض",
    of: "من",
    records: "سجل",
    name: "الاسم",
    actions: "الإجراءات",
    activateStatus: "تفعيل",
  },
  en: {
    settings: "Settings",
    citiesAndNeighborhoods: "Cities & Neighborhoods",
    citiesAndNeighborhoodsDesc:
      "Manage regions, cities, and neighborhoods across Saudi Arabia",
    regions: "Regions",
    regionsDesc: "Manage Saudi regions",
    cities: "Cities",
    citiesDesc: "Manage Saudi cities",
    neighborhoods: "Neighborhoods",
    neighborhoodsDesc: "Manage city neighborhoods",
    addRegion: "Add Region",
    addCity: "Add City",
    addNeighborhood: "Add Neighborhood",
    titleAr: "Name (Arabic)",
    titleEn: "Name (English)",
    descriptionAr: "Description (Arabic)",
    descriptionEn: "Description (English)",
    region: "Region",
    city: "City",
    status: "Status",
    active: "Active",
    inactive: "Inactive",
    add: "Add",
    search: "Search",
    searchPlaceholder: "Search...",
    selectRegion: "Select Region",
    selectCity: "Select City",
    allRegions: "All Regions",
    allCities: "All Cities",
    required: "This field is required",
    back: "Back",
    edit: "Edit",
    noResults: "No results found",
    showing: "Showing",
    of: "of",
    records: "records",
    name: "Name",
    actions: "Actions",
    activateStatus: "Activate",
  },
};

// ─── Shared UI primitives ─────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition";

const labelCls =
  "block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5";

const selectCls =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 transition appearance-none cursor-pointer";

function PageHeader({
  title,
  subtitle,
  onBack,
  isRtl,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  isRtl: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 mb-8 ${isRtl ? "flex-row-reverse" : ""}`}
    >
      {onBack && (
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:border-emerald-300 hover:text-emerald-600 transition"
        >
          <svg
            className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
      )}
      <div className={isRtl ? "text-right" : ""}>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 px-6 py-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">
        {children}
      </h2>
    </div>
  );
}

function StatusBadge({ active, t }: { active: boolean; t: typeof COPY.ar }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-100">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      {t.active}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 border border-slate-200">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      {t.inactive}
    </span>
  );
}

function EditButton({
  onClick,
  label,
}: {
  onClick?: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:border-emerald-300 hover:text-emerald-600 transition"
    >
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
        />
      </svg>
      {label}
    </button>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
  isRtl,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  isRtl: boolean;
}) {
  if (totalPages <= 1) return null;
  const pages = Array.from(
    { length: Math.min(totalPages, 5) },
    (_, i) => i + 1,
  );
  return (
    <div
      className={`flex items-center gap-1 ${isRtl ? "flex-row-reverse" : ""}`}
    >
      <button
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page === 1}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 text-xs hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        {isRtl ? "›" : "‹"}
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPage(p)}
          className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-medium transition ${
            p === page
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600"
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 text-xs hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        {isRtl ? "‹" : "›"}
      </button>
    </div>
  );
}

// ─── Settings Hub ─────────────────────────────────────────────────────────────

function SettingsHub({
  t,
  isRtl,
  onNavigate,
}: {
  t: typeof COPY.ar;
  isRtl: boolean;
  onNavigate: (v: SubView) => void;
}) {
  const tiles = [
    {
      view: "regions" as SubView,
      label: t.regions,
      desc: t.regionsDesc,
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      count: REGIONS.length,
    },
    {
      view: "cities" as SubView,
      label: t.cities,
      desc: t.citiesDesc,
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      ),
      count: CITIES.length,
    },
    {
      view: "neighborhoods" as SubView,
      label: t.neighborhoods,
      desc: t.neighborhoodsDesc,
      icon: (
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
      count: NEIGHBORHOODS.length,
    },
  ];

  return (
    <div dir={isRtl ? "rtl" : "ltr"}>
      <PageHeader title={t.settings} isRtl={isRtl} />

      {/* Section header */}
      <div className={`mb-6 ${isRtl ? "text-right" : ""}`}>
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-100 px-4 py-1.5 mb-3">
          <svg
            className="h-3.5 w-3.5 text-emerald-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
          </svg>
          <span className="text-xs font-semibold text-emerald-700">
            {t.citiesAndNeighborhoods}
          </span>
        </div>
        <h2 className="text-lg font-bold text-slate-900">
          {t.citiesAndNeighborhoods}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {t.citiesAndNeighborhoodsDesc}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <button
            key={tile.view}
            onClick={() => onNavigate(tile.view)}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm hover:border-emerald-300 hover:shadow-md transition-all duration-200"
          >
            {/* Subtle gradient accent */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 to-emerald-50/0 group-hover:from-emerald-50/60 group-hover:to-transparent transition-all duration-300 rounded-2xl" />

            <div
              className={`relative flex items-start gap-4 ${isRtl ? "flex-row-reverse text-right" : ""}`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 group-hover:bg-emerald-100 transition">
                {tile.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold text-slate-900 text-base">
                    {tile.label}
                  </p>
                  <span className="text-xs font-semibold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5 shrink-0">
                    {tile.count}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {tile.desc}
                </p>
              </div>
            </div>

            <div
              className={`relative mt-4 flex items-center gap-1 text-xs font-semibold text-emerald-600 ${isRtl ? "flex-row-reverse justify-end" : ""}`}
            >
              <span>{isRtl ? "إدارة" : "Manage"}</span>
              <svg
                className={`h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform ${isRtl ? "rotate-180 group-hover:-translate-x-0.5 group-hover:translate-x-0" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Regions Page ─────────────────────────────────────────────────────────────

function RegionsPage({
  t,
  isRtl,
  onBack,
}: {
  t: typeof COPY.ar;
  isRtl: boolean;
  onBack: () => void;
}) {
  const [regions, setRegions] = useState<Region[]>(REGIONS);
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [errors, setErrors] = useState<{ titleAr?: boolean }>({});
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filtered = regions.filter(
    (r) =>
      r.titleAr.includes(searchQ) ||
      r.titleEn.toLowerCase().includes(searchQ.toLowerCase()),
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleAdd = () => {
    if (!titleAr.trim()) {
      setErrors({ titleAr: true });
      return;
    }
    setRegions((p) => [
      { id: Date.now(), titleAr: titleAr.trim(), titleEn: titleEn.trim() },
      ...p,
    ]);
    setTitleAr("");
    setTitleEn("");
    setErrors({});
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"}>
      <PageHeader
        title={t.regions}
        subtitle={t.regionsDesc}
        onBack={onBack}
        isRtl={isRtl}
      />

      {/* Add form */}
      <Card className="mb-6">
        <CardHeader>{t.addRegion}</CardHeader>
        <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{t.titleAr} *</label>
            <input
              className={`${inputCls} ${errors.titleAr ? "border-red-300 focus:border-red-400 focus:ring-red-100" : ""}`}
              placeholder={t.titleAr}
              value={titleAr}
              onChange={(e) => {
                setTitleAr(e.target.value);
                setErrors({});
              }}
              dir="rtl"
            />
            {errors.titleAr && (
              <p className="mt-1 text-xs text-red-500">{t.required}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>{t.titleEn}</label>
            <input
              className={inputCls}
              placeholder={t.titleEn}
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              dir="ltr"
            />
          </div>
        </div>
        <div className="border-t border-slate-100 px-6 py-4">
          <button
            onClick={handleAdd}
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 active:bg-emerald-700 transition"
          >
            {t.add}
          </button>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>{t.regions}</CardHeader>
        <div className="p-6">
          {/* Search */}
          <div className="mb-4 max-w-sm">
            <div className="relative">
              <svg
                className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 ${isRtl ? "right-3" : "left-3"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                className={`${inputCls} ${isRtl ? "pr-10" : "pl-10"}`}
                placeholder={t.searchPlaceholder}
                value={searchQ}
                onChange={(e) => {
                  setSearchQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th
                    className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                  >
                    {t.titleAr}
                  </th>
                  <th
                    className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                  >
                    {t.titleEn}
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                    {t.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-sm text-slate-400"
                    >
                      {t.noResults}
                    </td>
                  </tr>
                ) : (
                  paginated.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition">
                      <td
                        className={`px-4 py-3 font-medium text-slate-800 ${isRtl ? "text-right" : ""}`}
                        dir="rtl"
                      >
                        {r.titleAr}
                      </td>
                      <td
                        className={`px-4 py-3 text-slate-600 ${isRtl ? "text-right" : ""}`}
                        dir="ltr"
                      >
                        {r.titleEn}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <EditButton label={t.edit} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div
            className={`mt-4 flex items-center justify-between gap-4 flex-wrap ${isRtl ? "flex-row-reverse" : ""}`}
          >
            <p className="text-xs text-slate-500">
              {t.showing}{" "}
              {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–
              {Math.min(page * PAGE_SIZE, filtered.length)} {t.of}{" "}
              {filtered.length} {t.records}
            </p>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPage={setPage}
              isRtl={isRtl}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Cities Page ──────────────────────────────────────────────────────────────

function CitiesPage({
  t,
  isRtl,
  onBack,
}: {
  t: typeof COPY.ar;
  isRtl: boolean;
  onBack: () => void;
}) {
  const [cities, setCities] = useState<City[]>(CITIES);
  const [form, setForm] = useState({
    titleAr: "",
    titleEn: "",
    descriptionAr: "",
    descriptionEn: "",
    regionId: "",
    active: true,
  });
  const [errors, setErrors] = useState<{
    titleAr?: boolean;
    regionId?: boolean;
  }>({});
  const [searchQ, setSearchQ] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filtered = cities.filter((c) => {
    const matchSearch =
      c.titleAr.includes(searchQ) ||
      c.titleEn.toLowerCase().includes(searchQ.toLowerCase());
    const matchRegion = !filterRegion || c.regionId === Number(filterRegion);
    return matchSearch && matchRegion;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleAdd = () => {
    const newErrors: typeof errors = {};
    if (!form.titleAr.trim()) newErrors.titleAr = true;
    if (!form.regionId) newErrors.regionId = true;
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }
    setCities((p) => [
      { id: Date.now(), ...form, regionId: Number(form.regionId) },
      ...p,
    ]);
    setForm({
      titleAr: "",
      titleEn: "",
      descriptionAr: "",
      descriptionEn: "",
      regionId: "",
      active: true,
    });
    setErrors({});
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"}>
      <PageHeader
        title={t.cities}
        subtitle={t.citiesDesc}
        onBack={onBack}
        isRtl={isRtl}
      />

      {/* Add form */}
      <Card className="mb-6">
        <CardHeader>{t.addCity}</CardHeader>
        <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{t.titleAr} *</label>
            <input
              className={`${inputCls} ${errors.titleAr ? "border-red-300" : ""}`}
              placeholder={t.titleAr}
              value={form.titleAr}
              onChange={(e) => {
                setForm((p) => ({ ...p, titleAr: e.target.value }));
                setErrors({});
              }}
              dir="rtl"
            />
            {errors.titleAr && (
              <p className="mt-1 text-xs text-red-500">{t.required}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>{t.titleEn}</label>
            <input
              className={inputCls}
              placeholder={t.titleEn}
              value={form.titleEn}
              onChange={(e) =>
                setForm((p) => ({ ...p, titleEn: e.target.value }))
              }
              dir="ltr"
            />
          </div>
          <div>
            <label className={labelCls}>{t.descriptionAr}</label>
            <textarea
              className={inputCls}
              rows={3}
              placeholder={t.descriptionAr}
              value={form.descriptionAr}
              onChange={(e) =>
                setForm((p) => ({ ...p, descriptionAr: e.target.value }))
              }
              dir="rtl"
            />
          </div>
          <div>
            <label className={labelCls}>{t.descriptionEn}</label>
            <textarea
              className={inputCls}
              rows={3}
              placeholder={t.descriptionEn}
              value={form.descriptionEn}
              onChange={(e) =>
                setForm((p) => ({ ...p, descriptionEn: e.target.value }))
              }
              dir="ltr"
            />
          </div>
          <div>
            <label className={labelCls}>{t.region} *</label>
            <div className="relative">
              <select
                className={`${selectCls} ${errors.regionId ? "border-red-300" : ""}`}
                value={form.regionId}
                onChange={(e) => {
                  setForm((p) => ({ ...p, regionId: e.target.value }));
                  setErrors({});
                }}
              >
                <option value="">{t.selectRegion}</option>
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {isRtl ? r.titleAr : r.titleEn}
                  </option>
                ))}
              </select>
              <svg
                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 ${isRtl ? "left-3" : "right-3"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
            {errors.regionId && (
              <p className="mt-1 text-xs text-red-500">{t.required}</p>
            )}
          </div>
          <div className="flex items-center gap-3 pt-6">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={form.active}
                onChange={(e) =>
                  setForm((p) => ({ ...p, active: e.target.checked }))
                }
              />
              <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:bg-emerald-500 peer-checked:after:translate-x-4" />
            </label>
            <span className="text-sm font-medium text-slate-700">
              {t.active}
            </span>
          </div>
        </div>
        <div className="border-t border-slate-100 px-6 py-4">
          <button
            onClick={handleAdd}
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 transition"
          >
            {t.add}
          </button>
        </div>
      </Card>

      {/* Search */}
      <Card className="mb-6">
        <CardHeader>{t.search}</CardHeader>
        <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{t.name}</label>
            <input
              className={inputCls}
              placeholder={t.searchPlaceholder}
              value={searchQ}
              onChange={(e) => {
                setSearchQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className={labelCls}>{t.region}</label>
            <div className="relative">
              <select
                className={selectCls}
                value={filterRegion}
                onChange={(e) => {
                  setFilterRegion(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t.allRegions}</option>
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {isRtl ? r.titleAr : r.titleEn}
                  </option>
                ))}
              </select>
              <svg
                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 ${isRtl ? "left-3" : "right-3"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>{t.cities}</CardHeader>
        <div className="p-6">
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th
                    className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                  >
                    #
                  </th>
                  <th
                    className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                  >
                    {t.titleAr}
                  </th>
                  <th
                    className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                  >
                    {t.titleEn}
                  </th>
                  <th
                    className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                  >
                    {t.region}
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                    {t.status}
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                    {t.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-slate-400"
                    >
                      {t.noResults}
                    </td>
                  </tr>
                ) : (
                  paginated.map((c) => {
                    const region = REGIONS.find((r) => r.id === c.regionId);
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50/60 transition"
                      >
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {c.id}
                        </td>
                        <td
                          className={`px-4 py-3 font-medium text-slate-800 ${isRtl ? "text-right" : ""}`}
                          dir="rtl"
                        >
                          {c.titleAr}
                        </td>
                        <td
                          className={`px-4 py-3 text-slate-600 ${isRtl ? "text-right" : ""}`}
                          dir="ltr"
                        >
                          {c.titleEn}
                        </td>
                        <td
                          className={`px-4 py-3 text-slate-600 ${isRtl ? "text-right" : ""}`}
                        >
                          {region
                            ? isRtl
                              ? region.titleAr
                              : region.titleEn
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge active={c.active} t={t} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <EditButton label={t.edit} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div
            className={`mt-4 flex items-center justify-between gap-4 flex-wrap ${isRtl ? "flex-row-reverse" : ""}`}
          >
            <p className="text-xs text-slate-500">
              {t.showing}{" "}
              {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–
              {Math.min(page * PAGE_SIZE, filtered.length)} {t.of}{" "}
              {filtered.length} {t.records}
            </p>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPage={setPage}
              isRtl={isRtl}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Neighborhoods Page ───────────────────────────────────────────────────────

function NeighborhoodsPage({
  t,
  isRtl,
  onBack,
}: {
  t: typeof COPY.ar;
  isRtl: boolean;
  onBack: () => void;
}) {
  const [neighborhoods, setNeighborhoods] =
    useState<Neighborhood[]>(NEIGHBORHOODS);
  const [form, setForm] = useState({
    titleAr: "",
    titleEn: "",
    descriptionAr: "",
    descriptionEn: "",
    regionId: "",
    cityId: "",
    active: true,
  });
  const [errors, setErrors] = useState<{
    titleAr?: boolean;
    regionId?: boolean;
    cityId?: boolean;
  }>({});
  const [searchQ, setSearchQ] = useState("");
  const [filterRegion, setFilterRegion] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const citiesForRegion = form.regionId
    ? CITIES.filter((c) => c.regionId === Number(form.regionId))
    : CITIES;

  const filterCitiesForSearch = filterRegion
    ? CITIES.filter((c) => c.regionId === Number(filterRegion))
    : CITIES;

  const filtered = neighborhoods.filter((n) => {
    const matchSearch =
      n.titleAr.includes(searchQ) ||
      n.titleEn.toLowerCase().includes(searchQ.toLowerCase());
    const matchRegion = !filterRegion || n.regionId === Number(filterRegion);
    const matchCity = !filterCity || n.cityId === Number(filterCity);
    return matchSearch && matchRegion && matchCity;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleAdd = () => {
    const newErrors: typeof errors = {};
    if (!form.titleAr.trim()) newErrors.titleAr = true;
    if (!form.regionId) newErrors.regionId = true;
    if (!form.cityId) newErrors.cityId = true;
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }
    setNeighborhoods((p) => [
      {
        id: Date.now(),
        ...form,
        regionId: Number(form.regionId),
        cityId: Number(form.cityId),
      },
      ...p,
    ]);
    setForm({
      titleAr: "",
      titleEn: "",
      descriptionAr: "",
      descriptionEn: "",
      regionId: "",
      cityId: "",
      active: true,
    });
    setErrors({});
  };

  return (
    <div dir={isRtl ? "rtl" : "ltr"}>
      <PageHeader
        title={t.neighborhoods}
        subtitle={t.neighborhoodsDesc}
        onBack={onBack}
        isRtl={isRtl}
      />

      {/* Add form */}
      <Card className="mb-6">
        <CardHeader>{t.addNeighborhood}</CardHeader>
        <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>{t.titleAr} *</label>
            <input
              className={`${inputCls} ${errors.titleAr ? "border-red-300" : ""}`}
              placeholder={t.titleAr}
              value={form.titleAr}
              onChange={(e) => {
                setForm((p) => ({ ...p, titleAr: e.target.value }));
                setErrors({});
              }}
              dir="rtl"
            />
            {errors.titleAr && (
              <p className="mt-1 text-xs text-red-500">{t.required}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>{t.titleEn}</label>
            <input
              className={inputCls}
              placeholder={t.titleEn}
              value={form.titleEn}
              onChange={(e) =>
                setForm((p) => ({ ...p, titleEn: e.target.value }))
              }
              dir="ltr"
            />
          </div>
          <div>
            <label className={labelCls}>{t.descriptionAr}</label>
            <textarea
              className={inputCls}
              rows={3}
              placeholder={t.descriptionAr}
              value={form.descriptionAr}
              onChange={(e) =>
                setForm((p) => ({ ...p, descriptionAr: e.target.value }))
              }
              dir="rtl"
            />
          </div>
          <div>
            <label className={labelCls}>{t.descriptionEn}</label>
            <textarea
              className={inputCls}
              rows={3}
              placeholder={t.descriptionEn}
              value={form.descriptionEn}
              onChange={(e) =>
                setForm((p) => ({ ...p, descriptionEn: e.target.value }))
              }
              dir="ltr"
            />
          </div>
          <div>
            <label className={labelCls}>{t.region} *</label>
            <div className="relative">
              <select
                className={`${selectCls} ${errors.regionId ? "border-red-300" : ""}`}
                value={form.regionId}
                onChange={(e) => {
                  setForm((p) => ({
                    ...p,
                    regionId: e.target.value,
                    cityId: "",
                  }));
                  setErrors({});
                }}
              >
                <option value="">{t.selectRegion}</option>
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {isRtl ? r.titleAr : r.titleEn}
                  </option>
                ))}
              </select>
              <svg
                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 ${isRtl ? "left-3" : "right-3"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
            {errors.regionId && (
              <p className="mt-1 text-xs text-red-500">{t.required}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>{t.city} *</label>
            <div className="relative">
              <select
                className={`${selectCls} ${errors.cityId ? "border-red-300" : ""}`}
                value={form.cityId}
                onChange={(e) => {
                  setForm((p) => ({ ...p, cityId: e.target.value }));
                  setErrors({});
                }}
              >
                <option value="">{t.selectCity}</option>
                {citiesForRegion.map((c) => (
                  <option key={c.id} value={c.id}>
                    {isRtl ? c.titleAr : c.titleEn}
                  </option>
                ))}
              </select>
              <svg
                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 ${isRtl ? "left-3" : "right-3"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
            {errors.cityId && (
              <p className="mt-1 text-xs text-red-500">{t.required}</p>
            )}
          </div>
          <div className="flex items-center gap-3 pt-6">
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={form.active}
                onChange={(e) =>
                  setForm((p) => ({ ...p, active: e.target.checked }))
                }
              />
              <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow after:transition-all peer-checked:bg-emerald-500 peer-checked:after:translate-x-4" />
            </label>
            <span className="text-sm font-medium text-slate-700">
              {t.active}
            </span>
          </div>
        </div>
        <div className="border-t border-slate-100 px-6 py-4">
          <button
            onClick={handleAdd}
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 transition"
          >
            {t.add}
          </button>
        </div>
      </Card>

      {/* Search */}
      <Card className="mb-6">
        <CardHeader>{t.search}</CardHeader>
        <div className="p-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>{t.name}</label>
            <input
              className={inputCls}
              placeholder={t.searchPlaceholder}
              value={searchQ}
              onChange={(e) => {
                setSearchQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label className={labelCls}>{t.region}</label>
            <div className="relative">
              <select
                className={selectCls}
                value={filterRegion}
                onChange={(e) => {
                  setFilterRegion(e.target.value);
                  setFilterCity("");
                  setPage(1);
                }}
              >
                <option value="">{t.allRegions}</option>
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {isRtl ? r.titleAr : r.titleEn}
                  </option>
                ))}
              </select>
              <svg
                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 ${isRtl ? "left-3" : "right-3"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
          <div>
            <label className={labelCls}>{t.city}</label>
            <div className="relative">
              <select
                className={selectCls}
                value={filterCity}
                onChange={(e) => {
                  setFilterCity(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t.allCities}</option>
                {filterCitiesForSearch.map((c) => (
                  <option key={c.id} value={c.id}>
                    {isRtl ? c.titleAr : c.titleEn}
                  </option>
                ))}
              </select>
              <svg
                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 ${isRtl ? "left-3" : "right-3"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>{t.neighborhoods}</CardHeader>
        <div className="p-6">
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th
                    className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                  >
                    #
                  </th>
                  <th
                    className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                  >
                    {t.titleAr}
                  </th>
                  <th
                    className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                  >
                    {t.titleEn}
                  </th>
                  <th
                    className={`px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 ${isRtl ? "text-right" : "text-left"}`}
                  >
                    {t.city}
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                    {t.status}
                  </th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 text-center">
                    {t.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-slate-400"
                    >
                      {t.noResults}
                    </td>
                  </tr>
                ) : (
                  paginated.map((n) => {
                    const city = CITIES.find((c) => c.id === n.cityId);
                    return (
                      <tr
                        key={n.id}
                        className="hover:bg-slate-50/60 transition"
                      >
                        <td className="px-4 py-3 text-slate-400 text-xs">
                          {n.id}
                        </td>
                        <td
                          className={`px-4 py-3 font-medium text-slate-800 ${isRtl ? "text-right" : ""}`}
                          dir="rtl"
                        >
                          {n.titleAr}
                        </td>
                        <td
                          className={`px-4 py-3 text-slate-600 ${isRtl ? "text-right" : ""}`}
                          dir="ltr"
                        >
                          {n.titleEn}
                        </td>
                        <td
                          className={`px-4 py-3 text-slate-600 ${isRtl ? "text-right" : ""}`}
                        >
                          {city ? (isRtl ? city.titleAr : city.titleEn) : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge active={n.active} t={t} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <EditButton label={t.edit} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div
            className={`mt-4 flex items-center justify-between gap-4 flex-wrap ${isRtl ? "flex-row-reverse" : ""}`}
          >
            <p className="text-xs text-slate-500">
              {t.showing}{" "}
              {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–
              {Math.min(page * PAGE_SIZE, filtered.length)} {t.of}{" "}
              {filtered.length} {t.records}
            </p>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPage={setPage}
              isRtl={isRtl}
            />
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function SettingsSection() {
  const [subView, setSubView] = useState<SubView>("hub");
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "ar";
  const isRtl = language === "ar";
  const t = language === "ar" ? COPY.ar : COPY.en;

  const goHub = () => setSubView("hub");

  if (subView === "regions") {
    return (
      <div className="px-4 py-6 sm:px-6">
        <RegionsPage t={t} isRtl={isRtl} onBack={goHub} />
      </div>
    );
  }

  if (subView === "cities") {
    return (
      <div className="px-4 py-6 sm:px-6">
        <CitiesPage t={t} isRtl={isRtl} onBack={goHub} />
      </div>
    );
  }

  if (subView === "neighborhoods") {
    return (
      <div className="px-4 py-6 sm:px-6">
        <NeighborhoodsPage t={t} isRtl={isRtl} onBack={goHub} />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-6">
      <SettingsHub t={t} isRtl={isRtl} onNavigate={setSubView} />
    </div>
  );
}
