/**
 * Chrome MediaRecorder يكتب WebM بلا Duration، فيظهر الشريط بلا نهاية ولا يمكن السحب عليه.
 * نحقن المدة المعروفة من ساعة التسجيل داخل عنصر Info دون إعادة كتابة الملف كاملاً.
 */
const ID = {
  segment: 0x18538067,
  info: 0x1549a966,
  duration: 0x4489,
  timecodeScale: 0x2ad7b1,
  cluster: 0x1f43b675,
} as const;

const HEAD_BYTES = 65_536;
const DEFAULT_TIMECODE_SCALE = 1_000_000;

type Vint = { value: number; size: number; unknown: boolean };
type ElementRef = { offset: number; id: { value: number; size: number }; size: Vint; payload: number; next: number };

function readId(data: Uint8Array, offset: number): { value: number; size: number } | null {
  if (offset >= data.length) return null;
  const first = data[offset]!;
  let width = 1;
  let mask = 0x80;
  while (width <= 4 && (first & mask) === 0) {
    width++;
    mask >>= 1;
  }
  if (width > 4 || offset + width > data.length) return null;
  let value = 0;
  for (let index = 0; index < width; index++) value = (value << 8) | data[offset + index]!;
  return { value, size: width };
}

function readVint(data: Uint8Array, offset: number): Vint | null {
  if (offset >= data.length) return null;
  const first = data[offset]!;
  let width = 1;
  let mask = 0x80;
  while (width <= 8 && (first & mask) === 0) {
    width++;
    mask >>= 1;
  }
  if (width > 8 || offset + width > data.length) return null;
  let value = first & (mask - 1);
  let unknown = value === mask - 1;
  for (let index = 1; index < width; index++) {
    const byte = data[offset + index]!;
    value = value * 256 + byte;
    if (byte !== 0xff) unknown = false;
  }
  return { value: unknown ? -1 : value, size: width, unknown };
}

function vintWidthFor(value: number) {
  let width = 1;
  while (width < 8 && value > 2 ** (7 * width) - 2) width++;
  return width;
}

function writeVint(value: number, width: number) {
  const bytes = new Uint8Array(width);
  let remain = value;
  for (let index = width - 1; index > 0; index--) {
    bytes[index] = remain & 0xff;
    remain >>= 8;
  }
  bytes[0] = remain | (1 << (8 - width));
  return bytes;
}

function idWidth(id: number) {
  if (id <= 0xff) return 1;
  if (id <= 0xffff) return 2;
  if (id <= 0xffffff) return 3;
  return 4;
}

function writeId(id: number) {
  const width = idWidth(id);
  const bytes = new Uint8Array(width);
  for (let index = width - 1; index >= 0; index--) {
    bytes[index] = id & 0xff;
    id >>= 8;
  }
  return bytes;
}

function concat(parts: Uint8Array[]) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function durationElement(durationUnits: number) {
  const payload = new Uint8Array(8);
  new DataView(payload.buffer).setFloat64(0, durationUnits, false);
  return concat([writeId(ID.duration), writeVint(8, 1), payload]);
}

function readUnsigned(data: Uint8Array, start: number, end: number) {
  let value = 0;
  for (let offset = start; offset < end; offset++) value = value * 256 + data[offset]!;
  return value;
}

function walkChildren(data: Uint8Array, start: number, end: number, visit: (element: ElementRef) => boolean | void) {
  let offset = start;
  while (offset < end) {
    const id = readId(data, offset);
    if (!id) break;
    if (id.value === ID.cluster) break;
    const size = readVint(data, offset + id.size);
    if (!size) break;
    const payload = offset + id.size + size.size;
    const next = size.unknown ? end : Math.min(end, payload + size.value);
    if (visit({ offset, id, size, payload, next })) return;
    offset = next;
  }
}

function findChild(data: Uint8Array, start: number, end: number, target: number): ElementRef | null {
  let found: ElementRef | null = null;
  walkChildren(data, start, end, (element) => {
    if (element.id.value === target) {
      found = element;
      return true;
    }
  });
  return found;
}

function durationUnits(data: Uint8Array, info: ElementRef, durationMs: number) {
  const scale = findChild(data, info.payload, info.next, ID.timecodeScale);
  const timecodeScale = scale ? readUnsigned(data, scale.payload, scale.next) || DEFAULT_TIMECODE_SCALE : DEFAULT_TIMECODE_SCALE;
  return durationMs * (DEFAULT_TIMECODE_SCALE / timecodeScale);
}

function rewriteInfo(data: Uint8Array, info: ElementRef, durationMs: number) {
  const units = durationUnits(data, info, durationMs);
  const existing = findChild(data, info.payload, info.next, ID.duration);
  if (existing && existing.next - existing.payload === 8) {
    const next = data.slice();
    new DataView(next.buffer, next.byteOffset, next.byteLength).setFloat64(existing.payload, units, false);
    return next;
  }
  if (existing) return null;
  const inserted = durationElement(units);
  const bodyLength = info.next - info.payload;
  const nextSize = bodyLength + inserted.length;
  const sizeWidth = Math.max(info.size.size, vintWidthFor(nextSize));
  const sizeBytes = writeVint(nextSize, sizeWidth);
  return concat([
    data.subarray(0, info.offset + info.id.size),
    sizeBytes,
    inserted,
    data.subarray(info.payload, info.next),
    data.subarray(info.next),
  ]);
}

export function withWebmDuration(data: Uint8Array, durationMs: number) {
  if (data.length < 8 || data[0] !== 0x1a) return null;
  const header = readId(data, 0);
  const headerSize = header ? readVint(data, header.size) : null;
  if (!header || header.value !== 0x1a45dfa3 || !headerSize || headerSize.unknown) return null;
  const segmentStart = header.size + headerSize.size + headerSize.value;
  const segment = findChild(data, segmentStart, data.length, ID.segment);
  if (!segment) return null;
  const info = findChild(data, segment.payload, segment.size.unknown ? data.length : segment.next, ID.info);
  if (!info || info.size.unknown) return null;
  const patched = rewriteInfo(data, info, durationMs);
  if (!patched) return null;
  const extra = patched.length - data.length;
  if (extra <= 0 || segment.size.unknown) return patched;
  const nextSegmentSize = segment.size.value + extra;
  const width = Math.max(segment.size.size, vintWidthFor(nextSegmentSize));
  if (width !== segment.size.size) return patched;
  const next = patched.slice();
  next.set(writeVint(nextSegmentSize, width), segment.offset + segment.id.size);
  return next;
}

export function readWebmDuration(data: Uint8Array) {
  if (data.length < 8 || data[0] !== 0x1a) return null;
  const header = readId(data, 0);
  const headerSize = header ? readVint(data, header.size) : null;
  if (!header || !headerSize || headerSize.unknown) return null;
  const segment = findChild(data, header.size + headerSize.size + headerSize.value, data.length, ID.segment);
  if (!segment) return null;
  const info = findChild(data, segment.payload, segment.size.unknown ? data.length : segment.next, ID.info);
  if (!info) return null;
  const duration = findChild(data, info.payload, info.next, ID.duration);
  if (!duration || duration.next - duration.payload !== 8) return null;
  const scale = findChild(data, info.payload, info.next, ID.timecodeScale);
  const timecodeScale = scale ? readUnsigned(data, scale.payload, scale.next) || DEFAULT_TIMECODE_SCALE : DEFAULT_TIMECODE_SCALE;
  const units = new DataView(data.buffer, data.byteOffset + duration.payload, 8).getFloat64(0, false);
  return units * (timecodeScale / DEFAULT_TIMECODE_SCALE);
}

export async function finalizeRecordingBlob(blob: Blob, durationMs: number): Promise<Blob> {
  const safe = Math.max(1, durationMs);
  const type = blob.type || "video/webm";
  if (!type.includes("webm") || blob.size < 32) return blob;
  try {
    const headSize = Math.min(blob.size, HEAD_BYTES);
    const head = new Uint8Array(await blob.slice(0, headSize).arrayBuffer());
    const patched = withWebmDuration(head, safe);
    if (!patched) return blob;
    if (blob.size <= headSize) return new Blob([patched], { type });
    return new Blob([patched, blob.slice(headSize)], { type });
  } catch {
    return blob;
  }
}
