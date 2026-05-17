import type { NextRequest } from "next/server";
import { proxyMvPathToNest } from "@/lib/mv-nest-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ pid: string }> }) {
  const { pid } = await context.params;
  return proxyMvPathToNest(request, ["projects", pid, "events"]);
}
