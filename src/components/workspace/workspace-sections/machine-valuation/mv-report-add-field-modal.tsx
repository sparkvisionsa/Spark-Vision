"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MvDialogContent } from "./mv-dialog";
import { useMvI18n } from "./mv-i18n";
import {
  MV_REPORT_CUSTOM_FIELD_TYPES,
  MV_REPORT_CUSTOM_LABEL_MAX_LENGTH,
  type MvReportCustomFieldType,
} from "./mv-report-custom-fields";

export function MvReportAddFieldModal({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (next: { label: string; type: MvReportCustomFieldType; required: boolean }) => void;
}) {
  const { t, dir } = useMvI18n();
  const [label, setLabel] = useState("");
  const [type, setType] = useState<MvReportCustomFieldType>("text");
  const [required, setRequired] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabel("");
    setType("text");
    setRequired(false);
  }, [open]);

  const trimmed = label.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <MvDialogContent
        dir={dir}
        className="max-w-md gap-0 overflow-hidden rounded-2xl border border-slate-200 p-0 shadow-2xl"
      >
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 pe-14">
          <DialogTitle className="text-[15px] font-black text-slate-950">
            {t("reportData.custom.addFieldTitle")}
          </DialogTitle>
          <p className="mt-1 text-[12px] font-medium text-slate-500">{t("reportData.custom.addFieldHint")}</p>
        </div>

        <form
          className="grid gap-4 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!trimmed) return;
            onSubmit({ label: trimmed, type, required });
            onOpenChange(false);
          }}
        >
          <label className="grid gap-2 text-start">
            <span className="text-[11px] font-bold text-slate-500">{t("reportData.custom.fieldName")}</span>
            <Input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={t("reportData.custom.fieldNamePlaceholder")}
              className="h-11 rounded-lg border-slate-300/80 text-[13px] font-bold"
              dir="auto"
              autoFocus
              maxLength={MV_REPORT_CUSTOM_LABEL_MAX_LENGTH}
            />
          </label>

          <label className="grid gap-2 text-start">
            <span className="text-[11px] font-bold text-slate-500">{t("reportData.custom.fieldType")}</span>
            <Select value={type} onValueChange={(value) => setType(value as MvReportCustomFieldType)} dir={dir}>
              <SelectTrigger className="h-11 rounded-lg border-slate-300/80 text-[13px] font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MV_REPORT_CUSTOM_FIELD_TYPES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(`reportData.custom.types.${option}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
            <Checkbox
              checked={required}
              onCheckedChange={(value) => setRequired(value === true)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-extrabold text-slate-900">
                {t("reportData.custom.required")}
              </span>
              <span className="mt-0.5 block text-[11px] font-medium text-slate-500">
                {t("reportData.custom.requiredHint")}
              </span>
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              {t("reportData.custom.cancel")}
            </button>
            <button
              type="submit"
              disabled={!trimmed}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-sky-600 px-4 text-[12px] font-extrabold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {t("reportData.custom.add")}
            </button>
          </div>
        </form>
      </MvDialogContent>
    </Dialog>
  );
}

export function MvReportAddSectionModal({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (title: string) => void;
}) {
  const { t, dir } = useMvI18n();
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle("");
  }, [open]);

  const trimmed = title.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <MvDialogContent
        dir={dir}
        className="max-w-md gap-0 overflow-hidden rounded-2xl border border-slate-200 p-0 shadow-2xl"
      >
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 pe-14">
          <DialogTitle className="text-[15px] font-black text-slate-950">
            {t("reportData.custom.addSectionTitle")}
          </DialogTitle>
        </div>

        <form
          className="grid gap-4 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!trimmed) return;
            onSubmit(trimmed);
            onOpenChange(false);
          }}
        >
          <label className="grid gap-2 text-start">
            <span className="text-[11px] font-bold text-slate-500">{t("reportData.custom.sectionName")}</span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("reportData.custom.sectionNamePlaceholder")}
              className="h-11 rounded-lg border-slate-300/80 text-[13px] font-bold"
              dir="auto"
              autoFocus
              maxLength={MV_REPORT_CUSTOM_LABEL_MAX_LENGTH}
            />
          </label>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-[12px] font-bold text-slate-600 hover:bg-slate-50"
            >
              {t("reportData.custom.cancel")}
            </button>
            <button
              type="submit"
              disabled={!trimmed}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-sky-600 px-4 text-[12px] font-extrabold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {t("reportData.custom.addSection")}
            </button>
          </div>
        </form>
      </MvDialogContent>
    </Dialog>
  );
}
