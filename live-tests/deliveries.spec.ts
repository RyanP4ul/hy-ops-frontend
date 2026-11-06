import { expect, test, type Page } from "@playwright/test";
import type { AxeResults } from "axe-core";
import { browserLogin, json, order } from "./helpers";

test.use({ timezoneId: "America/Los_Angeles", actionTimeout: 15_000 });
test.setTimeout(120_000);
test.beforeEach(async ({ page }) => { await browserLogin(page); });
async function ready(page: Page) {
  const created = await json(page.request, "POST", "/orders", order);
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
  const dialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Schedule delivery", exact: true }) });
  await dialog.getByPlaceholder("Select warehouse name...").click();
  await page.getByRole("option").filter({ hasText: "Live warehouse" }).click();
  await dialog.getByRole("button", { name: /^Continue to / }).click();
  await chooseDate(page, dialog);
  await dialog.locator("#scheduled_time").fill("23:59");
  await dialog.getByRole("button", { name: /^Continue to / }).click();
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
  await dialog.getByRole("button", { name: /^Continue to / }).click();
  await dialog.getByPlaceholder("Select driver...", { exact: true }).click();
  await page.getByRole("option").filter({ hasText: "Live Driver" }).click();
  await dialog.getByPlaceholder("Select vehicle...").click();
  await page.getByRole("option").filter({ hasText: "LIVE-001" }).click();
  await dialog.getByRole("button", { name: /^Continue to / }).click();
  await dialog.getByRole("button", { name: /^Continue to / }).click();
  const responsePromise = page.waitForResponse(r => r.url().endsWith("/api/deliveries") && r.request().method() === "POST");
  await dialog.getByRole("button", { name: "Create delivery schedule", exact: true }).click();
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
  const created = await ready(page);
  await page.goto("/panel/delivery-schedules");
  const row = page.getByRole("row").filter({ hasText: created.product_number });
  await row.getByRole("button", { name: "Location saved", exact: true }).click();
  await page.getByLabel("Latitude", { exact: true }).fill("15.3");
  await page.getByLabel("Longitude", { exact: true }).fill("120.8");
  await page.getByRole("button", { name: "Save location", exact: true }).click();
  await expect(row.getByRole("button", { name: "Location saved", exact: true })).toBeVisible();
  const saved = await json(page.request, "GET", `/orders/cb?warehouse_id=1&search=${created.product_number}`);
  expect(saved.rows[0]).toMatchObject({ latitude: "15.300000", longitude: "120.800000" });
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
  await dialog.locator("#departure_time").fill("23:58");
  await dialog.locator("textarea").fill("Customer requested a future Manila departure");
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


test("Order selector recovers from schedule lookup failure and confirms a legacy destination inside the modal", async ({ page }) => {
  const created = await ready(page);
  let fail = true;
  await page.route("**/api/delivery-schedules?*", route => fail ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "Fixture order lookup failure" }) }) : (async () => {
    const response = await route.fetch(); const body = await response.json();
    const rows = body.map((row: { id: number; version: number }) => row.id === created.id && row.version === 3 ? { ...row, shipping_latitude: null, shipping_longitude: null, latitude: null, longitude: null } : row);
    await route.fulfill({ response, json: rows });
  })());
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


test("One group row waits for all members then schedules every saved destination together", async ({ page }) => {
  const address = await json(page.request, "POST", "/orders/customers/1/addresses", {
    address_line: "Group second destination", barangay: "Test", city_municipality: "Manila", province: "Metro Manila", latitude: 14.7, longitude: 121.3,
  });
  const batch = await json(page.request, "POST", "/orders/batch", { customer_id: 1, payment_mode: "SEPARATE", orders: [order, { ...order, customer_address_id: address.id }, order] });
  const [first, second, pending] = batch.orders;
  expect(first.order_group_id).toBeTruthy(); expect(second.order_group_id).toBe(first.order_group_id);
  for (const member of [first, second]) {
    await json(page.request, "POST", `/orders/process/${member.id}?version=1`);
    await json(page.request, "POST", `/orders/delivery/${member.id}?version=2`);
  }
  await page.goto("/panel/delivery-schedules");
  const row = page.getByRole("row").filter({ hasText: first.product_number });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(first.order_group_number);
  await expect(row).toContainText("3 orders / 2 ready");
  const action = row.getByRole("button", { name: `Schedule group ${first.order_group_number}`, exact: true });
  await expect(action).toBeDisabled();
  const blocked = await page.request.get(`/api/orders/groups/${first.order_group_id}/ready?warehouse_id=1`);
  expect(blocked.status()).toBe(409);
  const partial = await page.request.post("/api/deliveries", { data: { order_ids: [first.id, second.id], scheduled_date: "2099-01-01", scheduled_time: "09:00", delivery_type: "INTERNAL", driver_id: 5, vehicle_id: 1, delivery_allowance: 0, fuel: 0, toll: 0 } });
  expect(partial.status()).toBe(409); expect(await partial.text()).toContain("All orders");
  await row.locator("summary").click();
  await expect(row.getByText("Group second destination", { exact: false })).toBeVisible();
  await json(page.request, "POST", `/orders/process/${pending.id}?version=1`);
  await json(page.request, "POST", `/orders/delivery/${pending.id}?version=2`);
  await page.reload();
  await expect(row).toContainText("3 orders / 3 ready");
  await expect(action).toBeEnabled();
  await action.click();
  const dialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Schedule delivery", exact: true }) });
  const summary = dialog.getByRole("complementary", { name: "Delivery run summary" });
  await expect(summary).toContainText(first.product_number); await expect(summary).toContainText(second.product_number);
  await expect(summary).toContainText(pending.product_number);
  await expect(summary).toContainText("Group second destination");
  await dialog.getByRole("button", { name: /^Continue to / }).click();
  await chooseDate(page, dialog); await dialog.locator("#scheduled_time").fill("23:55");
  await dialog.getByRole("button", { name: /^Continue to / }).click();
  await expect(dialog.getByRole("main")).toContainText(second.product_number);
  await dialog.getByRole("button", { name: `Move ${second.product_number} up`, exact: true }).click();
  await expect(dialog.getByRole("list", { name: "Delivery stop order" }).getByRole("listitem").first()).toContainText(second.product_number);
  await dialog.getByRole("button", { name: /^Continue to / }).click();
  await dialog.getByPlaceholder("Select driver...", { exact: true }).click();
  await page.getByRole("option").filter({ hasText: "Live Driver" }).click();
  await dialog.getByPlaceholder("Select vehicle...").click(); await page.getByRole("option").filter({ hasText: "LIVE-001" }).click();
  await dialog.getByRole("button", { name: /^Continue to / }).click();
  await dialog.getByRole("button", { name: /^Continue to / }).click();
  const responsePromise = page.waitForResponse(r => r.url().endsWith("/api/deliveries") && r.request().method() === "POST");
  await dialog.getByRole("button", { name: "Create delivery schedule", exact: true }).click();
  const response = await responsePromise; expect(response.status(), await response.text()).toBe(200);
  expect(response.request().postDataJSON().order_ids).toEqual([second.id, first.id, pending.id]);
  await expect(dialog).toHaveCount(0);
  const scheduledGroup = await page.request.get(`/api/orders/groups/${first.order_group_id}/ready?warehouse_id=1`);
  expect(scheduledGroup.status()).toBe(409);
  expect((await json(page.request, "GET", `/delivery-schedules?search=${first.order_group_number}`))).toHaveLength(0);
  const scheduled = await response.json();
  await json(page.request, "POST", "/deliveries/event", { delivery_id: scheduled.id, delivery_version: 1, event_type: "CANCELLED", reason: "Fixture cleanup" });
});

test("Schedule dialog keeps actions visible on mobile and supports adding a ready group once", async ({ page }) => {
  const batch = await json(page.request, "POST", "/orders/batch", { customer_id: 1, orders: [order, order] });
  for (const member of batch.orders) {
    await json(page.request, "POST", `/orders/process/${member.id}?version=1`);
    await json(page.request, "POST", `/orders/delivery/${member.id}?version=2`);
  }
  const dialog = await openSchedule(page);
  await dialog.getByRole("button", { name: "Add Order", exact: true }).click();
  const sub = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Add Order", exact: true }) });
  await sub.getByPlaceholder("Select order number...").click();
  await expect(page.getByRole("option").filter({ hasText: batch.orders[0].order_group_number })).toHaveCount(1);
  await page.getByRole("option").filter({ hasText: batch.orders[0].order_group_number }).click();
  await sub.getByRole("button", { name: "Add group", exact: true }).click();
  await expect(sub).toHaveCount(0);
  const summary = dialog.getByRole("complementary", { name: "Delivery run summary" });
  await expect(summary.getByRole("listitem")).toHaveCount(2);
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const audit = async () => {
    const violations = await dialog.evaluate(async element => {
      const result = await (window as unknown as { axe: { run: (element: Element, options: unknown) => Promise<AxeResults> } }).axe.run(element, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
      return result.violations.map(row => `${row.id}: ${JSON.stringify(row.nodes.map(node => node.target))}`);
    });
    expect(violations).toEqual([]);
  };
  await audit(); await dialog.screenshot({ path: "../../.tmp/schedule-desktop.png" });
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => {
      const bounds = await dialog.boundingBox();
      return !!bounds && bounds.x >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height;
    }).toBe(true);
    expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await expect(dialog.getByRole("button", { name: /^Continue to / })).toBeInViewport();
    await audit();
  }
  await dialog.screenshot({ path: "../../.tmp/schedule-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await page.waitForTimeout(300); // Wait for the theme color transition before checking contrast.
  await audit(); await dialog.screenshot({ path: "../../.tmp/schedule-dark.png" });
  await summary.getByRole("button", { name: `Remove group ${batch.orders[0].order_group_number} from delivery`, exact: true }).click();
  await expect(summary.getByRole("listitem")).toHaveCount(0);
});


test("Group scheduling recovers from lookup failure and keeps groups intact when the date capacity is insufficient", async ({ page }) => {
  const batch = await json(page.request, "POST", "/orders/batch", { customer_id: 1, orders: Array.from({ length: 6 }, () => order) });
  for (const member of batch.orders) {
    await json(page.request, "POST", `/orders/process/${member.id}?version=1`);
    await json(page.request, "POST", `/orders/delivery/${member.id}?version=2`);
  }
  let failed = false;
  await page.route("**/api/orders/groups/*/ready?*", route => {
    if (!failed) { failed = true; return route.fulfill({ status: 503, json: { message: "Order group lookup unavailable. Retry." } }); }
    return route.continue();
  });
  await page.goto("/panel/delivery-schedules");
  const action = page.getByRole("row").filter({ hasText: batch.orders[0].product_number }).getByRole("button", { name: `Schedule group ${batch.orders[0].order_group_number}`, exact: true });
  await action.click(); await expect(page.getByText("Order group lookup unavailable. Retry.", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(action).toBeEnabled();
  const retried = page.waitForResponse(response => response.url().includes(`/api/orders/groups/${batch.orders[0].order_group_id}/ready`));
  await action.click(); const retryResponse = await retried;
  expect(retryResponse.status(), await retryResponse.text()).toBe(200);
  const dialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Schedule delivery", exact: true }) });
  await expect(dialog).toBeVisible();
  const summary = dialog.getByRole("complementary", { name: "Delivery run summary" });
  await expect(summary.getByRole("listitem")).toHaveCount(6);
  await dialog.getByRole("button", { name: /^Continue to / }).click();
  await chooseDate(page, dialog); await dialog.locator("#scheduled_time").fill("23:54");
  await dialog.getByRole("button", { name: /^Continue to / }).click();
  await expect(dialog).toContainText("Groups must be scheduled together.");
  await summary.getByRole("button", { name: `Remove group ${batch.orders[0].order_group_number} from delivery`, exact: true }).click();
  await dialog.getByRole("button", { name: /^Continue to / }).click();
  await expect(dialog.getByRole("heading", { name: "Orders & stops", exact: true })).toBeVisible();
  await expect(summary.getByRole("listitem")).toHaveCount(0);
});
