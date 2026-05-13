import type { NextRequest } from "next/server";
import { proxyMvPathToNest } from "@/lib/mv-nest-proxy";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ pid: string; fid: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  const { pid, fid } = await context.params;
  return proxyMvPathToNest(request, ["projects", pid, "valuation-excel-files", fid, "download"]);
}

export async function HEAD(request: NextRequest, context: Ctx) {
  const { pid, fid } = await context.params;
  return proxyMvPathToNest(request, ["projects", pid, "valuation-excel-files", fid, "download"]);
}

