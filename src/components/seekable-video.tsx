"use client";

import { forwardRef, useEffect, useRef, useState, type ForwardedRef, type VideoHTMLAttributes } from "react";
import { AlertCircle, Loader2, Maximize, Minimize, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";

function bindRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

type SeekableVideoProps = VideoHTMLAttributes<HTMLVideoElement> & { revealDuration?: boolean; fallbackSrc?: string };
type HlsInstance = import("hls.js").default;

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const value = Math.floor(seconds);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = String(value % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}` : `${minutes}:${remainder}`;
}

export const SeekableVideo = forwardRef<HTMLVideoElement, SeekableVideoProps>(function SeekableVideo(
  { src, onLoadedMetadata, onError, revealDuration = true, preload = "metadata", fallbackSrc, className, poster, ...props },
  forwarded,
) {
  const inner = useRef<HTMLVideoElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<HlsInstance | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const usedFallback = useRef(false);
  const playWhenReady = useRef(false);
  const [levels, setLevels] = useState<Array<{ height: number; bitrate: number }>>([]);
  const [usingHls, setUsingHls] = useState(false);
  const [activeLevel, setActiveLevel] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [retry, setRetry] = useState(0);
  const isHls = Boolean(src?.includes(".m3u8"));
  const arabic = props.lang !== "en";

  useEffect(() => {
    const node = inner.current;
    if (!node) return;
    bindRef(forwarded, node);
    return () => bindRef(forwarded, null);
  }, [forwarded]);

  useEffect(() => {
    const node = inner.current;
    if (!node || !src) return;
    let cancelled = false;
    let hls: HlsInstance | null = null;
    let networkFailures = 0;
    let mediaFailures = 0;
    let startupTimer: number | undefined;
    usedFallback.current = false;
    playWhenReady.current = false;
    setPlaying(false);
    setLoading(true);
    setError(false);
    setTime(0);
    setDuration(0);
    setLevels([]);
    setActiveLevel(-1);
    const resumeKey = `spark-video-position:${src}`;
    const resume = () => {
      try {
        const saved = Number(localStorage.getItem(resumeKey));
        if (Number.isFinite(saved) && saved > 0 && saved < node.duration - 2) node.currentTime = saved;
      } catch { /* storage can be disabled */ }
    };
    const savePosition = () => {
      if (node.currentTime > 1) {
        try { localStorage.setItem(resumeKey, String(Math.floor(node.currentTime))); } catch { /* storage can be disabled */ }
      }
    };
    node.addEventListener("loadedmetadata", resume);
    node.addEventListener("timeupdate", savePosition);

    const tryFallback = () => {
      if (!fallbackSrc || usedFallback.current || cancelled) return false;
      usedFallback.current = true;
      if (startupTimer) window.clearTimeout(startupTimer);
      hls?.destroy();
      hls = null;
      hlsRef.current = null;
      setLevels([]);
      setError(false);
      void attach(fallbackSrc).catch(() => {
        if (!cancelled) { setLoading(false); setError(true); onErrorRef.current?.(new Event("error") as never); }
      });
      return true;
    };
    const fail = (event: Event) => {
      if (tryFallback()) return;
      setLoading(false);
      setError(true);
      onErrorRef.current?.(event as never);
    };
    node.addEventListener("error", fail);

    const armStartupTimer = () => {
      if (startupTimer) window.clearTimeout(startupTimer);
      startupTimer = window.setTimeout(() => {
        if (!cancelled && (node.readyState < HTMLMediaElement.HAVE_METADATA ||
          (playWhenReady.current && node.readyState < HTMLMediaElement.HAVE_CURRENT_DATA))) fail(new Event("error"));
      }, fallbackSrc ? 10_000 : 20_000);
    };
    const watchStall = () => {
      if (node.paused && !playWhenReady.current) return;
      if (startupTimer) window.clearTimeout(startupTimer);
      startupTimer = window.setTimeout(() => {
        if (!cancelled && node.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) fail(new Event("error"));
      }, 12_000);
    };
    const clearStall = () => { if (startupTimer) window.clearTimeout(startupTimer); };
    node.addEventListener("waiting", watchStall);
    node.addEventListener("playing", clearStall);

    const attach = async (source: string) => {
      const hlsSource = source.includes(".m3u8");
      setUsingHls(hlsSource);
      setLoading(true);
      if (!hlsSource) {
        node.src = source;
        node.load();
        armStartupTimer();
        return;
      }
      if (node.canPlayType("application/vnd.apple.mpegurl")) {
        node.src = source;
        node.load();
        armStartupTimer();
        return;
      }
      const Hls = (await import("hls.js")).default;
      if (cancelled || (usedFallback.current && source === src)) return;
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, lowLatencyMode: false, backBufferLength: 90, startLevel: 0 });
        hlsRef.current = hls;
        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          if (cancelled) return;
          networkFailures = 0;
          const available = data.levels.map((level) => ({ height: level.height, bitrate: level.bitrate }));
          setLevels(available);
        });
        hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => setActiveLevel(data.level));
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && ++networkFailures <= 2) hls?.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && ++mediaFailures <= 1) hls?.recoverMediaError();
          else fail(new Event("error"));
        });
        hls.loadSource(source);
        hls.attachMedia(node);
      } else {
        fail(new Event("error"));
        return;
      }
      armStartupTimer();
    };
    void attach(src).catch(() => { if (!cancelled) fail(new Event("error")); });

    return () => {
      cancelled = true;
      if (startupTimer) window.clearTimeout(startupTimer);
      node.removeEventListener("loadedmetadata", resume);
      node.removeEventListener("timeupdate", savePosition);
      node.removeEventListener("error", fail);
      node.removeEventListener("waiting", watchStall);
      node.removeEventListener("playing", clearStall);
      hls?.destroy();
      hlsRef.current = null;
      node.removeAttribute("src");
      node.load();
    };
  }, [src, fallbackSrc, isHls, retry]);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  useEffect(() => {
    const node = inner.current;
    if (!node || !src || !revealDuration || isHls) return;
    let cancelled = false;
    const revealFullDuration = () => {
      if (cancelled || (Number.isFinite(node.duration) && node.duration > 0)) return;
      const restore = () => {
        node.removeEventListener("timeupdate", restore);
        node.removeEventListener("seeked", restore);
        if (!cancelled) node.currentTime = 0;
      };
      node.addEventListener("timeupdate", restore);
      node.addEventListener("seeked", restore);
      try { node.currentTime = 1e16; } catch { restore(); }
    };
    node.addEventListener("loadedmetadata", revealFullDuration);
    if (node.readyState >= 1) revealFullDuration();
    return () => {
      cancelled = true;
      node.removeEventListener("loadedmetadata", revealFullDuration);
    };
  }, [src, revealDuration, isHls]);

  const handleQuality = (value: string) => {
    const level = Number(value);
    setActiveLevel(level);
    if (hlsRef.current) hlsRef.current.currentLevel = level;
  };

  const togglePlayback = () => {
    const node = inner.current;
    if (!node) return;
    if (!node.paused) { playWhenReady.current = false; node.pause(); return; }
    playWhenReady.current = true;
    setLoading(true);
    void node.play().catch(() => {
      if (node.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        playWhenReady.current = false;
        setLoading(false);
        setError(true);
      }
    });
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (container.current?.requestFullscreen) await container.current.requestFullscreen();
    else (inner.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null)?.webkitEnterFullscreen?.();
  };

  return (
    <div ref={container} className={`relative aspect-video overflow-hidden bg-slate-950 fullscreen:aspect-auto fullscreen:h-screen fullscreen:max-h-none fullscreen:w-screen ${className ?? ""}`}>
      <video
        {...props}
        ref={inner}
        className="absolute inset-0 h-full w-full object-contain"
        poster={poster}
        controls={false}
        playsInline
        preload={preload}
        onLoadedMetadata={(event) => { setDuration(event.currentTarget.duration); setLoading(false); onLoadedMetadata?.(event); }}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onPlay={() => { setPlaying(true); setError(false); }}
        onPause={() => setPlaying(false)}
        onPlaying={() => { setLoading(false); playWhenReady.current = false; }}
        onWaiting={() => setLoading(true)}
        onCanPlay={() => { if (playWhenReady.current) void inner.current?.play().catch(() => undefined); else setLoading(false); }}
        onEnded={() => { setPlaying(false); playWhenReady.current = false; }}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        onRateChange={(event) => setRate(event.currentTarget.playbackRate)}
        onClick={togglePlayback}
      />
      {loading && !error ? <Loader2 className="pointer-events-none absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 animate-spin text-white/80" aria-hidden="true" /> : null}
      {error ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-slate-950/85 px-4 text-center text-sm text-white">
          <AlertCircle className="h-7 w-7" aria-hidden="true" />
          <span>{arabic ? "تعذر تشغيل الفيديو. حاول مرة أخرى." : "Could not play this video. Try again."}</span>
          <button type="button" className="inline-flex items-center gap-1 rounded-md bg-white px-3 py-1.5 text-slate-950" onClick={() => setRetry((value) => value + 1)}><RotateCcw className="h-4 w-4" />{arabic ? "إعادة المحاولة" : "Retry"}</button>
        </div>
      ) : null}
      {usingHls && levels.length > 1 ? (
        <label className="absolute end-3 top-3 z-10 rounded-md bg-black/75 px-2 py-1 text-xs text-white">
          <span className="sr-only">Video quality</span>
          <select className="bg-transparent outline-none" value={activeLevel} onChange={(event) => handleQuality(event.target.value)}>
            <option value={-1}>Auto</option>
            {levels.map((level, index) => <option key={`${level.height}-${index}`} value={index}>{level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)} kbps`}</option>)}
          </select>
        </label>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 z-20 space-y-1 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-2 pb-2 pt-5 text-white" dir="ltr">
        <input
          type="range" min={0} max={Number.isFinite(duration) && duration > 0 ? duration : 1} step={0.1}
          value={Number.isFinite(time) ? Math.min(time, Number.isFinite(duration) && duration > 0 ? duration : 1) : 0}
          disabled={!Number.isFinite(duration) || duration <= 0}
          onChange={(event) => { if (inner.current) inner.current.currentTime = Number(event.target.value); }}
          aria-label={arabic ? "موضع التشغيل" : "Seek"}
          className="h-2 w-full cursor-pointer accent-violet-400 disabled:cursor-not-allowed"
        />
        <div className="flex items-center gap-2 text-xs tabular-nums">
          <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-white/20" onClick={togglePlayback} aria-label={playing ? (arabic ? "إيقاف مؤقت" : "Pause") : (arabic ? "تشغيل" : "Play")}>
            {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}
          </button>
          <span className="whitespace-nowrap">{clock(time)} / {clock(duration)}</span>
          <div className="flex-1" />
          <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-white/20" onClick={() => { if (inner.current) inner.current.muted = !inner.current.muted; }} aria-label={muted ? (arabic ? "تشغيل الصوت" : "Unmute") : (arabic ? "كتم الصوت" : "Mute")}>
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button type="button" className="h-8 rounded px-1.5 hover:bg-white/20" onClick={() => { if (inner.current) inner.current.playbackRate = rate === 1 ? 1.25 : rate === 1.25 ? 1.5 : rate === 1.5 ? 2 : 1; }} aria-label={arabic ? "سرعة التشغيل" : "Playback speed"}>{rate}×</button>
          <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center rounded hover:bg-white/20" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? (arabic ? "الخروج من ملء الشاشة" : "Exit fullscreen") : (arabic ? "ملء الشاشة" : "Fullscreen")}>
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
});

SeekableVideo.displayName = "SeekableVideo";
