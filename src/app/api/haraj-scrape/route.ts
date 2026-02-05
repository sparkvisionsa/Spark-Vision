import type { NextRequest } from "next/server";
import { listHarajScrapesRoute } from "@/server/routes/harajScrapeRoutes";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return listHarajScrapesRoute(request);
}
