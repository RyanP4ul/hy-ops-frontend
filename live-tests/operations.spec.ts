import { expect, test, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { browserLogin, connectSocket, json, order, password } from "./helpers";

test.use({ timezoneId: "America/Los_Angeles", actionTimeout: 15_000 });
test.setTimeout(100_000);
const blankStyle = { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": "#f5f5f5" } }] };
function fixtureSql() {
  const url = new URL(process.env.HYOPS_TEST_DATABASE_URL!);
  expect(url.hostname).toBe("127.0.0.1"); expect(url.pathname).toBe("/hyops_test");
  const postgres = createRequire(process.cwd() + "/package.json")("../backend/node_modules/postgres") as typeof import("../../backend/node_modules/postgres");
  return postgres(url.toString());
}
async function ready(page: Page) {
  const created = await json(page.request, "POST", "/orders", order);
  await json(page.request, "POST", `/orders/process/${created.id}?version=1`);
  await json(page.request, "POST", `/orders/delivery/${created.id}?version=2`);
  return created;
}
async function payRow(page: Page, paymentNumber: string) {
  await page.goto("/panel/payments");
  await page.getByPlaceholder(/Search payments/).fill(paymentNumber);
  const row = page.getByRole("row").filter({ hasText: paymentNumber }); await expect(row).toBeVisible(); return row;
}

test("HY Users forbids self-deactivation and preserves protected account actions", async ({ page }) => {
  await browserLogin(page); await page.goto("/panel/users");
  await page.getByPlaceholder("Search users...").fill("admin@example.test");
  await expect(page.getByRole("button", { name: "Deactivate user Live Admin", exact: true })).toBeDisabled();
  const denied = await page.request.post("/api/users/1/archive?version=1");
  expect(denied.ok()).toBe(false);
  await expect(page.getByRole("button", { name: /Delete user/ })).toHaveCount(0);
  expect((await json(page.request, "GET", "/users/1")).role).toBe("admin");
});

test("HY delivery navigation and row action schedule the selected order with clear labels", async ({ page }) => {
  await browserLogin(page); const created = await ready(page);
  await page.goto("/panel/deliveries"); await page.getByRole("button", { name: "Schedule Delivery", exact: true }).click();
  await expect(page).toHaveURL(/delivery-schedules$/);
  await expect(page.getByRole("heading", { name: "Delivery Schedules", exact: true, level: 2 })).toBeVisible();
  await page.getByPlaceholder(/Search/).last().fill(created.product_number);
  const row = page.getByRole("row").filter({ hasText: created.product_number });
  await row.getByRole("button", { name: `Schedule order ${created.product_number}`, exact: true }).click();
  const dialog = page.getByRole("dialog"); await expect(dialog).toContainText(created.product_number);
  await expect(dialog).toContainText("Step 2 of 6");
});

test("HY Payments retains the amount draft and captured version when another collection arrives", async ({ page }) => {
  await browserLogin(page); const created = await json(page.request, "POST", "/orders", order);
  const payments = await json(page.request, "GET", "/payments?limit=100");
  const payment = payments.find((p: { order_id: number }) => p.order_id === created.id);
  const row = await payRow(page, payment.payment_number);
  await row.getByRole("button", { name: "Details", exact: true }).click(); const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Payment Amount", { exact: false }).fill("5.25");
  await json(page.request, "POST", "/payments", { payment_number: payment.payment_number, payment_amount: 1, version: payment.version });
  await expect(dialog).toContainText("1.00");
  await expect(dialog.getByLabel("Payment Amount", { exact: false })).toHaveValue("5.25");
  await dialog.getByRole("button", { name: "Record Payment", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(/version|changed|refresh/i);
  await expect(dialog.getByLabel("Payment Amount", { exact: false })).toHaveValue("5.25");
  const fresh = await json(page.request, "GET", `/payments?search=${payment.payment_number}`); expect(Number(fresh[0].amount)).toBe(1);
});

test("HY receipt dates remain collection dates after full refunds and money displays remain exact", async ({ page }) => {
  await browserLogin(page); const created = await json(page.request, "POST", "/orders", { ...order, amount_paid: 12.34 });
  let payments = await json(page.request, "GET", "/payments?limit=100"); let payment = payments.find((p: { order_id: number }) => p.order_id === created.id);
  const receivedAt = payment.received_at; expect(receivedAt).toBeTruthy();
  const row = await payRow(page, payment.payment_number);
  await row.getByRole("button", { name: "Refund / history", exact: true }).click();
  await page.getByLabel("Refund amount", { exact: true }).fill("12.34"); await page.getByLabel("Reason", { exact: true }).fill("HY complete refund acceptance");
  await page.getByRole("button", { name: "Record refund", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Refund recorded" })).toBeVisible();
  await page.keyboard.press("Escape"); await expect(row).toContainText("Fully refunded"); await expect(row).toContainText("0.00");
  payments = await json(page.request, "GET", `/payments?search=${payment.payment_number}`); payment = payments[0];
  expect(Number(payment.amount)).toBe(0); expect(Number(payment.gross_received)).toBe(12.34); expect(payment.received_at).toBe(receivedAt);
  const when = new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(new Date(receivedAt));
  await expect(row).toContainText(when);
});

test("HY historical prices survive catalog edits and unknown snapshots stay unverified in reports and scheduling", async ({ page }) => {
  await browserLogin(page);
  const product = await json(page.request, "POST", "/products", { name: "HY historical product", version: 0, variants: [{ name: "HY variant", sku: "HY-HISTORICAL", price: "12.34", unit: "box", description: "Historical fixture", width_value: "0", width_unit: "m", length_value: "0", length_unit: "m", weight_kg: "0" }] });
  await json(page.request, "POST", "/inventory", { warehouse_id: 1, product_variant_id: product.variants[0].id, quantity: 20 });
  const stock = (await json(page.request, "GET", "/inventory?search=HY-HISTORICAL"))[0];
  const created = await json(page.request, "POST", "/orders", { ...order, items: [{ inventory_id: stock.id, quantity: 2 }] });
  const sql = fixtureSql();
  try { await sql`update product_variants set price=999.99 where id=${product.variants[0].id}`; } finally { await sql.end(); }
  const filters = encodeURIComponent(JSON.stringify({ preset: "today", products: [String(product.id)] }));
  await page.goto(`/panel/analysis-reports?tab=sales&f=${filters}`); await expect(page.getByText(/24\.68/).first()).toBeVisible();
  const snapshots = await json(page.request, "GET", `/orders/details?ids=${created.id}`); expect(snapshots[0].total).toBe(24.68);
  const legacySql = fixtureSql();
  try { await legacySql`update order_items set unit_price_snapshot=null,price_source='legacy_unknown' where order_id=${created.id}`; } finally { await legacySql.end(); }
  await page.reload(); await expect(page.getByText("Unverified", { exact: true }).first()).toBeVisible();
  const payment = (await json(page.request, "GET", "/payments?limit=100")).find((p: { order_id: number }) => p.order_id === created.id);
  expect(payment.payment_status).toBe("UNVERIFIED");
  const csv = await page.request.get(`/api/reports/export?type=Sales&format=csv&preset=today&products=${product.id}`);
  expect(csv.status()).toBe(200); expect(await csv.text()).toContain("Unverified");
  await json(page.request, "POST", `/orders/process/${created.id}?version=1`); await json(page.request, "POST", `/orders/delivery/${created.id}?version=2`);
  await page.goto("/panel/delivery-schedules"); await page.getByPlaceholder(/Search/).last().fill(created.product_number);
  await page.getByRole("button", { name: `Schedule order ${created.product_number}`, exact: true }).click();
  const dialog = page.getByRole("dialog"); await dialog.locator("#scheduledDate").click(); await page.locator("button[data-day]:not([disabled])").last().click(); await dialog.locator("#scheduledDate").click();
  await dialog.locator("#scheduled_time").fill("23:57"); await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await expect(dialog.getByRole("row").filter({ hasText: created.product_number })).toContainText("Unverified");
});

test("HY real app sockets reconcile another backend and recover missed records without losing filters", async ({ browser }) => {
  const first = await browser.newContext(), second = await browser.newContext();
  try {
    const a = await first.newPage(), b = await second.newPage(); await browserLogin(a); await browserLogin(b, "other@example.test");
    await b.goto("/panel/products"); await b.getByPlaceholder("Search products or variants...").fill("HY synced");
    await expect(b.getByRole("status", { name: "Live update connection" })).toContainText("connected");
    const cookies = (await first.cookies()).map(c => `${c.name}=${c.value}`).join("; ");
    const result = await first.request.post("http://127.0.0.1:5181/products", { headers: { Cookie: cookies }, data: { name: "HY synced cross-process", variants: [], version: 0 } }); expect(result.status()).toBe(200);
    await expect(b.getByRole("row").filter({ hasText: "HY synced cross-process" })).toBeVisible();
    await second.setOffline(true);
    await expect(b.getByRole("status", { name: "Live update connection" })).toContainText("Disconnected");
    await expect(b.getByRole("row").filter({ hasText: "HY synced cross-process" })).toBeVisible();
    await json(first.request, "POST", "/products", { name: "HY synced while offline", variants: [], version: 0 });
    await second.setOffline(false);
    await expect(b.getByRole("status", { name: "Live update connection" })).toContainText("connected");
    await expect(b.getByRole("row").filter({ hasText: "HY synced while offline" })).toBeVisible();
    await expect(b.getByPlaceholder("Search products or variants...")).toHaveValue("HY synced");
  } finally { await first.close(); await second.close(); }
});

test("HY GPS fix age is independent from successful API sync and live socket connectivity", async ({ page, browser }) => {
  await browserLogin(page); const created = await ready(page);
  const delivery = await json(page.request, "POST", "/deliveries", { order_ids: [created.id], scheduled_date: "2099-01-09", scheduled_time: "10:31", delivery_type: "INTERNAL", driver_id: 5, vehicle_id: 1, delivery_allowance: 0, fuel: 0, toll: 0 });
  await json(page.request, "POST", `/deliveries/${delivery.id}/dispatch`);
  const driver = await browser.newContext();
  try {
    const mobileLogin = await driver.request.post("http://127.0.0.1:3100/api/auth/login", { data: { email: "driver@example.test", password, is_mobile: true } });
    expect(mobileLogin.status()).toBe(200);
    expect((await driver.request.get("http://127.0.0.1:5180/auth/me")).status()).toBe(200);
    // Use a real loopback document so Chromium can establish its local network address space.
    const observer = await driver.newPage(); await observer.goto("http://127.0.0.1:3100/"); await connectSocket(observer);
    const old = new Date(Date.now() - 180_000).toISOString();
    const sendFix = (recordedAt: string, lat = 14.6) => observer.evaluate(({ id, recordedAt, lat }) => (window as unknown as { fixtureSocket: WebSocket }).fixtureSocket.send(JSON.stringify({ type: "DRIVER_LOCATION_UPDATE", payload: [String(id), lat, 121.2, 5, 0, 90, recordedAt] })), { id: delivery.id, recordedAt, lat });
    await sendFix(old);
    await expect.poll(async () => (await json(page.request, "GET", "/fleet/positions")).positions[0]?.recordedAt).toBe(old);
    await page.bringToFront(); // GPS polling intentionally pauses in background tabs.
    await page.route("https://basemaps.cartocdn.com/gl/positron-gl-style/style.json", route => route.fulfill({ json: blankStyle })); await page.goto("/panel/fleet-map");
    await page.getByRole("button").filter({ hasText: "LIVE-001" }).first().click();
    await expect(page.getByText(/Last seen 3m ago/).first()).toBeVisible(); await expect(page.getByText(/^GPS checked/)).toBeVisible();
    const before = (await json(page.request, "GET", "/fleet/positions")).positions[0]; await sendFix(old, 10);
    await expect.poll(async () => (await json(page.request, "GET", "/fleet/positions")).positions[0].receivedAt).toBe(before.receivedAt);
    const fresh = new Date().toISOString(); await sendFix(fresh);
    await expect.poll(async () => (await json(page.request, "GET", "/fleet/positions")).positions[0].recordedAt).toBe(fresh);
    await expect(page.getByText(/Last observed interval:/)).toBeVisible({ timeout: 15_000 }); await expect(page.getByText(/^Live .*ago|^Live .*just now/).first()).toBeVisible();
    let failed = true;
    await page.route("**/api/fleet/positions", route => failed ? route.fulfill({ status: 503, json: { message: "Fixture GPS API failure" } }) : route.continue());
    await expect(page.getByText(/^GPS sync failed/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("status", { name: "Live update connection" })).toContainText("connected");
    failed = false; await page.getByRole("button", { name: "Retry gps sync", exact: true }).click(); await expect(page.getByText(/^GPS checked/)).toBeVisible();
    const fleet = await json(page.request, "GET", "/fleet"); for (const stop of fleet.vehicles.find((v: { id: string }) => v.id === "1").stops) await json(page.request, "POST", `/deliveries/stops/${stop.id}/delivered`); await json(page.request, "POST", `/deliveries/${delivery.id}/complete`);
  } finally { await driver.close(); }
});


test("HY deactivation revokes a real browser socket on a different backend and retains account history", async ({ browser }) => {
  const admin = await browser.newContext(), target = await browser.newContext();
  try {
    const a = await admin.newPage(); await browserLogin(a);
    await json(admin.request, "POST", "/users", { name: "HY revoked staff", email: "hy-revoked@example.test", password, role: "staff", profile: { warehouse_id: 1 } });
    const b = await target.newPage();
    await b.addInitScript(() => {
      const NativeSocket = window.WebSocket;
      window.WebSocket = class extends NativeSocket {
        constructor(address: string | URL, protocols?: string | string[]) {
          const url = new URL(String(address)); if (url.pathname === "/ws") url.port = "5181";
          super(url.toString(), protocols);
        }
      };
    });
    const closes: number[] = [];
    b.on("websocket", socket => socket.on("close", () => closes.push(1)));
    await browserLogin(b, "hy-revoked@example.test");
    await expect(b.getByRole("status", { name: "Live update connection" })).toContainText("connected");
    const cookie = (await target.cookies()).map(c => `${c.name}=${c.value}`).join("; ");
    await a.goto("/panel/users"); await a.getByPlaceholder("Search users...").fill("hy-revoked@example.test");
    await a.getByRole("button", { name: "Deactivate user HY revoked staff", exact: true }).click();
    await a.getByRole("dialog").getByRole("button", { name: "Deactivate User", exact: true }).click();
    await expect(b).toHaveURL(/\/$/, { timeout: 20_000 }); expect(closes.length).toBeGreaterThan(0);
    expect((await target.request.get("http://127.0.0.1:5181/auth/me", { headers: { Cookie: cookie } })).status()).toBe(401);
    expect(JSON.stringify(await json(admin.request, "GET", "/archives?limit=100"))).toContain("HY revoked staff");
  } finally { await admin.close(); await target.close(); }
});
