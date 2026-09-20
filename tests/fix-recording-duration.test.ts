import assert from "node:assert/strict";
import test from "node:test";
import { readWebmDuration, withWebmDuration } from "../src/lib/fix-recording-duration";

function vint(value: number, width = 1) {
  const bytes = Buffer.alloc(width);
  let remain = value;
  for (let index = width - 1; index > 0; index--) {
    bytes[index] = remain & 0xff;
    remain >>= 8;
  }
  bytes[0] = remain | (1 << (8 - width));
  return bytes;
}

function element(id: number[], payload: Buffer) {
  return Buffer.concat([Buffer.from(id), vint(payload.length), payload]);
}

function sampleWebm() {
  const scale = element([0x2a, 0xd7, 0xb1], Buffer.from([0x0f, 0x42, 0x40]));
  const info = element([0x15, 0x49, 0xa9, 0x66], scale);
  const segment = Buffer.concat([Buffer.from([0x18, 0x53, 0x80, 0x67]), vint(info.length), info]);
  const ebml = element([0x1a, 0x45, 0xdf, 0xa3], Buffer.from([0x42, 0x86, 0x81, 0x01]));
  return new Uint8Array(Buffer.concat([ebml, segment]));
}

test("injects a seekable WebM duration into Info", () => {
  const patched = withWebmDuration(sampleWebm(), 12_500);
  assert.ok(patched);
  assert.equal(readWebmDuration(patched), 12_500);
});

test("overwrites an existing 8-byte Duration", () => {
  const first = withWebmDuration(sampleWebm(), 4_000);
  assert.ok(first);
  const second = withWebmDuration(first, 9_250);
  assert.ok(second);
  assert.equal(readWebmDuration(second), 9_250);
});

test("injects duration into Chrome-style unknown-size Segment", () => {
  const scale = element([0x2a, 0xd7, 0xb1], Buffer.from([0x0f, 0x42, 0x40]));
  const info = element([0x15, 0x49, 0xa9, 0x66], scale);
  const tracks = element([0x16, 0x54, 0xae, 0x6b], Buffer.from([0x00]));
  const cluster = Buffer.concat([Buffer.from([0x1f, 0x43, 0xb6, 0x75]), vint(4), Buffer.alloc(4)]);
  const segment = Buffer.concat([
    Buffer.from([0x18, 0x53, 0x80, 0x67, 0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
    info,
    tracks,
    cluster,
  ]);
  const ebml = element([0x1a, 0x45, 0xdf, 0xa3], Buffer.from([0x42, 0x86, 0x81, 0x01]));
  const patched = withWebmDuration(new Uint8Array(Buffer.concat([ebml, segment])), 65_000);
  assert.ok(patched);
  assert.equal(readWebmDuration(patched), 65_000);
});
