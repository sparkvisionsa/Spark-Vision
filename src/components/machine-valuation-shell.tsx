"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "@/components/prefetch-link";
import { usePathname } from "next/navigation";
import { useSupport } from "@/components/support/support-provider";
import { developerRequestsHref, supportHref } from "@/components/support/support-types";
import SupportNotifications from "@/components/support/support-notifications";

/** مسار إعداد التقرير: تمرير داخلي فقط دون تحريك شريط الأدوات و«أقسام التقرير». */
function isMvReportWorkspacePath(pathname: string) {
  return /\/machine-valuation\/[^/]+\/workflow\/report$/.test(pathname);
}

/** صفحات بيانات التقرير / الخطوات / التقييم ضمن ‎/workflow‎ — عمود بارتفاع الشاشة وتمرير داخلي. */
function isMvReportFlowChromePath(pathname: string) {
  pathname = pathname.split(/[?#]/)[0]!;
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "machine-valuation" || parts.length < 2) return false;
  if (
    parts[1] === "dashboard" ||
    parts[1] === "projects" ||
    parts[1] === "company" ||
    parts[1] === "report-settings" ||
    parts[1] === "settings" ||
    parts[1] === "clients" || parts[1] === "support" || parts[1] === "developer-requests"
  ) {
    return false;
  }
  if (parts.length === 2) return true;
  return parts[2] === "workflow";
}
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  Building2,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  FolderKanban,
  Headset,
  History,
  ListOrdered,
  LogIn,
  Settings,
  Users,
  Wrench,
  type LucideIcon,
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  MvInPageNavigationProvider,
  useMvInPageNavigation,
} from "@/components/workspace/workspace-sections/machine-valuation/mv-inpage-navigation";
import { MvExperienceBoundary } from "@/components/workspace/workspace-sections/machine-valuation/mv-experience-boundary";
import { useMvI18n } from "@/components/workspace/workspace-sections/machine-valuation/mv-i18n";
import {
  MV_SETTINGS_SECTIONS,
  resolveSettingsSection,
  type MvSettingsSection,
} from "@/components/workspace/workspace-sections/machine-valuation/mv-settings-nav";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

const MV_PANEL_SEGMENTS = [
  "dashboard",
  "projects",
  "settings",
  "company",
  "report-settings",
  "clients",
  "support",
  "developer-requests",
];

/** مسارات تقييم الآلات: قائمة مشاريع، صفحات إدارة عامة، مشروع، مشروع فرعي */
function parseMachineValuationPath(pathname: string) {
  const segments = pathname.split(/[?#]/)[0]!.split("/").filter(Boolean);
  const panel = segments[0] === "machine-valuation" ? segments[1] ?? "dashboard" : null;
  const settingsSection: MvSettingsSection | null =
    panel === "company"
      ? "general"
      : panel === "report-settings"
        ? "report"
        : panel === "settings"
          ? resolveSettingsSection(segments[2])
          : null;

  return {
    isProjectsList: panel === "dashboard" || panel === "projects",
    isProjectContext: panel !== null && !MV_PANEL_SEGMENTS.includes(panel),
    isSettingsPanel: settingsSection != null,
    settingsSection,
    isClientsPanel: panel === "clients",
    isSupportPanel: panel === "support",
    isDeveloperRequestsPanel: panel === "developer-requests",
  };
}

const MV_NAV_ACTIVE = "bg-white font-semibold text-slate-950 shadow-[0_8px_18px_rgba(8,47,73,0.28)]";
const MV_NAV_IDLE = "text-slate-300 hover:bg-white/10 hover:text-white";

function MachineSidebarAccount() {
  const { t } = useMvI18n();
  const { user, loading } = useAuthTracking();
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const row = "flex h-9 w-full items-center gap-2 rounded-lg px-1.5 text-[12px] transition hover:bg-white/10";

  if (loading) {
    return (
      <div className={cn(row, collapsed && "justify-center px-0")} aria-busy="true">
        <span className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-white/10" />
        {!collapsed ? <span className="h-2.5 min-w-0 flex-1 animate-pulse rounded bg-white/10" /> : null}
      </div>
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal()}
        title={t("shell.auth.signIn")}
        className={cn(row, "font-semibold text-cyan-200/90 hover:text-white", collapsed && "justify-center px-0")}
      >
        <LogIn className="h-4 w-4 shrink-0" aria-hidden />
        {!collapsed ? <span className="truncate">{t("shell.auth.signIn")}</span> : null}
      </button>
    );
  }

  const displayName = user.phone?.trim() || user.username;

  return (
    <Link
      href="/profile"
      title={displayName}
      className={cn(row, "text-slate-200 hover:text-white", collapsed && "justify-center px-0")}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white"
        aria-hidden
      >
        {userInitials(displayName)}
      </span>
      {!collapsed ? <span className="min-w-0 flex-1 truncate font-medium">{displayName}</span> : null}
    </Link>
  );
}

function MachineSidebarBrand() {
  const { t } = useMvI18n();
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";

  return (
    <div className={cn("flex h-10 items-center gap-2 px-1.5", collapsed && "justify-center px-0")}>
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-200"
        aria-hidden
      >
        <Wrench className="h-4 w-4" />
      </span>
      {!collapsed ? (
        <>
          <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{t("shell.brandTitle")}</p>
          <SupportNotifications dark />
        </>
      ) : null}
    </div>
  );
}

/** رابط المنتجات: أول عنصر في الشريط الجانبي، بأيقونة منتجات بدل سهم الرجوع. */
function MachineSidebarProductsLink() {
  const { t } = useMvI18n();
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";

  return (
    <SidebarMenu className="gap-0">
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          size="sm"
          tooltip={collapsed ? t("navigation.products") : undefined}
          className={cn("h-9 rounded-lg px-1.5 text-[12px]", MV_NAV_IDLE)}
        >
          <Link href="/value-tech#products">
            <Boxes className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden />
            <span className="truncate">{t("navigation.products")}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

type MachineNavItem = {
  key: string;
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  /** يعرض سهم الرجوع قبل الأيقونة عندما تكون الصفحة الحالية خارج هذا القسم. */
  back?: boolean;
  tooltip?: string;
  badge?: number;
};

function MachineNavLinks({ items }: { items: MachineNavItem[] }) {
  const { isArabic } = useMvI18n();
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const BackArrow = isArabic ? ArrowRight : ArrowLeft;

  return (
    <SidebarMenu className="gap-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        const label = item.tooltip ?? item.label;

        return (
          <SidebarMenuItem key={item.key}>
            <SidebarMenuButton
              asChild
              isActive={item.active}
              tooltip={collapsed ? label : undefined}
              className={cn("h-10 rounded-lg px-1.5 text-[12px]", item.active ? MV_NAV_ACTIVE : MV_NAV_IDLE)}
            >
              <Link href={item.href} title={item.tooltip}>
                {item.back ? <BackArrow className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden /> : null}
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    item.back && "group-data-[collapsible=icon]:hidden",
                    item.active ? "text-slate-900" : "text-slate-400",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-cyan-500 px-1.5 text-[10px] font-semibold text-white group-data-[collapsible=icon]:hidden">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                ) : null}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

const SETTINGS_SECTION_ICONS = {
  general: Building2,
  report: ClipboardList,
  "serial-numbering": ListOrdered,
} as const;

function MachineSidebarNav() {
  const { t } = useMvI18n();
  const { currentPath } = useMvInPageNavigation();
  const { summary } = useSupport();
  const { user } = useAuthTracking();
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const {
    isProjectsList,
    isProjectContext,
    isSettingsPanel,
    settingsSection,
    isClientsPanel,
    isSupportPanel,
    isDeveloperRequestsPanel,
  } = parseMachineValuationPath(currentPath);
  const [settingsOpen, setSettingsOpen] = useState(isSettingsPanel);
  const isCompanyAdmin = user?.role === "company_admin";

  useEffect(() => {
    if (isSettingsPanel) setSettingsOpen(true);
  }, [isSettingsPanel]);

  const settingsItems = isCompanyAdmin
    ? MV_SETTINGS_SECTIONS
    : MV_SETTINGS_SECTIONS.filter((item) => item.key === "general");

  const workspaceItems: MachineNavItem[] = [
    {
      key: "projects",
      href: "/machine-valuation/projects",
      label: t("navigation.projects"),
      icon: FolderKanban,
      active: isProjectsList || isProjectContext,
      back: !isProjectsList,
      tooltip: isProjectsList ? undefined : t("navigation.backToProjects"),
    },
  ];

  const afterSettingsItems: MachineNavItem[] = [
    {
      key: "clients",
      href: "/machine-valuation/clients",
      label: t("navigation.clients"),
      icon: Users,
      active: isClientsPanel,
    },
  ];

  const supportItems: MachineNavItem[] = [
    {
      key: "support",
      href: supportHref("machine-valuation"),
      label: t("navigation.support"),
      icon: Headset,
      active: isSupportPanel,
      badge: summary.unread,
    },
    {
      key: "developer-requests",
      href: developerRequestsHref("machine-valuation"),
      label: t("navigation.developerRequests"),
      icon: History,
      active: isDeveloperRequestsPanel,
    },
  ];

  return (
    <SidebarContent className="gap-0 overflow-x-hidden p-1.5">
      <SidebarGroup className="p-0">
        <SidebarGroupContent>
          <MachineNavLinks items={workspaceItems} />
          {collapsed ? (
            <SidebarMenu className="mt-0.5 gap-0.5">
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isSettingsPanel}
                  tooltip={t("navigation.settings")}
                  className={cn("h-10 rounded-lg px-1.5 text-[12px]", isSettingsPanel ? MV_NAV_ACTIVE : MV_NAV_IDLE)}
                >
                  <Link href="/machine-valuation/settings">
                    <Settings
                      className={cn("h-4 w-4 shrink-0", isSettingsPanel ? "text-slate-900" : "text-slate-400")}
                      aria-hidden
                    />
                    <span className="truncate">{t("navigation.settings")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          ) : (
            <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen} className="mt-0.5">
              <SidebarMenu className="gap-0.5">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={isSettingsPanel}
                      className={cn("h-10 rounded-lg px-1.5 text-[12px]", isSettingsPanel ? MV_NAV_ACTIVE : MV_NAV_IDLE)}
                    >
                      <Settings
                        className={cn("h-4 w-4 shrink-0", isSettingsPanel ? "text-slate-900" : "text-slate-400")}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">{t("navigation.settings")}</span>
                      <ChevronDown
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 transition-transform",
                          settingsOpen && "rotate-180",
                          isSettingsPanel ? "text-slate-700" : "text-slate-400",
                        )}
                        aria-hidden
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                </SidebarMenuItem>
              </SidebarMenu>
              <CollapsibleContent>
                <div className="ms-3 me-1 mt-1 rounded-lg bg-black/30 p-1 ring-1 ring-inset ring-black/25">
                  <SidebarMenu className="gap-px">
                    {settingsItems.map((item) => {
                      const Icon = SETTINGS_SECTION_ICONS[item.key];
                      const active = settingsSection === item.key;
                      return (
                        <SidebarMenuItem key={item.key}>
                          <SidebarMenuButton
                            asChild
                            size="sm"
                            isActive={active}
                            className={cn(
                              "h-7 rounded-md px-1.5 text-[10.5px] font-medium [&>svg]:size-3",
                              active
                                ? "bg-white/90 font-semibold text-slate-950 shadow-none hover:bg-white hover:text-slate-950"
                                : "text-slate-400 hover:bg-white/10 hover:text-slate-100",
                            )}
                          >
                            <Link href={item.href}>
                              <Icon
                                className={cn("h-3 w-3 shrink-0", active ? "text-slate-800" : "text-slate-500")}
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1 truncate leading-tight">{t(item.labelKey)}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
          <MachineNavLinks items={afterSettingsItems} />
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup className="-mx-1.5 w-auto border-t border-white/10 px-1.5 py-0">
        <SidebarGroupContent>
          <MachineNavLinks items={supportItems} />
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
    pathname.includes("/machine-valuation/settings") ||
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
          <SidebarHeader className="gap-0 p-0">
            <div className="border-b border-white/10 p-1.5">
              <MachineSidebarProductsLink />
            </div>
            <div className="border-b border-white/10 p-1.5">
              <MachineSidebarBrand />
              <MachineSidebarAccount />
            </div>
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
