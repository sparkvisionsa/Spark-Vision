/**
 * Font class descriptors that never perform network I/O during `next build`.
 *
 * The previous `next/font/google` instances downloaded fonts at build time,
 * which made production builds depend on fonts.gstatic.com availability.
 */
export const systemArabicFont = {
  className: "font-system-arabic",
} as const;

export const systemSansFont = {
  className: "font-system-sans",
} as const;

export const systemSerifFont = {
  className: "font-system-serif",
} as const;
