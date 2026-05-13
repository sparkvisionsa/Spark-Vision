"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthTracking } from "@/components/auth-tracking-provider";

export default function AuthModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const { login } = useAuthTracking();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
      setUsername("");
      setPassword("");
      setRememberMe(false);
    }
  }, [open]);

  const onSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const normalizedUsername = username.trim();
      await login({ username: normalizedUsername, password, rememberMe });
      onOpenChange(false);
      setPassword("");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Authentication failed."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تسجيل الدخول — Spark Vision</DialogTitle>
          <DialogDescription>
            أدخل بيانات الحصول الصادرة عن المسؤول. التسجيل الذاتي غير متاح.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="auth-username">اسم المستخدم</Label>
            <Input
              id="auth-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="username"
              autoComplete="username"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="auth-password">كلمة المرور</Label>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              autoComplete="current-password"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            تذكرني
          </label>

          {error ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            className="w-full"
            disabled={submitting || !username || !password}
            onClick={onSubmit}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            دخول
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
