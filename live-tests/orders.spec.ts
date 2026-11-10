import { expect, test, type Page } from "@playwright/test";
import type { AxeResults } from "axe-core";
import { browserLogin, json, order } from "./helpers";

test.use({ timezoneId: "America/Los_Angeles", actionTimeout: 15_000 });
test.setTimeout(90_000);
test.beforeEach(async ({ page }) => {
  await browserLogin(page);
});
async function findOrder(page: Page, number: string) {
  await page.goto("/panel/orders");
  await page.getByPlaceholder("Search orders...").fill(number);
  const row = page.getByRole("row").filter({ hasText: number });
  await expect(row).toBeVisible();
  return row;
}

async function openWizard(page: Page) {
  await page.goto("/panel/orders");
  await page.getByRole("button", { name: "Add Order", exact: true }).click();
  const main = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Create Order", exact: true }) });
  await main.getByPlaceholder("Select warehouse name...").click();
  await page.getByRole("option").filter({ hasText: "Live warehouse" }).click();
  await main.getByPlaceholder("Select customer name...").click();
  await page.getByRole("option").filter({ hasText: "Live Customer" }).click();
  await main.getByLabel("Saved shipping address", { exact: false }).click();
  await page.getByRole("option").filter({ hasText: "Fixture street" }).click();
  return main;
}

async function addItem(page: Page, quantity = 1) {
  const main = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Create Order", exact: true }) });
  await main.getByRole("button", { name: "Add Item", exact: true }).click();
  const item = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Add Item", exact: true }) });
  await item.getByPlaceholder("Select inventory name...").click();
  await page.getByRole("option").filter({ hasText: "LIVE-SKU" }).click();
  await item.getByLabel("Quantity", { exact: false }).fill(String(quantity));
  await item.getByRole("button", { name: "Add Item", exact: true }).click();
  await expect(item).toHaveCount(0);
}

test("Orders View, Edit, Process, Ready for Delivery and Invoice PDF work through rendered controls", async ({ page }) => {
  const created = await json(page.request, "POST", "/orders", { ...order, notes: "Original order note" });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const row = await findOrder(page, created.product_number);
  await row.getByRole("button", { name: "View order", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Live variant", { exact: true })).toBeVisible();
  await expect(dialog).toContainText("24.68");
  await dialog.getByRole("button", { name: "Close", exact: true }).first().click();
  await row.getByRole("button", { name: "Edit order", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Order notes", { exact: true })).toHaveValue("Original order note");
  await dialog.getByLabel("Order notes", { exact: true }).fill("Edited through browser");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await json(page.request, "GET", `/orders/${created.id}`)).notes).toBe("Edited through browser");
  await row.getByRole("button", { name: "Process order", exact: true }).click();
  await dialog.getByRole("button", { name: "Process Order", exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(row).toContainText("Processing");
  await row.getByRole("button", { name: "Mark ready for delivery", exact: true }).click();
  await dialog.getByRole("button", { name: "Mark ready for delivery", exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(row).toContainText("Scheduling");
  await row.getByRole("button", { name: "Invoice", exact: true }).click();
  await expect(dialog.getByText("24.68").first()).toBeVisible();
  const pending = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Generate PDF", exact: true }).click();
  const download = await pending; expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  expect(await download.failure()).toBeNull();
  expect(errors).toEqual([]);
});

test("Orders Cancel releases reserved stock and stale edits retain notes", async ({ page }) => {
  const created = await json(page.request, "POST", "/orders", order);
  const row = await findOrder(page, created.product_number);
  await row.getByRole("button", { name: "Edit order", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const notes = dialog.getByLabel("Order notes", { exact: true });
  await expect(notes).toBeEnabled(); await notes.fill("Keep this draft");
  await json(page.request, "PUT", `/orders/${created.id}`, { version: 1, notes: "Another operator" });
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByRole("alert").first()).toBeVisible(); await expect(notes).toHaveValue("Keep this draft");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await row.getByRole("button", { name: "Cancel order", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Cancel Order", exact: true })).toBeEnabled();
  const before = await json(page.request, "GET", "/inventory?limit=10");
  await dialog.getByRole("button", { name: "Cancel Order", exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(row).toContainText("Cancelled");
  const after = await json(page.request, "GET", "/inventory?limit=10");
  expect(after[0].reserved).toBe(before[0].reserved - 2); expect(after[0].quantity).toBe(before[0].quantity);
});

test("Orders create wizard adds, edits, deletes draft items and checks out with a saved address", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/panel/orders");
  await page.getByRole("button", { name: "Add Order", exact: true }).click();
  const main = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Create Order", exact: true }) });
  await main.getByPlaceholder("Select warehouse name...").click();
  await page.getByRole("option").filter({ hasText: "Live warehouse" }).click();
  await main.getByPlaceholder("Select customer name...").click();
  await page.getByRole("option").filter({ hasText: "Live Customer" }).click();
  await main.getByRole("button", { name: /^Continue to / }).click();
  await main.getByRole("button", { name: "Add Item", exact: true }).click();
  let itemDialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Add Item", exact: true }) });
  await itemDialog.getByPlaceholder("Select inventory name...").click();
  await page.getByRole("option").filter({ hasText: "LIVE-SKU" }).click();
  await itemDialog.getByLabel("Quantity", { exact: false }).fill("2");
  await itemDialog.getByRole("button", { name: "Add Item", exact: true }).click();
  await expect(itemDialog).toHaveCount(0);
  await main.getByRole("button", { name: "Edit item LIVE-SKU", exact: true }).click();
  itemDialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Edit Item", exact: true }) });
  await itemDialog.getByLabel("Quantity", { exact: false }).fill("3");
  await itemDialog.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(itemDialog).toHaveCount(0); await expect(main).toContainText("37.02");
  await main.getByRole("button", { name: "Remove item LIVE-SKU", exact: true }).click();
  await page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Delete Item", exact: true }) }).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(main.getByText("LIVE-SKU", { exact: true })).toHaveCount(0);
  await main.getByRole("button", { name: "Add Item", exact: true }).click();
  itemDialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Add Item", exact: true }) });
  await itemDialog.getByPlaceholder("Select inventory name...").click(); await page.getByRole("option").filter({ hasText: "LIVE-SKU" }).click();
  await itemDialog.getByRole("button", { name: "Add Item", exact: true }).click();
  await main.getByRole("button", { name: /^Continue to / }).click();
  await main.getByLabel("Payment Method", { exact: false }).click();
  await page.getByRole("option", { name: "Cash", exact: true }).click();
  await main.getByLabel("Amount Paid", { exact: false }).fill("0");
  await main.getByRole("button", { name: /^Continue to / }).click();
  await expect(main).toContainText("Fixture street");
  const posted = page.waitForResponse(response => new URL(response.url()).pathname === "/api/orders" && response.request().method() === "POST");
  await main.getByRole("button", { name: "Create order", exact: true }).click();
  const response = await posted; expect(response.status(), await response.text()).toBe(200);
  await expect(main).toHaveCount(0); expect(errors).toEqual([]);
});

test("Orders column sorting and newest/oldest control return successful server results", async ({ page }) => {
  await page.goto("/panel/orders");
  for (const name of ["Order Number", "Warehouse", "Customer", "Items", "Total"]) {
    const fetched = page.waitForResponse(response => new URL(response.url()).pathname === "/api/orders" && response.url().includes("sort_by="));
    await page.getByRole("columnheader", { name, exact: true }).getByRole("button").click();
    expect((await fetched).status()).toBe(200);
  }
  await page.getByRole("button", { name: "Newest first", exact: true }).click();
  await page.getByRole("button", { name: "Newest first", exact: true }).click();
  await expect(page.getByRole("button", { name: "Oldest first", exact: true })).toBeVisible();
});

test("Orders save a second address and preserve it after a failed checkout while another order stays active", async ({ page }) => {
  const existing = await json(page.request, "POST", "/orders", order);
  const original = await json(page.request, "GET", `/orders/${existing.id}`);
  const main = await openWizard(page);
  await main.getByRole("button", { name: "Save another shipping address", exact: true }).click();
  for (const [label, value] of [["Street address", "Second saved destination"], ["Barangay", "Second barangay"], ["City / municipality", "Second city"], ["Province", "Fixture province"], ["Latitude", "14.7"], ["Longitude", "121.3"]]) {
    await main.getByLabel(label, { exact: true }).fill(value);
  }
  const saved = page.waitForResponse(response => response.url().includes("/addresses") && response.request().method() === "POST");
  await main.getByRole("button", { name: "Save and select address", exact: true }).click();
  const savedResponse = await saved;
  expect(savedResponse.status(), await savedResponse.text()).toBe(200);
  const address = await savedResponse.json();
  await expect(main.getByRole("button", { name: "Save another shipping address", exact: true })).toBeVisible();
  await expect(main.getByLabel("Saved shipping address", { exact: false })).toContainText("Second saved destination");
  await main.getByRole("button", { name: /^Continue to / }).click();
  await addItem(page);
  await main.getByRole("button", { name: /^Continue to / }).click();
  await main.getByLabel("Payment Method", { exact: false }).click();
  await page.getByRole("option", { name: "Cash", exact: true }).click();
  await main.getByLabel("Amount Paid", { exact: false }).fill("0");
  await main.getByRole("button", { name: /^Continue to / }).click();
  await expect(main).toContainText("Second saved destination");
  await page.route("**/api/orders", route => route.request().method() === "POST" ? route.fulfill({ status: 503, json: { message: "Fixture checkout unavailable" } }) : route.continue());
  await main.getByRole("button", { name: "Create order", exact: true }).click();
  await expect(main.getByRole("alert")).toContainText("Fixture checkout unavailable");
  await expect(main).toContainText("Second saved destination");
  await page.unroute("**/api/orders");
  const posted = page.waitForResponse(response => new URL(response.url()).pathname === "/api/orders" && response.request().method() === "POST");
  await main.getByRole("button", { name: "Create order", exact: true }).click();
  const response = await posted; expect(response.status(), await response.text()).toBe(200);
  const created = await response.json();
  expect(await json(page.request, "GET", `/orders/${created.id}`)).toMatchObject({ customer_address_id: address.id, shipping_latitude: "14.700000", shipping_longitude: "121.300000" });
  expect(await json(page.request, "GET", `/orders/${existing.id}`)).toMatchObject({ shipping_address: original.shipping_address, shipping_latitude: original.shipping_latitude, status: "PENDING" });
  await expect(main).toHaveCount(0);
});

test("Orders allow another active order and changed stock blocks progression until retried", async ({ page }) => {
  await page.route("**/api/orders/eligibility/*", route => route.fulfill({ json: { eligible: true, activeOrderCount: 100, maxActiveOrders: null, message: null } }));
  const main = await openWizard(page);
  await expect(main).toContainText("Active orders: 100");
  await expect(main.getByRole("button", { name: /^Continue to / })).toBeEnabled();
  await main.getByRole("button", { name: /^Continue to / }).click();
  await addItem(page);
  await page.route("**/api/inventory/details?*", async route => {
    const response = await route.fetch();
    const rows = await response.json();
    await route.fulfill({ json: rows.map((row: object) => ({ ...row, quantity: 0 })) });
  });
  await main.getByRole("button", { name: /^Continue to / }).click();
  await expect(main.getByRole("alert")).toContainText("Stock changed for LIVE-SKU");
  await expect(main.getByText("LIVE-SKU", { exact: true })).toBeVisible();
  await page.unroute("**/api/inventory/details?*");
  await main.getByRole("button", { name: /^Continue to / }).click();
  await expect(main.getByLabel("Amount Paid", { exact: false })).toBeVisible();
});

test("Orders searched results paginate and boundary controls stay disabled", async ({ page }) => {
  for (let i = 0; i < 12; i++) await json(page.request, "POST", "/orders", order);
  await page.goto("/panel/orders");
  const searched = page.waitForResponse(response => new URL(response.url()).pathname === "/api/orders" && new URL(response.url()).searchParams.get("search") === "ORD-");
  await page.getByPlaceholder("Search orders...").fill("ORD-");
  const first = (await (await searched).json())[0].product_number as string;
  const nav = page.getByRole("navigation", { name: "Orders pagination", exact: true });
  await expect(nav.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
  const firstCell = page.getByRole("row").nth(1).getByRole("cell").first();
  await expect(firstCell).toHaveText(first);
  await nav.getByRole("button", { name: "Next", exact: true }).click();
  await expect(firstCell).not.toHaveText(first);
  await nav.getByRole("button", { name: "First", exact: true }).click();
  await expect(firstCell).toHaveText(first);
  await nav.getByRole("button", { name: "Last", exact: true }).click();
  await expect(nav.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await expect(nav.getByRole("button", { name: "Last", exact: true })).toBeDisabled();
  await nav.getByRole("button", { name: "First", exact: true }).click();
  await expect(firstCell).toHaveText(first);
});

test("Orders scheduled rows expose invoices and delivery-method filters match actual assignments", async ({ page }) => {
  const created = await json(page.request, "POST", "/orders", order);
  await json(page.request, "POST", `/orders/process/${created.id}?version=1`);
  await json(page.request, "POST", `/orders/delivery/${created.id}?version=2`);
  await json(page.request, "POST", "/deliveries", { order_ids: [created.id], scheduled_date: "2099-01-01", scheduled_time: "09:00", delivery_type: "INTERNAL", driver_id: 5, vehicle_id: 1, delivery_allowance: 0, fuel: 0, toll: 0 });
  const row = await findOrder(page, created.product_number);
  await expect(row).toContainText("Scheduled");
  await expect(row.getByRole("button", { name: "Invoice", exact: true })).toBeVisible();
  await expect(row.getByRole("button", { name: "Cancel order", exact: true })).toHaveCount(0);
  const method = page.getByRole("combobox", { name: "Filter by delivery method", exact: true });
  await method.click(); await page.getByRole("option", { name: "Company delivery", exact: true }).click();
  await expect(row).toBeVisible();
  await method.click(); await page.getByRole("option", { name: "Lalamove", exact: true }).click();
  await expect(row).toHaveCount(0);
});

async function prepareCurrentOrder(page: Page, quantity = 1, paid = 0) {
  const main = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Create Order", exact: true }) });
  await main.getByRole("button", { name: /^Continue to / }).click();
  await addItem(page, quantity);
  await main.getByRole("button", { name: /^Continue to / }).click();
  await main.getByLabel("Payment Method", { exact: false }).click();
  await page.getByRole("option", { name: "Cash", exact: true }).click();
  await main.getByLabel("Amount Paid", { exact: false }).fill(String(paid));
  await main.getByRole("button", { name: /^Continue to / }).click();
  return main;
}

async function saveBatchAddress(page: Page, address_line: string) {
  return json(page.request, "POST", "/orders/customers/1/addresses", {
    address_line, barangay: "Batch barangay", city_municipality: "Batch city", province: "Fixture province", latitude: 14.7, longitude: 121.3,
  });
}

test("Batch orders select one customer, preserve editable drafts and submit every destination and payment together", async ({ page }) => {
  const address = await saveBatchAddress(page, "Batch destination two");
  const main = await openWizard(page);
  await main.getByLabel("Notes (optional)").fill("First batch order");
  await prepareCurrentOrder(page, 1, 5);
  await main.getByRole("button", { name: "Add another order", exact: true }).click();
  await expect(main.getByPlaceholder("Select customer name...")).toBeDisabled();
  await expect(main.getByPlaceholder("Select customer name...")).toHaveValue("Live Customer");
  await main.getByLabel("Saved shipping address", { exact: false }).click();
  await page.getByRole("option").filter({ hasText: "Batch destination two" }).click();
  await main.getByLabel("Notes (optional)").fill("Second batch order");
  await prepareCurrentOrder(page, 2, 0);
  const summary = main.getByRole("region", { name: "Orders in this submission" });
  await expect(summary).toContainText("2 orders for this customer");
  await expect(summary).toContainText("Batch destination two");
  await expect(summary).toContainText("Fixture street");

  await main.getByRole("button", { name: "Edit order 1", exact: true }).click();
  await expect(main.getByLabel("Notes (optional)")).toHaveValue("First batch order");
  await main.getByLabel("Notes (optional)").fill("Edited first batch order");
  await main.getByRole("button", { name: /^Continue to / }).click();
  await main.getByRole("button", { name: /^Continue to / }).click();
  await expect(main.getByLabel("Amount Paid", { exact: false })).toHaveValue("5");
  await main.getByRole("button", { name: /^Continue to / }).click();
  await main.getByRole("button", { name: "Edit order 2", exact: true }).click();
  await expect(main.getByLabel("Notes (optional)")).toHaveValue("Second batch order");
  await main.getByRole("button", { name: /^Continue to / }).click();
  await main.getByRole("button", { name: /^Continue to / }).click();
  await expect(main.getByLabel("Amount Paid", { exact: false })).toHaveValue("0");
  await main.getByRole("button", { name: /^Continue to / }).click();

  await page.route("**/api/orders/batch", route => route.fulfill({ status: 503, json: { message: "Fixture batch unavailable" } }));
  await main.getByRole("button", { name: "Create all 2 orders", exact: true }).click();
  await expect(main.getByRole("alert")).toContainText("Fixture batch unavailable");
  await expect(summary).toContainText("2 orders for this customer");
  await page.unroute("**/api/orders/batch");
  const posted = page.waitForResponse(response => new URL(response.url()).pathname === "/api/orders/batch" && response.request().method() === "POST");
  await main.getByRole("button", { name: "Create all 2 orders", exact: true }).click();
  const response = await posted;
  expect(response.status(), await response.text()).toBe(200);
  const payload = response.request().postDataJSON();
  expect(payload.customer_id).toBe(1);
  expect(payload.orders).toHaveLength(2);
  expect(payload.orders[0]).not.toHaveProperty("customer_id");
  const created = (await response.json()).orders;
  expect(created).toHaveLength(2);
  expect(await json(page.request, "GET", `/orders/${created[0].id}`)).toMatchObject({ notes: "Edited first batch order", amount_paid: 5, customer_address_id: 1, items: [{ quantity: 1 }] });
  expect(await json(page.request, "GET", `/orders/${created[1].id}`)).toMatchObject({ notes: "Second batch order", amount_paid: 0, customer_address_id: address.id, items: [{ quantity: 2 }] });
  await expect(main).toHaveCount(0);
});

test("Batch orders remove a draft and still support creating one order", async ({ page }) => {
  const address = await saveBatchAddress(page, "Batch retained destination");
  const before = await json(page.request, "GET", "/orders?limit=100");
  const main = await openWizard(page);
  await prepareCurrentOrder(page);
  await main.getByRole("button", { name: "Add another order", exact: true }).click();
  await main.getByLabel("Saved shipping address", { exact: false }).click();
  await page.getByRole("option").filter({ hasText: "Batch retained destination" }).click();
  await prepareCurrentOrder(page, 3);
  await main.getByRole("button", { name: "Remove order 1", exact: true }).click();
  await expect(main.getByRole("region", { name: "Orders in this submission" })).toContainText("Your order");
  await expect(main.getByRole("button", { name: "Edit order 2", exact: true })).toHaveCount(0);
  await expect(main.getByLabel("Saved shipping address", { exact: false })).toContainText("Batch retained destination");
  await main.getByRole("button", { name: /^Continue to / }).click();
  await main.getByRole("button", { name: /^Continue to / }).click();
  await main.getByRole("button", { name: /^Continue to / }).click();
  const posted = page.waitForResponse(response => new URL(response.url()).pathname === "/api/orders" && response.request().method() === "POST");
  await main.getByRole("button", { name: "Create order", exact: true }).click();
  const response = await posted;
  expect(response.status(), await response.text()).toBe(200);
  const created = await response.json();
  expect(await json(page.request, "GET", `/orders/${created.id}`)).toMatchObject({ customer_address_id: address.id, items: [{ quantity: 3 }] });
  expect((await json(page.request, "GET", "/orders?limit=100")).length).toBe(before.length + 1);
});

test("Batch orders check combined stock before allowing the next order to proceed", async ({ page }) => {
  const main = await openWizard(page);
  await prepareCurrentOrder(page, 6000);
  await main.getByRole("button", { name: "Add another order", exact: true }).click();
  await main.getByLabel("Saved shipping address", { exact: false }).click();
  await page.getByRole("option").filter({ hasText: "Fixture street" }).click();
  await main.getByRole("button", { name: /^Continue to / }).click();
  await addItem(page, 6000);
  await main.getByRole("button", { name: /^Continue to / }).click();
  await expect(main.getByRole("alert")).toContainText("stock is shared across all orders in this submission");
  await expect(main.getByRole("button", { name: "Edit item LIVE-SKU", exact: true })).toBeVisible();
  await expect(main.getByLabel("Amount Paid", { exact: false })).toHaveCount(0);
});

async function prepareTwoPaymentOrders(page: Page) {
  const address = await saveBatchAddress(page, "Combined payment destination");
  const main = await openWizard(page);
  await prepareCurrentOrder(page, 1, 5);
  await main.getByRole("button", { name: "Add another order", exact: true }).click();
  await main.getByLabel("Saved shipping address", { exact: false }).click();
  await page.getByRole("option").filter({ hasText: "Combined payment destination" }).last().click();
  await prepareCurrentOrder(page, 2, 0);
  return { main, address };
}

async function choosePaymentMode(page: Page, label: string) {
  const main = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Create Order", exact: true }) });
  const edit = main.getByRole("button", { name: "Edit payment", exact: true });
  if (await edit.isVisible()) await edit.click();
  await main.getByRole("radio", { name: label, exact: true }).check();
}

test("Combined payments preserve separate entries, allocate one receipt, and show the source on orders and invoices", async ({ page }) => {
  const { main, address } = await prepareTwoPaymentOrders(page);
  await choosePaymentMode(page, "One payment for all orders");
  await main.getByLabel("Combined payment method", { exact: true }).click();
  await page.getByRole("option", { name: "Bank transfer", exact: true }).click();
  await main.getByLabel("Combined payment type", { exact: true }).fill("BDO");
  await page.getByRole("option", { name: "BDO", exact: true }).click();
  await main.getByLabel("Combined amount received", { exact: true }).fill("10");
  await main.getByLabel("Payment reference (optional)", { exact: true }).fill("COMBINED-BROWSER");
  const allocations = main.getByRole("list", { name: "Combined payment allocations" });
  await expect(allocations).toContainText("3.33");
  await expect(allocations).toContainText("6.67");
  await choosePaymentMode(page, "Separate payments per order");
  await main.getByRole("button", { name: "Edit order 1", exact: true }).click();
  await main.getByRole("button", { name: /^Continue to / }).click();
  await main.getByRole("button", { name: /^Continue to / }).click();
  await expect(main.getByLabel("Amount Paid", { exact: false })).toHaveValue("5");
  await main.getByRole("button", { name: /^Continue to / }).click();
  await choosePaymentMode(page, "One payment for all orders");
  await expect(main.getByLabel("Combined amount received", { exact: true })).toHaveValue("10");
  await main.getByRole("button", { name: /^Continue to / }).click();
  const posted = page.waitForResponse(response => new URL(response.url()).pathname === "/api/orders/batch" && response.request().method() === "POST");
  await main.getByRole("button", { name: "Create all 2 orders", exact: true }).click();
  const response = await posted;
  expect(response.status(), await response.text()).toBe(200);
  const payload = response.request().postDataJSON();
  expect(payload).toMatchObject({ payment_mode: "COMBINED", payment: { payment_method: "BANK_TRANSFER", payment_type: "BDO", amount_paid: 10 } });
  expect(payload.orders[0]).not.toHaveProperty("amount_paid");
  const created = (await response.json()).orders;
  const first = await json(page.request, "GET", `/orders/${created[0].id}`);
  const second = await json(page.request, "GET", `/orders/${created[1].id}`);
  expect(first).toMatchObject({ amount_paid: 3.33, combined_payment: { allocated_amount: 3.33, amount: 10, reference_number: "COMBINED-BROWSER" } });
  expect(second).toMatchObject({ customer_address_id: address.id, amount_paid: 6.67, combined_payment: { payment_number: first.combined_payment.payment_number, allocated_amount: 6.67 } });
  await expect(main).toHaveCount(0);
  await json(page.request, "POST", `/orders/process/${created[0].id}?version=1`);
  await json(page.request, "POST", `/orders/delivery/${created[0].id}?version=2`);
  const row = await findOrder(page, created[0].product_number);
  await row.getByRole("button", { name: "Invoice", exact: true }).click();
  const invoice = page.getByRole("dialog");
  await expect(invoice).toContainText(first.combined_payment.payment_number);
  await expect(invoice).toContainText("Original allocation");
  await expect(invoice).toContainText("COMBINED-BROWSER");
  const pending = page.waitForEvent("download");
  await invoice.getByRole("button", { name: "Generate PDF", exact: true }).click();
  expect(await (await pending).failure()).toBeNull();
  await page.goto("/panel/payments");
  await page.getByPlaceholder("Search payments...").fill(first.combined_payment.payment_number);
  const records = page.getByRole("row").filter({ hasText: first.combined_payment.payment_number });
  await expect(records).toHaveCount(2);
  await records.first().getByRole("button", { name: "Details", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Original combined receipt");
});

test("Combined payments reject overpayment and can pay all orders in full", async ({ page }) => {
  const { main } = await prepareTwoPaymentOrders(page);
  await choosePaymentMode(page, "One payment for all orders");
  await main.getByLabel("Combined amount received", { exact: true }).fill("100");
  await main.getByRole("button", { name: /^Continue to / }).click();
  let postedCount = 0;
  page.on("request", request => { if (new URL(request.url()).pathname === "/api/orders/batch" && request.method() === "POST") postedCount++; });
  await main.getByRole("button", { name: "Create all 2 orders", exact: true }).click();
  await expect(main.getByRole("alert")).toContainText("cannot exceed");
  expect(postedCount).toBe(0);
  await main.getByRole("button", { name: "Use full total", exact: true }).click();
  await expect(main.getByLabel("Combined amount received", { exact: true })).toHaveValue("37.02");
  await main.getByRole("button", { name: /^Continue to / }).click();
  const posted = page.waitForResponse(response => new URL(response.url()).pathname === "/api/orders/batch" && response.request().method() === "POST");
  await main.getByRole("button", { name: "Create all 2 orders", exact: true }).click();
  const response = await posted;
  expect(response.status(), await response.text()).toBe(200);
  const created = (await response.json()).orders;
  expect(await json(page.request, "GET", `/orders/${created[0].id}`)).toMatchObject({ amount_paid: 12.34, payment_arrangement: "FULLY_PAID" });
  expect(await json(page.request, "GET", `/orders/${created[1].id}`)).toMatchObject({ amount_paid: 24.68, payment_arrangement: "FULLY_PAID" });
});


test("Order dialog redesign keeps navigation visible and shows submission payments only for multiple orders", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  const main = await openWizard(page);
  await expect(main.getByRole("heading", { name: "Customer & destination", exact: true })).toBeVisible();
  await expect(main.getByRole("group", { name: "Payment for this submission", exact: true })).toHaveCount(0);
  await expect(main.getByRole("button", { name: /^Continue to / })).toBeInViewport();
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const auditDialog = async () => {
    const violations = await main.evaluate(async element => {
      const audit = await (window as unknown as { axe: { run: (element: Element, options: unknown) => Promise<AxeResults> } }).axe.run(element, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
      return audit.violations.map(violation => `${violation.id}: ${JSON.stringify(violation.nodes.map(node => node.target))}`);
    });
    expect(violations).toEqual([]);
  };
  await auditDialog();
  await main.screenshot({ path: "../../.tmp/create-order-desktop.png" });
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }]) {
    await page.setViewportSize(viewport);
    await expect.poll(async () => {
      const bounds = await main.boundingBox();
      return !!bounds && bounds.x >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height;
    }).toBe(true);
    const bounds = await main.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    expect(await main.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await expect(main.getByRole("button", { name: /^Continue to / })).toBeInViewport();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await main.screenshot({ path: "../../.tmp/create-order-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await main.screenshot({ path: "../../.tmp/create-order-dark.png" });
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await main.getByRole("button", { name: /^Continue to / }).click();
  await addItem(page);
  await main.getByRole("button", { name: /^Continue to / }).click();
  await expect(main.getByRole("group", { name: "Payment for this submission", exact: true })).toHaveCount(0);
  await expect(main.getByLabel("Amount Paid", { exact: false })).toBeVisible();
  await main.getByLabel("Payment Method", { exact: false }).click();
  await page.getByRole("option", { name: "Cash", exact: true }).click();
  await main.getByRole("button", { name: /^Continue to / }).click();
  await main.getByRole("button", { name: "Add another order", exact: true }).click();
  await main.getByLabel("Saved shipping address", { exact: false }).click();
  await page.getByRole("option").filter({ hasText: "Fixture street" }).click();
  await prepareCurrentOrder(page);
  await choosePaymentMode(page, "One payment for all orders");
  await expect(main.getByRole("group", { name: "Payment for this submission", exact: true })).toBeVisible();
  await main.getByLabel("Combined amount received", { exact: true }).fill("10");
  await expect(main.getByRole("list", { name: "Combined payment allocations" })).toBeVisible();
  await auditDialog();
  await main.screenshot({ path: "../../.tmp/create-order-multiple-payment.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await main.getByRole("list", { name: "Combined payment allocations" }).scrollIntoViewIfNeeded();
  await expect(main.getByRole("button", { name: /^Continue to / })).toBeInViewport();
  expect(await main.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await main.screenshot({ path: "../../.tmp/create-order-mobile-payment.png" });
  await main.getByRole("button", { name: "Remove order 1", exact: true }).click();
  await main.getByRole("button", { name: /^Continue to / }).click();
  await main.getByRole("button", { name: /^Continue to / }).click();
  await expect(main.getByRole("group", { name: "Payment for this submission", exact: true })).toHaveCount(0);
  await expect(main.getByLabel("Combined amount received", { exact: true })).toHaveCount(0);
  await expect(main.getByLabel("Amount Paid", { exact: false })).toBeVisible();
});


test("Walk-in vehicle delivery collects guest details and sends a large paid sale to scheduling", async ({ page }) => {
  await page.goto("/panel/orders?walkin=true");
  const dialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Walk-in Counter Sale" }) });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radio", { name: "Take away now", exact: true })).toBeChecked();
  await dialog.getByRole("button", { name: "Add", exact: true }).first().click();
  await dialog.getByRole("spinbutton", { name: "Quantity for LIVE-SKU", exact: true }).fill("100");
  await expect(dialog).toContainText("100 total units");
  await dialog.getByRole("radio", { name: "Company vehicle delivery", exact: true }).check();
  await expect(dialog.locator("#walkin-name")).toHaveCount(0);
  await expect(dialog.locator("#walkin-phone")).toHaveCount(0);
  await dialog.getByLabel("Recipient name", { exact: false }).fill("Browser Guest");
  await dialog.locator("#delivery-shipping_phone").fill("09171234567");
  await dialog.getByLabel("Delivery address", { exact: false }).fill("100 Browser Customer Street");
  await dialog.getByRole("radio", { name: "Take away now", exact: true }).check();
  await expect(dialog.locator("#walkin-name")).toHaveValue("Browser Guest");
  await expect(dialog.locator("#walkin-phone")).toHaveValue("09171234567");
  await dialog.getByRole("radio", { name: "Company vehicle delivery", exact: true }).check();
  await expect(dialog.getByLabel("Delivery address", { exact: false })).toHaveValue("100 Browser Customer Street");
  await dialog.getByRole("button", { name: "Walk-in Guest", exact: true }).click();
  await expect(dialog.getByLabel("Recipient name", { exact: false })).toHaveValue("Browser Guest");
  await dialog.getByLabel("Latitude", { exact: false }).fill("14.6");
  await dialog.getByLabel("Longitude", { exact: false }).fill("121.2");
  await dialog.evaluate(element => { element.scrollTop = 0; });
  await dialog.screenshot({ path: "../../.tmp/walk-in-delivery-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => dialog.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await dialog.screenshot({ path: "../../.tmp/walk-in-delivery-mobile.png" });
  await page.setViewportSize({ width: 1280, height: 900 });
  let interrupted = false;
  await page.route("**/api/orders/walk-in", async route => {
    if (!interrupted) {
      interrupted = true;
      const committed = await route.fetch();
      expect(committed.status()).toBe(200);
      await route.abort(); // Simulate losing the response after checkout committed.
    } else await route.continue();
  });
  const resultPromise = page.waitForResponse(response => response.url().endsWith("/api/orders/walk-in") && response.request().method() === "POST");
  await dialog.getByRole("button", { name: /^Pay and send to scheduling/ }).click();
  await expect(dialog.getByRole("radio", { name: "Company vehicle delivery", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: /^Retry checkout/ }).click();
  const response = await resultPromise;
  expect(response.status(), await response.text()).toBe(200);
  const sale = await response.json();
  expect(sale).toMatchObject({ customer_name: "Browser Guest", status: "SCHEDULING", sales_channel: "WALK_IN", delivery_type: "INTERNAL", total: 1234 });
  expect(response.request().postDataJSON()).toMatchObject({ fulfillment: "DELIVERY", shipping_phone: "09171234567", items: [{ inventory_id: 1, quantity: 100 }] });
  const paidDialog = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: /Paid - awaiting delivery scheduling/ }) });
  await expect(paidDialog).toBeVisible();
  await paidDialog.getByRole("link", { name: "Open delivery scheduling" }).click();
  await expect(page).toHaveURL(/delivery-schedules/);
  await expect(page.getByRole("row").filter({ hasText: sale.product_number })).toContainText("Browser Guest");
  const stock = await json(page.request, "GET", "/inventory?page=0&limit=10&warehouse_id=1");
  expect(stock.find((item: { id: number }) => item.id === 1)).toMatchObject({ quantity: 10000, reserved: 100 });
});
