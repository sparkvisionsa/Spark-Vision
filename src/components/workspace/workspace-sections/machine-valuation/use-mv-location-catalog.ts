"use client";

import { useEffect, useState } from "react";
import { toApiUrl } from "@/lib/api-url";

export interface MvLocationCatalogRegion {
  id: string;
  titleAr: string;
  titleEn: string;
}

export interface MvLocationCatalogCity {
  id: string;
  titleAr: string;
  titleEn: string;
  regionId: string;
  active?: boolean;
}

interface CatalogBundle {
  regions: MvLocationCatalogRegion[];
  cities: MvLocationCatalogCity[];
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(toApiUrl(path), {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

let memoryRegions: MvLocationCatalogRegion[] | null = null;
let memoryCities: MvLocationCatalogCity[] | null = null;
let inflight: Promise<CatalogBundle | null> | null = null;

async function loadCatalogBundle(): Promise<CatalogBundle | null> {
  if (memoryRegions && memoryCities) {
    return { regions: memoryRegions, cities: memoryCities };
  }
  if (!inflight) {
    inflight = Promise.all([
      fetchJson<MvLocationCatalogRegion[]>("/api/locations/regions"),
      fetchJson<MvLocationCatalogCity[]>("/api/locations/cities"),
    ])
      .then(([r, c]) => {
        memoryRegions = Array.isArray(r) ? r : [];
        memoryCities = Array.isArray(c) ? c : [];
        return { regions: memoryRegions, cities: memoryCities };
      })
      .catch(() => {
        memoryRegions = null;
        memoryCities = null;
        return null;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** يحمّل الكتالوج مبكراً؛ يُستدعى مرّة واحدة ويُخبّأ في الذاكرة بين الصفحات. */
export function prefetchMvLocationCatalog() {
  void loadCatalogBundle();
}

/**
 * المناطق والمدن المعرفة من إعدادات المنصة (`/api/locations/*`).
 * مطابقة لما تستخدمه الشاشات مثل الإعدادات وعملاء التقييم.
 */
export function useMvLocationCatalog() {
  const [regions, setRegions] = useState<MvLocationCatalogRegion[]>(() => memoryRegions ?? []);
  const [cities, setCities] = useState<MvLocationCatalogCity[]>(() => memoryCities ?? []);
  const [loading, setLoading] = useState(() => !(memoryRegions && memoryCities));
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (memoryRegions && memoryCities) {
      setRegions(memoryRegions);
      setCities(memoryCities);
      setLoading(false);
      setError(false);
      return;
    }
    void loadCatalogBundle().then((data) => {
      if (cancelled) return;
      if (!data) {
        setRegions([]);
        setCities([]);
        setError(true);
      } else {
        setRegions(data.regions);
        setCities(data.cities);
        setError(false);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { regions, cities, loading, error };
}
