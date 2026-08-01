export { buildTemplateVariableValues } from "./build-context";
export type {
  MvWordMergeImageItem,
  MvWordMergeInput,
  MvWordTemplateVariableValues,
} from "./build-context";
export {
  mergeWordReportTemplateSmart,
  downloadWordBlob,
  downloadMergedReportFiles,
  fetchImageAsArrayBuffer,
} from "./merge";
export { mergeWordReportTemplateViaServer } from "./server-merge";
export type { MvWordMergeResult, MvWordMergeStats } from "./merge";
export { downloadBlob } from "./docx-to-pdf";
export { prepareMvWordMergeInput, loadWordMergeImages } from "./prepare-merge";
export type { MvWordImageSource } from "./prepare-merge";
