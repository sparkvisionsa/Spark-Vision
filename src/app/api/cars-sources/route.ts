import { NextResponse, type NextRequest } from "next/server";
import { listCarsSourcesRoute } from "@/server/routes/carsSourceRoutes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    return await listCarsSourcesRoute(request);
  } catch (error) {
    console.error("cars-sources list error", error);
    return NextResponse.json(
      { error: "Service unavailable. Check MongoDB environment variables." },
      { status: 500 }
    );
  }
}
