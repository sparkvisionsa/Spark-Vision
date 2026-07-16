"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/prefetch-link";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { patchMvSubprojectPicAsset, mvPicAssetImagesToPatchPayload, MvPicAssetPanel } from "./mv-pic-asset-panel";
import { MvEmptyState, MvErrorState, MvPageLoading, MvTopBar } from "./mv-ui";
import { MvProjectReportHeader } from "./mv-simple-report-navigation";
import { MvWorkflowPageFrame, MvWorkflowPageScrollBody } from "./mv-workflow-page-frame";
import type { MvSubProject, PicAsset, PicAssetImage } from "./types";
import { mvErrorMessage, mvFetchJson } from "./mv-api-client";
import {
  buildPhotosRootAssetEntries,
  entryHasFullPicAssetMedia,
  hydratePicAssetEntriesProgressive,
  mergePicAssetPreferFull,
  picAssetNeedsMediaFetch,
} from "./mv-pic-asset-progressive-load";
import { useMvI18n } from "./mv-i18n";

interface MvAssetImagesSystemWorkspaceProps {
  projectId: string;
  projectName: string | null;
}

type FolderBlock = {
  sub: MvSubProject;
  picAsset: PicAsset | null;
};

function isExternalPic(im: PicAssetImage): im is { url: string } {
  return typeof (im as { url?: string }).url === "string" && (im as { url: string }).url.length > 0;
}

function thumbSrc(im: PicAssetImage, projectId: string): string {
  if (isExternalPic(im)) return im.url;
  const fid = (im as { fileId?: string }).fileId;
  if (fid) return `/api/mv/projects/${projectId}/files/${fid}/download`;
  return "";
}

function selectionKey(subId: string, index: number): string {
  return `${subId}::${index}`;
}

function parseKey(k: string): { subId: string; index: number } | null {
  const i = k.lastIndexOf("::");
  if (i <= 0) return null;
  const subId = k.slice(0, i);
  const index = Number(k.slice(i + 2));
  if (!Number.isFinite(index)) return null;
  return { subId, index };
}

const REPORT_QUEUE_KEY = (projectId: string) => `sv:mv-report-image-queue:${projectId}`;

export default function MvAssetImagesSystemWorkspace({ projectId, projectName }: MvAssetImagesSystemWorkspaceProps) {
  const { t, dir, isArabic } = useMvI18n();
  const { toast } = useToast();
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(isArabic ? "ar-SA" : "en-US"),
    [isArabic],
  );
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState<FolderBlock[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [working, setWorking] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(40);
  const [hydration, setHydration] = useState({ active: false, completed: 0, total: 0 });
  const hydrateCancelRef = useRef<(() => void) | null>(null);
  const loadIdRef = useRef(0);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const showFullPageLoad = !opts?.silent;
    const myLoadId = ++loadIdRef.current;
    hydrateCancelRef.current?.();
    hydrateCancelRef.current = null;
    if (showFullPageLoad) setLoading(true);
    if (showFullPageLoad) setLoadError(null);
    try {
      const data = await mvFetchJson<{ subProjects?: MvSubProject[] }>(
        `/api/mv/projects/${projectId}?picAssetMode=summary`,
        {},
        {
          cacheKey: `project-summary:${projectId}`,
          cacheTtlMs: opts?.silent ? 0 : 12_000,
          forceRefresh: opts?.silent === true,
          retries: 1,
          timeoutMs: 15_000,
          loadingLabel: t("assetImages.system.preparingFolders"),
        },
      );
      if (myLoadId !== loadIdRef.current) return;
      const subProjects = data.subProjects ?? [];
      const entries = buildPhotosRootAssetEntries(subProjects).entries;
      setBlocks(entries);
      setVisibleLimit(40);
      setLoadError(null);
      setLoading(false);

      const hydrationJob = hydratePicAssetEntriesProgressive(projectId, entries, {
        prioritySubIds: entries.slice(0, 40).map((entry) => entry.sub._id),
        shouldSkip: (entry) => entryHasFullPicAssetMedia(entry.picAsset),
        isCancelled: () => myLoadId !== loadIdRef.current,
        onBatchUpdate: (updates) => {
          if (myLoadId !== loadIdRef.current) return;
          const byId = new Map(updates.map((update) => [update.subId, update.next]));
          setBlocks((current) => current.map((row) => {
            const next = byId.get(row.sub._id);
            return next
              ? {
                  sub: { ...row.sub, ...next.sub },
                  picAsset: mergePicAssetPreferFull(row.picAsset, next.picAsset),
                }
              : row;
          }));
        },
        onProgress: (completed, total) => {
          if (myLoadId !== loadIdRef.current) return;
          setHydration({ active: completed < total, completed, total });
        },
        onComplete: () => {
          if (myLoadId !== loadIdRef.current) return;
          setHydration((current) => ({ ...current, active: false }));
        },
      });
      hydrateCancelRef.current = hydrationJob.cancel;
    } catch (error) {
      if (myLoadId !== loadIdRef.current) return;
      if (showFullPageLoad) {
        setBlocks([]);
        setLoadError(mvErrorMessage(error, t("assetImages.system.loadFailed")));
      } else {
        toast({ variant: "destructive", description: mvErrorMessage(error, t("assetImages.system.refreshFailed")) });
      }
    } finally {
      if (myLoadId === loadIdRef.current && showFullPageLoad) setLoading(false);
    }
  }, [projectId, t, toast]);

  useEffect(() => {
    void load();
    return () => {
      loadIdRef.current += 1;
      hydrateCancelRef.current?.();
      hydrateCancelRef.current = null;
    };
  }, [load]);

  const allSelectionKeys = useMemo(() => {
    const keys: string[] = [];
    for (const b of blocks) {
      const imgs = b.picAsset?.images ?? [];
      imgs.forEach((_, i) => keys.push(selectionKey(b.sub._id, i)));
    }
    return keys;
  }, [blocks]);

  const toggleKey = useCallback((k: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  const setFolderAll = (subId: string, imageCount: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (let i = 0; i < imageCount; i += 1) {
        const k = selectionKey(subId, i);
        if (checked) next.add(k);
        else next.delete(k);
      }
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(allSelectionKeys));
  const clearSelection = () => setSelected(new Set());

  const runDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(t("assetImages.system.deleteConfirm", { count: numberFormatter.format(selected.size) }))) return;

    setWorking(true);
    try {
      const bySub = new Map<string, number[]>();
      for (const k of selected) {
        const p = parseKey(k);
        if (!p) continue;
        if (!bySub.has(p.subId)) bySub.set(p.subId, []);
        bySub.get(p.subId)!.push(p.index);
      }

      const serverBySub = new Map<string, PicAsset>();
      for (const [subId, indices] of bySub) {
        const block = blocks.find((x) => x.sub._id === subId);
        if (!block?.picAsset) continue;
        const nextImages = [...(block.picAsset.images ?? [])];
        const sorted = [...new Set(indices)].sort((a, c) => c - a);
        for (const idx of sorted) {
          if (idx >= 0 && idx < nextImages.length) nextImages.splice(idx, 1);
        }
        const updated = await patchMvSubprojectPicAsset(projectId, subId, {
          images: mvPicAssetImagesToPatchPayload(nextImages),
        });
        serverBySub.set(subId, updated);
      }
      if (serverBySub.size > 0) {
        setBlocks((prev) =>
          prev.map((row) => {
            const u = serverBySub.get(row.sub._id);
            return u ? { ...row, picAsset: u } : row;
          }),
        );
      }
      clearSelection();
      toast({ description: t("assetImages.system.deleteSuccess") });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : t("assetImages.system.deleteFailed"),
      });
    } finally {
      setWorking(false);
    }
  };

  const runAddToReport = () => {
    if (selected.size === 0) {
      toast({ description: t("assetImages.system.selectAtLeastOne") });
      return;
    }
    type QueueItem = {
      subProjectId: string;
      folderName: string;
      imageIndex: number;
      href: string;
    };
    const items: QueueItem[] = [];
    for (const k of selected) {
      const p = parseKey(k);
      if (!p) continue;
      const b = blocks.find((x) => x.sub._id === p.subId);
      if (!b?.picAsset?.images?.[p.index]) continue;
      const im = b.picAsset.images[p.index]!;
      const href = thumbSrc(im, projectId);
      if (!href) continue;
      items.push({
        subProjectId: p.subId,
        folderName: b.sub.name,
        imageIndex: p.index,
        href,
      });
    }
    try {
      const key = REPORT_QUEUE_KEY(projectId);
      const prev = (() => {
        try {
          return JSON.parse(sessionStorage.getItem(key) ?? "[]") as unknown;
        } catch {
          return [];
        }
      })();
      const merged = Array.isArray(prev) ? [...(prev as QueueItem[]), ...items] : items;
      sessionStorage.setItem(key, JSON.stringify(merged));
      toast({ description: t("assetImages.system.addedToReportQueue", { count: numberFormatter.format(items.length) }) });
    } catch {
      toast({ variant: "destructive", description: t("assetImages.system.queueSaveFailed") });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen" dir={dir}>
        <MvTopBar breadcrumbs={[{ label: "..." }]} saveState="idle" />
        <MvPageLoading label={t("assetImages.system.loading")} />
      </div>
    );
  }

  if (loadError) {
    return (
      <MvWorkflowPageFrame className="bg-[var(--color-background-primary)]" dir={dir}>
        <MvProjectReportHeader
          compact
          projectId={projectId}
          activeStep="asset-images"
          breadcrumbs={[{ label: projectName ?? projectId }, { label: t("workflow.systemImages.breadcrumb") }]}
        />
        <MvErrorState
          title={t("assetImages.system.loadFailedTitle")}
          description={loadError}
          onRetry={() => void load()}
          className="flex-1"
        />
      </MvWorkflowPageFrame>
    );
  }

  return (
    <MvWorkflowPageFrame className="bg-[var(--color-background-primary)]" dir={dir}>
      <MvProjectReportHeader
        compact
        projectId={projectId}
        activeStep="asset-images"
        breadcrumbs={[
          { label: projectName ?? projectId, href: `/machine-valuation/${projectId}/workflow/report-data` },
          { label: t("assetImages.breadcrumb"), href: `/machine-valuation/${projectId}/workflow/asset-images` },
          { label: t("workflow.systemImages.breadcrumb") },
        ]}
      />
      <div className="shrink-0 border-b border-slate-200/80 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl space-y-2 px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                className="h-8 text-[11px]"
                onClick={selectAll}
                disabled={allSelectionKeys.length === 0}
              >
                {t("assetImages.system.selectAll")}
              </Button>
              <Button type="button" variant="outline" className="h-8 text-[11px]" onClick={clearSelection}>
                {t("assetImages.system.clearSelection")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 gap-1 text-[11px] text-red-600 hover:bg-red-50"
                disabled={selected.size === 0 || working}
                onClick={() => void runDelete()}
              >
                {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                {t("assetImages.system.deleteSelected")}
              </Button>
              <Button
                type="button"
                className="h-8 text-[11px] bg-[#0C447C] text-white hover:bg-[#0a3a66]"
                disabled={selected.size === 0}
                onClick={runAddToReport}
              >
                {t("assetImages.system.addToReport")}
              </Button>
              <Button type="button" variant="ghost" asChild className="h-8 text-[11px]">
                <Link href={`/machine-valuation/${projectId}/workflow/asset-images`}>{t("assetImages.system.back")}</Link>
              </Button>
              <Button type="button" variant="ghost" className="h-8 text-[11px]" onClick={() => void load({ silent: true })}>
                {t("assetImages.system.refresh")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <MvWorkflowPageScrollBody>
      <div className="mx-auto min-h-full max-w-7xl space-y-3 px-3 py-3 pb-8">
        {hydration.active && hydration.total > 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2 text-[11px] text-sky-900">
            <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("assetImages.system.hydratingFolders")}
            </span>
            <span className="font-semibold tabular-nums">
              {hydration.completed} / {hydration.total}
            </span>
          </div>
        ) : null}
        {blocks.length === 0 ? (
          <MvEmptyState
            icon={<ImageIcon className="h-6 w-6" />}
            title={t("assetImages.system.emptyTitle")}
            description={t("assetImages.system.emptyBody")}
          />
        ) : (
          <div className="space-y-4">
            {blocks.slice(0, visibleLimit).map((b) => {
              const images = b.picAsset?.images ?? [];
              const folderHydrating = hydration.active && picAssetNeedsMediaFetch(b.picAsset);
              const folderSelectedCount = images.reduce(
                (n, _, i) => n + (selected.has(selectionKey(b.sub._id, i)) ? 1 : 0),
                0,
              );
              const allInFolder = images.length > 0 && folderSelectedCount === images.length;
              const onFolderPatched = (nextPic: PicAsset) => {
                const sid = b.sub._id;
                const prefix = `${sid}::`;
                setSelected((prev) => {
                  const n = new Set<string>();
                  for (const k of prev) {
                    if (!k.startsWith(prefix)) n.add(k);
                  }
                  return n;
                });
                setBlocks((prev) => prev.map((row) => (row.sub._id === sid ? { ...row, picAsset: nextPic } : row)));
              };

              return (
                <section
                  key={b.sub._id}
                  className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2">
                    <h2 className="text-[13px] font-semibold text-slate-900">{b.sub.name}</h2>
                    {images.length > 0 ? (
                      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-600">
                        <Checkbox
                          checked={allInFolder}
                          onCheckedChange={(v) => setFolderAll(b.sub._id, images.length, Boolean(v))}
                        />
                        {t("assetImages.system.selectAllInFolder", { count: numberFormatter.format(images.length) })}
                      </label>
                    ) : folderHydrating ? (
                      <span className="flex items-center gap-1.5 text-[11px] text-sky-700">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        {t("assetImages.system.loadingImages")}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">{t("assetImages.system.noImages")}</span>
                    )}
                  </div>
                  {b.picAsset ? (
                    <div className="p-2 sm:p-3">
                      <MvPicAssetPanel
                        projectId={projectId}
                        subProjectId={b.sub._id}
                        asset={b.picAsset}
                        mode="imagesOnly"
                        onPatched={onFolderPatched}
                        selectionKeyForIndex={(idx) => selectionKey(b.sub._id, idx)}
                        selectedKeys={selected}
                        onToggleSelectionKey={toggleKey}
                      />
                    </div>
                  ) : (
                    <p className="px-3 py-4 text-center text-[12px] text-slate-500">
                      {t("assetImages.system.noLinkedAsset")}
                    </p>
                  )}
                </section>
              );
            })}
            {visibleLimit < blocks.length ? (
              <div className="flex justify-center pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 min-w-40 text-[12px]"
                  onClick={() => setVisibleLimit((current) => Math.min(current + 40, blocks.length))}
                >
                  {t("assetImages.system.showMore", {
                    count: numberFormatter.format(Math.min(40, blocks.length - visibleLimit)),
                  })}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>
      </MvWorkflowPageScrollBody>
    </MvWorkflowPageFrame>
  );
}
