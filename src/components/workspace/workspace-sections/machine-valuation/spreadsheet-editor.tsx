"use client";

import {
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
} from "react";
import {
  Save,
  Plus,
  Trash2,
  ArrowLeft,
  Columns3,
  Rows3,
  ChevronDown,
  X,
  Info,
  Table2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";
import type { MvSheetData } from "./types";

const copy = {
  en: {
    save: "Save",
    cancel: "Back",
    addRow: "Add Row",
    addCol: "Add Column",
    deleteRow: "Delete Row",
    deleteCol: "Delete Column",
    insertRowAbove: "Insert Row Above",
    insertRowBelow: "Insert Row Below",
    insertColLeft: "Insert Column Left",
    insertColRight: "Insert Column Right",
    sheetName: "Sheet name",
    headerPlaceholder: "Header name…",
    selectHeader: "Select header",
    addNewHeader: "Add new header name…",
    rows: "rows",
    cols: "cols",
    pasteHint: "Tip: You can copy-paste data directly from Excel",
    addToCatalog: "Add to catalog",
    clearHeader: "Clear header text",
    deleteThisRow: "Delete this row",
    deleteThisCol: "Delete this column",
    rowsCountLabel: "Rows to add",
    colsCountLabel: "Columns to add",
  },
  ar: {
    save: "حفظ",
    cancel: "رجوع",
    addRow: "إضافة صف",
    addCol: "إضافة عمود",
    deleteRow: "حذف صف",
    deleteCol: "حذف عمود",
    insertRowAbove: "إدراج صف أعلى",
    insertRowBelow: "إدراج صف أسفل",
    insertColLeft: "إدراج عمود يسار",
    insertColRight: "إدراج عمود يمين",
    sheetName: "اسم الجدول",
    headerPlaceholder: "اسم العمود…",
    selectHeader: "اختر عنوان",
    addNewHeader: "أضف اسم عنوان جديد…",
    rows: "صفوف",
    cols: "أعمدة",
    pasteHint: "نصيحة: يمكنك نسخ ولصق البيانات مباشرة من Excel",
    addToCatalog: "إضافة للقائمة",
    clearHeader: "مسح نص العنوان",
    deleteThisRow: "حذف هذا الصف",
    deleteThisCol: "حذف هذا العمود",
    rowsCountLabel: "عدد الصفوف",
    colsCountLabel: "عدد الأعمدة",
  },
} as const;

/** 0-based index → A, B, …, Z, AA, … (same as Excel column letters) */
function excelColumnLetter(zeroBasedIndex: number): string {
  let n = zeroBasedIndex + 1;
  let s = "";
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

/** Default header label: always Column A, Column B, … (Latin), regardless of UI language */
function defaultColumnLabel(zeroBasedIndex: number): string {
  return `Column ${excelColumnLetter(zeroBasedIndex)}`;
}

const MAX_BULK_ADD = 100;

function parseBulkCount(raw: string): number {
  const x = parseInt(String(raw).replace(/\D/g, ""), 10);
  if (!Number.isFinite(x) || x < 1) return 1;
  return Math.min(MAX_BULK_ADD, x);
}

/** Match API header names or show full list when defaults (e.g. Column A) match nothing */
function filterHeaderOptions(query: string, options: string[]): string[] {
  if (options.length === 0) return [];
  const q = query.trim().toLowerCase();
  if (!q) return options;
  const filtered = options.filter((o) => o.toLowerCase().includes(q));
  return filtered.length > 0 ? filtered : options;
}

interface SpreadsheetEditorProps {
  initialData: MvSheetData;
  projectId: string;
  subProjectId?: string;
  onSave: (data: MvSheetData) => void;
  onCancel: () => void;
}

export default function SpreadsheetEditor({
  initialData,
  projectId,
  subProjectId,
  onSave,
  onCancel,
}: SpreadsheetEditorProps) {
  const langCtx = useContext(LanguageContext);
  const isArabic = langCtx?.language === "ar";
  const t = isArabic ? copy.ar : copy.en;

  const [sheetName, setSheetName] = useState(initialData.name);
  const [headers, setHeaders] = useState<string[]>([...initialData.headers]);
  const [rows, setRows] = useState<(string | number | null)[][]>(() =>
    initialData.rows.map((row) => initialData.headers.map((h) => row[h] ?? null))
  );

  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; r: number; c: number } | null>(null);
  const [headerOptions, setHeaderOptions] = useState<string[]>([]);
  const [newHeaderName, setNewHeaderName] = useState("");
  const [editingHeaderIdx, setEditingHeaderIdx] = useState<number | null>(null);
  const [rowsToAddInput, setRowsToAddInput] = useState("1");
  const [colsToAddInput, setColsToAddInput] = useState("1");

  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/mv/header-options", { credentials: "include" });
        if (res.ok) {
          const data: { _id: string; name: string }[] = await res.json();
          setHeaderOptions(data.map((d) => d.name));
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const updateCell = useCallback(
    (r: number, c: number, value: string | number | null) => {
      setRows((prev) => {
        const next = prev.map((row) => [...row]);
        next[r][c] = value;
        return next;
      });
    },
    []
  );

  const addRowsMany = useCallback(
    (count: number) => {
      const n = parseBulkCount(String(count));
      setRows((prev) => [
        ...prev,
        ...Array.from({ length: n }, () => Array(headers.length).fill(null)),
      ]);
    },
    [headers.length]
  );

  const addColumnsMany = useCallback((count: number) => {
    const n = parseBulkCount(String(count));
    if (n < 1) return;
    setHeaders((prev) => {
      const start = prev.length;
      const next = [...prev];
      for (let i = 0; i < n; i++) {
        next.push(defaultColumnLabel(start + i));
      }
      return next;
    });
    setRows((prev) => prev.map((row) => [...row, ...Array(n).fill(null)]));
  }, []);

  const deleteRow = useCallback((r: number) => {
    setRows((prev) => prev.filter((_, i) => i !== r));
    setSelectedCell((cur) => {
      if (!cur) return null;
      if (cur.r === r) return null;
      if (cur.r > r) return { r: cur.r - 1, c: cur.c };
      return cur;
    });
  }, []);

  const deleteColumn = useCallback(
    (c: number) => {
      if (headers.length <= 1) return;
      setHeaders((prev) => prev.filter((_, i) => i !== c));
      setRows((prev) => prev.map((row) => row.filter((_, i) => i !== c)));
      setSelectedCell((cur) => {
        if (!cur) return null;
        if (cur.c === c) return null;
        if (cur.c > c) return { r: cur.r, c: cur.c - 1 };
        return cur;
      });
    },
    [headers.length]
  );

  const deleteColumnAt = useCallback(
    (c: number) => {
      if (headers.length <= 1) return;
      setEditingHeaderIdx((cur) => {
        if (cur === null) return null;
        if (cur === c) return null;
        if (cur > c) return cur - 1;
        return cur;
      });
      deleteColumn(c);
    },
    [headers.length, deleteColumn]
  );

  const insertRow = useCallback(
    (r: number, position: "above" | "below") => {
      const newRow = Array(headers.length).fill(null);
      const idx = position === "above" ? r : r + 1;
      setRows((prev) => {
        const next = [...prev];
        next.splice(idx, 0, newRow);
        return next;
      });
    },
    [headers.length]
  );

  const insertColumn = useCallback(
    (c: number, position: "left" | "right") => {
      const idx = position === "left" ? c : c + 1;
      setHeaders((prev) => {
        const colName = defaultColumnLabel(prev.length);
        const next = [...prev];
        next.splice(idx, 0, colName);
        return next;
      });
      setRows((prev) =>
        prev.map((row) => {
          const next = [...row];
          next.splice(idx, 0, null);
          return next;
        })
      );
    },
    []
  );

  const renameHeader = useCallback((c: number, newName: string) => {
    setHeaders((prev) => {
      const next = [...prev];
      next[c] = newName;
      return next;
    });
  }, []);

  const addHeaderOption = useCallback(
    async (name: string) => {
      if (!name.trim() || headerOptions.includes(name.trim())) return;
      const trimmed = name.trim();
      setHeaderOptions((prev) => [...prev, trimmed]);
      try {
        await fetch("/api/mv/header-options", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: trimmed }),
        });
      } catch {
        // ignore
      }
    },
    [headerOptions]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const text = e.clipboardData.getData("text/plain");
      if (!text) return;

      const pastedRows = text.split(/\r?\n/).filter((line) => line.length > 0);
      if (pastedRows.length === 0) return;

      const pastedData = pastedRows.map((row) => row.split("\t"));
      const maxCols = Math.max(...pastedData.map((r) => r.length));

      const startR = selectedCell?.r ?? 0;
      const startC = selectedCell?.c ?? 0;

      setRows((prev) => {
        const next = prev.map((row) => [...row]);
        const neededRows = startR + pastedData.length;
        while (next.length < neededRows) {
          next.push(Array(headers.length).fill(null));
        }
        for (let pr = 0; pr < pastedData.length; pr++) {
          for (let pc = 0; pc < pastedData[pr].length; pc++) {
            const r = startR + pr;
            const c = startC + pc;
            if (c < headers.length) {
              next[r][c] = pastedData[pr][pc] || null;
            }
          }
        }
        return next;
      });

      if (startC + maxCols > headers.length) {
        const extraCols = startC + maxCols - headers.length;
        setHeaders((prev) => {
          const start = prev.length;
          const newHeaders = Array.from({ length: extraCols }, (_, i) =>
            defaultColumnLabel(start + i)
          );
          return [...prev, ...newHeaders];
        });
        setRows((prev) =>
          prev.map((row) => [...row, ...Array(extraCols).fill(null)])
        );
      }

      e.preventDefault();
    },
    [selectedCell, headers.length]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, r: number, c: number) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const nextC = e.shiftKey ? c - 1 : c + 1;
        if (nextC >= 0 && nextC < headers.length) {
          setSelectedCell({ r, c: nextC });
          const el = tableRef.current?.querySelector(
            `[data-cell="${r}-${nextC}"]`
          ) as HTMLElement;
          el?.focus();
        }
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const nextR = r + 1;
        if (nextR < rows.length) {
          setSelectedCell({ r: nextR, c });
          const el = tableRef.current?.querySelector(
            `[data-cell="${nextR}-${c}"]`
          ) as HTMLElement;
          el?.focus();
        }
      }
    },
    [headers.length, rows.length]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, r: number, c: number) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, r, c });
    },
    []
  );

  const handleSave = () => {
    const resolvedHeaders = headers.map((h, i) => {
      const tr = h.trim();
      if (tr) return tr;
      return defaultColumnLabel(i);
    });
    const rowObjects = rows.map((row) => {
      const obj: Record<string, string | number | null> = {};
      resolvedHeaders.forEach((key, i) => {
        obj[key] = row[i] ?? null;
      });
      return obj;
    });
    onSave({
      ...initialData,
      name: sheetName,
      headers: resolvedHeaders,
      rows: rowObjects,
      projectId,
      subProjectId,
    });
  };

  const clearHeaderCell = useCallback((c: number) => {
    renameHeader(c, "");
    setEditingHeaderIdx(c);
  }, [renameHeader]);

  const headerIconBtn =
    "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/35";

  return (
    <div className="space-y-1.5">
      {/* Two tight rows: navigation + grid tools + save | catalog + tip */}
      <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm">
        {/* Row 1 */}
        <div className="flex flex-wrap items-center justify-between gap-x-1 gap-y-1 px-1.5 py-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
            <Button
              type="button"
              variant="outline"
              className="h-7 shrink-0 rounded-md border-slate-200 px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
              onClick={onCancel}
            >
              <ArrowLeft
                className={cn(
                  "h-3 w-3 opacity-80",
                  isArabic ? "ms-1 rotate-180" : "me-1",
                )}
              />
              {t.cancel}
            </Button>
            <Input
              id="mv-sheet-name"
              value={sheetName}
              onChange={(e) => setSheetName(e.target.value)}
              placeholder={t.sheetName}
              className="h-7 w-[9rem] shrink-0 rounded-md border-slate-200 px-2 text-[11px] font-semibold text-slate-900 sm:w-[10.5rem]"
              dir="auto"
              aria-label={t.sheetName}
            />
            <span
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-slate-200/80 bg-slate-50 px-1.5 text-[10px] font-medium tabular-nums text-slate-600"
              title={`${rows.length} × ${headers.length}`}
            >
              <Table2 className="h-3 w-3 text-slate-400" aria-hidden />
              <span className="text-slate-800">{rows.length}</span>
              <span className="text-slate-300">/</span>
              <span className="text-slate-800">{headers.length}</span>
            </span>
            <div className="flex h-7 shrink-0 overflow-hidden rounded-md border border-slate-200">
              <Input
                type="text"
                inputMode="numeric"
                aria-label={t.rowsCountLabel}
                value={rowsToAddInput}
                onChange={(e) =>
                  setRowsToAddInput(e.target.value.replace(/[^\d]/g, ""))
                }
                onBlur={() => {
                  if (!rowsToAddInput.trim()) setRowsToAddInput("1");
                }}
                className="h-7 w-8 rounded-none border-0 border-e border-slate-200 px-0 text-center text-[11px] font-semibold tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                dir="ltr"
              />
              <Button
                type="button"
                variant="ghost"
                className="h-7 rounded-none px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => addRowsMany(parseBulkCount(rowsToAddInput))}
              >
                <Rows3 className={cn("h-3 w-3", isArabic ? "ms-1" : "me-1")} />
                {t.addRow}
              </Button>
            </div>
            <div className="flex h-7 shrink-0 overflow-hidden rounded-md border border-slate-200">
              <Input
                type="text"
                inputMode="numeric"
                aria-label={t.colsCountLabel}
                value={colsToAddInput}
                onChange={(e) =>
                  setColsToAddInput(e.target.value.replace(/[^\d]/g, ""))
                }
                onBlur={() => {
                  if (!colsToAddInput.trim()) setColsToAddInput("1");
                }}
                className="h-7 w-8 rounded-none border-0 border-e border-slate-200 px-0 text-center text-[11px] font-semibold tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                dir="ltr"
              />
              <Button
                type="button"
                variant="ghost"
                className="h-7 rounded-none px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => addColumnsMany(parseBulkCount(colsToAddInput))}
              >
                <Columns3 className={cn("h-3 w-3", isArabic ? "ms-1" : "me-1")} />
                {t.addCol}
              </Button>
            </div>
          </div>
          <Button
            type="button"
            className="h-7 shrink-0 rounded-md bg-emerald-600 px-2.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
            onClick={handleSave}
          >
            <Save className={cn("h-3 w-3", isArabic ? "ms-1" : "me-1")} />
            {t.save}
          </Button>
        </div>

        {/* Row 2 */}
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-slate-100 px-1.5 py-1">
          <Input
            value={newHeaderName}
            onChange={(e) => setNewHeaderName(e.target.value)}
            placeholder={t.addNewHeader}
            className="h-7 w-[min(100%,11rem)] min-w-[7.5rem] shrink-0 rounded-md border-slate-200 px-2 text-[11px] text-slate-800 shadow-none focus-visible:ring-1 focus-visible:ring-emerald-500/30"
            dir="auto"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newHeaderName.trim()) {
                addHeaderOption(newHeaderName);
                setNewHeaderName("");
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="h-7 shrink-0 rounded-md border-slate-200 px-2 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            disabled={!newHeaderName.trim()}
            onClick={() => {
              addHeaderOption(newHeaderName);
              setNewHeaderName("");
            }}
          >
            <Plus className={cn("h-3 w-3", isArabic ? "ms-1" : "me-1")} />
            {t.addToCatalog}
          </Button>
          <span className="flex min-h-7 min-w-0 flex-1 basis-[8rem] items-center gap-1 text-[10px] leading-tight text-slate-500">
            <Info className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
            <span className="min-w-0">{t.pasteHint}</span>
          </span>
        </div>
      </div>

      {/* Spreadsheet */}
      <div
        ref={tableRef}
        dir="ltr"
        className="relative overflow-auto rounded-xl border border-slate-200/90 bg-white shadow-sm"
        style={{ maxHeight: "calc(100vh - 220px)" }}
        onPaste={handlePaste}
      >
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-slate-100">
              <th className="sticky left-0 z-20 w-[3.25rem] min-w-[3.25rem] border-b border-r border-slate-200 bg-slate-200 px-1 py-2 text-center text-xs font-semibold text-slate-500">
                #
              </th>
              {headers.map((header, c) => (
                <th
                  key={c}
                  className="relative min-w-[150px] border-b border-r border-slate-200 bg-slate-100/90 px-1 py-1 align-top"
                >
                  {editingHeaderIdx === c ? (
                    <div className="flex flex-col gap-1 rounded-md border border-emerald-200/80 bg-white p-1 shadow-sm">
                      <div className="flex items-center gap-0.5">
                        <input
                          autoFocus
                          className="h-7 min-w-0 flex-1 rounded border border-emerald-300/90 bg-white px-2 text-xs font-medium text-slate-900 outline-none focus:ring-1 focus:ring-emerald-400/50"
                          value={header}
                          placeholder={t.headerPlaceholder}
                          dir="auto"
                          onChange={(e) => renameHeader(c, e.target.value)}
                          onBlur={() => setEditingHeaderIdx(null)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setEditingHeaderIdx(null);
                            if (e.key === "Escape") setEditingHeaderIdx(null);
                          }}
                          aria-autocomplete="list"
                          aria-expanded={headerOptions.length > 0}
                        />
                        <ChevronDown
                          className="h-3.5 w-3.5 shrink-0 text-emerald-600/80"
                          aria-hidden
                        />
                        {header.trim() !== "" ? (
                          <button
                            type="button"
                            className={headerIconBtn}
                            title={t.clearHeader}
                            aria-label={t.clearHeader}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              clearHeaderCell(c);
                            }}
                          >
                            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </button>
                        ) : null}
                        {headers.length > 1 ? (
                          <button
                            type="button"
                            className={headerIconBtn}
                            title={t.deleteThisCol}
                            aria-label={t.deleteThisCol}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              deleteColumnAt(c);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                      {headerOptions.length > 0 && (
                        <div
                          className="relative z-30 max-h-44 overflow-y-auto rounded-md border border-slate-200 bg-white py-0.5 shadow-md"
                          role="listbox"
                        >
                          {filterHeaderOptions(header, headerOptions).map((option) => (
                            <button
                              key={option}
                              type="button"
                              role="option"
                              className="block w-full px-2.5 py-1.5 text-xs text-slate-700 hover:bg-emerald-50 text-start"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                renameHeader(c, option);
                                setEditingHeaderIdx(null);
                              }}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-stretch gap-0.5">
                      <button
                        type="button"
                        className="flex h-8 min-h-8 min-w-0 flex-1 items-center justify-between gap-1 rounded-md border border-slate-200/70 bg-white/70 px-2 text-start text-xs font-semibold shadow-sm transition-colors hover:border-emerald-200/80 hover:bg-white"
                        onClick={() => setEditingHeaderIdx(c)}
                        title={`${t.selectHeader}: ${header.trim() || t.headerPlaceholder}`}
                        aria-haspopup="listbox"
                        aria-expanded={false}
                      >
                        <span
                          className={cn(
                            "min-w-0 flex-1 truncate",
                            header.trim() ? "text-slate-800" : "font-normal text-slate-400",
                          )}
                        >
                          {header.trim() ? header : t.headerPlaceholder}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                      </button>
                      {header.trim() !== "" ? (
                        <button
                          type="button"
                          className={headerIconBtn}
                          title={t.clearHeader}
                          aria-label={t.clearHeader}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            clearHeaderCell(c);
                          }}
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                      ) : null}
                      {headers.length > 1 ? (
                        <button
                          type="button"
                          className={headerIconBtn}
                          title={t.deleteThisCol}
                          aria-label={t.deleteThisCol}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteColumnAt(c);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr
                key={r}
                className={cn(
                  "group",
                  r % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                )}
              >
                <td className="sticky left-0 z-10 w-[3.25rem] min-w-[3.25rem] border-b border-r border-slate-200 bg-slate-100 px-0.5 py-0 text-center text-xs font-medium text-slate-400 select-none">
                  <div className="flex h-8 items-center justify-center gap-0.5">
                    <span className="tabular-nums">{r + 1}</span>
                    {rows.length > 1 ? (
                      <button
                        type="button"
                        className={cn(
                          "rounded p-0.5 text-red-500 opacity-0 transition-opacity",
                          "hover:bg-red-50 group-hover:opacity-100 focus-visible:opacity-100",
                        )}
                        title={t.deleteThisRow}
                        aria-label={t.deleteThisRow}
                        onClick={() => deleteRow(r)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
                </td>
                {row.map((cell, c) => {
                  const isSelected =
                    selectedCell?.r === r && selectedCell?.c === c;
                  return (
                    <td
                      key={c}
                      className={cn(
                        "border-b border-r border-slate-200 p-0 min-w-[140px]",
                        isSelected && "ring-2 ring-inset ring-emerald-400"
                      )}
                    >
                      <input
                        data-cell={`${r}-${c}`}
                        className={cn(
                          "w-full h-8 px-2 text-xs text-slate-800 bg-transparent outline-none",
                          "focus:bg-emerald-50/40"
                        )}
                        value={cell ?? ""}
                        dir="auto"
                        onFocus={() => setSelectedCell({ r, c })}
                        onChange={(e) => updateCell(r, c, e.target.value || null)}
                        onKeyDown={(e) => handleKeyDown(e, r, c)}
                        onContextMenu={(e) => handleContextMenu(e, r, c)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="fixed z-50 min-w-[180px] rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => { insertRow(contextMenu.r, "above"); setContextMenu(null); }}
            >
              <Plus className="h-3 w-3" />{t.insertRowAbove}
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => { insertRow(contextMenu.r, "below"); setContextMenu(null); }}
            >
              <Plus className="h-3 w-3" />{t.insertRowBelow}
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => { insertColumn(contextMenu.c, "left"); setContextMenu(null); }}
            >
              <Columns3 className="h-3 w-3" />{t.insertColLeft}
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
              onClick={() => { insertColumn(contextMenu.c, "right"); setContextMenu(null); }}
            >
              <Columns3 className="h-3 w-3" />{t.insertColRight}
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
              onClick={() => { deleteRow(contextMenu.r); setContextMenu(null); }}
            >
              <Trash2 className="h-3 w-3" />{t.deleteRow}
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
              onClick={() => { deleteColumnAt(contextMenu.c); setContextMenu(null); }}
            >
              <Trash2 className="h-3 w-3" />{t.deleteCol}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
