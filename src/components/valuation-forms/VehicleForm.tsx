"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AssetValuationFormProps,
  BaseAssetFields,
  baseValuationSchema,
  BooleanSelectField,
  createBaseDefaults,
  DateFormField,
  FormSection,
  getBooleanValue,
  getNumberValue,
  getTextValue,
  NumberFormField,
  SelectFormField,
  TextFormField,
  ValuationFormLayout,
} from "./shared";

const FUEL_TYPE_OPTIONS = [
  { value: "بنزين", label: "بنزين" },
  { value: "ديزل", label: "ديزل" },
  { value: "هجين", label: "هجين" },
  { value: "كهربائي", label: "كهربائي" },
] as const;

const vehicleFormSchema = baseValuationSchema.extend({
  make: z.string().trim().max(120, "الحد الأقصى 120 حرفاً"),
  model: z.string().trim().max(120, "الحد الأقصى 120 حرفاً"),
  year: z.number().min(1900, "سنة الصنع غير منطقية").max(2100, "سنة الصنع غير منطقية").optional(),
  mileageKm: z.number().min(0, "القيمة يجب أن تكون أكبر من أو تساوي صفر").optional(),
  engineSize: z.string().trim().max(80, "الحد الأقصى 80 حرفاً"),
  fuelType: z.string().trim().max(80, "الحد الأقصى 80 حرفاً"),
  licensePlate: z.string().trim().max(80, "الحد الأقصى 80 حرفاً"),
  chassisNumber: z.string().trim().max(120, "الحد الأقصى 120 حرفاً"),
  lastServiceDate: z
    .string()
    .trim()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), "أدخل تاريخاً صالحاً"),
  accidentHistory: z.boolean().optional(),
});

type VehicleFormValues = z.infer<typeof vehicleFormSchema>;

function createVehicleDefaults(asset: AssetValuationFormProps<VehicleFormValues>["asset"]): VehicleFormValues {
  return {
    ...createBaseDefaults(asset),
    make: getTextValue(asset, "make"),
    model: getTextValue(asset, "model"),
    year: getNumberValue(asset, "year"),
    mileageKm: getNumberValue(asset, "mileageKm"),
    engineSize: getTextValue(asset, "engineSize"),
    fuelType: getTextValue(asset, "fuelType"),
    licensePlate: getTextValue(asset, "licensePlate"),
    chassisNumber: getTextValue(asset, "chassisNumber"),
    lastServiceDate: getTextValue(asset, "lastServiceDate"),
    accidentHistory: getBooleanValue(asset, "accidentHistory"),
  };
}

export default function VehicleForm({
  asset,
  saving = false,
  onSubmit,
}: AssetValuationFormProps<VehicleFormValues>) {
  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: createVehicleDefaults(asset),
  });

  useEffect(() => {
    form.reset(createVehicleDefaults(asset));
  }, [asset, form]);

  return (
    <ValuationFormLayout
      form={form}
      title="نموذج تقييم المركبة"
      subtitle="حدّث بيانات المركبة الأساسية والبيانات الفنية الخاصة بالتقييم."
      saving={saving}
      onSubmit={onSubmit}
    >
      <BaseAssetFields control={form.control} />

      <FormSection
        title="بيانات المركبة"
        description="الحقول الفنية الخاصة بالمركبات والسيارات."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <TextFormField control={form.control} name="make" label="الماركة" placeholder="أدخل الماركة" />
          <TextFormField control={form.control} name="model" label="الموديل" placeholder="أدخل الموديل" />
          <NumberFormField control={form.control} name="year" label="سنة الصنع" placeholder="أدخل سنة الصنع" />
          <NumberFormField control={form.control} name="mileageKm" label="العداد بالكيلومتر" placeholder="أدخل العداد بالكيلومتر" />
          <TextFormField control={form.control} name="engineSize" label="حجم المحرك" placeholder="أدخل حجم المحرك" />
          <SelectFormField
            control={form.control}
            name="fuelType"
            label="نوع الوقود"
            placeholder="اختر نوع الوقود"
            options={[...FUEL_TYPE_OPTIONS]}
          />
          <TextFormField control={form.control} name="licensePlate" label="رقم اللوحة" placeholder="أدخل رقم اللوحة" />
          <TextFormField control={form.control} name="chassisNumber" label="رقم الهيكل" placeholder="أدخل رقم الهيكل" />
          <DateFormField control={form.control} name="lastServiceDate" label="تاريخ آخر صيانة" />
          <BooleanSelectField control={form.control} name="accidentHistory" label="سجل الحوادث" />
        </div>
      </FormSection>
    </ValuationFormLayout>
  );
}
