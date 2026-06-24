"use client";

import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MvReportPageShell } from "./mv-report-page-shell";
import type { MvReportEditableSection } from "./types";
import type { MvReportTocRow } from "./mv-valuation-report-toc";
import { MV_REPORT_TOC_ROWS } from "./mv-valuation-report-toc";
import {
  buildReportTocEntries,
  chunkReportTocEntries,
} from "./mv-report-toc-pagination";

type TocPagesProps = {
  companyName: string;
  companyNameNode?: ReactNode;
  logoSrc: string | null;
  footerLines: string[];
  draftWatermark: boolean;
  editableSections: MvReportEditableSection[];
  tocApproxPages: Record<string, string>;
  onTocAnchorClick?: (anchor: string) => void;
  editableText: (key: string, fallback: string) => string;
  labelText: (key: string, fallback: string) => string;
  setTextOverride: (key: string, value: string) => void;
  updateEditableSection: (id: string, patch: Partial<MvReportEditableSection>) => void;
  insertedAfter: (anchorId: string) => ReactNode;
  EditableBlock: React.ComponentType<{
    value: string;
    onChange: (value: string) => void;
    className?: string;
    dir?: "rtl" | "ltr" | "auto";
    multiline?: boolean;
    placeholder?: string;
  }>;
};

function TocTableHead({
  labelText,
  setTextOverride,
  EditableBlock,
}: Pick<TocPagesProps, "labelText" | "setTextOverride" | "EditableBlock">) {
  return (
    <thead>
      <tr className="border-b-2 border-[#0C447C] bg-sky-50/80">
        <th className="w-12 px-2 py-2 text-right text-[10px] font-black text-[#0C447C]">
          <EditableBlock
            value={labelText("toc.num", "رقم")}
            onChange={(value) => setTextOverride("label.toc.num", value)}
            className="min-h-[1.25rem]"
            multiline={false}
          />
        </th>
        <th className="px-2 py-2 text-right text-[10px] font-black text-[#0C447C]">
          <EditableBlock
            value={labelText("toc.item", "البند")}
            onChange={(value) => setTextOverride("label.toc.item", value)}
            className="min-h-[1.25rem]"
            multiline={false}
          />
        </th>
        <th className="w-14 px-2 py-2 text-center text-[10px] font-black text-[#0C447C]">
          <EditableBlock
            value={labelText("toc.page", "صفحة")}
            onChange={(value) => setTextOverride("label.toc.page", value)}
            className="min-h-[1.25rem] text-center"
            multiline={false}
          />
        </th>
      </tr>
    </thead>
  );
}

function TocRow({
  row,
  clickable,
  onTocAnchorClick,
  editableText,
  setTextOverride,
  tocApproxPages,
  EditableBlock,
}: {
  row: MvReportTocRow;
  clickable: boolean;
  onTocAnchorClick?: (anchor: string) => void;
  editableText: TocPagesProps["editableText"];
  setTextOverride: TocPagesProps["setTextOverride"];
  tocApproxPages: Record<string, string>;
  EditableBlock: TocPagesProps["EditableBlock"];
}) {
  return (
    <tr
      key={`${row.num}-${row.title}`}
      className={cn(
        "border-b border-slate-200/80 transition",
        clickable && "cursor-pointer hover:bg-sky-50/60",
      )}
      onClick={(event) => {
        if (!clickable) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest('[contenteditable="true"], input, textarea, button, a')) return;
        onTocAnchorClick?.(row.anchor);
      }}
    >
      <td className="px-2 py-1.5 align-top font-black tabular-nums text-[#0C447C]">
        <span className="inline-block min-w-[2rem]">{row.num}</span>
      </td>
      <td className="px-2 py-1.5 align-top font-semibold text-slate-900">
        <EditableBlock
          value={editableText(`toc.${row.anchor}.title`, row.title)}
          onChange={(value) => setTextOverride(`toc.${row.anchor}.title`, value)}
          className={cn("min-h-[1.25rem]", clickable && "hover:text-[#0C447C]")}
          multiline={false}
        />
      </td>
      <td className="px-2 py-1.5 text-center tabular-nums text-slate-600">
        <EditableBlock
          value={editableText(`toc.${row.anchor}.page`, tocApproxPages[row.anchor] ?? "…")}
          onChange={(value) => setTextOverride(`toc.${row.anchor}.page`, value)}
          className="min-h-[1.25rem] text-center"
          dir="ltr"
          multiline={false}
        />
      </td>
    </tr>
  );
}

export function MvReportTocPages(props: TocPagesProps) {
  const {
    companyName,
    companyNameNode,
    logoSrc,
    footerLines,
    draftWatermark,
    editableSections,
    tocApproxPages,
    onTocAnchorClick,
    editableText,
    labelText,
    setTextOverride,
    updateEditableSection,
    insertedAfter,
    EditableBlock,
  } = props;

  const clickable = !!onTocAnchorClick;
  const chunks = useMemo(
    () => chunkReportTocEntries(buildReportTocEntries(editableSections)),
    [editableSections],
  );

  const shellProps = {
    companyName,
    companyNameNode,
    logoSrc,
    footerLines,
    draftWatermark,
  };

  return (
    <>
      {chunks.map((chunk, pageIdx) => {
        const isFirst = pageIdx === 0;
        const isLast = pageIdx === chunks.length - 1;
        const heading = isFirst
          ? editableText("heading.report-toc", "الفهرس")
          : editableText("heading.report-toc-continued", "الفهرس (تابع)");

        return (
          <MvReportPageShell
            key={`report-toc-${pageIdx}`}
            variant="interior"
            orientation="portrait"
            {...shellProps}
          >
            <section
              id={isFirst ? "report-toc" : undefined}
              data-mv-report-insert-anchor={isFirst ? "report-toc" : `report-toc-${pageIdx + 1}`}
              data-mv-report-toc-page={String(pageIdx + 1)}
              className="scroll-mt-4"
            >
              <div className="mb-3 flex flex-col items-center gap-2">
                <EditableBlock
                  value={heading}
                  onChange={(value) =>
                    setTextOverride(isFirst ? "heading.report-toc" : "heading.report-toc-continued", value)
                  }
                  className="text-center text-[24px] font-black tracking-tight text-[#0C447C]"
                  multiline={false}
                  placeholder="عنوان الفهرس"
                />
                <div
                  aria-hidden
                  className="h-[3px] w-[80px] rounded-full bg-gradient-to-l from-transparent via-[#c9a227] to-transparent"
                />
              </div>
              {isFirst ? (
                <EditableBlock
                  value={editableText(
                    "paragraph.report-toc-note",
                    "أرقام الصفحة مرتبطة بترقيم الصفحات في التقرير (يشمل الغلاف).",
                  )}
                  onChange={(value) => setTextOverride("paragraph.report-toc-note", value)}
                  className="mx-auto mt-1 max-w-2xl text-center text-[10px] font-semibold text-slate-500"
                  placeholder="وصف الفهرس"
                />
              ) : null}
              <div className="mt-4 overflow-x-hidden rounded-xl border border-[#0C447C]/12 bg-white/60">
                <table className="w-full min-w-[300px] border-collapse text-[11px]">
                  <TocTableHead
                    labelText={labelText}
                    setTextOverride={setTextOverride}
                    EditableBlock={EditableBlock}
                  />
                  <tbody>
                    {chunk.map((entry) => {
                      if (entry.kind === "row") {
                        return (
                          <TocRow
                            key={`${entry.row.num}-${entry.row.anchor}`}
                            row={entry.row}
                            clickable={clickable}
                            onTocAnchorClick={onTocAnchorClick}
                            editableText={editableText}
                            setTextOverride={setTextOverride}
                            tocApproxPages={tocApproxPages}
                            EditableBlock={EditableBlock}
                          />
                        );
                      }
                      const { section, index } = entry;
                      const anchor = `custom:${section.id}`;
                      return (
                        <tr
                          key={`toc-${section.id}`}
                          className={cn(
                            "border-b border-slate-200/80 transition",
                            clickable && "cursor-pointer hover:bg-sky-50/60",
                          )}
                          onClick={(event) => {
                            if (!clickable) return;
                            const target = event.target as HTMLElement | null;
                            if (target?.closest('[contenteditable="true"], input, textarea, button, a')) return;
                            onTocAnchorClick?.(anchor);
                          }}
                        >
                          <td className="px-2 py-1.5 align-top font-black tabular-nums text-[#0C447C]">
                            <EditableBlock
                              value={section.sectionNumber || `${MV_REPORT_TOC_ROWS.length + index + 1}.0`}
                              onChange={(value) => updateEditableSection(section.id, { sectionNumber: value })}
                              className="min-h-[1.25rem] text-right"
                              dir="ltr"
                              multiline={false}
                            />
                          </td>
                          <td className="px-2 py-1.5 align-top font-semibold text-slate-900">
                            <EditableBlock
                              value={section.title || "بند إضافي"}
                              onChange={(value) => updateEditableSection(section.id, { title: value })}
                              className={cn("min-h-[1.25rem]", clickable && "hover:text-[#0C447C]")}
                              multiline={false}
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center tabular-nums text-slate-600">
                            <EditableBlock
                              value={editableText(`toc.${anchor}.page`, tocApproxPages[anchor] ?? "…")}
                              onChange={(value) => setTextOverride(`toc.${anchor}.page`, value)}
                              className="min-h-[1.25rem] text-center"
                              dir="ltr"
                              multiline={false}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {isLast ? insertedAfter("report-toc") : null}
            </section>
          </MvReportPageShell>
        );
      })}
    </>
  );
}
