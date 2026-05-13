"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import PageTransitionLoader from "@/components/ui/page-transition-loader";
import {
  userHasProductAccess,
  workspaceSectionToProductId,
  VALUE_TECH_PRODUCT_LABELS_AR,
  type ValueTechProductId,
} from "@/lib/value-tech-products";
import { cn } from "@/lib/utils";

type ValueTechAccessGateProps = {
  sectionKey: string;
  children: React.ReactNode;
};

export default function ValueTechAccessGate({ sectionKey, children }: ValueTechAccessGateProps) {
  const { user, loading, login } = useAuthTracking();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const productId = workspaceSectionToProductId(sectionKey);

  useEffect(() => {
    if (user && productId && !userHasProductAccess(user.valueTechProductIds, productId)) {
      router.replace("/value-tech");
    }
  }, [user, productId, router]);

  if (loading) {
    return <PageTransitionLoader />;
  }

  if (!user) {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4"
        dir="rtl"
      >
        <div
          className={cn(
            "w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-6 shadow-2xl shadow-black/40",
            "backdrop-blur-sm",
          )}
        >
          <h1 className="text-lg font-bold text-slate-900">تسجيل الدخول — فاليو تك</h1>
          <p className="mt-1 text-sm text-slate-600">
            أدخل اسم المستخدم وكلمة المرور الصادرة عن المسؤول للوصول إلى المنتجات.
          </p>

          <div className="mt-6 space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="vt-gate-user">اسم المستخدم</Label>
              <Input
                id="vt-gate-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="bg-white"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vt-gate-pass">كلمة المرور</Label>
              <Input
                id="vt-gate-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="bg-white"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              تذكرني على هذا الجهاز
            </label>
            {error ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}
            <Button
              type="button"
              className="w-full"
              disabled={submitting || !username.trim() || !password}
              onClick={async () => {
                setSubmitting(true);
                setError("");
                try {
                  await login({
                    username: username.trim(),
                    password,
                    rememberMe,
                  });
                  router.replace("/value-tech");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "فشل تسجيل الدخول.");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              دخول
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (productId && !userHasProductAccess(user.valueTechProductIds, productId)) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center" dir="rtl">
        <p className="text-lg font-semibold text-slate-900">لا صلاحية لهذا المنتج</p>
        <p className="max-w-md text-sm text-slate-600">
          حسابك لا يتضمن الوصول إلى:{" "}
          <span className="font-medium text-slate-800">
            {VALUE_TECH_PRODUCT_LABELS_AR[productId as ValueTechProductId] ?? productId}
          </span>
          . راجع المسؤول لديك.
        </p>
        <Button type="button" variant="outline" onClick={() => router.push("/value-tech")}>
          العودة إلى منتجات فاليو تك
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
