"use client";

import { useContext, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Code2, Headset, History, LifeBuoy, Ticket } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageContext } from "@/components/layout-provider";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { cn } from "@/lib/utils";
import { useSupport } from "./support-provider";
import { developerRequestsHref, productFromPath, supportHref } from "./support-types";

const copy = {
  ar: {
    trigger: "الدعم الفني والاقتراحات",
    triggerShort: "الدعم الفني",
    intro: "مساعدة، تذاكر، ومقترحات تطوير",
    support: "الدعم",
    supportHint: "تواصل مع فريق الدعم الفني",
    tickets: "التذاكر",
    ticketsHint: "متابعة المحادثات والطلبات",
    developer: "كن مطور",
    developerHint: "سجّل مشكلة أو اقترح فكرة",
    requests: "طلبات المطورين",
    requestsHint: "متابعة بلاغات وأفكار كن مطور",
    unread: "رسائل غير مقروءة",
  },
  en: {
    trigger: "Support & suggestions",
    triggerShort: "Support",
    intro: "Help, tickets, and product ideas",
    support: "Support",
    supportHint: "Contact the technical support team",
    tickets: "Tickets",
    ticketsHint: "Follow conversations and requests",
    developer: "Become a developer",
    developerHint: "Record an issue or suggest an idea",
    requests: "Developer requests",
    requestsHint: "Track recorded bugs and ideas",
    unread: "Unread messages",
  },
} as const;

type SupportNavMenuProps = {
  variant?: "light" | "hub";
  compact?: boolean;
  className?: string;
};

export default function SupportNavMenu({ variant = "light", compact = false, className }: SupportNavMenuProps) {
  const isArabic = (useContext(LanguageContext)?.language ?? "ar") === "ar";
  const labels = isArabic ? copy.ar : copy.en;
  const { user } = useAuthTracking();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { summary, openSupport, openDeveloperRequests, openRecorder } = useSupport();
  const [open, setOpen] = useState(false);
  const hub = variant === "hub";
  const unread = summary.unread;

  const requireAuth = () => {
    if (user) return true;
    window.dispatchEvent(new CustomEvent("sv:open-auth-modal"));
    return false;
  };

  const goSupport = (compose = false) => {
    if (!requireAuth()) return;
    const product = productFromPath(pathname);
    if (product === "general") {
      openSupport("general", { compose });
      return;
    }
    const href = supportHref(product);
    router.push(compose ? `${href}&new=1` : href);
  };

  const goDeveloperRequests = () => {
    if (!requireAuth()) return;
    const product = productFromPath(pathname);
    if (product === "general") openDeveloperRequests();
    else router.push(developerRequestsHref(product));
  };

  const items = [
    {
      key: "support",
      title: labels.support,
      hint: labels.supportHint,
      icon: LifeBuoy,
      tone: "cyan" as const,
      onSelect: () => goSupport(true),
    },
    {
      key: "tickets",
      title: labels.tickets,
      hint: labels.ticketsHint,
      icon: Ticket,
      tone: "sky" as const,
      badge: unread,
      onSelect: () => goSupport(false),
    },
    {
      key: "developer",
      title: labels.developer,
      hint: labels.developerHint,
      icon: Code2,
      tone: "violet" as const,
      onSelect: () => {
        if (!requireAuth()) return;
        openRecorder();
      },
    },
    ...(summary.superAdmin
      ? [{
          key: "requests",
          title: labels.requests,
          hint: labels.requestsHint,
          icon: History,
          tone: "violet" as const,
          onSelect: goDeveloperRequests,
        }]
      : []),
  ];

  const toneClass = {
    cyan: hub ? "bg-cyan-400/15 text-cyan-200" : "bg-cyan-50 text-cyan-700",
    sky: hub ? "bg-sky-400/15 text-sky-200" : "bg-sky-50 text-sky-700",
    violet: hub ? "bg-violet-400/15 text-violet-200" : "bg-violet-50 text-violet-700",
  };

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen} dir={isArabic ? "rtl" : "ltr"}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={labels.trigger}
          title={labels.trigger}
          className={cn(
            "relative inline-flex shrink-0 items-center outline-none transition",
            compact
              ? hub
                ? "h-8 w-8 justify-center rounded-full text-[#f5cd7b] hover:bg-[rgba(232,184,90,0.12)]"
                : "h-9 w-9 justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                : hub
                  ? "vt-hub-nav-link vt-hub-nav-link--support max-w-[15rem]"
                : "h-9 gap-1.5 rounded-lg bg-yellow-400 px-3 text-[13px] font-semibold text-yellow-950 shadow-sm hover:bg-yellow-300",
            className,
          )}
        >
          <span className="relative inline-flex">
            <Headset className={cn(compact ? "h-[18px] w-[18px]" : "h-3.5 w-3.5")} aria-hidden />
            {unread > 0 && (
              <span className="absolute -end-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </span>
          {!compact && (
            <>
              <span className="hidden max-w-[12.5rem] truncate lg:inline">{labels.trigger}</span>
              <span className="truncate lg:hidden">{labels.triggerShort}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={isArabic ? "end" : "end"}
        sideOffset={10}
        className={cn(
          "w-[min(22rem,calc(100vw-1.25rem))] overflow-hidden rounded-2xl p-1.5 shadow-2xl",
          hub
            ? "border-[rgba(232,184,90,0.32)] bg-[linear-gradient(155deg,#122a4a_0%,#0f2240_52%,#0a1628_100%)] text-[#f5cd7b]"
            : "border-slate-200/90 bg-white",
        )}
      >
        <div className={cn("px-2.5 pb-2 pt-1.5", isArabic ? "text-right" : "text-left")}>
          <p className={cn("text-[13px] font-semibold", hub ? "text-[#fff8eb]" : "text-slate-900")}>{labels.trigger}</p>
          <p className={cn("mt-0.5 text-[11px] leading-4", hub ? "text-[#f5cd7b]/70" : "text-slate-500")}>{labels.intro}</p>
        </div>
        <DropdownMenuSeparator className={hub ? "bg-white/10" : "bg-slate-100"} />
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={item.key}
              className={cn(
                "cursor-pointer items-start gap-3 rounded-xl p-2.5",
                hub
                  ? "text-[#f5cd7b] focus:bg-[rgba(232,184,90,0.12)] focus:text-[#fff8eb]"
                  : "focus:bg-slate-50 focus:text-slate-950",
              )}
              onSelect={(event) => {
                event.preventDefault();
                setOpen(false);
                item.onSelect();
              }}
            >
              <span className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", toneClass[item.tone])}>
                <Icon className="h-4 w-4" />
              </span>
              <span className={cn("min-w-0 flex-1", isArabic ? "text-right" : "text-left")}>
                <span className="flex items-center gap-2">
                  <span className={cn("text-sm font-semibold", hub ? "text-[#fff8eb]" : "text-slate-900")}>{item.title}</span>
                  {item.badge ? (
                    <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-4 text-white" aria-label={labels.unread}>
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  ) : null}
                </span>
                <span className={cn("mt-0.5 block text-[11px] leading-4", hub ? "text-[#f5cd7b]/65" : "text-slate-500")}>{item.hint}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
