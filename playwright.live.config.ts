import { defineConfig, devices } from "@playwright/test";

if (!process.env.HYOPS_TEST_DATABASE_URL) throw new Error("Use backend/scripts/test-database.ps1 -Suite Live.");
export default defineConfig({
  testDir: "./live-tests", workers: 1, timeout: 60_000,
  reporter: [["list"], ["json", { outputFile: "test-results/live-results.json" }]],
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium-live", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.HYOPS_LIVE_SERVER_STARTED === "1" ? undefined : { command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3100", url: "http://127.0.0.1:3100", timeout: 120_000, reuseExistingServer: false,
    env: { API_URL: "http://127.0.0.1:5180", NEXT_PUBLIC_API_URL: "http://127.0.0.1:5180", NEXT_PUBLIC_WS_URL: "ws://127.0.0.1:5180/ws" } },
});
