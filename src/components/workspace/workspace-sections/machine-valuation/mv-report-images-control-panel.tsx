"use client";

import { useCallback, useState } from "react";
import { GripVertical, ImageIcon } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { MvDriveFile } from "./types";
import type { MvValuationAccountingImage } from "./mv-valuation-accounting-store";

function reorderIds(order: string[], fromId: string, toId: string) {
  if (fromId === toId) return order;
  const next = order.filter((id) => id !== fromId);
  const toIndex = next.indexOf(toId);
  if (toIndex < 0) return [...next, fromId];
  next.splice(toIndex, 0, fromId);
  return next;
}

function DraggableRow({
  id,
  label,
  thumbSrc,
  widthPercent,
  widthLabel,
  onWidthChange,
  onReorder,
  showWidthSlider = true,
}: {
  id: string;
  label: string;
  thumbSrc?: string;
  widthPercent: number;
  widthLabel: string;
  onWidthChange: (value: number) => void;
  onReorder: (fromId: string, toId: string) => void;
  showWidthSlider?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const fromId = event.dataTransfer.getData("text/plain");
        if (fromId) onReorder(fromId, id);
      }}
      className={cn(
        "rounded-lg border bg-white p-2 transition",
        dragOver ? "border-sky-400 bg-sky-50/80" : "border-slate-200",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="mt-1 cursor-grab text-slate-400 active:cursor-grabbing" aria-hidden>
          <GripVertical className="h-4 w-4" />
        </span>
        {thumbSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbSrc} alt="" className="h-11 w-14 shrink-0 rounded object-cover bg-slate-100" />
        ) : (
          <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-400">
            <ImageIcon className="h-4 w-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[10px] font-bold leading-snug text-slate-800">{label}</p>
          {showWidthSlider ? (
            <label className="mt-1.5 grid gap-1">
              <span className="text-[9px] font-semibold text-slate-500">
                {widthLabel}: {Math.round(widthPercent)}%
              </span>
              <Slider
                dir="rtl"
                min={24}
                max={100}
                step={2}
                value={[widthPercent]}
                onValueChange={(v) => onWidthChange(v[0] ?? widthPercent)}
                className="py-0.5"
              />
            </label>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function MvReportImagesControlPanel({
  projectId,
  assetFiles,
  assetOrder,
  assetWidthPercent,
  onAssetReorder,
  getAssetImageSrc,
  onAssetWidthChange,
  valuationImages,
  valuationOrder,
  onValuationReorder,
  onValuationWidthChange,
}: {
  projectId: string;
  assetFiles: MvDriveFile[];
  assetOrder: string[];
  assetWidthPercent: number;
  onAssetReorder: (next: string[]) => void;
  getAssetImageSrc: (file: MvDriveFile) => string;
  onAssetWidthChange: (width: number) => void;
  valuationImages: MvValuationAccountingImage[];
  valuationOrder: string[];
  onValuationReorder: (next: string[]) => void;
  onValuationWidthChange: (imageId: string, width: number) => void;
}) {
  const [tab, setTab] = useState<"assets" | "valuation">("assets");

  const handleAssetReorder = useCallback(
    (fromId: string, toId: string) => {
      onAssetReorder(reorderIds(assetOrder, fromId, toId));
    },
    [assetOrder, onAssetReorder],
  );

  const handleValuationReorder = useCallback(
    (fromId: string, toId: string) => {
      onValuationReorder(reorderIds(valuationOrder, fromId, toId));
    },
    [valuationOrder, onValuationReorder],
  );

  const assetById = new Map(assetFiles.map((f) => [f._id, f]));
  const valuationById = new Map(valuationImages.map((im) => [im.id, im]));

  return (
    <div className="mt-2 rounded-lg border border-slate-200/90 bg-slate-50/60 p-1.5">
      <div className="mb-1.5 flex gap-0.5 rounded-md bg-white p-0.5 ring-1 ring-slate-200/80">
        <button
          type="button"
          onClick={() => setTab("assets")}
          className={cn(
            "flex-1 rounded px-1 py-1 text-[10px] font-bold transition",
            tab === "assets" ? "bg-sky-800 text-white" : "text-slate-600 hover:bg-slate-50",
          )}
        >
          صور الأصول ({assetOrder.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("valuation")}
          className={cn(
            "flex-1 rounded px-1 py-1 text-[10px] font-bold transition",
            tab === "valuation" ? "bg-sky-800 text-white" : "text-slate-600 hover:bg-slate-50",
          )}
        >
          صور الحسابات ({valuationOrder.length})
        </button>
      </div>
      <p className="mb-1.5 px-0.5 text-[9px] font-semibold leading-snug text-slate-500">
        اسحب الصورة لإعادة الترتيب. حرّك شريط العرض لتغيير مساحتها في التقرير.
      </p>
      {tab === "assets" ? (
        <label className="mb-2 grid gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5">
          <span className="text-[9px] font-semibold text-slate-600">
            عرض كل صور الأصول: {Math.round(assetWidthPercent)}%
          </span>
          <Slider
            dir="rtl"
            min={24}
            max={100}
            step={2}
            value={[assetWidthPercent]}
            onValueChange={(v) => onAssetWidthChange(v[0] ?? assetWidthPercent)}
          />
        </label>
      ) : null}
      <div className="max-h-[min(28vh,240px)] space-y-1.5 overflow-y-auto overscroll-contain">
        {tab === "assets" ? (
          assetOrder.length === 0 ? (
            <p className="py-3 text-center text-[10px] font-bold text-slate-500">لا توجد صور أصول في التقرير.</p>
          ) : (
            assetOrder.map((id) => {
              const file = assetById.get(id);
              if (!file) return null;
              const name = file.name?.trim() || "صورة";
              return (
                <DraggableRow
                  key={id}
                  id={id}
                  label={name}
                  thumbSrc={getAssetImageSrc(file)}
                  widthPercent={assetWidthPercent}
                  widthLabel="عرض"
                  onWidthChange={onAssetWidthChange}
                  onReorder={handleAssetReorder}
                  showWidthSlider={false}
                />
              );
            })
          )
        ) : valuationOrder.length === 0 ? (
          <p className="py-3 text-center text-[10px] font-bold text-slate-500">لا توجد صور حسابات.</p>
        ) : (
          valuationOrder.map((id) => {
            const image = valuationById.get(id);
            if (!image) return null;
            const src = image.dataUrl
              ? image.dataUrl
              : image.fileId
                ? `/api/mv/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(image.fileId)}/download`
                : undefined;
            return (
              <DraggableRow
                key={id}
                id={id}
                label={image.name}
                thumbSrc={src}
                widthPercent={image.displayWidthPercent ?? 88}
                widthLabel="عرض الصورة"
                onWidthChange={(w) => onValuationWidthChange(id, w)}
                onReorder={handleValuationReorder}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
