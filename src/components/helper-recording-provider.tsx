"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { LanguageContext } from "@/components/layout-provider";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { RecordingCornerControls } from "@/components/recording-corner-controls";
import {
  RECORDING_LOCAL_MAX_BYTES,
  RECORDING_LOCAL_VIDEO_BITS,
  recordingExtension,
  useScreenRecorder,
  type RecorderSurface,
} from "@/hooks/use-screen-recorder";
import { fileNameTimestamp, safeMediaFileName } from "@/lib/download-media";
import {
  markScreenRecordingRemote,
  recordingOwnerFromAuth,
  saveScreenRecording,
  updateScreenRecordingDescription,
  type RecordingOwner,
  type StoredRecordingMeta,
} from "@/lib/helper-tools-recordings";
import {
  beginStreamingRecording,
  completeStreamingRecording,
  updateRemoteScreenRecording,
  uploadScreenRecording,
  uploadStreamingRecordingPart,
  type RemoteRecording,
} from "@/lib/helper-tools-recordings-api";

const HelperToolsModal = dynamic(() => import("@/components/helper-tools-modal"), { ssr: false });
const RECORDING_LOCAL_CACHE_MAX_BYTES = 96 * 1024 * 1024;
const STREAM_PART_BYTES = 8 * 1024 * 1024;
type RecordingStreamUpload = {
  csrfToken: string;
  session: Promise<{ uploadId: string; recordingId: string; partSize: number }>;
  pending: Blob[];
  pendingBytes: number;
  parts: Array<{ partNumber: number; etag: string }>;
  partSize: number;
  nextPart: number;
  uploadedBytes: number;
  chain: Promise<void>;
};

const labels = {
  ar: {
    cameraDenied: "لم تُمنح صلاحية الكاميرا.",
    cameraMissing: "لم يُعثر على كاميرا.",
    cameraFailed: "تعذّر تشغيل الكاميرا.",
    saveFailed: "تعذّر حفظ التسجيل على هذا الجهاز.",
    live: "التحكم في التسجيل",
    ready: "التسجيل جاهز",
    camera: "الكاميرا",
  },
  en: {
    cameraDenied: "Camera permission was not granted.",
    cameraMissing: "No camera was found.",
    cameraFailed: "Could not start the camera.",
    saveFailed: "Could not save the recording on this device.",
    live: "Recording controls",
    ready: "Recording ready",
    camera: "Camera",
  },
} as const;

type HelperRecordingContextValue = {
  withMicrophone: boolean;
  setWithMicrophone: (value: boolean) => void;
  withCamera: boolean;
  setWithCamera: (value: boolean) => void;
  cameraError: string;
  setCameraError: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  recording: ReturnType<typeof useScreenRecorder>;
  savedId: string | null;
  recordingsRevision: number;
  uploadProgress: number | null;
  libraryError: string;
  setLibraryError: (value: string) => void;
  owner: RecordingOwner | null;
  active: boolean;
  starting: boolean;
  isArabic: boolean;
  startRecording: () => void;
  saveAndCloseRecording: () => Promise<void>;
  newRecording: () => void;
  helperToolsOpen: boolean;
  openHelperTools: () => void;
  closeHelperTools: () => void;
};

const HelperRecordingContext = createContext<HelperRecordingContextValue | null>(null);

export function useHelperRecording() {
  const value = useContext(HelperRecordingContext);
  if (!value) throw new Error("useHelperRecording must be used within HelperRecordingProvider");
  return value;
}

export function HelperRecordingProvider({ children }: { children: ReactNode }) {
  const isArabic = (useContext(LanguageContext)?.language ?? "ar") === "ar";
  const copy = isArabic ? labels.ar : labels.en;
  const pathname = usePathname() || "/";
  const { user, session, csrfToken, loading: authLoading } = useAuthTracking();
  const owner = useMemo(
    () => recordingOwnerFromAuth({
      userId: user?.id,
      username: user?.username,
      companyId: user?.companyId,
      sessionId: session?.id,
      sessionActive: session?.isActive,
    }),
    [user?.id, user?.username, user?.companyId, session?.id, session?.isActive],
  );
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const [withMicrophone, setWithMicrophone] = useState(true);
  const [withCamera, setWithCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [description, setDescription] = useState("");
  const [libraryError, setLibraryError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [recordingsRevision, setRecordingsRevision] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const recordedSurface: RecorderSurface = "any";
  const recordedSurfaceRef = useRef<RecorderSurface>("any");
  const descriptionByBlob = useRef(new WeakMap<Blob, string>());
  const localSaveByBlob = useRef(new WeakMap<Blob, Promise<StoredRecordingMeta | null>>());
  const localMetaByBlob = useRef(new WeakMap<Blob, StoredRecordingMeta>());
  const remoteUploadByBlob = useRef(new WeakMap<Blob, Promise<RemoteRecording>>());
  const remoteIdByBlob = useRef(new WeakMap<Blob, string>());
  const streamUpload = useRef<RecordingStreamUpload | null>(null);
  const streamUploadByBlob = useRef(new WeakMap<Blob, Promise<RemoteRecording>>());
  const descriptionRef = useRef(description);
  descriptionRef.current = description;
  const onRecordingChunk = useCallback((chunk: Blob, mime: string) => {
    if (!csrfToken || !ownerRef.current) return;
    let state = streamUpload.current;
    if (!state) {
      const initialDescription = descriptionRef.current.trim().slice(0, 200);
      const filename = `${safeMediaFileName(initialDescription, `screen-recording-${fileNameTimestamp()}`)}.${mime.includes("mp4") ? "mp4" : "webm"}`;
      state = {
        csrfToken,
        session: beginStreamingRecording({ filename, mime, source: "any", description: initialDescription, csrfToken, seconds: 1, clientRequestId: crypto.randomUUID() }),
        pending: [], pendingBytes: 0, parts: [], partSize: STREAM_PART_BYTES, nextPart: 1, uploadedBytes: 0, chain: Promise.resolve(),
      };
      streamUpload.current = state;
      setUploadProgress(0);
    }
    state.pending.push(chunk);
    state.pendingBytes += chunk.size;
    state.chain = state.chain.catch((error) => {
      setLibraryError(error instanceof Error ? error.message : copy.saveFailed);
    }).then(async () => {
      const session = await state!.session;
      state!.partSize = session.partSize;
      while (state!.pendingBytes >= state!.partSize) {
        const batch = new Blob(state!.pending);
        state!.pending = [];
        state!.pendingBytes = 0;
        const part = batch.slice(0, state!.partSize);
        const remainder = batch.slice(state!.partSize);
        let etag: string;
        try {
          etag = await uploadStreamingRecordingPart({ uploadId: session.uploadId, partNumber: state!.nextPart, chunk: part, csrfToken: state!.csrfToken });
        } catch (error) {
          state!.pending = [batch, ...state!.pending];
          state!.pendingBytes += batch.size;
          throw error;
        }
        state!.parts.push({ partNumber: state!.nextPart++, etag });
        state!.uploadedBytes += part.size;
        if (remainder.size) {
          state!.pending = [remainder, ...state!.pending];
          state!.pendingBytes += remainder.size;
        }
      }
      setUploadProgress(Math.min(99, Math.round(state!.uploadedBytes / Math.max(state!.uploadedBytes + state!.pendingBytes, 1) * 100)));
    });
  }, [csrfToken, copy.saveFailed]);
  const recording = useScreenRecorder({
    microphone: withMicrophone ? "optional" : "off",
    camera: withCamera,
    systemAudio: true,
    maxBytes: RECORDING_LOCAL_MAX_BYTES,
    videoBitsPerSecond: RECORDING_LOCAL_VIDEO_BITS,
    onChunk: onRecordingChunk,
  });
  const recordingBlobRef = useRef<Blob | null>(recording.blob);
  recordingBlobRef.current = recording.blob;
  if (recording.blob) descriptionByBlob.current.set(recording.blob, description);
  const active = recording.state === "recording" || recording.state === "paused";
  const starting = recording.state === "starting";
  const onHelperToolsPage = pathname === "/helper-tools" || pathname.startsWith("/helper-tools/");
  const [helperToolsOpen, setHelperToolsOpen] = useState(false);
  const openHelperTools = useCallback(() => setHelperToolsOpen(true), []);
  const closeHelperTools = useCallback(() => setHelperToolsOpen(false), []);
  const inHelperToolsUi = onHelperToolsPage || helperToolsOpen;

  const ensureLocalSave = useCallback((blob: Blob, seconds: number, currentOwner: RecordingOwner) => {
    const existing = localSaveByBlob.current.get(blob);
    if (existing) return existing;
    if (blob.size > RECORDING_LOCAL_CACHE_MAX_BYTES) {
      const skipped = Promise.resolve(null);
      localSaveByBlob.current.set(blob, skipped);
      return skipped;
    }
    const save = saveScreenRecording({
      blob,
      source: recordedSurfaceRef.current,
      seconds,
      description: descriptionByBlob.current.get(blob) ?? descriptionRef.current,
      owner: currentOwner,
    }).then(async (meta) => {
      const latestDescription = descriptionByBlob.current.get(blob) ?? "";
      if (meta.description !== latestDescription) {
        await updateScreenRecordingDescription(meta.id, currentOwner.key, latestDescription);
        meta.description = latestDescription;
      }
      localMetaByBlob.current.set(blob, meta);
      setRecordingsRevision((revision) => revision + 1);
      if (recordingBlobRef.current === blob) {
        setSavedId(meta.id);
      }
      return meta;
    });
    localSaveByBlob.current.set(blob, save);
    return save;
  }, []);

  const uploadRecording = useCallback((input: {
    blob: Blob; filename: string; seconds: number; description: string; csrfToken: string;
  }) => {
    const prior = streamUploadByBlob.current.get(input.blob);
    if (prior) return prior;
    const state = streamUpload.current;
    if (!state || state.csrfToken !== input.csrfToken) {
      return uploadScreenRecording({ ...input, source: recordedSurfaceRef.current, onProgress: setUploadProgress });
    }
    const pending = (async () => {
      await state.chain;
      const session = await state.session;
      if (state.pendingBytes > 0) {
        const finalPart = new Blob(state.pending);
        const etag = await uploadStreamingRecordingPart({ uploadId: session.uploadId, partNumber: state.nextPart, chunk: finalPart, csrfToken: state.csrfToken });
        state.parts.push({ partNumber: state.nextPart++, etag });
        state.uploadedBytes += finalPart.size;
        state.pending = [];
        state.pendingBytes = 0;
      }
      // Duration metadata is patched in the local preview Blob after MediaRecorder stops.
      // Spaces received the original chunks, so completion must use their byte count.
      const remote = await completeStreamingRecording({ uploadId: session.uploadId, size: state.uploadedBytes, seconds: input.seconds, parts: state.parts, csrfToken: state.csrfToken });
      setUploadProgress(100);
      if (streamUpload.current === state) streamUpload.current = null;
      return remote;
    })().catch(async (error) => {
      // Keep the uploaded parts and session so Save and close can retry completion.
      streamUploadByBlob.current.delete(input.blob);
      // Preserve a name entered at the end even if multipart completion must be retried.
      try {
        const session = await state.session;
        await updateRemoteScreenRecording(state.csrfToken, session.recordingId, descriptionByBlob.current.get(input.blob) ?? input.description);
      } catch { /* the local copy retains the name while the API is unavailable */ }
      throw error;
    });
    streamUploadByBlob.current.set(input.blob, pending);
    return pending;
  }, []);

  useEffect(() => {
    const blob = recording.blob;
    const currentOwner = owner;
    if (!blob || authLoading || !currentOwner) return;

    const localSave = ensureLocalSave(blob, recording.seconds, currentOwner);
    void localSave.catch((cause) => {
      if (recordingBlobRef.current === blob) setLibraryError(cause instanceof Error ? cause.message : copy.saveFailed);
    });

    if (!csrfToken || remoteUploadByBlob.current.has(blob)) return;
    const initialDescription = descriptionByBlob.current.get(blob) ?? "";
    const filename = `${safeMediaFileName(initialDescription, `screen-recording-${fileNameTimestamp()}`)}.${recordingExtension(blob)}`;
    const upload = uploadRecording({
      blob,
      filename,
      seconds: recording.seconds,
      description: initialDescription,
      csrfToken,
    }).then(async (remote) => {
      remoteIdByBlob.current.set(blob, remote.id);
      const localMeta = localMetaByBlob.current.get(blob);
      if (localMeta) {
        try {
          await markScreenRecordingRemote(localMeta.id, currentOwner.key, remote.id);
        } catch (cause) {
          setLibraryError(cause instanceof Error ? cause.message : copy.saveFailed);
        }
      }
      const finalDescription = descriptionByBlob.current.get(blob) ?? "";
      let descriptionSaved = true;
      if (remote.description !== finalDescription) {
        try {
          await updateRemoteScreenRecording(csrfToken, remote.id, finalDescription);
        } catch (cause) {
          descriptionSaved = false;
          setLibraryError(cause instanceof Error ? cause.message : copy.saveFailed);
        }
      }
      if (recordingBlobRef.current === blob) {
        setSavedId(remote.id);
      }
      setRecordingsRevision((revision) => revision + 1);
      if (descriptionSaved) setLibraryError("");
      return remote;
    }).catch((cause) => {
      setLibraryError(cause instanceof Error ? cause.message : copy.saveFailed);
      remoteUploadByBlob.current.delete(blob);
      throw cause;
    });
    remoteUploadByBlob.current.set(blob, upload);
    void upload.catch(() => undefined);
  }, [recording.blob, recording.seconds, csrfToken, authLoading, owner, copy.saveFailed, ensureLocalSave, uploadRecording]);

  useEffect(() => {
    const blob = recording.blob;
    if (!blob || !owner) return;
    const timer = window.setTimeout(() => {
      const next = descriptionByBlob.current.get(blob) ?? "";
      const localMeta = localMetaByBlob.current.get(blob);
      if (localMeta) void updateScreenRecordingDescription(localMeta.id, owner.key, next);
      const remoteId = remoteIdByBlob.current.get(blob);
      if (remoteId && csrfToken) {
        void updateRemoteScreenRecording(csrfToken, remoteId, next).catch((cause) => {
          if (recordingBlobRef.current === blob) setLibraryError(cause instanceof Error ? cause.message : copy.saveFailed);
        });
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [recording.blob, savedId, description, owner, csrfToken, copy.saveFailed]);

  const startRecording = useCallback(() => {
    void recording.start();
  }, [recording]);

  const newRecording = useCallback(() => {
    recording.reset();
    setDescription("");
    setLibraryError("");
    setSavedId(null);
    setUploadProgress(null);
  }, [recording]);

  const saveAndCloseRecording = useCallback(async () => {
    const blob = recording.blob;
    const currentOwner = ownerRef.current;
    if (!blob || !currentOwner) throw new Error(copy.saveFailed);
    const finalDescription = descriptionRef.current.trim().slice(0, 200);
    descriptionByBlob.current.set(blob, finalDescription);
    let localError: unknown = null;
    try {
      const meta = await ensureLocalSave(blob, recording.seconds, currentOwner);
      if (meta) {
        await updateScreenRecordingDescription(meta.id, currentOwner.key, finalDescription);
        meta.description = finalDescription;
        setRecordingsRevision((revision) => revision + 1);
        if (recordingBlobRef.current === blob) setSavedId(meta.id);
      }
    } catch (error) {
      localError = error;
    }
    if (csrfToken) {
      let pendingUpload = remoteUploadByBlob.current.get(blob);
      if (!pendingUpload) {
        const filename = `${safeMediaFileName(finalDescription, `screen-recording-${fileNameTimestamp()}`)}.${recordingExtension(blob)}`;
        pendingUpload = uploadRecording({
          blob,
          filename,
          seconds: recording.seconds,
          description: finalDescription,
          csrfToken,
        }).then((remote) => {
          remoteIdByBlob.current.set(blob, remote.id);
          setRecordingsRevision((revision) => revision + 1);
          return remote;
        }).catch((cause) => {
          setLibraryError(cause instanceof Error ? cause.message : copy.saveFailed);
          remoteUploadByBlob.current.delete(blob);
          throw cause;
        });
        remoteUploadByBlob.current.set(blob, pendingUpload);
      }
      const remote = await pendingUpload;
      remoteIdByBlob.current.set(blob, remote.id);
      await updateRemoteScreenRecording(csrfToken, remote.id, finalDescription);
      setRecordingsRevision((revision) => revision + 1);
    } else if (localError || !localMetaByBlob.current.has(blob)) {
      throw localError instanceof Error ? localError : new Error(copy.saveFailed);
    }
    newRecording();
  }, [recording, csrfToken, ensureLocalSave, newRecording, copy.saveFailed, uploadRecording]);

  const value = useMemo(
    () => ({
      withMicrophone, setWithMicrophone, withCamera, setWithCamera,
      cameraError, setCameraError, description, setDescription,
      recording, savedId, recordingsRevision, libraryError, setLibraryError, owner, active, starting, isArabic,
      uploadProgress,
      startRecording, saveAndCloseRecording, newRecording, helperToolsOpen, openHelperTools, closeHelperTools,
    }),
    [
      withMicrophone, withCamera, cameraError, description,
      recording, savedId, recordingsRevision, libraryError, setLibraryError, owner, active, starting, isArabic, uploadProgress,
      startRecording, saveAndCloseRecording, newRecording, helperToolsOpen, openHelperTools, closeHelperTools,
    ],
  );

  return (
    <HelperRecordingContext.Provider value={value}>
      {children}
      <HelperToolsModal open={helperToolsOpen} onOpenChange={setHelperToolsOpen} />
      {active && !inHelperToolsUi && (
        <RecordingCornerControls
          paused={recording.state === "paused"}
          seconds={recording.seconds}
          remaining={recording.remaining}
          countdown={recording.countdown}
          onTogglePause={recording.togglePause}
          onStop={recording.stop}
          label={copy.live}
          uploadProgress={uploadProgress}
        />
      )}
      {active && recording.cameraPreview && !inHelperToolsUi && (
        <div className="pointer-events-none fixed bottom-4 end-4 z-[90] overflow-hidden rounded-2xl border-2 border-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/10">
          <video
            autoPlay
            muted
            playsInline
            aria-label={copy.camera}
            className="h-28 w-40 -scale-x-100 bg-slate-900 object-cover"
            ref={(node) => {
              if (!node) return;
              if (node.srcObject !== recording.cameraPreview) node.srcObject = recording.cameraPreview;
              void node.play().catch(() => undefined);
            }}
          />
        </div>
      )}
      {recording.blob && !active && !inHelperToolsUi && (
        <button
          type="button"
          onClick={openHelperTools}
          className="fixed bottom-3 start-3 z-[85] rounded-full bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg hover:bg-sky-700"
        >
          {copy.ready}
        </button>
      )}
    </HelperRecordingContext.Provider>
  );
}
