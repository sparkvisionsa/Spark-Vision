"use client";

import { useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Headset, History, Lightbulb } from "lucide-react";
import { LanguageContext } from "@/components/layout-provider";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { cn } from "@/lib/utils";
import { useSupport } from "./support-provider";
import { developerRequestsHref, productFromPath, supportHref } from "./support-types";

const copy = {
  ar: {
    support: "الدعم والتذاكر",
    share: "شارك فكرتك",
    trackIdeas: "تتبع شارك فكرتك",
  },
  en: {
    support: "Support & tickets",
    share: "Share your idea",
    trackIdeas: "Track shared ideas",
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
  const hub = variant === "hub";
  const superAdmin = summary.superAdmin || user?.role === "super_admin";

  const requireAuth = () => {
    if (user) return true;
    window.dispatchEvent(new CustomEvent("sv:open-auth-modal"));
    return false;
  };

  const goSupport = () => {
    if (!requireAuth()) return;
    const product = productFromPath(pathname);
    if (product === "general") openSupport("general");
    else router.push(supportHref(product));
  };

  const secondaryAction = () => {
    if (!requireAuth()) return;
    if (!superAdmin) {
      openRecorder();
      return;
    }
    const product = productFromPath(pathname);
    if (product === "general") openDeveloperRequests();
    else router.push(developerRequestsHref(product));
  };

  const secondaryLabel = superAdmin ? labels.trackIdeas : labels.share;
  const SecondaryIcon = superAdmin ? History : Lightbulb;
  const common = compact
    ? "relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg outline-none transition"
    : hub
      ? "vt-hub-nav-link h-9 shrink-0 gap-1.5 px-3 text-[13px]"
      : "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold outline-none transition";

  return (
    <div className="flex shrink-0 items-center gap-1" dir={isArabic ? "rtl" : "ltr"}>
      <button
        type="button"
        onClick={goSupport}
        aria-label={labels.support}
        title={labels.support}
        className={cn(
          common,
          hub
            ? compact ? "text-[#f5cd7b] hover:bg-[rgba(232,184,90,0.12)]" : "max-w-[10rem]"
            : compact ? "text-slate-700 hover:bg-slate-100" : "bg-yellow-400 text-yellow-950 shadow-sm hover:bg-yellow-300",
          className,
        )}
      >
        <span className="relative inline-flex">
          <Headset className={compact ? "h-[18px] w-[18px]" : "h-3.5 w-3.5"} aria-hidden />
          {summary.unread > 0 ? (
            <span className="absolute -end-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
              {summary.unread > 99 ? "99+" : summary.unread}
            </span>
          ) : null}
        </span>
        {!compact ? <span className="truncate">{labels.support}</span> : null}
      </button>

      <button
        type="button"
        onClick={secondaryAction}
        aria-label={secondaryLabel}
        title={secondaryLabel}
        className={cn(
          common,
          hub
            ? compact ? "text-[#f5cd7b] hover:bg-[rgba(232,184,90,0.12)]" : "max-w-[11rem]"
            : compact
              ? "text-violet-700 hover:bg-violet-50"
              : "border border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-300 hover:bg-violet-100",
        )}
      >
        <SecondaryIcon className={compact ? "h-[18px] w-[18px]" : "h-3.5 w-3.5"} aria-hidden />
        {!compact ? <span className="truncate">{secondaryLabel}</span> : null}
      </button>
    </div>
  );
}
