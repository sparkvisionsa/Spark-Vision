"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, FileCog, LogIn, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import HelperTools from "@/components/workspace/workspace-sections/helper-tools";
import { useHelperRecording } from "@/components/helper-recording-provider";
import { HelperRecordingBanner } from "@/components/helper-recording-banner";
import {
  COPY,
  HelperToolsNavProvider,
  NAV_ACTIVE,
  NAV_IDLE,
  TOOLS,
  useHelperToolsNav,
  type HelperToolId,
} from "@/components/helper-tools-shell";

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

function EmbeddedAccount({ isArabic }: { isArabic: boolean }) {
  const { user, loading } = useAuthTracking();
  const labels = isArabic ? COPY.ar : COPY.en;
  const row = "flex h-9 w-full items-center gap-2 rounded-lg px-1.5 text-[12px] transition hover:bg-white/10";

  if (loading) {
    return (
      <div className={row} aria-busy="true">
        <span className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-white/10" />
        <span className="h-2.5 min-w-0 flex-1 animate-pulse rounded bg-white/10" />
      </div>
    );
  }

  if (!user) {
    return (
      <button type="button" onClick={() => openAuthModal()} title={labels.signIn} className={cn(row, "font-semibold text-cyan-200/90 hover:text-white")}>
        <LogIn className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate">{labels.signIn}</span>
      </button>
    );
  }

  const displayName = user.phone?.trim() || user.username;
  return (
    <Link href="/profile" title={displayName} className={cn(row, "text-slate-200 hover:text-white", isArabic ? "text-right" : "text-left")}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white" aria-hidden>
        {userInitials(displayName)}
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{displayName}</span>
    </Link>
  );
}

function EmbeddedToolNav({ collapsed }: { collapsed: boolean }) {
  const { tool, setTool, labels } = useHelperToolsNav();
  return (
    <nav className="flex flex-col gap-0.5" aria-label={labels.screen}>
      {TOOLS.map(({ id, icon: Icon }) => {
        const active = tool === id;
        return (
          <button
            key={id}
            type="button"
            title={labels[id]}
            onClick={() => setTool(id as HelperToolId)}
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-lg px-1.5 text-[12px] transition",
              collapsed && "justify-center px-0",
              active ? NAV_ACTIVE : NAV_IDLE,
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", active ? "text-slate-900" : "text-slate-400")} aria-hidden />
            {collapsed ? null : <span className="min-w-0 flex-1 truncate text-start">{labels[id]}</span>}
          </button>
        );
      })}
    </nav>
  );
}

function HelperToolsEmbedded() {
  const { isArabic } = useHelperToolsNav();
  const { recording, recordedSurface, active, starting } = useHelperRecording();
  const [collapsed, setCollapsed] = useState(false);
  const live = active || starting;
  const title = isArabic ? "الأدوات المساعدة" : "Helper tools";

  return (
    <div
      className="flex h-full min-h-0 min-w-0 overflow-hidden bg-[linear-gradient(135deg,#eef4f8_0%,#f8fafc_48%,#eef7f2_100%)] text-slate-900"
      dir={isArabic ? "rtl" : "ltr"}
    >
      <aside className={cn("relative m-2 flex shrink-0 flex-col overflow-hidden rounded-2xl bg-[hsl(217_45%_11%)] text-slate-100 shadow-[0_12px_32px_rgba(8,47,73,0.28)] transition-[width] duration-200", collapsed ? "w-[3.85rem]" : "w-[13.75rem]")}>
        <div className="border-b border-white/10 p-1.5">
          <div className={cn("flex h-10 items-center gap-2 rounded-lg px-1.5", collapsed && "justify-center px-0")}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-200">
              <FileCog className="h-4 w-4" aria-hidden />
            </span>
            {collapsed ? null : <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{title}</p>}
          </div>
        </div>
        <div className="border-b border-white/10 p-1.5">
          {collapsed ? null : <EmbeddedAccount isArabic={isArabic} />}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          <EmbeddedToolNav collapsed={collapsed} />
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={isArabic ? (collapsed ? "توسيع الشريط الجانبي" : "طي الشريط الجانبي") : (collapsed ? "Expand sidebar" : "Collapse sidebar")}
          className="absolute top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-slate-950 text-cyan-200 shadow-lg transition hover:border-cyan-300/40 hover:bg-slate-900"
          style={{ [isArabic ? "left" : "right"]: "-0.7rem" }}
        >
          <ChevronLeft className={cn("h-3.5 w-3.5 transition-transform", isArabic ? !collapsed && "rotate-180" : collapsed && "rotate-180")} aria-hidden />
        </button>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
          <HelperTools />
        </div>
      </div>
    </div>
  );
}

export default function HelperToolsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { active, starting, isArabic } = useHelperRecording();
  const title = isArabic ? "الأدوات المساعدة" : "Helper tools";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        dir={isArabic ? "rtl" : "ltr"}
        className="flex h-[min(92dvh,920px)] w-[min(96vw,1440px)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl border-slate-200 p-0 shadow-2xl"
        onInteractOutside={(event) => {
          if (active || starting) event.preventDefault();
          const target = event.target as HTMLElement | null;
          if (target?.closest("[role='alertdialog'], [data-radix-alert-dialog-overlay]")) {
            event.preventDefault();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (active || starting) event.preventDefault();
        }}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          {isArabic ? "تصوير الشاشة وتحويل الملفات داخل الصفحة الحالية" : "Screen capture and file tools on the current page"}
        </DialogDescription>
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-slate-200/80 bg-white px-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <FileCog className="h-4 w-4" aria-hidden />
          </span>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{title}</p>
          <DialogClose
            aria-label={isArabic ? "إغلاق" : "Close"}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-600 shadow-sm outline-none transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-emerald-400/50"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            {isArabic ? "إغلاق" : "Close"}
          </DialogClose>
        </div>
        <div className="min-h-0 min-w-0 flex-1">
          <HelperToolsNavProvider embedded>
            <HelperToolsEmbedded />
          </HelperToolsNavProvider>
        </div>
      </DialogContent>
    </Dialog>
  );
}
