"use client";

import { ChevronDown, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { MvProjectLocation } from "./types";

export const MV_ALL_LOCATIONS_VALUE = "__all__";

export function mvLocationId(location: MvProjectLocation, index: number): string {
  return (location.id || `site-${index + 1}`).trim();
}

export function mvLocationLabel(location: MvProjectLocation, index: number): string {
  const name = location.name?.trim();
  if (name) return name;
  const bits = [location.region, location.city].map((v) => v?.trim()).filter(Boolean);
  return bits.join(" - ") || `موقع المعاينة ${index + 1}`;
}

export function normalizeMvLocationSelection(
  value: readonly string[],
  locations: readonly MvProjectLocation[],
): string[] {
  if (value.length === 0 || value.includes(MV_ALL_LOCATIONS_VALUE)) return [MV_ALL_LOCATIONS_VALUE];
  const allowed = new Set(locations.map(mvLocationId));
  const next = Array.from(new Set(value.filter((id) => allowed.has(id))));
  return next.length > 0 ? next : [MV_ALL_LOCATIONS_VALUE];
}

export function mvLocationSelectionSummary(value: readonly string[], locations: readonly MvProjectLocation[]): string {
  const normalized = normalizeMvLocationSelection(value, locations);
  if (normalized.includes(MV_ALL_LOCATIONS_VALUE)) return "كل مواقع المعاينة";
  const labels = normalized
    .map((id) => {
      const index = locations.findIndex((location, locationIndex) => mvLocationId(location, locationIndex) === id);
      return index >= 0 ? mvLocationLabel(locations[index]!, index) : "";
    })
    .filter(Boolean);
  if (labels.length === 0) return "كل مواقع المعاينة";
  if (labels.length === 1) return labels[0]!;
  return `${labels.length} مواقع محددة`;
}

export function MvLocationMultiSelect({
  locations,
  value,
  onChange,
  disabled,
  className,
  label = "مواقع المعاينة",
}: {
  locations: MvProjectLocation[];
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  const normalized = normalizeMvLocationSelection(value, locations);
  const allSelected = normalized.includes(MV_ALL_LOCATIONS_VALUE);

  const setAll = () => onChange([MV_ALL_LOCATIONS_VALUE]);
  const toggleLocation = (id: string, checked: boolean) => {
    if (checked) {
      const current = allSelected ? [] : normalized;
      onChange(normalizeMvLocationSelection([...current, id], locations));
      return;
    }
    onChange(normalizeMvLocationSelection(normalized.filter((item) => item !== id), locations));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 min-w-[190px] justify-between gap-2 rounded-lg border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-700 shadow-none hover:bg-slate-50",
            className,
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MapPinned className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            <span className="truncate">{mvLocationSelectionSummary(normalized, locations)}</span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[980] w-72 text-right">
        <DropdownMenuLabel className="px-2 py-1.5 text-[12px] text-slate-500">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={allSelected}
          onCheckedChange={setAll}
          onSelect={(event) => event.preventDefault()}
          className="cursor-pointer text-[12px] font-bold"
        >
          كل مواقع المعاينة
        </DropdownMenuCheckboxItem>
        {locations.length > 0 ? <DropdownMenuSeparator /> : null}
        {locations.map((location, index) => {
          const id = mvLocationId(location, index);
          return (
            <DropdownMenuCheckboxItem
              key={id}
              checked={!allSelected && normalized.includes(id)}
              onCheckedChange={(checked) => toggleLocation(id, checked === true)}
              onSelect={(event) => event.preventDefault()}
              className="cursor-pointer text-[12px]"
            >
              {mvLocationLabel(location, index)}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
