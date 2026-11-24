"use client";

import React, { createContext, useContext, type ReactNode } from "react";
import type { MvReportDataModel } from "@/components/workspace/workspace-sections/machine-valuation/mv-report-data-models";

/**
 * Template variables: any text in a system template (canvas text on any
 * page, summary-table values) may contain `{{sourceKey}}` tokens. They are
 * replaced with the project's values in the final report, and with sample
 * values in the studio preview — through the same renderer.
 */
export const TEMPLATE_VARIABLE_PATTERN = /\{\{\s*([\w:.\-]+)\s*\}\}/g;

export type TemplateVariableResolver = (key: string) => string | undefined;

const TemplateVariablesContext = createContext<TemplateVariableResolver | null>(null);

export function TemplateVariablesProvider({ resolve, children }: { resolve: TemplateVariableResolver; children: ReactNode }) {
  return <TemplateVariablesContext.Provider value={resolve}>{children}</TemplateVariablesContext.Provider>;
}

/** `null` when no report/preview data is available (e.g. on the editing canvas). */
export function useTemplateVariables(): TemplateVariableResolver | null {
  return useContext(TemplateVariablesContext);
}

export function hasTemplateVariables(text: string | null | undefined): boolean {
  if (!text) return false;
  TEMPLATE_VARIABLE_PATTERN.lastIndex = 0;
  return TEMPLATE_VARIABLE_PATTERN.test(text);
}

/** Replaces every `{{key}}` with its value (unknown or empty → ""). */
export function interpolateTemplateText(text: string, resolve: TemplateVariableResolver | null | undefined): string {
  if (!text || !resolve) return text;
  return text.replace(TEMPLATE_VARIABLE_PATTERN, (_match, key: string) => resolve(key)?.trim() ?? "");
}

export function templateVariableToken(key: string) {
  return `{{${key}}}`;
}

export type TemplateVariableOption = { key: string; label: string; group: string };

/** Variables that are not report-data fields but are always available. */
export const GENERAL_TEMPLATE_VARIABLES: TemplateVariableOption[] = [
  { key: "companyName", label: "اسم الشركة", group: "الشركة" },
  { key: "commercialRegistration", label: "السجل التجاري", group: "الشركة" },
  { key: "companyManagerName", label: "مدير الشركة", group: "الشركة" },
  { key: "companyManagerMembership", label: "رقم العضوية", group: "الشركة" },
  { key: "reportDate", label: "تاريخ التقرير", group: "التقرير" },
];

/** General variables + every field of every company report-data model (deduplicated). */
export function buildTemplateVariableCatalog(models: MvReportDataModel[]): TemplateVariableOption[] {
  const seen = new Set<string>();
  const out: TemplateVariableOption[] = [];
  for (const option of GENERAL_TEMPLATE_VARIABLES) {
    seen.add(option.key);
    out.push(option);
  }
  for (const model of models) {
    for (const section of model.sections) {
      for (const field of section.fields) {
        if (!field.sourceKey || seen.has(field.sourceKey)) continue;
        seen.add(field.sourceKey);
        out.push({ key: field.sourceKey, label: field.label, group: models.length > 1 ? `${model.name} · ${section.title}` : section.title });
      }
    }
  }
  return out;
}

/** Native select that inserts a variable token (compact, keyboard accessible). */
export function TemplateVariableSelect({
  options,
  onInsert,
  label = "إدراج متغير",
  className,
}: {
  options: TemplateVariableOption[];
  onInsert: (token: string, option: TemplateVariableOption) => void;
  label?: string;
  className?: string;
}) {
  const groups = Array.from(new Set(options.map((option) => option.group)));
  return (
    <select
      aria-label={label}
      value=""
      onChange={(event) => {
        const option = options.find((item) => item.key === event.target.value);
        if (option) onInsert(templateVariableToken(option.key), option);
      }}
      className={["h-7 w-full rounded-md border border-sky-200 bg-sky-50 px-1.5 text-[10px] font-black text-[#0C447C]", className].filter(Boolean).join(" ")}
    >
      <option value="">{`{ } ${label}`}</option>
      {groups.map((group) => (
        <optgroup key={group} label={group}>
          {options.filter((option) => option.group === group).map((option) => (
            <option key={option.key} value={option.key}>{option.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
