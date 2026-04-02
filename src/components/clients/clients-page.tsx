"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { toApiUrl } from "@/lib/api-url";
import type { Client, ClientType, FormFieldDef, FormTemplate, TemplateFieldType } from "@/lib/types/clients";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  Eye,
  FileStack,
  FolderOpen,
  Layers,
  ListPlus,
  Pencil,
  Plus,
  Sparkles,
  Tag,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";

const FIELD_TYPE_OPTIONS: { value: TemplateFieldType; label: string }[] = [
  { value: "text", label: "نص قصير" },
  { value: "textarea", label: "نص طويل" },
  { value: "number", label: "رقم" },
  { value: "date", label: "تاريخ" },
  { value: "email", label: "بريد إلكتروني" },
  { value: "tel", label: "هاتف" },
  { value: "select", label: "قائمة منسدلة" },
];

/** سطر لكل خيار؛ تُزال التكرارات مع الحفاظ على الترتيب */
function parseOptionsLines(text: string): string[] {
  const lines = text.split(/\r?\n/).map((s) => s.trim());
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out;
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(toApiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `خطأ ${res.status}`;
    try {
      const payload = (await res.json()) as { message?: string | string[] };
      if (payload?.message) {
        message = Array.isArray(payload.message) ? payload.message.join(" ") : payload.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

type BuilderRow = {
  id: string;
  label: string;
  fieldType: TemplateFieldType;
  /** نصوص خيارات القائمة المنسدلة (سطر لكل خيار) */
  selectOptionsText: string;
};

function emptyRow(): BuilderRow {
  return { id: crypto.randomUUID(), label: "", fieldType: "text", selectOptionsText: "" };
}

export default function ClientsPage() {
  const [clientTypes, setClientTypes] = useState<ClientType[]>([]);
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [active, setActive] = useState(true);
  const [typeId, setTypeId] = useState("");
  const [formTemplateId, setFormTemplateId] = useState<string | null>(null);
  const [clientAddress, setClientAddress] = useState("");
  const [templateFieldValues, setTemplateFieldValues] = useState<Record<string, string>>({});
  const [bankName, setBankName] = useState("");
  const [bankAccountAddress, setBankAccountAddress] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);

  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateModalMode, setTemplateModalMode] = useState<"create" | "edit">("create");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [builderRows, setBuilderRows] = useState<BuilderRow[]>([emptyRow()]);

  const [templatesBrowserOpen, setTemplatesBrowserOpen] = useState(false);
  const [viewTemplate, setViewTemplate] = useState<FormTemplate | null>(null);

  const [deleteClientId, setDeleteClientId] = useState<string | null>(null);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

  const [savingClient, setSavingClient] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [types, tps, cls] = await Promise.all([
        apiJson<ClientType[]>("/api/client-types"),
        apiJson<FormTemplate[]>("/api/form-templates"),
        apiJson<Client[]>("/api/clients"),
      ]);
      setClientTypes(types);
      setFormTemplates(tps);
      setClients(cls);
    } catch (e) {
      toast({
        title: "تعذر التحميل",
        description: e instanceof Error ? e.message : "حدث خطأ",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const selectedTemplate = useMemo(
    () => formTemplates.find((t) => t.id === formTemplateId) ?? null,
    [formTemplates, formTemplateId],
  );

  useEffect(() => {
    if (!selectedTemplate) {
      setTemplateFieldValues({});
      return;
    }
    setTemplateFieldValues((prev) => {
      const next: Record<string, string> = { ...prev };
      for (const f of selectedTemplate.fields) {
        if (next[f.id] === undefined) next[f.id] = "";
      }
      for (const key of Object.keys(next)) {
        if (!selectedTemplate.fields.some((f) => f.id === key)) delete next[key];
      }
      return next;
    });
  }, [selectedTemplate]);

  function resetClientForm() {
    setEditingId(null);
    setName("");
    setPhone("");
    setEmail("");
    setActive(true);
    setTypeId(clientTypes[0]?.id ?? "");
    setFormTemplateId(null);
    setClientAddress("");
    setTemplateFieldValues({});
    setBankName("");
    setBankAccountAddress("");
    setBankAccountNumber("");
  }

  useEffect(() => {
    if (!typeId && clientTypes.length) setTypeId(clientTypes[0].id);
  }, [clientTypes, typeId]);

  const openCreateTemplate = () => {
    setTemplateModalMode("create");
    setEditingTemplateId(null);
    setTemplateName("");
    setBuilderRows([emptyRow()]);
    setTemplateModalOpen(true);
  };

  const openEditTemplate = (t: FormTemplate) => {
    setTemplateModalMode("edit");
    setEditingTemplateId(t.id);
    setTemplateName(t.name);
    setBuilderRows(
      t.fields.length
        ? t.fields.map((f) => ({
            id: f.id,
            label: f.label,
            fieldType: f.fieldType,
            selectOptionsText:
              f.fieldType === "select" && f.options?.length ? f.options.join("\n") : "",
          }))
        : [emptyRow()],
    );
    setTemplateModalOpen(true);
  };

  async function submitNewType() {
    const n = newTypeName.trim();
    if (!n) {
      toast({ title: "أدخل اسم النوع", variant: "destructive" });
      return;
    }
    try {
      const created = await apiJson<ClientType>("/api/client-types", {
        method: "POST",
        body: JSON.stringify({ name: n }),
      });
      setClientTypes((prev) => [...prev, created]);
      setTypeId(created.id);
      setNewTypeName("");
      setTypeModalOpen(false);
      toast({ title: "تمت إضافة نوع العميل" });
    } catch (e) {
      toast({
        title: "فشل الحفظ",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  }

  async function submitTemplate() {
    const n = templateName.trim();
    const fields: FormFieldDef[] = builderRows
      .filter((r) => r.label.trim())
      .map((r) => {
        const base: FormFieldDef = {
          id: r.id,
          label: r.label.trim(),
          fieldType: r.fieldType,
        };
        if (r.fieldType === "select") {
          const options = parseOptionsLines(r.selectOptionsText);
          return { ...base, options };
        }
        return base;
      });

    if (!n) {
      toast({ title: "أدخل اسم النموذج", variant: "destructive" });
      return;
    }
    if (fields.length === 0) {
      toast({ title: "أضف حقلًا واحدًا على الأقل", variant: "destructive" });
      return;
    }
    const badSelect = fields.find((f) => f.fieldType === "select" && (!f.options || f.options.length === 0));
    if (badSelect) {
      toast({
        title: "خيارات القائمة المنسدلة مطلوبة",
        description: `أضف سطرًا واحدًا على الأقل لحقل «${badSelect.label}» (القائمة المنسدلة).`,
        variant: "destructive",
      });
      return;
    }

    try {
      if (templateModalMode === "create") {
        const created = await apiJson<FormTemplate>("/api/form-templates", {
          method: "POST",
          body: JSON.stringify({ name: n, fields }),
        });
        setFormTemplates((prev) => [...prev, created]);
        setFormTemplateId(created.id);
      } else if (editingTemplateId) {
        const updated = await apiJson<FormTemplate>(`/api/form-templates/${editingTemplateId}`, {
          method: "PATCH",
          body: JSON.stringify({ name: n, fields }),
        });
        setFormTemplates((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      }
      setTemplateModalOpen(false);
      toast({ title: templateModalMode === "create" ? "تم إنشاء النموذج" : "تم تحديث النموذج" });
    } catch (e) {
      toast({
        title: "فشل حفظ النموذج",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    }
  }

  async function saveClient() {
    setSavingClient(true);
    try {
      const payload = {
        name,
        phone,
        email,
        active,
        typeId,
        address: "",
        clientAddress,
        formTemplateId,
        templateFieldValues,
        bankName,
        bankAccountAddress,
        bankAccountNumber,
      };
      if (editingId) {
        const updated = await apiJson<Client>(`/api/clients/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        toast({ title: "تم تحديث بيانات العميل" });
      } else {
        const created = await apiJson<Client>("/api/clients", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setClients((prev) => [created, ...prev]);
        toast({ title: "تمت إضافة العميل" });
      }
      resetClientForm();
    } catch (e) {
      toast({
        title: "تعذر الحفظ",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSavingClient(false);
    }
  }

  function startEdit(c: Client) {
    setEditingId(c.id);
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email);
    setActive(c.active);
    setTypeId(c.typeId);
    setFormTemplateId(c.formTemplateId);
    setClientAddress(c.clientAddress);
    setTemplateFieldValues(c.templateFieldValues ?? {});
    setBankName(c.bankName);
    setBankAccountAddress(c.bankAccountAddress);
    setBankAccountNumber(c.bankAccountNumber);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function confirmDeleteClient() {
    if (!deleteClientId) return;
    try {
      await apiJson(`/api/clients/${deleteClientId}`, { method: "DELETE" });
      setClients((prev) => prev.filter((c) => c.id !== deleteClientId));
      if (editingId === deleteClientId) resetClientForm();
      toast({ title: "تم حذف العميل" });
    } catch (e) {
      toast({
        title: "تعذر الحذف",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setDeleteClientId(null);
    }
  }

  async function confirmDeleteTemplate() {
    if (!deleteTemplateId) return;
    try {
      await apiJson(`/api/form-templates/${deleteTemplateId}`, { method: "DELETE" });
      setFormTemplates((prev) => prev.filter((t) => t.id !== deleteTemplateId));
      if (formTemplateId === deleteTemplateId) setFormTemplateId(null);
      toast({ title: "تم حذف النموذج" });
    } catch (e) {
      toast({
        title: "تعذر الحذف",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setDeleteTemplateId(null);
    }
  }

  function typeLabel(id: string) {
    return clientTypes.find((t) => t.id === id)?.name ?? "—";
  }

  function renderDynamicInput(f: FormFieldDef) {
    const v = templateFieldValues[f.id] ?? "";
    const onChange = (val: string) =>
      setTemplateFieldValues((prev) => ({ ...prev, [f.id]: val }));

    const inputCls = "h-7 text-[12px]";
    switch (f.fieldType) {
      case "textarea":
        return (
          <Textarea
            value={v}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            className="resize-y text-[12px] min-h-[48px]"
            placeholder={`${f.label}…`}
          />
        );
      case "number":
        return <Input type="number" value={v} onChange={(e) => onChange(e.target.value)} placeholder={f.label} className={inputCls} />;
      case "date":
        return <Input type="date" value={v} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
      case "email":
        return <Input type="email" inputMode="email" value={v} onChange={(e) => onChange(e.target.value)} placeholder={f.label} className={inputCls} />;
      case "tel":
        return <Input type="tel" inputMode="tel" value={v} onChange={(e) => onChange(e.target.value)} placeholder={f.label} className={inputCls} />;
      case "select": {
        const opts = f.options?.length ? f.options : [];
        const displayOpts = v && !opts.includes(v) ? [v, ...opts] : opts;
        if (opts.length === 0) {
          return (
            <p className="text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">
              لا خيارات — عدّل النموذج
            </p>
          );
        }
        return (
          <Select value={v || undefined} onValueChange={(val) => onChange(val)}>
            <SelectTrigger className="h-7 text-[12px] w-full">
              <SelectValue placeholder={`اختر ${f.label}`} />
            </SelectTrigger>
            <SelectContent>
              {displayOpts.map((opt) => (
                <SelectItem key={opt} value={opt} className="text-[12px]">{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      default:
        return <Input value={v} onChange={(e) => onChange(e.target.value)} placeholder={f.label} className={inputCls} />;
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-1.5 py-2 space-y-1.5">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-teal-500 text-white shadow-sm">
            <Users className="h-3.5 w-3.5" />
          </div>
          <h1 className="text-[15px] font-bold tracking-tight text-slate-900">العملاء</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2.5 text-[11px] border-slate-200 bg-white/80 shadow-sm"
          onClick={() => setTemplatesBrowserOpen(true)}
        >
          <FileStack className="h-3 w-3" />
          النماذج
        </Button>
      </div>

      {/* ─── Form ─── */}
      <form
        className="space-y-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          void saveClient();
        }}
      >
        {/* بيانات العميل */}
        <div className="rounded-lg border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-slate-100 px-2.5 py-1.5">
            <UserPlus className="h-3 w-3 text-sky-600" />
            <span className="text-[12px] font-semibold text-slate-800">بيانات العميل</span>
          </div>
          <div className="px-2.5 py-2 space-y-1.5">
            {/* Row 1: name / phone / email */}
            <div className="grid gap-x-2 gap-y-1.5 sm:grid-cols-3">
              <div className="space-y-0.5">
                <Label className="text-[11px] text-slate-500" htmlFor="c-name">الاسم</Label>
                <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم العميل" required className="h-7 text-[12px]" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px] text-slate-500" htmlFor="c-phone">الهاتف</Label>
                <Input id="c-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx" className="h-7 text-[12px]" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px] text-slate-500" htmlFor="c-email">البريد</Label>
                <Input id="c-email" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" className="h-7 text-[12px]" />
              </div>
            </div>

            {/* Row 2: type + template + active */}
            <div className="grid gap-x-2 gap-y-1.5 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <div className="space-y-0.5">
                <Label className="text-[11px] text-slate-500">النوع</Label>
                {clientTypes.length === 0 ? (
                  <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-1">
                    أنشئ أول نوع &rarr;
                  </p>
                ) : (
                  <Select value={typeId} onValueChange={setTypeId}>
                    <SelectTrigger className="h-7 text-[12px]">
                      <SelectValue placeholder="اختر النوع" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientTypes.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-[12px]">{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px] border-0 bg-sky-600 text-white hover:bg-sky-700"
                  onClick={() => setTypeModalOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  نوع
                </Button>
              </div>

              <div className="space-y-0.5">
                <Label className="text-[11px] text-slate-500">النموذج</Label>
                <Select
                  value={formTemplateId ?? "none"}
                  onValueChange={(v) => setFormTemplateId(v === "none" ? null : v)}
                >
                  <SelectTrigger className="h-7 text-[12px]">
                    <SelectValue placeholder="بدون نموذج" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-[12px]">بدون نموذج</SelectItem>
                    {formTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="text-[12px]">{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px] border-0 bg-sky-600 text-white hover:bg-sky-700"
                  onClick={openCreateTemplate}
                >
                  <Plus className="h-3 w-3" />
                  نموذج
                </Button>
              </div>

              <div className="space-y-0.5">
                <Label className="text-[11px] text-slate-500">الحالة</Label>
                <label
                  className={cn(
                    "flex h-7 items-center gap-1.5 rounded-md border px-2 transition-colors cursor-pointer select-none",
                    active
                      ? "border-emerald-200 bg-emerald-50/60 text-emerald-800"
                      : "border-slate-200 bg-slate-50 text-slate-600",
                  )}
                >
                  <Checkbox
                    checked={active}
                    onCheckedChange={(v) => setActive(v === true)}
                    className="h-3 w-3"
                  />
                  <span className="text-[11px] font-medium leading-none">
                    {active ? "فعّال" : "غير نشط"}
                  </span>
                </label>
              </div>
            </div>

            {/* Row 3: address */}
            <div className="space-y-0.5">
              <Label className="text-[11px] text-slate-500" htmlFor="c-client-address">عنوان العميل</Label>
              <Input
                id="c-client-address"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="عنوان كامل للمراسلات"
                className="h-7 text-[12px]"
              />
            </div>

            {/* Template fields */}
            {selectedTemplate && selectedTemplate.fields.length > 0 && (
              <div className="rounded border border-dashed border-sky-200/80 bg-sky-50/30 px-2 py-1.5 space-y-1">
                <p className="text-[10px] font-semibold text-sky-800">
                  حقول «{selectedTemplate.name}»
                </p>
                <div className="grid gap-x-2 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {selectedTemplate.fields.map((f) => {
                    const isWide = f.fieldType === "textarea";
                    return (
                      <div key={f.id} className={cn("space-y-0.5", isWide && "sm:col-span-2 lg:col-span-3")}>
                        <Label className="text-[11px] text-slate-500">{f.label}</Label>
                        {renderDynamicInput(f)}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* معلومات البنك */}
        <div className="rounded-lg border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-slate-100 px-2.5 py-1.5">
            <Building2 className="h-3 w-3 text-sky-600" />
            <span className="text-[12px] font-semibold text-slate-800">معلومات البنك</span>
          </div>
          <div className="px-2.5 py-2">
            <div className="grid gap-x-2 gap-y-1.5 sm:grid-cols-3">
              <div className="space-y-0.5">
                <Label className="text-[11px] text-slate-500" htmlFor="c-bank">البنك</Label>
                <Input id="c-bank" value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="اسم البنك" className="h-7 text-[12px]" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px] text-slate-500" htmlFor="c-bank-addr">عنوان الحساب</Label>
                <Input id="c-bank-addr" value={bankAccountAddress} onChange={(e) => setBankAccountAddress(e.target.value)} placeholder="الفرع أو عنوان الحساب" className="h-7 text-[12px]" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px] text-slate-500" htmlFor="c-bank-acc">الحساب / الآيبان</Label>
                <Input id="c-bank-acc" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} placeholder="رقم الحساب أو الآيبان" className="h-7 text-[12px]" />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <Button
            type="submit"
            size="sm"
            disabled={savingClient || !name.trim() || !typeId || clientTypes.length === 0}
            className="h-7 gap-1 px-3 bg-gradient-to-r from-sky-600 to-teal-600 text-[12px] font-semibold shadow-sm hover:from-sky-700 hover:to-teal-700"
          >
            {loading ? "جاري التحميل…" : editingId ? "حفظ التعديلات" : "إضافة عميل"}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" size="sm" onClick={resetClientForm} className="h-7 text-[12px]">
              إلغاء
            </Button>
          )}
        </div>
      </form>

      {/* ─── Table ─── */}
      <div className="rounded-lg border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center gap-1.5 border-b border-slate-100 px-2.5 py-1.5">
          <Users className="h-3 w-3 text-slate-500" />
          <span className="text-[12px] font-semibold text-slate-800">قائمة العملاء</span>
          <Badge variant="secondary" className="mr-auto h-4 px-1.5 text-[9px] font-semibold">
            {clients.length}
          </Badge>
        </div>
        <div>
          {loading ? (
            <p className="text-[12px] text-slate-400 py-8 text-center">جاري التحميل…</p>
          ) : clients.length === 0 ? (
            <p className="text-[12px] text-slate-400 py-8 text-center">لا يوجد عملاء بعد.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full table-fixed border-collapse text-[12px]">
                <TableHeader>
                  <TableRow className="border-b border-slate-100 bg-slate-50/70 hover:bg-slate-50/70">
                    <TableHead className="h-7 w-[36%] px-2.5 py-1 text-start align-middle text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      الاسم
                    </TableHead>
                    <TableHead className="h-7 w-[26%] px-2.5 py-1 text-start align-middle text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      النوع
                    </TableHead>
                    <TableHead className="h-7 w-[18%] px-2.5 py-1 text-center align-middle text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      الحالة
                    </TableHead>
                    <TableHead className="h-7 w-[20%] px-2.5 py-1 text-center align-middle text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      إجراءات
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clients.map((c) => (
                    <TableRow
                      key={c.id}
                      className="border-b border-slate-50 transition-colors hover:bg-slate-50/50"
                    >
                      <TableCell className="px-2.5 py-1.5 align-middle font-medium text-slate-800">
                        <span className="line-clamp-1">{c.name}</span>
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 align-middle text-slate-600">
                        <span className="line-clamp-1">{typeLabel(c.typeId)}</span>
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 align-middle text-center">
                        <span
                          className={cn(
                            "inline-block h-1.5 w-1.5 rounded-full",
                            c.active ? "bg-emerald-500" : "bg-slate-300",
                          )}
                          title={c.active ? "فعال" : "غير نشط"}
                        />
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 align-middle">
                        <div className="flex items-center justify-center gap-0.5">
                          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(c)} aria-label="تعديل">
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-red-500 hover:text-red-600" onClick={() => setDeleteClientId(c.id)} aria-label="حذف">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Modal: add type */}
      <Dialog open={typeModalOpen} onOpenChange={setTypeModalOpen}>
        <DialogContent className="sm:max-w-sm gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl">
          <div className="bg-gradient-to-br from-sky-500 to-teal-500 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur"><Tag className="h-4 w-4 text-white" /></div>
              <div>
                <DialogTitle className="text-[15px] font-bold text-white">إضافة نوع عميل</DialogTitle>
                <DialogDescription className="text-[11px] text-white/70 mt-0.5">سيُضاف ويُحدَّد تلقائيًا</DialogDescription>
              </div>
            </div>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-type" className="text-[11px] text-slate-500">اسم النوع</Label>
              <Input id="new-type" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="مثال: فرد، شركة، بنك" className="h-8 text-[13px]" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submitNewType(); } }} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" size="sm" className="h-8 text-[12px]" onClick={() => setTypeModalOpen(false)}>إلغاء</Button>
              <Button type="button" size="sm" className="h-8 text-[12px] gap-1 bg-sky-600 hover:bg-sky-700" onClick={() => void submitNewType()}><Plus className="h-3.5 w-3.5" />إضافة</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: create/edit template */}
      <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl flex flex-col">
          <div className="bg-gradient-to-br from-violet-500 to-sky-500 px-5 py-4 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur"><Layers className="h-4 w-4 text-white" /></div>
              <div>
                <DialogTitle className="text-[15px] font-bold text-white">{templateModalMode === "create" ? "إضافة نموذج جديد" : "تعديل النموذج"}</DialogTitle>
                <DialogDescription className="text-[11px] text-white/70 mt-0.5">حدّد الاسم وأضف الحقول — لنوع «قائمة» اكتب الخيارات (سطر لكل خيار)</DialogDescription>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-hidden px-5 py-3 space-y-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-500">اسم النموذج</Label>
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="مثال: نموذج تقييم عقاري" className="h-8 text-[13px]" />
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" className="h-7 gap-1 text-[11px] bg-violet-600 hover:bg-violet-700" onClick={() => setBuilderRows((rows) => [...rows, emptyRow()])}><ListPlus className="h-3 w-3" />إضافة حقل</Button>
              <span className="text-[10px] text-slate-400">اختر نوع الحقل بجانب كل صف</span>
            </div>
            <ScrollArea className="h-[min(36vh,280px)] -mx-1 px-1">
              <div className="space-y-2">
                {builderRows.map((row, idx) => (
                  <div key={row.id} className="space-y-1.5 rounded-lg border border-slate-200/80 bg-gradient-to-br from-slate-50/80 to-white p-2.5">
                    <div className="grid gap-1.5 sm:grid-cols-[1fr_120px_auto] sm:items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-200/80 text-[10px] font-bold text-slate-500">{idx + 1}</span>
                        <Input value={row.label} onChange={(e) => setBuilderRows((rows) => rows.map((r) => (r.id === row.id ? { ...r, label: e.target.value } : r)))} placeholder="اسم الحقل" className="h-7 text-[12px]" />
                      </div>
                      <Select value={row.fieldType} onValueChange={(v) => { const next = v as TemplateFieldType; setBuilderRows((rows) => rows.map((r) => r.id === row.id ? { ...r, fieldType: next, selectOptionsText: next === "select" ? r.selectOptionsText : "" } : r)); }}>
                        <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{FIELD_TYPE_OPTIONS.map((o) => (<SelectItem key={o.value} value={o.value} className="text-[12px]">{o.label}</SelectItem>))}</SelectContent>
                      </Select>
                      <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => setBuilderRows((rows) => rows.length <= 1 ? rows : rows.filter((r) => r.id !== row.id))} aria-label="حذف"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                    {row.fieldType === "select" && (
                      <div className="space-y-1 pt-1 border-t border-slate-100">
                        <Label className="text-[10px] text-slate-500">خيارات القائمة (سطر لكل خيار)</Label>
                        <Textarea dir="auto" rows={3} value={row.selectOptionsText} onChange={(e) => setBuilderRows((rows) => rows.map((r) => r.id === row.id ? { ...r, selectOptionsText: e.target.value } : r))} placeholder={"شركة\nفرد\nمؤسسة"} className="text-[12px] min-h-[50px]" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 shrink-0">
            <Button type="button" variant="ghost" size="sm" className="h-8 text-[12px]" onClick={() => setTemplateModalOpen(false)}>إلغاء</Button>
            <Button type="button" size="sm" className="h-8 text-[12px] gap-1 bg-violet-600 hover:bg-violet-700" onClick={() => void submitTemplate()}><Sparkles className="h-3.5 w-3.5" />{templateModalMode === "create" ? "إنشاء النموذج" : "حفظ التعديلات"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: browse templates */}
      <Dialog open={templatesBrowserOpen} onOpenChange={setTemplatesBrowserOpen}>
        <DialogContent className="sm:max-w-md gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl">
          <div className="bg-gradient-to-br from-slate-700 to-slate-900 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 backdrop-blur"><FolderOpen className="h-4 w-4 text-white" /></div>
              <div>
                <DialogTitle className="text-[15px] font-bold text-white">النماذج المحفوظة</DialogTitle>
                <DialogDescription className="text-[11px] text-white/60 mt-0.5">عرض أو تعديل أو حذف</DialogDescription>
              </div>
            </div>
          </div>
          <ScrollArea className="max-h-[55vh]">
            <div className="p-3 space-y-1.5">
              {formTemplates.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
                  <FileStack className="h-8 w-8 opacity-30" />
                  <p className="text-[12px]">لا توجد نماذج بعد</p>
                </div>
              ) : (
                formTemplates.map((t) => (
                  <div key={t.id} className="group flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2 transition-colors hover:border-slate-200 hover:bg-slate-50/80">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-600"><Layers className="h-3 w-3" /></div>
                      <span className="text-[13px] font-medium text-slate-800 truncate">{t.name}</span>
                    </div>
                    <div className="flex shrink-0 gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setViewTemplate(t)} aria-label="عرض"><Eye className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => { openEditTemplate(t); setTemplatesBrowserOpen(false); }} aria-label="تعديل"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteTemplateId(t.id)} aria-label="حذف"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Modal: view template fields */}
      <Dialog open={viewTemplate !== null} onOpenChange={(o) => !o && setViewTemplate(null)}>
        <DialogContent className="sm:max-w-sm gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl">
          <div className="bg-gradient-to-br from-teal-500 to-emerald-600 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur"><Eye className="h-4 w-4 text-white" /></div>
              <div>
                <DialogTitle className="text-[15px] font-bold text-white">{viewTemplate?.name}</DialogTitle>
                <DialogDescription className="text-[11px] text-white/70 mt-0.5">{viewTemplate?.fields.length ?? 0} حقل</DialogDescription>
              </div>
            </div>
          </div>
          <div className="p-4 space-y-1.5">
            {viewTemplate?.fields.map((f, idx) => (
              <div key={f.id} className="flex items-start gap-2.5 rounded-lg bg-slate-50/80 px-3 py-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-teal-100 text-[10px] font-bold text-teal-700 mt-0.5">{idx + 1}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-slate-800">{f.label}</p>
                  <p className="text-[11px] text-slate-500">
                    {FIELD_TYPE_OPTIONS.find((o) => o.value === f.fieldType)?.label ?? f.fieldType}
                    {f.fieldType === "select" && f.options?.length ? (<span className="mr-1 text-slate-400">— {f.options.join("، ")}</span>) : null}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Alert: delete client */}
      <AlertDialog open={deleteClientId !== null} onOpenChange={(o) => !o && setDeleteClientId(null)}>
        <AlertDialogContent className="gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl">
          <div className="flex items-center gap-3 bg-gradient-to-br from-red-500 to-rose-600 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur"><AlertTriangle className="h-4 w-4 text-white" /></div>
            <div>
              <AlertDialogTitle className="text-[15px] font-bold text-white">حذف العميل؟</AlertDialogTitle>
              <AlertDialogDescription className="text-[11px] text-white/70 mt-0.5">لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-3">
            <AlertDialogCancel className="h-8 text-[12px]">إلغاء</AlertDialogCancel>
            <AlertDialogAction className="h-8 text-[12px] gap-1 bg-red-600 hover:bg-red-700" onClick={() => void confirmDeleteClient()}><Trash2 className="h-3.5 w-3.5" />حذف نهائي</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert: delete template */}
      <AlertDialog open={deleteTemplateId !== null} onOpenChange={(o) => !o && setDeleteTemplateId(null)}>
        <AlertDialogContent className="gap-0 overflow-hidden rounded-2xl border-0 p-0 shadow-2xl">
          <div className="flex items-center gap-3 bg-gradient-to-br from-red-500 to-rose-600 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur"><AlertTriangle className="h-4 w-4 text-white" /></div>
            <div>
              <AlertDialogTitle className="text-[15px] font-bold text-white">حذف النموذج؟</AlertDialogTitle>
              <AlertDialogDescription className="text-[11px] text-white/70 mt-0.5">سيتم إزالة ارتباطه من العملاء المستخدمين له.</AlertDialogDescription>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-3">
            <AlertDialogCancel className="h-8 text-[12px]">إلغاء</AlertDialogCancel>
            <AlertDialogAction className="h-8 text-[12px] gap-1 bg-red-600 hover:bg-red-700" onClick={() => void confirmDeleteTemplate()}><Trash2 className="h-3.5 w-3.5" />حذف نهائي</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
