"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "@/components/prefetch-link";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { toApiUrl } from "@/lib/api-url";
import { imageFileToSignaturePngDataUrl } from "@/lib/signature-image-png";
import {
  VALUE_TECH_PRODUCT_IDS,
  VALUE_TECH_PRODUCT_LABELS_AR,
  type ValueTechProductId,
} from "@/lib/value-tech-products";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Building2, Loader2, MoreVertical, PenLine, Plus, Trash2, Upload, Users } from "lucide-react";

export type CompanyAdminDashboardVariant = "standalone" | "embedded";

type CompanyInfo = {
  id: string;
  name: string;
  valueTechProductIds: string[];
  logoDataUrl?: string | null;
  employeeCount?: number;
};

type CompanyUserRow = {
  id: string;
  username: string;
  role: string;
  companyId: string;
  email?: string | null;
  phone?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
  valuationReportSignatureDataUrl?: string | null;
};

const ROLE_LABELS: Record<string, string> = {
  company_admin: "مدير الشركة",
  valuer: "مقيم",
  viewer: "مقيم",
  data_entry: "مدخل بيانات",
  reviewer: "مراجع",
  inspector: "مفتش ميداني",
};

type MemberRoleOption = "valuer" | "data_entry" | "reviewer" | "inspector";

function rowRoleToSelectValue(role: string): MemberRoleOption {
  if (role === "viewer") return "valuer";
  if (role === "data_entry" || role === "reviewer" || role === "inspector" || role === "valuer") {
    return role;
  }
  return "valuer";
}

function canManageCompanyUserRow(target: CompanyUserRow, currentUserId: string | undefined): boolean {
  if (!currentUserId) return false;
  if (target.role === "company_admin" && target.id !== currentUserId) return false;
  return true;
}

function canDeleteCompanyUserRow(target: CompanyUserRow, currentUserId: string | undefined): boolean {
  if (!currentUserId) return false;
  if (target.id === currentUserId) return false;
  if (target.role === "company_admin") return false;
  return true;
}

async function apiJson<T>(url: string, csrfToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(toApiUrl(url), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
      details?: { formErrors?: string[]; fieldErrors?: Record<string, string[] | string> };
    };
    const fieldErrs = body.details?.fieldErrors;
    const fieldMsg =
      fieldErrs &&
      Object.entries(fieldErrs)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
        .join(" — ");
    throw new Error(fieldMsg || body.message || body.error || "Request failed");
  }
  return (await response.json()) as T;
}

function LogoUploader({
  dataUrl,
  onChange,
  busy,
}: {
  dataUrl: string | null;
  onChange: (next: string | null) => void;
  busy: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = useCallback(() => inputRef.current?.click(), []);
  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const url = await imageFileToSignaturePngDataUrl(file, 512);
      if (url) onChange(url);
    },
    [onChange],
  );
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png"
        className="sr-only"
        onChange={onFile}
      />
      <div
        className={cn(
          "flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-inner",
          !dataUrl && "border-dashed",
        )}
      >
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="" className="max-h-full max-w-full object-contain" />
        ) : (
          <Building2 className="h-10 w-10 text-slate-300" />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5 rounded-xl"
          disabled={busy}
          onClick={pick}
        >
          <Upload className="h-4 w-4" />
          رفع شعار
        </Button>
        {dataUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-xl text-rose-600 hover:bg-rose-50"
            disabled={busy}
            onClick={() => onChange(null)}
          >
            إزالة
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function MemberSignatureCell({
  savedUrl,
  busy,
  onPersist,
}: {
  savedUrl: string | null;
  busy: boolean;
  onPersist: (url: string | null) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pick = useCallback(() => inputRef.current?.click(), []);
  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const url = await imageFileToSignaturePngDataUrl(file);
      if (url) await onPersist(url);
    },
    [onPersist],
  );
  const has = Boolean(savedUrl);
  return (
    <div className="flex min-h-[4rem] flex-col items-stretch justify-center gap-2 p-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png"
        className="sr-only"
        onChange={onFile}
      />
      {has ? (
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={savedUrl!} alt="" className="max-h-16 max-w-full bg-transparent object-contain" />
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-[11px]"
              disabled={busy}
              onClick={pick}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              تغيير
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-[11px] text-rose-600"
              disabled={busy}
              onClick={() => void onPersist(null)}
            >
              حذف
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1 text-[11px]"
          disabled={busy}
          onClick={pick}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          رفع توقيع
        </Button>
      )}
    </div>
  );
}

export default function CompanyAdminDashboard({ variant }: { variant: CompanyAdminDashboardVariant }) {
  const { user, csrfToken, loading } = useAuthTracking();
  const [data, setData] = useState<{
    company: CompanyInfo | null;
    users: CompanyUserRow[];
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [brandingBusy, setBrandingBusy] = useState(false);
  const [signatureBusyUserId, setSignatureBusyUserId] = useState<string | null>(null);
  const [logoDraft, setLogoDraft] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"valuer" | "data_entry" | "reviewer" | "inspector">("valuer");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CompanyUserRow | null>(null);
  const [editRole, setEditRole] = useState<MemberRoleOption>("valuer");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CompanyUserRow | null>(null);
  const [userActionBusy, setUserActionBusy] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const payload = await apiJson<{
        company: CompanyInfo | null;
        users: CompanyUserRow[];
      }>("/api/company/users", csrfToken);
      setData({ company: payload.company, users: payload.users ?? [] });
      setLogoDraft(payload.company?.logoDataUrl ?? null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "تعذر التحميل.");
    }
  }, [csrfToken]);

  useEffect(() => {
    if (!loading && user?.role === "company_admin") {
      void load();
    }
  }, [load, loading, user?.role]);

  const canAccess = user?.role === "company_admin";

  const persistLogo = async () => {
    setBrandingBusy(true);
    setSubmitError(null);
    try {
      await apiJson("/api/company/branding", csrfToken, {
        method: "PATCH",
        body: JSON.stringify({
          logoDataUrl: logoDraft && logoDraft.length > 0 ? logoDraft : null,
        }),
      });
      setStatus("تم حفظ الشعار.");
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "فشل الحفظ.");
    } finally {
      setBrandingBusy(false);
    }
  };

  const persistMemberSignature = useCallback(
    async (userId: string, url: string | null) => {
      setSignatureBusyUserId(userId);
      setSubmitError(null);
      setStatus(null);
      try {
        await apiJson("/api/company/user-signature", csrfToken, {
          method: "PATCH",
          body: JSON.stringify({ userId, valuationReportSignatureDataUrl: url }),
        });
        setStatus("تم حفظ التوقيع.");
        await load();
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "فشل حفظ التوقيع.");
      } finally {
        setSignatureBusyUserId(null);
      }
    },
    [csrfToken, load],
  );

  const onAddUser = async () => {
    setSubmitting(true);
    setSubmitError(null);
    setStatus(null);
    try {
      const em = newEmail.trim();
      const ph = newPhone.trim();
      await apiJson("/api/company/users", csrfToken, {
        method: "POST",
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
          ...(em ? { email: em } : {}),
          ...(ph ? { phone: ph } : {}),
        }),
      });
      setStatus("تم إنشاء المستخدم.");
      setNewUsername("");
      setNewPassword("");
      setNewEmail("");
      setNewPhone("");
      setAddOpen(false);
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "فشل الإنشاء.");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditUser = useCallback((u: CompanyUserRow) => {
    setEditTarget(u);
    setEditRole(rowRoleToSelectValue(u.role));
    setEditEmail(u.email ?? "");
    setEditPhone(u.phone ?? "");
    setEditNewPassword("");
    setEditOpen(true);
    setSubmitError(null);
    setStatus(null);
  }, []);

  const onSaveEditedUser = async () => {
    if (!editTarget) return;
    const body: Record<string, unknown> = {};
    const origEmail = editTarget.email ?? "";
    const origPhone = editTarget.phone ?? "";
    if (editEmail.trim() !== origEmail.trim()) {
      body.email = editEmail.trim() || "";
    }
    if (editPhone.trim() !== origPhone.trim()) {
      body.phone = editPhone.trim() || "";
    }
    if (editTarget.role !== "company_admin" && editRole !== rowRoleToSelectValue(editTarget.role)) {
      body.role = editRole;
    }
    if (editNewPassword.trim().length > 0) {
      if (editNewPassword.trim().length < 8) {
        setSubmitError("كلمة المرور الجديدة يجب أن لا تقل عن 8 أحرف.");
        return;
      }
      body.newPassword = editNewPassword.trim();
    }
    if (Object.keys(body).length === 0) {
      setSubmitError("لم يتغيّر أي حقل.");
      return;
    }
    setUserActionBusy(true);
    setSubmitError(null);
    setStatus(null);
    try {
      await apiJson(`/api/company/users/${encodeURIComponent(editTarget.id)}`, csrfToken, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setStatus("تم تحديث المستخدم.");
      setEditOpen(false);
      setEditTarget(null);
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "فشل التحديث.");
    } finally {
      setUserActionBusy(false);
    }
  };

  const onConfirmDeleteUser = async () => {
    if (!deleteTarget) return;
    setUserActionBusy(true);
    setSubmitError(null);
    setStatus(null);
    try {
      await apiJson(`/api/company/users/${encodeURIComponent(deleteTarget.id)}`, csrfToken, {
        method: "DELETE",
      });
      setStatus("تم حذف المستخدم.");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "فشل الحذف.");
    } finally {
      setUserActionBusy(false);
    }
  };

  const shellClass =
    variant === "embedded"
      ? "flex min-h-0 flex-1 flex-col overflow-hidden"
      : "flex min-h-screen flex-col bg-[#f4f6fb]";

  if (!loading && !canAccess) {
    return (
      <div className={cn(shellClass, "items-center justify-center p-6")} dir="rtl">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-800">هذه اللوحة لمديري الشركة فقط.</p>
          <Button asChild className="mt-6 rounded-xl" variant="outline">
            <Link href="/value-tech">العودة</Link>
          </Button>
        </div>
      </div>
    );
  }

  const inner = (
    <div
      className={cn(
        "w-full flex-1",
        variant === "embedded" ? "min-h-0 overflow-y-auto px-3 py-4 md:px-6 md:py-5" : "px-4 py-8 md:px-8",
      )}
    >
      <div
        className={cn(
          "mx-auto w-full",
          variant === "embedded" ? "max-w-[1400px]" : "max-w-[1200px]",
        )}
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-[#0C447C] text-white shadow-md shadow-sky-900/15">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 md:text-xl">لوحة إدارة الشركة</h1>
              {data?.company?.name ? (
                <p className="text-[13px] font-medium text-slate-500">{data.company.name}</p>
              ) : null}
            </div>
          </div>
        </div>

        {loadError ? (
          <p className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {loadError}
          </p>
        ) : null}
        {submitError ? (
          <p className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {submitError}
          </p>
        ) : null}
        {status ? (
          <p className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {status}
          </p>
        ) : null}

        <Tabs defaultValue="info" className="flex min-h-0 flex-col gap-4" dir="rtl">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-slate-200/40 p-1 md:w-auto">
            <TabsTrigger
              value="info"
              className="rounded-xl px-4 py-2 text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              بيانات الشركة
            </TabsTrigger>
            <TabsTrigger
              value="users"
              className="rounded-xl px-4 py-2 text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              مستخدمو الشركة
            </TabsTrigger>
            <TabsTrigger
              value="signatories"
              className="rounded-xl px-4 py-2 text-[13px] data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              المقيمون والتوقيعات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-0 outline-none">
            <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm md:p-8">
              {!data ? (
                <div className="flex justify-center py-16 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-start">
                  <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-100">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">الاسم</p>
                        <p className="mt-1 text-lg font-bold text-slate-900">{data.company?.name ?? "—"}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-100">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">عدد الموظفين</p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                          {data.company?.employeeCount ?? data.users.length}
                        </p>
                      </div>
                    </div>
                    {data.company ? (
                      <p className="text-[12px] leading-relaxed text-slate-500">
                        منتجات فاليو تك:{" "}
                        {(() => {
                          const licensed = data.company.valueTechProductIds.filter((id) =>
                            (VALUE_TECH_PRODUCT_IDS as readonly string[]).includes(id),
                          );
                          return licensed.length
                            ? licensed
                                .map((id) => VALUE_TECH_PRODUCT_LABELS_AR[id as ValueTechProductId] ?? id)
                                .join("، ")
                            : "—";
                        })()}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-gradient-to-b from-sky-50/50 to-white p-5">
                    <p className="mb-3 text-[12px] font-semibold text-slate-600">شعار الشركة</p>
                    <LogoUploader
                      dataUrl={logoDraft}
                      onChange={(v) => {
                        setLogoDraft(v);
                        setStatus(null);
                      }}
                      busy={brandingBusy}
                    />
                    <Button
                      type="button"
                      className="mt-4 w-full rounded-xl bg-[#0C447C] hover:bg-[#0a3a66]"
                      disabled={brandingBusy}
                      onClick={() => void persistLogo()}
                    >
                      {brandingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      حفظ الشعار
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-0 outline-none">
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 md:px-6">
                <div className="flex items-center gap-2 text-slate-700">
                  <Users className="h-4 w-4 text-sky-600" />
                  <span className="text-[13px] font-semibold">الفريق</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 rounded-xl bg-sky-600 hover:bg-sky-700"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  مستخدم جديد
                </Button>
              </div>
              <div className="overflow-x-auto p-2 md:p-4">
                {!data ? (
                  <div className="flex justify-center py-12 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-100 hover:bg-transparent">
                        <TableHead className="text-right text-[12px] font-semibold text-slate-500">المستخدم</TableHead>
                        <TableHead className="text-right text-[12px] font-semibold text-slate-500">الدور</TableHead>
                        <TableHead className="text-right text-[12px] font-semibold text-slate-500">آخر دخول</TableHead>
                        <TableHead className="w-[52px] text-center text-[12px] font-semibold text-slate-500">
                          إجراءات
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.users.map((u) => {
                        const canEdit = canManageCompanyUserRow(u, user?.id);
                        const canDel = canDeleteCompanyUserRow(u, user?.id);
                        return (
                          <TableRow key={u.id} className="border-slate-100">
                            <TableCell className="font-medium text-slate-900">{u.username}</TableCell>
                            <TableCell className="text-slate-700">{ROLE_LABELS[u.role] ?? u.role}</TableCell>
                            <TableCell className="text-[12px] text-slate-500">
                              {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("ar") : "—"}
                            </TableCell>
                            <TableCell className="p-1 text-center">
                              {canEdit || canDel ? (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-slate-600"
                                      disabled={userActionBusy}
                                      aria-label={`إجراءات ${u.username}`}
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="z-[960] min-w-[10rem] [direction:rtl]"
                                  >
                                    {canEdit ? (
                                      <DropdownMenuItem
                                        className="cursor-pointer gap-2"
                                        onClick={() => openEditUser(u)}
                                      >
                                        تعديل البيانات
                                      </DropdownMenuItem>
                                    ) : null}
                                    {canDel ? (
                                      <DropdownMenuItem
                                        className="cursor-pointer gap-2 text-red-600 focus:text-red-600"
                                        onClick={() => {
                                          setDeleteTarget(u);
                                          setSubmitError(null);
                                        }}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        حذف المستخدم
                                      </DropdownMenuItem>
                                    ) : null}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              ) : (
                                <span className="text-[11px] text-slate-300">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="signatories" className="mt-0 outline-none">
            <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 md:px-6">
                <div className="flex items-center gap-2 text-slate-700">
                  <PenLine className="h-4 w-4 text-violet-600" />
                  <span className="text-[13px] font-semibold">المقيمون والتوقيعات</span>
                </div>
                <p className="text-[11px] text-slate-500">نفس مستخدمي الشركة — التوقيع يُحفظ لكل مستخدم في قاعدة البيانات.</p>
              </div>
              <div className="overflow-x-auto p-2 md:p-4">
                {!data ? (
                  <div className="flex justify-center py-12 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-100 hover:bg-transparent">
                        <TableHead className="text-right text-[12px] font-semibold text-slate-500">المستخدم</TableHead>
                        <TableHead className="text-right text-[12px] font-semibold text-slate-500">الدور</TableHead>
                        <TableHead className="text-right text-[12px] font-semibold text-slate-500">آخر دخول</TableHead>
                        <TableHead className="min-w-[200px] text-right text-[12px] font-semibold text-slate-500">
                          التوقيع (PNG)
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.users.map((u) => (
                        <TableRow key={u.id} className="border-slate-100">
                          <TableCell className="font-medium text-slate-900">{u.username}</TableCell>
                          <TableCell className="text-slate-700">{ROLE_LABELS[u.role] ?? u.role}</TableCell>
                          <TableCell className="text-[12px] text-slate-500">
                            {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("ar") : "—"}
                          </TableCell>
                          <TableCell className="p-0 align-top">
                            <MemberSignatureCell
                              savedUrl={u.valuationReportSignatureDataUrl ?? null}
                              busy={signatureBusyUserId === u.id}
                              onPersist={(url) => persistMemberSignature(u.id, url)}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md rounded-2xl border-slate-200" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">مستخدم جديد</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 pt-2">
            <div className="grid gap-1.5">
              <Label className="text-[12px] text-slate-600">اسم المستخدم</Label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[12px] text-slate-600">كلمة المرور</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[12px] text-slate-600">الدور</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as typeof newRole)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[960]">
                  <SelectItem value="valuer">مقيم</SelectItem>
                  <SelectItem value="inspector">مفتش / معاين ميداني</SelectItem>
                  <SelectItem value="data_entry">مدخل بيانات</SelectItem>
                  <SelectItem value="reviewer">مراجع</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[12px] text-slate-600">البريد (اختياري)</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-[12px] text-slate-600">الهاتف (اختياري)</Label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} dir="ltr" className="rounded-xl" />
            </div>
            <Button
              type="button"
              className="mt-2 rounded-xl bg-[#0C447C] hover:bg-[#0a3a66]"
              disabled={submitting || !newUsername.trim() || newPassword.length < 8}
              onClick={() => void onAddUser()}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              إنشاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditTarget(null);
        }}
      >
        <DialogContent className="max-w-md rounded-2xl border-slate-200" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              تعديل مستخدم{editTarget ? ` — ${editTarget.username}` : ""}
            </DialogTitle>
          </DialogHeader>
          {editTarget ? (
            <div className="grid gap-3 pt-2">
              {editTarget.role === "company_admin" ? (
                <p className="text-[12px] leading-relaxed text-slate-500">
                  كمدير شركة يمكنك تحديث بريدك وهاتفك وكلمة المرور فقط. تغيير الدور غير متاح من هنا.
                </p>
              ) : (
                <div className="grid gap-1.5">
                  <Label className="text-[12px] text-slate-600">الدور</Label>
                  <Select value={editRole} onValueChange={(v) => setEditRole(v as MemberRoleOption)}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[960]">
                      <SelectItem value="valuer">مقيم</SelectItem>
                      <SelectItem value="inspector">مفتش / معاين ميداني</SelectItem>
                      <SelectItem value="data_entry">مدخل بيانات</SelectItem>
                      <SelectItem value="reviewer">مراجع</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-1.5">
                <Label className="text-[12px] text-slate-600">البريد (اختياري)</Label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[12px] text-slate-600">الهاتف (اختياري)</Label>
                <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} dir="ltr" className="rounded-xl" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[12px] text-slate-600">كلمة مرور جديدة (اختياري)</Label>
                <Input
                  type="password"
                  value={editNewPassword}
                  onChange={(e) => setEditNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="اتركه فارغاً إن لم تتغيّر"
                  className="rounded-xl"
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  disabled={userActionBusy}
                  onClick={() => setEditOpen(false)}
                >
                  إلغاء
                </Button>
                <Button
                  type="button"
                  className="rounded-xl bg-[#0C447C] hover:bg-[#0a3a66]"
                  disabled={userActionBusy}
                  onClick={() => void onSaveEditedUser()}
                >
                  {userActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  حفظ التغييرات
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="z-[960] max-w-md rounded-2xl" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المستخدم؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              {deleteTarget
                ? `سيتم حذف «${deleteTarget.username}» نهائياً من الشركة. لا يمكن التراجع عن هذا الإجراء.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogCancel className="rounded-xl" disabled={userActionBusy}>
              إلغاء
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 text-white hover:bg-red-700"
              disabled={userActionBusy}
              onClick={(e) => {
                e.preventDefault();
                void onConfirmDeleteUser();
              }}
            >
              {userActionBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (variant === "standalone") {
    return (
      <div className={shellClass} dir="rtl">
        {inner}
      </div>
    );
  }

  return (
    <div className={shellClass} dir="rtl">
      {inner}
    </div>
  );
}
