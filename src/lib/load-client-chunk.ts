/** أخطاء تحميل مقاطع Webpack/Next المحلية — ليست أخطاء بيانات. */
export function isChunkLoadError(error: unknown) {
  if (!error) return false;
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : String(error);
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [^ ]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

export function loadClientChunk<T>(loader: () => Promise<T>, retries = 2): Promise<T> {
  return loader().catch(async (error: unknown) => {
    if (!isChunkLoadError(error) || retries <= 0) throw error;
    await new Promise((resolve) => setTimeout(resolve, retries > 1 ? 280 : 900));
    return loadClientChunk(loader, retries - 1);
  });
}

export const MV_CHUNK_RELOAD_KEY = "sv:mv-chunk-reload";
