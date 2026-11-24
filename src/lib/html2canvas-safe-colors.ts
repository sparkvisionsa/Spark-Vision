/**
 * html2canvas 1.x only understands rgb()/rgba()/hsl()/hex/named colours.
 * Modern browsers return other colour syntaxes from getComputedStyle — e.g.
 * `color-mix(...)` is serialised by Chrome as `color(srgb r g b)`, and
 * oklch()/lab() come from modern CSS — and html2canvas then aborts the whole
 * export with "Attempting to parse an unsupported color function 'color'".
 *
 * `sanitizeCloneColorsForHtml2Canvas` runs inside html2canvas' `onclone`
 * hook: every colour-bearing computed property that contains an unsupported
 * colour function is rewritten as an inline `rgba()` value on the clone only,
 * so the live page is never touched.
 */

const UNSUPPORTED_COLOR_FUNCTIONS = ["color-mix", "color", "oklch", "oklab", "lch", "lab", "hwb", "light-dark"];

const UNSUPPORTED_COLOR_PATTERN = /(?:^|[^\w-])(?:color-mix|color|oklch|oklab|lch|lab|hwb|light-dark)\(/i;

/** Computed properties html2canvas parses as colours (or images containing colours). */
const COLOR_PROPERTIES = [
  "color",
  "background-color",
  "background-image",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "box-shadow",
  "text-shadow",
  "-webkit-text-stroke-color",
  "fill",
  "stroke",
  "column-rule-color",
  "caret-color",
] as const;

export function hasUnsupportedColorFunction(value: string | null | undefined): boolean {
  return Boolean(value) && UNSUPPORTED_COLOR_PATTERN.test(value as string);
}

type ColorConverter = (cssColor: string) => string | null;

/** Converts any colour the browser understands to `rgba(r, g, b, a)` by painting one pixel. */
export function createCanvasColorConverter(doc: Document = document): ColorConverter {
  const cache = new Map<string, string | null>();
  let ctx: CanvasRenderingContext2D | null = null;
  return (cssColor: string) => {
    const key = cssColor.trim();
    if (cache.has(key)) return cache.get(key)!;
    let result: string | null = null;
    try {
      if (!ctx) {
        const canvas = doc.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
      }
      if (ctx) {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = "rgba(0, 0, 0, 0)";
        ctx.fillStyle = key;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        const alpha = Math.round((a / 255) * 1000) / 1000;
        result = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }
    } catch {
      result = null;
    }
    cache.set(key, result);
    return result;
  };
}

/** Index of the parenthesis closing the one opened at `openIndex`. */
function matchingParen(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Replaces every unsupported colour function inside a CSS value (a plain
 * colour, a gradient, a shadow list…) with an equivalent `rgba()`.
 * Unconvertible colours fall back to `fallback`.
 */
export function replaceUnsupportedColorFunctions(
  value: string,
  convert: ColorConverter,
  fallback = "rgba(0, 0, 0, 0)",
): string {
  if (!hasUnsupportedColorFunction(value)) return value;
  let out = "";
  let i = 0;
  const lower = value.toLowerCase();
  while (i < value.length) {
    let matched: string | null = null;
    const prev = i > 0 ? value[i - 1]! : "";
    if (!/[\w-]/.test(prev)) {
      for (const name of UNSUPPORTED_COLOR_FUNCTIONS) {
        if (lower.startsWith(`${name}(`, i)) {
          matched = name;
          break;
        }
      }
    }
    if (!matched) {
      out += value[i];
      i += 1;
      continue;
    }
    const open = i + matched.length;
    const close = matchingParen(value, open);
    if (close < 0) {
      out += value.slice(i);
      break;
    }
    const fn = value.slice(i, close + 1);
    out += convert(fn) ?? fallback;
    i = close + 1;
  }
  return out;
}

/**
 * html2canvas `onclone` helper: rewrites unsupported colours of every element
 * under `root` (default: the whole cloned document) as inline rgba values.
 */
export function sanitizeCloneColorsForHtml2Canvas(clonedDoc: Document, root?: Element | null): number {
  const view = clonedDoc.defaultView;
  if (!view) return 0;
  const convert = createCanvasColorConverter(clonedDoc);
  const scope = root ?? clonedDoc.documentElement;
  const elements: Element[] = [scope, ...Array.from(scope.querySelectorAll("*"))];
  let rewritten = 0;
  for (const el of elements) {
    // html2canvas clones nodes from the original document and adopts them
    // into its iframe, so `instanceof view.HTMLElement` is unreliable here.
    if (el.nodeType !== 1 || !(el as Partial<HTMLElement>).style) continue;
    const style = view.getComputedStyle(el);
    const pseudoFix: string[] = [];
    for (const prop of COLOR_PROPERTIES) {
      const value = style.getPropertyValue(prop);
      if (!hasUnsupportedColorFunction(value)) continue;
      (el as HTMLElement).style.setProperty(prop, replaceUnsupportedColorFunctions(value, convert), "important");
      rewritten += 1;
    }
    for (const pseudo of ["::before", "::after"] as const) {
      const pseudoStyle = view.getComputedStyle(el, pseudo);
      const content = pseudoStyle.getPropertyValue("content");
      if (!content || content === "none" || content === "normal") continue;
      const decls: string[] = [];
      for (const prop of COLOR_PROPERTIES) {
        const value = pseudoStyle.getPropertyValue(prop);
        if (!hasUnsupportedColorFunction(value)) continue;
        decls.push(`${prop}: ${replaceUnsupportedColorFunctions(value, convert)} !important;`);
      }
      if (decls.length > 0) pseudoFix.push(`${pseudo}{${decls.join("")}}`);
    }
    if (pseudoFix.length > 0) {
      const marker = `h2c-safe-${rewritten}-${Math.random().toString(36).slice(2, 8)}`;
      el.setAttribute("data-h2c-safe", marker);
      const styleEl = clonedDoc.createElement("style");
      styleEl.textContent = pseudoFix.map((rule) => `[data-h2c-safe="${marker}"]${rule}`).join("\n");
      clonedDoc.head.appendChild(styleEl);
      rewritten += pseudoFix.length;
    }
  }
  return rewritten;
}
