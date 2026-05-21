"use client";

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronsUpDown, Files, Loader2, MapPinned, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  createProjectInspectionSiteForm,
  defaultInspectionSiteName,
  parseCoordinatesFromText,
  siteDescriptionFieldLabel,
  type MvProjectInspectionSiteForm,
} from "./mv-project-contact-data";
import { MvProjectMapPicker } from "./mv-project-map-picker";
import { useMvLocationCatalog } from "./use-mv-location-catalog";

/** مطابق لـ `COPY.ar.region` / `COPY.ar.city` في settings.tsx */
const LABEL_REGION_AR = "المنطقة";
const LABEL_CITY_AR = "المدينة";

const FIELD_LABEL_CLASS =
  "mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 [.card-field:focus-within_&]:text-sky-800";
const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-slate-200/95 bg-white px-3.5 text-[13px] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_3px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] placeholder:text-slate-400 hover:border-slate-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,1),0_2px_6px_rgba(15,23,42,0.05)] focus-visible:border-sky-400/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sky-500/15 disabled:cursor-not-allowed disabled:opacity-[0.62]";
/** ملاحظات: عرض كامل، ارتفاع افتراضي أقصر مع إمكانية السحب */
const NOTES_AREA_CLASS =
  "min-h-[4.25rem] w-full resize-y rounded-xl border border-slate-200/95 bg-white px-3.5 py-2.5 text-[13px] font-medium leading-relaxed text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_1px_3px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow] placeholder:text-slate-400 hover:border-slate-300 focus-visible:border-sky-400/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sky-500/15 disabled:cursor-not-allowed disabled:opacity-[0.62]";

function normalizeSearch(q: string) {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

const PICK_POPOVER_CLASS =
  "z-[120] max-h-none w-[min(100vw-2rem,var(--radix-popover-trigger-width))] min-w-[16rem] rounded-xl border border-slate-200 bg-white p-2 text-slate-900 shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:min-w-[18rem]";

function MvSearchablePick({
  portalContainer,
  disabled,
  value,
  placeholder,
  emptyLabel,
  options,
  onPick,
  onClear,
  id,
}: {
  portalContainer: HTMLElement | null;
  id: string;
  disabled?: boolean;
  value: string;
  placeholder: string;
  emptyLabel: string;
  options: readonly { id: string; label: string }[];
  onPick: (label: string) => void;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);

  const filtered = useMemo(() => {
    const n = normalizeSearch(deferred);
    if (!n) return [...options];
    return options.filter(
      (o) =>
        normalizeSearch(o.label).includes(n) || o.id.toLowerCase().includes(n.replace(/\s/g, "")),
    );
  }, [options, deferred]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  if (!portalContainer) {
    return (
      <div className={cn(INPUT_CLASS, "flex animate-pulse items-center gap-2 text-[12px] text-slate-400")}>
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        تهيئة القائمة…
      </div>
    );
  }

  return (
    <PopoverPrimitive.Root modal={false} open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            INPUT_CLASS,
            "flex items-center justify-between gap-2 text-start font-normal",
            !value ? "text-slate-400" : "",
          )}
        >
          <span className="min-w-0 flex-1 truncate">{value.trim() ? value : placeholder}</span>
          {value.trim() && onClear ? (
            <span
              role="button"
              tabIndex={-1}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-red-600"
              aria-label="مسح الحقل"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClear();
              }}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </span>
          ) : null}
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-45" aria-hidden />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal container={portalContainer}>
        <PopoverPrimitive.Content
          dir="rtl"
          align="start"
          side="bottom"
          sideOffset={8}
          collisionPadding={20}
          data-mv-contact-popover=""
          aria-describedby={undefined}
          className={PICK_POPOVER_CLASS}
        >
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="بحث..."
              disabled={disabled}
              className="h-9 rounded-lg border-slate-200 bg-slate-50/90 pe-10 ps-8 text-[12px]"
              aria-label="بحث في القائمة"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <ScrollArea type="always" className="h-52">
            <ul className="space-y-0.5 pb-1" role="listbox">
              {filtered.length === 0 ? (
                <li className="py-8 text-center text-[12px] text-slate-400">{emptyLabel}</li>
              ) : (
                filtered.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={value.trim() === o.label}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
                        value.trim() === o.label ? "bg-sky-50 text-sky-900" : "text-slate-800 hover:bg-slate-50",
                      )}
                      onClick={() => {
                        onPick(o.label);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate text-start">{o.label}</span>
                      {value.trim() === o.label ? (
                        <Check className="h-4 w-4 shrink-0 text-sky-700" aria-hidden />
                      ) : null}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </ScrollArea>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function ClearFieldButton({
  hidden,
  disabled,
  label = "مسح الحقل",
  onClick,
  className,
}: {
  hidden: boolean;
  disabled?: boolean;
  label?: string;
  onClick: () => void;
  className?: string;
}) {
  if (hidden) return null;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      className={cn(
        "absolute left-2 top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
      onClick={onClick}
    >
      <X className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

interface MvInspectionLocationsFieldsProps {
  value: MvProjectInspectionSiteForm[];
  onChange: (next: MvProjectInspectionSiteForm[]) => void;
  disabled?: boolean;
  /**
   * حاوية DOM داخل محتوى المودال (بدون `overflow: hidden` يقصّ القائمة)،
   * لتصيير `Popover` داخل الطبقة التفاعلية للحوار واستعادة النقرات المعطّلة خارج المحتوى.
   */
  pickerPopoverHost: HTMLElement | null;
  className?: string;
  onOpenInspectorFiles?: (site: MvProjectInspectionSiteForm) => void;
  openingInspectorFilesSiteId?: string | null;
}

function InspectionField({
  label,
  children,
  className,
  htmlFor,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("card-field min-w-0", className)}>
      {typeof label === "string" ? (
        <label htmlFor={htmlFor} className={FIELD_LABEL_CLASS}>
          {label}
        </label>
      ) : (
        <span className={FIELD_LABEL_CLASS}>{label}</span>
      )}
      {children}
    </div>
  );
}

/** الصف الأول: وصف الرقم بنسبة 2:1 */
const GRID_ROW_DESC_PHONE = "grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-3 lg:items-start";
/** الصف الثاني: منطقة — مدينة — رابط الخريطة 1 : 1 : 2 */
const GRID_ROW_REGION_CITY_MAP = "grid grid-cols-1 gap-3 lg:grid-cols-4 lg:gap-3 lg:items-start";

export function MvInspectionLocationsFields({
  value,
  onChange,
  disabled,
  pickerPopoverHost,
  className,
  onOpenInspectorFiles,
  openingInspectorFilesSiteId,
}: MvInspectionLocationsFieldsProps) {
  const { regions, cities, loading: catalogLoading, error: catalogError } = useMvLocationCatalog();

  const sites = value.length > 0 ? value : [createProjectInspectionSiteForm(0)];
  const [mapSiteId, setMapSiteId] = useState<string | null>(null);
  const [resolvingSiteId, setResolvingSiteId] = useState<string | null>(null);
  const activeMapSite = useMemo(
    () => sites.find((site) => site.id === mapSiteId) ?? null,
    [mapSiteId, sites],
  );
  const activeMapPoint = activeMapSite
    ? parseCoordinatesFromText(`${activeMapSite.latitude},${activeMapSite.longitude}`) ??
      parseCoordinatesFromText(activeMapSite.mapUrl)
    : null;

  const regionOptions = useMemo(
    () =>
      regions.map((r) => ({
        id: r.id,
        label: r.titleAr.trim() || r.titleEn.trim(),
      })),
    [regions],
  );

  const updateSite = (id: string, patch: Partial<MvProjectInspectionSiteForm>) => {
    onChange(sites.map((site) => (site.id === id ? { ...site, ...patch } : site)));
  };

  const cityOptionsForSite = useMemo(() => {
    const map = new Map<string, { id: string; label: string }[]>();
    const rawActive = cities.filter((c) => c.active !== false);
    for (const s of sites) {
      const rid = regions.find((r) => r.titleAr.trim() === s.region.trim())?.id ?? null;
      const list = rid ? rawActive.filter((c) => c.regionId === rid) : [];
      map.set(
        s.id,
        list.map((c) => ({
          id: c.id,
          label: c.titleAr.trim() || c.titleEn.trim(),
        })),
      );
    }
    return map;
  }, [sites, regions, cities]);

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
    try {
      const safeLatitude = Number.isFinite(latitude) ? String(latitude) : "";
      const safeLongitude = Number.isFinite(longitude) ? String(longitude) : "";
      updateSite(site.id, {
        latitude: safeLatitude,
        longitude: safeLongitude,
        mapUrl: safeLatitude && safeLongitude ? `https://www.google.com/maps?q=${safeLatitude},${safeLongitude}` : "",
      });
    } finally {
      setResolvingSiteId(null);
    }
  };

  const pickDisabled = Boolean(disabled) || catalogLoading;

  const onPickRegion = (siteId: string, titleAr: string) => {
    const nextRid = regions.find((r) => r.titleAr.trim() === titleAr.trim())?.id ?? null;
    const site = sites.find((s) => s.id === siteId);
    let nextCity = site?.city ?? "";
    if (nextRid && nextCity.trim()) {
      const stillValid = cities.some(
        (c) =>
          c.active !== false &&
          c.regionId === nextRid &&
          (c.titleAr.trim() === nextCity.trim() || c.titleEn.trim() === nextCity.trim()),
      );
      if (!stillValid) nextCity = "";
    }
    updateSite(siteId, { region: titleAr, city: nextCity });
  };

  return (
    <div className={cn("space-y-3 text-right", className)} dir="rtl">
      <header className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-9 shrink-0 gap-2 rounded-lg border-sky-200 bg-white px-3 text-[12px] font-bold text-[#0C447C] shadow-sm hover:border-sky-300 hover:bg-sky-50/80"
          onClick={addSite}
          disabled={disabled || sites.length >= 10}
        >
          <Plus className="h-4 w-4" aria-hidden />
          إضافة موقع آخر
        </Button>
      </header>

      {catalogError ? (
        <p className="rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          تعذّر تحميل قوائم المناطق والمدن؛ يمكنك الآن تعبئة الحقول يدوياً أدناه.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {sites.map((site, index) => {
          const regionInputId = `mv-region-${site.id}`;
          const cityInputId = `mv-city-${site.id}`;
          const cityChoices = cityOptionsForSite.get(site.id) ?? [];
          const useCatalogPickers = regionOptions.length > 0 && !catalogError;
          const matchedRegionId =
            regions.find((r) => r.titleAr.trim() === site.region.trim())?.id ?? null;

          return (
            <section
              key={site.id}
              className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 bg-slate-50 px-3 py-2 sm:flex-nowrap">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[12px] font-black text-[#0C447C] shadow-sm ring-[1px] ring-slate-200/90">
                    {index + 1}
                  </span>
                  <p className="truncate text-[13px] font-black text-slate-900">
                    {site.name.trim() || defaultInspectionSiteName(index)}
                  </p>
                </div>
                <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 gap-1.5 rounded-lg border-sky-200/90 bg-white px-2.5 text-[11px] font-bold text-[#0C447C] hover:bg-white hover:shadow-sm"
                    onClick={() => setMapSiteId(site.id)}
                    disabled={disabled || resolvingSiteId === site.id}
                  >
                    {resolvingSiteId === site.id ? (
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                    ) : (
                      <MapPinned className="h-4 w-4 shrink-0" aria-hidden />
                    )}
                    الخريطة
                  </Button>
                  {onOpenInspectorFiles ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-8 gap-1.5 rounded-lg border-violet-200/90 bg-white px-2.5 text-[11px] font-bold text-violet-900 hover:bg-violet-50/70"
                      onClick={() => onOpenInspectorFiles(site)}
                      disabled={disabled || openingInspectorFilesSiteId === site.id}
                    >
                      {openingInspectorFilesSiteId === site.id ? (
                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      ) : (
                        <Files className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      إرفاق ملفات
                    </Button>
                  ) : null}
                  {sites.length > 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-lg border-red-200/80 bg-white text-red-600 hover:bg-red-50/90"
                      onClick={() => removeSite(site.id)}
                      disabled={disabled}
                      aria-label="حذف الموقع"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3 p-3">
                <div className={GRID_ROW_DESC_PHONE}>
                  <InspectionField htmlFor={`mv-site-desc-${site.id}`} label={siteDescriptionFieldLabel(index)} className="lg:col-span-2">
                    <div className="relative">
                      <Input
                        id={`mv-site-desc-${site.id}`}
                        value={site.name}
                        onChange={(event) => updateSite(site.id, { name: event.target.value })}
                        disabled={disabled}
                        aria-label={siteDescriptionFieldLabel(index)}
                        placeholder={defaultInspectionSiteName(index)}
                        dir="auto"
                        className={cn(INPUT_CLASS, "pl-10")}
                      />
                      <ClearFieldButton
                        hidden={!site.name.trim()}
                        disabled={disabled}
                        onClick={() => updateSite(site.id, { name: "" })}
                      />
                    </div>
                  </InspectionField>
                  <InspectionField htmlFor={`mv-phone-${site.id}`} label="رقم تواصل" className="lg:col-span-1">
                    <div className="relative">
                      <Input
                        id={`mv-phone-${site.id}`}
                        value={site.primaryPhone}
                        onChange={(event) => updateSite(site.id, { primaryPhone: event.target.value })}
                        disabled={disabled}
                        inputMode="tel"
                        placeholder="05xxxxxxxx"
                        dir="ltr"
                        className={cn(INPUT_CLASS, "pl-10 text-start font-mono text-[13px] tracking-wide")}
                      />
                      <ClearFieldButton
                        hidden={!site.primaryPhone.trim()}
                        disabled={disabled}
                        onClick={() => updateSite(site.id, { primaryPhone: "" })}
                      />
                    </div>
                  </InspectionField>
                </div>

                <div className={GRID_ROW_REGION_CITY_MAP}>
                  <InspectionField htmlFor={regionInputId} label={LABEL_REGION_AR} className="lg:col-span-1">
                    {catalogLoading ? (
                      <div className={cn(INPUT_CLASS, "flex items-center gap-2 text-slate-400")}>
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                        جاري التحميل…
                      </div>
                    ) : !useCatalogPickers ? (
                      <div className="relative">
                        <Input
                          id={regionInputId}
                          value={site.region}
                          onChange={(event) => updateSite(site.id, { region: event.target.value })}
                          disabled={disabled}
                          className={cn(INPUT_CLASS, "pl-10")}
                        />
                        <ClearFieldButton
                          hidden={!site.region.trim()}
                          disabled={disabled}
                          onClick={() => updateSite(site.id, { region: "", city: "" })}
                        />
                      </div>
                    ) : (
                      <MvSearchablePick
                        portalContainer={pickerPopoverHost}
                        id={regionInputId}
                        disabled={pickDisabled || disabled}
                        value={site.region}
                        placeholder="اختر المنطقة…"
                        emptyLabel="لا توجد مناطق مطابقة"
                        options={regionOptions}
                        onPick={(lab) => onPickRegion(site.id, lab)}
                        onClear={() => updateSite(site.id, { region: "", city: "" })}
                      />
                    )}
                  </InspectionField>

                  <InspectionField htmlFor={cityInputId} label={LABEL_CITY_AR} className="lg:col-span-1">
                    {catalogLoading ? (
                      <div className={cn(INPUT_CLASS, "flex items-center gap-2 text-slate-400")}>
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                        جاري التحميل…
                      </div>
                    ) : !useCatalogPickers ? (
                      <div className="relative">
                        <Input
                          id={cityInputId}
                          value={site.city}
                          onChange={(event) => updateSite(site.id, { city: event.target.value })}
                          disabled={disabled}
                          className={cn(INPUT_CLASS, "pl-10")}
                        />
                        <ClearFieldButton
                          hidden={!site.city.trim()}
                          disabled={disabled}
                          onClick={() => updateSite(site.id, { city: "" })}
                        />
                      </div>
                    ) : (
                      <MvSearchablePick
                        portalContainer={pickerPopoverHost}
                        id={cityInputId}
                        disabled={
                          pickDisabled || disabled || matchedRegionId == null || cityChoices.length === 0
                        }
                        value={site.city}
                        placeholder={matchedRegionId == null ? "اختر المنطقة أولاً" : "اختر المدينة…"}
                        emptyLabel={
                          matchedRegionId == null ? "اختر المنطقة أولاً" : "لا توجد مدن مطابقة في هذه المنطقة"
                        }
                        options={cityChoices}
                        onPick={(lab) => updateSite(site.id, { city: lab })}
                        onClear={() => updateSite(site.id, { city: "" })}
                      />
                    )}
                  </InspectionField>

                  <InspectionField htmlFor={`mv-map-${site.id}`} label="رابط Google Maps" className="lg:col-span-2">
                    <div className="relative">
                      <Input
                        id={`mv-map-${site.id}`}
                        value={site.mapUrl}
                        onChange={(event) => updateMapUrl(site, event.target.value)}
                        disabled={disabled}
                        placeholder="https://maps.google.com/…"
                        dir="ltr"
                        className={cn(INPUT_CLASS, "pl-10 font-mono text-[11.5px] leading-snug")}
                      />
                      <ClearFieldButton
                        hidden={!site.mapUrl.trim() && !site.latitude.trim() && !site.longitude.trim()}
                        disabled={disabled}
                        onClick={() => updateSite(site.id, { mapUrl: "", latitude: "", longitude: "" })}
                      />
                    </div>
                  </InspectionField>
                </div>

                <InspectionField htmlFor={`mv-site-notes-${site.id}`} label="ملاحظات">
                  <div className="relative">
                    <Textarea
                      id={`mv-site-notes-${site.id}`}
                      value={site.notes ?? ""}
                      onChange={(event) => updateSite(site.id, { notes: event.target.value })}
                      disabled={disabled}
                      placeholder="تعليمات للمعاين، أوقات زيارة…"
                      dir="auto"
                      rows={2}
                      className={cn(NOTES_AREA_CLASS, "pl-10")}
                    />
                    <ClearFieldButton
                      hidden={!(site.notes ?? "").trim()}
                      disabled={disabled}
                      className="top-3 translate-y-0"
                      onClick={() => updateSite(site.id, { notes: "" })}
                    />
                  </div>
                </InspectionField>
              </div>
            </section>
          );
        })}
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
