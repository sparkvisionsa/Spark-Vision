"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, FileImage, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MvDialogContent } from "./mv-dialog";
import { MvProjectReportHeader } from "./mv-simple-report-navigation";
import { MvWorkflowPageFrame, MvWorkflowPageScrollBody } from "./mv-workflow-page-frame";
import { useMvI18n } from "./mv-i18n";
import { mvErrorMessage, isMvAbortError } from "./mv-api-client";
import { MvErrorState, MvPageLoading } from "./mv-ui";
import {
  loadProjectSummarySafe,
  readProjectSummaryCache,
  writeProjectSummaryCache,
} from "./mv-project-summary-loader";
import { uploadProjectFileAndReturnId } from "./mv-project-gridfs-upload";
import {
  convertPdfFileToPageImages,
  isImageFile,
  isPdfFile,
} from "./mv-pdf-page-images";
import {
  type MvClientDocumentImage,
  type MvClientDocumentsStore,
  type MvClientDocumentSource,
  clientDocumentImagesForReport,
  clientDocumentsStoreForApi,
  createClientDocumentId,
  emptyClientDocumentsStore,
  mergeClientDocumentsStores,
  readClientDocumentsStore,
  resolveClientDocumentImageSrc,
  writeClientDocumentsStore,
} from "./mv-client-documents-store";
import {
  readVisitedSimpleReportSteps,
  writeVisitedSimpleReportSteps,
} from "./mv-simple-report-navigation";
import type { MvProject } from "./types";

interface MvClientFilesWorkspaceProps {
  projectId: string;
}

function cleanFileName(name: string) {
  return name.replace(/\.[^.]+$/i, "").trim() || name.trim() || "مستند";
}

export default function MvClientFilesWorkspace({ projectId }: MvClientFilesWorkspaceProps) {
  const { t, dir } = useMvI18n();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const serverSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<MvClientDocumentsStore | null>(null);
  const storeRef = useRef<MvClientDocumentsStore>(emptyClientDocumentsStore());
  const stopFlagRef = useRef(false);

  const [project, setProject] = useState<MvProject | null>(() =>
    readProjectSummaryCache(projectId, "summary")?.project ?? null,
  );
  const [loadingProject, setLoadingProject] = useState(
    () => readProjectSummaryCache(projectId, "summary")?.project == null,
  );
  const [projectError, setProjectError] = useState<string | null>(null);
  const [store, setStore] = useState<MvClientDocumentsStore>(() => readClientDocumentsStore(projectId));
  const [dropActive, setDropActive] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    name: string;
  } | null>(null);

  storeRef.current = store;

  const projectName = project?.name?.trim() || projectId;
  const reportImages = useMemo(() => clientDocumentImagesForReport(store), [store]);

  useEffect(() => {
    const visited = readVisitedSimpleReportSteps(projectId);
    if (!visited.includes("client-files")) {
      writeVisitedSimpleReportSteps(projectId, [...visited, "client-files"]);
    }
  }, [projectId]);

  const loadProject = useCallback(
    async (signal?: AbortSignal) => {
      const hasCached = Boolean(readProjectSummaryCache(projectId, "summary")?.project);
      if (!hasCached) setLoadingProject(true);
      setProjectError(null);
      try {
        const { payload, error } = await loadProjectSummarySafe(projectId, {
          mode: "summary",
          signal,
          timeoutMs: 30_000,
        });
        if (signal?.aborted) return;
        if (!payload?.project) {
          setProject((current) => (current?._id === projectId ? current : null));
          if (!hasCached) {
            setProjectError(mvErrorMessage(error, t("workflow.error.loadProjectData")));
          }
          return;
        }
        setProject(payload.project);
        writeProjectSummaryCache(
          projectId,
          { project: payload.project, subProjects: payload.subProjects },
          "summary",
        );
        setProjectError(null);
      } catch (error) {
        if (signal?.aborted || isMvAbortError(error)) return;
        setProject((current) => (current?._id === projectId ? current : null));
        setProjectError(mvErrorMessage(error, t("workflow.error.loadProjectData")));
      } finally {
        if (!signal?.aborted) setLoadingProject(false);
      }
    },
    [projectId, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadProject(controller.signal);
    return () => controller.abort();
  }, [loadProject]);

  const serverStoreKey = useMemo(
    () => JSON.stringify(project?.clientDocumentsWorkspace ?? null),
    [project?.clientDocumentsWorkspace],
  );

  useEffect(() => {
    if (!project || project._id !== projectId) return;
    const local = readClientDocumentsStore(projectId);
    const merged = mergeClientDocumentsStores(project.clientDocumentsWorkspace, local);
    setStore(merged);
    writeClientDocumentsStore(projectId, merged);
  }, [projectId, project?._id, serverStoreKey]);

  const flushToServer = useCallback(async (options?: { silent?: boolean }) => {
    if (serverSaveTimerRef.current) {
      clearTimeout(serverSaveTimerRef.current);
      serverSaveTimerRef.current = null;
    }
    const snapshot =
      pendingSaveRef.current ?? storeRef.current ?? readClientDocumentsStore(projectId);
    pendingSaveRef.current = null;
    const payload = clientDocumentsStoreForApi({
      ...snapshot,
      version: 1,
      updatedAt: new Date().toISOString(),
    });
    try {
      const res = await fetch(`/api/mv/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientDocumentsWorkspace: payload,
        }),
      });
      if (res.ok) {
        try {
          const data = (await res.json()) as { project?: MvProject };
          if (data.project) setProject(data.project);
        } catch {
          /* HTTP 200 = نجاح حتى لو تعذّر قراءة الجسم */
        }
        return true;
      }
      let detail = "";
      try {
        const json = (await res.json()) as { message?: string | string[] };
        const m = json.message;
        if (typeof m === "string") detail = m.trim();
        else if (Array.isArray(m) && typeof m[0] === "string") detail = m[0].trim();
      } catch {
        detail = res.status ? `HTTP ${res.status}` : "";
      }
      if (!options?.silent) {
        toast({
          variant: "destructive",
          description: detail || t("clientFiles.sync.failed"),
        });
      }
      return false;
    } catch {
      if (!options?.silent) {
        toast({ variant: "destructive", description: t("clientFiles.sync.failed") });
      }
      return false;
    }
  }, [projectId, toast, t]);

  const persistStore = useCallback(
    (
      updater: (current: MvClientDocumentsStore) => MvClientDocumentsStore,
      options?: { sync?: "debounce" | "later" | "now" },
    ) => {
      const syncMode = options?.sync ?? "debounce";
      setStore((current) => {
        const next = updater(current);
        writeClientDocumentsStore(projectId, next);
        storeRef.current = next;
        pendingSaveRef.current = next;
        if (syncMode === "later") {
          if (serverSaveTimerRef.current) {
            clearTimeout(serverSaveTimerRef.current);
            serverSaveTimerRef.current = null;
          }
          return next;
        }
        if (syncMode === "now") {
          if (serverSaveTimerRef.current) {
            clearTimeout(serverSaveTimerRef.current);
            serverSaveTimerRef.current = null;
          }
          queueMicrotask(() => {
            void flushToServer();
          });
          return next;
        }
        if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current);
        serverSaveTimerRef.current = setTimeout(() => {
          serverSaveTimerRef.current = null;
          void flushToServer();
        }, 280);
        return next;
      });
    },
    [projectId, flushToServer],
  );

  useEffect(() => {
    return () => {
      if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current);
      stopFlagRef.current = true;
    };
  }, []);

  const ingestFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => isPdfFile(f) || isImageFile(f));
      if (list.length === 0) {
        toast({ variant: "destructive", description: t("clientFiles.upload.invalidType") });
        return;
      }

      stopFlagRef.current = false;
      setBusyLabel(t("clientFiles.upload.working"));
      setProgress({ done: 0, total: list.length });

      try {
        for (let fileIndex = 0; fileIndex < list.length; fileIndex += 1) {
          if (stopFlagRef.current) break;
          const file = list[fileIndex]!;
          const label = cleanFileName(file.name);
          setProgress({ done: fileIndex, total: list.length });

          if (isPdfFile(file)) {
            setBusyLabel(t("clientFiles.upload.convertingPdf", { name: file.name }));
            const source: MvClientDocumentSource = {
              id: createClientDocumentId("client-src"),
              kind: "pdf",
              name: file.name,
              originalName: file.name,
              mimeType: file.type || "application/pdf",
              sizeBytes: file.size,
              createdAt: new Date().toISOString(),
            };
            persistStore(
              (current) => ({
                ...current,
                sources: [...current.sources, source],
              }),
              { sync: "later" },
            );

            const pages = await convertPdfFileToPageImages(file, {
              shouldStop: () => stopFlagRef.current,
              onProgress: (done, total) => {
                setBusyLabel(
                  t("clientFiles.upload.pdfProgress", {
                    name: file.name,
                    done: String(done),
                    total: String(total),
                  }),
                );
              },
            });

            const uploaded: MvClientDocumentImage[] = [];
            for (const page of pages) {
              if (stopFlagRef.current) break;
              const fileId = await uploadProjectFileAndReturnId(projectId, page.file, {
                valuationAccounting: true,
              });
              uploaded.push({
                id: createClientDocumentId("client-img"),
                sourceId: source.id,
                sourceKind: "pdf",
                sourceFileName: label,
                name:
                  page.pageCount > 1
                    ? `${label} — صفحة ${page.pageNumber}`
                    : label,
                fileId,
                createdAt: new Date().toISOString(),
                includeInReport: true,
                autoGenerated: true,
                autoPageIndex: page.pageNumber,
                autoPageCount: page.pageCount,
              });
            }
            if (uploaded.length > 0) {
              persistStore(
                (current) => ({
                  ...current,
                  images: [...current.images, ...uploaded],
                }),
                { sync: "later" },
              );
            }
          } else {
            setBusyLabel(t("clientFiles.upload.uploadingImage", { name: file.name }));
            const fileId = await uploadProjectFileAndReturnId(projectId, file, {
              valuationAccounting: true,
            });
            const source: MvClientDocumentSource = {
              id: createClientDocumentId("client-src"),
              kind: "image",
              name: file.name,
              originalName: file.name,
              mimeType: file.type || "image/jpeg",
              sizeBytes: file.size,
              createdAt: new Date().toISOString(),
              fileId,
            };
            const image: MvClientDocumentImage = {
              id: createClientDocumentId("client-img"),
              sourceId: source.id,
              sourceKind: "image",
              sourceFileName: label,
              name: label,
              fileId,
              createdAt: new Date().toISOString(),
              includeInReport: true,
            };
            persistStore(
              (current) => ({
                ...current,
                sources: [...current.sources, source],
                images: [...current.images, image],
              }),
              { sync: "later" },
            );
          }
        }

        pendingSaveRef.current =
          pendingSaveRef.current ?? storeRef.current ?? readClientDocumentsStore(projectId);
        const synced = await flushToServer({ silent: true });
        if (synced) {
          toast({
            description: t("clientFiles.upload.success", { count: String(list.length) }),
          });
        } else {
          toast({
            description: t("clientFiles.upload.successLocal", { count: String(list.length) }),
          });
          toast({ variant: "destructive", description: t("clientFiles.sync.failed") });
        }
      } catch (error) {
        toast({
          variant: "destructive",
          description:
            error instanceof Error && error.message.trim()
              ? error.message
              : t("clientFiles.upload.failed"),
        });
      } finally {
        setBusyLabel(null);
        setProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [persistStore, flushToServer, projectId, t, toast],
  );

  const removeImage = useCallback(
    (imageId: string) => {
      persistStore((current) => {
        const image = current.images.find((im) => im.id === imageId);
        const nextImages = current.images.filter((im) => im.id !== imageId);
        const sourceStillUsed = image
          ? nextImages.some((im) => im.sourceId === image.sourceId)
          : true;
        return {
          ...current,
          images: nextImages,
          sources: sourceStillUsed
            ? current.sources
            : current.sources.filter((s) => s.id !== image?.sourceId),
        };
      });
    },
    [persistStore],
  );

  if (loadingProject && !project) {
    return <MvPageLoading label={t("workflow.loading.project")} />;
  }

  if (!project) {
    return (
      <MvErrorState
        title={t("workflow.error.openProject")}
        description={projectError ?? t("workflow.error.loadProjectData")}
        onRetry={() => void loadProject()}
      />
    );
  }

  return (
    <MvWorkflowPageFrame className="bg-[var(--color-background-primary)]" dir={dir}>
      <MvProjectReportHeader
        compact
        projectId={projectId}
        project={project}
        activeStep="client-files"
        breadcrumbs={[
          { label: projectName, href: `/machine-valuation/${projectId}/workflow/report-data` },
          { label: t("clientFiles.breadcrumb") },
        ]}
      />

      <MvWorkflowPageScrollBody className="pb-8">
        <main className="mx-auto w-full max-w-7xl space-y-5 px-3 py-5 sm:px-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-[18px] font-black text-slate-950">{t("clientFiles.title")}</h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 gap-1.5 rounded-xl text-[12px] font-bold"
                  disabled={Boolean(busyLabel) || store.images.length === 0}
                  onClick={() => {
                    persistStore(() => emptyClientDocumentsStore(), { sync: "now" });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("clientFiles.clearAll")}
                </Button>
                <Button
                  type="button"
                  className="h-9 gap-1.5 rounded-xl bg-[#0C447C] text-[12px] font-bold hover:bg-[#0a3a66]"
                  disabled={Boolean(busyLabel)}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {t("clientFiles.upload.button")}
                </Button>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf,image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = event.target.files;
                if (files?.length) void ingestFiles(files);
              }}
            />

            <div
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                if (!Array.from(event.dataTransfer.types).includes("Files")) return;
                event.preventDefault();
                setDropActive(true);
                event.dataTransfer.dropEffect = "copy";
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                setDropActive(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDropActive(false);
                const files = event.dataTransfer.files;
                if (files?.length) void ingestFiles(files);
              }}
              className={cn(
                "mt-4 flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center transition",
                dropActive
                  ? "border-sky-400 bg-sky-50"
                  : "border-slate-300 bg-slate-50/70 hover:border-sky-300 hover:bg-sky-50/40",
                busyLabel && "pointer-events-none opacity-70",
              )}
            >
              {busyLabel ? (
                <>
                  <Loader2 className="mb-2 h-7 w-7 animate-spin text-sky-700" />
                  <p className="text-[13px] font-bold text-slate-800">{busyLabel}</p>
                  {progress ? (
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                      {progress.done}/{progress.total}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-2 text-sky-800">
                    <FileText className="h-6 w-6" />
                    <FileImage className="h-6 w-6" />
                  </div>
                  <p className="text-[13px] font-black text-slate-800">{t("clientFiles.drop.title")}</p>
                  <p className="mt-1 max-w-md text-[11.5px] font-semibold leading-5 text-slate-500">
                    {t("clientFiles.drop.hint")}
                  </p>
                </>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-end justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-black text-slate-900">{t("clientFiles.gallery.title")}</h2>
                <p className="mt-0.5 text-[11.5px] font-semibold text-slate-500">
                  {t("clientFiles.gallery.subtitle", { count: String(reportImages.length) })}
                </p>
              </div>
            </div>

            {reportImages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-10 text-center">
                <p className="text-[13px] font-bold text-slate-600">{t("clientFiles.gallery.empty")}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {reportImages.map((image, index) => {
                  const src = resolveClientDocumentImageSrc(projectId, image);
                  return (
                    <figure
                      key={image.id}
                      className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                    >
                      <div className="relative flex aspect-[4/3] items-center justify-center bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={image.name}
                          className="max-h-full max-w-full object-contain"
                          loading="lazy"
                        />
                        {src ? (
                          <button
                            type="button"
                            onClick={() => setPreviewImage({ src, name: image.name })}
                            className="absolute start-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/90 bg-white/95 text-slate-700 shadow-sm transition hover:bg-sky-50 hover:text-[#0C447C]"
                            title={t("clientFiles.gallery.preview")}
                            aria-label={t("clientFiles.gallery.preview")}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                      <figcaption className="flex items-start justify-between gap-2 border-t border-slate-100 px-2.5 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-bold text-slate-800">
                            {index + 1}. {image.name}
                          </p>
                          <p className="truncate text-[10px] font-semibold text-slate-400">
                            {image.sourceKind === "pdf" ? "PDF" : t("clientFiles.gallery.imageKind")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(image.id)}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-red-100 text-red-600 transition hover:bg-red-50"
                          title={t("clientFiles.gallery.delete")}
                          aria-label={t("clientFiles.gallery.delete")}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </MvWorkflowPageScrollBody>

      <Dialog
        open={previewImage != null}
        onOpenChange={(open) => {
          if (!open) setPreviewImage(null);
        }}
      >
        <MvDialogContent className="max-w-4xl rounded-2xl border-slate-200 p-0" dir={dir}>
          <DialogHeader className="border-b border-slate-100 bg-white px-4 py-3 pe-14 text-start">
            <DialogTitle className="truncate text-base font-black text-slate-900">
              {previewImage?.name ?? t("clientFiles.gallery.preview")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[78vh] items-center justify-center bg-slate-100 p-4">
            {previewImage?.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewImage.src}
                alt={previewImage.name}
                className="max-h-[72vh] max-w-full object-contain"
              />
            ) : null}
          </div>
        </MvDialogContent>
      </Dialog>
    </MvWorkflowPageFrame>
  );
}
