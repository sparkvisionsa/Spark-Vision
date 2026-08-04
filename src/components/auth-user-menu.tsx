"use client";

import { useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LayoutDashboard, LogIn, LogOut, Shield, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

const copy = {
  en: {
    login: "Login",
  },
  ar: {
    login: "تسجيل الدخول",
  },
} as const;

type AuthUserMenuProps = {
  triggerClassName?: string;
};

export default function AuthUserMenu({ triggerClassName }: AuthUserMenuProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, loading } = useAuthTracking();
  const [openAuthModal, setOpenAuthModal] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const langContext = useContext(LanguageContext);
  const language = langContext?.language ?? "ar";
  const t = language === "ar" ? copy.ar : copy.en;

  useEffect(() => {
    const openAuthFromEvent = () => {
      setOpenAuthModal(true);
    };
    window.addEventListener("sv:open-auth-modal", openAuthFromEvent as EventListener);
    return () => {
      window.removeEventListener("sv:open-auth-modal", openAuthFromEvent as EventListener);
    };
  }, []);

  useEffect(() => {
    setAccountMenuOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="h-8 w-24 animate-pulse rounded bg-slate-200" />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center">
        <Button
          size="sm"
          variant="outline"
          className={cn("gap-2", triggerClassName)}
          onClick={() => {
            setOpenAuthModal(true);
          }}
        >
          <LogIn className="h-4 w-4" />
          <span className="hidden sm:inline">{t.login}</span>
        </Button>
        <AuthModal open={openAuthModal} onOpenChange={setOpenAuthModal} />
      </div>
    );
  }

  const displayName = user.phone?.trim() || user.username;

  return (
    <DropdownMenu modal={false} open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-2 border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
            triggerClassName,
          )}
        >
          <UserCircle className="h-4 w-4" />
          <span className="max-w-[120px] truncate">{displayName}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2"
          onSelect={(e) => {
            e.preventDefault();
            setAccountMenuOpen(false);
            router.push("/profile");
          }}
        >
          <UserCircle className="h-4 w-4" />
          Profile
        </DropdownMenuItem>
        {user.role === "super_admin" ? (
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onSelect={(e) => {
              e.preventDefault();
              setAccountMenuOpen(false);
              router.push("/admin");
            }}
          >
            <Shield className="h-4 w-4" />
            Admin Dashboard
          </DropdownMenuItem>
        ) : null}
        {user.role === "company_admin" ? (
          <DropdownMenuItem
            className="flex cursor-pointer items-center gap-2"
            onSelect={(e) => {
              e.preventDefault();
              setAccountMenuOpen(false);
              router.push("/company");
            }}
          >
            <LayoutDashboard className="h-4 w-4" />
            لوحة الشركة
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2 text-rose-600 focus:text-rose-600"
          onSelect={(e) => {
            e.preventDefault();
            void logout();
          }}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
