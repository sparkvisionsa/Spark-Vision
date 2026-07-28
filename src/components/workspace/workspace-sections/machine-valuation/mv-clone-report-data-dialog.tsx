"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, FileText, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MvDialogContent } from "./mv-dialog";
import { useMvI18n } from "./mv-i18n";
import { mvErrorMessage, mvFetchJson } from "./mv-api-client";
import { cloneReportDataFromProject } from "./mv-report-data-clone";
import { MvBusyPercentOverlay } from "./mv-busy-percent-overlay";
import { useMvBusyPercent } from "./use-mv-busy-percent";
import type { MvProject } from "./types";

type ProjectListRow = Pick<MvProject, "_id" | "name" | "displayNumber" | "updatedAt" | "reportType">;

export function MvCloneReportDataDialog({
  open,
  onOpenChange,
  currentProjectId,
  onCloned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentProjectId: string;
  onCloned: (project: MvProject) => void;
}) {
  const { t, isArabic, dir } = useMvI18n();
  const busy = useMvBusyPercent();
  const [projects, setProjects] = useState<ProjectListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [cloningId, setCloningId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setQuery("");
    void (async () => {
      try {
        const rows = await mvFetchJson<ProjectListRow[]>("/api/mv/projects");
        if (cancelled) return;
        setProjects(Array.isArray(rows) ? rows.filter((row) => row._id !== currentProjectId) : []);
      } catch (err) {
        if (!cancelled) {
          setError(mvErrorMessage(err, t("reportData.clone.loadFailed")));
          setProjects([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentProjectId, open, t]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return projects;
    return projects.filter((project) => {
      const name = (project.name || "").toLocaleLowerCase();
      const serial =
        typeof project.displayNumber === "number" ? String(project.displayNumber) : "";
      return name.includes(q) || serial.includes(q);
    });
  }, [projects, query]);

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(isArabic ? "ar-SA" : "en-US"),
    [isArabic],
  );

  const handleSelect = async (sourceId: string) => {
    if (cloningId) return;
    setCloningId(sourceId);
    setError(null);
    busy.start();
    try {
      const result = await cloneReportDataFromProject({
        targetProjectId: currentProjectId,
        sourceProjectId: sourceId,
      });
      if (result.empty || !result.project) {
        busy.fail();
        setError(t("reportData.clone.emptySource"));
        return;
      }
      await busy.finish();
      onCloned(result.project);
      onOpenChange(false);
    } catch (err) {
      busy.fail();
      setError(mvErrorMessage(err, t("reportData.clone.failed")));
    } finally {
      setCloningId(null);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(next) => !busy.open && onOpenChange(next)}>
      <MvDialogContent
        className="flex max-h-[min(88vh,36rem)] w-[min(100vw-1.5rem,28rem)] flex-col overflow-hidden rounded-2xl border-slate-200 p-0"
        dir={dir}
      >
        <DialogHeader className="shrink-0 border-b border-slate-100 bg-gradient-to-l from-white via-sky-50/40 to-[#e8f0fa] px-4 py-3 pe-14 text-start">
          <DialogTitle className="flex items-center gap-2 text-[15px] font-black text-slate-900">
            <FileText className="h-4 w-4 shrink-0 text-sky-700" />
            <span className="min-w-0 truncate">{t("reportData.clone.title")}</span>
          </DialogTitle>
          <p className="text-[11.5px] font-medium leading-5 text-slate-500">
            {t("reportData.clone.subtitle")}
          </p>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("reportData.clone.searchPlaceholder")}
              className="h-10 rounded-lg border-slate-200 ps-9 text-[13px] font-semibold"
              dir="auto"
            />
          </div>

          {error ? (
            <p className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-900">
              {error}
            </p>
          ) : null}

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-10 text-[12px] font-semibold text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("reportData.clone.loading")}
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-10 text-center text-[12px] font-semibold text-slate-400">
                {t("reportData.clone.emptyList")}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filtered.map((project) => {
                  const busy = cloningId === project._id;
                  const serial =
                    typeof project.displayNumber === "number" && Number.isFinite(project.displayNumber)
                      ? numberFormatter.format(project.displayNumber)
                      : null;
                  const label = project.name || t("projects.table.project");
                  return (
                    <li key={project._id} className="min-w-0">
                      <button
                        type="button"
                        disabled={Boolean(cloningId)}
                        title={label}
                        onClick={() => void handleSelect(project._id)}
                        className={cn(
                          "grid w-full min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2.5 px-3 py-2.5 text-start transition hover:bg-sky-50/80 disabled:cursor-wait disabled:opacity-70",
                          busy && "bg-sky-50",
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <span className="min-w-0 overflow-hidden">
                          <span className="block truncate text-[12.5px] font-black leading-5 text-slate-900">
                            {label}
                          </span>
                          <span className="mt-0.5 block truncate text-[10.5px] font-semibold text-slate-500">
                            {serial
                              ? t("reportData.clone.serial", { serial })
                              : t("reportData.clone.noSerial")}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-500">
                          {project.reportType === "advanced"
                            ? t("navigation.reportTypeBadge.advanced")
                            : t("navigation.reportTypeBadge.simple")}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex shrink-0 justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              onClick={() => onOpenChange(false)}
              disabled={Boolean(cloningId)}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      </MvDialogContent>
    </Dialog>
    <MvBusyPercentOverlay
      open={busy.open}
      percent={busy.percent}
      label={t("reportData.clone.progress")}
      dir={dir}
    />
    </>
  );
}
