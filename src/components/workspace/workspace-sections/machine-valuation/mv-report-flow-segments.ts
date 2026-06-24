import type { ReactNode } from "react";

/** جزء من كتلة تُعرض على صفحة واحدة. */
export type FlowSegment = {
  blockIndex: number;
  height: number;
  node: ReactNode;
  anchor: string | null;
  displayOnly?: boolean;
};

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

function groupHeightInSection(section: HTMLElement, start: number, end: number): number {
  const children = section.children;
  const first = children[start];
  const last = children[end];
  if (!(first instanceof HTMLElement) || !(last instanceof HTMLElement)) return 1;
  return Math.max(1, last.offsetTop + last.offsetHeight - first.offsetTop);
}

function childTopInBlock(blockEl: HTMLElement, section: HTMLElement, childIndex: number): number {
  const child = section.children[childIndex];
  if (!(child instanceof HTMLElement)) return section.offsetTop;
  return section.offsetTop + child.offsetTop;
}

export function measureSectionChildGroups(
  blockEl: HTMLElement,
  section: HTMLElement,
  maxBodyPx: number,
): SectionChildGroup[] {
  const children = Array.from(section.children).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  );
  if (children.length <= 1) return [];

  const groups: SectionChildGroup[] = [];
  let groupStart = 0;
  let groupHeight = 0;
  let isContinuation = false;

  const pushGroup = (start: number, end: number, cont: boolean, clipOnly = false) => {
    if (end < start) return;
    const h = groupHeightInSection(section, start, end);
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
    const childH = child.getBoundingClientRect().height;

    if (childH > maxBodyPx) {
      if (groupHeight > 0) {
        pushGroup(groupStart, i - 1, isContinuation);
        isContinuation = true;
        groupStart = i;
        groupHeight = 0;
      }
      const childTop = childTopInBlock(blockEl, section, i);
      let yInChild = 0;
      while (yInChild < childH - 0.5) {
        const sliceH = Math.min(maxBodyPx, childH - yInChild);
        groups.push({
          start: i,
          end: i,
          height: sliceH,
          yOffsetInBlock: childTop + yInChild,
          continuation: isContinuation || yInChild > 0,
          clipOnly: true,
        });
        yInChild += maxBodyPx;
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
  return groups.length > 1 ? groups : [];
}

export function packFlowSegments(
  segments: FlowSegment[],
  maxBodyPx: number,
  forceBreakAfterBlock: ReadonlySet<number> = new Set(),
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
