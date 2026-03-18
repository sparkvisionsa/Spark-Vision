"use client";

import { useContext, useEffect, useRef, useState } from "react";
import Link from "@/components/prefetch-link";
import { ChevronDown, LogIn, LogOut, Shield, UserCircle, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AuthModal from "@/components/auth-modal";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { LanguageContext } from "@/components/layout-provider";

const copy = {
  en: {
    login: "Login",
    register: "Register",
    loginOrRegister: "Login / Register",
  },
  ar: {
    login: "تسجيل الدخول",
    register: "تسجيل",
    loginOrRegister: "تسجيل / تسجيل الدخول",
  },
} as const;

export default function AuthUserMenu() {
  const { user, logout, guestAccess, loading } = useAuthTracking();
  const [openAuthModal, setOpenAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const autoOpenTriggeredRef = useRef(false);
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "ar";
  const t = language === "ar" ? copy.ar : copy.en;

  const attemptsText =
    guestAccess && guestAccess.registrationRequired
      ? `${guestAccess.attemptsRemaining}/${guestAccess.limit} guest attempts left`
      : null;

  useEffect(() => {
    const openAuthFromEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ mode?: "login" | "register" }>;
      setAuthMode(customEvent.detail?.mode ?? "register");
      setOpenAuthModal(true);
    };
    window.addEventListener("sv:open-auth-modal", openAuthFromEvent as EventListener);
    return () => {
      window.removeEventListener("sv:open-auth-modal", openAuthFromEvent as EventListener);
    };
  }, []);

  useEffect(() => {
    if (user) {
      autoOpenTriggeredRef.current = false;
      return;
    }
    if (!guestAccess?.registrationRequired) return;
    if (guestAccess.attemptsRemaining > 0) return;
    if (autoOpenTriggeredRef.current) return;
    autoOpenTriggeredRef.current = true;
    setAuthMode("register");
    setOpenAuthModal(true);
  }, [guestAccess, user]);

  if (loading) {
    return (
      <div className="h-8 w-24 animate-pulse rounded bg-slate-200" />
    );
  }

  if (!user) {
    const used = guestAccess?.attemptsUsed ?? 0;
    const total = guestAccess?.limit ?? 0;
    const percent = total > 0 ? Math.min(100, (used / total) * 100) : 0;
    return (
      <div className="flex items-center gap-2">
        {attemptsText ? (
          <div className="hidden min-w-[220px] rounded border border-slate-200 bg-white px-2 py-2 lg:block">
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
              <span>Guest Access</span>
              <span>{guestAccess?.attemptsRemaining ?? 0} left</span>
            </div>
            <Progress value={100 - percent} className="h-1.5" />
            <div className="mt-1 text-[10px] text-slate-500">{attemptsText}</div>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => {
              setAuthMode("login");
              setOpenAuthModal(true);
            }}
          >
            <LogIn className="h-4 w-4" />
            <span className="hidden sm:inline">{t.login}</span>
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              setAuthMode("register");
              setOpenAuthModal(true);
            }}
          >
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">{t.register}</span>
          </Button>
        </div>
        <AuthModal
          open={openAuthModal}
          onOpenChange={setOpenAuthModal}
          initialMode={authMode}
        />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <UserCircle className="h-4 w-4" />
          <span className="max-w-[120px] truncate">{user.username}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center gap-2">
            <UserCircle className="h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        {user.role === "super_admin" ? (
          <DropdownMenuItem asChild>
            <Link href="/admin" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Admin Dashboard
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void logout();
          }}
          className="flex items-center gap-2 text-rose-600 focus:text-rose-600"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
