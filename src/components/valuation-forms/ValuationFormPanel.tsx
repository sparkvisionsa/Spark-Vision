"use client";

import type { SmartGridAssetRecord } from "@/components/smart-grid/SmartGrid";
import ElectronicsForm from "./ElectronicsForm";
import FurnitureForm from "./FurnitureForm";
import MachineryForm from "./MachineryForm";
import VehicleForm from "./VehicleForm";

interface ValuationFormPanelProps {
  asset: SmartGridAssetRecord | null;
  saving?: boolean;
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
}

export default function ValuationFormPanel({
  asset,
  saving = false,
  onSubmit,
}: ValuationFormPanelProps) {
  if (!asset) {
    return (
      <div
        className="flex min-h-[28rem] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center"
        dir="rtl"
      >
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-slate-800">اختر أصلاً من الجدول</h3>
          <p className="max-w-sm text-sm text-slate-500">
            عند تحديد أصل واحد من الشبكة الذكية سيظهر نموذج التقييم المناسب لنوعه هنا.
          </p>
        </div>
      </div>
    );
  }

  if (asset.assetType === "vehicles") {
    return <VehicleForm asset={asset} saving={saving} onSubmit={onSubmit} />;
  }

  if (asset.assetType === "machinery") {
    return <MachineryForm asset={asset} saving={saving} onSubmit={onSubmit} />;
  }

  if (asset.assetType === "electronics") {
    return <ElectronicsForm asset={asset} saving={saving} onSubmit={onSubmit} />;
  }

  if (asset.assetType === "furniture") {
    return <FurnitureForm asset={asset} saving={saving} onSubmit={onSubmit} />;
  }

  return (
    <div
      className="flex min-h-[28rem] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center"
      dir="rtl"
    >
      <div className="space-y-2">
        <h3 className="text-base font-semibold text-slate-800">لا يوجد نموذج مخصص لهذا النوع</h3>
        <p className="max-w-sm text-sm text-slate-500">
          نوع الأصل الحالي مصنف كـ "أخرى"، لذلك لا يوجد نموذج تقييم مخصص له في هذه المرحلة.
        </p>
      </div>
    </div>
  );
}
