"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { ValueTechLoginCard } from "@/components/value-tech-login-experience";

export default function AuthModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { login } = useAuthTracking();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
      setPhone("");
      setPassword("");
      setRememberMe(true);
    }
  }, [open]);

  const onSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      await login({ phone: phone.trim(), password, rememberMe });
      onOpenChange(false);
      setPassword("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "فشل تسجيل الدخول.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="w-[min(32rem,calc(100vw-2rem))] border-0 bg-transparent p-0 shadow-none sm:max-w-none [&>button]:left-5 [&>button]:right-auto [&>button]:top-5 [&>button]:z-20 [&>button]:rounded-full [&>button]:border [&>button]:border-[#f4cf86]/40 [&>button]:bg-[#071528]/75 [&>button]:p-2 [&>button]:text-[#f7d693] [&>button]:opacity-100 [&>button]:backdrop-blur"
      >
        <DialogTitle className="sr-only">تسجيل الدخول إلى فاليو تك</DialogTitle>
        <ValueTechLoginCard
          mode="modal"
          phone={phone}
          password={password}
          rememberMe={rememberMe}
          submitting={submitting}
          error={error}
          onPhoneChange={setPhone}
          onPasswordChange={setPassword}
          onRememberMeChange={setRememberMe}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
