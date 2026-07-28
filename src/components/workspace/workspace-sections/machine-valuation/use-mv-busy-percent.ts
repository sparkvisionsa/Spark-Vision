"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Smooth fake progress while an async job runs (no real stream from the API).
 * Call `start()` before the job and `finish()` / `fail()` when done.
 */
export function useMvBusyPercent() {
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (finishTimerRef.current) {
      clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    setOpen(true);
    setPercent(6);
    timerRef.current = setInterval(() => {
      setPercent((current) => {
        if (current >= 90) return current;
        const step = current < 40 ? 7 : current < 70 ? 4 : 2;
        return Math.min(90, current + step);
      });
    }, 180);
  }, [clearTimers]);

  const finish = useCallback(async () => {
    clearTimers();
    setPercent(100);
    await new Promise<void>((resolve) => {
      finishTimerRef.current = setTimeout(() => {
        setOpen(false);
        setPercent(0);
        resolve();
      }, 280);
    });
  }, [clearTimers]);

  const fail = useCallback(() => {
    clearTimers();
    setOpen(false);
    setPercent(0);
  }, [clearTimers]);

  return { open, percent, start, finish, fail };
}
