import { NextResponse, type NextRequest } from "next/server";
import { getHarajScrapeByIdRoute } from "@/server/routes/harajScrapeRoutes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    return await getHarajScrapeByIdRoute(request, id);
  } catch (error) {
    console.error("haraj-scrape detail error", error);
    return NextResponse.json(
      { error: "Service unavailable. Check MongoDB environment variables." },
      { status: 500 }
    );
  }
}
