import { expect, test, type Page } from "@playwright/test";

async function fixture(page: Page, handle?: (path: string, method: string, url: URL) => unknown) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const path = url.pathname.slice(4);
    const method = route.request().method();
    let body = handle?.(path, method, url);
    if (body === undefined) {
      if (path === "/auth/me") body = { sub: "1", name: "Fixture Admin", role: "admin", email: "fixture@example.test", token_version: 0 };
      else if (path === "/settings") body = Object.fromEntries(Object.entries({ refresh_interval_ms: "60000", low_stock_threshold: "10", high_stock_threshold: "100", customer_order_limit: "5" }).map(([name, value]) => [name, { name, value, version: 1 }]));
      else if (path === "/inventory/reorder") body = { threshold: 10, rows: [] };
      else if (path === "/inventory/summary") body = { skus: 0, low: 0, out: 0, available: 0, reserved: 0, threshold: 10 };
      else body = [];
    }
    const status = body && typeof body === "object" && "__status" in body ? Number(body.__status) : 200;
    await route.fulfill({ status, json: body, headers: { "X-Total-Count": Array.isArray(body) ? String(body.length) : "0" } });
  });
}

test("dashboard links open matching pending and stock filters", async ({ page }) => {
  await fixture(page, (path) => path === "/dashboard/exceptions" ? { overdueDeliveries: 1, pendingOrders: 2, lowStock: 3, outOfStock: 4 } : undefined);
  await page.goto("/panel/orders?status=PENDING");
  await expect(page.getByText("Dashboard filter: PENDING")).toBeVisible();
  await expect(page.getByText("Based on mock product prices")).toHaveCount(0);
  const request = page.waitForRequest((r) => r.url().includes("/api/inventory?") && new URL(r.url()).searchParams.get("stock_status") === "Out");
  await page.goto("/panel/inventory?stock_status=Out");
  await request;
  await expect(page.getByText("Dashboard filter: Out")).toBeVisible();
});

test("inventory product variant combobox searches server pages and selects a match", async ({ page }) => {
  const pageRows = (pageIndex: number) => Array.from({ length: 10 }, (_, index) => ({
    id: pageIndex * 10 + index + 1,
    sku: `PAGE-${pageIndex * 10 + index + 1}`,
    price: 12.34,
    product_id: 1,
  }));
  await fixture(page, (path, _method, url) => {
    if (path === "/warehouses/names") return { rows: [
      { id: 1, name: "Search Fixture Warehouse" },
      { id: 2, name: "Second Fixture Warehouse" },
    ], total: 2 };
    if (path === "/product_variants") {
      const search = url.searchParams.get("search") ?? "";
      if (search === "MATCH") return { rows: [{ id: 101, sku: "MATCH-001", price: 12.34, product_id: 1 }], total: 1 };
      if (search === "NO-MATCH") return { rows: [], total: 0 };
      const pageIndex = Number(url.searchParams.get("page") ?? 0);
      return { rows: pageRows(pageIndex), total: 20 };
    }
    return undefined;
  });

  await page.goto("/panel/inventory");
  await page.getByRole("button", { name: "Add Inventory Item", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("#warehouse-name").click();
  await page.getByRole("option", { name: /Search Fixture Warehouse/ }).click();

  const variantInput = dialog.locator("#product-variant");
  await variantInput.click();
  await expect(page.getByRole("option", { name: /PAGE-1/ })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("option", { name: /PAGE-11/ })).toBeVisible();

  const matchRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/product_variants" && url.searchParams.get("search") === "MATCH";
  });
  await variantInput.fill("MATCH");
  const matchUrl = new URL((await matchRequest).url());
  expect(matchUrl.searchParams.get("page")).toBe("0");
  await expect(page.getByRole("option", { name: /MATCH-001/ })).toBeVisible();
  await expect(page.getByText("1 / 1", { exact: true })).toBeVisible();

  const emptyRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/product_variants" && url.searchParams.get("search") === "NO-MATCH";
  });
  await variantInput.fill("NO-MATCH");
  await emptyRequest;
  await expect(page.getByText("All product variants are already in this warehouse inventory, or no variants match.", { exact: true })).toBeVisible();

  const secondMatchRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/product_variants" && url.searchParams.get("search") === "MATCH";
  });
  await variantInput.fill("MATCH");
  await secondMatchRequest;
  await page.getByRole("option", { name: /MATCH-001/ }).click();
  await expect(variantInput).toHaveValue("MATCH-001");

  const secondWarehouseRequest = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return url.pathname === "/api/product_variants" && url.searchParams.get("exclude_inventory_warehouse_id") === "2";
  });
  await dialog.locator("#warehouse-name").click();
  await page.getByRole("option", { name: /Second Fixture Warehouse/ }).click();
  await secondWarehouseRequest;
  await expect(variantInput).toHaveValue("");
  await variantInput.click();
  await expect(page.getByRole("option", { name: /PAGE-1/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /MATCH-001/ })).toHaveCount(0);
});

test("calendar edit uses PUT, keeps Manila date and captured version", async ({ page }) => {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  await fixture(page, (path) => path === "/calendar/events" ? [{ id: 8, version: 3, title: "Fixture calendar", category: "MEETING_APPOINTMENT", date: day, start_time: "10:00:00", end_time: "11:00:00" }] : undefined);
  await page.goto("/panel/calendar");
  const event = page.getByRole("button", { name: /^Edit Fixture calendar,/ }).first();
  await event.focus(); await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const sent = page.waitForRequest((r) => r.url().endsWith("/api/calendar/event/8") && r.method() === "PUT");
  await dialog.getByRole("button", { name: /save/i }).click();
  expect((await sent).postDataJSON()).toMatchObject({ date: day, version: 3 });
});

test("calendar overlaps and early events remain reachable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  await fixture(page, (path) => path === "/calendar/events" ? [
    { id: 1, version: 1, title: "Early fixture", category: "STAFF_SCHEDULE", date, start_time: "07:00:00", end_time: "08:00:00" },
    { id: 2, version: 1, title: "Overlap fixture", category: "ORDER_FULFILLMENT", date, start_time: "07:30:00", end_time: "08:30:00" },
  ] : undefined);
  await page.goto("/panel/calendar");
  const early = page.getByRole("button", { name: /^Edit Early fixture,/ }).first();
  const overlap = page.getByRole("button", { name: /^Edit Overlap fixture,/ }).first();
  await expect(early).toBeVisible(); await expect(overlap).toBeVisible();
  const a = await early.boundingBox(), b = await overlap.boundingBox();
  expect(a).not.toBeNull(); expect(b).not.toBeNull();
  expect(a!.x).not.toBe(b!.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});

test("warehouse manual entry stays usable on a narrow viewport without map services", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, (path) => path === "/geocode/search" ? { __status: 503, message: "Fixture geocoder unavailable" } : undefined);
  await page.goto("/panel/warehouses");
  await page.getByRole("button", { name: "Add Warehouse" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/No coordinates selected/)).toBeVisible();
  await dialog.getByPlaceholder("Search Warehouse Address").fill("Fixture address");
  await expect(dialog.getByText(/Address search is unavailable/)).toBeVisible();
  await expect(dialog.getByLabel("Latitude")).toBeVisible();
  await dialog.getByLabel("Latitude").fill("14.5");
  await dialog.getByLabel("Longitude").fill("121.1");
  await expect(dialog.getByLabel("Latitude")).toHaveValue("14.5");
  expect(await dialog.evaluate((el) => el.getBoundingClientRect().width)).toBeLessThanOrEqual(390);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});

test("vehicle rejected edit keeps the draft and rejected deletion keeps history visible", async ({ page }) => {
  const vehicle = { id: 1, version: 2, plate_number: "FIX-001", status: "available", type: "truck", image: "", warehouse_id: 1, warehouse_name: "Fixture" };
  await fixture(page, (path, method) => {
    if (path === "/vehicles" && method === "GET") return [vehicle];
    if (path === "/vehicles/1" && method === "GET") return vehicle;
    if (path === "/warehouses/names") return { rows: [{ id: 1, name: "Fixture" }], total: 1 };
    if (path === "/vehicles/1") return { __status: 409, message: method === "DELETE" ? "Vehicles with delivery history cannot be deleted." : "Version mismatch. Refresh and try again." };
  });
  await page.goto("/panel/vehicles");
  await page.getByRole("button", { name: "Edit vehicle", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Plate number").fill("MY-DRAFT");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Version mismatch");
  await expect(dialog.getByLabel("Plate number")).toHaveValue("MY-DRAFT");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Delete vehicle", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("history");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("FIX-001", { exact: true })).toBeVisible();
});

test("password mismatch sends no mutation and deactivation errors stay visible", async ({ page }) => {
  const user = { id: 2, version: 1, name: "Fixture Staff", role: "staff", email: "staff@example.test", is_archived: false };
  let passwordRequests = 0;
  await fixture(page, (path, method) => {
    if (path === "/users") return [user];
    if (path === "/users/2/password") { passwordRequests++; return { message: "Saved" }; }
    if (path === "/users/2/archive" && method === "POST") return { __status: 409, message: "Account changed. Refresh before retrying." };
    if (path === "/warehouses/names") return { rows: [], total: 0 };
  });
  await page.goto("/panel/users");
  await page.getByRole("button", { name: "Change password", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("New password", { exact: false }).fill("fixture-password");
  await dialog.getByLabel("Confirm password", { exact: false }).fill("different-password");
  await dialog.getByRole("button", { name: "Change password", exact: true }).click();
  await expect(dialog.getByText("Passwords do not match")).toBeVisible();
  expect(passwordRequests).toBe(0);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Deactivate user Fixture Staff", exact: true }).click();
  await dialog.getByRole("button", { name: "Deactivate User", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Account changed");
});

test("live fleet stop completion calls its API and retains server errors", async ({ page }) => {
  const order = { id: "ORD-1", customer: { name: "Fixture Customer", code: "C1", phone: "09000000000" }, paymentArrangement: "NET_30", paymentMethod: null, totalAmount: null, amountPaid: 0, items: [] };
  const vehicle = { id: "1", plate: "FLEET-001", driver: "Fixture Driver", color: "#008080", warehouseId: "1", status: "delivering", trip: { id: "9", label: "Morning", scheduledAt: "2026-10-31T09:00:00+08:00" }, stops: [{ id: "12", name: "Fixture Customer", address: "Fixture Address", coordinates: [121.1, 14.5], status: "pending", order }], scheduledTrips: [], legIndex: 0, progress: 0, completedStops: 0, speed: 0 };
  await fixture(page, (path, method) => {
    if (path === "/fleet") return { vehicles: [vehicle], warehouses: [{ id: "1", name: "Fixture", address: "Fixture Address", coordinates: [121, 14.5] }] };
    if (path === "/fleet/positions") return { positions: [] };
    if (path === "/deliveries/stops/12/delivered" && method === "POST") return { __status: 409, message: "Delivery changed. Refresh and try again." };
  });
  await page.goto("/panel/fleet-map");
  await page.getByRole("button").filter({ hasText: "FLEET-001" }).click();
  const details = page.getByRole("region", { name: "Vehicle FLEET-001" });
  await details.getByRole("button", { name: "Mark next stop delivered" }).click();
  await expect(details.getByRole("alert")).toContainText("Delivery changed");
  await expect(details.getByRole("button", { name: "Mark next stop delivered" })).toBeEnabled();
});

test("fleet road routes recover after failure and reuse cached geometry for previews", async ({ page }) => {
  const order = { id: "ORD-ROAD", customer: { name: "Road Customer", code: "C1", phone: "09000000000" }, paymentArrangement: "NET_30", paymentMethod: null, totalAmount: 0, amountPaid: 0, items: [] };
  const stop = { id: "road-stop", name: "Road Customer", address: "Road Address", coordinates: [121.01, 14.51], status: "pending", order };
  const vehicle = { id: "road-1", plate: "ROAD-001", driver: "Road Driver", color: "#008080", warehouseId: "1", status: "delivering", trip: { id: "road-trip", label: "Morning", scheduledAt: "2026-11-01T09:00:00+08:00" }, stops: [stop], scheduledTrips: [{ id: "road-preview", label: "Afternoon", phase: "upcoming", scheduledAt: "2026-11-02T09:00:00+08:00", stops: [stop] }], legIndex: 0, progress: 0, completedStops: 0, speed: 0 };
  await fixture(page, (path) => {
    if (path === "/fleet") return { vehicles: [vehicle], warehouses: [{ id: "1", name: "Road Warehouse", address: "Warehouse Address", coordinates: [121, 14.5] }] };
    if (path === "/fleet/positions") return { positions: [] };
  });
  const requested: string[] = [];
  let available = false;
  await page.route("**/panel/fleet-map/road-route?*", async (request) => {
    requested.push(new URL(request.request().url()).searchParams.get("waypoints")!);
    if (!available) return request.fulfill({ status: 502, json: { message: "Routing unavailable" } });
    const outbound = [[121, 14.5], [121.01, 14.5], [121.01, 14.51]];
    const inbound = [[121.01, 14.51], [121, 14.51], [121, 14.5]];
    await request.fulfill({ json: { coordinates: [...outbound, ...inbound.slice(1)], distance: 4400, duration: 400, legs: [outbound, inbound].map(coordinates => ({ coordinates, distance: 2200, duration: 200 })) } });
  });
  await page.goto("/panel/fleet-map");
  await expect(page.getByText("Some road routes are unavailable.")).toBeVisible();
  available = true;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("Some road routes are unavailable.")).toHaveCount(0);
  await expect(page.getByText("Loading road routes...")).toHaveCount(0);
  expect(requested).toHaveLength(3); // Initial request, automatic retry, manual retry.
  expect(requested[0]).toBe("121,14.5;121.01,14.51;121,14.5");
  await page.getByRole("button").filter({ hasText: "ROAD-001" }).click();
  await page.getByRole("tab", { name: /Upcoming/ }).click();
  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByRole("button", { name: "Hide on map" })).toBeVisible();
  // Identical waypoint sequences share cached geometry across current/preview trips.
  expect(requested).toHaveLength(3);
});

test("report payments show negative cashflow and separate receipt/refund totals", async ({ page }) => {
  await fixture(page, (path) => {
    if (path === "/reports/options") return { customers: [], products: [], warehouses: [], vehicles: [] };
    if (path === "/reports/overview") return { kpis: { revenue: null, revenueDelta: null, orders: 0, ordersDelta: null, cash: -10, cashDelta: null, outstanding: null, delivered: 0, deliveredDelta: null, failureRate: 0 }, trend: { day: [], week: [], month: [] }, ordersByStatus: [], paymentStatus: [], recentOrders: [] };
    if (path === "/reports/payments") return { kpis: { cash: -10, cashDelta: null, received: 5, refunded: 15, outstanding: null, overdue: null, partiallyPaid: 0 }, byMethod: [{ name: "CASH", value: -10 }], byArrangement: [], aging: [], openBalances: [], openBalanceCount: 0 };
  });
  await page.goto("/panel/analysis-reports");
  await page.getByRole("tab", { name: "payments", exact: true }).click();
  await expect(page.getByText(/Gross receipts:/)).toContainText("5.00");
  await expect(page.getByText(/Gross receipts:/)).toContainText("15.00");
  await expect(page.getByText("Unverified", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Net cashflow", { exact: true })).toBeVisible();
});

test("delivery event rejection preserves the entered reason", async ({ page }) => {
  await fixture(page, (path, method) => {
    if (path === "/deliveries") return [{ delivery_id: 1, version: 1, driver_name: "Driver", vehicle_plate_number: "D-001", vehicle_type: "truck", delivery_type: "INTERNAL", scheduled_date: "2026-10-31", departure_time: "10:00:00", status: "scheduled", orders: [], warehouse: { id: 1, name: "Fixture" } }];
    if (path === "/deliveries/event" && method === "POST") return { __status: 409, message: "Delivery changed. Refresh before retrying." };
  });
  await page.goto("/panel/deliveries?status=scheduled&overdue=true");
  await expect(page.getByText(/Dashboard filter: Overdue/)).toBeVisible();
  await page.getByRole("button", { name: "Delivery Event", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("Customer requested another date");
  await dialog.getByRole("button", { name: "Cancel Delivery", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Delivery changed");
  await expect(dialog.getByRole("textbox")).toHaveValue("Customer requested another date");
});
