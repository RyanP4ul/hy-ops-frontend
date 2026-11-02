import { expect, test } from "@playwright/test";
import { browserLogin } from "./helpers";

test("Dashboard map shows actual vehicle GPS to customer route without a card at desktop and mobile sizes", async ({ page }) => {
  await browserLogin(page, "staff@example.test");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const customer = [121.2, 14.6], gps = [121.11, 14.51];
  const vehicle = { id: "1", plate: "MAP-001", driver: "Map driver", warehouseId: "1", color: "#2563eb", status: "delivering", trip: { id: "1", label: "Trip", scheduledAt: "2026-11-02T08:00:00+08:00" }, stops: [{ id: "1", name: "Map customer", address: "Saved address", coordinates: customer, status: "pending", order: {} }], pickups: [], scheduledTrips: [], legIndex: 0, progress: 0, completedStops: 0, speed: 0 };
  await page.route(/\/api\/fleet$/, route => route.fulfill({ json: { vehicles: [vehicle, { ...vehicle, id: "2", plate: "NO-GPS" }], warehouses: [{ id: "1", name: "Warehouse", coordinates: [121.1, 14.5] }] } }));
  let hasGps = true;
  await page.route(/\/api\/fleet\/positions$/, route => route.fulfill({ json: { positions: hasGps ? [{ vehicleId: "1", coordinates: gps, recordedAt: new Date().toISOString(), speedKph: 0, heading: null }] : [] } }));
  const routes: string[] = [];
  await page.route("**/panel/fleet-map/road-route?**", route => {
    const points = new URL(route.request().url()).searchParams.get("waypoints")!;
    routes.push(points);
    return route.fulfill({ json: { coordinates: [gps, customer], legs: [{ coordinates: [gps, customer], distanceMeters: 1000, durationSeconds: 100 }], distanceMeters: 1000, durationSeconds: 100 } });
  });
  await page.goto("/panel");
  const map = page.getByRole("region", { name: "Dashboard vehicle map", exact: true });
  await expect(map).toBeVisible();
  await expect(map.locator('xpath=ancestor::*[@data-slot="card"]')).toHaveCount(0);
  await expect(map.getByLabel("Vehicle MAP-001", { exact: true })).toBeAttached();
  await expect(map.getByLabel("Destination for MAP-001", { exact: true })).toBeAttached();
  await expect(map.getByLabel("Vehicle NO-GPS", { exact: true })).toHaveCount(0);
  await expect(map).toContainText("1 without GPS");
  await expect.poll(() => routes).toContain("121.11,14.51;121.2,14.6");
  expect((await map.boundingBox())?.height).toBeGreaterThanOrEqual(560);
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await map.boundingBox())?.height).toBeGreaterThanOrEqual(420);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  hasGps = false;
  await expect(map).toContainText("Waiting for vehicle GPS.", { timeout: 15000 });
  await expect(map.getByLabel("Destination for MAP-001", { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
