import test from "node:test";
import assert from "node:assert/strict";
import {
  createProjectInspectionSiteForm,
  projectContactDataFromInspectionSites,
  projectInspectionSitesFromData,
} from "../src/components/workspace/workspace-sections/machine-valuation/mv-project-contact-data";
import {
  inspectorFilesForSite,
  upsertInspectorFile,
} from "../src/components/workspace/workspace-sections/machine-valuation/mv-site-file-uploads";
import type { MvInspectorFile } from "../src/components/workspace/workspace-sections/machine-valuation/types";

const file = (id: string, locationIds?: string[]): MvInspectorFile => ({
  id,
  name: `${id}.jpg`,
  type: "image",
  url: "",
  uploadedBy: null,
  createdAt: "2026-01-01",
  ...(locationIds ? { locationIds } : {}),
});

test("an empty site is saved when files go to it, and keeps its id", () => {
  const first = { ...createProjectInspectionSiteForm(0), city: "الرياض" };
  const empty = createProjectInspectionSiteForm(1);
  assert.deepEqual(
    projectContactDataFromInspectionSites([first, empty]).locations.map((site) => site.id),
    [first.id],
    "an untouched site is still skipped",
  );
  const kept = projectContactDataFromInspectionSites([first, empty], undefined, { keepSiteIds: new Set([empty.id]) });
  assert.deepEqual(kept.locations.map((site) => site.id), [first.id, empty.id]);
  // Reopening restores the same ids, so files stay on their site.
  const reopened = projectInspectionSitesFromData(kept.locations, kept.contacts);
  assert.deepEqual(reopened.map((site) => site.id), [first.id, empty.id]);
});

test("files are grouped by site; general files are those linked to no site", () => {
  const files = [file("a", ["s1"]), file("b", ["s1", "s2"]), file("c"), file("d", [])];
  assert.deepEqual(inspectorFilesForSite(files, "s1").map((f) => f.id), ["a", "b"]);
  assert.deepEqual(inspectorFilesForSite(files, "s2").map((f) => f.id), ["b"]);
  assert.deepEqual(inspectorFilesForSite(files, null).map((f) => f.id), ["c", "d"]);
});

test("upload answers arriving out of order never drop a file", () => {
  let list: MvInspectorFile[] = [file("a")];
  list = upsertInspectorFile(list, file("c"));
  list = upsertInspectorFile(list, file("b"));
  list = upsertInspectorFile(list, { ...file("c"), name: "renamed.jpg" });
  assert.deepEqual(list.map((f) => f.id), ["a", "c", "b"]);
  assert.equal(list[1]!.name, "renamed.jpg");
});
