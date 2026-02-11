import { listHarajScrapes, type HarajScrapeListQuery } from "./harajScrapeController";
import { listYallaMotors } from "./yallaMotorController";
import { isVehicleTextMatch } from "../../lib/vehicle-name-match";

export type CarsSourcesListQuery = HarajScrapeListQuery & {
  sources?: string[];
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 5000;
const MAX_INTERNAL_LIMIT = 5000;

function normalizeSource(value: string) {
  return value.trim().toLowerCase();
}

function toEpochMillis(value: number | null) {
  if (!value) return null;
  return value > 1_000_000_000_000 ? value : value * 1000;
}

function sortItems(items: Array<Record<string, any>>, sort?: string) {
  const getDate = (item: Record<string, any>) => toEpochMillis(item.postDate ?? null) ?? 0;
  const getPrice = (item: Record<string, any>) =>
    typeof item.priceNumeric === "number" ? item.priceNumeric : null;
  const getComments = (item: Record<string, any>) =>
    typeof item.commentsCount === "number" ? item.commentsCount : 0;

  const compare = (a: Record<string, any>, b: Record<string, any>) => {
    switch (sort) {
      case "oldest":
        return getDate(a) - getDate(b);
      case "price-high": {
        const aPrice = getPrice(a);
        const bPrice = getPrice(b);
        if (aPrice === null && bPrice === null) return getDate(b) - getDate(a);
        if (aPrice === null) return 1;
        if (bPrice === null) return -1;
        return bPrice - aPrice || getDate(b) - getDate(a);
      }
      case "price-low": {
        const aPrice = getPrice(a);
        const bPrice = getPrice(b);
        if (aPrice === null && bPrice === null) return getDate(b) - getDate(a);
        if (aPrice === null) return 1;
        if (bPrice === null) return -1;
        return aPrice - bPrice || getDate(b) - getDate(a);
      }
      case "comments":
        return getComments(b) - getComments(a) || getDate(b) - getDate(a);
      default:
        return getDate(b) - getDate(a);
    }
  };

  return [...items].sort(compare);
}

export async function listCarsSources(query: CarsSourcesListQuery) {
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const page = Math.max(query.page ?? 1, 1);
  const brandQuery = query.tag1?.trim() ?? "";
  const modelQuery = query.tag2?.trim() ?? "";
  const useVehicleNameMatching = Boolean(brandQuery || modelQuery);
  const perSourceLimit = useVehicleNameMatching
    ? MAX_INTERNAL_LIMIT
    : Math.min(limit * page, MAX_INTERNAL_LIMIT);
  const sourceQuery = useVehicleNameMatching
    ? { ...query, tag1: undefined, tag2: undefined }
    : query;

  const sources = (query.sources ?? ["haraj", "yallamotor"]).map(normalizeSource);
  const includeHaraj = sources.includes("haraj");
  const includeYalla = sources.includes("yallamotor");

  const [harajData, yallaData] = await Promise.all([
    includeHaraj
      ? listHarajScrapes(
          {
            ...sourceQuery,
            page: 1,
            limit: perSourceLimit,
          },
          { maxLimit: perSourceLimit }
        )
      : Promise.resolve({ items: [], total: 0, page: 1, limit: perSourceLimit }),
    includeYalla
      ? listYallaMotors(
          {
            ...sourceQuery,
            page: 1,
            limit: perSourceLimit,
          },
          { maxLimit: perSourceLimit }
        )
      : Promise.resolve({ items: [], total: 0, page: 1, limit: perSourceLimit }),
  ]);

  const normalizedHaraj = harajData.items.map((item: any) => ({
    ...item,
    postDate: toEpochMillis(item.postDate ?? null),
    source: "haraj",
    priceCompare: null,
  }));

  const normalizedYalla = yallaData.items.map((item: any) => ({
    ...item,
    postDate: toEpochMillis(item.postDate ?? null),
    source: "yallamotor",
  }));

  const matchedItems = [...normalizedHaraj, ...normalizedYalla].filter((item) => {
    const brand = item?.tags?.[1] ?? "";
    const model = item?.tags?.[2] ?? "";
    return isVehicleTextMatch(brand, brandQuery) && isVehicleTextMatch(model, modelQuery);
  });
  const combinedItems = sortItems(matchedItems, query.sort);
  const start = (page - 1) * limit;
  const pagedItems = combinedItems.slice(start, start + limit);
  const total = useVehicleNameMatching
    ? combinedItems.length
    : harajData.total + yallaData.total;

  return {
    items: pagedItems,
    total,
    page,
    limit,
  };
}
