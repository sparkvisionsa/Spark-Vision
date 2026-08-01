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
  onIgnore,
}: {
  open: boolean;
  saveButtonEl: HTMLElement | null;
  onDismiss: () => void;
  onIgnore: () => void;
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
          className="pointer-events-none absolute z-[1] rounded-xl ring-4 ring-slate-900/80"
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
          "pointer-events-none absolute z-[2] flex items-center gap-2",
          tipFromLeft ? "flex-row-reverse" : "flex-row",
        )}
        style={
          tipFromLeft
            ? {
                top: Math.max(12, buttonCenterY - 36),
                left: anchor
                  ? Math.max(8, anchor.left + anchor.width + 10)
                  : 24,
              }
            : {
                top: Math.max(12, buttonCenterY - 36),
                right: anchor
                  ? Math.max(8, window.innerWidth - anchor.left + 10)
                  : 24,
              }
        }
      >
        <div className="pointer-events-auto flex max-w-[min(16.5rem,72vw)] flex-col items-stretch gap-2 rounded-2xl border border-slate-200/90 bg-white/97 px-3 py-2.5 shadow-xl shadow-slate-950/20">
          <p
            id="mv-unsaved-coach-title"
            className="text-center text-[12px] font-bold leading-snug text-slate-800"
          >
            {t("reportData.unsaved.tip")}
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={onIgnore}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50"
            >
              {t("reportData.unsaved.ignore")}
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-slate-800"
            >
              {t("reportData.unsaved.stay")}
            </button>
          </div>
        </div>
        <div
          className={cn(
            "mv-unsaved-arrow pointer-events-none shrink-0 text-slate-800",
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
