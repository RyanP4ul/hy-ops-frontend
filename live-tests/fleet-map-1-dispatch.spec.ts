import { mockGoogleMaps } from "./google-maps";
﻿import { expect, test } from "@playwright/test";
import { browserLogin, json, login } from "./helpers";
import type { Vehicle, DeliveryStop, WarehouseLocation } from "../app/(protected)/panel/fleet-map-1/types";

test.setTimeout(120_000);

test("Dispatcher redesign: original route, access controls and warehouse scope stay independent", async ({ page, browser }) => {
  const anonymous = await browser.newContext();
  for (const route of ["fleet-map", "fleet-map-1"]) {
    const response = await anonymous.request.get(`/panel/${route}`, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toMatch(/\/$/);
  }
  await anonymous.close();
  await browserLogin(page, "staff@example.test");
  const overview = await json(page.request, "GET", "/fleet");
  for (const route of ["fleet-map", "fleet-map-1"]) {
    await page.goto(`/panel/${route}`);
    await expect(page.getByRole("region", { name: "Fleet dispatch workspace", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /LIVE-001/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Fleet Map", exact: true })).toHaveAttribute("href", "/panel/fleet-map");
    if (route === "fleet-map-1") {
      const filter = page.getByLabel("Filter by warehouse");
      for (const warehouse of overview.warehouses) await expect(filter.locator(`option[value="${warehouse.id}"]`)).toHaveText(warehouse.name);
      expect(await filter.locator("option").count()).toBe(overview.warehouses.length + 1);
    }
    await expect(page).toHaveURL(new RegExp(`/panel/${route}$`));
  }
  const denied = await browser.newContext();
  await login(denied.request, "driver@example.test");
  for (const route of ["fleet-map", "fleet-map-1"]) expect((await denied.request.get(`/panel/${route}`, { maxRedirects: 0 })).status()).toBe(307);
  await denied.close();
});

test("Dispatcher redesign: GPS, grouped orders, route retry and view state", async ({ page }) => {
  await browserLogin(page);
  await page.setViewportSize({ width: 1680, height: 1000 });
  const warehouse: WarehouseLocation = { id: "1", name: "Main hub", address: "Manila", streetAddress: "Main St", city: "Manila", state: "NCR", zipCode: "1000", coordinates: [121.02, 14.6] };
  const stop = (id: string, status: DeliveryStop["status"]): DeliveryStop => ({ id, status, name: "Central store", address: "Market street", coordinates: [121.04, 14.61], order: { id: `ORD-${id}`, customer: { name: "Store manager", code: "C1", phone: "" }, paymentArrangement: "NET_30", paymentMethod: null, totalAmount: 100, amountPaid: 0, items: [] } });
  const base: Vehicle = { id: "1", plate: "LIVE-001", driver: "Driver One", color: "#1d4ed8", warehouseId: "1", status: "delivering", trip: { id: "1", label: "Morning deliveries", scheduledAt: new Date().toISOString() }, stops: [stop("11", "pending"), stop("12", "completed")], scheduledTrips: [], legIndex: 0, progress: 0, completedStops: 1, speed: 0 };
  const vehicles = [base, { ...base, id: "2", plate: "STALE-002", driver: "Driver Two", stops: [stop("21", "pending")] }, { ...base, id: "3", plate: "MAINT-003", status: "available", blockedReason: "maintenance", trip: null, stops: [] }];
  let longitude = 121.03;
  const fixes = () => [{ vehicleId: "1", coordinates: [longitude, 14.603], speedKph: 20, heading: 90, recordedAt: new Date().toISOString() }, { vehicleId: "2", coordinates: [121.05, 14.604], speedKph: 0, heading: null, recordedAt: new Date(Date.now() - 180_000).toISOString() }];
  await page.route("**/api/fleet", route => route.fulfill({ json: { vehicles, warehouses: [warehouse] } }));
  await page.route("**/api/fleet/positions", route => route.fulfill({ json: { positions: fixes() } }));
  await page.route("**/api/deliveries?**", route => route.fulfill({ json: [{ delivery_id: 1, status: "in_transit", is_overdue: false, orders: [11,12].map(id => ({ stop_id: id, order_id: id, order_number: `ORD-${id}`, order_group_id: "physical-1", order_group_number: "GRP-1", order_group_position: id - 10, status: id === 11 ? "pending" : "delivered", failure_reason: null, return_id: null, return_status: null })) }] }));
  await page.route("**/api/deliveries/returns", route => route.fulfill({ json: [] }));
  await page.route("**/api/deliveries/stops/*/proofs", route => route.fulfill({ json: route.request().url().includes("/12/") ? [{ id: "proof-1", kind: "photo", contentType: "image/jpeg", byteSize: 100, createdAt: new Date().toISOString() }] : [] }));
  let routingFails = true;
  await page.route("**/panel/fleet-map-1/road-route?**", route => route.fulfill(routingFails ? { status: 502, json: { message: "Fixture outage" } } : { json: { coordinates: [[longitude, 14.603], [121.03, 14.61], [121.04, 14.61]], distance: 2300, duration: 300, legs: [] } }));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/panel/fleet-map-1");
  const directory = page.getByRole("complementary", { name: "Fleet directory" });
  await expect(page.getByRole("button", { name: "Map & List", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Dev tools", { exact: true })).toHaveCount(0);
  await directory.getByRole("button", { name: /LIVE-001/ }).click();
  const drawer = page.getByRole("region", { name: "Vehicle LIVE-001 details" });
  await expect(drawer).toContainText("GPS updated");
  await expect(drawer).toContainText("0/1 stops completed · 1/2 orders completed");
  await expect(drawer.getByText("Stop 1 · 2 orders", { exact: true })).toBeVisible();
  await expect(drawer.getByText("Awaiting proof", { exact: true })).toBeVisible();
  await drawer.getByRole("button", { name: "View proof", exact: true }).click();
  const proofDialog = page.getByRole("dialog", { name: "Proof of delivery — ORD-12" });
  await expect(proofDialog).toBeVisible();
  await expect(proofDialog).toContainText("Delivery photo");
  await proofDialog.getByRole("button", { name: "Close", exact: true }).first().click();
  await expect(page.locator('[aria-label="Stop 1 · 2 orders: Central store"]')).toHaveCount(1);
  await expect(page.locator('[aria-label^="Vehicle MAINT-003,"]')).toHaveCount(0);
  const failure = page.getByText("Road route unavailable. Stop locations are still visible.", { exact: true });
  await expect(failure).toBeVisible();
  await expect(drawer).not.toContainText("Est. drive:");
  routingFails = false;
  await failure.locator("..").getByRole("button", { name: "Retry", exact: true }).click();
  await expect(failure).toHaveCount(0);
  await expect(page.getByText(/planned leg: 5 min/)).toBeVisible();
  await page.getByRole("button", { name: "Fit fleet", exact: true }).click();
  const marker = page.locator('[aria-label="Vehicle LIVE-001, delivering"]');
  await expect(marker).toBeVisible();
  await page.waitForTimeout(850); // Fit fleet camera animation is 750 ms.
  const before = await marker.boundingBox();
  const warehouseBefore = await page.locator('[aria-label="Warehouse Main hub"]').boundingBox();
  longitude = 121.035;
  await expect.poll(async () => (await marker.boundingBox())?.x).not.toBe(before?.x);
  expect((await page.locator('[aria-label="Warehouse Main hub"]').boundingBox())?.x).toBeCloseTo(warehouseBefore!.x, 0);
  // Marker updates stay visible without jumping the map camera.
  await page.getByRole("button", { name: "Close vehicle details" }).click();
  await page.locator('[aria-label="Vehicle STALE-002, delivering"]').click();
  await expect(directory.getByRole("button", { name: /STALE-002/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Vehicle STALE-002 details" })).toContainText("Last seen 3 min ago");
  await directory.getByRole("button", { name: /MAINT-003/ }).click();
  const maintenance = page.getByRole("region", { name: "Vehicle MAINT-003 details" });
  await expect(maintenance).toContainText("Maintenance");
  await expect(maintenance).toContainText("No GPS");
  await expect(maintenance.getByRole("button", { name: "Follow vehicle", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Close vehicle details" }).click();
  await directory.getByRole("button", { name: /LIVE-001/ }).click();
  await directory.getByRole("textbox", { name: "Search vehicles", exact: true }).fill("LIVE-001");
  await page.getByLabel("Filter by warehouse").selectOption("1");
  const perspective = page.getByRole("button", { name: "3D view", exact: true });
  const compass = page.getByRole("button", { name: "Reset bearing to north", exact: true });
  await expect(perspective).toHaveAttribute("aria-pressed", "false");
  await perspective.click();
  await expect(compass.locator("svg")).toHaveAttribute("style", /rotateX\(55deg\)/);
  await expect(perspective).toHaveAttribute("aria-pressed", "true");
  await expect(directory.getByRole("button", { name: /LIVE-001/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "List Only", exact: true }).click();
  await expect(drawer).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in", exact: true })).not.toBeVisible();
  await expect(perspective).not.toBeVisible();
  await expect(page.getByRole("table")).toContainText("LIVE-001");
  await expect(page.getByRole("table")).not.toContainText("STALE-002");
  await page.getByRole("button", { name: "Map Only", exact: true }).click();
  await expect(drawer).toBeVisible();
  await expect(perspective).toHaveAttribute("aria-pressed", "true");
  await expect(compass.locator("svg")).toHaveAttribute("style", /rotateX\(55deg\)/);
  await page.getByRole("button", { name: /Browse fleet/ }).click();
  const browse = page.getByRole("dialog", { name: "Browse fleet" });
  await expect(browse.getByRole("textbox", { name: "Search vehicles", exact: true })).toHaveValue("LIVE-001");
  await expect(browse.getByLabel("Filter by warehouse")).toHaveValue("1");
  await browse.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Map & List", exact: true }).click();
  await expect(directory.getByRole("textbox", { name: "Search vehicles", exact: true })).toHaveValue("LIVE-001");
  for (let zoom = 0; zoom < 3; zoom++) await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator('[data-map-provider="google"] .gm-style')).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry map", exact: true })).not.toBeVisible();
  await page.waitForTimeout(500); // Allow the final zoom transition and extrusion draw to settle.
  await page.screenshot({ path: "test-results/fleet-map-1-3d-desktop.png" });
  await compass.click();
  await expect(perspective).toHaveAttribute("aria-pressed", "false");
  await expect(compass.locator("svg")).toHaveAttribute("style", /rotateX\(0deg\)/);
  await perspective.click();
  await expect(compass.locator("svg")).toHaveAttribute("style", /rotateX\(55deg\)/);
  await perspective.click();
  await expect(compass.locator("svg")).toHaveAttribute("style", /rotateX\(0deg\)/);
  await page.screenshot({ path: "test-results/fleet-map-1-desktop.png" });
  await drawer.getByRole("button", { name: "Follow vehicle", exact: true }).click();
  await expect(drawer.getByRole("button", { name: "Following", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Fullscreen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Exit fullscreen", exact: true })).toBeVisible();
  for (const width of [768,390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const mapBox = await page.getByLabel("Fleet map", { exact: true }).boundingBox();
    const detailBox = await drawer.boundingBox();
    expect(detailBox!.y).toBeGreaterThan(mapBox!.y + 100);
  }
  await page.screenshot({ path: "test-results/fleet-map-1-mobile.png" });
  expect(errors).toEqual([]);
});

// Maps run without public tile requests or billable SDK traffic in browser tests.
test.beforeEach(async ({ page }) => { await mockGoogleMaps(page); });
