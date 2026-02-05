import { NextRequest, NextResponse } from "next/server";
import { getHarajScrapeById, listHarajScrapes, type HarajScrapeListQuery } from "../controllers/harajScrapeController";

function parseNumber(value: string | null) {
  if (!value) return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
}

function parseBoolean(value: string | null) {
  if (!value) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function listHarajScrapesRoute(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const query: HarajScrapeListQuery = {
    search: searchParams.get("search") ?? undefined,
    city: searchParams.get("city") ?? undefined,
    minPrice: parseNumber(searchParams.get("minPrice")),
    maxPrice: parseNumber(searchParams.get("maxPrice")),
    hasImage: parseBoolean(searchParams.get("hasImage")),
    hasPrice: parseBoolean(searchParams.get("hasPrice")),
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    page: parseNumber(searchParams.get("page")),
    limit: parseNumber(searchParams.get("limit")),
  };

  const data = await listHarajScrapes(query);
  return NextResponse.json(data);
}

export async function getHarajScrapeByIdRoute(_request: NextRequest, id: string) {
  const doc = await getHarajScrapeById(id);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(doc);
}
