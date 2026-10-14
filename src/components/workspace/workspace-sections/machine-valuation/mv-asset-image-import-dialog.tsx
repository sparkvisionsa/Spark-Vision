"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Folder, FolderInput, ImageIcon, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MvDialogContent } from "./mv-dialog";
import { MvApiError, mvFetchJson } from "./mv-api-client";
import { useMvI18n } from "./mv-i18n";

type ImportJob = {
  id: string;
  mode: "copy" | "move";
  state: "running" | "completed" | "failed";
  foldersTotal: number;
  foldersDone: number;
  imagesTotal: number;
  imagesDone: number;
  error?: string;
};

type SourceProject = {
  _id: string;
  name: string;
  referenceNumber?: string | null;
  displayNumber?: number | string | null;
  reportData?: { clientName?: string | null };
  folderCount: number;
  imageCount: number;
};

function normalizeProjectSearch(value: string) {
  return value.normalize("NFKD")
    .replace(/[\u064b-\u065f\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[٠-٩۰-۹]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit) >= 0
      ? "٠١٢٣٤٥٦٧٨٩".indexOf(digit) : "۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .toLocaleLowerCase()
    .trim();
}

export function MvAssetImageImportDialog({
  open, onOpenChange, projectId, onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onComplete: () => Promise<void>;
}) {
  const { t, dir, isArabic } = useMvI18n();
  const number = useMemo(() => new Intl.NumberFormat(isArabic ? "ar-SA" : "en-US"), [isArabic]);
  const [projects, setProjects] = useState<SourceProject[]>([]);
  const [sourceProjectId, setSourceProjectId] = useState("");
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");
  const [activeProjectIndex, setActiveProjectIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"copy" | "move">("copy");
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<ImportJob | null>(null);
  const completedRef = useRef("");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const storageKey = `mv:asset-image-import:${projectId}`;

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    mvFetchJson<SourceProject[]>(
      `/api/mv/projects/${encodeURIComponent(projectId)}/asset-image-imports/sources`, {},
      { trackLoading: false, timeoutMs: 30000 },
    ).then(rows => {
      if (active) setProjects(Array.isArray(rows) ? rows : []);
    }).catch(err => {
      if (active) setError(err instanceof Error ? err.message : t("assetImages.import.loadFailed"));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, projectId, t]);

  useEffect(() => {
    const savedId = window.localStorage.getItem(storageKey);
    completedRef.current = "";
    setJob(savedId ? { id: savedId, mode: "copy", state: "running", foldersTotal: 0,
      foldersDone: 0, imagesTotal: 0, imagesDone: 0 } : null);
    setSourceProjectId("");
    setProjectPickerOpen(false);
    setProjectQuery("");
    setError("");
  }, [storageKey]);

  const selectedProject = projects.find(project => project._id === sourceProjectId);
  const filteredProjects = useMemo(() => {
    const words = normalizeProjectSearch(projectQuery).split(/\s+/).filter(Boolean);
    if (words.length === 0) return projects;
    return projects.filter(project => {
      const searchable = normalizeProjectSearch([
        project.name, project.referenceNumber, project.displayNumber, project.reportData?.clientName,
      ].filter(value => value != null).join(" "));
      return words.every(word => searchable.includes(word));
    });
  }, [projects, projectQuery]);

  const selectProject = (id: string) => {
    setSourceProjectId(id);
    setProjectPickerOpen(false);
    setProjectQuery("");
    setActiveProjectIndex(0);
  };

  useEffect(() => {
    if (!job?.id || job.state !== "running") return;
    let active = true;
    const poll = async () => {
      try {
        const next = await mvFetchJson<ImportJob>(
          `/api/mv/projects/${encodeURIComponent(projectId)}/asset-image-imports/${encodeURIComponent(job.id)}`,
          {}, { trackLoading: false, timeoutMs: 15000, retries: 1 },
        );
        if (!active) return;
        setJob(next);
        if (next.state !== "running") {
          window.localStorage.removeItem(storageKey);
          if (next.state === "completed" && completedRef.current !== next.id) {
            completedRef.current = next.id;
            await onCompleteRef.current();
          }
        }
      } catch (err) {
        if (!active) return;
        if (err instanceof MvApiError && err.status === 404) {
          window.localStorage.removeItem(storageKey);
          setJob(current => current?.id === job.id ? { ...current, state: "failed" } : current);
        }
        setError(err instanceof Error ? err.message : t("assetImages.import.statusFailed"));
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 1200);
    return () => { active = false; window.clearInterval(timer); };
  }, [job?.id, job?.state, projectId, storageKey, t]);

  const start = async () => {
    if (!sourceProjectId || starting) return;
    if (mode === "move" && !window.confirm(t("assetImages.import.moveConfirm"))) return;
    setStarting(true);
    setError("");
    try {
      const next = await mvFetchJson<ImportJob>(
        `/api/mv/projects/${encodeURIComponent(projectId)}/asset-image-imports`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceProjectId, mode }) },
        { trackLoading: false, timeoutMs: 30000 },
      );
      window.localStorage.setItem(storageKey, next.id);
      setJob(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("assetImages.import.startFailed"));
    } finally {
      setStarting(false);
    }
  };

  const total = (job?.foldersTotal ?? 0) + (job?.imagesTotal ?? 0);
  const done = (job?.foldersDone ?? 0) + (job?.imagesDone ?? 0);
  const percent = job?.state === "completed" ? 100 : total ? Math.min(99, Math.round(done / total * 100)) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <MvDialogContent ref={dialogRef} dir={dir} className="max-w-lg gap-0 overflow-visible rounded-2xl p-0">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 pe-14">
          <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-900">
            <FolderInput className="h-5 w-5 text-sky-700" />{t("assetImages.import.title")}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs leading-6 text-slate-600">
            {t("assetImages.import.description")}
          </DialogDescription>
        </div>
        <div className="space-y-4 p-5">
          <div className="space-y-1 text-sm font-bold text-slate-800">
            <span>{t("assetImages.import.sourceProject")}</span>
            <Popover open={projectPickerOpen} onOpenChange={nextOpen => {
              setProjectPickerOpen(nextOpen);
              if (nextOpen) { setProjectQuery(""); setActiveProjectIndex(0); }
            }}>
              <PopoverTrigger asChild>
                <button type="button" role="combobox" aria-expanded={projectPickerOpen}
                  aria-label={t("assetImages.import.sourceProject")}
                  disabled={Boolean(job && job.state === "running") || loading}
                  className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-start text-sm font-medium text-slate-800 shadow-sm transition-colors hover:border-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60">
                  <span className="min-w-0 truncate">{selectedProject?.name ?? (loading
                    ? t("assetImages.import.loadingProjects") : t("assetImages.import.chooseProject"))}</span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                </button>
              </PopoverTrigger>
              <PopoverContent container={dialogRef.current} align="start" dir={dir}
                onOpenAutoFocus={event => { event.preventDefault(); searchInputRef.current?.focus(); }}
                className="z-[930] w-[var(--radix-popover-trigger-width)] rounded-xl border-slate-200 p-1.5 shadow-xl">
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5">
                  <Search className="h-4 w-4 shrink-0 text-slate-500" />
                  <input ref={searchInputRef} type="search" autoComplete="off"
                    aria-label={t("assetImages.import.searchProjects")}
                    placeholder={t("assetImages.import.searchProjects")}
                    value={projectQuery}
                    onChange={event => { setProjectQuery(event.target.value); setActiveProjectIndex(0); }}
                    onKeyDown={event => {
                      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        if (filteredProjects.length > 0) setActiveProjectIndex(index =>
                          (index + (event.key === "ArrowDown" ? 1 : -1) + filteredProjects.length) % filteredProjects.length);
                      } else if (event.key === "Enter" && filteredProjects[activeProjectIndex]) {
                        event.preventDefault();
                        selectProject(filteredProjects[activeProjectIndex]._id);
                      }
                    }}
                    className="h-9 w-full bg-transparent text-sm font-medium outline-none placeholder:text-slate-400" />
                </div>
                <div role="listbox" aria-label={t("assetImages.import.sourceProject")}
                  className="mt-1 max-h-64 overflow-y-auto">
                  {filteredProjects.length === 0 ? (
                    <p className="px-2 py-3 text-center text-xs font-medium text-slate-500">
                      {projects.length === 0 ? t("assetImages.import.noProjects") : t("assetImages.import.noSearchResults")}
                    </p>
                  ) : filteredProjects.map((project, index) => (
                    <button key={project._id} type="button" role="option"
                      aria-selected={project._id === sourceProjectId}
                      onMouseEnter={() => setActiveProjectIndex(index)}
                      onClick={() => selectProject(project._id)}
                      className={`flex min-h-9 w-full items-center gap-1.5 rounded-lg px-2 py-1 text-start text-sm transition-colors ${index === activeProjectIndex ? "bg-sky-50 text-sky-900" : "text-slate-800 hover:bg-slate-50"}`}>
                      <span className="min-w-0 flex-1 truncate font-semibold" title={project.name}>
                        {project.name}
                        {project.referenceNumber ? <span className="ms-1.5 text-[10px] font-normal text-slate-500">#{project.referenceNumber}</span> : null}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-600"
                        title={t("assetImages.import.projectFolders", { count: number.format(project.folderCount) })}
                        aria-label={t("assetImages.import.projectFolders", { count: number.format(project.folderCount) })}>
                        <Folder className="h-3 w-3 text-amber-600" aria-hidden="true" />{number.format(project.folderCount)}
                        <span className="text-[10px] font-medium">{t("assetImages.import.foldersShort")}</span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-slate-600"
                        title={t("assetImages.import.projectImages", { count: number.format(project.imageCount) })}
                        aria-label={t("assetImages.import.projectImages", { count: number.format(project.imageCount) })}>
                        <ImageIcon className="h-3 w-3 text-emerald-600" aria-hidden="true" />{number.format(project.imageCount)}
                        <span className="text-[10px] font-medium">{t("assetImages.import.imagesShort")}</span>
                      </span>
                      {project._id === sourceProjectId ? <Check className="h-3.5 w-3.5 shrink-0 text-sky-600" /> : null}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <fieldset disabled={Boolean(job && job.state === "running")} className="space-y-2">
            <legend className="mb-2 text-sm font-bold text-slate-800">{t("assetImages.import.modeQuestion")}</legend>
            {(["copy", "move"] as const).map(choice => (
              <label key={choice} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                <input type="radio" name="asset-image-import-mode" checked={mode === choice}
                  onChange={() => setMode(choice)} className="mt-0.5" />
                <span><strong>{t(`assetImages.import.${choice}`)}</strong><span className="block text-xs text-slate-500">{t(`assetImages.import.${choice}Description`)}</span></span>
              </label>
            ))}
          </fieldset>
          {job ? (
            <div className="rounded-xl border border-sky-200 bg-sky-50 p-4" role="status">
              <div className="mb-2 flex justify-between text-sm font-bold text-sky-900">
                <span>{job.state === "completed" ? t("assetImages.import.completed") : job.state === "failed" ? t("assetImages.import.failed") : t("assetImages.import.inProgress")}</span>
                <span>{number.format(percent)}%</span>
              </div>
              <div role="progressbar" aria-label={t("assetImages.import.progress")}
                aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
                className="h-2 overflow-hidden rounded-full bg-sky-100">
                <div className="h-full bg-sky-600 transition-[width]" style={{ width: `${percent}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-slate-700">
                <span>{t("assetImages.import.foldersCount", { done: number.format(job.foldersDone), total: number.format(job.foldersTotal) })}</span>
                <span>{t("assetImages.import.imagesCount", { done: number.format(job.imagesDone), total: number.format(job.imagesTotal) })}</span>
              </div>
              {job.error ? <p className="mt-2 text-xs text-red-700">{job.error}</p> : null}
            </div>
          ) : null}
          {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common.close")}</Button>
            {job?.state !== "running" ? <Button type="button" disabled={!sourceProjectId || starting}
              onClick={() => void start()}>
              {starting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
              {t("assetImages.import.start")}
            </Button> : null}
          </div>
        </div>
      </MvDialogContent>
    </Dialog>
  );
}
