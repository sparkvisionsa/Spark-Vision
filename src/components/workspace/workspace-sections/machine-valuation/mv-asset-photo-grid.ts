/**
 * Smart layout of the asset-photo annex: given how many photos a page holds
 * and the free area of the page body, choose the grid (columns × rows) that
 * gives every photo the largest possible frame and fills the page.
 */

export type AssetPhotoFit = "cover" | "contain" | "fill";

export const ASSET_PHOTO_FITS: readonly AssetPhotoFit[] = ["cover", "contain", "fill"];

export const ASSET_PHOTOS_MAX_PER_PAGE = 24;
export const ASSET_PHOTOS_MAX_PER_ROW = 8;
/** Photos are never laid out smaller than this frame height (mm). */
export const ASSET_PHOTO_MIN_CELL_HEIGHT_MM = 22;
/** Height reserved above the gallery for the annex heading (mm). */
export const ASSET_PHOTO_HEADING_RESERVE_MM = 12;
/** Packing guard used by the report paginator (ReportFlowPages). */
const FLOW_RENDER_SAFETY_PX = 8;

/**
 * Height available to the gallery on one page (mm), derived from the same
 * body budget the report paginator uses, so a filled page never spills over.
 */
export function assetGalleryHeightMm(bodyMaxPx: number): number {
  return Math.max(20, ((bodyMaxPx - FLOW_RENDER_SAFETY_PX) * 25.4) / 96 - ASSET_PHOTO_HEADING_RESERVE_MM);
}
/** Default photo aspect ratio used to score grids (4:3 camera photos). */
export const ASSET_PHOTO_ASPECT = 4 / 3;

/**
 * A frame is never wider or taller than these aspect ratios: very wide or
 * very tall frames would crop most of a 4:3 photo. Leftover space is spread
 * evenly between the rows instead.
 */
export const ASSET_PHOTO_MIN_FRAME_ASPECT = 0.95;
export const ASSET_PHOTO_MAX_FRAME_ASPECT = 1.8;

export type AssetPhotoGridPlan = {
  columns: number;
  rows: number;
  /** Grid cell size (mm). */
  cellWidthMm: number;
  cellHeightMm: number;
  /** Photo frame size inside the cell, aspect-limited (mm). */
  frameWidthMm: number;
  frameHeightMm: number;
  /** Height of the whole gallery area (mm). */
  galleryHeightMm: number;
  /** Photos on a full page (columns × rows may exceed it by less than one row). */
  perPage: number;
};

export function normalizeAssetPhotoFit(value: unknown, uniformSizeFallback = true): AssetPhotoFit {
  if (value === "cover" || value === "contain" || value === "fill") return value;
  return uniformSizeFallback ? "cover" : "contain";
}

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Plans a page grid.
 * - `columns` given → manual mode: that many photos per row.
 * - `columns` omitted → smart mode: the column count whose 4:3 photo is
 *   largest inside its frame (so the page is filled with minimum waste).
 * `perPage` is capped so a frame is never shorter than the minimum height.
 */
export function planAssetPhotoGrid({
  perPage,
  widthMm,
  heightMm,
  gapXmm = 0,
  gapYmm = 0,
  columns,
  aspect = ASSET_PHOTO_ASPECT,
}: {
  perPage: number;
  widthMm: number;
  heightMm: number;
  gapXmm?: number;
  gapYmm?: number;
  columns?: number;
  aspect?: number;
}): AssetPhotoGridPlan {
  const width = Math.max(10, widthMm);
  const height = Math.max(10, heightMm);
  const gx = Math.max(0, gapXmm);
  const gy = Math.max(0, gapYmm);
  const maxRows = Math.max(1, Math.floor((height + gy) / (ASSET_PHOTO_MIN_CELL_HEIGHT_MM + gy)));
  const requested = clampInt(perPage, 1, ASSET_PHOTOS_MAX_PER_PAGE);

  const frame = (cols: number, count: number) => {
    const rows = Math.max(1, Math.ceil(count / cols));
    const cellWidthMm = (width - gx * (cols - 1)) / cols;
    const cellHeightMm = (height - gy * (rows - 1)) / rows;
    return {
      columns: cols,
      rows,
      galleryHeightMm: height,
      cellWidthMm,
      cellHeightMm,
      frameWidthMm: Math.min(cellWidthMm, cellHeightMm * ASSET_PHOTO_MAX_FRAME_ASPECT),
      frameHeightMm: Math.min(cellHeightMm, cellWidthMm / ASSET_PHOTO_MIN_FRAME_ASPECT),
    };
  };

  if (columns !== undefined) {
    const cols = clampInt(columns, 1, ASSET_PHOTOS_MAX_PER_ROW);
    const count = Math.min(requested, cols * maxRows);
    return { ...frame(cols, count), perPage: count };
  }

  let best: (ReturnType<typeof frame> & { score: number; count: number }) | null = null;
  const maxCols = Math.min(ASSET_PHOTOS_MAX_PER_ROW, requested);
  for (let cols = 1; cols <= maxCols; cols += 1) {
    const count = Math.min(requested, cols * maxRows);
    const plan = frame(cols, count);
    // Visible photo area: the frame for a cropped (cover) photo, scaled by
    // how far the frame is from the photo's own aspect ratio.
    const frameAspect = plan.frameWidthMm / plan.frameHeightMm;
    const aspectMatch = Math.min(frameAspect, aspect) / Math.max(frameAspect, aspect);
    const area = plan.frameWidthMm * plan.frameHeightMm * (0.75 + 0.25 * aspectMatch);
    // Prefer holding every requested photo, then the largest photos, then
    // the grid with fewer empty cells.
    const emptyCells = plan.columns * plan.rows - count;
    const score = count * 1e6 + area - emptyCells * 0.5;
    if (!best || score > best.score) best = { ...plan, score, count };
  }
  const { score: _score, count, ...chosen } = best!;
  void _score;
  return { ...chosen, perPage: count };
}
