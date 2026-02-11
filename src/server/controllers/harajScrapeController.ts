import type { Document, Filter, Sort } from "mongodb";
import { getMongoDb } from "../mongodb";
import { getHarajScrapeCollection, type HarajScrapeDoc } from "../models/harajScrape";
import { buildVehicleAliases } from "../../lib/vehicle-name-match";

export type HarajScrapeListQuery = {
  search?: string;
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  hasImage?: boolean;
  hasPrice?: boolean;
  hasComments?: boolean;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  page?: number;
  limit?: number;
  tag0?: string;
  tag1?: string;
  tag2?: string;
  carModelYear?: number;
  mileage?: number;
  mileageMin?: number;
  mileageMax?: number;
  excludeTag1?: string | string[];
  fields?: "default" | "options";
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type ListOptions = {
  maxLimit?: number;
};

function toRegex(value: string) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

function normalizeList(value?: string | string[]) {
  if (!value) return [];
  const values = Array.isArray(value) ? value : value.split(",");
  return values.map((item) => item.trim()).filter(Boolean);
}

function buildAliasRegexes(value: string) {
  const aliases = [value, ...buildVehicleAliases(value)];
  const uniqueAliases = Array.from(
    new Set(aliases.map((item) => item.trim()).filter(Boolean))
  );
  return uniqueAliases.map(toRegex);
}

function toEpochNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) return numeric;
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  return null;
}

function toMileageNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const normalizedDigits = raw
    .replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit).toString())
    .replace(/,/g, "")
    .replace(/\./g, "")
    .replace(/\s+/g, "");
  const match = normalizedDigits.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isNaN(parsed) ? null : parsed;
}

function buildNormalizedDigitExpression(input: Document): Document {
  const replacements: Array<[string, string]> = [
    ["٠", "0"],
    ["١", "1"],
    ["٢", "2"],
    ["٣", "3"],
    ["٤", "4"],
    ["٥", "5"],
    ["٦", "6"],
    ["٧", "7"],
    ["٨", "8"],
    ["٩", "9"],
    [",", ""],
    [".", ""],
    [" ", ""],
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

function buildMileageNumberExpressionFromPath(path: string): Document {
  const normalized = buildNormalizedDigitExpression({
    $convert: {
      input: { $ifNull: [path, ""] },
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

function buildCoalescedMileageExpression(paths: string[]): Document {
  const expressions = paths.map((path) => buildMileageNumberExpressionFromPath(path));
  if (expressions.length === 0) return null as unknown as Document;
  return expressions.slice(1).reduce<Document>(
    (acc, expression) => ({
      $ifNull: [acc, expression],
    }),
    expressions[0]
  );
}

function buildFilter(query: HarajScrapeListQuery): Filter<HarajScrapeDoc> {
  const filter: Filter<HarajScrapeDoc> = {};
  const andFilters: Filter<HarajScrapeDoc>[] = [];

  if (query.search) {
    const terms = query.search
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);
    for (const term of terms) {
      const searchRegex = toRegex(term);
      andFilters.push({
        $or: [
          { title: searchRegex },
          { "item.title": searchRegex },
          { "item.bodyTEXT": searchRegex },
          { "gql.posts.json.data.posts.items.title": searchRegex },
          { "gql.posts.json.data.posts.items.bodyTEXT": searchRegex },
        ],
      });
    }
  }

  if (query.city) {
    const cityRegex = toRegex(query.city);
    andFilters.push({
      $or: [{ city: cityRegex }, { "item.city": cityRegex }, { "item.geoCity": cityRegex }],
    });
  }

  if (query.hasImage === true) {
    andFilters.push({
      $or: [
        { "item.imagesList.0": { $exists: true } },
        { "imagesList.0": { $exists: true } },
      ],
    });
  }

  if (query.hasPrice === true) {
    andFilters.push({
      $and: [
        { $or: [{ hasPrice: true }, { hasPrice: "true" }] },
        {
          $or: [
            { priceNumeric: { $exists: true, $gt: 0 } },
            { "item.price.numeric": { $exists: true, $gt: 0 } },
            { "item.price.formattedPrice": { $exists: true, $ne: "" } },
          ],
        },
      ],
    });
  }

  if (query.hasComments === true) {
    andFilters.push({
      $or: [
        { "comments.0": { $exists: true } },
        { "gql.comments.json.data.comments.items.0": { $exists: true } },
      ],
    });
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    const range: { $gte?: number; $lte?: number } = {};
    if (query.minPrice !== undefined) range.$gte = query.minPrice;
    if (query.maxPrice !== undefined) range.$lte = query.maxPrice;
    andFilters.push({
      $or: [{ priceNumeric: range }, { "item.price.numeric": range }],
    });
  }

  if (query.dateFrom || query.dateTo) {
    const range: { $gte?: number; $lte?: number } = {};
    if (query.dateFrom) {
      const start = new Date(query.dateFrom);
      if (!Number.isNaN(start.getTime())) {
        range.$gte = Math.floor(start.getTime() / 1000);
      }
    }
    if (query.dateTo) {
      const end = new Date(query.dateTo);
      if (!Number.isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        range.$lte = Math.floor(end.getTime() / 1000);
      }
    }
    if (Object.keys(range).length > 0) {
      andFilters.push({
        $or: [{ postDate: range }, { "item.postDate": range }],
      });
    }
  }

  if (query.tag0) {
    andFilters.push({
      $or: [{ "tags.0": query.tag0 }, { "item.tags.0": query.tag0 }],
    });
  }

  if (query.tag1) {
    const tagRegexes = buildAliasRegexes(query.tag1);
    andFilters.push({
      $or: [{ "tags.1": { $in: tagRegexes } }, { "item.tags.1": { $in: tagRegexes } }],
    });
  }

  if (query.tag2) {
    const tagRegexes = buildAliasRegexes(query.tag2);
    andFilters.push({
      $or: [{ "tags.2": { $in: tagRegexes } }, { "item.tags.2": { $in: tagRegexes } }],
    });
  }

  const excludeTag1Values = normalizeList(query.excludeTag1);
  if (excludeTag1Values.length > 0) {
    andFilters.push({
      $nor: [
        { "tags.1": { $in: excludeTag1Values } },
        { "item.tags.1": { $in: excludeTag1Values } },
        { "gql.posts.json.data.posts.items.tags.1": { $in: excludeTag1Values } },
      ],
    });
  }

  if (query.carModelYear !== undefined) {
    const yearValues = [query.carModelYear, String(query.carModelYear)];
    andFilters.push({
      $or: [
        { "item.carInfo.model": { $in: yearValues } },
        { "carInfo.model": { $in: yearValues } },
        { "gql.posts.json.data.posts.items.0.carInfo.model": { $in: yearValues } },
        { "gql.posts.json.data.posts.items.carInfo.model": { $in: yearValues } },
      ],
    });
  }

  if (
    query.mileage !== undefined ||
    query.mileageMin !== undefined ||
    query.mileageMax !== undefined
  ) {
    const mileageExpression = buildCoalescedMileageExpression([
      "$item.carInfo.mileage",
      "$carInfo.mileage",
      "$gql.posts.json.data.posts.items.0.carInfo.mileage",
      "$gql.posts.json.data.posts.items.carInfo.mileage",
    ]);
    const mileageConditions: Document[] = [{ $ne: [mileageExpression, null] }];

    if (query.mileage !== undefined) {
      mileageConditions.push({ $eq: [mileageExpression, query.mileage] });
    }
    if (query.mileageMin !== undefined) {
      mileageConditions.push({ $gte: [mileageExpression, query.mileageMin] });
    }
    if (query.mileageMax !== undefined) {
      mileageConditions.push({ $lte: [mileageExpression, query.mileageMax] });
    }

    andFilters.push({
      $expr:
        mileageConditions.length === 1
          ? mileageConditions[0]
          : { $and: mileageConditions },
    });
  }

  if (andFilters.length > 0) {
    filter.$and = andFilters;
  }

  return filter;
}

function buildSort(sort?: string): Sort {
  switch (sort) {
    case "oldest":
      return { postDate: 1, "item.postDate": 1 };
    case "price-high":
      return { priceNumeric: -1, "item.price.numeric": -1 };
    case "price-low":
      return { priceNumeric: 1, "item.price.numeric": 1 };
    case "comments":
      return { commentsCount: -1, "item.commentCount": -1 };
    default:
      return { postDate: -1, "item.postDate": -1 };
  }
}

export async function listHarajScrapes(
  query: HarajScrapeListQuery,
  options: ListOptions = {}
) {
  const db = await getMongoDb();
  const collection = getHarajScrapeCollection(db);

  const maxLimit = options.maxLimit ?? MAX_LIMIT;
  const limit = Math.min(query.limit ?? DEFAULT_LIMIT, maxLimit);
  const page = Math.max(query.page ?? 1, 1);
  const filter = buildFilter(query);
  const sort = buildSort(query.sort);

  const [items, total] = await Promise.all([
    collection
      .find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .project(
        query.fields === "options"
          ? {
              _id: 1,
              postId: 1,
              postDate: 1,
              tags: 1,
              "item.postDate": 1,
              "item.tags": 1,
              "item.carInfo.model": 1,
              "item.carInfo.mileage": 1,
              "carInfo.model": 1,
              "carInfo.mileage": 1,
              "gql.posts.json.data.posts.items.carInfo.model": 1,
              "gql.posts.json.data.posts.items.carInfo.mileage": 1,
            }
          : {
              _id: 1,
              postId: 1,
              title: 1,
              city: 1,
              priceNumeric: 1,
              postDate: 1,
              url: 1,
              phone: 1,
              tags: 1,
              commentsCount: 1,
              hasImage: 1,
              hasVideo: 1,
              imagesList: 1,
              "item.title": 1,
              "item.postDate": 1,
              "item.city": 1,
              "item.geoCity": 1,
              "item.tags": 1,
              "item.hasImage": 1,
              "item.hasVideo": 1,
              "item.commentCount": 1,
              "item.price": 1,
              "item.URL": 1,
              "item.imagesList": 1,
              "item.carInfo.model": 1,
              "item.carInfo.mileage": 1,
              "carInfo.model": 1,
              "carInfo.mileage": 1,
              "gql.posts.json.data.posts.items.carInfo.model": 1,
              "gql.posts.json.data.posts.items.carInfo.mileage": 1,
            }
      )
      .toArray(),
    collection.countDocuments(filter),
  ]);

  const normalized = items.map((doc) => {
    const priceNumeric = doc.priceNumeric ?? doc.item?.price?.numeric ?? null;
    const imageCount =
      doc.item?.imagesList?.length ??
      doc.imagesList?.length ??
      0;
    const hasImages = imageCount > 0;
    const carModelYear =
      doc.item?.carInfo?.model ??
      (doc as any)?.carInfo?.model ??
      (doc as any)?.gql?.posts?.json?.data?.posts?.items?.[0]?.carInfo?.model ??
      null;
    const mileage =
      toMileageNumber(doc.item?.carInfo?.mileage) ??
      toMileageNumber((doc as any)?.carInfo?.mileage) ??
      toMileageNumber((doc as any)?.gql?.posts?.json?.data?.posts?.items?.[0]?.carInfo?.mileage) ??
      null;
    const commentsCount = doc.commentsCount ?? doc.item?.commentCount ?? 0;
    const postDate =
      toEpochNumber(doc.item?.postDate) ??
      toEpochNumber(doc.postDate) ??
      null;
    if (query.fields === "options") {
      return {
        id: doc.postId ?? doc._id,
        title: "Untitled",
        city: "",
        postDate,
        priceNumeric: null,
        priceFormatted: null,
        hasImage: false,
        imagesCount: 0,
        hasVideo: false,
        commentsCount: 0,
        tags: doc.tags ?? doc.item?.tags ?? [],
        carModelYear,
        mileage,
        phone: "",
        url: "",
        source: "haraj",
      };
    }
    return {
      id: doc.postId ?? doc._id,
      title: doc.title ?? doc.item?.title ?? "Untitled",
      city: doc.city ?? doc.item?.city ?? doc.item?.geoCity ?? "",
      postDate,
      priceNumeric,
      priceFormatted: doc.item?.price?.formattedPrice ?? (priceNumeric ? priceNumeric.toLocaleString("en-US") : null),
      hasImage: hasImages,
      imagesCount: imageCount,
      hasVideo: doc.item?.hasVideo ?? doc.hasVideo ?? false,
      commentsCount,
      tags: doc.tags ?? doc.item?.tags ?? [],
      carModelYear,
      mileage,
      phone: doc.phone ?? "",
      url: doc.url ?? (doc.item?.URL ? `https://haraj.com.sa/${doc.item.URL}` : ""),
      source: "haraj",
    };
  });

  return {
    items: normalized,
    total,
    page,
    limit,
  };
}

export async function getHarajScrapeById(id: string) {
  const db = await getMongoDb();
  const collection = getHarajScrapeCollection(db);

  const numericId = Number(id);
  const filter: Filter<HarajScrapeDoc> = {
    $or: [
      { _id: id },
      { postId: id },
      Number.isNaN(numericId) ? undefined : { "item.id": numericId },
      { "item.URL": id },
    ].filter(Boolean) as Filter<HarajScrapeDoc>[],
  };

  const doc = await collection.findOne(filter);
  return doc;
}
