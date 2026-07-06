export {
  MV_WORD_TEXT_BOOKMARKS,
  MV_WORD_IMAGE_BOOKMARKS,
  MV_WORD_ALL_BOOKMARKS,
  listKnownBookmarkNames,
  normalizeBookmarkName,
  resolveTextBookmarkDef,
  resolveImageBookmarkDef,
} from "./bookmarks";
export type {
  MvWordBookmarkTextField,
  MvWordBookmarkImageField,
  MvWordBookmarkDef,
  MvWordTextBookmarkDef,
  MvWordImageBookmarkDef,
} from "./bookmarks";
export { buildBookmarkTextValues, buildScalarMergeValues, buildImageLoopData } from "./build-context";
export type { MvWordMergeImageItem, MvWordMergeInput } from "./build-context";
export { mergeWordHybrid as mergeWordBookmarks, scanDocxBookmarks } from "./docx-hybrid-merge";
export type { MvWordBookmarkMergeStats } from "./docx-bookmark-shared";
export {
  mergeWordReportTemplate,
  mergeWordReportTemplateSmart,
  downloadWordBlob,
  fetchImageAsArrayBuffer,
} from "./merge";
export { mergeWordReportTemplateViaServer } from "./server-merge";
export type { MvWordMergeResult } from "./merge";
export { downloadBlob } from "./docx-to-pdf";
export { prepareMvWordMergeInput, fetchWordTemplateBuffer, loadWordMergeImages } from "./prepare-merge";
export type { MvWordImageSource } from "./prepare-merge";
