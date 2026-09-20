"use client";

import { forwardRef, useEffect, useRef, type ForwardedRef, type VideoHTMLAttributes } from "react";

function bindRef<T>(ref: ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

/**
 * WebM القادم من MediaRecorder غالباً بلا مدة؛ هذا المشغّل يفرض قراءة الطول
 * حتى يعمل شريط التقدم والسحب كما في يوتيوب.
 */
export const SeekableVideo = forwardRef<HTMLVideoElement, VideoHTMLAttributes<HTMLVideoElement>>(function SeekableVideo(
  { src, onLoadedMetadata, ...props },
  forwarded,
) {
  const inner = useRef<HTMLVideoElement>(null);

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
    const revealDuration = () => {
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
    node.addEventListener("loadedmetadata", revealDuration);
    if (node.readyState >= 1) revealDuration();
    return () => {
      cancelled = true;
      node.removeEventListener("loadedmetadata", revealDuration);
    };
  }, [src]);

  return (
    <video
      {...props}
      ref={inner}
      src={src}
      controls
      playsInline
      preload="auto"
      onLoadedMetadata={onLoadedMetadata}
    />
  );
});

SeekableVideo.displayName = "SeekableVideo";
