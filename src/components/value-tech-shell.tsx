"use client";

import { useContext, useEffect } from "react";
import Link from "@/components/prefetch-link";
import { useRouter } from "next/navigation";
import ValueTechServiceNavbar from "@/components/value-tech-service-navbar";
import ValueTechServiceFooter from "@/components/value-tech-service-footer";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { ArrowLeft, Building2, ChevronLeft, ClipboardList, Cpu, LayoutGrid, Library, Search, Settings, Users } from "lucide-react";
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

function openAuthModal(mode: "login" | "register") {
  window.dispatchEvent(
    new CustomEvent("sv:open-auth-modal", { detail: { mode } }) as Event,
  );
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
] as const;

type ValueTechCopy = (typeof copy)["en"] | (typeof copy)["ar"];

interface ProductRoute {
  href: string;
  labelKey: keyof ValueTechCopy;
  icon: React.ElementType;
  iconColor: string;
}

const PRODUCT_ROUTES: ProductRoute[] = [
  { href: "/real-estate-valuation", labelKey: "sidebarRealEstate", icon: Building2, iconColor: "text-emerald-300" },
  { href: "/machine-valuation", labelKey: "sidebarMachines", icon: Cpu, iconColor: "text-sky-300" },
  { href: "/evaluation-source", labelKey: "sidebarSources", icon: Library, iconColor: "text-cyan-300" },
  { href: "/value-tech-app", labelKey: "sidebarApp", icon: LayoutGrid, iconColor: "text-amber-300" },
  { href: "/asset-inventory", labelKey: "sidebarAssetInventory", icon: ClipboardList, iconColor: "text-violet-300" },
  { href: "/asset-inspection", labelKey: "sidebarAssetInspection", icon: Search, iconColor: "text-orange-300" },
];

function ValueTechSidebarAccount({
  isArabic,
  t,
}: {
  isArabic: boolean;
  t: ValueTechCopy;
}) {
  const { user, profile, loading } = useAuthTracking();
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";

  const ringFocus =
    "outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

  if (loading) {
    return (
      <div
        className={cn("flex items-center gap-3", collapsed && "justify-center")}
        aria-busy="true"
        aria-label="Loading account"
      >
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-900/20" />
        {!collapsed ? (
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-28 max-w-full animate-pulse rounded bg-slate-900/20" />
            <div className="h-2.5 w-full max-w-[11rem] animate-pulse rounded bg-slate-900/15" />
          </div>
        ) : null}
      </div>
    );
  }

  if (user) {
    const emailHint =
      profile?.email?.trim() || user.email?.trim() || t.sidebarAccountMember;

    const avatar = (
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          "bg-slate-900/15 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
          "text-sm font-semibold tracking-tight",
        )}
        aria-hidden
      >
        {userInitials(user.username)}
      </div>
    );

    if (collapsed) {
      return (
        <Link
          href="/profile"
          title={`${user.username} — ${t.sidebarOpenProfile}`}
          className={cn(
            "flex justify-center rounded-lg p-0.5 transition hover:bg-slate-900/12 active:bg-slate-900/18",
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
          "hover:bg-slate-900/12 active:bg-slate-900/18",
          ringFocus,
        )}
      >
        {avatar}
        <div className={cn("min-w-0 flex-1", isArabic ? "text-right" : "text-left")}>
          <p className="text-sm font-semibold leading-tight text-slate-900 truncate">
            {user.username}
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-900/75 truncate">
            {emailHint}
          </p>
          <p className="mt-1 text-[10px] font-medium text-slate-900/50 group-hover/account:text-slate-900/70">
            {t.sidebarOpenProfile}
          </p>
        </div>
      </Link>
    );
  }

  const guestAvatar = (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
        "bg-slate-900/12 text-slate-900 font-semibold",
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
        onClick={() => openAuthModal("register")}
        title={`${t.sidebarRegister} · ${t.sidebarUserGuest}`}
        className={cn(
          "flex w-full justify-center rounded-lg p-0.5 transition",
          "hover:bg-slate-900/12 active:bg-slate-900/18",
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
      <div className={cn("min-w-0 flex-1", isArabic ? "text-right" : "text-left")}>
        <p className="text-sm font-semibold text-slate-900">{t.sidebarUserGuest}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-slate-900/80">
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
            onClick={() => openAuthModal("login")}
            className={cn(
              "rounded px-0 py-0.5 text-slate-900/85 underline-offset-2 transition",
              "hover:text-slate-900 hover:underline",
              ringFocus,
            )}
          >
            {t.sidebarSignIn}
          </button>
          <span className="select-none text-slate-900/35" aria-hidden>
            ·
          </span>
          <button
            type="button"
            onClick={() => openAuthModal("register")}
            className={cn(
              "rounded px-0 py-0.5 text-slate-900 underline-offset-2 transition",
              "hover:underline",
              ringFocus,
            )}
          >
            {t.sidebarRegister}
          </button>
        </div>
      </div>
    </div>
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

export default function ValueTechShell({ children }: { children: React.ReactNode }) {
  const langContext = useContext(LanguageContext);
  const router = useRouter();
  const pathname = usePathname() || "/";

  useEffect(() => {
    const timeouts: number[] = [];
    const gap = process.env.NODE_ENV === "development" ? 75 : 120;
    VALUE_TECH_SIDEBAR_ROUTES.forEach((route, i) => {
      timeouts.push(window.setTimeout(() => void router.prefetch(route), i * gap));
    });
    return () => timeouts.forEach((id) => window.clearTimeout(id));
  }, [router]);

  if (!langContext) return null;

  const isArabic = langContext.language === "ar";
  const t = isArabic ? copy.ar : copy.en;

  const isHubPage = pathname === "/value-tech";

  const currentProduct = PRODUCT_ROUTES.find((r) =>
    r.href === "/evaluation-source"
      ? pathname === "/evaluation-source" || pathname.startsWith("/evaluation-source/")
      : pathname === r.href || pathname.startsWith(r.href + "/"),
  );

  const isActive = (href: string) => pathname === href;
  const activeClass =
    "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]";
  const idleClass = "text-slate-200/90";

  if (isHubPage) {
    return (
      <div className="min-h-screen min-w-0 overflow-x-hidden bg-gradient-to-br from-slate-50 via-sky-50/40 to-emerald-50 text-slate-900 flex flex-col pt-14">
        <ValueTechServiceNavbar />
        <div className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 md:gap-8 min-h-[60vh] overflow-x-hidden">
            {children}
            <ValueTechServiceFooter />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-gradient-to-br from-slate-50 via-sky-50/40 to-emerald-50 text-slate-900 flex flex-col pt-14">
      <ValueTechServiceNavbar />

      <SidebarProvider className="flex-1">
        <Sidebar
          side={isArabic ? "right" : "left"}
          variant="floating"
          collapsible="icon"
          className="bg-slate-950 text-slate-50 shadow-2xl shadow-slate-900/40 top-14"
        >
          <SidebarHeader className="border-b border-slate-800/70 bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400 text-slate-900 rounded-lg m-2 px-3 py-3">
            <ValueTechSidebarAccount isArabic={isArabic} t={t} />
          </SidebarHeader>

          <SidebarContent className="pt-1">
            {/* Back to products */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild className="text-slate-300 hover:text-white hover:bg-white/10">
                      <Link href="/value-tech#products" className="flex items-center gap-2">
                        <ArrowLeft className={cn("h-4 w-4 text-cyan-400", isArabic && "rotate-180")} />
                        <span className="text-[13px] font-medium">{t.backToProducts}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            {/* Current product */}
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wide text-slate-400">
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
                        <Link href={currentProduct.href} className="flex items-center gap-2">
                          <currentProduct.icon className={cn("h-4 w-4", currentProduct.iconColor)} />
                          <span>{t[currentProduct.labelKey]}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  <SidebarSeparator className="my-2" />

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/clients")}
                      className={isActive("/clients") ? activeClass : idleClass}
                    >
                      <Link href="/clients" className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-fuchsia-300" />
                        <span>{t.sidebarClients}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/settings")}
                      className={isActive("/settings") ? activeClass : idleClass}
                    >
                      <Link href="/settings" className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-slate-300" />
                        <span>{t.sidebarSettings}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <SidebarToggleArrow isArabic={isArabic} />

        <SidebarInset className="min-w-0 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
          <main className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 md:gap-8 min-h-[60vh] overflow-x-hidden">
            <div className="flex items-center justify-between md:hidden mb-2">
              <SidebarTrigger className="rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:bg-slate-100" />
            </div>

            {children}

            <ValueTechServiceFooter />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

