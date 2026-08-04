"use client";

import { useContext, useEffect, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ChevronDown,
  Globe,
  Home,
  LayoutGrid,
  Package,
  UserCircle,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Link from "@/components/prefetch-link";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";
import AuthUserMenu from "@/components/auth-user-menu";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const copy = {
  en: {
    brandName: "فاليو تك",
    brandSubtitle: "Value Tech",
    home: "Home",
    sparkHome: "Spark Vision Home",
    machines: "Machines & Equipment Valuation System",
    realEstate: "Real Estate Valuation System",
    reports: "Report Upload System",
    sources: "Information Sources System",
    inventory: "Asset Inventory System",
    inspection: "Asset Inspection System",
    products: "Products",
    language: "Language",
    login: "Login",
  },
  ar: {
    brandName: "فاليو تك",
    brandSubtitle: "حلول تقييم الأصول",
    home: "الرئيسية",
    sparkHome: "العودة إلى سبارك فيجن",
    machines: "نظام تقييم الآلات والمعدات",
    realEstate: "نظام تقييم العقارات",
    reports: "نظام رفع التقارير",
    sources: "نظام مصادر المعلومات",
    inventory: "نظام حصر الأصول",
    inspection: "نظام معاينة الأصول",
    products: "المنتجات",
    language: "اللغة",
    login: "تسجيل الدخول",
  },
} as const;

function HubLanguageSwitcher() {
  const langContext = useContext(LanguageContext);
  if (!langContext) return null;

  const { language, setLanguage } = langContext;

  return (
    <div className="vt-hub-lang-switch" role="group" aria-label="Language">
      <button
        type="button"
        className={cn("vt-hub-lang-btn", language === "ar" && "vt-hub-lang-btn--active")}
        onClick={() => setLanguage("ar")}
      >
        AR
      </button>
      <button
        type="button"
        className={cn("vt-hub-lang-btn", language === "en" && "vt-hub-lang-btn--active")}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
    </div>
  );
}

function HubAuthPill() {
  const { user, loading } = useAuthTracking();
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "ar";
  const t = copy[language];

  const openAuth = () => {
    window.dispatchEvent(new CustomEvent("sv:open-auth-modal") as Event);
  };

  const hubTriggerClass =
    "vt-hub-user-pill h-auto shadow-none";

  if (loading) {
    return <div className="h-8 w-24 animate-pulse rounded-full bg-[rgba(232,184,90,0.12)]" />;
  }

  if (!user) {
    return (
      <button type="button" onClick={openAuth} className="vt-hub-user-pill">
        <UserCircle className="h-4 w-4 text-[#f5cd7b]" aria-hidden />
        <span>{t.login}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
      </button>
    );
  }

  return <AuthUserMenu triggerClassName={hubTriggerClass} />;
}

function HubBrandLink({ isArabic }: { isArabic: boolean }) {
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "ar";
  const t = copy[language];

  return (
    <Link
      href="/value-tech"
      className="vt-hub-brand group/logo shrink-0 outline-none transition focus-visible:ring-2 focus-visible:ring-[#c9963a]/40"
      aria-label={t.brandName}
    >
      <span className="vt-hub-brand-logo">
        <Image
          src="/value-tech-icon.png"
          alt=""
          width={80}
          height={80}
          quality={100}
          priority
          sizes="40px"
          className="h-[2rem] w-[2rem] object-contain sm:h-[2.15rem] sm:w-[2.15rem] transition-transform duration-200 group-hover/logo:scale-[1.04]"
          aria-hidden
        />
      </span>
      <span className={cn("vt-hub-brand-copy", isArabic && "text-right")}>
        <span className="vt-hub-brand-title">{t.brandName}</span>
        <span className="vt-hub-brand-subtitle">{t.brandSubtitle}</span>
      </span>
    </Link>
  );
}

function HubNavbar() {
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

  const productRoutes = [
    { href: "/machine-valuation", label: t.machines },
    { href: "/real-estate-valuation", label: t.realEstate },
    { href: "/value-tech-app", label: t.reports },
    { href: "/evaluation-source", label: t.sources },
    { href: "/asset-inventory", label: t.inventory },
    { href: "/asset-inspection", label: t.inspection },
  ];

  const isHubHome = pathname === "/value-tech";
  const isProductsSection = productRoutes.some(
    ({ href }) => pathname === href || pathname.startsWith(`${href}/`),
  );

  const productMenuItems = (close: () => void) => (
    <>
      {productRoutes.map((product) => (
        <DropdownMenuItem
          key={product.href}
          className="cursor-pointer text-[13px] text-[#f5cd7b] focus:bg-[rgba(232,184,90,0.12)] focus:text-[#fff8eb]"
          onSelect={(e) => {
            e.preventDefault();
            close();
            router.push(product.href);
          }}
        >
          {product.label}
        </DropdownMenuItem>
      ))}
    </>
  );

  const hubProductsMenuClass =
    "z-[120] min-w-[230px] rounded-xl border border-[rgba(232,184,90,0.32)] bg-[linear-gradient(155deg,#122a4a_0%,#0f2240_52%,#0a1628_100%)] p-1 text-[#f5cd7b] shadow-xl shadow-black/30";

  return (
    <header className="vt-hub-navbar-shell">
      <div className="vt-hub-navbar" dir={isArabic ? "rtl" : "ltr"}>
        <HubBrandLink isArabic={isArabic} />

        <nav className="flex min-w-0 flex-1 items-center justify-center gap-1">
          <Link href="/" className="vt-hub-nav-link hidden sm:inline-flex">
            <ArrowLeft className={cn("h-3.5 w-3.5", !isArabic && "rotate-180")} aria-hidden />
            {t.sparkHome}
          </Link>

          <Link
            href="/value-tech"
            className={cn("vt-hub-nav-link", isHubHome && "vt-hub-nav-link--active")}
          >
            <Home className="h-3.5 w-3.5" aria-hidden />
            {t.home}
          </Link>

          <DropdownMenu
            modal={false}
            open={productsDesktopOpen}
            onOpenChange={setProductsDesktopOpen}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "vt-hub-nav-link outline-none",
                  isProductsSection && "vt-hub-nav-link--active",
                )}
              >
                <Package className="h-3.5 w-3.5" aria-hidden />
                {t.products}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" sideOffset={8} className={hubProductsMenuClass}>
              {productMenuItems(() => setProductsDesktopOpen(false))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="hidden sm:block">
          <HubLanguageSwitcher />
        </div>

        <div className="hidden min-w-0 sm:block">
          <HubAuthPill />
        </div>

        <div className="flex items-center gap-1 sm:hidden">
          <Link
            href="/"
            aria-label={t.sparkHome}
            title={t.sparkHome}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#f5cd7b] outline-none transition hover:bg-[rgba(232,184,90,0.12)]"
          >
            <ArrowLeft className={cn("h-[18px] w-[18px]", !isArabic && "rotate-180")} aria-hidden />
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t.language}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#f5cd7b] outline-none transition hover:bg-[rgba(232,184,90,0.12)]"
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

          <DropdownMenu
            modal={false}
            open={productsMobileOpen}
            onOpenChange={setProductsMobileOpen}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={t.products}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#f5cd7b] outline-none transition hover:bg-[rgba(232,184,90,0.12)]"
              >
                <LayoutGrid className="h-[18px] w-[18px]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={isArabic ? "end" : "start"}
              sideOffset={8}
              className={hubProductsMenuClass}
            >
              <DropdownMenuItem
                className="cursor-pointer text-[13px] text-[#f5cd7b] focus:bg-[rgba(232,184,90,0.12)] focus:text-[#fff8eb]"
                onSelect={(e) => {
                  e.preventDefault();
                  setProductsMobileOpen(false);
                  router.push("/value-tech");
                }}
              >
                <span className="flex items-center gap-2">
                  <Home className="h-3.5 w-3.5" />
                  {t.home}
                </span>
              </DropdownMenuItem>
              {productMenuItems(() => setProductsMobileOpen(false))}
            </DropdownMenuContent>
          </DropdownMenu>

          <HubAuthPill />
        </div>
      </div>
    </header>
  );
}

function DefaultNavbar() {
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

  const productRoutes = [
    { href: "/machine-valuation", label: t.machines },
    { href: "/real-estate-valuation", label: t.realEstate },
    { href: "/value-tech-app", label: t.reports },
    { href: "/evaluation-source", label: t.sources },
    { href: "/asset-inventory", label: t.inventory },
    { href: "/asset-inspection", label: t.inspection },
  ];

  const isValueTechRoute =
    pathname.startsWith("/value-tech") ||
    productRoutes.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`)) ||
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
      {productRoutes.map((product) => (
        <DropdownMenuItem
          key={product.href}
          className="cursor-pointer text-[13px]"
          onSelect={(e) => {
            e.preventDefault();
            close();
            router.push(product.href);
          }}
        >
          {product.label}
        </DropdownMenuItem>
      ))}
    </>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/70 bg-white/[0.82] text-slate-900 shadow-[0_1px_0_rgba(15,23,42,0.03),0_12px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/[0.72]">
      <div className="mx-auto w-full max-w-[1680px] px-3 sm:px-5">
        <div className="flex h-14 items-center gap-3">
          <Link
            href="/value-tech"
            className="group/logo inline-flex shrink-0 items-center gap-2.5 rounded-lg px-1.5 py-1 outline-none transition focus-visible:ring-2 focus-visible:ring-cyan-400/40"
          >
            <Image
              src="/value-tech-icon.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 transition-transform duration-200 group-hover/logo:scale-[1.04]"
              aria-hidden
            />
            <span className="hidden text-[15px] font-semibold text-slate-900 sm:inline">
              Value Tech
            </span>
          </Link>

          <div className="hidden h-5 w-px shrink-0 bg-slate-200 sm:block" />

          <Link
            href="/value-tech"
            className={cn(
              "hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors duration-150 sm:inline-flex",
              pathname === "/value-tech"
                ? "bg-slate-950 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
            )}
          >
            <Home className="h-3.5 w-3.5" />
            {t.home}
          </Link>

          <nav className="flex min-w-0 items-center">
            <div className="hidden sm:flex items-center">
              <DropdownMenu
                modal={false}
                open={productsDesktopOpen}
                onOpenChange={setProductsDesktopOpen}
              >
                <DropdownMenuTrigger
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold outline-none transition-colors duration-150",
                    isValueTechRoute
                      ? "bg-slate-950 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                  )}
                >
                  {t.products}
                  <ChevronDown className="h-3.5 w-3.5 opacity-40" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align={isArabic ? "end" : "start"}
                  className="min-w-[230px] rounded-lg border-slate-200 p-1 shadow-xl shadow-slate-950/10"
                >
                  {productMenuItems(() => setProductsDesktopOpen(false))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex sm:hidden">
              <DropdownMenu
                modal={false}
                open={productsMobileOpen}
                onOpenChange={setProductsMobileOpen}
              >
                <DropdownMenuTrigger
                  aria-label={t.products}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 outline-none transition-colors duration-150 hover:bg-slate-100 hover:text-slate-950"
                >
                  <LayoutGrid className="h-[18px] w-[18px]" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isArabic ? "end" : "start"}>
                  {productMenuItems(() => setProductsMobileOpen(false))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </nav>

          <div className="flex-1 min-w-0" />

          <div className="flex items-center gap-1">
            <div className="hidden items-center gap-1 sm:flex">
              <div className="flex items-center rounded-full border p-1 text-sm">
                <button
                  type="button"
                  className={cn(
                    "rounded-full h-7 px-3 text-sm transition",
                    language === "en" && "bg-muted text-foreground",
                  )}
                  onClick={() => setLanguage?.("en")}
                >
                  EN
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-full h-7 px-3 text-sm transition",
                    language === "ar" && "bg-muted text-foreground",
                  )}
                  onClick={() => setLanguage?.("ar")}
                >
                  AR
                </button>
              </div>
              <AuthUserMenu />
            </div>

            <div className="sm:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={t.language}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 outline-none transition-colors duration-150 hover:bg-slate-100 hover:text-slate-950"
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

            <div className="sm:hidden">
              <AuthUserMenu />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function ValueTechServiceNavbar({
  variant = "default",
}: {
  variant?: "default" | "hub";
}) {
  if (variant === "hub") {
    return <HubNavbar />;
  }

  return <DefaultNavbar />;
}
