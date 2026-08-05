"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckSquare,
  ImageIcon,
  Loader2,
  Search,
  Square,
  CheckCheck,
  Eraser,
} from "lucide-react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MvDialogContent } from "./mv-dialog";
import { cn } from "@/lib/utils";
import { useMvI18n } from "./mv-i18n";

export type MvReportSelectImageItem = {
  key: string;
  name: string;
  previewUrl: string;
  mimeType?: string;
  selected: boolean;
  disabled?: boolean;
};

export type MvReportSelectAssetSection = {
  id: string;
  name: string;
  pathLabel?: string;
  images: MvReportSelectImageItem[];
};

export type MvReportSelectUpdate = {
  sectionId: string;
  imageKey: string;
  selected: boolean;
};

export type MvReportImagesSelectModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: MvReportSelectAssetSection[];
  saving?: boolean;
  onApplySelection: (updates: MvReportSelectUpdate[]) => void;
};

type MarqueeState = {
  originX: number;
  originY: number;
  currentX: number;
  currentY: number;
  /** auto = تحديد أو إلغاء حسب حالة الصور داخل الإطار، toggle = Ctrl+سحب */
  mode: "auto" | "toggle";
};

function rectsIntersect(
  a: { left: number; top: number; right: number; bottom: number },
  b: { left: number; top: number; right: number; bottom: number },
) {
  return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
}

function cloneSelectionMap(sections: MvReportSelectAssetSection[]) {
  const map = new Map<string, boolean>();
  for (const section of sections) {
    for (const image of section.images) {
      map.set(`${section.id}::${image.key}`, image.selected);
    }
  }
  return map;
}

export function MvReportImagesSelectModal({
  open,
  onOpenChange,
  sections,
  saving = false,
  onApplySelection,
}: MvReportImagesSelectModalProps) {
  const { t, dir } = useMvI18n();
  const [query, setQuery] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [selectionMap, setSelectionMap] = useState<Map<string, boolean>>(() => cloneSelectionMap(sections));
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const navScrollRef = useRef<HTMLDivElement | null>(null);
  const navItemRefs = useRef(new Map<string, HTMLElement>());
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const imageRefs = useRef(new Map<string, HTMLElement>());
  const selectionMapRef = useRef(selectionMap);
  const baselineRef = useRef<Map<string, boolean>>(new Map());
  const dragMovedRef = useRef(false);
  const activeFromClickRef = useRef(false);
  const activeSectionIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectionMapRef.current = selectionMap;
  }, [selectionMap]);

  useEffect(() => {
    activeSectionIdRef.current = activeSectionId;
  }, [activeSectionId]);

  useEffect(() => {
    if (!open) return;
    // مزامنة مرة واحدة عند الفتح فقط — بعدها الحالة المحلية هي المصدر الفوري
    const map = cloneSelectionMap(sections);
    setSelectionMap(map);
    baselineRef.current = new Map(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const displaySections = useMemo(() => {
    return sections.map((section) => ({
      ...section,
      images: section.images.map((image) => ({
        ...image,
        selected: selectionMap.get(`${section.id}::${image.key}`) ?? image.selected,
      })),
    }));
  }, [sections, selectionMap]);

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return displaySections;
    return displaySections
      .map((section) => {
        const nameMatch = section.name.toLowerCase().includes(q);
        const images = nameMatch
          ? section.images
          : section.images.filter((image) => image.name.toLowerCase().includes(q));
        if (!nameMatch && images.length === 0) return null;
        return { ...section, images: nameMatch ? section.images : images };
      })
      .filter((section): section is MvReportSelectAssetSection => Boolean(section));
  }, [displaySections, query]);

  const filteredSectionIds = useMemo(
    () => filteredSections.map((section) => section.id),
    [filteredSections],
  );

  const totals = useMemo(() => {
    let total = 0;
    let selected = 0;
    for (const section of displaySections) {
      total += section.images.length;
      selected += section.images.filter((image) => image.selected).length;
    }
    return { total, selected };
  }, [displaySections]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveSectionId(null);
      setMarquee(null);
      activeFromClickRef.current = false;
      return;
    }
    if (filteredSections[0]) setActiveSectionId(filteredSections[0].id);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /** تنشيط رابط الأصل حسب القسم الظاهر من أعلى منطقة الصور */
  useEffect(() => {
    if (!open) return;
    const root = scrollRef.current;
    if (!root || filteredSectionIds.length === 0) return;

    let frame = 0;
    const syncActiveFromScroll = () => {
      if (activeFromClickRef.current) return;

      const sections = filteredSectionIds
        .map((id) => {
          const el = sectionRefs.current.get(id);
          return el ? { id, el } : null;
        })
        .filter((row): row is { id: string; el: HTMLElement } => row != null);
      if (sections.length === 0) return;

      const rootRect = root.getBoundingClientRect();
      // خط التتبع عند أعلى منطقة التمرير (مع هامش بسيط تحت الترويسة الداخلية)
      const markerY = rootRect.top + 20;

      let bestId = sections[0]!.id;
      for (const { id, el } of sections) {
        if (el.getBoundingClientRect().top <= markerY) {
          bestId = id;
        } else {
          break;
        }
      }

      // عند الوصول لنهاية التمرير: نشّط آخر أصل ظاهر
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 12) {
        bestId = sections[sections.length - 1]!.id;
      }

      if (bestId !== activeSectionIdRef.current) {
        setActiveSectionId(bestId);
      }
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(syncActiveFromScroll);
    };

    root.addEventListener("scroll", onScroll, { passive: true });
    // بعد رسم الأقسام (refs) أعد المزامنة
    const boot = window.setTimeout(syncActiveFromScroll, 0);
    const boot2 = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(syncActiveFromScroll);
    });

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(boot2);
      window.clearTimeout(boot);
      root.removeEventListener("scroll", onScroll);
    };
  }, [filteredSectionIds, open]);

  /** إبقاء رابط الأصل النشط ظاهرًا داخل قائمة التنقل */
  useEffect(() => {
    if (!open || !activeSectionId) return;
    const item = navItemRefs.current.get(activeSectionId);
    const nav = navScrollRef.current;
    if (!item || !nav) return;
    const itemRect = item.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    if (itemRect.top < navRect.top + 4 || itemRect.bottom > navRect.bottom - 4) {
      item.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeSectionId, open]);

  const commitLocalUpdates = useCallback((updates: MvReportSelectUpdate[]) => {
    if (updates.length === 0) return;
    setSelectionMap((prev) => {
      const next = new Map(prev);
      for (const update of updates) {
        next.set(`${update.sectionId}::${update.imageKey}`, update.selected);
      }
      return next;
    });
  }, []);

  const toggleImage = useCallback(
    (sectionId: string, imageKey: string) => {
      const key = `${sectionId}::${imageKey}`;
      const current = selectionMapRef.current.get(key) ?? false;
      commitLocalUpdates([{ sectionId, imageKey, selected: !current }]);
    },
    [commitLocalUpdates],
  );

  const setSectionSelection = useCallback(
    (sectionId: string, selected: boolean) => {
      const section = displaySections.find((row) => row.id === sectionId);
      if (!section) return;
      commitLocalUpdates(
        section.images
          .filter((image) => !image.disabled && image.selected !== selected)
          .map((image) => ({ sectionId, imageKey: image.key, selected })),
      );
    },
    [commitLocalUpdates, displaySections],
  );

  const setAllSelection = useCallback(
    (selected: boolean) => {
      const updates: MvReportSelectUpdate[] = [];
      for (const section of displaySections) {
        for (const image of section.images) {
          if (image.disabled || image.selected === selected) continue;
          updates.push({ sectionId: section.id, imageKey: image.key, selected });
        }
      }
      commitLocalUpdates(updates);
    },
    [commitLocalUpdates, displaySections],
  );

  const scrollToSection = useCallback((sectionId: string) => {
    const el = sectionRefs.current.get(sectionId);
    const root = scrollRef.current;
    if (!el || !root) return;
    activeFromClickRef.current = true;
    setActiveSectionId(sectionId);
    const rootTop = root.getBoundingClientRect().top;
    const elTop = el.getBoundingClientRect().top;
    root.scrollTo({
      top: root.scrollTop + (elTop - rootTop) - 8,
      behavior: "smooth",
    });
    window.setTimeout(() => {
      activeFromClickRef.current = false;
    }, 450);
  }, []);

  const jumpToFirstIncomplete = useCallback(() => {
    const target = filteredSections.find((section) =>
      section.images.some((image) => !image.selected),
    );
    if (target) scrollToSection(target.id);
  }, [filteredSections, scrollToSection]);

  const applyMarqueeSelection = useCallback(
    (state: MarqueeState) => {
      const left = Math.min(state.originX, state.currentX);
      const right = Math.max(state.originX, state.currentX);
      const top = Math.min(state.originY, state.currentY);
      const bottom = Math.max(state.originY, state.currentY);
      const band = { left, top, right, bottom };
      if (right - left < 4 && bottom - top < 4) return;

      const hit: Array<{ sectionId: string; imageKey: string; current: boolean }> = [];
      for (const [composite, el] of imageRefs.current.entries()) {
        const rect = el.getBoundingClientRect();
        if (
          !rectsIntersect(band, {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          })
        ) {
          continue;
        }
        const sep = composite.indexOf("::");
        if (sep < 0) continue;
        hit.push({
          sectionId: composite.slice(0, sep),
          imageKey: composite.slice(sep + 2),
          current: selectionMapRef.current.get(composite) ?? false,
        });
      }
      if (hit.length === 0) return;

      const nextSelected =
        state.mode === "toggle" ? null : hit.some((item) => !item.current) ? true : false;

      const updates: MvReportSelectUpdate[] = hit
        .map((item) => ({
          sectionId: item.sectionId,
          imageKey: item.imageKey,
          selected: state.mode === "toggle" ? !item.current : Boolean(nextSelected),
        }))
        .filter((update, index) => update.selected !== hit[index]!.current);

      commitLocalUpdates(updates);
    },
    [commitLocalUpdates],
  );

  const onScrollPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 && event.button !== 2) return;
      const target = event.target as HTMLElement | null;
      const onImageCard = Boolean(target?.closest("[data-report-image-card='true']"));
      const withCtrl = event.ctrlKey || event.metaKey;
      if (onImageCard && event.button === 0 && !withCtrl) return;

      dragMovedRef.current = false;
      const mode: MarqueeState["mode"] =
        event.button === 2 || withCtrl ? "toggle" : "auto";
      setMarquee({
        originX: event.clientX,
        originY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        mode,
      });
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const onScrollPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!marquee) return;
      if (Math.abs(event.clientX - marquee.originX) > 3 || Math.abs(event.clientY - marquee.originY) > 3) {
        dragMovedRef.current = true;
      }
      setMarquee((prev) =>
        prev
          ? {
              ...prev,
              currentX: event.clientX,
              currentY: event.clientY,
            }
          : null,
      );
    },
    [marquee],
  );

  const finishMarquee = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!marquee) return;
      const state = {
        ...marquee,
        currentX: event.clientX,
        currentY: event.clientY,
      };
      setMarquee(null);
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      if (dragMovedRef.current) {
        applyMarqueeSelection(state);
      }
    },
    [applyMarqueeSelection, marquee],
  );

  const handleSave = useCallback(() => {
    // نحفظ الحالة الكاملة لكل الصور حتى تُكتب false صراحةً لغير المحددة
    const updates: MvReportSelectUpdate[] = [];
    for (const section of sections) {
      for (const image of section.images) {
        if (image.disabled) continue;
        const composite = `${section.id}::${image.key}`;
        const selected = selectionMapRef.current.get(composite) ?? image.selected;
        updates.push({
          sectionId: section.id,
          imageKey: image.key,
          selected,
        });
      }
    }
    if (updates.length > 0) {
      onApplySelection(updates);
    }
    onOpenChange(false);
  }, [onApplySelection, onOpenChange, sections]);

  const marqueeStyle = useMemo(() => {
    if (!marquee) return null;
    const left = Math.min(marquee.originX, marquee.currentX);
    const top = Math.min(marquee.originY, marquee.currentY);
    const width = Math.abs(marquee.currentX - marquee.originX);
    const height = Math.abs(marquee.currentY - marquee.originY);
    return { left, top, width, height };
  }, [marquee]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <MvDialogContent
        className={cn(
          "!grid-cols-1 !gap-0 overflow-hidden p-0",
          "flex h-[min(100dvh,100vh)] w-[min(100vw,100%)] max-w-none flex-col",
          "sm:h-[min(92dvh,920px)] sm:w-[min(96vw,1180px)] sm:rounded-lg",
          "rounded-none border-0 sm:border",
        )}
        dir={dir}
      >
        <header className="shrink-0 border-b border-slate-100 bg-gradient-to-l from-emerald-50/80 via-white to-white px-3 pb-3 pt-3 pe-12 sm:px-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[14px] font-black text-slate-900 sm:text-[15px]">
                {t("assetImages.reportSelect.title")}
              </DialogTitle>
              <p className="mt-0.5 text-[11px] font-semibold text-slate-600">
                {t("assetImages.reportSelect.subtitle", {
                  selected: totals.selected,
                  total: totals.total,
                })}
              </p>
            </div>
            {saving ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("assetImages.reportSelect.saving")}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 w-full flex-1 sm:min-w-[200px]">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("assetImages.reportSelect.searchPlaceholder")}
                className="h-9 ps-8 text-[12px]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 rounded-lg text-[11px] font-bold"
                onClick={() => setAllSelection(true)}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t("assetImages.reportSelect.selectAll")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 rounded-lg text-[11px] font-bold"
                onClick={() => setAllSelection(false)}
              >
                <Eraser className="h-3.5 w-3.5" />
                {t("assetImages.reportSelect.clearAll")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 rounded-lg text-[11px] font-bold text-emerald-800"
                onClick={jumpToFirstIncomplete}
              >
                {t("assetImages.reportSelect.jumpIncomplete")}
              </Button>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(200px,240px)_minmax(0,1fr)]">
          <aside className="flex max-h-[28vh] min-h-0 flex-col border-b border-slate-100 bg-slate-50/70 lg:max-h-none lg:border-b-0 lg:border-e">
            <div
              ref={navScrollRef}
              className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-2 pe-1"
            >
              {filteredSections.length === 0 ? (
                <p className="px-2 py-6 text-center text-[11px] font-semibold text-slate-500">
                  {t("assetImages.reportSelect.empty")}
                </p>
              ) : (
                filteredSections.map((section) => {
                  const selectedCount = section.images.filter((image) => image.selected).length;
                  const active = activeSectionId === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      ref={(el) => {
                        if (el) navItemRefs.current.set(section.id, el);
                        else navItemRefs.current.delete(section.id);
                      }}
                      onClick={() => scrollToSection(section.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-start transition",
                        active
                          ? "bg-emerald-100 text-emerald-950 shadow-sm ring-1 ring-emerald-300"
                          : "text-slate-700 hover:bg-white",
                      )}
                    >
                      <span className="truncate text-[12px] font-extrabold" dir="auto">
                        {section.name}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-bold tabular-nums",
                          active ? "text-emerald-800" : "text-slate-500",
                        )}
                      >
                        {selectedCount}/{section.images.length}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <div
            ref={scrollRef}
            className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white p-2.5 select-none sm:p-3"
            onPointerDown={onScrollPointerDown}
            onPointerMove={onScrollPointerMove}
            onPointerUp={finishMarquee}
            onPointerCancel={finishMarquee}
            onContextMenu={(e) => e.preventDefault()}
          >
            {marqueeStyle ? (
              <div
                className="pointer-events-none fixed z-50 rounded-md border border-emerald-500/80 bg-emerald-400/15"
                style={{
                  left: marqueeStyle.left,
                  top: marqueeStyle.top,
                  width: marqueeStyle.width,
                  height: marqueeStyle.height,
                }}
              />
            ) : null}

            {filteredSections.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center text-slate-400 sm:min-h-[280px]">
                <ImageIcon className="h-10 w-10" />
                <p className="mt-2 text-[12px] font-bold">{t("assetImages.reportSelect.empty")}</p>
              </div>
            ) : (
              <div className="space-y-5 pb-2">
                {filteredSections.map((section) => {
                  const selectedCount = section.images.filter((image) => image.selected).length;
                  const allSelected =
                    section.images.length > 0 && selectedCount === section.images.length;
                  return (
                    <section
                      key={section.id}
                      data-section-id={section.id}
                      ref={(el) => {
                        if (el) sectionRefs.current.set(section.id, el);
                        else sectionRefs.current.delete(section.id);
                      }}
                      className="scroll-mt-2"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[13px] font-black text-slate-900" dir="auto">
                            {section.name}
                          </h3>
                          <p className="text-[10px] font-bold text-emerald-800">
                            {t("assetImages.reportSelect.sectionCount", {
                              selected: selectedCount,
                              total: section.images.length,
                            })}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 shrink-0 rounded-lg text-[11px] font-bold"
                          onClick={() => setSectionSelection(section.id, !allSelected)}
                        >
                          {allSelected
                            ? t("assetImages.reportSelect.deselectSection")
                            : t("assetImages.reportSelect.selectSection")}
                        </Button>
                      </div>

                      {section.images.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] font-semibold text-slate-500">
                          {t("assetImages.reportSelect.noImagesInAsset")}
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                          {section.images.map((image) => {
                            const composite = `${section.id}::${image.key}`;
                            return (
                              <button
                                key={image.key}
                                type="button"
                                data-report-image-card="true"
                                disabled={image.disabled}
                                ref={(el) => {
                                  if (el) imageRefs.current.set(composite, el);
                                  else imageRefs.current.delete(composite);
                                }}
                                onClick={() => {
                                  if (dragMovedRef.current) return;
                                  toggleImage(section.id, image.key);
                                }}
                                className={cn(
                                  "group overflow-hidden rounded-xl border bg-white text-start shadow-sm transition",
                                  image.selected
                                    ? "border-emerald-500 ring-2 ring-emerald-100"
                                    : "border-slate-200 hover:border-emerald-300",
                                  image.disabled && "opacity-50",
                                )}
                              >
                                <div className="relative aspect-square bg-slate-100">
                                  {image.previewUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={image.previewUrl}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      draggable={false}
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center text-slate-300">
                                      <ImageIcon className="h-8 w-8" />
                                    </div>
                                  )}
                                  <span
                                    className={cn(
                                      "absolute start-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-white/95 shadow-sm",
                                      image.selected ? "text-emerald-700" : "text-slate-400",
                                    )}
                                  >
                                    {image.selected ? (
                                      <CheckSquare className="h-3.5 w-3.5" />
                                    ) : (
                                      <Square className="h-3.5 w-3.5" />
                                    )}
                                  </span>
                                </div>
                                <div
                                  className="truncate px-2 py-1.5 text-[10px] font-bold text-slate-700"
                                  dir="auto"
                                >
                                  {image.name}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <footer className="flex shrink-0 items-center justify-end border-t border-slate-100 bg-white px-3 py-3 sm:px-4">
          <Button
            type="button"
            className="h-10 w-full shrink-0 rounded-xl bg-emerald-700 px-5 text-[12px] font-black hover:bg-emerald-800 sm:w-auto"
            disabled={saving}
            onClick={handleSave}
          >
            {t("assetImages.reportSelect.save")}
          </Button>
        </footer>
      </MvDialogContent>
    </Dialog>
  );
}
