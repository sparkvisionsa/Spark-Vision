"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "@/components/prefetch-link";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { patchMvSubprojectPicAsset, mvPicAssetImagesToPatchPayload, MvPicAssetPanel } from "./mv-pic-asset-panel";
import { isPhotosSubfolderName, isRootSubProjectParent, sortSubProjectsForDisplay } from "./mv-subproject-helpers";
import { MvEmptyState, MvTopBar } from "./mv-ui";
import { fetchWithRetry } from "./mv-concurrent-fetch";
import { MvProjectReportHeader } from "./mv-simple-report-navigation";
import { MvWorkflowPageFrame, MvWorkflowPageScrollBody } from "./mv-workflow-page-frame";
import type { MvSubProject, PicAsset, PicAssetImage } from "./types";

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
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [blocks, setBlocks] = useState<FolderBlock[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [working, setWorking] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const showFullPageLoad = !opts?.silent;
    if (showFullPageLoad) setLoading(true);
    try {
      const res = await fetch(`/api/mv/projects/${projectId}?picAssetMode=summary`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { subProjects?: MvSubProject[] };
      const subProjects = data.subProjects ?? [];
      const previewRoot = subProjects.find((s) => isRootSubProjectParent(s.parent) && isPhotosSubfolderName(s.name));
      if (!previewRoot) {
        setBlocks([]);
        return;
      }
      const byId = new Map(subProjects.map((s) => [s._id, s]));
      const isUnderPhotosRoot = (sub: MvSubProject) => {
        let parent = sub.parent;
        const seen = new Set<string>();
        while (parent && parent.trim()) {
          if (parent === previewRoot._id) return true;
          if (seen.has(parent)) return false;
          seen.add(parent);
          parent = byId.get(parent)?.parent ?? null;
        }
        return false;
      };
      const children = sortSubProjectsForDisplay(subProjects.filter(isUnderPhotosRoot));

      const entries: FolderBlock[] = [];
      for (const sub of children) {
        const r = await fetchWithRetry(`/api/mv/projects/${projectId}/subprojects/${sub._id}`, {
          credentials: "include",
        });
        if (!r.ok) {
          entries.push({ sub, picAsset: sub.picAsset ?? null });
          continue;
        }
        const row = (await r.json()) as MvSubProject & { picAsset?: PicAsset | null };
        entries.push({ sub, picAsset: row.picAsset ?? null });
      }
      setBlocks(entries);
    } catch {
      setBlocks([]);
    } finally {
      if (showFullPageLoad) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
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
    if (!window.confirm(`حذف ${selected.size} صورة من أصول المشروع؟ لا يمكن التراجع.`)) return;

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
      toast({ description: "تم حذف الصور المحددة." });
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "تعذر حذف الصور.",
      });
    } finally {
      setWorking(false);
    }
  };

  const runAddToReport = () => {
    if (selected.size === 0) {
      toast({ description: "اختر صورة واحدة على الأقل." });
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
      toast({ description: `تمت إضافة ${items.length} صورة لقائمة التقرير (مؤقتاً في الجلسة).` });
    } catch {
      toast({ variant: "destructive", description: "تعذر حفظ القائمة." });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen" dir="rtl">
        <MvTopBar breadcrumbs={[{ label: "..." }]} saveState="idle" />
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <MvWorkflowPageFrame className="bg-[var(--color-background-primary)]" dir="rtl">
      <MvProjectReportHeader
        compact
        projectId={projectId}
        activeStep="asset-images"
        breadcrumbs={[
          { label: projectName ?? projectId, href: `/machine-valuation/${projectId}/workflow/report-data` },
          { label: "تحديد صور الأصول", href: `/machine-valuation/${projectId}/workflow/asset-images` },
          { label: "تحديث الصور من النظام" },
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
                تحديد الكل
              </Button>
              <Button type="button" variant="outline" className="h-8 text-[11px]" onClick={clearSelection}>
                إلغاء التحديد
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 gap-1 text-[11px] text-red-600 hover:bg-red-50"
                disabled={selected.size === 0 || working}
                onClick={() => void runDelete()}
              >
                {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                حذف المحدد
              </Button>
              <Button
                type="button"
                className="h-8 text-[11px] bg-[#0C447C] text-white hover:bg-[#0a3a66]"
                disabled={selected.size === 0}
                onClick={runAddToReport}
              >
                إضافة المحدد للتقرير
              </Button>
              <Button type="button" variant="ghost" asChild className="h-8 text-[11px]">
                <Link href={`/machine-valuation/${projectId}/workflow/asset-images`}>رجوع</Link>
              </Button>
              <Button type="button" variant="ghost" className="h-8 text-[11px]" onClick={() => void load({ silent: true })}>
                تحديث
              </Button>
            </div>
          </div>
        </div>
      </div>

      <MvWorkflowPageScrollBody>
      <div className="mx-auto min-h-full max-w-7xl space-y-3 px-3 py-3 pb-8">
        {blocks.length === 0 ? (
          <MvEmptyState
            icon={<ImageIcon className="h-6 w-6" />}
            title="لا توجد مجلدات أصول بعد"
            description="يظهر هنا محتوى «2.صور المعاينة» عند إنشاء مجلدات الأصول (مثلاً من استيراد الأصول أو إنشاء المجلدات من الجداول)."
          />
        ) : (
          <div className="space-y-4">
            {blocks.map((b) => {
              const images = b.picAsset?.images ?? [];
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
                        تحديد الكل في المجلد ({images.length})
                      </label>
                    ) : (
                      <span className="text-[11px] text-slate-400">لا صور</span>
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
                      لا بيانات أصل مربوطة بهذا المجلد بعد
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
      </MvWorkflowPageScrollBody>
    </MvWorkflowPageFrame>
  );
}
