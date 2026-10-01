import assert from "node:assert/strict";
import { test } from "node:test";
import { assetBulkSelectionKey, toggleAssetBulkSelection, bulkFolderTargets, toggleBulkFolders, bulkFolderRoots } from "../src/lib/mv-asset-bulk-selection";

test("bulk selection starts empty and does not change report inclusion", () => {
  const photos = [{ _id: "a", includeInReport: true }, { _id: "b", includeInReport: false }];
  const before = structuredClone(photos);
  const empty = new Set<string>();
  const selected = toggleAssetBulkSelection(empty, [photos[1]]);
  assert.deepEqual([...selected], ["file:b"]);
  assert.equal(empty.size, 0);
  assert.deepEqual(photos, before);
  assert.equal(toggleAssetBulkSelection(selected, [photos[1]]).size, 0);
});

test("folder selection fills partial selection and clears only that folder", () => {
  const initial = new Set(["file:outside", "file:a"]);
  const folder = [{ _id: "a" }, { _id: "b" }];
  const selected = toggleAssetBulkSelection(initial, folder);
  assert.deepEqual([...selected].sort(), ["file:a", "file:b", "file:outside"]);
  assert.deepEqual([...toggleAssetBulkSelection(selected, folder)], ["file:outside"]);
});

test("external image selection survives reordering and signed URL renewal, never index reuse", () => {
  const photo = { _id: "row:0", displayOnlyPicAssetImage: true,
    picAssetSubProjectId: "asset-a", sourceUrl: "https://media.test/Photo.jpg?signature=old" };
  const key = assetBulkSelectionKey(photo);
  assert.equal(key, assetBulkSelectionKey({ ...photo, _id: "row:9", sourceUrl: "https://media.test/Photo.jpg?signature=new" }));
  assert.notEqual(key, assetBulkSelectionKey({ ...photo, sourceUrl: "https://media.test/other.jpg" }));
  assert.notEqual(key, assetBulkSelectionKey({ ...photo, sourceUrl: "https://media.test/photo.jpg" }));
  assert.notEqual(key, assetBulkSelectionKey({ ...photo, picAssetSubProjectId: "asset-b" }));
});

test("a Drive row and its asset preview share one bulk selection", () => {
  const file = { _id: "stored-file" };
  const preview = { _id: "preview:2", displayOnlyPicAssetImage: true, downloadFileId: "stored-file" };
  assert.equal(assetBulkSelectionKey(file), assetBulkSelectionKey(preview));
  const selected = toggleAssetBulkSelection(new Set(), [file, preview]);
  assert.equal(selected.size, 1);
  assert.equal(toggleAssetBulkSelection(selected, [preview]).size, 0);
});

test("empty and populated asset folders select independently of media and report state", () => {
  const empty = { path: "empty", folders: [], images: [] };
  const populated = { path: "full", folders: [], images: [{ includeInReport: true }] };
  const selected = toggleBulkFolders(toggleBulkFolders(new Set(), empty), populated);
  assert.deepEqual([...selected], ["empty", "full"]);
  assert.equal(populated.images[0].includeInReport, true);
  assert.deepEqual([...toggleBulkFolders(selected, empty)], ["full"]);
  assert.deepEqual(bulkFolderRoots([empty, populated], selected), [empty, populated]);
});

test("virtual groups select real empty folders, never virtual IDs", () => {
  const group = { path: "__pv_root__", folders: [{ path: "group", isSynthetic: true,
    folders: [{ path: "a", folders: [] }, { path: "b", folders: [] }] }] };
  assert.deepEqual(bulkFolderTargets(group), ["a", "b"]);
  const selected = toggleBulkFolders(new Set(["outside", "a"]), group);
  assert.deepEqual([...selected].sort(), ["a", "b", "outside"]);
  assert.deepEqual([...toggleBulkFolders(selected, group)], ["outside"]);
});

test("bulk deletion collapses selected descendants under their selected parent", () => {
  const child = { path: "child", folders: [] };
  const parent = { path: "parent", folders: [child] };
  const sibling = { path: "sibling", folders: [] };
  const root = { path: "__pv_root__", folders: [parent, sibling] };
  assert.deepEqual(bulkFolderRoots([root], new Set(["parent", "child", "sibling"])), [parent, sibling]);
  assert.deepEqual(bulkFolderRoots([root], new Set(["child"])), [child]);
  assert.deepEqual(bulkFolderRoots([root], new Set(["already-deleted"])), []);
});
