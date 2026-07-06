"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { PREVIEW_SESSION_KEY } from "@/lib/mv-word-template/docx-to-pdf";

export default function MvWordReportPreviewPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function renderPreview() {
      try {
        const encoded = sessionStorage.getItem(PREVIEW_SESSION_KEY);
        if (!encoded) {
          setError("لا يوجد تقرير للمعاينة — أعد توليد التقرير من المشروع.");
          setLoading(false);
          return;
        }

        const binary = atob(encoded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        const { renderAsync } = await import("docx-preview");
        const bodyContainer = containerRef.current;
        const styleContainer = styleRef.current;
        if (!bodyContainer || !styleContainer || cancelled) return;

        await renderAsync(blob, bodyContainer, styleContainer, {
          className: "docx-preview-live",
          inWrapper: true,
          breakPages: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          renderHeaders: true,
          renderFooters: true,
          useBase64URL: true,
        });

        if (!cancelled) setLoading(false);
      } catch (previewError) {
        if (!cancelled) {
          setError(
            previewError instanceof Error ? previewError.message : "تعذر عرض معاينة التقرير.",
          );
          setLoading(false);
        }
      }
    }

    void renderPreview();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <h1 className="text-sm font-black text-[#0C447C]">معاينة تقرير Word</h1>
          <p className="text-xs font-semibold text-slate-500">يمكنك الطباعة أو الحفظ كـ PDF من المتصفح</p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 py-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-semibold text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-[#0C447C]" />
            جاري تحميل المعاينة…
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm font-semibold text-rose-800">
            {error}
          </div>
        ) : null}

        <div ref={styleRef} />
        <div ref={containerRef} className="docx-preview-shell rounded-xl bg-white p-2 shadow-sm" />
      </main>
    </div>
  );
}
