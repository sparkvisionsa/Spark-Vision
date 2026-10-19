"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ShieldX } from "lucide-react";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { toApiUrl } from "@/lib/api-url";
import type { ValueTechProductId } from "@/lib/value-tech-products";

type EffectiveResponse = { productId: ValueTechProductId; unrestricted: boolean; grants: string[] };

type PermissionState = {
  productId: ValueTechProductId;
  payload: EffectiveResponse | null;
  loading: boolean;
  refresh: () => void;
};

const ProductPermissionsContext = createContext<PermissionState | null>(null);

function usePermissionResource(productId: ValueTechProductId, enabled = true): PermissionState {
  const { user, loading: authLoading } = useAuthTracking();
  const [payload, setPayload] = useState<EffectiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const requestId = useRef(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let active = true;
    const currentRequest = ++requestId.current;
    if (authLoading) {
      setLoading(true);
      return () => { active = false; };
    }
    if (!user) {
      setPayload({ productId, unrestricted: false, grants: [] });
      setLoading(false);
      return () => { active = false; };
    }
    if (user.role === "company_admin" || user.role === "super_admin") {
      setPayload({ productId, unrestricted: true, grants: [] });
      setLoading(false);
      return () => { active = false; };
    }
    // Fail closed while refreshing so a revoked control can never remain interactive.
    setPayload(null);
    setLoading(true);
    fetch(toApiUrl(`/api/company/permissions/effective?productId=${encodeURIComponent(productId)}`), {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("permissions_unavailable");
        return response.json() as Promise<EffectiveResponse>;
      })
      .then((next) => { if (active && requestId.current === currentRequest) setPayload(next); })
      .catch(() => { if (active && requestId.current === currentRequest) setPayload({ productId, unrestricted: false, grants: [] }); })
      .finally(() => { if (active && requestId.current === currentRequest) setLoading(false); });
    return () => { active = false; };
  }, [authLoading, enabled, productId, revision, user?.companyId, user?.id, user?.role]);

  return { productId, payload, loading: enabled ? authLoading || loading : false, refresh };
}

export function ProductPermissionsProvider({ productId, children }: { productId: ValueTechProductId; children: React.ReactNode }) {
  const pathname = usePathname();
  const state = usePermissionResource(productId);
  const refresh = state.refresh;

  useEffect(() => {
    const handlePermissionsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ productId?: ValueTechProductId }>).detail;
      if (!detail?.productId || detail.productId === productId) refresh();
    };
    const handleFocus = () => refresh();
    const handleVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("sv:permissions-updated", handlePermissionsUpdated);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("sv:permissions-updated", handlePermissionsUpdated);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [productId, refresh]);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  return <ProductPermissionsContext.Provider value={state}>{children}</ProductPermissionsContext.Provider>;
}

export function useProductPermissions(productId: ValueTechProductId) {
  const context = useContext(ProductPermissionsContext);
  const fallback = usePermissionResource(productId, context?.productId !== productId);
  const state = context?.productId === productId ? context : fallback;

  const grantSet = useMemo(() => new Set(state.payload?.grants ?? []), [state.payload?.grants]);
  const can = useCallback((grant: string) => Boolean(state.payload?.unrestricted || grantSet.has(grant)), [grantSet, state.payload?.unrestricted]);
  return {
    can,
    grants: state.payload?.grants ?? [],
    unrestricted: state.payload?.unrestricted ?? false,
    loading: state.loading,
    refresh: state.refresh,
  };
}

export function Can({
  productId,
  permission,
  children,
  fallback = null,
}: {
  productId: ValueTechProductId;
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { can, loading } = useProductPermissions(productId);
  if (loading || !can(permission)) return fallback;
  return children;
}

function requiredPageGrant(pathname: string, productId: ValueTechProductId): string | null {
  const parts = pathname.split(/[?#]/)[0]!.split("/").filter(Boolean);
  if (productId === "real-estate-valuation") {
    if (parts[0] === "real-estate-valuation" && (parts[1] === "support" || parts[1] === "developer-requests")) return "support.access";
    if (parts[0] === "clients") return "clients.access";
    if (parts[0] === "settings") return "settings_company.access";
    if (parts[0] === "real-estate-valuation" && parts[1] === "report-settings") return "settings_reports.access";
    return "transactions.access";
  }
  const panel = parts[1] ?? "projects";
  if (panel === "archive" || panel === "projects" || panel === "dashboard") return "projects.access";
  if (panel === "data-extraction") return "data_extraction.access";
  if (panel === "clients") return "clients.access";
  if (panel === "support" || panel === "developer-requests") return "support.access";
  if (panel === "settings") {
    const section = parts[2] ?? "general";
    const tab = parts[3] ?? "info";
    if (section === "report") return "settings_reports.access";
    if (section === "serial-numbering") return "settings_serial.access";
    if (tab === "users") return "settings_users.access";
    if (tab === "permissions") return "settings_permissions.access";
    if (tab === "asset-descriptions") return "settings_assets.access";
    return "settings_company.access";
  }
  if (panel === "company") return "settings_company.access";
  if (panel === "report-settings") return "settings_reports.access";
  const workflow = parts[3] ?? "";
  if (workflow === "report-data") return "project_workflow.access";
  if (/asset-images|attachments|files/.test(workflow)) return "asset_media.access";
  if (/valuation/.test(workflow)) return "valuation.access";
  if (/report/.test(workflow)) return "reports.access";
  if (/import|asset-data/.test(workflow)) return "asset_data.access";
  return "project_workflow.access";
}

export function ProductPermissionGate({ productId, children }: { productId: ValueTechProductId; children: React.ReactNode }) {
  const pathname = usePathname();
  const { can, loading } = useProductPermissions(productId);
  const required = requiredPageGrant(pathname, productId);
  if (loading) return <div className="min-h-40 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />;
  if (required && !can(required)) {
    return (
      <div className="mx-auto mt-8 max-w-xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm" dir="rtl">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><ShieldX className="h-6 w-6" /></span>
        <h1 className="mt-4 text-lg font-black text-slate-900">لا تملك صلاحية الوصول إلى هذه الصفحة</h1>
        <p className="mt-2 text-sm leading-7 text-slate-600">اطلب من مدير الشركة إضافة الصفحة أو الإجراء إلى صلاحياتك داخل هذا النظام.</p>
      </div>
    );
  }
  return children;
}

