"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useMvI18n } from "./mv-i18n";

type AnchorRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function MvUnsavedSaveCoach({
  open,
  saveButtonEl,
  onDismiss,
}: {
  open: boolean;
  saveButtonEl: HTMLElement | null;
  onDismiss: () => void;
}) {
  const { t, dir } = useMvI18n();
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  useLayoutEffect(() => {
    if (!open || !saveButtonEl) {
      setAnchor(null);
      return;
    }
    const measure = () => {
      const rect = saveButtonEl.getBoundingClientRect();
      setAnchor({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, saveButtonEl]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onDismiss]);

  if (!open) return null;

  /** Place tip toward viewport center so the arrow always aims at the save icon. */
  const buttonCenterX = anchor ? anchor.left + anchor.width / 2 : null;
  const buttonCenterY = anchor ? anchor.top + anchor.height / 2 : window.innerHeight * 0.35;
  const tipFromLeft =
    buttonCenterX == null ? dir === "rtl" : buttonCenterX < window.innerWidth / 2;

  return (
    <div
      className="mv-unsaved-coach fixed inset-0 z-[120]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="mv-unsaved-coach-title"
      dir={dir}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1.5px] transition-opacity"
        aria-label={t("reportData.unsaved.dismiss")}
        onClick={onDismiss}
      />

      {anchor ? (
        <div
          className="pointer-events-none absolute z-[1] rounded-xl ring-4 ring-emerald-400/90"
          style={{
            top: anchor.top - 6,
            left: anchor.left - 6,
            width: anchor.width + 12,
            height: anchor.height + 12,
          }}
          aria-hidden
        />
      ) : null}

      <div
        className={cn(
          "pointer-events-none absolute z-[2] flex items-center gap-1.5",
          tipFromLeft ? "flex-row-reverse" : "flex-row",
        )}
        style={
          tipFromLeft
            ? {
                top: buttonCenterY - 14,
                left: anchor
                  ? Math.max(8, anchor.left + anchor.width + 8)
                  : 24,
              }
            : {
                top: buttonCenterY - 14,
                right: anchor
                  ? Math.max(8, window.innerWidth - anchor.left + 8)
                  : 24,
              }
        }
      >
        <p
          id="mv-unsaved-coach-title"
          className="max-w-[min(14rem,68vw)] rounded-full border border-emerald-300/50 bg-white/95 px-2.5 py-1.5 text-center text-[11px] font-bold leading-snug text-slate-800 shadow-lg shadow-slate-950/20"
        >
          {t("reportData.unsaved.tip")}
        </p>
        <div
          className={cn(
            "mv-unsaved-arrow shrink-0 text-emerald-400",
            tipFromLeft && "mv-unsaved-arrow--rtl",
          )}
          aria-hidden
        >
          <svg width="48" height="26" viewBox="0 0 48 26" fill="none">
            <path
              d="M2 13 H30"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M26 5 L40 13 L26 21"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
