"use client";

import { useContext, useEffect } from "react";
import Link from "@/components/prefetch-link";
import { useRouter } from "next/navigation";
import ValueTechServiceNavbar from "@/components/value-tech-service-navbar";
import ValueTechServiceFooter from "@/components/value-tech-service-footer";
import { Building2, ChevronLeft, Cpu, LayoutGrid, Library, Settings, Users } from "lucide-react";
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

const copy = {
  en: {
    sidebarUserGuest: "Guest",
    sidebarUserSubtitle: "Sign in later to sync your workspace.",
    sidebarSectionTitle: "Value Tech Products",
    sidebarRealEstate: "Real Estate Valuation",
    sidebarMachines: "Machines Valuation",
    sidebarSources: "Information Sources",
    sidebarApp: "Value Tech App",
    sidebarClients: "Clients",
    sidebarSettings: "Settings",
  },
  ar: {
    sidebarUserGuest: "ضيف",
    sidebarUserSubtitle: "يمكنك تسجيل الدخول لاحقًا لربط حسابك.",
    sidebarSectionTitle: "منتجات فاليو تك",
    sidebarRealEstate: "تقييم العقارات",
    sidebarMachines: "تقييم الآلات",
    sidebarSources: "مصادر المعلومات",
    sidebarApp: "تطبيق فاليو تك",
    sidebarClients: "العملاء",
    sidebarSettings: "الإعدادات",
  },
} as const;

const VALUE_TECH_SIDEBAR_ROUTES = [
  "/value-tech",
  "/value-tech-app",
  "/real-estate-valuation",
  "/machine-valuation",
  "/evaluation-source",
  "/clients",
  "/settings",
] as const;

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
    VALUE_TECH_SIDEBAR_ROUTES.forEach((route, i) => {
      timeouts.push(window.setTimeout(() => void router.prefetch(route), i * 60));
    });
    return () => timeouts.forEach((id) => window.clearTimeout(id));
  }, [router]);

  if (!langContext) return null;

  const isArabic = langContext.language === "ar";
  const t = isArabic ? copy.ar : copy.en;

  const isActive = (href: string) => pathname === href;
  const activeClass =
    "bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]";
  const idleClass = "text-slate-200/90";

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
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/10 text-slate-900 font-semibold">
                {t.sidebarUserGuest.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{t.sidebarUserGuest}</p>
                <p className="text-[11px] text-slate-900/80 truncate">
                  {t.sidebarUserSubtitle}
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="pt-1">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {t.sidebarSectionTitle}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/real-estate-valuation")}
                      className={isActive("/real-estate-valuation") ? activeClass : idleClass}
                    >
                      <Link href="/real-estate-valuation" className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-emerald-300" />
                        <span>{t.sidebarRealEstate}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/machine-valuation")}
                      className={isActive("/machine-valuation") ? activeClass : idleClass}
                    >
                      <Link href="/machine-valuation" className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-sky-300" />
                        <span>{t.sidebarMachines}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    {/*
                      Consider all evaluation-source subroutes as active to keep highlight consistent.
                    */}
                    <SidebarMenuButton
                      asChild
                      isActive={
                        pathname === "/evaluation-source" ||
                        pathname.startsWith("/evaluation-source/")
                      }
                      className={
                        pathname === "/evaluation-source" || pathname.startsWith("/evaluation-source/")
                          ? activeClass
                          : idleClass
                      }
                    >
                      <Link href="/evaluation-source" className="flex items-center gap-2">
                        <Library className="h-4 w-4 text-cyan-300" />
                        <span>{t.sidebarSources}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive("/value-tech-app")}
                      className={isActive("/value-tech-app") ? activeClass : idleClass}
                    >
                      <Link href="/value-tech-app" className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4 text-amber-300" />
                        <span>{t.sidebarApp}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

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

