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
      mode: "development", entry: path.resolve("map-tests/harness.tsx"),
      output: { path: path.resolve("test-results/google-maps-bundle"), filename: "harness.js" },
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
    if (route.request().url().endsWith("/harness.js")) return route.fulfill({ contentType: "application/javascript", body: readFileSync("test-results/google-maps-bundle/harness.js") });
    return route.fulfill({ contentType: "text/html", body: `<!doctype html><html><head><style>
      .relative{position:relative}.absolute{position:absolute}.inset-0{inset:0}.h-full{height:100%}.w-full{width:100%}
      .bottom-10{bottom:40px}.right-2{right:8px}.z-10{z-index:10}.flex{display:flex}.flex-col{flex-direction:column}
      .bottom-full{bottom:100%}.left-1\\/2{left:50%}.pointer-events-none{pointer-events:none}
      </style></head><body><div id="root"></div><script src="/harness.js"></script></body></html>` });
  });
});

test("shares the SDK, renders markers/routes, picks coordinates, and resets 3D", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const sdkRequests: string[] = [];
  page.on("request", request => { if (request.url().includes("maps.googleapis.com/maps/api/js")) sdkRequests.push(request.url()); });
  await mockGoogleMaps(page);
  await page.goto("https://hyops.test/");
  await expect(page.locator(".gm-style")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Warehouse pin" })).toBeVisible();
  const route = await page.evaluate(() => {
    const lines = Reflect.get(window, "__googleMapsFixtureLines") as { options: { map: object | null; path?: { lat: number; lng: number }[]; strokeColor?: string; strokeOpacity?: number; icons?: object[] } }[];
    const options = lines.find(line => line.options.map)?.options;
    return { path: options?.path, color: options?.strokeColor, opacity: options?.strokeOpacity, icons: options?.icons?.length };
  });
  expect(route).toEqual({ path: [{ lng: 121.02, lat: 14.6 }, { lng: 121.04, lat: 14.61 }], color: "#ff0000", opacity: 0, icons: 1 });
  await page.getByRole("button", { name: "Warehouse pin" }).hover();
  await expect(page.getByRole("tooltip")).toContainText("Warehouse tooltip");
  await page.getByRole("button", { name: "Warehouse pin" }).click();
  await expect(page.getByText("Warehouse details", { exact: true })).toBeVisible();
  const coordinates = page.getByLabel("Coordinates");
  await expect(coordinates).toHaveText("121.02000,14.60000");
  await page.locator(".gm-style").first().click({ position: { x: 500, y: 150 } });
  await expect(coordinates).not.toHaveText("121.02000,14.60000");
  await page.evaluate(() => {
    const marker = document.querySelector("hyops-google-marker-fixture");
    Reflect.get(marker!, "events").emit("dragend", { latLng: { toJSON: () => ({ lng: 121.08, lat: 14.62 }) } });
  });
  await expect(coordinates).toHaveText("121.08000,14.62000");
  await page.getByRole("button", { name: "3D view" }).click();
  const compass = page.getByRole("button", { name: "Reset bearing to north" });
  await expect(compass.locator("svg")).toHaveAttribute("style", /rotateX\(55deg\)/);
  await compass.click();
  await expect(compass.locator("svg")).toHaveAttribute("style", /rotateX\(0deg\)/);
  await page.getByRole("button", { name: "Toggle second map" }).click();
  await expect(page.locator(".gm-style")).toHaveCount(1);
  await page.getByRole("button", { name: "Toggle second map" }).click();
  await expect(page.locator(".gm-style")).toHaveCount(2);
  expect(sdkRequests).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("shows an SDK failure and retries successfully", async ({ page }) => {
  await page.route("https://maps.googleapis.com/maps/api/js?**", route => route.abort());
  await page.goto("https://hyops.test/");
  await expect(page.getByRole("alert").first()).toContainText("Google Maps could not load");
  await page.unroute("https://maps.googleapis.com/maps/api/js?**");
  await mockGoogleMaps(page);
  await page.getByRole("button", { name: "Retry map" }).first().click();
  await expect(page.getByRole("button", { name: "Warehouse pin" })).toBeVisible();
});

test("shows Google authorization errors", async ({ page }) => {
  await mockGoogleMaps(page);
  await page.goto("https://hyops.test/");
  await expect(page.locator(".gm-style")).toHaveCount(2);
  await page.evaluate(() => window.gm_authFailure?.());
  await expect(page.getByRole("alert").first()).toContainText("Google Maps authorization failed");
});
