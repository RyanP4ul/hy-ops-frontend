import { expect, test } from "@playwright/test";
import { browserLogin } from "./helpers";

test("Lalamove saved pickup warehouse supports search, pagination, save feedback and reload", async ({ page }) => {
  await browserLogin(page);
  const original = { id: 1, name: "Original warehouse", street_address: "Original pickup", city: "City", state: "Province", zip_code: "0000", phone_number: "+639171111111" };
  const alternate = { ...original, id: 2, name: "Alternate warehouse", street_address: "Alternate pickup", phone_number: "+639171234567" };
  const missingPhone = { ...original, id: 3, name: "Missing phone warehouse", phone_number: null };
  let selected = original;
  let version = 1;
  let saves = 0;
  let rejectSave = false;
  let finishSave = () => {};
  const pendingSave = new Promise<void>(resolve => { finishSave = resolve; });
  await page.route("**/api/lalamove/**", async route => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace("/api/lalamove", "");
    if (path === "/context/123") return route.fulfill({ json: {
      order: { id: 123, order_number: "PICKUP-CONTACT-123", version, status: "SCHEDULING", delivery_method: "INTERNAL", shipping_address: "Fixture destination", shipping_recipient: "Recipient" },
      warehouse: selected, bookings: [], history: [], can_reconcile: false, eligible: true, reason: null, enabled: false, environment: "sandbox",
    } });
    if (path === "/context/123/warehouses") {
      const search = url.searchParams.get("search") || "";
      const rows = url.searchParams.get("page") === "1" ? [alternate] : [original, missingPhone];
      return route.fulfill({ json: { rows: search ? [alternate].filter(item => item.name.toLowerCase().includes(search.toLowerCase())) : rows, total: search ? 1 : 11 } });
    }
    if (path === "/context/123/warehouse") {
      expect(req.method()).toBe("PUT"); saves++;
      if (rejectSave) return route.fulfill({ status: 409, json: { message: "Warehouse changed. Refresh and try again." } });
      expect(req.postDataJSON()).toEqual({ warehouse_id: 2, version: 1 });
      await pendingSave; selected = alternate; version++;
      return route.fulfill({ json: { message: "Pickup warehouse saved." } });
    }
    throw new Error(`Unexpected request: ${path}`);
  });
  await page.goto("/panel/lalamove?orderId=123");
  await page.getByText("Warehouse pickup contact", { exact: true }).click();
  const combo = page.getByRole("combobox", { name: "Pickup warehouse" });
  await expect(combo).toHaveValue("Original warehouse");
  await combo.click();
  await page.getByRole("option", { name: /Missing phone warehouse/ }).click();
  await expect(page.getByRole("button", { name: "Save pickup warehouse", exact: true })).toBeDisabled();
  await expect(page.getByText("Add the warehouse phone number in", { exact: false })).toBeVisible();
  await combo.click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("option", { name: /Alternate warehouse/ }).click();
  await expect(page.getByText("Alternate pickup, City, Province, 0000", { exact: true })).toBeVisible();
  const save = page.getByRole("button", { name: "Save pickup warehouse", exact: true });
  await save.click();
  await expect(page.getByRole("button", { name: /^Saving pickup warehouse/ })).toBeDisabled();
  finishSave();
  await expect(page.getByText("Pickup warehouse saved.", { exact: true })).toBeVisible();
  expect(saves).toBe(1);
  await page.reload();
  await page.getByText("Warehouse pickup contact", { exact: true }).click();
  await expect(combo).toHaveValue("Alternate warehouse");
  await expect(page.getByText("+639171234567", { exact: true }).first()).toBeVisible();
  rejectSave = true;
  await combo.click();
  await page.getByRole("option", { name: /Original warehouse/ }).click();
  await page.getByRole("button", { name: "Save pickup warehouse", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Warehouse changed. Refresh and try again." })).toBeVisible();
  await expect(combo).toHaveValue("Original warehouse");
  await combo.fill("Alternate");
  await expect(page.getByRole("option", { name: /Alternate warehouse/ })).toBeVisible();
  expect(saves).toBe(2);
});

test("Lalamove requires fee confirmation, retains booking after reload and keeps external assignments separate", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await browserLogin(page);
  let created = false; let submissions = 0; let method = "INTERNAL"; let version = 1;
  const booking = { id: 10, order_id: 123, environment: "sandbox", status: "ASSIGNING_DRIVER", booking_state: "CONFIRMED", active: true,
    lalamove_order_id: "1234567890123456789", delivery_fee: "125", currency: "PHP", share_link: "https://share.sandbox.lalamove.com/?fixture",
    driver_details: null, failure_message: null, last_synced_at: new Date().toISOString(), picked_up_at: null };
  await page.route("**/api/lalamove/**", async route => {
    const req = route.request(); const path = new URL(req.url()).pathname.replace("/api/lalamove", "");
    let json: unknown;
    if (path === "/context/123") json = { order: { id: 123, order_number: "ORDER-LALAMOVE-123", version, status: created ? "SCHEDULED" : "SCHEDULING", delivery_method: method, shipping_address: "Fixture destination", shipping_recipient: "Recipient" }, warehouse: { id: 1, name: "Fixture warehouse", street_address: "Pickup street", city: "City", state: "Province", zip_code: "0000", version: 1, phone_number: "+639171234567" }, bookings: created ? [booking] : [], history: [], can_reconcile: true, eligible: true, reason: null, enabled: true, environment: "sandbox" };
    else if (path === "/context/123/method") { method = req.postDataJSON().method; version++; json = { message: "Saved" }; }
    else if (path === "/context/123/warehouses") json = { rows: [], total: 0 };
    else if (path === "/cities") json = { data: [{ locode: "PH MNL", name: "Manila", services: [{ key: "MOTORCYCLE", description: "Small packages", load: { value: "20", unit: "kg" } }] }] };
    else if (path === "/quotations") json = { quotation_ref: "quote-fixture", expiresAt: new Date(Date.now()+300000).toISOString(), serviceType: "MOTORCYCLE", priceBreakdown: { total: "125", currency: "PHP" }, route: { pickup: { address: "Pickup street" }, dropoff: { address: "Fixture destination" } } };
    else if (path === "/orders" && req.method() === "POST") { submissions++; expect(req.postDataJSON().package_confirmed).toBe(true); created = true; version++; json = booking; }
    else if (path.endsWith("/refresh")) json = booking;
    else json = [];
    await route.fulfill({ json });
  });
  await page.goto("/panel/lalamove?orderId=123");
  await expect(page.getByText("ORDER-LALAMOVE-123", { exact: false })).toBeVisible();
  await page.getByLabel("Delivery method", { exact: true }).selectOption("LALAMOVE");
  await page.getByLabel("Operating city", { exact: true }).selectOption("PH MNL");
  await page.getByLabel("Vehicle service", { exact: true }).selectOption("MOTORCYCLE");
  await page.getByRole("button", { name: "Get quotation", exact: true }).click();
  const confirm = page.getByRole("button", { name: "Confirm and book Lalamove", exact: true });
  await expect(confirm).toBeDisabled(); expect(submissions).toBe(0);
  await page.screenshot({ path: testInfo.outputPath("lalamove-quotation-desktop.png"), fullPage: true });
  await page.getByRole("checkbox").check(); await confirm.click();
  await expect(page.getByText("Lalamove reference: 1234567890123456789")).toBeVisible();
  await page.reload(); await expect(page.getByText("Lalamove reference: 1234567890123456789")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Lalamove tracking" })).toHaveAttribute("href", /share\.sandbox\.lalamove\.com/);
  await expect(page.getByLabel("Delivery method", { exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Confirm and book Lalamove" })).toHaveCount(0);
  expect(submissions).toBe(1);
});

test("Lalamove webhook setup shows callback activity and registers only after an administrator clicks", async ({ page }) => {
  await browserLogin(page);
  let registrations = 0;
  await page.route("**/api/lalamove/**", async route => {
    const path = new URL(route.request().url()).pathname.replace("/api/lalamove", "");
    if (path === "/setup") return route.fulfill({ json: { can_manage: true, enabled: true, environment: "sandbox", callback_url: "https://backend.example.test/webhooks/lalamove", callback_path: "/webhooks/lalamove", last_callback_at: null } });
    if (path === "/webhook/register") {
      registrations++;
      expect(route.request().method()).toBe("POST");
      return route.fulfill({ json: { message: "Webhook URL registered. Select webhook event version v3 in Lalamove Partner Portal." } });
    }
    if (path === "/reconciliation") return route.fulfill({ json: { can_reconcile: true, events: [] } });
    return route.fulfill({ json: [] });
  });
  await page.goto("/panel/lalamove");
  await page.getByRole("navigation", { name: "Delivery workspace" }).getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Webhook setup", exact: true })).toBeVisible();
  await expect(page.getByText("Last callback received: No callback received yet")).toBeVisible();
  expect(registrations).toBe(0);
  await page.getByRole("button", { name: "Register sandbox webhook", exact: true }).click();
  await expect(page.getByText("Webhook URL registered. Select webhook event version v3 in Lalamove Partner Portal.")).toBeVisible();
  expect(registrations).toBe(1);
});

test("Lalamove overview keeps history filters in the URL and fits a mobile viewport", async ({ page }, testInfo) => {
  await browserLogin(page);
  const rows = [
    { id: 1, order_id: 101, order_number: "ORDER-ALPHA", active: true, status: "ON_GOING", booking_state: "CONFIRMED" },
    { id: 2, order_id: 102, order_number: "ORDER-BETA", active: true, status: "PENDING", booking_state: "UNKNOWN" },
    { id: 3, order_id: 103, order_number: "ORDER-GAMMA", active: false, status: "COMPLETED", booking_state: "CONFIRMED" },
  ].map(row => ({ ...row, environment: "sandbox", lalamove_order_id: "1234567890123456789", delivery_fee: "125", currency: "PHP", last_synced_at: "2026-11-09T01:00:00Z" }));
  await page.route("**/api/lalamove/**", route => {
    const path = new URL(route.request().url()).pathname.replace("/api/lalamove", "");
    if (path === "/setup") return route.fulfill({ json: { can_manage: true, enabled: true, environment: "sandbox", callback_url: null, last_callback_at: null } });
    if (path === "/reconciliation") return route.fulfill({ json: { can_reconcile: true, events: [] } });
    if (path === "/eligible") return route.fulfill({ json: [{ id: 123, order_number: "READY-123", shipping_address: "A long customer destination, barangay and street information, Metro Manila, Philippines" }] });
    if (path === "/orders") return route.fulfill({ json: rows });
    throw new Error(`Unexpected Lalamove request: ${path}`);
  });
  await page.goto("/panel/lalamove");
  await expect(page.getByRole("heading", { name: "Orders ready for delivery", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Webhook setup", exact: true })).toHaveCount(0);
  await page.getByRole("group", { name: "Filter booking history" }).getByRole("button", { name: "Active", exact: true }).click();
  await expect(page).toHaveURL(/filter=active/);
  await page.getByLabel("Search order or destination", { exact: true }).fill("ORDER-ALPHA");
  await page.getByRole("search", { name: "Search loaded deliveries" }).getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/q=ORDER-ALPHA/);
  await expect(page.getByRole("link", { name: "ORDER-ALPHA", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "ORDER-BETA", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Search order or destination", { exact: true })).toHaveValue("ORDER-ALPHA");
  await expect(page.getByRole("button", { name: "Active", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/panel/lalamove?view=history&filter=review");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("link", { name: "ORDER-BETA", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "ORDER-GAMMA", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("lalamove-history-mobile.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/panel/lalamove");
  await expect(page.getByRole("link", { name: "Review delivery", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("lalamove-overview-desktop.png"), fullPage: true });
});

test("Lalamove cancellation requires a separate confirmation and can be dismissed safely", async ({ page }) => {
  await browserLogin(page);
  let cancellations = 0;
  let canceled = false;
  await page.route("**/api/lalamove/**", route => {
    const path = new URL(route.request().url()).pathname.replace("/api/lalamove", "");
    const booking = { id: 10, order_id: 123, environment: "sandbox", status: canceled ? "CANCELED" : "ON_GOING", booking_state: canceled ? "RESOLVED" : "CONFIRMED", active: !canceled, lalamove_order_id: "1234567890123456789", delivery_fee: "125", currency: "PHP", share_link: null, driver_details: null, failure_message: null, last_synced_at: "2026-11-09T01:00:00Z", picked_up_at: null };
    if (path === "/context/123") return route.fulfill({ json: { order: { id: 123, order_number: "CANCEL-123", version: 1, status: canceled ? "SCHEDULING" : "SCHEDULED", delivery_method: "LALAMOVE", shipping_address: "Fixture destination", shipping_recipient: "Recipient" }, warehouse: { id: 1, name: "Fixture warehouse", street_address: "Pickup street", city: "City", state: "Province", zip_code: "0000", version: 1, phone_number: "+639171234567" }, bookings: [booking], history: [], can_reconcile: true, eligible: true, reason: null, enabled: false, environment: "sandbox" } });
    if (path === "/context/123/warehouses") return route.fulfill({ json: { rows: [], total: 0 } });
    if (path === "/orders/10/cancel") { cancellations++; canceled = true; return route.fulfill({ json: { ...booking, status: "CANCELED", active: false } }); }
    throw new Error(`Unexpected Lalamove request: ${path}`);
  });
  await page.goto("/panel/lalamove?orderId=123");
  await page.getByRole("button", { name: "Cancel courier", exact: true }).click();
  await expect(page.getByRole("region", { name: "Confirm courier cancellation" })).toBeVisible();
  expect(cancellations).toBe(0);
  await page.getByRole("button", { name: "Keep booking", exact: true }).click();
  await expect(page.getByRole("region", { name: "Confirm courier cancellation" })).toHaveCount(0);
  expect(cancellations).toBe(0);
  await page.getByRole("button", { name: "Cancel courier", exact: true }).click();
  await page.getByRole("button", { name: "Confirm cancellation", exact: true }).click();
  await expect(page.getByText("The previous courier attempt has ended.", { exact: false })).toBeVisible();
  expect(cancellations).toBe(1);
});
