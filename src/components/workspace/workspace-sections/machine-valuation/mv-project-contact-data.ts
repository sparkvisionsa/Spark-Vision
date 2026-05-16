import type { MvProjectContact, MvProjectLocation } from "./types";

export interface MvProjectContactForm {
  region: string;
  city: string;
  latitude: string;
  longitude: string;
  mapUrl: string;
  primaryPhone: string;
  secondaryPhone: string;
}

export interface MvProjectInspectionSiteForm extends MvProjectContactForm {
  id: string;
  name: string;
}

export interface MvProjectResolvedLocation {
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  mapUrl: string;
}

export const EMPTY_PROJECT_CONTACT_FORM: MvProjectContactForm = {
  region: "",
  city: "",
  latitude: "",
  longitude: "",
  mapUrl: "",
  primaryPhone: "",
  secondaryPhone: "",
};

const INSPECTION_SITE_ORDINALS = [
  "الأول",
  "الثاني",
  "الثالث",
  "الرابع",
  "الخامس",
  "السادس",
  "السابع",
  "الثامن",
  "التاسع",
  "العاشر",
];

function textValue(value: unknown, maxLength: number): string {
  if (value == null) return "";
  return String(value).trim().slice(0, maxLength);
}

function createInspectionSiteId(index: number): string {
  return `site-${index + 1}`;
}

function createDraftInspectionSiteId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toFiniteCoordinate(value: unknown, kind: "lat" | "lng"): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  if (kind === "lat" && (n < -90 || n > 90)) return null;
  if (kind === "lng" && (n < -180 || n > 180)) return null;
  return Math.round(n * 1_000_000) / 1_000_000;
}

export function formatCoordinate(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function decodeMapText(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

export function parseCoordinatesFromText(text: string): { latitude: number; longitude: number } | null {
  const source = decodeMapText(text.trim());
  if (!source) return null;

  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /(?:q|query|ll|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (!match) continue;
    const latitude = toFiniteCoordinate(match[1], "lat");
    const longitude = toFiniteCoordinate(match[2], "lng");
    if (latitude !== null && longitude !== null) {
      return { latitude, longitude };
    }
  }

  return null;
}

export function buildGoogleMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

function addressText(address: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = address[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export async function resolveProjectLocationFromCoordinates(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<MvProjectResolvedLocation> {
  const lat = toFiniteCoordinate(latitude, "lat") ?? latitude;
  const lng = toFiniteCoordinate(longitude, "lng") ?? longitude;
  const fallback: MvProjectResolvedLocation = {
    region: "",
    city: "",
    latitude: lat,
    longitude: lng,
    mapUrl: buildGoogleMapsUrl(lat, lng),
  };

  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(lat),
      lon: String(lng),
      addressdetails: "1",
      zoom: "14",
      "accept-language": "ar,en",
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return fallback;
    const data = (await response.json()) as {
      display_name?: unknown;
      address?: Record<string, unknown>;
    };
    const address = data.address ?? {};
    const city =
      addressText(address, [
        "city",
        "town",
        "village",
        "municipality",
        "suburb",
        "county",
        "state_district",
      ]) ||
      (typeof data.display_name === "string" ? data.display_name.split(",")[0]?.trim() ?? "" : "");
    const region = addressText(address, ["state", "region", "province", "governorate", "county", "country"]);
    return {
      ...fallback,
      region,
      city,
    };
  } catch {
    return fallback;
  }
}

export function normalizeProjectLocation(raw: unknown): MvProjectLocation {
  const record =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    id: textValue(record.id ?? record.siteId ?? record.locationId ?? record._id, 80) || undefined,
    name: textValue(record.name ?? record.label ?? record.title, 120) || undefined,
    region: textValue(record.region, 120),
    city: textValue(record.city, 120),
    latitude: toFiniteCoordinate(record.latitude ?? record.lat, "lat"),
    longitude: toFiniteCoordinate(record.longitude ?? record.lng, "lng"),
    mapUrl: textValue(record.mapUrl ?? record.url, 600) || undefined,
    primaryPhone: textValue(
      record.primaryPhone ?? record.primaryContactPhone ?? record.contactPhone ?? record.phone,
      60,
    ) || undefined,
    secondaryPhone: textValue(
      record.secondaryPhone ?? record.secondaryContactPhone ?? record.backupPhone ?? record.alternatePhone,
      60,
    ) || undefined,
  };
}

export function normalizeProjectContact(raw: unknown, fallbackType: "primary" | "secondary"): MvProjectContact | null {
  if (typeof raw === "string") {
    const phone = textValue(raw, 60);
    return phone ? { type: fallbackType, phone } : null;
  }

  const record =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const primaryPhone = textValue(record.primaryPhone ?? record.primaryContactPhone ?? record.contactPhone, 60);
  const secondaryPhone = textValue(
    record.secondaryPhone ?? record.secondaryContactPhone ?? record.backupPhone ?? record.alternatePhone,
    60,
  );
  const type =
    record.type === "secondary" || (!record.type && !record.phone && !record.value && !record.number && secondaryPhone)
      ? "secondary"
      : record.type === "primary"
        ? "primary"
        : fallbackType;
  const phone = textValue(
    record.phone ?? record.value ?? record.number ?? (type === "secondary" ? secondaryPhone : primaryPhone),
    60,
  );
  const locationId = textValue(record.locationId ?? record.siteId, 80);
  const rawLocationIndex = Number(record.locationIndex ?? record.siteIndex);
  const locationIndex = Number.isInteger(rawLocationIndex) && rawLocationIndex >= 0 ? rawLocationIndex : undefined;
  const locationName = textValue(record.locationName ?? record.siteName, 120);
  return phone
    ? {
        type,
        phone,
        ...(locationId ? { locationId } : {}),
        ...(locationIndex !== undefined ? { locationIndex } : {}),
        ...(locationName ? { locationName } : {}),
      }
    : null;
}

export function defaultInspectionSiteName(index: number): string {
  return `الموقع ${INSPECTION_SITE_ORDINALS[index] ?? `رقم ${index + 1}`}`;
}

export function createProjectInspectionSiteForm(index = 0): MvProjectInspectionSiteForm {
  return {
    id: createDraftInspectionSiteId(),
    name: defaultInspectionSiteName(index),
    ...EMPTY_PROJECT_CONTACT_FORM,
  };
}

export function projectContactFormFromData(
  locations: unknown[] | undefined,
  contacts: unknown[] | undefined,
): MvProjectContactForm {
  const [first] = projectInspectionSitesFromData(locations, contacts);
  if (!first) return EMPTY_PROJECT_CONTACT_FORM;
  const { region, city, latitude, longitude, mapUrl, primaryPhone, secondaryPhone } = first;
  return { region, city, latitude, longitude, mapUrl, primaryPhone, secondaryPhone };
}

export function projectContactDataFromForm(form: MvProjectContactForm): {
  locations: MvProjectLocation[];
  contacts: MvProjectContact[];
} {
  return projectContactDataFromInspectionSites([
    {
      id: "single",
      name: defaultInspectionSiteName(0),
      ...form,
    },
  ]);
}

export function projectInspectionSitesFromData(
  locations: unknown[] | undefined,
  contacts: unknown[] | undefined,
): MvProjectInspectionSiteForm[] {
  const normalizedLocations = (Array.isArray(locations) ? locations : []).map(normalizeProjectLocation);
  const normalizedContacts = (Array.isArray(contacts) ? contacts : [])
    .map((item, index) => normalizeProjectContact(item, index === 1 ? "secondary" : "primary"))
    .filter((item): item is MvProjectContact => item != null);
  const hasExplicitContactLinks = normalizedContacts.some(
    (item) => item.locationId || typeof item.locationIndex === "number" || item.locationName,
  );
  const unlinkedPrimaryContacts = hasExplicitContactLinks
    ? []
    : normalizedContacts.filter((item) => item.type === "primary");
  const unlinkedSecondaryContacts = hasExplicitContactLinks
    ? []
    : normalizedContacts.filter((item) => item.type === "secondary");
  const unlinkedSiteCount = hasExplicitContactLinks
    ? 0
    : Math.max(unlinkedPrimaryContacts.length, unlinkedSecondaryContacts.length);
  const indexedContactMax = normalizedContacts.reduce(
    (max, item) =>
      typeof item.locationIndex === "number" && item.locationIndex > max ? item.locationIndex : max,
    -1,
  );
  const siteCount = Math.max(
    normalizedLocations.length,
    indexedContactMax + 1,
    unlinkedSiteCount,
    1,
  );

  return Array.from({ length: Math.min(siteCount, 10) }, (_, index) => {
    const location = normalizedLocations[index];
    const locationId = location?.id || createInspectionSiteId(index);
    const siteName = location?.name ?? defaultInspectionSiteName(index);
    const byId = normalizedContacts.filter((item) => item.locationId && item.locationId === locationId);
    const byIndex = normalizedContacts.filter((item) => item.locationIndex === index);
    const byName = normalizedContacts.filter((item) => item.locationName && item.locationName === siteName);
    const siteContacts =
      byId.length > 0
        ? byId
        : byIndex.length > 0
          ? byIndex
          : byName.length > 0
            ? byName
            : !hasExplicitContactLinks
              ? [unlinkedPrimaryContacts[index], unlinkedSecondaryContacts[index]].filter(
                  (item): item is MvProjectContact => item != null,
                )
              : [];
    const primary = siteContacts.find((item) => item.type === "primary");
    const secondary = siteContacts.find((item) => item.type === "secondary");
    const fallbackName =
      location?.name ||
      primary?.locationName ||
      secondary?.locationName ||
      defaultInspectionSiteName(index);
    const siteId = location?.id || primary?.locationId || secondary?.locationId || locationId;

    return {
      id: siteId,
      name: fallbackName,
      region: location?.region ?? "",
      city: location?.city ?? "",
      latitude: formatCoordinate(location?.latitude),
      longitude: formatCoordinate(location?.longitude),
      mapUrl: location?.mapUrl ?? "",
      primaryPhone: primary?.phone ?? location?.primaryPhone ?? "",
      secondaryPhone: secondary?.phone ?? location?.secondaryPhone ?? "",
    };
  });
}

export function projectContactDataFromInspectionSites(forms: MvProjectInspectionSiteForm[]): {
  locations: MvProjectLocation[];
  contacts: MvProjectContact[];
} {
  const locations: MvProjectLocation[] = [];
  const contacts: MvProjectContact[] = [];

  forms.slice(0, 10).forEach((form, index) => {
    const region = textValue(form.region, 120);
    const city = textValue(form.city, 120);
    const latitude = toFiniteCoordinate(form.latitude, "lat");
    const longitude = toFiniteCoordinate(form.longitude, "lng");
    const mapUrl = textValue(form.mapUrl, 600);
    const siteId = textValue(form.id, 80) || createInspectionSiteId(index);
    const name = textValue(form.name, 120) || defaultInspectionSiteName(index);
    const primaryPhone = textValue(form.primaryPhone, 60);
    const secondaryPhone = textValue(form.secondaryPhone, 60);
    const hasSiteData =
      region ||
      city ||
      latitude !== null ||
      longitude !== null ||
      mapUrl ||
      primaryPhone ||
      secondaryPhone ||
      name !== defaultInspectionSiteName(index);

    if (!hasSiteData) return;

    const locationIndex = locations.length;
    locations.push({
      id: siteId,
      name,
      region,
      city,
      latitude,
      longitude,
      ...(mapUrl ? { mapUrl } : {}),
      ...(primaryPhone ? { primaryPhone } : {}),
      ...(secondaryPhone ? { secondaryPhone } : {}),
    });
    if (primaryPhone) {
      contacts.push({ type: "primary", phone: primaryPhone, locationId: siteId, locationIndex, locationName: name });
    }
    if (secondaryPhone) {
      contacts.push({ type: "secondary", phone: secondaryPhone, locationId: siteId, locationIndex, locationName: name });
    }
  });

  return { locations, contacts };
}

export function buildProjectMapsHref(form: MvProjectContactForm): string {
  const parsed = parseCoordinatesFromText(`${form.latitude},${form.longitude}`);
  const query =
    parsed != null
      ? `${parsed.latitude},${parsed.longitude}`
      : [form.region.trim(), form.city.trim()].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || "Saudi Arabia")}`;
}
