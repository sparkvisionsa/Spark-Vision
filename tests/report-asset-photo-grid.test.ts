import test from "node:test";
import assert from "node:assert/strict";
import {
  ASSET_PHOTO_MAX_FRAME_ASPECT,
  ASSET_PHOTO_MIN_FRAME_ASPECT,
  normalizeAssetPhotoFit,
  planAssetPhotoGrid,
} from "../src/components/workspace/workspace-sections/machine-valuation/mv-asset-photo-grid";
import {
  hasUnsupportedColorFunction,
  replaceUnsupportedColorFunctions,
} from "../src/lib/html2canvas-safe-colors";

// Default portrait A4 gallery area (mm).
const PORTRAIT = { widthMm: 186, heightMm: 220, gapXmm: 1, gapYmm: 3 };

test("smart grid picks the layout that fills the page", () => {
  const cases: Array<[number, number, number]> = [
    [1, 1, 1],
    [2, 1, 2],
    [4, 2, 2],
    [6, 2, 3],
    [9, 3, 3],
    [12, 3, 4],
  ];
  for (const [perPage, columns, rows] of cases) {
    const plan = planAssetPhotoGrid({ ...PORTRAIT, perPage });
    assert.deepEqual([plan.columns, plan.rows, plan.perPage], [columns, rows, perPage], `perPage ${perPage}`);
    const aspect = plan.frameWidthMm / plan.frameHeightMm;
    assert.ok(aspect >= ASSET_PHOTO_MIN_FRAME_ASPECT - 1e-9 && aspect <= ASSET_PHOTO_MAX_FRAME_ASPECT + 1e-9, `aspect ${aspect}`);
    assert.ok(plan.frameWidthMm <= plan.cellWidthMm + 1e-9 && plan.frameHeightMm <= plan.cellHeightMm + 1e-9);
  }
});

test("landscape pages get more columns", () => {
  const plan = planAssetPhotoGrid({ widthMm: 269, heightMm: 140, gapXmm: 1, gapYmm: 3, perPage: 6 });
  assert.deepEqual([plan.columns, plan.rows], [3, 2]);
});

test("manual columns are honoured and capped by the minimum frame height", () => {
  const plan = planAssetPhotoGrid({ ...PORTRAIT, perPage: 12, columns: 3 });
  assert.deepEqual([plan.columns, plan.rows, plan.perPage], [3, 4, 12]);
  const capped = planAssetPhotoGrid({ ...PORTRAIT, perPage: 24, columns: 1 });
  assert.equal(capped.columns, 1);
  assert.ok(capped.perPage < 24 && capped.cellHeightMm >= 22, JSON.stringify(capped));
});

test("legacy uniform-size flag maps to a fit mode", () => {
  assert.equal(normalizeAssetPhotoFit(undefined, true), "cover");
  assert.equal(normalizeAssetPhotoFit(undefined, false), "contain");
  assert.equal(normalizeAssetPhotoFit("fill"), "fill");
  assert.equal(normalizeAssetPhotoFit("bogus", false), "contain");
});

test("unsupported colour functions are replaced inside any CSS value", () => {
  const convert = (fn: string) => (fn.startsWith("color(") ? "rgba(1, 2, 3, 1)" : "rgba(9, 9, 9, 0.5)");
  assert.equal(hasUnsupportedColorFunction("rgb(1, 2, 3)"), false);
  assert.equal(hasUnsupportedColorFunction("color(srgb 0.1 0.2 0.3)"), true);
  assert.equal(hasUnsupportedColorFunction("oklch(0.7 0.1 200)"), true);
  assert.equal(
    replaceUnsupportedColorFunctions("color(srgb 0.1 0.2 0.3)", convert),
    "rgba(1, 2, 3, 1)",
  );
  assert.equal(
    replaceUnsupportedColorFunctions(
      "linear-gradient(90deg, color(srgb 1 0 0) 0%, oklab(0.5 0.1 0.1 / 0.5) 100%)",
      convert,
    ),
    "linear-gradient(90deg, rgba(1, 2, 3, 1) 0%, rgba(9, 9, 9, 0.5) 100%)",
  );
  assert.equal(
    replaceUnsupportedColorFunctions("rgba(0, 0, 0, 0.2) 0px 1px 2px 0px, color-mix(in srgb, red 50%, blue) 0px 0px 4px 0px", convert),
    "rgba(0, 0, 0, 0.2) 0px 1px 2px 0px, rgba(9, 9, 9, 0.5) 0px 0px 4px 0px",
  );
  // Unconvertible colours fall back instead of breaking the export.
  assert.equal(replaceUnsupportedColorFunctions("lab(50 0 0)", () => null), "rgba(0, 0, 0, 0)");
});
