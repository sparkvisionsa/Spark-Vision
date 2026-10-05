import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Dialog, DialogContent, DialogTitle } from "../../src/components/ui/dialog";
import HelperImagesToPdf from "../../src/components/workspace/workspace-sections/helper-images-to-pdf";

function Fixture() {
  const [overlayContainer, setOverlayContainer] = useState<HTMLDivElement | null>(null);
  return (
    <Dialog open>
      <DialogContent hideCloseButton className="z-[910] h-[min(92dvh,920px)] w-[min(96vw,1440px)] max-w-none p-5" dir="rtl">
        <DialogTitle>الأدوات المساعدة</DialogTitle>
        <div ref={setOverlayContainer} className="relative min-h-0 flex-1">
          <HelperImagesToPdf arabic overlayContainer={overlayContainer} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
