"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArchiveRestore, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { invalidateMvApiCache } from "./mv-api-client";
import { useMvI18n } from "./mv-i18n";
import { parseProjectArchiveDate } from "./mv-project-archive-dates";
import { invalidateProjectSummaryCache } from "./mv-project-summary-loader";
import { MvTopBar } from "./mv-ui";

/** عنصر في سلة المحذوفات كما يعيده ‎`GET /api/mv/trash`‎. */
type TrashItem = {
  id: string;
  kind: string;
  label: string;
  /** أسماء الآباء داخل المشروع (مجلد ← أصل…)، إن وُجدت. */
  location: string | null;
  count: number;
  projectId: string | null;
  projectName: string | null;
  /** مشروع العنصر نفسه في السلة: يجب استعادته أولاً. */
  projectDeleted: boolean;
  referenceNumber: string | null;
  displayNumber: number | null;
  deletedAt: string;
  deletedByName: string | null;
  deletedByMe: boolean;
  companyName: string | null;
  canRestore: boolean;
  canPermanentlyDelete: boolean;
};

type TrashResponse = {
  items: TrashItem[];
  canSeeAll: boolean;
  canPermanentlyDelete: boolean;
  isSuperAdmin: boolean;
  restoreDays: number;
};

type TrashGroup = "all" | "projects" | "assets" | "files" | "report" | "settings";

const GROUP_KINDS: Record<Exclude<TrashGroup, "all" | "settings">, ReadonlySet<string>> = {
  projects: new Set(["project"]),
  assets: new Set([
    "folder", "assetFolder", "allFolders", "assetImage", "assetVoiceNote",
    "asset", "assetSheet", "assetColumn", "sheet", "sheetColumn",
  ]),
  files: new Set([
    "inspectorFile", "projectFile", "valuationExcelFile", "valuationFile", "valuationImage",
    "clientFile", "clientFileImage", "sceCertificate", "sceCertificateImage", "extraction", "extractionField",
  ]),
  report: new Set([
    "inspectionSite", "inspectionAssignment", "reportCustomSection", "reportCustomField", "reportTeamMember",
    "reportSection", "reportBlock", "reportBuiltInSection", "reportText", "reportDataReset",
  ]),
};
const GROUPS: TrashGroup[] = ["all", "projects", "assets", "files", "report", "settings"];

function groupOf(kind: string): Exclude<TrashGroup, "all"> {
  for (const group of ["projects", "assets", "files", "report"] as const) {
    if (GROUP_KINDS[group].has(kind)) return group;
  }
  // كل ما عدا ذلك يُدار من الإعدادات أو صفحة العملاء.
  return "settings";
}

export default function MvTrashBin() {
  const { t, isArabic, dir } = useMvI18n();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuthTracking();
  const [data, setData] = useState<TrashResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<TrashGroup>("all");
  const [busy, setBusy] = useState<{ id: string; action: "restore" | "purge" } | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/mv/trash", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error();
      const result = await response.json() as TrashResponse;
      if (currentRequest === requestId.current) setData(result);
    } catch {
      if (currentRequest === requestId.current) setError(t("trash.loadFailed"));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      requestId.current += 1;
      setLoading(false);
      setData(null);
      setError(t("trash.signIn"));
      return;
    }
    setData(null);
    void load();
  }, [authLoading, user?.id, user?.companyId, load, t]);

  const kindLabel = useCallback((kind: string) => {
    const key = `trash.kinds.${kind}`;
    const label = t(key);
    return label === key ? t("trash.kinds.other") : label;
  }, [t]);

  const items = data?.items ?? [];
  const groupCounts = useMemo(() => {
    const counts: Record<TrashGroup, number> = { all: items.length, projects: 0, assets: 0, files: 0, report: 0, settings: 0 };
    for (const item of items) counts[groupOf(item.kind)] += 1;
    return counts;
  }, [items]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (group !== "all" && groupOf(item.kind) !== group) return false;
      if (!needle) return true;
      return [
        item.label, kindLabel(item.kind), item.location, item.projectName, item.companyName,
        item.deletedByName, item.referenceNumber, item.displayNumber,
      ].some((value) => String(value ?? "").toLocaleLowerCase().includes(needle));
    });
  }, [items, group, query, kindLabel]);

  const afterChange = async (item: TrashItem) => {
    // العنصر المستعاد قد يمس أي شاشة في المشروع: نُبطل ما خُزّن مؤقتاً لتُقرأ البيانات من جديد.
    invalidateMvApiCache();
    invalidateProjectSummaryCache(item.projectId ?? undefined);
    await load();
  };

  const restore = async (item: TrashItem) => {
    if (busy) return;
    setBusy({ id: item.id, action: "restore" });
    try {
      const response = await fetch(`/api/mv/trash/${item.id}/restore`, { method: "POST", credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || t("trash.toast.restoreFailed"));
      }
      toast({ description: t("trash.toast.restored", { name: item.label }) });
      await afterChange(item);
    } catch (cause) {
      toast({ variant: "destructive", description: cause instanceof Error ? cause.message : String(cause) });
    } finally {
      setBusy(null);
    }
  };

  const purge = async (item: TrashItem) => {
    if (busy) return;
    if (!window.confirm(t("trash.purgeConfirm", { name: item.label }))) return;
    setBusy({ id: item.id, action: "purge" });
    try {
      const response = await fetch(`/api/mv/trash/${item.id}`, { method: "DELETE", credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(body?.message || t("trash.toast.purgeFailed"));
      }
      toast({ description: t("trash.toast.purged", { name: item.label }) });
      await afterChange(item);
    } catch (cause) {
      toast({ variant: "destructive", description: cause instanceof Error ? cause.message : String(cause) });
    } finally {
      setBusy(null);
    }
  };

  const dateFormat = useMemo(
    () => new Intl.DateTimeFormat(isArabic ? "ar-SA" : "en-US", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    }),
    [isArabic],
  );
  const numberFormat = useMemo(() => new Intl.NumberFormat(isArabic ? "ar-SA" : "en-US"), [isArabic]);
  const formatDate = (value: string) => {
    const parsed = parseProjectArchiveDate(value);
    return parsed ? dateFormat.format(parsed) : "—";
  };
  const showCompany = data?.isSuperAdmin === true;
  const showDeletedBy = data?.canSeeAll === true;

  return (
    <div dir={dir} className="min-h-full bg-slate-50 text-slate-900">
      {/* The page scrolls inside the area below the app header, so the bar pins at 0:
          the default top-14 offset would push it down over the filters. */}
      <MvTopBar
        breadcrumbs={[{ label: t("navigation.trash") }]}
        sticky
        compact
        className="top-0 z-30 border-slate-200/70 bg-white/80 shadow-none backdrop-blur-xl supports-[backdrop-filter]:bg-white/70"
      />
      <main className="w-full p-2 md:p-3">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2">
            <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label={t("trash.columns.type")}>
              {GROUPS.filter((key) => key === "all" || groupCounts[key] > 0).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={group === key}
                  onClick={() => setGroup(key)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-bold transition-colors ${
                    group === key
                      ? "border-cyan-600 bg-cyan-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {t(`trash.groups.${key}`)}
                  <span className="tabular-nums opacity-80">{numberFormat.format(groupCounts[key])}</span>
                </button>
              ))}
            </div>
            <div className="ms-auto flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none">
              <div className="flex min-w-[210px] max-w-sm flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 sm:w-72">
                <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("trash.search")}
                  aria-label={t("trash.search")}
                  className="h-8 border-0 px-0 text-xs shadow-none focus-visible:ring-0"
                />
              </div>
              <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="h-8 gap-1.5 px-2.5">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                {t("trash.refresh")}
              </Button>
            </div>
          </div>

          {data && !data.isSuperAdmin ? (
            <p className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950" role="note">
              {t(data.canSeeAll ? "trash.noteAdmin" : "trash.noteOwn", { days: data.restoreDays })}
            </p>
          ) : null}

          {error ? <p role="alert" className="px-4 py-6 text-sm text-red-700">{error}</p>
            : loading && !data ? <p className="px-4 py-6 text-sm text-slate-500">{t("trash.loading")}</p>
              : visible.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">
                  {items.length === 0 ? t("trash.empty") : t("trash.emptyFiltered")}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-600">
                        <th className="w-44 px-3 py-2 text-start">{t("trash.columns.type")}</th>
                        <th className="px-3 py-2 text-start">{t("trash.columns.item")}</th>
                        <th className="w-64 px-3 py-2 text-start">{t("trash.columns.location")}</th>
                        {showCompany ? <th className="w-40 px-3 py-2 text-start">{t("trash.columns.company")}</th> : null}
                        {showDeletedBy ? <th className="w-36 px-3 py-2 text-start">{t("trash.columns.deletedBy")}</th> : null}
                        <th className="w-44 px-3 py-2 text-start">{t("trash.columns.deletedAt")}</th>
                        <th className="w-60 px-3 py-2 text-end">{t("trash.columns.actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visible.map((item) => {
                        const isProject = item.kind === "project";
                        // عنصر داخل مشروع محذوف لا يعود قبل مشروعه.
                        const blockedByProject = !isProject && item.projectDeleted;
                        const where = isProject
                          ? item.referenceNumber
                          : [item.projectName, item.location].filter(Boolean).join(" ← ");
                        return (
                          <tr key={item.id} className="transition-colors hover:bg-cyan-50/40">
                            <td className="px-3 py-2.5 align-middle">
                              <span className="inline-flex items-center rounded-md bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-800">
                                {kindLabel(item.kind)}
                              </span>
                            </td>
                            <td className="max-w-xs px-3 py-2.5 align-middle font-bold text-slate-900">
                              <span className="block truncate" title={item.label}>{item.label || "—"}</span>
                              {item.count > 1 ? (
                                <span className="block text-xs font-medium text-slate-500">
                                  {t("trash.itemsInside", { count: numberFormat.format(item.count) })}
                                </span>
                              ) : null}
                            </td>
                            <td className="max-w-64 px-3 py-2.5 align-middle text-slate-600">
                              <span className="block truncate" title={where || ""} dir="auto">{where || "—"}</span>
                              {blockedByProject ? (
                                <span className="block text-xs font-medium text-amber-700">{t("trash.projectInTrash")}</span>
                              ) : null}
                            </td>
                            {showCompany ? (
                              <td className="max-w-40 px-3 py-2.5 align-middle text-slate-600">
                                <span className="block truncate" title={item.companyName || ""}>{item.companyName || "—"}</span>
                              </td>
                            ) : null}
                            {showDeletedBy ? (
                              <td className="max-w-36 px-3 py-2.5 align-middle text-slate-600">
                                <span className="block truncate" title={item.deletedByName || ""}>
                                  {item.deletedByMe ? t("trash.deletedByMe") : item.deletedByName || "—"}
                                </span>
                              </td>
                            ) : null}
                            <td className="whitespace-nowrap px-3 py-2.5 align-middle text-slate-600">{formatDate(item.deletedAt)}</td>
                            <td className="px-3 py-2 align-middle">
                              <div className="flex items-center justify-end gap-1.5">
                                {item.canRestore ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy !== null || blockedByProject}
                                    onClick={() => void restore(item)}
                                    className="h-8 gap-1 px-2.5 text-xs"
                                  >
                                    <ArchiveRestore className="h-3.5 w-3.5" />
                                    {busy?.id === item.id && busy.action === "restore" ? t("trash.actions.restoring") : t("trash.actions.restore")}
                                  </Button>
                                ) : (
                                  <span className="text-xs text-slate-500">{t("trash.restoreExpired")}</span>
                                )}
                                {item.canPermanentlyDelete ? (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={busy !== null}
                                    onClick={() => void purge(item)}
                                    className="h-8 gap-1 px-2.5 text-xs"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {busy?.id === item.id && busy.action === "purge" ? t("trash.actions.purging") : t("trash.actions.purge")}
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
        </section>
      </main>
    </div>
  );
}
