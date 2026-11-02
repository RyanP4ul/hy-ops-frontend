import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";
import { browserLogin, json, order } from "./helpers";
import type { AxeResults } from "axe-core";

for (const moduleName of ["products", "inventory", "warehouses", "calendar", "vehicles", "users"]) {
  test(`UIUX ${moduleName} supports accessible desktop/mobile layouts and keyboard dialogs`, async ({ page }, testInfo) => {
    test.setTimeout(150_000);
    await browserLogin(page);
    await page.goto(`/panel/${moduleName}`);
    await page.waitForLoadState("networkidle");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
    const findings: unknown[] = [];
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 844 });
      const audit = await page.evaluate(async () => {
        await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
        return (window as unknown as { axe: { run: (options: unknown) => Promise<AxeResults> } }).axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
      });
      await page.screenshot({ path: testInfo.outputPath(`${moduleName}-${width}.png`) });
      findings.push({ width, violations: audit.violations });
      expect.soft(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${moduleName} overflows ${width}px`).toBe(true);
      expect.soft(audit.violations.map(v => `${v.id}: ${JSON.stringify(v.nodes.map(n => n.target))}`), `${moduleName} accessibility at ${width}px`).toEqual([]);
    }
    await testInfo.attach("uiux-accessibility", { body: JSON.stringify(findings, null, 2), contentType: "application/json" });
    const trigger = page.getByRole("button", { name: moduleName === "calendar" ? "New Event" : `Add ${ { products: "Product", inventory: "Inventory Item", warehouses: "Warehouse", vehicles: "Vehicle", users: "User" }[moduleName] }`, exact: true });
    await trigger.focus(); await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const dialogAudit = await page.evaluate(async () => (window as unknown as { axe: { run: (options: unknown) => Promise<AxeResults> } }).axe.run({ runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } }));
    expect.soft(dialogAudit.violations.map(v => `${v.id}: ${JSON.stringify(v.nodes.map(n => n.target))}`), `${moduleName} dialog accessibility`).toEqual([]);
    await expect(dialog).toHaveJSProperty("scrollWidth", await dialog.evaluate(el => el.clientWidth));
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      expect.soft(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    if (await dialog.count()) await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}


const sampleVariant = (sku: string) => ({ name: "UIUX variant", sku, description: "Fixture variant", price: "12.34", unit: "box", weight_kg: "1.25", width_value: "1", width_unit: "m", length_value: "2", length_unit: "m" });

test("UIUX Products creates, edits and removes draft variants without duplication, then saves decimal prices", async ({ page }) => {
  await browserLogin(page); await page.goto("/panel/products");
  await page.getByRole("button", { name: "Add Product", exact: true }).click();
  const main = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Add Product", exact: true }) });
  await main.getByLabel("Product Name", { exact: false }).fill("UIUX created product");
  await main.getByRole("button", { name: "Add variant", exact: true }).click();
  const variant = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Add Variant", exact: true }) });
  await variant.locator("#name").fill("UIUX variant");
  await variant.getByLabel("SKU", { exact: false }).fill("UIUX-CREATED-SKU");
  await variant.getByLabel("Price", { exact: false }).fill("12.34");
  await variant.getByLabel("Description", { exact: false }).fill("Saved description");
  await variant.getByLabel("Weight (kg)", { exact: true }).fill("1.25");
  await variant.getByRole("button", { name: "Add Variant", exact: true }).click();
  await expect(variant).toHaveCount(0);
  await main.getByRole("button", { name: "Edit variant UIUX-CREATED-SKU", exact: true }).click();
  const edit = page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Edit Variant", exact: true }) });
  await expect(edit.getByLabel("Price", { exact: false })).toHaveValue("12.34");
  await edit.getByLabel("Price", { exact: false }).fill("15.67");
  await edit.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(edit).toHaveCount(0);
  await expect(main.getByRole("row").filter({ hasText: "UIUX-CREATED-SKU" })).toHaveCount(1);
  await main.getByRole("button", { name: "Add Product", exact: true }).click();
  await expect(main).toHaveCount(0);
  await page.getByPlaceholder("Search products or variants...").fill("UIUX-CREATED-SKU");
  const row = page.getByRole("row").filter({ hasText: "UIUX created product" });
  await expect(row).toBeVisible();
  await row.locator("summary").click(); await expect(row).toContainText("15.67");
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Remove variant UIUX-CREATED-SKU", exact: true }).click();
  await page.getByRole("dialog").filter({ has: page.getByRole("heading", { name: "Delete Variant", exact: true }) }).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog.getByText("No variants have been added yet.", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByPlaceholder("Search products or variants...").fill("UIUX created product");
  await row.getByRole("button", { name: "Delete", exact: true }).click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(row).toHaveCount(0);
});

test("UIUX Products preserves stale drafts, offers detail retry and protects inventory-linked deletion", async ({ page }) => {
  await browserLogin(page);
  const created = await json(page.request, "POST", "/products", { name: "UIUX stale product", version: 0, variants: [sampleVariant("UIUX-STALE-SKU")] });
  await page.goto("/panel/products"); await page.getByPlaceholder("Search products or variants...").fill("UIUX stale product");
  const row = page.getByRole("row").filter({ hasText: "UIUX stale product" });
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Product Name", { exact: false })).toHaveValue("UIUX stale product");
  await dialog.getByLabel("Product Name", { exact: false }).fill("Keep this product draft");
  const current = await json(page.request, "GET", `/products/${created.id}`);
  await json(page.request, "PUT", `/products/${created.id}`, { ...current, name: "UIUX stale product other editor" });
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(/modified|mismatch/i);
  await expect(dialog.getByLabel("Product Name", { exact: false })).toHaveValue("Keep this product draft");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await json(page.request, "POST", "/inventory", { warehouse_id: 1, product_variant_id: current.variants[0].id, quantity: 1 });
  await expect(row).toContainText("other editor");
  await row.getByRole("button", { name: "Delete", exact: true }).click(); await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(/inventory|stock|history/i);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  let fail = true;
  await page.route(`**/api/products/${created.id}`, route => route.request().method() === "GET" && fail ? route.fulfill({ status: 503, json: { message: "Fixture detail failure" } }) : route.continue());
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(/product details/);
  await expect(dialog.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
  fail = false; await dialog.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(dialog.getByLabel("Product Name", { exact: false })).toHaveValue("UIUX stale product other editor");
});

test("UIUX Products filters, keyboard pagination and table retry retain the selected scope", async ({ page }) => {
  await browserLogin(page); await page.goto("/panel/products");
  await expect(page.getByRole("button", { name: "First page", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Next page", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Next page", exact: true }).focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Page 2 of" })).toBeVisible();
  await page.getByPlaceholder("Search products or variants...").fill("Performance");
  await expect(page.getByRole("status").filter({ hasText: "Page 1 of" })).toBeVisible();
  await page.getByRole("combobox", { name: "Filter products by variants" }).click(); await page.getByRole("option", { name: "Without variants", exact: true }).click();
  let fail = true;
  await page.route("**/api/products?*", route => fail ? route.fulfill({ status: 503, json: { message: "Fixture table failure" } }) : route.continue());
  await page.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Unable to load products" })).toBeVisible();
  fail = false; await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "Performance product" }).first()).toBeVisible();
  await expect(page.getByPlaceholder("Search products or variants...")).toHaveValue("Performance");
  await expect(page.getByRole("combobox", { name: "Filter products by variants" })).toContainText("Without variants");
});

test("UIUX Inventory adjusts with reasons, preserves history and reviews legacy reservation discrepancies", async ({ page }) => {
  await browserLogin(page);
  const product = await json(page.request, "POST", "/products", { name: "UIUX stock product", version: 0, variants: [sampleVariant("UIUX-STOCK-SKU")] });
  await json(page.request, "POST", "/inventory", { warehouse_id: 1, product_variant_id: product.variants[0].id, quantity: 5 });
  const stocks = await json(page.request, "GET", "/inventory?search=UIUX-STOCK-SKU"); const stock = stocks[0];
  const created = await json(page.request, "POST", "/orders", { ...order, items: [{ inventory_id: stock.id, quantity: 2 }] });
  await page.goto("/panel/inventory"); await page.getByPlaceholder("Search SKU or Product Name...").fill("UIUX-STOCK-SKU");
  const row = page.getByRole("row").filter({ hasText: "UIUX-STOCK-SKU" });
  await row.getByRole("button", { name: "Edit inventory", exact: true }).click(); const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Reserved", { exact: false })).toHaveValue("2");
  await expect(dialog.getByLabel("Reserved", { exact: false })).toHaveAttribute("readonly", "");
  await dialog.getByLabel("Quantity", { exact: false }).fill("8");
  await dialog.getByLabel("Reason for stock adjustment").fill("UIUX received delivery");
  await dialog.getByRole("button", { name: "Save Changes", exact: true }).click(); await expect(dialog).toHaveCount(0);
  await row.locator("summary").click(); await expect(row).toContainText("UIUX received delivery");
  // Simulate a legacy reservation only in the disposable database explicitly owned by this runner.
  const fixtureUrl = new URL(process.env.HYOPS_TEST_DATABASE_URL!);
  expect(["127.0.0.1", "localhost"]).toContain(fixtureUrl.hostname); expect(fixtureUrl.pathname).toBe("/hyops_test");
  const postgres = createRequire(process.cwd() + "/package.json")("../backend/node_modules/postgres") as typeof import("../../backend/node_modules/postgres");
  const sql = postgres(fixtureUrl.toString());
  try { await sql`update inventory set reserved=0 where id=${stock.id}`; await sql`update orders set stock_reserved=false where id=${created.id}`; } finally { await sql.end(); }
  await page.getByText("Review legacy reservations", { exact: true }).click();
  await expect(page.getByText(/UIUX-STOCK-SKU at Live warehouse/)).toBeVisible();
  await page.getByLabel("Reason for reconciliation").fill("UIUX reviewed legacy order and stock");
  await page.getByRole("button", { name: "Confirm reconciliation", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Reservations reconciled" })).toBeVisible();
  const current = await json(page.request, "GET", `/inventory/${stock.id}`); expect(current.quantity).toBe(8); expect(current.reserved).toBe(2);
  await page.getByText("Replenishment suggestions", { exact: true }).click(); await expect(page.getByText(/UIUX-STOCK-SKU.*suggested/)).toBeVisible();
  await row.getByRole("button", { name: "Delete inventory", exact: true }).click(); await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText(/history|stock|reserved|empty/i);
});

test("UIUX Warehouse map and address search failures retain manual entry and expose retry", async ({ page }) => {
  await browserLogin(page); await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/geocode/search?*", route => route.fulfill({ status: 502, json: { message: "Fixture provider unavailable" } }));
  await page.goto("/panel/warehouses"); await page.getByRole("button", { name: "Add Warehouse", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Search Warehouse Address").fill("Unavailable provider search");
  await expect(dialog.getByRole("alert")).toContainText("Unable to load address search");
  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("button", { name: "Retry map", exact: true })).toBeVisible();
  for (const [label, value] of Object.entries({ "Warehouse Name": "UIUX manual warehouse", "Street Address": "Manual street", "City": "Manual city", "Province": "Manual province", "Zip Code": "0123" })) await dialog.getByLabel(label, { exact: false }).fill(value);
  await dialog.getByRole("button", { name: "Save Warehouse", exact: true }).click(); await expect(dialog).toHaveCount(0);
  await page.getByPlaceholder("Search warehouses...").fill("UIUX manual warehouse"); await expect(page.getByRole("row").filter({ hasText: "UIUX manual warehouse" })).toContainText("Manual street");
});

test("UIUX staff operational access preserves the administrative page boundaries", async ({ page }) => {
  await browserLogin(page, "staff@example.test");
  for (const moduleName of ["products", "inventory", "warehouses", "vehicles"]) { await page.goto(`/panel/${moduleName}`); await expect(page.getByRole("heading", { name: new RegExp(moduleName, "i") }).first()).toBeVisible(); }
  for (const moduleName of ["users", "calendar"]) { await page.goto(`/panel/${moduleName}`); await expect(page).toHaveURL(/\/panel$/); }
  expect((await page.request.post("/api/inventory/reconciliation", { data: { token: "0".repeat(64), reason: "Not authorized" } })).status()).toBe(403);
});


test("UIUX Calendar keeps early overlapping events readable, filters categories and recovers from fetch failure", async ({ page }) => {
  await browserLogin(page); await page.setViewportSize({ width: 390, height: 844 });
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  await json(page.request, "POST", "/calendar/event", { title: "UIUX early A", category: "DELIVERY", date, start_time: "00:30", end_time: "01:30" });
  await json(page.request, "POST", "/calendar/event", { title: "UIUX early B", category: "OTHER", date, start_time: "00:45", end_time: "01:45" });
  await page.goto("/panel/calendar"); await page.getByRole("button", { name: "Day", exact: true }).click();
  const a = page.getByRole("button", { name: /^Edit UIUX early A,/ }), b = page.getByRole("button", { name: /^Edit UIUX early B,/ });
  await a.scrollIntoViewIfNeeded(); await expect(a).toBeVisible(); await expect(b).toBeVisible();
  const ab = (await a.boundingBox())!, bb = (await b.boundingBox())!;
  expect(ab.x + ab.width <= bb.x + 1 || bb.x + bb.width <= ab.x + 1).toBe(true);
  await page.getByRole("button", { name: "DELIVERY", exact: true }).click(); await expect(b).toHaveCount(0); await expect(a).toBeVisible();
  await page.getByRole("button", { name: "All categories", exact: true }).click(); await expect(b).toBeVisible();
  await page.getByRole("button", { name: "Month", exact: true }).click(); await expect(a).toBeVisible();
  await page.route("**/api/calendar/events", async route => {
    const recover = await page.evaluate(() => (window as unknown as { recoverCalendar?: boolean }).recoverCalendar === true);
    return recover ? route.continue() : route.fulfill({ status: 503, json: { message: "Fixture unavailable" } });
  });
  await page.reload();
  const recovery = page.getByRole("alert").filter({ hasText: "Unable to load calendar events" });
  await expect(recovery).toBeVisible();
  const retry = recovery.getByRole("button", { name: "Retry", exact: true });
  await retry.evaluate(button => button.addEventListener("click", () => { (window as unknown as { recoverCalendar: boolean }).recoverCalendar = true; }, { capture: true }));
  await retry.click();
  await expect(recovery).toHaveCount(0);
  await expect(page.getByText("All dates and times are in Asia/Manila", { exact: false })).toBeVisible();
});
