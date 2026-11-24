"use client";

import { ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { MvReportDataModel } from "@/components/workspace/workspace-sections/machine-valuation/mv-report-data-models";

export type CompanyLetterheadSettings = {
  companyName?: string;
  headerLine?: string;
  footerText?: string;
  logoPosition?: "right" | "center" | "left";
  showOnAllPages?: boolean;
  dataModelId?: string;
};

type Props = {
  value: CompanyLetterheadSettings;
  companyName: string;
  companyLogoSrc?: string | null;
  models: MvReportDataModel[];
  disabled?: boolean;
  onChange: (next: CompanyLetterheadSettings) => void;
};

export function CompanyReportLetterheadEditor({
  value,
  companyName,
  companyLogoSrc,
  models,
  disabled = false,
  onChange,
}: Props) {
  const patch = (next: Partial<CompanyLetterheadSettings>) => onChange({ ...value, ...next });
  const displayName = value.companyName?.trim() || companyName || "شركة التقييم";
  const headerLine = value.headerLine?.trim() || "مقيم معتمد – ترخيص الهيئة السعودية للمقيمين المعتمدين";
  const footerText = value.footerText?.trim() || "الرياض، المملكة العربية السعودية";
  const logoPosition = value.logoPosition ?? "right";

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" dir="rtl">
      <div className="grid min-h-[465px] lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            <select
              value={value.dataModelId ?? models[0]?.id ?? ""}
              onChange={(event) => patch({ dataModelId: event.target.value })}
              disabled={disabled}
              className="h-9 rounded-full border border-sky-100 bg-sky-50 px-3 text-[10px] font-black text-[#0C447C] outline-none"
              aria-label="نموذج بيانات الكليشة"
            >
              {models.map((model) => <option key={model.id} value={model.id}>كليشة {model.name}</option>)}
            </select>
            <span className="inline-flex h-9 items-center rounded-full bg-slate-100 px-3 text-[10px] font-black text-slate-500">كل الصفحات</span>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 px-3 py-3">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white">
              {companyLogoSrc ? <img src={companyLogoSrc} alt="شعار الشركة" className="h-full w-full object-contain p-1" /> : <ImageIcon className="h-5 w-5 text-slate-400" />}
            </span>
            <div>
              <p className="text-[11px] font-black text-slate-800">شعار الشركة</p>
              <p className="text-[9.5px] font-semibold text-slate-400">يؤخذ من الإعدادات العامة ← بيانات الشركة</p>
            </div>
          </div>

          <Label className="grid gap-1.5 text-[10px] font-black text-slate-500">
            اسم الشركة في الرأس
            <Input value={value.companyName ?? companyName} onChange={(event) => patch({ companyName: event.target.value })} disabled={disabled} className="h-9 text-[11px] font-black" />
          </Label>
          <Label className="grid gap-1.5 text-[10px] font-black text-slate-500">
            السطر الثاني في الرأس
            <Input value={value.headerLine ?? ""} onChange={(event) => patch({ headerLine: event.target.value })} disabled={disabled} placeholder={headerLine} className="h-9 text-[11px] font-bold" />
          </Label>
          <Label className="grid gap-1.5 text-[10px] font-black text-slate-500">
            تذييل الصفحة
            <Input value={value.footerText ?? ""} onChange={(event) => patch({ footerText: event.target.value })} disabled={disabled} placeholder={footerText} className="h-9 text-[11px] font-bold" />
          </Label>

          <div>
            <p className="mb-1.5 text-[10px] font-black text-slate-500">موضع الشعار</p>
            <div className="grid grid-cols-3 rounded-xl bg-slate-100 p-1">
              {(["right", "center", "left"] as const).map((position) => (
                <button
                  key={position}
                  type="button"
                  disabled={disabled}
                  onClick={() => patch({ logoPosition: position })}
                  className={cn("h-8 rounded-lg text-[10px] font-black text-slate-500", logoPosition === position && "bg-white text-[#0C447C] shadow-sm")}
                >
                  {{ right: "يمين", center: "وسط", left: "يسار" }[position]}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-[11px] font-black text-slate-700">
            إظهار الكليشة في كل الصفحات
            <Switch checked={value.showOnAllPages !== false} onCheckedChange={(checked) => patch({ showOnAllPages: checked })} disabled={disabled} />
          </label>
        </div>

        <div className="flex items-center justify-center border-t border-slate-100 bg-[#edf6fc] p-6 lg:border-r lg:border-t-0">
          <div className="relative h-[300px] w-[212px] bg-white p-5 shadow-xl">
            <div className={cn("flex items-start gap-2", logoPosition === "center" && "justify-center text-center", logoPosition === "left" && "flex-row-reverse text-left")}>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200">
                {companyLogoSrc ? <img src={companyLogoSrc} alt="" className="h-full w-full object-contain p-0.5" /> : <ImageIcon className="h-4 w-4 text-amber-500" />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[8px] font-black text-slate-900">{displayName}</p>
                <p className="mt-0.5 text-[4.5px] font-bold text-slate-500">{headerLine}</p>
              </div>
            </div>
            <div className="mt-3 h-0.5 bg-[#0C447C]" />
            <div className="mt-4 space-y-2">
              {[100, 94, 88, 96, 80, 92, 72].map((width, index) => <div key={index} className="h-1 rounded bg-slate-100" style={{ width: `${width}%` }} />)}
            </div>
            <div className="absolute inset-x-5 bottom-5 border-t border-amber-400 pt-2 text-[4.5px] font-bold text-slate-500">{footerText}</div>
          </div>
        </div>
      </div>
      <p className="border-t border-slate-100 px-4 py-3 text-[10px] font-semibold text-slate-400">الكليشة خاصة بكل نموذج تقرير، وتظهر في رأس وتذييل صفحات التقرير الناتج.</p>
    </section>
  );
}
