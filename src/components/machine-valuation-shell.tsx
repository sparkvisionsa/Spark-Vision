"use client";

import type { ReactNode } from "react";
import Link from "@/components/prefetch-link";
import { usePathname } from "next/navigation";

/** مسار إعداد التقرير: تمرير داخلي فقط دون تحريك شريط الأدوات و«أقسام التقرير». */
function isMvReportWorkspacePath(pathname: string) {
  return /\/machine-valuation\/[^/]+\/workflow\/report$/.test(pathname);
}

/** صفحات بيانات التقرير / الخطوات / التقييم ضمن ‎/workflow‎ — عمود بارتفاع الشاشة وتمرير داخلي. */
function isMvReportFlowChromePath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "machine-valuation" || parts.length < 2) return false;
  if (
    parts[1] === "dashboard" ||
    parts[1] === "projects" ||
    parts[1] === "company" ||
    parts[1] === "report-settings" ||
    parts[1] === "clients"
  ) {
    return false;
  }
  if (parts.length === 2) return true;
  return parts[2] === "workflow";
}
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  ClipboardList,
  FolderKanban,
  Users,
  Wrench,
} from "lucide-react";
import ValueTechServiceNavbar from "@/components/value-tech-service-navbar";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
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
import {
  MvInPageNavigationProvider,
  useMvInPageNavigation,
} from "@/components/workspace/workspace-sections/machine-valuation/mv-inpage-navigation";
import { MvExperienceBoundary } from "@/components/workspace/workspace-sections/machine-valuation/mv-experience-boundary";
import { useMvI18n } from "@/components/workspace/workspace-sections/machine-valuation/mv-i18n";

function openAuthModal() {
  window.dispatchEvent(new CustomEvent("sv:open-auth-modal") as Event);
}

function userInitials(username: string) {
  const trimmed = username.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

/** مسارات تقييم الآلات: قائمة مشاريع، صفحات إدارة عامة، مشروع، مشروع فرعي */
function parseMachineValuationPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const isMv = segments[0] === "machine-valuation";
  if (!isMv) {
    return {
      isProjectsList: false,
      isProjectContext: false,
      isCompanyPanel: false,
      isReportSettingsPanel: false,
      isClientsPanel: false,
    };
  }
  if (segments.length <= 1) {
    return {
      isProjectsList: true,
      isProjectContext: false,
      isCompanyPanel: false,
      isReportSettingsPanel: false,
      isClientsPanel: false,
    };
  }
  if (segments[1] === "dashboard" || segments[1] === "projects") {
    return {
      isProjectsList: true,
      isProjectContext: false,
      isCompanyPanel: false,
      isReportSettingsPanel: false,
      isClientsPanel: false,
    };
  }
  if (segments[1] === "company") {
    return {
      isProjectsList: false,
      isProjectContext: false,
      isCompanyPanel: true,
      isReportSettingsPanel: false,
      isClientsPanel: false,
    };
  }
  if (segments[1] === "report-settings") {
    return {
      isProjectsList: false,
      isProjectContext: false,
      isCompanyPanel: false,
      isReportSettingsPanel: true,
      isClientsPanel: false,
    };
  }
  if (segments[1] === "clients") {
    return {
      isProjectsList: false,
      isProjectContext: false,
      isCompanyPanel: false,
      isReportSettingsPanel: false,
      isClientsPanel: true,
    };
  }
  return {
    isProjectsList: false,
    isProjectContext: true,
    isCompanyPanel: false,
    isReportSettingsPanel: false,
    isClientsPanel: false,
  };
}

function MachineSidebarAccount() {
  const { t, isArabic } = useMvI18n();
  const { user, profile, loading } = useAuthTracking();
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2", collapsed && "justify-center")} aria-busy="true">
        <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-white/10" />
        {!collapsed ? <div className="h-3 min-w-0 flex-1 animate-pulse rounded bg-white/10" /> : null}
      </div>
    );
  }

  if (user) {
    const displayName = user.phone?.trim() || user.username;
    const subtitle = profile?.email?.trim() || user.email?.trim();
    const avatar = (
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-white"
        aria-hidden
      >
        {userInitials(displayName)}
      </div>
    );

    if (collapsed) {
      return (
        <Link href="/profile" title={displayName} className="flex justify-center rounded-lg p-0.5 hover:bg-white/10">
          {avatar}
        </Link>
      );
    }

    return (
      <Link href="/profile" className="flex items-center gap-2 rounded-lg px-0.5 py-0.5 transition hover:bg-white/10">
        {avatar}
        <div className="min-w-0 flex-1 text-end">
          <p className="truncate text-[12px] font-semibold text-white">{displayName}</p>
          {subtitle ? (
            <p className="truncate text-[10px] text-slate-400">{subtitle}</p>
          ) : null}
        </div>
      </Link>
    );
  }

  const guestAvatar = (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-slate-200"
      aria-hidden
    >
      {isArabic ? "ز" : "G"}
    </div>
  );

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal()}
        title={t("shell.auth.signIn")}
        className="flex w-full justify-center rounded-lg p-0.5 hover:bg-white/10"
      >
        {guestAvatar}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {guestAvatar}
      <div className="min-w-0 flex-1 text-end">
        <p className="text-[12px] font-semibold text-white">{t("shell.account.guest")}</p>
        <button
          type="button"
          onClick={() => openAuthModal()}
          className="mt-0.5 text-[10px] font-semibold text-cyan-200/90 hover:text-white hover:underline"
        >
          {t("shell.auth.signIn")}
        </button>
      </div>
    </div>
  );
}

function MachineSidebarBrand() {
  const { t } = useMvI18n();
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";

  if (collapsed) {
    return (
      <div className="flex justify-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-cyan-200">
          <Wrench className="h-3.5 w-3.5" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-cyan-200">
        <Wrench className="h-3.5 w-3.5" />
      </div>
      <p className="min-w-0 flex-1 truncate text-end text-[13px] font-semibold text-white">{t("shell.brandTitle")}</p>
    </div>
  );
}


function MachineSidebarNav() {
  const { t } = useMvI18n();
  const { currentPath } = useMvInPageNavigation();
  const pathname = currentPath;
  const {
    isProjectsList,
    isProjectContext,
    isCompanyPanel,
    isReportSettingsPanel,
    isClientsPanel,
  } = parseMachineValuationPath(pathname);
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";

  const activeNav =
    "bg-white text-slate-950 shadow-[0_10px_24px_rgba(8,47,73,0.22)] font-semibold";
  const idleNav = "text-slate-300 hover:bg-white/10 hover:text-white";

  const projectsNavActive = isProjectsList || isProjectContext;

  return (
    <SidebarContent className="gap-0 overflow-x-hidden px-2 pb-3 pt-1">
      <SidebarGroup className="px-0 py-1">
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="sm" className="h-9 rounded-lg text-[12px] text-slate-300 hover:bg-white/10 hover:text-white">
                <Link href="/value-tech#products" className="flex items-center gap-2">
                  <ArrowLeft className="h-3.5 w-3.5 rotate-180 text-cyan-300" />
                  <span>{t("navigation.products")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarSeparator className="mx-0 my-2 bg-white/10" />

      <SidebarGroup className="px-0 py-1">
        <SidebarGroupContent>
          <SidebarMenu className="gap-1.5">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={projectsNavActive}
                size="sm"
                tooltip={collapsed ? t("navigation.projects") : undefined}
                className={cn(
                  "h-10 rounded-lg text-[12px]",
                  projectsNavActive ? activeNav : idleNav,
                )}
              >
                <Link href="/machine-valuation/projects" className="flex items-center gap-2">
                  <FolderKanban className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                  <span className="truncate">{t("navigation.projects")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isCompanyPanel}
                size="sm"
                tooltip={collapsed ? t("navigation.generalSettings") : undefined}
                className={cn("h-10 rounded-lg text-[12px]", isCompanyPanel ? activeNav : idleNav)}
              >
                <Link href="/machine-valuation/company" className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                  <span className="truncate">{t("navigation.generalSettings")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isReportSettingsPanel}
                size="sm"
                tooltip={collapsed ? t("navigation.reportSettings") : undefined}
                className={cn("h-10 rounded-lg text-[12px]", isReportSettingsPanel ? activeNav : idleNav)}
              >
                <Link href="/machine-valuation/report-settings" className="flex items-center gap-2">
                  <ClipboardList className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                  <span className="truncate">{t("navigation.reportSettings")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isClientsPanel}
                size="sm"
                tooltip={collapsed ? t("navigation.clients") : undefined}
                className={cn("h-10 rounded-lg text-[12px]", isClientsPanel ? activeNav : idleNav)}
              >
                <Link href="/machine-valuation/clients" className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 shrink-0 text-violet-300" />
                  <span className="truncate">{t("navigation.clients")}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

    </SidebarContent>
  );
}

function MachineWorkspace({ children }: { children: ReactNode }) {
  const { state, isMobile } = useSidebar();
  const sidebarCollapsed = !isMobile && state === "collapsed";
  const { currentPath } = useMvInPageNavigation();
  const pathname = currentPath || "";
  const reportWorkspaceLocked = isMvReportWorkspacePath(pathname);
  const reportFlowChrome = isMvReportFlowChromePath(pathname);
  const useColumnLock = reportWorkspaceLocked || reportFlowChrome;
  const widePanel =
    pathname.includes("/machine-valuation/company") ||
    pathname.includes("/machine-valuation/report-settings") ||
    pathname.includes("/machine-valuation/clients");

  return (
    <SidebarInset
      className={cn(
        "min-h-0 min-w-0 max-h-full flex-1 flex-col overflow-hidden bg-transparent px-3 pb-6 pt-2 md:pb-8",
        sidebarCollapsed ? "md:px-3 lg:px-4" : "md:px-5",
      )}
    >
      <SidebarTrigger className="fixed end-3 top-[4.25rem] z-40 rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm hover:bg-slate-50 md:hidden" />
      <div
        className={cn(
          "mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col",
          widePanel ? "max-w-none" : "max-w-[1680px]",
          useColumnLock ? "gap-0 overflow-hidden" : "gap-4 overflow-y-auto overscroll-contain md:gap-5",
        )}
      >
        {children}
      </div>
    </SidebarInset>
  );
}

function MachineSidebarToggleArrow() {
  const { t, isArabic } = useMvI18n();
  const { toggleSidebar, state } = useSidebar();
  const isExpanded = state === "expanded";
  const sideOffset = isExpanded ? "var(--sidebar-width)" : "calc(var(--sidebar-width-icon) + 1rem)";

  return (
    <div
      className="pointer-events-none fixed top-1/2 z-20 hidden -translate-y-1/2 md:block"
      style={
        isArabic
          ? { right: sideOffset, left: "auto", transition: "right 200ms linear" }
          : { left: sideOffset, right: "auto", transition: "left 200ms linear" }
      }
    >
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={t("shell.sidebar.toggle")}
        className={cn(
          "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full border",
          "border-white/15 bg-slate-950 text-cyan-200 shadow-lg shadow-slate-950/25",
          "transition-all duration-200 ease-out hover:scale-105 hover:border-cyan-300/40 hover:bg-slate-900 active:scale-95",
          isArabic ? "translate-x-1/2" : "-translate-x-1/2",
        )}
      >
        <ChevronLeft
          className={cn(
            "h-4 w-4 transition-transform duration-300 ease-out",
            isArabic ? !isExpanded && "rotate-180" : isExpanded && "rotate-180",
          )}
        />
      </button>
    </div>
  );
}

export default function MachineValuationShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/machine-valuation";

  return (
    <MvInPageNavigationProvider initialPath={pathname}>
      <MachineValuationShellInner>{children}</MachineValuationShellInner>
    </MvInPageNavigationProvider>
  );
}

function MachineValuationShellInner({ children }: { children: ReactNode }) {
  const { dir, isArabic } = useMvI18n();
  const { navigate, isMachineValuationPath } = useMvInPageNavigation();

  return (
    <MvExperienceBoundary>
    <div
      className="mv-system-scope flex h-dvh max-h-dvh min-h-0 min-w-0 flex-col overflow-hidden bg-[linear-gradient(135deg,#eef4f8_0%,#f8fafc_48%,#eef7f2_100%)] pt-14 text-slate-900"
      dir={dir}
      onClickCapture={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) return;
        const target = event.target as HTMLElement | null;
        const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
        if (!anchor) return;
        if (anchor.target && anchor.target !== "_self") return;
        if (anchor.hasAttribute("download")) return;
        const href = anchor.getAttribute("href");
        if (!href || href.startsWith("#")) return;
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        const internalPath = `${url.pathname}${url.search}${url.hash}`;
        if (!isMachineValuationPath(internalPath)) return;
        event.preventDefault();
        navigate(internalPath);
      }}
    >
      <ValueTechServiceNavbar />

      <SidebarProvider
        defaultOpen
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden",
          "[--sidebar-background:217_45%_11%] [--sidebar-foreground:210_40%_96%]",
          "[--sidebar-accent:215_28%_18%] [--sidebar-accent-foreground:210_40%_98%]",
          "[--sidebar-border:214_32%_22%] [--sidebar-ring:188_86%_53%]",
        )}
      >
        <Sidebar
          side={isArabic ? "right" : "left"}
          variant="floating"
          collapsible="icon"
          className="top-14 z-20 border-0 bg-transparent text-slate-100 shadow-none"
        >
          <SidebarHeader className="m-2 rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5">
            <MachineSidebarBrand />
            <div className="my-2 h-px bg-white/10 group-data-[collapsible=icon]:hidden" />
            <MachineSidebarAccount />
          </SidebarHeader>

          <MachineSidebarNav />
        </Sidebar>

        <MachineSidebarToggleArrow />

        <MachineWorkspace>{children}</MachineWorkspace>
      </SidebarProvider>
    </div>
    </MvExperienceBoundary>
  );
}
