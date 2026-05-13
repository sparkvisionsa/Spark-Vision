"use client";

import { useContext, useEffect, useId, useState } from "react";
import {
  ChevronDown,
  Globe,
  Home,
  LayoutGrid,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Link from "@/components/prefetch-link";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/language-switcher";
import AuthUserMenu from "@/components/auth-user-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const copy = {
  en: {
    home: "Home",
    valueTechApp: "Report Upload System",
    realEstate: "Real Estate Valuation System",
    machines: "Machines Valuation System",
    sources: "Information Sources System",
    assetInventory: "Asset Inventory System",
    assetInspection: "Asset Inspection System",
    products: "Products",
    language: "Language",
  },
  ar: {
    home: "الرئيسية",
    valueTechApp: "نظام رفع التقارير",
    realEstate: "نظام تقييم العقارات",
    machines: "نظام تقييم الآلات",
    sources: "مصادر المعلومات",
    assetInventory: "تطبيق حصر الأصول",
    assetInspection: "تطبيق معاينة الأصول",
    products: "المنتجات",
    language: "اللغة",
  },
} as const;

function ValueTechLogo({ size = 32 }: { size?: number }) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${id}-bg`}
          x1="0"
          y1="0"
          x2="36"
          y2="36"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0d9488" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
        <linearGradient
          id={`${id}-shine`}
          x1="18"
          y1="0"
          x2="18"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" stopOpacity="0.28" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="9" fill={`url(#${id}-bg)`} />
      <rect width="36" height="36" rx="9" fill={`url(#${id}-shine)`} />
      <path
        d="M11.5 11L18 26L24.5 11"
        stroke="white"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 7.5L19.2 9.5L18 11.5L16.8 9.5Z"
        fill="white"
        fillOpacity="0.8"
      />
    </svg>
  );
}

export default function ValueTechServiceNavbar() {
  const router = useRouter();
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "ar";
  const setLanguage = langContext?.setLanguage;
  const isArabic = language === "ar";
  const t = copy[language];
  const pathname = usePathname() || "/";
  const [productsDesktopOpen, setProductsDesktopOpen] = useState(false);
  const [productsMobileOpen, setProductsMobileOpen] = useState(false);

  useEffect(() => {
    setProductsDesktopOpen(false);
    setProductsMobileOpen(false);
  }, [pathname]);

  const isValueTechRoute =
    pathname.startsWith("/value-tech") ||
    pathname.startsWith("/evaluation-source") ||
    pathname.startsWith("/real-estate-valuation") ||
    pathname.startsWith("/machine-valuation") ||
    pathname.startsWith("/asset-inventory") ||
    pathname.startsWith("/asset-inspection") ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/settings");

  const productMenuItems = (close: () => void) => (
    <>
      <DropdownMenuItem
        className="cursor-pointer text-[13px] sm:hidden"
        onSelect={(e) => {
          e.preventDefault();
          close();
          router.push("/value-tech");
        }}
      >
        <span className="flex items-center gap-2">
          <Home className="h-3.5 w-3.5" />
          {t.home}
        </span>
      </DropdownMenuItem>
      <DropdownMenuItem
        className="cursor-pointer text-[13px]"
        onSelect={(e) => {
          e.preventDefault();
          close();
          router.push("/value-tech-app");
        }}
      >
        {t.valueTechApp}
      </DropdownMenuItem>
      <DropdownMenuItem
        className="cursor-pointer text-[13px]"
        onSelect={(e) => {
          e.preventDefault();
          close();
          router.push("/real-estate-valuation");
        }}
      >
        {t.realEstate}
      </DropdownMenuItem>
      <DropdownMenuItem
        className="cursor-pointer text-[13px]"
        onSelect={(e) => {
          e.preventDefault();
          close();
          router.push("/machine-valuation");
        }}
      >
        {t.machines}
      </DropdownMenuItem>
      <DropdownMenuItem
        className="cursor-pointer text-[13px]"
        onSelect={(e) => {
          e.preventDefault();
          close();
          router.push("/evaluation-source");
        }}
      >
        {t.sources}
      </DropdownMenuItem>
      <DropdownMenuItem
        className="cursor-pointer text-[13px]"
        onSelect={(e) => {
          e.preventDefault();
          close();
          router.push("/asset-inventory");
        }}
      >
        {t.assetInventory}
      </DropdownMenuItem>
      <DropdownMenuItem
        className="cursor-pointer text-[13px]"
        onSelect={(e) => {
          e.preventDefault();
          close();
          router.push("/asset-inspection");
        }}
      >
        {t.assetInspection}
      </DropdownMenuItem>
    </>
  );

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
      <div className="container">
        <div className="flex h-14 items-center gap-3">
          {/* Logo + Brand */}
          <Link
            href="/value-tech"
            className="group/logo inline-flex shrink-0 items-center gap-2.5"
          >
            <span className="transition-transform duration-200 group-hover/logo:scale-[1.04]">
              <ValueTechLogo size={32} />
            </span>
            <span className="hidden sm:inline text-[15px] font-semibold tracking-[-0.01em] text-slate-800">
              Value Tech
            </span>
          </Link>

          {/* Divider */}
          <div className="hidden sm:block h-5 w-px shrink-0 bg-slate-200" />

          {/* Home link */}
          <Link
            href="/value-tech"
            className={cn(
              "hidden sm:inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-150",
              pathname === "/value-tech"
                ? "text-teal-700 bg-teal-50/80"
                : "text-slate-500 hover:text-teal-700 hover:bg-teal-50/60",
            )}
          >
            <Home className="h-3.5 w-3.5" />
            {t.home}
          </Link>

          {/* Products navigation */}
          <nav className="flex min-w-0 items-center">
            {/* Desktop */}
            <div className="hidden sm:flex items-center">
              <DropdownMenu
                modal={false}
                open={productsDesktopOpen}
                onOpenChange={setProductsDesktopOpen}
              >
                <DropdownMenuTrigger
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium outline-none transition-colors duration-150",
                    isValueTechRoute
                      ? "text-teal-700 bg-teal-50/80"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {t.products}
                  <ChevronDown className="h-3.5 w-3.5 opacity-40" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align={isArabic ? "end" : "start"}
                  className="min-w-[210px]"
                >
                  {productMenuItems(() => setProductsDesktopOpen(false))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile */}
            <div className="flex sm:hidden">
              <DropdownMenu
                modal={false}
                open={productsMobileOpen}
                onOpenChange={setProductsMobileOpen}
              >
                <DropdownMenuTrigger
                  aria-label={t.products}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 outline-none transition-colors duration-150 hover:text-slate-700 hover:bg-slate-100/70"
                >
                  <LayoutGrid className="h-[18px] w-[18px]" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isArabic ? "end" : "start"}>
                  {productMenuItems(() => setProductsMobileOpen(false))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </nav>

          {/* Spacer */}
          <div className="flex-1 min-w-0" />

          {/* Right-side actions */}
          <div className="flex items-center gap-1">
            {/* Desktop: language + auth */}
            <div className="hidden sm:flex items-center gap-0.5">
              <LanguageSwitcher />
              <AuthUserMenu />
            </div>

            {/* Mobile: language icon */}
            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t.language}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 outline-none transition-colors duration-150 hover:text-slate-700 hover:bg-slate-100/70"
                >
                  <Globe className="h-[18px] w-[18px]" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isArabic ? "end" : "start"}>
                  <DropdownMenuItem
                    onClick={() => setLanguage?.("ar")}
                    className={cn("text-[13px]", language === "ar" && "font-semibold")}
                  >
                    العربية
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLanguage?.("en")}
                    className={cn("text-[13px]", language === "en" && "font-semibold")}
                  >
                    English
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile: auth */}
            <div className="sm:hidden">
              <AuthUserMenu />
            </div>

          </div>
        </div>
      </div>
    </header>
  );
}
