import type { Filter, Sort } from "mongodb";
import { getMongoDb } from "../mongodb";
import { getHarajScrapeCollection, type HarajScrapeDoc } from "../models/harajScrape";

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
  excludeTag1?: string;
};

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

type ListOptions = {
  maxLimit?: number;
};

function toRegex(value: string) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
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
            { priceNumeric: { $exists: true, $ne: null, $gt: 0 } },
            { "item.price.numeric": { $exists: true, $ne: null, $gt: 0 } },
            { "item.price.formattedPrice": { $exists: true, $nin: ["", null] } },
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
    const tagRegex = toRegex(query.tag1);
    andFilters.push({
      $or: [{ "tags.1": tagRegex }, { "item.tags.1": tagRegex }],
    });
  }

  if (query.tag2) {
    const tagRegex = toRegex(query.tag2);
    andFilters.push({
      $or: [{ "tags.2": tagRegex }, { "item.tags.2": tagRegex }],
    });
  }

  if (query.excludeTag1) {
    andFilters.push({
      $nor: [
        { "tags.1": query.excludeTag1 },
        { "item.tags.1": query.excludeTag1 },
        { "gql.posts.json.data.posts.items.tags.1": query.excludeTag1 },
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
      .project({
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
        "carInfo.model": 1,
        "gql.posts.json.data.posts.items.carInfo.model": 1,
      })
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
    return {
      id: doc.postId ?? doc._id,
      title: doc.title ?? doc.item?.title ?? "Untitled",
      city: doc.city ?? doc.item?.city ?? doc.item?.geoCity ?? "",
      postDate: doc.postDate ?? doc.item?.postDate ?? null,
      priceNumeric,
      priceFormatted: doc.item?.price?.formattedPrice ?? (priceNumeric ? priceNumeric.toLocaleString("en-US") : null),
      hasImage: hasImages,
      imagesCount: imageCount,
      hasVideo: doc.item?.hasVideo ?? doc.hasVideo ?? false,
      commentsCount: doc.commentsCount ?? doc.item?.commentCount ?? 0,
      tags: doc.tags ?? doc.item?.tags ?? [],
      carModelYear,
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
