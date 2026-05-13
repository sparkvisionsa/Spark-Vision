"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/components/prefetch-link";
import {
  Download,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Loader2,
  MoreVertical,
  Trash2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import CreateDialog from "./create-dialog";
import { isRootSubProjectParent, sortSubProjectsForDisplay } from "./mv-subproject-helpers";
import { MV_PROJECTS_TABLE_PATH } from "./mv-home-routes";
import { MvEmptyState, MvTopBar } from "./mv-ui";
import { MvProjectFoldersMenu } from "./mv-simple-report-navigation";
import type { MvDriveFile, MvProject, MvSubProject } from "./types";
import { MvPicAssetPanel } from "./mv-pic-asset-panel";
import { useMvInPageNavigation } from "./mv-inpage-navigation";

interface MvDriveExplorerProps {
  projectId: string;
  currentSubProjectId?: string;
  showProjectsBackAction?: boolean;
}

const numberFormatter = new Intl.NumberFormat("ar-SA");

function formatFileSize(sizeBytes: number) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return "0 ب";
  if (sizeBytes < 1024) return `${numberFormatter.format(sizeBytes)} ب`;
  if (sizeBytes < 1024 * 1024) {
    return `${numberFormatter.format(Math.round(sizeBytes / 1024))} ك.ب`;
  }
  if (sizeBytes < 1024 * 1024 * 1024) {
    return `${numberFormatter.format(Number((sizeBytes / (1024 * 1024)).toFixed(1)))} م.ب`;
  }
  return `${numberFormatter.format(Number((sizeBytes / (1024 * 1024 * 1024)).toFixed(1)))} ج.ب`;
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function fileIconFor(file: MvDriveFile) {
  const mime = file.mimeType.toLowerCase();
  const ext = (file.extension ?? "").toLowerCase();

  if (mime.startsWith("image/")) return FileImage;
  if (mime.includes("pdf")) return FileText;
  if (
    mime.includes("sheet") ||
    mime.includes("excel") ||
    ext === "xlsx" ||
    ext === "xls" ||
    ext === "csv"
  ) {
    return FileSpreadsheet;
  }
  if (
    mime.includes("word") ||
    mime.includes("text") ||
    ext === "doc" ||
    ext === "docx" ||
    ext === "txt"
  ) {
    return FileText;
  }
  if (
    mime.includes("zip") ||
    mime.includes("rar") ||
    mime.includes("7z") ||
    ext === "zip" ||
    ext === "rar" ||
    ext === "7z"
  ) {
    return FileArchive;
  }
  return File;
}

export default function MvDriveExplorer({
  projectId,
  currentSubProjectId,
  showProjectsBackAction = false,
}: MvDriveExplorerProps) {
  const { navigate } = useMvInPageNavigation();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [project, setProject] = useState<MvProject | null>(null);
  const [subProjects, setSubProjects] = useState<MvSubProject[]>([]);
  /** بيانات المجلد الحالي كاملة (صور) — تُجلب بـ ‎GET .../subprojects/:id‎ بجانب الاستجابة الخفيفة للمشروع */
  const [activeFolderDetail, setActiveFolderDetail] = useState<MvSubProject | null>(null);
  const [files, setFiles] = useState<MvDriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [refetching, setRefetching] = useState(false);

  const rootExplorerHref = `/machine-valuation/${projectId}/files`;

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      try {
        if (!opts?.silent) setLoading(true);

        const filesQuery = currentSubProjectId
          ? `?${new URLSearchParams({ subProjectId: currentSubProjectId }).toString()}`
          : "";

        const projectQ = new URLSearchParams();
        projectQ.set("picAssetMode", "summary");
        const projectUrl = `/api/mv/projects/${projectId}?${projectQ.toString()}`;

        const detailPromise = currentSubProjectId
          ? fetch(
              `/api/mv/projects/${projectId}/subprojects/${encodeURIComponent(currentSubProjectId)}`,
              { credentials: "include" },
            )
          : Promise.resolve(null as Response | null);

        const [projectRes, filesRes, subDetailRes] = await Promise.all([
          fetch(projectUrl, { credentials: "include" }),
          fetch(`/api/mv/projects/${projectId}/files${filesQuery}`, { credentials: "include" }),
          detailPromise,
        ]);

        if (projectRes.ok) {
          try {
            const projectData = (await projectRes.json()) as {
              project: MvProject;
              subProjects: MvSubProject[];
            };
            setProject(projectData.project);
            setSubProjects(projectData.subProjects ?? []);
          } catch {
            /* non-JSON or parse error — keep prior state */
          }
        } else {
          setProject(null);
          setSubProjects([]);
        }

        if (subDetailRes && subDetailRes.ok) {
          try {
            const row = (await subDetailRes.json()) as MvSubProject;
            setActiveFolderDetail(row);
          } catch {
            setActiveFolderDetail(null);
          }
        } else {
          setActiveFolderDetail(null);
        }

        if (filesRes.ok) {
          try {
            setFiles((await filesRes.json()) as MvDriveFile[]);
          } catch {
            setFiles([]);
          }
        } else {
          setFiles([]);
        }
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [currentSubProjectId, projectId],
  );

  const handleRefreshFromServer = useCallback(async () => {
    setRefetching(true);
    try {
      await load({ silent: true });
    } finally {
      setRefetching(false);
    }
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentFolder = useMemo(() => {
    if (!currentSubProjectId) return null;
    if (activeFolderDetail?._id === currentSubProjectId) {
      return activeFolderDetail;
    }
    return subProjects.find((folder) => folder._id === currentSubProjectId) ?? null;
  }, [activeFolderDetail, currentSubProjectId, subProjects]);

  const childFolders = useMemo(() => {
    const direct = subProjects.filter(
      (folder) => (folder.parent ?? undefined) === (currentSubProjectId ?? undefined),
    );
    return sortSubProjectsForDisplay(direct);
  }, [currentSubProjectId, subProjects]);

  const rootFolders = useMemo(
    () => sortSubProjectsForDisplay(subProjects.filter((folder) => isRootSubProjectParent(folder.parent))),
    [subProjects],
  );

  const folderChain = useMemo(() => {
    if (!currentSubProjectId) return [] as MvSubProject[];

    const byId = new Map(subProjects.map((folder) => [folder._id, folder]));
    const chain: MvSubProject[] = [];
    const visited = new Set<string>();
    let cursor = byId.get(currentSubProjectId);

    while (cursor && !visited.has(cursor._id)) {
      chain.push(cursor);
      visited.add(cursor._id);
      cursor = cursor.parent ? byId.get(cursor.parent) : undefined;
    }

    return chain.reverse();
  }, [currentSubProjectId, subProjects]);

  const breadcrumbs = useMemo(() => {
    const base = [{ label: project?.name ?? projectId, href: `/machine-valuation/${projectId}/workflow/report-data` }];
    if (!currentSubProjectId) {
      return [...base, { label: "ملفات المشروع" }];
    }

    return [
      ...base,
      { label: "ملفات المشروع", href: rootExplorerHref },
      ...folderChain.map((folder, index) => ({
        label: folder.name,
        href:
          index === folderChain.length - 1
            ? undefined
            : `/machine-valuation/${projectId}/${folder._id}`,
      })),
    ];
  }, [currentSubProjectId, folderChain, project?.name, projectId, rootExplorerHref]);

  const parentFolderHref = useMemo(() => {
    if (!currentFolder) return null;
    return currentFolder.parent
      ? `/machine-valuation/${projectId}/${currentFolder.parent}`
      : rootExplorerHref;
  }, [currentFolder, projectId, rootExplorerHref]);

  const handleCreateFolder = useCallback(
    async (name: string) => {
      try {
        setCreating(true);
        const response = await fetch(`/api/mv/projects/${projectId}/subprojects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name,
            ...(currentSubProjectId ? { parent: currentSubProjectId } : {}),
          }),
        });
        if (!response.ok) throw new Error();

        setDialogOpen(false);
        await load({ silent: true });
        toast({ description: "تم إنشاء المجلد بنجاح." });
      } catch {
        toast({ variant: "destructive", description: "تعذر إنشاء المجلد." });
      } finally {
        setCreating(false);
      }
    },
    [currentSubProjectId, load, projectId, toast],
  );

  const handleDeleteFolder = useCallback(
    async (folder: MvSubProject) => {
      if (!window.confirm(`حذف المجلد «${folder.name}» وكل ما بداخله؟`)) return;

      try {
        const response = await fetch(`/api/mv/projects/${projectId}/subprojects/${folder._id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!response.ok) throw new Error();

        if (folder._id === currentSubProjectId) {
          navigate(parentFolderHref ?? rootExplorerHref);
          return;
        }

        await load({ silent: true });
        toast({ description: "تم حذف المجلد." });
      } catch {
        toast({ variant: "destructive", description: "تعذر حذف المجلد." });
      }
    },
    [currentSubProjectId, load, navigate, parentFolderHref, projectId, rootExplorerHref, toast],
  );

  const handleDeleteFile = useCallback(
    async (file: MvDriveFile) => {
      if (!window.confirm(`حذف الملف «${file.name}»؟`)) return;

      try {
        const response = await fetch(`/api/mv/projects/${projectId}/files/${file._id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!response.ok) throw new Error();
        await load({ silent: true });
        toast({ description: "تم حذف الملف." });
      } catch {
        toast({ variant: "destructive", description: "تعذر حذف الملف." });
      }
    },
    [load, projectId, toast],
  );

  const handleUploadFiles = useCallback(
    async (selected: FileList | File[]) => {
      const picked = Array.from(selected ?? []).filter(Boolean);
      if (picked.length === 0) return;

      try {
        setUploading(true);
        const formData = new FormData();
        picked.forEach((file) => formData.append("files", file));

        const params = new URLSearchParams();
        if (currentSubProjectId) params.set("subProjectId", currentSubProjectId);
        const uploadUrl = `/api/mv/projects/${projectId}/files${params.size ? `?${params}` : ""}`;

        const response = await fetch(uploadUrl, {
          method: "POST",
          credentials: "include",
          body: formData,
        });
        if (!response.ok) {
          let detail = "";
          try {
            const data = (await response.json()) as { message?: unknown };
            if (typeof data.message === "string" && data.message.trim()) {
              detail = data.message.trim();
            }
          } catch {
            /* response body not JSON */
          }
          toast({
            variant: "destructive",
            description:
              detail ||
              `تعذر رفع الملفات (${response.status}). تحقق من الاتصال أو تقليل حجم الملف.`,
          });
          return;
        }

        try {
          await load({ silent: true });
        } catch {
          /* الرفع نجح على الخادم؛ التحديث اختياري */
        }

        toast({
          description:
            picked.length === 1
              ? "تم رفع الملف بنجاح."
              : `تم رفع ${numberFormatter.format(picked.length)} ملفات بنجاح.`,
        });
      } catch (err) {
        const extra =
          err instanceof Error && err.message ? ` (${err.message.slice(0, 120)})` : "";
        toast({
          variant: "destructive",
          description: `تعذر رفع الملفات. تحقق من الشبكة ثم أعد المحاولة.${extra}`,
        });
      } finally {
        setUploading(false);
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }
    },
    [currentSubProjectId, load, projectId, toast],
  );

  if (loading) {
    return (
      <div className="min-h-screen" dir="rtl">
        <MvTopBar breadcrumbs={[{ label: "..." }]} saveState="idle" />
        <div className="space-y-2 px-3 py-2">
          <div className="h-9 animate-pulse rounded-xl bg-white/80" />
          <div className="h-28 animate-pulse rounded-xl bg-white/80" />
          <div className="h-52 animate-pulse rounded-xl bg-white/80" />
        </div>
      </div>
    );
  }

  if (currentSubProjectId && !currentFolder) {
    return (
      <div className="min-h-screen bg-[var(--color-background-primary)]" dir="rtl">
        <MvTopBar
          breadcrumbs={[
            { label: project?.name ?? projectId, href: `/machine-valuation/${projectId}/workflow/report-data` },
            { label: "ملفات المشروع", href: rootExplorerHref },
            { label: "غير موجود" },
          ]}
          saveState="idle"
          trailing={<MvProjectFoldersMenu projectId={projectId} folders={rootFolders} />}
        />
        <div className="px-3 py-3">
          <MvEmptyState
            icon={<FolderOpen className="h-6 w-6" />}
            title="المجلد غير موجود"
            action={
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-lg text-[12px]"
                onClick={() => navigate(rootExplorerHref)}
              >
                العودة إلى المجلدات
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background-primary)]" dir="rtl">
      <MvTopBar
        breadcrumbs={breadcrumbs}
        saveState={uploading ? "saving" : "idle"}
        trailing={<MvProjectFoldersMenu projectId={projectId} folders={rootFolders} />}
      />

      <div
        className={cn("mx-auto max-w-7xl space-y-2.5 px-3 py-2.5 transition", dragging && "scale-[1.003]")}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (uploading) return;
          void handleUploadFiles(event.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) {
              void handleUploadFiles(event.target.files);
            }
          }}
        />

        <section
          className={cn(
            "rounded-2xl border border-slate-200/80 bg-white px-3 py-3 shadow-sm",
            dragging && "border-sky-300 bg-sky-50/50",
          )}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <h1 className="text-[15px] font-semibold text-slate-900">
              {currentFolder ? currentFolder.name : "مستكشف ملفات المشروع"}
            </h1>

            <div className="flex flex-wrap items-center gap-2">
              {showProjectsBackAction ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-lg border-slate-200 px-3 text-[11px]"
                  onClick={() => navigate(MV_PROJECTS_TABLE_PATH)}
                >
                  العودة لجدول المشاريع
                </Button>
              ) : null}

              {parentFolderHref ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 rounded-lg border-slate-200 px-3 text-[11px]"
                  onClick={() => navigate(parentFolderHref)}
                >
                  العودة للأعلى
                </Button>
              ) : null}

              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-lg border-slate-200 px-3 text-[11px]"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                رفع ملفات
              </Button>

              <Button
                type="button"
                variant="outline"
                className="h-8 gap-1 rounded-lg border-slate-200 px-3 text-[11px]"
                onClick={() => void handleRefreshFromServer()}
                disabled={uploading || refetching}
                title="إعادة جلب المجلد وبيانات أصول الصور من الخادم"
              >
                {refetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                تحديث من الخادم
              </Button>

              <Button
                type="button"
                className="h-8 rounded-lg bg-[#0C447C] px-3 text-[11px] text-white hover:bg-[#0a3a66]"
                onClick={() => setDialogOpen(true)}
              >
                <FolderPlus className="h-3.5 w-3.5" />
                إنشاء مجلد
              </Button>
            </div>
          </div>
        </section>

        {currentFolder?.picAsset && currentSubProjectId ? (
          <MvPicAssetPanel
            projectId={projectId}
            subProjectId={currentSubProjectId}
            asset={currentFolder.picAsset}
            onPatched={() => {
              void load({ silent: true });
            }}
          />
        ) : null}

        <section className="rounded-2xl border border-slate-200/80 bg-white p-2.5 shadow-sm">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <Link
                href={`/machine-valuation/${projectId}/inspector-files`}
                className="group flex rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/95 to-white p-3 shadow-sm transition hover:border-violet-300 hover:shadow-md"
              >
                <div className="flex w-full items-start gap-2 text-right">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 ring-1 ring-violet-200/80">
                    <Folder className="h-5 w-5 fill-current" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold text-violet-950">ملفات المعاين</p>
                    <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-snug text-violet-800/90">
                      صور وملفات المعاين الميداني — افتح من هنا
                    </p>
                  </div>
                </div>
              </Link>
              {childFolders.map((folder) => (
                <div
                  key={folder._id}
                  className="group rounded-xl border border-slate-200 bg-slate-50/70 p-3 transition hover:border-slate-300 hover:bg-white hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/machine-valuation/${projectId}/${folder._id}`)}
                      className="flex min-w-0 flex-1 items-start gap-2 text-right"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                        <Folder className="h-5 w-5 fill-current" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-slate-900">{folder.name}</p>
                      </div>
                    </button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          aria-label={`إجراءات ${folder.name}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 text-right">
                        <DropdownMenuItem
                          onSelect={() => navigate(`/machine-valuation/${projectId}/${folder._id}`)}
                          className="cursor-pointer text-[12px]"
                        >
                          <FolderOpen className="h-4 w-4 text-amber-600" />
                          فتح المجلد
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => void handleDeleteFolder(folder)}
                          className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                          حذف المجلد
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}

              {files.map((file) => {
                const Icon = fileIconFor(file);
                return (
                  <div
                    key={file._id}
                    className="group rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-start gap-2">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-100">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-[12px] font-semibold text-slate-900" dir="auto">
                            {file.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                            <span>{formatFileSize(file.sizeBytes)}</span>
                            <span>•</span>
                            <span>{formatShortDate(file.uploadedAt)}</span>
                          </div>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                            aria-label={`إجراءات ${file.name}`}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 text-right">
                          <DropdownMenuItem asChild className="text-[12px]">
                            <a
                              href={`/api/mv/projects/${projectId}/files/${file._id}/download`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Download className="h-4 w-4 text-sky-600" />
                              فتح أو تنزيل
                            </a>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => void handleDeleteFile(file)}
                            className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                            حذف الملف
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
                      <span className="text-[10px] text-slate-500" dir="auto">
                        {file.extension ? `.${file.extension}` : file.mimeType}
                      </span>
                      <a
                        href={`/api/mv/projects/${projectId}/files/${file._id}/download`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-[#0C447C] transition hover:text-[#0a3765]"
                      >
                        <Download className="h-3.5 w-3.5" />
                        فتح
                      </a>
                    </div>
                  </div>
                );
              })}
              {childFolders.length === 0 && files.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-[11px] text-slate-500">
                  لا مجلدات ولا ملفات في هذا الموقع — يمكنك فتح «ملفات المعاين» أعلاه أو إنشاء مجلد.
                </div>
              ) : null}
            </div>
          </section>
      </div>

      <CreateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        variant="sub-project"
        loading={creating}
        onSubmit={(name) => void handleCreateFolder(name)}
      />
    </div>
  );
}
