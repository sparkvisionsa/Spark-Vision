"use client";

import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Palette, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PRESET_COLORS = [
  "#0f172a",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0284c7",
  "#7c3aed",
  "#db2777",
  "#64748b",
];

function applyInlineStylesToRange(
  root: HTMLElement | null,
  range: Range,
  styles: Record<string, string>,
): boolean {
  if (!root || range.collapsed) return false;
  if (!root.contains(range.commonAncestorContainer)) return false;

  const span = document.createElement("span");
  for (const [k, v] of Object.entries(styles)) {
    span.style.setProperty(k, v);
  }

  const contents = range.extractContents();
  span.appendChild(contents);
  range.insertNode(span);

  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    const nr = document.createRange();
    nr.selectNodeContents(span);
    sel.addRange(nr);
  }

  let p: HTMLElement | null = span;
  while (p && root.contains(p)) {
    if (p.isContentEditable) {
      p.dispatchEvent(new Event("input", { bubbles: true }));
      break;
    }
    p = p.parentElement;
  }
  return true;
}

function applyInlineStylesToSelection(
  root: HTMLElement | null,
  styles: Record<string, string>,
  fallbackRange: Range | null,
): boolean {
  if (!root) return false;
  const sel = window.getSelection();
  let range: Range | null = null;

  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    const r = sel.getRangeAt(0);
    if (root.contains(r.commonAncestorContainer)) range = r;
  } else if (fallbackRange && !fallbackRange.collapsed && root.contains(fallbackRange.commonAncestorContainer)) {
    sel?.removeAllRanges();
    sel?.addRange(fallbackRange.cloneRange());
    if (sel && sel.rangeCount > 0) range = sel.getRangeAt(0);
  }

  if (!range || range.collapsed) return false;
  return applyInlineStylesToRange(root, range, styles);
}

type ToolbarPos = { top: number; left: number; width: number };

function readFontSizePxFromSelection(root: HTMLElement | null): number | null {
  if (!root) return null;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  return readFontSizePxFromRange(root, range);
}

function readFontSizePxFromRange(root: HTMLElement | null, range: Range | null): number | null {
  if (!root || !range || !root.contains(range.commonAncestorContainer)) return null;
  let node: Node | null = range.commonAncestorContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  let el = node instanceof Element ? node : null;
  while (el && root.contains(el)) {
    if (el instanceof HTMLElement) {
      const fs = window.getComputedStyle(el).fontSize;
      const px = parseFloat(fs);
      if (Number.isFinite(px) && px > 0) return Math.round(px);
    }
    el = el.parentElement;
  }
  return null;
}

export function ReportRichSelectionToolbar({
  containerRef,
  enabled,
}: {
  containerRef: RefObject<HTMLElement | null>;
  enabled: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<ToolbarPos>({ top: 0, left: 0, width: 260 });
  const [panel, setPanel] = useState<"none" | "color" | "size">("none");
  const [customColor, setCustomColor] = useState("#0f172a");
  const [fontSizePx, setFontSizePx] = useState("14");
  const savedRangeRef = useRef<Range | null>(null);

  const snapshotSelectionToRef = useCallback(() => {
    const root = containerRef.current;
    const sel = window.getSelection();
    if (!root || !sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (root.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  }, [containerRef]);

  const updateFromSelection = useCallback(() => {
    if (!enabled) {
      savedRangeRef.current = null;
      setVisible(false);
      return;
    }
    const root = containerRef.current;
    if (!root) {
      savedRangeRef.current = null;
      setVisible(false);
      return;
    }
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0);
      if (root.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          const tw = 280;
          const gap = 8;
          let left = rect.left + rect.width / 2 - tw / 2;
          const top = rect.bottom + gap;
          left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
          setPos({ top, left, width: tw });
          setVisible(true);
          return;
        }
      }
    }

    if (panel !== "none" && savedRangeRef.current) {
      const r = savedRangeRef.current;
      if (root.contains(r.commonAncestorContainer)) {
        const rect = r.getBoundingClientRect();
        if (rect.width > 0 || rect.height > 0) {
          const tw = 280;
          const gap = 8;
          let left = rect.left + rect.width / 2 - tw / 2;
          const top = rect.bottom + gap;
          left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
          setPos({ top, left, width: tw });
          setVisible(true);
          return;
        }
      }
    }

    setVisible(false);
  }, [containerRef, enabled, panel]);

  useEffect(() => {
    if (!enabled) return;
    const onSel = () => {
      requestAnimationFrame(updateFromSelection);
    };
    document.addEventListener("selectionchange", onSel);
    document.addEventListener("mouseup", onSel);
    return () => {
      document.removeEventListener("selectionchange", onSel);
      document.removeEventListener("mouseup", onSel);
    };
  }, [enabled, updateFromSelection]);

  useEffect(() => {
    if (!visible) {
      setPanel("none");
      savedRangeRef.current = null;
    }
  }, [visible]);

  useEffect(() => {
    if (panel !== "size" || !visible) return;
    const root = containerRef.current;
    const px =
      readFontSizePxFromSelection(root) ??
      (savedRangeRef.current ? readFontSizePxFromRange(root, savedRangeRef.current) : null);
    if (px != null) setFontSizePx(String(px));
  }, [panel, visible, containerRef]);

  const applyColor = (color: string) => {
    const ok = applyInlineStylesToSelection(containerRef.current, { color }, savedRangeRef.current);
    if (ok) {
      const sel = window.getSelection();
      if (sel?.rangeCount) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
    setPanel("none");
  };

  const applyFontSize = () => {
    const n = Number(fontSizePx);
    if (!Number.isFinite(n) || n < 6 || n > 200) return;
    const ok = applyInlineStylesToSelection(
      containerRef.current,
      { "font-size": `${n}px` },
      savedRangeRef.current,
    );
    if (ok) {
      const sel = window.getSelection();
      if (sel?.rangeCount) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
    setPanel("none");
  };

  if (!enabled) return null;

  return (
    <div
      className={cn(
        "mv-report-chrome pointer-events-auto z-[480] max-w-[min(92vw,280px)] rounded-xl border border-slate-200 bg-white/98 p-2 text-right shadow-lg shadow-slate-900/15 backdrop-blur-sm print:hidden",
        !visible && "hidden",
      )}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: pos.width,
      }}
      onMouseDown={(e) => {
        const t = e.target as HTMLElement;
        if (t.closest("input, textarea, select, [data-toolbar-interactive]")) return;
        e.preventDefault();
      }}
      role="toolbar"
      aria-label="تنسيق النص المحدد"
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap justify-end gap-1">
          <Button
            type="button"
            variant={panel === "color" ? "secondary" : "outline"}
            size="sm"
            className="h-8 gap-1 px-2 text-[11px] font-extrabold"
            onMouseDown={(e) => {
              e.preventDefault();
              snapshotSelectionToRef();
            }}
            onClick={() => setPanel((p) => (p === "color" ? "none" : "color"))}
          >
            <Palette className="h-3.5 w-3.5" />
            تغيير اللون
          </Button>
          <Button
            type="button"
            variant={panel === "size" ? "secondary" : "outline"}
            size="sm"
            className="h-8 gap-1 px-2 text-[11px] font-extrabold"
            onMouseDown={(e) => {
              e.preventDefault();
              snapshotSelectionToRef();
            }}
            onClick={() => setPanel((p) => (p === "size" ? "none" : "size"))}
          >
            <Type className="h-3.5 w-3.5" />
            حجم الخط
          </Button>
        </div>

        {panel === "color" ? (
          <div className="space-y-2 border-t border-slate-100 pt-2" data-toolbar-interactive>
            <p className="text-[10px] font-bold text-slate-500">ألوان رئيسية</p>
            <div className="flex flex-wrap justify-end gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  className="h-7 w-7 rounded-md border border-slate-200 shadow-sm ring-offset-1 hover:ring-2 hover:ring-sky-400/50"
                  style={{ backgroundColor: c }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyColor(c)}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-500">لون مخصص</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="h-8 w-12 cursor-pointer rounded border border-slate-200 bg-white"
                />
                <Button type="button" size="sm" className="h-8 text-[11px]" onClick={() => applyColor(customColor)}>
                  تطبيق
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {panel === "size" ? (
          <div
            className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-2"
            data-toolbar-interactive
          >
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
              <span>px</span>
              <input
                type="number"
                min={6}
                max={200}
                step={1}
                value={fontSizePx}
                onChange={(e) => setFontSizePx(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyFontSize();
                  }
                }}
                className="h-8 w-[4.5rem] rounded-md border border-slate-200 px-2 text-center text-[12px] font-bold tabular-nums outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-300"
              />
            </label>
            <Button
              type="button"
              size="sm"
              className="h-8 text-[11px]"
              onMouseDown={(e) => e.preventDefault()}
              onClick={applyFontSize}
            >
              تطبيق
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function normalizeArabicReportHtml(raw: string) {
  if (typeof document === "undefined" || !raw) return raw;
  const template = document.createElement("template");
  template.innerHTML = raw;

  template.content.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const dir = el.getAttribute("dir")?.toLowerCase();
    if (dir && dir !== "rtl") el.removeAttribute("dir");

    const align = el.getAttribute("align")?.toLowerCase();
    if (align === "left") el.removeAttribute("align");

    if (typeof el.className === "string" && el.className) {
      const nextClass = el.className
        .split(/\s+/)
        .filter((name) => name && name !== "text-left" && name !== "ltr")
        .join(" ");
      if (nextClass) el.className = nextClass;
      else el.removeAttribute("class");
    }

    if (el.style.direction.toLowerCase() === "ltr") el.style.removeProperty("direction");
    const textAlign = el.style.textAlign.toLowerCase();
    if (textAlign === "left") el.style.removeProperty("text-align");
    el.style.removeProperty("unicode-bidi");
    if (!el.getAttribute("style")?.trim()) el.removeAttribute("style");
  });

  return template.innerHTML;
}

function textToHtml(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return escaped.replace(/\r?\n/g, "<br>");
}

/** محرر HTML بسيط للأقسام الإضافية — يحفظ التنسيق مع الجلسة */
export function ReportRichHtmlField({
  html,
  onHtmlChange,
  className,
  placeholder,
}: {
  html: string;
  onHtmlChange: (next: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const composing = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    const next = normalizeArabicReportHtml(html || "");
    if (el.innerHTML !== next) {
      el.innerHTML = next;
      if (next !== html) onHtmlChange(next);
    }
  }, [html, onHtmlChange]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      dir="rtl"
      data-placeholder={placeholder}
      className={cn(
        "min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-right text-[13px] font-medium leading-8 text-slate-800 shadow-inner outline-none transition empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] focus:border-sky-300 focus:ring-2 focus:ring-sky-100/80",
        "[unicode-bidi:plaintext] [&_*]:max-w-full [&_*]:[letter-spacing:0] [&_a]:break-all [&_a]:font-semibold [&_a]:text-[#0C447C] [&_a]:underline [&_img]:mx-auto [&_img]:h-auto [&_img]:max-w-full",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pe-5 [&_ol]:ps-0 [&_p]:my-2 [&_p]:break-words [&_strong]:font-black [&_strong]:text-[#0C447C] [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pe-5 [&_ul]:ps-0 [&_li]:my-1",
        "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-sky-50 [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-black [&_th]:text-[#0C447C]",
        className,
      )}
      style={{
        direction: "rtl",
        textAlign: "right",
        unicodeBidi: "plaintext",
      }}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={(e) => {
        composing.current = false;
        onHtmlChange(normalizeArabicReportHtml((e.target as HTMLDivElement).innerHTML));
      }}
      onInput={(e) => {
        if (composing.current) return;
        onHtmlChange(normalizeArabicReportHtml((e.target as HTMLDivElement).innerHTML));
      }}
      onPaste={(e) => {
        e.preventDefault();
        const pastedHtml = e.clipboardData.getData("text/html");
        const pastedText = e.clipboardData.getData("text/plain");
        const next = normalizeArabicReportHtml(pastedHtml || textToHtml(pastedText));
        document.execCommand("insertHTML", false, next);
        window.setTimeout(() => {
          const el = ref.current;
          if (el) onHtmlChange(normalizeArabicReportHtml(el.innerHTML));
        }, 0);
      }}
    />
  );
}
