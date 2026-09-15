import { defineConfig } from "@playwright/test";
import path from "node:path";

export default defineConfig({
  testDir: "./tests/support-browser", timeout: 180_000, expect: { timeout: 30_000 }, workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", headless: true, viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  outputDir: "test-results/support", reporter: "list",
  webServer: [
    // The support API itself is authenticated; Socket.IO's handshake is the
    // unauthenticated readiness probe and returns 200 only once Nest is up.
    { command: "node tests/support-fixture.cjs", cwd: "../SparkVision-Backend", url: "http://127.0.0.1:5011/api/realtime/socket.io/?EIO=4&transport=polling", timeout: 240_000, reuseExistingServer: false, env: { SUPPORT_TEST_SESSION_FILE: path.resolve(".support-test-sessions.json") } },
    { command: "node node_modules/next/dist/bin/next dev -p 3100", url: "http://127.0.0.1:3100", timeout: 240_000, reuseExistingServer: false, env: { BACKEND_URL: "http://127.0.0.1:5011", NEXT_PUBLIC_API_BASE_URL: "http://127.0.0.1:5011", NEXT_PUBLIC_SV_BEHAVIOR_TRACKING: "0" } },
  ],
});
