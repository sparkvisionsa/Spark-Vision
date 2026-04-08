"use client";

import { useContext, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Folder,
  Clock,
  Trash2,
  MoreVertical,
  FileSpreadsheet,
  Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import BreadcrumbNav from "./breadcrumb-nav";
import CreateDialog from "./create-dialog";
import DataImportSelector from "./data-import-selector";
import FileUpload from "./file-upload";
import SpreadsheetEditor from "./spreadsheet-editor";
import { MvMetaPill, MvPageSection } from "./mv-page-section";
import {
  isMvUploadPersistResult,
  type MvProject,
  type MvSubProject,
  type MvSheetData,
  type MvUploadResponse,
} from "./types";

const copy = {
  en: {
    subProjects: "Sub-Projects",
    sheets: "Sheets",
    noSubs: "No sub-projects yet",
    noSheets: "No sheets yet. Add data using the button above.",
    created: "Created",
    delete: "Delete",
    confirmDeleteSub: "Delete this sub-project?",
    confirmDeleteSheet: "Delete this sheet?",
    deleteSuccess: "Deleted successfully",
    createSubSuccess: "Sub-project created",
    newSub: "New Sub-Project",
    sheetName: "Sheet",
    saveSuccess: "Sheet saved successfully",
    importSuccess: "Sheets imported successfully",
    importSaveIssues: "Some sheets could not be saved",
    importSaveFailed: "Could not save sheets. The file may be too large for one document.",
    openSheetError: "Could not load sheet data",
    deleteAllSheets: "Delete all sheets",
    confirmDeleteAllSheets:
      "Delete all sheets in this project? This cannot be undone.",
    deleteAllSheetsSuccess: "All sheets were deleted",
    deleteAllSheetsError: "Could not delete all sheets",
    deletingAllSheets: "Deleting…",
    quickActionsTitle: "Quick actions",
    colsAbbr: "cols",
    rowsAbbr: "rows",
    sourceFile: "Source",
  },
  ar: {
    subProjects: "المشاريع الفرعية",
    sheets: "الجداول",
    noSubs: "لا توجد مشاريع فرعية بعد",
    noSheets: "لا توجد جداول. أضف بيانات من الزر أعلاه.",
    created: "أُنشئ",
    delete: "حذف",
    confirmDeleteSub: "حذف هذا المشروع الفرعي؟",
    confirmDeleteSheet: "حذف هذا الجدول؟",
    deleteSuccess: "تم الحذف بنجاح",
    createSubSuccess: "تم إنشاء المشروع الفرعي",
    newSub: "مشروع فرعي جديد",
    sheetName: "جدول",
    saveSuccess: "تم حفظ الجدول بنجاح",
    importSuccess: "تم استيراد الجداول بنجاح",
    importSaveIssues: "تعذّر حفظ بعض الجداول",
    importSaveFailed: "تعذّر حفظ الجداول. قد يكون حجم البيانات كبيراً جداً.",
    openSheetError: "تعذّر تحميل بيانات الجدول",
    deleteAllSheets: "حذف كل الجداول",
    confirmDeleteAllSheets:
      "حذف جميع الجداول في هذا المشروع؟ لا يمكن التراجع عن ذلك.",
    deleteAllSheetsSuccess: "تم حذف جميع الجداول",
    deleteAllSheetsError: "تعذّر حذف الجداول",
    deletingAllSheets: "جاري الحذف…",
    quickActionsTitle: "إجراءات سريعة",
    colsAbbr: "أعمدة",
    rowsAbbr: "صفوف",
    sourceFile: "المصدر",
  },
} as const;

function formatDate(dateStr: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

interface ProjectDetailProps {
  projectId: string;
}

export default function ProjectDetail({ projectId }: ProjectDetailProps) {
  const langCtx = useContext(LanguageContext);
  const isArabic = langCtx?.language === "ar";
  const t = isArabic ? copy.ar : copy.en;
  const router = useRouter();
  const { toast } = useToast();

  const [project, setProject] = useState<MvProject | null>(null);
  const [subProjects, setSubProjects] = useState<MvSubProject[]>([]);
  const [sheets, setSheets] = useState<MvSheetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [createSubOpen, setCreateSubOpen] = useState(false);
  const [creatingSub, setCreatingSub] = useState(false);

  const [showUpload, setShowUpload] = useState(false);
  const [editingSheet, setEditingSheet] = useState<MvSheetData | null>(null);
  const [showNewSheet, setShowNewSheet] = useState(false);
  const [openingSheetId, setOpeningSheetId] = useState<string | null>(null);
  const [deletingAllSheets, setDeletingAllSheets] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [projRes, sheetsRes] = await Promise.all([
        fetch(`/api/mv/projects/${projectId}`, { credentials: "include" }),
        fetch(`/api/mv/sheets?projectId=${projectId}`, { credentials: "include" }),
      ]);
      if (projRes.ok) {
        const data = await projRes.json();
        setProject(data.project);
        setSubProjects(data.subProjects || []);
      }
      if (sheetsRes.ok) {
        const data = await sheetsRes.json();
        setSheets(data);
      }
    } catch {
      // network error
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const refreshSheets = useCallback(async () => {
    try {
      const sheetsRes = await fetch(`/api/mv/sheets?projectId=${projectId}`, {
        credentials: "include",
      });
      if (sheetsRes.ok) {
        const data = (await sheetsRes.json()) as MvSheetData[];
        setSheets(data);
      }
    } catch {
      /* ignore */
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSub = async (name: string) => {
    try {
      setCreatingSub(true);
      const res = await fetch(`/api/mv/projects/${projectId}/subprojects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const created = await res.json();
        toast({ description: t.createSubSuccess });
        router.push(`/machine-valuation/${projectId}/${created._id}`);
      }
    } catch {
      // error
    } finally {
      setCreatingSub(false);
      setCreateSubOpen(false);
    }
  };

  const handleDeleteSub = async (subId: string) => {
    if (!confirm(t.confirmDeleteSub)) return;
    try {
      const res = await fetch(`/api/mv/projects/${projectId}/subprojects/${subId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setSubProjects((prev) => prev.filter((s) => s._id !== subId));
        toast({ description: t.deleteSuccess });
      }
    } catch {
      // error
    }
  };

  const handleDeleteAllSheets = async () => {
    if (!confirm(t.confirmDeleteAllSheets)) return;
    try {
      setDeletingAllSheets(true);
      const res = await fetch(
        `/api/mv/sheets?projectId=${encodeURIComponent(projectId)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (res.ok) {
        setSheets([]);
        toast({ description: t.deleteAllSheetsSuccess });
      } else {
        toast({ variant: "destructive", description: t.deleteAllSheetsError });
      }
    } catch {
      toast({ variant: "destructive", description: t.deleteAllSheetsError });
    } finally {
      setDeletingAllSheets(false);
    }
  };

  const handleDeleteSheet = async (sheetId: string) => {
    if (!confirm(t.confirmDeleteSheet)) return;
    try {
      const res = await fetch(`/api/mv/sheets/${sheetId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setSheets((prev) => prev.filter((s) => s._id !== sheetId));
        toast({ description: t.deleteSuccess });
      }
    } catch {
      // error
    }
  };

  const handleFileParsed = async (result: MvUploadResponse) => {
    try {
      if (isMvUploadPersistResult(result)) {
        await refreshSheets();
        if (result.savedSheets.length > 0 && result.saveErrors.length === 0) {
          toast({ description: t.importSuccess });
        } else if (result.savedSheets.length > 0 && result.saveErrors.length > 0) {
          toast({ description: t.importSuccess });
          toast({
            variant: "destructive",
            title: t.importSaveIssues,
            description: result.saveErrors.slice(0, 4).join(" · "),
          });
        } else if (result.saveErrors.length > 0) {
          toast({
            variant: "destructive",
            title: t.importSaveIssues,
            description: result.saveErrors.slice(0, 5).join(" · "),
          });
        } else {
          toast({ variant: "destructive", description: t.importSaveFailed });
        }
      } else {
        for (const sheet of result.sheets) {
          try {
            const res = await fetch("/api/mv/sheets", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                projectId,
                name: sheet.name,
                headers: sheet.headers,
                rows: sheet.rows,
                sourceType: "file-import",
                sourceFileName: result.sourceFileName,
              }),
            });
            if (res.ok) {
              const saved = (await res.json()) as MvSheetData;
              setSheets((prev) => [...prev, saved]);
            }
          } catch {
            /* continue */
          }
        }
        await refreshSheets();
        toast({ description: t.importSuccess });
      }
    } finally {
      setShowUpload(false);
    }
  };

  const openSheetForEdit = async (sheet: MvSheetData) => {
    if (!sheet._id) return;
    setOpeningSheetId(sheet._id);
    try {
      const res = await fetch(`/api/mv/sheets/${sheet._id}`, {
        credentials: "include",
      });
      if (res.ok) {
        const full = (await res.json()) as MvSheetData;
        setEditingSheet(full);
      } else {
        toast({ variant: "destructive", description: t.openSheetError });
      }
    } catch {
      toast({ variant: "destructive", description: t.openSheetError });
    } finally {
      setOpeningSheetId(null);
    }
  };

  const handleCreateNewSheet = () => {
    const defaultHeaders = ["Column A", "Column B", "Column C", "Column D", "Column E"];
    const defaultRows = Array.from({ length: 10 }, () => {
      const row: Record<string, string | number | null> = {};
      defaultHeaders.forEach((h) => { row[h] = null; });
      return row;
    });
    setEditingSheet({
      projectId,
      name: `${t.sheetName} ${sheets.length + 1}`,
      headers: defaultHeaders,
      rows: defaultRows,
      sourceType: "manual",
    });
    setShowNewSheet(true);
  };

  const handleSaveSheet = async (sheet: MvSheetData) => {
    try {
      if (sheet._id) {
        const res = await fetch(`/api/mv/sheets/${sheet._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(sheet),
        });
        if (res.ok) {
          const updated = await res.json();
          setSheets((prev) => prev.map((s) => (s._id === updated._id ? updated : s)));
          toast({ description: t.saveSuccess });
        }
      } else {
        const res = await fetch("/api/mv/sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(sheet),
        });
        if (res.ok) {
          const saved = await res.json();
          setSheets((prev) => [...prev, saved]);
          toast({ description: t.saveSuccess });
        }
      }
    } catch {
      // error
    }
    setEditingSheet(null);
    setShowNewSheet(false);
  };

  if (editingSheet || showNewSheet) {
    return (
      <div className="space-y-2">
        <BreadcrumbNav
          segments={[
            { label: project?.name || projectId, href: `/machine-valuation/${projectId}` },
            { label: editingSheet?.name || "", href: "#" },
          ]}
        />
        <SpreadsheetEditor
          initialData={editingSheet!}
          projectId={projectId}
          onSave={handleSaveSheet}
          onCancel={() => {
            setEditingSheet(null);
            setShowNewSheet(false);
          }}
        />
      </div>
    );
  }

  if (showUpload) {
    return (
      <div className="space-y-2">
        <BreadcrumbNav
          segments={[
            { label: project?.name || projectId, href: `/machine-valuation/${projectId}` },
          ]}
        />
        <FileUpload
          projectId={projectId}
          onParsed={handleFileParsed}
          onCancel={() => setShowUpload(false)}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full space-y-1.5 pb-1">
        <div className="h-9 animate-pulse rounded-lg border border-slate-200/80 bg-white" />
        <div className="h-24 animate-pulse rounded-xl border border-slate-200/80 bg-white" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg border border-slate-200/80 bg-white"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-1.5 pb-1.5">
      <div className="rounded-lg border border-slate-200/90 bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur-sm sm:px-2.5">
        <BreadcrumbNav
          segments={[
            { label: project?.name || projectId, href: `/machine-valuation/${projectId}` },
          ]}
        />
      </div>

      <MvPageSection title={t.quickActionsTitle}>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => setCreateSubOpen(true)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-semibold text-slate-800 shadow-sm",
              "transition-all hover:border-sky-300/80 hover:bg-sky-50/50 hover:shadow",
              "active:scale-[0.99]",
            )}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-100 text-sky-700">
              <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
            {t.newSub}
          </button>
          <DataImportSelector
            onSelectImport={() => setShowUpload(true)}
            onSelectCreate={handleCreateNewSheet}
          />
        </div>
      </MvPageSection>

      {subProjects.length > 0 ? (
        <MvPageSection title={t.subProjects} badge={subProjects.length}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {subProjects.map((sub) => (
              <div
                key={sub._id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/machine-valuation/${projectId}/${sub._id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/machine-valuation/${projectId}/${sub._id}`);
                  }
                }}
                className={cn(
                  "group relative flex flex-col gap-2 rounded-lg border border-slate-200/90 bg-white p-2.5 text-start outline-none",
                  "cursor-pointer transition-all duration-200",
                  "hover:border-sky-300/70 hover:shadow-sm hover:shadow-slate-900/[0.04]",
                  "focus-visible:ring-2 focus-visible:ring-sky-400/40",
                )}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex min-w-0 items-start gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-600 ring-1 ring-sky-500/10">
                      <Folder className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold leading-snug text-slate-900">
                        {sub.name}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                        <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" />
                        {formatDate(sub.createdAt)}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600",
                          "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                        )}
                        aria-label={t.delete}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSub(sub._id);
                        }}
                        className="cursor-pointer text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                        {t.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </MvPageSection>
      ) : null}

      <MvPageSection
        title={t.sheets}
        badge={sheets.length > 0 ? sheets.length : undefined}
        action={
          sheets.length > 0 ? (
            <button
              type="button"
              disabled={deletingAllSheets}
              onClick={() => void handleDeleteAllSheets()}
              className={cn(
                "rounded-md border border-red-200/90 bg-white px-2 py-1 text-[10px] font-semibold text-red-600",
                "transition-colors hover:border-red-300 hover:bg-red-50",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {deletingAllSheets ? t.deletingAllSheets : t.deleteAllSheets}
            </button>
          ) : undefined
        }
      >
        {sheets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 py-6 text-center">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-300 shadow-sm ring-1 ring-slate-200/80">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <p className="max-w-sm px-2 text-[11px] font-medium text-slate-600">{t.noSheets}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sheets.map((sheet) => (
              <div
                key={sheet._id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!openingSheetId) void openSheetForEdit(sheet);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (!openingSheetId) void openSheetForEdit(sheet);
                  }
                }}
                className={cn(
                  "group relative flex flex-col gap-2 rounded-lg border border-slate-200/90 bg-white p-2.5 text-start outline-none",
                  "cursor-pointer transition-all duration-200",
                  "hover:border-emerald-300/70 hover:shadow-sm hover:shadow-slate-900/[0.04]",
                  "focus-visible:ring-2 focus-visible:ring-emerald-400/40",
                  openingSheetId === sheet._id && "pointer-events-none opacity-50",
                )}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex min-w-0 items-start gap-2">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/10">
                      <FileSpreadsheet className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-semibold leading-snug text-slate-900">
                        {sheet.name}
                      </p>
                      {sheet.sourceFileName ? (
                        <p
                          className="mt-0.5 truncate text-[10px] text-slate-500"
                          dir="auto"
                          title={sheet.sourceFileName}
                        >
                          <span className="text-slate-400">{t.sourceFile}: </span>
                          {sheet.sourceFileName}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600",
                          "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                        )}
                        aria-label={t.delete}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSheet(sheet._id!);
                        }}
                        className="cursor-pointer text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                        {t.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                  <MvMetaPill>
                    {sheet.headers.length} {t.colsAbbr}
                  </MvMetaPill>
                  <MvMetaPill>
                    {sheet.rowCount ?? sheet.rows?.length ?? 0} {t.rowsAbbr}
                  </MvMetaPill>
                </div>
              </div>
            ))}
          </div>
        )}
      </MvPageSection>

      <CreateDialog
        open={createSubOpen}
        onOpenChange={setCreateSubOpen}
        variant="sub-project"
        loading={creatingSub}
        onSubmit={handleCreateSub}
      />
    </div>
  );
}
