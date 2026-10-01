"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, ImageDown, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saudiRiyalWords } from "@/lib/saudi-riyal-words";
import { downloadBlob as download } from "@/lib/download-media";
import { convertPdfFileToPageImages } from "./machine-valuation/mv-pdf-page-images";
import HelperToolsScreenCapture from "./helper-tools-screen-capture";
import HelperImagesToPdf from "./helper-images-to-pdf";
import { useHelperToolsNav } from "@/components/helper-tools-shell";

export default function HelperTools() {
  const { tool, isArabic } = useHelperToolsNav();
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState("");
  const [pages, setPages] = useState<File[]>([]);
  const [amount, setAmount] = useState("");
  const pdfInput = useRef<HTMLInputElement>(null);
  const actions = isArabic
    ? { choosePdf: "اختر PDF", copy: "نسخ", placeholder: "المبلغ بالريال" }
    : { choosePdf: "Choose PDF", copy: "Copy", placeholder: "Amount in SAR" };

  const pageUrls = useMemo(() => pages.map((file) => ({ file, url: URL.createObjectURL(file) })), [pages]);
  useEffect(() => () => pageUrls.forEach((x) => URL.revokeObjectURL(x.url)), [pageUrls]);

  const convertPdf = async (file: File) => {
    setWorking(true);
    setPages([]);
    try {
      const out = await convertPdfFileToPageImages(file, { onProgress: (done, total) => setProgress(`${done} / ${total}`) });
      setPages(out.map((x) => x.file));
    } finally {
      setWorking(false);
      setProgress("");
    }
  };

  const wording = saudiRiyalWords(amount);

  return (
    <main className="h-full min-h-0 p-3" dir={isArabic ? "rtl" : "ltr"}>
      {tool === "screen" && <HelperToolsScreenCapture arabic={isArabic} />}

      {tool === "images" && (
        <HelperImagesToPdf arabic={isArabic} />
      )}

      {tool === "pdf" && (
        <section className="space-y-3">
          <input ref={pdfInput} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && void convertPdf(e.target.files[0])} />
          <Button size="sm" disabled={working} onClick={() => pdfInput.current?.click()}>
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {actions.choosePdf} {progress}
          </Button>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {pageUrls.map(({ file, url }, i) => (
              <div key={file.name} className="overflow-hidden rounded-lg bg-slate-100">
                <img src={url} alt="" className="h-24 w-full object-cover" />
                <Button size="sm" variant="ghost" className="h-8 w-full rounded-none text-xs" onClick={() => download(file, file.name)}>
                  <ImageDown className="h-3 w-3" /> {i + 1}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {tool === "words" && (
        <section className="max-w-xl space-y-3">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={actions.placeholder} className="h-11 text-base" />
          <div className={cn("rounded-xl bg-white px-4 py-3 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]", !wording && "text-slate-300")}>
            <p className="text-lg font-bold leading-8 text-slate-900">{wording || "—"}</p>
            <Button variant="ghost" size="sm" className="mt-1 h-8 px-2" disabled={!wording} onClick={() => void navigator.clipboard.writeText(wording)}>
              <Copy className="h-4 w-4" />{actions.copy}
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
