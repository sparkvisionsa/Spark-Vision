"use client";

import { useState } from "react";
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
  if (parts[1] === "dashboard" || parts[1] === "projects" || parts[1] === "company") return false;
  if (parts.length === 2) return true;
  return parts[2] === "workflow";
}
import {
  ArrowLeft,
  BarChart3,
  Building2,
  ChevronDown,
  ChevronLeft,
  FileStack,
  FolderKanban,
  LayoutDashboard,
  ListPlus,
  Shield,
  Users,
  Wrench,
} from "lucide-react";
import ValueTechServiceNavbar from "@/components/value-tech-service-navbar";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

/** مسارات تقييم الآلات: لوحة، قائمة مشاريع، مشروع، مشروع فرعي */
function parseMachineValuationPath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const isMv = segments[0] === "machine-valuation";
  if (!isMv) {
    return {
      isDashboard: false,
      isProjectsList: false,
      isProjectWorkspace: false,
      isProjectContext: false,
      isCompanyPanel: false,
      projectBasePath: "/machine-valuation",
      projectId: null as string | null,
    };
  }
  if (segments.length <= 1) {
    return {
      isDashboard: false,
      isProjectsList: true,
      isProjectWorkspace: false,
      isProjectContext: false,
      isCompanyPanel: false,
      projectBasePath: "/machine-valuation",
      projectId: null,
    };
  }
  if (segments[1] === "dashboard") {
    return {
      isDashboard: true,
      isProjectsList: false,
      isProjectWorkspace: false,
      isProjectContext: false,
      isCompanyPanel: false,
      projectBasePath: "/machine-valuation",
      projectId: null,
    };
  }
  if (segments[1] === "projects") {
    return {
      isDashboard: false,
      isProjectsList: true,
      isProjectWorkspace: false,
      isProjectContext: false,
      isCompanyPanel: false,
      projectBasePath: "/machine-valuation",
      projectId: null,
    };
  }
  if (segments[1] === "company") {
    return {
      isDashboard: false,
      isProjectsList: false,
      isProjectWorkspace: false,
      isProjectContext: false,
      isCompanyPanel: true,
      projectBasePath: "/machine-valuation",
      projectId: null,
    };
  }
  const pid = segments[1] ?? null;
  const projectBasePath = pid ? `/machine-valuation/${pid}/workflow/report-data` : "/machine-valuation";
  const isProjectWorkspace = Boolean(pid && segments.length === 2);
  const isProjectContext = Boolean(pid && segments.length >= 2);
  return {
    isDashboard: false,
    isProjectsList: false,
    isProjectWorkspace,
    isProjectContext,
    isCompanyPanel: false,
    projectBasePath,
    projectId: pid,
  };
}

function MachineSidebarAccount() {
  const { user, profile, loading } = useAuthTracking();
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")} aria-busy="true">
        <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-200/80" />
        {!collapsed ? (
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200/80" />
            <div className="h-2.5 w-32 animate-pulse rounded bg-slate-200/70" />
          </div>
        ) : null}
      </div>
    );
  }

  if (user) {
    const subtitle = profile?.email?.trim() || user.email?.trim() || "حساب فعّال";
    const avatar = (
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[12px] font-semibold text-[#0C447C] ring-1 ring-sky-200/80"
        aria-hidden
      >
        {userInitials(user.username)}
      </div>
    );

    if (collapsed) {
      return (
        <Link
          href="/profile"
          title={user.username}
          className="flex justify-center rounded-lg p-0.5 transition hover:bg-slate-100"
        >
          {avatar}
        </Link>
      );
    }

    return (
      <Link
        href="/profile"
        className="group/account flex items-center gap-2.5 rounded-lg px-0.5 py-0.5 transition hover:bg-slate-100"
      >
        {avatar}
        <div className="min-w-0 flex-1 text-right">
          <p className="truncate text-[13px] font-semibold leading-tight text-slate-900">{user.username}</p>
          <p className="mt-0.5 truncate text-[10px] leading-snug text-slate-600">{subtitle}</p>
          <p className="mt-0.5 text-[10px] font-medium text-slate-500 group-hover/account:text-slate-700">
            الملف الشخصي
          </p>
        </div>
      </Link>
    );
  }

  const guestAvatar = (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[12px] font-semibold text-amber-900 ring-1 ring-amber-200/80"
      aria-hidden
    >
      ز
    </div>
  );

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal()}
        title="تسجيل الدخول"
        className="flex w-full justify-center rounded-lg p-0.5 transition hover:bg-slate-100"
      >
        {guestAvatar}
      </button>
    );
  }

  return (
    <div className="flex items-start gap-2.5">
      <div className="shrink-0 pt-0.5">{guestAvatar}</div>
      <div className="min-w-0 flex-1 text-right">
        <p className="text-[13px] font-semibold text-slate-900">زائر</p>
        <p className="mt-0.5 text-[10px] leading-snug text-slate-600">سجّل الدخول لربط المشاريع وحفظ التقدم.</p>
        <div className="mt-1.5 flex flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5 text-[10px] font-semibold">
          <button
            type="button"
            onClick={() => openAuthModal()}
            className="rounded px-0 py-0.5 text-[#0C447C] underline-offset-2 transition hover:underline"
          >
            تسجيل الدخول
          </button>
        </div>
      </div>
    </div>
  );
}


function MachineSidebarNav() {
  const { currentPath } = useMvInPageNavigation();
  const pathname = currentPath;
  const { isDashboard, isProjectsList, isProjectContext, isCompanyPanel } = parseMachineValuationPath(pathname);
  const { user } = useAuthTracking();
  const { state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";

  const [dashboardOpen, setDashboardOpen] = useState(false);

  const activeNav =
    "bg-sky-50 text-[#0C447C] shadow-[inset_0_0_0_1px_rgba(56,189,248,0.35)] font-medium";
  const idleNav = "text-slate-600 hover:bg-slate-100 hover:text-slate-900";

  const dashActive = isDashboard;
  const projectsNavActive = isProjectsList || isProjectContext;

  return (
    <SidebarContent className="gap-0 overflow-x-hidden pt-0.5">
      <SidebarGroup className="px-1 py-0.5">
        <SidebarGroupContent>
          <SidebarMenu className="gap-0">
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="sm" className="h-7 text-[12px] text-slate-600 hover:bg-slate-100">
                <Link href="/value-tech#products" className="flex items-center gap-1.5">
                  <ArrowLeft className="h-3.5 w-3.5 rotate-180 text-sky-600" />
                  <span>المنتجات</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarSeparator className="my-1 bg-slate-200/80" />

      <SidebarGroup className="px-1 py-0.5">
        <SidebarGroupContent>
          <SidebarMenu className="gap-0">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={projectsNavActive}
                size="sm"
                tooltip={collapsed ? "المشاريع" : undefined}
                className={cn(
                  "h-7 text-[12px]",
                  projectsNavActive ? activeNav : idleNav,
                )}
              >
                <Link href="/machine-valuation/projects" className="flex items-center gap-1.5">
                  <FolderKanban className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span className="truncate">المشاريع</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <Collapsible open={collapsed ? false : dashboardOpen} onOpenChange={setDashboardOpen}>
              <SidebarMenuItem>
                <div className="flex w-full min-w-0 items-stretch rounded-md">
                  <SidebarMenuButton
                    asChild
                    isActive={dashActive}
                    size="sm"
                    tooltip={collapsed ? "لوحة التحكم" : undefined}
                    className={cn("h-7 min-w-0 flex-1 text-[12px] pe-1", dashActive ? activeNav : idleNav)}
                  >
                    <Link href="/machine-valuation/dashboard" className="flex min-w-0 items-center gap-1.5">
                      <LayoutDashboard className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                      <span className="truncate">لوحة التحكم</span>
                    </Link>
                  </SidebarMenuButton>
                  {!collapsed ? (
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-sky-100/80 hover:text-slate-800"
                        aria-expanded={dashboardOpen}
                        aria-label="إظهار أو إخفاء روابط لوحة التحكم"
                      >
                        <ChevronDown
                          className={cn("h-3.5 w-3.5 transition-transform duration-200", dashboardOpen && "rotate-180")}
                        />
                      </button>
                    </CollapsibleTrigger>
                  ) : null}
                </div>
              </SidebarMenuItem>
              {!collapsed ? (
                <CollapsibleContent>
                  <ul className="me-1.5 mt-0.5 space-y-0 border-r border-slate-200/90 pe-1">
                    <li>
                      <SidebarMenuButton asChild size="sm" className={cn("h-7 w-full text-[11px]", idleNav)}>
                        <Link href="/clients" className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                          <span className="truncate">العملاء</span>
                        </Link>
                      </SidebarMenuButton>
                    </li>
                    <li>
                      <SidebarMenuButton asChild size="sm" className={cn("h-7 w-full text-[11px]", idleNav)}>
                        <Link href="/clients#create-template" className="flex items-center gap-1.5">
                          <ListPlus className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                          <span className="truncate">إنشاء نماذج</span>
                        </Link>
                      </SidebarMenuButton>
                    </li>
                    <li>
                      <SidebarMenuButton asChild size="sm" className={cn("h-7 w-full text-[11px]", idleNav)}>
                        <Link href="/clients#templates" className="flex items-center gap-1.5">
                          <FileStack className="h-3.5 w-3.5 shrink-0 text-violet-700" />
                          <span className="truncate">عرض النماذج</span>
                        </Link>
                      </SidebarMenuButton>
                    </li>
                    <li>
                      <SidebarMenuButton
                        asChild
                        size="sm"
                        className={cn(
                          "h-7 w-full text-[11px]",
                          isProjectsList && !isProjectContext ? activeNav : idleNav,
                        )}
                      >
                        <Link href="/machine-valuation/projects" className="flex items-center gap-1.5">
                          <BarChart3 className="h-3.5 w-3.5 shrink-0 text-sky-700" />
                          <span className="truncate">إحصائيات المشاريع</span>
                        </Link>
                      </SidebarMenuButton>
                    </li>
                    {user?.role === "company_admin" ? (
                      <li>
                        <SidebarMenuButton
                          asChild
                          size="sm"
                          className={cn("h-7 w-full text-[11px]", isCompanyPanel ? activeNav : idleNav)}
                        >
                          <Link href="/machine-valuation/company" className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 shrink-0 text-[#0C447C]" />
                            <span className="truncate">لوحة إدارة الشركة</span>
                          </Link>
                        </SidebarMenuButton>
                      </li>
                    ) : null}
                    <li>
                      <SidebarMenuButton asChild size="sm" className={cn("h-7 w-full text-[11px]", idleNav)}>
                        <Link href="/settings" className="flex items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                          <span className="truncate">الصلاحيات</span>
                        </Link>
                      </SidebarMenuButton>
                    </li>
                  </ul>
                </CollapsibleContent>
              ) : null}
            </Collapsible>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

    </SidebarContent>
  );
}

function MachineWorkspace({ children }: { children: React.ReactNode }) {
  const { state, isMobile } = useSidebar();
  const sidebarCollapsed = !isMobile && state === "collapsed";
  const pathname = usePathname() || "";
  const reportWorkspaceLocked = isMvReportWorkspacePath(pathname);
  const reportFlowChrome = isMvReportFlowChromePath(pathname);
  const useColumnLock = reportWorkspaceLocked || reportFlowChrome;
  const companyPanelWide = pathname.includes("/machine-valuation/company");

  return (
    <SidebarInset
      className={cn(
        "min-h-0 min-w-0 max-h-full flex-1 flex-col overflow-hidden bg-transparent px-2 pb-6 pt-0 md:pb-8",
        sidebarCollapsed ? "md:px-2 lg:px-3" : "md:px-4",
      )}
    >
      <SidebarTrigger className="fixed right-3 top-[4.25rem] z-40 rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-sm hover:bg-slate-50 md:hidden" />
      <div
        className={cn(
          "mx-auto flex min-h-0 w-full min-w-0 flex-1 flex-col",
          companyPanelWide ? "max-w-none" : "max-w-[1600px]",
          useColumnLock ? "gap-0 overflow-hidden" : "gap-3 overflow-y-auto overscroll-contain md:gap-4",
        )}
      >
        {children}
      </div>
    </SidebarInset>
  );
}

function MachineSidebarToggleArrow() {
  const { toggleSidebar, state } = useSidebar();
  const isExpanded = state === "expanded";

  return (
    <div
      className="pointer-events-none fixed top-1/2 z-20 hidden -translate-y-1/2 md:block"
      style={{
        right: isExpanded ? "var(--sidebar-width)" : "calc(var(--sidebar-width-icon) + 1rem)",
        transition: "right 200ms linear",
      }}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="طيّ أو فتح الشريط الجانبي"
        className={cn(
          "pointer-events-auto flex h-8 w-8 translate-x-1/2 items-center justify-center rounded-full border",
          "border-sky-200/90 bg-white text-sky-700 shadow-md",
          "transition-all duration-200 ease-out hover:scale-105 hover:border-sky-300 hover:bg-sky-50 active:scale-95",
        )}
      >
        <ChevronLeft className={cn("h-4 w-4 transition-transform duration-300 ease-out", !isExpanded && "rotate-180")} />
      </button>
    </div>
  );
}

export default function MachineValuationShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/machine-valuation";

  return (
    <MvInPageNavigationProvider initialPath={pathname}>
      <MachineValuationShellInner>{children}</MachineValuationShellInner>
    </MvInPageNavigationProvider>
  );
}

function MachineValuationShellInner({ children }: { children: React.ReactNode }) {
  const { navigate, isMachineValuationPath } = useMvInPageNavigation();

  return (
    <div
      className="flex h-dvh max-h-dvh min-h-0 min-w-0 flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-sky-50/40 to-amber-50/30 pt-14 text-slate-900"
      dir="rtl"
      onClickCapture={(event) => {
        const target = event.target as HTMLElement | null;
        const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
        if (!anchor) return;
        const href = anchor.getAttribute("href");
        if (!href || href.startsWith("#")) return;
        if (!isMachineValuationPath(href)) return;
        event.preventDefault();
        navigate(href);
      }}
    >
      <ValueTechServiceNavbar />

      <SidebarProvider
        defaultOpen
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-row overflow-hidden",
          "[--sidebar-background:210_40%_99%] [--sidebar-foreground:222_47%_14%]",
          "[--sidebar-accent:205_85%_96%] [--sidebar-accent-foreground:217_91%_30%]",
          "[--sidebar-border:214_32%_90%] [--sidebar-ring:199_89%_48%]",
        )}
      >
        <Sidebar
          side="right"
          variant="floating"
          collapsible="icon"
          className="top-14 z-20 border-0 bg-transparent text-slate-800 shadow-none"
        >
          <SidebarHeader className="m-1.5 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-2 shadow-sm backdrop-blur-sm">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0 text-right">
                <p className="text-[9px] font-semibold tracking-[0.12em] text-slate-500">MACHINE VALUATION</p>
                <p className="truncate text-[12px] font-semibold text-[#0C447C]">تقييم الآلات</p>
              </div>
              <div className="shrink-0 rounded-lg bg-sky-50 p-1.5 text-[#0C447C] ring-1 ring-sky-100">
                <Wrench className="h-3.5 w-3.5" />
              </div>
            </div>
            <MachineSidebarAccount />
          </SidebarHeader>

          <MachineSidebarNav />
        </Sidebar>

        <MachineSidebarToggleArrow />

        <MachineWorkspace>{children}</MachineWorkspace>
      </SidebarProvider>
    </div>
  );
}
