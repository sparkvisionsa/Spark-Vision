"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthTracking } from "@/components/auth-tracking-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toApiUrl } from "@/lib/api-url";
import { cn } from "@/lib/utils";
import { CheckCircle2, FileText, Loader2, Trash2, Upload } from "lucide-react";

type RealEstateWordTemplate = {
  fileName: string;
  fileUrl: string | null;
  uploadedAt: string;
  sizeBytes?: number;
};

async function apiJson<T>(url: string, csrfToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(toApiUrl(url), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message || body.error || "Request failed");
  }
  return (await response.json()) as T;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

/**
 * إعدادات التقرير — قالب Word للتقارير العقارية (transactions).
 * منفصل تماماً عن قالب Word الخاص بتقييم الآلات؛ الشركة نفسها مشتركة
 * لكن القالب يُخزَّن ويُستخدم بشكل مستقل لكل منتج.
 */
export default function ReportSettingsPage() {
  const { user, csrfToken, loading } = useAuthTracking();
  const [template, setTemplate] = useState<RealEstateWordTemplate | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const payload = await apiJson<{ template: RealEstateWordTemplate | null }>(
        "/api/company/real-estate-report-template",
        csrfToken,
      );
      setTemplate(payload.template ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر تحميل القالب.");
    } finally {
      setLoaded(true);
    }
  }, [csrfToken]);

  useEffect(() => {
    if (!loading) void load();
  }, [load, loading]);

  const uploadTemplate = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".docx")) {
        setError("يرجى رفع ملف Word بصيغة .docx فقط.");
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        setError("حجم قالب Word يجب ألا يتجاوز 25MB.");
        return;
      }
      setBusy(true);
      setError(null);
      setStatus(null);
      try {
        const buffer = await file.arrayBuffer();
        const fileDataUrl = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${arrayBufferToBase64(buffer)}`;
        const payload = await apiJson<{ template: RealEstateWordTemplate }>(
          "/api/company/real-estate-report-template",
          csrfToken,
          {
            method: "PUT",
            body: JSON.stringify({
              fileName: file.name,
              fileDataUrl,
              sizeBytes: file.size,
            }),
          },
        );
        setTemplate(payload.template);
        setStatus("تم حفظ قالب Word.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "تعذر رفع القالب.");
      } finally {
        setBusy(false);
      }
    },
    [csrfToken],
  );

  const removeTemplate = useCallback(async () => {
    if (!window.confirm("سيتم حذف قالب Word للتقارير العقارية. هل تريد المتابعة؟")) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await apiJson("/api/company/real-estate-report-template", csrfToken, { method: "DELETE" });
      setTemplate(null);
      setStatus("تم حذف القالب.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر حذف القالب.");
    } finally {
      setBusy(false);
    }
  }, [csrfToken]);

  if (!loading && user?.role !== "company_admin") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6" dir="rtl">
        <p className="text-sm font-semibold text-slate-800">هذه الصفحة لمديري الشركة فقط.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl p-4 md:p-8" dir="rtl">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <FileText className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-bold text-slate-900">إعدادات التقرير</h1>
          <p className="text-[12px] font-medium text-slate-500">قالب ملف Word للتقارير العقارية</p>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}
      {status ? (
        <p className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {status}
        </p>
      ) : null}

      {!loaded ? (
        <div className="flex items-center justify-center rounded-2xl border border-slate-200/80 bg-white py-16 text-slate-400 shadow-sm">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      ) : (
        <section className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:grid-cols-2">
          <label
            className={cn(
              "grid cursor-pointer place-items-center gap-3 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-5 text-center transition hover:border-emerald-300 hover:bg-emerald-50",
              busy && "pointer-events-none opacity-60",
            )}
          >
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = "";
                if (file) void uploadTemplate(file);
              }}
            />
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-emerald-700 shadow-sm">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            </span>
            <span className="text-[13px] font-black text-slate-900">
              {template ? "استبدال قالب Word" : "رفع قالب Word للتقارير العقارية"}
            </span>
            <span className="text-[11px] font-semibold leading-5 text-slate-500">
              ملفات .docx فقط، بحد أقصى 25MB.
            </span>
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            {template ? (
              <div className="grid gap-3">
                <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-100 bg-white p-3">
                  <div className="min-w-0 text-right">
                    <p className="truncate text-[13px] font-black text-slate-900">{template.fileName}</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                      {template.sizeBytes ? `${(template.sizeBytes / 1024 / 1024).toFixed(2)} MB` : "ملف محفوظ"}
                      {" · "}
                      {template.uploadedAt ? new Date(template.uploadedAt).toLocaleDateString("ar") : "بدون تاريخ"}
                    </p>
                  </div>
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                </div>
                <Badge className="w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                  عقاري — منفصل عن قالب تقييم الآلات
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 gap-2 rounded-xl text-[12px] font-black text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                  disabled={busy}
                  onClick={() => void removeTemplate()}
                >
                  <Trash2 className="h-4 w-4" />
                  حذف قالب Word
                </Button>
              </div>
            ) : (
              <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-4 text-center text-[12px] font-semibold leading-6 text-slate-500">
                لا يوجد قالب Word محفوظ للتقارير العقارية حتى الآن.
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
