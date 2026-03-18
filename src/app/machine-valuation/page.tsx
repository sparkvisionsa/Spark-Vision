import type { Metadata } from "next";
import ValueTechShell from "@/components/value-tech-shell";

export const metadata: Metadata = {
  title: "تقييم الآلات - فاليو تك",
};

export default function MachineValuationPage() {
  return (
    <ValueTechShell>
      <div className="flex items-center justify-center px-4 py-10 text-center">
        <div className="max-w-md space-y-3 rounded-3xl border border-slate-200/80 bg-white/80 p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">تقييم الآلات</h1>
          <p className="text-sm leading-relaxed text-slate-600">
            هذه الصفحة قيد التطوير حاليًا، سيتم إضافة مسار تقييم الآلات بالكامل قريبًا.
          </p>
          <p className="text-sm font-semibold text-emerald-700">قريبًا</p>
        </div>
      </div>
    </ValueTechShell>
  );
}

