export type AssetDescriptionTaxonomyItem = {
  id: string;
  label: string;
};

export type AssetDescriptionTypeItem = {
  id: string;
  categoryId: string;
  label: string;
};

export type AssetDescriptionNameItem = {
  id: string;
  typeId: string;
  label: string;
};

export type AssetDescriptionItem = {
  id: string;
  categoryId: string;
  typeId: string;
  nameId: string;
  category: string;
  type: string;
  name: string;
  mainImageUrl: string | null;
};

export type AssetDescriptionCatalog = {
  categories: AssetDescriptionTaxonomyItem[];
  types: AssetDescriptionTypeItem[];
  names: AssetDescriptionNameItem[];
  descriptions: AssetDescriptionItem[];
};

export type SelectedAssetDescription = {
  id: string;
  category: string;
  type: string;
  name: string;
};

export const EMPTY_ASSET_DESCRIPTION_CATALOG: AssetDescriptionCatalog = {
  categories: [],
  types: [],
  names: [],
  descriptions: [],
};

export function formatAssetDescriptionLabel(
  value: Pick<AssetDescriptionItem, "category" | "type" | "name"> | null | undefined,
): string {
  if (!value) return "";
  return [value.category, value.type, value.name]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" / ");
}

export function catalogFromUnknown(value: unknown): AssetDescriptionCatalog {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return EMPTY_ASSET_DESCRIPTION_CATALOG;
  }
  const o = value as Record<string, unknown>;
  const asTaxonomy = (items: unknown): AssetDescriptionTaxonomyItem[] =>
    Array.isArray(items)
      ? items.flatMap((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return [];
          const row = item as Record<string, unknown>;
          const id = typeof row.id === "string" ? row.id.trim() : "";
          const label =
            typeof row.label === "string"
              ? row.label.trim()
              : typeof row.lable === "string"
                ? row.lable.trim()
                : "";
          return id && label ? [{ id, label }] : [];
        })
      : [];
  const asTypes = (items: unknown): AssetDescriptionTypeItem[] =>
    Array.isArray(items)
      ? items.flatMap((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return [];
          const row = item as Record<string, unknown>;
          const id = typeof row.id === "string" ? row.id.trim() : "";
          const categoryId = typeof row.categoryId === "string" ? row.categoryId.trim() : "";
          const label =
            typeof row.label === "string"
              ? row.label.trim()
              : typeof row.lable === "string"
                ? row.lable.trim()
                : "";
          return id && categoryId && label ? [{ id, categoryId, label }] : [];
        })
      : [];
  const asNames = (items: unknown): AssetDescriptionNameItem[] =>
    Array.isArray(items)
      ? items.flatMap((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return [];
          const row = item as Record<string, unknown>;
          const id = typeof row.id === "string" ? row.id.trim() : "";
          const typeId = typeof row.typeId === "string" ? row.typeId.trim() : "";
          const label = typeof row.label === "string" ? row.label.trim() : "";
          return id && typeId && label ? [{ id, typeId, label }] : [];
        })
      : [];
  const asDescriptions = (items: unknown): AssetDescriptionItem[] =>
    Array.isArray(items)
      ? items.flatMap((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return [];
          const row = item as Record<string, unknown>;
          const id = typeof row.id === "string" ? row.id.trim() : "";
          const categoryId = typeof row.categoryId === "string" ? row.categoryId.trim() : "";
          const typeId = typeof row.typeId === "string" ? row.typeId.trim() : "";
          const nameId = typeof row.nameId === "string" ? row.nameId.trim() : "";
          const category = typeof row.category === "string" ? row.category.trim() : "";
          const type = typeof row.type === "string" ? row.type.trim() : "";
          const name = typeof row.name === "string" ? row.name.trim() : "";
          const mainImageUrl =
            typeof row.mainImageUrl === "string" && row.mainImageUrl.trim()
              ? row.mainImageUrl.trim()
              : null;
          return id && category && type && name
            ? [{ id, categoryId, typeId, nameId, category, type, name, mainImageUrl }]
            : [];
        })
      : [];
  return {
    categories: asTaxonomy(o.categories),
    types: asTypes(o.types),
    names: asNames(o.names),
    descriptions: asDescriptions(o.descriptions),
  };
}

export function selectedAssetDescriptionFromUnknown(
  value: unknown,
): SelectedAssetDescription | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const category = typeof o.category === "string" ? o.category.trim() : "";
  const type = typeof o.type === "string" ? o.type.trim() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!category && !type && !name) return null;
  return {
    id: typeof o.id === "string" ? o.id.trim() : "",
    category,
    type,
    name,
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as {
    message?: string;
    error?: string;
  };
  return body.message || body.error || "تعذر تنفيذ الطلب.";
}

export async function fetchAssetDescriptionCatalog(
  csrfToken?: string,
): Promise<AssetDescriptionCatalog> {
  const response = await fetch("/api/company/asset-descriptions", {
    credentials: "include",
    headers: csrfToken ? { "x-csrf-token": csrfToken } : undefined,
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return catalogFromUnknown(await response.json());
}

export async function mutateAssetDescriptionCatalog(
  url: string,
  csrfToken: string,
  init: RequestInit,
): Promise<AssetDescriptionCatalog & { created?: { id: string; label?: string } }> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const json = (await response.json()) as Record<string, unknown>;
  return {
    ...catalogFromUnknown(json),
    created:
      json.created && typeof json.created === "object" && !Array.isArray(json.created)
        ? {
            id: String((json.created as { id?: unknown }).id ?? ""),
            label:
              typeof (json.created as { label?: unknown }).label === "string"
                ? (json.created as { label: string }).label
                : undefined,
          }
        : undefined,
  };
}
