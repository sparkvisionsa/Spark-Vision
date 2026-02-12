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
const MAX_MODEL_YEAR_SPAN = 300;

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

function buildNormalizedDigitExpression(input: Document): Document {
  const replacements: Array<[string, string]> = [
    ["\u0660", "0"],
    ["\u0661", "1"],
    ["\u0662", "2"],
    ["\u0663", "3"],
    ["\u0664", "4"],
    ["\u0665", "5"],
    ["\u0666", "6"],
    ["\u0667", "7"],
    ["\u0668", "8"],
    ["\u0669", "9"],
    ["\u06F0", "0"],
    ["\u06F1", "1"],
    ["\u06F2", "2"],
    ["\u06F3", "3"],
    ["\u06F4", "4"],
    ["\u06F5", "5"],
    ["\u06F6", "6"],
    ["\u06F7", "7"],
    ["\u06F8", "8"],
    ["\u06F9", "9"],
    ["\u060C", ""],
    ["\u066C", ""],
    ["\u066B", ""],
    [",", ""],
    [".", ""],
    [" ", ""],
    ["\u00A0", ""],
  ];

  let output: Document = input;
  for (const [find, replacement] of replacements) {
    output = {
      $replaceAll: {
        input: output,
        find,
        replacement,
      },
    };
  }
  return output;
}
function buildMileageNumericExpression(input: Document): Document {
  const normalized = buildNormalizedDigitExpression({
    $convert: {
      input: { $ifNull: [input, ""] },
      to: "string",
      onError: "",
      onNull: "",
    },
  });

  return {
    $let: {
      vars: {
        match: {
          $regexFind: {
            input: normalized,
            regex: /[0-9][0-9]*/,
          },
        },
      },
      in: {
        $cond: [
          { $ne: ["$$match.match", null] },
          {
            $convert: {
              input: "$$match.match",
              to: "double",
              onError: null,
              onNull: null,
            },
          },
          null,
        ],
      },
    },
  };
}

function buildYallaMileageRawExpression(): Document {
  const specsExpression: Document = {
    $cond: [
      { $eq: [{ $type: "$detail.importantSpecs" }, "object"] },
      "$detail.importantSpecs",
      {},
    ],
  };
  return {
    $let: {
      vars: {
        specs: specsExpression,
        specsArray: { $objectToArray: specsExpression },
      },
      in: {
        $ifNull: [
          { $getField: { field: "عدد الكيلومترات", input: "$$specs" } },
          {
            $ifNull: [
              { $getField: { field: "المسافة المقطوعة", input: "$$specs" } },
              {
                $ifNull: [
                  { $getField: { field: "Mileage", input: "$$specs" } },
                  {
                    $first: {
                      $map: {
                        input: {
                          $filter: {
                            input: "$$specsArray",
                            as: "entry",
                            cond: {
                              $regexMatch: {
                                input: { $toLower: "$$entry.k" },
                                regex: /(mileage|kilometer|kilometre|كيلومتر|الكيلومترات)/,
                              },
                            },
                          },
                        },
                        as: "entry",
                        in: "$$entry.v",
                      },
                    },
                  },
                ],
              },
            ],
          },
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

function buildYearOnlyItems(years: number[]) {
  return years.map((year) => ({
    id: `model-year-${year}`,
    postDate: null,
    tags: [],
    carModelYear: year,
    mileage: null,
    title: "Untitled",
    city: "",
    priceNumeric: null,
    priceFormatted: null,
    imagesCount: 0,
    hasImage: false,
    commentsCount: 0,
    url: "",
    phone: "",
    source: "yallamotor" as const,
    priceCompare: null,
  }));
}

function buildDescendingYearRange(years: number[]) {
  const uniqueSortedYears = Array.from(
    new Set(
      years
        .map((year) => Math.trunc(year))
        .filter((year) => Number.isFinite(year))
    )
  ).sort((a, b) => b - a);

  if (uniqueSortedYears.length === 0) {
    return [];
  }

  const newestYear = uniqueSortedYears[0];
  const oldestYear = uniqueSortedYears[uniqueSortedYears.length - 1];
  if (newestYear - oldestYear > MAX_MODEL_YEAR_SPAN) {
    return uniqueSortedYears;
  }

  const fullRange: number[] = [];
  for (let year = newestYear; year >= oldestYear; year -= 1) {
    fullRange.push(year);
  }
  return fullRange;
}

export async function listYallaMotors(query: YallaMotorListQuery, options: ListOptions = {}) {
  const db = await getMongoDb();
  const collection = getYallaMotorCollection(db);

  const maxLimit = options.maxLimit ?? MAX_LIMIT;
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, maxLimit);
  const page = Math.max(query.page ?? 1, 1);
  const skip = (page - 1) * limit;
  const filter = buildFilter(query);

  if (query.fields === "modelYears") {
    const modelYearFilter = buildFilter({
      ...query,
      tag1: undefined,
      tag2: undefined,
      carModelYear: undefined,
    });
    const yearRows = await collection
      .aggregate([
        { $match: modelYearFilter },
        {
          $project: {
            carModelYear: {
              $convert: {
                input: { $arrayElemAt: ["$detail.breadcrumb", 5] },
                to: "int",
                onError: null,
                onNull: null,
              },
            },
          },
        },
        { $match: { carModelYear: { $ne: null } } },
        { $group: { _id: "$carModelYear" } },
        { $sort: { _id: -1 } },
      ])
      .toArray();

    const years = yearRows
      .map((row) => toNumber(row?._id))
      .filter((value): value is number => value !== null);
    const items = buildYearOnlyItems(buildDescendingYearRange(years));

    return {
      items,
      total: items.length,
      page: 1,
      limit: items.length || 1,
    };
  }

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
  const mileageRange: { $gte?: number; $lte?: number } = {};
  if (query.mileage !== undefined) {
    mileageRange.$gte = query.mileage;
    mileageRange.$lte = query.mileage;
  }
  if (query.mileageMin !== undefined) mileageRange.$gte = query.mileageMin;
  if (query.mileageMax !== undefined) mileageRange.$lte = query.mileageMax;
  const applyHasMileage = query.hasMileage === true;
  const applyMileageRange = Object.keys(mileageRange).length > 0;

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
        mileage: buildMileageNumericExpression(buildYallaMileageRawExpression()),
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

  if (applyHasMileage) {
    pipeline.push({ $match: { mileage: { $ne: null } } });
  }

  if (applyMileageRange) {
    pipeline.push({ $match: { mileage: mileageRange } });
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
    mileage: toNumber(item.mileage),
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

