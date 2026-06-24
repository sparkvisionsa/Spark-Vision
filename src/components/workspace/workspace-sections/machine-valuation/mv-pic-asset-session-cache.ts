import { MV_WORKFLOW_SESSION, writeMvWorkflowSessionJson } from "./mv-workflow-session-cache";
import { cacheHasFullPicAssetEntries, type PicAssetFolderEntry } from "./mv-pic-asset-progressive-load";
import type { MvSubProject } from "./types";

export type PicAssetFoldersCachePayload = {
  photosRootId: string;
  byId: Record<string, MvSubProject>;
  entries: PicAssetFolderEntry[];
  entriesFull?: boolean;
};

export function writePicAssetFoldersSessionCache(
  projectId: string,
  payload: PicAssetFoldersCachePayload,
): void {
  writeMvWorkflowSessionJson(MV_WORKFLOW_SESSION.previewPhotoFolders(projectId), {
    ...payload,
    entriesFull: payload.entriesFull ?? cacheHasFullPicAssetEntries(payload.entries),
  });
}
