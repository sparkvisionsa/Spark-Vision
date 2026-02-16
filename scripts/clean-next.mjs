import { rm } from "node:fs/promises";
import { resolve } from "node:path";

function shouldCleanCaches() {
  const value = (process.env.FRONTEND_FORCE_CLEAN ?? "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

async function main() {
  if (!shouldCleanCaches()) {
    return;
  }

  console.log("[frontend] cleaning .next cache (FRONTEND_FORCE_CLEAN enabled)");
  const nextDir = resolve(process.cwd(), ".next");
  const tsBuildInfo = resolve(process.cwd(), "tsconfig.tsbuildinfo");
  try {
    await rm(nextDir, { recursive: true, force: true });
  } catch {
    // No-op: dev server can continue even if cleanup fails.
  }
  try {
    await rm(tsBuildInfo, { force: true });
  } catch {
    // No-op: dev server can continue even if cleanup fails.
  }
}

await main();
