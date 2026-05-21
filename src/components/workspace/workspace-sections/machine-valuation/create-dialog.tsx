"use client";

import { useContext, useState, useRef, useEffect, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LanguageContext } from "@/components/layout-provider";
import { FileText, Layers3, Loader2 } from "lucide-react";
import type { MvProjectReportType } from "./types";

const copy = {
  en: {
    createProject: "Create New Project",
    createSub: "Create New Sub-Project",
    projectPlaceholder: "Project name…",
    subPlaceholder: "Sub-project name…",
    projectDesc: "Enter a name for the new project.",
    subDesc: "Enter a name for the new sub-project.",
    simpleReport: "Simple report",
    simpleReportHint: "The project will open the streamlined path: locations, asset folders, report data, photos, valuation, and final preview.",
    simpleReportBadge: "Default path",
    advancedReport: "Advanced report",
    advancedReportHint: "Reserved for the advanced workflow and cannot be selected now.",
    advancedReportBadge: "Soon",
    ok: "Create",
    cancel: "Cancel",
  },
  ar: {
    createProject: "إنشاء مشروع جديد",
    createSub: "إنشاء مشروع فرعي",
    projectPlaceholder: "اسم المشروع…",
    subPlaceholder: "اسم المشروع الفرعي…",
    projectDesc: "أدخل اسمًا للمشروع الجديد.",
    subDesc: "أدخل اسمًا للمشروع الفرعي الجديد.",
    simpleReport: "تقرير مبسط",
    simpleReportHint: "سيبدأ المشروع بالمسار المختصر: المواقع، مجلدات الأصول، بيانات التقرير، الصور، التقييم، ثم المعاينة النهائية.",
    simpleReportBadge: "المسار الافتراضي",
    advancedReport: "تقرير متقدم",
    advancedReportHint: "محجوز للمسار المتقدم وغير قابل للاختيار حالياً.",
    advancedReportBadge: "قريباً",
    ok: "إنشاء",
    cancel: "إلغاء",
  },
} as const;

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: "project" | "sub-project";
  loading?: boolean;
  /** محتوى إضافي (مثل اختيار الشركة لسوبر أدمن) */
  extra?: ReactNode;
  /** يمنع الإرسال رغم وجود اسم (مثلاً لم تُختر شركة) */
  submitBlocked?: boolean;
  onSubmit: (
    name: string,
    options?: {
      reportType: MvProjectReportType;
    },
  ) => void;
}

export default function CreateDialog({
  open,
  onOpenChange,
  variant,
  loading,
  extra,
  submitBlocked,
  onSubmit,
}: CreateDialogProps) {
  const langCtx = useContext(LanguageContext);
  const isArabic = langCtx?.language === "ar";
  const t = isArabic ? copy.ar : copy.en;

  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (variant === "project") {
      onSubmit(trimmed, { reportType: "simple" as MvProjectReportType });
      return;
    }
    onSubmit(trimmed, undefined);
  };

  const title = variant === "project" ? t.createProject : t.createSub;
  const desc = variant === "project" ? t.projectDesc : t.subDesc;
  const placeholder =
    variant === "project" ? t.projectPlaceholder : t.subPlaceholder;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-hidden rounded-2xl border-slate-200 bg-white p-0 shadow-2xl sm:max-w-2xl">
        <div className="border-b border-slate-200/80 bg-slate-50 px-6 py-5 text-right">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold tracking-[-0.02em] text-slate-950">{title}</DialogTitle>
            <DialogDescription className="text-[12px] leading-6 text-slate-500">{desc}</DialogDescription>
          </DialogHeader>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="max-h-[calc(90vh-6.5rem)] space-y-5 overflow-y-auto px-6 py-5"
        >
          {extra ? <div className="space-y-2">{extra}</div> : null}
          <div className="space-y-2 text-right">
            <label className="text-[12px] font-bold text-slate-800">
              {variant === "project" ? t.projectPlaceholder.replace("…", "") : t.subPlaceholder.replace("…", "")}
            </label>
            <Input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={placeholder}
              className="h-12 rounded-2xl border-slate-200 bg-white/90 px-4 text-[13px] shadow-sm focus-visible:ring-sky-200"
              dir="auto"
              disabled={loading}
            />
          </div>

          {variant === "project" ? (
            <div className="grid gap-3 text-right sm:grid-cols-2">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-100">
                    <FileText className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13px] font-black text-slate-950">{t.simpleReport}</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-emerald-800 ring-1 ring-emerald-100">
                        {t.simpleReportBadge}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] leading-6 text-slate-600">{t.simpleReportHint}</p>
                  </div>
                </div>
              </div>
              <div
                aria-disabled="true"
                className="select-none rounded-xl border border-slate-200 bg-slate-50/80 p-4 opacity-65"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                    <Layers3 className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13px] font-black text-slate-700">{t.advancedReport}</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">
                        {t.advancedReportBadge}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] leading-6 text-slate-500">{t.advancedReportHint}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-slate-200 bg-white px-5"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t.cancel}
            </Button>
            <Button
              type="submit"
              className="h-10 min-w-[110px] rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800"
              disabled={!name.trim() || loading || submitBlocked}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t.ok
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
