"use client";

import { Tajawal } from "next/font/google";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
  Files,
  FilterX,
  FolderOpen,
  FolderPlus,
  FolderSymlink,
  Images,
  LayoutGrid,
  Loader2,
  MapPinned,
  MoreHorizontal,
  Phone,
  Scale,
  Search,
  Trash2,
  Upload,
  Workflow,
} from "lucide-react";
import Link from "@/components/prefetch-link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { toApiUrl } from "@/lib/api-url";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import type {
  MvProject,
  MvProjectContact,
  MvProjectLocation,
  MvProjectReportType,
  MvProjectWorkflowStatus,
} from "./types";
import CreateDialog from "./create-dialog";
import {
  EMPTY_PROJECT_CONTACT_FORM,
  projectContactDataFromForm,
  projectContactFormFromData,
  type MvProjectContactForm,
} from "./mv-project-contact-data";
import { MvProjectContactFields } from "./mv-project-contact-fields";
import { MvEmptyState, MvStatusBadge, MvTopBar } from "./mv-ui";
import { useMvInPageNavigation } from "./mv-inpage-navigation";

type ProjectStatusFilter = "all" | MvProjectWorkflowStatus;
type PaginationToken = number | "ellipsis-start" | "ellipsis-end";

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

function parseDateBoundary(value: string, boundary: "start" | "end") {
  if (!value) return null;
  const date = new Date(`${value}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}`);
  if (Number.isNaN(date.getTime())) return null;
  return date.getTime();
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
  onNavigate,
  onEditContactData,
  onDelete,
}: {
  project: MvProject;
  onNavigate: (href: string) => void;
  onEditContactData: (project: MvProject) => void;
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
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-[13px]"
          onSelect={() => onNavigate(`/machine-valuation/${project._id}/workflow/import`)}
        >
          <Upload className="h-4 w-4 shrink-0 text-[#378ADD]" />
          إضافة بيانات الأصول
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-[13px]"
          onSelect={() => onNavigate(`/machine-valuation/${project._id}/workflow/asset-images`)}
        >
          <Images className="h-4 w-4 shrink-0 text-emerald-600" />
          تحديد صور الأصول
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-[13px]"
          onSelect={() => onNavigate(`/machine-valuation/${project._id}/workflow/valuation`)}
        >
          <Scale className="h-4 w-4 shrink-0 text-amber-600" />
          التقييم (اختيار المسار)
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-[13px]"
          onSelect={() => onNavigate(`/machine-valuation/${project._id}/workflow/report`)}
        >
          <FileDown className="h-4 w-4 shrink-0 text-violet-700" />
          إنشاء التقرير النهائي
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-[13px]"
          onSelect={() => onNavigate(`/machine-valuation/${project._id}/inspector-files`)}
        >
          <Files className="h-4 w-4 shrink-0 text-sky-600" />
          ملفات المعاين
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer gap-2 text-[13px]"
          onSelect={() => onEditContactData(project)}
        >
          <Phone className="h-4 w-4 shrink-0 text-emerald-600" />
          بيانات للتواصل
        </DropdownMenuItem>
        <DropdownMenuSeparator />
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

function MetricStripRow({
  items,
}: {
  items: { hint: string; value: string; icon: React.ReactNode }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-px bg-slate-200/70 p-px sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.hint}
          title={item.hint}
          className="flex min-h-[2.75rem] items-center justify-center gap-2 bg-white/95 py-2 sm:min-h-0 sm:py-2.5"
        >
          <span className="text-slate-400 [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>
          <span className="text-lg font-bold tabular-nums leading-none text-slate-900 sm:text-xl">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

type CompanyOptionRow = { id: string; name: string };

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
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [contactDataOpen, setContactDataOpen] = useState(false);
  const [contactDataProject, setContactDataProject] = useState<MvProject | null>(null);
  const [contactDataForm, setContactDataForm] = useState<MvProjectContactForm>(EMPTY_PROJECT_CONTACT_FORM);
  const [savingContactData, setSavingContactData] = useState(false);

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
  }, [projectQuery, statusFilter, createdFrom, createdTo, pageSize]);

  const metrics = useMemo(() => {
    const withAssets = visibleProjects.filter((project) => (project.sheetCount ?? 0) > 0).length;
    const withSubfolders = visibleProjects.filter((project) => (project.subProjectCount ?? 0) > 0).length;
    const approved = visibleProjects.filter(
      (project) => normalizeWorkflowStatus(project.workflowStatus) === "approved",
    ).length;

    return [
      {
        hint: "إجمالي المشاريع",
        value: numberFormatter.format(visibleProjects.length),
        icon: <LayoutGrid className="h-4 w-4 text-cyan-600" />,
      },
      {
        hint: "مشاريع بها بيانات أصول",
        value: numberFormatter.format(withAssets),
        icon: <Upload className="h-4 w-4 text-cyan-600" />,
      },
      {
        hint: "مشاريع بها مجلدات فرعية",
        value: numberFormatter.format(withSubfolders),
        icon: <FolderSymlink className="h-4 w-4 text-cyan-600" />,
      },
      {
        hint: "المشاريع المعتمدة",
        value: numberFormatter.format(approved),
        icon: <Workflow className="h-4 w-4 text-cyan-600" />,
      },
    ];
  }, [visibleProjects]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = projectQuery.trim().toLocaleLowerCase();
    const fromBoundary = parseDateBoundary(createdFrom, "start");
    const toBoundary = parseDateBoundary(createdTo, "end");

    return visibleProjects.filter((project) => {
      if (normalizedQuery && !project.name.toLocaleLowerCase().includes(normalizedQuery)) {
        return false;
      }

      const workflowStatus = normalizeWorkflowStatus(project.workflowStatus);
      if (statusFilter !== "all" && workflowStatus !== statusFilter) {
        return false;
      }

      const createdAtTime = new Date(project.createdAt).getTime();
      if (Number.isNaN(createdAtTime)) return false;
      if (fromBoundary !== null && createdAtTime < fromBoundary) return false;
      if (toBoundary !== null && createdAtTime > toBoundary) return false;

      return true;
    });
  }, [createdFrom, createdTo, projectQuery, visibleProjects, statusFilter]);

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
      locations?: MvProjectLocation[];
      contacts?: MvProjectContact[];
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
        locations: options?.locations ?? [],
        contacts: options?.contacts ?? [],
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
      navigate(`/machine-valuation/${created._id}/workflow/report-data`);
    } catch {
      toast({ variant: "destructive", description: "تعذر إنشاء المشروع." });
    } finally {
      setCreating(false);
      setCreateOpen(false);
    }
  };

  const openContactDataModal = (project: MvProject) => {
    setContactDataProject(project);
    setContactDataForm(projectContactFormFromData(project.locations, project.contacts));
    setContactDataOpen(true);
  };

  const handleSaveContactData = async () => {
    if (!contactDataProject) return;
    const payload = projectContactDataFromForm(contactDataForm);
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
      setContactDataOpen(false);
      toast({ description: "تم تحديث بيانات التواصل." });
    } catch {
      toast({ variant: "destructive", description: "تعذر تحديث بيانات التواصل." });
    } finally {
      setSavingContactData(false);
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
    setCreatedFrom("");
    setCreatedTo("");
  };

  const hasActiveFilters =
    projectQuery.trim().length > 0 ||
    statusFilter !== "all" ||
    createdFrom.length > 0 ||
    createdTo.length > 0;

  return (
    <div className={cn(tajawal.className, "min-h-screen bg-[#050810]")} dir="rtl">
      <MvTopBar breadcrumbs={[{ label: "لوحة التحكم" }, { label: "المشاريع" }]} />

      <div className="mx-auto max-w-6xl px-2 pb-2 pt-1 sm:px-3">
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/25 shadow-[0_28px_100px_-24px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.05] backdrop-blur-md">
          <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-2.5 py-2 sm:px-3 sm:py-2.5">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_100%_0%,rgba(34,211,238,0.12),transparent_50%),radial-gradient(ellipse_100%_60%_at_0%_100%,rgba(139,92,246,0.08),transparent_45%)]"
              aria-hidden
            />
            <div className="relative flex min-w-0 flex-1 items-center gap-2">
              <h1 className="truncate bg-gradient-to-l from-white via-slate-100 to-slate-400 bg-clip-text text-base font-extrabold tracking-tight text-transparent sm:text-lg">
                مشاريع تقييم الآلات والمعدات
              </h1>
              {!loading && !authLoading && filteredProjects.length > 0 ? (
                <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-cyan-200/90">
                  {numberFormatter.format(filteredProjects.length)}
                </span>
              ) : null}
            </div>
            <div className="relative flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="relative h-8 gap-1 border-white/15 bg-white/5 px-2 text-[11px] text-white hover:bg-white/10 sm:h-8 sm:px-2.5"
                onClick={() => setFiltersOpen(true)}
              >
                <Search className="h-3.5 w-3.5 opacity-90" />
                <span className="hidden sm:inline">بحث</span>
                {hasActiveFilters ? (
                  <span className="absolute -left-0.5 -top-0.5 h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.85)]" />
                ) : null}
              </Button>
              <Button
                type="button"
                onClick={() => setCreateOpen(true)}
                disabled={!canCreateMvProject}
                title={
                  needsCompanyMembership
                    ? "يجب أن يكون حسابك مرتبطاً بشركة لإنشاء مشروع"
                    : undefined
                }
                className="h-8 gap-1 rounded-lg bg-gradient-to-l from-cyan-500 to-sky-600 px-2.5 text-[11px] font-bold text-white shadow-md shadow-cyan-500/25 hover:from-cyan-400 hover:to-sky-500 disabled:opacity-45 sm:px-3 sm:text-[12px]"
              >
                <FolderPlus className="h-3.5 w-3.5" />
                مشروع
              </Button>
            </div>
          </div>

          <div className="bg-slate-50">
            <MetricStripRow items={metrics} />

            {loading || authLoading ? (
              <div className="divide-y divide-slate-200/80">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div key={index} className="flex animate-pulse items-center gap-2.5 px-2 py-2 sm:px-3">
                    <div className="h-7 w-7 shrink-0 rounded-md bg-slate-200/90" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="h-3 w-[48%] max-w-xs rounded bg-slate-200/90" />
                      <div className="h-2 w-20 rounded bg-slate-200/70" />
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
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full min-w-[900px] table-fixed border-collapse text-right">
                    <thead>
                      <tr className="border-b border-slate-200/90 bg-white text-[10px] font-bold text-slate-500">
                        <th className="w-[28%] px-2 py-1.5">المشروع</th>
                        <th className="w-[92px] px-2 py-1.5">الحالة</th>
                        <th className="w-[108px] px-2 py-1.5">الإنشاء</th>
                        <th className="w-[56px] px-1 py-1.5 text-center">فرعية</th>
                        <th className="w-[56px] px-1 py-1.5 text-center">أصول</th>
                        <th className="w-[120px] px-2 py-1.5">التقدّم</th>
                        <th className="w-[108px] px-2 py-1.5">تحديث</th>
                        <th className="w-[44px] px-1 py-1.5 text-center" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {paginatedProjects.map((project) => {
                        const workflowStatus = normalizeWorkflowStatus(project.workflowStatus);
                        const progress = projectProgressPct(project);
                        const reportType = project.reportType;
                        const reportLabel =
                          reportType === "simple" || reportType === "advanced"
                            ? MV_REPORT_TYPE_LABEL_AR[reportType]
                            : null;
                        const sheets = project.sheetCount ?? 0;
                        const subs = project.subProjectCount ?? 0;

                        return (
                          <tr
                            key={project._id}
                            className="text-right transition-colors hover:bg-cyan-50/40"
                          >
                            <td className="px-2 py-1.5 align-middle">
                              <div className="flex min-w-0 flex-col gap-0.5">
                                <ProjectWorkspaceLink
                                  projectId={project._id}
                                  title={project.name || "—"}
                                  compact
                                />
                                {reportLabel ? (
                                  <span className="text-[10px] text-slate-400">{reportLabel}</span>
                                ) : null}
                              </div>
                            </td>

                            <td className="px-2 py-1.5 align-middle">
                              <MvStatusBadge
                                label={MV_WORKFLOW_LABEL_AR[workflowStatus]}
                                tone={getStatusTone(workflowStatus)}
                                className="whitespace-nowrap px-1.5 py-0.5 text-[10px]"
                              />
                            </td>

                            <td className="px-2 py-1.5 align-middle text-[11px] tabular-nums text-slate-600">
                              {formatDateLabel(project.createdAt)}
                            </td>

                            <td className="px-1 py-1.5 align-middle text-center">
                              <span className="tabular-nums text-[12px] font-semibold text-slate-800">
                                {numberFormatter.format(subs)}
                              </span>
                            </td>

                            <td className="px-1 py-1.5 align-middle text-center">
                              <span
                                className={cn(
                                  "tabular-nums text-[12px] font-semibold",
                                  sheets > 0 ? "text-slate-800" : "text-slate-300",
                                )}
                              >
                                {numberFormatter.format(sheets)}
                              </span>
                            </td>

                            <td className="px-2 py-1.5 align-middle">
                              <div className="flex items-center gap-2">
                                <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-l from-cyan-500 to-sky-500 transition-[width]"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-500">
                                  {numberFormatter.format(progress)}٪
                                </span>
                              </div>
                            </td>

                            <td className="px-2 py-1.5 align-middle text-[11px] tabular-nums text-slate-500">
                              {formatDateLabel(project.updatedAt)}
                            </td>

                            <td className="px-1 py-1.5 align-middle">
                              <div className="flex justify-center">
                                <ProjectActionsMenu
                                  project={project}
                                  onNavigate={(href) => navigate(href)}
                                  onEditContactData={openContactDataModal}
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

                <div className="space-y-1.5 p-2 sm:p-2.5 lg:hidden">
                  {paginatedProjects.map((project) => {
                    const workflowStatus = normalizeWorkflowStatus(project.workflowStatus);
                    const progress = projectProgressPct(project);
                    const reportType = project.reportType;
                    const reportLabel =
                      reportType === "simple" || reportType === "advanced"
                        ? MV_REPORT_TYPE_LABEL_AR[reportType]
                        : null;

                    return (
                      <article
                        key={project._id}
                        className="rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            <ProjectWorkspaceLink projectId={project._id} title={project.name || "—"} compact />
                            <div className="flex flex-wrap items-center gap-1.5">
                              <MvStatusBadge
                                label={MV_WORKFLOW_LABEL_AR[workflowStatus]}
                                tone={getStatusTone(workflowStatus)}
                                className="whitespace-nowrap px-1.5 py-0.5 text-[10px]"
                              />
                              {reportLabel ? (
                                <span className="text-[10px] text-slate-400">{reportLabel}</span>
                              ) : null}
                            </div>
                          </div>
                          <ProjectActionsMenu
                            project={project}
                            onNavigate={(href) => navigate(href)}
                            onEditContactData={openContactDataModal}
                            onDelete={(id) => void handleDeleteProject(id)}
                          />
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold tabular-nums text-slate-700">
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5">
                            <FolderSymlink className="h-3 w-3 text-slate-400" />
                            {numberFormatter.format(project.subProjectCount ?? 0)}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5",
                              (project.sheetCount ?? 0) > 0 ? "bg-cyan-50 text-cyan-900" : "bg-slate-100 text-slate-400",
                            )}
                          >
                            <FileSpreadsheet className="h-3 w-3 opacity-70" />
                            {numberFormatter.format(project.sheetCount ?? 0)}
                          </span>
                        </div>

                        <p className="mt-1.5 text-[10px] tabular-nums leading-relaxed text-slate-500">
                          {formatDateLabel(project.createdAt)} · {formatDateLabel(project.updatedAt)}
                        </p>

                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-gradient-to-l from-cyan-500 to-sky-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-500">
                            {numberFormatter.format(progress)}٪
                          </span>
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
          </div>
        </div>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="max-w-[420px] gap-0 border-slate-200/90 p-0 shadow-2xl" dir="rtl">
          <DialogHeader className="border-b border-slate-100 px-4 py-2.5 text-right">
            <DialogTitle className="text-[14px] font-bold text-slate-900">بحث</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-4 py-3">
            <Input
              value={projectQuery}
              onChange={(event) => setProjectQuery(event.target.value)}
              placeholder="اسم المشروع…"
              className="h-10 border-slate-200 bg-slate-50/80 text-[13px]"
            />
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ProjectStatusFilter)}>
              <SelectTrigger className="h-10 border-slate-200 bg-slate-50/80 text-[13px]">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="new">جديد</SelectItem>
                <SelectItem value="review">قيد المراجعة</SelectItem>
                <SelectItem value="approved">معتمد</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={createdFrom}
                onChange={(event) => setCreatedFrom(event.target.value)}
                className="h-10 border-slate-200 bg-slate-50/80 text-[12px]"
              />
              <Input
                type="date"
                value={createdTo}
                onChange={(event) => setCreatedTo(event.target.value)}
                className="h-10 border-slate-200 bg-slate-50/80 text-[12px]"
              />
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-slate-600"
                onClick={resetFilters}
                disabled={!hasActiveFilters}
              >
                <FilterX className="ms-1 h-4 w-4" />
                مسح
              </Button>
              <Button type="button" size="sm" className="h-9 bg-slate-900 text-white hover:bg-slate-800" onClick={() => setFiltersOpen(false)}>
                تم
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={contactDataOpen}
        onOpenChange={(open) => {
          setContactDataOpen(open);
          if (!open) setContactDataProject(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-hidden border-slate-200 p-0 shadow-2xl sm:max-w-2xl" dir="rtl">
          <DialogHeader className="border-b border-slate-100 bg-white px-5 py-4 text-right">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <MapPinned className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="truncate text-[15px] font-bold text-slate-900">بيانات للتواصل</DialogTitle>
                <DialogDescription className="truncate text-[12px] text-slate-500">
                  {contactDataProject?.name || "المشروع"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="max-h-[calc(90vh-9.5rem)] overflow-y-auto px-5 py-4">
            <MvProjectContactFields
              value={contactDataForm}
              onChange={setContactDataForm}
              disabled={savingContactData}
            />
          </div>
          <DialogFooter className="gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-slate-200 bg-white px-5"
              onClick={() => setContactDataOpen(false)}
              disabled={savingContactData}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              className="h-10 min-w-[120px] rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800"
              onClick={() => void handleSaveContactData()}
              disabled={savingContactData}
            >
              {savingContactData ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
            </Button>
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
    </div>
  );
}
