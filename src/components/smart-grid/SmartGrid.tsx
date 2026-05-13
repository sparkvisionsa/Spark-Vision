"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { DetailedCellError, HyperFormula } from "hyperformula";
import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Filter,
  FolderPlus,
  ImagePlus,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Save,
  Sigma,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MV_FORMULA_SHEET } from "@/lib/mv-hyperformula";
import { cn } from "@/lib/utils";

export type SmartGridAssetType =
  | "vehicles"
  | "machinery"
  | "electronics"
  | "furniture"
  | "other";

type AssetColumnType = "text" | "number" | "date" | "boolean";
type AssetPrimitive = string | number | boolean | null;
type SortOrder = "asc" | "desc";
type TextFilterMode = "contains" | "equals";

interface AssetColumnDescriptor {
  key: string;
  label: string;
  type: AssetColumnType;
  isCustom: boolean;
}

export interface SmartGridAssetRecord {
  id: string;
  importId: string | null;
  projectId: string;
  assetType: SmartGridAssetType;
  rawData: Record<string, AssetPrimitive>;
  normalizedData: Record<string, AssetPrimitive>;
  sheetName: string | null;
  rowIndex: number | null;
  importedAt: string;
  updatedAt: string;
  status: string;
  [key: string]: unknown;
}

interface ListAssetsResponse {
  items: SmartGridAssetRecord[];
  columns: AssetColumnDescriptor[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type ColumnFilter = {
  kind: "text";
  mode: TextFilterMode;
  value: string;
};

export interface CellChange {
  assetId: string;
  columnKey: string;
  previousValue: AssetPrimitive | string;
  nextValue: AssetPrimitive | string;
  persistedValue: AssetPrimitive;
}

export interface SmartGridProps {
  projectId: string;
  importId: string;
  /** عند التحديد: جلب صفوف تلك الورقة فقط ضمن الاستيراد */
  importSheetName?: string;
  assetType: SmartGridAssetType;
  /** عند true لا يُمرَّر assetType لطلب القائمة — تظهر كل الأصول المطابقة للمشروع/الاستيراد */
  omitAssetTypeFilter?: boolean;
  /** يُستخدم لإضافة/حذف الأعمدة المخصصة عند omitAssetTypeFilter (أعمدة Mongo مرتبطة بنوع أصل) */
  schemaAssetType?: SmartGridAssetType;
  onSave: (changes: CellChange[]) => void;
  onActiveAssetChange?: (asset: SmartGridAssetRecord | null) => void;
  activeAssetId?: string;
  onRowsLoaded?: (rows: SmartGridAssetRecord[]) => void;
  /** يُستدعى عند تغيّر الصفوف المحددة (تحديد متعدد) */
  onSelectionChange?: (selectedIds: string[]) => void;
  onSaveStateChange?: (state: "idle" | "saving" | "saved" | "error") => void;
  refreshToken?: number;
  /** عمود تحديد (يمين الجدول في RTL) ثابت مع ترويسة «تحديد الكل» للصفوف المفلترة/الظاهرة */
  rowCheckboxColumn?: boolean;
  /** تعديل الخلية بلنقرة واحدة بدل النقر المزدوج */
  editOnSingleClick?: boolean;
  /** أعمدة من بيانات الاستيراد فقط (بدون حقول النظام الافتراضية) */
  sheetColumns?: boolean;
  /** إظهار زر «صف جديد» مرتبط بنفس الاستيراد */
  allowAppendImportRows?: boolean;
  /** عدد أعمدة البيانات الثابتة يميناً (مع عمود التحديد إن وُجد) — في وضع الشيت يُفضَّل 1 (معرف الأصل فقط) */
  frozenDataColumns?: number;
  /** وضع الإضافة السريعة: الإجراءات في قائمة ثلاث نقط، إضافة عمود/صف بدون حوار */
  quickAddMode?: boolean;
  /** اسم الشيت الحالي — يُعرض فوق الإجراءات ويمكن تعديله */
  displaySheetName?: string;
  /** استدعاء عند تغيير الاسم */
  onSheetNameChange?: (newName: string) => void;
  /** استدعاء لحفظ يدوي (زر حفظ) — يفرغ التعديلات المعلقة فوراً */
  onManualSave?: () => void;
  /** إخفاء شريط الإجراءات العلوي (يتولى المكوِّن الأب عرضها) */
  hideToolbar?: boolean;
  /** بعد جلب البيانات في وضع ورقة الشيت — لمزامنة عدد الصفوف/الأعمدة مع كارد الورقة */
  onSheetDimensionsChange?: (payload: {
    sheetName: string;
    importId?: string;
    rowCount: number;
    columnCount: number;
  }) => void;
  /** اقتطاع منطقة كصورة (مثلاً إكسيل جاهز — صور الحسابات) */
  accountCropMode?: boolean;
  /** عند true يُعرض كل الجسم دون virtual scroll حتى يظهر الاقتطاع كاملاً (قد يبطئ الجداول الضخمة) */
  accountCropNoVirtualize?: boolean;
  accountCropColBounds?: { min: number; max: number } | null;
  accountCropRowBounds?: { min: number; max: number } | null;
  onAccountCropColumnPick?: (dataColumn1Based: number) => void;
  onAccountCropRowPick?: (dataRow1Based: number) => void;
  /** حجم صفحة جلب السجلات (الافتراضي 50). لاقتطاع نطاق كبير ارفعه لتحميل كل الصفوف مرة واحدة. */
  listPageSize?: number;
  /** يملأ الارتفاع المتاح (مثلاً مودال بملء الشاشة) بدل ارتفاع ثابت لمنطقة التمرير */
  accountCropFillHeight?: boolean;
  /** ارتفاع صف البيانات أثناء المعاينة قبل الاقتطاع (يفيد لتوسيط النص وتقليل القص السفلي) */
  accountCropRowHeightPx?: number;
  /** تكبير عرض الأعمدة (1 = الافتراضي) */
  accountCropColumnWidthMul?: number;
  /** حجم خط خلايا البيانات (بكسل) */
  accountCropCellFontPx?: number;
  /** حجم خط ترويسة الأعمدة (بكسل) */
  accountCropHeaderFontPx?: number;
  /** حشو أفقي للخلايا (بكسل) */
  accountCropCellPadXPx?: number;
  /** حشو عمودي للخلايا (بكسل) */
  accountCropCellPadYPx?: number;
  /** تكبير/تصغير المعاينة (1 = 100%) — يؤثر على العرض فقط */
  accountCropPreviewZoom?: number;
}

interface PendingAssetPatch {
  changes: Record<string, AssetPrimitive>;
  cellChanges: CellChange[];
}

interface EditingCellState {
  assetId: string;
  columnKey: string;
  value: string;
}

const ROW_HEIGHT = 40;
const GRID_HEIGHT_CLASS = "h-[34rem]";
const VISIBLE_WINDOW_ROWS = 14;
const VISIBLE_OVERSCAN = 6;
const MAX_DOM_ROWS = 50;
const FROZEN_COLUMN_COUNT = 0;
const CHECKBOX_COL_WIDTH = 44;
const ROW_NUM_COL_WIDTH = 52;

const COLUMN_TYPE_LABELS: Record<AssetColumnType, string> = {
  text: "نصي",
  number: "رقمي",
  date: "تاريخ",
  boolean: "منطقي",
};

function parseAssetApiErrorMessage(responseText: string, fallback: string): string {
  try {
    const j = JSON.parse(responseText) as { message?: string | string[] };
    if (j.message) {
      return Array.isArray(j.message) ? j.message.join(" ") : String(j.message);
    }
  } catch {
    const t = responseText.trim();
    if (t.length > 0 && t.length < 600) return t;
  }
  return fallback;
}

function isAssetPrimitive(value: unknown): value is AssetPrimitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function toWesternDigits(value: string) {
  const easternArabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const persianDigits = "۰۱۲۳۴۵۶۷۸۹";

  return value.replace(/[٠-٩۰-۹]/g, (char) => {
    const easternIndex = easternArabicDigits.indexOf(char);
    if (easternIndex >= 0) return String(easternIndex);

    const persianIndex = persianDigits.indexOf(char);
    return persianIndex >= 0 ? String(persianIndex) : char;
  });
}

function normalizeNumberInput(value: string) {
  return toWesternDigits(value).replace(/[,\u066C]/g, "").trim();
}

function getColumnWidth(column: AssetColumnDescriptor) {
  switch (column.type) {
    case "number":
      return 132;
    case "date":
      return 148;
    case "boolean":
      return 124;
    default:
      return Math.min(Math.max(column.label.length * 13, 160), 260);
  }
}

function readCellValue(item: SmartGridAssetRecord, columnKey: string): AssetPrimitive | string {
  const rawValue = item.rawData?.[columnKey];
  if (isAssetPrimitive(rawValue)) {
    return rawValue;
  }

  const directValue = item[columnKey];
  if (isAssetPrimitive(directValue)) {
    return directValue;
  }

  const normalizedValue = item.normalizedData?.[columnKey];
  if (isAssetPrimitive(normalizedValue)) {
    return normalizedValue;
  }

  return null;
}

function isFormulaValue(value: AssetPrimitive | string) {
  return typeof value === "string" && value.trimStart().startsWith("=");
}

function stringifyCellValue(value: AssetPrimitive | string) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  return String(value);
}

function parseBooleanInput(value: string): boolean | null | undefined {
  const normalized = toWesternDigits(value).trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "1", "yes", "y", "نعم"].includes(normalized)) return true;
  if (["false", "0", "no", "n", "لا"].includes(normalized)) return false;
  return undefined;
}

function excelSerialToIsoDate(value: number) {
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + value * 86400000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeComputedFormulaValue(
  value: unknown,
  columnType: AssetColumnType,
): AssetPrimitive | undefined {
  if (value instanceof DetailedCellError) {
    return undefined;
  }

  if (value === null || value === undefined || value === "") {
    return null;
  }

  switch (columnType) {
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? value : undefined;
    case "boolean":
      if (typeof value === "boolean") return value;
      if (typeof value === "number" && (value === 0 || value === 1)) return value === 1;
      if (typeof value === "string") return parseBooleanInput(value);
      return undefined;
    case "date":
      if (typeof value === "number") return excelSerialToIsoDate(value) ?? undefined;
      if (typeof value === "string" && value.trim()) return value.trim();
      return undefined;
    case "text":
    default:
      if (typeof value === "boolean") return value ? "نعم" : "لا";
      return String(value);
  }
}

function parseManualValue(
  value: string,
  columnType: AssetColumnType,
): AssetPrimitive | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;

  switch (columnType) {
    case "number": {
      const numericValue = Number(normalizeNumberInput(trimmed));
      return Number.isFinite(numericValue) ? numericValue : undefined;
    }
    case "boolean":
      return parseBooleanInput(trimmed);
    case "date":
      return trimmed;
    case "text":
    default:
      return trimmed;
  }
}

function filterIsActive(filter: ColumnFilter | undefined) {
  if (!filter) return false;
  return filter.value.trim().length > 0;
}

function buildQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    searchParams.set(key, String(value));
  });
  return searchParams.toString();
}

export default function SmartGrid({
  projectId,
  importId,
  importSheetName,
  assetType,
  omitAssetTypeFilter = false,
  schemaAssetType,
  onSave,
  onActiveAssetChange,
  activeAssetId,
  onRowsLoaded,
  onSelectionChange,
  onSaveStateChange,
  refreshToken,
  rowCheckboxColumn = false,
  editOnSingleClick = false,
  sheetColumns = false,
  allowAppendImportRows = false,
  frozenDataColumns: frozenDataColumnsProp,
  quickAddMode = false,
  displaySheetName,
  onSheetNameChange,
  onManualSave,
  hideToolbar = false,
  onSheetDimensionsChange,
  accountCropMode = false,
  accountCropNoVirtualize = false,
  accountCropColBounds = null,
  accountCropRowBounds = null,
  onAccountCropColumnPick,
  onAccountCropRowPick,
  listPageSize = 50,
  accountCropFillHeight = false,
  accountCropRowHeightPx,
  accountCropColumnWidthMul,
  accountCropCellFontPx,
  accountCropHeaderFontPx,
  accountCropCellPadXPx,
  accountCropCellPadYPx,
  accountCropPreviewZoom,
}: SmartGridProps) {
  const { toast } = useToast();
  const effectiveListLimit = Math.max(1, listPageSize);
  const columnMutationAssetType = omitAssetTypeFilter ? (schemaAssetType ?? assetType) : assetType;

  const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contextTriggerRef = useRef<HTMLButtonElement | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const hyperFormulaRef = useRef<HyperFormula | null>(null);
  const pendingPatchesRef = useRef<Map<string, PendingAssetPatch>>(new Map());

  const [rows, setRows] = useState<SmartGridAssetRecord[]>([]);
  const [columns, setColumns] = useState<AssetColumnDescriptor[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [sortState, setSortState] = useState<{ key: string; order: SortOrder } | null>(null);
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>({});
  const [editingCell, setEditingCell] = useState<EditingCellState | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [renameColumnOpen, setRenameColumnOpen] = useState(false);
  const [renameColumnTarget, setRenameColumnTarget] = useState<AssetColumnDescriptor | null>(null);
  const [renameColumnValue, setRenameColumnValue] = useState("");
  const [isRenamingColumn, setIsRenamingColumn] = useState(false);

  const [isSubmittingColumn, setIsSubmittingColumn] = useState(false);
  const [contextMenuState, setContextMenuState] = useState<{
    column: AssetColumnDescriptor;
    x: number;
    y: number;
  } | null>(null);
  const [deletingColumnKey, setDeletingColumnKey] = useState<string | null>(null);
  const [creatingImageFoldersKey, setCreatingImageFoldersKey] = useState<string | null>(null);
  const [isDeletingRows, setIsDeletingRows] = useState(false);
  const [isAppendingRow, setIsAppendingRow] = useState(false);
  const [listNonce, setListNonce] = useState(0);
  const [columnAggregateKinds, setColumnAggregateKinds] = useState<
    Record<string, "sum" | "avg" | null>
  >({});
  const [hScrollDims, setHScrollDims] = useState({ scrollW: 0, clientW: 0, scrollL: 0 });
  const dragRef = useRef({ active: false, moved: false, startX: 0, startScroll: 0 });
  /** بعد «إضافة صف» ننتقل لآخر صفحة ليظهر الصف الجديد فوق صف العمليات */
  const jumpToLastPageAfterAppendRef = useRef(false);
  const [isRenamingSheet, setIsRenamingSheet] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  const rowIndexById = useMemo(() => {
    return new Map(rows.map((row, index) => [row.id, index]));
  }, [rows]);

  const columnIndexByKey = useMemo(() => {
    return new Map(columns.map((column, index) => [column.key, index]));
  }, [columns]);

  const columnWidths = useMemo(() => {
    const minW = sheetColumns ? 200 : 0;
    const mul =
      accountCropMode &&
      typeof accountCropColumnWidthMul === "number" &&
      Number.isFinite(accountCropColumnWidthMul) &&
      accountCropColumnWidthMul > 0
        ? accountCropColumnWidthMul
        : 1;
    /** عمود أيقونات مضغوط بجانب عنوان العمود في وضع قص الحسابات */
    const cropHeaderUiReservePx = accountCropMode ? 56 : 0;
    return Object.fromEntries(
      columns.map((column) => {
        const base = Math.max(1, Math.round(Math.max(getColumnWidth(column), minW) * mul));
        return [column.key, base + cropHeaderUiReservePx];
      }),
    );
  }, [accountCropColumnWidthMul, accountCropMode, columns, sheetColumns]);

  const cropRowHeight =
    accountCropMode &&
    typeof accountCropRowHeightPx === "number" &&
    Number.isFinite(accountCropRowHeightPx) &&
    accountCropRowHeightPx >= 28
      ? Math.round(accountCropRowHeightPx)
      : ROW_HEIGHT;
  const bodyRowHeight = accountCropMode ? cropRowHeight : ROW_HEIGHT;

  const accountCropPadStyle: CSSProperties | undefined =
    accountCropMode &&
    (typeof accountCropCellPadXPx === "number" ||
      typeof accountCropCellPadYPx === "number")
      ? {
          paddingLeft:
            typeof accountCropCellPadXPx === "number" ? accountCropCellPadXPx : undefined,
          paddingRight:
            typeof accountCropCellPadXPx === "number" ? accountCropCellPadXPx : undefined,
          paddingTop:
            typeof accountCropCellPadYPx === "number" ? accountCropCellPadYPx : undefined,
          paddingBottom:
            typeof accountCropCellPadYPx === "number" ? accountCropCellPadYPx : undefined,
        }
      : undefined;

  const totalTableWidth = useMemo(() => {
    let w = ROW_NUM_COL_WIDTH + (rowCheckboxColumn ? CHECKBOX_COL_WIDTH : 0);
    for (const col of columns) w += columnWidths[col.key];
    return w;
  }, [columns, columnWidths, rowCheckboxColumn]);

  const frozenDataColumnCount = useMemo(() => {
    if (
      typeof frozenDataColumnsProp === "number" &&
      Number.isFinite(frozenDataColumnsProp) &&
      frozenDataColumnsProp >= 0
    ) {
      return Math.min(frozenDataColumnsProp, Math.max(columns.length, 0));
    }
    if (sheetColumns && rowCheckboxColumn) {
      return 0;
    }
    return Math.min(FROZEN_COLUMN_COUNT, Math.max(columns.length, 0));
  }, [columns.length, frozenDataColumnsProp, rowCheckboxColumn, sheetColumns]);

  const stickyRightOffsets = useMemo(() => {
    let accumulated = ROW_NUM_COL_WIDTH + (rowCheckboxColumn ? CHECKBOX_COL_WIDTH : 0);
    return columns.map((column, index) => {
      if (index >= frozenDataColumnCount) return null;
      const currentOffset = accumulated;
      accumulated += columnWidths[column.key];
      return currentOffset;
    });
  }, [columns, columnWidths, frozenDataColumnCount, rowCheckboxColumn]);

  const syncFormulaSheet = useCallback((nextRows: SmartGridAssetRecord[], nextColumns: AssetColumnDescriptor[]) => {
    const engine = hyperFormulaRef.current;
    if (!engine) return;

    const sheetId = engine.getSheetId(MV_FORMULA_SHEET);
    if (sheetId === undefined) return;

    const matrix = nextRows.map((row) =>
      nextColumns.map((column) => {
        const value = readCellValue(row, column.key);
        return value === "" ? null : value;
      }),
    );

    engine.setSheetContent(sheetId, matrix.length > 0 ? matrix : [[null]]);
  }, []);

  useEffect(() => {
    const engine = HyperFormula.buildFromSheets(
      { [MV_FORMULA_SHEET]: [[""]] },
      { licenseKey: "gpl-v3" },
    );
    hyperFormulaRef.current = engine;

    return () => {
      hyperFormulaRef.current?.destroy();
      hyperFormulaRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    syncFormulaSheet(rows, columns);
  }, [columns, rows, syncFormulaSheet]);

  const fetchAssets = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const useSheetRowOrder = Boolean(
          sheetColumns && importId.trim() && importSheetName?.trim(),
        );
        const effectiveSortBy = sortState?.key ?? (useSheetRowOrder ? "rowIndex" : undefined);
        const effectiveSortOrder = sortState
          ? sortState.order
          : useSheetRowOrder
            ? "asc"
            : undefined;

        const queryString = buildQueryString({
          projectId,
          importId: importId.trim() || undefined,
          ...(importSheetName?.trim() ? { sheetName: importSheetName.trim() } : {}),
          ...(omitAssetTypeFilter ? {} : { assetType }),
          ...(omitAssetTypeFilter && schemaAssetType ? { schemaAssetType } : {}),
          ...(sheetColumns && importId.trim() ? { sheetColumns: 1 } : {}),
          page,
          limit: effectiveListLimit,
          sortBy: effectiveSortBy,
          sortOrder: effectiveSortOrder,
        });

        const response = await fetch(`/api/assets?${queryString}`, {
          credentials: "include",
          signal,
        });

        const text = await response.text();
        if (!response.ok) {
          let msg = "تعذّر تحميل بيانات الأصول.";
          try {
            const j = JSON.parse(text) as { message?: string | string[] };
            if (j?.message) {
              const m = Array.isArray(j.message) ? j.message.join(" ") : String(j.message);
              if (m.length > 0) msg = m;
            }
          } catch {
            if (text.length > 0 && text.length < 500) msg = text;
          }
          throw new Error(msg);
        }

        const payload = JSON.parse(text) as ListAssetsResponse;
        setRows(payload.items);
        setColumns(payload.columns);
        setTotal(payload.total);
        const tp = Math.max(payload.totalPages, 1);
        setTotalPages(tp);
        if (jumpToLastPageAfterAppendRef.current) {
          jumpToLastPageAfterAppendRef.current = false;
          setPage(tp);
        }
        const nextRowIds = new Set(payload.items.map((item) => item.id));
        setSelectedRowIds((current) => current.filter((id) => nextRowIds.has(id)));
        setSelectionAnchorId((current) => (current && nextRowIds.has(current) ? current : null));
      } catch (error) {
        if (signal?.aborted) return;
        setLoadError(error instanceof Error ? error.message : "تعذّر تحميل بيانات الأصول.");
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [
      assetType,
      importId,
      importSheetName,
      omitAssetTypeFilter,
      page,
      projectId,
      schemaAssetType,
      sheetColumns,
      sortState,
      effectiveListLimit,
    ],
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchAssets(controller.signal);
    return () => controller.abort();
  }, [fetchAssets, refreshToken, listNonce]);

  useEffect(() => {
    if (!onSheetDimensionsChange || !sheetColumns || !importId.trim() || !importSheetName?.trim()) {
      return;
    }
    if (isLoading) return;
    onSheetDimensionsChange({
      sheetName: importSheetName.trim(),
      importId: importId.trim() || undefined,
      rowCount: total,
      columnCount: columns.length,
    });
  }, [
    isLoading,
    total,
    columns.length,
    sheetColumns,
    importId,
    importSheetName,
    onSheetDimensionsChange,
  ]);

  useEffect(() => {
    onSelectionChange?.(selectedRowIds);
  }, [onSelectionChange, selectedRowIds]);

  useEffect(() => {
    onRowsLoaded?.(rows);
  }, [onRowsLoaded, rows]);

  useEffect(() => {
    if (rowCheckboxColumn) return;
    if (!activeAssetId) return;
    if (!rows.some((row) => row.id === activeAssetId)) return;
    setSelectedRowIds([activeAssetId]);
    setSelectionAnchorId(activeAssetId);
  }, [rowCheckboxColumn, activeAssetId, rows]);

  useEffect(() => {
    if (!onActiveAssetChange) return;
    if (rowCheckboxColumn) return;

    if (selectedRowIds.length === 0) {
      onActiveAssetChange(null);
      return;
    }

    const activeRow = rows.find((row) => row.id === selectedRowIds[selectedRowIds.length - 1]) ?? null;
    onActiveAssetChange(activeRow);
  }, [rowCheckboxColumn, onActiveAssetChange, rows, selectedRowIds]);

  useEffect(() => {
    if (!contextMenuState) return;
    const trigger = contextTriggerRef.current;
    if (!trigger) return;

    const frameId = window.requestAnimationFrame(() => {
      trigger.click();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [contextMenuState]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!onSaveStateChange) return;
    if (isSaving) {
      onSaveStateChange("saving");
    }
  }, [isSaving, onSaveStateChange]);

  const getComparableValue = useCallback(
    (row: SmartGridAssetRecord, column: AssetColumnDescriptor) => {
      const rawValue = readCellValue(row, column.key);
      if (!isFormulaValue(rawValue)) {
        return rawValue;
      }

      const engine = hyperFormulaRef.current;
      const sheetId = engine?.getSheetId(MV_FORMULA_SHEET);
      const rowIndex = rowIndexById.get(row.id);
      const columnIndex = columnIndexByKey.get(column.key);
      if (!engine || sheetId === undefined || rowIndex === undefined || columnIndex === undefined) {
        return rawValue;
      }

      return engine.getCellValue({ sheet: sheetId, row: rowIndex, col: columnIndex });
    },
    [columnIndexByKey, rowIndexById],
  );

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      return columns.every((column) => {
        const filter = filters[column.key];
        if (!filterIsActive(filter)) return true;

        const comparable = getComparableValue(row, column);
        const comparableText = String(comparable ?? "").trim().toLowerCase();
        const filterText = filter.value.trim().toLowerCase();
        if (!filterText) return true;

        if (filter.mode === "equals") {
          return comparableText === filterText;
        }
        return comparableText.includes(filterText);
      });
    });
  }, [columns, filters, getComparableValue, rows]);

  useEffect(() => {
    const valid = new Set(columns.map((column) => column.key));
    setColumnAggregateKinds((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const key of Object.keys(next)) {
        if (!valid.has(key)) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [columns]);

  /** يجمع الأرقام من الصفوف الظاهرة لأي عمود — يتعرف على أرقام داخل حقول نصية أيضاً */
  const pullNumericSamplesForColumn = useCallback(
    (column: AssetColumnDescriptor) => {
      const samples: number[] = [];
      for (const row of filteredRows) {
        const comparable = getComparableValue(row, column);
        if (typeof comparable === "number" && Number.isFinite(comparable)) {
          samples.push(comparable);
          continue;
        }
        const s = String(comparable ?? "").trim();
        if (!s) continue;
        const parsed = Number(normalizeNumberInput(s));
        if (Number.isFinite(parsed)) {
          samples.push(parsed);
        }
      }
      return samples;
    },
    [filteredRows, getComparableValue],
  );

  const filteredRowIds = useMemo(() => filteredRows.map((row) => row.id), [filteredRows]);
  const allFilteredRowsSelected =
    filteredRowIds.length > 0 && filteredRowIds.every((id) => selectedRowIds.includes(id));
  const someFilteredRowsSelected = filteredRowIds.some((id) => selectedRowIds.includes(id));

  useEffect(() => {
    const el = selectAllCheckboxRef.current;
    if (!el) return;
    el.indeterminate = someFilteredRowsSelected && !allFilteredRowsSelected;
  }, [someFilteredRowsSelected, allFilteredRowsSelected]);

  const toggleSelectAllFiltered = useCallback(() => {
    if (filteredRowIds.length === 0) return;
    if (allFilteredRowsSelected) {
      setSelectedRowIds((prev) => prev.filter((id) => !filteredRowIds.includes(id)));
    } else {
      setSelectedRowIds((prev) => Array.from(new Set([...prev, ...filteredRowIds])));
    }
  }, [allFilteredRowsSelected, filteredRowIds]);

  const tableColSpan = Math.max(columns.length + 1 + (rowCheckboxColumn ? 1 : 0), 1);

  const disableBodyVirtualization = accountCropNoVirtualize;
  const virtualRowHeight = accountCropMode ? bodyRowHeight : ROW_HEIGHT;
  const visibleRowCount = Math.min(VISIBLE_WINDOW_ROWS + VISIBLE_OVERSCAN, MAX_DOM_ROWS);
  const startIndex = disableBodyVirtualization
    ? 0
    : Math.max(0, Math.floor(scrollTop / virtualRowHeight) - Math.floor(VISIBLE_OVERSCAN / 2));
  const endIndex = disableBodyVirtualization
    ? filteredRows.length
    : Math.min(filteredRows.length, startIndex + visibleRowCount);
  const topSpacerHeight = disableBodyVirtualization ? 0 : startIndex * virtualRowHeight;
  const bottomSpacerHeight = disableBodyVirtualization
    ? 0
    : Math.max(0, (filteredRows.length - endIndex) * virtualRowHeight);
  const visibleRows = filteredRows.slice(startIndex, endIndex);

  const isColInAccountCrop = (dataCol1Based: number) =>
    accountCropColBounds != null &&
    dataCol1Based >= accountCropColBounds.min &&
    dataCol1Based <= accountCropColBounds.max;

  const isRowInAccountCrop = (dataRow1Based: number) =>
    accountCropRowBounds != null &&
    dataRow1Based >= accountCropRowBounds.min &&
    dataRow1Based <= accountCropRowBounds.max;

  const flushPendingPatches = useCallback(() => {
    void (async () => {
      const queuedEntries = [...pendingPatchesRef.current.entries()];
      pendingPatchesRef.current.clear();
      if (queuedEntries.length === 0) return;

      /** JSON.stringify يحذف المفاتيح ذات القيمة undefined فيصبح changes {} ويرفضها الخادم (IsNotEmptyObject). */
      const sanitizedEntries = queuedEntries
        .map(([assetId, patch]) => {
          const changes = Object.fromEntries(
            Object.entries(patch.changes).filter(([, v]) => v !== undefined),
          ) as Record<string, AssetPrimitive>;
          const cellChanges = patch.cellChanges.filter((cc) => {
            const v = patch.changes[cc.columnKey];
            return v !== undefined;
          });
          return { assetId, changes, cellChanges };
        })
        .filter((entry) => Object.keys(entry.changes).length > 0);

      if (sanitizedEntries.length === 0) return;

      setIsSaving(true);

      try {
        const successfulChanges: CellChange[] = [];

        await Promise.all(
          sanitizedEntries.map(async ({ assetId, changes, cellChanges }) => {
            const response = await fetch(`/api/assets/${assetId}`, {
              method: "PATCH",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                projectId,
                changes,
              }),
            });

            if (!response.ok) {
              throw new Error("تعذّر حفظ بعض التعديلات.");
            }

            successfulChanges.push(...cellChanges);
          }),
        );

        if (successfulChanges.length > 0) {
          onSave(successfulChanges);
          onSaveStateChange?.("saved");
        }
      } catch (error) {
        onSaveStateChange?.("error");
        toast({
          variant: "destructive",
          description:
            error instanceof Error ? error.message : "تعذّر حفظ بعض التعديلات.",
        });
      } finally {
        setIsSaving(false);
      }
    })();
  }, [onSave, onSaveStateChange, projectId, toast]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    if (!autoSaveEnabled) return;
    saveTimerRef.current = window.setTimeout(flushPendingPatches, 800);
  }, [autoSaveEnabled, flushPendingPatches]);

  const forceSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    flushPendingPatches();
    onManualSave?.();
  }, [flushPendingPatches, onManualSave]);

  const queueCellChange = useCallback(
    (assetId: string, change: CellChange) => {
      const existing = pendingPatchesRef.current.get(assetId) ?? {
        changes: {},
        cellChanges: [],
      };

      existing.changes[change.columnKey] =
        change.persistedValue === undefined ? null : change.persistedValue;
      existing.cellChanges = [
        ...existing.cellChanges.filter((item) => item.columnKey !== change.columnKey),
        change,
      ];

      pendingPatchesRef.current.set(assetId, existing);
      scheduleSave();
    },
    [scheduleSave],
  );

  const commitCellEdit = useCallback(() => {
    if (!editingCell) return;

    const rowIndex = rowIndexById.get(editingCell.assetId);
    const columnIndex = columnIndexByKey.get(editingCell.columnKey);
    const row = rows.find((item) => item.id === editingCell.assetId);
    const column = columns.find((item) => item.key === editingCell.columnKey);

    if (rowIndex === undefined || columnIndex === undefined || !row || !column) {
      setEditingCell(null);
      return;
    }

    const previousValue = readCellValue(row, column.key);
    const draftValue = editingCell.value;
    const isFormula = isFormulaValue(draftValue);
    let nextLocalValue: AssetPrimitive | string;
    let persistedValue: AssetPrimitive | undefined;

    if (isFormula) {
      nextLocalValue = draftValue;

      const engine = hyperFormulaRef.current;
      const sheetId = engine?.getSheetId(MV_FORMULA_SHEET);
      if (!engine || sheetId === undefined) {
        toast({ variant: "destructive", description: "تعذّر حساب المعادلة حالياً." });
        return;
      }

      engine.setCellContents(
        { sheet: sheetId, row: rowIndex, col: columnIndex },
        [[draftValue]],
      );
      persistedValue = normalizeComputedFormulaValue(
        engine.getCellValue({ sheet: sheetId, row: rowIndex, col: columnIndex }),
        column.type,
      );

      if (persistedValue === undefined) {
        toast({
          variant: "destructive",
          description: "المعادلة غير صالحة لهذا النوع من الأعمدة.",
        });
        return;
      }
    } else {
      nextLocalValue = parseManualValue(draftValue, column.type) ?? draftValue.trim();
      persistedValue = parseManualValue(draftValue, column.type);

      if (persistedValue === undefined) {
        toast({
          variant: "destructive",
          description: "القيمة المدخلة لا تطابق نوع العمود الحالي.",
        });
        return;
      }
    }

    setRows((currentRows) =>
      currentRows.map((item) =>
        item.id === editingCell.assetId
          ? {
              ...item,
              [column.key]: nextLocalValue,
            }
          : item,
      ),
    );

    queueCellChange(editingCell.assetId, {
      assetId: editingCell.assetId,
      columnKey: column.key,
      previousValue,
      nextValue: nextLocalValue,
      persistedValue,
    });

    setEditingCell(null);
  }, [columnIndexByKey, columns, editingCell, queueCellChange, rowIndexById, rows, toast]);

  const openEditor = useCallback((assetId: string, columnKey: string) => {
    const row = rows.find((item) => item.id === assetId);
    if (!row) return;

    setEditingCell({
      assetId,
      columnKey,
      value: stringifyCellValue(readCellValue(row, columnKey)),
    });
  }, [rows]);

  const handleGridPaste = useCallback(
    (event: ClipboardEvent) => {
      if (editingCell) return;
      if (selectedRowIds.length === 0 || columns.length === 0) return;

      const clipboardText = event.clipboardData?.getData("text/plain");
      if (!clipboardText?.trim()) return;

      event.preventDefault();

      const pasteRows = clipboardText.split(/\r?\n/).filter((line) => line.length > 0);
      const pasteMatrix = pasteRows.map((line) => line.split("\t"));

      const anchorRowId = selectionAnchorId ?? selectedRowIds[selectedRowIds.length - 1];
      const anchorRowIdx = filteredRows.findIndex((r) => r.id === anchorRowId);
      if (anchorRowIdx === -1) return;

      const anchorColIdx = 0;

      for (let ri = 0; ri < pasteMatrix.length; ri++) {
        const targetRowIdx = anchorRowIdx + ri;
        if (targetRowIdx >= filteredRows.length) break;
        const targetRow = filteredRows[targetRowIdx];

        for (let ci = 0; ci < pasteMatrix[ri].length; ci++) {
          const targetColIdx = anchorColIdx + ci;
          if (targetColIdx >= columns.length) break;
          const targetCol = columns[targetColIdx];
          const cellValue = pasteMatrix[ri][ci];

          const previousValue = readCellValue(targetRow, targetCol.key);
          const parsed = parseManualValue(cellValue, targetCol.type);
          const persistedValue = parsed !== undefined ? parsed : cellValue.trim() || null;

          setRows((cur) =>
            cur.map((item) =>
              item.id === targetRow.id
                ? { ...item, [targetCol.key]: persistedValue }
                : item,
            ),
          );

          queueCellChange(targetRow.id, {
            assetId: targetRow.id,
            columnKey: targetCol.key,
            previousValue,
            nextValue: persistedValue,
            persistedValue: persistedValue as AssetPrimitive,
          });
        }
      }

      toast({ description: `تم لصق البيانات.` });
    },
    [columns, editingCell, filteredRows, queueCellChange, selectedRowIds, selectionAnchorId, toast],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("paste", handleGridPaste);
    return () => container.removeEventListener("paste", handleGridPaste);
  }, [handleGridPaste]);

  const syncHScrollDims = useCallback(() => {
    const el = scrollBodyRef.current;
    if (!el) return;
    setHScrollDims((prev) => {
      const next = { scrollW: el.scrollWidth, clientW: el.clientWidth, scrollL: el.scrollLeft };
      if (prev.scrollW === next.scrollW && prev.clientW === next.clientW && prev.scrollL === next.scrollL) return prev;
      return next;
    });
  }, []);

  useEffect(() => {
    const el = scrollBodyRef.current;
    if (!el) return;
    syncHScrollDims();
    const observer = new ResizeObserver(() => syncHScrollDims());
    observer.observe(el);
    const table = el.querySelector("table");
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, [syncHScrollDims, columns]);

  const hOverflow = hScrollDims.scrollW - hScrollDims.clientW;
  const hCanLeft = hOverflow > 1 && Math.abs(hScrollDims.scrollL) < hOverflow - 2;
  const hCanRight = hOverflow > 1 && Math.abs(hScrollDims.scrollL) > 2;

  const scrollHorizontal = useCallback((direction: "left" | "right") => {
    const el = scrollBodyRef.current;
    if (!el) return;
    const step = Math.max(el.clientWidth * 0.55, 200);
    el.scrollBy({
      left: direction === "left" ? -step : step,
      behavior: "smooth",
    });
  }, []);

  const handleDragPointerDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("input, button, select, [role='button'], [role='menuitem']")) return;
      if (e.button !== 0) return;
      const el = scrollBodyRef.current;
      if (!el || el.scrollWidth <= el.clientWidth + 1) return;
      dragRef.current = { active: true, moved: false, startX: e.clientX, startScroll: el.scrollLeft };

      const onMove = (me: MouseEvent) => {
        const dx = me.clientX - dragRef.current.startX;
        if (Math.abs(dx) > 4) {
          if (!dragRef.current.moved) {
            document.body.style.cursor = "grabbing";
            el.style.userSelect = "none";
          }
          dragRef.current.moved = true;
          el.scrollLeft = dragRef.current.startScroll - dx;
        }
      };
      const onUp = () => {
        dragRef.current.active = false;
        document.body.style.cursor = "";
        el.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        requestAnimationFrame(() => {
          dragRef.current.moved = false;
        });
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [],
  );

  const handleWheelCapture = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.shiftKey) return;
    const el = scrollBodyRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  }, []);

  const toggleSort = useCallback((columnKey: string) => {
    setPage(1);
    setSortState((current) => {
      if (!current || current.key !== columnKey) {
        return { key: columnKey, order: "asc" };
      }
      return {
        key: columnKey,
        order: current.order === "asc" ? "desc" : "asc",
      };
    });
  }, []);

  const handleRowSelection = useCallback(
    (event: ReactMouseEvent<HTMLTableRowElement>, rowId: string) => {
      const currentIndex = filteredRows.findIndex((row) => row.id === rowId);
      if (currentIndex === -1) return;

      if (event.shiftKey && selectionAnchorId) {
        const anchorIndex = filteredRows.findIndex((row) => row.id === selectionAnchorId);
        if (anchorIndex !== -1) {
          const [start, end] =
            anchorIndex < currentIndex
              ? [anchorIndex, currentIndex]
              : [currentIndex, anchorIndex];
          const rangeIds = filteredRows.slice(start, end + 1).map((row) => row.id);
          setSelectedRowIds((current) => Array.from(new Set([...current, ...rangeIds])));
          return;
        }
      }

      if (event.ctrlKey || event.metaKey) {
        setSelectedRowIds((current) =>
          current.includes(rowId)
            ? current.filter((id) => id !== rowId)
            : [...current, rowId],
        );
        setSelectionAnchorId(rowId);
        return;
      }

      setSelectedRowIds([rowId]);
      setSelectionAnchorId(rowId);
    },
    [filteredRows, selectionAnchorId],
  );

  const handleAddColumn = useCallback(async () => {
    setIsSubmittingColumn(true);

    try {
      const sheetScoped =
        sheetColumns && importId.trim() && Boolean(importSheetName?.trim());
      const response = await fetch("/api/assets/columns/add", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          assetType: columnMutationAssetType,
          columnName: newColumnName,
          columnType: "text",
          ...(sheetScoped && importSheetName
            ? { importId: importId.trim(), sheetName: importSheetName.trim() }
            : {}),
        }),
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(
          parseAssetApiErrorMessage(responseText, "تعذّر إضافة العمود الجديد."),
        );
      }

      const payload = JSON.parse(responseText) as {
        success: boolean;
        column: AssetColumnDescriptor;
      };

      setColumns((current) => [...current, payload.column]);
      setRows((current) =>
        current.map((row) => ({
          ...row,
          [payload.column.key]: null,
        })),
      );
      setNewColumnName("");
      setIsAddColumnOpen(false);
      setListNonce((n) => n + 1);
    } catch (error) {
      toast({
        variant: "destructive",
        description:
          error instanceof Error ? error.message : "تعذّر إضافة العمود الجديد.",
      });
    } finally {
      setIsSubmittingColumn(false);
    }
  }, [
    columnMutationAssetType,
    importId,
    importSheetName,
    newColumnName,
    projectId,
    sheetColumns,
    toast,
  ]);

  const handleQuickAddColumn = useCallback(async () => {
    const autoName = `عمود ${columns.length + 1}`;
    setIsSubmittingColumn(true);
    try {
      const sheetScoped =
        sheetColumns && importId.trim() && Boolean(importSheetName?.trim());
      const response = await fetch("/api/assets/columns/add", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          assetType: columnMutationAssetType,
          columnName: autoName,
          columnType: "text",
          ...(sheetScoped && importSheetName
            ? { importId: importId.trim(), sheetName: importSheetName.trim() }
            : {}),
        }),
      });
      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(parseAssetApiErrorMessage(responseText, "تعذّر إضافة العمود."));
      }
      const payload = JSON.parse(responseText) as {
        success: boolean;
        column: AssetColumnDescriptor;
      };
      setColumns((current) => [...current, payload.column]);
      setRows((current) =>
        current.map((row) => ({ ...row, [payload.column.key]: null })),
      );
      setListNonce((n) => n + 1);
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "تعذّر إضافة العمود.",
      });
    } finally {
      setIsSubmittingColumn(false);
    }
  }, [
    columnMutationAssetType,
    columns.length,
    importId,
    importSheetName,
    projectId,
    sheetColumns,
    toast,
  ]);

  const deleteColumnByKey = useCallback(
    async (column: AssetColumnDescriptor) => {
      if (!window.confirm(`حذف العمود «${column.label}» من البيانات؟`)) {
        return;
      }

      setDeletingColumnKey(column.key);

      try {
        const queryString = buildQueryString({
          projectId,
          assetType: columnMutationAssetType,
          ...(sheetColumns && importId.trim() ? { importId: importId.trim() } : {}),
          ...(sheetColumns && importId.trim() && importSheetName?.trim()
            ? { sheetName: importSheetName.trim() }
            : {}),
        });

        const response = await fetch(
          `/api/assets/columns/${encodeURIComponent(column.key)}?${queryString}`,
          {
            method: "DELETE",
            credentials: "include",
          },
        );

        if (!response.ok) {
          throw new Error("تعذّر حذف العمود.");
        }

        setColumns((current) => current.filter((item) => item.key !== column.key));
        setRows((current) =>
          current.map((row) => {
            const nextRow = { ...row };
            delete nextRow[column.key];
            return nextRow;
          }),
        );
      } catch (error) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "تعذّر حذف العمود.",
        });
      } finally {
        setDeletingColumnKey(null);
      }
    },
    [
      columnMutationAssetType,
      importId,
      importSheetName,
      projectId,
      sheetColumns,
      toast,
    ],
  );

  const createImageFoldersFromColumn = useCallback(
    async (column: AssetColumnDescriptor) => {
      if (!sheetColumns || !importId.trim() || !importSheetName?.trim()) return;
      if (
        !window.confirm(
          `سيتم إنشاء مجلدات داخل «2.صور المعاينة» في ملفات مشروع التقييم (مسار المشروع /machine-valuation/${projectId})، بواحد لكل قيمة فريدة في العمود «${column.label}». المتابعة؟`,
        )
      ) {
        return;
      }
      setCreatingImageFoldersKey(column.key);
      try {
        const response = await fetch(
          `/api/mv/projects/${encodeURIComponent(projectId)}/asset-import-image-folders`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              columnKey: column.key,
              importId: importId.trim(),
              sheetName: importSheetName.trim(),
            }),
          },
        );
        const responseText = await response.text();
        if (!response.ok) {
          throw new Error(parseAssetApiErrorMessage(responseText, "تعذّر إنشاء مجلدات الصور."));
        }
        const payload = JSON.parse(responseText) as {
          createdCount: number;
          existingCount: number;
          totalValues: number;
          parentFolderName: string;
        };
        toast({
          description: `تم ضبط ${payload.totalValues} مجلداً تحت «${payload.parentFolderName}» (جديد: ${payload.createdCount.toLocaleString("ar-SA")}، موجود مسبقاً: ${payload.existingCount.toLocaleString("ar-SA")}). يمكنك فتحها من خطوة ملفات المشروع.`,
        });
      } catch (error) {
        toast({
          variant: "destructive",
          description: error instanceof Error ? error.message : "تعذّر إنشاء مجلدات الصور.",
        });
      } finally {
        setCreatingImageFoldersKey(null);
      }
    },
    [importId, importSheetName, projectId, sheetColumns, toast],
  );

  const openRenameColumnDialog = useCallback((column: AssetColumnDescriptor) => {
    setRenameColumnTarget(column);
    setRenameColumnValue(column.label);
    setRenameColumnOpen(true);
  }, []);

  const submitRenameColumn = useCallback(async () => {
    if (!renameColumnTarget || !importId.trim() || !importSheetName?.trim()) {
      toast({
        variant: "destructive",
        description: "تعديل الاسم متاح فقط ضمن ورقة الاستيراد الحالية.",
      });
      return;
    }
    setIsRenamingColumn(true);
    try {
      const response = await fetch("/api/assets/columns/rename", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          assetType: columnMutationAssetType,
          importId: importId.trim(),
          sheetName: importSheetName.trim(),
          fieldKey: renameColumnTarget.key,
          newLabel: renameColumnValue,
        }),
      });
      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(parseAssetApiErrorMessage(responseText, "تعذّر تعديل اسم الرأس."));
      }
      const payload = JSON.parse(responseText) as { column: AssetColumnDescriptor };
      setColumns((current) =>
        current.map((c) => (c.key === payload.column.key ? { ...c, label: payload.column.label } : c)),
      );
      setRenameColumnOpen(false);
      setRenameColumnTarget(null);
      setListNonce((n) => n + 1);
      toast({ description: "تم تعديل اسم الرأس." });
    } catch (error) {
      toast({
        variant: "destructive",
        description: error instanceof Error ? error.message : "تعذّر تعديل اسم الرأس.",
      });
    } finally {
      setIsRenamingColumn(false);
    }
  }, [
    columnMutationAssetType,
    importId,
    importSheetName,
    projectId,
    renameColumnTarget,
    renameColumnValue,
    toast,
  ]);

  const handleDeleteColumn = useCallback(async () => {
    if (!contextMenuState) return;
    await deleteColumnByKey(contextMenuState.column);
    setContextMenuState(null);
  }, [contextMenuState, deleteColumnByKey]);

  const handleAppendImportRow = useCallback(async () => {
    if (!importId.trim()) return;
    setIsAppendingRow(true);
    try {
      const response = await fetch("/api/assets/rows", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          importId: importId.trim(),
          ...(importSheetName?.trim() ? { sheetName: importSheetName.trim() } : {}),
        }),
      });
      const text = await response.text();
      if (!response.ok) {
        let msg = "تعذّر إضافة الصف.";
        try {
          const j = JSON.parse(text) as { message?: string | string[] };
          if (j.message) msg = Array.isArray(j.message) ? j.message.join(" ") : j.message;
        } catch {
          if (text.length < 400) msg = text;
        }
        throw new Error(msg);
      }
      toast({ description: "تمت إضافة صف جديد." });
      jumpToLastPageAfterAppendRef.current = true;
      setListNonce((n) => n + 1);
    } catch (e) {
      toast({
        variant: "destructive",
        description: e instanceof Error ? e.message : "تعذّر إضافة الصف.",
      });
    } finally {
      setIsAppendingRow(false);
    }
  }, [importId, importSheetName, projectId, toast]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedRowIds.length === 0) return;
    const idsToDelete = [...selectedRowIds];
    if (!window.confirm(`حذف ${idsToDelete.length} صفاً من الجدول؟`)) return;

    setIsDeletingRows(true);
    try {
      const response = await fetch("/api/assets/bulk", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          assetIds: idsToDelete,
        }),
      });

      if (!response.ok) {
        throw new Error("تعذّر حذف الصفوف المحددة.");
      }

      setRows((current) => current.filter((row) => !idsToDelete.includes(row.id)));
      setSelectedRowIds([]);
      setSelectionAnchorId(null);
      setTotal((current) => Math.max(0, current - idsToDelete.length));
      setListNonce((n) => n + 1);
      toast({ description: `تم حذف ${idsToDelete.length} صفاً.` });
    } catch (error) {
      toast({
        variant: "destructive",
        description:
          error instanceof Error ? error.message : "تعذّر حذف الصفوف المحددة.",
      });
    } finally {
      setIsDeletingRows(false);
    }
  }, [projectId, selectedRowIds, toast]);

  const clearFilter = useCallback((columnKey: string) => {
    setFilters((current) => {
      const nextFilters = { ...current };
      delete nextFilters[columnKey];
      return nextFilters;
    });
  }, []);

  const renderDisplayValue = useCallback(
    (row: SmartGridAssetRecord, column: AssetColumnDescriptor) => {
      const rawValue = readCellValue(row, column.key);
      if (!isFormulaValue(rawValue)) {
        return stringifyCellValue(rawValue);
      }

      const engine = hyperFormulaRef.current;
      const sheetId = engine?.getSheetId(MV_FORMULA_SHEET);
      const rowIndex = rowIndexById.get(row.id);
      const columnIndex = columnIndexByKey.get(column.key);
      if (!engine || sheetId === undefined || rowIndex === undefined || columnIndex === undefined) {
        return rawValue;
      }

      const computed = engine.getCellValue({ sheet: sheetId, row: rowIndex, col: columnIndex });
      if (computed instanceof DetailedCellError) {
        return computed.message;
      }

      return stringifyCellValue(computed as AssetPrimitive);
    },
    [columnIndexByKey, rowIndexById],
  );

  const hasActiveFilters = Object.values(filters).some((filter) => filterIsActive(filter));
  const activeFilterEntries = Object.entries(filters).filter(([, filter]) => filterIsActive(filter));
  const selectedRows = filteredRows.filter((row) => selectedRowIds.includes(row.id));
  const numericSummary = useMemo(() => {
    const numericColumns = columns.filter((column) => column.type === "number");
    if (selectedRows.length === 0 || numericColumns.length === 0) {
      return { sum: null as number | null, average: null as number | null };
    }

    const values = selectedRows.flatMap((row) =>
      numericColumns
        .map((column) => getComparableValue(row, column))
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    );

    if (values.length === 0) {
      return { sum: null, average: null };
    }

    const sum = values.reduce((totalValue, currentValue) => totalValue + currentValue, 0);
    return { sum, average: sum / values.length };
  }, [columns, getComparableValue, selectedRows]);

  const handleExport = useCallback(() => {
    const query = new URLSearchParams({
      projectId,
      format: "xlsx",
      ...(omitAssetTypeFilter ? {} : { assetType }),
    });
    window.open(`/api/assets/export?${query.toString()}`, "_blank", "noopener,noreferrer");
  }, [assetType, omitAssetTypeFilter, projectId]);

  return (
    <div
      className={cn(
        "flex flex-col",
        accountCropFillHeight ? "h-full min-h-0 flex-1 gap-2" : "space-y-3",
      )}
      dir="rtl"
    >
      <style>{`
        /* عمودي فقط: إخفاء شريط التمرير الأفقي الرمادي تحت الجدول */
        .sg-scroll { overflow: auto !important; scrollbar-width: thin; scrollbar-color: rgba(100,116,139,.55) transparent; }
        .sg-scroll::-webkit-scrollbar { width: 10px; }
        .sg-scroll::-webkit-scrollbar:horizontal { display: none !important; height: 0 !important; max-height: 0 !important; }
        .sg-scroll::-webkit-scrollbar:vertical { width: 10px; }
        .sg-scroll::-webkit-scrollbar-thumb { background: rgba(100,116,139,.6); border-radius: 999px; border: 2px solid transparent; background-clip: padding-box; }
        .sg-scroll::-webkit-scrollbar-thumb:hover { background: rgba(71,85,105,.8); border: 2px solid transparent; background-clip: padding-box; }
        .sg-scroll::-webkit-scrollbar-track { background: rgba(226,232,240,.45); border-radius: 999px; }
        .sg-scroll::-webkit-scrollbar-track:horizontal { display: none !important; height: 0 !important; background: transparent !important; }
        .sg-scroll::-webkit-scrollbar-corner { background: transparent; }
      `}</style>
      {!hideToolbar ? <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 rounded-t-2xl border border-b-0 bg-gradient-to-b from-slate-50/80 to-white pe-8 ps-3 py-1.5",
          accountCropFillHeight && "shrink-0",
        )}
        style={{ borderColor: "var(--color-border-tertiary)" }}
      >
        {/* يسار — اسم الشيت + إحصائيات */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {displaySheetName !== undefined ? (
            isRenamingSheet ? (
              <div
                className="flex items-center gap-1"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    const trimmed = renameValue.trim();
                    if (trimmed && trimmed !== displaySheetName) onSheetNameChange?.(trimmed);
                    setIsRenamingSheet(false);
                  }
                }}
              >
                <Input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const trimmed = renameValue.trim();
                      if (trimmed) onSheetNameChange?.(trimmed);
                      setIsRenamingSheet(false);
                    }
                    if (e.key === "Escape") {
                      setIsRenamingSheet(false);
                    }
                  }}
                  className="h-7 w-44 rounded-md border-sky-300 bg-sky-50/60 px-2 text-[12px] font-medium text-slate-900 focus-visible:ring-1 focus-visible:ring-sky-400"
                  dir="auto"
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const trimmed = renameValue.trim();
                    if (trimmed) onSheetNameChange?.(trimmed);
                    setIsRenamingSheet(false);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setRenameValue(displaySheetName ?? "");
                  setIsRenamingSheet(true);
                }}
                className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-slate-800 transition hover:bg-slate-100"
                title="تعديل اسم الجدول"
              >
                <span className="max-w-[220px] truncate">{displaySheetName}</span>
                <Pencil className="h-3 w-3 shrink-0 text-slate-400" />
              </button>
            )
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            <span
              className="rounded-full border px-2 py-0.5"
              style={{
                borderColor: "var(--color-border-tertiary)",
                background: "var(--color-background-secondary)",
                color: "var(--color-text-secondary)",
              }}
            >
              {total} سجل
            </span>
            <span
              className="rounded-full border px-2 py-0.5"
              style={{
                borderColor: "var(--color-border-tertiary)",
                background: "var(--color-background-secondary)",
                color: "var(--color-text-secondary)",
              }}
            >
              ص {page}/{Math.max(totalPages, 1)}
            </span>
            {selectedRowIds.length > 0 ? (
              <span
                className="rounded-full border px-2 py-0.5"
                style={{
                  borderColor: "#B5D4F4",
                  background: "#E6F1FB",
                  color: "#0C447C",
                }}
              >
                محدد: {selectedRowIds.length}
              </span>
            ) : null}
            {isSaving ? (
              <span
                className="rounded-full border px-2 py-0.5"
                style={{ borderColor: "#B5D4F4", background: "#E6F1FB", color: "#0C447C" }}
              >
                جارٍ الحفظ...
              </span>
            ) : null}
          </div>
        </div>

        {/* يمين — أزرار الإجراءات (قابل للتمرير على الشاشات الضيقة) */}
        <div className="flex max-w-full min-w-0 flex-wrap items-center justify-end gap-1 overflow-x-auto">
          {/* toggle حفظ تلقائي */}
          <button
            type="button"
            onClick={() => setAutoSaveEnabled((v) => !v)}
            className={cn(
              "group/toggle flex h-7 items-center gap-2 rounded-full px-2.5 text-[10px] font-semibold shadow-sm transition-all duration-300",
              autoSaveEnabled
                ? "border border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-emerald-100/80 text-emerald-800 hover:shadow-md hover:shadow-emerald-200/40"
                : "border border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 text-slate-500 hover:shadow-md hover:shadow-slate-200/40",
            )}
            title={autoSaveEnabled ? "الحفظ التلقائي مفعّل — اضغط لإيقافه" : "الحفظ التلقائي معطّل — اضغط لتفعيله"}
          >
            <span
              className={cn(
                "relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors duration-300",
                autoSaveEnabled
                  ? "bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-inner shadow-emerald-600/20"
                  : "bg-gradient-to-r from-slate-300 to-slate-400 shadow-inner shadow-slate-500/20",
              )}
            >
              <span
                className={cn(
                  "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-300 ease-in-out",
                  autoSaveEnabled
                    ? "translate-x-[3px] ring-1 ring-emerald-300/50"
                    : "translate-x-[15px] ring-1 ring-slate-300/50",
                )}
              />
            </span>
            <span className="select-none">حفظ تلقائي</span>
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={forceSave}
            className="flex h-7 items-center gap-1 rounded-lg border border-sky-200/80 bg-white px-2.5 text-[11px] text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50 disabled:opacity-40"
          >
            {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            حفظ
          </button>
          {allowAppendImportRows && importId.trim() ? (
            <button
              type="button"
              disabled={isAppendingRow || isLoading}
              onClick={() => void handleAppendImportRow()}
              className="flex h-7 items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-2.5 text-[11px] text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
            >
              {isAppendingRow ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              صف
            </button>
          ) : null}
          <button
            type="button"
            disabled={quickAddMode ? isSubmittingColumn : false}
            onClick={quickAddMode ? () => void handleQuickAddColumn() : () => setIsAddColumnOpen(true)}
            className="flex h-7 items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-2.5 text-[11px] text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
          >
            {isSubmittingColumn ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            عمود
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex h-7 items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-2.5 text-[11px] text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Download className="h-3 w-3" />
            تصدير
          </button>
          {selectedRowIds.length > 0 ? (
            <>
              <div className="mx-0.5 h-5 w-px bg-slate-200" />
              <button
                type="button"
                disabled={isDeletingRows}
                onClick={() => void handleBulkDelete()}
                className="flex h-7 items-center gap-1 rounded-lg border border-red-200/60 bg-white px-2.5 text-[11px] text-red-500 shadow-sm transition hover:border-red-300 hover:bg-red-50 disabled:opacity-30"
              >
                {isDeletingRows ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                حذف المحدد ({selectedRowIds.length})
              </button>
            </>
          ) : null}
        </div>
      </div> : null}

      <div
        ref={containerRef}
        tabIndex={0}
        className={cn(
          "group/grid relative border bg-white shadow-sm outline-none",
          hideToolbar ? "rounded-2xl" : "rounded-b-2xl border-t-0",
          accountCropFillHeight && "flex min-h-0 min-w-0 flex-1 flex-col",
        )}
        style={{ borderColor: "var(--color-border-tertiary)" }}
      >
        {hCanLeft ? (
          <button
            type="button"
            aria-label="تمرير لليسار"
            onClick={() => scrollHorizontal("left")}
            className="absolute left-0 top-1/2 z-[60] -translate-y-1/2 rounded-r-xl border border-l-0 border-slate-200/80 bg-white/90 px-1 py-4 shadow-lg backdrop-blur-sm transition-all hover:bg-sky-50 hover:shadow-xl active:scale-95"
          >
            <ChevronsLeft className="h-4 w-4 text-slate-500" />
          </button>
        ) : null}
        {hCanRight ? (
          <button
            type="button"
            aria-label="تمرير لليمين"
            onClick={() => scrollHorizontal("right")}
            className="absolute right-0 top-1/2 z-[60] -translate-y-1/2 rounded-l-xl border border-r-0 border-slate-200/80 bg-white/90 px-1 py-4 shadow-lg backdrop-blur-sm transition-all hover:bg-sky-50 hover:shadow-xl active:scale-95"
          >
            <ChevronsRight className="h-4 w-4 text-slate-500" />
          </button>
        ) : null}
        <div
          ref={scrollBodyRef}
          data-grid-scroll
          className={cn(
            "relative overflow-auto overscroll-contain sg-scroll",
            accountCropFillHeight ? "min-h-0 flex-1" : GRID_HEIGHT_CLASS,
          )}
          onScroll={(event) => {
            const el = event.currentTarget;
            setScrollTop(el.scrollTop);
            setHScrollDims({ scrollW: el.scrollWidth, clientW: el.clientWidth, scrollL: el.scrollLeft });
          }}
          onMouseDown={handleDragPointerDown}
          onClickCapture={(e) => {
            if (dragRef.current.moved) {
              e.stopPropagation();
              e.preventDefault();
            }
          }}
          onWheelCapture={handleWheelCapture}
        >
          <div
            className="inline-block min-w-0"
            style={
              accountCropMode &&
              typeof accountCropPreviewZoom === "number" &&
              Number.isFinite(accountCropPreviewZoom) &&
              accountCropPreviewZoom > 0 &&
              accountCropPreviewZoom !== 1
                ? ({ zoom: accountCropPreviewZoom } as CSSProperties & { zoom?: number })
                : undefined
            }
          >
          <table
            data-account-crop-table={accountCropMode ? "1" : undefined}
            className={cn(
              "border-separate border-spacing-0 text-right",
              accountCropMode && "antialiased",
            )}
            dir="rtl"
            style={{
              minWidth: accountCropMode
                ? `max(100%, ${Math.max(totalTableWidth, 0)}px)`
                : Math.max(totalTableWidth, 0),
            }}
          >
            <thead
              className={cn(
                "sticky top-0 z-50 shadow-[0_1px_0_#D3D1C7]",
                accountCropMode
                  ? "overflow-visible bg-[#0C447C] shadow-[0_2px_0_#062640]"
                  : "bg-[#F1EFE8]",
              )}
            >
              <tr>
                <th
                  className={cn(
                    "border-b px-1 py-2 text-center align-middle text-[10px] select-none",
                    accountCropMode
                      ? "border-[#0a3560] font-extrabold text-white"
                      : "font-semibold text-[#5F5E5A]",
                  )}
                  style={{
                    position: "sticky",
                    right: 0,
                    zIndex: 52,
                    width: ROW_NUM_COL_WIDTH,
                    minWidth: ROW_NUM_COL_WIDTH,
                    maxWidth: ROW_NUM_COL_WIDTH,
                    background: accountCropMode ? "#0C447C" : "#F1EFE8",
                    borderColor: accountCropMode ? "#0a3560" : "#D3D1C7",
                  }}
                >
                  رقم
                </th>
                {rowCheckboxColumn ? (
                  <th
                    className={cn("border-b px-1 py-2 text-center align-middle", accountCropMode && "border-[#0a3560]")}
                    style={{
                      position: "sticky",
                      right: ROW_NUM_COL_WIDTH,
                      zIndex: 52,
                      width: CHECKBOX_COL_WIDTH,
                      minWidth: CHECKBOX_COL_WIDTH,
                      maxWidth: CHECKBOX_COL_WIDTH,
                      background: accountCropMode ? "#0C447C" : "#F1EFE8",
                      borderColor: accountCropMode ? "#0a3560" : "#D3D1C7",
                    }}
                  >
                    <input
                      ref={selectAllCheckboxRef}
                      type="checkbox"
                      checked={allFilteredRowsSelected}
                      onChange={() => toggleSelectAllFiltered()}
                      aria-label="تحديد كل الصفوف الظاهرة بعد الفلترة"
                      className="h-4 w-4 cursor-pointer accent-[#0C447C]"
                    />
                  </th>
                ) : null}
                {columns.map((column, index) => {
                  const stickyStyle: CSSProperties =
                    index < frozenDataColumnCount
                      ? {
                          position: "sticky",
                          right: stickyRightOffsets[index] ?? 0,
                          zIndex: 51,
                        }
                      : {};
                  const filter = filters[column.key];
                  const isFiltered = filterIsActive(filter);
                  const isSorted = sortState?.key === column.key;

                  return (
                    <th
                      key={column.key}
                      data-sg-hcol={accountCropMode ? index + 1 : undefined}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        const containerBox = containerRef.current?.getBoundingClientRect();
                        setContextMenuState({
                          column,
                          x: event.clientX - (containerBox?.left ?? 0),
                          y: event.clientY - (containerBox?.top ?? 0),
                        });
                      }}
                      className={cn(
                        "border-b border-l px-3 py-2 text-center align-middle",
                        accountCropMode
                          ? cn(
                              "text-[12px] font-extrabold text-white",
                              isColInAccountCrop(index + 1)
                                ? "border-l-white/30 bg-[#0a3558] ring-2 ring-amber-300 ring-inset"
                                : "border-l-white/20 bg-[#0C447C]",
                              index < frozenDataColumnCount &&
                                "shadow-[inset_1px_0_0_rgba(255,255,255,0.12)]",
                            )
                          : cn(
                              "border-l-[#D3D1C7]/60 text-[11px] font-medium text-[#5F5E5A]",
                              isSorted && "bg-[#EBF4FF] text-[#0C447C]",
                              index < frozenDataColumnCount && "shadow-[inset_1px_0_0_rgba(211,209,199,0.9)]",
                            ),
                      )}
                      style={{
                        ...stickyStyle,
                        minWidth: columnWidths[column.key],
                        width: columnWidths[column.key],
                        ...(accountCropMode ? { overflow: "visible" as const } : {}),
                        ...(!accountCropMode
                          ? {
                              background: isSorted ? "#EBF4FF" : "#F1EFE8",
                              borderColor: "#D3D1C7",
                            }
                          : { borderColor: "rgba(255,255,255,0.22)" }),
                        ...(accountCropMode && typeof accountCropHeaderFontPx === "number"
                          ? { fontSize: accountCropHeaderFontPx }
                          : {}),
                      }}
                    >
                      <div
                        className={cn(
                          "w-full min-w-0",
                          accountCropMode ? "flex items-start gap-2" : "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-1.5 gap-y-1",
                        )}
                      >
                        {accountCropMode ? (
                          <>
                            <button
                              type="button"
                              className="flex min-h-[2.25rem] min-w-0 flex-1 flex-col items-stretch gap-0.5 text-right text-white"
                              onClick={() => toggleSort(column.key)}
                            >
                              <span
                                data-account-crop-header-label="1"
                                className="line-clamp-3 min-w-0 break-words text-[1em] font-extrabold leading-snug"
                              >
                                {column.label}
                              </span>
                              <span data-sg-exclude-from-capture="1" className="flex items-center gap-1 text-[10px] font-bold text-white/75" aria-hidden>
                                ترتيب
                                {isSorted ? (
                                  sortState?.order === "asc" ? (
                                    <ArrowUp className="h-3 w-3 shrink-0 text-amber-200" />
                                  ) : (
                                    <ArrowDown className="h-3 w-3 shrink-0 text-amber-200" />
                                  )
                                ) : (
                                  <ArrowDownUp className="h-3 w-3 shrink-0 text-white/45" />
                                )}
                              </span>
                            </button>
                            <div
                              data-sg-exclude-from-capture="1"
                              className="flex shrink-0 flex-col gap-0.5 border-r border-white/25 pe-1.5"
                            >
                              {onAccountCropColumnPick ? (
                                <button
                                  type="button"
                                  title="حد العمود للقص"
                                  className={cn(
                                    "inline-flex h-6 w-6 items-center justify-center rounded border transition-colors",
                                    isColInAccountCrop(index + 1)
                                      ? "border-amber-600 bg-amber-300 text-amber-950 shadow-sm"
                                      : "border-white/35 bg-white/10 text-white hover:bg-white/20",
                                  )}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onAccountCropColumnPick(index + 1);
                                  }}
                                  aria-label={`تحديد العمود ${index + 1} لاقتطاع الصورة`}
                                >
                                  <ImagePlus className="h-3 w-3" strokeWidth={2.25} />
                                </button>
                              ) : null}
                              <Popover modal={false}>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    title="فلترة"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={(event) => event.stopPropagation()}
                                    className={cn(
                                      "inline-flex h-6 w-6 items-center justify-center rounded border border-white/35 bg-white/10 text-white transition-colors hover:bg-white/20",
                                      isFiltered && "border-amber-400 bg-amber-200/90 text-amber-950",
                                    )}
                                    aria-label={`فلترة ${column.label}`}
                                  >
                                    <Filter className="h-3 w-3" strokeWidth={2.25} />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="start"
                                  className="z-[960] w-72 space-y-3 rounded-lg border p-3 shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                                  style={{
                                    borderColor: "var(--color-border-secondary)",
                                    background: "var(--color-background-primary)",
                                  }}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-slate-800">{column.label}</p>
                                    <p className="text-xs text-slate-500">نوع العمود: {COLUMN_TYPE_LABELS[column.type]}</p>
                                  </div>
                                  <div className="space-y-2">
                                    <Select
                                      value={filter?.mode ?? "contains"}
                                      onValueChange={(value: TextFilterMode) =>
                                        setFilters((current) => ({
                                          ...current,
                                          [column.key]: {
                                            kind: "text",
                                            mode: value,
                                            value: current[column.key]?.value ?? "",
                                          },
                                        }))
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="نوع المطابقة" />
                                      </SelectTrigger>
                                      <SelectContent className="z-[970]">
                                        <SelectItem value="contains">يحتوي على</SelectItem>
                                        <SelectItem value="equals">يساوي</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      placeholder="أدخل قيمة الفلترة"
                                      value={filter?.value ?? ""}
                                      onChange={(event) =>
                                        setFilters((current) => ({
                                          ...current,
                                          [column.key]: {
                                            kind: "text",
                                            mode: current[column.key]?.mode ?? "contains",
                                            value: event.target.value,
                                          },
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => clearFilter(column.key)}>
                                      مسح الفلتر
                                    </Button>
                                    <span className="text-xs text-slate-400">{isFiltered ? "مفعّل" : "—"}</span>
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <DropdownMenu modal={false}>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    title="المزيد"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={(event) => event.stopPropagation()}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-white/35 bg-white/10 text-white transition-colors hover:bg-white/20"
                                    aria-label={`إجراءات ${column.label}`}
                                  >
                                    <MoreVertical className="h-3 w-3" strokeWidth={2.25} />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="z-[960] min-w-[10rem]">
                                  {sheetColumns && importId.trim() && importSheetName?.trim() ? (
                                    <>
                                      <DropdownMenuItem className="cursor-pointer" onClick={() => openRenameColumnDialog(column)}>
                                        <Pencil className="ml-2 h-3.5 w-3.5" />
                                        تعديل اسم الرأس
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        className="cursor-pointer"
                                        disabled={creatingImageFoldersKey !== null || deletingColumnKey !== null}
                                        onClick={() => void createImageFoldersFromColumn(column)}
                                      >
                                        {creatingImageFoldersKey === column.key ? (
                                          <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <FolderPlus className="ml-2 h-3.5 w-3.5" />
                                        )}
                                        إنشاء مجلدات الصور
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  ) : null}
                                  <DropdownMenuItem
                                    className="cursor-pointer text-red-600 focus:text-red-600"
                                    disabled={deletingColumnKey !== null}
                                    onClick={() => void deleteColumnByKey(column)}
                                  >
                                    {deletingColumnKey === column.key ? (
                                      <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="ml-2 h-3.5 w-3.5" />
                                    )}
                                    حذف العمود
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </>
                        ) : (
                          <>
                            <div
                              data-sg-exclude-from-capture="1"
                              className="relative flex w-max min-w-0 shrink-0 items-center justify-center gap-0.5"
                            >
                              <Popover modal={false}>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    title="فلترة هذا العمود"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onMouseDown={(event) => event.stopPropagation()}
                                    onClick={(event) => event.stopPropagation()}
                                    className={cn(
                                      "inline-flex items-center justify-center rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700",
                                      isFiltered && "bg-primary/10 text-primary",
                                    )}
                                    aria-label={`فلترة ${column.label}`}
                                  >
                                    <Filter className="h-3.5 w-3.5" strokeWidth={2} />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="start"
                                  className="z-[960] w-72 space-y-3 rounded-lg border p-3 shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
                                  style={{
                                    borderColor: "var(--color-border-secondary)",
                                    background: "var(--color-background-primary)",
                                  }}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <div className="space-y-1">
                                    <p className="text-sm font-semibold text-slate-800">{column.label}</p>
                                    <p className="text-xs text-slate-500">نوع العمود: {COLUMN_TYPE_LABELS[column.type]}</p>
                                  </div>
                                  <div className="space-y-2">
                                    <Select
                                      value={filter?.mode ?? "contains"}
                                      onValueChange={(value: TextFilterMode) =>
                                        setFilters((current) => ({
                                          ...current,
                                          [column.key]: {
                                            kind: "text",
                                            mode: value,
                                            value: current[column.key]?.value ?? "",
                                          },
                                        }))
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="نوع المطابقة" />
                                      </SelectTrigger>
                                      <SelectContent className="z-[970]">
                                        <SelectItem value="contains">يحتوي على</SelectItem>
                                        <SelectItem value="equals">يساوي</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Input
                                      placeholder="أدخل قيمة الفلترة"
                                      value={filter?.value ?? ""}
                                      onChange={(event) =>
                                        setFilters((current) => ({
                                          ...current,
                                          [column.key]: {
                                            kind: "text",
                                            mode: current[column.key]?.mode ?? "contains",
                                            value: event.target.value,
                                          },
                                        }))
                                      }
                                    />
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <Button type="button" variant="ghost" size="sm" onClick={() => clearFilter(column.key)}>
                                      مسح الفلتر
                                    </Button>
                                    <span className="text-xs text-slate-400">{isFiltered ? "الفلتر مفعّل" : "بدون فلتر"}</span>
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <div className="flex shrink-0 items-center">
                                <DropdownMenu modal={false}>
                                  <DropdownMenuTrigger asChild>
                                    <button
                                      type="button"
                                      title="إجراءات العمود (تعديل، حذف، …)"
                                      onPointerDown={(event) => event.stopPropagation()}
                                      onMouseDown={(event) => event.stopPropagation()}
                                      onClick={(event) => event.stopPropagation()}
                                      className="inline-flex items-center justify-center rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                      aria-label={`إجراءات ${column.label}`}
                                    >
                                      <MoreVertical className="h-3.5 w-3.5" strokeWidth={2} />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="z-[960] min-w-[10rem]">
                                    {sheetColumns && importId.trim() && importSheetName?.trim() ? (
                                      <>
                                        <DropdownMenuItem className="cursor-pointer" onClick={() => openRenameColumnDialog(column)}>
                                          <Pencil className="ml-2 h-3.5 w-3.5" />
                                          تعديل اسم الرأس
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="cursor-pointer"
                                          disabled={creatingImageFoldersKey !== null || deletingColumnKey !== null}
                                          onClick={() => void createImageFoldersFromColumn(column)}
                                        >
                                          {creatingImageFoldersKey === column.key ? (
                                            <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <FolderPlus className="ml-2 h-3.5 w-3.5" />
                                          )}
                                          إنشاء مجلدات الصور
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                      </>
                                    ) : null}
                                    <DropdownMenuItem
                                      className="cursor-pointer text-red-600 focus:text-red-600"
                                      disabled={deletingColumnKey !== null}
                                      onClick={() => void deleteColumnByKey(column)}
                                    >
                                      {deletingColumnKey === column.key ? (
                                        <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="ml-2 h-3.5 w-3.5" />
                                      )}
                                      حذف العمود
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="flex min-h-[2rem] min-w-0 items-center gap-1.5 text-right"
                              onClick={() => toggleSort(column.key)}
                            >
                              <span className="min-w-0 flex-1 truncate">{column.label}</span>
                              <span data-sg-exclude-from-capture="1" className="flex shrink-0 items-center" aria-hidden>
                                {isSorted ? (
                                  sortState?.order === "asc" ? (
                                    <ArrowUp className="h-3.5 w-3.5 shrink-0 text-[#378ADD]" />
                                  ) : (
                                    <ArrowDown className="h-3.5 w-3.5 shrink-0 text-[#378ADD]" />
                                  )
                                ) : (
                                  <ArrowDownUp className="h-3.5 w-3.5 shrink-0 text-[#B4B2A9]" />
                                )}
                              </span>
                            </button>
                          </>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {topSpacerHeight > 0 ? (
                <tr>
                  <td colSpan={tableColSpan} style={{ height: topSpacerHeight }} />
                </tr>
              ) : null}
              {!isLoading && visibleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={tableColSpan}
                    className="px-4 py-12 text-center text-sm text-slate-500"
                  >
                    {hasActiveFilters ? "لا توجد بيانات مطابقة للفلاتر الحالية" : "لا توجد بيانات"}
                  </td>
                </tr>
              ) : null}
              {visibleRows.map((row, visibleIndex) => {
                const isSelected = selectedRowIds.includes(row.id);
                const displayRow1Based =
                  (page - 1) * effectiveListLimit + startIndex + visibleIndex + 1;

                const rowStripeBg =
                  (startIndex + visibleIndex) % 2 === 0
                    ? "var(--color-background-primary)"
                    : "#F9F8F7";

                return (
                  <tr
                    key={row.id}
                    onClick={
                      rowCheckboxColumn
                        ? undefined
                        : (event: ReactMouseEvent<HTMLTableRowElement>) => handleRowSelection(event, row.id)
                    }
                    className={cn(
                      "group border-b transition-colors hover:bg-[#F1EFE8]",
                      isSelected && "bg-[#F0F7FF]",
                    )}
                    style={{
                      ...(accountCropMode
                        ? { minHeight: bodyRowHeight, height: bodyRowHeight }
                        : { height: bodyRowHeight }),
                      borderColor: "var(--color-border-tertiary)",
                      background: isSelected
                        ? "#F0F7FF"
                        : rowStripeBg,
                      borderRight: isSelected ? "2.5px solid #378ADD" : "2.5px solid transparent",
                    }}
                  >
                    <td
                      className={cn(
                        "border-b px-1 py-0 text-center align-middle tabular-nums select-none",
                        accountCropMode
                          ? "text-[12px] font-extrabold text-slate-950"
                          : "text-[11px] font-medium text-slate-500",
                        accountCropMode && isRowInAccountCrop(displayRow1Based) && "bg-amber-100 ring-1 ring-amber-400/80",
                      )}
                      style={{
                        position: "sticky",
                        right: 0,
                        zIndex: 11,
                        width: ROW_NUM_COL_WIDTH,
                        minWidth: ROW_NUM_COL_WIDTH,
                        maxWidth: ROW_NUM_COL_WIDTH,
                        ...(accountCropMode
                          ? { minHeight: bodyRowHeight, height: bodyRowHeight }
                          : { height: bodyRowHeight }),
                        borderColor: "var(--color-border-tertiary)",
                        background: isSelected ? "#F0F7FF" : rowStripeBg,
                      }}
                    >
                      {accountCropMode && onAccountCropRowPick ? (
                        <button
                          type="button"
                          className={cn(
                            "h-full min-h-[2rem] w-full cursor-pointer rounded px-0.5 font-extrabold tabular-nums transition-colors",
                            isRowInAccountCrop(displayRow1Based)
                              ? "bg-amber-200/90 text-amber-950"
                              : "text-slate-900 hover:bg-amber-50",
                          )}
                          onClick={(event) => {
                            event.stopPropagation();
                            onAccountCropRowPick(displayRow1Based);
                          }}
                          aria-label={`تحديد الصف ${displayRow1Based} لحدود الصورة`}
                        >
                          {displayRow1Based}
                        </button>
                      ) : (
                        displayRow1Based
                      )}
                    </td>
                    {rowCheckboxColumn ? (
                      <td
                        className="border-b px-1 py-0 text-center align-middle"
                        onClick={(event) => event.stopPropagation()}
                        style={{
                          position: "sticky",
                          right: ROW_NUM_COL_WIDTH,
                          zIndex: 11,
                          width: CHECKBOX_COL_WIDTH,
                          minWidth: CHECKBOX_COL_WIDTH,
                          ...(accountCropMode
                            ? { minHeight: bodyRowHeight, height: bodyRowHeight }
                            : { height: bodyRowHeight }),
                          borderColor: "var(--color-border-tertiary)",
                          background: isSelected ? "#F0F7FF" : rowStripeBg,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSelectedRowIds((prev) =>
                              prev.includes(row.id) ? prev.filter((x) => x !== row.id) : [...prev, row.id],
                            );
                          }}
                          aria-label="تحديد الصف"
                          className="h-4 w-4 cursor-pointer accent-[#0C447C]"
                        />
                      </td>
                    ) : null}
                    {columns.map((column, index) => {
                      const stickyStyle: CSSProperties =
                        index < frozenDataColumnCount
                          ? {
                              position: "sticky",
                              right: stickyRightOffsets[index] ?? 0,
                              zIndex: 10,
                            }
                          : {};

                      const isEditing =
                        editingCell?.assetId === row.id && editingCell.columnKey === column.key;

                      return (
                        <td
                          key={`${row.id}-${column.key}`}
                          data-sg-drow={accountCropMode ? displayRow1Based : undefined}
                          data-sg-dcol={accountCropMode ? index + 1 : undefined}
                          {...(editOnSingleClick
                            ? {
                                onClick: (event: ReactMouseEvent<HTMLTableCellElement>) => {
                                  event.stopPropagation();
                                  openEditor(row.id, column.key);
                                },
                              }
                            : { onDoubleClick: () => openEditor(row.id, column.key) })}
                          className={cn(
                            "border-b border-l px-3 py-2 text-center align-middle",
                            accountCropMode
                              ? "border-l-slate-300/90 text-[13px] font-extrabold text-slate-950 antialiased"
                              : "border-l-slate-200/60 text-[12px] text-slate-700",
                            index < frozenDataColumnCount && "shadow-[inset_1px_0_0_rgba(211,209,199,0.9)]",
                          )}
                          style={{
                            ...stickyStyle,
                            minWidth: columnWidths[column.key],
                            width: columnWidths[column.key],
                            ...(accountCropMode
                              ? {
                                  minHeight: bodyRowHeight,
                                  height: bodyRowHeight,
                                  overflow: "visible",
                                }
                              : { height: bodyRowHeight }),
                            borderColor: "var(--color-border-tertiary)",
                            background:
                              index < frozenDataColumnCount
                                ? isSelected
                                  ? "#F0F7FF"
                                  : (startIndex + visibleIndex) % 2 === 0
                                    ? "var(--color-background-primary)"
                                    : "#F9F8F7"
                                : undefined,
                            ...(accountCropMode && typeof accountCropCellFontPx === "number"
                              ? { fontSize: accountCropCellFontPx }
                              : {}),
                            ...(accountCropMode ? { verticalAlign: "middle" as const } : {}),
                            ...accountCropPadStyle,
                          }}
                        >
                          {isEditing ? (
                            <Input
                              autoFocus
                              value={editingCell.value}
                              dir={editingCell.value.trimStart().startsWith("=") ? "ltr" : "auto"}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) =>
                                setEditingCell((current) =>
                                  current
                                    ? {
                                        ...current,
                                        value: event.target.value,
                                      }
                                    : current,
                                )
                              }
                              onBlur={commitCellEdit}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  commitCellEdit();
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault();
                                  setEditingCell(null);
                                }
                              }}
                              className="h-8 rounded-md border-[1.5px] border-[#378ADD] bg-[#EBF4FF] px-2 ring-0 focus-visible:ring-0"
                            />
                          ) : (
                            <div
                              data-account-crop-cell-text={accountCropMode ? "1" : undefined}
                              className={cn(
                                accountCropMode
                                  ? "min-w-0 break-words text-center leading-snug"
                                  : "truncate",
                                column.type === "number" && "tabular-nums",
                                accountCropMode && "font-extrabold !text-slate-950",
                                isFormulaValue(readCellValue(row, column.key)) &&
                                  !accountCropMode &&
                                  "font-medium text-primary",
                                !renderDisplayValue(row, column) && "text-[#A32D2D]",
                              )}
                              title={stringifyCellValue(readCellValue(row, column.key))}
                            >
                              {renderDisplayValue(row, column) || "(فارغ)"}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {sheetColumns && columns.length > 0 && !accountCropMode ? (
                <tr
                  className="border-t-2"
                  style={{
                    borderColor: "#B8B6AD",
                    height: ROW_HEIGHT,
                    background: "#EDECE8",
                  }}
                >
                  <td
                    className="border-b px-0.5 py-0 text-center align-middle"
                    style={{
                      position: "sticky",
                      right: 0,
                      zIndex: 11,
                      width: ROW_NUM_COL_WIDTH,
                      minWidth: ROW_NUM_COL_WIDTH,
                      maxWidth: ROW_NUM_COL_WIDTH,
                      height: ROW_HEIGHT,
                      borderColor: "var(--color-border-tertiary)",
                      background: "#EDECE8",
                    }}
                  >
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600"
                      title="مجاميع الأعمدة وإجراءات سريعة — يظهر أسفل الجدول"
                      aria-label="صف المجاميع والإجراءات"
                    >
                      <Sigma className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
                    </span>
                  </td>
                  {rowCheckboxColumn ? (
                    <td
                      className="border-b px-1 py-0 text-center align-middle"
                      style={{
                        position: "sticky",
                        right: ROW_NUM_COL_WIDTH,
                        zIndex: 11,
                        width: CHECKBOX_COL_WIDTH,
                        minWidth: CHECKBOX_COL_WIDTH,
                        height: ROW_HEIGHT,
                        borderColor: "var(--color-border-tertiary)",
                        background: "#EDECE8",
                      }}
                    />
                  ) : null}
                  {columns.map((column, index) => {
                    const stickyStyle: CSSProperties =
                      index < frozenDataColumnCount
                        ? {
                            position: "sticky",
                            right: stickyRightOffsets[index] ?? 0,
                            zIndex: 10,
                          }
                        : {};
                    const opsBg = "#EDECE8";
                    const kind = columnAggregateKinds[column.key];
                    const samples = pullNumericSamplesForColumn(column);
                    const aggregateValue =
                      kind && samples.length > 0
                        ? kind === "sum"
                          ? samples.reduce((a, b) => a + b, 0)
                          : samples.reduce((a, b) => a + b, 0) / samples.length
                        : null;

                    return (
                      <td
                        key={`ops-${column.key}`}
                        className="border-b border-l border-l-slate-200/60 px-2 py-1 text-center align-middle text-[11px] text-slate-700"
                        style={{
                          ...stickyStyle,
                          minWidth: columnWidths[column.key],
                          width: columnWidths[column.key],
                          height: ROW_HEIGHT,
                          borderColor: "var(--color-border-tertiary)",
                          background: opsBg,
                          boxShadow:
                            index < frozenDataColumnCount
                              ? "inset 1px 0 0 rgba(211,209,199,0.9)"
                              : undefined,
                        }}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="min-w-0 flex-1 truncate tabular-nums">
                            {kind && aggregateValue !== null && samples.length > 0
                              ? kind === "sum"
                                ? aggregateValue.toLocaleString("ar-EG", { maximumFractionDigits: 2 })
                                : aggregateValue.toLocaleString("ar-EG", { maximumFractionDigits: 2 })
                              : "—"}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200/80 hover:text-slate-800"
                                aria-label={`عمليات العمود ${column.label}`}
                                onClick={(event) => event.stopPropagation()}
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[10rem]">
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => {
                                  if (pullNumericSamplesForColumn(column).length === 0) {
                                    toast({
                                      variant: "destructive",
                                      description: "لا توجد قيم رقمية في الصفوف الظاهرة لهذا العمود.",
                                    });
                                    return;
                                  }
                                  setColumnAggregateKinds((prev) => ({
                                    ...prev,
                                    [column.key]: "sum",
                                  }));
                                }}
                              >
                                مجموع العمود
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => {
                                  if (pullNumericSamplesForColumn(column).length === 0) {
                                    toast({
                                      variant: "destructive",
                                      description: "لا توجد قيم رقمية في الصفوف الظاهرة لهذا العمود.",
                                    });
                                    return;
                                  }
                                  setColumnAggregateKinds((prev) => ({
                                    ...prev,
                                    [column.key]: "avg",
                                  }));
                                }}
                              >
                                متوسط العمود
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() =>
                                  setColumnAggregateKinds((prev) => ({
                                    ...prev,
                                    [column.key]: null,
                                  }))
                                }
                              >
                                مسح
                              </DropdownMenuItem>
                              {sheetColumns && importId.trim() && importSheetName?.trim() ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    onClick={() => openRenameColumnDialog(column)}
                                  >
                                    <Pencil className="ml-2 h-3.5 w-3.5" />
                                    تعديل اسم الرأس
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="cursor-pointer"
                                    disabled={
                                      creatingImageFoldersKey !== null || deletingColumnKey !== null
                                    }
                                    onClick={() => void createImageFoldersFromColumn(column)}
                                  >
                                    {creatingImageFoldersKey === column.key ? (
                                      <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <FolderPlus className="ml-2 h-3.5 w-3.5" />
                                    )}
                                    إنشاء مجلدات الصور
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ) : null}
              {bottomSpacerHeight > 0 ? (
                <tr>
                  <td colSpan={tableColSpan} style={{ height: bottomSpacerHeight }} />
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                جارٍ تحميل البيانات...
              </div>
            </div>
          ) : null}

          {loadError ? (
            <div className="absolute inset-x-4 bottom-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span>{loadError}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => void fetchAssets()}>
                  إعادة المحاولة
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {/* ترقيم الصفحات فقط — بدون شريط أفقي أو نصوص تعليمية */}
        {totalPages > 1 ? (
          <div
            className="flex items-center justify-end gap-2 border-t px-4 py-2"
            style={{
              borderColor: "var(--color-border-tertiary)",
              background: "var(--color-background-secondary)",
            }}
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => {
                setPage((current) => Math.max(1, current - 1));
                scrollBodyRef.current?.scrollTo({ top: 0 });
              }}
              className="gap-1"
            >
              <ChevronRight className="h-4 w-4" />
              السابق
            </Button>
            <span className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
              {page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => {
                setPage((current) => Math.min(totalPages, current + 1));
                scrollBodyRef.current?.scrollTo({ top: 0 });
              }}
              className="gap-1"
            >
              التالي
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        ) : null}

        <DropdownMenu
          open={contextMenuState !== null}
          onOpenChange={(open) => {
            if (!open) setContextMenuState(null);
          }}
        >
          <DropdownMenuTrigger asChild>
            <button
              ref={contextTriggerRef}
              type="button"
              aria-hidden="true"
              className="absolute h-px w-px opacity-0"
              style={{
                top: contextMenuState?.y ?? 0,
                left: contextMenuState?.x ?? 0,
              }}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {sheetColumns &&
            importId.trim() &&
            importSheetName?.trim() &&
            contextMenuState ? (
              <>
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => {
                    if (!contextMenuState) return;
                    openRenameColumnDialog(contextMenuState.column);
                    setContextMenuState(null);
                  }}
                >
                  <Pencil className="ml-2 h-4 w-4" />
                  تعديل اسم الرأس
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer"
                  disabled={
                    !contextMenuState ||
                    creatingImageFoldersKey !== null ||
                    deletingColumnKey !== null
                  }
                  onClick={() => {
                    if (!contextMenuState) return;
                    void createImageFoldersFromColumn(contextMenuState.column);
                    setContextMenuState(null);
                  }}
                >
                  {contextMenuState && creatingImageFoldersKey === contextMenuState.column.key ? (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FolderPlus className="ml-2 h-4 w-4" />
                  )}
                  إنشاء مجلدات الصور
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuItem
              disabled={!contextMenuState || deletingColumnKey !== null}
              onClick={() => void handleDeleteColumn()}
              className="cursor-pointer text-red-600 focus:text-red-600"
            >
              {deletingColumnKey ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              حذف العمود
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {sheetColumns && (rowCheckboxColumn ? selectedRowIds.length >= 1 : selectedRowIds.length > 1) ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[#0C447C] px-4 py-2 text-white">
          <span className="text-[12px] font-medium">{selectedRowIds.length} محدد</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isDeletingRows}
            onClick={() => void handleBulkDelete()}
            className="h-8 rounded-md px-3 text-[12px] text-white hover:bg-white/10 hover:text-white"
          >
            {isDeletingRows ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            حذف المحدد
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelectedRowIds([])}
            className="h-8 rounded-md px-3 text-[12px] text-white hover:bg-white/10 hover:text-white"
          >
            ×
          </Button>
        </div>
      ) : null}

      <Dialog open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة عمود جديد</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="smart-grid-column-name">
              اسم العمود
            </label>
            <Input
              id="smart-grid-column-name"
              value={newColumnName}
              onChange={(event) => setNewColumnName(event.target.value)}
              placeholder="مثال: رقم العقد أو المرفق"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddColumnOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              onClick={() => void handleAddColumn()}
              disabled={isSubmittingColumn}
            >
              {isSubmittingColumn ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renameColumnOpen}
        onOpenChange={(open) => {
          setRenameColumnOpen(open);
          if (!open) setRenameColumnTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل اسم الرأس</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="smart-grid-rename-column">
              الاسم المعروض
            </label>
            <Input
              id="smart-grid-rename-column"
              value={renameColumnValue}
              onChange={(e) => setRenameColumnValue(e.target.value)}
              placeholder="اسم العمود في الجدول"
              dir="auto"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitRenameColumn();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameColumnOpen(false)}>
              إلغاء
            </Button>
            <Button type="button" onClick={() => void submitRenameColumn()} disabled={isRenamingColumn}>
              {isRenamingColumn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
