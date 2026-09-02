import type { ReactNode } from "react";

/** جزء من كتلة تُعرض على صفحة واحدة. */
export type FlowSegment = {
  blockIndex: number;
  height: number;
  node: ReactNode;
  anchor: string | null;
  displayOnly?: boolean;
  /** إزاحة نافذة القص داخل الكتلة الأصلية. صفر = بداية الكتلة. */
  windowOffset?: number;
};

export function segmentPackKey(seg: Pick<FlowSegment, "blockIndex" | "windowOffset">): string {
  return `${seg.blockIndex}:${Math.round(seg.windowOffset ?? 0)}`;
}

/** نوافذ متتالية تغطي [0, endH] دون ترك فجوة أو إسقاط ذيل الكتلة. */
export function coverRangeWithWindows(
  endH: number,
  maxBodyPx: number,
  extraCuts: number[] = [],
): Array<{ offset: number; height: number }> {
  const maxH = Math.max(1, maxBodyPx);
  const lastCut = extraCuts.reduce((max, cut) => (cut > max ? cut : max), 0);
  const end = Math.max(Math.max(1, endH), lastCut > 0 ? lastCut + maxH : Math.max(1, endH));
  const points = [
    ...new Set([0, ...extraCuts.filter((cut) => cut > 0.5 && cut < end - 0.5), end]),
  ].sort((a, b) => a - b);

  const windows: Array<{ offset: number; height: number }> = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    let start = points[i]!;
    const limit = points[i + 1]!;
    while (start < limit - 0.5) {
      const height = Math.min(maxH, limit - start);
      windows.push({ offset: start, height });
      start += height;
    }
  }
  return windows.length > 0 ? windows : [{ offset: 0, height: Math.min(maxH, end) }];
}

export type SectionChildGroup = {
  start: number;
  end: number;
  height: number;
  /** إزاحة من أعلى عنصر الكتلة `[data-mv-flow-block]` للقص العمودي. */
  yOffsetInBlock: number;
  continuation: boolean;
  /** قصّ جزء من عنصر DOM واحد (فقرة طويلة) — لا يُعاد بناء React children. */
  clipOnly?: boolean;
};

function sectionChildren(section: HTMLElement): HTMLElement[] {
  return Array.from(section.children).filter((node): node is HTMLElement => node instanceof HTMLElement);
}

/**
 * All slice offsets must be relative to the flow block, not to the hidden
 * measurement canvas.  `offsetTop` is relative to an offset parent and can
 * therefore contain the accumulated height of earlier report sections.  That
 * made continuation pages jump too far down and appear empty.
 */
function topInBlock(blockEl: HTMLElement, element: HTMLElement): number {
  return Math.max(0, element.getBoundingClientRect().top - blockEl.getBoundingClientRect().top);
}

function bottomInBlock(blockEl: HTMLElement, element: HTMLElement): number {
  return Math.max(0, element.getBoundingClientRect().bottom - blockEl.getBoundingClientRect().top);
}

function childTopInBlock(blockEl: HTMLElement, section: HTMLElement, childIndex: number): number {
  const child = sectionChildren(section)[childIndex];
  return child ? topInBlock(blockEl, child) : topInBlock(blockEl, section);
}

/**
 * Measures a complete visual group, including the gap/margin before the next
 * child.  The visible report body is a flex column, so excluding these gaps
 * would pack more content than an A4 sheet can actually hold.
 */
function groupHeightInSection(
  blockEl: HTMLElement,
  section: HTMLElement,
  children: HTMLElement[],
  start: number,
  end: number,
): number {
  const startY = start === 0 ? 0 : childTopInBlock(blockEl, section, start);
  const next = children[end + 1];
  const endY = next ? topInBlock(blockEl, next) : Math.max(bottomInBlock(blockEl, section), bottomInBlock(blockEl, blockEl));
  return Math.max(1, endY - startY);
}

function childVisualSpan(
  blockEl: HTMLElement,
  section: HTMLElement,
  children: HTMLElement[],
  index: number,
): number {
  const startY = childTopInBlock(blockEl, section, index);
  const next = children[index + 1];
  const endY = next ? topInBlock(blockEl, next) : Math.max(bottomInBlock(blockEl, section), bottomInBlock(blockEl, blockEl));
  return Math.max(1, endY - startY);
}

export function measureSectionChildGroups(
  blockEl: HTMLElement,
  section: HTMLElement,
  maxBodyPx: number,
): SectionChildGroup[] {
  const children = sectionChildren(section);
  if (children.length === 0) return [];

  const groups: SectionChildGroup[] = [];
  let groupStart = 0;
  let groupHeight = 0;
  let isContinuation = false;

  const pushGroup = (start: number, end: number, cont: boolean, clipOnly = false) => {
    if (end < start) return;
    const h = groupHeightInSection(blockEl, section, children, start, end);
    groups.push({
      start,
      end,
      height: h,
      yOffsetInBlock: childTopInBlock(blockEl, section, start),
      continuation: cont,
      clipOnly,
    });
  };

  for (let i = 0; i < children.length; i += 1) {
    const child = children[i]!;
    const childH = childVisualSpan(blockEl, section, children, i);

    if (childH > maxBodyPx) {
      const prefixHeight = groupHeight;
      if (groupHeight > 0) {
        pushGroup(groupStart, i - 1, isContinuation);
        isContinuation = true;
        groupStart = i;
        groupHeight = 0;
      }
      const childTop = childTopInBlock(blockEl, section, i);
      let yInChild = 0;
      // Keep a section heading/intro group with the first slice of its large
      // child.  Without this, the heading consumes a page by itself and the
      // text starts on a visually disconnected continuation page.
      let firstSliceCapacity =
        prefixHeight > 0 ? Math.max(1, maxBodyPx - prefixHeight) : maxBodyPx;
      while (yInChild < childH - 0.5) {
        const sliceH = Math.min(firstSliceCapacity, childH - yInChild);
        groups.push({
          start: i,
          end: i,
          height: sliceH,
          yOffsetInBlock: childTop + yInChild,
          // The first visible slice remains the live editor.  Only later
          // continuation slices are display-only replicas, so a long custom
          // section can still be edited from the page where its body begins.
          continuation: yInChild > 0,
          clipOnly: true,
        });
        yInChild += sliceH;
        firstSliceCapacity = maxBodyPx;
        isContinuation = true;
      }
      groupStart = i + 1;
      groupHeight = 0;
      continue;
    }

    if (groupHeight + childH > maxBodyPx && groupHeight > 0) {
      pushGroup(groupStart, i - 1, isContinuation);
      isContinuation = true;
      groupStart = i;
      groupHeight = childH;
    } else {
      if (groupHeight === 0) groupStart = i;
      groupHeight += childH;
    }
  }

  if (groupHeight > 0) pushGroup(groupStart, children.length - 1, isContinuation);
  return groups;
}

export function packFlowSegments(
  segments: FlowSegment[],
  maxBodyPx: number,
  forceBreakAfterBlock: ReadonlySet<number> = new Set(),
  breakBeforeKeys: ReadonlySet<string> = new Set(),
): number[][] {
  if (segments.length === 0) return [[]];

  const pages: number[][] = [];
  let page: number[] = [];
  let used = 0;

  const flush = () => {
    if (page.length > 0) {
      pages.push(page);
      page = [];
      used = 0;
    }
  };

  for (let si = 0; si < segments.length; si += 1) {
    const seg = segments[si]!;
    const h = Math.max(1, seg.height);

    if (breakBeforeKeys.has(segmentPackKey(seg)) && page.length > 0) flush();

    if (h > maxBodyPx) {
      flush();
      pages.push([si]);
      used = 0;
    } else if (used + h > maxBodyPx && page.length > 0) {
      flush();
      page.push(si);
      used = h;
    } else {
      page.push(si);
      used += h;
    }

    const next = segments[si + 1];
    const isLastOfBlock = !next || next.blockIndex !== seg.blockIndex;
    if (isLastOfBlock && forceBreakAfterBlock.has(seg.blockIndex)) flush();
  }

  flush();
  return pages.length > 0 ? pages : [[]];
}

export function lastBlockIndexOnSegmentPage(segments: FlowSegment[], indices: number[]): number | null {
  if (indices.length === 0) return null;
  return segments[indices[indices.length - 1]!]!.blockIndex;
}

export function blockIndicesWithCustomOnPage(
  segments: FlowSegment[],
  indices: number[],
  forceBreakAfterBlock: ReadonlySet<number>,
): number[] {
  const out = new Set<number>();
  for (const si of indices) {
    const bi = segments[si]!.blockIndex;
    if (forceBreakAfterBlock.has(bi)) out.add(bi);
  }
  return Array.from(out);
}
