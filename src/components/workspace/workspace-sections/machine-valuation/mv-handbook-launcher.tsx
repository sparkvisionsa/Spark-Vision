"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { BookOpen } from "lucide-react";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { cn } from "@/lib/utils";

const Handbook = dynamic(() => import("./mv-handbook"), { ssr: false });
// Also prevents repeated automatic opening when browser storage is unavailable.
const seenThisVisit = new Set<string>();

export function MvHandbookLauncher({
  autoOpenAllowed = true,
  className,
}: {
  autoOpenAllowed?: boolean;
  className?: string;
}) {
  const { user, loading } = useAuthTracking();
  if (loading || !user) return null;
  // Reset all reader state when accounts change on a shared browser.
  return <AccountHandbook key={user.id} userId={user.id} autoOpenAllowed={autoOpenAllowed} className={className} />;
}

function AccountHandbook({
  userId,
  autoOpenAllowed,
  className,
}: {
  userId: string;
  autoOpenAllowed: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const hiddenKey = `mv:handbook:hidden:${userId}`;
  const seenKey = `mv:handbook:seen:${userId}`;

  useEffect(() => {
    let suppressed = false;
    let seen = seenThisVisit.has(userId);
    try {
      suppressed = localStorage.getItem(hiddenKey) === "1";
      setHidden(suppressed);
    } catch { /* Keep the current preference when storage is unavailable. */ }
    try { seen ||= sessionStorage.getItem(seenKey) === "1"; } catch { /* Use in-memory fallback. */ }

    const syncPreference = (event: StorageEvent) => {
      if (event.key !== hiddenKey && event.key !== null) return;
      try {
        suppressed = localStorage.getItem(hiddenKey) === "1";
        setHidden(suppressed);
        setStorageError(false);
      } catch { /* Storage is optional. */ }
    };
    window.addEventListener("storage", syncPreference);
    let timer: number | undefined;
    const tryOpen = () => {
      if (seenThisVisit.has(userId) || suppressed) return;
      seenThisVisit.add(userId);
      try { sessionStorage.setItem(seenKey, "1"); } catch { /* Use in-memory fallback. */ }
      setOpen(true);
    };
    // Cancelled on unmount/Strict Mode replay, before recording the impression.
    if (!suppressed && !seen && autoOpenAllowed) timer = window.setTimeout(tryOpen, 650);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", syncPreference);
    };
  }, [autoOpenAllowed, hiddenKey, seenKey, userId]);

  function changeHidden(value: boolean) {
    setHidden(value);
    try {
      if (value) localStorage.setItem(hiddenKey, "1");
      else localStorage.removeItem(hiddenKey);
      setStorageError(false);
    } catch { setStorageError(true); }
  }

  return <>
    <button
      ref={launcher}
      type="button"
      title="كتيب استخدام نظام تقييم الآلات"
      aria-label="فتح كتيب استخدام نظام تقييم الآلات"
      aria-haspopup="dialog"
      onClick={() => {
        seenThisVisit.add(userId);
        try { sessionStorage.setItem(seenKey, "1"); } catch { /* Use in-memory fallback. */ }
        setOpen(true);
      }}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-2 text-[10px] font-bold text-amber-100 transition hover:border-amber-200/60 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        className,
      )}
    >
      <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
      <span>كتيب الاستخدام</span>
    </button>
    {open && <Handbook
      open={open}
      onOpenChange={setOpen}
      hidden={hidden}
      onHiddenChange={changeHidden}
      storageError={storageError}
      userId={userId}
      onReturnFocus={() => launcher.current?.focus()}
    />}
  </>;
}
