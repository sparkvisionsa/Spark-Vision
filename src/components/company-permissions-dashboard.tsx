"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, KeyRound, Loader2, LockKeyhole, Pencil, Plus, RotateCcw, Save, Search, ShieldCheck, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PermissionPagePreview } from "@/components/permissions/permission-page-preview";
import { toApiUrl } from "@/lib/api-url";
import { VALUE_TECH_PRODUCT_LABELS_AR, type ValueTechProductId } from "@/lib/value-tech-products";
import { cn } from "@/lib/utils";

export type PermissionProfile = {
  id: string;
  name: string;
  grants: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type CatalogPage = {
  key: string;
  label: string;
  description: string;
  actions: Array<{ key: string; label: string }>;
};

export type PermissionUser = {
  id: string;
  username: string;
  phone?: string | null;
  email?: string | null;
  productIds?: string[];
  valuationReportDisplayName?: string | null;
  valuationReportJobTitle?: string | null;
  valuationReportMembershipNo?: string | null;
  lastLoginAt?: string | null;
  role: string;
  permissionProfileIds?: Partial<Record<ValueTechProductId, string[]>>;
  permissionOverrides?: Partial<Record<ValueTechProductId, { allow?: string[]; deny?: string[] }>>;
};

async function apiJson<T>(url: string, csrfToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(toApiUrl(url), {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & { message?: string | string[] };
  if (!response.ok) {
    const message = body.message;
    throw new Error(Array.isArray(message) ? message.join(" ") : message || "تعذر تنفيذ الطلب.");
  }
  return body;
}

export async function loadPermissionProfiles(
  productId: ValueTechProductId,
  csrfToken: string,
): Promise<{ catalog: CatalogPage[]; profiles: PermissionProfile[] }> {
  return apiJson(`/api/company/permissions?productId=${encodeURIComponent(productId)}`, csrfToken);
}

function allCatalogGrants(catalog: CatalogPage[]) {
  return catalog.flatMap((page) => page.actions.map((action) => `${page.key}.${action.key}`));
}

const ROLE_LABELS: Record<string, string> = {
  company_admin: "مدير الشركة", department_head: "رئيس قسم", valuer: "مقيم أساسي",
  viewer: "مقيم أساسي", associate_valuer: "مقيم منتسب", accredited_valuer: "مقيم معتمد",
  data_entry: "مدخل بيانات", reviewer: "مراجع", inspector: "معاين",
};
const PAGE_SIZE = 10;
const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50";
const modalClass = "flex h-[92dvh] max-h-[900px] w-[calc(100%-1rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 sm:rounded-2xl";

function displayName(user: PermissionUser) {
  return user.valuationReportDisplayName?.trim() || user.username;
}
function isCustom(user: PermissionUser, productId: ValueTechProductId) {
  const overrides = user.permissionOverrides?.[productId];
  return Boolean(overrides?.allow?.length || overrides?.deny?.length);
}
function baseGrants(ids: string[], profiles: PermissionProfile[]) {
  return [...new Set(profiles.filter((profile) => ids.length ? ids.includes(profile.id) : profile.isDefault).flatMap((profile) => profile.grants))];
}
function assignedProfiles(user: PermissionUser, profiles: PermissionProfile[], productId: ValueTechProductId) {
  const ids = user.permissionProfileIds?.[productId] ?? [];
  return profiles.filter((profile) => ids.length ? ids.includes(profile.id) : profile.isDefault);
}

function Checkbox({ checked, onChange, disabled, label, accessibleLabel }: { checked: boolean; onChange: () => void; disabled?: boolean; label: string; accessibleLabel?: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={accessibleLabel || label} disabled={disabled} onClick={onChange}
      className={cn("inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 text-right text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-70", checked ? "border-sky-200 bg-sky-50 text-sky-800" : "border-slate-200 bg-white text-slate-500 hover:border-slate-400")}>
      <span aria-hidden="true" className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", checked ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 bg-white")}>{checked ? <Check className="h-3 w-3" /> : null}</span>
      {label}
    </button>
  );
}

function PermissionMatrix({ productId, catalog, grants, onChange, readOnly = false }: { productId: ValueTechProductId; catalog: CatalogPage[]; grants: string[]; onChange: (next: string[]) => void; readOnly?: boolean }) {
  const [search, setSearch] = useState("");
  const selected = useMemo(() => new Set(grants), [grants]);
  const pages = catalog.filter((page) => [page.label, page.description, ...page.actions.map((action) => action.label)].join(" ").includes(search.trim()));
  const toggle = (page: CatalogPage, action: string) => {
    const next = new Set(selected);
    const key = page.key + "." + action;
    if (next.has(key)) {
      next.delete(key);
      if (action === "access") page.actions.forEach((item) => next.delete(page.key + "." + item.key));
    } else {
      next.add(key);
      if (page.actions.some((item) => item.key === "access")) next.add(page.key + ".access");
    }
    onChange([...next]);
  };
  return (
    <section aria-label="الصفحات والإجراءات" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-sm font-bold text-slate-900">الصفحات والإجراءات</h3><p className="mt-1 text-xs text-slate-500">حدد الوصول لكل صفحة، ثم الإجراءات المسموحة داخلها.</p></div>
        {!readOnly ? <div className="flex gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => onChange(allCatalogGrants(catalog))}>تحديد الكل</Button><Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>إلغاء الكل</Button></div> : null}
      </div>
      <label className="relative block"><Search aria-hidden="true" className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><input aria-label="بحث في الصفحات والإجراءات" placeholder="ابحث عن صفحة أو إجراء..." value={search} onChange={(e) => setSearch(e.target.value)} className={cn(inputClass, "pr-9")} /></label>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="hidden grid-cols-[220px_minmax(0,1fr)] gap-4 border-b bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500 md:grid"><span>الصفحة</span><span>الإجراءات المتاحة</span></div>
        {pages.map((page) => {
          const keys = page.actions.map((action) => page.key + "." + action.key);
          const pageAll = keys.every((key) => selected.has(key));
          return <div key={page.key} className="grid gap-3 border-b border-slate-100 p-4 last:border-0 md:grid-cols-[220px_minmax(0,1fr)] md:gap-4">
            <div><h4 className="text-sm font-bold text-slate-800">{page.label}</h4><p className="mt-1 text-xs leading-5 text-slate-500">{page.description}</p><PermissionPagePreview productId={productId} pageKey={page.key} actions={page.actions} />{!readOnly ? <button type="button" onClick={() => onChange(pageAll ? grants.filter((grant) => !keys.includes(grant)) : [...new Set([...grants, ...keys])])} className="mt-2 block rounded text-xs font-semibold text-sky-700 underline-offset-4 hover:underline focus-visible:outline-sky-500">{pageAll ? "إلغاء إجراءات الصفحة" : "تحديد إجراءات الصفحة"}</button> : null}</div>
            <div className="flex flex-wrap content-start gap-2">{page.actions.map((action) => <Checkbox key={action.key} checked={selected.has(page.key + "." + action.key)} disabled={readOnly} onChange={() => toggle(page, action.key)} label={action.label} accessibleLabel={page.label + ": " + action.label} />)}</div>
          </div>;
        })}
        {!pages.length ? <p className="p-8 text-center text-sm text-slate-500">لا توجد صفحات تطابق البحث.</p> : null}
      </div>
    </section>
  );
}

type DashboardProps = { productId: ValueTechProductId; csrfToken: string; users: PermissionUser[]; onUsersChanged?: () => Promise<void> | void };

// Drafts belong to one system and must not survive a product switch.
export function CompanyPermissionsDashboard(props: DashboardProps) {
  return <PermissionsWorkspace key={props.productId} {...props} />;
}

function PermissionsWorkspace({ productId, csrfToken, users, onUsersChanged }: DashboardProps) {
  const [catalog, setCatalog] = useState<CatalogPage[]>([]);
  const [profiles, setProfiles] = useState<PermissionProfile[]>([]);
  const [members, setMembers] = useState(users);
  const [tab, setTab] = useState("users");
  const [search, setSearch] = useState("");
  const [profileFilter, setProfileFilter] = useState("");
  const [page, setPage] = useState(1);
  const [profileDraft, setProfileDraft] = useState<{ id: string; name: string; grants: string[]; readOnly: boolean } | null>(null);
  const [userDraft, setUserDraft] = useState<{ user: PermissionUser; profileIds: string[]; grants: string[] } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PermissionProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const productLabel = VALUE_TECH_PRODUCT_LABELS_AR[productId];
  const endpoint = "/api/company/permissions";
  const scope = "?productId=" + encodeURIComponent(productId);

  useEffect(() => { setMembers(users); }, [users]);
  useEffect(() => { setPage(1); }, [search, profileFilter, tab]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setLoadError(null);
    try {
      const payload = await apiJson<{ catalog: CatalogPage[]; profiles: PermissionProfile[] }>("/api/company/permissions?productId=" + encodeURIComponent(productId), csrfToken, { signal });
      if (signal?.aborted) return;
      setCatalog(payload.catalog); setProfiles(payload.profiles);
    } catch (e) { if (!signal?.aborted) setLoadError(e instanceof Error ? e.message : "تعذر تحميل الصلاحيات."); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [csrfToken, productId]);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);

  const systemMembers = members.filter((member) => !member.productIds || member.productIds.includes(productId));
  const query = search.trim().toLocaleLowerCase("ar");
  const filteredUsers = systemMembers.filter((member) => {
    const assigned = assignedProfiles(member, profiles, productId);
    const matchesProfile = !profileFilter || (profileFilter === "custom" ? isCustom(member, productId) : profileFilter === "admin" ? member.role === "company_admin" : member.role !== "company_admin" && assigned.some((profile) => profile.id === profileFilter));
    const haystack = [displayName(member), member.username, member.phone, member.email, member.valuationReportMembershipNo, ROLE_LABELS[member.role] || member.role, ...assigned.map((profile) => profile.name)].join(" ").toLocaleLowerCase("ar");
    return matchesProfile && haystack.includes(query);
  });
  const filteredProfiles = profiles.filter((profile) => profile.name.toLocaleLowerCase("ar").includes(query));
  const total = tab === "users" ? filteredUsers.length : filteredProfiles.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;

  const notifyPermissionsChanged = () => window.dispatchEvent(new CustomEvent("sv:permissions-updated", { detail: { productId } }));
  const refreshUsers = async () => {
    try { await onUsersChanged?.(); }
    catch { setNotice("تم الحفظ. تعذر تحديث بيانات المستخدمين؛ أعد تحميل الصفحة لعرض أحدث البيانات."); }
  };
  const openProfile = (profile?: PermissionProfile) => {
    setEditorError(null);
    setProfileDraft(profile ? { id: profile.id, name: profile.name, grants: [...profile.grants], readOnly: profile.isDefault } : { id: "new", name: "", grants: [...(profiles.find((item) => item.isDefault)?.grants ?? [])], readOnly: false });
  };
  const openUser = (user: PermissionUser) => {
    if (user.role === "company_admin") return;
    const ids = user.permissionProfileIds?.[productId] ?? [];
    const effective = new Set(baseGrants(ids, profiles));
    const overrides = user.permissionOverrides?.[productId];
    (overrides?.allow ?? []).forEach((grant) => effective.add(grant));
    (overrides?.deny ?? []).forEach((grant) => effective.delete(grant));
    setEditorError(null); setUserDraft({ user, profileIds: [...ids], grants: [...effective] });
  };
  const toggleUserProfile = (id: string) => {
    if (!userDraft) return;
    // Choosing a custom profile replaces the implicit default; explicit selections can be combined.
    const nextIds = userDraft.profileIds.includes(id) ? userDraft.profileIds.filter((value) => value !== id) : [...userDraft.profileIds, id];
    const oldBase = new Set(baseGrants(userDraft.profileIds, profiles));
    const desired = new Set(userDraft.grants);
    const next = new Set(baseGrants(nextIds, profiles));
    userDraft.grants.filter((grant) => !oldBase.has(grant)).forEach((grant) => next.add(grant));
    [...oldBase].filter((grant) => !desired.has(grant)).forEach((grant) => next.delete(grant));
    setUserDraft({ ...userDraft, profileIds: nextIds, grants: [...next] });
  };
  const saveProfile = async () => {
    if (!profileDraft || profileDraft.readOnly || busy) return;
    if (profileDraft.name.trim().length < 2) { setEditorError("اكتب اسمًا للصلاحية من حرفين على الأقل."); return; }
    setBusy(true); setEditorError(null); setNotice(null);
    try {
      const isNew = profileDraft.id === "new";
      const { profile } = await apiJson<{ profile: PermissionProfile }>(endpoint + (isNew ? "" : "/" + encodeURIComponent(profileDraft.id)) + scope, csrfToken, { method: isNew ? "POST" : "PATCH", body: JSON.stringify({ name: profileDraft.name.trim(), grants: profileDraft.grants }) });
      setProfiles((current) => isNew ? [...current, profile] : current.map((item) => item.id === profile.id ? profile : item));
      setProfileDraft(null); setNotice(isNew ? "تم إنشاء الصلاحية. يمكنك تعيينها للمستخدمين من زر تعديل الصلاحيات." : "تم حفظ الصلاحية وتحديثها للمستخدمين المرتبطين بها.");
      notifyPermissionsChanged();
    } catch (e) { setEditorError(e instanceof Error ? e.message : "تعذر حفظ الصلاحية."); }
    finally { setBusy(false); }
  };
  const saveUser = async () => {
    if (!userDraft || busy) return;
    setBusy(true); setEditorError(null); setNotice(null);
    try {
      const result = await apiJson<{ profileIds: string[]; effectiveGrants: string[] }>(endpoint + "/users/" + encodeURIComponent(userDraft.user.id) + scope, csrfToken, { method: "PUT", body: JSON.stringify({ profileIds: userDraft.profileIds, effectiveGrants: userDraft.grants }) });
      const base = new Set(baseGrants(result.profileIds, profiles));
      const desired = new Set(result.effectiveGrants);
      setMembers((current) => current.map((member) => member.id !== userDraft.user.id ? member : {
        ...member, permissionProfileIds: { ...member.permissionProfileIds, [productId]: result.profileIds },
        permissionOverrides: { ...member.permissionOverrides, [productId]: { allow: [...desired].filter((grant) => !base.has(grant)), deny: [...base].filter((grant) => !desired.has(grant)) } },
      }));
      setNotice("تم حفظ صلاحيات " + displayName(userDraft.user) + "."); setUserDraft(null); notifyPermissionsChanged();
      await refreshUsers();
    } catch (e) { setEditorError(e instanceof Error ? e.message : "تعذر حفظ صلاحيات المستخدم."); }
    finally { setBusy(false); }
  };
  const removeProfile = async () => {
    if (!deleteTarget || deleteTarget.isDefault || busy) return;
    setBusy(true); setEditorError(null); setNotice(null);
    try {
      await apiJson(endpoint + "/" + encodeURIComponent(deleteTarget.id) + scope, csrfToken, { method: "DELETE" });
      setProfiles((current) => current.filter((profile) => profile.id !== deleteTarget.id));
      setMembers((current) => current.map((member) => ({ ...member, permissionProfileIds: { ...member.permissionProfileIds, [productId]: (member.permissionProfileIds?.[productId] ?? []).filter((id) => id !== deleteTarget.id) } })));
      setProfileFilter((current) => current === deleteTarget.id ? "" : current);
      setDeleteTarget(null); setNotice("تم حذف الصلاحية وتحديث ارتباطات المستخدمين."); notifyPermissionsChanged();
      await refreshUsers();
    } catch (e) { setEditorError(e instanceof Error ? e.message : "تعذر حذف الصلاحية."); }
    finally { setBusy(false); }
  };

  const errorMessage = editorError ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{editorError}</p> : null;

  return (
    <div className="space-y-5" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3"><span className="rounded-2xl bg-sky-100 p-3 text-[#0C447C]"><ShieldCheck className="h-6 w-6" /></span><div><h2 className="text-lg font-black text-slate-900">إدارة الصلاحيات</h2><p className="mt-1 text-sm text-slate-500">تحكم في وصول فريقك وصفحات العمل داخل {productLabel}.</p></div></div>
        <Button type="button" disabled={loading || Boolean(loadError) || busy} onClick={() => openProfile()} className="h-11 rounded-xl bg-[#0C447C] px-5 text-white hover:bg-[#093763]"><Plus />إضافة صلاحية جديدة</Button>
      </header>
      {notice ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p> : null}
      {loading ? <div role="status" className="flex min-h-64 items-center justify-center gap-2 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />جارٍ تحميل الصلاحيات...</div> : loadError ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700"><p>{loadError}</p><Button type="button" variant="outline" className="mt-3" onClick={() => void load()}>إعادة المحاولة</Button></div> : <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[{ label: "مستخدمو النظام", value: systemMembers.length, icon: Users }, { label: "الصلاحيات المحفوظة", value: profiles.length, icon: KeyRound }, { label: "مستخدمون بصلاحيات مخصصة", value: systemMembers.filter((member) => member.role !== "company_admin" && isCustom(member, productId)).length, icon: ShieldCheck }].map(({ label, value, icon: Icon }) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="rounded-xl bg-slate-50 p-2.5 text-slate-500"><Icon className="h-5 w-5" /></span><div><p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p><p className="text-xs text-slate-500">{label}</p></div></div>)}
        </div>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex border-b border-slate-200 px-4" aria-label="عرض الصلاحيات">
            {[{ id: "users", label: "المستخدمون", icon: Users }, { id: "profiles", label: "الصلاحيات المحفوظة", icon: KeyRound }].map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => { setTab(id); setSearch(""); }} className={cn("flex items-center gap-2 border-b-2 px-4 py-4 text-sm font-bold transition focus-visible:outline-sky-500", tab === id ? "border-[#0C447C] text-[#0C447C]" : "border-transparent text-slate-500 hover:text-slate-800")}><Icon className="h-4 w-4" />{label}</button>)}
          </div>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="relative block w-full sm:max-w-md"><Search aria-hidden="true" className="absolute right-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} aria-label={tab === "users" ? "بحث عن مستخدم" : "بحث عن صلاحية"} placeholder={tab === "users" ? "ابحث بالاسم، الهاتف، البريد أو الدور..." : "ابحث باسم الصلاحية..."} className={cn(inputClass, "pr-9")} /></label>
            {tab === "users" ? <select aria-label="تصفية المستخدمين حسب الصلاحية" value={profileFilter} onChange={(e) => setProfileFilter(e.target.value)} className={cn(inputClass, "sm:w-56")}><option value="">جميع الصلاحيات</option><option value="admin">مديرو الشركة</option><option value="custom">صلاحيات مخصصة للمستخدم</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select> : <p className="text-xs text-slate-500">تعديل الصلاحية ينعكس على المستخدمين المرتبطين بها.</p>}
          </div>
          <div className="overflow-x-auto">
            {tab === "users" ? <table className="w-full min-w-[900px] text-right text-sm" aria-label="مستخدمو الشركة وصلاحياتهم">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500"><tr>{["المستخدم", "التواصل", "الدور", "الصلاحية", "آخر دخول", "الإجراء"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-bold">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{filteredUsers.slice(start, start + PAGE_SIZE).map((member) => <tr key={member.id} className="transition hover:bg-slate-50/70">
                <td className="px-4 py-4"><div className="flex items-center gap-3"><span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 font-bold text-[#0C447C]">{displayName(member).slice(0, 1)}</span><div><p className="max-w-52 break-words font-bold text-slate-800">{displayName(member)}</p><p className="mt-1 text-xs text-slate-500" dir="auto">{member.username}</p>{member.valuationReportMembershipNo ? <p className="mt-1 text-xs text-slate-500">العضوية: {member.valuationReportMembershipNo}</p> : null}</div></div></td>
                <td className="px-4 py-4 text-xs text-slate-600"><p dir="ltr" className="text-right">{member.phone || "—"}</p><p dir="ltr" className="mt-1 max-w-56 break-words text-right text-slate-400">{member.email || "—"}</p></td>
                <td className="px-4 py-4"><p className="whitespace-nowrap text-xs font-semibold text-slate-700">{ROLE_LABELS[member.role] || member.role}</p>{member.valuationReportJobTitle ? <p className="mt-1 text-xs text-slate-400">{member.valuationReportJobTitle}</p> : null}</td>
                <td className="px-4 py-4"><div className="flex max-w-64 flex-wrap gap-1.5">{member.role === "company_admin" ? <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800"><ShieldCheck className="h-3.5 w-3.5" />جميع الصلاحيات</span> : <>{assignedProfiles(member, profiles, productId).map((profile) => <span key={profile.id} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{profile.name}</span>)}{isCustom(member, productId) ? <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">تخصيص فردي</span> : null}</>}</div></td>
                <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{member.lastLoginAt && !Number.isNaN(Date.parse(member.lastLoginAt)) ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeZone: "Asia/Riyadh", calendar: "gregory" }).format(new Date(member.lastLoginAt)) : "لم يسجل الدخول"}</td>
                <td className="px-4 py-4">{member.role === "company_admin" ? <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-400"><LockKeyhole className="h-3.5 w-3.5" />صلاحيات كاملة</span> : <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => openUser(member)} aria-label={"تعديل صلاحيات " + displayName(member)} className="rounded-lg border-sky-200 text-[#0C447C] hover:bg-sky-50"><Pencil />تعديل الصلاحيات</Button>}</td>
              </tr>)}</tbody>
            </table> : <table className="w-full min-w-[650px] text-right text-sm" aria-label="الصلاحيات المحفوظة">
              <thead className="border-y border-slate-100 bg-slate-50 text-xs text-slate-500"><tr>{["اسم الصلاحية", "النوع", "الصفحات المتاحة", "المستخدمون", "الإجراءات"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-bold">{label}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{filteredProfiles.slice(start, start + PAGE_SIZE).map((profile) => <tr key={profile.id} className="hover:bg-slate-50/70">
                <td className="px-4 py-4 font-bold text-slate-800"><span className="flex items-center gap-2"><KeyRound className="h-4 w-4 shrink-0 text-sky-600" />{profile.name}</span></td>
                <td className="px-4 py-4"><span className={cn("rounded-lg px-2 py-1 text-xs", profile.isDefault ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600")}>{profile.isDefault ? "افتراضية" : "مخصصة"}</span></td>
                <td className="px-4 py-4 text-slate-600">{catalog.filter((item) => profile.grants.includes(item.key + ".access")).length} / {catalog.length}</td>
                <td className="px-4 py-4 text-slate-600">{systemMembers.filter((member) => member.role !== "company_admin" && assignedProfiles(member, profiles, productId).some((item) => item.id === profile.id)).length}</td>
                <td className="px-4 py-4"><div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => openProfile(profile)} aria-label={(profile.isDefault ? "عرض" : "تعديل") + " صلاحية " + profile.name} className="rounded-lg">{profile.isDefault ? "عرض التفاصيل" : <><Pencil />تعديل</>}</Button>{!profile.isDefault ? <Button type="button" size="icon" variant="ghost" disabled={busy} aria-label={"حذف صلاحية " + profile.name} onClick={() => { setEditorError(null); setDeleteTarget(profile); }} className="h-9 w-9 text-rose-600 hover:bg-rose-50 hover:text-rose-700"><Trash2 /></Button> : null}</div></td>
              </tr>)}</tbody>
            </table>}
          </div>
          {!total ? <div className="px-4 py-14 text-center"><Search className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="text-sm font-bold text-slate-600">{search || profileFilter ? "لا توجد نتائج تطابق البحث" : tab === "users" ? "لا يوجد مستخدمون في هذا النظام بعد" : "لا توجد صلاحيات محفوظة"}</p><p className="mt-2 text-xs text-slate-400">{search || profileFilter ? "جرّب تغيير كلمات البحث أو تصفية الصلاحيات." : "سيظهر المستخدمون المنضمون للشركة والمصرح لهم بهذا النظام هنا."}</p></div> : null}
          <footer className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3"><p className="text-xs text-slate-500">{total ? (start + 1) + "–" + Math.min(start + PAGE_SIZE, total) + " من " + total : "0 نتائج"}</p><div className="flex items-center gap-2"><Button type="button" size="icon" variant="outline" aria-label="الصفحة السابقة" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="h-8 w-8 rounded-lg"><ChevronRight /></Button><span className="text-xs tabular-nums text-slate-500">{currentPage} / {totalPages}</span><Button type="button" size="icon" variant="outline" aria-label="الصفحة التالية" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)} className="h-8 w-8 rounded-lg"><ChevronLeft /></Button></div></footer>
        </section>
      </>}

      <Dialog open={Boolean(profileDraft)} onOpenChange={(open) => { if (!open && !busy) setProfileDraft(null); }}>
        <DialogContent dir="rtl" className={modalClass} hideCloseButton={busy}>
          {profileDraft ? <form onSubmit={(event) => { event.preventDefault(); void saveProfile(); }} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-5 py-5 pl-12"><DialogTitle className="text-right text-base font-black">{profileDraft.id === "new" ? "إضافة صلاحية جديدة" : profileDraft.readOnly ? "تفاصيل الصلاحية الافتراضية" : "تعديل الصلاحية"}</DialogTitle><DialogDescription className="mt-2 text-right text-xs leading-5">{productLabel} · {profileDraft.readOnly ? "الصلاحية الافتراضية محفوظة للنظام. أنشئ صلاحية جديدة لتحديد وصول مختلف." : "سمّ الصلاحية وحدد صفحاتها وإجراءاتها، ثم عيّنها للمستخدمين."}</DialogDescription></div>
            <div data-permissions-scroll role="region" aria-label="محتوى الصلاحية" tabIndex={0} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 focus-visible:outline-sky-500 sm:p-5">
            <fieldset disabled={busy} className="min-w-0 space-y-5">
              {errorMessage}
              <label className="block"><span className="mb-2 block text-xs font-bold text-slate-700">اسم الصلاحية</span><input required minLength={2} maxLength={80} autoFocus value={profileDraft.name} disabled={profileDraft.readOnly} onChange={(e) => setProfileDraft({ ...profileDraft, name: e.target.value })} placeholder="مثال: فريق إدخال بيانات المشاريع" className={inputClass} /></label>
              {!profileDraft.readOnly && profileDraft.id !== "new" ? <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">ستُطبّق التغييرات على المستخدمين المرتبطين بهذه الصلاحية، مع الاحتفاظ بتخصيصاتهم الفردية.</p> : null}
              <PermissionMatrix productId={productId} catalog={catalog} grants={profileDraft.grants} onChange={(grants) => setProfileDraft({ ...profileDraft, grants })} readOnly={profileDraft.readOnly} />
            </fieldset>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4"><span className="text-xs text-slate-500">{profileDraft.grants.length} إجراء محدد</span><div className="flex gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setProfileDraft(null)} className="rounded-xl">{profileDraft.readOnly ? "إغلاق" : "إلغاء"}</Button>{!profileDraft.readOnly ? <Button type="submit" disabled={busy} className="rounded-xl bg-[#0C447C] text-white hover:bg-[#093763]">{busy ? <Loader2 className="animate-spin" /> : <Save />}{profileDraft.id === "new" ? "إنشاء الصلاحية" : "حفظ التعديلات"}</Button> : null}</div></div>
          </form> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(userDraft)} onOpenChange={(open) => { if (!open && !busy) setUserDraft(null); }}>
        <DialogContent dir="rtl" className={modalClass} hideCloseButton={busy}>
          {userDraft ? <form onSubmit={(event) => { event.preventDefault(); void saveUser(); }} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-5 py-5 pl-12"><DialogTitle className="text-right text-base font-black">تعديل صلاحيات {displayName(userDraft.user)}</DialogTitle><DialogDescription className="mt-2 text-right text-xs leading-5">{ROLE_LABELS[userDraft.user.role] || userDraft.user.role} · {productLabel} · التعديلات هنا تخص هذا المستخدم فقط.</DialogDescription></div>
            <div data-permissions-scroll role="region" aria-label="صلاحيات المستخدم" tabIndex={0} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 focus-visible:outline-sky-500 sm:p-5">
            <fieldset disabled={busy} className="min-w-0 space-y-5">
              {errorMessage}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"><h3 className="mb-3 text-sm font-bold text-slate-800">الصلاحيات المعيّنة</h3><div className="flex flex-wrap gap-2">{profiles.map((profile) => <Checkbox key={profile.id} checked={userDraft.profileIds.includes(profile.id) || (!userDraft.profileIds.length && profile.isDefault)} onChange={() => toggleUserProfile(profile.id)} label={profile.name} />)}</div><p className="mt-3 text-xs leading-5 text-slate-500">يمكن تعيين أكثر من صلاحية. تُجمع إجراءات الصلاحيات المختارة، وتُطبّق الافتراضية عند عدم اختيار أي صلاحية.</p></div>
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs leading-5 text-slate-500">عدّل الإجراءات أدناه لتخصيص وصول المستخدم. تُحفظ التخصيصات عند تغيير الصلاحيات المعيّنة.</p><Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setUserDraft({ ...userDraft, grants: baseGrants(userDraft.profileIds, profiles) })}><RotateCcw />إعادة ضبط التخصيصات</Button></div>
              <PermissionMatrix productId={productId} catalog={catalog} grants={userDraft.grants} onChange={(grants) => setUserDraft({ ...userDraft, grants })} />
            </fieldset>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-4"><span className="text-xs text-slate-500">{userDraft.grants.length} إجراء محدد</span><div className="flex gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setUserDraft(null)} className="rounded-xl">إلغاء</Button><Button type="submit" disabled={busy} className="rounded-xl bg-[#0C447C] text-white hover:bg-[#093763]">{busy ? <Loader2 className="animate-spin" /> : <Save />}حفظ صلاحيات المستخدم</Button></div></div>
          </form> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && !busy) setDeleteTarget(null); }}>
        <DialogContent dir="rtl" hideCloseButton={busy} className="w-[calc(100%-2rem)] rounded-2xl bg-white sm:rounded-2xl">
          <DialogTitle className="text-right">حذف صلاحية «{deleteTarget?.name}»</DialogTitle>
          <DialogDescription className="text-right leading-6">ستُزال هذه الصلاحية من المستخدمين المرتبطين بها. سيعتمد من ليس لديه صلاحية أخرى على الصلاحية الافتراضية مع الاحتفاظ بالتخصيصات الفردية.</DialogDescription>
          {errorMessage}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setDeleteTarget(null)}>إلغاء</Button><Button type="button" variant="destructive" disabled={busy} onClick={() => void removeProfile()}>{busy ? <Loader2 className="animate-spin" /> : <Trash2 />}تأكيد الحذف</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
