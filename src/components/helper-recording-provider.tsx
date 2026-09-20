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
} from "@/lib/helper-tools-recordings";
import { updateRemoteScreenRecording, uploadScreenRecording } from "@/lib/helper-tools-recordings-api";

const HelperToolsModal = dynamic(() => import("@/components/helper-tools-modal"), { ssr: false });

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
  surface: RecorderSurface;
  setSurface: (value: RecorderSurface) => void;
  withMicrophone: boolean;
  setWithMicrophone: (value: boolean) => void;
  withCamera: boolean;
  setWithCamera: (value: boolean) => void;
  cameraError: string;
  setCameraError: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  recording: ReturnType<typeof useScreenRecorder>;
  recordedSurface: RecorderSurface;
  savedId: string | null;
  libraryError: string;
  owner: RecordingOwner | null;
  active: boolean;
  starting: boolean;
  isArabic: boolean;
  startRecording: () => void;
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
  const [surface, setSurface] = useState<RecorderSurface>("any");
  const [withMicrophone, setWithMicrophone] = useState(true);
  const [withCamera, setWithCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [description, setDescription] = useState("");
  const [libraryError, setLibraryError] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [recordedSurface, setRecordedSurface] = useState<RecorderSurface>("any");
  const recordedSurfaceRef = useRef<RecorderSurface>("any");
  const savedKey = useRef("");
  const savingKey = useRef("");
  const remoteIdRef = useRef("");
  const recording = useScreenRecorder({
    surface,
    microphone: withMicrophone ? "optional" : "off",
    camera: withCamera,
    systemAudio: true,
    maxBytes: RECORDING_LOCAL_MAX_BYTES,
    videoBitsPerSecond: RECORDING_LOCAL_VIDEO_BITS,
  });
  const active = recording.state === "recording" || recording.state === "paused";
  const starting = recording.state === "starting";
  const onHelperToolsPage = pathname === "/helper-tools" || pathname.startsWith("/helper-tools/");
  const [helperToolsOpen, setHelperToolsOpen] = useState(false);
  const openHelperTools = useCallback(() => setHelperToolsOpen(true), []);
  const closeHelperTools = useCallback(() => setHelperToolsOpen(false), []);
  const inHelperToolsUi = onHelperToolsPage || helperToolsOpen;

  useEffect(() => {
    const blob = recording.blob;
    if (!blob) {
      savedKey.current = "";
      savingKey.current = "";
      remoteIdRef.current = "";
      setSavedId(null);
      return;
    }
    const currentOwner = ownerRef.current;
    if (authLoading || !currentOwner) return;
    const key = `${currentOwner.key}:${blob.size}:${blob.type}:${recording.seconds}`;
    if (savedKey.current === key || savingKey.current === key) return;
    savingKey.current = key;
    let cancelled = false;
    const filename = `${safeMediaFileName(description, `screen-recording-${fileNameTimestamp()}`)}.${recordingExtension(blob)}`;
    void saveScreenRecording({
      blob,
      source: recordedSurfaceRef.current,
      seconds: recording.seconds,
      description,
      owner: currentOwner,
    })
      .then(async (meta) => {
        if (cancelled) return;
        savedKey.current = key;
        setSavedId(meta.id);
        setLibraryError("");
        if (!csrfToken) return;
        try {
          const remote = await uploadScreenRecording({
            blob,
            filename,
            source: recordedSurfaceRef.current,
            seconds: recording.seconds,
            description,
            csrfToken,
          });
          if (cancelled) return;
          await markScreenRecordingRemote(meta.id, currentOwner.key, remote.id);
          remoteIdRef.current = remote.id;
        } catch (cause) {
          if (cancelled) return;
          setLibraryError(cause instanceof Error ? cause.message : copy.saveFailed);
        }
      })
      .catch((cause) => {
        if (cancelled) return;
        if (savingKey.current === key) savingKey.current = "";
        setLibraryError(cause instanceof Error ? cause.message : copy.saveFailed);
      });
    return () => { cancelled = true; };
  }, [recording.blob, recording.seconds, csrfToken, authLoading, copy.saveFailed]);

  useEffect(() => {
    if (!savedId || !owner) return;
    const timer = window.setTimeout(() => {
      void updateScreenRecordingDescription(savedId, owner.key, description);
      if (remoteIdRef.current && csrfToken) {
        void updateRemoteScreenRecording(csrfToken, remoteIdRef.current, description).catch(() => undefined);
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [savedId, description, owner, csrfToken]);

  const startRecording = useCallback(() => {
    recordedSurfaceRef.current = surface;
    setRecordedSurface(surface);
    void recording.start();
  }, [recording, surface]);

  const newRecording = useCallback(() => {
    recording.reset();
    setDescription("");
    setLibraryError("");
    setSavedId(null);
  }, [recording]);

  const value = useMemo(
    () => ({
      surface, setSurface, withMicrophone, setWithMicrophone, withCamera, setWithCamera,
      cameraError, setCameraError, description, setDescription,
      recording, recordedSurface, savedId, libraryError, owner, active, starting, isArabic,
      startRecording, newRecording, helperToolsOpen, openHelperTools, closeHelperTools,
    }),
    [
      surface, withMicrophone, withCamera, cameraError, description,
      recording, recordedSurface, savedId, libraryError, owner, active, starting, isArabic,
      startRecording, newRecording, helperToolsOpen, openHelperTools, closeHelperTools,
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
