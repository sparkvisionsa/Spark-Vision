"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  BadgeCheck,
  Check,
  ChevronLeft,
  Clapperboard,
  Clock3,
  Expand,
  Gauge,
  LibraryBig,
  ListVideo,
  MonitorUp,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Search,
  ChevronDown,
  Shrink,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useHelperToolsNav } from "@/components/helper-tools-shell";
import {
  TRAINING_VIDEOS,
  TRAINING_VIDEO_TOTAL_SECONDS,
  type TrainingVideo,
} from "@/lib/training-video-library";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "spark-vision:tutorial-library:progress:v1";

type StoredProgress = {
  lastId?: string;
  positions: Record<string, number>;
  completed: string[];
};

const EMPTY_PROGRESS: StoredProgress = { positions: {}, completed: [] };

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const seconds = Math.floor(value % 60);
  const minutes = Math.floor(value / 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function videoText(video: TrainingVideo, isArabic: boolean) {
  return {
    title: isArabic ? video.title.ar : video.title.en,
    description: isArabic ? video.description.ar : video.description.en,
    category: isArabic ? video.category.ar : video.category.en,
  };
}

function readStoredProgress(): StoredProgress {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null") as Partial<StoredProgress> | null;
    return {
      lastId: parsed?.lastId,
      positions: parsed?.positions && typeof parsed.positions === "object" ? parsed.positions : {},
      completed: Array.isArray(parsed?.completed) ? parsed.completed : [],
    };
  } catch {
    return { ...EMPTY_PROGRESS };
  }
}

export default function HelperVideoLibrary() {
  const { isArabic } = useHelperToolsNav();
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<StoredProgress>({ ...EMPTY_PROGRESS });
  const lastSavedSecond = useRef(0);
  const shouldAutoplay = useRef(false);

  const [selectedId, setSelectedId] = useState(TRAINING_VIDEOS[0].id);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(TRAINING_VIDEOS[0].seconds);
  const [fullscreen, setFullscreen] = useState(false);
  const [theater, setTheater] = useState(false);
  const [positions, setPositions] = useState<Record<string, number>>({});
  const [completed, setCompleted] = useState<string[]>([]);

  const copy = isArabic
    ? {
        eyebrow: "أكاديمية فاليو تك",
        title: "مكتبة الشرح",
        intro: "شروحات قصيرة وواضحة من داخل النظام، مرتبة لتأخذك من البداية حتى إخراج التقرير النهائي.",
        videos: "فيديو تدريبي",
        total: "مدة تعليمية",
        search: "ابحث باسم الشرح أو محتواه...",
        category: "نوع الشرح",
        all: "الكل",
        playlist: "قائمة الشروحات",
        lesson: "الدرس",
        watched: "تمت المشاهدة",
        continue: "متابعة المشاهدة",
        play: "تشغيل الفيديو",
        pause: "إيقاف مؤقت",
        mute: "كتم الصوت",
        unmute: "تشغيل الصوت",
        backward: "الرجوع 10 ثوانٍ",
        forward: "التقدم 10 ثوانٍ",
        fullscreen: "ملء الشاشة",
        exitFullscreen: "الخروج من ملء الشاشة",
        theater: "الوضع السينمائي",
        speed: "السرعة",
        next: "الشرح التالي",
        noResults: "لا توجد شروحات مطابقة لبحثك.",
        clear: "مسح البحث",
        hint: "اختصارات المشغّل: مسافة للتشغيل، والأسهم للتقديم والترجيع، و M للصوت.",
      }
    : {
        eyebrow: "Value Tech Academy",
        title: "Tutorial library",
        intro: "Short, focused walkthroughs recorded inside the system, from first steps to final report export.",
        videos: "training videos",
        total: "learning time",
        search: "Search tutorials and topics...",
        category: "Tutorial category",
        all: "All",
        playlist: "Tutorial playlist",
        lesson: "Lesson",
        watched: "Watched",
        continue: "Continue watching",
        play: "Play video",
        pause: "Pause",
        mute: "Mute",
        unmute: "Unmute",
        backward: "Back 10 seconds",
        forward: "Forward 10 seconds",
        fullscreen: "Full screen",
        exitFullscreen: "Exit full screen",
        theater: "Theater mode",
        speed: "Speed",
        next: "Next tutorial",
        noResults: "No tutorials match your search.",
        clear: "Clear search",
        hint: "Player shortcuts: Space to play, arrows to seek, and M to mute.",
      };

  useEffect(() => {
    const stored = readStoredProgress();
    progressRef.current = stored;
    setPositions(stored.positions);
    setCompleted(stored.completed);
    if (stored.lastId && TRAINING_VIDEOS.some((item) => item.id === stored.lastId)) {
      setSelectedId(stored.lastId);
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => setFullscreen(document.fullscreenElement === playerRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const selected = TRAINING_VIDEOS.find((item) => item.id === selectedId) ?? TRAINING_VIDEOS[0];
  const selectedText = videoText(selected, isArabic);
  const selectedIndex = TRAINING_VIDEOS.findIndex((item) => item.id === selected.id);
  const nextVideo = TRAINING_VIDEOS[(selectedIndex + 1) % TRAINING_VIDEOS.length];

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    TRAINING_VIDEOS.forEach((item) => seen.set(item.category.en, isArabic ? item.category.ar : item.category.en));
    return Array.from(seen.entries());
  }, [isArabic]);

  const filteredVideos = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return TRAINING_VIDEOS.filter((item) => {
      if (category !== "all" && item.category.en !== category) return false;
      if (!needle) return true;
      const searchable = [item.title.ar, item.title.en, item.description.ar, item.description.en, item.category.ar, item.category.en]
        .join(" ")
        .toLocaleLowerCase();
      return searchable.includes(needle);
    });
  }, [category, query]);

  const persist = (id: string, position: number, markComplete = false) => {
    const previous = progressRef.current;
    const completedSet = new Set(previous.completed);
    if (markComplete) completedSet.add(id);
    const next: StoredProgress = {
      lastId: id,
      positions: { ...previous.positions, [id]: Math.max(0, position) },
      completed: Array.from(completedSet),
    };
    progressRef.current = next;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setPositions(next.positions);
    setCompleted(next.completed);
  };

  const selectVideo = (id: string, autoplay = true) => {
    if (id === selectedId) {
      if (autoplay) void videoRef.current?.play();
      return;
    }
    shouldAutoplay.current = autoplay;
    setPlaying(false);
    setCurrentTime(0);
    setSelectedId(id);
    progressRef.current = { ...progressRef.current, lastId: id };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progressRef.current));
  };

  const togglePlayback = () => {
    const player = videoRef.current;
    if (!player) return;
    if (player.paused) void player.play();
    else player.pause();
  };

  const seekBy = (seconds: number) => {
    const player = videoRef.current;
    if (!player) return;
    player.currentTime = Math.min(Math.max(player.currentTime + seconds, 0), player.duration || selected.seconds);
    setCurrentTime(player.currentTime);
  };

  const toggleMute = () => {
    const player = videoRef.current;
    if (!player) return;
    player.muted = !player.muted;
    setMuted(player.muted);
  };

  const toggleFullscreen = async () => {
    if (!playerRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await playerRef.current.requestFullscreen();
  };

  const handleKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "BUTTON") return;
    const key = event.key.toLocaleLowerCase();
    if (key === " " || key === "k") {
      event.preventDefault();
      togglePlayback();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      seekBy(-10);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      seekBy(10);
    } else if (key === "m") {
      toggleMute();
    } else if (key === "f") {
      void toggleFullscreen();
    }
  };

  return (
    <main className="min-h-full overflow-hidden p-2 sm:p-3" dir={isArabic ? "rtl" : "ltr"}>
      <section className="relative overflow-hidden rounded-2xl bg-[radial-gradient(circle_at_8%_0%,rgba(34,211,238,0.18),transparent_28%),linear-gradient(115deg,#071426_0%,#0b1d35_58%,#102944_100%)] px-4 py-3 text-white shadow-[0_10px_28px_rgba(15,23,42,0.12)] sm:px-5 sm:py-3.5">
        <div className="pointer-events-none absolute -end-10 -top-20 h-44 w-44 rounded-full border border-cyan-200/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-950 shadow-md shadow-amber-500/15">
              <LibraryBig className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-bold text-cyan-200"><Sparkles className="h-3 w-3" aria-hidden />{copy.eyebrow}</div>
              <h1 className="text-lg font-black leading-tight tracking-tight sm:text-xl">{copy.title}</h1>
              <p className="mt-0.5 max-w-2xl text-[11px] leading-5 text-slate-300 sm:text-xs">{copy.intro}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-1.5">
              <p className="text-lg font-black leading-5 text-white">{TRAINING_VIDEOS.length}<span className="ms-1.5 text-[10px] font-semibold text-slate-400">{copy.videos}</span></p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-1.5">
              <p className="text-lg font-black leading-5 text-amber-300">{formatTime(TRAINING_VIDEO_TOTAL_SECONDS)}<span className="ms-1.5 text-[10px] font-semibold text-slate-400">{copy.total}</span></p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.search}
              className="h-10 w-full rounded-xl border border-slate-200/80 bg-white pe-10 ps-10 text-xs font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} className="absolute end-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700" aria-label={copy.clear}>
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </label>
          <label className="relative block shrink-0 sm:w-64">
            <span className="sr-only">{copy.category}</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 w-full appearance-none rounded-xl border border-slate-200/80 bg-white px-3 pe-9 text-xs font-bold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100">
              <option value="all">{copy.all}</option>
              {categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          </label>
      </section>

      <section className={cn("mt-2 grid items-start gap-2 transition-all", theater ? "grid-cols-1" : "lg:grid-cols-[minmax(0,1.75fr)_minmax(19rem,0.75fr)]")}>
        <div className="min-w-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div
            ref={playerRef}
            tabIndex={0}
            onKeyDown={handleKeyboard}
            className="group relative aspect-video overflow-hidden rounded-2xl bg-black shadow-[0_24px_60px_rgba(2,6,23,0.28)] outline-none ring-cyan-400 transition focus-visible:ring-2"
          >
            <video
              key={selected.id}
              ref={videoRef}
              src={selected.src}
              poster={selected.thumbnail}
              preload="metadata"
              playsInline
              className="h-full w-full cursor-pointer object-contain"
              onClick={togglePlayback}
              onDoubleClick={() => void toggleFullscreen()}
              onLoadedMetadata={(event) => {
                const player = event.currentTarget;
                const actualDuration = Number.isFinite(player.duration) ? player.duration : selected.seconds;
                setDuration(actualDuration);
                player.playbackRate = rate;
                player.muted = muted;
                const saved = progressRef.current.positions[selected.id] ?? 0;
                if (saved > 2 && saved < actualDuration - 3) {
                  player.currentTime = saved;
                  setCurrentTime(saved);
                }
                lastSavedSecond.current = saved;
                if (shouldAutoplay.current) {
                  shouldAutoplay.current = false;
                  void player.play();
                }
              }}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(event) => {
                const time = event.currentTarget.currentTime;
                setCurrentTime(time);
                if (Math.abs(time - lastSavedSecond.current) >= 4) {
                  lastSavedSecond.current = time;
                  persist(selected.id, time, time / Math.max(event.currentTarget.duration, 1) >= 0.92);
                }
              }}
              onEnded={() => {
                persist(selected.id, duration, true);
                selectVideo(nextVideo.id, true);
              }}
            />

            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent p-4 pb-10 text-white">
              <span className="rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[10px] font-bold backdrop-blur">
                {copy.lesson} {String(selected.order).padStart(2, "0")}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-[10px] font-bold backdrop-blur">
                <BadgeCheck className="h-3.5 w-3.5 text-cyan-300" /> Value Tech
              </span>
            </div>

            {!playing ? (
              <button type="button" onClick={togglePlayback} aria-label={copy.play} className="absolute start-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-white/95 text-slate-950 shadow-2xl transition hover:scale-110 active:scale-95 rtl:translate-x-1/2">
                <Play className="h-7 w-7 fill-current" aria-hidden />
              </button>
            ) : null}

            <div className={cn("absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/65 to-transparent px-3 pb-3 pt-16 text-white transition-opacity duration-200 sm:px-4", playing ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" : "opacity-100")}>
              <input
                type="range"
                min={0}
                max={duration || selected.seconds}
                step={0.1}
                value={Math.min(currentTime, duration || selected.seconds)}
                onChange={(event) => {
                  const time = Number(event.target.value);
                  if (videoRef.current) videoRef.current.currentTime = time;
                  setCurrentTime(time);
                }}
                aria-label={isArabic ? "موضع الفيديو" : "Video position"}
                className="h-1.5 w-full cursor-pointer accent-rose-500"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 sm:gap-2">
                  <button type="button" onClick={togglePlayback} className="rounded-lg p-1.5 hover:bg-white/15" aria-label={playing ? copy.pause : copy.play}>{playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current" />}</button>
                  <button type="button" onClick={() => seekBy(-10)} className="hidden rounded-lg p-1.5 hover:bg-white/15 sm:block" aria-label={copy.backward}><RotateCcw className="h-4 w-4" /></button>
                  <button type="button" onClick={() => seekBy(10)} className="hidden rounded-lg p-1.5 hover:bg-white/15 sm:block" aria-label={copy.forward}><RotateCw className="h-4 w-4" /></button>
                  <button type="button" onClick={toggleMute} className="rounded-lg p-1.5 hover:bg-white/15" aria-label={muted ? copy.unmute : copy.mute}>{muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button>
                  <span className="whitespace-nowrap text-[10px] font-semibold tabular-nums text-slate-200 sm:text-xs">{formatTime(currentTime)} / {formatTime(duration)}</span>
                </div>
                <div className="flex items-center gap-1 sm:gap-2">
                  <label className="hidden items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold sm:flex">
                    <Gauge className="h-3.5 w-3.5" />
                    <span className="sr-only">{copy.speed}</span>
                    <select value={rate} onChange={(event) => { const value = Number(event.target.value); setRate(value); if (videoRef.current) videoRef.current.playbackRate = value; }} className="bg-transparent text-white outline-none [&>option]:text-slate-900">
                      {[0.75, 1, 1.25, 1.5, 2].map((value) => <option key={value} value={value}>{value}x</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={() => setTheater((value) => !value)} className="hidden rounded-lg p-1.5 hover:bg-white/15 lg:block" aria-label={copy.theater}><MonitorUp className="h-5 w-5" /></button>
                  <button type="button" onClick={() => void toggleFullscreen()} className="rounded-lg p-1.5 hover:bg-white/15" aria-label={fullscreen ? copy.exitFullscreen : copy.fullscreen}>{fullscreen ? <Shrink className="h-5 w-5" /> : <Expand className="h-5 w-5" />}</button>
                </div>
              </div>
            </div>
          </div>

          <article className="mt-2 rounded-xl bg-white p-3 shadow-sm sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                  <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-cyan-800">{selectedText.category}</span>
                  <span className="flex items-center gap-1 text-slate-400"><Clock3 className="h-3.5 w-3.5" />{selected.duration}</span>
                  {completed.includes(selected.id) ? <span className="flex items-center gap-1 text-emerald-600"><Check className="h-3.5 w-3.5" />{copy.watched}</span> : null}
                </div>
                <h2 className="mt-2 text-lg font-black leading-7 text-slate-950 sm:text-xl">{selectedText.title}</h2>
                <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-600 sm:text-sm">{selectedText.description}</p>
              </div>
              <button type="button" onClick={() => selectVideo(nextVideo.id, true)} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:bg-cyan-900">
                {copy.next}
                <ChevronLeft className={cn("h-4 w-4", !isArabic && "rotate-180")} />
              </button>
            </div>
            <p className="mt-2 text-[10px] font-medium text-slate-400">{copy.hint}</p>
          </article>
        </div>

        <aside className={cn("overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm", theater && "max-h-[32rem]")}>
          <div className="flex items-center justify-between bg-slate-950 px-3 py-2.5 text-white">
            <div className="flex items-center gap-2">
              <ListVideo className="h-4 w-4 text-cyan-300" />
              <h2 className="text-xs font-black">{copy.playlist}</h2>
            </div>
            <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-slate-300">{filteredVideos.length}/{TRAINING_VIDEOS.length}</span>
          </div>
          <div className={cn("space-y-1 overflow-y-auto p-1.5", theater ? "max-h-[27rem]" : "max-h-[min(63vh,42rem)]")}>
            {filteredVideos.map((item) => {
              const text = videoText(item, isArabic);
              const active = item.id === selected.id;
              const isComplete = completed.includes(item.id);
              const percent = isComplete ? 100 : Math.min(100, ((positions[item.id] ?? 0) / item.seconds) * 100);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectVideo(item.id, true)}
                  className={cn("group/card flex w-full gap-2 rounded-lg p-1.5 text-start transition", active ? "bg-cyan-50 ring-1 ring-cyan-200" : "hover:bg-slate-50")}
                >
                  <span className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md bg-slate-900 sm:w-28">
                    <img src={item.thumbnail} alt="" className="h-full w-full object-cover transition duration-500 group-hover/card:scale-105" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                    <span className="absolute bottom-1 end-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-white">{item.duration}</span>
                    <span className={cn("absolute start-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full backdrop-blur", active ? "bg-rose-500 text-white" : "bg-black/55 text-white opacity-0 transition group-hover/card:opacity-100")}>
                      {active && playing ? <Pause className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
                    </span>
                    {percent > 0 ? <span className="absolute inset-x-0 bottom-0 h-1 bg-black/30"><span className={cn("block h-full", isComplete ? "bg-emerald-400" : "bg-rose-500")} style={{ width: `${percent}%` }} /></span> : null}
                  </span>
                  <span className="min-w-0 flex-1 py-0.5">
                    <span className={cn("line-clamp-2 text-[11px] font-black leading-5 sm:text-xs", active ? "text-cyan-950" : "text-slate-900")}>{text.title}</span>
                    <span className="mt-1 flex items-center justify-between gap-2 text-[9px] font-semibold text-slate-400">
                      <span className="truncate">{text.category}</span>
                      {isComplete ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <span className="shrink-0 tabular-nums">{String(item.order).padStart(2, "0")}</span>}
                    </span>
                    {percent > 3 && !isComplete ? <span className="mt-1 block text-[9px] font-bold text-rose-500">{copy.continue} · {Math.round(percent)}%</span> : null}
                  </span>
                </button>
              );
            })}
            {!filteredVideos.length ? (
              <div className="flex min-h-56 flex-col items-center justify-center px-4 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"><Clapperboard className="h-6 w-6" /></span>
                <p className="mt-3 text-xs font-bold text-slate-600">{copy.noResults}</p>
                <button type="button" onClick={() => { setQuery(""); setCategory("all"); }} className="mt-3 text-[11px] font-bold text-cyan-700 hover:underline">{copy.clear}</button>
              </div>
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
