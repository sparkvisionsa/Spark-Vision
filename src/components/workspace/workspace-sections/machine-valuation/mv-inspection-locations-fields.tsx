"use client";

import { useMemo, useState } from "react";
import { Files, Loader2, MapPinned, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createProjectInspectionSiteForm,
  parseCoordinatesFromText,
  resolveProjectLocationFromCoordinates,
  type MvProjectInspectionSiteForm,
} from "./mv-project-contact-data";
import { MvProjectMapPicker } from "./mv-project-map-picker";

interface MvInspectionLocationsFieldsProps {
  value: MvProjectInspectionSiteForm[];
  onChange: (next: MvProjectInspectionSiteForm[]) => void;
  disabled?: boolean;
  className?: string;
  onOpenInspectorFiles?: (site: MvProjectInspectionSiteForm) => void;
  openingInspectorFilesSiteId?: string | null;
}

export function MvInspectionLocationsFields({
  value,
  onChange,
  disabled,
  className,
  onOpenInspectorFiles,
  openingInspectorFilesSiteId,
}: MvInspectionLocationsFieldsProps) {
  const sites = value.length > 0 ? value : [createProjectInspectionSiteForm(0)];
  const [mapSiteId, setMapSiteId] = useState<string | null>(null);
  const [resolvingSiteId, setResolvingSiteId] = useState<string | null>(null);
  const [locationErrors, setLocationErrors] = useState<Record<string, string>>({});
  const activeMapSite = useMemo(
    () => sites.find((site) => site.id === mapSiteId) ?? null,
    [mapSiteId, sites],
  );
  const activeMapPoint = activeMapSite
    ? parseCoordinatesFromText(`${activeMapSite.latitude},${activeMapSite.longitude}`) ??
      parseCoordinatesFromText(activeMapSite.mapUrl)
    : null;

  const updateSite = (id: string, patch: Partial<MvProjectInspectionSiteForm>) => {
    onChange(sites.map((site) => (site.id === id ? { ...site, ...patch } : site)));
  };

  const addSite = () => {
    onChange([...sites, createProjectInspectionSiteForm(sites.length)]);
  };

  const removeSite = (id: string) => {
    if (sites.length <= 1) return;
    onChange(sites.filter((site) => site.id !== id));
  };

  const updateMapUrl = (site: MvProjectInspectionSiteForm, mapUrl: string) => {
    const parsed = parseCoordinatesFromText(mapUrl);
    updateSite(site.id, {
      mapUrl,
      latitude: parsed ? String(parsed.latitude) : "",
      longitude: parsed ? String(parsed.longitude) : "",
    });
  };

  const applyMapPoint = async (site: MvProjectInspectionSiteForm, latitude: number, longitude: number) => {
    setResolvingSiteId(site.id);
    setLocationErrors((current) => {
      const next = { ...current };
      delete next[site.id];
      return next;
    });

    const resolved = await resolveProjectLocationFromCoordinates(latitude, longitude);
    updateSite(site.id, {
      region: resolved.region,
      city: resolved.city,
      latitude: String(resolved.latitude),
      longitude: String(resolved.longitude),
      mapUrl: resolved.mapUrl,
    });

    if (!resolved.region || !resolved.city) {
      setLocationErrors((current) => ({
        ...current,
        [site.id]: "تم تعبئة رابط الخريطة ولم تتوفر المنطقة أو المدينة من خدمة الخرائط.",
      }));
    }
    setResolvingSiteId(null);
  };

  return (
    <div className={cn("space-y-3 text-right", className)} dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-black text-slate-950">تحديد مواقع المعاينة</p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
            أضف موقعاً أو أكثر مع بيانات التواصل الخاصة بكل موقع.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 gap-2 rounded-lg border-sky-200 bg-white px-3 text-[12px] font-bold text-sky-800 hover:bg-sky-50"
          onClick={addSite}
          disabled={disabled || sites.length >= 10}
        >
          <Plus className="h-4 w-4" />
          إضافة موقع آخر
        </Button>
      </div>

      <div className="space-y-3">
        {sites.map((site, index) => (
          <section
            key={site.id}
            className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm shadow-slate-900/[0.03]"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                <MapPinned className="h-4 w-4" />
              </span>
              <Input
                value={site.name}
                onChange={(event) => updateSite(site.id, { name: event.target.value })}
                disabled={disabled}
                aria-label={`اسم الموقع ${index + 1}`}
                className="h-10 min-w-0 flex-1 rounded-lg border-slate-200 bg-slate-50/80 px-3 text-[13px] font-extrabold text-slate-950"
                dir="auto"
              />
              <Button
                type="button"
                variant="outline"
                className="h-9 shrink-0 gap-1.5 rounded-lg border-sky-200 bg-white px-2.5 text-[11px] font-bold text-sky-800 hover:bg-sky-50"
                onClick={() => setMapSiteId(site.id)}
                disabled={disabled || resolvingSiteId === site.id}
              >
                {resolvingSiteId === site.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPinned className="h-4 w-4" />
                )}
                الخريطة
              </Button>
              {onOpenInspectorFiles ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 shrink-0 gap-1.5 rounded-lg border-indigo-200 bg-white px-2.5 text-[11px] font-bold text-indigo-800 hover:bg-indigo-50"
                  onClick={() => onOpenInspectorFiles(site)}
                  disabled={disabled || openingInspectorFilesSiteId === site.id}
                >
                  {openingInspectorFilesSiteId === site.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Files className="h-4 w-4" />
                  )}
                  إضافة ملفات للمعاين
                </Button>
              ) : null}
              {sites.length > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-lg border-red-100 bg-white text-red-600 hover:bg-red-50"
                  onClick={() => removeSite(site.id)}
                  disabled={disabled}
                  aria-label="حذف الموقع"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>

            <div className="grid gap-2 lg:grid-cols-3">
              <label className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500">المنطقة</span>
                <Input
                  value={site.region}
                  onChange={(event) => updateSite(site.id, { region: event.target.value })}
                  disabled={disabled}
                  className="h-10 rounded-lg border-slate-200 bg-white text-[13px]"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500">المدينة</span>
                <Input
                  value={site.city}
                  onChange={(event) => updateSite(site.id, { city: event.target.value })}
                  disabled={disabled}
                  className="h-10 rounded-lg border-slate-200 bg-white text-[13px]"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500">رابط Google Maps</span>
                <Input
                  value={site.mapUrl}
                  onChange={(event) => updateMapUrl(site, event.target.value)}
                  disabled={disabled}
                  className="h-10 rounded-lg border-slate-200 bg-white text-[12px]"
                  dir="ltr"
                />
              </label>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500">رقم تواصل أساسي</span>
                <Input
                  value={site.primaryPhone}
                  onChange={(event) => updateSite(site.id, { primaryPhone: event.target.value })}
                  disabled={disabled}
                  inputMode="tel"
                  className="h-10 rounded-lg border-slate-200 bg-white text-[13px]"
                  dir="ltr"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[11px] font-bold text-slate-500">رقم تواصل احتياطي</span>
                <Input
                  value={site.secondaryPhone}
                  onChange={(event) => updateSite(site.id, { secondaryPhone: event.target.value })}
                  disabled={disabled}
                  inputMode="tel"
                  className="h-10 rounded-lg border-slate-200 bg-white text-[13px]"
                  dir="ltr"
                />
              </label>
            </div>
            {locationErrors[site.id] ? (
              <p className="mt-2 text-[11px] leading-5 text-amber-700">{locationErrors[site.id]}</p>
            ) : null}
          </section>
        ))}
      </div>
      <MvProjectMapPicker
        open={mapSiteId != null}
        onOpenChange={(open) => {
          if (!open) setMapSiteId(null);
        }}
        initialPoint={activeMapPoint}
        confirming={activeMapSite ? resolvingSiteId === activeMapSite.id : false}
        onConfirm={(point) => {
          if (!activeMapSite) return;
          void applyMapPoint(activeMapSite, point.latitude, point.longitude).then(() => setMapSiteId(null));
        }}
      />
    </div>
  );
}
