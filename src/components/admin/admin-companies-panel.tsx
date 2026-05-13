"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, Eye, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { toApiUrl } from "@/lib/api-url";
import {
  VALUE_TECH_PRODUCT_IDS,
  VALUE_TECH_PRODUCT_LABELS_AR,
  type ValueTechProductId,
} from "@/lib/value-tech-products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";

type CompanyRow = {
  id: string;
  name: string;
  valueTechProductIds: string[];
  adminUserId: string;
  adminUsername: string;
  memberCount: number;
  createdAt: string;
};

type PublicUserShape = {
  id: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  role: string;
  companyId?: string | null;
  companyName?: string | null;
  valueTechProductIds: string[] | null;
  createdAt: string;
  lastLoginAt?: string | null;
};

type ProfileShape = {
  userId: string;
  email?: string | null;
  phone?: string | null;
  additionalInfo?: Record<string, unknown> | null;
  updatedAt?: string;
} | null;

type CompanyDetailPayload = {
  company: {
    id: string;
    name: string;
    valueTechProductIds?: string[] | null;
    adminUserId: string;
    createdAt: string;
    updatedAt: string;
  };
  admin: { user: PublicUserShape; profile: ProfileShape } | null;
  members: Array<{ user: PublicUserShape; profile: ProfileShape }>;
};

const ROLE_AR: Record<string, string> = {
  super_admin: "سوبر أدمن",
  company_admin: "مدير الشركة",
  valuer: "مقيم",
  viewer: "مقيم",
  inspector: "مفتش ميداني",
  data_entry: "مدخل بيانات",
  reviewer: "مراجع",
  user: "مستخدم",
};

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
    const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message ?? body.error ?? "Request failed");
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function productSummary(ids: string[] | null | undefined) {
  const list = Array.isArray(ids) ? ids : [];
  const licensed = list.filter((id) =>
    (VALUE_TECH_PRODUCT_IDS as readonly string[]).includes(id)
  );
  return licensed.length
    ? licensed.map((id) => VALUE_TECH_PRODUCT_LABELS_AR[id as ValueTechProductId] ?? id).join("، ")
    : "—";
}

export function AdminCompaniesPanel() {
  const { csrfToken } = useAuthTracking();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [products, setProducts] = useState<Record<ValueTechProductId, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    VALUE_TECH_PRODUCT_IDS.forEach((id) => {
      initial[id] = true;
    });
    return initial as Record<ValueTechProductId, boolean>;
  });

  const [viewOpen, setViewOpen] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewCompanyId, setViewCompanyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompanyDetailPayload | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editCompanyId, setEditCompanyId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editProducts, setEditProducts] = useState<Record<ValueTechProductId, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    VALUE_TECH_PRODUCT_IDS.forEach((id) => {
      initial[id] = true;
    });
    return initial as Record<ValueTechProductId, boolean>;
  });
  const [editAdminEmail, setEditAdminEmail] = useState("");
  const [editAdminPhone, setEditAdminPhone] = useState("");
  const [editAdminNewPassword, setEditAdminNewPassword] = useState("");

  const [deleteCompanyTarget, setDeleteCompanyTarget] = useState<CompanyRow | null>(null);
  const [deleteMemberTarget, setDeleteMemberTarget] = useState<{
    companyId: string;
    userId: string;
    username: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ companies: CompanyRow[] }>("/api/admin/companies", csrfToken);
      const rows = data.companies ?? [];
      setCompanies(
        rows.map((c) => ({
          ...c,
          valueTechProductIds: Array.isArray(c.valueTechProductIds) ? c.valueTechProductIds : [],
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load companies.");
    } finally {
      setLoading(false);
    }
  }, [csrfToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleProduct = (id: ValueTechProductId, checked: boolean, mode: "create" | "edit") => {
    if (mode === "create") {
      setProducts((prev) => ({ ...prev, [id]: checked }));
    } else {
      setEditProducts((prev) => ({ ...prev, [id]: checked }));
    }
  };

  const onCreate = async () => {
    setCreateSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      const valueTechProductIds = VALUE_TECH_PRODUCT_IDS.filter((id) => products[id]);
      const emailTrim = email.trim();
      const phoneTrim = phone.trim();
      await apiJson("/api/admin/companies", csrfToken, {
        method: "POST",
        body: JSON.stringify({
          companyName: companyName.trim(),
          username: username.trim(),
          password,
          ...(emailTrim ? { email: emailTrim } : {}),
          ...(phoneTrim ? { phone: phoneTrim } : {}),
          valueTechProductIds,
        }),
      });
      setStatus("تم إنشاء الشركة ومديرها بنجاح.");
      setCompanyName("");
      setUsername("");
      setPassword("");
      setEmail("");
      setPhone("");
      // أوقف حالة التحميل قبل إغلاق الـ Dialog لتفادي تعارض React/Radix (insertBefore/removeChild)
      setCreateSubmitting(false);
      setCreateOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الإنشاء.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openView = async (id: string) => {
    setViewCompanyId(id);
    setViewOpen(true);
    setDetail(null);
    setViewLoading(true);
    setError(null);
    try {
      const data = await apiJson<CompanyDetailPayload>(
        `/api/admin/companies/${encodeURIComponent(id)}/detail`,
        csrfToken
      );
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل التفاصيل.");
      setViewOpen(false);
    } finally {
      setViewLoading(false);
    }
  };

  const openEdit = async (row: CompanyRow) => {
    setEditCompanyId(row.id);
    setEditOpen(true);
    setEditSubmitting(false);
    setError(null);
    setEditName(row.name);
    const next: Record<ValueTechProductId, boolean> = {} as Record<ValueTechProductId, boolean>;
    const ids = Array.isArray(row.valueTechProductIds) ? row.valueTechProductIds : [];
    VALUE_TECH_PRODUCT_IDS.forEach((id) => {
      next[id] = ids.includes(id);
    });
    setEditProducts(next);
    setEditAdminEmail("");
    setEditAdminPhone("");
    setEditAdminNewPassword("");
    try {
      const data = await apiJson<CompanyDetailPayload>(
        `/api/admin/companies/${encodeURIComponent(row.id)}/detail`,
        csrfToken
      );
      const em = data.admin?.user?.email ?? data.admin?.profile?.email;
      const ph = data.admin?.user?.phone ?? data.admin?.profile?.phone;
      setEditAdminEmail(em?.trim() ?? "");
      setEditAdminPhone(ph?.trim() ?? "");
    } catch {
      // keep empty
    }
  };

  const onSaveEdit = async () => {
    if (!editCompanyId) return;
    setEditSubmitting(true);
    setError(null);
    setStatus(null);
    try {
      const valueTechProductIds = VALUE_TECH_PRODUCT_IDS.filter((id) => editProducts[id]);
      const body: Record<string, unknown> = {
        companyName: editName.trim(),
        valueTechProductIds,
        adminEmail: editAdminEmail.trim(),
        adminPhone: editAdminPhone.trim(),
      };
      if (editAdminNewPassword.length >= 8) {
        body.adminNewPassword = editAdminNewPassword;
      }
      await apiJson(`/api/admin/companies/${encodeURIComponent(editCompanyId)}`, csrfToken, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setStatus("تم حفظ التعديلات.");
      setEditSubmitting(false);
      setEditOpen(false);
      setEditAdminNewPassword("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الحفظ.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const confirmDeleteCompany = async () => {
    if (!deleteCompanyTarget) return;
    setError(null);
    try {
      await apiJson(
        `/api/admin/companies/${encodeURIComponent(deleteCompanyTarget.id)}`,
        csrfToken,
        { method: "DELETE" }
      );
      setStatus("تم حذف الشركة وجميع مستخدميها.");
      setDeleteCompanyTarget(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل الحذف.");
    }
  };

  const confirmDeleteMember = async () => {
    if (!deleteMemberTarget) return;
    const companyId = deleteMemberTarget.companyId;
    setError(null);
    try {
      await apiJson(
        `/api/admin/companies/${encodeURIComponent(companyId)}/users/${encodeURIComponent(deleteMemberTarget.userId)}`,
        csrfToken,
        { method: "DELETE" }
      );
      setStatus("تم حذف المستخدم.");
      setDeleteMemberTarget(null);
      await load();
      if (viewOpen && viewCompanyId === companyId) {
        await openView(companyId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل حذف المستخدم.");
    }
  };

  return (
    <>
      <Card dir="rtl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            إدارة الشركات
          </CardTitle>
          <CardDescription>
            الشركات في <code className="text-xs">companies</code>. المستخدمون: الحقل{" "}
            <code className="text-xs">company</code> (ObjectId) يشير لـ <code className="text-xs">_id</code>{" "}
            الشركة، والدور الفعلي في <code className="text-xs">role</code>؛ العضوية التفصيلية في{" "}
            <code className="text-xs">user_company_memberships</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible defaultValue="companies" className="w-full">
            <AccordionItem value="companies">
              <AccordionTrigger className="text-base font-semibold hover:no-underline">
                الشركات ومدراؤها (إضافة، تعديل، حذف، عرض)
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                {error ? (
                  <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {error}
                  </p>
                ) : null}
                {status ? (
                  <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                    {status}
                  </p>
                ) : null}

                <Button type="button" onClick={() => setCreateOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  إضافة شركة جديدة
                </Button>

                {loading ? (
                  <p className="text-sm text-slate-500">جاري التحميل...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الشركة</TableHead>
                        <TableHead className="text-right">مدير الشركة</TableHead>
                        <TableHead className="text-right">الأعضاء</TableHead>
                        <TableHead className="text-right">المنتجات</TableHead>
                        <TableHead className="text-right">تاريخ الإنشاء</TableHead>
                        <TableHead className="w-[220px] text-right">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="text-sm">{c.adminUsername || "—"}</TableCell>
                          <TableCell>{c.memberCount}</TableCell>
                          <TableCell className="max-w-[200px] text-xs text-slate-600">
                            {productSummary(c.valueTechProductIds)}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {new Date(c.createdAt).toLocaleString("ar")}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 justify-end">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1"
                                onClick={() => void openView(c.id)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                عرض
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1"
                                onClick={() => void openEdit(c)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                تعديل
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="h-8 gap-1"
                                onClick={() => setDeleteCompanyTarget(c)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                حذف
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* إنشاء شركة — المحتوى قابل للتمرير والتذييل ثابت ليبقى زر الحفظ ظاهراً */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          className="flex max-h-[min(92vh,900px)] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
          dir="rtl"
        >
          <DialogHeader className="shrink-0 space-y-1.5 px-6 pb-2 pt-6 text-right">
            <DialogTitle>إضافة شركة جديدة</DialogTitle>
            <DialogDescription>
              بيانات مدير الشركة ومنتجات فاليو تك. العملاء والإعدادات متاحان تلقائياً.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="min-h-0 flex-1 px-6">
            <div className="grid gap-3 py-2 pb-4 pr-3">
              <div className="grid gap-2">
                <Label>اسم الشركة</Label>
                <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>اسم مستخدم المدير</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
              </div>
              <div className="grid gap-2">
                <Label>كلمة المرور</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="grid gap-2">
                <Label>البريد (اختياري)</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>الهاتف (اختياري)</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
              </div>
              <p className="text-sm font-medium">منتجات فاليو تك</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {VALUE_TECH_PRODUCT_IDS.map((id) => (
                  <label
                    key={id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <Checkbox
                      checked={products[id]}
                      onCheckedChange={(v) => toggleProduct(id, Boolean(v), "create")}
                    />
                    {VALUE_TECH_PRODUCT_LABELS_AR[id]}
                  </label>
                ))}
              </div>
            </div>
          </ScrollArea>
          <div className="shrink-0 border-t bg-background px-6 py-4">
            <DialogFooter className="gap-2 sm:justify-start">
              <Button
                type="button"
                onClick={() => void onCreate()}
                disabled={
                  createSubmitting || !companyName.trim() || !username.trim() || password.length < 8
                }
              >
                <span
                  className="ms-1 inline-flex h-4 w-4 shrink-0 items-center justify-center"
                  aria-hidden={!createSubmitting}
                >
                  <Loader2
                    className={`h-4 w-4 animate-spin ${createSubmitting ? "opacity-100" : "opacity-0"}`}
                  />
                </span>
                حفظ
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                إلغاء
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* عرض التفاصيل */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl" dir="rtl">
          <DialogHeader>
            <DialogTitle>معلومات الشركة والمستخدمين</DialogTitle>
            <DialogDescription>
              مدير الشركة والأعضاء من <code className="text-xs">user_company_memberships</code> ومجموعة{" "}
              <code className="text-xs">users</code> (حقول <code className="text-xs">company</code> و
              <code className="text-xs">role</code> متوافقة مع العضوية).
            </DialogDescription>
          </DialogHeader>
          {viewLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : detail ? (
            <ScrollArea className="max-h-[65vh] pr-3">
              <div className="space-y-6 text-right">
                <div>
                  <p className="text-sm font-semibold text-slate-800">الشركة</p>
                  <p className="text-sm text-slate-600">{detail.company.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    معرف الشركة: {detail.company.id} · معرف مدير الشركة في المستند:{" "}
                    {detail.company.adminUserId || "—"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    المنتجات المعتمدة: {productSummary(detail.company.valueTechProductIds)}
                  </p>
                </div>

                {detail.admin ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                    <p className="text-sm font-semibold text-slate-800">مدير الشركة (سوبر أدمن)</p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-700">
                      <li>اسم المستخدم: {detail.admin.user.username}</li>
                      <li>البريد: {detail.admin.user.email ?? detail.admin.profile?.email ?? "—"}</li>
                      <li>الهاتف: {detail.admin.user.phone ?? detail.admin.profile?.phone ?? "—"}</li>
                      <li>الدور: {ROLE_AR[detail.admin.user.role] ?? detail.admin.user.role}</li>
                      <li>تاريخ الإنشاء: {new Date(detail.admin.user.createdAt).toLocaleString("ar")}</li>
                      <li>
                        آخر دخول:{" "}
                        {detail.admin.user.lastLoginAt
                          ? new Date(detail.admin.user.lastLoginAt).toLocaleString("ar")
                          : "—"}
                      </li>
                    </ul>
                  </div>
                ) : null}

                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    مستخدمو الشركة (أضافهم مدير الشركة)
                  </p>
                  {detail.members.length === 0 ? (
                    <p className="text-sm text-slate-500">لا يوجد أعضاء بعد.</p>
                  ) : (
                    <Table className="mt-2">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">المستخدم</TableHead>
                          <TableHead className="text-right">الدور</TableHead>
                          <TableHead className="text-right">آخر دخول</TableHead>
                          <TableHead className="w-[100px] text-right">حذف</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.members.map((m) => (
                          <TableRow key={m.user.id}>
                            <TableCell>{m.user.username}</TableCell>
                            <TableCell>{ROLE_AR[m.user.role] ?? m.user.role}</TableCell>
                            <TableCell className="text-xs">
                              {m.user.lastLoginAt
                                ? new Date(m.user.lastLoginAt).toLocaleString("ar")
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-rose-600"
                                onClick={() =>
                                  setDeleteMemberTarget({
                                    companyId: detail.company.id,
                                    userId: m.user.id,
                                    username: m.user.username,
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* تعديل — تذييل ثابت */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          className="flex max-h-[min(92vh,900px)] w-full max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
          dir="rtl"
        >
          <DialogHeader className="shrink-0 space-y-1.5 px-6 pb-2 pt-6 text-right">
            <DialogTitle>تعديل شركة</DialogTitle>
            <DialogDescription>تحديث اسم الشركة والمنتجات وبيانات مدير الشركة.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="min-h-0 flex-1 px-6">
            <div className="grid gap-3 py-2 pb-4 pr-3">
              <div className="grid gap-2">
                <Label>اسم الشركة</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label>بريد مدير الشركة</Label>
                <Input
                  type="email"
                  value={editAdminEmail}
                  onChange={(e) => setEditAdminEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>هاتف مدير الشركة</Label>
                <Input value={editAdminPhone} onChange={(e) => setEditAdminPhone(e.target.value)} dir="ltr" />
              </div>
              <div className="grid gap-2">
                <Label>كلمة مرور جديدة للمدير (اختياري)</Label>
                <Input
                  type="password"
                  value={editAdminNewPassword}
                  onChange={(e) => setEditAdminNewPassword(e.target.value)}
                  placeholder="اتركها فارغة إن لم ترد التغيير"
                  autoComplete="new-password"
                />
              </div>
              <p className="text-sm font-medium">منتجات فاليو تك</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {VALUE_TECH_PRODUCT_IDS.map((id) => (
                  <label
                    key={id}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                  >
                    <Checkbox
                      checked={editProducts[id]}
                      onCheckedChange={(v) => toggleProduct(id, Boolean(v), "edit")}
                    />
                    {VALUE_TECH_PRODUCT_LABELS_AR[id]}
                  </label>
                ))}
              </div>
            </div>
          </ScrollArea>
          <div className="shrink-0 border-t bg-background px-6 py-4">
            <DialogFooter className="gap-2 sm:justify-start">
              <Button type="button" onClick={() => void onSaveEdit()} disabled={editSubmitting}>
                <span
                  className="ms-1 inline-flex h-4 w-4 shrink-0 items-center justify-center"
                  aria-hidden={!editSubmitting}
                >
                  <Loader2
                    className={`h-4 w-4 animate-spin ${editSubmitting ? "opacity-100" : "opacity-0"}`}
                  />
                </span>
                حفظ
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
                إلغاء
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteCompanyTarget)}
        onOpenChange={(o) => {
          if (!o) setDeleteCompanyTarget(null);
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الشركة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف «{deleteCompanyTarget?.name}» وجميع مستخدميها (المدير والأعضاء) من النظام. لا
              يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-end">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => void confirmDeleteCompany()}
            >
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteMemberTarget)}
        onOpenChange={(o) => {
          if (!o) setDeleteMemberTarget(null);
        }}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المستخدم؟</AlertDialogTitle>
            <AlertDialogDescription>
              حذف المستخدم «{deleteMemberTarget?.username}» نهائياً من النظام (سجل المستخدمين).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-end">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => void confirmDeleteMember()}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
