import type { NextRequest } from "next/server";
import { proxyMvPathToNest } from "@/lib/mv-nest-proxy";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ pid: string; fid: string }> };

export async function DELETE(request: NextRequest, context: Ctx) {
  const { pid, fid } = await context.params;
  return proxyMvPathToNest(request, ["projects", pid, "valuation-excel-files", fid]);
}

