"use client";

import {
  Children,
  Fragment,
  cloneElement,
  isValidElement,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  blockIndicesWithCustomOnPage,
  coverRangeWithWindows,
  lastBlockIndexOnSegmentPage,
  measureSectionChildGroups,
  packFlowSegments,
  segmentPackKey,
  type FlowSegment,
} from "./mv-report-flow-segments";
import { MvReportPageShell, type MvReportPageShellProps } from "./mv-report-page-shell";
import {
  getBlockAnchorFromNode,
  getReportInteriorBodyMaxPx,
  getReportInteriorBodyWidthPx,
  type ReportPageOrientation,
} from "./mv-report-page-metrics";

export type ReportInteriorShellProps = Omit<MvReportPageShellProps, "children" | "variant">;

function flattenFlowChildren(children: ReactNode): ReactNode[] {
  const out: ReactNode[] = [];
  Children.forEach(children, (child) => {
    if (child == null) return;
    if (isValidElement(child) && child.type === Fragment) {
      out.push(...flattenFlowChildren(child.props.children));
      return;
    }
    out.push(child);
  });
  return out;
}

function sectionChildSlice(
  block: ReactNode,
  start: number,
  end: number,
  continuation: boolean,
): ReactNode | null {
  if (!isValidElement(block) || block.type !== "section") return null;
  const kids = Children.toArray(block.props.children).filter(Boolean);
  if (start > end || start >= kids.length) return null;
  const slice = kids.slice(start, Math.min(end + 1, kids.length));
  const props = continuation
    ? {
        ...block.props,
        id: undefined,
        "data-mv-report-insert-anchor": undefined,
        "data-mv-flow-continuation": "true" as const,
        // A continuation is placed at the top of a fresh A4 body.  Do not
        // repeat a section's original top margin and steal usable page space.
        style: { ...block.props.style, marginTop: 0 },
      }
    : block.props;
  return cloneElement(block, props, slice);
}

/**
 * Child-by-child reconstruction is only safe when the React children map
 * one-to-one to direct DOM children.  Report headings commonly use Fragments
 * (heading + inserted content), so those sections must use complete visual
 * windows instead of risking a mismatched index and a missing block.
 */
function canSliceSectionChildren(block: ReactNode): boolean {
  if (!isValidElement(block) || block.type !== "section") return false;
  const children = Children.toArray(block.props.children).filter(Boolean);
  return children.length > 0 && children.every((child) => isValidElement(child) && typeof child.type === "string");
}

function blockNodeForClip(block: ReactNode, yOffset: number): ReactNode {
  if (yOffset <= 0 || !isValidElement(block)) return block;
  return cloneElement(block, {
    id: undefined,
    "data-mv-report-insert-anchor": undefined,
    "data-mv-flow-continuation": "true",
  });
}

function clipSegmentNode(
  block: ReactNode,
  yOffset: number,
  height: number,
  displayOnly: boolean,
): ReactNode {
  return (
    <div
      className={displayOnly ? "pointer-events-none select-none" : undefined}
      data-mv-flow-display-only={displayOnly ? "true" : undefined}
      aria-hidden={displayOnly ? true : undefined}
      style={{ height, overflow: "hidden" }}
    >
      <div
        className="overflow-hidden"
        style={{ height, boxSizing: "border-box" }}
        data-mv-flow-window
        data-mv-flow-offset={Math.round(yOffset)}
        data-mv-flow-height={Math.round(height)}
      >
        <div style={{ transform: `translateY(-${Math.max(0, yOffset)}px)` }}>
          {blockNodeForClip(block, yOffset)}
        </div>
      </div>
    </div>
  );
}

function windowsToSegments(
  block: ReactNode,
  blockIndex: number,
  anchor: string | null,
  windows: Array<{ offset: number; height: number }>,
  clip: (
    block: ReactNode,
    yOffset: number,
    height: number,
    displayOnly: boolean,
  ) => ReactNode,
): FlowSegment[] {
  return windows.map((window, index) => ({
    blockIndex,
    height: window.height,
    node: clip(block, window.offset, window.height, index > 0 || window.offset > 0),
    anchor,
    displayOnly: index > 0 || window.offset > 0,
    windowOffset: window.offset,
  }));
}

function buildFlowSegmentsFromMeasure(
  blockElements: HTMLElement[],
  blocks: ReactNode[],
  maxBodyPx: number,
  clipSegmentNode: (
    block: ReactNode,
    yOffset: number,
    height: number,
    displayOnly: boolean,
  ) => ReactNode,
  extraCuts: ReadonlyMap<number, number[]> = new Map(),
  trueHeights: ReadonlyMap<number, number> = new Map(),
): FlowSegment[] {
  const segments: FlowSegment[] = [];

  blockElements.forEach((blockEl, blockIndex) => {
    const block = blocks[blockIndex]!;
    const anchor = getBlockAnchorFromNode(block);
    const measuredH = Math.max(1, blockEl.getBoundingClientRect().height);
    const totalH = Math.max(measuredH, trueHeights.get(blockIndex) ?? 0);
    const cuts = extraCuts.get(blockIndex) ?? [];
    const emitWindows = (endH: number, moreCuts: number[] = cuts) => {
      segments.push(
        ...windowsToSegments(
          block,
          blockIndex,
          anchor,
          coverRangeWithWindows(endH, maxBodyPx, moreCuts),
          clipSegmentNode,
        ),
      );
    };

    // Overflow-discovered cuts are in block coordinates.  Rebuild the whole
    // block as consecutive windows so the remainder is never dropped.
    if (cuts.length > 0) {
      emitWindows(Math.max(totalH, Math.max(...cuts)));
      return;
    }

    const section = blockEl.querySelector("section");
    if (section instanceof HTMLElement && canSliceSectionChildren(block)) {
      const groups = measureSectionChildGroups(blockEl, section, maxBodyPx);
      const needsSplit = groups.some((group) => group.clipOnly || group.height > maxBodyPx) || groups.length > 1;
      if (needsSplit) {
        const sectionSegments: FlowSegment[] = [];
        let canRenderAllGroups = true;
        for (const g of groups) {
          if (g.clipOnly || g.height > maxBodyPx) {
            const spanWindows = coverRangeWithWindows(g.height, maxBodyPx).map((window) => ({
              offset: g.yOffsetInBlock + window.offset,
              height: window.height,
            }));
            sectionSegments.push(
              ...windowsToSegments(block, blockIndex, anchor, spanWindows, clipSegmentNode),
            );
            continue;
          }
          const slice = sectionChildSlice(block, g.start, g.end, g.continuation);
          if (slice) {
            sectionSegments.push({
              blockIndex,
              height: g.height,
              node: slice,
              anchor,
              windowOffset: g.yOffsetInBlock,
            });
          } else {
            canRenderAllGroups = false;
            break;
          }
        }
        if (canRenderAllGroups && sectionSegments.length > 0) {
          segments.push(...sectionSegments);
          return;
        }
      }
    }

    if (totalH <= maxBodyPx) {
      segments.push({ blockIndex, height: totalH, node: block, anchor, windowOffset: 0 });
      return;
    }

    emitWindows(totalH, []);
  });

  return segments;
}

function pageContentAvailablePx(body: HTMLElement): number {
  const style = getComputedStyle(body);
  const padY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  return Math.max(1, body.clientHeight - padY);
}

/** Prefer breaking after a fully visible block rather than mid-line. */
function snapPageSplitPx(body: HTMLElement, maxVisiblePx: number): number {
  const bodyRect = body.getBoundingClientRect();
  const style = getComputedStyle(body);
  const padTop = parseFloat(style.paddingTop) || 0;
  const origin = bodyRect.top + padTop;
  const inner =
    (body.querySelector("[data-mv-flow-window] > div") as HTMLElement | null) ?? body;
  let best = 0;
  const candidates = inner.querySelectorAll(
    "p, h1, h2, h3, h4, li, tr, img, table, ul, ol, blockquote, section, figure",
  );
  for (const node of candidates) {
    if (!(node instanceof HTMLElement)) continue;
    const rect = node.getBoundingClientRect();
    if (rect.height < 4) continue;
    const relBottom = rect.bottom - origin;
    if (relBottom <= maxVisiblePx + 0.5 && relBottom > best) best = relBottom;
  }
  if (best < Math.min(48, maxVisiblePx * 0.18)) return maxVisiblePx;
  return Math.min(maxVisiblePx, best);
}

function addUniqueCut(map: Map<number, number[]>, blockIndex: number, offset: number): boolean {
  const rounded = Math.max(1, Math.round(offset));
  const current = map.get(blockIndex) ?? [];
  if (current.some((cut) => Math.abs(cut - rounded) < 1)) return false;
  map.set(blockIndex, [...current, rounded].sort((a, b) => a - b));
  return true;
}

/**
 * يوزّع أقسام التقرير على صفحات A4 — فصل العنوان عن الفقرة + wrapping ديناميكي.
 */
export function ReportFlowPages({
  shellProps,
  orientation = "portrait",
  children,
  forceBreakAfterAnchors,
  renderCustomAfterAnchor,
  renderPageEndCue,
  measureRevision = 0,
  measureEnvStyle,
  fitToPage = false,
}: {
  shellProps: ReportInteriorShellProps;
  orientation?: ReportPageOrientation;
  children: ReactNode;
  forceBreakAfterAnchors?: ReadonlySet<string>;
  renderCustomAfterAnchor?: (anchorId: string) => ReactNode;
  renderPageEndCue?: (lastAnchorId: string, pageIndex: number) => ReactNode;
  measureRevision?: string | number;
  measureEnvStyle?: CSSProperties;
  /** Keep each child on one page and shrink it into the body instead of clipping/continuing. */
  fitToPage?: boolean;
}) {
  const blocks = useMemo(() => flattenFlowChildren(children), [children]);
  const measureRef = useRef<HTMLDivElement>(null);
  const renderedFlowRef = useRef<HTMLDivElement>(null);
  const extraCutsRef = useRef(new Map<number, number[]>());
  const breakBeforeRef = useRef(new Set<string>());
  const trueHeightsRef = useRef(new Map<number, number>());
  const [layoutFixGen, setLayoutFixGen] = useState(0);
  const [flowSegments, setFlowSegments] = useState<FlowSegment[]>(() =>
    blocks.map((block, i) => ({
      blockIndex: i,
      height: 1,
      node: block,
      anchor: getBlockAnchorFromNode(block),
      windowOffset: 0,
    })),
  );
  const [pageGroups, setPageGroups] = useState<number[][]>(() =>
    blocks.length > 0 ? [blocks.map((_, i) => i)] : [[]],
  );
  const [isFlowReady, setIsFlowReady] = useState(false);

  const bodyMaxPx = getReportInteriorBodyMaxPx(orientation);
  // Small packing guard only.  Real overflow must create continuation pages,
  // not shrink the page until a block is clipped and dropped.
  const renderSafetyPx = 8;
  const effectiveBodyMaxPx = Math.max(1, bodyMaxPx - renderSafetyPx);
  const bodyWidthPx = getReportInteriorBodyWidthPx(orientation);
  const contentKey = `${String(measureRevision)}:${blocks.length}:${orientation}`;

  const forceBreakAfterBlock = useMemo(() => {
    const set = new Set<number>();
    if (!forceBreakAfterAnchors?.size) return set;
    blocks.forEach((block, i) => {
      const anchor = getBlockAnchorFromNode(block);
      if (anchor && forceBreakAfterAnchors.has(anchor)) set.add(i);
    });
    return set;
  }, [blocks, forceBreakAfterAnchors]);

  useLayoutEffect(() => {
    extraCutsRef.current = new Map();
    breakBeforeRef.current = new Set();
    trueHeightsRef.current = new Map();
    setLayoutFixGen(0);
  }, [contentKey]);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root || blocks.length === 0) {
      setFlowSegments([]);
      setPageGroups([[]]);
      setIsFlowReady(true);
      return;
    }

    let cancelled = false;
    let lastSignature = "";
    const measure = () => {
      if (cancelled) return;
      const blockNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-mv-flow-block]"));
      if (blockNodes.length !== blocks.length) return;

      const segments = fitToPage
        ? blockNodes.map((blockEl, blockIndex) => {
            const block = blocks[blockIndex]!;
            return {
              blockIndex,
              height: Math.min(
                effectiveBodyMaxPx,
                Math.max(1, blockEl.getBoundingClientRect().height),
              ),
              node: block,
              anchor: getBlockAnchorFromNode(block),
              windowOffset: 0,
            };
          })
        : buildFlowSegmentsFromMeasure(
            blockNodes,
            blocks,
            effectiveBodyMaxPx,
            clipSegmentNode,
            extraCutsRef.current,
            trueHeightsRef.current,
          );
      const pages = packFlowSegments(
        segments,
        effectiveBodyMaxPx,
        forceBreakAfterBlock,
        breakBeforeRef.current,
      );
      const signature = `${segments.map((seg) => `${seg.blockIndex}:${Math.round(seg.windowOffset ?? 0)}:${Math.round(seg.height)}`).join("|")}::${pages.map((page) => page.join(",")).join("/")}`;
      if (signature === lastSignature) {
        setIsFlowReady(true);
        return;
      }
      lastSignature = signature;
      setFlowSegments(segments);
      setPageGroups(pages);
      setIsFlowReady(true);
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    for (const node of root.querySelectorAll<HTMLElement>("[data-mv-flow-block]")) {
      ro.observe(node);
    }
    void document.fonts?.ready?.then(() => measure());
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [blocks, effectiveBodyMaxPx, fitToPage, forceBreakAfterBlock, measureRevision, layoutFixGen]);

  useLayoutEffect(() => {
    const root = renderedFlowRef.current;
    if (!root || flowSegments.length === 0 || pageGroups.length === 0 || !isFlowReady) return;

    let cancelled = false;
    let frame = 0;

    const applyOverflowFix = () => {
      if (cancelled || fitToPage) return;
      const bodies = Array.from(root.querySelectorAll<HTMLElement>("[data-mv-report-page-content]"));
      const cutCount = [...extraCutsRef.current.values()].reduce((sum, cuts) => sum + cuts.length, 0);
      if (cutCount + breakBeforeRef.current.size > 240) return;

      for (let pageIdx = 0; pageIdx < bodies.length; pageIdx += 1) {
        const body = bodies[pageIdx]!;
        const overflowPx = body.scrollHeight - body.clientHeight;
        if (overflowPx <= 2) continue;

        const indices = pageGroups[pageIdx] ?? [];
        if (indices.length === 0) continue;

        if (indices.length > 1) {
          const lastSeg = flowSegments[indices[indices.length - 1]!]!;
          const key = segmentPackKey(lastSeg);
          if (!breakBeforeRef.current.has(key)) {
            breakBeforeRef.current.add(key);
            setLayoutFixGen((gen) => gen + 1);
            return;
          }
        }

        const lastSi = indices[indices.length - 1]!;
        const seg = flowSegments[lastSi];
        if (!seg) continue;
        const currentH = Math.max(1, seg.height);

        const inner =
          (body.querySelector("[data-mv-flow-window] > div") as HTMLElement | null) ??
          (body.querySelector("[data-mv-flow-seg] > *") as HTMLElement | null);
        const available = pageContentAvailablePx(body);
        let recordedTrueHeight = false;
        if (inner) {
          const trueH = inner.getBoundingClientRect().height;
          const known = trueHeightsRef.current.get(seg.blockIndex) ?? 0;
          if (trueH > known + 1) {
            trueHeightsRef.current.set(seg.blockIndex, trueH);
            recordedTrueHeight = true;
          }
        }

        const trueH = trueHeightsRef.current.get(seg.blockIndex) ?? 0;
        const remaining = Math.max(0, trueH - (seg.windowOffset ?? 0));
        if (
          recordedTrueHeight &&
          remaining > 0 &&
          remaining <= available + 2 &&
          remaining < currentH - 1
        ) {
          setLayoutFixGen((gen) => gen + 1);
          return;
        }

        let visibleH = snapPageSplitPx(
          body,
          Math.min(available - 2, Math.max(24, currentH - overflowPx - 2)),
        );
        if (visibleH >= currentH - 1) {
          visibleH = Math.max(24, currentH - Math.ceil(overflowPx) - 2);
        }
        if (visibleH >= currentH - 1) {
          visibleH = Math.max(24, available - 4);
        }
        if (visibleH >= currentH - 1) continue;

        const cutAt = (seg.windowOffset ?? 0) + visibleH;
        if (addUniqueCut(extraCutsRef.current, seg.blockIndex, cutAt)) {
          setLayoutFixGen((gen) => gen + 1);
          return;
        }
        const retryCut = (seg.windowOffset ?? 0) + Math.max(24, visibleH - 8);
        if (addUniqueCut(extraCutsRef.current, seg.blockIndex, retryCut)) {
          setLayoutFixGen((gen) => gen + 1);
        }
        return;
      }
    };

    frame = requestAnimationFrame(applyOverflowFix);
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(applyOverflowFix);
    });
    for (const body of root.querySelectorAll<HTMLElement>("[data-mv-report-page-content]")) {
      ro.observe(body);
    }
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [fitToPage, flowSegments, isFlowReady, pageGroups]);

  const measureLayer =
    typeof document !== "undefined"
      ? createPortal(
          <div
            ref={measureRef}
            aria-hidden
            className="mv-report-canvas-root mv-report-flow-measure pointer-events-none opacity-0"
            style={{
              position: "fixed",
              left: -10_000,
              top: 0,
              width: bodyWidthPx,
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              visibility: "visible",
              zIndex: -1,
              color: "#020617",
              fontFamily: "inherit",
              ...measureEnvStyle,
            }}
            dir="rtl"
          >
            {blocks.map((block, i) => (
              <div
                key={`measure-${i}`}
                data-mv-flow-block={i}
                className="flow-root flex w-full flex-col"
                style={{
                  boxSizing: "border-box",
                  ...(fitToPage
                    ? {
                        height: effectiveBodyMaxPx,
                        maxHeight: effectiveBodyMaxPx,
                        overflow: "hidden",
                      }
                    : {}),
                }}
              >
                {block}
              </div>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {measureLayer}

      <div
        ref={renderedFlowRef}
        className="contents"
        data-mv-report-flow-ready={isFlowReady ? "true" : "false"}
      >
      {pageGroups.map((segmentIndices, pageIdx) => {
        const lastBlockIdx = lastBlockIndexOnSegmentPage(flowSegments, segmentIndices);
        const lastAnchor =
          lastBlockIdx != null ? getBlockAnchorFromNode(blocks[lastBlockIdx]) : null;
        const customBlockIndices = blockIndicesWithCustomOnPage(
          flowSegments,
          segmentIndices,
          forceBreakAfterBlock,
        );

        return (
          <Fragment key={`flow-page-${pageIdx}`}>
            <MvReportPageShell variant="interior" orientation={orientation} {...shellProps}>
              {segmentIndices.map((si) => {
                const seg = flowSegments[si];
                if (!seg) return null;
                const node = seg.displayOnly ? (
                  <div
                    className="pointer-events-none select-none"
                    data-mv-flow-display-only="true"
                    aria-hidden
                  >
                    {seg.node}
                  </div>
                ) : (
                  seg.node
                );
                return (
                  <div
                    key={`seg-${si}-${pageIdx}`}
                    className={fitToPage ? "flex h-full min-h-0 flex-1 flex-col" : "contents"}
                    data-mv-flow-seg={si}
                    data-mv-flow-pack-key={segmentPackKey(seg)}
                  >
                    {node}
                  </div>
                );
              })}
            </MvReportPageShell>
            {renderCustomAfterAnchor
              ? customBlockIndices.map((blockIdx) => {
                  const anchor = getBlockAnchorFromNode(blocks[blockIdx]);
                  return anchor ? (
                    <Fragment key={`custom-${anchor}-${pageIdx}`}>
                      {renderCustomAfterAnchor(anchor)}
                    </Fragment>
                  ) : null;
                })
              : null}
            {lastAnchor && renderPageEndCue ? renderPageEndCue(lastAnchor, pageIdx) : null}
          </Fragment>
        );
      })}
      </div>
    </>
  );
}

export const ReportSectionGroup = ReportFlowPages;
