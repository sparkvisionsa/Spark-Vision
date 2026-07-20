"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ArrowUp,
  Box,
  CheckSquare,
  Clock,
  Download,
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
  MoveRight,
  PackagePlus,
  Pencil,
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
  
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { MvDialogContent } from "./mv-dialog";
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
import {
  MvReportImagesSelectModal,
  type MvReportSelectAssetSection,
  type MvReportSelectUpdate,
} from "./mv-report-images-select-modal";
import { MvProjectReportHeader } from "./mv-simple-report-navigation";
import type { MvDriveFile, MvProject, MvProjectReportData, MvSubProject, PicAsset, PicAssetImage } from "./types"
import {
  MV_WORKFLOW_SESSION,
  readMvWorkflowSessionJson,
  writeMvWorkflowSessionJson,
  clearMvWorkflowSessionKey,
} from "./mv-workflow-session-cache";
import {
  buildPhotosRootAssetEntries,
  entryHasFullPicAssetMedia,
  fetchPicAssetDetail,
  hydratePicAssetEntriesProgressive,
  mergePicAssetPreferFull,
} from "./mv-pic-asset-progressive-load";
import { MvWorkflowPageFrame, MvWorkflowPageScrollBody } from "./mv-workflow-page-frame";
import { MvUploadProgressToast } from "./mv-upload-progress-toast";
import { MvAssetImagesDownloadButton } from "./mv-asset-images-download-button";
import { mvFetchJson } from "./mv-api-client";
import { useMvI18n, getMvT, readMvLanguage, type MvT } from "./mv-i18n";

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
  includedImageCount: number;
  includedVideoCount: number;
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
  folderKind?: "folder" | "asset";
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
  folderPreviewFile?: AssetImageViewFile | null;
};

type PreviewPhotoFolderEntry = { sub: MvSubProject; picAsset: PicAsset | null };
type PreviewFolderCreateKind = "folder" | "asset";

type AssetImageFilesPage = {
  items: MvDriveFile[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
};

type AssetImageListProgress = {
  active: boolean;
  loaded: number;
  total: number;
  partial: boolean;
};

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

function formatAssetSearchDate(ms: number, dateTimeFormatter: Intl.DateTimeFormat): string {
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

function stableAssetImageSourceUrl(sourceUrl: string): string {
  const raw = sourceUrl.trim();
  try {
    const url = new URL(raw);
    // معاملات الرابط والـ hash قد تتبدل في روابط Spaces الموقعة، لا في الصورة نفسها.
    return `${url.origin.toLowerCase()}${url.pathname}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

/**
 * الصورة قد تملك أكثر من هوية في البيانات القديمة: رابط Spaces، سجل GridFS، أو
 * displayOrder. نحتفظ بكل المفاتيح كي تربط الهوية الواحدة بين المصدرين، بدلاً من
 * اختيار مفتاح واحد (الذي كان يترك `file:*` و`url:*` للصورة نفسها دون تطابق).
 */
function assetImageLogicalKeys(file: AssetImageViewFile, canonicalPicAssetId: string): string[] {
  const keys: string[] = [];
  const sourceUrl = file.sourceUrl?.trim();
  if (sourceUrl) keys.push(`url:${stableAssetImageSourceUrl(sourceUrl)}`);

  const effectiveId = effectiveDriveFileId(file);
  if (effectiveId) keys.push(`file:${effectiveId}`);

  if (typeof file.displayOrder === "number") {
    keys.push(`order:${canonicalPicAssetId}:${file.displayOrder}`);
  }
  if (keys.length === 0) keys.push(`row:${file._id}`);
  return keys;
}

/**
 * يوحّد كل تمثيلات الصورة (Drive/صف العرض/معرّف قديم) مع تفضيل الملف الحقيقي.
 * عند مرور سجل يربط مجموعتين سابقتين بمفتاحين مختلفين، تدمج المجموعتان كذلك.
 */
function dedupeAssetImageViewFiles(
  files: readonly AssetImageViewFile[],
  canonicalPicAssetId: string,
): AssetImageViewFile[] {
  type Entry = { file: AssetImageViewFile; keys: Set<string>; active: boolean };
  const byKey = new Map<string, Entry>();
  const entries: Entry[] = [];

  for (const file of files) {
    const keys = assetImageLogicalKeys(file, canonicalPicAssetId);
    const matches = Array.from(new Set(keys.map((key) => byKey.get(key)).filter((entry): entry is Entry => Boolean(entry))));
    const entry =
      matches.find((candidate) => !isDisplayOnlyPicAssetImage(candidate.file)) ??
      matches[0] ??
      (() => {
        const next: Entry = { file, keys: new Set(), active: true };
        entries.push(next);
        return next;
      })();

    if (isDisplayOnlyPicAssetImage(entry.file) && !isDisplayOnlyPicAssetImage(file)) {
      entry.file = file;
    }
    for (const duplicate of matches) {
      if (duplicate === entry || !duplicate.active) continue;
      if (isDisplayOnlyPicAssetImage(entry.file) && !isDisplayOnlyPicAssetImage(duplicate.file)) {
        entry.file = duplicate.file;
      }
      for (const key of duplicate.keys) {
        entry.keys.add(key);
        byKey.set(key, entry);
      }
      duplicate.active = false;
    }
    for (const key of keys) {
      entry.keys.add(key);
      byKey.set(key, entry);
    }
  }
  return entries.filter((entry) => entry.active).map((entry) => entry.file);
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
  return {
    name,
    path,
    folders: [],
    images: [],
    videos: [],
    imageCount: 0,
    videoCount: 0,
    includedImageCount: 0,
    includedVideoCount: 0,
  };
}

function buildImageTree(files: MvDriveFile[], rootLabel: string) {
  const root = createFolderNode(rootLabel, "");
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
    node.includedImageCount =
      node.images.filter(isReportImageIncluded).length +
      node.folders.reduce((total, folder) => total + folder.includedImageCount, 0);
    node.includedVideoCount =
      node.videos.filter(isReportImageIncluded).length +
      node.folders.reduce((total, folder) => total + folder.includedVideoCount, 0);
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
    let message = getMvT(readMvLanguage())("assetImages.upload.genericFailed");
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
    let message = getMvT(readMvLanguage())("assetImages.upload.genericFailed");
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

function isAssetFolderNode(node: ImageFolderNode): boolean {
  return Boolean(node.picAssetId && !node.isSynthetic);
}

function isManageablePreviewFolderNode(node: ImageFolderNode): boolean {
  return node.path !== "__pv_root__" && !node.isSynthetic;
}

function previewFolderKindLabel(node: ImageFolderNode, t: MvT): string {
  return isAssetFolderNode(node) ? t("assetImages.kind.asset") : t("assetImages.kind.folder");
}

function firstFolderImage(node: ImageFolderNode): AssetImageViewFile | null {
  if (node.images.length > 0) return node.images[0] ?? null;
  for (const child of node.folders) {
    const nested = firstFolderImage(child);
    if (nested) return nested;
  }
  return null;
}

function countDescendantFolders(node: ImageFolderNode): number {
  return node.folders.reduce((sum, folder) => sum + 1 + countDescendantFolders(folder), 0);
}

function countDescendantAssetFolders(node: ImageFolderNode): number {
  return node.folders.reduce(
    (sum, folder) => sum + (isAssetFolderNode(folder) ? 1 : countDescendantAssetFolders(folder)),
    0,
  );
}

function countDescendantRegularFolders(node: ImageFolderNode): number {
  return node.folders.reduce(
    (sum, folder) =>
      isAssetFolderNode(folder) ? sum : sum + 1 + countDescendantRegularFolders(folder),
    0,
  );
}

function previewFolderStatsLabel(
  node: ImageFolderNode,
  t: MvT,
  numberFormatter: Intl.NumberFormat,
): string {
  if (isAssetFolderNode(node)) {
    if (node.includedImageCount > 0) {
      return t("assetImages.meta.imageCountWithReport", {
        count: numberFormatter.format(node.imageCount),
        selected: numberFormatter.format(node.includedImageCount),
      });
    }
    return t("assetImages.meta.imageCount", { count: numberFormatter.format(node.imageCount) });
  }
  return t("assetImages.meta.assetFolderCount", {
    assets: numberFormatter.format(countDescendantAssetFolders(node)),
    folders: numberFormatter.format(countDescendantRegularFolders(node)),
  });
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

/**
 * صور العرض من بيانات الأصل: إن وُجد ملف Drive مرتبط (fileId) فمصدر التحديد
 * للتقرير هو metadata الملف؛ وإلا includeInReport على عنصر الأصل (روابط خارجية).
 */
function isAssetViewFileReportIncluded(
  file: AssetImageViewFile,
  filesById: Map<string, MvDriveFile>,
): boolean {
  if (isDisplayOnlyPicAssetImage(file)) {
    const effectiveId = effectiveDriveFileId(file);
    if (effectiveId) {
      const drive = filesById.get(effectiveId);
      if (drive) return isReportImageIncluded(drive);
    }
    return file.includeInReport === true;
  }
  return isReportImageIncluded(file);
}

function collectAssetFolderNodes(node: ImageFolderNode): ImageFolderNode[] {
  const out: ImageFolderNode[] = [];
  const walk = (current: ImageFolderNode) => {
    if (isAssetFolderNode(current)) out.push(current);
    for (const child of current.folders) walk(child);
  };
  for (const child of node.folders) walk(child);
  return out;
}

function reportSelectPreviewUrl(projectId: string, file: AssetImageViewFile): string {
  const sourceUrl = typeof file.sourceUrl === "string" ? file.sourceUrl.trim() : "";
  if (sourceUrl) return sourceUrl;
  const effectiveId = effectiveDriveFileId(file);
  if (effectiveId && !isLocalPreviewDriveId(effectiveId)) {
    return `/api/mv/projects/${projectId}/files/${encodeURIComponent(effectiveId)}/download`;
  }
  if (!isDisplayOnlyPicAssetImage(file) && file._id && !isLocalPreviewDriveId(file._id)) {
    return downloadHref(projectId, file);
  }
  return "";
}

function fileNameFromPathSafe(file: AssetImageViewFile): string {
  return fileNameFromPath(file.relativePath || file.name);
}

export default function MvAssetImagesHub({ projectId, projectName }: MvAssetImagesHubProps) {
  const { t, dir, isArabic } = useMvI18n();
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(isArabic ? "ar-SA" : "en-US"),
    [isArabic],
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(isArabic ? "ar-SA" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [isArabic],
  );
  const previewKindLabel = useCallback(
    (node: ImageFolderNode) => previewFolderKindLabel(node, t),
    [t],
  );
  const previewStatsLabel = useCallback(
    (node: ImageFolderNode) => previewFolderStatsLabel(node, t, numberFormatter),
    [t, numberFormatter],
  );
  const { toast } = useToast();
  const filePickInputRef = useRef<HTMLInputElement>(null);
  const folderPickInputRef = useRef<HTMLInputElement>(null);
  const assetSearchInputRef = useRef<HTMLInputElement>(null);
  const assetDownloadButtonRef = useRef<HTMLButtonElement>(null);
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
  const [assetImageListProgress, setAssetImageListProgress] = useState<AssetImageListProgress>({
    active: false,
    loaded: 0,
    total: 0,
    partial: false,
  });
  const assetFilesLoadIdRef = useRef(0);
  const assetFilesAbortRef = useRef<AbortController | null>(null);
  const assetFilesLoadingRef = useRef(false);
  const assetFilesQueuedRefreshRef = useRef(false);
  const loadImagesRef = useRef<((mode?: "full" | "revalidate") => Promise<void>) | null>(null);
  const filesRef = useRef(files);
  filesRef.current = files;
  const [dragging, setDragging] = useState(false);
  const [selectedPath, setSelectedPath] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set([""]));
  const [reportData, setReportData] = useState<MvProjectReportData>({ includeAssetImages: true });
  const [includeAssetImagesInReport, setIncludeAssetImagesInReport] = useState(true);
  const [reportSelectionSaving, setReportSelectionSaving] = useState(false);
  const reportSelectionPendingRef = useRef(0);
  const [reportImagesSelectOpen, setReportImagesSelectOpen] = useState(false);
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
  const previewFoldersLoadIdRef = useRef(0);
  const previewHydrateCancelRef = useRef<(() => void) | null>(null);
  const selectedPreviewFolderIdRef = useRef<string | null>(null);
  selectedPreviewFolderIdRef.current = selectedPreviewFolderId;
  const [expandedPreviewIds, setExpandedPreviewIds] = useState<Set<string>>(() => new Set(["__pv_root__"]));
  const [creatingPreviewFolder, setCreatingPreviewFolder] = useState(false);
  const [, setFolderMetaSaving] = useState(false);
  const [moveDialogFolder, setMoveDialogFolder] = useState<ImageFolderNode | null>(null);
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
          phase: params.phase ?? t("assetImages.upload.phase.preparing"),
          progress: 2,
          current: 0,
          total: params.total,
          folderName: params.folderName,
          state: "uploading",
        },
      ]);
      return id;
    },
    [t],
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
    if (mode === "revalidate" && assetFilesLoadingRef.current) {
      assetFilesQueuedRefreshRef.current = true;
      return;
    }
    assetFilesLoadingRef.current = true;
    const cacheKey = MV_WORKFLOW_SESSION.assetImageFiles(projectId);
    const cached = readMvWorkflowSessionJson<{ rows: MvDriveFile[] }>(cacheKey);
    const cachedRows = cached?.rows && Array.isArray(cached.rows) ? cached.rows : [];
    const myLoadId = ++assetFilesLoadIdRef.current;
    const baselineServerRows = filesRef.current.filter((file) => !isLocalPreviewDriveId(file._id));
    assetFilesAbortRef.current?.abort();
    const controller = new AbortController();
    assetFilesAbortRef.current = controller;

    if (mode === "full") {
      if (cachedRows.length > 0) {
        setFiles((prev) =>
          mergeServerListWithStillPendingLocals(cachedRows, prev.filter((f) => isLocalPreviewDriveId(f._id))),
        );
        setLoading(false);
      } else {
        setLoading(true);
      }
    }

    setAssetImageListProgress({
      active: true,
      loaded: cachedRows.length,
      total: 0,
      partial: false,
    });

    const serverRows: MvDriveFile[] = [];
    const seenIds = new Set<string>();
    const seenCursors = new Set<string>();
    let cursor = "0";
    let firstPage = true;
    let knownTotal = 0;
    let completedAllPages = false;

    try {
      while (!seenCursors.has(cursor)) {
        seenCursors.add(cursor);
        const limit = firstPage ? 80 : 250;
        const params = new URLSearchParams({ cursor, limit: String(limit) });
        const payload = await mvFetchJson<AssetImageFilesPage | MvDriveFile[]>(
          `/api/mv/projects/${encodeURIComponent(projectId)}/asset-image-files?${params.toString()}`,
          { signal: controller.signal },
          {
            cacheKey: mode === "full" ? `asset-image-files-page:${projectId}:${cursor}:${limit}` : undefined,
            cacheTtlMs: 2_000,
            retries: 1,
            retryBaseMs: 650,
            timeoutMs: firstPage ? 12_000 : 18_000,
            trackLoading: false,
          },
        );
        if (myLoadId !== assetFilesLoadIdRef.current) return;

        const page: AssetImageFilesPage = Array.isArray(payload)
          ? {
              items: payload,
              nextCursor: null,
              hasMore: false,
              total: payload.length,
            }
          : {
              items: Array.isArray(payload.items) ? payload.items : [],
              nextCursor: typeof payload.nextCursor === "string" ? payload.nextCursor : null,
              hasMore: payload.hasMore === true,
              total: Number.isFinite(payload.total) ? Math.max(0, payload.total) : 0,
            };

        for (const row of page.items) {
          if (!row?._id || seenIds.has(row._id)) continue;
          seenIds.add(row._id);
          serverRows.push(row);
        }
        knownTotal = Math.max(knownTotal, page.total, serverRows.length);

        const pageComplete = !page.hasMore || !page.nextCursor;
        setFiles((previous) =>
          mergeServerListWithStillPendingLocals(
            serverRows,
            [
              ...previous.filter((file) => isLocalPreviewDriveId(file._id)),
              ...(pageComplete ? [] : baselineServerRows),
            ],
          ),
        );
        if (firstPage) setLoading(false);
        setAssetImageListProgress({
          active: page.hasMore && Boolean(page.nextCursor),
          loaded: serverRows.length,
          total: knownTotal,
          partial: false,
        });

        // نخزن عينة أولية صغيرة فقط حتى لا يجمّد JSON.stringify المتصفح مع آلاف الصور.
        if (pageComplete || (firstPage && cachedRows.length === 0)) {
          writeMvWorkflowSessionJson(cacheKey, { rows: serverRows.slice(0, 500) });
        }

        firstPage = false;
        if (pageComplete) {
          completedAllPages = true;
          break;
        }
        cursor = page.nextCursor!;
        await new Promise<void>((resolve) => window.setTimeout(resolve, 35));
      }
      if (!completedAllPages) throw new Error("asset_image_pagination_incomplete");
      if (myLoadId === assetFilesLoadIdRef.current) {
        setAssetImageListProgress({
          active: false,
          loaded: serverRows.length,
          total: Math.max(knownTotal, serverRows.length),
          partial: false,
        });
      }
    } catch {
      if (myLoadId !== assetFilesLoadIdRef.current) return;
      // نحافظ على الدفعات المكتملة أو نسخة الجلسة؛ لا نرفع خطأ غير معالج للمتصفح.
      setAssetImageListProgress({
        active: false,
        loaded: serverRows.length || cachedRows.length,
        total: Math.max(knownTotal, serverRows.length, cachedRows.length),
        partial: true,
      });
    } finally {
      if (myLoadId === assetFilesLoadIdRef.current) {
        setLoading(false);
        assetFilesLoadingRef.current = false;
        if (assetFilesAbortRef.current === controller) assetFilesAbortRef.current = null;
        if (assetFilesQueuedRefreshRef.current) {
          assetFilesQueuedRefreshRef.current = false;
          window.setTimeout(() => void loadImagesRef.current?.("revalidate"), 180);
        }
      }
    }
  }, [projectId]);
  loadImagesRef.current = loadImages;

  const loadReportSettings = useCallback(async () => {
    try {
      const data = await mvFetchJson<{ project?: MvProject }>(
        `/api/mv/projects/${projectId}?picAssetMode=summary`,
        {},
        {
          cacheKey: `project-summary:${projectId}`,
          cacheTtlMs: 12_000,
          loadingLabel: t("workflow.loading.projectData"),
        },
      );
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
    const myLoadId = ++previewFoldersLoadIdRef.current;
    previewHydrateCancelRef.current?.();
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
      const data = await mvFetchJson<{ subProjects?: MvSubProject[] }>(
        `/api/mv/projects/${projectId}?picAssetMode=summary`,
        {},
        {
          cacheKey: mode === "full" ? `project-summary:${projectId}` : undefined,
          cacheTtlMs: 12_000,
          retries: 1,
          timeoutMs: 15_000,
          trackLoading: false,
        },
      );
      if (previewFoldersLoadIdRef.current !== myLoadId) return;
      const { previewRoot, entries: baseEntries } = buildPhotosRootAssetEntries(data.subProjects ?? []);
      if (!previewRoot) {
        setPhotosRootId(null);
        setPreviewPhotoFolders([]);
        setSelectedPreviewFolderId(null);
        writeMvWorkflowSessionJson(cacheKey, { photosRootId: null, entries: [] });
        return;
      }
      setPhotosRootId(previewRoot._id);
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
      const summaryEntries = mergeRecentlyCreated(baseEntries);
      let mergedEntries: PreviewPhotoFolderEntry[] = [];
      setPreviewPhotoFolders((prev) => {
        const prevById = new Map(prev.map((e) => [e.sub._id, e]));
        mergedEntries = summaryEntries.map((entry) => {
          const existing = prevById.get(entry.sub._id);
          const mergedPic = mergePicAssetPreferFull(existing?.picAsset ?? null, entry.picAsset);
          const mergedName =
            mergedPic?.name?.trim() || entry.sub.name || existing?.sub.name || "";
          return {
            sub: { ...entry.sub, name: mergedName },
            picAsset: mergedPic,
          };
        });
        writeMvWorkflowSessionJson(cacheKey, {
          photosRootId: previewRoot._id,
          entries: mergedEntries,
        });
        return mergedEntries;
      });
      if (blockPreviewSpinner) setLoadingPreviewFolders(false);

      const selectedId = selectedPreviewFolderIdRef.current;
      const priorityIds =
        selectedId && selectedId !== "__pv_root__"
          ? [selectedId]
          : mergedEntries.slice(0, 16).map((e) => e.sub._id);

      previewHydrateCancelRef.current = hydratePicAssetEntriesProgressive(
        projectId,
        mergedEntries,
        {
          concurrency: 4,
          prioritySubIds: priorityIds,
          isCancelled: () => previewFoldersLoadIdRef.current !== myLoadId,
          shouldSkip: (entry) => entryHasFullPicAssetMedia(entry.picAsset),
          onBatchUpdate: (updates) => {
            if (previewFoldersLoadIdRef.current !== myLoadId) return;
            const byId = new Map(updates.map((update) => [update.subId, update.next]));
            setPreviewPhotoFolders((prev) =>
              prev.map((entry) => {
                const next = byId.get(entry.sub._id);
                return next
                  ? { sub: next.sub, picAsset: mergePicAssetPreferFull(entry.picAsset, next.picAsset) }
                  : entry;
              }),
            );
          },
          onComplete: () => {
            if (previewFoldersLoadIdRef.current !== myLoadId) return;
            setPreviewPhotoFolders((current) => {
              writeMvWorkflowSessionJson(cacheKey, { photosRootId: previewRoot._id, entries: current });
              return current;
            });
          },
        },
      ).cancel;

      setSelectedPreviewFolderId((prev) => {
        if (prev === "__pv_root__" || (prev && mergedEntries.some((e) => e.sub._id === prev))) return prev;
        return "__pv_root__";
      });
      setExpandedPreviewIds((cur) => {
        const next = new Set(cur);
        next.add("__pv_root__");
        return next;
      });
    } catch {
      if (mode === "full" && !(cached?.entries && Array.isArray(cached.entries))) {
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
      const persisted = normalizeImportResult(
        await mvFetchJson<AssetImportResult>(
          `/api/assets/imports?projectId=${encodeURIComponent(projectId)}`,
          {},
          {
            cacheKey: `asset-import-summary:${projectId}`,
            cacheTtlMs: 3_000,
            retries: 1,
            timeoutMs: 12_000,
            trackLoading: false,
          },
        ),
      );
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
    void loadPreviewPhotoFolders("full");
    const imageLoadTimer = window.setTimeout(() => {
      void loadImages("full");
    }, 80);
    void loadReportSettings();
    void loadAssetImportSummary();
    return () => {
      window.clearTimeout(imageLoadTimer);
      assetFilesLoadIdRef.current += 1;
      assetFilesAbortRef.current?.abort();
      assetFilesAbortRef.current = null;
      assetFilesLoadingRef.current = false;
      assetFilesQueuedRefreshRef.current = false;
      previewHydrateCancelRef.current?.();
    };
  }, [loadAssetImportSummary, loadImages, loadPreviewPhotoFolders, loadReportSettings]);

  useEffect(() => {
    if (!selectedPreviewFolderId || selectedPreviewFolderId === "__pv_root__") return;
    let cancelled = false;
    void (async () => {
      const row = await fetchPicAssetDetail(projectId, selectedPreviewFolderId).catch(() => null);
      if (cancelled || !row?.picAsset) return;
      setPreviewPhotoFolders((prev) => {
        const entry = prev.find((e) => e.sub._id === selectedPreviewFolderId);
        if (!entry || entryHasFullPicAssetMedia(entry.picAsset)) return prev;
        return prev.map((e) =>
          e.sub._id === selectedPreviewFolderId
            ? { sub: row.sub, picAsset: mergePicAssetPreferFull(e.picAsset, row.picAsset) }
            : e,
        );
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, selectedPreviewFolderId]);

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
  const renderFolderGlyph = useCallback(
    (node: ImageFolderNode, size: "tree" | "card" | "search" = "tree") => {
      const asset = isAssetFolderNode(node);
      const preview = asset ? firstFolderImage(node) : null;
      const iconSize =
        size === "card" ? "h-10 w-10" : size === "search" ? "h-9 w-9" : "h-3.5 w-3.5";
      const shellSize =
        size === "tree"
          ? "h-5 w-5 rounded-md"
          : size === "search"
            ? "h-14 w-14 rounded-xl"
            : "h-16 w-16 rounded-2xl";

      if (!asset) {
        const FolderIcon = size === "tree" ? Folder : FolderOpen;
        return <FolderIcon className={cn(iconSize, "shrink-0 text-amber-500")} />;
      }

      return (
        <span
          className={cn(
            "relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm",
            shellSize,
          )}
          title={t("assetImages.kind.asset")}
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveThumbSrc(preview) || undefined}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          ) : null}
          <span
            className={cn(
              "absolute inset-0",
              preview ? "bg-emerald-950/35" : "bg-gradient-to-br from-emerald-50 to-white",
            )}
          />
          <Box className={cn(iconSize, "relative z-10 drop-shadow-sm", preview ? "text-white" : "text-emerald-700")} />
        </span>
      );
    },
    [resolveThumbSrc],
  );

  const awaitingInitialListFetch = loading && files.length === 0;
  const assetImageListPercent = assetImageListProgress.total > 0
    ? Math.min(100, Math.round((assetImageListProgress.loaded / assetImageListProgress.total) * 100))
    : 4;

  const driveFilesForUploadTree = useMemo(() => files.filter((f) => !f.picAssetId), [files]);
  const { root, foldersByPath } = useMemo(
    () => buildImageTree(driveFilesForUploadTree, t("assetImages.rootLabel")),
    [driveFilesForUploadTree, t],
  );
  const selectedFolder = foldersByPath.get(selectedPath) ?? root;
  const filesByPicAssetId = useMemo(() => {
    const grouped = new Map<string, MvDriveFile[]>();
    for (const file of files) {
      const key = file.picAssetId?.trim();
      if (!key) continue;
      const current = grouped.get(key);
      if (current) current.push(file);
      else grouped.set(key, [file]);
    }
    return grouped;
  }, [files]);

  const { previewRoot, previewFoldersById } = useMemo(() => {
    const fb = new Map<string, ImageFolderNode>();
    const rootNode = createFolderNode(t("assetImages.rootLabel"), "__pv_root__");
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
      const node = createFolderNode(row.sub.name, id);
      const picAssetId = row.picAsset?._id?.trim() || "";
      if (picAssetId) {
        node.picAssetId = picAssetId;
      }
      node.importId = row.picAsset?.importId ?? null;
      node.sheetName = row.picAsset?.sheetName ?? null;
      /** نفس منطق «صور المعاينة»: كل ملف مرتبط بـ picAssetId يظهر في المجلد */
      const assetFileRowsAll = picAssetId
        ? Array.from(
            new Map(
              [...(filesByPicAssetId.get(picAssetId) ?? []), ...(filesByPicAssetId.get(id) ?? [])]
                .map((file) => [file._id, file]),
            ).values(),
          )
        : [];
      const assetImageRows = assetFileRowsAll.filter((f) => !isMvDriveFileVideo(f));

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
          .filter((file): file is AssetImageViewFile => file != null);

      /**
       * لا ندمج مصدرين في أي حال: عند توفر صور الأصل في ‎assets.images‎ فهي المصدر
       * المرجعي الوحيد للعرض، سواء كانت URL من تطبيق المعاينة أو fileId قديماً.
       * سجلات Drive/GridFS المقابلة هي نسخ خدمة للتنزيل فقط. هذا يمنع التكرار
       * جذرياً بدلاً من محاولة مطابقة المرآة بالرابط أو الترتيب.
       */
      const canonicalPicImageEntries = indexed.filter(({ image }) => !isExternalPicAssetVideo(image));
      const canonicalPicImageRows = mapDisplay(canonicalPicImageEntries, false);
      const displayRows = canonicalPicImageRows.length > 0 ? canonicalPicImageRows : assetImageRows;

      node.images = sortImages(dedupeAssetImageViewFiles(displayRows, picAssetId));
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
      node.includedImageCount =
        node.images.filter((image) => isAssetViewFileReportIncluded(image, filesById)).length +
        node.folders.reduce((sum, folder) => sum + folder.includedImageCount, 0);
      node.includedVideoCount =
        node.videos.filter((video) => isAssetViewFileReportIncluded(video, filesById)).length +
        node.folders.reduce((sum, folder) => sum + folder.includedVideoCount, 0);
    };

    sortAndCount(rootNode);
    return { previewRoot: rootNode, previewFoldersById: fb };
  }, [filesById, filesByPicAssetId, previewPhotoFolders, projectId, t]);

  const previewRowsById = useMemo(
    () => new Map(previewPhotoFolders.map((row) => [row.sub._id, row])),
    [previewPhotoFolders],
  );

  const setPreviewPhotoFoldersFast = useCallback(
    (
      updater: (
        current: PreviewPhotoFolderEntry[],
      ) => PreviewPhotoFolderEntry[],
    ) => {
      setPreviewPhotoFolders((current) => {
        const next = updater(current);
        writeMvWorkflowSessionJson(MV_WORKFLOW_SESSION.previewPhotoFolders(projectId), {
          photosRootId,
          entries: next,
        });
        return next;
      });
    },
    [photosRootId, projectId],
  );

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

  const reportSelectSections = useMemo((): MvReportSelectAssetSection[] => {
    const assetNodes = collectAssetFolderNodes(previewRoot);
    return assetNodes.map((node) => {
      const pathParts = findFolderNodePath(previewRoot, node.path)
        .filter((item) => item.path !== "__pv_root__" && item.path !== node.path)
        .map((item) => item.name);
      return {
        id: node.path,
        name: node.name,
        pathLabel: pathParts.length > 0 ? pathParts.join(" / ") : undefined,
        images: node.images.map((file) => {
          const displayOnly = isDisplayOnlyPicAssetImage(file);
          const effectiveId = displayOnly ? effectiveDriveFileId(file) : file._id;
          return {
            key: file._id,
            name: fileNameFromPathSafe(file),
            previewUrl: reportSelectPreviewUrl(projectId, file),
            selected: isAssetViewFileReportIncluded(file, filesById),
            disabled: displayOnly ? false : !effectiveId,
          };
        }),
      };
    });
  }, [filesById, previewRoot, projectId]);

  const reportSelectSelectedCount = useMemo(
    () =>
      reportSelectSections.reduce(
        (sum, section) => sum + section.images.filter((image) => image.selected).length,
        0,
      ),
    [reportSelectSections],
  );

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
  const activeLocationIsAssetFolder = Boolean(
    selectedPreviewFolderNode && isAssetFolderNode(selectedPreviewFolderNode),
  );
  const activeContentFolders = activeContentNode?.folders ?? [];
  const activeContentFiles = previewAppGridFiles;
  const activeBreadcrumbNodes = useMemo(
    () => (activeContentNode ? findFolderNodePath(previewRoot, activeContentNode.path) : []),
    [activeContentNode, previewRoot],
  );
  const activeParentBreadcrumbNode =
    activeBreadcrumbNodes.length > 1 ? activeBreadcrumbNodes[activeBreadcrumbNodes.length - 2] : null;
  const assetSearchRows = useMemo<AssetImagesSearchResult[]>(() => {
    if (!assetSearchOpen && !appliedAssetSearch) return [];
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
        const recentLabel = formatAssetSearchDate(recentAtMs, dateTimeFormatter);
        const chips = compactChips([
          t("assetImages.meta.image"),
          isDisplayOnlyPicAssetImage(file) ? t("assetImages.meta.fromAssetData") : t("assetImages.meta.savedFile"),
          isAssetViewFileReportIncluded(file, filesById)
            ? t("assetImages.report.include")
            : t("assetImages.report.exclude"),
          recentLabel ? t("assetImages.meta.addedRecently", { when: recentLabel }) : null,
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
        const assetFolderCount = countDescendantAssetFolders(node);
        const regularFolderCount = countDescendantRegularFolders(node);
        const recentLabel = formatAssetSearchDate(latestMs, dateTimeFormatter);
        const chips = compactChips([
          previewKindLabel(node),
          isAssetFolderNode(node)
            ? t("assetImages.meta.imageCount", { count: numberFormatter.format(node.imageCount) })
            : t("assetImages.meta.assetFolderCount", {
                assets: numberFormatter.format(assetFolderCount),
                folders: numberFormatter.format(regularFolderCount),
              }),
          node.sheetName ? t("assetImages.meta.sheet", { name: node.sheetName }) : null,
          recentLabel ? t("assetImages.meta.lastAdded", { when: recentLabel }) : null,
        ]);
        const parentLocation = parentNames.length > 0 ? parentNames.join(" / ") : previewRoot.name;
        const searchText = [
          node.name,
          node.path,
          parentLocation,
          node.sheetName,
          node.importId,
          node.imageCount,
          assetFolderCount,
          regularFolderCount,
          chips.join(" "),
        ].join(" ");

        rows.push({
          id: `folder:${node.path}`,
          kind: "folder",
          folderKind: isAssetFolderNode(node) ? "asset" : "folder",
          title: node.name,
          subtitle: parentLocation,
          chips,
          normalizedTitle: normalizeAssetSearchText(node.name),
          normalizedPath: normalizeAssetSearchText(`${parentLocation} / ${node.name} / ${node.path}`),
          normalizedSearchText: normalizeAssetSearchText(searchText),
          recentAtMs: latestMs,
          folderIdPath: nodeIds,
          selectFolderId: node.path,
          folderPreviewFile: isAssetFolderNode(node) ? firstFolderImage(node) : null,
        });
      }

      return latestMs;
    };

    visit(previewRoot, [previewRoot.name], ["__pv_root__"], false);
    return rows;
  }, [
    appliedAssetSearch,
    assetSearchOpen,
    dateTimeFormatter,
    filesById,
    numberFormatter,
    previewKindLabel,
    previewRoot,
    t,
  ]);
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
        ? t("assetImages.search.mode.foldersOnly")
        : appliedAssetSearch.kind === "image"
          ? t("assetImages.search.mode.imagesOnly")
          : "";
    const suffix = kindLabel ? ` - ${kindLabel}` : "";
    if (appliedAssetSearch.mode === "recent" && query) {
      return `${t("assetImages.search.mode.recentWithQuery", { query })}${suffix}`;
    }
    if (appliedAssetSearch.mode === "recent") return `${t("assetImages.search.mode.recent")}${suffix}`;
    if (query) return `${t("assetImages.search.mode.query", { query })}${suffix}`;
    return `${t("assetImages.search.mode.generic")}${suffix}`;
  }, [appliedAssetSearch, t]);
  const applyAssetSearch = useCallback(() => {
    const query = assetSearchQuery.trim();
    if (assetSearchMode === "all" && assetSearchKind === "all" && !query) {
      toast({ variant: "destructive", description: t("assetImages.search.invalid") });
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
        toast({ variant: "destructive", description: t("assetImages.upload.noValidImages") });
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
          description: t("assetImages.upload.savedCount", { count: numberFormatter.format(uploadedRows.length) }),
        });
        void loadImages("revalidate");
      } catch (error) {
        setFiles((prev) => prev.filter((f) => !sessionLocalIds.includes(f._id)));
        revokeOptimisticUrls(sessionLocalIds);
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : t("assetImages.upload.genericFailed"),
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

  const createPreviewFolderOnServer = useCallback(async (
    name: string,
    parentId: string,
    kind: PreviewFolderCreateKind = "asset",
  ) => {
    const response = await fetch(`/api/mv/projects/${projectId}/subprojects`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parent: parentId, folderKind: kind }),
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
        toast({ variant: "destructive", description: t("assetImages.upload.noValidImages") });
        return;
      }

      const groupTotal = imageFiles.length;
      let jobId: string | null = null;
      if (!options?.onProgress) {
        jobId = startAssetUploadJob({
          kind: "images",
          label: t("assetImages.upload.imageCountLabel", { count: numberFormatter.format(groupTotal) }),
          total: groupTotal,
          phase: t("assetImages.upload.phase.uploading"),
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
          label: t("assetImages.upload.uploadProgressLabel", { name: folderDisplayName, current: numberFormatter.format(patch.completedInGroup), total: numberFormatter.format(patch.groupTotal) }),
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
            phase: t("assetImages.upload.previewImages", { name: folderDisplayName, current: numberFormatter.format(completedInGroup), total: numberFormatter.format(groupTotal) }),
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
            phase: t("assetImages.upload.uploadToServer", { name: folderDisplayName, current: numberFormatter.format(uploaded), total: numberFormatter.format(total) }),
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
            phase: t("assetImages.upload.phase.complete"),
            current: groupTotal,
            total: groupTotal,
          });
        }
        setFiles((prev) => replaceLocalPreviewRowsWithServer(prev, uploadedRows, sessionLocalIds));
        revokeOptimisticUrls(sessionLocalIds);
        if (!options?.onProgress) {
          toast({
            description: t("assetImages.upload.savedInFolder", { count: numberFormatter.format(uploadedRows.length) }),
          });
          await loadPreviewPhotoFolders("revalidate");
          removeAssetUploadJobLater(jobId!);
        }
      } catch (error) {
        if (jobId) {
          updateAssetUploadJob(jobId, { progress: 100, state: "error", phase: t("assetImages.upload.phase.failed") });
          removeAssetUploadJobLater(jobId, 6000);
        }
        setFiles((prev) => prev.filter((f) => !sessionLocalIds.includes(f._id)));
        revokeOptimisticUrls(sessionLocalIds);
        if (!options?.onProgress) {
          toast({
            variant: "destructive",
            description: error instanceof Error ? error.message : t("assetImages.upload.genericFailed"),
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
        { uploadFolderId: string; selectionFolderId: string; name: string; kind: PreviewFolderCreateKind }
      >();
      previewPhotoFolders.forEach((row) => {
        const parent = row.sub.parent?.trim();
        const name = cleanPathPart(row.sub.name);
        if (!parent || !name) return;
        known.set(`${parent}\u0000${name}`, {
          uploadFolderId: row.picAsset?._id ?? row.sub._id,
          selectionFolderId: row.sub._id,
          name,
          kind: row.picAsset ? "asset" : "folder",
        });
      });

      for (let index = 0; index < parts.length; index++) {
        const rawPart = parts[index]!;
        const name = cleanPathPart(rawPart);
        if (!name) continue;
        const targetKind: PreviewFolderCreateKind = index === parts.length - 1 ? "asset" : "folder";
        folderName = name;
        const existing =
          known.get(`${parentUploadId}\u0000${name}`) ??
          known.get(`${parentSelectionId}\u0000${name}`);
        if (existing) {
          if (targetKind === "folder" && existing.kind === "asset") {
            throw new Error(t("assetImages.upload.cannotCreateInsideAsset"));
          }
          if (targetKind === "asset" && existing.kind === "folder") {
            throw new Error(t("assetImages.upload.duplicateAssetName"));
          }
          parentUploadId = existing.uploadFolderId;
          parentSelectionId = existing.selectionFolderId;
          selectionFolderId = existing.selectionFolderId;
          continue;
        }

        const createdFolder = await createPreviewFolderOnServer(name, parentUploadId, targetKind);
        rememberPreviewFolder(createdFolder);
        const created = {
          uploadFolderId: createdFolder.picAsset?._id ?? createdFolder._id,
          selectionFolderId: createdFolder._id,
          name,
          kind: targetKind,
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
        folderName: folderName || t("assetImages.rootLabel"),
      };
    },
    [createPreviewFolderOnServer, previewPhotoFolders, rememberPreviewFolder],
  );

  const uploadImagesToActivePreviewLocation = useCallback(
    async (picked: PickedImageFile[], targetNode = selectedPreviewFolderNode) => {
      const imageFiles = picked.filter((item) => isLikelyImage(item.file));
      if (imageFiles.length === 0) {
        toast({ variant: "destructive", description: t("assetImages.upload.noValidImages") });
        return;
      }

      const targetFolderId = targetNode?.path ?? selectedPreviewFolderId;
      const isRootSelected = targetFolderId === "__pv_root__";
      const regularFolderParentId =
        targetNode && !targetNode.isSynthetic && targetNode.path !== "__pv_root__" ? targetNode.path : null;
      const baseParentId = targetNode?.picAssetId ?? regularFolderParentId ?? (isRootSelected ? photosRootId : null);
      if (!baseParentId) {
        toast({
          variant: "destructive",
          description: t("assetImages.upload.selectFolderFirst"),
        });
        return;
      }

      const totalImages = imageFiles.length;
      const isFolderBatchUpload = imageFiles.some((item) => folderPartsFromPickedImage(item).length > 0);
      if (targetNode && isAssetFolderNode(targetNode) && isFolderBatchUpload) {
        toast({
          variant: "destructive",
          description: t("assetImages.upload.noDirectInAsset"),
        });
        return;
      }
      const firstFolderParts = imageFiles.map(folderPartsFromPickedImage).find((parts) => parts.length > 0);
      const rootFolderLabel = firstFolderParts?.[0] ?? targetNode?.name ?? t("assetImages.rootLabel");

      const jobId = startAssetUploadJob({
        kind: isFolderBatchUpload ? "folder" : "images",
        label: isFolderBatchUpload
          ? t("assetImages.upload.folderLabel", { name: rootFolderLabel })
          : t("assetImages.upload.imageCountLabel", { count: numberFormatter.format(totalImages) }),
        total: totalImages,
        phase: isFolderBatchUpload ? t("assetImages.upload.folderPreparing") : t("assetImages.upload.phase.uploading"),
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
              : t("assetImages.upload.folderLabel", { name: rootFolderLabel })
            : t("assetImages.upload.imageCountLabel", {
                count: `${numberFormatter.format(uploaded)} / ${numberFormatter.format(totalImages)}`,
              }),
        });
      };

      pushGlobalProgress(
        isFolderBatchUpload ? t("assetImages.upload.folderPreparing") : t("assetImages.upload.prepareUpload"),
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
            pushGlobalProgress(t("assetImages.upload.creatingFolder", { name: creatingLabel }), creatingLabel, serverUploadedCount);
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
          description: t("assetImages.upload.noDirectInRoot"),
        });
      }

      const uploadGroups = Array.from(groups.values());
      if (uploadGroups.length === 0) {
        updateAssetUploadJob(jobId, { progress: 100, state: "error", phase: t("assetImages.upload.noImagesToUpload") });
        removeAssetUploadJobLater(jobId, 4000);
        return;
      }

      try {
        pushGlobalProgress(t("assetImages.upload.startUpload"), rootFolderLabel, serverUploadedCount);

        for (const group of uploadGroups) {
          const groupOffset = serverUploadedCount;
          await uploadImagesToPicFolder(group.uploadFolderId, group.folderName, group.files, {
            onProgress: (patch) => {
              const onServer = /server|الخادم/i.test(patch.phase);
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
            t("assetImages.upload.folderComplete", { name: group.folderName }),
            group.folderName,
            serverUploadedCount,
          );
        }

        updateAssetUploadJob(jobId, {
          progress: 100,
          state: "done",
          phase: isFolderBatchUpload ? t("assetImages.upload.folderUploadComplete") : t("assetImages.upload.imagesUploadComplete"),
          current: totalImages,
          total: totalImages,
          folderName: isFolderBatchUpload ? rootFolderLabel : targetNode?.name,
        });
        toast({
          description: isFolderBatchUpload
            ? t("assetImages.upload.savedInNamedFolder", { count: numberFormatter.format(totalImages), name: rootFolderLabel })
            : t("assetImages.upload.savedCount", { count: numberFormatter.format(totalImages) }),
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
          phase: t("assetImages.upload.folderFailed"),
        });
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : t("assetImages.upload.folderFailed"),
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

  const createPreviewFolder = useCallback(async (
    parentId?: string | null,
    kind: PreviewFolderCreateKind = "asset",
  ) => {
    const targetParentId = parentId?.trim() || photosRootId;
    if (!targetParentId) {
      toast({
        variant: "destructive",
        description: t("assetImages.upload.photosRootNotFound"),
      });
      return;
    }
    const defaultName = kind === "folder" ? t("assetImages.create.defaultFolder") : t("assetImages.create.defaultAsset");
    const promptLabel = kind === "folder" ? t("assetImages.create.promptFolder") : t("assetImages.create.promptAsset");
    const name = window.prompt(promptLabel, defaultName)?.trim();
    if (!name) return;
    try {
      setCreatingPreviewFolder(true);
      const createdFolder = await createPreviewFolderOnServer(name, targetParentId, kind);
      rememberPreviewFolder(createdFolder);
      const parentSelectionId = selectionFolderIdForParent(targetParentId);
      setSelectedPreviewFolderId(createdFolder._id);
      setExpandedPreviewIds((current) => {
        const next = new Set(current);
        next.add("__pv_root__");
        next.add(parentSelectionId);
        next.add(createdFolder._id);
        return next;
      });
      toast({ description: kind === "folder" ? t("assetImages.create.folderSuccess") : t("assetImages.create.assetSuccess") });
    } catch {
      toast({ variant: "destructive", description: kind === "folder" ? t("assetImages.create.folderFailed") : t("assetImages.create.assetFailed") });
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
    selectedPreviewFolderId === "__pv_root__"
      ? photosRootId
      : selectedPreviewFolderNode &&
          !isAssetFolderNode(selectedPreviewFolderNode) &&
          !selectedPreviewFolderNode.isSynthetic &&
          selectedPreviewFolderNode.path !== "__pv_root__"
        ? selectedPreviewFolderNode.path
        : null;

  const createFolderInActiveLocation = useCallback(() => {
    if (!activeCreateParentId) {
      toast({
        variant: "destructive",
        description: t("assetImages.upload.selectFolderOrRootForFolder"),
      });
      return;
    }
    void createPreviewFolder(activeCreateParentId, "folder");
  }, [activeCreateParentId, createPreviewFolder, toast]);

  const createAssetInActiveLocation = useCallback(() => {
    if (!activeCreateParentId) {
      toast({
        variant: "destructive",
        description: t("assetImages.upload.selectFolderOrRootForAsset"),
      });
      return;
    }
    void createPreviewFolder(activeCreateParentId, "asset");
  }, [activeCreateParentId, createPreviewFolder, toast]);

  const patchPreviewFolderMeta = useCallback(
    async (folderId: string, payload: { name?: string; targetParentId?: string }) => {
      const response = await fetch(
        `/api/mv/projects/${encodeURIComponent(projectId)}/subprojects/${encodeURIComponent(folderId)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        let message = t("errors.generic.saveFailed");
        try {
          const data = (await response.json()) as { message?: unknown };
          if (typeof data.message === "string" && data.message.trim()) {
            message = data.message.trim();
          }
        } catch {
          const text = await response.text().catch(() => "");
          if (text.trim()) message = text.trim();
        }
        throw new Error(message);
      }
      return (await response.json()) as MvSubProject;
    },
    [projectId],
  );

  const renamePreviewFolder = useCallback(
    async (folder: ImageFolderNode) => {
      if (!isManageablePreviewFolderNode(folder)) return;
      const label = previewKindLabel(folder);
      const nextName = window.prompt(t("assetImages.rename.promptNewName", { kind: label }), folder.name)?.trim();
      if (!nextName || nextName === folder.name) return;
      try {
        setFolderMetaSaving(true);
        const updated = await patchPreviewFolderMeta(folder.path, { name: nextName });
        setPreviewPhotoFolders((current) =>
          current.map((row) =>
            row.sub._id === folder.path
              ? { sub: updated, picAsset: updated.picAsset ?? row.picAsset }
              : row,
          ),
        );
        await Promise.all([loadPreviewPhotoFolders("revalidate"), loadImages("revalidate")]);
        toast({ description: label === t("assetImages.kind.asset") ? t("assetImages.rename.assetSuccess") : t("assetImages.rename.folderSuccess") });
      } catch (error) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : t("errors.generic.renameFailed"),
        });
      } finally {
        setFolderMetaSaving(false);
      }
    },
    [loadImages, loadPreviewPhotoFolders, patchPreviewFolderMeta, toast],
  );

  const openMovePreviewFolder = useCallback((folder: ImageFolderNode) => {
    if (!isManageablePreviewFolderNode(folder)) return;
    setMoveDialogFolder(folder);
  }, []);

  const renamePreviewFolderInstant = useCallback(
    (folder: ImageFolderNode) => {
      if (!isManageablePreviewFolderNode(folder)) return;
      const label = previewKindLabel(folder);
      const nextName = window.prompt(t("assetImages.rename.promptNewName", { kind: label }), folder.name)?.trim();
      if (!nextName || nextName === folder.name) return;

      const now = new Date().toISOString();
      setPreviewPhotoFoldersFast((current) =>
        current.map((row) =>
          row.sub._id === folder.path
            ? {
                ...row,
                sub: { ...row.sub, name: nextName, updatedAt: now },
                picAsset: row.picAsset
                  ? { ...row.picAsset, name: nextName, updatedAt: now }
                  : row.picAsset,
              }
            : row,
        ),
      );
      setFiles((current) =>
        current.map((file) => {
          if (file.picAssetId !== folder.picAssetId && file.picAssetId !== folder.path) return file;
          const basename = fileNameFromPath(file.relativePath || file.name);
          const nextFolderPath = previewFolderBasePath(nextName);
          return {
            ...file,
            folderPath: nextFolderPath,
            relativePath: normalizeRelativePath(`${nextFolderPath}/${basename}`, basename),
            updatedAt: now,
          };
        }),
      );
      toast({ description: label === t("assetImages.kind.asset") ? t("assetImages.rename.assetSuccess") : t("assetImages.rename.folderSuccess") });

      void patchPreviewFolderMeta(folder.path, { name: nextName })
        .then((updated) => {
          setPreviewPhotoFoldersFast((current) =>
            current.map((row) =>
              row.sub._id === folder.path
                ? { sub: updated, picAsset: updated.picAsset ?? row.picAsset }
                : row,
            ),
          );
          void Promise.all([loadPreviewPhotoFolders("revalidate"), loadImages("revalidate")]);
        })
        .catch((error) => {
          toast({
            variant: "destructive",
            description: error instanceof Error ? error.message : t("errors.generic.renameFailed"),
          });
          void Promise.all([loadPreviewPhotoFolders("revalidate"), loadImages("revalidate")]);
        });
    },
    [loadImages, loadPreviewPhotoFolders, patchPreviewFolderMeta, setPreviewPhotoFoldersFast, toast],
  );

  const isPreviewFolderDescendantOf = useCallback(
    (candidateId: string, sourceId: string) => {
      let cursor = previewRowsById.get(candidateId);
      const seen = new Set<string>();
      while (cursor?.sub.parent) {
        const parent = cursor.sub.parent;
        if (parent === sourceId) return true;
        if (seen.has(parent)) return false;
        seen.add(parent);
        cursor = previewRowsById.get(parent);
      }
      return false;
    },
    [previewRowsById],
  );

  const moveDestinationOptions = useMemo(() => {
    if (!moveDialogFolder || !photosRootId) return [];
    const sourceId = moveDialogFolder.path;
    const sourceParent = previewRowsById.get(sourceId)?.sub.parent ?? null;
    const options: Array<{
      key: string;
      parentId: string;
      label: string;
      depth: number;
      disabled: boolean;
    }> = [
      {
        key: "__pv_root__",
        parentId: photosRootId,
        label: t("assetImages.rootLabel"),
        depth: 0,
        disabled: sourceParent === photosRootId,
      },
    ];

    const visit = (node: ImageFolderNode, depth: number) => {
      for (const child of node.folders) {
        if (child.isSynthetic) {
          visit(child, depth);
          continue;
        }
        const regularFolder = !isAssetFolderNode(child) && child.path !== "__pv_root__";
        if (regularFolder) {
          const disabled =
            child.path === sourceId ||
            sourceParent === child.path ||
            isPreviewFolderDescendantOf(child.path, sourceId);
          options.push({
            key: child.path,
            parentId: child.path,
            label: child.name,
            depth,
            disabled,
          });
        }
        visit(child, depth + (regularFolder ? 1 : 0));
      }
    };

    visit(previewRoot, 1);
    return options;
  }, [isPreviewFolderDescendantOf, moveDialogFolder, photosRootId, previewRoot, previewRowsById]);

  const movePreviewFolderTo = useCallback(
    async (targetParentId: string) => {
      const folder = moveDialogFolder;
      if (!folder || !isManageablePreviewFolderNode(folder)) return;
      const label = previewKindLabel(folder);
      try {
        setFolderMetaSaving(true);
        await patchPreviewFolderMeta(folder.path, { targetParentId });
        const parentSelectionId = selectionFolderIdForParent(targetParentId);
        setSelectedPreviewFolderId(folder.path);
        setExpandedPreviewIds((current) => {
          const next = new Set(current);
          next.add("__pv_root__");
          next.add(parentSelectionId);
          next.add(folder.path);
          return next;
        });
        setMoveDialogFolder(null);
        await Promise.all([loadPreviewPhotoFolders("revalidate"), loadImages("revalidate")]);
        toast({ description: label === t("assetImages.kind.asset") ? t("assetImages.move.assetSuccess") : t("assetImages.move.folderSuccess") });
      } catch (error) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : t("errors.generic.moveFailed"),
        });
      } finally {
        setFolderMetaSaving(false);
      }
    },
    [
      loadImages,
      loadPreviewPhotoFolders,
      moveDialogFolder,
      patchPreviewFolderMeta,
      selectionFolderIdForParent,
      toast,
    ],
  );

  const movePreviewFolderToInstant = useCallback(
    (targetParentId: string) => {
      const folder = moveDialogFolder;
      if (!folder || !isManageablePreviewFolderNode(folder)) return;
      const label = previewKindLabel(folder);
      const now = new Date().toISOString();
      const parentSelectionId = selectionFolderIdForParent(targetParentId);

      setMoveDialogFolder(null);
      setSelectedPreviewFolderId(folder.path);
      setExpandedPreviewIds((current) => {
        const next = new Set(current);
        next.add("__pv_root__");
        next.add(parentSelectionId);
        next.add(folder.path);
        return next;
      });
      setPreviewPhotoFoldersFast((current) =>
        current.map((row) =>
          row.sub._id === folder.path
            ? {
                ...row,
                sub: { ...row.sub, parent: targetParentId, updatedAt: now },
                picAsset: row.picAsset
                  ? { ...row.picAsset, parent: targetParentId, updatedAt: now }
                  : row.picAsset,
              }
            : row,
        ),
      );
      toast({ description: label === t("assetImages.kind.asset") ? t("assetImages.move.assetSuccess") : t("assetImages.move.folderSuccess") });

      void patchPreviewFolderMeta(folder.path, { targetParentId })
        .then((updated) => {
          setPreviewPhotoFoldersFast((current) =>
            current.map((row) =>
              row.sub._id === folder.path
                ? { sub: updated, picAsset: updated.picAsset ?? row.picAsset }
                : row,
            ),
          );
          void Promise.all([loadPreviewPhotoFolders("revalidate"), loadImages("revalidate")]);
        })
        .catch((error) => {
          toast({
            variant: "destructive",
            description: error instanceof Error ? error.message : t("errors.generic.moveFailed"),
          });
          void Promise.all([loadPreviewPhotoFolders("revalidate"), loadImages("revalidate")]);
        });
    },
    [
      loadImages,
      loadPreviewPhotoFolders,
      moveDialogFolder,
      patchPreviewFolderMeta,
      selectionFolderIdForParent,
      setPreviewPhotoFoldersFast,
      toast,
    ],
  );

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
      const previousById = new Map(filesRef.current.map((file) => [file._id, file.includeInReport === true]));
      setFiles((current) => {
        const next = current.map((file) =>
          fileIds.includes(file._id)
            ? { ...file, includeInReport, updatedAt: new Date().toISOString() }
            : file,
        );
        const serverRows = next.filter((file) => !isLocalPreviewDriveId(file._id));
        writeMvWorkflowSessionJson(MV_WORKFLOW_SESSION.assetImageFiles(projectId), {
          rows: serverRows.slice(0, 500),
        });
        // حافظ على نفس التحديد في كاش صفحة إعداد التقرير حتى لا تُعرض كل الصور من جلسة قديمة
        const reportSessionKey = MV_WORKFLOW_SESSION.valuationReportWorkspace(projectId);
        const reportBundle =
          readMvWorkflowSessionJson<{ files?: MvDriveFile[] }>(reportSessionKey) ?? {};
        if (Array.isArray(reportBundle.files) && reportBundle.files.length > 0) {
          writeMvWorkflowSessionJson(reportSessionKey, {
            ...reportBundle,
            files: reportBundle.files.map((file) =>
              fileIds.includes(file._id) ? { ...file, includeInReport } : file,
            ),
            fetchedAt: Date.now(),
          });
        }
        return next;
      });

      if (remoteIds.length === 0) return;

      reportSelectionPendingRef.current += 1;
      setReportSelectionSaving(true);
      try {
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
          let message = t("assetImages.toast.reportSelectionSaveFailed");
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
        // لا نستبدل قائمة الصور بالكامل حتى لا تومض الواجهة أو تُخفى الصور أثناء الحفظ
        await response.json().catch(() => null);
      } catch (error) {
        setFiles((current) =>
          current.map((file) =>
            fileIds.includes(file._id)
              ? { ...file, includeInReport: previousById.get(file._id) === true }
              : file,
          ),
        );
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : t("assetImages.toast.reportSelectionSaveFailed"),
        });
      } finally {
        reportSelectionPendingRef.current = Math.max(0, reportSelectionPendingRef.current - 1);
        if (reportSelectionPendingRef.current === 0) setReportSelectionSaving(false);
      }
    },
    [projectId, t, toast],
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
      const nextInclude = !isAssetViewFileReportIncluded(viewFile, filesById);
      const effectiveId = effectiveDriveFileId(viewFile);
      if (effectiveId) {
        void updateReportSelection([effectiveId], nextInclude);
      }

      const subProjectId = viewFile.picAssetSubProjectId?.trim() || "";
      const idx = typeof viewFile.picAssetImageIndex === "number" ? viewFile.picAssetImageIndex : -1;
      if (!subProjectId || idx < 0) return;

      const entry = previewPhotoFolders.find((row) => row.sub._id === subProjectId);
      const asset = entry?.picAsset;
      if (!asset) return;
      const current = (asset.images ?? []).slice();
      const target = current[idx];
      // عناصر fileId تُحفظ عبر Drive؛ عناصر url تحتفظ بـ includeInReport على الأصل
      if (!target || !("url" in target) || typeof (target as { url?: unknown }).url !== "string") return;

      const nextImages = current.map((im, i) =>
        i === idx ? { ...(im as object), includeInReport: nextInclude } : im,
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
          description: e instanceof Error ? e.message : t("assetImages.toast.imageReportToggleFailed"),
        });
      }
    },
    [filesById, previewPhotoFolders, projectId, t, toast, updateReportSelection],
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
      if (!window.confirm(t("assetImages.delete.imageConfirm"))) return;

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
          description: e instanceof Error ? e.message : t("assetImages.delete.imageFailed"),
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

  const syncIncludeAssetImagesFlag = useCallback(
    async (enabled: boolean) => {
      if ((includeAssetImagesInReport !== false) === enabled) return;
      const previousReportData = reportData;
      const nextReportData: MvProjectReportData = {
        ...reportData,
        includeAssetImages: enabled,
      };
      try {
        const response = await fetch(`/api/mv/projects/${projectId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportData: nextReportData }),
        });
        if (!response.ok) throw new Error("save_failed");
        const updated = (await response.json()) as MvProject;
        const savedReportData = updated.reportData ?? nextReportData;
        setReportData({
          ...savedReportData,
          includeAssetImages: savedReportData.includeAssetImages !== false,
        });
        setIncludeAssetImagesInReport(savedReportData.includeAssetImages !== false);
      } catch {
        setReportData(previousReportData);
        setIncludeAssetImagesInReport(previousReportData.includeAssetImages !== false);
      }
    },
    [includeAssetImagesInReport, projectId, reportData],
  );

  const setPicAssetFolderReportSelection = useCallback(
    async (node: ImageFolderNode, includeInReport: boolean) => {
      const subProjectId = node.path?.trim() || "";
      if (!subProjectId || subProjectId === "__pv_root__") return;
      const entry = previewPhotoFolders.find((row) => row.sub._id === subProjectId);
      const asset = entry?.picAsset;
      if (!asset) return;
      const previousImages = asset.images ?? [];
      const nextImages = previousImages.map((image) =>
        !isExternalPicAssetVideo(image) ? { ...(image as object), includeInReport } : image,
      );
      setPreviewPhotoFolders((prev) =>
        prev.map((row) =>
          row.sub._id === subProjectId && row.picAsset
            ? { ...row, picAsset: { ...row.picAsset, images: nextImages as PicAssetImage[] } }
            : row,
        ),
      );
      try {
        const updated = await patchMvSubprojectPicAsset(projectId, subProjectId, {
          images: mvPicAssetImagesToPatchPayload(nextImages as PicAssetImage[]),
        });
        setPreviewPhotoFolders((prev) =>
          prev.map((row) => (row.sub._id === subProjectId ? { ...row, picAsset: updated } : row)),
        );
      } catch (error) {
        setPreviewPhotoFolders((prev) =>
          prev.map((row) =>
            row.sub._id === subProjectId && row.picAsset
              ? { ...row, picAsset: { ...row.picAsset, images: previousImages } }
              : row,
          ),
        );
        toast({
          variant: "destructive",
          description:
            error instanceof Error ? error.message : t("assetImages.toast.imageReportToggleFailed"),
        });
      }
    },
    [previewPhotoFolders, projectId, t, toast],
  );

  const applyPicAssetReportSelectionBatch = useCallback(
    async (subProjectId: string, indexSelection: Map<number, boolean>) => {
      if (indexSelection.size === 0) return;
      const entry = previewPhotoFolders.find((row) => row.sub._id === subProjectId);
      const asset = entry?.picAsset;
      if (!asset) return;
      const previousImages = (asset.images ?? []).slice();
      const nextImages = previousImages.map((image, i) => {
        if (!indexSelection.has(i)) return image;
        const includeInReport = indexSelection.get(i) === true;
        const raw = image as unknown;
        if (typeof raw === "string" && raw.trim()) {
          return { fileId: raw.trim(), includeInReport } as PicAssetImage;
        }
        if (raw && typeof raw === "object" && "url" in raw) {
          return { ...(raw as object), includeInReport } as PicAssetImage;
        }
        if (raw && typeof raw === "object" && "fileId" in raw) {
          const fileId = (raw as { fileId?: unknown }).fileId;
          if (typeof fileId === "string" && fileId.trim()) {
            return { ...(raw as object), fileId, includeInReport } as PicAssetImage;
          }
        }
        return image;
      });
      setPreviewPhotoFolders((prev) =>
        prev.map((row) =>
          row.sub._id === subProjectId && row.picAsset
            ? { ...row, picAsset: { ...row.picAsset, images: nextImages as PicAssetImage[] } }
            : row,
        ),
      );
      try {
        const updated = await patchMvSubprojectPicAsset(projectId, subProjectId, {
          images: mvPicAssetImagesToPatchPayload(nextImages as PicAssetImage[]),
        });
        setPreviewPhotoFolders((prev) =>
          prev.map((row) => (row.sub._id === subProjectId ? { ...row, picAsset: updated } : row)),
        );
      } catch (error) {
        setPreviewPhotoFolders((prev) =>
          prev.map((row) =>
            row.sub._id === subProjectId && row.picAsset
              ? { ...row, picAsset: { ...row.picAsset, images: previousImages } }
              : row,
          ),
        );
        toast({
          variant: "destructive",
          description:
            error instanceof Error ? error.message : t("assetImages.toast.imageReportToggleFailed"),
        });
      }
    },
    [previewPhotoFolders, projectId, t, toast],
  );

  const handleReportSelectApply = useCallback(
    (updates: MvReportSelectUpdate[]) => {
      if (updates.length === 0) return;

      const includeIds: string[] = [];
      const excludeIds: string[] = [];
      const picBatches = new Map<string, Map<number, boolean>>();
      let selectedAfter = 0;

      const pushDriveId = (id: string, selected: boolean) => {
        const trimmed = id.trim();
        if (!trimmed || isLocalPreviewDriveId(trimmed)) return;
        (selected ? includeIds : excludeIds).push(trimmed);
      };

      const driveIdsBySourceUrl = new Map<string, string[]>();
      for (const drive of filesRef.current) {
        const sourceUrl =
          typeof (drive as MvDriveFile & { sourceUrl?: string }).sourceUrl === "string"
            ? (drive as MvDriveFile & { sourceUrl?: string }).sourceUrl!.trim()
            : "";
        if (!sourceUrl || sourceUrl.includes("/files/")) continue;
        let key = sourceUrl.toLowerCase();
        try {
          const parsed = new URL(sourceUrl);
          key = `${parsed.origin.toLowerCase()}${parsed.pathname}`.toLowerCase();
        } catch {
          /* keep */
        }
        const list = driveIdsBySourceUrl.get(key) ?? [];
        list.push(drive._id);
        driveIdsBySourceUrl.set(key, list);
      }

      for (const update of updates) {
        const node = previewFoldersById.get(update.sectionId);
        if (!node) continue;
        const file = node.images.find((row) => row._id === update.imageKey);
        if (!file) continue;
        if (update.selected) selectedAfter += 1;

        if (isDisplayOnlyPicAssetImage(file)) {
          const effectiveId = effectiveDriveFileId(file);
          if (effectiveId) pushDriveId(effectiveId, update.selected);

          const sourceUrl = typeof file.sourceUrl === "string" ? file.sourceUrl.trim() : "";
          if (sourceUrl && !sourceUrl.includes("/files/")) {
            let key = sourceUrl.toLowerCase();
            try {
              const parsed = new URL(sourceUrl);
              key = `${parsed.origin.toLowerCase()}${parsed.pathname}`.toLowerCase();
            } catch {
              /* keep */
            }
            for (const driveId of driveIdsBySourceUrl.get(key) ?? []) {
              pushDriveId(driveId, update.selected);
            }
          }

          const subProjectId = file.picAssetSubProjectId?.trim() || "";
          const idx = typeof file.picAssetImageIndex === "number" ? file.picAssetImageIndex : -1;
          if (subProjectId && idx >= 0) {
            const batch = picBatches.get(subProjectId) ?? new Map<number, boolean>();
            batch.set(idx, update.selected);
            picBatches.set(subProjectId, batch);
          }
          continue;
        }
        pushDriveId(file._id, update.selected);
      }

      for (const [subProjectId, batch] of picBatches) {
        void applyPicAssetReportSelectionBatch(subProjectId, batch);
      }
      if (includeIds.length > 0) void updateReportSelection(includeIds, true);
      if (excludeIds.length > 0) void updateReportSelection(excludeIds, false);
      void syncIncludeAssetImagesFlag(selectedAfter > 0);
    },
    [
      applyPicAssetReportSelectionBatch,
      previewFoldersById,
      syncIncludeAssetImagesFlag,
      updateReportSelection,
    ],
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
            let message = t("assetImages.toast.bulkReportToggleFailed");
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
              : t("assetImages.toast.reportDisplaySaveFailed"),
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
        toast({ variant: "destructive", description: t("assetImages.delete.noSelection") });
        return;
      }
      if (!window.confirm(t("assetImages.delete.imagesConfirm", { count: numberFormatter.format(ids.length) }))) return;

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
        toast({ variant: "destructive", description: t("assetImages.delete.selectedFailed") });
      } finally {
        setDeleting(false);
      }
    },
    [loadImages, projectId, revokeOptimisticUrls, toast],
  );

  const deleteFileIdsFast = useCallback(
    (fileIds: Iterable<string>, successMessage: string) => {
      const ids = Array.from(new Set(fileIds));
      if (ids.length === 0) {
        toast({ variant: "destructive", description: t("assetImages.delete.noSelection") });
        return;
      }
      if (!window.confirm(t("assetImages.delete.imagesConfirm", { count: numberFormatter.format(ids.length) }))) return;

      const localIds = ids.filter(isLocalPreviewDriveId);
      const remoteIds = ids.filter((id) => !isLocalPreviewDriveId(id));
      if (localIds.length > 0) revokeOptimisticUrls(localIds);
      setFiles((prev) => prev.filter((file) => !ids.includes(file._id)));
      setLightboxFile((cur) => (cur && ids.includes(cur._id) ? null : cur));
      toast({ description: successMessage });

      if (remoteIds.length === 0) return;

      void (async () => {
        try {
          for (const id of remoteIds) {
            const response = await fetch(`/api/mv/projects/${projectId}/files/${id}`, {
              method: "DELETE",
              credentials: "include",
            });
            if (!response.ok) throw new Error("delete_failed");
          }
        } catch {
          toast({ variant: "destructive", description: t("errors.generic.partialDeleteResync") });
          void loadImages("revalidate");
        }
      })();
    },
    [loadImages, projectId, revokeOptimisticUrls, toast],
  );

  const deleteSingleImage = useCallback(
    (file: MvDriveFile) => {
      if (isDisplayOnlyPicAssetImage(file)) return;
      deleteFileIdsFast([file._id], t("assetImages.toast.imageDeleted"));
    },
    [deleteFileIdsFast],
  );

  const deleteFolderImages = useCallback(
    (folder: ImageFolderNode) => {
      const fileIds = collectFolderImages(folder)
        .filter((file) => !isDisplayOnlyPicAssetImage(file))
        .map((file) => file._id);
      if (fileIds.length === 0) {
        toast({ variant: "destructive", description: t("assetImages.delete.noDeletableInFolder") });
        return;
      }
      deleteFileIdsFast(
        fileIds,
        t("assetImages.toast.folderImagesDeleted"),
      );
    },
    [deleteFileIdsFast, toast],
  );

  const deletePreviewFolder = useCallback(
    async (folder: ImageFolderNode) => {
      if (folder.path === "__pv_root__") {
        toast({
          variant: "destructive",
          description: t("assetImages.delete.cannotDeleteDefault"),
        });
        return;
      }

      if (folder.isSynthetic) {
        const deletableChildren = folder.folders.filter((child) => child.path !== "__pv_root__" && !child.isSynthetic);
        if (deletableChildren.length === 0) {
          toast({
            variant: "destructive",
            description: t("assetImages.delete.noDeletableInGroup"),
          });
          return;
        }
        const imageCount = collectFolderImages(folder).length;
        const warning = t("assetImages.delete.groupConfirm", {
          name: folder.name,
          items: numberFormatter.format(deletableChildren.length),
          images: numberFormatter.format(imageCount),
        });
        if (!window.confirm(warning)) return;
        try {
          setDeleting(true);
          for (const child of deletableChildren) {
            const response = await fetch(`/api/mv/projects/${projectId}/subprojects/${child.path}`, {
              method: "DELETE",
              credentials: "include",
            });
            if (!response.ok) throw new Error("delete_failed");
          }
          if (selectedPreviewFolderId && folderContainsPath(folder, selectedPreviewFolderId)) {
            setSelectedPreviewFolderId("__pv_root__");
          }
          await Promise.all([loadPreviewPhotoFolders("revalidate"), loadImages("revalidate")]);
          toast({ description: t("assetImages.toast.groupDeleted") });
        } catch {
          toast({ variant: "destructive", description: t("assetImages.toast.groupDeleteFailed") });
        } finally {
          setDeleting(false);
        }
        return;
      }

      const imageCount = collectFolderImages(folder).length;
      const folderCount = countDescendantFolders(folder);
      const label = previewKindLabel(folder);
      const warning =
        imageCount > 0 || folderCount > 0
          ? t("assetImages.delete.folderWithChildrenConfirm", {
              kind: label,
              name: folder.name,
              images: numberFormatter.format(imageCount),
              folders: numberFormatter.format(folderCount),
            })
          : t("assetImages.delete.folderSimpleConfirm", { kind: label, name: folder.name });
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
        toast({ description: label === t("assetImages.kind.asset") ? t("assetImages.toast.assetDeleted") : t("assetImages.toast.folderDeleted") });
      } catch {
        toast({ variant: "destructive", description: label === t("assetImages.kind.asset") ? t("assetImages.toast.assetDeleteFailed") : t("assetImages.toast.folderDeleteFailed") });
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

  const deletePreviewFolderFast = useCallback(
    (folder: ImageFolderNode) => {
      if (folder.path === "__pv_root__") {
        toast({ variant: "destructive", description: t("assetImages.delete.cannotDeleteRoot") });
        return;
      }

      const collectNodes = (node: ImageFolderNode): ImageFolderNode[] => [
        node,
        ...node.folders.flatMap((child) => collectNodes(child)),
      ];
      const roots = folder.isSynthetic
        ? folder.folders.filter((child) => isManageablePreviewFolderNode(child))
        : [folder];
      if (roots.length === 0) {
        toast({ variant: "destructive", description: t("assetImages.delete.noDeletableItems") });
        return;
      }

      const nodes = roots.flatMap((node) => collectNodes(node));
      const imageCount = collectFolderImages(folder).length;
      const folderCount = folder.isSynthetic ? roots.length : countDescendantFolders(folder);
      const label = folder.isSynthetic ? t("assetImages.kind.group") : previewKindLabel(folder);
      const warning =
        imageCount > 0 || folderCount > 0
          ? t("assetImages.delete.previewWithContentConfirm", {
              kind: label,
              name: folder.name,
              images: numberFormatter.format(imageCount),
            })
          : t("assetImages.delete.previewSimpleConfirm", { kind: label, name: folder.name });
      if (!window.confirm(warning)) return;

      const nodeIds = new Set(nodes.map((node) => node.path));
      const picIds = new Set(nodes.map((node) => node.picAssetId).filter((id): id is string => Boolean(id)));
      const fileIds = new Set(
        collectFolderImages(folder)
          .filter((file) => !isDisplayOnlyPicAssetImage(file))
          .map((file) => file._id),
      );
      const parentId = previewRowsById.get(folder.path)?.sub.parent ?? null;
      const nextSelection = parentId && previewFoldersById.has(parentId) ? parentId : "__pv_root__";

      setPreviewPhotoFoldersFast((current) =>
        current.filter((row) => !nodeIds.has(row.sub._id) && !picIds.has(row.picAsset?._id ?? "")),
      );
      setFiles((current) =>
        current.filter((file) => {
          if (fileIds.has(file._id)) return false;
          if (file.picAssetId && picIds.has(file.picAssetId)) return false;
          return true;
        }),
      );
      if (selectedPreviewFolderId && folderContainsPath(folder, selectedPreviewFolderId)) {
        setSelectedPreviewFolderId(nextSelection);
      }
      toast({ description: label === t("assetImages.kind.asset") ? t("assetImages.toast.assetDeleted") : t("assetImages.toast.folderDeleted") });

      void (async () => {
        try {
          for (const root of roots) {
            const response = await fetch(`/api/mv/projects/${projectId}/subprojects/${root.path}`, {
              method: "DELETE",
              credentials: "include",
            });
            if (!response.ok) throw new Error("delete_failed");
          }
        } catch {
          toast({ variant: "destructive", description: t("errors.generic.partialDeleteResync") });
          void Promise.all([loadPreviewPhotoFolders("revalidate"), loadImages("revalidate")]);
        }
      })();
    },
    [
      loadImages,
      loadPreviewPhotoFolders,
      previewFoldersById,
      previewRowsById,
      projectId,
      selectedPreviewFolderId,
      setPreviewPhotoFoldersFast,
      toast,
    ],
  );

  const deleteSelectedItems = useCallback(() => {
    deleteFileIdsFast(reportSelectedFileIds, t("assetImages.toast.selectedForReportDeleted"));
  }, [deleteFileIdsFast, reportSelectedFileIds]);

  const deleteCurrentPathImages = useCallback(() => {
    const fileIds = collectFolderImages(selectedFolder)
      .filter((file) => !isDisplayOnlyPicAssetImage(file))
      .map((file) => file._id);
    deleteFileIdsFast(
      fileIds,
      t("assetImages.toast.currentPathDeleted"),
    );
  }, [deleteFileIdsFast, selectedFolder]);

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
          description: t("assetImages.reorder.waitUpload"),
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
          let message = t("assetImages.toast.reorderSaveFailed");
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
          description: e instanceof Error ? e.message : t("assetImages.toast.reorderSaveFailed"),
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
          description: t("assetImages.reorder.waitUpload"),
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
          description: t("assetImages.reorder.displayOnly"),
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
          let message = t("assetImages.toast.reorderSaveFailed");
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
          description: e instanceof Error ? e.message : t("assetImages.toast.reorderSaveFailed"),
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
        const included = isAssetViewFileReportIncluded(file as AssetImageViewFile, filesById);
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
          description: t("assetImages.reorder.waitUploadMove"),
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
          let message = t("assetImages.toast.locationSaveFailed");
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
          description: e instanceof Error ? e.message : t("errors.generic.saveFailed"),
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
      const nodeFiles = node ? [...collectFolderImages(node)] : [];
      if (!node || nodeFiles.length === 0) return;
      const shouldInclude = !nodeFiles.every((file) => isAssetViewFileReportIncluded(file, filesById));

      const driveFileIds: string[] = [];
      const picBatches = new Map<string, Map<number, boolean>>();
      for (const file of nodeFiles) {
        if (isDisplayOnlyPicAssetImage(file)) {
          const effectiveId = effectiveDriveFileId(file);
          if (effectiveId) {
            driveFileIds.push(effectiveId);
          }
          const sid = file.picAssetSubProjectId?.trim() || "";
          const idx = typeof file.picAssetImageIndex === "number" ? file.picAssetImageIndex : -1;
          if (sid && idx >= 0) {
            const batch = picBatches.get(sid) ?? new Map<number, boolean>();
            batch.set(idx, shouldInclude);
            picBatches.set(sid, batch);
          }
          continue;
        }
        driveFileIds.push(file._id);
      }

      if (driveFileIds.length > 0) {
        void updateReportSelection(driveFileIds, shouldInclude);
      }
      for (const [subProjectId, batch] of picBatches) {
        void applyPicAssetReportSelectionBatch(subProjectId, batch);
      }
    },
    [applyPicAssetReportSelectionBatch, filesById, previewFoldersById, updateReportSelection],
  );

  const deleteCurrentPreviewPathImages = useCallback(() => {
    if (!selectedPreviewFolderNode || selectedPreviewFolderNode.path === "__pv_root__") {
      toast({ variant: "destructive", description: t("assetImages.toast.selectFolderToDelete") });
      return;
    }
    const nodeFiles = selectedPreviewFolderNode.images.filter((file) => !isDisplayOnlyPicAssetImage(file));
    if (nodeFiles.length === 0) {
      toast({ variant: "destructive", description: t("assetImages.toast.noDirectDeletableImages") });
      return;
    }
    deleteFileIdsFast(
      nodeFiles.map((f) => f._id),
      t("assetImages.toast.previewFolderDeleted"),
    );
  }, [deleteFileIdsFast, selectedPreviewFolderNode, toast]);

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
            title={t("assetImages.actions.dragHint")}
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
          aria-label={selected ? t("assetImages.report.hideImage") : t("assetImages.report.showImage")}
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
              aria-label={t("assetImages.actions.imageMenu")}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 text-right">
            <DropdownMenuItem onSelect={() => openImage(file)} className="cursor-pointer text-[12px]">
              <ImageIcon className="h-4 w-4 text-sky-600" />
              {t("assetImages.actions.openImage")}
            </DropdownMenuItem>
            {canMutate ? (
              <>
                <DropdownMenuItem onSelect={() => toggleImageSelection(file._id)} className="cursor-pointer text-[12px]">
                  {selected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                  {selected ? t("assetImages.report.hideFromReport") : t("assetImages.report.showInReport")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => deleteSingleImage(file)}
                  className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("assetImages.actions.deleteImage")}
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
            aria-label={expanded ? t("assetImages.tree.collapseFolder") : t("assetImages.tree.expandFolder")}
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
            aria-label={selected ? t("assetImages.report.hideFolder") : t("assetImages.report.showFolder")}
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
                aria-label={t("assetImages.actions.folderMenu")}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 text-right">
              <DropdownMenuItem onSelect={() => selectFolder(node.path)} className="cursor-pointer text-[12px]">
                <FolderOpen className="h-4 w-4 text-amber-600" />
                {t("assetImages.actions.openFolder")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toggleFolderSelection(node.path)} className="cursor-pointer text-[12px]">
                {selected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                {selected ? t("assetImages.report.hideFolder") : t("assetImages.report.showFolder")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => deleteFolderImages(node)}
                className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
                {t("assetImages.actions.deleteFolderImages")}
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
    const selected = canMutate ? isAssetViewFileReportIncluded(file, filesById) : false;
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
            title={t("assetImages.actions.dragHint")}
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
          aria-label={selected ? t("assetImages.report.hideFromReport") : t("assetImages.report.showInReport")}
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
              aria-label={t("assetImages.actions.imageMenu")}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 text-right">
            <DropdownMenuItem onSelect={() => openPreviewImage(file)} className="cursor-pointer text-[12px]">
              <MediaIcon className="h-4 w-4 text-emerald-600" />
              {isVideoRow ? t("assetImages.actions.openVideo") : t("assetImages.actions.openImage")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => (displayOnly ? void togglePicAssetImageSelection(file) : canMutate && toggleImageSelection(effectiveId!))}
              disabled={displayOnly ? false : !canMutate}
              className="cursor-pointer text-[12px]"
            >
              {selected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
              {selected ? t("assetImages.report.hideFromReport") : t("assetImages.report.showInReport")}
            </DropdownMenuItem>
            <DropdownMenuItem
                                      onSelect={() => (displayOnly ? void deletePicAssetImage(file) : (canMutate && deleteFileIdsFast([effectiveId!], t("assetImages.toast.imageDeleted"))))}
              disabled={displayOnly ? false : !canMutate}
              className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
              {isVideoRow ? t("assetImages.actions.deleteVideo") : t("assetImages.actions.deleteImage")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const renderPreviewTreeFolder = (node: ImageFolderNode, level = 0, treeMedia: AppPreviewMediaTab = "images") => {
    // شجرة التنقل تعرض المجلدات فقط. عرض ملفات الورقة هنا كان يكرر الصور
    // المرئية نفسها الموجودة في شبكة المحتوى فور فتح الأصل.
    const hasChildren = node.folders.length > 0;
    const expanded = expandedPreviewIds.has(node.path);
    const active = selectedPreviewFolderId === node.path && appPreviewMediaTab === treeMedia;
    const totalSelectable = treeMedia === "videos" ? node.videoCount : node.imageCount;
    const includedSelectable = treeMedia === "videos" ? node.includedVideoCount : node.includedImageCount;
    const selected = totalSelectable > 0 && includedSelectable === totalSelectable;
    const partiallySelected = includedSelectable > 0 && includedSelectable < totalSelectable;
    const countLabel =
      treeMedia === "videos" ? numberFormatter.format(node.videoCount) : previewStatsLabel(node);
    const kindLabel = previewKindLabel(node);
    const createChildrenParentId =
      !isAssetFolderNode(node) && !node.isSynthetic && node.path !== "__pv_root__" ? node.path : null;

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
            aria-label={expanded ? t("assetImages.tree.collapseFolder") : t("assetImages.tree.expandFolder")}
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
            aria-label={selected ? t("assetImages.report.hideFromReport") : t("assetImages.report.showInReport")}
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
            {renderFolderGlyph(node, "tree")}
            <span className="min-w-0 flex-1 truncate" dir="auto">
              {node.name}
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
              {countLabel}
            </span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label={t("assetImages.actions.folderMenu")}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 text-right">
              <DropdownMenuItem onSelect={() => selectPreviewFolder(node.path, treeMedia)} className="cursor-pointer text-[12px]">
                {isAssetFolderNode(node) ? <Box className="h-4 w-4 text-emerald-600" /> : <FolderOpen className="h-4 w-4 text-amber-600" />}
                {t("assetImages.actions.openKind", { kind: kindLabel })}
              </DropdownMenuItem>
              {treeMedia === "images" && isManageablePreviewFolderNode(node) ? (
                <>
                  <DropdownMenuItem
                    onSelect={() => renamePreviewFolderInstant(node)}
                    className="cursor-pointer text-[12px]"
                  >
                    <Pencil className="h-4 w-4 text-slate-600" />
                    {t("assetImages.actions.renameKind", { kind: kindLabel })}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => openMovePreviewFolder(node)}
                    disabled={false}
                    className="cursor-pointer text-[12px]"
                  >
                    <MoveRight className="h-4 w-4 text-emerald-700" />
                    {t("assetImages.actions.moveKind", { kind: kindLabel })}
                  </DropdownMenuItem>
                </>
              ) : null}
              {createChildrenParentId && treeMedia === "images" ? (
                <>
                  <DropdownMenuItem
                    onSelect={() => void createPreviewFolder(createChildrenParentId, "folder")}
                    disabled={creatingPreviewFolder}
                    className="cursor-pointer text-[12px]"
                  >
                    <FolderPlus className="h-4 w-4 text-amber-600" />
                    {t("assetImages.actions.createSubfolder")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => void createPreviewFolder(createChildrenParentId, "asset")}
                    disabled={creatingPreviewFolder}
                    className="cursor-pointer text-[12px]"
                  >
                    <PackagePlus className="h-4 w-4 text-emerald-600" />
                    {t("assetImages.actions.createSubAsset")}
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuItem
                onSelect={() => togglePreviewFolderSelection(node.path)}
                className="cursor-pointer text-[12px]"
              >
                {selected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                {selected ? t("assetImages.report.hideFromReport") : t("assetImages.report.showInReport")}
              </DropdownMenuItem>
              {treeMedia === "images" ? (
                <DropdownMenuItem
                  onSelect={() => deleteFolderImages(node)}
                  className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("assetImages.actions.deleteFolderImages")}
                </DropdownMenuItem>
              ) : null}
              {treeMedia === "images" && node.path !== "__pv_root__" ? (
                <DropdownMenuItem
                  onSelect={() => deletePreviewFolderFast(node)}
                  disabled={deleting}
                  className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("assetImages.delete.deleteKind", { kind: kindLabel })}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {expanded ? (
          <div className="mt-0.5 space-y-0.5">
            {node.folders.map((folder) => renderPreviewTreeFolder(folder, level + 1, treeMedia))}
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
              aria-label={appExpanded ? t("assetImages.tree.collapseRoot") : t("assetImages.tree.expandRoot")}
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
              <span className="min-w-0 flex-1 truncate">{t("assetImages.rootLabel")}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                {previewStatsLabel(previewRoot)}
              </span>
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 w-8 shrink-0 p-0"
              disabled={loadingPreviewFolders}
              onClick={() => void refreshAppPicFoldersFromServer()}
              aria-label={t("assetImages.actions.refreshFromServer")}
              title={t("assetImages.actions.refreshFromServerTitle")}
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
                  {t("assetImages.tree.empty")}
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
          aria-label={t("assetImages.actions.bulkMenu")}
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
          {t("assetImages.actions.refresh")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => assetDownloadButtonRef.current?.click()}
          className="cursor-pointer text-[12px]"
        >
          <Download className="h-4 w-4 text-emerald-700" />
          {t("assetImages.actions.download")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={deleteSelectedItems}
          disabled={selectedCount === 0 || deleting}
          className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
          {t("assetImages.actions.deleteSelectedForReport")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={deleteCurrentPreviewPathImages}
          disabled={
            activeContentFiles.length === 0 || deleting || selectedPreviewFolderId === "__pv_root__"
          }
          className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
          {t("assetImages.actions.deleteCurrentPath")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => selectedPreviewFolderNode && deletePreviewFolderFast(selectedPreviewFolderNode)}
          disabled={!selectedPreviewFolderNode || selectedPreviewFolderNode.path === "__pv_root__" || deleting}
          className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
        >
          <Trash2 className="h-4 w-4" />
          {selectedPreviewFolderNode?.isSynthetic
            ? t("assetImages.actions.deleteCurrentGroup")
            : t("assetImages.actions.deleteCurrentItem", {
                kind: selectedPreviewFolderNode ? previewKindLabel(selectedPreviewFolderNode) : t("assetImages.kind.folder"),
              })}
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
          title={t("assetImages.actions.backUp")}
          aria-label={t("assetImages.actions.backUp")}
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
                  {idx === 0 ? t("assetImages.rootLabel") : node.name}
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tabular-nums text-slate-500">
        {activeContentNode.path === "__pv_root__" ? t("assetImages.root") : previewKindLabel(activeContentNode)}
        {" · "}
        {previewStatsLabel(activeContentNode)}
      </span>
    </div>
  ) : null;

  return (
    <MvWorkflowPageFrame className="bg-[var(--color-background-primary)]" dir={dir}>
      <MvProjectReportHeader
        compact
        projectId={projectId}
        activeStep="asset-images"
        breadcrumbs={[
          { label: projectName ?? projectId, href: `/machine-valuation/${projectId}/workflow/report-data` },
          { label: t("assetImages.breadcrumb") },
        ]}
      />
      <MvAssetImagesDownloadButton
        projectId={projectId}
        buttonRef={assetDownloadButtonRef}
        className="hidden"
      >
        <span>{t("assetImages.actions.download")}</span>
      </MvAssetImagesDownloadButton>

      <MvWorkflowPageScrollBody>
      <div className="mx-auto max-w-7xl px-3 pt-1 pb-2 sm:px-5">
          {assetImageListProgress.active || assetImageListProgress.partial ? (
            <div className="mt-1 mb-2 overflow-hidden rounded-lg border border-sky-100 bg-white shadow-sm" role="status" aria-live="polite">
              <div className="h-1 bg-sky-50">
                <div
                  className={cn(
                    "h-full bg-gradient-to-l from-sky-400 to-[#0C447C] transition-[width] duration-500",
                    assetImageListProgress.active && "animate-pulse",
                  )}
                  style={{ width: `${assetImageListPercent}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px]">
                <span className="flex items-center gap-2 font-semibold text-slate-700">
                  {assetImageListProgress.active ? <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-700" /> : <RefreshCw className="h-3.5 w-3.5 text-sky-700" />}
                  {assetImageListProgress.active
                    ? assetImageListProgress.total > 0
                      ? t("assetImages.progress.firstBatchShown")
                      : t("assetImages.progress.firstBatchLoading")
                    : t("assetImages.progress.partialKept")}
                </span>
                <span className="flex items-center gap-2">
                  {assetImageListProgress.total > 0 ? (
                    <b className="tabular-nums text-[#0C447C]">
                      {numberFormatter.format(assetImageListProgress.loaded)} / {numberFormatter.format(assetImageListProgress.total)}
                    </b>
                  ) : null}
                  {assetImageListProgress.partial ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[10px] font-bold text-[#0C447C]"
                      onClick={() => void loadImages("revalidate")}
                    >
                      {t("assetImages.progress.resumeNow")}
                    </Button>
                  ) : null}
                </span>
              </div>
            </div>
          ) : null}
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
                  dir={dir}
                >
                  <div className="flex w-full min-w-0 items-center gap-2 overflow-x-auto" dir={dir}>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 shrink-0 gap-2 border-emerald-200 bg-white px-3 text-[12px] font-extrabold text-emerald-900 hover:bg-emerald-50"
                        onClick={() => setAssetImageFoldersModalOpen(true)}
                      >
                        <FileSpreadsheet className="h-4 w-4 shrink-0" />
                        {t("assetImages.actions.createFolders")}
                      </Button>

                      {activeCreateParentId ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={creatingPreviewFolder}
                              className="h-9 shrink-0 gap-2 border-emerald-200 bg-white px-3 text-[12px] font-bold text-slate-800 shadow-sm hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-40"
                            >
                              {creatingPreviewFolder ? (
                                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                              ) : (
                                <FolderPlus className="h-4 w-4 text-emerald-600" />
                              )}
                              {t("assetImages.actions.create")}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 text-right">
                            <DropdownMenuItem
                              disabled={creatingPreviewFolder}
                              onSelect={(event) => {
                                event.preventDefault();
                                createFolderInActiveLocation();
                              }}
                              className="cursor-pointer text-[12px]"
                            >
                              <span className="me-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                                <FolderPlus className="h-4 w-4" />
                              </span>
                              {t("assetImages.actions.regularFolder")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={creatingPreviewFolder}
                              onSelect={(event) => {
                                event.preventDefault();
                                createAssetInActiveLocation();
                              }}
                              className="cursor-pointer text-[12px]"
                            >
                              <span className="me-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                                <PackagePlus className="h-4 w-4" />
                              </span>
                              {t("assetImages.actions.assetFolder")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            className="h-9 shrink-0 rounded-lg bg-[#0C447C] px-3 text-[12px] font-extrabold text-white hover:bg-[#0a3a66] sm:px-4"
                          >
                            <Upload className="me-2 h-3.5 w-3.5 shrink-0" />
                            {activeLocationIsAssetFolder ? t("assetImages.actions.uploadImages") : t("assetImages.actions.uploadImagesOrFolders")}
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
                            {t("assetImages.actions.uploadImages")}
                          </DropdownMenuItem>
                          {!activeLocationIsAssetFolder ? (
                            <DropdownMenuItem
                              onSelect={() => folderPickInputRef.current?.click()}
                              className="cursor-pointer text-[12px]"
                            >
                              <span className="me-2 inline-flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-700">
                                <FolderUp className="h-4 w-4" />
                              </span>
                              {t("assetImages.actions.uploadFolder")}
                            </DropdownMenuItem>
                          ) : null}
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
                        {t("assetImages.actions.search")}
                      </Button>
                    </div>

                    <div className="ms-auto flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-9 shrink-0 rounded-lg bg-emerald-700 px-3.5 text-[12px] font-black text-white shadow-sm hover:bg-emerald-800"
                        disabled={reportSelectionSaving}
                        onClick={() => setReportImagesSelectOpen(true)}
                      >
                        {t("assetImages.report.selectReportImages")}
                      </Button>

                      {reportSelectSelectedCount > 0 ? (
                        <span className="flex h-9 shrink-0 items-center rounded-full bg-emerald-100 px-2.5 text-[11px] font-bold text-emerald-950">
                          {t("assetImages.report.selectedCount", {
                            count: numberFormatter.format(reportSelectSelectedCount),
                          })}
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

                <main className="min-w-0 p-3 sm:p-4" dir={dir}>
                  {!appliedAssetSearch ? activePathBar : null}
                  {appliedAssetSearch ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 shadow-sm">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-black text-slate-900" dir="auto">
                            {appliedAssetSearchTitle}
                          </p>
                          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                            {t("assetImages.search.resultsApplied", { count: numberFormatter.format(assetSearchResults.length) })}
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
                            {t("assetImages.search.edit")}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-lg border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600"
                            onClick={clearAppliedAssetSearch}
                          >
                            {t("common.clear")}
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
                                <span className={cn(
                                  "flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-3 text-center",
                                  result.folderKind === "asset" ? "bg-emerald-50/60" : "bg-amber-50/60",
                                )}>
                                  {result.folderKind === "asset" ? (
                                    <span className="relative inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm transition group-hover:scale-105">
                                      {result.folderPreviewFile ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={resolveThumbSrc(result.folderPreviewFile) || undefined}
                                          alt=""
                                          className="absolute inset-0 h-full w-full object-cover"
                                          loading="lazy"
                                        />
                                      ) : null}
                                      <span className={cn("absolute inset-0", result.folderPreviewFile ? "bg-emerald-950/35" : "bg-gradient-to-br from-emerald-50 to-white")} />
                                      <Box className={cn("relative z-10 h-9 w-9", result.folderPreviewFile ? "text-white" : "text-emerald-700")} />
                                    </span>
                                  ) : (
                                    <FolderOpen className="h-10 w-10 text-amber-500 transition group-hover:scale-105" />
                                  )}
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
                                    {result.kind === "folder" ? (result.folderKind === "asset" ? t("assetImages.kind.asset") : t("assetImages.kind.folder")) : t("assetImages.meta.image")}
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
                            <p className="mt-2 text-[13px] font-black text-slate-700">{t("assetImages.empty.noSearchResults")}</p>
                            <p className="mt-1 text-[11px] font-semibold text-slate-500">
                              {t("assetImages.empty.noSearchResultsHint")}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : !activeContentNode ? (
                    <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white">
                      <div className="text-center">
                        <Folder className="mx-auto h-10 w-10 text-slate-300" />
                        <p className="mt-2 text-[13px] font-bold text-slate-500">{t("assetImages.empty.selectFolderFromTree")}</p>
                      </div>
                    </div>
                  ) : activeContentFolders.length === 0 && activeContentFiles.length === 0 ? (
                    <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-emerald-200 bg-white">
                      <div className="text-center">
                        <ImageIcon className="mx-auto h-10 w-10 text-emerald-200" />
                        <p className="mt-2 text-[13px] font-extrabold text-slate-600" dir="auto">
                          {t("assetImages.empty.noContentInFolder", { name: activeContentNode.name })}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-slate-500">
                          {t("assetImages.empty.noContentHint")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeContentFolders.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                          {activeContentFolders.map((folder) => {
                            const folderFiles = collectFolderImages(folder);
                            const folderSelected =
                              folderFiles.length > 0 &&
                              folderFiles.every((file) => isAssetViewFileReportIncluded(file, filesById));
                            const folderPartiallySelected =
                              !folderSelected &&
                              folderFiles.some((file) => isAssetViewFileReportIncluded(file, filesById));
                            const folderKindLabel = previewKindLabel(folder);
                            const folderCreateParentId =
                              !isAssetFolderNode(folder) && !folder.isSynthetic && folder.path !== "__pv_root__" ? folder.path : null;

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
                                  <span className="transition group-hover:scale-105">
                                    {renderFolderGlyph(folder, "card")}
                                  </span>
                                  <span className="line-clamp-2 text-[12px] font-extrabold text-slate-700" dir="auto">
                                    {folder.name}
                                  </span>
                                  <span className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                                    isAssetFolderNode(folder) ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800",
                                  )}>
                                    {previewStatsLabel(folder)}
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
                                    aria-label={folderSelected ? t("assetImages.report.hideFromReport") : t("assetImages.report.showInReport")}
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
                                        aria-label={t("assetImages.actions.folderMenu")}
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52 text-right">
                                      <DropdownMenuItem
                                        onSelect={() => selectPreviewFolder(folder.path, appPreviewMediaTab)}
                                        className="cursor-pointer text-[12px]"
                                      >
                                        {isAssetFolderNode(folder) ? <Box className="h-4 w-4 text-emerald-600" /> : <FolderOpen className="h-4 w-4 text-amber-600" />}
                                        {t("assetImages.actions.openKind", { kind: folderKindLabel })}
                                      </DropdownMenuItem>
                                      {isManageablePreviewFolderNode(folder) ? (
                                        <>
                                          <DropdownMenuItem
                                            onSelect={() => renamePreviewFolderInstant(folder)}
                                            className="cursor-pointer text-[12px]"
                                          >
                                            <Pencil className="h-4 w-4 text-slate-600" />
                                            {t("assetImages.actions.renameKind", { kind: folderKindLabel })}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onSelect={() => openMovePreviewFolder(folder)}
                                            disabled={false}
                                            className="cursor-pointer text-[12px]"
                                          >
                                            <MoveRight className="h-4 w-4 text-emerald-700" />
                                            {t("assetImages.actions.moveKind", { kind: folderKindLabel })}
                                          </DropdownMenuItem>
                                        </>
                                      ) : null}
                                      {folderCreateParentId ? (
                                        <>
                                          <DropdownMenuItem
                                            onSelect={() => void createPreviewFolder(folderCreateParentId, "folder")}
                                            disabled={creatingPreviewFolder}
                                            className="cursor-pointer text-[12px]"
                                          >
                                            <FolderPlus className="h-4 w-4 text-amber-600" />
                                            {t("assetImages.actions.createSubfolder")}
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onSelect={() => void createPreviewFolder(folderCreateParentId, "asset")}
                                            disabled={creatingPreviewFolder}
                                            className="cursor-pointer text-[12px]"
                                          >
                                            <PackagePlus className="h-4 w-4 text-emerald-600" />
                                            {t("assetImages.actions.createSubAsset")}
                                          </DropdownMenuItem>
                                        </>
                                      ) : null}
                                      <DropdownMenuItem
                                        onSelect={() => togglePreviewFolderSelection(folder.path)}
                                        className="cursor-pointer text-[12px]"
                                      >
                                        {folderSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                                        {folderSelected ? t("assetImages.report.hideFromReport") : t("assetImages.report.showInReport")}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onSelect={() => deleteFolderImages(folder)}
                                        className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        {t("assetImages.actions.deleteFolderImages")}
                                      </DropdownMenuItem>
                                      {folder.path !== "__pv_root__" ? (
                                        <DropdownMenuItem
                                          onSelect={() => deletePreviewFolderFast(folder)}
                                          disabled={deleting}
                                          className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          {t("assetImages.delete.deleteKind", { kind: folderKindLabel })}
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
                        const imageSelected = canMutate
                          ? isAssetViewFileReportIncluded(file, filesById)
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
                                  title={t("assetImages.drag.reorderDisplay")}
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
                                  aria-label={imageSelected ? t("assetImages.report.hideImage") : t("assetImages.report.showImage")}
                                />
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-900"
                                      aria-label={t("assetImages.actions.imageMenu")}
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
                                      {isVideoCell ? t("assetImages.actions.openVideo") : t("assetImages.actions.openImage")}
                                    </DropdownMenuItem>
                                    {!displayOnly ? (
                                      <>
                                        <DropdownMenuItem
                                          onSelect={() => toggleImageSelection(file._id)}
                                          className="cursor-pointer text-[12px]"
                                        >
                                          {imageSelected ? <Square className="h-4 w-4" /> : <CheckSquare className="h-4 w-4" />}
                                          {imageSelected ? t("assetImages.report.hideFromReport") : t("assetImages.report.showInReport")}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onSelect={() => deleteSingleImage(file)}
                                          className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          {t("assetImages.actions.deleteImage")}
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
                                          {imageSelected ? t("assetImages.report.hideFromReport") : t("assetImages.report.showInReport")}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onSelect={() => void deletePicAssetImage(file)}
                                          disabled={!canMutate}
                                          className="cursor-pointer text-[12px] text-red-600 focus:text-red-600"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          {t("assetImages.actions.deleteImage")}
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
                ? t("assetImages.upload.jobFolderProgress", { name: activeAssetUploadJob.folderName, current: numberFormatter.format(activeAssetUploadJob.current), total: numberFormatter.format(activeAssetUploadJob.total) })
                : t("assetImages.upload.imageCountLabel", { count: `${numberFormatter.format(activeAssetUploadJob.current)} / ${numberFormatter.format(activeAssetUploadJob.total)}` })
              : null
          }
        />
      ) : null}

      <MvReportImagesSelectModal
        open={reportImagesSelectOpen}
        onOpenChange={setReportImagesSelectOpen}
        sections={reportSelectSections}
        saving={reportSelectionSaving}
        onApplySelection={handleReportSelectApply}
      />

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

      <Dialog
        open={moveDialogFolder != null}
        onOpenChange={(open) => {
          if (!open) setMoveDialogFolder(null);
        }}
      >
        <MvDialogContent
          dir={dir}
          className="max-h-[82vh] max-w-md overflow-hidden rounded-2xl border-slate-200 bg-white p-0 shadow-2xl"
        >
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 pe-14">
            <DialogTitle className="flex items-center gap-2 text-[16px] font-black text-slate-950">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <MoveRight className="h-4 w-4" />
              </span>
              {t("assetImages.move.title", {
                kind: moveDialogFolder ? previewKindLabel(moveDialogFolder) : t("assetImages.move.itemFallback"),
              })}
            </DialogTitle>
            <DialogDescription className="mt-1 text-[12px] font-medium leading-6 text-slate-500">
              {t("assetImages.move.description")}
            </DialogDescription>
          </div>

          <div className="max-h-[54vh] space-y-1 overflow-y-auto px-4 py-3">
            {moveDestinationOptions.length > 0 ? (
              moveDestinationOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => movePreviewFolderToInstant(option.parentId)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-right text-[12px] font-bold transition",
                    option.disabled
                      ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                      : "border-slate-200 bg-white text-slate-800 hover:border-emerald-300 hover:bg-emerald-50",
                  )}
                  style={{ paddingInlineStart: 12 + option.depth * 14 }}
                >
                  {option.key === "__pv_root__" ? (
                    <FolderOpen className="h-4 w-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Folder className="h-4 w-4 shrink-0 text-amber-600" />
                  )}
                  <span className="min-w-0 flex-1 truncate" dir="auto">
                    {option.label}
                  </span>
                </button>
              ))
            ) : (
              <p className="px-2 py-6 text-center text-[12px] font-semibold text-slate-500">
                {t("assetImages.move.noDestinations")}
              </p>
            )}
          </div>
        </MvDialogContent>
      </Dialog>

      <Dialog open={assetSearchOpen} onOpenChange={setAssetSearchOpen}>
        <MvDialogContent
          dir={dir}
          className="max-h-[88vh] max-w-3xl overflow-hidden rounded-2xl border-slate-200 bg-white p-0 shadow-2xl"
        >
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 pe-14">
            <DialogTitle className="flex items-center gap-2 text-[16px] font-black text-slate-950">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Search className="h-4 w-4" />
              </span>
              {t("assetImages.search.title")}
            </DialogTitle>
            <DialogDescription className="mt-1 text-[12px] font-medium leading-6 text-slate-500">
              {t("assetImages.search.description")}
            </DialogDescription>
          </div>

          <div className="space-y-3 px-5 py-4">
            <div className="relative">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                ref={assetSearchInputRef}
                value={assetSearchQuery}
                onChange={(event) => setAssetSearchQuery(event.target.value)}
                placeholder={t("assetImages.search.placeholder")}
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
                  {t("assetImages.search.modeAll")}
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
                  {t("assetImages.search.modeRecent")}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-500">
                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                  {t("assetImages.search.statsFolder", { count: numberFormatter.format(assetSearchStats.folders) })}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                  {t("assetImages.search.statsImage", { count: numberFormatter.format(assetSearchStats.images) })}
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
                {t("assetImages.search.kindAll")}
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
                {t("assetImages.search.kindFolders")}
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
                {t("assetImages.search.kindImages")}
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
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              className="h-10 min-w-[130px] rounded-xl bg-emerald-700 px-5 text-[12px] font-extrabold text-white hover:bg-emerald-800"
              onClick={applyAssetSearch}
              disabled={assetSearchMode === "all" && assetSearchKind === "all" && !assetSearchQuery.trim()}
            >
              <Search className="h-4 w-4" />
              {t("assetImages.search.apply")}
            </Button>
          </div>
        </MvDialogContent>
      </Dialog>

      <Dialog open={lightboxFile != null} onOpenChange={(open) => !open && setLightboxFile(null)}>
        <MvDialogContent closeOnDark className="max-h-[92vh] max-w-6xl overflow-hidden border-0 bg-slate-950 p-0 text-white">
          <DialogTitle className="sr-only">
            {lightboxFile && isViewFileVideo(lightboxFile) ? t("assetImages.lightbox.previewVideo") : t("assetImages.lightbox.previewImage")}
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
        </MvDialogContent>
      </Dialog>
    </MvWorkflowPageFrame>
  );
}
