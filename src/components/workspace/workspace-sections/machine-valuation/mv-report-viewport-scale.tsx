"use client";

import { createContext, useContext } from "react";

/** مقياس معاينة التقرير في اللوحة (‎ReportViewportFit‎) — ‎1‎ = الحجم الكامل. */
export const ReportViewportScaleContext = createContext(1);

export function useReportViewportScale() {
  return useContext(ReportViewportScaleContext);
}
