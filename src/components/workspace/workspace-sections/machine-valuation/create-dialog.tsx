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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LanguageContext } from "@/components/layout-provider";
import { cn } from "@/lib/utils";
import { FileText, Layers3, Loader2 } from "lucide-react";
import type { MvProjectContact, MvProjectLocation, MvProjectReportType } from "./types";
import {
  EMPTY_PROJECT_CONTACT_FORM,
  projectContactDataFromForm,
  type MvProjectContactForm,
} from "./mv-project-contact-data";
import { MvProjectContactFields } from "./mv-project-contact-fields";

const copy = {
  en: {
    createProject: "Create New Project",
    createSub: "Create New Sub-Project",
    projectPlaceholder: "Project name…",
    subPlaceholder: "Sub-project name…",
    projectDesc: "Enter a name for the new project.",
    subDesc: "Enter a name for the new sub-project.",
    reportType: "Report type",
    simpleReport: "Simple report",
    simpleReportHint: "Four-step report path for data, photos, valuation, and preview.",
    advancedReport: "Advanced report",
    advancedReportHint: "Reserved for the advanced workflow that will be configured later.",
    soon: "Soon",
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
    reportType: "نوع التقرير",
    simpleReport: "تقرير مبسط",
    simpleReportHint: "مسار من أربع خطوات: بيانات التقرير، الصور، التقييم، والمعاينة.",
    advancedReport: "تقرير متقدم",
    advancedReportHint: "محجوز للمسار المتقدم الذي سيتم ضبطه لاحقاً.",
    soon: "قريباً",
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
      locations?: MvProjectLocation[];
      contacts?: MvProjectContact[];
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
  const [reportType, setReportType] = useState<MvProjectReportType>("simple");
  const [contactForm, setContactForm] = useState<MvProjectContactForm>(EMPTY_PROJECT_CONTACT_FORM);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setReportType("simple");
      setContactForm(EMPTY_PROJECT_CONTACT_FORM);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (variant === "project") {
      onSubmit(trimmed, { reportType, ...projectContactDataFromForm(contactForm) });
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
      <DialogContent className="max-h-[90vh] overflow-hidden rounded-[1.75rem] border-slate-200 bg-[linear-gradient(145deg,#ffffff,#f8fbff)] p-0 shadow-2xl sm:max-w-2xl">
        <div className="rounded-t-[1.75rem] border-b border-slate-200/80 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_34%),linear-gradient(135deg,#f8fafc,#ffffff)] px-6 py-5 text-right">
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
            <MvProjectContactFields
              value={contactForm}
              onChange={setContactForm}
              disabled={loading}
            />
          ) : null}

          {variant === "project" ? (
            <div className="space-y-3 text-right">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-bold text-slate-800">{t.reportType}</p>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                  {isArabic ? "اختيار واحد" : "Single choice"}
                </span>
              </div>
              <RadioGroup
                value={reportType}
                onValueChange={(value) => setReportType(value as MvProjectReportType)}
                className="grid gap-3 sm:grid-cols-2"
                dir="rtl"
              >
                {[
                  {
                    value: "simple" as const,
                    title: t.simpleReport,
                    hint: t.simpleReportHint,
                    icon: FileText,
                    accent: "from-emerald-500 to-teal-500",
                    badge: null,
                  },
                  {
                    value: "advanced" as const,
                    title: t.advancedReport,
                    hint: t.advancedReportHint,
                    icon: Layers3,
                    accent: "from-amber-500 to-orange-500",
                    badge: t.soon,
                  },
                ].map((option) => {
                  const Icon = option.icon;
                  const active = reportType === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "group relative cursor-pointer overflow-hidden rounded-2xl border bg-white p-4 text-right shadow-sm transition",
                        active
                          ? "border-slate-900 shadow-lg shadow-slate-900/10"
                          : "border-slate-200 hover:border-slate-300 hover:shadow-md",
                      )}
                    >
                      <div
                        className={cn(
                          "absolute inset-x-0 top-0 h-1 bg-gradient-to-l opacity-70 transition",
                          option.accent,
                          active ? "opacity-100" : "opacity-50",
                        )}
                      />
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value={option.value} className="mt-1 border-slate-400 text-slate-950" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-bold text-slate-950">{option.title}</p>
                            {option.badge ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                {option.badge}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[11px] leading-5 text-slate-500">{option.hint}</p>
                        </div>
                        <span
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-sm",
                            option.accent,
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>
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
