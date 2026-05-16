import type { MvColumnFormatKind } from "@/lib/mv-hyperformula";
import type { MvValuationAccountingStore } from "./mv-valuation-accounting-store";
import type { MvValuationReadyExcelWorkspaceState } from "./mv-valuation-ready-excel-persist";

export type MvCellFontFamily =
  | "default"
  | "sans"
  | "display"
  | "serif"
  | "mono";

export type MvCellTextAlign = "start" | "center" | "end";

export interface MvCellStyle {
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: MvCellFontFamily;
  fontWeight?: "normal" | "bold";
  textAlign?: MvCellTextAlign;
}

/** حالة المشروع (تحديث يدوي): جديد → مراجعة → معتمدة */
export type MvProjectWorkflowStatus = "new" | "review" | "approved";

export type MvProjectReportType = "simple" | "advanced";

export interface MvReportTeamMember {
  id: string;
  name: string;
  title?: string;
  membershipNo?: string;
  role?: string;
}

export interface MvReportEditableSection {
  id: string;
  title: string;
  body: string;
}

export type MvReportInsertedBlockKind = "heading" | "paragraph" | "image";

export interface MvReportInsertedBlock {
  id: string;
  anchorId: string;
  kind: MvReportInsertedBlockKind;
  content?: string;
  imageDataUrl?: string;
  caption?: string;
}

export interface MvProjectReportData {
  reportReference?: string;
  reportTitle?: string;
  valuationMethod?: string;
  valuationPurpose?: string;
  valuePremise?: string;
  valuationBasis?: string;
  valuationBasisDefinition?: string;
  includeAssetImages?: boolean;
  includeValuationAccountImages?: boolean;
  reportIssueDate?: string;
  /** تاريخ اتفاقية نطاق العمل (إن وُجد) — يظهر في «التواريخ المستخدمة». */
  agreementDate?: string;
  inspectionDate?: string;
  valuationDate?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientLegalType?: string;
  clientActivity?: string;
  clientRepresentativeName?: string;
  clientRepresentativeRole?: string;
  intendedUsers?: string;
  intendedUse?: string;
  valuationFirmName?: string;
  valuationFirmLicense?: string;
  valuationFirmAddress?: string;
  leadValuerName?: string;
  leadValuerTitle?: string;
  leadValuerMembershipNo?: string;
  reportTypeLabel?: string;
  standardsVersion?: string;
  scopeOfWorkDetails?: string;
  useRestriction?: string;
  externalSpecialistUse?: string;
  esgConsiderations?: string;
  informationSources?: string;
  assetSubjectDescription?: string;
  assetDetailedDescription?: string;
  inspectionLocation?: string;
  inspectionMapUrl?: string;
  currencyLabel?: string;
  methodologyRationale?: string;
  costApproachDetails?: string;
  valuationTeam?: MvReportTeamMember[];
  importantAssumptions?: string;
  specialAssumptions?: string;
  finalValue?: number | null;
  finalValueWords?: string;
  /**
   * وضع عرض التقرير: مسودة = علامة مائية «مسودة» على كل الصفحات
   * وإخفاء صور التوقيع في جدول 24.0 رأي القيمة.
   */
  reportPresentationDraft?: boolean;
  /** محتوى HTML — مرفق مستندات مستلمة من العميل */
  receivedClientDocumentsHtml?: string;
  /** محتوى HTML — شهادة التسجيل في بوابة «تقييم» */
  sceRegistrationCertificateHtml?: string;
  /** تعديلات نصية مباشرة داخل صفحة إعداد التقرير، بما يشمل القيم الديناميكية. */
  reportTextOverrides?: Record<string, string>;
  /** محتوى HTML — نص المقدمة الإضافي داخل صفحة إعداد التقرير. */
  reportIntroExtraHtml?: string;
  /** محتوى HTML — أقسام التقرير المهنية القابلة للتحرير. */
  reportNarrativeB1?: string;
  reportNarrativeB2?: string;
  reportNarrativeB3?: string;
  reportNarrativeB4?: string;
  /** أقسام إضافية يضيفها المستخدم داخل التقرير. */
  reportEditableSections?: MvReportEditableSection[];
  /** كتل مضافة من قائمة النقر داخل صفحات التقرير. */
  reportInsertedBlocks?: MvReportInsertedBlock[];
}

export interface MvProjectLocation {
  id?: string;
  name?: string;
  region: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  mapUrl?: string;
  primaryPhone?: string;
  secondaryPhone?: string;
}

export type MvProjectContactType = "primary" | "secondary";

export interface MvProjectContact {
  type: MvProjectContactType;
  phone: string;
  locationId?: string;
  locationIndex?: number;
  locationName?: string;
}

export interface MvInspectionAssignment {
  id: string;
  inspectorUserId: string;
  inspectorName: string;
  locationIds?: string[];
  assignedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MvInspectorLogicalFileType =
  | "pdf"
  | "excel"
  | "word"
  | "image"
  | "video"
  | "audio"
  | "other";

/** يطابق عنصر `inspectorFiles` من الـ API بعد الرفع */
export interface MvInspectorFile {
  id: string;
  name: string;
  type: MvInspectorLogicalFileType;
  url: string;
  uploadedBy: string | null;
  createdAt: string;
  storage?: "digitalocean" | "gridfs" | "external";
  mimeType?: string;
  spacesKey?: string;
  gridFsFileId?: string;
  sizeBytes?: number;
  locationIds?: string[];
}

export interface MvProject {
  _id: string;
  name: string;
  /** معرّف الشركة (نفس `companies._id`) */
  companyId?: string | null;
  createdAt: string;
  updatedAt: string;
  subProjectCount?: number;
  sheetCount?: number;
  workflowStatus?: MvProjectWorkflowStatus;
  reportType?: MvProjectReportType;
  reportData?: MvProjectReportData;
  locations?: MvProjectLocation[];
  contacts?: MvProjectContact[];
  inspectionAssignments?: MvInspectionAssignment[];
  createdByUserId?: string | null;
  createdByName?: string | null;
  inspectorFiles?: MvInspectorFile[];
  /** يُحمَّل من الخادم — حالة دائمة لإجراءات التقييم (مسار النظام). */
  valuationAccountingWorkspace?: MvValuationAccountingStore;
  /** يُحمَّل من الخادم — مسار إكسيل جاهز. */
  valuationReadyExcelWorkspace?: MvValuationReadyExcelWorkspaceState;
}

/** يطابق حقول الأصل في الـ API لمجلدات الأصول تحت «2.صور المعاينة» */
export type MvSubProjectAssetType =
  | "vehicles"
  | "machinery"
  | "electronics"
  | "furniture"
  | "other";

/** صورة مرفوعة عبر GridFS (التطبيق) */
export type PicAssetImageGridFs = { fileId: string; url?: never };

/** صورة أو فيديو من نظام تخزين خارجي (التطبيق) — يُحفظ الهيكل كما يُرسل */
export type PicAssetImageExternal = {
  url: string;
  fileId?: never;
  publicId?: string;
  _id?: string;
  createdAt?: string;
  mediaType?: string;
  mimeType?: string;
  duration?: number | null;
  thumbnailUrl?: string | null;
  /** اختيار إظهار الصورة ضمن التقرير (افتراضي: true) */
  includeInReport?: boolean;
};

export type PicAssetImage = PicAssetImageGridFs | PicAssetImageExternal;

/** ملاحظة صوتية — GridFS أو ملف خارجي */
export type PicAssetVoiceNoteGridFs = { fileId: string; url?: never };
export type PicAssetVoiceNoteExternal = {
  url: string;
  fileId?: never;
  publicId?: string;
  _id?: string;
  createdAt?: string;
  duration?: number;
};
export type PicAssetVoiceNote = PicAssetVoiceNoteGridFs | PicAssetVoiceNoteExternal;

export interface PicAsset {
  _id: string;
  projectId: string;
  parent: string;
  name: string;
  importId?: string | null;
  sheetName?: string | null;
  createdAt: string;
  updatedAt: string;
  isAssetFolder: true;
  writtenDescription: string | null;
  condition: string | null;
  /** يُطبَّع في الـ API (‎vehicle‎ → ‎vehicles‎) */
  assetType: MvSubProjectAssetType | string;
  brand: string | null;
  code: string | null;
  model: string | null;
  manufactureYear: number | string | null;
  kilometersDriven: number | string | null;
  isPresent: boolean;
  createdBy: string | null;
  /** تخزين GridFS (‎fileId‎) و/أو عناوين URL خارجية */
  images: PicAssetImage[];
  voiceNotes: PicAssetVoiceNote[];
  isDone: boolean;
  /** عند ‎GET project?picAssetMode=summary‎ — عرض أعداد دون جلب المصفوفات */
  imageCount?: number;
  voiceNoteCount?: number;
}

export interface MvSubProject {
  _id: string;
  projectId: string;
  /** المجلد الأب؛ ‎`null`‎ في جذر المشروع */
  parent: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
  sheetCount?: number;
  /** بيانات أصل صور المعاينة (من ‎`assets`‎) عند وجودها */
  picAsset?: PicAsset | null;
}

/** Optional Excel-like extras; backend may persist as opaque JSON */
export interface MvSpreadsheetMeta {
  /** One format per column index, aligned with `headers` */
  columnFormats?: MvColumnFormatKind[];
  /** Pixel width per column, aligned with `headers` */
  columnWidths?: number[];
  /** Number of leading columns kept sticky while scrolling */
  frozenCols?: number;
  /** Optional cell styles aligned with row/column grid */
  cellStyles?: (MvCellStyle | null)[][];
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
  /** Column formats, formulas in cells as strings starting with "=" */
  spreadsheetMeta?: MvSpreadsheetMeta;
}

export interface MvDriveFile {
  _id: string;
  projectId: string;
  subProjectId?: string;
  picAssetId?: string;
  name: string;
  scope?: string;
  relativePath?: string;
  folderPath?: string;
  mimeType: string;
  extension?: string;
  sizeBytes: number;
  uploadedAt: string;
  updatedAt: string;
  /** ترتيب العرض داخل المجلد (صور الأصول) */
  displayOrder?: number;
  /** تظهر الصورة في إعداد/تصدير التقرير؛ الافتراضي true للصور القديمة. */
  includeInReport?: boolean;
  /** عند المزامنة من رابط خارجي إلى ‎GridFS‎ — لإخفاء التكرار مع عنصر ‎picAsset‎ */
  sourceUrl?: string;
}

export interface ParsedFileResult {
  sheets: {
    name: string;
    headers: string[];
    rows: Record<string, string | number | null>[];
    spreadsheetMeta?: MvSpreadsheetMeta;
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

export type MvView =
  | "projects"
  | "sub-project-detail"
  | "workflow"
  | "project-files"
  | "inspector-files"
  | "valuation-workflow"
  | "report-workflow"
  | "report-data-workflow"
  | "legacy-workspace";

export interface MvGeneratedFolderResult {
  photosFolderId: string;
  parentFolderName: string;
  columnName: string;
  totalValues: number;
  createdCount: number;
  existingCount: number;
  folders: MvSubProject[];
}
