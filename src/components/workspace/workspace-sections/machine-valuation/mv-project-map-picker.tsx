"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const TILE_SIZE = 256;
const DEFAULT_CENTER = { latitude: 24.7136, longitude: 46.6753 };

interface MapPoint {
  latitude: number;
  longitude: number;
}

interface MvProjectMapPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPoint?: MapPoint | null;
  onConfirm: (point: MapPoint) => void;
  confirming?: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function wrapTileX(x: number, tileCount: number) {
  return ((x % tileCount) + tileCount) % tileCount;
}

function latLngToPixel(point: MapPoint, zoom: number) {
  const sinLat = Math.sin((clamp(point.latitude, -85.05112878, 85.05112878) * Math.PI) / 180);
  const scale = TILE_SIZE * 2 ** zoom;
  return {
    x: ((point.longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale,
  };
}

function pixelToLatLng(pixel: { x: number; y: number }, zoom: number): MapPoint {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = (pixel.x / scale) * 360 - 180;
  const y = 0.5 - pixel.y / scale;
  const latitude = 90 - (360 * Math.atan(Math.exp(-y * 2 * Math.PI))) / Math.PI;
  return {
    latitude: Math.round(clamp(latitude, -85.05112878, 85.05112878) * 1_000_000) / 1_000_000,
    longitude: Math.round((((longitude + 540) % 360) - 180) * 1_000_000) / 1_000_000,
  };
}

export function MvProjectMapPicker({
  open,
  onOpenChange,
  initialPoint,
  onConfirm,
  confirming,
}: MvProjectMapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    centerPixel: { x: number; y: number };
    moved: boolean;
  } | null>(null);
  const [size, setSize] = useState({ width: 640, height: 360 });
  const [zoom, setZoom] = useState(12);
  const [center, setCenter] = useState<MapPoint>(initialPoint ?? DEFAULT_CENTER);
  const [selected, setSelected] = useState<MapPoint | null>(initialPoint ?? null);

  useEffect(() => {
    if (!open) return;
    const nextCenter = initialPoint ?? DEFAULT_CENTER;
    setCenter(nextCenter);
    setSelected(initialPoint ?? null);
    setZoom(initialPoint ? 15 : 12);
  }, [initialPoint, open]);

  useEffect(() => {
    const node = mapRef.current;
    if (!node) return;
    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(node);
    return () => observer.disconnect();
  }, [open]);

  const centerPixel = useMemo(() => latLngToPixel(center, zoom), [center, zoom]);
  const topLeft = {
    x: centerPixel.x - size.width / 2,
    y: centerPixel.y - size.height / 2,
  };
  const tileCount = 2 ** zoom;
  const tiles = [];
  const startTileX = Math.floor(topLeft.x / TILE_SIZE);
  const endTileX = Math.floor((topLeft.x + size.width) / TILE_SIZE);
  const startTileY = Math.max(0, Math.floor(topLeft.y / TILE_SIZE));
  const endTileY = Math.min(tileCount - 1, Math.floor((topLeft.y + size.height) / TILE_SIZE));
  for (let x = startTileX; x <= endTileX; x++) {
    for (let y = startTileY; y <= endTileY; y++) {
      const wrappedX = wrapTileX(x, tileCount);
      tiles.push({
        key: `${zoom}-${x}-${y}`,
        src: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        left: x * TILE_SIZE - topLeft.x,
        top: y * TILE_SIZE - topLeft.y,
      });
    }
  }

  const selectedPixel = selected ? latLngToPixel(selected, zoom) : null;
  const selectedPosition = selectedPixel
    ? {
        left: selectedPixel.x - topLeft.x,
        top: selectedPixel.y - topLeft.y,
      }
    : null;

  const selectFromClientPoint = (clientX: number, clientY: number) => {
    const node = mapRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const point = pixelToLatLng(
      {
        x: topLeft.x + clientX - rect.left,
        y: topLeft.y + clientY - rect.top,
      },
      zoom,
    );
    setSelected(point);
    setCenter(point);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-hidden border-slate-200 p-0 shadow-2xl sm:max-w-3xl" dir="rtl">
        <DialogHeader className="border-b border-slate-100 bg-white px-5 py-4 text-right">
          <DialogTitle className="text-[15px] font-bold text-slate-900">تحديد الموقع من الخريطة</DialogTitle>
          <DialogDescription className="text-[12px] text-slate-500">
            اضغط على المكان المطلوب داخل الخريطة ثم احفظ الموقع.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 px-5 py-4">
          <div
            ref={mapRef}
            className="relative h-[360px] min-h-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-inner"
            style={{ touchAction: "none" }}
            onPointerDown={(event) => {
              if (disabledPointer(event.target)) return;
              const centerStart = latLngToPixel(center, zoom);
              dragRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                centerPixel: centerStart,
                moved: false,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const drag = dragRef.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              const dx = event.clientX - drag.startX;
              const dy = event.clientY - drag.startY;
              if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
              if (drag.moved) {
                setCenter(pixelToLatLng({ x: drag.centerPixel.x - dx, y: drag.centerPixel.y - dy }, zoom));
              }
            }}
            onPointerUp={(event) => {
              const drag = dragRef.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              dragRef.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
              if (!drag.moved) selectFromClientPoint(event.clientX, event.clientY);
            }}
          >
            {tiles.map((tile) => (
              <img
                key={tile.key}
                src={tile.src}
                alt=""
                draggable={false}
                className="absolute h-64 w-64 select-none"
                style={{ left: tile.left, top: tile.top }}
              />
            ))}

            {selectedPosition ? (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full text-red-600 drop-shadow-md"
                style={{ left: selectedPosition.left, top: selectedPosition.top }}
              >
                <MapPin className="h-9 w-9 fill-red-500/20 stroke-[2.5]" />
              </div>
            ) : null}

            <div className="absolute left-3 top-3 z-20 flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center text-slate-700 hover:bg-slate-50"
                onClick={() => setZoom((value) => Math.min(18, value + 1))}
                aria-label="تكبير"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center border-t border-slate-100 text-slate-700 hover:bg-slate-50"
                onClick={() => setZoom((value) => Math.max(3, value - 1))}
                aria-label="تصغير"
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-slate-950/45 to-transparent px-4 py-3">
              <p className="text-[11px] font-medium text-white">
                {selected
                  ? `${selected.latitude}, ${selected.longitude}`
                  : "اسحب الخريطة ثم اضغط على المكان المطلوب"}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-slate-100 bg-slate-50/80 px-5 py-3">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl border-slate-200 bg-white px-5"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            إلغاء
          </Button>
          <Button
            type="button"
            className={cn("h-10 min-w-[130px] rounded-xl bg-slate-950 px-5 text-white hover:bg-slate-800")}
            disabled={!selected || confirming}
            onClick={() => selected && onConfirm(selected)}
          >
            {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ الموقع"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function disabledPointer(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("button"));
}
