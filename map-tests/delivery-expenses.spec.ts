import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { mockGoogleMaps } from "../live-tests/google-maps";

test.beforeAll(async () => {
  const require = createRequire(path.join(process.cwd(), "package.json"));
  const { webpack } = require("next/dist/compiled/webpack/webpack");
  await new Promise<void>((resolve, reject) => {
    webpack({
      mode: "development", entry: path.resolve("map-tests/delivery-expenses-harness.tsx"),
      output: { path: path.resolve("test-results/delivery-expenses-bundle"), filename: "harness.js" },
      resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": process.cwd() } },
      module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.resolve("map-tests/typescript-loader.cjs") }] },
      plugins: [new webpack.DefinePlugin({
        "process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY": JSON.stringify("fixture-key"),
        "process.env.NEXT_PUBLIC_GOOGLE_MAP_ID": JSON.stringify(""),
      })],
    }, (error: Error | null, stats: { hasErrors(): boolean; toString(): string }) => {
      if (error) reject(error);
      else if (stats.hasErrors()) reject(new Error(stats.toString()));
      else resolve();
    });
  });
});

test.beforeEach(async ({ page }) => {
  await page.route("https://hyops.test/**", route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/harness.js") return route.fulfill({ contentType: "application/javascript", body: readFileSync("test-results/delivery-expenses-bundle/harness.js") });
    if (pathname === "/api/delivery-estimates/config") return route.fulfill({ json: { fuelConsumptionKmPerLiter: 6, fuelPricePerLiter: 65 } });
    if (pathname === "/api/delivery-estimates") {
      const request = route.request().postDataJSON();
      const fuelLiters = 100 / request.fuelConsumptionKmPerLiter;
      const fuelCost = fuelLiters * request.fuelPricePerLiter;
      const toll = request.tollFeeOverride ?? null;
      return route.fulfill({ json: {
        route: { source: "Google Routes", distanceKm: 100, durationMinutes: 120, legCount: 2,
          geometry: { type: "LineString", coordinates: [[120.906, 14.815], [120.98, 14.85]] } },
        tollDetection: { status: "DETECTED", hasToll: true, source: "Google Routes", note: "Verify the toll class for delivery trucks." },
        expenses: { driverAllowance: 600, estimatedFuelLiters: fuelLiters, estimatedFuelCost: fuelCost,
          estimatedTollFee: toll, estimatedTotal: toll === null ? null : 600 + fuelCost + toll,
          estimatedTotalExcludingUnknownToll: 600 + fuelCost },
      } });
    }
    return route.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><style>.relative{position:relative}.absolute{position:absolute}.inset-0{inset:0}.h-full{height:100%}.w-full{width:100%}.h-72{height:288px}</style></head><body><div id="root"></div><script src="/harness.js"></script></body></html>' });
  });
  await mockGoogleMaps(page);
  await page.goto("https://hyops.test/");
});

test("uses editable fuel settings, reports unknown toll, renders Google route, and accepts manual toll", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await expect(page.getByLabel("Vehicle efficiency (km/L)")).toHaveValue("6");
  await page.getByLabel("Vehicle efficiency (km/L)").fill("10");
  await page.getByLabel("Fuel price (PHP/L)").fill("60");
  const pending = page.waitForRequest("**/api/delivery-estimates");
  await page.getByRole("button", { name: "Calculate Expenses", exact: true }).click();
  const request = (await pending).postDataJSON();
  expect(request.isRoundTrip).toBe(true);
  expect(request.points[0]).toEqual({ latitude: 14.815, longitude: 120.906 });
  expect(request.fuelConsumptionKmPerLiter).toBe(10);
  expect(request.fuelPricePerLiter).toBe(60);
  await expect(page.getByText("Subtotal excludes the unknown toll fee.")).toBeVisible();
  await expect(page.locator(".gm-style")).toHaveCount(1);
  await page.getByLabel("Manual toll for entire trip (PHP, optional)").fill("150.50");
  await page.getByRole("button", { name: "Calculate Expenses", exact: true }).click();
  await expect(page.getByText("Subtotal excludes the unknown toll fee.")).toHaveCount(0);
  await expect(page.getByText(/1,350.50/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("rejects missing fuel efficiency before sending an estimate request", async ({ page }) => {
  await expect(page.getByLabel("Vehicle efficiency (km/L)")).toHaveValue("6");
  await page.getByLabel("Vehicle efficiency (km/L)").fill("");
  let requests = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/delivery-estimates") requests++; });
  await page.getByRole("button", { name: "Calculate Expenses", exact: true }).click();
  await expect(page.getByText("Enter fuel efficiency greater than zero.")).toBeVisible();
  expect(requests).toBe(0);
});

test("shows backend configuration errors and can retry", async ({ page }) => {
  await page.route("**/api/delivery-estimates", route => route.fulfill({ status: 422, json: { message: "Set GOOGLE_ROUTES_API_KEY on the backend." } }));
  await page.getByRole("button", { name: "Calculate Expenses", exact: true }).click();
  await expect(page.getByText("Set GOOGLE_ROUTES_API_KEY on the backend.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Calculate Expenses", exact: true })).toBeEnabled();
});

