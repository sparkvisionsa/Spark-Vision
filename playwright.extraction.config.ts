import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/extraction-browser", timeout: 180_000, expect: { timeout: 30_000 }, workers: 1,
  use: { baseURL: "http://localhost:3000", headless: true, viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure" },
  outputDir: "test-results/extraction", reporter: "list",
  webServer: { command: "node node_modules/next/dist/bin/next dev -p 3000", url: "http://localhost:3000", reuseExistingServer: true, timeout: 180_000 },
});
