import { expect, test, type Page } from "@playwright/test";
import { browserLogin, json, order } from "./helpers";

test.use({ timezoneId: "America/Los_Angeles", actionTimeout: 15_000 });
test.setTimeout(120_000);
test.beforeEach(async ({ page }) => { await browserLogin(page); });
async function ready(page: Page, custom = false) {
  const created = await json(page.request, "POST", "/orders", custom ? { ...order, is_custom_shipping: true, customer_address_id: undefined, shipping_recipient: "Manual recipient", shipping_phone: "09123456789", shipping_address: "Manual destination" } : order);
  await json(page.request, "POST", `/orders/process/${created.id}?version=1`);
  await json(page.request, "POST", `/orders/delivery/${created.id}?version=2`);
  return created;
}
async function chooseDate(page: Page, dialog: ReturnType<Page["getByRole"]>) {
  await dialog.locator("#scheduledDate").click();
  await page.locator("button[data-day]:not([disabled])").last().click();
  await dialog.locator("#scheduledDate").click();
}
async function openSchedule(page: Page) {
  await page.goto("/panel/delivery-schedules");
  await page.getByRole("button", { name: "Schedule Delivery", exact: true }).click();
  const dialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Schedule Delivery", exact: true }) });
  await dialog.getByPlaceholder("Select warehouse name...").click();
  await page.getByRole("option").filter({ hasText: "Live warehouse" }).click();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await chooseDate(page, dialog);
  await dialog.locator("#scheduled_time").fill("23:59");
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  return dialog;
}

test("Delivery schedule modal loads ready orders, selects a named driver and saves the Manila date", async ({ page }) => {
  const created = await ready(page);
  const pending = await json(page.request, "POST", "/orders", order);
  const api = await json(page.request, "GET", `/orders/cb?warehouse_id=1&search=${created.product_number}`);
  expect(api.rows.map((row: { id: number }) => row.id)).toEqual([created.id]);
  expect(api.rows[0]).toMatchObject({ latitude: "14.600000", longitude: "121.200000" });
  expect((await json(page.request, "GET", `/orders/cb?warehouse_id=1&search=${pending.product_number}`)).total).toBe(0);
  const dialog = await openSchedule(page);
  await dialog.getByRole("button", { name: "Add Order", exact: true }).click();
  const sub = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Add Order", exact: true }) });
  await sub.getByPlaceholder("Select order number...").click();
  await page.getByRole("option").filter({ hasText: created.product_number }).click();
  await sub.getByRole("button", { name: "Add Order", exact: true }).click();
  await expect(dialog).toContainText(created.product_number);
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await dialog.getByPlaceholder("Select driver...", { exact: true }).click();
  await page.getByRole("option").filter({ hasText: "Live Driver" }).click();
  await dialog.getByPlaceholder("Select vehicle...").click();
  await page.getByRole("option").filter({ hasText: "LIVE-001" }).click();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  const responsePromise = page.waitForResponse(r => r.url().endsWith("/api/deliveries") && r.request().method() === "POST");
  await dialog.getByRole("button", { name: "Submit", exact: true }).click();
  const response = await responsePromise;
  expect(response.status(), await response.text()).toBe(200);
  const payload = response.request().postDataJSON();
  expect(payload.scheduled_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const result = await response.json();
  expect(result.delivery.driver_name).toBe("Live Driver");
  expect(result.delivery.scheduled_date).toBe(payload.scheduled_date);
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Schedule Delivery", exact: true }).click();
  await expect(dialog).toContainText("Step 1 of 6");
  await expect(dialog.getByPlaceholder("Select warehouse name...")).toHaveValue("");
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await json(page.request, "POST", "/deliveries/event", { delivery_id: result.id, delivery_version: 1, event_type: "CANCELLED", reason: "Fixture cleanup" });
});

test("Delivery destination confirmation saves only the snapshot and retains a stale draft", async ({ page }) => {
  const created = await ready(page, true);
  await page.goto("/panel/delivery-schedules");
  const row = page.getByRole("row").filter({ hasText: created.product_number });
  await row.getByRole("button", { name: "Confirm location", exact: true }).click();
  await page.getByLabel("Latitude", { exact: true }).fill("15.3");
  await page.getByLabel("Longitude", { exact: true }).fill("120.8");
  await page.getByRole("button", { name: "Save location", exact: true }).click();
  await expect(row.getByRole("button", { name: "Location saved", exact: true })).toBeVisible();
  const saved = await json(page.request, "GET", `/orders/cb?warehouse_id=1&search=${created.product_number}`);
  expect(saved.rows[0]).toMatchObject({ latitude: "15.300000", longitude: "120.800000", shipping_address: "Manual destination" });
  await row.getByRole("button", { name: "Location saved", exact: true }).click();
  await page.getByLabel("Latitude", { exact: true }).fill("16.4");
  await json(page.request, "PUT", `/orders/${created.id}/destination`, { version: saved.rows[0].version, latitude: 14, longitude: 121 });
  await page.getByRole("button", { name: "Save location", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Order changed" })).toBeVisible();
  await expect(page.getByLabel("Latitude", { exact: true })).toHaveValue("16.4");
});

test("Overdue delivery blocks dispatch, reschedules through the browser and clears the overdue filter", async ({ page }) => {
  const created = await ready(page);
  const delivery = await json(page.request, "POST", "/deliveries", { order_ids: [created.id], scheduled_date: "2020-01-01", scheduled_time: "09:00", delivery_type: "INTERNAL", driver_id: 5, vehicle_id: 1, delivery_allowance: 0, fuel: 0, toll: 0 });
  const beforeFleet = await json(page.request, "GET", "/fleet");
  expect(beforeFleet.vehicles.find((v: { id: string }) => v.id === "1").scheduledTrips.find((t: { id: string }) => t.id === String(delivery.id)).phase).toBe("overdue");
  const blocked = await page.request.post(`/api/deliveries/${delivery.id}/dispatch`);
  expect(blocked.ok()).toBe(false); expect(await blocked.text()).toContain("Reschedule");
  await page.goto("/panel/deliveries?overdue=true");
  const row = page.getByRole("row").filter({ hasText: created.product_number });
  await expect(row).toContainText("Overdue"); await expect(row).toContainText("Live Driver");
  await row.getByRole("button", { name: "Delivery Event", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Event Type").click(); await page.getByRole("option", { name: "Reschedule", exact: true }).click();
  await chooseDate(page, dialog);
  await dialog.locator("#departure_time").fill("23:59");
  await dialog.locator("textarea").fill("Customer requested a future Manila departure");
  await dialog.getByRole("button", { name: "Reschedule Delivery", exact: true }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: "already has a delivery recorded" })).toBeVisible();
  await expect(dialog.locator("textarea")).toHaveValue("Customer requested a future Manila departure");
  await dialog.locator("#departure_time").fill("23:58");
  await dialog.getByRole("button", { name: "Reschedule Delivery", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toHaveCount(0);
  const all = await json(page.request, "GET", "/deliveries?limit=100");
  expect(all.find((r: { delivery_id: number }) => r.delivery_id === delivery.id)).toMatchObject({ is_overdue: false, driver_name: "Live Driver", departure_time: "23:58:00" });
  await json(page.request, "POST", `/deliveries/${delivery.id}/dispatch`);
  let fleet = await json(page.request, "GET", "/fleet");
  const vehicle = fleet.vehicles.find((v: { id: string }) => v.id === "1");
  expect(vehicle).toMatchObject({ status: "delivering", driver: "Live Driver" });
  for (const stop of vehicle.stops) await json(page.request, "POST", `/deliveries/stops/${stop.id}/delivered`);
  fleet = await json(page.request, "GET", "/fleet");
  expect(fleet.vehicles.find((v: { id: string }) => v.id === "1").status).toBe("returning");
  await json(page.request, "POST", `/deliveries/${delivery.id}/complete`);
  fleet = await json(page.request, "GET", "/fleet");
  expect(fleet.vehicles.find((v: { id: string }) => v.id === "1").status).toBe("available");
});


test("Order selector recovers from orders/cb failure and confirms a manual destination inside the modal", async ({ page }) => {
  const created = await ready(page, true);
  let fail = true;
  await page.route("**/api/orders/cb?*", route => fail ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Fixture order lookup failure" }) }) : route.continue());
  const dialog = await openSchedule(page);
  await dialog.getByRole("button", { name: "Add Order", exact: true }).click();
  const sub = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Add Order", exact: true }) });
  await expect(sub.getByRole("alert")).toContainText("Unable to load ready orders");
  fail = false;
  await sub.getByRole("button", { name: "Retry", exact: true }).click();
  await sub.getByPlaceholder("Select order number...").click();
  await page.getByRole("option").filter({ hasText: created.product_number }).click();
  await sub.getByRole("button", { name: "Add Order", exact: true }).click();
  await expect(sub).toContainText("Confirm this order's destination coordinates");
  await sub.getByRole("button", { name: "Confirm location", exact: true }).click();
  await page.getByLabel("Latitude", { exact: true }).fill("14.8");
  await page.getByLabel("Longitude", { exact: true }).fill("121.4");
  await page.getByRole("button", { name: "Save location", exact: true }).click();
  await expect(sub.getByRole("button", { name: "Location saved", exact: true })).toBeVisible();
  await sub.getByRole("button", { name: "Add Order", exact: true }).click();
  await expect(sub).toHaveCount(0);
  await expect(dialog).toContainText(created.product_number);
});
