"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import Link from "@/components/prefetch-link";
import { FolderOpen, ImageIcon, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MvProjectReportHeader } from "./mv-simple-report-navigation";
import { MvWorkflowPageFrame, MvWorkflowPageScrollBody } from "./mv-workflow-page-frame";

interface MvAssetImagesLocalWorkspaceProps {
  projectId: string;
  projectName: string | null;
}

type LocalImageGroup = {
  id: string;
  kind: "folder" | "bundle";
  /** اسم المجلد كما ظهر من المسار، أو عنوان تجميعة الصور المنفردة */
  title: string;
  files: File[];
};

function newGroupId(): string {
  return `g-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isLikelyImageFile(f: File): boolean {
  if (f.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|bmp|heic|svg|tif|tiff)$/i.test(f.name);
}

/** تجميع ملفات اختيار ‎webkitdirectory‎ أو إسقاط مجلد حسب الجزء الأول من ‎webkitRelativePath‎ */
function clusterIncomingFiles(fileList: File[]): LocalImageGroup[] {
  const files = Array.from(fileList).filter(isLikelyImageFile);
  if (files.length === 0) return [];

  const byFirst = new Map<string, File[]>();
  const loose: File[] = [];

  for (const f of files) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
    if (rel && rel.includes("/")) {
      const root = rel.split("/")[0]!.trim();
      if (root) {
        if (!byFirst.has(root)) byFirst.set(root, []);
        byFirst.get(root)!.push(f);
        continue;
      }
    }
    loose.push(f);
  }

  const out: LocalImageGroup[] = [];
  for (const [title, list] of byFirst) {
    out.push({ id: newGroupId(), kind: "folder", title, files: list });
  }
  if (loose.length > 0) {
    out.push({
      id: newGroupId(),
      kind: "bundle",
      title: "صور مُختارة (بدون مجلد)",
      files: loose,
    });
  }
  return out;
}

export default function MvAssetImagesLocalWorkspace({ projectId, projectName }: MvAssetImagesLocalWorkspaceProps) {
  const [groups, setGroups] = useState<LocalImageGroup[]>([]);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();

  const appendFiles = useCallback((fileList: FileList | File[]) => {
    const next = clusterIncomingFiles(Array.from(fileList));
    if (next.length === 0) return;
    setGroups((g) => [...g, ...next]);
  }, []);

  const onPickDirectory = useCallback(() => {
    dirInputRef.current?.click();
  }, []);

  const onPickFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const removeGroup = useCallback((id: string) => {
    setGroups((g) => g.filter((x) => x.id !== id));
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files?.length) {
        appendFiles(e.dataTransfer.files);
      }
    },
    [appendFiles],
  );

  const objectUrls = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) {
      g.files.forEach((f, i) => {
        m.set(`${g.id}::${i}`, URL.createObjectURL(f));
      });
    }
    return m;
  }, [groups]);

  useEffect(() => {
    return () => {
      for (const u of objectUrls.values()) {
        URL.revokeObjectURL(u);
      }
    };
  }, [objectUrls]);

  return (
    <MvWorkflowPageFrame className="bg-white" dir="rtl">
      <MvProjectReportHeader
        compact
        projectId={projectId}
        activeStep="asset-images"
        breadcrumbs={[
          { label: projectName ?? projectId, href: `/machine-valuation/${projectId}/workflow/report-data` },
          { label: "تحديد صور الأصول", href: `/machine-valuation/${projectId}/workflow/asset-images` },
          { label: "استيراد من الجهاز" },
        ]}
      />

      <MvWorkflowPageScrollBody
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
      <div className="mx-auto min-h-full max-w-6xl space-y-4 px-4 py-4 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9 gap-1.5 rounded-lg text-[12px]"
              onClick={onPickDirectory}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              اختيار مجلد
            </Button>
            <Button
              type="button"
              className="h-9 gap-1.5 rounded-lg bg-[#0C447C] text-[12px] text-white hover:bg-[#0a3a66]"
              onClick={onPickFiles}
            >
              <Upload className="h-3.5 w-3.5" />
              اختيار صور
            </Button>
            <Button type="button" variant="ghost" asChild className="h-9 text-[12px]">
              <Link href={`/machine-valuation/${projectId}/workflow/asset-images`}>رجوع</Link>
            </Button>
          </div>
        </div>

        <input
          ref={dirInputRef}
          type="file"
          className="hidden"
          multiple
          {...({ webkitdirectory: "" } as ComponentProps<"input">)}
          onChange={(e) => {
            if (e.target.files?.length) appendFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={fileInputRef}
          id={`${baseId}-files`}
          type="file"
          className="hidden"
          accept="image/*"
          multiple
          onChange={(e) => {
            if (e.target.files?.length) appendFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {groups.length === 0 ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center">
            <ImageIcon className="h-12 w-12 text-slate-300" />
            <p className="text-[14px] font-medium text-slate-600">سطح العمل فارغ</p>
            <p className="max-w-md text-[12px] text-slate-500">
              اختر مجلداً تُعرض صوره كمجلد، أو اختر عدة صور دفعة واحدة لتظهر كمجموعة، أو أضف أكثر من مجلداً
              بالتعاقب.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <section
                key={g.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/40 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {g.kind === "folder" ? (
                      <FolderOpen className="h-4 w-4 shrink-0 text-amber-600" />
                    ) : (
                      <ImageIcon className="h-4 w-4 shrink-0 text-sky-600" />
                    )}
                    <h2 className="truncate text-[13px] font-semibold text-slate-900" title={g.title}>
                      {g.title}
                    </h2>
                    <span className="text-[11px] text-slate-400">
                      ({g.files.length} {g.files.length === 1 ? "صورة" : "صور"})
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-500 hover:text-red-600"
                    onClick={() => removeGroup(g.id)}
                    aria-label="إزالة المجموعة"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {g.files.map((f, i) => {
                    const src = objectUrls.get(`${g.id}::${i}`) ?? "";
                    return (
                      <div
                        key={`${g.id}-${i}-${f.name}`}
                        className="overflow-hidden rounded-lg border border-slate-200/80 bg-white"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt=""
                          className="aspect-square w-full object-cover"
                        />
                        <p className="truncate px-1.5 py-1 text-[9px] text-slate-500" dir="auto" title={f.name}>
                          {f.name}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
      </MvWorkflowPageScrollBody>
    </MvWorkflowPageFrame>
  );
}
