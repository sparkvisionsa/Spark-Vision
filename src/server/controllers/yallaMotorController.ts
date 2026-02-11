import type { Filter, Sort, Document } from "mongodb";
import { ObjectId } from "mongodb";
import { getMongoDb } from "../mongodb";
import { getYallaMotorCollection, type YallaMotorDoc } from "../models/yallaMotor";
import type { HarajScrapeListQuery } from "./harajScrapeController";
import { buildVehicleAliases } from "../../lib/vehicle-name-match";

export type YallaMotorListQuery = HarajScrapeListQuery;

type ListOptions = {
  maxLimit?: number;
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function toRegex(value: string) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function buildAliasRegexes(value: string) {
  const aliases = [value, ...buildVehicleAliases(value)];
  const uniqueAliases = Array.from(
    new Set(aliases.map((item) => item.trim()).filter(Boolean))
  );
  return uniqueAliases.map(toRegex);
}

function buildFilter(query: YallaMotorListQuery): Filter<YallaMotorDoc> {
  const filter: Filter<YallaMotorDoc> = {};
  const andFilters: Filter<YallaMotorDoc>[] = [];

  if (query.search) {
    const terms = query.search
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);
    for (const term of terms) {
      const searchRegex = toRegex(term);
      andFilters.push({
        $or: [
          { cardTitle: searchRegex },
          { "detail.description": searchRegex },
          { "detail.overview.h1": searchRegex },
          { "detail.overview.h4": searchRegex },
          { "detail.breadcrumb": searchRegex },
        ],
      });
    }
  }

  if (query.city) {
    const cityRegex = toRegex(query.city);
    andFilters.push({ "detail.breadcrumb.2": cityRegex });
  }

  if (query.tag1) {
    const tagRegexes = buildAliasRegexes(query.tag1);
    andFilters.push({ "detail.breadcrumb.3": { $in: tagRegexes } });
  }

  if (query.tag2) {
    const tagRegexes = buildAliasRegexes(query.tag2);
    andFilters.push({ "detail.breadcrumb.4": { $in: tagRegexes } });
  }

  if (query.carModelYear !== undefined) {
    const yearValues = [query.carModelYear, String(query.carModelYear)];
    andFilters.push({ "detail.breadcrumb.5": { $in: yearValues } });
  }

  if (query.hasImage === true) {
    andFilters.push({ "detail.images.0": { $exists: true } });
  }

  if (query.hasPrice === true) {
    andFilters.push({ cardPriceText: { $regex: /\d/ } });
  }

  if (query.hasComments === true) {
    andFilters.push({
      $or: [
        { "detail.priceCompare.min": { $exists: true, $ne: null } },
        { "detail.priceCompare.max": { $exists: true, $ne: null } },
        { "detail.priceCompare.current": { $exists: true, $ne: null } },
      ],
    });
  }

  if (query.dateFrom || query.dateTo) {
    const range: { $gte?: Date; $lte?: Date } = {};
    if (query.dateFrom) {
      const start = new Date(query.dateFrom);
      if (!Number.isNaN(start.getTime())) {
        range.$gte = start;
      }
    }
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      if (!Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        range.$lte = end;
      }
    }
    if (Object.keys(range).length > 0) {
      andFilters.push({ fetchedAt: range });
    }
  }

  if (andFilters.length > 0) {
    filter.$and = andFilters;
  }

  return filter;
}

function buildSort(sort?: string): Sort {
  switch (sort) {
    case "oldest":
      return { postDate: 1 };
    case "price-high":
      return { priceNumeric: -1, postDate: -1 };
    case "price-low":
      return { priceNumeric: 1, postDate: -1 };
    case "comments":
      return { commentsCount: -1, postDate: -1 };
    default:
      return { postDate: -1 };
  }
}

function buildPriceNumericExpression(): Document {
  return {
    $let: {
      vars: {
        match: {
          $regexFind: {
            input: { $ifNull: ["$cardPriceText", ""] },
            regex: /[0-9][0-9,.]*/,
          },
        },
      },
      in: {
        $cond: [
          { $ne: ["$$match.match", null] },
          {
            $toDouble: {
              $replaceAll: {
                input: "$$match.match",
                find: ",",
                replacement: "",
              },
            },
          },
          null,
        ],
      },
    },
  };
}

function toNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const num = Number(value);
    return Number.isNaN(num) ? null : num;
  }
  if (typeof value === "object" && value && "toNumber" in value && typeof (value as any).toNumber === "function") {
    return (value as any).toNumber();
  }
  return null;
}

export async function listYallaMotors(query: YallaMotorListQuery, options: ListOptions = {}) {
  const db = await getMongoDb();
  const collection = getYallaMotorCollection(db);

  const maxLimit = options.maxLimit ?? MAX_LIMIT;
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, maxLimit);
  const page = Math.max(query.page ?? 1, 1);
  const skip = (page - 1) * limit;
  const filter = buildFilter(query);
  const sort = buildSort(query.sort);
  const isOptionsMode = query.fields === "options";
  const needsNumericPrice =
    !isOptionsMode &&
    (query.sort === "price-high" ||
      query.sort === "price-low" ||
      query.minPrice !== undefined ||
      query.maxPrice !== undefined);

  const priceRange: { $gte?: number; $lte?: number } = {};
  if (query.minPrice !== undefined) priceRange.$gte = query.minPrice;
  if (query.maxPrice !== undefined) priceRange.$lte = query.maxPrice;
  const applyPriceRange = Object.keys(priceRange).length > 0;

  const pipeline: Document[] = [
    { $match: filter },
    {
      $project: {
        id: { $toString: "$_id" },
        postDate: { $toLong: "$fetchedAt" },
        tags: [
          { $ifNull: [{ $arrayElemAt: ["$detail.breadcrumb", 0] }, "yallamotor"] },
          { $ifNull: [{ $arrayElemAt: ["$detail.breadcrumb", 3] }, ""] },
          { $ifNull: [{ $arrayElemAt: ["$detail.breadcrumb", 4] }, ""] },
        ],
        carModelYear: {
          $convert: {
            input: { $arrayElemAt: ["$detail.breadcrumb", 5] },
            to: "int",
            onError: null,
            onNull: null,
          },
        },
        title: isOptionsMode ? { $literal: "Untitled" } : { $ifNull: ["$cardTitle", "Untitled"] },
        city: isOptionsMode ? { $literal: "" } : { $ifNull: [{ $arrayElemAt: ["$detail.breadcrumb", 2] }, ""] },
        priceNumeric: needsNumericPrice ? buildPriceNumericExpression() : { $literal: null },
        priceFormatted: isOptionsMode ? { $literal: null } : "$cardPriceText",
        imagesCount: isOptionsMode ? { $literal: 0 } : { $size: { $ifNull: ["$detail.images", []] } },
        hasImage: isOptionsMode
          ? { $literal: false }
          : {
              $gt: [{ $size: { $ifNull: ["$detail.images", []] } }, 0],
            },
        commentsCount: { $literal: 0 },
        url: isOptionsMode ? { $literal: "" } : { $ifNull: ["$url", "$detail.url"] },
        phone: { $literal: "" },
        source: { $literal: "yallamotor" },
        priceCompare: isOptionsMode ? { $literal: null } : "$detail.priceCompare",
      },
    },
  ];

  if (applyPriceRange) {
    pipeline.push({ $match: { priceNumeric: priceRange } });
  }

  pipeline.push({
    $facet: {
      items: [
        { $sort: sort },
        { $skip: skip },
        { $limit: limit },
      ],
      total: [{ $count: "count" }],
    },
  });

  const [result] = await collection.aggregate(pipeline).toArray();
  const items = (result?.items ?? []).map((item: any) => ({
    ...item,
    postDate: toNumber(item.postDate),
    priceNumeric: toNumber(item.priceNumeric),
    carModelYear: toNumber(item.carModelYear),
    imagesCount: toNumber(item.imagesCount) ?? 0,
    commentsCount: toNumber(item.commentsCount) ?? 0,
  }));
  const total = toNumber(result?.total?.[0]?.count) ?? 0;

  return {
    items,
    total,
    page,
    limit,
  };
}

export async function getYallaMotorById(id: string) {
  const db = await getMongoDb();
  const collection = getYallaMotorCollection(db);

  const filters: Filter<YallaMotorDoc>[] = [
    { _id: id as any },
    { url: id },
    { "detail.url": id },
  ];

  if (ObjectId.isValid(id)) {
    filters.push({ _id: new ObjectId(id) } as unknown as Filter<YallaMotorDoc>);
  }

  const doc = await collection.findOne({ $or: filters });
  return doc;
}
