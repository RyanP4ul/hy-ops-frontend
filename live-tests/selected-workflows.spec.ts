import { expect, test, type Page, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import ExcelJS from "../../backend/node_modules/exceljs";
import { browserLogin, json, order, password } from "./helpers";

test.use({ timezoneId: "America/Los_Angeles", actionTimeout: 15_000, navigationTimeout: 30_000 });
test.setTimeout(90_000);
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", error => { errors.push(error.message); });
  await browserLogin(page);
});
test.afterEach(async ({ page }) => { expect(browserErrors.get(page) ?? [], "Unexpected browser runtime errors").toEqual([]); });

const warehouse = (name: string) => ({ name, street_address: "12 Fixture Street", city: "Fixture City", state: "Fixture Province", zip_code: "1000", latitude: 14.5, longitude: 121.1 });
async function navigate(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
}
const rowFor = (page: Page, text: string) => page.getByRole("row").filter({ hasText: text });
async function choose(page: Page, control: Locator, label: string) {
  await control.click();
  await page.getByRole("option", { name: label, exact: true }).click();
}
async function createTrip(page: Page, driverId: number, vehicleId: number) {
  const created = await json(page.request, "POST", "/orders", order);
  await json(page.request, "POST", `/orders/process/${created.id}?version=1`);
  await json(page.request, "POST", `/orders/delivery/${created.id}?version=2`);
  return json(page.request, "POST", "/deliveries", { order_ids: [created.id], scheduled_date: "2099-01-01", scheduled_time: "09:00", delivery_type: "INTERNAL", driver_id: driverId, vehicle_id: vehicleId, delivery_allowance: 0, fuel: 0, toll: 0 });
}

test("Users saves edits and role profiles, changes password and deactivates without deleting history", async ({ page, playwright }) => {
  const account = await json(page.request, "POST", "/users", { name: "Selected Staff", email: "selected-staff@example.test", password, role: "staff", profile: { warehouse_id: 1 } });
  await navigate(page, "/panel/users");
  await page.getByPlaceholder("Search users...").fill("selected-staff@example.test");
  const row = rowFor(page, "selected-staff@example.test");
  await row.getByRole("button", { name: "Edit user Selected Staff", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Name", { exact: false }).first()).toHaveValue("Selected Staff");
  await dialog.getByLabel("Name", { exact: false }).first().fill("Selected Staff Edited");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText("Selected Staff Edited");
  expect((await json(page.request, "GET", `/users/${account.id}`)).profile.warehouse_id).toBe(1);

  await row.getByRole("button", { name: "Edit user Selected Staff Edited", exact: true }).click();
  await choose(page, dialog.getByLabel("Role", { exact: false }), "admin");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await json(page.request, "GET", `/users/${account.id}`)).role).toBe("admin");
  await row.getByRole("button", { name: "Edit user Selected Staff Edited", exact: true }).click();
  await choose(page, dialog.getByLabel("Role", { exact: false }), "driver");
  await choose(page, dialog.getByLabel("Warehouse", { exact: false }), "(1) Live warehouse");
  await dialog.getByLabel("Phone Number", { exact: false }).fill("09000000002");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const converted = await json(page.request, "GET", `/users/${account.id}`);
  expect(converted.role).toBe("driver");
  expect(converted.profile.warehouse_id).toBe(1);
  expect(converted.profile.status).toBe("available");
  await row.getByRole("button", { name: "Change password", exact: true }).click();
  await dialog.getByLabel("New password", { exact: false }).fill("Changed-fixture-password");
  await dialog.getByLabel("Confirm password", { exact: false }).fill("Changed-fixture-password");
  await dialog.getByRole("button", { name: "Change password", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const other = await playwright.request.newContext({ baseURL: "http://127.0.0.1:3100" });
  try {
    expect((await other.post("/api/auth/login", { data: { email: "selected-staff@example.test", password: "Changed-fixture-password", is_mobile: true } })).status()).toBe(200);
    await row.getByRole("button", { name: "Deactivate user Selected Staff Edited", exact: true }).click();
    await dialog.getByRole("button", { name: "Deactivate User", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(row).toHaveCount(0);
    expect((await other.get("/api/auth/me")).status()).toBe(401);
    const archive = await json(page.request, "GET", "/archives?limit=50");
    expect(JSON.stringify(archive)).toContain("Selected Staff Edited");
  } finally { await other.dispose(); }
});

test("Vehicles creates, edits and deletes an unused vehicle through rendered controls", async ({ page }) => {
  await navigate(page, "/panel/vehicles");
  await page.getByRole("button", { name: "Add Vehicle", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Plate number", { exact: true }).fill(" selected-001 ");
  await choose(page, dialog.getByLabel("Warehouse", { exact: false }), "(1) Live warehouse");
  await dialog.getByRole("button", { name: "Add Vehicle", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByPlaceholder("Search vehicles...").fill("SELECTED-001");
  const row = rowFor(page, "SELECTED-001");
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Edit vehicle", exact: true }).click();
  await expect(dialog.getByLabel("Plate number")).toHaveValue("SELECTED-001");
  await choose(page, dialog.getByLabel("Status", { exact: true }), "Maintenance");
  await choose(page, dialog.getByLabel("Type", { exact: true }), "Van");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText("maintenance");
  await expect(row).toContainText("van");
  await row.getByRole("button", { name: "Delete vehicle", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toHaveCount(0);
});

test("Scheduled assignments protect driver and vehicle edits and preserve delivery history", async ({ page }) => {
  const driver = await json(page.request, "POST", "/users", { name: "Selected Driver", email: "selected-driver@example.test", password, role: "driver", profile: { warehouse_id: 1, warehouse_name: "Live warehouse", status: "available", phone_number: "09000000001" } });
  const vehicle = await json(page.request, "POST", "/vehicles", { warehouse_id: 1, plate_number: "ASSIGNED-001", type: "truck", status: "available", image: "" });
  const trip = await createTrip(page, driver.id, vehicle.id);
  await navigate(page, "/panel/users");
  await page.getByPlaceholder("Search users...").fill("Selected Driver");
  await rowFor(page, "Selected Driver").getByRole("button", { name: "Edit user Selected Driver", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Warehouse", { exact: false })).toHaveValue("Live warehouse");
  await choose(page, dialog.getByPlaceholder("Select a status"), "unavailable");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByRole("alert").first()).toContainText(/assign|trip|deliver/i);
  expect((await json(page.request, "GET", `/users/${driver.id}`)).profile.status).toBe("available");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await navigate(page, "/panel/vehicles");
  await page.getByPlaceholder("Search vehicles...").fill("ASSIGNED-001");
  const row = rowFor(page, "ASSIGNED-001");
  await row.getByRole("button", { name: "Edit vehicle", exact: true }).click();
  await choose(page, dialog.getByLabel("Status", { exact: true }), "Maintenance");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(/assign|trip|deliver/i);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await row.getByRole("button", { name: "Delete vehicle", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(/history|deliver/i);
  expect((await json(page.request, "GET", `/vehicles/${vehicle.id}`)).status).toBe("available");
  expect((await json(page.request, "GET", "/deliveries?limit=50")).some((entry: { delivery_id: number }) => entry.delivery_id === trip.id)).toBe(true);
});

test("Warehouses creates, clears coordinates, archives and protects linked records", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await navigate(page, "/panel/warehouses");
  await page.getByRole("button", { name: "Add Warehouse", exact: true }).click();
  const dialog = page.getByRole("dialog");
  for (const [label, value] of Object.entries({ "Warehouse Name": "Selected Warehouse", "Street Address": "12 Fixture Street", "City": "Fixture City", "Province": "Fixture Province", "Zip Code": "1000", "Latitude": "14.5", "Longitude": "121.1" })) await dialog.getByLabel(label, { exact: false }).fill(value);
  await dialog.getByRole("button", { name: "Save Warehouse", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByPlaceholder("Search warehouses...").fill("Selected Warehouse");
  const row = rowFor(page, "Selected Warehouse");
  await row.getByRole("button", { name: "Edit warehouse", exact: true }).click();
  await expect(dialog.getByLabel("Latitude", { exact: false })).toHaveValue("14.5");
  await dialog.getByLabel("Latitude", { exact: false }).fill("");
  await dialog.getByLabel("Longitude", { exact: false }).fill("");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await row.getByRole("button", { name: "Edit warehouse", exact: true }).click();
  await expect(dialog.getByLabel("Latitude", { exact: false })).toHaveValue("");
  await expect(dialog.getByText(/No coordinates selected/)).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await row.getByRole("button", { name: "Archive warehouse", exact: true }).click();
  await dialog.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toHaveCount(0);
  await page.getByPlaceholder("Search warehouses...").fill("Live warehouse");
  await rowFor(page, "Live warehouse").getByRole("button", { name: "Delete warehouse", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(/linked|history|inventory|record/i);
});

test("Warehouse address selection applies a successful provider response and persists the location", async ({ page }) => {
  // Only the external provider response is controlled; warehouse writes use the real API/database.
  await page.route("https://basemaps.cartocdn.com/gl/positron-gl-style/style.json", route => route.fulfill({ json: { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#f5f5f5" } }] } }));
  await page.route("**/api/geocode/search?*", route => route.fulfill({ json: [{ place_id: 77, display_name: "Selected address, Fixture City", lat: "14.61", lon: "121.02", address: { house_number: "77", road: "Selected Road", city: "Selected City", state: "Selected Province", postcode: "1777" } }] }));
  await navigate(page, "/panel/warehouses");
  await page.getByRole("button", { name: "Add Warehouse", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Warehouse Name", { exact: false }).fill("Selected Geocoded Warehouse");
  await dialog.getByPlaceholder("Search Warehouse Address").fill("Selected address");
  await page.getByRole("option", { name: "Selected address, Fixture City", exact: true }).click();
  await expect(dialog.getByLabel("Street Address", { exact: false })).toHaveValue("77 Selected Road");
  await expect(dialog.getByLabel("Latitude", { exact: false })).toHaveValue("14.61");
  await expect(dialog.getByLabel("Longitude", { exact: false })).toHaveValue("121.02");
  await expect(dialog.locator("canvas.maplibregl-canvas")).toBeVisible();
  await dialog.getByRole("button", { name: "Save Warehouse", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByPlaceholder("Search warehouses...").fill("Selected Geocoded Warehouse");
  await expect(rowFor(page, "Selected Geocoded Warehouse")).toContainText("77 Selected Road");
});

test("Warehouse stale edits retain drafts and an unused warehouse can be deleted", async ({ page }) => {
  const data = warehouse("Selected Stale Warehouse");
  const created = await json(page.request, "POST", "/warehouses", data);
  await navigate(page, "/panel/warehouses");
  await page.getByPlaceholder("Search warehouses...").fill("Selected Stale Warehouse");
  const row = rowFor(page, "Selected Stale Warehouse");
  await row.getByRole("button", { name: "Edit warehouse", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("City", { exact: false }).fill("Retain this city draft");
  await json(page.request, "PUT", `/warehouses/${created.id}`, { ...data, city: "Saved by another editor", version: 1 });
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByRole("alert").filter({ hasText: "Version mismatch" })).toBeVisible();
  await expect(dialog.getByLabel("City", { exact: false })).toHaveValue("Retain this city draft");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await row.getByRole("button", { name: "Edit warehouse", exact: true }).click();
  await expect(dialog.getByLabel("City", { exact: false })).toHaveValue("Saved by another editor");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await row.getByRole("button", { name: "Delete warehouse", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toHaveCount(0);
});

test("Calendar creates, edits and deletes a Manila-date event from a different browser timezone", async ({ page }) => {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  await navigate(page, "/panel/calendar");
  await page.getByRole("button", { name: "New Event", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: false }).fill("Selected Calendar Event");
  await dialog.locator("#scheduledDate").click();
  const [year, month, date] = day.split("-").map(Number);
  await page.locator(`[data-day="${month}/${date}/${year}"]`).click();
  const sent = page.waitForRequest(r => r.url().endsWith("/api/calendar/event") && r.method() === "POST");
  await dialog.getByRole("button", { name: "Create event", exact: true }).click();
  expect((await sent).postDataJSON().date).toBe(day);
  await expect(dialog).toHaveCount(0);
  const event = page.getByRole("button", { name: /^Edit Selected Calendar Event,/ }).first();
  await event.click();
  await dialog.getByLabel("Title", { exact: false }).fill("Selected Calendar Updated");
  await dialog.getByLabel("Start Time", { exact: false }).fill("00:30");
  await dialog.getByLabel("End Time", { exact: false }).fill("01:30");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: /^Edit Selected Calendar Updated,/ }).first().click();
  await expect(dialog.getByLabel("Start Time", { exact: false })).toHaveValue("00:30");
  await dialog.getByRole("button", { name: "Delete event", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Edit Selected Calendar Updated,/ })).toHaveCount(0);
});

test("Calendar rejects stale updates without discarding the open draft", async ({ page }) => {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const initial = { title: "Selected Stale Event", category: "MEETING_APPOINTMENT", date, start_time: "10:00", end_time: "11:00" };
  await json(page.request, "POST", "/calendar/event", initial);
  await navigate(page, "/panel/calendar");
  await page.getByRole("button", { name: /^Edit Selected Stale Event,/ }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title", { exact: false }).fill("Retain this calendar draft");
  const events = await json(page.request, "GET", "/calendar/events");
  const current = events.find((event: { title: string }) => event.title === initial.title);
  await json(page.request, "PUT", `/calendar/event/${current.id}`, { ...initial, title: "Saved by another editor", version: current.version });
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(/changed|removed/i);
  await expect(dialog.getByLabel("Title", { exact: false })).toHaveValue("Retain this calendar draft");
});

test("Dashboard statistics and exception drilldowns agree with operational records", async ({ page }) => {
  const created = await json(page.request, "POST", "/orders", order);
  const stats = await json(page.request, "GET", "/dashboard/stats");
  const allOrders = await page.request.get("/api/orders?limit=1");
  expect(stats.total_orders).toBe(Number(allOrders.headers()["x-total-count"]));
  let activeCount = 0;
  for (const status of ["scheduled", "in_transit", "returning"]) {
    const deliveries = await page.request.get(`/api/deliveries?status=${status}&limit=1`);
    activeCount += Number(deliveries.headers()["x-total-count"]);
  }
  expect(stats.total_active_deliveries).toBe(activeCount);
  const activeRows = await page.request.get("/api/deliveries?active=true&limit=1");
  expect(Number(activeRows.headers()["x-total-count"])).toBe(activeCount);
  const cashflow = await json(page.request, "GET", "/reports/payments?preset=mtd");
  expect(stats.revenue).toBe(cashflow.kpis.cash);
  const pendingResponse = await page.request.get("/api/orders?status=PENDING&limit=1");
  expect(stats.total_pending).toBe(Number(pendingResponse.headers()["x-total-count"]));
  const exceptions = await json(page.request, "GET", "/dashboard/exceptions");
  const stock = await json(page.request, "GET", "/inventory/summary");
  expect(exceptions.pendingOrders).toBe(stats.total_pending);
  expect(exceptions.lowStock).toBe(stock.low);
  expect(exceptions.outOfStock).toBe(stock.out);
  await navigate(page, "/panel");
  const pendingCard = page.locator('[data-slot="card"]').filter({ has: page.getByText("Pending Orders", { exact: true }) });
  await expect(pendingCard).toContainText(String(stats.total_pending));
  await page.getByRole("link", { name: "Review pending orders", exact: true }).click();
  await expect(page).toHaveURL(/status=PENDING/);
  await expect(page.getByText(/Dashboard filter: PENDING/)).toBeVisible();
  await navigate(page, "/panel");
  await page.getByRole("link", { name: "Review out-of-stock items", exact: true }).click();
  await expect(page).toHaveURL(/stock_status=Out/);
  await expect(page.getByText(/Dashboard filter: Out/)).toBeVisible();
  await navigate(page, "/panel");
  await page.getByRole("link", { name: "Review active deliveries", exact: true }).click();
  await expect(page).toHaveURL(/active=true/);
  await expect(page.getByText(/Active deliveries \(scheduled, in transit and returning\)/)).toBeVisible();
  await navigate(page, "/panel");
  await page.getByRole("link", { name: "Review monthly cashflow", exact: true }).click();
  await expect(page.getByRole("tab", { name: "payments", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("combobox", { name: "Date range", exact: true })).toContainText("Month to date");
  await json(page.request, "POST", `/orders/cancel/${created.id}?version=1`);
});

test("Reports apply filters, show no-data periods and download matching CSV and XLSX previews", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const scope = await json(page.request, "POST", "/warehouses", warehouse("Selected Reports Warehouse"));
  const inventory = await json(page.request, "POST", "/inventory", { warehouse_id: scope.id, product_variant_id: 1, quantity: 50 });
  // Query the authoritative row rather than depending on a mutation response wrapper.
  const rows = await json(page.request, "GET", `/inventory?warehouse_id=${scope.id}&limit=10`);
  expect(inventory).toBeTruthy();
  await json(page.request, "POST", "/orders", { ...order, warehouse_id: scope.id, amount_paid: 5, items: [{ inventory_id: rows[0].id, quantity: 2 }] });
  await navigate(page, "/panel/analysis-reports");
  await page.getByRole("combobox", { name: "Date range", exact: true }).click();
  await page.getByRole("option", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: /Show filters/ }).click();
  await page.getByRole("button", { name: "Warehouse", exact: true }).click();
  await page.getByRole("checkbox", { name: "Selected Reports Warehouse", exact: true }).check();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Warehouse: 1", { exact: true })).toBeVisible();
  await expect(page.getByText(/24\.68/).first()).toBeVisible();
  for (const tab of ["sales", "inventory", "payments", "deliveries", "customers"]) {
    const loaded = page.waitForResponse(response => new URL(response.url()).pathname === `/api/reports/${tab}`);
    await page.getByRole("tab", { name: tab, exact: true }).click();
    expect((await loaded).status()).toBe(200);
    await expect(page.getByText("Couldn't load this report", { exact: true })).toHaveCount(0);
    await expect(page.locator('[role="tabpanel"][data-state="active"], [role="tabpanel"]:visible').first()).toBeVisible();
  }
  for (const format of ["CSV", "XLSX (Excel)"]) {
    await page.getByRole("button", { name: "Generate Report", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await choose(page, dialog.getByRole("combobox", { name: "Export format" }), format);
    await dialog.getByRole("button", { name: "Generate preview", exact: true }).click();
    await expect(dialog.getByText("Rows included: 1", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/24\.68/).first()).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: format === "CSV" ? "Export CSV" : "Export XLSX", exact: true }).click();
    const download = await downloadPromise;
    const destination = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(destination);
    const bytes = await readFile(destination);
    if (format === "CSV") {
      expect(bytes.toString("utf8")).toContain("24.68");
      expect(bytes.toString("utf8")).toContain("Selected Reports Warehouse");
      const csv = bytes.toString("utf8");
      expect(csv).toContain("Period (inclusive, Asia/Manila)");
      expect(csv).toContain(`warehouses: ${scope.id}`);
      expect(csv.split(/\r?\n\r?\n/)[1].trim().split(/\r?\n/)).toHaveLength(2);
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(destination);
      const sheet = workbook.getWorksheet("Sales");
      expect(sheet?.rowCount).toBe(2);
      expect(sheet?.getRow(2).getCell(4).value).toBe("Selected Reports Warehouse");
      expect(sheet?.getRow(2).getCell(6).value).toBe(24.68);
      expect(workbook.getWorksheet("Report details")?.getRow(5).getCell(2).value).toBe(`warehouses: ${scope.id}`);
    }
    await dialog.getByRole("button", { name: "Close", exact: true }).first().click();
  }
  const emptyFilters = encodeURIComponent(JSON.stringify({ preset: "custom", from: "2000-01-01", to: "2000-01-02", warehouses: [String(scope.id)] }));
  await navigate(page, `/panel/analysis-reports?f=${emptyFilters}`);
  await expect(page.getByText("No orders in this period.", { exact: true })).toBeVisible();
});

test("Customer profile edits preserve saved coordinates and postal codes", async ({ page }) => {
  await navigate(page, "/panel/users");
  await page.getByPlaceholder("Search users...").fill("customer@example.test");
  await rowFor(page, "customer@example.test").getByRole("button", { name: "Edit user Live Customer", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: false }).first().fill("Live Customer Updated");
  await dialog.getByLabel("Postal Code", { exact: false }).fill("0123");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await json(page.request, "GET", "/users/4");
  expect(saved.profile.postal_code).toBe("0123");
  expect(Number(saved.profile.latitude)).toBe(14.6);
  expect(Number(saved.profile.longitude)).toBe(121.2);
});

test("Reports reconcile receipts, refunds and cancelled balances through Payment preview and export", async ({ page }, testInfo) => {
  const scope = await json(page.request, "POST", "/warehouses", warehouse("Finance Acceptance Warehouse"));
  await json(page.request, "POST", "/inventory", { warehouse_id: scope.id, product_variant_id: 1, quantity: 10 });
  const stocks = await json(page.request, "GET", `/inventory?warehouse_id=${scope.id}&limit=10`);
  const created = await json(page.request, "POST", "/orders", { ...order, warehouse_id: scope.id, amount_paid: 12.34, items: [{ inventory_id: stocks[0].id, quantity: 1 }] });
  const payments = await json(page.request, "GET", "/payments?limit=100");
  const payment = payments.find((row: { order_id: number }) => row.order_id === created.id);
  await json(page.request, "POST", "/payments/refunds", { payment_number: payment.payment_number, amount: 2.34, version: payment.version, reason: "Finance acceptance", request_id: crypto.randomUUID() });
  const filters = encodeURIComponent(JSON.stringify({ preset: "today", warehouses: [String(scope.id)] }));
  await navigate(page, `/panel/analysis-reports?tab=payments&f=${filters}`);
  await expect(page.getByText(/Gross receipts:.*12\.34.*Refunds:.*2\.34/)).toBeVisible();
  const cashCard = page.locator('[data-slot="card"]').filter({ has: page.getByText("Net cashflow", { exact: true }) });
  await expect(cashCard).toContainText("10.00");
  const balanceCard = page.locator('[data-slot="card"]').filter({ has: page.getByText("Outstanding balance", { exact: true }) });
  await expect(balanceCard).toContainText("2.34");
  await json(page.request, "POST", `/orders/cancel/${created.id}?version=1`);
  await expect(balanceCard).toContainText("0.00");
  await expect(cashCard).toContainText("10.00");
  await expect(page.getByText("No open balances for these filters.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Generate Report", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await choose(page, dialog.getByRole("combobox", { name: "Report type" }), "Payment report");
  await dialog.getByRole("button", { name: "Generate preview", exact: true }).click();
  await expect(dialog.getByText("Rows included: 2", { exact: true })).toBeVisible();
  for (const amount of ["12.34", "2.34", "10.00"]) await expect(dialog.getByText(new RegExp(amount.replace('.', '\\.'))).first()).toBeVisible();
  await expect(dialog.getByText(/including cancelled orders/)).toBeVisible();
  const pendingDownload = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export CSV", exact: true }).click();
  const download = await pendingDownload;
  const destination = testInfo.outputPath(download.suggestedFilename());
  await download.saveAs(destination);
  const csv = await readFile(destination, "utf8");
  const table = csv.split(/\r?\n\r?\n/)[1].trim().split(/\r?\n/);
  expect(table).toHaveLength(3);
  expect(table.join('\n')).toContain('12.34'); expect(table.join('\n')).toContain('-2.34');
  expect(csv).toContain(`warehouses: ${scope.id}`);
});

test("Dashboard failure shows recovery instead of invented zero statistics", async ({ page }) => {
  await page.route("**/api/dashboard/stats", route => route.fulfill({ status: 503, json: { message: "Fixture unavailable" } }));
  await navigate(page, "/panel");
  const feedback = page.getByRole("alert").filter({ hasText: "Unable to load dashboard statistics" });
  await expect(feedback).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Total Orders", { exact: true })).toHaveCount(0);
  await page.unroute("**/api/dashboard/stats");
  await feedback.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("Total Orders", { exact: true })).toBeVisible();
});

test("Report URL filters tolerate malformed values and invalid ranges show a recoverable error", async ({ page }) => {
  await navigate(page, `/panel/analysis-reports?f=${encodeURIComponent(JSON.stringify({ warehouses: null, products: 42, customers: "invalid", overdueOnly: "no" }))}`);
  await expect(page.getByRole("heading", { name: "Analysis & Reports", exact: true })).toBeVisible();
  await expect(page.getByText("Recent orders", { exact: true })).toBeVisible();
  await navigate(page, `/panel/analysis-reports?f=${encodeURIComponent(JSON.stringify({ preset: "custom", from: "2026-10-31", to: "2026-10-01" }))}`);
  await expect(page.getByText("Couldn't load this report", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByText("Recent orders", { exact: true })).toBeVisible();
});
