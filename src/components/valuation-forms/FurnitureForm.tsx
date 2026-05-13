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
  FormSection,
  getBooleanValue,
  getNumberValue,
  getTextValue,
  NumberFormField,
  TextFormField,
  ValuationFormLayout,
} from "./shared";

const furnitureFormSchema = baseValuationSchema
  .extend({
    furnitureType: z.string().trim().max(120, "الحد الأقصى 120 حرفاً"),
    material: z.string().trim().max(120, "الحد الأقصى 120 حرفاً"),
    color: z.string().trim().max(80, "الحد الأقصى 80 حرفاً"),
    setComplete: z.boolean().optional(),
    setTotalPieces: z.number().min(0, "القيمة يجب أن تكون أكبر من أو تساوي صفر").optional(),
    presentPieces: z.number().min(0, "القيمة يجب أن تكون أكبر من أو تساوي صفر").optional(),
    woodType: z.string().trim().max(120, "الحد الأقصى 120 حرفاً"),
    manufacturer: z.string().trim().max(120, "الحد الأقصى 120 حرفاً"),
  })
  .superRefine((values, ctx) => {
    if (
      typeof values.setTotalPieces === "number" &&
      typeof values.presentPieces === "number" &&
      values.presentPieces > values.setTotalPieces
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["presentPieces"],
        message: "عدد القطع الموجودة لا يمكن أن يتجاوز إجمالي القطع.",
      });
    }
  });

type FurnitureFormValues = z.infer<typeof furnitureFormSchema>;

function createFurnitureDefaults(
  asset: AssetValuationFormProps<FurnitureFormValues>["asset"],
): FurnitureFormValues {
  return {
    ...createBaseDefaults(asset),
    furnitureType: getTextValue(asset, "furnitureType"),
    material: getTextValue(asset, "material"),
    color: getTextValue(asset, "color"),
    setComplete: getBooleanValue(asset, "setComplete"),
    setTotalPieces: getNumberValue(asset, "setTotalPieces"),
    presentPieces: getNumberValue(asset, "presentPieces"),
    woodType: getTextValue(asset, "woodType"),
    manufacturer: getTextValue(asset, "manufacturer"),
  };
}

export default function FurnitureForm({
  asset,
  saving = false,
  onSubmit,
}: AssetValuationFormProps<FurnitureFormValues>) {
  const form = useForm<FurnitureFormValues>({
    resolver: zodResolver(furnitureFormSchema),
    defaultValues: createFurnitureDefaults(asset),
  });

  useEffect(() => {
    form.reset(createFurnitureDefaults(asset));
  }, [asset, form]);

  return (
    <ValuationFormLayout
      form={form}
      title="نموذج تقييم الأثاث"
      subtitle="حدّث نوع الطقم والخامة وعدد القطع المكتملة أو المفقودة."
      saving={saving}
      onSubmit={onSubmit}
    >
      <BaseAssetFields control={form.control} />

      <FormSection
        title="بيانات الأثاث"
        description="الحقول الخاصة بالأطقم والمواد والألوان وعدد القطع."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <TextFormField control={form.control} name="furnitureType" label="نوع الأثاث" placeholder="أدخل نوع الأثاث" />
          <TextFormField control={form.control} name="material" label="الخامة" placeholder="أدخل نوع الخامة" />
          <TextFormField control={form.control} name="color" label="اللون" placeholder="أدخل اللون" />
          <BooleanSelectField control={form.control} name="setComplete" label="الطقم مكتمل" />
          <NumberFormField control={form.control} name="setTotalPieces" label="إجمالي القطع" placeholder="أدخل إجمالي عدد القطع" />
          <NumberFormField control={form.control} name="presentPieces" label="القطع الموجودة" placeholder="أدخل عدد القطع الموجودة" />
          <TextFormField control={form.control} name="woodType" label="نوع الخشب" placeholder="أدخل نوع الخشب" />
          <TextFormField control={form.control} name="manufacturer" label="الشركة المصنعة" placeholder="أدخل اسم الشركة المصنعة" />
        </div>
      </FormSection>
    </ValuationFormLayout>
  );
}
