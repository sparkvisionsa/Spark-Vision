"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, Check, Copy, FileImage, ImageDown, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { sanitizeSaudiRiyalAmount, saudiRiyalWords } from "@/lib/saudi-riyal-words";
import { downloadBlob as download } from "@/lib/download-media";
import { convertPdfFileToPageImages } from "./machine-valuation/mv-pdf-page-images";
import HelperToolsScreenCapture from "./helper-tools-screen-capture";
import HelperImagesToPdf from "./helper-images-to-pdf";
import HelperVideoLibrary from "./helper-video-library";
import { useHelperToolsNav } from "@/components/helper-tools-shell";
import { useAuthTracking } from "@/components/auth-tracking-provider";

export default function HelperTools({ overlayContainer }: { overlayContainer?: HTMLElement | null }) {
  const { tool, isArabic } = useHelperToolsNav();
  const { user, session, csrfToken } = useAuthTracking();
  const pdfOwnerKey = `${user?.companyId ?? user?.id ?? "guest"}:${session?.id ?? "pending"}`;
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [pages, setPages] = useState<File[]>([]);
  const [amount, setAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);
  const copiedTimer = useRef<number | null>(null);
  const actions = isArabic
    ? {
        choosePdf: "اختر PDF",
        pdfTitle: "تحويل PDF إلى صور",
        converting: "جارٍ التحويل",
        conversionFailed: "تعذر تحويل ملف PDF. حاول استخدام ملف آخر.",
        convertedPages: "الصور الناتجة",
        page: "الصفحة",
        download: "تحميل",
        copy: "نسخ النص",
        copied: "تم النسخ",
        wordsTitle: "تفقيط المبلغ",
        amountLabel: "المبلغ بالريال",
        resultLabel: "المبلغ كتابةً",
      }
    : {
        choosePdf: "Choose PDF",
        pdfTitle: "PDF to images",
        converting: "Converting",
        conversionFailed: "Could not convert this PDF. Try another file.",
        convertedPages: "Converted images",
        page: "Page",
        download: "Download",
        copy: "Copy text",
        copied: "Copied",
        wordsTitle: "Amount in words",
        amountLabel: "Amount in SAR",
        resultLabel: "Written amount",
      };

  const pageUrls = useMemo(() => pages.map((file) => ({ file, url: URL.createObjectURL(file) })), [pages]);
  useEffect(() => () => pageUrls.forEach((x) => URL.revokeObjectURL(x.url)), [pageUrls]);
  useEffect(() => () => {
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
  }, []);

  const convertPdf = async (file: File) => {
    setWorking(true);
    setPages([]);
    setPdfName(file.name);
    setPdfError("");
    setProgress(null);
    try {
      const out = await convertPdfFileToPageImages(file, { onProgress: (done, total) => setProgress({ done, total }) });
      setPages(out.map((x) => x.file));
    } catch {
      setPdfError(actions.conversionFailed);
    } finally {
      setWorking(false);
      setProgress(null);
    }
  };

  const wording = saudiRiyalWords(amount);
  const progressPercent = progress?.total ? Math.min(100, Math.round((progress.done / progress.total) * 100)) : 0;
  const updateAmount = (value: string) => {
    setAmount(sanitizeSaudiRiyalAmount(value));
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = null;
    setCopied(false);
  };
  const copyWording = async () => {
    if (!wording) return;
    await navigator.clipboard.writeText(wording);
    setCopied(true);
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => {
      setCopied(false);
      copiedTimer.current = null;
    }, 3000);
  };

  return (
    <main className="h-full min-h-0 p-3" dir={isArabic ? "rtl" : "ltr"}>
      {tool === "screen" && <HelperToolsScreenCapture arabic={isArabic} />}

      {tool === "library" && <HelperVideoLibrary />}

      {tool === "images" && (
        <HelperImagesToPdf key={pdfOwnerKey} arabic={isArabic} overlayContainer={overlayContainer} csrfToken={csrfToken} />
      )}

      {tool === "pdf" && (
        <section className="flex min-h-full min-w-0 items-center justify-center px-0 py-[clamp(0.5rem,2vh,1.5rem)] sm:px-6">
          <div className="w-full min-w-0 max-w-5xl rounded-[clamp(1rem,4vw,2rem)] border border-slate-200/90 bg-white/95 p-[clamp(0.875rem,3.5vw,2.5rem)] shadow-[0_28px_80px_-36px_rgba(15,23,42,0.45)] backdrop-blur">
            <header className="mx-auto mb-[clamp(0.75rem,2.5vh,1.5rem)] max-w-xl text-center">
              <span className="mx-auto mb-2 flex h-[clamp(2.75rem,7vh,3.5rem)] w-[clamp(2.75rem,7vh,3.5rem)] items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm">
                <FileImage className="h-[clamp(1.35rem,3.5vh,1.75rem)] w-[clamp(1.35rem,3.5vh,1.75rem)]" aria-hidden />
              </span>
              <h1 className="text-[clamp(1.35rem,3.5vh,1.875rem)] font-bold tracking-tight text-slate-950">{actions.pdfTitle}</h1>
            </header>

            <input
              ref={pdfInput}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void convertPdf(file);
              }}
            />

            <div className="mx-auto max-w-3xl rounded-[clamp(1rem,4vw,1.5rem)] border-2 border-dashed border-slate-200 bg-slate-50/70 p-[clamp(1rem,4vw,2rem)] text-center">
              <Button
                type="button"
                disabled={working}
                onClick={() => pdfInput.current?.click()}
                className="h-12 w-full rounded-xl px-6 font-bold shadow-sm sm:w-auto sm:min-w-44"
              >
                {working ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Upload className="h-5 w-5" aria-hidden />}
                {working ? actions.converting : actions.choosePdf}
              </Button>

              {pdfName ? <p className="mx-auto mt-3 max-w-full truncate text-sm font-medium text-slate-600" title={pdfName}>{pdfName}</p> : null}

              {working ? (
                <div className="mx-auto mt-4 max-w-md" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs font-semibold text-slate-600">
                    <span>{actions.converting}</span>
                    <span dir="ltr">{progress ? `${progress.done} / ${progress.total}` : "…"}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-300" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              ) : null}

              {pdfError ? <p className="mt-3 text-sm font-semibold text-rose-700" role="alert">{pdfError}</p> : null}
            </div>

            {pageUrls.length ? (
              <div className="mt-[clamp(1rem,3vh,2rem)] rounded-[clamp(1rem,4vw,1.5rem)] border border-slate-200 bg-slate-50/50 p-[clamp(0.75rem,3vw,1.5rem)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-slate-800">{actions.convertedPages}</h2>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{pageUrls.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {pageUrls.map(({ file, url }, i) => (
                    <article key={file.name} className="group min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                      <div className="aspect-[4/3] overflow-hidden bg-slate-100 p-2">
                        <img src={url} alt={`${actions.page} ${i + 1}`} className="h-full w-full rounded-xl object-contain" />
                      </div>
                      <div className="flex min-w-0 items-center justify-between gap-2 border-t border-slate-100 p-2.5">
                        <span className="truncate text-xs font-bold text-slate-600">{actions.page} {i + 1}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 shrink-0 rounded-lg px-2.5 text-xs"
                          onClick={() => download(file, file.name)}
                          aria-label={`${actions.download} ${actions.page} ${i + 1}`}
                        >
                          <ImageDown className="h-3.5 w-3.5" aria-hidden />
                          {actions.download}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      )}

      {tool === "words" && (
        <section className="flex min-h-full min-w-0 items-center justify-center px-0 py-[clamp(0.5rem,2vh,1.5rem)] sm:px-6">
          <div className="w-full min-w-0 max-w-4xl rounded-[clamp(1rem,4vw,2rem)] border border-slate-200/90 bg-white/95 p-[clamp(0.875rem,3.5vw,2.5rem)] shadow-[0_28px_80px_-36px_rgba(15,23,42,0.45)] backdrop-blur">
            <header className="mx-auto mb-[clamp(0.75rem,2.5vh,1.5rem)] max-w-xl text-center">
              <span className="mx-auto mb-2 flex h-[clamp(2.75rem,7vh,3.5rem)] w-[clamp(2.75rem,7vh,3.5rem)] items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm">
                <Banknote className="h-[clamp(1.35rem,3.5vh,1.75rem)] w-[clamp(1.35rem,3.5vh,1.75rem)]" aria-hidden />
              </span>
              <h1 className="text-[clamp(1.35rem,3.5vh,1.875rem)] font-bold tracking-tight text-slate-950">{actions.wordsTitle}</h1>
            </header>

            <div className="mx-auto grid min-w-0 w-full max-w-3xl gap-[clamp(0.75rem,2vh,1.25rem)]">
              <label className="block min-w-0 space-y-2">
                <span className="block text-center text-base font-semibold text-slate-700">{actions.amountLabel}</span>
                <Input
                  value={amount}
                  onChange={(event) => updateAmount(event.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label={actions.amountLabel}
                  className="h-[clamp(3rem,8vh,4rem)] rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-6 text-center text-[clamp(1.25rem,3.5vh,1.5rem)] font-semibold tabular-nums text-slate-950 shadow-sm outline-none transition focus-visible:border-emerald-500 focus-visible:ring-4 focus-visible:ring-emerald-500/10"
                  dir="ltr"
                />
              </label>

              <div className={cn(
                "min-w-0 rounded-[clamp(1rem,4vw,1.5rem)] border-2 p-[clamp(0.75rem,3vw,1.75rem)] transition-colors",
                wording ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-slate-50/70",
              )}>
                <span className="block text-center text-sm font-bold text-slate-600">{actions.resultLabel}</span>
                <p className={cn(
                  "mt-2 flex min-h-[clamp(4rem,12vh,7rem)] min-w-0 items-center justify-center break-words text-center text-[clamp(1rem,3vw,1.5rem)] font-bold leading-[1.75] [overflow-wrap:anywhere]",
                  wording && "text-slate-900",
                )}>
                  {wording}
                </p>

                <div className="mt-[clamp(0.5rem,1.5vh,1rem)] flex min-w-0 justify-center">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!wording}
                    onClick={() => void copyWording()}
                    className={cn(
                      "h-[clamp(2.5rem,6vh,2.75rem)] w-full min-w-0 rounded-xl px-4 font-bold shadow-sm transition-all sm:w-auto sm:min-w-36 sm:px-5",
                      copied && "bg-emerald-600 text-white hover:bg-emerald-600",
                    )}
                    aria-live="polite"
                  >
                    {copied ? <Check className="h-5 w-5 text-white" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                    {copied ? actions.copied : actions.copy}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
