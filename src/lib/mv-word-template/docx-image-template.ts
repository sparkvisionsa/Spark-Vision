import { buildFallbackImageParagraphTemplate } from "./docx-default-image";

/** يستخرج قالب `<w:r>…<w:drawing>…</w:r>` من المستند إن وُجد */
export function extractImageRunTemplate(documentXml: string): string {
  const fromDocument = documentXml.match(
    /<w:r\b[^>]*>[\s\S]*?<w:drawing\b[\s\S]*?<\/w:drawing>[\s\S]*?<\/w:r>/,
  );
  if (fromDocument?.[0]) return fromDocument[0];

  const fallbackParagraph = buildFallbackImageParagraphTemplate();
  const fromFallback = fallbackParagraph.match(
    /<w:r\b[^>]*>[\s\S]*?<w:drawing\b[\s\S]*?<\/w:drawing>[\s\S]*?<\/w:r>/,
  );
  return fromFallback?.[0] ?? buildMinimalImageRunTemplate();
}

function buildMinimalImageRunTemplate(): string {
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="1900000" cy="1420000"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="1" name="Picture"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="Picture"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1900000" cy="1420000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

export function cloneImageRunTemplate(
  template: string,
  embedId: string,
  docPrId: number,
  cx: number,
  cy: number,
): string {
  let nextId = docPrId;

  return template
    .replace(/r:embed="[^"]+"/g, `r:embed="${embedId}"`)
    .replace(/(<wp:extent\b[^>]*?\bcx=")\d+("[^>]*?\bcy=")\d+(")/g, `$1${cx}$2${cy}$3`)
    .replace(/(<a:ext\b[^>]*?\bcx=")\d+("[^>]*?\bcy=")\d+(")/g, `$1${cx}$2${cy}$3`)
    .replace(/(\bwp:docPr\b[^>]*?\bid=")\d+(")/g, () => {
      const id = nextId;
      nextId += 1;
      return `$1${id}$2`;
    })
    .replace(/(\bpic:cNvPr\b[^>]*?\bid=")\d+(")/g, () => {
      const id = nextId;
      nextId += 1;
      return `$1${id}$2`;
    })
    .replace(/"([A-Za-z_:][\w:.-]*=)/g, '" $1');
}

type ImageParagraphOptions = {
  align?: "left" | "center" | "right";
  leftIndentTwips?: number;
  rightIndentTwips?: number;
  startIndentTwips?: number;
  endIndentTwips?: number;
};

export function buildImageParagraphFromTemplate(
  runTemplate: string,
  embedId: string,
  docPrId: number,
  cx: number,
  cy: number,
  options: boolean | ImageParagraphOptions = true,
): string {
  const opts: ImageParagraphOptions =
    typeof options === "boolean" ? { align: options ? "center" : "left" } : options;
  const { align = "center", leftIndentTwips, rightIndentTwips, startIndentTwips, endIndentTwips } = opts;
  const indents =
    leftIndentTwips !== undefined ||
    rightIndentTwips !== undefined ||
    startIndentTwips !== undefined ||
    endIndentTwips !== undefined
      ? `<w:ind${leftIndentTwips !== undefined ? ` w:left="${leftIndentTwips}"` : ""}${rightIndentTwips !== undefined ? ` w:right="${rightIndentTwips}"` : ""}${startIndentTwips !== undefined ? ` w:start="${startIndentTwips}"` : ""}${endIndentTwips !== undefined ? ` w:end="${endIndentTwips}"` : ""}/>`
      : "";
  const pPr = `<w:pPr><w:bidi/><w:jc w:val="${align}"/>${indents}</w:pPr>`;
  const run = cloneImageRunTemplate(runTemplate, embedId, docPrId, cx, cy);
  return `<w:p>${pPr}${run}</w:p>`;
}

export function buildImageCellFromTemplate(
  runTemplate: string,
  embedId: string,
  docPrId: number,
  cx: number,
  cy: number,
): string {
  const run = cloneImageRunTemplate(runTemplate, embedId, docPrId, cx, cy);
  return `<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/><w:tcMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:pPr><w:jc w:val="center"/><w:bidi/></w:pPr>${run}</w:p></w:tc>`;
}
