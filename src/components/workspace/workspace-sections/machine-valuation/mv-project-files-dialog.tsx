"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  File as FileIcon,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Loader2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MvDialogContent } from "./mv-dialog";
import { cn } from "@/lib/utils";
import { sortSubProjectsForDisplay } from "./mv-subproject-helpers";
import type { MvDriveFile, MvSubProject } from "./types";

type FileFilter = (file: MvDriveFile) => boolean;

export function isImageOrPdfProjectFile(file: MvDriveFile) {
  return file.mimeType.startsWith("image/") || file.mimeType.includes("pdf") || /\.(pdf|png|jpe?g|webp|gif|bmp)$/i.test(file.name);
}

function fileIcon(file: MvDriveFile) {
  if (file.mimeType.startsWith("image/")) return FileImage;
  if (file.mimeType.includes("pdf") || /\.pdf$/i.test(file.name)) return FileText;
  return FileIcon;
}

export function MvProjectFilesDialog({
  projectId,
  open,
  onOpenChange,
  initialFolderId,
  initialFolderMatcher,
  fileFilter,
  onPickFiles,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Folder to open when launched from the project-folders menu. */
  initialFolderId?: string | null;
  /** Useful for a scoped picker, such as the default "Client files" folder. */
  initialFolderMatcher?: (folder: MvSubProject) => boolean;
  fileFilter?: FileFilter;
  /** When given, the dialog becomes a picker and returns downloaded File objects. */
  onPickFiles?: (files: File[]) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [folders, setFolders] = useState<MvSubProject[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [files, setFiles] = useState<MvDriveFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const loadFolders = useCallback(async () => {
    const res = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}?picAssetMode=summary`, { credentials: "include" });
    if (!res.ok) throw new Error("تعذر تحميل مجلدات المشروع");
    const data = await res.json() as { subProjects?: MvSubProject[] };
    return data.subProjects ?? [];
  }, [projectId]);

  const loadFiles = useCallback(async (nextFolderId: string | null, signal?: AbortSignal) => {
    setLoading(true);
    setSelected(new Set());
    try {
      const query = nextFolderId ? `?${new URLSearchParams({ subProjectId: nextFolderId })}` : "";
      const res = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}/files${query}`, { credentials: "include", signal });
      if (!res.ok) throw new Error("تعذر تحميل الملفات");
      setFiles(await res.json() as MvDriveFile[]);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setFiles([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void loadFolders().then((rows) => {
      if (controller.signal.aborted) return;
      setFolders(rows);
      const matched = initialFolderMatcher ? rows.find(initialFolderMatcher)?._id : undefined;
      setFolderId(initialFolderId ?? matched ?? null);
    }).catch(() => setFolders([]));
    return () => controller.abort();
  }, [initialFolderId, initialFolderMatcher, loadFolders, open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void loadFiles(folderId, controller.signal);
    return () => controller.abort();
  }, [folderId, loadFiles, open]);

  const currentFolder = folders.find((folder) => folder._id === folderId) ?? null;
  const children = useMemo(
    () => sortSubProjectsForDisplay(folders.filter((folder) => (folder.parent || null) === folderId)),
    [folderId, folders],
  );
  const visibleFiles = useMemo(() => files.filter((file) => !fileFilter || fileFilter(file)), [fileFilter, files]);

  const openFolder = (id: string | null) => setFolderId(id);
  const goUp = () => openFolder(currentFolder?.parent || null);

  const refresh = useCallback(async () => {
    const rows = await loadFolders();
    setFolders(rows);
    await loadFiles(folderId);
  }, [folderId, loadFiles, loadFolders]);

  const upload = useCallback(async (picked: FileList | File[]) => {
    const items = Array.from(picked).filter((file) => file.size > 0);
    if (!items.length) return;
    setUploading(true);
    try {
      // Browser folder pickers expose the hierarchy through webkitRelativePath.
      // Re-create that hierarchy instead of flattening every file into the open
      // folder, then upload each group to its matching server-side folder.
      const knownFolders = [...folders];
      const ensurePath = async (parts: string[]) => {
        let parent = folderId ?? null;
        for (const rawName of parts) {
          const name = rawName.trim();
          if (!name) continue;
          let found = knownFolders.find((row) => (row.parent || null) === parent && row.name === name);
          if (!found) {
            const res = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}/subprojects`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, ...(parent ? { parent } : {}) }),
            });
            if (!res.ok) throw new Error("تعذر إنشاء هيكل المجلد المرفوع");
            found = await res.json() as MvSubProject;
            knownFolders.push(found);
          }
          parent = found._id;
        }
        return parent;
      };

      const groups = new Map<string | null, File[]>();
      for (const file of items) {
        const path = file.webkitRelativePath || "";
        const parent = path.includes("/")
          ? await ensurePath(path.split("/").slice(0, -1))
          : folderId ?? null;
        groups.set(parent, [...(groups.get(parent) ?? []), file]);
      }
      for (const [targetFolderId, group] of groups) {
        const form = new FormData();
        group.forEach((file) => form.append("files", file, file.name));
        const qs = targetFolderId ? `?${new URLSearchParams({ subProjectId: targetFolderId })}` : "";
        const res = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}/files${qs}`, {
          method: "POST", credentials: "include", body: form,
        });
        if (!res.ok) throw new Error("تعذر رفع الملفات");
      }
      setFolders(knownFolders);
      await loadFiles(folderId);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
      if (folderInputRef.current) folderInputRef.current.value = "";
    }
  }, [folderId, folders, loadFiles, projectId]);

  const createFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setUploading(true);
    try {
      const res = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}/subprojects`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...(folderId ? { parent: folderId } : {}) }),
      });
      if (!res.ok) throw new Error("تعذر إنشاء المجلد");
      setNewFolderName("");
      setNewFolderOpen(false);
      await refresh();
    } finally { setUploading(false); }
  }, [folderId, newFolderName, projectId, refresh]);

  const pickSelected = useCallback(async () => {
    if (!onPickFiles || selected.size === 0) return;
    setPicking(true);
    try {
      const picked = visibleFiles.filter((file) => selected.has(file._id));
      const result = await Promise.all(picked.map(async (file) => {
        const res = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(file._id)}/download`, { credentials: "include" });
        if (!res.ok) throw new Error(`تعذر قراءة ${file.name}`);
        return new File([await res.blob()], file.name, { type: file.mimeType || "application/octet-stream" });
      }));
      await onPickFiles(result);
      onOpenChange(false);
    } finally { setPicking(false); }
  }, [onOpenChange, onPickFiles, projectId, selected, visibleFiles]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <MvDialogContent dir="rtl" className="flex h-[min(88vh,52rem)] w-[min(96vw,78rem)] max-w-none flex-col overflow-hidden rounded-2xl border-slate-200 p-0">
        <DialogHeader className="border-b border-slate-200 bg-white px-4 py-3 pe-14 text-start">
          <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-900">
            <FolderOpen className="h-5 w-5 text-amber-500" />
            {onPickFiles ? "اختيار من مجلد ملفات العميل" : "مجلدات المشروع"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
            <Button type="button" variant="outline" size="sm" className="h-8 text-[11px]" disabled={!currentFolder} onClick={goUp}>
              <ChevronRight className="h-3.5 w-3.5" /> رجوع
            </Button>
            <div className="min-w-0 flex-1 truncate text-[12px] font-bold text-slate-700">
              {currentFolder?.name || "جذر المشروع"}
            </div>
            {newFolderOpen ? (
              <div className="flex items-center gap-1">
                <input autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void createFolder()} className="h-8 w-40 rounded-md border border-slate-300 px-2 text-[11px]" placeholder="اسم المجلد" />
                <Button type="button" size="sm" className="h-8 text-[11px]" disabled={uploading} onClick={() => void createFolder()}>إنشاء</Button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-[11px]" disabled={uploading} onClick={() => setNewFolderOpen(true)}><FolderPlus className="h-3.5 w-3.5" />مجلد جديد</Button>
            )}
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-[11px]" disabled={uploading} onClick={() => inputRef.current?.click()}><Upload className="h-3.5 w-3.5" />رفع ملفات</Button>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-[11px]" disabled={uploading} onClick={() => folderInputRef.current?.click()}><Folder className="h-3.5 w-3.5" />رفع مجلد</Button>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => void upload(e.target.files ?? [])} />
            <input ref={folderInputRef} type="file" multiple className="hidden" {...{ webkitdirectory: "", directory: "" }} onChange={(e) => void upload(e.target.files ?? [])} />
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto p-3"
            onDragOver={(event) => {
              if (Array.from(event.dataTransfer.types).includes("Files")) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              void upload(event.dataTransfer.files);
            }}
          >
            {loading ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-sky-700" /></div> : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {children.map((folder) => <button key={folder._id} type="button" onClick={() => openFolder(folder._id)} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-right transition hover:border-amber-300 hover:bg-amber-50/30"><span className="rounded-lg bg-amber-50 p-2 text-amber-500"><Folder className="h-5 w-5 fill-current" /></span><span className="truncate text-[12px] font-bold text-slate-800">{folder.name}</span></button>)}
                {visibleFiles.map((file) => {
                  const Icon = fileIcon(file); const checked = selected.has(file._id);
                  return <button key={file._id} type="button" onClick={() => onPickFiles ? setSelected((old) => { const next = new Set(old); checked ? next.delete(file._id) : next.add(file._id); return next; }) : window.open(`/api/mv/projects/${projectId}/files/${file._id}/download`, "_blank", "noopener,noreferrer")} className={cn("flex min-w-0 items-center gap-3 rounded-xl border bg-white p-3 text-right transition", checked ? "border-sky-500 ring-2 ring-sky-100" : "border-slate-200 hover:border-sky-300")}><span className="rounded-lg bg-sky-50 p-2 text-sky-700"><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-bold text-slate-800" dir="auto">{file.name}</span><span className="block truncate text-[10px] text-slate-500">{file.mimeType}</span></span>{onPickFiles ? <span className={cn("h-4 w-4 rounded border", checked ? "border-sky-600 bg-sky-600" : "border-slate-300")} /> : null}</button>;
                })}
                {!children.length && !visibleFiles.length ? <div className="col-span-full py-14 text-center text-[12px] font-semibold text-slate-400">لا توجد مجلدات أو ملفات هنا بعد. اسحب الملفات أو المجلدات وأفلتها هنا للرفع.</div> : null}
              </div>
            )}
          </div>
          {onPickFiles ? <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3"><span className="text-[11px] font-semibold text-slate-500">{selected.size} ملف محدد — الصور وملفات PDF فقط</span><Button type="button" className="h-8 bg-[#0C447C] text-[11px] hover:bg-[#0a3a66]" disabled={!selected.size || picking} onClick={() => void pickSelected()}>{picking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}إضافة إلى المرفقات</Button></div> : null}
        </div>
      </MvDialogContent>
    </Dialog>
  );
}
