import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./browser-tests",
  workers: 1,
  timeout: 45_000,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "bun browser-tests/mock-server.ts", url: "http://127.0.0.1:5179/health", reuseExistingServer: false },
    { command: "bun run dev --hostname 127.0.0.1 --port 3100", url: "http://127.0.0.1:3100", timeout: 120_000, reuseExistingServer: false,
      env: { API_URL: "http://127.0.0.1:5179", NEXT_PUBLIC_API_URL: "http://127.0.0.1:5179", NEXT_PUBLIC_WS_URL: "ws://127.0.0.1:5179/ws" } },
  ],
});
