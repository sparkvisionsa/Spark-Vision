import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import net from "node:net";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const DEV_LOCK_PATH = resolve(process.cwd(), ".frontend-dev.lock");

function shouldUseTurboPack() {
  const selectedBundler = (process.env.FRONTEND_DEV_BUNDLER ?? "")
    .trim()
    .toLowerCase();

  if (selectedBundler === "webpack") return false;
  if (selectedBundler === "turbopack") return true;
  return false;
}

function shouldWarmRoutes() {
  const value = (process.env.FRONTEND_DEV_WARM_ROUTES ?? "true")
    .trim()
    .toLowerCase();
  return value !== "0" && value !== "false" && value !== "no";
}

function parseWarmRoutes() {
  const raw = (process.env.FRONTEND_DEV_WARM_LIST ?? "/admin,/evaluation-source/cars")
    .trim();
  if (!raw) return [];
  const routes = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.startsWith("/") ? item : `/${item}`));
  return Array.from(new Set(routes));
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilReady(origin, timeoutMs = 45_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${origin}/`, {
        cache: "no-store",
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // server not ready yet
    }
    await sleep(600);
  }
  return false;
}

async function warmRoute(origin, route) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${origin}${route}`, {
      cache: "no-store",
      headers: {
        "x-sv-dev-warmup": "1",
      },
    });
    const elapsedMs = Date.now() - startedAt;
    if (!response.ok) {
      console.warn(
        `[frontend] warmup ${route} responded with ${response.status} in ${elapsedMs}ms`
      );
      return;
    }
    console.log(`[frontend] warmed ${route} in ${elapsedMs}ms`);
  } catch {
    // warmup is best-effort only
  }
}

async function warmRoutes(port) {
  if (!shouldWarmRoutes()) {
    return;
  }

  const routes = parseWarmRoutes();
  if (!routes.length) {
    return;
  }

  const origin = `http://127.0.0.1:${port}`;
  const ready = await waitUntilReady(origin);
  if (!ready) {
    console.warn("[frontend] skipped route warmup: dev server readiness timeout");
    return;
  }

  console.log(`[frontend] warming routes: ${routes.join(", ")}`);
  const startedAt = Date.now();
  await Promise.allSettled(routes.map((route) => warmRoute(origin, route)));
  console.log(`[frontend] route warmup finished in ${Date.now() - startedAt}ms`);
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readLock() {
  try {
    const raw = await readFile(DEV_LOCK_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function tryCreateLock() {
  await mkdir(process.cwd(), { recursive: true });
  const payload = JSON.stringify({
    pid: process.pid,
    startedAt: Date.now(),
  });
  try {
    await writeFile(DEV_LOCK_PATH, payload, { flag: "wx" });
    return true;
  } catch (error) {
    const errorCode = error && typeof error === "object" && "code" in error ? error.code : null;
    if (errorCode === "EEXIST") return false;
    throw error;
  }
}

async function acquireDevLock() {
  if (await tryCreateLock()) return;

  const lock = await readLock();
  const lockPid = Number(lock?.pid);
  if (isProcessAlive(lockPid)) {
    throw new Error(
      `[frontend] Another frontend dev server is already running (PID ${lockPid}). Stop it before starting a new one.`
    );
  }

  await rm(DEV_LOCK_PATH, { force: true });
  if (!(await tryCreateLock())) {
    throw new Error("[frontend] Could not acquire dev lock. Try again.");
  }
}

async function releaseDevLock() {
  try {
    await rm(DEV_LOCK_PATH, { force: true });
  } catch {
    // lock cleanup is best-effort only
  }
}

function canListen(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    if (host) {
      server.listen(port, host);
      return;
    }
    server.listen(port);
  });
}

async function isPortFree(port) {
  const ipv6Free = await canListen(port);
  if (!ipv6Free) return false;
  return canListen(port, "0.0.0.0");
}

async function pickPort() {
  const requestedPort = Number(process.env.PORT);
  const candidates = [];

  if (
    Number.isInteger(requestedPort) &&
    requestedPort > 0 &&
    requestedPort < 65_536
  ) {
    candidates.push(requestedPort);
  }

  for (const port of [3000, 3001, 3002]) {
    if (!candidates.includes(port)) {
      candidates.push(port);
    }
  }

  for (const port of candidates) {
    if (await isPortFree(port)) {
      return port;
    }
  }

  return candidates[candidates.length - 1];
}

async function main() {
  await acquireDevLock();

  let lockReleased = false;
  const safeReleaseLock = async () => {
    if (lockReleased) return;
    lockReleased = true;
    await releaseDevLock();
  };

  const port = await pickPort();
  const nextBin = require.resolve("next/dist/bin/next");
  const useTurboPack = shouldUseTurboPack();
  const args = [nextBin, "dev", "-p", String(port)];
  if (useTurboPack) {
    args.push("--turbopack");
  }

  console.log(
    `[frontend] next dev on port ${port}${useTurboPack ? " (turbopack)" : " (webpack)"}`
  );

  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
  });

  void warmRoutes(port);

  child.on("exit", (code, signal) => {
    void safeReleaseLock();
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  const forwardAndExit = (signal) => {
    try {
      child.kill(signal);
    } catch {
      // child might already be gone
    }
    void safeReleaseLock().finally(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", () => forwardAndExit("SIGINT"));
  process.on("SIGTERM", () => forwardAndExit("SIGTERM"));
  process.on("exit", () => {
    void safeReleaseLock();
  });
}

main().catch((error) => {
  void releaseDevLock();
  console.error("[frontend] Failed to start dev server", error);
  process.exit(1);
});
