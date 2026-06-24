"use client";

export type PptxImageSlide = {
  dataUrl: string;
  width: number;
  height: number;
  title?: string;
  /** اتجاه الصفحة الملتقطة — يحدد مقاس الشريحة داخل العرض. */
  landscape?: boolean;
};

/** A4 portrait — 210×297 mm in EMU */
const PPTX_SLIDE_PORTRAIT_W = 7_560_000;
const PPTX_SLIDE_PORTRAIT_H = 10_692_000;
/** A4 landscape — 297×210 mm in EMU */
const PPTX_SLIDE_LANDSCAPE_W = 10_692_000;
const PPTX_SLIDE_LANDSCAPE_H = 7_560_000;

const textEncoder = new TextEncoder();

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function bytesFromString(value: string) {
  return textEncoder.encode(value);
}

function bytesFromBase64(base64: string) {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function pngBytesFromDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/png;base64,(.+)$/i);
  if (!match) throw new Error("PowerPoint export expects PNG slide images.");
  return bytesFromBase64(match[1]!);
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    c = crcTable[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function writeU16(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeU32(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function buildStoredZip(entries: Array<{ path: string; data: Uint8Array }>) {
  const parts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const { dosTime, dosDate } = dosDateTime();

  for (const entry of entries) {
    const name = bytesFromString(entry.path);
    const crc = crc32(entry.data);
    const local: number[] = [];
    writeU32(local, 0x04034b50);
    writeU16(local, 20);
    writeU16(local, 0x0800);
    writeU16(local, 0);
    writeU16(local, dosTime);
    writeU16(local, dosDate);
    writeU32(local, crc);
    writeU32(local, entry.data.length);
    writeU32(local, entry.data.length);
    writeU16(local, name.length);
    writeU16(local, 0);
    const localBytes = concatBytes([new Uint8Array(local), name, entry.data]);
    parts.push(localBytes);

    const central: number[] = [];
    writeU32(central, 0x02014b50);
    writeU16(central, 20);
    writeU16(central, 20);
    writeU16(central, 0x0800);
    writeU16(central, 0);
    writeU16(central, dosTime);
    writeU16(central, dosDate);
    writeU32(central, crc);
    writeU32(central, entry.data.length);
    writeU32(central, entry.data.length);
    writeU16(central, name.length);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU32(central, 0);
    writeU32(central, offset);
    centralParts.push(concatBytes([new Uint8Array(central), name]));
    offset += localBytes.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const end: number[] = [];
  writeU32(end, 0x06054b50);
  writeU16(end, 0);
  writeU16(end, 0);
  writeU16(end, entries.length);
  writeU16(end, entries.length);
  writeU32(end, centralDirectory.length);
  writeU32(end, offset);
  writeU16(end, 0);

  const zipBytes = concatBytes([...parts, centralDirectory, new Uint8Array(end)]);
  const zipBuffer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength);
  return new Blob([zipBuffer], {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}

function slideDimensions(landscape?: boolean) {
  return landscape
    ? { w: PPTX_SLIDE_LANDSCAPE_W, h: PPTX_SLIDE_LANDSCAPE_H }
    : { w: PPTX_SLIDE_PORTRAIT_W, h: PPTX_SLIDE_PORTRAIT_H };
}

/** يملأ الشريحة بالكامل مع الحفاظ على نسبة العرض — خلفية بيضاء احترافية. */
function fitImage(width: number, height: number, landscape?: boolean) {
  const { w: slideW, h: slideH } = slideDimensions(landscape);
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const scale = Math.min(slideW / safeW, slideH / safeH);
  const cx = Math.round(safeW * scale);
  const cy = Math.round(safeH * scale);
  return {
    x: Math.round((slideW - cx) / 2),
    y: Math.round((slideH - cy) / 2),
    cx,
    cy,
    slideW,
    slideH,
  };
}

function slideXml(slide: PptxImageSlide, index: number, presentationLandscape = false) {
  const box = fitImage(slide.width, slide.height, presentationLandscape);
  const title = xmlEscape(slide.title || `Slide ${index}`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld name="${title}">
    <p:bg>
      <p:bgPr>
        <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
        <a:effectLst/>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:pic>
        <p:nvPicPr><p:cNvPr id="2" name="Report page ${index}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>
        <p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
        <p:spPr><a:xfrm><a:off x="${box.x}" y="${box.y}"/><a:ext cx="${box.cx}" cy="${box.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
      </p:pic>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

const slideRelXml = (index: number) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${index}.png"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;

function contentTypesXml(slideCount: number) {
  const slideOverrides = Array.from({ length: slideCount }, (_, i) =>
    `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>
  <Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>
  <Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>
  ${slideOverrides}
</Types>`;
}

function presentationXml(slideCount: number, landscape = false) {
  const { w, h } = slideDimensions(landscape);
  const sldIds = Array.from(
    { length: slideCount },
    (_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`,
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${sldIds}</p:sldIdLst>
  <p:sldSz cx="${w}" cy="${h}" type="custom"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
}

function presentationRelXml(slideCount: number) {
  const slideRels = Array.from(
    { length: slideCount },
    (_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`,
  ).join("");
  const base = slideCount + 2;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${slideRels}
  <Relationship Id="rId${base}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/>
  <Relationship Id="rId${base + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps" Target="viewProps.xml"/>
  <Relationship Id="rId${base + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
  <Relationship Id="rId${base + 3}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/>
</Relationships>`;
}

const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

function appXml(slideCount: number) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Spark Vision</Application>
  <PresentationFormat>A4 Report Pages</PresentationFormat>
  <Slides>${slideCount}</Slides>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Slides</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>${slideCount}</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="${slideCount}" baseType="lpstr">
      ${Array.from({ length: slideCount }, (_, index) => `<vt:lpstr>Slide ${index + 1}</vt:lpstr>`).join("")}
    </vt:vector>
  </TitlesOfParts>
</Properties>`;
}

function coreXml(title: string) {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${xmlEscape(title)}</dc:title>
  <dc:creator>Spark Vision</dc:creator>
  <cp:lastModifiedBy>Spark Vision</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

const themeXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Spark Vision">
  <a:themeElements>
    <a:clrScheme name="Spark"><a:dk1><a:srgbClr val="0B1F33"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="0C447C"/></a:dk2><a:lt2><a:srgbClr val="F3F6FA"/></a:lt2><a:accent1><a:srgbClr val="0C447C"/></a:accent1><a:accent2><a:srgbClr val="0F766E"/></a:accent2><a:accent3><a:srgbClr val="D97706"/></a:accent3><a:accent4><a:srgbClr val="7C3AED"/></a:accent4><a:accent5><a:srgbClr val="0284C7"/></a:accent5><a:accent6><a:srgbClr val="64748B"/></a:accent6><a:hlink><a:srgbClr val="0563C1"/></a:hlink><a:folHlink><a:srgbClr val="954F72"/></a:folHlink></a:clrScheme>
    <a:fontScheme name="Spark"><a:majorFont><a:latin typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="Spark"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>
  </a:themeElements>
</a:theme>`;

const slideMasterXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
  <p:txStyles>
    <p:titleStyle><a:lvl1pPr algn="ctr"><a:defRPr sz="3200" b="1" lang="ar-SA"/></a:lvl1pPr></p:titleStyle>
    <p:bodyStyle><a:lvl1pPr marL="0" indent="0"><a:defRPr sz="1800" lang="ar-SA"/></a:lvl1pPr></p:bodyStyle>
    <p:otherStyle><a:lvl1pPr marL="0" indent="0"><a:defRPr sz="1800" lang="ar-SA"/></a:lvl1pPr></p:otherStyle>
  </p:txStyles>
</p:sldMaster>`;

const slideMasterRelXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;

const slideLayoutXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;

const slideLayoutRelXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;

const presPropsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:showPr showNarration="1">
    <p:present/>
  </p:showPr>
  <p:clrMru>
    <a:srgbClr val="0C447C"/>
    <a:srgbClr val="0F766E"/>
    <a:srgbClr val="D97706"/>
  </p:clrMru>
</p:presentationPr>`;

const viewPropsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:normalViewPr showOutlineIcons="0" snapVertSplitter="0">
    <p:restoredLeft sz="15620"/>
    <p:restoredTop sz="94660"/>
  </p:normalViewPr>
  <p:slideViewPr>
    <p:cSldViewPr>
      <p:cViewPr varScale="1">
        <p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale>
        <p:origin x="0" y="0"/>
      </p:cViewPr>
      <p:guideLst/>
    </p:cSldViewPr>
  </p:slideViewPr>
  <p:notesTextViewPr>
    <p:cViewPr>
      <p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale>
      <p:origin x="0" y="0"/>
    </p:cViewPr>
  </p:notesTextViewPr>
  <p:gridSpacing cx="72008" cy="72008"/>
</p:viewPr>`;

const tableStylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`;

export function buildPptxFromPngSlides(slides: PptxImageSlide[], title = "Spark Vision Report") {
  if (slides.length === 0) throw new Error("لا توجد صفحات لتصدير PowerPoint.");
  const landscapeCount = slides.filter((slide) => slide.landscape).length;
  const presentationLandscape = landscapeCount > slides.length / 2;
  const entries: Array<{ path: string; data: Uint8Array }> = [
    { path: "[Content_Types].xml", data: bytesFromString(contentTypesXml(slides.length)) },
    { path: "_rels/.rels", data: bytesFromString(rootRelsXml) },
    { path: "docProps/app.xml", data: bytesFromString(appXml(slides.length)) },
    { path: "docProps/core.xml", data: bytesFromString(coreXml(title)) },
    { path: "ppt/presentation.xml", data: bytesFromString(presentationXml(slides.length, presentationLandscape)) },
    { path: "ppt/_rels/presentation.xml.rels", data: bytesFromString(presentationRelXml(slides.length)) },
    { path: "ppt/theme/theme1.xml", data: bytesFromString(themeXml) },
    { path: "ppt/presProps.xml", data: bytesFromString(presPropsXml) },
    { path: "ppt/viewProps.xml", data: bytesFromString(viewPropsXml) },
    { path: "ppt/tableStyles.xml", data: bytesFromString(tableStylesXml) },
    { path: "ppt/slideMasters/slideMaster1.xml", data: bytesFromString(slideMasterXml) },
    { path: "ppt/slideMasters/_rels/slideMaster1.xml.rels", data: bytesFromString(slideMasterRelXml) },
    { path: "ppt/slideLayouts/slideLayout1.xml", data: bytesFromString(slideLayoutXml) },
    { path: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", data: bytesFromString(slideLayoutRelXml) },
  ];

  slides.forEach((slide, index) => {
    const n = index + 1;
    entries.push({ path: `ppt/slides/slide${n}.xml`, data: bytesFromString(slideXml(slide, n, presentationLandscape)) });
    entries.push({ path: `ppt/slides/_rels/slide${n}.xml.rels`, data: bytesFromString(slideRelXml(n)) });
    entries.push({ path: `ppt/media/image${n}.png`, data: pngBytesFromDataUrl(slide.dataUrl) });
  });

  return buildStoredZip(entries);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadPptxFromPngSlides(slides: PptxImageSlide[], filename: string, title?: string) {
  const safeFilename = filename.toLowerCase().endsWith(".pptx") ? filename : `${filename}.pptx`;
  downloadBlob(buildPptxFromPngSlides(slides, title), safeFilename);
}
