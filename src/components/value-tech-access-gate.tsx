"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { Button } from "@/components/ui/button";
import PageTransitionLoader from "@/components/ui/page-transition-loader";
import { ValueTechLoginScreen } from "@/components/value-tech-login-experience";
import {
  userHasProductAccess,
  workspaceSectionToProductId,
  VALUE_TECH_PRODUCT_LABELS_AR,
  type ValueTechProductId,
} from "@/lib/value-tech-products";

type ValueTechAccessGateProps = {
  sectionKey: string;
  children: React.ReactNode;
};

export default function ValueTechAccessGate({ sectionKey, children }: ValueTechAccessGateProps) {
  const { user, loading, login, backendUnavailable } = useAuthTracking();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const productId = workspaceSectionToProductId(sectionKey);

  useEffect(() => {
    if (user && productId && !userHasProductAccess(user.valueTechProductIds, productId)) {
      router.replace("/value-tech");
    }
  }, [user, productId, router]);

  // The products hub is public. Authentication starts only after a product card is opened.
  if (sectionKey === "vt") {
    return <>{children}</>;
  }

  if (loading) {
    return <PageTransitionLoader />;
  }

  if (backendUnavailable) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950 p-4" dir="rtl">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white p-6 text-right shadow-2xl shadow-black/40">
          <h1 className="text-lg font-bold text-slate-900">الخادم الخلفي غير متصل</h1>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            الواجهة تعمل، لكن تسجيل الدخول وبيانات تقييم الآلات تحتاج تشغيل
            SparkVision-Backend على المنفذ المحدد في ملف البيئة.
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left text-xs font-semibold text-slate-700" dir="ltr">
            cd C:\Users\TOSHIBA\Desktop\spark\SparkVision-Backend
            <br />
            npm run start:dev
          </div>
          <Button type="button" className="mt-5 w-full" onClick={() => window.location.reload()}>
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <ValueTechLoginScreen
        phone={phone}
        password={password}
        rememberMe={rememberMe}
        submitting={submitting}
        error={error}
        onPhoneChange={setPhone}
        onPasswordChange={setPassword}
        onRememberMeChange={setRememberMe}
        onSubmit={async () => {
          setSubmitting(true);
          setError("");
          try {
            await login({
              phone: phone.trim(),
              password,
              rememberMe,
            });
            // ابقَ على الصفحة الحالية بعد تجديد جلسة منتهية حتى يستطيع
            // المستخدم إعادة العملية التي توقفت بدلاً من فقد سياق العمل.
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "فشل تسجيل الدخول.");
          } finally {
            setSubmitting(false);
          }
        }}
      />
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
