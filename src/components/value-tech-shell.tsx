"use client";

import { useContext, useEffect } from "react";
import Link from "@/components/prefetch-link";
import { useRouter } from "next/navigation";
import MachineValuationShell from "@/components/machine-valuation-shell";
import ValueTechServiceNavbar from "@/components/value-tech-service-navbar";
import ValueTechServiceFooter from "@/components/value-tech-service-footer";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  ClipboardList,
  Cpu,
  LayoutGrid,
  Library,
  Search,
  Settings,
  Users,
  Building,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LanguageContext } from "@/components/layout-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";

function openAuthModal() {
  window.dispatchEvent(new CustomEvent("sv:open-auth-modal") as Event);
}

function userInitials(username: string) {
  const trimmed = username.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0]?.[0] ?? "";
    const b = parts[1]?.[0] ?? "";
    return (a + b).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

const copy = {
  en: {
    sidebarUserGuest: "Guest",
    sidebarUserSubtitle: "Sign in to sync your workspace and save progress.",
    sidebarSignIn: "Sign in",
    sidebarRegister: "Register",
    sidebarOpenProfile: "Open profile",
    sidebarAccountMember: "Signed in",
    sidebarSectionTitle: "Value Tech Products",
    sidebarRealEstate: "Real Estate Valuation System",
    sidebarMachines: "Machines Valuation System",
    sidebarSources: "Information Sources System",
    sidebarApp: "Report Upload System",
    sidebarAssetInventory: "Asset Inventory System",
    sidebarAssetInspection: "Asset Inspection System",
    sidebarClients: "Clients",
    sidebarSettings: "Settings",
    sidebarCompany: "Company Directory",
    backToProducts: "Back to Products",
  },
  ar: {
    sidebarUserGuest: "ضيف",
    sidebarUserSubtitle: "سجّل الدخول لربط حسابك ومزامنة مساحة العمل.",
    sidebarSignIn: "تسجيل الدخول",
    sidebarRegister: "إنشاء حساب",
    sidebarOpenProfile: "الملف الشخصي",
    sidebarAccountMember: "مسجّل الدخول",
    sidebarSectionTitle: "منتجات فاليو تك",
    sidebarRealEstate: "نظام تقييم العقارات",
    sidebarMachines: "نظام تقييم الآلات",
    sidebarSources: "مصادر المعلومات",
    sidebarApp: "نظام رفع التقارير",
    sidebarAssetInventory: "تطبيق حصر الأصول",
    sidebarAssetInspection: "تطبيق معاينة الأصول",
    sidebarClients: "العملاء",
    sidebarSettings: "الإعدادات",
    sidebarCompany: "دليل الشركة",
    backToProducts: "العودة إلى المنتجات",
  },
} as const;

const VALUE_TECH_SIDEBAR_ROUTES = [
  "/value-tech",
  "/value-tech-app",
  "/real-estate-valuation",
  "/machine-valuation",
  "/asset-inventory",
  "/asset-inspection",
  "/evaluation-source",
  "/clients",
  "/settings",
  "/company",
] as const;

type ValueTechCopy = (typeof copy)["en"] | (typeof copy)["ar"];

interface ProductRoute {
  href: string;
  labelKey: keyof ValueTechCopy;
  icon: React.ElementType;
  iconColor: string;
}

const PRODUCT_ROUTES: ProductRoute[] = [
  {
    href: "/real-estate-valuation",
    labelKey: "sidebarRealEstate",
    icon: Building2,
    iconColor: "text-emerald-600",
  },
  {
    href: "/machine-valuation",
    labelKey: "sidebarMachines",
    icon: Cpu,
    iconColor: "text-sky-600",
  },
  {
    href: "/evaluation-source",
    labelKey: "sidebarSources",
    icon: Library,
    iconColor: "text-cyan-600",
  },
  {
    href: "/value-tech-app",
    labelKey: "sidebarApp",
    icon: LayoutGrid,
    iconColor: "text-amber-600",
  },
  {
    href: "/asset-inventory",
    labelKey: "sidebarAssetInventory",
    icon: ClipboardList,
    iconColor: "text-violet-600",
  },
  {
    href: "/asset-inspection",
    labelKey: "sidebarAssetInspection",
    icon: Search,
    iconColor: "text-orange-600",
  },
];

/**
 * Dark, floating sidebar theme (matches machine-valuation-shell) — used only
 * when `dark` is true (i.e. on /real-estate-valuation). Other product pages
 * keep the existing light sidebar look untouched.
 */
function ValueTechSidebarAccount({
  isArabic,
  t,
  dark = false,
}: {
  isArabic: boolean;
  t: ValueTechCopy;
  dark?: boolean;
}) {
  const { user, profile, loading } = useAuthTracking();
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";

  const ringFocus = dark
    ? "outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
    : "outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

  if (loading) {
    return (
      <div
        className={cn("flex items-center gap-3", collapsed && "justify-center")}
        aria-busy="true"
        aria-label="Loading account"
      >
        <div
          className={cn(
            "h-10 w-10 shrink-0 animate-pulse rounded-full",
            dark ? "bg-white/10" : "bg-slate-900/20",
          )}
        />
        {!collapsed ? (
          <div className="min-w-0 flex-1 space-y-2">
            <div
              className={cn(
                "h-3.5 w-28 max-w-full animate-pulse rounded",
                dark ? "bg-white/10" : "bg-slate-900/20",
              )}
            />
            <div
              className={cn(
                "h-2.5 w-full max-w-[11rem] animate-pulse rounded",
                dark ? "bg-white/5" : "bg-slate-900/15",
              )}
            />
          </div>
        ) : null}
      </div>
    );
  }

  if (user) {
    const displayName = user.phone?.trim() || user.username;
    const emailHint =
      profile?.email?.trim() || user.email?.trim() || t.sidebarAccountMember;

    const avatar = (
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          "text-sm font-semibold tracking-tight",
          dark
            ? "bg-white/10 text-white"
            : "bg-slate-900/15 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
        )}
        aria-hidden
      >
        {userInitials(displayName)}
      </div>
    );

    if (collapsed) {
      return (
        <Link
          href="/profile"
          title={`${displayName} — ${t.sidebarOpenProfile}`}
          className={cn(
            "flex justify-center rounded-lg p-0.5 transition",
            dark
              ? "hover:bg-white/10 active:bg-white/15"
              : "hover:bg-slate-900/12 active:bg-slate-900/18",
            ringFocus,
          )}
        >
          {avatar}
        </Link>
      );
    }

    return (
      <Link
        href="/profile"
        className={cn(
          "group/account flex items-center gap-3 rounded-lg px-1 py-0.5 -mx-1 transition",
          dark
            ? "hover:bg-white/10 active:bg-white/15"
            : "hover:bg-slate-900/12 active:bg-slate-900/18",
          ringFocus,
        )}
      >
        {avatar}
        <div
          className={cn(
            "min-w-0 flex-1",
            isArabic ? "text-right" : "text-left",
          )}
        >
          <p
            className={cn(
              "text-sm font-semibold leading-tight truncate",
              dark ? "text-white" : "text-slate-900",
            )}
          >
            {displayName}
          </p>
          <p
            className={cn(
              "mt-0.5 text-[11px] leading-snug truncate",
              dark ? "text-slate-400" : "text-slate-900/75",
            )}
          >
            {emailHint}
          </p>
          <p
            className={cn(
              "mt-1 text-[10px] font-medium",
              dark
                ? "text-cyan-200/80 group-hover/account:text-white"
                : "text-slate-900/50 group-hover/account:text-slate-900/70",
            )}
          >
            {t.sidebarOpenProfile}
          </p>
        </div>
      </Link>
    );
  }

  const guestAvatar = (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold",
        dark ? "bg-white/10 text-slate-200" : "bg-slate-900/12 text-slate-900",
      )}
      aria-hidden
    >
      {t.sidebarUserGuest.charAt(0)}
    </div>
  );

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal()}
        title={`${t.sidebarSignIn} · ${t.sidebarUserGuest}`}
        className={cn(
          "flex w-full justify-center rounded-lg p-0.5 transition",
          dark
            ? "hover:bg-white/10 active:bg-white/15"
            : "hover:bg-slate-900/12 active:bg-slate-900/18",
          ringFocus,
        )}
      >
        {guestAvatar}
      </button>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 pt-0.5">{guestAvatar}</div>
      <div
        className={cn("min-w-0 flex-1", isArabic ? "text-right" : "text-left")}
      >
        <p
          className={cn(
            "text-sm font-semibold",
            dark ? "text-white" : "text-slate-900",
          )}
        >
          {t.sidebarUserGuest}
        </p>
        <p
          className={cn(
            "mt-0.5 text-[11px] leading-snug",
            dark ? "text-slate-400" : "text-slate-900/80",
          )}
        >
          {t.sidebarUserSubtitle}
        </p>
        <div
          className={cn(
            "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold",
            isArabic && "flex-row-reverse justify-end",
          )}
        >
          <button
            type="button"
            onClick={() => openAuthModal()}
            className={cn(
              "rounded px-0 py-0.5 underline-offset-2 transition hover:underline",
              dark ? "text-cyan-200/90 hover:text-white" : "text-slate-900",
              ringFocus,
            )}
          >
            {t.sidebarSignIn}
          </button>
        </div>
      </div>
    </div>
  );
}

function ValueTechSidebarWorkspace({
  children,
  fullWidth,
}: {
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  const { state, isMobile } = useSidebar();
  const sidebarCollapsed = !isMobile && state === "collapsed";

  return (
    <SidebarInset
      className={cn(
        "min-w-0 overflow-x-hidden px-3 pt-5 pb-8 md:pt-6 md:pb-10",
        sidebarCollapsed ? "md:px-3 lg:px-4" : "md:px-5",
      )}
    >
      <main
        className={cn(
          "mx-auto flex w-full min-w-0 flex-col gap-4 md:gap-5 min-h-[60vh] overflow-x-hidden",
          sidebarCollapsed || fullWidth ? "max-w-none" : "max-w-6xl",
        )}
      >
        <div className="mb-2 flex items-center justify-between md:hidden">
          <SidebarTrigger className="rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:bg-slate-100" />
        </div>
        {children}
      </main>
    </SidebarInset>
  );
}

function SidebarToggleArrow({ isArabic }: { isArabic: boolean }) {
  const { toggleSidebar, state } = useSidebar();
  const isExpanded = state === "expanded";
  const shouldRotate = isExpanded === isArabic;

  return (
    <div
      className="fixed top-1/2 -translate-y-1/2 z-20 hidden md:block pointer-events-none"
      style={{
        [isArabic ? "right" : "left"]: isExpanded
          ? "var(--sidebar-width)"
          : "calc(var(--sidebar-width-icon) + 1rem)",
        transition: `${isArabic ? "right" : "left"} 200ms linear`,
      }}
    >
      <button
        onClick={toggleSidebar}
        aria-label="Toggle Sidebar"
        className={cn(
          "pointer-events-auto cursor-pointer",
          "flex items-center justify-center",
          "h-8 w-8 rounded-full",
          isArabic ? "translate-x-1/2" : "-translate-x-1/2",
          "bg-slate-900/95 backdrop-blur-sm",
          "border border-slate-700/50",
          "text-cyan-400",
          "shadow-[0_2px_10px_rgba(0,0,0,0.35)]",
          "hover:border-cyan-400/40 hover:text-cyan-300",
          "hover:shadow-[0_0_16px_rgba(34,211,238,0.18),0_2px_10px_rgba(0,0,0,0.35)]",
          "hover:scale-110",
          "active:scale-90",
          "transition-all duration-200 ease-out",
        )}
      >
        <ChevronLeft
          className={cn(
            "h-4 w-4 transition-transform duration-300 ease-out",
            shouldRotate && "rotate-180",
          )}
        />
      </button>
    </div>
  );
}

export default function ValueTechShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const langContext = useContext(LanguageContext);
  const router = useRouter();
  const pathname = usePathname() || "/";

  const isRealEstateValuationPage =
    pathname === "/real-estate-valuation" ||
    pathname.startsWith("/real-estate-valuation/");

  useEffect(() => {
    const timeouts: number[] = [];
    const gap = process.env.NODE_ENV === "development" ? 75 : 120;
    VALUE_TECH_SIDEBAR_ROUTES.forEach((route, i) => {
      timeouts.push(
        window.setTimeout(() => void router.prefetch(route), i * gap),
      );
    });
    return () => timeouts.forEach((id) => window.clearTimeout(id));
  }, [router]);

  const isHubPage = pathname === "/value-tech";

  useEffect(() => {
    if (!isHubPage) return;

    document.documentElement.classList.add("vt-products-hub-active");
    document.body.classList.add("vt-products-hub-active");

    return () => {
      document.documentElement.classList.remove("vt-products-hub-active");
      document.body.classList.remove("vt-products-hub-active");
    };
  }, [isHubPage]);

  if (!langContext) return null;

  const isArabic = langContext.language === "ar";
  const t = isArabic ? copy.ar : copy.en;

  const isMachineValuationPage =
    pathname === "/machine-valuation" ||
    pathname.startsWith("/machine-valuation/");

  const currentProduct = PRODUCT_ROUTES.find((r) =>
    r.href === "/evaluation-source"
      ? pathname === "/evaluation-source" ||
        pathname.startsWith("/evaluation-source/")
      : pathname === r.href || pathname.startsWith(r.href + "/"),
  );

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  // Dark theme only applies to the real-estate-valuation route; every other
  // product page keeps the existing light sidebar styling.
  const dark = isRealEstateValuationPage;

  const activeClass = dark
    ? "bg-white text-slate-950 shadow-[0_10px_24px_rgba(8,47,73,0.22)] font-semibold"
    : "bg-slate-900/5 text-black font-semibold shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]";
  const idleClass = dark
    ? "text-slate-300 hover:bg-white/10 hover:text-white"
    : "text-slate-800 hover:text-black hover:bg-slate-900/5";
  const backLinkClass = dark
    ? "text-slate-300 hover:bg-white/10 hover:text-white"
    : "text-slate-700 hover:text-black hover:bg-slate-900/5";
  const groupLabelClass = dark
    ? "text-xs font-semibold uppercase tracking-wide text-slate-500"
    : "text-xs font-semibold uppercase tracking-wide text-slate-500";
  const separatorClass = dark ? "bg-white/10" : "bg-slate-200";

  if (isHubPage) {
    return (
      <div className="vt-products-screen min-w-0">
        <ValueTechServiceNavbar variant="hub" />
        <div className="vt-products-body">
          <main className="vt-products-main">
            <div className="mx-auto w-full max-w-6xl min-w-0">{children}</div>
          </main>
          <ValueTechServiceFooter variant="hub" />
        </div>
      </div>
    );
  }

  if (isMachineValuationPage) {
    return <MachineValuationShell>{children}</MachineValuationShell>;
  }

  return (
    <div
      className={cn(
        "min-h-screen min-w-0 overflow-x-hidden flex flex-col pt-14",
        dark
          ? "bg-[linear-gradient(135deg,#eef4f8_0%,#f8fafc_48%,#eef7f2_100%)] text-slate-900"
          : "bg-gradient-to-br from-slate-50 via-sky-50/40 to-emerald-50 text-slate-900",
      )}
    >
      <ValueTechServiceNavbar />

      <SidebarProvider
        className={cn(
          "flex-1",
          dark &&
            cn(
              "[--sidebar-background:217_45%_11%] [--sidebar-foreground:210_40%_96%]",
              "[--sidebar-accent:215_28%_18%] [--sidebar-accent-foreground:210_40%_98%]",
              "[--sidebar-border:214_32%_22%] [--sidebar-ring:188_86%_53%]",
            ),
        )}
      >
        <Sidebar
          side={isArabic ? "right" : "left"}
          variant="floating"
          collapsible="icon"
          className={cn(
            "top-14",
            dark
              ? "z-20 border-0 bg-transparent text-slate-100 shadow-none"
              : "bg-white text-black border border-slate-200/80 shadow-2xl shadow-slate-900/5",
          )}
        >
          <SidebarHeader
            className={cn(
              "rounded-lg m-2 px-3 py-2.5",
              dark
                ? "border border-white/10 bg-slate-950"
                : "border-b border-slate-200 bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 py-3",
            )}
          >
            <ValueTechSidebarAccount isArabic={isArabic} t={t} dark={dark} />
          </SidebarHeader>

          <SidebarContent className="pt-1">
            {/* Back to products */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild className={backLinkClass}>
                      <Link
                        href="/value-tech#products"
                        className="flex items-center gap-2"
                      >
                        <ArrowLeft
                          className={cn(
                            "h-4 w-4",
                            dark ? "text-cyan-300" : "text-cyan-600",
                            isArabic && "rotate-180",
                          )}
                        />
                        <span className="text-[13px] font-medium">
                          {t.backToProducts}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator className={separatorClass} />

            {/* Current product */}
            <SidebarGroup>
              <SidebarGroupLabel className={groupLabelClass}>
                {t.sidebarSectionTitle}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {currentProduct && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive
                        className={activeClass}
                      >
                        <Link
                          href={currentProduct.href}
                          className="flex items-center gap-2"
                        >
                          <currentProduct.icon
                            className={cn("h-4 w-4", currentProduct.iconColor)}
                          />
                          <span className={dark ? undefined : "text-black"}>
                            {t[currentProduct.labelKey]}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  <SidebarSeparator className={cn("my-2", separatorClass)} />

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/clients")}
                      className={isActive("/clients") ? activeClass : idleClass}
                    >
                      <Link href="/clients" className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-fuchsia-600" />
                        <span className={dark ? undefined : "text-black"}>
                          {t.sidebarClients}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/settings")}
                      className={
                        isActive("/settings") ? activeClass : idleClass
                      }
                    >
                      <Link
                        href="/settings"
                        className="flex items-center gap-2"
                      >
                        <Settings className="h-4 w-4 text-slate-600" />
                        <span className={dark ? undefined : "text-black"}>
                          {t.sidebarSettings}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* Company link added here explicitly alongside Clients and Settings */}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/company")}
                      className={isActive("/company") ? activeClass : idleClass}
                    >
                      <Link href="/company" className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-blue-600" />
                        <span className={dark ? undefined : "text-black"}>
                          {t.sidebarCompany}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarToggleArrow isArabic={isArabic} />

        <ValueTechSidebarWorkspace fullWidth={isRealEstateValuationPage}>
          {children}
        </ValueTechSidebarWorkspace>
      </SidebarProvider>
      <ValueTechServiceFooter />
    </div>
  );
}
