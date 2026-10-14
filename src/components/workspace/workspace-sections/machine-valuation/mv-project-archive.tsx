"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArchiveRestore, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { invalidateMvApiCache } from "./mv-api-client";
import { useMvI18n } from "./mv-i18n";
import { resolveProjectArchiveDates } from "./mv-project-archive-dates";
import { MvTopBar } from "./mv-ui";

type ArchivedProject = {
  _id: string;
  name: string;
  companyName?: string | null;
  displayNumber: number | null;
  referenceNumber: string | null;
  deletedAt?: string | null;
  companyRestoreUntil?: string | null;
  purgeAt?: string | null;
  canRestore?: boolean;
};

type ArchiveResponse = {
  totalCount: number;
  activeCount: number;
  deletedCount: number;
  canRestore: boolean;
  canPermanentlyDelete?: boolean;
  projects: ArchivedProject[];
};

export default function MvProjectArchive() {
  const { t, isArabic, dir } = useMvI18n();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuthTracking();
  const [data, setData] = useState<ArchiveResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const requestId = useRef(0);
  const isSuperAdmin = user?.role === "super_admin";

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/mv/projects/archive", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error();
      const result = await response.json() as ArchiveResponse;
      if (currentRequest === requestId.current) setData(result);
    } catch {
      if (currentRequest === requestId.current) setError(isArabic ? "تعذر تحميل أرشيف المشاريع." : "Could not load the project archive.");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [isArabic]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      requestId.current += 1;
      setLoading(false);
      setData(null);
      setError(isArabic ? "سجّل الدخول لعرض أرشيف المشاريع." : "Sign in to view the project archive.");
      return;
    }
    setData(null);
    void load();
  }, [authLoading, user?.id, user?.companyId, load, isArabic]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return data?.projects ?? [];
    return (data?.projects ?? []).filter(project =>
      [project.name, project.companyName, project.referenceNumber, project.displayNumber]
        .some(value => String(value ?? "").toLocaleLowerCase().includes(needle)));
  }, [data, query]);

  const restore = async (project: ArchivedProject) => {
    if (restoringId || deletingId) return;
    setRestoringId(project._id);
    try {
      const response = await fetch(`/api/mv/projects/${project._id}/restore`, {
        method: "POST", credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || (isArabic ? "تعذرت استعادة المشروع." : "Could not restore the project."));
      }
      invalidateMvApiCache("projects:");
      toast({ description: isArabic ? "تمت استعادة المشروع." : "Project restored." });
      await load();
    } catch (cause) {
      toast({ variant: "destructive", description: cause instanceof Error ? cause.message : String(cause) });
    } finally {
      setRestoringId(null);
    }
  };

  const permanentlyDelete = async (project: ArchivedProject) => {
    if (restoringId || deletingId) return;
    const confirmed = window.confirm(isArabic
      ? `حذف المشروع «${project.name}» نهائيًا؟ سيُحذف المشروع وجميع بياناته وملفاته، ولا يمكن التراجع عن هذا الإجراء.`
      : `Permanently delete “${project.name}”? The project and all of its data and files will be deleted. This action cannot be undone.`);
    if (!confirmed) return;
    setDeletingId(project._id);
    try {
      const response = await fetch(`/api/mv/projects/${project._id}/permanent`, {
        method: "DELETE", credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || (isArabic ? "تعذر حذف المشروع نهائيًا." : "Could not permanently delete the project."));
      }
      invalidateMvApiCache("projects:");
      toast({ description: isArabic ? "تم حذف المشروع نهائيًا." : "Project permanently deleted." });
      await load();
    } catch (cause) {
      toast({ variant: "destructive", description: cause instanceof Error ? cause.message : String(cause) });
    } finally {
      setDeletingId(null);
    }
  };

  const dateFormat = new Intl.DateTimeFormat(isArabic ? "ar-SA" : "en-US", { year: "numeric", month: "short", day: "numeric" });
  const numberFormat = new Intl.NumberFormat(isArabic ? "ar-SA" : "en-US");
  const formatArchiveDate = (value: Date | null) => value ? dateFormat.format(value) : "—";
  const canPermanentlyDelete = data?.canPermanentlyDelete ??
    (user?.role === "company_admin" || user?.role === "super_admin");

  return (
    <div dir={dir} className="min-h-full bg-slate-50 text-slate-900">
      <MvTopBar breadcrumbs={[{ label: t("navigation.archive") }]} sticky compact />
      <main className="w-full p-2 md:p-3">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              {[
                { label: isArabic ? "الإجمالي" : "Total", value: data?.totalCount ?? 0 },
                { label: isArabic ? "النشطة" : "Active", value: data?.activeCount ?? 0 },
                { label: isArabic ? "المحذوفة" : "Deleted", value: data?.deletedCount ?? 0 },
              ].map(metric => <span key={metric.label} className="whitespace-nowrap">
                {metric.label} <strong className="ms-1 text-sm font-black tabular-nums text-slate-900">{numberFormat.format(metric.value)}</strong>
              </span>)}
            </div>
            <div className="ms-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
              <div className="flex min-w-[210px] max-w-sm flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 sm:w-72">
                <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                <Input value={query} onChange={event => setQuery(event.target.value)}
                  placeholder={isSuperAdmin
                    ? (isArabic ? "بحث بالمشروع أو الشركة أو الرقم" : "Search project, company, or number")
                    : (isArabic ? "بحث بالمشروع أو الرقم" : "Search project or number")}
                  className="h-8 border-0 px-0 text-xs shadow-none focus-visible:ring-0" />
              </div>
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="h-8 gap-1.5 px-2.5">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                {isArabic ? "تحديث" : "Refresh"}
              </Button>
            </div>
          </div>

          {!isSuperAdmin ? <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950" role="note">
            {isArabic
              ? "يمكنك استعادة المشاريع المحذوفة من الأرشيف خلال 30 يومًا من تاريخ الحذف."
              : "You can restore deleted projects from the archive within 30 days of deletion."}
          </p> : null}

          {error ? <p role="alert" className="px-4 py-6 text-sm text-red-700">{error}</p>
            : loading && !data ? <p className="px-4 py-6 text-sm text-slate-500">{isArabic ? "جارٍ التحميل…" : "Loading…"}</p>
              : visible.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">{isArabic ? "لا توجد مشاريع محذوفة." : "No deleted projects."}</p>
                : <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
                        <th className="w-20 px-3 py-2 text-start">{isArabic ? "التسلسل" : "Serial"}</th>
                        <th className="w-36 px-3 py-2 text-start">{isArabic ? "الرقم المرجعي" : "Reference"}</th>
                        <th className="px-3 py-2 text-start">{isArabic ? "اسم المشروع" : "Project"}</th>
                        {isSuperAdmin ? <th className="w-44 px-3 py-2 text-start">{isArabic ? "الشركة" : "Company"}</th> : null}
                        <th className="w-40 px-3 py-2 text-start">{isArabic ? "تاريخ الحذف" : "Deleted on"}</th>
                        <th className="w-64 px-3 py-2 text-end">{isArabic ? "الإجراءات" : "Actions"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visible.map(project => {
                        const { deletedAt, companyRestoreUntil, purgeAt } = resolveProjectArchiveDates(project);
                        const fallbackCanRestore = isSuperAdmin
                          ? !!purgeAt && purgeAt.getTime() > Date.now()
                          : !!companyRestoreUntil && companyRestoreUntil.getTime() > Date.now();
                        const canRestoreNow = typeof project.canRestore === "boolean"
                          ? project.canRestore
                          : fallbackCanRestore;
                        return <tr key={project._id} className="transition-colors hover:bg-cyan-50/40">
                          <td className="px-3 py-2.5 align-middle">
                            <span className="inline-flex min-w-8 items-center justify-center rounded-md bg-cyan-50 px-2 py-1 text-xs font-black tabular-nums text-cyan-800">
                              {project.displayNumber ?? "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 align-middle font-semibold text-slate-600" dir="ltr">
                            {project.referenceNumber || "—"}
                          </td>
                          <td className="max-w-xs px-3 py-2.5 align-middle font-bold text-slate-900">
                            <span className="block truncate" title={project.name}>{project.name}</span>
                          </td>
                          {isSuperAdmin ? <td className="max-w-44 px-3 py-2.5 align-middle text-slate-600">
                            <span className="block truncate" title={project.companyName || ""}>{project.companyName || "—"}</span>
                          </td> : null}
                          <td className="whitespace-nowrap px-3 py-2.5 align-middle text-slate-600">{formatArchiveDate(deletedAt)}</td>
                          <td className="px-3 py-2 align-middle">
                            <div className="flex items-center justify-end gap-1.5">
                              {data?.canRestore && canRestoreNow ? <Button size="sm" variant="outline"
                                disabled={restoringId !== null || deletingId !== null}
                                onClick={() => void restore(project)} className="h-8 gap-1 px-2.5 text-xs">
                                <ArchiveRestore className="h-3.5 w-3.5" />{isArabic ? "استعادة" : "Restore"}
                              </Button> : null}
                              {canPermanentlyDelete ? <Button size="sm" variant="destructive"
                                disabled={restoringId !== null || deletingId !== null}
                                onClick={() => void permanentlyDelete(project)} className="h-8 gap-1 px-2.5 text-xs">
                                <Trash2 className="h-3.5 w-3.5" />
                                {deletingId === project._id
                                  ? (isArabic ? "جارٍ الحذف…" : "Deleting…")
                                  : (isArabic ? "حذف نهائي" : "Delete permanently")}
                              </Button> : null}
                            </div>
                          </td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>}
        </section>
      </main>
    </div>
  );
}
