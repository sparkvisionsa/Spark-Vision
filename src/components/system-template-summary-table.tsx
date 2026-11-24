import React, { type ReactNode } from "react";
import type {
  MvCompanyReportSummaryTable,
  MvCompanyReportSummaryTableField,
} from "@/components/workspace/workspace-sections/machine-valuation/types";
import type { MvReportDataModel } from "@/components/workspace/workspace-sections/machine-valuation/mv-report-data-models";
import { formatTemplateReportDate } from "@/components/system-report-template-canvas";
import { interpolateTemplateText } from "@/components/system-template-variables";

export const SUMMARY_TABLE_DEFAULT_LABEL_PCT = 38;
export const SUMMARY_TABLE_MAX_FIELDS = 60;

/** Report section that hosts the template's summary table (executive summary / value opinion). */
export const SUMMARY_TABLE_ANCHOR = "mv-toc-24";

export type SummaryFieldType = NonNullable<MvCompanyReportSummaryTableField["type"]>;

export type SummaryFieldCatalogEntry = {
  sourceKey: string;
  label: string;
  type: SummaryFieldType;
  sectionTitle: string;
};

export type SummaryFieldCatalogGroup = {
  modelId: string;
  modelName: string;
  fields: SummaryFieldCatalogEntry[];
};

function fieldType(value: unknown): SummaryFieldType {
  return value === "textarea" || value === "number" || value === "date" ? value : "text";
}

/** Every field of every company report-data model, grouped by model. */
export function buildSummaryFieldCatalog(models: MvReportDataModel[]): SummaryFieldCatalogGroup[] {
  return models.map((model) => {
    const seen = new Set<string>();
    return {
      modelId: model.id,
      modelName: model.name,
      fields: model.sections.flatMap((section) =>
        section.fields.flatMap((field) => {
          if (!field.sourceKey || seen.has(field.sourceKey)) return [];
          seen.add(field.sourceKey);
          return [{ sourceKey: field.sourceKey, label: field.label, type: fieldType(field.type), sectionTitle: section.title }];
        }),
      ),
    };
  }).filter((group) => group.fields.length > 0);
}

export function normalizeSummaryTable(raw: unknown): MvCompanyReportSummaryTable | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const data = raw as Record<string, unknown>;
  const seen = new Set<string>();
  const fields = (Array.isArray(data.fields) ? data.fields : []).slice(0, SUMMARY_TABLE_MAX_FIELDS).flatMap((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const field = item as Record<string, unknown>;
    const sourceKey = typeof field.sourceKey === "string" ? field.sourceKey.trim().slice(0, 160) : "";
    if (!sourceKey) return [];
    const id = (typeof field.id === "string" && field.id.trim() ? field.id.trim() : `summary-field-${index + 1}`).slice(0, 120);
    if (seen.has(id)) return [];
    seen.add(id);
    const valueTemplate = typeof field.valueTemplate === "string" ? field.valueTemplate.slice(0, 1000) : "";
    return [{
      id,
      sourceKey,
      label: typeof field.label === "string" ? field.label.trim().slice(0, 180) : "",
      type: fieldType(field.type),
      ...(valueTemplate.trim() ? { valueTemplate } : {}),
    }];
  });
  const pct = typeof data.labelColumnPct === "number" && Number.isFinite(data.labelColumnPct)
    ? Math.max(20, Math.min(70, data.labelColumnPct))
    : SUMMARY_TABLE_DEFAULT_LABEL_PCT;
  const title = typeof data.title === "string" ? data.title.trim().slice(0, 180) : "";
  return { enabled: data.enabled === true, ...(title ? { title } : {}), labelColumnPct: pct, fields };
}

/** True when the template has a summary table that should be printed. */
export function hasActiveSummaryTable(table: MvCompanyReportSummaryTable | undefined | null): table is MvCompanyReportSummaryTable {
  return Boolean(table?.enabled && table.fields.length > 0);
}

export type SummaryValueContext = {
  /** Values the report already formats (client name, final value, …), by source key. */
  resolved: Record<string, string>;
  /** The project's report data (system source keys). */
  reportData: Record<string, unknown>;
  /** The project's custom report fields (`field:<id>` source keys). */
  customFields: Array<{ id: string; value?: string | null; type?: string }>;
};

const summaryNumberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** Value for one summary-table row, taken from the project's report data. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z?)?$/;

/**
 * Value of one report variable / field (system key or `field:<id>`), taken
 * from the project's report data. Dates are printed as `2026/08/02 م`.
 */
export function resolveTemplateVariableValue(key: string, ctx: SummaryValueContext, type?: SummaryFieldType): string {
  const format = (raw: unknown, valueType: SummaryFieldType | undefined = type): string => {
    if (raw === null || raw === undefined) return "";
    if (Array.isArray(raw)) return raw.map((item) => format(item, valueType)).filter(Boolean).join("، ");
    if (typeof raw === "number") return Number.isFinite(raw) ? summaryNumberFormatter.format(raw) : "";
    if (typeof raw !== "string") return "";
    const text = raw.trim();
    if (!text) return "";
    if (valueType === "date" || (valueType === undefined && ISO_DATE.test(text))) return formatTemplateReportDate(text) ?? text;
    if (valueType === "number" && /^-?[\d,]+(?:\.\d+)?$/.test(text)) {
      const numeric = Number(text.replace(/,/g, ""));
      return Number.isFinite(numeric) ? summaryNumberFormatter.format(numeric) : text;
    }
    return text;
  };
  if (Object.prototype.hasOwnProperty.call(ctx.resolved, key)) return ctx.resolved[key]?.trim() ?? "";
  if (key.startsWith("field:")) {
    const id = key.slice("field:".length);
    const field = ctx.customFields.find((item) => item.id === id);
    // A date field prints like every report date (same as Word / PowerPoint);
    // other values print exactly as typed (a year stays 2019, not 2,019).
    return format(field?.value ?? "", type ?? (field?.type === "date" ? "date" : "text"));
  }
  return format(ctx.reportData[key]);
}

/** Source key of a row whose value is written in the template (may contain variables). */
export const SUMMARY_CUSTOM_ROW_KEY = "custom";

/**
 * Value for one summary-table row: the row's own value text (with
 * `{{variables}}` replaced) when it has one, otherwise the linked field.
 */
export function resolveSummaryFieldValue(field: MvCompanyReportSummaryTableField, ctx: SummaryValueContext): string {
  const own = field.valueTemplate?.trim();
  if (own) return interpolateTemplateText(own, (key) => resolveTemplateVariableValue(key, ctx)).trim();
  if (field.sourceKey === SUMMARY_CUSTOM_ROW_KEY) return "";
  return resolveTemplateVariableValue(field.sourceKey, ctx, field.type);
}

export type SummaryTableRow = { id: string; label: ReactNode; value: ReactNode };

/**
 * Two-column summary table: field names on the right, their values on the
 * left (RTL), spanning the full body width of the report page. Rendered by
 * the studio preview and by the final report, so both look identical.
 */
export function SystemTemplateSummaryTable({
  table,
  rows,
  className,
}: {
  table: MvCompanyReportSummaryTable;
  rows: SummaryTableRow[];
  className?: string;
}) {
  const labelPct = table.labelColumnPct ?? SUMMARY_TABLE_DEFAULT_LABEL_PCT;
  const primary = "var(--mv-template-primary, #0C447C)";
  return (
    <div dir="rtl" className={["w-full", className].filter(Boolean).join(" ")} data-mv-summary-table>
      <table className="w-full table-fixed border-collapse text-right text-[11.5px] leading-6">
        <colgroup>
          <col style={{ width: `${labelPct}%` }} />
          <col />
        </colgroup>
        {table.title ? (
          <thead>
            <tr>
              <th colSpan={2} className="border px-3 py-1.5 text-right text-[12.5px] font-black text-white" style={{ background: primary, borderColor: primary }}>
                {table.title}
              </th>
            </tr>
          </thead>
        ) : null}
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="break-inside-avoid">
              <th
                scope="row"
                className="border border-slate-300 bg-slate-50 px-3 py-1.5 align-top font-extrabold [overflow-wrap:anywhere]"
                style={{ color: primary, backgroundColor: `color-mix(in srgb, ${primary} 8%, white)` }}
              >
                {row.label}
              </th>
              <td className="whitespace-pre-wrap border border-slate-300 px-3 py-1.5 align-top font-semibold text-slate-900 [overflow-wrap:anywhere]">
                {row.value === "" || row.value === null || row.value === undefined ? "—" : row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
