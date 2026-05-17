"use client";

import { Tajawal } from "next/font/google";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FilterX,
  FolderOpen,
  FolderPlus,
  FolderSymlink,
  LayoutGrid,
  Loader2,
  MapPinned,
  FileDown,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Users,
  Workflow,
} from "lucide-react";
import Link from "@/components/prefetch-link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { toApiUrl } from "@/lib/api-url";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import type {
  MvProject,
  MvProjectContact,
  MvInspectionAssignment,
  MvProjectLocation,
  MvProjectReportType,
  MvProjectWorkflowStatus,
} from "./types";
import CreateDialog from "./create-dialog";
import {
  createProjectInspectionSiteForm,
  projectContactDataFromInspectionSites,
  projectInspectionSitesFromData,
  type MvProjectInspectionSiteForm,
} from "./mv-project-contact-data";
import { MvInspectionLocationsFields } from "./mv-inspection-locations-fields";
import { MvAssetImageFoldersModal } from "./mv-asset-image-folders-modal";
import { MvInspectorFilesPanel } from "./mv-inspector-files-workspace";
import {
  MV_ALL_LOCATIONS_VALUE,
  MvLocationMultiSelect,
  mvLocationId,
  mvLocationSelectionSummary,
} from "./mv-location-multi-select";
import { MvEmptyState, MvStatusBadge, MvTopBar } from "./mv-ui";
import { useMvInPageNavigation } from "./mv-inpage-navigation";
import { mvAutoPdfDownloadStorageKey } from "./mv-home-routes";

type PaginationToken = number | "ellipsis-start" | "ellipsis-end";
type ProjectStatusFilter = "all" | MvProjectWorkflowStatus;
type ContactDialogTab = "locations" | "inspectors" | "files";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

const MV_WORKFLOW_LABEL_AR: Record<MvProjectWorkflowStatus, string> = {
  new: "جديد",
  review: "قيد المراجعة",
  approved: "معتمد",
};

const MV_REPORT_TYPE_LABEL_AR: Record<MvProjectReportType, string> = {
  simple: "تقرير مبسّط",
  advanced: "تقرير متقدّم",
};

const PROJECT_STATUS_FILTERS: ProjectStatusFilter[] = ["all", "new", "review", "approved"];

const PROJECT_STATUS_FILTER_LABEL_AR: Record<ProjectStatusFilter, string> = {
  all: "كل الحالات",
  ...MV_WORKFLOW_LABEL_AR,
};

const numberFormatter = new Intl.NumberFormat("ar-SA");

function normalizeWorkflowStatus(raw: string | undefined | null): MvProjectWorkflowStatus {
  if (raw === "review" || raw === "approved" || raw === "new") return raw;
  return "new";
}

function projectProgressPct(project: MvProject): number {
  const sheets = project.sheetCount ?? 0;
  const subs = project.subProjectCount ?? 0;
  if (sheets === 0 && subs === 0) return 0;
  if (sheets >= 4) return 100;
  const score = subs * 22 + sheets * 20 + 10;
  return Math.min(99, Math.round(score));
}

function formatDateLabel(value: string | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getStatusTone(status: MvProjectWorkflowStatus): "info" | "warning" | "success" {
  if (status === "approved") return "success";
  if (status === "review") return "warning";
  return "info";
}

function projectWorkspaceHref(projectId: string) {
  return `/machine-valuation/${projectId}/workflow/report-data`;
}

function projectRecentTimestamp(project: MvProject): number {
  const updated = Date.parse(project.updatedAt);
  if (!Number.isNaN(updated)) return updated;
  const created = Date.parse(project.createdAt);
  return Number.isNaN(created) ? 0 : created;
}

function ProjectWorkspaceLink({
  projectId,
  title,
  nameClassName,
  compact,
}: {
  projectId: string;
  title: string;
  nameClassName?: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={projectWorkspaceHref(projectId)}
      className={cn(
        "group inline-flex max-w-full items-center gap-2 rounded-lg text-start outline-none transition-colors",
        "text-slate-900 hover:text-[#0C447C]",
        "focus-visible:ring-2 focus-visible:ring-sky-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        compact ? "py-0.5" : "py-1",
      )}
    >
      <FolderOpen
        className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-sky-600"
        aria-hidden
      />
      <span
        className={cn(
          "min-w-0 flex-1 break-words font-semibold leading-snug underline decoration-transparent decoration-2 underline-offset-4 transition group-hover:decoration-sky-300/90",
          compact ? "text-[13px]" : "text-sm sm:text-[15px]",
          nameClassName,
        )}
      >
        {title}
      </span>
      <ChevronLeft
        className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-sky-500"
        aria-hidden
      />
    </Link>
  );
}

function buildPaginationTokens(currentPage: number, totalPages: number): PaginationToken[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  if (currentPage <= 3) {
    return [1, 2, 3, 4, "ellipsis-end", totalPages];
  }
  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis-start", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "ellipsis-start", currentPage - 1, currentPage, currentPage + 1, "ellipsis-end", totalPages];
}

function ProjectActionsMenu({
  project,
  onOpenAssetFolders,
  onOpenLocations,
  onDelete,
}: {
  project: MvProject;
  onOpenAssetFolders: (project: MvProject) => void;
  onOpenLocations: (project: MvProject) => void;
  onDelete: (projectId: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-[#378ADD]/40 hover:bg-slate-50 hover:text-[#0C447C]"
          aria-label={`إجراءات ${project.name || "المشروع"}`}
        >
          <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 text-right">
        <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onSelect={() => onOpenLocations(project)}>
          <MapPinned className="h-4 w-4 shrink-0 text-emerald-600" />
          تحديد مواقع المعاينة
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onSelect={() => onOpenAssetFolders(project)}>
          <FolderPlus className="h-4 w-4 shrink-0 text-[#378ADD]" />
          انشاء مجلدات الاصول
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-[13px]"
          onSelect={() => {
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem(mvAutoPdfDownloadStorageKey(project._id), "1");
              window.location.href = `/machine-valuation/${project._id}/workflow/report`;
            }
          }}
        >
          <FileDown className="h-4 w-4 shrink-0 text-[#0C447C]" />
          تنزيل التقرير النهائي
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-[13px] text-red-600 focus:text-red-600"
          onSelect={() => onDelete(project._id)}
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          حذف المشروع
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProjectsPagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  if (totalItems === 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const tokens = buildPaginationTokens(currentPage, totalPages);

  return (
    <div className="flex flex-col gap-2 border-t border-slate-200/80 bg-white px-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-3">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <p className="text-[11px] tabular-nums text-slate-500">
          {numberFormatter.format(start)}–{numberFormatter.format(end)} / {numberFormatter.format(totalItems)}
        </p>
        <div className="flex items-center gap-1.5">
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <SelectTrigger className="h-8 w-[88px] rounded-md border-slate-200 bg-slate-50 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 8, 10, 20].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {numberFormatter.format(size)} / صفحة
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-0.5">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="الصفحة السابقة"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        {tokens.map((token, index) =>
          typeof token === "number" ? (
            <button
              key={`${token}-${index}`}
              type="button"
              onClick={() => onPageChange(token)}
              className={cn(
                "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-[11px] font-semibold transition",
                token === currentPage
                  ? "border-cyan-600 bg-cyan-600 text-white"
                  : "border-transparent text-slate-600 hover:bg-slate-100",
              )}
            >
              {numberFormatter.format(token)}
            </button>
          ) : (
            <span
              key={`${token}-${index}`}
              className="inline-flex h-8 min-w-6 items-center justify-center px-0.5 text-[11px] text-slate-400"
            >
              …
            </span>
          ),
        )}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="الصفحة التالية"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function ProjectMetricGrid({
  items,
}: {
  items: { hint: string; value: string; icon: React.ReactNode }[];
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {items.map((item) => (
        <div
          key={item.hint}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-slate-600"
        >
          <span className="text-slate-400 [&>svg]:h-3.5 [&>svg]:w-3.5">{item.icon}</span>
          <span className="text-[11px] font-bold text-slate-500">{item.hint}</span>
          <span className="text-[15px] font-black tabular-nums text-slate-950">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

type CompanyOptionRow = { id: string; name: string };
type ProjectInspectorOption = {
  id: string;
  username: string;
  email?: string | null;
  phone?: string | null;
};

function inspectorOptionLabel(inspector: ProjectInspectorOption): string {
  return inspector.username || inspector.email || inspector.phone || "معاين";
}

function normalizeInspectorSelection(value: readonly string[], inspectors: readonly ProjectInspectorOption[]): string[] {
  const allowed = new Set(inspectors.map((inspector) => inspector.id));
  return Array.from(new Set(value.filter((id) => allowed.has(id))));
}

function inspectorSelectionSummary(value: readonly string[], inspectors: readonly ProjectInspectorOption[]): string {
  const normalized = normalizeInspectorSelection(value, inspectors);
  if (normalized.length === 0) return "اختر المعاينين";
  if (normalized.length === 1) {
    const inspector = inspectors.find((item) => item.id === normalized[0]);
    return inspector ? inspectorOptionLabel(inspector) : "معاين واحد";
  }
  return `${normalized.length} معاينين محددين`;
}

function MultiSelectOptionCheck({ checked }: { checked: boolean }) {
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
        checked ? "border-sky-600 bg-sky-600 text-white" : "border-slate-300 bg-white text-transparent",
      )}
      aria-hidden
    >
      <Check className="h-3 w-3" />
    </span>
  );
}

function ProjectInspectorMultiSelect({
  inspectors,
  value,
  onChange,
  disabled,
  loading,
}: {
  inspectors: ProjectInspectorOption[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const normalized = normalizeInspectorSelection(value, inspectors);
  const allSelected = inspectors.length > 0 && normalized.length === inspectors.length;

  const toggleInspector = (id: string, checked: boolean) => {
    if (checked) {
      onChange(normalizeInspectorSelection([...normalized, id], inspectors));
      return;
    }
    onChange(normalizeInspectorSelection(normalized.filter((item) => item !== id), inspectors));
  };

  const toggleAll = (checked: boolean) => {
    onChange(checked ? inspectors.map((inspector) => inspector.id) : []);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-10 min-w-[190px] justify-between gap-2 rounded-lg border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-700 shadow-none hover:bg-slate-50"
        >
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            <span className="truncate">
              {loading ? "جاري تحميل المعاينين..." : inspectorSelectionSummary(normalized, inspectors)}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[980] w-72 text-right">
        <DropdownMenuLabel className="px-2 py-1.5 text-[12px] text-slate-500">المعاينون</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {inspectors.length > 0 ? (
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              toggleAll(!allSelected);
            }}
            className="cursor-pointer gap-2 text-[12px] font-bold"
          >
            <MultiSelectOptionCheck checked={allSelected} />
            <span className="truncate">كل المعاينين</span>
          </DropdownMenuItem>
        ) : (
          <div className="px-2 py-2 text-[12px] font-semibold text-slate-400">
            لا يوجد مستخدمون بدور معاين.
          </div>
        )}
        {inspectors.length > 0 ? <DropdownMenuSeparator /> : null}
        {inspectors.map((inspector) => {
          const checked = normalized.includes(inspector.id);
          return (
            <DropdownMenuItem
              key={inspector.id}
              onSelect={(event) => {
                event.preventDefault();
                toggleInspector(inspector.id, !checked);
              }}
              className="cursor-pointer gap-2 text-[12px]"
            >
              <MultiSelectOptionCheck checked={checked} />
              <span className="truncate" dir="auto">{inspectorOptionLabel(inspector)}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MvInspectorAssignmentsPanel({
  active,
  project,
  onSaved,
}: {
  active: boolean;
  project: MvProject | null;
  onSaved: (project: MvProject) => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inspectors, setInspectors] = useState<ProjectInspectorOption[]>([]);
  const [draftAssignments, setDraftAssignments] = useState<MvInspectionAssignment[]>([]);
  const [selectedInspectorIds, setSelectedInspectorIds] = useState<string[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([MV_ALL_LOCATIONS_VALUE]);
  const [projectSnapshot, setProjectSnapshot] = useState<MvProject | null>(project);
  const projectId = project?._id;

  useEffect(() => {
    if (!active || !project) return;
    setProjectSnapshot(project);
    setDraftAssignments(project.inspectionAssignments ?? []);
    setSelectedInspectorIds([]);
    setSelectedLocationIds([MV_ALL_LOCATIONS_VALUE]);
  }, [active, project]);

  useEffect(() => {
    if (!active || !projectId) return;
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        const [projectRes, inspectorsRes] = await Promise.all([
          fetch(`/api/mv/projects/${projectId}?picAssetMode=summary`, { credentials: "include" }),
          fetch(`/api/mv/projects/${projectId}/inspectors`, { credentials: "include" }),
        ]);
        if (cancelled) return;
        if (projectRes.ok) {
          const data = (await projectRes.json().catch(() => null)) as { project?: MvProject } | null;
          if (data?.project) {
            setProjectSnapshot(data.project);
            setDraftAssignments(data.project.inspectionAssignments ?? []);
            onSaved(data.project);
          }
        }
        if (inspectorsRes.ok) {
          const data = (await inspectorsRes.json().catch(() => null)) as { inspectors?: ProjectInspectorOption[] } | null;
          setInspectors(data?.inspectors ?? []);
        } else {
          setInspectors([]);
        }
      } catch {
        if (!cancelled) {
          setInspectors([]);
          toast({ variant: "destructive", description: "تعذر تحميل قائمة المعاينين." });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, projectId, onSaved, toast]);

  const locations = projectSnapshot?.locations ?? [];
  const selectedInspectors = inspectors.filter((item) => selectedInspectorIds.includes(item.id));

  const addAssignment = () => {
    if (selectedInspectors.length === 0) return;
    const locationIds = selectedLocationIds.includes(MV_ALL_LOCATIONS_VALUE) ? [] : selectedLocationIds;
    const keyFor = (inspectorId: string) => `${inspectorId}:${locationIds.length > 0 ? locationIds.join("|") : "all"}`;
    const addedKeys = new Set(selectedInspectors.map((inspector) => keyFor(inspector.id)));
    const now = new Date().toISOString();
    setDraftAssignments((prev) => [
      ...prev.filter((assignment) => {
        const existingLocations = assignment.locationIds ?? [];
        const existingKey = `${assignment.inspectorUserId}:${existingLocations.length > 0 ? existingLocations.join("|") : "all"}`;
        return !addedKeys.has(existingKey);
      }),
      ...selectedInspectors.map((inspector, index) => ({
        id: `${inspector.id}-${locationIds.join("-") || "all"}-${Date.now()}-${index}`,
        inspectorUserId: inspector.id,
        inspectorName: inspectorOptionLabel(inspector),
        ...(locationIds.length > 0 ? { locationIds } : {}),
        createdAt: now,
        updatedAt: now,
      })),
    ]);
  };

  const saveAssignments = async () => {
    if (!projectSnapshot?._id) return;
    try {
      setSaving(true);
      const response = await fetch(`/api/mv/projects/${projectSnapshot._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ inspectionAssignments: draftAssignments }),
      });
      if (!response.ok) throw new Error();
      const data = (await response.json().catch(() => null)) as { project?: MvProject } | null;
      if (data?.project) {
        onSaved(data.project);
        setProjectSnapshot(data.project);
        setDraftAssignments(data.project.inspectionAssignments ?? []);
      }
      toast({ description: "تم حفظ اختيار المعاينين." });
    } catch {
      toast({ variant: "destructive", description: "تعذر حفظ اختيار المعاينين." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm ring-1 ring-violet-100">
            <Users className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-black text-slate-900">اختيار المعاينين</p>
            <p className="truncate text-[11px] font-semibold text-slate-500">
              {projectSnapshot?.name || project?.name || "المشروع"}
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="grid gap-2 sm:grid-cols-2">
            <ProjectInspectorMultiSelect
              inspectors={inspectors}
              value={selectedInspectorIds}
              onChange={setSelectedInspectorIds}
              disabled={loading}
              loading={loading}
            />
            <MvLocationMultiSelect
              locations={locations}
              value={selectedLocationIds}
              onChange={setSelectedLocationIds}
              disabled={loading}
              className="h-10"
              label="نطاق عمل المعاين"
            />
          </div>
          <Button
            type="button"
            className="h-10 rounded-lg bg-slate-950 px-4 text-[12px] font-bold text-white hover:bg-slate-800"
            onClick={addAssignment}
            disabled={selectedInspectors.length === 0 || loading}
          >
            إضافة
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          {draftAssignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-[13px] font-semibold text-slate-400">
              لا توجد تعيينات معاينين بعد.
            </div>
          ) : (
            draftAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-black text-slate-900">{assignment.inspectorName}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-slate-500">
                    {mvLocationSelectionSummary(
                      assignment.locationIds?.length ? assignment.locationIds : [MV_ALL_LOCATIONS_VALUE],
                      locations,
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 self-start rounded-lg px-2 text-[11px] font-bold text-red-600 hover:bg-red-50 hover:text-red-700 sm:self-auto"
                  onClick={() => setDraftAssignments((prev) => prev.filter((item) => item.id !== assignment.id))}
                >
                  حذف
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
        <Button
          type="button"
          className="h-10 min-w-[120px] rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800"
          onClick={() => void saveAssignments()}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ اختيار المعاينين"}
        </Button>
      </div>
    </div>
  );
}

export default function MvProjectsDashboard() {
  const { navigate } = useMvInPageNavigation();
  const { toast } = useToast();
  const { user, csrfToken, loading: authLoading } = useAuthTracking();
  const [projects, setProjects] = useState<MvProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [companyOptions, setCompanyOptions] = useState<CompanyOptionRow[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>("all");
  const [sortRecentlyWorked, setSortRecentlyWorked] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [contactDataOpen, setContactDataOpen] = useState(false);
  const [contactDataProject, setContactDataProject] = useState<MvProject | null>(null);
  const [contactDataForm, setContactDataForm] = useState<MvProjectInspectionSiteForm[]>([
    createProjectInspectionSiteForm(0),
  ]);
  const [contactDialogTab, setContactDialogTab] = useState<ContactDialogTab>("locations");
  const [contactFilesLocationIds, setContactFilesLocationIds] = useState<string[]>([MV_ALL_LOCATIONS_VALUE]);
  const [openingInspectorFilesSiteId, setOpeningInspectorFilesSiteId] = useState<string | null>(null);
  const [savingContactData, setSavingContactData] = useState(false);
  const [createdFlowProject, setCreatedFlowProject] = useState<MvProject | null>(null);
  const [assetFoldersOpen, setAssetFoldersOpen] = useState(false);
  const [assetFoldersProject, setAssetFoldersProject] = useState<MvProject | null>(null);

  /**
   * القائمة مُصفّاة من الخادم حسب شركة الجلسة؛ لا نعيد تصفية حسب `companyId` هنا
   * حتى لا نُخفي مشاريع صالحة إن كان الحقل ناقصاً في JSON أو بسبب بيانات قديمة.
   */
  const visibleProjects = useMemo(() => {
    if (!user) return [];
    return projects;
  }, [projects, user]);

  const canCreateMvProject = (() => {
    if (!user) return false;
    return user.role === "super_admin" || Boolean(user.companyId?.trim());
  })();

  const needsCompanyMembership = (() => {
    if (!user) return false;
    return user.role !== "super_admin" && !user.companyId?.trim();
  })();

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/mv/projects", { credentials: "include" });
      if (response.status === 401) {
        setProjects([]);
        toast({
          variant: "destructive",
          description: "سجّل الدخول أولاً لعرض مشاريع تقييم الآلات.",
        });
        return;
      }
      if (response.status === 403) {
        await response.json().catch(() => undefined);
        setProjects([]);
        return;
      }
      if (!response.ok) {
        throw new Error();
      }
      setProjects((await response.json()) as MvProject[]);
    } catch {
      setProjects([]);
      toast({ variant: "destructive", description: "تعذّر تحميل قائمة المشاريع." });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /** بعد انتهاء تحميل الجلسة (أو تغيّر المستخدم/الشركة) نعيد الجلب حتى تُطبَّق فلترة الخادم بالكوكيز الصحيحة. */
  useEffect(() => {
    if (authLoading) return;
    void fetchProjects();
  }, [authLoading, fetchProjects, user?.id, user?.companyId, user?.role]);

  useEffect(() => {
    if (user?.role !== "super_admin" || !csrfToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(toApiUrl("/api/admin/companies"), {
          credentials: "include",
          headers: { "x-csrf-token": csrfToken },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { companies?: CompanyOptionRow[] };
        const rows = data.companies ?? [];
        if (cancelled) return;
        setCompanyOptions(rows.map((c) => ({ id: c.id, name: c.name })));
        setSelectedCompanyId((prev) => prev || rows[0]?.id || "");
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.role, csrfToken]);

  useEffect(() => {
    setCurrentPage(1);
  }, [projectQuery, statusFilter, sortRecentlyWorked, pageSize]);

  const metrics = useMemo(() => {
    const withAssets = visibleProjects.filter((project) => (project.sheetCount ?? 0) > 0).length;
    const withSubfolders = visibleProjects.filter((project) => (project.subProjectCount ?? 0) > 0).length;
    const approved = visibleProjects.filter(
      (project) => normalizeWorkflowStatus(project.workflowStatus) === "approved",
    ).length;

    return [
      {
        hint: "الإجمالي",
        value: numberFormatter.format(visibleProjects.length),
        icon: <LayoutGrid />,
      },
      {
        hint: "بها أصول",
        value: numberFormatter.format(withAssets),
        icon: <FileSpreadsheet />,
      },
      {
        hint: "فرعية",
        value: numberFormatter.format(withSubfolders),
        icon: <FolderSymlink />,
      },
      {
        hint: "معتمدة",
        value: numberFormatter.format(approved),
        icon: <Workflow />,
      },
    ];
  }, [visibleProjects]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = projectQuery.trim().toLocaleLowerCase();

    const next = visibleProjects.filter((project) => {
      if (normalizedQuery && !project.name.toLocaleLowerCase().includes(normalizedQuery)) {
        return false;
      }

      if (statusFilter !== "all" && normalizeWorkflowStatus(project.workflowStatus) !== statusFilter) {
        return false;
      }

      return true;
    });

    if (!sortRecentlyWorked) return next;

    return [...next].sort((a, b) => {
      const recentDelta = projectRecentTimestamp(b) - projectRecentTimestamp(a);
      if (recentDelta !== 0) return recentDelta;
      return b._id.localeCompare(a._id);
    });
  }, [projectQuery, sortRecentlyWorked, statusFilter, visibleProjects]);

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize));

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [currentPage, filteredProjects, pageSize]);

  const handleCreate = async (
    name: string,
    options?: {
      reportType: MvProjectReportType;
    },
  ) => {
    try {
      setCreating(true);
      const payload: {
        name: string;
        companyId?: string;
        reportType?: MvProjectReportType;
        locations?: MvProjectLocation[];
        contacts?: MvProjectContact[];
      } = {
        name,
        reportType: options?.reportType ?? "simple",
        locations: [],
        contacts: [],
      };
      if (user?.role === "super_admin") {
        const cid = selectedCompanyId.trim();
        if (!cid) {
          toast({ variant: "destructive", description: "اختر الشركة التي يخصّها المشروع." });
          return;
        }
        payload.companyId = cid;
      }
      const response = await fetch("/api/mv/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error();
      }
      const created = (await response.json()) as MvProject;
      toast({ description: "تم إنشاء المشروع بنجاح." });
      setProjects((prev) => [created, ...prev.filter((project) => project._id !== created._id)]);
      setCreateOpen(false);
      setCreatedFlowProject(created);
      setContactDataProject(created);
      setContactDataForm([createProjectInspectionSiteForm(0)]);
      setContactDataOpen(true);
    } catch {
      toast({ variant: "destructive", description: "تعذر إنشاء المشروع." });
    } finally {
      setCreating(false);
    }
  };

  const mergeProjectIntoList = useCallback((updated: MvProject) => {
    setProjects((prev) => prev.map((project) => (project._id === updated._id ? { ...project, ...updated } : project)));
  }, []);

  const handleInspectorAssignmentsSaved = useCallback(
    (updated: MvProject) => {
      mergeProjectIntoList(updated);
      setContactDataProject(updated);
    },
    [mergeProjectIntoList],
  );

  const openAssetFoldersModal = (project: MvProject) => {
    setAssetFoldersProject(project);
    setAssetFoldersOpen(true);
  };

  const openContactDataModal = async (project: MvProject) => {
    setContactDataProject(project);
    setContactDataForm(projectInspectionSitesFromData(project.locations, project.contacts));
    setContactDialogTab("locations");
    setContactFilesLocationIds([MV_ALL_LOCATIONS_VALUE]);
    setContactDataOpen(true);

    try {
      const response = await fetch(`/api/mv/projects/${project._id}?picAssetMode=summary`, {
        credentials: "include",
      });
      if (!response.ok) return;
      const raw = (await response.json().catch(() => null)) as { project?: MvProject } | MvProject | null;
      const freshProject: MvProject | undefined =
        raw && "project" in raw
          ? raw.project
          : raw && "_id" in raw
            ? raw
            : undefined;
      if (!freshProject?._id) return;

      setProjects((prev) =>
        prev.map((item) => (item._id === freshProject._id ? { ...item, ...freshProject } : item)),
      );
      setContactDataProject(freshProject);
      setContactDataForm(projectInspectionSitesFromData(freshProject.locations, freshProject.contacts));
    } catch {
      // Keep the already-open form populated from the project list fallback.
    }
  };

  const handleSaveContactData = async (
    options: {
      closeDialog?: boolean;
      continueCreatedFlow?: boolean;
      showToast?: boolean;
    } = {},
  ): Promise<MvProject | null> => {
    const {
      closeDialog = true,
      continueCreatedFlow = true,
      showToast = true,
    } = options;
    if (!contactDataProject) return null;
    const payload = projectContactDataFromInspectionSites(contactDataForm);
    try {
      setSavingContactData(true);
      const response = await fetch(`/api/mv/projects/${contactDataProject._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error();

      const raw = (await response.json().catch(() => null)) as { project?: MvProject } | null;
      const updatedProject: MvProject = raw?.project
        ? raw.project
        : {
            ...contactDataProject,
            ...payload,
            updatedAt: new Date().toISOString(),
          };

      setProjects((prev) =>
        prev.map((project) =>
          project._id === contactDataProject._id
            ? {
                ...project,
                ...updatedProject,
                locations: updatedProject.locations ?? payload.locations,
                contacts: updatedProject.contacts ?? payload.contacts,
              }
            : project,
        ),
      );
      setContactDataProject(updatedProject);
      if (closeDialog) setContactDataOpen(false);
      if (continueCreatedFlow && createdFlowProject?._id === contactDataProject._id) {
        setCreatedFlowProject(updatedProject);
        setAssetFoldersOpen(true);
      }
      if (showToast) toast({ description: "تم تحديث مواقع المعاينة والتواصل." });
      return updatedProject;
    } catch {
      if (showToast) toast({ variant: "destructive", description: "تعذر تحديث مواقع المعاينة والتواصل." });
      return null;
    } finally {
      setSavingContactData(false);
    }
  };

  const openInspectorFilesForSite = async (site: MvProjectInspectionSiteForm) => {
    if (!contactDataProject?._id) return;
    setOpeningInspectorFilesSiteId(site.id);
    try {
      const updatedProject = await handleSaveContactData({
        closeDialog: false,
        continueCreatedFlow: false,
        showToast: false,
      });
      if (!updatedProject) {
        toast({ variant: "destructive", description: "احفظ موقع المعاينة أولاً قبل إضافة ملفات المعاين." });
        return;
      }

      const hasSavedLocation = (updatedProject.locations ?? []).some(
        (location, index) => mvLocationId(location, index) === site.id,
      );
      if (!hasSavedLocation) {
        toast({
          variant: "destructive",
          description: "أضف بيانات للموقع ثم احفظه قبل رفع ملفات المعاين عليه.",
        });
        return;
      }

      setContactDataProject(updatedProject);
      setContactFilesLocationIds([site.id]);
      setContactDialogTab("files");
    } finally {
      setOpeningInspectorFilesSiteId(null);
    }
  };

  const handleSkipInspectionLocations = () => {
    setContactDataOpen(false);
    setContactDialogTab("locations");
    setContactFilesLocationIds([MV_ALL_LOCATIONS_VALUE]);
    if (createdFlowProject) {
      setAssetFoldersOpen(true);
      return;
    }
    setContactDataProject(null);
  };

  const finishCreatedProjectSetup = () => {
    const projectId = createdFlowProject?._id;
    setAssetFoldersOpen(false);
    setAssetFoldersProject(null);
    setCreatedFlowProject(null);
    setContactDataProject(null);
    if (projectId) {
      navigate(`/machine-valuation/${projectId}/workflow/report-data`);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    const target = visibleProjects.find((p) => p._id === projectId);
    if (!window.confirm(`حذف المشروع «${target?.name || projectId}»؟ سيتم حذف جميع البيانات المرتبطة به ولا يمكن التراجع.`)) return;
    try {
      const response = await fetch(`/api/mv/projects/${projectId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error();
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
      toast({ description: "تم حذف المشروع." });
    } catch {
      toast({ variant: "destructive", description: "تعذّر حذف المشروع." });
    }
  };

  const resetFilters = () => {
    setProjectQuery("");
    setStatusFilter("all");
    setSortRecentlyWorked(true);
  };

  const hasActiveFilters =
    projectQuery.trim().length > 0 || statusFilter !== "all" || !sortRecentlyWorked;

  return (
    <div className={cn(tajawal.className, "min-h-screen bg-[#f5f7fb] text-slate-950")} dir="rtl">
      <MvTopBar
        breadcrumbs={[
          { label: "لوحة التحكم", href: "/machine-valuation/dashboard" },
          { label: "المشاريع" },
        ]}
        sticky
        className="top-0 z-30 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85"
      />

      <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-3 px-3 py-3 sm:px-5 lg:px-6">
        <section className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
              <h1 className="shrink-0 text-[20px] font-black text-slate-950">المشاريع</h1>
              <ProjectMetricGrid items={metrics} />
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={!canCreateMvProject}
              title={
                needsCompanyMembership
                  ? "يجب أن يكون حسابك مرتبطاً بشركة لإنشاء مشروع"
                  : "إنشاء مشروع جديد"
              }
              aria-label="إنشاء مشروع جديد"
              className="h-10 shrink-0 gap-2 rounded-lg bg-slate-950 px-4 text-[13px] font-black text-white shadow-sm hover:bg-slate-800 disabled:opacity-45"
            >
              <Plus className="h-4 w-4" aria-hidden />
              <span>إنشاء مشروع جديد</span>
            </Button>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-200 bg-white px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-[minmax(220px,1fr)_180px] lg:max-w-2xl">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={projectQuery}
                  onChange={(event) => setProjectQuery(event.target.value)}
                  placeholder="بحث في المشاريع"
                  className="h-10 rounded-lg border-slate-200 bg-slate-50 pr-9 text-[13px] font-semibold shadow-none focus-visible:ring-slate-200"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as ProjectStatusFilter)}
              >
                <SelectTrigger
                  aria-label="بحث متقدم حسب الحالة"
                  className="h-10 justify-start gap-2 rounded-lg border-slate-200 bg-slate-50 text-[12px] font-bold text-slate-700 shadow-none focus:ring-slate-200 [&>svg:last-child]:mr-auto"
                >
                  <span className="shrink-0 text-[11px] font-black text-slate-400">الحالة</span>
                  <SelectValue placeholder="كل الحالات" />
                </SelectTrigger>
                <SelectContent align="end">
                  {PROJECT_STATUS_FILTERS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {PROJECT_STATUS_FILTER_LABEL_AR[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSortRecentlyWorked((current) => !current)}
                className={cn(
                  "h-9 shrink-0 gap-1.5 rounded-lg px-3 text-[11px] font-black shadow-none",
                  sortRecentlyWorked
                    ? "border-sky-200 bg-sky-50 text-[#0C447C] hover:bg-sky-100 hover:text-[#0C447C]"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
                title="ترتيب حسب آخر مشروع تم العمل عليه"
                aria-pressed={sortRecentlyWorked}
              >
                <ArrowDownWideNarrow className="h-3.5 w-3.5" aria-hidden />
                <span>الأحدث عملاً</span>
              </Button>
              <span className="whitespace-nowrap rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] font-bold tabular-nums text-slate-500">
                {numberFormatter.format(filteredProjects.length)} / {numberFormatter.format(visibleProjects.length)}
              </span>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  onClick={resetFilters}
                  title="مسح التصفية"
                  aria-label="مسح التصفية"
                >
                  <FilterX className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          {loading || authLoading ? (
            <div className="divide-y divide-slate-100">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="flex animate-pulse items-center gap-3 px-4 py-3">
                  <div className="h-8 w-8 shrink-0 rounded-lg bg-slate-200" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-[42%] max-w-sm rounded bg-slate-200" />
                    <div className="h-2 w-24 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : needsCompanyMembership ? (
            <div className="py-6">
              <MvEmptyState title="الحساب غير مرتبط بشركة." />
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="py-6">
              <MvEmptyState
                title="لا توجد مشاريع"
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateOpen(true)}
                    disabled={!canCreateMvProject}
                    className="rounded-lg border-slate-300 text-[12px]"
                  >
                    إنشاء
                  </Button>
                }
              />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="py-6">
              <MvEmptyState
                title="لا نتائج"
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    className="rounded-lg text-[12px]"
                  >
                    مسح التصفية
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[980px] table-fixed border-collapse text-right">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black text-slate-500">
                      <th className="w-[32%] px-4 py-3">المشروع</th>
                      <th className="w-[120px] px-3 py-3">الحالة</th>
                      <th className="w-[140px] px-3 py-3">النوع</th>
                      <th className="w-[88px] px-2 py-3 text-center">أصول</th>
                      <th className="w-[88px] px-2 py-3 text-center">فرعية</th>
                      <th className="w-[160px] px-3 py-3">التقدم</th>
                      <th className="w-[130px] px-3 py-3">آخر تحديث</th>
                      <th className="w-[110px] px-3 py-3 text-center" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedProjects.map((project) => {
                      const workflowStatus = normalizeWorkflowStatus(project.workflowStatus);
                      const progress = projectProgressPct(project);
                      const reportType = project.reportType;
                      const reportLabel =
                        reportType === "simple" || reportType === "advanced"
                          ? MV_REPORT_TYPE_LABEL_AR[reportType]
                          : "—";
                      const sheets = project.sheetCount ?? 0;
                      const subs = project.subProjectCount ?? 0;

                      return (
                        <tr key={project._id} className="bg-white text-right transition-colors hover:bg-slate-50">
                          <td className="px-4 py-3 align-middle">
                            <ProjectWorkspaceLink
                              projectId={project._id}
                              title={project.name || "—"}
                              compact
                              nameClassName="text-[13px] font-black"
                            />
                          </td>

                          <td className="px-3 py-3 align-middle">
                            <MvStatusBadge
                              label={MV_WORKFLOW_LABEL_AR[workflowStatus]}
                              tone={getStatusTone(workflowStatus)}
                              className="whitespace-nowrap px-2 py-0.5 text-[10px]"
                            />
                          </td>

                          <td className="px-3 py-3 align-middle text-[12px] font-semibold text-slate-600">
                            {reportLabel}
                          </td>

                          <td className="px-2 py-3 text-center align-middle">
                            <span className="font-bold tabular-nums text-slate-800">
                              {numberFormatter.format(sheets)}
                            </span>
                          </td>

                          <td className="px-2 py-3 text-center align-middle">
                            <span className="font-bold tabular-nums text-slate-800">
                              {numberFormatter.format(subs)}
                            </span>
                          </td>

                          <td className="px-3 py-3 align-middle">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-slate-700 transition-[width]"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="w-9 shrink-0 text-[10px] font-bold tabular-nums text-slate-500">
                                {numberFormatter.format(progress)}٪
                              </span>
                            </div>
                          </td>

                          <td className="px-3 py-3 align-middle text-[12px] font-semibold tabular-nums text-slate-500">
                            {formatDateLabel(project.updatedAt)}
                          </td>

                          <td className="px-3 py-3 align-middle">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 rounded-lg border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                              >
                                <Link href={projectWorkspaceHref(project._id)}>
                                  فتح
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                              <ProjectActionsMenu
                                project={project}
                                onOpenAssetFolders={openAssetFoldersModal}
                                onOpenLocations={openContactDataModal}
                                onDelete={(id) => void handleDeleteProject(id)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-2 bg-slate-50 p-2 lg:hidden">
                {paginatedProjects.map((project) => {
                  const workflowStatus = normalizeWorkflowStatus(project.workflowStatus);
                  const progress = projectProgressPct(project);
                  const reportType = project.reportType;
                  const reportLabel =
                    reportType === "simple" || reportType === "advanced"
                      ? MV_REPORT_TYPE_LABEL_AR[reportType]
                      : null;

                  return (
                    <article key={project._id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <ProjectWorkspaceLink
                            projectId={project._id}
                            title={project.name || "—"}
                            compact
                            nameClassName="text-[13px] font-black"
                          />
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <MvStatusBadge
                              label={MV_WORKFLOW_LABEL_AR[workflowStatus]}
                              tone={getStatusTone(workflowStatus)}
                              className="whitespace-nowrap px-1.5 py-0.5 text-[10px]"
                            />
                            {reportLabel ? (
                              <span className="text-[10px] font-bold text-slate-400">{reportLabel}</span>
                            ) : null}
                          </div>
                        </div>
                        <ProjectActionsMenu
                          project={project}
                          onOpenAssetFolders={openAssetFoldersModal}
                          onOpenLocations={openContactDataModal}
                          onDelete={(id) => void handleDeleteProject(id)}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-bold tabular-nums text-slate-600">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-center">
                          {numberFormatter.format(project.sheetCount ?? 0)} أصول
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-center">
                          {numberFormatter.format(project.subProjectCount ?? 0)} فرعية
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-center">
                          {numberFormatter.format(progress)}٪
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        <span className="text-[10px] font-bold tabular-nums text-slate-400">
                          {formatDateLabel(project.updatedAt)}
                        </span>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 rounded-lg border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                        >
                          <Link href={projectWorkspaceHref(project._id)}>
                            فتح
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>

              <ProjectsPagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filteredProjects.length}
                onPageChange={(page) => setCurrentPage(Math.max(1, Math.min(page, totalPages)))}
                onPageSizeChange={setPageSize}
              />
            </>
          )}
        </section>
      </main>

      <Dialog
        open={contactDataOpen}
        onOpenChange={(open) => {
          if (open) {
            setContactDataOpen(true);
            return;
          }
          if (createdFlowProject) {
            handleSkipInspectionLocations();
            return;
          }
          setContactDataOpen(false);
          setContactDataProject(null);
          setContactDialogTab("locations");
          setContactFilesLocationIds([MV_ALL_LOCATIONS_VALUE]);
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-slate-200 p-0 shadow-2xl sm:max-w-4xl" dir="rtl">
          <DialogHeader className="shrink-0 border-b border-slate-100 bg-white px-5 py-4 text-right">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <MapPinned className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate text-[15px] font-bold text-slate-900">تحديد مواقع المعاينة</DialogTitle>
                <DialogDescription className="truncate text-[12px] text-slate-500">
                  {contactDataProject?.name || "المشروع"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <Tabs
            value={contactDialogTab}
            onValueChange={(value) => {
              const next: ContactDialogTab =
                value === "files" ? "files" : value === "inspectors" ? "inspectors" : "locations";
              if (next === "files") setContactFilesLocationIds([MV_ALL_LOCATIONS_VALUE]);
              setContactDialogTab(next);
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-2">
              <TabsList className="h-auto min-h-9 flex-wrap justify-start rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
                <TabsTrigger value="locations" className="h-7 rounded-md px-3 text-[12px] font-bold">
                  تحديد المواقع
                </TabsTrigger>
                <TabsTrigger value="inspectors" className="h-7 rounded-md px-3 text-[12px] font-bold">
                  اختيار المعاينين
                </TabsTrigger>
                <TabsTrigger value="files" className="h-7 rounded-md px-3 text-[12px] font-bold">
                  إضافة ملفات للمعاين
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="locations" className="m-0 min-h-0 flex-1 overflow-y-auto px-5 py-4 data-[state=inactive]:hidden">
              <MvInspectionLocationsFields
                value={contactDataForm}
                onChange={setContactDataForm}
                disabled={savingContactData}
                onOpenInspectorFiles={(site) => void openInspectorFilesForSite(site)}
                openingInspectorFilesSiteId={openingInspectorFilesSiteId}
              />
            </TabsContent>
            <TabsContent value="inspectors" forceMount className="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
              {contactDataProject?._id ? (
                <MvInspectorAssignmentsPanel
                  active={contactDialogTab === "inspectors"}
                  project={contactDataProject}
                  onSaved={handleInspectorAssignmentsSaved}
                />
              ) : (
                <div className="px-5 py-8 text-center text-[13px] font-semibold text-slate-400">
                  اختر مشروعاً أولاً.
                </div>
              )}
            </TabsContent>
            <TabsContent value="files" forceMount className="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
              {contactDataProject?._id ? (
                <MvInspectorFilesPanel
                  projectId={contactDataProject._id}
                  initialProject={contactDataProject}
                  embedded
                  initialLocationIds={contactFilesLocationIds}
                  locationSelectionLocked={!contactFilesLocationIds.includes(MV_ALL_LOCATIONS_VALUE)}
                  className="h-[min(62vh,620px)]"
                  onProjectLoaded={(project) => {
                    mergeProjectIntoList(project);
                    setContactDataProject(project);
                  }}
                />
              ) : (
                <div className="px-5 py-8 text-center text-[13px] font-semibold text-slate-400">
                  اختر مشروعاً أولاً.
                </div>
              )}
            </TabsContent>
          </Tabs>
          <DialogFooter className="shrink-0 gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-slate-200 bg-white px-5"
              onClick={createdFlowProject ? handleSkipInspectionLocations : () => setContactDataOpen(false)}
              disabled={savingContactData}
            >
              {createdFlowProject ? "تخطي" : "إلغاء"}
            </Button>
            {contactDialogTab !== "inspectors" ? (
              <Button
                type="button"
                className="h-10 min-w-[120px] rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800"
                onClick={() => void handleSaveContactData()}
                disabled={savingContactData}
              >
                {savingContactData ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        variant="project"
        loading={creating}
        submitBlocked={
          !canCreateMvProject ||
          (user?.role === "super_admin" &&
            (!selectedCompanyId.trim() || companyOptions.length === 0))
        }
        extra={
          user?.role === "super_admin" ? (
            <div className="space-y-2 text-right">
              <p className="text-sm font-medium text-slate-800">الشركة</p>
              <Select
                value={selectedCompanyId || undefined}
                onValueChange={setSelectedCompanyId}
                disabled={companyOptions.length === 0}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue
                    placeholder={
                      companyOptions.length === 0 ? "لا توجد شركات أو جاري التحميل…" : "اختر الشركة"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {companyOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : undefined
        }
        onSubmit={handleCreate}
      />

      <MvAssetImageFoldersModal
        open={assetFoldersOpen}
        onOpenChange={(open) => {
          setAssetFoldersOpen(open);
          if (!open && createdFlowProject) {
            finishCreatedProjectSetup();
            return;
          }
          if (!open) setAssetFoldersProject(null);
        }}
        projectId={createdFlowProject?._id ?? assetFoldersProject?._id ?? null}
        showSkip
        skipLabel="تخطي والمتابعة"
      />
    </div>
  );
}
