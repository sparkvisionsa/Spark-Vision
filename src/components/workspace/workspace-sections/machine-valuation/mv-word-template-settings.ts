export const MV_WORD_ASSET_IMAGES_PER_ROW_OPTIONS = [1, 2, 3, 4, 5, 6] as const;
export type MvWordAssetImagesPerRow =
  (typeof MV_WORD_ASSET_IMAGES_PER_ROW_OPTIONS)[number];

export const MV_WORD_IMAGE_QUALITY_OPTIONS = [60, 70, 80, 90, 95, 100] as const;
export type MvWordImageQuality = (typeof MV_WORD_IMAGE_QUALITY_OPTIONS)[number];

export const DEFAULT_MV_WORD_ASSET_IMAGES_PER_ROW: MvWordAssetImagesPerRow = 4;
export const DEFAULT_MV_WORD_IMAGE_QUALITY: MvWordImageQuality = 100;

export type MvWordImageLayout = {
  imagesPerRow: MvWordAssetImagesPerRow;
  imagesPerPage: number;
  clientImagesPerRow: 1 | 2 | 3;
  clientImagesPerPage: number;
  imageQuality: MvWordImageQuality;
};

export function recommendedMvWordAssetImagesPerPage(
  imagesPerRow: number,
): number {
  if (imagesPerRow <= 1) return 2;
  if (imagesPerRow === 2) return 4;
  return imagesPerRow * (imagesPerRow >= 4 ? 5 : 4);
}

export function normalizeMvWordAssetImagesPerRow(
  value: unknown,
): MvWordAssetImagesPerRow {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_MV_WORD_ASSET_IMAGES_PER_ROW;
  return Math.max(1, Math.min(6, parsed)) as MvWordAssetImagesPerRow;
}

export function normalizeMvWordClientImagesPerRow(value: unknown): 1 | 2 | 3 {
  const parsed = Math.trunc(Number(value));
  if (parsed === 1 || parsed === 3) return parsed;
  return 2;
}

export function normalizeMvWordImageQuality(value: unknown): MvWordImageQuality {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_MV_WORD_IMAGE_QUALITY;

  return MV_WORD_IMAGE_QUALITY_OPTIONS.reduce((nearest, option) =>
    Math.abs(option - parsed) < Math.abs(nearest - parsed) ? option : nearest,
  );
}

export function buildMvWordImageLayout(settings: {
  wordAssetImagesPerRow?: unknown;
  wordImageQuality?: unknown;
  clientDocumentsImagesPerRow?: unknown;
}): MvWordImageLayout {
  const imagesPerRow = normalizeMvWordAssetImagesPerRow(
    settings.wordAssetImagesPerRow,
  );
  const clientImagesPerRow = normalizeMvWordClientImagesPerRow(
    settings.clientDocumentsImagesPerRow,
  );

  return {
    imagesPerRow,
    imagesPerPage: recommendedMvWordAssetImagesPerPage(imagesPerRow),
    clientImagesPerRow,
    clientImagesPerPage: clientImagesPerRow * clientImagesPerRow,
    imageQuality: normalizeMvWordImageQuality(settings.wordImageQuality),
  };
}
