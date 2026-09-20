"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { finalizeRecordingBlob } from "@/lib/fix-recording-duration";

export type RecorderState = "idle" | "starting" | "recording" | "paused" | "preview";
/** "system" يقصر المشاركة على تبويب النظام، و"any" يترك للمستخدم اختيار أي شاشة أو نافذة. */
export type RecorderSurface = "system" | "any";
export type RecorderMicrophone = "required" | "optional" | "off";

/** ساعة كاملة: أطول مقطع يمكن الاعتماد عليه داخل المتصفح دون ضغط على الذاكرة. */
export const RECORDING_MAX_SECONDS = 3600;
/** يظهر العدّاد التنازلي على الشاشة في آخر خمس دقائق حتى الثانية الأخيرة. */
export const RECORDING_COUNTDOWN_SECONDS = 300;
/** تسجيل يُرفع إلى الدعم: حجم ومعدل بت يتسعان لساعة كاملة دون قطع. */
export const RECORDING_UPLOAD_MAX_BYTES = 480 * 1024 * 1024;
export const RECORDING_UPLOAD_VIDEO_BITS = 950_000;
/** تسجيل محلي لا يُرفع: جودة أعلى وحد أوسع. */
export const RECORDING_LOCAL_MAX_BYTES = 1024 * 1024 * 1024;
export const RECORDING_LOCAL_VIDEO_BITS = 1_400_000;
const RECORDING_AUDIO_BITS = 64_000;
const CLOCK_TICK_MS = 250;
const LEVEL_TICK_MS = 200;

export function recordingMime() {
  return ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(type => MediaRecorder.isTypeSupported(type)) ?? "";
}
export function recordingExtension(blob: Blob | null) {
  return blob?.type.includes("mp4") ? "mp4" : "webm";
}
export function formatRecordingClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const pad = (value: number) => String(value).padStart(2, "0");
  const hours = Math.floor(safe / 3600);
  return `${hours ? `${pad(hours)}:` : ""}${pad(Math.floor((safe % 3600) / 60))}:${pad(safe % 60)}`;
}
function limitLabel(seconds: number) {
  if (seconds >= 3600 && seconds % 3600 === 0) {
    const hours = seconds / 3600;
    return hours === 1 ? "ساعة واحدة" : `${hours} ساعات`;
  }
  return `${Math.round(seconds / 60)} دقيقة`;
}
async function requestCamera() {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 360 } }, audio: false });
  } catch {
    return null;
  }
}
const COMPOSITE_FPS = 24;
type VideoFrameCallbackVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: () => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

function hintMotion(track: MediaStreamTrack | undefined) {
  if (!track) return;
  try {
    track.contentHint = "motion";
  } catch {
    /* ignore unsupported browsers */
  }
}

async function playHiddenVideo(stream: MediaStream) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.setAttribute("playsinline", "");
  video.srcObject = stream;
  await video.play();
  if (!video.videoWidth) {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("تعذّر قراءة بث الفيديو.")), 8000);
      video.onloadedmetadata = () => { window.clearTimeout(timer); resolve(); };
    });
  }
  return video;
}

function drawCameraBubble(
  ctx: CanvasRenderingContext2D,
  cam: HTMLVideoElement,
  canvas: HTMLCanvasElement,
) {
  if (!cam.videoWidth) return;
  const width = Math.round(canvas.width * 0.18);
  const height = Math.round(width * (cam.videoHeight / cam.videoWidth));
  const pad = Math.round(canvas.width * 0.018);
  const x = canvas.width - width - pad;
  const y = canvas.height - height - pad;
  const radius = Math.min(16, width / 8);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.clip();
  ctx.drawImage(cam, x, y, width, height);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = Math.max(2, canvas.width / 900);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.stroke();
}

/**
 * يدمج كاميرا واحدة في زاوية التسجيل.
 * لا يعتمد على requestAnimationFrame وحده لأنه يتوقف عند مغادرة تبويب النظام.
 */
async function composeDisplayAndCamera(display: MediaStream, camera: MediaStream) {
  const capturedSurface = String(display.getVideoTracks()[0]?.getSettings?.().displaySurface ?? "");
  const screen = await playHiddenVideo(display) as VideoFrameCallbackVideo;
  const cam = await playHiddenVideo(camera);
  const canvas = document.createElement("canvas");
  canvas.width = screen.videoWidth || 1920;
  canvas.height = screen.videoHeight || 1080;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:auto 0 0 auto;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  if (!ctx) {
    canvas.remove();
    throw new Error("تعذّر دمج الكاميرا مع الشاشة.");
  }
  let running = true;
  let rvfcHandle = 0;
  const paint = () => {
    if (!running) return;
    if (screen.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      ctx.drawImage(screen, 0, 0, canvas.width, canvas.height);
    }
    // على الشاشة الكاملة تظهر المعاينة الحية داخل البث. تُرسم الفقاعة عند الإخفاء فقط حتى لا تتكرر الكاميرا.
    const captureIncludesOverlay = capturedSurface === "monitor" && document.visibilityState === "visible";
    if (!captureIncludesOverlay) {
      drawCameraBubble(ctx, cam, canvas);
    }
  };
  const resumePlayback = () => {
    void screen.play().catch(() => undefined);
    void cam.play().catch(() => undefined);
    paint();
  };
  const rvfcLoop = () => {
    if (!running) return;
    paint();
    rvfcHandle = screen.requestVideoFrameCallback?.(rvfcLoop) ?? 0;
  };
  if (typeof screen.requestVideoFrameCallback === "function") {
    rvfcHandle = screen.requestVideoFrameCallback(rvfcLoop);
  }
  const interval = window.setInterval(paint, Math.round(1000 / COMPOSITE_FPS));
  document.addEventListener("visibilitychange", resumePlayback);
  window.addEventListener("focus", resumePlayback);
  paint();
  const stream = canvas.captureStream(COMPOSITE_FPS);
  stream.getVideoTracks().forEach((track) => hintMotion(track));
  return {
    stream,
    stop() {
      running = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", resumePlayback);
      window.removeEventListener("focus", resumePlayback);
      if (rvfcHandle && screen.cancelVideoFrameCallback) screen.cancelVideoFrameCallback(rvfcHandle);
      canvas.remove();
      screen.pause();
      cam.pause();
      screen.srcObject = null;
      cam.srcObject = null;
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}
async function requestMicrophone(required: boolean) {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
  } catch (cause) {
    if (required) throw cause;
    return null;
  }
}
type AudioMix = { context: AudioContext; tracks: MediaStreamTrack[]; analyser: AnalyserNode };
/** يدمج الميكروفون وصوت الشاشة في مسار واحد، ويغذّي مؤشر مستوى الصوت من المزيج نفسه. */
async function createAudioMix(sources: MediaStream[]): Promise<AudioMix | null> {
  const Context = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Context) return null;
  const context = new Context();
  try {
    await context.resume();
    if (context.state !== "running") throw new Error("audio context is suspended");
    const mixer = context.createGain();
    for (const source of sources) context.createMediaStreamSource(source).connect(mixer);
    const destination = context.createMediaStreamDestination();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    mixer.connect(destination);
    mixer.connect(analyser);
    const tracks = destination.stream.getAudioTracks();
    if (!tracks.length) throw new Error("empty audio mix");
    return { context, tracks, analyser };
  } catch {
    await context.close().catch(() => undefined);
    return null;
  }
}

export type ScreenRecorderOptions = {
  maxSeconds?: number;
  maxBytes?: number;
  surface?: RecorderSurface;
  microphone?: RecorderMicrophone;
  camera?: boolean;
  cameraStream?: MediaStream | null;
  systemAudio?: boolean;
  videoBitsPerSecond?: number;
};

export function useScreenRecorder(options: ScreenRecorderOptions = {}) {
  const {
    maxSeconds = RECORDING_MAX_SECONDS,
    maxBytes = RECORDING_UPLOAD_MAX_BYTES,
    surface = "system",
    microphone = "required",
    camera = false,
    cameraStream = null,
    systemAudio = false,
    videoBitsPerSecond = RECORDING_UPLOAD_VIDEO_BITS,
  } = options;
  const [state, setState] = useState<RecorderState>("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraPreview, setCameraPreview] = useState<MediaStream | null>(null);
  const [cameraComposited, setCameraComposited] = useState(false);
  const streams = useRef<MediaStream[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const interval = useRef<ReturnType<typeof setInterval>>();
  const levelInterval = useRef<ReturnType<typeof setInterval>>();
  const generation = useRef(0);
  const mounted = useRef(true);
  const elapsed = useRef({ total: 0, since: 0 });
  const durationMs = useRef(0);
  const compositeStop = useRef<(() => void) | null>(null);
  // تُقرأ الإعدادات لحظة البدء فقط، فلا تتبدّل دوال الهوك مع كل تغيير خيار في الواجهة.
  const settings = useRef({ maxSeconds, maxBytes, surface, microphone, camera, cameraStream, systemAudio, videoBitsPerSecond });
  useEffect(() => {
    settings.current = { maxSeconds, maxBytes, surface, microphone, camera, cameraStream, systemAudio, videoBitsPerSecond };
  }, [maxSeconds, maxBytes, surface, microphone, camera, cameraStream, systemAudio, videoBitsPerSecond]);
  const stopTracks = useCallback(() => {
    streams.current.forEach(s => s.getTracks().forEach(t => { t.onended = null; t.stop(); }));
    streams.current = [];
    compositeStop.current?.();
    compositeStop.current = null;
    if (mounted.current) {
      setCameraPreview(null);
      setCameraComposited(false);
    }
    if (interval.current) clearInterval(interval.current);
    if (levelInterval.current) clearInterval(levelInterval.current);
    if (audioContext.current) void audioContext.current.close().catch(() => {});
    audioContext.current = null;
  }, []);
  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") {
      elapsed.current.total += Date.now() - elapsed.current.since;
      elapsed.current.since = 0;
    }
    durationMs.current = elapsed.current.total;
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    stopTracks();
  }, [stopTracks]);
  const reset = useCallback(() => {
    generation.current++;
    if (recorder.current) recorder.current.onstop = null;
    stop(); setBlob(null); setSeconds(0); setLevel(0); setState("idle"); setError(""); setNotice(""); setAudioEnabled(false); setCameraEnabled(false); setCameraPreview(null); setCameraComposited(false);
  }, [stop]);
  const start = useCallback(async () => {
    const config = settings.current;
    if (recorder.current?.state === "recording" || recorder.current?.state === "paused") return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") {
      setError("تسجيل الشاشة يحتاج متصفح سطح مكتب يدعم المشاركة واتصال HTTPS أو localhost."); return;
    }
    const attempt = ++generation.current;
    const valid = () => mounted.current && generation.current === attempt;
    setState("starting"); setError(""); setNotice(""); setBlob(null); setSeconds(0); setCameraPreview(null); setCameraComposited(false);
    try {
      // Must remain directly connected to the user's click (transient activation).
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 24, max: 30 },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          ...(config.surface === "system" ? { displaySurface: "browser" } : {}),
        },
        audio: config.systemAudio,
        ...(config.surface === "system"
          ? { preferCurrentTab: true }
          : { preferCurrentTab: false, selfBrowserSurface: "exclude", surfaceSwitching: "include", monitorTypeSurfaces: "include" }),
      } as DisplayMediaStreamOptions);
      if (!valid()) { display.getTracks().forEach(t => t.stop()); return; }
      streams.current.push(display);
      const microphoneStream = config.microphone === "off" ? null : await requestMicrophone(config.microphone === "required");
      if (!valid()) { microphoneStream?.getTracks().forEach(t => t.stop()); stopTracks(); return; }
      if (microphoneStream) streams.current.push(microphoneStream);
      let videoTracks = display.getVideoTracks();
      const displayTrack = videoTracks[0];
      if (displayTrack?.readyState !== "live") throw new Error("انتهت مشاركة الشاشة؛ ابدأ التسجيل مجدداً.");
      hintMotion(displayTrack);
      void displayTrack.applyConstraints?.({ frameRate: 24 }).catch(() => undefined);
      const capturedSurface = String(displayTrack.getSettings?.().displaySurface ?? "");
      if (config.surface === "any" && capturedSurface === "browser") {
        setNotice("لتسجيل التنقل بين النوافذ والتطبيقات اختر «شاشة كاملة» عند المشاركة، وليس تبويب المتصفح.");
      }
      if (config.camera) {
        const previewTracks = config.cameraStream?.getVideoTracks().filter((track) => track.readyState === "live") ?? [];
        const cameraMedia = previewTracks.length ? new MediaStream(previewTracks.map((track) => track.clone())) : await requestCamera();
        if (cameraMedia?.getVideoTracks().length) {
          streams.current.push(cameraMedia);
          setCameraEnabled(true);
          if (config.surface === "any") {
            try {
              const composed = await composeDisplayAndCamera(display, cameraMedia);
              if (!valid()) { composed.stop(); stopTracks(); return; }
              compositeStop.current = composed.stop;
              videoTracks = composed.stream.getVideoTracks();
              setCameraComposited(true);
              setCameraPreview(cameraMedia);
            } catch {
              setCameraComposited(false);
              setCameraPreview(cameraMedia);
              setNotice("تعذّر دمج الكاميرا داخل التسجيل، وسيُحفظ مقطع الشاشة فقط.");
            }
          } else {
            setCameraComposited(false);
            setCameraPreview(cameraMedia);
          }
        } else {
          setCameraEnabled(false);
          setNotice("تعذّر تشغيل الكاميرا، وسيُسجَّل المقطع بدون صورتها.");
        }
      } else {
        setCameraEnabled(false);
        setCameraComposited(false);
      }
      const displayAudio = display.getAudioTracks();
      const sources = [...(microphoneStream ? [microphoneStream] : []), ...(displayAudio.length ? [new MediaStream(displayAudio)] : [])];
      const mix = sources.length ? await createAudioMix(sources) : null;
      if (!valid()) { if (mix) await mix.context.close().catch(() => undefined); stopTracks(); return; }
      if (mix) audioContext.current = mix.context;
      const audioTracks = mix ? mix.tracks : sources.flatMap(source => source.getAudioTracks());
      const mimeType = recordingMime();
      const recording = new MediaRecorder(new MediaStream([...videoTracks, ...audioTracks]), { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: config.videoBitsPerSecond, audioBitsPerSecond: RECORDING_AUDIO_BITS });
      recorder.current = recording;
      setAudioEnabled(audioTracks.length > 0);
      if (config.microphone !== "off" && !microphoneStream) {
        setNotice((current) => current || "تعذّر الوصول إلى الميكروفون، وسيُسجَّل المقطع بدون تعليق صوتي.");
      }
      const chunks: Blob[] = [];
      let bytes = 0;
      recording.ondataavailable = event => {
        if (event.data.size) { chunks.push(event.data); bytes += event.data.size; }
        if (bytes >= config.maxBytes && recording.state !== "inactive") {
          if (valid()) setNotice("بلغ التسجيل الحد الأقصى للحجم، والمقطع جاهز للمعاينة.");
          stop();
        }
      };
      recording.onerror = () => { if (valid()) setError("تعذر إكمال التسجيل؛ راجع الجزء المسجّل قبل الإرسال."); stop(); };
      recording.onstop = () => {
        stopTracks();
        if (!valid()) return;
        if (elapsed.current.since) {
          elapsed.current.total += Date.now() - elapsed.current.since;
          elapsed.current.since = 0;
        }
        const result = new Blob(chunks, { type: recording.mimeType || mimeType || "video/webm" });
        if (!result.size) { setState("idle"); setError("لم يتم حفظ فيديو. حاول التسجيل مجدداً."); return; }
        const recordedMs = Math.max(durationMs.current, elapsed.current.total, 1);
        setSeconds(Math.floor(recordedMs / 1000));
        void finalizeRecordingBlob(result, recordedMs).then((fixed) => {
          if (!valid()) return;
          setBlob(fixed);
          setState("preview");
          setLevel(0);
        });
      };
      // إنهاء المشاركة من شريط المتصفح ينهي التسجيل، أما انقطاع الصوت فلا يُفقد الفيديو.
      for (const track of display.getVideoTracks()) track.onended = stop;
      elapsed.current = { total: 0, since: Date.now() };
      durationMs.current = 0;
      recording.start(1000); setState("recording");
      interval.current = setInterval(() => {
        const ms = elapsed.current.total + (recording.state === "recording" ? Date.now() - elapsed.current.since : 0);
        if (valid()) setSeconds(Math.min(config.maxSeconds, Math.floor(ms / 1000)));
        if (ms >= config.maxSeconds * 1000 && recording.state !== "inactive") {
          if (valid()) setNotice(`بلغ التسجيل الحد الأقصى (${limitLabel(config.maxSeconds)})، والمقطع جاهز للمعاينة.`);
          stop();
        }
      }, CLOCK_TICK_MS);
      if (mix) {
        const samples = new Uint8Array(mix.analyser.frequencyBinCount);
        levelInterval.current = setInterval(() => {
          mix.analyser.getByteFrequencyData(samples);
          if (valid()) setLevel(Math.min(100, samples.reduce((a, b) => a + b, 0) / samples.length * 2));
        }, LEVEL_TICK_MS);
      }
    } catch (cause) {
      stopTracks();
      if (!valid()) return;
      setState("idle");
      const name = (cause as DOMException).name;
      setError(
        name === "NotAllowedError"
          ? config.microphone === "required"
            ? "لم تُمنح صلاحية الشاشة أو الميكروفون. اسمح بكليهما ثم أعد المحاولة."
            : "لم تُمنح صلاحية مشاركة الشاشة. اسمح بالمشاركة ثم أعد المحاولة."
          : name === "NotFoundError" ? "لم يُعثر على ميكروفون. وصّله ثم أعد المحاولة."
          : cause instanceof Error ? cause.message : "تعذر بدء التسجيل",
      );
    }
  }, [stop, stopTracks]);
  const togglePause = useCallback(() => {
    const current = recorder.current;
    if (current?.state === "recording") { elapsed.current.total += Date.now() - elapsed.current.since; current.pause(); setState("paused"); }
    else if (current?.state === "paused") { elapsed.current.since = Date.now(); current.resume(); setState("recording"); }
  }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; if (recorder.current) recorder.current.onstop = null; stop(); }; }, [stop]);
  useEffect(() => {
    if (state === "idle") return;
    const preventLoss = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", preventLoss);
    return () => window.removeEventListener("beforeunload", preventLoss);
  }, [state]);
  const remaining = Math.max(0, maxSeconds - seconds);
  return {
    state, blob, seconds, level, error, notice, audioEnabled, cameraEnabled, cameraPreview, cameraComposited,
    maxSeconds, remaining, countdown: state !== "idle" && state !== "preview" && remaining <= RECORDING_COUNTDOWN_SECONDS,
    start, stop, reset, togglePause,
  };
}
