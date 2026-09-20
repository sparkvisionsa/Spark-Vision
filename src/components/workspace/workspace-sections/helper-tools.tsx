"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, FileText, FolderUp, ImageDown, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saudiRiyalWords } from "@/lib/saudi-riyal-words";
import { downloadBlob as download } from "@/lib/download-media";
import { convertPdfFileToPageImages } from "./machine-valuation/mv-pdf-page-images";
import HelperToolsScreenCapture from "./helper-tools-screen-capture";
import { useHelperToolsNav } from "@/components/helper-tools-shell";

const isImage = (file: File) => file.type.startsWith("image/");

export default function HelperTools() {
  const { tool, isArabic } = useHelperToolsNav();
  const [images, setImages] = useState<File[]>([]);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState("");
  const [pages, setPages] = useState<File[]>([]);
  const [amount, setAmount] = useState("");
  const imageInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const actions = isArabic
    ? { upload: "رفع صور", folder: "رفع مجلد", create: "إنشاء PDF", choosePdf: "اختر PDF", copy: "نسخ", placeholder: "المبلغ بالريال" }
    : { upload: "Upload", folder: "Folder", create: "Create PDF", choosePdf: "Choose PDF", copy: "Copy", placeholder: "Amount in SAR" };

  const imageUrls = useMemo(() => images.map((file) => ({ file, url: URL.createObjectURL(file) })), [images]);
  const pageUrls = useMemo(() => pages.map((file) => ({ file, url: URL.createObjectURL(file) })), [pages]);
  useEffect(() => () => imageUrls.forEach((x) => URL.revokeObjectURL(x.url)), [imageUrls]);
  useEffect(() => () => pageUrls.forEach((x) => URL.revokeObjectURL(x.url)), [pageUrls]);
  const addImages = (files: FileList | null) => setImages((p) => [...p, ...Array.from(files ?? []).filter(isImage)]);

  const makePdf = async () => {
    if (!images.length) return;
    setWorking(true);
    setProgress("...");
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
      for (let i = 0; i < images.length; i++) {
        setProgress(`${i + 1} / ${images.length}`);
        const data = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = reject;
          r.readAsDataURL(images[i]!);
        });
        if (i) pdf.addPage();
        const p = pdf.internal.pageSize;
        pdf.addImage(data, "JPEG", 18, 18, p.getWidth() - 36, p.getHeight() - 36, undefined, "FAST");
      }
      download(pdf.output("blob"), "images.pdf");
    } finally {
      setWorking(false);
      setProgress("");
    }
  };

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
        <section className="space-y-3">
          <input ref={imageInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImages(e.target.files)} />
          <input ref={folderInput} type="file" multiple className="hidden" {...({ webkitdirectory: "" } as object)} onChange={(e) => addImages(e.target.files)} />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => imageInput.current?.click()}><Upload className="h-4 w-4" />{actions.upload}</Button>
            <Button size="sm" variant="outline" onClick={() => folderInput.current?.click()}><FolderUp className="h-4 w-4" />{actions.folder}</Button>
            <Button size="sm" className="ms-auto" disabled={!images.length || working} onClick={() => void makePdf()}>
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {actions.create} {progress}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {imageUrls.map(({ file, url }, i) => (
              <div key={url} className="relative overflow-hidden rounded-lg bg-slate-100">
                <img src={url} alt={file.name} className="h-24 w-full object-cover" />
                <button type="button" onClick={() => setImages((p) => p.filter((_, x) => x !== i))} className="absolute left-1 top-1 rounded-full bg-black/60 p-1 text-white" aria-label={file.name}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </section>
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
