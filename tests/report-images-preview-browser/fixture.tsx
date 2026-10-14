import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MvReportImagesSelectModal } from "../../src/components/workspace/workspace-sections/machine-valuation/mv-report-images-select-modal";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#dce8ec"/><rect x="250" y="160" width="700" height="480" rx="25" fill="#334155"/><rect x="310" y="230" width="450" height="340" fill="#f97316"/></svg>`;
const previewUrl = `data:image/svg+xml,${encodeURIComponent(svg)}`;

function Fixture() {
  const [open, setOpen] = useState(true);
  return (
    <MvReportImagesSelectModal
      open={open}
      onOpenChange={setOpen}
      sections={[
        {
          id: "asset-1",
          name: "فرن حراري",
          pathLabel: "خط الإنتاج / الأفران",
          images: Array.from({ length: 5 }, (_, index) => ({
            key: `oven-${index + 1}`,
            name: `فرن حراري ${index + 1}`,
            previewUrl,
            selected: false,
          })),
        },
        {
          id: "asset-2",
          name: "رافعة شوكية",
          pathLabel: "المستودع الرئيسي",
          images: Array.from({ length: 5 }, (_, index) => ({
            key: `forklift-${index + 1}`,
            name: `رافعة شوكية ${index + 1}`,
            previewUrl,
            selected: false,
          })),
        },
        {
          id: "asset-3",
          name: "مولد احتياطي",
          pathLabel: "غرفة الطاقة",
          images: Array.from({ length: 5 }, (_, index) => ({
            key: `generator-${index + 1}`,
            name: `مولد احتياطي ${index + 1}`,
            previewUrl,
            selected: false,
          })),
        },
      ]}
      onApplySelection={() => {}}
    />
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
