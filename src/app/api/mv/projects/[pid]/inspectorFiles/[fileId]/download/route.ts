import type { NextRequest } from "next/server";
import { proxyMvPathToNest } from "@/lib/mv-nest-proxy";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ pid: string; fileId: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const { pid, fileId } = await context.params;
  return proxyMvPathToNest(request, ["projects", pid, "inspectorFiles", fileId, "download"]);
}

export async function HEAD(request: NextRequest, context: Ctx) {
  const { pid, fileId } = await context.params;
  return proxyMvPathToNest(request, ["projects", pid, "inspectorFiles", fileId, "download"]);
}
