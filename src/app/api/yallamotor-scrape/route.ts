import { NextResponse, type NextRequest } from "next/server";
import { listYallaMotorsRoute } from "@/server/routes/yallaMotorRoutes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    return await listYallaMotorsRoute(request);
  } catch (error) {
    console.error("yallamotor list error", error);
    return NextResponse.json(
      { error: "Service unavailable. Check MongoDB environment variables." },
      { status: 500 }
    );
  }
}
