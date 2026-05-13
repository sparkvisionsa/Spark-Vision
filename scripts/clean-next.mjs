import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

const DEV_LOCK_PATH = resolve(process.cwd(), ".frontend-dev.lock");

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function activeDevPidFromLock() {
  try {
    const raw = await readFile(DEV_LOCK_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const pid = Number(parsed?.pid);
    return isProcessAlive(pid) ? pid : null;
  } catch {
    return null;
  }
}

async function main() {
  const activeDevPid = await activeDevPidFromLock();
  if (activeDevPid) {
    console.log(
      `[frontend] skipping .next cleanup (dev server is running, PID ${activeDevPid})`,
    );
    return;
  }

  console.log("[frontend] cleaning .next cache");
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
