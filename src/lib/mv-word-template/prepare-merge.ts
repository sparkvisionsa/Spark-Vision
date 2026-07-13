import type { MvProjectReportData } from "@/components/workspace/workspace-sections/machine-valuation/types";
import type { MvWordMergeImageItem, MvWordMergeInput } from "./build-context";

export type MvWordImageSource = {
  url: string;
  caption?: string;
};

function resolveFetchUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("blob:")) {
    return trimmed;
  }
  if (typeof window !== "undefined" && trimmed.startsWith("/")) {
    return `${window.location.origin}${trimmed}`;
  }
  return trimmed;
}

async function readBrowserImageDimensions(
  image: ArrayBuffer,
): Promise<{ width: number; height: number } | null> {
  if (typeof window === "undefined" || typeof Image === "undefined") return null;
  try {
    const blob = new Blob([image]);
    const url = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("decode"));
        el.src = url;
      });
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      return width > 0 && height > 0 ? { width, height } : null;
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
}

export async function loadWordMergeImages(
  sources: MvWordImageSource[],
  options: { readDimensions?: boolean } = {},
): Promise<MvWordMergeImageItem[]> {
  const validSources = sources.filter((source) => source.url?.trim());
  if (validSources.length === 0) return [];

  const concurrency = 4;
  const items: MvWordMergeImageItem[] = [];

  for (let i = 0; i < validSources.length; i += concurrency) {
    const chunk = validSources.slice(i, i + concurrency);
    const loaded = await Promise.all(
      chunk.map(async (source) => {
        try {
          const response = await fetch(resolveFetchUrl(source.url), {
            credentials: "include",
            cache: "no-store",
          });
          if (!response.ok) return null;
          const image = await response.arrayBuffer();
          if (image.byteLength < 32) return null;
          const dimensions = options.readDimensions ? await readBrowserImageDimensions(image) : null;
          return {
            image,
            caption: source.caption,
            width: dimensions?.width,
            height: dimensions?.height,
          } satisfies MvWordMergeImageItem;
        } catch {
          return null;
        }
      }),
    );
    for (const item of loaded) {
      if (item) items.push(item);
    }
  }

  return items;
}

export async function prepareMvWordMergeInput(params: {
  projectName: string;
  displayNumber?: number | null;
  reportData: MvProjectReportData;
  assetImageSources: MvWordImageSource[];
  valuationImageSources: MvWordImageSource[];
}): Promise<MvWordMergeInput> {
  const [assetImages, valuationImages] = await Promise.all([
    loadWordMergeImages(params.assetImageSources),
    loadWordMergeImages(params.valuationImageSources, { readDimensions: true }),
  ]);

  return {
    projectName: params.projectName,
    displayNumber: params.displayNumber,
    reportData: params.reportData,
    assetImages,
    valuationImages,
  };
}

export async function fetchWordTemplateBuffer(projectId: string, fileId: string): Promise<ArrayBuffer> {
  const response = await fetch(
    `/api/mv/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/download`,
    { credentials: "include" },
  );
  if (!response.ok) {
    throw new Error("تعذر تحميل قالب Word من التخزين.");
  }
  return response.arrayBuffer();
}
