import { NextResponse, type NextRequest } from "next/server";
import { listHarajScrapesRoute } from "@/server/routes/harajScrapeRoutes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    return await listHarajScrapesRoute(request);
  } catch (error) {
    console.error("haraj-scrape list error", error);
    return NextResponse.json(
      { error: "Service unavailable. Check MongoDB environment variables." },
      { status: 500 }
    );
  }
}
