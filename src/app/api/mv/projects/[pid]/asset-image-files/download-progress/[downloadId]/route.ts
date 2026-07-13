import type { NextRequest } from "next/server";
import { proxyMvPathToNest } from "@/lib/mv-nest-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ pid: string; downloadId: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const { pid, downloadId } = await context.params;
  return proxyMvPathToNest(request, [
    "projects",
    pid,
    "asset-image-files",
    "download-progress",
    downloadId,
  ]);
}
