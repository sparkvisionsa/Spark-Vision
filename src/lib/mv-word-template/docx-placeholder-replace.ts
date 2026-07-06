import { normalizeBrokenDocxTags } from "./analyzer";
import { sanitizeXmlText } from "./docx-xml-utils";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * استبدال {{placeholders}} مباشرة في XML — يعمل حتى عندما تكون العلامة مقسّمة على عدة w:t.
 */
export function applyPlaceholderReplacementsInXml(
  xml: string,
  scalarValues: Record<string, string>,
): string {
  let result = normalizeBrokenDocxTags(xml);
  const entries = Object.entries(scalarValues).filter(([, value]) => value?.trim());

  for (const [key, rawValue] of entries) {
    const value = sanitizeXmlText(rawValue);
    const escaped = escapeRegExp(key);
    result = result.replace(new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, "gi"), value);
  }

  return result;
}

export function documentHasMergePlaceholders(xml: string): boolean {
  return /\{\{[#/]?[^}]+\}\}/.test(normalizeBrokenDocxTags(xml));
}

export function documentHasImageLoops(xml: string): boolean {
  const normalized = normalizeBrokenDocxTags(xml);
  return (
    /\{\{#\s*assetImages\s*\}\}/i.test(normalized) ||
    /\{\{#\s*valuationImages\s*\}\}/i.test(normalized)
  );
}
