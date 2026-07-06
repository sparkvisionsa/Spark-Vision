/** تجول آمن في XML مع دعم الجداول المتداخلة — يمنع تلف بنية document.xml */

const OPEN_TBL = "<w:tbl";
const CLOSE_TBL = "</w:tbl>";

export function findBalancedTagEnd(xml: string, startIndex: number, localName: string): number {
  const open = `<${localName}`;
  const close = `</${localName}>`;
  if (!xml.startsWith(open, startIndex)) return -1;

  let depth = 0;
  let pos = startIndex;

  while (pos < xml.length) {
    const nextOpen = xml.indexOf(open, pos);
    const nextClose = xml.indexOf(close, pos);
    if (nextClose === -1) return -1;

    if (nextOpen !== -1 && nextOpen <= nextClose) {
      depth += 1;
      pos = nextOpen + open.length;
      continue;
    }

    depth -= 1;
    pos = nextClose + close.length;
    if (depth === 0) return pos;
  }

  return -1;
}

export function walkDocumentXmlSegments(
  documentXml: string,
  handlers: {
    onTextSegment: (segmentXml: string) => string;
    onTable: (tableXml: string) => string;
  },
): string {
  let output = "";
  let cursor = 0;

  while (cursor < documentXml.length) {
    const tableStart = documentXml.indexOf(OPEN_TBL, cursor);
    if (tableStart === -1) {
      output += handlers.onTextSegment(documentXml.slice(cursor));
      break;
    }

    output += handlers.onTextSegment(documentXml.slice(cursor, tableStart));

    const tableEnd = findBalancedTagEnd(documentXml, tableStart, "w:tbl");
    if (tableEnd < 0) {
      output += documentXml.slice(tableStart);
      break;
    }

    const tableXml = documentXml.slice(tableStart, tableEnd);
    output += handlers.onTable(tableXml);
    cursor = tableEnd;
  }

  return output;
}
