"use client";

import { useContext, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FolderPlus,
  Folder,
  Clock,
  Layers,
  Trash2,
  MoreVertical,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import CreateDialog from "./create-dialog";
import type { MvProject } from "./types";

const copy = {
  en: {
    title: "Machine Valuation",
    newProject: "New Project",
    noProjects: "No projects yet",
    noProjectsDesc: "Create a project to begin.",
    projects: "Projects",
    created: "Created",
    delete: "Delete",
    confirmDelete: "Are you sure you want to delete this project?",
    deleteSuccess: "Project deleted successfully",
    createSuccess: "Project created successfully",
    subProjects: "sub-projects",
    sheets: "sheets",
  },
  ar: {
    title: "تقييم الآلات",
    newProject: "مشروع جديد",
    noProjects: "لا توجد مشاريع بعد",
    noProjectsDesc: "أنشئ مشروعاً للبدء.",
    projects: "المشاريع",
    created: "أُنشئ في",
    delete: "حذف",
    confirmDelete: "هل أنت متأكد من حذف هذا المشروع؟",
    deleteSuccess: "تم حذف المشروع بنجاح",
    createSuccess: "تم إنشاء المشروع بنجاح",
    subProjects: "مشاريع فرعية",
    sheets: "جداول",
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

export default function ProjectsList() {
  const langCtx = useContext(LanguageContext);
  const isArabic = langCtx?.language === "ar";
  const t = isArabic ? copy.ar : copy.en;
  const router = useRouter();
  const { toast } = useToast();

  const [projects, setProjects] = useState<MvProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/mv/projects", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch {
      // silently fail on network issues
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async (name: string) => {
    try {
      setCreating(true);
      const res = await fetch("/api/mv/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const created = await res.json();
        toast({ description: t.createSuccess });
        router.push(`/machine-valuation/${created._id}`);
      }
    } catch {
      // error handled silently
    } finally {
      setCreating(false);
      setCreateOpen(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t.confirmDelete)) return;
    try {
      const res = await fetch(`/api/mv/projects/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p._id !== id));
        toast({ description: t.deleteSuccess });
      }
    } catch {
      // error handled silently
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 sm:text-lg">{t.title}</h1>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className={cn(
            "group relative flex items-center gap-2 rounded-lg px-3 py-2",
            "bg-white border border-slate-200 shadow-sm",
            "hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-100/50",
            "active:scale-[0.98] transition-all duration-200 cursor-pointer"
          )}
        >
          <div className="relative">
            <Folder className="h-5 w-5 text-amber-400 group-hover:text-amber-500 transition-colors" />
            <div className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm">
              <span className="text-[9px] font-bold leading-none">+</span>
            </div>
          </div>
          <span className="text-[11px] font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
            {t.newProject}
          </span>
        </button>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-slate-200/80 bg-white/60 p-3 space-y-2"
            >
              <div className="h-5 w-32 rounded-lg bg-slate-200/80" />
              <div className="h-4 w-24 rounded bg-slate-100" />
              <div className="h-4 w-20 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="relative mb-2">
            <Folder className="h-12 w-12 text-slate-200" />
            <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-500">
              <span className="text-sm font-bold leading-none">+</span>
            </div>
          </div>
          <h3 className="text-sm font-semibold text-slate-700 mb-0.5">
            {t.noProjects}
          </h3>
          <p className="mb-2 text-[11px] text-slate-500">{t.noProjectsDesc}</p>
          <Button
            onClick={() => setCreateOpen(true)}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <FolderPlus className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
            {t.newProject}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project._id}
              onClick={() => router.push(`/machine-valuation/${project._id}`)}
              className={cn(
                "group relative rounded-xl border border-slate-200/80 bg-white p-3 cursor-pointer",
                "hover:border-emerald-200 hover:shadow-md hover:shadow-emerald-50/50",
                "active:scale-[0.99] transition-all duration-200"
              )}
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Folder className="h-6 w-6 shrink-0 text-amber-400 group-hover:text-amber-500 transition-colors" />
                  <div className="min-w-0">
                    <h3 className="text-[12px] font-semibold text-slate-900 truncate">
                      {project.name}
                    </h3>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(project._id);
                      }}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                      {t.delete}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(project.createdAt)}
                </span>
                {(project.subProjectCount ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    {project.subProjectCount} {t.subProjects}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        variant="project"
        loading={creating}
        onSubmit={handleCreate}
      />
    </div>
  );
}
