"use client";

import { useState } from "react";
import { LocateFixed, Loader2, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  type MvProjectContactForm,
  parseCoordinatesFromText,
  resolveProjectLocationFromCoordinates,
} from "./mv-project-contact-data";
import { MvProjectMapPicker } from "./mv-project-map-picker";
import { useMvI18n } from "./mv-i18n";

interface ProjectContactFieldsProps {
  value: MvProjectContactForm;
  onChange: (next: MvProjectContactForm) => void;
  disabled?: boolean;
  className?: string;
}

export function MvProjectContactFields({
  value,
  onChange,
  disabled,
  className,
}: ProjectContactFieldsProps) {
  const { t, dir } = useMvI18n();
  const [locating, setLocating] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");

  const update = (patch: Partial<MvProjectContactForm>) => {
    onChange({ ...value, ...patch });
  };

  const handleMapTextChange = (mapUrl: string) => {
    const parsed = parseCoordinatesFromText(mapUrl);
    update({
      mapUrl,
      ...(parsed
        ? {
            latitude: String(parsed.latitude),
            longitude: String(parsed.longitude),
          }
        : {}),
    });
  };

  const applyCoordinates = async (latitude: number, longitude: number) => {
    setLocationError("");
    setResolvingLocation(true);
    const resolved = await resolveProjectLocationFromCoordinates(latitude, longitude);
    update({
      region: resolved.region,
      city: resolved.city,
      latitude: String(resolved.latitude),
      longitude: String(resolved.longitude),
      mapUrl: resolved.mapUrl,
    });
    if (!resolved.region || !resolved.city) {
      setLocationError(t("projects.contact.errors.partialResolve"));
    }
    setResolvingLocation(false);
  };

  const handleUseCurrentLocation = () => {
    setLocationError("");
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError(t("projects.contact.errors.geoUnsupported"));
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Math.round(position.coords.latitude * 1_000_000) / 1_000_000;
        const longitude = Math.round(position.coords.longitude * 1_000_000) / 1_000_000;
        void applyCoordinates(latitude, longitude).finally(() => setLocating(false));
      },
      () => {
        setLocationError(t("projects.contact.errors.geoFailed"));
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
  };

  const initialMapPoint = parseCoordinatesFromText(`${value.latitude},${value.longitude}`);
  const busyResolving = locating || resolvingLocation;

  return (
    <div className={cn("space-y-4 text-right", className)} dir={dir}>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-bold text-slate-800">{t("projects.contact.locationSection")}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMapOpen(true)}
              disabled={disabled || busyResolving}
              className="h-8 gap-1.5 rounded-lg border-sky-200 bg-white px-2.5 text-[11px] text-sky-700 hover:bg-sky-50"
            >
              <MapPinned className="h-3.5 w-3.5" />
              {t("projects.contact.map")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUseCurrentLocation}
              disabled={disabled || busyResolving}
              className="h-8 gap-1.5 rounded-lg border-emerald-200 bg-white px-2.5 text-[11px] text-emerald-700 hover:bg-emerald-50"
            >
              {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
              {t("projects.contact.myLocation")}
            </Button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500">{t("projects.contact.region")}</label>
            <Input
              value={value.region}
              onChange={(event) => update({ region: event.target.value })}
              disabled={disabled}
              placeholder={t("projects.contact.regionPlaceholder")}
              className="h-10 rounded-xl border-slate-200 bg-white text-[13px]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500">{t("projects.contact.city")}</label>
            <Input
              value={value.city}
              onChange={(event) => update({ city: event.target.value })}
              disabled={disabled}
              placeholder={t("projects.contact.regionPlaceholder")}
              className="h-10 rounded-xl border-slate-200 bg-white text-[13px]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-slate-500">{t("projects.contact.mapUrlOrCoords")}</label>
          <Input
            value={value.mapUrl}
            onChange={(event) => handleMapTextChange(event.target.value)}
            disabled={disabled}
            placeholder={t("projects.contact.mapUrlPlaceholder")}
            className="h-10 rounded-xl border-slate-200 bg-white text-[12px]"
            dir="ltr"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500">{t("projects.contact.latitude")}</label>
            <Input
              value={value.latitude}
              onChange={(event) => update({ latitude: event.target.value })}
              disabled={disabled}
              inputMode="decimal"
              placeholder="Latitude"
              className="h-10 rounded-xl border-slate-200 bg-white text-[12px]"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500">{t("projects.contact.longitude")}</label>
            <Input
              value={value.longitude}
              onChange={(event) => update({ longitude: event.target.value })}
              disabled={disabled}
              inputMode="decimal"
              placeholder="Longitude"
              className="h-10 rounded-xl border-slate-200 bg-white text-[12px]"
              dir="ltr"
            />
          </div>
        </div>

        {locationError ? <p className="text-[11px] leading-5 text-red-600">{locationError}</p> : null}
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
        <p className="text-[12px] font-bold text-slate-800">{t("projects.contact.contactSection")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500">{t("projects.contact.primaryPhone")}</label>
            <Input
              value={value.primaryPhone}
              onChange={(event) => update({ primaryPhone: event.target.value })}
              disabled={disabled}
              inputMode="tel"
              placeholder={t("projects.contact.phonePlaceholder")}
              className="h-10 rounded-xl border-slate-200 bg-slate-50/60 text-[13px]"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-slate-500">{t("projects.contact.secondaryPhone")}</label>
            <Input
              value={value.secondaryPhone}
              onChange={(event) => update({ secondaryPhone: event.target.value })}
              disabled={disabled}
              inputMode="tel"
              placeholder={t("projects.contact.phonePlaceholder")}
              className="h-10 rounded-xl border-slate-200 bg-slate-50/60 text-[13px]"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      <MvProjectMapPicker
        open={mapOpen}
        onOpenChange={setMapOpen}
        initialPoint={initialMapPoint}
        confirming={resolvingLocation}
        onConfirm={(point) => {
          void applyCoordinates(point.latitude, point.longitude).then(() => setMapOpen(false));
        }}
      />
    </div>
  );
}
