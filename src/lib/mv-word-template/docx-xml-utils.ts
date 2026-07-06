/** أدوات XML آمنة لملفات Word — تمنع التلف عند الاستبدال. */

export function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function xmlEscape(value: string): string {
  return sanitizeXmlText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** يزيل محارف التحكم غير المسموح بها في XML 1.0 */
export function sanitizeXmlText(value: string): string {
  return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, "");
}

/** يصلح سمات XML ملتصقة مثل name="Picture"id="101" */
export function fixConcatenatedXmlAttributes(xml: string): string {
  let prev = xml;
  let next = prev.replace(/"([A-Za-z_:][\w:.-]*=)/g, '" $1');
  while (next !== prev) {
    prev = next;
    next = prev.replace(/"([A-Za-z_:][\w:.-]*=)/g, '" $1');
  }
  return next;
}

/** يغلق أي <w:r> مفتوح دون إغلاق — يمنع mismatch بين p و rPr */
export function balanceRunTags(fragment: string): string {
  let result = fragment;
  let opens = (result.match(/<w:r\b/g) ?? []).length;
  let closes = (result.match(/<\/w:r>/g) ?? []).length;

  while (closes > opens) {
    const idx = result.indexOf("</w:r>");
    if (idx < 0) break;
    result = result.slice(0, idx) + result.slice(idx + 6);
    closes -= 1;
  }

  while (opens > closes) {
    result += "</w:r>";
    closes += 1;
  }

  return result;
}

/** يزيل بقايا run مكسورة بعد استبدال إشارة موزّعة */
export function trimOrphanRunEdges(fragment: string): string {
  return fragment
    .replace(/^(\s*<\/w:r>)+/, "")
    .replace(/^(\s*<w:r\b[^>]*>\s*<\/w:r>)+/, "");
}

/** يدمج <w:r> المتداخل داخل <w:r> — Word يرفض هذا البناء */
export function flattenNestedRuns(xml: string): string {
  let result = xml;
  for (let guard = 0; guard < 200; guard += 1) {
    const match = /<w:r\b[^>]*>((?:(?!<w:r\b)[\s\S])*?)<w:r\b[^>]*>((?:(?!<\/w:r>)[\s\S])*?)<\/w:r>((?:(?!<\/w:r>)[\s\S])*?)<\/w:r>/.exec(
      result,
    );
    if (!match || match.index == null) break;

    const [full, outerBefore, innerBody, outerAfter] = match;
    if (/<\/w:r>/.test(outerBefore) || /<\/w:p>/.test(outerBefore)) break;

    const innerNoRPr = innerBody.replace(/<w:rPr\b[\s\S]*?(?:\/>|<\/w:rPr>)/g, "");
    const merged = `<w:r>${outerBefore}${innerNoRPr}${outerAfter}</w:r>`;
    result = result.slice(0, match.index) + merged + result.slice(match.index + full.length);
  }
  return result;
}

export function repairWordXml(xml: string): string {
  return balanceRunTags(flattenNestedRuns(fixConcatenatedXmlAttributes(xml)));
}

export function extractWtTextNodes(blockXml: string): string {
  const withBreaks = blockXml
    .replace(/<w:tab[^/]*\/>/g, " ")
    .replace(/<w:br[^/]*\/>/g, "\n");
  const parts: string[] = [];
  for (const match of withBreaks.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)) {
    parts.push(decodeXmlEntities(match[1] ?? ""));
  }
  return parts.join("");
}

export function writeWtTextNodes(blockXml: string, newText: string): string {
  if (!blockXml.includes("<w:t")) return blockXml;
  const escaped = xmlEscape(newText);
  let first = true;
  return blockXml.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (_full, attrs: string | undefined) => {
    const attrText = attrs ?? "";
    if (first) {
      first = false;
      const needsPreserve =
        /xml:space="preserve"/.test(attrText) ||
        /^\s|\s$/.test(newText) ||
        newText.includes("\n");
      const mergedAttrs =
        needsPreserve && !/xml:space="preserve"/.test(attrText)
          ? `${attrText} xml:space="preserve"`
          : attrText;
      return `<w:t${mergedAttrs}>${escaped}</w:t>`;
    }
    return `<w:t${attrText}></w:t>`;
  });
}

export function isImageRelationship(relsXml: string, relationshipId: string): boolean {
  const pattern = new RegExp(
    `<Relationship\\b[^>]*\\bId="${relationshipId}"[^>]*\\bType="([^"]+)"`,
    "i",
  );
  const match = relsXml.match(pattern);
  if (!match?.[1]) {
    const reverse = new RegExp(
      `<Relationship\\b[^>]*\\bType="([^"]+)"[^>]*\\bId="${relationshipId}"`,
      "i",
    );
    const reverseMatch = relsXml.match(reverse);
    return reverseMatch?.[1]?.includes("/image") ?? false;
  }
  return match[1].includes("/image");
}

export function updateRelationshipTarget(
  relsXml: string,
  relationshipId: string,
  newTarget: string,
): string {
  const escapedTarget = newTarget.replace(/&/g, "&amp;");
  const forward = new RegExp(
    `(<Relationship\\b[^>]*\\bId="${relationshipId}"[^>]*\\bTarget=")([^"]*)(")`,
    "i",
  );
  if (forward.test(relsXml)) {
    return relsXml.replace(forward, `$1${escapedTarget}$3`);
  }
  const reverse = new RegExp(
    `(<Relationship\\b[^>]*\\bTarget=")([^"]*)("[^>]*\\bId="${relationshipId}")`,
    "i",
  );
  return relsXml.replace(reverse, `$1${escapedTarget}$3`);
}

export function assertValidXmlFragment(xml: string, label: string) {
  if (typeof DOMParser === "undefined") return;
  const wrapped = `<?xml version="1.0" encoding="UTF-8"?><root xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${xml}</root>`;
  const doc = new DOMParser().parseFromString(wrapped, "text/xml");
  const parseError = doc.getElementsByTagName("parsererror")[0];
  if (parseError) {
    throw new Error(`تعذر توليد ملف Word: XML غير صالح (${label}).`);
  }
}
