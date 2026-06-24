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
  lastBlockIndexOnSegmentPage,
  measureSectionChildGroups,
  packFlowSegments,
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
    ? { ...block.props, id: undefined, "data-mv-flow-continuation": "true" as const }
    : block.props;
  return cloneElement(block, props, slice);
}

function blockNodeForClip(block: ReactNode, yOffset: number): ReactNode {
  if (yOffset <= 0 || !isValidElement(block)) return block;
  if (block.type === "section") {
    return cloneElement(block, {
      id: undefined,
      "data-mv-flow-continuation": "true",
    });
  }
  return block;
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
    >
      <div className="overflow-hidden" style={{ maxHeight: height }} data-mv-flow-window>
        <div style={{ marginTop: -yOffset }}>{blockNodeForClip(block, yOffset)}</div>
      </div>
    </div>
  );
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
): FlowSegment[] {
  const segments: FlowSegment[] = [];

  blockElements.forEach((blockEl, blockIndex) => {
    const block = blocks[blockIndex]!;
    const anchor = getBlockAnchorFromNode(block);
    const totalH = Math.max(1, blockEl.getBoundingClientRect().height);
    const section = blockEl.querySelector("section");

    if (section instanceof HTMLElement) {
      const groups = measureSectionChildGroups(blockEl, section, maxBodyPx);
      if (groups.length > 1) {
        for (const g of groups) {
          if (g.clipOnly) {
            segments.push({
              blockIndex,
              height: Math.min(g.height, maxBodyPx),
              node: clipSegmentNode(block, g.yOffsetInBlock, g.height, g.continuation),
              anchor,
              displayOnly: g.continuation,
            });
          } else {
            const slice = sectionChildSlice(block, g.start, g.end, g.continuation);
            if (slice) {
              segments.push({
                blockIndex,
                height: Math.min(g.height, maxBodyPx),
                node: slice,
                anchor,
              });
            }
          }
        }
        return;
      }
    }

    if (totalH <= maxBodyPx) {
      segments.push({ blockIndex, height: totalH, node: block, anchor });
      return;
    }

    let y = 0;
    while (y < totalH - 0.5) {
      const sliceH = Math.min(maxBodyPx, totalH - y);
      segments.push({
        blockIndex,
        height: sliceH,
        node: clipSegmentNode(block, y, sliceH, y > 0),
        anchor,
        displayOnly: y > 0,
      });
      y += maxBodyPx;
    }
  });

  return segments;
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
}: {
  shellProps: ReportInteriorShellProps;
  orientation?: ReportPageOrientation;
  children: ReactNode;
  forceBreakAfterAnchors?: ReadonlySet<string>;
  renderCustomAfterAnchor?: (anchorId: string) => ReactNode;
  renderPageEndCue?: (lastAnchorId: string, pageIndex: number) => ReactNode;
  measureRevision?: string | number;
  measureEnvStyle?: CSSProperties;
}) {
  const blocks = useMemo(() => flattenFlowChildren(children), [children]);
  const measureRef = useRef<HTMLDivElement>(null);
  const [flowSegments, setFlowSegments] = useState<FlowSegment[]>(() =>
    blocks.map((block, i) => ({
      blockIndex: i,
      height: 1,
      node: block,
      anchor: getBlockAnchorFromNode(block),
    })),
  );
  const [pageGroups, setPageGroups] = useState<number[][]>(() =>
    blocks.length > 0 ? [blocks.map((_, i) => i)] : [[]],
  );

  const bodyMaxPx = getReportInteriorBodyMaxPx(orientation);
  const bodyWidthPx = getReportInteriorBodyWidthPx(orientation);

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
    const root = measureRef.current;
    if (!root || blocks.length === 0) {
      setFlowSegments([]);
      setPageGroups([[]]);
      return;
    }

    const measure = () => {
      const blockNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-mv-flow-block]"));
      if (blockNodes.length !== blocks.length) return;

      const segments = buildFlowSegmentsFromMeasure(
        blockNodes,
        blocks,
        bodyMaxPx,
        clipSegmentNode,
      );
      setFlowSegments(segments);
      setPageGroups(packFlowSegments(segments, bodyMaxPx, forceBreakAfterBlock));
    };

    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(root);
    for (const node of root.querySelectorAll<HTMLElement>("[data-mv-flow-block]")) {
      ro.observe(node);
    }
    return () => ro.disconnect();
  }, [blocks, bodyMaxPx, forceBreakAfterBlock, measureRevision]);

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
              visibility: "hidden",
              zIndex: -1,
              color: "#020617",
              fontFamily: "inherit",
              ...measureEnvStyle,
            }}
            dir="rtl"
          >
            {blocks.map((block, i) => (
              <div key={`measure-${i}`} data-mv-flow-block={i}>
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
                return <Fragment key={`seg-${si}-${pageIdx}`}>{node}</Fragment>;
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
    </>
  );
}

export const ReportSectionGroup = ReportFlowPages;
