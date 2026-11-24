import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import html2canvas from "html2canvas";
import { MvValuationReportDocumentBody } from "../../src/components/workspace/workspace-sections/machine-valuation/mv-valuation-report-document-body";
import type { MvDriveFile, MvProjectReportData } from "../../src/components/workspace/workspace-sections/machine-valuation/types";
import type { AssetPhotoFit } from "../../src/components/workspace/workspace-sections/machine-valuation/mv-asset-photo-grid";
import { SystemTemplateSummaryTable } from "../../src/components/system-template-summary-table";
import { sanitizeCloneColorsForHtml2Canvas } from "../../src/lib/html2canvas-safe-colors";
import { createCaptureScopeFilter } from "../../src/lib/html2canvas-capture-scope";

type Options = {
  count: number;
  perPage: number;
  perRow: number;
  auto: boolean;
  fit: AssetPhotoFit;
  numbered: boolean;
};

declare global {
  interface Window {
    __setAssetOptions: (next: Partial<Options>) => void;
    __captureColorProbe: (sanitize: boolean) => Promise<string>;
    __setAppChrome: (rows: number) => void;
    __benchmarkCapture: (scoped: boolean, scale: number, limit?: number) => Promise<{ ms: number; sheets: number; hashes: string[] }>;
    __compareCaptures: () => Array<{ differing: number; total: number; maxDiff: number; bbox: string }>;
  }
}

const noop = () => {};

function makeImages(count: number): MvDriveFile[] {
  return Array.from({ length: count }, (_, i) => ({
    _id: `img-${i + 1}`,
    projectId: "p1",
    name: `asset-${i + 1}.png`,
    mimeType: "image/png",
    sizeBytes: 1000,
    uploadedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    scope: "asset",
  }));
}

function Fixture() {
  const [options, setOptions] = useState<Options>({ count: 12, perPage: 9, perRow: 3, auto: true, fit: "cover", numbered: false });
  const [chromeRows, setChromeRows] = useState(0);
  const [orientations, setOrientations] = useState<Record<string, "portrait" | "landscape">>({});
  useEffect(() => {
    window.__setAssetOptions = (next) => setOptions((current) => ({ ...current, ...next }));
    window.__setAppChrome = setChromeRows;
  }, []);
  const images = makeImages(options.count);
  const reportData = {} as MvProjectReportData;
  return (
    <main className="bg-slate-200 p-4" dir="rtl">
      {/* Stand-in for the app UI around the report (sidebars, panels, icon buttons). */}
      <aside data-testid="app-chrome">
        {Array.from({ length: chromeRows }, (_, i) => (
          <div key={i} className="flex items-center gap-2 rounded border border-slate-300 p-1 text-xs shadow-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span className="font-semibold">عنصر {i}</span>
            <button type="button" className="rounded bg-slate-100 px-2">إجراء</button>
          </div>
        ))}
      </aside>
      <div id="color-probe" style={{ width: 600, padding: 12, background: "white" }}>
        <div style={{ height: 30, backgroundColor: "color-mix(in srgb, #0C447C 20%, white)", borderBottom: "3px solid color-mix(in srgb, red 50%, blue)" }}>
          probe
        </div>
        <SystemTemplateSummaryTable
          table={{ enabled: true, title: "ملخص", labelColumnPct: 38, fields: [] }}
          rows={[{ id: "r1", label: "اسم العميل", value: "شركة" }]}
        />
      </div>
      <div data-testid="report-root">
        <MvValuationReportDocumentBody
          {...({
            projectId: "p1",
            project: null,
            projectName: "مشروع",
            reportData,
            companyBrand: { name: "شركة التقييم", logoSrc: null, commercialRegistration: "1010" },
            addEditableSection: noop,
            reportFooterLines: [],
            tocApproxPages: {},
            sectionGap: 22,
            narrativeB1: "",
            narrativeB2: "",
            narrativeB3: "",
            narrativeB4: "",
            introExtraHtml: "",
            onNarrativeB1: noop,
            onNarrativeB2: noop,
            onNarrativeB3: noop,
            onNarrativeB4: noop,
            onIntroExtraHtml: noop,
            assetFolderLabels: [],
            inspectionLocationText: "",
            inspectionMapUrl: "",
            preparerDisplayRows: [],
            updatePreparerRole: noop,
            includeAssetImages: true,
            includeValuationAccountImages: false,
            orderedImages: images,
            imageOrder: images.map((image) => image._id),
            imageGroupGap: 12,
            imageInnerGap: 4,
            assetImageWidth: 32,
            valuationImageWidth: 86,
            assetImagesPerPage: options.perPage,
            assetImagesPerRow: options.perRow,
            assetImagesAutoLayout: options.auto,
            assetImagesFit: options.fit,
            assetImagesNumbered: options.numbered,
            valuationAccountImages: [],
            moveImage: noop,
            hideImage: noop,
            navigate: noop,
            editableSections: [],
            updateEditableSection: noop,
            removeEditableSection: noop,
            draftWatermark: false,
            onReportDataPatch: noop,
            reportPageOrientations: orientations,
            onReportPageOrientationChange: (anchor: string, orientation: "portrait" | "landscape") =>
              setOrientations((current) => ({ ...current, [anchor]: orientation })),
            resolveImageSrc: (src: string) => `/photo.svg?src=${encodeURIComponent(src)}`,
          } as unknown as Parameters<typeof MvValuationReportDocumentBody>[0])}
        />
      </div>
    </main>
  );
}

/** Same as the export: lazy images never load inside html2canvas' off-screen iframe. */
function primeImagesEager() {
  document.querySelectorAll("img").forEach((img) => {
    img.loading = "eager";
  });
}

window.__captureColorProbe = async (sanitize: boolean) => {
  primeImagesEager();
  const el = document.getElementById("color-probe")!;
  try {
    const canvas = await html2canvas(el, {
      logging: false,
      backgroundColor: "#ffffff",
      onclone: sanitize ? (doc, clone) => { sanitizeCloneColorsForHtml2Canvas(doc, clone); } : undefined,
    });
    const ctx = canvas.getContext("2d")!;
    // Pixel inside the color-mix bar (20% #0C447C over white ≈ rgb(206,218,229)).
    const [r, g, b] = ctx.getImageData(Math.round(canvas.width / 2), Math.round(20 * (canvas.width / 600)), 1, 1).data;
    return `ok:${r},${g},${b}`;
  } catch (error) {
    return `error:${error instanceof Error ? error.message : String(error)}`;
  }
};

function canvasHash(canvas: HTMLCanvasElement) {
  const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
  let hash = 2166136261;
  for (let i = 0; i < data.length; i += 1) hash = Math.imul(hash ^ data[i]!, 16777619);
  return `${canvas.width}x${canvas.height}:${(hash >>> 0).toString(16)}`;
}

const scopedCanvases: ImageData[] = [];
const fullCanvases: ImageData[] = [];

/** Per page: how many pixels differ noticeably between the two capture modes. */
window.__compareCaptures = () =>
  fullCanvases.map((full, index) => {
    const scoped = scopedCanvases[index]!;
    let differing = 0;
    let maxDiff = 0;
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
    for (let i = 0; i < full.data.length; i += 4) {
      const d = Math.max(
        Math.abs(full.data[i]! - scoped.data[i]!),
        Math.abs(full.data[i + 1]! - scoped.data[i + 1]!),
        Math.abs(full.data[i + 2]! - scoped.data[i + 2]!),
      );
      maxDiff = Math.max(maxDiff, d);
      if (d > 40) {
        differing += 1;
        const x = (i / 4) % full.width;
        const y = Math.floor(i / 4 / full.width);
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
    return { differing, total: full.width * full.height, maxDiff, bbox: differing ? `${minX},${minY}-${maxX},${maxY}` : "" };
  });

/** Captures every report sheet the way the PDF export does, with or without the clone scope. */
window.__benchmarkCapture = async (scoped: boolean, scale: number, limit?: number) => {
  const sheets = Array.from(document.querySelectorAll<HTMLElement>("[data-testid=report-root] [data-mv-report-sheet]")).slice(0, limit);
  const hashes: string[] = [];
  primeImagesEager();
  const started = performance.now();
  for (const el of sheets) {
    const rect = el.getBoundingClientRect();
    const w = Math.ceil(rect.width);
    const h = Math.ceil(rect.height);
    const canvas = await html2canvas(el, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      scrollX: 0,
      scrollY: 0,
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      removeContainer: true,
      ignoreElements: scoped ? createCaptureScopeFilter(el) : undefined,
      onclone: (doc, clone) => { sanitizeCloneColorsForHtml2Canvas(doc, clone); },
    });
    hashes.push(canvasHash(canvas));
    (scoped ? scopedCanvases : fullCanvases).push(canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height));
  }
  return { ms: Math.round(performance.now() - started), sheets: sheets.length, hashes };
};

createRoot(document.getElementById("root")!).render(<Fixture />);
