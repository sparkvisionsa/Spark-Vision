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

function textValue(value: unknown, maxLength: number): string {
  if (value == null) return "";
  return String(value).trim().slice(0, maxLength);
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
    region: textValue(record.region, 120),
    city: textValue(record.city, 120),
    latitude: toFiniteCoordinate(record.latitude ?? record.lat, "lat"),
    longitude: toFiniteCoordinate(record.longitude ?? record.lng, "lng"),
    mapUrl: textValue(record.mapUrl ?? record.url, 600) || undefined,
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
  const type = record.type === "secondary" ? "secondary" : record.type === "primary" ? "primary" : fallbackType;
  const phone = textValue(record.phone ?? record.value ?? record.number, 60);
  return phone ? { type, phone } : null;
}

export function projectContactFormFromData(
  locations: unknown[] | undefined,
  contacts: unknown[] | undefined,
): MvProjectContactForm {
  const location = normalizeProjectLocation(Array.isArray(locations) ? locations[0] : undefined);
  const normalizedContacts = (Array.isArray(contacts) ? contacts : [])
    .map((item, index) => normalizeProjectContact(item, index === 1 ? "secondary" : "primary"))
    .filter((item): item is MvProjectContact => item != null);

  const primary = normalizedContacts.find((item) => item.type === "primary");
  const secondary = normalizedContacts.find((item) => item.type === "secondary");

  return {
    region: location.region,
    city: location.city,
    latitude: formatCoordinate(location.latitude),
    longitude: formatCoordinate(location.longitude),
    mapUrl: location.mapUrl ?? "",
    primaryPhone: primary?.phone ?? "",
    secondaryPhone: secondary?.phone ?? "",
  };
}

export function projectContactDataFromForm(form: MvProjectContactForm): {
  locations: MvProjectLocation[];
  contacts: MvProjectContact[];
} {
  const region = textValue(form.region, 120);
  const city = textValue(form.city, 120);
  const latitude = toFiniteCoordinate(form.latitude, "lat");
  const longitude = toFiniteCoordinate(form.longitude, "lng");
  const mapUrl = textValue(form.mapUrl, 600);
  const primaryPhone = textValue(form.primaryPhone, 60);
  const secondaryPhone = textValue(form.secondaryPhone, 60);

  const locations =
    region || city || latitude !== null || longitude !== null || mapUrl
      ? [
          {
            region,
            city,
            latitude,
            longitude,
            ...(mapUrl ? { mapUrl } : {}),
          },
        ]
      : [];

  const contacts: MvProjectContact[] = [];
  if (primaryPhone) contacts.push({ type: "primary", phone: primaryPhone });
  if (secondaryPhone) contacts.push({ type: "secondary", phone: secondaryPhone });

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
