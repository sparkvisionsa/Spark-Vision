"use client";

import { Tajawal } from "next/font/google";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownWideNarrow,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
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
  UserPlus,
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
import { writeProjectSummaryCache } from "./mv-project-summary-loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { MvDialogContent } from "./mv-dialog";
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
} from "./types"
import CreateDialog from "./create-dialog";
import {
  createProjectInspectionSiteForm,
  projectContactDataFromInspectionSites,
  projectInspectionSitesFromData,
  type MvProjectInspectionSiteForm,
} from "./mv-project-contact-data";
import { MvInspectionLocationsFields } from "./mv-inspection-locations-fields";
import { prefetchMvLocationCatalog } from "./use-mv-location-catalog";
import { MvAssetImageFoldersModal } from "./mv-asset-image-folders-modal";
import { exportProjectAssetsExcel } from "./mv-asset-data-table-modal";
import { MvInspectorFilesPanel } from "./mv-inspector-files-workspace";
import { MvAssetImagesDownloadButton } from "./mv-asset-images-download-button";
import {
  MV_ALL_LOCATIONS_VALUE,
  MvLocationMultiSelect,
  mvLocationId,
  mvLocationSelectionSummary,
} from "./mv-location-multi-select";
import { MvEmptyState, MvErrorState, MvTopBar } from "./mv-ui";
import { MvApiError, invalidateMvApiCache, mvErrorMessage, mvFetchJson } from "./mv-api-client";
import { duplicateMvProject } from "./mv-report-data-clone";
import { MvBusyPercentOverlay } from "./mv-busy-percent-overlay";
import { useMvBusyPercent } from "./use-mv-busy-percent";
import {
  MvProjectWorkflowStatusSelect,
  type MvProjectWorkflowStatusOption,
} from "./mv-project-workflow-status-select";
import { projectAssetFolderCount, projectProgressPctFromProject } from "./mv-simple-project-progress";
import { useMvInPageNavigation } from "./mv-inpage-navigation";
import { downloadMergedReportFiles } from "@/lib/mv-word-template";
import { getWorkflowStatusOptions, useMvI18n, type MvT } from "./mv-i18n";

type PaginationToken = number | "ellipsis-start" | "ellipsis-end";
type ProjectStatusFilter = "all" | MvProjectWorkflowStatus;
type ContactDialogTab = "locations" | "inspectors";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

function createNumberFormatter(isArabic: boolean) {
  return new Intl.NumberFormat(isArabic ? "ar-SA" : "en-US");
}

function normalizeWorkflowStatus(raw: string | undefined | null): MvProjectWorkflowStatus {
  if (raw === "review" || raw === "approved" || raw === "new") return raw;
  return "new";
}

function formatDateLabel(value: string | undefined, isArabic: boolean, notAvailable: string) {
  if (!value) return notAvailable;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return notAvailable;
  return new Intl.DateTimeFormat(isArabic ? "ar-SA" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function reportTypeLabel(reportType: MvProjectReportType | undefined, t: MvT, notAvailable: string) {
  if (reportType === "simple") return t("projects.reportType.simple");
  if (reportType === "advanced") return t("projects.reportType.advanced");
  return notAvailable;
}

function workflowStatusLabel(
  status: MvProjectWorkflowStatusOption,
  isArabic: boolean,
) {
  return isArabic ? status.labelAr : status.labelEn;
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

function projectCreatedTimestamp(project: MvProject): number {
  const created = Date.parse(project.createdAt);
  if (!Number.isNaN(created)) return created;
  const updated = Date.parse(project.updatedAt);
  return Number.isNaN(updated) ? 0 : updated;
}

function ProjectWorkspaceLink({
  project,
  title,
  nameClassName,
  compact,
}: {
  project: MvProject;
  title: string;
  nameClassName?: string;
  compact?: boolean;
}) {
  const projectId = project._id;
  return (
    <Link
      href={projectWorkspaceHref(projectId)}
      onClick={() => {
        try {
          writeProjectSummaryCache(
            projectId,
            { project, subProjects: [] },
            "report",
          );
        } catch {
          // best effort seed before navigation
        }
      }}
      className={cn(
        "group inline-flex max-w-full items-center gap-2 rounded-lg text-start outline-none transition-colors",
        "text-slate-950 hover:text-cyan-700",
        "focus-visible:ring-2 focus-visible:ring-cyan-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        compact ? "py-0.5" : "py-1",
      )}
    >
      <FolderOpen
        className="h-4 w-4 shrink-0 text-slate-400 transition-colors group-hover:text-cyan-600"
        aria-hidden
      />
      <span
        className={cn(
          "min-w-0 flex-1 break-words font-semibold leading-snug underline decoration-transparent decoration-2 underline-offset-4 transition group-hover:decoration-cyan-300/90",
          compact ? "text-[13px]" : "text-sm sm:text-[15px]",
          nameClassName,
        )}
      >
        {title}
      </span>
      <ChevronLeft
        className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-cyan-500"
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
  onDownloadFinalReport,
  downloadingFinalReport,
  onDuplicate,
  duplicating,
  onDelete,
}: {
  project: MvProject;
  onOpenAssetFolders: (project: MvProject) => void;
  onOpenLocations: (project: MvProject) => void;
  onDownloadFinalReport: (project: MvProject) => void;
  downloadingFinalReport?: boolean;
  onDuplicate: (project: MvProject) => void;
  duplicating?: boolean;
  onDelete: (projectId: string) => void;
}) {
  const { t, isArabic } = useMvI18n();
  const { toast } = useToast();
  const assetDownloadButtonRef = useRef<HTMLButtonElement>(null);
  const projectName = project.name || t("projects.table.project");
  const [exportingAssetsExcel, setExportingAssetsExcel] = useState(false);

  const handleExportAssetsExcel = async () => {
    if (exportingAssetsExcel) return;
    setExportingAssetsExcel(true);
    try {
      const { count } = await exportProjectAssetsExcel({
        projectId: project._id,
        projectName,
        t,
        isArabic,
      });
      toast({
        description: t("projects.assetTable.exportSuccess", {
          count: createNumberFormatter(isArabic).format(count),
        }),
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("projects.assetTable.exportFailedTitle"),
        description: error instanceof Error ? error.message : t("projects.assetTable.exportUnexpected"),
      });
    } finally {
      setExportingAssetsExcel(false);
    }
  };

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-800"
          aria-label={t("projects.actions.menu", { name: projectName })}
        >
          <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 text-right">
        <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onSelect={() => onOpenLocations(project)}>
          <MapPinned className="h-4 w-4 shrink-0 text-emerald-600" />
          {t("projects.actions.locationsInspectors")}
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onSelect={() => onOpenAssetFolders(project)}>
          <FolderPlus className="h-4 w-4 shrink-0 text-[#378ADD]" />
          {t("projects.actions.createAssetFolders")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-[13px]"
          onSelect={() => assetDownloadButtonRef.current?.click()}
        >
          <FileDown className="h-4 w-4 shrink-0 text-emerald-700" />
          {t("projects.actions.downloadAssetImages")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={exportingAssetsExcel}
          onSelect={() => void handleExportAssetsExcel()}
        >
          {exportingAssetsExcel ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-teal-700" />
          ) : (
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-teal-700" />
          )}
          {t("projects.actions.exportAssetsExcel")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={downloadingFinalReport}
          onSelect={() => onDownloadFinalReport(project)}
        >
          {downloadingFinalReport ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0C447C]" />
          ) : (
            <FileDown className="h-4 w-4 shrink-0 text-[#0C447C]" />
          )}
          {t("projects.actions.downloadFinalReport")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={duplicating}
          onSelect={() => onDuplicate(project)}
        >
          {duplicating ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-700" />
          ) : (
            <Copy className="h-4 w-4 shrink-0 text-sky-700" />
          )}
          {t("projects.actions.duplicateProject")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-[13px] text-red-600 focus:text-red-600"
          onSelect={() => onDelete(project._id)}
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          {t("projects.actions.deleteProject")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <MvAssetImagesDownloadButton
      projectId={project._id}
      buttonRef={assetDownloadButtonRef}
      className="hidden"
    >
      <span>{t("projects.actions.downloadAssetImages")}</span>
    </MvAssetImagesDownloadButton>
    </>
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
  const { t, isArabic } = useMvI18n();
  const numberFormatter = useMemo(() => createNumberFormatter(isArabic), [isArabic]);

  if (totalItems === 0) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const tokens = buildPaginationTokens(currentPage, totalPages);

  return (
    <div className="flex flex-col gap-2 border-t border-slate-200/80 bg-white/95 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <p className="text-[11px] tabular-nums text-slate-500">
          {numberFormatter.format(start)}–{numberFormatter.format(end)} / {numberFormatter.format(totalItems)}
        </p>
        <div className="flex items-center gap-1.5">
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
            <SelectTrigger className="h-8 w-[92px] rounded-lg border-slate-200 bg-slate-50 text-[11px] shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[5, 8, 10, 20].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {t("projects.pagination.perPage", { size: numberFormatter.format(size) })}
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
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("projects.pagination.prev")}
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
                "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[11px] font-semibold transition",
                token === currentPage
                  ? "border-slate-950 bg-slate-950 text-white"
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
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={t("projects.pagination.next")}
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
    <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.hint}
          className="flex min-h-16 min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-cyan-100 [&>svg]:h-3.5 [&>svg]:w-3.5">{item.icon}</span>
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-bold text-slate-300">{item.hint}</span>
            <span className="block text-[18px] font-black leading-tight tabular-nums text-white">{item.value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

type CompanyOptionRow = { id: string; name: string };
type ProjectInspectorOption = {
  id: string;
  username: string;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  region?: string | null;
  serviceCities?: string[];
  lastLoginAt?: string | null;
  isPhoneVerified?: boolean;
};

function inspectorOptionLabel(inspector: ProjectInspectorOption, fallback: string): string {
  return inspector.displayName || inspector.phone || inspector.username || inspector.email || fallback;
}

function normalizeInspectorSelection(value: readonly string[], inspectors: readonly ProjectInspectorOption[]): string[] {
  const allowed = new Set(inspectors.map((inspector) => inspector.id));
  return Array.from(new Set(value.filter((id) => allowed.has(id))));
}

function inspectorSelectionSummary(
  value: readonly string[],
  inspectors: readonly ProjectInspectorOption[],
  t: MvT,
): string {
  const normalized = normalizeInspectorSelection(value, inspectors);
  const fallbackName = t("projects.inspector.fallbackName");
  if (normalized.length === 0) return t("projects.inspector.select");
  if (normalized.length === 1) {
    const inspector = inspectors.find((item) => item.id === normalized[0]);
    return inspector ? inspectorOptionLabel(inspector, fallbackName) : t("projects.inspector.oneSelected");
  }
  return t("projects.inspector.countSelected", { count: String(normalized.length) });
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

function normalizeAssignmentLocationIds(value: readonly string[]): string[] {
  if (value.includes(MV_ALL_LOCATIONS_VALUE)) return [];
  return Array.from(new Set(value.filter(Boolean))).sort();
}

function inspectionAssignmentKey(inspectorUserId: string, locationIds: readonly string[]): string {
  const normalizedLocations = normalizeAssignmentLocationIds(locationIds);
  return `${inspectorUserId}:${normalizedLocations.length > 0 ? normalizedLocations.join("|") : "all"}`;
}

function systemInspectorCoverageCities(inspector: ProjectInspectorOption): string[] {
  const fromServiceCities = Array.isArray(inspector.serviceCities)
    ? inspector.serviceCities
        .map((item) => item?.trim())
        .filter((item): item is string => Boolean(item))
    : [];
  const fallback = [inspector.region, inspector.city]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));
  return Array.from(new Set(fromServiceCities.length > 0 ? fromServiceCities : fallback));
}

function systemInspectorLocationLabel(inspector: ProjectInspectorOption, isArabic: boolean, t: MvT): string {
  const cities = systemInspectorCoverageCities(inspector);
  return cities.length > 0 ? cities.join(isArabic ? "، " : ", ") : t("projects.inspector.freelance.noCities");
}

function systemInspectorLastLoginLabel(
  value: string | null | undefined,
  isArabic: boolean,
  t: MvT,
): string {
  if (!value) return t("projects.inspector.freelance.neverLoggedIn");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("projects.inspector.freelance.unavailable");
  return new Intl.DateTimeFormat(isArabic ? "ar-SA" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function systemInspectorIsRecentlyActive(value: string | null | undefined): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() <= 15 * 60 * 1000;
}

function systemInspectorSearchText(inspector: ProjectInspectorOption): string {
  return [
    inspector.displayName,
    inspector.username,
    inspector.email,
    inspector.phone,
    inspector.city,
    inspector.region,
    ...(inspector.serviceCities ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
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
  const { t } = useMvI18n();
  const normalized = normalizeInspectorSelection(value, inspectors);
  const allSelected = inspectors.length > 0 && normalized.length === inspectors.length;
  const fallbackName = t("projects.inspector.fallbackName");

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
              {loading ? t("projects.inspector.loading") : inspectorSelectionSummary(normalized, inspectors, t)}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[980] w-72 text-right">
        <DropdownMenuLabel className="px-2 py-1.5 text-[12px] text-slate-500">{t("projects.inspector.label")}</DropdownMenuLabel>
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
            <span className="truncate">{t("projects.inspector.all")}</span>
          </DropdownMenuItem>
        ) : (
          <div className="px-2 py-2 text-[12px] font-semibold text-slate-400">
            {t("projects.inspector.noneWithRole")}
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
              <span className="truncate" dir="auto">{inspectorOptionLabel(inspector, fallbackName)}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SystemInspectorSearchDialog({
  open,
  onOpenChange,
  projectId,
  onSelect,
  isSelected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onSelect: (inspector: ProjectInspectorOption) => void;
  isSelected: (inspector: ProjectInspectorOption) => boolean;
}) {
  const { t, isArabic, dir } = useMvI18n();
  const numberFormatter = useMemo(() => createNumberFormatter(isArabic), [isArabic]);
  const fallbackName = t("projects.inspector.fallbackName");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [inspectors, setInspectors] = useState<ProjectInspectorOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/mv/projects/${projectId}/system-inspectors`, {
          credentials: "include",
        });
        if (!response.ok) throw new Error();
        const data = (await response.json().catch(() => null)) as {
          inspectors?: ProjectInspectorOption[];
        } | null;
        if (!cancelled) setInspectors(data?.inspectors ?? []);
      } catch {
        if (!cancelled) {
          setInspectors([]);
          setError(t("errors.inspectors.systemLoadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, t]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setCityFilter("all");
      setError(null);
    }
  }, [open]);

  const cityOptions = useMemo(() => {
    const names = inspectors
      .flatMap((inspector) => systemInspectorCoverageCities(inspector))
      .filter(Boolean);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, isArabic ? "ar" : "en"));
  }, [inspectors, isArabic]);

  const filteredInspectors = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inspectors.filter((inspector) => {
      const coverageCities = systemInspectorCoverageCities(inspector);
      const cityMatches = cityFilter === "all" || coverageCities.includes(cityFilter);
      const queryMatches = !q || systemInspectorSearchText(inspector).includes(q);
      return cityMatches && queryMatches;
    });
  }, [inspectors, query, cityFilter]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <MvDialogContent
        className="flex max-h-[86vh] max-w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden border-slate-200 p-0 shadow-2xl sm:max-w-5xl"
        dir={dir}
      >
        <DialogHeader className="shrink-0 border-b border-slate-100 bg-white px-4 py-3 pe-14 text-start">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
              <UserPlus className="h-4 w-4" />
            </span>
            <DialogTitle className="truncate text-[15px] font-bold text-slate-900">
              {t("projects.inspector.freelance.title")}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="grid shrink-0 gap-2 border-b border-slate-100 bg-slate-50 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_180px]">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("projects.inspector.freelance.searchPlaceholder")}
              className="h-10 rounded-lg border-slate-200 bg-white pr-9 text-right text-[12px] font-semibold"
            />
          </div>
          <Select
            value={cityFilter}
            onValueChange={setCityFilter}
            disabled={cityOptions.length === 0}
          >
            <SelectTrigger className="h-10 rounded-lg border-slate-200 bg-white text-[12px] font-bold">
              <SelectValue placeholder={t("projects.inspector.freelance.allCities")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("projects.inspector.freelance.allCities")}</SelectItem>
              {cityOptions.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-white">
          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : error ? (
            <div className="px-4 py-8 text-center text-[13px] font-semibold text-red-600">{error}</div>
          ) : filteredInspectors.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] font-semibold text-slate-400">
              {t("projects.inspector.freelance.noResults")}
            </div>
          ) : (
            <table className="min-w-[900px] w-full text-right text-[12px]">
              <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] font-black text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-3 py-2 text-right">{t("projects.inspector.freelance.colName")}</th>
                  <th className="px-3 py-2 text-right">{t("projects.inspector.freelance.colPhone")}</th>
                  <th className="px-3 py-2 text-right">{t("projects.inspector.freelance.colCities")}</th>
                  <th className="px-3 py-2 text-center">{t("projects.inspector.freelance.colTasks")}</th>
                  <th className="px-3 py-2 text-center">{t("projects.inspector.freelance.colInProgress")}</th>
                  <th className="px-3 py-2 text-center">{t("projects.inspector.freelance.colRating")}</th>
                  <th className="px-3 py-2 text-right">{t("projects.inspector.freelance.colStatus")}</th>
                  <th className="px-3 py-2 text-center">{t("projects.inspector.freelance.colSelect")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInspectors.map((inspector) => {
                  const selected = isSelected(inspector);
                  const active = systemInspectorIsRecentlyActive(inspector.lastLoginAt);
                  return (
                    <tr key={inspector.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2">
                        <p className="max-w-[220px] truncate text-[12px] font-black text-slate-900" dir="auto">
                          {inspectorOptionLabel(inspector, fallbackName)}
                        </p>
                        <p className="mt-0.5 max-w-[220px] truncate text-[11px] font-semibold text-slate-500" dir="auto">
                          {inspector.username}
                        </p>
                      </td>
                      <td className="px-3 py-2 font-bold tabular-nums text-sky-700" dir="ltr">
                        {inspector.phone || inspector.username || "-"}
                      </td>
                      <td className="px-3 py-2">
                        <p className="max-w-[240px] whitespace-normal break-words text-[11px] font-bold leading-5 text-slate-600" dir="auto">
                          {systemInspectorLocationLabel(inspector, isArabic, t)}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-slate-400">-</td>
                      <td className="px-3 py-2 text-center font-bold text-slate-400">-</td>
                      <td className="px-3 py-2 text-center font-bold text-slate-400">-</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-black",
                              active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                active ? "bg-emerald-500" : "bg-slate-400",
                              )}
                            />
                            {active ? t("projects.inspector.freelance.active") : t("projects.inspector.freelance.inactive")}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {systemInspectorLastLoginLabel(inspector.lastLoginAt, isArabic, t)}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 rounded-lg bg-[#2f70b7] px-4 text-[11px] font-black text-white hover:bg-[#245d9d] disabled:bg-slate-200 disabled:text-slate-500"
                          disabled={selected}
                          onClick={() => onSelect(inspector)}
                        >
                          {selected ? t("projects.inspector.freelance.added") : t("projects.inspector.freelance.colSelect")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11px] font-bold text-slate-500">
          {t("projects.inspector.freelance.count", { count: numberFormatter.format(filteredInspectors.length) })}
        </div>
      </MvDialogContent>
    </Dialog>
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
  const { t } = useMvI18n();
  const { toast } = useToast();
  const fallbackName = t("projects.inspector.fallbackName");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inspectors, setInspectors] = useState<ProjectInspectorOption[]>([]);
  const [draftAssignments, setDraftAssignments] = useState<MvInspectionAssignment[]>([]);
  const [selectedInspectorIds, setSelectedInspectorIds] = useState<string[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([MV_ALL_LOCATIONS_VALUE]);
  const [projectSnapshot, setProjectSnapshot] = useState<MvProject | null>(project);
  const [systemInspectorSearchOpen, setSystemInspectorSearchOpen] = useState(false);
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
          toast({ variant: "destructive", description: t("errors.inspectors.loadFailed") });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, projectId, onSaved, toast, t]);

  const locations = projectSnapshot?.locations ?? [];
  const selectedInspectors = inspectors.filter((item) => selectedInspectorIds.includes(item.id));
  const currentAssignmentLocationIds = useMemo(
    () => normalizeAssignmentLocationIds(selectedLocationIds),
    [selectedLocationIds],
  );
  const draftAssignmentKeys = useMemo(
    () =>
      new Set(
        draftAssignments.map((assignment) =>
          inspectionAssignmentKey(assignment.inspectorUserId, assignment.locationIds ?? []),
        ),
      ),
    [draftAssignments],
  );

  const addInspectorsToDraft = (nextInspectors: ProjectInspectorOption[]) => {
    if (nextInspectors.length === 0) return;
    const locationIds = currentAssignmentLocationIds;
    const addedKeys = new Set(
      nextInspectors.map((inspector) => inspectionAssignmentKey(inspector.id, locationIds)),
    );
    const now = new Date().toISOString();
    setDraftAssignments((prev) => [
      ...prev.filter((assignment) => {
        const existingKey = inspectionAssignmentKey(assignment.inspectorUserId, assignment.locationIds ?? []);
        return !addedKeys.has(existingKey);
      }),
      ...nextInspectors.map((inspector, index) => ({
        id: `${inspector.id}-${locationIds.join("-") || "all"}-${Date.now()}-${index}`,
        inspectorUserId: inspector.id,
        inspectorName: inspectorOptionLabel(inspector, fallbackName),
        ...(locationIds.length > 0 ? { locationIds } : {}),
        createdAt: now,
        updatedAt: now,
      })),
    ]);
  };

  const addAssignment = () => {
    addInspectorsToDraft(selectedInspectors);
  };

  const selectSystemInspector = (inspector: ProjectInspectorOption) => {
    addInspectorsToDraft([inspector]);
    setSystemInspectorSearchOpen(false);
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
      toast({ description: t("projects.inspector.save") });
    } catch {
      toast({ variant: "destructive", description: t("errors.inspectors.saveFailed") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
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
              label={t("projects.inspector.scopeLabel")}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-lg border-slate-200 bg-white px-4 text-[12px] font-bold text-slate-700 shadow-none hover:bg-slate-50"
            onClick={() => setSystemInspectorSearchOpen(true)}
            disabled={loading || !projectSnapshot?._id}
          >
            <Search className="h-3.5 w-3.5" />
            {t("projects.inspector.search")}
          </Button>
          <Button
            type="button"
            className="h-10 rounded-lg bg-slate-950 px-4 text-[12px] font-bold text-white hover:bg-slate-800"
            onClick={addAssignment}
            disabled={selectedInspectors.length === 0 || loading}
          >
            {t("projects.inspector.add")}
          </Button>
        </div>

        <div className="mt-3 space-y-2">
          {draftAssignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 text-center text-[13px] font-semibold text-slate-400">
              {t("projects.inspector.noAssignments")}
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
                      t,
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
                  {t("projects.inspector.delete")}
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-slate-50/80 px-3 py-2">
        <Button
          type="button"
          className="h-10 min-w-[120px] rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800"
          onClick={() => void saveAssignments()}
          disabled={saving}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("projects.inspector.save")}
        </Button>
      </div>
    </div>
    <SystemInspectorSearchDialog
      open={systemInspectorSearchOpen}
      onOpenChange={setSystemInspectorSearchOpen}
      projectId={projectSnapshot?._id}
      onSelect={selectSystemInspector}
      isSelected={(inspector) =>
        draftAssignmentKeys.has(inspectionAssignmentKey(inspector.id, currentAssignmentLocationIds))
      }
    />
    </>
  );
}

const MV_PROJECTS_SESSION_CACHE_KEY = "mv:projects:list:v2";
const MV_PROJECTS_SESSION_CACHE_TTL_MS = 5 * 60_000;

function readMvProjectsSessionCache(): MvProject[] | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(MV_PROJECTS_SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; rows?: MvProject[] };
    if (!parsed?.at || Date.now() - parsed.at > MV_PROJECTS_SESSION_CACHE_TTL_MS) return null;
    return Array.isArray(parsed.rows) ? parsed.rows : null;
  } catch {
    return null;
  }
}

function writeMvProjectsSessionCache(rows: MvProject[]) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(
      MV_PROJECTS_SESSION_CACHE_KEY,
      JSON.stringify({ at: Date.now(), rows }),
    );
  } catch {
    /* quota */
  }
}

function clearMvProjectsSessionCache() {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(MV_PROJECTS_SESSION_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export default function MvProjectsDashboard() {
  const { t, isArabic, dir } = useMvI18n();
  const numberFormatter = useMemo(() => createNumberFormatter(isArabic), [isArabic]);
  const notAvailable = t("common.notAvailable");
  const percentSuffix = isArabic ? "٪" : "%";
  const { navigate } = useMvInPageNavigation();
  const { toast } = useToast();
  const { user, csrfToken, loading: authLoading } = useAuthTracking();
  const duplicateBusy = useMvBusyPercent();
  const [projects, setProjects] = useState<MvProject[]>(() => readMvProjectsSessionCache() ?? []);
  const [loading, setLoading] = useState(() => readMvProjectsSessionCache() == null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshingList, setRefreshingList] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [companyOptions, setCompanyOptions] = useState<CompanyOptionRow[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [projectQuery, setProjectQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>("all");
  const [sortRecentlyWorked, setSortRecentlyWorked] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [contactDataOpen, setContactDataOpen] = useState(false);
  const [contactDataProject, setContactDataProject] = useState<MvProject | null>(null);
  const [contactDataForm, setContactDataForm] = useState<MvProjectInspectionSiteForm[]>([
    createProjectInspectionSiteForm(0),
  ]);
  const [contactDialogTab, setContactDialogTab] = useState<ContactDialogTab>("locations");
  const [inspectorFilesOpen, setInspectorFilesOpen] = useState(false);
  const [inspectorFilesProject, setInspectorFilesProject] = useState<MvProject | null>(null);
  const [inspectorFilesSiteId, setInspectorFilesSiteId] = useState<string | null>(null);
  const [openingInspectorFilesSiteId, setOpeningInspectorFilesSiteId] = useState<string | null>(null);
  const [savingContactData, setSavingContactData] = useState(false);
  /** لتصيير قوائم المنطقة/المدينة داخل طبقة الحوار وليس خلف الغلافة التي تعطل النقرات */
  const [inspectionPickersPortalHost, setInspectionPickersPortalHost] = useState<HTMLElement | null>(null);
  const bindInspectionPickersPortalHost = useCallback((node: HTMLElement | null) => {
    setInspectionPickersPortalHost((prev) => (prev === node ? prev : node));
  }, []);
  const [createdFlowProject, setCreatedFlowProject] = useState<MvProject | null>(null);
  const [assetFoldersOpen, setAssetFoldersOpen] = useState(false);
  const [assetFoldersProject, setAssetFoldersProject] = useState<MvProject | null>(null);
  const [downloadingFinalReportId, setDownloadingFinalReportId] = useState<string | null>(null);
  const [duplicatingProjectId, setDuplicatingProjectId] = useState<string | null>(null);
  const [workflowStatusOptions, setWorkflowStatusOptions] = useState<MvProjectWorkflowStatusOption[]>(
    getWorkflowStatusOptions(),
  );
  const [workflowStatusSavingId, setWorkflowStatusSavingId] = useState<string | null>(null);
  const inspectorFilesLocationOptions = useMemo(() => {
    if (!inspectorFilesProject || !inspectorFilesSiteId) return inspectorFilesProject?.locations ?? [];
    const target = (inspectorFilesProject.locations ?? []).find(
      (location, index) => mvLocationId(location, index) === inspectorFilesSiteId,
    );
    return target ? [{ ...target, id: target.id || inspectorFilesSiteId }] : [];
  }, [inspectorFilesProject, inspectorFilesSiteId]);
  const inspectorFilesInitialLocationIds = useMemo(
    () => (inspectorFilesSiteId ? [inspectorFilesSiteId] : [MV_ALL_LOCATIONS_VALUE]),
    [inspectorFilesSiteId],
  );

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

  const fetchProjects = useCallback(async (options?: { forceRefresh?: boolean }) => {
    const forceRefresh = options?.forceRefresh === true;
    const cachedRows = readMvProjectsSessionCache();
    const hasStaleList = projects.length > 0 || (cachedRows?.length ?? 0) > 0;

    try {
      if (!hasStaleList) {
        setLoading(true);
      } else {
        setRefreshingList(true);
      }
      setLoadError(null);
      const rows = await mvFetchJson<MvProject[]>(
        "/api/mv/projects",
        {},
        {
          cacheKey: "projects:list",
          cacheTtlMs: 60_000,
          forceRefresh,
          trackLoading: false,
          timeoutMs: 45_000,
          retries: 2,
        },
      );
      const list = Array.isArray(rows) ? rows : [];
      setProjects(list);
      writeMvProjectsSessionCache(list);
    } catch (error) {
      if (error instanceof MvApiError && error.status === 401) {
        setProjects([]);
        clearMvProjectsSessionCache();
        toast({
          variant: "destructive",
          description: t("errors.projects.authRequired"),
        });
        return;
      }
      if (error instanceof MvApiError && error.status === 403) {
        if (!hasStaleList) setProjects([]);
        return;
      }
      const message = mvErrorMessage(error, t("errors.projects.loadList"));
      if (!hasStaleList) {
        setProjects([]);
        setLoadError(message);
      }
    } finally {
      setLoading(false);
      setRefreshingList(false);
    }
  }, [projects.length, toast, t]);

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

  useEffect(() => {
    prefetchMvLocationCatalog();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await mvFetchJson<MvProjectWorkflowStatusOption[]>(
          "/api/mv/project-workflow-statuses",
          {},
          { cacheKey: "project-workflow-statuses", cacheTtlMs: 60_000 },
        );
        if (cancelled) return;
        if (!cancelled && Array.isArray(rows) && rows.length > 0) {
          setWorkflowStatusOptions(rows);
        }
      } catch {
        /* keep fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (contactDataOpen) prefetchMvLocationCatalog();
  }, [contactDataOpen]);

  const metrics = useMemo(() => {
    const withAssets = visibleProjects.filter((project) => projectAssetFolderCount(project) > 0).length;
    const withSubfolders = visibleProjects.filter((project) => (project.subProjectCount ?? 0) > 0).length;
    const approved = visibleProjects.filter(
      (project) => normalizeWorkflowStatus(project.workflowStatus) === "approved",
    ).length;

    return [
      {
        hint: t("projects.metrics.total"),
        value: numberFormatter.format(visibleProjects.length),
        icon: <LayoutGrid />,
      },
      {
        hint: t("projects.metrics.withAssets"),
        value: numberFormatter.format(withAssets),
        icon: <FileSpreadsheet />,
      },
      {
        hint: t("projects.metrics.subprojects"),
        value: numberFormatter.format(withSubfolders),
        icon: <FolderSymlink />,
      },
      {
        hint: t("projects.metrics.approved"),
        value: numberFormatter.format(approved),
        icon: <Workflow />,
      },
    ];
  }, [visibleProjects, t, numberFormatter]);

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

    return [...next].sort((a, b) => {
      const delta = sortRecentlyWorked
        ? projectRecentTimestamp(b) - projectRecentTimestamp(a)
        : projectCreatedTimestamp(b) - projectCreatedTimestamp(a);
      if (delta !== 0) return delta;
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
          toast({ variant: "destructive", description: t("errors.projects.selectCompany") });
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
      toast({ description: t("projects.toast.created") });
      invalidateMvApiCache("projects:");
      setProjects((prev) => {
        const next = [created, ...prev.filter((project) => project._id !== created._id)];
        writeMvProjectsSessionCache(next);
        return next;
      });
      setCreateOpen(false);
      setCreatedFlowProject(created);
      setContactDataProject(created);
      setContactDataForm([createProjectInspectionSiteForm(0)]);
      setContactDataOpen(true);
    } catch {
      toast({ variant: "destructive", description: t("errors.projects.createFailed") });
    } finally {
      setCreating(false);
    }
  };

  const mergeProjectIntoList = useCallback((updated: MvProject) => {
    setProjects((prev) => {
      const next = prev.map((project) =>
        project._id === updated._id ? { ...project, ...updated } : project,
      );
      writeMvProjectsSessionCache(next);
      return next;
    });
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
      closeDialog = false,
      continueCreatedFlow = false,
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
      if (showToast) toast({ description: t("projects.toast.locationsUpdated") });
      return updatedProject;
    } catch {
      if (showToast) toast({ variant: "destructive", description: t("errors.locations.updateFailed") });
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
        toast({ variant: "destructive", description: t("errors.locations.saveFirst") });
        return;
      }

      const hasSavedLocation = (updatedProject.locations ?? []).some(
        (location, index) => mvLocationId(location, index) === site.id,
      );
      if (!hasSavedLocation) {
        toast({
          variant: "destructive",
          description: t("errors.locations.addDataFirst"),
        });
        return;
      }

      setContactDataProject(updatedProject);
      setInspectorFilesProject(updatedProject);
      setInspectorFilesSiteId(site.id);
      setInspectorFilesOpen(true);
    } finally {
      setOpeningInspectorFilesSiteId(null);
    }
  };

  const handleContactBackToCreate = () => {
    setContactDataOpen(false);
    setContactDialogTab("locations");
    setCreateOpen(true);
  };

  const handleSaveContactAndClose = async () => {
    const updatedProject = await handleSaveContactData({ closeDialog: true, continueCreatedFlow: false });
    if (!updatedProject) return;
    setCreatedFlowProject((current) => (current?._id === updatedProject._id ? null : current));
    setContactDataProject(null);
  };

  const handleSaveContactAndContinue = async () => {
    const updatedProject = await handleSaveContactData({ closeDialog: false, continueCreatedFlow: false });
    if (!updatedProject) return;
    setContactDataOpen(false);
    setContactDialogTab("locations");
    if (createdFlowProject?._id === updatedProject._id) {
      setCreatedFlowProject(updatedProject);
      setAssetFoldersProject(updatedProject);
      setAssetFoldersOpen(true);
      return;
    }
    setContactDataProject(null);
    navigate(`/machine-valuation/${updatedProject._id}/workflow/report-data`);
  };

  const finishAssetFoldersAndContinue = () => {
    const projectId = createdFlowProject?._id ?? assetFoldersProject?._id;
    setAssetFoldersOpen(false);
    setAssetFoldersProject(null);
    setCreatedFlowProject(null);
    setContactDataProject(null);
    if (projectId) {
      navigate(`/machine-valuation/${projectId}/workflow/report-data`);
    }
  };

  const startBackgroundFinalReportDownload = useCallback(
    async (project: MvProject) => {
      if (downloadingFinalReportId) return;
      const projectId = project._id;
      const projectName = (project.name || t("projects.table.project")).trim();
      setDownloadingFinalReportId(projectId);
      toast({
        description: t("projects.wordExport.preparing", { name: projectName }),
      });
      try {
        const { mergeWordReportTemplateViaServer } = await import(
          "@/lib/mv-word-template/server-merge"
        );
        const { prepareMvWordMergeInput } = await import("@/lib/mv-word-template/prepare-merge");
        const mergeInput = await prepareMvWordMergeInput({
          projectName,
          displayNumber: project.displayNumber,
          reportData: project.reportData ?? {},
          assetImageSources: [],
          valuationImageSources: [],
          clientImageSources: [],
          loadImages: false,
        });
        // بدون قوائم صور → الخادم يحمّل الأصول/الحسابات/ملفات العميل من قاعدة البيانات
        const result = await mergeWordReportTemplateViaServer({
          projectId,
          mergeInput,
          assetImageUrls: [],
          valuationImageUrls: [],
          alsoPdf: false,
          useStoredProjectState: true,
        });
        const safeName = projectName.replace(/[\\/:*?"<>|]+/g, "-") || "report";
        downloadMergedReportFiles({
          docxBlob: result.blob,
          baseName: safeName,
        });
        const warningDetail = result.mergeStats.warnings.join(" ");
        toast({
          description: warningDetail
            ? `${t("projects.wordExport.doneWordOnly")} ${warningDetail}`
            : t("projects.wordExport.doneWordOnly"),
        });
      } catch (error) {
        toast({
          variant: "destructive",
          description:
            error instanceof Error && error.message.trim()
              ? error.message
              : t("errors.projects.wordDownloadFailed"),
        });
      } finally {
        setDownloadingFinalReportId((current) => (current === projectId ? null : current));
      }
    },
    [downloadingFinalReportId, toast, t],
  );

  const handleWorkflowStatusChange = useCallback(
    async (projectId: string, nextStatus: MvProjectWorkflowStatus) => {
      if (workflowStatusSavingId) return false;
      setWorkflowStatusSavingId(projectId);
      try {
        const response = await fetch(`/api/mv/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ workflowStatus: nextStatus }),
        });
        if (!response.ok) throw new Error();
        const raw = (await response.json().catch(() => null)) as { project?: MvProject } | null;
        const updatedProject = raw?.project;
        setProjects((prev) =>
          prev.map((project) =>
            project._id === projectId
              ? {
                  ...project,
                  ...(updatedProject ?? {}),
                  workflowStatus: updatedProject?.workflowStatus ?? nextStatus,
                  updatedAt: updatedProject?.updatedAt ?? new Date().toISOString(),
                }
              : project,
          ),
        );
        toast({ description: t("status.workflow.updated") });
        return true;
      } catch {
        toast({ variant: "destructive", description: t("status.workflow.updateFailed") });
        return false;
      } finally {
        setWorkflowStatusSavingId(null);
      }
    },
    [toast, workflowStatusSavingId, t],
  );

  const handleDeleteProject = async (projectId: string) => {
    const target = visibleProjects.find((p) => p._id === projectId);
    if (!window.confirm(t("projects.deleteConfirm", { name: target?.name || projectId }))) return;
    try {
      const response = await fetch(`/api/mv/projects/${projectId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error();
      invalidateMvApiCache("projects:");
      setProjects((prev) => {
        const next = prev.filter((p) => p._id !== projectId);
        writeMvProjectsSessionCache(next);
        return next;
      });
      toast({ description: t("projects.toast.deleted") });
    } catch {
      toast({ variant: "destructive", description: t("errors.projects.deleteFailed") });
    }
  };

  const handleDuplicateProject = async (project: MvProject) => {
    if (duplicatingProjectId) return;
    setDuplicatingProjectId(project._id);
    duplicateBusy.start();
    try {
      const created = await duplicateMvProject({
        sourceProjectId: project._id,
        isArabic,
        companyId:
          user?.role === "super_admin"
            ? project.companyId ?? selectedCompanyId ?? null
            : null,
      });
      if (!created?._id) throw new Error();
      invalidateMvApiCache("projects:");
      setProjects((prev) => {
        const next = [created, ...prev.filter((row) => row._id !== created._id)];
        writeMvProjectsSessionCache(next);
        return next;
      });
      await duplicateBusy.finish();
      toast({ description: t("projects.toast.duplicated") });
    } catch (error) {
      duplicateBusy.fail();
      toast({
        variant: "destructive",
        description: mvErrorMessage(error, t("projects.toast.duplicateFailed")),
      });
    } finally {
      setDuplicatingProjectId(null);
    }
  };

  const resetFilters = () => {
    setProjectQuery("");
    setStatusFilter("all");
    setSortRecentlyWorked(false);
  };

  const hasActiveFilters =
    projectQuery.trim().length > 0 || statusFilter !== "all" || sortRecentlyWorked;

  return (
    <div className={cn(tajawal.className, "min-h-full text-slate-950")} dir={dir}>
      <MvTopBar
        breadcrumbs={[{ label: t("navigation.projects") }]}
        sticky
        className="top-0 z-30 border-slate-200/70 bg-white/80 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/70"
      />

      <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 px-3 py-4 sm:px-5 lg:px-6">
        <section className="overflow-hidden rounded-lg border border-slate-950/10 bg-slate-950 px-4 py-3 text-white shadow-2xl shadow-slate-950/15 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="min-w-0 flex-1">
              <ProjectMetricGrid items={metrics} />
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={!canCreateMvProject}
              title={
                needsCompanyMembership
                  ? t("projects.createBlockedTitle")
                  : t("projects.createNew")
              }
              aria-label={t("projects.createNew")}
              className="h-11 shrink-0 gap-2 self-start rounded-lg bg-white px-4 text-[13px] font-black text-slate-950 shadow-lg shadow-slate-950/20 hover:bg-cyan-50 disabled:opacity-45 sm:self-center"
            >
              <Plus className="h-4 w-4" aria-hidden />
              <span>{t("projects.createNew")}</span>
            </Button>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-slate-200/80 bg-white/95 shadow-xl shadow-slate-950/[0.04] backdrop-blur">
          <div className="flex flex-col gap-3 border-b border-slate-200/80 bg-white/90 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-[minmax(240px,1fr)_190px] lg:max-w-3xl">
              <div className="relative min-w-0">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={projectQuery}
                  onChange={(event) => setProjectQuery(event.target.value)}
                  placeholder={t("projects.searchPlaceholder")}
                  className="h-11 rounded-lg border-slate-200 bg-white pr-9 text-[13px] font-semibold shadow-none focus-visible:border-cyan-300 focus-visible:ring-cyan-200"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as ProjectStatusFilter)}
              >
                <SelectTrigger
                  aria-label={t("projects.status.filterAria")}
                  className="h-11 justify-start gap-2 rounded-lg border-slate-200 bg-white text-[12px] font-bold text-slate-700 shadow-none focus:ring-cyan-200 [&>svg:last-child]:mr-auto"
                >
                  <span className="shrink-0 text-[11px] font-black text-slate-400">{t("projects.status.label")}</span>
                  <SelectValue placeholder={t("projects.status.all")} />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">{t("projects.status.all")}</SelectItem>
                  {workflowStatusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {workflowStatusLabel(status, isArabic)}
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
                  "h-10 shrink-0 gap-1.5 rounded-lg px-3 text-[11px] font-black shadow-none",
                  sortRecentlyWorked
                    ? "border-cyan-200 bg-cyan-50 text-cyan-800 hover:bg-cyan-100 hover:text-cyan-900"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
                title={t("projects.sort.recentlyWorkedTitle")}
                aria-pressed={sortRecentlyWorked}
              >
                <ArrowDownWideNarrow className="h-3.5 w-3.5" aria-hidden />
                <span>{t("projects.sort.recentlyWorked")}</span>
              </Button>
              <span className="whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-bold tabular-nums text-slate-600">
                {numberFormatter.format(filteredProjects.length)} / {numberFormatter.format(visibleProjects.length)}
              </span>
              {refreshingList ? (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  {t("projects.refreshingList")}
                </span>
              ) : null}
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  onClick={resetFilters}
                  title={t("projects.filters.clear")}
                  aria-label={t("projects.filters.clear")}
                >
                  <FilterX className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>

          {loading || (authLoading && projects.length === 0) ? (
            <div className="divide-y divide-slate-100 bg-white">
              {Array.from({ length: 7 }).map((_, index) => (
                <div key={index} className="flex animate-pulse items-center gap-3 px-4 py-4">
                  <div className="h-8 w-8 shrink-0 rounded-lg bg-slate-200" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-[42%] max-w-sm rounded bg-slate-200" />
                    <div className="h-2 w-24 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : loadError ? (
            <MvErrorState
              compact
              title={t("errors.projects.loadTitle")}
              description={loadError}
              onRetry={() => void fetchProjects({ forceRefresh: true })}
            />
          ) : needsCompanyMembership ? (
            <div className="py-6">
              <MvEmptyState title={t("projects.empty.noCompany")} />
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="py-6">
              <MvEmptyState
                title={t("projects.empty.noProjects")}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCreateOpen(true)}
                    disabled={!canCreateMvProject}
                    className="rounded-lg border-slate-300 text-[12px]"
                  >
                    {t("projects.empty.create")}
                  </Button>
                }
              />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="py-6">
              <MvEmptyState
                title={t("projects.empty.noResults")}
                action={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    className="rounded-lg text-[12px]"
                  >
                    {t("projects.filters.clear")}
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto bg-white xl:block">
                <table className="w-full min-w-[960px] table-fixed border-collapse text-right">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-black text-slate-500">
                      <th className="w-[56px] px-2 py-3 text-center" title={t("projects.table.serialTitle")}>{t("projects.table.serial")}</th>
                      <th className="w-[28%] px-3 py-3">{t("projects.table.project")}</th>
                      <th className="w-[100px] px-2 py-3">{t("projects.table.status")}</th>
                      <th className="w-[120px] px-2 py-3">{t("projects.table.type")}</th>
                      <th className="w-[76px] px-2 py-3 text-center">{t("projects.table.assets")}</th>
                      <th className="w-[76px] px-2 py-3 text-center">{t("projects.table.subs")}</th>
                      <th className="w-[140px] px-2 py-3">{t("projects.table.progress")}</th>
                      <th className="w-[116px] px-2 py-3">{t("projects.table.lastUpdated")}</th>
                      <th className="w-[116px] px-2 py-3 text-center" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedProjects.map((project) => {
                      const workflowStatus = normalizeWorkflowStatus(project.workflowStatus);
                      const progress = projectProgressPctFromProject(project);
                      const reportType = project.reportType;
                      const reportLabel = reportTypeLabel(reportType, t, notAvailable);
                      const assetFolders = projectAssetFolderCount(project);
                      const subs = project.subProjectCount ?? 0;

                      const displayNumber =
                        typeof project.displayNumber === "number" && Number.isFinite(project.displayNumber)
                          ? project.displayNumber
                          : null;

                      return (
                        <tr key={project._id} className="bg-white text-right transition-colors hover:bg-cyan-50/40">
                          <td className="px-2 py-4 text-center align-middle">
                            <span className="inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-lg bg-cyan-50 px-2 text-[12px] font-black tabular-nums text-cyan-800 ring-1 ring-cyan-100">
                              {displayNumber == null ? notAvailable : numberFormatter.format(displayNumber)}
                            </span>
                          </td>
                          <td className="px-3 py-4 align-middle">
                            <ProjectWorkspaceLink
                              project={project}
                              title={project.name || notAvailable}
                              compact
                              nameClassName="text-[13px] font-black"
                            />
                          </td>

                          <td className="px-2 py-4 align-middle">
                            <MvProjectWorkflowStatusSelect
                              projectId={project._id}
                              value={workflowStatus}
                              options={workflowStatusOptions}
                              isArabic={isArabic}
                              disabled={Boolean(workflowStatusSavingId && workflowStatusSavingId !== project._id)}
                              onChange={handleWorkflowStatusChange}
                            />
                          </td>

                          <td className="px-2 py-4 align-middle text-[12px] font-semibold text-slate-600">
                            <span className="block truncate">{reportLabel}</span>
                          </td>

                          <td className="px-2 py-4 text-center align-middle">
                            <span className="font-bold tabular-nums text-slate-800">
                              {numberFormatter.format(assetFolders)}
                            </span>
                          </td>

                          <td className="px-2 py-4 text-center align-middle">
                            <span className="font-bold tabular-nums text-slate-800">
                              {numberFormatter.format(subs)}
                            </span>
                          </td>

                          <td className="px-2 py-4 align-middle">
                            <div className="flex items-center gap-2">
                              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-gradient-to-l from-cyan-500 to-emerald-500 transition-[width]"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="w-9 shrink-0 text-[10px] font-bold tabular-nums text-slate-500">
                                {numberFormatter.format(progress)}{percentSuffix}
                              </span>
                            </div>
                          </td>

                          <td className="px-2 py-4 align-middle text-[12px] font-semibold tabular-nums text-slate-500">
                            <span className="block truncate">{formatDateLabel(project.updatedAt, isArabic, notAvailable)}</span>
                          </td>

                          <td className="px-2 py-4 align-middle">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 rounded-lg border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 shadow-sm hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800"
                              >
                                <Link href={projectWorkspaceHref(project._id)}>
                                  {t("projects.table.open")}
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                </Link>
                              </Button>
                              <ProjectActionsMenu
                                project={project}
                                onOpenAssetFolders={openAssetFoldersModal}
                                onOpenLocations={openContactDataModal}
                                onDownloadFinalReport={(p) => void startBackgroundFinalReportDownload(p)}
                                downloadingFinalReport={downloadingFinalReportId === project._id}
                                onDuplicate={(p) => void handleDuplicateProject(p)}
                                duplicating={duplicatingProjectId === project._id}
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

              <div className="grid gap-3 bg-slate-50/70 p-3 sm:grid-cols-2 xl:hidden">
                {paginatedProjects.map((project) => {
                  const workflowStatus = normalizeWorkflowStatus(project.workflowStatus);
                  const progress = projectProgressPctFromProject(project);
                  const reportType = project.reportType;
                  const reportLabel =
                    reportType === "simple" || reportType === "advanced"
                      ? reportTypeLabel(reportType, t, notAvailable)
                      : null;
                  const mobileDisplayNumber =
                    typeof project.displayNumber === "number" && Number.isFinite(project.displayNumber)
                      ? project.displayNumber
                      : null;

                  return (
                    <article key={project._id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-cyan-200 hover:shadow-md">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-1.5">
                            <span className="inline-flex h-6 min-w-[1.9rem] items-center justify-center rounded-lg bg-cyan-50 px-1.5 text-[10px] font-black tabular-nums text-cyan-800 ring-1 ring-cyan-100">
                              #{mobileDisplayNumber == null ? notAvailable : numberFormatter.format(mobileDisplayNumber)}
                            </span>
                          </div>
                          <ProjectWorkspaceLink
                            project={project}
                            title={project.name || notAvailable}
                            compact
                            nameClassName="text-[13px] font-black"
                          />
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <MvProjectWorkflowStatusSelect
                              projectId={project._id}
                              value={workflowStatus}
                              options={workflowStatusOptions}
                              isArabic={isArabic}
                              disabled={Boolean(workflowStatusSavingId && workflowStatusSavingId !== project._id)}
                              onChange={handleWorkflowStatusChange}
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
                          onDownloadFinalReport={(p) => void startBackgroundFinalReportDownload(p)}
                          downloadingFinalReport={downloadingFinalReportId === project._id}
                          onDuplicate={(p) => void handleDuplicateProject(p)}
                          duplicating={duplicatingProjectId === project._id}
                          onDelete={(id) => void handleDeleteProject(id)}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-bold tabular-nums text-slate-600">
                        <span className="rounded-lg bg-slate-100 px-2 py-1.5 text-center">
                          {numberFormatter.format(projectAssetFolderCount(project))} {t("projects.table.assets")}
                        </span>
                        <span className="rounded-lg bg-slate-100 px-2 py-1.5 text-center">
                          {numberFormatter.format(project.subProjectCount ?? 0)} {t("projects.table.subs")}
                        </span>
                        <span className="rounded-lg bg-slate-100 px-2 py-1.5 text-center">
                          {numberFormatter.format(progress)}{percentSuffix}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                        <span className="text-[10px] font-bold tabular-nums text-slate-400">
                          {formatDateLabel(project.updatedAt, isArabic, notAvailable)}
                        </span>
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 rounded-lg border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-700 shadow-sm hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800"
                        >
                          <Link href={projectWorkspaceHref(project._id)}>
                            {t("projects.table.open")}
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
          setContactDataOpen(false);
          setContactDataProject(null);
          setContactDialogTab("locations");
        }}
      >
        <MvDialogContent
          className="flex max-h-[90vh] flex-col overflow-visible border-slate-200 p-0 shadow-2xl sm:max-w-4xl"
          dir={dir}
        >
          <DialogHeader className="shrink-0 border-b border-slate-100 bg-white px-4 py-3 pe-14 text-start">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <MapPinned className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate text-[15px] font-bold text-slate-900">{t("projects.dialog.locationsInspectors.title")}</DialogTitle>
              </div>
            </div>
          </DialogHeader>
          <div
            ref={bindInspectionPickersPortalHost}
            className="relative z-0 flex min-h-0 flex-1 flex-col overflow-visible"
          >
            <Tabs
              value={contactDialogTab}
              onValueChange={(value) => {
                const next: ContactDialogTab = value === "inspectors" ? "inspectors" : "locations";
                setContactDialogTab(next);
              }}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
            <div className="border-b border-slate-200 bg-white px-4">
              <TabsList
                dir={dir}
                className="grid h-12 w-full grid-cols-2 items-end rounded-none bg-transparent p-0 text-slate-500"
              >
                <TabsTrigger
                  value="locations"
                  dir={dir}
                  className="relative h-12 w-full rounded-none border-b-2 border-transparent bg-transparent px-2 pb-3 pt-2 text-center text-[12px] font-black text-slate-500 shadow-none transition hover:text-slate-800 data-[state=active]:border-slate-950 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
                >
                  {t("projects.dialog.locationsTab")}
                </TabsTrigger>
                <TabsTrigger
                  value="inspectors"
                  dir={dir}
                  className="relative h-12 w-full rounded-none border-b-2 border-transparent bg-transparent px-2 pb-3 pt-2 text-center text-[12px] font-black text-slate-500 shadow-none transition hover:text-slate-800 data-[state=active]:border-slate-950 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none"
                >
                  {t("projects.dialog.inspectorsTab")}
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="locations" className="m-0 min-h-0 flex-1 overflow-y-auto p-3 data-[state=inactive]:hidden">
              <MvInspectionLocationsFields
                value={contactDataForm}
                onChange={setContactDataForm}
                disabled={savingContactData}
                pickerPopoverHost={inspectionPickersPortalHost}
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
                  {t("projects.dialog.selectProjectFirst")}
                </div>
              )}
            </TabsContent>
            </Tabs>
          </div>
          <DialogFooter className="shrink-0 gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-2">
            {createdFlowProject ? (
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl border-slate-200 bg-white px-5"
                onClick={handleContactBackToCreate}
                disabled={savingContactData}
              >
                {t("projects.dialog.back")}
              </Button>
            ) : null}
            <div className="flex flex-1 flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl border-slate-200 bg-white px-5 text-[12px] font-bold"
                onClick={() => void handleSaveContactAndClose()}
                disabled={savingContactData}
              >
                {savingContactData ? <Loader2 className="h-4 w-4 animate-spin" /> : t("projects.dialog.saveClose")}
              </Button>
              <Button
                type="button"
                className="h-10 min-w-[170px] rounded-xl bg-slate-950 px-5 text-[12px] font-bold text-white hover:bg-slate-800"
                onClick={() => void handleSaveContactAndContinue()}
                disabled={savingContactData}
              >
                {savingContactData ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : createdFlowProject ? (
                  t("projects.dialog.saveContinueAssetFolders")
                ) : (
                  t("projects.dialog.saveOpenReportData")
                )}
              </Button>
            </div>
          </DialogFooter>
        </MvDialogContent>
      </Dialog>

      <Dialog
        open={inspectorFilesOpen}
        onOpenChange={(open) => {
          setInspectorFilesOpen(open);
          if (!open) {
            setInspectorFilesProject(null);
            setInspectorFilesSiteId(null);
          }
        }}
      >
        <MvDialogContent
          className="flex max-h-[90vh] flex-col overflow-hidden border-slate-200 p-0 shadow-2xl sm:max-w-5xl"
          dir={dir}
        >
          <DialogHeader className="shrink-0 border-b border-slate-100 bg-white px-4 py-3 pe-14 text-start">
            <DialogTitle className="text-[15px] font-black text-slate-950">{t("projects.dialog.attachFiles")}</DialogTitle>
          </DialogHeader>
          {inspectorFilesProject?._id ? (
            <MvInspectorFilesPanel
              key={`${inspectorFilesProject._id}:${inspectorFilesSiteId ?? "all"}`}
              projectId={inspectorFilesProject._id}
              initialProject={inspectorFilesProject}
              embedded
              initialLocationIds={inspectorFilesInitialLocationIds}
              locationOptions={inspectorFilesLocationOptions}
              locationSelectionLocked={Boolean(inspectorFilesSiteId)}
              className="h-[min(72vh,720px)]"
              onProjectLoaded={(project) => {
                mergeProjectIntoList(project);
                setInspectorFilesProject(project);
                setContactDataProject((current) => (current?._id === project._id ? project : current));
              }}
            />
          ) : (
            <div className="px-5 py-8 text-center text-[13px] font-semibold text-slate-400">
              {t("projects.dialog.selectProjectFirst")}
            </div>
          )}
        </MvDialogContent>
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
              <p className="text-sm font-medium text-slate-800">{t("projects.company.label")}</p>
              <Select
                value={selectedCompanyId || undefined}
                onValueChange={setSelectedCompanyId}
                disabled={companyOptions.length === 0}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue
                    placeholder={
                      companyOptions.length === 0 ? t("projects.company.loading") : t("projects.company.select")
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
          if (!open) {
            setAssetFoldersProject(null);
            setCreatedFlowProject(null);
          }
        }}
        projectId={createdFlowProject?._id ?? assetFoldersProject?._id ?? null}
        onGenerated={async () => {
          await fetchProjects();
        }}
        onBack={() => {
          const project = createdFlowProject ?? assetFoldersProject;
          setAssetFoldersOpen(false);
          setAssetFoldersProject(null);
          if (!project) return;
          setContactDataProject(project);
          setContactDataForm(projectInspectionSitesFromData(project.locations, project.contacts));
          setContactDialogTab("locations");
          setContactDataOpen(true);
        }}
        onSaveAndClose={() => {
          setAssetFoldersOpen(false);
          setAssetFoldersProject(null);
          setCreatedFlowProject(null);
          setContactDataProject(null);
        }}
        onSaveAndContinue={finishAssetFoldersAndContinue}
      />

      <MvBusyPercentOverlay
        open={duplicateBusy.open}
        percent={duplicateBusy.percent}
        label={t("projects.toast.duplicating")}
        dir={dir}
      />
    </div>
  );
}
