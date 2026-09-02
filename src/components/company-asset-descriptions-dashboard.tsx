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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  EMPTY_ASSET_DESCRIPTION_CATALOG,
  fetchAssetDescriptionCatalog,
  formatAssetDescriptionLabel,
  mutateAssetDescriptionCatalog,
  type AssetDescriptionCatalog,
  type AssetDescriptionItem,
  type AssetDescriptionNameItem,
  type AssetDescriptionTaxonomyItem,
  type AssetDescriptionTypeItem,
} from "@/lib/company-asset-descriptions";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  ImageIcon,
  ImageOff,
  ImagePlus,
  ListFilter,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

type ManageKind = "category" | "type" | "name";
type DescriptionFilter = "all" | "recent" | "with-image" | "without-image";
const DESCRIPTIONS_PER_PAGE = 20;

async function imageFileToCompressedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
    throw new Error("اختر صورة صالحة بحجم لا يتجاوز 15MB.");
  }
  const bitmap = await createImageBitmap(file);
  const maxEdge = 720;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("تعذر تجهيز الصورة.");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

type PendingDelete =
  | { kind: ManageKind; id: string; label: string }
  | { kind: "description"; id: string; label: string }
  | null;

function applyCatalog(
  payload: AssetDescriptionCatalog,
  setCatalog: (next: AssetDescriptionCatalog) => void,
) {
  setCatalog({
    categories: payload.categories,
    types: payload.types,
    names: payload.names,
    descriptions: payload.descriptions,
  });
}

export function CompanyAssetDescriptionsDashboard({ csrfToken }: { csrfToken: string }) {
  const [catalog, setCatalog] = useState<AssetDescriptionCatalog>(EMPTY_ASSET_DESCRIPTION_CATALOG);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [descriptionFilter, setDescriptionFilter] = useState<DescriptionFilter>("all");
  const [page, setPage] = useState(1);
  const [categoryId, setCategoryId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [nameId, setNameId] = useState("");

  const [addOpen, setAddOpen] = useState<ManageKind | null>(null);
  const [addLabel, setAddLabel] = useState("");
  const [manageOpen, setManageOpen] = useState<ManageKind | null>(null);
  const [manageDrafts, setManageDrafts] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      applyCatalog(await fetchAssetDescriptionCatalog(csrfToken), setCatalog);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل قائمة وصف الأصول.");
    } finally {
      setLoading(false);
    }
  }, [csrfToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const typesForCategory = useMemo(
    () => catalog.types.filter((item) => item.categoryId === categoryId),
    [catalog.types, categoryId],
  );
  const namesForType = useMemo(
    () => catalog.names.filter((item) => item.typeId === typeId),
    [catalog.names, typeId],
  );

  const filteredDescriptions = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("ar");
    const matching = catalog.descriptions.filter((item) => {
      if (categoryId && item.categoryId !== categoryId) return false;
      if (typeId && item.typeId !== typeId) return false;
      if (descriptionFilter === "with-image" && !item.mainImageUrl) return false;
      if (descriptionFilter === "without-image" && item.mainImageUrl) return false;
      const hay = `${item.category} ${item.type} ${item.name} ${formatAssetDescriptionLabel(item)}`.toLocaleLowerCase("ar");
      return !q || hay.includes(q);
    });
    return descriptionFilter === "recent" ? matching.reverse() : matching;
  }, [catalog.descriptions, search, categoryId, typeId, descriptionFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredDescriptions.length / DESCRIPTIONS_PER_PAGE));
  const pagedDescriptions = useMemo(
    () =>
      filteredDescriptions.slice(
        (page - 1) * DESCRIPTIONS_PER_PAGE,
        page * DESCRIPTIONS_PER_PAGE,
      ),
    [filteredDescriptions, page],
  );

  useEffect(() => {
    setPage(1);
  }, [search, categoryId, typeId, descriptionFilter]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const manageItems = useMemo(() => {
    if (manageOpen === "category") return catalog.categories;
    if (manageOpen === "type") return typesForCategory;
    if (manageOpen === "name") return namesForType;
    return [];
  }, [catalog.categories, manageOpen, namesForType, typesForCategory]);

  const flash = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(null), 2200);
  };

  const runMutation = async (
    url: string,
    init: RequestInit,
    success: string,
    selectCreated?: (createdId: string) => void,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const payload = await mutateAssetDescriptionCatalog(url, csrfToken, init);
      applyCatalog(payload, setCatalog);
      if (payload.created?.id) selectCreated?.(payload.created.id);
      flash(success);
      return payload;
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حفظ التعديل.");
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const handleCategoryChange = (nextId: string) => {
    setCategoryId(nextId);
    setTypeId("");
    setNameId("");
  };

  const handleTypeChange = (nextId: string) => {
    setTypeId(nextId);
    setNameId("");
  };

  const openAdd = (kind: ManageKind) => {
    if (kind === "type" && !categoryId) {
      setError("اختر الفئة أولاً.");
      return;
    }
    if (kind === "name" && !typeId) {
      setError("اختر النوع أولاً.");
      return;
    }
    setError(null);
    setAddLabel("");
    setAddOpen(kind);
  };

  const openManage = (kind: ManageKind) => {
    if (kind === "type" && !categoryId) {
      setError("اختر الفئة أولاً.");
      return;
    }
    if (kind === "name" && !typeId) {
      setError("اختر النوع أولاً.");
      return;
    }
    setError(null);
    const items =
      kind === "category"
        ? catalog.categories
        : kind === "type"
          ? typesForCategory
          : namesForType;
    setManageDrafts(Object.fromEntries(items.map((item) => [item.id, item.label])));
    setManageOpen(kind);
  };

  const submitAdd = async () => {
    const label = addLabel.trim();
    if (!label || !addOpen) return;
    const kind = addOpen;
    try {
      if (kind === "category") {
        await runMutation(
          "/api/company/asset-descriptions/categories",
          { method: "POST", body: JSON.stringify({ label }) },
          "تمت الإضافة.",
          (id) => handleCategoryChange(id),
        );
      } else if (kind === "type") {
        await runMutation(
          "/api/company/asset-descriptions/types",
          { method: "POST", body: JSON.stringify({ categoryId, label }) },
          "تمت الإضافة.",
          (id) => handleTypeChange(id),
        );
      } else {
        await runMutation(
          "/api/company/asset-descriptions/names",
          { method: "POST", body: JSON.stringify({ typeId, label }) },
          "تمت الإضافة.",
          (id) => setNameId(id),
        );
      }
      setAddOpen(null);
      setAddLabel("");
    } catch {
      /* error already shown */
    }
  };

  const saveManagedLabel = async (kind: ManageKind, id: string) => {
    const label = (manageDrafts[id] ?? "").trim();
    if (!label) return;
    const path =
      kind === "category"
        ? `/api/company/asset-descriptions/categories/${encodeURIComponent(id)}`
        : kind === "type"
          ? `/api/company/asset-descriptions/types/${encodeURIComponent(id)}`
          : `/api/company/asset-descriptions/names/${encodeURIComponent(id)}`;
    await runMutation(path, { method: "PATCH", body: JSON.stringify({ label }) }, "تم التحديث.");
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { kind, id } = pendingDelete;
    const path =
      kind === "category"
        ? `/api/company/asset-descriptions/categories/${encodeURIComponent(id)}`
        : kind === "type"
          ? `/api/company/asset-descriptions/types/${encodeURIComponent(id)}`
          : kind === "name"
            ? `/api/company/asset-descriptions/names/${encodeURIComponent(id)}`
            : `/api/company/asset-descriptions/${encodeURIComponent(id)}`;
    try {
      await runMutation(path, { method: "DELETE" }, "تم الحذف.");
      if (kind === "category" && categoryId === id) handleCategoryChange("");
      if (kind === "type" && typeId === id) handleTypeChange("");
      if (kind === "name" && nameId === id) setNameId("");
      setPendingDelete(null);
    } catch {
      /* error already shown */
    }
  };

  const addDescription = async () => {
    if (!categoryId || !typeId || !nameId) {
      setError("أكمل اختيار الفئة والنوع واسم الأصل.");
      return;
    }
    try {
      await runMutation(
        "/api/company/asset-descriptions",
        {
          method: "POST",
          body: JSON.stringify({ categoryId, typeId, nameId }),
        },
        "تمت إضافة الوصف.",
      );
    } catch {
      /* error already shown */
    }
  };

  const updateDescriptionImage = async (item: AssetDescriptionItem, file: File | null) => {
    let imageDataUrl: string | null = null;
    if (file) {
      try {
        imageDataUrl = await imageFileToCompressedDataUrl(file);
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذر تجهيز الصورة.");
        return;
      }
    }
    try {
      await runMutation(
        `/api/company/asset-descriptions/${encodeURIComponent(item.id)}/main-image`,
        {
          method: "PATCH",
          body: JSON.stringify({ imageDataUrl }),
        },
        file ? "تم حفظ الصورة الرئيسية." : "تم حذف الصورة الرئيسية.",
      );
    } catch {
      /* error already shown */
    }
  };

  const selectDescription = (item: AssetDescriptionItem) => {
    setCategoryId(item.categoryId);
    setTypeId(item.typeId);
    setNameId(item.nameId);
  };

  const clearSelectionFilters = () => {
    setCategoryId("");
    setTypeId("");
    setNameId("");
  };

  const canAdd = Boolean(categoryId && typeId && nameId) && !busy;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm" dir="rtl">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3 md:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#0C447C]">
          <ListFilter className="h-4 w-4" />
        </span>
        <div className="min-w-0 text-right">
          <h2 className="text-[14px] font-black text-slate-900">تصنيفات الأصول</h2>
          <p className="mt-0.5 text-[11px] font-semibold leading-5 text-slate-500">
            إدارة الفئات والأنواع وأسماء الأصول والأوصاف والصور المرتبطة بها.
          </p>
        </div>
      </div>
      <div className="space-y-3 p-4 md:p-5">
        {error ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>
        ) : null}
        {status ? (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">{status}</p>
        ) : null}

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بالفئة أو النوع أو الاسم…"
              className="h-11 rounded-2xl border-slate-200 bg-slate-50/80 pr-10 text-[13px] shadow-none focus-visible:bg-white"
            />
          </div>
          <span className="hidden shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold tabular-nums text-slate-500 sm:inline">
            {filteredDescriptions.length}
          </span>
          {categoryId || typeId ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11 shrink-0 rounded-2xl px-3 text-[12px] text-slate-500 hover:bg-slate-100"
              onClick={clearSelectionFilters}
              disabled={busy}
              title="إلغاء تصفية الفئة والنوع"
            >
              <X className="h-4 w-4" />
              عرض الكل
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-2xl text-slate-500 hover:bg-slate-100"
            onClick={() => void load()}
            disabled={loading || busy}
            title="تحديث"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
            title="فلترة الأوصاف"
          >
            <ListFilter className="h-4 w-4" />
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            className={cn(
              "h-9 shrink-0 rounded-xl px-3 text-[12px]",
              descriptionFilter === "all"
                ? "bg-[#0C447C] text-white hover:bg-[#0a3a68] hover:text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100",
            )}
            onClick={() => setDescriptionFilter("all")}
          >
            الكل
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            className={cn(
              "h-9 shrink-0 rounded-xl px-3 text-[12px]",
              descriptionFilter === "recent"
                ? "bg-[#0C447C] text-white hover:bg-[#0a3a68] hover:text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100",
            )}
            onClick={() => setDescriptionFilter("recent")}
          >
            <Clock3 className="h-3.5 w-3.5" />
            الأحدث أولاً
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            className={cn(
              "h-9 shrink-0 rounded-xl px-3 text-[12px]",
              descriptionFilter === "with-image"
                ? "bg-[#0C447C] text-white hover:bg-[#0a3a68] hover:text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100",
            )}
            onClick={() => setDescriptionFilter("with-image")}
          >
            <ImageIcon className="h-3.5 w-3.5" />
            تحتوي على صور
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            className={cn(
              "h-9 shrink-0 rounded-xl px-3 text-[12px]",
              descriptionFilter === "without-image"
                ? "bg-[#0C447C] text-white hover:bg-[#0a3a68] hover:text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100",
            )}
            onClick={() => setDescriptionFilter("without-image")}
          >
            <ImageOff className="h-3.5 w-3.5" />
            بدون صور
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[210px] flex-1">
            <TaxonomySelect
              placeholder={catalog.categories.length ? "الفئة" : "أضف فئة"}
              value={categoryId}
              items={catalog.categories}
              disabled={busy}
              onChange={handleCategoryChange}
              onAdd={() => openAdd("category")}
              onManage={() => openManage("category")}
            />
          </div>
          <div className="min-w-[210px] flex-1">
            <TaxonomySelect
              placeholder={!categoryId ? "النوع" : typesForCategory.length ? "النوع" : "أضف نوعاً"}
              value={typeId}
              items={typesForCategory}
              disabled={busy || !categoryId}
              onChange={handleTypeChange}
              onAdd={() => openAdd("type")}
              onManage={() => openManage("type")}
            />
          </div>
          <div className="min-w-[210px] flex-1">
            <TaxonomySelect
              placeholder={!typeId ? "اسم الأصل" : namesForType.length ? "اسم الأصل" : "أضف اسماً"}
              value={nameId}
              items={namesForType}
              disabled={busy || !typeId}
              onChange={setNameId}
              onAdd={() => openAdd("name")}
              onManage={() => openManage("name")}
            />
          </div>
          <Button
            type="button"
            className="h-11 shrink-0 rounded-2xl bg-[#0C447C] px-5 text-[13px] font-bold shadow-sm hover:bg-[#0a3a68] disabled:opacity-40"
            disabled={!canAdd}
            onClick={() => void addDescription()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            إضافة
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/40">
          {loading ? (
            <div className="flex justify-center py-16 text-slate-400">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
          ) : filteredDescriptions.length === 0 ? (
            <div className="px-4 py-14 text-center text-[13px] text-slate-400">
              {catalog.descriptions.length === 0 ? "ابدأ باختيار أو إضافة القيم ثم اضغط إضافة." : "لا توجد نتائج."}
            </div>
          ) : (
            <div>
              <ul className="divide-y divide-slate-100">
                {pagedDescriptions.map((item) => {
                  const active =
                    item.categoryId === categoryId &&
                    item.typeId === typeId &&
                    item.nameId === nameId;
                  return (
                    <li key={item.id}>
                      <div
                        className={cn(
                          "group flex items-center gap-3 px-3 py-2.5 transition",
                          active ? "bg-sky-50" : "bg-white hover:bg-slate-50",
                        )}
                      >
                        <div
                          className="relative h-14 w-16 shrink-0"
                          title="الصور الرئيسية لكل وصف"
                        >
                          <label
                            className={cn(
                              "relative flex h-full w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-400",
                              busy && "pointer-events-none opacity-60",
                            )}
                          >
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="sr-only"
                              disabled={busy}
                              aria-label={`الصور الرئيسية لكل وصف: ${formatAssetDescriptionLabel(item)}`}
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                event.target.value = "";
                                if (file) void updateDescriptionImage(item, file);
                              }}
                            />
                            {item.mainImageUrl ? (
                              <img
                                src={item.mainImageUrl}
                                alt={formatAssetDescriptionLabel(item)}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="h-5 w-5" />
                            )}
                            <span className="absolute inset-0 flex items-center justify-center bg-slate-900/45 text-white opacity-0 transition group-hover:opacity-100">
                              <ImagePlus className="h-4 w-4" />
                            </span>
                          </label>
                          {item.mainImageUrl ? (
                            <button
                              type="button"
                              className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-rose-500 shadow ring-1 ring-slate-200 hover:bg-rose-50"
                              disabled={busy}
                              aria-label="حذف الصورة الرئيسية"
                              onClick={() => void updateDescriptionImage(item, null)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-right"
                          onClick={() => selectDescription(item)}
                        >
                          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-slate-700">
                            <span className="font-semibold text-slate-900">{item.category}</span>
                            <ChevronLeft className="h-3 w-3 text-slate-300" />
                            <span>{item.type}</span>
                            <ChevronLeft className="h-3 w-3 text-slate-300" />
                            <span className="font-bold text-[#0C447C]">{item.name}</span>
                          </span>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 rounded-xl text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600"
                          disabled={busy}
                          onClick={() =>
                            setPendingDelete({
                              kind: "description",
                              id: item.id,
                              label: formatAssetDescriptionLabel(item),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {totalPages > 1 ? (
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-3 py-2.5">
                  <span className="text-[11px] text-slate-500">
                    الصفحة {page} من {totalPages} · {filteredDescriptions.length} وصفاً
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-xl px-3 text-[12px]"
                      disabled={page <= 1 || busy}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                      السابق
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-xl px-3 text-[12px]"
                      disabled={page >= totalPages || busy}
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    >
                      التالي
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <Dialog open={addOpen != null} onOpenChange={(open) => !open && setAddOpen(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {addOpen === "category" ? "فئة جديدة" : addOpen === "type" ? "نوع جديد" : "اسم أصل جديد"}
            </DialogTitle>
          </DialogHeader>
          <Input
            value={addLabel}
            onChange={(e) => setAddLabel(e.target.value)}
            placeholder="اكتب القيمة"
            className="h-11 rounded-2xl"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submitAdd();
              }
            }}
          />
          <DialogFooter className="gap-2 sm:justify-start">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setAddOpen(null)}>
              إلغاء
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-[#0C447C] hover:bg-[#0a3a68]"
              disabled={busy || !addLabel.trim()}
              onClick={() => void submitAdd()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageOpen != null} onOpenChange={(open) => !open && setManageOpen(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {manageOpen === "category" ? "الفئات" : manageOpen === "type" ? "الأنواع" : "أسماء الأصول"}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[360px] space-y-2 overflow-auto pe-1">
            {manageItems.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-slate-400">لا توجد عناصر بعد.</p>
            ) : (
              manageItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-2xl bg-slate-50 p-2">
                  <Input
                    value={manageDrafts[item.id] ?? item.label}
                    onChange={(e) =>
                      setManageDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    className="h-10 rounded-xl border-slate-200 bg-white text-[13px]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 shrink-0 rounded-xl px-3 text-[12px]"
                    disabled={busy || (manageDrafts[item.id] ?? item.label).trim() === item.label}
                    onClick={() => void saveManagedLabel(manageOpen!, item.id)}
                  >
                    حفظ
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 rounded-xl text-rose-500 hover:bg-rose-50"
                    disabled={busy}
                    onClick={() =>
                      setPendingDelete({
                        kind: manageOpen!,
                        id: item.id,
                        label: item.label,
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDelete != null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف؟</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.kind === "description"
                ? `حذف «${pendingDelete.label}»؟`
                : pendingDelete
                  ? `حذف «${pendingDelete.label}» والعناصر المرتبطة به؟`
                  : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-start">
            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-rose-600 hover:bg-rose-700" onClick={() => void confirmDelete()}>
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TaxonomySelect({
  placeholder,
  value,
  items,
  disabled,
  onChange,
  onAdd,
  onManage,
}: {
  placeholder: string;
  value: string;
  items: AssetDescriptionTaxonomyItem[] | AssetDescriptionTypeItem[] | AssetDescriptionNameItem[];
  disabled?: boolean;
  onChange: (id: string) => void;
  onAdd: () => void;
  onManage: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger
          className={cn(
            "h-11 rounded-2xl border-slate-200 bg-slate-50/80 text-[13px] shadow-none focus:bg-white",
            !value && "text-slate-400",
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-9 shrink-0 rounded-2xl text-slate-500 hover:bg-sky-50 hover:text-[#0C447C]"
        disabled={disabled}
        onClick={onAdd}
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-9 shrink-0 rounded-2xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        disabled={disabled}
        onClick={onManage}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
