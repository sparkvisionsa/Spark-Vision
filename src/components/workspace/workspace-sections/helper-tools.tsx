"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { Copy, FileImage, FileText, FolderUp, ImageDown, Images, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";
import { saudiRiyalWords } from "@/lib/saudi-riyal-words";
import { convertPdfFileToPageImages } from "./machine-valuation/mv-pdf-page-images";

type Tool = "images" | "pdf" | "words";
const isImage = (file: File) => file.type.startsWith("image/");

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export default function HelperTools() {
  const language = useContext(LanguageContext)?.language ?? "ar";
  const ar = language === "ar";
  const [tool, setTool] = useState<Tool>("images");
  const [images, setImages] = useState<File[]>([]);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState("");
  const [pages, setPages] = useState<File[]>([]);
  const [amount, setAmount] = useState("");
  const imageInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const labels = ar ? {
    title: "الأدوات المساعدة", sub: "أدوات سريعة تعمل محلياً على جهازك — بلا رفع ملفات للخادم.",
    images: "صور إلى PDF", pdf: "PDF إلى صور", words: "تفقيط ", upload: "رفع صور", folder: "رفع مجلد",
    create: "إنشاء ملف PDF", drop: "اختر صوراً أو مجلداً لبدء التحويل", choosePdf: "اختر ملف PDF",
    convert: "تحويل الصفحات إلى صور", result: "النتيجة", input: "اكتب المبلغ بالريال السعودي",
    copy: "نسخ النتيجة", copied: "تم النسخ", empty: "لا توجد ملفات بعد", local: "معالجة محلية وآمنة",
  } : {
    title: "Helper tools", sub: "Fast local tools — your files never leave this device.",
    images: "Images to PDF", pdf: "PDF to images", words: "Saudi riyal in words", upload: "Upload images", folder: "Upload folder",
    create: "Create PDF", drop: "Choose images or a folder to begin", choosePdf: "Choose PDF file",
    convert: "Convert pages to images", result: "Result", input: "Enter amount in Saudi riyals",
    copy: "Copy result", copied: "Copied", empty: "No files yet", local: "Private local processing",
  };
  const imageUrls = useMemo(() => images.map((file) => ({ file, url: URL.createObjectURL(file) })), [images]);
  const pageUrls = useMemo(() => pages.map((file) => ({ file, url: URL.createObjectURL(file) })), [pages]);
  useEffect(() => () => imageUrls.forEach((x) => URL.revokeObjectURL(x.url)), [imageUrls]);
  useEffect(() => () => pageUrls.forEach((x) => URL.revokeObjectURL(x.url)), [pageUrls]);
  const addImages = (files: FileList | null) => setImages((p) => [...p, ...Array.from(files ?? []).filter(isImage)]);
  const makePdf = async () => {
    if (!images.length) return; setWorking(true); setProgress("...");
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
      for (let i = 0; i < images.length; i++) {
        setProgress(`${i + 1} / ${images.length}`);
        const data = await new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(images[i]!); });
        if (i) pdf.addPage();
        const p = pdf.internal.pageSize; pdf.addImage(data, "JPEG", 18, 18, p.getWidth() - 36, p.getHeight() - 36, undefined, "FAST");
      }
      download(pdf.output("blob"), "images.pdf");
    } finally { setWorking(false); setProgress(""); }
  };
  const convertPdf = async (file: File) => {
    setWorking(true); setPages([]);
    try { const out = await convertPdfFileToPageImages(file, { onProgress: (done, total) => setProgress(`${done} / ${total}`) }); setPages(out.map((x) => x.file)); }
    finally { setWorking(false); setProgress(""); }
  };
  const wording = saudiRiyalWords(amount);
  return <main className="mx-auto w-full max-w-7xl p-4 sm:p-7" dir={ar ? "rtl" : "ltr"}>
    <section className="overflow-hidden rounded-3xl bg-gradient-to-bl from-[#0c447c] via-[#0b5d94] to-slate-950 p-6 text-white shadow-xl sm:p-9">
      <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold"><Sparkles className="h-4 w-4" />{labels.local}</span>
      <h1 className="mt-4 text-3xl font-black tracking-tight">{labels.title}</h1><p className="mt-2 max-w-2xl text-sm text-sky-100">{labels.sub}</p>
    </section>
    <section className="mt-5 grid gap-5 lg:grid-cols-[230px_1fr]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {([{ id:"images", icon:Images, label:labels.images }, { id:"pdf", icon:FileImage, label:labels.pdf }, { id:"words", icon:FileText, label:labels.words }] as const).map(({id,icon:Icon,label}) => <button key={id} onClick={() => setTool(id)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-bold transition", tool===id ? "bg-sky-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50")}><Icon className="h-4 w-4"/>{label}</button>)}
      </aside>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {tool==="images" && <><h2 className="text-xl font-black text-slate-900">{labels.images}</h2><p className="mt-1 text-sm text-slate-500">{labels.drop}</p>
          <input ref={imageInput} type="file" accept="image/*" multiple className="hidden" onChange={e=>addImages(e.target.files)}/><input ref={folderInput} type="file" multiple className="hidden" {...({ webkitdirectory:"" } as object)} onChange={e=>addImages(e.target.files)}/>
          <div className="mt-5 flex flex-wrap gap-2"><Button onClick={()=>imageInput.current?.click()}><Upload className="h-4 w-4"/>{labels.upload}</Button><Button variant="outline" onClick={()=>folderInput.current?.click()}><FolderUp className="h-4 w-4"/>{labels.folder}</Button><Button className="ms-auto" disabled={!images.length||working} onClick={()=>void makePdf()}>{working?<Loader2 className="h-4 w-4 animate-spin"/>:<FileText className="h-4 w-4"/>}{labels.create} {progress}</Button></div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{imageUrls.map(({file,url},i)=><div key={url} className="group relative overflow-hidden rounded-xl bg-slate-100"><img src={url} alt={file.name} className="h-28 w-full object-cover"/><button onClick={()=>setImages(p=>p.filter((_,x)=>x!==i))} className="absolute left-1 top-1 rounded-full bg-black/60 p-1 text-white"><X className="h-3 w-3"/></button><p className="truncate p-2 text-[10px]">{file.name}</p></div>)}</div>
        </>}
        {tool==="pdf" && <><h2 className="text-xl font-black text-slate-900">{labels.pdf}</h2><p className="mt-1 text-sm text-slate-500">{labels.local}</p><input ref={pdfInput} type="file" accept="application/pdf" className="hidden" onChange={e=>e.target.files?.[0]&&void convertPdf(e.target.files[0])}/><Button className="mt-5" disabled={working} onClick={()=>pdfInput.current?.click()}>{working?<Loader2 className="h-4 w-4 animate-spin"/>:<Upload className="h-4 w-4"/>}{labels.choosePdf} {progress}</Button><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{pageUrls.map(({file,url},i)=><div key={file.name} className="rounded-xl bg-slate-50 p-2"><img src={url} alt="" className="h-28 w-full object-cover"/><Button size="sm" variant="ghost" className="mt-1 w-full text-xs" onClick={()=>download(file,file.name)}><ImageDown className="h-3 w-3"/> {i+1}</Button></div>)}</div></>}
        {tool==="words" && <><h2 className="text-xl font-black text-slate-900">{labels.words}</h2><p className="mt-1 text-sm text-slate-500">{labels.input}</p><Input value={amount} onChange={e=>setAmount(e.target.value)} inputMode="decimal" placeholder="" className="mt-5 max-w-xl text-lg"/><div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-5"><p className="text-xs font-bold text-emerald-700">{labels.result}</p><p className="mt-2 text-xl font-black leading-9 text-slate-900">{wording||"—"}</p><Button variant="outline" size="sm" className="mt-4" disabled={!wording} onClick={()=>void navigator.clipboard.writeText(wording)}><Copy className="h-4 w-4"/>{labels.copy}</Button></div></>}
      </section>
    </section>
  </main>;
}
