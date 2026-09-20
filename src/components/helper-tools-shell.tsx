"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "@/components/prefetch-link";
import { usePathname, useRouter } from "next/navigation";
import { LanguageContext } from "@/components/layout-provider";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import ValueTechServiceNavbar from "@/components/value-tech-service-navbar";
import {
  ArrowLeft,
  ChevronLeft,
  FileImage,
  FileText,
  Images,
  LogIn,
  MonitorPlay,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHelperRecording } from "@/components/helper-recording-provider";
import { HelperRecordingBanner } from "@/components/helper-recording-banner";
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

export type HelperToolId = "screen" | "images" | "pdf" | "words";

type HelperToolsCopy = {
  products: string;
  guest: string;
  signIn: string;
  screen: string;
  images: string;
  pdf: string;
  words: string;
  toggle: string;
};

const COPY = {
  ar: {
    products: "المنتجات",
    guest: "ضيف",
    signIn: "تسجيل الدخول",
    screen: "تصوير الشاشة",
    images: "صور إلى PDF",
    pdf: "PDF إلى صور",
    words: "تفقيط",
    toggle: "طي الشريط الجانبي",
  },
  en: {
    products: "Products",
    guest: "Guest",
    signIn: "Sign in",
    screen: "Screen capture",
    images: "Images to PDF",
    pdf: "PDF to images",
    words: "Amount in words",
    toggle: "Toggle sidebar",
  },
} as const;

const TOOLS: { id: HelperToolId; icon: LucideIcon }[] = [
  { id: "screen", icon: MonitorPlay },
  { id: "images", icon: Images },
  { id: "pdf", icon: FileImage },
  { id: "words", icon: FileText },
];

const NAV_ACTIVE = "bg-white font-semibold text-slate-950 shadow-[0_8px_18px_rgba(8,47,73,0.28)]";
const NAV_IDLE = "text-slate-300 hover:bg-white/10 hover:text-white";

type HelperToolsNav = {
  tool: HelperToolId;
  setTool: (id: HelperToolId) => void;
  isArabic: boolean;
  labels: HelperToolsCopy;
  embedded: boolean;
};

const HelperToolsNavContext = createContext<HelperToolsNav | null>(null);

export function useHelperToolsNav() {
  const value = useContext(HelperToolsNavContext);
  if (!value) throw new Error("useHelperToolsNav must be used within HelperToolsShell");
  return value;
}

export function HelperToolsNavProvider({
  children,
  embedded = false,
}: {
  children: ReactNode;
  embedded?: boolean;
}) {
  const language = useContext(LanguageContext)?.language ?? "ar";
  const isArabic = language === "ar";
  const labels = isArabic ? COPY.ar : COPY.en;
  const [tool, setTool] = useState<HelperToolId>("screen");
  const value = useMemo(
    () => ({ tool, setTool, isArabic, labels, embedded }),
    [tool, isArabic, labels, embedded],
  );
  return <HelperToolsNavContext.Provider value={value}>{children}</HelperToolsNavContext.Provider>;
}

export { TOOLS, COPY, NAV_ACTIVE, NAV_IDLE };

function openAuthModal() {
  window.dispatchEvent(new CustomEvent("sv:open-auth-modal") as Event);
}

function userInitials(username: string) {
  const trimmed = username.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

function HelperSidebarAccount({ labels, isArabic }: { labels: HelperToolsCopy; isArabic: boolean }) {
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
        title={labels.signIn}
        className={cn(row, "font-semibold text-cyan-200/90 hover:text-white", collapsed && "justify-center px-0")}
      >
        <LogIn className="h-4 w-4 shrink-0" aria-hidden />
        {!collapsed ? <span className="truncate">{labels.signIn}</span> : null}
      </button>
    );
  }

  const displayName = user.phone?.trim() || user.username;

  return (
    <Link
      href="/profile"
      title={displayName}
      className={cn(row, "text-slate-200 hover:text-white", collapsed && "justify-center px-0", isArabic ? "text-right" : "text-left")}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white" aria-hidden>
        {userInitials(displayName)}
      </span>
      {!collapsed ? <span className="min-w-0 flex-1 truncate font-medium">{displayName}</span> : null}
    </Link>
  );
}

function HelperSidebarTools() {
  const { tool, setTool, labels, embedded } = useHelperToolsNav();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";
  const pathname = usePathname() || "/";
  const router = useRouter();
  const onToolsPage = pathname === "/helper-tools" || pathname.startsWith("/helper-tools/");

  const select = (id: HelperToolId) => {
    setTool(id);
    if (!embedded && !onToolsPage) router.push("/helper-tools");
    if (isMobile) setOpenMobile(false);
  };

  return (
    <SidebarMenu className="gap-0.5">
      {TOOLS.map(({ id, icon: Icon }) => {
        const active = tool === id && (embedded || onToolsPage);
        return (
          <SidebarMenuItem key={id}>
            <SidebarMenuButton
              isActive={active}
              tooltip={collapsed ? labels[id] : undefined}
              onClick={() => select(id)}
              className={cn("h-10 rounded-lg px-1.5 text-[12px]", active ? NAV_ACTIVE : NAV_IDLE)}
            >
              <Icon className={cn("h-4 w-4 shrink-0", active ? "text-slate-900" : "text-slate-400")} aria-hidden />
              <span className="min-w-0 flex-1 truncate">{labels[id]}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

function HelperSidebarToggle({ isArabic, label }: { isArabic: boolean; label: string }) {
  const { toggleSidebar, state } = useSidebar();
  const isExpanded = state === "expanded";

  return (
    <div
      className="pointer-events-none fixed top-[calc(50%+1.75rem)] z-20 hidden -translate-y-1/2 md:block"
      style={{
        [isArabic ? "right" : "left"]: isExpanded ? "var(--sidebar-width)" : "calc(var(--sidebar-width-icon) + 1rem)",
        transition: `${isArabic ? "right" : "left"} 200ms linear`,
      }}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={label}
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

function HelperWorkspace({ children }: { children: ReactNode }) {
  const { recording, recordedSurface, active, starting, isArabic } = useHelperRecording();
  const live = active || starting;

  return (
    <SidebarInset className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-transparent p-0">
      <div className="flex h-9 items-center px-2 md:hidden">
        <SidebarTrigger className="rounded-md border border-slate-200 bg-white text-slate-700" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {live ? (
          <HelperRecordingBanner
            paused={recording.state === "paused"}
            starting={starting}
            seconds={recording.seconds}
            remaining={recording.remaining}
            countdown={recording.countdown}
            source={recordedSurface}
            arabic={isArabic}
            onTogglePause={recording.togglePause}
            onStop={recording.stop}
          />
        ) : null}
        {children}
      </div>
    </SidebarInset>
  );
}

export default function HelperToolsShell({ children }: { children: ReactNode }) {
  const language = useContext(LanguageContext)?.language ?? "ar";
  const isArabic = language === "ar";
  const labels = isArabic ? COPY.ar : COPY.en;

  return (
    <HelperToolsNavProvider>
      <div
        className="flex h-dvh max-h-dvh min-h-0 min-w-0 flex-col overflow-hidden bg-[linear-gradient(135deg,#eef4f8_0%,#f8fafc_48%,#eef7f2_100%)] pt-14 text-slate-900"
        dir={isArabic ? "rtl" : "ltr"}
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
                <SidebarMenu className="gap-0">
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild size="sm" className={cn("h-9 rounded-lg px-1.5 text-[12px]", NAV_IDLE)}>
                      <Link href="/value-tech#products">
                        <ArrowLeft className={cn("h-4 w-4 shrink-0 text-cyan-300", isArabic && "rotate-180")} aria-hidden />
                        <span className="truncate">{labels.products}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </div>
              <div className="border-b border-white/10 p-1.5">
                <HelperSidebarAccount labels={labels} isArabic={isArabic} />
              </div>
            </SidebarHeader>
            <SidebarContent className="gap-0 overflow-x-hidden p-1.5">
              <SidebarGroup className="p-0">
                <SidebarGroupContent>
                  <HelperSidebarTools />
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <HelperSidebarToggle isArabic={isArabic} label={labels.toggle} />
          <HelperWorkspace>{children}</HelperWorkspace>
        </SidebarProvider>
      </div>
    </HelperToolsNavProvider>
  );
}
