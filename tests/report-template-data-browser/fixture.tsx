import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MvValuationReportDocumentBody } from "../../src/components/workspace/workspace-sections/machine-valuation/mv-valuation-report-document-body";
import { collectReportTemplateDataGaps, type ReportTemplateDataGap } from "../../src/components/workspace/workspace-sections/machine-valuation/mv-report-data-audit";
import type {
  MvCompanyReportSystemTemplate,
  MvCompanyReportTemplateCanvasElement,
  MvProjectReportData,
} from "../../src/components/workspace/workspace-sections/machine-valuation/types";

declare global {
  interface Window {
    __patchReportData: (patch: Partial<MvProjectReportData>) => void;
    __addInteriorText: (text: string) => void;
    __templateGaps: () => ReportTemplateDataGap[];
  }
}

const noop = () => {};

function element(
  partial: Partial<MvCompanyReportTemplateCanvasElement> & Pick<MvCompanyReportTemplateCanvasElement, "id" | "kind">,
): MvCompanyReportTemplateCanvasElement {
  return { name: partial.id, page: "interior", x: 4, y: 1, width: 40, height: 2.5, rotation: 0, zIndex: 10, opacity: 1, fontSize: 9, ...partial };
}

const BASE_ELEMENTS: MvCompanyReportTemplateCanvasElement[] = [
  element({ id: "client", kind: "binding", binding: "clientName", x: 55, y: 0.5 }),
  element({ id: "title", kind: "binding", binding: "reportTitle", x: 4, y: 0.5 }),
  element({ id: "ref", kind: "binding", binding: "reportReference", x: 4, y: 96.5 }),
  element({ id: "date", kind: "binding", binding: "reportDate", x: 55, y: 96.5 }),
  element({ id: "vars", kind: "text", text: "{{intendedUse}} · {{valuationFirmName}} · {{project.clientName}}", x: 4, y: 3.2, width: 92 }),
];

function template(elements: MvCompanyReportTemplateCanvasElement[]): MvCompanyReportSystemTemplate {
  return {
    templateId: "tpl",
    customTemplates: [
      {
        id: "tpl",
        name: "قالب اختبار",
        canvasElements: elements,
        colors: {
          primary: "#0C447C",
          secondary: "#112233",
          accent: "#c9a227",
          coverText: "#ffffff",
          text: "#111111",
          mutedText: "#555555",
          pageBackground: "#ffffff",
          headerBackground: "#ffffff",
          footerBackground: "#ffffff",
        },
        typography: { fontFamily: "Tajawal", headingFontFamily: "Tajawal", baseFontSize: 12, headingScale: 1, lineHeight: 1.7, fontWeight: 500 },
        assets: {},
        layout: {
          backgroundFit: "cover",
          contentAlign: "right",
          logoPosition: "right",
          pageMarginMm: 12,
          headerHeightMm: 16,
          footerHeightMm: 14,
          coverOverlayOpacity: 0,
          borderRadiusPx: 0,
          showHeader: true,
          showFooter: true,
          showLogo: true,
          showWatermark: false,
        },
      },
    ],
  };
}

function Fixture() {
  const [reportData, setReportData] = useState<MvProjectReportData>({
    clientName: "شركة الاختبار المحدودة",
    reportTitle: "تقرير تقييم خط إنتاج",
    reportReference: "REF-2026-77",
    reportIssueDate: "2026-08-02",
    intendedUse: "التمويل البنكي",
    leadValuerName: "أحمد المقيم",
  } as MvProjectReportData);
  const [elements, setElements] = useState(BASE_ELEMENTS);
  useEffect(() => {
    window.__patchReportData = (patch) => setReportData((current) => ({ ...current, ...patch }));
    window.__addInteriorText = (text) =>
      setElements((current) => [...current, element({ id: `extra-${current.length}`, kind: "text", text, y: 6 })]);
    window.__templateGaps = () => collectReportTemplateDataGaps(document.getElementById("root")!);
  }, []);
  return (
    <main className="bg-slate-200 p-4" dir="rtl">
      <MvValuationReportDocumentBody
        {...({
          projectId: "p1",
          project: null,
          projectName: "مشروع",
          reportData,
          letterheadTemplate: template(elements),
          companyBrand: { name: "شركة التقييم المعتمدة", logoSrc: null, commercialRegistration: "1010" },
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
          includeAssetImages: false,
          includeValuationAccountImages: false,
          orderedImages: [],
          imageOrder: [],
          imageGroupGap: 12,
          imageInnerGap: 4,
          assetImageWidth: 32,
          valuationImageWidth: 86,
          assetImagesPerPage: 6,
          assetImagesPerRow: 3,
          valuationAccountImages: [],
          moveImage: noop,
          hideImage: noop,
          navigate: noop,
          editableSections: [],
          updateEditableSection: noop,
          removeEditableSection: noop,
          draftWatermark: false,
          onReportDataPatch: noop,
          reportPageOrientations: {},
          onReportPageOrientationChange: noop,
          resolveImageSrc: (src: string) => src,
        } as unknown as Parameters<typeof MvValuationReportDocumentBody>[0])}
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
