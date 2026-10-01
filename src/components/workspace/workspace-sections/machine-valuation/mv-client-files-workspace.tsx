"use client";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { fetchAttachmentSnapshot, watchAttachmentSnapshot } from "@/lib/mv-attachment-sync";
import { enqueueAttachments, attachmentKnownIds, rememberAttachmentEdit, readDroppedAttachmentFiles } from "@/lib/mv-attachment-uploads";

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
  readProjectSummaryCache,
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
  parseClientDocumentsStoreFromApi,
  readClientDocumentsStore,
  resolveClientDocumentImageSrc,
  writeClientDocumentsStore,
} from "./mv-client-documents-store";
import {
  emptySceCertificateStore,
  readSceCertificateStore,
  writeSceCertificateStore,
} from "./mv-sce-certificate-store";
import {
  readVisitedSimpleReportSteps,
  writeVisitedSimpleReportSteps,
} from "./mv-simple-report-navigation";
import type { MvProject } from "./types";

interface MvClientFilesWorkspaceProps {
  projectId: string;
  kind?: "client" | "certificate";
  /** يعرض مساحة العمل داخل صفحة المرفقات من دون رأس مسار مستقل. */
  embedded?: boolean;
}

function cleanFileName(name: string) {
  return name.replace(/\.[^.]+$/i, "").trim() || name.trim() || "مستند";
}

export default function MvClientFilesWorkspace({
  projectId,
  kind = "client",
  embedded = false,
}: MvClientFilesWorkspaceProps) {
  const { t, dir } = useMvI18n();
  const { user: uploadUser } = useAuthTracking();
  const { toast } = useToast();
  const isCertificate = kind === "certificate";
  const workspaceField = isCertificate ? "sceCertificateWorkspace" : "clientDocumentsWorkspace";
  const readWorkspaceStore = useCallback(
    (id: string) => (isCertificate ? readSceCertificateStore(id) : readClientDocumentsStore(id)),
    [isCertificate],
  );
  const writeWorkspaceStore = useCallback(
    (id: string, value: MvClientDocumentsStore) =>
      isCertificate ? writeSceCertificateStore(id, value) : writeClientDocumentsStore(id, value),
    [isCertificate],
  );
  const emptyWorkspaceStore = useCallback(
    () => (isCertificate ? emptySceCertificateStore() : emptyClientDocumentsStore()),
    [isCertificate],
  );
  const workspaceTitle = isCertificate ? "شهادة نظام الهيئة (قيمة)" : t("clientFiles.title");
  const workspaceBreadcrumb = isCertificate ? "شهادة نظام الهيئة (قيمة)" : t("clientFiles.breadcrumb");
  const dropTitle = isCertificate ? "ارفع شهادة نظام الهيئة" : t("clientFiles.drop.title");
  const dropHint = isCertificate
    ? "ارفع ملف PDF أو صورة مباشرة. يحوّل النظام صفحات PDF إلى صور ويضيفها تلقائيًا إلى مرفق 4 في التقرير."
    : t("clientFiles.drop.hint");
  const galleryTitle = isCertificate ? "صور شهادة قيمة" : t("clientFiles.gallery.title");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const serverSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<MvClientDocumentsStore | null>(null);
  const flushInFlightRef = useRef(false);
  const storeRef = useRef<MvClientDocumentsStore>(emptyWorkspaceStore());
  const stopFlagRef = useRef(false);

  const [project, setProject] = useState<MvProject | null>(() =>
    readProjectSummaryCache(projectId, "summary")?.project ?? null,
  );
  const [loadingProject, setLoadingProject] = useState(
    () => readProjectSummaryCache(projectId, "summary")?.project == null,
  );
  const [projectError, setProjectError] = useState<string | null>(null);
  const [store, setStore] = useState<MvClientDocumentsStore>(() => readWorkspaceStore(projectId));
  const [dropActive, setDropActive] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    name: string;
  } | null>(null);

  useEffect(() => { setStore(readWorkspaceStore(projectId)); }, [projectId, readWorkspaceStore]);
  storeRef.current = store;

  const projectName = project?.name?.trim() || projectId;
  // The attachment gallery shows saved files even when excluded from export.
  const reportImages = store.images;

  useEffect(() => {
    const visited = readVisitedSimpleReportSteps(projectId);
    if (!visited.includes("report-files")) {
      writeVisitedSimpleReportSteps(projectId, [...visited, "report-files"]);
    }
  }, [projectId]);

  const loadProject = useCallback(
    async (signal?: AbortSignal) => {
      const hasCached = Boolean(readProjectSummaryCache(projectId, "summary")?.project);
      if (!hasCached) setLoadingProject(true);
      setProjectError(null);
      try {
        const fresh = await fetchAttachmentSnapshot(projectId);
        if (signal?.aborted) return;
        setProject((current) => ({ ...current, ...fresh } as MvProject));
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
    () => JSON.stringify(project?.[workspaceField] ?? null),
    [project, workspaceField],
  );

  useEffect(() => {
    if (!project || project._id !== projectId) return;
    if (pendingSaveRef.current) return;
    const local = readWorkspaceStore(projectId);
    const merged = parseClientDocumentsStoreFromApi(project[workspaceField]) ?? mergeClientDocumentsStores(project[workspaceField], local);
    setStore(merged);
    writeWorkspaceStore(projectId, merged);
  }, [projectId, project?._id, readWorkspaceStore, serverStoreKey, workspaceField, writeWorkspaceStore]);

  const flushToServer = useCallback(async (options?: { silent?: boolean }) => {
    if (flushInFlightRef.current) return false;
    flushInFlightRef.current = true;
    let saved = false;
    if (serverSaveTimerRef.current) {
      clearTimeout(serverSaveTimerRef.current);
      serverSaveTimerRef.current = null;
    }
    const snapshot =
      pendingSaveRef.current ?? storeRef.current ?? readWorkspaceStore(projectId);
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
        body: JSON.stringify({ [workspaceField]: payload, attachmentKnownIds: { [workspaceField]: attachmentKnownIds(snapshot) } }),
      });
      if (res.ok) {
        try {
          const data = (await res.json()) as { project?: MvProject };
          if (data.project) setProject(data.project);
        } catch {
          /* HTTP 200 = نجاح حتى لو تعذّر قراءة الجسم */
        }
        saved = true;
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
    } finally {
      flushInFlightRef.current = false;
      if (!saved) pendingSaveRef.current ??= snapshot;
      else if (pendingSaveRef.current) queueMicrotask(() => { void flushToServer(options); });
    }
  }, [projectId, readWorkspaceStore, toast, t, workspaceField]);

  const persistStore = useCallback(
    (
      updater: (current: MvClientDocumentsStore) => MvClientDocumentsStore,
      options?: { sync?: "debounce" | "later" | "now" },
    ) => {
      const syncMode = options?.sync ?? "debounce";
      setStore((current) => {
        const next = updater(current);
        rememberAttachmentEdit(current, next);
        writeWorkspaceStore(projectId, next);
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
    [projectId, flushToServer, writeWorkspaceStore],
  );

  useEffect(() => {
    return () => {
      if (serverSaveTimerRef.current) clearTimeout(serverSaveTimerRef.current);
      stopFlagRef.current = true;
      if (pendingSaveRef.current) void flushToServer({ silent: true });
    };
  }, [flushToServer]);

  const ingestFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files).filter(file => isPdfFile(file) || isImageFile(file));
    if (!list.length || !uploadUser) {
      toast({ variant: "destructive", description: t("clientFiles.upload.invalidType") });
      return;
    }
    try {
      await enqueueAttachments(uploadUser, projectId, `${projectName} / ${workspaceTitle}`, list, { field: workspaceField });
    } catch (error) {
      toast({ variant: "destructive", description: error instanceof Error ? error.message : t("assetImages.upload.localSaveFailed") });
    } finally { if (fileInputRef.current) fileInputRef.current.value = ""; }
  }, [uploadUser, projectId, projectName, workspaceTitle, workspaceField, t, toast]);

  useEffect(() => watchAttachmentSnapshot(projectId, (fresh) => {
    if (pendingSaveRef.current || flushInFlightRef.current) return false;
    setProject((current) => ({ ...current, ...fresh } as MvProject));
  }), [projectId]);

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
    <MvWorkflowPageFrame className={cn("bg-[var(--color-background-primary)]", embedded && "bg-transparent")} dir={dir}>
      {!embedded ? (
        <MvProjectReportHeader
          compact
          projectId={projectId}
          project={project}
          activeStep="report-files"
          breadcrumbs={[
            { label: projectName, href: `/machine-valuation/${projectId}/workflow/report-data` },
            { label: workspaceBreadcrumb },
          ]}
        />
      ) : null}

      <MvWorkflowPageScrollBody className={embedded ? "pb-0" : "pb-8"}>
        <main className={cn("mx-auto w-full max-w-7xl px-3 sm:px-4", embedded ? "space-y-2 px-2 py-2 sm:px-3" : "space-y-5 py-5")}>
          <section className={cn("border border-slate-200 bg-white shadow-sm", embedded ? "rounded-xl p-3" : "rounded-2xl p-5")}>
            <div className={cn("flex flex-col gap-2 sm:flex-row sm:items-start", embedded ? "sm:justify-end" : "sm:justify-between") }>
              {!embedded ? (
                <div className="min-w-0">
                  <h1 className="text-[18px] font-black text-slate-950">{workspaceTitle}</h1>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 gap-1.5 rounded-lg px-2.5 text-[11px] font-bold"
                  disabled={Boolean(busyLabel) || store.images.length === 0}
                  onClick={() => {
                    persistStore(() => emptyWorkspaceStore(), { sync: "now" });
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("clientFiles.clearAll")}
                </Button>
                <Button
                  type="button"
                  className="h-8 gap-1.5 rounded-lg bg-[#0C447C] px-2.5 text-[11px] font-bold hover:bg-[#0a3a66]"
                  disabled={Boolean(busyLabel)}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {t("clientFiles.upload.button")}
                </Button>
              </div>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-bold">
              {t("assetImages.actions.uploadFolders")}
              <input type="file" multiple {...{ webkitdirectory: "", directory: "" }} className="hidden"
                onChange={event => { void ingestFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
            </label>

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
                void readDroppedAttachmentFiles(event.dataTransfer).then(ingestFiles)
                  .catch(error => toast({ variant: "destructive", description: String(error) }));
              }}
              className={cn(
                cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-3 text-center transition",
                  embedded ? "mt-2 min-h-[112px] py-4" : "mt-4 min-h-[160px] py-8",
                ),
                dropActive
                  ? "border-sky-400 bg-sky-50"
                  : "border-slate-300 bg-slate-50/70 hover:border-sky-300 hover:bg-sky-50/40",
                busyLabel && "pointer-events-none opacity-70",
              )}
            >
              {busyLabel ? (
                <>
                  <Loader2 className="mb-1.5 h-5 w-5 animate-spin text-sky-700" />
                  <p className="text-[11px] font-bold text-slate-800">{busyLabel}</p>
                  {progress ? (
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                      {progress.done}/{progress.total}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="mb-2 flex items-center gap-2 text-sky-800">
                    <FileText className="h-5 w-5" />
                    <FileImage className="h-5 w-5" />
                  </div>
                  <p className="text-[11px] font-black text-slate-800">{dropTitle}</p>
                  {!embedded ? (
                    <p className="mt-1 max-w-md text-[11.5px] font-semibold leading-5 text-slate-500">
                      {dropHint}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </section>

          <section className={cn("border border-slate-200 bg-white shadow-sm", embedded ? "rounded-xl p-3" : "rounded-2xl p-5")}>
            {!embedded ? (
              <div className="mb-3 flex items-end justify-between gap-2">
                <div>
                  <h2 className="text-[15px] font-black text-slate-900">{galleryTitle}</h2>
                  <p className="mt-0.5 text-[11.5px] font-semibold text-slate-500">
                    {t("clientFiles.gallery.subtitle", { count: String(reportImages.length) })}
                  </p>
                </div>
              </div>
            ) : null}

            {reportImages.length === 0 ? (
              <div className={cn("rounded-lg border border-dashed border-slate-300 bg-slate-50/80 px-3 text-center", embedded ? "py-6" : "py-10")}>
                <p className="text-[11px] font-bold text-slate-600">{t("clientFiles.gallery.empty")}</p>
              </div>
            ) : (
              <div className={cn("grid grid-cols-2", embedded ? "gap-2" : "gap-3 sm:gap-4")}>
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
                          loading={index < 4 ? "eager" : "lazy"}
                          decoding="async"
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
