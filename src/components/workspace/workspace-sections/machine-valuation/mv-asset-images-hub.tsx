"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  CheckSquare,
  FileSpreadsheet,
  FileVideo,
  GripVertical,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderUp,
  ImageIcon,
  Loader2,
  MinusSquare,
  MoreVertical,
  PlusSquare,
  RefreshCw,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  type AssetImportResult,
  normalizeImportResult,
} from "./asset-import-panel";
import { mvPicAssetImagesToPatchPayload, patchMvSubprojectPicAsset } from "./mv-pic-asset-panel";
import { MvAssetImageFoldersModal } from "./mv-asset-image-folders-modal";
import { MvProjectReportHeader } from "./mv-simple-report-navigation";
import { isPhotosSubfolderName, isRootSubProjectParent, sortSubProjectsForDisplay } from "./mv-subproject-helpers";
import type { MvDriveFile, MvProject, MvProjectReportData, MvSubProject, PicAsset, PicAssetImage } from "./types";
import {
  MV_WORKFLOW_SESSION,
  readMvWorkflowSessionJson,
  writeMvWorkflowSessionJson,
  clearMvWorkflowSessionKey,
} from "./mv-workflow-session-cache";
import { fetchWithRetry, mapWithConcurrency } from "./mv-concurrent-fetch";
import { MvWorkflowPageFrame, MvWorkflowPageScrollBody } from "./mv-workflow-page-frame";

interface MvAssetImagesHubProps {
  projectId: string;
  projectName: string | null;
}

type PickedImageFile = {
  file: File;
  relativePath: string;
};

type ImageFolderNode = {
  name: string;
  path: string;
  folders: ImageFolderNode[];
  images: AssetImageViewFile[];
  /** فيديوهات التطبيق — تُعرض تحت «٢. فيديوهات المعاينة» فقط */
  videos: AssetImageViewFile[];
  imageCount: number;
  videoCount: number;
  picAssetId?: string;
  isSynthetic?: boolean;
  sheetName?: string | null;
  importId?: string | null;
};

type AssetImageViewFile = MvDriveFile & {
  displayOnlyPicAssetImage?: boolean;
  downloadFileId?: string;
  sourceUrl?: string;
  picAssetSubProjectId?: string;
  picAssetImageIndex?: number;
};

type WebkitEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
};

type WebkitFileEntry = WebkitEntry & {
  file: (success: (file: File) => void, failure?: (error: DOMException) => void) => void;
};

type WebkitDirectoryEntry = WebkitEntry & {
  createReader: () => {
    readEntries: (
      success: (entries: WebkitEntry[]) => void,
      failure?: (error: DOMException) => void,
    ) => void;
  };
};

const imageExtensions = /\.(jpe?g|png|gif|webp|bmp|heic|heif|svg|tif|tiff)$/i;
const numberFormatter = new Intl.NumberFormat("ar-SA");
type AssetImagesSource = "app" | "device";
type AppPreviewMediaTab = "images" | "videos";

function isExternalPicAssetVideo(image: PicAssetImage): boolean {
  const mt = (image as { mediaType?: unknown }).mediaType;
  if (typeof mt === "string" && mt.toLowerCase() === "video") return true;
  const mime = (image as { mimeType?: unknown }).mimeType;
  if (typeof mime === "string" && mime.toLowerCase().startsWith("video/")) return true;
  if (isExternalPicAssetImage(image)) {
    const u = image.url.toLowerCase();
    if (/\.(mp4|webm|mov|m4v|ogv|mkv)(\?|#|$)/i.test(u)) return true;
  }
  return false;
}

function isExternalPicAssetStillImage(image: PicAssetImage): image is Extract<PicAssetImage, { url: string }> {
  return isExternalPicAssetImage(image) && !isExternalPicAssetVideo(image);
}

function isMvDriveFileVideo(file: MvDriveFile): boolean {
  const mt = (file.mimeType || "").toLowerCase();
  if (mt.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|m4v|ogv|mkv)(\?|#|$)/i.test(fileNameFromPath(file.relativePath || file.name));
}

function isViewFileVideo(file: MvDriveFile): boolean {
  return isMvDriveFileVideo(file);
}

function isLikelyImage(file: File) {
  return file.type.startsWith("image/") || imageExtensions.test(file.name);
}

function isFileUploadDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types ?? []).includes("Files");
}

function cleanPathPart(value: string) {
  return value
    .trim()
    .replace(/[<>:"\\|?*\u0000-\u001f]+/g, "-")
    .replace(/^\.+$/, "")
    .trim();
}

function normalizeRelativePath(path: string, fallbackName = "image") {
  const parts = path
    .replace(/\\/g, "/")
    .split("/")
    .map(cleanPathPart)
    .filter(Boolean);

  return (parts.length > 0 ? parts.join("/") : fallbackName).slice(0, 900);
}

function fileNameFromPath(path: string) {
  return normalizeRelativePath(path).split("/").pop() || path || "image";
}

function folderPathFromRelativePath(path: string) {
  const parts = normalizeRelativePath(path).split("/").filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "";
}

function driveFileFolderPath(file: MvDriveFile): string {
  return file.folderPath ?? folderPathFromRelativePath(file.relativePath || file.name);
}

function downloadHref(projectId: string, file: MvDriveFile) {
  return `/api/mv/projects/${projectId}/files/${file._id}/download`;
}

function isExternalPicAssetImage(image: PicAssetImage): image is Extract<PicAssetImage, { url: string }> {
  return typeof (image as { url?: string }).url === "string" && (image as { url: string }).url.trim().length > 0;
}

function isDisplayOnlyPicAssetImage(file: MvDriveFile): boolean {
  return (file as AssetImageViewFile).displayOnlyPicAssetImage === true;
}

/**
 * صور التطبيق قد تأتي من PicAsset كعناصر "عرض فقط" (ليست سجلات Drive لدينا)،
 * لكن أحياناً تكون مرتبطة بملف فعلي عبر downloadFileId (fileId).
 * في هذه الحالة نستخدم الـ id الفعلي لتوحيد التحديد/السحب/الإجراءات.
 */
function effectiveDriveFileId(file: AssetImageViewFile): string | null {
  if (!isDisplayOnlyPicAssetImage(file)) return file._id;
  const effective = (file.downloadFileId ?? "").trim();
  return effective ? effective : null;
}

function selectableReportFileIds(files: readonly AssetImageViewFile[]): string[] {
  const ids = files
    .map((file) => (isDisplayOnlyPicAssetImage(file) ? effectiveDriveFileId(file) : file._id))
    .filter((id): id is string => Boolean(id && id.trim()));
  return Array.from(new Set(ids));
}

function picAssetImageDisplayFile(
  projectId: string,
  folderId: string,
  subProjectId: string,
  folderName: string,
  image: PicAssetImage,
  mediaIndex: number,
  originalIndex: number,
  isVideoEntry: boolean,
): AssetImageViewFile | null {
  const fileId = "fileId" in image && typeof image.fileId === "string" ? image.fileId.trim() : "";
  const sourceUrl = isExternalPicAssetImage(image) ? image.url.trim() : "";
  if (!fileId && !sourceUrl) return null;

  const mimeRaw = (image as { mimeType?: unknown }).mimeType;
  const mime =
    typeof mimeRaw === "string" && mimeRaw.trim().length > 0
      ? mimeRaw.trim()
      : isVideoEntry
        ? "video/mp4"
        : "image/jpeg";
  const ext = isVideoEntry ? "mp4" : "jpg";
  const baseName = isVideoEntry ? `video-${mediaIndex + 1}` : `image-${mediaIndex + 1}`;
  const name = `${baseName}.${ext}`;
  const relativePath = normalizeRelativePath(`${folderName}/${name}`, name);
  return {
    _id: `pic-asset-image:${folderId}:${originalIndex}:${fileId || "url"}`,
    projectId,
    picAssetId: folderId,
    name,
    scope: "asset-images",
    relativePath,
    folderPath: folderPathFromRelativePath(relativePath),
    mimeType: mime,
    sizeBytes: 0,
    uploadedAt: isExternalPicAssetImage(image) && image.createdAt ? image.createdAt : new Date(0).toISOString(),
    updatedAt: isExternalPicAssetImage(image) && image.createdAt ? image.createdAt : new Date(0).toISOString(),
    includeInReport:
      typeof (image as { includeInReport?: unknown }).includeInReport === "boolean"
        ? (image as { includeInReport: boolean }).includeInReport
        : false,
    /** يطابق ‎metadata.displayOrder‎ في ‎GridFS‎ بعد الـ backfill (فهرس العنصر في مصفوفة الأصل) */
    displayOrder: originalIndex,
    displayOnlyPicAssetImage: true,
    downloadFileId: fileId || undefined,
    sourceUrl: sourceUrl || undefined,
    picAssetSubProjectId: subProjectId,
    picAssetImageIndex: originalIndex,
  };
}

function createFolderNode(name: string, path: string): ImageFolderNode {
  return { name, path, folders: [], images: [], videos: [], imageCount: 0, videoCount: 0 };
}

function buildImageTree(files: MvDriveFile[]) {
  const root = createFolderNode("صور الأصول", "");
  const foldersByPath = new Map<string, ImageFolderNode>([["", root]]);

  for (const file of files) {
    // تبويب صور الأصول: نعرض الصور فقط حتى لو كان في المجلد فيديوهات.
    if (isMvDriveFileVideo(file)) continue;
    const relativePath = normalizeRelativePath(file.relativePath || file.name, file.name);
    const parts = relativePath.split("/").filter(Boolean);
    const imageName = parts.pop() || file.name;
    let cursor = root;
    let cursorPath = "";

    for (const part of parts) {
      cursorPath = cursorPath ? `${cursorPath}/${part}` : part;
      let next = foldersByPath.get(cursorPath);
      if (!next) {
        next = createFolderNode(part, cursorPath);
        foldersByPath.set(cursorPath, next);
        cursor.folders.push(next);
      }
      cursor = next;
    }

    cursor.images.push({
      ...file,
      name: file.name || imageName,
      relativePath,
      folderPath: folderPathFromRelativePath(relativePath),
    });
  }

  const sortNode = (node: ImageFolderNode): number => {
    node.folders.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    node.images.sort((a, b) => {
      const oa = typeof a.displayOrder === "number" ? a.displayOrder : null;
      const ob = typeof b.displayOrder === "number" ? b.displayOrder : null;
      if (oa !== null && ob !== null && oa !== ob) return oa - ob;
      if (oa !== null && ob === null) return -1;
      if (oa === null && ob !== null) return 1;
      return fileNameFromPath(a.relativePath || a.name).localeCompare(
        fileNameFromPath(b.relativePath || b.name),
        "ar",
      );
    });
    node.imageCount =
      node.images.length + node.folders.reduce((total, folder) => total + sortNode(folder), 0);
    node.videoCount =
      node.videos.length + node.folders.reduce((total, folder) => total + (folder.videoCount ?? 0), 0);
    return node.imageCount;
  };

  sortNode(root);
  return { root, foldersByPath };
}

/** يطابق ترتيب الخادم ‎listProjectAssetImageFiles‎ قدر الإمكان */
function sortUploadedAssetDriveFiles(rows: MvDriveFile[]): MvDriveFile[] {
  return [...rows].sort((a, b) => {
    const pa = String(a.relativePath || a.name).replace(/\\/g, "/");
    const pb = String(b.relativePath || b.name).replace(/\\/g, "/");
    const pathCmp = pa.localeCompare(pb, "ar", { sensitivity: "base", numeric: true });
    if (pathCmp !== 0) return pathCmp;
    return (a.uploadedAt || "").localeCompare(b.uploadedAt || "");
  });
}

function mergeUploadedIntoDriveFileList(previous: MvDriveFile[], uploaded: MvDriveFile[]): MvDriveFile[] {
  const seen = new Set(previous.map((f) => f._id));
  const next = [...previous];
  for (const f of uploaded) {
    if (!seen.has(f._id)) {
      seen.add(f._id);
      next.push(f);
    }
  }
  return sortUploadedAssetDriveFiles(next);
}

/** عُرف مؤقت في الواجهة فقط — يعرض المعاينة فورًا قبل أن يعيد الخادم المعرف الدائم */
const LOCAL_PREVIEW_ID_PREFIX = "sv-local:";

/** سلسلة نقالة لسحب صورة من الشبكة أو الشجرة إلى مسار آخر (ليس لتضمين MIME للملفات) */
const MV_ASSET_IMAGE_DRAG_KEY = "application/x-sv-mv-asset-image-id";

function isLocalPreviewDriveId(id: string): boolean {
  return id.startsWith(LOCAL_PREVIEW_ID_PREFIX);
}

function driveFileNormPathKey(file: MvDriveFile): string {
  return normalizeRelativePath(file.relativePath || file.name, file.name);
}

/** يستبدل صف المعاينة المحلي بما أنجزه الخادم لنفس المسار النسبي */
function replaceLocalPreviewRowsWithServer(
  previous: MvDriveFile[],
  serverRows: MvDriveFile[],
  localPreviewIdsFromSession: readonly string[],
): MvDriveFile[] {
  const localSet = new Set(localPreviewIdsFromSession);
  const queueByPath = new Map<string, MvDriveFile[]>();
  for (const row of serverRows) {
    const k = driveFileNormPathKey(row);
    const bucket = queueByPath.get(k) ?? [];
    bucket.push(row);
    queueByPath.set(k, bucket);
  }

  const out: MvDriveFile[] = [];

  for (const f of previous) {
    if (!localSet.has(f._id)) {
      out.push(f);
      continue;
    }

    const k = driveFileNormPathKey(f);
    const bucket = queueByPath.get(k);
    if (!bucket || bucket.length === 0) {
      continue;
    }
    out.push(bucket.shift()!);
    if (bucket.length === 0) queueByPath.delete(k);
    else queueByPath.set(k, bucket);
  }

  for (const remaining of queueByPath.values()) {
    out.push(...remaining);
  }
  return sortUploadedAssetDriveFiles(out);
}

/** عند تحديث القائمة أثناء وجود معاينات محليّة؛ يفضل الصف القادم من الخادم لنفس المسار النسبي */
function mergeServerListWithStillPendingLocals(server: MvDriveFile[], locals: MvDriveFile[]): MvDriveFile[] {
  const byPath = new Map<string, MvDriveFile>();
  for (const f of locals) {
    byPath.set(driveFileNormPathKey(f), f);
  }
  for (const f of server) {
    byPath.set(driveFileNormPathKey(f), f);
  }
  return sortUploadedAssetDriveFiles([...byPath.values()]);
}

const ASSET_UPLOAD_FILES_PER_REQUEST = 96;
/** طلبات رفع متوازية للحمل الثقيل مع الحفاظ على حدّ معقول للتوازي */
const ASSET_UPLOAD_PARALLEL_REQUESTS = 6;

/** دفعات عرض المعاينات المحليّة في الواجهة حتى لا يتجمّد الخيط وقت إنشاء blob: عند مجلدات ضخمة */
const PREVIEW_UI_CHUNK_SIZE = 28;

function chunkPickedImages<T extends { file: File }>(items: readonly T[], chunkSize: number): T[][] {
  if (items.length === 0) return [];
  const size = Math.max(8, chunkSize);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function previewFolderBasePath(folderDisplayName: string): string {
  return folderPathFromRelativePath(
    normalizeRelativePath(`${folderDisplayName}/placeholder.jpg`, "placeholder.jpg"),
  );
}

function assetImportSessionStorageKey(projectId: string) {
  return `sv:asset-import:${projectId}`;
}

function readAssetImportFromSession(projectId: string): AssetImportResult | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(assetImportSessionStorageKey(projectId));
    if (!raw?.trim()) return null;
    const parsed = JSON.parse(raw) as AssetImportResult;
    if (!parsed || parsed.success !== true || parsed.projectId !== projectId) return null;
    return normalizeImportResult(parsed);
  } catch {
    return null;
  }
}

async function postAssetImagesFormData(projectId: string, batch: PickedImageFile[]): Promise<MvDriveFile[]> {
  const formData = new FormData();
  for (const item of batch) {
    formData.append("paths", normalizeRelativePath(item.relativePath, item.file.name));
    formData.append("files", item.file, item.file.name);
  }
  const response = await fetch(`/api/mv/projects/${projectId}/asset-image-files`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!response.ok) {
    let message = "تعذر رفع الصور.";
    try {
      const data = (await response.json()) as { message?: unknown };
      if (typeof data.message === "string" && data.message.trim()) {
        message = data.message.trim();
      }
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const raw = (await response.json()) as unknown;
  return Array.isArray(raw) ? (raw as MvDriveFile[]) : [];
}

async function postAssetImagesFormDataToPicFolder(
  projectId: string,
  picAssetFolderId: string,
  folderDisplayName: string,
  batch: PickedImageFile[],
): Promise<MvDriveFile[]> {
  const formData = new FormData();
  for (const item of batch) {
    const inner = item.relativePath.replace(/^\/+/, "");
    const rel = normalizeRelativePath(
      inner ? `${folderDisplayName}/${inner}` : `${folderDisplayName}/${item.file.name}`,
      item.file.name,
    );
    formData.append("paths", rel);
    formData.append("files", item.file, item.file.name);
  }
  const url = `/api/mv/projects/${encodeURIComponent(projectId)}/asset-image-files?picAssetFolderId=${encodeURIComponent(picAssetFolderId)}`;
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!response.ok) {
    let message = "تعذر رفع الصور.";
    try {
      const data = (await response.json()) as { message?: unknown };
      if (typeof data.message === "string" && data.message.trim()) {
        message = data.message.trim();
      }
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const raw = (await response.json()) as unknown;
  return Array.isArray(raw) ? (raw as MvDriveFile[]) : [];
}

async function uploadPickedImagesToPicFolderServer(
  projectId: string,
  picAssetFolderId: string,
  folderDisplayName: string,
  imageFiles: PickedImageFile[],
): Promise<MvDriveFile[]> {
  const batches = chunkPickedImages(imageFiles, ASSET_UPLOAD_FILES_PER_REQUEST);
  if (batches.length === 1) {
    return postAssetImagesFormDataToPicFolder(projectId, picAssetFolderId, folderDisplayName, batches[0]!);
  }

  const slots = Math.min(ASSET_UPLOAD_PARALLEL_REQUESTS, batches.length);
  const grouped: MvDriveFile[][] = new Array(batches.length);
  let nextBatch = 0;

  async function worker() {
    while (nextBatch < batches.length) {
      const i = nextBatch++;
      grouped[i] = await postAssetImagesFormDataToPicFolder(
        projectId,
        picAssetFolderId,
        folderDisplayName,
        batches[i]!,
      );
    }
  }

  await Promise.all(Array.from({ length: slots }, () => worker()));
  return grouped.flat();
}

async function uploadPickedImagesToServer(projectId: string, imageFiles: PickedImageFile[]): Promise<MvDriveFile[]> {
  const batches = chunkPickedImages(imageFiles, ASSET_UPLOAD_FILES_PER_REQUEST);
  if (batches.length === 1) {
    return postAssetImagesFormData(projectId, batches[0]!);
  }

  const slots = Math.min(ASSET_UPLOAD_PARALLEL_REQUESTS, batches.length);
  const grouped: MvDriveFile[][] = new Array(batches.length);
  let nextBatch = 0;

  async function worker() {
    while (nextBatch < batches.length) {
      const i = nextBatch++;
      grouped[i] = await postAssetImagesFormData(projectId, batches[i]!);
    }
  }

  await Promise.all(Array.from({ length: slots }, () => worker()));
  return grouped.flat();
}

function readFileEntry(entry: WebkitFileEntry) {
  return new Promise<File>((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

function readDirectoryEntries(entry: WebkitDirectoryEntry) {
  const reader = entry.createReader();
  const all: WebkitEntry[] = [];

  return new Promise<WebkitEntry[]>((resolve, reject) => {
    const read = () => {
      reader.readEntries(
        (batch) => {
          if (batch.length === 0) {
            resolve(all);
            return;
          }
          all.push(...batch);
          read();
        },
        reject,
      );
    };
    read();
  });
}

async function collectImagesFromEntry(
  entry: WebkitEntry,
  parentPath = "",
): Promise<PickedImageFile[]> {
  const entryName = cleanPathPart(entry.name);
  const entryPath = parentPath && entryName ? `${parentPath}/${entryName}` : entryName;

  if (entry.isFile) {
    const file = await readFileEntry(entry as WebkitFileEntry);
    if (!isLikelyImage(file)) return [];
    return [
      {
        file,
        relativePath: normalizeRelativePath(parentPath ? `${parentPath}/${file.name}` : file.name, file.name),
      },
    ];
  }

  if (!entry.isDirectory) return [];
  const children = await readDirectoryEntries(entry as WebkitDirectoryEntry);
  const nested = await Promise.all(children.map((child) => collectImagesFromEntry(child, entryPath)));
  return nested.flat();
}

async function collectDroppedImages(dataTransfer: DataTransfer) {
  const items = Array.from(dataTransfer.items ?? []);
  const picked: PickedImageFile[] = [];

  for (const item of items) {
    const entry = (
      item as DataTransferItem & {
        webkitGetAsEntry?: () => WebkitEntry | null;
      }
    ).webkitGetAsEntry?.();
    if (entry) {
      picked.push(...(await collectImagesFromEntry(entry)));
    }
  }

  if (picked.length > 0) return picked;

  return Array.from(dataTransfer.files ?? [])
    .filter(isLikelyImage)
    .map((file) => ({ file, relativePath: normalizeRelativePath(file.name, file.name) }));
}

function selectedAncestors(path: string) {
  const parts = path.split("/").filter(Boolean);
  const out = [""];
  let cursor = "";
  for (const part of parts) {
    cursor = cursor ? `${cursor}/${part}` : part;
    out.push(cursor);
  }
  return out;
}

function collectFolderImages(node: ImageFolderNode): AssetImageViewFile[] {
  return [
    ...node.images,
    ...node.folders.flatMap((folder) => collectFolderImages(folder)),
  ];
}

function collectFolderVideos(node: ImageFolderNode): AssetImageViewFile[] {
  return [
    ...node.videos,
    ...node.folders.flatMap((folder) => collectFolderVideos(folder)),
  ];
}

function isReportImageIncluded(file: MvDriveFile): boolean {
  return file.includeInReport === true;
}

export default function MvAssetImagesHub({ projectId, projectName }: MvAssetImagesHubProps) {
  const { toast } = useToast();
  const filePickInputRef = useRef<HTMLInputElement>(null);
  const folderPickInputRef = useRef<HTMLInputElement>(null);
  /** blob: للمعاينة الفورية قبل اكتمال الرفع — يُحرَّر عند الاستبدال أو إلغاء التثبيت */
  const optimisticPreviewUrlsRef = useRef<Map<string, string>>(new Map());
  const [files, setFiles] = useState<MvDriveFile[]>(() => {
    if (typeof window === "undefined") return [];
    const c = readMvWorkflowSessionJson<{ rows: MvDriveFile[] }>(
      MV_WORKFLOW_SESSION.assetImageFiles(projectId),
    );
    return c?.rows && Array.isArray(c.rows) ? c.rows : [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    return readMvWorkflowSessionJson(MV_WORKFLOW_SESSION.assetImageFiles(projectId)) == null;
  });
  const [dragging, setDragging] = useState(false);
  const [selectedPath, setSelectedPath] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set([""]));
  const [reportData, setReportData] = useState<MvProjectReportData>({ includeAssetImages: true });
  const [includeAssetImagesInReport, setIncludeAssetImagesInReport] = useState(true);
  const [reportSelectionSaving, setReportSelectionSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lightboxFile, setLightboxFile] = useState<MvDriveFile | null>(null);
  const dragReorderFromIdx = useRef<number | null>(null);
  const [reorderSaving, setReorderSaving] = useState(false);
  const [assetImagesSource, setAssetImagesSource] = useState<AssetImagesSource>("app");
  const [appPreviewMediaTab, setAppPreviewMediaTab] = useState<AppPreviewMediaTab>("images");
  const [previewPhotoFolders, setPreviewPhotoFolders] = useState<
    { sub: MvSubProject; picAsset: PicAsset | null }[]
  >(() => {
    if (typeof window === "undefined") return [];
    const c = readMvWorkflowSessionJson<{
      entries: { sub: MvSubProject; picAsset: PicAsset | null }[];
    }>(MV_WORKFLOW_SESSION.previewPhotoFolders(projectId));
    return c?.entries && Array.isArray(c.entries) ? c.entries : [];
  });
  const [photosRootId, setPhotosRootId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const c = readMvWorkflowSessionJson<{ photosRootId: string | null }>(
      MV_WORKFLOW_SESSION.previewPhotoFolders(projectId),
    );
    return c?.photosRootId ?? null;
  });
  const [loadingPreviewFolders, setLoadingPreviewFolders] = useState(() => {
    if (typeof window === "undefined") return true;
    return readMvWorkflowSessionJson(MV_WORKFLOW_SESSION.previewPhotoFolders(projectId)) == null;
  });
  const [selectedPreviewFolderId, setSelectedPreviewFolderId] = useState<string | null>(null);
  const [expandedPreviewIds, setExpandedPreviewIds] = useState<Set<string>>(() => new Set(["__pv_root__"]));
  const [creatingPreviewFolder, setCreatingPreviewFolder] = useState(false);
  const [draggingPreview, setDraggingPreview] = useState(false);
  const [assetImportResult, setAssetImportResult] = useState<AssetImportResult | null>(null);
  const [assetImageFoldersModalOpen, setAssetImageFoldersModalOpen] = useState(false);
  const filesById = useMemo(() => new Map(files.map((f) => [f._id, f])), [files]);

  const loadImages = useCallback(async (mode: "full" | "revalidate" = "full") => {
    const cacheKey = MV_WORKFLOW_SESSION.assetImageFiles(projectId);
    const cached = readMvWorkflowSessionJson<{ rows: MvDriveFile[] }>(cacheKey);
    let blockListSpinner = false;
    if (mode === "full") {
      if (cached?.rows && Array.isArray(cached.rows)) {
        setFiles((prev) =>
          mergeServerListWithStillPendingLocals(cached.rows, prev.filter((f) => isLocalPreviewDriveId(f._id))),
        );
      } else {
        blockListSpinner = true;
        setLoading(true);
      }
    }
    try {
      const response = await fetch(`/api/mv/projects/${projectId}/asset-image-files`, {
        credentials: "include",
      });
      if (!response.ok) {
        if (mode === "full") setFiles((prev) => prev.filter((f) => !isLocalPreviewDriveId(f._id)));
        return;
      }
      const rows = (await response.json()) as MvDriveFile[];
      setFiles((prev) =>
        mergeServerListWithStillPendingLocals(rows, prev.filter((f) => isLocalPreviewDriveId(f._id))),
      );
      writeMvWorkflowSessionJson(cacheKey, { rows });
    } finally {
      if (blockListSpinner) setLoading(false);
    }
  }, [projectId]);

  const loadReportSettings = useCallback(async () => {
    try {
      const response = await fetch(`/api/mv/projects/${projectId}`, {
        credentials: "include",
      });
      if (!response.ok) return;
      const data = (await response.json()) as { project?: MvProject };
      const nextReportData = data.project?.reportData ?? {};
      setReportData({ ...nextReportData, includeAssetImages: nextReportData.includeAssetImages !== false });
      setIncludeAssetImagesInReport(nextReportData.includeAssetImages !== false);
    } catch {
      setReportData({ includeAssetImages: true });
      setIncludeAssetImagesInReport(true);
    }
  }, [projectId]);

  const loadPreviewPhotoFolders = useCallback(async (mode: "full" | "revalidate" = "full") => {
    const cacheKey = MV_WORKFLOW_SESSION.previewPhotoFolders(projectId);
    const cached = readMvWorkflowSessionJson<{
      photosRootId: string | null;
      entries: { sub: MvSubProject; picAsset: PicAsset | null }[];
    }>(cacheKey);
    let blockPreviewSpinner = false;
    if (mode === "full") {
      if (cached?.entries && Array.isArray(cached.entries)) {
        setPhotosRootId(cached.photosRootId ?? null);
        setPreviewPhotoFolders(cached.entries);
        setSelectedPreviewFolderId((prev) => {
          if (prev === "__pv_root__" || (prev && cached!.entries!.some((e) => e.sub._id === prev))) return prev;
          return "__pv_root__";
        });
        setExpandedPreviewIds((cur) => {
          const next = new Set(cur);
          next.add("__pv_root__");
          return next;
        });
      } else {
        blockPreviewSpinner = true;
        setLoadingPreviewFolders(true);
      }
    }
    try {
      const res = await fetch(`/api/mv/projects/${projectId}?picAssetMode=summary`, {
        credentials: "include",
      });
      if (!res.ok) {
        setPreviewPhotoFolders([]);
        setPhotosRootId(null);
        writeMvWorkflowSessionJson(cacheKey, { photosRootId: null, entries: [] });
        return;
      }
      const data = (await res.json()) as { subProjects?: MvSubProject[] };
      const subProjects = data.subProjects ?? [];
      const previewRoot = subProjects.find((s) => isRootSubProjectParent(s.parent) && isPhotosSubfolderName(s.name));
      if (!previewRoot) {
        setPhotosRootId(null);
        setPreviewPhotoFolders([]);
        setSelectedPreviewFolderId(null);
        writeMvWorkflowSessionJson(cacheKey, { photosRootId: null, entries: [] });
        return;
      }
      setPhotosRootId(previewRoot._id);
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
      const entries = (
        await mapWithConcurrency(children, 2, async (sub) => {
          const r = await fetchWithRetry(`/api/mv/projects/${projectId}/subprojects/${sub._id}`, {
            credentials: "include",
          });
          if (!r.ok) {
            return { sub, picAsset: sub.picAsset ?? null } as { sub: MvSubProject; picAsset: PicAsset | null };
          }
          const row = (await r.json()) as MvSubProject & { picAsset?: PicAsset | null };
          return { sub, picAsset: row.picAsset ?? null };
        })
      ).filter(Boolean);
      setPreviewPhotoFolders(entries);
      writeMvWorkflowSessionJson(cacheKey, { photosRootId: previewRoot._id, entries });
      setSelectedPreviewFolderId((prev) => {
        if (prev === "__pv_root__" || (prev && entries.some((e) => e.sub._id === prev))) return prev;
        return "__pv_root__";
      });
      setExpandedPreviewIds((cur) => {
        const next = new Set(cur);
        next.add("__pv_root__");
        return next;
      });
    } catch {
      if (mode === "full") {
        setPreviewPhotoFolders([]);
        setPhotosRootId(null);
      }
    } finally {
      if (blockPreviewSpinner) setLoadingPreviewFolders(false);
    }
  }, [projectId]);

  const applyAssetImportResult = useCallback((result: AssetImportResult | null) => {
    const normalized = result ? normalizeImportResult(result) : null;
    setAssetImportResult(normalized);
  }, []);

  const loadAssetImportSummary = useCallback(async () => {
    const sessionResult = readAssetImportFromSession(projectId);
    if (sessionResult) {
      applyAssetImportResult(sessionResult);
    }

    try {
      const response = await fetch(`/api/assets/imports?projectId=${encodeURIComponent(projectId)}`, {
        credentials: "include",
      });
      if (!response.ok) return;
      const persisted = normalizeImportResult((await response.json()) as AssetImportResult);
      const next = persisted.projectId === projectId && persisted.summary.sheets.length > 0 ? persisted : null;
      applyAssetImportResult(next);
      if (typeof window !== "undefined") {
        if (next) {
          window.sessionStorage.setItem(assetImportSessionStorageKey(projectId), JSON.stringify(next));
        } else {
          window.sessionStorage.removeItem(assetImportSessionStorageKey(projectId));
        }
      }
    } catch {
      // Keep the session result if the persistent import summary cannot be loaded.
    }
  }, [applyAssetImportResult, projectId]);

  const refreshAppPicFoldersFromServer = useCallback(async () => {
    if (typeof window !== "undefined") {
      clearMvWorkflowSessionKey(MV_WORKFLOW_SESSION.previewPhotoFolders(projectId));
    }
    await loadPreviewPhotoFolders("full");
  }, [loadPreviewPhotoFolders, projectId]);

  const refreshAssetImageSources = useCallback(async () => {
    await Promise.all([loadImages("revalidate"), loadPreviewPhotoFolders("revalidate")]);
  }, [loadImages, loadPreviewPhotoFolders]);

  useEffect(() => {
    void Promise.all([loadImages("full"), loadPreviewPhotoFolders("full")]);
    void loadReportSettings();
    void loadAssetImportSummary();
  }, [loadAssetImportSummary, loadImages, loadPreviewPhotoFolders, loadReportSettings]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void loadAssetImportSummary();
        void refreshAssetImageSources();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadAssetImportSummary, refreshAssetImageSources]);

  useEffect(() => {
    return () => {
      for (const u of optimisticPreviewUrlsRef.current.values()) {
        URL.revokeObjectURL(u);
      }
      optimisticPreviewUrlsRef.current.clear();
    };
  }, []);

  const revokeOptimisticUrls = useCallback((ids: Iterable<string>) => {
    for (const id of ids) {
      if (!isLocalPreviewDriveId(id)) continue;
      const u = optimisticPreviewUrlsRef.current.get(id);
      if (u) {
        URL.revokeObjectURL(u);
        optimisticPreviewUrlsRef.current.delete(id);
      }
    }
  }, []);

  const resolveThumbSrc = useCallback(
    (file: MvDriveFile) => {
      const viewFile = file as AssetImageViewFile;
      if (viewFile.sourceUrl) return viewFile.sourceUrl;
      if (isLocalPreviewDriveId(file._id)) {
        return optimisticPreviewUrlsRef.current.get(file._id) ?? "";
      }
      if (viewFile.downloadFileId) {
        return `/api/mv/projects/${projectId}/files/${viewFile.downloadFileId}/download`;
      }
      return downloadHref(projectId, file);
    },
    [projectId],
  );

  const awaitingInitialListFetch = loading && files.length === 0;

  const driveFilesForUploadTree = useMemo(() => files.filter((f) => !f.picAssetId), [files]);
  const { root, foldersByPath } = useMemo(
    () => buildImageTree(driveFilesForUploadTree),
    [driveFilesForUploadTree],
  );
  const selectedFolder = foldersByPath.get(selectedPath) ?? root;

  const { previewRoot: legacyPreviewRoot, previewFoldersById: legacyPreviewFoldersById } = useMemo(() => {
    const fb = new Map<string, ImageFolderNode>([["__pv_root__", createFolderNode("معاينة الصور", "__pv_root__")]]);
    const rootNode = fb.get("__pv_root__")!;
    for (const row of previewPhotoFolders) {
      const id = row.sub._id;
      const node = createFolderNode(row.sub.name, id);
      node.images = files
        .filter((f) => f.picAssetId === id)
        .slice()
        .sort((a, b) => {
          const oa = typeof a.displayOrder === "number" ? a.displayOrder : null;
          const ob = typeof b.displayOrder === "number" ? b.displayOrder : null;
          if (oa !== null && ob !== null && oa !== ob) return oa - ob;
          if (oa !== null && ob === null) return -1;
          if (oa === null && ob !== null) return 1;
          return fileNameFromPath(a.relativePath || a.name).localeCompare(
            fileNameFromPath(b.relativePath || b.name),
            "ar",
          );
        });
      node.imageCount = node.images.length;
      node.videoCount = 0;
      fb.set(id, node);
      rootNode.folders.push(node);
    }
    rootNode.folders.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    rootNode.imageCount = rootNode.folders.reduce((s, f) => s + f.imageCount, 0);
    rootNode.videoCount = rootNode.folders.reduce((s, f) => s + f.videoCount, 0);
    return { previewRoot: rootNode, previewFoldersById: fb };
  }, [previewPhotoFolders, files]);

  const { previewRoot, previewFoldersById } = useMemo(() => {
    const fb = new Map<string, ImageFolderNode>();
    const rootNode = createFolderNode("صور الأصول من التطبيق", "__pv_root__");
    rootNode.isSynthetic = true;
    fb.set(rootNode.path, rootNode);

    const rowsById = new Map(previewPhotoFolders.map((row) => [row.sub._id, row]));
    const actualNodes = new Map<string, ImageFolderNode>();

    const sortImages = (rows: AssetImageViewFile[]) =>
      rows.slice().sort((a, b) => {
        const oa = typeof a.displayOrder === "number" ? a.displayOrder : null;
        const ob = typeof b.displayOrder === "number" ? b.displayOrder : null;
        if (oa !== null && ob !== null && oa !== ob) return oa - ob;
        if (oa !== null && ob === null) return -1;
        if (oa === null && ob !== null) return 1;
        return fileNameFromPath(a.relativePath || a.name).localeCompare(
          fileNameFromPath(b.relativePath || b.name),
          "ar",
        );
      });

    for (const row of previewPhotoFolders) {
      const id = row.sub._id;
      const picAssetId = row.picAsset?._id ?? id;
      const node = createFolderNode(row.sub.name, id);
      node.picAssetId = picAssetId;
      node.importId = row.picAsset?.importId ?? null;
      node.sheetName = row.picAsset?.sheetName ?? null;
      /** نفس منطق «صور المعاينة»: كل ملف مرتبط بـ picAssetId يظهر في المجلد */
      const assetFileRowsAll = files.filter((f) => f.picAssetId === picAssetId || f.picAssetId === id);
      const assetImageRows = assetFileRowsAll.filter((f) => !isMvDriveFileVideo(f));
      const assetVideoRows = assetFileRowsAll.filter((f) => isMvDriveFileVideo(f));
      const assetFileIds = new Set(assetFileRowsAll.map((file) => file._id));
      const assetFileOrders = new Set(
        assetFileRowsAll
          .map((file) => file.displayOrder)
          .filter((order): order is number => typeof order === "number"),
      );

      const rawImages = row.picAsset?.images ?? [];
      const indexed = rawImages.map((image, originalIndex) => ({ image, originalIndex }));

      const mapDisplay = (
        entries: { image: PicAssetImage; originalIndex: number }[],
        isVideoEntry: boolean,
      ) =>
        entries
          .map(({ image, originalIndex }, mediaIndex) =>
            picAssetImageDisplayFile(
              projectId,
              picAssetId,
              row.sub._id,
              row.sub.name,
              image,
              mediaIndex,
              originalIndex,
              isVideoEntry,
            ),
          )
          .filter((file): file is AssetImageViewFile => {
            if (!file) return false;
            if (assetFileIds.has(file.downloadFileId ?? file._id)) return false;
            const u = file.sourceUrl?.trim();
            if (
              u &&
              assetFileRowsAll.some(
                (r) => typeof r.sourceUrl === "string" && r.sourceUrl.trim() === u,
              )
            ) {
              return false;
            }
            return typeof file.displayOrder !== "number" || !assetFileOrders.has(file.displayOrder);
          });

      const picStillRows = mapDisplay(
        indexed.filter(({ image }) => isExternalPicAssetStillImage(image)),
        false,
      );
      const picVideoRows = mapDisplay(
        indexed.filter(({ image }) => isExternalPicAssetVideo(image)),
        true,
      );

      node.images = sortImages([...assetImageRows, ...picStillRows]);
      // هذا التبويب مخصص للصور فقط: لا نُحمّل/نعرض فيديوهات.
      node.videos = [];
      node.imageCount = node.images.length;
      node.videoCount = 0;
      actualNodes.set(id, node);
      fb.set(id, node);
    }

    const sheetGroups = new Map<string, ImageFolderNode>();
    const sourceForRow = (row: { sub: MvSubProject; picAsset: PicAsset | null }) => {
      let cursor: typeof row | undefined = row;
      const seen = new Set<string>();
      while (cursor) {
        const importId = cursor.picAsset?.importId?.trim() || "";
        const sheetName = cursor.picAsset?.sheetName?.trim() || "";
        if (sheetName) return { importId, sheetName };
        const parentId = cursor.sub.parent ?? "";
        if (!parentId || seen.has(parentId)) return null;
        seen.add(parentId);
        cursor = rowsById.get(parentId);
      }
      return null;
    };

    const sheetGroupFor = (source: { importId: string; sheetName: string }) => {
      const key = `sheet:${source.importId || "unknown"}:${source.sheetName}`;
      let node = sheetGroups.get(key);
      if (!node) {
        node = createFolderNode(source.sheetName, key);
        node.isSynthetic = true;
        node.importId = source.importId || null;
        node.sheetName = source.sheetName;
        sheetGroups.set(key, node);
        fb.set(key, node);
        rootNode.folders.push(node);
      }
      return node;
    };

    for (const row of previewPhotoFolders) {
      const node = actualNodes.get(row.sub._id);
      if (!node) continue;
      const parentId = row.sub.parent ?? "";
      const parentNode = parentId ? actualNodes.get(parentId) : undefined;
      if (parentNode) {
        parentNode.folders.push(node);
        continue;
      }
      const source = sourceForRow(row);
      if (source) {
        sheetGroupFor(source).folders.push(node);
      } else {
        rootNode.folders.push(node);
      }
    }

    const sortAndCount = (node: ImageFolderNode) => {
      node.folders.sort((a, b) => {
        if (a.isSynthetic !== b.isSynthetic) return a.isSynthetic ? -1 : 1;
        return a.name.localeCompare(b.name, "ar");
      });
      for (const child of node.folders) {
        sortAndCount(child);
      }
      node.imageCount = node.images.length + node.folders.reduce((sum, folder) => sum + folder.imageCount, 0);
      node.videoCount = node.videos.length + node.folders.reduce((sum, folder) => sum + folder.videoCount, 0);
    };

    sortAndCount(rootNode);
    return { previewRoot: rootNode, previewFoldersById: fb };
  }, [files, previewPhotoFolders, projectId]);

  const selectedPreviewFolderNode = selectedPreviewFolderId
    ? (previewFoldersById.get(selectedPreviewFolderId) ?? null)
    : null;
  const selectedPreviewFolderPathForReorder = useMemo(() => {
    if (!selectedPreviewFolderNode) return "";
    if (!selectedPreviewFolderNode.picAssetId) return "";
    if (selectedPreviewFolderNode.images.length > 0) {
      return driveFileFolderPath(selectedPreviewFolderNode.images[0]!);
    }
    return previewFolderBasePath(selectedPreviewFolderNode.name);
  }, [selectedPreviewFolderNode]);

  const selectedFolderPath = selectedFolder.path;
  const reportSelectedFileIds = useMemo(
    () => new Set(files.filter(isReportImageIncluded).map((file) => file._id)),
    [files],
  );

  const selectedCount = reportSelectedFileIds.size;
  const selectedPreviewNodeFiles = useMemo(() => {
    if (!selectedPreviewFolderNode) return [];
    return collectFolderImages(selectedPreviewFolderNode);
  }, [selectedPreviewFolderNode, appPreviewMediaTab]);
  const selectedDeviceNodeFiles = useMemo(() => collectFolderImages(selectedFolder), [selectedFolder]);

  /** صور المجلد المختار بما فيها المجلدات الفرعية — تُعرض في الشبكة كما في شجرة المعاينة */
  const previewAppGridFiles = selectedPreviewNodeFiles;
  /** إعادة الترتيب بالسحب تبقى لمجلد أصل ورقي واحد فقط (بدون دمج صور من أبناء) */
  const previewGridCanReorder = Boolean(
    appPreviewMediaTab === "images" &&
      selectedPreviewFolderNode?.picAssetId &&
      selectedPreviewFolderNode.folders.length === 0 &&
      selectedPreviewFolderNode.images.length > 0 &&
      selectedPreviewFolderNode.images.length === previewAppGridFiles.length &&
      selectedPreviewFolderNode.images.every((file) => {
        if (!isDisplayOnlyPicAssetImage(file)) return true;
        const effective = effectiveDriveFileId(file);
        return Boolean(effective && filesById.has(effective));
      }),
  );
  const activeContentNode = assetImagesSource === "app" ? selectedPreviewFolderNode : selectedFolder;
  const activeContentFolders = activeContentNode?.folders ?? [];
  const activeContentFiles = assetImagesSource === "app" ? previewAppGridFiles : selectedDeviceNodeFiles;

  useEffect(() => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      selectedAncestors(selectedFolderPath).forEach((path) => next.add(path));
      return next;
    });
  }, [selectedFolderPath]);

  const uploadImages = useCallback(
    async (picked: PickedImageFile[]) => {
      const imageFiles = picked.filter((item) => isLikelyImage(item.file));
      if (imageFiles.length === 0) {
        toast({ variant: "destructive", description: "لم يتم العثور على صور صالحة للرفع." });
        return;
      }

      const sessionLocalIds = imageFiles.map(() => `${LOCAL_PREVIEW_ID_PREFIX}${crypto.randomUUID()}`);

      /** يملأ الواجهة دفعات بينها requestAnimationFrame لتفادي تجمّد الواجهة، ويعمل بالتوازي مع الطلب للخادم */
      const streamLocalPreviewsToUi = async () => {
        for (let i = 0; i < imageFiles.length; i += PREVIEW_UI_CHUNK_SIZE) {
          const slice = imageFiles.slice(i, i + PREVIEW_UI_CHUNK_SIZE);
          const idSlice = sessionLocalIds.slice(i, i + PREVIEW_UI_CHUNK_SIZE);
          const batch: MvDriveFile[] = slice.map((item, j) => {
            const id = idSlice[j]!;
            const relativePath = normalizeRelativePath(item.relativePath, item.file.name);
            optimisticPreviewUrlsRef.current.set(id, URL.createObjectURL(item.file));
            return {
              _id: id,
              projectId,
              name: fileNameFromPath(relativePath),
              scope: "asset-images" as const,
              relativePath,
              folderPath: folderPathFromRelativePath(relativePath),
              mimeType: item.file.type || "image/jpeg",
              sizeBytes: item.file.size,
              uploadedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              includeInReport: true,
            };
          });
          setFiles((prev) => mergeUploadedIntoDriveFileList(prev, batch));
          if (i + PREVIEW_UI_CHUNK_SIZE < imageFiles.length) {
            await new Promise<void>((resolve) => {
              requestAnimationFrame(() => resolve());
            });
          }
        }
      };

      const hasRootImages = imageFiles.some((item) => !normalizeRelativePath(item.relativePath).includes("/"));
      if (hasRootImages) setSelectedPath("");

      const persistToServer = uploadPickedImagesToServer(projectId, imageFiles);

      try {
        await streamLocalPreviewsToUi();
        const uploadedRows = await persistToServer;
        setFiles((prev) => replaceLocalPreviewRowsWithServer(prev, uploadedRows, sessionLocalIds));
        revokeOptimisticUrls(sessionLocalIds);
        toast({
          description: `تم حفظ ${numberFormatter.format(uploadedRows.length)} صورة في الخادم.`,
        });
        void loadImages("revalidate");
      } catch (error) {
        setFiles((prev) => prev.filter((f) => !sessionLocalIds.includes(f._id)));
        revokeOptimisticUrls(sessionLocalIds);
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "تعذر رفع الصور.",
        });
      } finally {
        if (filePickInputRef.current) filePickInputRef.current.value = "";
        if (folderPickInputRef.current) folderPickInputRef.current.value = "";
      }
    },
    [loadImages, projectId, revokeOptimisticUrls, toast],
  );

  const handleInputFiles = useCallback(
    (fileList: FileList | null) => {
      const picked = Array.from(fileList ?? [])
        .filter(isLikelyImage)
        .map((file) => ({
          file,
          relativePath: normalizeRelativePath(
            (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
            file.name,
          ),
        }));
      void uploadImages(picked);
    },
    [uploadImages],
  );

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      const picked = await collectDroppedImages(event.dataTransfer);
      void uploadImages(picked);
    },
    [uploadImages],
  );

  const uploadImagesToPicFolder = useCallback(
    async (picFolderId: string, folderDisplayName: string, picked: PickedImageFile[]) => {
      const imageFiles = picked.filter((item) => isLikelyImage(item.file));
      if (imageFiles.length === 0) {
        toast({ variant: "destructive", description: "لم يتم العثور على صور صالحة للرفع." });
        return;
      }

      const sessionLocalIds = imageFiles.map(() => `${LOCAL_PREVIEW_ID_PREFIX}${crypto.randomUUID()}`);

      const streamLocalPreviewsToUi = async () => {
        for (let i = 0; i < imageFiles.length; i += PREVIEW_UI_CHUNK_SIZE) {
          const slice = imageFiles.slice(i, i + PREVIEW_UI_CHUNK_SIZE);
          const idSlice = sessionLocalIds.slice(i, i + PREVIEW_UI_CHUNK_SIZE);
          const batch: MvDriveFile[] = slice.map((item, j) => {
            const id = idSlice[j]!;
            const inner = item.relativePath.replace(/^\/+/, "");
            const relativePath = normalizeRelativePath(
              inner ? `${folderDisplayName}/${inner}` : `${folderDisplayName}/${item.file.name}`,
              item.file.name,
            );
            optimisticPreviewUrlsRef.current.set(id, URL.createObjectURL(item.file));
            return {
              _id: id,
              projectId,
              name: fileNameFromPath(relativePath),
              scope: "asset-images" as const,
              picAssetId: picFolderId,
              relativePath,
              folderPath: folderPathFromRelativePath(relativePath),
              mimeType: item.file.type || "image/jpeg",
              sizeBytes: item.file.size,
              uploadedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              includeInReport: true,
            };
          });
          setFiles((prev) => mergeUploadedIntoDriveFileList(prev, batch));
          if (i + PREVIEW_UI_CHUNK_SIZE < imageFiles.length) {
            await new Promise<void>((resolve) => {
              requestAnimationFrame(() => resolve());
            });
          }
        }
      };

      const persistToServer = uploadPickedImagesToPicFolderServer(
        projectId,
        picFolderId,
        folderDisplayName,
        imageFiles,
      );

      try {
        await streamLocalPreviewsToUi();
        const uploadedRows = await persistToServer;
        setFiles((prev) => replaceLocalPreviewRowsWithServer(prev, uploadedRows, sessionLocalIds));
        revokeOptimisticUrls(sessionLocalIds);
        toast({
          description: `تم حفظ ${numberFormatter.format(uploadedRows.length)} صورة في المجلد.`,
        });
        await loadPreviewPhotoFolders("revalidate");
      } catch (error) {
        setFiles((prev) => prev.filter((f) => !sessionLocalIds.includes(f._id)));
        revokeOptimisticUrls(sessionLocalIds);
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "تعذر رفع الصور.",
        });
      }
    },
    [loadPreviewPhotoFolders, projectId, revokeOptimisticUrls, toast],
  );

  const handleActiveTargetInputFiles = useCallback(
    (fileList: FileList | null) => {
      const picked = Array.from(fileList ?? [])
        .filter(isLikelyImage)
        .map((file) => ({
          file,
          relativePath: normalizeRelativePath(
            (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
            file.name,
          ),
        }));
      if (
        assetImagesSource === "app" &&
        appPreviewMediaTab === "images" &&
        selectedPreviewFolderNode?.picAssetId &&
        selectedPreviewFolderNode.name
      ) {
        void uploadImagesToPicFolder(
          selectedPreviewFolderNode.picAssetId,
          selectedPreviewFolderNode.name,
          picked,
        );
        return;
      }
      void uploadImages(picked);
    },
    [appPreviewMediaTab, assetImagesSource, selectedPreviewFolderNode, uploadImages, uploadImagesToPicFolder],
  );

  const createPreviewFolder = useCallback(async (parentId?: string | null) => {
    const targetParentId = parentId?.trim() || photosRootId;
    if (!targetParentId) {
      toast({
        variant: "destructive",
        description: "لم يُعثر على مجلد «صور المعاينة» في المشروع.",
      });
      return;
    }
    const defaultName = "مجلد جديد";
    const name = window.prompt("اسم المجلد الجديد", defaultName)?.trim();
    if (!name) return;
    try {
      setCreatingPreviewFolder(true);
      const response = await fetch(`/api/mv/projects/${projectId}/subprojects`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parent: targetParentId }),
      });
      if (!response.ok) throw new Error("fail");
      const created = (await response.json()) as { _id: string };
      await Promise.all([loadPreviewPhotoFolders("revalidate"), loadImages("revalidate")]);
      setSelectedPreviewFolderId(created._id);
      toast({ description: "تم إنشاء المجلد." });
    } catch {
      toast({ variant: "destructive", description: "تعذر إنشاء المجلد." });
    } finally {
      setCreatingPreviewFolder(false);
    }
  }, [loadImages, loadPreviewPhotoFolders, photosRootId, projectId, toast]);

  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const selectFolder = useCallback((path: string) => {
    setAssetImagesSource("device");
    setSelectedPath(path);
    setExpandedPaths((current) => {
      const next = new Set(current);
      selectedAncestors(path).forEach((ancestor) => next.add(ancestor));
      next.add(path);
      return next;
    });
  }, []);

  const updateReportSelection = useCallback(
    async (fileIdsInput: Iterable<string>, includeInReport: boolean) => {
      const fileIds = Array.from(new Set(fileIdsInput));
      if (fileIds.length === 0) return;

      const remoteIds = fileIds.filter((id) => !isLocalPreviewDriveId(id));
      const previousFiles = files;
      setFiles((current) =>
        current.map((file) =>
          fileIds.includes(file._id)
            ? { ...file, includeInReport, updatedAt: new Date().toISOString() }
            : file,
        ),
      );

      if (remoteIds.length === 0) return;

      try {
        setReportSelectionSaving(true);
        const response = await fetch(
          `/api/mv/projects/${projectId}/asset-image-files/report-selection`,
          {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileIds: remoteIds, includeInReport }),
          },
        );
        if (!response.ok) {
          let message = "تعذر حفظ اختيار الصور للتقرير.";
          try {
            const data = (await response.json()) as { message?: unknown };
            if (typeof data.message === "string" && data.message.trim()) {
              message = data.message.trim();
            }
          } catch {
            /* ignore */
          }
          throw new Error(message);
        }
        const rows = (await response.json()) as MvDriveFile[];
        setFiles((prev) =>
          mergeServerListWithStillPendingLocals(
            rows,
            prev.filter((file) => isLocalPreviewDriveId(file._id)),
          ),
        );
      } catch (error) {
        setFiles(previousFiles);
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "تعذر حفظ اختيار الصور للتقرير.",
        });
      } finally {
        setReportSelectionSaving(false);
      }
    },
    [files, projectId, toast],
  );

  const toggleImageSelection = useCallback(
    (fileId: string) => {
      const file = files.find((row) => row._id === fileId);
      if (!file) return;
      void updateReportSelection([fileId], !isReportImageIncluded(file));
    },
    [files, updateReportSelection],
  );

  const togglePicAssetImageSelection = useCallback(
    async (viewFile: AssetImageViewFile) => {
      const subProjectId = viewFile.picAssetSubProjectId?.trim() || "";
      const idx = typeof viewFile.picAssetImageIndex === "number" ? viewFile.picAssetImageIndex : -1;
      if (!subProjectId || idx < 0) return;

      const entry = previewPhotoFolders.find((row) => row.sub._id === subProjectId);
      const asset = entry?.picAsset;
      if (!asset) return;
      const current = (asset.images ?? []).slice();
      const target = current[idx];
      if (!target || !("url" in target) || typeof (target as { url?: unknown }).url !== "string") return;

      const existing = (target as { includeInReport?: boolean }).includeInReport;
      const nextInclude = typeof existing === "boolean" ? !existing : false;
      const nextImages = current.map((im, i) => (i === idx ? { ...(im as object), includeInReport: nextInclude } : im));

      try {
        const updated = await patchMvSubprojectPicAsset(projectId, subProjectId, {
          images: mvPicAssetImagesToPatchPayload(nextImages as PicAssetImage[]),
        });
        setPreviewPhotoFolders((prev) =>
          prev.map((r) => (r.sub._id === subProjectId ? { ...r, picAsset: updated } : r)),
        );
      } catch (e) {
        toast({
          variant: "destructive",
          description: e instanceof Error ? e.message : "تعذر تحديث اختيار الصورة للتقرير.",
        });
      }
    },
    [previewPhotoFolders, projectId, toast],
  );

  const deletePicAssetImage = useCallback(
    async (viewFile: AssetImageViewFile) => {
      const subProjectId = viewFile.picAssetSubProjectId?.trim() || "";
      const idx = typeof viewFile.picAssetImageIndex === "number" ? viewFile.picAssetImageIndex : -1;
      if (!subProjectId || idx < 0) return;

      const entry = previewPhotoFolders.find((row) => row.sub._id === subProjectId);
      const asset = entry?.picAsset;
      if (!asset) return;

      const current = (asset.images ?? []).slice();
      const target = current[idx];
      if (!target) return;
      if (!window.confirm("حذف هذه الصورة من الأصل؟")) return;

      const nextImages = current.filter((_, i) => i !== idx);
      try {
        const updated = await patchMvSubprojectPicAsset(projectId, subProjectId, {
          images: mvPicAssetImagesToPatchPayload(nextImages as PicAssetImage[]),
        });
        setPreviewPhotoFolders((prev) =>
          prev.map((r) => (r.sub._id === subProjectId ? { ...r, picAsset: updated } : r)),
        );
      } catch (e) {
        toast({
          variant: "destructive",
          description: e instanceof Error ? e.message : "تعذر حذف الصورة.",
        });
      }
    },
    [previewPhotoFolders, projectId, toast],
  );

  const toggleFolderSelection = useCallback(
    (path: string) => {
      const folder = foldersByPath.get(path);
      if (!folder) return;
      const folderFiles = collectFolderImages(folder);
      const fileIds = selectableReportFileIds(folderFiles);
      if (fileIds.length === 0) return;
      const selectableFiles = folderFiles.filter((file) => fileIds.includes(file._id));
      const shouldInclude = !selectableFiles.every(isReportImageIncluded);
      void updateReportSelection(fileIds, shouldInclude);
    },
    [foldersByPath, updateReportSelection],
  );

  const updateAssetImagesReportEnabled = useCallback(
    async (checked: boolean) => {
      const previousReportData = reportData;
      const nextReportData: MvProjectReportData = {
        ...reportData,
        includeAssetImages: checked,
      };
      const remoteIds = files.map((f) => f._id).filter((id) => !isLocalPreviewDriveId(id));

      try {
        setReportSelectionSaving(true);
        const response = await fetch(`/api/mv/projects/${projectId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportData: nextReportData }),
        });
        if (!response.ok) {
          throw new Error("save_failed");
        }
        const updated = (await response.json()) as MvProject;
        const savedReportData = updated.reportData ?? nextReportData;
        const includeMaster = savedReportData.includeAssetImages !== false;

        if (remoteIds.length > 0) {
          const selResponse = await fetch(
            `/api/mv/projects/${projectId}/asset-image-files/report-selection`,
            {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileIds: remoteIds, includeInReport: checked }),
            },
          );
          if (!selResponse.ok) {
            let message = "تعذر تحديث تضمين كل الصور في التقرير.";
            try {
              const data = (await selResponse.json()) as { message?: unknown };
              if (typeof data.message === "string" && data.message.trim()) {
                message = data.message.trim();
              }
            } catch {
              /* ignore */
            }
            throw new Error(message);
          }
          const rows = (await selResponse.json()) as MvDriveFile[];
          setFiles((prev) =>
            mergeServerListWithStillPendingLocals(
              rows,
              prev
                .filter((file) => isLocalPreviewDriveId(file._id))
                .map((file) => ({
                  ...file,
                  includeInReport: checked,
                  updatedAt: new Date().toISOString(),
                })),
            ),
          );
        } else {
          setFiles((prev) =>
            prev.map((file) => ({
              ...file,
              includeInReport: checked,
              updatedAt: new Date().toISOString(),
            })),
          );
        }

        setReportData({
          ...savedReportData,
          includeAssetImages: includeMaster,
        });
        setIncludeAssetImagesInReport(includeMaster);
      } catch (error) {
        try {
          await fetch(`/api/mv/projects/${projectId}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reportData: previousReportData }),
          });
        } catch {
          /* إرجاع إعداد المشروع على الخادم عند فشل تحديث الصور — أفضل جهد */
        }
        toast({
          variant: "destructive",
          description:
            error instanceof Error && error.message !== "save_failed"
              ? error.message
              : "تعذر حفظ إعداد عرض الصور في التقرير.",
        });
      } finally {
        setReportSelectionSaving(false);
      }
    },
    [files, projectId, reportData, toast],
  );

  const deleteFileIds = useCallback(
    async (fileIds: Iterable<string>, successMessage: string) => {
      const ids = Array.from(new Set(fileIds));
      if (ids.length === 0) {
        toast({ variant: "destructive", description: "لا توجد صور محددة للحذف." });
        return;
      }
      if (!window.confirm(`حذف ${numberFormatter.format(ids.length)} صورة؟`)) return;

      const localIds = ids.filter(isLocalPreviewDriveId);
      const remoteIds = ids.filter((id) => !isLocalPreviewDriveId(id));

      try {
        setDeleting(true);
        if (localIds.length > 0) {
          revokeOptimisticUrls(localIds);
          setFiles((prev) => prev.filter((f) => !localIds.includes(f._id)));
          setLightboxFile((cur) => (cur && localIds.includes(cur._id) ? null : cur));
        }

        if (remoteIds.length > 0) {
          for (const id of remoteIds) {
            const response = await fetch(`/api/mv/projects/${projectId}/files/${id}`, {
              method: "DELETE",
              credentials: "include",
            });
            if (!response.ok) throw new Error("delete_failed");
          }
          setLightboxFile(null);
          await loadImages("revalidate");
        }

        toast({ description: successMessage });
      } catch {
        toast({ variant: "destructive", description: "تعذر حذف الصور المحددة." });
      } finally {
        setDeleting(false);
      }
    },
    [loadImages, projectId, revokeOptimisticUrls, toast],
  );

  const deleteSingleImage = useCallback(
    (file: MvDriveFile) => {
      if (isDisplayOnlyPicAssetImage(file)) return;
      void deleteFileIds([file._id], "تم حذف الصورة.");
    },
    [deleteFileIds],
  );

  const deleteFolderImages = useCallback(
    (folder: ImageFolderNode) => {
      const fileIds = collectFolderImages(folder)
        .filter((file) => !isDisplayOnlyPicAssetImage(file))
        .map((file) => file._id);
      if (fileIds.length === 0) {
        toast({ variant: "destructive", description: "لا توجد صور قابلة للحذف في هذا المجلد." });
        return;
      }
      void deleteFileIds(
        fileIds,
        "تم حذف صور المجلد.",
      );
    },
    [deleteFileIds, toast],
  );

  const deleteSelectedItems = useCallback(() => {
    void deleteFileIds(reportSelectedFileIds, "تم حذف الصور المحددة للتقرير.");
  }, [deleteFileIds, reportSelectedFileIds]);

  const deleteCurrentPathImages = useCallback(() => {
    const fileIds = collectFolderImages(selectedFolder)
      .filter((file) => !isDisplayOnlyPicAssetImage(file))
      .map((file) => file._id);
    void deleteFileIds(
      fileIds,
      "تم حذف صور المسار الحالي.",
    );
  }, [deleteFileIds, selectedFolder]);

  const openImage = useCallback((file: MvDriveFile) => {
    setSelectedPath(folderPathFromRelativePath(file.relativePath || file.name));
    setLightboxFile(file);
  }, []);

  const reorderFolderImagesByDrag = useCallback(
    async (fromIdx: number, toIdx: number) => {
      const list = selectedFolder.images;
      if (fromIdx < 0 || fromIdx >= list.length || toIdx < 0 || toIdx >= list.length) return;
      if (list.some((f) => isLocalPreviewDriveId(f._id))) {
        toast({
          variant: "destructive",
          description: "انتظر انتهاء الرفع أو ألغِ المعاينات قبل تغيير الترتيب.",
        });
        return;
      }
      const next = [...list];
      const [removed] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, removed!);
      const orderedFileIds = next.map((f) => f._id);
      const positions = Object.fromEntries(orderedFileIds.map((id, i) => [id, i]));
      setFiles((prev) =>
        prev.map((f) => {
          const p = positions[f._id];
          if (typeof p !== "number") return f;
          if (driveFileFolderPath(f) !== selectedFolderPath) return f;
          if (f.picAssetId) return f;
          return { ...f, displayOrder: p };
        }),
      );
      setReorderSaving(true);
      try {
        const response = await fetch(`/api/mv/projects/${projectId}/asset-image-files/reorder`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folderPath: selectedFolderPath,
            orderedFileIds,
          }),
        });
        if (!response.ok) {
          let message = "تعذر حفظ الترتيب.";
          try {
            const data = (await response.json()) as { message?: unknown };
            if (typeof data.message === "string" && data.message.trim()) {
              message = data.message.trim();
            }
          } catch {
            /* ignore */
          }
          throw new Error(message);
        }
        const rows = (await response.json()) as MvDriveFile[];
        setFiles((prev) =>
          mergeServerListWithStillPendingLocals(
            rows,
            prev.filter((f) => isLocalPreviewDriveId(f._id)),
          ),
        );
      } catch (e) {
        toast({
          variant: "destructive",
          description: e instanceof Error ? e.message : "تعذر حفظ الترتيب.",
        });
        void loadImages("revalidate");
      } finally {
        setReorderSaving(false);
      }
    },
    [loadImages, projectId, selectedFolder.images, selectedFolderPath, toast],
  );

  const onDragStartImageReorder = useCallback((idx: number) => {
    dragReorderFromIdx.current = idx;
  }, []);

  const onDropImageReorder = useCallback(
    (toIdx: number) => {
      const from = dragReorderFromIdx.current;
      dragReorderFromIdx.current = null;
      if (from == null || from === toIdx) return;
      void reorderFolderImagesByDrag(from, toIdx);
    },
    [reorderFolderImagesByDrag],
  );

  const reorderPreviewFolderImagesByDrag = useCallback(
    async (fromIdx: number, toIdx: number) => {
      const list = selectedPreviewFolderNode?.images ?? [];
      const fp = selectedPreviewFolderPathForReorder;
      const picAssetFolderId = selectedPreviewFolderNode?.picAssetId;
      if (!fp || !picAssetFolderId || list.length === 0) return;
      if (fromIdx < 0 || fromIdx >= list.length || toIdx < 0 || toIdx >= list.length) return;
      if (list.some((f) => isLocalPreviewDriveId(f._id))) {
        toast({
          variant: "destructive",
          description: "انتظر انتهاء الرفع أو ألغِ المعاينات قبل تغيير الترتيب.",
        });
        return;
      }
      const next = [...list];
      const [removed] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, removed!);
      const orderedFileIds = next
        .map((f) => (isDisplayOnlyPicAssetImage(f) ? effectiveDriveFileId(f) : f._id))
        .filter((id): id is string => Boolean(id && id.trim()));
      if (orderedFileIds.length !== next.length) {
        toast({
          variant: "destructive",
          description: "بعض صور التطبيق لا تملك ملفًا فعليًا لإعادة ترتيبها. ارفعها للنظام أولًا.",
        });
        return;
      }
      const positions = Object.fromEntries(orderedFileIds.map((id, i) => [id, i]));
      setFiles((prev) =>
        prev.map((f) => {
          const p = positions[f._id];
          if (typeof p !== "number") return f;
          if (driveFileFolderPath(f) !== fp) return f;
          if (f.picAssetId !== picAssetFolderId) return f;
          return { ...f, displayOrder: p };
        }),
      );
      setReorderSaving(true);
      try {
        const response = await fetch(`/api/mv/projects/${projectId}/asset-image-files/reorder`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            folderPath: fp,
            orderedFileIds,
            picAssetFolderId,
          }),
        });
        if (!response.ok) {
          let message = "تعذر حفظ الترتيب.";
          try {
            const data = (await response.json()) as { message?: unknown };
            if (typeof data.message === "string" && data.message.trim()) {
              message = data.message.trim();
            }
          } catch {
            /* ignore */
          }
          throw new Error(message);
        }
        const rows = (await response.json()) as MvDriveFile[];
        setFiles((prev) =>
          mergeServerListWithStillPendingLocals(
            rows,
            prev.filter((f) => isLocalPreviewDriveId(f._id)),
          ),
        );
      } catch (e) {
        toast({
          variant: "destructive",
          description: e instanceof Error ? e.message : "تعذر حفظ الترتيب.",
        });
        void loadImages("revalidate");
      } finally {
        setReorderSaving(false);
      }
    },
    [loadImages, projectId, selectedPreviewFolderNode?.images, selectedPreviewFolderNode?.picAssetId, selectedPreviewFolderPathForReorder, toast],
  );

  const clearGridDragReorderIntent = useCallback(() => {
    dragReorderFromIdx.current = null;
  }, []);

  const togglePreviewExpanded = useCallback((id: string) => {
    setExpandedPreviewIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openPreviewImage = useCallback((file: MvDriveFile) => {
    setLightboxFile(file);
  }, []);

  const placeAssetImage = useCallback(
    async (
      fileId: string,
      targetFolderPath: string,
      insertBeforeFileId: string | null,
      targetPicAssetFolderId?: string | null,
    ) => {
      if (isLocalPreviewDriveId(fileId)) {
        toast({
          variant: "destructive",
          description: "انتظر انتهاء الرفع قبل نقل أو إعادة ترتيب الصور.",
        });
        return;
      }
      setReorderSaving(true);
      try {
        const payload: {
          fileId: string;
          targetFolderPath: string;
          insertBeforeFileId?: string;
          targetPicAssetFolderId?: string;
        } = {
          fileId,
          targetFolderPath,
        };
        if (insertBeforeFileId) payload.insertBeforeFileId = insertBeforeFileId;
        if (targetPicAssetFolderId) payload.targetPicAssetFolderId = targetPicAssetFolderId;

        const response = await fetch(`/api/mv/projects/${projectId}/asset-image-files/place`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          let message = "تعذر حفظ الموقع.";
          try {
            const data = (await response.json()) as { message?: unknown };
            if (typeof data.message === "string" && data.message.trim()) {
              message = data.message.trim();
            }
          } catch {
            /* ignore */
          }
          throw new Error(message);
        }

        const rows = (await response.json()) as MvDriveFile[];
        setFiles((prev) =>
          mergeServerListWithStillPendingLocals(
            rows,
            prev.filter((f) => isLocalPreviewDriveId(f._id)),
          ),
        );

      } catch (e) {
        toast({
          variant: "destructive",
          description: e instanceof Error ? e.message : "تعذر حفظ التغيير.",
        });
        void loadImages("revalidate");
      } finally {
        clearGridDragReorderIntent();
        setReorderSaving(false);
      }
    },
    [clearGridDragReorderIntent, loadImages, projectId, toast],
  );

  const onTreeDragOverAsset = useCallback((e: DragEvent) => {
    if (!Array.from(e.dataTransfer.types ?? []).includes(MV_ASSET_IMAGE_DRAG_KEY)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDropOnFolderPath = useCallback(
    (targetPath: string) => (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (reorderSaving || dragging) return;
      const fid = e.dataTransfer.getData(MV_ASSET_IMAGE_DRAG_KEY);
      if (!fid) return;
      void placeAssetImage(fid, targetPath, null);
    },
    [dragging, placeAssetImage, reorderSaving],
  );

  const handleDropBeforeTreeImage = useCallback(
    (anchor: MvDriveFile) => (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (reorderSaving || dragging) return;
      const fid = e.dataTransfer.getData(MV_ASSET_IMAGE_DRAG_KEY);
      if (!fid) return;
      const fp = folderPathFromRelativePath(anchor.relativePath || anchor.name);
      void placeAssetImage(fid, fp, anchor._id);
    },
    [dragging, placeAssetImage, reorderSaving],
  );

  const handleDropBeforePreviewTreeImage = useCallback(
    (anchor: AssetImageViewFile) => (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (reorderSaving || draggingPreview) return;
      const fid = e.dataTransfer.getData(MV_ASSET_IMAGE_DRAG_KEY);
      if (!fid) return;
      const fp = driveFileFolderPath(anchor);
      void placeAssetImage(fid, fp, anchor._id, anchor.picAssetId ?? undefined);
    },
    [draggingPreview, placeAssetImage, reorderSaving],
  );

  const handleDropOnPreviewFolderRow = useCallback(
    (folderId: string, folderDisplayName: string) => (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (reorderSaving || draggingPreview) return;
      const fid = e.dataTransfer.getData(MV_ASSET_IMAGE_DRAG_KEY);
      if (!fid) return;
      const destNode = previewFoldersById.get(folderId);
      if (!destNode?.picAssetId) return;
      const firstFile = destNode.images[0];
      const targetPath =
        destNode && firstFile ? driveFileFolderPath(firstFile) : previewFolderBasePath(folderDisplayName);
      void placeAssetImage(fid, targetPath, null, destNode.picAssetId);
    },
    [draggingPreview, placeAssetImage, previewFoldersById, reorderSaving],
  );

  const selectPreviewFolder = useCallback((folderId: string, media: AppPreviewMediaTab = "images") => {
    setAssetImagesSource("app");
    // الصور فقط
    setAppPreviewMediaTab("images");
    setSelectedPreviewFolderId(folderId);
    setExpandedPreviewIds((cur) => {
      const next = new Set(cur);
      next.add("__pv_root__");
      next.add(folderId);
      return next;
    });
  }, []);

  const togglePreviewFolderSelection = useCallback(
    (folderId: string) => {
      const node = previewFoldersById.get(folderId);
      const nodeFiles = node
        ? [...collectFolderImages(node)]
        : [];
      if (!node || nodeFiles.length === 0) return;
      const shouldInclude = !nodeFiles.every(isReportImageIncluded);

      const driveFileIds = nodeFiles
        .filter((f) => !isDisplayOnlyPicAssetImage(f))
        .map((f) => f._id);
      if (driveFileIds.length > 0) {
        void updateReportSelection(driveFileIds, shouldInclude);
      }

      const displayOnlyBySub = new Map<string, number[]>();
      nodeFiles.forEach((f) => {
        if (!isDisplayOnlyPicAssetImage(f)) return;
        const sid = f.picAssetSubProjectId?.trim() || "";
        const idx = typeof f.picAssetImageIndex === "number" ? f.picAssetImageIndex : -1;
        if (!sid || idx < 0) return;
        displayOnlyBySub.set(sid, [...(displayOnlyBySub.get(sid) ?? []), idx]);
      });

      if (displayOnlyBySub.size > 0) {
        (async () => {
          for (const [subProjectId, idxs] of displayOnlyBySub.entries()) {
            const entry = previewPhotoFolders.find((row) => row.sub._id === subProjectId);
            const asset = entry?.picAsset;
            if (!asset) continue;
            const current = (asset.images ?? []).slice();
            const nextImages = current.map((im, i) =>
              idxs.includes(i) ? { ...(im as object), includeInReport: shouldInclude } : im,
            );
            try {
              const updated = await patchMvSubprojectPicAsset(projectId, subProjectId, {
                images: mvPicAssetImagesToPatchPayload(nextImages as PicAssetImage[]),
              });
              setPreviewPhotoFolders((prev) =>
                prev.map((r) => (r.sub._id === subProjectId ? { ...r, picAsset: updated } : r)),
              );
            } catch (e) {
              toast({
                variant: "destructive",
                description: e instanceof Error ? e.message : "تعذر تحديث اختيار المجلد للتقرير.",
              });
            }
          }
        })();
      }
    },
    [previewFoldersById, previewPhotoFolders, projectId, toast, updateReportSelection],
  );

  const deleteCurrentPreviewPathImages = useCallback(() => {
    const nodeFiles = selectedPreviewFolderNode
      ? collectFolderImages(selectedPreviewFolderNode).filter((file) => !isDisplayOnlyPicAssetImage(file))
      : [];
    if (nodeFiles.length === 0) return;
    void deleteFileIds(
      nodeFiles.map((f) => f._id),
      "تم حذف صور مجلد المعاينة الحالي.",
    );
  }, [deleteFileIds, selectedPreviewFolderNode]);

  const renderTreeImage = (file: MvDriveFile, level = 0) => {
    const selected = isReportImageIncluded(file);
    const canDragPlace = !isLocalPreviewDriveId(file._id) && !reorderSaving;
    const displayOnly = false;
    const canMutate = true;

    return (
      <div
        key={file._id}
        draggable={canDragPlace}
        onDragStart={(e: DragEvent) => {
          if (!canDragPlace) {
            e.preventDefault();
            return;
          }
          dragReorderFromIdx.current = null;
          e.dataTransfer.setData(MV_ASSET_IMAGE_DRAG_KEY, file._id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={clearGridDragReorderIntent}
        onDragOver={(e: DragEvent) => {
          if (reorderSaving) return;
          onTreeDragOverAsset(e);
        }}
        onDrop={reorderSaving || displayOnly ? undefined : handleDropBeforeTreeImage(file)}
        className={cn(
          "group flex h-7 min-w-0 items-center gap-1 rounded-md px-1 text-left transition",
          selected ? "bg-sky-100 text-sky-950" : "text-slate-400 hover:bg-slate-100 hover:text-sky-900",
          canDragPlace && "cursor-grab active:cursor-grabbing",
        )}
        style={{ paddingInlineStart: level * 12 }}
      >
        {canDragPlace ? (
          <span
            className="flex h-5 w-4 shrink-0 items-center justify-center text-slate-300"
            title="اسحب لنقل الصورة أو تغيير ترتيبها"
            aria-hidden
          >
            <GripVertical className="h-3 w-3" />
          </span>
        ) : (
          <span className="w-4 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          draggable={false}
          onClick={() => toggleImageSelection(file._id)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-white/80 hover:text-sky-700"
          aria-label={selected ? "إخفاء الصورة من التقرير" : "إظهار الصورة في التقرير"}
        >
          {selected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          draggable={false}
          onClick={() => openImage(file)}
          className="flex min-w-0 flex-1 items-center gap-1.5"
          title={file.relativePath || file.name}
        >
          <ImageIcon className="h-3.5 w-3.5 shrink-0 text-sky-600" />
          <span className="min-w-0 flex-1 truncate" dir="auto">
            {fileNameFromPath(file.relativePath || file.name)}
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-100 transition hover:bg-white hover:text-slate-700 lg:opacity-0 lg:group-hover:opacity-100"
              aria-label="إجراءات الصورة"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 text-right">
            <DropdownMenuItem onSelect={() => openImage(file)} className="cursor-pointer text-[12px]">
              <ImageIcon className="h-4 w-4 text-sky-600" />
              فتح الصورة
            </DropdownMenuItem>
            {canMutate ? (
              <>
                <DropdownMenuItem onSelect={() => toggleImageSelection(file._id)} className="cursor-pointer text-[12px]">
                  {selected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                  {selected ? "إخفاء من التقرير" : "إظهار في التقرير"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => deleteSingleImage(file)}
                  className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                  حذف الصورة
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const renderTreeFolder = (node: ImageFolderNode, level = 0) => {
    const hasChildren = node.folders.length > 0 || node.images.length > 0;
    const expanded = expandedPaths.has(node.path);
    const active = selectedFolderPath === node.path;
    const folderFiles = collectFolderImages(node);
    const selected = folderFiles.length > 0 && folderFiles.every(isReportImageIncluded);
    const partiallySelected = !selected && folderFiles.some(isReportImageIncluded);
    const FolderIcon = expanded ? FolderOpen : Folder;

    return (
      <div key={node.path}>
        <div
          className="flex items-center gap-1 rounded-md transition hover:bg-slate-50/80"
          style={{ paddingInlineStart: level * 12 }}
          onDragOver={(e: DragEvent) => {
            if (reorderSaving || dragging) return;
            onTreeDragOverAsset(e);
          }}
          onDrop={reorderSaving || dragging ? undefined : handleDropOnFolderPath(node.path)}
        >
          <button
            type="button"
            draggable={false}
            onClick={() => hasChildren && toggleExpanded(node.path)}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400",
              hasChildren && "text-emerald-600 hover:bg-emerald-50",
            )}
            aria-label={expanded ? "طي المجلد" : "فتح المجلد"}
          >
            {hasChildren ? (
              expanded ? <MinusSquare className="h-3.5 w-3.5" /> : <PlusSquare className="h-3.5 w-3.5" />
            ) : (
              <span className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            draggable={false}
            onClick={() => toggleFolderSelection(node.path)}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100",
              (selected || partiallySelected) && "text-sky-700",
            )}
            aria-label={selected ? "إخفاء صور المجلد من التقرير" : "إظهار صور المجلد في التقرير"}
          >
            {selected ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : partiallySelected ? (
              <MinusSquare className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            draggable={false}
            onClick={() => selectFolder(node.path)}
            className={cn(
              "flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 text-left text-[11px] font-semibold transition",
              active ? "bg-sky-100 text-sky-950" : "text-slate-700 hover:bg-slate-100",
            )}
            title={node.name}
          >
            <FolderIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="min-w-0 flex-1 truncate" dir="auto">{node.name}</span>
            <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
              {numberFormatter.format(node.imageCount)}
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="إجراءات المجلد"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 text-right">
              <DropdownMenuItem onSelect={() => selectFolder(node.path)} className="cursor-pointer text-[12px]">
                <FolderOpen className="h-4 w-4 text-amber-600" />
                فتح المجلد
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toggleFolderSelection(node.path)} className="cursor-pointer text-[12px]">
                {selected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                {selected ? "إخفاء صور المجلد من التقرير" : "إظهار صور المجلد في التقرير"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => deleteFolderImages(node)}
                className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
                حذف صور المجلد
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {expanded ? (
          <div className="mt-0.5 space-y-0.5">
            {node.folders.map((folder) => renderTreeFolder(folder, level + 1))}
            {node.images.map((file) => renderTreeImage(file, level + 2))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderTreeRoot = () => {
    if (root.folders.length === 0 && root.images.length === 0) {
      return <div className="h-20" />;
    }

    return (
      <div className="space-y-0.5">
        {root.folders.map((folder) => renderTreeFolder(folder, 0))}
        {root.images.map((file) => renderTreeImage(file, 0))}
      </div>
    );
  };

  const renderPreviewTreeImage = (file: AssetImageViewFile, level = 0, treeMedia: AppPreviewMediaTab = "images") => {
    const displayOnly = isDisplayOnlyPicAssetImage(file);
    const effectiveId = displayOnly ? effectiveDriveFileId(file) : file._id;
    const effective = effectiveId ? filesById.get(effectiveId) : undefined;
    const canMutate = displayOnly ? true : Boolean(effectiveId && effective);
    const selected = displayOnly ? file.includeInReport === true : (canMutate ? isReportImageIncluded(effective!) : false);
    const isVideoRow = treeMedia === "videos" || isViewFileVideo(file);
    const canDragPlace =
      treeMedia === "videos"
        ? false
        : !displayOnly && canMutate && !isLocalPreviewDriveId(effectiveId!) && !reorderSaving;
    const MediaIcon = isVideoRow ? FileVideo : ImageIcon;
    return (
      <div
        key={`pv-${treeMedia}-${file._id}`}
        draggable={canDragPlace}
        onDragStart={(e: DragEvent) => {
          if (!canDragPlace) {
            e.preventDefault();
            return;
          }
          dragReorderFromIdx.current = null;
          e.dataTransfer.setData(MV_ASSET_IMAGE_DRAG_KEY, effectiveId!);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={clearGridDragReorderIntent}
        onDragOver={(e: DragEvent) => {
          if (reorderSaving) return;
          onTreeDragOverAsset(e);
        }}
        onDrop={reorderSaving || !canMutate ? undefined : handleDropBeforePreviewTreeImage(file)}
        className={cn(
          "group flex h-7 min-w-0 items-center gap-1 rounded-md px-1 text-left transition",
          selected ? "bg-emerald-100 text-emerald-950" : "text-slate-400 hover:bg-slate-100 hover:text-emerald-900",
          canDragPlace && "cursor-grab active:cursor-grabbing",
        )}
        style={{ paddingInlineStart: level * 12 }}
      >
        {canDragPlace ? (
          <span
            className="flex h-5 w-4 shrink-0 items-center justify-center text-slate-300"
            title="اسحب لنقل الصورة أو تغيير ترتيبها"
            aria-hidden
          >
            <GripVertical className="h-3 w-3" />
          </span>
        ) : (
          <span className="w-4 shrink-0" aria-hidden />
        )}
        <button
          type="button"
          draggable={false}
          disabled={!canMutate || reportSelectionSaving}
          onClick={() => (displayOnly ? void togglePicAssetImageSelection(file) : canMutate && toggleImageSelection(effectiveId!))}
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400",
            canMutate ? "hover:bg-white/80 hover:text-emerald-700" : "opacity-35",
          )}
          aria-label={selected ? "إخفاء من التقرير" : "إظهار في التقرير"}
        >
          {selected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          draggable={false}
          onClick={() => openPreviewImage(file)}
          className="flex min-w-0 flex-1 items-center gap-1.5"
          title={file.relativePath || file.name}
        >
          <MediaIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span className="min-w-0 flex-1 truncate" dir="auto">
            {fileNameFromPath(file.relativePath || file.name)}
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-100 transition hover:bg-white hover:text-slate-700 lg:opacity-0 lg:group-hover:opacity-100"
              aria-label={isVideoRow ? "إجراءات الفيديو" : "إجراءات الصورة"}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 text-right">
            <DropdownMenuItem onSelect={() => openPreviewImage(file)} className="cursor-pointer text-[12px]">
              <MediaIcon className="h-4 w-4 text-emerald-600" />
              {isVideoRow ? "فتح الفيديو" : "فتح الصورة"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => (displayOnly ? void togglePicAssetImageSelection(file) : canMutate && toggleImageSelection(effectiveId!))}
              disabled={displayOnly ? false : !canMutate}
              className="cursor-pointer text-[12px]"
            >
              {selected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
              {selected ? "إخفاء من التقرير" : "إظهار في التقرير"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => (displayOnly ? void deletePicAssetImage(file) : (canMutate && deleteFileIds([effectiveId!], "تم حذف الصورة.")))}
              disabled={displayOnly ? false : !canMutate}
              className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
              {isVideoRow ? "حذف الفيديو" : "حذف الصورة"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const renderPreviewTreeFolder = (node: ImageFolderNode, level = 0, treeMedia: AppPreviewMediaTab = "images") => {
    const leafFiles = treeMedia === "videos" ? node.videos : node.images;
    const hasChildren = node.folders.length > 0 || leafFiles.length > 0;
    const expanded = expandedPreviewIds.has(node.path);
    const active = selectedPreviewFolderId === node.path && appPreviewMediaTab === treeMedia;
    const folderFiles = treeMedia === "videos" ? collectFolderVideos(node) : collectFolderImages(node);
    const selectableFiles = folderFiles;
    const selected = selectableFiles.length > 0 && selectableFiles.every(isReportImageIncluded);
    const partiallySelected = !selected && selectableFiles.some(isReportImageIncluded);
    const FolderIcon = expanded ? FolderOpen : Folder;
    const countLabel = treeMedia === "videos" ? node.videoCount : node.imageCount;

    return (
      <div key={`pv-f-${treeMedia}-${node.path}`}>
        <div
          className="flex items-center gap-1 rounded-md transition hover:bg-slate-50/80"
          style={{ paddingInlineStart: level * 12 }}
          onDragOver={(e: DragEvent) => {
            if (reorderSaving || draggingPreview) return;
            onTreeDragOverAsset(e);
          }}
          onDrop={
            reorderSaving || draggingPreview || !node.picAssetId || treeMedia === "videos"
              ? undefined
              : handleDropOnPreviewFolderRow(node.path, node.name)
          }
        >
          <button
            type="button"
            draggable={false}
            onClick={() => hasChildren && togglePreviewExpanded(node.path)}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400",
              hasChildren && "text-emerald-600 hover:bg-emerald-50",
            )}
            aria-label={expanded ? "طي المجلد" : "فتح المجلد"}
          >
            {hasChildren ? (
              expanded ? <MinusSquare className="h-3.5 w-3.5" /> : <PlusSquare className="h-3.5 w-3.5" />
            ) : (
              <span className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            draggable={false}
            onClick={() => togglePreviewFolderSelection(node.path)}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100",
              (selected || partiallySelected) && "text-emerald-700",
            )}
            aria-label={selected ? "إخفاء من التقرير" : "إظهار في التقرير"}
          >
            {selected ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : partiallySelected ? (
              <MinusSquare className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            draggable={false}
            onClick={() => selectPreviewFolder(node.path, treeMedia)}
            className={cn(
              "flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 text-left text-[11px] font-semibold transition",
              active ? "bg-emerald-100 text-emerald-950" : "text-slate-700 hover:bg-slate-100",
            )}
            title={node.name}
          >
            <FolderIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="min-w-0 flex-1 truncate" dir="auto">
              {node.name}
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
              {numberFormatter.format(countLabel)}
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="إجراءات المجلد"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 text-right">
              <DropdownMenuItem onSelect={() => selectPreviewFolder(node.path, treeMedia)} className="cursor-pointer text-[12px]">
                <FolderOpen className="h-4 w-4 text-amber-600" />
                فتح المجلد
              </DropdownMenuItem>
              {node.picAssetId && treeMedia === "images" ? (
                <DropdownMenuItem
                  onSelect={() => void createPreviewFolder(node.picAssetId)}
                  disabled={creatingPreviewFolder}
                  className="cursor-pointer text-[12px]"
                >
                  <FolderPlus className="h-4 w-4 text-emerald-600" />
                  إنشاء مجلد داخل هذا المجلد
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onSelect={() => togglePreviewFolderSelection(node.path)}
                className="cursor-pointer text-[12px]"
              >
                {selected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                {selected ? "إخفاء من التقرير" : "إظهار في التقرير"}
              </DropdownMenuItem>
              {treeMedia === "images" ? (
                <DropdownMenuItem
                  onSelect={() => deleteFolderImages(node)}
                  className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                  حذف صور المجلد
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {expanded ? (
          <div className="mt-0.5 space-y-0.5">
            {node.folders.map((folder) => renderPreviewTreeFolder(folder, level + 1, treeMedia))}
            {leafFiles.map((file) => renderPreviewTreeImage(file, level + 2, treeMedia))}
          </div>
        ) : null}
      </div>
    );
  };

  const renderCombinedTree = () => {
    const deviceExpanded = expandedPaths.has("");
    const appExpanded = expandedPreviewIds.has("__pv_root__");
    const appActive =
      assetImagesSource === "app" &&
      selectedPreviewFolderId === "__pv_root__" &&
      appPreviewMediaTab === "images";
    const deviceActive = assetImagesSource === "device" && selectedFolderPath === "";

    return (
      <div className="space-y-1">
        <div className="rounded-md border border-emerald-100 bg-white">
          <div className="flex items-center gap-1 px-1 py-1">
            <button
              type="button"
              onClick={() => togglePreviewExpanded("__pv_root__")}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50"
              aria-label={appExpanded ? "طي صور الأصول من التطبيق" : "فتح صور الأصول من التطبيق"}
            >
              {appExpanded ? <MinusSquare className="h-3.5 w-3.5" /> : <PlusSquare className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setAssetImagesSource("app");
                selectPreviewFolder("__pv_root__", "images");
              }}
              className={cn(
                "flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 text-left text-[11px] font-extrabold transition",
                appActive ? "bg-emerald-100 text-emerald-950" : "text-slate-800 hover:bg-slate-50",
              )}
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span className="min-w-0 flex-1 truncate">صور الأصول من التطبيق</span>
              <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                {numberFormatter.format(previewRoot.imageCount)}
              </span>
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 shrink-0 p-0"
              disabled={loadingPreviewFolders}
              onClick={() => void refreshAppPicFoldersFromServer()}
              aria-label="تحديث من الخادم"
              title="إعادة جلب مجلدات الأصول من الخادم"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loadingPreviewFolders && "animate-spin")} />
            </Button>
          </div>
          {appExpanded ? (
            <div className="space-y-2 px-1 pb-1">
              {loadingPreviewFolders && previewPhotoFolders.length === 0 ? (
                <div className="flex h-16 items-center justify-center text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : previewRoot.folders.length > 0 ? (
                <>
                  {previewRoot.folders.map((folder) => renderPreviewTreeFolder(folder, 1, "images"))}
                </>
              ) : (
                <p className="px-2 py-3 text-center text-[11px] font-bold text-slate-400">
                  لا توجد مجلدات من التطبيق بعد
                </p>
              )}
            </div>
          ) : null}
        </div>

        <div className="rounded-md border border-sky-100 bg-white">
          <div className="flex items-center gap-1 px-1 py-1">
            <button
              type="button"
              onClick={() => toggleExpanded("")}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sky-600 hover:bg-sky-50"
              aria-label={deviceExpanded ? "طي صور الأصول من الجهاز" : "فتح صور الأصول من الجهاز"}
            >
              {deviceExpanded ? <MinusSquare className="h-3.5 w-3.5" /> : <PlusSquare className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => {
                setAssetImagesSource("device");
                setAppPreviewMediaTab("images");
                selectFolder("");
              }}
              className={cn(
                "flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 text-left text-[11px] font-extrabold transition",
                deviceActive ? "bg-sky-100 text-sky-950" : "text-slate-800 hover:bg-slate-50",
              )}
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-sky-600" />
              <span className="min-w-0 flex-1 truncate">صور الأصول من الجهاز</span>
              <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                {numberFormatter.format(root.imageCount)}
              </span>
            </button>
          </div>
          {deviceExpanded ? (
            <div className="space-y-0.5 px-1 pb-1">
              {awaitingInitialListFetch ? (
                <div className="flex h-16 items-center justify-center text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : root.folders.length > 0 || root.images.length > 0 ? (
                <>
                  {root.folders.map((folder) => renderTreeFolder(folder, 1))}
                  {root.images.map((file) => renderTreeImage(file, 1))}
                </>
              ) : (
                <p className="px-2 py-3 text-center text-[11px] font-bold text-slate-400">
                  لا توجد صور من الجهاز بعد
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const bulkActionsDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          aria-label="إجراءات الصور"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 text-right">
        <DropdownMenuItem
          onSelect={() => {
            void loadImages("revalidate");
            if (assetImagesSource === "app") {
              void loadPreviewPhotoFolders("revalidate");
              void loadAssetImportSummary();
            }
          }}
          disabled={loading || deleting}
          className="cursor-pointer text-[12px]"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          تحديث
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={deleteSelectedItems}
          disabled={selectedCount === 0 || deleting}
          className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
          حذف الصور المحددة للتقرير
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => (assetImagesSource === "app" ? deleteCurrentPreviewPathImages() : deleteCurrentPathImages())}
          disabled={
            assetImagesSource === "app" ?
              selectedPreviewNodeFiles.length === 0 || deleting
            : selectedFolder.imageCount === 0 || deleting
          }
          className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
          حذف صور المسار الحالي
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <MvWorkflowPageFrame className="bg-[var(--color-background-primary)]" dir="rtl">
      <MvProjectReportHeader
        compact
        projectId={projectId}
        activeStep="asset-images"
        breadcrumbs={[
          { label: projectName ?? projectId, href: `/machine-valuation/${projectId}/workflow/report-data` },
          { label: "تحديد صور الأصول" },
        ]}
      />

      <MvWorkflowPageScrollBody>
      <div className="mx-auto max-w-7xl px-3 pt-1 pb-2 sm:px-5">
          <section className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="m-0">
              <input
                ref={filePickInputRef}
                type="file"
                className="hidden"
                multiple
                accept="image/*"
                onChange={(event) => handleInputFiles(event.target.files)}
              />
              <input
                ref={folderPickInputRef}
                type="file"
                className="hidden"
                multiple
                {...({
                  webkitdirectory: "",
                } as Record<string, unknown>)}
                onChange={(event) => handleInputFiles(event.target.files)}
              />
              <div
                className={cn("transition-colors", draggingPreview && "bg-emerald-50/50")}
                onDragOver={(event) => {
                  if (!isFileUploadDrag(event.dataTransfer)) return;
                  event.preventDefault();
                  setDraggingPreview(true);
                }}
                onDragLeave={() => setDraggingPreview(false)}
                onDrop={async (event) => {
                  if (!isFileUploadDrag(event.dataTransfer)) return;
                  event.preventDefault();
                  setDraggingPreview(false);
                  if (!selectedPreviewFolderId || !selectedPreviewFolderNode?.picAssetId) {
                    toast({
                      variant: "destructive",
                      description: "اختر مجلد أصل من الشجرة ثم أفلت الصور.",
                    });
                    return;
                  }
                  const picked = await collectDroppedImages(event.dataTransfer);
                  void uploadImagesToPicFolder(
                    selectedPreviewFolderNode.picAssetId,
                    selectedPreviewFolderNode.name,
                    picked,
                  );
                }}
              >
                <div
                  className={cn(
                    "border-b border-slate-200 bg-white px-3 py-2.5 sm:px-4",
                    draggingPreview && "border-emerald-200 bg-emerald-50/30",
                  )}
                  dir="rtl"
                >
                  <div className="flex w-full min-w-0 items-center gap-2 overflow-x-auto" dir="rtl">
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 shrink-0 gap-2 border-emerald-200 bg-white px-3 text-[12px] font-extrabold text-emerald-900 hover:bg-emerald-50"
                        onClick={() => setAssetImageFoldersModalOpen(true)}
                      >
                        <FileSpreadsheet className="h-4 w-4 shrink-0" />
                        إنشاء مجلدات الصور
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        title="إنشاء مجلد جديد داخل صور المعاينة"
                        aria-label="إنشاء مجلد جديد داخل صور المعاينة"
                        disabled={!photosRootId || creatingPreviewFolder}
                        onClick={() => void createPreviewFolder()}
                        className="h-9 shrink-0 gap-2 border-emerald-200 bg-white px-3 text-[12px] font-bold text-slate-700 shadow-sm hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-40"
                      >
                        {creatingPreviewFolder ? (
                          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                        ) : (
                          <FolderPlus className="h-4 w-4 text-emerald-600" />
                        )}
                        إنشاء مجلد جديد
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            className="h-9 shrink-0 rounded-lg bg-[#0C447C] px-3 text-[12px] font-extrabold text-white hover:bg-[#0a3a66] sm:px-4"
                          >
                            <Upload className="me-2 h-3.5 w-3.5 shrink-0" />
                            رفع صور/مجلدات
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 text-right">
                          <DropdownMenuItem
                            onSelect={() => filePickInputRef.current?.click()}
                            className="cursor-pointer text-[12px]"
                          >
                            <span className="me-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-sky-50 text-sky-700">
                              <Upload className="h-4 w-4" />
                            </span>
                            رفع صور
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => folderPickInputRef.current?.click()}
                            className="cursor-pointer text-[12px]"
                          >
                            <span className="me-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-700">
                              <FolderUp className="h-4 w-4" />
                            </span>
                            رفع مجلد
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="ms-auto flex shrink-0 items-center gap-2">
                      <label className="flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-700 shadow-sm">
                        <Checkbox
                          checked={includeAssetImagesInReport}
                          disabled={reportSelectionSaving}
                          onCheckedChange={(value) => void updateAssetImagesReportEnabled(value === true)}
                          className="border-emerald-400"
                          aria-label="عرض الصور في التقرير"
                        />
                        <span>عرض الصور في التقرير</span>
                      </label>

                      {selectedCount > 0 ? (
                        <span className="flex h-9 shrink-0 items-center rounded-full bg-emerald-100 px-2.5 text-[11px] font-bold text-emerald-950">
                          {numberFormatter.format(selectedCount)} للتقرير
                        </span>
                      ) : null}

                      {bulkActionsDropdown}
                    </div>
                  </div>
                </div>

                <div className="grid min-h-[calc(100vh-18rem)] grid-cols-1 bg-slate-50/50 lg:grid-cols-[300px_minmax(0,1fr)]" dir="ltr">
                <aside className="border-b border-slate-200 bg-white p-2 lg:border-b-0 lg:border-r">
                  <div className="max-h-[calc(100vh-19rem)] overflow-auto rounded-md border border-slate-200 bg-slate-50/60 p-1.5">
                    {renderCombinedTree()}
                  </div>
                </aside>

                <main className="min-w-0 p-3 sm:p-4" dir="rtl">
                  {!activeContentNode ? (
                    <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white">
                      <div className="text-center">
                        <Folder className="mx-auto h-10 w-10 text-slate-300" />
                        <p className="mt-2 text-[13px] font-bold text-slate-500">اختر مجلد أصل من الشجرة</p>
                      </div>
                    </div>
                  ) : activeContentFolders.length === 0 && activeContentFiles.length === 0 ? (
                    <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-emerald-200 bg-white">
                      <div className="text-center">
                        <ImageIcon className="mx-auto h-10 w-10 text-emerald-200" />
                        <p className="mt-2 text-[13px] font-extrabold text-slate-600" dir="auto">
                          لا توجد صور أو مجلدات في «{activeContentNode.name}»
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-slate-500">
                          اسحب الصور إلى المجلد أو استخدم أزرار الرفع بالأعلى.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeContentFolders.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                          {activeContentFolders.map((folder) => (
                            <button
                              key={`${assetImagesSource}-folder-${folder.path}`}
                              type="button"
                              onClick={() =>
                                assetImagesSource === "app"
                                  ? selectPreviewFolder(folder.path, appPreviewMediaTab)
                                  : selectFolder(folder.path)
                              }
                              className="group flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border border-amber-200 bg-white p-3 text-center shadow-sm transition hover:border-amber-300 hover:bg-amber-50/40 hover:shadow-md"
                            >
                              <FolderOpen className="h-10 w-10 text-amber-500 transition group-hover:scale-105" />
                              <span className="line-clamp-2 text-[12px] font-extrabold text-slate-700" dir="auto">
                                {folder.name}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-500">
                                {numberFormatter.format(
                                  folder.imageCount,
                                )}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {activeContentFiles.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                      {activeContentFiles.map((file, imageIdx) => {
                        const displayOnly = isDisplayOnlyPicAssetImage(file);
                        const effectiveId = displayOnly ? effectiveDriveFileId(file) : file._id;
                        const effective = effectiveId ? filesById.get(effectiveId) : undefined;
                        const canMutate = displayOnly ? true : Boolean(effectiveId && effective);
                        const isVideoCell = isViewFileVideo(file);
                        const imageSelected = displayOnly
                          ? file.includeInReport === true
                          : canMutate
                            ? isReportImageIncluded(effective!)
                            : false;
                        const canDragReorder =
                          assetImagesSource === "app" &&
                          previewGridCanReorder &&
                          !displayOnly &&
                          canMutate &&
                          !isLocalPreviewDriveId(effectiveId!);
                        return (
                          <div
                            key={file._id}
                            role="listitem"
                            draggable={canDragReorder}
                            onDragStart={(e: DragEvent) => {
                              if (!canDragReorder) return;
                              onDragStartImageReorder(imageIdx);
                              e.dataTransfer.setData(MV_ASSET_IMAGE_DRAG_KEY, effectiveId!);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={clearGridDragReorderIntent}
                            onDragOver={(e: DragEvent) => {
                              if (reorderSaving || draggingPreview) return;
                              if (!Array.from(e.dataTransfer.types).includes(MV_ASSET_IMAGE_DRAG_KEY)) return;
                              e.preventDefault();
                              e.stopPropagation();
                              e.dataTransfer.dropEffect = "move";
                            }}
                            onDrop={(e: DragEvent) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const fromIdx = dragReorderFromIdx.current;
                              if (
                                fromIdx !== null &&
                                fromIdx !== imageIdx &&
                                canDragReorder
                              ) {
                                dragReorderFromIdx.current = null;
                                void reorderPreviewFolderImagesByDrag(fromIdx, imageIdx);
                                return;
                              }
                              const fid = e.dataTransfer.getData(MV_ASSET_IMAGE_DRAG_KEY);
                              dragReorderFromIdx.current = null;
                              const anchor = activeContentFiles[imageIdx];
                              const anchorEffectiveId =
                                anchor && isDisplayOnlyPicAssetImage(anchor)
                                  ? effectiveDriveFileId(anchor)
                                  : anchor?._id;
                              const anchorEffective = anchorEffectiveId ? filesById.get(anchorEffectiveId) : undefined;
                              if (!fid || !anchorEffectiveId || !anchorEffective) return;
                              if (fid === anchorEffectiveId) return;
                              const targetPath = driveFileFolderPath(anchorEffective);
                              if (!targetPath) return;
                              void placeAssetImage(
                                fid,
                                targetPath,
                                anchorEffectiveId,
                                assetImagesSource === "app"
                                  ? (anchorEffective as AssetImageViewFile).picAssetId ?? undefined
                                  : undefined,
                              );
                            }}
                            className={cn(
                              "group overflow-hidden rounded-lg border bg-white text-right shadow-sm transition hover:border-emerald-300 hover:shadow-md",
                              imageSelected ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200",
                              canDragReorder && "cursor-grab active:cursor-grabbing",
                            )}
                          >
                            <div className="relative">
                              {canDragReorder ? (
                                <div
                                  className="pointer-events-none absolute bottom-1 left-1 z-20 flex h-6 w-6 items-center justify-center rounded bg-black/35 text-white backdrop-blur-[2px]"
                                  title="اسحب لتغيير ترتيب العرض"
                                  aria-hidden
                                >
                                  <GripVertical className="h-3.5 w-3.5 opacity-90" />
                                </div>
                              ) : null}
                              <div className="absolute inset-x-2 top-2 z-10 flex items-center justify-between">
                                <Checkbox
                                  checked={imageSelected}
                                  disabled={!canMutate || reportSelectionSaving}
                                  onCheckedChange={() =>
                                    displayOnly
                                      ? void togglePicAssetImageSelection(file)
                                      : canMutate && toggleImageSelection(effectiveId!)
                                  }
                                  className="border-white bg-white/90 shadow-sm"
                                  aria-label={imageSelected ? "إخفاء الصورة من التقرير" : "إظهار الصورة في التقرير"}
                                />
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-900"
                                      aria-label={isVideoCell ? "إجراءات الفيديو" : "إجراءات الصورة"}
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40 text-right">
                                    <DropdownMenuItem
                                      onSelect={() => openPreviewImage(file)}
                                      className="cursor-pointer text-[12px]"
                                    >
                                      {isVideoCell ? (
                                        <FileVideo className="h-4 w-4 text-emerald-600" />
                                      ) : (
                                        <ImageIcon className="h-4 w-4 text-emerald-600" />
                                      )}
                                      {isVideoCell ? "فتح الفيديو" : "فتح الصورة"}
                                    </DropdownMenuItem>
                                    {!displayOnly ? (
                                      <>
                                        <DropdownMenuItem
                                          onSelect={() => toggleImageSelection(file._id)}
                                          className="cursor-pointer text-[12px]"
                                        >
                                          {imageSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                                          {imageSelected ? "إخفاء من التقرير" : "إظهار في التقرير"}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onSelect={() => deleteSingleImage(file)}
                                          className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          حذف الصورة
                                        </DropdownMenuItem>
                                      </>
                                    ) : (
                                      <>
                                        <DropdownMenuItem
                                          onSelect={() => void togglePicAssetImageSelection(file)}
                                          disabled={!canMutate}
                                          className="cursor-pointer text-[12px]"
                                        >
                                          {imageSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                                          {imageSelected ? "إخفاء من التقرير" : "إظهار في التقرير"}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onSelect={() => void deletePicAssetImage(file)}
                                          disabled={!canMutate}
                                          className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          حذف الصورة
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <button type="button" onClick={() => openPreviewImage(file)} className="block w-full">
                                {isVideoCell ? (
                                  <video
                                    src={resolveThumbSrc(file) || undefined}
                                    className="aspect-square w-full bg-black object-cover transition group-hover:scale-[1.02]"
                                    playsInline
                                    controls
                                    preload="metadata"
                                    muted
                                  />
                                ) : (
                                  <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={resolveThumbSrc(file) || undefined}
                                      alt=""
                                      className="aspect-square w-full bg-slate-100 object-cover transition group-hover:scale-[1.02]"
                                      loading="lazy"
                                    />
                                  </>
                                )}
                              </button>
                            </div>
                            <span className="block truncate px-2 py-2 text-[10px] font-bold text-slate-600" dir="auto">
                              {fileNameFromPath(file.relativePath || file.name)}
                            </span>
                          </div>
                        );
                      })}
                        </div>
                      ) : null}
                    </div>
                  )}
                </main>
              </div>
              </div>
            </div>
          </section>
      </div>

      </MvWorkflowPageScrollBody>

      <MvAssetImageFoldersModal
        open={assetImageFoldersModalOpen}
        onOpenChange={setAssetImageFoldersModalOpen}
        projectId={projectId}
        initialImportResult={assetImportResult}
        onImportResultChange={applyAssetImportResult}
        onGenerated={async () => {
          await Promise.all([loadPreviewPhotoFolders("revalidate"), loadImages("revalidate")]);
        }}
      />

      <Dialog open={lightboxFile != null} onOpenChange={(open) => !open && setLightboxFile(null)}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-hidden border-0 bg-slate-950 p-0 text-white">
          <DialogTitle className="sr-only">
            {lightboxFile && isViewFileVideo(lightboxFile) ? "معاينة الفيديو" : "معاينة الصورة"}
          </DialogTitle>
          {lightboxFile ? (
            <div className="grid max-h-[92vh] grid-rows-[minmax(0,1fr)_auto]">
              <div className="flex min-h-0 items-center justify-center bg-black">
                {isViewFileVideo(lightboxFile) ? (
                  <video
                    src={resolveThumbSrc(lightboxFile)}
                    className="max-h-[82vh] max-w-full object-contain"
                    playsInline
                    controls
                    autoPlay
                    preload="metadata"
                  />
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveThumbSrc(lightboxFile)}
                      alt=""
                      className="max-h-[82vh] max-w-full object-contain"
                    />
                  </>
                )}
              </div>
              <div className="border-t border-white/10 px-4 py-3 text-right">
                <p className="truncate text-[12px] font-bold" dir="auto">
                  {lightboxFile.relativePath || lightboxFile.name}
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </MvWorkflowPageFrame>
  );
}
