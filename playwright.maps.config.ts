import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./map-tests", workers: 1, timeout: 30000,
  outputDir: "test-results/google-maps", reporter: "list",
  use: { ...devices["Desktop Chrome"], trace: "retain-on-failure" },
});
