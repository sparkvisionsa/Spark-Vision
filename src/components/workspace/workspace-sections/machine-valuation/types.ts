export interface MvProject {
  _id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  subProjectCount?: number;
  sheetCount?: number;
}

export interface MvSubProject {
  _id: string;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  sheetCount?: number;
}

export interface MvSheetData {
  _id?: string;
  projectId: string;
  subProjectId?: string;
  name: string;
  headers: string[];
  rows: Record<string, string | number | null>[];
  /** Set when listing sheets without loading full row data */
  rowCount?: number;
  sourceType: "file-import" | "manual";
  sourceFileName?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ParsedFileResult {
  sheets: {
    name: string;
    headers: string[];
    rows: Record<string, string | number | null>[];
  }[];
  sourceFileName: string;
}

/** Response from POST /api/mv/upload when persist=1 (server saves sheets) */
export interface MvUploadPersistResult {
  persisted: true;
  savedSheets: MvSheetData[];
  saveErrors: string[];
  sourceFileName: string;
  sheetCount: number;
}

export type MvUploadResponse =
  | MvUploadPersistResult
  | (ParsedFileResult & { persisted?: false; saveErrors?: string[] });

export function isMvUploadPersistResult(
  r: MvUploadResponse,
): r is MvUploadPersistResult {
  return "persisted" in r && r.persisted === true;
}

export type MvView = "projects" | "project-detail" | "sub-project-detail";
