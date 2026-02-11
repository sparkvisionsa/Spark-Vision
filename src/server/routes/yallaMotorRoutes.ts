import { NextRequest, NextResponse } from "next/server";
import { getYallaMotorById, listYallaMotors, type YallaMotorListQuery } from "../controllers/yallaMotorController";

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

export async function listYallaMotorsRoute(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const query: YallaMotorListQuery = {
    search: searchParams.get("search") ?? undefined,
    city: searchParams.get("city") ?? undefined,
    minPrice: parseNumber(searchParams.get("minPrice")),
    maxPrice: parseNumber(searchParams.get("maxPrice")),
    hasImage: parseBoolean(searchParams.get("hasImage")),
    hasPrice: parseBoolean(searchParams.get("hasPrice")),
    hasComments: parseBoolean(searchParams.get("hasComments")),
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    page: parseNumber(searchParams.get("page")),
    limit: parseNumber(searchParams.get("limit")),
    tag0: searchParams.get("tag0") ?? undefined,
    tag1: searchParams.get("tag1") ?? undefined,
    tag2: searchParams.get("tag2") ?? undefined,
    carModelYear: parseNumber(searchParams.get("carModelYear")),
    mileage: parseNumber(searchParams.get("mileage")),
    mileageMin: parseNumber(searchParams.get("mileageMin")),
    mileageMax: parseNumber(searchParams.get("mileageMax")),
    excludeTag1: searchParams.get("excludeTag1") ?? undefined,
    fields:
      searchParams.get("fields") === "options"
        ? "options"
        : undefined,
  };

  const data = await listYallaMotors(query);
  return NextResponse.json(data);
}

export async function getYallaMotorByIdRoute(_request: NextRequest, id: string) {
  const doc = await getYallaMotorById(id);

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(doc);
}
