/**
 * html2canvas clones the *whole* document for every capture: three
 * getComputedStyle() calls and a CSS counter parse per element, plus a full
 * style copy for every SVG icon. A report is exported one page at a time, so
 * every page paid for the entire app UI and for every other report page —
 * the export cost grew with pages × document size.
 *
 * This filter (passed as `ignoreElements`) limits the clone to what the
 * captured element can actually depend on:
 * - the element itself and everything inside it,
 * - its ancestors (inherited styles, CSS variables, `dir`, fonts),
 * - every stylesheet / metadata node anywhere in the document.
 * Sibling report pages, side panels, toolbars and dialogs are not cloned.
 * The captured pixels are identical — only unrelated nodes are skipped.
 */

const ALWAYS_KEEP_TAGS = new Set(["HEAD", "BODY", "STYLE", "LINK", "META", "TITLE", "BASE"]);

export function createCaptureScopeFilter(
  target: Element,
  extraIgnore?: (node: Element) => boolean,
): (node: Element) => boolean {
  const head = target.ownerDocument?.head ?? null;
  return (node: Element) => {
    if (extraIgnore?.(node)) return true;
    if (ALWAYS_KEEP_TAGS.has(node.tagName.toUpperCase())) return false;
    if (node === target || target.contains(node) || node.contains(target)) return false;
    if (head && head.contains(node)) return false;
    return true;
  };
}
