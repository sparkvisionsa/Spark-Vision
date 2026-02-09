import type { Collection, Db } from "mongodb";

export interface YallaMotorDoc {
  _id: unknown;
  cardPriceText?: string;
  cardTitle?: string;
  fetchedAt?: Date;
  lastSeenAt?: Date;
  listPageUrl?: string;
  pageNo?: number;
  sectionLabel?: string;
  source?: string;
  type?: string;
  url?: string;
  detail?: {
    url?: string;
    breadcrumb?: string[];
    overview?: {
      h1?: string;
      h4?: string;
    };
    priceBox?: Record<string, unknown> | null;
    images?: string[];
    importantSpecs?: Record<string, string> | null;
    features?: string[] | null;
    description?: string;
    priceCompare?: {
      min?: string | number | null;
      max?: string | number | null;
      current?: string | number | null;
      [key: string]: unknown;
    } | null;
  };
  detailScrapedAt?: Date;
}

export function getYallaMotorCollection(db: Db): Collection<YallaMotorDoc> {
  return db.collection<YallaMotorDoc>("yallamotortest");
}
