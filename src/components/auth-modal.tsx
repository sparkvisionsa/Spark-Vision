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

type Mode = "login" | "register";

export default function AuthModal({
  open,
  onOpenChange,
  initialMode = "login",
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  initialMode?: Mode;
}) {
  const { login, register } = useAuthTracking();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError("");
      setUsername("");
      setPassword("");
      setEmail("");
      setPhone("");
      setRememberMe(false);
    }
  }, [open, initialMode]);

  const onSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const normalizedUsername = username.trim();
      const normalizedEmail = email.trim();
      const normalizedPhone = phone.trim();
      if (mode === "login") {
        await login({ username: normalizedUsername, password, rememberMe });
      } else {
        if (normalizedUsername.length < 3) {
          throw new Error("Username must be at least 3 characters.");
        }
        if (!/^[A-Za-z0-9_.-]+$/.test(normalizedUsername)) {
          throw new Error("Username can only use letters, numbers, underscore, dot, or dash.");
        }
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters.");
        }
        await register({
          username: normalizedUsername,
          password,
          email: normalizedEmail,
          phone: normalizedPhone,
        });
      }
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "login" ? "Sign in to Spark Vision" : "Create your account"}
          </DialogTitle>
          <DialogDescription>
            {mode === "login"
              ? "Use your credentials to continue."
              : "Register to unlock unlimited access."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="auth-username">Username</Label>
            <Input
              id="auth-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="username"
              autoComplete="username"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="auth-password">Password</Label>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="********"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>

          {mode === "register" ? (
            <>
              <div className="grid gap-2">
                <Label htmlFor="auth-email">Email (optional)</Label>
                <Input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="auth-phone">Phone (optional)</Label>
                <Input
                  id="auth-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="+1..."
                  autoComplete="tel"
                />
              </div>
            </>
          ) : (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              Remember me
            </label>
          )}

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
            {mode === "login" ? "Sign in" : "Register"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              setMode((prev) => (prev === "login" ? "register" : "login"));
              setError("");
            }}
          >
            {mode === "login"
              ? "Need an account? Register"
              : "Already have an account? Sign in"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
