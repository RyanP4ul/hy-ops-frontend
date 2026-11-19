import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { AxeResults } from "axe-core";
import { mockGoogleMaps } from "../live-tests/google-maps";

test.beforeAll(async () => {
  const require = createRequire(path.join(process.cwd(), "package.json"));
  const { webpack } = require("next/dist/compiled/webpack/webpack");
  await new Promise<void>((resolve, reject) => {
    webpack(
      {
        mode: "development",
        entry: path.resolve("map-tests/schedule-expenses-harness.tsx"),
        output: {
          path: path.resolve("test-results/schedule-expenses-bundle"),
          filename: "harness.js",
        },
        resolve: { extensions: [".tsx", ".ts", ".js"], alias: { "@": process.cwd() } },
        module: {
          rules: [
            {
              test: /\.tsx?$/,
              exclude: /node_modules/,
              use: path.resolve("map-tests/typescript-loader.cjs"),
            },
          ],
        },
        plugins: [
          new webpack.DefinePlugin({
            "process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY": JSON.stringify("fixture-key"),
            "process.env.NEXT_PUBLIC_GOOGLE_MAP_ID": JSON.stringify(""),
            "process.env.NODE_ENV": JSON.stringify("development"),
          }),
        ],
      },
      (error: Error | null, stats: { hasErrors(): boolean; toString(): string }) => {
        if (error) reject(error);
        else if (stats.hasErrors()) reject(new Error(stats.toString()));
        else resolve();
      },
    );
  });
});

test("renders clean map at top, hides store names/icons, calculates and updates expenses cleanly", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => { console.error("PAGEERROR:", error.message); errors.push(error.message); });

  await page.route("https://hyops.test/**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/harness.js") {
      return route.fulfill({
        contentType: "application/javascript; charset=utf-8",
        body: readFileSync("test-results/schedule-expenses-bundle/harness.js"),
      });
    }
    if (pathname === "/api/delivery-estimates/config") {
      return route.fulfill({ json: { fuelConsumptionKmPerLiter: 6, fuelPricePerLiter: 65 } });
    }
    if (pathname === "/api/delivery-estimates") {
      const req = route.request().postDataJSON();
      const fuelLiters = 42.6 / req.fuelConsumptionKmPerLiter;
      const fuelCost = fuelLiters * req.fuelPricePerLiter;
      return route.fulfill({
        json: {
          route: {
            source: "Google Routes",
            distanceKm: 42.6,
            durationMinutes: 75,
            inputPointCount: 3,
            routeWaypointCount: 3,
            legCount: 2,
            isRoundTrip: req.isRoundTrip,
            geometry: {
              type: "LineString",
              coordinates: [
                [120.906, 14.815],
                [121.0437, 14.676],
                [121.0244, 14.5547],
              ],
            },
          },
          tollDetection: {
            status: "DETECTED",
            hasToll: true,
            source: "Google Routes",
            note: "Verify toll class",
          },
          expenses: {
            driverAllowance: 600,
            estimatedFuelLiters: fuelLiters,
            estimatedFuelCost: fuelCost,
            hasToll: true,
            estimatedTollFee: null,
            estimatedTotal: null,
            estimatedTotalExcludingUnknownToll: 600 + fuelCost,
            tollFeeStatus: "UNKNOWN",
            fuelConsumptionKmPerLiter: req.fuelConsumptionKmPerLiter,
            fuelPricePerLiter: req.fuelPricePerLiter,
          },
        },
      });
    }
    return route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html lang="en"><head><style>
        .relative{position:relative}.absolute{position:absolute}.inset-0{inset:0}.h-full{height:100%}.w-full{width:100%}.h-52{height:208px}
        .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
      </style></head><body><div id="root"></div><script src="/harness.js"></script></body></html>`,
    });
  });

  await mockGoogleMaps(page);
  await page.goto("https://hyops.test/");

  // Map renders immediately at the top before clicking Calculate
  const mapRegion = page.getByRole("region", { name: "Estimated delivery route" });
  await expect(mapRegion).toBeVisible();
  await expect(page.locator(".gm-style")).toHaveCount(1);
  await expect(page.getByLabel("Warehouse: Main Warehouse")).toBeVisible();
  await expect(page.getByLabel("Stop 1: ORD-101")).toBeVisible();
  await expect(page.getByLabel("Stop 2: ORD-102")).toBeVisible();

  // Map sits above the Allowance input
  const mapBox = await mapRegion.boundingBox();
  const allowanceBox = await page.getByLabel(/Allowance/).boundingBox();
  expect(mapBox!.y + mapBox!.height).toBeLessThan(allowanceBox!.y);

  // Clean map styles hide store names (poi, poi.business) and map icons (labels.icon)
  const mapOptions = await page.evaluate(
    () =>
      Reflect.get(window, "__googleMapsFixtureOptions") as {
        renderingType: string;
        styles?: { featureType?: string; elementType?: string; stylers?: { visibility?: string }[] }[];
      }[],
  );
  expect(mapOptions[0]?.renderingType).toBe("RASTER");
  expect(mapOptions[0]?.styles).toEqual(
    expect.arrayContaining([
      { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
      { featureType: "poi.business", stylers: [{ visibility: "off" }] },
      { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    ]),
  );

  // Compact fuel rates toggle expands and edits cleanly
  await expect(page.getByRole("button", { name: /6 km\/L/ })).toBeVisible();
  await page.getByRole("button", { name: /6 km\/L/ }).click();
  await expect(page.getByLabel("Efficiency (km/L)")).toHaveValue("6");
  await page.getByLabel("Efficiency (km/L)").fill("8");

  // Calculate populates metrics, allowance, fuel, and flags unknown toll
  await page.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(page.getByText("42.6 km")).toBeVisible();
  await expect(page.getByText("1h 15m")).toBeVisible();
  await expect(page.getByText("Enter toll")).toBeVisible();
  await expect(page.getByLabel(/Allowance/)).toHaveValue("600");
  await expect(page.getByText(/\+ toll/)).toBeVisible();

  // Entering toll updates total and clears warning badge
  await page.getByLabel(/Toll/).fill("120");
  await expect(page.getByText("Enter toll")).toHaveCount(0);
  await expect(page.getByText(/\+ toll/)).toHaveCount(0);

  // WCAG 2.1 AA audit
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const violations = await page.evaluate(async () => {
    const result = await (
      window as unknown as {
        axe: { run: (el: Element, opts: unknown) => Promise<AxeResults> };
      }
    ).axe.run(document.querySelector("main")!, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
    return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html).join(" | ")}`);
  });
  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});
