import { expect, test } from "@playwright/test";
import { browserLogin, json, login, order } from "./helpers";

test.use({ timezoneId: "Asia/Manila", actionTimeout: 15_000 });
test.setTimeout(150_000);

test("Staff schedules and dispatches through website; assigned driver confirms stop; staff confirms return", async ({ page, playwright }) => {
  await browserLogin(page, "staff@example.test");
  const created = await json(page.request, "POST", "/orders", order);
  await json(page.request, "POST", `/orders/process/${created.id}?version=1`);
  await json(page.request, "POST", `/orders/delivery/${created.id}?version=2`);
  await page.goto("/panel/delivery-schedules");
  await page.getByRole("button", { name: "Schedule Delivery", exact: true }).click();
  const dialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Schedule Delivery", exact: true }) });
  await dialog.getByPlaceholder("Select warehouse name...").click();
  await page.getByRole("option").filter({ hasText: "Live warehouse" }).click();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await dialog.locator("#scheduledDate").click();
  await page.locator("button[data-day]:not([disabled])").last().click();
  await dialog.locator("#scheduledDate").click();
  await dialog.locator("#scheduled_time").fill("23:59");
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await dialog.getByRole("button", { name: "Add Order", exact: true }).click();
  const sub = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Add Order", exact: true }) });
  await sub.getByPlaceholder("Select order number...").click();
  await page.getByRole("option").filter({ hasText: created.product_number }).click();
  await sub.getByRole("button", { name: "Add Order", exact: true }).click();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await dialog.getByPlaceholder("Select driver...", { exact: true }).click();
  await page.getByRole("option").filter({ hasText: "Live Driver" }).click();
  await dialog.getByPlaceholder("Select vehicle...").click();
  await page.getByRole("option").filter({ hasText: "LIVE-001" }).click();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  const saved = page.waitForResponse(r => r.url().endsWith("/api/deliveries") && r.request().method() === "POST");
  await dialog.getByRole("button", { name: "Submit", exact: true }).click();
  const response = await saved;
  expect(response.status(), await response.text()).toBe(200);
  const run = await response.json();
  await expect(dialog).toHaveCount(0);
  await page.goto("/panel/deliveries");
  const row = page.getByRole("row").filter({ hasText: created.product_number });
  // Delivery order eye action loads the selected order and can recover from a failed read.
  const orderDetailsButton = row.getByRole("button", { name: `View order details ${created.product_number}`, exact: true });
  let failOrderRead = true;
  await page.route(`**/api/orders/${created.id}`, route => failOrderRead
    ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Fixture unavailable" }) })
    : route.continue());
  await orderDetailsButton.click();
  const details = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: `Order ${created.product_number}`, exact: true }) });
  await expect(details.getByRole("alert")).toContainText("Unable to load order details");
  failOrderRead = false;
  await details.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(details.getByRole("heading", { name: "Order Information" })).toBeVisible();
  await expect(details).toContainText("Live Customer");
  await expect(details).toContainText("Live variant");
  await expect(details).toContainText("Fixture street");
  await expect(details).toContainText("24.68");
  await details.getByRole("button", { name: "Close", exact: true }).first().click();
  await expect(details).toHaveCount(0);
  await page.unroute(`**/api/orders/${created.id}`);
  page.once("dialog", prompt => prompt.accept());
  await row.getByRole("button", { name: "Dispatch", exact: true }).click();
  await expect(row).toContainText("in_transit");
  const driver = await playwright.request.newContext({ baseURL: "http://127.0.0.1:3100" });
  try {
    await login(driver, "driver@example.test");
    const trip = await json(driver, "GET", `/driver/trips/${run.id}`);
    expect(trip.stops).toHaveLength(1);
    expect(trip.stops[0].address).toBeTruthy();
    await json(driver, "POST", `/driver/stops/${trip.stops[0].id}/delivered`, { version: trip.version, operationKey: crypto.randomUUID() });
    await expect(row).toContainText("returning");
    await expect(row).toContainText("delivered");
    page.once("dialog", prompt => prompt.accept());
    await row.getByRole("button", { name: "Confirm warehouse return", exact: true }).click();
    await expect(row).toContainText("completed");
    expect((await json(driver, "GET", `/driver/trips/${run.id}`)).status).toBe("completed");
    // Staff requests retrieval of goods already received; payments stay separate.
    await row.getByRole("button", { name: "Refunded", exact: true }).click();
    const refundDialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Flag refund and request pickup" }) });
    await expect(refundDialog.getByRole("button", { name: "Confirm pickup request" })).toBeDisabled();
    await refundDialog.getByLabel("Reason").fill("Customer return acceptance check");
    await refundDialog.getByRole("checkbox").check();
    await refundDialog.getByRole("button", { name: "Confirm pickup request" }).click();
    await expect(refundDialog).toHaveCount(0);
    await expect(row).toContainText("Refunded / requested");
    // Keep the fleet request pending to check desktop/mobile loading geometry.
    let releaseFleet!: () => void;
    const fleetGate = new Promise<void>(resolve => { releaseFleet = resolve; });
    await page.route(/\/api\/fleet(?:\?.*)?$/, async route => { await fleetGate; await route.continue(); });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/panel/fleet-map");
    const loadingFleet = page.getByRole("status", { name: "Loading fleet", exact: true });
    try {
      await expect(loadingFleet).toBeVisible();
      await expect(loadingFleet).toHaveAttribute("aria-busy", "true");
      await expect(page.getByTestId("fleet-loading-sidebar")).toBeVisible();
      const desktopMap = await page.getByTestId("fleet-loading-map").boundingBox();
      expect(desktopMap?.width).toBeGreaterThan(300);
      await expect(loadingFleet.locator('[data-slot="skeleton"]').first()).toHaveCSS("animation-name", "none");
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(page.getByTestId("fleet-loading-sidebar")).toBeHidden();
      const mobileMap = await page.getByTestId("fleet-loading-map").boundingBox();
      expect(mobileMap?.width).toBeGreaterThan(200);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    } finally { releaseFleet(); }
    await expect(loadingFleet).toHaveCount(0);
    await page.unroute(/\/api\/fleet(?:\?.*)?$/);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByRole("tab", { name: "Vehicles (1)", exact: true })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Warehouses (1)", exact: true })).toBeVisible();
    await page.getByRole("tab", { name: "Refunded / return pickups (1)", exact: true }).click();
    await expect(page.getByRole("tabpanel")).toContainText("Awaiting pickup assignment");
    await page.getByRole("tab", { name: "Warehouses (1)", exact: true }).click();
    await expect(page.getByRole("tabpanel")).not.toContainText("Awaiting pickup assignment");
    // Mobile list exposes the same Returns tab and keeps its assignment dialog usable.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "List", exact: true }).click();
    await page.getByRole("tab", { name: "Refunded / return pickups (1)", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByRole("button").filter({ hasText: created.product_number }).click();
    const pickupDialog = page.getByRole("dialog");
    await expect(pickupDialog).toContainText("Customer return acceptance check");
    await pickupDialog.getByLabel("Vehicle (same warehouse)").selectOption("1");
    await pickupDialog.getByLabel("Driver", { exact: true }).selectOption("5");
    await pickupDialog.getByRole("checkbox").check();
    await pickupDialog.getByRole("button", { name: "Confirm pickup assignment" }).click();
    await expect(pickupDialog).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    const tasks = await json(page.request, "GET", "/deliveries/returns");
    const pickup = tasks.find((task: { orderId: number }) => task.orderId === created.id);
    expect(pickup.status).toBe("assigned");
    const returnTrip = await json(driver, "GET", `/driver/trips/${pickup.deliveryId}`);
    expect(returnTrip.stops).toHaveLength(0);
    expect(returnTrip.pickups[0].orderNumber).toBe(created.product_number);
    await json(driver, "POST", `/driver/returns/${pickup.id}/collected`, { version: pickup.version, operationKey: crypto.randomUUID() });
    await page.goto("/panel/deliveries");
    const pickupRow = page.getByRole("row").filter({ has: page.getByRole("button", { name: "Confirm warehouse return", exact: true }) });
    page.once("dialog", prompt => prompt.accept());
    await pickupRow.getByRole("button", { name: "Confirm warehouse return", exact: true }).click();
    await expect(page.getByRole("row").filter({ has: page.getByRole("button", { name: `View order details ${created.product_number}`, exact: true }) })).toContainText("Refunded / received");
    const history = await json(driver, "GET", "/driver/history");
    expect(history.items.some((item: { tripId: number }) => item.tripId === run.id)).toBe(true);
  } finally { await driver.dispose(); }
});
