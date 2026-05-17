"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ArrowUp,
  CheckSquare,
  Clock,
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
  Search,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { MvUploadProgressToast } from "./mv-upload-progress-toast";

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
const dateTimeFormatter = new Intl.DateTimeFormat("ar-SA", {
  dateStyle: "medium",
  timeStyle: "short",
});
type AssetImagesSource = "app" | "device";
type AppPreviewMediaTab = "images" | "videos";
type AssetUploadJobState = "uploading" | "done" | "error";
type AssetImagesSearchMode = "all" | "recent";
type AssetImagesSearchKind = "all" | "folder" | "image";

type AssetUploadJobKind = "folder" | "images";

type AssetUploadJob = {
  id: string;
  kind: AssetUploadJobKind;
  label: string;
  phase: string;
  progress: number;
  current: number;
  total: number;
  folderName?: string;
  state: AssetUploadJobState;
};

type AssetUploadProgressPatch = {
  phase: string;
  completedInGroup: number;
  groupTotal: number;
};

type AppliedAssetImagesSearch = {
  query: string;
  mode: AssetImagesSearchMode;
  kind: AssetImagesSearchKind;
};

type AssetImagesSearchResult = {
  id: string;
  kind: "folder" | "image";
  title: string;
  subtitle: string;
  chips: string[];
  normalizedTitle: string;
  normalizedPath: string;
  normalizedSearchText: string;
  recentAtMs: number;
  folderIdPath: string[];
  selectFolderId: string;
  file?: AssetImageViewFile;
};

type PreviewPhotoFolderEntry = { sub: MvSubProject; picAsset: PicAsset | null };

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

function normalizeAssetSearchText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}/._:-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function assetSearchTerms(query: string): string[] {
  return normalizeAssetSearchText(query).split(" ").filter(Boolean);
}

function parseAssetDateMs(...values: Array<string | null | undefined>): number {
  for (const value of values) {
    if (!value) continue;
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return ms;
  }
  return 0;
}

function assetFileRecentAtMs(file: MvDriveFile): number {
  return parseAssetDateMs(file.uploadedAt, file.updatedAt);
}

function formatAssetSearchDate(ms: number): string {
  if (!ms) return "";
  try {
    return dateTimeFormatter.format(new Date(ms));
  } catch {
    return "";
  }
}

function scoreAssetSearchResult(
  result: AssetImagesSearchResult,
  normalizedQuery: string,
  terms: string[],
): number {
  if (terms.length === 0) return 0;
  let score = 0;
  if (result.normalizedTitle === normalizedQuery) score += 120;
  if (result.normalizedTitle.startsWith(normalizedQuery)) score += 80;
  if (result.normalizedTitle.includes(normalizedQuery)) score += 50;
  if (result.normalizedPath.includes(normalizedQuery)) score += 30;
  for (const term of terms) {
    if (result.normalizedTitle.includes(term)) score += 18;
    if (result.normalizedPath.includes(term)) score += 10;
    if (result.normalizedSearchText.includes(term)) score += 4;
  }
  return score;
}

function relativePathParts(path: string, fallbackName: string) {
  return normalizeRelativePath(path, fallbackName).split("/").filter(Boolean);
}

function folderPartsFromPickedImage(item: PickedImageFile) {
  const parts = relativePathParts(item.relativePath, item.file.name);
  return parts.length > 1 ? parts.slice(0, -1) : [];
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
const MV_ASSET_IMAGE_DRAG_IDS_KEY = "application/x-sv-mv-asset-image-ids";

function parseAssetDragFileIds(event: DragEvent): string[] {
  const raw = event.dataTransfer.getData(MV_ASSET_IMAGE_DRAG_IDS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const ids = parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
        if (ids.length > 0) return [...new Set(ids)];
      }
    } catch {
      /* ignore */
    }
  }
  const single = event.dataTransfer.getData(MV_ASSET_IMAGE_DRAG_KEY);
  return single ? [single] : [];
}

function writeAssetDragFileIds(event: DragEvent, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return;
  event.dataTransfer.setData(MV_ASSET_IMAGE_DRAG_KEY, unique[0]!);
  if (unique.length > 1) {
    event.dataTransfer.setData(MV_ASSET_IMAGE_DRAG_IDS_KEY, JSON.stringify(unique));
  }
  event.dataTransfer.effectAllowed = "move";
}

function assetDragPayloadActive(event: DragEvent) {
  const types = Array.from(event.dataTransfer.types ?? []);
  return types.includes(MV_ASSET_IMAGE_DRAG_KEY) || types.includes(MV_ASSET_IMAGE_DRAG_IDS_KEY);
}

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
const ASSET_UPLOAD_PARALLEL_REQUESTS = 8;

/** دفعات عرض المعاينات المحليّة في الواجهة حتى لا يتجمّد الخيط وقت إنشاء blob: عند مجلدات ضخمة */
const PREVIEW_UI_CHUNK_SIZE = 56;

function shouldYieldPreviewUiChunk(chunkIndex: number, totalImages: number) {
  if (totalImages <= PREVIEW_UI_CHUNK_SIZE) return false;
  const chunkNumber = Math.floor(chunkIndex / PREVIEW_UI_CHUNK_SIZE);
  return chunkNumber % 2 === 1;
}

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
  onUploadedCount?: (uploaded: number, total: number) => void,
): Promise<MvDriveFile[]> {
  const batches = chunkPickedImages(imageFiles, ASSET_UPLOAD_FILES_PER_REQUEST);
  const total = imageFiles.length;
  if (batches.length === 0) return [];
  if (batches.length === 1) {
    const rows = await postAssetImagesFormDataToPicFolder(
      projectId,
      picAssetFolderId,
      folderDisplayName,
      batches[0]!,
    );
    onUploadedCount?.(total, total);
    return rows;
  }

  const slots = Math.min(ASSET_UPLOAD_PARALLEL_REQUESTS, batches.length);
  const grouped: MvDriveFile[][] = new Array(batches.length);
  let nextBatch = 0;
  let finishedBatches = 0;

  async function worker() {
    while (nextBatch < batches.length) {
      const i = nextBatch++;
      grouped[i] = await postAssetImagesFormDataToPicFolder(
        projectId,
        picAssetFolderId,
        folderDisplayName,
        batches[i]!,
      );
      finishedBatches += 1;
      const uploaded = Math.min(
        total,
        batches.slice(0, finishedBatches).reduce((sum, batch) => sum + batch.length, 0),
      );
      onUploadedCount?.(uploaded, total);
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

function fileDropIdentityKey(file: File): string {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}

function pickedImagesFromFileList(files: FileList | readonly File[]): PickedImageFile[] {
  const seen = new Set<string>();
  const picked: PickedImageFile[] = [];
  for (const file of Array.from(files)) {
    if (!isLikelyImage(file)) continue;
    const key = fileDropIdentityKey(file);
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push({
      file,
      relativePath: normalizeRelativePath(file.name, file.name),
    });
  }
  return picked;
}

async function collectDroppedImages(dataTransfer: DataTransfer) {
  const items = Array.from(dataTransfer.items ?? []);
  const fileItems = items.filter((item) => item.kind === "file");
  const entries = fileItems.map((item) => {
    const entry = (
      item as DataTransferItem & {
        webkitGetAsEntry?: () => WebkitEntry | null;
      }
    ).webkitGetAsEntry?.();
    return { item, entry: entry ?? null };
  });

  const hasDirectory = entries.some((row) => row.entry?.isDirectory);

  // عدة صور من مستكشف الملفات: FileList أوثق من webkitGetAsEntry (مشكلة شائعة على Windows)
  if (!hasDirectory) {
    const looseFiles = Array.from(dataTransfer.files ?? []).filter(isLikelyImage);
    if (looseFiles.length > 0) {
      return pickedImagesFromFileList(looseFiles);
    }
  }

  const picked: PickedImageFile[] = [];
  const seen = new Set<string>();

  const remember = (file: File, relativePath: string) => {
    if (!isLikelyImage(file)) return;
    const key = fileDropIdentityKey(file);
    if (seen.has(key)) return;
    seen.add(key);
    picked.push({
      file,
      relativePath: normalizeRelativePath(relativePath, file.name),
    });
  };

  for (const { item, entry } of entries) {
    if (entry) {
      const fromEntry = await collectImagesFromEntry(entry);
      for (const row of fromEntry) {
        remember(row.file, row.relativePath);
      }
      continue;
    }

    const file = item.getAsFile();
    if (file) remember(file, file.name);
  }

  if (picked.length > 0) return picked;

  return pickedImagesFromFileList(dataTransfer.files ?? []);
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

function countDescendantFolders(node: ImageFolderNode): number {
  return node.folders.reduce((sum, folder) => sum + 1 + countDescendantFolders(folder), 0);
}

function folderContainsPath(node: ImageFolderNode, path: string): boolean {
  if (node.path === path) return true;
  return node.folders.some((folder) => folderContainsPath(folder, path));
}

function findFolderNodePath(node: ImageFolderNode, path: string): ImageFolderNode[] {
  if (node.path === path) return [node];
  for (const folder of node.folders) {
    const nested = findFolderNodePath(folder, path);
    if (nested.length > 0) return [node, ...nested];
  }
  return [];
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
  const assetSearchInputRef = useRef<HTMLInputElement>(null);
  /** blob: للمعاينة الفورية قبل اكتمال الرفع — يُحرَّر عند الاستبدال أو إلغاء التثبيت */
  const optimisticPreviewUrlsRef = useRef<Map<string, string>>(new Map());
  const recentlyCreatedPreviewFoldersRef = useRef<Map<string, PreviewPhotoFolderEntry>>(new Map());
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
  const [assetUploadJobs, setAssetUploadJobs] = useState<AssetUploadJob[]>([]);
  const [assetImportResult, setAssetImportResult] = useState<AssetImportResult | null>(null);
  const [assetImageFoldersModalOpen, setAssetImageFoldersModalOpen] = useState(false);
  const [assetSearchOpen, setAssetSearchOpen] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [assetSearchMode, setAssetSearchMode] = useState<AssetImagesSearchMode>("all");
  const [assetSearchKind, setAssetSearchKind] = useState<AssetImagesSearchKind>("all");
  const [appliedAssetSearch, setAppliedAssetSearch] = useState<AppliedAssetImagesSearch | null>(null);
  const filesById = useMemo(() => new Map(files.map((f) => [f._id, f])), [files]);

  const startAssetUploadJob = useCallback(
    (params: {
      kind: AssetUploadJobKind;
      label: string;
      total: number;
      phase?: string;
      folderName?: string;
    }) => {
      const id = crypto.randomUUID();
      setAssetUploadJobs((current) => [
        ...current,
        {
          id,
          kind: params.kind,
          label: params.label,
          phase: params.phase ?? "جاري التحضير…",
          progress: 2,
          current: 0,
          total: params.total,
          folderName: params.folderName,
          state: "uploading",
        },
      ]);
      return id;
    },
    [],
  );

  const activeAssetUploadJob = useMemo(() => {
    if (assetUploadJobs.length === 0) return null;
    return assetUploadJobs.find((job) => job.state === "uploading") ?? assetUploadJobs[assetUploadJobs.length - 1]!;
  }, [assetUploadJobs]);

  const updateAssetUploadJob = useCallback((id: string, patch: Partial<AssetUploadJob>) => {
    setAssetUploadJobs((current) =>
      current.map((job) => (job.id === id ? { ...job, ...patch } : job)),
    );
  }, []);

  const removeAssetUploadJobLater = useCallback((id: string, delay = 2400) => {
    window.setTimeout(() => {
      setAssetUploadJobs((current) => current.filter((job) => job.id !== id));
    }, delay);
  }, []);

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
      const mergeRecentlyCreated = (base: PreviewPhotoFolderEntry[]): PreviewPhotoFolderEntry[] => {
        if (recentlyCreatedPreviewFoldersRef.current.size === 0) return base;
        const presentSubIds = new Set(base.map((entry) => entry.sub._id));
        const presentPicAssetIds = new Set(
          base.map((entry) => entry.picAsset?._id).filter((id): id is string => Boolean(id)),
        );
        const merged = [...base];

        for (const [key, entry] of Array.from(recentlyCreatedPreviewFoldersRef.current.entries())) {
          const picAssetId = entry.picAsset?._id;
          if (presentSubIds.has(entry.sub._id) || (picAssetId && presentPicAssetIds.has(picAssetId))) {
            recentlyCreatedPreviewFoldersRef.current.delete(key);
            continue;
          }
          merged.push(entry);
        }

        return merged;
      };
      const summaryEntries = mergeRecentlyCreated(
        children.map((sub) => ({ sub, picAsset: sub.picAsset ?? null })),
      );
      setPreviewPhotoFolders(summaryEntries);
      writeMvWorkflowSessionJson(cacheKey, { photosRootId: previewRoot._id, entries: summaryEntries });
      let entries = (
        await mapWithConcurrency(children, 8, async (sub) => {
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
      entries = mergeRecentlyCreated(entries);
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
    if (typeof window === "undefined" || typeof window.EventSource === "undefined") return;

    let refreshTimer: number | null = null;
    let needsFolders = false;
    let needsImages = false;

    const flushRefresh = () => {
      const runFolders = needsFolders;
      const runImages = needsImages;
      needsFolders = false;
      needsImages = false;
      refreshTimer = null;
      if (runFolders) void loadPreviewPhotoFolders("revalidate");
      if (runImages) void loadImages("revalidate");
    };

    const scheduleRefresh = (folders: boolean, images: boolean) => {
      needsFolders ||= folders;
      needsImages ||= images;
      if (refreshTimer !== null) return;
      refreshTimer = window.setTimeout(flushRefresh, 220);
    };

    const events = new EventSource(`/api/mv/projects/${encodeURIComponent(projectId)}/events`, {
      withCredentials: true,
    });
    const onFoldersChanged = () => scheduleRefresh(true, false);
    const onImagesChanged = () => scheduleRefresh(false, true);

    events.addEventListener("asset-folders-changed", onFoldersChanged);
    events.addEventListener("asset-images-changed", onImagesChanged);

    return () => {
      events.removeEventListener("asset-folders-changed", onFoldersChanged);
      events.removeEventListener("asset-images-changed", onImagesChanged);
      events.close();
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
    };
  }, [loadImages, loadPreviewPhotoFolders, projectId]);

  useEffect(() => {
    return () => {
      for (const u of optimisticPreviewUrlsRef.current.values()) {
        URL.revokeObjectURL(u);
      }
      optimisticPreviewUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!assetSearchOpen) return;
    const timer = window.setTimeout(() => assetSearchInputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [assetSearchOpen]);

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
    const rootNode = createFolderNode("صور الأصول", "__pv_root__");
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
    if (selectedPreviewFolderNode.path === "__pv_root__") return [];
    return selectedPreviewFolderNode.images;
  }, [selectedPreviewFolderNode, appPreviewMediaTab]);
  const selectedDeviceNodeFiles = useMemo(() => collectFolderImages(selectedFolder), [selectedFolder]);

  /** صور المجلد المختار مباشرة فقط؛ الجذر يعرض المجلدات ولا يعرض صورًا منفردة. */
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
  const activeContentNode = selectedPreviewFolderNode;
  const activeContentFolders = activeContentNode?.folders ?? [];
  const activeContentFiles = previewAppGridFiles;
  const activeBreadcrumbNodes = useMemo(
    () => (activeContentNode ? findFolderNodePath(previewRoot, activeContentNode.path) : []),
    [activeContentNode, previewRoot],
  );
  const activeParentBreadcrumbNode =
    activeBreadcrumbNodes.length > 1 ? activeBreadcrumbNodes[activeBreadcrumbNodes.length - 2] : null;
  const assetSearchRows = useMemo<AssetImagesSearchResult[]>(() => {
    const rows: AssetImagesSearchResult[] = [];
    const compactChips = (chips: Array<string | null | undefined | false>) =>
      chips.filter((chip): chip is string => Boolean(chip && chip.trim()));

    const visit = (
      node: ImageFolderNode,
      parentNames: string[],
      parentIds: string[],
      includeNode: boolean,
    ): number => {
      const nodeNames = includeNode ? [...parentNames, node.name] : parentNames;
      const nodeIds = includeNode ? [...parentIds, node.path] : parentIds;
      const nodeLocation = nodeNames.length > 0 ? nodeNames.join(" / ") : previewRoot.name;
      let latestMs = 0;

      for (const file of node.images) {
        const title = fileNameFromPath(file.relativePath || file.name);
        const pathLabel = file.relativePath || file.name;
        const recentAtMs = assetFileRecentAtMs(file);
        const recentLabel = formatAssetSearchDate(recentAtMs);
        const chips = compactChips([
          "صورة",
          isDisplayOnlyPicAssetImage(file) ? "من بيانات الأصل" : "ملف محفوظ",
          file.includeInReport === true ? "ضمن التقرير" : "خارج التقرير",
          recentLabel ? `أضيفت ${recentLabel}` : null,
        ]);
        const searchText = [
          title,
          pathLabel,
          nodeLocation,
          node.name,
          file.folderPath,
          file.mimeType,
          file._id,
          file.downloadFileId,
          file.sourceUrl,
          file.picAssetId,
          file.picAssetSubProjectId,
          file.displayOrder,
          file.sizeBytes,
          chips.join(" "),
        ].join(" ");

        latestMs = Math.max(latestMs, recentAtMs);
        rows.push({
          id: `image:${file._id}`,
          kind: "image",
          title,
          subtitle: nodeLocation,
          chips,
          normalizedTitle: normalizeAssetSearchText(title),
          normalizedPath: normalizeAssetSearchText(pathLabel),
          normalizedSearchText: normalizeAssetSearchText(searchText),
          recentAtMs,
          folderIdPath: nodeIds,
          selectFolderId: node.path,
          file,
        });
      }

      for (const child of node.folders) {
        latestMs = Math.max(latestMs, visit(child, nodeNames, nodeIds, true));
      }

      if (includeNode) {
        const folderCount = countDescendantFolders(node);
        const recentLabel = formatAssetSearchDate(latestMs);
        const chips = compactChips([
          "مجلد",
          `${numberFormatter.format(node.imageCount)} صورة`,
          folderCount > 0 ? `${numberFormatter.format(folderCount)} مجلد` : null,
          node.sheetName ? `شيت ${node.sheetName}` : null,
          recentLabel ? `آخر إضافة ${recentLabel}` : null,
        ]);
        const parentLocation = parentNames.length > 0 ? parentNames.join(" / ") : previewRoot.name;
        const searchText = [
          node.name,
          node.path,
          parentLocation,
          node.sheetName,
          node.importId,
          node.imageCount,
          folderCount,
          chips.join(" "),
        ].join(" ");

        rows.push({
          id: `folder:${node.path}`,
          kind: "folder",
          title: node.name,
          subtitle: parentLocation,
          chips,
          normalizedTitle: normalizeAssetSearchText(node.name),
          normalizedPath: normalizeAssetSearchText(`${parentLocation} / ${node.name} / ${node.path}`),
          normalizedSearchText: normalizeAssetSearchText(searchText),
          recentAtMs: latestMs,
          folderIdPath: nodeIds,
          selectFolderId: node.path,
        });
      }

      return latestMs;
    };

    visit(previewRoot, [previewRoot.name], ["__pv_root__"], false);
    return rows;
  }, [previewRoot]);
  const assetSearchStats = useMemo(
    () => ({
      folders: assetSearchRows.filter((row) => row.kind === "folder").length,
      images: assetSearchRows.filter((row) => row.kind === "image").length,
    }),
    [assetSearchRows],
  );
  const assetSearchResults = useMemo(() => {
    if (!appliedAssetSearch) return [];

    const normalizedQuery = normalizeAssetSearchText(appliedAssetSearch.query);
    const terms = assetSearchTerms(appliedAssetSearch.query);
    const hasQuery = terms.length > 0;
    const candidates = assetSearchRows.filter((row) => {
      if (appliedAssetSearch.mode === "recent" && row.recentAtMs <= 0) return false;
      if (appliedAssetSearch.kind !== "all" && row.kind !== appliedAssetSearch.kind) return false;
      if (!hasQuery && appliedAssetSearch.mode === "all" && appliedAssetSearch.kind === "all") return false;
      if (!hasQuery) return true;
      return terms.every((term) => row.normalizedSearchText.includes(term));
    });
    const maxResults = hasQuery ? 120 : 80;

    return candidates
      .map((row) => ({
        row,
        score: scoreAssetSearchResult(row, normalizedQuery, terms),
      }))
      .sort((a, b) => {
        if (hasQuery && b.score !== a.score) return b.score - a.score;
        if (b.row.recentAtMs !== a.row.recentAtMs) return b.row.recentAtMs - a.row.recentAtMs;
        if (a.row.kind !== b.row.kind) return a.row.kind === "folder" ? -1 : 1;
        return a.row.title.localeCompare(b.row.title, "ar", { numeric: true, sensitivity: "base" });
      })
      .slice(0, maxResults)
      .map(({ row }) => row);
  }, [appliedAssetSearch, assetSearchRows]);
  const appliedAssetSearchTitle = useMemo(() => {
    if (!appliedAssetSearch) return "";
    const query = appliedAssetSearch.query.trim();
    const kindLabel =
      appliedAssetSearch.kind === "folder"
        ? "المجلدات فقط"
        : appliedAssetSearch.kind === "image"
          ? "الصور فقط"
          : "";
    const suffix = kindLabel ? ` - ${kindLabel}` : "";
    if (appliedAssetSearch.mode === "recent" && query) return `المضاف مؤخراً المطابق لـ «${query}»${suffix}`;
    if (appliedAssetSearch.mode === "recent") return `المضاف مؤخراً${suffix}`;
    if (query) return `نتائج البحث عن «${query}»${suffix}`;
    return `نتائج البحث${suffix}`;
  }, [appliedAssetSearch]);
  const applyAssetSearch = useCallback(() => {
    const query = assetSearchQuery.trim();
    if (assetSearchMode === "all" && assetSearchKind === "all" && !query) {
      toast({ variant: "destructive", description: "اكتب عبارة بحث أو اختر المضاف مؤخراً أو حدد نوع النتائج قبل التطبيق." });
      return;
    }
    setAppliedAssetSearch({ query, mode: assetSearchMode, kind: assetSearchKind });
    setAssetSearchOpen(false);
  }, [assetSearchKind, assetSearchMode, assetSearchQuery, toast]);
  const clearAppliedAssetSearch = useCallback(() => {
    setAppliedAssetSearch(null);
  }, []);

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

  const rememberPreviewFolder = useCallback((created: MvSubProject) => {
    const entry = { sub: created, picAsset: created.picAsset ?? null };
    recentlyCreatedPreviewFoldersRef.current.set(created._id, entry);
    setPreviewPhotoFolders((current) => {
      const createdPicId = created.picAsset?._id;
      const exists = current.some(
        (row) => row.sub._id === created._id || (createdPicId ? row.picAsset?._id === createdPicId : false),
      );
      if (!exists) return [...current, entry];
      return current.map((row) =>
        row.sub._id === created._id || (createdPicId ? row.picAsset?._id === createdPicId : false) ? entry : row,
      );
    });
  }, []);

  const createPreviewFolderOnServer = useCallback(async (name: string, parentId: string) => {
    const response = await fetch(`/api/mv/projects/${projectId}/subprojects`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent: parentId }),
    });
    if (!response.ok) throw new Error("create_failed");
    return (await response.json()) as MvSubProject;
  }, [projectId]);

  const uploadImagesToPicFolder = useCallback(
    async (
      picFolderId: string,
      folderDisplayName: string,
      picked: PickedImageFile[],
      options?: { onProgress?: (patch: AssetUploadProgressPatch) => void },
    ) => {
      const imageFiles = picked.filter((item) => isLikelyImage(item.file));
      if (imageFiles.length === 0) {
        toast({ variant: "destructive", description: "لم يتم العثور على صور صالحة للرفع." });
        return;
      }

      const groupTotal = imageFiles.length;
      let jobId: string | null = null;
      if (!options?.onProgress) {
        jobId = startAssetUploadJob({
          kind: "images",
          label: `${numberFormatter.format(groupTotal)} صورة`,
          total: groupTotal,
          phase: "رفع الصور…",
          folderName: folderDisplayName,
        });
      }

      const report = (patch: AssetUploadProgressPatch) => {
        if (options?.onProgress) {
          options.onProgress(patch);
          return;
        }
        if (!jobId) return;
        const progress =
          patch.groupTotal > 0
            ? Math.min(99, Math.round((patch.completedInGroup / patch.groupTotal) * 100))
            : 0;
        updateAssetUploadJob(jobId, {
          phase: patch.phase,
          current: patch.completedInGroup,
          total: patch.groupTotal,
          progress,
          folderName: folderDisplayName,
          label: `«${folderDisplayName}» — ${numberFormatter.format(patch.completedInGroup)} / ${numberFormatter.format(patch.groupTotal)} صورة`,
        });
      };

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
          const completedInGroup = Math.min(groupTotal, i + slice.length);
          report({
            phase: `معاينة صور «${folderDisplayName}» (${numberFormatter.format(completedInGroup)}/${numberFormatter.format(groupTotal)})`,
            completedInGroup,
            groupTotal,
          });
          if (shouldYieldPreviewUiChunk(i, imageFiles.length)) {
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
        (uploaded, total) => {
          report({
            phase: `رفع «${folderDisplayName}» إلى الخادم (${numberFormatter.format(uploaded)}/${numberFormatter.format(total)})`,
            completedInGroup: uploaded,
            groupTotal: total,
          });
        },
      );

      try {
        const [, uploadedRows] = await Promise.all([streamLocalPreviewsToUi(), persistToServer]);
        if (jobId) {
          updateAssetUploadJob(jobId, {
            progress: 100,
            state: "done",
            phase: "اكتمل الرفع",
            current: groupTotal,
            total: groupTotal,
          });
        }
        setFiles((prev) => replaceLocalPreviewRowsWithServer(prev, uploadedRows, sessionLocalIds));
        revokeOptimisticUrls(sessionLocalIds);
        if (!options?.onProgress) {
          toast({
            description: `تم حفظ ${numberFormatter.format(uploadedRows.length)} صورة في المجلد.`,
          });
          await loadPreviewPhotoFolders("revalidate");
          removeAssetUploadJobLater(jobId!);
        }
      } catch (error) {
        if (jobId) {
          updateAssetUploadJob(jobId, { progress: 100, state: "error", phase: "تعذر الرفع" });
          removeAssetUploadJobLater(jobId, 6000);
        }
        setFiles((prev) => prev.filter((f) => !sessionLocalIds.includes(f._id)));
        revokeOptimisticUrls(sessionLocalIds);
        if (!options?.onProgress) {
          toast({
            variant: "destructive",
            description: error instanceof Error ? error.message : "تعذر رفع الصور.",
          });
        }
        throw error;
      } finally {
        if (filePickInputRef.current) filePickInputRef.current.value = "";
        if (folderPickInputRef.current) folderPickInputRef.current.value = "";
      }
    },
    [loadPreviewPhotoFolders, projectId, removeAssetUploadJobLater, revokeOptimisticUrls, startAssetUploadJob, toast, updateAssetUploadJob],
  );

  const ensurePreviewFolderPath = useCallback(
    async (baseParentId: string, parts: string[], baseSelectionId = baseParentId) => {
      let parentUploadId = baseParentId;
      let parentSelectionId = baseSelectionId;
      let folderName = "";
      let selectionFolderId = "";

      const known = new Map<
        string,
        { uploadFolderId: string; selectionFolderId: string; name: string }
      >();
      previewPhotoFolders.forEach((row) => {
        const parent = row.sub.parent?.trim();
        const name = cleanPathPart(row.sub.name);
        if (!parent || !name) return;
        known.set(`${parent}\u0000${name}`, {
          uploadFolderId: row.picAsset?._id ?? row.sub._id,
          selectionFolderId: row.sub._id,
          name,
        });
      });

      for (const rawPart of parts) {
        const name = cleanPathPart(rawPart);
        if (!name) continue;
        folderName = name;
        const existing =
          known.get(`${parentUploadId}\u0000${name}`) ??
          known.get(`${parentSelectionId}\u0000${name}`);
        if (existing) {
          parentUploadId = existing.uploadFolderId;
          parentSelectionId = existing.selectionFolderId;
          selectionFolderId = existing.selectionFolderId;
          continue;
        }

        const createdFolder = await createPreviewFolderOnServer(name, parentUploadId);
        rememberPreviewFolder(createdFolder);
        const created = {
          uploadFolderId: createdFolder.picAsset?._id ?? createdFolder._id,
          selectionFolderId: createdFolder._id,
          name,
        };
        known.set(`${parentUploadId}\u0000${name}`, created);
        known.set(`${parentSelectionId}\u0000${name}`, created);
        parentUploadId = created.uploadFolderId;
        parentSelectionId = created.selectionFolderId;
        selectionFolderId = created.selectionFolderId;
      }

      return {
        uploadFolderId: parentUploadId,
        selectionFolderId: selectionFolderId || parentSelectionId,
        folderName: folderName || "صور الأصول",
      };
    },
    [createPreviewFolderOnServer, previewPhotoFolders, rememberPreviewFolder],
  );

  const uploadImagesToActivePreviewLocation = useCallback(
    async (picked: PickedImageFile[], targetNode = selectedPreviewFolderNode) => {
      const imageFiles = picked.filter((item) => isLikelyImage(item.file));
      if (imageFiles.length === 0) {
        toast({ variant: "destructive", description: "لم يتم العثور على صور صالحة للرفع." });
        return;
      }

      const targetFolderId = targetNode?.path ?? selectedPreviewFolderId;
      const isRootSelected = targetFolderId === "__pv_root__";
      const baseParentId = targetNode?.picAssetId ?? (isRootSelected ? photosRootId : null);
      if (!baseParentId) {
        toast({
          variant: "destructive",
          description: "اختر مجلدًا فعليًا داخل صور الأصول قبل الرفع.",
        });
        return;
      }

      const totalImages = imageFiles.length;
      const isFolderBatchUpload = imageFiles.some((item) => folderPartsFromPickedImage(item).length > 0);
      const firstFolderParts = imageFiles.map(folderPartsFromPickedImage).find((parts) => parts.length > 0);
      const rootFolderLabel = firstFolderParts?.[0] ?? targetNode?.name ?? "صور الأصول";

      const jobId = startAssetUploadJob({
        kind: isFolderBatchUpload ? "folder" : "images",
        label: isFolderBatchUpload
          ? `مجلد «${rootFolderLabel}»`
          : `${numberFormatter.format(totalImages)} صورة`,
        total: totalImages,
        phase: isFolderBatchUpload ? "تجهيز المجلد والصور…" : "رفع الصور…",
        folderName: isFolderBatchUpload ? rootFolderLabel : targetNode?.name,
      });

      let serverUploadedCount = 0;
      const pushGlobalProgress = (phase: string, folderName?: string, uploaded = serverUploadedCount) => {
        serverUploadedCount = uploaded;
        const progress = totalImages > 0 ? Math.min(99, Math.round((uploaded / totalImages) * 100)) : 0;
        updateAssetUploadJob(jobId, {
          phase,
          current: uploaded,
          total: totalImages,
          progress,
          folderName: folderName ?? rootFolderLabel,
          label: isFolderBatchUpload
            ? folderName && folderName !== rootFolderLabel
              ? `«${rootFolderLabel}» / «${folderName}»`
              : `مجلد «${rootFolderLabel}»`
            : `${numberFormatter.format(uploaded)} / ${numberFormatter.format(totalImages)} صورة`,
        });
      };

      pushGlobalProgress(
        isFolderBatchUpload ? "تجهيز المجلد والصور…" : "تحضير رفع الصور…",
        isFolderBatchUpload ? rootFolderLabel : targetNode?.name,
        0,
      );

      const groups = new Map<
        string,
        {
          uploadFolderId: string;
          selectionFolderId: string;
          folderName: string;
          files: PickedImageFile[];
        }
      >();
      const folderTargetCache = new Map<
        string,
        { uploadFolderId: string; selectionFolderId: string; folderName: string }
      >();
      let skippedRootFiles = 0;

      for (const item of imageFiles) {
        const folderParts = folderPartsFromPickedImage(item);
        const fileName = fileNameFromPath(item.relativePath || item.file.name);
        let target: {
          uploadFolderId: string;
          selectionFolderId: string;
          folderName: string;
        } | null = null;

        if (folderParts.length > 0) {
          const cacheKey = folderParts.join("\u0000");
          const cached = folderTargetCache.get(cacheKey);
          if (cached) {
            target = cached;
          } else {
            const creatingLabel = folderParts[folderParts.length - 1] ?? rootFolderLabel;
            pushGlobalProgress(`إنشاء المجلد «${creatingLabel}»…`, creatingLabel, serverUploadedCount);
            target = await ensurePreviewFolderPath(
              baseParentId,
              folderParts,
              targetNode?.path ?? baseParentId,
            );
            folderTargetCache.set(cacheKey, target);
          }
        } else if (targetNode?.picAssetId) {
          target = {
            uploadFolderId: targetNode.picAssetId,
            selectionFolderId: targetNode.path,
            folderName: targetNode.name,
          };
        } else {
          skippedRootFiles += 1;
          continue;
        }

        const key = target.uploadFolderId;
        const group = groups.get(key) ?? {
          uploadFolderId: target.uploadFolderId,
          selectionFolderId: target.selectionFolderId,
          folderName: target.folderName,
          files: [],
        };
        group.files.push({
          file: item.file,
          relativePath: fileName,
        });
        groups.set(key, group);
      }

      if (skippedRootFiles > 0) {
        toast({
          variant: "destructive",
          description: "لا يمكن رفع صور مباشرة في الجذر. اختر مجلدًا أو ارفع مجلدًا كاملًا.",
        });
      }

      const uploadGroups = Array.from(groups.values());
      if (uploadGroups.length === 0) {
        updateAssetUploadJob(jobId, { progress: 100, state: "error", phase: "لا توجد صور للرفع" });
        removeAssetUploadJobLater(jobId, 4000);
        return;
      }

      try {
        pushGlobalProgress("بدء رفع الصور…", rootFolderLabel, serverUploadedCount);

        for (const group of uploadGroups) {
          const groupOffset = serverUploadedCount;
          await uploadImagesToPicFolder(group.uploadFolderId, group.folderName, group.files, {
            onProgress: (patch) => {
              const onServer = patch.phase.includes("الخادم");
              pushGlobalProgress(
                patch.phase,
                group.folderName,
                onServer
                  ? Math.min(totalImages, groupOffset + patch.completedInGroup)
                  : serverUploadedCount,
              );
            },
          });
          serverUploadedCount = Math.min(totalImages, groupOffset + group.files.length);
          pushGlobalProgress(
            `اكتمل مجلد «${group.folderName}»`,
            group.folderName,
            serverUploadedCount,
          );
        }

        updateAssetUploadJob(jobId, {
          progress: 100,
          state: "done",
          phase: isFolderBatchUpload ? "اكتمل رفع المجلد" : "اكتمل رفع الصور",
          current: totalImages,
          total: totalImages,
          folderName: isFolderBatchUpload ? rootFolderLabel : targetNode?.name,
        });
        toast({
          description: isFolderBatchUpload
            ? `تم حفظ ${numberFormatter.format(totalImages)} صورة في مجلد «${rootFolderLabel}».`
            : `تم حفظ ${numberFormatter.format(totalImages)} صورة.`,
        });
        if (uploadGroups.length === 1) {
          setSelectedPreviewFolderId(uploadGroups[0]!.selectionFolderId);
        }
        await Promise.all([loadPreviewPhotoFolders("revalidate"), loadImages("revalidate")]);
        removeAssetUploadJobLater(jobId);
      } catch (error) {
        updateAssetUploadJob(jobId, {
          progress: 100,
          state: "error",
          phase: "تعذر رفع المجلد",
        });
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "تعذر رفع المجلد والصور.",
        });
        removeAssetUploadJobLater(jobId, 6000);
      } finally {
        if (filePickInputRef.current) filePickInputRef.current.value = "";
        if (folderPickInputRef.current) folderPickInputRef.current.value = "";
      }
    },
    [
      ensurePreviewFolderPath,
      loadImages,
      loadPreviewPhotoFolders,
      photosRootId,
      removeAssetUploadJobLater,
      selectedPreviewFolderId,
      selectedPreviewFolderNode,
      startAssetUploadJob,
      toast,
      updateAssetUploadJob,
      uploadImagesToPicFolder,
    ],
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
      void uploadImagesToActivePreviewLocation(picked);
    },
    [uploadImagesToActivePreviewLocation],
  );

  const selectionFolderIdForParent = useCallback(
    (parentId: string) => {
      if (photosRootId && parentId === photosRootId) return "__pv_root__";
      const parentNode = Array.from(previewFoldersById.values()).find(
        (node) => node.path === parentId || node.picAssetId === parentId,
      );
      return parentNode?.path ?? (previewFoldersById.has(parentId) ? parentId : "__pv_root__");
    },
    [photosRootId, previewFoldersById],
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
      const createdFolder = await createPreviewFolderOnServer(name, targetParentId);
      rememberPreviewFolder(createdFolder);
      const parentSelectionId = selectionFolderIdForParent(targetParentId);
      setSelectedPreviewFolderId(parentSelectionId);
      setExpandedPreviewIds((current) => {
        const next = new Set(current);
        next.add("__pv_root__");
        next.add(parentSelectionId);
        return next;
      });
      toast({ description: "تم إنشاء المجلد." });
    } catch {
      toast({ variant: "destructive", description: "تعذر إنشاء المجلد." });
    } finally {
      setCreatingPreviewFolder(false);
    }
  }, [
    createPreviewFolderOnServer,
    photosRootId,
    rememberPreviewFolder,
    selectionFolderIdForParent,
    toast,
  ]);

  const activeCreateParentId =
    selectedPreviewFolderNode?.picAssetId ??
    (selectedPreviewFolderId === "__pv_root__" ? photosRootId : null);

  const createFolderInActiveLocation = useCallback(() => {
    if (!activeCreateParentId) {
      toast({
        variant: "destructive",
        description: "اختر مجلدًا فعليًا داخل صور الأصول أو افتح الجذر لإنشاء مجلد جديد.",
      });
      return;
    }
    void createPreviewFolder(activeCreateParentId);
  }, [activeCreateParentId, createPreviewFolder, toast]);

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

  const deletePreviewFolder = useCallback(
    async (folder: ImageFolderNode) => {
      if (folder.path === "__pv_root__" || folder.isSynthetic || !folder.picAssetId) {
        toast({
          variant: "destructive",
          description: "لا يمكن حذف هذا المجلد الافتراضي.",
        });
        return;
      }

      const imageCount = collectFolderImages(folder).length;
      const folderCount = countDescendantFolders(folder);
      const warning =
        imageCount > 0 || folderCount > 0
          ? `المجلد «${folder.name}» يحتوي على ${numberFormatter.format(imageCount)} صورة و${numberFormatter.format(folderCount)} مجلد فرعي. هل تريد حذف المجلد وكل محتواه؟`
          : `هل تريد حذف المجلد «${folder.name}»؟`;
      if (!window.confirm(warning)) return;

      const parentId = previewPhotoFolders.find((row) => row.sub._id === folder.path)?.sub.parent ?? null;
      const nextSelection = parentId && previewFoldersById.has(parentId) ? parentId : "__pv_root__";

      try {
        setDeleting(true);
        const response = await fetch(`/api/mv/projects/${projectId}/subprojects/${folder.path}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!response.ok) throw new Error("delete_failed");

        if (selectedPreviewFolderId && folderContainsPath(folder, selectedPreviewFolderId)) {
          setSelectedPreviewFolderId(nextSelection);
        }
        await Promise.all([loadPreviewPhotoFolders("revalidate"), loadImages("revalidate")]);
        toast({ description: "تم حذف المجلد." });
      } catch {
        toast({ variant: "destructive", description: "تعذر حذف المجلد." });
      } finally {
        setDeleting(false);
      }
    },
    [
      loadImages,
      loadPreviewPhotoFolders,
      previewFoldersById,
      previewPhotoFolders,
      projectId,
      selectedPreviewFolderId,
      toast,
    ],
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

  const resolveReportSelectedDragIds = useCallback(
    (draggedId: string, scopeFiles: Array<AssetImageViewFile | MvDriveFile>) => {
      const selected: string[] = [];
      for (const file of scopeFiles) {
        const displayOnly = isDisplayOnlyPicAssetImage(file as AssetImageViewFile);
        const effectiveId = displayOnly ? effectiveDriveFileId(file as AssetImageViewFile) : file._id;
        if (!effectiveId || isLocalPreviewDriveId(effectiveId)) continue;
        const included = displayOnly
          ? (file as AssetImageViewFile).includeInReport === true
          : isReportImageIncluded(filesById.get(effectiveId) ?? (file as MvDriveFile));
        if (included) selected.push(effectiveId);
      }
      if (selected.includes(draggedId) && selected.length > 1) return selected;
      return [draggedId];
    },
    [filesById],
  );

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

  const placeAssetImages = useCallback(
    async (
      fileIds: string[],
      targetFolderPath: string,
      insertBeforeFileId: string | null,
      targetPicAssetFolderId?: string | null,
    ) => {
      const unique = [...new Set(fileIds.filter(Boolean))];
      if (unique.length === 0) return;
      if (unique.length === 1) {
        await placeAssetImage(unique[0]!, targetFolderPath, insertBeforeFileId, targetPicAssetFolderId);
        return;
      }
      for (const fileId of unique) {
        await placeAssetImage(fileId, targetFolderPath, insertBeforeFileId, targetPicAssetFolderId);
      }
    },
    [placeAssetImage],
  );

  const onTreeDragOverAsset = useCallback((e: DragEvent) => {
    if (!assetDragPayloadActive(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDropOnFolderPath = useCallback(
    (targetPath: string) => (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (reorderSaving || dragging) return;
      const fids = parseAssetDragFileIds(e);
      if (fids.length === 0) return;
      void placeAssetImages(fids, targetPath, null);
    },
    [dragging, placeAssetImages, reorderSaving],
  );

  const handleDropBeforeTreeImage = useCallback(
    (anchor: MvDriveFile) => (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (reorderSaving || dragging) return;
      const fids = parseAssetDragFileIds(e);
      if (fids.length === 0) return;
      const fp = folderPathFromRelativePath(anchor.relativePath || anchor.name);
      void placeAssetImages(fids, fp, anchor._id);
    },
    [dragging, placeAssetImages, reorderSaving],
  );

  const handleDropBeforePreviewTreeImage = useCallback(
    (anchor: AssetImageViewFile) => (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (reorderSaving || draggingPreview) return;
      const fids = parseAssetDragFileIds(e);
      if (fids.length === 0) return;
      const fp = driveFileFolderPath(anchor);
      void placeAssetImages(fids, fp, anchor._id, anchor.picAssetId ?? undefined);
    },
    [draggingPreview, placeAssetImages, reorderSaving],
  );

  const handleDropOnPreviewFolderRow = useCallback(
    (folderId: string, folderDisplayName: string) => (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (reorderSaving || draggingPreview) return;
      const fids = parseAssetDragFileIds(e);
      if (fids.length === 0) return;
      const destNode = previewFoldersById.get(folderId);
      if (!destNode?.picAssetId) return;
      const firstFile = destNode.images[0];
      const targetPath =
        destNode && firstFile ? driveFileFolderPath(firstFile) : previewFolderBasePath(folderDisplayName);
      void placeAssetImages(fids, targetPath, null, destNode.picAssetId);
    },
    [draggingPreview, placeAssetImages, previewFoldersById, reorderSaving],
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

  const openAssetSearchResult = useCallback((result: AssetImagesSearchResult) => {
    setAssetSearchOpen(false);
    setAppliedAssetSearch(null);
    setAssetImagesSource("app");
    setAppPreviewMediaTab("images");
    setSelectedPreviewFolderId(result.selectFolderId);
    setExpandedPreviewIds((current) => {
      const next = new Set(current);
      next.add("__pv_root__");
      result.folderIdPath.forEach((id) => next.add(id));
      return next;
    });
    setLightboxFile(result.kind === "image" && result.file ? result.file : null);
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
    if (!selectedPreviewFolderNode || selectedPreviewFolderNode.path === "__pv_root__") {
      toast({ variant: "destructive", description: "اختر مجلدًا داخل صور الأصول لحذف صوره." });
      return;
    }
    const nodeFiles = selectedPreviewFolderNode.images.filter((file) => !isDisplayOnlyPicAssetImage(file));
    if (nodeFiles.length === 0) {
      toast({ variant: "destructive", description: "لا توجد صور مباشرة قابلة للحذف في هذا المجلد." });
      return;
    }
    void deleteFileIds(
      nodeFiles.map((f) => f._id),
      "تم حذف صور مجلد المعاينة الحالي.",
    );
  }, [deleteFileIds, selectedPreviewFolderNode, toast]);

  const renderTreeImage = (file: MvDriveFile, level = 0, scopeFiles: MvDriveFile[] = []) => {
    const selected = isReportImageIncluded(file);
    const canDragPlace = !isLocalPreviewDriveId(file._id) && !reorderSaving;
    const displayOnly = false;
    const canMutate = true;
    const dragScope = scopeFiles.length > 0 ? scopeFiles : [file];

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
          writeAssetDragFileIds(e, resolveReportSelectedDragIds(file._id, dragScope));
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
            {node.images.map((file) => renderTreeImage(file, level + 2, node.images))}
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
        {root.images.map((file) => renderTreeImage(file, 0, root.images))}
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
          const scope = selectedPreviewFolderNode?.images ?? [file];
          writeAssetDragFileIds(e, resolveReportSelectedDragIds(effectiveId!, scope));
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
            if (treeMedia === "images" && isFileUploadDrag(e.dataTransfer)) {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "copy";
              return;
            }
            if (reorderSaving || draggingPreview) return;
            onTreeDragOverAsset(e);
          }}
          onDrop={async (e: DragEvent) => {
            if (treeMedia === "images" && isFileUploadDrag(e.dataTransfer)) {
              e.preventDefault();
              e.stopPropagation();
              const picked = await collectDroppedImages(e.dataTransfer);
              void uploadImagesToActivePreviewLocation(picked, node);
              return;
            }
            if (reorderSaving || draggingPreview || !node.picAssetId || treeMedia === "videos") return;
            handleDropOnPreviewFolderRow(node.path, node.name)(e);
          }}
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
            <DropdownMenuContent align="end" className="w-52 text-right">
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
              {node.picAssetId && treeMedia === "images" ? (
                <DropdownMenuItem
                  onSelect={() => void deletePreviewFolder(node)}
                  disabled={deleting}
                  className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                  حذف المجلد
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
    const appExpanded = expandedPreviewIds.has("__pv_root__");
    const appActive =
      selectedPreviewFolderId === "__pv_root__" &&
      appPreviewMediaTab === "images";

    return (
      <div className="space-y-1">
        <div className="rounded-md border border-emerald-100 bg-white">
          <div className="flex items-center gap-1 px-1 py-1">
            <button
              type="button"
              onClick={() => togglePreviewExpanded("__pv_root__")}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50"
              aria-label={appExpanded ? "طي صور الأصول" : "فتح صور الأصول"}
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
              <span className="min-w-0 flex-1 truncate">صور الأصول</span>
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
                  لا توجد مجلدات صور بعد
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
            void loadPreviewPhotoFolders("revalidate");
            void loadAssetImportSummary();
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
          onSelect={deleteCurrentPreviewPathImages}
          disabled={
            activeContentFiles.length === 0 || deleting || selectedPreviewFolderId === "__pv_root__"
          }
          className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
          حذف صور المسار الحالي
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const activePathBar = activeContentNode ? (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 rounded-lg border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          disabled={!activeParentBreadcrumbNode}
          onClick={() => {
            if (activeParentBreadcrumbNode) selectPreviewFolder(activeParentBreadcrumbNode.path, "images");
          }}
          title="رجوع خطوة للأعلى"
          aria-label="رجوع خطوة للأعلى"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <div className="flex min-w-0 items-center gap-1 text-[11px] font-bold text-slate-500">
          {activeBreadcrumbNodes.map((node, idx) => {
            const isLast = idx === activeBreadcrumbNodes.length - 1;
            return (
              <div key={`crumb-${node.path}`} className="flex min-w-0 items-center gap-1">
                {idx > 0 ? <span className="text-slate-300">/</span> : null}
                <button
                  type="button"
                  onClick={() => selectPreviewFolder(node.path, "images")}
                  className={cn(
                    "max-w-[180px] truncate rounded-md px-2 py-1 transition hover:bg-emerald-50 hover:text-emerald-800",
                    isLast ? "bg-emerald-50 text-emerald-900" : "text-slate-600",
                  )}
                  dir="auto"
                  title={node.name}
                >
                  {idx === 0 ? "صور الأصول" : node.name}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tabular-nums text-slate-500">
        {numberFormatter.format(activeContentNode.imageCount)} صورة
      </span>
    </div>
  ) : null;

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
                onChange={(event) => handleActiveTargetInputFiles(event.target.files)}
              />
              <input
                ref={folderPickInputRef}
                type="file"
                className="hidden"
                multiple
                {...({
                  webkitdirectory: "",
                } as Record<string, unknown>)}
                onChange={(event) => handleActiveTargetInputFiles(event.target.files)}
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
                  const picked = await collectDroppedImages(event.dataTransfer);
                  void uploadImagesToActivePreviewLocation(picked);
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
                        title="إنشاء مجلد جديد داخل المكان الحالي"
                        aria-label="إنشاء مجلد جديد داخل المكان الحالي"
                        disabled={!activeCreateParentId || creatingPreviewFolder}
                        onClick={createFolderInActiveLocation}
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

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 shrink-0 gap-2 border-slate-200 bg-white px-3 text-[12px] font-extrabold text-slate-800 shadow-sm hover:border-emerald-300 hover:bg-emerald-50"
                        onClick={() => {
                          setAssetSearchQuery(appliedAssetSearch?.query ?? "");
                          setAssetSearchMode(appliedAssetSearch?.mode ?? "all");
                          setAssetSearchKind(appliedAssetSearch?.kind ?? "all");
                          setAssetSearchOpen(true);
                        }}
                      >
                        <Search className="h-4 w-4 shrink-0 text-emerald-600" />
                        بحث
                      </Button>
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
                  {!appliedAssetSearch ? activePathBar : null}
                  {appliedAssetSearch ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 shadow-sm">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black text-slate-900" dir="auto">
                            {appliedAssetSearchTitle}
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                            {numberFormatter.format(assetSearchResults.length)} نتيجة مطبقة على مساحة العمل
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                          className="h-8 rounded-lg border-slate-200 bg-white px-3 text-[11px] font-bold"
                            onClick={() => {
                              setAssetSearchQuery(appliedAssetSearch?.query ?? "");
                              setAssetSearchMode(appliedAssetSearch?.mode ?? "all");
                              setAssetSearchKind(appliedAssetSearch?.kind ?? "all");
                              setAssetSearchOpen(true);
                            }}
                          >
                            <Search className="h-3.5 w-3.5" />
                            تعديل البحث
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600"
                            onClick={clearAppliedAssetSearch}
                          >
                            مسح
                          </Button>
                        </div>
                      </div>

                      {assetSearchResults.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                          {assetSearchResults.map((result) => (
                            <button
                              key={result.id}
                              type="button"
                              onClick={() => openAssetSearchResult(result)}
                              className="group flex aspect-square min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white text-right shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                            >
                              {result.file ? (
                                <span className="relative block min-h-0 flex-1 overflow-hidden bg-slate-100">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={resolveThumbSrc(result.file) || undefined}
                                    alt=""
                                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                                    loading="lazy"
                                  />
                                </span>
                              ) : (
                                <span className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-amber-50/60 p-3 text-center">
                                  <FolderOpen className="h-10 w-10 text-amber-500 transition group-hover:scale-105" />
                                  <span className="line-clamp-2 text-[12px] font-black text-slate-800" dir="auto">
                                    {result.title}
                                  </span>
                                </span>
                              )}

                              <span className="block w-full min-w-0 px-2 py-2">
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <span className="truncate text-[11px] font-black text-slate-700" dir="auto">
                                    {result.title}
                                  </span>
                                  <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                                    {result.kind === "folder" ? "مجلد" : "صورة"}
                                  </span>
                                </span>
                                <span className="mt-1 block truncate text-[10px] font-semibold text-slate-500" dir="auto">
                                  {result.subtitle}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white">
                          <div className="text-center">
                            <Search className="mx-auto h-10 w-10 text-slate-300" />
                            <p className="mt-2 text-[13px] font-black text-slate-700">لا توجد نتائج لهذا البحث</p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-500">
                              عدّل عبارة البحث أو اختر المضاف مؤخراً من زر البحث.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : !activeContentNode ? (
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
                          {activeContentFolders.map((folder) => {
                            const folderFiles = collectFolderImages(folder);
                            const folderSelected = folderFiles.length > 0 && folderFiles.every(isReportImageIncluded);
                            const folderPartiallySelected = !folderSelected && folderFiles.some(isReportImageIncluded);

                            return (
                              <article
                                key={`content-folder-${folder.path}`}
                                onDragOver={(event) => {
                                  if (isFileUploadDrag(event.dataTransfer)) {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    event.dataTransfer.dropEffect = "copy";
                                    return;
                                  }
                                  if (!folder.picAssetId || reorderSaving || draggingPreview) return;
                                  onTreeDragOverAsset(event);
                                }}
                                onDrop={async (event) => {
                                  if (isFileUploadDrag(event.dataTransfer)) {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    const picked = await collectDroppedImages(event.dataTransfer);
                                    void uploadImagesToActivePreviewLocation(picked, folder);
                                    return;
                                  }
                                  if (!folder.picAssetId || reorderSaving || draggingPreview) return;
                                  handleDropOnPreviewFolderRow(folder.path, folder.name)(event);
                                }}
                                className="group relative flex aspect-square flex-col rounded-lg border border-amber-200 bg-white text-center shadow-sm transition hover:border-amber-300 hover:bg-amber-50/40 hover:shadow-md"
                              >
                                <button
                                  type="button"
                                  onClick={() => selectPreviewFolder(folder.path, appPreviewMediaTab)}
                                  className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-3"
                                >
                                  <FolderOpen className="h-10 w-10 text-amber-500 transition group-hover:scale-105" />
                                  <span className="line-clamp-2 text-[12px] font-extrabold text-slate-700" dir="auto">
                                    {folder.name}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-500">
                                    {numberFormatter.format(folder.imageCount)}
                                  </span>
                                </button>

                                <div className="absolute left-2 top-2 flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => togglePreviewFolderSelection(folder.path)}
                                    className={cn(
                                      "flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-slate-500 shadow-sm transition hover:bg-white",
                                      (folderSelected || folderPartiallySelected) && "text-emerald-700",
                                    )}
                                    aria-label={folderSelected ? "إخفاء من التقرير" : "إظهار في التقرير"}
                                  >
                                    {folderSelected ? (
                                      <CheckSquare className="h-4 w-4" />
                                    ) : folderPartiallySelected ? (
                                      <MinusSquare className="h-4 w-4" />
                                    ) : (
                                      <Square className="h-4 w-4" />
                                    )}
                                  </button>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-900"
                                        aria-label="إجراءات المجلد"
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52 text-right">
                                      <DropdownMenuItem
                                        onSelect={() => selectPreviewFolder(folder.path, appPreviewMediaTab)}
                                        className="cursor-pointer text-[12px]"
                                      >
                                        <FolderOpen className="h-4 w-4 text-amber-600" />
                                        فتح المجلد
                                      </DropdownMenuItem>
                                      {folder.picAssetId ? (
                                        <DropdownMenuItem
                                          onSelect={() => void createPreviewFolder(folder.picAssetId)}
                                          disabled={creatingPreviewFolder}
                                          className="cursor-pointer text-[12px]"
                                        >
                                          <FolderPlus className="h-4 w-4 text-emerald-600" />
                                          إنشاء مجلد داخل هذا المجلد
                                        </DropdownMenuItem>
                                      ) : null}
                                      <DropdownMenuItem
                                        onSelect={() => togglePreviewFolderSelection(folder.path)}
                                        className="cursor-pointer text-[12px]"
                                      >
                                        {folderSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                                        {folderSelected ? "إخفاء من التقرير" : "إظهار في التقرير"}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onSelect={() => deleteFolderImages(folder)}
                                        className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        حذف صور المجلد
                                      </DropdownMenuItem>
                                      {folder.picAssetId ? (
                                        <DropdownMenuItem
                                          onSelect={() => void deletePreviewFolder(folder)}
                                          disabled={deleting}
                                          className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          حذف المجلد
                                        </DropdownMenuItem>
                                      ) : null}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </article>
                            );
                          })}
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
                        const canDragPlace =
                          !displayOnly &&
                          canMutate &&
                          Boolean(effectiveId) &&
                          !isLocalPreviewDriveId(effectiveId!) &&
                          !reorderSaving;
                        const canDragReorder = previewGridCanReorder && canDragPlace;
                        return (
                          <div
                            key={file._id}
                            role="listitem"
                            draggable={canDragPlace}
                            onDragStart={(e: DragEvent) => {
                              if (!canDragPlace || !effectiveId) return;
                              if (canDragReorder) onDragStartImageReorder(imageIdx);
                              writeAssetDragFileIds(
                                e,
                                resolveReportSelectedDragIds(effectiveId, activeContentFiles),
                              );
                            }}
                            onDragEnd={clearGridDragReorderIntent}
                            onDragOver={(e: DragEvent) => {
                              if (reorderSaving || draggingPreview) return;
                              if (!assetDragPayloadActive(e)) return;
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
                              const fids = parseAssetDragFileIds(e);
                              dragReorderFromIdx.current = null;
                              const anchor = activeContentFiles[imageIdx];
                              const anchorEffectiveId =
                                anchor && isDisplayOnlyPicAssetImage(anchor)
                                  ? effectiveDriveFileId(anchor)
                                  : anchor?._id;
                              const anchorEffective = anchorEffectiveId ? filesById.get(anchorEffectiveId) : undefined;
                              if (fids.length === 0 || !anchorEffectiveId || !anchorEffective) return;
                              const targetPath = driveFileFolderPath(anchorEffective);
                              if (!targetPath) return;
                              void placeAssetImages(
                                fids.filter((id) => id !== anchorEffectiveId),
                                targetPath,
                                anchorEffectiveId,
                                (anchorEffective as AssetImageViewFile).picAssetId ?? undefined,
                              );
                            }}
                            className={cn(
                              "group overflow-hidden rounded-lg border bg-white text-right shadow-sm transition hover:border-emerald-300 hover:shadow-md",
                              imageSelected ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200",
                              canDragPlace && "cursor-grab active:cursor-grabbing",
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

      {activeAssetUploadJob ? (
        <MvUploadProgressToast
          phase={activeAssetUploadJob.phase}
          label={activeAssetUploadJob.label}
          progress={activeAssetUploadJob.progress}
          state={activeAssetUploadJob.state}
          detail={
            activeAssetUploadJob.total > 0
              ? activeAssetUploadJob.kind === "folder" && activeAssetUploadJob.folderName
                ? `المجلد: ${activeAssetUploadJob.folderName} · ${numberFormatter.format(activeAssetUploadJob.current)} / ${numberFormatter.format(activeAssetUploadJob.total)}`
                : `${numberFormatter.format(activeAssetUploadJob.current)} / ${numberFormatter.format(activeAssetUploadJob.total)} صورة`
              : null
          }
        />
      ) : null}

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

      <Dialog open={assetSearchOpen} onOpenChange={setAssetSearchOpen}>
        <DialogContent
          dir="rtl"
          className="max-h-[88vh] max-w-3xl overflow-hidden rounded-2xl border-slate-200 bg-white p-0 text-right shadow-2xl"
        >
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-[16px] font-black text-slate-950">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Search className="h-4 w-4" />
              </span>
              بحث صور الأصول
            </DialogTitle>
            <DialogDescription className="mt-1 text-[12px] font-medium leading-6 text-slate-500">
              اكتب عبارة البحث أو اختر المضاف مؤخراً، ثم اضغط تطبيق لعرض النتائج في مساحة الصفحة.
            </DialogDescription>
          </div>

          <div className="space-y-3 px-5 py-4">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                ref={assetSearchInputRef}
                value={assetSearchQuery}
                onChange={(event) => setAssetSearchQuery(event.target.value)}
                placeholder="ابحث باسم الأصل، المجلد، الصورة، الشيت، المسار، أو أي معلومة..."
                className="h-11 rounded-xl border-slate-200 bg-white pr-10 text-[13px] font-semibold shadow-sm focus-visible:ring-emerald-200"
                dir="auto"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setAssetSearchMode("all")}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-extrabold transition",
                    assetSearchMode === "all"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  <Search className="h-3.5 w-3.5" />
                  كل شيء
                </button>
                <button
                  type="button"
                  onClick={() => setAssetSearchMode("recent")}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-extrabold transition",
                    assetSearchMode === "recent"
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  <Clock className="h-3.5 w-3.5" />
                  المضاف مؤخراً
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-500">
                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                  {numberFormatter.format(assetSearchStats.folders)} مجلد
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                  {numberFormatter.format(assetSearchStats.images)} صورة
                </span>
              </div>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setAssetSearchKind("all")}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-extrabold transition",
                  assetSearchKind === "all"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                <Search className="h-3.5 w-3.5" />
                الكل
              </button>
              <button
                type="button"
                onClick={() => setAssetSearchKind("folder")}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-extrabold transition",
                  assetSearchKind === "folder"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                مجلدات فقط
              </button>
              <button
                type="button"
                onClick={() => setAssetSearchKind("image")}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11px] font-extrabold transition",
                  assetSearchKind === "image"
                    ? "bg-white text-slate-950 shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                صور فقط
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-slate-200 bg-white px-5 text-[12px] font-bold"
              onClick={() => setAssetSearchOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              className="h-10 min-w-[130px] rounded-xl bg-emerald-700 px-5 text-[12px] font-extrabold text-white hover:bg-emerald-800"
              onClick={applyAssetSearch}
              disabled={assetSearchMode === "all" && assetSearchKind === "all" && !assetSearchQuery.trim()}
            >
              <Search className="h-4 w-4" />
              تطبيق البحث
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
