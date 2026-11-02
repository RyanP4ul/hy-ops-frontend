import { expect, test, type Page } from "@playwright/test";
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
  return main;
}

async function addItem(page: Page) {
  const main = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Create Order", exact: true }) });
  await main.getByRole("button", { name: "Add Item", exact: true }).click();
  const item = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Add Item", exact: true }) });
  await item.getByPlaceholder("Select inventory name...").click();
  await page.getByRole("option").filter({ hasText: "LIVE-SKU" }).click();
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
  await main.getByRole("button", { name: "Next", exact: true }).click();
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
  await main.getByRole("button", { name: "Next", exact: true }).click();
  await main.getByLabel("Amount Paid", { exact: false }).fill("0");
  await main.getByRole("button", { name: "Next", exact: true }).click();
  await expect(main).toContainText("Fixture street");
  const posted = page.waitForResponse(response => new URL(response.url()).pathname === "/api/orders" && response.request().method() === "POST");
  await main.getByRole("button", { name: "Create Order", exact: true }).click();
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

test("Orders manual shipping and payment validation preserve the draft after a failed checkout", async ({ page }) => {
  const main = await openWizard(page);
  await main.getByRole("radio", { name: "Enter a different address", exact: true }).check();
  await main.getByLabel("Shipping Recipient", { exact: false }).fill("Manual recipient");
  await main.getByLabel("Shipping Phone", { exact: false }).fill("09000000001");
  await main.getByLabel("Shipping Address", { exact: false }).fill("Manual destination, Fixture City");
  await main.getByRole("button", { name: "Next", exact: true }).click();
  await addItem(page);
  await main.getByRole("button", { name: "Next", exact: true }).click();
  await main.getByLabel("Amount Paid", { exact: false }).fill("100");
  await main.getByRole("button", { name: "Next", exact: true }).click();
  await expect(main.getByText(/Amount must match the payment arrangement/)).toBeVisible();
  await main.getByLabel("Amount Paid", { exact: false }).fill("0");
  await main.getByRole("button", { name: "Next", exact: true }).click();
  await expect(main).toContainText("Manual destination, Fixture City");
  await page.route("**/api/orders", route => route.request().method() === "POST" ? route.fulfill({ status: 503, json: { message: "Fixture checkout unavailable" } }) : route.continue());
  await main.getByRole("button", { name: "Create Order", exact: true }).click();
  await expect(main.getByRole("alert")).toContainText("Fixture checkout unavailable");
  await expect(main).toContainText("Manual recipient");
  await page.unroute("**/api/orders");
  await main.getByRole("button", { name: "Back", exact: true }).click();
  await expect(main.getByLabel("Amount Paid", { exact: false })).toHaveValue("0");
  await main.getByRole("button", { name: "Next", exact: true }).click();
  const posted = page.waitForResponse(response => new URL(response.url()).pathname === "/api/orders" && response.request().method() === "POST");
  await main.getByRole("button", { name: "Create Order", exact: true }).click();
  const response = await posted; expect(response.status(), await response.text()).toBe(200);
  const created = await response.json();
  expect(await json(page.request, "GET", `/orders/${created.id}`)).toMatchObject({ shipping_recipient: "Manual recipient", shipping_address: "Manual destination, Fixture City" });
  await expect(main).toHaveCount(0);
});

test("Orders customer limit and changed stock block progression and can be retried", async ({ page }) => {
  await page.route("**/api/orders/eligibility/*", route => route.fulfill({ json: { eligible: false, activeOrderCount: 100, maxActiveOrders: 100, message: "Fixture customer order limit reached" } }));
  const main = await openWizard(page);
  await expect(main.getByText("Fixture customer order limit reached", { exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
  await page.unroute("**/api/orders/eligibility/*");
  await main.getByRole("button", { name: "Check eligibility again", exact: true }).click();
  await main.getByRole("button", { name: "Next", exact: true }).click();
  await addItem(page);
  await page.route("**/api/inventory/details?*", async route => {
    const response = await route.fetch();
    const rows = await response.json();
    await route.fulfill({ json: rows.map((row: object) => ({ ...row, quantity: 0 })) });
  });
  await main.getByRole("button", { name: "Next", exact: true }).click();
  await expect(main.getByRole("alert")).toContainText("Stock changed for LIVE-SKU");
  await expect(main.getByText("LIVE-SKU", { exact: true })).toBeVisible();
  await page.unroute("**/api/inventory/details?*");
  await main.getByRole("button", { name: "Next", exact: true }).click();
  await expect(main.getByLabel("Amount Paid", { exact: false })).toBeVisible();
});

test("Orders searched results paginate and boundary controls stay disabled", async ({ page }) => {
  for (let i = 0; i < 12; i++) await json(page.request, "POST", "/orders", order);
  await page.goto("/panel/orders");
  await page.getByPlaceholder("Search orders...").fill("ORD-");
  const nav = page.getByRole("navigation", { name: "Orders pagination", exact: true });
  await expect(nav.getByRole("button", { name: "Previous", exact: true })).toBeDisabled();
  const firstCell = page.getByRole("row").nth(1).getByRole("cell").first();
  await expect(firstCell).toHaveText(/^ORD-/);
  const first = await firstCell.innerText();
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
