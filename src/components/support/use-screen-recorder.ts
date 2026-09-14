"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderState = "idle" | "starting" | "recording" | "paused" | "preview";
export const RECORDING_MAX_SECONDS = 300;
export const RECORDING_MAX_BYTES = 90 * 1024 * 1024;
export function recordingMime() {
  return ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(type => MediaRecorder.isTypeSupported(type)) ?? "";
}
export function useScreenRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState("");
  const streams = useRef<MediaStream[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const interval = useRef<ReturnType<typeof setInterval>>();
  const levelInterval = useRef<ReturnType<typeof setInterval>>();
  const generation = useRef(0);
  const mounted = useRef(true);
  const elapsed = useRef({ total: 0, since: 0 });
  const stopTracks = useCallback(() => {
    streams.current.forEach(s => s.getTracks().forEach(t => { t.onended = null; t.stop(); }));
    streams.current = [];
    if (interval.current) clearInterval(interval.current);
    if (levelInterval.current) clearInterval(levelInterval.current);
    if (audioContext.current) void audioContext.current.close().catch(() => {});
    audioContext.current = null;
  }, []);
  const stop = useCallback(() => {
    if (recorder.current && recorder.current.state !== "inactive") recorder.current.stop();
    stopTracks();
  }, [stopTracks]);
  const reset = useCallback(() => {
    generation.current++;
    if (recorder.current) recorder.current.onstop = null;
    stop(); setBlob(null); setSeconds(0); setLevel(0); setState("idle"); setError("");
  }, [stop]);
  const start = useCallback(async () => {
    if (recorder.current?.state === "recording" || recorder.current?.state === "paused") return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === "undefined") {
      setError("تسجيل الشاشة يحتاج متصفح سطح مكتب يدعم المشاركة واتصال HTTPS أو localhost."); return;
    }
    const attempt = ++generation.current;
    const valid = () => mounted.current && generation.current === attempt;
    setState("starting"); setError(""); setBlob(null); setSeconds(0);
    try {
      // Must remain directly connected to the user's click (transient activation).
      const display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 20 }, width: { ideal: 1920 }, height: { ideal: 1080 }, displaySurface: "browser" }, audio: false, preferCurrentTab: true } as DisplayMediaStreamOptions);
      if (!valid()) { display.getTracks().forEach(t => t.stop()); return; }
      streams.current.push(display);
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (!valid()) { microphone.getTracks().forEach(t => t.stop()); stopTracks(); return; }
      streams.current.push(microphone);
      if (display.getVideoTracks()[0]?.readyState !== "live") throw new Error("انتهت مشاركة الشاشة؛ ابدأ التسجيل مجدداً.");
      const mixed = new MediaStream([...display.getVideoTracks(), ...microphone.getAudioTracks()]);
      const mimeType = recordingMime();
      const recording = new MediaRecorder(mixed, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 1_500_000, audioBitsPerSecond: 64_000 });
      recorder.current = recording;
      const chunks: Blob[] = [];
      let bytes = 0;
      recording.ondataavailable = event => {
        if (event.data.size) { chunks.push(event.data); bytes += event.data.size; }
        if (bytes >= RECORDING_MAX_BYTES && recording.state !== "inactive") { setError("وصل التسجيل إلى الحد الأقصى للحجم؛ يمكنك معاينته وإرساله الآن."); stop(); }
      };
      recording.onerror = () => { if (valid()) setError("تعذر إكمال التسجيل؛ راجع الجزء المسجّل قبل الإرسال."); stop(); };
      recording.onstop = () => {
        stopTracks();
        if (!valid()) return;
        const result = new Blob(chunks, { type: recording.mimeType || mimeType || "video/webm" });
        if (!result.size) { setState("idle"); setError("لم يتم حفظ فيديو. حاول التسجيل مجدداً."); return; }
        setBlob(result); setState("preview"); setLevel(0);
      };
      for (const track of mixed.getTracks()) track.onended = stop;
      elapsed.current = { total: 0, since: Date.now() };
      recording.start(1000); setState("recording");
      interval.current = setInterval(() => {
        const ms = elapsed.current.total + (recording.state === "recording" ? Date.now() - elapsed.current.since : 0);
        if (valid()) setSeconds(Math.floor(ms / 1000));
        if (ms >= RECORDING_MAX_SECONDS * 1000) stop();
      }, 500);
      // Audio meter is optional. Failure must not stop an otherwise valid recording.
      try {
        const context = new AudioContext(); audioContext.current = context;
        await context.resume();
        if (!valid() || recording.state === "inactive") { void context.close(); return; }
        const analyser = context.createAnalyser(); analyser.fftSize = 256;
        context.createMediaStreamSource(microphone).connect(analyser);
        const samples = new Uint8Array(analyser.frequencyBinCount);
        levelInterval.current = setInterval(() => {
          analyser.getByteFrequencyData(samples);
          if (valid()) setLevel(Math.min(100, samples.reduce((a, b) => a + b, 0) / samples.length * 2));
        }, 200);
      } catch { /* no meter on browsers without AudioContext */ }
    } catch (cause) {
      stopTracks();
      if (!valid()) return;
      setState("idle");
      const name = (cause as DOMException).name;
      setError(name === "NotAllowedError" ? "لم تُمنح صلاحية الشاشة أو الميكروفون. اسمح بكليهما ثم أعد المحاولة." : name === "NotFoundError" ? "لم يُعثر على ميكروفون. وصّله ثم أعد المحاولة." : cause instanceof Error ? cause.message : "تعذر بدء التسجيل");
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
  return { state, blob, seconds, level, error, start, stop, reset, togglePause };
}
