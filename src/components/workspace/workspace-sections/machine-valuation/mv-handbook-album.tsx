"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type Ref } from "react";
import { ChevronLeft, ChevronRight, ZoomIn } from "lucide-react";
import type { HandbookPage, HandbookSpot } from "./mv-handbook-content";
import styles from "./mv-handbook.module.css";

const number = (value: number) => value.toLocaleString("ar-SA");

function focusVars(spot: HandbookSpot | null) {
  if (!spot) return { "--zoom": "1", "--cx": "50", "--cy": "50" } as CSSProperties;
  const centerX = spot.x + spot.w / 2;
  const centerY = spot.y + spot.h / 2;
  const zoom = Math.min(2.65, Math.max(1.4, Math.min(54 / spot.w, 44 / spot.h)));
  return { "--zoom": String(zoom), "--cx": String(centerX), "--cy": String(centerY) } as CSSProperties;
}

export function HandbookShot({
  image,
  alt,
  spots = [],
  activeSpot,
  interactive = true,
  zoomed = false,
  onSpot,
  onError,
}: {
  image: string;
  alt: string;
  spots?: HandbookSpot[];
  activeSpot?: string | null;
  interactive?: boolean;
  zoomed?: boolean;
  onSpot?: (id: string) => void;
  onError?: () => void;
}) {
  const visible = zoomed ? spots.filter(spot => spot.id === activeSpot) : spots;
  return <div className={styles.shot} data-zoomed={zoomed ? "true" : undefined}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={`/mv-handbook/${image}.jpg`} alt={alt} width={1440} height={810} draggable={false} onError={onError} />
    {visible.map(spot => {
      const active = spot.id === activeSpot;
      const style = { left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.w}%`, height: `${spot.h}%` };
      if (!interactive) return <span key={spot.id} className={styles.hotspot} data-active={active ? "true" : undefined} style={style} />;
      return <button
        key={spot.id}
        type="button"
        className={styles.hotspot}
        data-handbook-spot={spot.id}
        data-active={active ? "true" : undefined}
        style={style}
        aria-label={`تمييز «${spot.label}»`}
        aria-pressed={active}
        onClick={event => { event.stopPropagation(); onSpot?.(spot.id); }}
      >
        {active && <span className={styles.hotspotLabel}>{spot.label}</span>}
      </button>;
    })}
  </div>;
}

export function HandbookAlbum({
  page,
  failed,
  activeSpot,
  onActiveSpot,
  onZoom,
  onImageError,
  onRetry,
  zoomButtonRef,
}: {
  page: HandbookPage;
  failed: boolean;
  activeSpot: string | null;
  onActiveSpot: (id: string | null) => void;
  onZoom: () => void;
  onImageError: () => void;
  onRetry: () => void;
  zoomButtonRef?: Ref<HTMLButtonElement>;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const frames = useMemo(() => {
    const list: { id: string; spot: HandbookSpot | null; label: string }[] = [{ id: "overview", spot: null, label: "الشاشة كاملة" }];
    const seen = new Set<string>();
    for (const step of page.steps) {
      if (!step.spot || seen.has(step.spot)) continue;
      const spot = page.spots?.find(item => item.id === step.spot);
      if (!spot) continue;
      seen.add(step.spot);
      list.push({ id: spot.id, spot, label: spot.label });
    }
    return list;
  }, [page]);
  const [frame, setFrame] = useState(0);
  const activeLabel = page.spots?.find(spot => spot.id === activeSpot)?.label;

  useEffect(() => {
    const next = Math.max(0, frames.findIndex(item => item.id === (activeSpot ?? "overview")));
    setFrame(next);
    const root = scroller.current;
    const target = root?.querySelector<HTMLElement>(`[data-frame="${activeSpot ?? "overview"}"]`);
    if (!root || !target) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const left = target.getBoundingClientRect().left - root.getBoundingClientRect().left + root.scrollLeft;
    lock.current = true;
    root.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
    const timer = window.setTimeout(() => { lock.current = false; }, reduce ? 40 : 420);
    return () => window.clearTimeout(timer);
  }, [activeSpot, frames, page.id]);

  function showFrame(next: number) {
    const frameItem = frames[Math.max(0, Math.min(frames.length - 1, next))];
    if (!frameItem) return;
    onActiveSpot(frameItem.spot?.id ?? null);
  }

  if (failed || !page.image) {
    return <div className={styles.imageFallback} role="status"><p>تعذر تحميل اللقطة. يمكنكم متابعة الخطوات المكتوبة.</p><button type="button" className={styles.previous} onClick={onRetry}>إعادة تحميل اللقطة</button></div>;
  }

  return <div className={styles.albumWrap} data-handbook-album>
    <div className={styles.albumBar}>
      <span>ألبوم اللقطة</span>
      <strong>{number(frame + 1)} / {number(frames.length)}</strong>
      <button type="button" aria-label="الإطار السابق في الألبوم" disabled={frame === 0} onClick={() => showFrame(frame - 1)}><ChevronLeft size={15} aria-hidden="true" /></button>
      <button type="button" aria-label="الإطار التالي في الألبوم" disabled={frame === frames.length - 1} onClick={() => showFrame(frame + 1)}><ChevronRight size={15} aria-hidden="true" /></button>
    </div>
    <div
      ref={scroller}
      className={styles.album}
      dir="ltr"
      tabIndex={0}
      role="region"
      aria-label="ألبوم لقطات الصفحة"
      onScroll={() => {
        if (lock.current) return;
        const root = scroller.current;
        if (!root || root.clientWidth === 0) return;
        const index = Math.max(0, Math.min(frames.length - 1, Math.round(root.scrollLeft / root.clientWidth)));
        if (index === frame) return;
        setFrame(index);
        onActiveSpot(frames[index]?.spot?.id ?? null);
      }}
      onKeyDown={event => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        event.stopPropagation();
        showFrame(frame + (event.key === "ArrowRight" ? 1 : -1));
      }}
    >
      {frames.map(item => <div key={item.id} className={styles.albumFrame} data-frame={item.id}>
        <div className={styles.frameViewport}>
          <div className={styles.frameStage} style={focusVars(item.spot)}>
            <HandbookShot
              image={page.image!}
              alt={item.spot ? `موضع «${item.spot.label}» — ${page.caption ?? page.title}` : page.caption ?? page.title}
              spots={item.spot ? [item.spot] : page.spots}
              activeSpot={item.spot?.id ?? activeSpot}
              zoomed={Boolean(item.spot)}
              onSpot={onActiveSpot}
              onError={onImageError}
            />
          </div>
        </div>
      </div>)}
    </div>
    <div className={styles.albumDots}>
      {frames.map((item, index) => <button key={item.id} type="button" aria-label={item.label} aria-current={index === frame ? "true" : undefined} onClick={() => showFrame(index)} />)}
    </div>
    <p className={styles.albumStatus}>{activeLabel ? `الزر المضاء: ${activeLabel}` : "اضغط الاسم الذهبي في الشرح لإضاءة الزر المقصود داخل اللقطة"}</p>
    <button ref={zoomButtonRef} type="button" className={styles.zoomHint} onClick={onZoom} aria-label={`تكبير لقطة ${page.title}`}>
      <ZoomIn size={14} aria-hidden="true" />اضغط لتكبير اللقطة
    </button>
  </div>;
}
