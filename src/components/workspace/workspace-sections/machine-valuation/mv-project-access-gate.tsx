"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { Button } from "@/components/ui/button";
import { MvPageLoading } from "./mv-ui";
import { useMvI18n } from "./mv-i18n";

type AccessState = "checking" | "allowed" | "retry";

/**
 * Project URLs are guessable and can remain in the address bar after logout.
 * Do not mount any project workspace until the server has authorized the
 * project for the principal currently authenticated in this browser tab.
 */
export function MvProjectAccessGate({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const { user, loading } = useAuthTracking();
  const { t } = useMvI18n();
  const router = useRouter();
  const [state, setState] = useState<AccessState>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (loading) {
      setState("checking");
      return;
    }
    if (!user) {
      setState("checking");
      return;
    }

    const controller = new AbortController();
    setState("checking");
    void (async () => {
      try {
        const response = await fetch(
          `/api/mv/projects/${encodeURIComponent(projectId)}?picAssetMode=summary`,
          {
            credentials: "include",
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (controller.signal.aborted) return;
        if (response.ok) {
          setState("allowed");
          return;
        }
        // 401/403/404 intentionally share the same redirect: do not reveal
        // whether another company owns the project referenced by the URL.
        router.replace("/machine-valuation/projects");
      } catch (error) {
        if (controller.signal.aborted) return;
        setState("retry");
      }
    })();
    return () => controller.abort();
  }, [attempt, loading, projectId, router, user?.companyId, user?.id, user?.role]);

  if (state === "allowed") return <>{children}</>;

  if (state === "retry") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3" dir="rtl">
        <p className="text-sm font-semibold text-slate-700">تعذر التحقق من صلاحية المشروع.</p>
        <Button type="button" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  return <MvPageLoading label={t("index.openingWorkspace")} />;
}
