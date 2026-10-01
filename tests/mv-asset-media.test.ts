import assert from "node:assert/strict";
import test from "node:test";
import { mergePicAssetPreferFull, picAssetNeedsMediaFetch } from "../src/components/workspace/workspace-sections/machine-valuation/mv-pic-asset-progressive-load";
import type { PicAsset } from "../src/components/workspace/workspace-sections/machine-valuation/types";

const pic = (data: Partial<PicAsset>) => ({ _id: "asset", images: [], voiceNotes: [], ...data } as PicAsset);
test("new summaries invalidate media even if image counts did not change", () => {
  const old = pic({ images: [{ url: "old-1" }, { url: "old-2" }], imageCount: 2, updatedAt: "2026-01-01T00:00:00Z", notes: "old" });
  const fresh = pic({ images: [{ url: "new-cover" }], imageCount: 2, updatedAt: "2026-01-02T00:00:00Z", notes: "" });
  const merged = mergePicAssetPreferFull(old, fresh)!;
  assert.deepEqual(merged.images, [{ url: "new-cover" }]);
  assert.equal(merged.notes, "");
  assert.equal(picAssetNeedsMediaFetch(merged), true);
});
test("deleting all images is authoritative and older responses cannot restore them", () => {
  const old = pic({ images: [{ url: "old" }], imageCount: 1, updatedAt: "2026-01-01T00:00:00Z" });
  const fresh = pic({ images: [], imageCount: 0, updatedAt: "2026-01-02T00:00:00Z" });
  const merged = mergePicAssetPreferFull(old, fresh)!;
  assert.equal(merged.imageCount, 0);
  assert.deepEqual(merged.images, []);
  assert.deepEqual(mergePicAssetPreferFull(merged, old)?.images, []);
});

test("database refresh replaces cached media when updatedAt and image count are unchanged", () => {
  const old = pic({ images: [{ url: "old-main" }, { url: "old-other" }], imageCount: 2, updatedAt: "2026-01-01T00:00:00Z" });
  const summary = pic({ images: [{ url: "new-brand" }], imageCount: 2, updatedAt: old.updatedAt });
  const merged = mergePicAssetPreferFull(old, summary, true)!;
  assert.deepEqual(merged.images, [{ url: "new-brand" }]);
  assert.equal(picAssetNeedsMediaFetch(merged), true);
  const empty = mergePicAssetPreferFull(old, pic({ imageCount: 0, photoCount: 0, updatedAt: old.updatedAt }), true)!;
  assert.deepEqual(empty.images, []);
  assert.equal(empty.photoCount, 0);
});
