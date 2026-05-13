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
  TextFormField,
  ValuationFormLayout,
} from "./shared";

const electronicsFormSchema = baseValuationSchema.extend({
  brand: z.string().trim().max(120, "الحد الأقصى 120 حرفاً"),
  modelName: z.string().trim().max(120, "الحد الأقصى 120 حرفاً"),
  serialNumber: z.string().trim().max(120, "الحد الأقصى 120 حرفاً"),
  processorSpec: z.string().trim().max(160, "الحد الأقصى 160 حرفاً"),
  ramGB: z.number().min(0, "القيمة يجب أن تكون أكبر من أو تساوي صفر").optional(),
  storageGB: z.number().min(0, "القيمة يجب أن تكون أكبر من أو تساوي صفر").optional(),
  osVersion: z.string().trim().max(120, "الحد الأقصى 120 حرفاً"),
  warrantyExpiry: z
    .string()
    .trim()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), "أدخل تاريخاً صالحاً"),
  screenSizeInch: z.number().min(0, "القيمة يجب أن تكون أكبر من أو تساوي صفر").optional(),
  batteryHealthPercent: z.number().min(0, "الحد الأدنى 0").max(100, "الحد الأقصى 100").optional(),
});

type ElectronicsFormValues = z.infer<typeof electronicsFormSchema>;

function createElectronicsDefaults(
  asset: AssetValuationFormProps<ElectronicsFormValues>["asset"],
): ElectronicsFormValues {
  return {
    ...createBaseDefaults(asset),
    brand: getTextValue(asset, "brand"),
    modelName: getTextValue(asset, "modelName"),
    serialNumber: getTextValue(asset, "serialNumber"),
    processorSpec: getTextValue(asset, "processorSpec"),
    ramGB: getNumberValue(asset, "ramGB"),
    storageGB: getNumberValue(asset, "storageGB"),
    osVersion: getTextValue(asset, "osVersion"),
    warrantyExpiry: getTextValue(asset, "warrantyExpiry"),
    screenSizeInch: getNumberValue(asset, "screenSizeInch"),
    batteryHealthPercent: getNumberValue(asset, "batteryHealthPercent"),
  };
}

export default function ElectronicsForm({
  asset,
  saving = false,
  onSubmit,
}: AssetValuationFormProps<ElectronicsFormValues>) {
  const form = useForm<ElectronicsFormValues>({
    resolver: zodResolver(electronicsFormSchema),
    defaultValues: createElectronicsDefaults(asset),
  });

  useEffect(() => {
    form.reset(createElectronicsDefaults(asset));
  }, [asset, form]);

  return (
    <ValuationFormLayout
      form={form}
      title="نموذج تقييم الأجهزة الإلكترونية"
      subtitle="حدّث المواصفات التقنية، الضمان، وصحة البطارية الخاصة بالجهاز."
      saving={saving}
      onSubmit={onSubmit}
    >
      <BaseAssetFields control={form.control} />

      <FormSection
        title="المواصفات التقنية"
        description="الحقول الفنية الخاصة بالحواسيب والشاشات والأجهزة الإلكترونية."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <TextFormField control={form.control} name="brand" label="العلامة التجارية" placeholder="أدخل العلامة التجارية" />
          <TextFormField control={form.control} name="modelName" label="اسم الموديل" placeholder="أدخل اسم الموديل" />
          <TextFormField control={form.control} name="serialNumber" label="الرقم التسلسلي" placeholder="أدخل الرقم التسلسلي" />
          <TextFormField control={form.control} name="processorSpec" label="المعالج" placeholder="أدخل مواصفة المعالج" />
          <NumberFormField control={form.control} name="ramGB" label="الذاكرة RAM" placeholder="أدخل سعة الذاكرة بالجيجابايت" />
          <NumberFormField control={form.control} name="storageGB" label="سعة التخزين" placeholder="أدخل سعة التخزين بالجيجابايت" />
          <TextFormField control={form.control} name="osVersion" label="نظام التشغيل" placeholder="أدخل إصدار النظام" />
          <DateFormField control={form.control} name="warrantyExpiry" label="انتهاء الضمان" />
          <NumberFormField control={form.control} name="screenSizeInch" label="حجم الشاشة" placeholder="أدخل حجم الشاشة بالبوصة" />
          <NumberFormField control={form.control} name="batteryHealthPercent" label="صحة البطارية" placeholder="أدخل نسبة صحة البطارية" />
        </div>
      </FormSection>
    </ValuationFormLayout>
  );
}
