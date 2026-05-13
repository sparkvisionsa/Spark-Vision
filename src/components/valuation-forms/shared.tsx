"use client";

import type { ReactNode } from "react";
import type { Control, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { SmartGridAssetRecord } from "@/components/smart-grid/SmartGrid";
import { cn } from "@/lib/utils";

export const ASSET_STATUS_OPTIONS = [
  { value: "pending_review", label: "بانتظار المراجعة" },
  { value: "reviewed", label: "تمت المراجعة" },
  { value: "valued", label: "تم التقييم" },
  { value: "archived", label: "مؤرشف" },
] as const;

export const CURRENCY_OPTIONS = [
  { value: "SAR", label: "ريال سعودي" },
  { value: "USD", label: "دولار أمريكي" },
  { value: "EUR", label: "يورو" },
] as const;

export const VALUATION_METHOD_OPTIONS = [
  { value: "المقارنة السوقية", label: "المقارنة السوقية" },
  { value: "التكلفة", label: "التكلفة" },
  { value: "الدخل", label: "الدخل" },
  { value: "خبير", label: "خبير" },
] as const;

export const baseValuationSchema = z.object({
  assetId: z.string().trim().min(1, "معرف الأصل مطلوب").max(120, "الحد الأقصى 120 حرفاً"),
  assetName: z.string().trim().max(160, "الحد الأقصى 160 حرفاً"),
  purchaseDate: z
    .string()
    .trim()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), "أدخل تاريخاً صالحاً"),
  originalCost: z.number().min(0, "القيمة يجب أن تكون أكبر من أو تساوي صفر").optional(),
  currency: z.string().trim().min(1, "العملة مطلوبة").max(10),
  condition: z.number().min(1, "الحد الأدنى 1").max(5, "الحد الأقصى 5"),
  location: z.string().trim().max(160, "الحد الأقصى 160 حرفاً"),
  notes: z.string().trim().max(1000, "الحد الأقصى 1000 حرف"),
  valuationMethod: z.string().trim().max(120, "الحد الأقصى 120 حرفاً"),
  valuationDate: z
    .string()
    .trim()
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), "أدخل تاريخاً صالحاً"),
  valuedBy: z.string().trim().max(120, "الحد الأقصى 120 حرفاً"),
  status: z.enum(["pending_review", "reviewed", "valued", "archived"]),
});

export type BaseValuationFormValues = z.infer<typeof baseValuationSchema>;

export interface AssetValuationFormProps<TValues extends FieldValues> {
  asset: SmartGridAssetRecord;
  saving?: boolean;
  onSubmit: (values: TValues) => void | Promise<void>;
}

export function readAssetFormValue(
  asset: SmartGridAssetRecord,
  fieldKey: string,
): string | number | boolean | null {
  const directValue = asset[fieldKey];
  if (
    directValue === null ||
    typeof directValue === "string" ||
    typeof directValue === "number" ||
    typeof directValue === "boolean"
  ) {
    return directValue;
  }

  const normalizedValue = asset.normalizedData?.[fieldKey];
  if (
    normalizedValue === null ||
    typeof normalizedValue === "string" ||
    typeof normalizedValue === "number" ||
    typeof normalizedValue === "boolean"
  ) {
    return normalizedValue;
  }

  const rawValue = asset.rawData?.[fieldKey];
  if (
    rawValue === null ||
    typeof rawValue === "string" ||
    typeof rawValue === "number" ||
    typeof rawValue === "boolean"
  ) {
    return rawValue;
  }

  return null;
}

export function getTextValue(asset: SmartGridAssetRecord, fieldKey: string, fallback = "") {
  const value = readAssetFormValue(asset, fieldKey);
  return value === null || value === undefined ? fallback : String(value);
}

export function getNumberValue(asset: SmartGridAssetRecord, fieldKey: string) {
  const value = readAssetFormValue(asset, fieldKey);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function getBooleanValue(asset: SmartGridAssetRecord, fieldKey: string) {
  const value = readAssetFormValue(asset, fieldKey);
  return typeof value === "boolean" ? value : undefined;
}

export function createBaseDefaults(asset: SmartGridAssetRecord): BaseValuationFormValues {
  return {
    assetId: getTextValue(asset, "assetId", asset.id),
    assetName: getTextValue(asset, "assetName"),
    purchaseDate: getTextValue(asset, "purchaseDate"),
    originalCost: getNumberValue(asset, "originalCost"),
    currency: getTextValue(asset, "currency", "SAR") || "SAR",
    condition: getNumberValue(asset, "condition") ?? 3,
    location: getTextValue(asset, "location"),
    notes: getTextValue(asset, "notes"),
    valuationMethod: getTextValue(asset, "valuationMethod"),
    valuationDate: getTextValue(asset, "valuationDate"),
    valuedBy: getTextValue(asset, "valuedBy"),
    status:
      (getTextValue(asset, "status", "pending_review") as BaseValuationFormValues["status"]) ||
      "pending_review",
  };
}

export function serializeValuationValues(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value === undefined ? null : value]),
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="space-y-4 rounded-2xl border p-4"
      style={{
        borderColor: "var(--color-border-tertiary)",
        background: "var(--color-background-secondary)",
      }}
    >
      <div className="space-y-1">
        <h3 className="text-[12px] font-medium" style={{ color: "var(--color-text-primary)" }}>{title}</h3>
        {description ? (
          <p className="text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function ValuationFormLayout<TValues extends FieldValues>({
  form,
  title,
  subtitle,
  saving = false,
  onSubmit,
  children,
}: {
  form: UseFormReturn<TValues>;
  title: string;
  subtitle: string;
  saving?: boolean;
  onSubmit: (values: TValues) => void | Promise<void>;
  children: ReactNode;
}) {
  return (
    <div
      className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm"
      style={{ borderColor: "var(--color-border-tertiary)" }}
      dir="rtl"
    >
      <div className="space-y-1">
        <h2 className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>{title}</h2>
        <p className="text-[12px]" style={{ color: "var(--color-text-secondary)" }}>{subtitle}</p>
      </div>

      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          {children}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4" style={{ borderColor: "var(--color-border-tertiary)" }}>
            <Button type="button" variant="outline" className="h-9 rounded-md px-4 text-[13px]" onClick={() => form.reset()}>
              إعادة ضبط
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="h-9 rounded-md bg-[#378ADD] px-4 text-[13px] text-white hover:bg-[#2d77be]"
            >
              {saving ? "جارٍ الحفظ..." : "حفظ بيانات التقييم"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

type GenericFieldProps<TValues extends FieldValues> = {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  label: string;
  placeholder: string;
  className?: string;
};

export function TextFormField<TValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  className,
}: GenericFieldProps<TValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} value={(field.value as string | undefined) ?? ""} placeholder={placeholder} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function TextareaFormField<TValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  className,
}: GenericFieldProps<TValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea
              {...field}
              value={(field.value as string | undefined) ?? ""}
              placeholder={placeholder}
              className="min-h-[104px]"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function DateFormField<TValues extends FieldValues>({
  control,
  name,
  label,
  className,
}: Omit<GenericFieldProps<TValues>, "placeholder">) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} type="date" value={(field.value as string | undefined) ?? ""} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function NumberFormField<TValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  className,
}: GenericFieldProps<TValues>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              inputMode="decimal"
              value={typeof field.value === "number" ? field.value : ""}
              placeholder={placeholder}
              onChange={(event) => {
                const value = event.target.value;
                field.onChange(value === "" ? undefined : Number(value));
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function SelectFormField<TValues extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  options,
  className,
}: GenericFieldProps<TValues> & {
  options: { value: string; label: string }[];
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <Select value={(field.value as string | undefined) ?? ""} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function BooleanSelectField<TValues extends FieldValues>({
  control,
  name,
  label,
  className,
}: Omit<GenericFieldProps<TValues>, "placeholder">) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label}</FormLabel>
          <Select
            value={
              typeof field.value === "boolean"
                ? field.value
                  ? "true"
                  : "false"
                : "unset"
            }
            onValueChange={(value) => {
              if (value === "unset") {
                field.onChange(undefined);
                return;
              }
              field.onChange(value === "true");
            }}
          >
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="اختر القيمة" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="unset">غير محدد</SelectItem>
              <SelectItem value="true">نعم</SelectItem>
              <SelectItem value="false">لا</SelectItem>
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function ConditionSliderField<TValues extends FieldValues>({
  control,
  name,
  className,
}: {
  control: Control<TValues>;
  name: FieldPath<TValues>;
  className?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <div className="flex items-center justify-between gap-3">
            <FormLabel>حالة الأصل</FormLabel>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {field.value as number}
            </span>
          </div>
          <FormControl>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[typeof field.value === "number" ? field.value : 3]}
              onValueChange={(value) => field.onChange(value[0])}
            />
          </FormControl>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>ضعيف</span>
            <span>متوسط</span>
            <span>ممتاز</span>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function BaseAssetFields<TValues extends BaseValuationFormValues>({
  control,
}: {
  control: Control<TValues>;
}) {
  return (
    <FormSection
      title="البيانات الأساسية"
      description="حقول التقييم المشتركة بين جميع أنواع الأصول."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <TextFormField control={control} name={"assetId" as FieldPath<TValues>} label="معرف الأصل" placeholder="أدخل معرف الأصل" />
        <TextFormField control={control} name={"assetName" as FieldPath<TValues>} label="اسم الأصل" placeholder="أدخل اسم الأصل" />
        <DateFormField control={control} name={"purchaseDate" as FieldPath<TValues>} label="تاريخ الشراء" />
        <NumberFormField control={control} name={"originalCost" as FieldPath<TValues>} label="التكلفة الأصلية" placeholder="أدخل التكلفة الأصلية" />
        <SelectFormField
          control={control}
          name={"currency" as FieldPath<TValues>}
          label="العملة"
          placeholder="اختر العملة"
          options={[...CURRENCY_OPTIONS]}
        />
        <TextFormField control={control} name={"location" as FieldPath<TValues>} label="الموقع" placeholder="أدخل موقع الأصل" />
        <SelectFormField
          control={control}
          name={"valuationMethod" as FieldPath<TValues>}
          label="طريقة التقييم"
          placeholder="اختر طريقة التقييم"
          options={[...VALUATION_METHOD_OPTIONS]}
        />
        <DateFormField control={control} name={"valuationDate" as FieldPath<TValues>} label="تاريخ التقييم" />
        <TextFormField control={control} name={"valuedBy" as FieldPath<TValues>} label="قيّم بواسطة" placeholder="أدخل معرف المقيم" />
        <SelectFormField
          control={control}
          name={"status" as FieldPath<TValues>}
          label="الحالة التشغيلية"
          placeholder="اختر الحالة"
          options={[...ASSET_STATUS_OPTIONS]}
        />
      </div>
      <ConditionSliderField control={control} name={"condition" as FieldPath<TValues>} />
      <TextareaFormField control={control} name={"notes" as FieldPath<TValues>} label="ملاحظات" placeholder="أدخل ملاحظات التقييم أو المراجعة" />
    </FormSection>
  );
}
