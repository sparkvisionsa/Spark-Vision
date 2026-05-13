"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AssetValuationFormProps,
  BaseAssetFields,
  baseValuationSchema,
  createBaseDefaults,
  DateFormField,
  FormSection,
  getNumberValue,
  getTextValue,
  NumberFormField,
  SelectFormField,
  TextFormField,
  ValuationFormLayout,
} from "./shared";

const POWER_UNIT_OPTIONS = [
  { value: "HP", label: "حصان HP" },
  { value: "KW", label: "كيلوواط KW" },
] as const;

const machineryFormSchema = baseValuationSchema.extend({
  manufacturer: z.string().trim().max(120, "الحد الأقصى 120 حرفاً"),
  modelNumber: z.string().trim().max(120, "الحد الأقصى 120 حرفاً"),
  serialNumber: z.string().trim().max(120, "الحد الأقصى 120 حرفاً"),
  manufactureYear: z.number().min(1900, "سنة الصنع غير منطقية").max(2100, "سنة الصنع غير منطقية").optional(),
  operatingHours: z.number().min(0, "القيمة يجب أن تكون أكبر من أو تساوي صفر").optional(),
  powerOutput: z.number().min(0, "القيمة يجب أن تكون أكبر من أو تساوي صفر").optional(),
  powerUnit: z.string().trim().max(20, "الحد الأقصى 20 حرفاً"),
  lastMaintenanceDate: z
    .string()
    .trim()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), "أدخل تاريخاً صالحاً"),
  nextMaintenanceDate: z
    .string()
    .trim()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), "أدخل تاريخاً صالحاً"),
  capacityTons: z.number().min(0, "القيمة يجب أن تكون أكبر من أو تساوي صفر").optional(),
});

type MachineryFormValues = z.infer<typeof machineryFormSchema>;

function createMachineryDefaults(asset: AssetValuationFormProps<MachineryFormValues>["asset"]): MachineryFormValues {
  return {
    ...createBaseDefaults(asset),
    manufacturer: getTextValue(asset, "manufacturer"),
    modelNumber: getTextValue(asset, "modelNumber"),
    serialNumber: getTextValue(asset, "serialNumber"),
    manufactureYear: getNumberValue(asset, "manufactureYear"),
    operatingHours: getNumberValue(asset, "operatingHours"),
    powerOutput: getNumberValue(asset, "powerOutput"),
    powerUnit: getTextValue(asset, "powerUnit"),
    lastMaintenanceDate: getTextValue(asset, "lastMaintenanceDate"),
    nextMaintenanceDate: getTextValue(asset, "nextMaintenanceDate"),
    capacityTons: getNumberValue(asset, "capacityTons"),
  };
}

export default function MachineryForm({
  asset,
  saving = false,
  onSubmit,
}: AssetValuationFormProps<MachineryFormValues>) {
  const form = useForm<MachineryFormValues>({
    resolver: zodResolver(machineryFormSchema),
    defaultValues: createMachineryDefaults(asset),
  });

  useEffect(() => {
    form.reset(createMachineryDefaults(asset));
  }, [asset, form]);

  return (
    <ValuationFormLayout
      form={form}
      title="نموذج تقييم المعدة"
      subtitle="حدّث بيانات المعدة الثقيلة، ساعات التشغيل، والصيانة المجدولة."
      saving={saving}
      onSubmit={onSubmit}
    >
      <BaseAssetFields control={form.control} />

      <FormSection
        title="البيانات الفنية للمعدة"
        description="تفاصيل الشركة المصنعة والقدرة وساعات التشغيل."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <TextFormField control={form.control} name="manufacturer" label="الشركة المصنعة" placeholder="أدخل اسم الشركة المصنعة" />
          <TextFormField control={form.control} name="modelNumber" label="رقم الموديل" placeholder="أدخل رقم الموديل" />
          <TextFormField control={form.control} name="serialNumber" label="الرقم التسلسلي" placeholder="أدخل الرقم التسلسلي" />
          <NumberFormField control={form.control} name="manufactureYear" label="سنة الصنع" placeholder="أدخل سنة الصنع" />
          <NumberFormField control={form.control} name="operatingHours" label="ساعات التشغيل" placeholder="أدخل ساعات التشغيل" />
          <NumberFormField control={form.control} name="powerOutput" label="القدرة" placeholder="أدخل قيمة القدرة" />
          <SelectFormField
            control={form.control}
            name="powerUnit"
            label="وحدة القدرة"
            placeholder="اختر وحدة القدرة"
            options={[...POWER_UNIT_OPTIONS]}
          />
          <NumberFormField control={form.control} name="capacityTons" label="السعة بالأطنان" placeholder="أدخل السعة بالأطنان" />
          <DateFormField control={form.control} name="lastMaintenanceDate" label="آخر صيانة" />
          <DateFormField control={form.control} name="nextMaintenanceDate" label="الصيانة القادمة" />
        </div>
      </FormSection>
    </ValuationFormLayout>
  );
}
