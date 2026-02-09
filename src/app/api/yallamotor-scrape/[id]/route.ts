import { NextResponse, type NextRequest } from "next/server";
import { getYallaMotorByIdRoute } from "@/server/routes/yallaMotorRoutes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    return await getYallaMotorByIdRoute(request, id);
  } catch (error) {
    console.error("yallamotor detail error", error);
    return NextResponse.json(
      { error: "Service unavailable. Check MongoDB environment variables." },
      { status: 500 }
    );
  }
}
